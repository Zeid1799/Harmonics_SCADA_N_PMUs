import {
  computeRlcCircuitMetrics,
  generateRlcWaveformPoints,
} from '../src/model/rlcCircuitModel';
import { solveRlcTransient } from '../src/model/rlcTransientModel';
import {
  DEFAULT_RLC_CONFIG,
  DEFAULT_RLC_TOPOLOGY,
  DEFAULT_RLC_TRANSIENT_INITIAL,
  RlcCircuitConfig,
  RlcTopologyConfig,
  RlcTransientInitialConditions,
} from '../src/types/rlcCircuit';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✓ ${message}`);
    passed++;
  } else {
    console.error(`✗ FAILED: ${message}`);
    failed++;
  }
}

function approxEqual(a: number, b: number, tol = 1e-3): boolean {
  return Math.abs(a - b) <= tol;
}

console.log('================================================================');
console.log('SWITCHABLE STEADY-STATE & TRANSIENT RLC ACCEPTANCE TESTS');
console.log('================================================================\n');

// --- SUITE 1: Topology Enable & Bypass Controls ---
console.log('--- SUITE 1: Component Enable / Bypass / Remove ---');
const cfg: RlcCircuitConfig = { ...DEFAULT_RLC_CONFIG };

// Test 1: Bypassing Resistor replaces with ideal wire (R = 0 in loop, value preserved)
const topoBypassR: RlcTopologyConfig = { ...DEFAULT_RLC_TOPOLOGY, resistor: 'bypassed' };
const metricsBypassR = computeRlcCircuitMetrics(cfg, topoBypassR);
assert(metricsBypassR.vResistorRms === 0, 'Bypassed resistor has exactly 0 V drop');
assert(cfg.resistance === 100, 'Configured resistance value (100 Ω) is preserved');

// Test 2: Bypassing Inductor replaces with ideal wire (L = 0 in loop, value preserved)
const topoBypassL: RlcTopologyConfig = { ...DEFAULT_RLC_TOPOLOGY, inductor: 'bypassed' };
const metricsBypassL = computeRlcCircuitMetrics(cfg, topoBypassL);
assert(metricsBypassL.xL === 0, 'Bypassed inductor has exactly 0 Ω reactance');
assert(metricsBypassL.vInductorRms === 0, 'Bypassed inductor has exactly 0 V drop');
assert(cfg.inductanceMh === 100, 'Configured inductance value (100 mH) is preserved');

// Test 3: Removing Capacitor creates Open Circuit (i = 0, V_C = V_s)
const topoRemoveC: RlcTopologyConfig = { ...DEFAULT_RLC_TOPOLOGY, capacitor: 'removed' };
const metricsRemoveC = computeRlcCircuitMetrics(cfg, topoRemoveC);
assert(metricsRemoveC.isOpenCircuit === true, 'Removed capacitor creates open circuit');
assert(metricsRemoveC.iRms === 0, 'Current is exactly zero (0 A)');
assert(metricsRemoveC.vCapacitorRms === cfg.vSourceRms, 'Entire source voltage drops across open capacitor gap');
assert(cfg.capacitanceUf === 100, 'Configured capacitance value (100 µF) is preserved');

// Test 4: Bypassing Capacitor replaces with ideal wire (V_C = 0, allowing RL and Pure R circuits)
const topoBypassC: RlcTopologyConfig = { ...DEFAULT_RLC_TOPOLOGY, capacitor: 'bypassed' };
const metricsBypassC = computeRlcCircuitMetrics(cfg, topoBypassC);
assert(metricsBypassC.xC === 0, 'Bypassed capacitor has 0 Ω reactance');
assert(metricsBypassC.vCapacitorRms === 0, 'Bypassed capacitor has 0 V drop');
assert(metricsBypassC.behavior === 'inductive', 'Series RL circuit behavior active when C is bypassed');
assert(metricsBypassC.phiIDeg < 0, 'Current lags voltage in series RL circuit');

// Test 5: Purely Resistive Circuit (Inductor bypassed & Capacitor bypassed)
const topoPureR: RlcTopologyConfig = {
  resistor: 'enabled',
  inductor: 'bypassed',
  capacitor: 'bypassed',
};
const metricsPureR = computeRlcCircuitMetrics(cfg, topoPureR);
assert(metricsPureR.zMagnitude === cfg.resistance, `Impedance |Z| equals resistance R (${metricsPureR.zMagnitude} Ω)`);
assert(metricsPureR.powerFactor === 1.0, 'Power factor is exactly unity (1.000)');
assert(metricsPureR.phiIDeg === 0, 'Current is in phase with voltage (φ_I = 0°)');
assert(metricsPureR.vResistorRms === cfg.vSourceRms, 'Full source voltage appears across resistor');

// Test 6: All Components Bypassed (Short Circuit)
const topoAllBypassed: RlcTopologyConfig = {
  resistor: 'bypassed',
  inductor: 'bypassed',
  capacitor: 'bypassed',
};
const metricsAllBypassed = computeRlcCircuitMetrics(cfg, topoAllBypassed);
assert(metricsAllBypassed.isUnboundedCurrent === true, 'All bypassed identified as unbounded current');
assert(!metricsAllBypassed.iDisplay.includes('NaN'), 'iDisplay does not contain NaN');

// --- SUITE 2: Transient Time-Domain Solver ---
console.log('\n--- SUITE 2: Transient ODE Solver & Initial Conditions ---');

// Test 7: Zero Initial Energy (V_C(0) = 0, I_L(0) = 0)
const traj0 = solveRlcTransient(
  cfg,
  DEFAULT_RLC_TOPOLOGY,
  { initialVc: 0, initialIl: 0 },
  0,
  50,
  100
);
assert(traj0.points[0].current === 0, 'Initial current at t=0 is exactly 0 A');
assert(traj0.points[0].vCapacitor === 0, 'Initial capacitor voltage at t=0 is exactly 0 V');

// Test 8: Nonzero Initial Energy (Capacitor pre-charged to 50 V, Inductor initial current 2 A)
const trajInit = solveRlcTransient(
  cfg,
  DEFAULT_RLC_TOPOLOGY,
  { initialVc: 50, initialIl: 2 },
  0,
  50,
  100
);
assert(approxEqual(trajInit.points[0].vCapacitor, 50, 1e-3), 'Capacitor reflects initial voltage of 50 V at t=0');
assert(approxEqual(trajInit.points[0].current, 2, 1e-3), 'Inductor reflects initial current of 2 A at t=0');

// Test 9: Instantaneous KVL Across All Transient Sample Points
console.log('\n--- SUITE 3: Instantaneous KVL Verification ---');
const transientCases: { name: string; topo: RlcTopologyConfig; init: RlcTransientInitialConditions }[] = [
  { name: 'Default RLC', topo: DEFAULT_RLC_TOPOLOGY, init: { initialVc: 0, initialIl: 0 } },
  { name: 'RLC with Initial Energy', topo: DEFAULT_RLC_TOPOLOGY, init: { initialVc: 40, initialIl: 1.5 } },
  { name: 'Series RC (L bypassed)', topo: topoBypassL, init: { initialVc: 25, initialIl: 0 } },
  { name: 'Series RL (C bypassed)', topo: topoBypassC, init: { initialVc: 0, initialIl: 2.0 } },
  { name: 'Pure Resistive (L & C bypassed)', topo: topoPureR, init: { initialVc: 0, initialIl: 0 } },
  { name: 'Open Circuit (C removed)', topo: topoRemoveC, init: { initialVc: 0, initialIl: 0 } },
];

for (const tc of transientCases) {
  const traj = solveRlcTransient(cfg, tc.topo, tc.init, 0.05, 50, 300);
  let maxKvlErr = 0;
  for (const pt of traj.points) {
    const sum = pt.vResistor + pt.vInductor + pt.vCapacitor;
    const err = Math.abs(pt.vSource - sum);
    if (err > maxKvlErr) maxKvlErr = err;
  }
  assert(maxKvlErr < 1e-3, `KVL holds for ${tc.name} across all points with max error ${maxKvlErr.toExponential(2)} V`);
}

// Test 10: Convergence to Steady State for Stable Damped Circuit
console.log('\n--- SUITE 4: Transient Convergence to Steady State ---');
// Run RLC circuit for 0.4 seconds (~24 cycles of 60 Hz, ~8 time constants 2L/R = 2 ms)
const longTraj = solveRlcTransient(
  cfg,
  DEFAULT_RLC_TOPOLOGY,
  { initialVc: 100, initialIl: 5 },
  0.4,
  20, // last 20 ms (1 cycle)
  200,
  true
);

const ssMetrics = computeRlcCircuitMetrics(cfg, DEFAULT_RLC_TOPOLOGY);
// Check that after 400 ms, transient current matches steady-state current within small tolerance
let maxDiffFromSs = 0;
for (const pt of longTraj.points) {
  const theta = 2 * Math.PI * cfg.frequency * pt.tAbsoluteSec;
  const currentSs = ssMetrics.iPeak * Math.sin(theta + ssMetrics.phiIRad);
  const diff = Math.abs(pt.current - currentSs);
  if (diff > maxDiffFromSs) maxDiffFromSs = diff;
}
assert(maxDiffFromSs < 0.05, `After natural decay, transient current converges to steady-state within ${maxDiffFromSs.toFixed(4)} A (< 0.05 A)`);

// Test 11: Capacitor Charging and Discharging Dynamics
console.log('\n--- SUITE 5: Capacitor Charging & Discharging ---');
const rcTraj = solveRlcTransient(
  { ...cfg, resistance: 50, capacitanceUf: 200 },
  topoBypassL,
  { initialVc: -100, initialIl: 0 },
  0.03, // 30 ms
  30,
  100
);
// Initial capacitor voltage is -100 V, must evolve smoothly toward positive source swing
assert(rcTraj.points[0].vCapacitor === -100, 'Starts at initial -100 V');
const maxVc = Math.max(...rcTraj.points.map((p) => p.vCapacitor));
assert(maxVc > 0, `Capacitor charges in response to AC source reaching positive voltages (peak: ${maxVc.toFixed(1)} V)`);

// Test 12: Inductor Current Buildup and Decay
console.log('\n--- SUITE 6: Inductor Current Buildup & Decay ---');
const rlTraj = solveRlcTransient(
  { ...cfg, resistance: 50, inductanceMh: 200 },
  topoBypassC,
  { initialVc: 0, initialIl: -3.0 },
  0.04,
  40,
  100
);
assert(rlTraj.points[0].current === -3.0, 'Inductor starts at initial -3.0 A');
const finalCurrent = rlTraj.points[rlTraj.points.length - 1].current;
assert(!isNaN(finalCurrent), `Inductor current evolves smoothly without NaN (${finalCurrent.toFixed(3)} A)`);

// Test 13: Visible Time Window Change Does Not Alter Current Simulation Time
console.log('\n--- SUITE 7: Time Window Invariance ---');
const tFixed = 0.035;
const trajWin20 = solveRlcTransient(cfg, DEFAULT_RLC_TOPOLOGY, { initialVc: 0, initialIl: 0 }, tFixed, 20);
const trajWin100 = solveRlcTransient(cfg, DEFAULT_RLC_TOPOLOGY, { initialVc: 0, initialIl: 0 }, tFixed, 100);
assert(trajWin20.metrics.timeSec === tFixed, `Window 20 ms retains simulation time t = ${tFixed} s`);
assert(trajWin100.metrics.timeSec === tFixed, `Window 100 ms retains simulation time t = ${tFixed} s`);
assert(approxEqual(trajWin20.metrics.current, trajWin100.metrics.current, 1e-6), 'Current at time t is identical regardless of visible window size');

// --- SUMMARY ---
console.log('\n================================================================');
console.log(`TOTAL TRANSIENT ACCEPTANCE TESTS: Passed: ${passed}, Failed: ${failed}`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
