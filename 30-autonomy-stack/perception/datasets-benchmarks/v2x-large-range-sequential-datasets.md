# V2X Large-Range And Sequential Datasets

**Last updated:** 2026-05-09

Large-range and sequential V2X datasets extend cooperative perception from isolated frames at a single intersection to multi-agent, multi-sensor, temporally consistent scenes. V2XScenes, V2XPnP Sequential, UrbanIng-V2X, V2X-Real, and related datasets are especially relevant to airport autonomy because fixed infrastructure can observe around occlusions and beyond the ego vehicle's range.

**Related pages:** [infrastructure cooperative perception](../overview/infrastructure-cooperative-perception.md), [RCP-Bench cooperative corruption robustness](rcp-bench-cooperative-corruption-robustness.md), [sensor fusion architectures](../overview/sensor-fusion-architectures.md), [RCooper](../methods/rcooper.md), [V2X-Radar](../methods/v2x-radar.md), [CoopTrack](../methods/cooptrack.md)

---

## Scope

| Dataset | Domain | Main contribution |
|---|---|---|
| V2XScenes | Large-range vehicle-infrastructure collaborative perception under challenging traffic conditions | Sequential 3D boxes and tracking IDs across seven roadside layouts and condition-labeled scenes. |
| V2XPnP Sequential | Real-world multi-agent V2X sequential perception and prediction | Two vehicles, two infrastructure agents, all collaboration modes, trajectories, maps, and benchmarks. |
| UrbanIng-V2X | Multi-vehicle, multi-infrastructure data across multiple intersections | Larger diversity across intersections with vehicle cameras/LiDAR and infrastructure thermal cameras/LiDAR. |
| V2X-Real | Real-world multi-modal V2X cooperative perception | 2 vehicles + 2 infrastructures, 1.2M annotated 3D boxes, four collaboration modes. |
| CoopScenes | Ego-infrastructure collective perception scenes in Germany | 10 Hz synchronized data, multi-scene registration, anonymization, and development kit. |
| V2X-Seq | Sequential vehicle-infrastructure cooperative perception and forecasting | Sequential perception, trajectories, maps, and forecasting labels across many intersections. |

This page is about dataset fit and validation use. It is not a V2X communications-standard page.

---

## Dataset And Task Definitions

| Task | What is evaluated |
|---|---|
| Cooperative 3D object detection | Whether fusing vehicle and infrastructure sensors improves 3D boxes. |
| Cooperative tracking | Whether object IDs remain consistent across frames and sensor handoffs. |
| Large-range roadside perception | Whether infrastructure extends range beyond the ego vehicle and through occlusion. |
| Sequential perception | Whether models use temporal context rather than independent frames. |
| Prediction / forecasting | Whether trajectories can be forecast from cooperative history and map context. |
| Collaboration-mode comparison | Vehicle-centric, infrastructure-centric, V2V, V2I, I2I, and full V2X modes. |

V2XScenes emphasizes large-range, challenging-condition vehicle-infrastructure perception. V2XPnP emphasizes spatio-temporal fusion for perception and prediction. UrbanIng-V2X emphasizes multi-intersection diversity. V2X-Real emphasizes real-world multi-agent breadth across collaboration modes.

---

## Sensors And Labels

| Dataset | Sensors | Labels / metadata |
|---|---|---|
| V2XScenes | Mechanical LiDAR, solid-state LiDAR, blind-repair LiDAR, 4D radar, cameras | Large-range sequential 3D boxes, unique tracking IDs, condition descriptions, detection/tracking benchmarks. |
| V2XPnP Sequential | 40K LiDAR frames and 208K camera data from two vehicles and two infrastructure agents | Object trajectories, 136 objects/scene, 10 object types, PCD map, vector map, 100 scenarios, 24 intersections. |
| UrbanIng-V2X | 12 vehicle RGB cameras, 2 vehicle LiDARs, 17 infrastructure thermal cameras, 12 infrastructure LiDARs | Cooperative perception data, HD map/digital twin, OpenCOOD conversion, sequence/frame API. |
| V2X-Real | Multi-view camera and LiDAR streams from two vehicles and two infrastructure nodes | 1.2M annotated 3D boxes, 10 categories, 33K LiDAR frames, 171K camera data, four sub-datasets. |
| CoopScenes | Ego vehicle six-camera/three-LiDAR setup plus infrastructure towers | 104 minutes at 10 Hz, 62K frames, synchronized/registered/anonymized scenes. |
| V2X-Seq | Vehicle and infrastructure sequential data | Sequential perception frames, trajectories, vector maps, traffic lights, forecasting scenarios. |

The most useful datasets for airside design are those with fixed infrastructure and sequence-level identity, because aircraft stands and apron roads are dominated by occlusion, long-range approach, and handoff between viewpoints.

---

## Metrics

