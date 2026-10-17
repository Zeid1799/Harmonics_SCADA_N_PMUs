import { DEFAULT_WAVEFORM_STATE } from '../src/model/waveformModel';
import { generateWaveformData } from '../src/model/waveformGenerator';
import { generatePmuTimeDomainData, DEFAULT_PMU_SETTINGS, evaluatePmuCapture } from '../src/model/pmuModel';
import { parseWaveformEquation, replacePiWithSymbol } from '../src/model/equationParser';

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

console.log('=== TEST SUITE 1: Waveform Window Math & Calculations ===');
// 60 Hz system
const f0_60 = 60;
assert(Math.abs((1 / f0_60) * 1000 - 16.6666) < 0.01, '60 Hz 1 cycle is ~16.67 ms');
assert(Math.abs((3 / f0_60) * 1000 - 50.0) < 0.01, '60 Hz 3 cycles is 50.0 ms');
assert(Math.abs((10 / f0_60) * 1000 - 166.6666) < 0.01, '60 Hz 10 cycles is ~166.67 ms');
assert(Math.abs((100 / f0_60) * 1000 - 1666.6666) < 0.01, '60 Hz 100 cycles is ~1666.67 ms');

// 50 Hz system
const f0_50 = 50;
assert(Math.abs((1 / f0_50) * 1000 - 20.0) < 0.01, '50 Hz 1 cycle is 20.0 ms');
assert(Math.abs((3 / f0_50) * 1000 - 60.0) < 0.01, '50 Hz 3 cycles is 60.0 ms');
assert(Math.abs((10 / f0_50) * 1000 - 200.0) < 0.01, '50 Hz 10 cycles is 200.0 ms');
assert(Math.abs((100 / f0_50) * 1000 - 2000.0) < 0.01, '50 Hz 100 cycles is 2000.0 ms');

console.log('\n=== TEST SUITE 2: Default Waveform State & Cycle Initialization ===');
assert(DEFAULT_WAVEFORM_STATE.visibleCycles === 3, 'DEFAULT_WAVEFORM_STATE.visibleCycles defaults to 3');
assert(typeof DEFAULT_WAVEFORM_STATE.visibleCycles === 'number', 'visibleCycles is a valid number');

console.log('\n=== TEST SUITE 3: PMU Time-Domain Sample Generation for Multiple Cycles ===');
const pmuSnapshot = evaluatePmuCapture(
  DEFAULT_WAVEFORM_STATE,
  [],
  DEFAULT_PMU_SETTINGS
);

// Test 1 cycle
const pmu1c = generatePmuTimeDomainData(DEFAULT_WAVEFORM_STATE, pmuSnapshot, [], 0, 1);
assert(Math.abs(pmu1c.windowDurationMs - 16.6666) < 0.05, `PMU 1c window duration: ${pmu1c.windowDurationMs.toFixed(2)} ms`);
assert(pmu1c.points.length >= 800, `PMU 1c points count >= 800 (got ${pmu1c.points.length})`);
assert(!isNaN(pmu1c.points[0].trueY) && !isNaN(pmu1c.points[0].pmuY), 'PMU sample points have valid numeric values');

// Test 3 cycles
const pmu3c = generatePmuTimeDomainData(DEFAULT_WAVEFORM_STATE, pmuSnapshot, [], 0, 3);
assert(Math.abs(pmu3c.windowDurationMs - 50.0) < 0.05, `PMU 3c window duration: ${pmu3c.windowDurationMs.toFixed(2)} ms`);
assert(pmu3c.points.length >= 800, `PMU 3c points count >= 800 (got ${pmu3c.points.length})`);

// Test 10 cycles
const pmu10c = generatePmuTimeDomainData(DEFAULT_WAVEFORM_STATE, pmuSnapshot, [], 0, 10);
assert(Math.abs(pmu10c.windowDurationMs - 166.67) < 0.05, `PMU 10c window duration: ${pmu10c.windowDurationMs.toFixed(2)} ms`);

// Test 100 cycles
const pmu100c = generatePmuTimeDomainData(DEFAULT_WAVEFORM_STATE, pmuSnapshot, [], 0, 100);
assert(Math.abs(pmu100c.windowDurationMs - 1666.67) < 0.1, `PMU 100c window duration: ${pmu100c.windowDurationMs.toFixed(2)} ms`);
assert(pmu100c.points.length <= 4000, `PMU 100c points count clamped to max 4000 (got ${pmu100c.points.length})`);

// Test undefined cyclesToShow fallback
const pmuDef = generatePmuTimeDomainData(DEFAULT_WAVEFORM_STATE, pmuSnapshot, [], 0, undefined);
assert(Math.abs(pmuDef.windowDurationMs - 50.0) < 0.05, `PMU fallback window duration defaults to 50 ms (3c)`);

console.log('\n=== TEST SUITE 4: Wave Generator Time-Domain Generation for Multiple Cycles ===');
const wave1c = generateWaveformData(DEFAULT_WAVEFORM_STATE, 0, 1);
assert(Math.abs(wave1c.windowDurationMs - 16.6666) < 0.05, `Waveform 1c window duration: ${wave1c.windowDurationMs.toFixed(2)} ms`);

