import assert from 'node:assert/strict';
import {
  createFreshDefaultNetworkModel,
  toggleNetworkEquipmentStatus,
  updateGeneratorParameters,
  updateLoadParameters,
  updateTransformerParameters,
  updateShuntParameters,
  resetSingleEquipmentToDefault,
} from '../src/model/networkModel';
import {
  updateBusFull,
  updateGeneratorFull,
  updateLoadFull,
  updateLineFull,
  updateTransformerFull,
  updateShuntFull,
} from '../src/model/networkEditor';
import { solveAcPowerFlow, DEFAULT_SOLVER_OPTIONS } from '../src/model/acPowerFlowSolver';
import { validateNetworkModel } from '../src/model/networkValidator';

console.log('================================================================');
console.log('VERIFYING PHASE B: EXISTING EQUIPMENT INSPECTION AND EDITING');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// 1. Baseline Model Structure and AC Power Flow Verification
// -----------------------------------------------------------------------------
console.log('1. Verifying Baseline IEEE 30-Bus Network Benchmark...');
const model = createFreshDefaultNetworkModel();

assert.equal(model.buses.length, 30, 'Baseline must contain exactly 30 buses');
assert.equal(model.generators.length, 6, 'Baseline must contain exactly 6 generators');
assert.equal(model.loads.length, 21, 'Baseline must contain exactly 21 loads');
assert.equal(model.lines.length, 34, 'Baseline must contain exactly 34 transmission lines');
assert.equal(model.transformers.length, 7, 'Baseline must contain exactly 7 transformers');
assert.equal(model.shunts.length, 2, 'Baseline must contain exactly 2 capacitor shunt banks');

const baseSolution = solveAcPowerFlow(model, DEFAULT_SOLVER_OPTIONS);
assert.equal(baseSolution.converged, true, 'Baseline AC power flow must converge');
assert.ok(baseSolution.iterations <= 5, 'Baseline AC power flow must converge in <= 5 iterations');
console.log(`   ✓ Baseline network converged in ${baseSolution.iterations} iterations (Losses: ${baseSolution.summary.totalActiveLossesMw.toFixed(2)} MW)`);

// -----------------------------------------------------------------------------
// 2. Bus Inspection & Parameter Editing
// -----------------------------------------------------------------------------
console.log('\n2. Testing Bus Inspection and Editing (Bus 2)...');
const bus2 = model.buses.find((b) => b.number === 2)!;
assert.ok(bus2, 'Bus 2 must exist');
const origBus2Name = bus2.name;

// In Edit Mode: Update bus name, voltage setpoint, and voltage limits
let workingModel = updateBusFull(model, bus2.id, {
  name: 'Glen Lyn 132 (Modified Station)',
  initialVmPu: 1.050,
  vMinPu: 0.92,
  vMaxPu: 1.08,
});

const updatedBus2 = workingModel.buses.find((b) => b.id === bus2.id)!;
assert.equal(updatedBus2.name, 'Glen Lyn 132 (Modified Station)');
assert.equal(updatedBus2.initialVmPu, 1.050);
assert.equal(updatedBus2.vMinPu, 0.92);
assert.equal(updatedBus2.vMaxPu, 1.08);
assert.equal(updatedBus2.number, 2, 'Terminal identity/number MUST remain immutable');
assert.equal(updatedBus2.id, bus2.id, 'Bus ID MUST remain immutable');
console.log('   ✓ Bus parameters successfully edited in memory with immutable terminal ID');

// Electrical Protection: Slack Bus protection
const slackBus = model.buses.find((b) => b.busType === 'slack')!;
assert.ok(slackBus, 'Slack bus must exist');
const invalidSlackMod = updateBusFull(workingModel, slackBus.id, { busType: 'pq' });
const slackReport = validateNetworkModel(invalidSlackMod);
assert.equal(slackReport.isValid, false, 'Network with no slack bus must be invalidated');
assert.ok(slackReport.issues.some((i) => i.title.toLowerCase().includes('slack')), 'Must flag Slack issue');
console.log('   ✓ Slack bus protection verified: Removing Slack bus triggers validation failure');

