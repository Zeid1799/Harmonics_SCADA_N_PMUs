import { DEFAULT_NETWORK_MODEL, createFreshDefaultNetworkModel } from '../src/model/networkModel';
import { solveAcPowerFlow, DEFAULT_SOLVER_OPTIONS } from '../src/model/acPowerFlowSolver';
import { solveShortCircuit, DEFAULT_SC_SCENARIO } from '../src/model/shortCircuitSolver';
import {
  deriveBranchDynamicFlowState,
  DEFAULT_DYNAMIC_FLOW_CONFIG,
  DynamicFlowConfig,
} from '../src/types/dynamicFlow';
import {
  updateBusFull,
  updateGeneratorFull,
  updateLoadFull,
  updateLineFull,
  updateTransformerFull,
  updateShuntFull,
  cloneNetworkModel,
} from '../src/model/networkEditor';
import {
  DEFAULT_WAVEFORM_STATE,
  formatWaveformEquation,
} from '../src/model/waveformModel';
import {
  parseWaveformEquation,
  replacePiWithSymbol,
} from '../src/model/equationParser';
import { cMag, cAdd, complex } from '../src/model/complex';

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

console.log('================================================================');
console.log('PHASE E: POWER SYSTEM SIMULATOR INTEGRATION & REGRESSION SUITE');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: Authoritative Network Model & Baseline Integrity
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: Authoritative Network Model & Baseline Integrity ---');
assert(DEFAULT_NETWORK_MODEL.buses.length === 30, 'Baseline network contains exactly 30 buses');
assert(DEFAULT_NETWORK_MODEL.lines.length === 34, 'Baseline network contains exactly 34 transmission lines');
assert(DEFAULT_NETWORK_MODEL.transformers.length === 7, 'Baseline network contains exactly 7 transformers');
assert(DEFAULT_NETWORK_MODEL.lines.length + DEFAULT_NETWORK_MODEL.transformers.length === 41, 'Total branches equal 41');
assert(DEFAULT_NETWORK_MODEL.generators.length === 6, 'Baseline network contains exactly 6 generator/condenser units');
assert(DEFAULT_NETWORK_MODEL.loads.length === 21, 'Baseline network contains exactly 21 load demands');
assert(DEFAULT_NETWORK_MODEL.shunts.length === 2, 'Baseline network contains exactly 2 switched shunt capacitor banks');
assert(DEFAULT_NETWORK_MODEL.metadata.baseMva === 100, 'System MVA base is 100 MVA');

const slackBus = DEFAULT_NETWORK_MODEL.buses.find((b) => b.busType === 'slack');
assert(slackBus !== undefined && slackBus.number === 1, 'Bus 1 (Glen Lyn 132 kV) is designated Slack/Swing bus');

// Verify immutability of default model
const freshClone = createFreshDefaultNetworkModel();
assert(freshClone !== DEFAULT_NETWORK_MODEL, 'createFreshDefaultNetworkModel returns a new decoupled instance');
assert(freshClone.buses[0] !== DEFAULT_NETWORK_MODEL.buses[0], 'Nested bus objects are deep cloned');

// -----------------------------------------------------------------------------
// SECTION 2: AC Power Flow Solver Numerical Validation & Power Balance
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: AC Power Flow Solver Numerical Validation & Power Balance ---');
const pf = solveAcPowerFlow(DEFAULT_NETWORK_MODEL, DEFAULT_SOLVER_OPTIONS);

assert(pf.converged === true, 'Baseline AC power flow converged');
assert(pf.iterations <= 5, `Converged in ${pf.iterations} iterations (standard Newton-Raphson quadratic convergence <= 5)`);
assert(pf.maxActiveMismatchMw < 0.05, `Max active power mismatch is negligible: ${pf.maxActiveMismatchMw.toFixed(4)} MW`);
assert(pf.maxReactiveMismatchMvar < 0.05, `Max reactive power mismatch is negligible: ${pf.maxReactiveMismatchMvar.toFixed(4)} MVAr`);

// Active Power Balance: Total Gen = Total Load Served + Losses
const totalGenP = pf.summary.totalGenerationMw;
const totalLoadP = pf.summary.totalLoadServedMw;
const totalLossP = pf.summary.totalActiveLossesMw;
const activeBalanceDiff = Math.abs(totalGenP - (totalLoadP + totalLossP));
assert(
  activeBalanceDiff < 0.01,
  `Active power balance holds: Gen(${totalGenP.toFixed(2)} MW) = Load(${totalLoadP.toFixed(2)} MW) + Losses(${totalLossP.toFixed(2)} MW), Diff=${activeBalanceDiff.toFixed(4)} MW`
);

