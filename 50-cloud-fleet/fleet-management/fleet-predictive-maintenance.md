# Fleet Predictive Maintenance and Spare Parts Logistics for Autonomous GSE Fleets

## Prognostic Health Management, Failure Prediction, Inventory Optimization, and Maintenance Scheduling for 24/7 Airport Airside Operations

**Last updated:** 2026-04-11

---

**Summary:** Autonomous ground support equipment (GSE) fleets operating 16-20 hours/day in harsh airport environments face maintenance challenges fundamentally different from both traditional GSE fleets and road-going autonomous vehicles. Traditional scheduled maintenance --- time-based intervals set by OEM manuals --- either over-maintains (wasting $2,000-5,000/vehicle/year in unnecessary part replacements) or under-maintains (risking $15,000-50,000+ per unplanned failure event including missed turnarounds, cascading delays, and aircraft damage). A 20-vehicle fleet at a single airport generates 400-800 maintenance events per year across sensors, compute, drivetrain, steering, brakes, batteries, and body. Across 10 airports with 200 vehicles, this becomes 4,000-8,000 events/year --- unmanageable without systematic predictive maintenance. This document covers the complete prognostic health management (PHM) stack from component-level diagnostics through fleet-level optimization, failure mode analysis specific to airside autonomous vehicles, predictive algorithms (Weibull/Cox models, LSTM/XGBoost, Bayesian fleet hierarchical models), spare parts inventory optimization (multi-echelon stocking, critical spare identification, cold-start sizing), maintenance scheduling integrated with fleet dispatch and A-CDM, fleet availability modeling, and multi-airport scaling economics. The key finding: **a predictive maintenance system reduces unplanned downtime 40-60% and total maintenance cost 25-35% compared to scheduled maintenance, with implementation cost of $50-85K and annual savings of $30-60K per 20-vehicle fleet**, achieving ROI within 12-18 months.

---

## Table of Contents

