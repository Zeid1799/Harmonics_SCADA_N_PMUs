import { useState, useRef, useEffect, useCallback } from 'react';
import { PlaybackState } from '../types/waveform';

interface UseWaveformPlaybackProps {
  fundamentalFrequency: number;
  onTimeUpdate?: (time: number) => void;
}

export function useWaveformPlayback({ fundamentalFrequency }: UseWaveformPlaybackProps) {
  const [playback, setPlayback] = useState<PlaybackState>({
    mode: 'idle',
    isPlaying: false,
    currentTime: 0,
    targetCycles: null,
    cycleProgress: 0,
  });

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(0.25); // Default 0.25x so 60 Hz waves are visually trackable

  // Refs for animation loop to avoid stale closures
  const playbackRef = useRef<PlaybackState>(playback);
  playbackRef.current = playback;

  const freqRef = useRef<number>(fundamentalFrequency);
  freqRef.current = fundamentalFrequency;

  const speedRef = useRef<number>(playbackSpeed);
  speedRef.current = playbackSpeed;

  const lastFrameTimeRef = useRef<number | null>(null);
  const cycleStartSimTimeRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);

  // Stop animation
  const stop = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    lastFrameTimeRef.current = null;
    setPlayback((prev) => ({
      ...prev,
      mode: 'idle',
      isPlaying: false,
      targetCycles: null,
      cycleProgress: 0,
    }));
  }, []);

  // Pause continuous playback without resetting currentTime
  const pause = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    lastFrameTimeRef.current = null;
    setPlayback((prev) => ({
      ...prev,
      mode: 'idle',
      isPlaying: false,
    }));
  }, []);

  // Play continuous mode
  const playContinuous = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }
    lastFrameTimeRef.current = null;

    setPlayback((prev) => ({
      ...prev,
      mode: 'continuous',
      isPlaying: true,
      targetCycles: null,
      cycleProgress: 0,
    }));
  }, []);

  // Play single cycle (1 cycle = T = 1/f)
  const playSingleCycle = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }
    lastFrameTimeRef.current = null;
    cycleStartSimTimeRef.current = 0;

    setPlayback({
      mode: 'single-cycle',
      isPlaying: true,
      currentTime: 0,
      targetCycles: 1,
      cycleProgress: 0,
    });
  }, []);

  // Play 10 cycles (10 cycles = 10 * T = 10/f)
  const playTenCycles = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }
    lastFrameTimeRef.current = null;
    cycleStartSimTimeRef.current = 0;

    setPlayback({
      mode: 'ten-cycles',
      isPlaying: true,
      currentTime: 0,
      targetCycles: 10,
      cycleProgress: 0,
    });
  }, []);

  // Reset simulation time to 0
  const resetTime = useCallback(() => {
    setPlayback((prev) => ({
      ...prev,
      currentTime: 0,
      cycleProgress: 0,
    }));
  }, []);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (playbackRef.current.isPlaying) {
      pause();
    } else {
      playContinuous();
    }
  }, [pause, playContinuous]);

  // Main animation loop
  useEffect(() => {
    if (!playback.isPlaying) return;

    const animate = (timestamp: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = timestamp;
      }

      const deltaWallSec = Math.min((timestamp - lastFrameTimeRef.current) / 1000, 0.1);
      lastFrameTimeRef.current = timestamp;

      // Delta simulation time adjusted by playback speed
      const deltaSimSec = deltaWallSec * speedRef.current;
      const currentSimTime = playbackRef.current.currentTime + deltaSimSec;

      const f = Math.max(1, freqRef.current);
      const periodSec = 1 / f;

      if (playbackRef.current.mode === 'continuous') {
        // Continuous mode: smoothly advances indefinitely
        setPlayback((prev) => ({
          ...prev,
          currentTime: currentSimTime,
        }));
        animFrameIdRef.current = requestAnimationFrame(animate);
      } else if (
        playbackRef.current.mode === 'single-cycle' ||
        playbackRef.current.mode === 'ten-cycles'
      ) {
        const targetCycles = playbackRef.current.targetCycles || 1;
        const totalDurationSec = targetCycles * periodSec;
        const elapsedSinceStart = currentSimTime - cycleStartSimTimeRef.current;
        const progress = Math.min(1, elapsedSinceStart / totalDurationSec);

        if (progress >= 1) {
          // Finished cycle limit
          setPlayback((prev) => ({
            ...prev,
            isPlaying: false,
            mode: 'idle',
            currentTime: cycleStartSimTimeRef.current + totalDurationSec,
            cycleProgress: 1,
          }));
          animFrameIdRef.current = null;
        } else {
          setPlayback((prev) => ({
            ...prev,
            currentTime: currentSimTime,
            cycleProgress: progress,
          }));
          animFrameIdRef.current = requestAnimationFrame(animate);
        }
      }
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
    };
  }, [playback.isPlaying, playback.mode]);

  return {
    playback,
    playbackSpeed,
    setPlaybackSpeed,
    playContinuous,
    playSingleCycle,
    playTenCycles,
    pause,
    stop,
    togglePlay,
    resetTime,
  };
}
