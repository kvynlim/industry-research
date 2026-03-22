# Hesai Technology LiDAR Sensors: Deep Technical Research Report

*Last updated: 2026-03-22*

---

## 1. Company Overview

### Background

Hesai Technology (NASDAQ: HSAI, HKEX: 02525.HK) is a Shanghai-headquartered LiDAR sensor company founded in 2014 by Yifan "David" Li, Kai Sun, and Shaoqing Xiang. The company designs and manufactures LiDAR products for ADAS, autonomous driving, robotics, and industrial applications. Hesai operates offices in Shanghai, Palo Alto, and Stuttgart, with customers spanning more than 40 countries and a workforce of 1,000-5,000 employees.

### IPO and Capital Markets

- **NASDAQ IPO:** February 2023, raising US$190 million
- **Hong Kong Secondary Listing:** September 2025, raising US$614 million (HKEX: 02525.HK)
- **Market Capitalization:** ~US$3.0 billion (as of early 2026)
- **Enterprise Value:** ~US$2.1 billion

### Unit Shipments and Scale

| Metric | Value |
|--------|-------|
| Cumulative deliveries (all-time) | 2,000,000+ units |
| 2025 full-year deliveries | ~1,600,000 units |
| 2025 ADAS units | ~1,400,000 |
| 2025 Robotics units | 200,000+ |
| Q3 2025 quarterly units | 441,398 |
| AT128 cumulative (as of Q2 2024) | 380,000+ units |
| Monthly peak production | 200,000+ units |
| Production cycle time | 10 seconds per unit |

Hesai became the world's first LiDAR pure-play to achieve profitability (2024) and the first to surpass 1 million cumulative units produced (2025). Full-year 2025 represented the fifth consecutive year of doubled annual shipments.

### Financial Performance (TTM, early 2026)

| Metric | Value |
|--------|-------|
| Revenue | US$380.9M |
| Gross Margin | 41.4% |
| Operating Margin | 6.3% |
| Net Margin | -3.7% |
| Total Cash | US$360.6M |
| Debt/Equity | 0.11 |
| Q3 2025 GAAP Net Income | RMB 256M (record) |

### Market Position

- **Global ADAS LiDAR revenue share:** ~33% (2024)
- **Long-range ADAS segment:** ~40% market share
- **Robotaxi LiDAR segment:** 60-70% market share
- **Design wins:** 24 automotive OEMs, 120+ vehicle models
- **OEM partners:** Li Auto, Xiaomi, Changan, Geely, Zeekr, Great Wall Motors, BYD, and five major joint ventures (Volkswagen, GM, Audi, Toyota, Ford)
- **Robotics partners:** Pony.ai, Hello Inc, JD Logistics, DREAME, Vbot, MOVIN
- **IP Leadership:** Largest patent portfolio among LiDAR pure-play companies as of 2025

---

## 2. Full Product Line

Hesai's product portfolio spans ADAS, autonomous driving, robotics, and industrial applications. Below is the complete current product matrix.

### 2.1 ADAS / Automotive Long-Range

#### AT128 -- Automotive-Grade 120-deg Long-Range LiDAR

The AT128 is Hesai's mass-market ADAS LiDAR and the company's first integrated-architecture product. It was the volume workhorse through 2024-2025.

| Parameter | Value |
|-----------|-------|
| Channels | 128 |
| Pixel Resolution | 1200 x 128 |
| FOV | 120 deg (H) x 25.4 deg (V) |
| Angular Resolution | 0.1 deg (H) x 0.2 deg (V) |
| Range (@10% reflectivity) | 210 m |
| Point Rate (single return) | 1,536,000 pts/s |
| Power Consumption | 13.5 W |
| Dimensions | 136 x 114 x 49 mm (W x D x H) |
| Weight | 940 g |
| Eye Safety | Class 1 |
| Wavelength | 905 nm |
| IP Rating | IP6K7 / IP6K9K |
| Functional Safety | ISO 26262 ASIL B product certification |
| Cybersecurity | ISO 21434 compliant process |
| Designed Lifetime | 30,000+ hours |

**Reliability validation:** UV aging, high-temperature, mechanical shock, salt spray, thermal shock with water splash, low-temperature wakeup, humid heat cycling, vibration with thermal cycling, IP6K7/IP6K9K dust resistance.

**Key deployments:** Li Auto L-series, Pony.ai 7th-gen robotaxis (4x AT128 per vehicle), JiDU, HiPhi, Lotus.

#### ATX -- Next-Generation Compact 120-deg Long-Range LiDAR

The ATX is the successor to the AT128, featuring the FMC500 SoC and Photon Isolation technology. Mass production deliveries begin April 2026.

| Parameter | ATX | ATXP (Flagship) |
|-----------|-----|-----------------|
| Channels | 192 | 256 |
| FOV | 120 deg (H) x 18.3 deg (V) | 120 deg (H) x 20 deg (V) |
| Angular Resolution | 0.08 deg (H) x 0.1 deg (V) | 0.08 deg (H) x 0.05 deg (V) |
| Range (@10% reflectivity) | 200 m | 230 m |
| Point Rate (single return) | 1,740,000 pts/s | 3,840,000 pts/s |
| Power Consumption | 10 W | 8 W |
| Dimensions | 102 x 102 x 30 mm (W x D x H) | 102 x 102 x 30 mm |
| Weight | 360 g | 360 g |
| IP Rating | IP6K7 / IP6K9K | IP6K7 / IP6K9K |
| Functional Safety | ISO 26262 ASIL B | ISO 26262 ASIL B |
| Noise Filtering | 99.9% (IPE) | 99.9% (IPE) |

Key improvements over AT128: 60% smaller by volume, 25mm minimum window height, equipped with Hesai's Fermi C500 SoC, built-in rain/fog identification with pixel-level marking. Order backlog exceeds 4 million units.

#### ET25 -- Ultra-Thin Behind-Windshield Long-Range LiDAR

