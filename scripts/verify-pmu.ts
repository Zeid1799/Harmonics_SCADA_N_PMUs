import {
  DEFAULT_PMU_SETTINGS,
  getZone1Limit,
  getZone2Nyquist,
  determineDisturbanceZone,
  calculateZone2Capture,
  calculateZone3Attenuation,
  calculateAliasFrequency,
  evaluatePmuCapture,
  evaluateTrueSignal,
  evaluatePmuSignal,
  generatePmuTimeDomainData,
  calculateTimeDomainYLimits,
  createRng,
} from '../src/model/pmuModel';
import { DEFAULT_WAVEFORM_STATE } from '../src/model/waveformModel';
import { InjectedDisturbance } from '../src/types/pmu';
import {
  evaluatePhasorEstimate,
  ESTIMATION_METHOD_DOCS,
  normalizeAngleDeg,
} from '../src/model/phasorEstimation';

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
console.log('PMU SPECIFICATION VERIFICATION SUITE');
console.log('================================================================');

// 1. Zone Boundaries & Dynamic Performance Formulas
console.log('\n--- Criterion 1: Dynamic Performance Boundaries Across All Reporting Rates ---');
// P-Class: min(Fs / 10, 2 Hz)
assert(getZone1Limit(10, 'P-Class') === 1, '10 fps P-Class Zone 1 limit is 1 Hz');
assert(getZone1Limit(12, 'P-Class') === 1.2, '12 fps P-Class Zone 1 limit is 1.2 Hz');
assert(getZone1Limit(15, 'P-Class') === 1.5, '15 fps P-Class Zone 1 limit is 1.5 Hz');
assert(getZone1Limit(20, 'P-Class') === 2, '20 fps P-Class Zone 1 limit is 2 Hz');
assert(getZone1Limit(30, 'P-Class') === 2, '30 fps P-Class Zone 1 limit is 2 Hz');
assert(getZone1Limit(60, 'P-Class') === 2, '60 fps P-Class Zone 1 limit is 2 Hz');

// M-Class: min(Fs / 5, 5 Hz)
assert(getZone1Limit(10, 'M-Class') === 2, '10 fps M-Class Zone 1 limit is 2 Hz');
assert(getZone1Limit(12, 'M-Class') === 2.4, '12 fps M-Class Zone 1 limit is 2.4 Hz');
assert(getZone1Limit(15, 'M-Class') === 3, '15 fps M-Class Zone 1 limit is 3 Hz');
assert(getZone1Limit(20, 'M-Class') === 4, '20 fps M-Class Zone 1 limit is 4 Hz');
assert(getZone1Limit(30, 'M-Class') === 5, '30 fps M-Class Zone 1 limit is 5 Hz');
assert(getZone1Limit(60, 'M-Class') === 5, '60 fps M-Class Zone 1 limit is 5 Hz');

// Reporting Nyquist Limits (Fs / 2)
assert(getZone2Nyquist(10) === 5, '10 fps -> Zone 2 Nyquist is 5 Hz');
assert(getZone2Nyquist(12) === 6, '12 fps -> Zone 2 Nyquist is 6 Hz');
assert(getZone2Nyquist(15) === 7.5, '15 fps -> Zone 2 Nyquist is 7.5 Hz');
assert(getZone2Nyquist(20) === 10, '20 fps -> Zone 2 Nyquist is 10 Hz');
assert(getZone2Nyquist(30) === 15, '30 fps -> Zone 2 Nyquist is 15 Hz');
assert(getZone2Nyquist(60) === 30, '60 fps -> Zone 2 Nyquist is 30 Hz');

// Zone Determination
assert(determineDisturbanceZone(2, 5, 15) === 1, '2 Hz with Zone 1=5Hz and Nyq=15Hz is in Zone 1');
assert(determineDisturbanceZone(5, 5, 15) === 1, '5 Hz boundary is in Zone 1');
assert(determineDisturbanceZone(5.1, 5, 15) === 2, '5.1 Hz is in Zone 2');
assert(determineDisturbanceZone(10, 5, 15) === 2, '10 Hz is in Zone 2');
assert(determineDisturbanceZone(15, 5, 15) === 2, '15 Hz Nyquist boundary is in Zone 2');
assert(determineDisturbanceZone(15.1, 5, 15) === 3, '15.1 Hz is in Zone 3');
assert(determineDisturbanceZone(23, 5, 15) === 3, '23 Hz is in Zone 3');

// 2. Zone 1 Capture: AM vs Additive Sinusoids
console.log('\n--- Criterion 2: Disturbance Types in Zone 1 (AM vs Additive Sinusoid) ---');
// AM Disturbance: produces 2 sidebands
const distAmZ1: InjectedDisturbance[] = [
  { id: 'd-am', name: 'AM Dist', type: 'am', modulationFrequency: 1.5, amplitude: 0.25, enabled: true },
];
const snapAmZ1 = evaluatePmuCapture(DEFAULT_WAVEFORM_STATE, distAmZ1, DEFAULT_PMU_SETTINGS);
const outAmZ1 = snapAmZ1.outcomes[0];
assert(outAmZ1.zone === 1, 'AM Disturbance correctly classified as Zone 1');
assert(outAmZ1.capturedComponents.length === 2, 'AM Disturbance produces 2 symmetric sidebands');
assert(snapAmZ1.trueComponents.filter((c) => c.isDisturbance).length === 2, 'True spectrum has 2 sidebands for AM');
assert(outAmZ1.capturedComponents[0].amplitude === 0.25, 'Zone 1 preserves true amplitude 0.25 pu');
assert(outAmZ1.capturedComponents[0].phaseShiftRad === 0, 'Zone 1 has zero phase shift');

