# Multi-Agent Coordination for Airside Autonomous GSE

## How Multiple Autonomous Vehicles Operate Together on an Airport Apron

---

## 1. The Coordination Problem

An aircraft turnaround requires **9-12 different GSE types** arriving and departing from a single stand in a choreographed sequence. With autonomous GSE, this choreography must be computed, not improvised.

### 1.1 Turnaround Sequence

```
ARRIVAL PHASE (aircraft arrives at stand):
  t=0:   Aircraft stops, chocks placed, engines shutdown
  t+2m:  Jet bridge/stairs connect
  t+3m:  Ground Power Unit (GPU) connects
  t+3m:  Belt loader positions at forward cargo door
  t+5m:  Baggage tractor + dollies arrive at belt loader
  t+5m:  Fuel truck positions (can start while passengers deplane)

TURNAROUND PHASE (parallel operations):
  t+5m:  Passengers deplane via jet bridge
  t+5m:  Forward cargo unloading begins (belt loader + tractor)
  t+8m:  Aft cargo door opens, second belt loader positions
  t+10m: Catering truck arrives (scissor lift to aircraft door)
  t+10m: Lavatory/water service vehicles arrive
  t+15m: Cleaning crew enters aircraft

  t+20m: Forward cargo loading begins (new ULDs/bags)
  t+25m: Catering loading complete, truck departs
  t+30m: New passengers begin boarding
  t+35m: Aft cargo loading complete

DEPARTURE PHASE:
  t+35m: All cargo doors closed
  t+38m: Belt loaders depart
  t+40m: Fuel truck disconnects, departs
  t+42m: All passengers boarded, doors close
  t+43m: Jet bridge retracts
  t+44m: GPU disconnects
  t+45m: Pushback tug positions
  t+47m: Pushback begins (chocks removed, tug connected)
  t+50m: Aircraft pushed to taxi position, tug disconnects
```

### 1.2 Coordination Requirements

