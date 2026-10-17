import {
  RlcCircuitConfig,
  RlcCircuitMetrics,
  RlcSamplePoint,
  RlcBehavior,
  PowerFactorType,
  RlcTopologyConfig,
} from '../types/rlcCircuit';
import {
  Complex,
  complex,
  complexFromPolar,
  complexAdd,
  complexMultiply,
  complexDivide,
  complexMagnitude,
  complexPhaseRad,
  degToRad,
  radToDeg,
  normalizeAngleDeg,
  normalizeAngleRad,
} from './complexMath';

/**
 * Computes instantaneous source voltage v_s(t):
 * v_s(t) = √2 * V_s * sin(2πft + φ_s * π/180)
 */
export function computeSourceInstantaneousVoltage(
  vSourceRms: number,
  frequencyHz: number,
  phaseDeg: number,
  tSec: number
): number {
  const vPeak = vSourceRms * Math.SQRT2;
  const phiSRad = degToRad(phaseDeg);
  return vPeak * Math.sin(2 * Math.PI * frequencyHz * tSec + phiSRad);
}

/**
 * Computes reactances X_L and X_C in Ohms:
 * X_L = 2πfL
 * X_C = 1 / (2πfC) for C > 0
 */
export function computeSeriesReactances(
  frequencyHz: number,
  L_Henries: number,
  C_Farads: number,
  isCapacitorBypassed: boolean = false,
  isCapacitorRemoved: boolean = false
): { xL: number; xC: number; netReactance: number } {
  const omega = 2 * Math.PI * frequencyHz;
  const xL = omega * L_Henries;

  let xC: number;
  if (isCapacitorBypassed) {
    xC = 0;
  } else if (isCapacitorRemoved) {
    xC = Infinity;
  } else if (C_Farads > 0) {
    xC = 1 / (omega * C_Farads);
  } else {
    // C === 0 F:
    // When L === 0, the circuit is purely resistive (no capacitor present, X_C = 0)
    // When L > 0, an enabled 0 F capacitor forms an open circuit in series (X_C -> ∞)
    xC = L_Henries > 0 ? Infinity : 0;
  }

  const netReactance = isFinite(xC) ? xL - xC : -Infinity;
  return { xL, xC, netReactance };
}

/**
 * Computes total complex series impedance:
 * Z = R + j(X_L - X_C)
 * |Z| = sqrt(R^2 + (X_L - X_C)^2)
 * θ_Z = atan2(X_L - X_C, R)
 */
export function computeSeriesImpedance(
  R: number,
  netReactance: number
): {
  zComplex: Complex;
  zMagnitude: number;
  zThetaRad: number;
  zThetaDeg: number;
} {
  if (!isFinite(netReactance)) {
    return {
      zComplex: complex(R, -Infinity),
      zMagnitude: Infinity,
      zThetaRad: -Math.PI / 2,
      zThetaDeg: -90,
    };
  }

  const zComplex = complex(R, netReactance);
  const zMagnitude = complexMagnitude(zComplex);
  const zThetaRad = complexPhaseRad(zComplex);
  const zThetaDeg = normalizeAngleDeg(radToDeg(zThetaRad));

  return {
    zComplex,
    zMagnitude,
    zThetaRad,
    zThetaDeg,
  };
}

/**
 * Computes current phasor by complex division:
 * I_phasor = V_s_phasor / Z
 * I_RMS = V_s / |Z|
 * φ_I = φ_s - θ_Z
 */
export function computeCurrentPhasor(
  vSourceRms: number,
  vSourcePhaseRad: number,
  zComplex: Complex,
  zMagnitude: number,
  zThetaRad: number
): {
  iPhasor: Complex;
  iRms: number;
  iPeak: number;
  phiIRad: number;
  phiIDeg: number;
} {
  if (!isFinite(zMagnitude) || zMagnitude === Infinity) {
    return {
      iPhasor: complex(0, 0),
      iRms: 0,
      iPeak: 0,
      phiIRad: 0,
      phiIDeg: 0,
    };
  }

  if (zMagnitude === 0) {
    return {
      iPhasor: complex(0, 0),
      iRms: 0,
      iPeak: 0,
      phiIRad: 0,
      phiIDeg: 0,
    };
  }

  const vPhasor = complexFromPolar(vSourceRms, vSourcePhaseRad);
  const iPhasor = complexDivide(vPhasor, zComplex);

  const iRms = vSourceRms / zMagnitude;
  const iPeak = iRms * Math.SQRT2;
  const rawPhiRad = vSourcePhaseRad - zThetaRad;
  const phiIRad = normalizeAngleRad(rawPhiRad);
  const phiIDeg = normalizeAngleDeg(radToDeg(phiIRad));

  return {
    iPhasor,
    iRms,
    iPeak,
    phiIRad,
    phiIDeg,
  };
}