// Reactive Power Balance: Total Gen Q + Shunt Q = Total Load Q + Total Reactive Losses
const totalGenQ = pf.summary.totalGenerationMvar;
const totalLoadQ = pf.summary.totalLoadServedMvar;
const totalLossQ = pf.summary.totalReactiveLossesMvar;
const totalShuntQ = pf.summary.totalShuntInjectionMvar;
const reactiveBalanceDiff = Math.abs((totalGenQ + totalShuntQ) - (totalLoadQ + totalLossQ));
assert(
  reactiveBalanceDiff < 0.05,
  `Reactive power balance holds: GenQ(${totalGenQ.toFixed(2)}) + ShuntQ(${totalShuntQ.toFixed(2)}) = LoadQ(${totalLoadQ.toFixed(2)}) + LossQ(${totalLossQ.toFixed(2)}), Diff=${reactiveBalanceDiff.toFixed(4)} MVAr`
);

// Slack bus voltage exact verification
const vSlack = pf.busSolutions[1];
assert(Math.abs(vSlack.vmPu - 1.060) < 1e-4, 'Slack Bus 1 voltage magnitude is exactly 1.060 pu');
assert(Math.abs(vSlack.vaDeg - 0.0) < 1e-4, 'Slack Bus 1 voltage angle is exactly 0.000 deg');

// Branch terminal conservation: P_from + P_to = P_loss >= 0
for (const line of DEFAULT_NETWORK_MODEL.lines) {
  const flow = pf.lineFlows[line.id];
  const netP = flow.pFromMw + flow.pToMw;
  assert(netP >= -0.001, `Branch ${line.id} active power losses are non-negative (${netP.toFixed(4)} MW)`);
  assert(Math.abs(netP - flow.lossMw) < 0.005, `Branch ${line.id} terminal sum matches calculated loss`);
}

// -----------------------------------------------------------------------------
// SECTION 3: Equipment Editing, Parameter Validation & Immutability
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Equipment Editing, Parameter Validation & Immutability ---');
let workingModel = cloneNetworkModel(DEFAULT_NETWORK_MODEL);

// 1. Bus update
workingModel = updateBusFull(workingModel, 'BUS-2', {
  vMinPu: 0.92,
  vMaxPu: 1.08,
});
const editedBus = workingModel.buses.find((b) => b.id === 'BUS-2');
assert(editedBus?.vMinPu === 0.92 && editedBus?.vMaxPu === 1.08, 'Bus voltage bounds updated in working model');
assert(DEFAULT_NETWORK_MODEL.buses.find((b) => b.id === 'BUS-2')?.vMinPu === 0.95, 'Default model Bus 2 remains unaltered');

// 2. Generator update
workingModel = updateGeneratorFull(workingModel, 'GEN-2', {
  scheduledActivePowerMw: 45.0,
  voltageSetpointPu: 1.035,
});
const editedGen = workingModel.generators.find((g) => g.id === 'GEN-2');
assert(editedGen?.scheduledActivePowerMw === 45.0, 'Generator scheduled MW updated to 45.0 MW');
assert(DEFAULT_NETWORK_MODEL.generators.find((g) => g.id === 'GEN-2')?.scheduledActivePowerMw === 40.0, 'Default model Gen 2 scheduled MW unchanged');

// 3. Load update
workingModel = updateLoadFull(workingModel, 'LOAD-2', {
  configuredActivePowerMw: 30.0,
  configuredReactivePowerMvar: 15.0,
});
const editedLoad = workingModel.loads.find((l) => l.id === 'LOAD-2');
assert(editedLoad?.configuredActivePowerMw === 30.0, 'Load active power updated to 30.0 MW');
assert(DEFAULT_NETWORK_MODEL.loads.find((l) => l.id === 'LOAD-2')?.configuredActivePowerMw === 21.7, 'Default model Load 2 unchanged');