| Parameter | Value |
|-----------|-------|
| FOV | 120 deg (H) x 25 deg (V) |
| Angular Resolution | 0.05 deg (H) x 0.05 deg (V) |
| Range (without windshield) | 250 m (@10% reflectivity) |
| Range (behind windshield) | 225 m |
| Point Rate | 3,000,000+ pts/s |
| Power Consumption | 12 W |
| Height | 25 mm |
| Wavelength | 905 nm |
| Eye Safety | Class 1 |

Designed for in-cabin placement behind the windshield. FAW Hongqi adopted the ET25 for production vehicles.

#### ETX -- Ultra-Long-Range Behind-Windshield LiDAR (Next-Gen L3)

The ETX is Hesai's next-generation flagship long-range sensor, featuring 800 channels and the world's first fully in-house digital single-photon platform.

| Parameter | Value |
|-----------|-------|
| Channels | 800 |
| FOV | 120 deg (H) x 20 deg (V) |
| Angular Resolution | 0.05 deg (H) x 0.025 deg (V) |
| Range (@10% reflectivity) | 400 m |
| Point Rate (single return) | 5,600,000 pts/s |
| Resolution vs AT128 | 8x higher |
| Power Consumption | 11 W |
| Dimensions | 137 x 120 x 36 mm (window height 32 mm) |
| Weight | 600 g |
| Operating Temperature | -40 deg C to +85 deg C |
| Noise Level | <= 25 dB(A) |
| IP Rating | IP6K7 / IP6K9K |
| Eye Safety | Class 1 |
| Standards | ISO 26262, ISO 21434, ISO 21448 compliant |

Mass production planned for late 2026 or early 2027. First passenger-vehicle series-production program secured.

### 2.2 Short-Range / Blind-Spot Detection

#### FT120 -- Fully Solid-State Blind-Spot LiDAR

| Parameter | Value |
|-----------|-------|
| Architecture | Fully solid-state (no moving parts) |
| FOV | 100 deg (H) x 75 deg (V) |
| Pixel Resolution | 160 (H) x 120 (V) |
| Angular Resolution | 0.625 deg (H) x 0.625 deg (V) |
| Range | 100 m max |
| Point Rate (single return) | 192,000 pts/s |
| Point Rate (dual return) | 384,000 pts/s |
| Frame Rate | 10 Hz |
| Minimum Window Size | 70 x 50 mm |
| Wavelength | 905 nm |
| Eye Safety | Class 1 |

Designed for fender, grille, or bumper integration. Targets ADAS blind-spot coverage.

#### FTX -- Next-Generation Fully Solid-State Short-Range LiDAR

| Parameter | FTX-180 | FTX-140 |
|-----------|---------|---------|
| FOV | 180 deg (H) x 140 deg (V) | 140 deg (H) x 105 deg (V) |
| Angular Resolution | 0.62 deg (finest) | 0.56 deg (H) x 0.56 deg (V) |
| Pixel Resolution | 216 x 192 | 256 x 192 |
| Range (@10% reflectivity) | 20 m | 30 m |
| Point Rate (single return) | 430,000 pts/s | 492,000 pts/s |
| Scanning Frequency | 10 Hz | 10 Hz |
| Dimensions | 55 x 60 x 38.7 mm | 55 x 60 x 32 mm |
| Weight | ~160 g | ~160 g |
| Power Consumption | <6 W | <6 W |
| IP Rating | IP6K7 / IP6K9K | IP6K7 / IP6K9K |
| Eye Safety | Class 1 | Class 1 |

The FTX holds the world's largest FOV for an automotive-grade solid-state LiDAR (180 x 140 deg). 66% lighter than the FT120. Pairs with ETX as Hesai's "Infinity Eye B" L3 perception solution. Mass production planned for 2026.

#### QT128 -- 360-deg Ultra-Wide-View Short-Range LiDAR

| Parameter | Value |
|-----------|-------|
| Channels | 128 |
| FOV | 360 deg (H) x 105 deg (V) |
| Angular Resolution | 0.4 deg (H) x 0.4 deg (V) |
| Range (@10% reflectivity) | 20 m |
| Range Accuracy | +/-3 cm |
| Point Rate (single return) | 1,152,000 pts/s |
| Dimensions | 87 mm diameter x 83.9 mm height |
| Weight | ~700 g |
| Power Consumption | 12 W |
| Operating Temperature | -40 deg C to +85 deg C |
| IP Rating | IP6K7 / IP6K9K |
| Functional Safety | ISO 26262 ASIL B |
| Eye Safety | Class 1 |

Passed 50+ DV tests per international OEM standards. Provides high-quality reflectivity data for enhanced object recognition.

### 2.3 Mid-Range Mechanical (360-deg Spinning)

#### XT32 -- 32-Channel High-Precision Mid-Range LiDAR

| Parameter | Value |
|-----------|-------|
| Channels | 32 |
| FOV | 360 deg (H) x 31 deg (V) |
| Angular Resolution | 0.18 deg (H) x 1.0 deg (V) |
| Range | 0.05 - 120 m |
| Range Precision | 0.5 cm (1-sigma) |
| Range Accuracy | +/-1 cm |
| Point Rate (single return) | 640,000 pts/s |
| Point Rate (dual return) | 1,280,000 pts/s |
| Frame Rate | 5 / 10 / 20 Hz |
| Return Modes | Last, Strongest, Dual |
| Wavelength | 905 nm |
| Dimensions | 76 mm diameter x 103.2 mm height |
| Weight | 800 g |
| Power Consumption | <30 W peak (typical ~15 W) |
| Operating Temperature | -20 deg C to +60 deg C |
| Interface | 100 Mbps Ethernet (UDP/IP) |
| IP Rating | IP6K7 |
| Eye Safety | Class 1 |
| Designed Lifetime | 30,000+ hours |
| Minimum Range | 0.05 m (effectively zero) |

The XT32 is widely used for drone LiDAR, mobile mapping, surveying, precision agriculture, mining, and AV development. Continuously outputs valid point cloud data even when objects directly touch the sensor.

#### XT32M (XT32M2X) -- Extended Mid-Range Variant

