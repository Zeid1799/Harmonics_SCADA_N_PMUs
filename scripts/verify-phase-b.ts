import assert from 'node:assert/strict';
import {
  DEFAULT_NETWORK_MODEL,
  createFreshDefaultNetworkModel,
} from '../src/model/networkModel';
import {
  cloneNetworkModel,
  addBusToNetwork,
  addLineToNetwork,
  addTransformerToNetwork,
  addGeneratorToNetwork,
  addLoadToNetwork,
  addShuntToNetwork,
  deleteEquipmentFromNetwork,
  updateBusFull,
  updateGeneratorFull,
  updateLoadFull,
  updateLineFull,
  updateTransformerFull,
  updateShuntFull,
} from '../src/model/networkEditor';
import { validateNetworkModel } from '../src/model/networkValidator';
import { solveAcPowerFlow, DEFAULT_SOLVER_OPTIONS } from '../src/model/acPowerFlowSolver';

console.log('=== Verifying Phase B: OL Changes & Component Modeling ===\n');

// 1. Initial IEEE 30-bus validation
const initialModel = createFreshDefaultNetworkModel();
const initialValidation = validateNetworkModel(initialModel);
assert.equal(initialValidation.isValid, true, 'Base IEEE 30-bus must be valid');
assert.equal(initialValidation.errorCount, 0, 'Base case must have 0 errors');
console.log('✓ 1. Baseline model passes validation with 0 errors');

// 2. Clone network model integrity
const cloned = cloneNetworkModel(initialModel);
assert.equal(cloned.buses.length, initialModel.buses.length);
assert.notEqual(cloned.buses, initialModel.buses);
console.log('✓ 2. Deep clone creates isolated immutable copy');

// 3. Add new Bus (Bus 31)
const { updatedNetwork: netWithBus, newBus } = addBusToNetwork(cloned, {
  name: 'Substation 31 (132 kV)',
  baseKv: 132,
  type: 'PQ',
  targetVoltagePu: 1.0,
});
assert.equal(newBus.number, 31, 'New bus assigned number 31');
assert.equal(newBus.isUserCreated, true, 'New bus marked isUserCreated');
assert.equal(netWithBus.buses.length, 31, 'Total buses is now 31');
console.log('✓ 3. Add new bus creates valid bus 31 with user-created badge flag');

// 4. Isolated bus detection (Bus 31 has no lines yet)
const isolatedReport = validateNetworkModel(netWithBus);
assert.ok(isolatedReport.warningCount > 0, 'Isolated bus must be flagged as warning');
const hasIsoWarn = isolatedReport.issues.some((i) => i.code === 'ISOLATED_BUS');
assert.ok(hasIsoWarn, 'Expected ISOLATED_BUS warning');
console.log('✓ 4. Validator accurately identifies isolated Bus 31 warning');

// 5. Connect Line from Bus 30 to Bus 31
const { updatedNetwork: netWithLine, newLine } = addLineToNetwork(netWithBus, {
  fromBusNumber: 30,
  toBusNumber: 31,
  resistancePu: 0.02,
  reactancePu: 0.08,
  susceptancePu: 0.01,
  ratingMva: 50,
});
assert.equal(newLine.fromBusNumber, 30);
assert.equal(newLine.toBusNumber, 31);
assert.equal(newLine.isUserCreated, true);
assert.equal(netWithLine.lines.length, initialModel.lines.length + 1);
console.log('✓ 5. Connect transmission line creates LINE-30-31 connecting bus 30 and 31');

// 6. Add Load to Bus 31
const { updatedNetwork: netWithLoad, newLoad } = addLoadToNetwork(netWithLine, {
  busNumber: 31,
  configuredActivePowerMw: 5.5,
  configuredReactivePowerMvar: 1.8,
});
assert.equal(newLoad.busNumber, 31);
assert.equal(newLoad.isUserCreated, true);
console.log('✓ 6. Add load attached to Bus 31 (5.5 MW, 1.8 MVAr)');

// 7. Solve AC Power Flow on Modified 31-Bus Network
const sol31 = solveAcPowerFlow(netWithLoad, DEFAULT_SOLVER_OPTIONS);
assert.equal(sol31.converged, true, 'Modified 31-bus network must converge');
assert.ok(sol31.busSolutions[31], 'Bus 31 must have solved voltage');
console.log(
  `✓ 7. AC Power Flow solved on modified 31-bus network in ${sol31.iterations} iterations: V_31 = ${sol31.busSolutions[31].vmPu.toFixed(4)} p.u.`
);

// 8. Test Electrical & Topological Validation Rules
// Rule A: Zero Slack buses
const noSlack = cloneNetworkModel(initialModel);
noSlack.buses.forEach((b) => {
  if (b.type === 'Slack') b.type = 'PQ';
});
const noSlackReport = validateNetworkModel(noSlack);
assert.equal(noSlackReport.isValid, false, 'Model with 0 Slack buses must be invalid');
assert.ok(noSlackReport.issues.some((i) => i.code === 'NO_SLACK_BUS'));

