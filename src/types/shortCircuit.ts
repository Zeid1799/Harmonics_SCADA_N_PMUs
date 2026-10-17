/**
 * Phase C: Short-Circuit Analysis (SC Analysis) Types
 * Symmetrical components, sequence networks, fault scenarios, and fault current solutions.
 */

export type FaultType =
  | '3phase'                    // Three-Phase Balanced Fault (LLL / LLL-G)
  | 'single-line-to-ground'     // Single-Line-to-Ground Unbalanced Fault (SLG / 1LG on Phase A)
  | 'line-to-line'              // Line-to-Line Unbalanced Fault (LL between Phase B and Phase C)
  | 'double-line-to-ground';    // Double-Line-to-Ground Unbalanced Fault (DLG / 2LG on Phases B & C to Ground)

export type PrefaultVoltageMode =
  | 'power-flow'                // Use solved AC power flow complex voltage profile
  | 'flat-1.0';                 // Standard IEC/IEEE flat 1.0 p.u. profile at 0 deg

export type TransformerZeroSeqConnection =
  | 'delta-wye_grounded'        // High side Delta, Low side Grounded-Wye (Standard substation step-down)
  | 'wye_grounded-delta'        // High side Grounded-Wye, Low side Delta
  | 'wye_grounded-wye_grounded' // Solidly grounded on both sides (autotransformer / tie)
  | 'delta-delta';              // Delta on both sides (zero-sequence isolated)

export interface ComplexNumber {
  re: number;
  im: number;
}

export interface PolarNumber {
  mag: number;
  angleDeg: number;
}

export interface SequenceComponents<T> {
  zero: T;
  positive: T;
  negative: T;
}

export interface PhaseComponents<T> {
  a: T;
  b: T;
  c: T;
}

/**
 * Generator sequence network and grounding parameters.
 * Supplemented from IEEE benchmark dynamic and fault data (Sauer & Pai, PSAT, Anderson).
 */
export interface GeneratorSequenceParameters {
  generatorId: string;
  busNumber: number;
  /** Subtransient reactance X''d in p.u. on machine base */
  subtransientReactanceXdpPu: number;
  /** Negative-sequence reactance X2 in p.u. on machine base (typically ~ X''d) */
  negativeSequenceReactanceX2Pu: number;
  /** Zero-sequence reactance X0 in p.u. on machine base */
  zeroSequenceReactanceX0Pu: number;
  /** Neutral grounding resistance in p.u. on machine base (0 for solidly grounded) */
  neutralGroundingResistanceRnPu: number;
  /** Neutral grounding reactance in p.u. on machine base (0 for solidly grounded) */
  neutralGroundingReactanceXnPu: number;
  /** Grounding type description */
  groundingType: 'solidly-grounded' | 'resistance-grounded' | 'ungrounded';
}

/**
 * Transmission line zero-sequence parameters.
 */
export interface LineSequenceParameters {
  lineId: string;
  fromBusNumber: number;
  toBusNumber: number;
  /** Zero-sequence resistance R0 in p.u. on 100 MVA base */
  zeroResistancePu: number;
  /** Zero-sequence reactance X0 in p.u. on 100 MVA base */
  zeroReactancePu: number;
  /** Zero-sequence charging susceptance B0 in p.u. on 100 MVA base */
  zeroSusceptancePu: number;
  /** Ratio of zero-sequence reactance to positive-sequence reactance (X0 / X1) */
  x0ToX1Ratio: number;
  /** Ratio of zero-sequence resistance to positive-sequence resistance (R0 / R1) */
  r0ToR1Ratio: number;
}

/**
 * Transformer zero-sequence parameters and winding connection configuration.
 */
export interface TransformerSequenceParameters {
  transformerId: string;
  fromBusNumber: number;
  toBusNumber: number;
  connection: TransformerZeroSeqConnection;
  /** Description of winding connection and zero-sequence grounding path */
  connectionDescription: string;
  /** Zero-sequence series resistance R0 in p.u. on 100 MVA base */
  zeroResistancePu: number;
  /** Zero-sequence leakage reactance X0 in p.u. on 100 MVA base */
  zeroReactancePu: number;
}

/**
 * Complete set of benchmark sequence parameters for the IEEE 30-bus network.
 */
export interface NetworkSequenceDataset {
  generators: Record<string, GeneratorSequenceParameters>;
  lines: Record<string, LineSequenceParameters>;
  transformers: Record<string, TransformerSequenceParameters>;
  metadata: {
    source: string;
    documentation: string[];
    assumptions: string[];
  };
}

/**
 * User-configured fault scenario.
 */
export interface ShortCircuitScenario {
  faultedBusNumber: number;
  faultType: FaultType;
  /** Fault resistance Rf in ohms */
  faultResistanceOhms: number;
  /** Fault reactance Xf in ohms */
  faultReactanceOhms: number;
  /** Fault impedance Zf in p.u. on system 100 MVA base */
  faultResistancePu: number;
  faultReactancePu: number;
  prefaultVoltageMode: PrefaultVoltageMode;
  /** Whether to include passive shunt loads in the positive-sequence network */
  includePassiveLoads: boolean;
}

