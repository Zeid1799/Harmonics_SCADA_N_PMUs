export type PmuClass = 'P-Class' | 'M-Class';

export type PmuReportingRate = 10 | 12 | 15 | 20 | 30 | 60;

export type ZoneType = 1 | 2 | 3;

export type DisturbanceType = 'am' | 'additive';

/**
 * An oscillatory disturbance injected by the user.
 * Supports:
 * 1. Amplitude Modulation (AM): A modulation applied to the fundamental producing symmetric sidebands at f0 ± fm.
 * 2. Additive Sinusoid: A single independent sinusoidal tone added at f0 ± fm (does not generate two sidebands).
 */
export interface InjectedDisturbance {
  id: string;
  name: string;
  type?: DisturbanceType; // 'am' (default) or 'additive'
  modulationFrequency: number; // fm in Hz (distance/offset from fundamental f0)
  additiveTarget?: 'lower' | 'upper'; // For additive tone: 'lower' (f0 - fm, e.g. 55 Hz) or 'upper' (f0 + fm, e.g. 65 Hz)
  amplitude: number; // A in pu
  enabled: boolean;
  color?: string; // Stable color identifier from DISTURBANCE_PALETTE
}

/**
 * Visual styling definition for an injected disturbance.
 */
export interface DisturbanceColor {
  id: string;
  name: string;
  dark: string;
  light: string;
  badgeBgDark: string;
  badgeBgLight: string;
  badgeBorderDark: string;
  badgeBorderLight: string;
}

export const DISTURBANCE_PALETTE: DisturbanceColor[] = [
  {
    id: 'amber',
    name: 'Amber',
    dark: '#f59e0b',
    light: '#d97706',
    badgeBgDark: 'rgba(245, 158, 11, 0.15)',
    badgeBgLight: 'rgba(217, 119, 6, 0.12)',
    badgeBorderDark: 'rgba(245, 158, 11, 0.45)',
    badgeBorderLight: 'rgba(217, 119, 6, 0.40)',
  },
  {
    id: 'purple',
    name: 'Purple',
    dark: '#a855f7',
    light: '#7e22ce',
    badgeBgDark: 'rgba(168, 85, 247, 0.15)',
    badgeBgLight: 'rgba(126, 34, 206, 0.12)',
    badgeBorderDark: 'rgba(168, 85, 247, 0.45)',
    badgeBorderLight: 'rgba(126, 34, 206, 0.40)',
  },
  {
    id: 'rose',
    name: 'Rose',
    dark: '#f43f5e',
    light: '#e11d48',
    badgeBgDark: 'rgba(244, 63, 94, 0.15)',
    badgeBgLight: 'rgba(225, 29, 72, 0.12)',
    badgeBorderDark: 'rgba(244, 63, 94, 0.45)',
    badgeBorderLight: 'rgba(225, 29, 72, 0.40)',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    dark: '#10b981',
    light: '#047857',
    badgeBgDark: 'rgba(16, 185, 129, 0.15)',
    badgeBgLight: 'rgba(4, 120, 87, 0.12)',
    badgeBorderDark: 'rgba(16, 185, 129, 0.45)',
    badgeBorderLight: 'rgba(4, 120, 87, 0.40)',
  },
  {
    id: 'blue',
    name: 'Blue',
    dark: '#3b82f6',
    light: '#1d4ed8',
    badgeBgDark: 'rgba(59, 130, 246, 0.15)',
    badgeBgLight: 'rgba(29, 78, 216, 0.12)',
    badgeBorderDark: 'rgba(59, 130, 246, 0.45)',
    badgeBorderLight: 'rgba(29, 78, 216, 0.40)',
  },
  {
    id: 'orange',
    name: 'Orange',
    dark: '#f97316',
    light: '#c2410c',
    badgeBgDark: 'rgba(249, 115, 22, 0.15)',
    badgeBgLight: 'rgba(194, 65, 12, 0.12)',
    badgeBorderDark: 'rgba(249, 115, 22, 0.45)',
    badgeBorderLight: 'rgba(194, 65, 12, 0.40)',
  },
  {
    id: 'teal',
    name: 'Teal',
    dark: '#14b8a6',
    light: '#0f766e',
    badgeBgDark: 'rgba(20, 184, 166, 0.15)',
    badgeBgLight: 'rgba(15, 118, 110, 0.12)',
    badgeBorderDark: 'rgba(20, 184, 166, 0.45)',
    badgeBorderLight: 'rgba(15, 118, 110, 0.40)',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    dark: '#818cf8',
    light: '#4338ca',
    badgeBgDark: 'rgba(129, 140, 248, 0.15)',
    badgeBgLight: 'rgba(67, 56, 202, 0.12)',
    badgeBorderDark: 'rgba(129, 140, 248, 0.45)',
    badgeBorderLight: 'rgba(67, 56, 202, 0.40)',
  },
];

export function getDisturbanceColor(distIdOrDist?: InjectedDisturbance | string): DisturbanceColor {
  if (!distIdOrDist) return DISTURBANCE_PALETTE[0];
  const id = typeof distIdOrDist === 'string' ? distIdOrDist : distIdOrDist.id;
  if (typeof distIdOrDist !== 'string' && distIdOrDist.color) {
    const found = DISTURBANCE_PALETTE.find((p) => p.id === distIdOrDist.color);
    if (found) return found;
  }
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return DISTURBANCE_PALETTE[hash % DISTURBANCE_PALETTE.length];
}

