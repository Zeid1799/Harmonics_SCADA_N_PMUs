import React from 'react';
import {
  Zap,
  Power,
  RotateCcw,
  AlertTriangle,
  MapPin,
  Sliders,
  Info,
} from 'lucide-react';
import {
  PowerNetworkModel,
  PowerFlowSolutionResult,
  SelectedNetworkElement,
  NetworkBus,
  NetworkGenerator,
  NetworkLoad,
  NetworkTransmissionLine,
  NetworkTransformer,
  NetworkShunt,
} from '../../types/network';
import { findNetworkEquipment } from '../../model/networkModel';

interface EquipmentDetailPanelProps {
  network: PowerNetworkModel;
  solution: PowerFlowSolutionResult | null;
  isStale: boolean;
  selectedElement: SelectedNetworkElement | null;
  onSelectElement: (element: SelectedNetworkElement) => void;
  onToggleEquipmentStatus: (element: SelectedNetworkElement) => void;
  onUpdateGenerator: (
    generatorId: string,
    patch: {
      scheduledActivePowerMw?: number;
      voltageSetpointPu?: number;
      reactivePowerMinMvar?: number;
      reactivePowerMaxMvar?: number;
    }
  ) => void;
  onUpdateLoad: (
    loadId: string,
    patch: {
      configuredActivePowerMw?: number;
      configuredReactivePowerMvar?: number;
    }
  ) => void;
  onUpdateTransformer: (
    transformerId: string,
    patch: {
      tapRatioPu?: number;
      phaseShiftDeg?: number;
    }
  ) => void;
  onUpdateShunt: (
    shuntId: string,
    patch: {
      configuredSusceptanceMvarAtUnitV?: number;
    }
  ) => void;
  onResetSingleEquipment: (element: SelectedNetworkElement) => void;
  onSolvePowerFlow: () => void;
}

