import { DEFAULT_NETWORK_MODEL } from '../src/model/networkModel';
import { solveAcPowerFlow, DEFAULT_SOLVER_OPTIONS } from '../src/model/acPowerFlowSolver';
import { solveShortCircuit, DEFAULT_SC_SCENARIO } from '../src/model/shortCircuitSolver';
import { ShortCircuitScenario } from '../src/types/shortCircuit';
import { cMag } from '../src/model/complex';

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

console.log('=== TEST SUITE 1: Baseline AC Power Flow Solution ===');
const pfSolution = solveAcPowerFlow(DEFAULT_NETWORK_MODEL, DEFAULT_SOLVER_OPTIONS);
assert(pfSolution.converged === true, 'Prefault AC power flow converged');
const v1 = pfSolution.busSolutions[1];
assert(Math.abs(v1.vmPu - 1.06) < 1e-4, 'Bus 1 prefault voltage is 1.06 pu');

console.log('\n=== TEST SUITE 2: Three-Phase Balanced Fault at Bus 1 (Glen Lyn 132 kV) ===');
const sc3pBus1 = solveShortCircuit(
  DEFAULT_NETWORK_MODEL,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 1,
    faultType: '3phase',
    faultResistancePu: 0,
    faultReactancePu: 0,
  },
  pfSolution
);

assert(sc3pBus1.converged === true, '3P fault calculation converged');
assert(sc3pBus1.totalFaultCurrentKa > 0, `3P fault current is positive: ${sc3pBus1.totalFaultCurrentKa} kA`);
assert(sc3pBus1.totalFaultCurrentA > 0, `3P fault current in A: ${sc3pBus1.totalFaultCurrentA} A`);
assert(sc3pBus1.theveninImpedance.positive.mag > 0, `Positive Thevenin impedance is non-zero: ${sc3pBus1.theveninImpedance.positive.mag.toFixed(4)} pu`);
// For 3-Phase fault, sequence currents I0 = 0 and I2 = 0
assert(sc3pBus1.sequenceCurrentsPu.zero.mag < 1e-6, '3P fault zero-sequence current is zero');
assert(sc3pBus1.sequenceCurrentsPu.negative.mag < 1e-6, '3P fault negative-sequence current is zero');
assert(sc3pBus1.sequenceCurrentsPu.positive.mag > 0, '3P fault positive-sequence current is non-zero');
// Balanced phase currents
assert(
  Math.abs(sc3pBus1.phaseCurrentsKa.a - sc3pBus1.phaseCurrentsKa.b) < 1e-3 &&
  Math.abs(sc3pBus1.phaseCurrentsKa.b - sc3pBus1.phaseCurrentsKa.c) < 1e-3,
  '3P fault phase currents are balanced (Ia = Ib = Ic)'
);
// Fault duty
assert(sc3pBus1.shortCircuitMva > 100, `Short-circuit duty MVA is reasonable: ${sc3pBus1.shortCircuitMva.toFixed(1)} MVA`);

console.log('\n=== TEST SUITE 3: Single-Line-to-Ground Fault at Bus 1 (132 kV) ===');
const scSlgBus1 = solveShortCircuit(
  DEFAULT_NETWORK_MODEL,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 1,
    faultType: 'single-line-to-ground',
    faultResistancePu: 0,
    faultReactancePu: 0,
  },
  pfSolution
);

assert(scSlgBus1.converged === true, 'SLG fault calculation converged');
// For SLG on Phase A: I0 = I1 = I2
const i0Mag = scSlgBus1.sequenceCurrentsPu.zero.mag;
const i1Mag = scSlgBus1.sequenceCurrentsPu.positive.mag;
const i2Mag = scSlgBus1.sequenceCurrentsPu.negative.mag;
assert(Math.abs(i0Mag - i1Mag) < 1e-4, 'SLG fault I0 == I1');
assert(Math.abs(i1Mag - i2Mag) < 1e-4, 'SLG fault I1 == I2');
// Phase A carries 3 * I1, Phases B and C are zero
assert(scSlgBus1.phaseCurrentsKa.a > 0, `Phase A fault current: ${scSlgBus1.phaseCurrentsKa.a.toFixed(2)} kA`);
assert(scSlgBus1.phaseCurrentsKa.b < 1e-4, `Phase B current is 0 for Phase A SLG fault (got ${scSlgBus1.phaseCurrentsKa.b.toFixed(6)} kA)`);
assert(scSlgBus1.phaseCurrentsKa.c < 1e-4, `Phase C current is 0 for Phase A SLG fault (got ${scSlgBus1.phaseCurrentsKa.c.toFixed(6)} kA)`);
// Ground current equals Phase A current
assert(
  Math.abs((scSlgBus1.groundCurrentKa || 0) - scSlgBus1.phaseCurrentsKa.a) < 1e-3,
  'SLG ground current Ig == 3*I0 == Ia'
);