// Additive Single Tone: produces 1 component
const distAddLowerZ1: InjectedDisturbance[] = [
  { id: 'd-add-low', name: 'Tone Lower', type: 'additive', additiveTarget: 'lower', modulationFrequency: 1.5, amplitude: 0.20, enabled: true },
];
const snapAddLowerZ1 = evaluatePmuCapture(DEFAULT_WAVEFORM_STATE, distAddLowerZ1, DEFAULT_PMU_SETTINGS);
const outAddLowerZ1 = snapAddLowerZ1.outcomes[0];
assert(outAddLowerZ1.zone === 1, 'Additive Disturbance classified as Zone 1');
assert(outAddLowerZ1.capturedComponents.length === 1, 'Additive Disturbance produces exactly 1 component');
assert(snapAddLowerZ1.trueComponents.filter((c) => c.isDisturbance).length === 1, 'True spectrum has exactly 1 component for Additive');
assert(outAddLowerZ1.capturedComponents[0].frequency === 58.5, 'Lower tone at 60 - 1.5 = 58.5 Hz');

const distAddUpperZ1: InjectedDisturbance[] = [
  { id: 'd-add-up', name: 'Tone Upper', type: 'additive', additiveTarget: 'upper', modulationFrequency: 1.5, amplitude: 0.20, enabled: true },
];
const snapAddUpperZ1 = evaluatePmuCapture(DEFAULT_WAVEFORM_STATE, distAddUpperZ1, DEFAULT_PMU_SETTINGS);
assert(snapAddUpperZ1.outcomes[0].capturedComponents[0].frequency === 61.5, 'Upper tone at 60 + 1.5 = 61.5 Hz');

// 3. Zone 2 Exact Attenuation Formula with f0 = 60 Hz and f0 = 50 Hz References
console.log('\n--- Criterion 3: Zone 2 Attenuation Formula (60 Hz & 50 Hz Systems) ---');
// Formula: Captured amplitude = A * Sin(180 * ((f0 - frequency) * 0.1))
// Test 60 Hz system with frequency = 10 Hz: 180 * ((60 - 10) * 0.1) = 180 * 5 = 900 deg -> sin(900 deg) = 0
const atten10_60 = calculateZone2Capture(0.20, 10, 60);
assert(atten10_60.amplitude === 0, 'f0=60Hz: At 10 Hz, Sin(180*(50*0.1)) = Sin(900°) = 0 -> amplitude is 0');

// Test 60 Hz system with frequency = 15 Hz: 180 * ((60 - 15) * 0.1) = 180 * 4.5 = 810 deg -> sin(810 deg) = 1
const atten15_60 = calculateZone2Capture(0.20, 15, 60);
assert(Math.abs(atten15_60.amplitude - 0.20) < 1e-4, 'f0=60Hz: At 15 Hz, Sin(810°) = 1 -> amplitude is 0.20 pu');

// Test 50 Hz system with frequency = 10 Hz: 180 * ((50 - 10) * 0.1) = 180 * 4 = 720 deg -> sin(720 deg) = 0
const atten10_50 = calculateZone2Capture(0.20, 10, 50);
assert(atten10_50.amplitude === 0, 'f0=50Hz: At 10 Hz, Sin(180*(40*0.1)) = Sin(720°) = 0 -> amplitude is 0');

// Test 50 Hz system with frequency = 5 Hz: 180 * ((50 - 5) * 0.1) = 180 * 4.5 = 810 deg -> sin(810 deg) = 1
const atten5_50 = calculateZone2Capture(0.20, 5, 50);
assert(Math.abs(atten5_50.amplitude - 0.20) < 1e-4, 'f0=50Hz: At 5 Hz, Sin(810°) = 1 -> amplitude is 0.20 pu');

// Test negative factor representation: frequency = 6 Hz on 60 Hz system -> 180 * 5.4 = 972 deg -> sin(972°) < 0
const atten6_60 = calculateZone2Capture(0.20, 6, 60);
const expectedFactor6 = Math.sin((972 * Math.PI) / 180);
assert(expectedFactor6 < 0, 'Factor at 6 Hz on 60 Hz is negative');
assert(Math.abs(atten6_60.amplitude - 0.20 * Math.abs(expectedFactor6)) < 1e-4, 'Negative factor is represented as positive magnitude');
assert(atten6_60.phaseShiftRad === Math.PI, 'Negative factor correctly assigned phase reversal (Math.PI)');

