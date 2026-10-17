import React, { useRef, useEffect } from 'react';
import {
  RlcCircuitConfig,
  RlcCircuitMetrics,
  RlcActiveComponent,
  RlcTopologyConfig,
  RlcSimulationMode,
  RlcTransientState,
  DEFAULT_RLC_TOPOLOGY,
  DEFAULT_RLC_TRANSIENT_STATE,
} from '../../types/rlcCircuit';
import { Sliders, RotateCcw, Zap, Sparkles, Activity, Eye } from 'lucide-react';

interface RlcControlsProps {
  config: RlcCircuitConfig;
  topology?: RlcTopologyConfig;
  metrics: RlcCircuitMetrics;
  activeComponent: RlcActiveComponent;
  onSelectComponent: (component: RlcActiveComponent) => void;
  onChange: (updater: (prev: RlcCircuitConfig) => RlcCircuitConfig) => void;
  onTopologyChange?: (updater: (prev: RlcTopologyConfig) => RlcTopologyConfig) => void;
  simulationMode?: RlcSimulationMode;
  transientState?: RlcTransientState;
  onTransientChange?: (updater: (prev: RlcTransientState) => RlcTransientState) => void;
  onResetToDefault: () => void;
}

export const RlcControls: React.FC<RlcControlsProps> = ({
  config,
  topology = DEFAULT_RLC_TOPOLOGY,
  metrics,
  activeComponent,
  onSelectComponent,
  onChange,
  onTopologyChange,
  simulationMode = 'steady',
  transientState = DEFAULT_RLC_TRANSIENT_STATE,
  onTransientChange,
  onResetToDefault,
}) => {
  const sourceRef = useRef<HTMLDivElement | null>(null);
  const resistorRef = useRef<HTMLDivElement | null>(null);
  const inductorRef = useRef<HTMLDivElement | null>(null);
  const capacitorRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll or focus to active component when clicked in diagram
  useEffect(() => {
    if (activeComponent === 'source') {
      sourceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (activeComponent === 'resistor') {
      resistorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (activeComponent === 'inductor') {
      inductorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else if (activeComponent === 'capacitor') {
      capacitorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeComponent]);

  const handleUpdate = (patch: Partial<RlcCircuitConfig>) => {
    onChange((prev) => ({
      ...prev,
      ...patch,
    }));
  };

  const handleTopologyUpdate = (patch: Partial<RlcTopologyConfig>) => {
    if (onTopologyChange) {
      onTopologyChange((prev) => ({
        ...prev,
        ...patch,
      }));
    }
  };

  const handleTransientUpdate = (patch: Partial<RlcTransientState>) => {
    if (onTransientChange) {
      onTransientChange((prev) => ({
        ...prev,
        ...patch,
      }));
    }
  };

  const handleSetResonantFrequency = () => {
    if (metrics.resonantFrequencyHz !== null && metrics.isResonanceApplicable) {
      handleUpdate({ frequency: parseFloat(metrics.resonantFrequencyHz.toFixed(2)) });
    }
  };

  const isResistorBypassed = topology.resistor === 'bypassed';
  const isInductorBypassed = topology.inductor === 'bypassed';
  const isCapacitorRemoved = topology.capacitor === 'removed';
  const isCapacitorBypassed = topology.capacitor === 'bypassed';

  return (
    <div className="h-full flex flex-col justify-between p-2.5 gap-2 bg-slate-50 dark:bg-[#0b101c] border-l border-slate-200 dark:border-slate-800 text-xs font-mono select-none overflow-hidden">
      {/* Header with Title and Reset */}
      <div className="shrink-0 flex items-center justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
          <Sliders className="w-3.5 h-3.5 text-cyan-500" />
          <span>Circuit Parameters</span>
          {simulationMode === 'transient' && (
            <span className="px-1.5 py-0.2 rounded text-[9.5px] bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30">
              Transient
            </span>
          )}
        </div>
        <button
          onClick={onResetToDefault}
          title="Reset circuit configuration to default (120 V, 60 Hz, 100 Ω, 100 mH, 100 µF, all enabled)"
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 text-[11px] transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Parameter Cards with Independent Scrolling */}
      <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
        {/* 1. AC Source Controls */}
        <div
          ref={sourceRef}
          onClick={() => onSelectComponent('source')}
          className={`p-2 rounded-lg border transition-all ${
            activeComponent === 'source'
              ? 'bg-cyan-50/50 dark:bg-cyan-950/20 border-cyan-500 shadow-sm'
              : 'bg-white dark:bg-[#0d1424] border-slate-200 dark:border-slate-800/70'
          }`}
        >
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100 dark:border-slate-800">
            <span className="font-bold text-sky-600 dark:text-sky-400 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              <span>AC Voltage Source</span>
            </span>
            <span className="text-[10px] text-slate-400">Peak: {metrics.vSourcePeak.toFixed(1)} V</span>
          </div>

          <div className="space-y-1.5">
            {/* Voltage RMS Slider & Input */}
            <div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Voltage (V RMS)</span>
                <input
                  type="number"
                  min="0"
                  max="480"
                  step="1"
                  value={config.vSourceRms}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0) handleUpdate({ vSourceRms: val });
                  }}
                  className="w-16 px-1 py-0.5 text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded outline-none text-slate-800 dark:text-slate-200"
                />
              </div>
              <input
                type="range"
                min="0"
                max="240"
                step="1"
                value={config.vSourceRms}
                onChange={(e) => handleUpdate({ vSourceRms: parseFloat(e.target.value) })}
                className="w-full accent-sky-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded cursor-pointer"
              />
            </div>

            {/* Frequency Slider & Input */}
            <div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Frequency (Hz)</span>
                <input
                  type="number"
                  min="0.1"
                  max="500"
                  step="0.1"
                  value={config.frequency}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) handleUpdate({ frequency: val });
                  }}
                  className="w-16 px-1 py-0.5 text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded outline-none text-slate-800 dark:text-slate-200"
                />
              </div>
              <input
                type="range"
                min="1"
                max="200"
                step="0.5"
                value={config.frequency}
                onChange={(e) => handleUpdate({ frequency: parseFloat(e.target.value) })}
                className="w-full accent-sky-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded cursor-pointer"
              />
            </div>
            {/* Phase Angle Slider & Input */}
            <div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Phase Angle (°)</span>
                <input
                  type="number"
                  min="-180"
                  max="180"
                  step="1"
                  value={config.vSourcePhaseDeg ?? 0}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) handleUpdate({ vSourcePhaseDeg: val });
                  }}
                  className="w-16 px-1 py-0.5 text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded outline-none text-slate-800 dark:text-slate-200"
                />
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={config.vSourcePhaseDeg ?? 0}
                onChange={(e) => handleUpdate({ vSourcePhaseDeg: parseFloat(e.target.value) })}
                className="w-full accent-sky-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* 2. Resistor Controls & Enable/Bypass Toggle */}
        <div
          ref={resistorRef}
          onClick={() => onSelectComponent('resistor')}
          className={`p-2 rounded-lg border transition-all ${
            activeComponent === 'resistor'
              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500 shadow-sm'
              : 'bg-white dark:bg-[#0d1424] border-slate-200 dark:border-slate-800/70'
          }`}
        >
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Resistor (R)
              </span>
              {isResistorBypassed ? (
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border border-slate-300 dark:border-slate-700">
                  Bypassed (Wire)
                </span>
              ) : config.resistance === 0 ? (
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/30">
                  0 Ω (Short)
                </span>
              ) : null}
            </div>

            {/* Enable / Bypass Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded p-0.5 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTopologyUpdate({ resistor: 'enabled' });
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  !isResistorBypassed
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Enabled
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTopologyUpdate({ resistor: 'bypassed' });
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  isResistorBypassed
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Bypassed
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">
                {isResistorBypassed ? 'Configured R (Ω)' : 'Resistance (Ω)'}
              </span>
              <input
                type="number"
                min="0"
                max="1000"
                step="1"
                value={config.resistance}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0) handleUpdate({ resistance: val });
                }}
                className="w-16 px-1 py-0.5 text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded outline-none text-slate-800 dark:text-slate-200"
              />
            </div>
            <input
              type="range"
              min="0"
              max="300"
              step="1"
              value={config.resistance}
              onChange={(e) => handleUpdate({ resistance: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
              <span>V_R drop: {isResistorBypassed ? '0.0 V' : `${metrics.vResistorRms.toFixed(1)} V RMS`}</span>
              {isResistorBypassed && <span className="text-amber-500">Value preserved for re-enable</span>}
            </div>
          </div>
        </div>

        {/* 3. Inductor Controls & Enable/Bypass Toggle */}
        <div
          ref={inductorRef}
          onClick={() => onSelectComponent('inductor')}
          className={`p-2 rounded-lg border transition-all ${
            activeComponent === 'inductor'
              ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-500 shadow-sm'
              : 'bg-white dark:bg-[#0d1424] border-slate-200 dark:border-slate-800/70'
          }`}
        >
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-amber-600 dark:text-amber-400">
                Inductor (L)
              </span>
              {isInductorBypassed ? (
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border border-slate-300 dark:border-slate-700">
                  Bypassed (Wire)
                </span>
              ) : config.inductanceMh === 0 ? (
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/30">
                  0 mH (Short)
                </span>
              ) : null}
            </div>

            {/* Enable / Bypass Toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded p-0.5 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTopologyUpdate({ inductor: 'enabled' });
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  !isInductorBypassed
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Enabled
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTopologyUpdate({ inductor: 'bypassed' });
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  isInductorBypassed
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Bypassed
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">
                {isInductorBypassed ? 'Configured L (mH)' : 'Inductance (mH)'}
              </span>
              <input
                type="number"
                min="0"
                max="1000"
                step="1"
                value={config.inductanceMh}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0) handleUpdate({ inductanceMh: val });
                }}
                className="w-16 px-1 py-0.5 text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded outline-none text-slate-800 dark:text-slate-200"
              />
            </div>
            <input
              type="range"
              min="0"
              max="300"
              step="1"
              value={config.inductanceMh}
              onChange={(e) => handleUpdate({ inductanceMh: parseFloat(e.target.value) })}
              className="w-full accent-amber-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
              <span>{isInductorBypassed ? 'X_L = 0.0 Ω' : `X_L = ${metrics.xL.toFixed(1)} Ω`}</span>
              {isInductorBypassed && <span className="text-amber-500">Value preserved for re-enable</span>}
            </div>
          </div>
        </div>

        {/* 4. Capacitor Controls & Enable/Removed/Bypassed Controls */}
        <div
          ref={capacitorRef}
          onClick={() => onSelectComponent('capacitor')}
          className={`p-2 rounded-lg border transition-all ${
            activeComponent === 'capacitor'
              ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-500 shadow-sm'
              : 'bg-white dark:bg-[#0d1424] border-slate-200 dark:border-slate-800/70'
          }`}
        >
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-purple-600 dark:text-purple-400">
                Capacitor (C)
              </span>
              {isCapacitorRemoved ? (
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/30">
                  Removed (Open)
                </span>
              ) : isCapacitorBypassed ? (
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border border-slate-300 dark:border-slate-700">
                  Bypassed (Wire)
                </span>
              ) : config.capacitanceUf === 0 ? (
                <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-500 font-bold border border-rose-500/30">
                  0 µF (Open)
                </span>
              ) : null}
            </div>

            {/* 3-State Toggle: Enabled | Removed (Open) | Bypassed (Wire) */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded p-0.5 border border-slate-200 dark:border-slate-800 gap-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTopologyUpdate({ capacitor: 'enabled' });
                }}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  topology.capacitor === 'enabled'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Enabled
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTopologyUpdate({ capacitor: 'removed' });
                }}
                title="Removes capacitor from series loop, creating an open circuit (i = 0)"
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  isCapacitorRemoved
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Removed
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTopologyUpdate({ capacitor: 'bypassed' });
                }}
                title="Bypasses capacitor with ideal wire (allows RL and pure R circuits)"
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  isCapacitorBypassed
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Bypassed
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-slate-500 dark:text-slate-400">
                {isCapacitorRemoved || isCapacitorBypassed ? 'Configured C (µF)' : 'Capacitance (µF)'}
              </span>
              <input
                type="number"
                min="0"
                max="1000"
                step="1"
                value={config.capacitanceUf}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val >= 0) handleUpdate({ capacitanceUf: val });
                }}
                className="w-16 px-1 py-0.5 text-right font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded outline-none text-slate-800 dark:text-slate-200"
              />
            </div>
            <input
              type="range"
              min="0"
              max="300"
              step="1"
              value={config.capacitanceUf}
              onChange={(e) => handleUpdate({ capacitanceUf: parseFloat(e.target.value) })}
              className="w-full accent-purple-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
              <span>
                {isCapacitorRemoved || config.capacitanceUf === 0
                  ? 'X_C = ∞ (Open Circuit)'
                  : isCapacitorBypassed
                  ? 'X_C = 0.0 Ω (Bypassed Wire)'
                  : `X_C = ${metrics.xC.toFixed(1)} Ω`}
              </span>
              {(isCapacitorRemoved || isCapacitorBypassed) && (
                <span className="text-purple-500">Value preserved for re-enable</span>
              )}
            </div>
          </div>
        </div>

        {/* 5. Transient Mode Initial Conditions & Settings Card */}
        {simulationMode === 'transient' && (
          <div className="p-2 rounded-lg border border-amber-300 dark:border-amber-800/80 bg-amber-50/40 dark:bg-amber-950/20">
            <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-amber-200 dark:border-amber-900/60">
              <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                <span>Initial Conditions & View</span>
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">t = 0 s</span>
            </div>

            <div className="space-y-1.5">
              {/* Initial V_C(0) */}
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-600 dark:text-slate-300">Initial V_C (V)</span>
                <input
                  type="number"
                  min="-500"
                  max="500"
                  step="1"
                  value={transientState.initialConditions.initialVc}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      handleTransientUpdate({
                        initialConditions: {
                          ...transientState.initialConditions,
                          initialVc: val,
                        },
                      });
                    }
                  }}
                  className="w-16 px-1 py-0.5 text-right font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded outline-none text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Initial I_L(0) */}
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-600 dark:text-slate-300">Initial I_L (A)</span>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  step="0.1"
                  value={transientState.initialConditions.initialIl}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      handleTransientUpdate({
                        initialConditions: {
                          ...transientState.initialConditions,
                          initialIl: val,
                        },
                      });
                    }
                  }}
                  className="w-16 px-1 py-0.5 text-right font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded outline-none text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Visible Time Window Control */}
              <div className="pt-1">
                <div className="flex justify-between items-center text-[11px] mb-1">
                  <span className="text-slate-600 dark:text-slate-300">Visible Time Window</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {transientState.visibleTimeWindowMs} ms
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[20, 50, 100, 200].map((ms) => (
                    <button
                      key={ms}
                      type="button"
                      onClick={() => handleTransientUpdate({ visibleTimeWindowMs: ms })}
                      className={`py-0.5 rounded text-[10px] font-bold border transition-colors ${
                        transientState.visibleTimeWindowMs === ms
                          ? 'bg-amber-500 text-slate-950 border-amber-500'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                      }`}
                    >
                      {ms} ms
                    </button>
                  ))}
                </div>
              </div>

              {/* Overlay Steady-State Reference Checkbox */}
              <div className="pt-1.5 border-t border-amber-200 dark:border-amber-900/60">
                <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] text-slate-700 dark:text-slate-300 font-semibold select-none">
                  <input
                    type="checkbox"
                    checked={transientState.overlaySteadyState}
                    onChange={(e) => handleTransientUpdate({ overlaySteadyState: e.target.checked })}
                    className="accent-amber-500 w-3.5 h-3.5 rounded"
                  />
                  <Eye className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Overlay Steady-State Reference</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resonance Action Button */}
      <div className="shrink-0 pt-1.5 border-t border-slate-200 dark:border-slate-800/80">
        <button
          onClick={handleSetResonantFrequency}
          disabled={!metrics.isResonanceApplicable}
          title={
            metrics.isResonanceApplicable
              ? `Set source frequency to resonant frequency ${metrics.f0Display}`
              : 'Resonance requires positive finite inductance (L > 0) and capacitance (C > 0)'
          }
          className={`w-full py-1.5 px-2 rounded flex items-center justify-center gap-1.5 transition-all text-[11px] font-bold ${
            !metrics.isResonanceApplicable
              ? 'bg-slate-200/60 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-800'
              : metrics.isResonant
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-md shadow-cyan-500/20 active:scale-95 cursor-pointer'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">
            {!metrics.isResonanceApplicable
              ? 'Resonance N/A (Requires L > 0 & C > 0)'
              : metrics.isResonant
              ? `At Resonance (f₀ = ${metrics.f0Display})`
              : `Find Resonance (Set f = ${metrics.f0Display})`}
          </span>
        </button>
      </div>
    </div>
  );
};
