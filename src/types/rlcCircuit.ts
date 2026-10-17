export interface RlcCircuitConfig {
  vSourceRms: number;   // Source Voltage in V RMS (e.g., 120 V, min: 0)
  vSourcePhaseDeg?: number; // Source Phase in degrees (e.g., 0°, -180° to +180°)
  frequency: number;    // Frequency in Hz (e.g., 60 Hz, min: 0.1)
  resistance: number;   // Resistance in Ohms (e.g., 100 Ω, min: 0)
  inductanceMh: number; // Inductance in millihenries (e.g., 100 mH, min: 0)
  capacitanceUf: number;// Capacitance in microfarads (e.g., 100 µF, min: 0)
}

export interface RlcTraceVisibility {
  vSource: boolean;
  current: boolean;
  vResistor: boolean;
  vInductor: boolean;
  vCapacitor: boolean;
}

export type RlcBehavior = 'inductive' | 'capacitive' | 'resonance' | 'open_circuit' | 'unbounded' | 'indeterminate';
export type PowerFactorType = 'lagging' | 'leading' | 'unity' | 'undefined';

export interface RlcCircuitMetrics {
  omega: number;                // Angular frequency (rad/s)
  xL: number;                   // Inductive reactance (Ω)
  xC: number;                   // Capacitive reactance (Ω)
  netReactance: number;         // X_L - X_C (Ω)
  zMagnitude: number;           // Total series impedance |Z| (Ω)
  zThetaRad: number;            // Impedance phase angle θ_Z (rad)
  zThetaDeg: number;            // Impedance phase angle θ_Z (deg)
  iRms: number;                 // Circuit current RMS (A)
  iPeak: number;                // Circuit current peak (A)
  phiIRad: number;              // Current phase angle relative to source φ_I = -θ_Z (rad)
  phiIDeg: number;              // Current phase angle relative to source φ_I = -θ_Z (deg)
  
  // Voltages
  vSourceRms: number;           // Source RMS voltage (V)
  vSourcePeak: number;          // Source peak voltage (V)
  vSourcePhaseRad: number;      // Source voltage phase angle (rad)
  vSourcePhaseDeg: number;      // Source voltage phase angle (deg)
  vResistorRms: number;         // Resistor RMS voltage (V)
  vResistorPeak: number;        // Resistor peak voltage (V)
  vResistorPhaseRad: number;    // Resistor voltage phase angle (rad)
  vResistorPhaseDeg: number;    // Resistor voltage phase angle (deg)
  vInductorRms: number;         // Inductor RMS voltage (V)
  vInductorPeak: number;        // Inductor peak voltage (V)
  vInductorPhaseRad: number;    // Inductor voltage phase angle (rad)
  vInductorPhaseDeg: number;    // Inductor voltage phase angle (deg)
  vCapacitorRms: number;        // Capacitor RMS voltage (V)
  vCapacitorPeak: number;       // Capacitor peak voltage (V)
  vCapacitorPhaseRad: number;   // Capacitor voltage phase angle (rad)
  vCapacitorPhaseDeg: number;   // Capacitor voltage phase angle (deg)
  scalarSumVoltageRms: number;  // V_R + V_L + V_C (V)
  phasorSumError: number;       // Phasor sum error |V_s - (V_R + V_L + V_C)| (should be ≈ 0)

  // Power
  powerFactor: number;          // cos(θ_Z), 0.0 to 1.0 (or NaN if undefined)
  powerFactorType: PowerFactorType; // lagging (inductive), leading (capacitive), unity (resonance), undefined
  realPowerW: number;           // P = I^2 * R (W)
  reactivePowerVar: number;     // Q = I^2 * (X_L - X_C) (VAr)
  apparentPowerVa: number;      // S = V_s * I (VA)

  // Resonance
  resonantFrequencyHz: number | null; // f_0 = 1 / (2π√(LC)) (Hz, null if L=0 or C=0)
  isResonant: boolean;          // true if within resonance tolerance
  isResonanceApplicable: boolean;// true only when L > 0 and C > 0

