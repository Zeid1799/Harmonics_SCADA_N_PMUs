import React from 'react';
import { SCADA_INTERVAL_OPTIONS, ScadaTelemetryData } from '../../types/scada';
import { Radio, Activity, Clock, RefreshCw, AlertTriangle } from 'lucide-react';

interface ScadaIntervalControlProps {
  intervalSec: number;
  onSetInterval: (interval: number) => void;
  telemetry: ScadaTelemetryData;
  isPlaying: boolean;
  onManualPoll?: () => void;
}

export const ScadaIntervalControl: React.FC<ScadaIntervalControlProps> = ({
  intervalSec,
  onSetInterval,
  telemetry,
  isPlaying,
  onManualPoll,
}) => {
  const currentConfig = SCADA_INTERVAL_OPTIONS.find((o) => o.intervalSec === intervalSec) || {
    intervalSec,
    rateHz: 1 / intervalSec,
    label: `${intervalSec} s (${(1 / intervalSec).toFixed(2)} Hz)`,
    displayString: `SCADA Update Interval: ${intervalSec} s (${(1 / intervalSec).toFixed(2)} Hz)`,
  };

  const hasDiscrepancy = telemetry.deltaError > 0.01;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] p-2.5 sm:p-3 shadow-md flex flex-col justify-between gap-2 h-full">
      {/* 1. Header: Live RMS Telemetry Readouts & Interval Badge */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200 dark:border-slate-800/80 pb-2">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/30 shrink-0">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 font-mono">
              SCADA Telemetry & Interval
            </h3>
          </div>
        </div>

        {/* Live RMS Numerical Chips */}
        <div className="flex items-center gap-1.5 font-mono text-[10px]">
          {/* True RMS Chip */}
          <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded text-emerald-700 dark:text-emerald-300">
            <Activity className="w-2.5 h-2.5 text-emerald-500" />
            <span className="font-semibold text-slate-500 dark:text-slate-400">True:</span>
            <span className="font-bold">{telemetry.trueRms.toFixed(2)} pu</span>
          </div>

          {/* SCADA RMS Chip */}
          <div
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-all ${
              telemetry.isJustUpdated
                ? 'bg-amber-400/30 border-amber-400 text-amber-900 dark:text-amber-200 font-bold scale-105 shadow-sm'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
            }`}
          >
            <Radio className="w-2.5 h-2.5 text-amber-500" />
            <span className="font-semibold text-slate-500 dark:text-slate-400">SCADA:</span>
            <span className="font-bold">{telemetry.scadaRms.toFixed(2)} pu</span>
          </div>

          {/* Delta status */}
          {hasDiscrepancy && (
            <div className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/20 font-semibold hidden sm:flex">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>Δ {telemetry.deltaError.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Six SCADA Measurement Interval Buttons */}
      <div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 mb-1">
          <span className="font-semibold">{currentConfig.displayString}</span>
          <span className="text-[9px] opacity-75">Rate = 1 / Interval</span>
        </div>

        <div className="grid grid-cols-6 gap-1">
          {SCADA_INTERVAL_OPTIONS.map((opt) => {
            const isSelected = opt.intervalSec === intervalSec;
            return (
              <button
                key={opt.intervalSec}
                onClick={() => onSetInterval(opt.intervalSec)}
                title={`Set SCADA measurement interval to ${opt.intervalSec} seconds (${opt.rateHz.toFixed(2)} Hz)`}
                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg border text-xs font-mono transition-all ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-md shadow-amber-500/25 scale-[1.02]'
                    : 'bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-amber-400/50 hover:bg-slate-200/60 dark:hover:bg-slate-800/80'
                }`}
              >
                <span className="font-bold text-xs">{opt.intervalSec}s</span>
                <span
                  className={`text-[9px] leading-tight ${
                    isSelected ? 'text-slate-900 font-semibold' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {opt.rateHz >= 1 ? `${opt.rateHz}Hz` : `${opt.rateHz.toFixed(2)}Hz`}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Dynamic Countdown Progress Bar & Manual Trigger */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/80 font-mono text-xs">
        <div className="flex-1 flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
          <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                telemetry.isJustUpdated ? 'bg-amber-400 shadow-md shadow-amber-400' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, telemetry.progressPercent)}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 min-w-[50px] text-right">
            {isPlaying ? `${telemetry.countdownSec.toFixed(1)}s` : 'Paused'}
          </span>
        </div>

        {onManualPoll && (
          <button
            onClick={onManualPoll}
            title="Force immediate SCADA telemetry polling"
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-[10px] font-mono transition-colors shrink-0"
          >
            <RefreshCw className="w-2.5 h-2.5 text-amber-500" />
            <span>Poll Now</span>
          </button>
        )}
      </div>
    </div>
  );
};
