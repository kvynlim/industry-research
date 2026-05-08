# RoboSense LiDAR Technical Report

## RSHELIOS and RSBP Models for Airside Autonomous Vehicle Operations

*Last updated: 2026-03-22*

---

## 1. Company Overview

### RoboSense Technology Co., Ltd.

**Founded:** 2014, Shenzhen, China

**Founders:** Qiu Chunxin (CEO, PhD from Harbin Institute of Technology on outdoor robotics perception), Zhu Xiaorui (Chief Scientist, PhD supervisor to Qiu), and Liu Letian (CTO, PhD peer).

**Stock Listing:** Listed on the Hong Kong Stock Exchange on **5 January 2024** under ticker **2498.HK** -- the first IPO on HKEX in 2024 and the first "laser radar stock" in the Hong Kong market. IPO raised HK$985.12 million (~US$126 million) by offering 22.9 million shares at HK$43 each. Initial market capitalisation exceeded HKD 19 billion, making RoboSense the world's largest LiDAR company by market value at the time.

**Key Investors:** Over 30 institutional investors including Cainiao (Alibaba's logistics arm, 10.46% pre-IPO stake), BYD, and Xiaomi.

**IPO Proceeds Allocation:** 45% R&D, 20% manufacturing/testing/verification, 20% sales/marketing, 15% partnerships and working capital.

**2024 Financial Performance:**
- Total revenue: ~RMB 1.65 billion (YoY +47.2%, three consecutive years of high growth)
- Total LiDAR units sold: ~544,000 (YoY +109.6%)
- Overall gross margin: ~17.2% (Q4 2024 gross margin: 22.1%)
- Adjusted net loss: RMB 396 million (YoY improvement of 8.9%)
- Global automotive LiDAR market share: **33.5%** (No. 1 globally per Gasgoo Research Institute)

**Milestone:** In February 2025, RoboSense rolled off its 1-millionth LiDAR unit (an E1R), becoming the first company globally to deliver 1 million high-resolution LiDAR units.

**Core Technology Differentiator:** First LiDAR company to build its own chip technology, including self-developed RISC-V data processing SoCs, digital large-area SPAD-SoCs, 2D addressable VCSELs, and 2D MEMS scanning devices.

---

## 2. RS-Helios 32-Channel Series (RSHELIOS)

The Helios series is the successor to the RS-LiDAR-32, offering 29% smaller form factor and 60% lower cost compared to the original RS-LiDAR-32.

### 2.1 Model Nomenclature

The Helios 32 model numbers encode the vertical FOV:
- **RS-Helios-5515** (a.k.a. Helios-32 F70): -55 deg to +15 deg = 70 deg total vertical FOV
- **RS-Helios-1615** (a.k.a. Helios-32 F31): -16 deg to +15 deg = 31 deg total vertical FOV
- **Helios-32 F26**: -16 deg to +10 deg = 26 deg total vertical FOV

### 2.2 Common Specifications (All Helios 32 Variants)

| Parameter | Specification |
|---|---|
| Channels | 32 |
| Wavelength | 905 nm |
| Laser Safety | Class 1 (IEC 60825-1), eye-safe |
| Horizontal FOV | 360 deg |
| Horizontal Angular Resolution | 0.1 deg / 0.2 deg / 0.4 deg (selectable) |
| Range | 150 m maximum; 90 m @ 10% NIST reflectivity |
| Near-Field Blind Spot | <= 0.2 m (5515 variant: <= 0.1 m) |
| Range Accuracy | +/-3 cm (0.1-1 m); +/-2 cm (1-100 m); +/-3 cm (100-150 m) |
| Point Rate (Single Return) | 576,000 pts/s |
| Point Rate (Dual Return) | 1,152,000 pts/s |
| Rotation Speed | 300 / 600 / 1200 rpm |
| Frame Rate | 5 / 10 / 20 Hz |
| Data Interface | 100Base-T1 Ethernet (automotive-grade) |
| Output Protocol | UDP packets (MSOP + DIFOP) |
| Input Voltage | 9-32 V DC |
| Power Consumption | 12 W |
| Dimensions | dia.100 mm x H 100 mm |
| Weight | ~1.0 kg (without cabling) |
| Operating Temperature | -40 deg C to +60 deg C |
| Storage Temperature | -40 deg C to +85 deg C |
| IP Rating | **IP67 and IP6K9K** |
| Return Modes | Single return, Dual return |

### 2.3 Variant-Specific Differences

| Parameter | Helios-5515 (F70) | Helios-1615 (F31) | Helios F26 |
|---|---|---|---|
| Vertical FOV | 70 deg (-55 to +15) | 31 deg (-16 to +15) | 26 deg (-16 to +10) |
| Vertical Angular Resolution | Up to 1.33 deg | 1.0 deg (uniform) | Up to 0.5 deg |
| Beam Distribution | Non-uniform (dense centre, sparse edges) | Uniform | Non-uniform (dense centre) |
| Primary Use Case | Near-field + blind-spot detection | Surveying, mapping, uniform coverage | Long-range perception, highest resolution |
| Near-Field Blind Spot | <= 0.1 m | <= 0.2 m | <= 0.2 m |

### 2.4 Beam Pattern Details

**Helios-5515 (F70):** Arranges dense laser beams in the middle of the 70 deg vertical FOV and sparse beams at both ends. The 55 deg downward tilt greatly reduces the near-field blind zone, making it ideal for low-speed autonomous vehicles that need to detect ground-level obstacles close to the vehicle.

**Helios-1615 (F31):** Uniform 1 deg vertical spacing across 31 deg. Provides consistent angular density, preferred for surveying and mapping applications where uniform point cloud density matters.

**Helios F26:** Highest vertical angular resolution at 0.5 deg within 26 deg FOV. Non-uniform distribution with denser beams concentrated in the central FOV region for maximum object discrimination at range.

### 2.5 Operating Modes

- **High-performance mode:** Full point rate at maximum rotation speed
- **Low power consumption mode:** Reduced rotation speed and power draw
- **Web configuration and monitoring:** Browser-based configuration interface
- **Multi-radar interference shielding:** Built-in protection against cross-talk from adjacent LiDAR units

---

## 3. RS-Bpearl (RSBP) 32-Channel Specifications

The RS-Bpearl is a hemispherical-FOV LiDAR designed specifically for near-field and blind-spot detection around autonomous vehicles and robots.

### 3.1 Specifications

| Parameter | Specification |
|---|---|
| Channels | 32 |
| Wavelength | 905 nm |
| Laser Safety | Class 1, eye-safe |
| Horizontal FOV | 360 deg |
| Vertical FOV | 90 deg (hemispherical) |
| Horizontal Angular Resolution | 0.2 deg (10 Hz) / 0.4 deg (20 Hz) |
| Vertical Distribution | Non-uniform (32 channels across 90 deg) |
| Range | 30 m @ 10% reflectivity |
| Near-Field Blind Spot | < 10 cm (~0 blind spot) |
| Range Accuracy | +/-3 cm (typical) |
| Point Rate (Single Return) | 576,000 pts/s |
| Point Rate (Dual Return) | 1,152,000 pts/s |
| Frame Rate | 10 / 20 Hz (600 / 1200 rpm) |
| Data Interface | 100 Mbps Ethernet |
| Input Voltage | 9-32 V DC |
| Power Consumption | ~13 W (typical) |
| Dimensions | dia.111 mm x H 100 mm |
| Weight | ~0.92 kg |
| Operating Temperature | -40 deg C to +60 deg C |
| Storage Temperature | -40 deg C to +85 deg C |
| IP Rating | IP67 |
| Return Modes | Single return, Dual return |

### 3.2 Key Differences: RSBP vs RSHELIOS

| Aspect | RS-Bpearl (RSBP) | RS-Helios (RSHELIOS) |
|---|---|---|
| **Role** | Near-field / blind-spot detection | Primary perception sensor |
| **Vertical FOV** | 90 deg (hemispherical) | 26-70 deg (forward-looking) |
| **Range** | 30 m | 150 m |
| **Accuracy** | +/-3 cm | +/-2 cm (1-100 m range) |
| **Use Case** | Ground obstacles, curbs, close pedestrians | Long-range object detection, path planning |
| **Mounting** | Typically roof-centre or bumper corners | Roof-top or mast-mounted |
| **Weight** | 0.92 kg | 1.0 kg |
| **Power** | ~13 W | 12 W |

The RSBP and RSHELIOS are complementary sensors. In autonomous vehicle deployments, the RSBP handles the immediate surround while the RSHELIOS provides the long-range forward/360 deg perception layer.

---

## 4. RS-LiDAR-M Series (MEMS Solid-State, ASIL-B)

### 4.1 Technology

The M series uses RoboSense's proprietary **2D MEMS smart scanner chips**, advancing from 1D mechanical scanning to 2D chip-based scanning. No motors, ball bearings, or wear surfaces exist in the optical path. This solid-state architecture enables:
- Lower cost at scale
- Higher reliability (no mechanical wear)
- Automotive-grade durability

### 4.2 M1 Plus Key Specifications

| Parameter | Specification |
|---|---|
| Range | 200 m max; 180 m @ 10% NIST |
| FOV | 120 deg (H) x 25 deg (V) |
| Angular Resolution | 0.2 deg x 0.1 deg (standard) |
| Smart GAZE ROI Resolution | 0.1 deg (V) in dynamically selected ROI |
| Point Rate (Dual Return) | Up to 1,575,000 pts/s |
| Input Voltage | 9-16 V |
| Power Consumption | 15 W |

### 4.3 Functional Safety: ASIL-B

RoboSense adheres strictly to **ISO 26262** safety standards for the M series:

- **Random hardware failure rate:** < 10^-7 /h (fully achieving ASIL-B requirements)
- **Functional safety level:** ASIL-B (also SIL-2 for industrial)
- Integrated fail-safe concepts from aerospace and rail transportation
- Safety mechanism covers thousands of failure modes across:
  - Laser emitter and receiver monitoring
  - MEMS control monitoring
  - Point cloud processing and transmitting monitoring

### 4.4 Automotive-Grade Certifications

- **MEMS mirror module:** AEC-Q100 certification (reliability test report by SGS)
- **Eye safety:** IEC 60825-1 Class 1 (certified by SGS and Goebel)
- **Automotive-grade test standards applied:**
  - ISO 16750 (road vehicle environmental testing)
  - GB/T18655-2010 / CISPR 25:2008 (EMC)
  - ISO 11452 (EMC component test)
  - ISO 7637 (electrical disturbances)
  - ISO 10605 (ESD)
  - IEC 60068 (environmental testing)

### 4.5 Reliability Test Data (M1 Platform)

| Test | Duration/Result |
|---|---|
| High-temperature durability | > 36,000 hours |
| High-humidity testing | > 24,000 hours |
| Cyclic temperature shock | > 21,000 hours |
| Cumulative test time (all samples) | > 300,000 hours |
| Longest continuous prototype operation | > 700 days |
| Total road test mileage | > 200,000 km |

### 4.6 M Series Product Range

- **M1:** Original solid-state MEMS LiDAR (SOP announced CES 2021)
- **M1 Plus:** Enhanced range (200 m) and Smart GAZE function
- **M2:** Mid-range, 200 m @ 10%, 0.1 deg x 0.1 deg ROI resolution
- **M3:** Next-generation variant
- **MX:** Extended variant

---

## 5. rslidar_sdk ROS/ROS2 Driver

### 5.1 Overview

The `rslidar_sdk` is the official ROS/ROS2 driver for all RoboSense LiDAR products. It wraps the core `rs_driver` library and provides standard ROS integration.

**Repository:** https://github.com/RoboSense-LiDAR/rslidar_sdk
**Latest Release:** v1.5.18 (15 July 2025), 560 commits, 12 contributors

### 5.2 Supported Models

The driver supports 18 LiDAR types via the `lidar_type` YAML parameter:

```
RS16, RS32, RSBP, RSAIRY, RSHELIOS, RSHELIOS_16P, RS128, RS80, RS48,
RSP128, RSP80, RSP48, RSM1, RSM1_JUMBO, RSM2, RSM3, RSE1, RSMX
```

### 5.3 ROS/ROS2 Compatibility

| Platform | ROS Version |
|---|---|
| Ubuntu 16.04 | ROS Kinetic |
| Ubuntu 18.04 | ROS Melodic / ROS2 Eloquent |
| Ubuntu 20.04 | ROS Noetic / ROS2 Galactic |
| Ubuntu 22.04 | ROS2 Humble |

### 5.4 PointCloud2 Fields: XYZIRT

The driver supports two point types, configured via `POINT_TYPE` in `CMakeLists.txt`:

**XYZI (basic):**
```cpp
struct PointXYZI {
  float x;      // metres
  float y;      // metres
  float z;      // metres
  uint8_t intensity;  // 0-255
};
```

**XYZIRT (full, recommended):**
```cpp
struct PointXYZIRT {
  float x;           // metres
  float y;           // metres
  float z;           // metres
  uint8_t intensity; // 0-255
  uint16_t ring;     // channel/beam ID (0-31 for 32ch sensors)
  double timestamp;  // per-point timestamp (seconds)
};
```

When published as ROS `sensor_msgs/PointCloud2`, the fields map to:
| Field | PointCloud2 Type | Offset |
|---|---|---|
| x | FLOAT32 | 0 |
| y | FLOAT32 | 4 |
| z | FLOAT32 | 8 |
| intensity | FLOAT32 (cast from uint8) | 12 |
| ring | UINT16 | 16 |
| timestamp | FLOAT64 | 18 |

The `ring` field is critical for algorithms that need per-beam processing (ground segmentation, beam-specific calibration). The `timestamp` field provides per-point timing for motion compensation during ego-motion.

### 5.5 Key Configuration Parameters (config.yaml)

```yaml
common:
  msg_source: 1                    # 1=online LiDAR, 2=ROS packet, 3=PCAP
  send_packet_ros: false
  send_point_cloud_ros: true

lidar:
  - driver:
      lidar_type: RSHELIOS         # LiDAR model identifier
      msop_port: 6699              # MSOP data port
      difop_port: 7788             # DIFOP status port
      min_distance: 0.2            # Minimum range filter (m)
      max_distance: 200.0          # Maximum range filter (m)
      use_lidar_clock: true        # Use LiDAR hardware clock vs host
      dense_points: false          # Exclude NaN points if true
      ts_first_point: true         # Timestamp = first point or last
      start_angle: 0               # Start angle of scan (deg)
      end_angle: 360               # End angle of scan (deg)
    ros:
      ros_frame_id: rslidar
      ros_send_point_cloud_topic: /rslidar_points
```

### 5.6 Dependencies

- `libyaml-cpp-dev` (>= 0.5.2)
- `libpcap-dev` (>= 1.7.4)
- PCL (included with ROS desktop-full)

### 5.7 Build and Launch

**ROS (catkin):**
```bash
cd ~/catkin_ws
catkin_make
source devel/setup.bash
roslaunch rslidar_sdk start.launch
```

**ROS2 (colcon):**
```bash
cd ~/ros2_ws
colcon build
source install/setup.bash
ros2 launch rslidar_sdk start.py
```

### 5.8 Velodyne Compatibility

An open-source tool `rs_to_velodyne` (https://github.com/HViktorTsoi/rs_to_velodyne) converts RoboSense point clouds to Velodyne format, enabling use of existing Velodyne-based perception pipelines without modification.

---

## 6. Time Synchronisation: PTP/gPTP

### 6.1 Supported Synchronisation Methods

RoboSense LiDAR supports multiple time synchronisation approaches:

| Method | Protocol Layer | Precision | Notes |
|---|---|---|---|
| **GPS/GNSS (PPS + GPRMC)** | Hardware pulse + serial | Microsecond-level | Industry standard, requires GPS antenna |
| **PTP (IEEE 1588)** | L2 Ethernet | Sub-microsecond | Lower cost than GPS, no antenna needed |
| **gPTP (IEEE 802.1AS)** | L2 Ethernet | Sub-microsecond | Requires hardware timestamp support |

### 6.2 PTP Implementation Details

- RoboSense PTP uses **L2 (Ethernet layer)** for communication
- Supports **Peer-to-Peer (P2P)** delay measurement mechanism
- PTP precision: sub-microsecond level
- gPTP shares the same Peer Delay Mechanism with PTP but has stricter hardware requirements (hardware timestamps mandatory)

### 6.3 Timestamp Architecture

- Timestamps stored in MSOP packet headers (bytes 21-30, within 42-byte header)
- Temporal resolution: microsecond-level (1 us theoretical minimum)
- Per-block timestamps at ~111 us granularity (at 600 RPM)
- `use_lidar_clock` parameter in rslidar_sdk selects between LiDAR hardware clock and host system clock

### 6.4 Synchronisation for Multi-Sensor Fusion

For airside AV deployments requiring camera-LiDAR-IMU fusion:
- PTP/gPTP over automotive Ethernet is the recommended approach (no GPS antenna required indoors/under jetways)
- PTP master clock should be the central compute unit or a dedicated grandmaster
- All sensors on the same PTP domain achieve sub-microsecond alignment
- The `timestamp` field in XYZIRT point clouds enables per-point motion compensation

---

## 7. Adverse Weather Performance

### 7.1 Built-In Weather Filtering

The Helios and Bpearl series include **Rain, Fog, Snow, and Dust Denoising** functions (available upon request / firmware configuration). These operate at the sensor firmware level to filter weather-related noise from the point cloud before transmission.

### 7.2 Dual-Return Mode for Weather

In dual-return mode, each laser pulse registers two range returns. This is critical in adverse weather:
- **First return:** May hit a raindrop, snowflake, or fog particle
- **Second return:** Penetrates to the actual surface behind the particle
- Enables downstream algorithms to identify and discard weather artifacts while retaining true object detections

### 7.3 Quantitative Weather Degradation (General 905 nm LiDAR)

| Condition | Typical Impact |
|---|---|
| Light rain (< 2.5 mm/h) | Minimal degradation, denoising effective |
| Heavy rain (> 7.5 mm/h) | Max detection range decreases ~30%, point density drops ~45% |
| Moderate fog (visibility 200-500 m) | Reduced range, increased noise |
| Dense fog (visibility < 200 m) | Significant range reduction, heavy noise |
| Moderate snow | Denoising maintains clear point cloud (validated at -23 deg C) |
| Dust | Addressed by denoising function |

### 7.4 Validated Cold-Weather Testing (M1)

RoboSense conducted the first cold-winter test of automotive-grade solid-state LiDAR in northeast China (Yakeshi, Inner Mongolia and Heihe, Heilongjiang):
- Temperature range: -18 deg C to -23 deg C
- Conditions: Low-visibility moderate snow, Level 4-5 northwest winds
- Result: "Reliable perception performance with clear and stable point cloud output"
- The RS-Helios series is rated to **-40 deg C** operating temperature, providing additional cold-weather margin

### 7.5 IP Protection Summary

| Model | IP Rating | Significance |
|---|---|---|
| RS-Helios 32 | IP67, IP6K9K | Dust-tight, submersion-proof, high-pressure jet wash |
| RS-Bpearl | IP67 | Dust-tight, submersion to 1 m for 30 min |
| RS-LiDAR-M1/M1+ | IP6K9K | Automotive-grade pressure-jet water resistance |

IP6K9K is particularly important for airside operations where vehicles are exposed to jet wash, de-icing fluid spray, and pressure cleaning.

---

## 8. Comparison: RoboSense Helios 32 vs Hesai XT32

| Parameter | RS-Helios-1615 (F31) | Hesai XT32 |
|---|---|---|
| **Channels** | 32 | 32 |
| **Wavelength** | 905 nm | 905 nm |
| **Range (max)** | 150 m | 120 m |
| **Range @ 10% NIST** | 90 m | 80 m |
| **Horizontal FOV** | 360 deg | 360 deg |
| **Vertical FOV** | 31 deg | 31 deg |
| **H Angular Resolution** | 0.1/0.2/0.4 deg | 0.18 deg |
| **V Angular Resolution** | 1.0 deg | 1.0 deg |
| **Point Rate (Single)** | 576,000 pts/s | 640,000 pts/s |
| **Range Accuracy** | +/-2 cm (1-100 m) | +/-1 cm |
| **Range Precision** | -- | 0.5 cm (1-sigma) |
| **Weight** | ~1.0 kg | ~0.8 kg |
| **Dimensions** | dia.100 x 100 mm | dia.76 x 103.2 mm |
| **Power Consumption** | 12 W | ~18 W (typical) |
| **Operating Temp** | -40 to +60 deg C | -20 to +40 deg C |
| **IP Rating** | IP67, IP6K9K | IP6K7 |
| **Data Interface** | 100Base-T1 | 100 Mbps Ethernet |
| **Design Lifespan** | Not published | > 30,000 hours (typical) |
| **Eye Safety** | Class 1 | Class 1 |
| **Dual Return** | Yes (1,152,000 pts/s) | Yes (1,280,000 pts/s) |
| **Weather Denoising** | Built-in firmware function | Not specified |
| **Near-Field Blind** | <= 0.2 m | 0.05 m |
| **Approx. Price** | ~US$1,800-2,700 | ~US$3,000-4,000 |

### 8.1 Key Advantages: RoboSense Helios

- **Wider operating temperature range** (-40 to +60 vs -20 to +40) -- critical for airside operations across seasons
- **Superior IP rating** (IP6K9K vs IP6K7) -- jet-wash and pressure-cleaning resilient
- **Greater range** (150 m vs 120 m max)
- **Lower power consumption** (12 W vs ~18 W)
- **Built-in weather denoising** in firmware
- **Multiple FOV variants** (26/31/70 deg) from same platform
- **Selectable horizontal resolution** (0.1/0.2/0.4 deg)
- **Lower cost** (~40-50% less expensive)

### 8.2 Key Advantages: Hesai XT32

- **Better range accuracy** (+/-1 cm vs +/-2 cm)
- **Higher point rate** in single return (640k vs 576k pts/s)
- **Lighter weight** (0.8 kg vs 1.0 kg)
- **Smaller diameter** (76 mm vs 100 mm)
- **Shorter near-field blind spot** (0.05 m vs 0.2 m)
- **Published design lifespan** (> 30,000 hours)

---

## 9. Reliability Data

### 9.1 Mechanical LiDAR (Helios/Bpearl)

RoboSense Helios and Bpearl are designed with reference to automotive-grade standards, with reliability tests covering:
- Mechanical shock
- Random vibration
- Low-temperature operation (-40 deg C)
- Water protection (IP67/IP6K9K)
- EMC (electromagnetic compatibility)

Specific MTBF figures for the Helios and Bpearl mechanical LiDAR units are not publicly disclosed. However, the automotive-grade design and testing regime implies reliability comparable to automotive-tier components.

### 9.2 Solid-State LiDAR (M Series)

The M platform has the most comprehensive published reliability data:
- **Random hardware failure rate:** < 10^-7 /h (ASIL-B compliant)
  - This equates to a theoretical MTBF > 10,000,000 hours
- **AEC-Q100** certification for MEMS mirror module
- **300,000+ hours** cumulative test time
- **700+ days** longest continuous operation of a single prototype
- **200,000+ km** total road test mileage
- Testing per ISO 16750, ISO 11452, ISO 7637, ISO 10605, IEC 60068

### 9.3 E1R Solid-State (Latest Generation)

- Passed over **60 rigorous reliability tests**
- Operating temperature: -40 to +85 deg C
- Vibration shock tolerance: up to **50 G**
- Fully solid-state (no moving parts) -- inherently longer lifespan

---

## 10. Optimal Airside Configuration

### 10.1 Airside Environment Characteristics

Airport airside environments present specific challenges:
- Wide open aprons with long sight-line requirements (> 100 m)
- Mixed traffic: aircraft, baggage tugs, fuel trucks, ground crew on foot
- Jet blast and jet wash exposure
- FOD (Foreign Object Debris) detection requirements at ground level
- All-weather operation (rain, snow, fog, extreme temperatures)
- GPS-denied areas under terminal buildings, jetways, and hangars
- High-vibration environments (vehicle traversing expansion joints, rough tarmac)
- Pressure washing and de-icing fluid exposure

### 10.2 Recommended Sensor Configuration

**Primary Perception Layer: 2x RS-Helios-1615 (F31)**
- Mount: Roof-top, front and rear facing
- Configuration: 31 deg vertical FOV with uniform 1 deg resolution
- Role: Long-range (150 m) 360 deg perception, path planning, obstacle detection
- Rationale: Uniform beam distribution preferred for consistent point cloud density at all ranges; 150 m range covers full apron crossing distances; -40 deg C rating handles all climatic conditions

**Near-Field / Blind-Spot Layer: 4x RS-Bpearl**
- Mount: Four corners of the vehicle (front-left, front-right, rear-left, rear-right), tilted slightly outward
- Configuration: 90 deg hemispherical FOV, < 10 cm blind spot
- Role: Ground-level obstacle detection, curb detection, FOD identification, close-proximity pedestrian safety
- Rationale: Hemispherical coverage eliminates blind spots around the vehicle; 30 m range sufficient for safety-critical close-range envelope

**Optional Forward Perception Enhancement: 1x RS-LiDAR-M1 Plus**
- Mount: Front-centre, forward-facing
- Configuration: 120 deg x 25 deg FOV, 200 m range, ASIL-B
- Role: Long-range forward detection on taxiways, enhanced resolution in ROI via Smart GAZE
- Rationale: ASIL-B functional safety for safety-critical forward detection; solid-state reliability in high-vibration environment

### 10.3 Configuration Parameters for Airside

**Horizontal Resolution:** Set to 0.2 deg for Helios units (optimal balance of point density and data bandwidth at 10 Hz frame rate).

**Frame Rate:** 10 Hz recommended. Provides adequate temporal resolution for low-speed airside vehicles (typically < 25 km/h) while keeping data bandwidth manageable.

**Dual-Return Mode:** Enable for all sensors. Critical for adverse weather operations -- dual return allows perception algorithms to see through rain, snow, and dust.

**Weather Denoising:** Enable firmware-level rain/fog/snow/dust denoising on all Helios and Bpearl units.

**Time Synchronisation:** Use PTP over the automotive Ethernet backbone. PTP is preferred over GPS for airside because:
- GPS signals may be occluded under terminal buildings, jetways, and inside hangars
- PTP provides sub-microsecond synchronisation without antenna placement constraints
- All sensors share the same PTP domain via the vehicle Ethernet switch

**rslidar_sdk Configuration:**
- Set `use_lidar_clock: true` to use hardware-synchronised timestamps
- Set `dense_points: true` to exclude NaN points, reducing downstream processing load
- Use XYZIRT point type for full per-point ring and timestamp data
- Set `min_distance` to 0.2 m for Helios, 0.1 m for Bpearl

### 10.4 Data Architecture

Total sensor data budget (recommended configuration):

| Sensor | Count | Points/s (Dual Return) | Total |
|---|---|---|---|
| RS-Helios-1615 | 2 | 1,152,000 | 2,304,000 |
| RS-Bpearl | 4 | 1,152,000 | 4,608,000 |
| RS-LiDAR-M1 Plus | 1 | 1,575,000 | 1,575,000 |
| **Total** | **7** | | **~8.5 M pts/s** |

Each XYZIRT point = 26 bytes, so total raw bandwidth = ~221 MB/s. This is well within the capacity of a GbE backbone with dedicated VLAN per sensor.

### 10.5 Mounting and Environmental Considerations

- **IP6K9K** rating on the Helios units means they survive airside pressure-washing operations without removal or bagging
- The 905 nm wavelength is eye-safe at Class 1, important for operations around ground crew and passengers
- 9-32 V input range accommodates both 12 V and 24 V vehicle electrical systems common in ground support equipment
- At ~1 kg per Helios and ~0.92 kg per Bpearl, total LiDAR weight for the 7-sensor configuration is approximately 5.7 kg -- negligible for a ground vehicle

---

## 11. Additional RoboSense Product Lines (Reference)

### E1R (Solid-State, Robotics)
- 120 deg x 90 deg ultra-wide FOV
- 30 m @ 10% range, 75 m max
- 144-beam, 260,000 pts/s (single) / 520,000 pts/s (dual)
- 0.625 deg angular resolution
- Digital SPAD-SoC + 2D VCSEL chips
- -40 to +85 deg C operating
- 50 G vibration shock
- 69.5 x 95 x 43 mm, very compact

### EM4 (Thousand-Beam Digital LiDAR)
- Integrates SPAD-SoC with 1080-Core LEP (LiDAR Echo Processing)
- Proprietary "Large Echo Processing Model" (Huiyan AI Model)
- AI-trained noise reduction for rain, fog, and dust
- Next-generation digital architecture

---

## Sources

- [RoboSense IPO Announcement](https://ir.robosense.ai/2024-01-05-RoboSense-Successfully-Listed-on-Hong-Kong-Stock-Exchange)
- [RoboSense 2024 Annual Results](https://www.robosense.ai/en/news-show-1886)
- [CNBC: RoboSense IPO Debut](https://www.cnbc.com/2024/01/05/robosense-technology-ipo-debuts-in-hong-kong-the-first-in-2024-.html)
- [SCMP: RoboSense Trading Debut](https://www.scmp.com/business/banking-finance/article/3247378/hong-kongs-first-ipo-year-makes-weak-trading-debut-robosense-technology-shares-drop-tepid-market)
- [RoboSense Helios Product Page](https://www.robosense.ai/en/IncrementalComponents/Helios)
- [RS-Helios-32 Specs (InDro Robotics)](https://store.indrorobotics.com/products/rs-helios-32-lidar)
- [RS-Helios Variants (AdvantaBuy)](https://www.advantabuy.com/products/rs-helios-5515-1615-robosense-solid-state-lidar-32beam)
- [RoboSense Bpearl Product Page](https://www.robosense.ai/en/rslidar/Bpearl)
- [RS-Bpearl Specs (Generation Robots)](https://www.generationrobots.com/en/403497-robosense-rs-bpearl-360-x-90-3d-laser-range-finder.html)
- [RoboSense M Series / ASIL-B](https://www.robosense.ai/en/rslidar/RS-LiDAR-M1)
- [RoboSense M1 Winter Testing](https://www.robosense.ai/en/news-show-1479)
- [rslidar_sdk GitHub Repository](https://github.com/RoboSense-LiDAR/rslidar_sdk)
- [rslidar_sdk Point Type Documentation](https://github.com/RoboSense-LiDAR/rslidar_sdk/blob/main/doc/howto/05_how_to_change_point_type.md)
- [rslidar_sdk Parameter Documentation](https://docs.ros.org/en/jazzy/p/rslidar_sdk/doc/intro/02_parameter_intro.html)
- [RoboSense PTP/GPS Sync FAQ](https://store.robosense.ai/pages/faq-hardware-lidar-time-synchronization-gps-ptp)
- [RoboSense Timestamp Mechanism Analysis](https://www.oreateai.com/blog/indepth-analysis-of-the-timestamp-mechanism-in-robosense-lidar/11c368c10e059304d78d94569963af3c)
- [Hesai XT32 Product Page](https://www.hesaitech.com/product/xt16-32-32m/)
- [Hesai XT32M2X Specs (Epotronic)](https://epotronic.com/eng/HESAI-XT32M2X-High-Precision-3600-x-40.30-Mid-Range-80-m-LiDAR-Sensor-32-Channels/HXT003)
- [RoboSense E1R Product Page](https://www.robosense.ai/en/IncrementalComponents/E1R)
- [TechInsights RS-Helios Teardown](https://electronics360.globalspec.com/article/18208/techinsights-teardown-robosense-lidar-rs-helios)
- [Ouster vs RoboSense Comparison (Generation Robots)](https://www.generationrobots.com/blog/en/ouster-vs-robosense-which-brand-of-3d-lidar-to-choose/)
- [RoboSense Store: Helios Series](https://store.robosense.ai/products/helios-series)
