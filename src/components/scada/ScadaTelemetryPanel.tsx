import React from 'react';
import { ScadaTelemetryData } from '../../types/scada';
import { Activity, Radio, ArrowRightLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ScadaTelemetryPanelProps {
  telemetry: ScadaTelemetryData;
  isPlaying: boolean;
}

export const ScadaTelemetryPanel: React.FC<ScadaTelemetryPanelProps> = ({
  telemetry,
  isPlaying,
}) => {
  const hasDiscrepancy = telemetry.deltaError > 0.01;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
      {/* 1. True RMS Card (Continuous) */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 px-3 py-1.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 font-mono">
          <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-500 shrink-0">
            <Activity className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <span>True RMS</span>
              <span className="text-[9px] font-normal opacity-80">(Continuous)</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono hidden md:block">
              Calculated from physical waveform
            </div>
          </div>
        </div>
        <div className="text-lg font-mono font-extrabold text-emerald-600 dark:text-emerald-300 shrink-0 ml-2">
          {telemetry.trueRms.toFixed(3)}{' '}
          <span className="text-xs font-normal text-emerald-700/70 dark:text-emerald-400/70">pu</span>
        </div>
      </div>

      {/* 2. SCADA RMS Card (Discrete Sample-and-Hold) */}
      <div
        className={`rounded-xl border px-3 py-1.5 flex items-center justify-between shadow-sm transition-all ${
          telemetry.isJustUpdated
            ? 'border-amber-400 bg-amber-400/20 shadow-amber-500/20 scale-[1.01]'
            : 'border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20'
        }`}
      >
        <div className="flex items-center gap-2 font-mono">
          <div className="p-1 rounded-md bg-amber-500/10 text-amber-500 shrink-0">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <span>SCADA RMS</span>
              <span className="text-[9px] font-normal opacity-80">[Sample & Hold]</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono hidden md:block">
              Every {telemetry.intervalSec}s ({telemetry.rateHz >= 1 ? `${telemetry.rateHz} Hz` : `${telemetry.rateHz.toFixed(2)} Hz`})
            </div>
          </div>
        </div>
        <div className="text-lg font-mono font-extrabold text-amber-600 dark:text-amber-300 shrink-0 ml-2">
          {telemetry.scadaRms.toFixed(3)}{' '}
          <span className="text-xs font-normal text-amber-700/70 dark:text-amber-400/70">pu</span>
        </div>
      </div>

      {/* 3. Measurement Telemetry Discrepancy Card */}
      <div
        className={`rounded-xl border px-3 py-1.5 flex items-center justify-between shadow-sm transition-all ${
          hasDiscrepancy
            ? 'border-rose-500/40 bg-rose-500/10 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200'
            : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d121f] text-slate-700 dark:text-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 font-mono">
          <div className="p-1 rounded-md bg-slate-200/80 dark:bg-slate-800 text-slate-500 shrink-0">
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
              <span>Telemetry Δ</span>
              {hasDiscrepancy ? (
                <span className="text-[9px] text-rose-600 dark:text-rose-400 font-bold flex items-center gap-0.5">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Lagging
                </span>
              ) : (
                <span className="text-[9px] text-emerald-500 font-semibold flex items-center gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  In Sync
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono hidden md:block">
              {isPlaying
                ? hasDiscrepancy
                  ? `Syncs in ${telemetry.countdownSec.toFixed(1)}s`
                  : 'Telemetry matches waveform'
                : 'Paused'}
            </div>
          </div>
        </div>
        <div className="text-lg font-mono font-extrabold shrink-0 ml-2">
          {telemetry.deltaError.toFixed(3)}{' '}
          <span className="text-xs font-normal opacity-70">pu</span>
        </div>
      </div>
    </div>
  );
};
