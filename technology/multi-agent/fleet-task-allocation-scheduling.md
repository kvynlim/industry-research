# Fleet Task Allocation and Scheduling Optimization for Airside GSE

When an aircraft arrives at a gate, a precise sequence of ground support equipment (GSE) must converge on the stand within minutes: a pushback tug positions for departure, belt loaders dock at cargo doors, a fuel truck connects to hydrant panels, catering trucks service galleys, lavatory carts empty waste, and baggage tractors shuttle containers to the terminal. At a busy hub airport handling 800+ movements per day across 50-100 gates, this creates a combinatorial optimization problem of extraordinary scale — assigning 200-500 GSE vehicles of 8-12 different types to 1,500-4,000 individual tasks per day, each with time windows measured in minutes, precedence constraints (fueling cannot begin until passengers deplane), spatial constraints (only one vehicle at a time at certain docking positions), and resource constraints (vehicles have limited battery, operators have shift limits). The current industry approach is manual dispatch augmented by simple rule-based schedulers, which wastes 15-30% of GSE capacity through suboptimal assignments, empty repositioning, and idle time between tasks. As autonomous GSE eliminates the per-vehicle operator constraint, the task allocation problem becomes simultaneously easier (no driver fatigue, shift changes, or union break scheduling) and harder (the system must reason about charging schedules, sensor degradation, perception capability boundaries, and weather-dependent operational design domains). This document covers the mathematical formulation of the airside GSE task allocation problem, exact optimization methods (MILP, constraint programming), polynomial-time approximations (Hungarian algorithm, min-cost flow), decentralized auction-based allocation (CBBA, sequential single-item auctions), online/reactive scheduling for real-time disruptions (delays, equipment failures, weather changes), integration with airport collaborative decision-making (A-CDM) data feeds, multi-objective optimization (minimize turnaround time + minimize energy + maximize safety margins), and reinforcement learning approaches for adaptive fleet dispatch. Implementation targets the Aurrigo fleet operating under ROS Noetic with NVIDIA Orin compute, communicating over airport 5G/CBRS infrastructure.

---

## Table of Contents

