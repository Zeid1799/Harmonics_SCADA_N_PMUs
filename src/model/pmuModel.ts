import {
  PmuClass,
  PmuReportingRate,
  ZoneType,
  InjectedDisturbance,
  PmuSettings,
  PmuMeasurementSnapshot,
  CapturedPmuComponent,
  DisturbanceCaptureOutcome,
  TrueSpectralComponent,
  PmuWaveformWindowData,
  PmuSamplePoint,
  PmuReportFrame,
  DEFAULT_PMU_SETTINGS,
  getDisturbanceColor,
} from '../types/pmu';
export { DEFAULT_PMU_SETTINGS };
import { WaveformState } from '../types/waveform';

/**
 * Creates a reproducible pseudo-random number generator if a seed is provided,
 * otherwise delegates to Math.random.
 */
export function createRng(seed?: number): () => number {
  if (seed !== undefined) {
    let s = (seed >>> 0) || 123456789;
    return () => {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  return Math.random;
}

/**
 * Calculates Zone 1 standardized dynamic-performance limit (in Hz relative to fundamental):
 * P-Class: min(Fs / 10, 2 Hz)
 * M-Class: min(Fs / 5, 5 Hz)
 */
export function getZone1Limit(rate: PmuReportingRate, pmuClass: PmuClass): number {
  if (pmuClass === 'P-Class') {
    return Math.round(Math.min(rate / 10, 2) * 10) / 10;
  }
  return Math.round(Math.min(rate / 5, 5) * 10) / 10;
}

/**
 * Calculates Zone 2 reporting-stream Nyquist limit (in Hz relative to fundamental).
 * Nyquist frequency = Reporting rate / 2.
 */
export function getZone2Nyquist(rate: PmuReportingRate): number {
  return rate / 2;
}

/**
 * Determines which zone an injected modulation frequency belongs to:
 * - Zone 1: frequency <= Zone 1 Limit
 * - Zone 2: Zone 1 Limit < frequency <= Zone 2 Nyquist
 * - Zone 3: frequency > Zone 2 Nyquist
 */
export function determineDisturbanceZone(
  modulationFreq: number,
  zone1Limit: number,
  zone2Limit: number
): ZoneType {
  const f = Math.abs(modulationFreq);
  if (f <= zone1Limit) return 1;
  if (f <= zone2Limit) return 2;
  return 3;
}

/**
 * Exact Zone 2 attenuation formula:
 * Captured amplitude = A * Sin(180 * ((f0 - frequency) * 0.1))
 * where angle inside Sin is in degrees, and f0 is the nominal fundamental frequency (50 or 60 Hz).
 *
 * Negative results are represented consistently as a nonnegative amplitude
 * with a phase reversal (Math.PI radians / 180 degrees).
 */
export function calculateZone2Capture(
  A: number,
  modulationFreq: number,
  f0: number = 60
): {
  amplitude: number;
  phaseShiftRad: number;
  rawFactor: number;
} {
  const deg = 180 * ((f0 - modulationFreq) * 0.1);
  const rad = (deg * Math.PI) / 180;
  const rawFactor = Math.sin(rad);
  const signedAmp = A * rawFactor;

  if (Math.abs(signedAmp) < 1e-6) {
    return { amplitude: 0, phaseShiftRad: 0, rawFactor: 0 };
  }

  if (signedAmp < 0) {
    return {
      amplitude: Math.abs(signedAmp),
      phaseShiftRad: Math.PI,
      rawFactor,
    };
  }

  return {
    amplitude: signedAmp,
    phaseShiftRad: 0,
    rawFactor,
  };
}

/**
 * Exact Zone 3 random attenuation formula:
 * Captured amplitude = 0.4 * A * Sin(180 * ((f0 - frequency) * 0.1))
 * where angle inside Sin is in degrees, and f0 is the nominal fundamental frequency (50 or 60 Hz).
 *
 * Negative results are represented consistently as a nonnegative amplitude
 * with a phase reversal.
 */
export function calculateZone3Attenuation(
  A: number,
  modulationFreq: number,
  f0: number = 60
): {
  amplitude: number;
  phaseShiftRad: number;
  rawFactor: number;
} {
  const deg = 180 * ((f0 - modulationFreq) * 0.1);
  const rad = (deg * Math.PI) / 180;
  const rawFactor = 0.4 * Math.sin(rad);
  const signedAmp = A * rawFactor;

  if (Math.abs(signedAmp) < 1e-6) {
    return { amplitude: 0, phaseShiftRad: 0, rawFactor: 0 };
  }

  if (signedAmp < 0) {
    return {
      amplitude: Math.abs(signedAmp),
      phaseShiftRad: Math.PI,
      rawFactor,
    };
  }

  return {
    amplitude: signedAmp,
    phaseShiftRad: 0,
    rawFactor,
  };
}

/**
 * Calculates physically consistent apparent aliasing frequency within the representable
 * synchrophasor stream Nyquist range [0, Fs/2].
 *
 * Frequency-folding convention:
 * f_alias = abs(((modulationFreq + Fs / 2) mod Fs) - Fs / 2)
 *
 * Note: Under conventional single-rate sampling, the folded alias frequency always
 * maps into [0, Fs/2]. It cannot physically lie above the reporting Nyquist limit.
 * Depending on the reporting rate Fs and PMU class, f_alias may fall into Zone 1
 * (if f_alias <= Zone 1 limit) or Zone 2 (if Zone 1 limit < f_alias <= Fs/2).
 */
export function calculateAliasFrequency(
  modulationFreq: number,
  rate: PmuReportingRate
): number {
  const Fs = rate;
  const half = Fs / 2;
  const mod = ((modulationFreq + half) % Fs + Fs) % Fs;
  const folded = Math.abs(mod - half);
  return Math.round(folded * 100) / 100;
}

/**
 * Combines multiple PMU spectral components that map to the exact same frequency (e.g. through aliasing)
 * using physical in-phase and quadrature vector addition:
 *   I = sum(A_k * cos(phi_k))
 *   Q = sum(A_k * sin(phi_k))
 *   A_comb = sqrt(I^2 + Q^2)
 *   phi_comb = atan2(Q, I)
 */
export function combineOverlappingPmuComponents(
  components: CapturedPmuComponent[]
): CapturedPmuComponent[] {
  const groups: { [key: string]: CapturedPmuComponent[] } = {};
  for (const comp of components) {
    const key = (Math.round(comp.frequency * 10) / 10).toFixed(1);
    if (!groups[key]) groups[key] = [];
    groups[key].push(comp);
  }

  const combined: CapturedPmuComponent[] = [];
  for (const key of Object.keys(groups)) {
    const group = groups[key];
    if (group.length === 1) {
      combined.push(group[0]);
    } else {
      let sumI = 0;
      let sumQ = 0;
      for (const c of group) {
        sumI += c.amplitude * Math.cos(c.phaseShiftRad || 0);
        sumQ += c.amplitude * Math.sin(c.phaseShiftRad || 0);
      }
      const combAmp = Math.sqrt(sumI * sumI + sumQ * sumQ);
      if (combAmp > 0.0001) {
        let combPhase = Math.atan2(sumQ, sumI);
        if (combPhase < 0) combPhase += 2 * Math.PI;

        const first = group[0];
        const anyAliased = group.some((c) => c.isAliased);
        const anyAttenuated = group.some((c) => c.isAttenuated);
        const anyCarrier = group.some((c) => c.isCarrier);

        combined.push({
          ...first,
          id: group.map((c) => c.id).join('+'),
          amplitude: Math.round(combAmp * 1000) / 1000,
          phaseShiftRad: combPhase,
          label: group.length > 1
            ? `${group.map((c) => c.disturbanceId.split('-')[0] || c.label).join('+')} (${combAmp.toFixed(2)}pu)`
            : first.label,
          isAliased: anyAliased,
          isAttenuated: anyAttenuated,
          isCarrier: anyCarrier,
        });
      }
    }
  }

  return combined.sort((a, b) => a.frequency - b.frequency);
}

let nextSnapshotId = 1;

/**
 * Evaluates the PMU capture model for a given set of waveform settings, injected disturbances,
 * and PMU configuration.
 *
 * This function generates an immutable PmuMeasurementSnapshot containing the exact
 * captured-component data used for both the PMU frequency spectrum and the reconstructed
 * time-domain waveform.
 */
export function evaluatePmuCapture(
  state: WaveformState,
  disturbances: InjectedDisturbance[],
  settings: PmuSettings = DEFAULT_PMU_SETTINGS,
  rngFunc?: () => number
): PmuMeasurementSnapshot {
  const rng = rngFunc || createRng(settings.seed);

  const f0 = Math.max(1, state.fundamentalFrequency || 60);
  const a1 = state.fundamentalAmplitude;
  const zone1Limit = getZone1Limit(settings.reportingRate, settings.pmuClass);
  const zone2Limit = getZone2Nyquist(settings.reportingRate);

  const zone1Band = {
    min: Math.round((f0 - zone1Limit) * 10) / 10,
    max: Math.round((f0 + zone1Limit) * 10) / 10,
  };
  const zone2Band = {
    min: Math.round((f0 - zone2Limit) * 10) / 10,
    max: Math.round((f0 + zone2Limit) * 10) / 10,
  };

  // 1. Build Ground Truth (True Signal) Spectral Components
  const trueComponents: TrueSpectralComponent[] = [];

  // Carrier component
  trueComponents.push({
    frequency: f0,
    amplitude: a1,
    label: `Carrier f₀ (${a1.toFixed(2)}pu)`,
    isCarrier: true,
  });

  // Base harmonics if present in waveform
  if (state.harmonics) {
    if (state.harmonics.second > 0) {
      trueComponents.push({
        frequency: f0 * 2,
        amplitude: (state.harmonics.second / 100) * a1,
        label: `2nd Harm (${((state.harmonics.second / 100) * a1).toFixed(2)}pu)`,
        isHarmonic: true,
      });
    }
    if (state.harmonics.third > 0) {
      trueComponents.push({
        frequency: f0 * 3,
        amplitude: (state.harmonics.third / 100) * a1,
        label: `3rd Harm (${((state.harmonics.third / 100) * a1).toFixed(2)}pu)`,
        isHarmonic: true,
      });
    }
    if (state.harmonics.fourth > 0) {
      trueComponents.push({
        frequency: f0 * 4,
        amplitude: (state.harmonics.fourth / 100) * a1,
        label: `4th Harm (${((state.harmonics.fourth / 100) * a1).toFixed(2)}pu)`,
        isHarmonic: true,
      });
    }
  }

  // User-injected disturbances in True Spectrum
  const activeDisturbances = disturbances.filter((d) => d.enabled && d.amplitude > 0);

  for (const dist of activeDisturbances) {
    const fm = dist.modulationFrequency;
    const isAdditive = dist.type === 'additive';
    const additiveTarget = dist.additiveTarget || 'lower';
    const zone = determineDisturbanceZone(fm, zone1Limit, zone2Limit);
    const distColor = dist.color || getDisturbanceColor(dist).id;

    if (isAdditive) {
      // Single additive sinusoidal tone at f0 - fm (lower) or f0 + fm (upper)
      const fTone = additiveTarget === 'upper'
        ? Math.round((f0 + fm) * 10) / 10
        : Math.max(0.1, Math.round((f0 - fm) * 10) / 10);
      const signLabel = additiveTarget === 'upper' ? `+${fm}` : `-${fm}`;

      trueComponents.push({
        frequency: fTone,
        modulationFrequency: fm,
        amplitude: dist.amplitude,
        label: `${dist.name} (${signLabel}Hz)`,
        isDisturbance: true,
        disturbanceId: dist.id,
        color: distColor,
        zone,
      });
    } else {
      // Amplitude modulation: produces 2 symmetric sidebands around f0
      const fLower = Math.max(0.1, Math.round((f0 - fm) * 10) / 10);
      const fUpper = Math.round((f0 + fm) * 10) / 10;

      trueComponents.push({
        frequency: fLower,
        modulationFrequency: fm,
        amplitude: dist.amplitude,
        label: `${dist.name} (-${fm}Hz)`,
        isDisturbance: true,
        disturbanceId: dist.id,
        color: distColor,
        zone,
      });

      trueComponents.push({
        frequency: fUpper,
        modulationFrequency: fm,
        amplitude: dist.amplitude,
        label: `${dist.name} (+${fm}Hz)`,
        isDisturbance: true,
        disturbanceId: dist.id,
        color: distColor,
        zone,
      });
    }
  }

  // 2. Evaluate PMU Measurement Model for Each Disturbance
  const outcomes: DisturbanceCaptureOutcome[] = [];
  const pmuComponents: CapturedPmuComponent[] = [];

  // Carrier is measured by PMU
  pmuComponents.push({
    id: 'carrier',
    disturbanceId: 'carrier',
    frequency: f0,
    modulationFrequency: 0,
    amplitude: a1,
    phaseShiftRad: 0,
    label: `Carrier f₀ (${a1.toFixed(2)}pu)`,
    zone: 1,
    isCarrier: true,
  });

  // Evaluate each active disturbance
  for (const dist of activeDisturbances) {
    const fm = dist.modulationFrequency;
    const A = dist.amplitude;
    const isAdditive = dist.type === 'additive';
    const additiveTarget = dist.additiveTarget || 'lower';
    const zone = determineDisturbanceZone(fm, zone1Limit, zone2Limit);
    const distColor = dist.color || getDisturbanceColor(dist).id;

    const outcomeComponents: CapturedPmuComponent[] = [];

    if (zone === 1) {
      // Zone 1: Standardized dynamic-performance range
      if (isAdditive) {
        const fTone = additiveTarget === 'upper'
          ? Math.round((f0 + fm) * 10) / 10
          : Math.max(0.1, Math.round((f0 - fm) * 10) / 10);
        const signLabel = additiveTarget === 'upper' ? `+${fm}` : `-${fm}`;

        const compTone: CapturedPmuComponent = {
          id: `${dist.id}-tone`,
          disturbanceId: dist.id,
          frequency: fTone,
          modulationFrequency: fm,
          amplitude: A,
          phaseShiftRad: 0,
          label: `${dist.name} (${signLabel}Hz)`,
          zone: 1,
          color: distColor,
        };
        outcomeComponents.push(compTone);
        pmuComponents.push(compTone);
      } else {
        const compLower: CapturedPmuComponent = {
          id: `${dist.id}-lower`,
          disturbanceId: dist.id,
          frequency: Math.max(0.1, Math.round((f0 - fm) * 10) / 10),
          modulationFrequency: fm,
          amplitude: A,
          phaseShiftRad: 0,
          label: `${dist.name} (-${fm}Hz)`,
          zone: 1,
          color: distColor,
        };
        const compUpper: CapturedPmuComponent = {
          id: `${dist.id}-upper`,
          disturbanceId: dist.id,
          frequency: Math.round((f0 + fm) * 10) / 10,
          modulationFrequency: fm,
          amplitude: A,
          phaseShiftRad: 0,
          label: `${dist.name} (+${fm}Hz)`,
          zone: 1,
          color: distColor,
        };

        outcomeComponents.push(compLower, compUpper);
        pmuComponents.push(compLower, compUpper);
      }

      outcomes.push({
        disturbanceId: dist.id,
        name: dist.name,
        modulationFrequency: fm,
        amplitude: A,
        zone: 1,
        statusDescription: `Accurate Capture (${A.toFixed(2)}pu)`,
        capturedComponents: outcomeComponents,
      });
    } else if (zone === 2) {
      // Zone 2: Reporting-rate Nyquist range
      const atten = calculateZone2Capture(A, fm, f0);

      if (atten.amplitude > 0.001) {
        if (isAdditive) {
          const fTone = additiveTarget === 'upper'
            ? Math.round((f0 + fm) * 10) / 10
            : Math.max(0.1, Math.round((f0 - fm) * 10) / 10);
          const signLabel = additiveTarget === 'upper' ? `+${fm}` : `-${fm}`;

          const compTone: CapturedPmuComponent = {
            id: `${dist.id}-tone`,
            disturbanceId: dist.id,
            frequency: fTone,
            modulationFrequency: fm,
            amplitude: atten.amplitude,
            phaseShiftRad: atten.phaseShiftRad,
            label: `${dist.name} (${signLabel}Hz, ${atten.amplitude.toFixed(2)}pu)`,
            zone: 2,
            color: distColor,
            isAttenuated: true,
          };
          outcomeComponents.push(compTone);
          pmuComponents.push(compTone);
        } else {
          const compLower: CapturedPmuComponent = {
            id: `${dist.id}-lower`,
            disturbanceId: dist.id,
            frequency: Math.max(0.1, Math.round((f0 - fm) * 10) / 10),
            modulationFrequency: fm,
            amplitude: atten.amplitude,
            phaseShiftRad: atten.phaseShiftRad,
            label: `${dist.name} (-${fm}Hz, ${atten.amplitude.toFixed(2)}pu)`,
            zone: 2,
            color: distColor,
            isAttenuated: true,
          };
          const compUpper: CapturedPmuComponent = {
            id: `${dist.id}-upper`,
            disturbanceId: dist.id,
            frequency: Math.round((f0 + fm) * 10) / 10,
            modulationFrequency: fm,
            amplitude: atten.amplitude,
            phaseShiftRad: atten.phaseShiftRad,
            label: `${dist.name} (+${fm}Hz, ${atten.amplitude.toFixed(2)}pu)`,
            zone: 2,
            color: distColor,
            isAttenuated: true,
          };

          outcomeComponents.push(compLower, compUpper);
          pmuComponents.push(compLower, compUpper);
        }
      }

      const pct = Math.round((atten.amplitude / (A || 1)) * 100);
      outcomes.push({
        disturbanceId: dist.id,
        name: dist.name,
        modulationFrequency: fm,
        amplitude: A,
        zone: 2,
        attenuated: true,
        attenuatedAmplitude: atten.amplitude,
        rawFactor: atten.rawFactor,
        phaseReversed: atten.phaseShiftRad > 0,
        statusDescription: `Formula Attenuated (${atten.amplitude.toFixed(2)}pu, ${pct}%)`,
        capturedComponents: outcomeComponents,
      });
    } else {
      // Zone 3: Stochastic Capture Model
      // Evaluated as three independent Bernoulli trials:
      // 1. Missed detection (suppresses original)
      // 2. Aliasing (folds frequency to fAlias in Zone 1 or Zone 2)
      // 3. Random attenuation (applies measurement filter attenuation |H(f)|)
      const probs = settings.probabilities;
      const missed = rng() < probs.pMiss;
      const aliased = rng() < probs.pAlias;
      const attenuated = rng() < probs.pAtten;

      const fAlias = calculateAliasFrequency(fm, settings.reportingRate);
      // Apparent zone of the folded aliased frequency under conventional Nyquist folding
      const aliasZone = determineDisturbanceZone(fAlias, zone1Limit, zone2Limit);
      let attenAmp = 0;
      let rawFactor = 1;
      let phaseReversed = false;

      // 1. Determine effective amplitude & phase after measurement filter response |H(f)|
      let observedAmp = A;
      let phaseShiftRad = 0;
      if (attenuated) {
        const atten = calculateZone3Attenuation(A, fm, f0);
        attenAmp = atten.amplitude;
        rawFactor = atten.rawFactor;
        phaseReversed = atten.phaseShiftRad > 0;
        observedAmp = atten.amplitude;
        phaseShiftRad = atten.phaseShiftRad;
      }

      // 2. Determine frequency & component creation
      // If missed and not aliased, component is suppressed completely.
      // If aliased, component folds to fAlias.
      // If both aliased and attenuated, ONE component is produced at fAlias with attenuated amplitude.
      if (!missed || aliased) {
        const isObservedAliased = aliased;
        const isObservedAttenuated = attenuated;
        const observedModFreq = isObservedAliased ? fAlias : fm;
        const observedZone = isObservedAliased ? aliasZone : 3;

        if (observedAmp > 0.001) {
          if (isAdditive) {
            const fTone = additiveTarget === 'upper'
              ? Math.round((f0 + observedModFreq) * 10) / 10
              : Math.max(0.1, Math.round((f0 - observedModFreq) * 10) / 10);
            const signLabel = additiveTarget === 'upper' ? `+${observedModFreq}` : `-${observedModFreq}`;

            const label = isObservedAliased && isObservedAttenuated
              ? `Alias & Atten of ${dist.name} (${signLabel}Hz, ${observedAmp.toFixed(2)}pu, Z${observedZone})`
              : isObservedAliased
              ? `Alias of ${dist.name} (${signLabel}Hz, Z${observedZone})`
              : isObservedAttenuated
              ? `Atten ${dist.name} (${signLabel}Hz, Z3)`
              : `${dist.name} (${signLabel}Hz, Z3)`;

            const compTone: CapturedPmuComponent = {
              id: `${dist.id}-observed-tone`,
              disturbanceId: dist.id,
              frequency: fTone,
              modulationFrequency: observedModFreq,
              amplitude: observedAmp,
              phaseShiftRad,
              label,
              zone: observedZone,
              color: distColor,
              isAliased: isObservedAliased,
              isAttenuated: isObservedAttenuated,
              originalModulationFreq: fm,
            };
            outcomeComponents.push(compTone);
            pmuComponents.push(compTone);
          } else {
            const fLower = Math.max(0.1, Math.round((f0 - observedModFreq) * 10) / 10);
            const fUpper = Math.round((f0 + observedModFreq) * 10) / 10;

            const labelLower = isObservedAliased && isObservedAttenuated
              ? `Alias & Atten of ${dist.name} (-${observedModFreq}Hz, ${observedAmp.toFixed(2)}pu, Z${observedZone})`
              : isObservedAliased
              ? `Alias of ${dist.name} (-${observedModFreq}Hz, Z${observedZone})`
              : isObservedAttenuated
              ? `Atten ${dist.name} (-${observedModFreq}Hz, Z3)`
              : `${dist.name} (-${observedModFreq}Hz, Z3)`;

            const labelUpper = isObservedAliased && isObservedAttenuated
              ? `Alias & Atten of ${dist.name} (+${observedModFreq}Hz, ${observedAmp.toFixed(2)}pu, Z${observedZone})`
              : isObservedAliased
              ? `Alias of ${dist.name} (+${observedModFreq}Hz, Z${observedZone})`
              : isObservedAttenuated
              ? `Atten ${dist.name} (+${observedModFreq}Hz, Z3)`
              : `${dist.name} (+${observedModFreq}Hz, Z3)`;

            const compLower: CapturedPmuComponent = {
              id: `${dist.id}-observed-lower`,
              disturbanceId: dist.id,
              frequency: fLower,
              modulationFrequency: observedModFreq,
              amplitude: observedAmp,
              phaseShiftRad,
              label: labelLower,
              zone: observedZone,
              color: distColor,
              isAliased: isObservedAliased,
              isAttenuated: isObservedAttenuated,
              originalModulationFreq: fm,
            };
            const compUpper: CapturedPmuComponent = {
              id: `${dist.id}-observed-upper`,
              disturbanceId: dist.id,
              frequency: fUpper,
              modulationFrequency: observedModFreq,
              amplitude: observedAmp,
              phaseShiftRad,
              label: labelUpper,
              zone: observedZone,
              color: distColor,
              isAliased: isObservedAliased,
              isAttenuated: isObservedAttenuated,
              originalModulationFreq: fm,
            };

            outcomeComponents.push(compLower, compUpper);
            pmuComponents.push(compLower, compUpper);
          }
        }
      }

      // Build descriptive outcome status string
      let statusStr = '';
      if (missed && !aliased) {
        statusStr = 'Original Missed (Suppressed)';
      } else if (aliased && attenuated) {
        statusStr = `Aliased (±${fAlias}Hz, Z${aliasZone}) & Attenuated (${observedAmp.toFixed(2)}pu)`;
      } else if (aliased && !attenuated) {
        statusStr = `Aliased to ±${fAlias}Hz (Z${aliasZone})`;
      } else if (!aliased && attenuated) {
        statusStr = `Attenuated to ${observedAmp.toFixed(2)}pu (Z3)`;
      } else if (!aliased && !attenuated) {
        statusStr = `Captured unattenuated at ${fm}Hz (Z3)`;
      } else {
        statusStr = 'Out-of-band Filtered';
      }

      outcomes.push({
        disturbanceId: dist.id,
        name: dist.name,
        modulationFrequency: fm,
        amplitude: A,
        zone: 3,
        missed,
        aliased,
        attenuated,
        aliasedModulationFreq: fAlias,
        attenuatedAmplitude: attenAmp,
        rawFactor,
        phaseReversed,
        statusDescription: statusStr,
        capturedComponents: outcomeComponents,
      });
    }
  }

  // 2.5 Combine any multiple components overlapping at the same observed frequency
  // via actual physical vector sum (I and Q), handling phase shifts and cancellations
  const finalPmuComponents = combineOverlappingPmuComponents(pmuComponents);

  // 3. Compute Plot Range and Scaling
  let maxAmp = 1.0;
  for (const c of trueComponents) {
    if (c.amplitude > maxAmp) maxAmp = c.amplitude;
  }
  for (const c of finalPmuComponents) {
    if (c.amplitude > maxAmp) maxAmp = c.amplitude;
  }
  maxAmp = Math.max(1.5, Math.ceil(maxAmp * 1.25 * 10) / 10);

  const minPlotFreq = Math.max(0, Math.round(f0 - 45));
  const maxPlotFreq = Math.round(f0 + 45);

  // 4. Compute RMS and TVE via Parseval's identity
  const sumTrueSq = trueComponents.reduce((sum, c) => sum + (c.amplitude * c.amplitude) / 2, 0);
  const trueRms = Math.sqrt(sumTrueSq);

  const sumPmuSq = finalPmuComponents.reduce((sum, c) => sum + (c.amplitude * c.amplitude) / 2, 0);
  const pmuRms = Math.sqrt(sumPmuSq);

  // Total Vector Error %
  const diffRms = Math.abs(trueRms - pmuRms);
  const tvePercent = Math.min(100, Math.round(((diffRms / (trueRms || 1)) * 100) * 10) / 10);

  return {
    id: nextSnapshotId++,
    timestamp: Date.now(),
    pmuClass: settings.pmuClass,
    reportingRate: settings.reportingRate,
    nominalFundamental: f0,
    zone1Limit,
    zone2Limit,
    zone1Band,
    zone2Band,
    disturbances: [...disturbances],
    outcomes,
    trueComponents,
    pmuComponents: finalPmuComponents,
    maxAmplitude: maxAmp,
    minPlotFreq,
    maxPlotFreq,
    trueRms: Math.round(trueRms * 1000) / 1000,
    pmuRms: Math.round(pmuRms * 1000) / 1000,
    tvePercent,
  };
}

/**
 * Evaluates the ground-truth waveform value at continuous simulation time t (in seconds).
 * Never modified by PMU measurement.
 */
export function evaluateTrueSignal(
  state: WaveformState,
  disturbances: InjectedDisturbance[],
  t: number
): number {
  const f0 = Math.max(1, state.fundamentalFrequency || 60);
  const a1 = state.fundamentalAmplitude;
  const phaseRad = (state.phase * Math.PI) / 180;

  // 1. Fundamental
  let y = a1 * Math.sin(2 * Math.PI * f0 * t + phaseRad);

  // 2. Harmonics
  if (state.harmonics) {
    if (state.harmonics.second > 0) {
      y += (state.harmonics.second / 100) * a1 * Math.sin(2 * Math.PI * 2 * f0 * t);
    }
    if (state.harmonics.third > 0) {
      y += (state.harmonics.third / 100) * a1 * Math.sin(2 * Math.PI * 3 * f0 * t);
    }
    if (state.harmonics.fourth > 0) {
      y += (state.harmonics.fourth / 100) * a1 * Math.sin(2 * Math.PI * 4 * f0 * t);
    }
  }

  // 3. DC Offset
  if (state.dcOffset) {
    y += state.dcOffset;
  }

  // 4. Custom equation terms if present
  if (state.customTerms && state.customTerms.length > 0) {
    for (const term of state.customTerms) {
      y += term.amplitude * Math.sin(2 * Math.PI * term.frequency * t + term.phaseRad);
    }
  }

  // 5. Injected Disturbances
  const activeDisturbances = disturbances.filter((d) => d.enabled && d.amplitude > 0);
  for (const dist of activeDisturbances) {
    const fm = dist.modulationFrequency;
    const aDist = dist.amplitude;
    const isAdditive = dist.type === 'additive';

    if (isAdditive) {
      const fTone = dist.additiveTarget === 'upper'
        ? f0 + fm
        : Math.max(0.1, f0 - fm);
      y += aDist * Math.sin(2 * Math.PI * fTone * t + phaseRad);
    } else {
      // Amplitude modulation: produces two symmetric sidebands at f0 - fm and f0 + fm
      y += aDist * Math.sin(2 * Math.PI * (f0 - fm) * t + phaseRad);
      y += aDist * Math.sin(2 * Math.PI * (f0 + fm) * t + phaseRad);
    }
  }

  return y;
}

/**
 * Evaluates the reconstructed PMU-captured waveform value at continuous simulation time t (in seconds).
 * Strictly synthesized from the captured components in the measurement snapshot.
 */
export function evaluatePmuSignal(
  snapshot: PmuMeasurementSnapshot,
  state: WaveformState,
  t: number
): number {
  const f0 = snapshot.nominalFundamental;
  const a1 = state.fundamentalAmplitude;
  const phaseRad = (state.phase * Math.PI) / 180;

  // 1. Fundamental carrier is tracked
  let y = a1 * Math.sin(2 * Math.PI * f0 * t + phaseRad);

  // 2. Add captured disturbance components (from the measurement snapshot outcomes)
  for (const outcome of snapshot.outcomes) {
    for (const comp of outcome.capturedComponents) {
      y += comp.amplitude * Math.sin(2 * Math.PI * comp.frequency * t + phaseRad + comp.phaseShiftRad);
    }
  }

  return y;
}

/**
 * Calculates stable, sensible time-domain Y-axis limits based on the base waveform's
 * expected range (fundamental amplitude, DC offset, harmonics) and any injected disturbances.
 *
 * Characteristics:
 * 1. Stable: Does not arbitrarily recalculate or squeeze the time-domain Y-axis limits
 *    every time a disturbance is added, edited, or removed.
 * 2. Non-instantaneous: Never relies on currently visible animation samples, eliminating
 *    jitter or jumpiness during continuous playback.
 * 3. Readability: Fundamental waveform remains legible and not vertically compressed.
 * 4. Expandable: If large disturbances or high base amplitudes exceed the standard limits,
 *    expands in clean, symmetric, rounded 0.5 pu steps (e.g. [-2.5, +2.5], [-3.0, +3.0]).
 * 5. Full coverage: Guarantees neither the True signal nor the PMU-captured signal is clipped.
 */
export function calculateTimeDomainYLimits(
  state: WaveformState,
  disturbances: InjectedDisturbance[] = []
): { yMin: number; yMax: number; center: number; halfSpan: number } {
  const a1 = Math.max(0, state.fundamentalAmplitude ?? 1.0);
  const dc = state.dcOffset ?? 0;

  // Expected harmonics contribution in base waveform
  let harmonicsAmp = 0;
  if (state.harmonics) {
    harmonicsAmp += a1 * ((state.harmonics.second ?? 0) / 100);
    harmonicsAmp += a1 * ((state.harmonics.third ?? 0) / 100);
    harmonicsAmp += a1 * ((state.harmonics.fourth ?? 0) / 100);
  }

  // Base custom terms from equation editor (if any)
  let customAmp = 0;
  if (state.customTerms && state.customTerms.length > 0) {
    for (const term of state.customTerms) {
      customAmp += Math.abs(term.amplitude);
    }
  }

  // Base peak amplitude above DC
  const basePeak = a1 + harmonicsAmp + customAmp;

  // Active disturbances sum of amplitudes
  let distAmp = 0;
  if (disturbances && disturbances.length > 0) {
    for (const d of disturbances) {
      if (d.enabled && d.amplitude > 0) {
        distAmp += d.amplitude;
      }
    }
  }

  // Theoretical maximum possible excursion away from DC offset
  const maxExcursion = basePeak + distAmp;

  // Default standard half-span matching standard oscilloscope range (±2.0 pu)
  const defaultHalfSpan = 2.0;

  if (Math.abs(dc) <= 0.5) {
    // When DC offset is zero or moderate (<= 0.5 pu), keeping center at 0 preserves the intuitive baseline
    const totalPeakNeeded = Math.abs(dc) + maxExcursion;
    // Add 10% safety margin and expand only when exceeding default 2.0 pu
    const rawSpan = Math.max(defaultHalfSpan, totalPeakNeeded * 1.10);
    // Round up to nearest 0.5 pu step (e.g. 2.0, 2.5, 3.0, etc.)
    const halfSpan = Math.ceil(rawSpan * 2) / 2;

    return {
      yMin: -halfSpan,
      yMax: halfSpan,
      center: 0,
      halfSpan,
    };
  } else {
    // Large DC offset: center around rounded DC offset
    const center = Math.round(dc * 2) / 2;
    const requiredSpan = Math.abs(dc - center) + maxExcursion;
    const rawSpan = Math.max(defaultHalfSpan, requiredSpan * 1.10);
    const halfSpan = Math.ceil(rawSpan * 2) / 2;

    return {
      yMin: Math.round((center - halfSpan) * 10) / 10,
      yMax: Math.round((center + halfSpan) * 10) / 10,
      center,
      halfSpan,
    };
  }
}

/**
 * Generates continuous sample points and discrete reported synchrophasor frames
 * for a 3-cycle time window.
 */
export function generatePmuTimeDomainData(
  state: WaveformState,
  snapshot: PmuMeasurementSnapshot,
  disturbances: InjectedDisturbance[],
  currentTimeSec: number,
  cyclesToShow: number = state.visibleCycles ?? 3,
  pointsCount?: number
): PmuWaveformWindowData {
  const effectiveCycles = Math.max(1, cyclesToShow);
  const actualPointsCount = pointsCount ?? Math.max(800, Math.min(4000, effectiveCycles * 60));

  const f0 = Math.max(1, state.fundamentalFrequency || 60);
  const fundamentalPeriodSec = 1 / f0;
  const fundamentalPeriodMs = fundamentalPeriodSec * 1000;
  const windowDurationSec = effectiveCycles * fundamentalPeriodSec;
  const windowDurationMs = windowDurationSec * 1000;

  const points: PmuSamplePoint[] = [];
  const dt = windowDurationSec / (actualPointsCount - 1);

  // Compute stable, non-instantaneous Y-axis limits
  const limits = calculateTimeDomainYLimits(state, disturbances);
  const yMin = limits.yMin;
  const yMax = limits.yMax;

  for (let i = 0; i < actualPointsCount; i++) {
    const tRelativeSec = i * dt;
    const tRelativeMs = tRelativeSec * 1000;
    const tAbsoluteSec = currentTimeSec + tRelativeSec;

    const trueY = evaluateTrueSignal(state, disturbances, tAbsoluteSec);
    const pmuY = evaluatePmuSignal(snapshot, state, tAbsoluteSec);

    points.push({
      tRelativeMs,
      tAbsoluteSec,
      trueY,
      pmuY,
    });
  }

  // Generate discrete reported PMU frames at reporting rate Fs
  const reportedFrames: PmuReportFrame[] = [];
  const frameIntervalSec = 1 / snapshot.reportingRate;

  // Synchronize reporting frames with integer multiples of frameIntervalSec
  const startFrameIndex = Math.ceil(currentTimeSec / frameIntervalSec);
  const endFrameIndex = Math.floor((currentTimeSec + windowDurationSec) / frameIntervalSec);

  for (let k = startFrameIndex; k <= endFrameIndex; k++) {
    const tAbsoluteSec = k * frameIntervalSec;
    const tRelativeSec = tAbsoluteSec - currentTimeSec;
    if (tRelativeSec >= 0 && tRelativeSec <= windowDurationSec) {
      const y = evaluatePmuSignal(snapshot, state, tAbsoluteSec);
      reportedFrames.push({
        tRelativeMs: tRelativeSec * 1000,
        tAbsoluteSec,
        y,
        frameIndex: k,
      });
    }
  }

  return {
    points,
    reportedFrames,
    windowDurationSec,
    windowDurationMs,
    fundamentalPeriodMs,
    yMin,
    yMax,
    cyclesShown: cyclesToShow,
  };
}