| Parameter | Value |
|-----------|-------|
| Channels | 32 |
| FOV | 360 deg (H) x 40.3 deg (V) |
| Angular Resolution | 0.09 deg (H) x 1.3 deg (V) |
| Range (@10% reflectivity) | 80 m (300 m max) |
| Range Precision | 0.5 cm (1-sigma) |
| Range Accuracy | +/-1 cm |
| Point Rate (single return) | 640,000 pts/s |
| Point Rate (dual return) | 1,280,000 pts/s |
| Point Rate (triple return) | 1,920,000 pts/s |
| Frame Rate | 5 / 10 / 20 Hz |
| Wavelength | 905 nm |
| Power Consumption | 10 W |
| Operating Temperature | -20 deg C to +60 deg C |
| Dimensions | 75 mm diameter x 93 mm height |
| Weight | 490 g |
| Eye Safety | Class 1 |

#### XT16 -- 16-Channel Economy Mid-Range

| Parameter | Value |
|-----------|-------|
| Channels | 16 |
| FOV | 360 deg (H) x 30 deg (V) |
| Angular Resolution | 0.18 deg (H) x 2.0 deg (V) |
| Range | 0.05 - 120 m |
| Point Rate (single return) | 320,000 pts/s |
| Dimensions | 76 mm diameter x 103.2 mm height |
| Weight | 800 g |

### 2.4 360-deg Long-Range (Robotaxi / L4)

#### OT128 -- Automotive-Grade 360-deg Long-Range LiDAR

| Parameter | Value |
|-----------|-------|
| Channels | 128 |
| FOV | 360 deg (H) x 40 deg (V) |
| Angular Resolution | 0.1 deg (H) x 0.125 deg (V) |
| Range (@10% reflectivity) | 200 m (230 m max) |
| Range Accuracy | +/-3 cm |
| Point Rate (single return) | 3,456,000 pts/s |
| Point Rate (dual return) | 6,912,000 pts/s |
| Power Consumption | 29 W |
| Dimensions | 118 mm diameter x 132.3 mm height |
| IP Rating | IP6K7 / IP6K9K |
| Designed Lifetime | 30,000+ hours (3x industry average) |
| Eye Safety | Class 1 |
| Standards | ISO 26262, ISO 21434 compliant |

66% fewer parts than predecessor. Production time reduced by 95% via automated manufacturing. Built-in Intelligent Point Cloud Engine (IPE) for rain/fog/exhaust/water splash detection with pixel-level marking.

#### Pandar128 (Legacy)

| Parameter | Value |
|-----------|-------|
| Channels | 128 |
| Designed Lifetime | 30,000+ hours |
| Certification | ASIL B |

The Pandar128 was Hesai's flagship 360-deg spinning LiDAR prior to the OT128. Still supported but effectively superseded.

### 2.5 Robotics

#### JT16 -- Mini 360-deg 3D LiDAR for Robotics

| Parameter | Value |
|-----------|-------|
| FOV | 360 deg (H) x 40 deg (V) |
| Angular Resolution | 0.6 deg (H) x 2.67 deg (V) |
| Range (@10% reflectivity) | 30 m (100 m max) |
| Scanning Frequency | 5 / 10 Hz |
| Power Consumption | 4.3 W |
| Dimensions | 55 mm diameter x 64 mm height |
| Weight | <200 g |
| Built-in IMU | Yes |
| IP Rating | IP6K7 / IP6K9K |
| Eye Safety | Class 1 |

70% smaller in volume than similar products. Built-in waveform processing for cover lens contamination detection. Cumulative deliveries exceeded 200,000 units. Used in lawn-mowing robots, humanoid robots, AMRs, and 3D digitalization devices.

#### JT128 -- Higher-Resolution Robotics LiDAR

128-channel variant of the JT series for robotics applications requiring denser point clouds. Range up to 60 m.

### 2.6 Legacy Products

| Product | Channels | Range | Status |
|---------|----------|-------|--------|
| Pandar40P | 40 | 200 m (@10%) | Supported, effectively superseded |
| Pandar40M | 40 | — | Supported, effectively superseded |
| Pandar64 | 64 | 200 m (@10%) | Supported, effectively superseded |
| Pandar20A/20B | 20 | — | Supported, effectively superseded |
| PandarQT | 64 | — | Superseded by QT128 |

---

## 3. XT32 Deep Specifications

The XT32 (originally launched as PandarXT-32) is particularly relevant for AV development, drone mapping, and mobile sensing platforms. This section consolidates all known specifications.

### 3.1 Optical and Sensing

| Parameter | Value |
|-----------|-------|
| Laser Wavelength | 905 nm |
| Channels | 32 |
| Eye Safety | Class 1 (IEC 60825-1) |
| Ranging Principle | Time-of-Flight (ToF) |
| Measurement Range | 0.05 m to 120 m |
| Minimum Detection Range | 0.05 m (near-zero; valid data output on contact) |
| Range Precision | 0.5 cm (1-sigma, typical) |
| Range Accuracy | +/-1 cm |

### 3.2 Field of View and Resolution

| Parameter | Value |
|-----------|-------|
| Horizontal FOV | 360 deg |
| Vertical FOV | 31 deg |
| Horizontal Angular Resolution | 0.18 deg |
| Vertical Angular Resolution | 1.0 deg |
| Vertical Channel Distribution | Non-uniform (denser near horizon) |

### 3.3 Data Output

| Parameter | Value |
|-----------|-------|
| Point Rate (single return) | 640,000 pts/s |
| Point Rate (dual return) | 1,280,000 pts/s |
| Frame Rate Options | 5 Hz, 10 Hz, 20 Hz |
| Default Spin Rate | 600 RPM (= 10 Hz) |
| Return Modes | Last Return, Strongest Return, Dual Return |
| Data Interface | 100 Mbps Ethernet (UDP/IP) |
| Output Packets | Point Cloud Data Packets + GPS Data Packets |
| GPS Synchronization | Supported (PPS + NMEA) |

### 3.4 Mechanical and Electrical