1. [The Airside Task Allocation Problem](#1-the-airside-task-allocation-problem)
2. [Mathematical Formulation](#2-mathematical-formulation)
3. [Exact Optimization: MILP and Constraint Programming](#3-exact-optimization-milp-and-constraint-programming)
4. [Polynomial-Time Assignment Algorithms](#4-polynomial-time-assignment-algorithms)
5. [Auction-Based Decentralized Allocation](#5-auction-based-decentralized-allocation)
6. [Online and Reactive Scheduling](#6-online-and-reactive-scheduling)
7. [A-CDM Integration for Predictive Scheduling](#7-a-cdm-integration-for-predictive-scheduling)
8. [Multi-Objective Optimization](#8-multi-objective-optimization)
9. [Reinforcement Learning for Fleet Dispatch](#9-reinforcement-learning-for-fleet-dispatch)
10. [Charging and Energy-Aware Scheduling](#10-charging-and-energy-aware-scheduling)
11. [Safety and ODD Constraints in Task Allocation](#11-safety-and-odd-constraints-in-task-allocation)
12. [Implementation Architecture](#12-implementation-architecture)
13. [Key Takeaways](#13-key-takeaways)

---

## 1. The Airside Task Allocation Problem

### 1.1 Problem Characteristics

The airside GSE task allocation problem is a variant of the multi-robot task allocation (MRTA) problem with several features that distinguish it from warehouse robotics, delivery routing, or general fleet management:

**Heterogeneous vehicle types**: Unlike warehouse AMRs where all robots are interchangeable, airport GSE consists of 8-12 specialized vehicle types. A pushback tug cannot perform a belt loader's function and vice versa. This creates a typed assignment problem where task-vehicle compatibility is a hard constraint.

| GSE Type | Typical Fleet Size (Hub) | Tasks per Turnaround | Task Duration | Predecessor Dependencies |
|----------|------------------------|---------------------|---------------|------------------------|
| Pushback tug | 15-25 | 1 (departure) | 5-15 min | Passengers boarded, doors closed, fuel complete |
| Belt loader | 20-40 | 1-2 per cargo door | 10-25 min | Aircraft on stand, door opened |
| Baggage tractor + dollies | 30-60 | 2-4 per flight | 15-30 min | Belt loader positioned |
| Fuel truck / hydrant cart | 10-20 | 1 | 15-45 min | Passengers deplaned, ground power connected |
| Catering truck | 8-15 | 1-2 | 10-20 min | Aircraft on stand |
| Lavatory cart | 5-10 | 1 | 5-15 min | Aircraft on stand |
| Ground power unit (GPU) | 15-30 | 1 | Duration of turnaround | Aircraft on stand (first to arrive) |
| Passenger stairs | 10-20 | 1-2 | Duration of boarding/deplaning | Aircraft on stand |
| De-icing truck | 5-15 (seasonal) | 1 | 5-25 min | All other servicing complete, before pushback |
| Water truck | 3-8 | 1 | 5-10 min | Aircraft on stand |

**Tight time windows**: A narrow-body turnaround at a hub airport is 25-45 minutes. Each GSE task has a time window defined by the aircraft arrival schedule (AIBT — Actual In-Block Time) and required departure time (TOBT — Target Off-Block Time). Late completion cascades: a 5-minute fueling delay propagates to pushback delay, which propagates to departure delay, which propagates to downstream flights.

**Precedence constraints**: Tasks within a turnaround follow a partial order:
```
Aircraft on stand
├── GPU connects (first, parallel with deplaning)
├── Passenger stairs / jet bridge
│   └── Deplaning begins
│       ├── Cabin cleaning
│       ├── Catering
│       └── Fueling (after deplaning for safety)
├── Cargo door opens
│   ├── Belt loader positions
│   │   └── Baggage unloading → loading
│   └── Container loader (wide-body)
├── Lavatory service
├── Water service
└── All complete → Boarding → Doors closed → Pushback
```

**Spatial constraints**: Two GSE vehicles cannot occupy the same docking position simultaneously. The aircraft stand has limited access points, and vehicles must enter/exit without blocking each other. Some tasks require exclusive access to specific aircraft zones (fueling requires a safety perimeter).

**Stochastic task durations**: Actual turnaround times vary significantly from scheduled times. A delayed inbound flight compresses the turnaround window. Weather events suspend outdoor operations. Equipment breakdowns require reassignment.

### 1.2 Problem Classification in MRTA Taxonomy

Following the Gerkey and Matarić taxonomy for multi-robot task allocation:

| Dimension | Classification | Airside Specifics |
|-----------|---------------|-------------------|
| Single-task vs multi-task robots | **Multi-task (MT)** | A baggage tractor serves multiple flights sequentially |
| Single-robot vs multi-robot tasks | **Mostly SR, some MR** | Most tasks need one vehicle; wide-body cargo needs belt loader + tractor simultaneously |
| Instantaneous vs time-extended allocation | **Time-extended (TA)** | Schedule entire shift, not just current moment |
| Deterministic vs stochastic | **Stochastic** | Flight delays, weather, equipment failures |
| Heterogeneous vs homogeneous | **Heterogeneous** | 8-12 vehicle types with different capabilities |

This places the problem in the MT-SR-TA:ST (multi-task, single-robot, time-extended, stochastic) category — one of the harder MRTA variants. It is NP-hard in general, requiring either exact methods with practical limits on problem size or approximation algorithms with bounded suboptimality.

### 1.3 Scale of the Problem

| Airport Size | Gates | Daily Movements | GSE Fleet | Tasks/Day | Assignment Decisions/Day |
|-------------|-------|----------------|-----------|-----------|------------------------|
| Small regional | 5-15 | 50-100 | 30-80 | 200-500 | 200-500 |
| Medium hub | 30-60 | 300-500 | 150-300 | 1,500-3,000 | 1,500-3,000 |
| Large hub | 80-150 | 700-1,200 | 400-800 | 4,000-8,000 | 4,000-8,000 |
| Mega-hub (ATL, DXB) | 150-250 | 1,200-2,000 | 800-1,500 | 7,000-15,000 | 7,000-15,000 |

For Aurrigo's initial deployments (20-50 autonomous vehicles at a medium hub), the problem is 150-300 vehicles × 1,500-3,000 tasks/day — tractable for exact methods with appropriate decomposition.

---

## 2. Mathematical Formulation

### 2.1 Core Assignment Problem

Let:
- V = {v₁, ..., vₙ} be the set of GSE vehicles
- T = {t₁, ..., tₘ} be the set of tasks
- type(v) ∈ {PUSHBACK, BELT_LOADER, BAGGAGE_TRACTOR, ...} be the vehicle type
- required_type(t) be the type required for task t
- c(v, t) be the cost of assigning vehicle v to task t (travel time + energy + wear)
- [eₜ, lₜ] be the time window for task t (earliest start, latest completion)
- d(t) be the duration of task t
- P ⊂ T × T be the precedence relation (t₁ ≺ t₂ means t₁ must complete before t₂ starts)

Decision variables:
- x_{v,t} ∈ {0, 1}: 1 if vehicle v is assigned to task t
- s_t ≥ 0: start time of task t

**Objective**: Minimize weighted sum of total travel cost, total tardiness, and total idle time:

```
min  α · Σᵥ Σₜ c(v,t) · x_{v,t}          # travel/energy cost
   + β · Σₜ max(0, s_t + d(t) - l_t)      # tardiness penalty
   + γ · Σᵥ idle_time(v)                    # idle time cost
```

**Subject to**:
```
Σᵥ x_{v,t} = 1                             ∀t ∈ T    (every task assigned)
x_{v,t} = 0 if type(v) ≠ required_type(t)  ∀v,t       (type compatibility)
s_{t₂} ≥ s_{t₁} + d(t₁)                   ∀(t₁,t₂) ∈ P  (precedence)
s_t ≥ e_t                                   ∀t ∈ T    (earliest start)
no_overlap(v, tasks_assigned_to(v))          ∀v ∈ V    (sequential execution)
battery(v) ≥ energy(v, route(v))            ∀v ∈ V    (battery feasibility)
```

### 2.2 Vehicle Routing Component

Each vehicle executes a sequence of tasks, forming a route. Between consecutive tasks, the vehicle must travel from the previous task's location to the next task's location. This embeds a Vehicle Routing Problem with Time Windows (VRPTW) within the assignment problem.

```python
class AirsideTaskAllocationProblem:
    """Formal problem definition for airside GSE scheduling."""
    
    def __init__(self, vehicles, tasks, airport_graph):
        self.vehicles = vehicles        # List[Vehicle] with type, position, battery
        self.tasks = tasks              # List[Task] with type, location, window, duration
        self.graph = airport_graph      # Weighted graph of taxilanes/service roads
        self.precedence = {}            # Dict[task_id, List[task_id]] predecessor tasks
        self.spatial_conflicts = {}     # Dict[stand_id, List[docking_position]]
        
    def travel_time(self, v, from_loc, to_loc):
        """Shortest path travel time on airport service road network."""
        path = dijkstra(self.graph, from_loc, to_loc)
        # Speed limits: 25 km/h taxilane, 10 km/h near aircraft, 5 km/h stand area
        return sum(edge.distance / edge.speed_limit for edge in path)
    
    def cost(self, v, t):
        """Total cost of vehicle v performing task t."""
        travel = self.travel_time(v, v.current_location, t.location)
        energy = self.energy_model(v, travel, t.duration)
        urgency = max(0, t.latest_start - (time.now() + travel))  # time slack
        return (
            0.4 * travel +              # travel time (minutes)
            0.3 * energy / v.battery +  # energy as fraction of remaining battery
            0.2 * (1.0 / max(urgency, 0.1)) +  # urgency (inverse of slack)
            0.1 * v.wear_factor         # maintenance cost proxy
        )
    
    def is_feasible(self, assignment):
        """Check all hard constraints."""
        for v, task_sequence in assignment.items():
            # Type compatibility
            for t in task_sequence:
                if v.type != t.required_type:
                    return False
            # Time windows
            current_time = time.now()
            for t in task_sequence:
                arrival = current_time + self.travel_time(v, v.location, t.location)
                start = max(arrival, t.earliest_start)
                if start + t.duration > t.latest_completion:
                    return False
                current_time = start + t.duration
                v.location = t.location
            # Battery
            if not self.battery_feasible(v, task_sequence):
                return False
        # Precedence
        for t2, predecessors in self.precedence.items():
            for t1 in predecessors:
                if assignment.completion_time(t1) > assignment.start_time(t2):
                    return False
        return True
```

### 2.3 Turnaround as a Job-Shop Scheduling Problem

Each aircraft turnaround can be modeled as a job-shop scheduling problem where the "machines" are docking positions around the aircraft and the "jobs" are GSE operations:

| Docking Position | Compatible Operations | Max Concurrent |
|-----------------|----------------------|---------------|
| Nose gear area | Pushback tug, towbar | 1 |
| Forward cargo door | Belt loader, container loader | 1 |
| Aft cargo door | Belt loader, container loader | 1 |
| Underwing fuel panel | Fuel truck, hydrant cart | 1 |
| Forward service door | Catering truck | 1 |
| Aft service door | Catering truck, lavatory cart | 1 (shared) |
| Ground power panel | GPU | 1 |
| Left side apron | General access | 2-3 |
| Right side apron | General access | 2-3 |

The turnaround makespan (total time from in-block to off-block) depends on the critical path through the precedence graph. The critical path is typically: deplaning → fueling → boarding → pushback (narrow-body) or deplaning → cargo unloading → cargo loading → pushback (wide-body cargo-heavy).

---

## 3. Exact Optimization: MILP and Constraint Programming

### 3.1 MILP Formulation

Mixed-Integer Linear Programming (MILP) provides optimal solutions with guaranteed bounds. For the airside problem:

```python
from ortools.linear_solver import pywraplp
import numpy as np

def solve_gse_milp(vehicles, tasks, travel_times, precedence, time_horizon=480):
    """
    MILP formulation for GSE task allocation.
    
    Args:
        vehicles: List of (id, type, location, battery_kwh)
        tasks: List of (id, type, location, earliest, latest, duration, flight_id)
        travel_times: Dict[(loc1, loc2)] -> minutes
        precedence: List of (task_before, task_after)
        time_horizon: Planning horizon in minutes (default 8 hours)
    
    Returns optimal assignment and schedule.
    """
    solver = pywraplp.Solver.CreateSolver('SCIP')
    n_vehicles = len(vehicles)
    n_tasks = len(tasks)
    
    # Decision variables
    # x[v][t] = 1 if vehicle v assigned to task t
    x = {}
    for v in range(n_vehicles):
        for t in range(n_tasks):
            if vehicles[v].type == tasks[t].required_type:
                x[v, t] = solver.IntVar(0, 1, f'x_{v}_{t}')
    
    # s[t] = start time of task t (continuous)
    s = {}
    for t in range(n_tasks):
        s[t] = solver.NumVar(tasks[t].earliest, tasks[t].latest - tasks[t].duration, 
                             f's_{t}')
    
    # y[v][t1][t2] = 1 if vehicle v performs task t1 immediately before t2
    y = {}
    for v in range(n_vehicles):
        for t1 in range(n_tasks):
            for t2 in range(n_tasks):
                if t1 != t2 and (v, t1) in x and (v, t2) in x:
                    y[v, t1, t2] = solver.IntVar(0, 1, f'y_{v}_{t1}_{t2}')
    
    # Tardiness variables
    tardiness = {}
    for t in range(n_tasks):
        tardiness[t] = solver.NumVar(0, time_horizon, f'tard_{t}')
    
    # Constraints
    # 1. Every task assigned to exactly one vehicle
    for t in range(n_tasks):
        compatible = [v for v in range(n_vehicles) if (v, t) in x]
        solver.Add(sum(x[v, t] for v in compatible) == 1)
    
    # 2. Sequencing: if v does t1 then t2, start of t2 >= end of t1 + travel
    M = time_horizon  # Big-M
    for v in range(n_vehicles):
        for t1 in range(n_tasks):
            for t2 in range(n_tasks):
                if (v, t1, t2) in y:
                    travel = travel_times.get(
                        (tasks[t1].location, tasks[t2].location), 0)
                    solver.Add(
                        s[t2] >= s[t1] + tasks[t1].duration + travel 
                        - M * (1 - y[v, t1, t2])
                    )
    
    # 3. Flow conservation: sequencing variables consistent with assignment
    for v in range(n_vehicles):
        v_tasks = [t for t in range(n_tasks) if (v, t) in x]
        for t in v_tasks:
            # If assigned, exactly one predecessor and one successor (or start/end)
            incoming = sum(y.get((v, t2, t), solver.IntVar(0, 0, ''))
                         for t2 in v_tasks if t2 != t and (v, t2, t) in y)
            outgoing = sum(y.get((v, t, t2), solver.IntVar(0, 0, ''))
                         for t2 in v_tasks if t2 != t and (v, t, t2) in y)
            # Linking: y active only if both tasks assigned to v
            for t2 in v_tasks:
                if t2 != t and (v, t, t2) in y:
                    solver.Add(y[v, t, t2] <= x[v, t])
                    solver.Add(y[v, t, t2] <= x[v, t2])
    
    # 4. Precedence constraints
    for (t1, t2) in precedence:
        solver.Add(s[t2] >= s[t1] + tasks[t1].duration)
    
    # 5. Tardiness
    for t in range(n_tasks):
        solver.Add(tardiness[t] >= s[t] + tasks[t].duration - tasks[t].latest)
    
    # Objective: minimize cost + tardiness + makespan
    travel_cost = sum(
        travel_times.get((vehicles[v].location, tasks[t].location), 0) * x[v, t]
        for v, t in x.keys()
    )
    tard_cost = sum(tardiness[t] for t in range(n_tasks))
    
    solver.Minimize(0.3 * travel_cost + 0.6 * tard_cost * 10 + 0.1 * time_horizon)
    
    # Solve with time limit
    solver.SetTimeLimit(30_000)  # 30 seconds
    status = solver.Solve()
    
    return status, x, s, tardiness

# Scalability characteristics:
# - 50 vehicles × 200 tasks: Optimal in 5-15 seconds
# - 100 vehicles × 500 tasks: Optimal in 30-120 seconds
# - 200 vehicles × 1000 tasks: Near-optimal (1-3% gap) in 60-300 seconds
# - 500+ vehicles × 3000+ tasks: Requires decomposition or heuristics
```

### 3.2 Constraint Programming with OR-Tools CP-SAT

Constraint Programming (CP) is often faster than MILP for scheduling problems with complex temporal and resource constraints:

```python
from ortools.sat.python import cp_model

def solve_gse_cpsat(vehicles, tasks, travel_times, precedence, stands):
    """
    CP-SAT formulation — often 5-10x faster than MILP for scheduling.
    
    CP-SAT excels when:
    - Many disjunctive constraints (non-overlap)
    - Complex precedence graphs
    - Resource constraints (stand capacity)
    """
    model = cp_model.CpModel()
    horizon = 480 * 60  # 8 hours in seconds
    
    # Interval variables for each task
    task_intervals = {}
    task_starts = {}
    task_ends = {}
    
    for t_idx, task in enumerate(tasks):
        start = model.NewIntVar(task.earliest_sec, task.latest_sec, f'start_{t_idx}')
        end = model.NewIntVar(task.earliest_sec, horizon, f'end_{t_idx}')
        interval = model.NewIntervalVar(start, task.duration_sec, end, f'interval_{t_idx}')
        task_starts[t_idx] = start
        task_ends[t_idx] = end
        task_intervals[t_idx] = interval
    
    # Assignment variables
    x = {}
    for v_idx, vehicle in enumerate(vehicles):
        for t_idx, task in enumerate(tasks):
            if vehicle.type == task.required_type:
                x[v_idx, t_idx] = model.NewBoolVar(f'x_{v_idx}_{t_idx}')
    
    # Each task assigned to exactly one compatible vehicle
    for t_idx, task in enumerate(tasks):
        compatible = [v for v in range(len(vehicles)) if (v, t_idx) in x]
        model.AddExactlyOne(x[v, t_idx] for v in compatible)
    
    # Precedence constraints
    for (t1, t2) in precedence:
        model.Add(task_starts[t2] >= task_ends[t1])
    
    # No-overlap per vehicle (each vehicle can only do one task at a time)
    for v_idx in range(len(vehicles)):
        v_tasks = [t for t in range(len(tasks)) if (v_idx, t) in x]
        # Create optional intervals for vehicle-task combinations
        optional_intervals = []
        for t_idx in v_tasks:
            opt_interval = model.NewOptionalIntervalVar(
                task_starts[t_idx],
                tasks[t_idx].duration_sec,
                task_ends[t_idx],
                x[v_idx, t_idx],
                f'opt_{v_idx}_{t_idx}'
            )
            optional_intervals.append(opt_interval)
        # No overlap constraint — CP-SAT's powerful built-in
        model.AddNoOverlap(optional_intervals)
    
    # No-overlap per docking position (spatial constraint)
    for stand_id, positions in stands.items():
        for pos_name, compatible_tasks in positions.items():
            pos_intervals = [task_intervals[t] for t in compatible_tasks 
                           if t in task_intervals]
            if len(pos_intervals) > 1:
                model.AddNoOverlap(pos_intervals)
    
    # Cumulative resource constraint: max vehicles on stand simultaneously
    for stand_id in stands:
        stand_tasks = stands[stand_id]['all_tasks']
        demands = [1] * len(stand_tasks)
        intervals = [task_intervals[t] for t in stand_tasks]
        model.AddCumulative(intervals, demands, stands[stand_id]['max_vehicles'])
    
    # Objective: minimize makespan + tardiness
    tardiness_vars = []
    for t_idx, task in enumerate(tasks):
        tard = model.NewIntVar(0, horizon, f'tard_{t_idx}')
        model.Add(tard >= task_ends[t_idx] - task.latest_sec)
        model.Add(tard >= 0)
        tardiness_vars.append(tard)
    
    # Weighted objective
    model.Minimize(sum(tardiness_vars) * 10 + max(task_ends.values()))
    
    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 30
    solver.parameters.num_workers = 8  # Orin has 12 CPU cores
    status = solver.Solve(model)
    
    return status, solver, x, task_starts, task_ends
```

### 3.3 Decomposition Strategies

For large airports where monolithic MILP/CP is too slow:

**Temporal decomposition**: Split the day into 2-4 hour windows. Solve each window independently with warm-start from previous window's end state. Boundary effects handled by including overlap tasks.

**Spatial decomposition**: Partition the airport into terminal zones (T1, T2, T3). Solve each zone independently. Inter-zone vehicle transfers are fixed variables from a higher-level assignment.

**Type decomposition**: Solve each GSE type independently (all pushback tugs, all belt loaders, etc.). Then resolve inter-type conflicts (spatial overlap at stands) in a coordination phase.

**Rolling horizon**: Solve the next 1-2 hours optimally. Re-solve every 15-30 minutes as new information arrives (flight delays, weather changes, equipment status).

```python
class RollingHorizonScheduler:
    """Rolling horizon approach for large-scale airports."""
    
    def __init__(self, planning_horizon_min=120, replan_interval_min=15):
        self.planning_horizon = planning_horizon_min
        self.replan_interval = replan_interval_min
        self.current_schedule = None
        self.committed_horizon = 30  # Don't change assignments within 30 min
        
    def replan(self, vehicles, tasks, current_time):
        """Re-solve for next planning_horizon minutes."""
        # Fix assignments within committed horizon
        fixed = self.get_committed_assignments(current_time)
        
        # Get tasks in planning window
        window_tasks = [t for t in tasks 
                       if t.earliest <= current_time + self.planning_horizon * 60
                       and t.latest >= current_time]
        
        # Solve with fixed assignments as constraints
        status, solution = solve_gse_cpsat(
            vehicles, window_tasks, 
            fixed_assignments=fixed
        )
        
        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            self.current_schedule = solution
            return solution
        else:
            # Infeasible — relax constraints or alert operator
            return self.emergency_greedy_assign(vehicles, window_tasks)
```

### 3.4 Complexity and Performance

| Method | Problem Size | Solution Quality | Time | When to Use |
|--------|-------------|-----------------|------|-------------|
| MILP (SCIP/Gurobi) | ≤200 vehicles × 1000 tasks | Optimal | 30-300s | Shift planning, offline |
| CP-SAT (OR-Tools) | ≤500 vehicles × 3000 tasks | Optimal/near-optimal | 10-60s | Real-time replan |
| Decomposition + MILP | ≤1000 vehicles × 10000 tasks | 1-5% gap | 30-120s | Large hub airports |
| Greedy heuristic | Any | 10-30% gap | <1s | Emergency fallback |

---

## 4. Polynomial-Time Assignment Algorithms

### 4.1 Hungarian Algorithm for Single-Task Assignment

When each vehicle performs exactly one task (e.g., assigning pushback tugs to departure flights in the next hour), the problem reduces to a balanced assignment problem solvable in O(n³) by the Hungarian algorithm:

```python
from scipy.optimize import linear_sum_assignment
import numpy as np

def hungarian_single_assignment(vehicles, tasks, cost_fn):
    """
    Optimal one-to-one assignment in O(n³).
    
    Use when:
    - Each vehicle does exactly one task in the current time window
    - Type compatibility already filtered
    - Need fast optimal solution for real-time dispatch
    """
    n = max(len(vehicles), len(tasks))
    cost_matrix = np.full((n, n), 1e9)  # Large cost for infeasible
    
    for i, v in enumerate(vehicles):
        for j, t in enumerate(tasks):
            if v.type == t.required_type:
                cost_matrix[i, j] = cost_fn(v, t)
    
    row_indices, col_indices = linear_sum_assignment(cost_matrix)
    
    assignments = []
    for v_idx, t_idx in zip(row_indices, col_indices):
        if cost_matrix[v_idx, t_idx] < 1e9 and v_idx < len(vehicles) and t_idx < len(tasks):
            assignments.append((vehicles[v_idx], tasks[t_idx]))
    
    return assignments

# Performance: 
# 50 vehicles × 50 tasks: <1ms
# 200 × 200: ~10ms  
# 500 × 500: ~200ms
# Runs trivially on Orin CPU
```

### 4.2 Min-Cost Max-Flow for Multi-Task Assignment

When vehicles perform multiple tasks sequentially, the problem can be modeled as a min-cost flow network:

```python
def build_flow_network(vehicles, tasks, travel_times):
    """
    Network flow formulation for sequential multi-task assignment.
    
    Graph structure:
    Source -> Vehicle nodes -> Task nodes -> Sink
    
    Edges:
    - Source to vehicle: capacity 1, cost 0 (one vehicle start)
    - Vehicle to first task: capacity 1, cost = travel_time
    - Task to task: capacity 1, cost = travel_time (sequencing)  
    - Task to sink: capacity 1, cost 0
    
    Solve with min-cost max-flow: O(V²E) or O(VE log V) with potentials
    """
    # Node indices
    source = 0
    sink = 1
    v_nodes = {v.id: 2 + i for i, v in enumerate(vehicles)}
    t_nodes = {t.id: 2 + len(vehicles) + i for i, t in enumerate(tasks)}
    
    edges = []
    
    # Source -> vehicle nodes
    for v in vehicles:
        edges.append((source, v_nodes[v.id], 1, 0))
    
    # Vehicle -> compatible first tasks
    for v in vehicles:
        for t in tasks:
            if v.type == t.required_type:
                cost = travel_times.get((v.location, t.location), float('inf'))
                edges.append((v_nodes[v.id], t_nodes[t.id], 1, int(cost * 100)))
    
    # Task -> task (sequential execution by same vehicle)
    for t1 in tasks:
        for t2 in tasks:
            if t1.id != t2.id and t1.required_type == t2.required_type:
                # Time feasibility check
                earliest_t2_start = t1.earliest + t1.duration + \
                    travel_times.get((t1.location, t2.location), float('inf'))
                if earliest_t2_start <= t2.latest - t2.duration:
                    cost = travel_times.get((t1.location, t2.location), float('inf'))
                    edges.append((t_nodes[t1.id], t_nodes[t2.id], 1, int(cost * 100)))
    
    # Task -> sink
    for t in tasks:
        edges.append((t_nodes[t.id], sink, 1, 0))
    
    return edges, source, sink
```

### 4.3 Greedy Nearest-Available Heuristic

For emergency real-time dispatch when optimization is too slow:

```python
def greedy_nearest_dispatch(vehicles, new_task, travel_times):
    """
    O(n) greedy dispatch — always available as fallback.
    
    Select the nearest available vehicle of the correct type.
    Tie-break by battery level (prefer higher charge).
    """
    candidates = [
        v for v in vehicles
        if v.type == new_task.required_type
        and v.status == 'IDLE'
        and v.battery >= estimated_energy(v, new_task, travel_times)
    ]
    
    if not candidates:
        # No idle vehicle — check which will become available soonest
        candidates = [
            v for v in vehicles
            if v.type == new_task.required_type
            and v.battery >= estimated_energy(v, new_task, travel_times)
        ]
        candidates.sort(key=lambda v: v.estimated_available_time)
        candidates = candidates[:5]  # Top 5 soonest available
    
    if not candidates:
        return None  # No feasible vehicle — alert operator
    
    # Score: weighted travel time + battery penalty + urgency
    def score(v):
        travel = travel_times.get((v.current_location, new_task.location), 999)
        battery_penalty = max(0, 0.3 - v.battery_fraction) * 100
        return travel + battery_penalty
    
    best = min(candidates, key=score)
    return best
```

---

## 5. Auction-Based Decentralized Allocation

### 5.1 Why Decentralized for Airside

Centralized optimization requires all information at one point and fails if the central server goes down. For safety-critical airport operations, decentralized allocation provides:
- **Resilience**: No single point of failure. If one vehicle's compute fails, others continue
- **Scalability**: Each vehicle makes local decisions; communication scales linearly
- **Reactivity**: Local re-planning in <100ms vs seconds for centralized re-solve
- **5G dependency reduction**: Can operate on local mesh if airport 5G fails

### 5.2 Consensus-Based Bundle Algorithm (CBBA)

CBBA (Choi, Brunet, How, 2009) is the standard decentralized task allocation algorithm for multi-robot systems. Each robot builds a bundle of tasks it wants to perform, then communicates with neighbors to reach consensus:

```python
class CBBAAgent:
    """
    CBBA implementation for a single GSE vehicle.
    Runs on Orin CPU — lightweight computation.
    """
    
    def __init__(self, vehicle_id, vehicle_type, position, battery):
        self.id = vehicle_id
        self.type = vehicle_type
        self.position = position
        self.battery = battery
        
        # CBBA state
        self.bundle = []            # Ordered list of tasks this agent wants
        self.path = []              # Planned execution order
        self.winning_bids = {}      # task_id -> (agent_id, bid_value)
        self.winning_agents = {}    # task_id -> agent_id
        self.timestamps = {}        # task_id -> timestamp of last update
        
        self.max_bundle_size = 10   # Max tasks per planning cycle
    
    def compute_bid(self, task, insertion_idx):
        """
        Compute marginal cost of inserting task at position insertion_idx.
        
        bid = (reward for completing task) - (marginal cost of insertion)
        """
        if self.type != task.required_type:
            return -float('inf')
        
        # Reward: urgency-weighted value (higher for imminent tasks)
        time_to_deadline = task.latest - time.now()
        urgency = max(0.1, 1.0 - time_to_deadline / 3600)  # 0.1 to 1.0
        reward = task.base_value * (1 + urgency)
        
        # Marginal cost: additional travel + energy from inserting this task
        path_with = self.path[:insertion_idx] + [task] + self.path[insertion_idx:]
        cost_without = self.route_cost(self.path)
        cost_with = self.route_cost(path_with)
        marginal_cost = cost_with - cost_without
        
        # Battery feasibility check
        if not self.battery_feasible(path_with):
            return -float('inf')
        
        # Time window feasibility
        if not self.time_feasible(path_with):
            return -float('inf')
        
        bid = reward - marginal_cost
        return bid
    
    def build_bundle(self, available_tasks):
        """
        Phase 1: Greedy bundle construction.
        Add tasks one at a time, choosing highest-bid task at best insertion.
        """
        while len(self.bundle) < self.max_bundle_size:
            best_task = None
            best_bid = -float('inf')
            best_idx = 0
            
            for task in available_tasks:
                if task.id in [t.id for t in self.bundle]:
                    continue  # Already in bundle
                
                # Check if we can outbid current winner
                current_bid = self.winning_bids.get(task.id, (None, -float('inf')))[1]
                
                # Try all insertion positions
                for idx in range(len(self.path) + 1):
                    bid = self.compute_bid(task, idx)
                    if bid > current_bid and bid > best_bid:
                        best_task = task
                        best_bid = bid
                        best_idx = idx
            
            if best_task is None:
                break  # No more profitable tasks
            
            self.bundle.append(best_task)
            self.path.insert(best_idx, best_task)
            self.winning_bids[best_task.id] = (self.id, best_bid)
            self.winning_agents[best_task.id] = self.id
    
    def consensus_update(self, sender_id, sender_bids, sender_timestamps):
        """
        Phase 2: Consensus protocol.
        Compare bids with neighbor's information, resolve conflicts.
        
        Rules (from Choi et al. 2009):
        1. If sender wins with higher bid, accept sender's assignment
        2. If I win with higher bid, keep my assignment  
        3. If sender's info is newer, accept sender's view
        """
        tasks_to_remove = []
        
        for task_id, (s_agent, s_bid) in sender_bids.items():
            my_agent = self.winning_agents.get(task_id)
            my_bid = self.winning_bids.get(task_id, (None, -float('inf')))[1]
            
            # Determine action based on CBBA consensus rules
            if s_agent == sender_id:
                if my_agent == self.id:
                    if s_bid > my_bid:
                        # Sender outbids me — release task
                        self.winning_bids[task_id] = (s_agent, s_bid)
                        self.winning_agents[task_id] = s_agent
                        if task_id in [t.id for t in self.bundle]:
                            tasks_to_remove.append(task_id)
                else:
                    if s_bid > my_bid or sender_timestamps.get(task_id, 0) > \
                       self.timestamps.get(task_id, 0):
                        self.winning_bids[task_id] = (s_agent, s_bid)
                        self.winning_agents[task_id] = s_agent
            elif s_agent == self.id:
                pass  # Sender thinks I won — I already know
            else:
                # Third-party assignment — accept if newer
                if sender_timestamps.get(task_id, 0) > self.timestamps.get(task_id, 0):
                    self.winning_bids[task_id] = (s_agent, s_bid)
                    self.winning_agents[task_id] = s_agent
                    if task_id in [t.id for t in self.bundle]:
                        tasks_to_remove.append(task_id)
        
        # Remove outbid tasks from bundle and re-build
        for task_id in tasks_to_remove:
            self.bundle = [t for t in self.bundle if t.id != task_id]
            self.path = [t for t in self.path if t.id != task_id]
    
    def cbba_iteration(self, neighbors, available_tasks):
        """
        One CBBA iteration: build bundle, then exchange with all neighbors.
        Converges in O(n) iterations for n agents.
        """
        self.build_bundle(available_tasks)
        
        # Exchange bids with neighbors
        for neighbor in neighbors:
            # Send my bids
            neighbor.consensus_update(
                self.id, self.winning_bids, self.timestamps)
            # Receive neighbor's bids  
            self.consensus_update(
                neighbor.id, neighbor.winning_bids, neighbor.timestamps)
```

### 5.3 Sequential Single-Item Auction (SSI)

Simpler than CBBA, suitable when tasks arrive one at a time (online dispatch):

```python
class AuctionDispatcher:
    """
    Sequential single-item auction for online task dispatch.
    
    When a new task arrives (e.g., flight lands, need belt loader):
    1. Broadcast task to all compatible vehicles
    2. Each vehicle submits a bid (cost to perform task)
    3. Lowest-cost bidder wins
    
    Communication: 1 broadcast + N responses per task
    Latency: ~50-100ms over 5G
    """
    
    def __init__(self, fleet_manager_node):
        self.fleet = fleet_manager_node
        self.active_auctions = {}
        self.auction_timeout_ms = 500  # Wait 500ms for all bids
    
    def announce_task(self, task):
        """Broadcast task to fleet."""
        msg = TaskAnnouncement(
            task_id=task.id,
            task_type=task.required_type,
            location=task.location,
            time_window=(task.earliest, task.latest),
            duration=task.duration,
            priority=task.priority,
            flight_id=task.flight_id
        )
        self.fleet.publish('/fleet/task_announcements', msg)
        self.active_auctions[task.id] = {
            'task': task,
            'bids': [],
            'start_time': time.now(),
            'status': 'OPEN'
        }
    
    def receive_bid(self, bid_msg):
        """Process incoming bid from a vehicle."""
        auction = self.active_auctions.get(bid_msg.task_id)
        if auction and auction['status'] == 'OPEN':
            auction['bids'].append({
                'vehicle_id': bid_msg.vehicle_id,
                'cost': bid_msg.cost,
                'eta': bid_msg.estimated_arrival,
                'battery_after': bid_msg.battery_remaining_after,
                'confidence': bid_msg.confidence  # Perception/ODD confidence
            })
    
    def close_auction(self, task_id):
        """Award task to lowest-cost feasible bidder."""
        auction = self.active_auctions[task_id]
        auction['status'] = 'CLOSED'
        
        bids = auction['bids']
        if not bids:
            return None  # No bids — alert operator
        
        # Filter: must arrive before deadline, have sufficient battery
        feasible = [b for b in bids 
                   if b['eta'] <= auction['task'].latest - auction['task'].duration
                   and b['battery_after'] > 0.15  # 15% reserve
                   and b['confidence'] > 0.7]     # ODD confidence
        
        if not feasible:
            feasible = bids  # Relax constraints, dispatch best available
        
        # Winner: lowest cost with tie-break on battery
        winner = min(feasible, key=lambda b: (b['cost'], -b['battery_after']))
        
        return winner['vehicle_id']
```

### 5.4 CBBA vs Centralized: Tradeoffs

| Property | Centralized (MILP/CP) | CBBA | SSI Auction |
|----------|----------------------|------|-------------|
| **Optimality** | Optimal (given time) | ~95% of optimal (50% of Nash) | ~80-90% of optimal |
| **Computation** | Server: 10-300s; Vehicles: 0 | Per vehicle: <100ms | Per vehicle: <10ms |
| **Communication** | All info to server | O(n²) per iteration | O(n) per task |
| **Resilience** | Single point of failure | No SPOF | No SPOF |
| **Reactivity** | Re-solve: 10-300s | Local update: <100ms | Immediate |
| **Convergence** | N/A | O(n) iterations | 1 round |
| **Best for** | Shift planning | Medium-term (1-2h) | Real-time dispatch |

**Recommended hybrid**: Centralized CP-SAT for shift planning (every 2 hours), CBBA for medium-term adjustments (every 15 min), SSI auction for immediate task dispatch (per-event).

---

## 6. Online and Reactive Scheduling

### 6.1 Event-Driven Rescheduling

Airport operations are inherently stochastic. The schedule must adapt to:

| Event | Frequency | Impact | Response Time |
|-------|-----------|--------|--------------|
| Flight delay (>15 min) | 15-25% of flights | Shifts task windows | 1-5 min |
| Flight cancellation | 1-3% of flights | Removes tasks | Immediate |
| GSE breakdown | 1-3 per day | Vehicle unavailable | Immediate |
| Weather hold (ground stop) | 2-5 per month | Suspends all outdoor ops | Immediate |
| Gate change | 5-10% of flights | Changes task locations | 1-2 min |
| Battery critically low | 5-15 per day | Vehicle needs charging | 5-10 min |
| Sensor degradation | 2-8 per day | Vehicle capability reduced | Immediate |
| Emergency (FOD, incident) | Rare | Area closure | Immediate |

```python
class ReactiveScheduler:
    """
    Event-driven rescheduling with stability guarantees.
    
    Key principle: minimize disruption to current schedule.
    Only reassign tasks that are affected by the event.
    """
    
    def __init__(self, base_scheduler, fleet):
        self.base = base_scheduler
        self.fleet = fleet
        self.stability_weight = 0.3  # Penalize changes to existing assignments
        
    def handle_event(self, event):
        """Route event to appropriate handler."""
        handlers = {
            'FLIGHT_DELAY': self.handle_flight_delay,
            'VEHICLE_BREAKDOWN': self.handle_vehicle_breakdown,
            'WEATHER_HOLD': self.handle_weather_hold,
            'GATE_CHANGE': self.handle_gate_change,
            'LOW_BATTERY': self.handle_low_battery,
            'SENSOR_DEGRADATION': self.handle_sensor_degradation,
        }
        handler = handlers.get(event.type, self.handle_generic)
        return handler(event)
    
    def handle_flight_delay(self, event):
        """
        Flight delayed — shift task windows, re-optimize affected turnaround.
        Only re-assign if original vehicles can't accommodate new timing.
        """
        flight_id = event.flight_id
        delay_minutes = event.delay_minutes
        
        # Get all tasks for this flight
        affected_tasks = self.get_tasks_for_flight(flight_id)
        
        # Shift time windows
        for task in affected_tasks:
            task.earliest += delay_minutes * 60
            task.latest += delay_minutes * 60
        
        # Check if current assignments are still feasible
        current_assignments = self.get_current_assignments(affected_tasks)
        feasible = all(
            self.is_assignment_feasible(v, t) 
            for v, t in current_assignments
        )
        
        if feasible:
            # Just update schedule times, keep assignments
            self.update_schedule_times(current_assignments)
        else:
            # Minimal re-assignment: only infeasible tasks
            infeasible_tasks = [
                t for v, t in current_assignments
                if not self.is_assignment_feasible(v, t)
            ]
            self.reassign_tasks(infeasible_tasks)
    
    def handle_vehicle_breakdown(self, event):
        """
        Vehicle broken — immediately reassign all its pending tasks.
        Use SSI auction for speed.
        """
        vehicle_id = event.vehicle_id
        pending_tasks = self.get_pending_tasks(vehicle_id)
        
        # Mark vehicle as MAINTENANCE
        self.fleet.set_vehicle_status(vehicle_id, 'MAINTENANCE')
        
        # Emergency auction for each task, priority-ordered
        pending_tasks.sort(key=lambda t: t.earliest)
        for task in pending_tasks:
            winner = self.auction_dispatcher.announce_and_award(task, timeout_ms=300)
            if winner is None:
                self.alert_operator(f"Cannot reassign {task.id} — no available vehicle")
    
    def handle_weather_hold(self, event):
        """
        All outdoor operations suspended.
        Vehicles proceed to nearest safe hold position.
        Tasks deferred until weather clears.
        """
        # Pause all active tasks except those inside buildings/covered areas
        for v in self.fleet.get_active_vehicles():
            if v.is_outdoors():
                v.command_safe_hold(nearest_shelter(v.position))
        
        # Defer all future tasks by estimated hold duration
        estimated_duration = event.estimated_duration_minutes or 60
        self.defer_all_pending_tasks(estimated_duration)
        
        # Register callback for weather clear
        self.register_callback('WEATHER_CLEAR', self.resume_operations)
```

### 6.2 Disruption Metrics

Measure scheduling performance under disruption:

| Metric | Definition | Target |
|--------|-----------|--------|
| **Turnaround delay** | Minutes past TOBT when pushback occurs | <5 min avg |
| **Task tardiness** | Minutes past task deadline | 0 for 95% of tasks |
| **Vehicle utilization** | % of shift time performing tasks (vs idle/traveling/charging) | >60% |
| **Empty travel ratio** | Empty km / (empty km + loaded km) | <35% |
| **Reassignment rate** | % of tasks reassigned after initial dispatch | <15% |
| **Cascade delay** | Delay propagated to downstream flights | <2 min avg |
| **Schedule stability** | % of assignments unchanged after disruption | >85% |

---

## 7. A-CDM Integration for Predictive Scheduling

### 7.1 A-CDM Data Feeds for Scheduling

Airport Collaborative Decision Making (A-CDM) provides the predictive data that transforms reactive scheduling into proactive scheduling:

| A-CDM Milestone | Data | Use in Scheduling |
|----------------|------|-------------------|
| ELDT (Estimated Landing Time) | Aircraft ETA ± 5 min | Pre-position GSE 15-20 min before arrival |
| AIBT (Actual In-Block Time) | Aircraft at gate | Trigger turnaround task sequence |
| TOBT (Target Off-Block Time) | Desired departure | Back-calculate task deadlines |
| TSAT (Target Start-up Approval Time) | ATC slot | Hard deadline for pushback tug |
| CTOT (Calculated Take-Off Time) | Slot constraint | Absolute deadline |
| SOBT (Scheduled Off-Block Time) | Planned departure | Baseline for delay measurement |

```python
class ACDMSchedulerIntegration:
    """
    Predictive scheduling using A-CDM milestone data.
    
    Key insight: ELDT gives 15-30 minutes advance notice.
    Pre-compute optimal GSE assignment BEFORE aircraft arrives.
    """
    
    def __init__(self, acdm_client, scheduler):
        self.acdm = acdm_client
        self.scheduler = scheduler
        self.pre_assigned = {}  # flight_id -> assignment
        
    def on_eldt_update(self, flight_id, eldt, gate):
        """
        Called when ELDT updates (typically 30-60 min before landing).
        Pre-compute and tentatively assign GSE.
        """
        # Get turnaround task template for this aircraft type
        aircraft_type = self.acdm.get_aircraft_type(flight_id)
        tobt = self.acdm.get_tobt(flight_id)
        
        tasks = self.generate_turnaround_tasks(
            flight_id, aircraft_type, gate, 
            estimated_aibt=eldt + 10,  # 10 min taxi-in estimate
            tobt=tobt
        )
        
        # Optimal assignment (not committed yet)
        assignment = self.scheduler.optimize(tasks, tentative=True)
        self.pre_assigned[flight_id] = assignment
        
        # Pre-position vehicles: start moving toward gate area
        for vehicle_id, task in assignment.items():
            if task.earliest - time.now() < 20 * 60:  # Within 20 min
                self.scheduler.pre_position(
                    vehicle_id, 
                    staging_area_near(gate),
                    reason=f"Pre-stage for {flight_id}"
                )
    
    def on_aibt(self, flight_id, aibt, gate):
        """
        Aircraft is on stand. Commit assignments and dispatch.
        Adjust timing based on actual arrival vs estimated.
        """
        pre = self.pre_assigned.get(flight_id)
        if pre:
            # Adjust task windows based on actual AIBT
            delta = aibt - pre.estimated_aibt
            adjusted = self.adjust_times(pre, delta)
            
            # Commit and dispatch
            self.scheduler.commit_assignment(adjusted)
            for vehicle_id, task in adjusted.items():
                self.scheduler.dispatch(vehicle_id, task)
        else:
            # No pre-assignment — do immediate dispatch
            tasks = self.generate_turnaround_tasks(flight_id, ...)
            self.scheduler.emergency_dispatch(tasks)
    
    def predict_workload(self, lookahead_minutes=120):
        """
        Use A-CDM schedule to predict GSE demand.
        Enables proactive charging and positioning.
        """
        future_flights = self.acdm.get_flights_in_window(
            time.now(), 
            time.now() + lookahead_minutes * 60
        )
        
        demand_by_type = defaultdict(list)
        for flight in future_flights:
            tasks = self.generate_turnaround_tasks(flight, ...)
            for task in tasks:
                demand_by_type[task.required_type].append({
                    'time': task.earliest,
                    'location': task.location,
                    'duration': task.duration
                })
        
        return demand_by_type  # Feeds charging scheduler and positioning
```

### 7.2 Predictive vs Reactive Performance

| Metric | Reactive Only | A-CDM Predictive | Improvement |
|--------|--------------|-----------------|-------------|
| Average GSE arrival time (after AIBT) | 3-8 min | 0-2 min | 60-75% |
| Empty repositioning distance | 100% baseline | 60-70% | 30-40% reduction |
| Turnaround delay (GSE-caused) | 5-10 min avg | 1-3 min avg | 50-70% |
| Vehicle utilization | 45-55% | 60-70% | +15-25 pp |
| Fuel/energy consumption | 100% baseline | 75-85% | 15-25% reduction |

---

## 8. Multi-Objective Optimization

### 8.1 Competing Objectives

Airside GSE scheduling involves multiple conflicting objectives:

1. **Minimize turnaround time**: Get all tasks done fast → favors over-provisioning and aggressive assignment
2. **Minimize energy consumption**: Reduce travel distance and idle time → favors local assignment, may delay
3. **Maximize safety margins**: Keep vehicles well-maintained, well-charged, within ODD → conservative assignment
4. **Minimize fleet size**: Use fewer vehicles → pack schedules tightly, risk cascade delays
5. **Maximize fairness**: Even workload distribution across vehicles → may not assign nearest vehicle
6. **Minimize disruption**: Stable schedule, few reassignments → resist re-optimization

### 8.2 Pareto-Optimal Scheduling

```python
def multi_objective_schedule(vehicles, tasks, weights=None):
    """
    Scalarized multi-objective optimization.
    
    Default weights tuned for airport operations:
    - On-time performance is paramount (airlines pay for delays)
    - Energy matters for battery vehicles
    - Safety cannot be traded off (constraint, not objective)
    """
    if weights is None:
        weights = {
            'tardiness': 0.50,      # Primary: on-time delivery
            'travel_cost': 0.20,    # Secondary: energy/wear
            'utilization': 0.15,    # Tertiary: fleet efficiency
            'stability': 0.10,     # Keep existing assignments when possible
            'fairness': 0.05,      # Even workload distribution
        }
    
    # Safety is a hard constraint, not weighted
    model = build_cp_model(vehicles, tasks)
    
    # Individual objectives
    tardiness_obj = sum_tardiness(model)
    travel_obj = total_travel_cost(model)
    utilization_obj = neg_total_idle_time(model)
    stability_obj = changes_from_current_schedule(model)
    fairness_obj = max_min_workload_difference(model)
    
    # Scalarized objective
    model.Minimize(
        weights['tardiness'] * tardiness_obj * 100 +
        weights['travel_cost'] * travel_obj +
        weights['utilization'] * utilization_obj +
        weights['stability'] * stability_obj * 50 +
        weights['fairness'] * fairness_obj * 20
    )
    
    return solve(model)
```

### 8.3 Priority-Based Task Ordering

Not all tasks are equal. Priority determines which task gets the best vehicle assignment:

| Priority Level | Example Tasks | Scheduling Policy |
|---------------|---------------|-------------------|
| **P0 — Safety-critical** | Emergency response, runway incursion clear | Immediate preemption of any task |
| **P1 — Time-critical** | Pushback (TSAT slot), fuel (hot turnaround) | Guaranteed on-time, best vehicle |
| **P2 — Turnaround-critical** | Belt loading, deplaning, boarding | Best effort on-time, reassign if delayed |
| **P3 — Service** | Catering, water, lavatory | Flexible window, assign after P1/P2 |
| **P4 — Maintenance** | Repositioning, self-charging, calibration | Fill idle time, defer if busy |

---

## 9. Reinforcement Learning for Fleet Dispatch

### 9.1 Why RL for Dispatch

Traditional optimization (MILP, CP) provides optimal static schedules but struggles with:
- **Real-time adaptation**: Re-solving takes seconds; RL policy infers in <1ms
- **Learning patterns**: RL discovers temporal patterns (rush hours, seasonal effects) that are hard to encode as constraints
- **Stochastic optimization**: RL naturally handles uncertain task durations and arrivals

### 9.2 Dispatch as a Markov Decision Process

```python
class DispatchMDP:
    """
    MDP formulation for fleet dispatch.
    
    State: (vehicle_states, task_queue, time, weather, A-CDM_schedule)
    Action: assignment of next available vehicle to next task
    Reward: -tardiness - travel_cost + completion_bonus
    """
    
    # State representation (for neural network input)
    def get_state(self):
        # Vehicle features (per vehicle)
        vehicle_features = []
        for v in self.vehicles:
            vehicle_features.append([
                v.position.x, v.position.y,     # Location
                v.battery_fraction,              # Battery
                v.status_onehot,                 # IDLE/BUSY/CHARGING
                v.current_task_remaining_time,   # Time to complete current task
                v.type_onehot,                   # Vehicle type
            ])
        
        # Task features (per pending task)
        task_features = []
        for t in self.pending_tasks[:50]:  # Cap at 50 tasks
            task_features.append([
                t.location.x, t.location.y,
                t.earliest - time.now(),         # Time until window opens
                t.latest - time.now(),           # Time until deadline
                t.duration,
                t.priority,
                t.type_onehot,
            ])
        
        # Global features
        global_features = [
            time.hour / 24,                      # Time of day
            self.weather_code,
            len(self.pending_tasks),
            self.fleet_utilization,
            self.average_battery,
        ]
        
        return vehicle_features, task_features, global_features
    
    def step(self, action):
        """
        Action: (vehicle_idx, task_idx) pair
        Returns: next_state, reward, done
        """
        vehicle = self.vehicles[action.vehicle_idx]
        task = self.pending_tasks[action.task_idx]
        
        # Execute assignment
        travel_time = self.travel(vehicle, task.location)
        start_time = max(time.now() + travel_time, task.earliest)
        completion_time = start_time + task.duration
        
        # Reward
        tardiness = max(0, completion_time - task.latest)
        reward = (
            -tardiness * 10 * task.priority +      # Heavy tardiness penalty
            -travel_time * 0.5 +                    # Travel cost
            (10 if tardiness == 0 else 0) +         # On-time bonus
            -max(0, 0.2 - vehicle.battery_fraction) * 50  # Low battery penalty
        )
        
        return self.get_state(), reward, self.all_tasks_done()
```

### 9.3 Training Architecture

```python
# PPO training for dispatch policy
# Train in simulation (SUMO + airport model), deploy on fleet manager

class DispatchPolicyNetwork(nn.Module):
    """
    Attention-based policy for variable-size vehicle/task sets.
    Architecture: Set Transformer variant.
    """
    def __init__(self, vehicle_dim=8, task_dim=8, embed_dim=64):
        super().__init__()
        self.vehicle_encoder = nn.Sequential(
            nn.Linear(vehicle_dim, embed_dim),
            nn.ReLU(),
            nn.Linear(embed_dim, embed_dim)
        )
        self.task_encoder = nn.Sequential(
            nn.Linear(task_dim, embed_dim),
            nn.ReLU(),
            nn.Linear(embed_dim, embed_dim)
        )
        # Cross-attention: vehicles attend to tasks
        self.cross_attn = nn.MultiheadAttention(embed_dim, 4, batch_first=True)
        # Score head: compatibility score for each (vehicle, task) pair
        self.score_head = nn.Sequential(
            nn.Linear(embed_dim * 2, embed_dim),
            nn.ReLU(),
            nn.Linear(embed_dim, 1)
        )
    
    def forward(self, vehicle_features, task_features, mask):
        v_embed = self.vehicle_encoder(vehicle_features)  # [B, N_v, D]
        t_embed = self.task_encoder(task_features)         # [B, N_t, D]
        
        # Cross-attention
        v_context, _ = self.cross_attn(v_embed, t_embed, t_embed)
        
        # Pairwise scores
        N_v, N_t = v_embed.size(1), t_embed.size(1)
        v_exp = v_context.unsqueeze(2).expand(-1, -1, N_t, -1)
        t_exp = t_embed.unsqueeze(1).expand(-1, N_v, -1, -1)
        pairs = torch.cat([v_exp, t_exp], dim=-1)  # [B, N_v, N_t, 2D]
        scores = self.score_head(pairs).squeeze(-1)  # [B, N_v, N_t]
        
        # Mask infeasible assignments (wrong type, insufficient battery)
        scores = scores.masked_fill(~mask, -1e9)
        
        # Sample action (vehicle, task) from scores
        flat_scores = scores.view(scores.size(0), -1)
        probs = F.softmax(flat_scores, dim=-1)
        return probs

# Training: PPO with SUMO airport simulation
# 1M episodes, ~3-5 hours on single GPU
# Achieves within 2-5% of CP-SAT optimal on test instances
# But infers in <1ms — 1000x faster than re-solving
```

### 9.4 RL vs Traditional: When to Use Each

| Scenario | Best Approach | Why |
|----------|--------------|-----|
| Shift planning (8h ahead) | CP-SAT | Full information, time to optimize |
| Rolling replan (1-2h) | CBBA or CP-SAT | Moderate information, moderate time |
| Real-time dispatch (new task) | RL policy or SSI auction | <1ms decision needed |
| Disruption response | RL policy → verify with CP-SAT | Fast initial response, optimal correction |
| Fleet warmup (no history) | CP-SAT + greedy | No training data for RL |
| Steady state (6+ months data) | RL policy | Learned patterns outperform static rules |

---

## 10. Charging and Energy-Aware Scheduling

### 10.1 Charging as a Scheduling Constraint

For electric GSE fleets, battery state transforms the scheduling problem:

```python
class ChargingAwareScheduler:
    """
    Integrates charging decisions into task allocation.
    
    Charging is not a separate problem — it's another "task" that competes
    for vehicle time and must be scheduled alongside service tasks.
    """
    
    def __init__(self, chargers, vehicles, tasks):
        self.chargers = chargers      # List[Charger] with location, power_kw
        self.vehicles = vehicles
        self.tasks = tasks
        
        # Battery model parameters
        self.kwh_per_km = 0.15        # Energy per km travel (loaded)
        self.kwh_per_min_task = 0.05  # Energy per minute performing task
        self.kwh_per_min_idle = 0.02  # Idle consumption (perception running)
        self.charge_rate_kw = {       # Charge power by charger type
            'AC_L2': 7.2,             # 7.2 kW — overnight, 6-8 hours
            'DC_FAST': 50,            # 50 kW — opportunity charging, 15-30 min
            'DC_ULTRA': 150,          # 150 kW — rapid top-up, 5-10 min
        }
    
    def schedule_with_charging(self):
        """
        Joint optimization of task assignment and charging scheduling.
        
        Insert charging "tasks" into vehicle routes when:
        1. Battery will drop below 20% before next task
        2. Vehicle is idle for >15 minutes near a charger
        3. Demand prediction shows upcoming busy period (charge now)
        """
        model = cp_model.CpModel()
        
        # Standard task variables (as before)
        # ...
        
        # Add charging opportunity variables
        for v in self.vehicles:
            for c in self.chargers:
                for slot in self.get_available_charging_slots(c):
                    # Boolean: does vehicle v charge at charger c in slot?
                    charge_var = model.NewBoolVar(f'charge_{v.id}_{c.id}_{slot}')
                    
                    # If charging, vehicle cannot be doing a task
                    # Modeled as optional interval with NoOverlap
                    
        # Battery tracking constraint
        for v in self.vehicles:
            battery = v.initial_battery
            for task_or_charge in v.planned_sequence:
                if isinstance(task_or_charge, Task):
                    battery -= self.energy_for_task(v, task_or_charge)
                elif isinstance(task_or_charge, ChargingSlot):
                    battery += self.energy_from_charging(task_or_charge)
                # Constraint: battery >= 15% at all times
                model.Add(battery >= int(v.battery_capacity * 0.15 * 100))
        
        return solve(model)
    
    def opportunity_charging_policy(self, vehicle):
        """
        Simple rule-based charging policy for real-time decisions.
        
        Rules (ordered by priority):
        1. If battery < 20%: MUST charge at nearest DC_FAST
        2. If battery < 40% AND idle for >10 min: charge at nearest
        3. If battery < 60% AND no tasks for >30 min: opportunistic charge
        4. If battery < 80% AND depot idle: top up on AC_L2
        """
        battery_pct = vehicle.battery_fraction * 100
        idle_forecast = self.predict_idle_time(vehicle)
        
        if battery_pct < 20:
            return ChargingCommand('DC_FAST', priority='CRITICAL')
        elif battery_pct < 40 and idle_forecast > 10:
            return ChargingCommand('DC_FAST', priority='HIGH')
        elif battery_pct < 60 and idle_forecast > 30:
            return ChargingCommand('DC_FAST', priority='MEDIUM')
        elif battery_pct < 80 and vehicle.at_depot:
            return ChargingCommand('AC_L2', priority='LOW')
        
        return None  # No charging needed
```

### 10.2 Charger Assignment Problem

With limited chargers, assigning vehicles to charging stations is itself an optimization:

| Airport Size | DC Fast Chargers | AC L2 Chargers | Vehicles per Charger |
|-------------|-----------------|----------------|---------------------|
| Small (30 GSE) | 3-5 | 10-15 | 2-6:1 |
| Medium (150 GSE) | 10-20 | 40-60 | 5-8:1 |
| Large (400 GSE) | 25-50 | 100-150 | 5-10:1 |

At peak demand, charger contention requires scheduling (queuing theory: M/G/c queue). Average wait time for DC fast charging: 5-15 minutes at 80% utilization, rapidly increasing beyond 85%.

---

## 11. Safety and ODD Constraints in Task Allocation

### 11.1 Safety-Constrained Assignment

Not all vehicles can perform all tasks safely at all times:

```python
class SafetyConstrainedAssigner:
    """
    Safety constraints that override economic optimization.
    
    A vehicle is INELIGIBLE for a task if:
    1. Sensor health below threshold (degradation score < 0.7)
    2. Outside ODD (weather, time-of-day, visibility)
    3. Battery below safe minimum for route + task + return
    4. Calibration age exceeds threshold
    5. Software version mismatch
    6. Task requires capability vehicle doesn't have
    """
    
    def safety_eligible(self, vehicle, task):
        """Hard safety eligibility check — cannot be overridden."""
        
        # Sensor health
        if vehicle.sensor_health_score < 0.7:
            if task.requires_precision_docking:
                return False, "Sensor degradation incompatible with docking"
        
        # ODD check
        if not self.odd_manager.is_within_odd(vehicle, task.location, task.time):
            return False, f"Vehicle {vehicle.id} outside ODD for {task.location}"
        
        # Battery: must have enough for task + return to charger + 15% reserve
        required_energy = (
            self.energy_for_travel(vehicle.location, task.location) +
            self.energy_for_task(task) +
            self.energy_for_travel(task.location, nearest_charger(task.location)) +
            vehicle.battery_capacity * 0.15  # 15% reserve
        )
        if vehicle.battery_kwh < required_energy:
            return False, "Insufficient battery for safe task completion"
        
        # Calibration freshness
        if vehicle.calibration_age_hours > 168:  # 1 week
            return False, "Calibration expired — needs recalibration"
        
        return True, "Eligible"
    
    def constrained_assign(self, vehicles, tasks):
        """
        Assignment with safety constraints as hard constraints.
        Economic optimization only within safety-eligible set.
        """
        # Build eligibility matrix
        eligible = {}
        for v in vehicles:
            for t in tasks:
                ok, reason = self.safety_eligible(v, t)
                eligible[v.id, t.id] = ok
        
        # Pass to optimizer with eligibility as hard constraint
        return self.optimizer.solve(
            vehicles, tasks,
            additional_constraints={'eligibility': eligible}
        )
```

### 11.2 Graceful Degradation under Fleet Reduction

When vehicles become unavailable (breakdown, charging, ODD exit), the scheduler must decide which tasks to delay or drop:

| Fleet Availability | Strategy | Acceptable Outcome |
|-------------------|----------|-------------------|
| >90% | Normal scheduling | All tasks on time |
| 70-90% | Priority-based shedding | P3/P4 tasks delayed, P0-P2 on time |
| 50-70% | Turnaround triage | Focus on critical-path tasks only |
| <50% | Emergency mode | Manual dispatch, alert all operators |

---

## 12. Implementation Architecture

### 12.1 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Fleet Management Server                │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐            │
│  │ A-CDM    │  │ Task     │  │ Schedule  │            │
│  │ Client   │  │ Generator│  │ Optimizer │            │
│  │ (SWIM)   │  │          │  │ (CP-SAT)  │            │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘            │
│       │              │              │                    │
│  ┌────▼──────────────▼──────────────▼─────┐            │
│  │        Dispatch Coordinator             │            │
│  │  - Rolling horizon (15 min replan)      │            │
│  │  - Event-driven rescheduling            │            │
│  │  - RL policy for real-time dispatch     │            │
│  └────────────────┬───────────────────────┘            │
│                   │ 5G/CBRS                              │
└───────────────────┼─────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────────────┐
    │               │                       │
┌───▼───┐     ┌────▼────┐            ┌─────▼─────┐
│Vehicle│     │Vehicle  │   ...      │Vehicle    │
│Agent 1│     │Agent 2  │            │Agent N    │
│(Orin) │     │(Orin)   │            │(Orin)     │
│       │     │         │            │           │
│CBBA   │     │CBBA     │            │CBBA       │
│local  │     │local    │            │local      │
│sched  │     │sched    │            │sched      │
└───────┘     └─────────┘            └───────────┘
```

### 12.2 ROS Noetic Integration

```python
#!/usr/bin/env python3
"""
Fleet dispatch node for autonomous GSE.
Runs on fleet management server (not on vehicle Orin).
"""
import rospy
from std_msgs.msg import String
from fleet_msgs.msg import (
    TaskAnnouncement, TaskAssignment, VehicleStatus,
    BidMessage, ScheduleUpdate, ACDMUpdate
)

class FleetDispatchNode:
    def __init__(self):
        rospy.init_node('fleet_dispatch')
        
        # Subscribers
        rospy.Subscriber('/acdm/updates', ACDMUpdate, self.on_acdm)
        rospy.Subscriber('/fleet/vehicle_status', VehicleStatus, self.on_vehicle_status)
        rospy.Subscriber('/fleet/bids', BidMessage, self.on_bid)
        
        # Publishers
        self.task_pub = rospy.Publisher('/fleet/task_assignments', TaskAssignment, queue_size=50)
        self.announce_pub = rospy.Publisher('/fleet/task_announcements', TaskAnnouncement, queue_size=50)
        self.schedule_pub = rospy.Publisher('/fleet/schedule', ScheduleUpdate, queue_size=10)
        
        # Schedulers
        self.cpsat_scheduler = CPSATScheduler()
        self.cbba_coordinator = CBBACoordinator()
        self.auction_dispatcher = AuctionDispatcher()
        self.rl_policy = load_dispatch_policy('dispatch_ppo_v3.onnx')
        
        # State
        self.vehicles = {}
        self.pending_tasks = []
        self.current_schedule = None
        
        # Timers
        rospy.Timer(rospy.Duration(900), self.rolling_replan)  # 15 min
        rospy.Timer(rospy.Duration(1), self.monitor_deadlines)  # 1 Hz
    
    def rolling_replan(self, event):
        """Periodic re-optimization with CP-SAT."""
        tasks_2h = self.get_tasks_in_window(time.now(), time.now() + 7200)
        available = [v for v in self.vehicles.values() if v.is_operational()]
        
        new_schedule = self.cpsat_scheduler.solve(
            available, tasks_2h,
            fixed=self.get_committed_assignments(),
            time_limit=15  # 15 seconds
        )
        
        if new_schedule:
            self.current_schedule = new_schedule
            self.publish_schedule(new_schedule)
    
    def on_new_task(self, task):
        """Immediate dispatch for newly arriving tasks."""
        # RL policy for fast decision
        state = self.get_dispatch_state()
        action = self.rl_policy.infer(state, task)
        
        # Verify safety
        vehicle = self.vehicles[action.vehicle_id]
        eligible, reason = self.safety_check(vehicle, task)
        
        if eligible:
            self.assign(vehicle, task)
        else:
            # Fall back to auction
            self.auction_dispatcher.announce_task(task)
```

### 12.3 On-Vehicle Agent (Orin)

```python
class VehicleDispatchAgent:
    """
    Runs on each vehicle's Orin.
    Participates in CBBA and executes assigned tasks.
    """
    
    def __init__(self):
        rospy.init_node('vehicle_dispatch_agent')
        
        self.cbba = CBBAAgent(
            vehicle_id=rospy.get_param('~vehicle_id'),
            vehicle_type=rospy.get_param('~vehicle_type'),
            position=self.get_current_position(),
            battery=self.get_battery_state()
        )
        
        self.task_queue = []  # Assigned tasks in order
        self.current_task = None
        
        rospy.Subscriber('/fleet/task_assignments', TaskAssignment, self.on_assignment)
        rospy.Subscriber('/fleet/task_announcements', TaskAnnouncement, self.on_announcement)
        
        self.status_pub = rospy.Publisher('/fleet/vehicle_status', VehicleStatus, queue_size=10)
        self.bid_pub = rospy.Publisher('/fleet/bids', BidMessage, queue_size=50)
        
        rospy.Timer(rospy.Duration(1), self.publish_status)
        rospy.Timer(rospy.Duration(0.1), self.execute_task)  # 10 Hz
    
    def on_announcement(self, msg):
        """Respond to auction with bid."""
        if msg.task_type != self.cbba.type:
            return  # Not my type
        
        cost = self.compute_bid_cost(msg)
        if cost < float('inf'):
            bid = BidMessage(
                task_id=msg.task_id,
                vehicle_id=self.cbba.id,
                cost=cost,
                estimated_arrival=self.eta(msg.location),
                battery_remaining_after=self.battery_after(msg),
                confidence=self.perception_confidence()
            )
            self.bid_pub.publish(bid)
    
    def execute_task(self, event):
        """Task execution state machine."""
        if self.current_task is None:
            if self.task_queue:
                self.current_task = self.task_queue.pop(0)
                self.navigate_to(self.current_task.location)
            return
        
        if self.current_task.state == 'NAVIGATING':
            if self.at_location(self.current_task.location):
                self.current_task.state = 'EXECUTING'
        elif self.current_task.state == 'EXECUTING':
            if self.task_complete():
                self.report_completion(self.current_task)
                self.current_task = None
```

---

## 13. Key Takeaways

1. **Airside GSE task allocation is MT-SR-TA (multi-task, single-robot, time-extended)**, one of the harder MRTA variants. It combines assignment, scheduling, routing, and resource allocation with stochastic disruptions. NP-hard in general.

2. **The problem is tractable at Aurrigo's scale**. With 20-50 vehicles and 200-500 tasks per day, CP-SAT solves to optimality in 10-60 seconds. Even medium hubs (200 vehicles, 3000 tasks) are solvable with decomposition.

3. **CP-SAT (OR-Tools) outperforms MILP for this problem**. The NoOverlap constraint, optional intervals, and parallel search make CP-SAT 5-10x faster than MILP formulations for scheduling-heavy problems. Google's OR-Tools is free and production-grade.

4. **Hybrid centralized + decentralized is optimal**. CP-SAT for shift planning (every 2 hours), CBBA for medium-term adjustment (every 15 minutes), SSI auction for real-time task dispatch (per event). Each layer compensates for the others' weaknesses.

5. **A-CDM integration is the single highest-value improvement**. ELDT gives 15-30 minutes advance notice of aircraft arrival. Pre-computing assignments and pre-positioning vehicles reduces GSE arrival delay by 60-75% and empty travel by 30-40%.

6. **Precedence constraints dominate the problem structure**. The turnaround task graph (deplaning → fueling → boarding → pushback) creates critical paths. Scheduling algorithms must reason about task ordering, not just assignment.

7. **CBBA converges in O(n) iterations** for n vehicles — feasible over airport 5G with <100ms per iteration. For 50 vehicles, convergence in 50 iterations × 50ms ≈ 2.5 seconds. Achieves ~95% of centralized optimal.

8. **Charging transforms the scheduling problem**. Electric GSE must schedule charging alongside service tasks. Joint optimization reduces fleet size by 10-15% vs treating charging as a separate problem.

9. **Rolling horizon with 15-minute replan cycle** balances optimality and reactivity. Committed horizon of 30 minutes prevents thrashing; planning horizon of 2 hours captures upcoming demand.

10. **RL dispatch policy infers in <1ms** — 1000x faster than re-solving CP-SAT. Train with PPO in SUMO airport simulation. After 6+ months of fleet data, RL matches or exceeds human dispatchers on standard metrics.

11. **Event-driven rescheduling minimizes disruption**. When a flight is delayed, only reassign affected tasks. Schedule stability metric >85% — passengers and airlines don't see the replanning.

12. **Safety constraints are hard, not weighted**. Sensor health, ODD compliance, battery reserve, and calibration freshness are eligibility filters, not cost terms. No economic benefit justifies unsafe assignment.

13. **Priority-based task shedding enables graceful degradation**. When fleet availability drops below 70%, shed P3/P4 tasks first. Below 50%, focus exclusively on critical-path turnaround tasks.

14. **Empty repositioning ratio is the key efficiency metric**. Current manual dispatch: 40-50% empty travel. Optimized autonomous: 20-30%. This directly maps to energy savings and fleet size reduction.

15. **The attention-based RL architecture handles variable fleet/task sizes**. Set Transformer over vehicle and task embeddings with cross-attention produces (vehicle, task) scores. Masks enforce type compatibility and safety constraints.

16. **Total implementation cost: $40-65K over 10-16 weeks**. Phase 1 (CP-SAT + greedy, 4 weeks, $12-18K), Phase 2 (A-CDM + auction, 4 weeks, $12-18K), Phase 3 (CBBA + RL, 4-8 weeks, $16-29K).

17. **No competing airside autonomous GSE platform has published scheduling algorithms**. UISEE, TractEasy, and AeroVect all use simple rule-based or manual dispatch. Optimal scheduling is a differentiator that improves with fleet scale.

---

## Cost and Implementation Roadmap

| Phase | Scope | Duration | Cost | Deliverable |
|-------|-------|----------|------|-------------|
| **Phase 1** | CP-SAT solver + greedy fallback + ROS node | 4 weeks | $12-18K | Centralized optimal scheduling for 20-50 vehicles |
| **Phase 2** | A-CDM integration + SSI auction dispatch | 4 weeks | $12-18K | Predictive scheduling + real-time dispatch |
| **Phase 3** | CBBA decentralized + charging-aware | 4-5 weeks | $10-17K | Resilient scheduling, energy optimization |
| **Phase 4** | RL policy training + deployment | 3-4 weeks | $8-14K | <1ms dispatch, learned patterns |
| **Total** | End-to-end fleet scheduling system | 15-17 weeks | $42-67K | Full centralized + decentralized scheduling |

---

## References

### Internal Repository
- `technology/multi-agent/fleet-coordination.md` — Multi-agent coordination overview, MARL, game theory
- `technology/multi-agent/v2x-protocols-airside.md` — V2X communication for fleet messaging
- `operations/deployment/fleet-management-dispatch.md` — Fleet management platforms (NVIDIA Fleet Command, AWS IoT)
- `operations/airside/airport-data-integration.md` — A-CDM data sources, SWIM, AODB
- `operations/airside/battery-charging-infrastructure.md` — Charging infrastructure, LiFePO4, autonomous self-charging
- `operations/deployment/fleet-tco-business-case.md` — Fleet economics, break-even analysis
- `technology/planning/autonomous-docking-precision-positioning.md` — Precision docking for GSE tasks

### External
- Choi, H.L., Brunet, L., & How, J.P. (2009). "Consensus-Based Decentralized Auctions for Robust Task Allocation." IEEE Transactions on Robotics.
- Gerkey, B.P. & Matarić, M.J. (2004). "A Formal Analysis and Taxonomy of Task Allocation in Multi-Robot Systems." Int. J. Robotics Research.
- Korsah, G.A., Stentz, A., & Dias, M.B. (2013). "A comprehensive taxonomy for multi-robot task allocation." Int. J. Robotics Research.
- OR-Tools CP-SAT Solver: Google Operations Research.
- "A comprehensive review of ground support equipment scheduling for aircraft ground handling services." Transportation Research Part E (2025).
- "A Two-Stage Optimization Model for Airport Stand Allocation and Ground Support Vehicle Scheduling." Applied Sciences (2024).
- "FLEET: Formal Language-Grounded Scheduling for Heterogeneous Robot Teams." arXiv (2025).
- "Task Allocation in Mobile Robot Fleets: A review." arXiv (2025).
