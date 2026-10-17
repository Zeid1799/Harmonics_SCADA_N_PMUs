import React from 'react';
import { Activity, Gauge } from 'lucide-react';

interface FundamentalControlsProps {
  frequency: number; // Hz (1 to 120)
  amplitude: number; // pu (0 to 2.0)
  onFrequencyChange: (freq: number) => void;
  onAmplitudeChange: (amp: number) => void;
}

export const FundamentalControls: React.FC<FundamentalControlsProps> = ({
  frequency,
  amplitude,
  onFrequencyChange,
  onAmplitudeChange,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] p-3 shadow-md flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-1.5">
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 font-mono">
          <Activity className="w-3.5 h-3.5 text-cyan-500" />
          Fundamental Controls
        </h3>
        <span className="text-[10px] font-mono text-slate-400">f₀ & A₁</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Fundamental Frequency */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between font-mono text-xs">
            <label className="text-slate-700 dark:text-slate-300 font-semibold flex items-center gap-1">
              <Gauge className="w-3 h-3 text-cyan-500" />
              Frequency:
            </label>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-1.5 py-0.5 text-cyan-600 dark:text-cyan-300 font-bold text-xs">
              <span>{frequency}</span>
              <span className="text-slate-400 font-normal">Hz</span>
            </div>
          </div>

          <input
            type="range"
            min={1}
            max={120}
            step={1}
            value={frequency}
            onChange={(e) => onFrequencyChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none"
          />

          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 dark:text-slate-500">
            <span>1 Hz</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => onFrequencyChange(50)}
                className={`px-1.5 py-0.2 rounded transition-colors ${
                  frequency === 50
                    ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                50 Hz
              </button>
              <button
                onClick={() => onFrequencyChange(60)}
                className={`px-1.5 py-0.2 rounded transition-colors ${
                  frequency === 60
                    ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                60 Hz
              </button>
            </div>
            <span>120 Hz</span>
          </div>
        </div>

        {/* Fundamental Amplitude */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between font-mono text-xs">
            <label className="text-slate-700 dark:text-slate-300 font-semibold">Amplitude:</label>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded px-1.5 py-0.5 text-cyan-600 dark:text-cyan-300 font-bold text-xs">
              <span>{amplitude.toFixed(2)}</span>
              <span className="text-slate-400 font-normal">pu</span>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={2.0}
            step={0.01}
            value={amplitude}
            onChange={(e) => onAmplitudeChange(Number(e.target.value))}
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none"
          />

          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 dark:text-slate-500">
            <span>0.00 pu</span>
            <div className="flex gap-1.5">
              <button
                onClick={() => onAmplitudeChange(0.5)}
                className={`px-1.5 py-0.2 rounded transition-colors ${
                  amplitude === 0.5
                    ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                0.50
              </button>
              <button
                onClick={() => onAmplitudeChange(1.0)}
                className={`px-1.5 py-0.2 rounded transition-colors ${
                  amplitude === 1.0
                    ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                1.00
              </button>
              <button
                onClick={() => onAmplitudeChange(1.5)}
                className={`px-1.5 py-0.2 rounded transition-colors ${
                  amplitude === 1.5
                    ? 'bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                1.50
              </button>
            </div>
            <span>2.00 pu</span>
          </div>
        </div>
      </div>
    </div>
  );
};