/**
 * Configurable probabilities for the Zone 3 stochastic capture model.
 * Evaluated as independent Bernoulli trials for each Zone 3 disturbance.
 */
export interface Zone3Probabilities {
  pMiss: number;  // Probability of missed detection (default 0.35)
  pAlias: number; // Probability of aliasing (default 0.60)
  pAtten: number; // Probability of random attenuation (default 0.50)
}

export const DEFAULT_ZONE3_PROBABILITIES: Zone3Probabilities = {
  pMiss: 0.35,
  pAlias: 0.60,
  pAtten: 0.50,
};

export interface PmuSettings {
  pmuClass: PmuClass;
  reportingRate: PmuReportingRate;
  probabilities: Zone3Probabilities;
  seed?: number; // Optional seed for deterministic reproducibility
}

export const DEFAULT_PMU_SETTINGS: PmuSettings = {
  pmuClass: 'M-Class',
  reportingRate: 30,
  probabilities: DEFAULT_ZONE3_PROBABILITIES,
};

export const DEFAULT_DISTURBANCES: InjectedDisturbance[] = [
  {
    id: 'dist-1',
    name: 'Disturbance 1 (Zone 1 AM)',
    type: 'am',
    modulationFrequency: 3,
    amplitude: 0.20,
    enabled: true,
    color: 'amber',
  },
  {
    id: 'dist-2',
    name: 'Disturbance 2 (Zone 2 Additive 52Hz)',
    type: 'additive',
    additiveTarget: 'lower',
    modulationFrequency: 8,
    amplitude: 0.15,
    enabled: true,
    color: 'purple',
  },
];

/**
 * A captured frequency component in the PMU measurement output.
 */
export interface CapturedPmuComponent {
  id: string;
  disturbanceId: string;
  frequency: number; // Electrical frequency (f0 ± fm or f0 ± f_alias)
  modulationFrequency: number; // Dynamic frequency fm (or f_alias)
  amplitude: number; // Captured amplitude in pu (magnitude >= 0)
  phaseShiftRad: number; // 0 or Math.PI (for phase reversal)
  label: string;
  zone: ZoneType;
  color?: string;
  isCarrier?: boolean;
  isHarmonic?: boolean;
  isAliased?: boolean;
  isAttenuated?: boolean;
  originalModulationFreq?: number;
}

/**
 * Record of the PMU capture outcomes for an individual injected disturbance.
 */
export interface DisturbanceCaptureOutcome {
  disturbanceId: string;
  name: string;
  modulationFrequency: number;
  amplitude: number;
  zone: ZoneType;
  // Zone 3 independent trial outcomes
  missed?: boolean;
  aliased?: boolean;
  attenuated?: boolean;
  aliasedModulationFreq?: number;
  attenuatedAmplitude?: number;
  rawFactor?: number;
  phaseReversed?: boolean;
  statusDescription: string;
  capturedComponents: CapturedPmuComponent[];
}

/**
 * A spectral component in the Ground Truth (True Signal) spectrum.
 */
export interface TrueSpectralComponent {
  frequency: number; // Electrical frequency (e.g. 60 Hz carrier, 60 ± fm sidebands)
  modulationFrequency?: number; // Modulation frequency around f0
  amplitude: number; // pu
  label: string;
  isCarrier?: boolean;
  isHarmonic?: boolean;
  isDisturbance?: boolean;
  disturbanceId?: string;
  color?: string;
  zone?: ZoneType;
}

/**
 * Immutable snapshot of a single PMU measurement lifecycle.
 * Preserved throughout rendering and animation until a new measurement is taken.
 */
export interface PmuMeasurementSnapshot {
  id: number;
  timestamp: number;
  pmuClass: PmuClass;
  reportingRate: PmuReportingRate;
  nominalFundamental: number; // f0 (e.g. 60 Hz)
  zone1Limit: number; // 2 Hz for P-Class, 5 Hz for M-Class
  zone2Limit: number; // Reporting Nyquist = Fs / 2
  zone1Band: { min: number; max: number }; // [f0 - limit, f0 + limit]
  zone2Band: { min: number; max: number }; // [f0 - Nyq, f0 + Nyq]
  disturbances: InjectedDisturbance[];
  outcomes: DisturbanceCaptureOutcome[];
  trueComponents: TrueSpectralComponent[];
  pmuComponents: CapturedPmuComponent[];
  maxAmplitude: number;
  minPlotFreq: number;
  maxPlotFreq: number;
  trueRms: number;
  pmuRms: number;
  tvePercent: number;
}

export interface PmuSamplePoint {
  tRelativeMs: number;
  tAbsoluteSec: number;
  trueY: number;
  pmuY: number;
}

export interface PmuReportFrame {
  tRelativeMs: number;
  tAbsoluteSec: number;
  y: number;
  frameIndex: number;
}

export interface PmuWaveformWindowData {
  points: PmuSamplePoint[];
  reportedFrames: PmuReportFrame[];
  windowDurationSec: number;
  windowDurationMs: number;
  fundamentalPeriodMs: number;
  yMin: number;
  yMax: number;
  cyclesShown: number;
}