  // Special Operating Conditions
  isOpenCircuit: boolean;       // true when C = 0
  isUnboundedCurrent: boolean;  // true when ideal zero-impedance resonance or short with V > 0
  isIndeterminate: boolean;     // true when V = 0 and Z = 0

  // String Formattings (guarantee no NaN or Infinity displayed as numbers)
  zDisplay: string;
  iDisplay: string;
  pfDisplay: string;
  thetaZDisplay: string;
  phiIDisplay: string;
  f0Display: string;
  statusMessage?: string;

  // Educational Feedback
  behavior: RlcBehavior;
  behaviorTitle: string;
  behaviorExplanation: string;
}

export interface RlcSamplePoint {
  tRelativeMs: number;
  tAbsoluteSec: number;
  vSource: number;
  current: number;
  vResistor: number;
  vInductor: number;
  vCapacitor: number;
}

export type RlcSimulationMode = 'steady' | 'transient';

export interface RlcTopologyConfig {
  resistor: 'enabled' | 'bypassed';
  inductor: 'enabled' | 'bypassed';
  capacitor: 'enabled' | 'removed' | 'bypassed';
}

export interface RlcTransientInitialConditions {
  initialVc: number; // Initial capacitor voltage in Volts (V)
  initialIl: number; // Initial inductor current in Amperes (A)
}

export interface RlcTransientState {
  timeSec: number;
  isRunning: boolean;
  initialConditions: RlcTransientInitialConditions;
  overlaySteadyState: boolean;
  visibleTimeWindowMs: number; // Visible duration in ms (e.g., 50 ms = 3 cycles at 60 Hz)
}

export interface RlcTransientMetrics {
  timeSec: number;
  vSource: number;
  current: number;
  vResistor: number;
  vInductor: number;
  vCapacitor: number;
  kvlError: number;
  dampingRatio: number | null;
  dampingType: 'underdamped' | 'critically_damped' | 'overdamped' | 'undamped' | 'first_order' | 'lossless' | 'n/a';
  naturalFrequencyHz: number | null;
  statusMessage: string;
}

export type RlcActiveComponent = 'source' | 'resistor' | 'inductor' | 'capacitor' | null;

export interface RlcCircuitState {
  config: RlcCircuitConfig;
  topology: RlcTopologyConfig;
  simulationMode: RlcSimulationMode;
  transient: RlcTransientState;
  traces: RlcTraceVisibility;
  activeComponent: RlcActiveComponent;
  showPhasors: boolean;
  visibleCycles: number;
}

export const DEFAULT_RLC_CONFIG: RlcCircuitConfig = {
  vSourceRms: 120,   // 120 V RMS
  vSourcePhaseDeg: 0,// 0° reference
  frequency: 60,     // 60 Hz
  resistance: 100,   // 100 Ω
  inductanceMh: 100, // 100 mH (0.1 H)
  capacitanceUf: 100,// 100 µF (0.0001 F)
};

export const DEFAULT_RLC_TOPOLOGY: RlcTopologyConfig = {
  resistor: 'enabled',
  inductor: 'enabled',
  capacitor: 'enabled',
};

export const DEFAULT_RLC_TRANSIENT_INITIAL: RlcTransientInitialConditions = {
  initialVc: 0,
  initialIl: 0,
};

export const DEFAULT_RLC_TRANSIENT_STATE: RlcTransientState = {
  timeSec: 0,
  isRunning: false,
  initialConditions: DEFAULT_RLC_TRANSIENT_INITIAL,
  overlaySteadyState: false,
  visibleTimeWindowMs: 50,
};

export const DEFAULT_RLC_TRACES: RlcTraceVisibility = {
  vSource: true,
  current: true,
  vResistor: true,
  vInductor: true,
  vCapacitor: true,
};

export const DEFAULT_RLC_CIRCUIT_STATE: RlcCircuitState = {
  config: DEFAULT_RLC_CONFIG,
  topology: DEFAULT_RLC_TOPOLOGY,
  simulationMode: 'steady',
  transient: DEFAULT_RLC_TRANSIENT_STATE,
  traces: DEFAULT_RLC_TRACES,
  activeComponent: null,
  showPhasors: true,
  visibleCycles: 3,
};
