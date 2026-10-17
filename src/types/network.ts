export type NetworkClassification = 'real-world' | 'synthetic' | 'academic-benchmark';

export type BusType = 'slack' | 'pv' | 'pq';

export type EquipmentStatus = 'online' | 'offline';

export type LoadStatus = 'connected' | 'disconnected';

export type NetworkEquipmentCategory =
  | 'bus'
  | 'generator'
  | 'load'
  | 'line'
  | 'transformer'
  | 'shunt';

export type SimulatorMapViewMode = 'one-line' | 'geographic';

export type ZoomDetailLevel = 'regional' | 'intermediate' | 'detailed';

export type CoordinateConfidence =
  | 'verified-historical-substation'
  | 'schematic-subtransmission-cluster';

export interface SelectedNetworkElement {
  category: NetworkEquipmentCategory;
  id: string;
}

/**
 * Summary of each candidate power-system network evaluated during network selection research.
 */
export interface NetworkCandidateComparison {
  id: string;
  name: string;
  classification: NetworkClassification;
  originalBuses: number;
  voltageLevelsKv: string;
  generatorsCount: number;
  loadsCount: number;
  linesCount: number;
  transformersCount: number;
  shuntsCount: number;
  hasThermalRatings: boolean;
  sourceCitation: string;
  sourceUrlOrDoi: string;
  selected: boolean;
  evaluationSummary: string;
}

/**
 * Provenance, attribution, solver documentation, and geographic notes for the selected benchmark case.
 */
export interface NetworkMetadata {
  id: string;
  name: string;
  shortName: string;
  caseIdentifier: string;
  classification: NetworkClassification;
  classificationLabel: string;
  sourceOrganization: string;
  authors: string[];
  publicationTitle: string;
  publicationYear: number;
  editionOrVenue: string;
  primarySourceUrl: string;
  cdfDataUrl: string;
  matpowerCaseUrl: string;
  matpowerRatingsUrl: string;
  baseMva: number;
  nominalFrequencyHz: number;
  originalBusCount: number;
  representedBusCount: number;
  subsystemAndReductionSummary: string;
  parameterSources: {
    component: string;
    sourceLocation: string;
    details: string;
  }[];
  derivedValuesAndAssumptions: string[];
  licensingAndReuse: string;
  hasFullGeographicCoordinates: boolean;
  geographicSummary: string;
  geographicDisclaimer: string;
  solverDocumentation: {
    engineName: string;
    algorithm: string;
    executionEnvironment: string;
    supportedModels: string[];
    limitations: string[];
  };
  evaluatedCandidates: NetworkCandidateComparison[];
}

/**
 * Published reference solution from UW IEEE CDF archive (ieee30cdf.txt / MATPOWER case_ieee30.m).
 */
export interface PublishedBusReferenceSolution {
  vmPu: number;
  vaDeg: number;
}

/**
 * Region / area grouping for multiscale navigation and regional aggregation.
 */
export interface NetworkAreaRegion {
  id: number;
  name: string;
  shortName: string;
  voltageTierLabel: string;
  description: string;
  oneLineBounds: { x: number; y: number; width: number; height: number };
  geoCenter: { lat: number; lon: number; zoom: number };
}

/**
 * Bus representation in the electrical network model.
 */
export interface NetworkBus {
  id: string;
  number: number;
  name: string;
  substationName: string;
  areaNumber: 1 | 2 | 3;
  areaName: string;
  busType: BusType;
  busTypeLabel: string;
  baseKv: number;
  status: EquipmentStatus;
  vMinPu: number;
  vMaxPu: number;
  /** Specified voltage magnitude in p.u. for Slack/PV buses; initial guess for PQ buses */
  initialVmPu: number;
  /** Specified voltage angle in deg for Slack bus; initial guess for other buses */
  initialVaDeg: number;
  /** Published IEEE CDF reference voltage solution for solver validation */
  publishedReference: PublishedBusReferenceSolution;
  /** Connected asset IDs (derived or explicit for fast lookup) */
  connectedEquipment: {
    generators: string[];
    loads: string[];
    lines: string[];
    transformers: string[];
    shunts: string[];
  };
  /** 2D schematic coordinates for the One-Line View (viewBox 0 0 1600 1050) */
  oneLineLayout: {
    x: number;
    y: number;
    orientation: 'horizontal' | 'vertical';
    length: number;
    labelPosition?: 'top' | 'bottom' | 'left' | 'right';
  };
  /**
   * Geographic coordinates for the Geographic View.
   * Explicitly distinguishes verified historical 1961 AEP Virginia substations
   * from schematic 33 kV subtransmission feeder nodes.
   */
  geoLocation: {
    lat: number;
    lon: number;
    coordinateConfidence: CoordinateConfidence;
    historicalLocationNote: string;
    parentSubstationBusNumber?: number;
  };
  isUserCreated?: boolean;
  isUserModified?: boolean;
}