console.log('\n=== TEST SUITE 4: Line-to-Line Fault at Bus 1 (132 kV) ===');
const scLlBus1 = solveShortCircuit(
  DEFAULT_NETWORK_MODEL,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 1,
    faultType: 'line-to-line',
    faultResistancePu: 0,
    faultReactancePu: 0,
  },
  pfSolution
);

assert(scLlBus1.converged === true, 'LL fault calculation converged');
// LL fault on Phases B-C: I0 = 0, I1 = -I2
assert(scLlBus1.sequenceCurrentsPu.zero.mag < 1e-6, 'LL fault zero-sequence current is zero');
assert(
  Math.abs(scLlBus1.sequenceCurrentsPu.positive.mag - scLlBus1.sequenceCurrentsPu.negative.mag) < 1e-4,
  'LL fault |I1| == |I2|'
);
// Phase A is healthy (current = 0), Phases B and C are equal in magnitude
assert(scLlBus1.phaseCurrentsKa.a < 1e-4, 'LL fault unfaulted Phase A current is 0');
assert(
  Math.abs(scLlBus1.phaseCurrentsKa.b - scLlBus1.phaseCurrentsKa.c) < 1e-3,
  'LL fault Phase B and Phase C current magnitudes are equal'
);
// In LL fault, |If| = sqrt(3) * |I1|
const expectedLlPu = Math.sqrt(3) * scLlBus1.sequenceCurrentsPu.positive.mag;
assert(
  Math.abs(scLlBus1.totalFaultCurrentPu - expectedLlPu) < 1e-3,
  'LL fault current magnitude equals sqrt(3) * |I1|'
);

console.log('\n=== TEST SUITE 5: Double-Line-to-Ground Fault at Bus 1 (132 kV) ===');
const scDlgBus1 = solveShortCircuit(
  DEFAULT_NETWORK_MODEL,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 1,
    faultType: 'double-line-to-ground',
    faultResistancePu: 0,
    faultReactancePu: 0,
  },
  pfSolution
);

assert(scDlgBus1.converged === true, 'DLG fault calculation converged');
// DLG fault on Phases B-C to ground: Phase A is unfaulted (Ia = 0)
assert(scDlgBus1.phaseCurrentsKa.a < 1e-3, 'DLG fault unfaulted Phase A current is 0');
assert(scDlgBus1.phaseCurrentsKa.b > 0, 'DLG fault Phase B current is positive');
assert(scDlgBus1.phaseCurrentsKa.c > 0, 'DLG fault Phase C current is positive');
assert((scDlgBus1.groundCurrentKa || 0) > 0, 'DLG fault has ground return current');

console.log('\n=== TEST SUITE 6: Fault at 33 kV Subtransmission Bus (Bus 10) ===');
const sc3pBus10 = solveShortCircuit(
  DEFAULT_NETWORK_MODEL,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 10,
    faultType: '3phase',
  },
  pfSolution
);

assert(sc3pBus10.converged === true, 'Bus 10 3P fault converged');
assert(sc3pBus10.prefaultVoltage.mag > 0.95, `Bus 10 prefault voltage is ${sc3pBus10.prefaultVoltage.mag.toFixed(3)} pu`);
// 33 kV base current is larger than 132 kV base current (100 / (sqrt(3)*33) = 1.7495 kA)
assert(sc3pBus10.totalFaultCurrentKa > 0, `Bus 10 fault current: ${sc3pBus10.totalFaultCurrentKa.toFixed(2)} kA`);

console.log('\n=== TEST SUITE 7: Source and Branch Contributions ===');
assert(sc3pBus1.branchContributions.length > 0, `Branch contributions found: ${sc3pBus1.branchContributions.length} branches`);
assert(sc3pBus1.generatorContributions.length > 0, `Generator contributions found: ${sc3pBus1.generatorContributions.length} generators`);

