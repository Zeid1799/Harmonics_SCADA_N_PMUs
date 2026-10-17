import { HarmonicPercentages, CustomTerm } from '../types/waveform';

export interface ParseResult {
  success: boolean;
  error?: string;
  fundamentalFrequency?: number;
  fundamentalAmplitude?: number;
  harmonics?: HarmonicPercentages;
  phase?: number;
  dcOffset?: number;
  customTerms?: CustomTerm[];
}

interface ExtractedTerm {
  type: 'sine' | 'dc';
  amplitude: number;
  frequency: number; // in Hz
  phaseRad: number;
}

export interface WaveformParseContext {
  currentFundamentalFrequency?: number;
  currentFundamentalAmplitude?: number;
  currentHarmonics?: HarmonicPercentages;
  currentCustomTerms?: CustomTerm[];
}

/**
 * Automatically replace occurrences of "pi" (case-insensitive) with the Greek symbol "π"
 * while correctly preserving and adjusting the cursor position.
 */
export function replacePiWithSymbol(
  text: string,
  cursorPosition?: number
): { text: string; cursorPosition: number; replaced: boolean } {
  const pos = cursorPosition ?? text.length;
  if (!/pi/i.test(text)) {
    return { text, cursorPosition: pos, replaced: false };
  }

  let newCursorPos = pos;

  const newText = text.replace(/pi/gi, (match, matchIndex) => {
    // If the match ends at or before current cursor position, reduce cursor by 1
    if (matchIndex + match.length <= pos) {
      newCursorPos -= 1;
    } else if (matchIndex < pos && pos < matchIndex + match.length) {
      // Cursor was positioned between 'p' and 'i'
      newCursorPos = matchIndex + 1;
    }
    return 'π';
  });

  return {
    text: newText,
    cursorPosition: Math.max(0, Math.min(newText.length, newCursorPos)),
    replaced: true,
  };
}

/**
 * Inserts a symbol (e.g. "π") at the specified selection or cursor position,
 * returning the new text and the updated cursor position placed immediately after the symbol.
 */
export function insertSymbolAtCursor(
  text: string,
  symbol: string,
  selectionStart?: number,
  selectionEnd?: number
): { text: string; cursorPosition: number } {
  const start = selectionStart ?? text.length;
  const end = selectionEnd ?? start;
  const before = text.substring(0, start);
  const after = text.substring(end);
  const newText = before + symbol + after;
  const cursorPosition = start + symbol.length;
  return { text: newText, cursorPosition };
}

/**
 * Parses a mathematical waveform equation string into waveform parameters.
 * Supports:
 *   - "x(t) = 1.00 sin(2π·60t) + 0.20 sin(2π·120t)"
 *   - "sin(2π60t) + 0.2sin(2π120t)"
 *   - "1.5 * sin(2 * pi * 50 * t)"
 *   - "sin(120*pi*t)"
 *   - Arbitrary subharmonics, interharmonics, and custom terms (e.g. 0.1 sin(2π·30t))
 *   - Shorthand, decimals, DC offsets, and multi-harmonic linear combinations.
 */
