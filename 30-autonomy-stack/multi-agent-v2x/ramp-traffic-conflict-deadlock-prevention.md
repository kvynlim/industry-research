# Ramp Traffic Conflict Detection and Deadlock Prevention for Autonomous GSE Fleets

> Graph-theoretic and real-time algorithmic approaches for detecting and resolving vehicle conflicts on constrained airport apron taxiway networks -- covering resource-allocation graph modeling, priority-based conflict resolution protocols, deadlock detection via cycle analysis, reservation-based traffic management, decentralized token and mutex approaches, pinch-point negotiation, capacity-constrained routing, right-of-way arbitration, livelock prevention, and integration with fleet dispatch and V2X messaging. This document addresses the fundamental coordination problem that arises when multiple autonomous GSE operate simultaneously in geometrically constrained apron environments where two vehicles cannot physically pass each other.
>
> **Relation to existing docs**: `fleet-task-allocation-scheduling.md` covers task assignment and sequencing (MILP, CP-SAT, CBBA). `v2x-protocols-airside.md` covers communication standards and message types. `30-autonomy-stack/planning/safety-critical-planning-cbf.md` covers per-vehicle collision avoidance. This document addresses the *system-level coordination layer* between dispatch (which assigns tasks) and per-vehicle planning (which avoids immediate collisions): ensuring that the fleet's collective motion plan is free of conflicts, deadlocks, and livelocks on the shared road network.
>
> **Key Takeaway**: Airport aprons have narrow service roads (3-6m, often single-lane), tight stand areas where multiple GSE must simultaneously serve one aircraft, and bottleneck intersections where deadlock is physically possible. Unlike open-road driving where vehicles can always find alternate paths, apron geometry creates genuine resource contention that CBF-level collision avoidance cannot resolve -- a vehicle that stops to avoid collision may block all other vehicles behind it, cascading into fleet-wide gridlock. The solution is a **three-layer traffic management architecture**: (1) offline capacity analysis and zone reservation graph built from the Lanelet2 map, (2) real-time centralized conflict detection and resolution via a lightweight graph coloring / mutex protocol running on the fleet manager at 1-10 Hz, and (3) decentralized vehicle-level yielding behavior via V2X negotiation as a fallback. Deadlock is prevented by construction through **wait-die** ordering on zone reservations, guaranteeing that no circular wait can form. The overhead is minimal: the conflict graph for a 50-vehicle fleet on a typical apron has <500 nodes and <2,000 edges, solvable in <10ms. **No competing airside autonomy platform publishes a deadlock prevention protocol** -- this is a critical safety and operational gap at fleet scale.

---

## Table of Contents

