import {
  NetworkValidationIssue,
  NetworkValidationReport,
  PowerNetworkModel,
} from '../types/network';

/**
 * Validates a PowerNetworkModel for technical correctness, referential integrity,
 * and electrical solvability prior to AC power-flow calculation.
 */
export function validateNetworkModel(network: PowerNetworkModel): NetworkValidationReport {
  const issues: NetworkValidationIssue[] = [];
  let nextIssueId = 1;

  const addIssue = (
    severity: 'error' | 'warning' | 'info',
    title: string,
    message: string,
    elementCategory?: NetworkValidationIssue['elementCategory'],
    elementId?: string,
    fixSuggestion?: string
  ) => {
    issues.push({
      id: `VAL-${nextIssueId++}`,
      severity,
      title,
      message,
      elementCategory,
      elementId,
      fixSuggestion,
    });
  };

  // 1. Bus Identifiers & Numbering Uniqueness
  const busByNum = new Map<number, (typeof network.buses)[0]>();
  const busById = new Map<string, (typeof network.buses)[0]>();

  for (const bus of network.buses) {
    if (!bus.id || bus.id.trim() === '') {
      addIssue(
        'error',
        'Missing Bus Identifier',
        `Bus #${bus.number} is missing an alphanumeric identifier.`,
        'bus',
        bus.id,
        'Assign a unique ID such as BUS-' + bus.number
      );
    } else if (busById.has(bus.id)) {
      addIssue(
        'error',
        'Duplicate Bus Identifier',
        `Multiple buses share the identifier "${bus.id}". Each bus ID must be unique.`,
        'bus',
        bus.id,
        'Rename one of the buses to a distinct ID.'
      );
    } else {
      busById.set(bus.id, bus);
    }

    if (busByNum.has(bus.number)) {
      addIssue(
        'error',
        'Duplicate Bus Number',
        `Multiple buses share bus number #${bus.number}. Bus numbers must be unique integers.`,
        'bus',
        bus.id,
        'Change the bus number to an unused integer.'
      );
    } else {
      busByNum.set(bus.number, bus);
    }

    if (bus.baseKv <= 0 || Number.isNaN(bus.baseKv)) {
      addIssue(
        'error',
        'Invalid Voltage Base',
        `Bus ${bus.id} has non-positive base voltage (${bus.baseKv} kV).`,
        'bus',
        bus.id,
        'Set nominal base voltage to a standard level (e.g. 132 kV or 33 kV).'
      );
    }

    if (bus.vMinPu >= bus.vMaxPu) {
      addIssue(
        'error',
        'Invalid Voltage Limits',
        `Bus ${bus.id} has Vmin (${bus.vMinPu} p.u.) >= Vmax (${bus.vMaxPu} p.u.).`,
        'bus',
        bus.id,
        'Ensure Vmin < Vmax (e.g. Vmin = 0.95 p.u., Vmax = 1.05 p.u.).'
      );
    }
  }

  // 2. Slack / Reference Bus Check
  const onlineSlackBuses = network.buses.filter(
    (b) => b.status === 'online' && b.busType === 'slack'
  );

  if (onlineSlackBuses.length === 0) {
    addIssue(
      'error',
      'Missing Slack / Reference Bus',
      'The network has no in-service Slack bus. Polar Newton-Raphson AC power flow requires exactly one Slack bus to establish the reference angle (0°) and balance net active power.',
      'bus',
      undefined,
      'Designate an in-service generator bus (e.g. Bus 1: Glen Lyn 132) as Slack type.'
    );
  } else if (onlineSlackBuses.length > 1) {
    addIssue(
      'error',
      'Multiple Slack Buses Configured',
      `Found ${onlineSlackBuses.length} online Slack buses (${onlineSlackBuses.map((b) => b.id).join(', ')}). Multiple reference buses create an over-determined phase angle system.`,
      'bus',
      onlineSlackBuses[1].id,
      'Change all extra Slack buses to PV (voltage-controlled) or PQ buses.'
    );
  } else {
    // Check if Slack bus has an online generator
    const slackNum = onlineSlackBuses[0].number;
    const slackGens = network.generators.filter(
      (g) => g.status === 'online' && g.busNumber === slackNum
    );
    if (slackGens.length === 0) {
      addIssue(
        'error',
        'No Generator on Slack Bus',
        `Slack Bus ${onlineSlackBuses[0].id} (#${slackNum}) has no in-service generator to absorb or inject system swing power.`,
        'bus',
        onlineSlackBuses[0].id,
        'Place a generator on this bus or change an existing generator bus to Slack.'
      );
    }
  }

  // 3. Transmission Lines Validation
  const lineIds = new Set<string>();
  for (const line of network.lines) {
    if (lineIds.has(line.id)) {
      addIssue('error', 'Duplicate Line ID', `Line ID "${line.id}" is used more than once.`, 'line', line.id);
    }
    lineIds.add(line.id);

    const fBus = busByNum.get(line.fromBusNumber);
    const tBus = busByNum.get(line.toBusNumber);

    if (!fBus) {
      addIssue(
        'error',
        'Missing From-Bus Reference',
        `Line ${line.id} references non-existent from-bus #${line.fromBusNumber}.`,
        'line',
        line.id,
        'Reconnect line to an existing bus.'
      );
    }
    if (!tBus) {
      addIssue(
        'error',
        'Missing To-Bus Reference',
        `Line ${line.id} references non-existent to-bus #${line.toBusNumber}.`,
        'line',
        line.id,
        'Reconnect line to an existing bus.'
      );
    }

    if (fBus && tBus && line.fromBusNumber === line.toBusNumber) {
      addIssue(
        'error',
        'Invalid Self-Loop Connection',
        `Line ${line.id} connects Bus #${line.fromBusNumber} to itself. Self-connections are physically invalid.`,
        'line',
        line.id,
        'Set distinct from and to buses.'
      );
    }

    if (line.reactancePu <= 0 || Number.isNaN(line.reactancePu)) {
      addIssue(
        'error',
        'Non-Positive Reactance',
        `Line ${line.id} has series reactance X = ${line.reactancePu} p.u. Transmission lines must have positive inductive reactance (X > 0).`,
        'line',
        line.id,
        'Set series reactance X > 0 (e.g. 0.05 to 0.30 p.u.).'
      );
    }

    if (line.resistancePu < 0) {
      addIssue(
        'warning',
        'Negative Resistance',
        `Line ${line.id} has negative resistance R = ${line.resistancePu} p.u., which generates active power.`,
        'line',
        line.id,
        'Set series resistance R >= 0.'
      );
    }

    if (line.ratingMva <= 0) {
      addIssue(
        'warning',
        'Missing Thermal Rating',
        `Line ${line.id} has rating = ${line.ratingMva} MVA. Overload detection requires a positive rating.`,
        'line',
        line.id,
        'Set Rate A MVA to a positive value (e.g. 65 MVA).'
      );
    }
  }

  // 4. Transformers Validation
  const txIds = new Set<string>();
  for (const tr of network.transformers) {
    if (txIds.has(tr.id)) {
      addIssue('error', 'Duplicate Transformer ID', `Transformer ID "${tr.id}" is used more than once.`, 'transformer', tr.id);
    }
    txIds.add(tr.id);

    const fBus = busByNum.get(tr.fromBusNumber);
    const tBus = busByNum.get(tr.toBusNumber);

    if (!fBus) {
      addIssue(
        'error',
        'Missing Transformer From-Bus',
        `Transformer ${tr.id} references non-existent from-bus #${tr.fromBusNumber}.`,
        'transformer',
        tr.id,
        'Reconnect transformer to an existing bus.'
      );
    }
    if (!tBus) {
      addIssue(
        'error',
        'Missing Transformer To-Bus',
        `Transformer ${tr.id} references non-existent to-bus #${tr.toBusNumber}.`,
        'transformer',
        tr.id,
        'Reconnect transformer to an existing bus.'
      );
    }

    if (fBus && tBus && tr.fromBusNumber === tr.toBusNumber) {
      addIssue(
        'error',
        'Transformer Self-Loop',
        `Transformer ${tr.id} connects Bus #${tr.fromBusNumber} to itself.`,
        'transformer',
        tr.id,
        'Set distinct from and to buses.'
      );
    }

    if (tr.reactancePu <= 0 || Number.isNaN(tr.reactancePu)) {
      addIssue(
        'error',
        'Non-Positive Transformer Reactance',
        `Transformer ${tr.id} has leakage reactance X = ${tr.reactancePu} p.u. (must be > 0).`,
        'transformer',
        tr.id,
        'Set leakage reactance X > 0 (e.g. 0.05 to 0.15 p.u.).'
      );
    }

    if (tr.tapRatioPu <= 0 || Number.isNaN(tr.tapRatioPu)) {
      addIssue(
        'error',
        'Invalid Turns Ratio',
        `Transformer ${tr.id} has non-positive tap ratio (${tr.tapRatioPu} p.u.).`,
        'transformer',
        tr.id,
        'Set tap ratio to nominal 1.0 or between 0.85 and 1.15.'
      );
    } else if (tr.tapRatioPu < 0.75 || tr.tapRatioPu > 1.25) {
      addIssue(
        'warning',
        'Extreme Turns Ratio',
        `Transformer ${tr.id} tap ratio (${tr.tapRatioPu} p.u.) is outside typical tap limits [0.75, 1.25].`,
        'transformer',
        tr.id,
        'Verify if this off-nominal ratio is intentional.'
      );
    }
  }

  // 5. Generators Validation
  const genIds = new Set<string>();
  let totalOnlineGenPMax = 0;
  for (const gen of network.generators) {
    if (genIds.has(gen.id)) {
      addIssue('error', 'Duplicate Generator ID', `Generator ID "${gen.id}" is used more than once.`, 'generator', gen.id);
    }
    genIds.add(gen.id);

    const bus = busByNum.get(gen.busNumber);
    if (!bus) {
      addIssue(
        'error',
        'Orphaned Generator',
        `Generator ${gen.id} is connected to non-existent bus #${gen.busNumber}.`,
        'generator',
        gen.id,
        'Attach generator to an existing bus.'
      );
    }

    if (gen.status === 'online') {
      totalOnlineGenPMax += gen.activePowerMaxMw;
    }

    if (gen.voltageSetpointPu <= 0 || Number.isNaN(gen.voltageSetpointPu)) {
      addIssue(
        'error',
        'Invalid Voltage Setpoint',
        `Generator ${gen.id} has voltage setpoint = ${gen.voltageSetpointPu} p.u. (must be > 0).`,
        'generator',
        gen.id,
        'Set voltage setpoint between 0.90 and 1.10 p.u.'
      );
    }

    if (gen.activePowerMinMw > gen.activePowerMaxMw) {
      addIssue(
        'error',
        'Inconsistent P Limits',
        `Generator ${gen.id} has Pmin (${gen.activePowerMinMw} MW) > Pmax (${gen.activePowerMaxMw} MW).`,
        'generator',
        gen.id,
        'Ensure Pmin <= Pmax.'
      );
    }

    if (gen.reactivePowerMinMvar > gen.reactivePowerMaxMvar) {
      addIssue(
        'error',
        'Inconsistent Q Limits',
        `Generator ${gen.id} has Qmin (${gen.reactivePowerMinMvar} MVAr) > Qmax (${gen.reactivePowerMaxMvar} MVAr).`,
        'generator',
        gen.id,
        'Ensure Qmin <= Qmax.'
      );
    }
  }

  // 6. Loads Validation
  const loadIds = new Set<string>();
  let totalConnectedLoadMw = 0;
  for (const load of network.loads) {
    if (loadIds.has(load.id)) {
      addIssue('error', 'Duplicate Load ID', `Load ID "${load.id}" is used more than once.`, 'load', load.id);
    }
    loadIds.add(load.id);

    const bus = busByNum.get(load.busNumber);
    if (!bus) {
      addIssue(
        'error',
        'Orphaned Load',
        `Load ${load.id} is connected to non-existent bus #${load.busNumber}.`,
        'load',
        load.id,
        'Attach load to an existing bus.'
      );
    }

    if (load.status === 'connected') {
      totalConnectedLoadMw += load.configuredActivePowerMw * network.loadScaleFactor;
    }

    if (load.configuredActivePowerMw < 0) {
      addIssue(
        'info',
        'Negative Active Load',
        `Load ${load.id} demand is negative (${load.configuredActivePowerMw} MW). This acts as net generation.`,
        'load',
        load.id
      );
    }
  }

  // 7. Shunt Equipment Validation
  const shuntIds = new Set<string>();
  for (const sh of network.shunts) {
    if (shuntIds.has(sh.id)) {
      addIssue('error', 'Duplicate Shunt ID', `Shunt ID "${sh.id}" is used more than once.`, 'shunt', sh.id);
    }
    shuntIds.add(sh.id);

    const bus = busByNum.get(sh.busNumber);
    if (!bus) {
      addIssue(
        'error',
        'Orphaned Shunt',
        `Shunt ${sh.id} is connected to non-existent bus #${sh.busNumber}.`,
        'shunt',
        sh.id,
        'Attach shunt to an existing bus.'
      );
    }
  }

  // 8. System Generation vs Load Adequacy Check
  if (totalOnlineGenPMax > 0 && totalOnlineGenPMax < totalConnectedLoadMw) {
    addIssue(
      'warning',
      'Generation Deficit Warning',
      `Total available online generation capacity (${totalOnlineGenPMax.toFixed(1)} MW) is less than total connected active load (${totalConnectedLoadMw.toFixed(1)} MW). AC power flow may fail to converge.`,
      undefined,
      undefined,
      'Increase generator capacity, bring offline generators in service, or reduce load.'
    );
  }

  // 9. Isolated Bus Check
  const connectedBranchesByBus = new Map<number, number>();
  for (const b of network.buses) {
    connectedBranchesByBus.set(b.number, 0);
  }
  for (const ln of network.lines) {
    if (ln.status === 'online') {
      connectedBranchesByBus.set(ln.fromBusNumber, (connectedBranchesByBus.get(ln.fromBusNumber) ?? 0) + 1);
      connectedBranchesByBus.set(ln.toBusNumber, (connectedBranchesByBus.get(ln.toBusNumber) ?? 0) + 1);
    }
  }
  for (const tr of network.transformers) {
    if (tr.status === 'online') {
      connectedBranchesByBus.set(tr.fromBusNumber, (connectedBranchesByBus.get(tr.fromBusNumber) ?? 0) + 1);
      connectedBranchesByBus.set(tr.toBusNumber, (connectedBranchesByBus.get(tr.toBusNumber) ?? 0) + 1);
    }
  }

  for (const b of network.buses) {
    if (b.status === 'online' && (connectedBranchesByBus.get(b.number) ?? 0) === 0) {
      addIssue(
        'warning',
        'Isolated Bus Detected',
        `Bus ${b.id} (#${b.number}: ${b.name}) has no in-service lines or transformers connected.`,
        'bus',
        b.id,
        'Connect a transmission line or transformer to this bus, or take it offline.'
      );
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  return {
    isValid: errorCount === 0,
    errorCount,
    warningCount,
    infoCount,
    issues,
    timestamp: Date.now(),
  };
}