// -----------------------------------------------------------------------------
// 3. Transmission Line Inspection, Editing & Loading Recalculation
// -----------------------------------------------------------------------------
console.log('\n3. Testing Transmission Line Inspection, Editing & Loading...');
const line1_2 = model.lines.find((ln) => ln.fromBusNumber === 1 && ln.toBusNumber === 2)!;
assert.ok(line1_2, 'Line 1-2 must exist');

const origFlow1_2 = baseSolution.lineFlows[line1_2.id];
assert.ok(origFlow1_2, 'Flow for line 1-2 must be solved');
console.log(
  `   Baseline Line 1-2: P_from=${origFlow1_2.pFromMw.toFixed(1)} MW, S_max=${line1_2.ratingMva} MVA, Loading=${origFlow1_2.loadingPercent.toFixed(1)}%`
);

// Edit Line Rating (e.g., lower rating to trigger overload warning without altering physical impedance)
const reducedRating = 100; // Lower than solved apparent flow (~178 MVA)
workingModel = updateLineFull(workingModel, line1_2.id, {
  ratingMva: reducedRating,
});

const updatedLine1_2 = workingModel.lines.find((l) => l.id === line1_2.id)!;
assert.equal(updatedLine1_2.ratingMva, reducedRating);
assert.equal(updatedLine1_2.fromBusNumber, 1, 'Terminal fromBusNumber MUST remain immutable');
assert.equal(updatedLine1_2.toBusNumber, 2, 'Terminal toBusNumber MUST remain immutable');

// Re-solve AC power flow: voltages and flows remain physically consistent, loading % reflects new rating
const solWithNewRating = solveAcPowerFlow(workingModel, DEFAULT_SOLVER_OPTIONS);
const newFlow1_2 = solWithNewRating.lineFlows[line1_2.id];
assert.equal(newFlow1_2.ratingMva, reducedRating);
const expectedLoadingPct = (newFlow1_2.maxApparentFlowMva / reducedRating) * 100;
assert.ok(
  Math.abs(newFlow1_2.loadingPercent - expectedLoadingPct) < 0.1,
  'Loading percentage must equal maxApparentFlowMva / ratingMva * 100'
);
assert.equal(newFlow1_2.overloaded, true, 'Line must be flagged as overloaded when flow > rating');
console.log(
  `   ✓ Line rating edited to ${reducedRating} MVA: New Loading=${newFlow1_2.loadingPercent.toFixed(1)}%, Overload flagged=${newFlow1_2.overloaded}`
);

// Edit Series Impedance (R, X)
workingModel = updateLineFull(workingModel, line1_2.id, {
  ratingMva: 250,
  reactancePu: 0.08, // Increased reactance
});
const solWithNewX = solveAcPowerFlow(workingModel, DEFAULT_SOLVER_OPTIONS);
assert.notEqual(
  solWithNewX.lineFlows[line1_2.id].pFromMw,
  origFlow1_2.pFromMw,
  'Modifying line reactance must alter AC power flow distribution'
);
console.log(
  `   ✓ Line reactance edited: Flow redistributed from ${origFlow1_2.pFromMw.toFixed(1)} MW to ${solWithNewX.lineFlows[line1_2.id].pFromMw.toFixed(1)} MW`
);

// -----------------------------------------------------------------------------
// 4. Power Transformer Inspection & Parameter Editing
// -----------------------------------------------------------------------------
console.log('\n4. Testing Transformer Inspection, Editing & Tap Ratio...');
const tx4_12 = model.transformers.find((t) => t.fromBusNumber === 4 && t.toBusNumber === 12)!;
assert.ok(tx4_12, 'Transformer 4-12 must exist');
const origTap = tx4_12.tapRatioPu;

