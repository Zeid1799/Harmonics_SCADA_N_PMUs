import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  BranchFlowSolution,
  NetworkEquipmentCategory,
  PowerFlowSolutionResult,
  PowerNetworkModel,
  SelectedNetworkElement,
  SimulatorOverlayConfig,
  ZoomDetailLevel,
} from '../../types/network';
import { validateNetworkModelIntegrity } from '../../model/networkModel';
import { AppTheme } from '../../types/settings';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Maximize,
  Minimize2,
  RotateCcw,
  Compass,
  AlertTriangle,
} from 'lucide-react';
import { OneLineLegendPopup } from './OneLineLegendPopup';
import { ShortCircuitSolution } from '../../types/shortCircuit';
import {
  DynamicFlowConfig,
  deriveBranchDynamicFlowState,
  DEFAULT_DYNAMIC_FLOW_CONFIG,
} from '../../types/dynamicFlow';

interface NetworkCanvasProps {
  network: PowerNetworkModel;
  solution: PowerFlowSolutionResult | null;
  isStale: boolean;
  selectedElement: SelectedNetworkElement | null;
  onSelectElement: (element: SelectedNetworkElement) => void;
  overlayConfig: SimulatorOverlayConfig;
  theme: AppTheme;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
  wheelSensitivity?: number;
  isEditMode?: boolean;
  onDoubleClickElement?: (category: NetworkEquipmentCategory, id: string) => void;
  // Phase C: Short-Circuit Analysis
  isShortCircuitMode?: boolean;
  shortCircuitSolution?: ShortCircuitSolution | null;
  faultedBusNumber?: number;
  showFaultOverlays?: boolean;
  onSelectFaultedBus?: (busNumber: number) => void;
  // Phase D: Dynamic View
  isDynamicFlowMode?: boolean;
  dynamicFlowConfig?: DynamicFlowConfig;
}

const DEFAULT_CANVAS_W = 1600;
const DEFAULT_CANVAS_H = 1020;

/**
 * Conservative default sensitivity for mouse-wheel / trackpad zoom (per pixel of delta).
 * Calibrated so a single standard wheel tick (delta ~100px) changes scale by ~7.5%
 * with identical, reversible response for both zoom-in and zoom-out without abrupt jumps.
 */
export const DEFAULT_WHEEL_ZOOM_SENSITIVITY = 0.00075;

const FALLBACK_OVERLAY_CONFIG: SimulatorOverlayConfig = {
  colorBranchesByLoading: true,
  showFlowArrows: true,
  highlightViolations: true,
  busLabelMode: 'voltage-pu-angle',
  branchLabelMode: 'loading',
  expandSchematic33kVCluster: true,
  useExternalOsmTiles: false,
  loadingThresholds: {
    elevatedPercent: 60,
    highPercent: 85,
    overloadPercent: 100,
  },
};

