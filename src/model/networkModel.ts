import {
  NetworkBus,
  NetworkGenerator,
  NetworkLoad,
  NetworkShunt,
  NetworkTransformer,
  NetworkTransmissionLine,
  PowerNetworkModel,
  SelectedNetworkElement,
  SimulatorOverlayConfig,
} from '../types/network';

export const DEFAULT_OVERLAY_CONFIG: SimulatorOverlayConfig = {
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
};

export const DEFAULT_SELECTED_NETWORK_ELEMENT: SelectedNetworkElement = {
  category: 'bus',
  id: 'BUS-1',
};

interface RawBusDef {
  num: number;
  name: string;
  substation: string;
  area: 1 | 2 | 3;
  type: 'slack' | 'pv' | 'pq';
  baseKv: number;
  refVm: number;
  refVa: number;
  pdMw: number;
  qdMvar: number;
  bsMvar: number;
  oneLineX: number;
  oneLineY: number;
  orientation: 'horizontal' | 'vertical';
  length: number;
  lat: number;
  lon: number;
  confidence: 'verified-historical-substation' | 'schematic-subtransmission-cluster';
  locNote: string;
  parentSubBus?: number;
}

const RAW_BUSES: RawBusDef[] = [
  {
    num: 1,
    name: 'Glen Lyn 132',
    substation: 'Glen Lyn Generating Station',
    area: 1,
    type: 'slack',
    baseKv: 132,
    refVm: 1.06,
    refVa: 0.0,
    pdMw: 0,
    qdMvar: 0,
    bsMvar: 0,
    oneLineX: 150,
    oneLineY: 820,
    orientation: 'horizontal',
    length: 76,
    lat: 37.3719,
    lon: -80.8617,
    confidence: 'verified-historical-substation',
    locNote: 'AEP Glen Lyn Plant on the New River, Giles County, VA (132 kV Slack Bus).',
  },
  {
    num: 2,
    name: 'Claytor 132',
    substation: 'Claytor Hydroelectric Station',
    area: 1,
    type: 'pv',
    baseKv: 132,
    refVm: 1.043,
    refVa: -5.48,
    pdMw: 21.7,
    qdMvar: 12.7,
    bsMvar: 0,
    oneLineX: 370,
    oneLineY: 820,
    orientation: 'horizontal',
    length: 84,
    lat: 37.0753,
    lon: -80.5861,
    confidence: 'verified-historical-substation',
    locNote: 'AEP Claytor Dam & Hydroelectric Substation, Pulaski County, VA (132 kV).',
  },
  {
    num: 3,
    name: 'Kumis 132',
    substation: 'Kumis 132 kV Substation',
    area: 1,
    type: 'pq',
    baseKv: 132,
    refVm: 1.021,
    refVa: -7.96,
    pdMw: 2.4,
    qdMvar: 1.2,
    bsMvar: 0,
    oneLineX: 260,
    oneLineY: 660,
    orientation: 'horizontal',
    length: 68,
    lat: 37.245,
    lon: -80.1786,
    confidence: 'verified-historical-substation',
    locNote: 'AEP Kumis Switching & Load Substation, western Roanoke County, VA (132 kV).',
  },
  {
    num: 4,
    name: 'Hancock 132',
    substation: 'Hancock Substation (132 kV)',
    area: 1,
    type: 'pq',
    baseKv: 132,
    refVm: 1.012,
    refVa: -9.62,
    pdMw: 7.6,
    qdMvar: 1.6,
    bsMvar: 0,
    oneLineX: 430,
    oneLineY: 610,
    orientation: 'horizontal',
    length: 84,
    lat: 37.3022,
    lon: -79.9583,
    confidence: 'verified-historical-substation',
    locNote: 'AEP Hancock 132/33 kV Substation, north Roanoke, VA (132 kV High Side).',
  },
  {
    num: 5,
    name: 'Fieldale 132',
    substation: 'Fieldale Substation',
    area: 1,
    type: 'pv',
    baseKv: 132,
    refVm: 1.01,
    refVa: -14.37,
    pdMw: 94.2,
    qdMvar: 19.0,
    bsMvar: 0,
    oneLineX: 640,
    oneLineY: 880,
    orientation: 'horizontal',
    length: 78,
    lat: 36.7022,
    lon: -79.9369,
    confidence: 'verified-historical-substation',
    locNote: 'AEP Fieldale Industrial Load & Synchronous Condenser Station, Henry County, VA (132 kV).',
  },
  {
    num: 6,
    name: 'Roanoke 132',
    substation: 'Roanoke Bulk Substation (132 kV)',
    area: 1,
    type: 'pq',
    baseKv: 132,
    refVm: 1.01,
    refVa: -11.34,
    pdMw: 0,
    qdMvar: 0,
    bsMvar: 0,
    oneLineX: 770,
    oneLineY: 630,
    orientation: 'horizontal',
    length: 110,
    lat: 37.2636,
    lon: -79.9219,
    confidence: 'verified-historical-substation',
    locNote: 'AEP Roanoke Main 132 kV Switching Hub, Roanoke, VA (6-branch EHV hub).',
  },
  {
    num: 7,
    name: 'Blaine 132',
    substation: 'Blaine Substation',
    area: 1,
    type: 'pq',
    baseKv: 132,
    refVm: 1.002,
    refVa: -13.12,
    pdMw: 22.8,
    qdMvar: 10.9,
    bsMvar: 0,
    oneLineX: 770,
    oneLineY: 790,
    orientation: 'horizontal',
    length: 72,
    lat: 37.235,
    lon: -79.935,
    confidence: 'verified-historical-substation',
    locNote: 'AEP Blaine 132 kV Substation serving south Roanoke industrial corridor, VA.',
  },
  {
    num: 8,
    name: 'Reusens 132',
    substation: 'Reusens Hydroelectric Station',
    area: 1,
    type: 'pv',
    baseKv: 132,
    refVm: 1.01,
    refVa: -12.1,
    pdMw: 30.0,
    qdMvar: 30.0,
    bsMvar: 0,
    oneLineX: 1120,
    oneLineY: 740,
    orientation: 'horizontal',
    length: 78,
    lat: 37.4608,
    lon: -79.1889,
    confidence: 'verified-historical-substation',
    locNote: 'AEP Reusens Hydro Station on the James River, Lynchburg, VA (132 kV).',
  },
  {
    num: 9,
    name: 'Roanoke 1.0',
    substation: 'Roanoke 3-Winding Star Bus',
    area: 3,
    type: 'pq',
    baseKv: 1.0,
    refVm: 1.051,
    refVa: -14.38,
    pdMw: 0,
    qdMvar: 0,
    bsMvar: 0,
    oneLineX: 830,
    oneLineY: 485,
    orientation: 'horizontal',
    length: 62,
    lat: 37.269,
    lon: -79.908,
    confidence: 'verified-historical-substation',
    locNote: 'Roanoke 132/33/11 kV 3-winding transformer equivalent star-point node (1.0 kV base in ieee30cdf.txt).',
    parentSubBus: 6,
  },
  {
    num: 10,
    name: 'Roanoke 33',
    substation: 'Roanoke Substation (33 kV)',
    area: 3,
    type: 'pq',
    baseKv: 33,
    refVm: 1.045,
    refVa: -15.97,
    pdMw: 5.8,
    qdMvar: 2.0,
    bsMvar: 19.0,
    oneLineX: 770,
    oneLineY: 365,
    orientation: 'horizontal',
    length: 115,
    lat: 37.274,
    lon: -79.9219,
    confidence: 'verified-historical-substation',
    locNote: 'Roanoke 33 kV Subtransmission Distribution Busbar with +19 MVAr Shunt Capacitor Bank.',
    parentSubBus: 6,
  },
  {
    num: 11,
    name: 'Roanoke 11',
    substation: 'Roanoke Condenser Terminal (11 kV)',
    area: 3,
    type: 'pv',
    baseKv: 11,
    refVm: 1.082,
    refVa: -14.39,
    pdMw: 0,
    qdMvar: 0,
    bsMvar: 0,
    oneLineX: 985,
    oneLineY: 485,
    orientation: 'vertical',
    length: 56,
    lat: 37.269,
    lon: -79.892,
    confidence: 'verified-historical-substation',
    locNote: 'Roanoke 11 kV tertiary synchronous condenser voltage-support terminal.',
    parentSubBus: 6,
  },
  {
    num: 12,
    name: 'Hancock 33',
    substation: 'Hancock Substation (33 kV)',
    area: 2,
    type: 'pq',
    baseKv: 33,
    refVm: 1.057,
    refVa: -15.24,
    pdMw: 11.2,
    qdMvar: 7.5,
    bsMvar: 0,
    oneLineX: 430,
    oneLineY: 390,
    orientation: 'horizontal',
    length: 105,
    lat: 37.312,
    lon: -79.9583,
    confidence: 'verified-historical-substation',
    locNote: 'Hancock 33 kV Subtransmission Busbar feeding western Roanoke 33 kV loop.',
    parentSubBus: 4,
  },
  {
    num: 13,
    name: 'Hancock 11',
    substation: 'Hancock Condenser Terminal (11 kV)',
    area: 2,
    type: 'pv',
    baseKv: 11,
    refVm: 1.071,
    refVa: -15.24,
    pdMw: 0,
    qdMvar: 0,
    bsMvar: 0,
    oneLineX: 250,
    oneLineY: 390,
    orientation: 'vertical',
    length: 56,
    lat: 37.312,
    lon: -79.982,
    confidence: 'verified-historical-substation',
    locNote: 'Hancock 11 kV synchronous condenser busbar regulating western 33 kV voltages.',
    parentSubBus: 4,
  },
  {
    num: 14,
    name: 'Bus 14 33',
    substation: 'Roanoke West Feeder 14 (Schematic)',
    area: 2,
    type: 'pq',
    baseKv: 33,
    refVm: 1.042,
    refVa: -16.13,
    pdMw: 6.2,
    qdMvar: 1.6,
    bsMvar: 0,
    oneLineX: 230,
    oneLineY: 250,
    orientation: 'horizontal',
    length: 64,
    lat: 37.345,
    lon: -80.045,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV subtransmission bus in ieee30cdf.txt (schematically positioned relative to Hancock 33 kV).',
    parentSubBus: 12,
  },
  {
    num: 15,
    name: 'Bus 15 33',
    substation: 'Roanoke West Feeder 15 (Schematic)',
    area: 2,
    type: 'pq',
    baseKv: 33,
    refVm: 1.038,
    refVa: -16.22,
    pdMw: 8.2,
    qdMvar: 2.5,
    bsMvar: 0,
    oneLineX: 390,
    oneLineY: 225,
    orientation: 'horizontal',
    length: 76,
    lat: 37.365,
    lon: -80.005,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV subtransmission junction in ieee30cdf.txt (schematically positioned relative to Hancock 33 kV).',
    parentSubBus: 12,
  },
  {
    num: 16,
    name: 'Bus 16 33',
    substation: 'Roanoke Central Feeder 16 (Schematic)',
    area: 2,
    type: 'pq',
    baseKv: 33,
    refVm: 1.045,
    refVa: -15.83,
    pdMw: 3.5,
    qdMvar: 1.8,
    bsMvar: 0,
    oneLineX: 555,
    oneLineY: 280,
    orientation: 'horizontal',
    length: 64,
    lat: 37.322,
    lon: -79.938,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV tie feeder bus between Hancock 33 kV and Roanoke 33 kV in ieee30cdf.txt.',
    parentSubBus: 12,
  },
  {
    num: 17,
    name: 'Bus 17 33',
    substation: 'Roanoke Central Feeder 17 (Schematic)',
    area: 2,
    type: 'pq',
    baseKv: 33,
    refVm: 1.04,
    refVa: -16.14,
    pdMw: 9.0,
    qdMvar: 5.8,
    bsMvar: 0,
    oneLineX: 675,
    oneLineY: 280,
    orientation: 'horizontal',
    length: 64,
    lat: 37.305,
    lon: -79.925,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV load bus in ieee30cdf.txt connecting Bus 16 and Roanoke 33 kV (Bus 10).',
    parentSubBus: 10,
  },
  {
    num: 18,
    name: 'Bus 18 33',
    substation: 'Roanoke North Loop 18 (Schematic)',
    area: 2,
    type: 'pq',
    baseKv: 33,
    refVm: 1.028,
    refVa: -16.82,
    pdMw: 3.2,
    qdMvar: 0.9,
    bsMvar: 0,
    oneLineX: 470,
    oneLineY: 125,
    orientation: 'horizontal',
    length: 64,
    lat: 37.392,
    lon: -79.978,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV loop bus in ieee30cdf.txt (Bus 15 – Bus 18 – Bus 19 – Bus 20 – Bus 10).',
    parentSubBus: 12,
  },
  {
    num: 19,
    name: 'Bus 19 33',
    substation: 'Roanoke North Loop 19 (Schematic)',
    area: 2,
    type: 'pq',
    baseKv: 33,
    refVm: 1.026,
    refVa: -17.0,
    pdMw: 9.5,
    qdMvar: 3.4,
    bsMvar: 0,
    oneLineX: 615,
    oneLineY: 125,
    orientation: 'horizontal',
    length: 64,
    lat: 37.388,
    lon: -79.948,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV loop load bus in ieee30cdf.txt.',
    parentSubBus: 10,
  },
  {
    num: 20,
    name: 'Bus 20 33',
    substation: 'Roanoke North Loop 20 (Schematic)',
    area: 2,
    type: 'pq',
    baseKv: 33,
    refVm: 1.03,
    refVa: -16.8,
    pdMw: 2.2,
    qdMvar: 0.7,
    bsMvar: 0,
    oneLineX: 745,
    oneLineY: 165,
    orientation: 'horizontal',
    length: 64,
    lat: 37.358,
    lon: -79.922,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV loop bus returning to Roanoke 33 kV (Bus 10) in ieee30cdf.txt.',
    parentSubBus: 10,
  },
  {
    num: 21,
    name: 'Bus 21 33',
    substation: 'Roanoke East Feeder 21 (Schematic)',
    area: 3,
    type: 'pq',
    baseKv: 33,
    refVm: 1.033,
    refVa: -16.42,
    pdMw: 17.5,
    qdMvar: 11.2,
    bsMvar: 0,
    oneLineX: 905,
    oneLineY: 265,
    orientation: 'horizontal',
    length: 68,
    lat: 37.295,
    lon: -79.885,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV heavy load bus fed from Roanoke 33 kV (Bus 10) in ieee30cdf.txt.',
    parentSubBus: 10,
  },
  {
    num: 22,
    name: 'Bus 22 33',
    substation: 'Roanoke East Junction 22 (Schematic)',
    area: 3,
    type: 'pq',
    baseKv: 33,
    refVm: 1.033,
    refVa: -16.41,
    pdMw: 0,
    qdMvar: 0,
    bsMvar: 0,
    oneLineX: 965,
    oneLineY: 345,
    orientation: 'horizontal',
    length: 68,
    lat: 37.308,
    lon: -79.865,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV switching junction linking Bus 10, Bus 21, and Bus 24 in ieee30cdf.txt.',
    parentSubBus: 10,
  },
  {
    num: 23,
    name: 'Bus 23 33',
    substation: 'Cross-Valley Tie 23 (Schematic)',
    area: 2,
    type: 'pq',
    baseKv: 33,
    refVm: 1.027,
    refVa: -16.61,
    pdMw: 3.2,
    qdMvar: 1.6,
    bsMvar: 0,
    oneLineX: 585,
    oneLineY: 195,
    orientation: 'horizontal',
    length: 64,
    lat: 37.362,
    lon: -79.962,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV tie bus linking Bus 15 and Bus 24 in ieee30cdf.txt.',
    parentSubBus: 12,
  },
  {
    num: 24,
    name: 'Bus 24 33',
    substation: 'Central 33 kV Shunt Hub 24 (Schematic)',
    area: 3,
    type: 'pq',
    baseKv: 33,
    refVm: 1.021,
    refVa: -16.78,
    pdMw: 8.7,
    qdMvar: 6.7,
    bsMvar: 4.3,
    oneLineX: 965,
    oneLineY: 195,
    orientation: 'horizontal',
    length: 78,
    lat: 37.338,
    lon: -79.878,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV load & +4.3 MVAr capacitor bank bus in ieee30cdf.txt.',
    parentSubBus: 27,
  },
  {
    num: 25,
    name: 'Bus 25 33',
    substation: 'Botetourt 33 kV Junction 25 (Schematic)',
    area: 3,
    type: 'pq',
    baseKv: 33,
    refVm: 1.017,
    refVa: -16.35,
    pdMw: 0,
    qdMvar: 0,
    bsMvar: 0,
    oneLineX: 1140,
    oneLineY: 225,
    orientation: 'horizontal',
    length: 68,
    lat: 37.355,
    lon: -79.895,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV junction feeding radial Bus 26 and linking to Cloverdale 33 kV (Bus 27).',
    parentSubBus: 27,
  },
  {
    num: 26,
    name: 'Bus 26 33',
    substation: 'Radial Feeder 26 (Schematic)',
    area: 3,
    type: 'pq',
    baseKv: 33,
    refVm: 1.0,
    refVa: -16.77,
    pdMw: 3.5,
    qdMvar: 2.3,
    bsMvar: 0,
    oneLineX: 1140,
    oneLineY: 115,
    orientation: 'horizontal',
    length: 64,
    lat: 37.382,
    lon: -79.865,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV radial load bus fed solely via Line 25–26 in ieee30cdf.txt.',
    parentSubBus: 27,
  },
  {
    num: 27,
    name: 'Cloverdle 33',
    substation: 'Cloverdale Substation (33 kV)',
    area: 3,
    type: 'pq',
    baseKv: 33,
    refVm: 1.023,
    refVa: -15.82,
    pdMw: 0,
    qdMvar: 0,
    bsMvar: 0,
    oneLineX: 1245,
    oneLineY: 365,
    orientation: 'horizontal',
    length: 92,
    lat: 37.372,
    lon: -79.9144,
    confidence: 'verified-historical-substation',
    locNote: 'AEP Cloverdale 33 kV Subtransmission Busbar, Botetourt County, VA.',
    parentSubBus: 28,
  },
  {
    num: 28,
    name: 'Cloverdle132',
    substation: 'Cloverdale Bulk Substation (132 kV)',
    area: 1,
    type: 'pq',
    baseKv: 132,
    refVm: 1.007,
    refVa: -11.97,
    pdMw: 0,
    qdMvar: 0,
    bsMvar: 0,
    oneLineX: 1245,
    oneLineY: 610,
    orientation: 'horizontal',
    length: 92,
    lat: 37.3675,
    lon: -79.9144,
    confidence: 'verified-historical-substation',
    locNote: 'AEP Cloverdale 132 kV Substation in Botetourt County, VA (interconnecting Roanoke, Reusens, and Cloverdale 33 kV).',
  },
  {
    num: 29,
    name: 'Bus 29 33',
    substation: 'Botetourt North Loop 29 (Schematic)',
    area: 3,
    type: 'pq',
    baseKv: 33,
    refVm: 1.003,
    refVa: -17.06,
    pdMw: 2.4,
    qdMvar: 0.9,
    bsMvar: 0,
    oneLineX: 1410,
    oneLineY: 235,
    orientation: 'horizontal',
    length: 68,
    lat: 37.405,
    lon: -79.895,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV loop bus fed from Cloverdale 33 kV (Bus 27) in ieee30cdf.txt.',
    parentSubBus: 27,
  },
  {
    num: 30,
    name: 'Bus 30 33',
    substation: 'Botetourt Remote Loop 30 (Schematic)',
    area: 3,
    type: 'pq',
    baseKv: 33,
    refVm: 0.992,
    refVa: -17.94,
    pdMw: 10.6,
    qdMvar: 1.9,
    bsMvar: 0,
    oneLineX: 1445,
    oneLineY: 365,
    orientation: 'horizontal',
    length: 68,
    lat: 37.415,
    lon: -79.855,
    confidence: 'schematic-subtransmission-cluster',
    locNote: 'Unnamed 33 kV remote load bus (lowest nominal voltage bus in IEEE 30-Bus system: 0.992 p.u.).',
    parentSubBus: 27,
  },
];

