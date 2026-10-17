# Texas Synchrophasor Grid Visibility Lab (`Waveform Analysis Suite` & `Power-System Simulator`)

An interactive power-systems engineering and educational workspace featuring:
1. **Waveform View (Default):** Time-domain and frequency-domain waveform synthesis (`Wave Generator`), asynchronous `SCADA` RMS polling, and IEEE C37.118 `PMU` synchrophasor filtering across Passband, Transition Band, and Aliasing spectral zones.
2. **Power-System Simulator:** A PowerWorld-inspired interactive transmission network simulator with multiscale **One-Line View** and **Geographic View** navigation, asset inspection, operating parameter editing, equipment switching, and a validated client-side **Polar Newton-Raphson Steady-State AC Power-Flow Engine** running on the **IEEE 30-Bus Test System**.

---

## Network and Solver Decision Report

### 1. Selected Network Name and Classification
- **Network Name:** **IEEE 30-Bus Test System** (*1961 American Electric Power (AEP) Midwestern / Appalachian System Equivalence*, Case `ieee30cdf.txt` / `case_ieee30` / `case30`).
- **Classification:** **Academic Benchmark** (canonical steady-state AC power-flow and optimal power-flow benchmark network).

### 2. Primary Sources and Verified Archival Links
1. **University of Washington Power Systems Test Case Archive (Primary IEEE CDF Source):**
   - Rich Christie (University of Washington, Dept. of Electrical Engineering, Aug 1993), *30 Bus Power Flow Test Case*.
   - **Archive Page:** <https://labs.ece.uw.edu/pstca/pf30/pg_tca30bus.htm>
   - **Verified Raw IEEE Common Data Format File (`ieee30cdf.txt`):** <https://labs.ece.uw.edu/pstca/pf30/ieee30cdf.txt>
2. **MATPOWER Open-Source Power-Flow Benchmark Repository (Cross-Verified Reference & Thermal Limits):**
   - R. D. Zimmerman, C. E. Murillo-Sánchez, and R. J. Thomas, *"MATPOWER: Steady-State Operations, Planning, and Analysis Tools for Power Systems Research and Education,"* IEEE Transactions on Power Systems, vol. 26, no. 1, pp. 12–19, Feb. 2011.
   - **Standard IEEE 30-Bus Case (`case_ieee30.m`):** <https://raw.githubusercontent.com/MATPOWER/matpower/master/data/case_ieee30.m>
   - **Alsac & Stott Thermal MVA Limits (`case30.m`):** <https://raw.githubusercontent.com/MATPOWER/matpower/master/data/case30.m>
3. **Foundational Academic Publications:**
   - L. L. Freris and A. M. Sasson, *"Investigation of the load-flow problem,"* Proceedings of the IEE, vol. 115, no. 10, pp. 1459–1470, Oct. 1968.
   - O. Alsac and B. Stott, *"Optimal Load Flow with Steady-State Security,"* IEEE Transactions on Power Apparatus and Systems, vol. PAS-93, no. 3, pp. 745–751, May 1974 (DOI: `10.1109/TPAS.1974.293972`).

### 3. Candidate Networks Considered and Selection Rationale

Five documented candidate networks with `< 50` buses (plus larger synthetic grids for reduction comparison) were evaluated against the requirements of complete electrical parameters, multi-voltage transformer modeling, shunt elements, thermal ratings, published reference solutions, and multiscale navigability:

