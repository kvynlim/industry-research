# CAN Bus Communication and Drive-by-Wire Interfaces for Autonomous Vehicles

Deep technical reference covering CAN bus fundamentals, drive-by-wire architecture, Aurrigo vehicle interfaces, the ADT3 steering chain, safety mechanisms, SocketCAN, ROS integration, control strategies, functional safety, and testing tools.

---

## 1. CAN Bus Fundamentals

### 1.1 What CAN Is

Controller Area Network (CAN) is a serial communication protocol developed by Robert Bosch GmbH in 1986, standardized as ISO 11898. It was designed for reliable, real-time communication between microcontrollers and devices in vehicles without a host computer. CAN is message-oriented (not address-oriented): every node sees every message, and each node decides whether to process it based on the message identifier.

CAN is the backbone of nearly every modern vehicle's internal communication. In autonomous vehicles, CAN serves as the primary interface between the autonomous driving system (ADS) and the vehicle's physical actuators and sensors.

### 1.2 Differential Signaling

CAN uses a two-wire differential signaling scheme over a twisted pair (CAN_H and CAN_L). This provides high immunity to electromagnetic interference (EMI) because noise affects both wires equally and is rejected by the differential receiver.

**Bus states:**

| State | CAN_H | CAN_L | Differential (CAN_H - CAN_L) | Logic |
|-------|-------|-------|-------------------------------|-------|
| **Dominant** (0) | ~3.5V | ~1.5V | ~2.0V | Asserted |
| **Recessive** (1) | ~2.5V | ~2.5V | ~0.0V | Default |

- A dominant bit (0) overwrites a recessive bit (1) on the bus -- this is the foundation of CAN's arbitration mechanism.
- When no node is transmitting, the bus rests in the recessive state, pulled by passive 120-ohm termination resistors at each end of the bus.
- The wired-AND nature means that if any node drives dominant, the bus is dominant regardless of what other nodes are doing.

**Bus termination:**

Each end of the CAN bus must be terminated with a 120-ohm resistor between CAN_H and CAN_L. Without proper termination, signal reflections corrupt data. A correctly terminated bus measures approximately 60 ohms between CAN_H and CAN_L (two 120-ohm resistors in parallel).

### 1.3 Bit Timing and Baud Rates

A single CAN bit is divided into four segments, measured in time quanta (tq):

1. **Sync Segment (SYNC_SEG):** 1 tq. Used to synchronize nodes on the bus edge.
2. **Propagation Segment (PROP_SEG):** 1-8 tq. Compensates for physical signal propagation delay.
3. **Phase Segment 1 (PHASE_SEG1):** 1-8 tq. Can be lengthened by resynchronization.
4. **Phase Segment 2 (PHASE_SEG2):** 1-8 tq. Can be shortened by resynchronization.

**Sample point:** The point between PHASE_SEG1 and PHASE_SEG2 where the bus level is read. Typically set at 75-87.5% of the bit time for robust reception.

**Synchronization Jump Width (SJW):** The maximum number of tq that the sample point can be shifted during resynchronization to compensate for clock drift between nodes. Typically 1-4 tq.

**Prescaler (BRP):** Derives the time quantum from the system clock: `tq = BRP / f_sys`.

**Baud rate vs. cable length:**

| Baud Rate | Max Cable Length |
|-----------|-----------------|
| 1 Mbit/s | ~40 m |
| 500 kbit/s | ~100 m |
| 250 kbit/s | ~250 m |
| 125 kbit/s | ~500 m |

For airside autonomous vehicles operating on airport aprons, cable runs within a single vehicle are typically under 10 meters, so 250 kbit/s to 1 Mbit/s is practical.

### 1.4 Arbitration

CAN uses non-destructive, bitwise arbitration based on message identifier priority. When multiple nodes begin transmitting simultaneously:

1. Each node transmits its message identifier bit by bit, MSB first.
2. After transmitting a recessive (1) bit, the node monitors the bus. If the bus reads dominant (0), the node knows a higher-priority message is being sent and immediately stops transmitting.
3. The node with the lowest numerical ID wins arbitration and continues transmitting. The losing nodes retry after the current message completes.

This mechanism guarantees that the highest-priority message always gets through without collision damage -- a critical property for real-time vehicle control.

**Priority assignment guidelines for autonomous vehicles:**

| Priority Range (11-bit ID) | Typical Use |
|---------------------------|-------------|
| 0x000 - 0x0FF | Safety-critical: E-stop, heartbeat, emergency brake |
| 0x100 - 0x1FF | Vehicle control: steering commands, velocity commands |
| 0x180 - 0x2FF | Actuator feedback: steering angle, wheel speed |
| 0x300 - 0x4FF | Sensor data: IMU, encoder counts |
| 0x500 - 0x7FF | Diagnostics, configuration, low-priority status |

### 1.5 CAN 2.0 Frame Format

CAN 2.0 defines two frame formats:

- **CAN 2.0A (Standard):** 11-bit identifier
- **CAN 2.0B (Extended):** 29-bit identifier

**Standard Data Frame (CAN 2.0A):**

```
| SOF | Arbitration Field | Control | Data Field | CRC Field | ACK | EOF | IFS |
| 1b  | 11b ID + RTR      | 6b      | 0-64 bits  | 15b + del  | 2b  | 7b  | 3b  |
```

Field breakdown:

| Field | Bits | Description |
|-------|------|-------------|
| **SOF** | 1 | Start of Frame -- single dominant bit; triggers synchronization |
| **Identifier** | 11 | Message ID; determines priority (lower = higher priority) |
| **RTR** | 1 | Remote Transmission Request: 0 = data frame, 1 = remote frame |
| **IDE** | 1 | Identifier Extension: 0 = standard (11-bit), 1 = extended (29-bit) |
| **r0** | 1 | Reserved bit (dominant) |
| **DLC** | 4 | Data Length Code: number of data bytes (0-8) |
| **Data** | 0-64 | Payload: 0 to 8 bytes of data |
| **CRC** | 15 | Cyclic Redundancy Check over SOF through data field |
| **CRC Delimiter** | 1 | Recessive bit following CRC |
| **ACK Slot** | 1 | Transmitter sends recessive; receivers overwrite with dominant to acknowledge |
| **ACK Delimiter** | 1 | Recessive bit |
| **EOF** | 7 | End of Frame: 7 recessive bits |
| **IFS** | 3 | Inter-Frame Space: 3 recessive bits minimum gap |

**Bit stuffing:** After 5 consecutive identical bits in the SOF-through-CRC region, the transmitter inserts a complementary stuff bit. This ensures sufficient edges for clock synchronization. The receiver removes stuff bits automatically.

**CAN Frame Types:**

1. **Data Frame:** Carries data from transmitter to receivers (most common).
2. **Remote Frame:** Request for data (RTR = 1, no data payload). Rarely used in practice.
3. **Error Frame:** Generated by any node detecting an error. Contains 6 dominant bits (active error flag) or 6 recessive bits (passive error flag) followed by 8 recessive bits (error delimiter).
4. **Overload Frame:** Provides extra delay between data/remote frames. Almost never encountered.

### 1.6 CAN FD (Flexible Data Rate)

CAN FD was developed by Bosch and standardized in ISO 11898-1:2015. It extends classical CAN with two key improvements:

1. **Larger payload:** Up to 64 bytes per frame (vs. 8 bytes for CAN 2.0)
2. **Higher data bit rate:** Up to 8 Mbit/s in the data phase (vs. 1 Mbit/s for CAN 2.0)

**CAN FD-specific control bits:**

| Bit | Name | Description |
|-----|------|-------------|
| **FDF** (formerly EDL) | Flexible Data-rate Format | Recessive = CAN FD frame; dominant = classical CAN. Replaces the reserved bit r0. |
| **BRS** | Bit Rate Switch | Dominant = same bit rate throughout; Recessive = higher bit rate for data phase |
| **ESI** | Error State Indicator | Dominant = error active; Recessive = error passive |

**CAN FD DLC encoding for payloads > 8 bytes:**

| DLC (binary) | Data Bytes |
|--------------|------------|
| 0000-1000 | 0-8 (same as CAN 2.0) |
| 1001 | 12 |
| 1010 | 16 |
| 1011 | 20 |
| 1100 | 24 |
| 1101 | 32 |
| 1110 | 48 |
| 1111 | 64 |

**CAN FD CRC:** The CRC is longer than CAN 2.0 -- 17 bits for payloads up to 16 bytes, 21 bits for payloads of 20-64 bytes. CAN FD also adds a 4-bit stuff count field before the CRC for additional error detection.

**CAN FD dual bit rate:** After arbitration completes (at the nominal bit rate), the BRS bit triggers a switch to the higher data bit rate for the remainder of the data phase. The CRC delimiter marks the return to the nominal bit rate.

**Backward compatibility:** CAN FD controllers can coexist on the same physical bus as CAN 2.0 controllers, but CAN 2.0 controllers will generate error frames when they encounter CAN FD frames. A mixed-mode bus requires CAN FD controllers configured to transmit classical frames only, or separate bus segments.

**When to use CAN FD for autonomous vehicles:**

- Large sensor payloads (IMU data, multi-axis encoder data) that exceed 8 bytes
- Higher throughput requirements for multi-actuator systems
- Reducing bus load by packing more data per frame
- Modern ECUs and motor controllers increasingly support CAN FD natively

### 1.7 Error Handling and Fault Confinement

CAN implements five error detection mechanisms:

1. **Bit Error:** Transmitter monitors the bus and detects if the transmitted bit differs from the bus level (except during arbitration and ACK slot).
2. **Stuff Error:** More than 5 consecutive bits of the same polarity detected in the stuffed region.
3. **CRC Error:** Computed CRC does not match the received CRC.
4. **Form Error:** A fixed-format bit field (delimiter, EOF, IFS) contains an illegal bit.
5. **ACK Error:** Transmitter does not see a dominant bit in the ACK slot.

**Error counters and state transitions:**

Each node maintains two counters:
- **TEC (Transmit Error Counter):** Increments by 8 on transmit error; decrements by 1 on successful transmit.
- **REC (Receive Error Counter):** Increments by 1 on receive error; decrements by 1 on successful receive.

| State | Condition | Behavior |
|-------|-----------|----------|
| **Error Active** | TEC <= 127 AND REC <= 127 | Transmits active error flags (6 dominant bits); full participation |
| **Error Passive** | TEC > 127 OR REC > 127 | Transmits passive error flags (6 recessive bits); must wait extra 8 bits after transmitting |
| **Bus-Off** | TEC >= 256 | Node disconnects from bus; no transmission or reception |

