import {
  GeneratorSequenceParameters,
  LineSequenceParameters,
  NetworkSequenceDataset,
  TransformerSequenceParameters,
} from '../types/shortCircuit';
import { PowerNetworkModel } from '../types/network';

/**
 * Benchmark Synchronous Generator and Condenser Short-Circuit Parameters
 * for the IEEE 30-Bus System (100 MVA system base).
 *
 * Grounded in IEEE standard dynamic benchmark parameters (Sauer & Pai 1998,
 * PSAT IEEE 30-bus dynamic library, Anderson "Analysis of Faulted Power Systems").
 *
 * Subtransient reactance X''d on machine base:
 * - Large thermal unit (Gen 1): ~0.20 p.u. on 360 MVA base -> 0.0556 p.u. on 100 MVA base
 * - Hydro unit (Gen 2): ~0.20 p.u. on 140 MVA base -> 0.1429 p.u. on 100 MVA base
 * - Synchronous condensers (C5, C8, C11, C13): ~0.20 p.u. on 100 MVA base -> 0.2000 p.u.
 *
 * Zero-sequence reactance X0: typically ~0.5 * X''d (0.10 p.u. on machine base).
 * Solidly grounded generator neutrals (Rn = 0, Xn = 0).
 */
export const IEEE30_GENERATOR_SEQUENCE_PARAMS: Record<string, GeneratorSequenceParameters> = {
  'GEN-1': {
    generatorId: 'GEN-1',
    busNumber: 1,
    subtransientReactanceXdpPu: 0.0556, // 0.20 * (100 / 360)
    negativeSequenceReactanceX2Pu: 0.0556,
    zeroSequenceReactanceX0Pu: 0.0278,  // 0.10 * (100 / 360)
    neutralGroundingResistanceRnPu: 0.0,
    neutralGroundingReactanceXnPu: 0.0,
    groundingType: 'solidly-grounded',
  },
  'GEN-2': {
    generatorId: 'GEN-2',
    busNumber: 2,
    subtransientReactanceXdpPu: 0.1429, // 0.20 * (100 / 140)
    negativeSequenceReactanceX2Pu: 0.1429,
    zeroSequenceReactanceX0Pu: 0.0714,  // 0.10 * (100 / 140)
    neutralGroundingResistanceRnPu: 0.0,
    neutralGroundingReactanceXnPu: 0.0,
    groundingType: 'solidly-grounded',
  },
  'GEN-5': {
    generatorId: 'GEN-5',
    busNumber: 5,
    subtransientReactanceXdpPu: 0.2000, // 0.20 * (100 / 100)
    negativeSequenceReactanceX2Pu: 0.2000,
    zeroSequenceReactanceX0Pu: 0.1000,  // 0.10 * (100 / 100)
    neutralGroundingResistanceRnPu: 0.0,
    neutralGroundingReactanceXnPu: 0.0,
    groundingType: 'solidly-grounded',
  },
  'GEN-8': {
    generatorId: 'GEN-8',
    busNumber: 8,
    subtransientReactanceXdpPu: 0.2000,
    negativeSequenceReactanceX2Pu: 0.2000,
    zeroSequenceReactanceX0Pu: 0.1000,
    neutralGroundingResistanceRnPu: 0.0,
    neutralGroundingReactanceXnPu: 0.0,
    groundingType: 'solidly-grounded',
  },
  'GEN-11': {
    generatorId: 'GEN-11',
    busNumber: 11,
    subtransientReactanceXdpPu: 0.2000,
    negativeSequenceReactanceX2Pu: 0.2000,
    zeroSequenceReactanceX0Pu: 0.1000,
    neutralGroundingResistanceRnPu: 0.0,
    neutralGroundingReactanceXnPu: 0.0,
    groundingType: 'solidly-grounded',
  },
  'GEN-13': {
    generatorId: 'GEN-13',
    busNumber: 13,
    subtransientReactanceXdpPu: 0.2000,
    negativeSequenceReactanceX2Pu: 0.2000,
    zeroSequenceReactanceX0Pu: 0.1000,
    neutralGroundingResistanceRnPu: 0.0,
    neutralGroundingReactanceXnPu: 0.0,
    groundingType: 'solidly-grounded',
  },
};

/**
 * Benchmark Substation Transformer Sequence & Grounding Configurations
 * for the IEEE 30-Bus System.
 *
 * All 4 transformers connect 132 kV transmission to 33 kV subtransmission.
 * In North American utility practice (including Appalachian Power / AEP 1961),
 * step-down bulk power transformers are configured Delta on the 132 kV high-voltage
 * transmission side and Grounded-Wye on the 33 kV low-voltage distribution side.
 *
 * This provides a zero-sequence ground source for 33 kV ground faults without
 * allowing zero-sequence currents to circulate into the 132 kV bulk transmission system.
 */
