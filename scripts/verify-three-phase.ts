import {
  DEFAULT_THREE_PHASE_STATE,
  ThreePhaseState,
} from '../src/types/threePhase';
import {
  evaluatePhaseVoltage,
  evaluatePhaseCurrent,
  generateThreePhasePoints,
  computeThreePhaseMetrics,
  THREE_PHASE_PRESETS,
} from '../src/model/threePhaseModel';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('================================================================');
console.log('THREE-PHASE VOLTAGE GENERATOR ACCEPTANCE TESTS');
console.log('================================================================\n');

// -------------------------------------------------------------
// TEST 1: Default Three-Phase Balanced State
// -------------------------------------------------------------
console.log('--- TEST 1: Default Balanced Settings ---');
const defaultState = DEFAULT_THREE_PHASE_STATE;

assert(defaultState.phaseA.amplitude === 1.0, 'Phase A default peak voltage is 1.0 pu');
assert(defaultState.phaseB.amplitude === 1.0, 'Phase B default peak voltage is 1.0 pu');
assert(defaultState.phaseC.amplitude === 1.0, 'Phase C default peak voltage is 1.0 pu');

assert(defaultState.phaseA.frequency === 60, 'Phase A default frequency is 60 Hz');
assert(defaultState.phaseB.frequency === 60, 'Phase B default frequency is 60 Hz');
assert(defaultState.phaseC.frequency === 60, 'Phase C default frequency is 60 Hz');

assert(defaultState.phaseA.phaseDeg === 0, 'Phase A reference angle is 0°');
assert(defaultState.phaseB.phaseDeg === -120, 'Phase B angle is -120° (standard balance)');
assert(defaultState.phaseC.phaseDeg === 120, 'Phase C angle is +120° (standard balance)');

assert(defaultState.phaseA.resistance === 10, 'Phase A default load resistance is 10.0 Ω');
assert(defaultState.phaseB.resistance === 10, 'Phase B default load resistance is 10.0 Ω');
assert(defaultState.phaseC.resistance === 10, 'Phase C default load resistance is 10.0 Ω');

// -------------------------------------------------------------
// TEST 2: Balanced State Metrics & KCL Neutral Cancellation
// -------------------------------------------------------------
console.log('\n--- TEST 2: Balanced State Neutral Current & Voltage Sum ---');
const balancedMetrics = computeThreePhaseMetrics(defaultState);

assert(balancedMetrics.isSystemBalanced === true, 'System is flagged as Balanced');
assert(balancedMetrics.isVoltageBalanced === true, 'Source voltages are flagged as Balanced');
assert(balancedMetrics.isLoadBalanced === true, 'Connected loads are flagged as Balanced');
assert(balancedMetrics.areFrequenciesEqual === true, 'Frequencies are identical (60 Hz)');

// In an ideal balanced system, vA(t) + vB(t) + vC(t) == 0 at all times
assert(balancedMetrics.vSumRms < 0.001, `Balanced voltage sum RMS is zero: ${balancedMetrics.vSumRms.toFixed(5)} pu`);
assert(balancedMetrics.vSumPeak < 0.001, `Balanced voltage sum peak is zero: ${balancedMetrics.vSumPeak.toFixed(5)} pu`);

// KCL neutral current i_N(t) = -(iA + iB + iC) == 0 at all times
assert(balancedMetrics.iN_Rms < 0.001, `Balanced neutral current RMS is zero: ${balancedMetrics.iN_Rms.toFixed(5)} A`);
assert(balancedMetrics.iN_Peak < 0.001, `Balanced neutral current peak is zero: ${balancedMetrics.iN_Peak.toFixed(5)} A`);

// Phase currents are equal: I_rms = (V_pk / sqrt(2)) / R = (1.0 / 1.4142) / 10 = 0.0707 A
const expectedIrms = (1.0 / Math.SQRT2) / 10;
assert(Math.abs(balancedMetrics.iA_Rms - expectedIrms) < 0.002, `Phase A current RMS matches Ohm's Law: ${balancedMetrics.iA_Rms.toFixed(4)} A`);
assert(Math.abs(balancedMetrics.iB_Rms - expectedIrms) < 0.002, `Phase B current RMS matches Ohm's Law: ${balancedMetrics.iB_Rms.toFixed(4)} A`);
assert(Math.abs(balancedMetrics.iC_Rms - expectedIrms) < 0.002, `Phase C current RMS matches Ohm's Law: ${balancedMetrics.iC_Rms.toFixed(4)} A`);

// -------------------------------------------------------------
// TEST 3: Load Imbalance (Balanced Voltages, Unequal Loads)
// -------------------------------------------------------------
console.log('\n--- TEST 3: Load Imbalance with Balanced Voltages ---');
// Preset: Phase A resistance dropped to 5.0 Ω (heavier load), B & C remain 10.0 Ω
const loadImbalancePreset = THREE_PHASE_PRESETS.find((p) => p.id === 'load-imbalance')!;
const loadImbalanceState = loadImbalancePreset.apply(defaultState);

const loadImbalanceMetrics = computeThreePhaseMetrics(loadImbalanceState);

assert(loadImbalanceMetrics.isVoltageBalanced === true, 'Voltages remain perfectly balanced');
assert(loadImbalanceMetrics.isLoadBalanced === false, 'Loads are correctly identified as unbalanced');
assert(loadImbalanceMetrics.isSystemBalanced === false, 'Overall system is identified as unbalanced');

// Voltage sum is STILL zero because source voltages are balanced!
assert(loadImbalanceMetrics.vSumRms < 0.001, `Voltage sum remains zero under load imbalance: ${loadImbalanceMetrics.vSumRms.toFixed(5)} pu`);