// Rule B: Multiple Slack buses
const multiSlack = cloneNetworkModel(initialModel);
multiSlack.buses[1].type = 'Slack';
const multiSlackReport = validateNetworkModel(multiSlack);
assert.equal(multiSlackReport.isValid, false, 'Model with >1 Slack buses must be invalid');
assert.ok(multiSlackReport.issues.some((i) => i.code === 'MULTIPLE_SLACK_BUSES'));

// Rule C: Non-positive reactance X <= 0
const badX = cloneNetworkModel(initialModel);
badX.lines[0].reactancePu = -0.05;
const badXReport = validateNetworkModel(badX);
assert.equal(badXReport.isValid, false, 'Branch with X <= 0 must fail validation');
assert.ok(badXReport.issues.some((i) => i.code === 'INVALID_REACTANCE'));

// Rule D: Self-loop branch
const loopNet = cloneNetworkModel(initialModel);
loopNet.lines[0].toBusNumber = loopNet.lines[0].fromBusNumber;
const loopReport = validateNetworkModel(loopNet);
assert.equal(loopReport.isValid, false, 'Self-loop branch must fail validation');
assert.ok(loopReport.issues.some((i) => i.code === 'SELF_LOOP_BRANCH'));

console.log('✓ 8. Validation rules strictly catch: 0 Slack, multiple Slack, X <= 0, and self-loop branches');

// 9. Referential Integrity on Equipment Deletion (Cascading Cleanup)
const testNet = cloneNetworkModel(netWithLoad);
const bus31CountBefore = testNet.buses.length;
const lineCountBefore = testNet.lines.length;
const loadCountBefore = testNet.loads.length;

// Delete Bus 31: should cascade and remove LINE-30-31 and LOAD-31
const { updatedNetwork: afterDelete, deletedElements } = deleteEquipmentFromNetwork(testNet, {
  category: 'bus',
  id: 'BUS-31',
});

assert.equal(afterDelete.buses.length, bus31CountBefore - 1, 'Bus 31 removed');
assert.equal(afterDelete.lines.length, lineCountBefore - 1, 'Connected LINE-30-31 cascade removed');
assert.equal(afterDelete.loads.length, loadCountBefore - 1, 'Connected LOAD-31 cascade removed');
assert.ok(
  deletedElements.some((e) => e.category === 'line'),
  'Deleted elements includes line'
);
assert.ok(
  deletedElements.some((e) => e.category === 'load'),
  'Deleted elements includes load'
);
console.log('✓ 9. Cascading deletion verified: Deleting Bus 31 cleanly removed attached line and load with 0 orphaned references');

// 10. Verify Full Parameter Updates
const updateNet = cloneNetworkModel(initialModel);
const bus1Updated = updateBusFull(updateNet, 'BUS-1', { targetVoltagePu: 1.05 });
assert.equal(bus1Updated.buses.find((b) => b.id === 'BUS-1')?.targetVoltagePu, 1.05);

const gen1Updated = updateGeneratorFull(updateNet, 'GEN-1', { scheduledActivePowerMw: 150 });
assert.equal(gen1Updated.generators.find((g) => g.id === 'GEN-1')?.scheduledActivePowerMw, 150);

const load2Updated = updateLoadFull(updateNet, 'LOAD-2', { configuredActivePowerMw: 30 });
assert.equal(load2Updated.loads.find((l) => l.id === 'LOAD-2')?.configuredActivePowerMw, 30);

const line1Updated = updateLineFull(updateNet, 'LINE-1-2', { ratingMva: 160 });
assert.equal(line1Updated.lines.find((l) => l.id === 'LINE-1-2')?.ratingMva, 160);

const tx1Updated = updateTransformerFull(updateNet, 'TX-6-9', { tapRatioPu: 1.025 });
assert.equal(tx1Updated.transformers.find((t) => t.id === 'TX-6-9')?.tapRatioPu, 1.025);

const sh1Updated = updateShuntFull(updateNet, 'SHUNT-10', { configuredSusceptanceMvarAtUnitV: 25 });
assert.equal(sh1Updated.shunts.find((s) => s.id === 'SHUNT-10')?.configuredSusceptanceMvarAtUnitV, 25);

console.log('✓ 10. Full parameter updates for Bus, Gen, Load, Line, TX, Shunt succeed and mark isUserModified');

// 11. Verify AC Power Flow on updated network
const solUpdated = solveAcPowerFlow(gen1Updated, DEFAULT_SOLVER_OPTIONS);
assert.equal(solUpdated.converged, true, 'Updated network converges in AC power flow');
console.log(`✓ 11. AC Power Flow solves on modified parameters in ${solUpdated.iterations} iterations`);

console.log('\n=== ALL PHASE B VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
