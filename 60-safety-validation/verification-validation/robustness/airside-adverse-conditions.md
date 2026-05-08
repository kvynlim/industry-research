# Perception Robustness in Airside Adverse Conditions

## How Airport-Specific Environmental Challenges Degrade Sensors and How to Compensate

---

## 1. Airside-Specific Conditions Not Found in Road Driving

| Condition | Frequency | Severity for Sensors | Road Driving Equivalent |
|-----------|-----------|---------------------|------------------------|
| **De-icing spray** | Seasonal (daily in winter) | Critical — lens contamination | No equivalent |
| **Jet engine exhaust** | Every departure | High — thermal distortion | No equivalent |
| **Jet blast debris** | During engine run-up | Medium — physical impact risk | No equivalent |
| **Standing water on apron** | After rain | High — mirror reflections | Puddles (much smaller scale) |
| **Tropical downpour (50mm/h)** | Daily (Changi-type) | High — sensor blindness | Heavy rain (usually less intense) |
| **Heat shimmer from tarmac** | Summer afternoons | Medium — camera distortion | Highway heat shimmer (similar) |
| **Apron lighting at night** | Every night | Medium — harsh shadows, glare | Street lighting (more uniform) |
| **Sun glare on wet tarmac** | After rain + sunshine | High — specular reflection | Sun glare on wet road (similar) |
| **De-icing fluid on surface** | Winter operations | Medium — reduced LiDAR intensity | No equivalent |
| **Snow/ice on apron** | Winter | High — obscured markings | Snow on road (similar) |

---

## 2. De-Icing Operations

### 2.1 Impact on Sensors

De-icing uses **propylene glycol** (Type I) and **thickened glycol** (Type IV) sprayed at 60-80°C:

```
LiDAR impact:
  - Glycol droplets on lens → scattered/blocked beams → blind spots
  - Glycol mist in air → backscatter → phantom returns (like fog)
  - Estimated degradation: 40-70% point cloud density loss in spray zone
  - Recovery: requires physical lens cleaning (not automatic wipers)

Camera impact:
  - Glycol streaks on lens → blurred/distorted images
  - Colored glycol (orange Type I, green Type IV) → color distortion
  - Warm glycol creates steam → temporary fog around aircraft

Radar impact:
  - Minimal — glycol droplets too small to scatter 77GHz waves
  - 4D radar provides reliable perception through de-icing operations

IMU/GPS impact:
  - None — unaffected by glycol
```

### 2.2 Mitigation Strategies

```
1. Operational avoidance:
   - Do not route autonomous GSE through active de-icing spray zones
   - Use ADS-B + de-icing schedule to predict and geofence zones
   - De-icing typically occurs at remote de-icing pads, not at stands

2. Sensor protection:
   - Hydrophobic lens coatings (repel glycol droplets)
   - Heated lens elements (prevent glycol from adhering)
   - Compressed air cleaning (periodic bursts to clear droplets)
   - Enclosed sensor pods with automatic cleaning

3. Graceful degradation:
   - Detect glycol contamination: sudden drop in LiDAR point count
   - Switch to 4D radar primary perception
   - Reduce speed to minimum safe level
   - Request remote operator intervention if degradation > 50%

4. Post-de-icing recovery:
   - Trigger sensor cleaning cycle after de-icing event ends
   - Verify sensor performance before resuming autonomous operation
   - Log incident for data collection (rare adverse condition)
```

---

## 3. Jet Engine Exhaust

### 3.1 Thermal Effects on LiDAR

```
Jet exhaust temperature: 300-600°C (idle), 1000-1500°C (takeoff)
Air density gradient: dn/dT ≈ -1×10⁻⁶ per °C

Effects on LiDAR:
  - Beam refraction through thermal gradient → point position errors (1-5cm)
  - Thermal turbulence → fluctuating returns → increased noise
  - At 905nm: minimal absorption by exhaust gases
  - At 1550nm: slightly more absorption, but still minor

Practical impact:
  - Objects behind exhaust plume: position error increases
  - Objects IN exhaust plume: phantom/noisy returns
  - Effects decrease rapidly with distance from exhaust
  - Most significant within 20-30m behind engine at idle thrust
```

### 3.2 Camera Effects

```
Heat shimmer:
  - Refractive index variations cause image wavering
  - AT-Net, MPRNet neural de-shimmer approaches exist (research stage)
  - Practical: use higher frame rate + temporal averaging

Exhaust plume visibility:
  - Visible as heat haze, especially against dark backgrounds
  - Can be detected as motion anomaly in optical flow
  - Thermal camera sees exhaust plume directly (useful for hazard detection)
```

### 3.3 Mitigation

