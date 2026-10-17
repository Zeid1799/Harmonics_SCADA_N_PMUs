import {
  NetworkBus,
  NetworkGenerator,
  NetworkLoad,
  NetworkShunt,
  NetworkTransformer,
  NetworkTransmissionLine,
  PowerNetworkModel,
  SelectedNetworkElement,
} from '../types/network';

/**
 * Deep clones a power network model so mutations never alter historical snapshots or baseline instances.
 */
export function cloneNetworkModel(model: PowerNetworkModel): PowerNetworkModel {
  return JSON.parse(JSON.stringify(model));
}

/**
 * Adds a new electrical bus to the network model with appropriate defaults.
 */
export function addBusToNetwork(
  network: PowerNetworkModel,
  busData?: Partial<NetworkBus>
): { updatedNetwork: PowerNetworkModel; newBus: NetworkBus } {
  const model = cloneNetworkModel(network);
  const existingNumbers = model.buses.map((b) => b.number);
  const nextNum = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  const busId = busData?.id?.trim() || `BUS-${nextNum}`;

  // Smart placement on schematic canvas
  let x = busData?.oneLineLayout?.x;
  let y = busData?.oneLineLayout?.y;
  if (x === undefined || y === undefined) {
    // Offset from highest bus or center of canvas
    const lastBus = model.buses[model.buses.length - 1];
    x = lastBus ? Math.min(1450, lastBus.oneLineLayout.x + 80) : 800;
    y = lastBus ? Math.min(950, lastBus.oneLineLayout.y + 40) : 500;
  }

  const baseKv = busData?.baseKv ?? 132;
  const newBus: NetworkBus = {
    id: busId,
    number: busData?.number ?? nextNum,
    name: busData?.name?.trim() || `Bus ${nextNum} (${baseKv} kV)`,
    substationName: busData?.substationName?.trim() || `Substation ${nextNum}`,
    areaNumber: busData?.areaNumber ?? 1,
    areaName: busData?.areaName || 'Area 1 (132 kV Transmission)',
    busType: busData?.busType ?? 'pq',
    busTypeLabel:
      busData?.busType === 'slack'
        ? 'Slack / Swing Reference'
        : busData?.busType === 'pv'
        ? 'PV (Voltage-Controlled)'
        : 'PQ (Load / Inactive)',
    baseKv,
    status: busData?.status ?? 'online',
    vMinPu: busData?.vMinPu ?? 0.95,
    vMaxPu: busData?.vMaxPu ?? 1.05,
    initialVmPu: busData?.initialVmPu ?? 1.0,
    initialVaDeg: busData?.initialVaDeg ?? 0.0,
    publishedReference: { vmPu: 1.0, vaDeg: 0.0 },
    connectedEquipment: {
      generators: [],
      loads: [],
      lines: [],
      transformers: [],
      shunts: [],
    },
    oneLineLayout: {
      x,
      y,
      orientation: busData?.oneLineLayout?.orientation ?? 'horizontal',
      length: busData?.oneLineLayout?.length ?? 70,
      labelPosition: busData?.oneLineLayout?.labelPosition ?? 'top',
    },
    geoLocation: {
      lat: busData?.geoLocation?.lat ?? 37.2,
      lon: busData?.geoLocation?.lon ?? -80.4,
      coordinateConfidence: 'schematic-subtransmission-cluster',
      historicalLocationNote: 'User-added schematic bus asset.',
    },
    isUserCreated: true,
  };

  model.buses.push(newBus);
  return { updatedNetwork: model, newBus };
}

/**
 * Adds a generator or synchronous condenser to a designated bus.
 */
