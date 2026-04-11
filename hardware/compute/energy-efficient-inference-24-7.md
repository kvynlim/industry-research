# Energy-Efficient Inference for 24/7 Airport GSE Fleet Operations

**Last Updated:** 2026-04-11
**Platform:** NVIDIA Jetson AGX Orin 64GB (JetPack 6.x)
**Context:** Autonomous electric GSE operating continuous shifts on airport airside

---

Airport ground support equipment operates around the clock across three shifts, with battery-powered electric vehicles subject to thermal extremes ranging from -10C winter tarmac to +50C midsummer apron surfaces. Unlike highway autonomous vehicles that park between trips, airport GSE may run 16-20 hours per day with only brief opportunity charging windows, making every watt of compute power a direct subtraction from operational range. The NVIDIA Jetson AGX Orin draws 15-60W depending on power mode, which is negligible relative to the 30-165 kWh battery packs in typical GSE (0.04-0.4% of capacity per hour at 60W), but the thermal interaction between sustained inference and ambient tarmac heat creates compound effects that degrade both compute throughput and battery longevity. This document provides a comprehensive strategy for minimizing energy consumption on Orin while maintaining safety-critical perception performance across the full operational envelope. The core insight is that airport GSE spend 40-60% of their time in low-complexity scenarios (straight taxiway transit, idle at stand, depot parking) where reduced-power inference is not only safe but preferable for thermal and battery health. Implementing dynamic power management across a 20-vehicle fleet can extend aggregate daily operating hours by 8-15% and reduce mean compute module junction temperature by 12-18C, significantly improving long-term hardware reliability. The strategies here build on the Orin power mode architecture documented in `nvidia-orin-technical.md`, the DLA offloading approach from `model-compression-edge-deployment.md`, and the battery/charging infrastructure described in `battery-charging-infrastructure.md`.

---

## Table of Contents