**Bus-off recovery:** Requires re-initialization of the CAN controller. After re-initialization, the node must observe 128 occurrences of 11 consecutive recessive bits (1,408 bit times) before resuming communication. Both error counters reset to 0 after bus-off recovery.

For autonomous vehicles, a node going bus-off is a critical safety event -- the ADS must detect this condition and transition to a safe state.

---

## 2. Drive-by-Wire Architecture

### 2.1 Concept

Drive-by-wire (DBW) replaces mechanical linkages between driver inputs (steering wheel, pedals) and vehicle actuators (steering rack, brakes, throttle) with electronic control systems. In an autonomous vehicle, the "driver" is software -- the ADS sends electronic commands over CAN (or similar) to actuators that control the vehicle's motion.

A DBW system consists of three subsystems:

1. **Steer-by-Wire (SbW):** Electronic control of steering angle via electric or electrohydraulic actuators
2. **Throttle-by-Wire (TbW):** Electronic control of drive motor speed/torque
3. **Brake-by-Wire (BbW):** Electronic control of braking force via electromechanical or electrohydraulic actuators

### 2.2 System Architecture

A typical DBW architecture for an autonomous vehicle:

```
+------------------+
|  ADS Computer    |  (Autonomous Driving System)
|  (ROS2 / Custom) |
+--------+---------+
         |
         | CAN Bus (or Ethernet + CAN gateway)
         |
    +----+----+----+----+
    |         |         |
+---+---+ +---+---+ +---+---+
|Steer  | |Drive  | |Brake  |
|ECU    | |ECU    | |ECU    |
+---+---+ +---+---+ +---+---+
    |         |         |
  Actuator  Motor    Brake
  (EPS/     Ctrl     Caliper
   Orbital) (VFD)    (EMB)
```

**Key interfaces:**

- **ADS to Vehicle (Command):** Steering angle setpoint, velocity setpoint, brake pressure/deceleration setpoint, gear selection
- **Vehicle to ADS (Feedback):** Actual steering angle, actual velocity, wheel speeds, motor current, brake pressure, system status, fault codes

### 2.3 Commercial DBW Systems

Several commercial DBW kits exist for autonomous vehicle development:

| System | Manufacturer | Vehicle Platform | Interface | Approx. Cost |
|--------|-------------|-----------------|-----------|-------------|
| **ADAS By-Wire Kit** | Dataspeed Inc. | Lincoln MKZ, Ford Fusion, Chrysler Pacifica | CAN + ROS | ~$45,000 |
| **PACMod** | AutonomouStuff | Multiple platforms | CAN + ROS | ~$150,000+ |
| **NX NextMotion** | Arnold NextG | OEM-agnostic | CAN, ISO 26262 ASIL D | Custom |
| **Sygnal** | Level Five Supplies | Multiple | CAN, safety-critical | Custom |
| **PIX Moving PIXKIT** | PIX Moving | Purpose-built chassis | CAN + ROS2/Autoware | ~$30,000 |
| **New Eagle DBW Kit** | New Eagle | Multiple | CAN + ROS | Custom |

For purpose-built vehicles like the Aurrigo Auto-DollyTug, the DBW system is designed in-house as an integral part of the vehicle architecture rather than retrofitted.

### 2.4 DBW Control Loop

The fundamental control loop for a single DBW axis (e.g., steering):

```
Setpoint (desired angle)
    |
    v
+--------+     +--------+     +----------+     +--------+
| PID    | --> | DAC /  | --> | Motor /  | --> | Plant  |
| Control|     | PWM    |     | Actuator |     | (Vehicle)|
+--------+     +--------+     +----------+     +--------+
    ^                                               |
    |           +----------+                        |
    +-----------| Feedback |<-----------------------+
                | Sensor   |
                +----------+
```

Each DBW axis runs its own closed-loop controller at 50-1000 Hz, depending on the actuator dynamics. The ADS sends setpoints at 10-100 Hz over CAN, and the local ECU interpolates and executes the inner control loop at higher frequency.

---

## 3. Aurrigo Vehicle Interface

### 3.1 Aurrigo Platform Overview

Aurrigo International designs and manufactures purpose-built autonomous ground support equipment (GSE) for airport airside operations. Their product line includes:

- **Auto-DollyTug (ADT):** Autonomous baggage/ULD transport vehicle, now in 3rd generation. 4-wheel steering, 360-degree tank turn, sideways drive capability. All-electric, 88V lithium-ion powertrain.
- **Auto-Cargo:** Heavy cargo transport, twin 18.4 kW motors, 4-wheel steering, 4,500 kg onboard payload, 25 km/h max speed.
- **Auto-Shuttle:** Autonomous passenger/crew transport (Ford E-Transit chassis, Level 4 autonomy).

The autonomous driving software is **Auto-Stack**, a proprietary in-house system controlling steering, braking, drive power, sensor fusion, mapping, localization, and navigation.

### 3.2 CAN Bus Interface Architecture (Inferred)

Based on the vehicle architecture of purpose-built autonomous GSE platforms like the Aurrigo vehicles, the CAN interface between the ADS and vehicle follows a dual-message paradigm:

**ADS-to-Vehicle Messages (AdsToAv / AvCommand):**

These messages carry commands from the autonomous driving system to the vehicle platform:

| Signal | Type | Range | Resolution | Description |
|--------|------|-------|------------|-------------|
| Steering Angle Setpoint | int16 | -180 to +180 deg | 0.1 deg | Desired steering angle (positive = right convention varies) |
| Velocity Setpoint | uint16 | 0 to max speed | 0.01 m/s or 0.1 km/h | Desired forward velocity |
| Brake Command | uint8 | 0-100% | 1% | Brake request as percentage of max braking |
| Gear Request | uint8 | enum | -- | Forward / Reverse / Neutral / Park |
| Control Mode | uint8 | enum | -- | Manual / Autonomous / E-Stop |
| Heartbeat Counter | uint8 | 0-255 | 1 | Rolling counter for watchdog |
| Checksum | uint8 | -- | -- | Message integrity check |

**Vehicle-to-ADS Messages (AvToAds / AvState):**

These messages carry vehicle state feedback to the ADS:

| Signal | Type | Range | Resolution | Description |
|--------|------|-------|------------|-------------|
| Actual Steering Angle | int16 | -180 to +180 deg | 0.1 deg | Measured steering position |
| Actual Velocity | uint16 | 0 to max speed | 0.01 m/s | Measured vehicle speed |
| Wheel Speed (per wheel) | uint16 | 0 to max | 0.01 m/s | Individual wheel encoder speeds |
| Motor Current | uint16 | 0 to max | 0.1 A | Drive motor current draw |
| Battery Voltage | uint16 | 0 to max | 0.1 V | Pack voltage |
| Battery SOC | uint8 | 0-100% | 1% | State of charge |
| System Status | uint8 | bitmask | -- | Fault flags, ready state, mode confirmation |
| Steering Status | uint8 | enum | -- | Steering actuator health |
| Heartbeat Echo | uint8 | 0-255 | 1 | Echoes received heartbeat for watchdog validation |
| Checksum | uint8 | -- | -- | Message integrity check |

### 3.3 Steering Conversion

For vehicles with 4-wheel steering (like the Auto-DollyTug), steering angle conversion is more complex than standard Ackermann geometry. The ADS specifies a desired path curvature or steering angle, and the vehicle ECU converts this into individual wheel angles.

**Steering angle to CAN signal conversion:**

```
CAN_raw = (steering_angle_deg - offset) / scale_factor

Example:
  Physical range: -40.0 to +40.0 degrees
  Offset: 0
  Scale: 0.1 deg/bit
  CAN raw value: steering_angle_deg / 0.1

  For +25.3 degrees: CAN_raw = 253 (0x00FD)
  For -25.3 degrees: CAN_raw = -253 (0xFF03 in two's complement, int16)
```

For an orbital-valve-based hydraulic steering system, the conversion chain is:

```
ADS steering command (degrees)
  --> CAN message to steering ECU
    --> Steering ECU converts to motor controller position command
      --> Motor controller (e.g., Roboteq) drives DC motor
        --> Motor rotates orbital valve input shaft
          --> Orbital valve meters hydraulic fluid to steering cylinder(s)
            --> Steering cylinder(s) rotate wheel(s)
              --> Position feedback sensor reports actual angle
```

### 3.4 Velocity Conversion

**Velocity setpoint to CAN signal conversion:**

```
CAN_raw = velocity_mps / scale_factor

Example:
  Physical range: 0 to 25.0 km/h (6.94 m/s)
  Scale: 0.01 m/s per bit
  CAN raw value: velocity_mps / 0.01

  For 2.5 m/s (9 km/h): CAN_raw = 250 (0x00FA)
```

**Velocity to motor RPM conversion:**

```
motor_rpm = (velocity_mps * gear_ratio * 60) / (pi * wheel_diameter)

Example for a typical GSE vehicle:
  Wheel diameter: 0.4 m
  Gear ratio: 20:1
  For 2.5 m/s:
    motor_rpm = (2.5 * 20 * 60) / (pi * 0.4) = 2387 RPM
```

The velocity controller typically runs as a cascaded loop: the outer loop (ADS) sets velocity, the mid-level controller (vehicle ECU) computes required motor RPM, and the inner loop (motor controller) regulates motor current to achieve the commanded RPM.

---

## 4. ADT3 Steering Chain

### 4.1 Architecture Overview

The ADT3 (Auto-DollyTug 3rd generation) uses an electrohydraulic steering system. The steering chain from the ADS command to wheel movement:

```
Auto-Stack ADS
    | CAN command (steering angle setpoint)
    v
Vehicle Control ECU
    | Position command (CANopen or serial)
    v
Roboteq Motor Controller (e.g., MDC1460/MDC2460)
    | PWM drive signal
    v
DC Motor (coupled to orbital valve input shaft)
    | Mechanical rotation
    v
Orbital Hydraulic Steering Valve (e.g., Danfoss/Eaton type)
    | Metered hydraulic flow (proportional to input rotation)
    v
Hydraulic Steering Cylinder(s)
    | Linear force on steering linkage
    v
Wheel Pivot / Steering Knuckle
    | Wheel angle change
    v
Position Feedback Sensor (potentiometer / encoder)
    | Analog or digital feedback
    v
Vehicle Control ECU (closes the loop)
```

### 4.2 Roboteq MDC1460 Motor Controller

The Roboteq MDC1460 is a single-channel brushed DC motor controller used in various autonomous vehicle applications for steering actuation.

**Key specifications:**