export const NetworkCanvas: React.FC<NetworkCanvasProps> = ({
  network,
  solution,
  isStale,
  selectedElement,
  onSelectElement,
  overlayConfig = FALLBACK_OVERLAY_CONFIG,
  theme,
  isFocusMode = false,
  onToggleFocusMode,
  wheelSensitivity = DEFAULT_WHEEL_ZOOM_SENSITIVITY,
  isEditMode = false,
  onDoubleClickElement,
  isShortCircuitMode = false,
  shortCircuitSolution = null,
  faultedBusNumber,
  showFaultOverlays = true,
  onSelectFaultedBus,
  isDynamicFlowMode = false,
  dynamicFlowConfig = DEFAULT_DYNAMIC_FLOW_CONFIG,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [containerDimensions, setContainerDimensions] = useState<{
    width: number;
    height: number;
  }>({
    width: DEFAULT_CANVAS_W,
    height: DEFAULT_CANVAS_H,
  });

  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragDistanceRef = useRef<number>(0);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);

  // ResizeObserver to adapt dynamically to container resizing & Focus Mode
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 50 && height > 50) {
          setContainerDimensions({ width, height });
        }
      }
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  const detailLevel: ZoomDetailLevel =
    zoom < 0.85 ? 'regional' : zoom < 1.45 ? 'intermediate' : 'detailed';

  const integrityIssues = useMemo(
    () => validateNetworkModelIntegrity(network),
    [network]
  );

  const busByNum = useMemo(() => {
    const map = new Map<number, PowerNetworkModel['buses'][number]>();
    if (Array.isArray(network?.buses)) {
      for (const bus of network.buses) {
        if (bus && typeof bus.number === 'number') {
          map.set(bus.number, bus);
        }
      }
    }
    return map;
  }, [network]);

  const isElementSelected = (
    category: NetworkEquipmentCategory,
    id: string | undefined
  ): boolean => {
    if (!selectedElement || !selectedElement.id || !id) return false;
    return selectedElement.category === category && selectedElement.id === id;
  };

  // Fit to screen: centers and scales all 30 buses comfortably inside available space
  const handleFitToScreen = useCallback(() => {
    const netWidth = 1420;
    const netHeight = 900;
    const netCenterX = 800;
    const netCenterY = 510;

    const scaleX = (containerDimensions.width - 60) / netWidth;
    const scaleY = (containerDimensions.height - 60) / netHeight;
    const fitScale = Math.min(2.5, Math.max(0.48, Math.min(scaleX, scaleY)));

    setZoom(fitScale);
    setPan({
      x: containerDimensions.width / 2 - netCenterX * fitScale,
      y: containerDimensions.height / 2 - netCenterY * fitScale,
    });
  }, [containerDimensions]);

  const handleResetView = useCallback(() => {
    handleFitToScreen();
  }, [handleFitToScreen]);

  // Initial fit on mount
  const hasAutoFittedRef = useRef(false);
  useEffect(() => {
    if (!hasAutoFittedRef.current && containerDimensions.width > 200) {
      hasAutoFittedRef.current = true;
      handleFitToScreen();
    }
  }, [containerDimensions, handleFitToScreen]);

  // Native non-passive wheel listener attached EXCLUSIVELY to the SVG diagram canvas.
  // Perfectly isolates zoom to the diagram, prevents surrounding interface scaling,
  // and applies configurable, smooth, cursor-centric scaling without abrupt jumps.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = svg.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Symmetrical exponential zoom multiplier based on deltaY magnitude and configurable sensitivity
      const clampedDelta = Math.max(-160, Math.min(160, e.deltaY));
      const factor = Math.exp(-clampedDelta * wheelSensitivity);

      setZoom((curZoom) => {
        const nextZoom = Math.min(3.5, Math.max(0.45, curZoom * factor));
        if (Math.abs(nextZoom - curZoom) < 1e-4) return curZoom;

        // Pointer position in SVG coordinate space
        const cursorX =
          ((e.clientX - rect.left) / rect.width) * containerDimensions.width;
        const cursorY =
          ((e.clientY - rect.top) / rect.height) * containerDimensions.height;

        const scaleRatio = nextZoom / curZoom;
        setPan((prevPan) => ({
          x: cursorX - (cursorX - prevPan.x) * scaleRatio,
          y: cursorY - (cursorY - prevPan.y) * scaleRatio,
        }));

        return nextZoom;
      });
    };

    svg.addEventListener('wheel', onWheelNative, { passive: false });
    return () => {
      svg.removeEventListener('wheel', onWheelNative);
    };
  }, [containerDimensions, wheelSensitivity]);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragDistanceRef.current = 0;
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    const newPanX = e.clientX - dragStart.x;
    const newPanY = e.clientY - dragStart.y;
    dragDistanceRef.current += Math.hypot(newPanX - pan.x, newPanY - pan.y);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleJumpToArea = (areaId: 0 | 1 | 2 | 3) => {
    if (areaId === 0) {
      handleFitToScreen();
      return;
    }
    const area = network?.areas?.find((a) => a && a.id === areaId);
    if (!area) return;
    const b = area.oneLineBounds;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const targetZoom = 1.65;
    setZoom(targetZoom);
    setPan({
      x: containerDimensions.width / 2 - cx * targetZoom,
      y: containerDimensions.height / 2 - cy * targetZoom,
    });
  };

  const getBranchColor = (
    flow: BranchFlowSolution | undefined,
    inService: boolean,
    voltageKv: number
  ) => {
    if (!inService || (flow && !flow.energized)) {
      return theme === 'dark' ? '#475569' : '#94a3b8';
    }
    if (solution?.converged && overlayConfig.colorBranchesByLoading && flow) {
      const pct = flow.loadingPercent;
      if (pct >= overlayConfig.loadingThresholds.overloadPercent) return '#ef4444';
      if (pct >= overlayConfig.loadingThresholds.highPercent) return '#f97316';
      if (pct >= overlayConfig.loadingThresholds.elevatedPercent) return '#eab3Yx'.replace('Yx', '08');
      return '#10b981';
    }
    if (voltageKv >= 132) return theme === 'dark' ? '#38bdf8' : '#0284c7';
    if (voltageKv >= 33) return theme === 'dark' ? '#818cf8' : '#4f46e5';
    return theme === 'dark' ? '#c084fc' : '#9333ea';
  };

  if (!network || !Array.isArray(network.buses) || network.buses.length === 0) {
    return (
      <div className="flex items-center justify-center w-full h-full p-6 bg-slate-50 dark:bg-[#070b14]">
        <div className="max-w-md p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-mono space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Network Model Initialization Error</span>
          </div>
          <p>
            Required network topology data is missing or empty. Verify that the IEEE 30-Bus model is initialized before mounting NetworkCanvas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[500px] select-none overflow-hidden bg-slate-50 dark:bg-[#070b14]"
    >
      {/* Integrity Diagnostic Banner if any equipment reference is inconsistent */}
      {integrityIssues.length > 0 && (
        <div
          role="alert"
          className="absolute top-14 left-2.5 z-30 max-w-lg px-3 py-2 rounded-lg border border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-200 text-[11px] font-mono shadow-md"
        >
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>
              Network Reference Diagnostic ({integrityIssues.length} issue
              {integrityIssues.length > 1 ? 's' : ''}):
            </span>
          </div>
          <div className="mt-0.5 truncate">{integrityIssues[0]}</div>
        </div>
      )}
      {/* Top-Left Multiscale Navigation & Area Jump Bar */}
      <div
        onWheel={(e) => e.stopPropagation()}
        className="absolute top-2.5 left-2.5 z-20 flex flex-wrap items-center gap-1.5 max-w-[78%]"
      >
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-md text-[11px] font-mono">
          <Compass className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
          <span className="font-bold text-slate-800 dark:text-slate-100">
            One-Line Schematic
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
            LOD: {detailLevel.toUpperCase()} ({Math.round(zoom * 100)}%)
          </span>
          <span className="text-slate-400">|</span>
          <span
            className={`font-semibold ${
              isEditMode
                ? 'text-amber-600 dark:text-amber-400 font-bold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {isEditMode ? 'EDIT MODE' : 'INSPECT MODE'}
          </span>
        </div>

        {/* Area Quick-Jump Controls */}
        <div className="flex items-center bg-white/95 dark:bg-slate-900/95 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md text-[10px] font-mono">
          <button
            type="button"
            onClick={() => handleJumpToArea(0)}
            className="px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold"
          >
            Full Network (30 Buses)
          </button>
          <button
            type="button"
            onClick={() => handleJumpToArea(1)}
            className="px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-cyan-700 dark:text-cyan-300"
          >
            Area 1: 132 kV Backbone
          </button>
          <button
            type="button"
            onClick={() => handleJumpToArea(2)}
            className="px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-700 dark:text-indigo-300"
          >
            Area 2: 33 kV West (Hancock)
          </button>
          <button
            type="button"
            onClick={() => handleJumpToArea(3)}
            className="px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-300"
          >
            Area 3: 33 kV East (Roanoke)
          </button>
        </div>
      </div>

      {/* Top-Right Zoom, Fit, Reset & Focus Mode Controls */}
      <div
        onWheel={(e) => e.stopPropagation()}
        className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md"
      >
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(3.5, z * 1.2))}
          title="Zoom In"
          aria-label="Zoom In"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.45, z / 1.2))}
          title="Zoom Out"
          aria-label="Zoom Out"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleFitToScreen}
          title="Fit Network to View"
          aria-label="Fit Network to View"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          title="Reset View"
          aria-label="Reset View"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        {onToggleFocusMode && (
          <button
            type="button"
            onClick={onToggleFocusMode}
            title={isFocusMode ? "Exit Focus Mode" : "Focus Mode (Maximize Diagram)"}
            aria-label={isFocusMode ? "Exit Focus Mode" : "Focus Mode (Maximize Diagram)"}
            className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${
              isFocusMode
                ? 'text-cyan-500 bg-cyan-500/10 font-bold'
                : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            {isFocusMode ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Centralized Floating Bottom-Right Legend Popup */}
      <OneLineLegendPopup overlayConfig={overlayConfig} />

      {/* Main Interactive SVG One-Line Diagram */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${containerDimensions.width} ${containerDimensions.height}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <defs>
          <pattern
            id="oneline-minor-grid"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 50 0 L 0 0 0 50"
              fill="none"
              stroke={theme === 'dark' ? '#111827' : '#e2e8f0'}
              strokeWidth="0.7"
            />
          </pattern>
          <pattern
            id="oneline-major-grid"
            width="200"
            height="200"
            patternUnits="userSpaceOnUse"
          >
            <rect width="200" height="200" fill="url(#oneline-minor-grid)" />
            <path
              d="M 200 0 L 0 0 0 200"
              fill="none"
              stroke={theme === 'dark' ? '#1e293b' : '#cbd5e1'}
              strokeWidth="1.1"
            />
          </pattern>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Background Engineering Coordinate Grid */}
          <rect
            x={-800}
            y={-800}
            width={3600}
            height={2600}
            fill="url(#oneline-major-grid)"
          />

          {/* 1. Voltage Area / Region Boundaries */}
          {(network.areas ?? []).map((area) => {
            if (!area || !area.oneLineBounds) return null;
            const b = area.oneLineBounds;
            const strokeColor =
              area.id === 1
                ? '#0ea5e9'
                : area.id === 2
                ? '#6366f1'
                : '#10b981';
            return (
              <g key={`area-${area.id}`}>
                <rect
                  x={b.x}
                  y={b.y}
                  width={b.width}
                  height={b.height}
                  rx={14}
                  fill={strokeColor}
                  fillOpacity={theme === 'dark' ? 0.03 : 0.04}
                  stroke={strokeColor}
                  strokeOpacity={0.28}
                  strokeWidth={1.4}
                  strokeDasharray="8 5"
                />
                <text
                  x={b.x + 14}
                  y={b.y + 20}
                  fill={strokeColor}
                  fillOpacity={0.85}
                  fontSize={detailLevel === 'regional' ? 14 : 11}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {area.name.toUpperCase()} ({area.voltageTierLabel})
                </text>
              </g>
            );
          })}

          {/* 2. Transmission Lines (34 branches) */}
          {(network.lines ?? []).map((line) => {
            if (!line || !line.id) return null;
            const fBus = busByNum.get(line.fromBusNumber);
            const tBus = busByNum.get(line.toBusNumber);
            if (!fBus || !tBus) return null;
            const x1 = fBus.oneLineLayout.x;
            const y1 = fBus.oneLineLayout.y;
            const x2 = tBus.oneLineLayout.x;
            const y2 = tBus.oneLineLayout.y;

            const flow = solution?.lineFlows[line.id];
            const color = getBranchColor(flow, line.status === 'online', line.voltageKv);
            const isSelected = isElementSelected('line', line.id);
            const isHovered = hoveredElement === line.id;

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
            const forwardFlow = (flow?.pFromMw ?? 0) >= 0;
            const arrowAngle = forwardFlow ? angleDeg : angleDeg + 180;

            const dynFlow = isDynamicFlowMode
              ? deriveBranchDynamicFlowState(
                  line.id,
                  'line',
                  line.fromBusNumber,
                  line.toBusNumber,
                  line.ratingMva,
                  flow,
                  dynamicFlowConfig
                )
              : null;
            const dynArrowAngle =
              dynFlow?.flowDirection === 'reverse'
                ? angleDeg + 180
                : angleDeg;

            return (
              <g
                key={line.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (dragDistanceRef.current > 6) return;
                  onSelectElement({ category: 'line', id: line.id });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDoubleClickElement?.('line', line.id);
                }}
                onMouseEnter={() => setHoveredElement(line.id)}
                onMouseLeave={() => setHoveredElement(null)}
                className="cursor-pointer"
              >
                {/* Invisible wider hit target */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="transparent"
                  strokeWidth={14}
                />

                {/* Selection halo */}
                {(isSelected || isHovered) && (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isSelected ? '#22d3ee' : '#94a3b8'}
                    strokeOpacity={0.35}
                    strokeWidth={8}
                    strokeLinecap="round"
                  />
                )}

                {/* Main branch conductor */}
                {isDynamicFlowMode && dynFlow ? (
                  <>
                    {/* Base track */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={
                        dynFlow.energized
                          ? theme === 'dark'
                            ? '#1e293b'
                            : '#cbd5e1'
                          : '#64748b'
                      }
                      strokeWidth={isSelected ? 4 : 2.5}
                      strokeDasharray={!dynFlow.energized ? '6 4' : undefined}
                    />

                    {/* Active dynamic flow stream */}
                    {dynFlow.energized && dynFlow.flowDirection !== 'zero' && (
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={dynFlow.loadingColor}
                        strokeWidth={dynFlow.isOverloaded ? 4.5 : 3.2}
                        strokeDasharray="10 8"
                        strokeLinecap="round"
                        style={{
                          animation:
                            dynamicFlowConfig.animationMode === 'animated'
                              ? dynFlow.flowDirection === 'forward'
                                ? `flow-dash-forward ${dynFlow.animationDurationSec}s linear infinite`
                                : `flow-dash-reverse ${dynFlow.animationDurationSec}s linear infinite`
                              : undefined,
                          animationPlayState: dynamicFlowConfig.isPlaying
                            ? 'running'
                            : 'paused',
                        }}
                      />
                    )}

                    {/* Directional chevron or zero-flow indicator */}
                    {dynFlow.energized && (
                      dynFlow.flowDirection !== 'zero' ? (
                        <g transform={`translate(${midX}, ${midY}) rotate(${dynArrowAngle})`}>
                          <polygon
                            points="8,0 -5,-5 -2,0 -5,5"
                            fill={dynFlow.loadingColor}
                            stroke={theme === 'dark' ? '#070b14' : '#ffffff'}
                            strokeWidth={1}
                          />
                        </g>
                      ) : (
                        <g transform={`translate(${midX}, ${midY})`}>
                          <circle
                            cx={0}
                            cy={0}
                            r={4.5}
                            fill={theme === 'dark' ? '#334155' : '#cbd5e1'}
                            stroke={theme === 'dark' ? '#64748b' : '#94a3b8'}
                            strokeWidth={1.5}
                          />
                          <circle cx={0} cy={0} r={1.5} fill="#94a3b8" />
                        </g>
                      )
                    )}

                    {/* Dynamic flow telemetry chip */}
                    {dynamicFlowConfig.showBranchTelemetry &&
                      detailLevel !== 'regional' &&
                      dynFlow.energized && (
                        <g transform={`translate(${midX}, ${midY - 12})`}>
                          <rect
                            x={-38}
                            y={-9}
                            width={76}
                            height={14}
                            rx={3}
                            fill={theme === 'dark' ? '#090d16' : '#ffffff'}
                            fillOpacity={0.92}
                            stroke={dynFlow.loadingColor}
                            strokeWidth={dynFlow.isOverloaded ? 1.5 : 0.8}
                          />
                          <text
                            textAnchor="middle"
                            y={1}
                            fill={
                              dynFlow.isOverloaded
                                ? '#ef4444'
                                : theme === 'dark'
                                ? '#f1f5f9'
                                : '#0f172a'
                            }
                            fontSize={8.5}
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {dynFlow.flowDirection === 'zero'
                              ? '0.0 MW'
                              : `${dynFlow.activePowerMw.toFixed(1)} MW · ${dynFlow.loadingPercent.toFixed(0)}%`}
                          </text>
                        </g>
                      )}
                  </>
                ) : (
                  <>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={color}
                      strokeWidth={
                        isSelected
                          ? 3.8
                          : flow?.overloaded
                          ? 3.4
                          : line.voltageKv >= 132
                          ? 2.6
                          : 1.9
                      }
                      strokeDasharray={line.status !== 'online' ? '7 5' : undefined}
                    />

                    {/* Directional Power-Flow Arrow */}
                    {overlayConfig.showFlowArrows &&
                      flow?.energized &&
                      Math.abs(flow.pFromMw) > 0.05 && (
                        <g transform={`translate(${midX}, ${midY}) rotate(${arrowAngle})`}>
                          <polygon
                            points="7,0 -5,-4.5 -5,4.5"
                            fill={color}
                            stroke={theme === 'dark' ? '#070b14' : '#ffffff'}
                            strokeWidth={0.8}
                          />
                        </g>
                      )}

                    {/* Branch Flow / Loading Label (Intermediate & Detailed LOD) */}
                    {detailLevel !== 'regional' &&
                      overlayConfig.branchLabelMode !== 'none' &&
                      flow?.energized && (
                        <g transform={`translate(${midX}, ${midY - 9})`}>
                          <rect
                            x={-36}
                            y={-9}
                            width={72}
                            height={13}
                            rx={3}
                            fill={theme === 'dark' ? '#0f172a' : '#ffffff'}
                            fillOpacity={0.86}
                            stroke={isSelected ? '#22d3ee' : color}
                            strokeOpacity={0.5}
                            strokeWidth={0.7}
                          />
                          <text
                            textAnchor="middle"
                            y={0.5}
                            fill={
                              isStale
                                ? '#f59e0b'
                                : flow.overloaded
                                ? '#ef4444'
                                : theme === 'dark'
                                ? '#e2e8f0'
                                : '#0f172a'
                            }
                            fontSize={8.5}
                            fontFamily="monospace"
                            fontWeight="600"
                          >
                            {overlayConfig.branchLabelMode === 'loading'
                              ? `${flow.loadingPercent.toFixed(0)}% (${flow.maxApparentFlowMva.toFixed(0)}MVA)`
                              : overlayConfig.branchLabelMode === 'mw'
                              ? `${Math.abs(flow.pFromMw).toFixed(1)} MW`
                              : `${Math.abs(flow.pFromMw).toFixed(1)}M ${flow.qFromMvar >= 0 ? '+' : ''}${flow.qFromMvar.toFixed(1)}Q`}
                          </text>
                        </g>
                      )}
                  </>
                )}

                {/* Detailed LOD extra rating tag */}
                {detailLevel === 'detailed' && (
                  <text
                    x={midX}
                    y={midY + 12}
                    textAnchor="middle"
                    fill={theme === 'dark' ? '#64748b' : '#475569'}
                    fontSize={7.5}
                    fontFamily="monospace"
                  >
                    L{line.fromBusNumber}-{line.toBusNumber} (RateA:{line.ratingMva}MVA)
                  </text>
                )}
              </g>
            );
          })}

          {/* 3. Transformers (7 branches with dual-winding symbol & tap ratio) */}
          {(network.transformers ?? []).map((tr) => {
            if (!tr || !tr.id) return null;
            const fBus = busByNum.get(tr.fromBusNumber);
            const tBus = busByNum.get(tr.toBusNumber);
            if (!fBus || !tBus) return null;
            const x1 = fBus.oneLineLayout.x;
            const y1 = fBus.oneLineLayout.y;
            const x2 = tBus.oneLineLayout.x;
            const y2 = tBus.oneLineLayout.y;

            const flow = solution?.transformerFlows[tr.id];
            const color = getBranchColor(flow, tr.status === 'online', tr.fromVoltageKv);
            const isSelected = isElementSelected('transformer', tr.id);
            const isHovered = hoveredElement === tr.id;

            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

            const dynFlow = isDynamicFlowMode
              ? deriveBranchDynamicFlowState(
                  tr.id,
                  'transformer',
                  tr.fromBusNumber,
                  tr.toBusNumber,
                  tr.ratingMva,
                  flow,
                  dynamicFlowConfig
                )
              : null;
            const dynArrowAngle =
              dynFlow?.flowDirection === 'reverse'
                ? angleDeg + 180
                : angleDeg;

            return (
              <g
                key={tr.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (dragDistanceRef.current > 6) return;
                  onSelectElement({ category: 'transformer', id: tr.id });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDoubleClickElement?.('transformer', tr.id);
                }}
                onMouseEnter={() => setHoveredElement(tr.id)}
                onMouseLeave={() => setHoveredElement(null)}
                className="cursor-pointer"
              >
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="transparent"
                  strokeWidth={16}
                />
                {isDynamicFlowMode && dynFlow ? (
                  <>
                    {/* Base track */}
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={
                        dynFlow.energized
                          ? theme === 'dark'
                            ? '#1e293b'
                            : '#cbd5e1'
                          : '#64748b'
                      }
                      strokeWidth={isSelected ? 4 : 2.5}
                      strokeDasharray={!dynFlow.energized ? '6 4' : undefined}
                    />

                    {/* Active dynamic flow stream */}
                    {dynFlow.energized && dynFlow.flowDirection !== 'zero' && (
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={dynFlow.loadingColor}
                        strokeWidth={dynFlow.isOverloaded ? 4.2 : 3}
                        strokeDasharray="10 8"
                        strokeLinecap="round"
                        style={{
                          animation:
                            dynamicFlowConfig.animationMode === 'animated'
                              ? dynFlow.flowDirection === 'forward'
                                ? `flow-dash-forward ${dynFlow.animationDurationSec}s linear infinite`
                                : `flow-dash-reverse ${dynFlow.animationDurationSec}s linear infinite`
                              : undefined,
                          animationPlayState: dynamicFlowConfig.isPlaying
                            ? 'running'
                            : 'paused',
                        }}
                      />
                    )}
                  </>
                ) : (
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={color}
                    strokeWidth={isSelected ? 3.5 : 2.3}
                    strokeDasharray={tr.status !== 'online' ? '6 4' : undefined}
                  />
                )}

                {/* Dual-winding transformer symbol at midpoint */}
                <g transform={`translate(${midX}, ${midY})`}>
                  {(isSelected || isHovered) && (
                    <rect
                      x={-18}
                      y={-14}
                      width={36}
                      height={28}
                      rx={6}
                      fill="none"
                      stroke="#22d3ee"
                      strokeWidth={1.6}
                      strokeDasharray="3 2"
                    />
                  )}
                  <circle
                    cx={-ux * 5}
                    cy={-uy * 5}
                    r={7.5}
                    fill={theme === 'dark' ? '#070b14' : '#ffffff'}
                    stroke={isDynamicFlowMode && dynFlow ? dynFlow.loadingColor : color}
                    strokeWidth={2}
                  />
                  <circle
                    cx={ux * 5}
                    cy={uy * 5}
                    r={7.5}
                    fill={theme === 'dark' ? '#070b14' : '#ffffff'}
                    stroke={isDynamicFlowMode && dynFlow ? dynFlow.loadingColor : color}
                    strokeWidth={2}
                  />

                  {/* Dynamic Mode: Directional chevron or zero indicator on transformer */}
                  {isDynamicFlowMode && dynFlow?.energized && dynFlow.flowDirection !== 'zero' && (
                    <g transform={`translate(${ux * 18}, ${uy * 18}) rotate(${dynArrowAngle})`}>
                      <polygon
                        points="7,0 -4,-4 -1.5,0 -4,4"
                        fill={dynFlow.loadingColor}
                        stroke={theme === 'dark' ? '#070b14' : '#ffffff'}
                        strokeWidth={0.8}
                      />
                    </g>
                  )}

                  {detailLevel !== 'regional' && (
                    <text
                      x={14}
                      y={3}
                      fill={theme === 'dark' ? '#c084fc' : '#7e22ce'}
                      fontSize={8.5}
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      T{tr.fromBusNumber}-{tr.toBusNumber} (τ={tr.tapRatioPu.toFixed(3)})
                    </text>
                  )}

                  {isDynamicFlowMode && dynFlow ? (
                    dynamicFlowConfig.showBranchTelemetry && (
                      <text
                        x={14}
                        y={14}
                        fill={dynFlow.loadingColor}
                        fontSize={8}
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {dynFlow.flowDirection === 'zero'
                          ? '0.0 MW (Zero)'
                          : `${dynFlow.activePowerMw.toFixed(1)} MW · ${dynFlow.loadingPercent.toFixed(0)}%`}
                      </text>
                    )
                  ) : (
                    detailLevel === 'detailed' && flow?.energized && (
                      <text
                        x={14}
                        y={13}
                        fill={theme === 'dark' ? '#94a3b8' : '#475569'}
                        fontSize={8}
                        fontFamily="monospace"
                      >
                        {flow.pFromMw.toFixed(1)}MW / {flow.loadingPercent.toFixed(0)}%
                      </text>
                    )
                  )}
                </g>
              </g>
            );
          })}

          {/* 4. Switched Shunt Capacitor Banks (Bus 10 & Bus 24) */}
          {(network.shunts ?? []).map((sh) => {
            if (!sh || !sh.id) return null;
            const bus = busByNum.get(sh.busNumber);
            if (!bus) return null;
            const bx = bus.oneLineLayout.x + 28;
            const by = bus.oneLineLayout.y + 30;
            const shOut = solution?.shuntOutputs[sh.id];
            const isSelected = isElementSelected('shunt', sh.id);
            const color =
              sh.status === 'online'
                ? theme === 'dark'
                  ? '#e879f9'
                  : '#c026d3'
                : '#64748b';

            return (
              <g
                key={sh.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (dragDistanceRef.current > 6) return;
                  onSelectElement({ category: 'shunt', id: sh.id });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDoubleClickElement?.('shunt', sh.id);
                }}
                className="cursor-pointer"
              >
                <line
                  x1={bus.oneLineLayout.x + 18}
                  y1={bus.oneLineLayout.y}
                  x2={bx}
                  y2={by - 8}
                  stroke={color}
                  strokeWidth={1.6}
                  strokeDasharray={sh.status !== 'online' ? '3 2' : undefined}
                />
                {isSelected && (
                  <rect
                    x={bx - 14}
                    y={by - 12}
                    width={28}
                    height={26}
                    rx={4}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={1.6}
                    strokeDasharray="3 2"
                  />
                )}
                {/* Capacitor parallel plates */}
                <line
                  x1={bx - 8}
                  y1={by - 5}
                  x2={bx + 8}
                  y2={by - 5}
                  stroke={color}
                  strokeWidth={2.4}
                />
                <line
                  x1={bx - 8}
                  y1={by}
                  x2={bx + 8}
                  y2={by}
                  stroke={color}
                  strokeWidth={2.4}
                />
                {/* Ground symbol */}
                <line
                  x1={bx}
                  y1={by}
                  x2={bx}
                  y2={by + 6}
                  stroke={color}
                  strokeWidth={1.5}
                />
                <line
                  x1={bx - 6}
                  y1={by + 6}
                  x2={bx + 6}
                  y2={by + 6}
                  stroke={color}
                  strokeWidth={1.5}
                />
                <line
                  x1={bx - 3.5}
                  y1={by + 9}
                  x2={bx + 3.5}
                  y2={by + 9}
                  stroke={color}
                  strokeWidth={1.5}
                />
                {detailLevel !== 'regional' && (
                  <text
                    x={bx + 11}
                    y={by + 2}
                    fill={color}
                    fontSize={8.5}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {shOut && sh.status === 'online'
                      ? `+${shOut.qInjectedMvar.toFixed(1)} MVAr`
                      : `${sh.configuredSusceptanceMvarAtUnitV.toFixed(1)} MVAr (OFF)`}
                  </text>
                )}
              </g>
            );
          })}

          {/* 5. Loads (21 load elements) */}
          {(network.loads ?? []).map((load) => {
            if (!load || !load.id) return null;
            const bus = busByNum.get(load.busNumber);
            if (!bus) return null;
            const lx = bus.oneLineLayout.x - 16;
            const ly = bus.oneLineLayout.y + 28;
            const isSelected = isElementSelected('load', load.id);
            const isUnsupplied =
              solution?.topology.unsuppliedLoadIds.includes(load.id) ?? false;
            const active = load.status === 'connected' && !isUnsupplied;

            const color = isUnsupplied
              ? '#ef4444'
              : active
              ? theme === 'dark'
                ? '#fbbf24'
                : '#d97706'
              : '#64748b';

            const effP = load.configuredActivePowerMw * network.loadScaleFactor;
            const effQ = load.configuredReactivePowerMvar * network.loadScaleFactor;

            return (
              <g
                key={load.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (dragDistanceRef.current > 6) return;
                  onSelectElement({ category: 'load', id: load.id });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDoubleClickElement?.('load', load.id);
                }}
                className="cursor-pointer"
              >
                <line
                  x1={lx}
                  y1={bus.oneLineLayout.y}
                  x2={lx}
                  y2={ly - 6}
                  stroke={color}
                  strokeWidth={1.6}
                  strokeDasharray={load.status !== 'connected' ? '3 2' : undefined}
                />
                {isSelected && (
                  <circle
                    cx={lx}
                    cy={ly}
                    r={12}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={1.8}
                    strokeDasharray="3 2"
                  />
                )}
                <polygon
                  points={`${lx},${ly + 6} ${lx - 6.5},${ly - 5} ${lx + 6.5},${ly - 5}`}
                  fill={color}
                />
                {detailLevel === 'detailed' && (
                  <text
                    x={lx}
                    y={ly + 16}
                    textAnchor="middle"
                    fill={color}
                    fontSize={8}
                    fontFamily="monospace"
                    fontWeight="600"
                  >
                    {load.status === 'connected'
                      ? `${effP.toFixed(1)}M / ${effQ.toFixed(1)}Q`
                      : 'DISC'}
                  </text>
                )}
              </g>
            );
          })}

          {/* 6. Generators & Synchronous Condensers (6 machines) */}
          {(network.generators ?? []).map((gen) => {
            if (!gen || !gen.id) return null;
            const bus = busByNum.get(gen.busNumber);
            if (!bus) return null;
            const isVerticalBus = bus.oneLineLayout.orientation === 'vertical';
            const gx = isVerticalBus
              ? bus.oneLineLayout.x + (gen.busNumber === 11 ? 38 : -38)
              : bus.oneLineLayout.x + 22;
            const gy = isVerticalBus
              ? bus.oneLineLayout.y
              : bus.oneLineLayout.y + 42;

            const genOut = solution?.generatorOutputs[gen.id];
            const isSelected = isElementSelected('generator', gen.id);
            const isCondenser = gen.unitType === 'Synchronous Condenser';
            const color =
              gen.status !== 'online'
                ? '#64748b'
                : genOut?.clampedAtQLimit && genOut.clampedAtQLimit !== 'none'
                ? '#f97316'
                : isCondenser
                ? '#06b6d4'
                : '#10b981';

            return (
              <g
                key={gen.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (dragDistanceRef.current > 6) return;
                  onSelectElement({ category: 'generator', id: gen.id });
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDoubleClickElement?.('generator', gen.id);
                }}
                className="cursor-pointer"
              >
                <line
                  x1={isVerticalBus ? bus.oneLineLayout.x : gx}
                  y1={bus.oneLineLayout.y}
                  x2={gx}
                  y2={gy}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={gen.status !== 'online' ? '4 3' : undefined}
                />
                {isSelected && (
                  <circle
                    cx={gx}
                    cy={gy}
                    r={18}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                )}
                <circle
                  cx={gx}
                  cy={gy}
                  r={13}
                  fill={theme === 'dark' ? '#0b1324' : '#ffffff'}
                  stroke={color}
                  strokeWidth={2.4}
                />
                <text
                  x={gx}
                  y={gy + 3.5}
                  textAnchor="middle"
                  fill={color}
                  fontSize={9.5}
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {isCondenser ? 'SC' : 'G'}
                </text>
                {detailLevel !== 'regional' && (
                  <text
                    x={gx}
                    y={gy + 24}
                    textAnchor="middle"
                    fill={theme === 'dark' ? '#e2e8f0' : '#0f172a'}
                    fontSize={8.5}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {gen.id}
                    {genOut && gen.status === 'online'
                      ? ` (${genOut.pMw.toFixed(0)}M/${genOut.qMvar.toFixed(0)}Q)`
                      : ' (OFF)'}
                  </text>
                )}
              </g>
            );
          })}

          {/* 7. Busbars (30 Buses) */}
          {network.buses.map((bus) => {
            if (!bus || !bus.id || !bus.oneLineLayout) return null;
            const { x, y, orientation, length } = bus.oneLineLayout;
            const bSol = solution?.busSolutions[bus.number];
            const isSelected = isElementSelected('bus', bus.id);
            const isHovered = hoveredElement === bus.id;

            const hasViolation =
              overlayConfig.highlightViolations &&
              bSol &&
              bSol.voltageViolation !== 'none';

            const busColor =
              bus.status !== 'online' || (bSol && !bSol.energized)
                ? '#ef4444'
                : hasViolation
                ? '#f97316'
                : bus.busType === 'slack'
                ? '#10b981'
                : bus.busType === 'pv'
                ? '#06b6d4'
                : bus.baseKv >= 132
                ? theme === 'dark'
                  ? '#38bdf8'
                  : '#0284c7'
                : theme === 'dark'
                ? '#a5b4fc'
                : '#4f46e5';

            const half = length / 2;
            const x1 = orientation === 'horizontal' ? x - half : x;
            const y1 = orientation === 'horizontal' ? y : y - half;
            const x2 = orientation === 'horizontal' ? x + half : x;
            const y2 = orientation === 'horizontal' ? y : y + half;

            const isFaultTarget =
              isShortCircuitMode &&
              (faultedBusNumber === bus.number ||
                shortCircuitSolution?.scenario.faultedBusNumber === bus.number);

            return (
              <g
                key={bus.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (dragDistanceRef.current > 6) return;
                  onSelectElement({ category: 'bus', id: bus.id });
                  if (isShortCircuitMode && onSelectFaultedBus) {
                    onSelectFaultedBus(bus.number);
                  }
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onDoubleClickElement?.('bus', bus.id);
                }}
                onMouseEnter={() => setHoveredElement(bus.id)}
                onMouseLeave={() => setHoveredElement(null)}
                className={isShortCircuitMode ? 'cursor-crosshair' : 'cursor-pointer'}
              >
                {/* Selection / Violation / Fault Target Frame */}
                {(isSelected || isHovered || hasViolation || isFaultTarget) && (
                  <rect
                    x={(orientation === 'horizontal' ? x - half : x) - 8}
                    y={(orientation === 'horizontal' ? y : y - half) - 8}
                    width={(orientation === 'horizontal' ? length : 0) + 16}
                    height={(orientation === 'horizontal' ? 0 : length) + 16}
                    rx={5}
                    fill="none"
                    stroke={
                      isFaultTarget
                        ? '#ef4444'
                        : isSelected
                        ? '#22d3ee'
                        : hasViolation
                        ? '#ef4444'
                        : '#94a3b8'
                    }
                    strokeWidth={isFaultTarget ? 2.5 : 2}
                    strokeDasharray={isSelected || isFaultTarget ? undefined : '4 2'}
                  />
                )}

                {/* Busbar Conductor */}
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={busColor}
                  strokeWidth={bus.baseKv >= 132 ? 6.5 : 5}
                  strokeLinecap="round"
                />

                {/* Center Node Marker */}
                <circle
                  cx={x}
                  cy={y}
                  r={3.5}
                  fill={theme === 'dark' ? '#0f172a' : '#ffffff'}
                  stroke={busColor}
                  strokeWidth={1.8}
                />

                {/* Bus Label & Solved Voltage Readout */}
                <g transform={`translate(${x}, ${y - 12})`}>
                  <text
                    textAnchor="middle"
                    fill={theme === 'dark' ? '#f8fafc' : '#0f172a'}
                    fontSize={detailLevel === 'regional' ? 11 : 10}
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {isSelected ? '★ ' : ''}
                    {detailLevel === 'regional'
                      ? `B${bus.number}`
                      : `${bus.number}: ${bus.name}`}
                  </text>

                  {detailLevel !== 'regional' &&
                    overlayConfig.busLabelMode !== 'name-only' &&
                    bSol && (
                      <text
                        y={-11}
                        textAnchor="middle"
                        fill={
                          isStale
                            ? '#f59e0b'
                            : bSol.voltageViolation !== 'none'
                            ? '#ef4444'
                            : theme === 'dark'
                            ? '#38bdf8'
                            : '#0284c7'
                        }
                        fontSize={9}
                        fontFamily="monospace"
                        fontWeight="600"
                      >
                        {!bSol.energized
                          ? 'DE-ENERGIZED (0.000 pu)'
                          : overlayConfig.busLabelMode === 'voltage-kv'
                          ? `${bSol.vmKv.toFixed(1)} kV (${bSol.vmPu.toFixed(3)} pu)`
                          : `${bSol.vmPu.toFixed(3)} pu ∠${bSol.vaDeg.toFixed(1)}°`}
                      </text>
                    )}
                </g>
              </g>
            );
          })}

          {/* 6. Short-Circuit Analysis Overlays (Fault Beacon, Branch Inflows, Sag Badges) */}
          {showFaultOverlays && shortCircuitSolution && shortCircuitSolution.converged && (
            <g className="sc-overlay-layer pointer-events-none">
              {/* (A) Branch Inflow Vectors & Telemetry Chips */}
              {shortCircuitSolution.branchContributions.map((br) => {
                const faultBusNum = shortCircuitSolution.scenario.faultedBusNumber;
                const otherBusNum =
                  br.connectedFromBus === faultBusNum
                    ? br.connectedToBus
                    : br.connectedFromBus;
                const faultBus = busByNum.get(faultBusNum);
                const otherBus = busByNum.get(otherBusNum);
                if (!faultBus || !otherBus) return null;

                const sx = otherBus.oneLineLayout.x;
                const sy = otherBus.oneLineLayout.y;
                const tx = faultBus.oneLineLayout.x;
                const ty = faultBus.oneLineLayout.y;

                const dx = tx - sx;
                const dy = ty - sy;
                const len = Math.hypot(dx, dy) || 1;
                const ux = dx / len;
                const uy = dy / len;

                // Position arrow at 65% of the distance towards the faulted bus
                const arrowX = sx + ux * (len * 0.65);
                const arrowY = sy + uy * (len * 0.65);
                const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

                return (
                  <g key={`sc-flow-${br.branchId}`}>
                    {/* Glowing highlight line indicating fault current feed */}
                    <line
                      x1={sx}
                      y1={sy}
                      x2={tx}
                      y2={ty}
                      stroke="#ef4444"
                      strokeWidth={3}
                      strokeDasharray="6 3"
                      strokeOpacity={0.8}
                    />
                    {/* Directional Inflow Arrow */}
                    <g transform={`translate(${arrowX}, ${arrowY}) rotate(${angle})`}>
                      <polygon
                        points="11,0 -4,-5.5 0,0 -4,5.5"
                        fill="#ef4444"
                        stroke="#ffffff"
                        strokeWidth={1}
                      />
                    </g>
                    {/* Branch Inflow Magnitude Chip */}
                    <g transform={`translate(${arrowX}, ${arrowY - 11})`}>
                      <rect
                        x={-34}
                        y={-8}
                        width={68}
                        height={14}
                        rx={3}
                        fill="#1e1b4b"
                        stroke="#f59e0b"
                        strokeWidth={1}
                      />
                      <text
                        textAnchor="middle"
                        y={2.5}
                        fill="#fef08a"
                        fontSize={8.5}
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {br.currentKa.toFixed(2)} kA ({br.percentOfTotalFaultCurrent.toFixed(0)}%)
                      </text>
                    </g>
                  </g>
                );
              })}

              {/* (B) Bus Voltage Sag Badges on Affected Buses (< 0.85 pu) */}
              {shortCircuitSolution.busVoltages
                .filter(
                  (bv) =>
                    !bv.isFaultedBus &&
                    bv.minPhaseVoltagePu < 0.85 &&
                    busByNum.has(bv.busNumber)
                )
                .map((bv) => {
                  const bus = busByNum.get(bv.busNumber)!;
                  const bx = bus.oneLineLayout.x;
                  const by = bus.oneLineLayout.y;
                  const isSevere = bv.isSevereSag;

                  return (
                    <g
                      key={`sc-sag-${bv.busNumber}`}
                      transform={`translate(${bx}, ${by + 16})`}
                    >
                      <rect
                        x={-28}
                        y={-7}
                        width={56}
                        height={13}
                        rx={3}
                        fill={isSevere ? '#7f1d1d' : '#78350f'}
                        stroke={isSevere ? '#ef4444' : '#f59e0b'}
                        strokeWidth={0.9}
                      />
                      <text
                        textAnchor="middle"
                        y={2.5}
                        fill={isSevere ? '#fecaca' : '#fef08a'}
                        fontSize={8}
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        Sag: {bv.minPhaseVoltagePu.toFixed(2)} pu
                      </text>
                    </g>
                  );
                })}

              {/* (C) Fault Beacon & Hero Telemetry Badge at Faulted Bus */}
              {(() => {
                const fBusNum = shortCircuitSolution.scenario.faultedBusNumber;
                const fBus = busByNum.get(fBusNum);
                if (!fBus) return null;
                const fx = fBus.oneLineLayout.x;
                const fy = fBus.oneLineLayout.y;

                return (
                  <g transform={`translate(${fx}, ${fy})`}>
                    {/* Outer Pulsing Beacon */}
                    <circle
                      r={30}
                      fill="#ef4444"
                      fillOpacity={0.2}
                      stroke="#ef4444"
                      strokeWidth={2}
                      className="animate-ping"
                    />
                    {/* Concentric Flare Rings */}
                    <circle
                      r={18}
                      fill="#dc2626"
                      fillOpacity={0.4}
                      stroke="#f59e0b"
                      strokeWidth={2}
                    />
                    <circle
                      r={8}
                      fill="#fbbf24"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    {/* Spark Glyph */}
                    <path
                      d="M-2,-6 L2,-1 L-1,0 L3,6 L-3,1 L0,0 Z"
                      fill="#ffffff"
                      stroke="#b91c1c"
                      strokeWidth={0.6}
                    />

                    {/* Fault Banner Badge */}
                    <g transform="translate(0, -32)">
                      <rect
                        x={-62}
                        y={-14}
                        width={124}
                        height={25}
                        rx={5}
                        fill="#991b1b"
                        stroke="#fbbf24"
                        strokeWidth={1.8}
                      />
                      <text
                        textAnchor="middle"
                        y={-2}
                        fill="#ffffff"
                        fontSize={9}
                        fontFamily="sans-serif"
                        fontWeight="900"
                        letterSpacing="0.05em"
                      >
                        ⚡ FAULT: {shortCircuitSolution.scenario.faultType.toUpperCase()}
                      </text>
                      <text
                        textAnchor="middle"
                        y={8}
                        fill="#fef08a"
                        fontSize={8}
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {shortCircuitSolution.totalFaultCurrentKa.toFixed(2)} kA ({shortCircuitSolution.shortCircuitMva.toFixed(0)} MVA)
                      </text>
                    </g>
                  </g>
                );
              })()}
            </g>
          )}

          {/* Target Reticle if in SC mode and no solution yet */}
          {isShortCircuitMode &&
            (!shortCircuitSolution || !shortCircuitSolution.converged) &&
            faultedBusNumber &&
            (() => {
              const fBus = busByNum.get(faultedBusNumber);
              if (!fBus) return null;
              const fx = fBus.oneLineLayout.x;
              const fy = fBus.oneLineLayout.y;
              return (
                <g transform={`translate(${fx}, ${fy})`} className="pointer-events-none">
                  <circle
                    r={24}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                  />
                  <circle
                    r={8}
                    fill="#f59e0b"
                    fillOpacity={0.3}
                    stroke="#d97706"
                    strokeWidth={1.5}
                  />
                  <g transform="translate(0, -28)">
                    <rect
                      x={-45}
                      y={-10}
                      width={90}
                      height={20}
                      rx={4}
                      fill="#78350f"
                      stroke="#f59e0b"
                      strokeWidth={1}
                    />
                    <text
                      textAnchor="middle"
                      y={4}
                      fill="#fef08a"
                      fontSize={8.5}
                      fontFamily="sans-serif"
                      fontWeight="bold"
                    >
                      TARGET: B{faultedBusNumber}
                    </text>
                  </g>
                </g>
              );
            })()}
        </g>
      </svg>
    </div>
  );
};
