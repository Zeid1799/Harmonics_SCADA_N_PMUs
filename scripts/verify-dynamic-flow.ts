import { DEFAULT_NETWORK_MODEL } from '../src/model/networkModel';
import { solveAcPowerFlow, DEFAULT_SOLVER_OPTIONS } from '../src/model/acPowerFlowSolver';
import {
  deriveBranchDynamicFlowState,
  DEFAULT_DYNAMIC_FLOW_CONFIG,
  DynamicFlowConfig,
} from '../src/types/dynamicFlow';

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
assert(pfSolution.converged === true, 'Baseline AC power flow converged');
assert(Object.keys(pfSolution.lineFlows).length === 34, 'All 34 line flows computed');
assert(Object.keys(pfSolution.transformerFlows).length === 7, 'All 7 transformer flows computed');

console.log('\n=== TEST SUITE 2: Dynamic Flow Direction Derivation Across All 41 Branches ===');
let forwardCount = 0;
let reverseCount = 0;
let zeroCount = 0;

// Test all 34 transmission lines
for (const line of DEFAULT_NETWORK_MODEL.lines) {
  const flow = pfSolution.lineFlows[line.id];
  const dynState = deriveBranchDynamicFlowState(
    line.id,
    'line',
    line.fromBusNumber,
    line.toBusNumber,
    line.ratingMva,
    flow,
    DEFAULT_DYNAMIC_FLOW_CONFIG
  );

  assert(dynState.branchId === line.id, `Branch ID matches: ${line.id}`);
  assert(dynState.energized === true, `Line is energized: ${line.id}`);

  // Flow direction must match sign of pFromMw strictly
  if (Math.abs(flow.pFromMw) <= DEFAULT_DYNAMIC_FLOW_CONFIG.minFlowThresholdMw) {
    assert(dynState.flowDirection === 'zero', `Line ${line.id} has negligible flow -> direction is zero`);
    zeroCount++;
  } else if (flow.pFromMw > 0) {
    assert(
      dynState.flowDirection === 'forward',
      `Line ${line.id} with pFrom=${flow.pFromMw.toFixed(2)}MW flows forward (B${line.fromBusNumber} -> B${line.toBusNumber})`
    );
    assert(dynState.flowDirectionLabel.includes(`B${line.fromBusNumber} → B${line.toBusNumber}`), `Label reflects forward flow`);
    forwardCount++;
  } else {
    assert(
      dynState.flowDirection === 'reverse',
      `Line ${line.id} with pFrom=${flow.pFromMw.toFixed(2)}MW flows reverse (B${line.toBusNumber} -> B${line.fromBusNumber})`
    );
    assert(dynState.flowDirectionLabel.includes(`B${line.toBusNumber} → B${line.fromBusNumber}`), `Label reflects reverse flow`);
    reverseCount++;
  }
}

// Test all 7 transformers
for (const tr of DEFAULT_NETWORK_MODEL.transformers) {
  const flow = pfSolution.transformerFlows[tr.id];
  const dynState = deriveBranchDynamicFlowState(
    tr.id,
    'transformer',
    tr.fromBusNumber,
    tr.toBusNumber,
    tr.ratingMva,
    flow,
    DEFAULT_DYNAMIC_FLOW_CONFIG
  );

  assert(dynState.branchId === tr.id, `Transformer ID matches: ${tr.id}`);
  assert(dynState.energized === true, `Transformer is energized: ${tr.id}`);

  if (Math.abs(flow.pFromMw) <= DEFAULT_DYNAMIC_FLOW_CONFIG.minFlowThresholdMw) {
    assert(dynState.flowDirection === 'zero', `Transformer ${tr.id} has negligible flow -> direction is zero`);
    zeroCount++;
  } else if (flow.pFromMw > 0) {
    assert(
      dynState.flowDirection === 'forward',
      `Transformer ${tr.id} with pFrom=${flow.pFromMw.toFixed(2)}MW flows forward (B${tr.fromBusNumber} -> B${tr.toBusNumber})`
    );
    forwardCount++;
  } else {
    assert(
      dynState.flowDirection === 'reverse',
      `Transformer ${tr.id} with pFrom=${flow.pFromMw.toFixed(2)}MW flows reverse (B${tr.toBusNumber} -> B${tr.fromBusNumber})`
    );
    reverseCount++;
  }
}

console.log(`Flow direction summary: Forward=${forwardCount}, Reverse=${reverseCount}, Zero=${zeroCount} (Total 41)`);
assert(forwardCount + reverseCount + zeroCount === 41, 'All 41 network branches evaluated');
assert(forwardCount > 0 && reverseCount > 0, 'Both forward and reverse flows exist in standard benchmark');

console.log('\n=== TEST SUITE 3: Zero Flow Thresholding (|P| < 0.05 MW) ===');
const mockZeroFlow = {
  branchId: 'line-test-zero',
  pFromMw: 0.02, // Below 0.05 MW threshold
  qFromMvar: 0.1,
  pToMw: -0.019,
  qToMvar: -0.09,
  pLossMw: 0.001,
  qLossMvar: 0.01,
  maxApparentFlowMva: 0.1,
  loadingPercent: 1.0,
  overloaded: false,
  inService: true,
  energized: true,
};

const zeroState = deriveBranchDynamicFlowState(
  'line-test-zero',
  'line',
  10,
  11,
  100,
  mockZeroFlow,
  DEFAULT_DYNAMIC_FLOW_CONFIG
);

assert(zeroState.flowDirection === 'zero', 'Sub-threshold active power is classified as "zero" flow');
assert(zeroState.animationDurationSec === 0, 'Zero flow has duration 0 to avoid false directional animation');
assert(zeroState.flowDirectionLabel.toLowerCase().includes('zero'), 'Label states zero active flow');