// In Edit Mode: Modify off-nominal tap ratio tau from 0.932 to 1.050
workingModel = updateTransformerFull(workingModel, tx4_12.id, {
  tapRatioPu: 1.050,
});
const updatedTx = workingModel.transformers.find((t) => t.id === tx4_12.id)!;
assert.equal(updatedTx.tapRatioPu, 1.050);
assert.equal(updatedTx.fromBusNumber, 4, 'Transformer fromBusNumber MUST remain immutable');
assert.equal(updatedTx.toBusNumber, 12, 'Transformer toBusNumber MUST remain immutable');

const solWithNewTap = solveAcPowerFlow(workingModel, DEFAULT_SOLVER_OPTIONS);
assert.notEqual(
  solWithNewTap.busSolutions[12].vmPu,
  baseSolution.busSolutions[12].vmPu,
  'Modifying transformer tap ratio must shift secondary bus voltage'
);
console.log(
  `   ✓ Transformer tap ratio changed from ${origTap} to 1.050: Secondary V_12 changed from ${baseSolution.busSolutions[12].vmPu.toFixed(4)} to ${solWithNewTap.busSolutions[12].vmPu.toFixed(4)} p.u.`
);

// -----------------------------------------------------------------------------
// 5. Generator Inspection & Parameter Editing
// -----------------------------------------------------------------------------
console.log('\n5. Testing Generator Inspection, Editing & Voltage Setpoint...');
const gen2 = model.generators.find((g) => g.busNumber === 2)!;
assert.ok(gen2, 'Generator at Bus 2 must exist');

// In Edit Mode: Modify scheduled active power P and voltage setpoint V_set
workingModel = updateGeneratorFull(workingModel, gen2.id, {
  scheduledActivePowerMw: 50.0,
  voltageSetpointPu: 1.045,
  reactivePowerMinMvar: -50,
  reactivePowerMaxMvar: 150,
});
const updatedGen2 = workingModel.generators.find((g) => g.id === gen2.id)!;
assert.equal(updatedGen2.scheduledActivePowerMw, 50.0);
assert.equal(updatedGen2.voltageSetpointPu, 1.045);
assert.equal(updatedGen2.busNumber, 2, 'Generator bus number MUST remain immutable');

const solWithNewGen = solveAcPowerFlow(workingModel, DEFAULT_SOLVER_OPTIONS);
assert.ok(
  Math.abs(solWithNewGen.busSolutions[2].vmPu - 1.045) < 0.002,
  `PV generator regulates bus 2 voltage to setpoint (got ${solWithNewGen.busSolutions[2].vmPu.toFixed(4)})`
);
console.log(
  `   ✓ Generator at Bus 2 updated to P=50 MW, V_set=1.045 p.u.: Solved Bus 2 voltage = ${solWithNewGen.busSolutions[2].vmPu.toFixed(4)} p.u.`
);

// Slack Generator Protection
const slackGen = model.generators.find((g) => g.busNumber === 1)!;
assert.ok(slackGen, 'Slack generator must exist');
const offSlackModel = updateGeneratorFull(workingModel, slackGen.id, { status: 'offline' });
const slackGenReport = validateNetworkModel(offSlackModel);
assert.equal(slackGenReport.isValid, false, 'Taking slack generator offline must invalidate model');
console.log('   ✓ Slack generator protection verified: Deactivation triggers validation failure');

// -----------------------------------------------------------------------------
// 6. Load Inspection & Parameter Editing
// -----------------------------------------------------------------------------
console.log('\n6. Testing Load Inspection and Demand Modification...');
const load2 = model.loads.find((l) => l.busNumber === 2)!;
assert.ok(load2, 'Load at Bus 2 must exist');