/**
 * Computes component voltage phasors from current phasor:
 * V_R = I * R
 * V_L = I * (j*X_L)
 * V_C = I * (-j*X_C)
 */
export function computeComponentVoltagePhasors(
  iPhasor: Complex,
  iRms: number,
  phiIRad: number,
  R: number,
  xL: number,
  xC: number,
  vSourceRms: number,
  vSourcePhaseRad: number,
  isOpenCircuit: boolean,
  isCapacitorBypassed: boolean
): {
  vR_Phasor: Complex;
  vL_Phasor: Complex;
  vC_Phasor: Complex;
  vResistorRms: number;
  vResistorPeak: number;
  vResistorPhaseRad: number;
  vResistorPhaseDeg: number;
  vInductorRms: number;
  vInductorPeak: number;
  vInductorPhaseRad: number;
  vInductorPhaseDeg: number;
  vCapacitorRms: number;
  vCapacitorPeak: number;
  vCapacitorPhaseRad: number;
  vCapacitorPhaseDeg: number;
  scalarSumVoltageRms: number;
  phasorSumError: number;
} {
  if (isOpenCircuit) {
    // Open circuit in series: entire source voltage appears across open capacitor
    const vC_Phasor = complexFromPolar(vSourceRms, vSourcePhaseRad);
    return {
      vR_Phasor: complex(0, 0),
      vL_Phasor: complex(0, 0),
      vC_Phasor,
      vResistorRms: 0,
      vResistorPeak: 0,
      vResistorPhaseRad: 0,
      vResistorPhaseDeg: 0,
      vInductorRms: 0,
      vInductorPeak: 0,
      vInductorPhaseRad: 0,
      vInductorPhaseDeg: 0,
      vCapacitorRms: vSourceRms,
      vCapacitorPeak: vSourceRms * Math.SQRT2,
      vCapacitorPhaseRad: vSourcePhaseRad,
      vCapacitorPhaseDeg: normalizeAngleDeg(radToDeg(vSourcePhaseRad)),
      scalarSumVoltageRms: vSourceRms,
      phasorSumError: 0,
    };
  }

  // Resistor Voltage: V_R = I * R (in phase with current)
  const vR_Phasor = complexMultiply(iPhasor, complex(R, 0));
  const vResistorRms = iRms * R;
  const vResistorPeak = vResistorRms * Math.SQRT2;
  const vResistorPhaseRad = R > 0 ? phiIRad : 0;
  const vResistorPhaseDeg = R > 0 ? normalizeAngleDeg(radToDeg(vResistorPhaseRad)) : 0;

  // Inductor Voltage: V_L = I * (j * X_L) (leads current by 90°)
  const vL_Phasor = complexMultiply(iPhasor, complex(0, xL));
  const vInductorRms = iRms * xL;
  const vInductorPeak = vInductorRms * Math.SQRT2;
  const vInductorPhaseRad = xL > 0 ? normalizeAngleRad(phiIRad + Math.PI / 2) : 0;
  const vInductorPhaseDeg = xL > 0 ? normalizeAngleDeg(radToDeg(vInductorPhaseRad)) : 0;

  // Capacitor Voltage: V_C = I * (-j * X_C) (lags current by 90°)
  let vC_Phasor: Complex;
  let vCapacitorRms: number;
  let vCapacitorPhaseRad: number;
  let vCapacitorPhaseDeg: number;

  if (isCapacitorBypassed || xC === 0) {
    vC_Phasor = complex(0, 0);
    vCapacitorRms = 0;
    vCapacitorPhaseRad = 0;
    vCapacitorPhaseDeg = 0;
  } else {
    vC_Phasor = complexMultiply(iPhasor, complex(0, -xC));
    vCapacitorRms = iRms * xC;
    vCapacitorPhaseRad = normalizeAngleRad(phiIRad - Math.PI / 2);
    vCapacitorPhaseDeg = normalizeAngleDeg(radToDeg(vCapacitorPhaseRad));
  }
  const vCapacitorPeak = vCapacitorRms * Math.SQRT2;

  const scalarSumVoltageRms = vResistorRms + vInductorRms + vCapacitorRms;

  // Phasor Sum Verification: V_sum = V_R + V_L + V_C
  const vSumPhasor = complexAdd(complexAdd(vR_Phasor, vL_Phasor), vC_Phasor);
  const vSourcePhasor = complexFromPolar(vSourceRms, vSourcePhaseRad);
  const diffPhasor = {
    re: vSourcePhasor.re - vSumPhasor.re,
    im: vSourcePhasor.im - vSumPhasor.im,
  };
  const phasorSumError = complexMagnitude(diffPhasor);

  return {
    vR_Phasor,
    vL_Phasor,
    vC_Phasor,
    vResistorRms,
    vResistorPeak,
    vResistorPhaseRad,
    vResistorPhaseDeg,
    vInductorRms,
    vInductorPeak,
    vInductorPhaseRad,
    vInductorPhaseDeg,
    vCapacitorRms,
    vCapacitorPeak,
    vCapacitorPhaseRad,
    vCapacitorPhaseDeg,
    scalarSumVoltageRms,
    phasorSumError,
  };
}

