import React, { useState, useEffect, useCallback } from 'react';
import { WaveGenerator } from './components/WaveGenerator';
import { ScadaView } from './components/scada/ScadaView';
import { PmuView } from './components/pmu/PmuView';
import { NetworkView } from './components/network/NetworkView';
import { SettingsDropdown } from './components/SettingsDropdown';
import { LayoutSelector } from './components/LayoutSelector';
import { AppSettings, AppViewMode, DEFAULT_SETTINGS, WorkspaceLayout } from './types/settings';
import { WaveformState } from './types/waveform';
import {
  PmuSettings,
  InjectedDisturbance,
  DEFAULT_PMU_SETTINGS,
  DEFAULT_DISTURBANCES,
} from './types/pmu';
import {
  PowerNetworkModel,
  SelectedNetworkElement,
  AcPowerFlowOptions,
  PowerFlowSolutionResult,
  NetworkBus,
  NetworkGenerator,
  NetworkLoad,
  NetworkTransmissionLine,
  NetworkTransformer,
  NetworkShunt,
} from './types/network';
import { DEFAULT_WAVEFORM_STATE } from './model/waveformModel';
import {
  DEFAULT_NETWORK_MODEL,
  createFreshDefaultNetworkModel,
  toggleNetworkEquipmentStatus,
  updateGeneratorParameters,
  updateLoadParameters,
  updateTransformerParameters,
  updateShuntParameters,
  resetSingleEquipmentToDefault,
} from './model/networkModel';
import {
  updateBusFull,
  updateGeneratorFull,
  updateLoadFull,
  updateLineFull,
  updateTransformerFull,
  updateShuntFull,
} from './model/networkEditor';
import { useNetworkHistory } from './hooks/useNetworkHistory';
import { solveAcPowerFlow, DEFAULT_SOLVER_OPTIONS } from './model/acPowerFlowSolver';
import { useWaveformPlayback } from './hooks/useWaveformPlayback';
import { useScadaSimulation } from './hooks/useScadaSimulation';
import { Activity, Radio, Zap, Network } from 'lucide-react';

