import {
  computeRlcCircuitMetrics,
  generateRlcWaveformPoints,
  computeSourceInstantaneousVoltage,
  computeSeriesReactances,
  computeSeriesImpedance,
  computeCurrentPhasor,
  computeComponentVoltagePhasors,
  computePowerMetrics,
} from '../src/model/rlcCircuitModel';
import { solveRlcTransient } from '../src/model/rlcTransientModel';
import {
  complex,
  complexMagnitude,
  complexPhaseRad,
  degToRad,
  radToDeg,
  normalizeAngleDeg,
} from '../src/model/complexMath';
import {
  RlcCircuitConfig,
  RlcTopologyConfig,
  DEFAULT_RLC_CONFIG,
  DEFAULT_RLC_TOPOLOGY,
} from '../src/types/rlcCircuit';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ FAILED: ${message}`);
    failed++;
  }
}

function approxEqual(a: number, b: number, tol = 1e-3): boolean {
  return Math.abs(a - b) <= tol;
}

console.log('================================================================');
console.log('EXPLICIT ELECTRICAL EQUATIONS & REGRESSION TEST SUITE');
console.log('================================================================\n');

// ============================================================================
// MANDATORY REGRESSION TEST (Section 4): Exact Purely Resistive Behavior
// ============================================================================
console.log('--- MANDATORY REGRESSION TEST: Exact Purely Resistive (1 V RMS, 1 Ω) ---');
const pureR1V_Config: RlcCircuitConfig = {
  vSourceRms: 1,
  vSourcePhaseDeg: 0,
  frequency: 60,
  resistance: 1,
  inductanceMh: 0,
  capacitanceUf: 0,
};

const pureR1V_Metrics = computeRlcCircuitMetrics(pureR1V_Config);

assert(
  approxEqual(pureR1V_Metrics.zMagnitude, 1.0, 1e-9),
  `Impedance magnitude |Z| = 1.0 Ω (got ${pureR1V_Metrics.zMagnitude.toFixed(6)} Ω)`
);
assert(
  approxEqual(pureR1V_Metrics.zThetaDeg, 0.0, 1e-9),
  `Impedance phase angle θ_Z = 0.0° (got ${pureR1V_Metrics.zThetaDeg.toFixed(6)}°)`
);
assert(
  approxEqual(pureR1V_Metrics.iRms, 1.0, 1e-9),
  `Current I_RMS = 1.0 A (got ${pureR1V_Metrics.iRms.toFixed(6)} A)`
);
assert(
  approxEqual(pureR1V_Metrics.phiIDeg, 0.0, 1e-9),
  `Current phase angle φ_I = 0.0° (got ${pureR1V_Metrics.phiIDeg.toFixed(6)}°)`
);
assert(
  approxEqual(pureR1V_Metrics.vResistorRms, 1.0, 1e-9),
  `Resistor voltage V_R,RMS = 1.0 V (got ${pureR1V_Metrics.vResistorRms.toFixed(6)} V)`
);
assert(
  pureR1V_Metrics.powerFactor === 1.0,
  `Power factor = 1.0 (got ${pureR1V_Metrics.powerFactor})`
);

// Verify Instantaneous Waveforms for Pure Resistance:
// v_s(t) = √2 * sin(2πft) V
// i(t)   = √2 * sin(2πft) A
const wf1V = generateRlcWaveformPoints(pureR1V_Config, 0, 1, 100);
const sqrt2 = Math.SQRT2;
let waveformsExactMatch = true;
for (const pt of wf1V.points) {
  const t = pt.tAbsoluteSec;
  const expectedVs = sqrt2 * Math.sin(2 * Math.PI * 60 * t);
  const expectedI = sqrt2 * Math.sin(2 * Math.PI * 60 * t);
  if (!approxEqual(pt.vSource, expectedVs, 1e-9) || !approxEqual(pt.current, expectedI, 1e-9)) {
    waveformsExactMatch = false;
    break;
  }
}
assert(
  waveformsExactMatch,
  'Instantaneous waveforms v_s(t) = √2*sin(2πft) V and i(t) = √2*sin(2πft) A match with double precision'
);

// Also verify with explicit topology (inductor bypassed, capacitor bypassed)
const topoBypassed: RlcTopologyConfig = {
  resistor: 'enabled',
  inductor: 'bypassed',
  capacitor: 'bypassed',
};
const pureR1V_TopoMetrics = computeRlcCircuitMetrics(
  { ...DEFAULT_RLC_CONFIG, vSourceRms: 1, vSourcePhaseDeg: 0, resistance: 1 },
  topoBypassed
);
assert(
  approxEqual(pureR1V_TopoMetrics.iRms, 1.0, 1e-9) && approxEqual(pureR1V_TopoMetrics.phiIDeg, 0.0, 1e-9),
  'Mandatory regression test passes with component bypass topology: I_RMS = 1.0 A, φ_I = 0.0°'
);

// ============================================================================
// TEST 1: Pure Resistance (1 V RMS, 1 Ω)
// ============================================================================
console.log('\n--- TEST 1: Pure Resistance (1 V RMS, 1 Ω) ---');
assert(pureR1V_Metrics.iRms === 1.0, 'Pure resistance: 1 V RMS / 1 Ω = 1 A RMS');
assert(pureR1V_Metrics.phiIDeg === 0.0, 'Pure resistance: phase difference = 0°');

// ============================================================================
// TEST 2: Pure Resistance (120 V RMS, 60 Ω)
// ============================================================================
console.log('\n--- TEST 2: Pure Resistance (120 V RMS, 60 Ω) ---');
const pureR120V: RlcCircuitConfig = {
  vSourceRms: 120,
  vSourcePhaseDeg: 0,
  frequency: 60,
  resistance: 60,
  inductanceMh: 0,
  capacitanceUf: 0,
};
const mR120 = computeRlcCircuitMetrics(pureR120V);
assert(approxEqual(mR120.iRms, 2.0, 1e-9), `Pure resistance: 120 V RMS / 60 Ω = 2 A RMS (${mR120.iRms.toFixed(4)} A)`);
assert(approxEqual(mR120.phiIDeg, 0.0, 1e-9), 'Pure resistance: current phase difference = 0°');
assert(mR120.powerFactor === 1.0, 'Pure resistance: power factor = 1.000');

// ============================================================================
// TEST 3: Pure Inductance (Current lags voltage by exactly 90°)
// ============================================================================
console.log('\n--- TEST 3: Pure Inductance (Current lags voltage by 90°) ---');
const pureLConfig: RlcCircuitConfig = {
  vSourceRms: 120,
  vSourcePhaseDeg: 0,
  frequency: 60,
  resistance: 0,
  inductanceMh: 100, // L = 0.1 H -> X_L = 2π * 60 * 0.1 ≈ 37.6991 Ω
  capacitanceUf: 0,
};
const pureLMetrics = computeRlcCircuitMetrics(pureLConfig, {
  resistor: 'bypassed',
  inductor: 'enabled',
  capacitor: 'bypassed',
});
const expectedXL = 2 * Math.PI * 60 * 0.1;
const expectedIL = 120 / expectedXL;
assert(approxEqual(pureLMetrics.xL, expectedXL, 1e-4), `Inductive reactance X_L ≈ ${expectedXL.toFixed(2)} Ω`);
assert(approxEqual(pureLMetrics.iRms, expectedIL, 1e-4), `Current I_RMS ≈ ${expectedIL.toFixed(4)} A`);
assert(pureLMetrics.zThetaDeg === 90.0, 'Impedance angle is exactly +90.0°');
assert(pureLMetrics.phiIDeg === -90.0, 'Current phase angle is exactly -90.0° (current lags by 90°)');
assert(pureLMetrics.powerFactor === 0.0, 'Power factor is 0.000');
assert(pureLMetrics.powerFactorType === 'lagging', 'Power factor type is lagging');
assert(pureLMetrics.realPowerW === 0.0, 'Real power dissipation P = 0 W');

// ============================================================================
// TEST 4: Pure Capacitance (Current leads voltage by exactly 90°)
// ============================================================================
console.log('\n--- TEST 4: Pure Capacitance (Current leads voltage by 90°) ---');
const pureC_Config: RlcCircuitConfig = {
  vSourceRms: 120,
  vSourcePhaseDeg: 0,
  frequency: 60,
  resistance: 0,
  inductanceMh: 0,
  capacitanceUf: 100, // C = 100 µF -> X_C = 1 / (2π * 60 * 100e-6) ≈ 26.5258 Ω
};
const pureC_Metrics = computeRlcCircuitMetrics(pureC_Config);
const expectedXC = 1 / (2 * Math.PI * 60 * 100e-6);
const expectedIC = 120 / expectedXC;
assert(approxEqual(pureC_Metrics.xC, expectedXC, 1e-4), `Capacitive reactance X_C ≈ ${expectedXC.toFixed(2)} Ω`);
assert(approxEqual(pureC_Metrics.iRms, expectedIC, 1e-4), `Current I_RMS ≈ ${expectedIC.toFixed(4)} A`);
assert(pureC_Metrics.zThetaDeg === -90.0, 'Impedance angle is exactly -90.0°');
assert(pureC_Metrics.phiIDeg === 90.0, 'Current phase angle is exactly +90.0° (current leads by 90°)');
assert(pureC_Metrics.powerFactor === 0.0, 'Power factor is 0.000');
assert(pureC_Metrics.powerFactorType === 'leading', 'Power factor type is leading');

// ============================================================================
// TEST 5: Series RL Circuit (Matches analytical impedance solution)
// ============================================================================
console.log('\n--- TEST 5: Series RL Circuit ---');
const rlConfig: RlcCircuitConfig = {
  vSourceRms: 120,
  vSourcePhaseDeg: 0,
  frequency: 60,
  resistance: 100,
  inductanceMh: 100,
  capacitanceUf: 100,
};
const rlMetrics = computeRlcCircuitMetrics(rlConfig, {
  resistor: 'enabled',
  inductor: 'enabled',
  capacitor: 'bypassed',
});
const expectedZ_RL = Math.sqrt(100 * 100 + expectedXL * expectedXL);
const expectedTheta_RL = Math.atan2(expectedXL, 100) * (180 / Math.PI);
assert(approxEqual(rlMetrics.zMagnitude, expectedZ_RL, 1e-4), `Series RL |Z| = ${expectedZ_RL.toFixed(2)} Ω`);
assert(approxEqual(rlMetrics.zThetaDeg, expectedTheta_RL, 1e-4), `Series RL θ_Z = +${expectedTheta_RL.toFixed(2)}°`);
assert(approxEqual(rlMetrics.iRms, 120 / expectedZ_RL, 1e-4), `Series RL I_RMS = ${(120 / expectedZ_RL).toFixed(4)} A`);
assert(approxEqual(rlMetrics.phiIDeg, -expectedTheta_RL, 1e-4), 'Series RL current lags by θ_Z');

// ============================================================================
// TEST 6: Series RC Circuit (Matches analytical impedance solution)
// ============================================================================
console.log('\n--- TEST 6: Series RC Circuit ---');
const rcConfig: RlcCircuitConfig = {
  vSourceRms: 120,
  vSourcePhaseDeg: 0,
  frequency: 60,
  resistance: 100,
  inductanceMh: 0,
  capacitanceUf: 100,
};
const rcMetrics = computeRlcCircuitMetrics(rcConfig);
const expectedZ_RC = Math.sqrt(100 * 100 + expectedXC * expectedXC);
const expectedTheta_RC = Math.atan2(-expectedXC, 100) * (180 / Math.PI);
assert(approxEqual(rcMetrics.zMagnitude, expectedZ_RC, 1e-4), `Series RC |Z| = ${expectedZ_RC.toFixed(2)} Ω`);
assert(approxEqual(rcMetrics.zThetaDeg, expectedTheta_RC, 1e-4), `Series RC θ_Z = ${expectedTheta_RC.toFixed(2)}°`);
assert(approxEqual(rcMetrics.iRms, 120 / expectedZ_RC, 1e-4), `Series RC I_RMS = ${(120 / expectedZ_RC).toFixed(4)} A`);
assert(approxEqual(rcMetrics.phiIDeg, -expectedTheta_RC, 1e-4), 'Series RC current leads by |θ_Z|');

// ============================================================================
// TEST 7: Series RLC (Component voltage phasors sum to source phasor)
// ============================================================================
console.log('\n--- TEST 7: Series RLC Phasor Sum Verification ---');
const rlcConfig: RlcCircuitConfig = {
  vSourceRms: 120,
  vSourcePhaseDeg: 30, // 30° source phase
  frequency: 60,
  resistance: 100,
  inductanceMh: 100,
  capacitanceUf: 100,
};
const rlcMetrics = computeRlcCircuitMetrics(rlcConfig);
assert(rlcMetrics.phasorSumError < 1e-12, `Phasor sum error |V_s - (V_R + V_L + V_C)| is effectively zero: ${rlcMetrics.phasorSumError.toExponential(2)} V`);

// ============================================================================
// TEST 8: Source Phase Changes (Shifts waveforms without changing impedance)
// ============================================================================
console.log('\n--- TEST 8: Source Phase Shifts ---');
const rlcPhase0 = computeRlcCircuitMetrics({ ...rlcConfig, vSourcePhaseDeg: 0 });
const rlcPhase45 = computeRlcCircuitMetrics({ ...rlcConfig, vSourcePhaseDeg: 45 });
assert(approxEqual(rlcPhase0.zMagnitude, rlcPhase45.zMagnitude, 1e-9), 'Impedance magnitude |Z| is unchanged by source phase');
assert(approxEqual(rlcPhase0.zThetaDeg, rlcPhase45.zThetaDeg, 1e-9), 'Impedance angle θ_Z is unchanged by source phase');
assert(approxEqual(rlcPhase0.iRms, rlcPhase45.iRms, 1e-9), 'Current I_RMS is unchanged by source phase');
assert(
  approxEqual(rlcPhase45.phiIDeg - rlcPhase0.phiIDeg, 45.0, 1e-9),
  `Current phase angle shifts by exactly +45.0° (got ${(rlcPhase45.phiIDeg - rlcPhase0.phiIDeg).toFixed(4)}°)`
);

// Verify instantaneous source voltage matches phase at t = 0
const vs0 = computeSourceInstantaneousVoltage(120, 60, 45, 0);
const expectedVs0 = 120 * sqrt2 * Math.sin(degToRad(45));
assert(approxEqual(vs0, expectedVs0, 1e-9), `Instantaneous v_s(0) with 45° phase = ${expectedVs0.toFixed(2)} V`);

// ============================================================================
// TEST 9: RMS and Peak Conversions
// ============================================================================
console.log('\n--- TEST 9: RMS and Peak Conversions ---');
assert(approxEqual(rlcMetrics.vSourcePeak, 120 * sqrt2, 1e-9), 'vSourcePeak = √2 * vSourceRms');
assert(approxEqual(rlcMetrics.iPeak, rlcMetrics.iRms * sqrt2, 1e-9), 'iPeak = √2 * iRms');
assert(approxEqual(rlcMetrics.vResistorPeak, rlcMetrics.vResistorRms * sqrt2, 1e-9), 'vResistorPeak = √2 * vResistorRms');
assert(approxEqual(rlcMetrics.vInductorPeak, rlcMetrics.vInductorRms * sqrt2, 1e-9), 'vInductorPeak = √2 * vInductorRms');
assert(approxEqual(rlcMetrics.vCapacitorPeak, rlcMetrics.vCapacitorRms * sqrt2, 1e-9), 'vCapacitorPeak = √2 * vCapacitorRms');

// ============================================================================
// TEST 10: Zero-Valued & Disabled Components Topology
// ============================================================================
console.log('\n--- TEST 10: Zero-Valued and Disabled Components Topology ---');
// Bypassed resistor
const mBypassR = computeRlcCircuitMetrics(rlcConfig, { ...DEFAULT_RLC_TOPOLOGY, resistor: 'bypassed' });
assert(mBypassR.vResistorRms === 0, 'Bypassed resistor has 0 V drop');

// Bypassed inductor
const mBypassL = computeRlcCircuitMetrics(rlcConfig, { ...DEFAULT_RLC_TOPOLOGY, inductor: 'bypassed' });
assert(mBypassL.xL === 0 && mBypassL.vInductorRms === 0, 'Bypassed inductor has 0 Ω and 0 V drop');

// Bypassed capacitor
const mBypassC = computeRlcCircuitMetrics(rlcConfig, { ...DEFAULT_RLC_TOPOLOGY, capacitor: 'bypassed' });
assert(mBypassC.xC === 0 && mBypassC.vCapacitorRms === 0, 'Bypassed capacitor has 0 Ω and 0 V drop');

// ============================================================================
// TEST 11: Open-Circuit Current is Zero
// ============================================================================
console.log('\n--- TEST 11: Open-Circuit Current is Zero ---');
const mOpen = computeRlcCircuitMetrics(rlcConfig, { ...DEFAULT_RLC_TOPOLOGY, capacitor: 'removed' });
assert(mOpen.isOpenCircuit === true, 'Open circuit state correctly identified');
assert(mOpen.iRms === 0, 'Open circuit current I_RMS is exactly 0 A');
assert(mOpen.vResistorRms === 0, 'Open circuit V_R is 0 V');
assert(mOpen.vInductorRms === 0, 'Open circuit V_L is 0 V');
assert(mOpen.vCapacitorRms === rlcConfig.vSourceRms, 'Entire source voltage drops across open capacitor');

// ============================================================================
// TEST 12: Zero Impedance Unbounded Indication (No fabricated finite current)
// ============================================================================
console.log('\n--- TEST 12: Zero Impedance Handling ---');
const mShort = computeRlcCircuitMetrics({
  vSourceRms: 120,
  frequency: 60,
  resistance: 0,
  inductanceMh: 0,
  capacitanceUf: 0,
});
assert(mShort.isUnboundedCurrent === true, 'All zero components with V > 0 flagged as unbounded current');
assert(mShort.iDisplay === 'Unbounded', 'iDisplay displays "Unbounded"');
assert(mShort.zDisplay.includes('0.0 Ω'), 'zDisplay indicates 0.0 Ω');

// ============================================================================
// TEST 13: Display Strings Clean (No NaN or Infinity)
// ============================================================================
console.log('\n--- TEST 13: No NaN or Infinity in Display Strings ---');
const configsToTest: RlcCircuitMetrics[] = [
  pureR1V_Metrics,
  pureLMetrics,
  pureC_Metrics,
  rlMetrics,
  rcMetrics,
  rlcMetrics,
  mOpen,
  mShort,
];

let allDisplaysClean = true;
configsToTest.forEach((m, idx) => {
  if (
    m.zDisplay.includes('NaN') ||
    m.iDisplay.includes('NaN') ||
    m.pfDisplay.includes('NaN') ||
    m.thetaZDisplay.includes('NaN') ||
    m.phiIDisplay.includes('NaN') ||
    m.f0Display.includes('NaN')
  ) {
    allDisplaysClean = false;
    console.error(`NaN found in config ${idx}`);
  }
});
assert(allDisplaysClean, 'No NaN appears in any display fields across all operating regimes');

// ============================================================================
// TEST 14: Transient Simulation Converges Toward Analytical Steady State
// ============================================================================
console.log('\n--- TEST 14: Transient Simulation Convergence ---');
// Stable series RLC: R = 100 Ω, L = 100 mH, C = 100 µF
// Natural time constant tau = 2L / R = 2 * 0.1 / 100 = 2 ms.
// After 50 ms (25 time constants), transient homogeneous solution has decayed to < e^-25 ≈ 1.3e-11!
const trajLong = solveRlcTransient(
  rlcConfig,
  DEFAULT_RLC_TOPOLOGY,
  { initialVc: 50, initialIl: 2 }, // Non-zero initial energy
  0.05, // t = 50 ms
  20,
  200,
  true
);

const ssMetricsConvergence = computeRlcCircuitMetrics(rlcConfig, DEFAULT_RLC_TOPOLOGY);
const lastPoint = trajLong.points[trajLong.points.length - 1];
const tFinal = lastPoint.tAbsoluteSec;
const ssExpectedCurrent = ssMetricsConvergence.iPeak * Math.sin(2 * Math.PI * 60 * tFinal + ssMetricsConvergence.phiIRad);

assert(
  approxEqual(lastPoint.current, ssExpectedCurrent, 0.01),
  `Transient current converges to analytical steady state: |i_trans(${lastPoint.current.toFixed(4)}A) - i_ss(${ssExpectedCurrent.toFixed(4)}A)| < 0.01 A`
);

console.log('\n================================================================');
console.log(`EXPLICIT EQUATIONS TEST SUMMARY: Passed: ${passed}, Failed: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