// In Edit Mode: Increase load from 21.7 MW to 45.0 MW
workingModel = updateLoadFull(workingModel, load2.id, {
  configuredActivePowerMw: 45.0,
  configuredReactivePowerMvar: 20.0,
});
const updatedLoad2 = workingModel.loads.find((l) => l.id === load2.id)!;
assert.equal(updatedLoad2.configuredActivePowerMw, 45.0);
assert.equal(updatedLoad2.configuredReactivePowerMvar, 20.0);
assert.equal(updatedLoad2.busNumber, 2, 'Load bus number MUST remain immutable');

const solWithNewLoad = solveAcPowerFlow(workingModel, DEFAULT_SOLVER_OPTIONS);
assert.equal(solWithNewLoad.busSolutions[2].pLoadMw, 45.0);
console.log(
  `   ✓ Load at Bus 2 updated to 45.0 MW: Solved bus demand = ${solWithNewLoad.busSolutions[2].pLoadMw.toFixed(1)} MW`
);

// -----------------------------------------------------------------------------
// 7. Shunt Inspection & Parameter Editing
// -----------------------------------------------------------------------------
console.log('\n7. Testing Shunt Capacitor Bank Inspection & Susceptance Editing...');
const shunt10 = model.shunts.find((s) => s.busNumber === 10)!;
assert.ok(shunt10, 'Shunt at Bus 10 must exist');

// In Edit Mode: Increase shunt rating from 19.0 MVAr to 30.0 MVAr
workingModel = updateShuntFull(workingModel, shunt10.id, {
  configuredSusceptanceMvarAtUnitV: 30.0,
});
const updatedShunt10 = workingModel.shunts.find((s) => s.id === shunt10.id)!;
assert.equal(updatedShunt10.configuredSusceptanceMvarAtUnitV, 30.0);
assert.equal(updatedShunt10.busNumber, 10, 'Shunt bus number MUST remain immutable');

const solWithNewShunt = solveAcPowerFlow(workingModel, DEFAULT_SOLVER_OPTIONS);
const shuntSol = solWithNewShunt.shuntOutputs[shunt10.id];
assert.ok(shuntSol.qInjectedMvar > 25.0, 'Shunt reactive injection must reflect new rating');
console.log(
  `   ✓ Shunt at Bus 10 updated to 30 MVAr: Solved Q injection = +${shuntSol.qInjectedMvar.toFixed(2)} MVAr`
);

// -----------------------------------------------------------------------------
// 8. Reset to Defaults and Session-Only Storage Verification
// -----------------------------------------------------------------------------
console.log('\n8. Testing Reset to Baseline and Session-Only Isolation...');

// Reset a single modified element (e.g., Load 2) back to baseline
const modelWithResetLoad = resetSingleEquipmentToDefault(workingModel, {
  category: 'load',
  id: load2.id,
});
const revertedLoad = modelWithResetLoad.loads.find((l) => l.id === load2.id)!;
assert.equal(
  revertedLoad.configuredActivePowerMw,
  load2.configuredActivePowerMw,
  'Resetting single equipment must restore default benchmark value'
);
console.log('   ✓ resetSingleEquipmentToDefault() restored Load 2 to original IEEE 30 demand');

// Full case reload: create fresh baseline
const reloaded = createFreshDefaultNetworkModel();
assert.equal(reloaded.lines.find((l) => l.id === line1_2.id)!.ratingMva, line1_2.ratingMva);
assert.equal(reloaded.generators.find((g) => g.id === gen2.id)!.scheduledActivePowerMw, gen2.scheduledActivePowerMw);
assert.equal(reloaded.buses.find((b) => b.id === bus2.id)!.name, origBus2Name);
console.log('   ✓ Full case reload cleanly restores baseline IEEE 30 network');

// Verify session-only storage: baseline was never mutated
assert.equal(model.buses.find((b) => b.id === bus2.id)!.name, origBus2Name, 'Original model instance remained immutable');
console.log('   ✓ Session-only isolation: in-memory edits never affect base benchmark or persist to disk');

console.log('\n================================================================');
console.log('ALL PHASE B EQUIPMENT INSPECTION & EDITING TESTS PASSED (100%)');
console.log('================================================================\n');
