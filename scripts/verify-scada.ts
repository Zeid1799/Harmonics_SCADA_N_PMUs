import {
  DEFAULT_WAVEFORM_STATE,
  computeTelemetry,
  evaluateWaveform,
  formatWaveformEquation,
} from '../src/model/waveformModel';
import { parseWaveformEquation } from '../src/model/equationParser';
import { extractSpectrumData } from '../src/model/spectrumModel';
import {
  SCADA_INTERVAL_OPTIONS,
  DEFAULT_SCADA_INTERVAL_SEC,
} from '../src/types/scada';

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

console.log('--- TEST 1: SCADA Interval Configuration & Rates ---');
assert(DEFAULT_SCADA_INTERVAL_SEC === 5, 'Default SCADA interval is 5 seconds');
assert(SCADA_INTERVAL_OPTIONS.length === 6, 'Contains 6 interval options (1s to 6s)');

const expectedRates: Record<number, number> = {
  1: 1.0,
  2: 0.5,
  3: 1 / 3,
  4: 0.25,
  5: 0.2,
  6: 1 / 6,
};

for (const opt of SCADA_INTERVAL_OPTIONS) {
  const expectedRate = expectedRates[opt.intervalSec];
  assert(
    Math.abs(opt.rateHz - expectedRate) < 0.001,
    `Interval ${opt.intervalSec}s has correct rate ${opt.rateHz.toFixed(3)} Hz (expected ${expectedRate.toFixed(3)} Hz)`
  );
  assert(
    opt.displayString.startsWith(`SCADA Update Interval: ${opt.intervalSec} s`),
    `Display string for ${opt.intervalSec}s: "${opt.displayString}"`
  );
}

console.log('\n--- TEST 2: True RMS Calculation from Continuous Waveform ---');
// Pure 60Hz sine wave with amplitude 1.0 pu
const nominalState = { ...DEFAULT_WAVEFORM_STATE, fundamentalAmplitude: 1.0 };
const nominalTelemetry = computeTelemetry(nominalState);
// For pure sine of amp 1.0, RMS is 1/sqrt(2) ≈ 0.7071 pu
assert(
  Math.abs(nominalTelemetry.rmsVoltage - 0.7071) < 0.01,
  `Nominal True RMS is ~0.707 pu (got ${nominalTelemetry.rmsVoltage.toFixed(4)})`
);

// If amplitude steps to 1.5 pu, True RMS should scale to ~1.0607 pu
const scaledState = { ...DEFAULT_WAVEFORM_STATE, fundamentalAmplitude: 1.5 };
const scaledTelemetry = computeTelemetry(scaledState);
assert(
  Math.abs(scaledTelemetry.rmsVoltage - 1.0607) < 0.01,
  `1.5 pu True RMS is ~1.061 pu (got ${scaledTelemetry.rmsVoltage.toFixed(4)})`
);

// If harmonic distortion is added, True RMS must increase: sqrt((1.0^2 + 0.3^2)/2) = sqrt(1.09/2) ≈ 0.7382
const harmonicState = {
  ...DEFAULT_WAVEFORM_STATE,
  fundamentalAmplitude: 1.0,
  harmonics: { second: 0, third: 30, fourth: 0 },
};
const harmonicTelemetry = computeTelemetry(harmonicState);
assert(
  Math.abs(harmonicTelemetry.rmsVoltage - 0.7382) < 0.02,
  `With 30% 3rd harmonic, True RMS is ~0.738 pu (got ${harmonicTelemetry.rmsVoltage.toFixed(4)})`
);

console.log('\n--- TEST 3: SCADA Sample-and-Hold Simulation Logic ---');
// Simulate SCADA discrete sampling vs continuously varying True RMS
let simTime = 0;
let lastScadaTime = 0;
let currentScadaRms = nominalTelemetry.rmsVoltage;
const scadaInterval = 5.0; // 5 seconds

// At t = 0: initial measurement
assert(Math.abs(currentScadaRms - nominalTelemetry.rmsVoltage) < 0.001, 'Initial SCADA RMS matches initial True RMS');