export function parseWaveformEquation(
  input: string,
  context?: WaveformParseContext
): ParseResult {
  if (!input || !input.trim()) {
    return { success: false, error: 'Equation cannot be empty' };
  }

  try {
    let clean = input.trim();

    // Strip leading function notation: e.g. "x(t) =", "y(t) =", "v(t) ="
    clean = clean.replace(/^[a-zA-Z]\s*\(\s*t\s*\)\s*=\s*/i, '');

    // Normalize characters:
    // Multiplication symbols
    clean = clean.replace(/·|×|•/g, '*');
    // Greek pi symbols (Unicode π, mathematical bold/italic/sans-serif pi)
    clean = clean.replace(/[\u03C0\u{1D6D1}\u{1D70B}\u{1D745}\u{1D77F}]/gu, 'pi');

    // Split expression into signed terms (+ / -) respecting parentheses
    const terms = splitAdditiveTerms(clean);
    if (terms.length === 0) {
      return { success: false, error: 'No terms identified in equation' };
    }

    const extracted: ExtractedTerm[] = [];

    for (const termStr of terms) {
      const parsedTerm = parseSingleTerm(termStr);
      if (!parsedTerm) {
        return {
          success: false,
          error: `Could not parse term: "${termStr.trim()}"`,
        };
      }
      extracted.push(parsedTerm);
    }

    const sineTerms = extracted.filter((t) => t.type === 'sine' && t.frequency > 0);
    const dcTerms = extracted.filter((t) => t.type === 'dc');

    const totalDcOffset = dcTerms.reduce((sum, t) => sum + t.amplitude, 0);

    if (sineTerms.length === 0) {
      if (dcTerms.length > 0) {
        return {
          success: true,
          fundamentalFrequency: context?.currentFundamentalFrequency ?? 60,
          fundamentalAmplitude: 0,
          harmonics: { second: 0, third: 0, fourth: 0 },
          dcOffset: totalDcOffset,
          phase: 0,
          customTerms: [],
        };
      }
      return { success: false, error: 'No valid sinusoidal components found' };
    }

    // Identify the fundamental component
    let fundamental: ExtractedTerm | null = null;

    // Strategy 1: Match against known fundamental frequency from context if present
    if (context?.currentFundamentalFrequency !== undefined && context.currentFundamentalFrequency > 0) {
      const targetFreq = context.currentFundamentalFrequency;
      const matches = sineTerms.filter((t) => Math.abs(t.frequency - targetFreq) < 0.1);
      if (matches.length > 0) {
        if (matches.length === 1) {
          fundamental = matches[0];
        } else {
          const targetAmp = context.currentFundamentalAmplitude ?? 1.0;
          fundamental = matches.reduce((best, curr) =>
            Math.abs(curr.amplitude - targetAmp) < Math.abs(best.amplitude - targetAmp) ? curr : best
          );
        }
      }
    }

    // Strategy 2: Multi-factor candidate scoring when no context match was found
    if (!fundamental) {
      let bestScore = -Infinity;
      let bestCandidate = sineTerms[0];

      for (const cand of sineTerms) {
        let score = 0;

        // Carrier amplitude weight (fundamentals are dominant carriers in power systems)
        score += cand.amplitude * 50;

        // Proximity to nominal grid frequency (60 Hz or 50 Hz)
        if (Math.abs(cand.frequency - 60) < 0.1 || Math.abs(cand.frequency - 50) < 0.1) {
          score += 100;
        } else if (cand.frequency >= 10 && cand.frequency <= 120) {
          score += 20;
        }

        // Harmonic relationships with other terms
        for (const other of sineTerms) {
          if (other === cand) continue;
          const ratio = other.frequency / cand.frequency;
          const isHarmonicMultiple = [2, 3, 4].some((n) => Math.abs(ratio - n) < 0.05);
          if (isHarmonicMultiple) {
            if (other.amplitude <= cand.amplitude * 1.5) {
              // Legitimate harmonic multiple of cand
              score += 40;
            } else {
              // The other term is substantially larger, indicating cand is a subharmonic
              score -= 60;
            }
          }
        }

        // Penalize terms that match known custom terms from context so they aren't mistaken for fundamental
        if (context?.currentCustomTerms?.some((ct) => Math.abs(ct.frequency - cand.frequency) < 0.1)) {
          score -= 200;
        }

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = cand;
        }
      }

      fundamental = bestCandidate;
    }

    const f0 = fundamental.frequency;
    const a1 = Math.max(0, fundamental.amplitude);
    const phaseDeg = Math.round((fundamental.phaseRad * 180) / Math.PI);

    const harmonics: HarmonicPercentages = {
      second: 0,
      third: 0,
      fourth: 0,
    };

    const customTerms: CustomTerm[] = [];

    // Categorize remaining sinusoidal terms into designated harmonics vs independent custom terms
    for (const term of sineTerms) {
      if (term === fundamental) continue;

      const ratio = term.frequency / f0;

      // Check if it matches designated 2nd harmonic (approx 2x ± 3%, min 0.2 Hz tolerance)
      if (Math.abs(ratio - 2) < 0.05 && harmonics.second === 0) {
        const pct = a1 > 0 ? (term.amplitude / a1) * 100 : 0;
        harmonics.second = Math.min(50, Math.max(0, Math.round(pct)));
      }
      // Check if it matches designated 3rd harmonic (approx 3x ± 3%)
      else if (Math.abs(ratio - 3) < 0.05 && harmonics.third === 0) {
        const pct = a1 > 0 ? (term.amplitude / a1) * 100 : 0;
        harmonics.third = Math.min(50, Math.max(0, Math.round(pct)));
      }
      // Check if it matches designated 4th harmonic (approx 4x ± 3%)
      else if (Math.abs(ratio - 4) < 0.05 && harmonics.fourth === 0) {
        const pct = a1 > 0 ? (term.amplitude / a1) * 100 : 0;
        harmonics.fourth = Math.min(50, Math.max(0, Math.round(pct)));
      }
      // Non-designated term (subharmonic, interharmonic, or higher order): preserve independently!
      else {
        customTerms.push({
          amplitude: term.amplitude,
          frequency: term.frequency,
          phaseRad: term.phaseRad,
        });
      }
    }

    // Fundamental frequency clamped to allowed bounds [1, 120] if possible, or kept as parsed
    const boundedFreq = Math.min(120, Math.max(1, Math.round(f0 * 100) / 100));
    const boundedAmp = Math.min(2.0, Math.max(0, Math.round(a1 * 100) / 100));

    return {
      success: true,
      fundamentalFrequency: boundedFreq,
      fundamentalAmplitude: boundedAmp,
      harmonics,
      phase: phaseDeg,
      dcOffset: Math.round(totalDcOffset * 100) / 100,
      customTerms,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown parsing error';
    return { success: false, error: message };
  }
}

