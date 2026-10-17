import { WaveformState } from '../types/waveform';
import { evaluateWaveform } from './waveformModel';

export interface SamplePoint {
  tRelativeMs: number; // time offset in milliseconds from start of window
  tAbsoluteSec: number; // total continuous simulation time
  y: number; // composite amplitude in pu
  yFundamental?: number;
  yHarmonic2?: number;
  yHarmonic3?: number;
  yHarmonic4?: number;
}

export interface WaveformWindowData {
  points: SamplePoint[];
  windowDurationSec: number;
  windowDurationMs: number;
  fundamentalPeriodMs: number;
  yMin: number;
  yMax: number;
  cyclesShown: number;
}

/**
 * Computes an appropriate time window and samples points for the waveform display.
 * Displays a fixed number of fundamental cycles (default 3 cycles) to ensure
 * smooth, consistent visualization across 1 Hz to 120 Hz.
 */
export function generateWaveformData(
  state: WaveformState,
  currentTimeSec: number = 0,
  cyclesShown: number = state.visibleCycles ?? 3,
  numPoints?: number
): WaveformWindowData {
  const effectiveCycles = Math.max(1, cyclesShown);
  const actualPointsCount = numPoints ?? Math.max(800, Math.min(4000, effectiveCycles * 60));

  const f = Math.max(1, state.fundamentalFrequency);
  const fundamentalPeriodSec = 1 / f;
  const fundamentalPeriodMs = fundamentalPeriodSec * 1000;
  const windowDurationSec = effectiveCycles * fundamentalPeriodSec;
  const windowDurationMs = windowDurationSec * 1000;

  const points: SamplePoint[] = new Array(actualPointsCount);
  const a1 = state.fundamentalAmplitude;
  const phaseRad = (state.phase * Math.PI) / 180;

  for (let i = 0; i < actualPointsCount; i++) {
    const fraction = i / (actualPointsCount - 1);
    const relSec = fraction * windowDurationSec;
    const absSec = currentTimeSec + relSec;

    // Composite value
    const yComposite = evaluateWaveform(state, absSec);

    // Component breakdowns for ghost traces
    const harmonics = state.harmonics || { second: 0, third: 0, fourth: 0 };
    const yFund = a1 * Math.sin(2 * Math.PI * f * absSec + phaseRad);
    const yH2 = harmonics.second > 0
      ? a1 * (harmonics.second / 100) * Math.sin(2 * Math.PI * (2 * f) * absSec + 2 * phaseRad)
      : 0;
    const yH3 = harmonics.third > 0
      ? a1 * (harmonics.third / 100) * Math.sin(2 * Math.PI * (3 * f) * absSec + 3 * phaseRad)
      : 0;
    const yH4 = harmonics.fourth > 0
      ? a1 * (harmonics.fourth / 100) * Math.sin(2 * Math.PI * (4 * f) * absSec + 4 * phaseRad)
      : 0;

    points[i] = {
      tRelativeMs: relSec * 1000,
      tAbsoluteSec: absSec,
      y: yComposite,
      yFundamental: yFund,
      yHarmonic2: yH2,
      yHarmonic3: yH3,
      yHarmonic4: yH4,
    };
  }

  // Vertical scale: comfortable range encompassing ±2.0 pu
  const yMin = -2.2;
  const yMax = 2.2;

  return {
    points,
    windowDurationSec,
    windowDurationMs,
    fundamentalPeriodMs,
    yMin,
    yMax,
    cyclesShown,
  };
}