1. [Introduction: Why Ramp Traffic Is Hard](#1-introduction-why-ramp-traffic-is-hard)
2. [Apron Network Modeling](#2-apron-network-modeling)
3. [Conflict Detection](#3-conflict-detection)
4. [Deadlock Theory and Prevention](#4-deadlock-theory-and-prevention)
5. [Reservation-Based Traffic Management](#5-reservation-based-traffic-management)
6. [Priority-Based Conflict Resolution](#6-priority-based-conflict-resolution)
7. [Decentralized Negotiation via V2X](#7-decentralized-negotiation-via-v2x)
8. [Multi-Vehicle Stand Operations](#8-multi-vehicle-stand-operations)
9. [Capacity-Constrained Routing](#9-capacity-constrained-routing)
10. [Livelock Prevention](#10-livelock-prevention)
11. [Integration with Fleet Dispatch and Planning](#11-integration-with-fleet-dispatch-and-planning)
12. [Simulation and Testing](#12-simulation-and-testing)
13. [Industry Approaches](#13-industry-approaches)
14. [Implementation Roadmap](#14-implementation-roadmap)
15. [Key Takeaways](#15-key-takeaways)
16. [References](#16-references)

---

## 1. Introduction: Why Ramp Traffic Is Hard

### 1.1 The Coordination Gap

Existing autonomous GSE research addresses three layers of motion planning:

```
Layer 4: Fleet dispatch     — "Vehicle 3, go to Stand B12"     [fleet-task-allocation-scheduling.md]
Layer 3: Route planning     — "Take Taxilane A → Service Rd 7"  [THIS DOCUMENT - traffic coordination]
Layer 2: Trajectory planning — "Follow this path at 8 km/h"     [Frenet planner]
Layer 1: Safety layer       — "Don't hit anything"              [CBF, Simplex]
```

Layer 4 assigns tasks. Layer 2 generates smooth trajectories. Layer 1 prevents collisions reactively. What is missing is Layer 3: ensuring that the collective fleet routing plan is **feasible** — that vehicles won't deadlock, that bottlenecks don't cascade into gridlock, and that right-of-way is resolved before vehicles physically meet at a pinch point.

### 1.2 Why CBF Alone Is Insufficient

The CBF safety filter (from `safety-critical-planning-cbf.md`) guarantees pairwise collision avoidance: if two vehicles approach each other, at least one will slow/stop. But consider:

```
Single-lane service road:
                                
  Vehicle A ──>          <── Vehicle B
  ════════════════════════════════════
  
  CBF response: Both vehicles stop.
  Result: Neither can proceed. Deadlock.
  
  Required: One vehicle must YIELD BEFORE entering the single-lane segment.
```

CBF prevents crashes but creates deadlocks. A traffic management layer must prevent CBF from ever needing to intervene on network-level conflicts.

### 1.3 Apron Geometry Creates Real Contention

| Geometric Constraint | Typical Dimensions | Consequence |
|---|---|---|
| Service road width | 3-6m | Single-lane for GSE (vehicle width 2-3m) |
| Stand service area | 60m x 40m | 5-8 GSE must fit simultaneously |
| Taxilane intersections | T or cross | Only 1-2 vehicles can transit at once |
| Pinch points (parked aircraft) | 3-4m clearance | Single vehicle only, no passing |
| Fuel farm access | Single lane, 50-100m | Queue required, FIFO or priority |
| De-icing pad entry/exit | Single lane per side | Alternating flow |

### 1.4 Scale of the Problem

| Fleet Size | Concurrent Active | Expected Conflicts/Hour | Deadlock Risk |
|---|---|---|---|
| 5 vehicles | 3-4 | 2-5 | Low (manual resolution) |
| 20 vehicles | 12-16 | 15-40 | Medium (occasional gridlock) |
| 50 vehicles | 30-40 | 50-120 | High (systematic prevention required) |
| 100 vehicles | 60-80 | 150-300+ | Critical (automated management essential) |

At 50+ vehicles, manual traffic coordination is infeasible. Automated conflict detection and resolution becomes safety-critical infrastructure.

---

## 2. Apron Network Modeling

### 2.1 Zone Graph Construction

The apron is modeled as a **directed graph of zones**, where each zone represents a section of road that has a maximum vehicle capacity (typically 1 for narrow segments):

```python
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Set, Tuple, Optional
import networkx as nx

class ZoneType(Enum):
    TAXILANE = "taxilane"           # Wide taxiway segment (capacity 2-4)
    SERVICE_ROAD = "service_road"   # Narrow service road (capacity 1)
    STAND_AREA = "stand_area"       # Aircraft stand (capacity 5-8 GSE)
    INTERSECTION = "intersection"   # Junction (capacity 1-2)
    PINCH_POINT = "pinch_point"     # Narrow passage (capacity 1)
    CHARGING_AREA = "charging"      # Depot / charging station
    FUEL_FARM = "fuel_farm"         # Restricted access area
    DEICING_PAD = "deicing"         # De-icing area

@dataclass
class Zone:
    zone_id: str
    zone_type: ZoneType
    capacity: int                    # Max vehicles simultaneously
    length_m: float                  # Traversal length
    width_m: float                   # Physical width
    traversal_time_s: float          # Expected time to cross at nominal speed
    bidirectional: bool              # Can traffic flow both ways?
    lanelet_ids: List[int]           # Corresponding Lanelet2 lanelets
    
@dataclass
class ZoneEdge:
    from_zone: str
    to_zone: str
    weight: float                    # Traversal cost (time or distance)
    turn_type: str                   # "straight", "left", "right", "uturn"

def build_zone_graph_from_lanelet2(lanelet2_map) -> nx.DiGraph:
    """Build zone graph from Lanelet2 map.
    
    Strategy:
    1. Group lanelets into zones by physical connectivity and width
    2. Narrow segments (width < 5m) become capacity-1 zones
    3. Intersections become capacity-limited zones
    4. Stand areas become high-capacity zones
    5. Edges represent allowed transitions between zones
    """
    G = nx.DiGraph()
    
    for zone in extract_zones(lanelet2_map):
        G.add_node(zone.zone_id, **{
            'type': zone.zone_type,
            'capacity': zone.capacity,
            'length': zone.length_m,
            'traversal_time': zone.traversal_time_s,
            'bidirectional': zone.bidirectional,
        })
    
    for edge in extract_transitions(lanelet2_map):
        G.add_edge(edge.from_zone, edge.to_zone, weight=edge.weight)
    
    return G
```

### 2.2 Zone Capacity Assignment

```
Zone capacity rules:
                                    
  Road width < 4m:      capacity = 1  (single vehicle)
  Road width 4-6m:      capacity = 1  (single + margin, treat as 1)
  Road width 6-10m:     capacity = 2  (two vehicles can pass)
  Road width > 10m:     capacity = floor(width / 3.5)
  
  Intersections:        capacity = 1-2 (geometry dependent)
  Stand areas:          capacity = N_gse_types  (belt loader, fuel, catering, etc.)
  Charging stations:    capacity = N_chargers
  
  Bidirectional zones:  Effective capacity halved for throughput
  (two vehicles cannot pass in a single-lane bidirectional zone)
```

### 2.3 Typical Airport Apron Zone Graph

```
                     ┌─────────┐
                     │ Depot / │
                     │ Charging│
                     └────┬────┘
                          │
     ┌────────────────────┼────────────────────┐
     │                    │                    │
  ┌──▼──┐  ┌──────┐  ┌──▼──┐  ┌──────┐  ┌──▼──┐
  │ INT │──│ SR-1 │──│ INT │──│ SR-2 │──│ INT │  (Service Road)
  │  1  │  │ c=1  │  │  2  │  │ c=1  │  │  3  │
  └──┬──┘  └──────┘  └──┬──┘  └──────┘  └──┬──┘
     │                    │                    │
  ┌──▼──┐             ┌──▼──┐             ┌──▼──┐
  │Stand│             │Stand│             │Stand│
  │ B10 │             │ B11 │             │ B12 │
  │ c=6 │             │ c=6 │             │ c=6 │
  └─────┘             └─────┘             └─────┘
     
  c=1: Single vehicle only (conflict zone)
  c=6: Multiple GSE can operate simultaneously
  INT:  Intersection (c=1 or c=2)
  SR:   Service Road segment
```

### 2.4 Resource-Allocation Graph (RAG)

For deadlock analysis, model the system as a Resource-Allocation Graph (Holt 1972):

```
Nodes:
  - Vehicle nodes: V1, V2, ..., Vn
  - Zone nodes: Z1, Z2, ..., Zm
  
Edges:
  - Assignment edge (Zi → Vj):  Vehicle j currently occupies zone i
  - Request edge (Vj → Zi):     Vehicle j needs to enter zone i next
  
Deadlock condition:
  A cycle in the RAG indicates deadlock.
  
Example deadlock:
  V1 occupies Z_A, requests Z_B
  V2 occupies Z_B, requests Z_A
  
  RAG: Z_A → V1 → Z_B → V2 → Z_A  (cycle!)
```

---

## 3. Conflict Detection

### 3.1 Conflict Types

| Type | Description | Severity | Detection |
|---|---|---|---|
| **Head-on** | Two vehicles approaching each other on single-lane | Critical | Route intersection on capacity-1 zone |
| **Merge** | Two vehicles entering same capacity-1 zone simultaneously | High | Temporal overlap on zone reservation |
| **Crossing** | Paths cross at intersection | Medium | Time overlap at shared intersection |
| **Tailgating** | Following vehicle faster than leading in same zone | Low | Speed differential + zone occupancy |
| **Stand congestion** | Too many GSE at one stand | Medium | Stand capacity exceeded |
| **Queue overflow** | Waiting vehicles block upstream zones | High | Chain analysis on zone graph |

### 3.2 Conflict Detection Algorithm

```python
from typing import NamedTuple
import heapq

class VehiclePlan(NamedTuple):
    vehicle_id: str
    zone_sequence: List[str]         # Planned zone traversal order
    entry_times: List[float]         # Expected entry time per zone
    exit_times: List[float]          # Expected exit time per zone

class Conflict(NamedTuple):
    type: str                        # "head_on", "merge", "crossing", etc.
    zone_id: str
    vehicles: Tuple[str, str]
    time_window: Tuple[float, float]
    severity: str                    # "critical", "high", "medium", "low"

def detect_conflicts(
    plans: List[VehiclePlan],
    zone_graph: nx.DiGraph,
) -> List[Conflict]:
    """Detect all conflicts between vehicle plans.
    
    Algorithm: For each zone, check temporal overlap of all vehicles
    that plan to use that zone. If overlap count > zone capacity,
    it's a conflict.
    
    Complexity: O(V * Z) where V = vehicles, Z = zones in plans
    """
    conflicts = []
    
    # Build zone occupancy timeline
    zone_reservations: Dict[str, List[Tuple[float, float, str]]] = {}
    
    for plan in plans:
        for i, zone_id in enumerate(plan.zone_sequence):
            entry = plan.entry_times[i]
            exit = plan.exit_times[i]
            if zone_id not in zone_reservations:
                zone_reservations[zone_id] = []
            zone_reservations[zone_id].append((entry, exit, plan.vehicle_id))
    
    # Check each zone for capacity violations
    for zone_id, reservations in zone_reservations.items():
        capacity = zone_graph.nodes[zone_id].get('capacity', 1)
        reservations.sort(key=lambda r: r[0])  # Sort by entry time
        
        # Sweep line to find max overlap
        for i, (entry_i, exit_i, vid_i) in enumerate(reservations):
            concurrent = 1
            for j in range(i + 1, len(reservations)):
                entry_j, exit_j, vid_j = reservations[j]
                if entry_j < exit_i:  # Overlap
                    concurrent += 1
                    if concurrent > capacity:
                        # Determine conflict type
                        ctype = classify_conflict(
                            zone_id, vid_i, vid_j, 
                            zone_graph, plans
                        )
                        conflicts.append(Conflict(
                            type=ctype,
                            zone_id=zone_id,
                            vehicles=(vid_i, vid_j),
                            time_window=(max(entry_i, entry_j), 
                                        min(exit_i, exit_j)),
                            severity="critical" if ctype == "head_on" else "high"
                        ))
                else:
                    break  # No more overlaps possible (sorted)
    
    return conflicts

def classify_conflict(zone_id, vid_a, vid_b, graph, plans):
    """Classify conflict type based on vehicle directions."""
    dir_a = get_traversal_direction(vid_a, zone_id, plans)
    dir_b = get_traversal_direction(vid_b, zone_id, plans)
    
    if are_opposing(dir_a, dir_b):
        return "head_on"
    elif graph.nodes[zone_id].get('type') == ZoneType.INTERSECTION:
        return "crossing"
    else:
        return "merge"
```

### 3.3 Temporal Complexity

| Fleet Size | Zones | Reservations | Detection Time |
|---|---|---|---|
| 10 | ~50 | ~200 | <1ms |
| 20 | ~100 | ~600 | <2ms |
| 50 | ~200 | ~2,000 | <5ms |
| 100 | ~500 | ~5,000 | <15ms |

Detection runs at fleet manager frequency (1-10 Hz), well within budget.

---

## 4. Deadlock Theory and Prevention

### 4.1 Coffman's Four Conditions

Deadlock requires ALL four conditions simultaneously (Coffman et al. 1971):

| Condition | In Apron Context | Prevention Strategy |
|---|---|---|
| **Mutual exclusion** | Zone capacity = 1 for narrow roads | Cannot remove (physical constraint) |
| **Hold and wait** | Vehicle holds current zone while waiting for next | **Break this**: require all zones reserved before moving |
| **No preemption** | Vehicle cannot be forced out of a zone | Partially break: priority-based preemption for higher-priority vehicles |
| **Circular wait** | V1 waits for V2 waits for V1 | **Break this**: total ordering on zone acquisition (wait-die protocol) |

**Primary strategy**: Break "circular wait" via total ordering. Secondary: break "hold and wait" via reservation protocol.

### 4.2 Wait-Die Protocol for Zone Acquisition

Adapted from database deadlock prevention (Rosenkrantz et al. 1978):

```python
class WaitDieProtocol:
    """Deadlock prevention via wait-die ordering.
    
    Each vehicle has a priority (timestamp-based: older = higher priority).
    When vehicle V requests zone Z held by vehicle U:
    - If priority(V) > priority(U): V WAITS (older waits for younger)
    - If priority(V) < priority(U): V DIES (younger yields — re-routes or waits at safe zone)
    
    This guarantees no circular wait because the wait-for graph is acyclic
    (all waits go from higher to lower priority, never forming a cycle).
    """
    
    def __init__(self):
        self.zone_holders: Dict[str, str] = {}      # zone_id -> vehicle_id
        self.vehicle_priority: Dict[str, float] = {} # vehicle_id -> timestamp (lower = older = higher priority)
    
    def assign_priority(self, vehicle_id: str, mission_start_time: float):
        """Assign priority based on mission start time. Older missions have higher priority."""
        self.vehicle_priority[vehicle_id] = mission_start_time
    
    def request_zone(self, requester: str, zone_id: str) -> str:
        """Process zone request. Returns 'granted', 'wait', or 'die'."""
        if zone_id not in self.zone_holders:
            self.zone_holders[zone_id] = requester
            return "granted"
        
        holder = self.zone_holders[zone_id]
        if holder == requester:
            return "granted"  # Already holds it
        
        req_priority = self.vehicle_priority[requester]
        hold_priority = self.vehicle_priority[holder]
        
        if req_priority < hold_priority:
            # Requester is older (higher priority) → WAIT
            return "wait"
        else:
            # Requester is younger (lower priority) → DIE (yield)
            return "die"
    
    def release_zone(self, vehicle_id: str, zone_id: str):
        """Release zone when vehicle exits."""
        if self.zone_holders.get(zone_id) == vehicle_id:
            del self.zone_holders[zone_id]
```

### 4.3 Cycle Detection for Runtime Verification

Even with prevention, runtime cycle detection provides defense-in-depth:

```python
def detect_deadlock(wait_for_graph: Dict[str, Set[str]]) -> List[List[str]]:
    """Detect cycles in wait-for graph using DFS.
    
    wait_for_graph: {vehicle_id: set of vehicle_ids it's waiting for}
    Returns: List of cycles (each cycle is a list of vehicle IDs)
    
    Complexity: O(V + E) where V = vehicles, E = wait-for edges
    """
    visited = set()
    rec_stack = set()
    cycles = []
    
    def dfs(node, path):
        visited.add(node)
        rec_stack.add(node)
        path.append(node)
        
        for neighbor in wait_for_graph.get(node, set()):
            if neighbor not in visited:
                dfs(neighbor, path)
            elif neighbor in rec_stack:
                # Found a cycle
                cycle_start = path.index(neighbor)
                cycles.append(path[cycle_start:] + [neighbor])
        
        path.pop()
        rec_stack.discard(node)
    
    for vehicle in wait_for_graph:
        if vehicle not in visited:
            dfs(vehicle, [])
    
    return cycles
```

### 4.4 Deadlock Recovery (When Prevention Fails)

If deadlock is detected despite prevention (e.g., due to timing race conditions):

| Recovery Strategy | Mechanism | Cost | When to Use |
|---|---|---|---|
| **Victim selection** | Lowest-priority vehicle reverses to nearest siding | Delay for 1 vehicle | Simple 2-vehicle deadlock |
| **Coordinated retreat** | Multiple vehicles back up in priority order | Delay for N vehicles | Multi-vehicle deadlock |
| **Teleop intervention** | Operator manually repositions stuck vehicle | Human time + delay | Complex situations |
| **Fleet pause** | All vehicles stop, re-plan from scratch | Fleet-wide delay | Last resort only |

```python
def resolve_deadlock(cycle: List[str], fleet_state: dict) -> List[dict]:
    """Resolve detected deadlock by selecting victim and generating recovery plan.
    
    Strategy: Select lowest-priority vehicle in cycle. Command it to reverse
    to nearest safe zone (pull-off / siding / stand entry).
    """
    # Find lowest-priority vehicle in cycle
    victim = max(cycle[:-1], key=lambda v: fleet_state[v]['priority'])  # highest timestamp = lowest priority
    
    # Find nearest safe zone behind victim
    current_zone = fleet_state[victim]['current_zone']
    safe_zone = find_nearest_pulloff(current_zone, fleet_state[victim]['path_history'])
    
    return [{
        'vehicle': victim,
        'action': 'reverse_to',
        'target_zone': safe_zone,
        'reason': f'deadlock_resolution_cycle_{len(cycle)-1}_vehicles'
    }]
```

---

## 5. Reservation-Based Traffic Management

### 5.1 Zone Reservation Protocol

Vehicles must reserve zones before entering. This is the primary mechanism for preventing conflicts:

```python
import time
from threading import Lock
from collections import defaultdict

class ZoneReservationManager:
    """Centralized zone reservation manager running on fleet server.
    
    Protocol:
    1. Vehicle requests reservation for next N zones in its path
    2. Manager checks capacity and conflict with existing reservations
    3. If feasible: GRANT and record reservation
    4. If conflict: DENY with wait estimate and alternative suggestion
    5. Vehicle may not enter a zone without valid reservation
    """
    
    def __init__(self, zone_graph: nx.DiGraph):
        self.zone_graph = zone_graph
        self.reservations: Dict[str, List[dict]] = defaultdict(list)  # zone -> [{vehicle, entry, exit}]
        self.lock = Lock()
        self.wait_die = WaitDieProtocol()
    
    def request_reservation(
        self,
        vehicle_id: str,
        zone_sequence: List[str],
        entry_times: List[float],
        exit_times: List[float],
    ) -> dict:
        """Request reservation for a sequence of zones.
        
        Returns:
            {
                'status': 'granted' | 'partial' | 'denied',
                'granted_zones': [...],
                'denied_zones': [...],
                'wait_estimate_s': float,
                'alternative_route': [...] or None,
            }
        """
        with self.lock:
            granted = []
            denied = []
            
            for i, zone_id in enumerate(zone_sequence):
                capacity = self.zone_graph.nodes[zone_id].get('capacity', 1)
                entry_t = entry_times[i]
                exit_t = exit_times[i]
                
                # Count overlapping reservations at this time
                overlap_count = sum(
                    1 for r in self.reservations[zone_id]
                    if r['entry'] < exit_t and r['exit'] > entry_t
                    and r['vehicle'] != vehicle_id
                )
                
                if overlap_count < capacity:
                    # Zone has capacity — grant
                    self.reservations[zone_id].append({
                        'vehicle': vehicle_id,
                        'entry': entry_t,
                        'exit': exit_t,
                    })
                    granted.append(zone_id)
                else:
                    # Zone at capacity — apply wait-die
                    decision = self.wait_die.request_zone(vehicle_id, zone_id)
                    denied.append({
                        'zone': zone_id,
                        'decision': decision,
                        'available_at': self._earliest_available(zone_id, entry_t),
                    })
                    break  # Cannot reserve zones beyond first denial
            
            status = 'granted' if not denied else ('partial' if granted else 'denied')
            
            return {
                'status': status,
                'granted_zones': granted,
                'denied_zones': denied,
                'wait_estimate_s': denied[0]['available_at'] - time.time() if denied else 0,
                'alternative_route': self._find_alternative(
                    vehicle_id, zone_sequence[len(granted):], entry_times[len(granted):]
                ) if denied else None,
            }
    
    def _earliest_available(self, zone_id: str, after_time: float) -> float:
        """Find earliest time zone becomes available after given time."""
        relevant = [r for r in self.reservations[zone_id] if r['exit'] > after_time]
        if not relevant:
            return after_time
        return min(r['exit'] for r in relevant)
    
    def _find_alternative(self, vehicle_id, remaining_zones, remaining_times):
        """Find alternative route avoiding denied zones."""
        if not remaining_zones:
            return None
        start = remaining_zones[0]
        end = remaining_zones[-1]
        # Dijkstra avoiding occupied zones
        return find_route_avoiding(self.zone_graph, start, end, 
                                   blocked=set(remaining_zones))
```

### 5.2 Reservation Lookahead

How many zones ahead should a vehicle reserve?

| Lookahead | Pros | Cons | Recommended For |
|---|---|---|---|
| 1 zone | Minimal blocking | Frequent re-requests | Low-conflict areas |
| 3-5 zones | Balances throughput/blocking | Moderate over-reservation | Service roads |
| Full path | No mid-route denials | Blocks zones unnecessarily long | Short paths, stand approaches |
| Adaptive | Best of both worlds | More complex | Production deployment |

**Recommended**: Adaptive lookahead based on zone type. Reserve 1 zone ahead on wide taxilanes, 3-5 on service roads, full path for stand approach sequences.

### 5.3 Reservation Timeout

Reservations must expire to prevent resource hoarding:

```
Reservation lifetime = estimated_traversal_time × safety_factor + buffer

Where:
  safety_factor = 1.5 (accounts for speed variation)
  buffer = 5s (accounts for minor delays)
  
If vehicle does not enter zone within lifetime:
  → Reservation automatically released
  → Vehicle must re-request
  → Fleet manager notified (potential vehicle issue)
```

---

## 6. Priority-Based Conflict Resolution

### 6.1 Priority Hierarchy

From `v2x-protocols-airside.md` and `70-operations-domains/airside/operations/ground-control-instructions.md`, the right-of-way hierarchy:

```
Priority Level (highest first):
                                    
  9. EMERGENCY vehicle (fire, medical)         — Always yields to
  8. Aircraft under tow (pushback in progress) — Cannot stop easily
  7. Aircraft taxiing (rare on apron)           — Absolute right-of-way
  6. Fueling vehicle (hazardous cargo)          — Safety priority
  5. De-icing vehicle (time-critical)           — Operational urgency
  4. Belt loader (aircraft departure critical)   — Turnaround SLA
  3. Catering / cleaning vehicle                 — Turnaround sequence
  2. Baggage tug (flexible timing)              — Can wait
  1. Empty repositioning (no cargo)             — Lowest priority
  0. Returning to depot / charging              — Yields to all
```

### 6.2 Conflict Resolution Rules

```python
class ConflictResolver:
    """Resolve conflicts using priority hierarchy and situation-specific rules."""
    
    PRIORITY_MAP = {
        'emergency': 9,
        'pushback': 8,
        'aircraft_tow': 7,
        'fueling': 6,
        'deicing': 5,
        'belt_loader': 4,
        'catering': 3,
        'baggage': 2,
        'repositioning': 1,
        'depot_return': 0,
    }
    
    def resolve(self, conflict: Conflict, fleet_state: dict) -> dict:
        """Determine which vehicle yields in a conflict.
        
        Rules:
        1. Higher priority always wins
        2. Equal priority: vehicle closer to destination wins
        3. Equal priority + equal distance: older mission wins (wait-die)
        4. Emergency always preempts (others must pull off)
        """
        v_a, v_b = conflict.vehicles
        p_a = self.PRIORITY_MAP.get(fleet_state[v_a]['task_type'], 1)
        p_b = self.PRIORITY_MAP.get(fleet_state[v_b]['task_type'], 1)
        
        if p_a != p_b:
            yielder = v_a if p_a < p_b else v_b
            return {'yielder': yielder, 'reason': 'priority', 'action': 'wait_or_reroute'}
        
        # Equal priority — closer to destination wins
        dist_a = fleet_state[v_a]['distance_to_destination']
        dist_b = fleet_state[v_b]['distance_to_destination']
        
        if abs(dist_a - dist_b) > 20:  # >20m difference is significant
            yielder = v_a if dist_a > dist_b else v_b
            return {'yielder': yielder, 'reason': 'distance', 'action': 'wait_or_reroute'}
        
        # Nearly equal — fall back to wait-die
        yielder = v_a if fleet_state[v_a]['mission_start'] > fleet_state[v_b]['mission_start'] else v_b
        return {'yielder': yielder, 'reason': 'wait_die', 'action': 'die_reroute'}
```

### 6.3 Yielding Behavior

When a vehicle must yield, it needs a physical location to wait:

```
Yield locations (in order of preference):
1. Pull-off / siding zone (designed passing area)
2. Wide section of current zone (if capacity > 1)
3. Previous zone (reverse if safe)
4. Stand area (if accessible and not blocking)
5. Stop in current zone and wait (last resort — blocks behind)

Fleet manager must know all available yield points.
Yield points are annotated in Lanelet2 map with regulatory elements.
```

---

## 7. Decentralized Negotiation via V2X

### 7.1 When Centralized Fails

The centralized reservation manager is the primary system, but decentralized V2X negotiation provides fallback:

| Scenario | Why Centralized Fails | V2X Fallback |
|---|---|---|
| Network outage | Cannot reach fleet server | Direct V2V negotiation |
| Server overload | Reservation latency too high | Local mutual exclusion |
| Rapid re-planning | Centralized too slow for dynamic events | Distributed token passing |
| Mixed fleet | Non-reference airside vehicles don't use server | V2X interoperability |

### 7.2 V2X Conflict Negotiation Protocol

Using message types from `v2x-protocols-airside.md`:

```
Negotiation sequence for head-on conflict:

  Vehicle A                                      Vehicle B
     │                                               │
     │──── MCM (zone_request, Z5, priority=4) ──────>│
     │                                               │
     │<──── MCM (zone_request, Z5, priority=2) ──────│
     │                                               │
     │  Both see conflict: A has higher priority      │
     │                                               │
     │──── MCM (zone_claim, Z5, proceed) ────────────>│
     │                                               │
     │<──── MCM (zone_yield, Z5, waiting) ───────────│
     │                                               │
     │  A proceeds through Z5                        │
     │  B waits at zone boundary                     │
     │                                               │
     │──── MCM (zone_release, Z5) ───────────────────>│
     │                                               │
     │  B proceeds                                   │

Total negotiation time: 2-3 message rounds = 40-60ms on 5G
```

### 7.3 Token-Based Mutex for Single-Lane Segments

For persistent single-lane zones (e.g., 100m fuel farm access road):

```python
class TokenMutex:
    """Distributed token-based mutual exclusion for single-lane zones.
    
    A virtual token controls access. Only the token holder may enter.
    Token passed via V2X messages. If token lost (network issue),
    timeout triggers token regeneration.
    """
    
    def __init__(self, zone_id: str, initial_holder: Optional[str] = None):
        self.zone_id = zone_id
        self.token_holder = initial_holder  # None = token at zone entry point
        self.token_version = 0              # Monotonic, prevents stale tokens
        self.request_queue: List[str] = []  # FIFO queue of requesters
        self.token_timeout_s = 60.0         # Max time to hold token
        self.last_grant_time = 0.0
    
    def request_token(self, vehicle_id: str) -> str:
        """Request the zone token. Returns 'granted', 'queued', or 'wait'."""
        if self.token_holder is None:
            self.token_holder = vehicle_id
            self.token_version += 1
            self.last_grant_time = time.time()
            return "granted"
        
        if self.token_holder == vehicle_id:
            return "granted"
        
        # Check for timeout (token holder stuck or crashed)
        if time.time() - self.last_grant_time > self.token_timeout_s:
            # Reclaim token
            self.token_holder = vehicle_id
            self.token_version += 1
            self.last_grant_time = time.time()
            return "granted"
        
        if vehicle_id not in self.request_queue:
            self.request_queue.append(vehicle_id)
        
        return "queued"
    
    def release_token(self, vehicle_id: str):
        """Release token after exiting zone."""
        if self.token_holder == vehicle_id:
            if self.request_queue:
                self.token_holder = self.request_queue.pop(0)
                self.token_version += 1
                self.last_grant_time = time.time()
            else:
                self.token_holder = None
```

---

## 8. Multi-Vehicle Stand Operations

### 8.1 The Stand Coordination Problem

Aircraft turnaround requires 5-8 GSE types operating simultaneously in a ~60x40m area:

```
Aircraft stand layout (not to scale):
                                    
         ┌──────────────────────────────────────────┐
         │              AIRCRAFT                     │
         │  ┌─────────────────────────────────────┐  │
         │  │            Fuselage                  │  │
         │  └─────────────────────────────────────┘  │
         │     ▲ Belt   ▲ Catering  ▲ Fuel    ▲ Lav │
         │     │ Loader │ Truck     │ Truck   │ Cart│
         │     │        │           │         │     │
         └──── Access Lane (single-lane, 3-4m) ────┘
                        │
              ┌─────────▼──────────┐
              │  Service Road       │
              │  (bidirectional)    │
              └─────────────────────┘

Constraints:
- Access lane: single file, must sequence entries
- Belt loader: positions first (under cargo door)
- Fuel truck: positions near wing (fire safety clearance)
- Catering: cannot position until doors open
- Sequence is partially ordered by turnaround SOP
```

### 8.2 Stand Access Sequencing

```python
class StandAccessController:
    """Manage GSE sequencing for aircraft stand operations.
    
    Turnaround sequence defines partial order:
    1. Chocks + cones (manual, before any GSE)
    2. Belt loader + GPU (power)
    3. Fuel truck (after passengers deplaned for safety)
    4. Catering + cleaning + lavatory (parallel, after doors open)
    5. Baggage loading (after cargo offloaded)
    6. Pushback tug (last, after all other GSE clear)
    """
    
    TURNAROUND_SEQUENCE = {
        'belt_loader': {'order': 1, 'position': 'cargo_door', 'clearance': 'wing'},
        'gpu': {'order': 1, 'position': 'gpu_point', 'clearance': 'engine'},
        'fuel_truck': {'order': 2, 'position': 'fuel_point', 'clearance': 'wing_tip'},
        'catering_high': {'order': 3, 'position': 'fwd_door', 'clearance': 'fuselage'},
        'catering_low': {'order': 3, 'position': 'aft_door', 'clearance': 'fuselage'},
        'cleaning': {'order': 3, 'position': 'fwd_door', 'clearance': 'fuselage'},
        'lavatory': {'order': 3, 'position': 'lav_panel', 'clearance': 'fuselage'},
        'water': {'order': 3, 'position': 'water_panel', 'clearance': 'fuselage'},
        'baggage_load': {'order': 4, 'position': 'cargo_door', 'clearance': 'wing'},
        'pushback': {'order': 5, 'position': 'nose_gear', 'clearance': 'all'},
    }
    
    def get_access_order(self, stand_id: str, queued_vehicles: List[dict]) -> List[str]:
        """Determine access order for vehicles waiting to enter stand.
        
        Priority: turnaround sequence order > arrival time (FIFO within same order)
        """
        sorted_vehicles = sorted(queued_vehicles, key=lambda v: (
            self.TURNAROUND_SEQUENCE.get(v['task_type'], {}).get('order', 99),
            v['arrival_time']
        ))
        return [v['vehicle_id'] for v in sorted_vehicles]
```

### 8.3 Stand Entry/Exit Protocol

```
Stand entry protocol:
1. Vehicle arrives at stand access point (5-10m from stand boundary)
2. Requests stand entry from Stand Access Controller
3. Controller checks:
   a. Is the vehicle's turn in sequence? (turnaround order)
   b. Is the target position free? (spatial occupancy)
   c. Is the access lane clear? (no exiting vehicles)
4. If all clear: GRANT entry, vehicle proceeds to dock position
5. If not: HOLD at access point, wait for next opening

Stand exit protocol:
1. Vehicle completes task (undocked from aircraft)
2. Requests exit clearance
3. Controller checks access lane is clear (no entering vehicles)
4. GRANT exit, vehicle proceeds out via access lane
5. Controller notifies next vehicle in sequence

Access lane is ONE-WAY at any given time:
- Entering mode: all entries until a vehicle needs to exit
- Exiting mode: all exits until lane is clear, then switch to entering
- Never simultaneous entry + exit (lane too narrow)
```

---

## 9. Capacity-Constrained Routing

### 9.1 Traffic-Aware Route Planning

Standard shortest-path routing ignores zone occupancy. Traffic-aware routing avoids congested zones:

```python
def traffic_aware_route(
    zone_graph: nx.DiGraph,
    start: str,
    end: str,
    current_reservations: Dict[str, int],  # zone -> current occupancy
    vehicle_priority: int,
) -> List[str]:
    """Find route that avoids congested zones.
    
    Edge weights modified by current and predicted occupancy:
    weight = base_weight × congestion_factor
    
    congestion_factor:
      occupancy/capacity < 0.5:  1.0  (no penalty)
      occupancy/capacity 0.5-0.8: 1.5  (mild avoidance)
      occupancy/capacity 0.8-1.0: 3.0  (strong avoidance)
      occupancy/capacity >= 1.0:  10.0 (near-blocked, avoid if possible)
      zone reserved by higher-priority: inf (cannot enter)
    """
    G_weighted = zone_graph.copy()
    
    for zone_id in G_weighted.nodes():
        capacity = G_weighted.nodes[zone_id].get('capacity', 1)
        occupancy = current_reservations.get(zone_id, 0)
        ratio = occupancy / capacity if capacity > 0 else 1.0
        
        if ratio < 0.5:
            factor = 1.0
        elif ratio < 0.8:
            factor = 1.5
        elif ratio < 1.0:
            factor = 3.0
        else:
            factor = 10.0
        
        # Apply congestion factor to all outgoing edges
        for _, neighbor in G_weighted.out_edges(zone_id):
            G_weighted[zone_id][neighbor]['weight'] *= factor
    
    try:
        path = nx.dijkstra_path(G_weighted, start, end, weight='weight')
        return path
    except nx.NetworkXNoPath:
        return []  # No route available
```

### 9.2 One-Way Flow Control

Some apron segments benefit from temporary one-way designation during peak operations:

```
Peak hour flow control:
                                    
  Normal (bidirectional):
  ←──────── Service Road ──────────→
  
  Peak (one-way loop):
  ────────→ Service Road North ────────→
                    │                    │
                    ▼                    ▼
  ←──────── Service Road South ←────────
  
  Trigger: >70% capacity on bidirectional segments for >5 minutes
  Duration: Maintain one-way until <40% capacity (hysteresis prevents flapping)
  Communication: Fleet manager broadcasts flow direction via V2X DZN-like message
```

---

## 10. Livelock Prevention

### 10.1 What Is Livelock?

Deadlock: vehicles are stuck and cannot move.
Livelock: vehicles are actively re-routing but never making progress.

```
Livelock example:

  V1: Route A→B→C. Denied at B (V2 has reservation). Re-routes A→D→C.
  V2: Route D→B→E. Denied at D (V1 re-routed there). Re-routes D→A→E.
  V1: Now denied at D (V2 re-routed there). Re-routes back to A→B→C.
  ... (infinite loop of re-routing)
```

### 10.2 Livelock Detection

```python
class LivelockDetector:
    """Detect livelock by monitoring re-routing frequency."""
    
    def __init__(self, max_reroutes: int = 3, window_s: float = 30.0):
        self.reroute_history: Dict[str, List[float]] = defaultdict(list)
        self.max_reroutes = max_reroutes
        self.window_s = window_s
    
    def record_reroute(self, vehicle_id: str, timestamp: float):
        """Record that a vehicle was re-routed."""
        history = self.reroute_history[vehicle_id]
        # Remove old entries
        history[:] = [t for t in history if timestamp - t < self.window_s]
        history.append(timestamp)
        
        if len(history) >= self.max_reroutes:
            return True  # Livelock suspected
        return False
```

### 10.3 Livelock Resolution

When livelock is detected:

1. **Escalate to centralized resolution**: Fleet manager assigns definitive reservations to all involved vehicles simultaneously (global optimal, not greedy per-vehicle).
2. **Introduce randomized backoff**: Livelock-suspected vehicles wait a random 2-10s before re-requesting, breaking symmetry.
3. **Priority boost for starved vehicles**: A vehicle that has been re-routed 3+ times gets a temporary priority boost, ensuring it eventually progresses.

---

## 11. Integration with Fleet Dispatch and Planning

### 11.1 Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    FLEET MANAGER                          │
│                                                          │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐  │
│  │ Task         │  │ Traffic       │  │ Vehicle      │  │
│  │ Scheduler    │──│ Manager       │──│ Monitor      │  │
│  │ (CP-SAT)     │  │ (Reservations │  │ (Telemetry)  │  │
│  │              │  │  Conflicts    │  │              │  │
│  │              │  │  Deadlock)    │  │              │  │
│  └──────┬───────┘  └───────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│         ▼                  ▼                  ▼          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │            Fleet Communication Layer                │ │
│  │            (5G / V2X / MQTT)                       │ │
│  └──────────────────────────┬──────────────────────────┘ │
└─────────────────────────────┼────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
     ┌────▼────┐         ┌───▼────┐         ┌───▼────┐
     │Vehicle 1│         │Vehicle 2│         │Vehicle N│
     │         │         │         │         │         │
     │ Route   │         │ Route   │         │ Route   │
     │ Planner │         │ Planner │         │ Planner │
     │ Frenet  │         │ Frenet  │         │ Frenet  │
     │ CBF     │         │ CBF     │         │ CBF     │
     └─────────┘         └────────┘         └─────────┘
```

### 11.2 Dispatch-Traffic Integration

The task scheduler should be traffic-aware:

```
Before dispatching task to vehicle:
1. Generate candidate route (Dijkstra on zone graph)
2. Check route feasibility (conflict detection)
3. If conflicts: try alternative routes or alternative vehicles
4. If no conflict-free option: delay task or queue

This prevents the scheduler from creating impossible plans.
Without traffic integration, scheduler assigns tasks that create
guaranteed conflicts, wasting vehicle time on re-routing.
```

### 11.3 ROS Integration

```python
# Traffic manager as ROS node

class TrafficManagerNode:
    """ROS node for traffic management on fleet server."""
    
    def __init__(self):
        rospy.init_node('traffic_manager')
        
        # Subscribe to vehicle positions and plans
        rospy.Subscriber('/fleet/vehicle_states', FleetState, self.on_fleet_state)
        
        # Service for zone reservation requests
        rospy.Service('/traffic/request_reservation', 
                      ReservationRequest, self.handle_reservation)
        
        # Publish traffic commands
        self.cmd_pub = rospy.Publisher('/traffic/commands', 
                                       TrafficCommand, queue_size=10)
        
        # Publish zone occupancy for visualization
        self.occ_pub = rospy.Publisher('/traffic/zone_occupancy',
                                       ZoneOccupancy, queue_size=1)
        
        # Timer for periodic conflict check (10 Hz)
        rospy.Timer(rospy.Duration(0.1), self.check_conflicts)
    
    def check_conflicts(self, event):
        """Periodic conflict detection and resolution."""
        conflicts = detect_conflicts(self.current_plans, self.zone_graph)
        
        for conflict in conflicts:
            resolution = self.resolver.resolve(conflict, self.fleet_state)
            self.cmd_pub.publish(TrafficCommand(
                vehicle_id=resolution['yielder'],
                action=resolution['action'],
                zone_id=conflict.zone_id,
                reason=resolution['reason'],
            ))
```

---

## 12. Simulation and Testing

### 12.1 Stress Testing Protocol

| Test | Scenario | Pass Criteria |
|---|---|---|
| 2-vehicle head-on | Both approach single-lane from opposite ends | One yields, no deadlock, resolved in <5s |
| 4-vehicle intersection | All approach 4-way from different directions | Sequential passage, no deadlock |
| Stand turnaround | 6 GSE sequence into one stand | Correct sequence, no access lane conflict |
| Fleet stress | 50 vehicles, 100 tasks, 30 min | Zero deadlocks, <5% time lost to conflicts |
| Network failure | Fleet server unreachable for 60s | V2X fallback, no collisions, no deadlocks |
| Priority preemption | Emergency vehicle enters congested area | Emergency clears in <15s |
| Livelock trigger | 3 vehicles, cyclic re-routing scenario | Livelock detected and resolved in <30s |

### 12.2 Metrics

| Metric | Target | Measurement |
|---|---|---|
| Deadlock rate | 0 per 1000 vehicle-hours | Count deadlock recovery events |
| Conflict resolution time | <5s for 95th percentile | Time from detection to resolution |
| Throughput loss from traffic management | <10% vs unconstrained | Compare task completion rate |
| Reservation denial rate | <15% of requests | Count denials / total requests |
| V2X fallback activation | <1% of operating time | Time in decentralized mode |
| Queue length at bottlenecks | <3 vehicles for 95th percentile | Monitor zone queues |

---

## 13. Industry Approaches

### 13.1 Automated Guided Vehicles (AGV) in Warehouses

The closest solved problem to airport ramp traffic is AGV coordination in warehouses:

| System | Approach | Scale | Relevance |
|---|---|---|---|
| **Amazon Kiva/Sparrow** | Grid-based, reservation tiles | 1000s of robots | Full reservation model, but grid-only |
| **Locus Robotics** | Zone reservation + priority lanes | 100s of robots | Priority-based conflict resolution |
| **Geek+** | MAPF (Multi-Agent Path Finding) | 500+ robots | CBS (Conflict-Based Search) for optimal multi-agent routing |
| **AutoStore** | Grid-only, no passing | 100s of robots | Token-based exclusive access |

### 13.2 Multi-Agent Path Finding (MAPF) Literature

| Algorithm | Optimality | Complexity | Practical Limit | Airside Relevance |
|---|---|---|---|---|
| **CBS (Sharon 2015)** | Optimal | Exponential worst-case | ~50 agents | Usable for shift planning |
| **ECBS (Barer 2014)** | Bounded suboptimal | Polynomial (w-bounded) | ~200 agents | Good for real-time |
| **PBS (Ma 2019)** | Incomplete | Fast polynomial | ~1000 agents | Suitable for reactive |
| **PIBT (Okumura 2022)** | Incomplete, anytime | O(V) per step | 10,000+ agents | Best for real-time, limited optimality |
| **LaCAM* (Okumura 2023)** | Near-optimal | Fast | 10,000+ agents | State-of-the-art scalable MAPF |

**Recommendation**: Use CBS/ECBS for offline shift-level path planning. Use PIBT or reservation-based protocol for real-time conflict resolution.

### 13.3 Airport Ground Movement (Aircraft)

Aircraft ground movement at busy airports faces similar problems:

- **A-SMGCS Level 4**: Automated routing and guidance for aircraft on taxiways. Uses reservation-based conflict detection similar to what's described here. Deployed at CDG, AMS, ZRH.
- **EUROCONTROL SWIM**: System-Wide Information Management — shares routing plans between ATC and aircraft. Could be extended to include GSE in the future.

**Key insight**: A-SMGCS proves that reservation-based traffic management works for surface operations. The GSE version operates at finer granularity (more vehicles, tighter spaces) but lower speeds (5-25 km/h vs 10-40 km/h for aircraft taxiing).

---

## 14. Implementation Roadmap

### 14.1 Phased Approach

| Phase | Scope | Duration | Cost | Deliverable |
|---|---|---|---|---|
| **Phase 1: Zone graph** | Build zone graph from Lanelet2, annotate capacities | 3 weeks | $8-12K | Zone graph builder, capacity annotator |
| **Phase 2: Centralized reservation** | Reservation manager, conflict detection, wait-die | 4 weeks | $12-18K | Fleet-server traffic manager ROS node |
| **Phase 3: Priority resolution** | 9-level priority, yield behavior, stand sequencing | 3 weeks | $8-12K | Conflict resolver, stand controller |
| **Phase 4: V2X fallback** | Decentralized negotiation, token mutex | 3 weeks | $10-15K | V2X traffic messages, fallback protocol |
| **Phase 5: MAPF integration** | CBS/ECBS for shift planning, PIBT for reactive | 4 weeks | $12-18K | MAPF solver, planning integration |
| **Total** | | **17 weeks** | **$50-75K** | Full traffic management system |

### 14.2 Prerequisites

- Lanelet2 map with zone annotations (from `map-construction-pipeline.md`)
- Fleet communication infrastructure (from `v2x-protocols-airside.md`)
- Fleet manager server (from `cloud-backend-infrastructure.md`)
- Per-vehicle Frenet planner with route input (existing)

### 14.3 Testing Milestones

```
Phase 1: Zone graph visualization — overlay on Lanelet2 map, verify capacities
Phase 2: 2-vehicle simulation — head-on, merge, crossing scenarios
Phase 3: 10-vehicle simulation — turnaround sequence at 2 stands
Phase 4: Network failure test — fleet server down for 60s
Phase 5: 50-vehicle stress test — 4-hour simulated shift
```

---

## 15. Key Takeaways

1. **CBF prevents crashes but creates deadlocks**: Reactive collision avoidance is necessary but insufficient for fleet-scale coordination. A traffic management layer must prevent CBF from ever needing to intervene on network-level conflicts.

2. **Wait-die protocol prevents deadlock by construction**: Total ordering on zone acquisition guarantees no circular wait. Younger (lower-priority) missions yield to older ones. Zero deadlocks in theory, defense-in-depth with runtime cycle detection.

3. **Zone reservation is the core mechanism**: Vehicles must reserve zones before entering. Reservation manager checks capacity, detects conflicts, and suggests alternatives. Overhead <10ms for 50-vehicle fleet.

4. **9-level priority hierarchy resolves conflicts deterministically**: Emergency > pushback > fueling > ... > depot return. Equal priority broken by distance-to-destination, then wait-die ordering. No ambiguity at runtime.

5. **Stand operations require turnaround-aware sequencing**: Belt loader before fuel truck before catering. Access lane is one-way at any given time. The stand controller enforces turnaround SOP at the traffic level.

6. **V2X fallback prevents single-point-of-failure**: If fleet server is unreachable, vehicles negotiate directly via V2X MCM messages. Token-based mutex for persistent single-lane zones. Degrades gracefully.

7. **Livelock is a real risk**: Re-routing loops can starve vehicles of progress. Detection via re-route frequency monitoring. Resolution via centralized global assignment or randomized backoff.

8. **MAPF algorithms are mature and applicable**: CBS/ECBS for offline planning, PIBT/LaCAM* for real-time. Airport apron scale (50-100 agents, <500 nodes) is well within solved territory.

9. **Warehouse AGV experience directly transfers**: Amazon Kiva, Locus Robotics, Geek+ have solved fleet traffic at 100-1000 robot scale. Apron is geometrically more complex but lower density.

10. **No competing airside platform publishes a deadlock prevention protocol**: UISEE, TractEasy, AeroVect all operate at small fleet scale where manual coordination suffices. At 20+ vehicles, automated traffic management becomes a differentiator.

11. **Implementation cost $50-75K over 17 weeks**: Phased from basic zone graph through full MAPF integration. Each phase adds value independently.

---

## 16. References

### 16.1 Deadlock Theory

1. Coffman, E. G., Elphick, M. J., & Shoshani, A. (1971). "System Deadlocks." ACM Computing Surveys.
2. Rosenkrantz, D. J., Stearns, R. E., & Lewis, P. M. (1978). "System Level Concurrency Control for Distributed Database Systems." ACM TODS.
3. Holt, R. C. (1972). "Some Deadlock Properties of Computer Systems." ACM Computing Surveys.

### 16.2 Multi-Agent Path Finding

4. Sharon, G., Stern, R., Felner, A., & Sturtevant, N. R. (2015). "Conflict-Based Search for Optimal Multi-Agent Pathfinding." Artificial Intelligence.
5. Barer, M., Sharon, G., Stern, R., & Felner, A. (2014). "Suboptimal Variants of the Conflict-Based Search Algorithm for the Multi-Agent Pathfinding Problem." SOCS.
6. Ma, H., et al. (2019). "Searching with Consistent Prioritization for Multi-Agent Path Finding." AAAI.
7. Okumura, K., et al. (2022). "Priority Inheritance with Backtracking for Iterative Multi-agent Path Finding." Artificial Intelligence.
8. Okumura, K. (2023). "LaCAM*: Search-Based Algorithm for Quick Multi-Agent Pathfinding." AAAI.

### 16.3 AGV and Warehouse Robotics

9. Wurman, P. R., D'Andrea, R., & Mountz, M. (2008). "Coordinating Hundreds of Cooperative, Autonomous Vehicles in Warehouses." AI Magazine.
10. Li, J., et al. (2021). "Lifelong Multi-Agent Path Finding in Large-Scale Warehouses." AAAI.

### 16.4 Airport Surface Movement

11. EUROCONTROL. (2020). "A-SMGCS Manual." Edition 3.0.
12. Roling, P. C., & Visser, H. G. (2008). "Optimal Airport Surface Traffic Planning Using Mixed-Integer Linear Programming." International Journal of Aerospace Engineering.

### 16.5 Internal Cross-References

- `30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md` — Task scheduling (CP-SAT, CBBA)
- `30-autonomy-stack/multi-agent-v2x/v2x-protocols-airside.md` — V2X communication protocols
- `30-autonomy-stack/planning/safety-critical-planning-cbf.md` — CBF safety filter
- `30-autonomy-stack/planning/neuro-symbolic-scene-graphs.md` — Right-of-way knowledge graph
- `70-operations-domains/airside/operations/ground-control-instructions.md` — Ground control hierarchy
- `30-autonomy-stack/localization-mapping/maps/map-construction-pipeline.md` — Lanelet2 map generation
- `50-cloud-fleet/data-platform/cloud-backend-infrastructure.md` — Fleet server infrastructure
- `70-operations-domains/airside/business-case/fleet-tco-business-case.md` — Fleet economics