/**
 * Split an equation into additive components (+ and -) outside of parentheses.
 */
function splitAdditiveTerms(expr: string): string[] {
  const terms: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];

    if (ch === '(') depth++;
    else if (ch === ')') depth--;

    if (depth === 0 && (ch === '+' || ch === '-') && i > 0 && current.trim().length > 0) {
      // Check if this +/- is not scientific notation like 1e-3
      const prevChar = expr[i - 1];
      if (prevChar.toLowerCase() !== 'e') {
        terms.push(current.trim());
        current = ch === '-' ? '-' : '';
        continue;
      }
    }

    current += ch;
  }

  if (current.trim().length > 0) {
    terms.push(current.trim());
  }

  return terms;
}

/**
 * Parses a single additive term into either a DC constant or sinusoidal component.
 */
function parseSingleTerm(termStr: string): ExtractedTerm | null {
  const str = termStr.trim();
  if (!str) return null;

  // 1. Check if it's purely a number (DC offset)
  const numVal = Number(str);
  if (!isNaN(numVal)) {
    return {
      type: 'dc',
      amplitude: numVal,
      frequency: 0,
      phaseRad: 0,
    };
  }

  // 2. Check for sin or cos: e.g. "1.00 sin(2*pi*60*t)" or "sin(2pi60t)"
  const funcMatch = str.match(/^([+-]?\s*\d*\.?\d*)\s*\*?\s*(sin|cos)\s*\((.+)\)$/i);
  if (!funcMatch) {
    // Also try without parentheses if typed as e.g. "sin 2pi 60 t"
    return null;
  }

  const rawAmpStr = funcMatch[1].replace(/\s+/g, '');
  const funcType = funcMatch[2].toLowerCase();
  const innerArg = funcMatch[3].trim();

  let amplitude = 1.0;
  if (rawAmpStr === '' || rawAmpStr === '+') amplitude = 1.0;
  else if (rawAmpStr === '-') amplitude = -1.0;
  else {
    const parsedAmp = parseFloat(rawAmpStr);
    if (isNaN(parsedAmp)) return null;
    amplitude = parsedAmp;
  }

  // Parse inner argument for frequency and phase
  // Argument typically contains 't'
  if (!innerArg.includes('t')) {
    // If no 't', it's a constant
    return null;
  }

  const freqAndPhase = parseInnerArgument(innerArg);
  if (!freqAndPhase) return null;

  let { frequency, phaseRad } = freqAndPhase;

  // If function is cos, convert to sin with + pi/2 phase
  if (funcType === 'cos') {
    phaseRad += Math.PI / 2;
  }

  // If amplitude is negative, invert by adjusting phase or keeping positive magnitude
  if (amplitude < 0) {
    amplitude = Math.abs(amplitude);
    phaseRad += Math.PI;
  }

  return {
    type: 'sine',
    amplitude,
    frequency,
    phaseRad,
  };
}