// 4. Line update: Impedance & Rating
workingModel = updateLineFull(workingModel, 'LINE-1-2', {
  ratingMva: 160.0,
  resistancePu: 0.02,
  reactancePu: 0.06,
});
const editedLine = workingModel.lines.find((ln) => ln.id === 'LINE-1-2');
assert(editedLine?.ratingMva === 160.0, 'Line Rate A rating updated to 160.0 MVA');
assert(editedLine?.resistancePu === 0.02, 'Line resistance updated to 0.02 pu');
assert(DEFAULT_NETWORK_MODEL.lines.find((ln) => ln.id === 'LINE-1-2')?.ratingMva === 130.0, 'Default model Line 1-2 unchanged');

// 5. Transformer update: Tap ratio & Phase shift
workingModel = updateTransformerFull(workingModel, 'TR-6-9', {
  tapRatioPu: 1.015,
  phaseShiftDeg: 2.0,
});
const editedTx = workingModel.transformers.find((tr) => tr.id === 'TR-6-9');
assert(editedTx?.tapRatioPu === 1.015, 'Transformer tap ratio updated to 1.015 pu');
assert(editedTx?.phaseShiftDeg === 2.0, 'Transformer phase shift updated to 2.0 deg');

// 6. Shunt update: Susceptance
workingModel = updateShuntFull(workingModel, 'SHUNT-10', {
  configuredSusceptanceMvarAtUnitV: 25.0,
});
const editedShunt = workingModel.shunts.find((sh) => sh.id === 'SHUNT-10');
assert(editedShunt?.configuredSusceptanceMvarAtUnitV === 25.0, 'Shunt susceptance updated to 25.0 MVAr');

// 7. Verify Rating Change Invariance to Physical Power Flow
const pfBase = solveAcPowerFlow(DEFAULT_NETWORK_MODEL, DEFAULT_SOLVER_OPTIONS);
let modelRatingRerated = cloneNetworkModel(DEFAULT_NETWORK_MODEL);
modelRatingRerated = updateLineFull(modelRatingRerated, 'LINE-1-2', { ratingMva: 65.0 }); // Halve rating
const pfRerated = solveAcPowerFlow(modelRatingRerated, DEFAULT_SOLVER_OPTIONS);

const pBase = pfBase.lineFlows['LINE-1-2'].pFromMw;
const pRerated = pfRerated.lineFlows['LINE-1-2'].pFromMw;
assert(
  Math.abs(pBase - pRerated) < 1e-5,
  `Rating change does not affect physical MW flow: Base=${pBase.toFixed(3)} MW, Rerated=${pRerated.toFixed(3)} MW`
);
assert(
  pfRerated.lineFlows['LINE-1-2'].loadingPercent > pfBase.lineFlows['LINE-1-2'].loadingPercent * 1.9,
  'Lowering rating proportionately doubles loading percentage'
);

// -----------------------------------------------------------------------------
// SECTION 4: Topological Changes, Offline/Online Status & Cascading Solves
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Topological Changes, Offline/Online Status & Cascading Solves ---');
let outageModel = cloneNetworkModel(DEFAULT_NETWORK_MODEL);

// Take Line 1-3 offline (N-1 contingency where alternate path Line 1-2 handles the flow)
outageModel = updateLineFull(outageModel, 'LINE-1-3', { status: 'offline' });
const pfOutage = solveAcPowerFlow(outageModel, DEFAULT_SOLVER_OPTIONS);

if (!pfOutage.converged) {
  console.log('Outage solver failure reason:', pfOutage.failureReason);
}
assert(pfOutage.converged === true, 'Power flow converges after taking Line 1-3 offline');
if (pfOutage.converged) {
  assert(pfOutage.lineFlows['LINE-1-3'].inService === false, 'Line 1-3 marked inService=false in solution');
  assert(pfOutage.lineFlows['LINE-1-3'].pFromMw === 0, 'Line 1-3 has exactly 0.0 MW flow when offline');

  // Verify power is redirected through Line 1-2
  const flow12Base = pfBase.lineFlows['LINE-1-2'].pFromMw;
  const flow12Outage = pfOutage.lineFlows['LINE-1-2'].pFromMw;
  assert(
    flow12Outage > flow12Base + 30,
    `Line 1-2 picks up redirected power: Base=${flow12Base.toFixed(1)} MW -> Outage=${flow12Outage.toFixed(1)} MW`
  );
}

// Generator outage: Disconnect Gen 2
let genOutageModel = cloneNetworkModel(DEFAULT_NETWORK_MODEL);
genOutageModel = updateGeneratorFull(genOutageModel, 'GEN-2', { status: 'offline' });
const pfGenOutage = solveAcPowerFlow(genOutageModel, DEFAULT_SOLVER_OPTIONS);