interface RawBranchDef {
  idx: number;
  fbus: number;
  tbus: number;
  r: number;
  x: number;
  b: number;
  rateA: number;
  tap: number;
}

/**
 * All 41 branches from UW IEEE 30-Bus Common Data Format (ieee30cdf.txt)
 * paired with Alsac & Stott (1974) / MATPOWER case30.m thermal MVA limits (rateA).
 */
const RAW_BRANCHES: RawBranchDef[] = [
  { idx: 1, fbus: 1, tbus: 2, r: 0.0192, x: 0.0575, b: 0.0528, rateA: 130, tap: 0 },
  { idx: 2, fbus: 1, tbus: 3, r: 0.0452, x: 0.1652, b: 0.0408, rateA: 130, tap: 0 },
  { idx: 3, fbus: 2, tbus: 4, r: 0.057, x: 0.1737, b: 0.0368, rateA: 65, tap: 0 },
  { idx: 4, fbus: 3, tbus: 4, r: 0.0132, x: 0.0379, b: 0.0084, rateA: 130, tap: 0 },
  { idx: 5, fbus: 2, tbus: 5, r: 0.0472, x: 0.1983, b: 0.0418, rateA: 130, tap: 0 },
  { idx: 6, fbus: 2, tbus: 6, r: 0.0581, x: 0.1763, b: 0.0374, rateA: 65, tap: 0 },
  { idx: 7, fbus: 4, tbus: 6, r: 0.0119, x: 0.0414, b: 0.009, rateA: 90, tap: 0 },
  { idx: 8, fbus: 5, tbus: 7, r: 0.046, x: 0.116, b: 0.0204, rateA: 70, tap: 0 },
  { idx: 9, fbus: 6, tbus: 7, r: 0.0267, x: 0.082, b: 0.017, rateA: 130, tap: 0 },
  { idx: 10, fbus: 6, tbus: 8, r: 0.012, x: 0.042, b: 0.009, rateA: 32, tap: 0 },
  { idx: 11, fbus: 6, tbus: 9, r: 0.0, x: 0.208, b: 0.0, rateA: 65, tap: 0.978 },
  { idx: 12, fbus: 6, tbus: 10, r: 0.0, x: 0.556, b: 0.0, rateA: 32, tap: 0.969 },
  { idx: 13, fbus: 9, tbus: 11, r: 0.0, x: 0.208, b: 0.0, rateA: 65, tap: 1.0 },
  { idx: 14, fbus: 9, tbus: 10, r: 0.0, x: 0.11, b: 0.0, rateA: 65, tap: 1.0 },
  { idx: 15, fbus: 4, tbus: 12, r: 0.0, x: 0.256, b: 0.0, rateA: 65, tap: 0.932 },
  { idx: 16, fbus: 12, tbus: 13, r: 0.0, x: 0.14, b: 0.0, rateA: 65, tap: 1.0 },
  { idx: 17, fbus: 12, tbus: 14, r: 0.1231, x: 0.2559, b: 0.0, rateA: 32, tap: 0 },
  { idx: 18, fbus: 12, tbus: 15, r: 0.0662, x: 0.1304, b: 0.0, rateA: 32, tap: 0 },
  { idx: 19, fbus: 12, tbus: 16, r: 0.0945, x: 0.1987, b: 0.0, rateA: 32, tap: 0 },
  { idx: 20, fbus: 14, tbus: 15, r: 0.221, x: 0.1997, b: 0.0, rateA: 16, tap: 0 },
  { idx: 21, fbus: 16, tbus: 17, r: 0.0524, x: 0.1923, b: 0.0, rateA: 16, tap: 0 },
  { idx: 22, fbus: 15, tbus: 18, r: 0.1073, x: 0.2185, b: 0.0, rateA: 16, tap: 0 },
  { idx: 23, fbus: 18, tbus: 19, r: 0.0639, x: 0.1292, b: 0.0, rateA: 16, tap: 0 },
  { idx: 24, fbus: 19, tbus: 20, r: 0.034, x: 0.068, b: 0.0, rateA: 32, tap: 0 },
  { idx: 25, fbus: 10, tbus: 20, r: 0.0936, x: 0.209, b: 0.0, rateA: 32, tap: 0 },
  { idx: 26, fbus: 10, tbus: 17, r: 0.0324, x: 0.0845, b: 0.0, rateA: 32, tap: 0 },
  { idx: 27, fbus: 10, tbus: 21, r: 0.0348, x: 0.0749, b: 0.0, rateA: 32, tap: 0 },
  { idx: 28, fbus: 10, tbus: 22, r: 0.0727, x: 0.1499, b: 0.0, rateA: 32, tap: 0 },
  { idx: 29, fbus: 21, tbus: 22, r: 0.0116, x: 0.0236, b: 0.0, rateA: 32, tap: 0 },
  { idx: 30, fbus: 15, tbus: 23, r: 0.1, x: 0.202, b: 0.0, rateA: 16, tap: 0 },
  { idx: 31, fbus: 22, tbus: 24, r: 0.115, x: 0.179, b: 0.0, rateA: 16, tap: 0 },
  { idx: 32, fbus: 23, tbus: 24, r: 0.132, x: 0.27, b: 0.0, rateA: 16, tap: 0 },
  { idx: 33, fbus: 24, tbus: 25, r: 0.1885, x: 0.3292, b: 0.0, rateA: 16, tap: 0 },
  { idx: 34, fbus: 25, tbus: 26, r: 0.2544, x: 0.38, b: 0.0, rateA: 16, tap: 0 },
  { idx: 35, fbus: 25, tbus: 27, r: 0.1093, x: 0.2087, b: 0.0, rateA: 16, tap: 0 },
  { idx: 36, fbus: 28, tbus: 27, r: 0.0, x: 0.396, b: 0.0, rateA: 65, tap: 0.968 },
  { idx: 37, fbus: 27, tbus: 29, r: 0.2198, x: 0.4153, b: 0.0, rateA: 16, tap: 0 },
  { idx: 38, fbus: 27, tbus: 30, r: 0.3202, x: 0.6027, b: 0.0, rateA: 16, tap: 0 },
  { idx: 39, fbus: 29, tbus: 30, r: 0.2399, x: 0.4533, b: 0.0, rateA: 16, tap: 0 },
  { idx: 40, fbus: 8, tbus: 28, r: 0.0636, x: 0.2, b: 0.0428, rateA: 32, tap: 0 },
  { idx: 41, fbus: 6, tbus: 28, r: 0.0169, x: 0.0599, b: 0.013, rateA: 32, tap: 0 },
];