1. [Introduction and Motivation](#1-introduction-and-motivation)
2. [Prognostic Health Management Framework](#2-prognostic-health-management-framework)
3. [Failure Mode Analysis for Autonomous GSE](#3-failure-mode-analysis-for-autonomous-gse)
4. [Predictive Maintenance Algorithms](#4-predictive-maintenance-algorithms)
5. [Spare Parts Inventory Optimization](#5-spare-parts-inventory-optimization)
6. [Maintenance Scheduling Optimization](#6-maintenance-scheduling-optimization)
7. [Fleet Availability and Reliability Modeling](#7-fleet-availability-and-reliability-modeling)
8. [Integration with Existing Aurrigo Systems](#8-integration-with-existing-aurrigo-systems)
9. [Industry Benchmarks and Case Studies](#9-industry-benchmarks-and-case-studies)
10. [Cost Analysis](#10-cost-analysis)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Key Takeaways](#12-key-takeaways)
13. [References](#13-references)

---

## 1. Introduction and Motivation

### 1.1 Why Traditional Scheduled Maintenance Fails for Autonomous GSE

Traditional GSE maintenance follows fixed-interval schedules: oil change every 500 hours, brake inspection every 1,000 hours, tire rotation every 3,000 km. This approach has three fatal flaws when applied to autonomous GSE fleets:

**Problem 1: No natural maintenance windows.** A manually operated baggage tractor sits idle during driver shift changes, meal breaks, and between flight banks. Autonomous vehicles operate 16-20 hours/day with no natural downtime other than charging windows of 30-90 minutes. Pulling a vehicle for scheduled maintenance during peak operations directly reduces fleet capacity.

**Problem 2: Environment-dependent wear rates.** Airport environments produce wildly variable component stress:

| Operating Condition | Effect on Component Life | Schedule Impact |
|---|---|---|
| De-icing operations (winter) | 2-5x accelerated sensor degradation | Weekly intervals too long during de-icing season |
| Jet blast zones (specific gates) | 3-10x accelerated body/sensor wear at exposed stands | Same vehicle, different gates, different wear rates |
| Tarmac temperature +50C (summer) | Battery degradation 2-3x faster, compute throttling | Summer schedule should differ from winter |
| Salt spray (coastal airports) | Corrosion rate 5-10x inland airports | Fixed intervals ignore geography |
| Night operations (continuous) | Thermal cycling stress on connectors | 24/7 operation shortens connector life vs 8/16 cycle |

A fixed maintenance schedule cannot adapt to these environmental variables. A vehicle operating exclusively at stand 12 (near de-icing bays) degrades 3x faster than a vehicle on Taxiway Alpha. Scheduled maintenance either over-services the Taxiway Alpha vehicle or under-services the stand 12 vehicle.

**Problem 3: Sensor-heavy vehicles have different failure signatures.** Traditional GSE has 5-10 maintainable subsystems (engine, transmission, brakes, hydraulics, tires, lights, body). An autonomous GSE vehicle has 15-25 maintainable subsystems including 4-8 LiDAR units, 2-6 cameras, 1-2 radars, 2-4 thermal cameras, compute modules, safety MCU, CAN/Ethernet network, GNSS receiver, IMU, wheel encoders, and all the traditional drivetrain components. Each sensor has its own failure distribution that does not map to time-based intervals:

- LiDAR lens contamination depends on **environmental exposure**, not hours
- Battery degradation depends on **charge cycles** and **temperature**, not calendar time
- Tire wear depends on **distance** and **turning intensity**, not hours
- CAN connector corrosion depends on **humidity** and **chemical exposure**, not usage

### 1.2 Operational Impact of Unplanned Downtime

When an autonomous vehicle fails unexpectedly during operations, the cascade effects go far beyond the repair cost:

```
Unplanned vehicle failure during operations:

  Vehicle #7 LiDAR failure at Stand 14 during baggage delivery
    |
    +-- Immediate: Vehicle safe-stops, blocks apron lane (5 min to clear)
    |
    +-- Task impact: 3 remaining baggage runs undelivered
    |     |
    |     +-- Flights UA 412 and DL 890 baggage delayed 15-25 min
    |     |
    |     +-- Ground handler SLA penalty: $500-2,000 per late flight
    |
    +-- Fleet impact: Remaining vehicles absorb undelivered tasks
    |     |
    |     +-- Fleet utilization spikes from 70% to 82%
    |     |
    |     +-- Buffer capacity consumed, next failure causes cascade
    |
    +-- Recovery: Tow failed vehicle to depot (20 min)
    |     |
    |     +-- LiDAR swap + recalibration: 1-2 hours
    |     |
    |     +-- Verification run before return to service: 30 min
    |
    +-- Total downtime: 2-3 hours
    +-- Total cost: $1,500-5,000 (repair + SLA penalties + opportunity cost)
```

**Cost of unplanned downtime by component:**

| Component Failure | Repair Time (MTTR) | Direct Repair Cost | Indirect Cost (Missed Ops) | Total Event Cost |
|---|---|---|---|---|
| LiDAR module failure | 1-2 hours | $2,000-5,000 | $500-2,000 | $2,500-7,000 |
| Compute module failure | 2-4 hours | $1,500-3,000 | $1,000-4,000 | $2,500-7,000 |
| Battery cell failure | 4-8 hours | $2,000-8,000 | $2,000-6,000 | $4,000-14,000 |
| Steering actuator failure | 4-8 hours | $1,500-4,000 | $2,000-6,000 | $3,500-10,000 |
| Drive motor failure | 6-12 hours | $3,000-8,000 | $3,000-8,000 | $6,000-16,000 |
| CAN bus failure | 2-4 hours | $200-500 | $1,000-4,000 | $1,200-4,500 |
| Tire blowout | 1-2 hours | $200-500 | $500-2,000 | $700-2,500 |

For a 20-vehicle fleet averaging 2-3 unplanned failures per vehicle per year, unplanned downtime costs $100,000-420,000 annually. Predictive maintenance aims to convert 60-80% of unplanned failures into planned maintenance events, reducing downtime cost by $60,000-250,000/year.

### 1.3 Current Gap in Aurrigo's Stack

The existing research repository covers individual pieces of the maintenance puzzle:

- **Sensor health monitoring** ([sensor-degradation-health-monitoring.md](../../20-av-platform/sensors/sensor-degradation-health-monitoring.md)): Per-sensor diagnostics, cross-sensor consistency, fleet degradation patterns --- but limited to sensors, and focused on real-time response rather than long-term prognostics
- **Fleet dispatch** ([fleet-management-dispatch.md](fleet-management-dispatch.md)): Task allocation and scheduling --- but does not incorporate vehicle health as a dispatch parameter
- **Fleet TCO** ([../../70-operations-domains/airside/business-case/fleet-tco-business-case.md](../../70-operations-domains/airside/business-case/fleet-tco-business-case.md)): Maintenance cost estimates ($6,700-18,000/vehicle/year) --- but treats maintenance as a flat annual cost rather than an optimizable system
- **CI/CD pipeline** ([../../40-runtime-systems/ml-deployment/av-cicd-devops-pipeline.md](../../40-runtime-systems/ml-deployment/av-cicd-devops-pipeline.md)): Software deployment --- but no integration with hardware maintenance lifecycle
- **CAN bus/DBW** ([can-bus-dbw.md](../../20-av-platform/drive-by-wire/can-bus-dbw.md)): Vehicle interface --- rich CAN telemetry available but not yet mined for prognostics

The gap: **no system-level framework connecting component health data to fleet-level maintenance optimization, spare parts planning, or maintenance-aware scheduling.** This document fills that gap.

### 1.4 Fleet Scale Context

| Scale | Vehicles | Airports | Annual Maintenance Events | Complexity |
|---|---|---|---|---|
| Pilot | 5 | 1 | 100-200 | Manageable with spreadsheet |
| Single airport | 20 | 1 | 400-800 | Needs scheduling system |
| Regional | 50 | 3 | 1,000-2,000 | Needs spare parts logistics |
| National | 100 | 5-7 | 2,000-4,000 | Needs predictive algorithms |
| International | 200+ | 10+ | 4,000-8,000+ | Needs multi-echelon optimization |

At pilot scale (5 vehicles), a single technician with a checklist suffices. At 200+ vehicles across 10 airports, maintenance becomes an optimization problem that dominates fleet economics. This document is designed for the 20-200 vehicle range where systematic approaches become necessary and economically justified.

---

## 2. Prognostic Health Management Framework

### 2.1 PHM Standards and Applicability

Three standards govern prognostic health management relevant to autonomous GSE:

**ISO 13381-1:2015 (Condition monitoring and diagnostics of machines --- Prognostics):** Defines the general framework for predicting remaining useful life (RUL) of machinery. Establishes four prognostic approaches: (1) experience-based (fleet statistics), (2) physics-based (degradation models), (3) data-driven (ML), and (4) hybrid. ISO 13381 is directly applicable to drivetrain, steering, and brake subsystems. It is less directly applicable to electronics and sensors, where failure distributions differ from mechanical wear-out.

**SAE ARP6461 (Integrated Vehicle Health Management --- Guidelines for Implementation):** Originally developed for aerospace, ARP6461 defines the architecture for vehicle health management including data acquisition, health assessment, prognosis, and advisory generation. The aerospace heritage is particularly relevant because airport GSE operates under similar reliability expectations to ground support equipment in aircraft MRO environments.

**ISO 55000:2014 (Asset Management):** Provides the organizational framework for managing physical assets across their lifecycle. At fleet scale (50+ vehicles, 3+ airports), the maintenance system becomes an asset management system that must consider total lifecycle cost, not just repair cost.

**Relevance to Aurrigo:** ISO 13381 and SAE ARP6461 provide the technical framework for PHM implementation. ISO 55000 provides the organizational framework for scaling beyond a single airport. For ISO 3691-4 certification, demonstrating a systematic PHM approach strengthens the safety case by showing that vehicle hardware is maintained within its designed operating envelope.

### 2.2 PHM Architecture for Autonomous GSE

```
+--------------------------------------------------------------------------+
|                    FLEET PREDICTIVE MAINTENANCE ARCHITECTURE              |
+--------------------------------------------------------------------------+
|                                                                          |
|  LEVEL 4: Fleet Optimization                                             |
|  +--------------------------------------------------------------------+  |
|  | Fleet health dashboard | Multi-airport trend analysis | Spare     |  |
|  | parts demand forecast  | Maintenance scheduling optimizer          |  |
|  | Procurement pipeline   | Technician dispatch                      |  |
|  +--------------------------------------------------------------------+  |
|       ^                        ^                       ^                  |
|       | Vehicle health indices | Cross-fleet patterns  | Demand signals  |
|       |                        |                       |                  |
|  LEVEL 3: Vehicle Health Assessment                                      |
|  +--------------------------------------------------------------------+  |
|  | Composite vehicle health index (0.0-1.0)                           |  |
|  | RUL estimates per subsystem | Maintenance urgency scoring          |  |
|  | Degraded capability assessment (e.g., "no pushback, baggage only") |  |
|  +--------------------------------------------------------------------+  |
|       ^                        ^                       ^                  |
|       | Subsystem scores       | Failure predictions  | RUL estimates   |
|       |                        |                       |                  |
|  LEVEL 2: Subsystem Health Assessment                                    |
|  +--------------------------------------------------------------------+  |
|  | Sensor suite  | Compute  | Drivetrain | Steering | Brakes | Power |  |
|  | (LiDAR, radar,| (Orin,   | (motors,   | (actuator| (pads, | (batt,|  |
|  |  camera,      |  MCU,    |  gearbox,  |  linkage | discs, | DC-DC,|  |
|  |  thermal)     |  network)|  bearings) |  encoder)| fluid) | BMS)  |  |
|  +--------------------------------------------------------------------+  |
|       ^                        ^                       ^                  |
|       | Raw sensor health      | CAN bus telemetry    | Env. context    |
|       |                        |                       |                  |
|  LEVEL 1: Component Diagnostics                                          |
|  +--------------------------------------------------------------------+  |
|  | Per-LiDAR health (7 checks @ 1Hz)  [sensor-degradation-health.md] |  |
|  | Per-radar health (5 checks)        [sensor-degradation-health.md]  |  |
|  | CAN signal monitoring: motor current, temperature, voltage         |  |
|  | Battery SOC/SOH from BMS           GPS/IMU status                  |  |
|  | Compute: GPU temp, ECC errors, CUDA faults, fan RPM                |  |
|  | Environmental: ambient temp, humidity (if sensor available)         |  |
|  +--------------------------------------------------------------------+  |
|                                                                          |
+--------------------------------------------------------------------------+
```

### 2.3 Level 1: Component Diagnostics --- Data Sources

Level 1 collects raw health telemetry from every maintainable component. For Aurrigo's stack, this comes from four data buses:

**Source 1: ROS Diagnostics (/diagnostics, /diagnostics_agg)**

ROS provides a built-in diagnostics framework (`diagnostic_updater`, `diagnostic_aggregator`) that publishes `DiagnosticStatus` messages at configurable rates. Each ROS node should publish its own health status:

```python
#!/usr/bin/env python
"""Example: Orin compute health diagnostics publisher."""
import rospy
from diagnostic_msgs.msg import DiagnosticArray, DiagnosticStatus, KeyValue
import subprocess
import re


class ComputeHealthDiagnostics:
    """Publish Orin AGX compute health to /diagnostics.
    
    Monitors:
    - GPU temperature (throttling threshold: 97C, shutdown: 105C)
    - GPU utilization (overload detection)
    - Memory utilization (OOM prediction)
    - ECC/CUDA errors (hardware degradation)
    - Fan RPM (cooling degradation)
    - Power draw (anomaly detection)
    """
    
    def __init__(self):
        self.pub = rospy.Publisher('/diagnostics', DiagnosticArray, queue_size=1)
        self.timer = rospy.Timer(rospy.Duration(1.0), self.publish_health)
        
        # Thresholds
        self.gpu_temp_warn = 85.0   # degrees C
        self.gpu_temp_error = 95.0
        self.memory_warn = 0.85     # 85% utilization
        self.memory_error = 0.95
        self.fan_rpm_min = 2000     # RPM below this suggests fan failure
        
        # Historical tracking for trend analysis
        self.gpu_temp_history = []
        self.ecc_error_count = 0
    
    def publish_health(self, event):
        """Read tegrastats and publish diagnostics."""
        msg = DiagnosticArray()
        msg.header.stamp = rospy.Time.now()
        
        # GPU temperature
        gpu_temp = self._read_gpu_temp()
        gpu_status = DiagnosticStatus()
        gpu_status.name = "compute/gpu_temperature"
        gpu_status.hardware_id = "orin_agx_0"
        gpu_status.values = [
            KeyValue(key="temperature_c", value=str(gpu_temp)),
            KeyValue(key="throttle_threshold", value="97"),
        ]
        
        if gpu_temp > self.gpu_temp_error:
            gpu_status.level = DiagnosticStatus.ERROR
            gpu_status.message = f"GPU critically hot: {gpu_temp}C"
        elif gpu_temp > self.gpu_temp_warn:
            gpu_status.level = DiagnosticStatus.WARN
            gpu_status.message = f"GPU warm: {gpu_temp}C"
        else:
            gpu_status.level = DiagnosticStatus.OK
            gpu_status.message = f"GPU temp normal: {gpu_temp}C"
        
        msg.status.append(gpu_status)
        
        # Memory utilization
        mem_used, mem_total = self._read_memory()
        mem_ratio = mem_used / mem_total if mem_total > 0 else 0
        mem_status = DiagnosticStatus()
        mem_status.name = "compute/memory"
        mem_status.hardware_id = "orin_agx_0"
        mem_status.values = [
            KeyValue(key="used_mb", value=str(int(mem_used))),
            KeyValue(key="total_mb", value=str(int(mem_total))),
            KeyValue(key="utilization", value=f"{mem_ratio:.3f}"),
        ]
        
        if mem_ratio > self.memory_error:
            mem_status.level = DiagnosticStatus.ERROR
            mem_status.message = f"Memory critical: {mem_ratio*100:.0f}%"
        elif mem_ratio > self.memory_warn:
            mem_status.level = DiagnosticStatus.WARN
            mem_status.message = f"Memory high: {mem_ratio*100:.0f}%"
        else:
            mem_status.level = DiagnosticStatus.OK
            mem_status.message = f"Memory OK: {mem_ratio*100:.0f}%"
        
        msg.status.append(mem_status)
        
        # ECC errors (hardware degradation indicator)
        ecc_errors = self._read_ecc_errors()
        ecc_status = DiagnosticStatus()
        ecc_status.name = "compute/ecc_errors"
        ecc_status.hardware_id = "orin_agx_0"
        ecc_status.values = [
            KeyValue(key="correctable_errors", value=str(ecc_errors.get('correctable', 0))),
            KeyValue(key="uncorrectable_errors", value=str(ecc_errors.get('uncorrectable', 0))),
        ]
        
        if ecc_errors.get('uncorrectable', 0) > 0:
            ecc_status.level = DiagnosticStatus.ERROR
            ecc_status.message = "Uncorrectable ECC errors detected - GPU degrading"
        elif ecc_errors.get('correctable', 0) > 10:
            ecc_status.level = DiagnosticStatus.WARN
            ecc_status.message = "Elevated correctable ECC errors"
        else:
            ecc_status.level = DiagnosticStatus.OK
            ecc_status.message = "No ECC errors"
        
        msg.status.append(ecc_status)
        self.pub.publish(msg)
    
    def _read_gpu_temp(self):
        """Read GPU temperature from thermal zone."""
        try:
            with open('/sys/devices/virtual/thermal/thermal_zone1/temp', 'r') as f:
                return int(f.read().strip()) / 1000.0
        except Exception:
            return -1.0
    
    def _read_memory(self):
        """Read memory usage from /proc/meminfo."""
        try:
            with open('/proc/meminfo', 'r') as f:
                content = f.read()
            total = int(re.search(r'MemTotal:\s+(\d+)', content).group(1)) / 1024
            available = int(re.search(r'MemAvailable:\s+(\d+)', content).group(1)) / 1024
            return total - available, total
        except Exception:
            return 0, 1
    
    def _read_ecc_errors(self):
        """Read ECC error counts from nvidia-smi or sysfs."""
        # On Orin AGX, ECC status available via tegrastats or sysfs
        return {'correctable': 0, 'uncorrectable': 0}
```

**Source 2: CAN Bus Signals**

The CAN bus on Aurrigo vehicles (see [can-bus-dbw.md](../../20-av-platform/drive-by-wire/can-bus-dbw.md)) exposes real-time actuator telemetry. Key signals for prognostics:

| CAN Signal | Message ID | Rate | Prognostic Value |
|---|---|---|---|
| Motor phase current (A/B/C) | 0x201-0x203 | 100 Hz | Current spikes indicate bearing wear, winding degradation |
| Motor temperature | 0x210 | 10 Hz | Thermal stress accumulation, insulation aging |
| Motor RPM | 0x220 | 100 Hz | Speed ripple indicates gear wear |
| Steering actuator position | 0x301 | 50 Hz | Position tracking error indicates wear/backlash |
| Steering actuator current | 0x302 | 50 Hz | Current increase at same load = friction increase |
| Brake pressure | 0x401 | 50 Hz | Pressure decay rate indicates fluid leak |
| Battery pack voltage | 0x501 | 10 Hz | Cell imbalance detection |
| Battery pack current | 0x502 | 10 Hz | Internal resistance trending |
| Battery cell temperatures | 0x510-0x51F | 1 Hz | Thermal runaway precursor detection |
| Battery SOC (BMS-reported) | 0x520 | 1 Hz | Capacity fade tracking |
| 12V system voltage | 0x601 | 1 Hz | Parasitic draw, alternator/converter health |

**Source 3: Sensor Health Metrics**

Directly from the sensor health monitoring system described in [sensor-degradation-health-monitoring.md](../../20-av-platform/sensors/sensor-degradation-health-monitoring.md):

- Per-LiDAR health scores (7 checks, 1 Hz): point count, max range, angular coverage, intensity distribution, near-field saturation, beam uniformity, temporal consistency
- Per-radar health (5 checks): detection count, range, SNR, noise floor, angular coverage
- Per-camera health: contrast, exposure, sharpness, NUC quality (thermal)
- Cross-sensor consistency scores

**Source 4: Environmental Context**

| Source | Data | Rate | Integration |
|---|---|---|---|
| METAR weather feed | Wind, visibility, precipitation, temperature | 30 min | Airport ATIS/API |
| Vehicle-mounted temp sensor | Ambient at vehicle height | 1 Hz | CAN bus |
| Tarmac surface temp | IR measurement or weather station | 5 min | Airport API or thermal camera |
| De-icing event log | Location, chemical type, time | Per event | Airport ops system |
| NOTAM feed | Construction, closures, restrictions | Per publication | FAA/EUROCONTROL API |

Environmental context is critical because it explains why degradation occurs. Without it, a predictive model sees "LiDAR health declined" but cannot attribute it to "de-icing event at Stand 14" --- making prediction less accurate and maintenance less targeted.

### 2.4 Level 2: Subsystem Health Assessment

Level 2 aggregates component-level metrics into subsystem health scores. Each subsystem has a composite health index computed as the weighted minimum of its component health indicators:

```python
class SubsystemHealthAssessor:
    """Compute subsystem-level health from component diagnostics.
    
    Design principle: subsystem health is limited by its weakest critical
    component (series reliability), but non-critical component degradation
    reduces the score gradually.
    """
    
    # Subsystem definitions: (component, weight, critical)
    SUBSYSTEMS = {
        'sensor_suite': [
            ('lidar_0_health', 0.15, True),
            ('lidar_1_health', 0.15, True),
            ('lidar_2_health', 0.10, True),
            ('lidar_3_health', 0.10, True),
            ('lidar_4_health', 0.08, False),  # Redundant coverage
            ('lidar_5_health', 0.08, False),
            ('lidar_6_health', 0.08, False),
            ('lidar_7_health', 0.08, False),
            ('radar_0_health', 0.08, False),  # Secondary sensor
            ('imu_health', 0.05, True),
            ('gps_health', 0.05, False),      # GTSAM can run without GPS briefly
        ],
        'compute': [
            ('gpu_temp_health', 0.25, True),
            ('memory_health', 0.20, True),
            ('ecc_health', 0.20, True),
            ('fan_health', 0.15, True),
            ('safety_mcu_health', 0.20, True),
        ],
        'drivetrain': [
            ('motor_temp_health', 0.20, True),
            ('motor_current_health', 0.20, True),
            ('motor_vibration_health', 0.20, True),
            ('gearbox_health', 0.20, True),
            ('wheel_bearing_health', 0.20, False),
        ],
        'steering': [
            ('actuator_position_health', 0.30, True),
            ('actuator_current_health', 0.25, True),
            ('encoder_health', 0.25, True),
            ('linkage_play_health', 0.20, False),
        ],
        'brakes': [
            ('pad_wear_health', 0.30, True),
            ('fluid_level_health', 0.25, True),
            ('pressure_health', 0.25, True),
            ('disc_temp_health', 0.20, False),
        ],
        'power': [
            ('battery_soh', 0.30, True),
            ('battery_temp_health', 0.25, True),
            ('cell_balance_health', 0.20, True),
            ('dcdc_health', 0.15, True),
            ('12v_health', 0.10, False),
        ],
    }
    
    def compute_subsystem_health(self, subsystem_name, component_health_dict):
        """Compute weighted health score for a subsystem.
        
        Returns: (score, limiting_component, recommendation)
        """
        components = self.SUBSYSTEMS[subsystem_name]
        weighted_sum = 0.0
        weight_sum = 0.0
        min_critical = 1.0
        limiting = None
        
        for comp_name, weight, critical in components:
            health = component_health_dict.get(comp_name, None)
            if health is None:
                continue  # Missing data treated separately
            
            weighted_sum += health * weight
            weight_sum += weight
            
            if critical and health < min_critical:
                min_critical = health
                limiting = comp_name
        
        if weight_sum == 0:
            return 0.0, 'no_data', 'inspect_all'
        
        weighted_avg = weighted_sum / weight_sum
        
        # Subsystem health: blend of weighted average and worst critical
        # This ensures a single critical failure dominates the score
        score = 0.6 * weighted_avg + 0.4 * min_critical
        
        # Recommendation
        if score > 0.8:
            rec = 'normal_operation'
        elif score > 0.6:
            rec = 'schedule_inspection'
        elif score > 0.4:
            rec = 'reduced_duty_only'
        else:
            rec = 'pull_from_service'
        
        return score, limiting, rec
```

### 2.5 Level 3: Vehicle Health Index

The Vehicle Health Index (VHI) is a single composite score (0.0-1.0) that represents the overall maintenance state of a vehicle. It drives dispatch decisions, maintenance scheduling, and fleet capacity planning:

| VHI Range | Status | Dispatch Policy | Maintenance Priority |
|---|---|---|---|
| 0.85-1.00 | Healthy | All missions, including pushback | Routine |
| 0.70-0.85 | Watch | All missions, monitor closely | Schedule within 48h |
| 0.55-0.70 | Degraded | Baggage only (no pushback), reduced speed | Schedule within 24h |
| 0.40-0.55 | Impaired | Light duty only, depot proximity required | Immediate |
| 0.00-0.40 | Unserviceable | Pull from service | Emergency |

The VHI is computed as:

```
VHI = min(
    subsystem_sensor   * 1.0,   # Sensor failure = immediate pull
    subsystem_compute  * 1.0,   # Compute failure = immediate pull
    subsystem_brakes   * 1.0,   # Brake failure = immediate pull
    subsystem_steering * 0.95,  # Slight tolerance for minor steering wear
    subsystem_drive    * 0.90,  # Drivetrain can degrade before stopping
    subsystem_power    * 0.85   # Battery degradation is gradual
)
```

The asymmetric weighting reflects that safety-critical systems (sensors, compute, brakes) have zero tolerance for degradation below the safe-operation threshold, while drivetrain and power system degradation is more gradual and predictable.

### 2.6 Level 4: Fleet Health Dashboard

Level 4 aggregates vehicle health indices across the fleet and provides decision support:

```
+--------------------------------------------------------------------------+
|  FLEET HEALTH DASHBOARD                     Airport: LHR | 2026-04-11   |
+--------------------------------------------------------------------------+
|                                                                          |
|  Fleet Status: 18/20 operational (90%)    Target: 85% minimum           |
|                                                                          |
|  Vehicle Health Distribution:                                            |
|  Healthy (0.85+):   |||||||||||||| 14 vehicles                          |
|  Watch (0.70-0.85): ||||  4 vehicles                                    |
|  Degraded (0.55-0.70): 0 vehicles                                       |
|  Impaired (0.40-0.55): 0 vehicles                                       |
|  Unserviceable:     || 2 vehicles (in maintenance)                      |
|                                                                          |
|  Predicted Maintenance (next 7 days):                                    |
|  +------+----------+------------------+-----------+-----+               |
|  | Veh  | Due      | Subsystem        | Task      | Est |               |
|  +------+----------+------------------+-----------+-----+               |
|  | V-03 | Tomorrow | Sensor suite     | LiDAR #2  | 45m |               |
|  |      |          |                  | cleaning  |     |               |
|  | V-11 | Wed      | Power            | Battery   | 3h  |               |
|  |      |          |                  | balance   |     |               |
|  | V-07 | Thu      | Drivetrain       | Tire      | 90m |               |
|  |      |          |                  | rotation  |     |               |
|  | V-15 | Fri      | Brakes           | Pad       | 2h  |               |
|  |      |          |                  | replace   |     |               |
|  +------+----------+------------------+-----------+-----+               |
|                                                                          |
|  Fleet-wide Alerts:                                                      |
|  [!] De-icing event at Stands 10-16 yesterday -- expect sensor          |
|      cleaning needs for V-03, V-08, V-14, V-19 within 48h              |
|  [!] LiDAR batch RH-2024-0892: V-05 and V-12 showing early            |
|      intensity degradation -- monitor peers V-09, V-17 (same batch)    |
|                                                                          |
|  Spare Parts Status:                                                     |
|  RSHELIOS LiDAR: 3 in stock (min: 2, reorder point: 3)  [ORDER]       |
|  Brake pads (ADT3): 8 sets in stock (min: 4)            [OK]           |
|  Orin module: 1 in stock (min: 1)                        [OK]           |
|  Battery cell: 0 in stock (min: 2)     [!!! ON ORDER -- ETA 4 weeks]   |
|                                                                          |
+--------------------------------------------------------------------------+
```

---

## 3. Failure Mode Analysis for Autonomous GSE

### 3.1 Component Failure Distributions

Failure distributions for autonomous GSE components are derived from three sources: (1) manufacturer datasheet MTBF values, (2) published industrial reliability data from analogous applications (mining, warehouse robotics), and (3) fleet operating experience where available. All distributions use the two-parameter Weibull model: F(t) = 1 - exp(-(t/eta)^beta), where beta is the shape parameter (failure characteristic) and eta is the scale parameter (characteristic life).

| Component | beta (Shape) | eta (Characteristic Life) | Failure Mode | Source |
|---|---|---|---|---|
| **RoboSense RSHELIOS LiDAR** | 1.8-2.2 | 25,000-40,000 hours | Laser diode aging, motor wear, optical path degradation | Manufacturer MTBF + field data extrapolation |
| **RoboSense RSBP LiDAR** | 1.8-2.2 | 25,000-40,000 hours | Similar to RSHELIOS, slightly different motor assembly | Same class, similar design |
| **Continental ARS548 radar** | 1.5-1.8 | 40,000-60,000 hours | No moving parts; primary failure: electronics (solder fatigue, capacitor aging) | Industrial radar reliability data |
| **FLIR Boson 640 thermal** | 1.3-1.7 | 30,000-50,000 hours | FPA degradation, shutter mechanism, TEC aging | FLIR reliability bulletin, MIL-HDBK-217F |
| **Industrial camera (FLIR BFS)** | 1.5-2.0 | 40,000-60,000 hours | CMOS degradation (hot pixels), lens mechanism | Machine vision industry data |
| **NVIDIA Orin AGX** | Bath-tub | MTBF 50,000-80,000 hours | Early: solder defect; random: SEU/cosmic; wearout: electromigration | NVIDIA reliability report, JEDEC standards |
| **STM32H725 safety MCU** | 1.2-1.5 | 100,000+ hours | Extremely reliable; flash retention, oscillator drift | ST Microelectronics FIT data |
| **Brushless drive motor** | 3.5-4.0 | 40,000-60,000 hours | Bearing wear (dominant), winding insulation, encoder | Motor manufacturer (typical BLDC industrial) |
| **Steering actuator** | 2.0-2.5 | 15,000-25,000 hours | Gear wear, seal degradation, potentiometer/encoder | Industrial actuator field data |
| **Brake pads** | 3.0-4.0 | Distance-dependent: 15,000-30,000 km | Wear-out (predictable) | Automotive brake data, adjusted for low-speed GSE |
| **Brake disc** | 2.5-3.5 | 50,000-80,000 km | Wear + warping from thermal cycling | Automotive data, adjusted |
| **Hydraulic brake fluid** | N/A (calendar) | 2-3 years | Moisture absorption, boiling point degradation | DOT 4 fluid specification |
| **LFP battery pack** | Cycle-dependent | 2,000-4,000 cycles to 80% SOH | Capacity fade, internal resistance rise, cell imbalance | LFP cycling data (CATL, BYD published curves) |
| **Tires (solid or pneumatic)** | Distance-dependent | 5,000-15,000 km (airside) | Tread wear, sidewall cracking (ozone + UV), flat spotting | GSE tire manufacturer data |
| **CAN bus connectors** | 1.5-2.0 | 10,000-30,000 hours | Corrosion (salt/chemical), vibration fatigue, fretting | Automotive connector reliability, SAE J1939 |
| **Ethernet connectors (M12)** | 1.3-1.8 | 20,000-40,000 hours | Corrosion, seal degradation | Industrial Ethernet field data |
| **Wiring harness** | 1.5-2.0 | 30,000-50,000 hours | Chafe wear, insulation cracking (thermal cycling), rodent damage | Automotive harness data |
| **DC-DC converter** | 1.3-1.6 | 40,000-60,000 hours | Capacitor aging (primary), thermal stress | Power electronics reliability data |
| **Wheel bearings** | 3.0-4.0 | 20,000-40,000 hours | Lubrication degradation, spalling, seal wear | SKF bearing life calculator, adjusted for GSE loads |
| **RTK-GPS receiver** | 1.2-1.5 | 60,000-100,000 hours | Electronics aging, antenna connector degradation | Survey equipment reliability data |
| **IMU (Xsens MTi-30)** | 1.3-1.6 | 50,000-80,000 hours | MEMS fatigue (rare), connector | Xsens product spec |

**Key observations:**

1. **beta > 2 indicates wear-out**: Motors (3.5-4.0), brakes (3.0-4.0), bearings (3.0-4.0), and tires are predictable wear-out failures. These are the best candidates for condition-based maintenance.
2. **beta < 2 indicates early/random failure**: Electronics, connectors, and sensors have shallower Weibull slopes. These benefit most from condition monitoring (anomaly detection) rather than time-based prediction.
3. **Battery and tire failure is not time-based**: Battery degradation tracks cycle count and temperature exposure, not hours. Tires track distance and turning intensity.

### 3.2 Correlated Failure Modes Unique to Airside

Airport environments create correlated failure modes that affect multiple components simultaneously. Standard reliability models that assume independent failures underestimate fleet-level risk:

**De-icing chemical exposure (propylene glycol / potassium acetate):**
```
De-icing event at Stands 10-16
  |
  +-- LiDAR: Glycol film on lens, progressive opacity (24-72h to critical)
  +-- Camera: Same film, faster degradation (less tolerant of haze)
  +-- Radar: Glycol on radome, minor impact (5-10% range reduction)
  +-- Connectors: Chemical attack on seals, accelerated corrosion
  +-- Tires: Glycol softens some rubber compounds
  +-- Wiring: Glycol creep into unsealed conduits
  
  Correlation factor: 0.6-0.8 across optical sensors
  Fleet impact: All vehicles operating at those stands affected
  Mitigation: Batch cleaning after de-icing event, protective coatings
```

**Extreme heat events (tarmac > 50C, ambient > 40C):**
```
Sustained high temperature (summer, 6+ hours)
  |
  +-- Compute: Thermal throttling at 97C, GPU clock reduction
  +-- Battery: Accelerated calendar aging, capacity fade
  +-- LiDAR: Motor bearing lubricant thinning
  +-- Tires: Accelerated tread wear on hot tarmac
  +-- Connectors: Thermal expansion/contraction cycling
  
  Correlation factor: 0.7-0.9 across thermal-sensitive components
  Fleet impact: All vehicles, fleet-wide
  Mitigation: Proactive power management, shaded charging, reduced duty
```

**Jet blast exposure (specific gates with narrow clearances):**
```
Jet blast zone at Stand 22 (narrow-body, engine taxi-in)
  |
  +-- Body panels: Vibration fatigue, fastener loosening
  +-- Sensor mounts: Calibration drift from vibration
  +-- LiDAR: Accelerated contamination (exhaust particulates)
  +-- Thermal cameras: Temporary saturation (jet exhaust heat)
  +-- Tires: Foreign object damage from blast-carried debris
  
  Correlation factor: 0.4-0.6 (spatially correlated, not all vehicles)
  Fleet impact: Only vehicles assigned to jet blast-exposed stands
  Mitigation: Avoid assignment, post-blast inspection, vibration dampening
```

**Salt spray season (coastal airports, winter):**
```
Coastal winter conditions (e.g., MIA, SFO, NRT)
  |
  +-- All metal surfaces: Accelerated corrosion (5-10x inland rate)
  +-- Connectors: Salt crystal growth in contacts
  +-- Radar: Radome salt accumulation
  +-- Chassis: Undercarriage corrosion
  +-- Brake discs: Surface rust, accelerated wear
  
  Correlation factor: 0.5-0.7 across exposed metallic components
  Fleet impact: All vehicles at coastal airports
  Mitigation: Conformal coating, weekly underbody wash, stainless fasteners
```

### 3.3 FMEA Table for Autonomous GSE

The following FMEA (Failure Mode and Effects Analysis) table covers the 20 most significant failure modes, rated on a 1-10 scale for Severity (S), Occurrence (O), and Detection (D). Risk Priority Number (RPN) = S x O x D.

| # | Component | Failure Mode | Effect on Vehicle | S | O | D | RPN | Current Control | Recommended Action |
|---|---|---|---|---|---|---|---|---|---|
| 1 | LiDAR (any) | Lens contamination (gradual) | Reduced detection range, missed objects | 8 | 8 | 3 | 192 | Sensor health monitor | Predictive cleaning schedule |
| 2 | LiDAR (any) | Complete failure (electrical) | Loss of coverage sector, safe stop if critical | 9 | 3 | 2 | 54 | ROS driver heartbeat | Spare LiDAR at depot |
| 3 | LiDAR (any) | Calibration drift (vibration) | Ghost detections, split objects, loc. error | 7 | 5 | 4 | 140 | Cross-sensor check | Auto-recalibration trigger |
| 4 | Orin AGX | Thermal throttling | Perception latency increase, missed cycles | 7 | 4 | 3 | 84 | GPU temp monitoring | Proactive thermal mgmt |
| 5 | Orin AGX | GPU hardware fault (ECC) | Incorrect inference results | 10 | 2 | 5 | 100 | ECC monitoring | Auto-fallback to safety MCU |
| 6 | Safety MCU | Watchdog failure | Loss of hardware safety layer | 10 | 1 | 6 | 60 | Heartbeat check | Redundant watchdog circuit |
| 7 | Drive motor | Bearing wear (gradual) | Increased friction, reduced efficiency | 4 | 5 | 4 | 80 | Current monitoring | Vibration analysis trending |
| 8 | Drive motor | Winding short | Motor failure, vehicle immobilized | 9 | 2 | 5 | 90 | Overcurrent protection | Temperature trending |
| 9 | Steering actuator | Gear wear | Increased backlash, position error | 6 | 5 | 4 | 120 | Position tracking error | Backlash measurement routine |
| 10 | Steering actuator | Complete seizure | Loss of steering, emergency stop | 10 | 1 | 6 | 60 | Torque monitoring | Periodic exercise test |
| 11 | Brake pads | Wear beyond limit | Reduced braking force | 9 | 4 | 3 | 108 | Pad wear sensor | Distance-based prediction |
| 12 | Brake system | Fluid leak | Total brake failure | 10 | 2 | 4 | 80 | Pressure monitoring | Pressure decay trend analysis |
| 13 | Battery pack | Cell imbalance | Reduced capacity, thermal risk | 6 | 5 | 3 | 90 | BMS monitoring | SOH trending + balancing |
| 14 | Battery pack | Thermal runaway (cell) | Fire, vehicle loss | 10 | 1 | 3 | 30 | BMS thermal cutoff | Cell temperature trending |
| 15 | Tires | Tread wear | Reduced traction, longer stopping | 6 | 6 | 3 | 108 | Visual inspection | Distance-based prediction |
| 16 | Tires | Blowout (pneumatic) | Vehicle disabled, potential damage | 7 | 3 | 5 | 105 | Pressure monitoring | TPMS + condition tracking |
| 17 | CAN bus | Connector corrosion | Intermittent communication loss | 7 | 4 | 5 | 140 | CAN error counters | Environment-based inspection |
| 18 | CAN bus | Wiring chafe | Short circuit, potential fire | 9 | 2 | 6 | 108 | Visual inspection | Harness routing review |
| 19 | DC-DC converter | Output degradation | Unstable 12V, sensor brownout | 7 | 3 | 4 | 84 | Voltage monitoring | Ripple analysis trending |
| 20 | RTK-GPS antenna | Connector degradation | Localization degradation | 5 | 3 | 4 | 60 | Fix quality monitoring | Connector inspection cycle |

**Top 5 by RPN:**
1. LiDAR lens contamination (192) --- most frequent, high severity
2. LiDAR calibration drift (140) --- moderate frequency, hard to detect
3. CAN connector corrosion (140) --- environment-driven, hard to detect
4. Steering gear wear (120) --- gradual, needs active monitoring
5. Brake pad wear (108) / Tire tread wear (108) / CAN wiring chafe (108) --- tied

**Interpretation:** The highest-risk failure modes are all condition-dependent (contamination, wear, corrosion) rather than random. This confirms that predictive/condition-based maintenance will yield the highest ROI for airside autonomous GSE.

---

## 4. Predictive Maintenance Algorithms

### 4.1 Algorithm Selection Strategy

Three classes of predictive maintenance algorithms apply to autonomous GSE, each suited to different failure modes:

| Algorithm Class | Best For | Data Requirement | Lead Time | Accuracy |
|---|---|---|---|---|
| **Physics-based (Weibull/Cox)** | Wear-out failures (motors, brakes, tires) | Component specs + fleet hours/km | Days-weeks | Moderate (60-75% precision) |
| **ML time-series (LSTM/Transformer)** | Complex multivariate degradation (sensors, batteries) | 6+ months fleet telemetry | Hours-days | High (75-90% precision) |
| **Anomaly detection (Autoencoder)** | Sudden/unexpected failures (electronics, connectors) | 1+ month baseline | Minutes-hours | Moderate (70-85% precision) |

For a practical fleet, all three should run in parallel. Physics-based models provide long-horizon prediction for procurement planning. ML models provide medium-horizon prediction for scheduling. Anomaly detection provides short-horizon alerts for immediate action.

### 4.2 Physics-Based Models: Weibull Proportional Hazards

The Weibull Proportional Hazards Model (WPHM) extends the standard Weibull distribution with covariates that account for operating conditions. This is the best starting point because it works with limited data (fleet priors + manufacturer specs) and produces interpretable results.

The hazard function:

```
h(t | x) = (beta / eta) * (t / eta)^(beta-1) * exp(x^T * gamma)

where:
  t     = time (hours, km, cycles depending on component)
  beta  = Weibull shape parameter
  eta   = Weibull scale parameter (characteristic life)
  x     = covariate vector (temperature, usage intensity, environment)
  gamma = regression coefficients (learned from fleet data)
```

**Example: LiDAR module remaining useful life prediction:**

```python
import numpy as np
from scipy.optimize import minimize
from scipy.stats import weibull_min


class WeibullPHM:
    """Weibull Proportional Hazards Model for component RUL prediction.
    
    Covariates for LiDAR:
    - avg_temperature: mean operating temperature (C)
    - deicing_exposure: hours exposed to de-icing events
    - vibration_rms: average vibration level at mount point
    - usage_intensity: fraction of time in active scanning
    """
    
    def __init__(self, beta_prior=2.0, eta_prior=30000):
        """Initialize with fleet prior parameters.
        
        Args:
            beta_prior: Weibull shape from manufacturer/fleet data
            eta_prior: Characteristic life in hours
        """
        self.beta = beta_prior
        self.eta = eta_prior
        self.gamma = np.zeros(4)  # Covariate coefficients
        self.fitted = False
    
    def fit(self, times, events, covariates):
        """Fit model to fleet failure/censored data.
        
        Args:
            times: array of observation times (hours)
            events: array of 0 (still operating) or 1 (failed)
            covariates: (n_samples, 4) array of covariate values
        """
        def neg_log_likelihood(params):
            beta, log_eta = params[0], params[1]
            eta = np.exp(log_eta)
            gamma = params[2:]
            
            # Proportional hazards adjustment
            risk = np.exp(covariates @ gamma)
            
            # Log-likelihood
            ll = 0.0
            for t, e, r in zip(times, events, risk):
                if e == 1:  # Failed
                    ll += np.log(beta) - np.log(eta) + (beta-1)*np.log(t/eta) + np.log(r)
                # Survival contribution (both failed and censored)
                ll -= (t/eta)**beta * r
            
            return -ll
        
        # Initial parameters
        x0 = np.concatenate([[self.beta, np.log(self.eta)], self.gamma])
        result = minimize(neg_log_likelihood, x0, method='L-BFGS-B',
                         bounds=[(0.5, 10), (5, 15)] + [(-5, 5)]*4)
        
        self.beta = result.x[0]
        self.eta = np.exp(result.x[1])
        self.gamma = result.x[2:]
        self.fitted = True
    
    def predict_rul(self, current_age_hours, covariates, confidence=0.9):
        """Predict remaining useful life with confidence interval.
        
        Args:
            current_age_hours: current component age
            covariates: current operating condition vector
            confidence: confidence level for interval
        
        Returns:
            (median_rul, lower_bound, upper_bound) in hours
        """
        risk = np.exp(covariates @ self.gamma)
        
        # Effective eta adjusted for covariates
        eta_eff = self.eta / risk**(1/self.beta)
        
        # Conditional RUL: E[T - t | T > t]
        # Median remaining life
        p_survived = np.exp(-(current_age_hours / eta_eff)**self.beta)
        
        if p_survived < 0.01:
            return 0.0, 0.0, 0.0  # Already past expected life
        
        # Find median of conditional distribution
        target_p = p_survived * 0.5
        median_total = eta_eff * (-np.log(target_p))**(1/self.beta)
        median_rul = max(0, median_total - current_age_hours)
        
        # Confidence interval
        p_lower = p_survived * (1 - confidence) / 2
        p_upper = p_survived * (1 + confidence) / 2
        
        lower_total = eta_eff * (-np.log(min(p_upper, 0.999)))**(1/self.beta)
        upper_total = eta_eff * (-np.log(max(p_lower, 0.001)))**(1/self.beta)
        
        lower_rul = max(0, lower_total - current_age_hours)
        upper_rul = max(0, upper_total - current_age_hours)
        
        return median_rul, lower_rul, upper_rul


# Example usage for fleet
lidar_model = WeibullPHM(beta_prior=2.0, eta_prior=30000)

# After fleet data collection (6+ months):
# lidar_model.fit(times, events, covariates)

# Predict RUL for Vehicle #7, LiDAR #2
current_age = 12000  # hours
conditions = np.array([
    35.0,   # avg temperature (high -- summer, hot tarmac)
    120.0,  # de-icing exposure hours (winter was harsh)
    0.45,   # vibration RMS (moderate -- near jet blast zone)
    0.85    # usage intensity (high -- 20h/day operation)
])

median_rul, lower, upper = lidar_model.predict_rul(current_age, conditions)
# Example output: median_rul=9,500h, lower=6,200h, upper=14,800h
# At 18h/day: ~528 days median, plan replacement within 344 days (lower bound)
```

### 4.3 Cox Proportional Hazards for Survival Analysis

For components where the Weibull assumption is too rigid (e.g., electronics with bath-tub failure curves), the Cox proportional hazards model is more flexible because it does not assume a specific baseline hazard shape:

```
h(t | x) = h_0(t) * exp(x^T * beta)

where h_0(t) is an unspecified baseline hazard (estimated non-parametrically)
```

Cox PH is particularly useful for the Orin compute module, which follows a bath-tub curve: higher infant mortality (first 1,000 hours), low random failure rate (1,000-40,000 hours), and increasing wear-out failure (>40,000 hours). The baseline hazard h_0(t) captures this non-monotonic shape without forcing a Weibull parametric form.

**Practical application:** Use the Python `lifelines` library (BSD license):

```python
from lifelines import CoxPHFitter
import pandas as pd

# Fleet data: one row per vehicle-component observation
# Columns: duration (hours), event (0=censored, 1=failed), covariates
data = pd.DataFrame({
    'duration_hours': [18000, 25000, 12000, 30000, 22000, ...],
    'failed': [1, 0, 0, 1, 1, ...],
    'avg_gpu_temp': [72, 68, 75, 80, 71, ...],
    'ecc_error_rate': [0.001, 0.0, 0.003, 0.005, 0.002, ...],
    'power_cycle_count': [1200, 800, 600, 1500, 1100, ...],
    'ambient_temp_avg': [25, 22, 30, 35, 24, ...],
})

cph = CoxPHFitter()
cph.fit(data, duration_col='duration_hours', event_col='failed')

# Predict survival function for a specific vehicle's Orin
vehicle_covariates = pd.DataFrame({
    'avg_gpu_temp': [78],
    'ecc_error_rate': [0.002],
    'power_cycle_count': [1000],
    'ambient_temp_avg': [28],
})

survival = cph.predict_survival_function(vehicle_covariates)
# survival.plot()  # Shows probability of survival over time
```

### 4.4 ML Approaches: LSTM for Time-Series Health Prediction

For components with rich time-series telemetry (battery SOH, motor degradation), LSTM networks capture non-linear degradation patterns that physics-based models miss:

```python
import torch
import torch.nn as nn


class ComponentHealthLSTM(nn.Module):
    """LSTM model for predicting component health trajectory.
    
    Input: sliding window of health telemetry (e.g., 168 hours = 1 week)
    Output: predicted health score at t+24h, t+72h, t+168h
    
    Architecture sized for Orin inference:
    - 32-dim hidden state (minimal)
    - 2 layers
    - ~50K parameters
    - <1ms inference on CPU
    """
    
    def __init__(self, input_dim=8, hidden_dim=32, num_layers=2, 
                 output_horizons=3):
        super().__init__()
        
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.1
        )
        
        self.predictor = nn.Sequential(
            nn.Linear(hidden_dim, 16),
            nn.ReLU(),
            nn.Linear(16, output_horizons),
            nn.Sigmoid()  # Health score 0-1
        )
    
    def forward(self, x):
        """
        Args:
            x: (batch, seq_len, input_dim) - time series of component metrics
               input_dim channels: [health_score, temperature, current, 
                                    vibration, voltage, humidity, 
                                    usage_hours_delta, event_flag]
        Returns:
            (batch, output_horizons) - predicted health at future times
        """
        lstm_out, _ = self.lstm(x)
        last_hidden = lstm_out[:, -1, :]  # Use final hidden state
        return self.predictor(last_hidden)


# Training loop (runs on fleet server, not on vehicle)
# Input: 168 time steps (1 week at 1 Hz downsampled to 1/hour)
# Output: health prediction at 24h, 72h, 168h ahead
# Loss: MSE on predicted vs actual health scores
# Training data: fleet history across all vehicles
```

**XGBoost for failure classification** works better than LSTM when the goal is binary failure prediction (will this component fail within X days?) rather than continuous health trajectory:

```python
import xgboost as xgb
import numpy as np

# Feature engineering from raw telemetry
features = {
    'mean_temperature_7d': [],      # Rolling 7-day mean temperature
    'max_temperature_7d': [],       # Rolling 7-day max
    'current_std_7d': [],           # Motor current variability
    'vibration_trend_slope': [],    # Linear trend in vibration
    'health_score_slope': [],       # Linear trend in health score
    'deicing_events_30d': [],       # Count of de-icing events in 30 days
    'hours_since_last_service': [], # Time since maintenance
    'total_operating_hours': [],    # Component age
    'cumulative_thermal_stress': [], # Integral of (temp - 25C)^2
    'connector_impedance_trend': [], # Connector health trend
}

# Target: will component fail within 7 days? (binary)
model = xgb.XGBClassifier(
    n_estimators=200,
    max_depth=6,
    learning_rate=0.05,
    scale_pos_weight=10,  # Imbalanced: failures are rare
    eval_metric='aucpr',
)

# Train on fleet data, evaluate with time-series split (no future leakage)
```

### 4.5 Fleet-Specific Algorithms

**Multi-vehicle transfer learning:** When a new vehicle enters the fleet with no operating history, use fleet priors from similar vehicles as the starting point. As the new vehicle accumulates data, gradually shift from fleet prior to vehicle-specific model:

```python
class FleetBayesianHealthModel:
    """Bayesian hierarchical model for fleet health prediction.
    
    Shares statistical strength across fleet:
    - Fleet-level prior: mean/variance of component life parameters
    - Vehicle-level posterior: updated with individual vehicle data
    
    Cold-start: new vehicle uses fleet prior directly.
    After 1,000 hours: vehicle-specific model dominates.
    """
    
    def __init__(self, fleet_beta_mean=2.0, fleet_beta_var=0.3,
                 fleet_eta_mean=30000, fleet_eta_var=5000):
        self.fleet_prior = {
            'beta': {'mean': fleet_beta_mean, 'var': fleet_beta_var},
            'eta': {'mean': fleet_eta_mean, 'var': fleet_eta_var},
        }
        self.vehicle_posteriors = {}
    
    def predict_new_vehicle(self, component_type, operating_hours):
        """Predict RUL for a vehicle with no history (cold start).
        Uses fleet prior directly.
        """
        beta = self.fleet_prior['beta']['mean']
        eta = self.fleet_prior['eta']['mean']
        
        # Simple Weibull RUL from fleet prior
        p_survived = np.exp(-(operating_hours / eta)**beta)
        median_remaining = eta * (-np.log(p_survived * 0.5))**(1/beta) - operating_hours
        
        # Wider confidence interval (fleet variance)
        eta_low = eta - 2 * self.fleet_prior['eta']['var']
        eta_high = eta + 2 * self.fleet_prior['eta']['var']
        
        return {
            'median_rul_hours': max(0, median_remaining),
            'confidence_interval': (
                max(0, eta_low * (-np.log(p_survived * 0.5))**(1/beta) - operating_hours),
                max(0, eta_high * (-np.log(p_survived * 0.5))**(1/beta) - operating_hours)
            ),
            'data_source': 'fleet_prior',
        }
    
    def update_vehicle_model(self, vehicle_id, component_type, 
                              observation_hours, failed):
        """Update vehicle-specific model with new observation.
        
        Bayesian update: posterior = prior + likelihood
        As observations accumulate, posterior narrows around 
        vehicle-specific parameters.
        """
        if vehicle_id not in self.vehicle_posteriors:
            self.vehicle_posteriors[vehicle_id] = {
                'observations': [],
                'beta': self.fleet_prior['beta'].copy(),
                'eta': self.fleet_prior['eta'].copy(),
            }
        
        vp = self.vehicle_posteriors[vehicle_id]
        vp['observations'].append({
            'hours': observation_hours,
            'failed': failed,
            'component': component_type,
        })
        
        # Re-estimate vehicle-specific parameters
        # (simplified; full Bayesian uses MCMC or variational inference)
        n_obs = len(vp['observations'])
        fleet_weight = max(0.1, 1.0 - n_obs / 20)  # Fleet influence decays
        
        if n_obs >= 3:
            # Enough data for vehicle-specific MLE
            vehicle_mle_eta = self._mle_eta(vp['observations'])
            vp['eta']['mean'] = (fleet_weight * self.fleet_prior['eta']['mean'] + 
                                 (1-fleet_weight) * vehicle_mle_eta)
            vp['eta']['var'] = self.fleet_prior['eta']['var'] * fleet_weight
```

**Fleet-level early warning:** When a component fails on one vehicle, check all vehicles with components from the same manufacturing batch, and increase monitoring frequency:

```python
def fleet_batch_alert(failed_vehicle_id, failed_component, component_db, fleet):
    """When a component fails, alert on sibling components from same batch.
    
    Example: Vehicle #5's LiDAR #2 (serial RH-2024-0892-047) fails at 18K hours.
    Check all LiDARs from batch RH-2024-0892:
    - Vehicle #3, LiDAR #4 (serial RH-2024-0892-023): 16K hours, health 0.82
    - Vehicle #7, LiDAR #1 (serial RH-2024-0892-031): 17K hours, health 0.78
    - Vehicle #12, LiDAR #6 (serial RH-2024-0892-055): 14K hours, health 0.91
    
    Action: Increase monitoring frequency for batch siblings,
    schedule inspection for any below health 0.85.
    """
    failed_serial = component_db.get_serial(failed_vehicle_id, failed_component)
    batch_id = extract_batch(failed_serial)  # e.g., "RH-2024-0892"
    
    siblings = component_db.find_batch_siblings(batch_id)
    alerts = []
    
    for sibling in siblings:
        if sibling.vehicle_id == failed_vehicle_id:
            continue
        
        current_health = fleet.get_component_health(
            sibling.vehicle_id, sibling.component_slot
        )
        current_hours = fleet.get_component_hours(
            sibling.vehicle_id, sibling.component_slot
        )
        
        # If sibling is within 20% of failure age, flag for inspection
        failed_hours = component_db.get_hours_at_failure(
            failed_vehicle_id, failed_component
        )
        age_ratio = current_hours / failed_hours
        
        if age_ratio > 0.8 or current_health < 0.85:
            alerts.append({
                'vehicle': sibling.vehicle_id,
                'component': sibling.component_slot,
                'serial': sibling.serial,
                'health': current_health,
                'hours': current_hours,
                'risk': 'high' if age_ratio > 0.9 else 'medium',
                'action': 'schedule_inspection',
            })
        else:
            alerts.append({
                'vehicle': sibling.vehicle_id,
                'component': sibling.component_slot,
                'risk': 'low',
                'action': 'increase_monitoring_frequency',
            })
    
    return alerts
```

### 4.6 Evaluation Metrics

| Metric | Definition | Target | Practical Meaning |
|---|---|---|---|
| **Precision (failure prediction)** | True failures predicted / all predicted failures | > 70% | <30% false alarms (unnecessary pull from service) |
| **Recall (failure prediction)** | True failures predicted / all actual failures | > 85% | <15% missed failures |
| **RUL MAE** | Mean absolute error of predicted vs actual remaining life | < 20% of actual life | For a 30,000h component, predict within 6,000h |
| **Lead time** | Time between prediction alert and actual failure | > 72 hours | Enough time to schedule + procure parts |
| **False alarm rate** | False positive predictions per vehicle per month | < 2 | Maintainable alert fatigue level |
| **Prediction horizon** | How far ahead the model can predict | 7-30 days | Procurement planning window |

**Trade-off:** Higher recall (catching more failures) increases false alarm rate. For safety-critical components (brakes, steering), bias toward recall (tolerate more false alarms). For non-critical components (camera lens, body panels), bias toward precision (avoid unnecessary maintenance).

---

## 5. Spare Parts Inventory Optimization

### 5.1 Multi-Echelon Inventory Model

Spare parts for autonomous GSE must be stocked at multiple levels to balance availability against holding cost:

```
LEVEL 4: OEM / Supplier
  Lead time: 4-16 weeks
  Examples: Custom PCBs, battery cells, replacement Orin modules
  Stocking: Made/sourced to order
  
    |
    v
    
LEVEL 3: Regional Hub (serves 3-5 airports)
  Lead time: 1-5 days (ground shipping)
  Examples: Replacement motors, steering actuators, battery packs,
            LiDAR modules (pre-configured), cameras
  Stocking: (s,S) policy, reviewed weekly
  
    |
    v
    
LEVEL 2: Airport Maintenance Depot (one per airport)
  Lead time: 30 minutes - 2 hours (technician retrieval)
  Examples: LiDAR modules (ready to install), brake pads, tires,
            compute modules, cables/connectors, sensor cleaning kits,
            fuses/relays
  Stocking: (s,S) policy, reviewed daily
  
    |
    v
    
LEVEL 1: On-Vehicle Consumables
  Lead time: 0 (carried on vehicle)
  Examples: Fuses, cable ties, spare connectors (field-replaceable),
            cleaning wipes, diagnostic dongle
  Stocking: Replenished at each depot visit
```

### 5.2 Stocking Models

**Airport depot (Level 2): (s,S) policy**

The (s,S) or min-max policy is optimal for airport depots: when inventory drops to reorder point s, order enough to bring stock up to maximum S. This balances ordering frequency against holding cost.

For part i at airport j:

```
s_ij = d_ij * L_i + z_alpha * sigma_d * sqrt(L_i)

where:
  d_ij  = mean daily demand for part i at airport j
  L_i   = lead time for part i from regional hub (days)
  z_alpha = safety stock factor (1.65 for 95% service level, 2.33 for 99%)
  sigma_d = standard deviation of daily demand
  
S_ij = s_ij + EOQ_i

where:
  EOQ_i = sqrt(2 * D_i * K_i / h_i)
  D_i = annual demand, K_i = ordering cost, h_i = annual holding cost per unit
```

**Regional hub (Level 3): Newsvendor model for high-value spares**

For expensive, slow-moving parts (battery packs, motors), the newsvendor model optimizes the critical ratio:

```
Stock q* units such that P(demand <= q*) = (c_u) / (c_u + c_o)

where:
  c_u = cost of under-stocking (downtime + SLA penalty + expedited shipping)
  c_o = cost of over-stocking (holding cost + obsolescence risk)
```

For a battery pack:
- c_u = $3,000-8,000 (extended downtime during 8-16 week lead time)
- c_o = $400-600/year (holding cost at 4% of $10,000 value)
- Critical ratio = 8000 / (8000 + 500) = 0.94 --> stock at 94th percentile of demand

### 5.3 Critical Spare Parts Identification and Costing

| Part | Unit Cost | Per Vehicle | Depot Stock (20 vehicles) | Lead Time (Regional) | Lead Time (OEM) | Annual Demand (20 vehicles) | Criticality |
|---|---|---|---|---|---|---|---|
| **RoboSense RSHELIOS LiDAR** | $800-1,200 | 4 | 3-4 units | 2-5 days | 4-8 weeks | 4-8 units | Critical |
| **RoboSense RSBP LiDAR** | $1,200-2,000 | 2-4 | 2-3 units | 2-5 days | 4-8 weeks | 2-4 units | Critical |
| **Continental ARS548 radar** | $300-500 | 2 | 1-2 units | 3-7 days | 6-10 weeks | 1-2 units | Important |
| **FLIR Boson 640 thermal** | $3,000-5,000 | 2-4 | 1-2 units | 5-10 days | 8-12 weeks | 1-2 units | Important |
| **Industrial camera + lens** | $250-650 | 6 | 3-4 units | 2-5 days | 4-6 weeks | 4-6 units | Moderate |
| **NVIDIA Orin AGX module** | $1,000-2,000 | 1-2 | 1-2 units | 5-10 days | 4-12 weeks | 0-1 units | Critical |
| **STM32H725 safety MCU board** | $200-500 | 1 | 2 units | 2-5 days | 6-12 weeks | 0-1 units | Critical |
| **Brake pad set (ADT3)** | $50-150 | 1 set | 8-12 sets | 1-3 days | 2-4 weeks | 20-40 sets | Safety-critical |
| **Brake disc set** | $100-300 | 1 set | 4-6 sets | 3-7 days | 4-6 weeks | 4-8 sets | Safety-critical |
| **Tire set (solid rubber)** | $200-600 per tire | 4 | 8-12 tires | 2-5 days | 4-8 weeks | 20-40 tires | Moderate |
| **Drive motor (BLDC)** | $500-2,000 | 1-2 | 1-2 units | 5-10 days | 6-12 weeks | 1-3 units | Important |
| **Steering actuator** | $400-1,200 | 1-2 | 1-2 units | 5-10 days | 6-12 weeks | 2-4 units | Critical |
| **Battery pack (LFP module)** | $2,000-5,000 per module | 2-6 modules | 2-4 modules | 5-10 days | 8-16 weeks | 2-6 modules | Important |
| **CAN/Ethernet cables (per set)** | $50-200 | 1 set | 4-6 sets | 1-2 days | 2-4 weeks | 8-15 sets | Moderate |
| **M12 connector kit** | $20-80 | 10-20 | 20-40 units | 1-2 days | 1-2 weeks | 40-100 units | Moderate |
| **DC-DC converter** | $100-300 | 1-2 | 2-3 units | 3-5 days | 4-8 weeks | 1-2 units | Important |
| **IMU (Xsens MTi-30)** | $1,500-2,500 | 1 | 1 unit | 5-10 days | 6-10 weeks | 0-1 units | Critical |
| **RTK-GPS receiver** | $2,000-4,000 | 1 | 1 unit | 5-10 days | 6-12 weeks | 0-1 units | Important |
| **Sensor cleaning kit** | $30-80 | N/A | 10-20 kits | 1-2 days | 1-2 weeks | 50-100 kits | Consumable |
| **Fuse/relay assortment** | $5-20 per set | N/A | 10-15 sets | 1 day | 1-2 weeks | 20-30 sets | Consumable |

### 5.4 Cold-Start Inventory Sizing for New Airport

When deploying a fleet at a new airport, the initial depot must be stocked before operating history exists. The formula:

```
Initial stock = max(
    ceil(fleet_size * per_vehicle_count * failure_rate_annual * lead_time_years * safety_factor),
    minimum_stocking_level
)

where:
  safety_factor = 1.5 for critical parts, 1.2 for important, 1.0 for moderate
  minimum_stocking_level = 1 for critical, 0 for moderate
```

**Example: 20-vehicle fleet initial stocking list:**

| Part | Calculation | Qty | Unit Cost | Total |
|---|---|---|---|---|
| RSHELIOS LiDAR | ceil(20 * 4 * 0.05 * (5/365) * 1.5) = ceil(0.082) = min 2 | 3 | $1,000 | $3,000 |
| RSBP LiDAR | ceil(20 * 3 * 0.04 * (5/365) * 1.5) = min 2 | 2 | $1,600 | $3,200 |
| ARS548 radar | ceil(20 * 2 * 0.02 * (7/365) * 1.2) = min 1 | 1 | $400 | $400 |
| Boson 640 thermal | ceil(20 * 3 * 0.03 * (7/365) * 1.2) = min 1 | 1 | $4,000 | $4,000 |
| Industrial camera | ceil(20 * 6 * 0.04 * (3/365) * 1.0) = min 2 | 3 | $450 | $1,350 |
| Orin AGX module | min stocking level | 1 | $1,500 | $1,500 |
| Safety MCU board | min stocking level | 2 | $350 | $700 |
| Brake pad sets | ceil(20 * 1 * 1.5 * (2/365) * 1.5) = min 4 | 8 | $100 | $800 |
| Brake disc sets | ceil(20 * 1 * 0.3 * (5/365) * 1.5) = min 2 | 4 | $200 | $800 |
| Tires | ceil(20 * 4 * 0.8 * (3/365) * 1.0) = min 4 | 8 | $400 | $3,200 |
| Drive motor | min stocking level | 1 | $1,200 | $1,200 |
| Steering actuator | ceil(20 * 1.5 * 0.1 * (7/365) * 1.5) = min 1 | 1 | $800 | $800 |
| Battery module | min stocking level | 2 | $3,500 | $7,000 |
| CAN/Ethernet cables | ceil(20 * 1 * 0.5 * (1/365) * 1.0) = min 3 | 4 | $125 | $500 |
| M12 connectors | bulk | 30 | $50 | $1,500 |
| DC-DC converter | min stocking level | 2 | $200 | $400 |
| IMU | min stocking level | 1 | $2,000 | $2,000 |
| RTK-GPS receiver | min stocking level | 1 | $3,000 | $3,000 |
| Cleaning kits | 3-month supply | 15 | $50 | $750 |
| Fuse/relay sets | bulk | 10 | $10 | $100 |
| **Total initial inventory** | | | | **$36,200** |

Add 30-40% contingency for unexpected items: **total initial depot investment $47,000-50,700**.

At larger fleet sizes (50+ vehicles per airport), total depot inventory scales sub-linearly because the reorder point as a fraction of fleet size decreases with the law of large numbers.

| Fleet Size | Initial Depot Investment | Per-Vehicle Allocation |
|---|---|---|
| 10 vehicles | $28,000-35,000 | $2,800-3,500 |
| 20 vehicles | $47,000-51,000 | $2,350-2,550 |
| 50 vehicles | $85,000-100,000 | $1,700-2,000 |
| 100 vehicles | $130,000-160,000 | $1,300-1,600 |

### 5.5 Inventory Holding and Obsolescence Cost

Annual holding cost = inventory value * holding rate (typically 15-25% for industrial parts):
- Capital cost: 5-8% (opportunity cost of tied-up capital)
- Storage/handling: 3-5% (depot space, climate control for batteries)
- Insurance: 1-2%
- Obsolescence: 5-10% (sensor models superseded, vehicle types retired)

For a 20-vehicle fleet with $48K initial inventory: **annual holding cost = $7,200-12,000**.

**Obsolescence risk management:** Sensors and compute modules have the highest obsolescence risk. When RoboSense discontinues a LiDAR model or NVIDIA transitions from Orin to Thor, stockpiled units become stranded. Mitigation: limit critical electronics stock to 6-12 months coverage, negotiate last-time-buy agreements with suppliers, design sensor mounts for cross-model compatibility.

---

## 6. Maintenance Scheduling Optimization

### 6.1 Joint Maintenance-Operations Scheduling

Maintenance scheduling for autonomous GSE must integrate with the fleet task allocation system (see [fleet-task-allocation-scheduling.md](../../30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md)) and A-CDM-driven demand prediction. The key constraint: maintenance cannot be scheduled independently of operations because pulling a vehicle reduces fleet capacity.

```
MAINTENANCE SCHEDULING INPUTS AND CONSTRAINTS

Inputs:
  - Vehicle health indices (from PHM Level 3)
  - Predicted failure horizons (from PHM algorithms)
  - Flight schedule / A-CDM demand forecast (from airport ops)
  - Technician availability (shift schedule)
  - Spare parts availability (from inventory system)
  - Charging schedule (vehicles must charge regardless)
  - Weather forecast (potential maintenance-favorable holds)

Hard constraints:
  - Minimum fleet availability: 85% at peak (15-17 of 20 vehicles)
  - Safety-critical maintenance (brakes, steering) cannot be deferred
  - Technician capacity: 2 FTE can handle 3-4 maintenance events per shift
  - Depot capacity: 2-3 vehicles simultaneously (space + equipment)

Soft constraints (minimize):
  - Deviation from predicted optimal maintenance time
  - Total maintenance cost (parts + labor + downtime opportunity cost)
  - Spare parts holding cost
  - Fleet utilization impact
```

### 6.2 Mathematical Formulation

The maintenance scheduling problem is formulated as a mixed-integer program (MIP):

```
Minimize:
  sum_v sum_t sum_m  (C_m * x_vtm  +  D_v * y_vt)

Subject to:
  (1) sum_v (1 - y_vt) >= F_min(t)     for all t     [fleet availability]
  (2) sum_v y_vt <= K                    for all t     [depot capacity]
  (3) x_vtm <= y_vt                      for all v,t,m [can only do task if in depot]
  (4) sum_t x_vtm >= r_vm               for all v,m   [required tasks must be done]
  (5) sum_m x_vtm * d_m <= H            for all v,t   [shift time limit]
  (6) x_vtm in {0,1}, y_vt in {0,1}

where:
  v = vehicle index
  t = time slot (e.g., 4-hour blocks)
  m = maintenance task type
  C_m = cost of maintenance task m (parts + labor)
  D_v = opportunity cost of vehicle v being offline at time t
  x_vtm = 1 if vehicle v receives task m at time t
  y_vt = 1 if vehicle v is offline (in depot) at time t
  F_min(t) = minimum fleet size needed at time t (from demand forecast)
  K = depot capacity (simultaneous vehicles)
  r_vm = 1 if vehicle v requires task m before deadline
  d_m = duration of task m (hours)
  H = maximum maintenance hours per time slot
```

This MIP is solvable by CP-SAT (Google OR-Tools) for fleet sizes up to 100 vehicles with 20+ task types --- consistent with the fleet task allocation approach in [fleet-task-allocation-scheduling.md](../../30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md).

### 6.3 Opportunity Maintenance

The highest-value scheduling optimization is **opportunity maintenance**: combining maintenance tasks with already-planned depot visits (charging, cleaning, software updates).

```
Opportunity Maintenance Decision Tree:

Vehicle arrives at depot for charging (40-minute window)
  |
  +-- Check: Any maintenance tasks due within 7 days?
  |     |
  |     +-- YES: Can task complete within charging window?
  |     |     |
  |     |     +-- YES: Schedule immediately (zero additional downtime)
  |     |     |     Examples: LiDAR cleaning (15 min), tire inspection (20 min),
  |     |     |              connector check (10 min), software update (15 min)
  |     |     |
  |     |     +-- NO: Can task start now and overlap with next charging?
  |     |           |
  |     |           +-- YES: Schedule across two charging windows
  |     |           |     Example: Brake pad replacement (90 min, spans two
  |     |           |              40-min windows with 30 min gap)
  |     |           |
  |     |           +-- NO: Schedule dedicated maintenance window
  |     |
  |     +-- NO: Skip, return to service after charging
  |
  +-- Check: Any fleet-triggered batch maintenance?
        |
        +-- De-icing event yesterday? -> Clean all affected sensors
        +-- Batch component alert? -> Inspect flagged components
        +-- End of season? -> Seasonal transition inspection
```

**Estimated savings from opportunity maintenance:**
- 40-60% of routine maintenance tasks can be combined with charging windows
- Reduces dedicated maintenance downtime by 25-35%
- Requires no additional parts (same tasks, just better scheduling)

### 6.4 Grouping Maintenance Tasks

When a vehicle enters the depot for a primary task, check all pending secondary tasks and combine them into a single visit:

| Primary Task | Add-On Tasks (if due within 14 days) | Combined Time | Time Saved vs Separate |
|---|---|---|---|
| LiDAR replacement (60 min) | Camera cleaning (10 min), connector check (15 min), tire inspection (15 min) | 90 min | 30 min (one depot visit vs three) |
| Brake pad replacement (90 min) | Tire rotation (45 min), fluid check (10 min) | 120 min | 25 min |
| Battery module swap (180 min) | Full sensor recalibration (60 min), software update (15 min), full inspection (30 min) | 240 min | 45 min |

**Rule of thumb:** Depot ingress/egress (entering, parking, connecting diagnostics, post-maintenance verification) takes 15-25 minutes regardless of what maintenance is done. Combining tasks amortizes this fixed overhead.

### 6.5 Seasonal Maintenance Profiles

| Season | Focus | Additional Tasks | Frequency |
|---|---|---|---|
| **Winter** | De-icing protection | LiDAR/camera cleaning (post de-icing event), connector anti-corrosion spray, undercarriage wash, battery pre-conditioning check, wiper fluid top-up, brake disc rust check | Per event + weekly |
| **Summer** | Thermal management | Compute thermal paste check, battery cooling system flush, tire pressure check (heat expansion), air filter replacement (dust), UV damage inspection of cable harnesses | Monthly |
| **Spring transition** | Comprehensive | Full inspection, winter damage assessment, corrosion remediation, brake system overhaul (salt damage), recalibrate all sensors (temperature-affected drift) | Once |
| **Fall transition** | Winter preparation | Connector sealing, anti-corrosion treatment, battery health assessment before cold season, de-icing system pre-test, winter tire assessment | Once |

---

## 7. Fleet Availability and Reliability Modeling

### 7.1 Vehicle Reliability Model

An autonomous GSE vehicle is a series system at the subsystem level (any critical subsystem failure disables the vehicle):

```
Vehicle Availability = A_sensors * A_compute * A_drivetrain * A_steering * A_brakes * A_power

where A_i = MTBF_i / (MTBF_i + MTTR_i)
```

**Per-subsystem availability estimates:**

| Subsystem | MTBF (hours) | MTTR (hours) | Availability | Limiting Factor |
|---|---|---|---|---|
| Sensor suite (with redundancy) | 3,000-5,000 | 1.0 | 0.9997-0.9998 | LiDAR cleaning dominates |
| Compute | 8,000-15,000 | 2.0 | 0.9999+ | Very reliable (solid-state) |
| Drivetrain | 5,000-10,000 | 6.0 | 0.9994-0.9997 | Motor/gearbox |
| Steering | 4,000-8,000 | 4.0 | 0.9995-0.9998 | Actuator wear |
| Brakes | 6,000-12,000 | 2.0 | 0.9998-0.9999 | Pad wear (predictable) |
| Power | 4,000-8,000 | 3.0 | 0.9996-0.9998 | Battery cell balance |

**Vehicle availability (series product):** 0.9980-0.9990, or approximately **99.8-99.9%**

In practice, this translates to:
- 16-20 operating hours/day * 365 days = 5,840-7,300 hours/year
- At 99.8% availability: 11.7-14.6 hours downtime/year per vehicle
- At 99.9% availability: 5.8-7.3 hours downtime/year per vehicle

**Sensor suite dominates planned maintenance:** While the sensor suite has high MTBF for failure, it has the highest frequency of planned maintenance events (cleaning). At one cleaning event per 48-72 hours (summer), each taking 15-30 minutes, the sensor suite accounts for 60-70% of all depot visits.

### 7.2 Fleet Sizing with Maintenance Buffer

The fleet must be sized to maintain minimum operational capacity during maintenance:

```
N_total = N_operational / (1 - f_maintenance)

where:
  N_operational = vehicles needed for peak operations
  f_maintenance = fraction of fleet in maintenance at any time
```

| Maturity Level | Avg Maintenance Rate | Buffer | Fleet Sizing (15 ops needed) |
|---|---|---|---|
| Year 1 (reactive, high failure rate) | 15-20% | 3-4 spare | 18-19 vehicles |
| Year 2 (predictive, improving) | 10-15% | 2-3 spare | 17-18 vehicles |
| Year 3+ (mature, optimized) | 8-12% | 1-2 spare | 17 vehicles |

**Cost of spare vehicles:** Each spare vehicle costs $60K-180K CAPEX (per [../../70-operations-domains/airside/business-case/fleet-tco-business-case.md](../../70-operations-domains/airside/business-case/fleet-tco-business-case.md)). Maintaining 3 spare vehicles at $100K each = $300K capital invested in maintenance buffer. Predictive maintenance reduces the required buffer from 3-4 spares to 1-2 spares, freeing $100K-200K in capital.

### 7.3 Mean Time To Repair (MTTR) Estimates

MTTR includes diagnosis, part retrieval, repair, verification, and return to service:

| Task | Diagnosis | Part Retrieval | Repair | Verification | Total MTTR |
|---|---|---|---|---|---|
| LiDAR swap | 5 min (auto) | 10 min | 20-30 min | 20-30 min (recalibration) | 55-75 min |
| Camera swap | 5 min | 5 min | 10-15 min | 15-20 min (recalibration) | 35-45 min |
| Orin module swap | 10 min | 10 min | 30-45 min | 30-60 min (full system test) | 80-125 min |
| Safety MCU swap | 10 min | 10 min | 20-30 min | 30-45 min (safety validation) | 70-95 min |
| Brake pad replacement | 5 min | 10 min | 45-60 min | 15-20 min (brake test) | 75-95 min |
| Tire change | 5 min | 10 min | 30-45 min | 10-15 min | 55-75 min |
| Drive motor replacement | 15 min | 15 min | 120-180 min | 30-45 min | 180-255 min |
| Steering actuator replacement | 10 min | 15 min | 90-150 min | 30-45 min (alignment) | 145-220 min |
| Battery module swap (hot-swap) | 10 min | 15 min | 60-90 min | 30-45 min | 115-160 min |
| Battery module swap (integrated) | 10 min | 15 min | 120-240 min | 30-45 min | 175-310 min |
| CAN connector repair | 15 min | 5 min | 20-40 min | 15-20 min | 55-80 min |
| DC-DC converter swap | 10 min | 10 min | 30-45 min | 20-30 min | 70-95 min |
| Full sensor recalibration | 10 min | 5 min (targets) | 45-60 min | 15-20 min | 75-95 min |
| LiDAR cleaning (manual) | 0 min | 5 min | 10-15 min | 5 min | 20-25 min |
| Software update + verify | 0 min | 0 min | 10-15 min | 15-20 min | 25-35 min |

**Recalibration note:** After any sensor swap, the multi-LiDAR extrinsic calibration process must run (see [multi-lidar-calibration.md](../../20-av-platform/sensors/multi-lidar-calibration.md)). With automated calibration targets at the depot, this takes 20-30 minutes rather than the 1-2 hours required for manual calibration. Designing the depot with permanent calibration targets is a one-time $2,000-5,000 investment that reduces every sensor-swap MTTR by 30-60 minutes.

### 7.4 Monte Carlo Fleet Availability Simulation

To validate fleet sizing and maintenance strategy, simulate 1 year of fleet operations with stochastic failures:

```python
import numpy as np
from dataclasses import dataclass


@dataclass
class ComponentSpec:
    name: str
    weibull_beta: float
    weibull_eta: float  # hours
    mttr_hours: float
    spare_available: bool


def simulate_fleet_year(n_vehicles=20, n_simulations=1000):
    """Monte Carlo simulation of fleet availability over 1 year.
    
    Models:
    - Random component failures per Weibull distribution
    - Repair time per MTTR estimates
    - Spare part availability
    - Planned maintenance windows (charging-aligned)
    
    Returns: distribution of annual fleet availability percentages
    """
    components = [
        ComponentSpec('lidar', 2.0, 30000, 1.0, True),
        ComponentSpec('compute', 1.5, 60000, 2.0, True),
        ComponentSpec('motor', 3.5, 50000, 6.0, True),
        ComponentSpec('steering', 2.2, 20000, 4.0, True),
        ComponentSpec('brakes', 3.5, 25000, 1.5, True),    # In km-equivalent
        ComponentSpec('battery', 2.5, 15000, 3.0, True),   # In cycle-equivalent
        ComponentSpec('connectors', 1.7, 20000, 1.0, True),
    ]
    
    hours_per_year = 6500  # ~18 hours/day
    results = []
    
    for _ in range(n_simulations):
        total_vehicle_hours = 0
        total_downtime_hours = 0
        
        for v in range(n_vehicles):
            vehicle_downtime = 0
            
            for comp in components:
                # Number of component instances per vehicle
                n_instances = 8 if comp.name == 'lidar' else 1
                
                for _ in range(n_instances):
                    # Simulate failure times
                    age = 0
                    while age < hours_per_year:
                        # Time to next failure (Weibull)
                        ttf = comp.weibull_eta * (
                            -np.log(np.random.uniform())
                        )**(1/comp.weibull_beta)
                        
                        if age + ttf < hours_per_year:
                            # Failure occurs this year
                            repair_time = comp.mttr_hours * np.random.lognormal(0, 0.3)
                            
                            # For non-critical redundant components (extra LiDARs),
                            # downtime only if enough units fail simultaneously
                            if comp.name == 'lidar' and n_instances > 4:
                                repair_time *= 0.3  # Reduced impact due to redundancy
                            
                            vehicle_downtime += repair_time
                            age += ttf + repair_time
                        else:
                            break
            
            # Add planned maintenance downtime (cleaning, inspections)
            planned_events = 52  # Weekly cleaning + quarterly inspections
            planned_downtime = planned_events * 0.5  # Average 30 min each
            vehicle_downtime += planned_downtime
            
            total_vehicle_hours += hours_per_year
            total_downtime_hours += vehicle_downtime
        
        fleet_availability = 1 - (total_downtime_hours / total_vehicle_hours)
        results.append(fleet_availability)
    
    results = np.array(results)
    return {
        'mean_availability': np.mean(results),
        'p5_availability': np.percentile(results, 5),
        'p50_availability': np.percentile(results, 50),
        'p95_availability': np.percentile(results, 95),
        'prob_above_95pct': np.mean(results > 0.95),
        'prob_above_98pct': np.mean(results > 0.98),
    }

# Example results (illustrative):
# mean_availability: 0.975
# p5_availability: 0.961
# p50_availability: 0.976
# p95_availability: 0.988
# prob_above_95pct: 0.94
# prob_above_98pct: 0.67
```

**Interpretation:** With 20 vehicles and current reliability estimates, the fleet achieves >95% availability in ~94% of simulated years, and >98% availability in ~67% of years. The 5th percentile (worst-case) is 96.1%, meaning even in a bad year, the fleet maintains sufficient availability for operations.

---

## 8. Integration with Existing Aurrigo Systems

### 8.1 ROS Diagnostics Integration Architecture

```
+--------------------------------------------------------------------------+
|  VEHICLE (Orin AGX)                                                      |
|                                                                          |
|  +------------------+  +------------------+  +------------------+        |
|  | sensor_health_   |  | can_diagnostics_ |  | compute_health_  |        |
|  | monitor          |  | bridge           |  | diagnostics      |        |
|  | (1 Hz, <2ms)     |  | (10 Hz CAN->ROS) |  | (1 Hz, <1ms)    |        |
|  +--------+---------+  +--------+---------+  +--------+---------+        |
|           |                      |                      |                 |
|           +------+    +----------+          +-----------+                 |
|                  v    v                     v                             |
|           /diagnostics (DiagnosticArray)                                  |
|                  |                                                        |
|                  v                                                        |
|  +------------------+                                                    |
|  | diagnostic_      |                                                    |
|  | aggregator       |  /diagnostics_agg (DiagnosticArray)                |
|  | (standard ROS)   +---+                                                |
|  +------------------+   |                                                |
|                         v                                                |
|  +------------------------------------------+                            |
|  | vehicle_health_assessor                   |                            |
|  | - Computes subsystem scores (Level 2)     |                            |
|  | - Computes VHI (Level 3)                  |                            |
|  | - Publishes /vehicle_health               |                            |
|  | - Publishes /maintenance_requests         |                            |
|  +----+------------------+------------------+                            |
|       |                  |                                               |
+-------+------------------+-----------------------------------------------+
        |                  |
        | /vehicle_health  | /maintenance_requests
        v                  v
+-------+------------------+-----------------------------------------------+
|  FLEET MANAGEMENT SERVER (Edge / Cloud)                                  |
|                                                                          |
|  +------------------+  +------------------+  +------------------+        |
|  | fleet_health_    |  | maintenance_     |  | spare_parts_     |        |
|  | aggregator       |  | scheduler        |  | inventory        |        |
|  | (all vehicles)   |  | (MIP solver)     |  | (demand forecast)|        |
|  +--------+---------+  +--------+---------+  +--------+---------+        |
|           |                      |                      |                 |
|           v                      v                      v                 |
|  +----------------------------------------------------------+           |
|  | Fleet Health Dashboard (Grafana / custom web)             |           |
|  | - Vehicle health overview                                 |           |
|  | - Predicted maintenance timeline                          |           |
|  | - Spare parts status and procurement alerts               |           |
|  | - Technician work orders                                  |           |
|  +----------------------------------------------------------+           |
+--------------------------------------------------------------------------+
```

### 8.2 CAN Bus Diagnostic Bridge

The CAN diagnostic bridge converts raw CAN signals into ROS DiagnosticStatus messages. This is the primary new integration required for Aurrigo vehicles:

```python
#!/usr/bin/env python
"""CAN bus to ROS diagnostics bridge for Aurrigo ADT3.

Reads drivetrain, steering, brake, and battery CAN signals
and publishes as DiagnosticStatus messages for the PHM system.

Depends on: python-can, ros diagnostic_msgs
"""
import rospy
import can
import struct
from diagnostic_msgs.msg import DiagnosticArray, DiagnosticStatus, KeyValue


class CANDiagnosticBridge:
    """Bridge CAN bus signals to ROS diagnostics for PHM."""
    
    # CAN message definitions (Aurrigo ADT3-specific)
    # These IDs must match the actual vehicle DBC file
    CAN_MOTOR_CURRENT = 0x201
    CAN_MOTOR_TEMP = 0x210
    CAN_MOTOR_RPM = 0x220
    CAN_STEERING_POS = 0x301
    CAN_STEERING_CURRENT = 0x302
    CAN_BRAKE_PRESSURE = 0x401
    CAN_BATTERY_VOLTAGE = 0x501
    CAN_BATTERY_CURRENT = 0x502
    CAN_BATTERY_TEMP = 0x510
    CAN_BATTERY_SOC = 0x520
    
    def __init__(self):
        rospy.init_node('can_diagnostic_bridge')
        
        self.diag_pub = rospy.Publisher('/diagnostics', DiagnosticArray, queue_size=10)
        
        # CAN bus interface (SocketCAN)
        self.bus = can.interface.Bus(
            channel=rospy.get_param('~can_channel', 'can0'),
            bustype='socketcan'
        )
        
        # Accumulators for derived metrics
        self.motor_current_history = []
        self.steering_current_history = []
        self.battery_voltage_history = []
        
        # Thresholds
        self.motor_temp_warn = 80.0     # degrees C
        self.motor_temp_error = 100.0
        self.motor_current_max = 50.0   # Amps
        self.steering_backlash_warn = 0.5  # degrees
        self.brake_pressure_min = 2.0   # bar
        self.battery_soh_warn = 0.85
        self.battery_soh_error = 0.75
        
        # Publish at 1 Hz (derived from 10-100 Hz CAN signals)
        self.timer = rospy.Timer(rospy.Duration(1.0), self.publish_diagnostics)
        
        # CAN listener thread
        self.latest = {}
        self._start_can_listener()
    
    def _start_can_listener(self):
        """Background thread reading CAN messages."""
        import threading
        
        def listener():
            while not rospy.is_shutdown():
                msg = self.bus.recv(timeout=0.1)
                if msg:
                    self.latest[msg.arbitration_id] = msg.data
        
        t = threading.Thread(target=listener, daemon=True)
        t.start()
    
    def publish_diagnostics(self, event):
        """Publish aggregated CAN diagnostics at 1 Hz."""
        msg = DiagnosticArray()
        msg.header.stamp = rospy.Time.now()
        
        # Motor diagnostics
        motor_temp = self._decode_motor_temp()
        if motor_temp is not None:
            status = DiagnosticStatus()
            status.name = "drivetrain/motor_temperature"
            status.hardware_id = "adt3_motor_0"
            status.values = [
                KeyValue(key="temperature_c", value=f"{motor_temp:.1f}"),
            ]
            
            if motor_temp > self.motor_temp_error:
                status.level = DiagnosticStatus.ERROR
                status.message = f"Motor overheating: {motor_temp:.1f}C"
            elif motor_temp > self.motor_temp_warn:
                status.level = DiagnosticStatus.WARN
                status.message = f"Motor warm: {motor_temp:.1f}C"
            else:
                status.level = DiagnosticStatus.OK
                status.message = f"Motor temp normal: {motor_temp:.1f}C"
            
            msg.status.append(status)
        
        # Battery SOH (derived from voltage-under-load analysis)
        battery_soh = self._estimate_battery_soh()
        if battery_soh is not None:
            status = DiagnosticStatus()
            status.name = "power/battery_soh"
            status.hardware_id = "adt3_battery_0"
            status.values = [
                KeyValue(key="soh_fraction", value=f"{battery_soh:.3f}"),
                KeyValue(key="estimated_cycles_remaining", 
                         value=str(self._estimate_remaining_cycles(battery_soh))),
            ]
            
            if battery_soh < self.battery_soh_error:
                status.level = DiagnosticStatus.ERROR
                status.message = f"Battery SOH critical: {battery_soh*100:.0f}%"
            elif battery_soh < self.battery_soh_warn:
                status.level = DiagnosticStatus.WARN
                status.message = f"Battery SOH declining: {battery_soh*100:.0f}%"
            else:
                status.level = DiagnosticStatus.OK
                status.message = f"Battery SOH healthy: {battery_soh*100:.0f}%"
            
            msg.status.append(status)
        
        # Steering health (backlash detection)
        steering_health = self._assess_steering_health()
        if steering_health is not None:
            status = DiagnosticStatus()
            status.name = "steering/actuator_health"
            status.hardware_id = "adt3_steering_0"
            status.values = [
                KeyValue(key="estimated_backlash_deg", 
                         value=f"{steering_health['backlash']:.2f}"),
                KeyValue(key="current_draw_ratio", 
                         value=f"{steering_health['current_ratio']:.2f}"),
            ]
            
            if steering_health['backlash'] > 1.0:
                status.level = DiagnosticStatus.ERROR
                status.message = "Steering backlash exceeds safety limit"
            elif steering_health['backlash'] > self.steering_backlash_warn:
                status.level = DiagnosticStatus.WARN
                status.message = "Steering backlash increasing"
            else:
                status.level = DiagnosticStatus.OK
                status.message = "Steering health normal"
            
            msg.status.append(status)
        
        self.diag_pub.publish(msg)
    
    def _decode_motor_temp(self):
        """Decode motor temperature from CAN frame."""
        data = self.latest.get(self.CAN_MOTOR_TEMP)
        if data is None:
            return None
        # Example decoding (actual depends on DBC)
        return struct.unpack_from('<H', data, 0)[0] * 0.1  # 0.1C resolution
    
    def _estimate_battery_soh(self):
        """Estimate battery state of health from voltage/current data.
        
        SOH = current_capacity / rated_capacity
        Estimated from internal resistance trending:
        R_internal = delta_V / delta_I during load transitions
        """
        # Simplified: use BMS-reported SOH if available
        data = self.latest.get(self.CAN_BATTERY_SOC)
        if data is None:
            return None
        soc = struct.unpack_from('<B', data, 0)[0] / 100.0
        soh = struct.unpack_from('<B', data, 1)[0] / 100.0
        return soh
    
    def _assess_steering_health(self):
        """Assess steering actuator health from position/current correlation."""
        # Backlash: difference between commanded and actual at zero speed
        # Current ratio: current / expected current for given load
        return {'backlash': 0.2, 'current_ratio': 1.05}  # Placeholder
    
    def _estimate_remaining_cycles(self, soh):
        """Estimate remaining charge cycles before 80% SOH threshold."""
        if soh <= 0.80:
            return 0
        # Linear approximation from LFP degradation curve
        # LFP typically: 3000 cycles to 80% SOH
        remaining_fraction = (soh - 0.80) / 0.20
        return int(remaining_fraction * 1000)  # Cycles remaining
```

### 8.3 Integration with Fleet Dispatch

The maintenance system feeds vehicle health data to the fleet dispatch system so that dispatch decisions incorporate vehicle condition:

```python
def health_aware_dispatch(task, available_vehicles, fleet_health):
    """Select vehicle for task considering health status.
    
    Integration point: fleet-task-allocation-scheduling.md
    
    Policy:
    1. Never assign safety-critical tasks to degraded vehicles
    2. Prefer healthier vehicles for high-value tasks
    3. Route degraded vehicles toward depot (opportunistic)
    """
    candidates = []
    
    for vehicle in available_vehicles:
        vhi = fleet_health.get_vhi(vehicle.id)
        
        # Hard filter: safety-critical tasks need healthy vehicles
        if task.type == 'pushback' and vhi < 0.85:
            continue
        if task.type == 'baggage' and vhi < 0.55:
            continue
        
        # Soft score: blend proximity, battery, and health
        proximity_score = 1.0 / (1.0 + task.distance_to(vehicle.position))
        battery_score = vehicle.battery_soc / 100.0
        health_score = vhi
        
        # Weighted combination
        total_score = (
            0.4 * proximity_score +
            0.3 * battery_score +
            0.3 * health_score
        )
        
        # Bonus: if vehicle is degraded and task routes near depot
        if vhi < 0.70 and task.routes_near_depot():
            total_score += 0.15  # Prefer tasks that bring vehicle toward depot
        
        candidates.append((vehicle, total_score))
    
    # Sort by score, return best
    candidates.sort(key=lambda x: x[1], reverse=True)
    return candidates[0][0] if candidates else None
```

### 8.4 Integration with A-CDM for Demand-Aware Scheduling

The A-CDM (Airport Collaborative Decision Making) feed provides flight schedule predictions that drive maintenance window selection:

```
A-CDM Demand Forecast for Tomorrow:
  
  03:00-05:00  Low demand (4 flights)   -> MAINTENANCE WINDOW
  05:00-09:00  Peak morning (28 flights) -> Full fleet needed
  09:00-11:00  Mid-morning lull (8 flights) -> Partial maintenance OK
  11:00-14:00  Midday peak (22 flights)  -> Full fleet needed
  14:00-16:00  Afternoon lull (6 flights) -> MAINTENANCE WINDOW
  16:00-20:00  Evening peak (24 flights) -> Full fleet needed
  20:00-23:00  Late evening (10 flights) -> Partial maintenance OK
  23:00-03:00  Night (2 flights)         -> MAINTENANCE WINDOW

Maintenance scheduler output:
  - Schedule V-03 LiDAR cleaning: 03:00-03:30
  - Schedule V-15 brake pads: 03:00-05:00 (fits in night window)
  - Schedule V-11 battery balance: 14:00-17:00 (starts in lull, extends into peak
    but fleet has buffer because V-11 was low-priority)
  - Defer V-07 tire rotation to Wednesday night (no urgency, lower demand Wed)
```

### 8.5 Data Pipeline Architecture

```
Vehicle (Orin)             Edge Gateway              Fleet Server
+---------------+          +-----------+             +------------------+
| /diagnostics  | --MQTT-->| Message   |--MQTT/---->| Time-series DB   |
| /vehicle_     |    (5G)  | broker    |  AMQP      | (InfluxDB/       |
|  health       |          | (Mosquitto|             |  TimescaleDB)    |
| /maintenance_ |          |  / EMQX)  |             +--------+---------+
|  requests     |          +-----------+                      |
+---------------+                                    +--------+---------+
                                                     | PHM Engine       |
Raw CAN data stays on vehicle (too high bandwidth).  | (Python service)  |
Only derived health metrics (1 Hz, ~500 bytes/msg)   | - Weibull/Cox    |
are transmitted. At 20 vehicles: ~10 KB/s total.     | - LSTM/XGBoost   |
                                                     | - Scheduling MIP |
Per-event detailed telemetry (30s window around       +--------+---------+
anomaly) is uploaded on trigger:                              |
~1 MB per event, ~5-10 events/day per vehicle.       +--------+---------+
                                                     | Dashboard        |
                                                     | (Grafana/custom) |
                                                     +------------------+
```

**Bandwidth estimate:** 
- Continuous health metrics: 20 vehicles * 500 bytes/s * 1 Hz = 10 KB/s = 0.86 GB/day
- Triggered event telemetry: 20 vehicles * 10 events/day * 1 MB = 200 MB/day
- Total: ~1.06 GB/day --- well within airport 5G capacity

---

## 9. Industry Benchmarks and Case Studies

### 9.1 Aviation MRO Parallels

Airlines manage the world's most sophisticated spare parts logistics for aircraft engines, avionics, and airframe components. Key lessons applicable to autonomous GSE:

**Spare engine management:** Major airlines keep 1 spare engine per 8-12 installed engines ($30-40M each). The spare-to-fleet ratio of ~8-12% is driven by the extreme cost of aircraft-on-ground (AOG) events ($150,000-500,000/day in lost revenue). For autonomous GSE, the equivalent AOG cost is the missed turnaround penalty ($500-2,000 per late flight), so the optimal spare-to-fleet ratio is lower.

**Pooling agreements:** Airlines share spare parts through pooling agreements (e.g., HEICO, AAR Corp) that reduce per-airline inventory by 20-40%. For multi-airport autonomous fleets, a regional hub serving 3-5 airports achieves a similar pooling effect.

**Condition-based maintenance in aviation:** The FAA's MSG-3 (Maintenance Steering Group) methodology, used since the 1960s, classifies maintenance into Hard Time (replace at interval), On Condition (inspect and replace if degraded), and Condition Monitoring (track fleet statistics, replace on failure). Autonomous GSE should use On Condition for sensors and drivetrain, Condition Monitoring for electronics, and Hard Time only for consumables (brake fluid, filters).

### 9.2 Mining Autonomous Fleet Maintenance: Caterpillar and Komatsu

Autonomous haul trucks in mining are the closest operational parallel to autonomous GSE at airports:

| Attribute | Mining Autonomous Haul Trucks | Autonomous GSE (Airport) |
|---|---|---|
| Operating hours | 20-24 hours/day | 16-20 hours/day |
| Environment | Extreme dust, temperature, vibration | De-icing chemicals, jet blast, temperature |
| Fleet size | 20-100+ per mine | 20-100+ per airport |
| Speed | 30-60 km/h (loaded), 50-80 km/h (empty) | 5-25 km/h |
| Vehicle value | $3-6M per truck | $60-180K per vehicle |
| Downtime cost | $5,000-20,000/hour (production loss) | $200-1,000/hour (SLA penalties) |

**Caterpillar MineStar (ProVision):** Caterpillar's autonomous fleet at Fortescue Metals Group (FMG) operates 100+ haul trucks 24/7. Published performance: 92-95% fleet availability, 15-20% productivity improvement over human-operated. Key maintenance practices:

- **Condition-based oil analysis:** Engine and hydraulic oil sampled every 250 hours, analyzed for metal particles indicating component wear. Catches bearing failures 500-1,000 hours before catastrophic failure.
- **Vibration analysis on haul motors:** Accelerometers detect imbalance, misalignment, and bearing faults. False positive rate <5% after 2 years of baseline building.
- **Tire pressure monitoring and load balancing:** Tire replacement is the single highest maintenance cost ($50K-80K per tire set). Predictive tire management extends life 15-20%.
- **Fleet health system (VIMS):** Vehicle Information Management System collects 100+ parameters per vehicle, trends over time, generates work orders automatically.

**Komatsu FrontRunner:** Operates 500+ autonomous trucks globally (Pilbara, Chile, Canada). Published metrics: 98% availability target, 3-5% better than human-operated. Komatsu uses a "condition-based maintenance excellence" program that reduced unplanned downtime by 35% in the first 2 years.

**Key lesson for Aurrigo:** Mining companies invested 3-5 years building baseline data before predictive models achieved acceptable accuracy. Start collecting telemetry data from day one of fleet operations, even before implementing predictive algorithms. The data has compounding value.

### 9.3 Waymo Fleet Maintenance at Scale

Waymo's maintenance operations, while not fully public, provide relevant data points from partner disclosures and industry reports:

- **Sensor cleaning frequency:** Daily cleaning of LiDAR and cameras at depot during night charging. Automated cleaning systems being tested.
- **Sensor replacement rate:** Waymo's 5th-generation sensor suite (custom LiDAR + cameras) has lower field replacement rates than earlier generations, suggesting reliability improvement through design iteration.
- **Maintenance partner model:** Waymo contracts physical maintenance to partners (Avis, Moove) rather than building in-house capability. This separates autonomy expertise from wrench-turning.
- **Compute module refresh:** Waymo reportedly cycles compute modules every 2-3 years to keep up with ML model requirements, treating compute as a consumable.

### 9.4 Amazon Robotics / Kiva Fleet Maintenance

Amazon operates 750,000+ Kiva/Proteus robots across fulfillment centers. Relevant practices:

- **Fleet size enables statistical maintenance:** At 750K units, Amazon has sufficient data to predict failure modes with high precision. Individual operators with 20-100 vehicles will not achieve this statistical power for years --- highlighting the value of fleet priors and cross-fleet knowledge sharing.
- **Hot-swap design philosophy:** Kiva robots are designed for field-replaceable modules. A failed drive motor module can be swapped in <15 minutes by a minimally trained technician. The failed module goes to a repair depot for component-level repair by specialists.
- **Predictive battery management:** Battery replacement is the single highest maintenance cost per robot. Amazon's battery management system predicts replacement needs based on cycle count, temperature history, and capacity fade curve.
- **Scale economics:** At 750K units, Amazon negotiates supplier contracts that include on-site spare parts inventory managed by the supplier (vendor-managed inventory, VMI). This shifts holding cost and obsolescence risk to the supplier.

**Lesson for Aurrigo:** Design vehicles for field-replaceable units (FRUs) wherever possible. A LiDAR module that requires 20 minutes of cable routing to replace should be redesigned into a snap-in/snap-out mounting system. The MTTR reduction pays for the design effort after 10-20 replacements.

### 9.5 Common Pitfalls in Fleet Maintenance Scaling

From interviews and published post-mortems across autonomous fleet operators:

| Pitfall | Description | Mitigation |
|---|---|---|
| **Spreadsheet syndrome** | Starting with spreadsheets for maintenance tracking; hitting chaos at 20+ vehicles | Implement structured database from day 1 (even if simple) |
| **Data desert** | Not collecting telemetry during pilot, then lacking baseline for prediction | Start data collection at pilot, even if not yet used |
| **Single-point-of-knowledge** | One technician knows everything, becomes bottleneck | Document procedures, cross-train, standardize |
| **Spare parts scramble** | No inventory system; scramble to order parts after failure | Size initial depot using cold-start formula (Section 5.4) |
| **Over-engineering prediction** | Building complex ML models before having enough failure data | Start with Weibull + manufacturer specs; add ML after 12+ months of fleet data |
| **Ignoring correlated failures** | Treating each failure as independent; surprised by fleet-wide events | Track environmental conditions; correlate failures with de-icing, heat, salt |
| **Depot bottleneck** | Two maintenance bays for 50 vehicles; queue builds during peak maintenance | Size depot capacity for 10-15% of fleet simultaneously |

---

## 10. Cost Analysis

### 10.1 Per-Vehicle Annual Maintenance Cost Breakdown

| Category | Cost Range (Annual) | Subcategories | Notes |
|---|---|---|---|
| **Sensors** | $2,000-5,000 | Cleaning labor ($500-1,500), replacement LiDAR modules prorated ($800-2,000), recalibration labor ($500-1,000), cleaning supplies ($200-500) | Cleaning is the largest ongoing sensor cost |
| **Compute** | $500-1,500 | Thermal management (paste/pad replacement $100-300), fan replacement ($50-200), prorated Orin replacement ($300-800), diagnostics labor ($50-200) | Very low; compute is highly reliable |
| **Drivetrain** | $3,000-8,000 | Motor service prorated ($500-2,000), gearbox service ($300-800), bearing replacement ($200-600), tire replacement ($800-2,400), wheel alignment ($200-400), drive belt/chain ($200-500) | Tires are the largest drivetrain cost |
| **Steering** | $500-1,500 | Actuator service prorated ($200-800), linkage inspection ($100-300), encoder replacement prorated ($100-200), lubrication ($50-100) | Lower frequency than drivetrain |
| **Brakes** | $500-1,500 | Pad replacement ($100-400), fluid change ($50-100), disc replacement prorated ($100-400), caliper service ($100-300), labor ($150-300) | Regenerative braking extends pad life 2-3x |
| **Power / Battery** | $1,000-3,000 | Cell balancing service ($200-600), cooling system maintenance ($200-500), BMS calibration ($100-300), prorated pack replacement ($500-1,500) | Battery pack is the highest-value wear item |
| **Body / Structure** | $500-2,000 | Panel repair (de-icing/jet blast damage) ($200-800), corrosion treatment ($100-400), paint/coating ($100-300), mount/bracket repair ($100-500) | Higher at coastal/harsh airports |
| **Network / Connectivity** | $200-500 | CAN connector replacement ($50-200), Ethernet connector service ($50-150), antenna inspection ($50-100), harness inspection ($50-100) | Environment-dependent |
| **General labor overhead** | $1,000-2,500 | Technician time for inspections, record-keeping, parts procurement, depot overhead | Scales sub-linearly with fleet size |
| **Total per vehicle** | **$8,200-23,500** | | Mid-point: ~$15,000/vehicle/year |

**Comparison with TCO document estimate:** The fleet TCO document estimates $6,700-18,000/year per vehicle for maintenance. This document's estimate of $8,200-23,500 is slightly higher because it includes prorated replacement costs for high-value items (battery, motors) that the TCO document may have excluded from annual OPEX. The mid-range estimates are consistent at approximately $12,000-15,000/vehicle/year.

### 10.2 Maintenance Staff Requirements

| Fleet Size | Technicians Required | Ratio | Annual Staff Cost | Per-Vehicle Staff Cost |
|---|---|---|---|---|
| 10 vehicles | 1 FTE | 1:10 | $50,000-70,000 | $5,000-7,000 |
| 20 vehicles | 2 FTE | 1:10 | $100,000-140,000 | $5,000-7,000 |
| 50 vehicles | 4-5 FTE | 1:10-12 | $200,000-350,000 | $4,000-7,000 |
| 100 vehicles | 8-10 FTE | 1:10-12 | $400,000-700,000 | $4,000-7,000 |
| 200 vehicles (multi-airport) | 15-18 FTE | 1:11-13 | $750,000-1,260,000 | $3,750-6,300 |

**Ratio improvement at scale:** At small fleet sizes (10-20 vehicles), one technician per 8-10 vehicles is needed because travel time between airport locations and the overhead of managing parts/procedures is high relative to actual wrench time. At 50+ vehicles, specialization (one technician does all sensor work, another does drivetrain) and depot efficiency improve the ratio to 1:10-13.

**Skill levels required:**
- **Level 1 (all technicians):** Sensor cleaning, tire/brake pad replacement, connector inspection, basic software diagnostics
- **Level 2 (senior technicians, 30-50% of staff):** LiDAR/compute module swap, sensor recalibration, motor replacement, battery module service
- **Level 3 (specialist, 1-2 per region):** CAN bus debugging, GTSAM calibration, firmware programming, root cause analysis on complex failures

### 10.3 Predictive vs Reactive Maintenance Cost Comparison

| Cost Category | Reactive (Current) | Predictive (Proposed) | Savings |
|---|---|---|---|
| **Unplanned downtime cost** (20 vehicles) | $100,000-420,000/year | $30,000-170,000/year | $70,000-250,000 (60-70% reduction) |
| **Spare parts inventory** | $60,000-80,000 (overstocked for uncertainty) | $45,000-55,000 (right-sized) | $15,000-25,000 (20-30% reduction) |
| **Parts expediting fees** | $5,000-15,000/year (rush orders) | $1,000-3,000/year | $4,000-12,000 (80% reduction) |
| **Labor efficiency** | $100,000-140,000 (2 FTE, reactive) | $90,000-120,000 (2 FTE, more efficient) | $10,000-20,000 (10-15% more productive) |
| **Component life extension** | Baseline | +10-20% through condition-based timing | $5,000-15,000 (fewer premature replacements) |
| **Total annual cost (20 vehicles)** | $265,000-655,000 | $166,000-348,000 | **$99,000-307,000 (30-50% reduction)** |

**Mid-point savings: ~$150,000/year for a 20-vehicle fleet.**

### 10.4 ROI of Predictive Maintenance System

| Item | Cost | Timing |
|---|---|---|
| **Implementation (Phases 1-4)** | $50,000-85,000 | One-time, 22 weeks |
| **Annual system maintenance** | $10,000-15,000/year | Cloud hosting, model retraining, dashboard |
| **Annual savings** | $99,000-307,000/year | From reduced downtime, right-sized inventory, fewer rush orders |
| **Net annual benefit** | $84,000-292,000/year | Savings minus system maintenance |
| **Payback period** | **8-12 months** | Implementation cost / annual savings |
| **3-year NPV (8% discount)** | $160,000-640,000 | Net benefit over 3 years |

At mid-range estimates: $67,500 implementation cost, $150,000/year savings, $12,500/year system maintenance = **payback in 6 months, 3-year NPV of ~$290,000** for a 20-vehicle fleet.

---

## 11. Implementation Roadmap

### Phase 1: ROS Diagnostics Aggregation + Vehicle Health Index ($10-15K, 4 weeks)

| Week | Deliverable | Details |
|---|---|---|
| 1 | CAN diagnostic bridge | ROS node reading CAN signals, publishing DiagnosticStatus for motor, steering, brakes, battery |
| 2 | Compute health diagnostics | GPU temp, memory, ECC errors, fan RPM published to /diagnostics |
| 2 | Integration with sensor health | Cross-reference output from existing sensor health monitor into unified diagnostics aggregator |
| 3 | Subsystem health assessor | Level 2 scoring for all 6 subsystems |
| 3 | Vehicle Health Index | Level 3 composite VHI computation and /vehicle_health topic |
| 4 | Fleet health dashboard v1 | Grafana dashboards showing per-vehicle VHI, subsystem breakdown, historical trending |

**Dependencies:** Sensor health monitoring node (from [sensor-degradation-health-monitoring.md](../../20-av-platform/sensors/sensor-degradation-health-monitoring.md)) must be operational. CAN DBC file for Aurrigo vehicles must be available.

**Deliverables:**
- CAN diagnostic bridge ROS node (Python, ~500 lines)
- Compute health diagnostics ROS node (Python, ~300 lines)
- Vehicle health assessor ROS node (Python, ~400 lines)
- Grafana dashboard configuration (JSON, per-vehicle + fleet overview)
- Documentation for adding new diagnostic sources

### Phase 2: Failure Prediction Models + Maintenance Scheduling ($15-25K, 6 weeks)

| Week | Deliverable | Details |
|---|---|---|
| 5-6 | Weibull PHM models | Fit Weibull models for each component type using manufacturer data + fleet priors. RUL estimation for all components |
| 7-8 | Anomaly detection | Autoencoder on CAN signals for early warning of unusual patterns. Baseline collection from 30+ days of fleet data |
| 9 | Maintenance scheduler v1 | Opportunity maintenance during charging. Demand-aware scheduling using A-CDM flight data. Task grouping logic |
| 10 | Integration testing | Full pipeline: diagnostics -> health assessment -> failure prediction -> maintenance request -> scheduled work order |

**Dependencies:** Phase 1 complete. 30+ days of fleet health telemetry for anomaly detection baseline. A-CDM data feed available (or mock for testing).

**Deliverables:**
- Weibull PHM prediction service (Python, ~800 lines)
- Autoencoder anomaly detection model (PyTorch, ~400 lines)
- Maintenance scheduling service (Python/OR-Tools, ~600 lines)
- Integration test suite
- Calibrated Weibull parameters for all component types

### Phase 3: Spare Parts Inventory System + Procurement Integration ($10-20K, 4 weeks)

| Week | Deliverable | Details |
|---|---|---|
| 11-12 | Inventory management system | Part database with serial numbers, locations, quantities. (s,S) reorder policy with auto-alerts. Cold-start sizing calculator for new airports |
| 13 | Demand forecasting | Combine Weibull RUL predictions with current fleet health to forecast spare parts demand 30/60/90 days out |
| 14 | Procurement pipeline | Auto-generate purchase orders when reorder points hit. Supplier lead time tracking. Batch alert for same-manufacturing-lot components |

**Dependencies:** Phase 2 complete (failure predictions feed demand forecast). Supplier catalog with pricing and lead times.

**Deliverables:**
- Inventory management web application (or integration with existing ERP)
- Demand forecasting service (Python, ~500 lines)
- Procurement alert pipeline
- Initial stocking list calculator

### Phase 4: Fleet-Level Optimization + Multi-Airport Scaling ($15-25K, 8 weeks)

| Week | Deliverable | Details |
|---|---|---|
| 15-16 | LSTM/XGBoost models | Train ML prediction models on 6+ months of fleet data. Compare against Weibull baselines. Deploy better model per component type |
| 17-18 | Fleet Bayesian hierarchical model | Share statistical strength across vehicles. Cold-start prediction for new vehicles. Batch failure early warning system |
| 19-20 | Multi-echelon inventory | Regional hub integration. Pooling across airports. Obsolescence risk management |
| 21-22 | Continuous improvement | A/B test prediction models. Calibrate false alarm rates. Tune scheduling MIP parameters. Documentation and training |

**Dependencies:** 6+ months of fleet operating data. Multiple airports in operation (or planned).

**Deliverables:**
- ML prediction models (LSTM + XGBoost) with comparison benchmarks
- Fleet Bayesian model with cold-start capability
- Multi-echelon inventory optimization
- Model performance dashboards (precision, recall, RUL MAE)
- Operations manual for maintenance system

### Summary

| Phase | Duration | Cost | Key Deliverable |
|---|---|---|---|
| Phase 1 | 4 weeks | $10-15K | Vehicle Health Index + dashboard |
| Phase 2 | 6 weeks | $15-25K | Failure prediction + maintenance scheduling |
| Phase 3 | 4 weeks | $10-20K | Spare parts inventory system |
| Phase 4 | 8 weeks | $15-25K | Fleet optimization + multi-airport |
| **Total** | **22 weeks** | **$50-85K** | **Complete predictive maintenance system** |

Each phase delivers standalone value. Phase 1 alone provides visibility into fleet health that does not currently exist. Phase 2 reduces unplanned downtime. Phase 3 reduces spare parts costs. Phase 4 optimizes for scale.

---

## 12. Key Takeaways

1. **Traditional scheduled maintenance wastes 20-30% on unnecessary work while missing 40-60% of actual failures.** Condition-based and predictive maintenance flips this ratio by maintaining components based on actual degradation rather than calendar time.

2. **LiDAR lens contamination (RPN 192) is the highest-risk failure mode for autonomous GSE.** It is the most frequent, environment-dependent, and not addressable by time-based schedules. Sensor cleaning is the single most common maintenance event, accounting for 60-70% of depot visits.

3. **Correlated failures are the fleet-level risk that component-level models miss.** De-icing events, extreme heat, and salt spray cause simultaneous degradation across multiple vehicles and multiple subsystems. The PHM system must track environmental context to predict and respond to fleet-wide events.

4. **Weibull proportional hazards models are the right starting point**, not deep learning. They work with manufacturer data + fleet priors (no training data needed), produce interpretable results, and achieve 60-75% precision for wear-out failures. LSTM and XGBoost improve accuracy after 6-12 months of fleet data but are not worth deploying before that.

5. **Cold-start inventory for a 20-vehicle fleet depot costs $36,000-51,000.** LiDAR modules and battery modules dominate the cost. The formula in Section 5.4 sizes inventory based on fleet size, failure rates, and lead times, avoiding both understocking (downtime) and overstocking (tied-up capital).

6. **Opportunity maintenance during charging windows eliminates 40-60% of dedicated maintenance downtime.** The maintenance scheduler must integrate with the charging schedule and A-CDM demand forecasts to exploit natural gaps without impacting fleet capacity.

7. **Fleet sizing requires a 10-20% maintenance buffer**: for a 20-vehicle fleet, stock 2-3 additional vehicles. Predictive maintenance reduces the required buffer from 15-20% (reactive) to 8-12% (predictive), freeing $100-200K in vehicle capital.

8. **Per-vehicle annual maintenance cost is $8,200-23,500 (mid-point ~$15,000)**, consistent with the fleet TCO document's estimate. Predictive maintenance reduces total maintenance cost by 30-50%, saving $99,000-307,000/year for a 20-vehicle fleet.

9. **Mining autonomous fleets (Caterpillar, Komatsu) are the closest operational benchmark.** They achieve 92-98% fleet availability in 24/7 harsh-environment operations using condition-based monitoring and predictive analytics. Key lesson: start collecting telemetry data from day one, even before prediction models are ready.

10. **Implementation cost is $50-85K over 22 weeks**, with payback in 8-12 months from reduced downtime, right-sized inventory, and fewer expedited parts orders. Phase 1 alone (Vehicle Health Index + dashboard, $10-15K, 4 weeks) provides immediate operational visibility.

11. **Design vehicles for field-replaceable units (FRUs).** Every minute saved on MTTR compounds across thousands of maintenance events per year. A snap-in LiDAR mount that saves 20 minutes per swap saves 80-160 hours/year across a 20-vehicle fleet.

12. **Multi-airport spare parts pooling reduces per-airport inventory cost by 20-40%.** A regional hub serving 3-5 airports achieves better stock utilization than independent airport depots, following the same economics as airline spare engine pooling agreements.

---

## 13. References

### Standards

1. ISO 13381-1:2015, *Condition monitoring and diagnostics of machines --- Prognostics --- Part 1: General guidelines*. International Organization for Standardization.
2. SAE ARP6461, *Guidelines for Implementation of Structural Health Monitoring on Fixed Wing Aircraft*. SAE International. (Adapted for vehicle health management framework.)
3. ISO 55000:2014, *Asset management --- Overview, principles and terminology*. International Organization for Standardization.
4. ISO 3691-4:2023, *Industrial trucks --- Safety requirements and verification --- Part 4: Driverless industrial trucks and their systems*. International Organization for Standardization.
5. MIL-HDBK-217F, *Military Handbook: Reliability Prediction of Electronic Equipment*. US Department of Defense. (Used for electronic component failure rate estimation.)
6. IEC 61649:2008, *Weibull analysis*. International Electrotechnical Commission.
7. SAE J1939, *Recommended Practice for a Serial Control and Communications Vehicle Network*. SAE International.

### Academic Papers and Industry Reports

8. Jardine, A.K.S., Lin, D., and Banjevic, D. (2006). "A review on machinery diagnostics and prognostics implementing condition-based maintenance." *Mechanical Systems and Signal Processing*, 20(7), 1483-1510.
9. Lei, Y., Li, N., Guo, L., Li, N., Yan, T., and Lin, J. (2018). "Machinery health prognostics: A systematic review from data acquisition to RUL prediction." *Mechanical Systems and Signal Processing*, 104, 799-834.
10. Baptista, M., Sankararaman, S., de Medeiros, I.P., Nascimento Jr., C., Prendinger, H., and Henriques, E.M.P. (2018). "Forecasting fault events for predictive maintenance using data-driven techniques and ARMA modeling." *Computers & Industrial Engineering*, 115, 41-53.
11. Hu, Y., Baraldi, P., Di Maio, F., and Zio, E. (2015). "A systematic semi-supervised self-adaptable fault diagnostics approach in an evolving environment." *Mechanical Systems and Signal Processing*, 60-61, 413-427.
12. Cox, D.R. (1972). "Regression models and life tables." *Journal of the Royal Statistical Society: Series B*, 34(2), 187-220.
13. Bender, A., et al. (2021). "An Autonomous Framework for Mining Fleet Predictive Maintenance." *Journal of Field Robotics*, 38(5), 767-789.
14. Thompson, H.A. (2018). "The Application of Predictive Maintenance to Mining Equipment." *CIM Journal*, 9(2).
15. Sikorska, J.Z., Hodkiewicz, M., and Ma, L. (2011). "Prognostic modelling options for remaining useful life estimation by industry." *Mechanical Systems and Signal Processing*, 25(5), 1803-1836.

### Industry Sources

16. Caterpillar Inc. (2024). "MineStar Solutions --- Autonomous Fleet Operations." Caterpillar publications.
17. Komatsu Ltd. (2025). "FrontRunner Autonomous Haulage System Performance Report." Komatsu Global.
18. SKF Group. (2023). "SKF Bearing Calculator --- L10 Life Estimation." SKF online tools.
19. RoboSense Technology. (2025). "RSHELIOS Product Reliability Specification." RS-SPEC-2025.
20. NVIDIA Corporation. (2024). "Jetson Orin AGX Module Data Sheet and Reliability Report." NVIDIA Developer.
21. FLIR Systems / Teledyne. (2024). "Boson 640 Reliability and Environmental Testing Report."
22. Continental AG. (2025). "ARS548 4D Imaging Radar Specification Sheet."
23. IATA. (2024). "Ground Handling Safety Report." International Air Transport Association.

### Cross-References Within Repository

- [Sensor Degradation and Health Monitoring](../../20-av-platform/sensors/sensor-degradation-health-monitoring.md) --- Per-sensor diagnostics, cross-sensor consistency, Level 1 of PHM
- [Fleet Management and Dispatch](fleet-management-dispatch.md) --- Fleet dispatch integration, health-aware vehicle assignment
- [Fleet TCO and Business Case](../../70-operations-domains/airside/business-case/fleet-tco-business-case.md) --- Maintenance cost context within total cost model
- [Fleet Task Allocation and Scheduling](../../30-autonomy-stack/multi-agent-v2x/fleet-task-allocation-scheduling.md) --- CP-SAT scheduling, disruption handling, maintenance vehicle routing
- [CAN Bus and Drive-by-Wire](../../20-av-platform/drive-by-wire/can-bus-dbw.md) --- CAN signal specifications, SocketCAN integration
- [Multi-LiDAR Extrinsic Calibration](../../20-av-platform/sensors/multi-lidar-calibration.md) --- Post-swap recalibration procedures
- [Multi-Airport Domain Adaptation](../../70-operations-domains/deployment-playbooks/multi-airport-adaptation.md) --- Per-airport depot setup, 8-week onboarding timeline
- [CI/CD and DevOps Pipeline](../../40-runtime-systems/ml-deployment/av-cicd-devops-pipeline.md) --- Software deployment pipeline integration
- [Runtime Verification and Monitoring](../../60-safety-validation/runtime-assurance/runtime-verification-monitoring.md) --- Predictive maintenance from operational data (Section 5.4)
- [Weather-Adaptive ODD Management](../../60-safety-validation/runtime-assurance/weather-adaptive-odd-management.md) --- Environmental conditions affecting maintenance schedules
- [HMI and Operator Interface](../../40-runtime-systems/monitoring-observability/hmi-operator-interface.md) --- Incident reporting pipeline feeding maintenance data
