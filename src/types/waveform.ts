export interface HarmonicPercentages {
  second: number; // 0 to 50 (%)
  third: number;  // 0 to 50 (%)
  fourth: number; // 0 to 50 (%)
}

export interface CustomTerm {
  amplitude: number;
  frequency: number;
  phaseRad: number;
}

export type PlaybackMode = 'idle' | 'continuous' | 'single-cycle' | 'ten-cycles';

export interface PlaybackState {
  mode: PlaybackMode;
  isPlaying: boolean;
  currentTime: number; // seconds
  targetCycles: number | null; // e.g. 1 or 10
  cycleProgress: number; // 0 to 1 for cycle-bounded modes
}

export interface WaveformState {
  fundamentalFrequency: number; // Hz (1 to 120)
  fundamentalAmplitude: number; // pu (0 to 2.0)
  harmonics: HarmonicPercentages;
  phase: number;                // degrees (default 0)
  dcOffset: number;             // pu (default 0)
  equation: string;             // string representation
  customTerms: CustomTerm[];    // unmapped terms from equation if any
  playback: PlaybackState;
  visibleCycles?: number;       // Number of visible cycles in time-domain plot (default 3, range 1-100)
}

export interface WaveTelemetry {
  frequency: number; // Hz
  periodMs: number;  // ms
  peakVoltage: number; // pu
  rmsVoltage: number;  // pu
  thdPercent: number;  // Total Harmonic Distortion %
}
