# Radar-Native World Models

> **Key Takeaway:** Radar-native world modeling is still early, but it fills a real gap. Camera and LiDAR world models are not enough for rain, fog, dust, spray, darkness, jet-blast-adjacent turbulence, and direct velocity reasoning. The near-term opportunity is not a fully radar-only planner; it is radar-aware simulation, future occupancy/flow, radar point generation, and fusion world models that preserve Doppler, RCS, uncertainty, and radar failure modes.

---

## Why Radar-Native Models

Radar has properties that are hard to recover from camera or LiDAR after the fact:

- Direct radial velocity through Doppler.
- Operation in poor lighting and many weather conditions.
- Long range and lower sensitivity to rain/fog than camera/LiDAR.
- Distinct radar cross-section behavior for metal aircraft, vehicles, poles, ground clutter, and wet surfaces.
- Sparse, noisy, stochastic returns that expose different uncertainty than dense camera or LiDAR.

Most driving world models are image/video-native, LiDAR-native, or occupancy-native. They may include radar as an auxiliary feature, but they rarely model radar's native measurement space and stochastic behavior.

---

## Representation Taxonomy

| Representation | What it models | Strength | Weakness |
|---|---|---|---|
| Raw ADC / radar cube | Antenna x range x Doppler x angle measurements | Closest to sensor physics | Heavy, often proprietary, hard to annotate |
| Range-Doppler-angle tensor | Processed radar volume | Preserves velocity and angular structure | Less common in public datasets |
| Radar point cloud | Sparse detections with range, azimuth, elevation, Doppler, RCS | Easy to fuse with LiDAR/BEV | Loses many low-level signal details |
| BEV radar maps | Density/RCS/Doppler raster in bird's-eye view | Compatible with diffusion and BEV planners | Rasterization can hide multi-return ambiguity |
| Occupancy/flow | Radar-informed future free/occupied space and velocity | Directly useful for planning | Radar sparsity makes occupancy supervision hard |
| Neural fields / 3DGS / NeRF | Continuous scene and sensor simulation | Useful for novel-view radar simulation | Training cost and sensor-specific modeling complexity |
| Multimodal latent tokens | Radar encoded with camera/LiDAR/world model tokens | Scales to foundation models | Interpretability and calibration still immature |

---

## Method and Benchmark Landscape

### V2X-Radar

V2X-Radar is a real-world cooperative perception dataset with 4D radar, LiDAR, and cameras on a connected vehicle and an intelligent roadside unit. It includes sunny/rainy conditions, day/dusk/night, 20K LiDAR frames, 40K camera images, 20K 4D radar frames, and 350K annotated boxes across five categories.

Relevance:

- First major cooperative 4D radar benchmark.
- Useful for radar-aware V2X world models.
- Captures weather/night and infrastructure viewpoints relevant to airports.

### NeuRadar

NeuRadar extends neural radiance-field style modeling to automotive radar point clouds. It jointly generates radar point clouds, camera images, and LiDAR point clouds, and explicitly models deterministic and probabilistic radar point representations to capture radar stochasticity.

Relevance:

- Establishes a radar NeRF baseline for sensor simulation.
- Useful for novel-view radar replay and validation.
- Highlights that radar returns depend on view direction, material, and surrounding geometry rather than only local surface location.

### RadarGen

RadarGen synthesizes radar point clouds from multi-view camera images using BEV radar maps and latent diffusion. It encodes point density, RCS, and Doppler maps, conditions generation on BEV-aligned depth, semantics, and motion cues, then recovers sparse radar point clouds.

Relevance:

- Gives a practical path to add radar-like data to camera-rich datasets.
- Useful for training radar-fusion models before enough real radar data exists.
- Not radar-native at input, but radar-native at output and evaluation.

### L2RDaS

L2RDaS synthesizes spatially informative 4D radar tensors from LiDAR data. It targets the scarcity of public 4D radar tensor data and aims to improve model generalization through radar dataset expansion.

Relevance:

- Useful bootstrapping tool when LiDAR logs exist but radar tensor data is scarce.
- Supports domain transfer from mature LiDAR datasets to radar-aware models.

### 4DRadar-GS

4DRadar-GS uses 4D radar for self-supervised dynamic driving scene reconstruction and novel-view synthesis. It adds velocity-guided tracking supervision to improve temporal consistency.

Relevance:

