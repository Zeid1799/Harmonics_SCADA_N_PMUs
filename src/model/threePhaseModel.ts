import {
  ThreePhaseState,
  ThreePhaseMetrics,
  ThreePhaseSamplePoint,
  SinglePhaseConfig,
  DEFAULT_THREE_PHASE_STATE,
  ThreePhasePreset,
} from '../types/threePhase';

/**
 * Evaluates the instantaneous voltage of a single phase at continuous simulation time t.
 */
export function evaluatePhaseVoltage(config: SinglePhaseConfig, t: number): number {
  if (!config.enabled) return 0;
  const phaseRad = (config.phaseDeg * Math.PI) / 180;
  return config.amplitude * Math.sin(2 * Math.PI * config.frequency * t + phaseRad);
}

/**
 * Evaluates the instantaneous current of a single phase under a resistive load at time t.
 * i(t) = v(t) / R
 */
export function evaluatePhaseCurrent(config: SinglePhaseConfig, t: number): number {
  if (!config.enabled) return 0;
  const v = evaluatePhaseVoltage(config, t);
  const r = Math.max(0.001, config.resistance);
  return v / r;
}

/**
 * Generates sample points for instantaneous three-phase voltages, currents, and neutral current.
 *
 * Convention:
 * - Four-wire system with neutral conductor returning from load neutral to source neutral.
 * - Kirchhoff's Current Law at load neutral: iA(t) + iB(t) + iC(t) + iN(t) = 0
 *   => iN(t) = -[iA(t) + iB(t) + iC(t)]
 * - Instantaneous voltage sum: vSum(t) = vA(t) + vB(t) + vC(t)
 */
export function generateThreePhasePoints(
  state: ThreePhaseState,
  currentTimeSec: number = 0,
  cyclesShown: number = 3,
  numPoints: number = 600
): {
  points: ThreePhaseSamplePoint[];
  windowDurationMs: number;
  fundamentalPeriodMs: number;
} {
  const refFreq = Math.max(1, state.phaseA.frequency);
  const fundamentalPeriodSec = 1 / refFreq;
  const windowDurationSec = cyclesShown * fundamentalPeriodSec;
  const windowDurationMs = windowDurationSec * 1000;

  const points: ThreePhaseSamplePoint[] = new Array(numPoints);

  for (let i = 0; i < numPoints; i++) {
    const fraction = i / (numPoints - 1);
    const relSec = fraction * windowDurationSec;
    const absSec = currentTimeSec + relSec;

    const vA = evaluatePhaseVoltage(state.phaseA, absSec);
    const vB = evaluatePhaseVoltage(state.phaseB, absSec);
    const vC = evaluatePhaseVoltage(state.phaseC, absSec);
    const vSum = vA + vB + vC;

    const iA = evaluatePhaseCurrent(state.phaseA, absSec);
    const iB = evaluatePhaseCurrent(state.phaseB, absSec);
    const iC = evaluatePhaseCurrent(state.phaseC, absSec);
    const iN = -(iA + iB + iC);

    points[i] = {
      tRelativeMs: relSec * 1000,
      tAbsoluteSec: absSec,
      vA,
      vB,
      vC,
      vSum,
      iA,
      iB,
      iC,
      iN,
    };
  }

  return {
    points,
    windowDurationMs,
    fundamentalPeriodMs: fundamentalPeriodSec * 1000,
  };
}

/**
 * Computes electrical metrics (RMS voltages, RMS currents, neutral current RMS, voltage sum)
 * and determines balance status with physical educational feedback.
 */
