import React, { useState, useRef, useMemo } from 'react';
import {
  BranchFlowSolution,
  PowerFlowSolutionResult,
  PowerNetworkModel,
  SelectedNetworkElement,
  SimulatorOverlayConfig,
  ZoomDetailLevel,
} from '../../types/network';
import { AppTheme } from '../../types/settings';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Layers,
  Globe,
  AlertTriangle,
} from 'lucide-react';

interface GeographicMapCanvasProps {
  network: PowerNetworkModel;
  solution: PowerFlowSolutionResult | null;
  isStale: boolean;
  selectedElement: SelectedNetworkElement | null;
  onSelectElement: (element: SelectedNetworkElement) => void;
  overlayConfig: SimulatorOverlayConfig;
  onUpdateOverlayConfig: (partial: Partial<SimulatorOverlayConfig>) => void;
  theme: AppTheme;
}

const MAP_WIDTH = 1400;
const MAP_HEIGHT = 860;

// Bounding box covering the 1961 AEP Roanoke / New River / Lynchburg Virginia region
const LON_MIN = -81.05;
const LON_MAX = -79.05;
const LAT_MIN = 36.62;
const LAT_MAX = 37.56;

function latToMercatorY(latDeg: number): number {
  const rad = (latDeg * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

const MERC_Y_MIN = latToMercatorY(LAT_MIN);
const MERC_Y_MAX = latToMercatorY(LAT_MAX);

/**
 * Projects geographic (lat, lon) in the southwestern Virginia AEP footprint to SVG canvas (x, y).
 */
export function projectGeoToCanvas(lat: number, lon: number): { x: number; y: number } {
  const padX = 70;
  const padY = 60;
  const usableW = MAP_WIDTH - padX * 2;
  const usableH = MAP_HEIGHT - padY * 2;

  const x = padX + ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * usableW;
  const mercY = latToMercatorY(lat);
  const y = padY + ((MERC_Y_MAX - mercY) / (MERC_Y_MAX - MERC_Y_MIN)) * usableH;
  return { x, y };
}

/**
 * Computes Web Mercator slippy tile coordinates covering our bounding box at zoom z = 9.
 */
function getOsmTilesForBounds() {
  const z = 9;
  const n = Math.pow(2, z);
  const lonToTileX = (lon: number) => ((lon + 180) / 360) * n;
  const latToTileY = (lat: number) => {
    const rad = (lat * Math.PI) / 180;
    return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  };
  const tileXToLon = (tx: number) => (tx / n) * 360 - 180;
  const tileYToLat = (ty: number) => {
    const a = Math.PI - (2 * Math.PI * ty) / n;
    return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(a) - Math.exp(-a)));
  };

  const minTx = Math.floor(lonToTileX(LON_MIN));
  const maxTx = Math.floor(lonToTileX(LON_MAX));
  const minTy = Math.floor(latToTileY(LAT_MAX));
  const maxTy = Math.floor(latToTileY(LAT_MIN));

  const tiles: {
    key: string;
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [];

  for (let tx = minTx; tx <= maxTx; tx++) {
    for (let ty = minTy; ty <= maxTy; ty++) {
      const nwLon = tileXToLon(tx);
      const nwLat = tileYToLat(ty);
      const seLon = tileXToLon(tx + 1);
      const seLat = tileYToLat(ty + 1);
      const nw = projectGeoToCanvas(nwLat, nwLon);
      const se = projectGeoToCanvas(seLat, seLon);
      tiles.push({
        key: `${z}-${tx}-${ty}`,
        url: `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`,
        x: nw.x,
        y: nw.y,
        width: se.x - nw.x,
        height: se.y - nw.y,
      });
    }
  }
  return tiles;
}

export const GeographicMapCanvas: React.FC<GeographicMapCanvasProps> = ({
  network,
  solution,
  isStale,
  selectedElement,
  onSelectElement,
  overlayConfig,
  onUpdateOverlayConfig,
  theme,
}) => {
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tileLoadError, setTileLoadError] = useState<boolean>(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const detailLevel: ZoomDetailLevel =
    zoom < 0.85 ? 'regional' : zoom < 1.45 ? 'intermediate' : 'detailed';

  const osmTiles = useMemo(() => getOsmTilesForBounds(), []);

  // Project each bus into canvas coordinates.
  // For multi-bus substations at identical or adjacent coordinates, apply a small deterministic offset
  // so 132 kV / 33 kV / 11 kV busbars within the same substation remain individually selectable.
  const busPositions = useMemo(() => {
    const map = new Map<number, { x: number; y: number }>();
    for (const bus of network.buses) {
      if (
        !overlayConfig.expandSchematic33kVCluster &&
        bus.geoLocation.coordinateConfidence === 'schematic-subtransmission-cluster' &&
        bus.geoLocation.parentSubstationBusNumber
      ) {
        const parent = network.buses.find(
          (b) => b.number === bus.geoLocation.parentSubstationBusNumber
        );
        if (parent) {
          map.set(
            bus.number,
            projectGeoToCanvas(parent.geoLocation.lat, parent.geoLocation.lon)
          );
          continue;
        }
      }
      const pt = projectGeoToCanvas(bus.geoLocation.lat, bus.geoLocation.lon);
      map.set(bus.number, pt);
    }
    return map;
  }, [network.buses, overlayConfig.expandSchematic33kVCluster]);

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14;
    const nextZoom = Math.min(3.5, Math.max(0.55, zoom * factor));
    if (!svgRef.current) {
      setZoom(nextZoom);
      return;
    }
    const rect = svgRef.current.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * MAP_WIDTH;
    const cy = ((e.clientY - rect.top) / rect.height) * MAP_HEIGHT;
    const scaleChange = nextZoom / zoom;
    setPan((prev) => ({
      x: cx - (cx - prev.x) * scaleChange,
      y: cy - (cy - prev.y) * scaleChange,
    }));
    setZoom(nextZoom);
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  const handleFocusSubregion = (target: 'all' | 'west-132' | 'roanoke-hub' | 'east-132') => {
    if (target === 'all') {
      handleResetView();
    } else if (target === 'west-132') {
      const pt = projectGeoToCanvas(37.22, -80.65);
      setZoom(1.65);
      setPan({ x: MAP_WIDTH / 2 - pt.x * 1.65, y: MAP_HEIGHT / 2 - pt.y * 1.65 });
    } else if (target === 'roanoke-hub') {
      const pt = projectGeoToCanvas(37.33, -79.93);
      setZoom(2.15);
      setPan({ x: MAP_WIDTH / 2 - pt.x * 2.15, y: MAP_HEIGHT / 2 - pt.y * 2.15 });
    } else if (target === 'east-132') {
      const pt = projectGeoToCanvas(37.41, -79.45);
      setZoom(1.55);
      setPan({ x: MAP_WIDTH / 2 - pt.x * 1.55, y: MAP_HEIGHT / 2 - pt.y * 1.55 });
    }
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
      if (pct >= overlayConfig.loadingThresholds.elevatedPercent) return '#eab308';
      return '#10b981';
    }
    if (voltageKv >= 132) return theme === 'dark' ? '#38bdf8' : '#0284c7';
    if (voltageKv >= 33) return theme === 'dark' ? '#818cf8' : '#4f46e5';
    return theme === 'dark' ? '#c084fc' : '#9333ea';
  };

  // Pre-compute geographic hydrology polylines (New River, Roanoke River, James River) for offline vector basemap
  const newRiverPts = [
    [36.75, -80.75],
    [36.95, -80.68],
    [37.075, -80.586],
    [37.22, -80.55],
    [37.372, -80.862],
    [37.5, -80.89],
  ]
    .map(([lat, lon]) => {
      const p = projectGeoToCanvas(lat, lon);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  const roanokeRiverPts = [
    [37.24, -80.22],
    [37.26, -79.94],
    [37.22, -79.75],
    [37.04, -79.55],
  ]
    .map(([lat, lon]) => {
      const p = projectGeoToCanvas(lat, lon);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  const jamesRiverPts = [
    [37.54, -79.68],
    [37.52, -79.35],
    [37.461, -79.189],
    [37.41, -79.1],
  ]
    .map(([lat, lon]) => {
      const p = projectGeoToCanvas(lat, lon);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  const showOsmTiles = overlayConfig.useExternalOsmTiles && !tileLoadError;

  return (
    <div className="relative w-full h-full select-none overflow-hidden bg-slate-100 dark:bg-[#060a12]">
      {/* Top-Left Geographic Navigation & Provenance Bar */}
      <div className="absolute top-2.5 left-2.5 z-20 flex flex-wrap items-center gap-1.5 max-w-[76%]">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-md text-[11px] font-mono">
          <Globe className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
          <span className="font-bold text-slate-800 dark:text-slate-100">
            1961 AEP Southwest Virginia Footprint
          </span>
          <span className="text-slate-400">|</span>
          <span className="text-cyan-600 dark:text-cyan-400 font-semibold">
            LOD: {detailLevel.toUpperCase()} ({Math.round(zoom * 100)}%)
          </span>
        </div>

        {/* Subregion Quick Jumps */}
        <div className="flex items-center bg-white/95 dark:bg-slate-900/95 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md text-[10px] font-mono">
          <button
            type="button"
            onClick={() => handleFocusSubregion('all')}
            className="px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold"
          >
            All Virginia Corridor
          </button>
          <button
            type="button"
            onClick={() => handleFocusSubregion('west-132')}
            className="px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            New River (Glen Lyn / Claytor)
          </button>
          <button
            type="button"
            onClick={() => handleFocusSubregion('roanoke-hub')}
            className="px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            Roanoke / Hancock / Cloverdale
          </button>
          <button
            type="button"
            onClick={() => handleFocusSubregion('east-132')}
            className="px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
          >
            Lynchburg (Reusens)
          </button>
        </div>

        {/* Toggle Schematic 33 kV Cluster Expansion */}
        <button
          type="button"
          onClick={() =>
            onUpdateOverlayConfig({
              expandSchematic33kVCluster: !overlayConfig.expandSchematic33kVCluster,
            })
          }
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border shadow-md text-[10px] font-mono font-semibold transition-all ${
            overlayConfig.expandSchematic33kVCluster
              ? 'bg-amber-50 dark:bg-amber-950/70 border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300'
              : 'bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}
          title="Buses 14–26 & 29–30 are unnamed 33 kV feeder buses in ieee30cdf.txt without published coordinates"
        >
          <Layers className="w-3 h-3" />
          <span>
            {overlayConfig.expandSchematic33kVCluster
              ? '33 kV Feeders: Expanded (Schematic Cluster)'
              : '33 kV Feeders: Aggregated at Substations'}
          </span>
        </button>

        {/* Basemap Source Toggle (OSM Tiles vs Built-in Vector Graticule) */}
        <button
          type="button"
          onClick={() => {
            setTileLoadError(false);
            onUpdateOverlayConfig({
              useExternalOsmTiles: !overlayConfig.useExternalOsmTiles,
            });
          }}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-md text-[10px] font-mono text-slate-700 dark:text-slate-300 hover:border-cyan-500/40"
        >
          <span>
            Basemap: {showOsmTiles ? 'OpenStreetMap + Vector Overlay' : 'Offline Cartographic Vector Grid'}
          </span>
        </button>
      </div>

      {/* Top-Right Zoom & Reset Controls */}
      <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-md">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(3.5, z * 1.2))}
          title="Zoom In"
          aria-label="Zoom In"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.55, z / 1.2))}
          title="Zoom Out"
          aria-label="Zoom Out"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          title="Fit Network to View"
          aria-label="Fit Network to View"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          title="Reset View"
          aria-label="Reset View"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Geographic Coordinate Provenance Banner */}
      <div className="absolute bottom-2.5 left-2.5 z-20 max-w-xl px-2.5 py-1.5 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-md text-[10px] font-mono text-slate-600 dark:text-slate-300 flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        <span>
          <strong>Geographic Provenance:</strong> Solid markers (Buses 1–13, 27–28) are historical 1961 AEP Virginia substations named in{' '}
          <code>ieee30cdf.txt</code>. Dashed markers (Buses 14–26, 29–30) are unnamed 33 kV feeder buses shown as a schematic cluster.
          {tileLoadError && ' (External OSM tiles unreachable — using built-in Offline Cartographic Vector Basemap.)'}
        </span>
      </div>

      {/* Attribution & Metric Scale Bar */}
      <div className="absolute bottom-2.5 right-2.5 z-20 px-2.5 py-1 rounded-lg bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-md text-[10px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-12 h-1.5 border-x border-b border-slate-500 dark:border-slate-400" />
          <span>{Math.round(25 / zoom)} km</span>
        </div>
        {showOsmTiles && <span>Map data © OpenStreetMap contributors</span>}
      </div>

      {/* Interactive SVG Map Viewport */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* 1. Optional OpenStreetMap Tile Layer */}
          {showOsmTiles && (
            <g opacity={theme === 'dark' ? 0.32 : 0.72}>
              {osmTiles.map((tile) => (
                <image
                  key={tile.key}
                  href={tile.url}
                  x={tile.x}
                  y={tile.y}
                  width={tile.width}
                  height={tile.height}
                  preserveAspectRatio="none"
                  onError={() => setTileLoadError(true)}
                />
              ))}
            </g>
          )}

          {/* 2. Always-available Cartographic Graticule & Regional Hydrology Vector Layer */}
          <g>
            {/* Longitude Graticule Lines */}
            {[-81.0, -80.75, -80.5, -80.25, -80.0, -79.75, -79.5, -79.25].map((lon) => {
              const top = projectGeoToCanvas(LAT_MAX, lon);
              const bot = projectGeoToCanvas(LAT_MIN, lon);
              return (
                <g key={`lon-${lon}`}>
                  <line
                    x1={top.x}
                    y1={top.y}
                    x2={bot.x}
                    y2={bot.y}
                    stroke={theme === 'dark' ? '#1e293b' : '#cbd5e1'}
                    strokeWidth={0.8 / zoom}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={top.x + 4}
                    y={top.y + 12}
                    fill={theme === 'dark' ? '#64748b' : '#475569'}
                    fontSize={10 / Math.sqrt(zoom)}
                    fontFamily="monospace"
                  >
                    {Math.abs(lon).toFixed(2)}°W
                  </text>
                </g>
              );
            })}

            {/* Latitude Graticule Lines */}
            {[36.7, 36.9, 37.1, 37.3, 37.5].map((lat) => {
              const left = projectGeoToCanvas(lat, LON_MIN);
              const right = projectGeoToCanvas(lat, LON_MAX);
              return (
                <g key={`lat-${lat}`}>
                  <line
                    x1={left.x}
                    y1={left.y}
                    x2={right.x}
                    y2={right.y}
                    stroke={theme === 'dark' ? '#1e293b' : '#cbd5e1'}
                    strokeWidth={0.8 / zoom}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={left.x + 6}
                    y={left.y - 4}
                    fill={theme === 'dark' ? '#64748b' : '#475569'}
                    fontSize={10 / Math.sqrt(zoom)}
                    fontFamily="monospace"
                  >
                    {lat.toFixed(1)}°N
                  </text>
                </g>
              );
            })}

            {/* Major River Systems (New River, Roanoke River, James River) */}
            <polyline
              points={newRiverPts}
              fill="none"
              stroke={theme === 'dark' ? '#0ea5e9' : '#38bdf8'}
              strokeOpacity={0.28}
              strokeWidth={4 / Math.sqrt(zoom)}
              strokeLinecap="round"
            />
            <polyline
              points={roanokeRiverPts}
              fill="none"
              stroke={theme === 'dark' ? '#0ea5e9' : '#38bdf8'}
              strokeOpacity={0.25}
              strokeWidth={3.2 / Math.sqrt(zoom)}
              strokeLinecap="round"
            />
            <polyline
              points={jamesRiverPts}
              fill="none"
              stroke={theme === 'dark' ? '#0ea5e9' : '#38bdf8'}
              strokeOpacity={0.28}
              strokeWidth={3.8 / Math.sqrt(zoom)}
              strokeLinecap="round"
            />

            {/* Schematic 33 kV Cluster Boundary Halo around North Roanoke Valley */}
            {overlayConfig.expandSchematic33kVCluster && (
              <g>
                {(() => {
                  const nw = projectGeoToCanvas(37.43, -80.07);
                  const se = projectGeoToCanvas(37.285, -79.835);
                  return (
                    <g>
                      <rect
                        x={nw.x}
                        y={nw.y}
                        width={se.x - nw.x}
                        height={se.y - nw.y}
                        rx={12 / zoom}
                        fill={theme === 'dark' ? '#f59e0b' : '#fbbf24'}
                        fillOpacity={0.05}
                        stroke={theme === 'dark' ? '#f59e0b' : '#d97706'}
                        strokeOpacity={0.45}
                        strokeWidth={1.2 / zoom}
                        strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                      />
                      <text
                        x={nw.x + 8 / zoom}
                        y={nw.y + 14 / zoom}
                        fill={theme === 'dark' ? '#fbbf24' : '#b45309'}
                        fontSize={10 / Math.sqrt(zoom)}
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        SCHEMATIC 33 kV SUBTRANSMISSION CLUSTER (Buses 14–26, 29–30)
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}
          </g>

          {/* 3. Transmission Lines & Transformers */}
          {(network.lines ?? []).map((line) => {
            if (!line || !line.id) return null;
            const fBus = network.buses.find((b) => b && b.number === line.fromBusNumber);
            const tBus = network.buses.find((b) => b && b.number === line.toBusNumber);
            if (!fBus || !tBus) return null;
            if (
              !overlayConfig.expandSchematic33kVCluster &&
              (fBus.geoLocation.coordinateConfidence === 'schematic-subtransmission-cluster' ||
                tBus.geoLocation.coordinateConfidence === 'schematic-subtransmission-cluster')
            ) {
              return null;
            }
            const p1 = busPositions.get(line.fromBusNumber);
            const p2 = busPositions.get(line.toBusNumber);
            if (!p1 || !p2) return null;
            const flow = solution?.lineFlows[line.id];
            const color = getBranchColor(flow, line.status === 'online', line.voltageKv);
            const isSelected =
              selectedElement?.category === 'line' && selectedElement.id === line.id;
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const angleDeg =
              (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
            const forwardFlow = (flow?.pFromMw ?? 0) >= 0;
            const arrowAngle = forwardFlow ? angleDeg : angleDeg + 180;

            return (
              <g
                key={line.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectElement({ category: 'line', id: line.id });
                }}
                className="cursor-pointer"
              >
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={color}
                  strokeWidth={(isSelected ? 4.2 : line.voltageKv >= 132 ? 2.8 : 1.9) / Math.sqrt(zoom)}
                  strokeDasharray={line.status !== 'online' ? `${6 / zoom} ${4 / zoom}` : undefined}
                />
                {overlayConfig.showFlowArrows &&
                  flow?.energized &&
                  Math.abs(flow.pFromMw) > 0.05 && (
                    <g transform={`translate(${midX}, ${midY}) rotate(${arrowAngle})`}>
                      <polygon
                        points={`${6 / Math.sqrt(zoom)},0 ${-5 / Math.sqrt(zoom)},${-4 / Math.sqrt(zoom)} ${-5 / Math.sqrt(zoom)},${4 / Math.sqrt(zoom)}`}
                        fill={color}
                      />
                    </g>
                  )}
                {detailLevel !== 'regional' &&
                  overlayConfig.branchLabelMode !== 'none' &&
                  flow?.energized && (
                    <text
                      x={midX}
                      y={midY - 6 / Math.sqrt(zoom)}
                      textAnchor="middle"
                      fill={theme === 'dark' ? '#e2e8f0' : '#0f172a'}
                      fontSize={9 / Math.sqrt(zoom)}
                      fontFamily="monospace"
                      fontWeight="600"
                    >
                      {overlayConfig.branchLabelMode === 'loading'
                        ? `${flow.loadingPercent.toFixed(0)}%`
                        : `${Math.abs(flow.pFromMw).toFixed(1)} MW`}
                    </text>
                  )}
              </g>
            );
          })}

          {/* 4. Substations / Buses */}
          {(network.buses ?? []).map((bus) => {
            if (!bus || !bus.id || !bus.geoLocation) return null;
            const isSchematic =
              bus.geoLocation.coordinateConfidence === 'schematic-subtransmission-cluster';
            if (!overlayConfig.expandSchematic33kVCluster && isSchematic) {
              return null;
            }
            const pt = busPositions.get(bus.number);
            if (!pt) return null;
            const bSol = solution?.busSolutions[bus.number];
            const isSelected =
              selectedElement?.category === 'bus' && selectedElement.id === bus.id;
            const isHovered = hoveredId === bus.id;

            const hasViolation =
              overlayConfig.highlightViolations &&
              bSol &&
              bSol.voltageViolation !== 'none';

            const radius =
              (bus.baseKv >= 132 ? 8.5 : isSchematic ? 5.5 : 7) / Math.sqrt(zoom);

            return (
              <g
                key={bus.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectElement({ category: 'bus', id: bus.id });
                }}
                onMouseEnter={() => setHoveredId(bus.id)}
                onMouseLeave={() => setHoveredId(null)}
                className="cursor-pointer"
              >
                {(isSelected || isHovered || hasViolation) && (
                  <circle
                    r={radius * 1.75}
                    fill="none"
                    stroke={
                      isSelected
                        ? '#22d3ee'
                        : hasViolation
                        ? '#ef4444'
                        : '#94a3b8'
                    }
                    strokeWidth={2 / Math.sqrt(zoom)}
                    strokeDasharray={isSelected ? undefined : `${3 / zoom} ${2 / zoom}`}
                  />
                )}
                <circle
                  r={radius}
                  fill={
                    !bSol?.energized && solution
                      ? '#475569'
                      : bus.busType === 'slack'
                      ? '#10b981'
                      : bus.busType === 'pv'
                      ? '#06b6d4'
                      : isSchematic
                      ? '#f59e0b'
                      : '#6366f1'
                  }
                  stroke={theme === 'dark' ? '#0f172a' : '#ffffff'}
                  strokeWidth={1.5 / Math.sqrt(zoom)}
                  strokeDasharray={isSchematic ? `${2.5 / zoom} ${1.5 / zoom}` : undefined}
                />

                {/* Label */}
                {(detailLevel !== 'regional' || !isSchematic || isSelected) && (
                  <g transform={`translate(0, ${-radius - 4 / Math.sqrt(zoom)})`}>
                    <text
                      textAnchor="middle"
                      fill={theme === 'dark' ? '#f8fafc' : '#0f172a'}
                      fontSize={(isSchematic ? 8.5 : 10) / Math.sqrt(zoom)}
                      fontFamily="monospace"
                      fontWeight="bold"
                    >
                      {detailLevel === 'regional'
                        ? `${bus.number}:${bus.name.split(' ')[0]}`
                        : `${bus.number}: ${bus.name}`}
                    </text>
                    {detailLevel !== 'regional' && bSol && (
                      <text
                        y={-10 / Math.sqrt(zoom)}
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
                        fontSize={8.5 / Math.sqrt(zoom)}
                        fontFamily="monospace"
                      >
                        {bSol.energized
                          ? `${bSol.vmPu.toFixed(3)} pu ∠${bSol.vaDeg.toFixed(1)}°`
                          : 'DE-ENERGIZED'}
                      </text>
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