export const IEEE30_TRANSFORMER_SEQUENCE_PARAMS: Record<string, TransformerSequenceParameters> = {
  'XFMR-6-9': {
    transformerId: 'XFMR-6-9',
    fromBusNumber: 6,
    toBusNumber: 9,
    connection: 'delta-wye_grounded',
    connectionDescription: 'Delta 132 kV (Bus 6) / Grounded-Wye 33 kV (Bus 9)',
    zeroResistancePu: 0.0,
    zeroReactancePu: 0.2080,
  },
  'XFMR-6-10': {
    transformerId: 'XFMR-6-10',
    fromBusNumber: 6,
    toBusNumber: 10,
    connection: 'delta-wye_grounded',
    connectionDescription: 'Delta 132 kV (Bus 6) / Grounded-Wye 33 kV (Bus 10)',
    zeroResistancePu: 0.0,
    zeroReactancePu: 0.5560,
  },
  'XFMR-4-12': {
    transformerId: 'XFMR-4-12',
    fromBusNumber: 4,
    toBusNumber: 12,
    connection: 'delta-wye_grounded',
    connectionDescription: 'Delta 132 kV (Bus 4) / Grounded-Wye 33 kV (Bus 12)',
    zeroResistancePu: 0.0,
    zeroReactancePu: 0.2560,
  },
  'XFMR-28-27': {
    transformerId: 'XFMR-28-27',
    fromBusNumber: 28,
    toBusNumber: 27,
    connection: 'delta-wye_grounded',
    connectionDescription: 'Delta 132 kV (Bus 28) / Grounded-Wye 33 kV (Bus 27)',
    zeroResistancePu: 0.0,
    zeroReactancePu: 0.3960,
  },
};

/**
 * Derives zero-sequence parameters for a transmission line from its positive-sequence parameters.
 * Uses IEEE standard Carson-line earth return approximation:
 * - X0 / X1 = 3.0 (typical overhead line with earth return path)
 * - R0 / R1 = 3.0
 * - B0 / B1 = 0.5 (reduced capacitance to ground relative to inter-phase capacitance)
 */
export function deriveLineZeroSequenceParams(
  lineId: string,
  fromBus: number,
  toBus: number,
  r1: number,
  x1: number,
  b1: number
): LineSequenceParameters {
  const r0ToR1Ratio = 3.0;
  const x0ToX1Ratio = 3.0;
  const b0ToB1Ratio = 0.5;

  return {
    lineId,
    fromBusNumber: fromBus,
    toBusNumber: toBus,
    zeroResistancePu: r1 * r0ToR1Ratio,
    zeroReactancePu: x1 * x0ToX1Ratio,
    zeroSusceptancePu: b1 * b0ToB1Ratio,
    r0ToR1Ratio,
    x0ToX1Ratio,
  };
}

/**
 * Assembles the authoritative IEEE 30-bus sequence dataset for the current network.
 */
export function getIeee30SequenceDataset(network: PowerNetworkModel): NetworkSequenceDataset {
  const lines: Record<string, LineSequenceParameters> = {};

  for (const line of network.lines) {
    lines[line.id] = deriveLineZeroSequenceParams(
      line.id,
      line.fromBusNumber,
      line.toBusNumber,
      line.resistancePu,
      line.reactancePu,
      line.chargingSusceptancePu
    );
  }

  return {
    generators: { ...IEEE30_GENERATOR_SEQUENCE_PARAMS },
    lines,
    transformers: { ...IEEE30_TRANSFORMER_SEQUENCE_PARAMS },
    metadata: {
      source: 'IEEE 30-Bus Dynamic & Short-Circuit Extension (Sauer & Pai 1998, PSAT, IEEE Std 399)',
      documentation: [
        'Generator subtransient reactances X"d calibrated on machine MVA bases and converted to 100 MVA system base.',
        'Substation step-down transformers (132 kV to 33 kV) modeled as Delta on 132 kV side and Grounded-Wye on 33 kV side.',
        'Transmission line zero-sequence parameters derived using standard IEEE Carson ground return ratio X0/X1 = 3.0, R0/R1 = 3.0, B0/B1 = 0.5.',
        'All synchronous machine neutrals modeled as solidly grounded (Rn = 0, Xn = 0).',
      ],
      assumptions: [
        'Negative-sequence impedances equal positive-sequence subtransient impedances (Z2 = Z1) for static branches and synchronous machines.',
        'Zero-sequence current is confined to Grounded-Wye transformer windings, grounded generator neutrals, and lines with return paths.',
        'Subtransmission Delta windings isolate zero-sequence current from propagating between 132 kV and 33 kV tiers.',
      ],
    },
  };
}
