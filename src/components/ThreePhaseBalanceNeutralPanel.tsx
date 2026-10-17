import React from 'react';
import { ThreePhaseState, ThreePhaseMetrics } from '../types/threePhase';
import { Activity, Info, ShieldCheck, AlertTriangle } from 'lucide-react';

interface ThreePhaseBalanceNeutralPanelProps {
  state: ThreePhaseState;
  metrics: ThreePhaseMetrics;
  onSignalDisplayChange: (mode: 'voltage' | 'current' | 'both') => void;
}

export const ThreePhaseBalanceNeutralPanel: React.FC<ThreePhaseBalanceNeutralPanelProps> = ({
  state,
  metrics,
  onSignalDisplayChange,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] p-3 shadow-md flex flex-col gap-2.5 font-mono text-xs">
      {/* Header with Title and Signal Display Toggle */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2 gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-500" />
          <h3 className="font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 text-xs">
            Three-Phase Balance and Neutral
          </h3>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
              metrics.isSystemBalanced
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}
          >
            {metrics.isSystemBalanced ? 'Balanced System' : 'Imbalance Detected'}
          </span>
        </div>

        {/* Trace Display Selector: Voltages | Currents | Both */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px]">
          <span className="text-slate-400 px-1.5 hidden sm:inline">Plot Traces:</span>
          <button
            onClick={() => onSignalDisplayChange('voltage')}
            className={`px-2 py-0.5 rounded font-semibold transition-all ${
              state.signalDisplay === 'voltage'
                ? 'bg-white dark:bg-[#161f33] text-cyan-600 dark:text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Voltages (v_A,B,C)
          </button>
          <button
            onClick={() => onSignalDisplayChange('current')}
            className={`px-2 py-0.5 rounded font-semibold transition-all ${
              state.signalDisplay === 'current'
                ? 'bg-white dark:bg-[#161f33] text-cyan-600 dark:text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Currents + Neutral (i_N)
          </button>
          <button
            onClick={() => onSignalDisplayChange('both')}
            className={`px-2 py-0.5 rounded font-semibold transition-all ${
              state.signalDisplay === 'both'
                ? 'bg-white dark:bg-[#161f33] text-cyan-600 dark:text-cyan-300 shadow-sm border border-cyan-500/30'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Both Overlay
          </button>
        </div>
      </div>

      {/* Grid of Telemetry Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {/* Phase A Metrics */}
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#080c14]/80 border border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            <span>Phase A</span>
          </div>
          <div className="mt-1 flex flex-col text-[11px]">
            <span>V_rms: <strong className="text-slate-800 dark:text-slate-200">{metrics.vA_Rms.toFixed(2)} pu</strong></span>
            <span>I_rms: <strong className="text-slate-800 dark:text-slate-200">{metrics.iA_Rms.toFixed(2)} A</strong></span>
            <span className="text-[10px] text-slate-500">R: {state.phaseA.resistance.toFixed(1)} Ω</span>
          </div>
        </div>

        {/* Phase B Metrics */}
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#080c14]/80 border border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[10px] text-yellow-600 dark:text-yellow-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span>Phase B</span>
          </div>
          <div className="mt-1 flex flex-col text-[11px]">
            <span>V_rms: <strong className="text-slate-800 dark:text-slate-200">{metrics.vB_Rms.toFixed(2)} pu</strong></span>
            <span>I_rms: <strong className="text-slate-800 dark:text-slate-200">{metrics.iB_Rms.toFixed(2)} A</strong></span>
            <span className="text-[10px] text-slate-500">R: {state.phaseB.resistance.toFixed(1)} Ω</span>
          </div>
        </div>

        {/* Phase C Metrics */}
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#080c14]/80 border border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span>Phase C</span>
          </div>
          <div className="mt-1 flex flex-col text-[11px]">
            <span>V_rms: <strong className="text-slate-800 dark:text-slate-200">{metrics.vC_Rms.toFixed(2)} pu</strong></span>
            <span>I_rms: <strong className="text-slate-800 dark:text-slate-200">{metrics.iC_Rms.toFixed(2)} A</strong></span>
            <span className="text-[10px] text-slate-500">R: {state.phaseC.resistance.toFixed(1)} Ω</span>
          </div>
        </div>

        {/* Neutral Current i_N(t) = -(i_A + i_B + i_C) */}
        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30">
          <div className="flex items-center gap-1.5 text-[10px] text-purple-600 dark:text-purple-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            <span>Neutral Current (i_N)</span>
          </div>
          <div className="mt-1 flex flex-col text-[11px]">
            <span>I_N,rms: <strong className="text-purple-700 dark:text-purple-300 text-sm font-bold">{metrics.iN_Rms.toFixed(2)} A</strong></span>
            <span className="text-[10px] text-slate-500">Peak: {metrics.iN_Peak.toFixed(2)} A</span>
            <span className="text-[9px] text-purple-600/80 dark:text-purple-400/80">KCL: i_N = -(Σ i_phase)</span>
          </div>
        </div>

        {/* Voltage Sum v_A + v_B + v_C */}
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#080c14]/80 border border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">
            <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
            <span>Voltage Sum (v_sum)</span>
          </div>
          <div className="mt-1 flex flex-col text-[11px]">
            <span>V_sum,rms: <strong className="text-slate-800 dark:text-slate-200">{metrics.vSumRms.toFixed(2)} pu</strong></span>
            <span className="text-[10px] text-slate-500">Peak: {metrics.vSumPeak.toFixed(2)} pu</span>
            <span className="text-[9px] text-slate-400">v_A(t) + v_B(t) + v_C(t)</span>
          </div>
        </div>

        {/* Electrical Assessment */}
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#080c14]/80 border border-slate-200 dark:border-slate-800/80 flex flex-col justify-center">
          <div className="text-[10px] text-slate-400 font-semibold">Conditions:</div>
          <div className="flex flex-col gap-0.5 text-[10px] mt-0.5">
            <span className={metrics.isVoltageBalanced ? 'text-emerald-500' : 'text-amber-500'}>
              {metrics.isVoltageBalanced ? '✓ Voltage Balanced' : '✗ Voltage Unbalance'}
            </span>
            <span className={metrics.isLoadBalanced ? 'text-emerald-500' : 'text-amber-500'}>
              {metrics.isLoadBalanced ? '✓ Load Balanced' : '✗ Load Unbalance'}
            </span>
          </div>
        </div>
      </div>

      {/* Educational Explanation Box */}
      <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-[11px] leading-relaxed">
        {metrics.isSystemBalanced ? (
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <span className="font-bold text-slate-900 dark:text-slate-100 mr-2">
            {metrics.educationalTitle}:
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            {metrics.educationalMessage}
          </span>
          <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 border-t border-slate-200 dark:border-slate-800/60 pt-1">
            <Info className="w-3 h-3 text-cyan-500 shrink-0" />
            <span>
              Physical Note: <em>v_sum(t)</em> is the instantaneous algebraic sum of the phase voltages relative to the source neutral. It does not represent neutral-to-ground voltage under ground impedance or float conditions.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