type AppTab = 'generator' | 'scada' | 'pmu';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('generator');

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('wave_app_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const layoutValid = ['both', 'time', 'frequency'].includes(parsed.layout);
          const themeValid = ['light', 'dark'].includes(parsed.theme);
          return {
            ...DEFAULT_SETTINGS,
            ...parsed,
            layout: layoutValid ? parsed.layout : DEFAULT_SETTINGS.layout,
            theme: themeValid ? parsed.theme : DEFAULT_SETTINGS.theme,
            playbackSpeed:
              typeof parsed.playbackSpeed === 'number'
                ? parsed.playbackSpeed
                : DEFAULT_SETTINGS.playbackSpeed,
            // Waveform View remains the default view mode on startup
            viewMode: DEFAULT_SETTINGS.viewMode,
          };
        }
      }
    } catch {
      // ignore JSON parse errors
    }
    return DEFAULT_SETTINGS;
  });

  // 1. Shared Canonical Waveform State across all tabs and view modes
  const [waveformState, setWaveformState] = useState<WaveformState>(DEFAULT_WAVEFORM_STATE);
  const [showHarmonicsBreakdown, setShowHarmonicsBreakdown] = useState<boolean>(false);

  // 2. Shared Continuous Playback Clock
  const {
    playback,
    setPlaybackSpeed,
    togglePlay,
    resetTime,
  } = useWaveformPlayback({
    fundamentalFrequency: waveformState.fundamentalFrequency,
  });

  // 3. Shared SCADA State (preserved across tab and view mode switches)
  const scadaSimulation = useScadaSimulation({
    waveformState: { ...waveformState, playback },
    playback,
  });

  // 4. Shared PMU Configuration & Injected Disturbances (preserved across tab and view mode switches)
  const [pmuSettings, setPmuSettings] = useState<PmuSettings>(DEFAULT_PMU_SETTINGS);
  const [pmuDisturbances, setPmuDisturbances] = useState<InjectedDisturbance[]>(DEFAULT_DISTURBANCES);
  const [pmuSampleNonce, setPmuSampleNonce] = useState<number>(1);
  const handleTakeNewPmuMeasurement = useCallback(() => {
    setPmuSampleNonce((prev) => prev + 1);
  }, []);

  // 5. Shared Power-System Simulator State (IEEE 30-Bus Network + Polar Newton-Raphson AC Power Flow)
  const history = useNetworkHistory(DEFAULT_NETWORK_MODEL);
  const network = history.currentModel;
  const [solverOptions, setSolverOptions] = useState<AcPowerFlowOptions>(DEFAULT_SOLVER_OPTIONS);
  const [autoSolve, setAutoSolve] = useState<boolean>(true);
  const [powerFlowSolution, setPowerFlowSolution] = useState<PowerFlowSolutionResult | null>(() =>
    solveAcPowerFlow(DEFAULT_NETWORK_MODEL, DEFAULT_SOLVER_OPTIONS)
  );
  const [isSolutionStale, setIsSolutionStale] = useState<boolean>(false);
  const [selectedNetworkElement, setSelectedNetworkElement] =
    useState<SelectedNetworkElement | null>({
      id: 'BUS-1',
      category: 'bus',
    });

  // Helper to apply a network mutation and either auto-solve or mark solution stale
  const applyNetworkMutation = useCallback(
    (mutator: (prev: PowerNetworkModel) => PowerNetworkModel) => {
      const next = mutator(history.currentModel);
      history.pushModelChange(next);
      if (autoSolve) {
        setPowerFlowSolution(solveAcPowerFlow(next, solverOptions));
        setIsSolutionStale(false);
      } else {
        setIsSolutionStale(true);
      }
    },
    [autoSolve, history, solverOptions]
  );

  const handleSolvePowerFlow = useCallback(() => {
    setPowerFlowSolution(solveAcPowerFlow(network, solverOptions));
    setIsSolutionStale(false);
  }, [network, solverOptions]);

  const handleToggleAutoSolve = useCallback(
    (enabled: boolean) => {
      setAutoSolve(enabled);
      if (enabled && isSolutionStale) {
        setPowerFlowSolution(solveAcPowerFlow(network, solverOptions));
        setIsSolutionStale(false);
      }
    },
    [isSolutionStale, network, solverOptions]
  );

  const handleUpdateSolverOptions = useCallback(
    (patch: Partial<AcPowerFlowOptions>) => {
      setSolverOptions((prev) => {
        const next = { ...prev, ...patch };
        if (autoSolve) {
          setPowerFlowSolution(solveAcPowerFlow(network, next));
          setIsSolutionStale(false);
        } else {
          setIsSolutionStale(true);
        }
        return next;
      });
    },
    [autoSolve, network]
  );

  const handleToggleNetworkEquipmentStatus = useCallback(
    (element: SelectedNetworkElement) => {
      applyNetworkMutation((prev) => toggleNetworkEquipmentStatus(prev, element));
    },
    [applyNetworkMutation]
  );

  const handleUpdateGenerator = useCallback(
    (
      generatorId: string,
      patch: {
        scheduledActivePowerMw?: number;
        voltageSetpointPu?: number;
        reactivePowerMinMvar?: number;
        reactivePowerMaxMvar?: number;
      }
    ) => {
      applyNetworkMutation((prev) => updateGeneratorParameters(prev, generatorId, patch));
    },
    [applyNetworkMutation]
  );

  const handleUpdateLoad = useCallback(
    (
      loadId: string,
      patch: {
        configuredActivePowerMw?: number;
        configuredReactivePowerMvar?: number;
      }
    ) => {
      applyNetworkMutation((prev) => updateLoadParameters(prev, loadId, patch));
    },
    [applyNetworkMutation]
  );

  const handleUpdateTransformer = useCallback(
    (
      transformerId: string,
      patch: {
        tapRatioPu?: number;
        phaseShiftDeg?: number;
      }
    ) => {
      applyNetworkMutation((prev) =>
        updateTransformerParameters(prev, transformerId, patch)
      );
    },
    [applyNetworkMutation]
  );

  const handleUpdateShunt = useCallback(
    (
      shuntId: string,
      patch: {
        configuredSusceptanceMvarAtUnitV?: number;
      }
    ) => {
      applyNetworkMutation((prev) => updateShuntParameters(prev, shuntId, patch));
    },
    [applyNetworkMutation]
  );

  const handleUpdateLoadScale = useCallback(
    (scaleFactor: number) => {
      const clamped = Math.max(0.1, Math.min(2.5, scaleFactor));
      applyNetworkMutation((prev) => ({
        ...prev,
        loadScaleFactor: clamped,
      }));
    },
    [applyNetworkMutation]
  );

  const handleResetSingleEquipment = useCallback(
    (element: SelectedNetworkElement) => {
      applyNetworkMutation((prev) => resetSingleEquipmentToDefault(prev, element));
    },
    [applyNetworkMutation]
  );

  const handleReloadOriginalCase = useCallback(() => {
    const fresh = createFreshDefaultNetworkModel();
    history.resetHistory(fresh);
    setPowerFlowSolution(solveAcPowerFlow(fresh, solverOptions));
    setIsSolutionStale(false);
  }, [history, solverOptions]);

  // OL Changes History & Full CRUD Operations
  const handleUndo = useCallback(() => {
    const prev = history.undo();
    if (prev) {
      if (autoSolve) {
        setPowerFlowSolution(solveAcPowerFlow(prev, solverOptions));
        setIsSolutionStale(false);
      } else {
        setIsSolutionStale(true);
      }
    }
  }, [autoSolve, history, solverOptions]);

  const handleRedo = useCallback(() => {
    const next = history.redo();
    if (next) {
      if (autoSolve) {
        setPowerFlowSolution(solveAcPowerFlow(next, solverOptions));
        setIsSolutionStale(false);
      } else {
        setIsSolutionStale(true);
      }
    }
  }, [autoSolve, history, solverOptions]);



  const handleUpdateBusFull = useCallback(
    (busId: string, updates: Partial<NetworkBus>) => {
      applyNetworkMutation((prev) => updateBusFull(prev, busId, updates));
    },
    [applyNetworkMutation]
  );

  const handleUpdateGeneratorFull = useCallback(
    (genId: string, updates: Partial<NetworkGenerator>) => {
      applyNetworkMutation((prev) => updateGeneratorFull(prev, genId, updates));
    },
    [applyNetworkMutation]
  );

  const handleUpdateLoadFull = useCallback(
    (loadId: string, updates: Partial<NetworkLoad>) => {
      applyNetworkMutation((prev) => updateLoadFull(prev, loadId, updates));
    },
    [applyNetworkMutation]
  );

  const handleUpdateLineFull = useCallback(
    (lineId: string, updates: Partial<NetworkTransmissionLine>) => {
      applyNetworkMutation((prev) => updateLineFull(prev, lineId, updates));
    },
    [applyNetworkMutation]
  );

  const handleUpdateTransformerFull = useCallback(
    (txId: string, updates: Partial<NetworkTransformer>) => {
      applyNetworkMutation((prev) => updateTransformerFull(prev, txId, updates));
    },
    [applyNetworkMutation]
  );

  const handleUpdateShuntFull = useCallback(
    (shuntId: string, updates: Partial<NetworkShunt>) => {
      applyNetworkMutation((prev) => updateShuntFull(prev, shuntId, updates));
    },
    [applyNetworkMutation]
  );

  // Keep hook speed in sync with Settings prop
  useEffect(() => {
    setPlaybackSpeed(settings.playbackSpeed);
  }, [settings.playbackSpeed, setPlaybackSpeed]);

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('wave_app_settings', JSON.stringify(settings));
  }, [settings]);

  // Sync theme class on document element
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [settings.theme]);

  const updateSettings = (newPartial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newPartial }));
  };

  const handleLayoutChange = (newLayout: WorkspaceLayout) => {
    updateSettings({ layout: newLayout });
  };

  const handleViewModeChange = (mode: AppViewMode) => {
    updateSettings({ viewMode: mode });
  };

  const handleSelectWaveformTab = (tab: AppTab) => {
    setActiveTab(tab);
    if (settings.viewMode !== 'waveform') {
      updateSettings({ viewMode: 'waveform' });
    }
  };

  return (
    <div
      className={`h-screen w-screen flex flex-col overflow-hidden transition-colors duration-150 ${
        settings.theme === 'dark' ? 'bg-[#080b11] text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Top Engineering App Bar */}
      <header className="h-12 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0a0e18] shrink-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-2">
          {/* Left: Logo / App Title & Waveform Sub-Mode Tabs */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-500/30 text-cyan-600 dark:text-cyan-400">
                <Activity className="w-4 h-4" />
              </div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 hidden lg:inline">
                Waveform Analysis Suite
              </h1>
            </div>

            {/* Waveform Sub-Tabs: Wave Generator | SCADA | PMU */}
            <nav
              aria-label="Main Application Tabs"
              className={`flex items-center bg-slate-100 dark:bg-slate-900/90 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono transition-opacity ${
                settings.viewMode === 'network' ? 'opacity-75 hover:opacity-100' : ''
              }`}
            >
              <button
                onClick={() => handleSelectWaveformTab('generator')}
                title="Wave Generator (Waveform View)"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                  settings.viewMode === 'waveform' && activeTab === 'generator'
                    ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-cyan-500/30'
                    : activeTab === 'generator'
                    ? 'text-cyan-600/80 dark:text-cyan-400/80 hover:text-slate-900 dark:hover:text-slate-100'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Wave Generator</span>
              </button>

              <button
                onClick={() => handleSelectWaveformTab('scada')}
                title="SCADA Telemetry (Waveform View)"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                  settings.viewMode === 'waveform' && activeTab === 'scada'
                    ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-cyan-500/30'
                    : activeTab === 'scada'
                    ? 'text-cyan-600/80 dark:text-cyan-400/80 hover:text-slate-900 dark:hover:text-slate-100'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>SCADA</span>
              </button>

              <button
                onClick={() => handleSelectWaveformTab('pmu')}
                title="PMU Synchrophasor Capture (Waveform View)"
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                  settings.viewMode === 'waveform' && activeTab === 'pmu'
                    ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-cyan-500/30'
                    : activeTab === 'pmu'
                    ? 'text-cyan-600/80 dark:text-cyan-400/80 hover:text-slate-900 dark:hover:text-slate-100'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>PMU</span>
              </button>
            </nav>
          </div>

          {/* Center: Layout Selector (when in Waveform View) or IEEE 30-Bus Status Pill */}
          <div className="hidden md:flex items-center justify-center">
            {settings.viewMode === 'waveform' ? (
              <LayoutSelector
                layout={settings.layout}
                onLayoutChange={handleLayoutChange}
              />
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>IEEE 30-Bus Benchmark • AC Power Flow</span>
              </div>
            )}
          </div>

          {/* Right: View Switch (Waveform View | Power-System Simulator) & Settings Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Visualization View Mode Switch"
              className="flex items-center bg-slate-100 dark:bg-slate-900/90 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-mono"
            >
              <button
                type="button"
                onClick={() => handleViewModeChange('waveform')}
                aria-pressed={settings.viewMode === 'waveform'}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                  settings.viewMode === 'waveform'
                    ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-cyan-500/30'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Waveform View</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('network')}
                aria-pressed={settings.viewMode === 'network'}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all font-semibold cursor-pointer ${
                  settings.viewMode === 'network'
                    ? 'bg-white dark:bg-[#161f33] text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-cyan-500/30'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                <span>Power-System Simulator</span>
              </button>
            </div>

            <SettingsDropdown
              settings={settings}
              onUpdateSettings={updateSettings}
            />
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main
        className={`flex-1 w-full min-h-0 ${
          settings.viewMode === 'network'
            ? 'overflow-y-auto p-3 sm:p-4 max-w-[1600px] mx-auto'
            : 'overflow-y-auto md:overflow-hidden'
        }`}
      >
        {settings.viewMode === 'network' ? (
          <NetworkView
            network={network}
            solution={powerFlowSolution}
            isStale={isSolutionStale}
            autoSolve={autoSolve}
            solverOptions={solverOptions}
            selectedElement={selectedNetworkElement}
            theme={settings.theme}
            onSelectElement={setSelectedNetworkElement}
            onToggleAutoSolve={handleToggleAutoSolve}
            onUpdateSolverOptions={handleUpdateSolverOptions}
            onSolvePowerFlow={handleSolvePowerFlow}
            onUpdateLoadScale={handleUpdateLoadScale}
            onToggleEquipmentStatus={handleToggleNetworkEquipmentStatus}
            onUpdateGenerator={handleUpdateGenerator}
            onUpdateLoad={handleUpdateLoad}
            onUpdateTransformer={handleUpdateTransformer}
            onUpdateShunt={handleUpdateShunt}
            onResetSingleEquipment={handleResetSingleEquipment}
            onReloadOriginalCase={handleReloadOriginalCase}
            canUndo={history.canUndo}
            canRedo={history.canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onUpdateBusFull={handleUpdateBusFull}
            onUpdateGeneratorFull={handleUpdateGeneratorFull}
            onUpdateLoadFull={handleUpdateLoadFull}
            onUpdateLineFull={handleUpdateLineFull}
            onUpdateTransformerFull={handleUpdateTransformerFull}
            onUpdateShuntFull={handleUpdateShuntFull}
          />
        ) : (
          <>
            {activeTab === 'generator' && (
              <WaveGenerator
                theme={settings.theme}
                playbackSpeed={settings.playbackSpeed}
                onUpdatePlaybackSpeed={(spd) => updateSettings({ playbackSpeed: spd })}
                layout={settings.layout}
                waveformState={waveformState}
                onUpdateWaveform={setWaveformState}
                playback={playback}
                onTogglePlay={togglePlay}
                onResetTime={resetTime}
                showHarmonicsBreakdown={showHarmonicsBreakdown}
                onToggleBreakdown={() => setShowHarmonicsBreakdown((prev) => !prev)}
              />
            )}
            {activeTab === 'scada' && (
              <ScadaView
                theme={settings.theme}
                layout={settings.layout}
                waveformState={waveformState}
                onUpdateWaveform={setWaveformState}
                playback={playback}
                playbackSpeed={settings.playbackSpeed}
                onSetPlaybackSpeed={(spd) => updateSettings({ playbackSpeed: spd })}
                onTogglePlay={togglePlay}
                onResetTime={resetTime}
                scadaSimulation={scadaSimulation}
              />
            )}
            {activeTab === 'pmu' && (
              <PmuView
                theme={settings.theme}
                layout={settings.layout}
                waveformState={waveformState}
                onUpdateWaveform={setWaveformState}
                playback={playback}
                playbackSpeed={settings.playbackSpeed}
                onSetPlaybackSpeed={(spd) => updateSettings({ playbackSpeed: spd })}
                onTogglePlay={togglePlay}
                onResetTime={resetTime}
                pmuSettings={pmuSettings}
                onUpdatePmuSettings={setPmuSettings}
                disturbances={pmuDisturbances}
                onUpdateDisturbances={setPmuDisturbances}
                sampleNonce={pmuSampleNonce}
                onTakeNewMeasurement={handleTakeNewPmuMeasurement}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