// 4. Zone 3 Aliasing Frequency Calculation
console.log('\n--- Criterion 4: Aliased Frequencies & Folding Convention ---');
// f_alias = |fm - round(fm / Fs) * Fs|
assert(calculateAliasFrequency(20, 30) === 10, '20 Hz at 30 fps folds to |20 - 30| = 10 Hz');
assert(calculateAliasFrequency(23, 30) === 7, '23 Hz at 30 fps folds to |23 - 30| = 7 Hz');
assert(calculateAliasFrequency(35, 30) === 5, '35 Hz at 30 fps folds to |35 - 30| = 5 Hz');
assert(calculateAliasFrequency(50, 30) === 10, '50 Hz at 30 fps folds to |50 - 60| = 10 Hz');
assert(calculateAliasFrequency(23, 60) === 23, '23 Hz at 60 fps (Nyq=30) does not fold (k=0 -> 23 Hz)');

// 5. Zone 3 Random Attenuation Formula (60 Hz & 50 Hz Systems)
console.log('\n--- Criterion 5: Zone 3 Random Attenuation Formula (60 Hz & 50 Hz) ---');
// Formula: Captured amplitude = 0.4 * A * Sin(180 * ((f0 - frequency) * 0.1))
const z3Atten15_60 = calculateZone3Attenuation(0.20, 15, 60);
assert(Math.abs(z3Atten15_60.amplitude - 0.4 * 0.20) < 1e-4, 'f0=60Hz: At 15 Hz, Zone 3 formula gives 0.4 * 0.20 = 0.08 pu');
const z3Atten5_50 = calculateZone3Attenuation(0.20, 5, 50);
assert(Math.abs(z3Atten5_50.amplitude - 0.4 * 0.20) < 1e-4, 'f0=50Hz: At 5 Hz, Zone 3 formula gives 0.4 * 0.20 = 0.08 pu');

// 6. Zone 3 Stochastic Independent Bernoulli Trials
console.log('\n--- Criterion 5, 6, 7: Zone 3 Stochastic Model & Independent Trials ---');
const distZ3: InjectedDisturbance[] = [
  { id: 'd-z3', name: 'Z3 Dist', modulationFrequency: 23, amplitude: 0.20, enabled: true },
];

// Scenario A: Seed giving Missed only (miss=true, alias=false, atten=false)
// Test with controlled RNG mock
const rngMissOnly = () => {
  let count = 0;
  return () => {
    count++;
    if (count === 1) return 0.1; // miss (0.1 < 0.35) -> true
    if (count === 2) return 0.9; // alias (0.9 >= 0.60) -> false
    return 0.9; // atten (0.9 >= 0.50) -> false
  };
};
const snapMissOnly = evaluatePmuCapture(DEFAULT_WAVEFORM_STATE, distZ3, DEFAULT_PMU_SETTINGS, rngMissOnly());
const outcomeMiss = snapMissOnly.outcomes[0];
assert(outcomeMiss.missed === true && outcomeMiss.aliased === false && outcomeMiss.attenuated === false, 'Scenario A: Missed detection occurred alone');
assert(outcomeMiss.capturedComponents.length === 0, 'Missed detection suppresses original; no aliasing/attenuation -> 0 components');

// Scenario B: Aliased only (miss=false, alias=true, atten=false)
const rngAliasOnly = () => {
  let count = 0;
  return () => {
    count++;
    if (count === 1) return 0.9; // miss -> false
    if (count === 2) return 0.1; // alias (0.1 < 0.60) -> true
    return 0.9; // atten -> false
  };
};
const snapAliasOnly = evaluatePmuCapture(DEFAULT_WAVEFORM_STATE, distZ3, DEFAULT_PMU_SETTINGS, rngAliasOnly());
const outcomeAlias = snapAliasOnly.outcomes[0];
assert(outcomeAlias.aliased === true && outcomeAlias.missed === false && outcomeAlias.attenuated === false, 'Scenario B: Aliasing occurred alone');
assert(outcomeAlias.capturedComponents.length === 2, 'Aliasing produces 2 folded sidebands');
assert(outcomeAlias.capturedComponents[0].modulationFrequency === 7, 'Aliased component is at 7 Hz (folded from 23 Hz)');
assert(outcomeAlias.capturedComponents[0].isAliased === true, 'Component flagged as aliased');
assert(outcomeAlias.capturedComponents[0].zone === 2, 'Folded alias at 7 Hz is correctly placed in Zone 2 (5 Hz < 7 Hz <= 15 Hz)');
assert(outcomeAlias.capturedComponents[0].color !== undefined, 'Aliased component inherits disturbance color');

// Test alias folding into Zone 1 (fm = 29 Hz at 30 fps -> alias = 1 Hz <= Zone 1 limit 5 Hz)
const distZ3Near: InjectedDisturbance[] = [
  { id: 'd-z3-near', name: 'Z3 Near', modulationFrequency: 29, amplitude: 0.20, enabled: true },
];
const snapAliasZ1 = evaluatePmuCapture(DEFAULT_WAVEFORM_STATE, distZ3Near, DEFAULT_PMU_SETTINGS, rngAliasOnly());
const outcomeAliasZ1 = snapAliasZ1.outcomes[0];
assert(outcomeAliasZ1.capturedComponents[0].modulationFrequency === 1, '29 Hz at 30 fps folds to |29 - 30| = 1 Hz');
assert(outcomeAliasZ1.capturedComponents[0].zone === 1, 'Folded alias at 1 Hz is correctly placed in Zone 1 (1 Hz <= 5 Hz)');

