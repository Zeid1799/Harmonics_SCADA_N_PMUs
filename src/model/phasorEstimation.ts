/**
 * Mathematical models and estimation algorithms for PMU synchrophasor analysis.
 * Implements 6 distinct fundamental phasor estimation methods:
 * 1. Discrete Fourier Transform (DFT) / Fourier Analysis
 * 2. FFT Peak Analysis
 * 3. Lissajous Figures
 * 4. Least-Squares Sinusoidal Fitting
 * 5. Zero-Crossing Phase Estimation
 * 6. Taylor-Fourier Estimation
 */

export type PhasorEstimationMethod =
  | 'dft'
  | 'fft'
  | 'lissajous'
  | 'least-squares'
  | 'zero-crossing'
  | 'taylor-fourier';

export interface PhasorEstimate {
  magnitude: number; // Peak amplitude in pu
  rms: number;       // RMS amplitude in pu (magnitude / sqrt(2))
  phaseDeg: number;  // In degrees, normalized to [-180, 180]
  phaseRad: number;  // In radians, normalized to [-PI, PI]
  isValid: boolean;
  extraInfo?: string;
}

export interface MethodDocumentation {
  id: PhasorEstimationMethod;
  name: string;
  shortName: string;
  howItWorks: string;
  formula: string;
  requiredData: string;
  strengths: string;
  limitations: string;
  implementationNote: string;
}

/**
 * Complete technical documentation and formulas for each of the 6 estimation methods.
 */
