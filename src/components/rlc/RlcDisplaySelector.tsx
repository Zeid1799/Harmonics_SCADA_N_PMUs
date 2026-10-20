import React from 'react';
import { RlcDisplayMode } from '../../types/rlcCircuit';
import { Activity, Compass, Columns } from 'lucide-react';

interface RlcDisplaySelectorProps {
  mode: RlcDisplayMode;
  onModeChange: (mode: RlcDisplayMode) => void;
  className?: string;
}

export const RlcDisplaySelector: React.FC<RlcDisplaySelectorProps> = ({
  mode,
  onModeChange,
  className = '',
}) => {
  return (
    <div
      role="group"
      aria-label="Circuit View Display Options"
      className={`flex items-center bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono select-none ${className}`}
    >
      {/* 1. Time Domain */}
      <button
        type="button"
        onClick={() => onModeChange('time')}
        title="Time Domain: Show steady-state instantaneous waveforms only"
        aria-pressed={mode === 'time'}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
          mode === 'time'
            ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm font-semibold border border-slate-200/80 dark:border-cyan-500/30'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <Activity className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Time Domain</span>
      </button>

      {/* 2. Phasor View */}
      <button
        type="button"
        onClick={() => onModeChange('phasor')}
        title="Phasor View: Show voltage and current complex phasors only"
        aria-pressed={mode === 'phasor'}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
          mode === 'phasor'
            ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm font-semibold border border-slate-200/80 dark:border-cyan-500/30'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <Compass className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Phasor View</span>
      </button>

      {/* 3. Both */}
      <button
        type="button"
        onClick={() => onModeChange('both')}
        title="Both: Show Time-Domain waveforms and Phasor View side-by-side"
        aria-pressed={mode === 'both'}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all cursor-pointer ${
          mode === 'both'
            ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm font-semibold border border-slate-200/80 dark:border-cyan-500/30'
            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <Columns className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Both</span>
      </button>
    </div>
  );
};