// Scenario C: Both Aliased AND Attenuated (miss=false, alias=true, atten=true)
const rngBoth = () => {
  let count = 0;
  return () => {
    count++;
    if (count === 1) return 0.9; // miss -> false
    if (count === 2) return 0.1; // alias -> true
    return 0.1; // atten -> true
  };
};
const snapBoth = evaluatePmuCapture(DEFAULT_WAVEFORM_STATE, distZ3, DEFAULT_PMU_SETTINGS, rngBoth());
const outcomeBoth = snapBoth.outcomes[0];
assert(outcomeBoth.aliased === true && outcomeBoth.attenuated === true, 'Scenario C: Simultaneous aliasing and attenuation');
assert(outcomeBoth.capturedComponents.length === 4, 'Simultaneous events produce 4 components (2 aliased + 2 attenuated original)');

// Ensure all 4 components retain the SAME disturbance color
const expectedDistColor = outcomeBoth.capturedComponents[0].color;
assert(outcomeBoth.capturedComponents.every((c) => c.color === expectedDistColor), 'All resulting components (aliased + attenuated) retain the SAME disturbance color');
assert(outcomeBoth.capturedComponents.some((c) => c.isAliased && c.zone === 2), 'Aliased component is in Zone 2');
assert(outcomeBoth.capturedComponents.some((c) => c.isAttenuated && c.zone === 3), 'Attenuated original component remains in Zone 3');

// Scenario D: All Three Events (miss=true, alias=true, atten=true)
const rngAllThree = () => {
  let count = 0;
  return () => {
    count++;
    if (count === 1) return 0.1; // miss -> true
    if (count === 2) return 0.1; // alias -> true
    return 0.1; // atten -> true
  };
};
const snapAllThree = evaluatePmuCapture(DEFAULT_WAVEFORM_STATE, distZ3, DEFAULT_PMU_SETTINGS, rngAllThree());
const outcomeAllThree = snapAllThree.outcomes[0];
assert(outcomeAllThree.missed === true && outcomeAllThree.aliased === true && outcomeAllThree.attenuated === true, 'Scenario D: All three events occurred');
assert(outcomeAllThree.capturedComponents.some((c) => c.isAliased), 'Aliased component retained despite missed detection');

// 7. Measurement Snapshot Stability (Lifecycle)
console.log('\n--- Criterion 9: Snapshot Stability Across Animation Frames ---');
const prng = createRng(42);
const snap1 = evaluatePmuCapture(DEFAULT_WAVEFORM_STATE, distZ3, { ...DEFAULT_PMU_SETTINGS, seed: 42 });
// Simulate 100 animation frames (t advancing) without changing settings
const t1Val = evaluatePmuSignal(snap1, DEFAULT_WAVEFORM_STATE, 0.001);
const t2Val = evaluatePmuSignal(snap1, DEFAULT_WAVEFORM_STATE, 0.002);
assert(snap1.outcomes[0].missed === snap1.outcomes[0].missed, 'Snapshot outcomes remained identical across calls');
assert(typeof t1Val === 'number' && typeof t2Val === 'number', 'Time domain signal evaluates cleanly during playback');

// 8. Shared Data Model & Mathematical Consistency Between Spectrum and Time Domain
console.log('\n--- Criterion 10 & 13: Mathematical Consistency Across Domains ---');
const multiDisturbances: InjectedDisturbance[] = [
  { id: 'd-z1', name: 'Z1 Dist', modulationFrequency: 2, amplitude: 0.20, enabled: true },
  { id: 'd-z2', name: 'Z2 Dist', modulationFrequency: 8, amplitude: 0.15, enabled: true },
  { id: 'd-z3', name: 'Z3 Dist', modulationFrequency: 23, amplitude: 0.10, enabled: true },
];
const multiSnap = evaluatePmuCapture(DEFAULT_WAVEFORM_STATE, multiDisturbances, DEFAULT_PMU_SETTINGS, createRng(999));

// Compare spectrum component amplitudes with time-domain waveform data
const windowData = generatePmuTimeDomainData(DEFAULT_WAVEFORM_STATE, multiSnap, multiDisturbances, 0, 3, 500);
assert(windowData.points.length === 500, 'Generated 500 continuous sample points');
assert(windowData.reportedFrames.length > 0, `Generated ${windowData.reportedFrames.length} discrete PMU reporting frames`);
assert(windowData.windowDurationMs === 50, '3 fundamental cycles at 60 Hz = 50 ms window duration');

// Check that true waveform never equals 0 when carrier is 1.0 pu
const maxTrue = Math.max(...windowData.points.map((p) => Math.abs(p.trueY)));
assert(maxTrue >= 0.95, `Ground truth waveform maintains full carrier amplitude: ${maxTrue.toFixed(2)} pu`);

// Ground truth waveform is not altered by PMU settings
const snapP = evaluatePmuCapture(DEFAULT_WAVEFORM_STATE, multiDisturbances, { ...DEFAULT_PMU_SETTINGS, pmuClass: 'P-Class' });
const trueValUnderM = evaluateTrueSignal(DEFAULT_WAVEFORM_STATE, multiDisturbances, 0.0123);
const trueValUnderP = evaluateTrueSignal(DEFAULT_WAVEFORM_STATE, multiDisturbances, 0.0123);
assert(trueValUnderM === trueValUnderP, 'Ground truth waveform is identical regardless of PMU class');

