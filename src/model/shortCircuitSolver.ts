import {
  PowerNetworkModel,
  PowerFlowSolutionResult,
} from '../types/network';
import {
  BranchFaultContribution,
  BusFaultVoltage,
  ComplexNumber,
  GeneratorFaultContribution,
  PhaseComponents,
  SequenceComponents,
  ShortCircuitScenario,
  ShortCircuitSolution,
} from '../types/shortCircuit';
import {
  complex,
  cAdd,
  cSub,
  cMul,
  cDiv,
  cRecip,
  cMag,
  cAngleDeg,
  cScale,
  cFull,
  solveComplexLinearSystem,
  sequenceToPhase,
  C_ZERO,
  C_ONE,
} from './complex';
import { getIeee30SequenceDataset } from './shortCircuitBenchmarkData';

export const DEFAULT_SC_SCENARIO: ShortCircuitScenario = {
  faultedBusNumber: 1, // Glen Lyn 132 kV Slack Bus
  faultType: '3phase',
  faultResistanceOhms: 0.0,
  faultReactanceOhms: 0.0,
  faultResistancePu: 0.0,
  faultReactancePu: 0.0,
  prefaultVoltageMode: 'power-flow',
  includePassiveLoads: false,
};

/**
 * Calculates short-circuit currents, symmetrical sequence quantities,
 * source contributions, and post-fault bus voltages for a given network and fault scenario.
 */
