import React, { useState, useCallback, useMemo } from 'react';
import { WaveformState, HarmonicPercentages, PlaybackState } from '../types/waveform';
import { AppTheme, WorkspaceLayout } from '../types/settings';
import {
  ThreePhaseState,
  DEFAULT_THREE_PHASE_STATE,
} from '../types/threePhase';
import {
  RlcCircuitState,
  RlcSimulationMode,
  DEFAULT_RLC_CIRCUIT_STATE,
} from '../types/rlcCircuit';
import {
  DEFAULT_WAVEFORM_STATE,
  formatWaveformEquation,
} from '../model/waveformModel';
import { computeThreePhaseMetrics } from '../model/threePhaseModel';
import { computeRlcCircuitMetrics } from '../model/rlcCircuitModel';
import { solveRlcTransient } from '../model/rlcTransientModel';
import { useWaveformPlayback } from '../hooks/useWaveformPlayback';
import { WaveformPlot } from './WaveformPlot';
import { FrequencyDomainPlot } from './FrequencyDomainPlot';
import { HarmonicControls } from './HarmonicControls';
import { WaveEquationEditor } from './WaveEquationEditor';
import { FundamentalControls } from './FundamentalControls';
import { PlaybackControls } from './PlaybackControls';
import { ThreePhaseWaveformPlot } from './ThreePhaseWaveformPlot';
import { ThreePhasePhasorPlot } from './ThreePhasePhasorPlot';
import { ThreePhaseControls } from './ThreePhaseControls';
import { ThreePhaseBalanceNeutralPanel } from './ThreePhaseBalanceNeutralPanel';
import { RlcCircuitDiagram } from './rlc/RlcCircuitDiagram';
import { RlcControls } from './rlc/RlcControls';
import { RlcWaveformPlot } from './rlc/RlcWaveformPlot';
import { RlcPhasorPlot } from './rlc/RlcPhasorPlot';
import { RlcResultsPanel } from './rlc/RlcResultsPanel';
import { Activity, Radio, Compass, Cpu } from 'lucide-react';

/**
 * Feature flag for Transient simulation mode in Circuit View.
 * Enabled per user specification to support switchable Steady State / Transient simulation.
 */
const ENABLE_TRANSIENT_MODE: boolean = true;

export type WaveGeneratorOperatingMode = 'single' | 'circuit' | 'three';

interface WaveGeneratorProps {
  theme: AppTheme;
  playbackSpeed: number;
  onUpdatePlaybackSpeed: (speed: number) => void;
  layout: WorkspaceLayout;
  waveformState?: WaveformState;
  onUpdateWaveform?: (updater: (prev: WaveformState) => WaveformState) => void;
  playback?: PlaybackState;
  onTogglePlay?: () => void;
  onResetTime?: () => void;
  showHarmonicsBreakdown?: boolean;
  onToggleBreakdown?: () => void;
}