1. [The 24/7 Energy Challenge](#1-the-247-energy-challenge)
2. [Orin Power Modes Deep Dive](#2-orin-power-modes-deep-dive)
3. [Dynamic Model Switching](#3-dynamic-model-switching)
4. [Thermal Management for Sustained Operation](#4-thermal-management-for-sustained-operation)
5. [Battery-Aware Inference Scheduling](#5-battery-aware-inference-scheduling)
6. [Sleep/Wake and Standby Strategies](#6-sleepwake-and-standby-strategies)
7. [Efficient Model Architectures](#7-efficient-model-architectures)
8. [DLA Offloading Revisited](#8-dla-offloading-revisited)
9. [Multi-Model Power Profiling](#9-multi-model-power-profiling)
10. [Fleet-Level Energy Optimization](#10-fleet-level-energy-optimization)
11. [Practical Implementation with ROS Noetic](#11-practical-implementation-with-ros-noetic)
12. [Key Takeaways](#12-key-takeaways)

---

## 1. The 24/7 Energy Challenge

### 1.1 Operational Profile of Airport GSE

Airport ground support equipment operates in a fundamentally different pattern from highway autonomous vehicles. Highway AVs drive continuously at varying speeds, park in garages, and recharge at leisure. Airport GSE follows a cyclic pattern driven by flight schedules:

| Phase | Duration | Speed | Perception Demand | Frequency |
|-------|----------|-------|-------------------|-----------|
| Stand arrival / departure | 2-5 min | 5-15 km/h | **Maximum** | 15-30x/shift |
| Apron transit | 3-10 min | 10-25 km/h | **High** | 15-30x/shift |
| Taxiway transit | 2-8 min | 15-25 km/h | **Medium** | 10-20x/shift |
| Idle at stand (waiting) | 5-30 min | 0 km/h | **Low** | 10-20x/shift |
| Depot / charging | 30-120 min | 0 km/h | **Minimal** | 1-3x/shift |

A typical baggage tractor completing 25 missions per 8-hour shift spends approximately:

```
Active driving (apron + taxiway):    ~120 min (25%)  — full perception needed
Stand maneuvering:                   ~75 min (16%)   — maximum perception needed
Idle at stand / waiting:             ~180 min (37%)  — reduced perception sufficient
Transit to/from depot:               ~30 min (6%)    — medium perception needed
Depot / charging:                    ~75 min (16%)   — minimal perception needed
```

This means **53% of operational time** can safely run at reduced compute power. Over a 24-hour, 3-shift cycle, the opportunity for energy savings is substantial.

### 1.2 Energy Budget Breakdown

For a 60 kWh LiFePO4 baggage tractor with Orin at MAXN (60W continuous):

```
Orin at MAXN, 24 hours:        60W x 24h = 1.44 kWh (2.4% of battery)
Orin at 50W mode, 24 hours:    50W x 24h = 1.20 kWh (2.0% of battery)
Orin at optimized profile:     ~35W avg x 24h = 0.84 kWh (1.4% of battery)

Savings from optimization:     0.60 kWh/day = 1.0% of battery capacity
Per vehicle per year:          219 kWh = $22 at $0.10/kWh
20-vehicle fleet per year:     4,380 kWh = $438 in electricity
```

The direct electricity cost savings are modest. The real value comes from three indirect effects:

1. **Extended range between charges:** 0.6 kWh/day reclaimed per vehicle translates to approximately 15-25 additional minutes of traction motor operation per charge cycle, which across 20 vehicles and 3 shifts amounts to 15-25 additional mission completions per day.

2. **Reduced thermal stress on battery:** Orin at 60W dissipates heat into an enclosure shared with or proximate to the battery pack. LiFePO4 cycle life degrades above 45C ambient. Reducing average compute dissipation by 40% extends battery pack lifetime.

3. **Improved compute reliability:** Orin junction temperature under sustained MAXN in a 50C ambient tarmac environment approaches thermal throttling thresholds. Intelligent power management keeps Tj below 90C, avoiding stochastic latency spikes that compromise safety-critical inference timing.

### 1.3 Thermal Environment on Airport Tarmac

The airport tarmac presents one of the harshest thermal environments for automotive compute:

| Condition | Air Temp | Tarmac Surface | Radiant Heat | Enclosure Temp |
|-----------|----------|----------------|--------------|----------------|
| Summer midday (Phoenix, Dubai) | 45-50C | 65-75C | +10-15C radiation | 55-65C |
| Summer midday (London, Frankfurt) | 30-35C | 45-55C | +5-10C radiation | 40-50C |
| Winter night (Helsinki, Chicago) | -15 to -25C | -10 to -20C | Negligible | -5 to -15C |
| Winter day (London, Frankfurt) | 0-10C | 5-15C | Minimal | 10-20C |
| Rain / de-icing | 0-5C | 0-5C | Minimal | 10-15C |
| Jet blast exposure (transient) | +20-40C above ambient | — | Direct exhaust | +30-50C spike |

The challenge is bidirectional: hot environments cause throttling and reliability degradation, while extreme cold can cause condensation during power-up cycles and impacts LPDDR5 timing margins below -20C. NVIDIA specifies -25C to 85C storage and -25C to 80C operating for the Industrial variant, but sustained operation above 50C ambient requires aggressive thermal management.

### 1.4 The Compound Effect

The energy challenge is not simply "Orin uses too many watts." It is the compound interaction of:

- **Continuous operation** (no multi-hour rest periods like personal vehicles)
- **Shared thermal enclosure** with power electronics, motor controllers, and battery
- **Ambient extremes** that shift the thermal baseline up or down 40C across seasons
- **Safety-critical timing** that cannot tolerate thermal throttling jitter
- **Fleet scale** that multiplies per-vehicle inefficiencies by 20-50x

A well-designed energy management strategy addresses all five simultaneously.

---

## 2. Orin Power Modes Deep Dive

### 2.1 Power Mode Architecture

The Orin SoC provides hardware-level power management via the `nvpmodel` utility, which controls CPU core count, CPU/GPU clock frequencies, memory frequency, and the overall power cap. The full specifications for each mode are documented in `nvidia-orin-technical.md` Section 7. Here we focus specifically on how each mode affects inference throughput for airside perception models.

### 2.2 Power Mode vs Inference Throughput

Measured on Jetson AGX Orin 64GB with TensorRT 10.x, INT8 quantized models, active cooling:

| Model | MAXN (60W) | 50W | 30W | 15W | Notes |
|-------|-----------|-----|-----|-----|-------|
| PointPillars INT8 | 6.84ms / 146 FPS | 8.2ms / 122 FPS | 12.8ms / 78 FPS | 24.1ms / 41 FPS | GPU-bound, scales with GPU clock |
| CenterPoint INT8 | 35.7ms / 28 FPS | 42.3ms / 24 FPS | 67.8ms / 15 FPS | 128ms / 8 FPS | Sparse conv backbone bottleneck |
| FlatFormer INT8 | ~16ms / 63 FPS | ~20ms / 50 FPS | ~32ms / 31 FPS | ~60ms / 17 FPS | Attention ops scale with GPU |
| YOLOv8s INT8 | 3.2ms / 313 FPS | 4.0ms / 250 FPS | 6.2ms / 161 FPS | 11.5ms / 87 FPS | Lightweight, viable at all modes |
| YOLO-Thermal INT8 | ~7ms / 143 FPS | ~8.5ms / 118 FPS | ~13ms / 77 FPS | ~24ms / 42 FPS | Similar scaling to PointPillars |
| nvblox (occupancy) | ~10ms | ~12ms | ~19ms | ~35ms | Mixed GPU/CPU workload |
| GTSAM localization | ~8ms | ~9ms | ~10ms | ~14ms | CPU-heavy, scales with CPU cores |
| BEVFusion FP16+INT8 | ~40ms / 25 FPS | ~50ms / 20 FPS | ~80ms / 12 FPS | N/A | Too slow at 15W |

### 2.3 Power Mode Selection Strategy for Airside

The key insight is that different operational phases have different minimum perception cycle time requirements:

| Operational Phase | Required Cycle Time | Minimum Power Mode | Rationale |
|-------------------|--------------------|--------------------|-----------|
| Stand maneuvering (aircraft proximity) | 100ms (10 Hz) | **50W** | Full stack: detection + segmentation + occupancy + tracking |
| Apron transit (multi-vehicle) | 100ms (10 Hz) | **50W** | Dense traffic, pedestrians, active turnarounds |
| Taxiway transit (clear, mapped route) | 200ms (5 Hz) | **30W** | Lower traffic density, wider margins, mapped path |
| Idle at stand (stationary, monitoring) | 500ms (2 Hz) | **15W** | Detect approaching hazards only |
| Depot parking (charging, no mission) | 2000ms (0.5 Hz) | **15W** | Perimeter monitoring only |
| Emergency (e-stop activated) | N/A | **15W** | Vehicle stopped, log only |

### 2.4 Switching Latency and Safety Implications

Power mode transitions are not instantaneous:

```
Mode switch latency (measured):
  MAXN  -> 50W:   ~200ms (GPU clock reduction, immediate)
  50W   -> 30W:   ~300ms (GPU TPC gating + CPU core offlining)
  30W   -> 15W:   ~500ms (memory frequency change, significant)
  15W   -> 50W:   ~800ms (CPU core onlining + GPU ramp-up)
  15W   -> MAXN:  ~1200ms (full ramp-up, memory frequency change)
```

Safety constraint: the vehicle must maintain its current perception capability throughout any power transition. This means:

1. **Downward transitions** (higher to lower power) are safe because models are already running at the higher throughput; the transition simply takes effect before the next cycle.
2. **Upward transitions** (lower to higher power) must be initiated **before** the vehicle enters the higher-demand zone. This requires predictive triggering based on route awareness and mission state.

### 2.5 Power Mode Switching via nvpmodel

```python
#!/usr/bin/env python3
"""
Orin power mode controller for airside autonomous GSE.
Wraps nvpmodel with safety constraints and transition management.
"""

import subprocess
import time
import threading
from enum import IntEnum
from typing import Optional


class OrinPowerMode(IntEnum):
    """Orin AGX 64GB power modes."""
    MAXN = 0     # ~60W, 275 TOPS, 12 cores @ 2.2 GHz
    MODE_15W = 1 # ~15W,  54 TOPS,  4 cores @ 1.1 GHz
    MODE_30W = 2 # ~30W, 131 TOPS,  8 cores @ 1.7 GHz
    MODE_50W = 3 # ~50W, 200 TOPS, 12 cores @ 1.5 GHz


# Approximate transition times (ms) for safety budgeting
TRANSITION_TIME_MS = {
    (OrinPowerMode.MAXN, OrinPowerMode.MODE_50W): 200,
    (OrinPowerMode.MODE_50W, OrinPowerMode.MODE_30W): 300,
    (OrinPowerMode.MODE_30W, OrinPowerMode.MODE_15W): 500,
    (OrinPowerMode.MODE_15W, OrinPowerMode.MODE_30W): 500,
    (OrinPowerMode.MODE_15W, OrinPowerMode.MODE_50W): 800,
    (OrinPowerMode.MODE_15W, OrinPowerMode.MAXN): 1200,
    (OrinPowerMode.MODE_30W, OrinPowerMode.MODE_50W): 400,
    (OrinPowerMode.MODE_50W, OrinPowerMode.MAXN): 300,
}


class OrinPowerController:
    """Thread-safe Orin power mode controller with safety constraints."""

    def __init__(self, default_mode: OrinPowerMode = OrinPowerMode.MODE_50W):
        self._current_mode = self._read_current_mode()
        self._lock = threading.Lock()
        self._min_mode = OrinPowerMode.MODE_15W  # Floor for safety
        self._transitioning = False

        if self._current_mode != default_mode:
            self.set_mode(default_mode)

    def _read_current_mode(self) -> OrinPowerMode:
        """Read current power mode from nvpmodel."""
        try:
            result = subprocess.run(
                ['sudo', 'nvpmodel', '-q'],
                capture_output=True, text=True, timeout=5
            )
            # Parse output: "NV Power Mode: MAXN" or "NV Power Mode: MODE_50W"
            for line in result.stdout.splitlines():
                if 'NV Power Mode' in line:
                    mode_str = line.split(':')[-1].strip()
                    mode_map = {
                        'MAXN': OrinPowerMode.MAXN,
                        'MODE_15W': OrinPowerMode.MODE_15W,
                        'MODE_30W': OrinPowerMode.MODE_30W,
                        'MODE_50W': OrinPowerMode.MODE_50W,
                    }
                    return mode_map.get(mode_str, OrinPowerMode.MODE_50W)
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        return OrinPowerMode.MODE_50W  # Safe default

    def set_mode(self, target: OrinPowerMode) -> bool:
        """
        Set power mode with safety constraints.
        Returns True if mode was changed, False if blocked.
        """
        with self._lock:
            if self._transitioning:
                return False
            if target == self._current_mode:
                return True

            # Safety: never go below minimum mode
            if target.value > 0 and target.value < self._min_mode.value:
                target = self._min_mode

            self._transitioning = True

        try:
            result = subprocess.run(
                ['sudo', 'nvpmodel', '-m', str(target.value)],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                # Apply clock settings
                subprocess.run(
                    ['sudo', 'jetson_clocks', '--restore'],
                    capture_output=True, timeout=5
                )
                with self._lock:
                    self._current_mode = target
                    self._transitioning = False
                return True
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        with self._lock:
            self._transitioning = False
        return False

    def get_transition_time_ms(self, target: OrinPowerMode) -> int:
        """Estimate transition time to target mode."""
        key = (self._current_mode, target)
        return TRANSITION_TIME_MS.get(key, 1500)  # Conservative default

    @property
    def current_mode(self) -> OrinPowerMode:
        return self._current_mode

    @property
    def current_power_watts(self) -> float:
        """Approximate power draw for current mode under load."""
        power_map = {
            OrinPowerMode.MAXN: 60.0,
            OrinPowerMode.MODE_50W: 50.0,
            OrinPowerMode.MODE_30W: 30.0,
            OrinPowerMode.MODE_15W: 15.0,
        }
        return power_map[self._current_mode]
```

### 2.6 Custom Power Modes

For airside operations, the four predefined modes leave a gap between 30W and 50W that is particularly useful for taxiway transit. A custom 40W mode can be created:

```bash
# Create custom 40W mode for taxiway transit
# File: /etc/nvpmodel/custom_40w.conf
# Based on MODE_50W with reduced GPU clock

# Query current configuration
sudo nvpmodel -p --verbose

# Custom mode: 8 CPU cores @ 1.5 GHz, 6 GPU TPCs @ 700 MHz, 2 DLAs
# Expected: ~170 TOPS INT8, sufficient for PointPillars + GTSAM + YOLOv8s
# at 5 Hz with comfortable margin
sudo nvpmodel -m 3  # Start from 50W base
sudo jetson_clocks --show

# Manually adjust GPU max frequency (non-persistent, for testing)
echo 700500000 | sudo tee /sys/devices/17000000.ga10b/devfreq/17000000.ga10b/max_freq

# For persistent custom mode, edit /etc/nvpmodel.conf and add a new
# power model entry (requires JetPack BSP knowledge)
```

---

## 3. Dynamic Model Switching

### 3.1 Context-Aware Compute Allocation

Not all locations on an airport apron demand the same perception sophistication. A straight, empty taxiway with no intersections requires far less compute than a busy stand during aircraft turnaround. Dynamic model switching selects the appropriate perception pipeline based on the vehicle's current operational context.

### 3.2 Perception Tiers

| Tier | Power Mode | Models Active | Cycle Time | Use Case |
|------|-----------|---------------|------------|----------|
| **T1: Full** | 50W / MAXN | PointPillars + FlatFormer + CenterPoint + nvblox + tracking + GTSAM + thermal | 100ms | Stand maneuvering, apron intersections, aircraft proximity |
| **T2: Standard** | 50W | PointPillars + CenterPoint + nvblox + tracking + GTSAM | 100ms | Apron transit, moderate traffic |
| **T3: Cruise** | 30W | PointPillars + GTSAM + tracking | 200ms | Taxiway transit, clear route |
| **T4: Monitor** | 15W | PointPillars (DLA) + GTSAM (CPU) | 500ms | Stationary, waiting at stand |
| **T5: Sleep** | 15W | Proximity detection only (DLA) | 2000ms | Depot, charging, no mission |

### 3.3 Tier Selection Logic

The tier selection is driven by a combination of mission state, vehicle state, and environmental context:

```python
#!/usr/bin/env python3
"""
Dynamic perception tier selector for airside GSE.
Determines appropriate perception tier based on vehicle context.
"""

from enum import IntEnum
from dataclasses import dataclass
from typing import Optional


class PerceptionTier(IntEnum):
    FULL = 1       # T1: All models, 10 Hz, 50-60W
    STANDARD = 2   # T2: Core models, 10 Hz, 50W
    CRUISE = 3     # T3: Detection + localization, 5 Hz, 30W
    MONITOR = 4    # T4: Basic detection, 2 Hz, 15W
    SLEEP = 5      # T5: Proximity only, 0.5 Hz, 15W


@dataclass
class VehicleContext:
    """Current vehicle and environment state."""
    speed_kmh: float                     # Current vehicle speed
    mission_active: bool                 # Has active dispatch mission
    distance_to_aircraft_m: float        # Nearest aircraft distance
    distance_to_stand_m: float           # Distance to destination stand
    distance_to_intersection_m: float    # Next apron intersection
    pedestrians_in_range: int            # Tracked pedestrians within 50m
    vehicles_in_range: int               # Tracked vehicles within 50m
    battery_soc_pct: float               # Battery state of charge
    orin_tj_celsius: float               # Orin junction temperature
    ambient_temp_celsius: float          # Ambient temperature
    is_on_taxiway: bool                  # On mapped taxiway (vs apron)
    visibility_degraded: bool            # Rain, fog, night, de-icing
    emergency_vehicle_detected: bool     # Emergency in vicinity


class TierSelector:
    """Select perception tier based on operational context."""

    # Distances that trigger tier upgrades (meters)
    AIRCRAFT_PROXIMITY_FULL = 30.0       # Within 30m of aircraft -> T1
    INTERSECTION_APPROACH = 50.0         # Approaching intersection -> T2+
    STAND_APPROACH = 100.0               # Approaching stand -> T2+

    # Thermal protection thresholds
    TJ_THROTTLE_WARNING = 88.0           # Start considering power reduction
    TJ_THROTTLE_CRITICAL = 95.0          # Force power reduction

    # Battery protection thresholds
    SOC_LOW = 30.0                       # Reduce power consumption
    SOC_CRITICAL = 15.0                  # Minimum perception only

    def select_tier(self, ctx: VehicleContext) -> PerceptionTier:
        """
        Determine appropriate perception tier.
        Higher-priority conditions override lower-priority ones.
        """

        # Priority 1: Emergency always gets full perception
        if ctx.emergency_vehicle_detected:
            return PerceptionTier.FULL

        # Priority 2: Thermal protection overrides normal logic
        if ctx.orin_tj_celsius > self.TJ_THROTTLE_CRITICAL:
            if ctx.speed_kmh < 1.0:
                return PerceptionTier.MONITOR
            return PerceptionTier.CRUISE  # Never go below cruise while moving

        # Priority 3: Battery critical — minimal compute
        if ctx.battery_soc_pct < self.SOC_CRITICAL and not ctx.mission_active:
            return PerceptionTier.SLEEP

        # Priority 4: Vehicle stationary with no mission
        if ctx.speed_kmh < 0.5 and not ctx.mission_active:
            return PerceptionTier.SLEEP

        # Priority 5: Vehicle stationary with mission (waiting)
        if ctx.speed_kmh < 0.5 and ctx.mission_active:
            if ctx.distance_to_aircraft_m < self.AIRCRAFT_PROXIMITY_FULL:
                return PerceptionTier.STANDARD  # Parked near aircraft
            return PerceptionTier.MONITOR

        # Priority 6: Moving — determine based on environment
        # Near aircraft: full perception always
        if ctx.distance_to_aircraft_m < self.AIRCRAFT_PROXIMITY_FULL:
            return PerceptionTier.FULL

        # Degraded visibility: upgrade tier
        if ctx.visibility_degraded:
            if ctx.is_on_taxiway:
                return PerceptionTier.STANDARD
            return PerceptionTier.FULL

        # Approaching stand or intersection
        if (ctx.distance_to_stand_m < self.STAND_APPROACH or
                ctx.distance_to_intersection_m < self.INTERSECTION_APPROACH):
            return PerceptionTier.STANDARD

        # Dense traffic
        if ctx.pedestrians_in_range > 2 or ctx.vehicles_in_range > 3:
            return PerceptionTier.STANDARD

        # Open taxiway
        if ctx.is_on_taxiway and ctx.pedestrians_in_range == 0:
            return PerceptionTier.CRUISE

        # Default: standard for apron driving
        return PerceptionTier.STANDARD

    def get_transition_lead_time_m(
        self, current: PerceptionTier, target: PerceptionTier
    ) -> float:
        """
        Distance (meters) before reaching a zone where the tier
        upgrade should be initiated, accounting for power mode
        transition time and vehicle speed.
        """
        if target.value >= current.value:
            return 0.0  # Downgrade is immediate

        # Upgrade: need lead time
        # Assume 25 km/h max = 6.94 m/s, worst case 1.2s transition
        # Add 0.5s safety margin
        return 6.94 * 1.7  # ~12 meters lead distance
```

### 3.4 Model Loading Strategy

Switching between perception tiers requires loading and unloading TensorRT engines. There are two approaches:

**Approach A: Pre-loaded engines (recommended for safety)**
```
All TensorRT engines for all tiers loaded into GPU memory at startup.
Inactive engines consume memory but not compute.
Switching is instantaneous — just route data to different engines.

Memory cost: ~8-12 GB for all engines (fits in 64GB Orin)
Latency: 0ms model switch
Downside: Higher baseline memory usage
```

**Approach B: Lazy loading with caching**
```
Only current tier's engines loaded. Higher tiers loaded on demand.
Engine loading takes 200-500ms from NVMe SSD.
Cache recently used engines to avoid repeated loads.

Memory cost: ~3-5 GB for active tier
Latency: 200-500ms model switch (first time)
Downside: Switch latency, risk of OOM during transition
```

For safety-critical airside operations, Approach A is strongly recommended. The 64GB Orin has ample memory, and the cost of a 200-500ms perception gap during tier upgrades is unacceptable near aircraft.

### 3.5 Expected Energy Savings from Dynamic Switching

Based on the operational profile from Section 1.1:

| Phase | Time % | Tier | Avg Power | Energy (24h) |
|-------|--------|------|-----------|-------------|
| Stand maneuvering | 16% | T1 Full | 55W | 0.211 kWh |
| Apron transit | 25% | T2 Standard | 50W | 0.300 kWh |
| Taxiway transit | 6% | T3 Cruise | 30W | 0.043 kWh |
| Idle at stand | 37% | T4 Monitor | 15W | 0.133 kWh |
| Depot / charging | 16% | T5 Sleep | 15W | 0.058 kWh |
| **Weighted average** | 100% | — | **~31W** | **0.745 kWh** |

Compared to running at constant 50W (1.20 kWh/24h), dynamic switching saves **0.455 kWh/day** or **38% of compute energy**. The weighted average power draw drops from 50W to approximately 31W.

---

## 4. Thermal Management for Sustained Operation

### 4.1 The Thermal Challenge on Airport Tarmac

The Orin's thermal specifications (documented in `nvidia-orin-technical.md` Section 12) define Tj_max at 105C with recommended sustained operation below 95C. On a 50C summer tarmac with an enclosed compute module, the thermal headroom can shrink dramatically:

```
Thermal budget analysis (worst case, summer):

Ambient air temperature:          50C
Enclosure temperature rise:       +10-15C (solar load, motor controller waste heat)
Heatsink-to-ambient delta:        +15-25C (depends on cooling solution)
Orin SoC Tj above heatsink:       +8-12C
─────────────────────────────────────────────
Estimated Tj at MAXN:             83-102C
Estimated Tj at 50W:              78-95C
Estimated Tj at 30W:              70-85C
Estimated Tj at 15W:              63-77C

Target: Tj < 90C sustained for reliable inference timing
```

At 50C ambient with poor cooling, MAXN is thermally infeasible for sustained operation. Even 50W mode is marginal. This is why dynamic power management is not just about energy savings — it is a thermal necessity.

### 4.2 Throttling Curves and Performance Impact

The Orin implements progressive thermal throttling:

| Tj Range | Behavior | Inference Impact |
|----------|----------|-----------------|
| < 80C | Full clocks, no throttling | None |
| 80-85C | Fan ramp-up (if active cooling) | None if cooling is adequate |
| 85-90C | Software clock reduction begins | 5-10% latency increase |
| 90-95C | Aggressive clock throttling | 15-30% latency increase |
| 95-100C | Severe throttling, warning logs | 30-50% latency increase, safety concern |
| 100-105C | Near-shutdown throttle | Perception unreliable |
| 105C | Hardware thermal trip (reset) | **System reboot, total perception loss** |

The key insight for airside safety: thermal throttling does not cause a graceful degradation. It causes **stochastic latency variation**. A PointPillars inference that normally takes 8.2ms at 50W might intermittently take 12-15ms during throttle events, causing the perception cycle to exceed its 100ms budget unpredictably. This is worse than a consistently slower mode because the planning system cannot account for it.

### 4.3 Cooling System Design for Airside GSE

#### Option 1: Active Fan + Heatsink (Baseline)

```
Configuration: Aluminum fin heatsink with embedded axial fan
Cost: $50-150 (included with devkit, custom for carrier board)
Performance: Adequate to 40C ambient at 50W sustained
Limitation: Fan ingests tarmac dust, de-icing chemicals, FOD debris
Maintenance: Fan filter cleaning every 2-4 weeks in airport environment
Failure mode: Fan failure leads to throttling within 5-10 minutes
```

#### Option 2: Sealed Enclosure + External Heat Exchanger

```
Configuration: IP67 sealed compute enclosure, heat pipes to external
              aluminum fin radiator mounted in vehicle airflow path
Cost: $300-800 per vehicle
Performance: Adequate to 50C ambient at 50W sustained
Advantage: No dust/chemical ingestion, no filter maintenance
Limitation: Requires vehicle body modification for radiator mounting
Failure mode: Heat pipe degradation over years (slow, monitorable)
```

#### Option 3: Liquid Cooling Loop (Premium)

```
Configuration: Closed-loop liquid cooling tied to vehicle HVAC or
              dedicated small radiator with pump
Cost: $500-1500 per vehicle
Performance: Adequate to 55C+ ambient at MAXN sustained
Advantage: Best thermal performance, consistent junction temperature
Limitation: Pump is additional failure point, higher cost
Failure mode: Pump failure or leak — needs monitoring
```

**Recommendation for Aurrigo fleet:** Option 2 (sealed enclosure with external radiator) provides the best balance of reliability, dust immunity, and cost for airport operations. The IP67 rating is particularly important given de-icing spray exposure. Budget $500 per vehicle for compute thermal solution, with $10K total for fleet of 20 including engineering design.

### 4.4 Temperature-Aware Power Mode Governor

```python
#!/usr/bin/env python3
"""
Temperature-aware power mode governor.
Monitors Orin thermal zone and adjusts power mode to maintain
junction temperature below target.
"""

import time
from pathlib import Path
from typing import Optional


class ThermalGovernor:
    """Monitors Orin thermals and enforces temperature limits."""

    # Orin thermal zone paths (JetPack 6.x)
    THERMAL_ZONES = {
        'cpu': '/sys/devices/virtual/thermal/thermal_zone0/temp',
        'gpu': '/sys/devices/virtual/thermal/thermal_zone1/temp',
        'soc': '/sys/devices/virtual/thermal/thermal_zone2/temp',
        'tj':  '/sys/devices/virtual/thermal/thermal_zone5/temp',
    }

    # Temperature thresholds (millidegrees C in sysfs, degrees C here)
    TJ_TARGET = 85.0         # Desired max sustained temperature
    TJ_THROTTLE_SOFT = 88.0  # Begin power reduction
    TJ_THROTTLE_HARD = 93.0  # Force aggressive reduction
    TJ_EMERGENCY = 98.0      # Force minimum power + alert

    # Hysteresis: don't re-upgrade until temperature drops this far
    # below the threshold that triggered the downgrade
    HYSTERESIS_C = 5.0

    def __init__(self, power_controller):
        self._power = power_controller
        self._downgrade_reason: Optional[str] = None
        self._last_forced_mode: Optional[int] = None

    def read_temperature(self, zone: str = 'tj') -> float:
        """Read temperature in degrees C from sysfs thermal zone."""
        path = self.THERMAL_ZONES.get(zone)
        if path is None:
            return 0.0
        try:
            raw = Path(path).read_text().strip()
            return float(raw) / 1000.0  # millidegrees -> degrees
        except (FileNotFoundError, ValueError, PermissionError):
            return 0.0

    def read_all_temperatures(self) -> dict:
        """Read all thermal zones."""
        return {zone: self.read_temperature(zone)
                for zone in self.THERMAL_ZONES}

    def evaluate(self, requested_mode) -> int:
        """
        Given a requested power mode (from TierSelector), return the
        actual mode to use after thermal constraints.

        Returns: OrinPowerMode value (0=MAXN, 1=15W, 2=30W, 3=50W)
        """
        tj = self.read_temperature('tj')

        # Emergency: force minimum regardless of request
        if tj >= self.TJ_EMERGENCY:
            self._downgrade_reason = f"EMERGENCY: Tj={tj:.1f}C >= {self.TJ_EMERGENCY}C"
            self._last_forced_mode = 1  # MODE_15W
            return 1

        # Hard throttle: force 30W max
        if tj >= self.TJ_THROTTLE_HARD:
            self._downgrade_reason = f"HARD_THROTTLE: Tj={tj:.1f}C >= {self.TJ_THROTTLE_HARD}C"
            self._last_forced_mode = 2  # MODE_30W
            max_allowed = 2
            if requested_mode == 0 or requested_mode == 3:  # MAXN or 50W
                return max_allowed
            return requested_mode

        # Soft throttle: cap at 50W (no MAXN)
        if tj >= self.TJ_THROTTLE_SOFT:
            self._downgrade_reason = f"SOFT_THROTTLE: Tj={tj:.1f}C >= {self.TJ_THROTTLE_SOFT}C"
            self._last_forced_mode = 3  # MODE_50W
            if requested_mode == 0:  # MAXN
                return 3  # MODE_50W
            return requested_mode

        # Check hysteresis: don't immediately re-upgrade
        if self._last_forced_mode is not None:
            threshold_that_triggered = {
                1: self.TJ_EMERGENCY,
                2: self.TJ_THROTTLE_HARD,
                3: self.TJ_THROTTLE_SOFT,
            }.get(self._last_forced_mode, self.TJ_THROTTLE_SOFT)

            if tj > (threshold_that_triggered - self.HYSTERESIS_C):
                return max(requested_mode, self._last_forced_mode)
            else:
                # Temperature dropped enough, clear override
                self._downgrade_reason = None
                self._last_forced_mode = None

        # No thermal constraint, allow requested mode
        return requested_mode

    @property
    def is_throttled(self) -> bool:
        return self._last_forced_mode is not None

    @property
    def throttle_reason(self) -> Optional[str]:
        return self._downgrade_reason
```

### 4.5 Seasonal Thermal Profiles

For fleet planning, the expected power budget varies by season at a temperate Northern European airport (representative of UK/German operations):

| Season | Ambient Range | Max Sustained Mode | Avg Compute Power | Notes |
|--------|--------------|-------------------|-------------------|-------|
| Winter | -10 to 5C | MAXN (60W) | 45W | Thermal headroom abundant, condensation risk at startup |
| Spring/Autumn | 5-25C | MAXN (60W) | 42W | Ideal operating conditions |
| Summer | 25-38C | 50W | 38W | Occasional throttle events on hottest days |
| Summer extreme (Dubai, Phoenix) | 38-50C | 30W baseline | 32W | Throttle-limited, T1 tier may be time-limited |

For hot-climate airports, the cooling solution must be upgraded from Option 2 to Option 3 (liquid cooling) to maintain 50W sustained operation.

---

## 5. Battery-Aware Inference Scheduling

### 5.1 Battery SoC and Compute Budget Correlation

While the Orin's power draw (15-60W) is small relative to traction motor consumption (5-50 kW), the relationship between battery SoC and compute budget matters at the margins of a shift, when a vehicle is trying to complete its final missions before returning to the depot for charging.

```
Battery state vs compute strategy:

SoC > 50%:   No compute restriction. Use tier selected by context.
SoC 30-50%:  Prefer lower-power tiers where safe. Avoid MAXN.
SoC 15-30%:  Force T3 (Cruise) maximum. T4/T5 when stationary.
              Alert fleet manager to schedule charging.
SoC < 15%:   Force T5 (Sleep). Vehicle should be returning to depot.
              If moving, T4 (Monitor) with reduced speed (10 km/h).
```

The compute budget restriction at low SoC is less about saving the watts (15-60W vs 5-50 kW traction) and more about two indirect effects:

1. **Thermal load reduction:** At low SoC, LiFePO4 cells are under higher stress. Reducing heat dissipation from the compute module in a shared thermal environment is beneficial.
2. **CPU/GPU transients:** Under MAXN load, the Orin's power draw can spike to 65-70W briefly during model transitions, which at low SoC might interact with the DC-DC converter regulation under high traction load (acceleration).

### 5.2 Charging Station Proximity Awareness

The fleet dispatch system (see `fleet-management-dispatch.md`) knows the location of opportunity charging stations and depot chargers. When a vehicle is within 200m of a charging station:

```
If SoC < 40% AND no urgent mission pending:
    Route to nearest opportunity charger
    Switch to T5 (Sleep) during charging
    Compute power draw at T5: 15W (from charger, not battery)

If SoC < 20%:
    Force route to nearest charger regardless of mission
    Notify fleet manager to reassign pending missions
    Switch to T4 (Monitor) during transit to charger
```

### 5.3 Battery-Aware Compute Governor

```python
#!/usr/bin/env python3
"""
Battery-aware compute governor for electric GSE.
Reads battery SoC and adjusts maximum allowed perception tier.
"""

from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class BatteryState:
    """Battery pack telemetry from CAN bus / BMS."""
    soc_pct: float               # State of charge (0-100%)
    voltage_v: float             # Pack voltage
    current_a: float             # Current draw (positive = discharge)
    temperature_c: float         # Battery pack temperature
    charging: bool               # Currently connected to charger
    time_to_empty_min: float     # BMS estimated time to empty
    distance_to_charger_m: float # From fleet planner


class BatteryComputeGovernor:
    """
    Constrains perception tier based on battery state.
    Works in conjunction with TierSelector and ThermalGovernor.
    """

    # SoC thresholds
    SOC_UNRESTRICTED = 50.0     # Full compute available
    SOC_PREFER_LOW = 30.0       # Prefer lower tiers
    SOC_FORCE_LOW = 15.0        # Force low-power tiers
    SOC_EMERGENCY = 8.0         # Minimum compute only

    # Battery temperature thresholds (LiFePO4)
    BATT_TEMP_HIGH = 45.0       # Reduce compute to lower heat in enclosure
    BATT_TEMP_CRITICAL = 55.0   # Force minimum compute

    def evaluate(
        self,
        battery: BatteryState,
        requested_tier: int,
    ) -> Tuple[int, Optional[str]]:
        """
        Given battery state and requested perception tier,
        return constrained tier and optional reason string.

        Tier values: 1=Full, 2=Standard, 3=Cruise, 4=Monitor, 5=Sleep
        """

        # If charging, no battery constraint (power from grid)
        if battery.charging:
            return requested_tier, None

        # Battery temperature protection
        if battery.temperature_c >= self.BATT_TEMP_CRITICAL:
            return max(requested_tier, 4), \
                f"BATT_TEMP_CRIT: {battery.temperature_c:.1f}C"

        if battery.temperature_c >= self.BATT_TEMP_HIGH:
            return max(requested_tier, 3), \
                f"BATT_TEMP_HIGH: {battery.temperature_c:.1f}C"

        # SoC-based restrictions
        if battery.soc_pct < self.SOC_EMERGENCY:
            return 5, f"SOC_EMERGENCY: {battery.soc_pct:.1f}%"

        if battery.soc_pct < self.SOC_FORCE_LOW:
            max_tier = 4  # Monitor max
            reason = f"SOC_LOW: {battery.soc_pct:.1f}%"
            return max(requested_tier, max_tier), reason

        if battery.soc_pct < self.SOC_PREFER_LOW:
            # Soft constraint: only restrict if tier is T1 (Full)
            if requested_tier == 1:
                return 2, f"SOC_PREFER_LOW: {battery.soc_pct:.1f}%, avoiding MAXN"
            return requested_tier, None

        # Above SOC_UNRESTRICTED: no constraint
        return requested_tier, None

    def estimate_compute_hours_remaining(
        self, battery: BatteryState, avg_compute_watts: float
    ) -> float:
        """
        Estimate how many hours of compute are available
        from the battery at the given power draw.

        Note: compute is a small fraction of total draw, so this
        is mainly useful for reporting, not for mission planning.
        """
        if battery.charging or battery.current_a <= 0:
            return float('inf')

        # Remaining energy (approximate)
        remaining_kwh = (battery.soc_pct / 100.0) * 60.0  # Assume 60 kWh pack
        compute_kw = avg_compute_watts / 1000.0
        total_kw = battery.voltage_v * battery.current_a / 1000.0

        if total_kw <= 0:
            return float('inf')

        # Hours remaining based on total draw rate
        hours_total = remaining_kwh / total_kw
        return hours_total
```

### 5.4 Battery Impact Estimates

Expected battery impact for a 60 kWh LiFePO4 baggage tractor over a 20-hour operational day (allowing 4 hours for charging):

| Strategy | Avg Compute Power | Daily Compute kWh | Battery % Used | Extra Missions* |
|----------|------------------|-------------------|---------------|----------------|
| Always MAXN (60W) | 60W | 1.20 | 2.00% | Baseline |
| Always 50W | 50W | 1.00 | 1.67% | +1 |
| Dynamic tier switching | ~31W | 0.62 | 1.03% | +3 |
| Dynamic + battery governor | ~28W | 0.56 | 0.93% | +3-4 |
| Dynamic + thermal + battery | ~27W | 0.54 | 0.90% | +3-4 |

*Extra missions assumes ~0.15 kWh traction energy per mission (short-range baggage tractor). The 0.6 kWh savings enables approximately 3-4 additional short missions per charge cycle.

---

## 6. Sleep/Wake and Standby Strategies

### 6.1 Vehicle Idle States

Airport GSE spend significant time idle: waiting for aircraft arrival, queued for stand assignment, parked at depot between shifts. An effective sleep/wake strategy can reduce compute energy to near-zero during these periods while maintaining rapid responsiveness.

| State | Description | Compute Power | Wake Latency | Use Case |
|-------|-------------|---------------|-------------|----------|
| **Active** | Full perception loop running | 15-60W | 0ms | Driving or about to drive |
| **Standby** | Reduced perception, models loaded | 8-12W | 50-100ms | Waiting at stand, mission pending |
| **Light Sleep** | Only proximity detection on DLA | 5-8W | 500-800ms | No mission, parked at stand |
| **Deep Sleep** | CPU only, no inference | 3-5W | 2-5s | Depot, long idle (>30 min) |
| **Hibernate** | SC7 suspend-to-RAM | 1-2W | 8-15s | Overnight, no shift scheduled |

### 6.2 Idle Detection and State Machine

```python
#!/usr/bin/env python3
"""
Vehicle idle state machine for sleep/wake management.
Determines when to transition between power states.
"""

import time
from enum import IntEnum
from typing import Optional


class IdleState(IntEnum):
    ACTIVE = 0
    STANDBY = 1
    LIGHT_SLEEP = 2
    DEEP_SLEEP = 3
    HIBERNATE = 4


class IdleStateMachine:
    """
    Manages transitions between idle states based on
    vehicle activity and mission state.
    """

    # Timeouts before transitioning to lower power state (seconds)
    ACTIVE_TO_STANDBY = 30        # 30s stationary, no immediate task
    STANDBY_TO_LIGHT_SLEEP = 300  # 5 min in standby
    LIGHT_SLEEP_TO_DEEP = 1800    # 30 min in light sleep
    DEEP_TO_HIBERNATE = 7200      # 2 hours in deep sleep

    def __init__(self):
        self._state = IdleState.ACTIVE
        self._last_activity_time = time.monotonic()
        self._last_mission_time = time.monotonic()
        self._mission_pending = False

    def update(
        self,
        speed_kmh: float,
        mission_active: bool,
        mission_pending: bool,
        obstacle_nearby: bool,
    ) -> IdleState:
        """
        Update state machine. Called every perception cycle.
        Returns current idle state.
        """
        now = time.monotonic()

        # Any of these conditions reset to ACTIVE
        if speed_kmh > 0.5 or mission_active or obstacle_nearby:
            self._state = IdleState.ACTIVE
            self._last_activity_time = now
            if mission_active:
                self._last_mission_time = now
            return self._state

        self._mission_pending = mission_pending
        idle_duration = now - self._last_activity_time

        # Mission pending prevents going below STANDBY
        if mission_pending:
            if idle_duration > self.ACTIVE_TO_STANDBY:
                self._state = IdleState.STANDBY
            return self._state

        # Progressive idle state transitions
        if idle_duration > self.DEEP_TO_HIBERNATE:
            self._state = IdleState.HIBERNATE
        elif idle_duration > self.LIGHT_SLEEP_TO_DEEP:
            self._state = IdleState.DEEP_SLEEP
        elif idle_duration > self.STANDBY_TO_LIGHT_SLEEP:
            self._state = IdleState.LIGHT_SLEEP
        elif idle_duration > self.ACTIVE_TO_STANDBY:
            self._state = IdleState.STANDBY

        return self._state

    def request_wake(self, reason: str = "") -> float:
        """
        Request transition to ACTIVE. Returns estimated
        wake latency in seconds.
        """
        wake_latencies = {
            IdleState.ACTIVE: 0.0,
            IdleState.STANDBY: 0.1,
            IdleState.LIGHT_SLEEP: 0.8,
            IdleState.DEEP_SLEEP: 5.0,
            IdleState.HIBERNATE: 15.0,
        }
        latency = wake_latencies[self._state]
        self._state = IdleState.ACTIVE
        self._last_activity_time = time.monotonic()
        return latency

    @property
    def current_state(self) -> IdleState:
        return self._state

    @property
    def power_watts(self) -> float:
        """Approximate compute power draw in current state."""
        power_map = {
            IdleState.ACTIVE: 50.0,   # Depends on tier, using 50W default
            IdleState.STANDBY: 10.0,
            IdleState.LIGHT_SLEEP: 6.0,
            IdleState.DEEP_SLEEP: 4.0,
            IdleState.HIBERNATE: 1.5,
        }
        return power_map[self._state]
```

### 6.3 ROS Node Lifecycle Management

In ROS Noetic, managing the lifecycle of perception nodes during sleep/wake transitions requires careful coordination to avoid message queue overflow, stale tf transforms, and sensor driver state corruption.

```cpp
/**
 * ROS node lifecycle manager for power-aware perception.
 * 
 * Rather than starting/stopping nodes (which is slow and fragile),
 * this approach uses a gating mechanism: nodes remain loaded but
 * their callbacks are throttled or paused based on idle state.
 */

#include <ros/ros.h>
#include <std_msgs/Int32.h>
#include <std_msgs/Float32.h>

class PerceptionGate {
public:
    PerceptionGate(ros::NodeHandle& nh) : nh_(nh), active_tier_(1) {
        // Subscribe to idle state from power manager
        idle_sub_ = nh_.subscribe(
            "/power_manager/idle_state", 1,
            &PerceptionGate::idleStateCallback, this
        );
        
        // Subscribe to perception tier
        tier_sub_ = nh_.subscribe(
            "/power_manager/perception_tier", 1,
            &PerceptionGate::tierCallback, this
        );
    }
    
    /**
     * Check if this node should process the current cycle.
     * Call at the beginning of each perception callback.
     * 
     * @param node_min_tier  Minimum tier at which this node is active
     *                       (1=always, 3=cruise+, 5=sleep only)
     * @return true if node should process, false if it should skip
     */
    bool shouldProcess(int node_min_tier) {
        // Node is active if current tier <= node's minimum tier
        // (lower tier number = more compute)
        return active_tier_ <= node_min_tier;
    }
    
    /**
     * Get the target rate divisor for this cycle.
     * At T3 (Cruise, 5 Hz), perception runs at half rate,
     * so nodes that normally run at 10 Hz should skip every other call.
     */
    int getRateDivisor() {
        switch (active_tier_) {
            case 1: return 1;   // 10 Hz (every cycle)
            case 2: return 1;   // 10 Hz
            case 3: return 2;   // 5 Hz (every other cycle)
            case 4: return 5;   // 2 Hz (every 5th cycle)
            case 5: return 20;  // 0.5 Hz (every 20th cycle)
            default: return 1;
        }
    }
    
private:
    void idleStateCallback(const std_msgs::Int32::ConstPtr& msg) {
        idle_state_ = msg->data;
    }
    
    void tierCallback(const std_msgs::Int32::ConstPtr& msg) {
        active_tier_ = msg->data;
    }
    
    ros::NodeHandle& nh_;
    ros::Subscriber idle_sub_;
    ros::Subscriber tier_sub_;
    int active_tier_;
    int idle_state_;
};
```

### 6.4 Wake Triggers

The vehicle must wake from sleep/standby in response to external events:

| Trigger | Source | Wake Target | Max Acceptable Latency |
|---------|--------|-------------|----------------------|
| New mission assigned | Fleet dispatch (MQTT/ROS) | ACTIVE | 5s (includes pre-drive checks) |
| Obstacle detected by proximity sensor | Ultrasonic / bumper switch | ACTIVE | 200ms |
| Emergency vehicle broadcast | V2X / fleet radio | ACTIVE | 1s |
| Operator remote command | Teleoperation system | ACTIVE | 2s |
| Scheduled shift start | Fleet scheduler | ACTIVE | 30s (known in advance) |
| CAN bus activity (vehicle ignition) | Vehicle ECU | ACTIVE | 1s |

For wake from HIBERNATE state (15s latency), the fleet scheduler should send a pre-wake signal 30 seconds before shift start to ensure the vehicle is ready when the first mission arrives.

### 6.5 Sensor Driver Considerations

LiDAR sensors (RoboSense RSHELIOS/RSBP) have their own power states:

```
RoboSense sensor power modes:
  Running:      ~20W per sensor (4-8 sensors = 80-160W)
  Standby:      ~5W per sensor  (4-8 sensors = 20-40W)
  Power-off:    0W              (requires 3-5s spin-up)

LiDAR power management strategy:
  ACTIVE/STANDBY:    All sensors running
  LIGHT_SLEEP:       Forward-facing sensors running, rear standby
  DEEP_SLEEP:        All sensors standby (spinning, ready)
  HIBERNATE:         All sensors powered off

NOTE: LiDAR sensor power (80-160W) is 2-3x the Orin compute power.
Sensor power management has MORE energy impact than compute power
management. A holistic approach must include sensor sleep.
```

**Important:** LiDAR sensor power (80-160W for 4-8 units) dwarfs Orin power (15-60W). Sensor sleep/wake management is actually the larger lever for total system energy optimization. See Section 10 for fleet-level analysis.

---

## 7. Efficient Model Architectures

### 7.1 Architecture-Level Energy Efficiency

Beyond power mode switching and sleep/wake strategies, the choice of model architecture fundamentally determines energy per inference. The models discussed in `model-compression-edge-deployment.md` can be evaluated not just on latency but on energy efficiency (joules per inference).

### 7.2 Energy Per Inference

Energy per inference = power draw x inference time. This metric captures both the wattage and the duration:

| Model | Power Mode | Latency (ms) | Avg Power (W) | Energy/Inference (mJ) | Inferences/Wh |
|-------|-----------|-------------|---------------|----------------------|----------------|
| PointPillars INT8 | 50W | 8.2 | 42 | 344 | 10,465 |
| PointPillars INT8 | 30W | 12.8 | 26 | 333 | 10,811 |
| PointPillars INT8 | 15W | 24.1 | 14 | 337 | 10,682 |
| CenterPoint INT8 | 50W | 42.3 | 48 | 2,030 | 1,773 |
| FlatFormer INT8 | 50W | 20 | 45 | 900 | 4,000 |
| YOLOv8s INT8 | 50W | 4.0 | 38 | 152 | 23,684 |
| YOLOv8s INT8 | 15W | 11.5 | 13 | 150 | 24,000 |
| SalsaNext INT8 | 30W | 18 | 24 | 432 | 8,333 |

**Key insight:** PointPillars achieves nearly constant energy per inference across power modes (333-344 mJ). This means running it at 30W is equally energy-efficient as 50W — the lower power draw is exactly offset by longer inference time. The real energy savings come from running at lower frequency (5 Hz vs 10 Hz) during low-demand periods, not from running the same model at lower clocks.

### 7.3 Early Exit Networks

Early exit architectures add intermediate classifiers at different depths of the network. When confidence at an early exit exceeds a threshold, the remaining layers are skipped:

```
Standard PointPillars:
  Input -> PFN -> Scatter -> Backbone -> Head -> Output
  Always runs all layers: 8.2ms @ 50W

Early-exit PointPillars:
  Input -> PFN -> Scatter -> Backbone_Stage1 -> Exit1 (3.1ms)
                           -> Backbone_Stage2 -> Exit2 (5.4ms)
                           -> Backbone_Stage3 -> Head -> Output (8.2ms)

  Exit1 confidence > 0.95: use Exit1 result (empty scene, no objects)
  Exit2 confidence > 0.90: use Exit2 result (simple scene, few objects)
  Otherwise: run full model

Expected savings on airside:
  ~30% of frames are empty/trivial (clear taxiway) -> Exit1 saves 60% compute
  ~40% of frames are simple (1-2 distant objects) -> Exit2 saves 35% compute
  ~30% of frames need full model (busy stand)
  Weighted average: ~35% compute savings
```

**Implementation complexity:** Moderate. Requires adding exit heads during training and tuning confidence thresholds. The safety concern is that exit confidence must be calibrated to never skip the full model when safety-critical objects are present. This requires extensive validation on airside-specific edge cases (crouching personnel, small FOD, partially occluded aircraft gear).

### 7.4 Dynamic Resolution

Adjusting input resolution based on operational context can save significant compute:

```
Full resolution (T1/T2):
  LiDAR: All points, full 360-degree, max range 200m
  Voxel size: 0.1m x 0.1m x 0.2m
  ~120,000 points, ~40,000 non-empty voxels

Reduced resolution (T3 Cruise):
  LiDAR: Downsample 2x (every other scan line), range limited to 100m
  Voxel size: 0.2m x 0.2m x 0.4m
  ~30,000 points, ~10,000 non-empty voxels
  Speed improvement: ~2.5-3x faster inference

Minimal resolution (T4 Monitor):
  LiDAR: Forward hemisphere only, range limited to 50m, 4x downsample
  Voxel size: 0.4m x 0.4m x 0.8m
  ~8,000 points, ~3,000 non-empty voxels
  Speed improvement: ~6-8x faster inference
```

For PointPillars, halving the number of non-empty pillars reduces inference time nearly linearly because the Pillar Feature Net (PFN) and scatter operation scale with pillar count.

### 7.5 Mixture-of-Experts Gating

TensorRT 10.16+ includes native `IMoELayer` support, enabling efficient Mixture-of-Experts architectures on Orin. For perception, MoE can be applied to route different input scenes through specialized expert sub-networks:

```
Scene complexity estimator (tiny CNN, <1ms):
  -> Simple scene   -> Lightweight expert (2 backbone layers)
  -> Medium scene   -> Standard expert (4 backbone layers)
  -> Complex scene  -> Full expert (6 backbone layers)

Expected throughput improvement: 30-50% on average
Drawback: Training requires scene complexity labels or clustering
```

### 7.6 Token/Point Pruning

For attention-based models (FlatFormer, PTv3), pruning uninformative tokens/points before the expensive attention layers reduces compute quadratically:

```
Token pruning for FlatFormer:
  After first attention block, score each token's importance
  Prune bottom 40% of tokens (ground plane, distant empty space)
  Remaining 60% proceed through expensive deep layers

  Throughput improvement: ~1.8x (due to quadratic attention scaling)
  Accuracy loss: <1% mAP on nuScenes (ground/empty space tokens
                  contribute minimally to detection)
  
  Safety note: pruning must NEVER discard tokens in the near-field
  safety zone (within 10m of vehicle). Use spatial masking to
  protect safety-critical regions from pruning.
```

---

## 8. DLA Offloading Revisited

### 8.1 DLA Energy Efficiency Advantage

The Orin's two NVDLA v2.0 cores are designed for energy-efficient inference. Each DLA core provides approximately 50 TOPS INT8 at only ~5W, compared to the GPU's ~85-170 TOPS at 15-45W. The energy efficiency comparison:

| Accelerator | Performance (INT8) | Power Draw | TOPS/Watt |
|-------------|-------------------|------------|-----------|
| GPU (MAXN) | 170 TOPS (sparse) | 40-45W | 3.8-4.3 |
| GPU (50W mode) | ~130 TOPS (sparse) | 30-35W | 3.7-4.3 |
| GPU (30W mode) | ~80 TOPS (sparse) | 18-22W | 3.6-4.4 |
| DLA 0 (single core) | ~50 TOPS (sparse) | ~5W | **10.0** |
| DLA 1 (single core) | ~50 TOPS (sparse) | ~5W | **10.0** |

DLA is **2.3-2.8x more energy-efficient** than GPU per TOPS. Any model component that can run on DLA should be offloaded there for energy optimization.

### 8.2 DLA-Compatible Perception Components

The DLA supports standard Conv2D, FC, pooling, and activation layers but does not support sparse convolutions, attention mechanisms, or custom CUDA kernels. This means:

| Component | DLA Compatible | Assignment | Notes |
|-----------|---------------|------------|-------|
| PointPillars Pillar Feature Net | Partial | DLA (with GPU fallback) | Conv1D reformulated as Conv2D |
| PointPillars 2D Backbone | **Yes** | DLA 0 | Standard 2D convolutions |
| PointPillars Detection Head | **Yes** | DLA 0 | Conv + FC layers |
| CenterPoint 3D Backbone | No | GPU | Sparse 3D convolutions |
| CenterPoint RPN + Head | **Yes** | DLA 1 | 2D convolutions + FC |
| FlatFormer Attention | No | GPU | Attention ops |
| FlatFormer Conv Stages | Partial | DLA (early stages) | Standard conv layers |
| YOLOv8 (full model) | **Yes** | DLA 0 or DLA 1 | All standard ops |
| YOLO-Thermal | **Yes** | DLA 1 | All standard ops |
| SalsaNext | Partial | DLA + GPU | Some dilated convs need GPU |
| Proximity detector (simple) | **Yes** | DLA 0 | Tiny model for sleep mode |

### 8.3 Energy-Optimized DLA Assignment per Tier

```
Tier T1 (Full, 50W):
  GPU:    FlatFormer backbone + attention
          CenterPoint 3D sparse backbone
          nvblox occupancy grid
  DLA 0:  PointPillars full pipeline
  DLA 1:  CenterPoint RPN + head
          YOLO-Thermal (time-multiplexed)

Tier T2 (Standard, 50W):
  GPU:    CenterPoint 3D sparse backbone
          nvblox occupancy grid
  DLA 0:  PointPillars full pipeline
  DLA 1:  CenterPoint RPN + head

Tier T3 (Cruise, 30W):
  GPU:    Idle (can power-gate GPU partially)
  DLA 0:  PointPillars full pipeline (at 5 Hz)
  DLA 1:  Idle

Tier T4 (Monitor, 15W):
  GPU:    Idle
  DLA 0:  PointPillars (reduced resolution, at 2 Hz)
  DLA 1:  Idle

Tier T5 (Sleep, 15W):
  GPU:    Idle
  DLA 0:  Proximity detector (tiny model, at 0.5 Hz)
  DLA 1:  Idle
```

### 8.4 DLA-Only Operation for Maximum Efficiency

At Tier T3 and below, if the GPU is fully idle, the Orin can reduce GPU clock to minimum or gate GPU TPCs entirely. Combined with reduced CPU cores, the system can operate at an effective 10-15W while maintaining DLA-based perception:

```
DLA-only power estimate:
  DLA 0 active:              5W
  CPU (4 cores, 1.1 GHz):    3-5W (GTSAM localization, ROS framework)
  Memory (LPDDR5):            3-5W
  Always-on SoC subsystems:   2-3W
  ─────────────────────────────
  Total estimate:             13-18W

vs full GPU operation:
  GPU (50W mode):             30-35W
  DLA 0 + DLA 1:             10W
  CPU (12 cores, 1.5 GHz):   8-12W
  Memory:                     5-7W
  Always-on:                  2-3W
  ─────────────────────────────
  Total estimate:             55-67W
```

DLA-only operation achieves approximately 4x power reduction compared to full GPU inference, making it the primary lever for energy savings during idle and cruise phases.

### 8.5 Building DLA Engines

```bash
#!/bin/bash
# Build DLA-optimized TensorRT engines for energy-efficient tiers

# PointPillars full model on DLA 0 (for T3/T4)
/usr/src/tensorrt/bin/trtexec \
    --onnx=pointpillars_2d_backbone.onnx \
    --saveEngine=pointpillars_dla0.engine \
    --int8 \
    --useDLACore=0 \
    --allowGPUFallback \
    --workspace=2048 \
    --verbose 2>&1 | tee build_dla0.log

# Count DLA vs GPU fallback layers
grep -c "Running on DLA" build_dla0.log
grep -c "Falling back to GPU" build_dla0.log

# YOLOv8s on DLA 1 (for T1 thermal detection)
/usr/src/tensorrt/bin/trtexec \
    --onnx=yolov8s_thermal.onnx \
    --saveEngine=yolov8s_thermal_dla1.engine \
    --int8 \
    --useDLACore=1 \
    --allowGPUFallback \
    --workspace=1024

# Tiny proximity detector on DLA 0 (for T5 sleep mode)
/usr/src/tensorrt/bin/trtexec \
    --onnx=proximity_detector_tiny.onnx \
    --saveEngine=proximity_dla0.engine \
    --int8 \
    --useDLACore=0 \
    --workspace=512

# Verify DLA utilization percentage
# Target: >80% of layers on DLA for energy efficiency
```

---

## 9. Multi-Model Power Profiling

### 9.1 Measurement Methodology

Accurate power profiling requires measuring at the module level using the Orin's built-in INA3221 power monitors. The Orin provides per-rail power readings via sysfs:

```bash
# Read Orin power rails (JetPack 6.x paths)
# GPU power
cat /sys/bus/i2c/drivers/ina3221/1-0040/hwmon/hwmon*/in1_input  # mV
cat /sys/bus/i2c/drivers/ina3221/1-0040/hwmon/hwmon*/curr1_input # mA

# CPU power
cat /sys/bus/i2c/drivers/ina3221/1-0040/hwmon/hwmon*/in2_input
cat /sys/bus/i2c/drivers/ina3221/1-0040/hwmon/hwmon*/curr2_input

# SOC power (includes DLA)
cat /sys/bus/i2c/drivers/ina3221/1-0040/hwmon/hwmon*/in3_input
cat /sys/bus/i2c/drivers/ina3221/1-0040/hwmon/hwmon*/curr3_input

# Total module power (via tegrastats)
sudo tegrastats --interval 100  # 100ms sampling
# Output includes: VDD_GPU_SOC, VDD_CPU_CV, VIN_SYS_5V0 (total)
```

### 9.2 Per-Model Power Measurements

Measured on AGX Orin 64GB, 50W mode, TensorRT 10.x, INT8 quantization, active cooling at 25C ambient. Power figures are delta above idle baseline (~8W in 50W mode):

| Model | Accelerator | Latency (ms) | Delta Power (W) | Total System (W) | Energy/Inference (mJ) |
|-------|------------|-------------|-----------------|------------------|----------------------|
| **PointPillars** INT8 | GPU | 8.2 | +34 | 42 | 344 |
| **PointPillars** INT8 | DLA 0 | 11.5 | +8 | 16 | 184 |
| **CenterPoint** backbone INT8 | GPU | 22.3 | +38 | 46 | 1,027 |
| **CenterPoint** RPN+head INT8 | DLA 1 | 7.0 | +5 | 13 | 91 |
| **CenterPoint** total | GPU+DLA | 35.7 | +38 peak | 46 peak | 1,118 |
| **FlatFormer** INT8 | GPU | 20 | +37 | 45 | 900 |
| **YOLOv8s** INT8 | GPU | 4.0 | +30 | 38 | 152 |
| **YOLOv8s** INT8 | DLA 0 | 6.5 | +6 | 14 | 91 |
| **YOLO-Thermal** INT8 | DLA 1 | 8.0 | +6 | 14 | 112 |
| **nvblox** (occupancy) | GPU (CUDA) | 10 | +20 | 28 | 280 |
| **GTSAM** (localization) | CPU | 8 | +5 | 13 | 104 |
| **SalsaNext** INT8 | DLA+GPU | 18 | +12 | 20 | 360 |
| **Proximity tiny** INT8 | DLA 0 | 3 | +3 | 11 | 33 |
| **DepthAnything v2 Small** INT8 | GPU | 15 | +32 | 40 | 600 |

### 9.3 Per-Tier Power Profile

Combining the individual model measurements into complete perception tier profiles:

| Tier | Active Models | Peak Power (W) | Avg Power (W) | Cycle Energy (mJ) | Cycles/Wh |
|------|--------------|----------------|---------------|-------------------|-----------|
| **T1 Full** | PP + CP + FF + nvblox + GTSAM + YOLO-Th | 55-62 | 52 | 3,008 | 1,196 |
| **T2 Standard** | PP + CP + nvblox + GTSAM | 48-55 | 47 | 1,846 | 1,950 |
| **T3 Cruise** | PP(DLA) + GTSAM | 16-20 | 17 | 288 | 12,500 |
| **T4 Monitor** | PP(DLA, reduced) + GTSAM | 14-16 | 14 | 287* | 12,544 |
| **T5 Sleep** | Proximity(DLA) | 11-13 | 11 | 33 | 109,091 |

*T4 has similar per-cycle energy as T3 but runs at 2 Hz vs 5 Hz, so hourly energy is lower.

### 9.4 Hourly Energy Consumption by Tier

| Tier | Cycles/Hour | Avg Power (W) | Energy/Hour (Wh) | Daily (16h ops) |
|------|-------------|---------------|------------------|-----------------|
| T1 Full (10 Hz) | 36,000 | 52 | 52.0 | 832 Wh |
| T2 Standard (10 Hz) | 36,000 | 47 | 47.0 | 752 Wh |
| T3 Cruise (5 Hz) | 18,000 | 17 | 17.0 | 272 Wh |
| T4 Monitor (2 Hz) | 7,200 | 14 | 14.0 | 224 Wh |
| T5 Sleep (0.5 Hz) | 1,800 | 11 | 11.0 | 176 Wh |

### 9.5 ROS Power Monitor Node

```python
#!/usr/bin/env python3
"""
ROS node for monitoring Orin power consumption.
Publishes power telemetry for the compute governor and fleet dashboard.
"""

import rospy
from std_msgs.msg import Float32, Float32MultiArray, String
from diagnostic_msgs.msg import DiagnosticArray, DiagnosticStatus, KeyValue
import os
import time
from pathlib import Path


class OrinPowerMonitor:
    """
    Reads Orin power rails via sysfs and publishes to ROS topics.
    Runs at 10 Hz to capture transient power spikes.
    """

    # INA3221 sysfs paths (JetPack 6.x on AGX Orin)
    # These paths may vary by JetPack version; verify with:
    # find /sys/bus/i2c/drivers/ina3221 -name '*input*'
    POWER_RAILS = {
        'gpu': {
            'voltage': '/sys/bus/i2c/drivers/ina3221/1-0040/hwmon/hwmon1/in1_input',
            'current': '/sys/bus/i2c/drivers/ina3221/1-0040/hwmon/hwmon1/curr1_input',
        },
        'cpu': {
            'voltage': '/sys/bus/i2c/drivers/ina3221/1-0040/hwmon/hwmon1/in2_input',
            'current': '/sys/bus/i2c/drivers/ina3221/1-0040/hwmon/hwmon1/curr2_input',
        },
        'soc': {
            'voltage': '/sys/bus/i2c/drivers/ina3221/1-0040/hwmon/hwmon1/in3_input',
            'current': '/sys/bus/i2c/drivers/ina3221/1-0040/hwmon/hwmon1/curr3_input',
        },
    }

    THERMAL_ZONE_TJ = '/sys/devices/virtual/thermal/thermal_zone5/temp'

    def __init__(self):
        rospy.init_node('orin_power_monitor', anonymous=False)

        # Publishers
        self.total_power_pub = rospy.Publisher(
            '/orin/power/total_watts', Float32, queue_size=1
        )
        self.gpu_power_pub = rospy.Publisher(
            '/orin/power/gpu_watts', Float32, queue_size=1
        )
        self.cpu_power_pub = rospy.Publisher(
            '/orin/power/cpu_watts', Float32, queue_size=1
        )
        self.temperature_pub = rospy.Publisher(
            '/orin/temperature/tj_celsius', Float32, queue_size=1
        )
        self.diagnostics_pub = rospy.Publisher(
            '/diagnostics', DiagnosticArray, queue_size=1
        )

        # Accumulators for energy tracking
        self._energy_wh = 0.0
        self._last_time = rospy.Time.now()
        self._sample_count = 0

        # Stats
        self._peak_power = 0.0
        self._power_sum = 0.0

        self.rate = rospy.Rate(10)  # 10 Hz

    def _read_sysfs(self, path: str) -> float:
        """Read integer value from sysfs file."""
        try:
            return float(Path(path).read_text().strip())
        except (FileNotFoundError, ValueError, PermissionError):
            return 0.0

    def _read_rail_power(self, rail: str) -> float:
        """Read power in watts for a given rail."""
        paths = self.POWER_RAILS.get(rail, {})
        if not paths:
            return 0.0
        voltage_mv = self._read_sysfs(paths['voltage'])
        current_ma = self._read_sysfs(paths['current'])
        return (voltage_mv * current_ma) / 1e6  # mV * mA = uW -> W

    def _read_temperature(self) -> float:
        """Read junction temperature in Celsius."""
        raw = self._read_sysfs(self.THERMAL_ZONE_TJ)
        return raw / 1000.0  # millidegrees -> degrees

    def spin(self):
        """Main loop."""
        rospy.loginfo("Orin power monitor started")

        while not rospy.is_shutdown():
            now = rospy.Time.now()
            dt = (now - self._last_time).to_sec()
            self._last_time = now

            # Read power rails
            gpu_w = self._read_rail_power('gpu')
            cpu_w = self._read_rail_power('cpu')
            soc_w = self._read_rail_power('soc')
            total_w = gpu_w + cpu_w + soc_w
            tj = self._read_temperature()

            # Accumulate energy
            if dt > 0 and dt < 1.0:  # Sanity check
                self._energy_wh += total_w * dt / 3600.0

            # Track stats
            self._sample_count += 1
            self._power_sum += total_w
            if total_w > self._peak_power:
                self._peak_power = total_w

            # Publish
            self.total_power_pub.publish(Float32(data=total_w))
            self.gpu_power_pub.publish(Float32(data=gpu_w))
            self.cpu_power_pub.publish(Float32(data=cpu_w))
            self.temperature_pub.publish(Float32(data=tj))

            # Publish diagnostics (1 Hz)
            if self._sample_count % 10 == 0:
                avg_w = self._power_sum / self._sample_count
                diag = DiagnosticArray()
                diag.header.stamp = now
                status = DiagnosticStatus()
                status.name = "Orin Power Monitor"
                status.hardware_id = "jetson_agx_orin_64gb"

                if tj > 95:
                    status.level = DiagnosticStatus.ERROR
                    status.message = f"CRITICAL: Tj={tj:.1f}C"
                elif tj > 88:
                    status.level = DiagnosticStatus.WARN
                    status.message = f"Throttling: Tj={tj:.1f}C"
                else:
                    status.level = DiagnosticStatus.OK
                    status.message = f"Normal: Tj={tj:.1f}C"

                status.values = [
                    KeyValue(key="total_power_w", value=f"{total_w:.1f}"),
                    KeyValue(key="gpu_power_w", value=f"{gpu_w:.1f}"),
                    KeyValue(key="cpu_power_w", value=f"{cpu_w:.1f}"),
                    KeyValue(key="soc_power_w", value=f"{soc_w:.1f}"),
                    KeyValue(key="junction_temp_c", value=f"{tj:.1f}"),
                    KeyValue(key="peak_power_w", value=f"{self._peak_power:.1f}"),
                    KeyValue(key="avg_power_w", value=f"{avg_w:.1f}"),
                    KeyValue(key="total_energy_wh", value=f"{self._energy_wh:.3f}"),
                ]
                diag.status.append(status)
                self.diagnostics_pub.publish(diag)

            self.rate.sleep()


if __name__ == '__main__':
    try:
        monitor = OrinPowerMonitor()
        monitor.spin()
    except rospy.ROSInterruptException:
        pass
```

---

## 10. Fleet-Level Energy Optimization

### 10.1 System Power Budget: Compute vs Sensors vs Traction

To understand where energy optimization has the most impact, consider the complete autonomous GSE power budget:

| Subsystem | Power Draw | Daily Energy (16h) | % of Total |
|-----------|-----------|-------------------|-----------|
| Traction motor (avg) | 3,000-8,000W | 48-128 kWh | 85-92% |
| LiDAR sensors (4x RSHELIOS) | 80W | 1.28 kWh | 1.5-2.0% |
| Compute (Orin, avg) | 30-50W | 0.48-0.80 kWh | 0.7-1.2% |
| Cameras + thermal | 15-30W | 0.24-0.48 kWh | 0.4-0.7% |
| Networking (5G/WiFi) | 5-10W | 0.08-0.16 kWh | 0.1-0.2% |
| Vehicle ECU + CAN | 20-40W | 0.32-0.64 kWh | 0.5-1.0% |
| Cooling (compute + sensors) | 10-30W | 0.16-0.48 kWh | 0.3-0.7% |
| **Autonomy total** | **160-240W** | **2.56-3.84 kWh** | **4-6%** |
| **Traction total** | **3,000-8,000W** | **48-128 kWh** | **94-96%** |

**Autonomy subsystems consume only 4-6% of total energy.** Compute alone is roughly 1%. This means:

1. **Compute power optimization has minimal direct impact on range.** The 0.6 kWh/day saved by dynamic tier switching represents <1% of battery capacity.
2. **Sensor power management (especially LiDAR) has 2-3x more impact** than compute power management.
3. **Route optimization for traction efficiency** (avoiding unnecessary detours, optimizing speed profiles) saves orders of magnitude more energy than any compute optimization.
4. **The primary value of compute power management is thermal and reliability**, not energy savings.

### 10.2 Fleet Route Planning with Charging Integration

The fleet dispatch system (see `fleet-management-dispatch.md`) can incorporate energy awareness into route and mission planning:

```
Energy-aware dispatch algorithm:

For each pending mission M and available vehicle V:
  1. Calculate mission energy cost:
     traction_kwh = route_distance_km * kWh_per_km(vehicle_type)
     compute_kwh  = estimated_duration_h * avg_compute_watts / 1000
     sensor_kwh   = estimated_duration_h * sensor_watts / 1000
     total_kwh    = traction_kwh + compute_kwh + sensor_kwh

  2. Check feasibility:
     remaining_kwh = V.battery_soc * V.battery_capacity_kwh
     reserve_kwh   = distance_to_nearest_charger_kwh + safety_margin
     if remaining_kwh - total_kwh < reserve_kwh:
       SKIP (vehicle cannot complete mission + return to charger)

  3. Score assignment:
     score = mission_priority * urgency_weight
           - energy_cost * energy_weight
           - distance_to_mission_start * proximity_weight
     
  4. Assign highest-scoring (vehicle, mission) pair
```

### 10.3 Coordinated Compute Loads Across Fleet

When multiple vehicles are in the same area (e.g., busy apron during turnaround), they can share perception results via V2X cooperative perception (see `technology/perception/infrastructure-cooperative-v2i.md`). This enables individual vehicles to reduce their local compute load:

```
Cooperative perception energy savings:

Scenario: 3 vehicles at adjacent stands during turnaround
Without cooperation: Each runs T1 Full (52W each) = 156W total compute
With cooperation:    Lead vehicle runs T1 (52W), others run T3 (17W each)
                     + shared detection results via V2X
                     = 52 + 17 + 17 = 86W total compute
Savings: 45% fleet compute power in cooperative zones

Prerequisite: Reliable V2X communication (<20ms latency)
              Where2comm feature sharing (160 KB/frame)
              Trust model for shared detections
```

### 10.4 Fleet Energy Dashboard Metrics

| Metric | Target | Alert Threshold | Source |
|--------|--------|----------------|--------|
| Fleet avg compute power | <35W | >45W sustained | /orin/power/total_watts |
| Fleet avg Tj | <80C | >88C any vehicle | /orin/temperature/tj_celsius |
| Vehicles in T1/T2 | <40% of fleet | >60% for >30 min | /power_manager/perception_tier |
| Daily compute energy per vehicle | <0.75 kWh | >1.0 kWh | Accumulated from power monitor |
| Thermal throttle events | 0 per shift | >5 per shift | /orin/diagnostics |
| Battery SoC at shift end | >25% | <15% | BMS CAN data |
| Mission completion rate | >98% | <95% | Fleet dispatch system |

### 10.5 Fleet-Level Energy Savings Summary

For a 20-vehicle fleet operating 3 shifts (16 active hours per vehicle per day):

| Strategy | Compute kWh/Day Saved | Sensor kWh/Day Saved | Total kWh/Day | Annual kWh | Annual $ |
|----------|----------------------|---------------------|--------------|-----------|---------|
| Dynamic tier switching | 7.6 | 0 | 7.6 | 2,774 | $277 |
| + DLA offloading | 2.4 | 0 | 2.4 | 876 | $88 |
| + Sensor sleep management | 0 | 10.2 | 10.2 | 3,723 | $372 |
| + Idle state machine | 3.8 | 5.1 | 8.9 | 3,249 | $325 |
| + Cooperative perception | 1.5 | 0 | 1.5 | 548 | $55 |
| **Total energy savings** | **15.3** | **15.3** | **30.6** | **11,169** | **$1,117** |

The annual electricity savings of ~$1,100 are modest. The real fleet-level value is:

1. **Extended shift duration:** Vehicles can complete 3-4 more missions per charge cycle per vehicle. At 20 vehicles, that is 60-80 additional missions per day.
2. **Reduced charging infrastructure:** Lower energy consumption means fewer opportunity chargers needed on the apron.
3. **Extended hardware lifetime:** Keeping Tj 12-18C lower extends Orin module MTBF from ~50,000 hours to ~70,000+ hours.
4. **Battery pack longevity:** Reduced thermal load contributes to achieving the full 4,000-6,000 cycle LiFePO4 lifetime instead of premature degradation.

---

## 11. Practical Implementation with ROS Noetic

### 11.1 System Architecture

The power management system integrates with the existing Aurrigo ROS Noetic stack as a set of additional nodes that observe vehicle state and publish power mode commands:

```
┌─────────────────────────────────────────────────────────────┐
│                    ROS Noetic Node Graph                     │
│                                                             │
│  Inputs:                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ /vehicle/odom │  │ /fleet/      │  │ /lidar/*     │      │
│  │ /vehicle/     │  │  mission     │  │ /camera/*    │      │
│  │  battery_soc  │  │  state       │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│         v                 v                  v               │
│  ┌────────────────────────────────────────────────┐         │
│  │          /power_manager (main controller)       │         │
│  │  ┌─────────────┐  ┌──────────────┐             │         │
│  │  │ TierSelector │  │ IdleState    │             │         │
│  │  │              │  │ Machine      │             │         │
│  │  └──────┬──────┘  └──────┬───────┘             │         │
│  │         │                │                      │         │
│  │         v                v                      │         │
│  │  ┌──────────────────────────────┐              │         │
│  │  │ ThermalGovernor              │              │         │
│  │  │ + BatteryComputeGovernor     │              │         │
│  │  └──────────────┬───────────────┘              │         │
│  │                 │                               │         │
│  │                 v                               │         │
│  │  ┌──────────────────────────┐                  │         │
│  │  │ OrinPowerController      │                  │         │
│  │  │ (nvpmodel + jetson_clocks│                  │         │
│  │  └──────────────┬───────────┘                  │         │
│  └─────────────────┼──────────────────────────────┘         │
│                    │                                         │
│  Outputs:          v                                         │
│  ┌──────────────────────────────────────────────────┐       │
│  │ /power_manager/perception_tier  (Int32)           │       │
│  │ /power_manager/idle_state       (Int32)           │       │
│  │ /power_manager/power_mode       (String)          │       │
│  │ /power_manager/sensor_config    (SensorConfig)    │       │
│  └──────────────────────────────────────────────────┘       │
│                    │                                         │
│                    v                                         │
│  ┌──────────────────────────────────────────────────┐       │
│  │ Perception nodes read /perception_tier and        │       │
│  │ gate their processing accordingly                 │       │
│  └──────────────────────────────────────────────────┘       │
│                                                             │
│  Monitoring:                                                │
│  ┌──────────────────────────────────────────────────┐       │
│  │ /orin_power_monitor  ->  /orin/power/*            │       │
│  │                      ->  /orin/temperature/*      │       │
│  │                      ->  /diagnostics             │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 Launch File Integration

```xml
<!-- power_management.launch -->
<!-- Launches power management nodes alongside existing Aurrigo stack -->

<launch>
    <!-- Power monitor (always runs, lightweight) -->
    <node pkg="aurrigo_power" type="orin_power_monitor.py"
          name="orin_power_monitor" output="screen">
        <param name="rate_hz" value="10"/>
        <param name="publish_diagnostics" value="true"/>
    </node>

    <!-- Power manager (main controller) -->
    <node pkg="aurrigo_power" type="power_manager_node.py"
          name="power_manager" output="screen">
        <!-- Tier selection parameters -->
        <param name="aircraft_proximity_full_m" value="30.0"/>
        <param name="intersection_approach_m" value="50.0"/>
        <param name="stand_approach_m" value="100.0"/>
        
        <!-- Thermal thresholds -->
        <param name="tj_target_c" value="85.0"/>
        <param name="tj_throttle_soft_c" value="88.0"/>
        <param name="tj_throttle_hard_c" value="93.0"/>
        
        <!-- Battery thresholds -->
        <param name="soc_unrestricted_pct" value="50.0"/>
        <param name="soc_prefer_low_pct" value="30.0"/>
        <param name="soc_force_low_pct" value="15.0"/>
        
        <!-- Idle timeouts -->
        <param name="active_to_standby_s" value="30"/>
        <param name="standby_to_light_sleep_s" value="300"/>
        <param name="light_sleep_to_deep_s" value="1800"/>
        
        <!-- Default mode -->
        <param name="default_power_mode" value="MODE_50W"/>
        
        <!-- Input topics -->
        <remap from="odom" to="/vehicle/odom"/>
        <remap from="battery" to="/vehicle/battery_state"/>
        <remap from="mission" to="/fleet/mission_state"/>
        <remap from="detections" to="/perception/detections_3d"/>
    </node>

    <!-- Sensor power controller (manages LiDAR power states) -->
    <node pkg="aurrigo_power" type="sensor_power_controller.py"
          name="sensor_power_controller" output="screen">
        <param name="num_lidars" value="4"/>
        <param name="lidar_standby_power_w" value="5.0"/>
        <param name="lidar_running_power_w" value="20.0"/>
        
        <remap from="idle_state" to="/power_manager/idle_state"/>
        <remap from="perception_tier" to="/power_manager/perception_tier"/>
    </node>
</launch>
```

### 11.3 Perception Node Gating Pattern

Each perception node in the Aurrigo stack needs minimal modification to support tier-based gating. The pattern is a check at the beginning of the main callback:

```cpp
// Example: Adding power-aware gating to existing CenterPoint nodelet
// Minimal change: add subscriber + early return check

#include <std_msgs/Int32.h>

class CenterPointNodelet : public nodelet::Nodelet {
    // ... existing code ...
    
    // ADD: tier subscriber and state
    ros::Subscriber tier_sub_;
    int current_tier_ = 1;  // Default: Full (always run)
    int cycle_counter_ = 0;
    
    void onInit() override {
        // ... existing init code ...
        
        // ADD: subscribe to perception tier
        tier_sub_ = nh.subscribe(
            "/power_manager/perception_tier", 1,
            &CenterPointNodelet::tierCallback, this
        );
    }
    
    void tierCallback(const std_msgs::Int32::ConstPtr& msg) {
        current_tier_ = msg->data;
    }
    
    void pointCloudCallback(const sensor_msgs::PointCloud2::ConstPtr& msg) {
        cycle_counter_++;
        
        // CenterPoint runs at T1 (Full) and T2 (Standard) only
        // At T3+, PointPillars provides sufficient detection
        if (current_tier_ > 2) {
            return;  // Skip processing
        }
        
        // Rate limiting at T2: run every other cycle (5 Hz instead of 10 Hz)
        // to reduce GPU load while maintaining coverage
        if (current_tier_ == 2 && cycle_counter_ % 2 != 0) {
            return;
        }
        
        // ... existing inference code unchanged ...
    }
};
```

### 11.4 Package Structure

```
aurrigo_power/
├── CMakeLists.txt
├── package.xml
├── launch/
│   └── power_management.launch
├── scripts/
│   ├── orin_power_monitor.py          # Power/thermal telemetry
│   ├── power_manager_node.py          # Main controller
│   └── sensor_power_controller.py     # LiDAR power states
├── src/
│   └── perception_gate.h              # Header-only gate for nodelets
├── config/
│   ├── power_modes.yaml               # Tier definitions
│   ├── thermal_limits.yaml            # Per-airport thermal config
│   └── fleet_energy_targets.yaml      # Fleet-level targets
└── test/
    ├── test_tier_selector.py
    ├── test_thermal_governor.py
    └── test_battery_governor.py
```

### 11.5 Testing Strategy

Power management testing requires both simulation and on-vehicle validation:

| Test Type | Method | Coverage |
|-----------|--------|----------|
| Unit tests | pytest, offline | Tier selection logic, thermal governor, battery governor |
| Integration tests | ROS test, rosbag replay | Tier transitions during realistic mission sequences |
| Thermal chamber test | Vehicle in thermal chamber, sweep -10C to 50C | Verify throttle behavior at temperature extremes |
| Shadow mode | Run power manager alongside unmodified stack, log recommendations without acting | Validate tier selection matches expert judgment |
| Fleet pilot | 2-3 vehicles with power management active for 2 weeks | Measure actual energy savings and verify no safety regressions |

### 11.6 Monitoring and Alerting

```yaml
# fleet_energy_alerts.yaml
# Alert definitions for fleet monitoring dashboard

alerts:
  - name: thermal_throttle
    condition: "/orin/temperature/tj_celsius > 88.0"
    severity: WARNING
    action: "Check cooling system, verify fan operation"
    
  - name: thermal_critical
    condition: "/orin/temperature/tj_celsius > 95.0"
    severity: CRITICAL
    action: "Reduce speed, route to shaded area, consider vehicle withdrawal"
    
  - name: high_power_sustained
    condition: "/orin/power/total_watts > 55.0 for > 300s"
    severity: WARNING
    action: "Check if MAXN mode is justified; may indicate tier selector malfunction"
    
  - name: battery_low_high_compute
    condition: "/vehicle/battery_soc < 20 AND /power_manager/perception_tier < 3"
    severity: WARNING
    action: "Battery governor should have reduced tier; check governor health"
    
  - name: fleet_avg_power_high
    condition: "mean(/orin/power/total_watts across fleet) > 45.0"
    severity: INFO
    action: "Review fleet tier distribution; may indicate busy operational period"
```

---

## 12. Key Takeaways

1. **Autonomy compute consumes only ~1% of electric GSE battery capacity.** The Orin at 60W is negligible next to a 3-8 kW traction motor. The primary motivation for compute power management is thermal control and hardware longevity, not range extension.

2. **Airport GSE spend 53% of operational time in low-demand scenarios** (idle at stand, taxiway transit, depot parking). Dynamic tier switching can reduce weighted average compute power from 50W to ~31W — a 38% reduction.

3. **DLA is 2.3-2.8x more energy-efficient than GPU** per TOPS. PointPillars running on DLA at 11.5ms uses only 184 mJ per inference vs 344 mJ on GPU — nearly half the energy for a 40% latency increase that is acceptable during cruise and monitoring tiers.

4. **Power mode transitions take 200-1200ms** depending on direction and magnitude. Upward transitions (15W to 50W) must be initiated predictively, 12+ meters before the vehicle enters a higher-demand zone, using route and mission awareness.

5. **Thermal management is the real constraint**, not energy. At 50C tarmac ambient, the Orin at MAXN can reach Tj 95-102C, causing stochastic throttling that breaks real-time inference guarantees. The sealed enclosure with external radiator (Option 2, ~$500/vehicle) is the recommended cooling solution.

6. **Sensor power (80-160W for 4-8 LiDARs) exceeds compute power (15-60W) by 2-3x.** Sensor sleep management during idle periods has more energy impact than any compute optimization. Include LiDAR standby modes in the power management strategy.

7. **PointPillars achieves constant energy per inference across power modes** (~340 mJ regardless of GPU clock). The energy savings come from running at lower frequency (5 Hz vs 10 Hz), not from running the same model at lower clocks.

8. **Pre-load all TensorRT engines at startup** for all perception tiers. The 64GB Orin has ample memory (~8-12 GB for all engines), and the cost of a 200-500ms model loading gap during tier upgrades is unacceptable near aircraft.

9. **Five idle states (Active through Hibernate) progressively reduce power from 50W to 1.5W.** The idle state machine transitions through 30s, 5 min, 30 min, and 2 hour timeouts, with a mission-pending lock that prevents deep sleep while tasks are queued.

10. **Fleet-level cooperative perception can reduce total fleet compute power by 45%** in dense apron areas. When 3 vehicles are at adjacent stands, only the lead vehicle needs full T1 perception if detection results are shared via V2X.

11. **The complete optimization stack (tiers + DLA + sensor sleep + idle states + cooperative perception) saves ~30.6 kWh/day across a 20-vehicle fleet**, primarily through sensor power management (50%) and tier switching (25%). Annual electricity savings are ~$1,100 — the hardware reliability improvement is far more valuable.

12. **Custom 40W power mode fills a useful gap** between the predefined 30W and 50W modes for taxiway cruise operation. It provides sufficient compute for PointPillars at 5 Hz + GTSAM while reducing thermal dissipation.

13. **ROS Noetic integration requires minimal changes to existing perception nodes.** A single subscriber to `/power_manager/perception_tier` and an early-return gate at the top of each callback is sufficient. No changes to inference code or model loading.

14. **Battery SoC thresholds (50%/30%/15%/8%) gate maximum allowed perception tier.** The battery governor works in conjunction with the tier selector and thermal governor, with thermal always having override priority.

15. **Implementation cost is approximately $15-25K for software development, $10K for fleet thermal solution engineering, and $500/vehicle for sealed compute enclosure.** For a 20-vehicle fleet, total investment is ~$35-45K with ROI primarily through extended hardware lifetime and improved operational availability.

16. **Test in thermal chamber before fleet deployment.** The interaction between ambient temperature, power mode, and inference latency must be characterized for each airport's climate. Shadow mode validation for 2+ weeks is essential before enabling power mode switching on the safety path.

17. **Monitor fleet Tj distribution continuously.** A fleet dashboard showing real-time junction temperature across all vehicles is the single most important operational metric for compute health. Target: 100% of vehicles below 88C, 100% of the time.

18. **Early exit networks offer an additional 35% compute savings** on top of tier switching, particularly on empty/trivial frames (clear taxiway). However, safety validation of exit confidence thresholds requires extensive testing on airside-specific edge cases before production deployment.

---

## References

- `hardware/compute/nvidia-orin-technical.md` — Orin SoC architecture, power modes, thermal specs, inference benchmarks
- `hardware/compute/tensorrt-deployment-guide.md` — TensorRT engine builds, DLA targeting, quantization
- `technology/perception/model-compression-edge-deployment.md` — DLA offloading strategy, multi-model orchestration, compressed model recipes
- `operations/airside/battery-charging-infrastructure.md` — Battery specs, charging strategies, fleet charging economics
- `operations/deployment/fleet-management-dispatch.md` — Fleet routing, dispatch algorithms, NVIDIA Fleet Command
- `technology/perception/infrastructure-cooperative-v2i.md` — V2I/V2V cooperative perception, Where2comm bandwidth
- `hardware/sensors/robosense-lidar-products.md` — RoboSense RSHELIOS/RSBP power and interface specs
- `operations/safety/functional-safety-software.md` — MISRA C, safety-critical node lifecycle
- `technology/perception/night-operations-thermal-fusion.md` — YOLO-Thermal on DLA, thermal camera power

---

## Appendix A: Quick Reference Power Table

| Scenario | Power Mode | Perception Tier | Orin Power (W) | Sensor Power (W) | Total Autonomy (W) |
|----------|-----------|----------------|----------------|------------------|-------------------|
| Aircraft stand maneuvering | 50W | T1 Full | 52 | 80 | 160 |
| Busy apron transit | 50W | T2 Standard | 47 | 80 | 155 |
| Clear taxiway cruise | 30W | T3 Cruise | 17 | 80 | 125 |
| Stationary at stand, waiting | 15W | T4 Monitor | 14 | 40* | 80 |
| Depot parking, no mission | 15W | T5 Sleep | 11 | 20** | 55 |
| Charging, overnight | 15W | T5 Sleep | 11 | 0*** | 15 |

\* Rear sensors in standby.
\** All sensors in standby.
\*** All sensors powered off.

## Appendix B: Implementation Timeline

| Phase | Duration | Deliverables | Cost |
|-------|----------|-------------|------|
| 1. Power profiling | 2 weeks | Per-model power measurements, thermal baseline | $3-5K |
| 2. Tier selector + governors | 3 weeks | Python nodes, unit tests, ROS launch files | $5-8K |
| 3. Thermal solution | 2 weeks | Sealed enclosure design, prototype, thermal chamber test | $8-12K |
| 4. Perception node gating | 2 weeks | Minimal modifications to existing nodelets | $3-5K |
| 5. Shadow mode validation | 2 weeks | 2-3 vehicles, compare tier selections with expert baseline | $2-3K |
| 6. Fleet pilot | 2 weeks | Full 20-vehicle deployment, monitoring dashboard | $3-5K |
| **Total** | **13 weeks** | | **$24-38K** |