| Parameter | Value |
|-----------|-------|
| Dimensions | 76 mm diameter x 103.2 mm height |
| Weight | 800 g |
| Power Consumption (peak) | <30 W (all operating conditions) |
| Power Consumption (typical) | ~15 W (may sustain 15 W in cold-start below 0 deg C) |
| Operating Temperature | -20 deg C to +60 deg C |
| Storage Temperature | -40 deg C to +85 deg C (typical for Hesai products) |
| IP Rating | IP6K7 |
| Connector | Ethernet + power multi-pin |

### 3.5 ASIC Integration

The XT32 was the first Hesai product to feature self-developed proprietary LiDAR ASICs, integrating laser driver, analog front-end, and waveform processing into custom silicon. This was a key differentiator at launch that reduced BOM cost and improved signal-to-noise ratio.

### 3.6 Use Cases

- Airport airside autonomous vehicle development and testing
- Drone-based aerial surveying and mapping
- Mobile laser scanning (MLS)
- Construction volumetrics and site surveying
- Precision agriculture and forestry
- Mining operations
- Robotics development platforms
- Ground-truth data collection

---

## 4. AT128 ASIL-B Certification

### ISO 26262 Functional Safety

The AT128 has achieved **ISO 26262 ASIL B (Automotive Safety Integrity Level B) product certification**, verified by SGS-TUV. This covers:

- **Product-level certification:** The AT128 hardware and firmware meet ASIL B requirements for systematic and random hardware faults
- **Development process compliance:** The development process follows ISO 26262 requirements from concept through production
- **ISO 21434 cybersecurity:** Compliant development process for automotive cybersecurity

### What ASIL B Means for Integration

ASIL B is the second level of the four-tier automotive safety classification (A through D). For LiDAR sensors in ADAS applications:

- Suitable for L2/L2+ ADAS functions where the LiDAR provides redundant perception alongside cameras and radar
- Supports Highway Pilot, Traffic Jam Pilot, and similar highway-centric functions
- Appropriate for sensor fusion architectures where no single sensor is the sole safety-critical path
- For L3+ applications requiring ASIL D system-level compliance, the LiDAR at ASIL B can be paired with ASIL B camera/radar in a complementary decomposition

### Other Hesai Products with ASIL B

- **ATX:** ISO 26262 ASIL B certified (via SGS-TUV)
- **QT128:** ISO 26262 ASIL B certified
- **FMC500 chip:** World's first LiDAR SoC with on-chip functional safety and cybersecurity certification

---

## 5. Core Technology

### 5.1 Wavelength: 905 nm

All Hesai production LiDAR sensors use **905 nm** laser wavelength. This is a deliberate architectural choice with the following tradeoffs:

**Advantages of 905 nm:**
- Mature semiconductor laser technology with high electro-optical conversion efficiency
- Lower component cost (silicon-based detectors, standard semiconductor processes)
- Proven supply chain for high-volume automotive manufacturing
- Less fiber coupling and amplification required versus 1550 nm fiber lasers
- Compatible with both APD and SiPM/SPAD detector technologies

**Tradeoffs vs 1550 nm:**
- 1550 nm allows ~40x higher laser power within eye safety limits (IEC 60825-1)
- 1550 nm exhibits less atmospheric scattering and absorption
- 1550 nm is better suited for FMCW architectures due to greater coherence
- However, 1550 nm requires expensive InGaAs detectors and fiber laser sources
- 1550 nm manufacturing is significantly more complex for volume production

Hesai's position is that 905 nm, combined with advanced SiPM detectors and proprietary signal processing (FMC500 chip), achieves competitive range (200-400 m @10%) while maintaining cost and manufacturing advantages critical for mass-market ADAS deployment.

### 5.2 Detection Technology: Time-of-Flight (ToF)

All current Hesai products use **direct Time-of-Flight** measurement:

- Laser pulse emitted, reflected off target, return time measured
- Distance = (speed of light x round-trip time) / 2
- Hesai uses single-photon detectors (SiPM/SPAD arrays) that generate effective data signals with just a few photons
- Custom ASICs (4 generations) handle waveform processing and timing

**ToF vs FMCW:**

| Characteristic | ToF (Hesai) | FMCW |
|----------------|-------------|------|
| Measurement | Distance only | Distance + instantaneous velocity |
| Ambient light immunity | Moderate (improved by IPE) | High (coherent detection) |
| Signal processing | Simpler | More complex |
| Manufacturing maturity | Production-ready, millions shipped | Pre-production / early production |
| Cost | Lower | Higher |
| Anti-interference | Good (with Photon Isolation) | Excellent (coherent detection) |

### 5.3 Proprietary Technologies

#### Intelligent Point Cloud Engine (IPE)

The IPE is Hesai's on-chip signal processing pipeline that:
- Filters out 99.9% of environmental noise (rain, fog, dust, exhaust)
- Detects and marks rain, fog, exhaust fumes, and water splashes at pixel level
- Enables real-time environmental classification within the sensor itself
- Runs on the FMC500 SoC

#### Photon Isolation Technology

Ensures that photons received by each laser channel do not interfere with adjacent channels. Key properties:
- Channel count is 10x that of traditional SPAD solutions
- Suppresses "ghosting" artifacts
- Enhances safety margins for autonomous driving applications
- Integrated across ATX and ETX product lines

#### FMC500 SoC

Hesai's 4th-generation custom chip, built on RISC-V architecture:
- Integrates MCU, FPGA, and ADC on a single die
- 256-core waveform processing engine
- World's first LiDAR master control chip with dual functional safety + cybersecurity certification
- Intelligent noise filtering adaptive to complex weather conditions
- Powers the ATX and ETX product lines

### 5.4 Scanning Architectures

| Architecture | Products | Mechanism |
|--------------|----------|-----------|
| Hybrid solid-state (rotating prism) | AT128, ATX, ET25, ETX | Internal rotating mirror/prism, no external rotation |
| Mechanical spinning (360 deg) | XT32, XT16, OT128, QT128, JT16 | Full rotary assembly |
| Fully solid-state (flash/OPA) | FT120, FTX | No moving parts, electronic beam steering |