/**
 * Computes powers (P, Q, S) and power factor:
 * P = I_RMS^2 * R
 * S = V_RMS * I_RMS
 * Q = I_RMS^2 * (X_L - X_C)
 * PF = P / S = cos(θ_Z)
 */
export function computePowerMetrics(
  vSourceRms: number,
  iRms: number,
  R: number,
  netReactance: number,
  zThetaRad: number,
  isOpenCircuit: boolean
): {
  realPowerW: number;
  reactivePowerVar: number;
  apparentPowerVa: number;
  powerFactor: number;
  powerFactorType: PowerFactorType;
  pfDisplay: string;
} {
  if (isOpenCircuit || iRms === 0) {
    return {
      realPowerW: 0,
      reactivePowerVar: 0,
      apparentPowerVa: 0,
      powerFactor: NaN,
      powerFactorType: 'undefined',
      pfDisplay: 'N/A',
    };
  }

  const realPowerW = iRms * iRms * R;
  const apparentPowerVa = vSourceRms * iRms;
  const reactivePowerVar = isFinite(netReactance) ? iRms * iRms * netReactance : 0;

  if (apparentPowerVa === 0) {
    return {
      realPowerW: 0,
      reactivePowerVar: 0,
      apparentPowerVa: 0,
      powerFactor: NaN,
      powerFactorType: 'undefined',
      pfDisplay: 'N/A',
    };
  }

  let powerFactor: number;
  let powerFactorType: PowerFactorType;

  if (R === 0) {
    powerFactor = 0.0;
    powerFactorType = netReactance >= 0 ? 'lagging' : 'leading';
  } else if (Math.abs(netReactance) < 1e-4) {
    powerFactor = 1.0;
    powerFactorType = 'unity';
  } else if (netReactance > 0) {
    powerFactor = Math.max(0, Math.min(1, Math.cos(zThetaRad)));
    powerFactorType = 'lagging';
  } else {
    powerFactor = Math.max(0, Math.min(1, Math.cos(zThetaRad)));
    powerFactorType = 'leading';
  }

  const pfDisplay =
    powerFactorType === 'unity'
      ? '1.000 (unity)'
      : `${powerFactor.toFixed(3)} (${powerFactorType})`;

  return {
    realPowerW,
    reactivePowerVar,
    apparentPowerVa,
    powerFactor,
    powerFactorType,
    pfDisplay,
  };
}

/**
 * Solves the steady-state AC series RLC circuit analytically,
 * with full SI compliance, explicit RMS phasor division, and exact handling
 * of pure resistance, ideal resonance, zero-impedance shorts, and open circuits.
 */
