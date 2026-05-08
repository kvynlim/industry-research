# Deterministic Real-Time Networking (TSN) for Airside Autonomous GSE

## Table of Contents
1. [Introduction & Motivation](#1-introduction--motivation)
2. [TSN Standards Overview](#2-tsn-standards-overview)
3. [Automotive TSN Architecture](#3-automotive-tsn-architecture)
4. [CAN Bus Limitations and Migration](#4-can-bus-limitations-and-migration)
5. [Mixed-Criticality Scheduling](#5-mixed-criticality-scheduling)
6. [Clock Synchronization (IEEE 802.1AS / gPTP)](#6-clock-synchronization-ieee-8021as--gptp)
7. [TSN for Multi-Sensor Fusion](#7-tsn-for-multi-sensor-fusion)
8. [CAN-to-Ethernet Gateway Architecture](#8-can-to-ethernet-gateway-architecture)
9. [5G TSN Integration for V2X](#9-5g-tsn-integration-for-v2x)
10. [In-Vehicle Network Architecture for Aurrigo](#10-in-vehicle-network-architecture-for-aurrigo)
11. [Functional Safety and TSN](#11-functional-safety-and-tsn)
12. [Production Deployments and Case Studies](#12-production-deployments-and-case-studies)
13. [Implementation Roadmap](#13-implementation-roadmap)
14. [Key Takeaways](#14-key-takeaways)
15. [References](#15-references)

---

## 1. Introduction & Motivation

### 1.1 The Networking Gap in Autonomous GSE

Aurrigo's current in-vehicle network architecture relies on:
- **CAN bus** (ISO 11898): Vehicle control, actuators, safety signals — 500 kbps to 1 Mbps
- **Ethernet** (standard, non-deterministic): LiDAR point clouds, compute interconnect — 1 Gbps
- **Two separate domains** with no unified timing or priority management

This creates fundamental problems:

| Problem | Impact | Current Workaround |
|---|---|---|
| CAN bandwidth ceiling | 1 Mbps cannot carry sensor fusion data | Separate Ethernet for sensors, CAN for control |
| No common time reference | LiDAR, IMU, GPS, cameras have independent timestamps | Software synchronization (ms-level jitter) |
| No traffic priority | Emergency stop competes with diagnostic logging | Separate CAN buses for safety vs. non-safety |
| Non-deterministic Ethernet | LiDAR burst can delay control commands by ms | Over-provisioning (hope for the best) |
| No end-to-end latency guarantee | Cannot certify max latency from sensor to actuator | Conservative timing margins waste compute budget |

### 1.2 Why TSN Matters for Airside AV

```
CURRENT STATE:                          TSN-ENABLED STATE:

  LiDAR ──[Ethernet]──→ Orin          LiDAR ──[TSN Ethernet]──→ Orin
  Camera ──[MIPI/Eth]──→ Orin          Camera ──[TSN Ethernet]──→ Orin
  Radar ──[Ethernet]──→ Orin           Radar ──[TSN Ethernet]──→ Orin
                                        IMU ──[TSN Ethernet]──→ Orin
  IMU ──[SPI]──→ Orin                  
                                        ↕ All on ONE unified network
  Orin ──[CAN]──→ Steering              ↕ with guaranteed timing
  Orin ──[CAN]──→ Brakes               
  Orin ──[CAN]──→ Drive motor          Orin ──[TSN Ethernet]──→ TSN-CAN GW
                                              ──→ Steering
  Safety MCU ──[CAN]──→ E-Stop               ──→ Brakes
                                              ──→ Drive motor
  Result: Two domains, no              
  timing guarantees,                   Safety MCU ──[TSN Ethernet]──→ E-Stop
  ms-level synchronization             
                                        Result: ONE deterministic network,
                                        sub-μs synchronization,
                                        guaranteed <500μs latency
```

### 1.3 Market Context

The automotive TSN market reached $1.8B in 2025 and is projected to reach $7.2B by 2034 (CAGR 16.7%). ADAS/autonomous driving accounts for ~39% of revenue. Production TSN networks are deployed in BMW iX, Mercedes S-Class, and Volvo EX90 as of 2025.

---

## 2. TSN Standards Overview

### 2.1 IEEE 802.1 TSN Task Group Standards

TSN is not a single standard but a collection of IEEE 802.1 amendments that together provide deterministic, time-synchronized, fault-tolerant Ethernet networking.

```
┌──────────────────────────────────────────────────────────────┐
│                    TSN STANDARD STACK                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  TIME SYNCHRONIZATION                                        │
│  ┌────────────────────────────────────────┐                  │
│  │ IEEE 802.1AS-2020 (gPTP)              │ Sub-μs clock sync│
│  │ Generalized Precision Time Protocol    │ across network   │
│  └────────────────────────────────────────┘                  │
│                                                              │
│  TRAFFIC SCHEDULING                                          │
│  ┌────────────────────────────────────────┐                  │
│  │ IEEE 802.1Qbv (TAS)                   │ Time-aware gates │
│  │ Time-Aware Shaper                      │ per queue        │
│  ├────────────────────────────────────────┤                  │
│  │ IEEE 802.1Qbu (Frame Preemption)      │ Interrupt low-   │
│  │ + IEEE 802.3br (Interspersing Express) │ priority frames  │
│  ├────────────────────────────────────────┤                  │
│  │ IEEE 802.1Qav (CBS)                   │ Credit-based     │
│  │ Credit-Based Shaper                    │ bandwidth limit  │
│  └────────────────────────────────────────┘                  │
│                                                              │
│  RELIABILITY                                                 │
│  ┌────────────────────────────────────────┐                  │
│  │ IEEE 802.1CB (FRER)                   │ Frame             │
│  │ Frame Replication and Elimination      │ redundancy       │
│  ├────────────────────────────────────────┤                  │
│  │ IEEE 802.1Qci (PSFP)                 │ Per-stream        │
│  │ Per-Stream Filtering and Policing      │ filtering        │
│  └────────────────────────────────────────┘                  │
│                                                              │
│  STREAM MANAGEMENT                                           │
│  ┌────────────────────────────────────────┐                  │
│  │ IEEE 802.1Qcc (SRP Enhancement)      │ Centralized or   │
│  │ Stream Reservation Protocol            │ distributed      │
│  │                                        │ configuration    │
│  └────────────────────────────────────────┘                  │
│                                                              │
│  SECURITY                                                    │
│  ┌────────────────────────────────────────┐                  │
│  │ IEEE 802.1AE (MACsec)                │ L2 encryption    │
│  │ Media Access Control Security          │ + authentication │
│  └────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Key Standards for Airside AV

| Standard | Function | Airside Relevance | Priority |
|---|---|---|---|
| **802.1AS** (gPTP) | Clock synchronization | Multi-sensor timestamp alignment | **Critical** |
| **802.1Qbv** (TAS) | Time-aware scheduling | Guaranteed latency for safety commands | **Critical** |
| **802.1Qbu/802.3br** | Frame preemption | E-stop preempts LiDAR data transfer | **High** |
| **802.1CB** (FRER) | Frame redundancy | Dual-path safety message delivery | **High** |
| **802.1Qci** (PSFP) | Stream filtering | Isolate safety from non-safety traffic | **Medium** |
| **802.1Qcc** | Stream management | Centralized network configuration | **Medium** |
| **802.1AE** (MACsec) | L2 security | Prevent spoofed safety commands | **High** |

---

## 3. Automotive TSN Architecture

### 3.1 Zonal Architecture

Modern automotive networks are transitioning from domain-based (powertrain CAN, body CAN, chassis CAN) to zonal architecture with TSN backbone:

```
TRADITIONAL (Domain):               ZONAL with TSN:

  ┌─── Powertrain CAN ───┐         ┌─── Zone 1 (Front) ───┐
  │ Engine, Transmission  │         │ LiDAR, Camera, Radar  │
  └───────────────────────┘         │ Steering, Brakes      │
  ┌─── Chassis CAN ──────┐         └───────┬───────────────┘
  │ Steering, Brakes, ABS │                 │ TSN Ethernet
  └───────────────────────┘         ┌───────┴───────────────┐
  ┌─── ADAS Ethernet ────┐         │   Central Compute     │
  │ LiDAR, Camera, Radar  │         │   (Orin + Safety MCU) │
  └───────────────────────┘         └───────┬───────────────┘
  ┌─── Body CAN ─────────┐                 │ TSN Ethernet
  │ Lights, HVAC, Doors   │         ┌───────┴───────────────┐
  └───────────────────────┘         │ Zone 2 (Rear)         │
                                    │ LiDAR, Drive motor    │
  4-6 separate networks             │ Lights, power mgmt    │
  No common timing                  └───────────────────────┘
  Limited bandwidth sharing         
                                    1 unified TSN network
                                    Sub-μs synchronized
                                    Guaranteed latency
```

### 3.2 TSN Ethernet Physical Layer Options

| PHY | Speed | Cable | Max Distance | Automotive Grade | Cost/Port |
|---|---|---|---|---|---|
| 100BASE-T1 (BroadR-Reach) | 100 Mbps | Single UTP pair | 15m | OPEN Alliance TC8 | $2-5 |
| 1000BASE-T1 | 1 Gbps | Single UTP pair | 15-40m | OPEN Alliance TC10 | $5-10 |
| 2.5GBASE-T1 (MultiGBASE-T1) | 2.5 Gbps | Single UTP pair | 15m | Emerging | $8-15 |
| 10GBASE-T1 | 10 Gbps | Single UTP pair | 15m | Announced (Marvell) | $15-30 |
| Standard Ethernet (1000BASE-T) | 1 Gbps | Cat5e/Cat6 | 100m | No (consumer-grade) | $1-3 |

**For Aurrigo**: 1000BASE-T1 is the optimal choice — sufficient bandwidth for LiDAR point clouds (each RoboSense at ~100 Mbps), automotive-grade, single-pair wiring reduces cable weight and connector count.

### 3.3 Bandwidth Requirements Analysis

| Data Source | Raw Rate | After Compression | Period | Priority |
|---|---|---|---|---|
| RoboSense RSHELIOS (×6) | 6 × 100 Mbps = 600 Mbps | 6 × 40 Mbps = 240 Mbps | 100 ms (10 Hz) | High |
| Cameras (×4) | 4 × 200 Mbps = 800 Mbps | 4 × 50 Mbps = 200 Mbps | 33 ms (30 Hz) | Medium |
| 4D Radar (×2) | 2 × 10 Mbps = 20 Mbps | Minimal compression | 50 ms (20 Hz) | High |
| IMU (500 Hz) | 0.1 Mbps | N/A | 2 ms | Critical |
| GPS/RTK | 0.01 Mbps | N/A | 100 ms | High |
| Safety commands | 0.01 Mbps | N/A | 1-10 ms | **Critical** |
| Diagnostic/logging | 50-100 Mbps | Variable | Best-effort | Low |
| V2X communication | 1-10 Mbps | Variable | 10-100 ms | High |
| **Total** | **~1.5 Gbps** | **~500 Mbps** | | |

A 1 Gbps TSN backbone is sufficient for compressed sensor data. 2.5 Gbps provides headroom for uncompressed or additional sensors.

---

## 4. CAN Bus Limitations and Migration

### 4.1 CAN Bus in Current Aurrigo Stack

```
Current Aurrigo CAN Architecture (estimated):

  CAN Bus 1 (Safety, 500 kbps):
  ├── Safety MCU (STM32H725)
  ├── Emergency stop relay
  ├── Watchdog signals
  └── Speed limiter

  CAN Bus 2 (Drive, 500 kbps):
  ├── Steering actuator (ADT3: Ackermann + crab)
  ├── Drive motor controller
  ├── Brake controller
  └── Wheel odometry encoder

  CAN Bus 3 (Body/Accessories, 250 kbps):
  ├── Lights (indicators, headlights)
  ├── Horn
  ├── Battery management system (BMS)
  └── HVAC (if equipped)

  Total: 3 CAN buses, 1.25 Mbps aggregate bandwidth
```

### 4.2 CAN Bus Limitations

| Limitation | Impact on Autonomous Operations | Severity |
|---|---|---|
| **500 kbps max per bus** | Cannot carry sensor data — separate Ethernet needed | High |
| **8-byte payload** (Classic CAN) | Complex messages need multi-frame transport protocol | Medium |
| **No global clock** | CAN timestamps are per-node, not synchronized | High |
| **Priority inversion** | Low-priority frame in transmission delays high-priority | Medium |
| **Bus-level contention** | More nodes = more collisions = unpredictable latency | Medium |
| **No redundancy** | Single wire fault disables entire bus | High |
| **Distance limit** | 40m at 1 Mbps (sufficient for vehicle, not for fleet) | Low |

### 4.3 CAN FD as Intermediate Step

CAN FD (Flexible Data-rate) extends CAN while maintaining backward compatibility:

| Parameter | Classic CAN | CAN FD | Ethernet TSN |
|---|---|---|---|
| Data rate | 500 kbps - 1 Mbps | 2-8 Mbps | 100 Mbps - 10 Gbps |
| Payload | 8 bytes | 64 bytes | 1500+ bytes |
| Arbitration | CSMA/CR | CSMA/CR (same) | Scheduled (TAS) |
| Time sync | None | None native | gPTP (sub-μs) |
| Determinism | Priority-based, bounded | Same as CAN | Time-triggered, guaranteed |
| Redundancy | None | None | FRER (802.1CB) |
| Backward compatible | — | With CAN | Requires gateway |

**CAN FD verdict for Aurrigo**: Useful upgrade for actuator control (8x payload, 8x speed), but does not solve the fundamental problems of no clock sync, no deterministic scheduling, and no redundancy. CAN FD is a tactical improvement; TSN is the strategic solution.

---

## 5. Mixed-Criticality Scheduling

### 5.1 Traffic Classes for Airside AV

TSN enables multiple traffic classes with different timing guarantees on a single network:

| Traffic Class | ASIL | Max Latency | Bandwidth | Example Traffic |
|---|---|---|---|---|
| **Safety-Critical (SC)** | ASIL D | <100 μs | <1 Mbps | E-stop, brake command, geofence violation |
| **Time-Triggered (TT)** | ASIL B | <500 μs | ~10 Mbps | Steering command, speed setpoint, safety heartbeat |
| **Rate-Constrained (RC)** | QM-ASIL A | <2 ms | ~500 Mbps | LiDAR point clouds, camera frames, radar data |
| **Best-Effort (BE)** | QM | No guarantee | Remaining | Diagnostics, logging, software updates, telemetry |

### 5.2 Time-Aware Shaper (802.1Qbv) Configuration

The Time-Aware Shaper (TAS) uses Gate Control Lists (GCL) to open and close traffic queues according to a periodic schedule:

```
Time (μs)    0    125    250    375    500    625    750    875   1000
             │     │      │      │      │      │      │      │      │
Queue 7 (SC) █░░░░░░░░░░░░░░░░░░█░░░░░░░░░░░░░░░░░░░█░░░░░░░░░░░░░░
Queue 6 (TT) ░░░██░░░░░░░░░░░░░░░░░██░░░░░░░░░░░░░░░░░░██░░░░░░░░░░
Queue 5 (RC) ░░░░░██████████████░░░░░██████████████░░░░░░░██████████░
Queue 0 (BE) ░░░░░░░░░░░░░░░░░█░░░░░░░░░░░░░░░░░█░░░░░░░░░░░░░░░░█
             │     │      │      │      │      │      │      │      │
             
█ = Gate OPEN (traffic can transmit)
░ = Gate CLOSED (traffic blocked)

Cycle time: 500 μs (2 kHz — matches 500 Hz IMU rate)

SC window:  10 μs every 500 μs — guaranteed slot for safety commands
TT window:  20 μs every 500 μs — steering, speed setpoints
RC window: 400 μs every 500 μs — bulk sensor data
BE window:  70 μs every 500 μs — diagnostics, logging (fills gaps)
```

### 5.3 Frame Preemption (802.1Qbu/802.3br)

Frame preemption allows high-priority "express" traffic to interrupt an in-progress low-priority "preemptable" frame:

```
Without preemption:
  
  BE frame (1500B)    SC frame (waiting)
  ─────────────────── ─── 
  ├── 12 μs at 1 Gbps ──┤ ← SC delayed by up to 12 μs
  
With preemption:
  
  BE frame (start)  SC frame  BE frame (resume)
  ──────── ──────── ─── ──────────────────
  ├── 4 μs ┤       ├── 2 μs ┤  ← SC delayed <1 μs
           Preempt!         Resume
           
Benefit: Worst-case SC latency drops from 12 μs to <1 μs
```

**Critical for airside**: An emergency stop command must never wait for a LiDAR point cloud frame to finish transmitting. Frame preemption guarantees this.

### 5.4 GCL Configuration Example

```python
"""
TSN Gate Control List configuration for Aurrigo airside AV.
Uses tc (traffic control) on Linux with TAPRIO qdisc.
"""

import subprocess

TSN_INTERFACE = "eth0"  # TSN-capable NIC

def configure_taprio():
    """
    Configure Time-Aware Shaper using Linux tc TAPRIO.
    
    Priority mapping:
    TC 0: Best-effort (diagnostics, logging)
    TC 1: Rate-constrained (LiDAR, camera, radar)
    TC 2: Time-triggered (steering, speed commands)
    TC 3: Safety-critical (e-stop, brake, geofence)
    """
    
    # Remove existing qdisc
    subprocess.run([
        "tc", "qdisc", "del", "dev", TSN_INTERFACE, "root"
    ], check=False)
    
    # Configure TAPRIO with 500 μs cycle
    cmd = [
        "tc", "qdisc", "add", "dev", TSN_INTERFACE, "parent", "root",
        "handle", "100",
        "taprio",
        "num_tc", "4",
        # Map socket priorities to traffic classes
        "map", "0", "0", "0", "0", "1", "1", "2", "3",
        # Queue assignments per TC
        "queues", "1@0", "1@1", "1@2", "1@3",
        # Base time (aligned to gPTP epoch)
        "base-time", "0",
        # Gate Control List entries: gate_mask duration_ns
        # Bit mask: TC3=8, TC2=4, TC1=2, TC0=1
        # Entry 1: Safety-critical only (10 μs)
        "sched-entry", "S", "08", "10000",
        # Entry 2: Time-triggered + safety (20 μs)  
        "sched-entry", "S", "0C", "20000",
        # Entry 3: Rate-constrained + TT + SC (400 μs)
        "sched-entry", "S", "0E", "400000",
        # Entry 4: All open including best-effort (70 μs)
        "sched-entry", "S", "0F", "70000",
        # Flags: full offload to hardware
        "flags", "0x2",
    ]
    
    subprocess.run(cmd, check=True)
    print(f"TAPRIO configured on {TSN_INTERFACE} with 500 μs cycle")


def configure_vlan_priorities():
    """
    Map ROS topics to VLAN priorities for TSN classification.
    """
    priority_map = {
        # Safety-critical: VLAN priority 7 → TC 3
        '/safety/estop': 7,
        '/safety/brake_cmd': 7,
        '/safety/geofence_violation': 7,
        '/safety/watchdog': 7,
        
        # Time-triggered: VLAN priority 5-6 → TC 2
        '/control/steering_cmd': 6,
        '/control/speed_cmd': 6,
        '/control/actuator_feedback': 5,
        
        # Rate-constrained: VLAN priority 3-4 → TC 1
        '/rslidar_points': 4,
        '/camera/image_raw': 3,
        '/radar/detections': 4,
        '/imu/data_raw': 4,
        
        # Best-effort: VLAN priority 0-2 → TC 0
        '/diagnostics': 1,
        '/rosout': 0,
        '/telemetry': 1,
    }
    return priority_map
```

---

## 6. Clock Synchronization (IEEE 802.1AS / gPTP)

### 6.1 Why Sub-Microsecond Synchronization Matters

Current Aurrigo sensor synchronization relies on software timestamps:

| Method | Accuracy | Problem |
|---|---|---|
| ROS Time (`rospy.Time.now()`) | ~1-10 ms | OS scheduling jitter, network delay variation |
| NTP | ~1-10 ms | Same — NTP over IP, not deterministic |
| PTP (IEEE 1588) | ~100 ns - 1 μs | Good, but requires PTP-aware switches |
| gPTP (802.1AS) | <100 ns | Native to TSN, integrated with TAS |
| PPS (Pulse-Per-Second) | ~10-100 ns | Hardware only, point-to-point |

**Impact of timing error on sensor fusion**:

At 25 km/h (typical airside speed), 1 ms timing error = **7 mm position error** per sensor. For 6 LiDARs with independent 1 ms jitter, worst-case fusion error = **~17 mm** (root-sum-square). This exceeds the ±5 cm docking tolerance if timing errors are correlated.

With gPTP (<100 ns synchronization): position error < **0.001 mm** — effectively zero.

### 6.2 gPTP Architecture

```
gPTP Clock Hierarchy:

  ┌───────────────┐
  │ GPS/GNSS      │ ← External reference (UTC)
  │ Grandmaster   │
  └───────┬───────┘
          │ PPS + NMEA
  ┌───────┴───────┐
  │ TSN Switch    │ ← Grandmaster clock (802.1AS)
  │ (Grandmaster) │    Distributes time to all endpoints
  └───┬───┬───┬───┘
      │   │   │
  ┌───┴┐ ┌┴──┐ ┌┴───────┐
  │Orin│ │IMU│ │LiDAR   │ ← Slave clocks (synchronized to GM)
  │    │ │   │ │Driver  │    All timestamps in common timebase
  └────┘ └───┘ └────────┘

Synchronization process (Peer-to-Peer):
1. Switch sends Sync message with timestamp T1
2. Endpoint receives with timestamp T2
3. Endpoint sends PDelay_Req, receives PDelay_Resp
4. Calculate: offset = (T2 - T1) - propagation_delay
5. Adjust local clock by offset
6. Repeat every 125 ms (8 Hz sync rate)

Result: All nodes within <100 ns of Grandmaster clock
```

### 6.3 Benefits for Aurrigo Sensor Fusion

```python
"""
Unified timestamp management with gPTP for GTSAM factor graph.
Replaces per-sensor software timestamps with hardware gPTP time.
"""

class GPTPTimestampManager:
    """
    Provides a single time domain for all sensors via IEEE 802.1AS.
    
    Before gPTP: Each sensor has independent clock
      - LiDAR scan start: sensor internal clock (±1-5 ms from true time)
      - IMU sample: sensor internal clock (±0.1-1 ms)
      - Camera frame: sensor internal clock (±1-5 ms)
      - GPS: GPS time (±10-50 ns, but different domain)
    
    After gPTP: All sensors synchronized to GPS-disciplined grandmaster
      - All timestamps in TAI (International Atomic Time) ± <100 ns
      - No interpolation or approximation needed for sensor fusion
    """
    
    def __init__(self, ptp_device='/dev/ptp0'):
        self.ptp_fd = open(ptp_device, 'rb')
    
    def get_gptm_time(self):
        """Get current gPTP time from hardware clock."""
        # ioctl to read PTP hardware clock
        import fcntl, struct
        PTP_CLOCK_GETTIME = 0xC0106A01
        buf = struct.pack('ll', 0, 0)  # timespec
        result = fcntl.ioctl(self.ptp_fd, PTP_CLOCK_GETTIME, buf)
        sec, nsec = struct.unpack('ll', result)
        return sec + nsec * 1e-9
    
    def align_sensor_data(self, lidar_msg, imu_msg, camera_msg):
        """
        All messages already in gPTP time domain.
        No software synchronization needed — hardware guarantees <100ns.
        
        Before gPTP: needed complex interpolation and extrapolation
        After gPTP: direct lookup, temporal alignment is trivial
        """
        target_time = lidar_msg.header.stamp  # Reference: LiDAR scan start
        
        # IMU at target_time: direct lookup (no interpolation needed at <100ns)
        imu_at_target = self.imu_buffer.get_nearest(target_time)
        
        # Camera at target_time: direct lookup
        camera_at_target = self.camera_buffer.get_nearest(target_time)
        
        return AlignedSensorData(
            lidar=lidar_msg,
            imu=imu_at_target,
            camera=camera_at_target,
            max_temporal_error_ns=100,  # gPTP guarantee
        )
```

### 6.4 Multi-LiDAR Synchronization

Currently, synchronizing 4-8 RoboSense LiDARs uses PTP/PPS (IEEE 1588). With gPTP:

| Aspect | Current (PTP/PPS) | With gPTP (802.1AS) |
|---|---|---|
| Sync accuracy | <1 μs | <100 ns |
| Configuration | Per-sensor PTP config | Automatic (802.1AS profile) |
| Network requirement | PTP-aware switches | TSN switches (superset) |
| Failure detection | Manual monitoring | gPTP fault annunciation |
| Integration with TAS | Separate | Native (same time domain) |

---

## 7. TSN for Multi-Sensor Fusion

### 7.1 Deterministic Sensor Data Delivery

The key challenge: delivering LiDAR, camera, radar, and IMU data to the Orin compute platform with guaranteed latency and ordering.

```
Sensor Fusion Timing with TSN:

Time (ms)  0     1     2     3     4     5     6     7     8     9    10
           │     │     │     │     │     │     │     │     │     │     │
IMU        ████  ████  ████  ████  ████  ████  ████  ████  ████  ████ 
(500 Hz)   ↑guaranteed <100μs delivery

Radar      ██████████████████████████████████████████████████████████████
(20 Hz)    ↑                                        ↑ guaranteed <500μs

LiDAR      ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
(10 Hz)    ├─ each LiDAR: ~40MB/s, delivered over 80ms window ─────────┤
           ↑ guaranteed completion before next cycle

Camera     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
(30 Hz)    ↑ rate-constrained, no hard deadline

Safety     ▌                    ▌                    ▌
E-stop     ↑ preempts ALL — guaranteed <100μs end-to-end
```

### 7.2 Worst-Case Latency Analysis

For safety certification (ISO 3691-4), we need provable worst-case end-to-end latency:

| Path | Hops | Per-Hop Latency | Store-and-Forward | **Worst Case** |
|---|---|---|---|---|
| E-stop sensor → Safety MCU | 1-2 | 1-3 μs (wire) | 1.2 μs (64B @ 1Gbps) | **<10 μs** |
| Safety MCU → Brake actuator | 1-2 | 1-3 μs | 1.2 μs | **<10 μs** |
| Orin → Steering actuator | 2-3 | 3-9 μs | 1.2 μs | **<20 μs** |
| LiDAR → Orin (full scan) | 1-2 | — | ~3 ms (400KB @ 1Gbps) | **<5 ms** |
| IMU → Orin (single sample) | 1-2 | 1-3 μs | 0.5 μs (32B) | **<10 μs** |

**Comparison with CAN bus**:
- E-stop over CAN: worst case = message length (134 bits / 500kbps) + arbitration delay = **~0.5-2 ms**
- E-stop over TSN Ethernet: worst case = **<10 μs** — **50-200x faster**

### 7.3 Bandwidth Allocation with Credit-Based Shaper

For non-time-triggered traffic (sensor streams), IEEE 802.1Qav Credit-Based Shaper (CBS) limits bandwidth per stream to prevent starvation:

```python
# Credit-Based Shaper configuration for sensor streams
CBS_CONFIG = {
    'lidar_stream_0': {
        'idle_slope': 200_000_000,   # 200 Mbps allocated for 6 LiDARs (compressed)
        'send_slope': -800_000_000,  # 1 Gbps link - 200 Mbps
        'hi_credit': 25_000,         # Max burst: 25 KB (1 LiDAR packet)
        'lo_credit': -100_000,       # Recovery after burst
    },
    'camera_stream': {
        'idle_slope': 200_000_000,   # 200 Mbps for 4 cameras (compressed)
        'send_slope': -800_000_000,
        'hi_credit': 50_000,
        'lo_credit': -200_000,
    },
    'radar_stream': {
        'idle_slope': 20_000_000,    # 20 Mbps for 2 radars
        'send_slope': -980_000_000,
        'hi_credit': 5_000,
        'lo_credit': -20_000,
    },
    # Remaining ~580 Mbps for best-effort (diagnostics, telemetry, updates)
}
```

---

## 8. CAN-to-Ethernet Gateway Architecture

### 8.1 Gateway Design

During migration from CAN to TSN Ethernet, a gateway bridges the two domains:

```
┌────────────────────────────────────────────────────────┐
│                 CAN-TSN GATEWAY                         │
│                                                        │
│  TSN Ethernet Side              CAN Side               │
│  ┌──────────────┐              ┌──────────────┐       │
│  │ TSN MAC      │              │ CAN FD       │       │
│  │ + gPTP slave │              │ Controller   │       │
│  │ + TAS aware  │              │ (500kbps/    │       │
│  │              │              │  2-8 Mbps)   │       │
│  └──────┬───────┘              └──────┬───────┘       │
│         │                             │               │
│  ┌──────┴─────────────────────────────┴───────┐       │
│  │            Protocol Converter               │       │
│  │  CAN ID → Ethernet VLAN PCP mapping         │       │
│  │  CAN timestamp → gPTP timestamp alignment   │       │
│  │  CAN DLC → Ethernet payload encapsulation   │       │
│  │  Priority preservation across domains       │       │
│  └────────────────────────────────────────────┘       │
│                                                        │
│  CAN IDs 0x000-0x0FF → VLAN PCP 7 (Safety-Critical)  │
│  CAN IDs 0x100-0x1FF → VLAN PCP 5-6 (Time-Triggered) │
│  CAN IDs 0x200-0x3FF → VLAN PCP 3-4 (Rate-Constrained│
│  CAN IDs 0x400-0x7FF → VLAN PCP 0-2 (Best-Effort)    │
│                                                        │
│  Latency overhead: <50 μs (protocol conversion)       │
│  Jitter: <10 μs (bounded by TAS schedule)             │
└────────────────────────────────────────────────────────┘
```

### 8.2 Gateway Hardware Options

| Option | Vendor | CAN Ports | Ethernet | TSN Support | Price (est.) | Notes |
|---|---|---|---|---|---|---|
| S32G3 (GoldVIP) | NXP | 20 CAN FD | 4× 1GbE TSN | Full (AS, Qbv, CB) | $30-50 | Automotive SoC, ASIL D capable |
| TC4xx | Infineon/AURIX | 12 CAN FD | 2× 1GbE | Partial TSN | $20-40 | Strong safety heritage |
| R-Car S4 | Renesas | 16 CAN FD | 8× 1GbE TSN | Full | $40-60 | Gateway-focused SoC |
| Custom (Xilinx) | AMD/Xilinx | FPGA-based | FPGA-based | Configurable | $50-100 | Maximum flexibility |

**Recommendation for Aurrigo**: NXP S32G3 — best combination of CAN FD port count, TSN support, ASIL D capability, and automotive ecosystem support. The GoldVIP software platform provides pre-certified CAN-Ethernet gateway functionality.

### 8.3 Migration Phases

```
Phase 1: Gateway-bridged (Minimal change)
  
  [LiDAR] ──Eth──→ [Orin] ──CAN──→ [Actuators]
  [Camera] ──Eth──→        ──CAN──→ [Safety MCU]
                           ──CAN──→ [BMS]
  
  Change: None (status quo)
  TSN: Not yet

Phase 2: TSN backbone + CAN gateway
  
  [LiDAR] ──TSN──→ [TSN Switch] ←─TSN─→ [Orin]
  [Camera] ──TSN──→              ←─TSN─→ [CAN-TSN GW] ──CAN──→ [Actuators]
  [IMU] ──TSN──→                 ←─TSN─→ [Safety MCU]
  
  Change: Sensors moved to TSN, actuators still on CAN via gateway
  Benefit: Deterministic sensor delivery, unified timestamps

Phase 3: Full TSN (no CAN for new actuators)
  
  [LiDAR] ──TSN──→ [TSN Switch] ←─TSN─→ [Orin]
  [Camera] ──TSN──→              ←─TSN─→ [New actuators with TSN]
  [IMU] ──TSN──→                 ←─TSN─→ [Safety MCU (TSN)]
  [Radar] ──TSN──→               ←─TSN─→ [CAN GW] ──→ [Legacy only]
  
  Change: New actuators natively on TSN; CAN only for legacy
  Benefit: Full determinism sensor-to-actuator
```

---

## 9. 5G TSN Integration for V2X

### 9.1 3GPP 5G-TSN Bridge

3GPP Release 16+ defines 5G as a "TSN bridge" — making the 5G network appear as a standard TSN switch to endpoints:

```
┌──────────────────────────────────────────────────────────┐
│                  5G TSN BRIDGE (Logical View)             │
│                                                          │
│  Vehicle TSN     ┌──────────────────┐     Airport TSN    │
│  Domain          │    5G Network    │     Domain         │
│                  │  (appears as a   │                    │
│  [Orin] ──TSN──→ │  TSN bridge with │ ←─TSN── [Fleet    │
│                  │  known latency   │          Mgmt]     │
│  gPTP slave ←──→ │  gPTP relay      │ ←──→ gPTP GM      │
│                  │  TAS schedule    │                    │
│                  │                  │                    │
│                  │  5G-internal:    │                    │
│                  │  - URLLC slice   │                    │
│                  │  - QoS flow map  │                    │
│                  │  - Scheduling    │                    │
│                  └──────────────────┘                    │
└──────────────────────────────────────────────────────────┘
```

### 9.2 5G TSN for Airside V2X

| V2X Message Type | TSN Priority | 5G QoS | Max Latency | Bandwidth |
|---|---|---|---|---|
| Emergency vehicle priority (EVP) | SC (PCP 7) | URLLC | <10 ms | <1 Kbps |
| Runway incursion prevention (RIP) | SC (PCP 7) | URLLC | <10 ms | <1 Kbps |
| Jet blast warning (JBW) | SC (PCP 6) | URLLC | <20 ms | <10 Kbps |
| Cooperative perception | RC (PCP 4) | eMBB | <50 ms | ~160 Kbps |
| Fleet task assignment | TT (PCP 5) | URLLC | <100 ms | <10 Kbps |
| Telemetry/diagnostics | BE (PCP 1) | eMBB | Best-effort | ~1 Mbps |

### 9.3 End-to-End Determinism

With 5G TSN bridge, the entire path from vehicle sensor to fleet management has bounded latency:

```
End-to-end path: Vehicle LiDAR detection → Fleet emergency broadcast

  LiDAR scan    Orin detection    TSN in-vehicle    5G URLLC    Fleet broadcast
  ├─ 100 ms ──┤├── 15 ms ──────┤├── <1 ms ──────┤├─ <10 ms ─┤├── <1 ms ──┤
  
  Total worst-case: ~126 ms (dominated by LiDAR scan period, not networking)
  
  Network contribution: <12 ms out of 126 ms total
  
  With frame preemption and URLLC: network contribution drops to <5 ms
```

---

## 10. In-Vehicle Network Architecture for Aurrigo

### 10.1 Proposed TSN Architecture

```
┌──────────────────────────────────────────────────────────────┐
│           AURRIGO GSE — TSN NETWORK ARCHITECTURE             │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │ LiDAR ×6   │  │ Camera ×4  │  │ Radar ×2   │            │
│  │ (RoboSense)│  │ (GMSL2/    │  │ (Conti     │            │
│  │ 1GbE TSN   │  │  TSN)      │  │  ARS548)   │            │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘            │
│         │               │               │                    │
│  ┌──────┴───────────────┴───────────────┴──────┐            │
│  │           FRONT ZONE TSN SWITCH              │            │
│  │  (Marvell 88Q5050 / NXP SJA1110)            │            │
│  │  8-port 1GbE TSN, 802.1AS GM-capable        │            │
│  └──────────────────┬──────────────────────────┘            │
│                     │ 2.5GbE / 10GbE TSN uplink             │
│  ┌──────────────────┴──────────────────────────┐            │
│  │         CENTRAL TSN SWITCH                   │            │
│  │  (NXP SJA1110A / Marvell 88Q6113)           │            │
│  │  Grandmaster clock (GPS-disciplined)         │            │
│  │  12+ port 1GbE + 2× 10GbE TSN               │            │
│  └──┬──────┬──────┬──────┬──────┬──────────────┘            │
│     │      │      │      │      │                            │
│  ┌──┴──┐┌──┴──┐┌──┴──┐┌──┴──┐┌──┴──────────────┐           │
│  │Orin ││Orin ││Safety││CAN- ││ 5G/LTE Module   │           │
│  │ #1  ││ #2  ││ MCU  ││TSN  ││ (TSN bridge     │           │
│  │(GPU)││(GPU)││(STM) ││ GW  ││  for V2X)       │           │
│  └─────┘└─────┘└──────┘└──┬──┘└─────────────────┘           │
│                            │                                 │
│                     CAN Bus (legacy)                         │
│                     ┌──┬──┬──┬──┐                           │
│                     │St│Br│Dr│BM│                           │
│                     │ee│ak│iv│S │                           │
│                     │r │e │e │  │                           │
│                     └──┴──┴──┴──┘                           │
│  Legend:                                                     │
│  St=Steering, Br=Brake, Dr=Drive motor, BMS=Battery Mgmt   │
└──────────────────────────────────────────────────────────────┘
```

### 10.2 Switch Selection

| Switch | Vendor | Ports | TSN Features | ASIL | Price | Notes |
|---|---|---|---|---|---|---|
| SJA1110A | NXP | 10× 100M + 1× 1G | Full TSN (AS, Qbv, CB, Qci) | ASIL B | $15-25 | Best automotive TSN ecosystem |
| 88Q5050 | Marvell | 8× 1G | Full TSN | QM (ASIL B capable) | $20-30 | Higher bandwidth per port |
| 88Q6113 | Marvell | 11× 1G + 2× 2.5G/10G | Full TSN + MACsec | ASIL B | $30-50 | Premium, highest bandwidth |
| KSZ9897 | Microchip | 7× 1G | Partial TSN (AS, Qbv) | QM | $8-12 | Low cost, limited features |

**Recommendation**: NXP SJA1110A for zone switches (cost-effective, ASIL B), Marvell 88Q6113 for central switch (high bandwidth, MACsec for security).

### 10.3 Orin TSN Support

NVIDIA Orin AGX includes TSN-capable Ethernet:
- 1× 10GbE MGBE (Multi-Gigabit Ethernet) with hardware timestamping
- 4× 1GbE EQOS with IEEE 802.1AS, 802.1Qbv, 802.1Qav support
- Linux kernel TSN support via `tc` TAPRIO and ETF qdiscs
- PTP hardware clock (`/dev/ptp0`) for gPTP synchronization

```bash
# Verify Orin TSN capabilities
$ ethtool -T eth0
Time stamping parameters for eth0:
Capabilities:
        hardware-transmit     (SOF_TIMESTAMPING_TX_HARDWARE)
        hardware-receive      (SOF_TIMESTAMPING_RX_HARDWARE)
        hardware-raw-clock    (SOF_TIMESTAMPING_RAW_HARDWARE)
PTP Hardware Clock: 0
Hardware Transmit Timestamp Modes:
        off                   (HWTSTAMP_TX_OFF)
        on                    (HWTSTAMP_TX_ON)
Hardware Receive Filter Modes:
        ptpv2-event           (HWTSTAMP_FILTER_PTP_V2_EVENT)
```

---

## 11. Functional Safety and TSN

### 11.1 TSN Safety Standards

| Standard | Scope | Relevance |
|---|---|---|
| **IEC 61784-3** (PROFIsafe, CIP Safety) | Functional safety over industrial Ethernet | Safety protocol patterns applicable to TSN |
| **IEC 62443** | Industrial cybersecurity | Network security for TSN infrastructure |
| **ISO 26262** Part 11 | Semiconductor functional safety | TSN switch silicon qualification |
| **ISO 21111-1** (draft) | Automotive Ethernet safety | Direct applicability to in-vehicle TSN |

### 11.2 Safety Communication over TSN

TSN provides mechanisms but does not itself guarantee functional safety. A safety communication layer is needed:

```
┌──────────────────────────────────────────────────┐
│         SAFETY COMMUNICATION STACK                │
│                                                   │
│  ┌────────────────────────────────────────────┐  │
│  │ Safety Application Layer                    │  │
│  │ (E-stop command, brake request, heartbeat)  │  │
│  ├────────────────────────────────────────────┤  │
│  │ Safety Protocol (Black Channel)             │  │
│  │ - Sequence number (detect loss/repetition)  │  │
│  │ - Timestamp (detect delay)                  │  │
│  │ - CRC-32 (detect corruption)                │  │
│  │ - Source/Destination ID (detect masquerade)  │  │
│  │ - Watchdog timeout                          │  │
│  ├────────────────────────────────────────────┤  │
│  │ TSN Transport (treated as "black channel")  │  │
│  │ - 802.1CB FRER (frame redundancy)           │  │
│  │ - 802.1Qbv TAS (deterministic delivery)     │  │
│  │ - 802.1Qci PSFP (stream policing)           │  │
│  ├────────────────────────────────────────────┤  │
│  │ Ethernet Physical Layer                     │  │
│  │ (1000BASE-T1 automotive)                    │  │
│  └────────────────────────────────────────────┘  │
│                                                   │
│  "Black channel" principle (IEC 61508):           │
│  Safety does NOT depend on network correctness.   │
│  Safety protocol detects all failure modes.       │
│  TSN provides performance, not safety.            │
└──────────────────────────────────────────────────┘
```

### 11.3 FRER (Frame Replication and Elimination) for Safety

IEEE 802.1CB provides redundant paths for safety-critical messages:

```
Safety MCU sends E-stop:

  Path A (primary):
  [Safety MCU] ──→ [Switch A] ──→ [Brake ECU]
  
  Path B (redundant):
  [Safety MCU] ──→ [Switch B] ──→ [Brake ECU]
  
  Brake ECU receives TWO copies, eliminates duplicate.
  If Path A fails: Path B delivers within same timing window.
  If both fail: Safety protocol watchdog detects and triggers safe state.
  
  Fault tolerance: Survives single switch failure, single link failure,
                   or single path corruption.
```

### 11.4 TSN for ASIL Decomposition

TSN enables cleaner ASIL decomposition (see fail-operational-architecture.md):

| Without TSN | With TSN |
|---|---|
| Safety and non-safety on separate CAN buses | Safety and non-safety on same TSN network, isolated by PSFP + TAS |
| No latency guarantee → must assume worst-case | Provable worst-case latency → tighter safety timing analysis |
| Redundancy requires duplicate CAN buses | FRER provides redundancy within TSN |
| Safety certification must analyze each CAN bus | One TSN network with certified isolation |

---

## 12. Production Deployments and Case Studies

### 12.1 Automotive TSN Deployments (2025)

| Vehicle | OEM | TSN Standard | Network Speed | Application | Since |
|---|---|---|---|---|---|
| BMW iX | BMW | 802.1AS + Qbv | 100M/1G mixed | ADAS sensor backbone | 2022 |
| Mercedes S-Class | Mercedes | 802.1AS + Qbv | 1 GbE | Drive Pilot L3 networking | 2022 |
| Volvo EX90 | Volvo | Full TSN | 1 GbE + 10 GbE | Luminar LiDAR + compute | 2024 |
| Zeekr 001 (updated) | Geely | 802.1AS | 1 GbE | ADAS domain controller | 2024 |

### 12.2 Commercial Vehicle TSN Pilots

| Company | Application | TSN Features | Status |
|---|---|---|---|
| Daimler Truck | L4 autonomous trucking | Full TSN backbone | Production 2026-2027 |
| Volvo Trucks | Highway pilot | TSN + CAN FD bridge | Pilot 2025 |
| Scania | Platooning V2V | TSN + 5G bridge | Research 2024 |
| NAVYA (now dissolved) | Autonomous shuttle | TSN evaluation | Discontinued |

### 12.3 Industrial TSN Deployments (Relevant Parallels)

| Application | Industry | TSN Use Case | Lessons for Airside |
|---|---|---|---|
| Profinet over TSN | Factory automation | Real-time robot control + IT traffic on one network | Mixed-criticality scheduling proven at scale |
| OPC UA over TSN | Process control | Deterministic pub/sub for sensor data | Sensor data delivery pattern directly applicable |
| EtherCAT over TSN | Motion control | Sub-μs synchronization of multiple axes | Multi-actuator synchronization for steering+drive |
| CC-Link IE TSN | Semiconductor fab | High-bandwidth + deterministic | Clean-room environment parallels (contamination-free) |

### 12.4 Lessons Learned

1. **Start with gPTP (802.1AS)**: Time synchronization provides immediate value even without TAS scheduling. Improved sensor fusion accuracy is measurable on day one.

2. **TAS configuration is complex**: Gate Control List design requires careful analysis of all traffic flows. Incorrect GCL causes network failure, not graceful degradation. Use automated GCL solvers.

3. **CAN gateway latency is manageable**: NXP SJA1110 CAN-TSN gateway adds <50 μs, well within requirements. Gateway is not the bottleneck.

4. **Switch silicon matters**: Not all "TSN-capable" switches implement all standards. Verify 802.1Qbv hardware offload — software TAS adds 10-100x latency.

5. **Testing requires TSN-aware tools**: Standard network analyzers don't understand TSN timing. Need tools like Spirent TestCenter or Anritsu MT1000A for TSN validation.

---

## 13. Implementation Roadmap

### 13.1 Phased Implementation

| Phase | Duration | Cost | Deliverable |
|---|---|---|---|
| **Phase 1: gPTP time sync** | 4 weeks | $8-12K | All sensors synchronized via gPTP, improved GTSAM fusion |
| **Phase 2: TSN backbone** | 8 weeks | $15-25K | TSN switches installed, TAS configured, deterministic sensor delivery |
| **Phase 3: CAN-TSN gateway** | 6 weeks | $10-18K | Actuator commands via TSN→CAN gateway, safety protocol layer |
| **Phase 4: FRER redundancy** | 4 weeks | $8-12K | Dual-path safety communication, single-fault tolerance |
| **Phase 5: 5G TSN bridge** | 6 weeks | $12-20K | V2X communication with deterministic QoS |
| **Total** | **28 weeks** | **$53-87K** | Full TSN-enabled autonomous GSE |

### 13.2 Hardware BOM (Per Vehicle)

| Component | Quantity | Unit Cost | Total |
|---|---|---|---|
| Central TSN switch (Marvell 88Q6113) | 1 | $30-50 | $30-50 |
| Zone TSN switch (NXP SJA1110A) | 2 | $15-25 | $30-50 |
| CAN-TSN gateway (NXP S32G3 module) | 1 | $40-60 | $40-60 |
| TSN-capable 1GbE PHY (Marvell 88Q2112) | 6-10 | $5-8 | $30-80 |
| GPS-disciplined oscillator (gPTP GM) | 1 | $50-100 | $50-100 |
| Automotive Ethernet cable + connectors | Set | $50-100 | $50-100 |
| **Total hardware per vehicle** | | | **$230-440** |

### 13.3 Risk Analysis

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| LiDAR drivers don't support TSN timestamping | Medium | Medium | Use PTP/PPS fallback, request vendor support |
| GCL misconfiguration causes network failure | Medium | High | Extensive simulation with OMNEST/OMNeT++, conservative schedules |
| CAN actuators require hardware upgrade for TSN | Low | High | CAN-TSN gateway bridges indefinitely; new actuators with TSN |
| TSN switch silicon errata | Low | Medium | Use proven automotive-grade silicon (NXP, Marvell) |
| 5G TSN bridge latency too variable | Medium | Low | 5G bridge is Phase 5; in-vehicle TSN independent |

---

## 14. Key Takeaways

1. **TSN reduces safety-critical message latency 50-200x** — E-stop delivery drops from ~0.5-2 ms (CAN) to <10 μs (TSN with frame preemption)

2. **gPTP provides <100 ns sensor synchronization** — eliminates software timestamp jitter (1-10 ms) that causes mm-level fusion errors at airside speeds

3. **Mixed-criticality on one network** — safety, control, sensors, and diagnostics share a single TSN Ethernet backbone with guaranteed isolation via TAS and PSFP

4. **CAN gateway enables incremental migration** — existing CAN actuators continue working via CAN-TSN gateway ($40-60). No big-bang replacement needed

5. **Orin natively supports TSN** — hardware timestamping, gPTP, and TAPRIO qdisc available on Orin's Ethernet ports. No additional hardware for compute side

6. **BMW, Mercedes, Volvo already in production** — TSN is not experimental. Automotive-grade silicon (NXP SJA1110, Marvell 88Q6113) is available and proven

7. **5G TSN bridge extends determinism to V2X** — 3GPP Release 16+ makes 5G network appear as TSN switch, enabling deterministic fleet communication

8. **Hardware cost is minimal**: $230-440 per vehicle — negligible compared to compute ($1,000-2,000) or LiDAR ($6,000-24,000) costs

9. **FRER provides safety communication redundancy** — dual-path frame delivery survives single switch/link failure, complementing black-channel safety protocol

10. **Certification benefit**: Provable worst-case latency via TSN formal analysis (network calculus) supports ISO 3691-4 and IEC 61508 safety cases — eliminates need for conservative "assume worst case" timing margins

---

## 15. References

### Standards
1. IEEE 802.1AS-2020, "Timing and Synchronization for Time-Sensitive Applications (gPTP)"
2. IEEE 802.1Q-2022, "Bridges and Bridged Networks" (includes Qbv TAS, Qav CBS, Qci PSFP amendments)
3. IEEE 802.1CB-2017, "Frame Replication and Elimination for Reliability (FRER)"
4. IEEE 802.3br-2016, "Interspersing Express Traffic"
5. IEC 61508, "Functional Safety of Electrical/Electronic/Programmable Electronic Safety-Related Systems"
6. ISO 26262, "Road vehicles — Functional safety"
7. 3GPP TS 23.501 (Release 16), "5G System Architecture — TSN Integration"

### Papers
8. Craciunas, S. et al., "Real-Time Scheduling for 802.1Qbv Time-Sensitive Networking (TSN): A Systematic Review and Experimental Study," *IEEE RTSS*, 2024
9. Park, T. and Samii, S., "Time-Sensitive Networking in automotive embedded systems: State of the art and research opportunities," *Journal of Systems Architecture*, 2021
10. Tamas-Selicean, D. et al., "A Survey on Time-Sensitive Networking Standards and Applications for Intelligent Driving," *Processes*, 2023
11. NXP Semiconductors, "Architecting Network Latencies for Mixed Criticality In-Vehicle Networks using IEEE 802.1Qbv," White Paper, 2023

### Product Documentation
12. NXP, "SJA1110A — Automotive TSN Ethernet Switch," Product Brief, 2024
13. Marvell, "88Q6113 — Automotive Ethernet Switch with TSN and MACsec," Product Brief, 2024
14. NVIDIA, "Jetson AGX Orin — Ethernet and TSN Configuration Guide," Developer Documentation, 2024
15. Excelfore, "Automotive Ethernet TSN for ADAS and Autonomous Driving," Technical Guide, 2025

### Market Analysis
16. Research and Markets, "Time-Sensitive Networking (TSN) Time Aware Shaper Market Report 2026"
17. Dataintelo, "Automotive Ethernet Time-Sensitive Networking Market Research Report 2034"

### Related Repository Documents
- `20-av-platform/networking-connectivity/airport-5g-cbrs.md` — Airport 5G infrastructure (TSN bridge endpoint)
- `operations/safety/fail-operational-architecture.md` — Fail-operational architecture (TSN enables ASIL decomposition)
- `operations/safety/cybersecurity-airside-av.md` — Cybersecurity (MACsec over TSN)
- `30-autonomy-stack/multi-agent-v2x/v2x-protocols-airside.md` — V2X protocols (transported over 5G TSN bridge)
- `20-av-platform/sensors/multi-lidar-calibration.md` — Multi-LiDAR calibration (gPTP synchronization)
- `hardware/vehicle/can-bus-drive-by-wire.md` — Current CAN architecture (migration source)