const AREA_NAMES: Record<1 | 2 | 3, string> = {
  1: 'Area 1: 132 kV Bulk Transmission Corridor',
  2: 'Area 2: Hancock–Roanoke 33 kV West Loop',
  3: 'Area 3: Roanoke–Cloverdale 33 kV East Network',
};

function createInitialIeee30Model(): PowerNetworkModel {
  const generators: NetworkGenerator[] = [
    {
      id: 'GEN-1',
      name: 'Gen G1 (Glen Lyn 132 kV Slack)',
      busId: 'BUS-1',
      busNumber: 1,
      unitType: 'Synchronous Generator',
      controlMode: 'Slack / Reference',
      status: 'online',
      ratedMva: 360.2,
      ratedKv: 132,
      scheduledActivePowerMw: 260.2,
      activePowerMinMw: 0,
      activePowerMaxMw: 360.2,
      voltageSetpointPu: 1.06,
      reactivePowerMinMvar: -40,
      reactivePowerMaxMvar: 150,
      publishedReferenceOutput: {
        pMw: 260.96,
        qMvar: -17.02,
      },
    },
    {
      id: 'GEN-2',
      name: 'Gen G2 (Claytor 132 kV Hydro)',
      busId: 'BUS-2',
      busNumber: 2,
      unitType: 'Synchronous Generator',
      controlMode: 'Voltage-Controlled (PV)',
      status: 'online',
      ratedMva: 140.0,
      ratedKv: 132,
      scheduledActivePowerMw: 40.0,
      activePowerMinMw: 0,
      activePowerMaxMw: 140.0,
      voltageSetpointPu: 1.043,
      reactivePowerMinMvar: -40,
      reactivePowerMaxMvar: 50,
      publishedReferenceOutput: {
        pMw: 40.0,
        qMvar: 48.82,
      },
    },
    {
      id: 'GEN-5',
      name: 'Sync Condenser C5 (Fieldale 132 kV)',
      busId: 'BUS-5',
      busNumber: 5,
      unitType: 'Synchronous Condenser',
      controlMode: 'Voltage-Controlled (PV)',
      status: 'online',
      ratedMva: 100.0,
      ratedKv: 132,
      scheduledActivePowerMw: 0.0,
      activePowerMinMw: 0,
      activePowerMaxMw: 100.0,
      voltageSetpointPu: 1.01,
      reactivePowerMinMvar: -40,
      reactivePowerMaxMvar: 40,
      publishedReferenceOutput: {
        pMw: 0.0,
        qMvar: 35.97,
      },
    },
    {
      id: 'GEN-8',
      name: 'Sync Condenser C8 (Reusens 132 kV)',
      busId: 'BUS-8',
      busNumber: 8,
      unitType: 'Synchronous Condenser',
      controlMode: 'Voltage-Controlled (PV)',
      status: 'online',
      ratedMva: 100.0,
      ratedKv: 132,
      scheduledActivePowerMw: 0.0,
      activePowerMinMw: 0,
      activePowerMaxMw: 100.0,
      voltageSetpointPu: 1.01,
      reactivePowerMinMvar: -10,
      reactivePowerMaxMvar: 40,
      publishedReferenceOutput: {
        pMw: 0.0,
        qMvar: 36.11,
      },
    },
    {
      id: 'GEN-11',
      name: 'Sync Condenser C11 (Roanoke 11 kV)',
      busId: 'BUS-11',
      busNumber: 11,
      unitType: 'Synchronous Condenser',
      controlMode: 'Voltage-Controlled (PV)',
      status: 'online',
      ratedMva: 100.0,
      ratedKv: 11,
      scheduledActivePowerMw: 0.0,
      activePowerMinMw: 0,
      activePowerMaxMw: 100.0,
      voltageSetpointPu: 1.082,
      reactivePowerMinMvar: -6,
      reactivePowerMaxMvar: 24,
      publishedReferenceOutput: {
        pMw: 0.0,
        qMvar: 16.12,
      },
    },
    {
      id: 'GEN-13',
      name: 'Sync Condenser C13 (Hancock 11 kV)',
      busId: 'BUS-13',
      busNumber: 13,
      unitType: 'Synchronous Condenser',
      controlMode: 'Voltage-Controlled (PV)',
      status: 'online',
      ratedMva: 100.0,
      ratedKv: 11,
      scheduledActivePowerMw: 0.0,
      activePowerMinMw: 0,
      activePowerMaxMw: 100.0,
      voltageSetpointPu: 1.071,
      reactivePowerMinMvar: -6,
      reactivePowerMaxMvar: 24,
      publishedReferenceOutput: {
        pMw: 0.0,
        qMvar: 10.42,
      },
    },
  ];

  const loads: NetworkLoad[] = RAW_BUSES.filter(
    (b) => b.pdMw > 0 || b.qdMvar > 0
  ).map((b) => ({
    id: `LOAD-${b.num}`,
    name: `Load L${b.num} (${b.name.trim()})`,
    busId: `BUS-${b.num}`,
    busNumber: b.num,
    baseKv: b.baseKv,
    status: 'connected',
    nominalActivePowerMw: b.pdMw,
    nominalReactivePowerMvar: b.qdMvar,
    configuredActivePowerMw: b.pdMw,
    configuredReactivePowerMvar: b.qdMvar,
  }));

  const shunts: NetworkShunt[] = RAW_BUSES.filter((b) => b.bsMvar > 0).map(
    (b) => ({
      id: `SHUNT-${b.num}`,
      name: `Shunt Cap SC-${b.num} (${b.name.trim()})`,
      busId: `BUS-${b.num}`,
      busNumber: b.num,
      baseKv: b.baseKv,
      shuntType: 'Capacitor Bank',
      status: 'online',
      conductanceMwAtUnitV: 0,
      nominalSusceptanceMvarAtUnitV: b.bsMvar,
      configuredSusceptanceMvarAtUnitV: b.bsMvar,
    })
  );

  const busMap = new Map(RAW_BUSES.map((b) => [b.num, b]));
  const lines: NetworkTransmissionLine[] = [];
  const transformers: NetworkTransformer[] = [];

  for (const br of RAW_BRANCHES) {
    const fBus = busMap.get(br.fbus)!;
    const tBus = busMap.get(br.tbus)!;
    const isTransformer = br.tap > 0 || fBus.baseKv !== tBus.baseKv;

    if (isTransformer) {
      const trId = `TR-${br.fbus}-${br.tbus}`;
      const tapVal = br.tap > 0 ? br.tap : 1.0;
      transformers.push({
        id: trId,
        name: `Transformer T${br.fbus}–${br.tbus} (${fBus.name} → ${tBus.name})`,
        branchIndex: br.idx,
        fromBusId: `BUS-${br.fbus}`,
        toBusId: `BUS-${br.tbus}`,
        fromBusNumber: br.fbus,
        toBusNumber: br.tbus,
        fromVoltageKv: fBus.baseKv,
        toVoltageKv: tBus.baseKv,
        windingConfigLabel: `${fBus.baseKv} kV / ${tBus.baseKv} kV`,
        status: 'online',
        resistancePu: br.r,
        reactancePu: br.x,
        tapRatioPu: tapVal,
        nominalTapRatioPu: tapVal,
        phaseShiftDeg: 0.0,
        ratingMva: br.rateA,
        ratingSourceNote: `Alsac & Stott (1974) / MATPOWER case30.m Rate A = ${br.rateA} MVA`,
      });
    } else {
      const lnId = `LINE-${br.fbus}-${br.tbus}`;
      lines.push({
        id: lnId,
        name: `Line L${br.fbus}–${br.tbus} (${fBus.name} – ${tBus.name})`,
        branchIndex: br.idx,
        fromBusId: `BUS-${br.fbus}`,
        toBusId: `BUS-${br.tbus}`,
        fromBusNumber: br.fbus,
        toBusNumber: br.tbus,
        voltageKv: fBus.baseKv,
        status: 'online',
        resistancePu: br.r,
        reactancePu: br.x,
        chargingSusceptancePu: br.b,
        ratingMva: br.rateA,
        ratingSourceNote: `Alsac & Stott (1974) / MATPOWER case30.m Rate A = ${br.rateA} MVA`,
      });
    }
  }

  const buses: NetworkBus[] = RAW_BUSES.map((b) => {
    const connGens = generators
      .filter((g) => g.busNumber === b.num)
      .map((g) => g.id);
    const connLoads = loads
      .filter((l) => l.busNumber === b.num)
      .map((l) => l.id);
    const connLines = lines
      .filter((ln) => ln.fromBusNumber === b.num || ln.toBusNumber === b.num)
      .map((ln) => ln.id);
    const connTrs = transformers
      .filter((tr) => tr.fromBusNumber === b.num || tr.toBusNumber === b.num)
      .map((tr) => tr.id);
    const connShunts = shunts
      .filter((sh) => sh.busNumber === b.num)
      .map((sh) => sh.id);

    const busTypeLabel =
      b.type === 'slack'
        ? 'Slack / Reference (Type 3)'
        : b.type === 'pv'
        ? 'Voltage-Controlled PV (Type 2)'
        : 'Load / Switching PQ (Type 1)';

    return {
      id: `BUS-${b.num}`,
      number: b.num,
      name: b.name,
      substationName: b.substation,
      areaNumber: b.area,
      areaName: AREA_NAMES[b.area],
      busType: b.type,
      busTypeLabel,
      baseKv: b.baseKv,
      status: 'online',
      vMinPu: 0.95,
      vMaxPu: b.type === 'pv' || b.type === 'slack' ? 1.1 : 1.05,
      initialVmPu: b.refVm,
      initialVaDeg: b.refVa,
      publishedReference: {
        vmPu: b.refVm,
        vaDeg: b.refVa,
      },
      connectedEquipment: {
        generators: connGens,
        loads: connLoads,
        lines: connLines,
        transformers: connTrs,
        shunts: connShunts,
      },
      oneLineLayout: {
        x: b.oneLineX,
        y: b.oneLineY,
        orientation: b.orientation,
        length: b.length,
      },
      geoLocation: {
        lat: b.lat,
        lon: b.lon,
        coordinateConfidence: b.confidence,
        historicalLocationNote: b.locNote,
        parentSubstationBusNumber: b.parentSubBus,
      },
    };
  });

  return {
    metadata: {
      id: 'ieee-30-bus-aep-1961',
      name: 'IEEE 30-Bus Test System (1961 American Electric Power Roanoke / New River Valley System)',
      shortName: 'IEEE 30-Bus Benchmark',
      caseIdentifier: 'ieee30cdf.txt / case_ieee30 / case30',
      classification: 'academic-benchmark',
      classificationLabel: 'IEEE Standard Academic Benchmark (Historical 1961 AEP Subsystem Approximation)',
      sourceOrganization:
        'University of Washington Power Systems Test Case Archive / American Electric Power (AEP) / MATPOWER',
      authors: [
        'Iraj Dabbagchi (American Electric Power, 1961 data provider)',
        'Rich Christie (University of Washington, Aug 1993 IEEE CDF archive)',
        'O. Alsac & B. Stott (IEEE Trans. PAS, 1974 — branch thermal MVA ratings & Q limits)',
        'Ray D. Zimmerman et al. (MATPOWER case_ieee30.m / case30.m)',
      ],
      publicationTitle:
        'UW Power Systems Test Case Archive: 30 Bus Power Flow Test Case (ieee30cdf.txt) & O. Alsac, B. Stott, "Optimal Load Flow with Steady State Security," IEEE Trans. PAS, Vol. PAS-93, No. 3, pp. 745–751',
      publicationYear: 1961,
      editionOrVenue: 'UW Archive (1993) / IEEE Transactions on Power Apparatus and Systems (1974)',
      primarySourceUrl: 'https://labs.ece.uw.edu/pstca/pf30/pg_tca30bus.htm',
      cdfDataUrl: 'https://labs.ece.uw.edu/pstca/pf30/ieee30cdf.txt',
      matpowerCaseUrl:
        'https://github.com/MATPOWER/matpower/blob/master/data/case_ieee30.m',
      matpowerRatingsUrl:
        'https://github.com/MATPOWER/matpower/blob/master/data/case30.m',
      baseMva: 100.0,
      nominalFrequencyHz: 60.0,
      originalBusCount: 30,
      representedBusCount: 30,
      subsystemAndReductionSummary:
        'Complete 30-bus, 41-branch IEEE 30-Bus Test System represented 1:1 without bus reduction or arbitrary branch removal. Combines the exact bus/branch/generator/shunt parameters of ieee30cdf.txt with the published branch thermal MVA ratings (rateA) from Alsac & Stott (1974) / MATPOWER case30.m.',
      parameterSources: [
        {
          component: 'Buses (1–30), Base Voltages (132/33/11/1 kV), Loads (21 buses, 283.4 MW / 126.2 MVAr), & Shunts (Bus 10 & Bus 24)',
          sourceLocation: 'UW Archive ieee30cdf.txt (BUS DATA FOLLOWS — 30 ITEMS)',
          details:
            'Exact active/reactive load demand, shunt capacitor susceptances (+19.0 MVAr at Bus 10, +4.3 MVAr at Bus 24), and published solved voltages.',
        },
        {
          component: 'Generators & Synchronous Condensers (Buses 1, 2, 5, 8, 11, 13)',
          sourceLocation: 'UW Archive ieee30cdf.txt & MATPOWER case_ieee30.m',
          details:
            'Slack generator at Bus 1 (Glen Lyn 132 kV), PV hydro generator at Bus 2 (Claytor 132 kV, 40 MW), and 4 synchronous condensers at Buses 5, 8, 11, and 13 with published Qmin/Qmax limits.',
        },
        {
          component: 'Transmission Lines (34 lines) & Transformers (7 branches including 4 off-nominal tap ratios)',
          sourceLocation: 'UW Archive ieee30cdf.txt (BRANCH DATA FOLLOWS — 41 ITEMS)',
          details:
            'Exact series R, X, line charging B, and off-nominal transformer tap ratios (0.978 on 6–9, 0.969 on 6–10, 0.932 on 4–12, and 0.968 on 28–27).',
        },
        {
          component: 'Branch Thermal MVA Ratings (Rate A: 130, 90, 70, 65, 32, 16 MVA)',
          sourceLocation: 'O. Alsac & B. Stott (1974) / MATPOWER case30.m (mpc.branch column 6)',
          details:
            'Because ieee30cdf.txt leaves thermal MVA ratings as 0 (unconstrained), the standard published IEEE 30-bus branch thermal ratings from Alsac & Stott (1974) / MATPOWER case30.m are used.',
        },
      ],
      derivedValuesAndAssumptions: [
        'Base MVA is S_base = 100 MVA across the entire 30-bus network.',
        'In ieee30cdf.txt, Bus 9 is the 1.0 kV equivalent star-point node of the Roanoke 132/33/11 kV three-winding transformer (connecting Bus 6 [132 kV], Bus 10 [33 kV], and Bus 11 [11 kV]). Therefore, branches 6–9, 9–10, and 9–11 are modeled as transformer legs.',
        'Similarly, branch 12–13 connects Hancock 33 kV (Bus 12) to the Hancock 11 kV synchronous condenser (Bus 13) and is modeled as a step-down/unit transformer.',
        'At Bus 2 (Claytor 132 kV), ieee30cdf.txt reports a solved voltage magnitude of 1.043 p.u. (with desired Vg = 1.045 p.u. hitting Qmax = 50 MVAr); 1.043 p.u. is used as the baseline PV setpoint so unconstrained and Q-limited solutions both match the published ieee30cdf.txt voltage profile.',
      ],
      licensingAndReuse:
        'Public-domain IEEE Power Systems Test Case Archive data (UW PSTCA) and BSD 3-Clause open-source MATPOWER benchmark data.',
      hasFullGeographicCoordinates: false,
      geographicSummary:
        'Buses 1–13 and 27–28 in ieee30cdf.txt carry explicit 1961 American Electric Power (Appalachian Power) substation names in southwestern Virginia (Glen Lyn, Claytor, Kumis, Hancock, Fieldale, Roanoke, Blaine, Cloverdale, Reusens). Buses 14–26 and 29–30 are generically labeled "Bus 14 33".."Bus 30 33" without published coordinates.',
      geographicDisclaimer:
        'This case is a 1961 IEEE academic benchmark (Midwestern/Appalachian US AEP subsystem), NOT an ERCOT Texas grid model. One-Line View is the primary representation. In the complementary Geographic View, the 9 named AEP substations (Buses 1–13, 27–28) are placed at their historical Virginia locations, while the unnamed 33 kV feeder buses (Buses 14–26, 29–30) are explicitly badged as a schematic subtransmission cluster.',
      solverDocumentation: {
        engineName: 'Client-Side Polar Newton-Raphson AC Power-Flow Engine (MATPOWER v2 Compatible)',
        algorithm:
          'Full AC nonlinear power-flow solver using analytical polar Jacobian (J = [dP/dθ, dP/d|V|; dQ/dθ, dQ/d|V|]), Gaussian elimination with partial pivoting, outer-loop PV-to-PQ reactive power limit switching, and BFS island/energization analysis.',
        executionEnvironment: '100% Client-Side TypeScript in Browser (zero backend or Python runtime required; < 3 ms per solve).',
        supportedModels: [
          'Slack (Type 3), PV Voltage-Controlled (Type 2), and PQ Load/Switching (Type 1) buses',
          'Pi-equivalent transmission lines with series R + jX and total charging susceptance B_c',
          'Two-winding and three-winding star-equivalent transformers with off-nominal tap ratio τ and phase-shift angle θ_shift',
          'Fixed and switched bus shunt capacitor/reactor banks (G_sh + jB_sh)',
          'Generator reactive power limits (Q_min, Q_max) with automatic PV-to-PQ bus conversion',
          'Topological islanding, isolated dead bus detection, and unsupplied load reporting',
        ],
        limitations: [
          'Steady-state positive-sequence fundamental frequency (60 Hz) AC power flow only',
          'Voltage-dependent ZIP load models are not enabled (loads are constant P + jQ when energized)',
          'Automatic transformer LTC voltage regulation is manual via tap-ratio editing',
        ],
      },
      evaluatedCandidates: [
        {
          id: 'ieee-30-bus',
          name: 'IEEE 30-Bus Test System (ieee30cdf.txt / MATPOWER case30)',
          classification: 'academic-benchmark',
          originalBuses: 30,
          voltageLevelsKv: '132 kV, 33 kV, 11 kV, 1.0 kV',
          generatorsCount: 6,
          loadsCount: 21,
          linesCount: 34,
          transformersCount: 7,
          shuntsCount: 2,
          hasThermalRatings: true,
          sourceCitation:
            'UW PSTCA (Christie 1993 / AEP 1961) & Alsac & Stott, IEEE Trans. PAS, 1974',
          sourceUrlOrDoi: 'https://labs.ece.uw.edu/pstca/pf30/pg_tca30bus.htm',
          selected: true,
          evaluationSummary:
            'Selected (< 50 buses). Rich 30-bus multi-voltage (132/33/11 kV) topology with 6 generators/condensers, 21 loads, 34 lines, 7 transformers (4 off-nominal taps), 2 shunts, published thermal ratings, named historical AEP substations, and exact reference solution.',
        },
        {
          id: 'ieee-14-bus',
          name: 'IEEE 14-Bus Test System (ieee14cdf.txt / MATPOWER case14)',
          classification: 'academic-benchmark',
          originalBuses: 14,
          voltageLevelsKv: 'Unspecified (0 kV in CDF; 138/69 kV historical)',
          generatorsCount: 5,
          loadsCount: 11,
          linesCount: 17,
          transformersCount: 3,
          shuntsCount: 1,
          hasThermalRatings: false,
          sourceCitation: 'UW PSTCA (Christie 1993 / AEP Feb 1962)',
          sourceUrlOrDoi: 'https://labs.ece.uw.edu/pstca/pf14/pg_tca14bus.htm',
          selected: false,
          evaluationSummary:
            'Rejected in favor of IEEE 30-Bus: ieee14cdf.txt and MATPOWER case14.m have 0 kV base voltages and 0 MVA thermal ratings on all 20 branches, and generic "Bus 1 HV" labels.',
        },
        {
          id: 'ieee-24-rts',
          name: 'IEEE 24-Bus Reliability Test System (case24_ieee_rts.m)',
          classification: 'academic-benchmark',
          originalBuses: 24,
          voltageLevelsKv: '230 kV, 138 kV',
          generatorsCount: 32,
          loadsCount: 17,
          linesCount: 33,
          transformersCount: 5,
          shuntsCount: 1,
          hasThermalRatings: true,
          sourceCitation: 'IEEE RTS Task Force, IEEE Trans. PAS, 1979',
          sourceUrlOrDoi: 'https://github.com/MATPOWER/matpower/blob/master/data/case24_ieee_rts.m',
          selected: false,
          evaluationSummary:
            'Strong runner-up with 24 buses and thermal limits, but purely synthetic with multiple parallel generators per bus and no historical substation locations.',
        },
        {
          id: 'ieee-39-bus',
          name: 'IEEE 39-Bus New England System (case39.m / Pai 1989)',
          classification: 'academic-benchmark',
          originalBuses: 39,
          voltageLevelsKv: '345 kV, 230 kV, 138 kV, 16.5 kV',
          generatorsCount: 10,
          loadsCount: 21,
          linesCount: 34,
          transformersCount: 12,
          shuntsCount: 0,
          hasThermalRatings: true,
          sourceCitation: 'T. Athay et al. (1979) / M. A. Pai (1989) / MATPOWER case39.m',
          sourceUrlOrDoi: 'https://github.com/MATPOWER/matpower/blob/master/data/case39.m',
          selected: false,
          evaluationSummary:
            'Not selected: Primarily a transient stability benchmark with 1,000 MW aggregated equivalents, zero shunt elements, and anonymized bus names.',
        },
        {
          id: 'gso-5-bus',
          name: 'Glover–Overbye–Sarma 5-Bus Benchmark (Bus5_GSO)',
          classification: 'academic-benchmark',
          originalBuses: 5,
          voltageLevelsKv: '345 kV, 15 kV',
          generatorsCount: 2,
          loadsCount: 2,
          linesCount: 3,
          transformersCount: 2,
          shuntsCount: 0,
          hasThermalRatings: true,
          sourceCitation: 'Glover, Overbye, Sarma, Power System Analysis and Design, 6th Ed.',
          sourceUrlOrDoi:
            'https://overbye.engr.tamu.edu/wp-content/uploads/sites/146/2025/09/ECEN615_Fall2025_Lect4.pdf',
          selected: false,
          evaluationSummary:
            'Complete parameters, but 5 buses is too small to demonstrate multiscale regional-to-detailed navigation and lacks shunts and off-nominal tap ratios.',
        },
      ],
    },
    areas: [
      {
        id: 1,
        name: 'Area 1: 132 kV Bulk Transmission Backbone',
        shortName: '132 kV Backbone',
        voltageTierLabel: '132 kV EHV',
        description:
          'Primary 132 kV bulk power corridor linking Glen Lyn (Bus 1), Claytor Hydro (Bus 2), Fieldale (Bus 5), Roanoke (Bus 6), Reusens Hydro (Bus 8), and Cloverdale (Bus 28).',
        oneLineBounds: { x: 80, y: 560, width: 1240, height: 390 },
        geoCenter: { lat: 37.2, lon: -80.1, zoom: 9.2 },
      },
      {
        id: 2,
        name: 'Area 2: Hancock–Roanoke 33 kV West Subtransmission',
        shortName: '33 kV West Loop',
        voltageTierLabel: '33 kV / 11 kV',
        description:
          'Western 33 kV subtransmission loop stepped down at Hancock 132/33 kV (Bus 4 → Bus 12), voltage-supported by Hancock 11 kV Synchronous Condenser (Bus 13), feeding Buses 14–20 and 23.',
        oneLineBounds: { x: 160, y: 70, width: 650, height: 400 },
        geoCenter: { lat: 37.34, lon: -79.96, zoom: 11.5 },
      },
      {
        id: 3,
        name: 'Area 3: Roanoke–Cloverdale 33 kV East Subtransmission',
        shortName: '33 kV East Network',
        voltageTierLabel: '33 kV / 11 kV / 1 kV',
        description:
          'Eastern 33 kV network stepped down at Roanoke (Bus 6 → Buses 9/10/11) and Cloverdale (Bus 28 → Bus 27), with shunt capacitor banks at Bus 10 (+19 MVAr) and Bus 24 (+4.3 MVAr).',
        oneLineBounds: { x: 720, y: 70, width: 800, height: 470 },
        geoCenter: { lat: 37.35, lon: -79.89, zoom: 11.3 },
      },
    ],
    buses,
    generators,
    loads,
    lines,
    transformers,
    shunts,
    loadScaleFactor: 1.0,
  };
}