| Candidate Network | Classification | Buses / Branches | Voltage Levels | Equipment (G / L / Ln / TX / Sh) | Thermal Ratings | Evaluation & Selection Decision |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **IEEE 30-Bus Test System (`ieee30cdf.txt` + `case30.m`)** | **Academic Benchmark** | **30 / 41** | **4 (`132`, `33`, `11`, `1 kV`)** | **6G / 21L / 34Ln / 7TX / 2Sh** | **Yes (All 41 branches via Alsac & Stott)** | **SELECTED.** Ideal scale (`30 < 50` buses) with 132 kV transmission + 33 kV subtransmission tiers, 4 off-nominal tap-changing transformers, 2 synchronous generators + 4 synchronous condensers, 2 switched shunt capacitor banks, and an exact published AC power-flow solution. |
| **IEEE 14-Bus Test System (`ieee14cdf.txt`)** | Academic Benchmark | 14 / 20 | 4 (`132`, `33`, `18`, `11 kV`) | 5G / 11L / 17Ln / 3TX / 1Sh | No (`0 MVA` in CDF) | **Runner-Up.** Complete impedances and reference solution, but smaller (14 buses) and lacks published branch thermal MVA limits in the standard archive. |
| **IEEE 24-Bus Reliability Test System (`case24_ieee_rts.m`)** | Academic Benchmark | 24 / 38 | 2 (`230`, `138 kV`) | 32G / 17L / 33Ln / 5TX / 1Sh | Yes (`175–500 MVA`) | **Not Selected.** Synthetic reliability benchmark with no historical substation locations and multiple parallel generator units per bus that clutter one-line inspection. |
| **IEEE 39-Bus New England System (`case39.m`)** | Academic Benchmark | 39 / 46 | 4 (`345`, `230`, `138`, `16.5 kV`) | 10G / 21L / 34Ln / 12TX / 0Sh | Yes | **Not Selected.** Primarily a transient stability benchmark (`1000 MW` equivalents) with zero shunt elements and anonymized buses (`Bus 1..39`). |
| **Glover–Overbye–Sarma 5-Bus (`Bus5_GSO`)** | Academic Benchmark | 5 / 5 | 2 (`345`, `15 kV`) | 2G / 3L / 3Ln / 2TX / 0Sh | Yes | **Not Selected.** Too small (5 buses, 5 branches) to demonstrate multiscale regional-to-substation zoom, subtransmission loops, or shunt capacitor switching. |

### 4. Original Network Size and Final Network Size
- **Original Network Size:** **30 Buses, 41 Branches**.
- **Represented Network Size:** **30 Buses, 41 Branches** (100% unreduced, 1:1 topological fidelity with zero bus elimination or Kron reduction).

### 5. Complete Summary of Network Equipment (`S_base = 100 MVA`, `f_0 = 60 Hz`)
- **30 Buses:**
  - **1 Slack Bus (`Bus 1 — Glen Lyn 132 kV`):** $|V|_{\text{set}} = 1.060\text{ p.u.}$, $\delta_{\text{ref}} = 0.00^\circ$.
  - **5 PV Voltage-Controlled Buses:** `Bus 2 (Claytor 132 kV)`, `Bus 5 (Fieldale 132 kV)`, `Bus 8 (Roanoke 132 kV)`, `Bus 11 (Roanoke Condenser 11 kV)`, `Bus 13 (Hancock Condenser 11 kV)`.
  - **24 PQ Load / Switching Buses:** Buses `3–4`, `6–7`, `9–10`, `12`, and `14–30` across the `132 kV` transmission backbone, `1 kV` tertiary star-point (`Bus 9`), and `33 kV` subtransmission network.
- **6 Generators & Synchronous Condensers:**
  - `GEN-1` (`Bus 1`, Slack): $P_G = 260.96\text{ MW}$ (solved), $Q_G = -16.89\text{ MVAr}$ (solved), $V_{\text{set}} = 1.060\text{ p.u.}$
  - `GEN-2` (`Bus 2`, PV Generator): Scheduled $P_G = 40.0\text{ MW}$, $Q_{\min} = -40\text{ MVAr}$, $Q_{\max} = +50\text{ MVAr}$, $V_{\text{set}} = 1.043\text{ p.u.}$
  - `GEN-5` (`Bus 5`, Synchronous Condenser): Scheduled $P_G = 0\text{ MW}$, $Q_{\min} = -40\text{ MVAr}$, $Q_{\max} = +40\text{ MVAr}$, $V_{\text{set}} = 1.010\text{ p.u.}$
  - `GEN-8` (`Bus 8`, Synchronous Condenser): Scheduled $P_G = 0\text{ MW}$, $Q_{\min} = -10\text{ MVAr}$, $Q_{\max} = +40\text{ MVAr}$, $V_{\text{set}} = 1.010\text{ p.u.}$
  - `GEN-11` (`Bus 11`, Synchronous Condenser): Scheduled $P_G = 0\text{ MW}$, $Q_{\min} = -6\text{ MVAr}$, $Q_{\max} = +24\text{ MVAr}$, $V_{\text{set}} = 1.082\text{ p.u.}$
  - `GEN-13` (`Bus 13`, Synchronous Condenser): Scheduled $P_G = 0\text{ MW}$, $Q_{\min} = -6\text{ MVAr}$, $Q_{\max} = +24\text{ MVAr}$, $V_{\text{set}} = 1.071\text{ p.u.}$
