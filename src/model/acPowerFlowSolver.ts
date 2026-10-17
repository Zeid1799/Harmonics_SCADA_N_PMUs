import {
  AcPowerFlowOptions,
  BranchFlowSolution,
  BusSolution,
  BusType,
  GeneratorDispatchSolution,
  PowerFlowSolutionResult,
  PowerNetworkModel,
  ReactiveLimitEvent,
  ShuntInjectionSolution,
  TopologyDiagnostics,
  YBusEntry,
} from '../types/network';

export const DEFAULT_SOLVER_OPTIONS: AcPowerFlowOptions = {
  tolerancePu: 1e-6,
  maxIterations: 30,
  enforceReactiveLimits: true,
  flatStart: false,
};

interface ComplexMatrix {
  G: number[][];
  B: number[][];
}

/**
 * Solves a real linear system A * x = b using Gaussian elimination with partial pivoting.
 * Returns null if the matrix is singular or numerically ill-conditioned.
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (n === 0) return [];

  const M = A.map((row, idx) => [...row, b[idx]]);

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxAbs = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(M[row][col]);
      if (val > maxAbs) {
        maxAbs = val;
        pivotRow = row;
      }
    }

    if (maxAbs < 1e-12 || Number.isNaN(maxAbs)) {
      return null;
    }

    if (pivotRow !== col) {
      const temp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = temp;
    }

    const pivot = M[col][col];
    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / pivot;
      if (factor === 0) continue;
      for (let k = col; k <= n; k++) {
        M[row][k] -= factor * M[col][k];
      }
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = M[row][n];
    for (let col = row + 1; col < n; col++) {
      sum -= M[row][col] * x[col];
    }
    const diag = M[row][row];
    if (Math.abs(diag) < 1e-12 || Number.isNaN(sum)) {
      return null;
    }
    x[row] = sum / diag;
  }

  return x;
}

/**
 * Analyzes network connectivity, islands, isolated buses, and unsupplied loads.
 */
export function analyzeNetworkTopology(network: PowerNetworkModel): TopologyDiagnostics {
  const busNumbers = network.buses.map((b) => b.number);
  const busByNum = new Map(network.buses.map((b) => [b.number, b]));
  const adj = new Map<number, Set<number>>();

  for (const num of busNumbers) {
    adj.set(num, new Set<number>());
  }

  const offlineBranchIds: string[] = [];

  for (const line of network.lines) {
    if (line.status !== 'online') {
      offlineBranchIds.push(line.id);
      continue;
    }
    const fBus = busByNum.get(line.fromBusNumber);
    const tBus = busByNum.get(line.toBusNumber);
    if (fBus?.status === 'online' && tBus?.status === 'online') {
      adj.get(line.fromBusNumber)?.add(line.toBusNumber);
      adj.get(line.toBusNumber)?.add(line.fromBusNumber);
    }
  }

  for (const tr of network.transformers) {
    if (tr.status !== 'online') {
      offlineBranchIds.push(tr.id);
      continue;
    }
    const fBus = busByNum.get(tr.fromBusNumber);
    const tBus = busByNum.get(tr.toBusNumber);
    if (fBus?.status === 'online' && tBus?.status === 'online') {
      adj.get(tr.fromBusNumber)?.add(tr.toBusNumber);
      adj.get(tr.toBusNumber)?.add(tr.fromBusNumber);
    }
  }

  const visited = new Set<number>();
  const islands: TopologyDiagnostics['islands'] = [];
  let nextIslandId = 1;

  for (const bus of network.buses) {
    if (visited.has(bus.number)) continue;

    if (bus.status !== 'online') {
      visited.add(bus.number);
      islands.push({
        islandId: nextIslandId++,
        busNumbers: [bus.number],
        hasSlackBus: false,
        onlineGeneratorCount: 0,
        energized: false,
        totalLoadMw: 0,
      });
      continue;
    }

    const queue = [bus.number];
    visited.add(bus.number);
    const component: number[] = [];

    while (queue.length > 0) {
      const curr = queue.shift()!;
      component.push(curr);
      const neighbors = adj.get(curr);
      if (!neighbors) continue;
      for (const nb of neighbors) {
        if (!visited.has(nb)) {
          visited.add(nb);
          queue.push(nb);
        }
      }
    }

    component.sort((a, b) => a - b);

    const onlineGensInIsland = network.generators.filter(
      (g) => g.status === 'online' && component.includes(g.busNumber)
    );
    const hasSlackBus = component.some((bNum) => {
      const b = busByNum.get(bNum);
      return (
        b?.busType === 'slack' &&
        onlineGensInIsland.some((g) => g.busNumber === bNum)
      );
    });

    const totalLoadMw = network.loads
      .filter((l) => l.status === 'connected' && component.includes(l.busNumber))
      .reduce((acc, l) => acc + l.configuredActivePowerMw * network.loadScaleFactor, 0);

    // An island is energized if it contains an online Slack generator,
    // OR if it is a multi-bus island with at least one online Synchronous Generator (with Pmax > 0)
    const hasRealPowerGen = onlineGensInIsland.some(
      (g) => g.unitType === 'Synchronous Generator' || g.activePowerMaxMw > 0
    );
    const energized = hasSlackBus || (component.length > 1 && hasRealPowerGen);

    islands.push({
      islandId: nextIslandId++,
      busNumbers: component,
      hasSlackBus,
      onlineGeneratorCount: onlineGensInIsland.length,
      energized,
      totalLoadMw,
    });
  }

  const energizedIslandIds = islands.filter((isl) => isl.energized).map((isl) => isl.islandId);
  const deEnergizedBusSet = new Set<number>();
  const isolatedBusNumbers: number[] = [];

  for (const isl of islands) {
    if (!isl.energized) {
      for (const bNum of isl.busNumbers) {
        deEnergizedBusSet.add(bNum);
      }
    }
    if (isl.busNumbers.length === 1) {
      const bNum = isl.busNumbers[0];
      const degree = adj.get(bNum)?.size ?? 0;
      if (degree === 0) {
        isolatedBusNumbers.push(bNum);
      }
    }
  }

  const unsuppliedLoadIds: string[] = [];
  let unsuppliedLoadMw = 0;
  let unsuppliedLoadMvar = 0;
  const disconnectedLoadIds: string[] = [];

  for (const load of network.loads) {
    if (load.status === 'disconnected') {
      disconnectedLoadIds.push(load.id);
    } else if (deEnergizedBusSet.has(load.busNumber)) {
      unsuppliedLoadIds.push(load.id);
      unsuppliedLoadMw += load.configuredActivePowerMw * network.loadScaleFactor;
      unsuppliedLoadMvar += load.configuredReactivePowerMvar * network.loadScaleFactor;
    }
  }

  const offlineGeneratorIds = network.generators
    .filter((g) => g.status === 'offline')
    .map((g) => g.id);

  const warnings: string[] = [];
  if (isolatedBusNumbers.length > 0) {
    warnings.push(
      `Isolated bus(es) detected with no active branch connections: Bus ${isolatedBusNumbers.join(', ')}.`
    );
  }
  if (unsuppliedLoadIds.length > 0) {
    warnings.push(
      `${unsuppliedLoadIds.length} connected load(s) (${unsuppliedLoadMw.toFixed(1)} MW, ${unsuppliedLoadMvar.toFixed(1)} MVAr) are in de-energized islands (${unsuppliedLoadIds.join(', ')}).`
    );
  }
  if (islands.length > 1) {
    warnings.push(
      `Network topology is split into ${islands.length} electrical islands (${energizedIslandIds.length} energized, ${islands.length - energizedIslandIds.length} de-energized).`
    );
  }

  return {
    totalIslands: islands.length,
    energizedIslandIds,
    islands,
    isolatedBusNumbers,
    deEnergizedBusNumbers: Array.from(deEnergizedBusSet).sort((a, b) => a - b),
    unsuppliedLoadIds,
    unsuppliedLoadMw,
    unsuppliedLoadMvar,
    disconnectedLoadIds,
    offlineGeneratorIds,
    offlineBranchIds,
    warnings,
  };
}

