# View of Delft 4D Radar

**Last updated:** 2026-05-09

The View-of-Delft dataset is a compact but influential urban perception benchmark for high-resolution automotive radar. It pairs 3+1D radar with 64-layer LiDAR, stereo camera data, odometry, calibration, and multi-class 3D boxes, making it a practical anchor for radar-only and radar-fusion 3D detection research.

**Related pages:** [4D radar sensor overview](../../../20-av-platform/sensors/4d-radar.md), [radar-LiDAR fusion in adverse weather](../overview/radar-lidar-fusion-adverse-weather.md), [TJ4DRadSet](tj4dradset-4d-radar.md)

---

## Scope

| Item | View-of-Delft coverage |
|---|---|
| Primary domain | Complex urban traffic in Delft |
| Scale | 8600 synchronized, calibrated frames |
| Annotation scale | More than 123,000 3D bounding boxes |
| Radar role | Front-mounted 3+1D radar as a primary evaluated modality |
| Main use | 3D road-user detection, tracking IDs, radar-camera/LiDAR fusion |

The dataset is particularly useful because it offers 3D boxes and track IDs over a radar sensor that is stronger than legacy 2D automotive radar but still sparse and noisy compared with LiDAR.

---

## Sensors And Labels

| Asset | Notes |
|---|---|
| Radar | ZF FRGen21 3+1D radar, about 13 Hz, behind the front bumper |
| Stereo camera | 1936 x 1216 px, about 30 Hz, windshield-mounted |
| LiDAR | Velodyne HDL-64 S3, about 10 Hz, roof-mounted |
| Odometry | Filtered RTK GPS, IMU, and wheel odometry, about 100 Hz |
| Calibration | Joint sensor calibration and transformation utilities in the devkit |
| Labels | 3D boxes for 13 road-user classes with occlusion, activity, information, and track IDs |

The public README reports more than 26,000 pedestrian labels, 10,000 cyclist labels, and 26,000 car labels.

---

## Tasks And Metrics

| Task | Practical metric |
|---|---|
| Radar-only 3D detection | 3D AP/BEV AP by class and range |
| Radar-camera fusion | AP gain over radar-only and camera-only baselines |
| Radar-LiDAR comparison | Gap to LiDAR detector under the same boxes and calibration |
| Tracking | ID switches, MOTA/HOTA-style metrics if using track IDs |
| Representation ablation | Point features, Doppler/RCS, range cuts, BEV voxelization |

Most radar papers report KITTI-like 3D/BEV AP, often with a special driving-corridor evaluation. For production screening, also report false positives near sparse radar clutter and small-object recall.

---

## Best Use

Use View-of-Delft to:

- benchmark radar-native 3D detectors before adding LiDAR;
- test camera-radar fusion where radar contributes depth and velocity cues;
- compare point-cloud, pillar, and BEV representations for radar;
- validate track-ID usage for multi-frame radar perception;
- reproduce a widely used baseline before moving to larger 4D radar datasets.

It is a good first public benchmark for radar perception algorithms because the data and devkit are mature and many papers report comparable numbers.

---

## Airside Transfer

For airside autonomy, View-of-Delft is a proxy for front-radar detection of vehicles, cyclists, pedestrians, and clutter. It can inform:

- radar point encoding and Doppler feature handling;
- camera-radar calibration and projection debugging;
- fusion behavior when LiDAR is degraded or unavailable;
- small-object and pedestrian detection limits under sparse radar evidence.

Airport use still needs new data. Aircraft fuselages, belt loaders, baggage carts, tugs, dollies, jet bridges, cones, and chocks have radar signatures and occlusion patterns unlike Delft road users.

---

## Limitations

- It is urban road data, not an adverse-weather or airport dataset.
- Radar coverage is front-oriented, not a full 360-degree radar suite.
- Access is restricted to non-commercial academic/non-profit research terms.
- It is smaller than newer large radar datasets.
- 3+1D radar is not identical to every modern 4D imaging radar product or raw tensor format.

---

## Sources

- [View-of-Delft official project page](https://intelligent-vehicles.org/datasets/view-of-delft/)
- [View-of-Delft GitHub/devkit](https://github.com/tudelft-iv/view-of-delft-dataset)
- [View-of-Delft paper DOI](https://doi.org/10.1109/LRA.2022.3147324)