export function computeThreePhaseMetrics(state: ThreePhaseState): ThreePhaseMetrics {
  const pA = state.phaseA;
  const pB = state.phaseB;
  const pC = state.phaseC;

  // 1. RMS calculations over an integrated window of fundamental periods
  const refFreq = Math.max(1, pA.frequency);
  const integrationPeriod = 1 / refFreq;
  const numSteps = 400;

  let sumSqVA = 0;
  let sumSqVB = 0;
  let sumSqVC = 0;
  let sumSqVSum = 0;
  let maxVSum = 0;

  let sumSqIA = 0;
  let sumSqIB = 0;
  let sumSqIC = 0;
  let sumSqIN = 0;
  let maxIN = 0;

  for (let i = 0; i < numSteps; i++) {
    const t = (i / numSteps) * integrationPeriod;
    const vA = evaluatePhaseVoltage(pA, t);
    const vB = evaluatePhaseVoltage(pB, t);
    const vC = evaluatePhaseVoltage(pC, t);
    const vSum = vA + vB + vC;

    const iA = evaluatePhaseCurrent(pA, t);
    const iB = evaluatePhaseCurrent(pB, t);
    const iC = evaluatePhaseCurrent(pC, t);
    const iN = -(iA + iB + iC);

    sumSqVA += vA * vA;
    sumSqVB += vB * vB;
    sumSqVC += vC * vC;
    sumSqVSum += vSum * vSum;
    if (Math.abs(vSum) > maxVSum) maxVSum = Math.abs(vSum);

    sumSqIA += iA * iA;
    sumSqIB += iB * iB;
    sumSqIC += iC * iC;
    sumSqIN += iN * iN;
    if (Math.abs(iN) > maxIN) maxIN = Math.abs(iN);
  }

  const vA_Rms = Math.sqrt(sumSqVA / numSteps);
  const vB_Rms = Math.sqrt(sumSqVB / numSteps);
  const vC_Rms = Math.sqrt(sumSqVC / numSteps);
  const vSumRms = Math.sqrt(sumSqVSum / numSteps);

  const iA_Rms = Math.sqrt(sumSqIA / numSteps);
  const iB_Rms = Math.sqrt(sumSqIB / numSteps);
  const iC_Rms = Math.sqrt(sumSqIC / numSteps);
  const iN_Rms = Math.sqrt(sumSqIN / numSteps);

  // 2. Assess balance criteria
  const allEnabled = pA.enabled && pB.enabled && pC.enabled;
  const areFrequenciesEqual =
    Math.abs(pA.frequency - pB.frequency) < 0.05 &&
    Math.abs(pA.frequency - pC.frequency) < 0.05;

  // Voltage balance check: equal amplitudes and 120° phase separation
  const ampTolerance = 0.015;
  const areAmplitudesEqual =
    Math.abs(pA.amplitude - pB.amplitude) < ampTolerance &&
    Math.abs(pA.amplitude - pC.amplitude) < ampTolerance;

  // Normalize relative phase angle differences modulo 360°
  const normDeg = (deg: number) => {
    let d = deg % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
  };

  const diffAB = normDeg(pA.phaseDeg - pB.phaseDeg);
  const diffAC = normDeg(pA.phaseDeg - pC.phaseDeg);

  // In standard sequence: A = 0°, B = -120° (or +240°), C = +120° (or -240°)
  // diffAB should be +120°, diffAC should be -120°
  const angleTolerance = 2.0;
  const areAnglesBalanced =
    (Math.abs(diffAB - 120) < angleTolerance || Math.abs(diffAB + 240) < angleTolerance) &&
    (Math.abs(diffAC + 120) < angleTolerance || Math.abs(diffAC - 240) < angleTolerance);

  const isVoltageBalanced = allEnabled && areFrequenciesEqual && areAmplitudesEqual && areAnglesBalanced;

  // Load balance check
  const loadTolerance = 0.15;
  const isLoadBalanced =
    allEnabled &&
    Math.abs(pA.resistance - pB.resistance) < loadTolerance &&
    Math.abs(pA.resistance - pC.resistance) < loadTolerance;

  const isSystemBalanced = isVoltageBalanced && isLoadBalanced;

  // 3. Dynamic Educational Feedback
  let educationalTitle = 'System Status';
  let educationalMessage = '';

  if (!allEnabled) {
    educationalTitle = 'Open Circuit / Phase Disconnected';
    educationalMessage =
      'One or more phases are open-circuited. In a 4-wire system, the active phase currents must return entirely through the neutral path, resulting in high neutral current.';
  } else if (!areFrequenciesEqual) {
    educationalTitle = 'Frequency Mismatch (Asynchronous Phases)';
    educationalMessage =
      'Phase frequencies are unequal. Because the frequencies differ, the relative phase angles change continuously over time, producing time-varying neutral current and a non-stationary voltage sum.';
  } else if (isSystemBalanced) {
    educationalTitle = 'Ideal Balanced Three-Phase System';
    educationalMessage =
      'Balanced source voltages (equal amplitude, 120° separation) across equal resistive loads (R = ' +
      pA.resistance.toFixed(1) +
      ' Ω). Instantaneous phase currents cancel out completely at the neutral node: i_N(t) = -(i_A + i_B + i_C) = 0. Neutral current RMS is 0.00 A.';
  } else if (isVoltageBalanced && !isLoadBalanced) {
    educationalTitle = 'Balanced Voltages with Load Imbalance';
    educationalMessage =
      'Crucial Concept: Source voltages are perfectly balanced, but load resistances are unequal (R_A=' +
      pA.resistance.toFixed(1) +
      'Ω, R_B=' +
      pB.resistance.toFixed(1) +
      'Ω, R_C=' +
      pC.resistance.toFixed(1) +
      'Ω). Unequal loads draw unequal phase currents, so they fail to cancel. A nonzero neutral current (I_N = ' +
      iN_Rms.toFixed(2) +
      ' A) flows even though voltage sum is zero!';
  } else {
    educationalTitle = 'Unbalanced Source Voltages';
    educationalMessage =
      'Voltage magnitudes or phase separation deviate from the 120° standard. The instantaneous voltage sum v_A(t) + v_B(t) + v_C(t) is nonzero (' +
      vSumRms.toFixed(2) +
      ' V RMS), resulting in unbalanced phase currents and nonzero neutral return current.';
  }

  return {
    isSystemBalanced,
    isVoltageBalanced,
    isLoadBalanced,
    areFrequenciesEqual,
    vA_Rms,
    vB_Rms,
    vC_Rms,
    vSumPeak: maxVSum,
    vSumRms,
    iA_Rms,
    iB_Rms,
    iC_Rms,
    iN_Rms,
    iN_Peak: maxIN,
    educationalTitle,
    educationalMessage,
  };
}