/**
 * Constructs the full N x N complex Bus Admittance Matrix (Y_bus = G + jB) in per-unit
 * on the network base MVA (100 MVA).
 */
export function buildComplexYBusMatrix(network: PowerNetworkModel): ComplexMatrix {
  const maxBus = Math.max(...network.buses.map((b) => b.number));
  const G: number[][] = Array.from({ length: maxBus + 1 }, () =>
    new Array<number>(maxBus + 1).fill(0)
  );
  const B: number[][] = Array.from({ length: maxBus + 1 }, () =>
    new Array<number>(maxBus + 1).fill(0)
  );

  const onlineBusSet = new Set(
    network.buses.filter((b) => b.status === 'online').map((b) => b.number)
  );

  // 1. Transmission lines (standard pi-model)
  for (const line of network.lines) {
    if (line.status !== 'online') continue;
    const f = line.fromBusNumber;
    const t = line.toBusNumber;
    if (!onlineBusSet.has(f) || !onlineBusSet.has(t)) continue;

    const r = line.resistancePu;
    const x = line.reactancePu;
    const denom = r * r + x * x;
    if (denom < 1e-12) continue;

    const gSeries = r / denom;
    const bSeries = -x / denom;
    const bChargingHalf = line.chargingSusceptancePu / 2;

    G[f][f] += gSeries;
    B[f][f] += bSeries + bChargingHalf;
    G[t][t] += gSeries;
    B[t][t] += bSeries + bChargingHalf;

    G[f][t] -= gSeries;
    B[f][t] -= bSeries;
    G[t][f] -= gSeries;
    B[t][f] -= bSeries;
  }

  // 2. Transformers with off-nominal tap ratio tau (on from-bus side) and phase shift theta_shift
  for (const tr of network.transformers) {
    if (tr.status !== 'online') continue;
    const f = tr.fromBusNumber;
    const t = tr.toBusNumber;
    if (!onlineBusSet.has(f) || !onlineBusSet.has(t)) continue;

    const r = tr.resistancePu;
    const x = tr.reactancePu;
    const denom = r * r + x * x;
    if (denom < 1e-12) continue;

    const gSeries = r / denom;
    const bSeries = -x / denom;
    const tap = tr.tapRatioPu > 0 ? tr.tapRatioPu : 1.0;
    const shiftRad = (tr.phaseShiftDeg * Math.PI) / 180;
    const cosS = Math.cos(shiftRad);
    const sinS = Math.sin(shiftRad);

    // Y_ff = y_s / tap^2, Y_tt = y_s
    G[f][f] += gSeries / (tap * tap);
    B[f][f] += bSeries / (tap * tap);
    G[t][t] += gSeries;
    B[t][t] += bSeries;

    // Y_ft = -y_s / (tap * e^{-j*shift}) = -(g_s + j*b_s)*(cosS + j*sinS) / tap
    const gFt = (gSeries * cosS - bSeries * sinS) / tap;
    const bFt = (gSeries * sinS + bSeries * cosS) / tap;

    // Y_tf = -y_s / (tap * e^{+j*shift}) = -(g_s + j*b_s)*(cosS - j*sinS) / tap
    const gTf = (gSeries * cosS + bSeries * sinS) / tap;
    const bTf = (-gSeries * sinS + bSeries * cosS) / tap;

    G[f][t] -= gFt;
    B[f][t] -= bFt;
    G[t][f] -= gTf;
    B[t][f] -= bTf;
  }

  // 3. Switched Shunt Elements (Gs + j*Bs)
  const baseMva = network.metadata.baseMva;
  for (const sh of network.shunts) {
    if (sh.status !== 'online') continue;
    const bNum = sh.busNumber;
    if (!onlineBusSet.has(bNum)) continue;
    G[bNum][bNum] += sh.conductanceMwAtUnitV / baseMva;
    B[bNum][bNum] += sh.configuredSusceptanceMvarAtUnitV / baseMva;
  }

  return { G, B };
}