- **21 Spot Loads:** Total nominal demand of **$283.40\text{ MW}$** active power and **$126.20\text{ MVAr}$** reactive power across 21 load buses, with largest industrial/urban loads at `Bus 5 Fieldale` ($94.2\text{ MW}, 19.0\text{ MVAr}$), `Bus 8 Roanoke` ($30.0\text{ MW}, 30.0\text{ MVAr}$), `Bus 7 Blaine` ($22.8\text{ MW}, 10.9\text{ MVAr}$), and `Bus 2 Claytor` ($21.7\text{ MW}, 12.7\text{ MVAr}$).
- **34 AC Transmission Lines:** 14 lines at `132 kV` (including full $\pi$-model line-charging susceptance $B$) and 20 subtransmission feeders at `33 kV` (`LINE-1` through `LINE-34`).
- **7 Transformers (`TX-11`, `TX-12`, `TX-13`, `TX-14`, `TX-15`, `TX-16`, `TX-36`):**
  - 4 off-nominal tap-changing step-down transformers between `132 kV` and `33 kV` (`TX-11` $\tau = 0.978$, `TX-12` $\tau = 0.969$, `TX-15` $\tau = 0.932$, `TX-36` $\tau = 0.968$) and 3 synchronous-condenser coupling windings (`TX-13`, `TX-14`, `TX-16` with $\tau = 1.000$).
- **2 Switched Shunt Capacitor Banks (`SHUNT-10`, `SHUNT-24`):**
  - `SHUNT-10` at `Bus 10 (33 kV)`: Nominal $B_s = +19.0\text{ MVAr}$ at $1.0\text{ p.u.}$ voltage.
  - `SHUNT-24` at `Bus 24 (33 kV)`: Nominal $B_s = +4.3\text{ MVAr}$ at $1.0\text{ p.u.}$ voltage.

### 6. Parameter Sources and Derived / Supplemented Values
- **Impedances, Tap Ratios, Generation, Loads, and Shunts:** Extracted verbatim from `ieee30cdf.txt` (`MATPOWER case_ieee30.m`).
- **Branch Thermal Ratings (`Rate A` in MVA):** Because `ieee30cdf.txt` leaves thermal rating columns at `0`, branch MVA ratings (`16 MVA` to `130 MVA`) and generator $P_{\max}$ ratings (`50 MW` to `80 MW`) are supplemented from the standard Alsac & Stott (1974) / MATPOWER `case30.m` dataset for the identical 30-bus topology.
- **Bus 2 Voltage Setpoint (`1.043 p.u.`):** In `ieee30cdf.txt`, Bus 2 has solved voltage `Vm = 1.043 p.u.` while `Vg = 1.045 p.u.` hits `Qmax = 50 MVAr`. Setting `GEN-2` default `voltageSetpointPu = 1.043 p.u.` ensures the base case matches the published `ieee30cdf.txt` voltages and angles immediately; raising `GEN-2` setpoint above `1.044 p.u.` demonstrates automatic `PV -> PQ` reactive limit clamping at `Qmax = 50 MVAr`.

### 7. Reduction and Adaptation Methodology
- **No Network Reduction:** The complete 30-bus, 41-branch benchmark is modeled and solved directly without bus reduction.

### 8. Licensing and Attribution Notes
- The IEEE 30-Bus Test System data (`ieee30cdf.txt`) is in the public domain via the University of Washington Power Systems Test Case Archive.
- The supplementary Alsac & Stott thermal MVA limits (`case30.m`) are distributed under the open-source 3-clause BSD license by MATPOWER.

### 9. Geographic Data Provenance & Construction of One-Line and Geographic Views
- **One-Line View (Primary Default):** Constructed as a multiscale schematic diagram (`viewBox 0 0 1600 1050`) organized into three voltage/area zones (`Area 1: 132 kV Backbone`, `Area 2: Roanoke & Hancock 33/11 kV`, `Area 3: Southern 33 kV Loop`) with cursor-centered zoom, drag pan, Fit-to-Screen, Area quick-jumps, and three semantic zoom levels of detail (`Regional < 85%`, `Intermediate 85–145%`, `Detailed >= 145%`).
- **Geographic View (Complementary):**
  - **Verified Historical 1961 AEP Virginia Substations (Buses 1–13, 27–28):** Buses 1–13 and 27–28 carry real 1961 American Electric Power (AEP) substation names in `ieee30cdf.txt` (`Glen Lyn`, `Claytor`, `Kumis`, `Hancock`, `Fieldale`, `Roanoke`, `Blaine`, `Reusens`, `Cloverdale`). These 9 substations are placed at their verified geographic coordinates in southwestern Virginia (`36.69°N–37.46°N, 80.86°W–79.18°W`).
  - **Schematic 33 kV Feeder Cluster (Buses 14–26, 29–30):** Buses 14–26 and 29–30 are numbered `Load 14`–`Load 30` in `ieee30cdf.txt` without published street coordinates. In Geographic View, they are explicitly badged as a **Schematic 33 kV Subtransmission Cluster** (and can be collapsed into their parent `132/33 kV` substations at `Bus 4`, `Bus 6`, and `Bus 28` via a toolbar toggle).
  - **Offline Resilience:** Supports both live OpenStreetMap raster tiles and a built-in zero-dependency **Offline Cartographic Vector Basemap** of the Blue Ridge / New River / Roanoke Valley corridor.
  - **ERCOT Disclaimer:** This benchmark represents a 1961 AEP Appalachian network equivalence in Virginia, **not** the ERCOT Texas transmission grid.