| Parameter | Value |
|-----------|-------|
| Channels | 1 |
| Continuous current | 70A |
| Peak current | 120A (30s) |
| Voltage range | 7-60V |
| Communication | USB, RS232, optional CAN |
| Encoder inputs | Quadrature encoder |
| Analog inputs | Up to 4 |
| Digital inputs | Up to 6 |
| Digital outputs | Up to 2 |
| Pulse inputs | Up to 5 |
| Operating modes | Open loop, Closed-loop Speed, Closed-loop Position (relative, absolute, tracking) |
| Dimensions | 120 x 133 x 25 mm |
| Weight | 380g |

**CAN bus networking (on CAN-equipped models):**

- Up to 127 controllers on a single twisted pair at up to 1 Mbit/s
- Supports CANopen (DS402 drive profile)
- Supports RoboCAN (Roboteq proprietary protocol)
- Supports RawCAN (direct CAN frame send/receive)

**CANopen DS402 Object Dictionary (key entries for steering):**

| Index | Sub | Name | Access | Description |
|-------|-----|------|--------|-------------|
| 0x6040 | 0 | Controlword | RW | State machine control (enable, disable, fault reset) |
| 0x6041 | 0 | Statusword | RO | State machine status (ready, switched on, fault) |
| 0x6060 | 0 | Modes of Operation | RW | Select mode: 1=Profile Position, 3=Profile Velocity |
| 0x6061 | 0 | Modes of Operation Display | RO | Currently active mode |
| 0x607A | 0 | Target Position | RW | Target position for Profile Position mode |
| 0x6081 | 0 | Profile Velocity | RW | Velocity for position profiling |
| 0x60FF | 0 | Target Velocity | RW | Target velocity for Profile Velocity mode |
| 0x6064 | 0 | Position Actual Value | RO | Current position from encoder |
| 0x606C | 0 | Velocity Actual Value | RO | Current velocity |
| 0x2000 | 1 | Motor Command ch1 | RW | Direct motor command (Roboteq-specific) |
| 0x2002 | 1 | Set Velocity | RW | Direct velocity command (Roboteq-specific) |

**RPDO configuration for motor commands:**

The Roboteq controller uses RPDO1 (COB-ID = 0x200 + Node_ID) for receiving motor commands. Example for sending a 70% PWM command to Node 1:

```
CAN ID: 0x201 (RPDO1 for node 1)
Data: BC 02 00 00  (700 decimal, little-endian, = 70% of max)
```

For speed mode (remap RPDO1 to object 0x2002), sending 1200 RPM:

```
CAN ID: 0x201
Data: B0 04 00 00  (0x4B0 = 1200, little-endian)
```

Negative values use two's complement encoding.

### 4.3 Orbital Hydraulic Steering Valve

An orbital (orbitrol) steering valve is a hydrostatic steering unit that converts mechanical rotation into proportional hydraulic flow. Key characteristics:

- **Metering:** Flow is proportional to the angular rotation of the input shaft. More rotation = more hydraulic flow = faster steering.
- **Follow-up:** Internal gerotor mechanism provides mechanical feedback -- when the input stops rotating, the valve centers and flow stops, holding the steering position.
- **Load-independent:** Steering force is generated hydraulically, independent of the input torque. This means a small DC motor can control a heavy vehicle's steering.
- **Bi-directional:** Rotating the input shaft clockwise meters flow in one direction (e.g., steer left); counterclockwise meters flow the other direction (steer right).

For autonomous control, the orbital valve's input shaft is coupled to a DC motor (driven by the Roboteq controller) via a coupling or gearbox. The motor position command maps directly to a steering angle change.

**Common orbital valve suppliers:**
- Danfoss (OSPE, EHi series -- with integrated electrohydraulic and CAN bus options)
- Eaton (Char-Lynn series)
- Parker, Bosch Rexroth

**Electrohydraulic variants (e.g., Danfoss EHi):**

Modern electrohydraulic steering valves like the Danfoss EHi integrate:
- CAN bus interface for direct command from ADS
- SIL 2 / Performance Level d safety certification (TUV)
- Built-in position sensor
- Auto-guidance / GPS steering support
- Variable steering ratio
- 20+ dedicated safety functions

These eliminate the need for a separate motor controller + DC motor arrangement, as the valve itself accepts CAN commands directly.

### 4.4 Hydraulic System

The hydraulic steering circuit:

```
+----------+     +----------+     +----------+
| Hydraulic| --> | Orbital  | --> | Steering |
| Pump     |     | Valve    |     | Cylinder |
| (engine/ |     | (flow    |     | (double- |
|  electric|     |  control)|     |  acting) |
|  driven) |     +-----+----+     +-----+----+
+----------+           |               |
                        |          +----+-----+
                   +----+----+     | Steering |
                   | Return  |     | Linkage  |
                   | to Tank |     +----------+
                   +---------+
```

For electric vehicles like the Auto-DollyTug, the hydraulic pump is electrically driven. The system pressure is typically 70-150 bar for off-highway steering applications.

---

## 5. Safety in Drive-by-Wire Systems

### 5.1 Redundant CAN Channels

Safety-critical DBW systems implement dual-redundant CAN buses:

- **Primary CAN bus:** Normal operating path for all commands and feedback
- **Secondary CAN bus:** Independent physical path with independent transceivers and controllers

Both buses carry identical messages. The receiving ECU compares messages from both buses and uses voting logic:

```
if (primary_msg == secondary_msg):
    accept(primary_msg)
elif (primary_healthy AND secondary_timeout):
    accept(primary_msg)  # degraded mode
elif (secondary_healthy AND primary_timeout):
    accept(secondary_msg)  # degraded mode
else:
    enter_safe_state()  # both disagree or both failed
```

The NX NextMotion system exemplifies this approach with dual redundant microcontrollers, power supplies, CAN communications, and signal circuitry.

### 5.2 Watchdog Timer

A watchdog ensures the ADS is alive and actively commanding the vehicle:

**Command watchdog (heartbeat):**

1. The ADS sends a command message at a fixed rate (e.g., 20 Hz / every 50 ms).
2. Each message contains a rolling counter (0-255, incrementing by 1 each cycle).
3. The vehicle ECU monitors both the message arrival rate and the counter continuity.
4. If no valid message arrives within the timeout period (e.g., 200 ms = 4 missed cycles), the vehicle ECU declares a watchdog fault.

**Watchdog fault response (typically cascaded):**

| Missed Cycles | Response |
|--------------|----------|
| 1-2 | Hold last command, set warning flag |
| 3-4 | Begin controlled deceleration |
| 5+ | Apply full braking, disable steering actuator |

**Hardware watchdog:**

In addition to the software watchdog, a hardware watchdog circuit operates independently of the main processor. The processor must "kick" (reset) the hardware watchdog at regular intervals. If the processor hangs (crash, infinite loop, stack overflow), the hardware watchdog triggers a system reset or safe-state relay.

**CANopen Heartbeat Protocol:**

The CANopen heartbeat mechanism uses CAN ID 0x700 + Node_ID. Each node periodically sends a heartbeat frame containing its NMT state. The consumer monitors all expected producers and triggers error handling if a heartbeat is missed.

```
Heartbeat CAN frame:
  ID:   0x700 + Node_ID
  DLC:  1
  Data: [NMT_state]
         0x00 = Boot-up
         0x04 = Stopped
         0x05 = Operational
         0x7F = Pre-operational
```

### 5.3 Emergency Stop (E-Stop)

E-Stop implementation in autonomous vehicles:

**Hardware E-Stop:**
- Physical mushroom-head button(s) accessible to safety operator
- Hardwired relay circuit -- NOT dependent on software or CAN
- Directly interrupts power to drive motors and engages mechanical brakes (spring-applied, hydraulically released)
- Typical architecture: normally closed (NC) relay in series with motor power; pressing E-Stop opens the relay
- Multiple E-Stop buttons in parallel (any one triggers the stop)

**Software E-Stop (via CAN):**
- The ADS or a safety system sends a dedicated E-Stop CAN message
- Highest priority CAN ID (e.g., 0x000 or 0x001)
- Triggers controlled shutdown: disable drive, apply brakes, disable steering actuator
- Used for graceful stops when the hardware E-Stop is not appropriate (e.g., remote E-Stop from fleet management system)

**E-Stop state machine:**

```
NORMAL --> E_STOP_REQUESTED --> MOTORS_DISABLED --> BRAKES_APPLIED --> STOPPED
                                                                        |
NORMAL <-- RESET_CONFIRMED <-- E_STOP_RESET <-- OPERATOR_RESET <-------+
```

Key: E-Stop reset MUST require deliberate operator action (e.g., twist-to-release button + separate reset command). Automatic reset after E-Stop is prohibited in safety-critical systems.

### 5.4 Fail-Operational vs. Fail-Safe

| Concept | Behavior on Fault | Use Case |
|---------|-------------------|----------|
| **Fail-Safe** | System shuts down to a safe state | Parking brake applied, steering locked, motors disabled |
| **Fail-Operational** | System continues operating with reduced capability | Redundant actuator takes over; vehicle completes maneuver then stops |

Modern DBW systems targeting ASIL D require fail-operational behavior for at least enough time to reach a safe state (e.g., stop the vehicle in a safe location rather than stopping immediately in a traffic lane).

**Three-layer redundancy approach (as implemented in systems like Arnold NextG):**

1. **Sensor redundancy:** Triple redundant sensors with 2-out-of-3 (2oo3) majority voting
2. **ECU dual processing:** A/B side architecture with independent processing paths analyzing sensor data in parallel
3. **Actuator redundancy:** Backup actuator assumes control within milliseconds if primary fails

### 5.5 Driver Takeover Detection

For vehicles with a safety operator (as in all current Aurrigo deployments):

- Torque sensors on steering wheel detect human input
- Pedal position sensors detect brake or throttle application
- Any human input immediately overrides autonomous commands
- Hardware-based logic (not software-dependent) triggers mode transition from autonomous to manual
- System defaults to safe stop if no setpoints arrive within timeout

---

## 6. CAN Message Design

### 6.1 DBC File Format

The DBC (DataBase Container) file format, developed by Vector Informatik GmbH, is the industry standard for defining CAN message layouts. A DBC file maps raw CAN bytes to physical signals with engineering units.

**Message definition syntax:**

```
BO_ <CAN_ID> <MessageName>: <DLC> <SendingNode>
 SG_ <SignalName> : <StartBit>|<BitLength>@<ByteOrder><ValueType>
     (<Scale>,<Offset>) [<Min>|<Max>] "<Unit>" <ReceivingNode>
```

**Byte order:**
- `@1` = Little-endian (Intel) -- start bit is the LSB
- `@0` = Big-endian (Motorola) -- start bit is the MSB

