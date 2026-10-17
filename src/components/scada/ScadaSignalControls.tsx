import React, { useState } from 'react';
import { WaveformState } from '../../types/waveform';
import { formatWaveformEquation } from '../../model/waveformModel';
import { ScadaWaveformControlsModal } from './ScadaWaveformControlsModal';
import { Sliders, Zap, Edit3 } from 'lucide-react';

interface ScadaSignalControlsProps {
  waveformState: WaveformState;
  onUpdateWaveform: (updater: (prev: WaveformState) => WaveformState) => void;
}

export const ScadaSignalControls: React.FC<ScadaSignalControlsProps> = ({
  waveformState,
  onUpdateWaveform,
}) => {
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const handleAmplitudeChange = (amp: number) => {
    onUpdateWaveform((prev) => {
      const eq = formatWaveformEquation(
        prev.fundamentalFrequency,
        amp,
        prev.harmonics,
        prev.customTerms,
        prev.dcOffset,
        prev.phase
      );
      return {
        ...prev,
        fundamentalAmplitude: amp,
        equation: eq,
      };
    });
  };

  const handleFrequencyChange = (freq: number) => {
    onUpdateWaveform((prev) => {
      const eq = formatWaveformEquation(
        freq,
        prev.fundamentalAmplitude,
        prev.harmonics,
        prev.customTerms,
        prev.dcOffset,
        prev.phase
      );
      return {
        ...prev,
        fundamentalFrequency: freq,
        equation: eq,
      };
    });
  };

  const handleHarmonicChange = (second: number, third: number, fourth: number = 0) => {
    onUpdateWaveform((prev) => {
      const newHarmonics = {
        second,
        third,
        fourth,
      };
      const eq = formatWaveformEquation(
        prev.fundamentalFrequency,
        prev.fundamentalAmplitude,
        newHarmonics,
        prev.customTerms,
        prev.dcOffset,
        prev.phase
      );
      return {
        ...prev,
        harmonics: newHarmonics,
        equation: eq,
      };
    });
  };

  return (
    <>
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] p-3 shadow-md flex flex-col justify-between gap-2.5 h-full">
        {/* Header with Title and Prominent Customize / Equation Trigger Button */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-cyan-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 font-mono">
              Signal Controls
            </h3>
          </div>

          {/* Clearly Identifiable Modal Trigger Button */}
          <button
            onClick={() => setIsModalOpen(true)}
            title="Open waveform customization and equation editor"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold transition-all shadow-sm hover:scale-[1.02]"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-500" />
            <span>Edit Waveform</span>
          </button>
        </div>

        {/* Sliders Grid: Amplitude & Frequency with live values */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
          {/* Amplitude */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-slate-600 dark:text-slate-400">Amplitude:</label>
              <span className="font-bold text-cyan-600 dark:text-cyan-300">
                {waveformState.fundamentalAmplitude.toFixed(2)} pu
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2.0}
              step={0.05}
              value={waveformState.fundamentalAmplitude}
              onChange={(e) => handleAmplitudeChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>

          {/* Frequency */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label className="text-slate-600 dark:text-slate-400">Frequency (f₀):</label>
              <span className="font-bold text-cyan-600 dark:text-cyan-300">
                {waveformState.fundamentalFrequency} Hz
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={120}
              step={1}
              value={waveformState.fundamentalFrequency}
              onChange={(e) => handleFrequencyChange(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
        </div>

        {/* Quick Test Disturbance Events */}
        <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-200 dark:border-slate-800/80 text-[10px] font-mono">
          <div className="flex items-center gap-1 text-slate-400">
            <Zap className="w-3 h-3 text-amber-500" />
            <span className="hidden sm:inline">Events:</span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => {
                handleAmplitudeChange(1.0);
                handleHarmonicChange(0, 0, 0);
              }}
              className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              Nominal
            </button>
            <button
              onClick={() => handleAmplitudeChange(1.5)}
              className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-colors"
            >
              Step 1.5pu
            </button>
            <button
              onClick={() => handleAmplitudeChange(0.65)}
              className="px-1.5 py-0.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 transition-colors"
            >
              Sag 0.65pu
            </button>
            <button
              onClick={() => handleHarmonicChange(0, 30, 0)}
              className="px-1.5 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 transition-colors"
            >
              30% 3rd
            </button>
          </div>
        </div>
      </div>

      {/* Full Waveform & Equation Modal */}
      <ScadaWaveformControlsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        waveformState={waveformState}
        onUpdateWaveform={onUpdateWaveform}
      />
    </>
  );
};