/**
 * Synchronous generator or synchronous condenser in the electrical network model.
 */
export interface NetworkGenerator {
  id: string;
  name: string;
  busId: string;
  busNumber: number;
  unitType: 'Synchronous Generator' | 'Synchronous Condenser';
  controlMode: 'Slack / Reference' | 'Voltage-Controlled (PV)';
  status: EquipmentStatus;
  ratedMva: number;
  ratedKv: number;
  /** Scheduled active power output in MW */
  scheduledActivePowerMw: number;
  /** Minimum active power output in MW */
  activePowerMinMw: number;
  /** Maximum active power output in MW */
  activePowerMaxMw: number;
  /** Scheduled voltage magnitude setpoint in p.u. */
  voltageSetpointPu: number;
  /** Minimum reactive power limit in MVAr */
  reactivePowerMinMvar: number;
  /** Maximum reactive power limit in MVAr */
  reactivePowerMaxMvar: number;
  /** Published reference output from ieee30cdf.txt */
  publishedReferenceOutput: {
    pMw: number;
    qMvar: number;
  };
  isUserCreated?: boolean;
  isUserModified?: boolean;
}

/**
 * Load demand element in the electrical network model.
 */
export interface NetworkLoad {
  id: string;
  name: string;
  busId: string;
  busNumber: number;
  baseKv: number;
  status: LoadStatus;
  /** Documented nominal active power demand in MW (ieee30cdf.txt) */
  nominalActivePowerMw: number;
  /** Documented nominal reactive power demand in MVAr (ieee30cdf.txt) */
  nominalReactivePowerMvar: number;
  /** User-configured active power demand in MW */
  configuredActivePowerMw: number;
  /** User-configured reactive power demand in MVAr */
  configuredReactivePowerMvar: number;
  isUserCreated?: boolean;
  isUserModified?: boolean;
}

/**
 * AC transmission line modeled by a standard pi-equivalent circuit.
 */
export interface NetworkTransmissionLine {
  id: string;
  name: string;
  branchIndex: number;
  fromBusId: string;
  toBusId: string;
  fromBusNumber: number;
  toBusNumber: number;
  voltageKv: number;
  status: EquipmentStatus;
  /** Series resistance R in p.u. on system MVA base (100 MVA) */
  resistancePu: number;
  /** Series reactance X in p.u. on system MVA base (100 MVA) */
  reactancePu: number;
  /** Total line charging susceptance B in p.u. on system MVA base (100 MVA) */
  chargingSusceptancePu: number;
  /** Long-term thermal rating Rate A in MVA (Alsac & Stott 1974 / MATPOWER case30.m) */
  ratingMva: number;
  ratingSourceNote: string;
  isUserCreated?: boolean;
  isUserModified?: boolean;
}

/**
 * Two-winding or three-winding leg transformer with off-nominal tap ratio and phase shift.
 */
export interface NetworkTransformer {
  id: string;
  name: string;
  branchIndex: number;
  fromBusId: string;
  toBusId: string;
  fromBusNumber: number;
  toBusNumber: number;
  fromVoltageKv: number;
  toVoltageKv: number;
  windingConfigLabel: string;
  status: EquipmentStatus;
  /** Series resistance R in p.u. on 100 MVA base */
  resistancePu: number;
  /** Leakage reactance X in p.u. on 100 MVA base */
  reactancePu: number;
  /** Off-nominal turns ratio tau in p.u. on the from-bus (tap) side */
  tapRatioPu: number;
  /** Nominal baseline tap ratio in p.u. */
  nominalTapRatioPu: number;
  /** Phase-shift angle in degrees */
  phaseShiftDeg: number;
  /** Long-term thermal rating Rate A in MVA (Alsac & Stott 1974 / MATPOWER case30.m) */
  ratingMva: number;
  ratingSourceNote: string;
  isUserCreated?: boolean;
  isUserModified?: boolean;
}

