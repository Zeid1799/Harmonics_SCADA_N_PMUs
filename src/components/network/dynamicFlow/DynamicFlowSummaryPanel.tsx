import React, { useState, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Info,
  Search,
} from 'lucide-react';
import {
  PowerNetworkModel,
  PowerFlowSolutionResult,
  SelectedNetworkElement,
} from '../../../types/network';
import {
  deriveBranchDynamicFlowState,
  DynamicFlowConfig,
} from '../../../types/dynamicFlow';

interface DynamicFlowSummaryPanelProps {
  network: PowerNetworkModel;
  solution: PowerFlowSolutionResult | null;
  config: DynamicFlowConfig;
  selectedElement: SelectedNetworkElement | null;
  onSelectElement: (element: SelectedNetworkElement) => void;
  onRunPowerFlow?: () => void;
}

export const DynamicFlowSummaryPanel: React.FC<DynamicFlowSummaryPanelProps> = ({
  network,
  solution,
  config,
  selectedElement,
  onSelectElement,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'elevated' | 'lines' | 'transformers'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate branch flow states
  const branchStates = useMemo(() => {
    if (!solution) return [];

    const lineStates = network.lines.map((ln) =>
      deriveBranchDynamicFlowState(
        ln.id,
        'line',
        ln.fromBusNumber,
        ln.toBusNumber,
        ln.ratingMva,
        solution.lineFlows[ln.id],
        config
      )
    );

    const txStates = network.transformers.map((tr) =>
      deriveBranchDynamicFlowState(
        tr.id,
        'transformer',
        tr.fromBusNumber,
        tr.toBusNumber,
        tr.ratingMva,
        solution.transformerFlows[tr.id],
        config
      )
    );

    return [...lineStates, ...txStates].sort(
      (a, b) => b.loadingPercent - a.loadingPercent
    );
  }, [network, solution, config]);

  // Filtered branches
  const filteredBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return branchStates.filter((b) => {
      if (filterMode === 'elevated' && b.loadingPercent < 70) return false;
      if (filterMode === 'lines' && b.category !== 'line') return false;
      if (filterMode === 'transformers' && b.category !== 'transformer') return false;
      if (q) {
        return (
          b.branchId.toLowerCase().includes(q) ||
          b.flowDirectionLabel.toLowerCase().includes(q) ||
          String(b.fromBusNumber).includes(q) ||
          String(b.toBusNumber).includes(q)
        );
      }
      return true;
    });
  }, [branchStates, filterMode, searchQuery]);

  // System Totals
  const totalGenMw = solution?.summary.totalGenerationMw ?? 0;
  const totalLoadMw = solution?.summary.totalLoadServedMw ?? 0;
  const totalLossMw = solution?.summary.totalActiveLossesMw ?? 0;
  const lossPercent = totalGenMw > 0 ? (totalLossMw / totalGenMw) * 100 : 0;
  const maxLoaded = branchStates[0];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col text-xs space-y-3 p-3.5">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <Activity size={14} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              Dynamic Power Flow Telemetry
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              Steady-State AC Load Flow Results
            </span>
          </div>
        </div>

        {solution?.converged ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 size={11} />
            Converged
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40">
            <AlertTriangle size={11} />
            Unsolved
          </span>
        )}
      </div>

      {/* System Telemetry Hero Metrics */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">
            Total Generation:
          </span>
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {totalGenMw.toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">MW</span>
          </div>
          <span className="text-[9.5px] text-slate-400 font-sans block mt-0.5">
            Load: {totalLoadMw.toFixed(1)} MW
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">
            Transmission Losses:
          </span>
          <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
            {totalLossMw.toFixed(2)} <span className="text-[10px] text-slate-500 font-normal">MW</span>
          </div>
          <span className="text-[9.5px] text-slate-400 font-sans block mt-0.5">
            Loss: {lossPercent.toFixed(2)}% of Gen
          </span>
        </div>

        <div className="col-span-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">
              Peak Thermal Loading:
            </span>
            {maxLoaded && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                  maxLoaded.isOverloaded
                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                    : maxLoaded.loadingPercent >= 70
                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {maxLoaded.loadingPercent.toFixed(1)}% of Rate A
              </span>
            )}
          </div>
          {maxLoaded && (
            <div className="mt-1 flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
                {maxLoaded.category === 'transformer' ? 'TX' : 'Line'} {maxLoaded.flowDirectionLabel} ({maxLoaded.branchId})
              </span>
              <span className="text-slate-500 font-mono">
                {maxLoaded.apparentPowerMva.toFixed(1)} / {maxLoaded.ratingMva} MVA
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex flex-wrap gap-1">
            {(
              [
                { id: 'all', label: `All (${branchStates.length})` },
                {
                  id: 'elevated',
                  label: `≥70% (${
                    branchStates.filter((b) => b.loadingPercent >= 70).length
                  })`,
                },
                { id: 'lines', label: 'Lines' },
                { id: 'transformers', label: 'TXs' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                  filterMode === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative max-w-[130px]">
            <Search
              size={11}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID/bus..."
              className="w-full pl-6 pr-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
            />
          </div>
        </div>

        {/* Scrollable Branch Loading List */}
        <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
          {filteredBranches.map((b) => {
            const isSelected =
              selectedElement?.id === b.branchId &&
              selectedElement?.category === b.category;

            return (
              <div
                key={b.branchId}
                onClick={() =>
                  onSelectElement({ category: b.category, id: b.branchId })
                }
                className={`p-2 transition-colors cursor-pointer flex flex-col gap-1 ${
                  isSelected
                    ? 'bg-blue-500/15 dark:bg-blue-900/30 border-l-2 border-blue-500'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between font-mono">
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: b.loadingColor }}
                    />
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {b.flowDirectionLabel}
                    </span>
                    <span className="text-[10px] text-slate-400 font-sans">
                      ({b.branchId})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold" style={{ color: b.loadingColor }}>
                      {b.loadingPercent.toFixed(1)}%
                    </span>
                    <span className="text-slate-400 text-[10.5px]">
                      {b.activePowerMw.toFixed(1)} MW
                    </span>
                  </div>
                </div>

                {/* Loading Progress Bar */}
                <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, b.loadingPercent)}%`,
                      backgroundColor: b.loadingColor,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-[9.5px] text-slate-400 font-mono">
                  <span>Flow: {b.apparentPowerMva.toFixed(1)} MVA</span>
                  <span>Rate A: {b.ratingMva > 0 ? `${b.ratingMva} MVA` : 'N/A'}</span>
                  <span>Q: {b.reactivePowerMvar.toFixed(1)} MVAr</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Engineering Flow Convention Note */}
      <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-[10.5px] text-slate-600 dark:text-slate-300 space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-blue-600 dark:text-blue-400">
          <Info size={12} />
          <span>Steady-State Flow Convention</span>
        </div>
        <p className="leading-relaxed">
          Flow direction is derived strictly from calculated active terminal power: P(from) &gt; 0 indicates real power leaving the From-Bus toward the To-Bus. Particles animate along this physical path at speeds scaled with active MW magnitude.
        </p>
      </div>
    </div>
  );
};