console.log('\n=== TEST SUITE 4: Flow Reversal Under Altered Operating Conditions ===');
// Alter operating conditions: Increase Glen Lyn (Bus 1) load significantly or modify generation
const alteredModel = JSON.parse(JSON.stringify(DEFAULT_NETWORK_MODEL));
// Reverse flow on Line 1-2 by shifting generation or changing conditions
const l12Original = pfSolution.lineFlows['LINE-1-2'];
assert(l12Original.pFromMw > 0, 'Original Line 1-2 has pFrom > 0 (flows 1 -> 2)');

// Test artificial reversed flow
const mockReversedFlow = {
  ...l12Original,
  pFromMw: -125.4, // Power now enters Bus 1 from Bus 2
  pToMw: 128.6,
};
const reversedState = deriveBranchDynamicFlowState(
  'LINE-1-2',
  'line',
  1,
  2,
  130,
  mockReversedFlow,
  DEFAULT_DYNAMIC_FLOW_CONFIG
);
assert(reversedState.flowDirection === 'reverse', 'Negative pFrom (-125.4 MW) correctly yields "reverse" flow');
assert(reversedState.flowDirectionLabel === 'B2 → B1', 'Reversed flow label correctly indicates B2 -> B1');

console.log('\n=== TEST SUITE 5: De-Energized / Offline Branch Handling ===');
const mockOfflineFlow = {
  ...l12Original,
  inService: false,
  energized: false,
};
const offlineState = deriveBranchDynamicFlowState(
  'LINE-1-2',
  'line',
  1,
  2,
  130,
  mockOfflineFlow,
  DEFAULT_DYNAMIC_FLOW_CONFIG
);
assert(offlineState.energized === false, 'Offline branch marked energized=false');
assert(offlineState.flowDirection === 'zero', 'Offline branch flowDirection is zero');
assert(offlineState.speedScale === 0, 'Offline branch animation speedScale is 0');
assert(offlineState.animationDurationSec === 0, 'Offline branch duration is 0');
assert(offlineState.loadingColor === '#64748b', 'Offline branch rendered in muted slate color');

console.log('\n=== TEST SUITE 6: Rating Edits Recalculate Loading % Without Affecting Physical MW ===');
const baseL12 = deriveBranchDynamicFlowState(
  'LINE-1-2',
  'line',
  1,
  2,
  130, // Original rating 130 MVA
  l12Original,
  DEFAULT_DYNAMIC_FLOW_CONFIG
);

const reratedL12 = deriveBranchDynamicFlowState(
  'LINE-1-2',
  'line',
  1,
  2,
  65, // Lower rating to 65 MVA (Rate A modified by user in Phase B edit mode)
  l12Original,
  DEFAULT_DYNAMIC_FLOW_CONFIG
);

// Active power must remain strictly identical
assert(baseL12.activePowerMw === reratedL12.activePowerMw, 'Active power MW is completely invariant to rating change');
// Loading percent must update proportionally: rating halved => loading pct doubles
const expectedLoadingPct = Number(((baseL12.apparentPowerMva / 65) * 100).toFixed(1));
assert(
  Math.abs(reratedL12.loadingPercent - expectedLoadingPct) < 0.2,
  `Loading % recalculated accurately with new rating: ${reratedL12.loadingPercent}% (expected ~${expectedLoadingPct}%)`
);
assert(reratedL12.isOverloaded === true, 'Halved rating causes line to be marked overloaded (>100%)');
assert(reratedL12.loadingColor === '#ef4444', 'Overloaded branch receives red color encoding');

console.log('\n=== TEST SUITE 7: Speed Multipliers (0.5x, 1.0x, 2.0x) and Scaling ===');
const config05x: DynamicFlowConfig = { ...DEFAULT_DYNAMIC_FLOW_CONFIG, speedMultiplier: 0.5 };
const config10x: DynamicFlowConfig = { ...DEFAULT_DYNAMIC_FLOW_CONFIG, speedMultiplier: 1.0 };
const config20x: DynamicFlowConfig = { ...DEFAULT_DYNAMIC_FLOW_CONFIG, speedMultiplier: 2.0 };

const state05x = deriveBranchDynamicFlowState('LINE-1-2', 'line', 1, 2, 130, l12Original, config05x);
const state10x = deriveBranchDynamicFlowState('LINE-1-2', 'line', 1, 2, 130, l12Original, config10x);
const state20x = deriveBranchDynamicFlowState('LINE-1-2', 'line', 1, 2, 130, l12Original, config20x);

// Duration is inversely proportional to speed: 2x speed => half duration; 0.5x speed => double duration
assert(
  state05x.animationDurationSec > state10x.animationDurationSec,
  `0.5x speed has longer duration (${state05x.animationDurationSec}s > ${state10x.animationDurationSec}s)`
);
assert(
  state10x.animationDurationSec > state20x.animationDurationSec,
  `2.0x speed has shorter duration (${state20x.animationDurationSec}s < ${state10x.animationDurationSec}s)`
);
assert(
  Math.abs(state05x.animationDurationSec - state10x.animationDurationSec * 2) < 0.2,
  '0.5x duration is approximately 2x the 1.0x baseline duration'
);
assert(
  Math.abs(state20x.animationDurationSec - state10x.animationDurationSec / 2) < 0.2,
  '2.0x duration is approximately 0.5x the 1.0x baseline duration'
);

console.log('\n=== TEST SUMMARY ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\nALL DYNAMIC FLOW VERIFICATION TESTS PASSED!\n');
}