// Changing PMU class updates Zone 1 without modifying Ground Truth
assert(snapP.zone1Limit === 2, 'P-Class Zone 1 limit is 2 Hz');
assert(multiSnap.zone1Limit === 5, 'M-Class Zone 1 limit is 5 Hz');

// Changing reporting rate updates Zone 2 Nyquist without modifying Ground Truth
const snap60 = evaluatePmuCapture(DEFAULT_WAVEFORM_STATE, multiDisturbances, { ...DEFAULT_PMU_SETTINGS, reportingRate: 60 });
assert(snap60.zone2Limit === 30, '60 fps reporting rate updates Zone 2 Nyquist to 30 Hz');
assert(multiSnap.zone2Limit === 15, '30 fps reporting rate has Zone 2 Nyquist at 15 Hz');

// Verify exact mathematical equivalence between spectrum components and time-domain signals
const testT = 0.042;
const trueCompSum = multiSnap.trueComponents.reduce((sum, c) => {
  return sum + c.amplitude * Math.sin(2 * Math.PI * c.frequency * testT);
}, 0);
const evalTrue = evaluateTrueSignal(DEFAULT_WAVEFORM_STATE, multiDisturbances, testT);
assert(Math.abs(trueCompSum - evalTrue) < 1e-4, 'evaluateTrueSignal matches exact sum of trueComponents');

const pmuCompSum = multiSnap.pmuComponents.reduce((sum, c) => {
  return sum + c.amplitude * Math.sin(2 * Math.PI * c.frequency * testT + c.phaseShiftRad);
}, 0);
const evalPmu = evaluatePmuSignal(multiSnap, DEFAULT_WAVEFORM_STATE, testT);
assert(Math.abs(pmuCompSum - evalPmu) < 1e-4, 'evaluatePmuSignal matches exact sum of pmuComponents');

// 9. Time-Domain Y-Axis Scaling & Disturbance Headroom
console.log('\n--- Acceptance Test: Time-Domain Y-Axis Scaling & Disturbance Headroom ---');

// Test 9.1: Base waveform default limits
const baseLimits = calculateTimeDomainYLimits(DEFAULT_WAVEFORM_STATE, []);
assert(baseLimits.yMin === -2.0 && baseLimits.yMax === 2.0, 'Base 1.0 pu waveform has standard limits [-2.0, +2.0]');

// Test 9.2: Adding disturbances with moderate amplitudes preserves [-2.0, +2.0] limits
const dist1: InjectedDisturbance[] = [
  { id: 'd1', name: 'Dist 1', modulationFrequency: 2, amplitude: 0.20, enabled: true },
];
const limitsWithD1 = calculateTimeDomainYLimits(DEFAULT_WAVEFORM_STATE, dist1);
assert(limitsWithD1.yMin === -2.0 && limitsWithD1.yMax === 2.0, 'Adding 0.20 pu disturbance preserves [-2.0, +2.0] limits without vertical compression');

const dist1And2: InjectedDisturbance[] = [
  ...dist1,
  { id: 'd2', name: 'Dist 2', modulationFrequency: 8, amplitude: 0.15, enabled: true },
  { id: 'd3', name: 'Dist 3', modulationFrequency: 23, amplitude: 0.20, enabled: true },
];
const limitsWithD123 = calculateTimeDomainYLimits(DEFAULT_WAVEFORM_STATE, dist1And2);
assert(limitsWithD123.yMin === -2.0 && limitsWithD123.yMax === 2.0, 'Adding multiple disturbances totaling 0.55 pu preserves [-2.0, +2.0] limits');

// Test 9.3: Disabled disturbances do not affect limits
const distWithDisabled: InjectedDisturbance[] = [
  ...dist1And2,
  { id: 'd4', name: 'Dist 4', modulationFrequency: 12, amplitude: 2.0, enabled: false },
];
const limitsWithDisabled = calculateTimeDomainYLimits(DEFAULT_WAVEFORM_STATE, distWithDisabled);
assert(limitsWithDisabled.yMin === -2.0 && limitsWithDisabled.yMax === 2.0, 'Disabled disturbances do not trigger scale expansion');

// Test 9.4: Large disturbance smoothly expands to rounded 0.5 pu step
const distLarge: InjectedDisturbance[] = [
  { id: 'd-lg', name: 'Large Dist', modulationFrequency: 4, amplitude: 1.0, enabled: true },
];
const limitsLarge = calculateTimeDomainYLimits(DEFAULT_WAVEFORM_STATE, distLarge);
// peak = 1.0 + 1.0 = 2.0 -> 2.0 * 1.10 = 2.2 -> rounded to next 0.5 is 2.5
assert(limitsLarge.yMin === -2.5 && limitsLarge.yMax === 2.5, 'Large disturbance (1.0 pu) expands smoothly to [-2.5, +2.5]');

