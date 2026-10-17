import {
  RlcCircuitConfig,
  RlcTopologyConfig,
  RlcTransientInitialConditions,
  RlcSamplePoint,
  RlcTransientMetrics,
  DEFAULT_RLC_TOPOLOGY,
  DEFAULT_RLC_TRANSIENT_INITIAL,
} from '../types/rlcCircuit';
import { computeRlcCircuitMetrics } from './rlcCircuitModel';
import { degToRad } from './complexMath';

export interface RlcTransientTrajectory {
  points: RlcSamplePoint[];
  steadyStateReferencePoints?: {
    tRelativeMs: number;
    tAbsoluteSec: number;
    currentSs: number;
    vCapacitorSs: number;
  }[];
  metrics: RlcTransientMetrics;
  windowDurationMs: number;
}

/**
 * Solves the transient time-domain response of the series RLC circuit from t = 0 to tTargetSec
 * using 4th-Order Runge-Kutta (RK4) integration with exact KVL verification.
 * 
 * Supports:
 * - Full Series RLC (R >= 0, L > 0, C > 0)
 * - Series RC (L bypassed or 0, R > 0, C > 0)
 * - Series RL (C bypassed, R >= 0, L > 0)
 * - Purely Resistive (L bypassed or 0, C bypassed, R > 0)
 * - Purely Capacitive (R = 0, L = 0, C > 0)
 * - Open Circuit (C removed or 0)
 * - Ideal Short Circuit (all bypassed or 0)
 */