---

## 6. Point Cloud Format and ROS Driver

### 6.1 Point Cloud Data Structure

Hesai LiDAR sensors output point cloud data via UDP packets over Ethernet. The core point data structure is `LidarPointXYZICRTT`:

| Field | Type | Description |
|-------|------|-------------|
| x | float32 | X coordinate (meters) |
| y | float32 | Y coordinate (meters) |
| z | float32 | Z coordinate (meters) |
| intensity | uint8/float32 | Reflectivity / return intensity |
| channel | uint16 | Laser channel ID (also called ring, laser_id) |
| ring | uint16 | Vertical channel index |
| timestamp | float64 | Per-point timestamp (seconds + nanoseconds) |
| return_type | uint8 | Return type indicator (last, strongest, etc.) |

**Timestamp composition:**
- Absolute time = Date + Time (to the second) + Microseconds
- Date and Time can come from the current Point Cloud Data Packet (6 bytes) or previous GPS Data Packet
- Microseconds from current packet (4 bytes)
- Per-point timestamps include packet timestamp + firing channel timing correction

### 6.2 ROS Driver: HesaiLidar_ROS_2.0

**Repository:** `https://github.com/HesaiTechnology/HesaiLidar_ROS_2.0`

**Supported Platforms:**

| Ubuntu | ROS 1 | ROS 2 |
|--------|-------|-------|
| 16.04 | Kinetic | — |
| 18.04 | Melodic | Dashing |
| 20.04 | Noetic | Foxy |
| 22.04 | — | Humble |
| 24.04 | — | Jazzy |

**Supported LiDAR Models:**
- Pandar series: Pandar40P, Pandar64, Pandar128E3X
- OT series: OT128
- QT series: PandarQT, QT128C2X
- XT series: PandarXT, PandarXT-16, XT32M2X
- AT series: AT128E2X, AT128P, ATX
- FT series: FT120
- JT series: JT16, JT128

**Default ROS Topics:**

| Topic | Message Type | Description |
|-------|-------------|-------------|
| `/lidar_points` | sensor_msgs/PointCloud2 | 3D point cloud |
| `/lidar_imu` | sensor_msgs/Imu | IMU data (if available) |
| `/lidar_packets` | — | Raw UDP packets |
| `/lidar_packets_loss` | — | Packet loss monitoring |

**Data Source Modes:**

| source_type | Description |
|-------------|-------------|
| 1 | Real-time UDP connection |
| 2 | PCAP file playback |
| 3 | Rosbag packet playback |
| 4 | Serial connection |

**Key Configuration Parameters:**
- `device_ip_address`: LiDAR device IP
- `udp_port`: UDP destination port (default 2368)
- `ptc_port`: PTC control port (default 9347)
- `use_gpu`: GPU acceleration toggle
- `thread_num`: Parser thread count
- `frame_frequency`: Output frame rate
- `echo_mode_filter`: Return mode filtering
- Transform: x, y, z offsets + roll, pitch, yaw rotation

**Installation:**
```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/HesaiTechnology/HesaiLidar_ROS_2.0.git

# Dependencies
sudo apt install libboost-all-dev libyaml-cpp-dev

# ROS 2 build
colcon build --symlink-install
. install/local_setup.bash
ros2 launch hesai_ros_driver start.py
```

Multi-LiDAR fusion is supported through multiple driver instances with configurable topic names per sensor.

### 6.3 SDK: HesaiLidar_SDK_2.0

**Repository:** `https://github.com/HesaiTechnology/HesaiLidar_SDK_2.0`

- **Language:** C++ (89.1%), with CUDA support (9.1%)
- **Platforms:** Ubuntu 16/18/20/22.04, Windows 10
- **Build:** CMake 3.8.0+, G++ 7.5+ or MSVC 2019+
- **Dependencies:** PCL, libpcap, OpenSSL, libyaml-cpp

**Capabilities:**
- Real-time online data parsing and PCAP offline parsing
- Multi-LiDAR simultaneous processing with IP/port filtering
- GPU-accelerated point cloud processing
- PCD file export
- Coordinate transformation utilities
- Packet loss statistics and monitoring
- TLS/mTLS encrypted PTC communication
- Per-point precise timestamps with firing-channel correction

### 6.4 PandarView 2 Visualization Tool

- Qt-based visualization software (fully self-developed, not Paraview-based)
- Displays azimuth, distance, intensity, timestamp per selected point
- Channel-level show/hide control
- Colormap by azimuth, distance, elevation, channel, or timestamp
- Available for Windows 10 and Ubuntu 16.04/18.04/20.04
- Download from: `https://www.hesaitech.com/downloads/`

---

## 7. Adverse Weather Performance

### 7.1 Technical Foundations

Hesai's approach to adverse weather relies on three pillars:

**Active Light Emission:**
LiDAR's optical power density reaching objects at 100 m is approximately 7x that of ambient visible light, enabling detection in conditions where cameras fail due to insufficient ambient illumination.

**Large Aperture Optics:**
The AT-series rotating mirror design uses significantly larger optical apertures than MEMS-based systems. This reduces the proportional impact of water droplets on sensor windows. For cameras, a single water droplet can block a large area of the image; the larger LiDAR aperture is more resilient to partial occlusion.

**Single-Photon Detection:**
Production LiDAR uses SiPM detectors that generate valid data signals from just a few returned photons, maintaining sensing consistency across varying weather conditions.

### 7.2 Intelligent Point Cloud Engine (IPE) Weather Processing

The IPE, integrated into the FMC500 SoC and deployed across ATX, ETX, and OT128 products, provides:
- Filtering of 99.9% of environmental noise
- Real-time pixel-level classification of rain, fog, exhaust fumes, and road water splashes
- Adaptive noise filtering using the 256-core waveform processing engine

### 7.3 Performance by Condition

**Fog:**
- Point clouds clearly show vehicles at 50 m when cameras cannot identify them
- Valid data points far exceed algorithmic detection requirements
- Mid-to-close range performance in mild/moderate fog is nearly equivalent to clear-day performance

