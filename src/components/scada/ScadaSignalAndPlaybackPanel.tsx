import React, { useState } from 'react';
import { WaveformState, PlaybackState, HarmonicPercentages } from '../../types/waveform';
import { formatWaveformEquation } from '../../model/waveformModel';
import { ScadaWaveformControlsModal } from './ScadaWaveformControlsModal';
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Gauge,
  Edit3,
  Zap,
} from 'lucide-react';

interface ScadaSignalAndPlaybackPanelProps {
  waveformState: WaveformState;
  onUpdateWaveform: (updater: (prev: WaveformState) => WaveformState) => void;
  playback: PlaybackState;
  playbackSpeed: number;
  onSetPlaybackSpeed: (speed: number) => void;
  onTogglePlay: () => void;
  onResetTime: () => void;
}

export const ScadaSignalAndPlaybackPanel: React.FC<ScadaSignalAndPlaybackPanelProps> = ({
  waveformState,
  onUpdateWaveform,
  playback,
  playbackSpeed,
  onSetPlaybackSpeed,
  onTogglePlay,
  onResetTime,
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
      const newHarmonics: HarmonicPercentages = {
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
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] p-2.5 sm:p-3 shadow-md flex flex-col justify-between gap-2 h-full">
        {/* Row 1: Playback Controls (Play/Pause, Speed, Reset, Clock) */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2">
          {/* Play/Pause & Speed & Reset */}
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePlay}
              className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg font-mono text-xs font-bold transition-all shadow-sm ${
                playback?.isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
              }`}
            >
              {playback?.isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play</span>
                </>
              )}
            </button>

            {/* Speed Dropdown */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-800 text-xs font-mono">
              <Gauge className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              <select
                value={playbackSpeed}
                onChange={(e) => onSetPlaybackSpeed(parseFloat(e.target.value))}
                aria-label="Playback Speed"
                className="bg-transparent text-slate-800 dark:text-slate-200 font-bold outline-none cursor-pointer text-xs"
              >
                <option value="0.1" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">0.1×</option>
                <option value="0.25" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">0.25×</option>
                <option value="0.5" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">0.5×</option>
                <option value="1" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">1×</option>
              </select>
            </div>

            {/* Reset Button */}
            <button
              onClick={onResetTime}
              title="Reset Simulation Time"
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-300 dark:border-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Simulation Clock Readout */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 text-[11px]">
              <Clock className="w-3 h-3 text-slate-400" />
              <span className="text-slate-500">t:</span>
              <span className="text-slate-800 dark:text-slate-200 font-bold min-w-[58px] text-right">
                {((playback?.currentTime ?? 0) * 1000).toFixed(1)} ms
              </span>
            </div>

            <span
              className={`inline-block w-2 h-2 rounded-full ${
                playback?.isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'
              }`}
            />
          </div>
        </div>

        {/* Row 2: Amplitude & Frequency Sliders + Full Customization Modal Trigger */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-xs items-center">
          {/* Amplitude Slider */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[11px]">
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

          {/* Frequency Slider */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <label className="text-slate-600 dark:text-slate-400">Frequency:</label>
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

          {/* Full Customization Modal Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              title="Open waveform customization and equation editor"
              className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold transition-all shadow-sm hover:scale-[1.01]"
            >
              <Edit3 className="w-3.5 h-3.5 text-cyan-500" />
              <span>Edit Waveform</span>
            </button>
        </div>

        {/* Row 3: Quick Disturbance Events */}
        <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-200 dark:border-slate-800/80 text-[10px] font-mono">
          <div className="flex items-center gap-1 text-slate-400">
            <Zap className="w-3 h-3 text-amber-500" />
            <span className="hidden sm:inline">Test Events:</span>
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

      {/* Full Modal for Equation & Harmonics Customization */}
      <ScadaWaveformControlsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        waveformState={waveformState}
        onUpdateWaveform={onUpdateWaveform}
      />
    </>
  );
};
