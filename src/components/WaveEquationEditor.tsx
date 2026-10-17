import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  parseWaveformEquation,
  replacePiWithSymbol,
  insertSymbolAtCursor,
} from '../model/equationParser';
import { WaveformState } from '../types/waveform';
import { Edit3, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface WaveEquationEditorProps {
  state: WaveformState;
  onApplyParsedEquation: (parsed: {
    fundamentalFrequency?: number;
    fundamentalAmplitude?: number;
    harmonics?: { second: number; third: number; fourth: number };
    phase?: number;
    dcOffset?: number;
    customTerms?: any[];
    rawEquation: string;
  }) => void;
  onResetToDefault: () => void;
}

export const WaveEquationEditor: React.FC<WaveEquationEditorProps> = ({
  state,
  onApplyParsedEquation,
  onResetToDefault,
}) => {
  const [inputValue, setInputValue] = useState<string>(state.equation);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSynced, setIsSynced] = useState<boolean>(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const cursorPosToRestoreRef = useRef<number | null>(null);

  // Sync input value with state when state changes from sliders (unless user is actively typing)
  useEffect(() => {
    if (!isFocused) {
      setInputValue(state.equation);
      setValidationError(null);
      setIsSynced(true);
    }
  }, [state.equation, isFocused]);

  // Restore cursor position smoothly before paint when text is programmatically transformed
  useLayoutEffect(() => {
    if (cursorPosToRestoreRef.current !== null && inputRef.current) {
      const pos = cursorPosToRestoreRef.current;
      inputRef.current.setSelectionRange(pos, pos);
      cursorPosToRestoreRef.current = null;
    }
  });

  const applyEquationString = (eqStr: string) => {
    if (!eqStr.trim()) {
      setValidationError('Equation cannot be empty');
      return;
    }

    const parseResult = parseWaveformEquation(eqStr, {
      currentFundamentalFrequency: state.fundamentalFrequency,
      currentFundamentalAmplitude: state.fundamentalAmplitude,
      currentHarmonics: state.harmonics,
      currentCustomTerms: state.customTerms,
    });

    if (parseResult.success) {
      setValidationError(null);
      onApplyParsedEquation({
        fundamentalFrequency: parseResult.fundamentalFrequency,
        fundamentalAmplitude: parseResult.fundamentalAmplitude,
        harmonics: parseResult.harmonics,
        phase: parseResult.phase,
        dcOffset: parseResult.dcOffset,
        customTerms: parseResult.customTerms,
        rawEquation: eqStr,
      });
      setIsSynced(true);
    } else {
      setValidationError(parseResult.error || 'Invalid equation syntax');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    let rawExpr = input.value;
    const cursorPos = input.selectionStart ?? rawExpr.length;

    // Strip leading function notation if pasted
    rawExpr = rawExpr.replace(/^[a-zA-Z]\s*\(\s*t\s*\)\s*=\s*/i, '');

    // Auto-replace "pi" with "π" while maintaining precise cursor position
    const { text: newExpr, cursorPosition: newCursorPos, replaced } = replacePiWithSymbol(
      rawExpr,
      cursorPos
    );

    if (replaced) {
      cursorPosToRestoreRef.current = newCursorPos;
    }

    const fullEq = `x(t) = ${newExpr}`;
    setInputValue(fullEq);
    setIsSynced(false);

    applyEquationString(fullEq);
  };

  const handleInsertPi = (e: React.MouseEvent) => {
    e.preventDefault();
    const input = inputRef.current;
    if (!input) return;

    // Get current expression without "x(t) = "
    const currentExpr = input.value;
    const start = input.selectionStart ?? currentExpr.length;
    const end = input.selectionEnd ?? start;

    const { text: newExpr, cursorPosition: newPos } = insertSymbolAtCursor(
      currentExpr,
      'π',
      start,
      end
    );

    cursorPosToRestoreRef.current = newPos;
    const fullEq = `x(t) = ${newExpr}`;
    setInputValue(fullEq);
    setIsSynced(false);

    input.focus();
    input.setSelectionRange(newPos, newPos);

    applyEquationString(fullEq);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d121f] px-3.5 py-2.5 shadow-md transition-all">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-400 font-mono">
            <Edit3 className="w-3 h-3 text-cyan-500" />
            Wave Equation <span className="text-[10px] lowercase text-slate-400 dark:text-slate-500 font-normal">(canonical model)</span>
          </label>

          <div className="flex items-center gap-2">
            {validationError ? (
              <span className="flex items-center gap-1 text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800/50">
                <AlertCircle className="w-2.5 h-2.5 text-amber-500" />
                {validationError}
              </span>
            ) : isSynced ? (
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800/40">
                <Check className="w-2.5 h-2.5 text-emerald-500" />
                Synchronized
              </span>
            ) : null}

            <button
              onClick={onResetToDefault}
              title="Reset to 60Hz 1.0pu Default"
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Input box with integrated π button */}
        <div className="relative flex items-center">
          <div className="absolute left-3 font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400 select-none pointer-events-none">
            x(t) =
          </div>
          <input
            ref={inputRef}
            type="text"
            value={inputValue.replace(/^[a-zA-Z]\s*\(\s*t\s*\)\s*=\s*/i, '')}
            onChange={handleInputChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              if (!validationError) {
                setIsSynced(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="1.00 sin(2π·60t) + 0.20 sin(2π·120t)"
            className={`w-full rounded-lg border bg-slate-50 dark:bg-[#080b12] pl-16 pr-10 py-1.5 font-mono text-xs text-slate-900 dark:text-cyan-100 transition-all outline-none focus:ring-1 ${
              validationError
                ? 'border-amber-500 focus:border-amber-500 focus:ring-amber-500/20'
                : 'border-slate-300 dark:border-slate-800 focus:border-cyan-500 focus:ring-cyan-500/20'
            }`}
          />
          {/* Dedicated π button */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleInsertPi}
            title="Insert π (pi)"
            aria-label="Insert π symbol"
            className="absolute right-2 px-2 py-0.5 text-xs font-serif font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-200 bg-cyan-500/10 hover:bg-cyan-500/20 active:bg-cyan-500/30 rounded border border-cyan-500/30 transition-all active:scale-95 select-none"
          >
            π
          </button>
        </div>
      </div>
    </div>
  );
};