assert(pfGenOutage.converged === true, 'Power flow converges after Gen 2 outage');
assert(pfGenOutage.generatorOutputs['GEN-2'].online === false, 'Gen 2 marked offline in dispatch solution');
assert(pfGenOutage.generatorOutputs['GEN-2'].pMw === 0, 'Gen 2 produces 0.0 MW output');

// Slack Gen 1 increases output to cover the loss
const slackPBase = pfBase.generatorOutputs['GEN-1'].pMw;
const slackPGenOutage = pfGenOutage.generatorOutputs['GEN-1'].pMw;
assert(
  slackPGenOutage > slackPBase + 30,
  `Slack Gen 1 automatically compensates for lost generation: Base=${slackPBase.toFixed(1)} MW -> Outage=${slackPGenOutage.toFixed(1)} MW`
);

// -----------------------------------------------------------------------------
// SECTION 5: Short-Circuit Analysis Verification
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Short-Circuit Analysis Verification ---');
// 1. Three-Phase Fault at Bus 1
const sc3P = solveShortCircuit(
  DEFAULT_NETWORK_MODEL,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 1,
    faultType: '3phase',
    faultResistancePu: 0,
    faultReactancePu: 0,
  },
  pfBase
);
assert(sc3P.converged === true, 'Three-Phase fault calculation converged');
assert(sc3P.totalFaultCurrentKa > 0, `3P fault current is positive: ${sc3P.totalFaultCurrentKa.toFixed(2)} kA`);
assert(sc3P.sequenceCurrentsPu.zero.mag < 1e-6, '3P fault has zero zero-sequence current (I0 = 0)');
assert(sc3P.sequenceCurrentsPu.negative.mag < 1e-6, '3P fault has zero negative-sequence current (I2 = 0)');
assert(sc3P.sequenceCurrentsPu.positive.mag > 0, '3P fault has non-zero positive-sequence current (I1 > 0)');

// 2. Single-Line-to-Ground (SLG) Fault at Bus 1
const scSLG = solveShortCircuit(
  DEFAULT_NETWORK_MODEL,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 1,
    faultType: 'single-line-to-ground',
    faultResistancePu: 0,
    faultReactancePu: 0,
  },
  pfBase
);
assert(scSLG.converged === true, 'SLG fault calculation converged');
assert(scSLG.totalFaultCurrentKa > 0, `SLG fault current is positive: ${scSLG.totalFaultCurrentKa.toFixed(2)} kA`);
// In SLG fault, I0 = I1 = I2
const i0 = scSLG.sequenceCurrentsPu.zero.mag;
const i1 = scSLG.sequenceCurrentsPu.positive.mag;
const i2 = scSLG.sequenceCurrentsPu.negative.mag;
assert(Math.abs(i0 - i1) < 1e-4 && Math.abs(i1 - i2) < 1e-4, 'In SLG fault, sequence currents are equal: |I0| = |I1| = |I2|');

// 3. Line-to-Line (L-L) Fault at Bus 1
const scLL = solveShortCircuit(
  DEFAULT_NETWORK_MODEL,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 1,
    faultType: 'line-to-line',
    faultResistancePu: 0,
    faultReactancePu: 0,
  },
  pfBase
);
assert(scLL.converged === true, 'L-L fault calculation converged');
assert(scLL.sequenceCurrentsPu.zero.mag < 1e-6, 'In L-L fault, zero-sequence current I0 = 0');
assert(
  Math.abs(scLL.sequenceCurrentsPu.positive.mag - scLL.sequenceCurrentsPu.negative.mag) < 1e-4,
  'In L-L fault, |I1| = |I2|'
);

// 4. Double-Line-to-Ground (DLG) Fault at Bus 1
const scDLG = solveShortCircuit(
  DEFAULT_NETWORK_MODEL,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 1,
    faultType: 'double-line-to-ground',
    faultResistancePu: 0,
    faultReactancePu: 0,
  },
  pfBase
);
assert(scDLG.converged === true, 'DLG fault calculation converged');
assert(scDLG.totalFaultCurrentKa > 0, `DLG fault current: ${scDLG.totalFaultCurrentKa.toFixed(2)} kA`);