| Metric | Use |
|---|---|
| 3D mAP / AP by IoU | Detection quality for cooperative boxes. |
| NDS-style detection metrics | Balanced detection score where used by the benchmark. |
| AMOTA / AMOTP or tracking-metric variants | Tracking accuracy and localization over time. |
| ID switches / fragmentation | Whether cooperative handoff breaks object identity. |
| Range-sliced AP | Measures infrastructure value at long range. |
| Occlusion-sliced AP | Measures whether cooperation actually solves blind spots. |
| Mode delta | Difference between vehicle-only, infrastructure-only, V2V, V2I, I2I, and full fusion. |
| Latency/bandwidth-aware score | Needed when transmitted features or boxes have deployment constraints. |

For airside work, add clearance-specific metrics: missed actor inside the swept path, missed actor under aircraft envelope, handoff delay at stand entry, and false-clear in occluded pushback zones.

---

## Failure Modes

- Calibration errors between fixed infrastructure and vehicle sensors create ghost boxes or shifted tracks.
- Time synchronization errors are amplified in multi-agent fusion, especially for moving vehicles and pedestrians.
- Infrastructure-heavy datasets can overstate performance if the deployment cannot install equivalent sensor coverage.
- Sequential labels may hide dropped-frame or packet-delay behavior unless communication is simulated separately.
- Large-range detection may improve vehicle recall while still missing low-profile objects close to the ego vehicle.
- Tracking IDs can break when an object moves between infrastructure fields of view.
- Public-road V2X classes do not cover aircraft, tugs, belt loaders, dollies, ULDs, cones, chocks, hoses, and FOD.
- Weather and night coverage varies widely by dataset and should not be assumed from "real-world" alone.

---

## AV, Indoor, Outdoor, And Airside Relevance

| Environment | Fit | Notes |
|---|---|---|
| Public-road AV | Strong | These are built for cooperative driving perception and prediction. |
| Airport airside | Strong architecture proxy | Fixed infrastructure, controlled network, and repeated routes make V2X especially practical. |
| Indoor logistics | Moderate | Multi-agent and fixed-camera principles transfer, but sensors/maps differ. |
| Outdoor industrial sites | Strong | Similar intersections, yards, and occluded equipment corridors. |
| Long-range safety monitoring | Strong | Infrastructure can observe beyond ego line of sight. |

Airports may be easier than public roads in one respect: the operator can decide where to place infrastructure sensors and can mandate network participation. They are harder in another respect: aircraft geometry, stand equipment, GSE, reflective surfaces, and operating rules are outside public-road datasets.

---

## Validation And Data-Engine Use

1. Use V2X-Real and V2XPnP to compare collaboration modes before designing an airport sensor topology.
2. Use V2XScenes to study large-range handoff, condition labels, and cooperative tracking under challenging traffic.
3. Use UrbanIng-V2X and CoopScenes to stress multi-site calibration, synchronization, and OpenCOOD-style data conversion.
4. Build an airport dataset with fixed stand cameras/LiDAR/radar, vehicle sensors, synchronized clocks, maps, and unique IDs across stands.
5. Keep vehicle-only, infrastructure-only, and fused outputs in logs; the data engine needs to know which source found each object.
6. Mine disagreement cases: infrastructure sees an object the vehicle misses, vehicle sees an object infrastructure misses, and fusion suppresses a correct single-agent detection.
7. Add communication replay with latency, packet drop, stale transforms, and degraded collaborator trust before using V2X outputs in a safety argument.

---

## Sources

- [V2XScenes ICCV 2025 Open Access page](https://openaccess.thecvf.com/content/ICCV2025/html/Wang_V2XScenes_A_Multiple_Challenging_Traffic_Conditions_Dataset_for_Large-Range_Vehicle-Infrastructure_ICCV_2025_paper.html)
- [V2XScenes paper PDF](https://openaccess.thecvf.com/content/ICCV2025/papers/Wang_V2XScenes_A_Multiple_Challenging_Traffic_Conditions_Dataset_for_Large-Range_Vehicle-Infrastructure_ICCV_2025_paper.pdf)
- [V2XScenes supplemental PDF](https://openaccess.thecvf.com/content/ICCV2025/supplemental/Wang_V2XScenes_A_Multiple_ICCV_2025_supplemental.pdf)
- [V2XPnP project page](https://mobility-lab.seas.ucla.edu/v2xpnp/)
- [V2X-Real project page](https://mobility-lab.seas.ucla.edu/v2x-real/)
- [UrbanIng-V2X project page](https://thi-ad.github.io/urbaning/)
- [UrbanIng-V2X GitHub repository](https://github.com/thi-ad/UrbanIng-V2X)
- [UrbanIng-V2X arXiv record](https://arxiv.org/abs/2510.23478)
- [CoopScenes project page](https://coopscenes.github.io/)
- [V2X-Seq arXiv record](https://arxiv.org/abs/2305.05938)