export function solveShortCircuit(
  network: PowerNetworkModel,
  scenario: ShortCircuitScenario,
  powerFlowSolution: PowerFlowSolutionResult | null
): ShortCircuitSolution {
  const timestamp = Date.now();
  const sequenceDataset = getIeee30SequenceDataset(network);

  const busByNum = new Map(network.buses.map((b) => [b.number, b]));
  const faultedBus = busByNum.get(scenario.faultedBusNumber);

  if (!faultedBus) {
    return createErrorSolution(
      scenario,
      `Faulted bus #${scenario.faultedBusNumber} does not exist in the network.`,
      timestamp
    );
  }

  if (faultedBus.status !== 'online') {
    return createErrorSolution(
      scenario,
      `Bus #${faultedBus.number} (${faultedBus.name}) is currently offline / disconnected. Fault cannot be initiated on a de-energized bus.`,
      timestamp
    );
  }

  // Active online buses mapped to contiguous indices 0 .. N-1
  const onlineBuses = network.buses
    .filter((b) => b.status === 'online')
    .sort((a, b) => a.number - b.number);

  const n = onlineBuses.length;
  const busIdxMap = new Map<number, number>();
  onlineBuses.forEach((b, idx) => busIdxMap.set(b.number, idx));

  const faultIdx = busIdxMap.get(scenario.faultedBusNumber);
  if (faultIdx === undefined) {
    return createErrorSolution(
      scenario,
      `Faulted bus #${scenario.faultedBusNumber} is not active in the current network topology.`,
      timestamp
    );
  }

  const baseMva = network.metadata.baseMva || 100;

  // Initialize N x N complex sequence admittance matrices
  const Y1: ComplexNumber[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => ({ re: 0, im: 0 }))
  );
  const Y2: ComplexNumber[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => ({ re: 0, im: 0 }))
  );
  const Y0: ComplexNumber[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => ({ re: 0, im: 0 }))
  );

  // 1. Transmission Lines
  for (const line of network.lines) {
    if (line.status !== 'online') continue;
    const fIdx = busIdxMap.get(line.fromBusNumber);
    const tIdx = busIdxMap.get(line.toBusNumber);
    if (fIdx === undefined || tIdx === undefined) continue;

    // Positive and Negative Sequence line parameters
    const r1 = line.resistancePu;
    const x1 = line.reactancePu;
    const z1 = complex(r1, x1);
    const y1Series = cRecip(z1);
    const b1Half = line.chargingSusceptancePu / 2;

    // Y1
    Y1[fIdx][fIdx] = cAdd(Y1[fIdx][fIdx], cAdd(y1Series, complex(0, b1Half)));
    Y1[tIdx][tIdx] = cAdd(Y1[tIdx][tIdx], cAdd(y1Series, complex(0, b1Half)));
    Y1[fIdx][tIdx] = cSub(Y1[fIdx][tIdx], y1Series);
    Y1[tIdx][fIdx] = cSub(Y1[tIdx][fIdx], y1Series);

    // Y2: identical series impedance, no charging susceptance in standard negative sequence
    Y2[fIdx][fIdx] = cAdd(Y2[fIdx][fIdx], y1Series);
    Y2[tIdx][tIdx] = cAdd(Y2[tIdx][tIdx], y1Series);
    Y2[fIdx][tIdx] = cSub(Y2[fIdx][tIdx], y1Series);
    Y2[tIdx][fIdx] = cSub(Y2[tIdx][fIdx], y1Series);

    // Zero Sequence line parameters
    const seqLine = sequenceDataset.lines[line.id];
    const r0 = seqLine ? seqLine.zeroResistancePu : r1 * 3.0;
    const x0 = seqLine ? seqLine.zeroReactancePu : x1 * 3.0;
    const b0Half = seqLine ? seqLine.zeroSusceptancePu / 2 : b1Half * 0.5;
    const z0 = complex(r0, x0);
    const y0Series = cRecip(z0);

    // Y0
    Y0[fIdx][fIdx] = cAdd(Y0[fIdx][fIdx], cAdd(y0Series, complex(0, b0Half)));
    Y0[tIdx][tIdx] = cAdd(Y0[tIdx][tIdx], cAdd(y0Series, complex(0, b0Half)));
    Y0[fIdx][tIdx] = cSub(Y0[fIdx][tIdx], y0Series);
    Y0[tIdx][fIdx] = cSub(Y0[tIdx][fIdx], y0Series);
  }

  // 2. Transformers
  for (const tr of network.transformers) {
    if (tr.status !== 'online') continue;
    const fIdx = busIdxMap.get(tr.fromBusNumber);
    const tIdx = busIdxMap.get(tr.toBusNumber);
    if (fIdx === undefined || tIdx === undefined) continue;

    const r1 = tr.resistancePu;
    const x1 = tr.reactancePu;
    const z1 = complex(r1, x1);
    const y1Series = cRecip(z1);
    const tap = tr.tapRatioPu > 0 ? tr.tapRatioPu : 1.0;
    const tapSq = tap * tap;

    // Y1: with off-nominal tap ratio
    Y1[fIdx][fIdx] = cAdd(Y1[fIdx][fIdx], cScale(y1Series, 1 / tapSq));
    Y1[tIdx][tIdx] = cAdd(Y1[tIdx][tIdx], y1Series);
    Y1[fIdx][tIdx] = cSub(Y1[fIdx][tIdx], cScale(y1Series, 1 / tap));
    Y1[tIdx][fIdx] = cSub(Y1[tIdx][fIdx], cScale(y1Series, 1 / tap));

    // Y2: identical leakage impedance
    Y2[fIdx][fIdx] = cAdd(Y2[fIdx][fIdx], cScale(y1Series, 1 / tapSq));
    Y2[tIdx][tIdx] = cAdd(Y2[tIdx][tIdx], y1Series);
    Y2[fIdx][tIdx] = cSub(Y2[fIdx][tIdx], cScale(y1Series, 1 / tap));
    Y2[tIdx][fIdx] = cSub(Y2[tIdx][fIdx], cScale(y1Series, 1 / tap));

    // Zero Sequence: dependent on winding connections
    const seqXfmr = sequenceDataset.transformers[tr.id];
    const r0 = seqXfmr ? seqXfmr.zeroResistancePu : r1;
    const x0 = seqXfmr ? seqXfmr.zeroReactancePu : x1;
    const z0 = complex(r0, x0);
    const y0Series = cRecip(z0);
    const conn = seqXfmr ? seqXfmr.connection : 'delta-wye_grounded';

    if (conn === 'delta-wye_grounded') {
      // Delta on from-side (132 kV), Grounded-Wye on to-side (33 kV)
      // Low-voltage wye side is connected to ground through leakage impedance; Delta side is open
      Y0[tIdx][tIdx] = cAdd(Y0[tIdx][tIdx], y0Series);
    } else if (conn === 'wye_grounded-delta') {
      Y0[fIdx][fIdx] = cAdd(Y0[fIdx][fIdx], y0Series);
    } else if (conn === 'wye_grounded-wye_grounded') {
      Y0[fIdx][fIdx] = cAdd(Y0[fIdx][fIdx], y0Series);
      Y0[tIdx][tIdx] = cAdd(Y0[tIdx][tIdx], y0Series);
      Y0[fIdx][tIdx] = cSub(Y0[fIdx][tIdx], y0Series);
      Y0[tIdx][fIdx] = cSub(Y0[tIdx][fIdx], y0Series);
    }
    // 'delta-delta' adds 0 to Y0 (both sides open to zero sequence)
  }

  // 3. Synchronous Generators and Condensers
  for (const gen of network.generators) {
    if (gen.status !== 'online') continue;
    const gIdx = busIdxMap.get(gen.busNumber);
    if (gIdx === undefined) continue;

    const seqGen = sequenceDataset.generators[gen.id];
    const xdp = seqGen ? seqGen.subtransientReactanceXdpPu : 0.20 * (baseMva / gen.ratedMva);
    const x2 = seqGen ? seqGen.negativeSequenceReactanceX2Pu : xdp;
    const x0 = seqGen ? seqGen.zeroSequenceReactanceX0Pu : xdp * 0.5;

    // Positive sequence: machine internal impedance to ground (1 / jX''d)
    const yG1 = cRecip(complex(0, xdp));
    Y1[gIdx][gIdx] = cAdd(Y1[gIdx][gIdx], yG1);

    // Negative sequence: machine negative-sequence impedance to ground (1 / jX2)
    const yG2 = cRecip(complex(0, x2));
    Y2[gIdx][gIdx] = cAdd(Y2[gIdx][gIdx], yG2);

    // Zero sequence: machine zero-sequence impedance + 3*Zn to ground
    const rn = seqGen ? seqGen.neutralGroundingResistanceRnPu : 0;
    const xn = seqGen ? seqGen.neutralGroundingReactanceXnPu : 0;
    const zG0 = complex(3 * rn, x0 + 3 * xn);
    const yG0 = cRecip(zG0);
    Y0[gIdx][gIdx] = cAdd(Y0[gIdx][gIdx], yG0);
  }

  // 4. Switched Shunts
  for (const shunt of network.shunts) {
    if (shunt.status !== 'online') continue;
    const sIdx = busIdxMap.get(shunt.busNumber);
    if (sIdx === undefined) continue;

    const bPu = shunt.configuredSusceptanceMvarAtUnitV / baseMva;
    const gPu = shunt.conductanceMwAtUnitV / baseMva;
    const ySh = complex(gPu, bPu);

    Y1[sIdx][sIdx] = cAdd(Y1[sIdx][sIdx], ySh);
    // Switched capacitors are ungrounded or delta in sequence analysis; not added to Y0
  }

  // 5. Passive Loads (optional based on scenario settings)
  if (scenario.includePassiveLoads) {
    for (const load of network.loads) {
      if (load.status !== 'connected') continue;
      const lIdx = busIdxMap.get(load.busNumber);
      if (lIdx === undefined) continue;

      const pPu = (load.configuredActivePowerMw * network.loadScaleFactor) / baseMva;
      const qPu = (load.configuredReactivePowerMvar * network.loadScaleFactor) / baseMva;
      const busSol = powerFlowSolution?.busSolutions[load.busNumber];
      const vMag = busSol && busSol.vmPu > 0.1 ? busSol.vmPu : 1.0;
      const vMagSq = vMag * vMag;

      const yLoad = complex(pPu / vMagSq, -qPu / vMagSq);
      Y1[lIdx][lIdx] = cAdd(Y1[lIdx][lIdx], yLoad);
      Y2[lIdx][lIdx] = cAdd(Y2[lIdx][lIdx], yLoad);
    }
  }

  // 6. Compute Thevenin Driving-Point and Transfer Impedances
  // Form unit injection vector at the faulted bus: e_k = [0, ..., 1, ..., 0]^T
  const eK: ComplexNumber[] = Array.from({ length: n }, (_, i) =>
    i === faultIdx ? C_ONE : C_ZERO
  );

  // Solve Y1 * z1 = e_k -> z1 is the k-th column of Z_bus^(1)
  const zCol1 = solveComplexLinearSystem(Y1, eK);
  if (!zCol1) {
    return createErrorSolution(
      scenario,
      'Positive-sequence admittance matrix is singular. Ensure at least one generator is online.',
      timestamp
    );
  }

  // Solve Y2 * z2 = e_k -> z2 is the k-th column of Z_bus^(2)
  const zCol2 = solveComplexLinearSystem(Y2, eK);
  if (!zCol2) {
    return createErrorSolution(
      scenario,
      'Negative-sequence admittance matrix is singular.',
      timestamp
    );
  }

  // Solve Y0 * z0 = e_k -> z0 is the k-th column of Z_bus^(0)
  const zCol0 = solveComplexLinearSystem(Y0, eK);

  const zkk1 = zCol1[faultIdx];
  const zkk2 = zCol2[faultIdx];
  const zkk0 = zCol0 ? zCol0[faultIdx] : complex(999999, 999999);

  // 7. Prefault Voltage Profile
  let vfMag = 1.0;
  let vfAngleDeg = 0.0;
  const pfBusSol = powerFlowSolution?.busSolutions[scenario.faultedBusNumber];

  if (scenario.prefaultVoltageMode === 'power-flow' && pfBusSol && pfBusSol.energized) {
    vfMag = pfBusSol.vmPu;
    vfAngleDeg = pfBusSol.vaDeg;
  }

  const vfRad = (vfAngleDeg * Math.PI) / 180;
  const Vf: ComplexNumber = {
    re: vfMag * Math.cos(vfRad),
    im: vfMag * Math.sin(vfRad),
  };

  // Convert fault impedance Rf + jXf to p.u. if entered in ohms
  // Z_base = V_base_kV^2 / S_base_MVA
  const vBaseKv = faultedBus.baseKv;
  const zBaseOhms = (vBaseKv * vBaseKv) / baseMva;

  let rfPu = scenario.faultResistancePu;
  let xfPu = scenario.faultReactancePu;

  if (scenario.faultResistanceOhms !== 0 || scenario.faultReactanceOhms !== 0) {
    rfPu = scenario.faultResistanceOhms / zBaseOhms;
    xfPu = scenario.faultReactanceOhms / zBaseOhms;
  }

  const Zf = complex(rfPu, xfPu);

  // 8. Symmetrical Component Fault Current Calculations
  let I0: ComplexNumber = C_ZERO;
  let I1: ComplexNumber = C_ZERO;
  let I2: ComplexNumber = C_ZERO;

  switch (scenario.faultType) {
    case '3phase': {
      // 3-Phase Balanced Fault:
      // I1 = Vf / (Zkk1 + Zf)
      // I2 = 0, I0 = 0
      const denom = cAdd(zkk1, Zf);
      I1 = cDiv(Vf, denom);
      I2 = C_ZERO;
      I0 = C_ZERO;
      break;
    }

    case 'single-line-to-ground': {
      // Single-Line-to-Ground Fault (Phase A to Ground):
      // Sequence networks connected in series:
      // I0 = I1 = I2 = Vf / (Zkk1 + Zkk2 + Zkk0 + 3*Zf)
      if (!zCol0) {
        return createErrorSolution(
          scenario,
          `Cannot calculate Single-Line-to-Ground fault at Bus #${faultedBus.number}: Bus #${faultedBus.number} has no active zero-sequence path to ground (ungrounded subnetwork).`,
          timestamp
        );
      }
      const threeZf = cScale(Zf, 3);
      const denom = cAdd(zkk1, cAdd(zkk2, cAdd(zkk0, threeZf)));
      const iCommon = cDiv(Vf, denom);
      I0 = iCommon;
      I1 = iCommon;
      I2 = iCommon;
      break;
    }

    case 'line-to-line': {
      // Line-to-Line Fault (Phases B to C):
      // Positive and Negative sequence networks in parallel:
      // I1 = Vf / (Zkk1 + Zkk2 + Zf)
      // I2 = -I1, I0 = 0
      const denom = cAdd(zkk1, cAdd(zkk2, Zf));
      I1 = cDiv(Vf, denom);
      I2 = cScale(I1, -1);
      I0 = C_ZERO;
      break;
    }

    case 'double-line-to-ground': {
      // Double-Line-to-Ground Fault (Phases B & C to Ground):
      // Negative and zero sequence networks in parallel:
      // Z_parallel = Zkk2 * (Zkk0 + 3*Zf) / (Zkk2 + Zkk0 + 3*Zf)
      // I1 = Vf / (Zkk1 + Z_parallel)
      if (!zCol0) {
        return createErrorSolution(
          scenario,
          `Cannot calculate Double-Line-to-Ground fault at Bus #${faultedBus.number}: Bus #${faultedBus.number} has no active zero-sequence path to ground.`,
          timestamp
        );
      }
      const z0Plus3Zf = cAdd(zkk0, cScale(Zf, 3));
      const zParallel = cDiv(cMul(zkk2, z0Plus3Zf), cAdd(zkk2, z0Plus3Zf));
      I1 = cDiv(Vf, cAdd(zkk1, zParallel));
      I2 = cScale(cDiv(cMul(I1, z0Plus3Zf), cAdd(zkk2, z0Plus3Zf)), -1);
      I0 = cScale(cDiv(cMul(I1, zkk2), cAdd(zkk2, z0Plus3Zf)), -1);
      break;
    }
  }

  // Sequence fault currents
  const seqCurrents: SequenceComponents<ComplexNumber> = { zero: I0, positive: I1, negative: I2 };

  // Phase fault currents via symmetrical components transformation
  const phaseCurrentsPu = sequenceToPhase(seqCurrents);

  // Base current at faulted bus
  // I_base_kA = S_base_MVA / (sqrt(3) * V_base_kV)
  const iBaseKa = baseMva / (Math.sqrt(3) * vBaseKv);

  const phaseCurrentsKa: PhaseComponents<number> = {
    a: cMag(phaseCurrentsPu.a) * iBaseKa,
    b: cMag(phaseCurrentsPu.b) * iBaseKa,
    c: cMag(phaseCurrentsPu.c) * iBaseKa,
  };

  const phaseCurrentsA: PhaseComponents<number> = {
    a: phaseCurrentsKa.a * 1000,
    b: phaseCurrentsKa.b * 1000,
    c: phaseCurrentsKa.c * 1000,
  };

  // Total fault current magnitude (maximum phase current for unbalanced faults)
  let totalFaultCurrentPu = cMag(I1);
  let totalFaultCurrentAngleDeg = cAngleDeg(I1);

  if (scenario.faultType === 'single-line-to-ground') {
    totalFaultCurrentPu = cMag(phaseCurrentsPu.a);
    totalFaultCurrentAngleDeg = cAngleDeg(phaseCurrentsPu.a);
  } else if (scenario.faultType === 'line-to-line') {
    totalFaultCurrentPu = cMag(phaseCurrentsPu.b);
    totalFaultCurrentAngleDeg = cAngleDeg(phaseCurrentsPu.b);
  } else if (scenario.faultType === 'double-line-to-ground') {
    totalFaultCurrentPu = Math.max(cMag(phaseCurrentsPu.b), cMag(phaseCurrentsPu.c));
    totalFaultCurrentAngleDeg = cAngleDeg(phaseCurrentsPu.b);
  }

  const totalFaultCurrentKa = totalFaultCurrentPu * iBaseKa;
  const totalFaultCurrentA = totalFaultCurrentKa * 1000;

  // Fault duty: S_sc_MVA = sqrt(3) * V_base_kV * I_fault_kA
  const shortCircuitMva = Math.sqrt(3) * vBaseKv * totalFaultCurrentKa;

  // Ground return current (for SLG and DLG faults: 3 * I0)
  const groundCurrentPu = cMag(cScale(I0, 3));
  const groundCurrentKa = groundCurrentPu * iBaseKa;
  const groundCurrentA = groundCurrentKa * 1000;

  // 9. Post-Fault Bus Voltages
  // V_i^(1) = V_fi - Z_ik^(1) * I1
  // V_i^(2) = - Z_ik^(2) * I2
  // V_i^(0) = - Z_ik^(0) * I0
  const busVoltages: BusFaultVoltage[] = [];
  let severeSagBusCount = 0;

  for (let i = 0; i < n; i++) {
    const bus = onlineBuses[i];
    let vfiMag = 1.0;
    let vfiAngle = 0.0;
    const bSol = powerFlowSolution?.busSolutions[bus.number];
    if (scenario.prefaultVoltageMode === 'power-flow' && bSol && bSol.energized) {
      vfiMag = bSol.vmPu;
      vfiAngle = (bSol.vaDeg * Math.PI) / 180;
    }
    const Vfi: ComplexNumber = {
      re: vfiMag * Math.cos(vfiAngle),
      im: vfiMag * Math.sin(vfiAngle),
    };

    const zik1 = zCol1[i];
    const zik2 = zCol2[i];
    const zik0 = zCol0 ? zCol0[i] : C_ZERO;

    const v1 = cSub(Vfi, cMul(zik1, I1));
    const v2 = cSub(C_ZERO, cMul(zik2, I2));
    const v0 = cSub(C_ZERO, cMul(zik0, I0));

    const vPhases = sequenceToPhase({ zero: v0, positive: v1, negative: v2 });
    const bVbaseKv = bus.baseKv;
    const lnFactor = bVbaseKv / Math.sqrt(3);

    const magA = cMag(vPhases.a);
    const magB = cMag(vPhases.b);
    const magC = cMag(vPhases.c);
    const minMag = Math.min(magA, magB, magC);

    const isFaulted = bus.number === scenario.faultedBusNumber;
    const isSevereSag = minMag < 0.70;
    if (isSevereSag) severeSagBusCount++;

    busVoltages.push({
      busNumber: bus.number,
      busId: bus.id,
      busName: bus.name,
      baseKv: bus.baseKv,
      isFaultedBus: isFaulted,
      vPositivePu: { mag: cMag(v1), angleDeg: cAngleDeg(v1) },
      vNegativePu: { mag: cMag(v2), angleDeg: cAngleDeg(v2) },
      vZeroPu: { mag: cMag(v0), angleDeg: cAngleDeg(v0) },
      phaseVoltagesPu: {
        a: { mag: magA, angleDeg: cAngleDeg(vPhases.a) },
        b: { mag: magB, angleDeg: cAngleDeg(vPhases.b) },
        c: { mag: magC, angleDeg: cAngleDeg(vPhases.c) },
      },
      phaseVoltagesKv: {
        a: magA * lnFactor,
        b: magB * lnFactor,
        c: magC * lnFactor,
      },
      minPhaseVoltagePu: minMag,
      voltageSagPercent: Math.max(0, (1 - minMag) * 100),
      isSevereSag,
    });
  }

  // 10. Branch Fault Contributions (Lines & Transformers connected to faulted bus)
  const branchContributions: BranchFaultContribution[] = [];

  // Transmission lines connected to faulted bus
  for (const line of network.lines) {
    if (line.status !== 'online') continue;
    if (line.fromBusNumber !== scenario.faultedBusNumber && line.toBusNumber !== scenario.faultedBusNumber) {
      continue;
    }

    const otherBusNum = line.fromBusNumber === scenario.faultedBusNumber ? line.toBusNumber : line.fromBusNumber;
    const otherIdx = busIdxMap.get(otherBusNum);
    if (otherIdx === undefined) continue;

    // Post-fault voltages at both ends
    const vFaultVoltages = busVoltages[faultIdx];
    const vOtherVoltages = busVoltages[otherIdx];

    // Branch parameters
    const r1 = line.resistancePu;
    const x1 = line.reactancePu;
    const y1 = cRecip(complex(r1, x1));

    const seqLine = sequenceDataset.lines[line.id];
    const r0 = seqLine ? seqLine.zeroResistancePu : r1 * 3.0;
    const x0 = seqLine ? seqLine.zeroReactancePu : x1 * 3.0;
    const y0 = cRecip(complex(r0, x0));

    // Voltage drop from other bus into faulted bus: DeltaV = V_other - V_fault
    const dV1 = cSub(
      complex(
        vOtherVoltages.vPositivePu.mag * Math.cos((vOtherVoltages.vPositivePu.angleDeg * Math.PI) / 180),
        vOtherVoltages.vPositivePu.mag * Math.sin((vOtherVoltages.vPositivePu.angleDeg * Math.PI) / 180)
      ),
      complex(
        vFaultVoltages.vPositivePu.mag * Math.cos((vFaultVoltages.vPositivePu.angleDeg * Math.PI) / 180),
        vFaultVoltages.vPositivePu.mag * Math.sin((vFaultVoltages.vPositivePu.angleDeg * Math.PI) / 180)
      )
    );

    const dV2 = cSub(
      complex(
        vOtherVoltages.vNegativePu.mag * Math.cos((vOtherVoltages.vNegativePu.angleDeg * Math.PI) / 180),
        vOtherVoltages.vNegativePu.mag * Math.sin((vOtherVoltages.vNegativePu.angleDeg * Math.PI) / 180)
      ),
      complex(
        vFaultVoltages.vNegativePu.mag * Math.cos((vFaultVoltages.vNegativePu.angleDeg * Math.PI) / 180),
        vFaultVoltages.vNegativePu.mag * Math.sin((vFaultVoltages.vNegativePu.angleDeg * Math.PI) / 180)
      )
    );

    const dV0 = cSub(
      complex(
        vOtherVoltages.vZeroPu.mag * Math.cos((vOtherVoltages.vZeroPu.angleDeg * Math.PI) / 180),
        vOtherVoltages.vZeroPu.mag * Math.sin((vOtherVoltages.vZeroPu.angleDeg * Math.PI) / 180)
      ),
      complex(
        vFaultVoltages.vZeroPu.mag * Math.cos((vFaultVoltages.vZeroPu.angleDeg * Math.PI) / 180),
        vFaultVoltages.vZeroPu.mag * Math.sin((vFaultVoltages.vZeroPu.angleDeg * Math.PI) / 180)
      )
    );

    const iBr1 = cMul(dV1, y1);
    const iBr2 = cMul(dV2, y1);
    const iBr0 = cMul(dV0, y0);

    const iBrPhasePu = sequenceToPhase({ zero: iBr0, positive: iBr1, negative: iBr2 });
    const brTotalMagKa = Math.max(
      cMag(iBrPhasePu.a),
      cMag(iBrPhasePu.b),
      cMag(iBrPhasePu.c)
    ) * iBaseKa;

    const percent = totalFaultCurrentKa > 0 ? (brTotalMagKa / totalFaultCurrentKa) * 100 : 0;

    branchContributions.push({
      branchId: line.id,
      branchName: line.name,
      branchType: 'line',
      connectedFromBus: line.fromBusNumber,
      connectedToBus: line.toBusNumber,
      currentPu: { mag: brTotalMagKa / iBaseKa, angleDeg: cAngleDeg(iBr1) },
      currentKa: brTotalMagKa,
      currentA: brTotalMagKa * 1000,
      sequenceCurrentsPu: {
        zero: { mag: cMag(iBr0), angleDeg: cAngleDeg(iBr0) },
        positive: { mag: cMag(iBr1), angleDeg: cAngleDeg(iBr1) },
        negative: { mag: cMag(iBr2), angleDeg: cAngleDeg(iBr2) },
      },
      phaseCurrentsKa: {
        a: cMag(iBrPhasePu.a) * iBaseKa,
        b: cMag(iBrPhasePu.b) * iBaseKa,
        c: cMag(iBrPhasePu.c) * iBaseKa,
      },
      percentOfTotalFaultCurrent: Math.min(100, percent),
    });
  }

  // Transformers connected to faulted bus
  for (const tr of network.transformers) {
    if (tr.status !== 'online') continue;
    if (tr.fromBusNumber !== scenario.faultedBusNumber && tr.toBusNumber !== scenario.faultedBusNumber) {
      continue;
    }

    const otherBusNum = tr.fromBusNumber === scenario.faultedBusNumber ? tr.toBusNumber : tr.fromBusNumber;
    const otherIdx = busIdxMap.get(otherBusNum);
    if (otherIdx === undefined) continue;

    const vFaultVoltages = busVoltages[faultIdx];
    const vOtherVoltages = busVoltages[otherIdx];

    const r1 = tr.resistancePu;
    const x1 = tr.reactancePu;
    const y1 = cRecip(complex(r1, x1));

    const seqXfmr = sequenceDataset.transformers[tr.id];
    const r0 = seqXfmr ? seqXfmr.zeroResistancePu : r1;
    const x0 = seqXfmr ? seqXfmr.zeroReactancePu : x1;
    const y0 = cRecip(complex(r0, x0));

    const dV1 = cSub(
      complex(
        vOtherVoltages.vPositivePu.mag * Math.cos((vOtherVoltages.vPositivePu.angleDeg * Math.PI) / 180),
        vOtherVoltages.vPositivePu.mag * Math.sin((vOtherVoltages.vPositivePu.angleDeg * Math.PI) / 180)
      ),
      complex(
        vFaultVoltages.vPositivePu.mag * Math.cos((vFaultVoltages.vPositivePu.angleDeg * Math.PI) / 180),
        vFaultVoltages.vPositivePu.mag * Math.sin((vFaultVoltages.vPositivePu.angleDeg * Math.PI) / 180)
      )
    );

    const dV2 = cSub(
      complex(
        vOtherVoltages.vNegativePu.mag * Math.cos((vOtherVoltages.vNegativePu.angleDeg * Math.PI) / 180),
        vOtherVoltages.vNegativePu.mag * Math.sin((vOtherVoltages.vNegativePu.angleDeg * Math.PI) / 180)
      ),
      complex(
        vFaultVoltages.vNegativePu.mag * Math.cos((vFaultVoltages.vNegativePu.angleDeg * Math.PI) / 180),
        vFaultVoltages.vNegativePu.mag * Math.sin((vFaultVoltages.vNegativePu.angleDeg * Math.PI) / 180)
      )
    );

    const dV0 = cSub(
      complex(
        vOtherVoltages.vZeroPu.mag * Math.cos((vOtherVoltages.vZeroPu.angleDeg * Math.PI) / 180),
        vOtherVoltages.vZeroPu.mag * Math.sin((vOtherVoltages.vZeroPu.angleDeg * Math.PI) / 180)
      ),
      complex(
        vFaultVoltages.vZeroPu.mag * Math.cos((vFaultVoltages.vZeroPu.angleDeg * Math.PI) / 180),
        vFaultVoltages.vZeroPu.mag * Math.sin((vFaultVoltages.vZeroPu.angleDeg * Math.PI) / 180)
      )
    );

    const iBr1 = cMul(dV1, y1);
    const iBr2 = cMul(dV2, y1);
    const iBr0 = seqXfmr && seqXfmr.connection === 'delta-wye_grounded' && tr.toBusNumber === scenario.faultedBusNumber
      ? cMul(complex(
          -vFaultVoltages.vZeroPu.mag * Math.cos((vFaultVoltages.vZeroPu.angleDeg * Math.PI) / 180),
          -vFaultVoltages.vZeroPu.mag * Math.sin((vFaultVoltages.vZeroPu.angleDeg * Math.PI) / 180)
        ), y0)
      : cMul(dV0, y0);

    const iBrPhasePu = sequenceToPhase({ zero: iBr0, positive: iBr1, negative: iBr2 });
    const brTotalMagKa = Math.max(
      cMag(iBrPhasePu.a),
      cMag(iBrPhasePu.b),
      cMag(iBrPhasePu.c)
    ) * iBaseKa;

    const percent = totalFaultCurrentKa > 0 ? (brTotalMagKa / totalFaultCurrentKa) * 100 : 0;

    branchContributions.push({
      branchId: tr.id,
      branchName: tr.name,
      branchType: 'transformer',
      connectedFromBus: tr.fromBusNumber,
      connectedToBus: tr.toBusNumber,
      currentPu: { mag: brTotalMagKa / iBaseKa, angleDeg: cAngleDeg(iBr1) },
      currentKa: brTotalMagKa,
      currentA: brTotalMagKa * 1000,
      sequenceCurrentsPu: {
        zero: { mag: cMag(iBr0), angleDeg: cAngleDeg(iBr0) },
        positive: { mag: cMag(iBr1), angleDeg: cAngleDeg(iBr1) },
        negative: { mag: cMag(iBr2), angleDeg: cAngleDeg(iBr2) },
      },
      phaseCurrentsKa: {
        a: cMag(iBrPhasePu.a) * iBaseKa,
        b: cMag(iBrPhasePu.b) * iBaseKa,
        c: cMag(iBrPhasePu.c) * iBaseKa,
      },
      percentOfTotalFaultCurrent: Math.min(100, percent),
    });
  }

  // 11. Generator Fault Contributions
  const generatorContributions: GeneratorFaultContribution[] = [];

  for (const gen of network.generators) {
    if (gen.status !== 'online') continue;
    const gIdx = busIdxMap.get(gen.busNumber);
    if (gIdx === undefined) continue;

    const seqGen = sequenceDataset.generators[gen.id];
    const xdp = seqGen ? seqGen.subtransientReactanceXdpPu : 0.20 * (baseMva / gen.ratedMva);
    const x2 = seqGen ? seqGen.negativeSequenceReactanceX2Pu : xdp;
    const x0 = seqGen ? seqGen.zeroSequenceReactanceX0Pu : xdp * 0.5;

    const vGenBus = busVoltages[gIdx];

    // Internal generator EMF Eg1 behind subtransient reactance X"d
    let eg1 = Vf; // prefault operating EMF
    const v1Bus = complex(
      vGenBus.vPositivePu.mag * Math.cos((vGenBus.vPositivePu.angleDeg * Math.PI) / 180),
      vGenBus.vPositivePu.mag * Math.sin((vGenBus.vPositivePu.angleDeg * Math.PI) / 180)
    );
    const v2Bus = complex(
      vGenBus.vNegativePu.mag * Math.cos((vGenBus.vNegativePu.angleDeg * Math.PI) / 180),
      vGenBus.vNegativePu.mag * Math.sin((vGenBus.vNegativePu.angleDeg * Math.PI) / 180)
    );
    const v0Bus = complex(
      vGenBus.vZeroPu.mag * Math.cos((vGenBus.vZeroPu.angleDeg * Math.PI) / 180),
      vGenBus.vZeroPu.mag * Math.sin((vGenBus.vZeroPu.angleDeg * Math.PI) / 180)
    );

    const iGen1 = cDiv(cSub(eg1, v1Bus), complex(0, xdp));
    const iGen2 = cDiv(cSub(C_ZERO, v2Bus), complex(0, x2));
    const iGen0 = cDiv(cSub(C_ZERO, v0Bus), complex(0, x0));

    const iGenPhase = sequenceToPhase({ zero: iGen0, positive: iGen1, negative: iGen2 });
    const genBaseKv = busByNum.get(gen.busNumber)?.baseKv || vBaseKv;
    const genBaseKa = baseMva / (Math.sqrt(3) * genBaseKv);

    const genTotalMagKa = Math.max(
      cMag(iGenPhase.a),
      cMag(iGenPhase.b),
      cMag(iGenPhase.c)
    ) * genBaseKa;

    const percent = totalFaultCurrentKa > 0 ? (genTotalMagKa / totalFaultCurrentKa) * 100 : 0;

    // Record generator if at faulted bus or contributing significant current
    if (gen.busNumber === scenario.faultedBusNumber || genTotalMagKa > 0.05) {
      generatorContributions.push({
        generatorId: gen.id,
        generatorName: gen.name,
        busNumber: gen.busNumber,
        unitType: gen.unitType,
        currentPu: { mag: genTotalMagKa / genBaseKa, angleDeg: cAngleDeg(iGen1) },
        currentKa: genTotalMagKa,
        currentA: genTotalMagKa * 1000,
        sequenceCurrentsPu: {
          zero: { mag: cMag(iGen0), angleDeg: cAngleDeg(iGen0) },
          positive: { mag: cMag(iGen1), angleDeg: cAngleDeg(iGen1) },
          negative: { mag: cMag(iGen2), angleDeg: cAngleDeg(iGen2) },
        },
        phaseCurrentsKa: {
          a: cMag(iGenPhase.a) * genBaseKa,
          b: cMag(iGenPhase.b) * genBaseKa,
          c: cMag(iGenPhase.c) * genBaseKa,
        },
        percentOfTotalFaultCurrent: Math.min(100, percent),
      });
    }
  }

  // Calculate X/R ratio of the positive-sequence Thevenin impedance
  const xOverR = zkk1.re > 1e-6 ? Math.abs(zkk1.im / zkk1.re) : 999;

  return {
    scenario,
    converged: true,
    calculationTimestamp: timestamp,
    networkModelChecksum: `${network.buses.length}-${network.lines.length}-${network.generators.length}-${network.loadScaleFactor}`,
    theveninImpedance: {
      positive: cFull(zkk1),
      negative: cFull(zkk2),
      zero: cFull(zkk0),
    },
    xOverRRatio: Math.round(xOverR * 100) / 100,
    prefaultVoltage: cFull(Vf),
    prefaultVoltageKv: vfMag * (vBaseKv / Math.sqrt(3)),
    sequenceCurrentsPu: {
      zero: cFull(I0),
      positive: cFull(I1),
      negative: cFull(I2),
    },
    phaseCurrentsPu: {
      a: cFull(phaseCurrentsPu.a),
      b: cFull(phaseCurrentsPu.b),
      c: cFull(phaseCurrentsPu.c),
    },
    phaseCurrentsKa,
    phaseCurrentsA,
    totalFaultCurrentPu: Math.round(totalFaultCurrentPu * 10000) / 10000,
    totalFaultCurrentKa: Math.round(totalFaultCurrentKa * 1000) / 1000,
    totalFaultCurrentA: Math.round(totalFaultCurrentA * 10) / 10,
    totalFaultCurrentAngleDeg: Math.round(totalFaultCurrentAngleDeg * 10) / 10,
    shortCircuitMva: Math.round(shortCircuitMva * 10) / 10,
    groundCurrentPu: groundCurrentPu > 0.001 ? Math.round(groundCurrentPu * 10000) / 10000 : undefined,
    groundCurrentKa: groundCurrentKa > 0.001 ? Math.round(groundCurrentKa * 1000) / 1000 : undefined,
    groundCurrentA: groundCurrentA > 1.0 ? Math.round(groundCurrentA * 10) / 10 : undefined,
    branchContributions,
    generatorContributions,
    busVoltages,
    severeSagBusCount,
    methodologyNotes: {
      methodName: 'Bus Impedance Matrix (Z_bus) Symmetrical Components Method',
      standardReference: 'IEEE Std 551 (Violet Book) / IEEE Std 399 (Brown Book) / IEC 60909',
      sequenceNetworkSummary:
        'Full 30-bus positive, negative, and zero sequence admittance matrices Y(1), Y(2), Y(0) constructed with generator subtransient reactances, transformer Delta-Wye grounding, and Carson ground-return line parameters.',
      assumptions: [
        'Subtransient reactance X"d models initial subtransient symmetrical fault current (first few cycles).',
        'Step-down transformers (132 kV to 33 kV) configured as Delta on 132 kV side and Grounded-Wye on 33 kV side.',
        'Negative-sequence impedances equal positive-sequence subtransient impedances (Z2 = Z1).',
        'Line zero-sequence parameters derived via Carson earth return ratio: X0 = 3*X1, R0 = 3*R1, B0 = 0.5*B1.',
        scenario.prefaultVoltageMode === 'power-flow'
          ? 'Prefault operating voltages obtained from converged AC polar Newton-Raphson power flow solution.'
          : 'Prefault operating voltages assumed flat 1.0 p.u. at 0.0 degrees per standard test practice.',
      ],
      technicalLimitations: [
        'Steady-state subtransient symmetrical analysis only; DC offset decrement and breaker parting contact duty are not simulated.',
        'Does not include transient electromagnetic flux linkage dynamics or synchronous machine damper winding saturation.',
      ],
    },
  };
}