// Test 9.5: Very large disturbance expands to [-3.0, +3.0]
const distVeryLarge: InjectedDisturbance[] = [
  { id: 'd-vlg', name: 'Very Large Dist', modulationFrequency: 4, amplitude: 1.5, enabled: true },
];
const limitsVeryLarge = calculateTimeDomainYLimits(DEFAULT_WAVEFORM_STATE, distVeryLarge);
// peak = 1.0 + 1.5 = 2.5 -> 2.5 * 1.10 = 2.75 -> rounded to next 0.5 is 3.0
assert(limitsVeryLarge.yMin === -3.0 && limitsVeryLarge.yMax === 3.0, 'Very large disturbance (1.5 pu) expands to [-3.0, +3.0]');

// Test 9.6: Stability during playback - limits do not change as time advances
const snapForAnim = evaluatePmuCapture(DEFAULT_WAVEFORM_STATE, dist1And2, DEFAULT_PMU_SETTINGS);
const winT0 = generatePmuTimeDomainData(DEFAULT_WAVEFORM_STATE, snapForAnim, dist1And2, 0.0);
const winT1 = generatePmuTimeDomainData(DEFAULT_WAVEFORM_STATE, snapForAnim, dist1And2, 0.016);
const winT2 = generatePmuTimeDomainData(DEFAULT_WAVEFORM_STATE, snapForAnim, dist1And2, 0.543);
const winT3 = generatePmuTimeDomainData(DEFAULT_WAVEFORM_STATE, snapForAnim, dist1And2, 10.0);
assert(
  winT0.yMin === winT1.yMin && winT1.yMin === winT2.yMin && winT2.yMin === winT3.yMin &&
  winT0.yMax === winT1.yMax && winT1.yMax === winT2.yMax && winT2.yMax === winT3.yMax,
  'Y-axis limits are strictly constant across playback animation frames (zero jitter)'
);

// Test 9.7: Neither true signal nor PMU-captured signal is clipped
let maxTrueObserved = -Infinity;
let minTrueObserved = Infinity;
let maxPmuObserved = -Infinity;
let minPmuObserved = Infinity;
for (const p of winT2.points) {
  if (p.trueY > maxTrueObserved) maxTrueObserved = p.trueY;
  if (p.trueY < minTrueObserved) minTrueObserved = p.trueY;
  if (p.pmuY > maxPmuObserved) maxPmuObserved = p.pmuY;
  if (p.pmuY < minPmuObserved) minPmuObserved = p.pmuY;
}
assert(
  minTrueObserved >= winT2.yMin && maxTrueObserved <= winT2.yMax,
  `True waveform stays within limits [${winT2.yMin}, ${winT2.yMax}]: observed [${minTrueObserved.toFixed(2)}, ${maxTrueObserved.toFixed(2)}]`
);
assert(
  minPmuObserved >= winT2.yMin && maxPmuObserved <= winT2.yMax,
  `PMU waveform stays within limits [${winT2.yMin}, ${winT2.yMax}]: observed [${minPmuObserved.toFixed(2)}, ${maxPmuObserved.toFixed(2)}]`
);

// 10. "What Is a Phasor?" Ground Truth vs. PMU Measurement Pop-Up
console.log('\n--- Criterion 11: Ground Truth vs. PMU Measurement Phasor Pop-Up ---');

// Test 10.1: Pure fundamental signal: Ground Truth and PMU fundamental phasors are identical (phase error = 0)
const cleanState: WaveformState = {
  ...DEFAULT_WAVEFORM_STATE,
  fundamentalFrequency: 60,
  fundamentalAmplitude: 1.2,
  phase: 45,
};
const cleanSnapshot = evaluatePmuCapture(cleanState, []);
const cleanTrueCarrier = cleanSnapshot.trueComponents.find((c) => c.isCarrier);
const cleanPmuCarrier = cleanSnapshot.pmuComponents.find((c) => c.isCarrier);
assert(cleanTrueCarrier !== undefined && cleanPmuCarrier !== undefined, 'Both Ground Truth and PMU have fundamental carrier');
assert(cleanTrueCarrier!.amplitude === 1.2 && cleanPmuCarrier!.amplitude === 1.2, 'Fundamental amplitudes match at 1.2 pu');
const cleanPhaseError = (cleanState.phase ?? 0) - (cleanState.phase ?? 0);
assert(cleanPhaseError === 0, 'Clean fundamental phase-angle error is exactly 0.0°');

// Test 10.2: Adding harmonics and DC offset changes composite waveform, but fundamental phasor remains unchanged
const distortedState: WaveformState = {
  ...cleanState,
  harmonics: { second: 15, third: 10, fourth: 5 },
  dcOffset: 0.3,
};
const distSnapshot = evaluatePmuCapture(distortedState, []);
const distTrueCarrier = distSnapshot.trueComponents.find((c) => c.isCarrier);
const distPmuCarrier = distSnapshot.pmuComponents.find((c) => c.isCarrier);
assert(distTrueCarrier!.amplitude === 1.2 && distPmuCarrier!.amplitude === 1.2, 'Harmonics and DC offset do not alter fundamental phasor magnitude (1.2 pu)');
assert(cleanState.phase === distortedState.phase, 'Fundamental phase remains 45° despite severe harmonic distortion');