export const DEFAULT_NETWORK_MODEL: PowerNetworkModel = createInitialIeee30Model();

/**
 * Returns a fresh deep clone of the original IEEE 30-Bus Test System.
 */
export function createFreshDefaultNetworkModel(): PowerNetworkModel {
  return createInitialIeee30Model();
}

/**
 * Looks up any asset in the network model by category and ID.
 */
export function findNetworkEquipment(
  network: PowerNetworkModel | null | undefined,
  selection: SelectedNetworkElement | null | undefined
):
  | { category: 'bus'; item: NetworkBus }
  | { category: 'generator'; item: NetworkGenerator }
  | { category: 'load'; item: NetworkLoad }
  | { category: 'line'; item: NetworkTransmissionLine }
  | { category: 'transformer'; item: NetworkTransformer }
  | { category: 'shunt'; item: NetworkShunt }
  | null {
  if (!network || !selection || !selection.id) return null;
  switch (selection.category) {
    case 'bus': {
      const item = network.buses?.find((b) => b && b.id === selection.id);
      return item ? { category: 'bus', item } : null;
    }
    case 'generator': {
      const item = network.generators?.find((g) => g && g.id === selection.id);
      return item ? { category: 'generator', item } : null;
    }
    case 'load': {
      const item = network.loads?.find((l) => l && l.id === selection.id);
      return item ? { category: 'load', item } : null;
    }
    case 'line': {
      const item = network.lines?.find((ln) => ln && ln.id === selection.id);
      return item ? { category: 'line', item } : null;
    }
    case 'transformer': {
      const item = network.transformers?.find((tr) => tr && tr.id === selection.id);
      return item ? { category: 'transformer', item } : null;
    }
    case 'shunt': {
      const item = network.shunts?.find((sh) => sh && sh.id === selection.id);
      return item ? { category: 'shunt', item } : null;
    }
    default:
      return null;
  }
}