function createErrorSolution(
  scenario: ShortCircuitScenario,
  errorMessage: string,
  timestamp: number
): ShortCircuitSolution {
  return {
    scenario,
    converged: false,
    errorMessage,
    calculationTimestamp: timestamp,
    networkModelChecksum: '',
    theveninImpedance: {
      positive: { re: 0, im: 0, mag: 0, angleDeg: 0 },
      negative: { re: 0, im: 0, mag: 0, angleDeg: 0 },
      zero: { re: 0, im: 0, mag: 0, angleDeg: 0 },
    },
    xOverRRatio: 0,
    prefaultVoltage: { re: 1, im: 0, mag: 1, angleDeg: 0 },
    prefaultVoltageKv: 0,
    sequenceCurrentsPu: {
      zero: { re: 0, im: 0, mag: 0, angleDeg: 0 },
      positive: { re: 0, im: 0, mag: 0, angleDeg: 0 },
      negative: { re: 0, im: 0, mag: 0, angleDeg: 0 },
    },
    phaseCurrentsPu: {
      a: { re: 0, im: 0, mag: 0, angleDeg: 0 },
      b: { re: 0, im: 0, mag: 0, angleDeg: 0 },
      c: { re: 0, im: 0, mag: 0, angleDeg: 0 },
    },
    phaseCurrentsKa: { a: 0, b: 0, c: 0 },
    phaseCurrentsA: { a: 0, b: 0, c: 0 },
    totalFaultCurrentPu: 0,
    totalFaultCurrentKa: 0,
    totalFaultCurrentA: 0,
    totalFaultCurrentAngleDeg: 0,
    shortCircuitMva: 0,
    branchContributions: [],
    generatorContributions: [],
    busVoltages: [],
    severeSagBusCount: 0,
    methodologyNotes: {
      methodName: 'Bus Impedance Matrix (Z_bus) Symmetrical Components Method',
      standardReference: 'IEEE Std 551 / IEEE Std 399',
      sequenceNetworkSummary: 'Calculation aborted due to invalid network configuration.',
      assumptions: [],
      technicalLimitations: [],
    },
  };
}
