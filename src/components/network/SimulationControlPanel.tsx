import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Sliders,
  Zap,
  Activity,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react';
import {
  AcPowerFlowOptions,
  PowerFlowSolutionResult,
  PowerNetworkModel,
} from '../../types/network';

interface SimulationControlPanelProps {
  network: PowerNetworkModel;
  solution: PowerFlowSolutionResult | null;
  isStale: boolean;
  autoSolve: boolean;
  solverOptions: AcPowerFlowOptions;
  onToggleAutoSolve: (enabled: boolean) => void;
  onUpdateSolverOptions: (patch: Partial<AcPowerFlowOptions>) => void;
  onSolvePowerFlow: () => void;
  onUpdateLoadScale: (scaleFactor: number) => void;
  onReloadOriginalCase: () => void;
  onSelectElementById?: (category: 'bus' | 'line' | 'transformer' | 'generator', id: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SimulationControlPanel: React.FC<SimulationControlPanelProps> = ({
  network,
  solution,
  isStale,
  autoSolve,
  solverOptions,
  onToggleAutoSolve,
  onUpdateSolverOptions,
  onSolvePowerFlow,
  onUpdateLoadScale,
  onReloadOriginalCase,
  onSelectElementById,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [showDiagnosticsDrawer, setShowDiagnosticsDrawer] = useState(false);

  const getStatusBadge = () => {
    if (!solution || solution.status === 'not-solved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
          <Clock size={13} />
          Not Solved
        </span>
      );
    }
    if (solution.status === 'solving') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
          <Activity size={13} className="animate-spin" />
          Solving...
        </span>
      );
    }
    if (!solution.converged || solution.status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
          <XCircle size={13} />
          Failed to Converge
        </span>
      );
    }
    if (isStale) {
      return (
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40"
          title="Network parameters or statuses have been edited since the last AC power-flow calculation. Click Solve Power Flow to update."
        >
          <AlertTriangle size={13} />
          Stale Solution (Re-Solve Needed)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
        <CheckCircle2 size={13} />
        Converged ({solution.iterations} iter, {solution.solveDurationMs.toFixed(1)} ms)
      </span>
    );
  };

  const hasAlerts =
    solution &&
    (solution.topology.warnings.length > 0 ||
      solution.reactiveLimitEvents.length > 0 ||
      solution.summary.overloadedBranchCount > 0 ||
      solution.summary.voltageViolationBusCount > 0 ||
      !solution.converged);

  const loadScalePercent = Math.round(network.loadScaleFactor * 100);