export function addGeneratorToNetwork(
  network: PowerNetworkModel,
  genData: Partial<NetworkGenerator> & { busNumber: number }
): { updatedNetwork: PowerNetworkModel; newGen: NetworkGenerator } {
  const model = cloneNetworkModel(network);
  const bus = model.buses.find((b) => b.number === genData.busNumber);
  if (!bus) {
    throw new Error(`Cannot add generator: Bus #${genData.busNumber} not found.`);
  }

  const existingGenIds = new Set(model.generators.map((g) => g.id));
  let genIndex = model.generators.length + 1;
  let genId = genData.id?.trim() || `GEN-${genIndex}`;
  while (existingGenIds.has(genId)) {
    genIndex++;
    genId = `GEN-${genIndex}`;
  }

  const newGen: NetworkGenerator = {
    id: genId,
    name: genData.name?.trim() || `Gen @ Bus ${bus.number} (${bus.name})`,
    busId: bus.id,
    busNumber: bus.number,
    unitType: genData.unitType ?? 'Synchronous Generator',
    controlMode: genData.controlMode ?? 'Voltage-Controlled (PV)',
    status: genData.status ?? 'online',
    ratedMva: genData.ratedMva ?? 100,
    ratedKv: genData.ratedKv ?? bus.baseKv,
    scheduledActivePowerMw: genData.scheduledActivePowerMw ?? 25.0,
    activePowerMinMw: genData.activePowerMinMw ?? 0.0,
    activePowerMaxMw: genData.activePowerMaxMw ?? 60.0,
    voltageSetpointPu: genData.voltageSetpointPu ?? 1.02,
    reactivePowerMinMvar: genData.reactivePowerMinMvar ?? -20.0,
    reactivePowerMaxMvar: genData.reactivePowerMaxMvar ?? 40.0,
    publishedReferenceOutput: { pMw: 25.0, qMvar: 10.0 },
    isUserCreated: true,
  };

  model.generators.push(newGen);
  bus.connectedEquipment.generators.push(newGen.id);

  // If bus was PQ, automatically update to PV if not specified otherwise
  if (bus.busType === 'pq' && newGen.controlMode === 'Voltage-Controlled (PV)') {
    bus.busType = 'pv';
    bus.busTypeLabel = 'PV (Voltage-Controlled)';
  }

  return { updatedNetwork: model, newGen };
}

/**
 * Adds an active/reactive load to a designated bus.
 */
export function addLoadToNetwork(
  network: PowerNetworkModel,
  loadData: Partial<NetworkLoad> & { busNumber: number }
): { updatedNetwork: PowerNetworkModel; newLoad: NetworkLoad } {
  const model = cloneNetworkModel(network);
  const bus = model.buses.find((b) => b.number === loadData.busNumber);
  if (!bus) {
    throw new Error(`Cannot add load: Bus #${loadData.busNumber} not found.`);
  }

  const existingLoadIds = new Set(model.loads.map((l) => l.id));
  let loadIndex = model.loads.length + 1;
  let loadId = loadData.id?.trim() || `LOAD-${bus.number}-${loadIndex}`;
  while (existingLoadIds.has(loadId)) {
    loadIndex++;
    loadId = `LOAD-${bus.number}-${loadIndex}`;
  }

  const pMw = loadData.configuredActivePowerMw ?? 10.0;
  const qMvar = loadData.configuredReactivePowerMvar ?? 5.0;

  const newLoad: NetworkLoad = {
    id: loadId,
    name: loadData.name?.trim() || `Load @ Bus ${bus.number} (${bus.name})`,
    busId: bus.id,
    busNumber: bus.number,
    baseKv: bus.baseKv,
    status: loadData.status ?? 'connected',
    nominalActivePowerMw: pMw,
    nominalReactivePowerMvar: qMvar,
    configuredActivePowerMw: pMw,
    configuredReactivePowerMvar: qMvar,
    isUserCreated: true,
  };

  model.loads.push(newLoad);
  bus.connectedEquipment.loads.push(newLoad.id);
  return { updatedNetwork: model, newLoad };
}

/**
 * Adds an AC transmission line connecting two buses.
 */
