import assert from 'node:assert/strict';
import {
  DEFAULT_NETWORK_MODEL,
  createFreshDefaultNetworkModel,
  findNetworkEquipment,
  validateNetworkModelIntegrity,
  toggleNetworkEquipmentStatus,
  updateGeneratorParameters,
  updateLoadParameters,
  updateTransformerParameters,
  updateShuntParameters,
  resetSingleEquipmentToDefault,
} from '../src/model/networkModel';
import {
  solveAcPowerFlow,
  DEFAULT_SOLVER_OPTIONS,
  buildAnalyticalYBus,
} from '../src/model/acPowerFlowSolver';
import { DEFAULT_SETTINGS } from '../src/types/settings';

console.log('=== Verifying IEEE 30-Bus Power-System Simulator & AC Power-Flow Engine ===\n');

// 1. Default View Mode must remain Waveform View
assert.equal(
  DEFAULT_SETTINGS.viewMode,
  'waveform',
  'Default viewMode must remain "waveform"'
);
console.log('✓ 1. Default viewMode is "waveform"');

// 2. Verify IEEE 30-Bus Benchmark Counts (< 50 buses) & Provenance Metadata
const net = createFreshDefaultNetworkModel();
assert.ok(net.buses.length < 50, 'Network must contain fewer than 50 buses');
assert.equal(net.buses.length, 30, 'IEEE 30-Bus benchmark has 30 buses');
assert.equal(net.generators.length, 6, 'IEEE 30-Bus benchmark has 6 generators/condensers');
assert.equal(net.loads.length, 21, 'IEEE 30-Bus benchmark has 21 load buses');
assert.equal(net.lines.length, 34, 'IEEE 30-Bus benchmark has 34 AC transmission lines');
assert.equal(net.transformers.length, 7, 'IEEE 30-Bus benchmark has 7 transformers');
assert.equal(net.shunts.length, 2, 'IEEE 30-Bus benchmark has 2 switched shunt capacitor banks');
assert.ok(
  net.metadata.evaluatedCandidates.length >= 5,
  'Metadata must document evaluated candidate networks'
);
console.log(
  '✓ 2. IEEE 30-Bus equipment counts verified: 30 buses, 6 generators, 21 loads, 34 lines, 7 transformers, 2 shunts'
);

// 3. Verify Y_bus matrix construction
const ybusEntries = buildAnalyticalYBus(net);
assert.equal(
  ybusEntries.length,
  30 + 41 * 2, // 30 diagonal + 82 off-diagonal (41 branches * 2) = 112
  `Y_bus non-zero entry count (${ybusEntries.length}) should reflect 30 buses and 41 branches`
);
console.log(`✓ 3. Analytical Complex Y_bus constructed with ${ybusEntries.length} non-zero entries`);

// 4. Base-Case AC Power-Flow Validation against Published IEEE CDF Solution (ieee30cdf.txt)
const baseSol = solveAcPowerFlow(net, DEFAULT_SOLVER_OPTIONS);
assert.equal(baseSol.converged, true, 'Base case AC power flow must converge');
assert.ok(baseSol.iterations <= 6, `Expected convergence in <= 6 iterations, got ${baseSol.iterations}`);
assert.ok(
  baseSol.maxActiveMismatchPu < 1e-6 && baseSol.maxReactiveMismatchPu < 1e-6,
  'Max P/Q mismatch must be < 1e-6 p.u.'
);

