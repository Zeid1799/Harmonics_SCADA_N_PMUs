import React, { useEffect } from 'react';
import {
  OlChangesTool,
  NetworkEquipmentCategory,
  SelectedNetworkElement,
  NetworkValidationReport,
} from '../../types/network';
import {
  MousePointer,
  GitPullRequest,
  PlusCircle,
  Sliders,
  Power,
  Trash2,
  Undo2,
  Redo2,
  ShieldCheck,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';

interface OlChangesToolbarProps {
  activeTool: OlChangesTool;
  onChangeTool: (tool: OlChangesTool) => void;
  selectedElement: SelectedNetworkElement | null;
  connectingFromBus: number | null;
  onCancelConnecting: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenAddComponent: (cat?: NetworkEquipmentCategory) => void;
  onOpenEditSelected: () => void;
  onToggleSelectedStatus: () => void;
  onOpenDeleteConfirm: () => void;
  onOpenValidationModal: () => void;
  validationReport: NetworkValidationReport | null;
  isStale: boolean;
  onRunPowerFlow: () => void;
  onOpenResetConfirm: () => void;
}

export const OlChangesToolbar: React.FC<OlChangesToolbarProps> = ({
  activeTool,
  onChangeTool,
  selectedElement,
  connectingFromBus,
  onCancelConnecting,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenAddComponent,
  onOpenEditSelected,
  onToggleSelectedStatus,
  onOpenDeleteConfirm,
  onOpenValidationModal,
  validationReport,
  isStale,
  onRunPowerFlow,
  onOpenResetConfirm,
}) => {
  // Global keyboard shortcuts for OL Changes operations
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

      if (e.key === 'Escape') {
        if (activeTool !== 'select' || connectingFromBus !== null) {
          e.preventDefault();
          onCancelConnecting();
          onChangeTool('select');
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          if (canRedo) onRedo();
        } else {
          if (canUndo) onUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        if (canRedo) onRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElement) {
          e.preventDefault();
          onOpenDeleteConfirm();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeTool,
    connectingFromBus,
    canUndo,
    canRedo,
    selectedElement,
    onChangeTool,
    onCancelConnecting,
    onUndo,
    onRedo,
    onOpenDeleteConfirm,
  ]);

  const hasErrors = (validationReport?.errorCount ?? 0) > 0;
  const hasWarnings = (validationReport?.warningCount ?? 0) > 0;

  return (
    <div className="bg-slate-900 border border-cyan-500/30 rounded-xl px-3 py-2 shadow-lg flex flex-wrap items-center justify-between gap-2.5 text-xs select-none">
      {/* Left: Mode Title & Interactive Tool Selector */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-cyan-500 text-slate-950">
          OL Changes
        </span>

        {/* Tool: Select / Inspect */}
        <button
          type="button"
          onClick={() => {
            onCancelConnecting();
            onChangeTool('select');
          }}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeTool === 'select'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="Pointer tool: Select and inspect components (Double-click any asset to edit)"
        >
          <MousePointer size={13} />
          <span>Select</span>
        </button>

        {/* Tool: Connect Line */}
        <button
          type="button"
          onClick={() => onChangeTool('connect-line')}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
            activeTool === 'connect-line'
              ? 'bg-cyan-500 text-slate-950 shadow-sm'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
          }`}
          title="Connect Line: Click source bus, then click destination bus to draw a transmission line"
        >
          <GitPullRequest size={13} />
          <span>Connect Line</span>
        </button>

        {/* Tool: Add Component Dropdown / Modal Trigger */}
        <button
          type="button"
          onClick={() => onOpenAddComponent()}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-sm"
          title="Add a new bus, branch, generator, load, transformer, or shunt"
        >
          <PlusCircle size={13} />
          <span>+ Add Apparatus</span>
        </button>

        <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />

        {/* Selected Component Operations */}
        <button
          type="button"
          disabled={!selectedElement}
          onClick={onOpenEditSelected}
          className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg font-semibold transition-colors ${
            selectedElement
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
              : 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
          }`}
          title={
            selectedElement
              ? `Edit ${selectedElement.id} parameters`
              : 'Select a component to edit'
          }
        >
          <Sliders size={13} />
          <span>Edit</span>
        </button>

        <button
          type="button"
          disabled={!selectedElement}
          onClick={onToggleSelectedStatus}
          className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg font-semibold transition-colors ${
            selectedElement
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
              : 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
          }`}
          title={
            selectedElement
              ? `Toggle in-service status of ${selectedElement.id}`
              : 'Select a component to toggle status'
          }
        >
          <Power size={13} />
          <span>Toggle Status</span>
        </button>

        <button
          type="button"
          disabled={!selectedElement}
          onClick={onOpenDeleteConfirm}
          className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg font-semibold transition-colors ${
            selectedElement
              ? 'bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 cursor-pointer'
              : 'bg-slate-800/40 text-slate-600 cursor-not-allowed border border-transparent'
          }`}
          title={
            selectedElement
              ? `Delete ${selectedElement.id} (Del key)`
              : 'Select a component to delete'
          }
        >
          <Trash2 size={13} />
          <span>Delete</span>
        </button>
      </div>

      {/* Right: History (Undo/Redo), Validation & Power Flow */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* Undo */}
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg font-semibold transition-colors ${
            canUndo
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
              : 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
          }`}
          title="Undo last change (Ctrl+Z)"
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
              ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer'
              : 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
          }`}
          title="Redo next change (Ctrl+Y)"
        >
          <Redo2 size={13} />
          <span>Redo</span>
        </button>

        <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />

        {/* Model Validation */}
        <button
          type="button"
          onClick={onOpenValidationModal}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-bold border transition-colors cursor-pointer ${
            hasErrors
              ? 'bg-red-500/20 text-red-300 border-red-500/40'
              : hasWarnings
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
          }`}
          title="Validate electrical constraints and topological consistency"
        >
          <ShieldCheck size={13} />
          <span>Validate</span>
          {hasErrors && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          )}
        </button>

        {/* Solve Power Flow */}
        <button
          type="button"
          onClick={onRunPowerFlow}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold shadow-sm transition-all cursor-pointer ${
            isStale
              ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
          title="Calculate steady-state AC Power Flow for current working model"
        >
          <Play size={12} className="fill-current" />
          <span>{isStale ? 'Solve (Stale)' : 'Solve AC Flow'}</span>
        </button>

        {/* Reset to Baseline Defaults */}
        <button
          type="button"
          onClick={onOpenResetConfirm}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          title="Restore original IEEE 30-bus benchmark network"
        >
          <RotateCcw size={13} />
          <span className="hidden md:inline">Reset Baseline</span>
        </button>
      </div>

      {/* Interactive Tool Banner if Connecting Line */}
      {activeTool === 'connect-line' && (
        <div className="w-full pt-1.5 flex items-center justify-between border-t border-slate-800 text-[11px] text-cyan-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>
              {connectingFromBus === null
                ? 'Click source busbar on the diagram to begin line connection...'
                : `Source: Bus #${connectingFromBus} selected. Now click destination busbar to complete line connection.`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onCancelConnecting();
              onChangeTool('select');
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            <X size={12} />
            <span>Cancel (Esc)</span>
          </button>
        </div>
      )}
    </div>
  );
};