- Shows radar as a reconstruction signal, not only an object-detection input.
- Doppler can help dynamic scene decomposition in adverse conditions.

### Existing Radar Datasets

| Dataset | Value for world models | Notes |
|---|---|---|
| TJ4DRadSet | 4D radar points for autonomous driving | Useful for radar perception baselines |
| K-Radar | 4D radar tensor benchmark in adverse weather | Strong for robustness and radar tensor methods |
| V2X-Radar | Cooperative vehicle-infrastructure 4D radar | Best fit for V2X and airside analogies |
| ZOD radar extensions | Radar data for sequences/drives used by NeuRadar | Useful for radar simulation research |

---

## World-Model Taxonomy

| Model type | Input | Output | Planning use |
|---|---|---|---|
| Radar future point prediction | Past radar point clouds/tensors | Future radar point clouds | Anticipate moving objects and occlusions |
| Radar occupancy flow | Radar plus ego motion/history | Future occupied/free BEV and Doppler-informed flow | Collision checking and crossing prediction |
| Radar-aware multimodal world model | Camera/LiDAR/radar tokens | Future multimodal latent/occupancy/video/radar | Robust all-weather planning and simulation |
| Radar neural sensor simulator | Scene reconstruction plus sensor pose | Radar point cloud/tensor at new pose/time | Closed-loop sim and rare-event generation |
| Radar synthetic data generator | Camera/LiDAR/map/semantic condition | Radar point cloud/tensor | Data augmentation and fusion pretraining |
| Radar uncertainty model | Radar history and environment | Existence probability, ghost probability, velocity uncertainty | Safety monitor and fallback gating |

---

## Relevance by Domain

### Generic Road AV

Radar-native world models improve robustness in fog, rain, spray, night, glare, and high-speed cut-in cases. They are most valuable as part of a fusion world model where camera provides semantics, LiDAR provides geometry, and radar provides velocity/weather resilience.

### Indoor Autonomy

Indoor AMRs often rely on LiDAR and cameras, but radar is useful in dust, steam, smoke, transparent plastic, reflective packaging, and long aisles. Radar-native world models could support safety monitors where optical sensors degrade, though public indoor radar datasets are sparse.

### Outdoor Industrial Autonomy

Yards, ports, mines, construction, agriculture, and campuses benefit from radar in dust, rain, mud, snow, and low light. Radar world models are especially useful for moving equipment, reversing trucks, and long-range approach speed estimation.

### Airside Autonomy

Airside is a strong radar use case:

- Aircraft and GSE are large metallic targets with strong radar returns.
- Rain, fog, night, wet apron reflections, de-icing spray, and glare are routine concerns.
- Doppler helps distinguish moving aircraft/GSE/personnel from static stand clutter.
- Radar can complement thermal sensing for engine/jet-blast-adjacent hazard modeling.
- Infrastructure radar can support cooperative perception around aircraft occlusions.

Radar is not sufficient alone for small FOD and personnel semantics, but it is valuable as a fallback and uncertainty-reduction modality.

---

## Implementation Notes

### Data Requirements

For an airside radar world-model pilot, collect:

- Raw radar detections or tensors where sensor licensing allows.
- Doppler, RCS, elevation, range, azimuth, and covariance/quality flags.
- Synchronized camera, LiDAR, GNSS/IMU, wheel odometry, and map data.
- Weather, lighting, surface wetness, and de-icing state.
- Aircraft/GSE/personnel/FOD labels and tracks.
- V2X and airport-operation context for aircraft state and stand phase.

### Baseline Pipeline

```
Radar frames + ego pose history
  -> radar BEV raster: density, RCS, Doppler, uncertainty
  -> temporal encoder: ConvGRU / transformer / state-space model
  -> future occupancy + Doppler flow
  -> planner query: path overlap, crossing risk, uncertainty
```

Add camera/LiDAR fusion only after the radar-only baseline is measurable. This avoids hiding whether radar contributes real forecast value.

### Evaluation Metrics

| Metric | Use |
|---|---|
| Future radar Chamfer / density similarity | Point-cloud generation quality |
| RCS distribution distance | Radar attribute realism |
| Doppler error | Velocity fidelity |
| Future occupancy IoU | Planning relevance |
| Flow endpoint error | Motion forecast quality |
| Detection AP under adverse conditions | Downstream perception benefit |
| Planner collision/progress delta | Whether radar helps driving |
| Calibration and ghost rate | Safety monitor input |
| Weather robustness delta | Radar value under rain/fog/night |