export const ESTIMATION_METHOD_DOCS: Record<PhasorEstimationMethod, MethodDocumentation> = {
  dft: {
    id: 'dft',
    name: 'Discrete Fourier Transform (DFT) / Fourier Analysis',
    shortName: 'DFT / Fourier',
    howItWorks:
      'Samples the signal over an observation window of exactly one nominal fundamental cycle and projects it onto orthogonal cosine and sine basis functions at f₀ to extract the complex fundamental Fourier coefficient.',
    formula:
      'X(f₀) = ∑ x[n] e^{-j 2π f₀ n / f_s},    A = 2|X(f₀)| / N,    φ = arg(X(f₀)) - 2π f₀ t',
    requiredData:
      'N uniform samples over a 1-cycle observation window [t - T₀/2, t + T₀/2] and nominal fundamental frequency f₀.',
    strengths:
      'Standard basis for conventional PMU synchrophasors (IEEE Std C37.118.1). Completely rejects DC offset and all integer harmonics under coherent nominal conditions.',
    limitations:
      'Spectral leakage occurs when the fundamental frequency deviates from nominal or when inter-harmonics and dynamic modulation frequencies are present.',
    implementationNote:
      'Conventional PMU synchrophasor estimation evaluated at the selected reporting instant t.',
  },
  fft: {
    id: 'fft',
    name: 'FFT Peak Analysis',
    shortName: 'FFT Peak',
    howItWorks:
      'Computes the Fast Fourier Transform across the sampled observation window with Hann windowing, identifies the spectral peak closest to f₀, and evaluates the complex peak coefficient to extract magnitude and phase.',
    formula:
      'X[k] = ∑ x[n] w[n] e^{-j 2π k n / N},    k_peak = argmax |X[k]|,    A = 2|X[k_peak]| / ∑ w[n]',
    requiredData:
      'Windowed signal samples x[n], FFT size N, and sampling rate f_s.',
    strengths:
      'Discovers dominant frequency peaks without strictly assuming monochromatic single-tone conditions; reveals harmonic spectra.',
    limitations:
      'Frequency resolution is constrained by the window length (Δf = f_s / N). Off-bin frequencies cause scalloping attenuation and spectral leakage. Requires complex coefficient to determine phase.',
    implementationNote:
      'Spectrum-based analysis with complex phase extraction. Standard PMUs typically employ dedicated single-bin recursive DFT filters rather than full multi-bin FFTs.',
  },
  lissajous: {
    id: 'lissajous',
    name: 'Lissajous Figures',
    shortName: 'Lissajous Figures',
    howItWorks:
      'Parametrically plots the PMU measurement y(τ) against the Ground-Truth signal x(τ) over one fundamental cycle. The resulting elliptical figure yields the phase difference from the vertical intercept where x = 0.',
    formula:
      '|sin Δφ| = |y(x=0) / B|,    Δφ = atan2(y(x=0), y(x=x_max))',
    requiredData:
      'Simultaneous paired samples of Ground Truth x(τ) and PMU measurement y(τ) over the same fundamental cycle.',
    strengths:
      'Direct educational graphical comparison of phase shift, ellipse eccentricity, and distortion between two signals on an X-Y plane.',
    limitations:
      'Ideal ellipse formulas fail under DC offsets, harmonic distortions, frequency mismatches, or dynamic disturbances, causing severe quadrant ambiguity.',
    implementationNote:
      'Educational graphical comparison tool, not a conventional standalone PMU field algorithm.',
  },
  'least-squares': {
    id: 'least-squares',
    name: 'Least-Squares Sinusoidal Fitting',
    shortName: 'Least-Squares Fit',
    howItWorks:
      'Fits a three-parameter linear sinusoidal model (DC offset c, in-phase cosine coefficient a, and quadrature sine coefficient b) to observation window samples by minimizing squared residual errors.',
    formula:
      'x(τ) = c + a cos(ω₀(τ - t)) + b sin(ω₀(τ - t)),    A = √(a² + b²),    φ = atan2(a, b) - ω₀ t',
    requiredData:
      'Windowed signal samples x[n], sample timestamps τ_n, and nominal angular frequency ω₀ = 2π f₀.',
    strengths:
      'Concurrently isolates and estimates DC offset without distorting fundamental magnitude; highly robust against additive Gaussian noise.',
    limitations:
      'Assumes exact nominal frequency ω₀. Unmodeled harmonics or severe off-nominal frequency swings bias the fitted parameters.',
    implementationNote:
      'Conventional parametric curve-fitting estimator evaluated over the 1-cycle window.',
  },
  'zero-crossing': {
    id: 'zero-crossing',
    name: 'Zero-Crossing Phase Estimation',
    shortName: 'Zero Crossing',
    howItWorks:
      'Detects the exact positive-slope zero crossing t_zc of the waveform closest to the measurement time using linear interpolation, comparing its displacement against the nominal zero-crossing reference.',
    formula:
      't_zc = τ_k - x[k] (τ_{k+1} - τ_k) / (x[k+1] - x[k]),    Δt = t_ref - t_zc,    φ = 2π f₀ Δt (deg: 360° f₀ Δt)',
    requiredData:
      'Sampled waveform containing at least one clean positive-slope zero crossing and nominal frequency f₀.',
    strengths:
      'Simple, low computational complexity; historically utilized in early analog frequency and phase meters.',
    limitations:
      'Extremely vulnerable to DC offsets (which shift zero crossings), harmonics (which induce false crossings), and noise.',
    implementationNote:
      'Illustrative timing method demonstrating why modern synchrophasor standards require Fourier/filtering techniques instead of raw zero-crossing detection.',
  },
  'taylor-fourier': {
    id: 'taylor-fourier',
    name: 'Taylor-Fourier Estimation',
    shortName: 'Taylor-Fourier',
    howItWorks:
      'Expands the time-varying fundamental phasor into a 1st-order Taylor series around reporting instant t, solving for static phasor p₀ and dynamic phasor velocity p₁ (frequency / ROCOF swing).',
    formula:
      'p(τ) = p₀ + p₁(τ - t),    x(τ) = Re((p₀ + p₁(τ - t)) e^{j ω₀ τ}),    A = |p₀|,    φ = arg(p₀)',
    requiredData:
      'Windowed signal samples x[n], sample timestamps τ_n, and nominal frequency ω₀.',
    strengths:
      'Specifically tailored for dynamic swing conditions, amplitude modulations, and frequency ramps; models phasor evolution during grid oscillations.',
    limitations:
      'Increased matrix sensitivity; susceptible to wideband noise or out-of-band interference if the observation window is too short.',
    implementationNote:
      'Simplified 1st-order Taylor-Fourier estimator demonstrating dynamic phasor tracking during electromechanical oscillations.',
  },
};

/**
 * Normalizes an electrical angle in degrees to [-180, 180].
 */