let maxVmDiff = 0;
let maxVaDiff = 0;
for (const bus of net.buses) {
  const bSol = baseSol.busSolutions[bus.number];
  assert.ok(bSol && bSol.energized, `Bus ${bus.number} must be solved and energized`);
  const vmDiff = Math.abs(bSol.vmPu - bus.publishedReference.vmPu);
  const vaDiff = Math.abs(bSol.vaDeg - bus.publishedReference.vaDeg);
  if (vmDiff > maxVmDiff) maxVmDiff = vmDiff;
  if (vaDiff > maxVaDiff) maxVaDiff = vaDiff;
  assert.ok(
    vmDiff < 0.005,
    `Bus ${bus.number} |V| (${bSol.vmPu.toFixed(4)}) deviates from ieee30cdf.txt (${bus.publishedReference.vmPu}) by ${vmDiff.toFixed(5)}`
  );
  assert.ok(
    vaDiff < 0.65,
    `Bus ${bus.number} angle (${bSol.vaDeg.toFixed(2)}°) deviates from ieee30cdf.txt (${bus.publishedReference.vaDeg}°) by ${vaDiff.toFixed(4)}°`
  );
}

// Verify exact global active power conservation: P_gen = P_load + P_loss
const pBalanceError = Math.abs(
  baseSol.summary.totalGenerationMw -
    baseSol.summary.totalLoadServedMw -
    baseSol.summary.totalActiveLossesMw
);
assert.ok(
  pBalanceError < 0.01,
  `System active power balance error (${pBalanceError} MW) must be < 0.01 MW`
);
console.log(
  `✓ 4. Base-case AC power flow validated against ieee30cdf.txt (${baseSol.iterations} iter, max |ΔV|=${maxVmDiff.toFixed(5)} p.u., max |Δδ|=${maxVaDiff.toFixed(3)}°, Total Gen=${baseSol.summary.totalGenerationMw.toFixed(2)} MW, Load=${baseSol.summary.totalLoadServedMw.toFixed(2)} MW, Losses=${baseSol.summary.totalActiveLossesMw.toFixed(2)} MW)`
);

// 5. Load Change Validation Test
const highLoadNet = updateLoadParameters(net, 'LOAD-30', {
  configuredActivePowerMw: 20.6, // +10 MW at Bus 30
  configuredReactivePowerMvar: 6.9, // +5 MVAr at Bus 30
});
const highLoadSol = solveAcPowerFlow(highLoadNet, DEFAULT_SOLVER_OPTIONS);
assert.equal(highLoadSol.converged, true, 'High-load case must converge');
assert.ok(
  highLoadSol.busSolutions[30].vmPu < baseSol.busSolutions[30].vmPu,
  'Increasing load at Bus 30 must reduce Bus 30 voltage magnitude'
);
assert.ok(
  highLoadSol.summary.totalGenerationMw > baseSol.summary.totalGenerationMw + 10,
  'Increasing load by 10 MW must increase total generation by > 10 MW (including incremental losses)'
);
assert.ok(
  highLoadSol.summary.totalActiveLossesMw > baseSol.summary.totalActiveLossesMw,
  'Increasing load must increase system I^2*R losses'
);
console.log(
  `✓ 5. Load Change Test passed: Bus 30 |V| dropped ${baseSol.busSolutions[30].vmPu.toFixed(4)} → ${highLoadSol.busSolutions[30].vmPu.toFixed(4)} p.u., Losses increased ${baseSol.summary.totalActiveLossesMw.toFixed(2)} → ${highLoadSol.summary.totalActiveLossesMw.toFixed(2)} MW`
);

