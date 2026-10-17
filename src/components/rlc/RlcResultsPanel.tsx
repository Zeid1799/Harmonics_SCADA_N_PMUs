import React from 'react';
import {
  RlcCircuitConfig,
  RlcCircuitMetrics,
  RlcTopologyConfig,
  RlcSimulationMode,
  RlcTransientMetrics,
  RlcTransientState,
  DEFAULT_RLC_TOPOLOGY,
} from '../../types/rlcCircuit';
import { AppTheme } from '../../types/settings';
import { Info, Activity, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface RlcResultsPanelProps {
  config: RlcCircuitConfig;
  topology?: RlcTopologyConfig;
  metrics: RlcCircuitMetrics;
  simulationMode?: RlcSimulationMode;
  transientMetrics?: RlcTransientMetrics;
  transientState?: RlcTransientState;
  theme?: AppTheme;
}

export const RlcResultsPanel: React.FC<RlcResultsPanelProps> = ({
  config,
  topology = DEFAULT_RLC_TOPOLOGY,
  metrics,
  simulationMode = 'steady',
  transientMetrics,
  transientState,
}) => {
  const isResonant = metrics.isResonant;
  const isInductive = metrics.behavior === 'inductive';
  const isUnbounded = metrics.isUnboundedCurrent;
  const isOpen = metrics.isOpenCircuit;
  const isIndeterminate = metrics.isIndeterminate;

  if (simulationMode === 'transient' && transientMetrics) {
    const isUnderdamped = transientMetrics.dampingType === 'underdamped';
    const isCriticallyDamped = transientMetrics.dampingType === 'critically_damped';
    const isOverdamped = transientMetrics.dampingType === 'overdamped';
    const isUndamped = transientMetrics.dampingType === 'undamped';
    const kvlPassed = transientMetrics.kvlError < 1e-2;

    return (
      <div className="w-full h-full bg-slate-50 dark:bg-[#0b101c] border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-mono text-xs shadow-sm flex flex-col gap-2 overflow-y-auto">
        {/* 1. Top Badges & Live Status */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Transient Time-Domain Simulation
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Regime Badge */}
            <span
              className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border flex items-center gap-1 ${
                isUndamped
                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/40'
                  : isUnderdamped
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40'
                  : isCriticallyDamped
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                  : isOverdamped
                  ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/40'
                  : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/40'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span>{transientMetrics.dampingType.toUpperCase().replace('_', ' ')}</span>
            </span>

            {/* Time Stamp */}
            <span className="px-2 py-0.5 rounded text-[10.5px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-500" />
              <span>t: {(transientMetrics.timeSec * 1000).toFixed(1)} ms</span>
            </span>

            {/* KVL Badge */}
            <span
              className={`px-2 py-0.5 rounded text-[10.5px] font-semibold border flex items-center gap-1 ${
                kvlPassed
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>KVL ΔV: {transientMetrics.kvlError < 1e-4 ? '0.00 V' : `${transientMetrics.kvlError.toFixed(3)} V`}</span>
            </span>
          </div>
        </div>

        {/* Status Message Banner */}
        {transientMetrics.statusMessage && (
          <div className="shrink-0 px-2.5 py-1.5 rounded-lg border bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center gap-2 text-[11px] font-semibold">
            <Info className="w-4 h-4 shrink-0" />
            <span>{transientMetrics.statusMessage}</span>
          </div>
        )}

        {/* 2. Key Transient Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5 text-[11px] shrink-0">
          {/* Instantaneous Source Voltage */}
          <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
            <span className="text-slate-500 dark:text-slate-400 text-[10px]">Source v_s(t)</span>
            <span className="font-bold text-sky-600 dark:text-sky-400 truncate">
              {transientMetrics.vSource.toFixed(1)} V
            </span>
            <span className="text-[9px] text-slate-400">{config.frequency} Hz AC</span>
          </div>

          {/* Instantaneous Current */}
          <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
            <span className="text-slate-500 dark:text-slate-400 text-[10px]">Current i(t)</span>
            <span className="font-bold text-cyan-600 dark:text-cyan-400 truncate">
              {isOpen ? '0.000 A' : `${transientMetrics.current.toFixed(3)} A`}
            </span>
            <span className="text-[9px] text-slate-400 truncate">
              i(0) = {transientState?.initialConditions.initialIl ?? 0} A
            </span>
          </div>

          {/* Instantaneous Resistor Voltage */}
          <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
            <span className="text-slate-500 dark:text-slate-400 text-[10px]">Resistor v_R(t)</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate">
              {transientMetrics.vResistor.toFixed(1)} V
            </span>
            <span className="text-[9px] text-slate-400">R = {topology.resistor === 'bypassed' ? '0 Ω' : `${config.resistance} Ω`}</span>
          </div>

          {/* Instantaneous Inductor Voltage */}
          <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
            <span className="text-slate-500 dark:text-slate-400 text-[10px]">Inductor v_L(t)</span>
            <span className="font-bold text-amber-500 truncate">
              {transientMetrics.vInductor.toFixed(1)} V
            </span>
            <span className="text-[9px] text-slate-400">L = {topology.inductor === 'bypassed' ? '0 mH' : `${config.inductanceMh} mH`}</span>
          </div>

          {/* Instantaneous Capacitor Voltage */}
          <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
            <span className="text-slate-500 dark:text-slate-400 text-[10px]">Capacitor v_C(t)</span>
            <span className="font-bold text-purple-600 dark:text-purple-400 truncate">
              {transientMetrics.vCapacitor.toFixed(1)} V
            </span>
            <span className="text-[9px] text-slate-400 truncate">
              v_C(0) = {transientState?.initialConditions.initialVc ?? 0} V
            </span>
          </div>

          {/* Damping Ratio ζ */}
          <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
            <span className="text-slate-500 dark:text-slate-400 text-[10px]">Damping Ratio ζ</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
              {transientMetrics.dampingRatio !== null ? transientMetrics.dampingRatio.toFixed(3) : 'N/A'}
            </span>
            <span className="text-[9px] text-slate-400 truncate">
              {isUnderdamped ? 'Oscillatory' : isOverdamped ? 'Sluggish' : 'First Order'}
            </span>
          </div>

          {/* Natural Frequency f_0 */}
          <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
            <span className="text-slate-500 dark:text-slate-400 text-[10px]">Natural f₀</span>
            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
              {transientMetrics.naturalFrequencyHz !== null
                ? `${transientMetrics.naturalFrequencyHz.toFixed(1)} Hz`
                : 'N/A'}
            </span>
            <span className="text-[9px] text-slate-400 truncate">
              ω₀: {transientMetrics.naturalFrequencyHz !== null ? (transientMetrics.naturalFrequencyHz * 2 * Math.PI).toFixed(0) : 'N/A'} rad/s
            </span>
          </div>

          {/* KVL Sum (v_R + v_L + v_C) */}
          <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
            <span className="text-slate-500 dark:text-slate-400 text-[10px]">KVL Σ(v_R+v_L+v_C)</span>
            <span className="font-bold text-cyan-500 truncate">
              {(transientMetrics.vResistor + transientMetrics.vInductor + transientMetrics.vCapacitor).toFixed(1)} V
            </span>
            <span className="text-[9px] text-slate-400 truncate">
              ≈ v_s (Exact KVL)
            </span>
          </div>
        </div>

        {/* 3. Educational & Physical Explanation */}
        <div className="p-2 rounded-lg bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800/80 text-[11px] leading-relaxed shrink-0">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 pb-1 mb-1 border-b border-slate-100 dark:border-slate-800">
            <Info className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
            <span>Time-Domain Dynamic Evolution & Natural Response</span>
          </div>
          <p className="text-slate-600 dark:text-slate-400 text-[10.5px]">
            In transient mode, voltages and currents are integrated in real time using 4th-Order Runge-Kutta numerical integration of the circuit differential equations.
            {isUnderdamped &&
              ' Because the circuit is underdamped (ζ < 1), energy oscillates dynamically back and forth between the magnetic field of the inductor and the electric field of the capacitor, while the resistor dissipates energy until the natural response decays into the sinusoidal steady-state solution.'}
            {isCriticallyDamped &&
              ' With critical damping (ζ = 1), the circuit returns to the forced steady-state response as quickly as possible without oscillatory overshoot.'}
            {isOverdamped &&
              ' With heavy damping (ζ > 1), resistive dissipation dominates, producing a non-oscillatory, slower transition toward steady state.'}
            {isUndamped &&
              ' In an ideal lossless circuit (R = 0 Ω), natural oscillations never decay; if driven at resonance, amplitude grows secularly with time.'}
            {isOpen &&
              ' With the capacitor removed or C = 0 µF, the circuit is open. Current is zero at all times and the entire source voltage drops across the open terminals.'}
          </p>
        </div>
      </div>
    );
  }

  // Steady-State Mode Display
  return (
    <div className="w-full h-full bg-slate-50 dark:bg-[#0b101c] border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 font-mono text-xs shadow-sm flex flex-col gap-2 overflow-y-auto">
      {/* 1. Top Badges & Live Status */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-1.5">
          <Activity className="w-4 h-4 text-cyan-500" />
          <span className="font-bold text-slate-800 dark:text-slate-200">
            Steady-State AC Circuit Behavior & Diagnostics
          </span>
        </div>

        {/* State Badge */}
        <div className="flex items-center gap-1.5">
          <span
            className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border flex items-center gap-1 ${
              isUnbounded
                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/40'
                : isOpen
                ? 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/40'
                : isIndeterminate
                ? 'bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/40'
                : isResonant
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40'
                : isInductive
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40'
                : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/40'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isUnbounded
                  ? 'bg-rose-500'
                  : isOpen
                  ? 'bg-purple-500'
                  : isIndeterminate
                  ? 'bg-slate-500'
                  : isResonant
                  ? 'bg-emerald-500'
                  : isInductive
                  ? 'bg-amber-500'
                  : 'bg-cyan-500'
              }`}
            />
            <span>
              {isUnbounded
                ? 'UNBOUNDED CURRENT (|Z| = 0)'
                : isOpen
                ? 'OPEN CIRCUIT'
                : isIndeterminate
                ? 'INDETERMINATE (0 V / 0 Ω)'
                : isResonant
                ? 'RESONANCE (X_L = X_C)'
                : isInductive
                ? 'INDUCTIVE (X_L > X_C, Lagging)'
                : 'CAPACITIVE (X_C > X_L, Leading)'}
            </span>
          </span>

          <span className="px-2 py-0.5 rounded text-[10.5px] bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            PF: {metrics.pfDisplay}
          </span>
        </div>
      </div>

      {/* Special Condition Alert Banner */}
      {metrics.statusMessage && (
        <div
          className={`shrink-0 px-2.5 py-1.5 rounded-lg border flex items-center gap-2 text-[11px] font-semibold ${
            isUnbounded
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
              : isOpen
              ? 'bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 text-current" />
          <span>{metrics.statusMessage}</span>
        </div>
      )}

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-1.5 text-[11px] shrink-0">
        {/* Source Voltage */}
        <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
          <span className="text-slate-500 dark:text-slate-400 text-[10px]">Source V_s</span>
          <span className="font-bold text-sky-600 dark:text-sky-400">
            {metrics.vSourceRms.toFixed(1)} V
          </span>
          <span className="text-[9px] text-slate-400">{config.frequency} Hz</span>
        </div>

        {/* Current */}
        <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
          <span className="text-slate-500 dark:text-slate-400 text-[10px]">Current I</span>
          <span className="font-bold text-cyan-600 dark:text-cyan-400 truncate">
            {metrics.iDisplay}
          </span>
          <span className="text-[9px] text-slate-400 truncate">
            φ_I: {metrics.phiIDisplay}
          </span>
        </div>

        {/* Total Impedance */}
        <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
          <span className="text-slate-500 dark:text-slate-400 text-[10px]">Impedance |Z|</span>
          <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
            {metrics.zDisplay}
          </span>
          <span className="text-[9px] text-slate-400 truncate">
            θ_Z: {metrics.thetaZDisplay}
          </span>
        </div>

        {/* Reactances X_L & X_C */}
        <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
          <span className="text-slate-500 dark:text-slate-400 text-[10px]">Reactances</span>
          <span className="font-bold text-amber-500">
            X_L: {metrics.xL.toFixed(1)} Ω
          </span>
          <span className="font-bold text-purple-500 truncate">
            X_C: {metrics.xC === Infinity ? '∞' : `${metrics.xC.toFixed(1)} Ω`}
          </span>
        </div>

        {/* Resistor Voltage Drop */}
        <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
          <span className="text-slate-500 dark:text-slate-400 text-[10px]">Resistor V_R</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {metrics.vResistorRms.toFixed(1)} V
          </span>
          <span className="text-[9px] text-slate-400">
            R: {topology.resistor === 'bypassed' ? '0 Ω' : `${config.resistance} Ω`}
          </span>
        </div>

        {/* Inductor Voltage Drop */}
        <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
          <span className="text-slate-500 dark:text-slate-400 text-[10px]">Inductor V_L</span>
          <span className="font-bold text-amber-500">
            {isUnbounded ? 'Unbounded' : `${metrics.vInductorRms.toFixed(1)} V`}
          </span>
          <span className="text-[9px] text-slate-400">
            L: {topology.inductor === 'bypassed' ? '0 mH' : `${config.inductanceMh} mH`}
          </span>
        </div>

        {/* Capacitor Voltage Drop */}
        <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
          <span className="text-slate-500 dark:text-slate-400 text-[10px]">Capacitor V_C</span>
          <span className="font-bold text-purple-600 dark:text-purple-400">
            {isUnbounded ? 'Unbounded' : `${metrics.vCapacitorRms.toFixed(1)} V`}
          </span>
          <span className="text-[9px] text-slate-400">
            C: {topology.capacitor === 'removed' ? 'Removed' : topology.capacitor === 'bypassed' ? 'Bypassed' : `${config.capacitanceUf} µF`}
          </span>
        </div>

        {/* Power (P & Q) */}
        <div className="p-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col">
          <span className="text-slate-500 dark:text-slate-400 text-[10px]">Power</span>
          <span className="font-bold text-slate-700 dark:text-slate-300 truncate">
            {metrics.realPowerW.toFixed(1)} W
          </span>
          <span className="text-[9px] text-slate-400 truncate">
            {metrics.reactivePowerVar.toFixed(1)} VAr
          </span>
        </div>
      </div>

      {/* 3. Educational Context Card */}
      <div className="p-2 rounded-lg bg-white dark:bg-[#0d1424] border border-slate-200 dark:border-slate-800/80 text-[11px] leading-relaxed shrink-0">
        <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 pb-1 mb-1 border-b border-slate-100 dark:border-slate-800">
          <Info className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
          <span>{metrics.behaviorTitle}</span>
        </div>
        <p className="text-slate-600 dark:text-slate-400 text-[10.5px]">
          {metrics.behaviorExplanation}
        </p>
      </div>
    </div>
  );
};