export function computeRlcCircuitMetrics(
  config: RlcCircuitConfig,
  topology?: RlcTopologyConfig
): RlcCircuitMetrics {
  const isResistorBypassed = topology?.resistor === 'bypassed';
  const isInductorBypassed = topology?.inductor === 'bypassed';
  const isCapacitorRemoved = topology?.capacitor === 'removed';
  const isCapacitorBypassed =
    topology?.capacitor === 'bypassed' || (topology?.capacitor as string) === 'disabled';

  const vSourceRms = Math.max(0, config.vSourceRms);
  const vSourcePhaseDeg = normalizeAngleDeg(config.vSourcePhaseDeg ?? 0);
  const vSourcePhaseRad = degToRad(vSourcePhaseDeg);
  const f = Math.max(0.01, config.frequency);
  const omega = 2 * Math.PI * f;
  const vSourcePeak = vSourceRms * Math.SQRT2;

  const R = isResistorBypassed ? 0 : Math.max(0, config.resistance);
  const L = isInductorBypassed ? 0 : Math.max(0, config.inductanceMh * 1e-3);
  const C = isCapacitorBypassed
    ? -1 // Bypassed as wire
    : isCapacitorRemoved
    ? 0 // Removed as open circuit
    : Math.max(0, config.capacitanceUf * 1e-6);

  // Resonance applicability: requires positive L > 0 and active finite C > 0
  const isResonanceApplicable = L > 0 && C > 0;
  const resonantFrequencyHz = isResonanceApplicable
    ? 1 / (2 * Math.PI * Math.sqrt(L * C))
    : null;
  const f0Display =
    isResonanceApplicable && resonantFrequencyHz !== null
      ? `${resonantFrequencyHz.toFixed(1)} Hz`
      : 'N/A';

  // Reactances
  const { xL, xC, netReactance } = computeSeriesReactances(
    f,
    L,
    C === -1 ? 0 : C,
    isCapacitorBypassed,
    isCapacitorRemoved
  );

  // --- CASE 1: Open Circuit (Capacitor Removed OR C === 0 with L > 0) ---
  const isOpenCircuit = isCapacitorRemoved || (C === 0 && L > 0);
  if (isOpenCircuit) {
    const statusMsg = isCapacitorRemoved
      ? 'Open circuit (Capacitor removed): steady-state current is zero.'
      : 'Open circuit (C = 0 µF): steady-state current is zero.';
    const titleMsg = isCapacitorRemoved
      ? 'Open Circuit (Capacitor Removed)'
      : 'Open Circuit (C = 0 µF)';
    const explMsg = isCapacitorRemoved
      ? 'Removing the capacitor breaks the series loop. With no conductive path, steady-state current is exactly zero (I = 0 A). The entire source voltage appears across the open capacitor terminals (V_C = V_s).'
      : 'Zero capacitance represents an open circuit in sinusoidal steady state. With no continuous conductive path through the capacitor, steady-state current is exactly zero (I = 0 A). The entire source voltage appears across the open capacitor terminals (V_C = V_s).';

    return {
      omega,
      xL,
      xC: Infinity,
      netReactance: -Infinity,
      zMagnitude: Infinity,
      zThetaRad: -Math.PI / 2,
      zThetaDeg: -90,
      iRms: 0,
      iPeak: 0,
      phiIRad: 0,
      phiIDeg: 0,
      vSourceRms,
      vSourcePeak,
      vSourcePhaseRad,
      vSourcePhaseDeg,
      vResistorRms: 0,
      vResistorPeak: 0,
      vResistorPhaseRad: 0,
      vResistorPhaseDeg: 0,
      vInductorRms: 0,
      vInductorPeak: 0,
      vInductorPhaseRad: 0,
      vInductorPhaseDeg: 0,
      vCapacitorRms: vSourceRms,
      vCapacitorPeak: vSourcePeak,
      vCapacitorPhaseRad: vSourcePhaseRad,
      vCapacitorPhaseDeg: vSourcePhaseDeg,
      scalarSumVoltageRms: vSourceRms,
      phasorSumError: 0,
      powerFactor: NaN,
      powerFactorType: 'undefined',
      realPowerW: 0,
      reactivePowerVar: 0,
      apparentPowerVa: 0,
      resonantFrequencyHz: null,
      isResonant: false,
      isResonanceApplicable: false,
      isOpenCircuit: true,
      isUnboundedCurrent: false,
      isIndeterminate: false,
      zDisplay: '∞ (Open Circuit)',
      iDisplay: '0.000 A (Open Circuit)',
      pfDisplay: 'N/A',
      thetaZDisplay: 'N/A',
      phiIDisplay: 'N/A',
      f0Display: 'N/A',
      statusMessage: statusMsg,
      behavior: 'open_circuit',
      behaviorTitle: titleMsg,
      behaviorExplanation: explMsg,
    };
  }

  // --- CASE 2: All Components Zero or Bypassed (R = 0, L = 0, C <= 0) ---
  if (R === 0 && L === 0 && (C === 0 || C === -1)) {
    if (vSourceRms > 0) {
      return {
        omega,
        xL: 0,
        xC: 0,
        netReactance: 0,
        zMagnitude: 0,
        zThetaRad: 0,
        zThetaDeg: 0,
        iRms: 0,
        iPeak: 0,
        phiIRad: 0,
        phiIDeg: 0,
        vSourceRms,
        vSourcePeak,
        vSourcePhaseRad,
        vSourcePhaseDeg,
        vResistorRms: 0,
        vResistorPeak: 0,
        vResistorPhaseRad: 0,
        vResistorPhaseDeg: 0,
        vInductorRms: 0,
        vInductorPeak: 0,
        vInductorPhaseRad: 0,
        vInductorPhaseDeg: 0,
        vCapacitorRms: 0,
        vCapacitorPeak: 0,
        vCapacitorPhaseRad: 0,
        vCapacitorPhaseDeg: 0,
        scalarSumVoltageRms: 0,
        phasorSumError: 0,
        powerFactor: NaN,
        powerFactorType: 'undefined',
        realPowerW: 0,
        reactivePowerVar: 0,
        apparentPowerVa: 0,
        resonantFrequencyHz: null,
        isResonant: false,
        isResonanceApplicable: false,
        isOpenCircuit: false,
        isUnboundedCurrent: true,
        isIndeterminate: false,
        zDisplay: '0.0 Ω (Ideal Short)',
        iDisplay: 'Unbounded',
        pfDisplay: 'N/A',
        thetaZDisplay: 'N/A',
        phiIDisplay: 'N/A',
        f0Display: 'N/A',
        statusMessage: 'Ideal zero-impedance short circuit: theoretical current is unbounded.',
        behavior: 'unbounded',
        behaviorTitle: 'Zero-Impedance Source Loop (R = L = C = 0)',
        behaviorExplanation:
          'The ideal circuit consists of a nonzero AC voltage source connected across a zero-impedance loop (|Z| = 0 Ω). In the ideal circuit model, theoretical current is unbounded. In physical circuits, non-zero source impedance and conductor resistance limit the short-circuit current.',
      };
    } else {
      return {
        omega,
        xL: 0,
        xC: 0,
        netReactance: 0,
        zMagnitude: 0,
        zThetaRad: 0,
        zThetaDeg: 0,
        iRms: 0,
        iPeak: 0,
        phiIRad: 0,
        phiIDeg: 0,
        vSourceRms: 0,
        vSourcePeak: 0,
        vSourcePhaseRad,
        vSourcePhaseDeg,
        vResistorRms: 0,
        vResistorPeak: 0,
        vResistorPhaseRad: 0,
        vResistorPhaseDeg: 0,
        vInductorRms: 0,
        vInductorPeak: 0,
        vInductorPhaseRad: 0,
        vInductorPhaseDeg: 0,
        vCapacitorRms: 0,
        vCapacitorPeak: 0,
        vCapacitorPhaseRad: 0,
        vCapacitorPhaseDeg: 0,
        scalarSumVoltageRms: 0,
        phasorSumError: 0,
        powerFactor: NaN,
        powerFactorType: 'undefined',
        realPowerW: 0,
        reactivePowerVar: 0,
        apparentPowerVa: 0,
        resonantFrequencyHz: null,
        isResonant: false,
        isResonanceApplicable: false,
        isOpenCircuit: false,
        isUnboundedCurrent: false,
        isIndeterminate: true,
        zDisplay: '0.0 Ω',
        iDisplay: 'Indeterminate (0 V / 0 Ω)',
        pfDisplay: 'N/A',
        thetaZDisplay: 'N/A',
        phiIDisplay: 'N/A',
        f0Display: 'N/A',
        statusMessage: 'Indeterminate ideal circuit (0 V source with 0 Ω impedance).',
        behavior: 'indeterminate',
        behaviorTitle: 'Indeterminate Ideal Circuit (0 V / 0 Ω)',
        behaviorExplanation:
          'A 0 V source is connected across 0 Ω impedance. In ideal network theory, the resulting current is indeterminate without external boundary constraints.',
      };
    }
  }

  // --- CASE 3: Ideal Zero-Impedance Resonance (R = 0, X_L = X_C > 0) ---
  if (R === 0 && Math.abs(netReactance) < 1e-4) {
    if (vSourceRms > 0) {
      return {
        omega,
        xL,
        xC,
        netReactance: 0,
        zMagnitude: 0,
        zThetaRad: 0,
        zThetaDeg: 0,
        iRms: 0,
        iPeak: 0,
        phiIRad: 0,
        phiIDeg: 0,
        vSourceRms,
        vSourcePeak,
        vSourcePhaseRad,
        vSourcePhaseDeg,
        vResistorRms: 0,
        vResistorPeak: 0,
        vResistorPhaseRad: 0,
        vResistorPhaseDeg: 0,
        vInductorRms: 0,
        vInductorPeak: 0,
        vInductorPhaseRad: 0,
        vInductorPhaseDeg: 0,
        vCapacitorRms: 0,
        vCapacitorPeak: 0,
        vCapacitorPhaseRad: 0,
        vCapacitorPhaseDeg: 0,
        scalarSumVoltageRms: 0,
        phasorSumError: 0,
        powerFactor: 1.0,
        powerFactorType: 'unity',
        realPowerW: 0,
        reactivePowerVar: 0,
        apparentPowerVa: 0,
        resonantFrequencyHz,
        isResonant: true,
        isResonanceApplicable: true,
        isOpenCircuit: false,
        isUnboundedCurrent: true,
        isIndeterminate: false,
        zDisplay: '0.0 Ω (Ideal Resonance)',
        iDisplay: 'Unbounded',
        pfDisplay: '1.000 (unity)',
        thetaZDisplay: '0.0°',
        phiIDisplay: `${vSourcePhaseDeg.toFixed(1)}°`,
        f0Display,
        statusMessage: 'Ideal zero-impedance resonance: theoretical current is unbounded.',
        behavior: 'resonance',
        behaviorTitle: 'Ideal Zero-Impedance Resonance (X_L = X_C, R = 0 Ω)',
        behaviorExplanation:
          'Ideal zero-impedance resonance: theoretical current is unbounded. In an ideal lossless circuit with zero resistance, inductive reactance X_L cancels capacitive reactance X_C exactly, leaving zero total series impedance (|Z| = 0 Ω).',
      };
    } else {
      return {
        omega,
        xL,
        xC,
        netReactance: 0,
        zMagnitude: 0,
        zThetaRad: 0,
        zThetaDeg: 0,
        iRms: 0,
        iPeak: 0,
        phiIRad: 0,
        phiIDeg: 0,
        vSourceRms: 0,
        vSourcePeak: 0,
        vSourcePhaseRad,
        vSourcePhaseDeg,
        vResistorRms: 0,
        vResistorPeak: 0,
        vResistorPhaseRad: 0,
        vResistorPhaseDeg: 0,
        vInductorRms: 0,
        vInductorPeak: 0,
        vInductorPhaseRad: 0,
        vInductorPhaseDeg: 0,
        vCapacitorRms: 0,
        vCapacitorPeak: 0,
        vCapacitorPhaseRad: 0,
        vCapacitorPhaseDeg: 0,
        scalarSumVoltageRms: 0,
        phasorSumError: 0,
        powerFactor: 1.0,
        powerFactorType: 'unity',
        realPowerW: 0,
        reactivePowerVar: 0,
        apparentPowerVa: 0,
        resonantFrequencyHz,
        isResonant: true,
        isResonanceApplicable: true,
        isOpenCircuit: false,
        isUnboundedCurrent: false,
        isIndeterminate: true,
        zDisplay: '0.0 Ω',
        iDisplay: '0.000 A',
        pfDisplay: '1.000 (unity)',
        thetaZDisplay: '0.0°',
        phiIDisplay: `${vSourcePhaseDeg.toFixed(1)}°`,
        f0Display,
        statusMessage: 'Indeterminate ideal circuit (0 V source with 0 Ω impedance at resonance).',
        behavior: 'indeterminate',
        behaviorTitle: 'Indeterminate Circuit (0 V / 0 Ω at Resonance)',
        behaviorExplanation:
          'At resonance with zero resistance, total impedance is 0 Ω and source voltage is 0 V, resulting in an indeterminate ideal operating point.',
      };
    }
  }

  // --- GENERAL CASE: Closed Series Circuit (Pure R, Pure L, Pure C, RL, RC, RLC) ---
  const { zComplex, zMagnitude, zThetaRad, zThetaDeg } = computeSeriesImpedance(R, netReactance);

  // Current phasor calculation
  const { iPhasor, iRms, iPeak, phiIRad, phiIDeg } = computeCurrentPhasor(
    vSourceRms,
    vSourcePhaseRad,
    zComplex,
    zMagnitude,
    zThetaRad
  );

  // Component voltage phasors calculation
  const {
    vResistorRms,
    vResistorPeak,
    vResistorPhaseRad,
    vResistorPhaseDeg,
    vInductorRms,
    vInductorPeak,
    vInductorPhaseRad,
    vInductorPhaseDeg,
    vCapacitorRms,
    vCapacitorPeak,
    vCapacitorPhaseRad,
    vCapacitorPhaseDeg,
    scalarSumVoltageRms,
    phasorSumError,
  } = computeComponentVoltagePhasors(
    iPhasor,
    iRms,
    phiIRad,
    R,
    xL,
    xC,
    vSourceRms,
    vSourcePhaseRad,
    false,
    isCapacitorBypassed || (C === 0 && L === 0)
  );

  // Power metrics calculation
  const { realPowerW, reactivePowerVar, apparentPowerVa, powerFactor, powerFactorType, pfDisplay } =
    computePowerMetrics(vSourceRms, iRms, R, netReactance, zThetaRad, false);

  // Resonance detection
  const reactanceDiffPu = Math.abs(xL - xC) / Math.max(xL, xC, 1);
  const isResonant =
    isResonanceApplicable && (reactanceDiffPu < 0.005 || Math.abs(xL - xC) < 0.05);

  let behavior: RlcBehavior;
  let behaviorTitle: string;
  let behaviorExplanation: string;

  if (L === 0 && (C <= 0 || isCapacitorBypassed)) {
    // Purely Resistive
    behavior = 'resonance';
    behaviorTitle = 'Purely Resistive Circuit';
    behaviorExplanation =
      'With no reactive components in the circuit, current is strictly determined by Ohm\'s law (I = V_s / R) and is in phase with the source voltage (PF = 1.000).';
  } else if (R === 0 && xL > 0 && xC === 0) {
    // Pure Inductance
    behavior = 'inductive';
    behaviorTitle = 'Purely Inductive Circuit (R = 0 Ω, C = 0)';
    behaviorExplanation =
      'The circuit contains only an ideal inductor. Current lags the source voltage by exactly 90.0° (PF = 0.000 lagging). No active power is dissipated.';
  } else if (R === 0 && xL === 0 && xC > 0) {
    // Pure Capacitance
    behavior = 'capacitive';
    behaviorTitle = 'Purely Capacitive Circuit (R = 0 Ω, L = 0)';
    behaviorExplanation =
      'The circuit contains only an ideal capacitor. Current leads the source voltage by exactly 90.0° (PF = 0.000 leading). No active power is dissipated.';
  } else if (isResonant) {
    behavior = 'resonance';
    behaviorTitle = 'Series Resonance (X_L ≈ X_C)';
    behaviorExplanation = `At resonance (${f.toFixed(2)} Hz ≈ f₀ = ${resonantFrequencyHz?.toFixed(2)} Hz), inductive reactance X_L (${xL.toFixed(1)} Ω) cancels capacitive reactance X_C (${xC.toFixed(1)} Ω). The total impedance is purely resistive (|Z| = R = ${R.toFixed(1)} Ω), circuit current reaches its maximum value (${iRms.toFixed(3)} A RMS), and current is in phase with the AC source voltage (PF = 1.000).`;
  } else if (xL > xC) {
    behavior = 'inductive';
    behaviorTitle =
      xC === 0 ? 'Series RL Circuit' : 'Inductive Circuit (X_L > X_C)';
    behaviorExplanation =
      xC === 0
        ? `With no capacitance in the loop, the circuit operates as a series RL circuit. Inductive reactance causes current to lag source voltage by ${Math.abs(zThetaDeg).toFixed(1)}°.`
        : `Inductive reactance X_L (${xL.toFixed(1)} Ω) dominates capacitive reactance X_C (${xC.toFixed(1)} Ω). Consequently, circuit current lags the AC source voltage by ${Math.abs(zThetaDeg).toFixed(1)}° (lagging power factor = ${powerFactor.toFixed(3)}).`;
  } else {
    behavior = 'capacitive';
    behaviorTitle =
      xL === 0 ? 'Series RC Circuit (L = 0)' : 'Capacitive Circuit (X_C > X_L)';
    behaviorExplanation =
      xL === 0
        ? `With no inductance in the loop, the circuit operates as a series RC circuit. Capacitive reactance causes current to lead source voltage by ${Math.abs(zThetaDeg).toFixed(1)}°.`
        : `Capacitive reactance X_C (${xC.toFixed(1)} Ω) dominates inductive reactance X_L (${xL.toFixed(1)} Ω). Consequently, circuit current leads the AC source voltage by ${Math.abs(zThetaDeg).toFixed(1)}° (leading power factor = ${powerFactor.toFixed(3)}).`;
  }

  return {
    omega,
    xL,
    xC,
    netReactance,
    zMagnitude,
    zThetaRad,
    zThetaDeg,
    iRms,
    iPeak,
    phiIRad,
    phiIDeg,
    vSourceRms,
    vSourcePeak,
    vSourcePhaseRad,
    vSourcePhaseDeg,
    vResistorRms,
    vResistorPeak,
    vResistorPhaseRad,
    vResistorPhaseDeg,
    vInductorRms,
    vInductorPeak,
    vInductorPhaseRad,
    vInductorPhaseDeg,
    vCapacitorRms,
    vCapacitorPeak,
    vCapacitorPhaseRad,
    vCapacitorPhaseDeg,
    scalarSumVoltageRms,
    phasorSumError,
    powerFactor,
    powerFactorType,
    realPowerW,
    reactivePowerVar,
    apparentPowerVa,
    resonantFrequencyHz,
    isResonant,
    isResonanceApplicable,
    isOpenCircuit: false,
    isUnboundedCurrent: false,
    isIndeterminate: false,
    zDisplay: `${zMagnitude.toFixed(1)} Ω`,
    iDisplay: `${iRms.toFixed(3)} A`,
    pfDisplay,
    thetaZDisplay: `${zThetaDeg >= 0 ? '+' : ''}${zThetaDeg.toFixed(1)}°`,
    phiIDisplay: `${phiIDeg >= 0 ? '+' : ''}${phiIDeg.toFixed(1)}°`,
    f0Display,
    behavior,
    behaviorTitle,
    behaviorExplanation,
  };
}