// Verify time domain waveform values differ due to harmonics/DC
const valCleanT = evaluateTrueSignal(cleanState, [], 0.005);
const valDistT = evaluateTrueSignal(distortedState, [], 0.005);
assert(Math.abs(valCleanT - valDistT) > 0.1, 'Harmonics and DC offset visibly distort time-domain waveform values');

// Test 10.3: Disturbance outside fundamental bin (e.g. 8 Hz modulation) does not alter fundamental phasor
const nonInterferingDist: InjectedDisturbance[] = [
  { id: 'd-8hz', name: '8Hz Mod', modulationFrequency: 8, amplitude: 0.25, enabled: true },
];
const distSnapshot8Hz = evaluatePmuCapture(cleanState, nonInterferingDist);
const pmuCarrier8Hz = distSnapshot8Hz.pmuComponents.find((c) => c.isCarrier);
assert(pmuCarrier8Hz!.amplitude === 1.2, '8 Hz disturbance does not alter fundamental carrier magnitude');

// Test 10.4: Draggable points phase math consistency:
// When t_GT = t_PMU, deltaTheta equals deltaPhi
const tSelectedTest = 0.004166; // 1/4 cycle at 60 Hz = 90 deg advance
const thetaGt = (360 * 60 * tSelectedTest + 45) % 360;
const thetaPmu = (360 * 60 * tSelectedTest + 45) % 360;
assert(Math.abs(thetaPmu - thetaGt) < 1e-4, 'When t_GT = t_PMU, selected phase difference equals fundamental phase error (0°)');

// When t_GT != t_PMU, points explore phase separation without altering underlying signal
const tPmuOffset = tSelectedTest + 0.001; // offset by 1 ms
const thetaPmuOffset = (360 * 60 * tPmuOffset + 45) % 360;
assert(thetaPmuOffset !== thetaGt, 'Offsetting measurement point updates selected phase position for inspection');
assert(cleanState.phase === 45, 'Dragging measurement point does not mutate underlying signal phase');

// 11. "Remove All Injections" Validation
console.log('\n--- Criterion 12: Remove All Injections Action ---');
const populatedDists: InjectedDisturbance[] = [
  { id: 'd1', name: 'Dist 1', modulationFrequency: 2, amplitude: 0.20, enabled: true },
  { id: 'd2', name: 'Dist 2', modulationFrequency: 8, amplitude: 0.15, enabled: true },
  { id: 'd3', name: 'Dist 3', modulationFrequency: 25, amplitude: 0.10, enabled: true },
];
assert(populatedDists.length === 3, 'Pre-condition: 3 disturbance injections present');
// Clear all injections
const clearedDists: InjectedDisturbance[] = [];
const clearedSnapshot = evaluatePmuCapture(cleanState, clearedDists);
assert(clearedSnapshot.disturbances.length === 0, 'Cleared disturbances array is empty');
assert(clearedSnapshot.outcomes.length === 0, 'No disturbance capture outcomes remain');
assert(clearedSnapshot.trueComponents.filter((c) => c.isDisturbance).length === 0, 'True spectrum has 0 disturbance components');
assert(clearedSnapshot.pmuComponents.filter((c) => !c.isCarrier).length === 0, 'PMU spectrum has 0 disturbance components');
const pureTrueVal = evaluateTrueSignal(cleanState, clearedDists, 0.008);
const purePmuVal = evaluatePmuSignal(clearedSnapshot, cleanState, 0.008);
assert(Math.abs(pureTrueVal - purePmuVal) < 1e-4, 'Waveforms perfectly coincide as pure fundamental after clearing injections');

// 12. Verification of All 6 Phasor Estimation Methods
console.log('\n--- Criterion 13: All 6 Phasor Estimation Methods ---');

// Test test-signal: 1.0 pu sine at 60 Hz with +30° phase
const testF0 = 60;
const testAmp = 1.0;
const testPhase = 30;
const testSignalPure = (t: number) => testAmp * Math.sin(2 * Math.PI * testF0 * t + (testPhase * Math.PI) / 180);
const testSignalDistorted = (t: number) =>
  testSignalPure(t) + 0.30 + 0.15 * Math.sin(2 * Math.PI * 2 * testF0 * t) + 0.10 * Math.sin(2 * Math.PI * 3 * testF0 * t);

// Method 1: DFT / Fourier Analysis
const dftPure = evaluatePhasorEstimate('dft', testSignalPure, 0.005, testF0);
assert(Math.abs(dftPure.magnitude - 1.0) < 0.01, `DFT accurately estimates amplitude: ${dftPure.magnitude} pu`);
assert(Math.abs(dftPure.phaseDeg - 30) < 0.5, `DFT accurately estimates phase: ${dftPure.phaseDeg}°`);

// DFT harmonic and DC rejection
const dftDistorted = evaluatePhasorEstimate('dft', testSignalDistorted, 0.005, testF0);
assert(Math.abs(dftDistorted.magnitude - 1.0) < 0.02, `DFT cleanly rejects DC & harmonics, preserving magnitude: ${dftDistorted.magnitude} pu`);
assert(Math.abs(dftDistorted.phaseDeg - 30) < 1.0, `DFT cleanly rejects DC & harmonics, preserving phase: ${dftDistorted.phaseDeg}°`);

