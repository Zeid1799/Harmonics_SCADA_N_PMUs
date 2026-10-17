import {
  computeRlcCircuitMetrics,
  generateRlcWaveformPoints,
} from '../src/model/rlcCircuitModel';
import {
  DEFAULT_RLC_CONFIG,
  RlcCircuitConfig,
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
console.log('AC SERIES RLC CIRCUIT ACCEPTANCE TESTS (ZERO-VALUES & VIEWPORT)');
console.log('================================================================\n');

// --- TEST 1: Default Configuration & Initial Values ---
console.log('--- TEST 1: Default Circuit Parameters ---');
assert(DEFAULT_RLC_CONFIG.vSourceRms === 120, 'Default source voltage is 120 V RMS');
assert(DEFAULT_RLC_CONFIG.frequency === 60, 'Default frequency is 60 Hz');
assert(DEFAULT_RLC_CONFIG.resistance === 100, 'Default resistance is 100 Ω');
assert(DEFAULT_RLC_CONFIG.inductanceMh === 100, 'Default inductance is 100 mH');
assert(DEFAULT_RLC_CONFIG.capacitanceUf === 100, 'Default capacitance is 100 µF');

// --- TEST 2: Analytical Calculations at 60 Hz Defaults ---
console.log('\n--- TEST 2: Analytical Calculations at 60 Hz Defaults ---');
const defMetrics = computeRlcCircuitMetrics(DEFAULT_RLC_CONFIG);
assert(approxEqual(defMetrics.omega, 376.991, 0.01), `Angular frequency ω ≈ 376.99 rad/s (${defMetrics.omega.toFixed(2)})`);
assert(approxEqual(defMetrics.xL, 37.699, 0.01), `Inductive reactance X_L ≈ 37.70 Ω (${defMetrics.xL.toFixed(2)} Ω)`);
assert(approxEqual(defMetrics.xC, 26.526, 0.01), `Capacitive reactance X_C ≈ 26.53 Ω (${defMetrics.xC.toFixed(2)} Ω)`);
assert(approxEqual(defMetrics.netReactance, 11.173, 0.02), `Net reactance X_L - X_C ≈ 11.17 Ω (${defMetrics.netReactance.toFixed(2)} Ω)`);
assert(approxEqual(defMetrics.zMagnitude, 100.622, 0.02), `Total impedance |Z| ≈ 100.62 Ω (${defMetrics.zMagnitude.toFixed(2)} Ω)`);
assert(approxEqual(defMetrics.zThetaDeg, 6.375, 0.05), `Impedance angle θ_Z ≈ 6.38° (${defMetrics.zThetaDeg.toFixed(2)}°)`);
assert(approxEqual(defMetrics.iRms, 1.1926, 0.01), `Current I_RMS ≈ 1.193 A (${defMetrics.iRms.toFixed(3)} A)`);
assert(approxEqual(defMetrics.phiIDeg, -6.375, 0.05), `Current phase angle φ_I ≈ -6.38° (${defMetrics.phiIDeg.toFixed(2)}°)`);
assert(approxEqual(defMetrics.vResistorRms, 119.26, 0.1), `Resistor voltage V_R ≈ 119.26 V (${defMetrics.vResistorRms.toFixed(2)} V)`);
assert(approxEqual(defMetrics.vInductorRms, 44.96, 0.1), `Inductor voltage V_L ≈ 44.96 V (${defMetrics.vInductorRms.toFixed(2)} V)`);
assert(approxEqual(defMetrics.vCapacitorRms, 31.63, 0.1), `Capacitor voltage V_C ≈ 31.63 V (${defMetrics.vCapacitorRms.toFixed(2)} V)`);
assert(approxEqual(defMetrics.powerFactor, 0.9938, 0.005), `Power factor ≈ 0.994 (${defMetrics.powerFactor.toFixed(3)})`);
assert(defMetrics.powerFactorType === 'lagging', 'Power factor is lagging because circuit is inductive');
assert(approxEqual(defMetrics.realPowerW, 142.23, 0.5), `Real power P ≈ 142.2 W (${defMetrics.realPowerW.toFixed(1)} W)`);
assert(approxEqual(defMetrics.reactivePowerVar, 15.89, 0.2), `Reactive power Q ≈ 15.89 VAr (${defMetrics.reactivePowerVar.toFixed(1)} VAr)`);

// --- TEST 3: Scalar Sum vs. Phasor Sum ---
console.log('\n--- TEST 3: Scalar Sum vs. Phasor Sum ---');
assert(defMetrics.scalarSumVoltageRms > 120, `Scalar sum of component voltages (${defMetrics.scalarSumVoltageRms.toFixed(1)} V) is strictly greater than source voltage`);
assert(defMetrics.phasorSumError < 1e-10, `Phasor sum error |V_s - (V_R + V_L + V_C)| is effectively zero: ${defMetrics.phasorSumError.toExponential(2)} V`);

// --- TEST 4: Capacitance C = 0 (Open Circuit) ---
console.log('\n--- TEST 4: Capacitance C = 0 (Open Circuit in Series Loop) ---');
const openCConfig: RlcCircuitConfig = {
  ...DEFAULT_RLC_CONFIG,
  capacitanceUf: 0,
};
const openCMetrics = computeRlcCircuitMetrics(openCConfig);
assert(openCMetrics.isOpenCircuit === true, 'C = 0 correctly identified as Open Circuit');
assert(openCMetrics.iRms === 0, 'Steady-state current is exactly zero (0 A) in open circuit');
assert(openCMetrics.vResistorRms === 0, 'Resistor voltage drop is exactly zero in open circuit');
assert(openCMetrics.vInductorRms === 0, 'Inductor voltage drop is exactly zero in open circuit');
assert(openCMetrics.vCapacitorRms === openCConfig.vSourceRms, 'Entire source voltage appears across open capacitor (V_C = V_s)');
assert(!openCMetrics.zDisplay.includes('NaN'), 'zDisplay does not display NaN for open circuit');
assert(!openCMetrics.iDisplay.includes('NaN'), 'iDisplay does not display NaN for open circuit');
assert(openCMetrics.f0Display === 'N/A', 'Resonant frequency is marked N/A when C = 0');
assert(openCMetrics.isResonanceApplicable === false, 'Resonance is not applicable when C = 0');

// --- TEST 5: Inductance L = 0 (Series RC Circuit) ---
console.log('\n--- TEST 5: Inductance L = 0 (Series RC Circuit) ---');
const rcConfig: RlcCircuitConfig = {
  ...DEFAULT_RLC_CONFIG,
  inductanceMh: 0,
};
const rcMetrics = computeRlcCircuitMetrics(rcConfig);
assert(rcMetrics.xL === 0, 'L = 0 produces exactly zero inductive reactance (X_L = 0 Ω)');
assert(rcMetrics.vInductorRms === 0, 'Inductor voltage is exactly zero (V_L = 0 V)');
assert(rcMetrics.behavior === 'capacitive', 'Circuit with L = 0 and C > 0 is capacitive');
assert(rcMetrics.phiIRad > 0, 'Current leads voltage (φ_I > 0) in series RC circuit');
assert(rcMetrics.powerFactorType === 'leading', 'Power factor is leading');
assert(rcMetrics.isResonanceApplicable === false, 'Resonance is not applicable when L = 0');
assert(rcMetrics.f0Display === 'N/A', 'f0Display is N/A when L = 0');

// --- TEST 6: Resistance R = 0 (Lossless Pure Reactive Circuit Away from Resonance) ---
console.log('\n--- TEST 6: Resistance R = 0 (Pure Reactive Circuit Away from Resonance) ---');
const r0Config: RlcCircuitConfig = {
  ...DEFAULT_RLC_CONFIG,
  resistance: 0,
  frequency: 60, // At 60 Hz, X_L ≈ 37.7 Ω, X_C ≈ 26.5 Ω -> Net X ≈ +11.17 Ω
};
const r0Metrics = computeRlcCircuitMetrics(r0Config);
assert(r0Metrics.vResistorRms === 0, 'R = 0 produces exactly zero resistor drop (V_R = 0 V)');
assert(approxEqual(r0Metrics.zMagnitude, 11.173, 0.02), `Impedance magnitude equals net reactance: |Z| = ${r0Metrics.zMagnitude.toFixed(2)} Ω`);
assert(r0Metrics.zThetaDeg === 90, 'Impedance angle is exactly +90.0° for purely inductive circuit');
assert(r0Metrics.phiIDeg === -90, 'Current phase angle is exactly -90.0° (current lags by 90°)');
assert(r0Metrics.powerFactor === 0, 'Power factor is exactly 0.000 for pure reactive circuit');
assert(r0Metrics.powerFactorType === 'lagging', 'Power factor type is lagging');
assert(r0Metrics.realPowerW === 0, 'Active power dissipation is exactly zero (P = 0 W)');
assert(r0Metrics.phasorSumError < 1e-10, 'Phasor sum holds for R = 0 away from resonance');

// --- TEST 7: Resistance R = 0 and Inductance L = 0 (Pure Capacitive Circuit) ---
console.log('\n--- TEST 7: Pure Capacitive Circuit (R = 0, L = 0, C > 0) ---');
const pureCConfig: RlcCircuitConfig = {
  vSourceRms: 120,
  frequency: 60,
  resistance: 0,
  inductanceMh: 0,
  capacitanceUf: 100,
};
const pureCMetrics = computeRlcCircuitMetrics(pureCConfig);
assert(pureCMetrics.xL === 0, 'X_L is zero');
assert(approxEqual(pureCMetrics.xC, 26.526, 0.01), 'X_C is 26.53 Ω');
assert(approxEqual(pureCMetrics.zMagnitude, 26.526, 0.01), '|Z| equals X_C');
assert(pureCMetrics.zThetaDeg === -90, 'Impedance angle is exactly -90°');
assert(pureCMetrics.phiIDeg === 90, 'Current phase angle is exactly +90° (current leads by 90°)');
assert(pureCMetrics.powerFactor === 0, 'Power factor is 0');
assert(pureCMetrics.powerFactorType === 'leading', 'Power factor type is leading');
assert(pureCMetrics.vCapacitorRms === 120, 'Entire source voltage drops across capacitor (V_C = V_s)');
assert(pureCMetrics.vResistorRms === 0, 'V_R is 0');
assert(pureCMetrics.vInductorRms === 0, 'V_L is 0');

// --- TEST 8: Ideal Zero-Impedance Resonance (R = 0, X_L = X_C) ---
console.log('\n--- TEST 8: Ideal Zero-Impedance Resonance (R = 0, X_L = X_C) ---');
const f0 = defMetrics.resonantFrequencyHz!;
const resR0Config: RlcCircuitConfig = {
  ...DEFAULT_RLC_CONFIG,
  resistance: 0,
  frequency: f0,
};
const resR0Metrics = computeRlcCircuitMetrics(resR0Config);
assert(resR0Metrics.isUnboundedCurrent === true, 'Ideal resonance with R = 0 flagged as isUnboundedCurrent');
assert(resR0Metrics.iDisplay === 'Unbounded', 'iDisplay displays "Unbounded" instead of NaN or Infinity');
assert(
  resR0Metrics.statusMessage === 'Ideal zero-impedance resonance: theoretical current is unbounded.',
  `Exact status message matched: "${resR0Metrics.statusMessage}"`
);
assert(!resR0Metrics.zDisplay.includes('NaN'), 'zDisplay does not contain NaN');
assert(!resR0Metrics.iDisplay.includes('NaN'), 'iDisplay does not contain NaN');
assert(!resR0Metrics.pfDisplay.includes('NaN'), 'pfDisplay does not contain NaN');

// --- TEST 9: All Components Zero (R = 0, L = 0, C = 0) ---
console.log('\n--- TEST 9: All Components Zero (R = 0, L = 0, C = 0) ---');
const allZeroNonzeroV: RlcCircuitConfig = {
  vSourceRms: 120,
  frequency: 60,
  resistance: 0,
  inductanceMh: 0,
  capacitanceUf: 0,
};
const allZeroNonzeroVMetrics = computeRlcCircuitMetrics(allZeroNonzeroV);
assert(allZeroNonzeroVMetrics.isUnboundedCurrent === true, 'All zero with V > 0 flagged as unbounded current');
assert(
  allZeroNonzeroVMetrics.statusMessage === 'Ideal zero-impedance short circuit: theoretical current is unbounded.',
  `All zero status message: "${allZeroNonzeroVMetrics.statusMessage}"`
);

const allZeroZeroV: RlcCircuitConfig = {
  vSourceRms: 0,
  frequency: 60,
  resistance: 0,
  inductanceMh: 0,
  capacitanceUf: 0,
};
const allZeroZeroVMetrics = computeRlcCircuitMetrics(allZeroZeroV);
assert(allZeroZeroVMetrics.isIndeterminate === true, 'All zero with V = 0 flagged as indeterminate circuit');
assert(allZeroZeroVMetrics.iDisplay.includes('Indeterminate'), 'iDisplay reports Indeterminate');

// --- TEST 10: Instantaneous KVL Across All Circuit Regimes ---
console.log('\n--- TEST 10: Instantaneous KVL Across All Waveform Points ---');
const testConfigs = [
  DEFAULT_RLC_CONFIG,
  rcConfig,
  openCConfig,
  pureCConfig,
  r0Config,
];

for (const cfg of testConfigs) {
  const { points } = generateRlcWaveformPoints(cfg, 0.02, 3, 100);
  let maxError = 0;
  for (const pt of points) {
    const sum = pt.vResistor + pt.vInductor + pt.vCapacitor;
    const err = Math.abs(pt.vSource - sum);
    if (err > maxError) maxError = err;
  }
  assert(maxError < 1e-10, `KVL holds for config (R=${cfg.resistance}, L=${cfg.inductanceMh}, C=${cfg.capacitanceUf}) with max error ${maxError.toExponential(2)} V`);
}

// --- SUMMARY ---
console.log('\n================================================================');
console.log(`TOTAL RLC ACCEPTANCE TESTS: Passed: ${passed}, Failed: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