/**
 * Switched shunt capacitor or reactor bank connected to a bus.
 */
export interface NetworkShunt {
  id: string;
  name: string;
  busId: string;
  busNumber: number;
  baseKv: number;
  shuntType: 'Capacitor Bank' | 'Reactor';
  status: EquipmentStatus;
  /** Nominal active conductance Gs in MW at V = 1.0 p.u. */
  conductanceMwAtUnitV: number;
  /** Documented nominal reactive susceptance Bs in MVAr injected at V = 1.0 p.u. (ieee30cdf.txt) */
  nominalSusceptanceMvarAtUnitV: number;
  /** User-configured reactive susceptance Bs in MVAr injected at V = 1.0 p.u. */
  configuredSusceptanceMvarAtUnitV: number;
  isUserCreated?: boolean;
  isUserModified?: boolean;
}

/**
 * Complex admittance entry G + jB in p.u. for the Bus Admittance Matrix (Y_bus).
 */
export interface YBusEntry {
  fromBus: number;
  toBus: number;
  gPu: number;
  bPu: number;
}

/**
 * Complete electrical network state.
 */
export interface PowerNetworkModel {
  metadata: NetworkMetadata;
  areas: NetworkAreaRegion[];
  buses: NetworkBus[];
  generators: NetworkGenerator[];
  loads: NetworkLoad[];
  lines: NetworkTransmissionLine[];
  transformers: NetworkTransformer[];
  shunts: NetworkShunt[];
  /** Global load multiplier (1.0 = 100% nominal configured load) */
  loadScaleFactor: number;
}

/**
 * Solver execution options.
 */
export interface AcPowerFlowOptions {
  tolerancePu: number;
  maxIterations: number;
  enforceReactiveLimits: boolean;
  flatStart: boolean;
}

export type SolverStatus = 'not-solved' | 'solving' | 'converged' | 'failed';

/**
 * Solved steady-state quantities at a single bus.
 */
export interface BusSolution {
  busNumber: number;
  busId: string;
  energized: boolean;
  islandId: number;
  effectiveBusType: BusType;
  convertedFromPvToPq: boolean;
  qLimitViolationType: 'none' | 'qmax' | 'qmin';
  vmPu: number;
  vaDeg: number;
  vmKv: number;
  pGenMw: number;
  qGenMvar: number;
  pLoadMw: number;
  qLoadMvar: number;
  qShuntMvar: number;
  pNetInjectionMw: number;
  qNetInjectionMvar: number;
  pMismatchMw: number;
  qMismatchMvar: number;
  voltageViolation: 'none' | 'high' | 'low' | 'de-energized';
}

/**
 * Solved steady-state flows, losses, and loading for a transmission line or transformer.
 */
export interface BranchFlowSolution {
  id: string;
  category: 'line' | 'transformer';
  fromBusNumber: number;
  toBusNumber: number;
  inService: boolean;
  energized: boolean;
  /** Active power injected at from-bus terminal (MW) */
  pFromMw: number;
  /** Reactive power injected at from-bus terminal (MVAr) */
  qFromMvar: number;
  /** Apparent power at from-bus terminal (MVA) */
  sFromMva: number;
  /** Active power injected at to-bus terminal (MW) */
  pToMw: number;
  /** Reactive power injected at to-bus terminal (MVAr) */
  qToMvar: number;
  /** Apparent power at to-bus terminal (MVA) */
  sToMva: number;
  /** Governing apparent power flow max(sFromMva, sToMva) in MVA */
  maxApparentFlowMva: number;
  /** Active power loss I^2*R across the branch (MW) */
  lossMw: number;
  /** Net reactive power loss across the branch (MVAr, series I^2*X minus charging) */
  lossMvar: number;
  /** Thermal MVA rating (Rate A) */
  ratingMva: number;
  /** Thermal loading percentage = maxApparentFlowMva / ratingMva * 100 */
  loadingPercent: number;
  overloaded: boolean;
}

/**
 * Solved generator output.
 */
export interface GeneratorDispatchSolution {
  id: string;
  busNumber: number;
  online: boolean;
  energized: boolean;
  pMw: number;
  qMvar: number;
  sMva: number;
  loadingPercent: number;
  clampedAtQLimit: 'none' | 'qmax' | 'qmin';
}

/**
 * Solved shunt reactive power injection at actual bus voltage (Q = Bs * |V|^2).
 */