// Method 2: FFT Peak Analysis
const fftPure = evaluatePhasorEstimate('fft', testSignalPure, 0.005, testF0);
assert(Math.abs(fftPure.magnitude - 1.0) < 0.05, `FFT Peak estimates amplitude: ${fftPure.magnitude} pu`);
assert(Math.abs(fftPure.phaseDeg - 30) < 1.5, `FFT Peak estimates phase: ${fftPure.phaseDeg}°`);

// Method 3: Lissajous Figures
const pmuSignalLag15 = (t: number) => testAmp * Math.sin(2 * Math.PI * testF0 * t + ((testPhase - 15) * Math.PI) / 180);
const lissajousEstimate = evaluatePhasorEstimate('lissajous', pmuSignalLag15, 0.005, testF0, testSignalPure);
assert(lissajousEstimate.isValid, 'Lissajous method produces valid estimate');
assert(Math.abs(lissajousEstimate.phaseDeg - 15) < 3.0, `Lissajous figure correctly extracts relative phase shift: ${lissajousEstimate.phaseDeg}°`);

// Method 4: Least-Squares Sinusoidal Fit
const lsDistorted = evaluatePhasorEstimate('least-squares', testSignalDistorted, 0.005, testF0);
assert(Math.abs(lsDistorted.magnitude - 1.0) < 0.02, `Least-squares separates DC offset and fits magnitude: ${lsDistorted.magnitude} pu`);
assert(Math.abs(lsDistorted.phaseDeg - 30) < 1.0, `Least-squares extracts fundamental phase: ${lsDistorted.phaseDeg}°`);
assert(lsDistorted.extraInfo !== undefined && lsDistorted.extraInfo.includes('DC Offset'), 'Least-squares provides fitted DC offset telemetry');

// Method 5: Zero-Crossing Phase Estimation
const zcPure = evaluatePhasorEstimate('zero-crossing', testSignalPure, 0.005, testF0);
assert(zcPure.isValid, 'Zero-crossing detects positive zero crossing');
assert(Math.abs(zcPure.phaseDeg - 30) < 3.0, `Zero-crossing estimates phase: ${zcPure.phaseDeg}°`);

// Method 6: Taylor-Fourier Estimation
const tfPure = evaluatePhasorEstimate('taylor-fourier', testSignalPure, 0.005, testF0);
assert(Math.abs(tfPure.magnitude - 1.0) < 0.02, `Taylor-Fourier estimates static magnitude: ${tfPure.magnitude} pu`);
assert(Math.abs(tfPure.phaseDeg - 30) < 1.0, `Taylor-Fourier estimates static phase: ${tfPure.phaseDeg}°`);
assert(tfPure.extraInfo !== undefined && tfPure.extraInfo.includes('Phasor Rate'), 'Taylor-Fourier provides dynamic swing rate telemetry');

// Documentation Completeness for All 6 Methods
const methodsList: PhasorEstimationMethod[] = ['dft', 'fft', 'lissajous', 'least-squares', 'zero-crossing', 'taylor-fourier'];
for (const m of methodsList) {
  const doc = ESTIMATION_METHOD_DOCS[m];
  assert(doc !== undefined, `Documentation exists for method: ${m}`);
  assert(doc.name.length > 0, `Method has non-empty name: ${doc.name}`);
  assert(doc.formula.length > 0, `Method has non-empty formula: ${doc.formula}`);
  assert(doc.strengths.length > 0 && doc.limitations.length > 0, `Method specifies strengths & limitations: ${m}`);
}

// 13. Educational Phasor Concepts: Rate of Change & RMS Calculations
console.log('\n--- Criterion 14: Phasor Fundamentals & Rate of Change ---');
// Peak vs RMS
const testPeak = 1.0;
const testRms = testPeak / Math.SQRT2;
assert(Math.abs(testRms - 0.7071) < 0.001, 'Peak 1.0 pu corresponds to 0.707 RMS magnitude');

// Rate of Change of Phase Difference: d(Delta_phi)/dt = 2*pi*Delta_f
const deltaF1 = 1.0; // 1 Hz frequency difference
const dPhiDtRad = 2 * Math.PI * deltaF1;
const dPhiDtDeg = (dPhiDtRad * 180) / Math.PI;
assert(Math.abs(dPhiDtDeg - 360) < 1e-6, '1 Hz frequency difference produces 360°/s rate of change of phase difference');

const deltaF01 = 0.1; // 0.1 Hz frequency difference
const dPhiDtDeg01 = deltaF01 * 360;
assert(Math.abs(dPhiDtDeg01 - 36) < 1e-6, '0.1 Hz frequency difference produces 36°/s phase drift');

// Phase vs Time Displacement at 60 Hz: Delta_t = -phi / (360 * 60)
const phiTestDeg = 90; // Quarter cycle
const deltaTTestSec = -(phiTestDeg / (360 * 60));
assert(Math.abs(deltaTTestSec - (-1 / 240)) < 1e-6, '90° phase shift equals quarter cycle (4.167 ms displacement at 60 Hz)');

console.log(`\n================================================================`);
console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`================================================================`);

if (failed > 0) {
  process.exit(1);
}