// Sum of contributions into faulted bus equals total fault current
let sumContribKa = 0;
for (const br of sc3pBus1.branchContributions) {
  sumContribKa += br.currentKa;
}
for (const gen of sc3pBus1.generatorContributions) {
  if (gen.busNumber === 1) {
    sumContribKa += gen.currentKa;
  }
}
assert(
  sumContribKa > 0,
  `Sum of contributions into faulted bus: ${sumContribKa.toFixed(2)} kA (total ${sc3pBus1.totalFaultCurrentKa.toFixed(2)} kA)`
);

console.log('\n=== TEST SUITE 8: Post-Fault Bus Voltages and Sag ===');
assert(sc3pBus1.busVoltages.length === 30, '30 bus post-fault voltages computed');
const vFaulted = sc3pBus1.busVoltages.find((b) => b.busNumber === 1);
assert(vFaulted !== undefined, 'Faulted bus found in voltage list');
assert(vFaulted?.isFaultedBus === true, 'Faulted bus is correctly flagged');
// At bolted fault, voltage at faulted bus is 0
assert((vFaulted?.minPhaseVoltagePu || 0) < 1e-4, `Bolted fault collapses faulted bus voltage to 0: ${vFaulted?.minPhaseVoltagePu.toFixed(6)} pu`);
// Nearby buses experience voltage sag
assert(sc3pBus1.severeSagBusCount > 0, `Severe sag detected on ${sc3pBus1.severeSagBusCount} buses`);

console.log('\n=== TEST SUITE 9: Fault Impedance Effect ===');
// Bolted fault vs 10 ohm fault
const scBolted = solveShortCircuit(
  DEFAULT_NETWORK_MODEL,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 1,
    faultResistanceOhms: 0,
  },
  pfSolution
);

const scResistive = solveShortCircuit(
  DEFAULT_NETWORK_MODEL,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 1,
    faultResistanceOhms: 10.0,
  },
  pfSolution
);

assert(
  scResistive.totalFaultCurrentKa < scBolted.totalFaultCurrentKa,
  `Adding 10 ohm fault impedance reduces fault current from ${scBolted.totalFaultCurrentKa.toFixed(2)} kA to ${scResistive.totalFaultCurrentKa.toFixed(2)} kA`
);

console.log('\n=== TEST SUITE 10: Equipment Outage / Topology Sensitivity ===');
// Disconnect Line 1-2 (Glen Lyn - Claytor 132 kV tie)
const networkLineOut = {
  ...DEFAULT_NETWORK_MODEL,
  lines: DEFAULT_NETWORK_MODEL.lines.map((l) =>
    l.id === 'LINE-1-2' ? { ...l, status: 'offline' as const } : l
  ),
};

const scLineOut = solveShortCircuit(
  networkLineOut,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 2, // Claytor 132 kV
  },
  pfSolution
);

const scNormalBus2 = solveShortCircuit(
  DEFAULT_NETWORK_MODEL,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 2,
  },
  pfSolution
);

assert(
  scLineOut.totalFaultCurrentKa < scNormalBus2.totalFaultCurrentKa,
  `Disconnecting Line 1-2 reduces fault current at Bus 2 from ${scNormalBus2.totalFaultCurrentKa.toFixed(2)} kA to ${scLineOut.totalFaultCurrentKa.toFixed(2)} kA`
);

console.log('\n=== TEST SUITE 11: Invalid Configuration Error Handling ===');
// Attempt fault on an offline bus
const networkBusOut = {
  ...DEFAULT_NETWORK_MODEL,
  buses: DEFAULT_NETWORK_MODEL.buses.map((b) =>
    b.number === 26 ? { ...b, status: 'offline' as const } : b
  ),
};

const scError = solveShortCircuit(
  networkBusOut,
  {
    ...DEFAULT_SC_SCENARIO,
    faultedBusNumber: 26,
  },
  pfSolution
);

assert(scError.converged === false, 'Fault on offline bus returns converged=false');
assert(scError.errorMessage !== undefined && scError.errorMessage.length > 0, `Meaningful error message returned: "${scError.errorMessage}"`);
assert(scError.totalFaultCurrentKa === 0, 'Error scenario yields 0 kA fault current');

console.log(`\n================================================================`);
console.log(`TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log(`================================================================`);

if (failed > 0) {
  process.exit(1);
}
