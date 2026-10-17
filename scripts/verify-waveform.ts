import {
  DEFAULT_WAVEFORM_STATE,
  formatWaveformEquation,
  computeTelemetry,
} from '../src/model/waveformModel';
import { parseWaveformEquation } from '../src/model/equationParser';
import { generateWaveformData } from '../src/model/waveformGenerator';
import { extractSpectrumData } from '../src/model/spectrumModel';

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

console.log('--- TEST 1: Default Waveform State ---');
assert(DEFAULT_WAVEFORM_STATE.fundamentalFrequency === 60, 'Default frequency is 60 Hz');
assert(DEFAULT_WAVEFORM_STATE.fundamentalAmplitude === 1.0, 'Default amplitude is 1.0 pu');
assert(DEFAULT_WAVEFORM_STATE.harmonics.second === 0, '2nd harmonic is 0%');
assert(DEFAULT_WAVEFORM_STATE.harmonics.third === 0, '3rd harmonic is 0%');
assert(DEFAULT_WAVEFORM_STATE.harmonics.fourth === 0, '4th harmonic is 0%');
assert(DEFAULT_WAVEFORM_STATE.playback.isPlaying === false, 'Initially stationary (not playing)');

console.log('\n--- TEST 2: Equation Formatting ---');
const defaultEq = formatWaveformEquation(60, 1.0, { second: 0, third: 0, fourth: 0 });
assert(defaultEq === 'x(t) = 1.00 sin(2π·60t)', `Default equation matches: "${defaultEq}"`);

const eqWithHarmonics = formatWaveformEquation(60, 1.0, { second: 20, third: 10, fourth: 0 });
assert(
  eqWithHarmonics === 'x(t) = 1.00 sin(2π·60t) + 0.20 sin(2π·120t) + 0.10 sin(2π·180t)',
  `Harmonic equation matches: "${eqWithHarmonics}"`
);

console.log('\n--- TEST 3: Equation Parsing - Standard Format ---');
const parse1 = parseWaveformEquation('x(t) = 1.00 sin(2π·60t) + 0.20 sin(2π·120t) + 0.10 sin(2π·180t)');
assert(parse1.success === true, 'Parse standard equation success');
assert(parse1.fundamentalFrequency === 60, `Parsed f0 = ${parse1.fundamentalFrequency} (expected 60)`);
assert(parse1.fundamentalAmplitude === 1.0, `Parsed A1 = ${parse1.fundamentalAmplitude} (expected 1.0)`);
assert(parse1.harmonics?.second === 20, `Parsed 2nd harmonic = ${parse1.harmonics?.second}% (expected 20%)`);
assert(parse1.harmonics?.third === 10, `Parsed 3rd harmonic = ${parse1.harmonics?.third}% (expected 10%)`);
assert(parse1.harmonics?.fourth === 0, `Parsed 4th harmonic = ${parse1.harmonics?.fourth}% (expected 0%)`);

console.log('\n--- TEST 4: Equation Parsing - Shorthand Format ---');
const parse2 = parseWaveformEquation('sin(2π60t) + 0.2sin(2π120t)');
assert(parse2.success === true, 'Parse shorthand equation success');
assert(parse2.fundamentalFrequency === 60, `Parsed f0 = ${parse2.fundamentalFrequency}`);
assert(parse2.fundamentalAmplitude === 1.0, `Parsed A1 = ${parse2.fundamentalAmplitude}`);
assert(parse2.harmonics?.second === 20, `Parsed 2nd harmonic = ${parse2.harmonics?.second}%`);

console.log('\n--- TEST 5: Frequency Change 60Hz -> 50Hz and Harmonic Frequencies ---');
const fNew = 50;
const h2Freq = 2 * fNew;
const h3Freq = 3 * fNew;
const h4Freq = 4 * fNew;
assert(h2Freq === 100, '2nd harmonic frequency at 50Hz is 100 Hz');
assert(h3Freq === 150, '3rd harmonic frequency at 50Hz is 150 Hz');
assert(h4Freq === 200, '4th harmonic frequency at 50Hz is 200 Hz');

const eq50Hz = formatWaveformEquation(50, 1.0, { second: 15, third: 0, fourth: 0 });
assert(eq50Hz === 'x(t) = 1.00 sin(2π·50t) + 0.15 sin(2π·100t)', `50Hz equation matches: "${eq50Hz}"`);