/**
 * Validates the structural and referential integrity of a PowerNetworkModel.
 * Returns an array of diagnostic messages if any collection is missing, any element
 * is undefined/missing an ID, or any branch/equipment references a non-existent bus.
 */
export function validateNetworkModelIntegrity(
  network: PowerNetworkModel | null | undefined
): string[] {
  const issues: string[] = [];
  if (!network) {
    issues.push('Network model is undefined or null.');
    return issues;
  }

  if (!Array.isArray(network.buses) || network.buses.length === 0) {
    issues.push('Network model is missing a valid buses array.');
    return issues;
  }

  const busNumbers = new Set<number>();
  network.buses.forEach((bus, idx) => {
    if (!bus || !bus.id) {
      issues.push(`Bus at index ${idx} is undefined or missing an id.`);
      return;
    }
    busNumbers.add(bus.number);
  });

  const checkCollection = <T extends { id?: string }>(
    items: T[] | undefined,
    label: string,
    checkEndpoints: (item: T) => void
  ) => {
    if (!Array.isArray(items)) {
      issues.push(`Network model is missing ${label} collection.`);
      return;
    }
    items.forEach((item, idx) => {
      if (!item || !item.id) {
        issues.push(`${label} element at index ${idx} is undefined or missing an id.`);
        return;
      }
      checkEndpoints(item);
    });
  };

  checkCollection(network.lines, 'Transmission line', (line) => {
    if (!busNumbers.has(line.fromBusNumber)) {
      issues.push(`Line ${line.id} references missing fromBusNumber ${line.fromBusNumber}.`);
    }
    if (!busNumbers.has(line.toBusNumber)) {
      issues.push(`Line ${line.id} references missing toBusNumber ${line.toBusNumber}.`);
    }
  });

  checkCollection(network.transformers, 'Transformer', (tr) => {
    if (!busNumbers.has(tr.fromBusNumber)) {
      issues.push(
        `Transformer ${tr.id} references missing fromBusNumber ${tr.fromBusNumber}.`
      );
    }
    if (!busNumbers.has(tr.toBusNumber)) {
      issues.push(`Transformer ${tr.id} references missing toBusNumber ${tr.toBusNumber}.`);
    }
  });

  checkCollection(network.generators, 'Generator', (gen) => {
    if (!busNumbers.has(gen.busNumber)) {
      issues.push(`Generator ${gen.id} references missing busNumber ${gen.busNumber}.`);
    }
  });

  checkCollection(network.loads, 'Load', (load) => {
    if (!busNumbers.has(load.busNumber)) {
      issues.push(`Load ${load.id} references missing busNumber ${load.busNumber}.`);
    }
  });

  checkCollection(network.shunts, 'Shunt', (sh) => {
    if (!busNumbers.has(sh.busNumber)) {
      issues.push(`Shunt ${sh.id} references missing busNumber ${sh.busNumber}.`);
    }
  });

  return issues;
}

