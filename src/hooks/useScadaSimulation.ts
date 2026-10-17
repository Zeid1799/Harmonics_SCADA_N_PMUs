import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { WaveformState, PlaybackState } from '../types/waveform';
import {
  DEFAULT_SCADA_INTERVAL_SEC,
  SCADA_INTERVAL_OPTIONS,
  ScadaHistoryPoint,
  ScadaTelemetryData,
} from '../types/scada';
import { computeTelemetry } from '../model/waveformModel';

interface UseScadaSimulationProps {
  waveformState: WaveformState;
  playback: PlaybackState;
}

export function useScadaSimulation({
  waveformState,
  playback,
}: UseScadaSimulationProps) {
  // User-controlled measurement interval in seconds (default: 5 s)
  const [intervalSec, setIntervalSec] = useState<number>(DEFAULT_SCADA_INTERVAL_SEC);

  // Instantaneous True RMS computed continuously from the physical waveform
  const currentTrueRms = useMemo(() => {
    return computeTelemetry(waveformState).rmsVoltage;
  }, [
    waveformState.fundamentalFrequency,
    waveformState.fundamentalAmplitude,
    waveformState.harmonics?.second,
    waveformState.harmonics?.third,
    waveformState.harmonics?.fourth,
    waveformState.customTerms,
    waveformState.dcOffset,
  ]);

  // SCADA discrete held measurement
  const [scadaRms, setScadaRms] = useState<number>(currentTrueRms);

  // Time tracking
  const lastMeasureSimTimeRef = useRef<number>(0);
  const [countdownSec, setCountdownSec] = useState<number>(intervalSec);
  const [sampleCount, setSampleCount] = useState<number>(1);
  const [isJustUpdated, setIsJustUpdated] = useState<boolean>(false);
  const justUpdatedTimeoutRef = useRef<number | null>(null);

  // Historical trend points for visualizing True RMS vs SCADA RMS over time
  const [history, setHistory] = useState<ScadaHistoryPoint[]>([
    {
      simTimeSec: 0,
      trueRms: currentTrueRms,
      scadaRms: currentTrueRms,
      isSamplePoint: true,
    },
  ]);
  const lastHistoryLogTimeRef = useRef<number>(0);

  // Keep ref to latest currentTrueRms for use inside interval/tick checks
  const trueRmsRef = useRef<number>(currentTrueRms);
  trueRmsRef.current = currentTrueRms;

  // Flash update indicator
  const triggerUpdatePulse = useCallback(() => {
    setIsJustUpdated(true);
    if (justUpdatedTimeoutRef.current) {
      window.clearTimeout(justUpdatedTimeoutRef.current);
    }
    justUpdatedTimeoutRef.current = window.setTimeout(() => {
      setIsJustUpdated(false);
    }, 450);
  }, []);

  // Handler to change SCADA interval
  const handleSetInterval = useCallback(
    (newInterval: number) => {
      setIntervalSec(newInterval);
      const currentTime = playback.currentTime;
      const elapsed = currentTime - lastMeasureSimTimeRef.current;

      if (elapsed >= newInterval) {
        // Immediate measurement trigger if elapsed time already exceeds new interval
        const currentRms = trueRmsRef.current;
        setScadaRms(currentRms);
        lastMeasureSimTimeRef.current = currentTime;
        setCountdownSec(newInterval);
        setSampleCount((prev) => prev + 1);
        triggerUpdatePulse();

        setHistory((prev) => [
          ...prev.slice(-400),
          {
            simTimeSec: currentTime,
            trueRms: currentRms,
            scadaRms: currentRms,
            isSamplePoint: true,
          },
        ]);
      } else {
        // Adapt countdown immediately to the new interval
        setCountdownSec(Math.max(0, newInterval - elapsed));
      }
    },
    [playback.currentTime, triggerUpdatePulse]
  );

  // Reset simulation handler (when time is reset to 0)
  useEffect(() => {
    if ((playback?.currentTime ?? 0) === 0) {
      lastMeasureSimTimeRef.current = 0;
      lastHistoryLogTimeRef.current = 0;
      setCountdownSec(intervalSec);
      setScadaRms(currentTrueRms);
      setSampleCount(1);
      setHistory([
        {
          simTimeSec: 0,
          trueRms: currentTrueRms,
          scadaRms: currentTrueRms,
          isSamplePoint: true,
        },
      ]);
    }
  }, [(playback?.currentTime ?? 0) === 0, intervalSec, currentTrueRms]);

  // Main SCADA simulation monitor triggered as playback time advances
  useEffect(() => {
    const currentTime = playback?.currentTime ?? 0;
    const isPlaying = playback?.isPlaying ?? false;

    if (!isPlaying) {
      // Simulation is paused:
      // - Do NOT advance SCADA measurement timer
      // - SCADA measurement remains at most recent captured value
      // - True RMS recalculates immediately (via currentTrueRms memo)
      return;
    }

    const elapsed = currentTime - lastMeasureSimTimeRef.current;
    const remaining = Math.max(0, intervalSec - elapsed);
    setCountdownSec(remaining);

    // Periodic history logging (every ~50ms of sim time)
    if (currentTime - lastHistoryLogTimeRef.current >= 0.05) {
      lastHistoryLogTimeRef.current = currentTime;
      setHistory((prev) => {
        const next = [
          ...prev.slice(-500),
          {
            simTimeSec: currentTime,
            trueRms: currentTrueRms,
            scadaRms,
            isSamplePoint: false,
          },
        ];
        return next;
      });
    }

    // Check if measurement interval tick reached
    if (elapsed >= intervalSec) {
      const capturedRms = currentTrueRms;
      setScadaRms(capturedRms);
      lastMeasureSimTimeRef.current = currentTime;
      setCountdownSec(intervalSec);
      setSampleCount((prev) => prev + 1);
      triggerUpdatePulse();

      // Record discrete sample point in history
      setHistory((prev) => [
        ...prev.slice(-500),
        {
          simTimeSec: currentTime,
          trueRms: capturedRms,
          scadaRms: capturedRms,
          isSamplePoint: true,
        },
      ]);
    }
  }, [
    playback.currentTime,
    playback.isPlaying,
    intervalSec,
    currentTrueRms,
    scadaRms,
    triggerUpdatePulse,
  ]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (justUpdatedTimeoutRef.current) {
        clearTimeout(justUpdatedTimeoutRef.current);
      }
    };
  }, []);

  // Compute config and telemetry metrics
  const activeConfig = useMemo(() => {
    const found = SCADA_INTERVAL_OPTIONS.find((opt) => opt.intervalSec === intervalSec);
    if (found) return found;
    const rate = 1 / intervalSec;
    return {
      intervalSec,
      rateHz: rate,
      label: `${intervalSec} s (${rate.toFixed(2)} Hz)`,
      displayString: `SCADA Update Interval: ${intervalSec} s (${rate.toFixed(2)} Hz)`,
    };
  }, [intervalSec]);

  const elapsedSinceMeasure = playback.currentTime - lastMeasureSimTimeRef.current;
  const progressPercent = Math.min(100, Math.max(0, (elapsedSinceMeasure / intervalSec) * 100));

  const deltaError = Math.abs(currentTrueRms - scadaRms);
  const deltaErrorPercent = currentTrueRms > 0 ? (deltaError / currentTrueRms) * 100 : 0;

  const telemetry: ScadaTelemetryData = {
    trueRms: currentTrueRms,
    scadaRms,
    intervalSec,
    rateHz: activeConfig.rateHz,
    countdownSec,
    progressPercent,
    sampleCount,
    isJustUpdated,
    deltaError,
    deltaErrorPercent,
  };

  return {
    intervalSec,
    setIntervalSec: handleSetInterval,
    activeConfig,
    telemetry,
    history,
    triggerManualPoll: useCallback(() => {
      const nowTime = playback?.currentTime ?? 0;
      setScadaRms(currentTrueRms);
      lastMeasureSimTimeRef.current = nowTime;
      setCountdownSec(intervalSec);
      setSampleCount((prev) => prev + 1);
      triggerUpdatePulse();
      setHistory((prev) => [
        ...prev.slice(-500),
        {
          simTimeSec: nowTime,
          trueRms: currentTrueRms,
          scadaRms: currentTrueRms,
          isSamplePoint: true,
        },
      ]);
    }, [currentTrueRms, playback?.currentTime, intervalSec, triggerUpdatePulse]),
  };
}