/**
 * Returns non-zero sparse entries of the Bus Admittance Matrix (Y_bus) for inspection and testing.
 */
export function buildAnalyticalYBus(network: PowerNetworkModel): YBusEntry[] {
  const { G, B } = buildComplexYBusMatrix(network);
  const maxBus = G.length - 1;
  const entries: YBusEntry[] = [];

  for (let i = 1; i <= maxBus; i++) {
    for (let k = 1; k <= maxBus; k++) {
      if (Math.abs(G[i][k]) > 1e-7 || Math.abs(B[i][k]) > 1e-7) {
        entries.push({
          fromBus: i,
          toBus: k,
          gPu: Number(G[i][k].toFixed(5)),
          bPu: Number(B[i][k].toFixed(5)),
        });
      }
    }
  }
  return entries;
}

/**
 * Executes a full steady-state Polar Newton-Raphson AC Power-Flow solution on the provided network model.
 */
export function solveAcPowerFlow(
  network: PowerNetworkModel,
  partialOptions?: Partial<AcPowerFlowOptions>
): PowerFlowSolutionResult {
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const options: AcPowerFlowOptions = {
    ...DEFAULT_SOLVER_OPTIONS,
    ...partialOptions,
  };

  const baseMva = network.metadata.baseMva;
  const topology = analyzeNetworkTopology(network);
  const { G, B } = buildComplexYBusMatrix(network);

  // Verify that the primary system has at least one energized island with a Slack reference bus
  const hasAnySlackIsland = topology.islands.some((isl) => isl.hasSlackBus);
  if (!hasAnySlackIsland) {
    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return createFailedSolution(
      network,
      options,
      topology,
      'No online Slack/Reference generator is connected to the network. At least one Slack generator (Bus 1: Glen Lyn 132 kV) must remain in service to establish the voltage angle reference and balance system active power.',
      0,
      0,
      0,
      0,
      endTime - startTime
    );
  }

  // Check if any multi-bus island with generation lacks a Slack bus
  const unreferencedGenIsland = topology.islands.find(
    (isl) => isl.energized && !isl.hasSlackBus
  );
  if (unreferencedGenIsland) {
    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return createFailedSolution(
      network,
      options,
      topology,
      `Electrical Island #${unreferencedGenIsland.islandId} (Buses ${unreferencedGenIsland.busNumbers.join(', ')}) has online generation/load but is disconnected from the Slack reference bus (Bus 1).`,
      0,
      0,
      0,
      0,
      endTime - startTime
    );
  }

  // Energized buses are those in islands containing a valid Slack reference
  const energizedBusSet = new Set<number>();
  for (const isl of topology.islands) {
    if (isl.hasSlackBus) {
      for (const bNum of isl.busNumbers) {
        energizedBusSet.add(bNum);
      }
    }
  }

  const maxBusNum = Math.max(...network.buses.map((b) => b.number));
  const Vm = new Array<number>(maxBusNum + 1).fill(0);
  const Va = new Array<number>(maxBusNum + 1).fill(0); // in radians

  // Group online generators and connected loads by bus number
  const onlineGensByBus = new Map<number, typeof network.generators>();
  for (const g of network.generators) {
    if (g.status === 'online' && energizedBusSet.has(g.busNumber)) {
      const list = onlineGensByBus.get(g.busNumber) ?? [];
      list.push(g);
      onlineGensByBus.set(g.busNumber, list);
    }
  }

  const pLoadPuByBus = new Array<number>(maxBusNum + 1).fill(0);
  const qLoadPuByBus = new Array<number>(maxBusNum + 1).fill(0);
  for (const ld of network.loads) {
    if (ld.status === 'connected' && energizedBusSet.has(ld.busNumber)) {
      pLoadPuByBus[ld.busNumber] += (ld.configuredActivePowerMw * network.loadScaleFactor) / baseMva;
      qLoadPuByBus[ld.busNumber] += (ld.configuredReactivePowerMvar * network.loadScaleFactor) / baseMva;
    }
  }

  // Determine initial bus types and scheduled injections
  const effectiveBusType = new Map<number, BusType>();
  const convertedFromPvToPq = new Map<number, boolean>();
  const qLimitViolation = new Map<number, 'none' | 'qmax' | 'qmin'>();
  const fixedQGenPuByBus = new Array<number>(maxBusNum + 1).fill(0);
  const pGenSchedPuByBus = new Array<number>(maxBusNum + 1).fill(0);

  for (const bus of network.buses) {
    const i = bus.number;
    convertedFromPvToPq.set(i, false);
    qLimitViolation.set(i, 'none');

    if (!energizedBusSet.has(i)) {
      effectiveBusType.set(i, 'pq');
      Vm[i] = 0;
      Va[i] = 0;
      continue;
    }

    const gens = onlineGensByBus.get(i) ?? [];
    for (const g of gens) {
      pGenSchedPuByBus[i] += g.scheduledActivePowerMw / baseMva;
    }

    if (bus.busType === 'slack' && gens.length > 0) {
      effectiveBusType.set(i, 'slack');
      Vm[i] = gens[0].voltageSetpointPu;
      Va[i] = (bus.initialVaDeg * Math.PI) / 180;
    } else if (gens.length > 0) {
      effectiveBusType.set(i, 'pv');
      Vm[i] = gens[0].voltageSetpointPu;
      Va[i] = options.flatStart ? 0 : (bus.initialVaDeg * Math.PI) / 180;
    } else {
      effectiveBusType.set(i, 'pq');
      Vm[i] = options.flatStart ? 1.0 : bus.initialVmPu;
      Va[i] = options.flatStart ? 0 : (bus.initialVaDeg * Math.PI) / 180;
    }
  }

  const energizedBusesSorted = Array.from(energizedBusSet).sort((a, b) => a - b);
  const reactiveLimitEvents: ReactiveLimitEvent[] = [];
  let totalIterations = 0;
  let outerLoopCount = 0;
  let converged = false;
  let maxActiveMismatchPu = 0;
  let maxReactiveMismatchPu = 0;
  let failureReason: string | null = null;

  const pCalcPu = new Array<number>(maxBusNum + 1).fill(0);
  const qCalcPu = new Array<number>(maxBusNum + 1).fill(0);

  const computePowerInjections = () => {
    for (const i of energizedBusesSorted) {
      let pSum = 0;
      let qSum = 0;
      const vi = Vm[i];
      const ti = Va[i];
      for (const k of energizedBusesSorted) {
        const gik = G[i][k];
        const bik = B[i][k];
        if (gik === 0 && bik === 0) continue;
        const vk = Vm[k];
        const dTheta = ti - Va[k];
        const cosT = Math.cos(dTheta);
        const sinT = Math.sin(dTheta);
        pSum += vk * (gik * cosT + bik * sinT);
        qSum += vk * (gik * sinT - bik * cosT);
      }
      pCalcPu[i] = vi * pSum;
      qCalcPu[i] = vi * qSum;
    }
  };

  const maxOuterLoops = options.enforceReactiveLimits ? 10 : 1;

  for (let outer = 1; outer <= maxOuterLoops; outer++) {
    outerLoopCount = outer;
    converged = false;

    const angBuses = energizedBusesSorted.filter(
      (i) => effectiveBusType.get(i) !== 'slack'
    );
    const pqBuses = energizedBusesSorted.filter(
      (i) => effectiveBusType.get(i) === 'pq'
    );
    const nAng = angBuses.length;
    const nPq = pqBuses.length;
    const nState = nAng + nPq;

    for (let iter = 1; iter <= options.maxIterations; iter++) {
      totalIterations++;
      computePowerInjections();

      const mismatch = new Array<number>(nState).fill(0);
      maxActiveMismatchPu = 0;
      maxReactiveMismatchPu = 0;

      for (let idx = 0; idx < nAng; idx++) {
        const i = angBuses[idx];
        const pSched = pGenSchedPuByBus[i] - pLoadPuByBus[i];
        const dP = pSched - pCalcPu[i];
        mismatch[idx] = dP;
        if (Math.abs(dP) > maxActiveMismatchPu) {
          maxActiveMismatchPu = Math.abs(dP);
        }
      }

      for (let idx = 0; idx < nPq; idx++) {
        const i = pqBuses[idx];
        const qSched = fixedQGenPuByBus[i] - qLoadPuByBus[i];
        const dQ = qSched - qCalcPu[i];
        mismatch[nAng + idx] = dQ;
        if (Math.abs(dQ) > maxReactiveMismatchPu) {
          maxReactiveMismatchPu = Math.abs(dQ);
        }
      }

      if (
        maxActiveMismatchPu <= options.tolerancePu &&
        maxReactiveMismatchPu <= options.tolerancePu
      ) {
        converged = true;
        break;
      }

      if (nState === 0) {
        converged = true;
        break;
      }

      // Assemble analytical Jacobian J = [J11 J12; J21 J22]
      const J: number[][] = Array.from({ length: nState }, () =>
        new Array<number>(nState).fill(0)
      );

      // J11 = dP / dTheta and J12 = dP / dVm
      for (let r = 0; r < nAng; r++) {
        const i = angBuses[r];
        const vi = Vm[i];
        const ti = Va[i];

        for (let c = 0; c < nAng; c++) {
          const m = angBuses[c];
          if (i === m) {
            J[r][c] = -qCalcPu[i] - vi * vi * B[i][i];
          } else {
            const g = G[i][m];
            const b = B[i][m];
            if (g !== 0 || b !== 0) {
              const dTheta = ti - Va[m];
              J[r][c] = vi * Vm[m] * (g * Math.sin(dTheta) - b * Math.cos(dTheta));
            }
          }
        }

        for (let c = 0; c < nPq; c++) {
          const m = pqBuses[c];
          if (i === m) {
            J[r][nAng + c] = pCalcPu[i] / vi + vi * G[i][i];
          } else {
            const g = G[i][m];
            const b = B[i][m];
            if (g !== 0 || b !== 0) {
              const dTheta = ti - Va[m];
              J[r][nAng + c] = vi * (g * Math.cos(dTheta) + b * Math.sin(dTheta));
            }
          }
        }
      }

      // J21 = dQ / dTheta and J22 = dQ / dVm
      for (let r = 0; r < nPq; r++) {
        const i = pqBuses[r];
        const vi = Vm[i];
        const ti = Va[i];
        const rowOffset = nAng + r;

        for (let c = 0; c < nAng; c++) {
          const m = angBuses[c];
          if (i === m) {
            J[rowOffset][c] = pCalcPu[i] - vi * vi * G[i][i];
          } else {
            const g = G[i][m];
            const b = B[i][m];
            if (g !== 0 || b !== 0) {
              const dTheta = ti - Va[m];
              J[rowOffset][c] =
                -vi * Vm[m] * (g * Math.cos(dTheta) + b * Math.sin(dTheta));
            }
          }
        }

        for (let c = 0; c < nPq; c++) {
          const m = pqBuses[c];
          if (i === m) {
            J[rowOffset][nAng + c] = qCalcPu[i] / vi - vi * B[i][i];
          } else {
            const g = G[i][m];
            const b = B[i][m];
            if (g !== 0 || b !== 0) {
              const dTheta = ti - Va[m];
              J[rowOffset][nAng + c] =
                vi * (g * Math.sin(dTheta) - b * Math.cos(dTheta));
            }
          }
        }
      }

      const dx = solveLinearSystem(J, mismatch);
      if (!dx) {
        failureReason =
          'Jacobian matrix became singular during Newton-Raphson iteration (possible voltage collapse or unsolvable island topology).';
        converged = false;
        break;
      }

      // Apply state update with damping protection against wild divergence
      let diverged = false;
      for (let idx = 0; idx < nAng; idx++) {
        const i = angBuses[idx];
        Va[i] += dx[idx];
      }
      for (let idx = 0; idx < nPq; idx++) {
        const i = pqBuses[idx];
        Vm[i] += dx[nAng + idx];
        if (Vm[i] <= 0.15 || Vm[i] >= 2.5 || Number.isNaN(Vm[i])) {
          diverged = true;
        }
      }

      if (diverged) {
        failureReason =
          'Newton-Raphson voltage state diverged outside physical bounds (|V| < 0.15 p.u. or |V| > 2.50 p.u. — severe reactive deficit / voltage collapse).';
        converged = false;
        break;
      }
    }

    if (!converged) {
      if (!failureReason) {
        failureReason = `Newton-Raphson did not converge within ${options.maxIterations} iterations (Max mismatch: ΔP = ${(maxActiveMismatchPu * baseMva).toFixed(3)} MW, ΔQ = ${(maxReactiveMismatchPu * baseMva).toFixed(3)} MVAr).`;
      }
      break;
    }

    // Check PV bus reactive power limits if enforceReactiveLimits is enabled
    if (!options.enforceReactiveLimits) {
      break;
    }

    computePowerInjections();
    let anyPvConverted = false;

    for (const i of energizedBusesSorted) {
      if (effectiveBusType.get(i) !== 'pv') continue;
      const gens = onlineGensByBus.get(i) ?? [];
      if (gens.length === 0) continue;

      const qGenRequiredMvar = (qCalcPu[i] + qLoadPuByBus[i]) * baseMva;
      const qMaxTotalMvar = gens.reduce((acc, g) => acc + g.reactivePowerMaxMvar, 0);
      const qMinTotalMvar = gens.reduce((acc, g) => acc + g.reactivePowerMinMvar, 0);

      if (qGenRequiredMvar > qMaxTotalMvar + 1e-4) {
        effectiveBusType.set(i, 'pq');
        convertedFromPvToPq.set(i, true);
        qLimitViolation.set(i, 'qmax');
        fixedQGenPuByBus[i] = qMaxTotalMvar / baseMva;
        reactiveLimitEvents.push({
          outerIteration: outer,
          busNumber: i,
          generatorIds: gens.map((g) => g.id),
          violationType: 'qmax',
          unclampedQMvar: Number(qGenRequiredMvar.toFixed(2)),
          clampedQMvar: qMaxTotalMvar,
        });
        anyPvConverted = true;
      } else if (qGenRequiredMvar < qMinTotalMvar - 1e-4) {
        effectiveBusType.set(i, 'pq');
        convertedFromPvToPq.set(i, true);
        qLimitViolation.set(i, 'qmin');
        fixedQGenPuByBus[i] = qMinTotalMvar / baseMva;
        reactiveLimitEvents.push({
          outerIteration: outer,
          busNumber: i,
          generatorIds: gens.map((g) => g.id),
          violationType: 'qmin',
          unclampedQMvar: Number(qGenRequiredMvar.toFixed(2)),
          clampedQMvar: qMinTotalMvar,
        });
        anyPvConverted = true;
      }
    }

    if (!anyPvConverted) {
      break;
    }
  }

  const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const solveDurationMs = Number((endTime - startTime).toFixed(2));

  if (!converged) {
    return createFailedSolution(
      network,
      options,
      topology,
      failureReason ?? 'AC Power Flow failed to converge.',
      totalIterations,
      outerLoopCount,
      maxActiveMismatchPu,
      maxReactiveMismatchPu,
      solveDurationMs
    );
  }

  // Final injection refresh
  computePowerInjections();

  // Map bus number -> islandId
  const islandByBus = new Map<number, number>();
  for (const isl of topology.islands) {
    for (const bNum of isl.busNumbers) {
      islandByBus.set(bNum, isl.islandId);
    }
  }

  // 1. Compute Bus Solutions & Generator Dispatch Solutions
  const busSolutions: Record<number, BusSolution> = {};
  const generatorOutputs: Record<string, GeneratorDispatchSolution> = {};
  const shuntOutputs: Record<string, ShuntInjectionSolution> = {};

  let totalGenerationMw = 0;
  let totalGenerationMvar = 0;
  let totalLoadServedMw = 0;
  let totalLoadServedMvar = 0;
  let totalShuntInjectionMvar = 0;
  let minVoltagePu = Infinity;
  let minVoltageBusNumber = 1;
  let maxVoltagePu = -Infinity;
  let maxVoltageBusNumber = 1;
  let voltageViolationBusCount = 0;

  for (const sh of network.shunts) {
    const bNum = sh.busNumber;
    const isEnergized = energizedBusSet.has(bNum) && sh.status === 'online';
    const vm = isEnergized ? Vm[bNum] : 0;
    const pMw = isEnergized ? sh.conductanceMwAtUnitV * vm * vm : 0;
    const qInjectedMvar = isEnergized
      ? sh.configuredSusceptanceMvarAtUnitV * vm * vm
      : 0;

    shuntOutputs[sh.id] = {
      id: sh.id,
      busNumber: bNum,
      online: sh.status === 'online',
      energized: isEnergized,
      pMw: Number(pMw.toFixed(3)),
      qInjectedMvar: Number(qInjectedMvar.toFixed(3)),
    };
    totalShuntInjectionMvar += qInjectedMvar;
  }

  for (const bus of network.buses) {
    const i = bus.number;
    const isEnergized = energizedBusSet.has(i);
    const vm = isEnergized ? Vm[i] : 0;
    const vaDeg = isEnergized ? (Va[i] * 180) / Math.PI : 0;
    const vmKv = vm * bus.baseKv;

    const pLoadMw = isEnergized ? pLoadPuByBus[i] * baseMva : 0;
    const qLoadMvar = isEnergized ? qLoadPuByBus[i] * baseMva : 0;
    totalLoadServedMw += pLoadMw;
    totalLoadServedMvar += qLoadMvar;

    const busShunts = network.shunts.filter(
      (sh) => sh.busNumber === i && sh.status === 'online'
    );
    const qShuntMvar = isEnergized
      ? busShunts.reduce(
          (acc, sh) => acc + sh.configuredSusceptanceMvarAtUnitV * vm * vm,
          0
        )
      : 0;

    const gensAtBus = network.generators.filter((g) => g.busNumber === i);
    const onlineGens = gensAtBus.filter((g) => g.status === 'online' && isEnergized);

    let pGenBusMw = 0;
    let qGenBusMvar = 0;

    if (isEnergized && onlineGens.length > 0) {
      const bType = effectiveBusType.get(i)!;
      if (bType === 'slack') {
        pGenBusMw = (pCalcPu[i] + pLoadPuByBus[i]) * baseMva;
      } else {
        pGenBusMw = pGenSchedPuByBus[i] * baseMva;
      }

      if (convertedFromPvToPq.get(i)) {
        qGenBusMvar = fixedQGenPuByBus[i] * baseMva;
      } else {
        qGenBusMvar = (qCalcPu[i] + qLoadPuByBus[i]) * baseMva;
      }
    }

    for (const g of gensAtBus) {
      if (g.status !== 'online' || !isEnergized) {
        generatorOutputs[g.id] = {
          id: g.id,
          busNumber: i,
          online: g.status === 'online',
          energized: false,
          pMw: 0,
          qMvar: 0,
          sMva: 0,
          loadingPercent: 0,
          clampedAtQLimit: 'none',
        };
      } else {
        const share = 1 / onlineGens.length;
        const pMw =
          effectiveBusType.get(i) === 'slack'
            ? pGenBusMw * share
            : g.scheduledActivePowerMw;
        const qMvar = qGenBusMvar * share;
        const sMva = Math.hypot(pMw, qMvar);
        const loadingPercent = g.ratedMva > 0 ? (sMva / g.ratedMva) * 100 : 0;

        generatorOutputs[g.id] = {
          id: g.id,
          busNumber: i,
          online: true,
          energized: true,
          pMw: Number(pMw.toFixed(3)),
          qMvar: Number(qMvar.toFixed(3)),
          sMva: Number(sMva.toFixed(3)),
          loadingPercent: Number(loadingPercent.toFixed(2)),
          clampedAtQLimit: qLimitViolation.get(i) ?? 'none',
        };
      }
    }

    totalGenerationMw += pGenBusMw;
    totalGenerationMvar += qGenBusMvar;

    let voltageViolation: BusSolution['voltageViolation'] = 'none';
    if (!isEnergized) {
      voltageViolation = 'de-energized';
      voltageViolationBusCount++;
    } else {
      if (vm < minVoltagePu) {
        minVoltagePu = vm;
        minVoltageBusNumber = i;
      }
      if (vm > maxVoltagePu) {
        maxVoltagePu = vm;
        maxVoltageBusNumber = i;
      }
      if (vm > bus.vMaxPu + 1e-4) {
        voltageViolation = 'high';
        voltageViolationBusCount++;
      } else if (vm < bus.vMinPu - 1e-4) {
        voltageViolation = 'low';
        voltageViolationBusCount++;
      }
    }

    const pNetInjectionMw = isEnergized ? pCalcPu[i] * baseMva : 0;
    const qNetInjectionMvar = isEnergized ? qCalcPu[i] * baseMva : 0;
    const pMismatchMw = isEnergized ? pGenBusMw - pLoadMw - pNetInjectionMw : 0;
    const qMismatchMvar = isEnergized ? qGenBusMvar - qLoadMvar - qNetInjectionMvar : 0;

    busSolutions[i] = {
      busNumber: i,
      busId: bus.id,
      energized: isEnergized,
      islandId: islandByBus.get(i) ?? 0,
      effectiveBusType: effectiveBusType.get(i) ?? bus.busType,
      convertedFromPvToPq: convertedFromPvToPq.get(i) ?? false,
      qLimitViolationType: qLimitViolation.get(i) ?? 'none',
      vmPu: Number(vm.toFixed(5)),
      vaDeg: Number(vaDeg.toFixed(4)),
      vmKv: Number(vmKv.toFixed(3)),
      pGenMw: Number(pGenBusMw.toFixed(3)),
      qGenMvar: Number(qGenBusMvar.toFixed(3)),
      pLoadMw: Number(pLoadMw.toFixed(3)),
      qLoadMvar: Number(qLoadMvar.toFixed(3)),
      qShuntMvar: Number(qShuntMvar.toFixed(3)),
      pNetInjectionMw: Number(pNetInjectionMw.toFixed(3)),
      qNetInjectionMvar: Number(qNetInjectionMvar.toFixed(3)),
      pMismatchMw: Number(pMismatchMw.toFixed(5)),
      qMismatchMvar: Number(qMismatchMvar.toFixed(5)),
      voltageViolation,
    };
  }

  // 2. Compute Branch Flows (Lines & Transformers) at Both Ends + Losses + Loading %
  const lineFlows: Record<string, BranchFlowSolution> = {};
  const transformerFlows: Record<string, BranchFlowSolution> = {};

  let totalActiveLossesMw = 0;
  let totalReactiveLossesMvar = 0;
  let maxBranchLoadingPercent = 0;
  let maxLoadedBranchId = 'NONE';
  let overloadedBranchCount = 0;

  for (const line of network.lines) {
    const f = line.fromBusNumber;
    const t = line.toBusNumber;
    const inService = line.status === 'online';
    const isEnergized =
      inService && energizedBusSet.has(f) && energizedBusSet.has(t);

    if (!isEnergized) {
      lineFlows[line.id] = {
        id: line.id,
        category: 'line',
        fromBusNumber: f,
        toBusNumber: t,
        inService,
        energized: false,
        pFromMw: 0,
        qFromMvar: 0,
        sFromMva: 0,
        pToMw: 0,
        qToMvar: 0,
        sToMva: 0,
        maxApparentFlowMva: 0,
        lossMw: 0,
        lossMvar: 0,
        ratingMva: line.ratingMva,
        loadingPercent: 0,
        overloaded: false,
      };
      continue;
    }

    const r = line.resistancePu;
    const x = line.reactancePu;
    const denom = r * r + x * x;
    const gSeries = r / denom;
    const bSeries = -x / denom;
    const bChHalf = line.chargingSusceptancePu / 2;

    const vf = Vm[f];
    const vt = Vm[t];
    const dTheta = Va[f] - Va[t];
    const cosFT = Math.cos(dTheta);
    const sinFT = Math.sin(dTheta);

    // P_ft + jQ_ft
    const pFromPu =
      vf * vf * gSeries - vf * vt * (gSeries * cosFT + bSeries * sinFT);
    const qFromPu =
      -vf * vf * (bSeries + bChHalf) -
      vf * vt * (gSeries * sinFT - bSeries * cosFT);

    // P_tf + jQ_tf
    const pToPu =
      vt * vt * gSeries - vt * vf * (gSeries * cosFT - bSeries * sinFT);
    const qToPu =
      -vt * vt * (bSeries + bChHalf) -
      vt * vf * (-gSeries * sinFT - bSeries * cosFT);

    const pFromMw = pFromPu * baseMva;
    const qFromMvar = qFromPu * baseMva;
    const sFromMva = Math.hypot(pFromMw, qFromMvar);

    const pToMw = pToPu * baseMva;
    const qToMvar = qToPu * baseMva;
    const sToMva = Math.hypot(pToMw, qToMvar);

    const maxApparentFlowMva = Math.max(sFromMva, sToMva);
    const lossMw = pFromMw + pToMw;
    const lossMvar = qFromMvar + qToMvar;
    const loadingPercent =
      line.ratingMva > 0 ? (maxApparentFlowMva / line.ratingMva) * 100 : 0;
    const overloaded = loadingPercent > 100.0;

    totalActiveLossesMw += lossMw;
    totalReactiveLossesMvar += lossMvar;

    if (loadingPercent > maxBranchLoadingPercent) {
      maxBranchLoadingPercent = loadingPercent;
      maxLoadedBranchId = line.id;
    }
    if (overloaded) {
      overloadedBranchCount++;
    }

    lineFlows[line.id] = {
      id: line.id,
      category: 'line',
      fromBusNumber: f,
      toBusNumber: t,
      inService: true,
      energized: true,
      pFromMw: Number(pFromMw.toFixed(3)),
      qFromMvar: Number(qFromMvar.toFixed(3)),
      sFromMva: Number(sFromMva.toFixed(3)),
      pToMw: Number(pToMw.toFixed(3)),
      qToMvar: Number(qToMvar.toFixed(3)),
      sToMva: Number(sToMva.toFixed(3)),
      maxApparentFlowMva: Number(maxApparentFlowMva.toFixed(3)),
      lossMw: Number(lossMw.toFixed(4)),
      lossMvar: Number(lossMvar.toFixed(4)),
      ratingMva: line.ratingMva,
      loadingPercent: Number(loadingPercent.toFixed(2)),
      overloaded,
    };
  }

  for (const tr of network.transformers) {
    const f = tr.fromBusNumber;
    const t = tr.toBusNumber;
    const inService = tr.status === 'online';
    const isEnergized =
      inService && energizedBusSet.has(f) && energizedBusSet.has(t);

    if (!isEnergized) {
      transformerFlows[tr.id] = {
        id: tr.id,
        category: 'transformer',
        fromBusNumber: f,
        toBusNumber: t,
        inService,
        energized: false,
        pFromMw: 0,
        qFromMvar: 0,
        sFromMva: 0,
        pToMw: 0,
        qToMvar: 0,
        sToMva: 0,
        maxApparentFlowMva: 0,
        lossMw: 0,
        lossMvar: 0,
        ratingMva: tr.ratingMva,
        loadingPercent: 0,
        overloaded: false,
      };
      continue;
    }

    const r = tr.resistancePu;
    const x = tr.reactancePu;
    const denom = r * r + x * x;
    const gSeries = r / denom;
    const bSeries = -x / denom;
    const tap = tr.tapRatioPu > 0 ? tr.tapRatioPu : 1.0;
    const shiftRad = (tr.phaseShiftDeg * Math.PI) / 180;

    const vf = Vm[f];
    const vt = Vm[t];
    const dTheta = Va[f] - Va[t] - shiftRad;
    const cosFT = Math.cos(dTheta);
    const sinFT = Math.sin(dTheta);

    // P_ft + jQ_ft (with tap on from-bus side)
    const pFromPu =
      ((vf * vf) / (tap * tap)) * gSeries -
      ((vf * vt) / tap) * (gSeries * cosFT + bSeries * sinFT);
    const qFromPu =
      -((vf * vf) / (tap * tap)) * bSeries -
      ((vf * vt) / tap) * (gSeries * sinFT - bSeries * cosFT);

    // P_tf + jQ_tf
    const pToPu =
      vt * vt * gSeries -
      ((vt * vf) / tap) * (gSeries * cosFT - bSeries * sinFT);
    const qToPu =
      -vt * vt * bSeries -
      ((vt * vf) / tap) * (-gSeries * sinFT - bSeries * cosFT);

    const pFromMw = pFromPu * baseMva;
    const qFromMvar = qFromPu * baseMva;
    const sFromMva = Math.hypot(pFromMw, qFromMvar);

    const pToMw = pToPu * baseMva;
    const qToMvar = qToPu * baseMva;
    const sToMva = Math.hypot(pToMw, qToMvar);

    const maxApparentFlowMva = Math.max(sFromMva, sToMva);
    const lossMw = pFromMw + pToMw;
    const lossMvar = qFromMvar + qToMvar;
    const loadingPercent =
      tr.ratingMva > 0 ? (maxApparentFlowMva / tr.ratingMva) * 100 : 0;
    const overloaded = loadingPercent > 100.0;

    totalActiveLossesMw += lossMw;
    totalReactiveLossesMvar += lossMvar;

    if (loadingPercent > maxBranchLoadingPercent) {
      maxBranchLoadingPercent = loadingPercent;
      maxLoadedBranchId = tr.id;
    }
    if (overloaded) {
      overloadedBranchCount++;
    }

    transformerFlows[tr.id] = {
      id: tr.id,
      category: 'transformer',
      fromBusNumber: f,
      toBusNumber: t,
      inService: true,
      energized: true,
      pFromMw: Number(pFromMw.toFixed(3)),
      qFromMvar: Number(qFromMvar.toFixed(3)),
      sFromMva: Number(sFromMva.toFixed(3)),
      pToMw: Number(pToMw.toFixed(3)),
      qToMvar: Number(qToMvar.toFixed(3)),
      sToMva: Number(sToMva.toFixed(3)),
      maxApparentFlowMva: Number(maxApparentFlowMva.toFixed(3)),
      lossMw: Number(lossMw.toFixed(4)),
      lossMvar: Number(lossMvar.toFixed(4)),
      ratingMva: tr.ratingMva,
      loadingPercent: Number(loadingPercent.toFixed(2)),
      overloaded,
    };
  }

  return {
    converged: true,
    status: 'converged',
    failureReason: null,
    iterations: totalIterations,
    outerLoopCount,
    solveDurationMs,
    maxActiveMismatchPu,
    maxReactiveMismatchPu,
    maxActiveMismatchMw: Number((maxActiveMismatchPu * baseMva).toFixed(6)),
    maxReactiveMismatchMvar: Number((maxReactiveMismatchPu * baseMva).toFixed(6)),
    optionsUsed: options,
    topology,
    reactiveLimitEvents,
    busSolutions,
    lineFlows,
    transformerFlows,
    generatorOutputs,
    shuntOutputs,
    summary: {
      totalGenerationMw: Number(totalGenerationMw.toFixed(2)),
      totalGenerationMvar: Number(totalGenerationMvar.toFixed(2)),
      totalLoadServedMw: Number(totalLoadServedMw.toFixed(2)),
      totalLoadServedMvar: Number(totalLoadServedMvar.toFixed(2)),
      totalUnsuppliedLoadMw: Number(topology.unsuppliedLoadMw.toFixed(2)),
      totalActiveLossesMw: Number(totalActiveLossesMw.toFixed(3)),
      totalReactiveLossesMvar: Number(totalReactiveLossesMvar.toFixed(3)),
      totalShuntInjectionMvar: Number(totalShuntInjectionMvar.toFixed(2)),
      minVoltagePu: Number((minVoltagePu === Infinity ? 0 : minVoltagePu).toFixed(4)),
      minVoltageBusNumber,
      maxVoltagePu: Number((maxVoltagePu === -Infinity ? 0 : maxVoltagePu).toFixed(4)),
      maxVoltageBusNumber,
      maxBranchLoadingPercent: Number(maxBranchLoadingPercent.toFixed(2)),
      maxLoadedBranchId,
      overloadedBranchCount,
      voltageViolationBusCount,
    },
  };
}