/**
 * Toggles the online/offline or connected/disconnected state of any network equipment.
 */
export function toggleNetworkEquipmentStatus(
  network: PowerNetworkModel,
  target: SelectedNetworkElement
): PowerNetworkModel {
  switch (target.category) {
    case 'bus':
      return {
        ...network,
        buses: network.buses.map((b) =>
          b.id === target.id
            ? { ...b, status: b.status === 'online' ? 'offline' : 'online' }
            : b
        ),
      };
    case 'generator':
      return {
        ...network,
        generators: network.generators.map((g) =>
          g.id === target.id
            ? { ...g, status: g.status === 'online' ? 'offline' : 'online' }
            : g
        ),
      };
    case 'load':
      return {
        ...network,
        loads: network.loads.map((l) =>
          l.id === target.id
            ? {
                ...l,
                status: l.status === 'connected' ? 'disconnected' : 'connected',
              }
            : l
        ),
      };
    case 'line':
      return {
        ...network,
        lines: network.lines.map((ln) =>
          ln.id === target.id
            ? { ...ln, status: ln.status === 'online' ? 'offline' : 'online' }
            : ln
        ),
      };
    case 'transformer':
      return {
        ...network,
        transformers: network.transformers.map((tr) =>
          tr.id === target.id
            ? { ...tr, status: tr.status === 'online' ? 'offline' : 'online' }
            : tr
        ),
      };
    case 'shunt':
      return {
        ...network,
        shunts: network.shunts.map((sh) =>
          sh.id === target.id
            ? { ...sh, status: sh.status === 'online' ? 'offline' : 'online' }
            : sh
        ),
      };
    default:
      return network;
  }
}