export function normalizeAngleDeg(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return Math.round(a * 100) / 100;
}

/**
 * Normalizes an electrical angle in radians to [-PI, PI].
 */
export function normalizeAngleRad(rad: number): number {
  let r = rad % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r < -Math.PI) r += 2 * Math.PI;
  return r;
}

/**
 * Samples a continuous signal function over a 1-cycle observation window centered at tCenter.
 */
export function sampleObservationWindow(
  evalFunc: (t: number) => number,
  tCenter: number,
  f0: number,
  numSamples: number = 64
): { samples: number[]; times: number[]; periodSec: number } {
  const periodSec = 1 / f0;
  const halfWindow = periodSec / 2;
  const samples: number[] = new Array(numSamples);
  const times: number[] = new Array(numSamples);

  for (let n = 0; n < numSamples; n++) {
    // Centered window: tau in [tCenter - T0/2, tCenter + T0/2]
    const tau = tCenter - halfWindow + (n / numSamples) * periodSec;
    times[n] = tau;
    samples[n] = evalFunc(tau);
  }

  return { samples, times, periodSec };
}

/**
 * Evaluates the fundamental synchrophasor using the selected estimation method.
 */
export function evaluatePhasorEstimate(
  method: PhasorEstimationMethod,
  evalFunc: (t: number) => number,
  tCenter: number,
  f0: number,
  pairedRefFunc?: (t: number) => number // Required for Lissajous method
): PhasorEstimate {
  const { samples, times } = sampleObservationWindow(evalFunc, tCenter, f0, 64);
  const N = samples.length;

  switch (method) {
    case 'dft': {
      // Method 1: Discrete Fourier Transform (DFT) / Fourier Analysis
      // Orthogonal projection onto cos and sin over centered window
      let sumCos = 0;
      let sumSin = 0;
      for (let n = 0; n < N; n++) {
        const thetaRel = 2 * Math.PI * f0 * (times[n] - tCenter);
        sumCos += samples[n] * Math.cos(thetaRel);
        sumSin += samples[n] * Math.sin(thetaRel);
      }
      const Sc = (2 / N) * sumCos;
      const Ss = (2 / N) * sumSin;
      const mag = Math.sqrt(Sc * Sc + Ss * Ss);
      // Since x(tau) = A sin(2*pi*f0*t + phi), Sc = A sin(2*pi*f0*t + phi), Ss = A cos(2*pi*f0*t + phi)
      const alpha = Math.atan2(Sc, Ss);
      const phaseRad = normalizeAngleRad(alpha - 2 * Math.PI * f0 * tCenter);
      const phaseDeg = normalizeAngleDeg((phaseRad * 180) / Math.PI);

      return {
        magnitude: Math.round(mag * 1000) / 1000,
        rms: Math.round((mag / Math.SQRT2) * 1000) / 1000,
        phaseDeg,
        phaseRad,
        isValid: true,
      };
    }

    case 'fft': {
      // Method 2: FFT Peak Analysis (Hann windowed complex DFT)
      let sumW = 0;
      let rePeak = 0;
      let imPeak = 0;
      for (let n = 0; n < N; n++) {
        // Hann window
        const w = 0.5 * (1 - Math.cos((2 * Math.PI * n) / N));
        sumW += w;
        const thetaRel = 2 * Math.PI * f0 * (times[n] - tCenter);
        const xw = samples[n] * w;
        rePeak += xw * Math.cos(thetaRel);
        imPeak += xw * Math.sin(thetaRel);
      }
      const Sc = (2 / sumW) * rePeak;
      const Ss = (2 / sumW) * imPeak;
      const mag = Math.sqrt(Sc * Sc + Ss * Ss);
      const alpha = Math.atan2(Sc, Ss);
      const phaseRad = normalizeAngleRad(alpha - 2 * Math.PI * f0 * tCenter);
      const phaseDeg = normalizeAngleDeg((phaseRad * 180) / Math.PI);

      return {
        magnitude: Math.round(mag * 1000) / 1000,
        rms: Math.round((mag / Math.SQRT2) * 1000) / 1000,
        phaseDeg,
        phaseRad,
        isValid: true,
        extraInfo: 'Hann window peak bin at f₀',
      };
    }

    case 'least-squares': {
      // Method 4: Least-Squares Sinusoidal Fitting
      // x(tau) = c + a cos(thetaRel) + b sin(thetaRel)
      let sumX = 0;
      let sumCos = 0;
      let sumSin = 0;
      for (let n = 0; n < N; n++) {
        const thetaRel = 2 * Math.PI * f0 * (times[n] - tCenter);
        sumX += samples[n];
        sumCos += samples[n] * Math.cos(thetaRel);
        sumSin += samples[n] * Math.sin(thetaRel);
      }
      const c = sumX / N; // DC offset estimate
      const a = (2 / N) * sumCos;
      const b = (2 / N) * sumSin;
      const mag = Math.sqrt(a * a + b * b);
      const alpha = Math.atan2(a, b);
      const phaseRad = normalizeAngleRad(alpha - 2 * Math.PI * f0 * tCenter);
      const phaseDeg = normalizeAngleDeg((phaseRad * 180) / Math.PI);

      return {
        magnitude: Math.round(mag * 1000) / 1000,
        rms: Math.round((mag / Math.SQRT2) * 1000) / 1000,
        phaseDeg,
        phaseRad,
        isValid: true,
        extraInfo: `Fitted DC Offset: ${c >= 0 ? '+' : ''}${c.toFixed(2)} pu`,
      };
    }

    case 'zero-crossing': {
      // Method 5: Zero-Crossing Phase Estimation
      // Find positive-slope zero crossing in the observation window
      let zcTime: number | null = null;
      let minDisplacement = Infinity;

      for (let n = 0; n < N - 1; n++) {
        if (samples[n] <= 0 && samples[n + 1] > 0) {
          // Linear interpolation for exact zero crossing
          const tZc = times[n] - samples[n] * ((times[n + 1] - times[n]) / (samples[n + 1] - samples[n]));
          const disp = Math.abs(tZc - tCenter);
          if (disp < minDisplacement) {
            minDisplacement = disp;
            zcTime = tZc;
          }
        }
      }

      if (zcTime === null) {
        // Fallback if no zero crossing found (e.g. DC offset exceeds amplitude)
        return {
          magnitude: 0,
          rms: 0,
          phaseDeg: 0,
          phaseRad: 0,
          isValid: false,
          extraInfo: 'No zero crossing detected (DC offset may exceed AC amplitude)',
        };
      }

      // Reference positive zero-crossing for clean sin(2*pi*f0*t + phi):
      // sin(2*pi*f0*t_zc + phi) = 0 -> 2*pi*f0*t_zc + phi = 2*pi*m -> phi = 2*pi*m - 2*pi*f0*t_zc
      const phaseRad = normalizeAngleRad(-2 * Math.PI * f0 * zcTime);
      const phaseDeg = normalizeAngleDeg((phaseRad * 180) / Math.PI);

      // Amplitude from peak in window
      let peakSample = 0;
      for (let n = 0; n < N; n++) {
        if (Math.abs(samples[n]) > peakSample) peakSample = Math.abs(samples[n]);
      }

      return {
        magnitude: Math.round(peakSample * 1000) / 1000,
        rms: Math.round((peakSample / Math.SQRT2) * 1000) / 1000,
        phaseDeg,
        phaseRad,
        isValid: true,
        extraInfo: `Zero crossing at ${(zcTime * 1000).toFixed(2)} ms`,
      };
    }

    case 'lissajous': {
      // Method 3: Lissajous Figures
      // If pairedRefFunc is supplied, calculate phase difference relative to paired reference
      let refSamples = samples;
      if (pairedRefFunc) {
        refSamples = sampleObservationWindow(pairedRefFunc, tCenter, f0, 64).samples;
      }

      let maxRef = 0;
      let maxMeas = 0;
      for (let n = 0; n < N; n++) {
        if (Math.abs(refSamples[n]) > maxRef) maxRef = Math.abs(refSamples[n]);
        if (Math.abs(samples[n]) > maxMeas) maxMeas = Math.abs(samples[n]);
      }
      maxRef = Math.max(0.01, maxRef);
      maxMeas = Math.max(0.01, maxMeas);

      // Find intercept where reference crosses zero with positive slope
      let yIntercept = 0;
      let foundCrossing = false;
      for (let n = 0; n < N - 1; n++) {
        if (refSamples[n] <= 0 && refSamples[n + 1] > 0) {
          const frac = -refSamples[n] / (refSamples[n + 1] - refSamples[n]);
          yIntercept = samples[n] + frac * (samples[n + 1] - samples[n]);
          foundCrossing = true;
          break;
        }
      }

      if (!foundCrossing) {
        yIntercept = samples[0];
      }

      const ratio = Math.max(-1, Math.min(1, yIntercept / maxMeas));
      // Base phase difference
      let deltaPhiRad = Math.asin(ratio);

      // Check quadrant using measurement value when reference is near positive peak
      let peakRefIdx = 0;
      let peakRefVal = -Infinity;
      for (let n = 0; n < N; n++) {
        if (refSamples[n] > peakRefVal) {
          peakRefVal = refSamples[n];
          peakRefIdx = n;
        }
      }
      const yAtRefPeak = samples[peakRefIdx];
      if (yAtRefPeak < 0) {
        deltaPhiRad = deltaPhiRad >= 0 ? Math.PI - deltaPhiRad : -Math.PI - deltaPhiRad;
      }

      // Also compute baseline DFT phase of reference to orient absolute angle
      const dftRef = evaluatePhasorEstimate('dft', pairedRefFunc || evalFunc, tCenter, f0);
      const finalPhaseRad = normalizeAngleRad(dftRef.phaseRad + deltaPhiRad);
      const finalPhaseDeg = normalizeAngleDeg((finalPhaseRad * 180) / Math.PI);

      return {
        magnitude: Math.round(maxMeas * 1000) / 1000,
        rms: Math.round((maxMeas / Math.SQRT2) * 1000) / 1000,
        phaseDeg: finalPhaseDeg,
        phaseRad: finalPhaseRad,
        isValid: true,
        extraInfo: `Lissajous Intercept Ratio: ${ratio.toFixed(2)}`,
      };
    }

    case 'taylor-fourier': {
      // Method 6: Taylor-Fourier Estimation (1st Order)
      // Models x(tau) = Re((p0 + p1*(tau - tCenter)) * e^{j*w0*tau})
      // Equivalent to linear regression on orthogonal carrier bases
      let s0Cos = 0;
      let s0Sin = 0;
      let s1Cos = 0;
      let s1Sin = 0;
      let sumDT2 = 0;

      for (let n = 0; n < N; n++) {
        const dt = times[n] - tCenter;
        const thetaRel = 2 * Math.PI * f0 * dt;
        const c = Math.cos(thetaRel);
        const s = Math.sin(thetaRel);

        s0Cos += samples[n] * c;
        s0Sin += samples[n] * s;
        s1Cos += samples[n] * dt * c;
        s1Sin += samples[n] * dt * s;
        sumDT2 += dt * dt;
      }

      // Over symmetric centered window, linear cross-terms integrate to zero
      const p0c = (2 / N) * s0Cos;
      const p0s = (2 / N) * s0Sin;
      const p1c = (2 / sumDT2) * s1Cos;
      const p1s = (2 / sumDT2) * s1Sin;

      const mag = Math.sqrt(p0c * p0c + p0s * p0s);
      const alpha = Math.atan2(p0c, p0s);
      const phaseRad = normalizeAngleRad(alpha - 2 * Math.PI * f0 * tCenter);
      const phaseDeg = normalizeAngleDeg((phaseRad * 180) / Math.PI);

      const rocofRad = Math.sqrt(p1c * p1c + p1s * p1s);
      const rocofHz = Math.round((rocofRad / (2 * Math.PI)) * 100) / 100;

      return {
        magnitude: Math.round(mag * 1000) / 1000,
        rms: Math.round((mag / Math.SQRT2) * 1000) / 1000,
        phaseDeg,
        phaseRad,
        isValid: true,
        extraInfo: `Phasor Rate (Dynamic): ±${rocofHz} Hz/s`,
      };
    }

    default:
      return {
        magnitude: 1,
        rms: 0.707,
        phaseDeg: 0,
        phaseRad: 0,
        isValid: false,
      };
  }
}
