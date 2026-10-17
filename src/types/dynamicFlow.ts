import { BranchFlowSolution } from './network';

export type FlowAnimationMode = 'animated' | 'static';
export type FlowSpeedMultiplier = 0.5 | 1.0 | 2.0;

export interface DynamicFlowConfig {
  isPlaying: boolean;
  animationMode: FlowAnimationMode;
  speedMultiplier: FlowSpeedMultiplier;
  showBranchTelemetry: boolean;
  minFlowThresholdMw: number;
}

export const DEFAULT_DYNAMIC_FLOW_CONFIG: DynamicFlowConfig = {
  isPlaying: true,
  animationMode: 'animated',
  speedMultiplier: 1.0,
  showBranchTelemetry: true,
  minFlowThresholdMw: 0.05,
};

export type BranchFlowDirection = 'forward' | 'reverse' | 'zero';

export interface BranchDynamicFlowState {
  branchId: string;
  category: 'line' | 'transformer';
  fromBusNumber: number;
  toBusNumber: number;
  inService: boolean;
  energized: boolean;
  activePowerMw: number;
  reactivePowerMvar: number;
  apparentPowerMva: number;
  ratingMva: number;
  loadingPercent: number;
  isOverloaded: boolean;
  flowDirection: BranchFlowDirection;
  /** Description e.g. "B1 -> B2" or "B2 -> B1" or "Near Zero" */
  flowDirectionLabel: string;
  /** Speed scaling factor for animation (0.3 to 3.0) */
  speedScale: number;
  /** Animation duration in seconds (clamped between 0.6s and 4.0s) */
  animationDurationSec: number;
  /** Color encoding thermal loading */
  loadingColor: string;
}

/**
 * Derives the active flow direction and dynamic animation parameters for a branch
 * from genuine AC power-flow solution data.
 *
 * Sign convention:
 * - pFromMw is power injected into the branch at the fromBus terminal.
 * - If pFromMw > minThresholdMw: power flows from fromBus to toBus ('forward').
 * - If pFromMw < -minThresholdMw: power flows from toBus to fromBus ('reverse').
 * - If |pFromMw| <= minThresholdMw: active power is negligible / balanced ('zero').
 */
export function deriveBranchDynamicFlowState(
  branchId: string,
  category: 'line' | 'transformer',
  fromBusNumber: number,
  toBusNumber: number,
  ratingMva: number,
  flow: BranchFlowSolution | undefined,
  config: DynamicFlowConfig = DEFAULT_DYNAMIC_FLOW_CONFIG
): BranchDynamicFlowState {
  if (!flow || !flow.inService || !flow.energized) {
    return {
      branchId,
      category,
      fromBusNumber,
      toBusNumber,
      inService: flow?.inService ?? false,
      energized: false,
      activePowerMw: 0,
      reactivePowerMvar: 0,
      apparentPowerMva: 0,
      ratingMva,
      loadingPercent: 0,
      isOverloaded: false,
      flowDirection: 'zero',
      flowDirectionLabel: 'De-Energized / Offline',
      speedScale: 0,
      animationDurationSec: 0,
      loadingColor: '#64748b', // Muted slate for offline
    };
  }

  const pFrom = flow.pFromMw;
  const absP = Math.abs(pFrom);
  const threshold = config.minFlowThresholdMw;

  let flowDirection: BranchFlowDirection = 'zero';
  let flowDirectionLabel = 'Zero Active Flow';

  if (absP > threshold) {
    if (pFrom > 0) {
      flowDirection = 'forward';
      flowDirectionLabel = `B${fromBusNumber} → B${toBusNumber}`;
    } else {
      flowDirection = 'reverse';
      flowDirectionLabel = `B${toBusNumber} → B${fromBusNumber}`;
    }
  }

  // Apparent flow and loading % from solver
  const sMva = flow.maxApparentFlowMva;
  const loadingPct = ratingMva > 0 ? (sMva / ratingMva) * 100 : flow.loadingPercent;
  const isOverloaded = loadingPct > 100.0;

  // Normalized speed scale based on active power MW (reference 30 MW = 1.0x baseline)
  // Clamped between 0.35 and 2.8
  const speedScale = Math.min(2.8, Math.max(0.35, Math.sqrt(absP / 18)));
  const baseDurationSec = 1.8;
  const animationDurationSec =
    flowDirection === 'zero'
      ? 0
      : Number((baseDurationSec / (speedScale * config.speedMultiplier)).toFixed(2));

  // Color encoding: loading threshold
  let loadingColor = '#10b981'; // Normal < 70% (Emerald)
  if (isOverloaded) {
    loadingColor = '#ef4444'; // Overload > 100% (Red)
  } else if (loadingPct >= 90) {
    loadingColor = '#f97316'; // High 90-100% (Orange)
  } else if (loadingPct >= 70) {
    loadingColor = '#f59e0b'; // Elevated 70-90% (Amber)
  }

  return {
    branchId,
    category,
    fromBusNumber,
    toBusNumber,
    inService: true,
    energized: true,
    activePowerMw: Number(absP.toFixed(2)),
    reactivePowerMvar: Number(flow.qFromMvar.toFixed(2)),
    apparentPowerMva: Number(sMva.toFixed(2)),
    ratingMva,
    loadingPercent: Number(loadingPct.toFixed(1)),
    isOverloaded,
    flowDirection,
    flowDirectionLabel,
    speedScale: Number(speedScale.toFixed(2)),
    animationDurationSec,
    loadingColor,
  };
}