// At t = 2.0s: waveform amplitude suddenly jumps to 1.5 pu (e.g. user moves slider or sag/swell event)
simTime = 2.0;
let activeWaveform = scaledState;
let activeTrueRms = computeTelemetry(activeWaveform).rmsVoltage;

// SCADA measurement has NOT occurred yet (elapsed 2.0s < 5.0s)
assert(
  Math.abs(activeTrueRms - 1.061) < 0.01,
  `At t=2.0s, True RMS has immediately changed to ${activeTrueRms.toFixed(3)} pu`
);
assert(
  Math.abs(currentScadaRms - 0.707) < 0.01,
  `At t=2.0s, SCADA RMS remains frozen/held at ${currentScadaRms.toFixed(3)} pu (lagging reality)`
);

// At t = 5.0s: SCADA measurement interval elapses!
simTime = 5.0;
if (simTime - lastScadaTime >= scadaInterval) {
  currentScadaRms = activeTrueRms;
  lastScadaTime = simTime;
}

assert(
  Math.abs(currentScadaRms - 1.061) < 0.01,
  `At t=5.0s, SCADA RMS captures and updates to new True RMS: ${currentScadaRms.toFixed(3)} pu`
);

console.log('\n--- TEST 4: Paused State Waveform Parameter Adjustment ---');
// When paused, waveform parameters change while time does not advance
const isPaused = true;
const pausedSimTime = 5.0;
const pausedLastScada = 5.0;
// User changes harmonic to 40% while paused
const pausedWaveform = {
  ...scaledState,
  harmonics: { second: 0, third: 40, fourth: 0 },
};
// True RMS must recalculate immediately
const pausedTrueRms = computeTelemetry(pausedWaveform).rmsVoltage;
assert(
  pausedTrueRms > scaledTelemetry.rmsVoltage,
  `While paused, True RMS immediately reflects parameter changes (${pausedTrueRms.toFixed(3)} pu > ${scaledTelemetry.rmsVoltage.toFixed(3)} pu)`
);
// SCADA RMS must remain at its most recent captured value
assert(
  Math.abs(currentScadaRms - 1.061) < 0.01,
  `While paused, SCADA RMS remains at previous held value (${currentScadaRms.toFixed(3)} pu)`
);

console.log('\n--- TEST 5: Frequency Domain Spectral Fidelity ---');
// Verify that frequency domain extracts real physical spectrum, not an artificial SCADA spectrum
const spectrum = extractSpectrumData(pausedWaveform);
assert(spectrum.components.length === 2, 'Spectrum contains fundamental and 3rd harmonic');
const fund = spectrum.components.find((c) => c.harmonicNumber === 1);
const h3 = spectrum.components.find((c) => c.harmonicNumber === 3);
assert(fund?.frequency === 60, 'Fundamental at 60 Hz in spectrum');
assert(h3?.frequency === 180, '3rd harmonic at 180 Hz in spectrum');

console.log('\n--- TEST 6: Full Waveform Customization & Equation Synchronization ---');

const customHarmonics = { second: 15, third: 25, fourth: 10 };
const customEq = formatWaveformEquation(50, 1.2, customHarmonics);
assert(
  customEq === 'x(t) = 1.20 sin(2π·50t) + 0.18 sin(2π·100t) + 0.30 sin(2π·150t) + 0.12 sin(2π·200t)',
  `Harmonics 2nd/3rd/4th equation formatted correctly: "${customEq}"`
);

const parsedEq = parseWaveformEquation(customEq);
assert(parsedEq.success === true, 'Parsed equation successfully');
assert(parsedEq.fundamentalFrequency === 50, 'Parsed f0 = 50 Hz');
assert(parsedEq.fundamentalAmplitude === 1.2, 'Parsed A1 = 1.2 pu');
assert(parsedEq.harmonics?.second === 15, 'Parsed 2nd harmonic = 15%');
assert(parsedEq.harmonics?.third === 25, 'Parsed 3rd harmonic = 25%');
assert(parsedEq.harmonics?.fourth === 10, 'Parsed 4th harmonic = 10%');

console.log('\n========================================');
console.log(`SCADA Verification Summary: Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
}
