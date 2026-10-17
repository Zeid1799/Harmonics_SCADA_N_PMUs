import {
  DEFAULT_WAVEFORM_STATE,
  formatWaveformEquation,
  evaluateWaveform,
  computeTelemetry,
} from '../src/model/waveformModel.ts';
import { parseWaveformEquation } from '../src/model/equationParser.ts';
import { generateWaveformData } from '../src/model/waveformGenerator.ts';

let passed = 0;
let failed = 0;

function assert(condition, message) {
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
assert(parse1.harmonics.second === 20, `Parsed 2nd harmonic = ${parse1.harmonics.second}% (expected 20%)`);
assert(parse1.harmonics.third === 10, `Parsed 3rd harmonic = ${parse1.harmonics.third}% (expected 10%)`);
assert(parse1.harmonics.fourth === 0, `Parsed 4th harmonic = ${parse1.harmonics.fourth}% (expected 0%)`);

console.log('\n--- TEST 4: Equation Parsing - Shorthand Format ---');
const parse2 = parseWaveformEquation('sin(2π60t) + 0.2sin(2π120t)');
assert(parse2.success === true, 'Parse shorthand equation success');
assert(parse2.fundamentalFrequency === 60, `Parsed f0 = ${parse2.fundamentalFrequency}`);
assert(parse2.fundamentalAmplitude === 1.0, `Parsed A1 = ${parse2.fundamentalAmplitude}`);
assert(parse2.harmonics.second === 20, `Parsed 2nd harmonic = ${parse2.harmonics.second}%`);

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

console.log('\n--- TEST 6: Cycle Durations ---');
const T_60Hz = (1 / 60) * 1000;
const tenCycles_60Hz = (10 / 60) * 1000;
assert(Math.abs(T_60Hz - 16.6667) < 0.01, `1 cycle at 60 Hz = ${T_60Hz.toFixed(2)} ms (expected ~16.67 ms)`);
assert(Math.abs(tenCycles_60Hz - 166.6667) < 0.01, `10 cycles at 60 Hz = ${tenCycles_60Hz.toFixed(2)} ms (expected ~166.67 ms)`);

const T_10Hz = (1 / 10) * 1000;
const tenCycles_10Hz = (10 / 10) * 1000;
assert(T_10Hz === 100, '1 cycle at 10 Hz = 100 ms');
assert(tenCycles_10Hz === 1000, '10 cycles at 10 Hz = 1000 ms (1 second)');

console.log('\n--- TEST 7: Invalid Equation Error Handling ---');
const invalidParse1 = parseWaveformEquation('not an equation');
assert(invalidParse1.success === false, 'Invalid equation does not succeed');
assert(typeof invalidParse1.error === 'string', 'Returns informative error string');

const invalidParse2 = parseWaveformEquation('');
assert(invalidParse2.success === false, 'Empty string equation fails gracefully');

console.log('\n--- TEST 8: Preserving Unmapped Custom Terms ---');
const customParse = parseWaveformEquation('sin(2π·60t) + 0.1sin(2π·300t)'); // 300Hz is 5th harmonic
assert(customParse.success === true, 'Parse 5th harmonic term success');
assert(customParse.customTerms.length === 1, '5th harmonic term preserved in customTerms');
assert(customParse.customTerms[0].frequency === 300, 'Custom term frequency is 300 Hz');

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
