import { WaveformState, HarmonicPercentages, CustomTerm, WaveTelemetry } from '../types/waveform';
import { InjectedDisturbance } from '../types/pmu';

export const DEFAULT_WAVEFORM_STATE: WaveformState = {
  fundamentalFrequency: 60,
  fundamentalAmplitude: 1.0,
  harmonics: {
    second: 0,
    third: 0,
    fourth: 0,
  },
  phase: 0,
  dcOffset: 0,
  equation: 'x(t) = 1.00 sin(2π·60t)',
  customTerms: [],
  visibleCycles: 3,
  playback: {
    mode: 'idle',
    isPlaying: false,
    currentTime: 0,
    targetCycles: null,
    cycleProgress: 0,
  },
};

/**
 * Format the waveform state as a clean mathematical equation string.
 * Example: x(t) = 1.00 sin(2π·60t) + 0.20 sin(2π·120t)
 */
export function formatWaveformEquation(
  fundamentalFrequency: number,
  fundamentalAmplitude: number,
  harmonics: HarmonicPercentages,
  customTerms: CustomTerm[] = [],
  dcOffset: number = 0,
  phaseDeg: number = 0
): string {
  const parts: string[] = [];

  const roundNum = (n: number, decimals: number = 2): string => {
    return n.toFixed(decimals);
  };

  const f0 = Math.round(fundamentalFrequency * 100) / 100;
  const a1 = fundamentalAmplitude;

  // Fundamental term
  if (a1 !== 0 || (harmonics.second === 0 && harmonics.third === 0 && harmonics.fourth === 0 && customTerms.length === 0)) {
    const fStr = f0 === Math.floor(f0) ? f0.toString() : f0.toFixed(1);
    const phaseStr = phaseDeg !== 0 ? ` + ${(phaseDeg > 0 ? '+' : '')}${phaseDeg}°` : '';
    parts.push(`${roundNum(a1)} sin(2π·${fStr}t${phaseStr})`);
  }

  // Harmonic terms
  const harmonicSpecs: Array<{ mult: number; pct: number }> = [
    { mult: 2, pct: harmonics.second },
    { mult: 3, pct: harmonics.third },
    { mult: 4, pct: harmonics.fourth },
  ];

  for (const { mult, pct } of harmonicSpecs) {
    if (pct > 0 && a1 > 0) {
      const harmAmp = a1 * (pct / 100);
      const harmFreq = Math.round(f0 * mult * 100) / 100;
      const fStr = harmFreq === Math.floor(harmFreq) ? harmFreq.toString() : harmFreq.toFixed(1);
      parts.push(`${roundNum(harmAmp)} sin(2π·${fStr}t)`);
    }
  }

  // Unmapped custom terms from parsed equations (if any)
  for (const term of customTerms) {
    if (Math.abs(term.amplitude) < 0.0001) continue;
    const termFreq = Math.round(term.frequency * 100) / 100;
    const fStr = termFreq === Math.floor(termFreq) ? termFreq.toString() : termFreq.toFixed(1);
    const termPhaseDeg = Math.round(((term.phaseRad || 0) * 180) / Math.PI);
    const phaseStr = termPhaseDeg !== 0 ? ` + ${termPhaseDeg > 0 ? '+' : ''}${termPhaseDeg}°` : '';
    parts.push(`${roundNum(term.amplitude)} sin(2π·${fStr}t${phaseStr})`);
  }

  // DC offset (if any)
  if (Math.abs(dcOffset) > 0.001) {
    const sign = dcOffset > 0 ? '+' : '-';
    parts.push(`${sign} ${roundNum(Math.abs(dcOffset))}`);
  }

  if (parts.length === 0) {
    return 'x(t) = 0';
  }

  return `x(t) = ${parts.join(' + ').replace(/\+\s*\-\s*/g, '- ')}`;
}

