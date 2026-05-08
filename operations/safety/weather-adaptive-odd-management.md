# Weather-Adaptive Operational Design Domain (ODD) Management for Airside Autonomous GSE

Autonomous ground support equipment operating on airport aprons must function 24 hours per day, 365 days per year, across a range of environmental conditions that far exceeds what most autonomous vehicle systems are designed for. Unlike highway autonomy where the ODD is essentially "dry highway, good visibility, moderate traffic," an airside GSE fleet encounters rain, fog, snow, ice, de-icing fluid spray, jet exhaust heat shimmer, direct sunlight glare, complete darkness, high winds, and extreme temperatures — often multiple conditions simultaneously and with transitions measured in minutes rather than hours. A de-icing operation can reduce LiDAR point returns by 60% for 30 seconds, followed by clear conditions, followed by jet blast from a departing aircraft that shimmers thermal imagery for 15 seconds. The Operational Design Domain (ODD) for airside autonomy is therefore not a static specification but a continuously monitored, dynamically adjusted envelope that determines what capabilities the system can safely exercise at each moment. This document defines the airside ODD taxonomy (environmental, temporal, spatial, operational dimensions), the automated monitoring system that maps real-time sensor data and airport weather feeds (METAR, TAF, ATIS) to ODD state, the capability curves that relate environmental conditions to perception performance and safe operating parameters, the fallback orchestration framework that degrades autonomy gracefully from full autonomous through reduced-speed through teleoperation to safe stop, seasonal adaptation profiles for year-round operations, and the standards compliance mapping to ISO 34502, ISO 21448 (SOTIF), ISO 3691-4, and the emerging EU AI Act requirements. Implementation targets the Aurrigo ROS Noetic stack with NVIDIA Orin, integrating with the existing sensor health monitoring, runtime verification, and fleet management systems.

---

## Table of Contents

