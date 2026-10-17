/**
 * Complex Number helper module for AC Circuit & Phasor Calculations.
 * All angles are in radians internally, with helpers for degree conversions.
 */

export interface Complex {
  readonly re: number;
  readonly im: number;
}

/** Creates a complex number from rectangular coordinates */
export function complex(re: number, im: number = 0): Complex {
  return { re, im };
}

/** Creates a complex number from polar coordinates (magnitude, angle in radians) */
export function complexFromPolar(magnitude: number, angleRad: number): Complex {
  return {
    re: magnitude * Math.cos(angleRad),
    im: magnitude * Math.sin(angleRad),
  };
}

/** Complex addition: a + b */
export function complexAdd(a: Complex, b: Complex): Complex {
  return {
    re: a.re + b.re,
    im: a.im + b.im,
  };
}

/** Complex subtraction: a - b */
export function complexSub(a: Complex, b: Complex): Complex {
  return {
    re: a.re - b.re,
    im: a.im - b.im,
  };
}

/** Complex multiplication: a * b */
export function complexMultiply(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

/** Complex scalar multiplication: a * factor */
export function complexScale(a: Complex, factor: number): Complex {
  return {
    re: a.re * factor,
    im: a.im * factor,
  };
}

/** Complex division: a / b */
export function complexDivide(numerator: Complex, denominator: Complex): Complex {
  const d = denominator.re * denominator.re + denominator.im * denominator.im;
  if (d === 0) {
    throw new Error('Division by zero in complexDivide');
  }
  return {
    re: (numerator.re * denominator.re + numerator.im * denominator.im) / d,
    im: (numerator.im * denominator.re - numerator.re * denominator.im) / d,
  };
}

/** Magnitude (absolute value) of a complex number: |c| = sqrt(re^2 + im^2) */
export function complexMagnitude(c: Complex): number {
  return Math.hypot(c.re, c.im);
}

/** Phase angle of a complex number in radians: theta = atan2(im, re) in (-π, π] */
export function complexPhaseRad(c: Complex): number {
  if (c.re === 0 && c.im === 0) return 0;
  return Math.atan2(c.im, c.re);
}

/** Converts radians to degrees */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Converts degrees to radians */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Normalizes an angle in degrees into the standard interval (-180°, +180°].
 * Maps -180° to +180° (standard branch cut) and eliminates -0.
 */
export function normalizeAngleDeg(deg: number): number {
  let normalized = deg % 360;
  if (normalized > 180) {
    normalized -= 360;
  } else if (normalized <= -180) {
    normalized += 360;
  }
  return Object.is(normalized, -0) ? 0 : normalized;
}

/**
 * Normalizes an angle in radians into the standard interval (-π, +π].
 */
export function normalizeAngleRad(rad: number): number {
  let normalized = rad % (2 * Math.PI);
  if (normalized > Math.PI) {
    normalized -= 2 * Math.PI;
  } else if (normalized <= -Math.PI) {
    normalized += 2 * Math.PI;
  }
  return Object.is(normalized, -0) ? 0 : normalized;
}
