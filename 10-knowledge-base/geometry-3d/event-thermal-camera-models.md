# Event and Thermal Camera Models

Event cameras and thermal cameras are both useful when ordinary RGB cameras are
weak, but their measurements are fundamentally different. Event cameras report
asynchronous brightness changes. Thermal cameras report infrared radiance,
often converted to apparent temperature. Both require explicit sensor models
before using them for perception, SLAM, mapping, or validation.

---

## 1. Event Camera Measurement Model

An event camera pixel stores a reference log intensity. It emits an event when
the change in log intensity crosses a contrast threshold:

```
L(u, t) = log(I(u, t))

event e_k = (x_k, y_k, t_k, polarity_k)

L(u_k, t_k) - L(u_k, t_last) >=  C_pos  -> polarity = +1
L(u_k, t_k) - L(u_k, t_last) <= -C_neg  -> polarity = -1
```

After an event, the pixel reference is reset or updated. The output is sparse
in static scenes and dense at moving edges or flickering lights.

### Sensor Model Impact

| Task | Why the model matters |
|---|---|
| Perception | Events emphasize motion and edges, not texture or absolute color. Static objects can disappear without relative motion. |
| SLAM | Event residuals are contrast/timing residuals, not frame reprojection residuals. They work well for high-speed motion and high dynamic range. |
| Mapping | Event cameras need motion or active changes to observe structure; maps are usually edge/contrast maps or fused with frames/depth. |
| Validation | Test by illumination, contrast threshold, event rate, timestamp accuracy, flicker, and motion speed. |

---

## 2. Event Noise and Timing

Common event noise sources:

| Noise | Cause | Effect |
|---|---|---|
| Background activity | pixel leakage and electronics | random events in static scenes |
| Contrast threshold mismatch | per-pixel `C_pos`, `C_neg` variation | biased event timing and polarity rate |
| Refractory effects | pixel cannot fire immediately again | missed events at very high contrast speed |
| Timestamp jitter | sensor/transport/clock uncertainty | motion-compensation and SLAM residual error |
| Hot pixels | defective or noisy pixels | persistent false event streams |
| Flicker | lights and PWM sources | dense non-geometric event bursts |

A practical event likelihood often models contrast residual:

```
r_k = polarity_k * (L(predicted at t_k) - L(reference)) - C_polarity
```

or uses contrast maximization by warping events to a reference time:

```
u_ref = warp(u_k, t_k, motion_params)
maximize sharpness/contrast of accumulated event image
```

### Filtering

Common preprocessing:

- refractory filtering per pixel
- nearest-neighbor spatio-temporal filtering
- hot-pixel masks
- event-rate limiting
- flicker frequency rejection
- time-surface construction

Filtering should be logged because it changes the measurement distribution and
can remove real small/fast objects.

---

## 3. Event Calibration

Event cameras still need geometric calibration:

```
K, distortion, T_base_event, time offset
```

Additional event-specific calibration:

- positive and negative contrast thresholds
- per-pixel threshold bias
- timestamp offset relative to IMU/camera/LiDAR
- event-camera to frame-camera alignment for hybrid DAVIS-style sensors

Calibration datasets should include moving edges and controlled illumination.
Static checkerboard images may calibrate the APS frame camera but not event
threshold behavior.

---

## 4. Event Cameras for Autonomy

Strengths:

- microsecond-class timestamping and low latency
- high dynamic range
- low data rate in static scenes
- strong high-speed edge tracking
- robust against motion blur compared with frame cameras

Limitations:

- no absolute intensity or color in pure DVS output
- sparse or silent output for static scene and stopped vehicle
- flickering LEDs can dominate event stream
- algorithms and datasets are less mature than RGB/LiDAR
- event rate can spike under vibration, rain streaks, prop wash, or flashing
  lights

Airside relevance:

- useful for beacon/light motion, high-contrast moving ground crew, and
  low-latency obstacle motion cues
- vulnerable to LED signage, warning beacons, apron floodlight flicker, and
  low-contrast aircraft surfaces without relative motion
- best treated as a complementary motion sensor, not a standalone map sensor

---

## 5. Thermal Camera Measurement Model

Thermal cameras measure infrared radiance, commonly in LWIR (8 to 14 um) for
uncooled microbolometers or MWIR for cooled systems. A radiometric camera
converts detector signal to apparent temperature using calibration and scene
parameters.

A simplified radiance model:

```
L_sensor =
  tau_atm * [ epsilon * L_bb(T_object)
            + (1 - epsilon) * L_reflected ]
  + (1 - tau_atm) * L_atmosphere
  + sensor_offset + noise
```

where:

- `epsilon`: target emissivity
- `tau_atm`: atmospheric transmission
- `L_bb(T)`: blackbody radiance at temperature `T`
- `L_reflected`: reflected apparent radiance from surroundings

Temperature is inferred by inverting the calibrated radiance model. If
emissivity or reflected temperature is wrong, reported temperature can be wrong
even if the image contrast looks plausible.

---

## 6. Thermal Calibration and NUC

Thermal cameras require non-uniformity correction (NUC) because each detector
pixel has different gain and offset:

```
DN_corrected(u) = gain(u, camera_temp) * DN_raw(u)
                  + offset(u, camera_temp)
```

Factory calibration uses blackbody sources across temperature ranges. Cameras
may store multiple NUC tables and switch based on internal temperature. Field
NUC events can create image jumps or short blind intervals, which matter for
tracking and validation.

Calibration parameters:

- per-pixel gain and offset
- bad pixel map
- lens transmission
- camera body temperature compensation
- emissivity setting for radiometry
- reflected apparent temperature
- atmospheric temperature, humidity, and distance for long-range radiometry