1. [Airside ODD Taxonomy](#1-airside-odd-taxonomy)
2. [Environmental Monitoring: METAR, TAF, and Sensor Feeds](#2-environmental-monitoring-metar-taf-and-sensor-feeds)
3. [Capability Curves: Environment to Performance Mapping](#3-capability-curves-environment-to-performance-mapping)
4. [ODD State Machine and Fallback Orchestration](#4-odd-state-machine-and-fallback-orchestration)
5. [Visibility and Precipitation Handling](#5-visibility-and-precipitation-handling)
6. [Wind and Jet Blast Effects](#6-wind-and-jet-blast-effects)
7. [Temperature Extremes and Thermal Effects](#7-temperature-extremes-and-thermal-effects)
8. [Lighting Conditions and Transitions](#8-lighting-conditions-and-transitions)
9. [Seasonal Adaptation Profiles](#9-seasonal-adaptation-profiles)
10. [Dynamic Speed and Margin Adjustment](#10-dynamic-speed-and-margin-adjustment)
11. [Standards Compliance](#11-standards-compliance)
12. [Implementation Architecture](#12-implementation-architecture)
13. [Key Takeaways](#13-key-takeaways)

---

## 1. Airside ODD Taxonomy

### 1.1 ODD Dimensions for Airside Operations

The ODD for airport GSE is defined across four orthogonal dimensions. Each dimension has discrete states that combine to form the operating envelope:

| Dimension | Parameters | Range | Update Rate |
|-----------|-----------|-------|-------------|
| **Environmental** | Visibility, precipitation, wind, temperature, humidity, de-icing activity, lighting | Continuous | 1-60s |
| **Temporal** | Time of day, day/night, dawn/dusk transition, shift period | Clock-based | 1 min |
| **Spatial** | Apron zone, taxilane, service road, near aircraft, runway proximity | Position-based | 10 Hz |
| **Operational** | Active turnaround, idle, convoy, emergency, maintenance | Mission-based | Event-driven |

### 1.2 Environmental Parameters

| Parameter | Measurement Source | Range | Safety Impact |
|-----------|-------------------|-------|--------------|
| **Visibility** | METAR RVR, LiDAR return rate | 0-10,000m | Directly limits detection range |
| **Precipitation type** | METAR wx code, camera analysis | None/Rain/Snow/Sleet/Hail/Drizzle | Sensor degradation, braking distance |
| **Precipitation rate** | METAR intensity, rain gauge | Light/Moderate/Heavy | Proportional sensor degradation |
| **Wind speed** | METAR, anemometer | 0-60 kt | Affects vehicle stability, sensor vibration |
| **Wind gusts** | METAR gust value | 0-80 kt | Transient forces on vehicle/cargo |
| **Temperature** | METAR, on-vehicle sensor | -30C to +55C | Compute throttling, sensor performance |
| **Humidity** | METAR, on-vehicle | 0-100% | Lens condensation, sensor fogging |
| **De-icing activity** | Fleet telemetry, AODB status | Binary per stand | 60%+ LiDAR degradation for 30-120s |
| **Jet blast zones** | ADS-B + engine data, fleet reports | Engine type → thrust cone | Invisible hazard, thermal shimmer |
| **Surface condition** | Friction sensor, METAR remarks | Dry/Wet/Flooded/Icy/Snow-covered | Braking distance multiplier |
| **Solar glare** | Ephemeris + cloud cover | Angle, intensity | Camera saturation, retroreflection |
| **FOD density** | Post-departure inspection history | Low/Medium/High | Increases scan duty |

### 1.3 ODD State Classification

The composite ODD state maps the full environmental condition to an operating mode:

| ODD Level | Conditions (Examples) | Max Speed | Safety Margins | Sensor Requirements | Autonomy Level |
|-----------|----------------------|-----------|---------------|--------------------|-|
| **ODD-A (Full)** | Visibility >2000m, no precip, -5C to +40C, wind <20kt, day/lit night | 25 km/h | Normal (per design) | LiDAR primary, all sensors nominal | Full autonomous |
| **ODD-B (Reduced)** | Visibility 500-2000m, light rain, -10C to +45C, wind 20-30kt, any lighting | 15 km/h | +50% margins | LiDAR + radar required, camera optional | Full autonomous, reduced envelope |
| **ODD-C (Degraded)** | Visibility 200-500m, moderate rain/light snow, wind 30-40kt | 10 km/h | +100% margins | Radar primary, LiDAR augmented | Supervised autonomous |
| **ODD-D (Minimal)** | Visibility 100-200m, heavy rain/moderate snow, wind 40-50kt, active de-icing | 5 km/h | +200% margins | Radar + ultrasonic, LiDAR degraded | Teleoperation standby |
| **ODD-E (Suspended)** | Visibility <100m, severe weather, wind >50kt, ice storm, thunderstorm | 0 km/h | N/A | N/A | Safe stop, shelter |

### 1.4 ODD Boundary Conditions (SOTIF Triggering Conditions)

Conditions that represent ODD boundaries — transitioning through these requires explicit handling:

| Boundary | From → To | Triggering Condition | Response Time |
|----------|-----------|---------------------|--------------|
| Day → Night | ODD-A → ODD-A (if lit) or ODD-B (if dark) | Civil twilight, lux < 50 | 15 min transition |
| Clear → Rain | ODD-A → ODD-B | METAR `RA`, LiDAR return rate drop >10% | 30s |
| Rain → Heavy rain | ODD-B → ODD-C | METAR `+RA`, visibility drop below 1000m | 30s |
| Normal → De-icing | ODD-A/B → ODD-D (local) | Fleet reports spray activity at stand | Immediate (5s) |
| Normal → Jet blast | ODD-A/B → ODD-C (local) | ADS-B thrust event, thermal detection | Immediate (2s) |
| Normal → Wind gust | ODD-A → ODD-B/C | Gust >25kt detected | Immediate |
| Thaw → Black ice | ODD-A → ODD-C | Temp crosses 0C downward + wet surface | 5 min |
| Normal → Fog | ODD-A → ODD-C/D | METAR `FG`, visibility <500m | 1-5 min |

---

## 2. Environmental Monitoring: METAR, TAF, and Sensor Feeds

### 2.1 METAR Parsing for ODD Assessment

METAR (Meteorological Aerodrome Report) is the primary standardized weather data source available at every airport. Published every 30-60 minutes (routine) with special reports (SPECI) issued when conditions change significantly:

```python
import re
from dataclasses import dataclass
from typing import Optional, List
from datetime import datetime

@dataclass
class ParsedMETAR:
    """Structured METAR data for ODD assessment."""
    station: str
    observation_time: datetime
    wind_direction_deg: int
    wind_speed_kt: int
    wind_gust_kt: Optional[int]
    visibility_m: int                    # Prevailing visibility in meters
    rvr_m: Optional[dict]               # Runway Visual Range per runway
    weather_phenomena: List[str]          # RA, SN, FG, BR, etc.
    weather_intensity: Optional[str]      # -, (none), +
    sky_condition: List[tuple]           # (cover, height_ft) pairs
    temperature_c: int
    dewpoint_c: int
    altimeter_hpa: float
    remarks: str
    
class METARParser:
    """
    Parse METAR strings into structured ODD-relevant data.
    
    Airside-relevant METAR elements:
    - Wind (KT for vehicle stability)
    - Visibility (M for detection range)
    - Weather (precipitation type/intensity)
    - Temperature (compute/sensor health)
    - RVR (Runway Visual Range — more precise than prevailing vis)
    """
    
    # Weather phenomena codes relevant to ODD
    WEATHER_IMPACT = {
        # Precipitation
        'RA': {'sensor_impact': 0.3, 'braking_factor': 1.3, 'type': 'rain'},
        'SN': {'sensor_impact': 0.5, 'braking_factor': 2.0, 'type': 'snow'},
        'SG': {'sensor_impact': 0.4, 'braking_factor': 1.5, 'type': 'snow_grains'},
        'PL': {'sensor_impact': 0.3, 'braking_factor': 1.8, 'type': 'ice_pellets'},
        'GR': {'sensor_impact': 0.6, 'braking_factor': 1.5, 'type': 'hail'},
        'DZ': {'sensor_impact': 0.2, 'braking_factor': 1.2, 'type': 'drizzle'},
        'FZRA': {'sensor_impact': 0.7, 'braking_factor': 3.0, 'type': 'freezing_rain'},
        'FZDZ': {'sensor_impact': 0.5, 'braking_factor': 2.5, 'type': 'freezing_drizzle'},
        # Obscuration
        'FG': {'sensor_impact': 0.7, 'braking_factor': 1.0, 'type': 'fog'},
        'BR': {'sensor_impact': 0.3, 'braking_factor': 1.0, 'type': 'mist'},
        'HZ': {'sensor_impact': 0.2, 'braking_factor': 1.0, 'type': 'haze'},
        'FU': {'sensor_impact': 0.4, 'braking_factor': 1.0, 'type': 'smoke'},
        'VA': {'sensor_impact': 0.8, 'braking_factor': 1.0, 'type': 'volcanic_ash'},
        # Other
        'TS': {'sensor_impact': 0.3, 'braking_factor': 1.5, 'type': 'thunderstorm'},
        'SQ': {'sensor_impact': 0.2, 'braking_factor': 1.3, 'type': 'squall'},
        'SS': {'sensor_impact': 0.9, 'braking_factor': 1.5, 'type': 'sandstorm'},
        'DS': {'sensor_impact': 0.9, 'braking_factor': 1.5, 'type': 'duststorm'},
    }
    
    INTENSITY_MULTIPLIER = {
        '-': 0.5,    # Light
        None: 1.0,   # Moderate  
        '+': 1.5,    # Heavy
        'VC': 0.3,   # Vicinity (nearby but not at airport)
    }
    
    def parse(self, metar_string: str) -> ParsedMETAR:
        """Parse a raw METAR string."""
        parts = metar_string.strip().split()
        idx = 0
        
        # Station
        station = parts[idx]; idx += 1
        
        # Time (DDHHMMz)
        time_str = parts[idx]; idx += 1
        obs_time = self._parse_time(time_str)
        
        # Wind (dddssKT or dddssGggKT)
        wind_dir, wind_speed, wind_gust = self._parse_wind(parts[idx]); idx += 1
        
        # Variable wind direction (optional)
        if idx < len(parts) and 'V' in parts[idx] and parts[idx][0].isdigit():
            idx += 1  # Skip variable wind direction
        
        # Visibility
        visibility = self._parse_visibility(parts, idx)
        idx += 1
        if idx < len(parts) and parts[idx].startswith('R') and '/' in parts[idx]:
            rvr = self._parse_rvr(parts[idx]); idx += 1
        else:
            rvr = None
        
        # Weather phenomena
        weather = []
        intensity = None
        while idx < len(parts) and self._is_weather(parts[idx]):
            wx, intens = self._parse_weather(parts[idx])
            weather.append(wx)
            if intens:
                intensity = intens
            idx += 1
        
        # Sky condition
        sky = []
        while idx < len(parts) and self._is_sky(parts[idx]):
            sky.append(self._parse_sky(parts[idx]))
            idx += 1
        
        # Temperature/dewpoint
        temp, dewpoint = self._parse_temp(parts[idx]) if idx < len(parts) else (None, None)
        idx += 1
        
        # Altimeter
        altimeter = self._parse_altimeter(parts[idx]) if idx < len(parts) else None
        idx += 1
        
        # Remarks
        remarks = ' '.join(parts[idx:]) if idx < len(parts) else ''
        
        return ParsedMETAR(
            station=station, observation_time=obs_time,
            wind_direction_deg=wind_dir, wind_speed_kt=wind_speed,
            wind_gust_kt=wind_gust, visibility_m=visibility,
            rvr_m=rvr, weather_phenomena=weather,
            weather_intensity=intensity, sky_condition=sky,
            temperature_c=temp, dewpoint_c=dewpoint,
            altimeter_hpa=altimeter, remarks=remarks
        )
    
    def assess_odd_impact(self, metar: ParsedMETAR) -> dict:
        """
        Map parsed METAR to ODD impact assessment.
        
        Returns:
            dict with sensor_impact (0-1), braking_factor (1-3+),
            visibility_class, wind_class, temperature_class
        """
        # Aggregate sensor impact from weather phenomena
        total_sensor_impact = 0
        total_braking_factor = 1.0
        
        for wx in metar.weather_phenomena:
            impact = self.WEATHER_IMPACT.get(wx, {'sensor_impact': 0, 'braking_factor': 1})
            mult = self.INTENSITY_MULTIPLIER.get(metar.weather_intensity, 1.0)
            total_sensor_impact += impact['sensor_impact'] * mult
            total_braking_factor = max(total_braking_factor, 
                                      impact['braking_factor'] * (mult ** 0.5))
        
        total_sensor_impact = min(total_sensor_impact, 1.0)
        
        # Visibility classification
        vis = metar.visibility_m
        if vis >= 5000:
            vis_class = 'EXCELLENT'
        elif vis >= 2000:
            vis_class = 'GOOD'
        elif vis >= 1000:
            vis_class = 'MODERATE'
        elif vis >= 500:
            vis_class = 'POOR'
        elif vis >= 200:
            vis_class = 'VERY_POOR'
        else:
            vis_class = 'NEAR_ZERO'
        
        # Wind classification
        wind = max(metar.wind_speed_kt, metar.wind_gust_kt or 0)
        if wind <= 15:
            wind_class = 'CALM'
        elif wind <= 25:
            wind_class = 'MODERATE'
        elif wind <= 35:
            wind_class = 'STRONG'
        elif wind <= 50:
            wind_class = 'VERY_STRONG'
        else:
            wind_class = 'EXTREME'
        
        # Temperature classification
        temp = metar.temperature_c
        if -10 <= temp <= 40:
            temp_class = 'NORMAL'
        elif -20 <= temp <= 45:
            temp_class = 'MARGINAL'
        elif -30 <= temp <= 50:
            temp_class = 'EXTREME'
        else:
            temp_class = 'BEYOND_LIMITS'
        
        return {
            'sensor_impact': total_sensor_impact,
            'braking_factor': total_braking_factor,
            'visibility_class': vis_class,
            'wind_class': wind_class,
            'temperature_class': temp_class,
            'precipitation': metar.weather_phenomena,
            'raw_visibility_m': vis,
            'raw_wind_kt': wind,
            'raw_temp_c': temp,
        }
```

### 2.2 TAF for Predictive ODD Planning

Terminal Aerodrome Forecast (TAF) provides 24-30 hour weather predictions, enabling proactive ODD management:

```python
class TAFODDPlanner:
    """
    Use TAF forecasts to predict ODD state changes.
    
    Benefits:
    - Pre-position vehicles to sheltered areas before weather deteriorates
    - Schedule charging during predicted weather holds
    - Adjust fleet task allocation for reduced capabilities
    - Alert operators of upcoming ODD transitions
    """
    
    def predict_odd_timeline(self, taf):
        """
        Parse TAF to produce timeline of predicted ODD states.
        
        TAF example: 
        TAF EGLL 110500Z 1106/1212 24008KT 9999 SCT040
            TEMPO 1108/1112 4000 RA BKN020
            BECMG 1112/1114 28015G25KT 6000 -RA BKN025
            PROB30 TEMPO 1118/1206 2000 +RA BKN010
        """
        timeline = []
        
        for period in taf.periods:
            metar_equivalent = self.taf_period_to_metar(period)
            odd_impact = self.metar_parser.assess_odd_impact(metar_equivalent)
            odd_level = self.classify_odd_level(odd_impact)
            
            timeline.append({
                'start': period.start_time,
                'end': period.end_time,
                'change_type': period.type,  # FM, TEMPO, BECMG, PROB
                'probability': period.probability or 100,
                'odd_level': odd_level,
                'impact': odd_impact,
            })
        
        return timeline
    
    def plan_fleet_response(self, timeline):
        """
        Generate proactive fleet management commands from TAF forecast.
        """
        actions = []
        
        for period in timeline:
            if period['odd_level'] == 'ODD-E' and period['probability'] > 50:
                # Severe weather likely — pre-shelter fleet
                shelter_time = period['start'] - timedelta(minutes=15)
                actions.append(FleetAction(
                    time=shelter_time,
                    action='SHELTER_FLEET',
                    reason=f"TAF predicts ODD-E conditions: {period['impact']}"
                ))
            
            elif period['odd_level'] in ('ODD-C', 'ODD-D'):
                # Degraded conditions — reduce fleet, increase margins
                actions.append(FleetAction(
                    time=period['start'] - timedelta(minutes=5),
                    action='REDUCE_SPEED',
                    params={'max_speed_kmh': 10 if period['odd_level'] == 'ODD-C' else 5}
                ))
                actions.append(FleetAction(
                    time=period['start'] - timedelta(minutes=5),
                    action='INCREASE_MARGINS',
                    params={'margin_multiplier': 2.0 if period['odd_level'] == 'ODD-C' else 3.0}
                ))
        
        return actions
```

### 2.3 Real-Time Sensor-Based Environmental Assessment

METAR updates every 30-60 minutes — too slow for airside where conditions change in seconds. On-vehicle sensors provide continuous assessment:

```python
class OnVehicleEnvironmentAssessor:
    """
    Continuous environmental assessment using on-vehicle sensors.
    Complements METAR with 1-10 Hz updates.
    """
    
    def __init__(self):
        # Sensor-derived environmental indicators
        self.lidar_return_rate = 1.0      # Fraction of expected returns (1.0 = clear)
        self.lidar_max_range_m = 100.0    # Current effective max range
        self.radar_snr_db = 25.0          # Radar signal-to-noise ratio
        self.camera_exposure_ms = 10.0    # Camera auto-exposure time
        self.imu_vibration_g = 0.05       # Wind-induced vibration
        self.ambient_temp_c = 20.0        # On-vehicle temperature sensor
        self.ambient_lux = 10000          # Light sensor
        self.surface_friction = 0.8       # If friction sensor available (0-1)
    
    def assess_visibility(self) -> float:
        """
        Estimate visibility from LiDAR return rate.
        
        In fog: 905nm LiDAR returns drop proportionally to visibility.
        Empirical relationship (calibrated):
        visibility_m ≈ -150 * ln(1 - return_rate)
        
        In rain: returns drop due to absorption and scatter.
        Rain attenuation ~0.01 dB/m in heavy rain for 905nm.
        """
        if self.lidar_return_rate > 0.99:
            return 10000  # Effectively unlimited
        elif self.lidar_return_rate > 0.01:
            # Beer-Lambert approximation
            visibility = -150 * np.log(self.lidar_return_rate)
            # Clamp to reasonable range
            return max(50, min(10000, visibility))
        else:
            return 50  # Near-zero returns — very poor visibility
    
    def assess_precipitation(self) -> dict:
        """
        Detect precipitation from multi-sensor cues.
        
        Indicators:
        - LiDAR: ghost points at close range (raindrops), reduced max range
        - Radar: increased noise floor, rain clutter
        - Camera: streaks, droplets on lens, blur
        - Temperature + dewpoint spread (condensation likelihood)
        """
        indicators = {
            'lidar_close_range_noise': self._lidar_noise_ratio(),
            'lidar_range_reduction_pct': (1 - self.lidar_max_range_m / 100) * 100,
            'radar_noise_elevation': self._radar_noise_elevation_db(),
            'camera_blur_score': self._camera_blur_metric(),
            'condensation_risk': max(0, 1 - (self.ambient_temp_c - self._dewpoint()) / 3),
        }
        
        # Simple classifier (replace with trained model in production)
        if indicators['lidar_close_range_noise'] > 0.3:
            if indicators['lidar_range_reduction_pct'] > 30:
                return {'type': 'HEAVY_RAIN', 'confidence': 0.8}
            else:
                return {'type': 'LIGHT_RAIN', 'confidence': 0.7}
        elif indicators['condensation_risk'] > 0.8:
            if indicators['lidar_range_reduction_pct'] > 50:
                return {'type': 'FOG', 'confidence': 0.9}
            else:
                return {'type': 'MIST', 'confidence': 0.6}
        
        return {'type': 'NONE', 'confidence': 0.9}
    
    def assess_wind(self) -> dict:
        """
        Estimate wind from IMU vibration and vehicle dynamics.
        
        Lateral force from wind: F = 0.5 * Cd * A * rho * v_wind^2
        For ADT3 (frontal area ~4 m^2, Cd ~0.8):
        - 15 kt (7.7 m/s): ~95 N lateral force
        - 30 kt (15.4 m/s): ~380 N lateral force  
        - 50 kt (25.7 m/s): ~1060 N lateral force
        
        Detectable via:
        - IMU lateral acceleration when stopped
        - Steering correction required on straight path
        - Oscillation frequency from vibration
        """
        lat_accel = self.imu_vibration_g * 9.81  # m/s^2
        # Rough wind speed estimate from lateral force on known vehicle
        vehicle_area = 4.0    # m^2 frontal area
        vehicle_cd = 0.8
        air_density = 1.225   # kg/m^3
        vehicle_mass = 3000   # kg
        
        # F = m*a = 0.5 * Cd * A * rho * v^2
        # v = sqrt(2*m*a / (Cd * A * rho))
        force = vehicle_mass * lat_accel
        if force > 10:  # Minimum detectable
            wind_speed_ms = np.sqrt(2 * force / (vehicle_cd * vehicle_area * air_density))
            wind_speed_kt = wind_speed_ms * 1.944
        else:
            wind_speed_kt = 0
        
        return {
            'estimated_wind_kt': wind_speed_kt,
            'gust_detected': self._detect_gust(),
            'confidence': 0.5 if wind_speed_kt < 10 else 0.7,
            'source': 'imu_vibration'
        }
    
    def get_composite_assessment(self) -> dict:
        """
        Combine all sensor-derived environmental assessments.
        Returns at 1 Hz.
        """
        return {
            'timestamp': time.now(),
            'visibility_m': self.assess_visibility(),
            'precipitation': self.assess_precipitation(),
            'wind': self.assess_wind(),
            'temperature_c': self.ambient_temp_c,
            'lighting_lux': self.ambient_lux,
            'surface_friction': self.surface_friction,
            'sensor_health': {
                'lidar_return_rate': self.lidar_return_rate,
                'radar_snr_db': self.radar_snr_db,
                'camera_exposure_ms': self.camera_exposure_ms,
            }
        }
```

### 2.4 Multi-Source Environmental Fusion

Combine METAR (authoritative, slow), TAF (predictive, uncertain), on-vehicle sensors (fast, local), and fleet reports (crowdsourced, heterogeneous):

| Source | Update Rate | Spatial Resolution | Authority | Use |
|--------|-----------|-------------------|-----------|-----|
| METAR | 30-60 min | Airport-wide | Official | Baseline ODD, regulatory reporting |
| SPECI | Event-driven | Airport-wide | Official | Rapid weather changes |
| TAF | 6 hours | Airport-wide | Official | Predictive scheduling |
| On-vehicle sensors | 1-10 Hz | Vehicle position (local) | Self-assessed | Real-time local ODD |
| Fleet consensus | 1-10 Hz | Multi-point | Crowd-validated | Spatially resolved ODD map |
| ATIS (Automatic Terminal Information Service) | 30-60 min | Airport-wide | Official | Runway/taxiway conditions |
| Airport operations center | Event-driven | Zone-specific | Authority | De-icing zones, closures |

```python
class EnvironmentalFusion:
    """
    Fuse multiple environmental data sources into authoritative ODD state.
    
    Priority: Official sources override vehicle sensors for regulatory compliance.
    Vehicle sensors provide faster updates within official bounds.
    """
    
    def fuse(self, metar, taf, vehicle_sensors, fleet_reports):
        """
        Produce composite environmental state with confidence.
        
        Rules:
        1. METAR/SPECI sets the official baseline (can't override)
        2. Vehicle sensors can TIGHTEN (not relax) the ODD within METAR bounds
        3. Fleet consensus validates/refines vehicle sensor readings
        4. TAF provides lookahead for planning only (not operational ODD)
        """
        # Start with METAR baseline
        baseline = self.metar_parser.assess_odd_impact(metar)
        
        # Vehicle sensors may detect worse conditions locally
        local = vehicle_sensors.get_composite_assessment()
        
        # Use worst-case between METAR and vehicle sensors
        fused_visibility = min(baseline['raw_visibility_m'], local['visibility_m'])
        fused_wind = max(baseline['raw_wind_kt'], local['wind']['estimated_wind_kt'])
        fused_temp = local['temperature_c']  # Vehicle sensor is more accurate locally
        
        # Fleet consensus for spatial resolution
        if fleet_reports:
            zone_conditions = self._compute_fleet_consensus(fleet_reports)
            # If 3+ vehicles in same zone report degradation, trust fleet
            if zone_conditions.get(vehicle_sensors.current_zone, {}).get('agreement', 0) >= 3:
                fleet_visibility = zone_conditions[vehicle_sensors.current_zone]['visibility']
                fused_visibility = min(fused_visibility, fleet_visibility)
        
        # Cannot relax beyond METAR — only tighten
        fused_visibility = min(fused_visibility, baseline['raw_visibility_m'])
        
        return {
            'visibility_m': fused_visibility,
            'wind_kt': fused_wind,
            'temperature_c': fused_temp,
            'precipitation': local['precipitation'],
            'sensor_impact': max(baseline['sensor_impact'], 
                                1 - local['sensor_health']['lidar_return_rate']),
            'braking_factor': baseline['braking_factor'],
            'sources': ['METAR', 'vehicle_sensors', 'fleet_consensus'],
            'confidence': 0.9,
        }
```

---

## 3. Capability Curves: Environment to Performance Mapping

### 3.1 Perception Performance vs Environment

Each perception component has a measurable performance degradation curve as environmental conditions change:

| Condition | LiDAR mAP Retention | Radar mAP Retention | Camera mAP Retention | Thermal mAP Retention |
|-----------|---------------------|--------------------|--------------------|---------------------|
| Clear day | 100% | 100% | 100% | 85% (daytime) |
| Clear night | 100% | 100% | 40-60% (lit) / 10-20% (unlit) | 100% |
| Light rain | 90-95% | 98% | 80-90% | 95% |
| Heavy rain | 60-75% | 90-95% | 40-60% | 90% |
| Light fog (500m vis) | 70-85% | 95% | 60-80% | 85% |
| Dense fog (100m vis) | 30-50% | 85-90% | 20-40% | 70% |
| Light snow | 80-90% | 95% | 70-85% | 90% |
| Heavy snow | 40-60% | 80-85% | 30-50% | 80% |
| De-icing spray | 10-40% (30s burst) | 95% | 50-70% (lens contamination) | 60-80% |
| Jet blast zone | 90% (shimmer) | 95% | 70-80% (shimmer) | 20-40% (saturation) |
| Direct sun glare | 100% | 100% | 30-50% (in glare direction) | 100% |

### 3.2 Capability Curves as Functions

```python
class CapabilityCurves:
    """
    Maps environmental parameters to system capability scores.
    
    Calibrated from empirical testing + literature.
    Regularly updated from fleet data (data flywheel).
    """
    
    def lidar_capability(self, visibility_m, precipitation, deicing_active):
        """
        LiDAR detection capability as function of environment.
        Returns: capability score 0-1 (1 = full performance)
        """
        # Visibility-based degradation (Beer-Lambert for 905nm)
        if visibility_m >= 5000:
            vis_factor = 1.0
        elif visibility_m >= 1000:
            vis_factor = 0.7 + 0.3 * (visibility_m - 1000) / 4000
        elif visibility_m >= 200:
            vis_factor = 0.3 + 0.4 * (visibility_m - 200) / 800
        else:
            vis_factor = 0.3 * visibility_m / 200
        
        # Precipitation degradation
        precip_factors = {
            'NONE': 1.0, 'DRIZZLE': 0.95, 'LIGHT_RAIN': 0.90,
            'MODERATE_RAIN': 0.75, 'HEAVY_RAIN': 0.60,
            'LIGHT_SNOW': 0.85, 'MODERATE_SNOW': 0.65, 'HEAVY_SNOW': 0.40,
            'FREEZING_RAIN': 0.50, 'HAIL': 0.55,
        }
        precip_factor = precip_factors.get(precipitation, 0.5)
        
        # De-icing spray (binary, severe, local)
        deicing_factor = 0.25 if deicing_active else 1.0
        
        return vis_factor * precip_factor * deicing_factor
    
    def radar_capability(self, visibility_m, precipitation, wind_kt):
        """
        Radar is largely weather-immune but degrades in extreme conditions.
        """
        # Radar propagation barely affected by visibility
        # Heavy rain causes clutter but maintains detection
        precip_degradation = {
            'NONE': 1.0, 'LIGHT_RAIN': 0.98, 'HEAVY_RAIN': 0.90,
            'LIGHT_SNOW': 0.95, 'HEAVY_SNOW': 0.85,
        }
        precip_factor = precip_degradation.get(precipitation, 0.85)
        
        # Wind vibration affects antenna pointing (minimal for solid-state)
        wind_factor = 1.0 if wind_kt < 40 else max(0.8, 1.0 - (wind_kt - 40) / 100)
        
        return precip_factor * wind_factor
    
    def compute_safe_speed(self, environment):
        """
        Compute maximum safe speed from environmental conditions.
        
        Constraints:
        1. Stopping distance must be within detection range
        2. Detection range depends on sensor capability
        3. Braking distance depends on surface conditions
        4. Add safety margin (1.5x for airside proximity to aircraft)
        
        v_max = sqrt(2 * a_brake * d_detect / (safety_factor * braking_factor))
        """
        # Effective detection range (worst of LiDAR/radar weighted by capability)
        lidar_cap = self.lidar_capability(
            environment['visibility_m'], 
            environment['precipitation']['type'],
            environment.get('deicing_active', False)
        )
        radar_cap = self.radar_capability(
            environment['visibility_m'],
            environment['precipitation']['type'],
            environment['wind_kt']
        )
        
        # Detection range = max(lidar_range * lidar_cap, radar_range * radar_cap)
        lidar_range = 100 * lidar_cap  # 100m nominal, scales with capability
        radar_range = 200 * radar_cap  # 200m nominal (Continental ARS548)
        detection_range = max(lidar_range, radar_range)
        
        # Braking parameters
        a_brake = 3.0  # m/s^2 conservative braking deceleration
        braking_factor = environment.get('braking_factor', 1.0)
        safety_factor = 1.5  # Airside safety margin
        
        # v = sqrt(2 * a * d / (sf * bf))
        v_max_ms = np.sqrt(
            2 * a_brake * detection_range / (safety_factor * braking_factor)
        )
        v_max_kmh = v_max_ms * 3.6
        
        # Clamp to operational limits
        v_max_kmh = min(v_max_kmh, 25)  # Max airside speed
        v_max_kmh = max(v_max_kmh, 0)   # Can't go negative
        
        return v_max_kmh
    
    def compute_safety_margins(self, environment):
        """
        Compute safety margin multipliers for all dimensions.
        """
        lidar_cap = self.lidar_capability(
            environment['visibility_m'],
            environment['precipitation']['type'],
            environment.get('deicing_active', False)
        )
        
        # Margins inversely proportional to capability
        if lidar_cap > 0.8:
            margin_mult = 1.0      # Normal
        elif lidar_cap > 0.5:
            margin_mult = 1.5      # Degraded — 50% more margin
        elif lidar_cap > 0.3:
            margin_mult = 2.0      # Poor — double margins
        elif lidar_cap > 0.1:
            margin_mult = 3.0      # Very poor — triple margins
        else:
            margin_mult = float('inf')  # Cannot operate
        
        return {
            'lateral_margin_mult': margin_mult,
            'longitudinal_margin_mult': margin_mult * environment.get('braking_factor', 1.0),
            'aircraft_clearance_mult': max(1.0, margin_mult * 0.8),  # Minimum 1.0x
            'personnel_clearance_mult': max(1.5, margin_mult),  # Minimum 1.5x
        }
```

---

## 4. ODD State Machine and Fallback Orchestration

### 4.1 State Machine Definition

```python
class ODDStateMachine:
    """
    Manages transitions between ODD levels with hysteresis and safety guarantees.
    
    State transitions are asymmetric:
    - Degradation (A→B→C→D→E): FAST — triggered immediately on condition detection
    - Recovery (E→D→C→B→A): SLOW — requires sustained good conditions
    
    This asymmetry ensures the system is always conservative.
    """
    
    STATES = ['ODD_A', 'ODD_B', 'ODD_C', 'ODD_D', 'ODD_E']
    
    # Transition thresholds (degradation direction)
    DEGRADE_THRESHOLDS = {
        ('ODD_A', 'ODD_B'): {
            'visibility_below': 2000,
            'wind_above_kt': 20,
            'sensor_impact_above': 0.2,
            'precip_types': ['LIGHT_RAIN', 'DRIZZLE', 'MIST'],
            'hold_time_s': 0,  # Immediate degradation
        },
        ('ODD_B', 'ODD_C'): {
            'visibility_below': 500,
            'wind_above_kt': 30,
            'sensor_impact_above': 0.4,
            'precip_types': ['MODERATE_RAIN', 'LIGHT_SNOW', 'FOG'],
            'hold_time_s': 0,
        },
        ('ODD_C', 'ODD_D'): {
            'visibility_below': 200,
            'wind_above_kt': 40,
            'sensor_impact_above': 0.6,
            'precip_types': ['HEAVY_RAIN', 'MODERATE_SNOW', 'FREEZING_RAIN'],
            'hold_time_s': 0,
        },
        ('ODD_D', 'ODD_E'): {
            'visibility_below': 100,
            'wind_above_kt': 50,
            'sensor_impact_above': 0.8,
            'precip_types': ['HEAVY_SNOW', 'THUNDERSTORM', 'HAIL', 'ICE_STORM'],
            'hold_time_s': 0,
        },
    }
    
    # Recovery thresholds (improvement direction) — require sustained good conditions
    RECOVER_THRESHOLDS = {
        ('ODD_E', 'ODD_D'): {'hold_time_s': 300, 'visibility_above': 150},   # 5 min
        ('ODD_D', 'ODD_C'): {'hold_time_s': 180, 'visibility_above': 300},   # 3 min
        ('ODD_C', 'ODD_B'): {'hold_time_s': 120, 'visibility_above': 800},   # 2 min
        ('ODD_B', 'ODD_A'): {'hold_time_s': 300, 'visibility_above': 3000},  # 5 min
    }
    
    def __init__(self):
        self.current_state = 'ODD_A'
        self.state_entered_at = time.time()
        self.recovery_timer = {}
        self.history = []
    
    def update(self, environment):
        """
        Evaluate environment against thresholds and transition if needed.
        Called at 1 Hz.
        """
        old_state = self.current_state
        
        # Check degradation (fast — any single condition triggers)
        for (from_state, to_state), thresholds in self.DEGRADE_THRESHOLDS.items():
            if self.current_state != from_state:
                continue
            
            should_degrade = False
            reasons = []
            
            if environment['visibility_m'] < thresholds['visibility_below']:
                should_degrade = True
                reasons.append(f"visibility {environment['visibility_m']}m < {thresholds['visibility_below']}m")
            
            if environment['wind_kt'] > thresholds['wind_above_kt']:
                should_degrade = True
                reasons.append(f"wind {environment['wind_kt']}kt > {thresholds['wind_above_kt']}kt")
            
            if environment['sensor_impact'] > thresholds['sensor_impact_above']:
                should_degrade = True
                reasons.append(f"sensor impact {environment['sensor_impact']:.2f}")
            
            precip_type = environment['precipitation'].get('type', 'NONE')
            if precip_type in thresholds['precip_types']:
                should_degrade = True
                reasons.append(f"precipitation: {precip_type}")
            
            if should_degrade:
                self.transition(to_state, reasons)
                # Check for further degradation (can skip levels)
                return self.update(environment)
        
        # Check recovery (slow — requires sustained improvement)
        for (from_state, to_state), thresholds in self.RECOVER_THRESHOLDS.items():
            if self.current_state != from_state:
                continue
            
            conditions_met = True
            if environment['visibility_m'] < thresholds.get('visibility_above', 0):
                conditions_met = False
            
            if conditions_met:
                key = (from_state, to_state)
                if key not in self.recovery_timer:
                    self.recovery_timer[key] = time.time()
                
                elapsed = time.time() - self.recovery_timer[key]
                if elapsed >= thresholds['hold_time_s']:
                    self.transition(to_state, [f"sustained improvement for {elapsed:.0f}s"])
                    del self.recovery_timer[key]
            else:
                # Conditions not met — reset recovery timer
                key = (from_state, to_state)
                if key in self.recovery_timer:
                    del self.recovery_timer[key]
        
        if self.current_state != old_state:
            self.on_state_change(old_state, self.current_state)
    
    def transition(self, new_state, reasons):
        """Execute state transition with logging and notifications."""
        old = self.current_state
        self.current_state = new_state
        self.state_entered_at = time.time()
        
        self.history.append({
            'timestamp': time.time(),
            'from': old,
            'to': new_state,
            'reasons': reasons,
        })
        
        rospy.logwarn(f"ODD TRANSITION: {old} -> {new_state} | {', '.join(reasons)}")
    
    def on_state_change(self, old_state, new_state):
        """Trigger system-wide responses to ODD change."""
        state_idx = self.STATES.index
        
        if state_idx(new_state) > state_idx(old_state):
            # Degradation — apply restrictions
            self.apply_speed_limit(new_state)
            self.apply_margin_increase(new_state)
            self.notify_fleet_manager(new_state)
            
            if new_state == 'ODD_E':
                self.command_safe_stop()
            elif new_state == 'ODD_D':
                self.activate_teleoperation_standby()
        else:
            # Recovery — relax restrictions (gradually)
            self.apply_speed_limit(new_state)
            self.apply_margin_increase(new_state)
```

### 4.2 Fallback Hierarchy

```
ODD-A (Full)
  │ Speed: 25 km/h, Margins: 1.0x, Sensors: All nominal
  │ Autonomy: Full autonomous
  ▼
ODD-B (Reduced)
  │ Speed: 15 km/h, Margins: 1.5x, Sensors: LiDAR+Radar required
  │ Autonomy: Full autonomous, reduced envelope
  ▼
ODD-C (Degraded)
  │ Speed: 10 km/h, Margins: 2.0x, Sensors: Radar primary
  │ Autonomy: Supervised autonomous (operator monitoring)
  │ Actions: Alert operator, increase reporting frequency
  ▼
ODD-D (Minimal)
  │ Speed: 5 km/h, Margins: 3.0x, Sensors: Radar+Ultrasonic
  │ Autonomy: Teleoperation standby (operator ready to take over)
  │ Actions: No new task acceptance, complete current or safe stop
  ▼
ODD-E (Suspended)
  │ Speed: 0 km/h (safe stop)
  │ Autonomy: None — vehicle parked with hazard lights
  │ Actions: Navigate to nearest safe parking, notify fleet manager
```

---

## 5. Visibility and Precipitation Handling

### 5.1 Visibility Impact Matrix

| Visibility Range | LiDAR Effective Range | Radar Effective Range | Primary Sensor | Max Safe Speed | Operational Actions |
|-----------------|---------------------|--------------------|----------------|---------------|-------------------|
| >5000m | 100m | 200m+ | LiDAR | 25 km/h | Normal operations |
| 2000-5000m | 80-100m | 200m+ | LiDAR | 25 km/h | Normal, radar augmented |
| 1000-2000m | 50-80m | 200m+ | LiDAR + Radar | 15-20 km/h | Reduce speed, increase margins |
| 500-1000m | 30-50m | 180m+ | Radar primary | 10-15 km/h | Switch to radar-primary fusion |
| 200-500m | 15-30m | 150m+ | Radar primary | 8-10 km/h | Supervised mode, operator alert |
| 100-200m | 5-15m | 120m+ | Radar primary | 5 km/h | Minimum operations, teleop standby |
| <100m | <5m | 80-100m | Radar only | 0 km/h | Safe stop |

### 5.2 Precipitation-Specific Responses

**Rain**:
- Light: LiDAR RANSAC filters rain returns (existing pipeline). Reduce confidence thresholds by 10%.
- Moderate: Activate radar-guided LiDAR denoising (L4DR approach). Reduce max speed to 15 km/h. Increase following distance 30%.
- Heavy: Switch to radar-primary fusion. LiDAR serves only for near-field (<20m). Max 10 km/h. No docking operations.

**Snow**:
- Accumulation >2cm: Switch to radar-primary. LiDAR reflections from snow surface confuse ground plane detection.
- Active snowfall: Similar to rain but with additional concern about LiDAR lens contamination. Activate heating if available.
- Plowed surfaces: Snow banks change map geometry. Increase lateral margins to account for narrowed lanes.

**Fog**:
- LiDAR severely affected (905nm absorption by water droplets). Radar essentially unaffected.
- Transition to radar-primary mode at visibility <1000m.
- Dense fog (<200m): Only radar provides useful detection. LiDAR reduced to ultrasonic-range obstacle detection.
- Fog is the strongest case for 4D radar as primary sensor rather than backup.

**De-icing spray**:
- Most severe short-duration degradation: 60%+ LiDAR loss for 30-120 seconds.
- Detected by fleet telemetry (de-icing truck active at stand) or sudden LiDAR return rate drop.
- Response: immediate switch to radar-primary, stop if within spray zone, resume after spray clears.
- See `cross-cutting/radar-lidar-fusion-adverse-weather.md` for detailed de-icing handling.

---

## 6. Wind and Jet Blast Effects

### 6.1 Wind Effects on Vehicle and Sensors

| Wind Speed | Vehicle Impact | Sensor Impact | Cargo Impact | ODD Action |
|-----------|---------------|--------------|-------------|-----------|
| 0-15 kt | None | None | None | Normal |
| 15-25 kt | Slight lateral drift | Minor vibration | Light items may shift | Increase lateral margin 20% |
| 25-35 kt | Noticeable lateral force | LiDAR mount vibration, camera shake | Cargo restraint required | Reduce speed to 15 km/h |
| 35-45 kt | Significant steering correction | Measurable scan distortion | Risk of unsecured items | Reduce to 10 km/h, no open cargo ops |
| 45-55 kt | Stability risk for high-profile GSE | Severe vibration | Grounding operations | Reduce to 5 km/h, shelter high-profile |
| >55 kt | Tipping risk | Unusable | All ground ops suspended | Safe stop, shelter all vehicles |

### 6.2 Jet Blast Integration

Jet blast zones are the most dangerous environmental hazard on the airside and are invisible to LiDAR, camera, and radar — only detectable by thermal cameras or ADS-B/engine status inference:

```python
class JetBlastODDManager:
    """
    Integrate jet blast awareness into ODD management.
    
    Key data sources:
    - ADS-B: aircraft position, engine type, taxi/takeoff state
    - Fleet telemetry: thermal camera detections of exhaust plumes
    - A-CDM: predicted push-back and engine start times
    """
    
    # Exhaust danger zones by engine type (meters behind engine)
    ENGINE_ZONES = {
        'CFM56':  {'danger': 50, 'caution': 100, 'awareness': 200},  # B737
        'LEAP-1A': {'danger': 55, 'caution': 110, 'awareness': 220},  # A320neo
        'LEAP-1B': {'danger': 55, 'caution': 110, 'awareness': 220},  # B737 MAX
        'PW1100G': {'danger': 50, 'caution': 100, 'awareness': 200},  # A320neo
        'GE90':   {'danger': 80, 'caution': 160, 'awareness': 300},  # B777
        'Trent_XWB': {'danger': 85, 'caution': 170, 'awareness': 320}, # A350
        'GEnx':   {'danger': 75, 'caution': 150, 'awareness': 280},   # B787
        'CF6':    {'danger': 70, 'caution': 140, 'awareness': 260},   # B747/767
    }
    
    def get_jet_blast_zones(self, aircraft_positions):
        """
        Compute current jet blast exclusion zones.
        Returns list of polygons with danger levels.
        """
        zones = []
        for ac in aircraft_positions:
            if ac.engines_running:
                engine = self.ENGINE_ZONES.get(ac.engine_type, 
                                               {'danger': 60, 'caution': 120, 'awareness': 240})
                
                # Compute cone behind each engine
                for engine_pos in ac.engine_positions:
                    heading = ac.heading_deg + 180  # Behind aircraft
                    
                    # Wind deflects the exhaust cone
                    wind_deflection = self.compute_wind_deflection(
                        ac.heading_deg, self.current_wind
                    )
                    
                    cone = self.build_exhaust_cone(
                        origin=engine_pos,
                        heading=heading + wind_deflection,
                        distances=engine,
                        half_angle=15  # degrees
                    )
                    zones.append(cone)
        
        return zones
    
    def apply_jet_blast_odd(self, vehicle_position, zones):
        """
        Check if vehicle is in any jet blast zone.
        Returns ODD restriction to apply.
        """
        for zone in zones:
            if zone.danger_zone.contains(vehicle_position):
                return 'ODD_E'  # Immediate safe stop — life-threatening
            elif zone.caution_zone.contains(vehicle_position):
                return 'ODD_D'  # Minimum speed, avoid zone
            elif zone.awareness_zone.contains(vehicle_position):
                return 'ODD_C'  # Reduced speed, increased monitoring
        
        return None  # No jet blast restriction
```

---

## 7. Temperature Extremes and Thermal Effects

### 7.1 Temperature Impact on System Components

| Temperature | Orin Compute | LiDAR | Battery | Braking | ODD Impact |
|-------------|-------------|-------|---------|---------|-----------|
| -30 to -20C | Normal (heated enclosure) | Reduced range 5-10% | Capacity -30-40%, slow charging | Icy surface 3x distance | ODD-C minimum |
| -20 to -10C | Normal | Slight range reduction | Capacity -15-25% | Potentially icy 1.5-2x | ODD-B if icy |
| -10 to +5C | Normal | Normal | Capacity -5-10% | Normal if dry | ODD-A |
| +5 to +35C | Normal | Normal | Normal | Normal | ODD-A |
| +35 to +45C | Possible throttling | Normal | Reduced charge rate | Normal | ODD-A/B |
| +45 to +50C | Throttling likely (-10-20% throughput) | Normal | Limited charging | Normal | ODD-B |
| +50 to +55C | Severe throttling | Slight degradation | No charging | Normal | ODD-C |
| >+55C | Shutdown protection | Damage risk | Damage risk | Normal | ODD-E |

### 7.2 Thermal Management Integration

```python
class ThermalODDManager:
    """
    Temperature-aware ODD management.
    Integrates with energy-efficient inference scheduling.
    """
    
    def assess_thermal_odd(self, vehicle_state):
        """Check temperature-related ODD constraints."""
        orin_temp = vehicle_state.orin_junction_temp_c
        ambient_temp = vehicle_state.ambient_temp_c
        battery_temp = vehicle_state.battery_temp_c
        
        restrictions = []
        
        # Orin thermal
        if orin_temp > 95:
            restrictions.append(('ODD_E', 'Orin critical temperature'))
        elif orin_temp > 85:
            restrictions.append(('ODD_C', f'Orin thermal throttling at {orin_temp}C'))
        elif orin_temp > 75:
            restrictions.append(('ODD_B', 'Orin elevated temperature'))
        
        # Battery thermal
        if battery_temp > 55 or battery_temp < -25:
            restrictions.append(('ODD_D', f'Battery temperature {battery_temp}C outside safe range'))
        elif battery_temp > 45 or battery_temp < -15:
            restrictions.append(('ODD_B', f'Battery temperature marginal: {battery_temp}C'))
        
        # Ambient effects on braking
        if ambient_temp < -5:
            # Check for ice risk (temp below 0 + wet surface)
            if vehicle_state.surface_wet:
                restrictions.append(('ODD_C', f'Ice risk: {ambient_temp}C + wet surface'))
        
        if ambient_temp > 50:
            restrictions.append(('ODD_C', f'Extreme heat: {ambient_temp}C'))
        
        # Return most restrictive
        if restrictions:
            worst = min(restrictions, key=lambda r: self.STATES.index(r[0]))
            return worst
        
        return ('ODD_A', 'Temperature nominal')
```

---

## 8. Lighting Conditions and Transitions

### 8.1 Lighting Impact on Perception

| Condition | Lux Level | Camera Impact | LiDAR Impact | Thermal Impact | Required Response |
|-----------|-----------|--------------|-------------|---------------|------------------|
| Bright sun | >50,000 | Glare risk, saturation | None | Reduced contrast | Auto-exposure, NDFilter |
| Overcast day | 5,000-20,000 | Optimal | None | Good contrast | Normal |
| Dawn/dusk | 100-5,000 | Rapidly changing exposure | None | Excellent | Transition mode |
| Well-lit night | 50-200 | Usable with long exposure | None | Optimal | Camera optional, thermal primary |
| Poorly lit night | 5-50 | Marginal | None | Optimal | Camera disabled, thermal required |
| Unlit night | <5 | Unusable | None | Optimal | LiDAR + thermal only |

### 8.2 Dawn/Dusk Transition Management

Dawn and dusk are challenging because lighting changes rapidly (30-60 minutes from daylight to darkness) and auto-exposure systems oscillate:

```python
class LightingTransitionManager:
    """
    Manage perception mode transitions at dawn/dusk.
    
    Challenge: camera auto-exposure hunts during rapid lux changes.
    Solution: pre-computed ephemeris triggers proactive mode switch.
    """
    
    def __init__(self, airport_lat, airport_lon):
        self.lat = airport_lat
        self.lon = airport_lon
        self.ephemeris = Ephemeris(airport_lat, airport_lon)
    
    def get_lighting_mode(self, current_time):
        """
        Determine lighting mode from solar ephemeris + light sensor.
        """
        sun_altitude = self.ephemeris.sun_altitude(current_time)
        
        if sun_altitude > 10:
            return 'DAY'
        elif sun_altitude > 0:
            return 'GOLDEN_HOUR'  # Low sun, glare risk
        elif sun_altitude > -6:
            return 'CIVIL_TWILIGHT'  # Rapidly changing
        elif sun_altitude > -12:
            return 'NAUTICAL_TWILIGHT'  # Dim, camera marginal
        else:
            return 'NIGHT'
    
    def get_perception_mode(self, lighting_mode, apron_lighting):
        """
        Select perception mode based on lighting.
        """
        modes = {
            'DAY': {
                'camera': 'ACTIVE', 'thermal': 'STANDBY',
                'lidar': 'PRIMARY', 'odd_impact': None
            },
            'GOLDEN_HOUR': {
                'camera': 'ACTIVE_GLARE_FILTER', 'thermal': 'ACTIVE',
                'lidar': 'PRIMARY', 'odd_impact': 'ODD_B'  # Sun glare risk
            },
            'CIVIL_TWILIGHT': {
                'camera': 'ACTIVE_HIGH_GAIN', 'thermal': 'ACTIVE',
                'lidar': 'PRIMARY', 'odd_impact': None
            },
            'NAUTICAL_TWILIGHT': {
                'camera': 'DEGRADED', 'thermal': 'PRIMARY_VISUAL',
                'lidar': 'PRIMARY', 'odd_impact': 'ODD_B' if not apron_lighting else None
            },
            'NIGHT': {
                'camera': 'DISABLED' if not apron_lighting else 'ACTIVE_NIGHT',
                'thermal': 'PRIMARY_VISUAL',
                'lidar': 'PRIMARY',
                'odd_impact': 'ODD_B' if not apron_lighting else None
            },
        }
        
        return modes.get(lighting_mode, modes['NIGHT'])
```

---

## 9. Seasonal Adaptation Profiles

### 9.1 Seasonal ODD Profiles

| Season | Dominant Conditions | ODD Profile | Adaptation |
|--------|-------------------|-------------|-----------|
| **Summer** (Jun-Aug) | Heat (+30-50C), sun glare, thunderstorms, long days | Heat-adapted: proactive thermal throttling, afternoon ODD-B/C for storms | Pre-dawn/post-dusk extended autonomous window |
| **Autumn** (Sep-Nov) | Fog, rain, reducing daylight, leaf debris | Fog-adapted: radar-primary mode frequent, cleaning schedule increased | Shorter autonomous window, 4-6 METAR fog events/month |
| **Winter** (Dec-Feb) | Snow, ice, de-icing, short days, low temps | Cold-adapted: battery conservation, extended warm-up, de-icing avoidance | Most restrictive ODD, 3-5 ODD-D/E events per month |
| **Spring** (Mar-May) | Rain, variable conditions, temperature swings | Transition-adapted: frequent ODD changes (5-10 per day), thaw/freeze cycles | Dynamic mode, rapid ODD transitions |

### 9.2 Seasonal Calibration

```python
class SeasonalODDCalibrator:
    """
    Adjust ODD thresholds based on seasonal fleet performance data.
    
    Key insight: the relationship between weather and perception performance
    changes with season due to:
    - LiDAR lens contamination rates (de-icing fluid in winter vs dust in summer)
    - Surface reflectivity (wet vs dry vs snow-covered)
    - Ambient temperature effects on sensor electronics
    - Daylight hours affecting camera availability
    """
    
    SEASONAL_ADJUSTMENTS = {
        'winter': {
            'visibility_threshold_mult': 1.3,   # Require 30% more visibility
            'wind_threshold_mult': 0.85,         # Lower wind tolerance (ice)
            'min_battery_reserve': 0.25,          # 25% reserve (cold reduces capacity)
            'cleaning_interval_hours': 24,        # Clean sensors daily
            'max_speed_reduction_pct': 15,        # 15% general speed reduction
        },
        'summer': {
            'visibility_threshold_mult': 1.0,
            'wind_threshold_mult': 1.0,
            'min_battery_reserve': 0.15,
            'cleaning_interval_hours': 72,
            'max_speed_reduction_pct': 0,
            'thermal_throttle_ambient_c': 42,    # Start proactive throttling at 42C
        },
        'spring': {
            'visibility_threshold_mult': 1.1,
            'wind_threshold_mult': 0.95,
            'min_battery_reserve': 0.20,
            'cleaning_interval_hours': 48,
            'max_speed_reduction_pct': 5,
        },
        'autumn': {
            'visibility_threshold_mult': 1.2,
            'wind_threshold_mult': 0.95,
            'min_battery_reserve': 0.20,
            'cleaning_interval_hours': 48,
            'max_speed_reduction_pct': 5,
        },
    }
    
    def get_current_profile(self):
        """Get seasonal adjustments for current date."""
        month = datetime.now().month
        if month in (12, 1, 2):
            return self.SEASONAL_ADJUSTMENTS['winter']
        elif month in (3, 4, 5):
            return self.SEASONAL_ADJUSTMENTS['spring']
        elif month in (6, 7, 8):
            return self.SEASONAL_ADJUSTMENTS['summer']
        else:
            return self.SEASONAL_ADJUSTMENTS['autumn']
```

---

## 10. Dynamic Speed and Margin Adjustment

### 10.1 Continuous Speed Envelope

Rather than discrete speed steps, the safe speed is a continuous function of environmental conditions:

```python
class DynamicSpeedEnvelope:
    """
    Compute maximum safe speed as continuous function of environment.
    
    v_max = min(
        v_detection_limited,    # Stop within detection range
        v_braking_limited,      # Stop within available friction
        v_wind_limited,         # Maintain stability in wind
        v_odd_limit,            # ODD state speed cap
        v_zone_limit,           # Spatial zone speed limit
        25 km/h                 # Absolute airside max
    )
    """
    
    def compute(self, environment, vehicle_state, zone):
        """Returns max safe speed in km/h."""
        
        # Detection-limited speed
        capability = self.get_best_sensor_capability(environment)
        detection_range = capability['effective_range_m']
        reaction_time = 0.5  # seconds (autonomous system)
        braking_decel = 3.0 / environment.get('braking_factor', 1.0)  # m/s^2
        safety_factor = 1.5
        
        # v^2 = 2*a*d - 2*a*v*t_react (solve quadratic)
        # Simplified: v_max = sqrt(2 * a * d / sf) - a * t_react
        v_detect = np.sqrt(2 * braking_decel * detection_range / safety_factor)
        v_detect = max(0, v_detect - braking_decel * reaction_time)
        v_detect_kmh = v_detect * 3.6
        
        # Braking-limited speed (surface condition)
        friction = environment.get('surface_friction', 0.8)
        v_brake_ms = np.sqrt(2 * 9.81 * friction * 5.0)  # 5m safe stop distance
        v_brake_kmh = v_brake_ms * 3.6
        
        # Wind-limited speed (lateral stability)
        wind_kt = environment['wind_kt']
        if wind_kt > 50:
            v_wind_kmh = 0
        elif wind_kt > 35:
            v_wind_kmh = 10
        elif wind_kt > 25:
            v_wind_kmh = 15
        else:
            v_wind_kmh = 25
        
        # ODD state limit
        odd_limits = {'ODD_A': 25, 'ODD_B': 15, 'ODD_C': 10, 'ODD_D': 5, 'ODD_E': 0}
        v_odd_kmh = odd_limits.get(self.odd_state, 0)
        
        # Zone limit (spatial)
        v_zone_kmh = zone.speed_limit_kmh
        
        # Final: minimum of all constraints
        v_max = min(v_detect_kmh, v_brake_kmh, v_wind_kmh, v_odd_kmh, v_zone_kmh, 25)
        
        return max(0, v_max)
```

### 10.2 Margin Adjustment by Environment

| Margin Type | ODD-A (Normal) | ODD-B | ODD-C | ODD-D | Formula |
|-------------|---------------|-------|-------|-------|---------|
| Lateral buffer to static objects | 0.5m | 0.75m | 1.0m | 1.5m | base × margin_mult |
| Following distance | 2.0m + 0.5s×v | 3.0m + 0.8s×v | 4.0m + 1.0s×v | 5.0m + 1.5s×v | base × margin_mult |
| Aircraft clearance | 3.0m | 4.0m | 5.0m | 7.0m | Minimum, non-negotiable |
| Personnel clearance | 2.0m | 3.0m | 4.0m | 5.0m | Safety-critical, conservative |
| Jet blast zone avoidance | Zone boundary | +20m buffer | +50m buffer | +100m buffer | Airside-specific |

---

## 11. Standards Compliance

### 11.1 ISO 34502 (ODD Taxonomy)

ISO 34502 provides a framework for scenario description and ODD taxonomy. Airside mapping:

| ISO 34502 Dimension | Airside Instantiation |
|--------------------|---------------------|
| Road type | Taxilane, service road, apron, stand area |
| Speed range | 0-25 km/h (all airside) |
| Weather | METAR-derived: visibility, precipitation, wind, temperature |
| Lighting | Day/twilight/night, apron lighting level |
| Connectivity | 5G/CBRS, V2X, A-CDM |
| Traffic participants | Aircraft, GSE (8-12 types), personnel, FOD |
| Special conditions | Jet blast, de-icing, runway proximity |

### 11.2 ISO 21448 (SOTIF) Compliance

SOTIF requires identifying performance limitations and their safety impact:

| SOTIF Requirement | Implementation |
|------------------|---------------|
| Triggering conditions | Weather phenomena + sensor degradation curves |
| Performance limitation identification | Capability curves per sensor per condition |
| Hazardous behavior prevention | ODD state machine with conservative transitions |
| Residual risk reduction | Continuous fleet data collection refining capability curves |
| Validation coverage | Seasonal testing across all ODD states |

### 11.3 ISO 3691-4 (Industrial AGV) Mapping

ISO 3691-4 requires environmental condition assessment for automated guided vehicles:

| ISO 3691-4 Clause | ODD Implementation |
|-------------------|-------------------|
| 4.8 Environmental conditions | ODD taxonomy (Section 1) |
| 4.9 Degraded mode | ODD state machine fallbacks (Section 4) |
| 5.3.2 Performance limits | Capability curves (Section 3) |
| 5.4 Warning systems | ODD transition notifications |

### 11.4 EU AI Act and 2027 Machinery Regulation

| Requirement | ODD System Compliance |
|-------------|---------------------|
| **Transparency** | ODD state and reasons published at 1 Hz via ROS topics |
| **Human oversight** | Teleop standby at ODD-D, operator monitoring at ODD-C |
| **Robustness** | Tested across all ODD states with coverage evidence |
| **Risk management** | Capability curves quantify risk per environmental condition |
| **Logging** | Full ODD history with environmental data for audit trail |

---

## 12. Implementation Architecture

### 12.1 ROS Noetic Node Architecture

```python
#!/usr/bin/env python3
"""
ODD Manager Node — central ODD state management for vehicle autonomy.
"""
import rospy
from sensor_msgs.msg import Temperature
from std_msgs.msg import String, Float32
from fleet_msgs.msg import ODDState, EnvironmentAssessment, METARData

class ODDManagerNode:
    def __init__(self):
        rospy.init_node('odd_manager')
        
        # Configuration
        self.airport_icao = rospy.get_param('~airport_icao', 'EGLL')
        self.metar_poll_interval = rospy.get_param('~metar_poll_s', 60)
        
        # Components
        self.metar_parser = METARParser()
        self.env_assessor = OnVehicleEnvironmentAssessor()
        self.env_fusion = EnvironmentalFusion()
        self.capability_curves = CapabilityCurves()
        self.state_machine = ODDStateMachine()
        self.speed_envelope = DynamicSpeedEnvelope()
        self.seasonal = SeasonalODDCalibrator()
        self.jet_blast = JetBlastODDManager()
        self.thermal = ThermalODDManager()
        self.lighting = LightingTransitionManager(
            rospy.get_param('~airport_lat'),
            rospy.get_param('~airport_lon')
        )
        
        # Subscribers
        rospy.Subscriber('/sensors/health', SensorHealth, self.on_sensor_health)
        rospy.Subscriber('/vehicle/battery', BatteryState, self.on_battery)
        rospy.Subscriber('/vehicle/orin_temp', Temperature, self.on_orin_temp)
        rospy.Subscriber('/adsb/aircraft', AircraftPositions, self.on_aircraft)
        rospy.Subscriber('/fleet/environment_reports', EnvironmentReport, 
                        self.on_fleet_report)
        
        # Publishers
        self.odd_pub = rospy.Publisher('/odd/state', ODDState, queue_size=1, latch=True)
        self.speed_pub = rospy.Publisher('/odd/max_speed', Float32, queue_size=1, latch=True)
        self.env_pub = rospy.Publisher('/odd/environment', EnvironmentAssessment, 
                                      queue_size=1, latch=True)
        self.diag_pub = rospy.Publisher('/diagnostics', DiagnosticArray, queue_size=10)
        
        # Timers
        rospy.Timer(rospy.Duration(1.0), self.update_odd)       # 1 Hz main loop
        rospy.Timer(rospy.Duration(self.metar_poll_interval), self.fetch_metar)
        rospy.Timer(rospy.Duration(3600), self.fetch_taf)        # Hourly TAF
        
        # Initialize
        self.latest_metar = None
        self.latest_taf = None
        self.fleet_reports = []
        
        rospy.loginfo("ODD Manager initialized for %s", self.airport_icao)
    
    def fetch_metar(self, event=None):
        """Fetch latest METAR from aviation weather API."""
        try:
            url = f"https://aviationweather.gov/api/data/metar?ids={self.airport_icao}&format=raw"
            response = requests.get(url, timeout=5)
            if response.ok:
                self.latest_metar = self.metar_parser.parse(response.text.strip())
                rospy.logdebug("METAR updated: %s", response.text.strip())
        except Exception as e:
            rospy.logwarn("METAR fetch failed: %s", e)
            # Continue with last known METAR + vehicle sensors
    
    def update_odd(self, event):
        """
        Main ODD update loop — runs at 1 Hz.
        Total computation: <5ms on Orin CPU.
        """
        # 1. Get on-vehicle environmental assessment
        vehicle_env = self.env_assessor.get_composite_assessment()
        
        # 2. Fuse with METAR and fleet reports
        fused_env = self.env_fusion.fuse(
            self.latest_metar, self.latest_taf,
            self.env_assessor, self.fleet_reports
        )
        
        # 3. Apply seasonal adjustments
        seasonal = self.seasonal.get_current_profile()
        fused_env['visibility_m'] /= seasonal['visibility_threshold_mult']
        
        # 4. Check jet blast zones
        jet_blast_restriction = self.jet_blast.apply_jet_blast_odd(
            self.vehicle_position, self.jet_blast.get_jet_blast_zones(self.aircraft)
        )
        
        # 5. Check thermal constraints
        thermal_restriction = self.thermal.assess_thermal_odd(self.vehicle_state)
        
        # 6. Check lighting mode
        lighting = self.lighting.get_perception_mode(
            self.lighting.get_lighting_mode(rospy.Time.now()),
            self.apron_lighting_active
        )
        
        # 7. Update state machine (takes worst-case of all inputs)
        self.state_machine.update(fused_env)
        
        # Apply jet blast override (local, may be more restrictive)
        if jet_blast_restriction:
            current_idx = self.state_machine.STATES.index(self.state_machine.current_state)
            blast_idx = self.state_machine.STATES.index(jet_blast_restriction)
            if blast_idx > current_idx:
                self.state_machine.current_state = jet_blast_restriction
        
        # Apply thermal override
        if thermal_restriction[0] != 'ODD_A':
            current_idx = self.state_machine.STATES.index(self.state_machine.current_state)
            thermal_idx = self.state_machine.STATES.index(thermal_restriction[0])
            if thermal_idx > current_idx:
                self.state_machine.current_state = thermal_restriction[0]
        
        # 8. Compute safe speed
        zone = self.get_current_zone()
        max_speed = self.speed_envelope.compute(fused_env, self.vehicle_state, zone)
        max_speed *= (1 - seasonal['max_speed_reduction_pct'] / 100)
        
        # 9. Publish
        odd_msg = ODDState()
        odd_msg.header.stamp = rospy.Time.now()
        odd_msg.level = self.state_machine.current_state
        odd_msg.max_speed_kmh = max_speed
        odd_msg.margin_multiplier = self.capability_curves.compute_safety_margins(fused_env)
        odd_msg.reasons = self.state_machine.history[-1]['reasons'] if self.state_machine.history else []
        odd_msg.lighting_mode = lighting['camera']
        self.odd_pub.publish(odd_msg)
        
        self.speed_pub.publish(Float32(data=max_speed))
        
        # 10. Report to fleet
        self.publish_fleet_env_report(fused_env)

if __name__ == '__main__':
    try:
        node = ODDManagerNode()
        rospy.spin()
    except rospy.ROSInterruptException:
        pass
```

### 12.2 Integration Points

| System | Interface | Data Flow |
|--------|-----------|----------|
| Frenet planner | `/odd/max_speed`, `/odd/state` | Speed limit, margin multipliers |
| Simplex architecture | `/odd/state` | ODD-C/D triggers BC consideration |
| Fleet manager | `/odd/state` | Task allocation considers ODD |
| Sensor health | `/sensors/health` → ODD Manager | Sensor degradation triggers ODD change |
| Runtime verification | `/odd/state` → STL monitors | ODD state used in safety specs |
| Teleoperation | `/odd/state` | ODD-D activates teleop standby |
| Operator HMI | `/odd/state`, `/odd/environment` | Dashboard display |
| Data flywheel | `/odd/state` history | ODD triggers prioritized data collection |

---

## 13. Key Takeaways

1. **The airside ODD is not static — it's a continuously monitored envelope** that changes on timescales from seconds (jet blast, de-icing spray) to hours (weather fronts) to months (seasonal profiles). Static ODD specifications are necessary for certification but insufficient for operations.

2. **Five ODD levels (A through E) provide structured degradation**. Each level defines speed limits, safety margins, sensor requirements, and autonomy mode. Transitions are asymmetric: fast degradation (immediate on detection), slow recovery (requires sustained good conditions for 2-5 minutes).

3. **METAR + on-vehicle sensors + fleet consensus provides multi-timescale environmental awareness**. METAR (30-60 min, official, airport-wide) sets the baseline. On-vehicle sensors (1-10 Hz, local) detect rapid changes. Fleet consensus (1 Hz, multi-point) validates and spatially resolves.

4. **TAF enables predictive ODD management**. 24-30 hour forecasts allow pre-positioning vehicles, scheduling charging during predicted weather holds, and adjusting fleet task allocation. A-CDM integration combines weather prediction with flight schedule prediction.

5. **Capability curves map environmental parameters to perception performance**. Each sensor modality has empirically calibrated degradation curves for visibility, precipitation, temperature, and contamination. These curves directly compute safe speeds and margins.

6. **De-icing spray is the most severe short-duration environmental hazard**. 60%+ LiDAR capability loss for 30-120 seconds. Requires immediate radar-primary switching. Fleet telemetry or AODB de-icing status provides advance warning.

7. **Jet blast is the most dangerous environmental hazard and is invisible to primary sensors**. Only detectable by thermal cameras or ADS-B inference. Exclusion zones per engine type (50-85m danger, 100-170m caution). Must override all other ODD states.

8. **Fog makes the strongest case for 4D radar as primary sensor**. At visibility <500m, LiDAR capability drops 50-70% while radar retains 85-95%. Dense fog (<200m) makes radar the only useful detection sensor beyond ultrasonic range.

9. **Temperature extremes affect the compute platform, not just sensors**. Orin thermal throttles at junction temps >85C, which occurs at ambient >45C under sustained load. Proactive power reduction prevents throughput collapse. Cold (-20C) reduces battery capacity 30-40%.

10. **Seasonal ODD profiles adjust thresholds for year-round operation**. Winter requires 30% more visibility margin, 25% battery reserve, daily sensor cleaning. Summer requires proactive thermal management above 42C. Spring/autumn handle rapid transitions.

11. **Dawn/dusk transitions require proactive perception mode switching**. Solar ephemeris provides minutes of advance notice. Pre-computed mode transitions prevent auto-exposure hunting and ensure smooth camera→thermal handoff.

12. **Safe speed is a continuous function, not discrete steps**. Computed from detection range, braking distance, surface friction, wind force, and zone limits. The minimum of all constraints determines the speed envelope at every moment.

13. **On-vehicle wind estimation from IMU vibration provides real-time data** between 30-minute METAR updates. Lateral acceleration when stopped correlates with wind speed via known vehicle aerodynamics.

14. **ODD state changes are safety-critical events** and must be logged with full environmental context for: (a) post-incident analysis, (b) fleet performance reporting, (c) regulatory compliance evidence, (d) data flywheel ODD-correlated trigger collection.

15. **Standards mapping is straightforward**. ISO 34502 provides ODD taxonomy dimensions, ISO 21448 (SOTIF) requires performance limitation identification and residual risk reduction, ISO 3691-4 requires environmental condition assessment and degraded mode. The ODD Manager addresses all three.

16. **EU AI Act compliance requires transparency and human oversight**. ODD state published at 1 Hz with reasons satisfies transparency. Teleop standby at ODD-D and operator monitoring at ODD-C satisfy human oversight. Full logging satisfies auditability.

17. **Implementation cost: $30-50K over 8-12 weeks**. Phase 1 (METAR + state machine + speed envelope, 3-4 weeks, $10-15K). Phase 2 (sensor-based assessment + fleet consensus, 3-4 weeks, $10-15K). Phase 3 (seasonal + jet blast + TAF predictive, 2-4 weeks, $10-20K).

---

## Cost and Implementation Roadmap

| Phase | Scope | Duration | Cost | Deliverable |
|-------|-------|----------|------|-------------|
| **Phase 1** | METAR parser + ODD state machine + speed envelope + ROS node | 3-4 weeks | $10-15K | Basic weather-adaptive autonomy |
| **Phase 2** | On-vehicle environmental sensing + fleet consensus + capability curves | 3-4 weeks | $10-15K | Real-time local ODD, calibrated performance |
| **Phase 3** | TAF predictive + jet blast zones + seasonal profiles + thermal management | 2-4 weeks | $10-20K | Predictive scheduling, full-year coverage |
| **Total** | Complete weather-adaptive ODD management system | 8-12 weeks | $30-50K | Year-round autonomous operations |

---

## References

### Internal Repository
- `operations/safety/airside-scenario-taxonomy.md` — SOTIF hazard catalog, scenario parameters including weather
- `operations/safety/runtime-verification-monitoring.md` — STL monitors, METAR→ODD mentioned
- `technology/robustness/airside-adverse-conditions.md` — Sensor performance in adverse weather
- `technology/perception/night-operations-thermal-fusion.md` — Night perception, thermal cameras
- `cross-cutting/radar-lidar-fusion-adverse-weather.md` — Radar-LiDAR fusion, de-icing handling
- `20-av-platform/sensors/sensor-degradation-health-monitoring.md` — Sensor health monitoring integration
- `20-av-platform/compute/energy-efficient-inference-24-7.md` — Thermal throttling, power modes
- `operations/airside/airport-data-integration.md` — METAR/TAF API endpoints

### External
- ISO 34502:2022. "Road vehicles — Test scenarios for automated driving systems — Scenario-based safety evaluation framework."
- ISO 21448:2022. "Road vehicles — Safety of the intended functionality (SOTIF)."
- ISO 3691-4:2020. "Industrial trucks — Safety requirements and verification — Part 4: Driverless industrial trucks."
- Aviation Weather Center API: https://aviationweather.gov/data/api/
- BSI PAS 1883:2020. "Operational Design Domain (ODD) taxonomy for an automated driving system (ADS)."
- SAE J3016:2021. "Taxonomy and Definitions for Terms Related to Driving Automation Systems."
- EU AI Act (2024/1689). "Regulation laying down harmonised rules on artificial intelligence."
- EU Machinery Regulation (2023/1230). Effective January 2027.
