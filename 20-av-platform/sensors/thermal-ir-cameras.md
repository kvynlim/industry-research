# Thermal and Infrared Cameras for Airside Autonomous Vehicles

## The Missing Sensor: Night Operations, Personnel Safety, and Jet Blast Detection

**Last updated:** 2026-04-11

---

## Table of Contents

1. [Why Thermal for Airside](#1-why-thermal-for-airside)
2. [IR Wavelength Bands](#2-ir-wavelength-bands)
3. [Detector Technologies](#3-detector-technologies)
4. [Automotive-Grade Products](#4-automotive-grade-products)
5. [Airside-Specific Applications](#5-airside-specific-applications)
6. [Thermal + Visible Fusion](#6-thermal--visible-fusion)
7. [Perception Models for Thermal](#7-perception-models-for-thermal)
8. [Deployment on NVIDIA Orin](#8-deployment-on-nvidia-orin)
9. [Cost Analysis](#9-cost-analysis)
10. [Recommended Configuration](#10-recommended-configuration)
11. [References](#11-references)

---

## 1. Why Thermal for Airside

### 1.1 The Night Operations Gap

Airport airside operations run 24/7. During night shifts, the critical perception challenges are:

| Challenge | Visible Camera | LiDAR | 4D Radar | Thermal Camera |
|-----------|---------------|-------|----------|---------------|
| Personnel at 50m (night) | **Fails** (poor lighting) | Detects (3D point) | Detects (velocity) | **Excellent** (body heat) |
| Personnel behind GSE | Fails (occlusion) | Partial | Detects (through gaps) | Detects (heat signature through gaps) |
| Hi-vis vest effectiveness | Day: good, **Night: 84-88% AEB failure** | N/A | N/A | N/A — detects person, not vest |
| Jet engine running vs stopped | Cannot distinguish | Cannot distinguish | Detects blade rotation | **Clear** (exhaust plume visible) |
| Fuel spill on apron | Difficult (transparent) | Cannot detect | Cannot detect | **Detects** (evaporative cooling) |
| De-icing fluid coverage | Cannot assess | Cannot assess | Cannot assess | **Clear** (thermal contrast) |
| Fire detection | Visible flame only | Cannot detect | Cannot detect | **Detects** (early, even small) |
| Tire/brake heat | Cannot see | Cannot see | Cannot see | **Clear** (overheating visible) |

### 1.2 The Hi-Vis Paradox

From `operations/safety/ground-crew-pedestrian-safety.md`:
> Hi-vis clothing causes 84-88% failure rate in camera-based Automatic Emergency Braking at night due to retroreflective overexposure creating blooming artifacts.

**Thermal cameras solve this completely.** They detect the human body's thermal signature (~37°C) against the ambient background, regardless of clothing. Hi-vis vest is invisible to thermal — the person is always detectable.

### 1.3 Unique Airside Thermal Signatures

| Object | Typical Temperature | Thermal Contrast | Detection Ease |
|--------|-------------------|-----------------|---------------|
| Running jet engine exhaust | 400-600°C | Extreme | Trivial |
| Jet exhaust plume (100m) | 50-150°C above ambient | Very high | Easy |
| Human body | 37°C (always) | 10-25°C above ambient | Very easy |
| Recently-run APU | 80-150°C | High | Easy |
| Hot brakes (after landing) | 150-300°C | Very high | Easy |
| Fuel spill (evaporative cooling) | 5-15°C below ambient | Medium | Moderate |
| De-icing fluid on surface | 3-8°C below ambient | Low-medium | Moderate |
| Tire marks (friction heat) | 5-20°C above ambient | Low-medium | Moderate |
| Vehicle engine compartment | 80-110°C | High | Easy |
| Heated building (winter) | 10-30°C above ambient | Medium | Easy |
| Metal GSE in sun | Up to 70°C above ambient | High | Easy (can cause false positives) |

---

## 2. IR Wavelength Bands

### 2.1 Spectrum Overview

```
Visible  |  NIR   |  SWIR   |  MWIR   |  LWIR   |  VLWIR
0.4-0.7  | 0.7-1  | 1-2.5   | 3-5     | 8-14    | >14 μm
         |        |         |         |         |
 Cameras | Night  | See     | Cooled  | Uncooled|
         | vision | through | InSb    | Micro-  |
         | (Si)   | fog     | FPA     | bolom.  |
         |        | (InGaAs)|         | (VOx)   |
```

### 2.2 Band Comparison for Airside

| Band | Wavelength | Detector | Cooling | Cost | Best For (Airside) |
|------|-----------|----------|---------|------|-------------------|
| **NIR** | 0.7-1.0 μm | Silicon CCD/CMOS | None | $100-500 | Cheap night vision with active IR illumination |
| **SWIR** | 1.0-2.5 μm | InGaAs | None/TEC | $5-20K | Seeing through fog, smoke, de-icing mist |
| **MWIR** | 3-5 μm | InSb, MCT, T2SL | Cryo (-200°C) | $20-100K | Highest sensitivity, gas detection, long range |
| **LWIR** | 8-14 μm | VOx microbolometer | None (uncooled) | $500-5K | **Best overall for AV: personnel, engines, low cost** |

**Recommended for airside AV: LWIR (8-14 μm)**
- Uncooled = no cryocooler = lower cost, smaller, more reliable
- Peak thermal emission from room-temperature objects (Wien's law: 37°C body peaks at ~9.3 μm)
- Through atmosphere window (minimal absorption)
- Automotive-grade products available from multiple vendors

### 2.3 Atmospheric Windows

```
IR radiation must pass through atmosphere to reach camera.
Two main transmission windows:

Window 1: 3-5 μm (MWIR)
  - Good transmission
  - Hot objects (engines, exhaust) emit strongly here
  - BUT: requires cryogenic cooling

Window 2: 8-14 μm (LWIR)
  - Excellent transmission
  - Room-temperature objects emit strongly here
  - Uncooled detectors available
  - BEST for personnel detection

Between windows (5-8 μm): strong atmospheric absorption (water vapor)
  → Useless for outdoor imaging
```

---

## 3. Detector Technologies

### 3.1 Microbolometer (LWIR)

The dominant technology for automotive/AV thermal cameras:

```
Operating principle:
  IR photons → absorbed by thin film (VOx or a-Si)
  → temperature rise → resistance change → voltage change
  → no cooling needed (operates at room temperature)

Key specs (state-of-art 2025):
  Pixel pitch: 12 μm (high-end), 17 μm (standard), 25 μm (legacy)
  Resolution: 640×480 (VGA), 1024×768 (XGA), 1280×1024 (SXGA)
  NETD: 30-50 mK (can detect 0.03°C differences)
  Frame rate: 30-60 Hz (some up to 120 Hz for fast objects)
  Response time: 8-12 ms
  
Manufacturers (detector):
  - ULIS / Lynred (France) — market leader, VOx, 12μm pixel
  - DRS / Leonardo DRS (US) — military + automotive
  - BAE Systems (UK) — VOx
  - Raytron (China) — fast-growing, competitive pricing
```

### 3.2 Cooled InSb/MCT (MWIR)

For maximum performance (military, high-end surveillance):

```
Operating principle:
  IR photons → directly excite electrons in semiconductor
  → photocurrent proportional to IR intensity
  → requires cryogenic cooling to ~77K (-196°C)

Key specs:
  Pixel pitch: 10-30 μm
  Resolution: up to 2048×2048
  NETD: 10-20 mK (2-5x better than microbolometer)
  Frame rate: up to 1000 Hz
  
Cost: $20K-100K per camera (cooler dominates cost)
Size/weight: 2-5x larger than uncooled
MTBF: 5,000-10,000 hours (cooler limited)

NOT recommended for airside AV due to cost and reliability.
Exception: airport-wide surveillance from tower (shared infrastructure cost).
```

---

## 4. Automotive-Grade Products

### 4.1 FLIR / Teledyne FLIR

Teledyne FLIR is the dominant thermal camera brand, with dedicated automotive products:

| Product | Type | Resolution | Pixel Pitch | NETD | Interface | Price (Est.) |
|---------|------|-----------|-------------|------|-----------|-------------|
| **Boson 640** | Core module | 640×512 | 12 μm | <40 mK | CMOS parallel, USB | $3-6K |
| **Boson 320** | Core module | 320×256 | 12 μm | <50 mK | CMOS parallel, USB | $1.5-3K |
| **Lepton 3.5** | Micro module | 160×120 | 12 μm | <50 mK | SPI, I2C | $200-400 |
| **ADK (Auto Dev Kit)** | Full camera | 640×512 | 12 μm | <40 mK | GigE, CAN | $5-10K |
| **PathFindIR III** | Automotive | 320×240 | 25 μm | <60 mK | NTSC analog | $3-5K |

**Boson 640 is the recommended core for airside AV:**
- Automotive-grade (-40°C to +80°C operating)
- 12 μm pixel pitch (state of the art for uncooled)
- 640×512 resolution — sufficient for pedestrian detection at 100m+
- Multiple lens options (4.9mm to 50mm focal length)
- Radiometric output (actual temperature values, not just relative)
- ITAR-controlled (US export restrictions may apply)

### 4.2 Seek Thermal

| Product | Resolution | Interface | Price | Notes |
|---------|-----------|-----------|-------|-------|
| **Seek Starter Kit** | 206×156 | USB-C | $150-250 | Dev evaluation only |
| **Seek Mosaic Core** | 320×240 | MIPI CSI-2 | $500-1K | Embeddable, automotive-intent |
| **Seek Mosaic Pro** | 640×480 | MIPI CSI-2, GigE | $2-4K | AV-grade, wide dynamic range |

**Seek Mosaic Pro** is a strong alternative to FLIR Boson:
- Non-ITAR (no US export restrictions)
- MIPI CSI-2 interface (direct to Orin)
- Automotive-grade temperature range
- Competitive pricing

### 4.3 InfiRay (China)

| Product | Resolution | NETD | Interface | Price | Notes |
|---------|-----------|------|-----------|-------|-------|
| **AT61** | 640×512 | <30 mK | GigE | $2-4K | Best NETD in class |
| **AT31** | 384×288 | <35 mK | GigE, USB3 | $1.5-3K | Mid-range |
| **Micro III** | 256×192 | <40 mK | USB-C, MIPI | $300-600 | Compact module |

**InfiRay AT61** offers the best noise performance (<30 mK NETD) at competitive pricing. Subject to CFIUS/entity list considerations for US/EU military-adjacent applications.

### 4.4 Lynred (France, European Alternative)

Lynred (formerly Sofradir + ULIS) manufactures the detectors used by many thermal camera brands:

| Product | Resolution | Pitch | Technology | Notes |
|---------|-----------|-------|-----------|-------|
| **PICO1024 Gen2** | 1024×768 | 12 μm | a-Si | Highest resolution uncooled |
| **PICO640 Gen2** | 640×480 | 12 μm | a-Si | Standard automotive |
| **Micro80 Gen2** | 80×80 | 12 μm | a-Si | Ultra-compact for array configs |

Lynred detectors are used in cameras from Teledyne FLIR (Boson family), Opgal, Guide Sensmart, and others. For a European supply chain, Lynred + European integrator avoids ITAR/Chinese supply chain concerns.

---

## 5. Airside-Specific Applications

### 5.1 Personnel Detection at Night

**The primary safety use case.** 27,000 ramp accidents per year, many at night.

```
Thermal personnel detection at night:

Human body: ~33-35°C skin, ~37°C core
Ambient (night): -10°C to 25°C (seasonal)
ΔT: 8-47°C → ALWAYS detectable in LWIR

Detection range (640×512, 19mm lens):
  - Person detection: >200m
  - Person recognition: >100m
  - Identification: >50m

Detection range (640×512, 6.3mm lens, wide angle):
  - Person detection: >80m
  - Person recognition: >40m

Comparison with visible camera at night:
  Visible + apron lighting: detect person at ~20-30m (unreliable)
  Thermal LWIR: detect person at ~80-200m (highly reliable)
  Improvement: 3-8x detection range at night
```

### 5.2 Jet Blast Zone Detection

```
Jet engine exhaust temperature profile:

Engine type    | Exhaust temp (nozzle) | At 50m behind  | At 100m behind
─────────────  | ───────────────────── | ────────────── | ───────────────
Turbofan (CFM56)| 600°C               | ~80°C          | ~40°C
Turbofan (LEAP) | 550°C               | ~70°C          | ~35°C
APU             | 300-400°C           | ~40°C          | ~25°C
Turboprop       | 500°C               | ~60°C          | ~30°C

LWIR thermal camera can:
  1. Detect engine exhaust plume shape and extent
  2. Determine if engines are running or shutdown
  3. Estimate blast danger zone in real-time
  4. Detect unexpected engine start during pushback
  
This is IMPOSSIBLE with any other sensor:
  - Visible camera: cannot see hot air (transparent)
  - LiDAR: cannot detect gas (no solid particles)
  - Radar: partially detects turbulence, unreliable
  - Thermal: CLEARLY sees entire exhaust plume
```

### 5.3 De-Icing Fluid Monitoring

```
De-icing fluid (Type I/IV glycol):
  - Applied at 60-80°C
  - Cools to ambient over 5-30 minutes
  - Thermal camera shows:
    - Coverage completeness (is entire wing surface treated?)
    - Holdover time estimation (how fast is it cooling?)
    - Re-freeze detection (sudden temperature drop)
    
Application for autonomous de-icing GSE:
  - Thermal-guided spray pattern optimization
  - Automated coverage verification
  - Holdover time monitoring → signal departure readiness
```

### 5.4 FOD Detection

```
Foreign Object Debris detection via thermal contrast:

Day: FOD on concrete apron has different thermal mass
  - Metal FOD heats faster than concrete in sun
  - Rubber FOD absorbs more IR
  - Detection: moderate (depends on ΔT)

Night: FOD retains different heat than concrete
  - Metal cools faster → colder than concrete
  - Rubber retains heat → warmer than concrete
  - Detection: moderate-good

Best approach: thermal + visible fusion
  - Visible: detects color/shape contrast
  - Thermal: detects temperature contrast
  - Fusion: catches what either alone misses
```

### 5.5 Fire and Fuel Spill Detection

```
Fire detection:
  - Thermal camera detects flame at 600-1500°C
  - Also detects pre-fire conditions (overheating components)
  - Sub-second detection (vs minutes for smoke detectors)
  - Range: 100m+ for small fire

Fuel spill:
  - Jet fuel (Jet A-1) evaporates at ~40°C
  - Evaporative cooling creates thermal signature
  - Spill appears as cool region on warm concrete
  - Detection possible even for thin films
  
Combined with 4D radar:
  - Radar detects liquid surface reflectivity change
  - Thermal confirms evaporative cooling signature
  - Dual confirmation reduces false positives
```

---

## 6. Thermal + Visible Fusion

### 6.1 Fusion Approaches

```
Approach 1: Pixel-level fusion (early fusion)
  Thermal image + Visible image → Aligned → Combined multi-channel image
  → Single detection model on fused input
  
  Pros: Maximum information available to model
  Cons: Requires precise alignment (registration), different resolutions

Approach 2: Feature-level fusion (intermediate fusion)
  Thermal → Backbone → Features ──┐
                                   ├── Fusion module → Detection head
  Visible → Backbone → Features ──┘
  
  Pros: Handles misalignment better, can use different backbones
  Cons: More complex architecture

Approach 3: Decision-level fusion (late fusion)
  Thermal → Full detector → Detections ──┐
                                          ├── NMS/merge → Final detections
  Visible → Full detector → Detections ──┘
  
  Pros: Simplest, independent failure modes
  Cons: Cannot recover what either detector alone missed
```

### 6.2 Registration / Alignment

Thermal and visible cameras have different optics, resolution, and field of view. Alignment options:

| Method | Accuracy | Effort | Notes |
|--------|---------|--------|-------|
| **Stereo calibration** | Sub-pixel | One-time setup | Use checkerboard heated with IR lamp |
| **Deep homography** | ~2 pixel | Learned | Neural network predicts alignment |
| **Feature matching** | Variable | Automatic | Fails when thermal/visible features differ greatly |
| **Co-located sensor** | Perfect (shared optics) | None | Expensive dual-sensor cameras available |

**Recommended for airside:** Stereo calibration (one-time) + deep homography refinement (handles small shifts from vibration/thermal expansion).

### 6.3 Key Datasets for Thermal Perception

| Dataset | Year | Modalities | Annotations | Size | Focus |
|---------|------|-----------|-------------|------|-------|
| **KAIST** | 2015 | Visible + LWIR | Pedestrian bbox | 95K pairs | Pedestrian detection, day/night |
| **LLVIP** | 2021 | Visible + LWIR | Pedestrian bbox | 16.8K pairs | Low-light visible + infrared |
| **FLIR ADAS v2** | 2022 | Visible + LWIR | 4 classes bbox | 26.4K thermal | Automotive (vehicles, people, bikes, dogs) |
| **M3FD** | 2022 | Visible + LWIR | 6 classes bbox | 4.2K pairs | Multi-modal fusion, fog/night |
| **DroneVehicle** | 2022 | Visible + LWIR | Oriented bbox | 56.9K pairs | Aerial vehicle detection |
| **InfiRay MOOD** | 2023 | Visible + LWIR | 6 classes bbox | 1.5K pairs | Automotive, Chinese driving |

**No airside thermal dataset exists.** This is another gap and opportunity.

### 6.4 Night Performance Comparison

From KAIST and LLVIP benchmarks:

| Method | Day (Visible) | Night (Visible) | Night (Thermal) | Night (Fusion) |
|--------|-------------|----------------|-----------------|---------------|
| YOLOv5 (pedestrian) | 91.2% | 62.8% | 84.3% | **89.7%** |
| Faster R-CNN | 89.1% | 58.4% | 81.2% | **87.3%** |
| Thermal-only YOLO | — | — | 85.1% | — |
| Halfway Fusion | — | — | — | **91.4%** |

**Key insight:** Thermal alone at night (84-85%) nearly matches visible during day (89-91%). Thermal+visible fusion at night (89-91%) achieves near-daytime performance.

---

## 7. Perception Models for Thermal

### 7.1 Pre-trained Models Available

| Model | Framework | Thermal Dataset | Performance | License |
|-------|-----------|----------------|-------------|---------|
| YOLOv8 (fine-tuned on FLIR) | Ultralytics | FLIR ADAS v2 | ~80% mAP pedestrian | AGPL/Enterprise |
| YOLOX-Thermal | YOLOX | KAIST | ~76% mAP pedestrian | Apache 2.0 |
| Thermal-DETR | DETR variant | LLVIP | ~82% mAP pedestrian | Research |
| ThermalDet | Custom | Multi-dataset | ~85% mAP pedestrian | Research |

### 7.2 Domain Adaptation for Airside

Road thermal datasets (KAIST, FLIR ADAS) have different characteristics from airside:

| Aspect | Road Thermal | Airside Thermal |
|--------|-------------|-----------------|
| Pedestrians | Casual clothing, varied poses | Hi-vis + PPE, airport-specific gear |
| Vehicles | Cars, trucks, buses | GSE (tractors, belt loaders, fuel trucks) |
| Background | Asphalt, buildings, trees | Concrete, aircraft, jet bridges |
| Temperature | Wide ambient range | Similar, plus jet exhaust heat |
| Viewing angle | Dash-mounted (1.2-1.5m) | Various (1-3m on GSE) |

**Transfer learning strategy:**
1. Start with YOLO/DETR pre-trained on COCO (visible)
2. Fine-tune on FLIR ADAS thermal dataset (general thermal)
3. Fine-tune on small airside thermal dataset (100-500 annotated frames)
4. Expected: >80% mAP for personnel detection with just 200 airside frames

### 7.3 Thermal Object Detection on Orin

```
Pipeline: Thermal camera → GStreamer → TensorRT inference → ROS topic

GStreamer pipeline for thermal camera:
  gst-launch-1.0 \
    v4l2src device=/dev/video_thermal ! \
    video/x-raw,format=GRAY16_LE,width=640,height=512,framerate=30/1 ! \
    videoconvert ! \
    appsink name=thermal_sink

TensorRT model:
  Input: 640×512 single-channel (16-bit thermal)
  Model: YOLOv8s fine-tuned for thermal
  Output: bounding boxes + class labels
  
  Latency on Orin (FP16): ~8-12ms per frame
  Memory: ~500 MB
  Power: ~5W

ROS integration:
  /thermal_raw (sensor_msgs/Image, encoding=mono16)
  /thermal_detections (vision_msgs/Detection2DArray)
  /thermal_overlay (sensor_msgs/Image — visualization with boxes)
```

---

## 8. Deployment on NVIDIA Orin

### 8.1 Camera Interface Options

| Interface | Bandwidth | Latency | Orin Support | Recommended For |
|-----------|----------|---------|-------------|----------------|
| **MIPI CSI-2** | Up to 2.5 Gbps/lane | <1ms | Native (16 CSI-2 ports) | Direct connection, lowest latency |
| **GigE Vision** | 1 Gbps | 1-5ms | Via NIC (PCIe) | Standard industrial, longer cable |
| **USB3** | 5 Gbps | 1-3ms | Native USB3.2 | Development, less reliable for production |
| **Analog (NTSC)** | N/A | ~33ms | Via capture card | Legacy cameras only |

**Recommended:** MIPI CSI-2 for Orin integration (direct, lowest latency, no additional hardware). Boson 640 and Seek Mosaic both support MIPI CSI-2.

### 8.2 Thermal Camera Integration Diagram

```
Orin AGX Developer Kit
  ├── CSI Port 0-3: Visible cameras (4× surround)
  ├── CSI Port 4-5: Thermal cameras (2× front + rear)
  │     ├── FLIR Boson 640 (front, 50mm lens) — long range
  │     └── Seek Mosaic Pro (rear, wide angle) — close range
  ├── Ethernet: LiDAR data (4-8× RoboSense)
  ├── CAN: Vehicle bus
  └── USB: IMU, GPS

Processing pipeline:
  CSI thermal → ISP bypass (raw 14-bit) → NvBufSurface 
  → TensorRT inference (YOLO thermal, 8ms) → ROS topic
  
  Total thermal pipeline latency: <15ms
  Additional GPU load: ~3-5W, ~500 MB
```

### 8.3 Multi-Spectral BEV Fusion

For full-stack integration, thermal can be fused into the BEV perception pipeline:

```
Visible cameras (6-8) → Image backbone → BEV features
Thermal cameras (2-4) → Thermal backbone → BEV features (separate)
LiDAR (4-8) → PointPillars → BEV features

All BEV features → Multi-modal BEV fusion (BEVFusion-style)
                → Unified 3D perception

Thermal channels: Add thermal BEV as additional modality
  - Same LSS (Lift-Splat-Shoot) projection as visible cameras
  - But thermal provides complementary information:
    - People detected even when visible fails (night, hi-vis blooming)
    - Engine status visible (running/stopped)
    - Hot exhaust zones mapped
```

---

## 9. Cost Analysis

### 9.1 Per-Vehicle Cost

| Component | Quantity | Unit Cost | Total | Notes |
|-----------|---------|----------|-------|-------|
| **FLIR Boson 640** (core) | 2 | $4-6K | $8-12K | Front + rear |
| Lens (19mm, f/1.0) | 2 | $500-1K | $1-2K | Matched to Boson |
| Housing (IP67, automotive) | 2 | $500-1K | $1-2K | Weatherproof enclosure |
| MIPI CSI-2 adapter board | 2 | $200-400 | $400-800 | Interface to Orin |
| Calibration + integration | 1 | $2-5K | $2-5K | Engineering time |
| **Total per vehicle** | | | **$12.4-21.8K** | |

**Alternative (budget):**

| Component | Quantity | Unit Cost | Total |
|-----------|---------|----------|-------|
| **Seek Mosaic Pro** (core) | 2 | $2-4K | $4-8K |
| Lens + housing | 2 | $1-1.5K | $2-3K |
| Integration | 1 | $2-3K | $2-3K |
| **Total per vehicle** | | | **$8-14K** |

### 9.2 Infrastructure Thermal Cameras

For fixed infrastructure (stand monitoring, taxiway surveillance):

| Use Case | Camera | Quantity/Airport | Cost Each | Total |
|----------|--------|-----------------|----------|-------|
| Stand personnel monitoring | FLIR A700 (fixed) | 20-40 (1 per stand) | $5-8K | $100-320K |
| Taxiway intersection | PTZ thermal | 5-10 | $8-15K | $40-150K |
| Wide-area surveillance | Pan-tilt thermal | 2-4 (on towers) | $15-30K | $30-120K |
| **Total infrastructure** | | | | **$170-590K** |

### 9.3 ROI for Night Safety

| Metric | Without Thermal | With Thermal |
|--------|----------------|-------------|
| Night pedestrian detection range | 20-30m (visible) | 80-200m (thermal) |
| Night detection reliability | 60-70% | 95%+ |
| Ramp incident reduction | Baseline | Est. 30-50% fewer incidents |
| Annual ramp incident cost (per airport) | $2-10M | $1-5M |
| **Annual savings** | | **$1-5M** |
| **Payback period (per vehicle)** | | **<1 year** |

---

## 10. Recommended Configuration

### 10.1 Vehicle-Mounted Thermal (2 cameras per GSE)

```
Position 1: Front-facing, long range
  Camera: FLIR Boson 640 + 19mm f/1.0 lens
  FoV: 32° × 26°
  Range: 200m+ person detection
  Purpose: Forward path safety, approaching aircraft, jet blast

Position 2: Rear/side, wide angle  
  Camera: FLIR Boson 640 + 6.3mm f/1.0 lens
  FoV: 95° × 75°
  Range: 50m+ person detection
  Purpose: Close-range personnel, reversing safety, side clearance

Optional Position 3-4: Additional side-facing for 360° coverage
  Camera: Seek Mosaic Pro (lower cost)
  Purpose: Complete surround thermal coverage
```

### 10.2 Integration Priority

| Priority | Integration Step | Effort | Benefit |
|----------|-----------------|--------|---------|
| **1** | Mount 2× thermal on one test vehicle | 2-4 weeks | Night personnel detection proof-of-concept |
| **2** | Train YOLO on FLIR ADAS + small airside set | 1-2 weeks | Thermal person/vehicle detector |
| **3** | Late fusion with existing LiDAR pipeline | 2-4 weeks | Combined day/night detection |
| **4** | BEV fusion (thermal + LiDAR + visible) | 2-3 months | Full multi-spectral perception |
| **5** | Jet blast zone estimation from thermal | 1-2 months | Unique safety feature |

### 10.3 Sensor Suite Update

Adding thermal to the recommended airside sensor suite (from `synthesis/master-synthesis.md`):

| Sensor | Qty | Purpose | Airside Rationale |
|--------|-----|---------|-------------------|
| Cameras (surround) | 6-8 | Primary perception | Rich semantic info |
| **Thermal LWIR** | **2-4** | **Night safety, jet blast** | **Personnel at night, engine status** |
| LiDAR (128-ch) | 1 | 3D geometry | Large objects, localization |
| 4D Radar | 2-4 | Velocity, all-weather | Rain, de-icing, fog |
| RTK-GNSS | 1 | Localization | cm-level in open areas |
| ADS-B receiver | 1 | Aircraft awareness | Real-time aircraft positions |
| IMU | 1 | Dead reckoning | Bridge GPS gaps |

---

## 11. References

### Products
- FLIR Boson: `https://www.flir.com/products/boson/`
- FLIR ADK: `https://www.flir.com/products/adk/`
- Seek Thermal Mosaic: `https://www.thermal.com/mosaic-core.html`
- InfiRay AT Series: `https://www.infiray.com/thermal-modules.html`
- Lynred PICO series: `https://www.lynred.com/products`

### Datasets
- KAIST Multispectral Pedestrian: `https://soonminhwang.github.io/rgbt-ped-detection/`
- LLVIP: `https://bupt-ai-cz.github.io/LLVIP/`
- FLIR ADAS v2: `https://www.flir.com/oem/adas/adas-dataset-agree/`
- M3FD: Multi-modal Fusion Dataset for autonomous driving

### Papers
- Hwang et al., "Multispectral Pedestrian Detection: Benchmark Dataset and Baseline," CVPR 2015
- Jia et al., "LLVIP: A Visible-Infrared Paired Dataset for Low-Light Vision," ICCV 2021
- Zhang et al., "Multispectral Fusion for Object Detection with Cyclic Fuse-and-Refine Blocks," ICIP 2020
- Cao et al., "Attention-Guided Multi-modal and Multi-scale Fusion for Multispectral Pedestrian Detection," IEEE TITS 2023

## Related Documents

| Topic | Document |
|-------|----------|
| 4D radar (all-weather primary) | `20-av-platform/sensors/4d-radar.md` |
| Ground crew safety (hi-vis paradox) | `operations/safety/ground-crew-pedestrian-safety.md` |
| Adverse conditions (de-icing, fog) | `60-safety-validation/verification-validation/robustness/airside-adverse-conditions.md` |
| FOD and jet blast | `operations/airside/fod-and-jetblast.md` |
| Production perception systems | `30-autonomy-stack/perception/overview/production-perception-systems.md` |
| Sensor fusion architectures | `cross-cutting/sensor-fusion-architectures.md` |
| NVIDIA Orin technical | `20-av-platform/compute/nvidia-orin-technical.md` |
| Infrastructure cooperative perception | `30-autonomy-stack/perception/overview/infrastructure-cooperative-perception.md` |