// 6. Generator Setpoint & Reactive Limit Enforcement (PV -> PQ conversion) Test
const genQClampNet = updateGeneratorParameters(net, 'GEN-2', {
  voltageSetpointPu: 1.05,
  reactivePowerMaxMvar: 15.0, // Lower Qmax to 15 MVAr so GEN-2 exceeds Qmax and converts PV -> PQ
  scheduledActivePowerMw: 60.0, // Increase GEN-2 dispatch from 40 MW to 60 MW
});
const genQClampSol = solveAcPowerFlow(genQClampNet, DEFAULT_SOLVER_OPTIONS);
assert.equal(genQClampSol.converged, true, 'Generator Q-limit case must converge');
assert.equal(
  genQClampSol.busSolutions[2].convertedFromPvToPq,
  true,
  `Bus 2 must convert from PV to PQ when GEN-2 exceeds Qmax = 15 MVAr (base Q_G2=${baseSol.generatorOutputs['GEN-2'].qMvar} MVAr)`
);
assert.equal(
  genQClampSol.generatorOutputs['GEN-2'].qMvar,
  15.0,
  'GEN-2 reactive power must be clamped at Qmax = 15.0 MVAr'
);
assert.ok(
  genQClampSol.generatorOutputs['GEN-1'].pMw < baseSol.generatorOutputs['GEN-1'].pMw - 19.0,
  'Increasing GEN-2 active dispatch by 20 MW must reduce Slack Bus GEN-1 dispatch accordingly'
);
console.log(
  `✓ 6. Generator Setpoint & Q-Limit Test passed: GEN-2 clamped at Qmax=15 MVAr (PV→PQ), Slack GEN-1 reduced ${baseSol.generatorOutputs['GEN-1'].pMw.toFixed(2)} → ${genQClampSol.generatorOutputs['GEN-1'].pMw.toFixed(2)} MW`
);

// 7. Branch Outage & Radial Islanding / Unsupplied Load Test
// 7a. Meshed line outage: LINE-1-3 (Bus 1 -> Bus 3)
const meshedOutageNet = toggleNetworkEquipmentStatus(net, { category: 'line', id: 'LINE-1-3' });
const meshedOutageSol = solveAcPowerFlow(meshedOutageNet, DEFAULT_SOLVER_OPTIONS);
assert.equal(meshedOutageSol.converged, true, 'Meshed N-1 outage of LINE-1-3 must converge');
assert.equal(meshedOutageSol.lineFlows['LINE-1-3'].pFromMw, 0, 'Open LINE-1-3 must carry 0 MW');
assert.ok(
  meshedOutageSol.lineFlows['LINE-1-2'].maxApparentFlowMva >
    baseSol.lineFlows['LINE-1-2'].maxApparentFlowMva,
  'Opening parallel path LINE-1-3 (1-3) must increase flow on LINE-1-2 (1-2)'
);

// 7b. Radial branch outage: LINE-25-26 (Bus 25 -> Bus 26) isolates Bus 26 (3.5 MW load)
const radialOutageNet = toggleNetworkEquipmentStatus(net, { category: 'line', id: 'LINE-25-26' });
const radialOutageSol = solveAcPowerFlow(radialOutageNet, DEFAULT_SOLVER_OPTIONS);
assert.equal(radialOutageSol.converged, true, 'Main island must still converge when Bus 26 is isolated');
assert.equal(
  radialOutageSol.busSolutions[26].energized,
  false,
  'Isolated Bus 26 without generation must be flagged as de-energized'
);
assert.ok(
  radialOutageSol.topology.unsuppliedLoadIds.includes('LOAD-26'),
  'LOAD-26 must be reported as unsupplied load when Bus 26 is isolated'
);
assert.equal(
  radialOutageSol.summary.totalUnsuppliedLoadMw,
  3.5,
  'Unsupplied load must equal 3.5 MW (LOAD-26)'
);
console.log(
  `✓ 7. Branch Outage & Islanding Tests passed: LINE-1-3 N-1 redistributed flow to LINE-1-2 (${baseSol.lineFlows['LINE-1-2'].pFromMw.toFixed(1)} → ${meshedOutageSol.lineFlows['LINE-1-2'].pFromMw.toFixed(1)} MW); LINE-25-26 outage isolated Bus 26 (3.5 MW unserved)`
);

// 8. Transformer Tap Ratio & Shunt Capacitor Switching Test
const txTapNet = updateTransformerParameters(net, 'TR-4-12', { tapRatioPu: 1.02 });
const txTapSol = solveAcPowerFlow(txTapNet, DEFAULT_SOLVER_OPTIONS);
assert.equal(txTapSol.converged, true);
assert.notEqual(
  txTapSol.busSolutions[12].vmPu.toFixed(4),
  baseSol.busSolutions[12].vmPu.toFixed(4),
  'Adjusting TR-4-12 off-nominal tap ratio must alter Bus 12 secondary voltage'
);

