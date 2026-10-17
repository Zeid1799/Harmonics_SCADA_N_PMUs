import React from 'react';
import { PlaybackState } from '../types/waveform';
import { Play, Pause, RotateCcw, Clock, Gauge } from 'lucide-react';

interface PlaybackControlsProps {
  playback: PlaybackState;
  playbackSpeed: number;
  onSetPlaybackSpeed: (speed: number) => void;
  onTogglePlay: () => void;
  onResetTime: () => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  playback,
  playbackSpeed,
  onSetPlaybackSpeed,
  onTogglePlay,
  onResetTime,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] p-3 shadow-md flex flex-wrap items-center justify-between gap-3">
      {/* Play / Pause, Reset, and Playback Speed */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          onClick={onTogglePlay}
          className={`flex items-center justify-center gap-2 px-5 py-2 rounded-lg font-mono text-xs font-bold transition-all shadow-sm ${
            playback.isPlaying
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/20'
          }`}
        >
          {playback.isPlaying ? (
            <>
              <Pause className="w-4 h-4 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Play</span>
            </>
          )}
        </button>

        {/* Playback Speed dropdown right next to Play/Pause */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-800 text-xs font-mono">
          <Gauge className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span className="text-slate-500 dark:text-slate-400 text-[11px] hidden sm:inline">Speed:</span>
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

        <button
          onClick={onResetTime}
          title="Reset Simulation Time"
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-300 dark:border-slate-800 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Real-time simulation clock */}
      <div className="flex items-center gap-2 font-mono text-xs">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span className="text-slate-500">t:</span>
          <span className="text-slate-800 dark:text-slate-200 font-bold min-w-[70px] text-right">
            {(playback.currentTime * 1000).toFixed(1)} ms
          </span>
        </div>

        <span
          className={`inline-block w-2 h-2 rounded-full ${
            playback.isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'
          }`}
        />
      </div>
    </div>
  );
};