/**
 * Standard Presets to easily demonstrate balanced vs unbalanced phenomena.
 */
export const THREE_PHASE_PRESETS: ThreePhasePreset[] = [
  {
    id: 'balanced',
    name: 'Balanced System (Default)',
    description: 'Equal 1.0 pu voltages, 120° separation, equal 10Ω loads -> Zero neutral current',
    apply: (): ThreePhaseState => ({
      ...DEFAULT_THREE_PHASE_STATE,
      mode: 'three',
    }),
  },
  {
    id: 'load-imbalance',
    name: 'Load Imbalance (Phase A Heavy)',
    description: 'Balanced voltages, but Phase A resistance dropped to 5Ω -> Nonzero neutral current',
    apply: (curr: ThreePhaseState): ThreePhaseState => ({
      ...curr,
      phaseA: { ...curr.phaseA, resistance: 5 },
      phaseB: { ...curr.phaseB, resistance: 10 },
      phaseC: { ...curr.phaseC, resistance: 10 },
    }),
  },
  {
    id: 'voltage-sag',
    name: 'Voltage Sag on Phase A (-30%)',
    description: 'Phase A voltage drops to 0.70 pu -> Nonzero voltage sum and neutral current',
    apply: (curr: ThreePhaseState): ThreePhaseState => ({
      ...curr,
      phaseA: { ...curr.phaseA, amplitude: 0.7 },
      phaseB: { ...curr.phaseB, amplitude: 1.0 },
      phaseC: { ...curr.phaseC, amplitude: 1.0 },
    }),
  },
  {
    id: 'phase-shift',
    name: 'Phase B Angle Shift (-90° instead of -120°)',
    description: 'Angular asymmetry causing phase cancellation failure',
    apply: (curr: ThreePhaseState): ThreePhaseState => ({
      ...curr,
      phaseA: { ...curr.phaseA, phaseDeg: 0 },
      phaseB: { ...curr.phaseB, phaseDeg: -90 },
      phaseC: { ...curr.phaseC, phaseDeg: 120 },
    }),
  },
  {
    id: 'phase-outage',
    name: 'Phase C Open Circuit / Outage',
    description: 'Phase C disconnected -> Remaining currents return via neutral conductor',
    apply: (curr: ThreePhaseState): ThreePhaseState => ({
      ...curr,
      phaseC: { ...curr.phaseC, enabled: false },
    }),
  },
];