For geometric fusion, thermal cameras also need ordinary camera intrinsics,
distortion, extrinsics, and timing.

---

## 7. Thermal Noise and Image Behavior

Common thermal terms:

| Term | Meaning | Autonomy effect |
|---|---|---|
| NETD | noise-equivalent temperature difference | lower NETD sees smaller thermal contrast |
| Fixed-pattern noise | pixel gain/offset mismatch | false texture and unstable detections |
| Thermal drift | camera body temperature effects | apparent-temperature shifts over time |
| Emissivity error | material radiates less/more than assumed | wrong temperature and contrast |
| Reflections | shiny surfaces reflect thermal scene | false hot/cold objects |
| Atmospheric attenuation | absorption/emission over path | long-range contrast loss |

Thermal images do not see through most glass, and polished metal can behave
like a thermal mirror. Wet surfaces and aircraft skin can create confusing
thermal reflections.

---

## 8. Low-Light, Smoke, Fog, and Weather Relevance

Thermal cameras are valuable because they do not require visible illumination.
They can detect people, vehicles, engines, brakes, tires, and recently operated
equipment at night. Smoke and light fog may degrade visible cameras more than
thermal, but thermal performance still depends on wavelength band, particle
size, humidity, range, and temperature contrast.

Important caveats:

- Thermal detects contrast, not semantic class.
- A person in insulated clothing can have weak thermal contrast.
- Freshly sun-heated pavement or aircraft surfaces can create clutter.
- Heavy rain, water on the lens, and high humidity reduce range and contrast.
- Thermal resolution is often lower than RGB, making small FOD detection hard.

For airside autonomy, thermal is a strong night and low-visibility complement
for detecting personnel and warm equipment, but LiDAR/radar/camera fusion is
still needed for geometry, classification, and map alignment.

---

## 9. Fusion and Mapping

### Event Fusion

Useful fusion patterns:

- event + IMU for low-latency motion estimation
- event + frame camera for high dynamic range and absolute appearance
- event + LiDAR/depth map for 6-DoF tracking against known geometry
- event rate as a motion cue for detection/tracking

State-estimation residuals should account for event timestamp and contrast
threshold uncertainty.

### Thermal Fusion

Useful fusion patterns:

- thermal + RGB for day/night pedestrian and vehicle detection
- thermal + LiDAR for geometry plus heat signature
- thermal + radar in fog/smoke/night for robust obstacle cues
- thermal map layers for site-specific hot equipment or no-go zones

Mapping should store thermal observations with time of day, weather, camera
calibration, emissivity assumptions, and operating context. Thermal maps are
less stable than geometric maps because temperature changes with sun, weather,
equipment use, and season.

---

## 10. Validation

Event camera validation:

```
event rate versus motion and illumination
timestamp alignment to IMU/LiDAR/camera
hot pixel count
contrast threshold calibration
flicker response
latency distribution
SLAM residuals by event age and image region
```

Thermal validation:

```
NETD and fixed-pattern checks
blackbody or reference target checks
NUC event frequency and image jumps
pedestrian/equipment detection by range and weather
emissivity/reflection test cases
geometric reprojection residual versus LiDAR/RGB
night/day and sun-heated surface regression tests
```

---

## 11. Failure Modes

| Failure mode | Sensor | Cause | Mitigation |
|---|---|---|---|
| Static obstacle disappears | event | no relative brightness change | fuse with frame/LiDAR/radar and maintain tracks |
| Event flood | event | flicker, vibration, rain, flashing lights | filters, flicker modeling, event-rate health monitor |
| Biased event SLAM | event | wrong contrast threshold or time offset | threshold/time calibration and IMU cross-check |
| False hot object | thermal | reflection from metal/glass/wet surface | multi-view/fusion consistency, emissivity awareness |
| Missed person | thermal | low contrast, occlusion, clothing, range | RGB/LiDAR/radar fusion and range-specific metrics |
| Temperature jump | thermal | NUC or camera drift | log NUC events, hold tracker confidence through jumps |
| Poor map repeatability | thermal | diurnal/seasonal temperature changes | context-tagged thermal layers, do not treat as static geometry |

---

## 12. Sources

- Gallego et al., "Event-based Vision: A Survey." IEEE TPAMI, 2022. https://arxiv.org/abs/1904.08405
- Mueggler et al., "The event-camera dataset and simulator: Event-based data for pose estimation, visual odometry, and SLAM." IJRR, 2017. https://journals.sagepub.com/doi/10.1177/0278364917691115
- Gallego, Forster, Mueggler, Scaramuzza, "Event-based Camera Pose Tracking using a Generative Event Model." https://arxiv.org/abs/1510.01972
- Gallego, Rebecq, Scaramuzza, "A Unifying Contrast Maximization Framework for Event Cameras." CVPR, 2018. https://openaccess.thecvf.com/content_cvpr_2018/papers/Gallego_A_Unifying_Contrast_CVPR_2018_paper.pdf
- Stoffregen et al., "Event Camera Calibration of Per-pixel Biased Contrast Threshold." https://arxiv.org/abs/2012.09378
- FLIR, "How does FLIR calibrate thermal cameras? What is NUC?" https://oem.flir.com/support/support-center/knowledge-base/how-does-flir-calibrate-thermal-cameras-what-is-nuc/
- FLIR, "How Do You Calibrate a Thermal Imaging Camera?" https://prodindustrial.flir.com/en-gb/discover/professional-tools/how-do-you-calibrate-a-thermal-imaging-camera/
- FLIR user documentation on thermography parameters and emissivity. https://support.flir.com/docdownload/assets/web/27eh/en-us/T505000.xml.html
- Holst, "Electro-Optical Imaging System Performance." SPIE Press.
