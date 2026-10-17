import React from 'react';
import {
  Play,
  Pause,
  Sliders,
  Eye,
  Activity,
  RotateCcw,
  Zap,
} from 'lucide-react';
import {
  DynamicFlowConfig,
  FlowSpeedMultiplier,
} from '../../../types/dynamicFlow';
import { PowerFlowSolutionResult } from '../../../types/network';

interface DynamicFlowToolbarProps {
  config: DynamicFlowConfig;
  onUpdateConfig: (patch: Partial<DynamicFlowConfig>) => void;
  solution: PowerFlowSolutionResult | null;
  isStale: boolean;
  onRunPowerFlow: () => void;
  onOpenLegend?: () => void;
}

export const DynamicFlowToolbar: React.FC<DynamicFlowToolbarProps> = ({
  config,
  onUpdateConfig,
  solution,
  isStale,
  onRunPowerFlow,
}) => {
  const isPlaying = config.isPlaying;
  const isAnimated = config.animationMode === 'animated';

  // Compute live active branch counts from solution
  const allFlows = solution
    ? [
        ...Object.values(solution.lineFlows || {}),
        ...Object.values(solution.transformerFlows || {}),
      ]
    : [];

  const energizedCount = allFlows.filter((f) => f.energized).length;
  const activeFlowCount = allFlows.filter(
    (f) => f.energized && Math.abs(f.pFromMw) > config.minFlowThresholdMw
  ).length;
  const overloadedCount = allFlows.filter((f) => f.overloaded).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs select-none">
      {/* Left: Play/Pause, Mode Toggle, and Speed Controls */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Play / Pause Toggle Button */}
        <button
          type="button"
          onClick={() => onUpdateConfig({ isPlaying: !isPlaying })}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm ${
            isPlaying
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-400/40'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
          title={isPlaying ? 'Pause Dynamic Flow Animation' : 'Resume Flow Animation'}
        >
          {isPlaying ? (
            <>
              <Pause size={13} className="fill-current" />
              <span>Pause Flow</span>
            </>
          ) : (
            <>
              <Play size={13} className="fill-current" />
              <span>Resume Flow</span>
            </>
          )}
        </button>

        {/* Display Mode: Animated Stream vs Static Vectors */}
        <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-800 border border-slate-700">
          <button
            type="button"
            onClick={() => onUpdateConfig({ animationMode: 'animated' })}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
              isAnimated
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Visualize flow using moving particles along branches"
          >
            Animated Stream
          </button>
          <button
            type="button"
            onClick={() => onUpdateConfig({ animationMode: 'static' })}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
              !isAnimated
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Display static directional vectors and loading indicators without particle motion"
          >
            Static Vectors
          </button>
        </div>

        {/* Speed Selector (Disabled when in static mode) */}
        {isAnimated && (
          <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300">
            <Sliders size={12} className="text-slate-400" />
            <span className="text-[11px] font-semibold text-slate-400 mr-0.5">Speed:</span>
            {([0.5, 1.0, 2.0] as FlowSpeedMultiplier[]).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onUpdateConfig({ speedMultiplier: spd })}
                className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                  config.speedMultiplier === spd
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
                title={`Set animation speed to ${spd}x`}
              >
                {spd}x
              </button>
            ))}
          </div>
        )}

        {/* Telemetry Labels Toggle */}
        <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={config.showBranchTelemetry}
            onChange={(e) =>
              onUpdateConfig({ showBranchTelemetry: e.target.checked })
            }
            className="rounded border-slate-600 text-amber-500 cursor-pointer"
          />
          <Eye size={12} className="text-amber-400" />
          <span>Telemetry Chips</span>
        </label>
      </div>

      {/* Right: Solved Network Flow Status & Stale Recalculate Trigger */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        {/* Active Streams Counter */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700">
          <span className="flex items-center gap-1 text-slate-300 font-sans font-medium text-[11px]">
            <Activity size={12} className="text-cyan-400" />
            Active:
          </span>
          <span className="font-bold text-cyan-300">
            {activeFlowCount} / {energizedCount}
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-[11px] text-slate-400">
            {overloadedCount > 0 ? (
              <span className="text-rose-400 font-bold">{overloadedCount} Overloaded</span>
            ) : (
              <span className="text-emerald-400">0 Overload</span>
            )}
          </span>
        </div>

        {/* Stale Warning & Re-Solve Button */}
        {isStale && (
          <button
            type="button"
            onClick={onRunPowerFlow}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-600 transition-colors cursor-pointer text-xs shadow-sm ring-1 ring-amber-400/50"
            title="Recalculate AC power flow for modified network parameters"
          >
            <RotateCcw size={12} />
            <span>Recalculate (Stale)</span>
          </button>
        )}

        {!isStale && solution?.converged && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <Zap size={11} className="fill-current text-emerald-400" />
            Solved Flow Active
          </span>
        )}
      </div>
    </div>
  );
};
