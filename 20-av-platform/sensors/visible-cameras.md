# Visible Cameras for Autonomous Vehicle Platforms

Visible cameras are the highest-information-density sensor in most autonomy
stacks. They carry texture, color, traffic and airside markings, signs, lights,
person posture, equipment state, and aircraft livery cues that LiDAR and radar
cannot directly observe. They are also sensitive to lighting, optics, exposure,
cleanliness, time synchronization, and ISP choices.

This page is platform-facing: how to choose and integrate visible camera
hardware for perception, SLAM, mapping, airside operations, and validation.

---

## 1. What Visible Cameras Provide

| Capability | Camera value | Limitation |
|---|---|---|
| Semantics | People, vehicles, cones, signs, markings, aircraft doors, lights, gestures. | Requires training data and robust exposure. |
| Geometry | Monocular/stereo depth, visual odometry, lane/edge projection, calibration residuals. | Depth is scale-ambiguous monocularly and sensitive to calibration. |
| Mapping | Texture, lane and stand markings, asset inventory, inspection imagery. | Lighting changes affect repeatability. |
| Validation | Human-auditable evidence for incident replay. | Video must be time-aligned and exposure-readable. |

For airside autonomy, cameras are especially useful for stand markings,
marshalling signals, ground crew posture, cones, chocks, belt loaders, aircraft
service doors, light states, and visual confirmation during close operations.

---

## 2. Global Shutter vs Rolling Shutter

| Feature | Global shutter | Rolling shutter |
|---|---|---|
| Exposure timing | All pixels expose over the same interval. | Rows expose at different times. |
| Motion distortion | Low for moving ego vehicle and moving actors. | Skew, wobble, and row-dependent projection under motion. |
| Calibration | Simpler geometric model. | Requires row-time model for precision. |
| Low-light / cost | Historically lower sensitivity or higher cost, though modern sensors improved. | Often lower cost and high image quality. |
| AV recommendation | Preferred for metric perception, calibration, and SLAM. | Acceptable for non-metric monitoring or when modeled. |

Rolling-shutter row model:

```
t_row = t_frame_start + row_index * row_readout_time
```

Projection with rolling shutter should use pose at `t_row`, not one pose for the
whole image. Otherwise LiDAR-camera reprojection and visual odometry residuals
grow with yaw rate and speed.

---

## 3. HDR, LFM, and Exposure Control

Autonomous vehicles see extreme dynamic range:

- low sun on wet apron
- aircraft floodlights at night
- reflective hi-vis clothing
- dark undercarriage and wheel-well shadows
- terminal glass and headlights
- LED signs and beacons

Key hardware/features:

| Feature | Purpose | Integration note |
|---|---|---|
| High dynamic range (HDR) | Preserve shadows and highlights. | Multi-exposure HDR can create motion artifacts if not designed for moving scenes. |
| LED flicker mitigation (LFM) | Avoid banding or pulsing from PWM LEDs. | Important for traffic lights, beacons, signs, and airside lighting. |
| Global exposure control | Stable perception across camera array. | Auto-exposure changes should be logged; synchronized exposure is useful for surround fusion. |
| Short exposure plus high sensitivity | Reduce motion blur. | Requires lens aperture, sensor QE, and lighting budget. |
| External strobe support | Controlled inspection or low-light operation. | Must be synchronized and eye-safe / operationally acceptable. |

For validation, record exposure time, gain, HDR mode, white balance, and ISP
state. A frame that is present but saturated is a degraded measurement.

---

## 4. Lens, FOV, and Optomechanical Choices

Camera performance is often limited by lens and enclosure, not sensor silicon.

| Choice | Engineering trade-off |
|---|---|
| Wide FOV | Better coverage, worse angular resolution and more distortion. |
| Narrow FOV | Better long-range recognition, less coverage. |
| Fisheye | Excellent surround awareness, harder metric projection at image edge. |
| Large aperture | Better low-light, shallower depth of field and more sensitivity to focus shift. |
| IR-cut filter | Natural color and visible semantics, less NIR sensitivity. |
| Polarizer | Reduces glare, cuts light and can interact with windshields/plastic. |
| Heated window | Prevents fog/ice, adds thermal and power constraints. |
| Wiper/washer/air knife | Maintains image quality in rain, de-icing residue, bugs, and dust. |

A camera spec should include:

- sensor model and shutter type
- resolution and pixel size
- frame rate at selected bit depth
- lens focal length, aperture, focus setting, and distortion model
- horizontal/vertical/diagonal FOV after housing
- IP rating, operating temperature, vibration rating
- heater, washer, wiper, hydrophobic coating, and contamination sensors
- trigger, timestamp, and PTP support

---

## 5. Triggering, PTP, and Timestamping

For fusion, a camera timestamp should describe acquisition time, not when the
image reached the host.

Preferred architecture:

```
GNSS/PPS or PTP grandmaster
  -> camera hardware clock or trigger controller
  -> exposure start / exposure midpoint timestamp
  -> image message with hardware timestamp
  -> host receive timestamp for diagnostics
```

For global shutter:

```
t_image ~= t_trigger + trigger_delay + exposure_time / 2
```

For rolling shutter:

```
t_row = t_frame_start + row_index * row_readout_time
```

Log trigger counters and dropped frames. Multi-camera rigs should detect frame
ID mismatches where one camera missed a trigger and the image set is no longer
simultaneous.

---

