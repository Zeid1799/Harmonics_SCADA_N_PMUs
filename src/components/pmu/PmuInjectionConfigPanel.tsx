import React, { useState } from 'react';
import {
  InjectedDisturbance,
  DisturbanceType,
  DISTURBANCE_PALETTE,
} from '../../types/pmu';
import { AppTheme } from '../../types/settings';
import { Zap, Plus, Trash2 } from 'lucide-react';

interface PmuInjectionConfigPanelProps {
  nominalFundamental: number;
  disturbances: InjectedDisturbance[];
  onUpdateDisturbances: (updater: (prev: InjectedDisturbance[]) => InjectedDisturbance[]) => void;
  theme?: AppTheme;
}

const assignNextColor = (existing: InjectedDisturbance[]): string => {
  const used = new Set(existing.map((d) => d.color).filter(Boolean));
  const free = DISTURBANCE_PALETTE.find((p) => !used.has(p.id));
  return free ? free.id : DISTURBANCE_PALETTE[existing.length % DISTURBANCE_PALETTE.length].id;
};

export const PmuInjectionConfigPanel: React.FC<PmuInjectionConfigPanelProps> = ({
  nominalFundamental,
  disturbances,
  onUpdateDisturbances,
}) => {
  // Injected disturbance builder form state
  const [newType, setNewType] = useState<DisturbanceType>('am');
  const [newAdditiveTarget, setNewAdditiveTarget] = useState<'lower' | 'upper'>('lower');
  const [newFreq, setNewFreq] = useState<number>(5);
  const [newAmp, setNewAmp] = useState<number>(0.20);

  const handleRemoveAllDisturbances = () => {
    onUpdateDisturbances(() => []);
  };

  const handleAddDisturbance = () => {
    const nextId = `dist-${Date.now()}`;
    const f0 = nominalFundamental;
    const isAdditive = newType === 'additive';
    const targetFreq = newAdditiveTarget === 'upper' ? f0 + newFreq : Math.max(0.1, f0 - newFreq);
    const nextName = isAdditive
      ? `D${disturbances.length + 1} (${targetFreq}Hz)`
      : `D${disturbances.length + 1} (AM ±${newFreq}Hz)`;

    onUpdateDisturbances((prev) => {
      const nextColor = assignNextColor(prev);
      return [
        ...prev,
        {
          id: nextId,
          name: nextName,
          type: newType,
          modulationFrequency: newFreq,
          additiveTarget: isAdditive ? newAdditiveTarget : undefined,
          amplitude: newAmp,
          enabled: true,
          color: nextColor,
        },
      ];
    });
  };

  const handleAddPreset = (
    freq: number,
    amp: number = 0.20,
    type: DisturbanceType = 'am',
    additiveTarget: 'lower' | 'upper' = 'lower',
    customLabel?: string,
    presetColor?: string
  ) => {
    const nextId = `dist-${Date.now()}`;
    const f0 = nominalFundamental;
    const targetFreq = additiveTarget === 'upper' ? f0 + freq : Math.max(0.1, f0 - freq);
    const defaultLabel = type === 'additive'
      ? `Preset (${targetFreq}Hz)`
      : `Preset (AM ±${freq}Hz)`;
    const nextName = customLabel || defaultLabel;

    onUpdateDisturbances((prev) => {
      const nextColor = presetColor || assignNextColor(prev);
      return [
        ...prev,
        {
          id: nextId,
          name: nextName,
          type,
          modulationFrequency: freq,
          additiveTarget: type === 'additive' ? additiveTarget : undefined,
          amplitude: amp,
          enabled: true,
          color: nextColor,
        },
      ];
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] p-2.5 sm:p-3 shadow-md flex flex-col justify-between gap-1.5 select-none font-mono text-xs overflow-hidden min-w-0">
      {/* Header: Title, Remove All Injections & Add Injection Buttons */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-1.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
            <Zap className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
            Inject Disturbance
          </h3>
        </div>

        {/* Action Buttons: Remove All Injections + Add Injection */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleRemoveAllDisturbances}
            disabled={disturbances.length === 0}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all border ${
              disturbances.length === 0
                ? 'opacity-40 cursor-not-allowed text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40'
                : 'text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-500/10 active:scale-95 shadow-xs'
            }`}
            title={disturbances.length === 0 ? 'No injections configured' : 'Remove all configured disturbance injections'}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove All Injections</span>
          </button>

          <button
            type="button"
            onClick={handleAddDisturbance}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950 text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 active:scale-95 shrink-0"
            title={`Inject ${newType === 'additive' ? 'single sinusoid' : 'AM disturbance'} into signal`}
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Injection</span>
          </button>
        </div>
      </div>

      {/* Row 1: Mode & Target selection */}
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] min-w-0">
        <span className="text-slate-600 dark:text-slate-400 font-bold shrink-0">Type:</span>
        <div className="flex rounded bg-slate-100 dark:bg-slate-900 p-0.5 border border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setNewType('am')}
            className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition-all ${
              newType === 'am'
                ? 'bg-cyan-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            AM (f₀ ± Δf)
          </button>
          <button
            type="button"
            onClick={() => setNewType('additive')}
            className={`px-2 py-0.5 rounded text-[9.5px] font-bold transition-all ${
              newType === 'additive'
                ? 'bg-cyan-500 text-slate-950 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Additive Tone
          </button>
        </div>

        {newType === 'additive' && (
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            <span className="text-slate-500 dark:text-slate-400 text-[9px] shrink-0">Tone:</span>
            <button
              type="button"
              onClick={() => setNewAdditiveTarget('lower')}
              className={`px-1.5 py-0.5 rounded text-[9px] border font-bold transition-all shrink-0 ${
                newAdditiveTarget === 'lower'
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
              title={`Inject single sinusoid at ${nominalFundamental - newFreq} Hz (f0 - Δf)`}
            >
              f₀ - Δf ({nominalFundamental - newFreq}Hz)
            </button>
            <button
              type="button"
              onClick={() => setNewAdditiveTarget('upper')}
              className={`px-1.5 py-0.5 rounded text-[9px] border font-bold transition-all shrink-0 ${
                newAdditiveTarget === 'upper'
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/40'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
              title={`Inject single sinusoid at ${nominalFundamental + newFreq} Hz (f0 + Δf)`}
            >
              f₀ + Δf ({nominalFundamental + newFreq}Hz)
            </button>
          </div>
        )}
      </div>

      {/* Row 2: Sliders (Frequency & Amplitude) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 items-center min-w-0">
        {/* Frequency Slider */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/40 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-800 min-w-0">
          <span className="text-[9.5px] text-slate-500 dark:text-slate-400 shrink-0">Δf:</span>
          <input
            type="range"
            min={0.5}
            max={45}
            step={0.5}
            value={newFreq}
            onChange={(e) => setNewFreq(parseFloat(e.target.value))}
            className="flex-1 min-w-0 h-1 bg-slate-200 dark:bg-slate-800 rounded appearance-none accent-emerald-500 cursor-pointer"
          />
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 w-9 text-right shrink-0">
            {newFreq}Hz
          </span>
        </div>

        {/* Amplitude Slider */}
        <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/40 px-1.5 py-1 rounded border border-slate-200 dark:border-slate-800 min-w-0">
          <span className="text-[9.5px] text-slate-500 dark:text-slate-400 shrink-0">Amp:</span>
          <input
            type="range"
            min={0.05}
            max={1.0}
            step={0.05}
            value={newAmp}
            onChange={(e) => setNewAmp(parseFloat(e.target.value))}
            className="flex-1 min-w-0 h-1 bg-slate-200 dark:bg-slate-800 rounded appearance-none accent-cyan-500 cursor-pointer"
          />
          <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 w-11 text-right shrink-0">
            {newAmp.toFixed(2)}pu
          </span>
        </div>
      </div>

      {/* Row 3: Educational Presets Bar */}
      <div className="flex flex-wrap items-center gap-1 text-[9px] pt-1 border-t border-slate-100 dark:border-slate-800/60 min-w-0">
        <span className="text-slate-500 dark:text-slate-400 font-semibold shrink-0 mr-0.5">Presets:</span>
        <div className="flex flex-wrap items-center gap-1 min-w-0">
          <button
            onClick={() => handleAddPreset(2, 0.20, 'am', 'lower', '±2Hz AM (Z1)')}
            className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 whitespace-nowrap text-[9px]"
            title="Add 2 Hz AM disturbance (Zone 1 for both P-Class and M-Class)"
          >
            +2Hz AM (Z1)
          </button>
          <button
            onClick={() => handleAddPreset(5, 0.20, 'additive', 'lower', `${nominalFundamental - 5}Hz Tone (Z1/Z2)`)}
            className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 whitespace-nowrap text-[9px]"
            title={`Add single additive sinusoid at ${nominalFundamental - 5} Hz`}
          >
            {nominalFundamental - 5}Hz Tone
          </button>
          <button
            onClick={() => handleAddPreset(5, 0.20, 'am', 'lower', '±5Hz AM (Z1/Z2)')}
            className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 whitespace-nowrap text-[9px]"
            title="Add 5 Hz AM disturbance (Zone 1 for M-Class, Zone 2 for P-Class)"
          >
            +5Hz AM (Z1/Z2)
          </button>
          <button
            onClick={() => handleAddPreset(8, 0.15, 'additive', 'lower', `${nominalFundamental - 8}Hz Tone (Z2)`)}
            className="px-1.5 py-0.5 rounded bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/10 dark:hover:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30 whitespace-nowrap text-[9px]"
            title={`Add single additive sinusoid at ${nominalFundamental - 8} Hz (Zone 2)`}
          >
            {nominalFundamental - 8}Hz Tone
          </button>
          <button
            onClick={() => handleAddPreset(12, 0.15, 'am', 'lower', '±12Hz AM (Z2)')}
            className="px-1.5 py-0.5 rounded bg-sky-50 hover:bg-sky-100 dark:bg-sky-500/10 dark:hover:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/30 whitespace-nowrap text-[9px]"
            title="Add 12 Hz AM disturbance (Zone 2 for 30fps)"
          >
            +12Hz AM (Z2)
          </button>
          <button
            onClick={() => handleAddPreset(23, 0.20, 'additive', 'lower', `${nominalFundamental - 23}Hz Tone (Z3)`)}
            className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 whitespace-nowrap text-[9px]"
            title={`Add single additive sinusoid at ${nominalFundamental - 23} Hz (Zone 3 -> aliases to ${nominalFundamental - 7} Hz at 30 fps)`}
          >
            {nominalFundamental - 23}Hz Tone
          </button>
          <button
            onClick={() => handleAddPreset(23, 0.20, 'am', 'lower', '±23Hz AM (Z3)')}
            className="px-1.5 py-0.5 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 whitespace-nowrap text-[9px]"
            title="Add 23 Hz AM disturbance (Zone 3 for 30fps -> aliases to ±7Hz)"
          >
            +23Hz AM (Z3)
          </button>
        </div>
      </div>
    </div>
  );
};
