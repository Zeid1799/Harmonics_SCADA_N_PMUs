export type GeneratorPhaseMode = 'single' | 'three';

export interface SinglePhaseConfig {
  amplitude: number;  // Peak amplitude in pu (0.0 to 2.0, default 1.0)
  phaseDeg: number;   // Phase angle in degrees (-180 to +180, default A: 0, B: -120, C: +120)
  frequency: number;  // Frequency in Hz (1 to 120, default 60)
  enabled: boolean;   // Phase in service
  resistance: number; // Connected resistive load in Ohms (e.g. 5 to 50 Ω, default 10 Ω)
}

export type ThreePhaseSignalDisplayMode = 'voltage' | 'current' | 'both';

export interface ThreePhaseState {
  mode: GeneratorPhaseMode;
  phaseA: SinglePhaseConfig;
  phaseB: SinglePhaseConfig;
  phaseC: SinglePhaseConfig;
  syncFrequencies: boolean;
  signalDisplay: ThreePhaseSignalDisplayMode;
  showPhasors: boolean;
}

export interface ThreePhaseMetrics {
  isSystemBalanced: boolean;
  isVoltageBalanced: boolean;
  isLoadBalanced: boolean;
  areFrequenciesEqual: boolean;
  
  // Voltages
  vA_Rms: number;
  vB_Rms: number;
  vC_Rms: number;
  vSumPeak: number;
  vSumRms: number;

  // Currents
  iA_Rms: number;
  iB_Rms: number;
  iC_Rms: number;
  iN_Rms: number;
  iN_Peak: number;

  educationalTitle: string;
  educationalMessage: string;
}

export interface ThreePhaseSamplePoint {
  tRelativeMs: number;
  tAbsoluteSec: number;
  vA: number;
  vB: number;
  vC: number;
  vSum: number;
  iA: number;
  iB: number;
  iC: number;
  iN: number;
}

export const DEFAULT_PHASE_A: SinglePhaseConfig = {
  amplitude: 1.0,
  phaseDeg: 0,
  frequency: 60,
  enabled: true,
  resistance: 10,
};

export const DEFAULT_PHASE_B: SinglePhaseConfig = {
  amplitude: 1.0,
  phaseDeg: -120,
  frequency: 60,
  enabled: true,
  resistance: 10,
};

export const DEFAULT_PHASE_C: SinglePhaseConfig = {
  amplitude: 1.0,
  phaseDeg: 120,
  frequency: 60,
  enabled: true,
  resistance: 10,
};

export const DEFAULT_THREE_PHASE_STATE: ThreePhaseState = {
  mode: 'single',
  phaseA: DEFAULT_PHASE_A,
  phaseB: DEFAULT_PHASE_B,
  phaseC: DEFAULT_PHASE_C,
  syncFrequencies: true,
  signalDisplay: 'voltage',
  showPhasors: true,
};

export interface ThreePhasePreset {
  id: string;
  name: string;
  description: string;
  apply: (curr: ThreePhaseState) => ThreePhaseState;
}