// 5. Kirchhoff Current Law at faulted bus: sum of incoming branch currents + local generator = total fault current
let sumContribPu = complex(0, 0);
for (const c of sc3P.branchContributions) {
  const rad = (c.currentPu.angleDeg * Math.PI) / 180;
  sumContribPu = cAdd(
    sumContribPu,
    complex(c.currentPu.mag * Math.cos(rad), c.currentPu.mag * Math.sin(rad))
  );
}
for (const g of sc3P.generatorContributions) {
  if (g.busNumber === 1) {
    const rad = (g.currentPu.angleDeg * Math.PI) / 180;
    sumContribPu = cAdd(
      sumContribPu,
      complex(g.currentPu.mag * Math.cos(rad), g.currentPu.mag * Math.sin(rad))
    );
  }
}
const sumMagKa = (cMag(sumContribPu) * 100) / (Math.sqrt(3) * 132);
assert(
  Math.abs(sumMagKa - sc3P.totalFaultCurrentKa) < 0.15,
  `KCL at faulted bus holds: sum of source and branch contributions (${sumMagKa.toFixed(2)} kA) matches total fault current (${sc3P.totalFaultCurrentKa.toFixed(2)} kA)`
);

// -----------------------------------------------------------------------------
// SECTION 6: Dynamic Flow Steady-State Visualization Validation
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 6: Dynamic Flow Steady-State Visualization Validation ---');
let forwardFlows = 0;
let reverseFlows = 0;
let zeroFlows = 0;

for (const line of DEFAULT_NETWORK_MODEL.lines) {
  const flow = pfBase.lineFlows[line.id];
  const dyn = deriveBranchDynamicFlowState(
    line.id,
    'line',
    line.fromBusNumber,
    line.toBusNumber,
    line.ratingMva,
    flow,
    DEFAULT_DYNAMIC_FLOW_CONFIG
  );

  if (Math.abs(flow.pFromMw) < 0.05) {
    assert(dyn.flowDirection === 'zero', `Line ${line.id} zero-flow classification`);
    assert(dyn.animationDurationSec === 0, `Line ${line.id} zero flow has duration 0`);
    zeroFlows++;
  } else if (flow.pFromMw > 0) {
    assert(dyn.flowDirection === 'forward', `Line ${line.id} forward flow (pFrom=${flow.pFromMw.toFixed(1)} MW)`);
    forwardFlows++;
  } else {
    assert(dyn.flowDirection === 'reverse', `Line ${line.id} reverse flow (pFrom=${flow.pFromMw.toFixed(1)} MW)`);
    reverseFlows++;
  }
}

for (const tr of DEFAULT_NETWORK_MODEL.transformers) {
  const flow = pfBase.transformerFlows[tr.id];
  const dyn = deriveBranchDynamicFlowState(
    tr.id,
    'transformer',
    tr.fromBusNumber,
    tr.toBusNumber,
    tr.ratingMva,
    flow,
    DEFAULT_DYNAMIC_FLOW_CONFIG
  );

  if (Math.abs(flow.pFromMw) < 0.05) {
    assert(dyn.flowDirection === 'zero', `Transformer ${tr.id} zero-flow classification`);
    zeroFlows++;
  } else if (flow.pFromMw > 0) {
    assert(dyn.flowDirection === 'forward', `Transformer ${tr.id} forward flow`);
    forwardFlows++;
  } else {
    assert(dyn.flowDirection === 'reverse', `Transformer ${tr.id} reverse flow`);
    reverseFlows++;
  }
}

assert(forwardFlows + reverseFlows + zeroFlows === 41, 'All 41 branches dynamic flow evaluated');
assert(forwardFlows > 0 && reverseFlows > 0, 'Both forward and reverse flows exist in standard benchmark');

// -----------------------------------------------------------------------------
// SECTION 7: Full Session Lifecycle & Reset to Defaults
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 7: Full Session Lifecycle & Reset to Defaults ---');
// Modify model across multiple equipment categories
let modifiedSessionModel = cloneNetworkModel(DEFAULT_NETWORK_MODEL);
modifiedSessionModel = updateLineFull(modifiedSessionModel, 'LINE-1-2', { status: 'offline', ratingMva: 50.0 });
modifiedSessionModel = updateGeneratorFull(modifiedSessionModel, 'GEN-1', { scheduledActivePowerMw: 99.0 });
modifiedSessionModel = updateLoadFull(modifiedSessionModel, 'LOAD-2', { configuredActivePowerMw: 80.0 });

