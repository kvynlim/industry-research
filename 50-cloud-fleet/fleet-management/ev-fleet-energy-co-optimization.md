# Joint EV Fleet Energy Co-Optimization for Autonomous Airport GSE

## Unified Charging-Routing-Task Scheduling for Electric Ground Support Equipment

---

**Key Takeaway**: Treating charging, routing, and task assignment as separate problems wastes 10-15% of fleet utilization and 8-12% of electricity budget through demand charge penalties and suboptimal SoC management. A joint co-optimization formulation --- modeled as a stochastic Electric Vehicle Routing Problem with Time Windows (EVRPTW) and solved via decomposed MILP + rolling-horizon MPC --- recovers $180-320K/year for a 50-vehicle autonomous GSE fleet. The dominant savings come not from cheaper electricity but from three sources: eliminating demand charge spikes ($60-120K/year), extending battery pack life by 1.5-2 years through degradation-aware C-rate selection ($90-150K/year amortized replacement cost avoidance), and increasing effective fleet utilization from 72% to 83-87% by converting dead charging time into productive opportunity windows ($45-90K/year in avoided additional vehicle purchases). Vehicle-to-grid (V2G) adds $30-80K/year in demand response revenue at airports with time-of-use pricing, but only when degradation cost is properly accounted --- naive V2G without cycle-aware dispatch actually destroys value. The co-optimization runs as a fleet-level service alongside the CP-SAT task scheduler described in `../../30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md`, consuming A-CDM flight predictions to pre-position vehicles and pre-schedule charging around demand troughs.

---

## Table of Contents