const wave10c = generateWaveformData(DEFAULT_WAVEFORM_STATE, 0, 10);
assert(Math.abs(wave10c.windowDurationMs - 166.67) < 0.05, `Waveform 10c window duration: ${wave10c.windowDurationMs.toFixed(2)} ms`);

const wave100c = generateWaveformData(DEFAULT_WAVEFORM_STATE, 0, 100);
assert(Math.abs(wave100c.windowDurationMs - 1666.67) < 0.1, `Waveform 100c window duration: ${wave100c.windowDurationMs.toFixed(2)} ms`);

console.log('\n=== TEST SUITE 5: WaveformWindowControl Robust Input Logic Simulation ===');
// Emulate WaveformWindowControl resolution logic
function resolveEffectiveCycles(props: { cycles?: number; visibleCycles?: number; minCycles?: number; maxCycles?: number; defaultCycles?: number }) {
  const safeMin = typeof props.minCycles === 'number' && Number.isFinite(props.minCycles) && props.minCycles >= 1 ? Math.floor(props.minCycles) : 1;
  const safeMax = typeof props.maxCycles === 'number' && Number.isFinite(props.maxCycles) && props.maxCycles >= safeMin ? Math.floor(props.maxCycles) : 100;
  const safeDefault = typeof props.defaultCycles === 'number' && Number.isFinite(props.defaultCycles) && props.defaultCycles >= safeMin && props.defaultCycles <= safeMax
    ? Math.floor(props.defaultCycles)
    : 3;

  const rawCycles = props.cycles !== undefined ? props.cycles : props.visibleCycles;
  const effectiveCycles =
    typeof rawCycles === 'number' && Number.isFinite(rawCycles) && rawCycles > 0
      ? Math.min(safeMax, Math.max(safeMin, Math.round(rawCycles)))
      : safeDefault;

  return { effectiveCycles, strVal: effectiveCycles.toString() };
}

// Case A: cycles is undefined (the exact previous crash condition)
const testCrashCondition = resolveEffectiveCycles({ cycles: undefined });
assert(testCrashCondition.effectiveCycles === 3, 'Undefined cycles resolves to safe default 3');
assert(testCrashCondition.strVal === '3', 'Undefined cycles produces valid string "3" without error');

// Case B: visibleCycles is provided instead of cycles (prop alias support)
const testVisibleCyclesAlias = resolveEffectiveCycles({ visibleCycles: 10 });
assert(testVisibleCyclesAlias.effectiveCycles === 10, 'visibleCycles alias correctly resolves to 10');
assert(testVisibleCyclesAlias.strVal === '10', 'visibleCycles alias produces string "10"');

// Case C: NaN, negative, or 0 values
const testNaN = resolveEffectiveCycles({ cycles: NaN });
assert(testNaN.effectiveCycles === 3, 'NaN cycles resolves to safe default 3');

const testNegative = resolveEffectiveCycles({ cycles: -5 });
assert(testNegative.effectiveCycles === 3, 'Negative cycles resolves to safe default 3');

const testZero = resolveEffectiveCycles({ cycles: 0 });
assert(testZero.effectiveCycles === 3, 'Zero cycles resolves to safe default 3');

// Case D: Clamping
const testClampUpper = resolveEffectiveCycles({ cycles: 999 });
assert(testClampUpper.effectiveCycles === 100, 'Cycles > 100 clamped to 100');

console.log('\n=== TEST SUITE 6: Harmonic Slider Independence & Pi Replacement ===');
// 60 Hz fundamental + 30 Hz subharmonic component
const parsedSubharmonic = parseWaveformEquation('x(t) = 1.00 sin(2π·60t) + 0.10 sin(2π·30t)');
assert(parsedSubharmonic.success === true, 'Subharmonic equation parsed successfully');
assert(parsedSubharmonic.fundamentalFrequency === 60, `Fundamental frequency identified as 60 Hz (got ${parsedSubharmonic.fundamentalFrequency})`);
assert(parsedSubharmonic.harmonics?.second === 0, `2nd harmonic slider remains 0% (got ${parsedSubharmonic.harmonics?.second}%)`);
assert(parsedSubharmonic.harmonics?.third === 0, `3rd harmonic slider remains 0% (got ${parsedSubharmonic.harmonics?.third}%)`);
assert(parsedSubharmonic.customTerms?.length === 1, `Subharmonic 30 Hz stored in customTerms (length=${parsedSubharmonic.customTerms?.length})`);
assert(parsedSubharmonic.customTerms?.[0].frequency === 30, `Custom term frequency is 30 Hz (got ${parsedSubharmonic.customTerms?.[0].frequency})`);

// Auto-replace "pi" with "π"
const piReplaced = replacePiWithSymbol('0.1 sin(2*pi*30t)');
assert(piReplaced.text === '0.1 sin(2*π*30t)', `Auto-replace pi with π works: "${piReplaced.text}"`);
assert(piReplaced.replaced === true, 'replacePiWithSymbol flagged replaced=true');

console.log(`\n================================================================`);
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`================================================================`);

if (failed > 0) {
  process.exit(1);
}
