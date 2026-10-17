export interface ScadaIntervalConfig {
  intervalSec: number;
  rateHz: number;
  label: string;
  displayString: string;
}

export const SCADA_INTERVAL_OPTIONS: ScadaIntervalConfig[] = [
  {
    intervalSec: 1,
    rateHz: 1,
    label: '1 s (1 Hz)',
    displayString: 'SCADA Update Interval: 1 s (1 Hz)',
  },
  {
    intervalSec: 2,
    rateHz: 0.5,
    label: '2 s (0.5 Hz)',
    displayString: 'SCADA Update Interval: 2 s (0.5 Hz)',
  },
  {
    intervalSec: 3,
    rateHz: 0.3333333333,
    label: '3 s (0.33 Hz)',
    displayString: 'SCADA Update Interval: 3 s (0.33 Hz)',
  },
  {
    intervalSec: 4,
    rateHz: 0.25,
    label: '4 s (0.25 Hz)',
    displayString: 'SCADA Update Interval: 4 s (0.25 Hz)',
  },
  {
    intervalSec: 5,
    rateHz: 0.2,
    label: '5 s (0.2 Hz)',
    displayString: 'SCADA Update Interval: 5 s (0.2 Hz)',
  },
  {
    intervalSec: 6,
    rateHz: 0.1666666667,
    label: '6 s (0.17 Hz)',
    displayString: 'SCADA Update Interval: 6 s (0.17 Hz)',
  },
];

export const DEFAULT_SCADA_INTERVAL_SEC = 5;

export interface ScadaHistoryPoint {
  simTimeSec: number;
  trueRms: number;
  scadaRms: number;
  isSamplePoint: boolean;
}

export interface ScadaTelemetryData {
  trueRms: number;
  scadaRms: number;
  intervalSec: number;
  rateHz: number;
  countdownSec: number;
  progressPercent: number; // 0 to 100%
  sampleCount: number;
  isJustUpdated: boolean;
  deltaError: number;
  deltaErrorPercent: number;
}
