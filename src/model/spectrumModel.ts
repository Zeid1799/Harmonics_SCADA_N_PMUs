import { WaveformState, CustomTerm } from '../types/waveform';

export interface SpectralComponent {
  frequency: number; // Hz
  amplitude: number; // pu
  phaseDeg: number;
  label: string;
  harmonicNumber: number; // 0 = DC, 1 = fundamental, 2, 3, 4, etc.
  color: string;
}

export interface SpectrumData {
  components: SpectralComponent[];
  maxFrequency: number; // Hz (axis range)
  maxAmplitude: number; // pu
  fundamentalFrequency: number;
  fundamentalAmplitude: number;
  thdPercent: number;
}

/**
 * Extracts the exact discrete Fourier spectral components from the canonical waveform state.
 * Any change to fundamental frequency, amplitude, harmonics, or equation immediately reflects here.
 */
export function extractSpectrumData(state: WaveformState): SpectrumData {
  const f0 = Math.max(1, state.fundamentalFrequency);
  const a1 = Math.max(0, state.fundamentalAmplitude);
  const components: SpectralComponent[] = [];

  // 1. DC Offset (0 Hz)
  if (Math.abs(state.dcOffset) > 0.001) {
    components.push({
      frequency: 0,
      amplitude: Math.abs(state.dcOffset),
      phaseDeg: state.dcOffset >= 0 ? 0 : 180,
      label: 'DC',
      harmonicNumber: 0,
      color: '#94a3b8',
    });
  }

  // 2. Fundamental (f0)
  if (a1 > 0) {
    components.push({
      frequency: f0,
      amplitude: a1,
      phaseDeg: state.phase,
      label: 'f₀ (1st)',
      harmonicNumber: 1,
      color: '#00f0ff',
    });
  }

  // 3. 2nd Harmonic (2 * f0)
  const harmonics = state.harmonics || { second: 0, third: 0, fourth: 0 };
  if (harmonics.second > 0 && a1 > 0) {
    const a2 = a1 * (harmonics.second / 100);
    components.push({
      frequency: 2 * f0,
      amplitude: a2,
      phaseDeg: (state.phase * 2) % 360,
      label: '2f₀ (2nd)',
      harmonicNumber: 2,
      color: '#a855f7',
    });
  }

  // 4. 3rd Harmonic (3 * f0)
  if (harmonics.third > 0 && a1 > 0) {
    const a3 = a1 * (harmonics.third / 100);
    components.push({
      frequency: 3 * f0,
      amplitude: a3,
      phaseDeg: (state.phase * 3) % 360,
      label: '3f₀ (3rd)',
      harmonicNumber: 3,
      color: '#ec4899',
    });
  }

  // 5. 4th Harmonic (4 * f0)
  if (harmonics.fourth > 0 && a1 > 0) {
    const a4 = a1 * (harmonics.fourth / 100);
    components.push({
      frequency: 4 * f0,
      amplitude: a4,
      phaseDeg: (state.phase * 4) % 360,
      label: '4f₀ (4th)',
      harmonicNumber: 4,
      color: '#f59e0b',
    });
  }

  // 6. Custom unmapped terms (e.g. 5th harmonic or arbitrary frequency)
  (state.customTerms || []).forEach((term: CustomTerm) => {
    const harmNum = Math.round(term.frequency / f0);
    const label = Math.abs(term.frequency - harmNum * f0) < 0.5
      ? `${harmNum}f₀`
      : `${term.frequency.toFixed(0)}Hz`;
    components.push({
      frequency: term.frequency,
      amplitude: term.amplitude,
      phaseDeg: Math.round((term.phaseRad * 180) / Math.PI),
      label: `${label} (custom)`,
      harmonicNumber: harmNum,
      color: '#34d399',
    });
  });

  // Sort components by frequency ascending
  components.sort((a, b) => a.frequency - b.frequency);

  // Compute THD %
  const harmonicAmps = components.filter((c) => c.harmonicNumber > 1).map((c) => c.amplitude);
  const harmonicSumSq = harmonicAmps.reduce((acc, amp) => acc + amp * amp, 0);
  const thdPercent = a1 > 0 ? (Math.sqrt(harmonicSumSq) / a1) * 100 : 0;

  // Maximum frequency to scale the horizontal axis
  // Minimum axis span of at least 4.5 * f0 or 300 Hz
  const highestFreq = components.reduce((max, c) => Math.max(max, c.frequency), 4 * f0);
  const axisFreq = Math.max(highestFreq * 1.2, 100);

  // Round max frequency to clean intervals (e.g. 100, 200, 300, 400, 500 Hz)
  const maxFrequency = Math.ceil(axisFreq / 50) * 50;

  return {
    components,
    maxFrequency,
    maxAmplitude: 2.2, // Same vertical scale as time domain
    fundamentalFrequency: f0,
    fundamentalAmplitude: a1,
    thdPercent,
  };
}
