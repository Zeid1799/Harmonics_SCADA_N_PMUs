import React, { useState } from 'react';
import {
  Zap,
  RotateCcw,
  Play,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Target,
} from 'lucide-react';
import { PowerNetworkModel } from '../../../types/network';
import {
  ShortCircuitScenario,
  ShortCircuitSolution,
} from '../../../types/shortCircuit';

interface ShortCircuitControlPanelProps {
  network: PowerNetworkModel;
  scenario: ShortCircuitScenario;
  solution: ShortCircuitSolution | null;
  isStale: boolean;
  onUpdateScenario: (patch: Partial<ShortCircuitScenario>) => void;
  onSolveShortCircuit: () => void;
  onResetScenario: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const ShortCircuitControlPanel: React.FC<ShortCircuitControlPanelProps> = ({
  network,
  scenario,
  solution,
  isStale,
  onUpdateScenario,
  onSolveShortCircuit,
  onResetScenario,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [showDocs, setShowDocs] = useState(false);

  const faultedBus = network.buses.find((b) => b.number === scenario.faultedBusNumber);

  const isBolted = scenario.faultResistanceOhms === 0 && scenario.faultReactanceOhms === 0;

  const handleSetBolted = () => {
    onUpdateScenario({
      faultResistanceOhms: 0,
      faultReactanceOhms: 0,
      faultResistancePu: 0,
      faultReactancePu: 0,
    });
  };

  const handleResistanceChange = (ohms: number) => {
    const safeOhms = Math.max(0, Number.isFinite(ohms) ? ohms : 0);
    onUpdateScenario({
      faultResistanceOhms: safeOhms,
      faultResistancePu: 0, // solver will compute from ohms
    });
  };

  const handleReactanceChange = (ohms: number) => {
    const safeOhms = Math.max(0, Number.isFinite(ohms) ? ohms : 0);
    onUpdateScenario({
      faultReactanceOhms: safeOhms,
      faultReactancePu: 0,
    });
  };

  if (isCollapsed) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          title="Expand Short-Circuit Panel"
          aria-label="Expand Short-Circuit Panel"
        >
          <ChevronDown size={16} />
        </button>
        <div className="writing-mode-vertical text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 py-2">
          SC ANALYSIS
        </div>
        <button
          type="button"
          onClick={onSolveShortCircuit}
          className="p-2 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-600 transition-colors cursor-pointer"
          title="Run Short-Circuit Calculation"
        >
          <Play size={14} className="fill-current" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col text-xs">
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Zap size={14} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Short-Circuit Analysis</h3>
            <span className="text-[10px] text-slate-500 font-mono">IEEE Std 551 / IEC 60909</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isStale && solution && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40"
              title="Network parameters or topology changed since last calculation"
            >
              <AlertTriangle size={11} />
              Stale
            </span>
          )}
          {solution && solution.converged && !isStale && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 size={11} />
              Ready
            </span>
          )}
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              title="Collapse Panel"
              aria-label="Collapse Short-Circuit Panel"
            >
              <ChevronUp size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="p-3.5 space-y-3.5 overflow-y-auto max-h-[calc(100vh-280px)]">
        {/* 1. Fault Location (Bus Selector) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Target size={12} className="text-amber-500" />
              Fault Location
            </label>
            <span className="text-[10px] text-slate-500 font-mono">
              {faultedBus?.baseKv} kV {faultedBus?.areaName?.split(':')[0]}
            </span>
          </div>

          <select
            value={scenario.faultedBusNumber}
            onChange={(e) => onUpdateScenario({ faultedBusNumber: parseInt(e.target.value, 10) })}
            aria-label="Faulted Bus Location"
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs focus:ring-2 focus:ring-amber-500 outline-none cursor-pointer"
          >
            {network.buses.map((b) => (
              <option key={b.number} value={b.number} disabled={b.status !== 'online'}>
                Bus {b.number}: {b.name} ({b.baseKv} kV) {b.status !== 'online' ? '[OFFLINE]' : ''}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>Tip: You can also click any bus directly on the One-Line diagram.</span>
          </p>
        </div>

        {/* 2. Fault Type Selector */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
            Fault Type
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onUpdateScenario({ faultType: '3phase' })}
              className={`px-2 py-1.5 rounded-lg border text-left font-mono transition-colors cursor-pointer ${
                scenario.faultType === '3phase'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-300 font-bold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="text-[11px] font-bold">3-Phase (3P)</div>
              <div className="text-[9.5px] opacity-75">Symmetrical (LLL-G)</div>
            </button>

            <button
              type="button"
              onClick={() => onUpdateScenario({ faultType: 'single-line-to-ground' })}
              className={`px-2 py-1.5 rounded-lg border text-left font-mono transition-colors cursor-pointer ${
                scenario.faultType === 'single-line-to-ground'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-300 font-bold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="text-[11px] font-bold">SLG (1LG)</div>
              <div className="text-[9.5px] opacity-75">Phase A to Ground</div>
            </button>

            <button
              type="button"
              onClick={() => onUpdateScenario({ faultType: 'line-to-line' })}
              className={`px-2 py-1.5 rounded-lg border text-left font-mono transition-colors cursor-pointer ${
                scenario.faultType === 'line-to-line'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-300 font-bold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="text-[11px] font-bold">Line-to-Line (LL)</div>
              <div className="text-[9.5px] opacity-75">Phases B to C</div>
            </button>

            <button
              type="button"
              onClick={() => onUpdateScenario({ faultType: 'double-line-to-ground' })}
              className={`px-2 py-1.5 rounded-lg border text-left font-mono transition-colors cursor-pointer ${
                scenario.faultType === 'double-line-to-ground'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-300 font-bold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="text-[11px] font-bold">DLG (2LG)</div>
              <div className="text-[9.5px] opacity-75">Phases B-C to Gnd</div>
            </button>
          </div>
        </div>

        {/* 3. Fault Impedance Zf (Bolted vs Custom) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <Sliders size={12} className="text-amber-500" />
              Fault Impedance (Zf)
            </label>
            <button
              type="button"
              onClick={handleSetBolted}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer ${
                isBolted
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Bolted (0 Ω)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5 font-mono">Rf (Ohms Ω):</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={scenario.faultResistanceOhms}
                onChange={(e) => handleResistanceChange(parseFloat(e.target.value))}
                aria-label="Fault Resistance in Ohms"
                className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block mb-0.5 font-mono">Xf (Ohms Ω):</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={scenario.faultReactanceOhms}
                onChange={(e) => handleReactanceChange(parseFloat(e.target.value))}
                aria-label="Fault Reactance in Ohms"
                className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        {/* 4. Prefault Voltage Source Profile */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block mb-1.5">
            Prefault Voltage Profile
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onUpdateScenario({ prefaultVoltageMode: 'power-flow' })}
              className={`px-2 py-1.5 rounded-lg border text-left font-mono transition-colors cursor-pointer ${
                scenario.prefaultVoltageMode === 'power-flow'
                  ? 'bg-blue-500/20 border-blue-500 text-blue-800 dark:text-blue-300 font-bold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="text-[10.5px] font-bold">Solved AC Power Flow</div>
              <div className="text-[9.5px] opacity-75">Operating V_k ∠ θ_k</div>
            </button>

            <button
              type="button"
              onClick={() => onUpdateScenario({ prefaultVoltageMode: 'flat-1.0' })}
              className={`px-2 py-1.5 rounded-lg border text-left font-mono transition-colors cursor-pointer ${
                scenario.prefaultVoltageMode === 'flat-1.0'
                  ? 'bg-blue-500/20 border-blue-500 text-blue-800 dark:text-blue-300 font-bold'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="text-[10.5px] font-bold">Flat 1.0 p.u. Profile</div>
              <div className="text-[9.5px] opacity-75">Standard IEEE/IEC</div>
            </button>
          </div>
        </div>

        {/* 5. Primary Action Buttons */}
        <div className="pt-1 flex items-center gap-2">
          <button
            type="button"
            onClick={onSolveShortCircuit}
            className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-md transition-all cursor-pointer text-xs"
          >
            <Play size={13} className="fill-current" />
            <span>Calculate Fault</span>
          </button>

          <button
            type="button"
            onClick={onResetScenario}
            className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Reset to default bolted 3-phase fault at Bus 1"
            aria-label="Reset scenario"
          >
            <RotateCcw size={14} />
          </button>
        </div>

        {/* 6. Expandable Technical Model Notes */}
        <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowDocs((prev) => !prev)}
            className="w-full flex items-center justify-between text-[10.5px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle size={12} className="text-amber-500" />
              Sequence Model & Assumptions
            </span>
            {showDocs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showDocs && (
            <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 space-y-1.5 text-[10px] text-slate-600 dark:text-slate-300 font-mono">
              <p>
                <strong>Method:</strong> Z_bus Symmetrical Components (IEEE Std 551 / 399).
              </p>
              <p>
                <strong>Generators:</strong> Modeled with subtransient reactances X"d (0.0556 to 0.20 pu on 100 MVA base), solidly grounded neutrals.
              </p>
              <p>
                <strong>Transformers:</strong> Modeled as Delta 132 kV / Grounded-Wye 33 kV step-down, providing zero-sequence ground reference to the 33 kV network.
              </p>
              <p>
                <strong>Lines:</strong> Carson ground-return approximation X0/X1 = 3.0, R0/R1 = 3.0, B0/B1 = 0.5.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
