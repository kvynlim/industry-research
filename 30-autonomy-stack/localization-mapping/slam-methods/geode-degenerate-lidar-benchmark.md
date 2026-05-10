# GEODE Degenerate LiDAR Benchmark

<!-- method-priority:start
priority:
  learning: 4
  deployment: 4
  type: "benchmark"
  stage: "reference"
  maturity: "fielded-pattern"
  tags: ["slam", "validation", "data-engine", "outdoor"]
  reason: "GEODE Degenerate LiDAR Benchmark is rated as a SLAM benchmark or reference page for comparing methods and deployments."
method-priority:end -->

Related docs: [FAST-LIO2](fast-lio-fast-lio2.md), [KISS-ICP](kiss-icp.md), [CT-ICP](ct-icp.md), [production LiDAR-to-map localization](../overview/production-lidar-map-localization.md), and [benchmarking metrics and datasets](benchmarking-metrics-datasets.md).

**Last updated:** 2026-05-09

## Executive Summary

GEODE is a heterogeneous LiDAR dataset for benchmarking robust localization in geometrically degenerate scenarios. It is important because many public LiDAR SLAM datasets contain urban structure, loops, and enough 3D geometry for standard scan matching to look better than it will in tunnels, bridges, flat open spaces, waterways, and repetitive corridors.

The dataset provides 64 trajectories over more than 64 km across seven environments. It uses multiple LiDAR sensors, multiple scanning patterns and fields of view, plus shared IMU and stereo-camera components across acquisition systems. GEODE is therefore useful for separating algorithmic robustness from sensor-specific success.

## What It Adds

- A benchmark centered on geometric degeneracy rather than average urban driving.
- Multiple LiDAR configurations to test FOV and scanning-pattern sensitivity.
- Standard and co-captured trajectories.
- Environments such as flat surfaces, shield tunnels, tunneling tunnels, bridges, offroad routes, urban tunnels, and inland waterways.
- An online benchmark and evaluation tooling.

## Sensor and Dataset Design

The project describes three acquisition systems. Each shares an IMU and stereo camera but uses different LiDAR sensors. That matters because degeneracy is not only scene-driven. A narrow-FOV, non-repetitive, solid-state, or spinning LiDAR can produce different observability in the same corridor.

Useful dataset groupings:

| Group | Stressor |
|---|---|
| Flat surfaces | Weak vertical and lateral geometric constraints |
| Shield / tunneling tunnels | Corridor self-similarity and long feature-poor motion |
| Bridges | Repetitive linear structure and high-speed vehicle motion |
| Offroad | Vegetation, rough ground, and irregular motion |
| Urban tunnels | Long runs with poor GNSS and repetitive geometry |
| Inland waterways | Open structure, specular surfaces, and sparse stable features |

## Timing and Calibration

GEODE is mainly a LiDAR degeneracy benchmark, but multi-sensor calibration still matters:

- LiDAR-IMU extrinsics and timing affect deskewing.
- Stereo-camera data can support cross-modal checks or visual-inertial baselines.
- Co-captured trajectories allow comparison across LiDAR sensors under similar motion.

When using GEODE to test a production LIO stack, report the exact LiDAR subset, IMU handling, deskewing policy, and whether visual data was used.

## Degeneracy Metrics

Do not report only mean ATE. Add:

- drift per meter in tunnel and bridge segments,
- yaw drift in long corridors,
- vertical drift in flat-surface sequences,
- failure rate and relocalization rate,
- degeneracy detector precision against known degenerate scenes,
- covariance consistency during weak-observability periods,
- runtime and memory by LiDAR configuration.

For LiDAR-to-map localization, also track scan-to-map inlier geometry and eigenvalue ratios. A method that produces low residuals in a tunnel can still be sliding along the tunnel axis.

## Integration Readiness

GEODE is a strong benchmark input for selecting LIO and scan-matching front ends. It is less a deployable method than a validation gate. Use it to test FAST-LIO2, KISS-ICP, CT-ICP, Point-LIO, GLIM, MA-LIO, PG-LIO, and custom degeneracy-aware map localization.

## Limitations

- It focuses on geometric degeneracy; dynamic-object map contamination is a different benchmark axis.
- It is not radar, UWB, GNSS, or semantic-map centered.
- Airport apron and terminal-edge conditions are not directly covered.
- Online benchmark results need configuration scrutiny because sensor usage can change the task.

## Sources

- GEODE dataset site: https://thisparticle.github.io/geode/
- GEODE arXiv paper: https://arxiv.org/abs/2409.04961
- GEODE development toolkit: https://github.com/PengYu-Team/GEODE_dataset
- GEODE journal page: https://journals.sagepub.com/doi/10.1177/02783649251344967