/**
 * Updates operating parameters of a generator.
 */
export function updateGeneratorParameters(
  network: PowerNetworkModel,
  generatorId: string,
  updates: Partial<
    Pick<
      NetworkGenerator,
      | 'scheduledActivePowerMw'
      | 'voltageSetpointPu'
      | 'reactivePowerMinMvar'
      | 'reactivePowerMaxMvar'
      | 'status'
    >
  >
): PowerNetworkModel {
  return {
    ...network,
    generators: network.generators.map((g) =>
      g.id === generatorId ? { ...g, ...updates } : g
    ),
  };
}

/**
 * Updates active and reactive demand of a load.
 */
export function updateLoadParameters(
  network: PowerNetworkModel,
  loadId: string,
  updates: Partial<
    Pick<
      NetworkLoad,
      'configuredActivePowerMw' | 'configuredReactivePowerMvar' | 'status'
    >
  >
): PowerNetworkModel {
  return {
    ...network,
    loads: network.loads.map((l) =>
      l.id === loadId ? { ...l, ...updates } : l
    ),
  };
}

/**
 * Updates off-nominal tap ratio or phase shift of a transformer.
 */
export function updateTransformerParameters(
  network: PowerNetworkModel,
  transformerId: string,
  updates: Partial<
    Pick<NetworkTransformer, 'tapRatioPu' | 'phaseShiftDeg' | 'status'>
  >
): PowerNetworkModel {
  return {
    ...network,
    transformers: network.transformers.map((tr) =>
      tr.id === transformerId ? { ...tr, ...updates } : tr
    ),
  };
}