/**
 * Fault current contribution from an individual branch (transmission line or transformer)
 * connected directly to the faulted bus.
 */
export interface BranchFaultContribution {
  branchId: string;
  branchName: string;
  branchType: 'line' | 'transformer';
  connectedFromBus: number;
  connectedToBus: number;
  /** Current flowing into the faulted bus in per-unit */
  currentPu: PolarNumber;
  /** Current flowing into the faulted bus in kiloamperes */
  currentKa: number;
  /** Current in Amperes */
  currentA: number;
  /** Sequence components of branch current */
  sequenceCurrentsPu: SequenceComponents<PolarNumber>;
  /** Phase components of branch current */
  phaseCurrentsKa: PhaseComponents<number>;
  /** Percentage contribution to the total fault current magnitude */
  percentOfTotalFaultCurrent: number;
}

/**
 * Fault current contribution from an in-service generator connected at or near the faulted bus.
 */
export interface GeneratorFaultContribution {
  generatorId: string;
  generatorName: string;
  busNumber: number;
  unitType: string;
  currentPu: PolarNumber;
  currentKa: number;
  currentA: number;
  sequenceCurrentsPu: SequenceComponents<PolarNumber>;
  phaseCurrentsKa: PhaseComponents<number>;
  percentOfTotalFaultCurrent: number;
}

/**
 * Voltage profile at an individual bus during the sustained fault condition.
 */
export interface BusFaultVoltage {
  busNumber: number;
  busId: string;
  busName: string;
  baseKv: number;
  isFaultedBus: boolean;
  /** Positive-sequence post-fault voltage */
  vPositivePu: PolarNumber;
  /** Zero-sequence post-fault voltage */
  vZeroPu: PolarNumber;
  /** Negative-sequence post-fault voltage */
  vNegativePu: PolarNumber;
  /** Phase voltage magnitudes in p.u. */
  phaseVoltagesPu: PhaseComponents<PolarNumber>;
  /** Phase voltage line-to-neutral magnitudes in kV */
  phaseVoltagesKv: PhaseComponents<number>;
  /** Minimum phase voltage in p.u. */
  minPhaseVoltagePu: number;
  /** Voltage sag severity percentage (100% = fully collapsed to 0V) */
  voltageSagPercent: number;
  /** Flag for severe voltage sag (< 0.70 p.u.) */
  isSevereSag: boolean;
}

/**
 * Complete, reproducible solution of a short-circuit analysis run.
 */
export interface ShortCircuitSolution {
  scenario: ShortCircuitScenario;
  converged: boolean;
  errorMessage?: string;
  calculationTimestamp: number;
  networkModelChecksum: string;

  /** Thevenin driving-point impedance at the faulted bus */
  theveninImpedance: {
    positive: ComplexNumber & PolarNumber;
    negative: ComplexNumber & PolarNumber;
    zero: ComplexNumber & PolarNumber;
  };

  /** X/R ratio of the positive-sequence Thevenin impedance */
  xOverRRatio: number;

  /** Prefault voltage at the faulted bus */
  prefaultVoltage: ComplexNumber & PolarNumber;
  prefaultVoltageKv: number;

  /** Sequence fault currents */
  sequenceCurrentsPu: SequenceComponents<ComplexNumber & PolarNumber>;

  /** Phase fault currents */
  phaseCurrentsPu: PhaseComponents<ComplexNumber & PolarNumber>;
  phaseCurrentsKa: PhaseComponents<number>;
  phaseCurrentsA: PhaseComponents<number>;

  /** Total fault current magnitude at the fault point */
  totalFaultCurrentPu: number;
  totalFaultCurrentKa: number;
  totalFaultCurrentA: number;
  totalFaultCurrentAngleDeg: number;

  /** Symmetrical short-circuit fault duty in MVA: sqrt(3) * V_base_kV * I_fault_kA */
  shortCircuitMva: number;

  /** Ground fault return current (for SLG and DLG faults): 3 * I0 */
  groundCurrentPu?: number;
  groundCurrentKa?: number;
  groundCurrentA?: number;

  /** Individual branch source contributions */
  branchContributions: BranchFaultContribution[];

  /** Individual generator source contributions */
  generatorContributions: GeneratorFaultContribution[];

  /** Post-fault bus voltages across all 30 buses */
  busVoltages: BusFaultVoltage[];

  /** Number of buses experiencing severe voltage sag (< 0.70 pu) */
  severeSagBusCount: number;

  /** Method documentation, references, and validation notes */
  methodologyNotes: {
    methodName: string;
    standardReference: string;
    sequenceNetworkSummary: string;
    assumptions: string[];
    technicalLimitations: string[];
  };
}