/**
 * Format the true electrical signal equation on the PMU tab including fundamental,
 * harmonics, custom terms, active injected disturbance sinusoids, and DC offset.
 * Example: v(t) = 1.00 sin(2π·60t) + 0.30 sin(2π·70t)
 */
export function formatPmuCompositeEquation(
  state: WaveformState,
  disturbances: InjectedDisturbance[] = []
): string {
  const parts: string[] = [];

  const roundNum = (n: number, decimals: number = 2): string => {
    return n.toFixed(decimals);
  };

  const f0 = Math.round((state.fundamentalFrequency || 60) * 100) / 100;
  const a1 = state.fundamentalAmplitude;
  const phaseDeg = state.phase || 0;

  // 1. Fundamental term
  if (
    a1 !== 0 ||
    (!state.harmonics && (!state.customTerms || state.customTerms.length === 0) && disturbances.length === 0)
  ) {
    const fStr = f0 === Math.floor(f0) ? f0.toString() : f0.toFixed(1);
    const phaseStr = phaseDeg !== 0 ? ` + ${(phaseDeg > 0 ? '+' : '')}${phaseDeg}°` : '';
    parts.push(`${roundNum(a1)} sin(2π·${fStr}t${phaseStr})`);
  }

  // 2. Harmonics
  const harmonics = state.harmonics || { second: 0, third: 0, fourth: 0 };
  const harmonicSpecs: Array<{ mult: number; pct: number }> = [
    { mult: 2, pct: harmonics.second },
    { mult: 3, pct: harmonics.third },
    { mult: 4, pct: harmonics.fourth },
  ];
  for (const { mult, pct } of harmonicSpecs) {
    if (pct > 0 && a1 > 0) {
      const harmAmp = a1 * (pct / 100);
      const harmFreq = Math.round(f0 * mult * 100) / 100;
      const fStr = harmFreq === Math.floor(harmFreq) ? harmFreq.toString() : harmFreq.toFixed(1);
      parts.push(`${roundNum(harmAmp)} sin(2π·${fStr}t)`);
    }
  }

  // 3. Custom terms from previous equation edits
  for (const term of state.customTerms || []) {
    if (Math.abs(term.amplitude) < 0.0001) continue;
    const termFreq = Math.round(term.frequency * 100) / 100;
    const fStr = termFreq === Math.floor(termFreq) ? termFreq.toString() : termFreq.toFixed(1);
    const termPhaseDeg = Math.round(((term.phaseRad || 0) * 180) / Math.PI);
    const phaseStr = termPhaseDeg !== 0 ? ` + ${(termPhaseDeg > 0 ? '+' : '')}${termPhaseDeg}°` : '';
    parts.push(`${roundNum(term.amplitude)} sin(2π·${fStr}t${phaseStr})`);
  }

  // 4. Active Injected Disturbances
  const activeDist = disturbances.filter((d) => d.enabled && d.amplitude > 0);
  for (const dist of activeDist) {
    const fm = dist.modulationFrequency;
    const amp = dist.amplitude;
    const isAdditive = dist.type === 'additive';
    const additiveTarget = dist.additiveTarget || 'lower';
    const phaseStr = phaseDeg !== 0 ? ` + ${(phaseDeg > 0 ? '+' : '')}${phaseDeg}°` : '';

    if (isAdditive) {
      const fTone = additiveTarget === 'upper'
        ? Math.round((f0 + fm) * 10) / 10
        : Math.max(0.1, Math.round((f0 - fm) * 10) / 10);
      const fStr = fTone === Math.floor(fTone) ? fTone.toString() : fTone.toFixed(1);
      parts.push(`${roundNum(amp)} sin(2π·${fStr}t${phaseStr})`);
    } else {
      // AM produces lower and upper sidebands
      const fLower = Math.max(0.1, Math.round((f0 - fm) * 10) / 10);
      const fUpper = Math.round((f0 + fm) * 10) / 10;
      const flStr = fLower === Math.floor(fLower) ? fLower.toString() : fLower.toFixed(1);
      const fuStr = fUpper === Math.floor(fUpper) ? fUpper.toString() : fUpper.toFixed(1);
      parts.push(`${roundNum(amp)} sin(2π·${flStr}t${phaseStr})`);
      parts.push(`${roundNum(amp)} sin(2π·${fuStr}t${phaseStr})`);
    }
  }

  // 5. DC offset
  if (Math.abs(state.dcOffset || 0) > 0.001) {
    const sign = (state.dcOffset || 0) > 0 ? '+' : '-';
    parts.push(`${sign} ${roundNum(Math.abs(state.dcOffset || 0))}`);
  }

  if (parts.length === 0) {
    return 'v(t) = 0';
  }

  return `v(t) = ${parts.join(' + ').replace(/\+\s*\-\s*/g, '- ')}`;
}