// Neutral current MUST BE NON-ZERO because iA drew more current!
assert(loadImbalanceMetrics.iN_Rms > 0.03, `Neutral current flows due to load imbalance: ${loadImbalanceMetrics.iN_Rms.toFixed(4)} A`);
assert(loadImbalanceMetrics.iA_Rms > loadImbalanceMetrics.iB_Rms, 'Phase A carries higher current due to lower load resistance');

// -------------------------------------------------------------
// TEST 4: Voltage Imbalance (Voltage Sag on Phase A)
// -------------------------------------------------------------
console.log('\n--- TEST 4: Source Voltage Imbalance (Sag on Phase A) ---');
const voltageSagPreset = THREE_PHASE_PRESETS.find((p) => p.id === 'voltage-sag')!;
const voltageSagState = voltageSagPreset.apply(defaultState);

const voltageSagMetrics = computeThreePhaseMetrics(voltageSagState);

assert(voltageSagMetrics.isVoltageBalanced === false, 'Voltages are correctly identified as unbalanced');
assert(voltageSagMetrics.vSumRms > 0.15, `Voltage sum is nonzero due to voltage magnitude unbalance: ${voltageSagMetrics.vSumRms.toFixed(3)} pu`);
assert(voltageSagMetrics.iN_Rms > 0.015, `Neutral current is nonzero: ${voltageSagMetrics.iN_Rms.toFixed(4)} A`);

// -------------------------------------------------------------
// TEST 5: Phase Angle Imbalance
// -------------------------------------------------------------
console.log('\n--- TEST 5: Phase Angle Imbalance ---');
const phaseShiftPreset = THREE_PHASE_PRESETS.find((p) => p.id === 'phase-shift')!;
const phaseShiftState = phaseShiftPreset.apply(defaultState);

const phaseShiftMetrics = computeThreePhaseMetrics(phaseShiftState);

assert(phaseShiftMetrics.isVoltageBalanced === false, 'Phase angle shift causes voltage unbalance');
assert(phaseShiftMetrics.vSumRms > 0.2, `Voltage sum deviates from zero: ${phaseShiftMetrics.vSumRms.toFixed(3)} pu`);
assert(phaseShiftMetrics.iN_Rms > 0.02, `Neutral current flows due to phase shift: ${phaseShiftMetrics.iN_Rms.toFixed(4)} A`);

// -------------------------------------------------------------
// TEST 6: Asynchronous Frequencies
// -------------------------------------------------------------
console.log('\n--- TEST 6: Asynchronous Phase Frequencies ---');
const freqMismatchState: ThreePhaseState = {
  ...defaultState,
  phaseB: { ...defaultState.phaseB, frequency: 58 },
};

const freqMetrics = computeThreePhaseMetrics(freqMismatchState);
assert(freqMetrics.areFrequenciesEqual === false, 'Identified frequency mismatch between phases');
assert(freqMetrics.isVoltageBalanced === false, 'System cannot be balanced when frequencies differ');
assert(freqMetrics.educationalTitle.includes('Frequency Mismatch'), 'Educational feedback correctly flags asynchronous frequencies');

// -------------------------------------------------------------
// TEST 7: Single-Phasing / Open Circuit
// -------------------------------------------------------------
console.log('\n--- TEST 7: Open Circuit on Phase C ---');
const outagePreset = THREE_PHASE_PRESETS.find((p) => p.id === 'phase-outage')!;
const outageState = outagePreset.apply(defaultState);

const outageMetrics = computeThreePhaseMetrics(outageState);
assert(outageMetrics.isVoltageBalanced === false, 'Open circuit phase correctly flagged as unbalanced');
assert(outageMetrics.iC_Rms === 0, 'Phase C current is exactly zero when disconnected');
assert(outageMetrics.iN_Rms > 0.05, `Remaining phase currents return via neutral: ${outageMetrics.iN_Rms.toFixed(4)} A`);

// -------------------------------------------------------------
// TEST 8: Instantaneous Sampling & KCL Verification at Every Point
// -------------------------------------------------------------
console.log('\n--- TEST 8: Instantaneous KCL Verification at Sample Points ---');
const sampleResult = generateThreePhasePoints(loadImbalanceState, 0.015, 2, 100);
assert(sampleResult.points.length === 100, 'Generated 100 sample points');

let maxKclError = 0;
for (const pt of sampleResult.points) {
  // Check that pt.iN == -(pt.iA + pt.iB + pt.iC)
  const kclSum = pt.iA + pt.iB + pt.iC + pt.iN;
  if (Math.abs(kclSum) > maxKclError) {
    maxKclError = Math.abs(kclSum);
  }
}
assert(maxKclError < 1e-12, `KCL holds with double-precision precision across all points (max error: ${maxKclError.toExponential()})`);

// -------------------------------------------------------------
// TEST 9: Reset to Balanced Restores State Cleanly
// -------------------------------------------------------------
console.log('\n--- TEST 9: Reset to Balanced Functionality ---');
const balancedPreset = THREE_PHASE_PRESETS.find((p) => p.id === 'balanced')!;
const restoredState = balancedPreset.apply(voltageSagState);
const restoredMetrics = computeThreePhaseMetrics(restoredState);

assert(restoredMetrics.isSystemBalanced === true, 'Reset restores full system balance');
assert(restoredMetrics.iN_Rms < 0.001, 'Reset restores zero neutral current');
assert(restoredState.phaseA.amplitude === 1.0, 'Reset restores Phase A amplitude to 1.0 pu');
assert(restoredState.phaseA.resistance === 10, 'Reset restores load resistance to 10.0 Ω');

console.log('\n================================================================');
console.log(`TOTAL THREE-PHASE ACCEPTANCE TESTS: Passed: ${passed}, Failed: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