export function addLineToNetwork(
  network: PowerNetworkModel,
  lineData: Partial<NetworkTransmissionLine> & {
    fromBusNumber: number;
    toBusNumber: number;
  }
): { updatedNetwork: PowerNetworkModel; newLine: NetworkTransmissionLine } {
  const model = cloneNetworkModel(network);
  const fBus = model.buses.find((b) => b.number === lineData.fromBusNumber);
  const tBus = model.buses.find((b) => b.number === lineData.toBusNumber);

  if (!fBus || !tBus) {
    throw new Error(
      `Cannot connect line: Bus #${!fBus ? lineData.fromBusNumber : lineData.toBusNumber} not found.`
    );
  }
  if (fBus.number === tBus.number) {
    throw new Error('Cannot connect line: Source and destination buses must be distinct.');
  }

  const baseLineId = `LINE-${fBus.number}-${tBus.number}`;
  const existingLineIds = new Set(model.lines.map((ln) => ln.id));
  let lineId = lineData.id?.trim() || baseLineId;
  let suffix = 2;
  while (existingLineIds.has(lineId)) {
    lineId = `${baseLineId}-${suffix++}`;
  }

  const newLine: NetworkTransmissionLine = {
    id: lineId,
    name:
      lineData.name?.trim() ||
      `${fBus.name} to ${tBus.name} (${Math.max(fBus.baseKv, tBus.baseKv)} kV Line)`,
    branchIndex: model.lines.length + model.transformers.length + 1,
    fromBusId: fBus.id,
    toBusId: tBus.id,
    fromBusNumber: fBus.number,
    toBusNumber: tBus.number,
    voltageKv: lineData.voltageKv ?? Math.max(fBus.baseKv, tBus.baseKv),
    status: lineData.status ?? 'online',
    resistancePu: lineData.resistancePu ?? 0.04,
    reactancePu: lineData.reactancePu ?? 0.15,
    chargingSusceptancePu: lineData.chargingSusceptancePu ?? 0.02,
    ratingMva: lineData.ratingMva ?? 65.0,
    ratingSourceNote: 'User-configured transmission branch.',
    isUserCreated: true,
  };

  model.lines.push(newLine);
  fBus.connectedEquipment.lines.push(newLine.id);
  tBus.connectedEquipment.lines.push(newLine.id);

  return { updatedNetwork: model, newLine };
}

/**
 * Adds a two-winding transformer connecting two buses.
 */
export function addTransformerToNetwork(
  network: PowerNetworkModel,
  txData: Partial<NetworkTransformer> & {
    fromBusNumber: number;
    toBusNumber: number;
  }
): { updatedNetwork: PowerNetworkModel; newTransformer: NetworkTransformer } {
  const model = cloneNetworkModel(network);
  const fBus = model.buses.find((b) => b.number === txData.fromBusNumber);
  const tBus = model.buses.find((b) => b.number === txData.toBusNumber);

  if (!fBus || !tBus) {
    throw new Error(
      `Cannot connect transformer: Bus #${!fBus ? txData.fromBusNumber : txData.toBusNumber} not found.`
    );
  }
  if (fBus.number === tBus.number) {
    throw new Error('Cannot connect transformer: Source and destination buses must be distinct.');
  }

  const baseTxId = `TX-${fBus.number}-${tBus.number}`;
  const existingTxIds = new Set(model.transformers.map((tr) => tr.id));
  let txId = txData.id?.trim() || baseTxId;
  let suffix = 2;
  while (existingTxIds.has(txId)) {
    txId = `${baseTxId}-${suffix++}`;
  }

  const newTx: NetworkTransformer = {
    id: txId,
    name:
      txData.name?.trim() ||
      `${fBus.name} to ${tBus.name} (${fBus.baseKv}/${tBus.baseKv} kV TX)`,
    branchIndex: model.lines.length + model.transformers.length + 1,
    fromBusId: fBus.id,
    toBusId: tBus.id,
    fromBusNumber: fBus.number,
    toBusNumber: tBus.number,
    fromVoltageKv: fBus.baseKv,
    toVoltageKv: tBus.baseKv,
    windingConfigLabel: `${fBus.baseKv} kV / ${tBus.baseKv} kV Step`,
    status: txData.status ?? 'online',
    resistancePu: txData.resistancePu ?? 0.0,
    reactancePu: txData.reactancePu ?? 0.1,
    tapRatioPu: txData.tapRatioPu ?? 1.0,
    nominalTapRatioPu: 1.0,
    phaseShiftDeg: txData.phaseShiftDeg ?? 0.0,
    ratingMva: txData.ratingMva ?? 65.0,
    ratingSourceNote: 'User-configured transformer branch.',
    isUserCreated: true,
  };

  model.transformers.push(newTx);
  fBus.connectedEquipment.transformers.push(newTx.id);
  tBus.connectedEquipment.transformers.push(newTx.id);

  return { updatedNetwork: model, newTransformer: newTx };
}

/**
 * Adds a switched shunt capacitor or reactor to a bus.
 */
