import React, { useState, useMemo, useCallback } from 'react';
import { WaveformState, PlaybackState } from '../../types/waveform';
import { AppTheme, WorkspaceLayout } from '../../types/settings';
import {
  PmuSettings,
  InjectedDisturbance,
  DEFAULT_PMU_SETTINGS,
  DEFAULT_DISTURBANCES,
  PmuMeasurementSnapshot,
} from '../../types/pmu';
import { evaluatePmuCapture } from '../../model/pmuModel';
import { PmuTimeDomainPlot } from './PmuTimeDomainPlot';
import { PmuFrequencyDomainComparison } from './PmuFrequencyDomainComparison';
import { PmuDisturbancesPanel } from './PmuDisturbancesPanel';
import { PmuSignalAndPlaybackPanel } from './PmuSignalAndPlaybackPanel';
import { PmuInjectionConfigPanel } from './PmuInjectionConfigPanel';

interface PmuViewProps {
  theme: AppTheme;
  layout: WorkspaceLayout;
  waveformState: WaveformState;
  onUpdateWaveform: (updater: (prev: WaveformState) => WaveformState) => void;
  playback: PlaybackState;
  playbackSpeed: number;
  onSetPlaybackSpeed: (speed: number) => void;
  onTogglePlay: () => void;
  onResetTime: () => void;
  pmuSettings?: PmuSettings;
  onUpdatePmuSettings?: React.Dispatch<React.SetStateAction<PmuSettings>>;
  disturbances?: InjectedDisturbance[];
  onUpdateDisturbances?: React.Dispatch<React.SetStateAction<InjectedDisturbance[]>>;
  sampleNonce?: number;
  onTakeNewMeasurement?: () => void;
}

export const PmuView: React.FC<PmuViewProps> = ({
  theme,
  layout,
  waveformState,
  onUpdateWaveform,
  playback,
  playbackSpeed,
  onSetPlaybackSpeed,
  onTogglePlay,
  onResetTime,
  pmuSettings: externalPmuSettings,
  onUpdatePmuSettings: externalOnUpdatePmuSettings,
  disturbances: externalDisturbances,
  onUpdateDisturbances: externalOnUpdateDisturbances,
  sampleNonce: externalSampleNonce,
  onTakeNewMeasurement: externalOnTakeNewMeasurement,
}) => {
  // PMU Configuration (Class, Reporting Rate, Zone 3 Probabilities, Seed)
  const [internalSettings, setInternalSettings] = useState<PmuSettings>(DEFAULT_PMU_SETTINGS);
  const settings = externalPmuSettings ?? internalSettings;
  const setSettings = externalOnUpdatePmuSettings ?? setInternalSettings;

  // Injected Oscillatory Disturbances
  const [internalDisturbances, setInternalDisturbances] = useState<InjectedDisturbance[]>(DEFAULT_DISTURBANCES);
  const disturbances = externalDisturbances ?? internalDisturbances;
  const setDisturbances = externalOnUpdateDisturbances ?? setInternalDisturbances;

  // Trigger counter for explicitly generating fresh Zone 3 stochastic Bernoulli trials
  const [internalSampleNonce, setInternalSampleNonce] = useState<number>(1);
  const sampleNonce = externalSampleNonce ?? internalSampleNonce;

  const internalTakeNewMeasurement = useCallback(() => {
    setInternalSampleNonce((prev) => prev + 1);
  }, []);
  const handleTakeNewMeasurement = externalOnTakeNewMeasurement ?? internalTakeNewMeasurement;

  // Measurement Snapshot Lifecycle:
  // Re-evaluated ONLY when waveform parameters, disturbance settings, PMU configuration,
  // or explicit re-sample trigger changes.
  // CONTINUOUS ANIMATION (playback.currentTime) DOES NOT TRIGGER RECALCULATION!
  const snapshot: PmuMeasurementSnapshot = useMemo(() => {
    return evaluatePmuCapture(waveformState, disturbances, settings);
    // Dependencies omit playback.currentTime so stochastic outcomes stay stable during playback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    waveformState.fundamentalFrequency,
    waveformState.fundamentalAmplitude,
    waveformState.harmonics?.second,
    waveformState.harmonics?.third,
    waveformState.harmonics?.fourth,
    waveformState.dcOffset,
    waveformState.phase,
    waveformState.customTerms,
    disturbances,
    settings.pmuClass,
    settings.reportingRate,
    settings.probabilities.pMiss,
    settings.probabilities.pAlias,
    settings.probabilities.pAtten,
    settings.seed,
    sampleNonce,
  ]);

  const currentMergedState: WaveformState = {
    ...waveformState,
    playback,
  };

  return (
    <div className="h-full max-w-7xl mx-auto flex flex-col justify-between gap-2.5 p-2.5 sm:p-3 overflow-hidden">
      {/* 1. Primary Visualizations Container: Asymmetric Split Prioritizing Time-Domain */}
      <section
        aria-label="PMU Time-Domain and Frequency-Domain Visualizations"
        className="flex-1 min-h-[340px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080c14] shadow-xl overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800"
      >
        {/* Time Domain Plot: Overlaid True solid and PMU dotted */}
        {(layout === 'both' || layout === 'time') && (
          <div className="flex-1 h-full min-w-0 min-h-0">
            <PmuTimeDomainPlot
              state={currentMergedState}
              snapshot={snapshot}
              disturbances={disturbances}
              theme={theme}
              visibleCycles={waveformState.visibleCycles}
              onCyclesChange={(cycles) => onUpdateWaveform((prev) => ({ ...prev, visibleCycles: cycles }))}
            />
          </div>
        )}

        {/* Frequency Domain Spectrum: PMU-Captured Spectrum with Grey True Overlay */}
        {(layout === 'both' || layout === 'frequency') && (
          <div className="flex-1 h-full min-w-0 min-h-0">
            <PmuFrequencyDomainComparison
              snapshot={snapshot}
              theme={theme}
              onTakeNewMeasurement={handleTakeNewMeasurement}
            />
          </div>
        )}
      </section>

      {/* 2. Unified Master Control Dock: Disturbances & PMU Settings (Left) | Waveform & Playback (Right) */}
      <section
        aria-label="PMU Configuration, Disturbance Injection, and Playback Controls"
        className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-2.5 items-start min-w-0"
      >
        {/* Left Console: PMU Class, Reporting Rate, Dynamic Zones & Injected Disturbances Manager */}
        <div className="min-w-0">
          <PmuDisturbancesPanel
            settings={settings}
            onUpdateSettings={setSettings}
            snapshot={snapshot}
            disturbances={disturbances}
            onUpdateDisturbances={setDisturbances}
            onTakeNewMeasurement={handleTakeNewMeasurement}
            theme={theme}
          />
        </div>

        {/* Right Column: Waveform Customization & Playback Engine, followed by Injection Configuration Panel */}
        <div className="flex flex-col justify-start gap-2.5 min-w-0">
          <PmuSignalAndPlaybackPanel
            waveformState={waveformState}
            onUpdateWaveform={onUpdateWaveform}
            playback={playback}
            playbackSpeed={playbackSpeed}
            onSetPlaybackSpeed={onSetPlaybackSpeed}
            onTogglePlay={onTogglePlay}
            onResetTime={onResetTime}
            disturbances={disturbances}
            snapshot={snapshot}
            theme={theme}
          />
          <PmuInjectionConfigPanel
            nominalFundamental={snapshot.nominalFundamental}
            disturbances={disturbances}
            onUpdateDisturbances={setDisturbances}
            theme={theme}
          />
        </div>
      </section>
    </div>
  );
};
