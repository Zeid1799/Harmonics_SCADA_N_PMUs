import React, { useState, useMemo, useEffect } from 'react';
import {
  Info,
  Map,
  GitBranch,
  Eye,
  Navigation,
  Search,
  Layers,
  Maximize,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Play,
  CheckCircle2,
  AlertTriangle,
  X,
  Wrench,
  Zap,
  Activity,
} from 'lucide-react';
import {
  PowerNetworkModel,
  PowerFlowSolutionResult,
  SelectedNetworkElement,
  SimulatorMapViewMode,
  SimulatorOverlayConfig,
  AcPowerFlowOptions,
  NetworkEquipmentCategory,
  NetworkValidationReport,
  NetworkBus,
  NetworkGenerator,
  NetworkLoad,
  NetworkTransmissionLine,
  NetworkTransformer,
  NetworkShunt,
} from '../../types/network';
import { AppTheme } from '../../types/settings';
import { NetworkCanvas } from './NetworkCanvas';
import { GeographicMapCanvas } from './GeographicMapCanvas';
import { SimulationControlPanel } from './SimulationControlPanel';
import { EquipmentDetailPanel } from './EquipmentDetailPanel';
import { NetworkInfoModal } from './NetworkInfoModal';
import { validateNetworkModel } from '../../model/networkValidator';
import { EditModeToolbar } from './EditModeToolbar';
import { ComponentEditModal } from './modals/ComponentEditModal';
import { ValidationReportModal } from './modals/ValidationReportModal';
import { ResetConfirmModal } from './modals/ResetConfirmModal';
import {
  ShortCircuitScenario,
  ShortCircuitSolution,
} from '../../types/shortCircuit';
import {
  solveShortCircuit,
  DEFAULT_SC_SCENARIO,
} from '../../model/shortCircuitSolver';
import { ShortCircuitControlPanel } from './shortCircuit/ShortCircuitControlPanel';
import { ShortCircuitResultsPanel } from './shortCircuit/ShortCircuitResultsPanel';
import {
  DynamicFlowConfig,
  DEFAULT_DYNAMIC_FLOW_CONFIG,
} from '../../types/dynamicFlow';
import { DynamicFlowToolbar } from './dynamicFlow/DynamicFlowToolbar';
import { DynamicFlowSummaryPanel } from './dynamicFlow/DynamicFlowSummaryPanel';

interface NetworkViewProps {
  network: PowerNetworkModel;
  solution: PowerFlowSolutionResult | null;
  isStale: boolean;
  autoSolve: boolean;
  solverOptions: AcPowerFlowOptions;
  selectedElement: SelectedNetworkElement | null;
  theme: AppTheme;
  onSelectElement: (element: SelectedNetworkElement) => void;
  onToggleAutoSolve: (enabled: boolean) => void;
  onUpdateSolverOptions: (patch: Partial<AcPowerFlowOptions>) => void;
  onSolvePowerFlow: () => void;
  onUpdateLoadScale: (scaleFactor: number) => void;
  onToggleEquipmentStatus: (element: SelectedNetworkElement) => void;
  onUpdateGenerator: (
    generatorId: string,
    patch: {
      scheduledActivePowerMw?: number;
      voltageSetpointPu?: number;
      reactivePowerMinMvar?: number;
      reactivePowerMaxMvar?: number;
    }
  ) => void;
  onUpdateLoad: (
    loadId: string,
    patch: {
      configuredActivePowerMw?: number;
      configuredReactivePowerMvar?: number;
    }
  ) => void;
  onUpdateTransformer: (
    transformerId: string,
    patch: {
      tapRatioPu?: number;
      phaseShiftDeg?: number;
    }
  ) => void;
  onUpdateShunt: (
    shuntId: string,
    patch: {
      configuredSusceptanceMvarAtUnitV?: number;
    }
  ) => void;
  onResetSingleEquipment: (element: SelectedNetworkElement) => void;
  onReloadOriginalCase: () => void;
  // Phase B: Equipment Inspection & Parameter Editing
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onUpdateBusFull?: (busId: string, updates: Partial<NetworkBus>) => void;
  onUpdateGeneratorFull?: (genId: string, updates: Partial<NetworkGenerator>) => void;
  onUpdateLoadFull?: (loadId: string, updates: Partial<NetworkLoad>) => void;
  onUpdateLineFull?: (lineId: string, updates: Partial<NetworkTransmissionLine>) => void;
  onUpdateTransformerFull?: (txId: string, updates: Partial<NetworkTransformer>) => void;
  onUpdateShuntFull?: (shuntId: string, updates: Partial<NetworkShunt>) => void;
}