**Rain:**
- Reliable detection of vehicles and pedestrians maintained
- Ranging capability somewhat reduced in moderate rain
- Performance at mid-to-close range remains strong

**General Degradation Characteristics:**
- A LiDAR with 200 m range (@10% reflectivity) in clear conditions shows approximately 33% better weather penetration performance than a 150 m range system
- Even with reduced ranging capability, data loss does not occur -- the system continues to detect vehicles and pedestrians

### 7.4 Environmental Protection

All automotive-grade Hesai products are rated IP6K7 and IP6K9K, providing:
- Complete dust ingress protection (6K)
- Protection against temporary immersion (7) and high-pressure/high-temperature water jets (9K)

---

## 8. Competitive Comparison

### 8.1 Hesai vs RoboSense

| Attribute | Hesai | RoboSense |
|-----------|-------|-----------|
| **Headquarters** | Shanghai, China | Shenzhen, China |
| **Public Listing** | NASDAQ + HKEX | HKEX (02522.HK) |
| **Wavelength** | 905 nm | 905 nm |
| **Primary ADAS Product** | ATX (successor to AT128) | M2 (successor to M1 Plus) |
| **ADAS Range (@10%)** | 200-230 m (ATX) | 200-250 m (M2) |
| **ADAS Resolution** | 0.08 x 0.05 deg (ATXP) | 0.1 x 0.1 deg (M2 ROI) |
| **ADAS Point Rate** | 3,840,000 pts/s (ATXP) | — |
| **ADAS Price** | ~$200 (ATX) | ~$200 (estimated) |
| **Functional Safety** | ASIL B (AT128, ATX, QT128) | ASIL B (M platform) |
| **Market Share (ADAS)** | ~33-40% | #2 globally |
| **Cumulative Shipments** | 2,000,000+ | — |
| **Scanning Architecture** | Rotating prism (ADAS) | MEMS-based (M platform) |
| **Primary Focus** | Robotaxi + passenger ADAS | Passenger ADAS + low-speed AV |

### 8.2 Hesai vs Ouster (Velodyne merged into Ouster, 2023)

| Attribute | Hesai | Ouster |
|-----------|-------|--------|
| **Headquarters** | Shanghai | San Francisco |
| **Wavelength** | 905 nm | 865 nm (VCSEL array) |
| **Detection Technology** | SiPM ToF | SPAD array digital ToF |
| **Key Products** | XT32, OT128, ATX | OS1 (mid), OS2 (long) |
| **Mid-Range Channels** | 32 (XT32) | 32/64/128 (OS1) |
| **Mid-Range (@10%)** | 120 m (XT32) | 90 m (OS1-128) |
| **Long-Range (@10%)** | 200 m (OT128) | 200 m (OS2) |
| **Point Rate** | 6,912,000 (OT128 dual) | 5,200,000 (OS1-128) |
| **IP Rating** | IP6K7 / IP6K9K | IP68 / IP69K |
| **Price Point** | Lower (volume advantage) | Higher |
| **Automotive ASIL** | ASIL B certified | Limited automotive certification |
| **Volume Scale** | Millions per year | Thousands per year |
| **Market Focus** | Auto ADAS + robotaxi | Multi-vertical (security, mapping, AV) |

Ouster's digital LiDAR architecture produces camera-like near-IR imagery alongside 3D point clouds, a differentiator for certain applications. However, Ouster's IP position has been overtaken by faster-growing Chinese companies in the patent landscape.

### 8.3 Hesai vs Luminar

| Attribute | Hesai | Luminar |
|-----------|-------|---------|
| **Headquarters** | Shanghai | Orlando, FL |
| **Wavelength** | 905 nm | 1550 nm |
| **Detection Technology** | SiPM/SPAD ToF | InGaAs APD ToF |
| **Key ADAS Product** | ATX | Iris / Iris+ |
| **Max Range** | 400 m (ETX @10%) | 600 m (max) / 250 m (dark objects) |
| **Eye Safety Power Budget** | Standard (905 nm Class 1) | 17-40x higher power per eye safety |
| **Resolution** | 0.05 x 0.025 deg (ETX) | Up to 300 pts/sq deg |
| **Price** | ~$200 (ATX mass market) | Sub-$1,000 target |
| **Volume Production** | Millions per year | Ramp-up phase |
| **OEM Partners** | 24 OEMs, 120+ models | Volvo, Mercedes-Benz, SAIC |
| **Profitability** | Profitable (2024) | Pre-profit |
| **Weather Penetration** | IPE noise filtering | 1550 nm inherent advantage |
| **Manufacturing** | Highly automated, 10s cycle | Lower volume |

Luminar's 1550 nm wavelength allows significantly higher laser power within eye safety limits, providing theoretical advantages in range and adverse weather. However, Hesai's 905 nm platform achieves competitive real-world performance through advanced signal processing while maintaining dramatic cost and volume advantages.

### 8.4 Summary Comparison Matrix

| Metric | Hesai ATX | RoboSense M2 | Ouster OS2 | Luminar Iris |
|--------|-----------|-------------|-----------|-------------|
| Wavelength | 905 nm | 905 nm | 865 nm | 1550 nm |
| Range @10% | 200-230 m | 200-250 m | 200 m | 250 m |
| ADAS ASIL | B | B | — | B (target) |
| Price (est.) | ~$200 | ~$200 | $600-1,200 | <$1,000 |
| Volume Scale | Millions | Hundreds of thousands | Thousands | Thousands |
| Profitability | Yes | Improving | Improving | No |

---

## 9. SDK and Software Tools

### 9.1 Complete Tool Ecosystem

| Tool | Purpose | Platform |
|------|---------|----------|
| HesaiLidar_SDK_2.0 | C++ SDK for point cloud parsing, GPU acceleration | Ubuntu, Windows |
| HesaiLidar_ROS_2.0 | ROS/ROS2 driver for all current models | Ubuntu (ROS Kinetic through Jazzy) |
| HesaiLidar_General_ROS | Legacy ROS driver for Pandar-era products | Ubuntu (ROS Kinetic through Noetic) |
| PandarView 2 | Qt-based point cloud visualization | Windows 10, Ubuntu 16/18/20 |
| PandarView | ParaView-based visualization (legacy) | Windows, Ubuntu |