For N autonomous GSE at one stand:
- **Spatial deconfliction:** No two vehicles occupy the same space
- **Temporal sequencing:** Some operations must precede others (can't load before unload)
- **Priority management:** Emergency vehicles always have priority
- **Dynamic replanning:** Handle delays, cancellations, gate changes
- **Communication:** Vehicles must share intentions and positions

For M stands with N vehicles each:
- **Fleet-level routing:** Which vehicle goes to which stand
- **Charging management:** Don't run out of battery mid-turnaround
- **Load balancing:** Distribute work evenly across fleet
- **Deadlock prevention:** Don't create gridlock on narrow apron paths

---

## 2. Coordination Architectures

### 2.1 Centralized (Moonware HALO Model)

```
Central Dispatcher (cloud/edge server):
  ├── Receives: flight schedule, turnaround phase per stand, vehicle positions
  ├── Computes: optimal assignment of vehicles to tasks
  ├── Sends: task commands to each vehicle
  └── Monitors: completion, delays, conflicts

Vehicle:
  ├── Receives: "Go to Stand B12, task: unload_forward_cargo"
  ├── Navigates: autonomously to stand
  ├── Executes: task
  └── Reports: completion/failure to dispatcher

Pros: Globally optimal, single point of coordination, easier to reason about
Cons: Single point of failure, latency to cloud, can't operate disconnected
```

### 2.2 Decentralized (Auction-Based)

```
Each vehicle:
  ├── Observes: available tasks (broadcast by stands/dispatcher)
  ├── Bids: "I can do task X in Y minutes at Z cost" (based on distance, battery, current task)
  ├── Wins: highest-utility bid wins the task
  └── Executes: independently

Algorithm: Consensus-Based Bundle Algorithm (CBBA)
  - 50% optimality guarantee vs centralized optimal
  - Polynomial scaling with fleet size
  - Handles communication dropout gracefully
  - Each vehicle maintains local copy of task allocation

Pros: Robust to failures, no single point of failure, works with intermittent connectivity
Cons: Sub-optimal (50% guarantee), harder to debug, coordination delay
```

### 2.3 Hybrid (Recommended for Airside)

```
Central Dispatcher (A-CDM integrated):
  ├── Strategic: Assigns vehicles to turnarounds (minutes ahead)
  ├── Tactical: Sequences tasks within a turnaround
  └── Monitoring: Tracks progress, detects delays

Vehicle-Level Autonomy:
  ├── Navigation: Independent path planning and obstacle avoidance
  ├── Conflict resolution: Local deconfliction with nearby vehicles
  ├── Fallback: Can operate independently if dispatcher offline
  └── World model: Predicts other agents' behavior for anticipatory planning

Communication:
  ├── Dispatcher → Vehicle: Task assignments, priority updates
  ├── Vehicle → Dispatcher: Position, status, task completion
  └── Vehicle → Vehicle: Planned trajectory broadcast (V2V for local deconfliction)
```

---

## 3. Conflict Resolution on Apron

### 3.1 Priority Hierarchy (ICAO-Based)

```
Priority (highest to lowest):
  1. Aircraft (always yields to)
  2. Emergency/rescue vehicles
  3. Aircraft pushback in progress
  4. Fuel trucks (hazardous cargo)
  5. Passenger buses/stairs (people onboard)
  6. Other GSE (ordered by task urgency)
  7. Non-task vehicles (repositioning, charging)
```

### 3.2 Spatial Deconfliction

```python
class ApronConflictResolver:
    def check_conflict(self, vehicle_a, vehicle_b):
        """Check if two vehicle trajectories conflict."""
        for t in range(prediction_horizon):
            pos_a = vehicle_a.planned_trajectory[t]
            pos_b = vehicle_b.planned_trajectory[t]

            # Minimum separation distance (depends on vehicle types)
            min_sep = self.get_min_separation(vehicle_a.type, vehicle_b.type)

            if distance(pos_a, pos_b) < min_sep:
                return ConflictResult(
                    time=t,
                    location=(pos_a + pos_b) / 2,
                    vehicles=[vehicle_a.id, vehicle_b.id],
                    resolution=self.resolve(vehicle_a, vehicle_b, t)
                )
        return None

    def resolve(self, vehicle_a, vehicle_b, conflict_time):
        """Resolve conflict based on priority."""
        if vehicle_a.priority > vehicle_b.priority:
            return Resolution(yield_vehicle=vehicle_b, action='WAIT')
        elif vehicle_b.priority > vehicle_a.priority:
            return Resolution(yield_vehicle=vehicle_a, action='WAIT')
        else:
            # Same priority: vehicle further from destination yields
            if vehicle_a.distance_to_goal > vehicle_b.distance_to_goal:
                return Resolution(yield_vehicle=vehicle_a, action='WAIT')
            else:
                return Resolution(yield_vehicle=vehicle_b, action='WAIT')
```

### 3.3 World Model for Multi-Agent Prediction

The world model predicts other agents' behavior — critical for anticipatory coordination:

```
World model input:
  - Current occupancy (all vehicles, aircraft, personnel)
  - Each vehicle's planned trajectory (broadcast via V2V)
  - Turnaround phase per stand (from dispatcher)

World model output:
  - Predicted occupancy in 2-8 seconds
  - Predicted conflict zones
  - Predicted safe corridors

Planning:
  - Score ego trajectories against predicted multi-agent occupancy
  - Avoid trajectories that lead to future conflicts
  - Prefer trajectories that maintain safe separation
```

---

## 4. Fleet Task Allocation

### 4.1 The Problem: VRPTW

Vehicle Routing Problem with Time Windows (VRPTW):

```
Given:
  - N vehicles (each with position, battery level, current task)
  - M tasks (each with stand location, time window, duration, GSE type needed)
  - Travel times between all locations
  - Battery constraints (must reach charger before depleted)

Find:
  - Assignment of tasks to vehicles
  - Route for each vehicle (sequence of tasks)
  - Minimize: total travel time + task delay + charging stops

Constraints:
  - Each task assigned to exactly one vehicle of correct type
  - Task completed within time window
  - Vehicle battery sufficient for route
  - No two vehicles at same stand simultaneously (unless different tasks)
```

### 4.2 Solving VRPTW

| Method | Optimality | Speed | Scale | For Airside |
|--------|-----------|-------|-------|-------------|
| **Exact (ILP)** | Optimal | Slow | <20 vehicles | Academic only |
| **Genetic Algorithm** | Near-optimal | Medium | 50-100 vehicles | Good for planning |
| **Auction (CBBA)** | 50% guarantee | Fast | 100+ vehicles | Good for real-time |
| **RL (MARL)** | Learned | Very fast | 100+ vehicles | Future research |
| **Greedy dispatch** | Poor | Instant | Any | Baseline fallback |

**Recommendation:** Genetic Algorithm for strategic planning (5-15 min horizon), auction-based for tactical replanning (real-time).

---

## 5. Integration with A-CDM

### 5.1 Turnaround Phase as Dispatch Trigger

```
A-CDM Milestone → GSE Dispatch Trigger:

EIBT (Estimated In-Block Time) → Pre-position unloading GSE
  → 10 min before: Belt loaders move to stand
  → 5 min before: Baggage tractors queue near stand

AIBT (Actual In-Block Time) → Start unloading sequence
  → Immediately: GPU connect, stairs/bridge deploy
  → +3 min: Belt loaders deploy, unloading begins

TOBT (Target Off-Block Time) → Start loading sequence
  → -30 min: Loading GSE dispatched
  → -15 min: All cargo loaded, begin closing

TSAT (Target Start-up Approval Time) → Prepare for pushback
  → -5 min: Pushback tug positions behind aircraft
  → -2 min: All GSE clear of safety zone

AOBT (Actual Off-Block Time) → Post-departure cleanup
  → +1 min: GPU removed, area cleared
  → +5 min: Stand available for next arrival
```

### 5.2 Just-In-Time Dispatch

```python
class JITDispatcher:
    def dispatch_for_turnaround(self, flight, stand, acdm_data):
        """Dispatch GSE based on A-CDM milestone predictions."""
        eibt = acdm_data.get_eibt(flight)
        tobt = acdm_data.get_tobt(flight)

        # Phase 1: Pre-position (before aircraft arrives)
        self.schedule_task(
            task_type='unload_cargo',
            stand=stand,
            start_time=eibt - timedelta(minutes=5),
            gse_type='belt_loader',
            priority=5,
        )
        self.schedule_task(
            task_type='deliver_baggage',
            stand=stand,
            start_time=eibt - timedelta(minutes=3),
            gse_type='baggage_tractor',
            priority=5,
        )

        # Phase 2: Turnaround operations
        self.schedule_task(
            task_type='refuel',
            stand=stand,
            start_time=eibt + timedelta(minutes=5),
            gse_type='fuel_truck',
            priority=6,  # higher priority — blocks departure
        )

        # Phase 3: Departure preparation
        self.schedule_task(
            task_type='pushback',
            stand=stand,
            start_time=tobt - timedelta(minutes=5),
            gse_type='pushback_tug',
            priority=8,  # highest GSE priority
        )
```

---

## 6. Communication Architecture

### 6.1 Message Types

```python
# Vehicle → Dispatcher (every 1 second)
class VehicleStatus:
    vehicle_id: str
    position: (float, float, float)  # UTM easting, northing, heading
    velocity: float                   # m/s
    battery_soc: float               # 0.0 - 1.0
    current_task: Optional[TaskID]
    task_status: str                  # 'en_route', 'executing', 'complete', 'failed'
    planned_trajectory: List[Waypoint]  # next 10 seconds

# Dispatcher → Vehicle (on task assignment)
class TaskAssignment:
    task_id: str
    vehicle_id: str
    task_type: str                    # 'unload_cargo', 'refuel', etc.
    stand: str                        # 'B12'
    start_time: datetime
    deadline: datetime
    approach_waypoints: List[Waypoint]  # suggested route
    priority: int

# Vehicle → Vehicle (broadcast every 200ms via V2V)
class TrajectoryBroadcast:
    vehicle_id: str
    vehicle_type: str                 # for other vehicles to predict behavior
    planned_trajectory: List[Waypoint]  # next 5 seconds
    current_task: Optional[str]        # what I'm doing (for context)
```

### 6.2 Network Requirements

| Message | Rate | Payload | Latency Req | Protocol |
|---------|------|---------|-------------|----------|
| Vehicle status | 1 Hz | ~200 bytes | <500ms | 5G (URLLC) |
| Task assignment | Event | ~500 bytes | <1s | 5G (eMBB) |
| Trajectory broadcast | 5 Hz | ~1 KB | <100ms | C-V2X PC5 sidelink |
| Emergency stop | Event | ~50 bytes | <50ms | C-V2X PC5 + 5G |
| World model update | 5 Hz | ~10 KB | <200ms | 5G (eMBB) |

---

## 7. Scalability

### 7.1 Fleet Size Inflection Points

| Fleet Size | Key Change | Architecture Impact |
|-----------|-----------|-------------------|
| **1-5** | Individual vehicle management | Manual dispatch, no coordination needed |
| **5-10** | Basic coordination needed | Simple priority rules, greedy dispatch |
| **10-25** | Fleet optimization matters | Centralized dispatcher, VRPTW optimization |
| **25-50** | Communication overhead grows | 5G infrastructure required, V2V for local |
| **50-100** | Centralized bottleneck | Hybrid architecture (central + distributed) |
| **100+** | Full fleet operations | Hierarchical: zone controllers + central planner |

### 7.2 Changi's Scaling Plan

```
2024: 2 vehicles (manual coordination, single route)
2025: 4-8 vehicles (basic dispatcher, dedicated routes)
2026: 8-16 vehicles (fleet management system, shared routes)
2027: 24 vehicles (full VRPTW optimization, A-CDM integration)
```

---

## Sources

- IATA Airport Handling Manual (AHM), 46th Edition
- IATA Ground Operations Manual (IGOM), 14th Edition
- Consensus-Based Bundle Algorithm (CBBA): Choi et al., IEEE T-RO, 2009
- Multi-Agent RL for Traffic: Palanisamy, arXiv, 2020
- Moonware HALO architecture documentation
- UISEE TAM (Tractor Autonomous Management) system
- Changi Airport Group press releases
- EUROCONTROL A-CDM implementation guide
