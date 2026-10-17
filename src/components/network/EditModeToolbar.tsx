import React, { useEffect } from 'react';
import {
  SelectedNetworkElement,
  NetworkValidationReport,
} from '../../types/network';
import {
  Lock,
  Edit3,
  Sliders,
  Power,
  Undo2,
  Redo2,
  ShieldCheck,
  Play,
  RotateCcw,
} from 'lucide-react';

interface EditModeToolbarProps {
  isEditMode: boolean;
  onToggleEditMode: () => void;
  selectedElement: SelectedNetworkElement | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenSelectedModal: () => void;
  onToggleSelectedStatus: () => void;
  onOpenValidationModal: () => void;
  validationReport: NetworkValidationReport | null;
  isStale: boolean;
  onRunPowerFlow: () => void;
  onOpenResetConfirm: () => void;
}

export const EditModeToolbar: React.FC<EditModeToolbarProps> = ({
  isEditMode,
  onToggleEditMode,
  selectedElement,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenSelectedModal,
  onToggleSelectedStatus,
  onOpenValidationModal,
  validationReport,
  isStale,
  onRunPowerFlow,
  onOpenResetConfirm,
}) => {
  // Global keyboard shortcuts for editing workflow
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) onRedo();
        } else {
          if (canUndo) onUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (canRedo) onRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, onUndo, onRedo]);

  const hasErrors = (validationReport?.errorCount ?? 0) > 0;
  const hasWarnings = (validationReport?.warningCount ?? 0) > 0;

  return (
    <div
      className={`rounded-xl px-3.5 py-2.5 shadow-sm border transition-all flex flex-wrap items-center justify-between gap-3 text-xs select-none ${
        isEditMode
          ? 'bg-amber-500/10 dark:bg-amber-950/20 border-amber-500/40 shadow-amber-500/5'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Left: Prominent Edit Mode Switcher & Interaction Hint */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleEditMode}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold transition-all shadow-sm cursor-pointer ${
            isEditMode
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-400/50'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
          title={
            isEditMode
              ? 'Click to turn off Edit Mode (switches to Read-Only inspection)'
              : 'Click to activate Edit Mode (allows modifying equipment parameters)'
          }
        >
          {isEditMode ? (
            <>
              <Edit3 size={14} className="animate-bounce" />
              <span>Edit Mode: ACTIVE</span>
              <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
            </>
          ) : (
            <>
              <Lock size={14} className="text-slate-400" />
              <span>Edit Mode: OFF (Inspect Only)</span>
            </>
          )}
        </button>

        <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:inline">
          {isEditMode
            ? '⚡ Double-click any apparatus on the diagram to edit settings • Single-click to select'
            : '🔍 Double-click any apparatus to inspect read-only properties'}
        </span>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />

        {/* Selected Component Shortcut Actions */}
        <button
          type="button"
          disabled={!selectedElement}
          onClick={onOpenSelectedModal}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
            selectedElement
              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer'
              : 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 cursor-not-allowed'
          }`}
          title={
            selectedElement
              ? `${isEditMode ? 'Edit' : 'Inspect'} ${selectedElement.id}`
              : 'Select a component on the diagram'
          }
        >
          <Sliders size={13} />
          <span>{isEditMode ? 'Edit Selected' : 'Inspect Selected'}</span>
        </button>

        {isEditMode && (
          <button
            type="button"
            disabled={!selectedElement}
            onClick={onToggleSelectedStatus}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
              selectedElement
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }`}
            title={
              selectedElement
                ? `Toggle operating status of ${selectedElement.id}`
                : 'Select a component to toggle status'
            }
          >
            <Power size={13} />
            <span>Toggle Status</span>
          </button>
        )}
      </div>

      {/* Right: History (Undo/Redo), Validation & Solver Trigger */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Undo */}
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg font-semibold transition-colors ${
            canUndo
              ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer'
              : 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 cursor-not-allowed'
          }`}
          title="Undo last parameter edit (Ctrl+Z)"
        >
          <Undo2 size={13} />
          <span>Undo</span>
        </button>

        {/* Redo */}
        <button
          type="button"
          disabled={!canRedo}
          onClick={onRedo}
          className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg font-semibold transition-colors ${
            canRedo
              ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer'
              : 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-600 cursor-not-allowed'
          }`}
          title="Redo next parameter edit (Ctrl+Y)"
        >
          <Redo2 size={13} />
          <span>Redo</span>
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />

        {/* Validation Button */}
        <button
          type="button"
          onClick={onOpenValidationModal}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold border transition-colors cursor-pointer ${
            hasErrors
              ? 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
              : hasWarnings
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
          }`}
          title="Validate physical limits and constraint consistency"
        >
          <ShieldCheck size={13} />
          <span>Validate</span>
          {hasErrors && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
        </button>

        {/* Solve Power Flow */}
        <button
          type="button"
          onClick={onRunPowerFlow}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold shadow-sm transition-all cursor-pointer ${
            isStale
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-400/50'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
          title="Calculate steady-state AC Power Flow for current working model"
        >
          <Play size={12} className="fill-current" />
          <span>{isStale ? 'Solve (Stale)' : 'Solve AC Flow'}</span>
        </button>

        {/* Reset to Defaults */}
        <button
          type="button"
          onClick={onOpenResetConfirm}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Restore baseline IEEE 30-bus network parameters"
        >
          <RotateCcw size={13} />
          <span className="hidden sm:inline">Reset Defaults</span>
        </button>
      </div>
    </div>
  );
};