1. [Problem Formulation: Why Joint Optimization Matters](#1-problem-formulation-why-joint-optimization-matters)
2. [State Space and Decision Variables](#2-state-space-and-decision-variables)
3. [Charging Strategy Optimization](#3-charging-strategy-optimization)
4. [LiFePO4 Degradation Modeling](#4-lifepo4-degradation-modeling)
5. [Stochastic EVRP for Airport Operations](#5-stochastic-evrp-for-airport-operations)
6. [Vehicle-to-Grid (V2G) for Airports](#6-vehicle-to-grid-v2g-for-airports)
7. [Grid-Aware Scheduling and Demand Charge Management](#7-grid-aware-scheduling-and-demand-charge-management)
8. [Joint Optimization Algorithms](#8-joint-optimization-algorithms)
9. [Real-Time Adaptive Control via MPC](#9-real-time-adaptive-control-via-mpc)
10. [Airport-Specific Considerations](#10-airport-specific-considerations)
11. [Implementation Architecture](#11-implementation-architecture)
12. [Cost-Benefit Analysis](#12-cost-benefit-analysis)
13. [Key Takeaways](#13-key-takeaways)
14. [References](#14-references)

---

## 1. Problem Formulation: Why Joint Optimization Matters

### 1.1 The Sequential Scheduling Failure Mode

Most electric fleet deployments treat charging as an afterthought: the task scheduler assigns jobs, and when a vehicle's SoC drops below a threshold, it drives to the nearest available charger. This sequential approach --- first schedule tasks, then schedule charging --- creates three systematic inefficiencies:

**Charger contention spikes.** When multiple vehicles hit their SoC thresholds simultaneously (common after a wave of flight arrivals creates a burst of baggage tasks), they all converge on chargers at once. With a 5:1 vehicle-to-charger ratio (typical for a 50-vehicle fleet with 10 DC fast chargers), queuing delays of 15-30 minutes emerge during peak contention. The fleet scheduler then sees "unavailable" vehicles and must either delay tasks or dispatch vehicles from farther away.

**Demand charge penalties.** Commercial electricity tariffs at airports include demand charges of $10-20/kW/month based on the 15-minute peak demand interval. When 8-10 vehicles simultaneously fast-charge at 50-150 kW each, the resulting 400-1,500 kW spike creates demand charges of $4,000-30,000/month that persist for the entire billing period. A single bad 15-minute interval in January sets the demand charge floor for all of January.

**Missed opportunity charging.** Vehicles idling at stands for 10-20 minutes between tasks could be topping up at nearby chargers, but the task scheduler does not reason about future energy needs. By the time the vehicle needs to charge, it must make a dedicated trip to a distant charger, consuming 15+ minutes of productive time.

```
Sequential (current state of practice):
  Task Scheduler ──→ assigns tasks ignoring energy
       │
       ▼
  Vehicle executes tasks until SoC < 20%
       │
       ▼
  Charging Scheduler ──→ sends vehicle to nearest charger
       │
       ▼
  Vehicle charges to 80%, returns to duty
       │
  ❌ Task scheduler had no input on WHEN to charge
  ❌ Charger scheduler had no input on WHICH vehicle to prioritize
  ❌ Neither considers electricity price or demand charges
  ❌ Neither considers battery degradation from charge rate selection

Joint (co-optimization):
  ┌─────────────────────────────────────────────────┐
  │          Joint Energy-Task Optimizer              │
  │                                                   │
  │  Inputs:                                          │
  │    - Task queue (from A-CDM flight predictions)   │
  │    - Vehicle states (SoC, location, health)       │
  │    - Charger states (availability, queue depth)   │
  │    - Grid signals (price, demand charge risk)     │
  │    - Weather (energy consumption modifier)        │
  │    - Battery degradation model                    │
  │                                                   │
  │  Outputs:                                         │
  │    - Unified vehicle-task-charger assignments      │
  │    - Per-vehicle charge rate selection             │
  │    - Charger power modulation schedule             │
  │    - V2G dispatch commands (if enabled)            │
  └─────────────────────────────────────────────────┘
```

### 1.2 Quantifying the Utilization Loss

Empirical data from electric bus fleets (a reasonable proxy for airport GSE, which operates on similar-sized batteries at similar speeds in a closed environment) shows:

| Scheduling Approach | Fleet Utilization | Charger Utilization | Energy Cost per km | Demand Charge |
|---|---|---|---|---|
| Sequential (task-first, then charge) | 68-74% | 40-55% peak, <20% off-peak | $0.05-0.08/km | $8-20K/month |
| Rule-based opportunity charging | 74-78% | 50-65% more even | $0.04-0.06/km | $5-12K/month |
| Joint optimization (MILP/MPC) | 82-88% | 60-75% balanced | $0.03-0.05/km | $3-6K/month |

The 10-15% utilization improvement from joint optimization is roughly equivalent to adding 5-7 vehicles to a 50-vehicle fleet --- at zero capital cost. At $80-180K per vehicle (see `../../70-operations-domains/airside/business-case/fleet-tco-business-case.md`), this represents $400K-1.26M in avoided CAPEX.

### 1.3 EVRP Formulation

The airside GSE energy co-optimization is formulated as an **Electric Vehicle Routing Problem with Time Windows, Partial Recharging, and Heterogeneous Fleet** (EVRPTW-PR-HF). This extends the classical Vehicle Routing Problem with Time Windows (VRPTW) by adding:

- **Energy state tracking**: Each vehicle carries a continuous SoC variable that decreases with travel and task execution, and increases at charging stations
- **Partial recharging**: Vehicles need not charge to full; charging time is a decision variable
- **Heterogeneous fleet**: Different GSE types (baggage tractors, pushback tugs, belt loaders) have different battery capacities, energy consumption rates, and task compatibility
- **Time-varying energy cost**: Electricity prices and demand charges change by time of day
- **Battery degradation cost**: Each charging decision incurs a hidden cost through accelerated aging

Formally, the problem is:

```
Minimize:
    Z = Σ_v Σ_t (c_travel × d(route_v,t))          # Travel cost (energy)
      + Σ_v Σ_t (c_late × max(0, finish_v,t - due_t)) # Tardiness penalty
      + Σ_t (c_demand × peak_power_t)                 # Demand charge
      + Σ_v Σ_s (c_energy(s) × energy_charged_v,s)    # Time-varying electricity
      + Σ_v Σ_s (c_degrad(rate, temp, soc) × energy_charged_v,s) # Degradation

Subject to:
    1. Each task assigned to exactly one compatible vehicle
    2. Time window constraints: start_t ≤ begin_v,t ≤ end_t
    3. Precedence: task dependencies (fueling after deplaning, etc.)
    4. SoC bounds: SoC_min ≤ SoC_v(t) ≤ SoC_max  ∀v, t
    5. Charger capacity: Σ_v x_v,c(t) ≤ capacity_c  ∀c, t
    6. Energy conservation: SoC_v(t+1) = SoC_v(t) - consumption + charging
    7. Peak power: peak_power_t ≥ Σ_c Σ_v (rate_v,c(t) × x_v,c(t))
    8. Vehicle count: each vehicle performs at most one action per time step
```

This is NP-hard (it generalizes VRPTW which is NP-hard). For airport-scale instances (50 vehicles, 200 tasks, 10 chargers, 96 time steps per day at 15-min resolution), exact MILP solvers can handle the problem with decomposition techniques described in Section 8.

---

## 2. State Space and Decision Variables

### 2.1 System State

The co-optimization operates over a state space that combines vehicle, infrastructure, and environmental dimensions:

```python
@dataclass
class VehicleState:
    id: str
    vehicle_type: str           # 'baggage_tractor', 'pushback_tug', 'belt_loader', etc.
    location: Tuple[float, float]  # UTM coordinates on airfield
    soc: float                  # State of charge [0, 1]
    battery_capacity_kwh: float # Nominal capacity (degrades over time)
    battery_health: float       # State of health [0, 1], from degradation model
    current_task: Optional[str] # None if idle
    available_at: float         # Timestamp when current task/charge completes
    energy_rate_kwh_per_km: float  # Vehicle-specific consumption rate
    compute_power_w: float      # Current Orin power draw (see energy-efficient-inference-24-7.md)

@dataclass
class ChargerState:
    id: str
    location: Tuple[float, float]
    charger_type: str           # 'AC_L2', 'DC_FAST', 'DC_ULTRA'
    max_power_kw: float         # 7.2, 50, or 150 kW
    current_vehicle: Optional[str]
    queue: List[str]            # Vehicles waiting
    available_at: float

@dataclass 
class GridState:
    current_price_per_kwh: float     # Time-of-use rate
    peak_demand_kw: float            # Rolling 15-min peak this billing period
    demand_charge_per_kw: float      # $/kW/month
    v2g_price_per_kwh: float         # Demand response sell-back rate
    site_power_limit_kw: float       # Transformer/breaker capacity
    
@dataclass
class EnvironmentState:
    ambient_temp_c: float            # Affects battery efficiency and degradation
    wind_speed_mps: float            # Affects energy consumption (headwind/tailwind)
    precipitation: bool              # May affect route choices and speed limits
    flight_schedule: List[Flight]    # A-CDM predicted arrivals/departures
    active_turnarounds: List[Stand]  # Current stand occupancy

@dataclass
class SystemState:
    vehicles: List[VehicleState]
    chargers: List[ChargerState]
    grid: GridState
    environment: EnvironmentState
    time: float
```

### 2.2 Decision Variables

At each decision epoch (every 1-5 minutes for real-time control, every 15-30 minutes for planning horizon), the optimizer selects:

| Decision | Type | Description |
|---|---|---|
| `assign[v, t]` | Binary | Vehicle `v` assigned to task `t` |
| `charge[v, c, s]` | Binary | Vehicle `v` charges at charger `c` in slot `s` |
| `charge_rate[v, c, s]` | Continuous [0, P_max] | Power level for charging session (kW) |
| `charge_duration[v, c, s]` | Continuous [0, T_max] | Duration of charging session (min) |
| `v2g[v, c, s]` | Binary | Vehicle `v` discharges at charger `c` in slot `s` |
| `v2g_power[v, c, s]` | Continuous [0, P_v2g] | Discharge power (kW) |
| `route[v]` | Sequence | Ordered sequence of task/charge/v2g actions |

### 2.3 Energy Consumption Model

Energy consumption per trip depends on distance, payload, speed, grade, wind, and temperature:

```python
def energy_consumption_kwh(
    distance_km: float,
    payload_kg: float,
    speed_kmh: float,
    grade_pct: float,
    headwind_mps: float,
    ambient_temp_c: float,
    vehicle_type: str,
) -> float:
    """
    Physics-based energy consumption model for electric GSE.
    
    Based on longitudinal vehicle dynamics:
    F_total = F_rolling + F_aero + F_grade + F_accel
    
    For airport GSE at 5-25 km/h, rolling resistance dominates (60-70%),
    aerodynamic drag is minimal (<5%), and grade is typically 0-2%.
    """
    # Vehicle parameters by type
    params = {
        'baggage_tractor': {'mass_kg': 2500, 'crr': 0.015, 'cd_a': 1.2, 'eta_drivetrain': 0.88},
        'pushback_tug':    {'mass_kg': 8000, 'crr': 0.012, 'cd_a': 2.0, 'eta_drivetrain': 0.85},
        'belt_loader':     {'mass_kg': 3500, 'crr': 0.018, 'cd_a': 1.5, 'eta_drivetrain': 0.86},
    }
    p = params[vehicle_type]
    m_total = p['mass_kg'] + payload_kg
    v_ms = speed_kmh / 3.6
    g = 9.81
    rho_air = 1.225
    
    # Force components (N)
    f_rolling = p['crr'] * m_total * g * math.cos(math.atan(grade_pct / 100))
    f_grade = m_total * g * math.sin(math.atan(grade_pct / 100))
    f_aero = 0.5 * rho_air * p['cd_a'] * (v_ms + headwind_mps) ** 2
    f_total = f_rolling + f_grade + f_aero
    
    # Energy at wheel (kWh)
    e_wheel = (f_total * distance_km * 1000) / (3600 * 1000)  # Convert J to kWh
    
    # Drivetrain efficiency
    e_battery = e_wheel / p['eta_drivetrain']
    
    # Temperature correction: LiFePO4 internal resistance increases at extremes
    # Below 0C: +2% per degree below 0
    # Above 40C: +1% per degree above 40 (less severe for LFP than NMC)
    if ambient_temp_c < 0:
        temp_factor = 1.0 + 0.02 * abs(ambient_temp_c)
    elif ambient_temp_c > 40:
        temp_factor = 1.0 + 0.01 * (ambient_temp_c - 40)
    else:
        temp_factor = 1.0
    
    # Auxiliary load: Orin compute (35-60W avg), lights, HVAC if equipped
    # See 20-av-platform/compute/energy-efficient-inference-24-7.md for Orin power profiles
    aux_kwh = 0.06 * (distance_km / speed_kmh)  # ~60W average
    
    return (e_battery * temp_factor) + aux_kwh
```

### 2.4 Typical Energy Budgets by GSE Type

| GSE Type | Battery (kWh) | Consumption (kWh/km) | Range (km) | Tasks per Charge | Orin % of Budget |
|---|---|---|---|---|---|
| Baggage tractor (third-generation tug) | 40-60 | 0.12-0.18 | 220-500 | 20-35 | 0.8-1.2% |
| Pushback tug | 66-165 | 0.30-0.50 | 130-550 | 8-20 | 0.3-0.7% |
| Belt loader | 20-40 | 0.10-0.15 | 130-400 | 15-25 | 1.2-2.4% |
| Catering truck | 60-100 | 0.20-0.30 | 200-500 | 10-18 | 0.5-0.8% |

As documented in `../../20-av-platform/compute/energy-efficient-inference-24-7.md`, the Orin's 35-60W average draw is <2.5% of total energy budget even for the smallest battery packs. The co-optimization focuses on traction energy and charging strategy, not compute power management.

---

## 3. Charging Strategy Optimization

### 3.1 Three Strategies Compared

The charging strategy determines WHEN and HOW MUCH to charge. The battery-charging-infrastructure document (`../../70-operations-domains/airside/operations/battery-charging-infrastructure.md`) covers the hardware. Here we analyze the scheduling implications.

```
Strategy 1: Depot-Only (overnight full charge)
  ┌────────────────────────────────────────────────────┐
  │  Shift 1 (06:00-14:00)    Shift 2 (14:00-22:00)   │
  │  ████████████████████     ████████████████████      │
  │  SoC: 100% → 25%         SoC: 100% → 25%          │
  │                                                     │
  │  Depot charging: 22:00-06:00 (AC L2, 7-15 kW)     │
  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │
  │  SoC: 25% → 100%                                   │
  └────────────────────────────────────────────────────┘
  Pros: Cheapest electricity (off-peak), lowest degradation (slow AC)
  Cons: Cannot support 24/7 ops. Requires 2x fleet for 3-shift coverage
  Best for: Non-24/7 airports, daytime-only operations

Strategy 2: Scheduled Fast Charging (mid-shift breaks)
  ┌────────────────────────────────────────────────────┐
  │  Tasks ███ Charge ▓▓▓ Tasks ███ Charge ▓▓▓ Tasks   │
  │  SoC: 100→55  55→80  80→40  40→75  75→30          │
  │                                                     │
  │  30-min fast charge at shift midpoints              │
  │  DC Fast (50 kW): 25 kWh per session               │
  └────────────────────────────────────────────────────┘
  Pros: Enables 16-20 hr operation, predictable scheduling
  Cons: Fixed charging windows waste capacity during low-demand periods
  Best for: Medium-activity airports with predictable flight schedules

Strategy 3: Opportunity Charging (co-optimized with tasks)
  ┌────────────────────────────────────────────────────┐
  │  ████▓████▓▓██████▓████▓████████▓▓████▓██████     │
  │  SoC: 90 75 82 65 78 60 48 68 52 40 62 78 65      │
  │          ↑      ↑       ↑      ↑       ↑          │
  │       10-min charges during natural idle gaps       │
  │                                                     │
  │  SoC stays in 40-85% band (degradation-optimal)    │
  │  Charge rate adapts: 0.5C idle, 1C between tasks   │
  └────────────────────────────────────────────────────┘
  Pros: Maximum utilization, degradation-optimal SoC window, 24/7 capable
  Cons: Requires co-optimization, more charger infrastructure
  Best for: High-activity hub airports with 24/7 operations (reference airside AV stack target)
```

### 3.2 Opportunity Charging: The Co-Optimization Sweet Spot

For the reference airside AV stack's target deployment --- 20-50 autonomous baggage tractors operating 16-20 hours/day at hub airports --- opportunity charging integrated with task scheduling is optimal. The key insight is that autonomous vehicles naturally create charging opportunities that manual fleets cannot exploit:

1. **No driver breaks needed.** A human-operated vehicle must charge during the driver's break; an autonomous vehicle can charge during any idle window regardless of shift schedule.
2. **Precise SoC awareness.** The fleet optimizer knows every vehicle's exact SoC, upcoming task load, and nearest charger status. Human drivers estimate and often charge too early (wasting capacity) or too late (forced emergency charge).
3. **Automatic docking.** Autonomous self-charging (see `../../70-operations-domains/airside/operations/battery-charging-infrastructure.md`, Section 2.4) eliminates the 2-5 minute human connect/disconnect overhead, making 8-10 minute micro-charges viable.

### 3.3 Optimal SoC Window and Charge Rate Selection

```python
def select_charge_parameters(
    vehicle: VehicleState,
    charger: ChargerState,
    available_time_min: float,
    battery_temp_c: float,
    grid_price: float,
    next_task_energy_kwh: float,
) -> Tuple[float, float, float]:
    """
    Select optimal charge rate (C-rate) and target SoC.
    
    Returns: (power_kw, target_soc, expected_degradation_cost)
    """
    cap = vehicle.battery_capacity_kwh
    current_soc = vehicle.soc
    
    # Target SoC: enough for next task + reserve, capped at 80% for longevity
    min_soc_needed = (next_task_energy_kwh / cap) + 0.15  # 15% reserve
    target_soc = min(0.80, max(min_soc_needed, current_soc + 0.05))
    
    energy_needed = (target_soc - current_soc) * cap
    
    if energy_needed <= 0:
        return (0, current_soc, 0)
    
    # Maximum power from charger
    max_power = charger.max_power_kw
    
    # C-rate constraint: LiFePO4 safe up to 2C, but degradation increases
    # 0.5C: minimal degradation, ~2 hr full charge
    # 1C:   moderate degradation, ~1 hr full charge
    # 2C:   noticeable degradation, ~30 min full charge
    c_rate_limit = {
        'AC_L2':    min(7.2, 0.5 * cap),     # AC always slow
        'DC_FAST':  min(50, 1.0 * cap),       # Default 1C
        'DC_ULTRA': min(150, 2.0 * cap),      # Up to 2C for urgent
    }
    
    # Temperature derating: reduce power at temperature extremes
    if battery_temp_c < 5:
        temp_derate = 0.5  # Half power below 5C (lithium plating risk)
    elif battery_temp_c > 45:
        temp_derate = 0.7  # 30% reduction above 45C
    else:
        temp_derate = 1.0
    
    # Time constraint: can we get enough energy at reduced rate?
    power_needed = energy_needed / (available_time_min / 60)
    power_selected = min(power_needed, max_power, c_rate_limit[charger.charger_type]) * temp_derate
    
    # If urgently low SoC and time-constrained, allow higher C-rate
    if current_soc < 0.20 and available_time_min < 20:
        power_selected = min(max_power, 2.0 * cap) * temp_derate  # Override to 2C
    
    # Degradation cost estimate (see Section 4 for full model)
    c_rate_actual = power_selected / cap
    degrad_cost = degradation_cost_per_kwh(c_rate_actual, battery_temp_c, current_soc)
    
    return (power_selected, target_soc, degrad_cost * energy_needed)
```

### 3.4 Charge Rate vs Degradation Tradeoff

| C-Rate | Charge Time (20-80%) | Degradation Factor | Cost per kWh (degradation) | Use Case |
|---|---|---|---|---|
| 0.25C | ~3.5 hours | 1.0x (baseline) | $0.002/kWh | Overnight depot |
| 0.5C | ~1.8 hours | 1.05x | $0.003/kWh | Extended idle (>1 hr) |
| 1.0C | ~55 min | 1.15x | $0.008/kWh | Standard opportunity charge |
| 1.5C | ~35 min | 1.35x | $0.015/kWh | Short idle, moderate urgency |
| 2.0C | ~25 min | 1.60x | $0.025/kWh | Emergency only (SoC < 20%) |

For a 60 kWh LiFePO4 pack costing ~$9,000 with 5,000 cycle life at 1C, each full-equivalent cycle costs $1.80. At 2C, cycle life drops to ~3,500 cycles, so each cycle costs $2.57 --- a 43% increase in amortized battery cost per kWh delivered.

---

## 4. LiFePO4 Degradation Modeling

### 4.1 Why Degradation Modeling Matters for Co-Optimization

Battery replacement is the second-largest OPEX item for electric GSE after electricity itself (see `../../70-operations-domains/airside/business-case/fleet-tco-business-case.md`). A 60 kWh LiFePO4 pack costs $7,500-12,000 (2026 prices at $125-200/kWh pack-level). If degradation-unaware scheduling shortens pack life from 6 years to 4 years, the annualized cost increases by 50% --- roughly $2,000/vehicle/year across a 50-vehicle fleet, that is $100K/year in accelerated replacement. The co-optimizer must therefore include degradation as an explicit cost term.

### 4.2 Semi-Empirical Degradation Model

LiFePO4 degradation has two components: **calendar aging** (time at temperature and SoC) and **cycle aging** (throughput, C-rate, depth of discharge, temperature).

```python
class LiFePO4DegradationModel:
    """
    Semi-empirical degradation model for LiFePO4 cells.
    
    Based on published aging data from:
    - Wang et al., "Cycle-life model for graphite-LiFePO4 cells" (2011)
    - Naumann et al., "Analysis and modeling of calendar aging" (2020)
    - Safari & Delacourt, "Aging of commercial LFP/graphite cell" (2011)
    
    Outputs capacity fade as fraction of initial capacity per unit time/cycles.
    """
    
    def __init__(self, nominal_capacity_kwh: float, nominal_voltage: float):
        self.Q_nom = nominal_capacity_kwh
        self.V_nom = nominal_voltage
        
    def calendar_aging_per_day(self, temp_c: float, soc_avg: float) -> float:
        """
        Calendar capacity fade per day.
        
        LiFePO4 calendar aging follows sqrt(t) kinetics:
        Q_loss_cal(t) = k_cal(T, SoC) * sqrt(t)
        
        Rate constant k_cal depends on Arrhenius temperature and SoC stress.
        """
        # Arrhenius temperature dependence
        # E_a ≈ 24,500 J/mol for LiFePO4 (lower than NMC ~33,000)
        E_a = 24500  # J/mol
        R = 8.314    # J/(mol*K)
        T = temp_c + 273.15
        T_ref = 298.15  # 25C reference
        
        k_temp = math.exp((E_a / R) * (1/T_ref - 1/T))
        
        # SoC stress factor: LiFePO4 is MUCH less sensitive than NMC
        # At SoC=1.0: 1.15x, at SoC=0.5: 1.0x, at SoC=0.0: 0.95x
        k_soc = 0.95 + 0.20 * soc_avg
        
        # Base rate at 25C, 50% SoC: ~0.005% per day (very slow for LFP)
        k_base = 5e-5  # fraction per sqrt(day)
        
        # Daily incremental fade (derivative of sqrt(t) at large t)
        # For simplicity, linearize around current age
        return k_base * k_temp * k_soc
    
    def cycle_aging_per_kwh(
        self, 
        c_rate: float, 
        temp_c: float, 
        soc_avg: float,
        dod: float,
    ) -> float:
        """
        Cycle capacity fade per kWh throughput.
        
        Key factors for LiFePO4:
        1. C-rate: moderate effect (less than NMC), accelerates above 2C
        2. Temperature: strong effect below 0C (lithium plating), moderate above 40C
        3. Depth of discharge: roughly linear for LFP (unlike NMC which penalizes deep)
        4. SoC window: high-SoC stress is much lower for LFP than NMC
        """
        # C-rate stress: piecewise linear
        if c_rate <= 0.5:
            k_crate = 1.0
        elif c_rate <= 1.0:
            k_crate = 1.0 + 0.3 * (c_rate - 0.5)  # 1.0 at 0.5C, 1.15 at 1C
        elif c_rate <= 2.0:
            k_crate = 1.15 + 0.45 * (c_rate - 1.0)  # 1.15 at 1C, 1.60 at 2C
        else:
            k_crate = 1.60 + 1.0 * (c_rate - 2.0)   # Steep increase above 2C
        
        # Temperature stress
        T = temp_c + 273.15
        T_ref = 298.15
        E_a_cyc = 31000  # Cycle aging activation energy slightly higher
        k_temp = math.exp((E_a_cyc / R) * (1/T_ref - 1/T))
        
        # Extreme cold penalty (lithium plating)
        if temp_c < 0:
            k_temp *= (1.0 + 0.05 * abs(temp_c))  # +5% per degree below 0
        
        # DoD factor: approximately linear for LFP
        k_dod = 0.8 + 0.4 * dod  # 0.8 at 0% DoD, 1.2 at 100% DoD
        
        # Base rate: at 1C, 25C, 50% SoC, full cycle
        # LiFePO4 typical: 5,000 cycles at 80% DoD to 80% capacity
        # = 0.004% capacity loss per full cycle
        # = 0.004% / (Q_nom * 0.8 * 2) per kWh throughput
        k_base = 4e-5 / (self.Q_nom * 0.8 * 2)  # per kWh throughput
        
        return k_base * k_crate * k_temp * k_dod
    
    def degradation_cost_per_kwh(
        self,
        c_rate: float,
        temp_c: float,
        soc_avg: float,
        dod: float = 0.6,
        pack_cost: float = 9000,  # Replacement cost in USD
    ) -> float:
        """
        Convert degradation rate to $/kWh throughput.
        
        This allows the optimizer to compare degradation cost against
        electricity cost and demand charge savings.
        """
        fade_per_kwh = self.cycle_aging_per_kwh(c_rate, temp_c, soc_avg, dod)
        
        # Cost = (capacity fade per kWh) * (pack cost / acceptable fade)
        # Acceptable fade = 20% (from 100% to 80% = end of life)
        cost_per_pct_fade = pack_cost / 20  # $450 per 1% capacity loss
        
        return fade_per_kwh * 100 * cost_per_pct_fade  # $/kWh throughput
```

### 4.3 Degradation Cost Summary

For a 60 kWh LiFePO4 pack at $9,000 replacement cost:

| Condition | Cycle Aging (% per 1000 kWh) | Calendar Aging (% per year) | Degradation Cost ($/kWh) |
|---|---|---|---|
| 0.5C, 25C, 20-80% SoC | 0.08% | 1.8% | $0.003 |
| 1.0C, 25C, 20-80% SoC | 0.09% | 1.8% | $0.004 |
| 1.0C, 40C, 20-80% SoC | 0.14% | 2.9% | $0.006 |
| 2.0C, 25C, 20-80% SoC | 0.13% | 1.8% | $0.006 |
| 2.0C, 45C, 10-95% SoC | 0.25% | 3.5% | $0.011 |
| 1.0C, -5C, 20-80% SoC | 0.18% | 1.2% | $0.008 |

**Airside-specific insight**: Tarmac temperatures can exceed 50C in summer, which pushes cycle aging 2-3x above laboratory conditions. The co-optimizer should use real-time battery temperature (from BMS CAN data), not ambient temperature, and proactively reduce C-rate during summer afternoon peaks.

### 4.4 Lifetime Projection Under Different Strategies

```
Pack lifetime to 80% SoH, 60 kWh LiFePO4, 25C average:

Naive fast-charge (2C whenever available, full 0-100% swings):
  Throughput to 80%: ~180,000 kWh
  At 40 kWh/day usage: ~4,500 days = 12.3 years (but calendar aging dominates)
  Actual lifetime: ~5-6 years (calendar aging in hot climate)
  Annualized replacement: $1,500-1,800/year

Degradation-aware opportunity charging (0.5-1C, 25-80% SoC):
  Throughput to 80%: ~280,000 kWh
  At 40 kWh/day usage: ~7,000 days
  Actual lifetime: ~7-8 years
  Annualized replacement: $1,125-1,285/year

Savings per vehicle: $300-600/year
50-vehicle fleet savings: $15,000-30,000/year

Including avoided downtime for replacement (2 days/vehicle):
  50 vehicles * 0.15 replacements_avoided/year * 2 days * $800/day_lost_revenue
  = $12,000/year additional savings
```

---

## 5. Stochastic EVRP for Airport Operations

### 5.1 Sources of Uncertainty

Airport operations are inherently stochastic. A deterministic EVRP plan becomes obsolete within minutes. The three primary uncertainty sources are:

| Source | Uncertainty | Distribution | Impact on Energy Plan |
|---|---|---|---|
| Aircraft arrival delay | Mean 8 min, std 15 min (EUROCONTROL 2024) | Log-normal | Shifts entire turnaround timeline; idle vehicles burn energy waiting |
| Turnaround duration | Mean +/- 20% from scheduled | Normal, truncated | Extends/compresses task windows |
| Energy consumption | +/- 15% from predicted (wind, payload, route) | Normal | SoC prediction error; may miss charge window |
| Charger availability | MTBF ~2,000 hours for DC fast chargers | Exponential failure | Alternate charger routing; queue cascades |
| Weather events | Probability varies by season and location | Poisson arrival | Operations hold = all vehicles idle, mass charging demand |
| Grid price spikes | Demand response events, 1-5 per month | Infrequent, high-impact | V2G opportunity or load-shedding trigger |

### 5.2 Robust Optimization Approach

For the planning horizon (2-8 hours), we use a **robust counterpart** of the deterministic EVRP that guarantees feasibility against bounded uncertainty:

```
Robust EVRP formulation:
  For each vehicle v, at each time step t:
  
  SoC_v(t) = SoC_v(0) - Σ_{i=1}^{t} (consumption_i + Δ_i) + Σ_{j} charge_j
  
  Where Δ_i ∈ [-δ_max, +δ_max] is bounded consumption uncertainty
  
  Robust constraint (Bertsimas & Sim, 2004):
    SoC_v(t) ≥ SoC_min + Γ * δ_max   ∀ t
  
  Γ ∈ [0, T] is the "budget of uncertainty" controlling conservatism:
    Γ = 0: deterministic (no protection)
    Γ = T: worst-case (overly conservative)
    Γ = √T: typical choice (protects against √T simultaneous deviations)
  
  For T = 8 time steps (2-hour window):
    Γ = √8 ≈ 2.83
    δ_max = 0.15 * avg_consumption ≈ 1.0 kWh per step
    Robust reserve = 2.83 * 1.0 = 2.83 kWh ≈ 4.7% of 60 kWh pack
```

This adds ~5% SoC reserve compared to deterministic planning --- a modest cost for guaranteed feasibility under normal uncertainty.

### 5.3 Chance-Constrained Programming

For tighter optimization (when 5% reserve is too conservative for some vehicles), we use **chance constraints** that allow small probability of violation:

```
Chance-constrained EVRP:
  P(SoC_v(t) ≥ SoC_min) ≥ 1 - ε   ∀v, t
  
  With ε = 0.01 (99% confidence):
  
  Equivalent deterministic constraint (for Normal distribution):
    E[SoC_v(t)] - z_{1-ε} * σ[SoC_v(t)] ≥ SoC_min
    E[SoC_v(t)] - 2.326 * σ[SoC_v(t)] ≥ SoC_min
  
  For σ = 2.0 kWh at 2-hour horizon:
    Reserve = 2.326 * 2.0 = 4.65 kWh ≈ 7.8% of 60 kWh
    
  At ε = 0.05 (95%):
    Reserve = 1.645 * 2.0 = 3.29 kWh ≈ 5.5%
```

### 5.4 Rolling Horizon MPC

The practical implementation uses **Model Predictive Control** with a rolling horizon:

```
MPC Rolling Horizon:

  Planning horizon: H = 2 hours (8 × 15-min steps)
  Execution horizon: E = 15-30 minutes (1-2 steps)
  Re-plan trigger: every E minutes OR on event (delay, failure, weather)

  ┌─────────────────────────────────────────────┐
  │ t=0    t=15   t=30   t=45   ...   t=120     │
  │ ├──────┤ execute                             │
  │ ├──────────────────────────────────────────┤ │
  │ └────── plan (optimize over full H) ───────┘ │
  │                                               │
  │ At t=15: re-plan with updated state           │
  │ ├──────┤ execute                              │
  │ ├──────────────────────────────────────────┤  │
  │ └────── plan (shift horizon by E) ─────────┘  │
  └───────────────────────────────────────────────┘

  Benefits:
  - Absorbs uncertainty: plan is always based on latest state
  - Handles events: charger failure triggers immediate re-plan
  - Computational tractability: 2-hour horizon is solvable in <30 seconds
  - A-CDM integration: ELDT/EIBT updates feed directly into re-plan
```

### 5.5 Scenario-Based Stochastic Programming

For the strategic planning horizon (shift-level, 8 hours), we use **two-stage stochastic programming** with scenario sampling:

```python
def two_stage_stochastic_evrp(
    vehicles: List[VehicleState],
    tasks: List[Task],
    chargers: List[ChargerState],
    n_scenarios: int = 20,
) -> Schedule:
    """
    Stage 1 (here-and-now): Assign vehicles to tasks, select charging plan
    Stage 2 (recourse): Adjust schedule when uncertainty is revealed
    
    Scenarios sampled from historical A-CDM delay distributions.
    """
    scenarios = sample_delay_scenarios(tasks, n_scenarios)
    
    model = cp_model.CpModel()
    
    # Stage 1 variables (common across scenarios)
    assign = {}  # assign[v, t] = 1 if vehicle v does task t
    charge_plan = {}  # charge_plan[v, c, slot] = 1 if v charges at c in slot
    
    for v in vehicles:
        for t in tasks:
            if compatible(v, t):
                assign[v.id, t.id] = model.NewBoolVar(f'assign_{v.id}_{t.id}')
    
    # Stage 2 variables (per scenario)
    for s in range(n_scenarios):
        # Recourse: delayed task start times, adjusted charging
        for v in vehicles:
            for t in tasks:
                # Actual start time may differ from planned
                start_s = model.NewIntVar(0, 1440, f'start_{v.id}_{t.id}_{s}')
    
    # Objective: minimize expected cost across scenarios
    total_cost = 0
    for s, scenario in enumerate(scenarios):
        prob = 1.0 / n_scenarios
        scenario_cost = compute_scenario_cost(
            model, assign, charge_plan, scenario, vehicles, chargers
        )
        total_cost += prob * scenario_cost
    
    model.Minimize(total_cost)
    
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 60
    status = solver.Solve(model)
    
    return extract_schedule(solver, assign, charge_plan)
```

---

## 6. Vehicle-to-Grid (V2G) for Airports

### 6.1 The Airport V2G Opportunity

Airports are among the largest single-site electricity consumers. A major hub airport consumes 200-600 GWh/year, with peak demand of 50-100 MW driven by terminal HVAC, lighting, baggage systems, and de-icing operations. Electricity cost is typically the 2nd or 3rd largest airport operating expense.

A 50-vehicle autonomous GSE fleet with 60 kWh batteries represents:

```
Aggregate storage capacity:
  50 vehicles × 60 kWh = 3,000 kWh = 3 MWh total
  
Usable V2G capacity (keeping 30% SoC reserve for operations):
  50 × 60 × (SoC_current - 0.30) ≈ 1.0-1.5 MWh dispatchable
  
Peak discharge power (at 20 kW per vehicle):
  50 × 20 kW = 1,000 kW = 1 MW for up to 1-1.5 hours
  
Context: 1 MW is small relative to airport peak demand (50-100 MW)
  but significant for demand charge management (shaving 1 MW peak
  at $15/kW/month = $15,000/month = $180,000/year savings)
```

### 6.2 V2G Revenue Streams

| Revenue Stream | Value | Mechanism | Applicability |
|---|---|---|---|
| **Demand charge avoidance** | $10-20/kW/month | Discharge during site 15-min peak intervals | Always applicable |
| **Time-of-use arbitrage** | $0.05-0.15/kWh spread | Charge off-peak, discharge on-peak | Where TOU rates exist |
| **Demand response programs** | $50-200/MWh (event-based) | ISO/utility pays for load reduction during grid stress | US (PJM, CAISO, ERCOT), UK, some EU |
| **Frequency regulation** | $15-40/MW/hour | Fast response to grid frequency deviations | Requires bidirectional charger + telemetry |
| **Airport PPA optimization** | Varies | Reduce peak that determines airport's power purchase terms | Long-term contract benefit |

### 6.3 V2G Degradation Cost vs Revenue

The critical question: does V2G revenue exceed the battery degradation cost of additional cycling?

```python
def v2g_net_value_per_event(
    energy_kwh: float,          # Energy discharged
    discharge_c_rate: float,    # Typically 0.3-0.5C for V2G
    charge_c_rate: float,       # Rate to replenish
    revenue_per_kwh: float,     # Demand response or TOU arbitrage
    battery_temp_c: float,
    soc_start: float,
    pack_cost: float = 9000,
    pack_capacity: float = 60,
) -> dict:
    """
    Calculate net value of a V2G discharge event.
    
    Must account for:
    1. Revenue from energy sold / demand charge avoided
    2. Cost of energy to replenish (electricity cost)
    3. Round-trip efficiency loss (90-92% for DC V2G)
    4. Additional cycle degradation from V2G cycling
    """
    # Revenue
    revenue = energy_kwh * revenue_per_kwh
    
    # Replenishment cost (must buy back more due to round-trip losses)
    rt_efficiency = 0.91  # Typical bidirectional charger
    replenish_kwh = energy_kwh / rt_efficiency
    electricity_cost = replenish_kwh * 0.08  # $/kWh off-peak rate
    
    # Degradation cost for discharge cycle
    dod_v2g = energy_kwh / pack_capacity
    model = LiFePO4DegradationModel(pack_capacity, 51.2)
    
    degrad_discharge = model.degradation_cost_per_kwh(
        discharge_c_rate, battery_temp_c, soc_start - dod_v2g/2, dod_v2g, pack_cost
    ) * energy_kwh
    
    degrad_recharge = model.degradation_cost_per_kwh(
        charge_c_rate, battery_temp_c, soc_start - dod_v2g, dod_v2g, pack_cost
    ) * replenish_kwh
    
    total_degrad = degrad_discharge + degrad_recharge
    
    net_value = revenue - electricity_cost - total_degrad
    
    return {
        'revenue': revenue,
        'electricity_cost': electricity_cost,
        'degradation_cost': total_degrad,
        'net_value': net_value,
        'roi_pct': (net_value / total_degrad) * 100 if total_degrad > 0 else float('inf'),
    }
```

### 6.4 V2G Economics Summary

For a 10 kWh V2G discharge event at 0.3C:

| Scenario | Revenue | Electricity Cost | Degradation Cost | Net Value | Worth It? |
|---|---|---|---|---|---|
| TOU arbitrage ($0.10/kWh spread) | $1.00 | $0.88 | $0.06 | **$0.06** | Marginal |
| Demand charge avoidance ($15/kW) | $2.50* | $0.88 | $0.06 | **$1.56** | Yes |
| Demand response ($150/MWh event) | $1.50 | $0.88 | $0.06 | **$0.56** | Yes |
| Grid emergency ($500/MWh) | $5.00 | $0.88 | $0.06 | **$4.06** | Very yes |

*Demand charge avoidance: 10 kWh at 20 kW for 30 min reduces peak by 20 kW = $300/month / 120 events = $2.50/event.

**Conclusion**: V2G is clearly profitable for demand charge avoidance and demand response events, marginal for pure arbitrage, and always profitable during grid stress events. The co-optimizer should:
- Always participate in demand charge shaving (highest ROI)
- Participate in demand response programs when vehicles are idle and SoC > 50%
- Avoid pure TOU arbitrage unless spread exceeds $0.15/kWh
- Never V2G when vehicle is needed for tasks within the next 30 minutes

### 6.5 V2G Architecture for Airport GSE

```
                    Airport Grid (50-100 MW)
                           │
                    ┌──────┴──────┐
                    │  Substation  │
                    │  (2-10 MVA)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────┴─────┐ ┌───┴───┐ ┌─────┴─────┐
        │ Terminal   │ │ Apron │ │ GSE Depot  │
        │ Load       │ │ Load  │ │ Charging   │
        │ (HVAC,     │ │ (GPU, │ │ Hub        │
        │  lighting) │ │  PCA) │ │            │
        └───────────┘ └───────┘ └─────┬──────┘
                                       │
                         ┌─────────────┼──────────────┐
                         │             │              │
                    ┌────┴────┐  ┌────┴────┐   ┌────┴────┐
                    │Bi-dir DC│  │Bi-dir DC│   │  AC L2  │
                    │Charger 1│  │Charger 2│   │Array    │
                    │(50 kW)  │  │(50 kW)  │   │(7kW x24)│
                    └────┬────┘  └────┬────┘   └────┬────┘
                         │            │             │
                    ┌────┴────┐  ┌────┴────┐  ┌────┴────┐
                    │Vehicle 1│  │Vehicle 2│  │Vehicles │
                    │(idle,   │  │(idle,   │  │3-24     │
                    │V2G mode)│  │charging)│  │(depot)  │
                    └─────────┘  └─────────┘  └─────────┘
              
        Fleet Energy Manager (cloud/edge)
        ├── Monitors grid price signals (OpenADR 2.0b)
        ├── Monitors vehicle SoC + task schedule
        ├── Sends V2G dispatch: vehicle_id, power_kw, duration_min
        └── Integrates with airport EMS via Modbus TCP / BACnet
```

### 6.6 Airport-Specific V2G Considerations

1. **Fire safety**: Bidirectional charging near aircraft requires fire suppression systems compliant with NFPA 409 (aircraft hangars) and NFPA 855 (energy storage). V2G chargers at gate-side locations need additional spacing from fuel hydrants (minimum 6m per IATA AHM).

2. **Power quality**: Airport critical loads (navigation aids, runway lighting, ATC systems) require clean power. V2G inverters must meet IEEE 1547-2018 for distributed energy resource interconnection, with THD < 5%.

3. **Redundancy**: V2G must never leave a vehicle unable to respond to an emergency dispatch. A minimum 30% SoC reserve and immediate V2G curtailment on task assignment are non-negotiable.

---

## 7. Grid-Aware Scheduling and Demand Charge Management

### 7.1 Airport Electricity Tariff Structure

Airports typically pay commercial/industrial electricity rates with three components:

```
Monthly electricity bill = Energy charge + Demand charge + Fixed charges

Energy charge:
  Varies by time-of-use (TOU) tier
  Off-peak (22:00-06:00):    $0.04-0.08/kWh
  Mid-peak (06:00-12:00):    $0.08-0.14/kWh
  On-peak (12:00-22:00):     $0.12-0.22/kWh
  
  Typical airport average:   $0.08-0.12/kWh

Demand charge:
  Based on peak 15-minute average demand in the billing period
  $10-20/kW/month (US average for commercial/industrial)
  
  Example: if fleet creates a 500 kW charging spike for 15 minutes,
  demand charge = 500 kW × $15/kW = $7,500 for that MONTH
  
  This is the SINGLE MOST CONTROLLABLE cost in fleet charging.

Fixed charges:
  Service charge, meter charge, power factor penalties
  Relatively small and not controllable by fleet scheduling
```

### 7.2 Demand Charge Spike Anatomy

The worst-case scenario for demand charges:

```
Flight arrival wave: 06:00-06:30 (morning bank)
  15 vehicles complete tasks simultaneously around 06:45
  All 15 have SoC < 30% (morning rush depleted batteries)
  All 15 drive to chargers (10 DC fast, 5 queueing)
  
  Peak: 10 × 50 kW + 5 × 7.2 kW (overflow to AC) = 536 kW
  This is 536 kW in the demand charge window.
  
  Cost: 536 kW × $15/kW/month = $8,040/month demand charge
  
  Annualized: $96,480/year JUST from this one spike pattern
```

Compare with optimized staggered charging:

```
  Co-optimizer staggers charging across 06:30-08:00 window:
    06:30-06:45: 3 vehicles × 50 kW = 150 kW
    06:45-07:00: 3 vehicles × 50 kW = 150 kW
    07:00-07:15: 3 vehicles × 50 kW = 150 kW (peak = 150 kW)
    07:15-07:30: 3 vehicles × 50 kW = 150 kW
    07:30-08:00: 3 vehicles × 50 kW = 150 kW
    
  Some vehicles get lower-priority tasks while waiting to charge
  Some vehicles opportunity-charge at 30 kW instead of 50 kW
  
  Peak: 150 kW (not 536 kW)
  Cost: 150 kW × $15/kW/month = $2,250/month
  
  Savings: $5,790/month = $69,480/year
```

### 7.3 Load Balancing Algorithm

```python
class DemandChargeOptimizer:
    """
    Manages fleet-wide charging power to minimize demand charge.
    
    Operates on 15-minute intervals (matching utility metering).
    Allocates total site power budget across active charging sessions.
    """
    
    def __init__(
        self,
        site_power_limit_kw: float,      # Transformer capacity
        demand_charge_per_kw: float,       # $/kW/month
        current_month_peak_kw: float,      # Highest 15-min avg so far this month
        chargers: List[ChargerState],
    ):
        self.site_limit = site_power_limit_kw
        self.dc_rate = demand_charge_per_kw
        self.month_peak = current_month_peak_kw
        self.chargers = chargers
    
    def allocate_power(
        self,
        charging_requests: List[ChargingRequest],
        background_load_kw: float,  # Non-GSE site load (terminal, etc.)
    ) -> Dict[str, float]:
        """
        Allocate charging power to each vehicle to minimize demand charge
        while respecting charger limits and vehicle urgency.
        
        Returns: {vehicle_id: allocated_power_kw}
        """
        # Available power for GSE charging
        available = self.site_limit - background_load_kw
        
        # Target: stay below current month peak (avoid setting new peak)
        target_total = min(available, self.month_peak - background_load_kw)
        target_total = max(target_total, 0)
        
        # Sort by urgency: low SoC + upcoming task = highest priority
        requests_sorted = sorted(
            charging_requests,
            key=lambda r: r.urgency_score(),  # Higher = more urgent
            reverse=True,
        )
        
        allocation = {}
        remaining_power = target_total
        
        for req in requests_sorted:
            if remaining_power <= 0:
                allocation[req.vehicle_id] = 0  # Defer this vehicle
                continue
            
            # Minimum useful charge: 5 kW (below this, overhead exceeds benefit)
            min_useful = 5.0
            
            # Maximum: charger limit or remaining budget
            max_power = min(req.charger_max_kw, remaining_power)
            
            if max_power < min_useful:
                allocation[req.vehicle_id] = 0
            else:
                # Select power level balancing urgency vs demand charge
                if req.urgency_score() > 0.8:  # Critical (SoC < 20%, task soon)
                    power = max_power
                elif req.urgency_score() > 0.5:  # High
                    power = min(max_power, 0.7 * req.charger_max_kw)
                else:  # Normal
                    power = min(max_power, 0.5 * req.charger_max_kw)
                
                allocation[req.vehicle_id] = power
                remaining_power -= power
        
        return allocation
    
    def evaluate_new_peak_cost(self, proposed_load_kw: float) -> float:
        """
        Calculate the cost of setting a new demand charge peak.
        
        If proposed_load > current_month_peak, the incremental cost
        is (proposed - current) * demand_charge_rate for the ENTIRE month.
        """
        if proposed_load_kw <= self.month_peak:
            return 0  # No new peak, no incremental cost
        
        increment = proposed_load_kw - self.month_peak
        return increment * self.dc_rate  # Cost for entire billing period
```

### 7.4 Time-of-Use Optimization

The co-optimizer shifts discretionary charging to off-peak hours while ensuring operational readiness:

```
Daily charging profile (50-vehicle fleet, optimized):

                Off-peak          Mid-peak            On-peak          Off-peak
               ($0.06/kWh)      ($0.10/kWh)        ($0.16/kWh)      ($0.06/kWh)
    kW  
    600 ┤
        │
    500 ┤  ████                                                      ████
        │  ████                                                      ████
    400 ┤  ████                                                      ████
        │  ████                                                      ████
    300 ┤  ████   ████                              ████             ████
        │  ████   ████                              ████             ████
    200 ┤  ████   ████    ████    ████    ████      ████    ████     ████
        │  ████   ████    ████    ████    ████      ████    ████     ████
    100 ┤  ████   ████    ████    ████    ████      ████    ████     ████
        │  ████   ████    ████    ████    ████      ████    ████     ████
      0 ┼──┴────┴────┴────┴────┴────┴────┴────┴────┴────┴────┴──────┴────
       22:00   00:00   02:00   06:00   08:00  12:00  16:00  20:00  22:00
       
    Key:
    ████  Depot charging (AC L2, scheduled to off-peak)
    ████  Opportunity charging (DC fast, as needed for ops)
    ████  Minimum operational charging (highest urgency only)
```

### 7.5 Integration with Airport Energy Management

```
Airport EMS ◄──── BACnet/Modbus TCP ────► GSE Fleet Energy Manager
    │                                              │
    │  Provides:                                   │  Provides:
    │  - Real-time site load                       │  - Fleet charging forecast
    │  - Demand response signals                   │  - V2G availability
    │  - TOU rate schedule                         │  - Demand flexibility
    │  - PV generation forecast                    │  - Emergency curtailment
    │                                              │
    │  Protocol options:                           │
    │  - OpenADR 2.0b (demand response)            │
    │  - IEEE 2030.5 (DER management)              │
    │  - OCPP 2.0.1 (charger communication)        │
    └──────────────────────────────────────────────┘
```

---

## 8. Joint Optimization Algorithms

### 8.1 Algorithm Comparison

| Algorithm | Fleet Size | Optimality | Solve Time | Handles Stochastic | Implementation Complexity |
|---|---|---|---|---|---|
| MILP (Gurobi/CPLEX) | <50 vehicles | Optimal (with gap) | 30-120s | With scenarios (slow) | High |
| CP-SAT (OR-Tools) | <100 vehicles | Near-optimal | 10-60s | Limited | Medium |
| Column Generation | 50-500 vehicles | Near-optimal | 60-300s | With scenarios | Very high |
| Benders Decomposition | 50-200 vehicles | Optimal | 30-180s | Natural fit | High |
| ADMM | 50-500+ vehicles | Near-optimal | 10-60s | Per-agent scenarios | Medium |
| PPO (RL) | Any | Learned | <1ms inference | Naturally stochastic | High (training) |
| Greedy heuristic | Any | 80-90% of optimal | <1ms | Rule-based | Low |

### 8.2 MILP Formulation (Exact, for <50 Vehicles)

```python
import gurobipy as gp
from gurobipy import GRB

def solve_joint_evrp_milp(
    vehicles: List[VehicleState],
    tasks: List[Task],
    chargers: List[ChargerState],
    time_steps: int = 96,  # 15-min intervals over 24 hours
    demand_charge_rate: float = 15.0,  # $/kW/month
) -> Schedule:
    """
    Exact MILP formulation for joint task-charging-V2G optimization.
    
    Solves to optimality for fleets up to ~50 vehicles.
    For larger fleets, use decomposition (Section 8.4) or RL (Section 8.6).
    """
    model = gp.Model("EVRP_Joint")
    
    V = range(len(vehicles))
    T = range(len(tasks))
    C = range(len(chargers))
    S = range(time_steps)
    
    # --- Decision variables ---
    
    # Task assignment: x[v, t] = 1 if vehicle v serves task t
    x = model.addVars(V, T, vtype=GRB.BINARY, name="assign")
    
    # Charging: y[v, c, s] = 1 if vehicle v charges at charger c in step s
    y = model.addVars(V, C, S, vtype=GRB.BINARY, name="charge")
    
    # Charging power: p[v, c, s] in [0, P_max]
    p = model.addVars(V, C, S, lb=0, name="charge_power")
    
    # V2G discharge: d[v, c, s] = 1 if vehicle v discharges
    d = model.addVars(V, C, S, vtype=GRB.BINARY, name="v2g")
    
    # V2G power: q[v, c, s] in [0, Q_max]
    q = model.addVars(V, C, S, lb=0, name="v2g_power")
    
    # SoC tracking: soc[v, s] continuous
    soc = model.addVars(V, S, lb=0, ub=1, name="soc")
    
    # Peak demand: peak_kw continuous
    peak_kw = model.addVar(lb=0, name="peak_demand")
    
    # Tardiness: late[t] continuous, >= 0
    late = model.addVars(T, lb=0, name="tardiness")
    
    # --- Constraints ---
    
    # Each task assigned to exactly one compatible vehicle
    for t in T:
        model.addConstr(
            gp.quicksum(x[v, t] for v in V if compatible(vehicles[v], tasks[t])) == 1,
            name=f"task_cover_{t}"
        )
    
    # Vehicle does at most one thing per time step (task, charge, or V2G)
    for v in V:
        for s in S:
            model.addConstr(
                gp.quicksum(y[v, c, s] for c in C) + 
                gp.quicksum(d[v, c, s] for c in C) +
                task_active(v, s, x) <= 1,
                name=f"one_action_{v}_{s}"
            )
    
    # Charger capacity: at most one vehicle per charger per step
    for c in C:
        for s in S:
            model.addConstr(
                gp.quicksum(y[v, c, s] + d[v, c, s] for v in V) <= 1,
                name=f"charger_cap_{c}_{s}"
            )
    
    # Charge power linked to binary
    for v in V:
        for c in C:
            for s in S:
                model.addConstr(
                    p[v, c, s] <= chargers[c].max_power_kw * y[v, c, s]
                )
                model.addConstr(
                    q[v, c, s] <= chargers[c].max_power_kw * d[v, c, s]
                )
    
    # SoC dynamics
    for v in V:
        model.addConstr(soc[v, 0] == vehicles[v].soc)
        for s in S[1:]:
            consumption = energy_consumed_in_step(v, s, x)  # From tasks + travel
            charged = gp.quicksum(
                p[v, c, s-1] * 0.25 / vehicles[v].battery_capacity_kwh  # 15-min step
                for c in C
            )
            discharged = gp.quicksum(
                q[v, c, s-1] * 0.25 / vehicles[v].battery_capacity_kwh
                for c in C
            )
            model.addConstr(
                soc[v, s] == soc[v, s-1] - consumption + charged - discharged
            )
    
    # SoC bounds
    for v in V:
        for s in S:
            model.addConstr(soc[v, s] >= 0.15)  # Min 15%
            model.addConstr(soc[v, s] <= 0.90)  # Max 90% (battery health)
    
    # Peak demand tracking
    for s in S:
        total_charge_power = gp.quicksum(p[v, c, s] for v in V for c in C)
        model.addConstr(peak_kw >= total_charge_power)
    
    # --- Objective ---
    
    # Electricity cost (time-varying)
    energy_cost = gp.quicksum(
        tou_rate(s) * p[v, c, s] * 0.25  # kWh = kW * 0.25hr
        for v in V for c in C for s in S
    )
    
    # Demand charge
    demand_cost = peak_kw * demand_charge_rate
    
    # Tardiness penalty
    tardiness_cost = gp.quicksum(late[t] * 100 for t in T)  # $100/min late
    
    # Degradation cost
    degrad_cost = gp.quicksum(
        degradation_rate(p[v, c, s], vehicles[v]) * p[v, c, s] * 0.25
        for v in V for c in C for s in S
    )
    
    # V2G revenue (negative cost)
    v2g_revenue = gp.quicksum(
        v2g_rate(s) * q[v, c, s] * 0.25
        for v in V for c in C for s in S
    )
    
    model.setObjective(
        energy_cost + demand_cost + tardiness_cost + degrad_cost - v2g_revenue,
        GRB.MINIMIZE
    )
    
    model.Params.TimeLimit = 120  # 2-minute solve limit
    model.Params.MIPGap = 0.02   # 2% optimality gap acceptable
    model.optimize()
    
    return extract_schedule(model, x, y, p, d, q, soc)
```

### 8.3 CP-SAT Formulation (Practical, <100 Vehicles)

CP-SAT from OR-Tools (the same solver used for task allocation in `../../30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md`) can handle the energy co-optimization with appropriate modeling:

```python
from ortools.sat.python import cp_model

def solve_joint_evrp_cpsat(
    vehicles: List[VehicleState],
    tasks: List[Task],
    chargers: List[ChargerState],
    time_steps: int = 96,
) -> Schedule:
    """
    CP-SAT formulation using interval variables and NoOverlap.
    
    Advantages over MILP:
    - NoOverlap constraint natively handles charger exclusivity
    - Better scaling for scheduling-heavy problems (50-100 vehicles)
    - Free (no Gurobi license)
    
    Disadvantages:
    - Continuous variables (power, SoC) must be discretized
    - Degradation cost approximated with piecewise linear
    """
    model = cp_model.CpModel()
    
    # Discretize SoC to integer percentage (0-100)
    # Discretize power to 5 kW steps
    POWER_STEPS = 10  # 0, 5, 10, ..., 50 kW for DC fast
    
    # Task intervals (from fleet-task-allocation-scheduling.md)
    task_intervals = {}
    for v_idx, v in enumerate(vehicles):
        for t_idx, t in enumerate(tasks):
            if not compatible(v, t):
                continue
            start = model.NewIntVar(0, time_steps - 1, f'start_{v_idx}_{t_idx}')
            duration = task_duration_steps(v, t)
            end = model.NewIntVar(0, time_steps, f'end_{v_idx}_{t_idx}')
            present = model.NewBoolVar(f'present_{v_idx}_{t_idx}')
            interval = model.NewOptionalIntervalVar(
                start, duration, end, present, f'task_{v_idx}_{t_idx}'
            )
            task_intervals[v_idx, t_idx] = (interval, present, start, end)
    
    # Charging intervals
    charge_intervals = {}
    for v_idx, v in enumerate(vehicles):
        for c_idx, c in enumerate(chargers):
            for slot in range(max_charge_sessions_per_vehicle()):
                start = model.NewIntVar(0, time_steps - 1, f'cs_{v_idx}_{c_idx}_{slot}')
                duration = model.NewIntVar(1, 8, f'cd_{v_idx}_{c_idx}_{slot}')  # 15-120 min
                end = model.NewIntVar(0, time_steps, f'ce_{v_idx}_{c_idx}_{slot}')
                present = model.NewBoolVar(f'cp_{v_idx}_{c_idx}_{slot}')
                interval = model.NewOptionalIntervalVar(
                    start, duration, end, present, f'charge_{v_idx}_{c_idx}_{slot}'
                )
                power_level = model.NewIntVar(0, POWER_STEPS, f'pow_{v_idx}_{c_idx}_{slot}')
                charge_intervals[v_idx, c_idx, slot] = (interval, present, start, end, duration, power_level)
    
    # NoOverlap per vehicle (cannot do two things at once)
    for v_idx in range(len(vehicles)):
        vehicle_intervals = []
        for key, val in task_intervals.items():
            if key[0] == v_idx:
                vehicle_intervals.append(val[0])
        for key, val in charge_intervals.items():
            if key[0] == v_idx:
                vehicle_intervals.append(val[0])
        model.AddNoOverlap(vehicle_intervals)
    
    # NoOverlap per charger (one vehicle at a time)
    for c_idx in range(len(chargers)):
        charger_intervals = []
        for key, val in charge_intervals.items():
            if key[1] == c_idx:
                charger_intervals.append(val[0])
        model.AddNoOverlap(charger_intervals)
    
    # ... (SoC tracking with cumulative constraints, similar to MILP)
    
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 60
    solver.parameters.num_workers = 8  # Parallel search
    status = solver.Solve(model)
    
    return extract_schedule_cpsat(solver, task_intervals, charge_intervals)
```

### 8.4 Benders Decomposition (50-200 Vehicles)

For larger fleets, Benders decomposition separates the problem into a master (task assignment + charging binary decisions) and subproblem (energy flow, SoC tracking, V2G dispatch):

```
Benders Decomposition:

Master Problem (combinatorial):
  - Task-to-vehicle assignment
  - Charging station assignment (which vehicle at which charger)
  - Solve with CP-SAT or MILP
  
Subproblem (continuous):
  - Given assignments, optimize charging power profiles
  - SoC feasibility check
  - Demand charge minimization
  - V2G dispatch
  - Solve with LP (linear programming, fast)
  
Iteration:
  1. Solve master → get assignment
  2. Solve subproblem → get energy cost, or detect infeasibility
  3. If infeasible: add feasibility cut to master ("this assignment 
     can't meet SoC constraints")
  4. If feasible: add optimality cut to master ("any assignment at 
     least as expensive as this lower bound")
  5. Repeat until gap < 2%
  
Typical convergence: 5-15 iterations
Total time: 60-180 seconds for 200 vehicles
```

### 8.5 ADMM for Distributed Fleet Optimization

When vehicles have on-board compute (Orin), ADMM (Alternating Direction Method of Multipliers) enables distributed optimization where each vehicle solves its own subproblem:

```
ADMM Decomposition:

Global consensus variables:
  - Charger occupancy schedule
  - Total site power per time step
  - V2G dispatch signals

Per-vehicle subproblem (runs on Orin):
  - Given charger schedule and prices, optimize own route + charging
  - Report preferred charging windows to coordinator
  
Coordinator (fleet server):
  - Aggregate vehicle preferences
  - Resolve conflicts (two vehicles want same charger same time)
  - Update dual variables (prices) to steer consensus
  - Broadcast updated schedule
  
Convergence: 10-50 iterations (1-5 seconds over 5G at 100 KB/iteration)
Advantage: degrades gracefully if communication drops (vehicle keeps last plan)
```

### 8.6 RL-Based Dispatch (Complementary to Optimization)

For real-time decision-making (<1ms latency requirement), a trained RL policy complements the MILP/CP-SAT planner. The fleet-task-allocation doc (`../../30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md`, Section 9) covers RL dispatch for task allocation; here we extend the state space with energy variables:

```python
class EnergyAwareDispatchEnv:
    """
    Gym environment for RL-based fleet energy dispatch.
    
    Extends the base dispatch environment from fleet-task-allocation-scheduling.md
    with energy state and charging actions.
    """
    
    def __init__(self, n_vehicles=50, n_chargers=10, n_tasks=200):
        # State space: per-vehicle + global
        self.observation_space = spaces.Dict({
            # Per vehicle (50 × 8 features)
            'vehicles': spaces.Box(low=0, high=1, shape=(n_vehicles, 8)),
            # Features: [soc, x, y, task_active, charge_active, 
            #            time_to_available, battery_health, urgency]
            
            # Per charger (10 × 4 features)
            'chargers': spaces.Box(low=0, high=1, shape=(n_chargers, 4)),
            # Features: [occupied, queue_len, x, y]
            
            # Global (6 features)
            'global': spaces.Box(low=0, high=1, shape=(6,)),
            # Features: [hour_sin, hour_cos, grid_price, demand_charge_risk,
            #            pending_tasks, weather_modifier]
        })
        
        # Action: for each idle vehicle, choose (task_id, charger_id, or wait)
        self.action_space = spaces.MultiDiscrete(
            [n_tasks + n_chargers + 1] * n_vehicles  # task/charger/wait per vehicle
        )
    
    def step(self, actions):
        # Execute actions (assign tasks, start charging, or wait)
        # Simulate 5-minute step (energy consumption, SoC updates, task progress)
        # Return reward
        
        reward = (
            - self.energy_cost()         # Electricity + demand charge
            - self.degradation_cost()    # Battery aging from charging decisions
            - self.tardiness_penalty()   # Late task completion
            + self.v2g_revenue()         # V2G income
            + self.utilization_bonus()   # Reward for high fleet utilization
        )
        
        return self.get_obs(), reward, done, info
```

Training approach: PPO with the same attention-based architecture described in `../../30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md`, Section 9. Adding 8 energy-related features per vehicle increases the observation space by ~12% with negligible inference overhead.

### 8.7 Algorithm Selection Guide

```
Decision tree for algorithm selection:

Fleet size?
├── <20 vehicles
│   └── MILP (Gurobi/CPLEX) — exact optimal, <30s solve time
│       License cost: $0 (academic) or $12K/year (commercial)
│
├── 20-50 vehicles
│   ├── CP-SAT (OR-Tools) for planning horizon (free, 30-60s)
│   └── RL policy for real-time dispatch (<1ms)
│
├── 50-200 vehicles
│   ├── Benders decomposition for planning (60-180s)
│   ├── CP-SAT for medium-term (10-60s)
│   └── RL policy for real-time dispatch (<1ms)
│
└── 200+ vehicles
    ├── ADMM distributed optimization (10-30s)
    ├── Column generation for shift planning (60-300s)
    └── RL policy for real-time dispatch (<1ms)

Recommendation for reference airside AV stack (20-50 vehicles, initial deployments):
  CP-SAT for 2-hour planning horizon (re-solve every 15 min)
  + RL policy for event-driven re-dispatch (<1ms)
  + Greedy heuristic as fallback when solver times out
```

---

## 9. Real-Time Adaptive Control via MPC

### 9.1 MPC Formulation

The MPC controller re-optimizes the energy plan every 15 minutes or on event triggers, using the CP-SAT solver with a 2-hour lookahead:

```python
class EnergyMPC:
    """
    Model Predictive Control for fleet energy co-optimization.
    
    Re-plans at fixed intervals (15 min) or event triggers.
    Uses CP-SAT for planning, greedy heuristic for emergency fallback.
    """
    
    def __init__(
        self,
        horizon_steps: int = 8,        # 2 hours at 15-min resolution
        replan_interval_min: int = 15,  # Nominal re-plan period
    ):
        self.horizon = horizon_steps
        self.replan_interval = replan_interval_min
        self.last_plan = None
        self.last_plan_time = None
    
    def should_replan(self, state: SystemState) -> bool:
        """Event-driven replanning triggers."""
        if self.last_plan is None:
            return True
        
        elapsed = state.time - self.last_plan_time
        if elapsed >= self.replan_interval * 60:
            return True  # Periodic replan
        
        # Event triggers
        if any(v.soc < 0.18 for v in state.vehicles):
            return True  # Emergency low battery
        
        if any(c.status == 'FAILED' for c in state.chargers):
            return True  # Charger failure
        
        if state.environment.weather_hold_active:
            return True  # Weather event changes everything
        
        if any(abs(f.delay_min) > 15 for f in state.environment.flight_schedule 
               if f.updated_since(self.last_plan_time)):
            return True  # Significant flight delay
        
        if state.grid.demand_response_event_active:
            return True  # V2G opportunity
        
        return False
    
    def plan(self, state: SystemState) -> EnergyPlan:
        """
        Generate new energy plan using CP-SAT with current state.
        """
        # Build forward model from current state
        tasks_in_horizon = self.get_tasks_in_horizon(state)
        
        # Predict energy needs
        for v in state.vehicles:
            v.predicted_consumption = self.predict_consumption(
                v, tasks_in_horizon, state.environment
            )
        
        # Predict A-CDM-based demand
        demand_forecast = self.forecast_charging_demand(
            state.environment.flight_schedule,
            state.vehicles,
        )
        
        # Solve (with timeout for real-time guarantee)
        try:
            plan = solve_joint_evrp_cpsat(
                state.vehicles,
                tasks_in_horizon,
                state.chargers,
                self.horizon,
            )
        except TimeoutError:
            plan = self.greedy_fallback(state)
        
        self.last_plan = plan
        self.last_plan_time = state.time
        return plan
    
    def predict_consumption(
        self,
        vehicle: VehicleState,
        tasks: List[Task],
        env: EnvironmentState,
    ) -> float:
        """
        Predict energy consumption for vehicle over horizon.
        
        Uses physics model (Section 2.3) with weather adjustment.
        """
        total_kwh = 0
        for task in tasks:
            if task.assigned_to == vehicle.id:
                distance = route_distance(vehicle.location, task.location)
                total_kwh += energy_consumption_kwh(
                    distance_km=distance,
                    payload_kg=task.payload_kg,
                    speed_kmh=15,  # Average apron speed
                    grade_pct=0,
                    headwind_mps=env.wind_speed_mps * 0.5,  # Conservative
                    ambient_temp_c=env.ambient_temp_c,
                    vehicle_type=vehicle.vehicle_type,
                )
                # Task execution energy
                total_kwh += task.duration_min * 0.05  # kWh/min while working
        
        # Idle consumption over horizon
        idle_time_hr = (self.horizon * 15 / 60) - sum(
            t.duration_min / 60 for t in tasks if t.assigned_to == vehicle.id
        )
        total_kwh += idle_time_hr * 0.06  # Orin idle power
        
        return total_kwh
```

### 9.2 SoC Prediction Accuracy

SoC prediction errors accumulate over the planning horizon. Empirical data from electric bus fleets:

| Horizon | Mean SoC Error | 95th Percentile Error | Source of Error |
|---|---|---|---|
| 15 min | 0.8% | 2.1% | Speed variation, payload estimation |
| 30 min | 1.5% | 3.8% | + Route deviation, traffic variation |
| 1 hour | 2.8% | 6.5% | + Weather change, task duration variance |
| 2 hours | 4.5% | 10.2% | + Flight delay cascade effects |
| 4 hours | 7.5% | 16.8% | Forecast becomes unreliable |

This justifies the 2-hour planning horizon: beyond 2 hours, SoC prediction error exceeds the robust reserve margin, and re-planning absorbs the error.

### 9.3 Reserve Energy Policies

```python
class ReserveEnergyPolicy:
    """
    Safety reserves that the co-optimizer must never violate.
    
    Three-tier reserve structure ensures operational safety.
    """
    
    RESERVES = {
        # Tier 1: Operational reserve — always maintain
        'operational': {
            'soc_min': 0.15,  # 15% = ~9 kWh for 60 kWh pack
            'purpose': 'Return to nearest charger from any point on airfield',
            'calculation': 'max_distance_to_charger * kwh_per_km * 1.5 safety_factor',
        },
        
        # Tier 2: Emergency reserve — below this triggers emergency mode
        'emergency': {
            'soc_min': 0.10,  # 10% = ~6 kWh
            'purpose': 'Safe stop + teleop recovery + limp to depot',
            'actions': ['reduce_speed_to_5kmh', 'reject_new_tasks', 'navigate_to_charger'],
        },
        
        # Tier 3: Critical reserve — hardware cutoff
        'critical': {
            'soc_min': 0.05,  # 5% = ~3 kWh
            'purpose': 'BMS hardware cutoff to prevent deep discharge damage',
            'actions': ['safe_stop_immediate', 'alert_teleop', 'request_tow'],
        },
    }
    
    # Weather-dependent reserve adjustment
    WEATHER_MULTIPLIERS = {
        'normal': 1.0,
        'rain': 1.15,     # Higher rolling resistance + reduced regen
        'snow': 1.25,     # Much higher resistance + heating needed
        'extreme_cold': 1.30,  # Battery capacity reduced at low temp
        'extreme_heat': 1.10,  # Thermal management overhead
    }
```

---

## 10. Airport-Specific Considerations

### 10.1 Charging Infrastructure Layout

Optimal charger placement is itself an optimization problem. For airport airside, the layout must consider:

```
Airport Charger Placement Constraints:

  Safety zones (chargers PROHIBITED):
    ✗ Within 15m of fuel hydrant pits
    ✗ Within designated fire lanes
    ✗ Within runway/taxiway safety areas
    ✗ Under jet blast zones (50m behind departure stands)
    ✗ Within aircraft movement areas

  Preferred locations:
    ✓ GSE staging areas (vehicles naturally idle here)
    ✓ Service road intersections (en-route opportunity)
    ✓ Near high-frequency turnaround stands
    ✓ Depot/maintenance area (overnight depot charging)
    ✓ Remote stands (vehicles wait longer, more time to charge)

  Example layout (medium hub, 50 GSE, 10 chargers):
  
    ┌─────────────────────────────────────────────────────────────┐
    │  Terminal Building                                           │
    │  ═══════════════════════════════════════════════════════════ │
    │  G1  G2  G3  G4  G5  G6  G7  G8  G9  G10 G11 G12          │
    │  ▲   ▲   ▲   ▲   ▲   ▲   ▲   ▲   ▲   ▲   ▲   ▲          │
    │  │   │   │   │   │   │   │   │   │   │   │   │             │
    │  └───┤   └───┤   └───┤   └───┤   └───┤   └───┤            │
    │      │       │       │       │       │       │              │
    │   [DC1]   [DC2]   [DC3]   [DC4]   [DC5]   [DC6]           │
    │   50kW    50kW    50kW    50kW    50kW    50kW             │
    │                                                             │
    │  ─ ─ ─ ─ ─ ─ ─ ─ Service Road ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
    │                                                             │
    │     [DC7]                                    [DC8]          │
    │     50kW                                     50kW           │
    │     (Staging                                 (Remote        │
    │      Area)                                    Stands)       │
    │                                                             │
    │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
    │                                                             │
    │  ┌─── GSE Depot ────────────────────────────┐               │
    │  │ [AC1-24] AC Level 2 (7.2kW each)         │               │
    │  │ 24 ports for overnight depot charging     │               │
    │  │ [DC9] [DC10] 2x DC Fast for urgent       │               │
    │  └──────────────────────────────────────────┘               │
    │                                                             │
    └─────────────────────────────────────────────────────────────┘
```

### 10.2 Fire Safety for Lithium Battery Charging

Charging LiFePO4 batteries near aircraft introduces specific fire safety requirements:

| Standard | Requirement | Implication for GSE Charging |
|---|---|---|
| NFPA 855 (2023) | ESS installations require fire detection, suppression, ventilation | Charging hubs need dedicated fire suppression (clean agent or water mist) |
| NFPA 409 | Aircraft hangar fire protection | Chargers on covered apron areas fall under NFPA 409 |
| IATA AHM 913 | GSE fire safety | 6m minimum separation from fuel operations |
| Airport authority | Varies | Many airports require fire risk assessment per charger location |

LiFePO4 is inherently safer than NMC (no thermal runaway), but airport authorities may still require:
- Battery fire detection (thermal camera on charger, see `../../30-autonomy-stack/perception/overview/night-operations-thermal-fusion.md`)
- Automatic charging disconnect on thermal anomaly
- Minimum 3m clearance between charging vehicles
- Fire extinguisher (Class D) at each charging station

### 10.3 Temperature Effects on Energy Economics

The tarmac temperature range of -10C to +50C creates a 30-40% swing in effective battery capacity and charging efficiency:

```
Temperature impact on 60 kWh LiFePO4 pack:

  -10C (winter dawn):
    Available capacity: ~48 kWh (80% of nominal)
    Charge acceptance: 50% derate (max 0.5C)
    Energy per km: +25% (cold tire, dense air, heating)
    Effective range: ~60% of summer baseline
    
    Implication: Winter operations need MORE frequent charging
    at LOWER rates. Fleet may need 10-20% more vehicles in winter
    OR accept 10-20% fewer missions per shift.

  +25C (ideal):
    Available capacity: ~60 kWh (100%)
    Charge acceptance: 100% (up to 2C)
    Energy per km: baseline
    Effective range: 100%

  +50C (summer afternoon):
    Available capacity: ~57 kWh (95%)
    Charge acceptance: 70-80% derate above 45C cell temp
    Energy per km: +10% (thermal management, A/C if equipped)
    Effective range: ~85% of baseline
    Battery degradation: 2-3x accelerated calendar aging
    
    Implication: Avoid fast charging in afternoon heat.
    Shift discretionary charging to cooler hours.
    Co-optimizer should include battery_temp as input.
```

### 10.4 A-CDM Integration for Demand Prediction

The co-optimizer consumes A-CDM (Airport Collaborative Decision Making) data to predict energy demand 2-4 hours ahead:

```python
def predict_charging_demand_from_acdm(
    flight_schedule: List[Flight],
    vehicles: List[VehicleState],
    horizon_hours: float = 2.0,
) -> List[Tuple[float, float]]:
    """
    Predict fleet-wide charging demand from A-CDM milestones.
    
    A-CDM provides:
    - EIBT (Estimated In-Block Time): when aircraft arrives at stand
    - ELDT (Estimated Landing Time): 15-30 min advance notice
    - TOBT (Target Off-Block Time): departure target
    - TSAT (Target Start-up Approval Time): when pushback is cleared
    
    From these, we can predict:
    1. Which stands will need GSE service and when
    2. Which vehicles will be busy (and consuming energy)
    3. Which vehicles will become idle (and available for charging)
    4. When the next demand surge will hit (and pre-charge before it)
    """
    demand_timeline = []
    
    for t in np.arange(0, horizon_hours * 60, 15):  # 15-min steps
        # Flights arriving in this window
        arriving = [f for f in flight_schedule 
                    if t <= (f.eibt - now()).minutes < t + 15]
        
        # Flights departing in this window
        departing = [f for f in flight_schedule 
                     if t <= (f.tobt - now()).minutes < t + 15]
        
        # Energy demand = vehicles needed × avg energy per turnaround
        turnarounds = len(arriving) + len(departing)
        gse_per_turnaround = 4  # Average GSE vehicles per turnaround
        energy_per_vehicle_kwh = 3.5  # Average per-turnaround consumption
        
        demand_kwh = turnarounds * gse_per_turnaround * energy_per_vehicle_kwh
        
        # Charging supply = idle vehicles × available charging slots
        busy_vehicles = estimate_busy_vehicles(t, flight_schedule)
        idle_vehicles = len(vehicles) - busy_vehicles
        
        demand_timeline.append((t, demand_kwh, idle_vehicles))
    
    return demand_timeline
```

### 10.5 Night Shift Charging Optimization

Night shifts (22:00-06:00) at hub airports typically see 60-80% reduction in flight movements. This creates a long window for depot charging at off-peak rates:

```
Night shift energy strategy:

22:00-00:00: Remaining evening flights
  - Opportunity charge between last tasks
  - Target: all vehicles reach depot by 00:00 with SoC > 20%

00:00-05:00: Low activity (2-5 flights, 5-10 vehicles on duty)
  - Depot AC charging: 24 vehicles × 7.2 kW = 173 kW
  - Stagger start times to avoid 173 kW spike:
    00:00: 8 vehicles start charging (58 kW)
    00:30: 8 vehicles start (58 kW, total 115 kW)
    01:00: 8 vehicles start (58 kW, total 173 kW)
    By 02:00: first batch complete, total drops to 115 kW
  - Peak never exceeds 173 kW (well within depot transformer capacity)
  - Cost: 24 × 50 kWh × $0.05/kWh (off-peak) = $60/night

05:00-06:00: Pre-morning preparation
  - All vehicles fully charged (SoC > 95%)
  - Run pre-shift diagnostics and perception calibration
  - Stage at assigned stands for morning bank

Annual night charging cost (depot only):
  $60/night × 365 = $21,900/year for 24 vehicles
  = $913/vehicle/year
  
Compare to 24-hour opportunity charging only:
  Higher avg rate ($0.10/kWh), more fast charge degradation
  $1,800/vehicle/year energy + $600/vehicle/year degradation
  = $2,400/vehicle/year
  
Night depot charging saves: ~$1,500/vehicle/year = $36,000/year for 24 vehicles
```

---

## 11. Implementation Architecture

### 11.1 System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                       Fleet Energy Manager (Edge Server / Cloud)       │
│                                                                        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  ┌───────────┐ │
│  │ CP-SAT /    │  │ MPC Rolling  │  │ Demand Charge │  │ V2G       │ │
│  │ MILP Solver │  │ Horizon      │  │ Manager       │  │ Dispatch  │ │
│  │ (plan 2hr)  │  │ (replan 15m) │  │ (15-min peak) │  │ (events)  │ │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  └─────┬─────┘ │
│         │                │                   │                │       │
│  ┌──────┴────────────────┴───────────────────┴────────────────┴──┐    │
│  │                     State Manager / Decision Engine            │    │
│  └──────┬──────────────────┬─────────────────┬──────────────────┘    │
│         │                  │                 │                        │
│  ┌──────┴──────┐  ┌───────┴───────┐  ┌─────┴──────┐                │
│  │ Vehicle     │  │ A-CDM         │  │ Grid       │                │
│  │ Telemetry   │  │ Integration   │  │ Interface  │                │
│  │ (ROS/MQTT)  │  │ (SWIM/AMQP)  │  │ (OpenADR)  │                │
│  └──────┬──────┘  └───────┬───────┘  └─────┬──────┘                │
│         │                  │                 │                        │
└─────────┼──────────────────┼─────────────────┼────────────────────────┘
          │                  │                 │
          │ 5G/CBRS          │ Airport SWIM     │ Utility
          │                  │                 │ Meter
    ┌─────┴───────────┐   ┌─┴──┐         ┌───┴───┐
    │ Vehicle Fleet   │   │ACDM│         │ Grid  │
    │ (50 vehicles)   │   │Sys │         │       │
    │ ┌───┐ ┌───┐     │   └────┘         └───────┘
    │ │V1 │ │V2 │ ... │
    │ └─┬─┘ └─┬─┘     │
    │   │     │        │
    │ ┌─┴─┐ ┌─┴─┐     │
    │ │BMS│ │BMS│      │
    │ └───┘ └───┘      │
    └─────────────────┘
```

### 11.2 ROS Integration

The energy co-optimizer integrates with the existing reference airside AV stack ROS Noetic stack as a fleet-level service. Individual vehicles publish battery state; the fleet manager publishes charging commands:

```python
# On-vehicle node: battery_state_publisher.py
# Reads BMS data via CAN, publishes to fleet manager

import rospy
from std_msgs.msg import Float32
from sensor_msgs.msg import BatteryState
from geometry_msgs.msg import PoseStamped

class BatteryStatePublisher:
    """
    Publishes vehicle battery state at 1 Hz to fleet manager via MQTT bridge.
    
    BMS data arrives via CAN bus (see 20-av-platform/drive-by-wire/can-bus-dbw.md).
    """
    def __init__(self):
        rospy.init_node('battery_state_publisher')
        
        self.pub = rospy.Publisher('/fleet/battery_state', BatteryState, queue_size=1)
        self.pose_sub = rospy.Subscriber('/localization/pose', PoseStamped, self.pose_cb)
        
        # BMS CAN interface
        self.soc = 0.0
        self.voltage = 0.0
        self.current = 0.0
        self.temperature = 0.0
        self.health = 1.0
        
        # CAN subscriber (vehicle-specific)
        self.can_sub = rospy.Subscriber('/can/bms', CANFrame, self.bms_cb)
        
        self.timer = rospy.Timer(rospy.Duration(1.0), self.publish)
    
    def bms_cb(self, msg):
        # Decode BMS CAN frame (vehicle-specific DBC)
        self.soc = decode_soc(msg.data)
        self.voltage = decode_voltage(msg.data)
        self.current = decode_current(msg.data)
        self.temperature = decode_temperature(msg.data)
    
    def publish(self, event):
        msg = BatteryState()
        msg.header.stamp = rospy.Time.now()
        msg.percentage = self.soc
        msg.voltage = self.voltage
        msg.current = self.current
        msg.temperature = self.temperature
        msg.capacity = self.health * NOMINAL_CAPACITY
        msg.design_capacity = NOMINAL_CAPACITY
        msg.power_supply_health = (
            BatteryState.POWER_SUPPLY_HEALTH_GOOD 
            if self.health > 0.8 
            else BatteryState.POWER_SUPPLY_HEALTH_OVERHEAT 
            if self.temperature > 50 
            else BatteryState.POWER_SUPPLY_HEALTH_DEAD
            if self.health < 0.5
            else BatteryState.POWER_SUPPLY_HEALTH_UNKNOWN
        )
        self.pub.publish(msg)
```

### 11.3 Charger Communication: OCPP 2.0.1

The fleet energy manager communicates with chargers via **OCPP 2.0.1** (Open Charge Point Protocol), the industry standard for EV charger management:

```python
class OCPPFleetManager:
    """
    OCPP 2.0.1 Central System for fleet charging management.
    
    Communicates with chargers via WebSocket (JSON/RPC).
    
    Key OCPP 2.0.1 features used:
    - SetChargingProfile: control per-vehicle power level
    - RequestStartTransaction: initiate charging remotely
    - RequestStopTransaction: stop charging remotely
    - GetCompositeSchedule: query charger availability
    - TriggerMessage: request real-time status
    """
    
    async def set_vehicle_charge_rate(
        self,
        charger_id: str,
        vehicle_id: str,
        power_kw: float,
        duration_min: float,
    ):
        """
        Set charging power for a specific vehicle at a specific charger.
        
        Uses OCPP SetChargingProfile with ChargingProfilePurpose=TxProfile
        to modulate power in real-time for demand charge management.
        """
        profile = {
            'chargingProfileId': hash(f'{charger_id}_{vehicle_id}'),
            'stackLevel': 1,
            'chargingProfilePurpose': 'TxProfile',
            'chargingProfileKind': 'Absolute',
            'chargingSchedule': [{
                'startSchedule': datetime.utcnow().isoformat(),
                'duration': int(duration_min * 60),
                'chargingRateUnit': 'W',
                'chargingSchedulePeriod': [{
                    'startPeriod': 0,
                    'limit': power_kw * 1000,  # OCPP uses watts
                }],
            }],
        }
        
        await self.send_to_charger(
            charger_id, 
            'SetChargingProfile', 
            {'evseId': 1, 'chargingProfile': profile}
        )
    
    async def start_v2g_discharge(
        self,
        charger_id: str,
        vehicle_id: str,
        power_kw: float,
        max_duration_min: float,
        min_soc: float = 0.30,
    ):
        """
        Initiate V2G discharge session.
        
        OCPP 2.0.1 supports bidirectional charging via negative power values
        in SetChargingProfile. Requires ISO 15118-20 compatible charger
        and vehicle.
        """
        profile = {
            'chargingProfileId': hash(f'v2g_{charger_id}_{vehicle_id}'),
            'stackLevel': 2,  # Higher priority than normal charging
            'chargingProfilePurpose': 'TxProfile',
            'chargingProfileKind': 'Absolute',
            'chargingSchedule': [{
                'startSchedule': datetime.utcnow().isoformat(),
                'duration': int(max_duration_min * 60),
                'chargingRateUnit': 'W',
                'chargingSchedulePeriod': [{
                    'startPeriod': 0,
                    'limit': -power_kw * 1000,  # Negative = discharge
                }],
                'minChargingRate': 0,  # Can stop any time
                'salesTariff': {
                    'id': 1,
                    'salesTariffEntry': [{
                        'relativeTimeInterval': {'start': 0},
                        'ePriceLevel': self.current_v2g_price_level(),
                    }],
                },
            }],
        }
        
        await self.send_to_charger(
            charger_id,
            'SetChargingProfile',
            {'evseId': 1, 'chargingProfile': profile}
        )
```

### 11.4 Fleet Energy Dashboard

```python
# Key metrics displayed in real-time fleet dashboard

DASHBOARD_METRICS = {
    # Fleet energy health
    'fleet_avg_soc': 'Mean SoC across all vehicles (%)',
    'fleet_min_soc': 'Lowest vehicle SoC (%)',
    'vehicles_below_30pct': 'Count of vehicles with SoC < 30%',
    'vehicles_charging': 'Count of vehicles currently charging',
    'charger_utilization': 'Fraction of chargers in use (%)',
    'charger_queue_depth': 'Average vehicles waiting per charger',
    
    # Cost tracking
    'current_15min_power': 'Current 15-min average power draw (kW)',
    'month_peak_demand': 'Highest 15-min peak this billing period (kW)',
    'demand_charge_exposure': 'Current month demand charge ($)',
    'energy_cost_today': 'Electricity cost so far today ($)',
    'v2g_revenue_today': 'V2G revenue earned today ($)',
    'degradation_cost_today': 'Estimated battery degradation cost today ($)',
    
    # Efficiency
    'fleet_utilization': 'Productive time / available time (%)',
    'kwh_per_task': 'Average energy per completed task (kWh)',
    'charge_efficiency': 'Useful energy / energy drawn from grid (%)',
    'tasks_delayed_by_charging': 'Tasks late due to vehicle charging (#)',
    
    # Predictions
    'predicted_soc_2hr': 'Fleet SoC forecast at +2 hours',
    'predicted_peak_demand': 'Forecasted peak demand next 2 hours (kW)',
    'recommended_v2g_dispatch': 'Vehicles recommended for V2G',
}
```

### 11.5 Implementation Phases

| Phase | Scope | Duration | Cost | Key Deliverable |
|---|---|---|---|---|
| **Phase 1**: Basic integration | BMS→ROS publisher, charger OCPP connection, simple threshold rules | 4-5 weeks | $15-25K | Vehicles auto-charge at SoC thresholds |
| **Phase 2**: Demand charge mgmt | Load balancing algorithm, staggered charging, power modulation | 4-6 weeks | $20-30K | Demand charge reduced 40-60% |
| **Phase 3**: Joint optimizer | CP-SAT energy co-optimization, MPC rolling horizon, A-CDM integration | 6-8 weeks | $35-50K | Full joint task-energy scheduling |
| **Phase 4**: V2G + RL | Bidirectional charger integration, V2G dispatch, RL real-time policy | 6-8 weeks | $30-45K | V2G revenue, RL adaptive dispatch |
| **Total** | | **20-27 weeks** | **$100-150K** | |

---

## 12. Cost-Benefit Analysis

### 12.1 Baseline: Naive Sequential Scheduling

For a 50-vehicle autonomous electric GSE fleet at a large hub airport:

```
Annual costs WITHOUT co-optimization:

Electricity (energy charge):
  50 vehicles × 40 kWh/day × 365 days × $0.10/kWh (avg)
  = $73,000/year

Demand charges:
  Peak demand: ~600 kW (simultaneous charging spikes)
  600 kW × $15/kW × 12 months = $108,000/year

Battery degradation (accelerated by high C-rate, poor SoC management):
  50 vehicles × $9,000 pack / 5-year life (naive)
  = $90,000/year amortized replacement

Lost utilization (vehicles unavailable during unscheduled charging):
  50 vehicles × 72% utilization × 16 hrs/day × 365 days = 210,240 vehicle-hours
  At $15/vehicle-hour value: $3,153,600 productive capacity
  (Baseline: this is what we get with 72% utilization)

Total annual energy-related cost: $271,000
Fleet productive capacity: 210,240 vehicle-hours/year
```

### 12.2 With Joint Co-Optimization

```
Annual costs WITH co-optimization:

Electricity (energy charge):
  TOU-shifted: 60% off-peak ($0.06), 30% mid-peak ($0.10), 10% on-peak ($0.16)
  Weighted avg: $0.076/kWh
  50 × 40 × 365 × $0.076 = $55,480/year
  Savings: $17,520/year (24% energy cost reduction)

Demand charges:
  Staggered charging peak: ~200 kW (3x reduction)
  200 kW × $15/kW × 12 months = $36,000/year
  Savings: $72,000/year (67% demand charge reduction)

Battery degradation:
  Optimized: 0.5-1C rates, 25-80% SoC window, temp-aware
  50 vehicles × $9,000 pack / 7.5-year life (optimized)
  = $60,000/year amortized replacement
  Savings: $30,000/year (33% battery life extension)

Improved utilization:
  85% utilization (up from 72%)
  50 × 85% × 16 × 365 = 248,200 vehicle-hours/year
  Additional: 37,960 vehicle-hours/year (+18%)
  Value: 37,960 × $15 = $569,400/year in additional productive capacity
  (Or equivalently: 7 fewer vehicles needed = $560K-1.26M avoided CAPEX)

V2G revenue:
  Demand charge shaving: 20 vehicles × 10 kWh × 2 events/day × $0.10 margin
  = $14,600/year
  Demand response events: 20 events/year × 1 MWh × $100/MWh
  = $2,000/year
  Total V2G: $16,600/year (conservative)

Total annual energy-related cost: $151,480
Savings vs baseline: $119,520/year + $569,400 utilization value
```

### 12.3 Summary Economics

| Metric | Without Co-Optimization | With Co-Optimization | Savings |
|---|---|---|---|
| Electricity cost | $73,000/year | $55,480/year | $17,520 (24%) |
| Demand charges | $108,000/year | $36,000/year | $72,000 (67%) |
| Battery replacement (amortized) | $90,000/year | $60,000/year | $30,000 (33%) |
| V2G revenue | $0 | -$16,600/year | $16,600 |
| **Total energy cost** | **$271,000/year** | **$134,880/year** | **$136,120 (50%)** |
| Fleet utilization | 72% | 85% | +13 points |
| Effective fleet size equivalent | 50 vehicles | ~59 vehicles | +18% capacity |
| Implementation cost | $0 | $100-150K one-time | Payback: 9-14 months |

### 12.4 Sensitivity Analysis

| Parameter | Base Case | Optimistic | Pessimistic | Impact on Annual Savings |
|---|---|---|---|---|
| Demand charge rate | $15/kW/month | $20/kW | $10/kW | +$24K / -$24K |
| Fleet size | 50 vehicles | 100 vehicles | 20 vehicles | +$136K / -$82K |
| TOU spread | $0.10 off-peak, $0.16 peak | Higher spread | Flat rate | +$20K / -$17K |
| Battery pack cost | $9,000 | $7,000 | $12,000 | -$8K / +$13K |
| V2G participation | 20 vehicles | 40 vehicles | 0 vehicles | +$16K / -$16K |
| Utilization improvement | +13% | +18% | +8% | +$190K / -$190K |

The largest value driver is **utilization improvement**, not direct energy savings. The co-optimizer pays for itself primarily by reducing vehicle idle time, not by saving on electricity.

### 12.5 Fleet Size Breakeven

```
Co-optimization implementation cost: $100-150K (one-time)
Annual savings per vehicle: ~$2,700 direct energy + $11,400 utilization value

Breakeven fleet size:
  Direct energy savings only:  $125K / $2,700 = 46 vehicles needed (too high)
  Including utilization value:  $125K / $14,100 = 9 vehicles (achievable)
  
Recommendation: implement Phase 1-2 (demand charge + basic optimization)
  at 15-20 vehicles ($35-55K), add Phase 3-4 at 30+ vehicles.
```

---

## 13. Key Takeaways

1. **Joint optimization recovers 10-15% fleet utilization** that sequential charge-then-work scheduling wastes. For a 50-vehicle fleet, this is equivalent to 5-7 additional vehicles at zero CAPEX --- the single largest economic benefit of co-optimization.

2. **Demand charge management is the highest-ROI intervention.** Staggering fleet charging to avoid simultaneous spikes reduces demand charges by 60-70% ($72K/year for 50 vehicles). This requires only power modulation via OCPP --- no algorithmic sophistication, just load balancing.

3. **LiFePO4 degradation-aware scheduling extends pack life by 1.5-2 years.** Maintaining the 25-80% SoC window and limiting C-rate to 1C for routine charging costs negligible utilization but saves $30K/year in deferred battery replacement for a 50-vehicle fleet.

4. **V2G is profitable for demand charge shaving and demand response events**, but marginal for pure time-of-use arbitrage. At a 50-vehicle fleet, V2G adds $15-30K/year in revenue. The co-optimizer should always participate in demand charge avoidance and opt into demand response programs when vehicles are idle.

5. **CP-SAT (OR-Tools) handles reference airside AV stack-scale fleets (20-50 vehicles)** without requiring a Gurobi commercial license. Combined with MPC rolling horizon (15-minute replans) and an RL policy for real-time dispatch, this three-layer approach covers the full decision timescale from shift planning to event response.

6. **A-CDM integration is the critical data feed** that makes proactive energy management possible. ELDT (Estimated Landing Time) gives 15-30 minutes advance notice to pre-position vehicles and pre-schedule charging around predicted demand surges. Without A-CDM, the co-optimizer degenerates to reactive threshold-based charging.

7. **Temperature extremes on the tarmac create a 30-40% swing in effective battery capacity.** Winter operations require more frequent charging at lower rates (lithium plating risk below 0C), while summer afternoons demand reduced C-rates to limit accelerated calendar aging above 45C.

8. **Night depot charging at off-peak rates saves ~$36K/year for a 24-vehicle fleet** compared to around-the-clock opportunity fast charging. The co-optimizer should maximize overnight AC charging and minimize daytime fast charging to discretionary top-ups.

9. **Fire safety compliance for charging near aircraft adds $5-15K per charger location** in suppression systems and clearance engineering. LiFePO4's inherent thermal stability is an advantage, but airport authorities still require NFPA 855/409 compliance for any lithium battery charging on the apron.

10. **Implementation payback is 9-14 months at 50 vehicles.** Phase 1-2 (basic optimization + demand charge management) delivers 65% of total value at 35% of total implementation cost --- this is the recommended starting scope for the reference airside AV stack's initial deployments.

11. **The co-optimizer is additive to the existing CP-SAT task scheduler**, not a replacement. It runs as a parallel service that injects charging tasks and power constraints into the task allocation pipeline described in `../../30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md`, using the same CP-SAT modeling patterns.

---

## 14. References

### Academic & Industry Papers

1. Desaulniers, G. et al. "Electric Vehicle Routing Problem with Time Windows and Partial Recharging." EJOR, 2016.
2. Schneider, M., Stenger, A., Goeke, D. "The Electric Vehicle Routing Problem with Time Windows and Recharging Stations." Transportation Science, 2014.
3. Pelletier, S., Jabali, O., Laporte, G. "Battery Degradation and Behaviour for Electric Vehicles: Review and Numerical Analyses of Several Models." Transportation Research Part B, 2017.
4. Wang, J. et al. "Cycle-Life Model for Graphite-LiFePO4 Cells." Journal of Power Sources, 2011.
5. Naumann, M. et al. "Analysis and Modeling of Calendar Aging of a Commercial LiFePO4/Graphite Cell." Journal of Energy Storage, 2020.
6. Safari, M. & Delacourt, C. "Aging of a Commercial Graphite/LiFePO4 Cell." Journal of the Electrochemical Society, 2011.
7. Bertsimas, D. & Sim, M. "The Price of Robustness." Operations Research, 2004.
8. Froger, A. et al. "Improved Formulations and Algorithmic Components for the Electric Vehicle Routing Problem with Nonlinear Charging Functions." Computers & Operations Research, 2019.
9. Montoya, A. et al. "The Electric Vehicle Routing Problem with Nonlinear Charging Function." Transportation Research Part B, 2017.

### Standards & Protocols

10. OCPP 2.0.1 Specification (Open Charge Alliance, 2024).
11. ISO 15118-20:2022 "Vehicle-to-Grid Communication Interface."
12. IEEE 2030.5-2018 "Smart Energy Profile."
13. OpenADR 2.0b (Demand Response Communication Standard).
14. NFPA 855 "Standard for the Installation of Stationary Energy Storage Systems" (2023).
15. NFPA 409 "Standard on Aircraft Hangars" (2022).
16. IATA Airport Handling Manual, Chapter 9: Safety (2024).

### Industry Reports

17. ACRP Report 78: "Airport Ground Support Equipment Electrification." Transportation Research Board, 2023.
18. EPRI "EV Fleet Charging Infrastructure Planning Guide." 2024.
19. Rocky Mountain Institute "Reducing EV Charging Infrastructure Costs." 2023.
20. Bloomberg NEF "Electric Vehicle Battery Pack Prices." 2025.

### Software & Tools

21. Google OR-Tools CP-SAT Solver: https://developers.google.com/optimization
22. Gurobi Optimizer: https://www.gurobi.com
23. Open Charge Alliance (OCPP): https://www.openchargealliance.org
24. SteVe OCPP Server (open-source): https://github.com/steve-community/steve

### Related Documents in This Repository

25. `../../70-operations-domains/airside/operations/battery-charging-infrastructure.md` --- Battery specs, charging hardware, autonomous self-charging
26. `../../30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md` --- CP-SAT scheduling, CBBA, charging-aware scheduling
27. `../../70-operations-domains/airside/business-case/fleet-tco-business-case.md` --- Fleet economics, per-vehicle costs, scale dynamics
28. `../../20-av-platform/compute/energy-efficient-inference-24-7.md` --- Orin power management, compute efficiency
29. `fleet-predictive-maintenance.md` --- Battery health monitoring, predictive replacement
30. `../../20-av-platform/networking-connectivity/airport-5g-cbrs.md` --- 5G infrastructure for vehicle-to-fleet telemetry