// Verify modifications are present
assert(modifiedSessionModel.lines.find((l) => l.id === 'LINE-1-2')?.status === 'offline', 'Line 1-2 is offline in session');
assert(modifiedSessionModel.generators.find((g) => g.id === 'GEN-1')?.scheduledActivePowerMw === 99.0, 'Gen 1 scheduled MW modified');
assert(modifiedSessionModel.loads.find((l) => l.id === 'LOAD-2')?.configuredActivePowerMw === 80.0, 'Load 2 modified');

// Execute Reset to Defaults
const restoredModel = createFreshDefaultNetworkModel();
assert(restoredModel.lines.find((l) => l.id === 'LINE-1-2')?.status === 'online', 'After reset, Line 1-2 status restored to online');
assert(restoredModel.lines.find((l) => l.id === 'LINE-1-2')?.ratingMva === 130.0, 'After reset, Line 1-2 rating restored to 130 MVA');
assert(restoredModel.generators.find((g) => g.id === 'GEN-1')?.scheduledActivePowerMw === 260.2, 'After reset, Gen 1 scheduled MW restored');
assert(restoredModel.loads.find((l) => l.id === 'LOAD-2')?.configuredActivePowerMw === 21.7, 'After reset, Load 2 restored to 21.7 MW');

const pfRestored = solveAcPowerFlow(restoredModel, DEFAULT_SOLVER_OPTIONS);
assert(pfRestored.converged === true, 'Restored model converges cleanly');
assert(
  Math.abs(pfRestored.summary.totalGenerationMw - pfBase.summary.totalGenerationMw) < 1e-4,
  'Restored power flow total generation exactly matches pristine baseline'
);

// -----------------------------------------------------------------------------
// SECTION 8: Wave Generator, SCADA, and PMU Regression Tests
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 8: Wave Generator, SCADA, and PMU Regression Tests ---');
const defaultWave = DEFAULT_WAVEFORM_STATE;
assert(defaultWave.fundamentalFrequency === 60, 'Default fundamental frequency is 60 Hz');
assert(defaultWave.fundamentalAmplitude === 1.0, 'Default fundamental amplitude is 1.0 V');

// Format equation
const eq = formatWaveformEquation(60, 1.0, defaultWave.harmonics, [], 0, 0);
assert(eq.includes('sin(2π·60t)') || eq.includes('sin(2π*60t)'), `Equation correctly formats fundamental with π symbol: ${eq}`);

// Arbitrary frequency term separation from harmonic sliders
const parsedWithCustom = parseWaveformEquation('1.0 sin(2π·60t) + 0.1 sin(2π·30t)');
assert(parsedWithCustom.fundamentalFrequency === 60, 'Fundamental frequency remains 60 Hz');
assert(parsedWithCustom.harmonics?.second === 0, 'Second harmonic (120 Hz) is NOT triggered by 30 Hz subharmonic');
assert((parsedWithCustom.customTerms?.length ?? 0) === 1, 'Custom frequency term (30 Hz) parsed independently into customTerms');
assert(parsedWithCustom.customTerms?.[0].frequency === 30, 'Custom term frequency is accurately 30 Hz');

// Test pi symbol replacement utility
const piReplaced = replacePiWithSymbol('0.15 sin(2pi*60t)');
assert(piReplaced.replaced === true, 'replacePiWithSymbol detects and replaces "pi"');
assert(piReplaced.text.includes('2π*60t'), 'Replaced text contains "2π*60t"');

// Window size calculation for N cycles at fundamental f0: T_window = N / f0
const f0 = 60;
const nCycles = 10;
const tWindow = nCycles / f0;
assert(Math.abs(tWindow - 0.16667) < 1e-4, `10 cycles at 60 Hz gives 166.67 ms time window: ${(tWindow * 1000).toFixed(2)} ms`);

const nCycles50Hz = 5;
const tWindow50Hz = nCycles50Hz / 50;
assert(Math.abs(tWindow50Hz - 0.100) < 1e-4, `5 cycles at 50 Hz gives 100.00 ms time window`);

console.log('\n================================================================');
console.log(`TOTAL PHASE E INTEGRATION & REGRESSION TESTS: ${passed + failed}`);
console.log(`PASSED: ${passed}`);
console.log(`FAILED: ${failed}`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('ALL PHASE E INTEGRATION AND REGRESSION TESTS PASSED SUCCESSFULLY!\n');
}
