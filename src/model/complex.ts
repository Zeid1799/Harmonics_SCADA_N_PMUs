import { ComplexNumber, PhaseComponents, PolarNumber, SequenceComponents } from '../types/shortCircuit';

export function complex(re: number, im: number): ComplexNumber {
  return { re, im };
}

export const C_ZERO: ComplexNumber = { re: 0, im: 0 };
export const C_ONE: ComplexNumber = { re: 1, im: 0 };

/** Symmetrical components phase operator a = e^(j 120°) = -0.5 + j(sqrt(3)/2) */
export const A_OP: ComplexNumber = {
  re: -0.5,
  im: Math.sqrt(3) / 2,
};

/** Symmetrical components phase operator a^2 = e^(j 240°) = -0.5 - j(sqrt(3)/2) */
export const A2_OP: ComplexNumber = {
  re: -0.5,
  im: -Math.sqrt(3) / 2,
};

export function cAdd(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return { re: a.re + b.re, im: a.im + b.im };
}

export function cSub(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return { re: a.re - b.re, im: a.im - b.im };
}

export function cMul(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function cScale(a: ComplexNumber, s: number): ComplexNumber {
  return { re: a.re * s, im: a.im * s };
}

export function cDiv(a: ComplexNumber, b: ComplexNumber): ComplexNumber {
  const denom = b.re * b.re + b.im * b.im;
  if (denom < 1e-18) {
    return { re: 0, im: 0 };
  }
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}

export function cRecip(a: ComplexNumber): ComplexNumber {
  const denom = a.re * a.re + a.im * a.im;
  if (denom < 1e-18) {
    return { re: 0, im: 0 };
  }
  return { re: a.re / denom, im: -a.im / denom };
}

export function cConj(a: ComplexNumber): ComplexNumber {
  return { re: a.re, im: -a.im };
}

export function cMag(a: ComplexNumber): number {
  return Math.hypot(a.re, a.im);
}

export function cAngleRad(a: ComplexNumber): number {
  return Math.atan2(a.im, a.re);
}

export function cAngleDeg(a: ComplexNumber): number {
  return (Math.atan2(a.im, a.re) * 180) / Math.PI;
}

export function cToPolar(a: ComplexNumber): PolarNumber {
  return {
    mag: cMag(a),
    angleDeg: cAngleDeg(a),
  };
}

export function cFromPolar(mag: number, angleDeg: number): ComplexNumber {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    re: mag * Math.cos(rad),
    im: mag * Math.sin(rad),
  };
}

export function cFull(a: ComplexNumber): ComplexNumber & PolarNumber {
  const mag = cMag(a);
  const angleDeg = cAngleDeg(a);
  return {
    re: a.re,
    im: a.im,
    mag,
    angleDeg,
  };
}

/**
 * Solves a system of linear complex equations A * x = b using
 * Gaussian elimination with partial pivoting on complex numbers.
 * Matrix A is an n x n array of ComplexNumber, b is an n-length array of ComplexNumber.
 * Returns null if the matrix is singular or ill-conditioned.
 */
export function solveComplexLinearSystem(
  A: ComplexNumber[][],
  b: ComplexNumber[]
): ComplexNumber[] | null {
  const n = b.length;
  if (n === 0) return [];

  // Deep clone augmented matrix M = [A | b]
  const M: ComplexNumber[][] = Array.from({ length: n }, (_, r) => [
    ...A[r].map((val) => ({ ...val })),
    { ...b[r] },
  ]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting based on magnitude
    let pivotRow = col;
    let maxMag = cMag(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const mag = cMag(M[row][col]);
      if (mag > maxMag) {
        maxMag = mag;
        pivotRow = row;
      }
    }

    if (maxMag < 1e-13 || Number.isNaN(maxMag)) {
      return null; // Singular or ungrounded subnetwork
    }

    if (pivotRow !== col) {
      const temp = M[col];
      M[col] = M[pivotRow];
      M[pivotRow] = temp;
    }

    const pivot = M[col][col];

    for (let row = col + 1; row < n; row++) {
      const factor = cDiv(M[row][col], pivot);
      if (cMag(factor) === 0) continue;

      for (let k = col; k <= n; k++) {
        M[row][k] = cSub(M[row][k], cMul(factor, M[col][k]));
      }
    }
  }

  // Back-substitution
  const x: ComplexNumber[] = Array.from({ length: n }, () => ({ re: 0, im: 0 }));
  for (let row = n - 1; row >= 0; row--) {
    let sum = M[row][n];
    for (let col = row + 1; col < n; col++) {
      sum = cSub(sum, cMul(M[row][col], x[col]));
    }
    const diag = M[row][row];
    if (cMag(diag) < 1e-13) {
      return null;
    }
    x[row] = cDiv(sum, diag);
  }

  return x;
}

/**
 * Transforms sequence components [0, 1, 2] to phase quantities [a, b, c].
 * [V_a]   [ 1   1   1 ] [V_0]
 * [V_b] = [ 1  a^2  a ] [V_1]
 * [V_c]   [ 1   a  a^2] [V_2]
 */
export function sequenceToPhase(
  seq: SequenceComponents<ComplexNumber>
): PhaseComponents<ComplexNumber> {
  const { zero, positive, negative } = seq;

  // V_a = V_0 + V_1 + V_2
  const a = cAdd(zero, cAdd(positive, negative));

  // V_b = V_0 + a^2 * V_1 + a * V_2
  const a2_pos = cMul(A2_OP, positive);
  const a_neg = cMul(A_OP, negative);
  const b = cAdd(zero, cAdd(a2_pos, a_neg));

  // V_c = V_0 + a * V_1 + a^2 * V_2
  const a_pos = cMul(A_OP, positive);
  const a2_neg = cMul(A2_OP, negative);
  const c = cAdd(zero, cAdd(a_pos, a2_neg));

  return { a, b, c };
}

/**
 * Transforms phase quantities [a, b, c] to sequence components [0, 1, 2].
 * [V_0]         [ 1   1   1 ] [V_a]
 * [V_1] = (1/3) [ 1   a  a^2] [V_b]
 * [V_2]         [ 1  a^2  a ] [V_c]
 */
export function phaseToSequence(
  phase: PhaseComponents<ComplexNumber>
): SequenceComponents<ComplexNumber> {
  const { a, b, c } = phase;
  const oneThird = 1 / 3;

  // V_0 = (1/3) * (V_a + V_b + V_c)
  const zero = cScale(cAdd(a, cAdd(b, c)), oneThird);

  // V_1 = (1/3) * (V_a + a * V_b + a^2 * V_c)
  const positive = cScale(cAdd(a, cAdd(cMul(A_OP, b), cMul(A2_OP, c))), oneThird);

  // V_2 = (1/3) * (V_a + a^2 * V_b + a * V_c)
  const negative = cScale(cAdd(a, cAdd(cMul(A2_OP, b), cMul(A_OP, c))), oneThird);

  return { zero, positive, negative };
}