/**
 * Evaluate the composite waveform at continuous simulation time t.
 */
export function evaluateWaveform(state: WaveformState, t: number): number {
  const f = state.fundamentalFrequency;
  const a1 = state.fundamentalAmplitude;
  const phaseRad = (state.phase * Math.PI) / 180;

  // 1. Fundamental
  let y = a1 * Math.sin(2 * Math.PI * f * t + phaseRad);

  // 2. 2nd Harmonic
  const harmonics = state.harmonics || { second: 0, third: 0, fourth: 0 };
  if (harmonics.second > 0) {
    const a2 = a1 * (harmonics.second / 100);
    y += a2 * Math.sin(2 * Math.PI * (2 * f) * t + 2 * phaseRad);
  }

  // 3. 3rd Harmonic
  if (harmonics.third > 0) {
    const a3 = a1 * (harmonics.third / 100);
    y += a3 * Math.sin(2 * Math.PI * (3 * f) * t + 3 * phaseRad);
  }

  // 4. 4th Harmonic
  if (harmonics.fourth > 0) {
    const a4 = a1 * (harmonics.fourth / 100);
    y += a4 * Math.sin(2 * Math.PI * (4 * f) * t + 4 * phaseRad);
  }

  // 5. Custom terms if parsed from equation
  for (const term of (state.customTerms || [])) {
    y += term.amplitude * Math.sin(2 * Math.PI * term.frequency * t + term.phaseRad);
  }

  // 6. DC offset
  y += state.dcOffset || 0;

  return y;
}

/**
 * Compute key technical telemetry for the waveform.
 */
export function computeTelemetry(state: WaveformState): WaveTelemetry {
  const f = state.fundamentalFrequency;
  const periodMs = f > 0 ? (1 / f) * 1000 : 0;
  const a1 = state.fundamentalAmplitude;
  
  // Harmonics amplitudes
  const harmonics = state.harmonics || { second: 0, third: 0, fourth: 0 };
  const a2 = a1 * (harmonics.second / 100);
  const a3 = a1 * (harmonics.third / 100);
  const a4 = a1 * (harmonics.fourth / 100);

  // Sample one full cycle to find true peak and RMS
  const samples = 200;
  let maxAbs = 0;
  let sumSquares = 0;
  const T = f > 0 ? 1 / f : 1;

  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * T;
    const v = evaluateWaveform(state, t);
    const absV = Math.abs(v);
    if (absV > maxAbs) maxAbs = absV;
    sumSquares += v * v;
  }

  const rms = Math.sqrt(sumSquares / samples);

  // Total Harmonic & Custom Distortion (THD)
  const harmonicSumSq = a2 * a2 + a3 * a3 + a4 * a4;
  const customSumSq = (state.customTerms || []).reduce(
    (acc, t) => acc + t.amplitude * t.amplitude,
    0
  );
  const thd = a1 > 0 ? (Math.sqrt(harmonicSumSq + customSumSq) / a1) * 100 : 0;

  return {
    frequency: f,
    periodMs,
    peakVoltage: maxAbs,
    rmsVoltage: rms,
    thdPercent: thd,
  };
}