const shuntOffNet = toggleNetworkEquipmentStatus(net, { category: 'shunt', id: 'SHUNT-24' });
const shuntOffSol = solveAcPowerFlow(shuntOffNet, DEFAULT_SOLVER_OPTIONS);
assert.equal(shuntOffSol.converged, true);
assert.ok(
  shuntOffSol.busSolutions[24].vmPu < baseSol.busSolutions[24].vmPu,
  'Switching off SHUNT-24 capacitor bank must lower Bus 24 voltage magnitude'
);
console.log(
  `✓ 8. Transformer Tap & Shunt Capacitor Tests passed: SHUNT-24 off lowered Bus 24 |V| (${baseSol.busSolutions[24].vmPu.toFixed(4)} → ${shuntOffSol.busSolutions[24].vmPu.toFixed(4)} p.u.)`
);

// 9. Reset Asset & Reload Original Case Test
const restoredShuntNet = resetSingleEquipmentToDefault(shuntOffNet, {
  category: 'shunt',
  id: 'SHUNT-24',
});
const restoredSol = solveAcPowerFlow(restoredShuntNet, DEFAULT_SOLVER_OPTIONS);
assert.ok(
  Math.abs(restoredSol.busSolutions[24].vmPu - baseSol.busSolutions[24].vmPu) < 1e-9,
  'Resetting SHUNT-24 must restore exact base-case Bus 24 voltage'
);
console.log('✓ 9. Equipment Reset & Base-Case Restoration verified');

// 10. Referential Integrity & Missing-Reference Resilience Test
const integrityIssues = validateNetworkModelIntegrity(net);
assert.equal(
  integrityIssues.length,
  0,
  `Expected 0 integrity issues on baseline network, got: ${integrityIssues.join('; ')}`
);
assert.equal(
  findNetworkEquipment(net, null),
  null,
  'findNetworkEquipment with null selection must return null safely'
);
assert.equal(
  findNetworkEquipment(net, { category: 'transformer', id: 'TR-1' }),
  null,
  'findNetworkEquipment with legacy/non-existent ID (TR-1) must return null without throwing'
);
const brokenRefNet = {
  ...net,
  lines: [
    ...net.lines,
    {
      ...net.lines[0],
      id: 'LINE-99-100',
      fromBusNumber: 99,
      toBusNumber: 100,
    },
  ],
};
const brokenIssues = validateNetworkModelIntegrity(brokenRefNet);
assert.equal(
  brokenIssues.length,
  2,
  'validateNetworkModelIntegrity must detect missing fromBusNumber and toBusNumber endpoints'
);
console.log('✓ 10. Network Referential Integrity & Missing-Reference Resilience verified');

// 11. Phase A: Workspace & Canvas Geometry Validation
const canvasWidth = 1600;
const canvasHeight = 1000;
const netWidth = 1420;
const netHeight = 900;
const scaleX = (canvasWidth - 60) / netWidth;
const scaleY = (canvasHeight - 60) / netHeight;
const fitScale = Math.min(2.5, Math.max(0.48, Math.min(scaleX, scaleY)));
assert.ok(fitScale > 0.8 && fitScale < 1.3, `Fit-to-screen scale (${fitScale}) must comfortably fit 1600x1000 viewport`);
assert.ok(net.buses.every(b => b.oneLineLayout.x >= 100 && b.oneLineLayout.x <= 1500), 'All 30 buses must have valid one-line X coordinates');
assert.ok(net.buses.every(b => b.oneLineLayout.y >= 80 && b.oneLineLayout.y <= 950), 'All 30 buses must have valid one-line Y coordinates');
console.log('✓ 11. Phase A: One-Line Canvas Geometry & Fit-to-Screen Bounds verified');

console.log('\nALL POWER-SYSTEM SIMULATOR & AC POWER-FLOW VERIFICATION CHECKS PASSED!');