/**
 * Updates configured reactive susceptance of a shunt bank.
 */
export function updateShuntParameters(
  network: PowerNetworkModel,
  shuntId: string,
  updates: Partial<
    Pick<NetworkShunt, 'configuredSusceptanceMvarAtUnitV' | 'status'>
  >
): PowerNetworkModel {
  return {
    ...network,
    shunts: network.shunts.map((sh) =>
      sh.id === shuntId ? { ...sh, ...updates } : sh
    ),
  };
}

/**
 * Resets a single selected equipment item back to its documented IEEE 30-Bus baseline state.
 */
export function resetSingleEquipmentToDefault(
  network: PowerNetworkModel,
  target: SelectedNetworkElement
): PowerNetworkModel {
  const baseline = createInitialIeee30Model();
  switch (target.category) {
    case 'bus': {
      const orig = baseline.buses.find((b) => b.id === target.id);
      if (!orig) return network;
      return {
        ...network,
        buses: network.buses.map((b) => (b.id === target.id ? orig : b)),
      };
    }
    case 'generator': {
      const orig = baseline.generators.find((g) => g.id === target.id);
      if (!orig) return network;
      return {
        ...network,
        generators: network.generators.map((g) =>
          g.id === target.id ? orig : g
        ),
      };
    }
    case 'load': {
      const orig = baseline.loads.find((l) => l.id === target.id);
      if (!orig) return network;
      return {
        ...network,
        loads: network.loads.map((l) => (l.id === target.id ? orig : l)),
      };
    }
    case 'line': {
      const orig = baseline.lines.find((ln) => ln.id === target.id);
      if (!orig) return network;
      return {
        ...network,
        lines: network.lines.map((ln) => (ln.id === target.id ? orig : ln)),
      };
    }
    case 'transformer': {
      const orig = baseline.transformers.find((tr) => tr.id === target.id);
      if (!orig) return network;
      return {
        ...network,
        transformers: network.transformers.map((tr) =>
          tr.id === target.id ? orig : tr
        ),
      };
    }
    case 'shunt': {
      const orig = baseline.shunts.find((sh) => sh.id === target.id);
      if (!orig) return network;
      return {
        ...network,
        shunts: network.shunts.map((sh) => (sh.id === target.id ? orig : sh)),
      };
    }
    default:
      return network;
  }
}