export function addShuntToNetwork(
  network: PowerNetworkModel,
  shuntData: Partial<NetworkShunt> & { busNumber: number }
): { updatedNetwork: PowerNetworkModel; newShunt: NetworkShunt } {
  const model = cloneNetworkModel(network);
  const bus = model.buses.find((b) => b.number === shuntData.busNumber);
  if (!bus) {
    throw new Error(`Cannot add shunt: Bus #${shuntData.busNumber} not found.`);
  }

  const existingShuntIds = new Set(model.shunts.map((s) => s.id));
  let shuntId = shuntData.id?.trim() || `SHUNT-${bus.number}`;
  let suffix = 2;
  while (existingShuntIds.has(shuntId)) {
    shuntId = `SHUNT-${bus.number}-${suffix++}`;
  }

  const bMvar = shuntData.configuredSusceptanceMvarAtUnitV ?? 10.0;

  const newShunt: NetworkShunt = {
    id: shuntId,
    name:
      shuntData.name?.trim() ||
      `Shunt ${shuntData.shuntType ?? 'Capacitor Bank'} @ Bus ${bus.number}`,
    busId: bus.id,
    busNumber: bus.number,
    baseKv: bus.baseKv,
    shuntType: shuntData.shuntType ?? 'Capacitor Bank',
    status: shuntData.status ?? 'online',
    conductanceMwAtUnitV: shuntData.conductanceMwAtUnitV ?? 0.0,
    nominalSusceptanceMvarAtUnitV: bMvar,
    configuredSusceptanceMvarAtUnitV: bMvar,
    isUserCreated: true,
  };

  model.shunts.push(newShunt);
  bus.connectedEquipment.shunts.push(newShunt.id);
  return { updatedNetwork: model, newShunt };
}

/**
 * Safely deletes equipment from the network model, cleanly removing all orphaned connections
 * and cascading deletions for equipment connected exclusively to a removed bus.
 */
export function deleteEquipmentFromNetwork(
  network: PowerNetworkModel,
  target: SelectedNetworkElement
): {
  updatedNetwork: PowerNetworkModel;
  deletedElements: SelectedNetworkElement[];
} {
  const model = cloneNetworkModel(network);
  const deletedElements: SelectedNetworkElement[] = [{ ...target }];

  switch (target.category) {
    case 'bus': {
      const bus = model.buses.find((b) => b.id === target.id);
      if (!bus) return { updatedNetwork: network, deletedElements: [] };
      const busNum = bus.number;

      // 1. Cascade delete all connected transmission lines
      const linesToRemove = model.lines.filter(
        (ln) => ln.fromBusNumber === busNum || ln.toBusNumber === busNum
      );
      for (const ln of linesToRemove) {
        deletedElements.push({ category: 'line', id: ln.id });
      }
      model.lines = model.lines.filter(
        (ln) => ln.fromBusNumber !== busNum && ln.toBusNumber !== busNum
      );

      // 2. Cascade delete all connected transformers
      const txToRemove = model.transformers.filter(
        (tr) => tr.fromBusNumber === busNum || tr.toBusNumber === busNum
      );
      for (const tr of txToRemove) {
        deletedElements.push({ category: 'transformer', id: tr.id });
      }
      model.transformers = model.transformers.filter(
        (tr) => tr.fromBusNumber !== busNum && tr.toBusNumber !== busNum
      );

      // 3. Cascade delete all connected generators
      const gensToRemove = model.generators.filter((g) => g.busNumber === busNum);
      for (const g of gensToRemove) {
        deletedElements.push({ category: 'generator', id: g.id });
      }
      model.generators = model.generators.filter((g) => g.busNumber !== busNum);

      // 4. Cascade delete all connected loads
      const loadsToRemove = model.loads.filter((l) => l.busNumber === busNum);
      for (const l of loadsToRemove) {
        deletedElements.push({ category: 'load', id: l.id });
      }
      model.loads = model.loads.filter((l) => l.busNumber !== busNum);

      // 5. Cascade delete all connected shunts
      const shuntsToRemove = model.shunts.filter((s) => s.busNumber === busNum);
      for (const s of shuntsToRemove) {
        deletedElements.push({ category: 'shunt', id: s.id });
      }
      model.shunts = model.shunts.filter((s) => s.busNumber !== busNum);

      // 6. Remove the bus itself
      model.buses = model.buses.filter((b) => b.id !== target.id);

      // 7. Clean up connected references in remaining buses
      const removedIds = new Set(deletedElements.map((d) => d.id));
      for (const b of model.buses) {
        b.connectedEquipment.lines = b.connectedEquipment.lines.filter(
          (id) => !removedIds.has(id)
        );
        b.connectedEquipment.transformers = b.connectedEquipment.transformers.filter(
          (id) => !removedIds.has(id)
        );
        b.connectedEquipment.generators = b.connectedEquipment.generators.filter(
          (id) => !removedIds.has(id)
        );
        b.connectedEquipment.loads = b.connectedEquipment.loads.filter(
          (id) => !removedIds.has(id)
        );
        b.connectedEquipment.shunts = b.connectedEquipment.shunts.filter(
          (id) => !removedIds.has(id)
        );
      }

      break;
    }

    case 'generator': {
      model.generators = model.generators.filter((g) => g.id !== target.id);
      for (const b of model.buses) {
        b.connectedEquipment.generators = b.connectedEquipment.generators.filter(
          (id) => id !== target.id
        );
      }
      break;
    }

    case 'load': {
      model.loads = model.loads.filter((l) => l.id !== target.id);
      for (const b of model.buses) {
        b.connectedEquipment.loads = b.connectedEquipment.loads.filter(
          (id) => id !== target.id
        );
      }
      break;
    }

    case 'line': {
      model.lines = model.lines.filter((ln) => ln.id !== target.id);
      for (const b of model.buses) {
        b.connectedEquipment.lines = b.connectedEquipment.lines.filter(
          (id) => id !== target.id
        );
      }
      break;
    }

    case 'transformer': {
      model.transformers = model.transformers.filter((tr) => tr.id !== target.id);
      for (const b of model.buses) {
        b.connectedEquipment.transformers = b.connectedEquipment.transformers.filter(
          (id) => id !== target.id
        );
      }
      break;
    }

    case 'shunt': {
      model.shunts = model.shunts.filter((s) => s.id !== target.id);
      for (const b of model.buses) {
        b.connectedEquipment.shunts = b.connectedEquipment.shunts.filter(
          (id) => id !== target.id
        );
      }
      break;
    }
  }

  return { updatedNetwork: model, deletedElements };
}