export const WaveGenerator: React.FC<WaveGeneratorProps> = ({
  theme,
  playbackSpeed,
  onUpdatePlaybackSpeed,
  layout,
  waveformState: externalWaveformState,
  onUpdateWaveform: externalOnUpdateWaveform,
  playback: externalPlayback,
  onTogglePlay: externalTogglePlay,
  onResetTime: externalResetTime,
  showHarmonicsBreakdown: externalShowBreakdown,
  onToggleBreakdown: externalOnToggleBreakdown,
}) => {
  // 1. Operating Mode Selector: Single Phase | Circuit View | Three Phase
  const [phaseMode, setPhaseMode] = useState<WaveGeneratorOperatingMode>('single');

  // RLC Circuit State (independent of single-phase and three-phase state)
  const [rlcState, setRlcState] = useState<RlcCircuitState>(DEFAULT_RLC_CIRCUIT_STATE);

  // Three-Phase State (independent of single-phase state)
  const [threePhaseState, setThreePhaseState] = useState<ThreePhaseState>(DEFAULT_THREE_PHASE_STATE);

  // 2. Single-Phase Canonical Waveform State
  const [internalWaveformState, setInternalWaveformState] = useState<WaveformState>(DEFAULT_WAVEFORM_STATE);
  const waveformState = externalWaveformState ?? internalWaveformState;
  const setWaveformState = externalOnUpdateWaveform ?? setInternalWaveformState;

  const [internalShowBreakdown, setInternalShowBreakdown] = useState<boolean>(false);
  const showHarmonicsBreakdown = externalShowBreakdown ?? internalShowBreakdown;
  const handleToggleBreakdown =
    externalOnToggleBreakdown ?? (() => setInternalShowBreakdown((prev) => !prev));

  // 3. Playback Hook (continuous simulation time)
  const currentFrequency =
    phaseMode === 'single'
      ? waveformState.fundamentalFrequency
      : phaseMode === 'circuit'
      ? rlcState.config.frequency
      : threePhaseState.phaseA.frequency;

  const internalPlaybackHook = useWaveformPlayback({
    fundamentalFrequency: currentFrequency,
  });

  const playback = externalPlayback ?? internalPlaybackHook.playback;
  const togglePlay = externalTogglePlay ?? internalPlaybackHook.togglePlay;
  const resetTime = externalResetTime ?? internalPlaybackHook.resetTime;
  const internalSetPlaybackSpeed = internalPlaybackHook.setPlaybackSpeed;

  React.useEffect(() => {
    if (!externalPlayback) {
      internalSetPlaybackSpeed(playbackSpeed);
    }
  }, [playbackSpeed, externalPlayback, internalSetPlaybackSpeed]);

  const currentMergedState: WaveformState = {
    ...waveformState,
    playback,
  };

  // 4. Single-Phase Handlers
  const handleFrequencyChange = useCallback((newFreq: number) => {
    setWaveformState((prev) => {
      const updatedEq = formatWaveformEquation(
        newFreq,
        prev.fundamentalAmplitude,
        prev.harmonics,
        prev.customTerms,
        prev.dcOffset,
        prev.phase
      );
      return {
        ...prev,
        fundamentalFrequency: newFreq,
        equation: updatedEq,
      };
    });
  }, [setWaveformState]);

  const handleAmplitudeChange = useCallback((newAmp: number) => {
    setWaveformState((prev) => {
      const updatedEq = formatWaveformEquation(
        prev.fundamentalFrequency,
        newAmp,
        prev.harmonics,
        prev.customTerms,
        prev.dcOffset,
        prev.phase
      );
      return {
        ...prev,
        fundamentalAmplitude: newAmp,
        equation: updatedEq,
      };
    });
  }, [setWaveformState]);

  const handleHarmonicsChange = useCallback((newHarmonics: HarmonicPercentages) => {
    setWaveformState((prev) => {
      const updatedEq = formatWaveformEquation(
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
        equation: updatedEq,
      };
    });
  }, [setWaveformState]);

  const handleApplyParsedEquation = useCallback(
    (parsed: {
      fundamentalFrequency?: number;
      fundamentalAmplitude?: number;
      harmonics?: HarmonicPercentages;
      phase?: number;
      dcOffset?: number;
      customTerms?: any[];
      rawEquation: string;
    }) => {
      setWaveformState((prev) => {
        const nextFreq =
          parsed.fundamentalFrequency !== undefined
            ? parsed.fundamentalFrequency
            : prev.fundamentalFrequency;
        const nextAmp =
          parsed.fundamentalAmplitude !== undefined
            ? parsed.fundamentalAmplitude
            : prev.fundamentalAmplitude;
        const nextHarmonics = parsed.harmonics || prev.harmonics;
        const nextPhase = parsed.phase !== undefined ? parsed.phase : prev.phase;
        const nextDc = parsed.dcOffset !== undefined ? parsed.dcOffset : prev.dcOffset;
        const nextCustomTerms = parsed.customTerms || [];

        return {
          ...prev,
          fundamentalFrequency: nextFreq,
          fundamentalAmplitude: nextAmp,
          harmonics: nextHarmonics,
          phase: nextPhase,
          dcOffset: nextDc,
          customTerms: nextCustomTerms,
          equation: parsed.rawEquation,
        };
      });
    },
    [setWaveformState]
  );

  const handleResetToDefault = useCallback(() => {
    setWaveformState(() => ({
      ...DEFAULT_WAVEFORM_STATE,
      playback: {
        mode: 'idle',
        isPlaying: false,
        currentTime: 0,
        targetCycles: null,
        cycleProgress: 0,
      },
    }));
    resetTime();
  }, [resetTime, setWaveformState]);

  // 5. Three-Phase Handlers & Metrics
  const handleResetThreePhaseBalanced = useCallback(() => {
    setThreePhaseState((prev) => ({
      ...DEFAULT_THREE_PHASE_STATE,
      mode: 'three',
      signalDisplay: prev.signalDisplay,
      showPhasors: prev.showPhasors,
    }));
  }, []);

  const threePhaseMetrics = computeThreePhaseMetrics(threePhaseState);

  // 6. RLC Circuit Metrics & Transient Trajectory
  const rlcMetrics = useMemo(
    () => computeRlcCircuitMetrics(rlcState.config, rlcState.topology),
    [rlcState.config, rlcState.topology]
  );

  // Active Circuit View simulation mode (steady state when transient mode is disabled)
  const effectiveSimulationMode: RlcSimulationMode = ENABLE_TRANSIENT_MODE
    ? rlcState.simulationMode
    : 'steady';

  const rlcTransientTrajectory = useMemo(() => {
    if (effectiveSimulationMode !== 'transient') return null;
    return solveRlcTransient(
      rlcState.config,
      rlcState.topology,
      rlcState.transient.initialConditions,
      rlcState.transient.timeSec,
      rlcState.transient.visibleTimeWindowMs,
      700,
      rlcState.transient.overlaySteadyState
    );
  }, [
    effectiveSimulationMode,
    rlcState.config,
    rlcState.topology,
    rlcState.transient.initialConditions,
    rlcState.transient.timeSec,
    rlcState.transient.visibleTimeWindowMs,
    rlcState.transient.overlaySteadyState,
  ]);

  // Mode switch handler: preserves circuit configuration & topology
  const handleSwitchCircuitMode = useCallback((newMode: RlcSimulationMode) => {
    setRlcState((prev) => {
      if (prev.simulationMode === newMode) return prev;
      if (newMode === 'steady') {
        // Pauses transient simulation if running, retaining timeSec progress
        return {
          ...prev,
          simulationMode: 'steady',
          transient: {
            ...prev.transient,
            isRunning: false,
          },
        };
      } else {
        // Switching to transient: preserves parameters & topology
        return {
          ...prev,
          simulationMode: 'transient',
        };
      }
    });
  }, []);

  // Transient Simulation Animation Loop
  React.useEffect(() => {
    if (
      phaseMode !== 'circuit' ||
      effectiveSimulationMode !== 'transient' ||
      !rlcState.transient.isRunning
    ) {
      return;
    }

    let lastTimestamp: number | null = null;
    let animId: number;

    const tick = (timestamp: number) => {
      if (lastTimestamp !== null) {
        const dtRealSec = (timestamp - lastTimestamp) / 1000;
        const clampedDtRealSec = Math.min(dtRealSec, 0.1);
        const simDt = clampedDtRealSec * playbackSpeed;

        setRlcState((prev) => ({
          ...prev,
          transient: {
            ...prev.transient,
            timeSec: prev.transient.timeSec + simDt,
          },
        }));
      }
      lastTimestamp = timestamp;
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [
    phaseMode,
    effectiveSimulationMode,
    rlcState.transient.isRunning,
    playbackSpeed,
  ]);

  const handleToggleTransientPlay = useCallback(() => {
    setRlcState((prev) => ({
      ...prev,
      transient: {
        ...prev.transient,
        isRunning: !prev.transient.isRunning,
      },
    }));
  }, []);

  const handleResetTransientTime = useCallback(() => {
    setRlcState((prev) => ({
      ...prev,
      transient: {
        ...prev.transient,
        timeSec: 0,
        isRunning: false,
      },
    }));
  }, []);

  return (
    <div className="h-full max-w-7xl mx-auto flex flex-col justify-between gap-2 p-2 sm:p-2.5 overflow-hidden">
      {/* Mode Selector Pill: Single Phase | Circuit View | Three Phase */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1.5 font-mono text-xs">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setPhaseMode('single')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all font-semibold cursor-pointer ${
              phaseMode === 'single'
                ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-cyan-500/30'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Single Phase</span>
          </button>

          <button
            type="button"
            onClick={() => setPhaseMode('circuit')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all font-semibold cursor-pointer ${
              phaseMode === 'circuit'
                ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-cyan-500/30'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Circuit View (RLC)</span>
          </button>

          <button
            type="button"
            onClick={() => setPhaseMode('three')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-all font-semibold cursor-pointer ${
              phaseMode === 'three'
                ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-cyan-500/30'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Three Phase (A, B, C & Neutral)</span>
          </button>
        </div>

        {/* Phasor Toggle Button (for Circuit View or Three Phase) */}
        {phaseMode === 'circuit' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setRlcState((prev) => ({ ...prev, showPhasors: !prev.showPhasors }))
              }
              className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition-colors ${
                rlcState.showPhasors
                  ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30 font-semibold'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
              }`}
            >
              <Compass className="w-3 h-3" />
              <span>Phasors {rlcState.showPhasors ? 'On' : 'Off'}</span>
            </button>
          </div>
        )}

        {phaseMode === 'three' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setThreePhaseState((prev) => ({ ...prev, showPhasors: !prev.showPhasors }))
              }
              className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition-colors ${
                threePhaseState.showPhasors
                  ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30 font-semibold'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
              }`}
            >
              <Compass className="w-3 h-3" />
              <span>Phasors {threePhaseState.showPhasors ? 'On' : 'Off'}</span>
            </button>
          </div>
        )}
      </div>

      {phaseMode === 'single' ? (
        /* ==================== 1. SINGLE PHASE WORKSPACE (100% PRESERVED) ==================== */
        <>
          {/* Main Oscilloscope Frame */}
          <section
            aria-label="Signal Representations and Harmonic Synthesis"
            className="flex-1 min-h-[250px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080c14] shadow-xl overflow-hidden flex flex-col md:flex-row"
          >
            <div className="flex-1 h-full min-w-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
              {(layout === 'both' || layout === 'time') && (
                <div className="flex-1 h-full min-w-0 min-h-0">
                  <WaveformPlot
                    state={currentMergedState}
                    theme={theme}
                    showHarmonicsBreakdown={showHarmonicsBreakdown}
                    visibleCycles={waveformState.visibleCycles}
                    onCyclesChange={(cycles) => {
                      setWaveformState((prev) => ({
                        ...prev,
                        visibleCycles: cycles,
                      }));
                    }}
                  />
                </div>
              )}

              {(layout === 'both' || layout === 'frequency') && (
                <div className="flex-1 h-full min-w-0 min-h-0">
                  <FrequencyDomainPlot state={waveformState} theme={theme} />
                </div>
              )}
            </div>

            <div className="w-full md:w-60 lg:w-64 shrink-0 h-auto md:h-full">
              <HarmonicControls
                fundamentalFrequency={waveformState.fundamentalFrequency}
                fundamentalAmplitude={waveformState.fundamentalAmplitude}
                harmonics={waveformState.harmonics}
                onHarmonicsChange={handleHarmonicsChange}
                showHarmonicsBreakdown={showHarmonicsBreakdown}
                onToggleBreakdown={handleToggleBreakdown}
              />
            </div>
          </section>

          {/* Compact Equation Editor Bar */}
          <section aria-label="Equation Editor" className="shrink-0 w-full">
            <WaveEquationEditor
              state={waveformState}
              onApplyParsedEquation={handleApplyParsedEquation}
              onResetToDefault={handleResetToDefault}
            />
          </section>

          {/* Fundamental Parameters & Playback Controls */}
          <section aria-label="Controls" className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-2.5 items-stretch">
            <FundamentalControls
              frequency={waveformState.fundamentalFrequency}
              amplitude={waveformState.fundamentalAmplitude}
              onFrequencyChange={handleFrequencyChange}
              onAmplitudeChange={handleAmplitudeChange}
            />

            <PlaybackControls
              playback={playback}
              playbackSpeed={playbackSpeed}
              onSetPlaybackSpeed={onUpdatePlaybackSpeed}
              onTogglePlay={togglePlay}
              onResetTime={resetTime}
            />
          </section>
        </>
      ) : phaseMode === 'circuit' ? (
        /* ==================== 2. CIRCUIT VIEW (SERIES RLC - FIXED VIEWPORT) ==================== */
        <div className="flex-1 min-h-0 flex flex-col justify-between gap-2 overflow-hidden">
          {/* Sub-Mode Selector for Circuit View: Steady State | Transient (hidden when transient mode is disabled) */}
          {ENABLE_TRANSIENT_MODE && (
            <div className="shrink-0 flex items-center justify-between px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b101c] font-mono text-xs shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                  Simulation Mode:
                </span>
                <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleSwitchCircuitMode('steady')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      rlcState.simulationMode === 'steady'
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Steady State</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSwitchCircuitMode('transient')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      rlcState.simulationMode === 'transient'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>Transient</span>
                  </button>
                </div>
              </div>

              <div className="text-[10.5px] text-slate-500 hidden sm:flex items-center gap-2">
                {rlcState.simulationMode === 'steady' ? (
                  <span>Sinusoidal steady-state AC analytical solution (Periodic)</span>
                ) : (
                  <span>Real-time RK4 ODE numerical integration (charges/discharges, damping)</span>
                )}
              </div>
            </div>
          )}

          {/* Main 2-Column Responsive Workspace */}
          <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-2 overflow-hidden">
            {/* Left Column: Schematic (Top) + Editable Controls (Bottom with internal scroll) */}
            <div className="w-full md:w-5/12 lg:w-4/12 flex flex-col gap-2 min-h-0 h-full">
              {/* Interactive Schematic Diagram Card */}
              <div className="shrink-0 h-[190px] sm:h-[210px] lg:h-[220px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080c14] shadow-md overflow-hidden">
                <RlcCircuitDiagram
                  config={rlcState.config}
                  topology={rlcState.topology}
                  metrics={rlcMetrics}
                  activeComponent={rlcState.activeComponent}
                  onSelectComponent={(comp) =>
                    setRlcState((prev) => ({ ...prev, activeComponent: comp }))
                  }
                  theme={theme}
                  currentTimeSec={
                    effectiveSimulationMode === 'transient'
                      ? rlcState.transient.timeSec
                      : playback.currentTime
                  }
                  isPlaying={
                    effectiveSimulationMode === 'transient'
                      ? rlcState.transient.isRunning
                      : playback.isPlaying
                  }
                  instantaneousCurrent={
                    effectiveSimulationMode === 'transient'
                      ? rlcTransientTrajectory?.metrics.current
                      : undefined
                  }
                  simulationMode={effectiveSimulationMode}
                />
              </div>

              {/* Editable Circuit Parameters Controls Card (Independent Internal Scroll) */}
              <div className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080c14] shadow-md overflow-hidden">
                <RlcControls
                  config={rlcState.config}
                  topology={rlcState.topology}
                  metrics={rlcMetrics}
                  activeComponent={rlcState.activeComponent}
                  onSelectComponent={(comp) =>
                    setRlcState((prev) => ({ ...prev, activeComponent: comp }))
                  }
                  onChange={(updater) =>
                    setRlcState((prev) => ({ ...prev, config: updater(prev.config) }))
                  }
                  onTopologyChange={(updater) =>
                    setRlcState((prev) => ({ ...prev, topology: updater(prev.topology) }))
                  }
                  simulationMode={effectiveSimulationMode}
                  transientState={rlcState.transient}
                  onTransientChange={(updater) =>
                    setRlcState((prev) => ({ ...prev, transient: updater(prev.transient) }))
                  }
                  onResetToDefault={() =>
                    setRlcState((prev) => ({
                      ...DEFAULT_RLC_CIRCUIT_STATE,
                      simulationMode: prev.simulationMode,
                      showPhasors: prev.showPhasors,
                    }))
                  }
                />
              </div>
            </div>

            {/* Right Column: Live Results Panel (Top with internal scroll) + Waveform & Phasor (Bottom) */}
            <div className="w-full md:w-7/12 lg:w-8/12 flex flex-col gap-2 min-h-0 h-full">
              {/* Live Results & Educational Diagnostic Card (Independent Internal Scroll) */}
              <div className="shrink-0 max-h-[160px] lg:max-h-[175px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080c14] shadow-md overflow-hidden">
                <RlcResultsPanel
                  config={rlcState.config}
                  topology={rlcState.topology}
                  metrics={rlcMetrics}
                  simulationMode={effectiveSimulationMode}
                  transientMetrics={rlcTransientTrajectory?.metrics}
                  transientState={rlcState.transient}
                  theme={theme}
                />
              </div>

              {/* Time-Domain Waveforms & Phasor Plot Card */}
              <div className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080c14] shadow-md overflow-hidden flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
                <div className="flex-1 h-full min-w-0 min-h-0">
                  <RlcWaveformPlot
                    config={rlcState.config}
                    topology={rlcState.topology}
                    metrics={rlcMetrics}
                    traces={rlcState.traces}
                    onToggleTrace={(key) =>
                      setRlcState((prev) => ({
                        ...prev,
                        traces: { ...prev.traces, [key]: !prev.traces[key] },
                      }))
                    }
                    theme={theme}
                    currentTimeSec={playback.currentTime}
                    visibleCycles={rlcState.visibleCycles}
                    simulationMode={effectiveSimulationMode}
                    transientState={rlcState.transient}
                  />
                </div>

                {rlcState.showPhasors && effectiveSimulationMode === 'steady' && (
                  <div className="w-full sm:w-60 lg:w-72 h-52 sm:h-full shrink-0 min-w-0">
                    <RlcPhasorPlot config={rlcState.config} metrics={rlcMetrics} theme={theme} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Bar: Playback Controls */}
          <section aria-label="Playback Controls" className="shrink-0 w-full">
            {effectiveSimulationMode === 'transient' ? (
              <PlaybackControls
                playback={{
                  mode: rlcState.transient.isRunning ? 'continuous' : 'idle',
                  isPlaying: rlcState.transient.isRunning,
                  currentTime: rlcState.transient.timeSec,
                  targetCycles: null,
                  cycleProgress: 0,
                }}
                playbackSpeed={playbackSpeed}
                onSetPlaybackSpeed={onUpdatePlaybackSpeed}
                onTogglePlay={handleToggleTransientPlay}
                onResetTime={handleResetTransientTime}
              />
            ) : (
              <PlaybackControls
                playback={playback}
                playbackSpeed={playbackSpeed}
                onSetPlaybackSpeed={onUpdatePlaybackSpeed}
                onTogglePlay={togglePlay}
                onResetTime={resetTime}
              />
            )}
          </section>
        </div>
      ) : (
        /* ==================== 3. THREE PHASE WORKSPACE ==================== */
        <>
          {/* Main Visualizations: Waveform Plot + Phasor Plot + Controls Sidebar */}
          <section
            aria-label="Three-Phase Waveforms and Phasors"
            className="flex-1 min-h-[250px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080c14] shadow-xl overflow-hidden flex flex-col md:flex-row"
          >
            {/* Waveform & Phasor Display */}
            <div className="flex-1 h-full min-w-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
              {/* Three-Phase Waveform Plot (V_A, V_B, V_C, i_N) */}
              <div className="flex-1 h-full min-w-0 min-h-0">
                <ThreePhaseWaveformPlot
                  state={threePhaseState}
                  theme={theme}
                  currentTimeSec={playback.currentTime}
                />
              </div>

              {/* Three-Phase Phasor Plot */}
              {threePhaseState.showPhasors && (
                <div className="w-full md:w-72 lg:w-80 h-64 md:h-full shrink-0 min-w-0">
                  <ThreePhasePhasorPlot state={threePhaseState} theme={theme} />
                </div>
              )}
            </div>

            {/* Three-Phase Controls Sidebar (Phase A, B, C parameters, loads, presets) */}
            <div className="w-full md:w-64 lg:w-72 shrink-0 h-auto md:h-full">
              <ThreePhaseControls
                state={threePhaseState}
                onChange={setThreePhaseState}
                onResetToBalanced={handleResetThreePhaseBalanced}
              />
            </div>
          </section>

          {/* Three-Phase Balance and Neutral Section */}
          <section aria-label="Three-Phase Balance and Neutral" className="shrink-0 w-full">
            <ThreePhaseBalanceNeutralPanel
              state={threePhaseState}
              metrics={threePhaseMetrics}
              onSignalDisplayChange={(mode) =>
                setThreePhaseState((prev) => ({ ...prev, signalDisplay: mode }))
              }
            />
          </section>

          {/* Bottom Bar: Playback Controls */}
          <section aria-label="Playback Controls" className="shrink-0 w-full">
            <PlaybackControls
              playback={playback}
              playbackSpeed={playbackSpeed}
              onSetPlaybackSpeed={onUpdatePlaybackSpeed}
              onTogglePlay={togglePlay}
              onResetTime={resetTime}
            />
          </section>
        </>
      )}
    </div>
  );
};