export interface ShuntInjectionSolution {
  id: string;
  busNumber: number;
  online: boolean;
  energized: boolean;
  pMw: number;
  qInjectedMvar: number;
}

/**
 * Topology and islanding diagnostics computed prior to and during power flow.
 */
export interface TopologyDiagnostics {
  totalIslands: number;
  energizedIslandIds: number[];
  islands: {
    islandId: number;
    busNumbers: number[];
    hasSlackBus: boolean;
    onlineGeneratorCount: number;
    energized: boolean;
    totalLoadMw: number;
  }[];
  isolatedBusNumbers: number[];
  deEnergizedBusNumbers: number[];
  unsuppliedLoadIds: string[];
  unsuppliedLoadMw: number;
  unsuppliedLoadMvar: number;
  disconnectedLoadIds: string[];
  offlineGeneratorIds: string[];
  offlineBranchIds: string[];
  warnings: string[];
}

/**
 * Record of PV-to-PQ bus type switching when generator reactive limits are enforced.
 */
export interface ReactiveLimitEvent {
  outerIteration: number;
  busNumber: number;
  generatorIds: string[];
  violationType: 'qmax' | 'qmin';
  unclampedQMvar: number;
  clampedQMvar: number;
}

/**
 * Complete result returned by the AC Power-Flow Solver.
 */
export interface PowerFlowSolutionResult {
  converged: boolean;
  status: SolverStatus;
  failureReason: string | null;
  iterations: number;
  outerLoopCount: number;
  solveDurationMs: number;
  maxActiveMismatchPu: number;
  maxReactiveMismatchPu: number;
  maxActiveMismatchMw: number;
  maxReactiveMismatchMvar: number;
  optionsUsed: AcPowerFlowOptions;
  topology: TopologyDiagnostics;
  reactiveLimitEvents: ReactiveLimitEvent[];
  busSolutions: Record<number, BusSolution>;
  lineFlows: Record<string, BranchFlowSolution>;
  transformerFlows: Record<string, BranchFlowSolution>;
  generatorOutputs: Record<string, GeneratorDispatchSolution>;
  shuntOutputs: Record<string, ShuntInjectionSolution>;
  summary: {
    totalGenerationMw: number;
    totalGenerationMvar: number;
    totalLoadServedMw: number;
    totalLoadServedMvar: number;
    totalUnsuppliedLoadMw: number;
    totalActiveLossesMw: number;
    totalReactiveLossesMvar: number;
    totalShuntInjectionMvar: number;
    minVoltagePu: number;
    minVoltageBusNumber: number;
    maxVoltagePu: number;
    maxVoltageBusNumber: number;
    maxBranchLoadingPercent: number;
    maxLoadedBranchId: string;
    overloadedBranchCount: number;
    voltageViolationBusCount: number;
  };
}

/**
 * Configurable visual overlays for the One-Line and Geographic views.
 */
export interface SimulatorOverlayConfig {
  showFlowArrows: boolean;
  branchLabelMode: 'pq' | 'mw' | 'loading' | 'none';
  busLabelMode: 'voltage-pu-angle' | 'voltage-kv' | 'name-only';
  colorBranchesByLoading: boolean;
  highlightViolations: boolean;
  loadingThresholds: {
    elevatedPercent: number; // default 70%
    highPercent: number; // default 90%
    overloadPercent: number; // default 100%
  };
  /** In Geographic View, whether to expand the schematic 33 kV feeder buses or aggregate them at their parent 132/33 kV substations */
  expandSchematic33kVCluster: boolean;
  /** In Geographic View, whether to use external OpenStreetMap tiles or the built-in offline cartographic vector basemap */
  useExternalOsmTiles: boolean;
}

/**
 * Active interactive editing tool in OL Changes mode.
 */
export type OlChangesTool =
  | 'select'
  | 'connect-line'
  | 'add-bus'
  | 'add-line'
  | 'add-transformer'
  | 'add-generator'
  | 'add-load'
  | 'add-shunt'
  | 'delete';

/**
 * Diagnostic issue identified during network model validation.
 */
export interface NetworkValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  elementCategory?: NetworkEquipmentCategory;
  elementId?: string;
  fixSuggestion?: string;
}

/**
 * Complete network validation report summarizing electrical and topological checks.
 */
export interface NetworkValidationReport {
  isValid: boolean;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  issues: NetworkValidationIssue[];
  timestamp: number;
}