```
1. Jet blast hazard zones (from POC 4):
   - Pre-computed hazard zones keep vehicle away from exhaust path
   - ADS-B + aircraft type → engine position + thrust estimate → hazard cone

2. Temporal filtering:
   - Exhaust turbulence is high-frequency noise
   - Low-pass filter on LiDAR returns reduces noise
   - Multi-frame accumulation averages out turbulence

3. 4D radar unaffected:
   - 77GHz radar passes through exhaust plumes without distortion
   - Provides reliable backup perception in exhaust zones
```

---

## 4. Standing Water on Tarmac

### 4.1 The Mirror Reflection Problem

```
LiDAR on standing water:
  - Water surface acts as specular reflector at low angles of incidence
  - Near-perpendicular beams: reflect off water → phantom ground returns BELOW actual surface
  - Oblique beams: reflect off water → miss (no return at all)
  - Result: inconsistent ground plane, false obstacles below ground level

Camera on standing water:
  - Mirror reflections of sky, aircraft, buildings
  - Confused semantic understanding (reflection of aircraft ≠ actual aircraft)
  - Specular highlights from sun/apron lights

Radar on standing water:
  - Minor effect at 77GHz (water is partially reflective)
  - Multi-path returns possible but low intensity
```

### 4.2 Detection and Compensation

```python
def detect_standing_water(pointcloud, ground_model):
    """Detect standing water from LiDAR characteristics."""
    # Water indicators:
    # 1. Ground returns lower than expected (mirror bounce)
    # 2. Reduced return intensity (specular reflection away from sensor)
    # 3. Missing ground returns in patches (total specular reflection)

    ground_diff = pointcloud.z - ground_model.expected_z(pointcloud.x, pointcloud.y)
    intensity = pointcloud.intensity

    # Points below expected ground with low intensity → likely water
    water_mask = (ground_diff < -0.05) & (intensity < 0.3 * median_intensity)

    # Missing return patches (no points where ground expected) → possible water
    coverage_grid = compute_ground_coverage(pointcloud)
    missing_patches = coverage_grid < expected_coverage * 0.3

    return water_mask, missing_patches
```

---

## 5. Tropical Rainfall (Changi-Relevant)

### 5.1 Quantitative Degradation

Published data from K-Radar dataset and research:

| Rain Intensity | LiDAR Point Loss | LiDAR Range Loss | Camera Impact | 4D Radar Impact |
|---------------|------------------|-------------------|---------------|-----------------|
| Light (<2.5 mm/h) | ~10% | ~5% | Minor | None |
| Moderate (2.5-10 mm/h) | ~25% | ~15% | Moderate (blur) | None |
| Heavy (10-25 mm/h) | ~40% | ~25% | Severe (visibility) | None |
| Torrential (25-50 mm/h) | ~56% | ~35% | Near-blind | Negligible |
| Extreme (>50 mm/h) | ~70%+ | ~50%+ | Blind | Minor |

**Changi experiences 50mm/h regularly.** At this intensity, LiDAR loses ~70% of points. UISEE developed custom rain filtering algorithms specifically for this.

### 5.2 UISEE's Rain Approach at Changi

```
What UISEE does (from deployment reports):
  - Custom LiDAR rain filtering algorithms (specific to Hesai XT)
  - Multi-frame temporal filtering (average across multiple scans)
  - Likely intensity-based rain point rejection
  - Maintained 20,000+ km accident-free including tropical conditions
  - Specific technical details not publicly disclosed
```

### 5.3 Mitigation Stack

```
Layer 1: Point cloud rain filtering
  - Statistical Outlier Removal (already in Aurrigo stack: aurrigo_rain_detection)
  - Intensity-based rejection (rain drops have characteristic low-intensity returns)
  - Multi-return analysis (rain hits first, ground hits second)

Layer 2: Multi-frame accumulation
  - Accumulate 3-5 frames → rain points are random, real points are consistent
  - Moving average filter on occupancy grid

Layer 3: 4D radar as primary in heavy rain
  - Switch from LiDAR-primary to radar-primary when rain intensity > 25 mm/h
  - 4D radar provides reliable detections through all rain

Layer 4: Operational limits
  - If ALL sensors degraded > 60% → reduce speed to minimum
  - If degradation > 80% → controlled stop, wait for conditions to improve
  - UISEE operates through 50mm/h → achievable with proper filtering
```

---

## 6. Night Operations

### 6.1 Sensor Performance at Night