  if (isCollapsed) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onSolvePowerFlow}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer ${
              isStale || !solution?.converged
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-400/40'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            title="Execute Polar Newton-Raphson AC Power-Flow Solver"
          >
            <Play size={13} className="fill-current" />
            {isStale ? 'Solve (Stale)' : 'Solve Power Flow'}
          </button>

          {getStatusBadge()}

          <span className="hidden sm:inline-flex text-slate-400">|</span>

          <span className="hidden sm:inline-flex items-center gap-1 font-mono text-slate-600 dark:text-slate-300">
            <span>Load Scale:</span>
            <strong className="text-blue-600 dark:text-blue-400">{loadScalePercent}%</strong>
          </span>

          {hasAlerts && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ShieldAlert size={12} />
              Alerts
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title="Expand Simulation Control Panel"
            >
              <span>Expand Controls</span>
              <ChevronDown size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
      {/* Primary Action & Metrics Row */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80">
        {/* Left: Solver Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onSolvePowerFlow}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer ${
              isStale || !solution?.converged
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-400/40'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            title="Execute Polar Newton-Raphson AC Power-Flow Solver"
          >
            <Play size={14} className="fill-current" />
            {isStale ? 'Solve Power Flow (Updated)' : 'Solve Power Flow'}
          </button>

          {/* Auto-Solve Toggle */}
          <label
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none"
            title="Automatically re-run AC power flow immediately whenever any equipment status or setpoint changes"
          >
            <input
              type="checkbox"
              checked={autoSolve}
              onChange={(e) => onToggleAutoSolve(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Auto-Solve</span>
          </label>

          {/* Enforce Generator Q-Limits Toggle */}
          <label
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none"
            title="Enforce generator Qmin/Qmax reactive limits with automatic PV-to-PQ bus type conversion"
          >
            <input
              type="checkbox"
              checked={solverOptions.enforceReactiveLimits}
              onChange={(e) =>
                onUpdateSolverOptions({ enforceReactiveLimits: e.target.checked })
              }
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Enforce Q-Limits</span>
          </label>

          {/* Flat Start Toggle */}
          <label
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none"
            title="Initialize PQ buses at 1.0 p.u. ∠ 0° instead of starting from initial case voltage guesses"
          >
            <input
              type="checkbox"
              checked={solverOptions.flatStart}
              onChange={(e) => onUpdateSolverOptions({ flatStart: e.target.checked })}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span>Flat Start</span>
          </label>
        </div>

        {/* Center: Global Load Scale Control */}
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70">
          <Sliders size={13} className="text-slate-500 dark:text-slate-400 shrink-0" />
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
            System Load Scale:
          </span>
          <input
            type="range"
            min={50}
            max={160}
            step={5}
            value={loadScalePercent}
            onChange={(e) => onUpdateLoadScale(Number(e.target.value) / 100)}
            className="w-24 accent-blue-600 cursor-pointer"
            aria-label="Global System Load Scale Percentage"
          />
          <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 min-w-[3.2rem] text-right">
            {loadScalePercent}%
          </span>
          {loadScalePercent !== 100 && (
            <button
              type="button"
              onClick={() => onUpdateLoadScale(1.0)}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer"
              title="Reset load scale multiplier to 100%"
            >
              100%
            </button>
          )}
        </div>

        {/* Right: Solver Status Badge & Reload Original Case */}
        <div className="flex items-center gap-2.5">
          {getStatusBadge()}

          <button
            type="button"
            onClick={onReloadOriginalCase}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
            title="Reload unmodified IEEE 30-Bus benchmark case and re-solve AC power flow"
          >
            <RotateCcw size={13} />
            Reload Original Case
          </button>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
              title="Collapse Simulation Control Panel"
            >
              <span>Collapse</span>
              <ChevronUp size={14} />
            </button>
          )}
        </div>
      </div>

      {/* System Summary Telemetry Strip */}
      {solution && (
        <div className="px-4 py-2.5 bg-slate-50/70 dark:bg-slate-950/50 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
          {/* Total Generation */}
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Generation
            </div>
            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {solution.summary.totalGenerationMw.toFixed(2)} MW
            </div>
            <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {solution.summary.totalGenerationMvar >= 0 ? '+' : ''}
              {solution.summary.totalGenerationMvar.toFixed(2)} MVAr
            </div>
          </div>

          {/* Total Load Served */}
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total Load Served
            </div>
            <div className="font-mono font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {solution.summary.totalLoadServedMw.toFixed(2)} MW
            </div>
            <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {solution.summary.totalLoadServedMvar.toFixed(2)} MVAr
              {solution.summary.totalUnsuppliedLoadMw > 0.01 && (
                <span className="ml-1 text-red-500 font-bold">
                  ({solution.summary.totalUnsuppliedLoadMw.toFixed(1)} MW unserved)
                </span>
              )}
            </div>
          </div>

          {/* Total Losses & Shunts */}
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Total I²R Losses / Shunts
            </div>
            <div className="font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {solution.summary.totalActiveLossesMw.toFixed(2)} MW (
              {solution.summary.totalLoadServedMw > 0
                ? (
                    (solution.summary.totalActiveLossesMw /
                      solution.summary.totalGenerationMw) *
                    100
                  ).toFixed(2)
                : '0.00'}
              %)
            </div>
            <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              Loss: {solution.summary.totalReactiveLossesMvar.toFixed(1)} MVAr • Shunt: +
              {solution.summary.totalShuntInjectionMvar.toFixed(1)} MVAr
            </div>
          </div>

          {/* Voltage Profile Extremes */}
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Voltage Profile (p.u.)
            </div>
            <div className="font-mono font-bold text-slate-800 dark:text-slate-100 mt-0.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onSelectElementById?.('bus', `BUS-${solution.summary.minVoltageBusNumber}`)
                }
                className={`hover:underline cursor-pointer ${
                  solution.summary.minVoltagePu < 0.95
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-cyan-600 dark:text-cyan-400'
                }`}
                title={`Click to inspect Bus ${solution.summary.minVoltageBusNumber}`}
              >
                Min: {solution.summary.minVoltagePu.toFixed(3)} (B
                {solution.summary.minVoltageBusNumber})
              </button>
            </div>
            <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() =>
                  onSelectElementById?.('bus', `BUS-${solution.summary.maxVoltageBusNumber}`)
                }
                className="hover:underline cursor-pointer"
                title={`Click to inspect Bus ${solution.summary.maxVoltageBusNumber}`}
              >
                Max: {solution.summary.maxVoltagePu.toFixed(3)} (B
                {solution.summary.maxVoltageBusNumber})
              </button>
              {solution.summary.voltageViolationBusCount > 0 && (
                <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-bold">
                  • {solution.summary.voltageViolationBusCount} viol.
                </span>
              )}
            </div>
          </div>

          {/* Peak Thermal Branch Loading */}
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Peak Branch Loading
            </div>
            <div className="font-mono font-bold mt-0.5">
              <button
                type="button"
                onClick={() => {
                  const id = solution.summary.maxLoadedBranchId;
                  if (!id) return;
                  const cat = id.startsWith('TR-') ? 'transformer' : 'line';
                  onSelectElementById?.(cat, id);
                }}
                className={`hover:underline cursor-pointer ${
                  solution.summary.maxBranchLoadingPercent >= 100
                    ? 'text-red-600 dark:text-red-400'
                    : solution.summary.maxBranchLoadingPercent >= 80
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {solution.summary.maxBranchLoadingPercent.toFixed(1)}% (
                {solution.summary.maxLoadedBranchId || 'N/A'})
              </button>
            </div>
            <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {solution.summary.overloadedBranchCount > 0 ? (
                <span className="text-red-600 dark:text-red-400 font-bold">
                  {solution.summary.overloadedBranchCount} branch(es) &gt; 100% Rate A
                </span>
              ) : (
                <span>All 41 branches within Rate A</span>
              )}
            </div>
          </div>

          {/* Solver Convergence & Mismatch */}
          <div className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Max P / Q Mismatch
            </div>
            <div className="font-mono font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              ΔP: {solution.maxActiveMismatchMw.toExponential(2)} MW
            </div>
            <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              ΔQ: {solution.maxReactiveMismatchMvar.toExponential(2)} MVAr
              {solution.reactiveLimitEvents.length > 0 && (
                <span className="ml-1 text-amber-600 dark:text-amber-400 font-semibold">
                  ({solution.reactiveLimitEvents.length} PV→PQ)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Expandable System Alerts / Topology & Q-Limit Diagnostics Drawer */}
      {hasAlerts && solution && (
        <div className="border-t border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <ShieldAlert size={14} className="shrink-0 text-amber-500" />
              <span>
                {!solution.converged
                  ? `Power-Flow Non-Convergence: ${solution.failureReason}`
                  : `System Operating Alerts: ${
                      solution.topology.warnings.length +
                      solution.reactiveLimitEvents.length
                    } diagnostic note(s), ${
                      solution.summary.overloadedBranchCount
                    } thermal overload(s), ${
                      solution.summary.voltageViolationBusCount
                    } bus voltage violation(s)`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowDiagnosticsDrawer((prev) => !prev)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
            >
              {showDiagnosticsDrawer ? 'Hide Details' : 'View Diagnostics'}
              {showDiagnosticsDrawer ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>

          {showDiagnosticsDrawer && (
            <div className="mt-2 pt-2 border-t border-amber-500/20 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              {!solution.converged && solution.failureReason && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 font-medium">
                  <strong>Solver Failure:</strong> {solution.failureReason}
                </div>
              )}
              {solution.topology.warnings.map((warn, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <Zap size={12} className="text-amber-500 mt-0.5 shrink-0" />
                  <span>{warn}</span>
                </div>
              ))}
              {solution.reactiveLimitEvents.map((ev, idx) => (
                <div key={`qlim-${idx}`} className="flex items-start gap-2 font-mono text-[11px]">
                  <AlertTriangle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                  <span>
                    Outer Loop #{ev.outerIteration}: Bus {ev.busNumber} ({ev.generatorIds.join(', ')}) hit{' '}
                    <strong>{ev.violationType.toUpperCase()}</strong> ({ev.unclampedQMvar.toFixed(2)} MVAr → clamped at{' '}
                    {ev.clampedQMvar.toFixed(2)} MVAr, converted PV → PQ).
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