export function solveRlcTransient(
  config: RlcCircuitConfig,
  topology: RlcTopologyConfig = DEFAULT_RLC_TOPOLOGY,
  initialConditions: RlcTransientInitialConditions = DEFAULT_RLC_TRANSIENT_INITIAL,
  timeSec: number = 0,
  visibleDurationMs: number = 50,
  numDisplayPoints: number = 700,
  includeSteadyStateOverlay: boolean = false
): RlcTransientTrajectory {
  const vSourceRms = Math.max(0, config.vSourceRms);
  const phiSRad = degToRad(config.vSourcePhaseDeg ?? 0);
  const f = Math.max(0.01, config.frequency);
  const omega = 2 * Math.PI * f;
  const vSourcePeak = vSourceRms * Math.SQRT2;

  // Effective component values based on enable/bypass/remove topology
  const isResistorBypassed = topology.resistor === 'bypassed';
  const isInductorBypassed = topology.inductor === 'bypassed';
  const isCapacitorRemoved = topology.capacitor === 'removed';
  const isCapacitorBypassed = topology.capacitor === 'bypassed';

  const R = isResistorBypassed ? 0 : Math.max(0, config.resistance);
  const L = isInductorBypassed ? 0 : Math.max(0, config.inductanceMh * 1e-3);
  const C = isCapacitorBypassed
    ? -1 // Marker for bypassed capacitor (wire)
    : isCapacitorRemoved
    ? 0 // Marker for removed capacitor (open circuit)
    : Math.max(0, config.capacitanceUf * 1e-6);

  // Determine window range: [tStartSec, tEndSec]
  const windowDurationSec = Math.max(0.005, visibleDurationMs * 1e-3);
  const tEndSec = Math.max(windowDurationSec, timeSec);
  const tStartSec = Math.max(0, tEndSec - windowDurationSec);

  // Classification & Dynamic Parameters
  let dampingType: RlcTransientMetrics['dampingType'] = 'n/a';
  let dampingRatio: number | null = null;
  let naturalFrequencyHz: number | null = null;
  let statusMessage = 'Transient time-domain simulation active.';

  // Open circuit check
  const isOpenCircuit = C === 0;
  // Unbounded short check
  const isAllBypassed = R === 0 && L === 0 && (C === -1 || C === 0);

  if (isOpenCircuit) {
    statusMessage = isCapacitorRemoved
      ? 'Open circuit (Capacitor removed): current is zero, source voltage appears across open terminals.'
      : 'Open circuit (C = 0 µF): current is zero, source voltage appears across open capacitor.';
    dampingType = 'n/a';
  } else if (isAllBypassed) {
    statusMessage = vSourceRms > 0
      ? 'Ideal zero-impedance short circuit: theoretical current is unbounded.'
      : 'Indeterminate ideal circuit (0 V source with 0 Ω impedance).';
    dampingType = 'lossless';
  } else if (L > 0 && C > 0) {
    // 2nd Order RLC
    const omega0 = 1 / Math.sqrt(L * C);
    naturalFrequencyHz = omega0 / (2 * Math.PI);
    const alpha = R / (2 * L);
    dampingRatio = alpha / omega0;

    if (R === 0) {
      dampingType = 'undamped';
      statusMessage = `Undamped LC oscillator (f₀ = ${naturalFrequencyHz.toFixed(1)} Hz, ζ = 0).`;
    } else if (Math.abs(dampingRatio - 1.0) < 0.01) {
      dampingType = 'critically_damped';
      statusMessage = `Critically damped RLC circuit (f₀ = ${naturalFrequencyHz.toFixed(1)} Hz, ζ ≈ 1.0).`;
    } else if (dampingRatio < 1.0) {
      dampingType = 'underdamped';
      statusMessage = `Underdamped RLC circuit (f₀ = ${naturalFrequencyHz.toFixed(1)} Hz, ζ = ${dampingRatio.toFixed(3)}).`;
    } else {
      dampingType = 'overdamped';
      statusMessage = `Overdamped RLC circuit (f₀ = ${naturalFrequencyHz.toFixed(1)} Hz, ζ = ${dampingRatio.toFixed(3)}).`;
    }
  } else if (L > 0 && C === -1) {
    // 1st Order RL
    dampingType = 'first_order';
    const tau = R > 0 ? (L / R) * 1e3 : Infinity;
    statusMessage = R > 0
      ? `Series RL circuit (L = ${(L * 1e3).toFixed(1)} mH, R = ${R} Ω, τ = ${tau.toFixed(2)} ms).`
      : `Pure inductive circuit (L = ${(L * 1e3).toFixed(1)} mH, lossless).`;
  } else if (L === 0 && C > 0) {
    // 1st Order RC
    dampingType = 'first_order';
    const tau = R > 0 ? R * C * 1e3 : 0;
    statusMessage = R > 0
      ? `Series RC circuit (C = ${(C * 1e6).toFixed(1)} µF, R = ${R} Ω, τ = ${tau.toFixed(2)} ms).`
      : `Pure capacitive circuit (C = ${(C * 1e6).toFixed(1)} µF, lossless).`;
  } else if (R > 0 && L === 0 && C === -1) {
    // Purely Resistive
    dampingType = 'first_order';
    statusMessage = `Purely resistive circuit (R = ${R} Ω, instantaneous Ohm's Law).`;
  }

  // --- Step 2: Numerical Integration Setup ---
  // Choose integration step h small enough for source frequency, natural frequency, and time constants
  let maxStepSec = (1 / f) / 300;
  if (L > 0 && C > 0) {
    const t0 = 2 * Math.PI * Math.sqrt(L * C);
    maxStepSec = Math.min(maxStepSec, t0 / 80);
  }
  if (R > 0 && C > 0 && L === 0) {
    const tau = R * C;
    maxStepSec = Math.min(maxStepSec, tau / 30);
  }
  if (R > 0 && L > 0 && C === -1) {
    const tau = L / R;
    maxStepSec = Math.min(maxStepSec, tau / 30);
  }
  const h = Math.max(1e-6, Math.min(maxStepSec, 5e-5));

  // State variables at t = 0
  let currentIl = initialConditions.initialIl;
  let currentVc = initialConditions.initialVc;

  // Time integration loop from 0 to tEndSec
  // Store sparse sample points matching display window
  const points: RlcSamplePoint[] = [];
  const displayStepSec = windowDurationSec / numDisplayPoints;
  let nextDisplayTimeSec = tStartSec;

  // Helper to compute circuit state at time t with state variables iVal, vcVal
  const evaluateStateAt = (tTarget: number, iVal: number, vcVal: number) => {
    const vSource = vSourcePeak * Math.sin(omega * tTarget + phiSRad);
    let vResistor = 0;
    let vInductor = 0;
    let vCapacitor = 0;
    let current = iVal;

    if (isOpenCircuit) {
      current = 0;
      vResistor = 0;
      vInductor = 0;
      vCapacitor = vSource; // All voltage across open capacitor gap
    } else if (isAllBypassed) {
      current = 0;
      vResistor = 0;
      vInductor = 0;
      vCapacitor = 0;
    } else if (L > 0 && C > 0) {
      // Series RLC
      vResistor = R * current;
      vCapacitor = vcVal;
      vInductor = vSource - vResistor - vCapacitor;
    } else if (L === 0 && C > 0) {
      // Series RC or Pure C
      if (R > 0) {
        vCapacitor = vcVal;
        vResistor = vSource - vCapacitor;
        current = vResistor / R;
        vInductor = 0;
      } else {
        // Pure C
        vCapacitor = vSource;
        current = C * omega * vSourcePeak * Math.cos(omega * tTarget + phiSRad);
        vResistor = 0;
        vInductor = 0;
      }
    } else if (L > 0 && C === -1) {
      // Series RL or Pure L
      vResistor = R * current;
      vCapacitor = 0;
      vInductor = vSource - vResistor;
    } else if (R > 0 && L === 0 && C === -1) {
      // Pure R
      current = vSource / R;
      vResistor = vSource;
      vInductor = 0;
      vCapacitor = 0;
    }

    const kvlError =
      isOpenCircuit || isAllBypassed
        ? 0
        : Math.abs(vSource - (vResistor + vInductor + vCapacitor));

    return { vSource, current, vResistor, vInductor, vCapacitor, kvlError };
  };

  const pushSample = (t: number, iVal: number, vcVal: number) => {
    const state = evaluateStateAt(t, iVal, vcVal);
    const tRelativeMs = (t - tStartSec) * 1000;
    points.push({
      tRelativeMs,
      tAbsoluteSec: t,
      vSource: state.vSource,
      current: state.current,
      vResistor: state.vResistor,
      vInductor: state.vInductor,
      vCapacitor: state.vCapacitor,
    });
  };

  // Runge-Kutta 4 derivative functions
  // For RLC: y = [i, vc]
  const derivRlc = (t: number, iVal: number, vcVal: number): [number, number] => {
    const vs = vSourcePeak * Math.sin(omega * t + phiSRad);
    const di_dt = (vs - R * iVal - vcVal) / L;
    const dvc_dt = iVal / C;
    return [di_dt, dvc_dt];
  };

  // For RC: y = [vc]
  const derivRc = (t: number, vcVal: number): number => {
    const vs = vSourcePeak * Math.sin(omega * t + phiSRad);
    return (vs - vcVal) / (R * C);
  };

  // For RL: y = [i]
  const derivRl = (t: number, iVal: number): number => {
    const vs = vSourcePeak * Math.sin(omega * t + phiSRad);
    return (vs - R * iVal) / L;
  };

  let t = 0;
  let stateAtSimTime: ReturnType<typeof evaluateStateAt> | null = null;

  // If tStartSec is 0, record initial sample at t = 0
  if (tStartSec === 0) {
    pushSample(0, currentIl, currentVc);
    nextDisplayTimeSec = displayStepSec;
  }

  if (timeSec === 0) {
    stateAtSimTime = evaluateStateAt(0, currentIl, currentVc);
  }

  // Numerical stepping
  while (t < tEndSec - 1e-9) {
    const dt = Math.min(h, tEndSec - t);

    if (isOpenCircuit || isAllBypassed) {
      // No integration needed
      t += dt;
    } else if (L > 0 && C > 0) {
      // RK4 for 2nd-order RLC
      const [k1_i, k1_vc] = derivRlc(t, currentIl, currentVc);
      const [k2_i, k2_vc] = derivRlc(t + dt * 0.5, currentIl + k1_i * dt * 0.5, currentVc + k1_vc * dt * 0.5);
      const [k3_i, k3_vc] = derivRlc(t + dt * 0.5, currentIl + k2_i * dt * 0.5, currentVc + k2_vc * dt * 0.5);
      const [k4_i, k4_vc] = derivRlc(t + dt, currentIl + k3_i * dt, currentVc + k3_vc * dt);

      currentIl += (dt / 6) * (k1_i + 2 * k2_i + 2 * k3_i + k4_i);
      currentVc += (dt / 6) * (k1_vc + 2 * k2_vc + 2 * k3_vc + k4_vc);
      t += dt;
    } else if (L === 0 && C > 0 && R > 0) {
      // RK4 for 1st-order RC
      const k1 = derivRc(t, currentVc);
      const k2 = derivRc(t + dt * 0.5, currentVc + k1 * dt * 0.5);
      const k3 = derivRc(t + dt * 0.5, currentVc + k2 * dt * 0.5);
      const k4 = derivRc(t + dt, currentVc + k3 * dt);

      currentVc += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      currentIl = (vSourcePeak * Math.sin(omega * t + phiSRad) - currentVc) / R;
      t += dt;
    } else if (L > 0 && C === -1) {
      // RK4 for 1st-order RL
      const k1 = derivRl(t, currentIl);
      const k2 = derivRl(t + dt * 0.5, currentIl + k1 * dt * 0.5);
      const k3 = derivRl(t + dt * 0.5, currentIl + k2 * dt * 0.5);
      const k4 = derivRl(t + dt, currentIl + k3 * dt);

      currentIl += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      currentVc = 0;
      t += dt;
    } else {
      // Pure C or Pure R: algebraic
      t += dt;
      if (R > 0 && L === 0 && C === -1) {
        currentIl = (vSourcePeak * Math.sin(omega * t + phiSRad)) / R;
      }
    }

    // Capture state at current simulation timeSec
    if (stateAtSimTime === null && t >= timeSec - 1e-12) {
      stateAtSimTime = evaluateStateAt(timeSec, currentIl, currentVc);
    }

    // Record sample if within display window and time matches step
    if (t >= tStartSec && t >= nextDisplayTimeSec) {
      pushSample(t, currentIl, currentVc);
      nextDisplayTimeSec += displayStepSec;
    }
  }

  // Ensure last sample at tEndSec is pushed
  if (points.length === 0 || Math.abs(points[points.length - 1].tAbsoluteSec - tEndSec) > 1e-6) {
    pushSample(tEndSec, currentIl, currentVc);
  }

  // Compute live metrics strictly at current simulation time timeSec
  if (stateAtSimTime === null) {
    stateAtSimTime = evaluateStateAt(timeSec, currentIl, currentVc);
  }

  const metrics: RlcTransientMetrics = {
    timeSec,
    vSource: stateAtSimTime.vSource,
    current: stateAtSimTime.current,
    vResistor: stateAtSimTime.vResistor,
    vInductor: stateAtSimTime.vInductor,
    vCapacitor: stateAtSimTime.vCapacitor,
    kvlError: stateAtSimTime.kvlError,
    dampingRatio,
    dampingType,
    naturalFrequencyHz,
    statusMessage,
  };

  // Optional: Steady-state analytical reference overlay
  let steadyStateReferencePoints: RlcTransientTrajectory['steadyStateReferencePoints'];
  if (includeSteadyStateOverlay && !isOpenCircuit && !isAllBypassed) {
    const ssMetrics = computeRlcCircuitMetrics(config, topology);
    if (!ssMetrics.isUnboundedCurrent && !ssMetrics.isIndeterminate) {
      steadyStateReferencePoints = points.map((p) => {
        const theta = omega * p.tAbsoluteSec;
        const currentSs = ssMetrics.iPeak * Math.sin(theta + ssMetrics.phiIRad);
        const vCapacitorSs =
          ssMetrics.vCapacitorPeak * Math.sin(theta + ssMetrics.vCapacitorPhaseRad);
        return {
          tRelativeMs: p.tRelativeMs,
          tAbsoluteSec: p.tAbsoluteSec,
          currentSs,
          vCapacitorSs,
        };
      });
    }
  }

  return {
    points,
    steadyStateReferencePoints,
    metrics,
    windowDurationMs: visibleDurationMs,
  };
}