```
LiDAR: UNAFFECTED by lighting conditions
  - Active sensor (emits own light at 905/1550nm)
  - Same performance day and night
  - This is LiDAR's primary advantage for airside

Camera: SIGNIFICANTLY DEGRADED
  - Apron lighting is non-uniform (bright at stands, dark between)
  - High-pressure sodium lights (orange cast) → poor color perception
  - LED apron lights (new installations) → better color, harsh shadows
  - Aircraft navigation lights → potential confusion with markings
  - Exposure challenges: bright areas + dark areas in same frame

4D Radar: UNAFFECTED
  - Active sensor, works identically day and night

Thermal/LWIR: IMPROVED at night
  - Better contrast between warm objects (people, engines) and cool background
  - No sun glare interference
  - Personnel detection BETTER at night with thermal camera
```

### 6.2 Recommendation for Night

```
LiDAR-primary stack (Aurrigo's current approach):
  → Night operations are inherently supported
  → No additional hardware needed for basic night capability

When cameras are added (Phase 2):
  → HDR mode essential for handling apron lighting variation
  → Consider global shutter cameras (less motion blur)
  → DINOv2 features are more robust to lighting changes than supervised backbones

For personnel safety at night:
  → Thermal/LWIR camera (FLIR Tura, ASIL-B rated)
  → 4x detection range vs headlights
  → Detects ground crew through hi-vis paradox (hi-vis causes 84-88% AEB failure at night)
  → UWB personal transponders as backup (10-30cm accuracy, lighting-independent)
```

---

## 7. Sensor Degradation Detection

### 7.1 Real-Time Health Monitoring

```python
class SensorHealthMonitor:
    def check_lidar_health(self, pointcloud):
        """Detect LiDAR degradation in real-time."""
        metrics = {
            'point_count': len(pointcloud),
            'mean_intensity': pointcloud.intensity.mean(),
            'max_range': pointcloud.range.max(),
            'coverage_ratio': self.compute_coverage(pointcloud),
        }

        # Compare to baseline (learned from good conditions)
        degradation = {}
        for key, value in metrics.items():
            baseline = self.baselines[key]
            degradation[key] = 1.0 - (value / baseline)

        # Overall degradation score (0 = healthy, 1 = fully degraded)
        overall = max(degradation.values())

        # Determine probable cause
        if degradation['point_count'] > 0.3 and degradation['mean_intensity'] > 0.3:
            cause = 'rain_or_fog'
        elif degradation['point_count'] > 0.5 and degradation['mean_intensity'] < 0.1:
            cause = 'lens_contamination'  # blocked beams but remaining are normal intensity
        elif degradation['max_range'] > 0.3:
            cause = 'fog_or_visibility'
        else:
            cause = 'unknown'

        return SensorHealth(
            degradation=overall,
            cause=cause,
            action=self.get_action(overall),
        )

    def get_action(self, degradation):
        if degradation < 0.2:
            return 'NORMAL'
        elif degradation < 0.4:
            return 'REDUCE_SPEED'
        elif degradation < 0.6:
            return 'SWITCH_TO_RADAR_PRIMARY'
        elif degradation < 0.8:
            return 'MINIMUM_SPEED'
        else:
            return 'CONTROLLED_STOP'
```

---

## 8. Summary: Sensor Selection for Airside Robustness

| Condition | LiDAR | Camera | 4D Radar | Thermal | Recommended Primary |
|-----------|-------|--------|----------|---------|-------------------|
| Clear day | Excellent | Excellent | Good | Fair | LiDAR |
| Clear night | Excellent | Poor | Good | Excellent | LiDAR + Thermal |
| Light rain | Good | Fair | Excellent | Good | LiDAR |
| Heavy rain | Poor | Very Poor | **Excellent** | Good | **4D Radar** |
| Fog | Poor | Very Poor | **Excellent** | Fair | **4D Radar** |
| De-icing spray | Very Poor | Very Poor | **Excellent** | Fair | **4D Radar** |
| Jet exhaust | Fair | Poor | **Excellent** | Excellent | **4D Radar** + Thermal |
| Standing water | Fair | Poor | Fair | Good | LiDAR + Radar |
| Snow | Fair | Poor | **Excellent** | Good | **4D Radar** |
| Sun glare | Excellent | Very Poor | Good | N/A | LiDAR |

**Key insight:** 4D radar is the **most critical sensor for airside robustness**. It should be treated as a primary perception input, not a backup. The $50-200 cost per unit is negligible compared to the robustness it provides.

---

## Sources

- K-Radar dataset weather performance data
- UISEE Changi deployment reports
- Bijelic et al. "Seeing Through Fog Without Seeing Fog." CVPR, 2020
- Heinzler et al. "Weather Influence and Classification with Automotive LiDAR Sensors." IV, 2019
- RoboSense RSHELIOS IP67/IP6K9K specifications
- Continental ARS548 specifications
- FLIR Tura thermal camera specifications
- IIHS AEB night testing results (hi-vis paradox)