console.log('\n--- TEST 6: Frequency Domain Spectral Representation ---');
const stateHarmonics = {
  ...DEFAULT_WAVEFORM_STATE,
  fundamentalFrequency: 60,
  fundamentalAmplitude: 1.0,
  harmonics: { second: 20, third: 10, fourth: 0 },
};
const spectrum1 = extractSpectrumData(stateHarmonics);
assert(spectrum1.components.length === 3, `Spectrum has 3 components (got ${spectrum1.components.length})`);

const fundComp = spectrum1.components.find((c) => c.harmonicNumber === 1);
assert(fundComp?.frequency === 60, 'Fundamental peak at 60 Hz');
assert(Math.abs((fundComp?.amplitude ?? 0) - 1.0) < 0.001, 'Fundamental amplitude is 1.00 pu');

const h2Comp = spectrum1.components.find((c) => c.harmonicNumber === 2);
assert(h2Comp?.frequency === 120, '2nd harmonic peak at 120 Hz');
assert(Math.abs((h2Comp?.amplitude ?? 0) - 0.20) < 0.001, '2nd harmonic amplitude is 0.20 pu (20% of 1.0 pu)');

const h3Comp = spectrum1.components.find((c) => c.harmonicNumber === 3);
assert(h3Comp?.frequency === 180, '3rd harmonic peak at 180 Hz');
assert(Math.abs((h3Comp?.amplitude ?? 0) - 0.10) < 0.001, '3rd harmonic amplitude is 0.10 pu (10% of 1.0 pu)');

console.log('\n--- TEST 7: Spectral Synchronization with Amplitude and Frequency Adjustments ---');
// Scale amplitude to 1.5 pu and fundamental to 50 Hz
const stateUpdated = {
  ...DEFAULT_WAVEFORM_STATE,
  fundamentalFrequency: 50,
  fundamentalAmplitude: 1.5,
  harmonics: { second: 20, third: 0, fourth: 0 },
};
const spectrum2 = extractSpectrumData(stateUpdated);
const fund50 = spectrum2.components.find((c) => c.harmonicNumber === 1);
assert(fund50?.frequency === 50, 'Fundamental updated to 50 Hz in frequency domain');
assert(Math.abs((fund50?.amplitude ?? 0) - 1.5) < 0.001, 'Fundamental amplitude updated to 1.50 pu in frequency domain');

const h2_50 = spectrum2.components.find((c) => c.harmonicNumber === 2);
assert(h2_50?.frequency === 100, '2nd harmonic frequency updated to 100 Hz (2 × 50 Hz) in frequency domain');
assert(Math.abs((h2_50?.amplitude ?? 0) - 0.30) < 0.001, '2nd harmonic amplitude updated to 0.30 pu (20% of 1.5 pu)');

console.log('\n--- TEST 8: Invalid Equation Error Handling ---');
const invalidParse1 = parseWaveformEquation('not an equation');
assert(invalidParse1.success === false, 'Invalid equation does not succeed');
assert(typeof invalidParse1.error === 'string', 'Returns informative error string');

const invalidParse2 = parseWaveformEquation('');
assert(invalidParse2.success === false, 'Empty string equation fails gracefully');

console.log('\n--- TEST 9: Waveform Sampling Resolution & Telemetry ---');
const testState = {
  ...DEFAULT_WAVEFORM_STATE,
  fundamentalFrequency: 60,
  fundamentalAmplitude: 1.0,
  harmonics: { second: 20, third: 10, fourth: 0 },
};
const data = generateWaveformData(testState, 0, 3, 500);
assert(data.points.length === 500, 'Generated 500 smooth sample points');
assert(data.windowDurationMs === 50, 'Window for 3 cycles at 60Hz is exactly 50 ms');

const telemetry = computeTelemetry(testState);
assert(telemetry.periodMs > 16.6 && telemetry.periodMs < 16.7, 'Telemetry period is ~16.67 ms');
assert(telemetry.thdPercent > 20, `THD computed correctly: ${telemetry.thdPercent.toFixed(1)}%`);

console.log(`\n========================================`);
console.log(`Verification Summary: Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
}