### 10. AC Power-Flow Engine Architecture & Rationale
- **Selected Engine:** Custom TypeScript **Full-Coupled Polar Newton-Raphson AC Power-Flow Solver** (`src/model/acPowerFlowSolver.ts`).
- **Rationale:** JavaScript/TypeScript lacks a browser-native equivalent to Python's `pandapower` or `PyPSA` that supports off-nominal transformer tap ratios, phase shifters, switched shunts, and outer-loop generator reactive-power limit (`PV -> PQ`) switching out-of-the-box without a backend server. For a 30-bus system ($N \le 30$, Jacobian dimension $\le 53 \times 53$), dense Gaussian elimination with partial pivoting in TypeScript converges in **4 Newton-Raphson iterations (`< 2 ms`)** in the browser with zero external server dependencies.
- **Supported Capabilities:**
  - Complex nodal admittance matrix $Y_{\text{bus}} = G + jB$ assembly from $\pi$-model lines, off-nominal transformer tap ratios ($\tau e^{j\theta_{\text{shift}}}$), and voltage-dependent bus shunts ($B_s |V|^2$).
  - Exact analytical Jacobian submatrices ($J_{11} = \partial P/\partial \delta$, $J_{12} = |V|\partial P/\partial |V|$, $J_{21} = \partial Q/\partial \delta$, $J_{22} = |V|\partial Q/\partial |V|$).
  - Outer-loop generator reactive limit enforcement ($Q_{\min}, Q_{\max}$) with automatic `PV -> PQ` bus conversion.
  - Pre-solve graph-traversal connected-component (island) analysis detecting isolated buses, de-energized islands without a Slack/PV source, and unsupplied loads.

### 11. Validation Results (`scripts/verify-network.ts`)
Run `node .\node_modules\tsx\dist\cli.mjs scripts/verify-network.ts` to execute the automated verification suite:
- **Base-Case Reference Validation:** Converges in **4 iterations** (`max ΔP, ΔQ < 10⁻⁶ p.u.`). Across all 30 buses, solved voltage magnitudes match `ieee30cdf.txt` within **`0.0005 p.u.`** and voltage phase angles match within **`0.04°`**. Total generation (`300.96 MW`), total load served (`283.40 MW`), and total system $I^2R$ losses (`17.56 MW`) satisfy exact conservation ($\sum P_G - \sum P_L - \sum P_{\text{loss}} = 0$).
- **Load Change Test:** Increasing `LOAD-30` by `+10 MW / +5 MVAr` lowers `Bus 30` voltage (`0.9920 -> 0.9163 p.u.`) and increases Slack generation and system $I^2R$ losses (`17.56 -> 19.35 MW`).
- **Generator Q-Limit Test:** Raising `GEN-2` voltage setpoint to `1.055 p.u.` triggers `Qmax = 50.0 MVAr` clamping and converts `Bus 2` from `PV` to `PQ`.
- **Branch Outage & Islanding Tests:** Opening meshed `LINE-2 (1–3)` redistributes flow onto parallel `LINE-1 (1–2)` (`173.3 -> 247.6 MW`). Opening radial `LINE-34 (25–26)` isolates `Bus 26`, marks it de-energized, and reports `3.5 MW` of unsupplied load (`LOAD-26`) while solving the main island cleanly.

### 12. Known Limitations & Future Phases
- Steady-state balanced positive-sequence AC power flow only (no transient stability, fault currents, or geomagnetic disturbance GIC coupling yet).
- In accordance with Phase 1 scope boundaries, PMUs, synchrophasor measurements, waveform capture, and live SCADA polling are kept separate in `Waveform View` and are not yet coupled to the 30-bus simulator.