export const NetworkView: React.FC<NetworkViewProps> = ({
  network,
  solution,
  isStale,
  autoSolve,
  solverOptions,
  selectedElement,
  theme,
  onSelectElement,
  onToggleAutoSolve,
  onUpdateSolverOptions,
  onSolvePowerFlow,
  onUpdateLoadScale,
  onToggleEquipmentStatus,
  onUpdateGenerator,
  onUpdateLoad,
  onUpdateTransformer,
  onUpdateShunt,
  onResetSingleEquipment,
  onReloadOriginalCase,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onUpdateBusFull,
  onUpdateGeneratorFull,
  onUpdateLoadFull,
  onUpdateLineFull,
  onUpdateTransformerFull,
  onUpdateShuntFull,
}) => {
  const [mapViewMode, setMapViewMode] = useState<SimulatorMapViewMode>('one-line');
  const [isControlPanelCollapsed, setIsControlPanelCollapsed] = useState(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState(false);
  const [isDirectoryCollapsed, setIsDirectoryCollapsed] = useState(false);
  const [showFocusSidebar, setShowFocusSidebar] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // Phase B: Edit Mode state (session-only parameter editing for existing equipment)
  const [isEditMode, setIsEditMode] = useState(false);

  // Analysis Modes (Phase A/B: Power Flow, Phase C: Short-Circuit, Phase D: Dynamic Flow)
  const [analysisMode, setAnalysisMode] =
    useState<'power-flow' | 'dynamic-flow' | 'short-circuit'>('power-flow');

  // Phase D: Dynamic Flow Visualization State
  const [dynamicFlowConfig, setDynamicFlowConfig] =
    useState<DynamicFlowConfig>(DEFAULT_DYNAMIC_FLOW_CONFIG);
  const [dynamicRightTab, setDynamicRightTab] =
    useState<'telemetry' | 'inspector'>('telemetry');

  // Phase C: Short-Circuit Analysis State
  const [scScenario, setScScenario] =
    useState<ShortCircuitScenario>(DEFAULT_SC_SCENARIO);
  const [scSolution, setScSolution] = useState<ShortCircuitSolution | null>(() => {
    try {
      return solveShortCircuit(network, DEFAULT_SC_SCENARIO, solution);
    } catch {
      return null;
    }
  });
  const [isScStale, setIsScStale] = useState<boolean>(false);
  const [showScOverlays, setShowScOverlays] = useState<boolean>(true);
  const [isScControlCollapsed, setIsScControlCollapsed] = useState<boolean>(false);
  const [scRightTab, setScRightTab] = useState<'results' | 'inspector'>('results');

  // Mark short-circuit solution as stale when network model changes
  useEffect(() => {
    setIsScStale(true);
  }, [network, solution]);

  const handleSolveShortCircuit = () => {
    try {
      const sol = solveShortCircuit(network, scScenario, solution);
      setScSolution(sol);
      setIsScStale(false);
    } catch (err: any) {
      console.error('Short-circuit solve error:', err);
    }
  };

  const handleUpdateScScenario = (patch: Partial<ShortCircuitScenario>) => {
    setScScenario((prev) => ({ ...prev, ...patch }));
    setIsScStale(true);
  };

  const handleSelectFaultedBus = (busNumber: number) => {
    setScScenario((prev) => ({ ...prev, faultedBusNumber: busNumber }));
    setIsScStale(true);
  };

  const handleResetScScenario = () => {
    setScScenario(DEFAULT_SC_SCENARIO);
    try {
      const sol = solveShortCircuit(network, DEFAULT_SC_SCENARIO, solution);
      setScSolution(sol);
      setIsScStale(false);
    } catch {
      setIsScStale(true);
    }
  };

  // Modal dialog states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Topological & electrical constraint validation
  const validationReport: NetworkValidationReport = useMemo(
    () => validateNetworkModel(network),
    [network]
  );

  const handleDoubleClickElement = (category: NetworkEquipmentCategory, id: string) => {
    onSelectElement({ category, id });
    setIsEditModalOpen(true);
  };

  const handleConfirmReset = () => {
    onReloadOriginalCase();
    handleResetScScenario();
    setIsResetModalOpen(false);
  };

  const handleToggleSelectedStatus = () => {
    if (selectedElement) {
      onToggleEquipmentStatus(selectedElement);
    }
  };

  const handleSolveWithValidation = () => {
    if (!validationReport.isValid) {
      setIsValidationModalOpen(true);
      return;
    }
    onSolvePowerFlow();
  };
  const [directoryCategory, setDirectoryCategory] =
    useState<NetworkEquipmentCategory>('bus');
  const [searchQuery, setSearchQuery] = useState('');

  const bothPanelsCollapsed = isInspectorCollapsed && isDirectoryCollapsed;

  // Prevent browser window page zoom from scaling surrounding panels on Ctrl+wheel / trackpad pinch
  useEffect(() => {
    const handleCtrlWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', handleCtrlWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleCtrlWheel);
  }, []);

  const [overlayConfig, setOverlayConfig] = useState<SimulatorOverlayConfig>({
    showFlowArrows: true,
    branchLabelMode: 'pq',
    busLabelMode: 'voltage-pu-angle',
    colorBranchesByLoading: true,
    highlightViolations: true,
    loadingThresholds: {
      elevatedPercent: 70,
      highPercent: 90,
      overloadPercent: 100,
    },
    expandSchematic33kVCluster: true,
    useExternalOsmTiles: true,
  });

  const handleUpdateOverlayConfig = (patch: Partial<SimulatorOverlayConfig>) => {
    setOverlayConfig((prev) => ({ ...prev, ...patch }));
  };

  // Filtered directory items for fast lookup
  const filteredDirectoryItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (directoryCategory === 'bus') {
      return network.buses.filter(
        (b) =>
          !q ||
          b.name.toLowerCase().includes(q) ||
          b.id.toLowerCase().includes(q) ||
          String(b.number).includes(q)
      );
    }
    if (directoryCategory === 'generator') {
      return network.generators.filter(
        (g) =>
          !q ||
          g.name.toLowerCase().includes(q) ||
          g.id.toLowerCase().includes(q) ||
          String(g.busNumber).includes(q)
      );
    }
    if (directoryCategory === 'load') {
      return network.loads.filter(
        (l) =>
          !q ||
          l.name.toLowerCase().includes(q) ||
          l.id.toLowerCase().includes(q) ||
          String(l.busNumber).includes(q)
      );
    }
    if (directoryCategory === 'line') {
      return network.lines.filter(
        (ln) =>
          !q ||
          ln.name.toLowerCase().includes(q) ||
          ln.id.toLowerCase().includes(q) ||
          `${ln.fromBusNumber}-${ln.toBusNumber}`.includes(q)
      );
    }
    if (directoryCategory === 'transformer') {
      return network.transformers.filter(
        (tx) =>
          !q ||
          tx.name.toLowerCase().includes(q) ||
          tx.id.toLowerCase().includes(q) ||
          `${tx.fromBusNumber}-${tx.toBusNumber}`.includes(q)
      );
    }
    return network.shunts.filter(
      (sh) =>
        !q ||
        sh.name.toLowerCase().includes(q) ||
        sh.id.toLowerCase().includes(q) ||
        String(sh.busNumber).includes(q)
    );
  }, [network, directoryCategory, searchQuery]);

  const renderDirectoryContent = () => (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
          Network Asset Directory
        </span>
        <div className="relative flex-1 max-w-[180px]">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter ID or bus..."
            className="w-full pl-7 pr-2 py-1 rounded-lg text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1">
        {(
          [
            { id: 'bus', label: `Buses (${network.buses.length})` },
            { id: 'generator', label: `Gens (${network.generators.length})` },
            { id: 'load', label: `Loads (${network.loads.length})` },
            { id: 'line', label: `Lines (${network.lines.length})` },
            { id: 'transformer', label: `TXs (${network.transformers.length})` },
            { id: 'shunt', label: `Shunts (${network.shunts.length})` },
          ] as { id: NetworkEquipmentCategory; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setDirectoryCategory(tab.id)}
            className={`px-2 py-1 rounded text-[10px] font-bold transition-colors cursor-pointer ${
              directoryCategory === tab.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable Asset Table */}
      <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
        {filteredDirectoryItems.map((item: any) => {
          const isSelected =
            selectedElement?.category === directoryCategory &&
            selectedElement?.id === item.id;

          let rightMetric = '';
          let statusOnline = true;

          if (directoryCategory === 'bus') {
            const bSol = solution?.busSolutions[item.number];
            statusOnline = item.status === 'online' && (bSol?.energized ?? true);
            rightMetric = bSol
              ? `${bSol.vmPu.toFixed(3)} p.u. ∠ ${bSol.vaDeg.toFixed(1)}°`
              : `${item.baseKv} kV`;
          } else if (directoryCategory === 'generator') {
            const gSol = solution?.generatorOutputs[item.id];
            statusOnline = item.status === 'online';
            rightMetric = gSol
              ? `${gSol.pMw.toFixed(1)} MW / ${gSol.qMvar.toFixed(1)} MVAr`
              : `${item.scheduledActivePowerMw} MW`;
          } else if (directoryCategory === 'load') {
            statusOnline = item.status === 'connected';
            rightMetric = `${(
              item.configuredActivePowerMw * network.loadScaleFactor
            ).toFixed(1)} MW / ${(
              item.configuredReactivePowerMvar * network.loadScaleFactor
            ).toFixed(1)} MVAr`;
          } else if (directoryCategory === 'line') {
            const lSol = solution?.lineFlows[item.id];
            statusOnline = item.status === 'online';
            rightMetric = lSol
              ? `${lSol.pFromMw.toFixed(1)} MW (${lSol.loadingPercent.toFixed(0)}%)`
              : `${item.ratingMva} MVA`;
          } else if (directoryCategory === 'transformer') {
            const tSol = solution?.transformerFlows[item.id];
            statusOnline = item.status === 'online';
            rightMetric = tSol
              ? `τ=${item.tapRatioPu.toFixed(3)} (${tSol.loadingPercent.toFixed(0)}%)`
              : `τ=${item.tapRatioPu.toFixed(3)}`;
          } else if (directoryCategory === 'shunt') {
            const sSol = solution?.shuntOutputs[item.id];
            statusOnline = item.status === 'online';
            rightMetric = sSol
              ? `+${sSol.qInjectedMvar.toFixed(1)} MVAr`
              : `+${item.configuredSusceptanceMvarAtUnitV.toFixed(1)} MVAr`;
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() =>
                onSelectElement({ category: directoryCategory, id: item.id })
              }
              className={`w-full px-3 py-2 flex items-center justify-between text-left transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    statusOnline ? 'bg-emerald-500' : 'bg-red-500'
                  }`}
                />
                <span className="font-mono text-[11px] font-bold shrink-0">
                  {item.id}
                </span>
                <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {item.name}
                </span>
              </div>
              <span className="font-mono text-[11px] shrink-0 ml-2 text-slate-700 dark:text-slate-300">
                {rightMetric}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Render all Phase B component and diagnostics dialogs
  const renderModals = () => (
    <>
      <ComponentEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        selectedElement={selectedElement}
        network={network}
        solution={solution}
        isEditMode={isEditMode}
        onApplyBus={(busId, updates) => {
          onUpdateBusFull?.(busId, updates);
          setIsEditModalOpen(false);
        }}
        onApplyGenerator={(genId, updates) => {
          onUpdateGeneratorFull?.(genId, updates);
          setIsEditModalOpen(false);
        }}
        onApplyLoad={(loadId, updates) => {
          onUpdateLoadFull?.(loadId, updates);
          setIsEditModalOpen(false);
        }}
        onApplyLine={(lineId, updates) => {
          onUpdateLineFull?.(lineId, updates);
          setIsEditModalOpen(false);
        }}
        onApplyTransformer={(txId, updates) => {
          onUpdateTransformerFull?.(txId, updates);
          setIsEditModalOpen(false);
        }}
        onApplyShunt={(shuntId, updates) => {
          onUpdateShuntFull?.(shuntId, updates);
          setIsEditModalOpen(false);
        }}
      />

      <ValidationReportModal
        isOpen={isValidationModalOpen}
        onClose={() => setIsValidationModalOpen(false)}
        report={validationReport}
        onRunPowerFlow={() => {
          setIsValidationModalOpen(false);
          onSolvePowerFlow();
        }}
      />

      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirmReset={handleConfirmReset}
      />

      <NetworkInfoModal
        isOpen={isInfoModalOpen}
        onClose={() => setIsInfoModalOpen(false)}
        network={network}
        solution={solution}
      />
    </>
  );

  // Focus Mode (Maximize Diagram Viewport)
  if (isFocusMode) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col p-2 sm:p-3 overflow-hidden select-none gap-2">
        {/* Focus Mode Compact Header */}
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 shadow-lg text-xs">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              Focus Mode
            </span>
            <span className="font-bold text-white text-sm">
              {network.metadata.shortName} — One-Line Diagram Workspace
            </span>
            <span className="text-slate-500 hidden sm:inline">|</span>
            <span className="text-slate-300 font-mono hidden sm:inline">
              30 Buses • 41 Branches • Base 100 MVA
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Analysis Mode Switcher */}
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-700">
              <button
                type="button"
                onClick={() => setAnalysisMode('power-flow')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  analysisMode === 'power-flow'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Power Flow
              </button>
              <button
                type="button"
                onClick={() => setAnalysisMode('dynamic-flow')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  analysisMode === 'dynamic-flow'
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Dynamic Flow
              </button>
              <button
                type="button"
                onClick={() => setAnalysisMode('short-circuit')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  analysisMode === 'short-circuit'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Short-Circuit
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsEditMode((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isEditMode
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm'
                  : 'bg-slate-700 hover:bg-slate-600 text-amber-300 border border-slate-600'
              }`}
              title="Toggle Edit Mode for existing equipment parameters"
            >
              <Wrench size={13} />
              <span>{isEditMode ? 'Edit Mode (ACTIVE)' : 'Edit Mode (OFF)'}</span>
            </button>

            {analysisMode === 'short-circuit' ? (
              <>
                <button
                  type="button"
                  onClick={handleSolveShortCircuit}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer ${
                    isScStale || !scSolution?.converged
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-400/50 font-black'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                  title="Calculate Short-Circuit Fault Currents"
                >
                  <Play size={12} className="fill-current" />
                  {isScStale ? 'Calculate (Stale)' : 'Calculate Fault'}
                </button>

                {scSolution?.converged ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <CheckCircle2 size={13} />
                    If: {scSolution.totalFaultCurrentKa.toFixed(2)} kA
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    <AlertTriangle size={13} />
                    Unsolved
                  </span>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSolveWithValidation}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer ${
                    isStale || !solution?.converged
                      ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  title="Re-run AC Power Flow"
                >
                  <Play size={12} className="fill-current" />
                  {isStale ? 'Solve (Stale)' : 'Solve Power Flow'}
                </button>

                {solution?.converged ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    <CheckCircle2 size={13} />
                    {analysisMode === 'dynamic-flow' ? 'Flow Active' : 'Converged'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <AlertTriangle size={13} />
                    Unsolved
                  </span>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => setShowFocusSidebar((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                showFocusSidebar
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                  : 'bg-slate-700 hover:bg-slate-600 text-cyan-300 border border-slate-600'
              }`}
              title="Toggle sidebar in Focus Mode"
            >
              <PanelRightOpen size={14} />
              <span>{showFocusSidebar ? 'Hide Sidebar' : analysisMode === 'short-circuit' ? 'Fault & Assets' : analysisMode === 'dynamic-flow' ? 'Flow Telemetry' : 'Inspect Assets'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFocusMode(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 transition-colors cursor-pointer"
              title="Exit Focus Mode (Restore standard workspace layout)"
            >
              <Minimize2 size={14} />
              <span>Exit Focus Mode</span>
            </button>
          </div>
        </div>

        {/* Dynamic Flow Controls in Focus Mode */}
        {analysisMode === 'dynamic-flow' && (
          <DynamicFlowToolbar
            config={dynamicFlowConfig}
            onUpdateConfig={(patch) =>
              setDynamicFlowConfig((prev) => ({ ...prev, ...patch }))
            }
            solution={solution}
            isStale={isStale}
            onRunPowerFlow={handleSolveWithValidation}
          />
        )}

        {/* Edit Mode Toolbar in Focus Mode */}
        <EditModeToolbar
          isEditMode={isEditMode}
          onToggleEditMode={() => setIsEditMode((prev) => !prev)}
          selectedElement={selectedElement}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo ?? (() => {})}
          onRedo={onRedo ?? (() => {})}
          onOpenSelectedModal={() => setIsEditModalOpen(true)}
          onToggleSelectedStatus={handleToggleSelectedStatus}
          onOpenValidationModal={() => setIsValidationModalOpen(true)}
          validationReport={validationReport}
          isStale={isStale}
          onRunPowerFlow={handleSolveWithValidation}
          onOpenResetConfirm={() => setIsResetModalOpen(true)}
        />

        {/* Maximize Diagram Canvas & Optional Focus Drawer */}
        <div className="flex-1 w-full h-full min-h-0 rounded-xl overflow-hidden border border-slate-800 shadow-2xl relative flex">
          <div className="flex-1 h-full min-w-0 relative">
            <NetworkCanvas
              network={network}
              solution={solution}
              isStale={isStale}
              selectedElement={selectedElement}
              overlayConfig={overlayConfig}
              theme={theme}
              onSelectElement={onSelectElement}
              isFocusMode={true}
              onToggleFocusMode={() => setIsFocusMode(false)}
              isEditMode={isEditMode}
              onDoubleClickElement={handleDoubleClickElement}
              isShortCircuitMode={analysisMode === 'short-circuit'}
              shortCircuitSolution={scSolution}
              faultedBusNumber={scScenario.faultedBusNumber}
              showFaultOverlays={showScOverlays}
              onSelectFaultedBus={handleSelectFaultedBus}
              isDynamicFlowMode={analysisMode === 'dynamic-flow'}
              dynamicFlowConfig={dynamicFlowConfig}
            />

            {!showFocusSidebar && (
              <button
                type="button"
                onClick={() => setShowFocusSidebar(true)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1.5 px-2 py-3 rounded-l-xl bg-slate-800/90 hover:bg-slate-800 text-white border-y border-l border-slate-700 shadow-xl backdrop-blur-md transition-all group cursor-pointer"
                title="Open sidebar in Focus Mode"
              >
                <PanelRightOpen size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold [writing-mode:vertical-rl] rotate-180 tracking-wider text-slate-300 group-hover:text-white">
                  {analysisMode === 'short-circuit' ? 'Fault Controls' : analysisMode === 'dynamic-flow' ? 'Flow Telemetry' : 'Inspect Assets'}
                </span>
              </button>
            )}
          </div>

          {/* Focus Mode Slide-out Drawer */}
          {showFocusSidebar && (
            <div className="w-full sm:w-[460px] max-w-full h-full bg-slate-900 border-l border-slate-800 flex flex-col z-30 shadow-2xl">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800 bg-slate-800/60">
                <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                  {analysisMode === 'short-circuit'
                    ? 'Short-Circuit Controls & Results'
                    : analysisMode === 'dynamic-flow'
                    ? 'Dynamic Flow Telemetry & Ranking'
                    : 'Asset Inspector & Directory'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowFocusSidebar(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                  title="Close sidebar"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {analysisMode === 'short-circuit' ? (
                  <>
                    <ShortCircuitControlPanel
                      network={network}
                      scenario={scScenario}
                      solution={scSolution}
                      isStale={isScStale}
                      onUpdateScenario={handleUpdateScScenario}
                      onSolveShortCircuit={handleSolveShortCircuit}
                      onResetScenario={handleResetScScenario}
                    />
                    <ShortCircuitResultsPanel
                      solution={scSolution}
                      isStale={isScStale}
                      network={network}
                      onSelectBus={handleSelectFaultedBus}
                      onRerunCalculation={handleSolveShortCircuit}
                    />
                  </>
                ) : analysisMode === 'dynamic-flow' ? (
                  <>
                    <DynamicFlowSummaryPanel
                      network={network}
                      solution={solution}
                      config={dynamicFlowConfig}
                      selectedElement={selectedElement}
                      onSelectElement={onSelectElement}
                      onRunPowerFlow={handleSolveWithValidation}
                    />
                    {renderDirectoryContent()}
                  </>
                ) : (
                  <>
                    <EquipmentDetailPanel
                      network={network}
                      solution={solution}
                      isStale={isStale}
                      selectedElement={selectedElement}
                      onSelectElement={onSelectElement}
                      onToggleEquipmentStatus={onToggleEquipmentStatus}
                      onUpdateGenerator={onUpdateGenerator}
                      onUpdateLoad={onUpdateLoad}
                      onUpdateTransformer={onUpdateTransformer}
                      onUpdateShunt={onUpdateShunt}
                      onResetSingleEquipment={onResetSingleEquipment}
                      onSolvePowerFlow={onSolvePowerFlow}
                    />
                    {renderDirectoryContent()}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {renderModals()}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Simulator Toolbar: Title, View Mode Switcher, Overlay Controls & Documentation Button */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Left: Network Identity & View Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                AC Power-System Simulator
              </span>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                30 Buses • 41 Branches • 100 MVA Base
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {network.metadata.shortName} — 1961 AEP Appalachian Transmission Equivalence
            </h2>
          </div>

          {/* Primary Map View Mode Switcher: One-Line View vs Geographic View (Disabled with Coming Soon) */}
          <div
            className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            role="group"
            aria-label="Simulator Map View Mode"
          >
            <button
              type="button"
              onClick={() => setMapViewMode('one-line')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                mapViewMode === 'one-line'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <GitBranch size={14} />
              One-Line View (Schematic)
            </button>
            <button
              type="button"
              disabled
              title="Geographical View is coming soon in a future phase"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed select-none"
            >
              <Map size={14} />
              <span>Geographic View</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">
                Coming Soon
              </span>
            </button>
          </div>

          {/* Primary Analysis Mode Switcher: AC Power Flow vs Dynamic Flow vs Short-Circuit (SC) */}
          <div
            className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            role="group"
            aria-label="Simulator Analysis Mode"
          >
            <button
              type="button"
              onClick={() => setAnalysisMode('power-flow')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                analysisMode === 'power-flow'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity size={13} />
              Power Flow
            </button>
            <button
              type="button"
              onClick={() => {
                setAnalysisMode('dynamic-flow');
                setMapViewMode('one-line');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                analysisMode === 'dynamic-flow'
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Activity size={13} className={analysisMode === 'dynamic-flow' ? 'animate-pulse' : ''} />
              Dynamic Flow
            </button>
            <button
              type="button"
              onClick={() => {
                setAnalysisMode('short-circuit');
                setMapViewMode('one-line');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                analysisMode === 'short-circuit'
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-sm ring-2 ring-amber-400/50'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Zap size={13} className={analysisMode === 'short-circuit' ? 'fill-current' : ''} />
              <span>Short-Circuit (SC)</span>
            </button>
          </div>

          {/* Edit Mode Switcher */}
          <button
            type="button"
            onClick={() => {
              setIsEditMode((prev) => !prev);
              if (!isEditMode) {
                setMapViewMode('one-line');
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isEditMode
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md ring-2 ring-amber-400/50'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
            }`}
            title="Toggle Edit Mode to inspect vs edit existing equipment parameters"
          >
            <Wrench size={14} className={isEditMode ? 'rotate-12' : ''} />
            <span>{isEditMode ? 'Edit Mode (ACTIVE)' : 'Edit Mode (OFF)'}</span>
            {isEditMode && (
              <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
            )}
          </button>
        </div>

        {/* Right: Visual Overlay Controls & Network/Solver Info Button */}
        <div className="flex flex-wrap items-center gap-2">
          {analysisMode === 'short-circuit' ? (
            <>
              {/* Fault Overlays Toggle */}
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showScOverlays}
                  onChange={(e) => setShowScOverlays(e.target.checked)}
                  className="rounded border-slate-300 text-amber-500 cursor-pointer"
                />
                <Zap size={12} className="text-amber-500" />
                <span>Fault Overlays</span>
              </label>

              {/* Solve Button */}
              <button
                type="button"
                onClick={handleSolveShortCircuit}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer ${
                  isScStale || !scSolution?.converged
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-2 ring-amber-400/50 font-black'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
                title="Calculate Symmetrical Sequence Fault Currents"
              >
                <Play size={12} className="fill-current" />
                {isScStale ? 'Calculate (Stale)' : 'Calculate Fault'}
              </button>

              {/* Solved Status Badge */}
              {scSolution?.converged ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                  <CheckCircle2 size={13} />
                  If: {scSolution.totalFaultCurrentKa.toFixed(2)} kA ({scSolution.shortCircuitMva.toFixed(0)} MVA)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  <AlertTriangle size={13} />
                  Fault Error
                </span>
              )}
            </>
          ) : (
            <>
              {/* Flow Arrows Toggle */}
              <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={overlayConfig.showFlowArrows}
                  onChange={(e) =>
                    handleUpdateOverlayConfig({ showFlowArrows: e.target.checked })
                  }
                  className="rounded border-slate-300 text-blue-600 cursor-pointer"
                />
                <Navigation size={12} className="text-blue-500" />
                <span>Flow Arrows</span>
              </label>

              {/* Branch Label Mode Selector */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                <Eye size={12} className="text-slate-500" />
                <span className="text-slate-500 dark:text-slate-400 font-medium">Branches:</span>
                <select
                  value={overlayConfig.branchLabelMode}
                  onChange={(e) =>
                    handleUpdateOverlayConfig({
                      branchLabelMode: e.target.value as SimulatorOverlayConfig['branchLabelMode'],
                    })
                  }
                  aria-label="Branch Telemetry Overlay Mode"
                  className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="pq" className="bg-white dark:bg-slate-900">
                    P &amp; Q (MW / MVAr)
                  </option>
                  <option value="mw" className="bg-white dark:bg-slate-900">
                    Active Power (MW)
                  </option>
                  <option value="loading" className="bg-white dark:bg-slate-900">
                    Thermal Loading (%)
                  </option>
                  <option value="none" className="bg-white dark:bg-slate-900">
                    Hide Branch Labels
                  </option>
                </select>
              </div>

              {/* Bus Label Mode Selector */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                <Layers size={12} className="text-slate-500" />
                <span className="text-slate-500 dark:text-slate-400 font-medium">Buses:</span>
                <select
                  value={overlayConfig.busLabelMode}
                  onChange={(e) =>
                    handleUpdateOverlayConfig({
                      busLabelMode: e.target.value as SimulatorOverlayConfig['busLabelMode'],
                    })
                  }
                  aria-label="Bus Telemetry Overlay Mode"
                  className="bg-transparent font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="voltage-pu-angle" className="bg-white dark:bg-slate-900">
                    |V| (p.u.) &amp; Angle δ
                  </option>
                  <option value="voltage-kv" className="bg-white dark:bg-slate-900">
                    |V| (kV) &amp; Angle δ
                  </option>
                  <option value="name-only" className="bg-white dark:bg-slate-900">
                    Substation Name Only
                  </option>
                </select>
              </div>
            </>
          )}

          {/* Focus Mode button */}
          <button
            type="button"
            onClick={() => setIsFocusMode(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 transition-colors cursor-pointer"
            title="Maximize One-Line View Diagram"
          >
            <Maximize size={14} />
            Focus Mode
          </button>

          {/* Persistent Toolbar Reopen Controls when either or both panels are collapsed */}
          {bothPanelsCollapsed ? (
            <button
              type="button"
              onClick={() => {
                setIsInspectorCollapsed(false);
                setIsDirectoryCollapsed(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 transition-colors cursor-pointer"
              title="Expand Inspector & Directory panels"
            >
              <PanelRightOpen size={14} />
              Restore Panels
            </button>
          ) : (
            <>
              {isInspectorCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsInspectorCollapsed(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 transition-colors cursor-pointer"
                  title="Expand Asset Inspector panel"
                >
                  <PanelRightOpen size={14} />
                  Asset Inspector
                </button>
              )}
              {isDirectoryCollapsed && (
                <button
                  type="button"
                  onClick={() => setIsDirectoryCollapsed(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 transition-colors cursor-pointer"
                  title="Expand Network Directory panel"
                >
                  <PanelRightOpen size={14} />
                  Asset Directory
                </button>
              )}
            </>
          )}

          {/* Network & Solver Documentation Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsInfoModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 transition-colors cursor-pointer"
          >
            <Info size={14} />
            Network &amp; Solver Info
          </button>
        </div>
      </div>

      {/* Control Panels: Power Flow Simulation Control vs Dynamic Flow Toolbar vs Short-Circuit Control Panel */}
      {analysisMode === 'power-flow' ? (
        <SimulationControlPanel
          network={network}
          solution={solution}
          isStale={isStale}
          autoSolve={autoSolve}
          solverOptions={solverOptions}
          onToggleAutoSolve={onToggleAutoSolve}
          onUpdateSolverOptions={onUpdateSolverOptions}
          onSolvePowerFlow={onSolvePowerFlow}
          onUpdateLoadScale={onUpdateLoadScale}
          onReloadOriginalCase={onReloadOriginalCase}
          onSelectElementById={(cat, id) => onSelectElement({ category: cat, id })}
          isCollapsed={isControlPanelCollapsed}
          onToggleCollapse={() => setIsControlPanelCollapsed((prev) => !prev)}
        />
      ) : analysisMode === 'dynamic-flow' ? (
        <DynamicFlowToolbar
          config={dynamicFlowConfig}
          onUpdateConfig={(patch) =>
            setDynamicFlowConfig((prev) => ({ ...prev, ...patch }))
          }
          solution={solution}
          isStale={isStale}
          onRunPowerFlow={handleSolveWithValidation}
        />
      ) : (
        <ShortCircuitControlPanel
          network={network}
          scenario={scScenario}
          solution={scSolution}
          isStale={isScStale}
          onUpdateScenario={handleUpdateScScenario}
          onSolveShortCircuit={handleSolveShortCircuit}
          onResetScenario={handleResetScScenario}
          isCollapsed={isScControlCollapsed}
          onToggleCollapse={() => setIsScControlCollapsed((prev) => !prev)}
        />
      )}

      {/* Edit Mode Engineering Toolbar */}
      {mapViewMode === 'one-line' && (
        <EditModeToolbar
          isEditMode={isEditMode}
          onToggleEditMode={() => setIsEditMode((prev) => !prev)}
          selectedElement={selectedElement}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={onUndo ?? (() => {})}
          onRedo={onRedo ?? (() => {})}
          onOpenSelectedModal={() => setIsEditModalOpen(true)}
          onToggleSelectedStatus={handleToggleSelectedStatus}
          onOpenValidationModal={() => setIsValidationModalOpen(true)}
          validationReport={validationReport}
          isStale={isStale}
          onRunPowerFlow={handleSolveWithValidation}
          onOpenResetConfirm={() => setIsResetModalOpen(true)}
        />
      )}

      {/* Main Workspace: Interactive Multiscale Canvas (Left) + Asset Inspector & Directory (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* Left/Center: Active Multiscale Map or One-Line Schematic */}
        <div
          className={`${
            bothPanelsCollapsed ? 'xl:col-span-12' : 'xl:col-span-8'
          } h-[720px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-200 relative`}
        >
          {mapViewMode === 'one-line' ? (
            <NetworkCanvas
              network={network}
              solution={solution}
              isStale={isStale}
              selectedElement={selectedElement}
              overlayConfig={overlayConfig}
              theme={theme}
              onSelectElement={onSelectElement}
              isFocusMode={isFocusMode}
              onToggleFocusMode={() => setIsFocusMode(true)}
              isEditMode={isEditMode}
              onDoubleClickElement={handleDoubleClickElement}
              isShortCircuitMode={analysisMode === 'short-circuit'}
              shortCircuitSolution={scSolution}
              faultedBusNumber={scScenario.faultedBusNumber}
              showFaultOverlays={showScOverlays}
              onSelectFaultedBus={handleSelectFaultedBus}
              isDynamicFlowMode={analysisMode === 'dynamic-flow'}
              dynamicFlowConfig={dynamicFlowConfig}
            />
          ) : (
            <GeographicMapCanvas
              network={network}
              solution={solution}
              isStale={isStale}
              selectedElement={selectedElement}
              overlayConfig={overlayConfig}
              theme={theme}
              onSelectElement={onSelectElement}
              onUpdateOverlayConfig={handleUpdateOverlayConfig}
            />
          )}

          {/* Persistent docked tab button on the right edge when both panels are collapsed */}
          {bothPanelsCollapsed && (
            <button
              type="button"
              onClick={() => {
                setIsInspectorCollapsed(false);
                setIsDirectoryCollapsed(false);
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1.5 px-2.5 py-3 rounded-l-xl bg-slate-900/90 hover:bg-slate-900 text-white border-y border-l border-slate-700 shadow-xl backdrop-blur-md transition-all group cursor-pointer"
              title="Expand side panels"
            >
              <PanelRightOpen size={16} className="text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold [writing-mode:vertical-rl] rotate-180 tracking-wider text-slate-200 group-hover:text-white">
                {analysisMode === 'short-circuit' ? 'Fault Results' : analysisMode === 'dynamic-flow' ? 'Flow Telemetry' : 'Inspector & Directory'}
              </span>
            </button>
          )}
        </div>

        {/* Right Column: Asset Inspection & Control Panel + Searchable Equipment Directory OR Short-Circuit Results OR Dynamic Flow Telemetry */}
        {!bothPanelsCollapsed && (
          <div className="xl:col-span-4 space-y-4">
            {analysisMode === 'short-circuit' ? (
              <div className="space-y-3">
                {/* Short-Circuit Right Column Header with Tabs */}
                <div className="flex items-center justify-between px-1">
                  <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setScRightTab('results')}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                        scRightTab === 'results'
                          ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Fault Results
                    </button>
                    <button
                      type="button"
                      onClick={() => setScRightTab('inspector')}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                        scRightTab === 'inspector'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Asset Details &amp; Directory
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsInspectorCollapsed(true);
                      setIsDirectoryCollapsed(true);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Collapse side panel"
                  >
                    <span>Collapse</span>
                    <PanelRightClose size={13} />
                  </button>
                </div>

                {scRightTab === 'results' ? (
                  <ShortCircuitResultsPanel
                    solution={scSolution}
                    isStale={isScStale}
                    network={network}
                    onSelectBus={handleSelectFaultedBus}
                    onRerunCalculation={handleSolveShortCircuit}
                  />
                ) : (
                  <div className="space-y-4">
                    <EquipmentDetailPanel
                      network={network}
                      solution={solution}
                      isStale={isStale}
                      selectedElement={selectedElement}
                      onSelectElement={onSelectElement}
                      onToggleEquipmentStatus={onToggleEquipmentStatus}
                      onUpdateGenerator={onUpdateGenerator}
                      onUpdateLoad={onUpdateLoad}
                      onUpdateTransformer={onUpdateTransformer}
                      onUpdateShunt={onUpdateShunt}
                      onResetSingleEquipment={onResetSingleEquipment}
                      onSolvePowerFlow={onSolvePowerFlow}
                    />
                    {renderDirectoryContent()}
                  </div>
                )}
              </div>
            ) : analysisMode === 'dynamic-flow' ? (
              <div className="space-y-3">
                {/* Dynamic Flow Right Column Header with Tabs */}
                <div className="flex items-center justify-between px-1">
                  <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setDynamicRightTab('telemetry')}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                        dynamicRightTab === 'telemetry'
                          ? 'bg-emerald-600 text-white shadow-sm font-black'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Flow Telemetry
                    </button>
                    <button
                      type="button"
                      onClick={() => setDynamicRightTab('inspector')}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                        dynamicRightTab === 'inspector'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Asset Details &amp; Directory
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsInspectorCollapsed(true);
                      setIsDirectoryCollapsed(true);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Collapse side panel"
                  >
                    <span>Collapse</span>
                    <PanelRightClose size={13} />
                  </button>
                </div>

                {dynamicRightTab === 'telemetry' ? (
                  <DynamicFlowSummaryPanel
                    network={network}
                    solution={solution}
                    config={dynamicFlowConfig}
                    selectedElement={selectedElement}
                    onSelectElement={onSelectElement}
                    onRunPowerFlow={handleSolveWithValidation}
                  />
                ) : (
                  <div className="space-y-4">
                    <EquipmentDetailPanel
                      network={network}
                      solution={solution}
                      isStale={isStale}
                      selectedElement={selectedElement}
                      onSelectElement={onSelectElement}
                      onToggleEquipmentStatus={onToggleEquipmentStatus}
                      onUpdateGenerator={onUpdateGenerator}
                      onUpdateLoad={onUpdateLoad}
                      onUpdateTransformer={onUpdateTransformer}
                      onUpdateShunt={onUpdateShunt}
                      onResetSingleEquipment={onResetSingleEquipment}
                      onSolvePowerFlow={onSolvePowerFlow}
                    />
                    {renderDirectoryContent()}
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Master Header */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Asset Inspector &amp; Directory
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsInspectorCollapsed(true);
                      setIsDirectoryCollapsed(true);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Collapse both Inspector and Directory panels"
                  >
                    <span>Collapse All</span>
                    <PanelRightClose size={13} />
                  </button>
                </div>

                {/* Asset Inspector Section */}
                {!isInspectorCollapsed ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Selected Asset Details
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsInspectorCollapsed(true)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title="Collapse Asset Inspector"
                      >
                        <span>Collapse</span>
                        <PanelRightClose size={12} />
                      </button>
                    </div>
                    <EquipmentDetailPanel
                      network={network}
                      solution={solution}
                      isStale={isStale}
                      selectedElement={selectedElement}
                      onSelectElement={onSelectElement}
                      onToggleEquipmentStatus={onToggleEquipmentStatus}
                      onUpdateGenerator={onUpdateGenerator}
                      onUpdateLoad={onUpdateLoad}
                      onUpdateTransformer={onUpdateTransformer}
                      onUpdateShunt={onUpdateShunt}
                      onResetSingleEquipment={onResetSingleEquipment}
                      onSolvePowerFlow={onSolvePowerFlow}
                    />
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 flex items-center justify-between shadow-sm">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Asset Inspector (Collapsed)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsInspectorCollapsed(false)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                    >
                      <PanelRightOpen size={13} />
                      <span>Expand Inspector</span>
                    </button>
                  </div>
                )}

                {/* Asset Directory Section */}
                {!isDirectoryCollapsed ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Directory Search
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsDirectoryCollapsed(true)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title="Collapse Directory"
                      >
                        <span>Collapse</span>
                        <PanelRightClose size={12} />
                      </button>
                    </div>
                    {renderDirectoryContent()}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 flex items-center justify-between shadow-sm">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Network Directory (Collapsed)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDirectoryCollapsed(false)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-pointer"
                    >
                      <PanelRightOpen size={13} />
                      <span>Expand Directory</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Network Modals & Diagnostics Dialogs */}
      {renderModals()}
    </div>
  );
};