export const EquipmentDetailPanel: React.FC<EquipmentDetailPanelProps> = ({
  network,
  solution,
  isStale,
  selectedElement,
  onSelectElement,
  onToggleEquipmentStatus,
  onUpdateGenerator,
  onUpdateLoad,
  onUpdateTransformer,
  onUpdateShunt,
  onResetSingleEquipment,
  onSolvePowerFlow,
}) => {
  const found = findNetworkEquipment(network, selectedElement);

  const renderStaleBanner = () => {
    if (!isStale) return null;
    return (
      <div className="mb-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/40 flex items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-300">
        <div className="flex items-center gap-1.5 font-medium">
          <AlertTriangle size={14} className="shrink-0 text-amber-500" />
          <span>Solved values are stale after recent parameter edits.</span>
        </div>
        <button
          type="button"
          onClick={onSolvePowerFlow}
          className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] shrink-0 cursor-pointer"
        >
          Re-Solve Now
        </button>
      </div>
    );
  };

  if (!found || !selectedElement) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm mb-2">
            <Info size={16} className="text-blue-500" />
            <span>Asset Inspector & Operating Controls</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Click any bus, generator, synchronous condenser, load, transmission line, transformer,
            or shunt capacitor bank in the One-Line or Geographic View to inspect its IEEE 30-Bus
            parameters, solved AC power-flow telemetry, and operating controls.
          </p>

          {/* Quick Asset Directory */}
          <div className="mt-4 space-y-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Generators & Synchronous Condensers (6)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {network.generators.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => onSelectElement({ category: 'generator', id: g.id })}
                    className="px-2 py-1 rounded-md text-[11px] font-mono font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 cursor-pointer"
                  >
                    {g.id} (B{g.busNumber})
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Transformers with Tap Changers (7)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {network.transformers.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => onSelectElement({ category: 'transformer', id: tx.id })}
                    className="px-2 py-1 rounded-md text-[11px] font-mono font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 cursor-pointer"
                  >
                    {tx.id} ({tx.fromBusNumber}→{tx.toBusNumber})
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                Key Substations (Buses 1–12, 27–30)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {network.buses.slice(0, 12).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onSelectElement({ category: 'bus', id: b.id })}
                    className="px-2 py-1 rounded-md text-[11px] font-mono font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    B{b.number} {b.substationName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 1. BUS INSPECTOR
  // ============================================================================
  if (found.category === 'bus') {
    const bus = found.item as NetworkBus;
    const busSol = solution?.busSolutions[bus.number];
    const isOnline = bus.status === 'online';

    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                BUS #{bus.number}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {bus.baseKv} kV • Area {bus.areaNumber}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {bus.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{bus.busTypeLabel}</p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onResetSingleEquipment({ category: 'bus', id: bus.id })}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Reset bus to default status"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={() => onToggleEquipmentStatus({ category: 'bus', id: bus.id })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                isOnline
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/40 hover:bg-red-500/25'
              }`}
            >
              <Power size={13} />
              {isOnline ? 'In Service' : 'Isolated / Offline'}
            </button>
          </div>
        </div>

        {renderStaleBanner()}

        {/* Section A: Solved AC Power-Flow Quantities */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Zap size={13} />
              Solved AC Power-Flow State
            </span>
            {busSol && (
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  !busSol.energized
                    ? 'bg-red-500/15 text-red-500'
                    : busSol.voltageViolation !== 'none'
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-emerald-500/15 text-emerald-500'
                }`}
              >
                {!busSol.energized
                  ? 'DE-ENERGIZED'
                  : busSol.voltageViolation === 'low'
                  ? 'LOW VOLTAGE (< Vmin)'
                  : busSol.voltageViolation === 'high'
                  ? 'HIGH VOLTAGE (> Vmax)'
                  : 'NORMAL VOLTAGE'}
              </span>
            )}
          </div>

          {busSol ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Voltage Magnitude |V|</div>
                <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                  {busSol.vmPu.toFixed(4)} p.u.
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  {busSol.vmKv.toFixed(2)} kV (Ref: {bus.publishedReference.vmPu.toFixed(3)} p.u.)
                </div>
              </div>

              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Voltage Phase Angle δ</div>
                <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                  {busSol.vaDeg >= 0 ? '+' : ''}
                  {busSol.vaDeg.toFixed(2)}°
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Ref: {bus.publishedReference.vaDeg.toFixed(2)}°
                </div>
              </div>

              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Net Bus Injection (P / Q)</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-100">
                  P: {busSol.pNetInjectionMw >= 0 ? '+' : ''}
                  {busSol.pNetInjectionMw.toFixed(2)} MW
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Q: {busSol.qNetInjectionMvar >= 0 ? '+' : ''}
                  {busSol.qNetInjectionMvar.toFixed(2)} MVAr
                </div>
              </div>

              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Effective Solver Bus Type</div>
                <div className="font-mono font-bold uppercase text-slate-800 dark:text-slate-100">
                  {busSol.effectiveBusType.toUpperCase()}
                  {busSol.convertedFromPvToPq && (
                    <span className="ml-1 text-amber-500 text-[10px]">
                      (Clamped {busSol.qLimitViolationType.toUpperCase()})
                    </span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Island #{busSol.islandId} • ΔP={busSol.pMismatchMw.toExponential(1)} MW
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">No solution available.</div>
          )}
        </div>

        {/* Section B: Source Model Parameters & Geographic Provenance */}
        <div className="space-y-2 text-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Documented Benchmark Parameters (ieee30cdf.txt)
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800/50 flex justify-between">
              <span className="text-slate-500">Normal V Limits:</span>
              <span className="font-mono font-semibold">
                {bus.vMinPu.toFixed(2)} – {bus.vMaxPu.toFixed(2)} p.u.
              </span>
            </div>
            <div className="px-2.5 py-1.5 rounded bg-slate-50 dark:bg-slate-800/50 flex justify-between">
              <span className="text-slate-500">Substation:</span>
              <span className="font-semibold">{bus.substationName}</span>
            </div>
          </div>

          <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200 mb-0.5">
              <MapPin size={12} className="text-blue-500" />
              <span>
                Geographic Provenance (
                {bus.geoLocation.coordinateConfidence === 'verified-historical-substation'
                  ? 'Verified 1961 AEP Virginia Substation'
                  : 'Schematic 33 kV Feeder Location'}
                )
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {bus.geoLocation.historicalLocationNote} ({bus.geoLocation.lat.toFixed(3)}°N,{' '}
              {bus.geoLocation.lon.toFixed(3)}°W)
            </p>
          </div>
        </div>

        {/* Section C: Connected Equipment Navigation */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Connected Substation & Branch Assets
          </div>
          <div className="flex flex-wrap gap-1.5">
            {bus.connectedEquipment.generators.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectElement({ category: 'generator', id })}
                className="px-2 py-1 rounded text-[11px] font-mono font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 cursor-pointer"
              >
                ⚡ {id}
              </button>
            ))}
            {bus.connectedEquipment.loads.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectElement({ category: 'load', id })}
                className="px-2 py-1 rounded text-[11px] font-mono font-semibold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 cursor-pointer"
              >
                ⬇ {id}
              </button>
            ))}
            {bus.connectedEquipment.shunts.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectElement({ category: 'shunt', id })}
                className="px-2 py-1 rounded text-[11px] font-mono font-semibold bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 cursor-pointer"
              >
                ⫴ {id}
              </button>
            ))}
            {bus.connectedEquipment.transformers.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectElement({ category: 'transformer', id })}
                className="px-2 py-1 rounded text-[11px] font-mono font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer"
              >
                ◎ {id}
              </button>
            ))}
            {bus.connectedEquipment.lines.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onSelectElement({ category: 'line', id })}
                className="px-2 py-1 rounded text-[11px] font-mono font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-500/25 cursor-pointer"
              >
                ━ {id}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. GENERATOR / SYNCHRONOUS CONDENSER INSPECTOR & CONTROLS
  // ============================================================================
  if (found.category === 'generator') {
    const gen = found.item as NetworkGenerator;
    const genSol = solution?.generatorOutputs[gen.id];
    const busSol = solution?.busSolutions[gen.busNumber];
    const isOnline = gen.status === 'online';

    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                {gen.id}
              </span>
              <button
                type="button"
                onClick={() => onSelectElement({ category: 'bus', id: gen.busId })}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Bus #{gen.busNumber} ({gen.ratedKv} kV)
              </button>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {gen.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {gen.unitType} • {gen.controlMode}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onResetSingleEquipment({ category: 'generator', id: gen.id })}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Reset generator setpoints to IEEE 30-Bus defaults"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={() => onToggleEquipmentStatus({ category: 'generator', id: gen.id })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                isOnline
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/40 hover:bg-red-500/25'
              }`}
            >
              <Power size={13} />
              {isOnline ? 'Online' : 'Offline'}
            </button>
          </div>
        </div>

        {renderStaleBanner()}

        {/* Solved Generator Output */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <Zap size={13} />
              Solved AC Dispatch Output
            </span>
            {genSol && genSol.clampedAtQLimit !== 'none' && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-500">
                CLAMPED AT {genSol.clampedAtQLimit.toUpperCase()}
              </span>
            )}
          </div>

          {genSol ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Active Power Output (P_G)</div>
                <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  {genSol.pMw.toFixed(2)} MW
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Ref: {gen.publishedReferenceOutput.pMw.toFixed(2)} MW
                </div>
              </div>

              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Reactive Power Output (Q_G)</div>
                <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                  {genSol.qMvar >= 0 ? '+' : ''}
                  {genSol.qMvar.toFixed(2)} MVAr
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Ref: {gen.publishedReferenceOutput.qMvar.toFixed(2)} MVAr
                </div>
              </div>

              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Apparent Power & Loading</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-100">
                  {genSol.sMva.toFixed(2)} MVA ({genSol.loadingPercent.toFixed(1)}%)
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Rated: {gen.ratedMva} MVA
                </div>
              </div>

              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Terminal Bus Voltage</div>
                <div className="font-mono font-bold text-slate-800 dark:text-slate-100">
                  {busSol ? `${busSol.vmPu.toFixed(4)} p.u.` : 'N/A'}
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Setpoint: {gen.voltageSetpointPu.toFixed(3)} p.u.
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">No solution available.</div>
          )}
        </div>

        {/* User Operating Setpoint Controls */}
        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <Sliders size={13} />
            Operating Setpoint Controls
          </div>

          {/* Scheduled Active Power P_G */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="gen-pg-input" className="font-semibold text-slate-700 dark:text-slate-200">
                Scheduled Active Power P_G (MW)
                {gen.busNumber === 1 && (
                  <span className="ml-1 text-[10px] text-amber-500 font-normal">
                    (Slack Bus balances system P)
                  </span>
                )}
              </label>
              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {gen.scheduledActivePowerMw.toFixed(1)} MW (Max {gen.activePowerMaxMw} MW)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="gen-pg-input"
                type="range"
                min={gen.activePowerMinMw}
                max={Math.max(gen.activePowerMaxMw, 60)}
                step={1}
                value={gen.scheduledActivePowerMw}
                onChange={(e) =>
                  onUpdateGenerator(gen.id, {
                    scheduledActivePowerMw: Number(e.target.value),
                  })
                }
                className="flex-1 accent-emerald-600 cursor-pointer"
              />
              <input
                type="number"
                step={1}
                min={0}
                max={500}
                value={gen.scheduledActivePowerMw}
                onChange={(e) =>
                  onUpdateGenerator(gen.id, {
                    scheduledActivePowerMw: Number(e.target.value),
                  })
                }
                className="w-20 px-2 py-1 rounded text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-right"
              />
            </div>
          </div>

          {/* Voltage Setpoint V_set */}
          <div>
            <div className="flex justify-between text-xs mb-1">
              <label htmlFor="gen-vset-input" className="font-semibold text-slate-700 dark:text-slate-200">
                Voltage Setpoint V_set (p.u.)
              </label>
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                {gen.voltageSetpointPu.toFixed(3)} p.u.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="gen-vset-input"
                type="range"
                min={0.92}
                max={1.1}
                step={0.002}
                value={gen.voltageSetpointPu}
                onChange={(e) =>
                  onUpdateGenerator(gen.id, {
                    voltageSetpointPu: Number(e.target.value),
                  })
                }
                className="flex-1 accent-blue-600 cursor-pointer"
              />
              <input
                type="number"
                step={0.005}
                min={0.85}
                max={1.15}
                value={gen.voltageSetpointPu}
                onChange={(e) =>
                  onUpdateGenerator(gen.id, {
                    voltageSetpointPu: Number(e.target.value),
                  })
                }
                className="w-20 px-2 py-1 rounded text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-right"
              />
            </div>
          </div>

          {/* Reactive Power Limits Qmin / Qmax */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Q_min Limit (MVAr)
              </label>
              <input
                type="number"
                step={5}
                value={gen.reactivePowerMinMvar}
                onChange={(e) =>
                  onUpdateGenerator(gen.id, {
                    reactivePowerMinMvar: Number(e.target.value),
                  })
                }
                className="w-full px-2 py-1 rounded text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Q_max Limit (MVAr)
              </label>
              <input
                type="number"
                step={5}
                value={gen.reactivePowerMaxMvar}
                onChange={(e) =>
                  onUpdateGenerator(gen.id, {
                    reactivePowerMaxMvar: Number(e.target.value),
                  })
                }
                className="w-full px-2 py-1 rounded text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 3. LOAD INSPECTOR & CONTROLS
  // ============================================================================
  if (found.category === 'load') {
    const load = found.item as NetworkLoad;
    const isConnected = load.status === 'connected';
    const busSol = solution?.busSolutions[load.busNumber];
    const effectivePMw =
      isConnected && busSol?.energized
        ? load.configuredActivePowerMw * network.loadScaleFactor
        : 0;
    const effectiveQMvar =
      isConnected && busSol?.energized
        ? load.configuredReactivePowerMvar * network.loadScaleFactor
        : 0;
    const apparentMva = Math.hypot(effectivePMw, effectiveQMvar);
    const pf = apparentMva > 1e-4 ? effectivePMw / apparentMva : 1.0;

    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                {load.id}
              </span>
              <button
                type="button"
                onClick={() => onSelectElement({ category: 'bus', id: load.busId })}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Bus #{load.busNumber} ({load.baseKv} kV)
              </button>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {load.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Constant P-Q Spot Load • Nominal: {load.nominalActivePowerMw.toFixed(1)} MW,{' '}
              {load.nominalReactivePowerMvar.toFixed(1)} MVAr
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onResetSingleEquipment({ category: 'load', id: load.id })}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Reset load demand to IEEE 30-Bus nominal values"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={() => onToggleEquipmentStatus({ category: 'load', id: load.id })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                isConnected
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/40 hover:bg-red-500/25'
              }`}
            >
              <Power size={13} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </button>
          </div>
        </div>

        {renderStaleBanner()}

        {/* Solved Load Served */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 grid grid-cols-3 gap-2 text-xs">
          <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Served Active (P_L)</div>
            <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
              {effectivePMw.toFixed(2)} MW
            </div>
            <div className="text-[10px] text-slate-500">
              Scale: {(network.loadScaleFactor * 100).toFixed(0)}%
            </div>
          </div>
          <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Served Reactive (Q_L)</div>
            <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
              {effectiveQMvar.toFixed(2)} MVAr
            </div>
            <div className="text-[10px] text-slate-500">PF: {pf.toFixed(3)} lag</div>
          </div>
          <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Bus Voltage</div>
            <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
              {busSol ? `${busSol.vmPu.toFixed(3)} p.u.` : 'N/A'}
            </div>
            <div className="text-[10px] text-slate-500">
              {busSol?.energized ? 'Energized' : 'De-energized'}
            </div>
          </div>
        </div>

        {/* Editable Load Demand */}
        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <Sliders size={13} />
            Load Demand Configuration
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">
                Active Power Demand P_L (MW)
              </label>
              <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                {load.configuredActivePowerMw.toFixed(1)} MW (Nom: {load.nominalActivePowerMw} MW)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={Math.max(120, Math.ceil(load.nominalActivePowerMw * 2))}
                step={0.5}
                value={load.configuredActivePowerMw}
                onChange={(e) =>
                  onUpdateLoad(load.id, {
                    configuredActivePowerMw: Number(e.target.value),
                  })
                }
                className="flex-1 accent-purple-600 cursor-pointer"
              />
              <input
                type="number"
                step={0.5}
                min={0}
                max={300}
                value={load.configuredActivePowerMw}
                onChange={(e) =>
                  onUpdateLoad(load.id, {
                    configuredActivePowerMw: Number(e.target.value),
                  })
                }
                className="w-20 px-2 py-1 rounded text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-right"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">
                Reactive Power Demand Q_L (MVAr)
              </label>
              <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                {load.configuredReactivePowerMvar.toFixed(1)} MVAr (Nom:{' '}
                {load.nominalReactivePowerMvar} MVAr)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-20}
                max={Math.max(60, Math.ceil(load.nominalReactivePowerMvar * 2.5))}
                step={0.5}
                value={load.configuredReactivePowerMvar}
                onChange={(e) =>
                  onUpdateLoad(load.id, {
                    configuredReactivePowerMvar: Number(e.target.value),
                  })
                }
                className="flex-1 accent-purple-600 cursor-pointer"
              />
              <input
                type="number"
                step={0.5}
                min={-50}
                max={200}
                value={load.configuredReactivePowerMvar}
                onChange={(e) =>
                  onUpdateLoad(load.id, {
                    configuredReactivePowerMvar: Number(e.target.value),
                  })
                }
                className="w-20 px-2 py-1 rounded text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-right"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 4. TRANSMISSION LINE INSPECTOR & BREAKER CONTROL
  // ============================================================================
  if (found.category === 'line') {
    const line = found.item as NetworkTransmissionLine;
    const flow = solution?.lineFlows[line.id];
    const isOnline = line.status === 'online';

    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                {line.id} (Branch #{line.branchIndex})
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {line.voltageKv} kV
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {line.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <button
                type="button"
                onClick={() => onSelectElement({ category: 'bus', id: line.fromBusId })}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
              >
                From: Bus #{line.fromBusNumber}
              </button>
              <span className="text-slate-400">↔</span>
              <button
                type="button"
                onClick={() => onSelectElement({ category: 'bus', id: line.toBusId })}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
              >
                To: Bus #{line.toBusNumber}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleEquipmentStatus({ category: 'line', id: line.id })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                isOnline
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/40 hover:bg-red-500/25'
              }`}
            >
              <Power size={13} />
              {isOnline ? 'Closed (In Service)' : 'Open (Tripped)'}
            </button>
          </div>
        </div>

        {renderStaleBanner()}

        {/* Solved Branch Flows & Losses */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
              <Zap size={13} />
              Solved Two-Terminal Branch Flows
            </span>
            {flow && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  flow.overloaded
                    ? 'bg-red-500/15 text-red-500'
                    : flow.loadingPercent >= 80
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-emerald-500/15 text-emerald-500'
                }`}
              >
                Loading: {flow.loadingPercent.toFixed(1)}% of {line.ratingMva} MVA
              </span>
            )}
          </div>

          {flow ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">
                  From Bus #{line.fromBusNumber} Terminal
                </div>
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  P: {flow.pFromMw >= 0 ? '+' : ''}
                  {flow.pFromMw.toFixed(2)} MW
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Q: {flow.qFromMvar >= 0 ? '+' : ''}
                  {flow.qFromMvar.toFixed(2)} MVAr ({flow.sFromMva.toFixed(2)} MVA)
                </div>
              </div>

              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">
                  To Bus #{line.toBusNumber} Terminal
                </div>
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  P: {flow.pToMw >= 0 ? '+' : ''}
                  {flow.pToMw.toFixed(2)} MW
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Q: {flow.qToMvar >= 0 ? '+' : ''}
                  {flow.qToMvar.toFixed(2)} MVAr ({flow.sToMva.toFixed(2)} MVA)
                </div>
              </div>

              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Active & Reactive Losses</div>
                <div className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  I²R: {flow.lossMw.toFixed(3)} MW
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  ΔQ: {flow.lossMvar.toFixed(3)} MVAr
                </div>
              </div>

              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Thermal Limit (Rate A)</div>
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  {flow.maxApparentFlowMva.toFixed(2)} / {line.ratingMva} MVA
                </div>
                <div className="text-[10px] text-slate-500 truncate" title={line.ratingSourceNote}>
                  Alsac & Stott (1974) Rate A
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">No solution available.</div>
          )}
        </div>

        {/* Documented Pi-Equivalent Parameters */}
        <div className="space-y-1.5 text-xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Documented π-Model Impedances (100 MVA Base)
          </div>
          <div className="grid grid-cols-3 gap-2 font-mono">
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50">
              <div className="text-[10px] text-slate-400">Resistance R</div>
              <div className="font-bold">{line.resistancePu.toFixed(4)} p.u.</div>
            </div>
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50">
              <div className="text-[10px] text-slate-400">Reactance X</div>
              <div className="font-bold">{line.reactancePu.toFixed(4)} p.u.</div>
            </div>
            <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/50">
              <div className="text-[10px] text-slate-400">Charging B</div>
              <div className="font-bold">{line.chargingSusceptancePu.toFixed(4)} p.u.</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 5. TRANSFORMER INSPECTOR & TAP-CHANGER CONTROLS
  // ============================================================================
  if (found.category === 'transformer') {
    const tx = found.item as NetworkTransformer;
    const flow = solution?.transformerFlows[tx.id];
    const isOnline = tx.status === 'online';

    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                {tx.id} (Branch #{tx.branchIndex})
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {tx.fromVoltageKv}/{tx.toVoltageKv} kV
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {tx.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <button
                type="button"
                onClick={() => onSelectElement({ category: 'bus', id: tx.fromBusId })}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
              >
                Tap Side: Bus #{tx.fromBusNumber}
              </button>
              <span className="text-slate-400">→</span>
              <button
                type="button"
                onClick={() => onSelectElement({ category: 'bus', id: tx.toBusId })}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
              >
                Secondary: Bus #{tx.toBusNumber}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onResetSingleEquipment({ category: 'transformer', id: tx.id })}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Reset transformer tap ratio and phase shift to IEEE 30-Bus nominal values"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={() => onToggleEquipmentStatus({ category: 'transformer', id: tx.id })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                isOnline
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/40 hover:bg-red-500/25'
              }`}
            >
              <Power size={13} />
              {isOnline ? 'In Service' : 'Offline'}
            </button>
          </div>
        </div>

        {renderStaleBanner()}

        {/* Solved Transformer Flows */}
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <Zap size={13} />
              Solved Transformer Flows & Losses
            </span>
            {flow && (
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  flow.overloaded
                    ? 'bg-red-500/15 text-red-500'
                    : flow.loadingPercent >= 80
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-emerald-500/15 text-emerald-500'
                }`}
              >
                Loading: {flow.loadingPercent.toFixed(1)}% of {tx.ratingMva} MVA
              </span>
            )}
          </div>

          {flow ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">
                  Primary (Bus #{tx.fromBusNumber})
                </div>
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  P: {flow.pFromMw >= 0 ? '+' : ''}
                  {flow.pFromMw.toFixed(2)} MW
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Q: {flow.qFromMvar >= 0 ? '+' : ''}
                  {flow.qFromMvar.toFixed(2)} MVAr
                </div>
              </div>

              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">
                  Secondary (Bus #{tx.toBusNumber})
                </div>
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  P: {flow.pToMw >= 0 ? '+' : ''}
                  {flow.pToMw.toFixed(2)} MW
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Q: {flow.qToMvar >= 0 ? '+' : ''}
                  {flow.qToMvar.toFixed(2)} MVAr
                </div>
              </div>

              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Transformer Reactive Loss</div>
                <div className="font-mono font-bold text-amber-600 dark:text-amber-400">
                  ΔQ: {flow.lossMvar.toFixed(2)} MVAr
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  X_leak = {tx.reactancePu.toFixed(4)} p.u.
                </div>
              </div>

              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] text-slate-400">Apparent Flow / Rating</div>
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                  {flow.maxApparentFlowMva.toFixed(2)} / {tx.ratingMva} MVA
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Tap τ = {tx.tapRatioPu.toFixed(3)} p.u.
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic">No solution available.</div>
          )}
        </div>

        {/* Editable Off-Nominal Tap Ratio & Phase Shift */}
        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <Sliders size={13} />
            Off-Nominal Tap Changer & Phase Shift Controls
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">
                Off-Nominal Turns Ratio τ (p.u.)
              </label>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                {tx.tapRatioPu.toFixed(3)} p.u. (Nom: {tx.nominalTapRatioPu.toFixed(3)})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0.85}
                max={1.15}
                step={0.002}
                value={tx.tapRatioPu}
                onChange={(e) =>
                  onUpdateTransformer(tx.id, { tapRatioPu: Number(e.target.value) })
                }
                className="flex-1 accent-amber-500 cursor-pointer"
              />
              <input
                type="number"
                step={0.005}
                min={0.85}
                max={1.15}
                value={tx.tapRatioPu}
                onChange={(e) =>
                  onUpdateTransformer(tx.id, { tapRatioPu: Number(e.target.value) })
                }
                className="w-20 px-2 py-1 rounded text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-right"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <label className="font-semibold text-slate-700 dark:text-slate-200">
                Phase-Shift Angle θ_shift (deg)
              </label>
              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                {tx.phaseShiftDeg.toFixed(1)}°
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-30}
                max={30}
                step={0.5}
                value={tx.phaseShiftDeg}
                onChange={(e) =>
                  onUpdateTransformer(tx.id, { phaseShiftDeg: Number(e.target.value) })
                }
                className="flex-1 accent-blue-600 cursor-pointer"
              />
              <input
                type="number"
                step={0.5}
                min={-45}
                max={45}
                value={tx.phaseShiftDeg}
                onChange={(e) =>
                  onUpdateTransformer(tx.id, { phaseShiftDeg: Number(e.target.value) })
                }
                className="w-20 px-2 py-1 rounded text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-right"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 6. SWITCHED SHUNT CAPACITOR BANK INSPECTOR & CONTROLS
  // ============================================================================
  if (found.category === 'shunt') {
    const shunt = found.item as NetworkShunt;
    const shuntSol = solution?.shuntOutputs[shunt.id];
    const busSol = solution?.busSolutions[shunt.busNumber];
    const isOnline = shunt.status === 'online';

    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                {shunt.id}
              </span>
              <button
                type="button"
                onClick={() => onSelectElement({ category: 'bus', id: shunt.busId })}
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Bus #{shunt.busNumber} ({shunt.baseKv} kV)
              </button>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
              {shunt.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Switched Shunt {shunt.shuntType} • Nominal B_s: +
              {shunt.nominalSusceptanceMvarAtUnitV.toFixed(1)} MVAr @ 1.0 p.u.
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onResetSingleEquipment({ category: 'shunt', id: shunt.id })}
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
              title="Reset shunt susceptance to IEEE 30-Bus nominal value"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={() => onToggleEquipmentStatus({ category: 'shunt', id: shunt.id })}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                isOnline
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25'
                  : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/40 hover:bg-red-500/25'
              }`}
            >
              <Power size={13} />
              {isOnline ? 'Switched In' : 'Switched Out'}
            </button>
          </div>
        </div>

        {renderStaleBanner()}

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Actual Reactive Injection (B_s·|V|²)</div>
            <div className="font-mono font-bold text-sm text-cyan-600 dark:text-cyan-400">
              {shuntSol ? `+${shuntSol.qInjectedMvar.toFixed(2)} MVAr` : '0.00 MVAr'}
            </div>
          </div>
          <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
            <div className="text-[10px] text-slate-400">Bus #{shunt.busNumber} Voltage</div>
            <div className="font-mono font-bold text-sm text-slate-900 dark:text-white">
              {busSol ? `${busSol.vmPu.toFixed(4)} p.u.` : 'N/A'}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 space-y-2">
          <div className="flex justify-between text-xs">
            <label className="font-semibold text-slate-700 dark:text-slate-200">
              Nominal Shunt Susceptance B_s (MVAr @ V = 1.0 p.u.)
            </label>
            <span className="font-mono font-bold text-cyan-600 dark:text-cyan-400">
              {shunt.configuredSusceptanceMvarAtUnitV.toFixed(1)} MVAr
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={-30}
              max={50}
              step={1}
              value={shunt.configuredSusceptanceMvarAtUnitV}
              onChange={(e) =>
                onUpdateShunt(shunt.id, {
                  configuredSusceptanceMvarAtUnitV: Number(e.target.value),
                })
              }
              className="flex-1 accent-cyan-600 cursor-pointer"
            />
            <input
              type="number"
              step={1}
              min={-100}
              max={100}
              value={shunt.configuredSusceptanceMvarAtUnitV}
              onChange={(e) =>
                onUpdateShunt(shunt.id, {
                  configuredSusceptanceMvarAtUnitV: Number(e.target.value),
                })
              }
              className="w-20 px-2 py-1 rounded text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-right"
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
};