### 9.2 SDK Architecture

The SDK 2.0 provides a modular C++ framework:

- **Driver module:** UDP packet reception and parsing
- **Library module:** Point cloud data structures and transformations
- **Tool module:** PCD export, visualization utilities
- **Test module:** Unit testing framework

**Communication protocols:**
- UDP for point cloud data packets
- PTC (Pandar TCP Control) for device configuration
- Optional TLS/mTLS encryption for PTC commands
- Configurable timeouts for initialization and connection

### 9.3 Integration with Third-Party Frameworks

- **Autoware:** Native support via PointCloud2 message format
- **Apollo:** Compatible through UDP packet interface
- **NVIDIA DriveWorks:** Integration path via SDK
- **PCL (Point Cloud Library):** Direct PCD export support
- **PCAP:** Full offline playback support for development and testing

---

## 10. Reliability and MTBF Data

### 10.1 Design Lifetime

| Product | Designed Lifetime |
|---------|------------------|
| OT128 | 30,000+ hours (3x industry average) |
| Pandar128 | 30,000+ hours |
| XT32 series | 30,000+ hours |
| AT128 | Automotive-grade (30,000+ hours implied) |

30,000 hours at continuous operation equals approximately 3.4 years. For typical automotive duty cycles (8-12 hours/day), this translates to 7-10 years of operational life.

### 10.2 Validation Testing

All automotive-grade Hesai products undergo 50+ design validation (DV) tests per internationally recognized OEM standards:

| Test Category | Specific Tests |
|---------------|---------------|
| Thermal | High-temperature exposure, low-temperature wakeup, thermal shock with water splash, humid heat cycling |
| Mechanical | Vibration with thermal cycling, mechanical shock |
| Environmental | UV aging, salt spray corrosion, IP6K7 immersion, IP6K9K high-pressure spray |
| Electrical | Power cycling, ESD, EMC |

### 10.3 Component-Level Qualification

- All key components meet AEC-Q qualification standards (AEC-Q100 for ICs, AEC-Q101 for discretes)
- FMC500 SoC carries on-chip functional safety certification
- Operating temperature ranges extend to -40 deg C to +85 deg C for automotive-grade products

### 10.4 MTBF

Specific MTBF (Mean Time Between Failure) figures are not publicly disclosed by Hesai. The 30,000+ hour designed lifetime provides a lower-bound estimate. For automotive qualification, OEMs typically require MTBF figures in the hundreds of thousands of hours, which would be shared under NDA during the design-win qualification process.

---

## 11. Cost and Pricing

### 11.1 Current Pricing (Estimated, 2026)

| Product | Estimated Unit Price | Segment |
|---------|---------------------|---------|
| ATX (ADAS) | ~$200 | Mass-market passenger vehicles |
| AT128 (ADAS) | ~$400 (pre-ATX transition) | Mid-to-high-end ADAS |
| OT128 (360-deg) | $1,000-3,000 (est.) | Robotaxi / L4 |
| XT32 (mapping) | $2,000-4,000 (est.) | Development / mapping |
| JT16 (robotics) | Low hundreds (est.) | Consumer robotics |
| FT120 (blind spot) | Sub-$200 (est.) | ADAS supplement |

### 11.2 Pricing Trends

- Hesai announced plans to halve LiDAR prices in 2025, with the ATX at ~$200 representing roughly half the AT128 price
- The $200 price point is identified as the threshold where LiDAR becomes economically viable for vehicles in the RMB 100,000 (~$14,000) price range
- Expected 2026 content per vehicle: $500-1,000 for multi-LiDAR configurations (1x long-range + 2-3x blind-spot)
- Highly automated production (10-second cycle time) is the primary cost reduction lever

### 11.3 Cost Structure

- **Gross margin:** 41.4% (TTM early 2026), indicating significant room above BOM cost
- **Scale economics:** Production capacity doubling from 2 million to 4 million units in 2026
- **Vertical integration:** 4 generations of custom ASICs reduce dependence on expensive off-the-shelf components
- **FMC500 SoC:** Integrates MCU + FPGA + ADC onto a single die, reducing component count and assembly cost

---

## 12. Future Roadmap

### 12.1 Near-Term (2026)

| Initiative | Timeline | Details |
|-----------|----------|---------|
| ATX mass production | April 2026 | 4M+ unit order backlog, 256-line flagship with FMC500 |
| Production capacity doubling | 2026 | 2M to 4M+ annual capacity |
| ETX + FTX L3 suite | Late 2026 / early 2027 | 800-channel long-range + 180-deg solid-state blind-spot |
| Bangkok factory | Early 2027 operations | New manufacturing facility in Thailand |

### 12.2 Product Evolution

**L3 Autonomous Driving:**
The "Infinity Eye" solution pairs ETX (long-range, behind-windshield) with FTX (short-range, blind-spot) for panoramic L3/L4 perception. First series-production program secured.