### Airside Evaluation Scenarios

- Baggage tractor crossing behind parked aircraft.
- Pushback tug and aircraft beginning motion from stand.
- Fuel truck or catering vehicle reversing near ego route.
- Personnel partially occluded by GSE, with radar weak or absent.
- Wet apron with strong ground clutter.
- Rain/fog/night route where camera confidence drops.
- Radar ghost near metallic aircraft fuselage.
- V2X infrastructure radar observes an occluded crossing vehicle.

---

## Failure Modes

| Failure mode | Description | Mitigation |
|---|---|---|
| Ghost targets | Multipath around aircraft, jet bridges, buildings, and wet ground | Track consistency, camera/LiDAR cross-check, ghost probability output |
| Sparse misses | Small FOD/personnel may have weak radar returns | Do not use radar as sole safety channel for small objects |
| Doppler ambiguity | Stationary or tangential movers have weak radial velocity | Multi-frame tracking and multi-radar viewpoints |
| Material bias | Metal dominates; non-metal objects underrepresented | Class/material-aware evaluation and sensor fusion |
| Rasterization loss | BEV maps hide elevation and multi-return structure | Preserve elevation bins or tensor representation where possible |
| Sim realism gap | Generated radar looks plausible but fails downstream models | Evaluate with downstream perception/planning and real radar validation |
| Weather overclaim | Radar is robust, not immune, and can still suffer clutter/interference | Weather-specific metrics and ODD limits |
| Calibration drift | Radar extrinsics and timing errors corrupt Doppler/position | Online calibration, timestamp provenance, uncertainty inflation |

---

## Related Repo Docs

| Document | Relevance |
|---|---|
| [LiDAR-Native World Models](lidar-native-world-models.md) | Closest mature geometry-native world-model pattern |
| [Occupancy World Models](occupancy-world-models.md) | Occupancy forecasting representation |
| [Occupancy Deployment on Orin](occupancy-deployment-orin.md) | Edge deployment considerations |
| [End-to-End World Model Pipeline](../end-to-end-driving/e2e-world-model-pipeline.md) | World-model to planner interface |
| [4D Radar Sensors](../../20-av-platform/sensors/4d-radar.md) | Hardware and sensor behavior background |
| [Radar-LiDAR Fusion in Adverse Weather](../perception/overview/radar-lidar-fusion-adverse-weather.md) | Fusion and robustness context |
| [V2X-Radar](../perception/methods/v2x-radar.md) | Cooperative radar dataset/method details |
| [K-Radar](../perception/methods/k-radar.md) | 4D radar perception benchmark |
| [Sim-to-Real Transfer Airside](../simulation/sim-to-real-transfer-airside.md) | Synthetic-to-real evaluation considerations |
| [Airside Autonomy Benchmark Spec](../end-to-end-driving/airside-autonomy-benchmark-spec.md) | Airside radar evaluation scenarios |

---

## Sources

- [V2X-Radar: A Multi-modal Dataset with 4D Radar for Cooperative Perception](https://arxiv.org/abs/2411.10962)
- [NeuRadar: Neural Radiance Fields for Automotive Radar Point Clouds](https://arxiv.org/abs/2504.00859)
- [RadarGen: Automotive Radar Point Cloud Generation from Cameras](https://radargen.github.io/)
- [L2RDaS: Synthesizing 4D Radar Tensors for Model Generalization via Dataset Expansion](https://arxiv.org/abs/2503.03637)
- [4DRadar-GS: Self-Supervised Dynamic Driving Scene Reconstruction with 4D Radar](https://arxiv.org/abs/2509.12931)
- [TJ4DRadSet: A 4D Radar Dataset for Autonomous Driving](https://arxiv.org/abs/2204.13483)
- [K-Radar: 4D Radar Object Detection for Autonomous Driving in Various Weather Conditions](https://arxiv.org/abs/2206.08171)
- [V2X-R: Cooperative LiDAR-4D Radar Fusion with Denoising Diffusion](https://arxiv.org/abs/2411.08402)
- [RADIal: Radar, Camera and LiDAR Dataset for Autonomous Driving](https://arxiv.org/abs/2204.04473)
- [NeRF-LiDAR: Generating Realistic LiDAR Point Clouds with Neural Radiance Fields](https://arxiv.org/abs/2304.14811)