## 6. ISP, RAW, and Compression

| Pipeline | Strength | Risk |
|---|---|---|
| RAW / Bayer | Maximum calibration and training control. | Higher bandwidth and compute; needs ISP in software or hardware. |
| Linear RGB | More model-friendly than heavily processed video. | Still depends on demosaic and color pipeline. |
| YUV / ISP output | Easy and bandwidth-efficient. | Auto tone mapping, sharpening, denoise, and compression can shift model inputs. |
| H.264/H.265 logging | Efficient for human replay. | Compression artifacts can harm training labels and calibration. |

For perception and mapping, preserve either RAW or lightly processed frames
when feasible. For incident review, compressed video is useful, but it should
not be the only evidence if pixel-accurate validation or relabeling is needed.

ISP settings to version:

- exposure and gain policy
- HDR mode
- gamma or tone curve
- white balance mode
- denoise and sharpening
- lens shading correction
- bad-pixel correction
- color correction matrix
- compression settings

---

## 7. Cleaning, Heating, and Weather Integration

Visible cameras degrade silently. A dirty or wet lens often still publishes
valid frames.

Airside contamination sources:

- de-icing fluid film
- hydraulic mist
- jet exhaust soot
- rain and standing water splash
- bug strikes
- rubber dust
- snow and ice
- cleaning chemical residue

Hardware mitigations:

- hydrophobic/oleophobic optical window
- heater and temperature sensor
- washer/wiper or air knife
- lens hood and glare baffle
- contamination detection using contrast, glare, and occlusion metrics
- serviceable window that preserves calibration when replaced

Cleaning systems should be integrated with perception health. A washer event can
temporarily obscure the image and should be logged as a sensor state change.

---

## 8. Effects on Perception, SLAM, Mapping, and Validation

| Function | Visible camera effect |
|---|---|
| Perception | Primary semantic input for people, signs, markings, lights, equipment, aircraft state, and classifier evidence. Hardware choices directly affect false negatives at night, glare, and motion. |
| SLAM | Provides visual odometry, loop-closure appearance, and camera-IMU constraints. Rolling shutter, blur, and exposure jumps corrupt feature tracks. |
| Mapping | Captures texture, markings, asset inventory, and human-auditable map evidence. Poor timestamping shifts images relative to LiDAR and surveyed map features. |
| Validation | Supplies replayable evidence and labels. Validation must include exposure metadata, dropped frames, synchronization state, and degradation state. |

For airside AVs, visible cameras should not be the only all-weather safety
sensor, but they are essential for semantic understanding and operator trust.
Thermal, LiDAR, and radar cover many visible-camera failure cases; cameras cover
semantic cases those sensors cannot resolve.

---

## 9. Failure Modes and Health Signals

| Failure mode | Signal | Response |
|---|---|---|
| Motion blur | Low edge sharpness correlated with exposure and speed. | Shorter exposure, higher gain, better lens, speed-dependent confidence. |
| Rolling-shutter distortion | Row-dependent projection residual. | Use global shutter or rolling-shutter model. |
| Saturation / glare | Large saturated regions, flare streaks, lost contrast. | HDR/LFM tuning, exposure region policy, fusion fallback. |
| LED flicker banding | Horizontal bands or frame-to-frame intensity oscillation. | LFM-capable sensor and exposure settings. |
| Lens contamination | Persistent blur, spots, low contrast, reduced detections. | Washer/wiper/heater and health monitor. |
| Fog/ice on window | Global contrast loss or white haze. | Heater, hydrophobic coating, stop or degraded mode. |
| Trigger drop | Sequence counter mismatch across camera set. | Drop the synchronized set or mark partial frame set. |
| ISP drift | Model performance changes after firmware/config update. | Version ISP settings and validate before deployment. |

---

## 10. Recommended Platform Pattern

For a production airside or industrial AV:

- Use global-shutter cameras for metric surround perception where practical.
- Prefer hardware trigger or PTP hardware timestamps.
- Choose HDR/LFM sensors for apron lighting and LED-heavy scenes.
- Keep RAW or lightly processed logging for calibration and validation datasets.
- Version camera intrinsics, lens, focus, housing, and ISP settings as one
  calibration artifact.
- Integrate heating/cleaning and lens health into autonomy degraded-mode policy.
- Pair visible cameras with LiDAR, radar, thermal, IMU/GNSS, and wheel odometry
  rather than treating camera perception as independently authoritative.

---

## Sources

- EMVA 1288 machine vision camera characterization standard: https://www.emva.org/standards-technology/emva-1288/
- EMVA Standard 1288 Release 4.0 overview PDF: https://www.emva.org/wp-content/uploads/EMVA1288General_4.0Release.pdf
- Basler electronic shutter types documentation: https://docs.baslerweb.com/electronic-shutter-types
- Basler sensor shutter mode documentation: https://docs.baslerweb.com/sensor-shutter-mode
- Basler HDR documentation: https://docs.baslerweb.com/hdr
- Sony Pregius/Pregius S global shutter technology: https://www.sony-semicon.com/en/technology/industry/pregius.html
- Sony global shutter image sensor overview: https://www.sony-semicon.com/en/products/is/industry/global-shutter.html
- IEEE 1588-2019 Precision Time Protocol: https://standards.ieee.org/content/ieee-standards/en/standard/1588-2019.html
- ROS 2 clock and time design: https://design.ros2.org/articles/clock_and_time.html