/**
 * Generates continuous time-domain waveform points for the RLC circuit.
 * Uses exact phasor magnitudes and phase angles:
 * v_s(t) = √2 * V_s * sin(2πft + φ_s)
 * i(t)   = √2 * I_RMS * sin(2πft + φ_I)
 * v_R(t) = √2 * V_R * sin(2πft + φ_V_R)
 * v_L(t) = √2 * V_L * sin(2πft + φ_V_L)
 * v_C(t) = √2 * V_C * sin(2πft + φ_V_C)
 */
export function generateRlcWaveformPoints(
  config: RlcCircuitConfig,
  currentTimeSec: number = 0,
  cyclesShown: number = 3,
  numPoints: number = 600,
  topology?: RlcTopologyConfig
): {
  points: RlcSamplePoint[];
  windowDurationMs: number;
  periodMs: number;
} {
  const metrics = computeRlcCircuitMetrics(config, topology);
  const f = Math.max(0.01, config.frequency);
  const periodSec = 1 / f;
  const windowDurationSec = cyclesShown * periodSec;
  const windowDurationMs = windowDurationSec * 1000;
  const periodMs = periodSec * 1000;

  const points: RlcSamplePoint[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints;
    const tRelativeSec = fraction * windowDurationSec;
    const tRelativeMs = tRelativeSec * 1000;
    const tSimSec = currentTimeSec + tRelativeSec;
    const omegaT = 2 * Math.PI * f * tSimSec;

    // v_s(t) = √2 * V_s * sin(ωt + φ_s)
    const vSource = metrics.vSourcePeak * Math.sin(omegaT + metrics.vSourcePhaseRad);

    if (metrics.isOpenCircuit) {
      // In an open circuit: i(t) = 0, v_R(t) = 0, v_L(t) = 0, v_C(t) = v_s(t)
      points.push({
        tRelativeMs,
        tAbsoluteSec: tSimSec,
        vSource,
        current: 0,
        vResistor: 0,
        vInductor: 0,
        vCapacitor: vSource,
      });
    } else if (metrics.isUnboundedCurrent) {
      // Unbounded current: render finite source voltage with zero placeholders for unbounded variables
      points.push({
        tRelativeMs,
        tAbsoluteSec: tSimSec,
        vSource,
        current: 0,
        vResistor: 0,
        vInductor: 0,
        vCapacitor: 0,
      });
    } else {
      // Closed series circuit: exact instantaneous waveforms
      const current = metrics.iPeak * Math.sin(omegaT + metrics.phiIRad);
      const vResistor = metrics.vResistorPeak * Math.sin(omegaT + metrics.vResistorPhaseRad);
      const vInductor = metrics.vInductorPeak * Math.sin(omegaT + metrics.vInductorPhaseRad);
      const vCapacitor = metrics.vCapacitorPeak * Math.sin(omegaT + metrics.vCapacitorPhaseRad);

      points.push({
        tRelativeMs,
        tAbsoluteSec: tSimSec,
        vSource,
        current,
        vResistor,
        vInductor,
        vCapacitor,
      });
    }
  }

  return {
    points,
    windowDurationMs,
    periodMs,
  };
}