**Physical AI / Robotics:**
Expansion into humanoid robots, lawn-mowing robots, delivery drones (Meituan's Keeta), autonomous mobile robots. JT-series deliveries exceeding 200,000 units with growing momentum.

**NVIDIA Partnership:**
Collaboration on L4 autonomous driving rollout, integrating Hesai LiDAR with NVIDIA compute platforms.

### 12.3 Technology Trajectory

**SiPM / Single-Photon Platform:**
The ETX's fully in-house digital single-photon platform (laser emission + single-photon detection + signal processing) represents Hesai's technology direction -- pushing 905 nm ToF performance to ranges previously associated with 1550 nm systems (400 m @10%).

**FMCW:**
Hesai has not publicly announced FMCW product plans. The company's current strategy doubles down on advancing 905 nm ToF performance through silicon photonics and signal processing innovations. FMCW remains a technology to watch industry-wide, with companies like Aurora (FirstLight) and Aeva pursuing it, but commercialization timelines remain uncertain.

**RISC-V SoC Roadmap:**
The FMC500 establishes Hesai's custom silicon platform on RISC-V architecture, providing a foundation for future generations with increasing integration, lower power, and enhanced processing capabilities.

### 12.4 Market Outlook

- ADAS LiDAR shipments projected at 2-3 million units in 2026
- China EV market LiDAR adoption rate at 28% and growing
- LiDAR-equipped vehicles claimed to reduce fatal highway accidents by 90% vs camera-only
- Automotive LiDAR market projected to reach US$25.75 billion by 2035
- Hesai positioned as the clear volume leader with both cost and technology advantages

---

## Sources

- [Hesai Official Website](https://www.hesaitech.com/)
- [Hesai AT128 Product Page](https://www.hesaitech.com/product/at128/)
- [Hesai ATX Product Page](https://www.hesaitech.com/product/atx/)
- [Hesai XT16/32/32M Product Page](https://www.hesaitech.com/product/xt16-32-32m/)
- [Hesai QT128 Product Page](https://www.hesaitech.com/product/qt128/)
- [Hesai OT128 Product Page](https://www.hesaitech.com/product/ot128/)
- [Hesai ETX Product Page](https://www.hesaitech.com/product/etx/)
- [Hesai FTX Product Page](https://www.hesaitech.com/product/ftx/)
- [Hesai JT16 Product Page](https://www.hesaitech.com/product/jt16/)
- [Hesai FT120 Release](https://www.hesaitech.com/hesai-releases-fully-solid-state-lidar-ft120/)
- [Hesai ET25 Release](https://www.hesaitech.com/hesai-releases-ultra-thin-long-range-lidar-et25-providing-behind-the-windshieldadas-lidar-solution/)
- [Hesai CES 2026 Announcement](https://www.hesaitech.com/hesai-announces-plan-to-double-annual-lidar-production-capacity-at-ces-2026/)
- [Hesai IAA 2025 Showcase](https://www.hesaitech.com/hesai-showcases-next-gen-high-performance-lidars-at-iaa-mobility-2025-mass-production-expected-in-2026/)
- [Hesai 1 Million Units Milestone](https://www.hesaitech.com/hesai-becomes-the-worlds-first-lidar-company-to-produce-1-million-units-in-2025/)
- [Hesai 2 Million Cumulative Deliveries](https://www.hesaitech.com/lidar-company-to-surpass-2-million-units-in-cumulative-delivery/)
- [Hesai Adverse Weather Performance](https://www.hesaitech.com/rain-and-fog-got-you-down-lidar-clears-the-way-for-safer-intelligent-driving/)
- [Hesai QT128 ASIL B Certification](https://www.hesaitech.com/hesai-obtains-iso-26262-asil-b-safety-standard-for-qt128-lidar-sensor/)
- [HesaiLidar_ROS_2.0 GitHub](https://github.com/HesaiTechnology/HesaiLidar_ROS_2.0)
- [HesaiLidar_SDK_2.0 GitHub](https://github.com/HesaiTechnology/HesaiLidar_SDK_2.0)
- [HesaiLidar_General_ROS GitHub](https://github.com/HesaiTechnology/HesaiLidar_General_ROS)
- [Hesai FMC500 RISC-V Chip Launch (ChinaEVHome)](https://chinaevhome.com/2025/11/24/hesai-launches-risc-v-lidar-chip-fmc500-256-line-atx-delivery-starts-april-2026/)
- [Hesai ATX ASIL B Certification (AutoTechInsight)](https://autotechinsight.spglobal.com/news/5282682/hesai-technologys-atx-lidar-receives-iso-26262-asil-b-certification-from-sgs-tv)
- [Hesai Growth Analysis (BeyondSPX)](https://everyticker.com/quote/HSAI/hesai-group-how-the-world-s-first-profitable-lidar-company-is-building-a-self-reinforcing-growth-engine-nasdaq-hsai)
- [2025 LiDAR Market Analysis (Seeking Alpha)](https://seekingalpha.com/article/4752128-2025-lidar-at-crossroads-can-western-companies-survive-chinese-dominance)
- [Hesai LiDAR IP Leadership (Knowmade)](https://www.knowmade.com/technology-news/semiconductor-news/sensing-imaging-news/from-competitor-to-leader-hesai-in-lidar-patent-landscape/)
- [Hesai XT32M2X Specifications (Epotronic)](https://epotronic.com/eng/HESAI-XT32M2X-High-Precision-3600-x-40.30-Mid-Range-80-m-LiDAR-Sensor-32-Channels/HXT003)
- [Hesai PandarXT-32 User Manual (ManualsLib)](https://www.manualslib.com/manual/2280009/Hesai-Pandarxt-32.html)
- [CRATUS Technology Hesai Catalog](https://www.cratustech.com/lidars-perception/)
- [Pony.ai AT128 Selection](https://www.prnewswire.com/news-releases/four-at128-lidar-sensors-from-hesai-selected-as-primary-lidar-for-all-ponyai-seventh-generation-robotaxis-302437274.html)
- [CES 2026 Production Capacity (Gasgoo)](https://autonews.gasgoo.com/articles/news/ces-2026-hesai-technology-to-double-planned-annual-lidar-production-capacity-to-4-million-units-2008906906314043392)
- [Hesai Price Reduction Plans (TechNews180)](https://technews180.com/mobility/hesai-group-states-it-is-to-halve-lidar-prices-in-2025/)
- [905nm vs 1550nm Wavelength Comparison (EE Times)](https://www.eetimes.com/whats-the-direction-for-automotive-lidar-905-nm-or-1550-nm/)
- [Luminar Iris Specifications (AutonomouStuff)](https://autonomoustuff.com/products/luminar-iris)
- [Ouster OS1 Datasheet](https://data.ouster.io/downloads/datasheets/datasheet-rev7-v3p1-os1.pdf)
- [RoboSense M2 Product Page](https://www.robosense.ai/en/rslidar/M2)