**Value type:**
- `+` = Unsigned
- `-` = Signed (two's complement)

**Encoding/Decoding formula:**

```
physical_value = offset + scale * raw_value
raw_value = (physical_value - offset) / scale
```

### 6.2 Example DBC Definition for an Autonomous Vehicle

```dbc
VERSION ""

NS_ :

BS_:

BU_: ADS VehicleECU

BO_ 256 AdsToVehicle_Control: 8 ADS
 SG_ SteeringAngleCmd : 0|16@1- (0.1,0) [-400|400] "deg" VehicleECU
 SG_ VelocityCmd : 16|16@1+ (0.01,0) [0|25] "m/s" VehicleECU
 SG_ BrakeCmd : 32|8@1+ (1,0) [0|100] "%" VehicleECU
 SG_ GearCmd : 40|3@1+ (1,0) [0|4] "" VehicleECU
 SG_ ControlMode : 43|3@1+ (1,0) [0|4] "" VehicleECU
 SG_ HeartbeatCnt : 48|8@1+ (1,0) [0|255] "" VehicleECU
 SG_ Checksum : 56|8@1+ (1,0) [0|255] "" VehicleECU

BO_ 257 VehicleToAds_State: 8 VehicleECU
 SG_ SteeringAngleAct : 0|16@1- (0.1,0) [-400|400] "deg" ADS
 SG_ VelocityAct : 16|16@1+ (0.01,0) [0|25] "m/s" ADS
 SG_ SystemStatus : 32|8@1+ (1,0) [0|255] "" ADS
 SG_ SteeringStatus : 40|8@1+ (1,0) [0|255] "" ADS
 SG_ HeartbeatEcho : 48|8@1+ (1,0) [0|255] "" ADS
 SG_ Checksum : 56|8@1+ (1,0) [0|255] "" ADS

BO_ 258 VehicleToAds_Sensors: 8 VehicleECU
 SG_ WheelSpeedFL : 0|16@1+ (0.01,0) [0|30] "m/s" ADS
 SG_ WheelSpeedFR : 16|16@1+ (0.01,0) [0|30] "m/s" ADS
 SG_ WheelSpeedRL : 32|16@1+ (0.01,0) [0|30] "m/s" ADS
 SG_ WheelSpeedRR : 48|16@1+ (0.01,0) [0|30] "m/s" ADS

BO_ 1 EmergencyStop: 1 ADS
 SG_ EStopCmd : 0|1@1+ (1,0) [0|1] "" VehicleECU

VAL_ 256 GearCmd 0 "Park" 1 "Reverse" 2 "Neutral" 3 "Drive" ;
VAL_ 256 ControlMode 0 "Manual" 1 "Autonomous" 2 "EStop" 3 "Calibration" ;
```

### 6.3 Signal Packing Best Practices

1. **Byte alignment:** Align signals to byte boundaries when possible. A 16-bit signal starting at bit 0 is cleaner than one starting at bit 3.
2. **Consistent byte order:** Use one byte order (preferably little-endian on Linux-based systems) throughout the bus. Mixing endianness causes bugs.
3. **Scale and offset:** Choose scale factors that give sufficient resolution without wasting bits. For steering angle with 0.1 degree resolution over +/-40 degrees, a 16-bit signed integer (-400 to +400) is adequate.
4. **Checksum and counter:** Always include a rolling counter and checksum in safety-critical messages. The receiver validates both to detect stale, corrupted, or missing messages.
5. **Message rate:** Safety-critical commands (steering, braking) should be sent at 20-100 Hz. Status/feedback messages at 10-50 Hz. Diagnostic messages at 1-10 Hz.
6. **CAN ID allocation:** Reserve the lowest IDs (highest priority) for safety messages. Group related signals in the same message to reduce bus load.

### 6.4 Checksum Algorithms

Common CAN message checksums:

**XOR checksum (simple):**
```c
uint8_t checksum = 0;
for (int i = 0; i < 7; i++) {
    checksum ^= data[i];
}
data[7] = checksum;
```

**CRC-8 (SAE J1850):**
Used in many automotive protocols. Polynomial: x^8 + x^4 + x^3 + x^2 + 1 (0x1D).

**Counter + CRC combination:**
The rolling counter provides sequence integrity (detects stale messages), while the CRC provides data integrity (detects bit errors). Together they provide robust end-to-end protection.

---

## 7. SocketCAN on Linux

### 7.1 Overview

SocketCAN is the standard Linux kernel subsystem for CAN bus communication. It integrates CAN controllers as network interfaces (like `can0`, `can1`) and exposes them through the Berkeley socket API. This means CAN communication uses the same `socket()`, `bind()`, `read()`, `write()` system calls as TCP/IP networking.

**Key advantages:**
- Multi-user access: multiple applications can read/write the same CAN interface simultaneously
- Built-in queueing and multiplexing via the Linux network stack
- Filtering in kernel space reduces user-space load
- Virtual CAN interfaces (`vcan`) for testing without hardware
- Consistent API across different CAN hardware (PEAK, Kvaser, MCP2515, etc.)

### 7.2 Network Interface Configuration

**Loading kernel modules:**

```bash
# Load the CAN core module
sudo modprobe can

# Load the CAN raw protocol module
sudo modprobe can_raw

# Load a virtual CAN module (for testing)
sudo modprobe vcan

# Load a hardware driver (e.g., for PEAK PCAN-USB)
sudo modprobe peak_usb
```

**Configuring a physical CAN interface:**

```bash
# Set bitrate and bring up the interface
sudo ip link set can0 up type can bitrate 250000

# With sample point specification
sudo ip link set can0 up type can bitrate 250000 sample-point 0.875

# CAN FD with dual bitrate
sudo ip link set can0 up type can bitrate 500000 dbitrate 4000000 fd on

# Show interface details and statistics
ip -details -statistics link show can0

# Bring down the interface
sudo ip link set can0 down
```

**Creating a virtual CAN interface (for testing):**

```bash
sudo ip link add dev vcan0 type vcan
sudo ip link set vcan0 up

# To remove
sudo ip link del vcan0
```

### 7.3 C Programming with SocketCAN

**Opening a CAN socket and binding to an interface:**

```c
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <net/if.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <linux/can.h>
#include <linux/can/raw.h>

int main() {
    int s;
    struct sockaddr_can addr;
    struct ifreq ifr;

    // Create a raw CAN socket
    s = socket(PF_CAN, SOCK_RAW, CAN_RAW);
    if (s < 0) {
        perror("socket");
        return 1;
    }

    // Specify the CAN interface
    strcpy(ifr.ifr_name, "can0");
    ioctl(s, SIOCGIFINDEX, &ifr);

    // Bind the socket to the interface
    addr.can_family = AF_CAN;
    addr.can_ifindex = ifr.ifr_ifindex;
    bind(s, (struct sockaddr *)&addr, sizeof(addr));

    return 0;
}
```

**Sending a CAN frame:**

```c
struct can_frame frame;

frame.can_id  = 0x100;       // CAN ID
frame.can_dlc = 8;           // Data length
frame.data[0] = 0xFD;        // Steering command LSB
frame.data[1] = 0x00;        // Steering command MSB
frame.data[2] = 0xFA;        // Velocity command LSB
frame.data[3] = 0x00;        // Velocity command MSB
frame.data[4] = 0x00;        // Brake command
frame.data[5] = 0x03;        // Gear: Drive
frame.data[6] = 0x2A;        // Heartbeat counter
frame.data[7] = 0x00;        // Checksum (computed)

int nbytes = write(s, &frame, sizeof(struct can_frame));
if (nbytes != sizeof(struct can_frame)) {
    perror("write");
}
```

**Receiving a CAN frame:**

```c
struct can_frame frame;
int nbytes;

nbytes = read(s, &frame, sizeof(struct can_frame));
if (nbytes < 0) {
    perror("read");
} else {
    printf("ID: 0x%03X DLC: %d Data:", frame.can_id, frame.can_dlc);
    for (int i = 0; i < frame.can_dlc; i++) {
        printf(" %02X", frame.data[i]);
    }
    printf("\n");
}
```

**Setting receive filters:**

```c
struct can_filter rfilter[2];

// Accept only messages with ID 0x101
rfilter[0].can_id   = 0x101;
rfilter[0].can_mask  = CAN_SFF_MASK;  // 0x7FF -- exact match

// Accept messages with ID 0x200-0x2FF
rfilter[1].can_id   = 0x200;
rfilter[1].can_mask  = 0x700;  // Match upper nibble only

setsockopt(s, SOL_CAN_RAW, CAN_RAW_FILTER,
           &rfilter, sizeof(rfilter));
```

**CAN FD frame handling:**

```c
#include <linux/can/raw.h>

// Enable CAN FD support on the socket
int enable_canfd = 1;
setsockopt(s, SOL_CAN_RAW, CAN_RAW_FD_FRAMES,
           &enable_canfd, sizeof(enable_canfd));

// CAN FD frame structure
struct canfd_frame fdframe;
fdframe.can_id = 0x100;
fdframe.len = 24;           // Up to 64 bytes
fdframe.flags = CANFD_BRS;  // Bit Rate Switch
memcpy(fdframe.data, payload, 24);

write(s, &fdframe, sizeof(struct canfd_frame));
```

### 7.4 can-utils Command-Line Tools

The `can-utils` package provides essential debugging and testing tools:

```bash
# Install can-utils
sudo apt install can-utils

# Dump all CAN traffic on an interface
candump can0

# Dump with timestamps and filtering
candump can0,0x100:0x7FF    # Only ID 0x100
candump -ta can0             # Absolute timestamps

# Send a single CAN frame
cansend can0 100#AABBCCDD    # ID 0x100, data AA BB CC DD

# Send periodic frames
cangen can0 -I 100 -L 8 -D AABBCCDDEEFF0011 -g 50
#   -I: CAN ID, -L: length, -D: data, -g: gap in ms

# Record and replay
candump -l can0              # Log to candump-<date>.log
canplayer -I candump-*.log   # Replay from log file

# Display bus statistics
canbusload can0 250000       # Bus load at 250 kbit/s
```

### 7.5 Python CAN Programming

The `python-can` library provides a high-level, cross-platform API:

```python
import can

# Create a bus instance
bus = can.Bus(channel='can0', interface='socketcan', bitrate=250000)

# Send a message
msg = can.Message(
    arbitration_id=0x100,
    data=[0xFD, 0x00, 0xFA, 0x00, 0x00, 0x03, 0x2A, 0x00],
    is_extended_id=False
)
bus.send(msg, timeout=0.2)

# Receive messages (blocking)
for msg in bus:
    print(f"ID: {msg.arbitration_id:#05x} Data: {msg.data.hex()}")
    if msg.arbitration_id == 0x101:
        # Decode vehicle feedback
        steering_actual = int.from_bytes(msg.data[0:2], 'little', signed=True) * 0.1
        velocity_actual = int.from_bytes(msg.data[2:4], 'little', signed=False) * 0.01
        print(f"  Steering: {steering_actual:.1f} deg, Velocity: {velocity_actual:.2f} m/s")

# Non-blocking receive
msg = bus.recv(timeout=0.1)  # Returns None on timeout

# Clean up
bus.shutdown()
```

**Using cantools for DBC-based encoding/decoding:**

```python
import can
import cantools

# Load DBC file
db = cantools.database.load_file('vehicle_interface.dbc')

# Encode a command message
msg_def = db.get_message_by_name('AdsToVehicle_Control')
data = msg_def.encode({
    'SteeringAngleCmd': 25.3,    # degrees
    'VelocityCmd': 2.5,           # m/s
    'BrakeCmd': 0,                # %
    'GearCmd': 3,                 # Drive
    'ControlMode': 1,             # Autonomous
    'HeartbeatCnt': 42,
    'Checksum': 0                 # Compute separately
})

msg = can.Message(arbitration_id=msg_def.frame_id, data=data)
bus.send(msg)

# Decode a received message
received = bus.recv()
decoded = db.decode_message(received.arbitration_id, received.data)
print(decoded)
# {'SteeringAngleAct': 25.1, 'VelocityAct': 2.48, ...}
```

---

## 8. ROS CAN Integration

### 8.1 Architecture Options

There are several approaches to integrating CAN bus with ROS/ROS2:

| Approach | Package | Description |
|----------|---------|-------------|
| **SocketCAN Bridge** | `ros2socketcan_bridge` | Bidirectional bridge between CAN frames and ROS2 topics |
| **CANopen Stack** | `ros2_canopen` | Full CANopen protocol stack with ros2_control integration |
| **Custom Node** | Application-specific | Direct SocketCAN access in a ROS2 node using python-can or C sockets |
| **Dataspeed DBW** | `dbw_ros` | Complete DBW interface for supported vehicles |
| **PACMod** | `pacmod3` | DBW interface for PACMod-equipped vehicles |

### 8.2 ros2socketcan_bridge

The `ros2socketcan_bridge` package creates a bidirectional bridge between ROS 2 topics and the CAN bus:

**Topic structure:**

```
CAN/{socket_name}/receive    # Publishes incoming CAN frames as can_msgs/msg/Frame
CAN/{socket_name}/transmit   # Subscribes and sends received ROS messages to CAN bus
```

**Installation and usage:**

```bash
# Install CAN message package
sudo apt install ros-${ROS_DISTRO}-can-msgs

# Build the bridge
cd ~/ros2_ws/src
git clone https://github.com/GOFIRST-Robotics/ros2socketcan_bridge.git
cd ~/ros2_ws
colcon build --packages-select ros2socketcan_bridge

# Run the bridge (default: can0)
ros2 run ros2socketcan_bridge ros2socketcan
```

**The `can_msgs/msg/Frame` message type:**

```
# can_msgs/msg/Frame
std_msgs/Header header
uint32 id
bool is_rtr
bool is_extended
bool is_error
uint8 dlc
uint8[8] data
```

### 8.3 ros2_canopen

The `ros2_canopen` package provides a complete CANopen stack for ROS 2, built on the lelycore CANopen library:

**Configuration (YAML):**

```yaml
bus_config:
  master:
    node_id: 1
    baudrate: 250000

  steering_motor:
    node_id: 2
    dcf: "roboteq_mdc1460.eds"
    driver: "ros2_canopen::Cia402Driver"
    position_mode: true

  drive_motor:
    node_id: 3
    dcf: "drive_motor.eds"
    driver: "ros2_canopen::Cia402Driver"
    velocity_mode: true
```

**ROS 2 services exposed per node:**

```bash
# Initialize the motor
ros2 service call /steering_motor/init std_srvs/srv/Trigger

# Switch to position mode
ros2 service call /steering_motor/position_mode std_srvs/srv/Trigger

# Set target position
ros2 topic pub /steering_motor/target canopen_interfaces/msg/COTarget "{position: 1000}"
```

**ros2_control integration:**

The `ros2_canopen` package provides hardware interfaces compatible with `ros2_control`, enabling standard controllers (JointTrajectoryController, DiffDriveController, etc.) to command CANopen devices.

### 8.4 Custom CAN Node Architecture

For maximum flexibility (and for proprietary protocols like Aurrigo's), a custom ROS2 CAN node is often the best approach:

```python
#!/usr/bin/env python3
"""
ROS2 node for bidirectional CAN bus communication with vehicle ECU.
Translates between ROS2 topics/services and CAN frames.
"""

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from std_msgs.msg import Float64, UInt8
import can
import cantools
import struct
import threading


class VehicleCANBridge(Node):
    def __init__(self):
        super().__init__('vehicle_can_bridge')

        # Load DBC for message encoding/decoding
        self.db = cantools.database.load_file(
            self.declare_parameter('dbc_file', 'vehicle.dbc')
                .get_parameter_value().string_value
        )

        # CAN bus interface
        self.bus = can.Bus(
            channel=self.declare_parameter('can_channel', 'can0')
                .get_parameter_value().string_value,
            interface='socketcan',
            bitrate=250000
        )

        # Publishers (vehicle --> ROS)
        self.steering_pub = self.create_publisher(Float64, 'vehicle/steering_angle', 10)
        self.velocity_pub = self.create_publisher(Float64, 'vehicle/velocity', 10)

        # Subscribers (ROS --> vehicle)
        self.cmd_sub = self.create_subscription(
            Twist, 'cmd_vel', self.cmd_vel_callback, 10)

        # Watchdog
        self.heartbeat_counter = 0
        self.watchdog_timer = self.create_timer(0.05, self.send_command)  # 20 Hz

        # CAN receive thread
        self.recv_thread = threading.Thread(target=self.can_receive_loop, daemon=True)
        self.recv_thread.start()

        self.desired_velocity = 0.0
        self.desired_steering = 0.0

    def cmd_vel_callback(self, msg):
        self.desired_velocity = msg.linear.x      # m/s
        self.desired_steering = msg.angular.z      # rad --> convert to deg

    def send_command(self):
        """Periodic CAN command transmission (watchdog-driven)."""
        self.heartbeat_counter = (self.heartbeat_counter + 1) % 256

        msg_def = self.db.get_message_by_name('AdsToVehicle_Control')
        data = msg_def.encode({
            'SteeringAngleCmd': self.desired_steering * 57.2958,  # rad to deg
            'VelocityCmd': self.desired_velocity,
            'BrakeCmd': 0,
            'GearCmd': 3,          # Drive
            'ControlMode': 1,      # Autonomous
            'HeartbeatCnt': self.heartbeat_counter,
            'Checksum': 0
        })
        # Compute checksum
        data = bytearray(data)
        data[7] = 0
        for i in range(7):
            data[7] ^= data[i]

        can_msg = can.Message(arbitration_id=msg_def.frame_id, data=data)
        self.bus.send(can_msg)

    def can_receive_loop(self):
        """Background thread for CAN frame reception."""
        while rclpy.ok():
            msg = self.bus.recv(timeout=0.1)
            if msg is None:
                continue
            try:
                decoded = self.db.decode_message(msg.arbitration_id, msg.data)
                if 'SteeringAngleAct' in decoded:
                    pub_msg = Float64()
                    pub_msg.data = decoded['SteeringAngleAct']
                    self.steering_pub.publish(pub_msg)
                if 'VelocityAct' in decoded:
                    pub_msg = Float64()
                    pub_msg.data = decoded['VelocityAct']
                    self.velocity_pub.publish(pub_msg)
            except KeyError:
                pass  # Unknown message ID


def main():
    rclpy.init()
    node = VehicleCANBridge()
    rclpy.spin(node)
    node.bus.shutdown()
    rclpy.shutdown()
```

---

## 9. Steering PID Control

### 9.1 Control Architecture

Steering control for a DBW autonomous vehicle typically uses a cascaded PID structure:

**Outer loop (path tracking, 10-50 Hz):**
- Input: desired path / waypoints
- Output: steering angle setpoint
- Controller: Pure pursuit, Stanley, or MPC

**Inner loop (steering position, 50-1000 Hz):**
- Input: steering angle setpoint (from outer loop or ADS)
- Output: motor command (PWM duty cycle or current)
- Controller: PID with feedforward

### 9.2 PID Controller for Steering Position

The discrete PID controller for steering angle regulation:

```
u[k] = Kp * e[k] + Ki * sum(e[0..k]) * dt + Kd * (e[k] - e[k-1]) / dt

where:
  e[k] = setpoint - actual_angle     (error)
  u[k] = motor command output        (bounded to [-100%, +100%])
  dt   = control loop period          (e.g., 10 ms)
```

**Anti-windup:** The integral term must be bounded to prevent windup when the actuator saturates:

```c
// Clamping anti-windup
integral += error * dt;
if (integral > integral_max) integral = integral_max;
if (integral < integral_min) integral = integral_min;

// Back-calculation anti-windup (preferred)
if (output > output_max || output < output_min) {
    integral -= ki * error * dt;  // Undo the integration step
}
```

### 9.3 Tuning Methods

**Ziegler-Nichols method:**

1. Set Ki = 0, Kd = 0
2. Increase Kp until the system oscillates with a constant amplitude -- this is the ultimate gain Ku
3. Measure the oscillation period Tu
4. Set PID gains:
   - Kp = 0.6 * Ku
   - Ki = 2 * Kp / Tu
   - Kd = Kp * Tu / 8

**Practical tuning for steering (empirical):**

1. Start with Kp only. Increase until the steering oscillates slightly, then reduce by 30%.
   - Typical starting range: Kp = 0.1-0.5 for a system with degrees in, PWM% out
2. Add Kd to dampen oscillations. Increase until oscillations stop.
   - Typical: Kd = 5-20x Kp
3. Add Ki to eliminate steady-state error. Use a small value.
   - Typical: Ki = 0.01-0.1x Kp

**Twiddle algorithm (automated tuning):**

```python
def twiddle(params, tol=0.001):
    """Automated PID parameter tuning via coordinate ascent."""
    dp = [1.0, 1.0, 1.0]  # Initial step sizes for [Kp, Ki, Kd]
    best_error = run_simulation(params)

    while sum(dp) > tol:
        for i in range(3):
            params[i] += dp[i]
            error = run_simulation(params)
            if error < best_error:
                best_error = error
                dp[i] *= 1.1
            else:
                params[i] -= 2 * dp[i]
                error = run_simulation(params)
                if error < best_error:
                    best_error = error
                    dp[i] *= 1.1
                else:
                    params[i] += dp[i]
                    dp[i] *= 0.9
    return params
```

### 9.4 Steering-Specific Considerations

**Dead zone compensation:** Hydraulic orbital valves have a mechanical dead zone where small motor movements produce no steering effect. Compensate by adding a bias to overcome static friction:

```c
if (fabs(output) > deadzone_threshold && fabs(output) < min_effective_output) {
    output = copysign(min_effective_output, output);
}
```

**Rate limiting:** Limit the steering angle rate of change to prevent mechanical stress and maintain vehicle stability:

```c
float max_rate = 30.0;  // degrees per second
float dt = 0.01;        // 100 Hz loop
float max_delta = max_rate * dt;

if (fabs(new_setpoint - current_setpoint) > max_delta) {
    new_setpoint = current_setpoint + copysign(max_delta, new_setpoint - current_setpoint);
}
```

**Backlash compensation:** Gear trains between the motor and orbital valve introduce backlash (dead travel on direction reversal). Compensate by adding extra travel on direction changes:

```c
if (sign(output) != sign(last_output)) {
    output += copysign(backlash_compensation, output);
}
```

### 9.5 Performance Metrics

Based on the Techs4AgeCar research (ROS-based autonomous vehicle):

| Metric | Steering | Throttle |
|--------|----------|----------|
| Rise time | 650 ms | 2.2 s |
| Settling time | 799 ms | 4.8 s |
| Overshoot | 3.92% | 4.73% |
| Steady-state error | +/-4 deg (steering column) = +/-0.1 deg (wheel) | +/-0.36 km/h |

For airside vehicles operating at low speeds (< 25 km/h), slower response is acceptable and can prioritize smoothness over speed.

---

## 10. Braking Strategies

### 10.1 Braking Modes for Autonomous Vehicles

| Mode | Mechanism | Use Case |
|------|-----------|----------|
| **Regenerative** | Motor acts as generator, converting kinetic energy to electrical | Normal deceleration, energy recovery |
| **Friction (hydraulic/mechanical)** | Brake pads/shoes on disc/drum | Moderate to hard braking |
| **Emergency** | Maximum friction braking + motor braking | Collision avoidance, AEB |
| **Parking** | Spring-applied, hydraulically released | Vehicle at rest, E-Stop |

### 10.2 Regenerative Braking

For electric vehicles like the Aurrigo fleet:

- **How it works:** The drive motor controller reverses the current flow, making the motor act as a generator. This produces a braking torque while charging the battery.
- **CAN interface:** The ADS sends a negative velocity command or a dedicated regenerative brake command. The motor controller handles the current reversal.
- **Limitations:** Regenerative braking force is limited by generator capacity and battery charge state. It cannot bring the vehicle to a complete stop (zero-speed torque is zero).

### 10.3 Blended Braking

A hierarchical braking strategy that maximizes energy recovery while meeting the requested deceleration:

```
Requested deceleration
    |
    v
+------------------+
| Braking          |
| Coordinator      |
+--------+---------+
         |
    +----+----+
    |         |
+---+---+ +---+---+
| Regen | | Fric- |
| Brake | | tion  |
+-------+ +-------+

Allocation logic:
  regen_torque = min(requested_torque, max_regen_torque)
  friction_torque = requested_torque - regen_torque
```

### 10.4 Emergency Braking via CAN

Emergency braking is typically implemented as a high-priority CAN message:

```
CAN ID: 0x001  (highest priority after E-Stop)
DLC:    2
Data:   [0xFF, 0x00]  -- Byte 0: brake command (100%), Byte 1: reserved

Transmission rate: Burst of 3 frames within 10 ms, then 20 Hz continuous
```

The vehicle ECU responds to this message by:
1. Immediately applying maximum friction braking
2. Commanding maximum regenerative braking
3. Disabling drive motor power
4. Activating hazard indicators (if equipped)

### 10.5 Braking on Grades

For airside vehicles operating on apron areas (which may have slight grades for drainage):

```
Required braking torque = m * g * sin(theta) + m * a_desired

where:
  m = vehicle mass (including payload)
  g = 9.81 m/s^2
  theta = grade angle
  a_desired = desired deceleration
```

Even a 2% grade (common for apron drainage) adds significant rolling force on a 5,000+ kg loaded vehicle, requiring continuous brake holding on slopes.

---

## 11. Vehicle State Feedback

### 11.1 Feedback Signals via CAN

The vehicle ECU provides the ADS with real-time state information over CAN:

| Signal | Source | Typical Rate | Use in ADS |
|--------|--------|-------------|------------|
| Steering angle (actual) | Potentiometer / encoder on steering linkage | 50-100 Hz | Closed-loop steering control, state estimation |
| Wheel speeds (4x) | Wheel encoders / ABS sensors | 50-100 Hz | Odometry, slip detection, velocity estimation |
| Vehicle velocity | Computed from wheel speeds or drive motor encoder | 50-100 Hz | Speed control, path tracking |
| Yaw rate | IMU (CAN-connected) | 100-400 Hz | State estimation, stability control |
| Lateral/longitudinal acceleration | IMU | 100-400 Hz | State estimation, slip detection |
| Motor current | Motor controller feedback | 20-50 Hz | Load monitoring, fault detection |
| Battery voltage | BMS | 1-10 Hz | Energy management, operational limits |
| Battery SOC | BMS | 1-10 Hz | Mission planning, return-to-charge |
| System faults | ECU diagnostics | On-event + 1 Hz | Safety monitoring |

### 11.2 Odometry from CAN Data

Vehicle odometry (position estimation from wheel encoders) is computed from CAN-reported wheel speeds:

```python
# Differential drive odometry from wheel speeds
def compute_odometry(v_left, v_right, wheelbase, dt, x, y, theta):
    """
    v_left, v_right: wheel speeds (m/s) from CAN
    wheelbase: distance between left and right wheels (m)
    dt: time step (s)
    x, y: current position (m)
    theta: current heading (rad)
    """
    v = (v_left + v_right) / 2.0          # Linear velocity
    omega = (v_right - v_left) / wheelbase # Angular velocity

    x += v * cos(theta) * dt
    y += v * sin(theta) * dt
    theta += omega * dt

    return x, y, theta
```

For 4-wheel-steering vehicles like the Auto-DollyTug, odometry is more complex -- all four wheel speeds and angles contribute to the velocity estimate.

### 11.3 IMU Integration via CAN

CAN-connected IMUs (e.g., Aceinna, LORD/Parker, Xsens) provide:

- 3-axis acceleration (m/s^2)
- 3-axis angular rate (rad/s or deg/s)
- Orientation (quaternion or Euler angles, if on-board AHRS)

CAN IMU advantages for autonomous vehicles:
- Direct bus integration (no additional serial interface)
- Hardware-timestamped for precise sensor fusion
- Compensates for wheel slip and encoder errors
- Detects dynamic load transfers during braking/acceleration

### 11.4 Sensor Fusion

An Extended Kalman Filter (EKF) fuses wheel odometry, IMU, and GPS/RTK for robust state estimation:

```
Prediction step (from IMU):
  x_pred = f(x_prev, imu_accel, imu_gyro, dt)

Update step (from wheel encoders):
  x_updated = x_pred + K * (z_wheel - h(x_pred))

Update step (from GNSS/RTK, when available):
  x_updated = x_pred + K * (z_gps - h(x_pred))
```

The CAN bus serves as the unified transport layer for all these sensor inputs, simplifying the wiring and providing a standardized interface.

---

## 12. Functional Safety (ISO 26262)

### 12.1 Overview

ISO 26262 is the international standard for functional safety of road vehicles' electrical and electronic systems. While airport airside vehicles are not technically "road vehicles," ISO 26262 provides the most relevant safety framework for autonomous vehicle drive-by-wire systems and is increasingly referenced by airport authorities and aviation regulators.

### 12.2 ASIL Classification

Automotive Safety Integrity Level (ASIL) ranges from A (lowest) to D (highest), based on:

- **Severity (S):** S0 (no injuries) to S3 (life-threatening/fatal)
- **Exposure (E):** E0 (incredible) to E4 (high probability)
- **Controllability (C):** C0 (controllable) to C3 (uncontrollable)

| System | Typical ASIL | Rationale |
|--------|-------------|-----------|
| Steer-by-wire | **ASIL D** | Loss of steering = uncontrollable at any speed |
| Brake-by-wire | **ASIL D** | Loss of braking = potentially fatal |
| Throttle-by-wire | **ASIL C/D** | Unintended acceleration = serious risk |
| Instrument cluster | **ASIL B** | Loss of displays = impaired driver awareness |
| Door locks | **ASIL A** | Failure impact is limited |

For autonomous airside vehicles, the effective ASIL may be moderated by the controlled operating environment (restricted access, low speed, trained personnel), but many OEMs default to ASIL D for any system where failure could cause injury.

### 12.3 Requirements for Drive-by-Wire

ISO 26262 imposes requirements across the entire development lifecycle:

**Hardware:**
- Single-point fault metric (SPFM) >= 99% for ASIL D
- Latent fault metric (LFM) >= 90% for ASIL D
- Random hardware failure rate (PMHF) < 10 FIT for ASIL D (1 FIT = 1 failure per 10^9 hours)
- Diagnostic coverage: >= 99% for ASIL D

**Software:**
- Formal methods or semi-formal methods for specification
- Unit testing with MC/DC coverage for ASIL D
- Back-to-back testing between model and code
- Static analysis (MISRA-C compliance for C code)
- No dynamic memory allocation in safety-critical paths

**Process:**
- Safety plan, hazard analysis and risk assessment (HARA)
- Functional safety concept, technical safety concept
- Hardware-software integration testing
- Safety validation
- Confirmation reviews by independent assessors

### 12.4 Safety Mechanisms for CAN-Based DBW

| Mechanism | ISO 26262 Requirement | Implementation |
|-----------|----------------------|----------------|
| End-to-end protection | E2E communication protection | Rolling counter + CRC in every message |
| Message timeout | Detection of communication loss | Watchdog timer on receiver side |
| Signal range check | Plausibility of received values | Receiver validates signals against physical limits |
| Redundant communication | Independence of communication channels | Dual CAN bus with independent transceivers |
| Voter | Handling of redundant signal disagreement | 2oo3 majority voting on triple-redundant sensors |
| Safe state | Defined behavior on detected fault | Apply brakes, disable steering, alert operator |

### 12.5 Applicability to Airside Operations

Aurrigo has not publicly cited specific ISO 26262 certification for their vehicles. The NUIC (No User in Charge) feasibility study with IAG is explicitly developing certification pathways. Current deployments operate under each airport's established safety governance with a safety operator onboard.

Relevant standards beyond ISO 26262 for airside autonomous vehicles:
- **IEC 61508:** Generic functional safety standard (referenced by some DBW suppliers, e.g., Danfoss SIL 2)
- **ISO 13849 / EN ISO 13849-1:** Safety of machinery (relevant for GSE)
- **UL 4600:** Evaluation of autonomous products (emerging standard)
- **ISO 25119:** Tractors and machinery for agriculture and forestry (relevant for similar off-highway vehicles)

---

## 13. Testing Tools

### 13.1 Hardware Interfaces

| Device | Manufacturer | CAN Standard | Interface | Key Features | Price Range |
|--------|-------------|--------------|-----------|-------------|-------------|
| **PCAN-USB** | PEAK-System | CAN 2.0 | USB | Linux SocketCAN driver, PCAN-View software | ~$250 |
| **PCAN-USB FD** | PEAK-System | CAN FD | USB | Dual bit rate, CAN FD support | ~$350 |
| **PCAN-USB X6** | PEAK-System | CAN FD | USB | 6 CAN channels, HIL testing | ~$1,500 |
| **Kvaser Leaf Light v2** | Kvaser | CAN 2.0 | USB | CANKing software, free SDK | ~$300 |
| **Kvaser USBcan Pro** | Kvaser | CAN FD | USB | 2 channels, CAN FD | ~$700 |
| **CANable** | Open source | CAN 2.0 | USB | SocketCAN compatible, open hardware | ~$25 |
| **Canable Pro** | Open source | CAN FD | USB | CAN FD, SocketCAN | ~$60 |
| **MCP2515 + SPI** | Various | CAN 2.0 | SPI (RPi/embedded) | Cheap, Linux kernel driver | ~$5 |
| **Waveshare CAN HAT** | Waveshare | CAN 2.0/FD | Raspberry Pi | Direct Pi integration | ~$20 |

For autonomous vehicle development, the PEAK PCAN-USB is the most widely used tool due to excellent Linux/SocketCAN support and the free PCAN-View analyzer software.

### 13.2 Software Tools

**Command-line (Linux):**

| Tool | Package | Purpose |
|------|---------|---------|
| `candump` | can-utils | Capture and display CAN traffic |
| `cansend` | can-utils | Send individual CAN frames |
| `cangen` | can-utils | Generate periodic CAN traffic |
| `canplayer` | can-utils | Replay captured CAN logs |
| `canbusload` | can-utils | Monitor bus utilization |
| `cansniffer` | can-utils | Show changing CAN data in real-time |
| `isotpsend/recv` | can-utils | ISO-TP (multi-frame) communication |

**GUI analyzers:**

| Tool | Platform | Features |
|------|----------|----------|
| **SavvyCAN** | Cross-platform | Open source, DBC support, graphing, scripting, works with most CAN hardware |
| **PCAN-Explorer** | Windows | Commercial, comprehensive analysis, VBS scripting, DBC support |
| **BUSMASTER** | Windows | Open source (by Robert Bosch), DBC/DBF support, simulation |
| **Wireshark** | Cross-platform | CAN dissector plugin for SocketCAN captures |
| **CANalyzer / CANoe** | Windows | Vector Informatik, industry standard, expensive (~$5,000+) |

**Python libraries:**

| Library | Purpose |
|---------|---------|
| `python-can` | Hardware-agnostic CAN bus access (send/receive) |
| `cantools` | DBC file parsing, message encoding/decoding |
| `canmatrix` | DBC/ARXML/KCD format conversion |
| `scapy` | CAN frame crafting and analysis (security testing) |
| `udsoncan` | UDS (Unified Diagnostic Services) client |

### 13.3 Testing Methodology

**Virtual CAN testing (no hardware):**

```bash
# Set up virtual CAN
sudo modprobe vcan
sudo ip link add dev vcan0 type vcan
sudo ip link set vcan0 up

# Terminal 1: Listen
candump vcan0

# Terminal 2: Send test frames
cansend vcan0 100#AABBCCDD

# Terminal 3: Run ROS node under test
ros2 run vehicle_interface can_bridge --ros-args -p can_channel:=vcan0
```

**Loopback testing:**

```bash
# Configure physical CAN in loopback mode
sudo ip link set can0 up type can bitrate 250000 loopback on
```

**Bus load analysis:**

```bash
# Monitor bus load percentage
canbusload can0 250000

# Capture traffic for offline analysis
candump -l can0              # Creates timestamped log file
# Analyze in SavvyCAN or convert with cantools
```

**Automated regression testing:**

```python
import can
import time

def test_steering_range():
    """Verify vehicle accepts full steering range."""
    bus = can.Bus('vcan0', interface='socketcan')

    for angle in range(-400, 401, 10):  # -40.0 to +40.0 deg in 1.0 deg steps
        data = struct.pack('<hHBBBB', angle, 0, 0, 3, 1, 42)
        checksum = 0
        for b in data[:7]:
            checksum ^= b
        data = data[:7] + bytes([checksum])

        msg = can.Message(arbitration_id=0x100, data=data)
        bus.send(msg)

        # Wait for response
        resp = bus.recv(timeout=0.2)
        assert resp is not None, f"No response for angle {angle/10.0}"
        actual = struct.unpack('<h', resp.data[0:2])[0]
        error = abs(actual - angle)
        assert error < 20, f"Steering error too large: {error/10.0} deg at setpoint {angle/10.0}"

        time.sleep(0.05)

    bus.shutdown()
    print("Steering range test PASSED")
```

---

## 14. Multi-Platform CAN Abstraction

### 14.1 The Problem

CAN bus access APIs differ across platforms:
- **Linux:** SocketCAN (kernel network interface)
- **Windows:** Vendor-specific APIs (PCAN-Basic, Kvaser CANlib, NI-XNET)
- **Embedded (bare-metal):** Direct register access to CAN peripheral
- **RTOS:** Platform-specific CAN drivers

For autonomous vehicle development, the ADS software often needs to run on Linux (primary), Windows (simulation/development), and embedded targets (safety controller).

### 14.2 Abstraction Layer Design

A well-designed CAN abstraction layer provides a uniform API across platforms:

```cpp
// can_interface.h -- Platform-agnostic CAN interface
#pragma once

#include <cstdint>
#include <functional>
#include <string>
#include <vector>

struct CanFrame {
    uint32_t id;
    uint8_t  dlc;
    uint8_t  data[64];  // Support CAN FD
    bool     is_extended;
    bool     is_fd;
    bool     is_brs;    // Bit Rate Switch (CAN FD)
    uint64_t timestamp_us;
};

class ICanInterface {
public:
    virtual ~ICanInterface() = default;

    virtual bool open(const std::string& channel, uint32_t bitrate) = 0;
    virtual void close() = 0;
    virtual bool send(const CanFrame& frame) = 0;
    virtual bool receive(CanFrame& frame, int timeout_ms = -1) = 0;

    // Filter: accept only messages matching (id & mask) == (filter_id & mask)
    virtual bool set_filter(uint32_t filter_id, uint32_t mask) = 0;

    // Async receive callback
    using ReceiveCallback = std::function<void(const CanFrame&)>;
    virtual void set_receive_callback(ReceiveCallback cb) = 0;
};
```

### 14.3 Platform-Specific Implementations

**Linux (SocketCAN):**

```cpp
// can_socketcan.cpp
class SocketCanInterface : public ICanInterface {
    int sock_ = -1;
public:
    bool open(const std::string& channel, uint32_t bitrate) override {
        sock_ = socket(PF_CAN, SOCK_RAW, CAN_RAW);
        struct ifreq ifr;
        strncpy(ifr.ifr_name, channel.c_str(), IFNAMSIZ);
        ioctl(sock_, SIOCGIFINDEX, &ifr);

        struct sockaddr_can addr;
        addr.can_family = AF_CAN;
        addr.can_ifindex = ifr.ifr_ifindex;
        return bind(sock_, (struct sockaddr*)&addr, sizeof(addr)) == 0;
    }

    bool send(const CanFrame& frame) override {
        struct can_frame cf;
        cf.can_id = frame.id;
        if (frame.is_extended) cf.can_id |= CAN_EFF_FLAG;
        cf.can_dlc = frame.dlc;
        memcpy(cf.data, frame.data, frame.dlc);
        return write(sock_, &cf, sizeof(cf)) == sizeof(cf);
    }

    bool receive(CanFrame& frame, int timeout_ms) override {
        // Use poll() for timeout, then read()
        struct pollfd pfd = {sock_, POLLIN, 0};
        if (poll(&pfd, 1, timeout_ms) <= 0) return false;

        struct can_frame cf;
        if (read(sock_, &cf, sizeof(cf)) != sizeof(cf)) return false;

        frame.id = cf.can_id & CAN_SFF_MASK;
        frame.is_extended = (cf.can_id & CAN_EFF_FLAG) != 0;
        if (frame.is_extended) frame.id = cf.can_id & CAN_EFF_MASK;
        frame.dlc = cf.can_dlc;
        memcpy(frame.data, cf.data, cf.dlc);
        return true;
    }
    // ...
};
```

**Windows (PCAN-Basic):**

```cpp
// can_pcan.cpp
#include "PCANBasic.h"

class PcanInterface : public ICanInterface {
    TPCANHandle handle_;
public:
    bool open(const std::string& channel, uint32_t bitrate) override {
        handle_ = PCAN_USBBUS1;
        TPCANBaudrate baud = PCAN_BAUD_250K;  // Map from bitrate
        return CAN_Initialize(handle_, baud) == PCAN_ERROR_OK;
    }

    bool send(const CanFrame& frame) override {
        TPCANMsg msg;
        msg.ID = frame.id;
        msg.LEN = frame.dlc;
        msg.MSGTYPE = frame.is_extended ? PCAN_MESSAGE_EXTENDED : PCAN_MESSAGE_STANDARD;
        memcpy(msg.DATA, frame.data, frame.dlc);
        return CAN_Write(handle_, &msg) == PCAN_ERROR_OK;
    }
    // ...
};
```

### 14.4 Factory Pattern for Platform Selection

```cpp
std::unique_ptr<ICanInterface> create_can_interface(const std::string& backend) {
#ifdef __linux__
    if (backend == "socketcan" || backend == "auto")
        return std::make_unique<SocketCanInterface>();
#endif
#ifdef _WIN32
    if (backend == "pcan" || backend == "auto")
        return std::make_unique<PcanInterface>();
    if (backend == "kvaser")
        return std::make_unique<KvaserInterface>();
#endif
    if (backend == "virtual")
        return std::make_unique<VirtualCanInterface>();  // In-process loopback

    throw std::runtime_error("Unsupported CAN backend: " + backend);
}
```

### 14.5 Existing Libraries

| Library | Language | Platforms | Notes |
|---------|----------|-----------|-------|
| **python-can** | Python | Linux, Windows, macOS | Most mature cross-platform CAN library; supports SocketCAN, PCAN, Kvaser, Vector, SLCAN |
| **libcan** | C/C++ | Linux, partial Windows | Lightweight, open-source |
| **embedded-comstack** | C++ | Embedded Linux, partial Windows | Targets embedded systems, includes CAN abstraction |
| **Qt SerialBus** | C++ (Qt) | Linux, Windows, macOS | Qt framework CAN support, includes SocketCAN and PEAK backends |

For ROS2-based autonomous vehicles, `python-can` (for prototyping/testing) or a custom C++ abstraction over SocketCAN (for production) are the most common choices. The `ros2socketcan_bridge` package provides the ROS2 integration layer on top of SocketCAN.

---

## 15. Aurrigo ADT3 Integration Considerations

### 15.1 CAN Bus Architecture for Airside Autonomous GSE

Based on the vehicle architecture described in Aurrigo's public materials and the general architecture of purpose-built autonomous GSE, the ADT3's CAN network likely follows this topology:

```
+------------------+
|  Auto-Stack ADS  |  (Main compute: perception, planning, control)
|  (Coventry stack)|
+--------+---------+
         |
    CAN Bus 1 (Vehicle Control)  --- 250 kbit/s or 500 kbit/s
    +----+----+----+----+
    |    |    |    |    |
  Steer Drive Brake BMS  Safety
  ECU   ECU   ECU  ECU   Controller
         |
    CAN Bus 2 (Sensor/Diagnostics) --- optional secondary bus
    +----+----+----+
    |    |    |    |
  IMU  Encoder  I/O
       Module  Module
```

### 15.2 Integration Points for World Model Enhancement

For the world models research initiative, the CAN interface provides several integration opportunities:

1. **State estimation ground truth:** CAN-reported wheel speeds, steering angle, and IMU data serve as ground truth for validating learned world model predictions of vehicle dynamics.

2. **Action representation:** CAN command messages (steering angle setpoint, velocity setpoint) define the action space for world model training. The DBC file formalizes the mapping between abstract actions and physical actuator commands.

3. **Latency measurement:** Comparing CAN command timestamps with CAN feedback timestamps quantifies the end-to-end latency of the DBW system -- a critical parameter for world model prediction horizons.

4. **Fault injection:** Virtual CAN interfaces allow injecting simulated faults (delayed messages, corrupted data, missing heartbeats) to test world model robustness to degraded vehicle state information.

5. **Shadow mode data collection:** A CAN logger can passively record all vehicle commands and feedback during manual or semi-autonomous operation, building a dataset of real vehicle dynamics for world model training.

### 15.3 4-Wheel Steering Dynamics

The Auto-DollyTug's 4-wheel steering with 360-degree tank turn and sideways drive presents unique challenges for world models:

- The standard bicycle kinematic model does not apply
- Each wheel's speed and angle are independent control variables
- Sideways and diagonal motion modes require an omnidirectional kinematic model
- The vehicle can transition between steering modes (normal, crab, tank turn) within a single maneuver

A world model for this vehicle must learn these multi-modal dynamics, which significantly differs from road vehicle world models trained on standard Ackermann-steered vehicles.

---

## References

### CAN Bus Fundamentals
- [CAN Bus Explained - CSS Electronics](https://www.csselectronics.com/pages/can-bus-simple-intro-tutorial)
- [CAN Bus - Wikipedia](https://en.wikipedia.org/wiki/CAN_bus)
- [CAN FD - Wikipedia](https://en.wikipedia.org/wiki/CAN_FD)
- [CAN and CAN FD Tutorial - Computer Solutions](https://www.computer-solutions.co.uk/info/Embedded_tutorials/can_tutorial.htm)
- [CAN Bus Message Frame Format - Copperhill Tech](https://copperhilltech.com/blog/controller-area-network-can-bus-tutorial-message-frame-format/)
- [CAN FD Frames - NI](https://www.ni.com/docs/en-US/bundle/ni-xnet/page/can-fd-frames.html)
- [CAN vs CAN FD - Influx Technology](https://www.influxtechnology.com/post/can-vs-can-fd-know-the-difference)
- [CAN FD - Grid Connect](https://www.gridconnect.com/blogs/news/can-fd-the-next-big-fast-thing)
- [CAN Bus Errors - CSS Electronics](https://www.csselectronics.com/pages/can-bus-errors-intro-tutorial)
- [CAN Error Handling - Kvaser](https://kvaser.com/lesson/can-error-handling/)
- [CAN Bit Timing - can-wiki.info](http://www.bittiming.can-wiki.info/)

### Drive-by-Wire
- [Drive-by-Wire Development Process Based on ROS - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7662766/)
- [Drive-by-Wire Conversion - Robotics Knowledgebase](https://roboticsknowledgebase.com/wiki/actuation/drive-by-wire/)
- [Safety & Redundancy in Drive-by-Wire - Arnold NextG](https://www.arnoldnextg.com/company/blog/safety-redundancy-why-drive-by-wire-must-be-fail-operational)
- [Drive-by-Wire Technology - Arnold NextG](https://www.arnoldnextg.com/technology/drive-by-wire)
- [Dataspeed ADAS By-Wire Kit](https://www.dataspeedinc.com/adas-by-wire-system/)
- [New Eagle Autonomous Machines](https://neweagle.net/autonomous-machines/)
- [Sygnal Safety-Critical DBW](https://levelfivesupplies.com/product/sygnal-safety-critical-drive-by-wire/)

### Aurrigo
- [Aurrigo Auto-DollyTug](https://aurrigo.com/auto-dollytug/)
- [Aurrigo Auto-Dolly](https://aurrigo.com/autodolly/)
- [Aurrigo Autonomous Products](https://aurrigo.com/products_1/)
- [Aurrigo Auto-Cargo Launch - The Engineer](https://www.theengineer.co.uk/content/news/aurrigo-unveils-autonomous-heavy-lift-vehicle)

### Roboteq Motor Controllers
- [Roboteq MDC1460 Product Page](https://www.roboteq.com/products/products-brushed-dc-motor-controllers/mdc1460-detail)
- [Roboteq CAN Networking Manual](https://www.generationrobots.com/media/roboteq/can-networking-manual.pdf)
- [Roboteq RPDO Motor Commands](https://roboteq.freshdesk.com/support/solutions/articles/70000651495-canopen-sending-motor-commands-using-rpdos)
- [Roboteq DS402 Implementation](https://cdn.robotshop.com/media/r/rob/rb-rob-108/pdf/roboteq-fim2360s-1x120a-60v-robot-controller-datasheet1.pdf)

### Hydraulic Steering
- [Danfoss EHi Electrohydraulic Steering](https://www.danfoss.com/en/products/dps/steering/electrohydraulic-steering/electrohydraulic-steering-valves/ehi/)
- [Danfoss Auto-Guided Steering](https://www.danfoss.com/en-us/markets/mobile-hydraulics/dps/steering/auto-guided-steering-system/)
- [Orbital Valve Information - Hydraulic Steering Unlimited](https://hydraulicsteeringunlimited.com/orbital-valves/orbital-valve-information/)

### SocketCAN
- [SocketCAN - Linux Kernel Documentation](https://docs.kernel.org/networking/can.html)
- [Example C SocketCAN Code - Beyond Logic](https://www.beyondlogic.org/example-c-socketcan-code/)
- [CAN-Examples GitHub](https://github.com/craigpeacock/CAN-Examples)
- [can-utils GitHub](https://github.com/linux-can/can-utils)
- [python-can Documentation](https://python-can.readthedocs.io/)

### ROS CAN Integration
- [ros2socketcan_bridge GitHub](https://github.com/GOFIRST-Robotics/ros2socketcan_bridge)
- [ros2_canopen GitHub](https://github.com/ros-industrial/ros2_canopen)
- [ros2_canopen Documentation](https://ros-industrial.github.io/ros2_canopen/manual/rolling/)
- [Getting Started with CANopen and ROS 2 - Robogility](https://www.robogility.co.uk/articles/getting-started-with-canopen-and-ros-2)

### DBC Files and Message Design
- [CAN DBC File Explained - CSS Electronics](https://www.csselectronics.com/pages/can-dbc-file-database-intro)
- [cantools Documentation](https://cantools.readthedocs.io/)
- [cantools GitHub](https://github.com/cantools/cantools)

### Steering PID Control
- [Steering PID Control - ResearchGate](https://www.researchgate.net/publication/320707841_The_Vehicle_Steer_by_Wire_Control_System_by_Implementing_PID_Controller)
- [PID Tuning for Self-Driving Cars - Medium](https://medium.com/@madhusudhan.d/tuning-pid-controller-for-self-driving-cars-3813f7f18eb0)
- [Dual-Layer Steer-by-Wire Control - Nature](https://www.nature.com/articles/s41598-024-79703-6)

### Functional Safety
- [ISO 26262 - Wikipedia](https://en.wikipedia.org/wiki/ISO_26262)
- [ASIL - Wikipedia](https://en.wikipedia.org/wiki/Automotive_Safety_Integrity_Level)
- [ISO 26262 Overview - Perforce](https://www.perforce.com/blog/qac/what-is-iso-26262)
- [Automotive Watchdog Timers - Analog Devices](https://www.analog.com/en/resources/design-notes/highvoltage-watchdog-timers-enhance-automotive-system-safety.html)

### Testing Tools
- [PEAK PCAN-USB](https://www.peak-system.com/products/hardware/external-pc-interfaces/pcan-usb/)
- [PEAK PCAN-USB FD](https://www.peak-system.com/products/hardware/external-pc-interfaces/pcan-usb-fd/)
- [Awesome CAN Bus Tools - GitHub](https://github.com/iDoka/awesome-canbus)
- [CAN Bus Packages and Tools Collection](https://gist.github.com/jackm/f33d6e3a023bfcc680ec3bfa7076e696)

### Vehicle State and IMU
- [CAN Bus IMU for Autonomous Vehicles - Aceinna](https://www.aceinna.com/publicationDetail?id=5d131cc409747645b939ebae)
- [IMU-Enhanced Wheel Odometry](https://daischsensor.com/imu-enhanced-wheel-odometry-robotics-navigation-technology/)