/**
 * Updates full parameters of a bus.
 */
export function updateBusFull(
  network: PowerNetworkModel,
  busId: string,
  updates: Partial<NetworkBus>
): PowerNetworkModel {
  const model = cloneNetworkModel(network);
  model.buses = model.buses.map((b) => {
    if (b.id !== busId) return b;
    const busType = updates.busType ?? b.busType;
    const busTypeLabel =
      busType === 'slack'
        ? 'Slack / Swing Reference'
        : busType === 'pv'
        ? 'PV (Voltage-Controlled)'
        : 'PQ (Load / Inactive)';
    return {
      ...b,
      ...updates,
      busType,
      busTypeLabel,
      isUserModified: true,
    };
  });
  return model;
}

/**
 * Updates full parameters of a generator.
 */
export function updateGeneratorFull(
  network: PowerNetworkModel,
  genId: string,
  updates: Partial<NetworkGenerator>
): PowerNetworkModel {
  const model = cloneNetworkModel(network);
  model.generators = model.generators.map((g) =>
    g.id === genId ? { ...g, ...updates, isUserModified: true } : g
  );
  return model;
}

/**
 * Updates full parameters of a load.
 */
export function updateLoadFull(
  network: PowerNetworkModel,
  loadId: string,
  updates: Partial<NetworkLoad>
): PowerNetworkModel {
  const model = cloneNetworkModel(network);
  model.loads = model.loads.map((l) =>
    l.id === loadId ? { ...l, ...updates, isUserModified: true } : l
  );
  return model;
}

/**
 * Updates full parameters of a transmission line.
 */
export function updateLineFull(
  network: PowerNetworkModel,
  lineId: string,
  updates: Partial<NetworkTransmissionLine>
): PowerNetworkModel {
  const model = cloneNetworkModel(network);
  model.lines = model.lines.map((ln) =>
    ln.id === lineId ? { ...ln, ...updates, isUserModified: true } : ln
  );
  return model;
}

/**
 * Updates full parameters of a transformer.
 */
export function updateTransformerFull(
  network: PowerNetworkModel,
  txId: string,
  updates: Partial<NetworkTransformer>
): PowerNetworkModel {
  const model = cloneNetworkModel(network);
  model.transformers = model.transformers.map((tr) =>
    tr.id === txId ? { ...tr, ...updates, isUserModified: true } : tr
  );
  return model;
}

/**
 * Updates full parameters of a shunt element.
 */
export function updateShuntFull(
  network: PowerNetworkModel,
  shuntId: string,
  updates: Partial<NetworkShunt>
): PowerNetworkModel {
  const model = cloneNetworkModel(network);
  model.shunts = model.shunts.map((s) =>
    s.id === shuntId ? { ...s, ...updates, isUserModified: true } : s
  );
  return model;
}
