import React from 'react';
import { HarmonicPercentages } from '../types/waveform';
import { Layers, RotateCcw } from 'lucide-react';

interface HarmonicControlsProps {
  fundamentalFrequency: number;
  fundamentalAmplitude: number;
  harmonics: HarmonicPercentages;
  onHarmonicsChange: (harmonics: HarmonicPercentages) => void;
  showHarmonicsBreakdown?: boolean;
  onToggleBreakdown?: () => void;
}

export const HarmonicControls: React.FC<HarmonicControlsProps> = ({
  fundamentalFrequency,
  fundamentalAmplitude,
  harmonics,
  onHarmonicsChange,
  showHarmonicsBreakdown,
  onToggleBreakdown,
}) => {
  const safeHarmonics = harmonics || { second: 0, third: 0, fourth: 0 };

  const updateHarmonic = (harmonicKey: keyof HarmonicPercentages, value: number) => {
    onHarmonicsChange({
      ...safeHarmonics,
      [harmonicKey]: value,
    });
  };

  const handleResetHarmonics = () => {
    onHarmonicsChange({
      second: 0,
      third: 0,
      fourth: 0,
    });
  };

  const harmonicConfigs = [
    {
      key: 'second' as const,
      name: '2nd Harmonic',
      multiplier: 2,
      textColor: 'text-purple-600 dark:text-purple-400',
      accentColor: 'accent-purple-500',
      badgeBg: 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800/50',
      value: safeHarmonics.second,
    },
    {
      key: 'third' as const,
      name: '3rd Harmonic',
      multiplier: 3,
      textColor: 'text-pink-600 dark:text-pink-400',
      accentColor: 'accent-pink-500',
      badgeBg: 'bg-pink-100 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-800/50',
      value: safeHarmonics.third,
    },
    {
      key: 'fourth' as const,
      name: '4th Harmonic',
      multiplier: 4,
      textColor: 'text-amber-600 dark:text-amber-400',
      accentColor: 'accent-amber-500',
      badgeBg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/50',
      value: safeHarmonics.fourth,
    },
  ];

  return (
    <div className="h-full flex flex-col justify-between p-3.5 bg-slate-50 dark:bg-[#0b101c] border-l border-slate-200 dark:border-slate-800 select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
            Harmonics
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onToggleBreakdown && (
            <button
              onClick={onToggleBreakdown}
              title="Toggle individual harmonic component traces"
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                showHarmonicsBreakdown
                  ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border-cyan-500/40'
                  : 'text-slate-400 dark:text-slate-500 border-slate-300 dark:border-slate-800 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Ghost
            </button>
          )}

          {(safeHarmonics.second > 0 || safeHarmonics.third > 0 || safeHarmonics.fourth > 0) && (
            <button
              onClick={handleResetHarmonics}
              title="Reset all harmonics to 0%"
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Harmonic Sliders (Stacked Vertically) */}
      <div className="flex-1 flex flex-col justify-around py-2 gap-2">
        {harmonicConfigs.map((cfg) => {
          const harmonicFreq = fundamentalFrequency * cfg.multiplier;
          const calculatedAmp = fundamentalAmplitude * (cfg.value / 100);

          return (
            <div
              key={cfg.key}
              className="flex flex-col gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#080c14]/90 p-2.5 shadow-sm"
            >
              <div className="flex items-center justify-between font-mono text-[11px]">
                <span className={`font-bold ${cfg.textColor}`}>{cfg.name}</span>
                <span className="text-slate-500 dark:text-slate-400 font-semibold">{harmonicFreq} Hz</span>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-500">Mag:</span>
                <span className={`px-1.5 py-0.2 rounded font-bold border text-[10px] ${cfg.badgeBg}`}>
                  {cfg.value}%
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={cfg.value}
                onChange={(e) => updateHarmonic(cfg.key, Number(e.target.value))}
                className={`w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer ${cfg.accentColor} focus:outline-none`}
              />

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-500">
                <span>0%</span>
                <span className="font-medium text-slate-600 dark:text-slate-400">{calculatedAmp.toFixed(2)} pu</span>
                <span>50%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer subtle tip */}
      <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 text-center pt-1 border-t border-slate-200 dark:border-slate-800/60">
        Frequencies locked to n × f₀
      </div>
    </div>
  );
};