/**
 * Parses inner argument like "2*pi*60*t", "2pi·60t", "120*pi*t", "377*t + 0.5"
 */
function parseInnerArgument(arg: string): { frequency: number; phaseRad: number } | null {
  // Check for phase offset "+ something"
  let cleanArg = arg.replace(/\s+/g, '');
  let phaseRad = 0;

  // Split at '+' or '-' if phase is present outside of 't'
  const tIndex = cleanArg.indexOf('t');
  if (tIndex === -1) return null;

  // Check if there is something after 't' like "+ 30" or "+ 0.5"
  const afterT = cleanArg.substring(tIndex + 1);
  if (afterT.startsWith('+') || afterT.startsWith('-')) {
    const phaseStr = afterT.replace(/deg|°/i, '');
    const pVal = parseFloat(phaseStr);
    if (!isNaN(pVal)) {
      if (afterT.includes('deg') || afterT.includes('°')) {
        phaseRad = (pVal * Math.PI) / 180;
      } else {
        phaseRad = pVal;
      }
    }
  }

  // Factor before 't'
  let coeff = cleanArg.substring(0, tIndex);
  if (coeff.endsWith('*')) {
    coeff = coeff.substring(0, coeff.length - 1);
  }

  if (!coeff) {
    // Just "t", omega = 1 rad/s -> f = 1 / (2*pi)
    return { frequency: 1 / (2 * Math.PI), phaseRad };
  }

  // Normalize coeff
  // Forms:
  // "2*pi*60" -> f = 60
  // "2pi*60" or "2pi60" -> f = 60
  // "120*pi" -> f = 60
  // "2*pi*f"
  // "376.99" -> f = 376.99 / (2*pi) = 60

  // Case 1: contains "2*pi" or "2pi"
  const twoPiPattern = /^(?:2\s*\*?\s*pi|pi\s*\*?\s*2)\s*\*?\s*(.+)$/i;
  const twoPiMatch = coeff.match(twoPiPattern);
  if (twoPiMatch) {
    const fStr = twoPiMatch[1];
    const fVal = evaluateSimpleMath(fStr);
    if (fVal !== null && fVal > 0) {
      return { frequency: fVal, phaseRad };
    }
  }

  // Case 2: contains "pi" (e.g. "120*pi")
  if (/pi/i.test(coeff)) {
    // Replace "pi" with 1 to extract the numerical multiplier
    const withoutPi = coeff.replace(/pi/gi, '1');
    const totalMultiplier = evaluateSimpleMath(withoutPi);
    if (totalMultiplier !== null && totalMultiplier > 0) {
      // omega = totalMultiplier * pi = 2 * pi * f => f = totalMultiplier / 2
      const f = totalMultiplier / 2;
      return { frequency: f, phaseRad };
    }
  }

  // Case 3: pure numerical angular frequency (omega = 2*pi*f)
  const omega = evaluateSimpleMath(coeff);
  if (omega !== null && omega > 0) {
    const f = omega / (2 * Math.PI);
    return { frequency: Math.round(f * 100) / 100, phaseRad };
  }

  return null;
}

/**
 * Safely evaluates simple numerical multiplication expressions like "60", "2*60", "120"
 */
function evaluateSimpleMath(expr: string): number | null {
  const sanitized = expr.replace(/[^\d.*+-]/g, '');
  if (!sanitized) return null;

  try {
    const parts = sanitized.split('*');
    let product = 1;
    for (const p of parts) {
      const val = parseFloat(p);
      if (isNaN(val)) return null;
      product *= val;
    }
    return product;
  } catch {
    return null;
  }
}
