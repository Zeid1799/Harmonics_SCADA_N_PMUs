import React, { useState } from 'react';
import {
  ThreePhaseState,
  SinglePhaseConfig,
  ThreePhasePreset,
} from '../types/threePhase';
import { THREE_PHASE_PRESETS } from '../model/threePhaseModel';
import { Sliders, RotateCcw, Sparkles } from 'lucide-react';

interface ThreePhaseControlsProps {
  state: ThreePhaseState;
  onChange: (updater: (prev: ThreePhaseState) => ThreePhaseState) => void;
  onResetToBalanced: () => void;
}

export const ThreePhaseControls: React.FC<ThreePhaseControlsProps> = ({
  state,
  onChange,
  onResetToBalanced,
}) => {
  const [selectedPhase, setSelectedPhase] = useState<'A' | 'B' | 'C'>('A');

  const updatePhase = (
    phaseKey: 'phaseA' | 'phaseB' | 'phaseC',
    patch: Partial<SinglePhaseConfig>
  ) => {
    onChange((prev) => {
      // If frequency is changed and syncFrequencies is on, update all frequencies
      if (patch.frequency !== undefined && prev.syncFrequencies) {
        return {
          ...prev,
          phaseA: { ...prev.phaseA, frequency: patch.frequency },
          phaseB: { ...prev.phaseB, frequency: patch.frequency },
          phaseC: { ...prev.phaseC, frequency: patch.frequency },
        };
      }

      return {
        ...prev,
        [phaseKey]: {
          ...prev[phaseKey],
          ...patch,
        },
      };
    });
  };

  const activeKey = selectedPhase === 'A' ? 'phaseA' : selectedPhase === 'B' ? 'phaseB' : 'phaseC';
  const activeConfig = state[activeKey];

  const phaseColorClass =
    selectedPhase === 'A'
      ? 'text-red-600 dark:text-red-400 border-red-500'
      : selectedPhase === 'B'
      ? 'text-yellow-600 dark:text-yellow-400 border-yellow-500'
      : 'text-blue-600 dark:text-blue-400 border-blue-500';

  const phaseBadgeClass =
    selectedPhase === 'A'
      ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30'
      : selectedPhase === 'B'
      ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30'
      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30';

  return (
    <div className="h-full flex flex-col justify-between p-3 bg-slate-50 dark:bg-[#0b101c] border-l border-slate-200 dark:border-slate-800 select-none text-xs font-mono">
      {/* Top Header: Phase Selector Tabs & Reset */}
      <div className="flex flex-col gap-2 pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            <Sliders className="w-3.5 h-3.5 text-cyan-500" />
            <span>3-Phase Controls</span>
          </div>

          <button
            onClick={onResetToBalanced}
            title="Reset to Balanced Ideal System"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-[10px]"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Balanced</span>
          </button>
        </div>

        {/* Phase Tabs: Phase A | Phase B | Phase C */}
        <div className="grid grid-cols-3 gap-1 bg-slate-200 dark:bg-slate-900/90 p-1 rounded-lg">
          <button
            onClick={() => setSelectedPhase('A')}
            className={`py-1 rounded font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
              selectedPhase === 'A'
                ? 'bg-white dark:bg-[#161f33] text-red-600 dark:text-red-400 shadow-sm border border-red-500/30'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0"></span>
            <span>Phase A</span>
          </button>

          <button
            onClick={() => setSelectedPhase('B')}
            className={`py-1 rounded font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
              selectedPhase === 'B'
                ? 'bg-white dark:bg-[#161f33] text-yellow-600 dark:text-yellow-400 shadow-sm border border-yellow-500/30'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0"></span>
            <span>Phase B</span>
          </button>

          <button
            onClick={() => setSelectedPhase('C')}
            className={`py-1 rounded font-bold transition-all text-center flex items-center justify-center gap-1.5 ${
              selectedPhase === 'C'
                ? 'bg-white dark:bg-[#161f33] text-blue-600 dark:text-blue-400 shadow-sm border border-blue-500/30'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
            <span>Phase C</span>
          </button>
        </div>
      </div>

      {/* Main Sliders for the Selected Phase */}
      <div className="flex-1 flex flex-col justify-around py-1.5 gap-2.5 overflow-y-auto">
        {/* Phase Enable & Summary Banner */}
        <div className="flex items-center justify-between bg-white dark:bg-[#080c14]/90 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${phaseBadgeClass}`}>
              Phase {selectedPhase}
            </span>
            <span className="text-[10px] text-slate-500">
              V_rms: {(activeConfig.amplitude / Math.SQRT2).toFixed(2)} pu
            </span>
          </div>

          <label className="flex items-center gap-1.5 cursor-pointer text-[11px]">
            <input
              type="checkbox"
              checked={activeConfig.enabled}
              onChange={(e) => updatePhase(activeKey, { enabled: e.target.checked })}
              className="rounded accent-cyan-500"
            />
            <span className={activeConfig.enabled ? 'text-emerald-500 font-semibold' : 'text-slate-400'}>
              {activeConfig.enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        {/* 1. Voltage Amplitude (Peak pu) */}
        <div className="flex flex-col gap-1 bg-white dark:bg-[#080c14]/90 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-semibold">Peak Voltage:</span>
            <span className="font-bold text-cyan-600 dark:text-cyan-300">
              {activeConfig.amplitude.toFixed(2)} pu
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2.0}
            step={0.01}
            value={activeConfig.amplitude}
            onChange={(e) => updatePhase(activeKey, { amplitude: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-[9px] text-slate-400">
            <span>0.0 pu</span>
            <span>RMS: {(activeConfig.amplitude / Math.SQRT2).toFixed(2)} pu</span>
            <span>2.0 pu</span>
          </div>
        </div>

        {/* 2. Phase Angle (degrees) */}
        <div className="flex flex-col gap-1 bg-white dark:bg-[#080c14]/90 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-semibold">Phase Angle:</span>
            <span className={`font-bold ${phaseColorClass}`}>
              {activeConfig.phaseDeg}°
            </span>
          </div>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={activeConfig.phaseDeg}
            onChange={(e) => updatePhase(activeKey, { phaseDeg: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex justify-between text-[9px] text-slate-400">
            <span>-180°</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => updatePhase(activeKey, { phaseDeg: 0 })}
                className="hover:text-slate-200 px-1 rounded bg-slate-100 dark:bg-slate-800"
              >
                0°
              </button>
              <button
                onClick={() => updatePhase(activeKey, { phaseDeg: -120 })}
                className="hover:text-slate-200 px-1 rounded bg-slate-100 dark:bg-slate-800"
              >
                -120°
              </button>
              <button
                onClick={() => updatePhase(activeKey, { phaseDeg: 120 })}
                className="hover:text-slate-200 px-1 rounded bg-slate-100 dark:bg-slate-800"
              >
                +120°
              </button>
            </div>
            <span>+180°</span>
          </div>
        </div>

        {/* 3. Frequency (Hz) */}
        <div className="flex flex-col gap-1 bg-white dark:bg-[#080c14]/90 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-semibold">Frequency:</span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 dark:text-slate-200">{activeConfig.frequency} Hz</span>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={120}
            step={1}
            value={activeConfig.frequency}
            onChange={(e) => updatePhase(activeKey, { frequency: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="flex items-center justify-between text-[9px] text-slate-400">
            <span>1 Hz</span>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={state.syncFrequencies}
                onChange={(e) => onChange((prev) => ({ ...prev, syncFrequencies: e.target.checked }))}
                className="rounded accent-cyan-500"
              />
              <span>Sync All Phases</span>
            </label>
            <span>120 Hz</span>
          </div>
        </div>

        {/* 4. Connected Resistive Load (Ohms) */}
        <div className="flex flex-col gap-1 bg-white dark:bg-[#080c14]/90 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-slate-600 dark:text-slate-300 font-semibold">Resistive Load (R):</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {activeConfig.resistance.toFixed(1)} Ω
            </span>
          </div>
          <input
            type="range"
            min={2}
            max={50}
            step={0.5}
            value={activeConfig.resistance}
            onChange={(e) => updatePhase(activeKey, { resistance: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[9px] text-slate-400">
            <span>2 Ω (Heavy)</span>
            <span>I_pk ≈ {(activeConfig.amplitude / activeConfig.resistance).toFixed(2)} A</span>
            <span>50 Ω (Light)</span>
          </div>
        </div>
      </div>

      {/* Imbalance Presets Quick Menu */}
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex flex-col gap-1.5">
        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase">
          <Sparkles className="w-3 h-3 text-cyan-500" />
          <span>Imbalance Presets</span>
        </div>
        <select
          onChange={(e) => {
            const found = THREE_PHASE_PRESETS.find((p: ThreePhasePreset) => p.id === e.target.value);
            if (found) {
              onChange((prev) => found.apply(prev));
            }
          }}
          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-2 py-1 text-[11px] text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
        >
          <option value="">Select preset to demonstrate...</option>
          {THREE_PHASE_PRESETS.map((p: ThreePhasePreset) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
