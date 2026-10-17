import React from 'react';
import { WaveformState, PlaybackState } from '../../types/waveform';
import { AppTheme, WorkspaceLayout } from '../../types/settings';
import { useScadaSimulation } from '../../hooks/useScadaSimulation';
import { ScadaWaveformPlot } from './ScadaWaveformPlot';
import { ScadaFrequencyPlot } from './ScadaFrequencyPlot';
import { ScadaIntervalControl } from './ScadaIntervalControl';
import { ScadaSignalAndPlaybackPanel } from './ScadaSignalAndPlaybackPanel';

interface ScadaViewProps {
  theme: AppTheme;
  layout: WorkspaceLayout;
  waveformState: WaveformState;
  onUpdateWaveform: (updater: (prev: WaveformState) => WaveformState) => void;
  playback: PlaybackState;
  playbackSpeed: number;
  onSetPlaybackSpeed: (speed: number) => void;
  onTogglePlay: () => void;
  onResetTime: () => void;
  scadaSimulation?: ReturnType<typeof useScadaSimulation>;
}

export const ScadaView: React.FC<ScadaViewProps> = ({
  theme,
  layout,
  waveformState,
  onUpdateWaveform,
  playback,
  playbackSpeed,
  onSetPlaybackSpeed,
  onTogglePlay,
  onResetTime,
  scadaSimulation: externalScadaSimulation,
}) => {
  const currentMergedState: WaveformState = {
    ...waveformState,
    playback,
  };

  const internalScadaSimulation = useScadaSimulation({
    waveformState: currentMergedState,
    playback,
  });

  const {
    intervalSec,
    setIntervalSec,
    telemetry,
    history,
    triggerManualPoll,
  } = externalScadaSimulation ?? internalScadaSimulation;

  return (
    <div className="h-full max-w-7xl mx-auto flex flex-col justify-between gap-2.5 p-2.5 sm:p-3 overflow-hidden">
      {/* 1. Primary Visualizations Container: Asymmetric Split Prioritizing Time-Domain */}
      <section
        aria-label="SCADA Telemetry and Underlying Signal Visualizations"
        className="flex-1 min-h-[340px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080c14] shadow-xl overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800"
      >
        {/* Time Domain Plot: Dominant primary visualization (~68-70% width in split view) */}
        {(layout === 'both' || layout === 'time') && (
          <div className={`${layout === 'both' ? 'flex-[2.1] lg:flex-[2.2]' : 'flex-1'} h-full min-w-0 min-h-0`}>
            <ScadaWaveformPlot
              state={currentMergedState}
              telemetry={telemetry}
              history={history}
              theme={theme}
              visibleCycles={waveformState.visibleCycles}
              onCyclesChange={(cycles) => {
                onUpdateWaveform((prev) => ({
                  ...prev,
                  visibleCycles: cycles,
                }));
              }}
            />
          </div>
        )}

        {/* Frequency Domain Plot: Compact & legible secondary view (~30-32% width in split view) */}
        {(layout === 'both' || layout === 'frequency') && (
          <div className={`${layout === 'both' ? 'flex-1 min-w-[260px] md:max-w-xs lg:max-w-sm' : 'flex-1'} h-full min-w-0 min-h-0`}>
            <ScadaFrequencyPlot
              state={waveformState}
              theme={theme}
            />
          </div>
        )}
      </section>

      {/* 2. Unified Master Control Dock: SCADA Telemetry & Interval (Left) | Waveform & Playback (Right) */}
      <section
        aria-label="SCADA Telemetry, Waveform Customization, and Playback Controls"
        className="shrink-0 grid grid-cols-1 md:grid-cols-2 gap-2.5 items-stretch"
      >
        {/* Left Console: SCADA Reporting Interval & Live RMS Telemetry */}
        <div className="h-full">
          <ScadaIntervalControl
            intervalSec={intervalSec}
            onSetInterval={setIntervalSec}
            telemetry={telemetry}
            isPlaying={playback.isPlaying}
            onManualPoll={triggerManualPoll}
          />
        </div>

        {/* Right Console: Waveform Customization & Playback Engine */}
        <div className="h-full">
          <ScadaSignalAndPlaybackPanel
            waveformState={waveformState}
            onUpdateWaveform={onUpdateWaveform}
            playback={playback}
            playbackSpeed={playbackSpeed}
            onSetPlaybackSpeed={onSetPlaybackSpeed}
            onTogglePlay={onTogglePlay}
            onResetTime={onResetTime}
          />
        </div>
      </section>
    </div>
  );
};