function createFailedSolution(
  network: PowerNetworkModel,
  options: AcPowerFlowOptions,
  topology: TopologyDiagnostics,
  failureReason: string,
  iterations: number,
  outerLoopCount: number,
  maxActiveMismatchPu: number,
  maxReactiveMismatchPu: number,
  solveDurationMs: number
): PowerFlowSolutionResult {
  const baseMva = network.metadata.baseMva;
  return {
    converged: false,
    status: 'failed',
    failureReason,
    iterations,
    outerLoopCount,
    solveDurationMs: Number(solveDurationMs.toFixed(2)),
    maxActiveMismatchPu,
    maxReactiveMismatchPu,
    maxActiveMismatchMw: Number((maxActiveMismatchPu * baseMva).toFixed(4)),
    maxReactiveMismatchMvar: Number((maxReactiveMismatchPu * baseMva).toFixed(4)),
    optionsUsed: options,
    topology,
    reactiveLimitEvents: [],
    busSolutions: {},
    lineFlows: {},
    transformerFlows: {},
    generatorOutputs: {},
    shuntOutputs: {},
    summary: {
      totalGenerationMw: 0,
      totalGenerationMvar: 0,
      totalLoadServedMw: 0,
      totalLoadServedMvar: 0,
      totalUnsuppliedLoadMw: Number(topology.unsuppliedLoadMw.toFixed(2)),
      totalActiveLossesMw: 0,
      totalReactiveLossesMvar: 0,
      totalShuntInjectionMvar: 0,
      minVoltagePu: 0,
      minVoltageBusNumber: 1,
      maxVoltagePu: 0,
      maxVoltageBusNumber: 1,
      maxBranchLoadingPercent: 0,
      maxLoadedBranchId: 'NONE',
      overloadedBranchCount: 0,
      voltageViolationBusCount: 0,
    },
  };
}
