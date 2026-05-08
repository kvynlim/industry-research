# Ground Control Instruction Understanding for Airside Autonomous Vehicles

> How autonomous ground vehicles receive, interpret, and execute operational instructions on airport aprons. Covers the instruction chain from Airport Collaborative Decision Making (A-CDM) through fleet management to vehicle execution, digital taxi clearance protocols, A-SMGCS integration, NOTAM-to-route conversion, marshaller gesture recognition, and natural language command parsing for mixed human-machine airside environments.

**Key Takeaway**: Unlike road driving where vehicles follow static traffic rules, airside operations require interpreting a multi-layered instruction stack — from A-CDM scheduling data through ATC ground clearances to marshaller hand signals. No autonomous GSE today handles the full instruction chain autonomously. Building this capability is a significant competitive differentiator: it replaces the human operator's role as instruction interpreter, which is the last major barrier to fully unattended operations.

---

## Table of Contents

1. [Airside Instruction Hierarchy](#1-airside-instruction-hierarchy)
2. [A-CDM and Airport Operational Data](#2-a-cdm-and-airport-operational-data)
3. [A-SMGCS Integration](#3-a-smgcs-integration)
4. [Digital Ground Movement Instructions](#4-digital-ground-movement-instructions)
5. [NOTAM Machine-Readable Parsing](#5-notam-machine-readable-parsing)
6. [Marshaller Gesture Recognition](#6-marshaller-gesture-recognition)
7. [Natural Language Command Processing](#7-natural-language-command-processing)
8. [Instruction-to-Trajectory Mapping](#8-instruction-to-trajectory-mapping)
9. [Ambiguity Resolution and Safety](#9-ambiguity-resolution-and-safety)
10. [Multi-Instruction Sequencing](#10-multi-instruction-sequencing)
11. [System Architecture](#11-system-architecture)
12. [Practical Implementation](#12-practical-implementation)

---

## 1. Airside Instruction Hierarchy

### 1.1 The Instruction Stack

Airside vehicle movements are governed by a layered instruction hierarchy. A human operator implicitly understands all these layers; an autonomous vehicle must explicitly handle each one.

```
Layer 6: Strategic Schedule    ← A-CDM / airline schedule (hours ahead)
Layer 5: Tactical Clearance   ← ATC ground controller (minutes ahead)
Layer 4: Procedural Rules     ← Airport ground movement rules (permanent)
Layer 3: Temporary Restrictions ← NOTAMs, construction zones (hours-days)
Layer 2: Real-time Directives  ← Marshaller signals, radio calls (seconds)
Layer 1: Environmental Constraints ← Weather, visibility, surface (continuous)
```

### 1.2 Instruction Sources and Authority

| Source | Authority Level | Latency | Format | Example |
|--------|----------------|---------|--------|---------|
| **A-CDM/AODB** | Strategic schedule | Hours | Digital (AIDX/AMQP) | "Flight BA123 TOBT 14:30, Stand A14" |
| **ATC Ground** | Binding clearance | Minutes | Voice radio / D-TAXI | "GSE-42, proceed to Stand B7 via Alpha" |
| **Ramp Control** | Apron authority | Minutes | Voice radio / digital | "Tug-12, hold position, aircraft pushing Stand B5" |
| **NOTAM** | Regulatory restriction | Hours-days | Text / AIXM | "TWY B closed 0800-1600 for construction" |
| **Marshaller** | Immediate guidance | Seconds | Visual gesture | Wand signals: proceed, stop, turn |
| **Airport OCC** | Operational override | Minutes | Digital / phone | "All vehicles clear Stand C area — emergency" |

### 1.3 Current State of Practice

**Human-operated GSE**: Driver listens to ramp radio, reads NOTAMs in briefing, follows marshallers visually, knows airport SOPs from training. This is a rich multi-modal instruction comprehension task.

**Current autonomous GSE (TractEasy, UISEE, AeroVect)**:
- Receive mission assignments via proprietary fleet management API
- Follow pre-mapped routes with waypoints
- Do NOT parse ATC radio calls or marshallers
- NOTAM compliance is manual (operator removes restricted routes from map)
- No dynamic ATC clearance — operate in pre-cleared apron zones only

**The gap**: No autonomous GSE today handles real-time ATC interaction, marshaller gesture recognition, or dynamic NOTAM rerouting. This limits them to pre-cleared zones and requires human oversight for any non-routine routing.

---

## 2. A-CDM and Airport Operational Data

### 2.1 Airport Collaborative Decision Making

A-CDM is the standardized process for sharing airport operational data between airlines, ground handlers, ATC, and airport operators. It generates the scheduling data that drives GSE missions.

**Key A-CDM Milestones Relevant to GSE**:

| Milestone | Abbreviation | Meaning for GSE |
|-----------|-------------|-----------------|
| Target Off-Block Time | TOBT | When aircraft should push back — GSE must be clear |
| Target Start-Up Approval Time | TSAT | When pilot gets engine start clearance |
| Estimated Landing Time | ELDT | Triggers inbound servicing preparation |
| Actual In-Block Time | AIBT | Stand occupied — start turnaround services |
| Actual Off-Block Time | AOBT | Aircraft departed — stand free for cleanup/next arrival |

### 2.2 Data Integration for Mission Planning

```python
class ACDMFlightEventProcessor:
    """Convert A-CDM flight events into GSE mission triggers."""
    
    def __init__(self, fleet_manager, route_planner):
        self.fleet = fleet_manager
        self.planner = route_planner
        self.active_turnarounds = {}
    
    def on_flight_event(self, event):
        """Process A-CDM milestone updates."""
        
        if event.milestone == "ELDT":
            # Aircraft landing — schedule inbound baggage service
            eta_at_stand = event.timestamp + timedelta(minutes=event.taxi_time_est)
            self.fleet.schedule_mission(
                mission_type="INBOUND_BAGGAGE",
                destination_stand=event.stand,
                required_arrival=eta_at_stand + timedelta(minutes=2),
                # GSE should arrive within 2 min of aircraft arrival
                priority=self._compute_priority(event),
                constraints={
                    "aircraft_type": event.aircraft_type,  # affects stand clearance
                    "flight_category": event.category,      # domestic/intl/transfer
                }
            )
        
        elif event.milestone == "AIBT":
            # Aircraft at stand — turnaround begins
            turnaround = Turnaround(
                flight=event.flight_id,
                stand=event.stand,
                aircraft_type=event.aircraft_type,
                start_time=event.timestamp,
                scheduled_services=self._plan_turnaround(event)
            )
            self.active_turnarounds[event.stand] = turnaround
            
            # Dispatch first service (typically chocks + GPU)
            for service in turnaround.scheduled_services:
                if service.trigger == "ON_BLOCK":
                    self.fleet.dispatch(service)
        
        elif event.milestone == "TOBT":
            # Pushback approaching — clear stand area
            stand = event.stand
            tobt = event.timestamp
            
            # All GSE must be clear 5 min before TOBT
            clearance_deadline = tobt - timedelta(minutes=5)
            
            for vehicle in self.fleet.vehicles_at_stand(stand):
                self.fleet.command(vehicle, "CLEAR_STAND", 
                                  deadline=clearance_deadline)
    
    def _compute_priority(self, event):
        """Priority based on connection criticality."""
        if event.has_tight_connections:
            return Priority.CRITICAL
        elif event.delay_minutes > 15:
            return Priority.HIGH
        else:
            return Priority.NORMAL
    
    def _plan_turnaround(self, event):
        """Generate service sequence for turnaround."""
        services = [
            Service("CHOCKS_GPU", trigger="ON_BLOCK", offset_min=0),
            Service("UNLOAD_BAGGAGE", trigger="ON_BLOCK", offset_min=2),
            Service("CATERING", trigger="ON_BLOCK", offset_min=5),
            Service("FUEL", trigger="ON_BLOCK", offset_min=5),
            Service("LOAD_BAGGAGE", trigger="BOARDING_START", offset_min=0),
            Service("REMOVE_GPU", trigger="PUSHBACK_REQUEST", offset_min=-3),
        ]
        # Adjust for aircraft type
        if event.aircraft_type.startswith("A38") or event.aircraft_type.startswith("B77"):
            services.append(Service("UPPER_DECK_LOADER", trigger="ON_BLOCK", offset_min=3))
        return services
```

### 2.3 Data Protocols

| Protocol | Use | Format | Latency |
|----------|-----|--------|---------|
| **AIDX (IATA)** | Flight status exchange | XML over AMQP/JMS | 1-5s |
| **ACRIS (ACI)** | Airport operational data | REST/JSON | 1-10s |
| **AODB proprietary** | Airport-specific ops database | Varies | 1-30s |
| **SWIM (EUROCONTROL/FAA)** | System-wide info management | SOA/web services | 5-30s |
| **AMHS** | ATC message handling | AFTN/AMHS format | 1-60s |

**For autonomous GSE**: AIDX/ACRIS provides strategic flight data. SWIM provides broader ATM context. Neither provides real-time ground clearances — those come from ATC/ramp control (Section 4).

---

## 3. A-SMGCS Integration

### 3.1 What is A-SMGCS

Advanced Surface Movement Guidance and Control System — the airport's integrated system for surveillance, routing, guidance, and control of all surface movements (aircraft and vehicles).

**Four Levels**:

| Level | Capability | Status (2026) |
|-------|-----------|---------------|
| **L1: Surveillance** | Track all surface movements (SMR + MLAT + ADS-B) | Deployed at 200+ airports |
| **L2: Safety nets** | Conflict alerts, runway incursion warnings | Deployed at 100+ airports |
| **L3: Conflict detection** | Predicted route conflicts, automated sequencing | Deployed at 50+ airports |
| **L4: Guidance & control** | Automated routing, stop bars, dynamic guidance | Deployed at 20+ airports |

### 3.2 A-SMGCS Data Feeds for Autonomous GSE

A-SMGCS provides the airport-level situational awareness that an autonomous GSE needs:

```python
class ASMGCSInterface:
    """Interface to A-SMGCS data feeds for autonomous GSE."""
    
    def __init__(self, endpoint, auth_token):
        self.endpoint = endpoint
        self.auth = auth_token
        self.surface_tracks = {}  # All tracked objects on surface
        self.conflict_alerts = []
        self.routing_constraints = {}
    
    def get_surface_picture(self):
        """Get current surface movement picture.
        
        Returns positions of all tracked objects:
        - Aircraft (from MLAT/ADS-B transponders)
        - Cooperative vehicles (from vehicle tracking system)
        - Non-cooperative objects (from SMR radar returns)
        """
        return {
            "aircraft": self._get_aircraft_tracks(),
            "vehicles": self._get_vehicle_tracks(),
            "unknown": self._get_smr_only_tracks(),
            "timestamp": datetime.utcnow(),
            "update_rate_hz": 1.0,  # typical A-SMGCS update rate
        }
    
    def get_routing_constraints(self, vehicle_id):
        """Get active routing constraints for this vehicle.
        
        A-SMGCS L3/L4 can provide:
        - Approved routes (from ramp control clearance)
        - Blocked segments (taxiway closures, active pushbacks)
        - Speed restrictions per segment
        - Hold points (wait for aircraft crossing)
        """
        return {
            "approved_route": self._get_approved_route(vehicle_id),
            "blocked_segments": self._get_blocked_segments(),
            "speed_restrictions": self._get_speed_restrictions(),
            "hold_points": self._get_hold_points(vehicle_id),
        }
    
    def report_position(self, vehicle_id, lat, lon, heading, speed):
        """Report own position to A-SMGCS.
        
        Cooperative surveillance: vehicle broadcasts position so ATC
        can track it alongside aircraft. Uses ADS-B squitter or
        dedicated vehicle tracking protocol.
        """
        msg = {
            "vehicle_id": vehicle_id,
            "position": {"lat": lat, "lon": lon},
            "heading_deg": heading,
            "speed_kt": speed * 0.539957,  # km/h to knots
            "vehicle_type": "AUTONOMOUS_GSE",
            "timestamp": datetime.utcnow().isoformat(),
        }
        self._publish("vehicle_position", msg)
    
    def subscribe_conflict_alerts(self, callback):
        """Subscribe to conflict alerts from A-SMGCS L2/L3.
        
        Alert types:
        - RUNWAY_INCURSION_WARNING: Vehicle approaching hold-short line
        - CONFLICT_ALERT: Predicted intersection with aircraft route
        - RESTRICTED_AREA_WARNING: Vehicle approaching restricted zone
        """
        self._subscribe("conflict_alerts", callback)
```

### 3.3 Current Integration Gap

**The problem**: A-SMGCS was designed for ATC to monitor aircraft and manually direct vehicles via radio. There is no standardized API for autonomous vehicles to receive routing data directly from A-SMGCS.

**Workarounds in practice**:
- **UISEE (Changi)**: Proprietary integration with Changi's AeroDCS ground control system
- **TractEasy**: Pre-mapped routes; ground controller manually deconflicts via radio to TractEasy operator
- **AeroVect**: GPS-based fleet tracking reported to airport system; no inbound data feed

**What's needed**: A bidirectional API where:
1. A-SMGCS sends routing constraints and conflict alerts to autonomous GSE
2. Autonomous GSE reports position, intent (planned route), and status to A-SMGCS
3. Ground controller can approve/modify GSE routes through the same interface used for aircraft

**EUROCONTROL SWIM**: Could provide the service-oriented architecture for this exchange, but no SWIM service currently exists for autonomous GSE. This is a standards gap that will likely be addressed in the 2028-2030 timeframe.

---

## 4. Digital Ground Movement Instructions

### 4.1 Current: Voice Radio Instructions

Today, ground vehicles receive instructions via analog VHF radio from ramp control or ATC ground:

```
Typical ramp radio exchange (human driver):

RAMP: "Tug-42, proceed to Stand Bravo-14 via service road Alpha"
TUG:  "Tug-42, proceeding to Bravo-14 via Alpha"

RAMP: "Tug-42, hold position, aircraft pushing Bravo-12"  
TUG:  "Tug-42, holding"

RAMP: "Tug-42, continue to Bravo-14"
TUG:  "Tug-42, continuing"
```

**Challenges for autonomous vehicles**:
- Noisy radio environment (engine noise, wind, multiple speakers)
- Non-standard phraseology (varies by airport, language, controller)
- Implicit context ("hold for the heavy" = hold for wide-body aircraft)
- Call-sign confusion (Tug-42 vs Tug-44)

### 4.2 D-TAXI: Digital Taxi Clearance

D-TAXI (Digital Taxi) is the emerging standard for transmitting taxi instructions digitally rather than by voice. Currently in trials for aircraft, it will eventually extend to ground vehicles.

**Status (2026)**:
- EUROCONTROL: D-TAXI trials at Paris CDG, Frankfurt, Amsterdam (aircraft only)
- FAA: Data Comm program includes surface operations (CPDLC for taxi)
- ICAO: Doc 9694 (ATS Data Link) supports taxi clearance messages
- For GSE: No current trials, but architecture is extensible

**D-TAXI Message Format (CPDLC-based)**:

```python
class DigitalTaxiClearance:
    """Representation of a digital taxi instruction."""
    
    def __init__(self):
        self.clearance_id = ""
        self.vehicle_id = ""
        self.instruction_type = ""  # ROUTE, HOLD, PROCEED, GIVE_WAY
        self.route_segments = []    # List of named segments/taxiways
        self.destination = ""       # Stand, holding point, or area
        self.restrictions = []      # Speed limits, hold points
        self.valid_from = None
        self.valid_until = None
        self.authority = ""         # ATC_GROUND, RAMP_CONTROL
    
    @classmethod
    def from_cpdlc(cls, message):
        """Parse CPDLC-format taxi clearance.
        
        CPDLC taxi message types (relevant subset):
        - UM73: TAXI TO [position] VIA [route]
        - UM74: TAXI TO [position] VIA [route] HOLD SHORT OF [position]
        - UM75: TAXI TO [position] WITHOUT DELAY
        - UM76: HOLD POSITION
        - UM77: TAXI INTO RUNWAY [runway]
        - UM80: GIVE WAY TO [traffic]
        """
        clearance = cls()
        
        if message.type == "UM73":
            clearance.instruction_type = "ROUTE"
            clearance.destination = message.params["position"]
            clearance.route_segments = message.params["route"]
        elif message.type == "UM76":
            clearance.instruction_type = "HOLD"
        elif message.type == "UM80":
            clearance.instruction_type = "GIVE_WAY"
            clearance.restrictions.append({
                "type": "give_way",
                "target": message.params["traffic"]
            })
        
        return clearance


class DigitalTaxiRouter:
    """Convert digital taxi clearance into executable trajectory."""
    
    def __init__(self, airport_graph, route_planner):
        self.graph = airport_graph  # Lanelet2 or custom graph of service roads
        self.planner = route_planner
    
    def execute_clearance(self, clearance):
        """Convert clearance to waypoint sequence."""
        
        if clearance.instruction_type == "ROUTE":
            # Resolve named segments to graph edges
            waypoints = []
            for segment_name in clearance.route_segments:
                segment = self.graph.resolve_segment(segment_name)
                if segment is None:
                    raise UnknownSegmentError(
                        f"Cannot resolve segment '{segment_name}'. "
                        f"Airport graph may need updating."
                    )
                waypoints.extend(segment.centerline_points)
            
            # Apply restrictions
            speed_profile = self._compute_speed_profile(
                waypoints, clearance.restrictions
            )
            
            # Check hold-short points
            hold_points = [r for r in clearance.restrictions 
                          if r["type"] == "hold_short"]
            
            return ExecutableRoute(
                waypoints=waypoints,
                speed_profile=speed_profile,
                hold_points=hold_points,
                destination=clearance.destination,
                clearance_id=clearance.clearance_id,
            )
        
        elif clearance.instruction_type == "HOLD":
            return HoldCommand(position="current")
        
        elif clearance.instruction_type == "GIVE_WAY":
            target = clearance.restrictions[0]["target"]
            return GiveWayCommand(
                target_id=target,
                resume_when="target_cleared"
            )
    
    def _compute_speed_profile(self, waypoints, restrictions):
        """Apply speed restrictions to route."""
        profile = []
        default_speed = 15.0  # km/h default apron speed
        
        for i, wp in enumerate(waypoints):
            speed = default_speed
            for r in restrictions:
                if r["type"] == "speed_limit" and r["segment"] == wp.segment_name:
                    speed = r["max_speed_kmh"]
            profile.append(speed)
        
        return profile
```

### 4.3 Interim Solution: Fleet Management as Instruction Proxy

Until D-TAXI extends to GSE, the practical approach is a fleet management system that acts as instruction proxy:

```
Human ATC/Ramp Controller
        │
        ▼ (voice radio or digital interface)
Fleet Management System (translates to machine instructions)
        │
        ▼ (API)
Autonomous Vehicle (executes structured commands)
```

```python
class FleetInstructionProxy:
    """Proxy between human controllers and autonomous fleet."""
    
    # Structured instruction set for autonomous GSE
    INSTRUCTION_SET = {
        "PROCEED_TO_STAND": {
            "params": ["stand_id", "via_route", "priority"],
            "example": {"stand_id": "B14", "via_route": "ALPHA", "priority": "normal"}
        },
        "HOLD_POSITION": {
            "params": ["reason", "resume_condition"],
            "example": {"reason": "aircraft_pushback", "resume_condition": "manual_release"}
        },
        "CLEAR_STAND": {
            "params": ["stand_id", "deadline_utc", "exit_direction"],
            "example": {"stand_id": "B14", "deadline_utc": "2026-04-11T14:25:00Z"}
        },
        "GIVE_WAY": {
            "params": ["target_type", "target_id"],
            "example": {"target_type": "aircraft", "target_id": "BAW123"}
        },
        "RETURN_TO_DEPOT": {
            "params": ["depot_id", "urgency"],
            "example": {"depot_id": "DEPOT_NORTH", "urgency": "normal"}
        },
        "EMERGENCY_STOP": {
            "params": ["reason"],
            "example": {"reason": "fire_reported_stand_c12"}
        },
        "REROUTE": {
            "params": ["avoid_area", "new_via"],
            "example": {"avoid_area": "TWY_B_CLOSED", "new_via": "SERVICE_ROAD_3"}
        },
    }
    
    def process_controller_input(self, raw_input, source):
        """Convert controller input to structured instruction.
        
        Input can be:
        - Digital: structured form submission from ramp control UI
        - Voice: transcribed and parsed (future capability)
        - Automatic: from A-CDM event (e.g., TOBT update → CLEAR_STAND)
        """
        if source == "digital_ui":
            return self._parse_digital(raw_input)
        elif source == "voice_transcription":
            return self._parse_voice(raw_input)
        elif source == "acdm_event":
            return self._translate_acdm(raw_input)
    
    def _parse_voice(self, transcription):
        """Parse voice transcription to structured instruction.
        
        Uses NLU model trained on airport ground control phraseology.
        See Section 7 for details.
        """
        # Extract intent and entities
        parsed = self.nlu_model.parse(transcription)
        
        if parsed.intent == "route_vehicle":
            return {
                "type": "PROCEED_TO_STAND",
                "params": {
                    "stand_id": parsed.entities.get("destination"),
                    "via_route": parsed.entities.get("route"),
                    "priority": parsed.entities.get("urgency", "normal"),
                },
                "confidence": parsed.confidence,
                "raw_text": transcription,
            }
        elif parsed.intent == "hold":
            return {
                "type": "HOLD_POSITION",
                "params": {
                    "reason": parsed.entities.get("reason", "controller_instruction"),
                    "resume_condition": "manual_release",
                },
                "confidence": parsed.confidence,
                "raw_text": transcription,
            }
        # ... other intents
```

---

## 5. NOTAM Machine-Readable Parsing

### 5.1 NOTAM Structure and Airside Impact

NOTAMs affecting airside AV operations include:

| NOTAM Type | Example | AV Impact |
|-----------|---------|-----------|
| Taxiway closure | `TWY B CLSD BTN TWY A AND TWY C` | Route blocked, reroute needed |
| Stand closure | `APRON STAND B14-B18 CLSD` | Cannot accept missions to those stands |
| Lighting outage | `APRON LGTS U/S STANDS C1-C10` | Degraded visibility, speed reduction |
| Construction | `CONST WIP VICINITY STAND A20` | Dynamic obstacle zone |
| Surface condition | `APRON SFC ICE PATCHES` | Traction reduction, speed limit |
| ILS restriction | `ILS CAT II/III RWY 27L IN USE - CRIT AREA` | Geofence active for ILS area |

### 5.2 NOTAM Parsing Pipeline

```python
import re
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime

@dataclass
class ParsedNOTAM:
    """Machine-readable NOTAM affecting vehicle operations."""
    raw_text: str
    notam_id: str
    effective_from: datetime
    effective_until: datetime
    affected_area: str          # "TWY_B", "STAND_B14", "APRON_SOUTH"
    restriction_type: str       # "CLOSED", "RESTRICTED", "DEGRADED"
    impact_on_routing: str      # "BLOCKED", "SPEED_REDUCED", "CAUTION"
    affected_segments: List[str] = field(default_factory=list)
    speed_limit_kmh: Optional[float] = None
    geofence_polygon: Optional[List[tuple]] = None
    confidence: float = 1.0

class NOTAMParser:
    """Parse NOTAM text into machine-readable routing constraints."""
    
    # Common NOTAM abbreviations for ground operations
    ABBREVIATIONS = {
        "CLSD": "CLOSED", "OPN": "OPEN", "U/S": "UNSERVICEABLE",
        "WIP": "WORK_IN_PROGRESS", "CONST": "CONSTRUCTION",
        "LGTS": "LIGHTS", "SFC": "SURFACE", "BTN": "BETWEEN",
        "APRON": "APRON", "TWY": "TAXIWAY", "RWY": "RUNWAY",
        "AVBL": "AVAILABLE", "AUTH": "AUTHORIZED", "LTD": "LIMITED",
    }
    
    # Patterns for extracting affected areas
    PATTERNS = {
        "taxiway_closure": re.compile(
            r"TWY\s+([A-Z0-9]+)\s+CL[SO][DE]"
            r"(?:\s+BTN\s+TWY\s+([A-Z0-9]+)\s+AND\s+TWY\s+([A-Z0-9]+))?"
        ),
        "stand_closure": re.compile(
            r"(?:APRON\s+)?STAND[S]?\s+([A-Z]?\d+(?:-[A-Z]?\d+)?)\s+CL[SO][DE]"
        ),
        "surface_condition": re.compile(
            r"(?:APRON|TWY|SFC)\s+.*?(ICE|SNOW|WET|CONTAMINATED|OIL)"
        ),
        "lighting_outage": re.compile(
            r"(?:APRON|TWY)\s+LG?TS?\s+U/S\s+(?:STANDS?\s+)?([A-Z0-9-]+)"
        ),
        "construction": re.compile(
            r"(?:CONST|WIP|CONSTRUCTION)\s+.*?(?:STAND|APRON|TWY)\s+([A-Z0-9-]+)"
        ),
        "ils_restriction": re.compile(
            r"ILS\s+(?:CAT\s+)?(?:II|III).*?RWY\s+(\d{2}[LRC]?).*?CRIT"
        ),
    }
    
    def __init__(self, airport_graph):
        self.graph = airport_graph  # Airport topology for segment resolution
    
    def parse(self, notam_text, notam_id, effective_from, effective_until):
        """Parse NOTAM into routing constraint."""
        text = notam_text.upper().strip()
        
        # Try each pattern
        for pattern_name, regex in self.PATTERNS.items():
            match = regex.search(text)
            if match:
                return self._build_constraint(
                    pattern_name, match, text, notam_id,
                    effective_from, effective_until
                )
        
        # Fallback: LLM-based parsing for non-standard NOTAMs
        return self._llm_parse(text, notam_id, effective_from, effective_until)
    
    def _build_constraint(self, pattern_type, match, text, notam_id, 
                          eff_from, eff_until):
        """Build structured constraint from regex match."""
        
        if pattern_type == "taxiway_closure":
            taxiway = match.group(1)
            between_start = match.group(2)
            between_end = match.group(3)
            
            segments = self.graph.resolve_taxiway_segments(
                taxiway, between_start, between_end
            )
            
            return ParsedNOTAM(
                raw_text=text,
                notam_id=notam_id,
                effective_from=eff_from,
                effective_until=eff_until,
                affected_area=f"TWY_{taxiway}",
                restriction_type="CLOSED",
                impact_on_routing="BLOCKED",
                affected_segments=[s.id for s in segments],
                confidence=0.95,
            )
        
        elif pattern_type == "stand_closure":
            stand_range = match.group(1)
            stands = self._expand_stand_range(stand_range)
            
            return ParsedNOTAM(
                raw_text=text,
                notam_id=notam_id,
                effective_from=eff_from,
                effective_until=eff_until,
                affected_area=f"STANDS_{stand_range}",
                restriction_type="CLOSED",
                impact_on_routing="BLOCKED",
                affected_segments=[f"STAND_{s}" for s in stands],
                confidence=0.95,
            )
        
        elif pattern_type == "surface_condition":
            condition = match.group(1)
            speed_limit = {
                "ICE": 5.0, "SNOW": 10.0, "WET": 15.0,
                "CONTAMINATED": 5.0, "OIL": 0.0,  # 0 = do not enter
            }.get(condition, 10.0)
            
            return ParsedNOTAM(
                raw_text=text,
                notam_id=notam_id,
                effective_from=eff_from,
                effective_until=eff_until,
                affected_area="APRON_WIDE",
                restriction_type="DEGRADED",
                impact_on_routing="SPEED_REDUCED",
                speed_limit_kmh=speed_limit,
                confidence=0.85,
            )
        
        elif pattern_type == "ils_restriction":
            runway = match.group(1)
            geofence = self.graph.get_ils_critical_area(runway)
            
            return ParsedNOTAM(
                raw_text=text,
                notam_id=notam_id,
                effective_from=eff_from,
                effective_until=eff_until,
                affected_area=f"ILS_CRIT_RWY_{runway}",
                restriction_type="RESTRICTED",
                impact_on_routing="BLOCKED",
                geofence_polygon=geofence,
                confidence=0.90,
            )
        
        # Default caution zone
        return ParsedNOTAM(
            raw_text=text, notam_id=notam_id,
            effective_from=eff_from, effective_until=eff_until,
            affected_area="UNKNOWN", restriction_type="CAUTION",
            impact_on_routing="CAUTION", confidence=0.5,
        )
    
    def _llm_parse(self, text, notam_id, eff_from, eff_until):
        """Fallback: use VLM/LLM to parse non-standard NOTAMs."""
        prompt = f"""Parse this airport NOTAM into a routing constraint 
for an autonomous ground vehicle operating on the apron.

NOTAM text: {text}

Extract:
1. affected_area: Which taxiway, stand, or apron area is affected?
2. restriction_type: CLOSED, RESTRICTED, or DEGRADED?
3. impact_on_routing: Should the vehicle AVOID the area, SLOW DOWN, or proceed with CAUTION?
4. speed_limit_kmh: If speed restricted, what limit? (null if closed)

Respond in JSON format only."""
        
        response = self.llm.generate(prompt)
        parsed = json.loads(response)
        
        return ParsedNOTAM(
            raw_text=text, notam_id=notam_id,
            effective_from=eff_from, effective_until=eff_until,
            affected_area=parsed.get("affected_area", "UNKNOWN"),
            restriction_type=parsed.get("restriction_type", "CAUTION"),
            impact_on_routing=parsed.get("impact_on_routing", "CAUTION"),
            speed_limit_kmh=parsed.get("speed_limit_kmh"),
            confidence=0.6,  # lower confidence for LLM-parsed
        )
    
    def _expand_stand_range(self, stand_range):
        """Expand 'B14-B18' into ['B14', 'B15', 'B16', 'B17', 'B18']."""
        if "-" not in stand_range:
            return [stand_range]
        
        parts = stand_range.split("-")
        prefix = re.match(r"([A-Z]*)", parts[0]).group(1)
        start = int(re.search(r"(\d+)", parts[0]).group(1))
        end = int(re.search(r"(\d+)", parts[1]).group(1))
        
        return [f"{prefix}{i}" for i in range(start, end + 1)]
```

### 5.3 NOTAM Integration with Route Planner

```python
class NOTAMRouteConstraintManager:
    """Maintain active NOTAM constraints and apply to route planning."""
    
    def __init__(self, parser, route_planner, poll_interval_sec=60):
        self.parser = parser
        self.planner = route_planner
        self.active_constraints = {}  # notam_id → ParsedNOTAM
        self.poll_interval = poll_interval_sec
    
    def update_constraints(self, notams):
        """Update active constraint set from NOTAM feed."""
        now = datetime.utcnow()
        
        # Add new / update existing
        for notam in notams:
            parsed = self.parser.parse(
                notam["text"], notam["id"],
                notam["effective_from"], notam["effective_until"]
            )
            
            if parsed.effective_until > now:
                self.active_constraints[notam["id"]] = parsed
        
        # Remove expired
        expired = [nid for nid, n in self.active_constraints.items()
                   if n.effective_until <= now]
        for nid in expired:
            del self.active_constraints[nid]
        
        # Update route planner
        blocked = [n.affected_segments for n in self.active_constraints.values()
                   if n.impact_on_routing == "BLOCKED"]
        speed_zones = [(n.affected_segments, n.speed_limit_kmh) 
                       for n in self.active_constraints.values()
                       if n.speed_limit_kmh is not None]
        
        self.planner.set_blocked_segments(
            [seg for segs in blocked for seg in segs]
        )
        for segments, speed in speed_zones:
            self.planner.set_speed_limit(segments, speed)
    
    def check_route_validity(self, route):
        """Check if a planned route conflicts with active NOTAMs."""
        conflicts = []
        for constraint in self.active_constraints.values():
            for seg in route.segments:
                if seg in constraint.affected_segments:
                    conflicts.append({
                        "notam_id": constraint.notam_id,
                        "segment": seg,
                        "restriction": constraint.restriction_type,
                        "raw_text": constraint.raw_text,
                    })
        return conflicts
```

---

## 6. Marshaller Gesture Recognition

### 6.1 Standard Marshalling Signals

ICAO Annex 2, Appendix 1 defines standardized marshalling signals used worldwide. While these are primarily for aircraft, some signals are also used to direct ground vehicles near aircraft:

| Signal | Description | Meaning for GSE |
|--------|-------------|-----------------|
| **Proceed straight** | Arms raised, palms facing inward, sweep inward | Move forward |
| **Turn left** | Right arm down, left arm repeatedly sweeps upward | Turn left |
| **Turn right** | Left arm down, right arm repeatedly sweeps upward | Turn right |
| **Stop** | Arms crossed above head | Stop immediately |
| **Slow down** | Arms down, palms down, move up and down | Reduce speed |
| **All clear** | Right arm raised, thumb up, then wave | Continue, area safe |
| **Emergency stop** | Arms extended, fists clenched, cross and uncross repeatedly | Emergency stop |
| **Chocks on** | Arms at sides, elbows out, clench fists | Chocks placed (aircraft secured) |
| **Chocks off** | Arms at sides, elbows out, open fists outward | Chocks removed (prepare for movement) |

### 6.2 Gesture Recognition Architecture

```python
class MarshallerGestureRecognizer:
    """Recognize marshaller signals from camera images.
    
    Architecture:
    1. Person detection (CenterPoint/YOLO on LiDAR+camera)
    2. Pose estimation (HRNet/ViTPose on detected person crop)
    3. Gesture classification (temporal model on pose sequence)
    4. Intent confirmation (require N consecutive frames)
    """
    
    GESTURE_CLASSES = [
        "PROCEED",        # move forward
        "STOP",           # stop
        "SLOW_DOWN",      # reduce speed
        "TURN_LEFT",      # turn left
        "TURN_RIGHT",     # turn right
        "ALL_CLEAR",      # safe to proceed
        "EMERGENCY_STOP", # emergency
        "CHOCKS_ON",      # chocks placed
        "CHOCKS_OFF",     # chocks removed
        "NO_SIGNAL",      # not signaling (default)
    ]
    
    def __init__(self, pose_model, gesture_model, 
                 confirmation_frames=5, min_confidence=0.8):
        self.pose_model = pose_model        # ViTPose or HRNet
        self.gesture_model = gesture_model  # LSTM/Transformer on keypoints
        self.confirmation_frames = confirmation_frames
        self.min_confidence = min_confidence
        self.gesture_buffer = []
    
    def process_frame(self, image, person_bbox):
        """Process single frame for gesture recognition.
        
        Args:
            image: Camera frame (BGR)
            person_bbox: Bounding box of detected marshaller
            
        Returns:
            Confirmed gesture or None if not yet confirmed
        """
        # Step 1: Crop person and estimate pose
        person_crop = image[
            person_bbox.y1:person_bbox.y2,
            person_bbox.x1:person_bbox.x2
        ]
        keypoints = self.pose_model.estimate(person_crop)
        # keypoints: 17 COCO joints with (x, y, confidence)
        
        # Step 2: Extract gesture-relevant features
        features = self._extract_gesture_features(keypoints)
        
        # Step 3: Temporal classification
        self.gesture_buffer.append(features)
        if len(self.gesture_buffer) > 30:  # 1 second at 30fps
            self.gesture_buffer.pop(0)
        
        if len(self.gesture_buffer) >= self.confirmation_frames:
            sequence = torch.stack(self.gesture_buffer[-self.confirmation_frames:])
            logits = self.gesture_model(sequence.unsqueeze(0))
            probs = torch.softmax(logits, dim=-1)
            
            gesture_idx = probs.argmax().item()
            confidence = probs.max().item()
            
            if confidence >= self.min_confidence:
                gesture = self.GESTURE_CLASSES[gesture_idx]
                
                # Require consistent classification over window
                if self._is_consistent(gesture):
                    return GestureResult(
                        gesture=gesture,
                        confidence=confidence,
                        keypoints=keypoints,
                        timestamp=time.time()
                    )
        
        return None
    
    def _extract_gesture_features(self, keypoints):
        """Extract features relevant to marshalling gestures.
        
        Key features:
        - Arm angles (shoulder-elbow-wrist)
        - Hand height relative to head
        - Arms crossed detection
        - Arm motion direction (velocity from temporal diff)
        """
        # Joint indices (COCO format)
        L_SHOULDER, R_SHOULDER = 5, 6
        L_ELBOW, R_ELBOW = 7, 8
        L_WRIST, R_WRIST = 9, 10
        NOSE = 0
        
        features = []
        
        # Arm angles
        for side in [(L_SHOULDER, L_ELBOW, L_WRIST), 
                     (R_SHOULDER, R_ELBOW, R_WRIST)]:
            shoulder = keypoints[side[0]][:2]
            elbow = keypoints[side[1]][:2]
            wrist = keypoints[side[2]][:2]
            
            # Elbow angle
            angle = self._angle(shoulder, elbow, wrist)
            features.append(angle)
            
            # Wrist height relative to nose
            features.append(wrist[1] - keypoints[NOSE][1])
            
            # Arm extension (shoulder to wrist distance)
            features.append(np.linalg.norm(wrist - shoulder))
        
        # Arms crossed detection
        l_wrist = keypoints[L_WRIST][:2]
        r_wrist = keypoints[R_WRIST][:2]
        features.append(l_wrist[0] - r_wrist[0])  # x-crossing indicator
        
        # Shoulder width (normalization reference)
        shoulder_width = np.linalg.norm(
            keypoints[L_SHOULDER][:2] - keypoints[R_SHOULDER][:2]
        )
        features.append(shoulder_width)
        
        return torch.tensor(features, dtype=torch.float32)
    
    def _angle(self, a, b, c):
        """Compute angle at b formed by points a-b-c."""
        ba = a - b
        bc = c - b
        cos_angle = np.dot(ba, bc) / (np.linalg.norm(ba) * np.linalg.norm(bc) + 1e-8)
        return np.arccos(np.clip(cos_angle, -1.0, 1.0))
    
    def _is_consistent(self, gesture):
        """Check temporal consistency of gesture classification."""
        recent = self.gesture_buffer[-self.confirmation_frames:]
        # All recent frames should produce same gesture
        # (simplified — full implementation uses gesture_model on sequences)
        return True  # Delegated to temporal model


class GestureToCommand:
    """Convert confirmed marshaller gestures to vehicle commands."""
    
    GESTURE_COMMAND_MAP = {
        "STOP": {"type": "HOLD_POSITION", "immediate": True},
        "EMERGENCY_STOP": {"type": "EMERGENCY_STOP", "immediate": True},
        "PROCEED": {"type": "RESUME", "speed_limit_kmh": 10.0},
        "SLOW_DOWN": {"type": "REDUCE_SPEED", "factor": 0.5},
        "TURN_LEFT": {"type": "PREFER_LEFT", "advisory": True},
        "TURN_RIGHT": {"type": "PREFER_RIGHT", "advisory": True},
        "ALL_CLEAR": {"type": "RESUME", "speed_limit_kmh": None},
        "CHOCKS_ON": {"type": "INFO", "event": "chocks_placed"},
        "CHOCKS_OFF": {"type": "INFO", "event": "chocks_removed"},
    }
    
    def convert(self, gesture_result):
        """Convert gesture to vehicle command with safety checks."""
        mapping = self.GESTURE_COMMAND_MAP.get(gesture_result.gesture)
        if mapping is None:
            return None
        
        command = VehicleCommand(
            source="MARSHALLER",
            command_type=mapping["type"],
            params=mapping,
            confidence=gesture_result.confidence,
            timestamp=gesture_result.timestamp,
        )
        
        # Safety: STOP/EMERGENCY always accepted, others require higher confidence
        if command.command_type in ("HOLD_POSITION", "EMERGENCY_STOP"):
            command.authority = "IMMEDIATE"  # bypass planner
        else:
            command.authority = "ADVISORY"  # planner considers but doesn't override
        
        return command
```

### 6.3 Challenges and Limitations

| Challenge | Description | Mitigation |
|-----------|-------------|------------|
| Distance | Marshallers may be 20-50m away | Use zoom camera or telephoto lens |
| Night visibility | Dark clothing, wand lights vs reflective vests | Thermal camera for person, visible camera for wands |
| Occlusion | Marshaller partially hidden by GSE | Multi-camera fusion, require clear line of sight |
| Non-standard signals | Airport-specific or improvised gestures | Conservative: treat unknown gesture as STOP |
| Multiple marshallers | More than one person gesturing | Track specific marshaller ID, use closest to vehicle |
| False positive | Ramp worker waving ≠ marshalling | Require sustained directed gesture, not casual motion |

### 6.4 Training Data

**Problem**: No public dataset exists for airport marshalling gesture recognition.

**Solutions**:
- **Synthetic**: Generate marshaller poses in simulation (CARLA/Isaac Sim)
- **Adapted**: Use ASL/gesture recognition datasets as pre-training, fine-tune on airport data
- **Fleet collection**: Capture real marshaller interactions during supervised operations
- **Estimated data need**: 500-1,000 labeled gesture sequences per class for fine-tuning

---

## 7. Natural Language Command Processing

### 7.1 Airport Ground Control Phraseology

Ground control phraseology follows semi-standardized patterns. Key patterns for GSE:

```python
# Airport ground control phrase patterns
GROUND_CONTROL_GRAMMAR = {
    # Route instructions
    "route": [
        "{callsign}, proceed to {destination} via {route}",
        "{callsign}, taxi to {destination}",
        "{callsign}, take service road {road_id} to {destination}",
        "{callsign}, follow the {vehicle_type} ahead to {destination}",
    ],
    
    # Hold instructions
    "hold": [
        "{callsign}, hold position",
        "{callsign}, hold short of {boundary}",
        "{callsign}, give way to {traffic}",
        "{callsign}, hold for {reason}",
    ],
    
    # Resume instructions
    "resume": [
        "{callsign}, continue",
        "{callsign}, proceed",
        "{callsign}, resume taxi",
        "{callsign}, clear to proceed",
    ],
    
    # Speed instructions
    "speed": [
        "{callsign}, reduce speed",
        "{callsign}, expedite",
        "{callsign}, slow down approaching {location}",
    ],
    
    # Emergency
    "emergency": [
        "all vehicles, hold position",
        "{callsign}, stop immediately",
        "emergency vehicle inbound, clear {area}",
    ],
}
```

### 7.2 NLU for Ground Control

```python
class GroundControlNLU:
    """Natural Language Understanding for airport ground control instructions.
    
    Architecture options:
    1. Rule-based: Regex patterns + entity extraction (reliable, limited)
    2. Fine-tuned BERT: Domain-specific NER + intent classification
    3. LLM-based: Few-shot prompting with Phi-3/Llama-3 (flexible, higher latency)
    
    Recommended: Rule-based primary with LLM fallback for ambiguous cases.
    """
    
    INTENTS = [
        "route_vehicle",      # Proceed/taxi to destination
        "hold_position",      # Stop and wait
        "resume_movement",    # Continue after hold
        "give_way",           # Yield to specific traffic
        "speed_change",       # Speed up or slow down
        "emergency_stop",     # Immediate stop
        "emergency_clear",    # Clear area for emergency
        "information",        # Advisory, no action required
        "reroute",            # Change route
    ]
    
    ENTITIES = {
        "callsign": r"(?:tug|tractor|vehicle|gse)[\s-]?\d+",
        "destination": r"(?:stand|gate|apron|depot|pier)\s*[A-Z]?\d+",
        "route": r"(?:via\s+)?(?:service\s+road\s+)?(?:alpha|bravo|charlie|[A-Z])\d*",
        "boundary": r"(?:hold\s+short\s+of\s+)?(runway|taxiway|twy)\s*\d{0,2}[A-Z]?",
        "traffic": r"(?:aircraft|flight|heavy|(?:BA|LH|SK|AA)\d{3,4})",
        "vehicle_type": r"(?:fuel\s+truck|baggage\s+train|catering|pushback\s+tug)",
    }
    
    def __init__(self):
        self.intent_patterns = self._compile_intent_patterns()
        self.entity_extractors = {
            name: re.compile(pattern, re.IGNORECASE)
            for name, pattern in self.ENTITIES.items()
        }
    
    def parse(self, text):
        """Parse ground control instruction text.
        
        Returns:
            ParsedInstruction with intent, entities, confidence
        """
        text_lower = text.lower().strip()
        
        # Try rule-based parsing first
        for intent, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if pattern.search(text_lower):
                    entities = self._extract_entities(text)
                    return ParsedInstruction(
                        intent=intent,
                        entities=entities,
                        confidence=0.9,
                        method="rule_based",
                    )
        
        # Fallback to LLM
        return self._llm_parse(text)
    
    def _extract_entities(self, text):
        """Extract named entities from instruction text."""
        entities = {}
        for entity_name, extractor in self.entity_extractors.items():
            match = extractor.search(text)
            if match:
                entities[entity_name] = match.group(0)
        return entities
    
    def _llm_parse(self, text):
        """LLM fallback for ambiguous instructions."""
        prompt = f"""You are parsing an airport ground control radio instruction.
Extract the intent and entities.

Instruction: "{text}"

Intents: route_vehicle, hold_position, resume_movement, give_way, 
         speed_change, emergency_stop, emergency_clear, information, reroute

Respond as JSON:
{{"intent": "...", "entities": {{"callsign": "...", "destination": "...", ...}}, "ambiguous": true/false}}
"""
        response = self.llm.generate(prompt)
        parsed = json.loads(response)
        
        return ParsedInstruction(
            intent=parsed["intent"],
            entities=parsed.get("entities", {}),
            confidence=0.7 if not parsed.get("ambiguous") else 0.4,
            method="llm_fallback",
        )
```

### 7.3 Voice-to-Text for Ramp Radio

If the autonomous fleet needs to parse live radio:

| Component | Options | Latency | Accuracy |
|-----------|---------|---------|----------|
| **ASR (Speech-to-Text)** | Whisper-Large-V3, OpenAI API | 200-500ms | 95%+ (clean audio) |
| **Noise reduction** | RNNoise, NVIDIA Maxine | 10-20ms | +5-10% WER improvement |
| **Speaker diarization** | pyannote-audio | 100-300ms | Identify who is speaking |
| **Callsign extraction** | Custom NER on ASR output | 20-50ms | 90% with fine-tuning |

**Key challenge**: Airport ramp radio is extremely noisy (engine noise, wind, accents, non-standard phraseology). WER (Word Error Rate) for aviation radio ASR is typically 15-25% vs 5% for clean speech.

**Recommendation**: For initial deployment, do NOT parse live radio. Instead, use digital instruction proxy (Section 4.3) where ground controller submits structured commands via UI. Radio parsing is a Phase 3+ capability.

---

## 8. Instruction-to-Trajectory Mapping

### 8.1 From Instruction to Motion

```python
class InstructionToTrajectory:
    """Convert structured instructions into executable trajectories.
    
    Pipeline:
    1. Resolve destination/waypoints to map coordinates
    2. Compute route through airport graph
    3. Apply constraints (speed limits, hold points, NOTAMs)
    4. Generate smooth trajectory with Frenet/optimization
    5. Validate against safety constraints
    """
    
    def __init__(self, airport_map, route_planner, trajectory_optimizer):
        self.map = airport_map
        self.planner = route_planner
        self.optimizer = trajectory_optimizer
    
    def plan(self, instruction):
        """Convert instruction to executable trajectory."""
        
        if instruction.type == "PROCEED_TO_STAND":
            # Step 1: Resolve destination
            stand = self.map.get_stand(instruction.params["stand_id"])
            if stand is None:
                raise UnknownDestinationError(instruction.params["stand_id"])
            
            # Step 2: Compute route
            ego_position = self.get_current_position()
            
            if "via_route" in instruction.params:
                # Constrained route via specified service road
                via_segments = self.map.resolve_route_name(
                    instruction.params["via_route"]
                )
                route = self.planner.plan_via(
                    ego_position, stand.approach_point, via_segments
                )
            else:
                # Shortest/optimal route
                route = self.planner.plan_optimal(
                    ego_position, stand.approach_point
                )
            
            # Step 3: Apply constraints
            route = self._apply_notam_constraints(route)
            route = self._apply_speed_zones(route)
            
            # Step 4: Generate smooth trajectory
            trajectory = self.optimizer.optimize(
                route,
                max_speed=instruction.params.get("speed_limit_kmh", 15.0),
                comfort_decel=2.0,  # m/s^2
                max_lateral_accel=0.5,  # m/s^2 (comfort)
            )
            
            # Step 5: Validate
            violations = self._validate(trajectory)
            if violations:
                raise SafetyViolationError(violations)
            
            return trajectory
        
        elif instruction.type == "HOLD_POSITION":
            return StopTrajectory(
                position=self.get_current_position(),
                reason=instruction.params.get("reason", "instruction"),
                resume_condition=instruction.params.get("resume_condition"),
            )
        
        elif instruction.type == "GIVE_WAY":
            # Plan to yield: decelerate, stop if needed, resume when clear
            target = instruction.params.get("target_id")
            return YieldTrajectory(
                target_id=target,
                yield_point=self._compute_yield_point(target),
                resume_when_clear=True,
            )
    
    def _apply_notam_constraints(self, route):
        """Remove segments blocked by active NOTAMs."""
        blocked = self.notam_manager.get_blocked_segments()
        
        if any(seg in blocked for seg in route.segments):
            # Reroute around blocked segments
            alternative = self.planner.plan_avoiding(
                route.start, route.end, blocked
            )
            if alternative is None:
                raise NoRouteError(
                    f"Cannot reach destination — blocked by NOTAMs: "
                    f"{[self.notam_manager.get_notam(s) for s in blocked]}"
                )
            return alternative
        return route
    
    def _compute_yield_point(self, target_id):
        """Compute safe position to yield to target traffic."""
        target_track = self.tracker.get_track(target_id)
        if target_track is None:
            # Unknown target — stop at current position
            return self.get_current_position()
        
        # Predict target path and find intersection
        target_predicted = self.predictor.predict(target_track, horizon_sec=10)
        ego_route = self.current_route
        
        intersection = find_route_intersection(ego_route, target_predicted)
        if intersection:
            # Stop 5m before intersection point
            yield_point = offset_along_route(ego_route, intersection, -5.0)
            return yield_point
        else:
            # No intersection predicted — continue with caution
            return None  # No yield needed
```

### 8.2 Named Segment Resolution

Airport routes are communicated using named segments (taxiways, service roads). The AV must resolve these to map coordinates:

```python
class AirportRouteGraph:
    """Named airport route graph for instruction resolution."""
    
    def __init__(self, lanelet2_map, segment_names):
        self.map = lanelet2_map
        self.names = segment_names  # {"ALPHA": [lanelet_id_1, ...], ...}
        self.graph = self._build_graph()
    
    def resolve_route_name(self, name):
        """Resolve a route name like 'ALPHA' to map lanelets."""
        name_upper = name.upper()
        
        if name_upper in self.names:
            return self.names[name_upper]
        
        # Try fuzzy match (controller may use abbreviations)
        matches = [n for n in self.names if n.startswith(name_upper)]
        if len(matches) == 1:
            return self.names[matches[0]]
        
        raise UnknownRouteError(f"Cannot resolve route name '{name}'")
    
    def resolve_segment(self, segment_name):
        """Resolve segment name to geometric path."""
        lanelets = self.resolve_route_name(segment_name)
        points = []
        for ll_id in lanelets:
            lanelet = self.map.get_lanelet(ll_id)
            points.extend(lanelet.centerline)
        return RouteSegment(name=segment_name, points=points)
    
    def plan_via(self, start, end, via_segments):
        """Plan route from start to end via specified segments."""
        # Build constraint: route must pass through via_segments
        waypoints = [start]
        for seg_name in via_segments:
            seg = self.resolve_segment(seg_name)
            waypoints.append(seg.midpoint)
        waypoints.append(end)
        
        # Plan piecewise
        full_route = []
        for i in range(len(waypoints) - 1):
            sub_route = self._shortest_path(waypoints[i], waypoints[i+1])
            full_route.extend(sub_route)
        
        return Route(segments=full_route)
```

---

## 9. Ambiguity Resolution and Safety

### 9.1 Instruction Ambiguity Types

| Ambiguity | Example | Resolution |
|-----------|---------|------------|
| **Vague directive** | "Proceed with caution" | Reduce speed to 50% of limit, increase safety margins |
| **Unknown destination** | "Go to the holding area" (which one?) | Query fleet management for clarification, hold until resolved |
| **Conflicting instructions** | ATC says "proceed", marshaller signals "stop" | **STOP always wins** — conservative resolution |
| **Stale instruction** | Route via Alpha, but Alpha was just closed by NOTAM | Reject instruction, request reroute |
| **Implicit context** | "Hold for the heavy" (= wide-body aircraft) | Maintain aircraft type lookup, resolve implicit references |
| **Call-sign confusion** | Instruction intended for another vehicle | Verify call-sign match, ignore unmatched instructions |

### 9.2 Conflict Resolution Priority

When instructions from different sources conflict:

```python
INSTRUCTION_PRIORITY = {
    # Higher number = higher priority (overrides lower)
    "EMERGENCY_STOP": 100,       # Always highest — any source
    "ATC_GROUND": 90,            # ATC ground controller
    "MARSHALLER_STOP": 85,       # Marshaller stop signal
    "RAMP_CONTROL": 80,          # Ramp controller
    "SAFETY_SYSTEM": 75,         # Vehicle's own safety system
    "FLEET_MANAGEMENT": 60,      # Fleet management system
    "MARSHALLER_ADVISORY": 50,   # Marshaller advisory (not stop)
    "NOTAM_CONSTRAINT": 40,      # NOTAM routing constraint
    "ACDM_SCHEDULE": 20,         # A-CDM schedule data
    "DEFAULT_RULES": 10,         # Airport ground movement rules
}

class InstructionConflictResolver:
    """Resolve conflicts between simultaneous instructions."""
    
    def resolve(self, instructions):
        """Select highest-priority non-conflicting instruction set."""
        # Sort by priority
        sorted_instr = sorted(
            instructions, 
            key=lambda i: INSTRUCTION_PRIORITY.get(i.source, 0),
            reverse=True
        )
        
        result = []
        for instr in sorted_instr:
            if not self._conflicts_with(instr, result):
                result.append(instr)
            else:
                # Log conflict for review
                self.log_conflict(instr, result)
        
        # Safety rule: if any STOP is present, vehicle stops
        if any(i.type in ("HOLD_POSITION", "EMERGENCY_STOP") for i in result):
            return [next(i for i in result 
                        if i.type in ("HOLD_POSITION", "EMERGENCY_STOP"))]
        
        return result
    
    def _conflicts_with(self, new_instr, existing):
        """Check if new instruction conflicts with existing set."""
        for existing_instr in existing:
            # Movement + Stop = conflict
            if (new_instr.type in ("PROCEED_TO_STAND", "RESUME") and 
                existing_instr.type in ("HOLD_POSITION", "EMERGENCY_STOP")):
                return True
            # Different destinations = conflict
            if (new_instr.type == "PROCEED_TO_STAND" and 
                existing_instr.type == "PROCEED_TO_STAND" and
                new_instr.params.get("stand_id") != existing_instr.params.get("stand_id")):
                return True
        return False
```

### 9.3 Safety Rules

1. **STOP is always safe**: When uncertain, stop. False stops cost time; false proceeds risk collision.
2. **Confirmation required**: High-impact instructions (cross taxiway, enter restricted area) require confirmation from fleet management.
3. **Confidence threshold**: Instructions with confidence < 0.7 are logged but not executed without human confirmation.
4. **Timeout**: If no valid instruction received within 60 seconds, vehicle requests re-instruction via fleet management.
5. **Geofence override**: No instruction can override hard geofences (runway boundary, ILS critical area).

---

## 10. Multi-Instruction Sequencing

### 10.1 Turnaround Instruction Sequence

During an aircraft turnaround, a GSE vehicle may receive 10+ instructions over 30-90 minutes:

```python
class MissionSequencer:
    """Manage multi-instruction mission sequences."""
    
    def __init__(self):
        self.instruction_queue = []
        self.current_instruction = None
        self.completed = []
        self.state = "IDLE"
    
    def enqueue(self, instruction, priority="NORMAL"):
        """Add instruction to execution queue."""
        entry = {
            "instruction": instruction,
            "priority": priority,
            "enqueued_at": datetime.utcnow(),
            "status": "PENDING",
        }
        
        if priority == "IMMEDIATE":
            # Preempt current instruction
            if self.current_instruction:
                self.current_instruction["status"] = "PREEMPTED"
                self.instruction_queue.insert(0, self.current_instruction)
            self.current_instruction = entry
            self.current_instruction["status"] = "EXECUTING"
        else:
            self.instruction_queue.append(entry)
            self.instruction_queue.sort(
                key=lambda x: {"CRITICAL": 0, "HIGH": 1, "NORMAL": 2, "LOW": 3}[x["priority"]]
            )
    
    def advance(self):
        """Move to next instruction after current completes."""
        if self.current_instruction:
            self.current_instruction["status"] = "COMPLETED"
            self.completed.append(self.current_instruction)
        
        if self.instruction_queue:
            self.current_instruction = self.instruction_queue.pop(0)
            self.current_instruction["status"] = "EXECUTING"
            return self.current_instruction["instruction"]
        else:
            self.current_instruction = None
            self.state = "IDLE"
            return None
    
    def get_status(self):
        """Mission status for fleet management dashboard."""
        return {
            "state": self.state,
            "current": self.current_instruction,
            "queue_depth": len(self.instruction_queue),
            "completed_count": len(self.completed),
            "next_instruction": self.instruction_queue[0] if self.instruction_queue else None,
        }
```

### 10.2 Example Turnaround Sequence

```
Time  Instruction                          Source          Priority
────  ─────────────────────────────────── ──────────────  ────────
T+0   PROCEED_TO_STAND B14 via ALPHA      Fleet/A-CDM     NORMAL
T+3   HOLD_POSITION (aircraft landing)    Ramp Control    HIGH
T+5   RESUME                              Ramp Control    NORMAL
T+8   APPROACH_STAND B14 (5 km/h)         Fleet/proximity NORMAL
T+10  STOP_AT_LOADING_POSITION            Fleet/auto      NORMAL
T+12  WAIT_FOR_LOADING (belt loader rdy)  Fleet/turnaround NORMAL
T+35  DEPART_STAND B14 via exit           Fleet/loading done NORMAL
T+37  HOLD_POSITION (pushback Stand B12)  Ramp Control    HIGH
T+40  RESUME                              Ramp Control    NORMAL
T+42  PROCEED_TO_TERMINAL_BELT            Fleet/A-CDM     NORMAL
T+50  RETURN_TO_STAND B14 (outbound bag)  Fleet/A-CDM     NORMAL
T+55  CLEAR_STAND B14 (TOBT - 5 min)     Fleet/A-CDM     HIGH
T+57  PROCEED_TO_DEPOT                    Fleet/end shift  LOW
```

---

## 11. System Architecture

### 11.1 Full Instruction Processing Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    EXTERNAL DATA SOURCES                     │
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│ A-CDM    │ A-SMGCS  │ NOTAM    │ Radio    │ Marshallers    │
│ (AIDX)   │ (tracks) │ (FAA API)│ (voice)  │ (visual)       │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬───────────┘
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
┌────────────────────────────────────────────────────────────┐
│              INSTRUCTION PROCESSING LAYER                    │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │ A-CDM    │ │ A-SMGCS  │ │ NOTAM    │ │ Gesture      │   │
│  │ Processor│ │ Interface│ │ Parser   │ │ Recognizer   │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘   │
│       │            │            │               │           │
│       └──────┬─────┴──────┬─────┴───────┬───────┘           │
│              ▼            ▼             ▼                    │
│  ┌──────────────────────────────────────────────────┐       │
│  │         INSTRUCTION FUSION & CONFLICT RESOLVER    │       │
│  │  - Priority-based resolution                      │       │
│  │  - Ambiguity detection                            │       │
│  │  - Safety validation                              │       │
│  └──────────────────┬───────────────────────────────┘       │
│                     │                                        │
└─────────────────────┼────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────────┐
│                MISSION EXECUTION LAYER                       │
│                                                              │
│  ┌────────────────┐    ┌────────────────┐                   │
│  │ Mission        │───▶│ Instruction-to-│                   │
│  │ Sequencer      │    │ Trajectory     │                   │
│  └────────────────┘    └───────┬────────┘                   │
│                                │                            │
│                                ▼                            │
│  ┌─────────────────────────────────────────┐               │
│  │        SIMPLEX SAFETY ARCHITECTURE       │               │
│  │                                          │               │
│  │  AC: Neural Planner  │  BC: Frenet      │               │
│  │  (instruction-aware)  │  (safe fallback) │               │
│  └──────────┬────────────┴────────┬────────┘               │
│             │                     │                         │
│             └──────────┬──────────┘                         │
│                        ▼                                    │
│              ACTUATOR COMMANDS                              │
│              (steer, brake, throttle)                       │
└────────────────────────────────────────────────────────────┘
```

### 11.2 ROS Integration

```python
# ROS topic structure for instruction processing

TOPICS = {
    # Input topics
    "/fleet/mission_assignment": "fleet_msgs/MissionAssignment",
    "/acdm/flight_events": "acdm_msgs/FlightEvent",
    "/notam/active_constraints": "notam_msgs/ConstraintArray",
    "/asmgcs/surface_tracks": "asmgcs_msgs/SurfaceTrackArray",
    "/asmgcs/conflict_alerts": "asmgcs_msgs/ConflictAlert",
    "/perception/marshaller_gesture": "gesture_msgs/GestureResult",
    
    # Output topics
    "/mission/current_instruction": "mission_msgs/Instruction",
    "/mission/execution_status": "mission_msgs/ExecutionStatus",
    "/planning/route_request": "planning_msgs/RouteRequest",
    "/vehicle/position_report": "vehicle_msgs/PositionReport",
    
    # Safety topics
    "/safety/instruction_conflict": "safety_msgs/InstructionConflict",
    "/safety/notam_violation": "safety_msgs/NOTAMViolation",
    "/safety/geofence_status": "safety_msgs/GeofenceStatus",
}
```

---

## 12. Practical Implementation

### 12.1 Phased Deployment

| Phase | Capability | Timeline | Cost |
|-------|-----------|----------|------|
| **Phase 1** | Digital fleet management (structured commands only) | 0-6 months | $30-50K |
| **Phase 2** | NOTAM parsing + automatic rerouting | 3-9 months | $20-30K |
| **Phase 3** | A-CDM integration (turnaround-aware scheduling) | 6-12 months | $40-60K |
| **Phase 4** | Marshaller gesture recognition (basic: stop/proceed) | 12-18 months | $30-50K |
| **Phase 5** | A-SMGCS integration (airport-dependent) | 18-36 months | $50-100K |
| **Phase 6** | Voice radio parsing (if needed) | 24-36 months | $40-80K |

### 12.2 Data Requirements

| Component | Training Data | Collection Method |
|-----------|--------------|------------------|
| NOTAM parser | 5,000+ annotated NOTAMs | FAA API historical data (free) |
| Gesture recognition | 500-1,000 sequences per class | Fleet capture + synthetic |
| NLU for ground control | 10,000+ annotated utterances | Airport radio recordings + synthetic |
| Route name resolution | Airport-specific segment naming | Airport operations manual + map survey |

### 12.3 Current Competitor Approach

| Company | Instruction Handling | Limitation |
|---------|---------------------|------------|
| **UISEE (Changi)** | Proprietary integration with AeroDCS | Airport-specific, not portable |
| **TractEasy** | Pre-mapped routes, human ramp liaison | Cannot handle dynamic rerouting |
| **AeroVect** | API-based mission dispatch | No ATC/NOTAM integration |
| **Aurrigo** | Human operator receives and executes instructions | No autonomous instruction handling |

### 12.4 Key Differentiators

Building full instruction understanding provides:

1. **Unattended operations**: No human needed to interpret controller instructions
2. **Dynamic rerouting**: Automatic response to NOTAMs, pushbacks, emergencies
3. **Turnaround optimization**: A-CDM-aware scheduling reduces wait times
4. **Multi-airport portability**: Standardized instruction parsing works across airports
5. **Safety evidence**: Explicit instruction tracing for certification (who said what, when, how vehicle responded)

---

## References

### Standards and Regulations
- ICAO Annex 2, Appendix 1 — Marshalling signals
- ICAO Doc 4444 — Air Traffic Management (ground movement procedures)
- ICAO Doc 9694 — Manual of Air Traffic Services Data Link Applications
- EUROCONTROL A-SMGCS Implementation Guidelines
- EUROCONTROL SWIM Technical Infrastructure
- FAA CertAlert 24-02 — Autonomous Ground Vehicles
- IATA AHM 908 — Airport Handling Manual
- ISO 3691-4:2023 — Driverless industrial trucks

### Technical References
- CPDLC Message Set (ICAO Doc 4444, Chapter 14)
- AIDX (IATA Airport Information Data Exchange)
- ACRIS (Airport Community Recommended Information Services)
- AIXM 5.1.1 (Aeronautical Information Exchange Model)
- D-TAXI EUROCONTROL trials documentation
- ASAM OpenSCENARIO (scenario description for testing)

### Related Repository Documents
- `operations/airside/airport-data-systems-detailed.md` — API endpoints for NOTAM, AIDX, ACRIS
- `operations/airside/turnaround-prediction.md` — Turnaround phase model
- `30-autonomy-stack/localization-mapping/maps/hd-map-standards-airside.md` — AMDB/Lanelet2 for route graphs
- `operations/safety/airside-scenario-taxonomy.md` — Scenario catalog including instruction failures
- `30-autonomy-stack/vla-vlm/vlm-scene-understanding.md` — VLM for NOTAM interpretation
- `operations/deployment/fleet-management-dispatch.md` — Fleet dispatch architecture
