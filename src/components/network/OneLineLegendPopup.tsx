import React, { useState, useRef, useEffect } from 'react';
import { Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { SimulatorOverlayConfig } from '../../types/network';

interface OneLineLegendPopupProps {
  overlayConfig: SimulatorOverlayConfig;
}

export const OneLineLegendPopup: React.FC<OneLineLegendPopupProps> = ({
  overlayConfig,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 220);
  };

  const handleClickToggle = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen((prev) => !prev);
  };

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, [isOpen]);

  const { loadingThresholds } = overlayConfig;

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onWheel={(e) => e.stopPropagation()}
      className="absolute bottom-3 right-3 z-30 select-none font-mono"
    >
      {/* Floating Legend Trigger Button */}
      <button
        type="button"
        onClick={handleClickToggle}
        aria-expanded={isOpen}
        aria-label="Toggle One-Line Diagram Legend"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border shadow-lg text-[11px] font-bold transition-all cursor-pointer ${
          isOpen
            ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/20'
            : 'bg-white/95 dark:bg-slate-900/95 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800'
        }`}
      >
        <Layers className="w-3.5 h-3.5" />
        <span>Legend</span>
        {isOpen ? (
          <ChevronDown className="w-3 h-3 opacity-80" />
        ) : (
          <ChevronUp className="w-3 h-3 opacity-80" />
        )}
      </button>

      {/* Floating Centralized Legend Popup */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="One-Line Diagram Legend Details"
          className="absolute bottom-full right-0 mb-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl p-3.5 text-xs text-slate-700 dark:text-slate-200 space-y-3 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              One-Line Diagram Legend
            </span>
            <span className="text-[10px] text-slate-400">IEEE 30-Bus</span>
          </div>

          {/* Section 1: Voltage Tiers */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Voltage Tiers
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
              <div className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300">
                <span className="w-2.5 h-1 rounded-sm bg-sky-500 shrink-0" />
                <span className="truncate">132 kV (Backbone)</span>
              </div>
              <div className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                <span className="w-2.5 h-1 rounded-sm bg-indigo-500 shrink-0" />
                <span className="truncate">33 kV (Subtrans)</span>
              </div>
              <div className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300">
                <span className="w-2.5 h-1 rounded-sm bg-purple-500 shrink-0" />
                <span className="truncate">11 kV (Tertiary)</span>
              </div>
            </div>
          </div>

          {/* Section 2: Branch Thermal Loading */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Branch Thermal Loading (Rate A)
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span>&lt;{loadingThresholds.elevatedPercent}% Normal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shrink-0" />
                <span>
                  {loadingThresholds.elevatedPercent}–{loadingThresholds.highPercent}% Elevated
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                <span>
                  {loadingThresholds.highPercent}–{loadingThresholds.overloadPercent}% High
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                <span>&gt;{loadingThresholds.overloadPercent}% Overload</span>
              </div>
              <div className="flex items-center gap-1.5 col-span-2 text-slate-500 dark:text-slate-400">
                <span className="w-3 h-0.5 border-b border-dashed border-slate-400 shrink-0" />
                <span>Dashed: De-energized / Open Branch</span>
              </div>
            </div>
          </div>

          {/* Section 3: Equipment Symbols */}
          <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Equipment Symbols
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-[9px]">
                  G
                </span>
                <span>Generator</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold flex items-center justify-center shrink-0 text-[8px]">
                  SC
                </span>
                <span>Sync Condenser</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 text-amber-500 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  ▼
                </span>
                <span>Load Demand</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 text-fuchsia-500 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  ⫴
                </span>
                <span>Shunt Capacitor</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 text-indigo-500 font-bold flex items-center justify-center shrink-0 text-[11px]">
                  ◎
                </span>
                <span>Transformer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 bg-emerald-500 rounded-sm shrink-0" />
                <span>Slack Bus (Ref)</span>
              </div>
            </div>
          </div>

          {/* Section 4: Dynamic Flow Visualization (Phase D) */}
          <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Dynamic Flow Encoding (AC Power Flow)
            </div>
            <div className="space-y-1 text-[10px]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-0.5 border-b-2 border-dashed border-emerald-500 shrink-0" />
                <span>Stream speed scales with active power MW</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500 font-bold shrink-0">▶</span>
                <span>Chevrons follow electrical flow (sign of P)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full border border-slate-400 bg-slate-300 dark:bg-slate-700 shrink-0" />
                <span>Neutral circle: Negligible flow (|P| &lt; 0.05 MW)</span>
              </div>
            </div>
          </div>

          {/* Section 5: Overlay & Flow Arrows */}
          <div className="pt-1.5 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span>▶</span>
              <span>Arrow indicates active flow (P &gt; 0)</span>
            </span>
            <span>Hover/Click to toggle</span>
          </div>
        </div>
      )}
    </div>
  );
};
