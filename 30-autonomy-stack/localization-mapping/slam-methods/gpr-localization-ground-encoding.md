# GPR Localization and Ground Encoding

<!-- method-priority:start
priority:
  learning: 3
  deployment: 3
  type: "method-family"
  stage: "deployment-pattern"
  maturity: "prototype"
  tags: ["slam", "fallback", "gnss-denied", "outdoor", "adverse-weather"]
  reason: "GPR Localization and Ground Encoding is rated for alternative-sensor localization under adverse weather, weak LiDAR, or GNSS-denied conditions."
method-priority:end -->

## Summary

Ground-penetrating radar localization uses subsurface structure as a localization signal. Instead of matching cameras to appearance or LiDAR to surface geometry, localizing GPR measures below-ground reflectivity patterns that are often stable across weather, lighting, snow, dust, and surface-appearance changes.

This is an alternative localization modality, not radar odometry. Automotive or scanning radar observes above-ground reflectors and usually estimates motion from live radar scans. Localizing GPR looks downward, builds or uses a subsurface map, and localizes by matching underground signatures. Ground Encoding extends this idea into unknown or GPS-denied environments by learning relative factors between GPR image submaps and inserting them into a factor graph.

## What It Is

GPR localization equips a vehicle with a downward-facing radar array that emits electromagnetic pulses into the ground and measures reflected energy from subsurface features. These features can include soil layers, rocks, utilities, roadbed composition, rebar, drainage, voids, and other dielectric discontinuities.

Two important method families:

- **Map-based LGPR localization:** build a prior subsurface map and localize live GPR scans against it using correlation or registration.
- **Ground Encoding:** form 2D GPR submaps from 1D measurements and learn relative sensor models that predict motion between non-sequential GPR image pairs for factor-graph correction.

## Core Idea

The core assumption is that subsurface radar signatures are repeatable enough to act as a place-specific fingerprint. Surface conditions can change dramatically while the underground response remains more stable than lane markings, visual texture, snow-covered pavement, or LiDAR-visible clutter.

Ground Encoding addresses a hard part of GPR: the raw image is high-dimensional and governed by complex radar physics. Rather than hand-designing a perfect measurement model, it learns relative models from GPR data and uses those models as factors in a graph. This allows GPR to correct drift in unknown or GPS-denied settings without requiring a global prior map in the same way as classical LGPR map matching.

## Inputs and Outputs

| Item | Role |
|---|---|
| GPR traces or radargrams | Downward-looking subsurface measurements. |
| Vehicle odometry/IMU/wheel data | Provides motion priors and short-term propagation. |
| Prior subsurface map | Required for classical map-based LGPR localization. |
| GPR submaps | Local 2D images formed from sequences of 1D GPR measurements. |
| Learned relative sensor model | Predicts relative motion or matching factors from GPR submap pairs. |
| Factor graph | Fuses odometry, GPR constraints, priors, and loop-like corrections. |
| Pose estimate | Vehicle pose relative to the GPR map or local graph frame. |
| Match quality | Correlation score, uncertainty, factor residual, or retrieval confidence. |

## Pipeline

1. **Data collection**
   - Collect GPR traces with precise timestamps and vehicle motion estimates.
   - Calibrate GPR mounting, time offsets, and antenna geometry.

2. **Signal preprocessing**
   - Apply gain, filtering, background removal, and normalization.
   - Convert traces into radargrams or local submap images.

3. **Map building or submap formation**
   - For LGPR, accumulate a subsurface map tied to a route frame.
   - For Ground Encoding, form local GPR image submaps for graph factors.

4. **Matching or learned factor generation**
   - Use correlation-based registration against a prior map, or
   - Run a learned model on pairs of GPR submaps to estimate relative motion.

5. **Graph optimization or filtering**
   - Fuse GPR factors with odometry, IMU, wheel, and prior constraints.
   - Reject low-confidence matches and inflate uncertainty under weak subsurface texture.

6. **Output**
   - Publish pose, covariance, match scores, and localization health.

## Strengths

- Robust to lighting, fog, dust, snow cover, rain, visual changes, and many above-ground clutter changes.
- Uses a physically different environmental signature from cameras, LiDAR, GNSS, and radar odometry.
- Can provide lane-level or centimeter-level repeatability in mapped areas when the sensor and map are suitable.
- Subsurface maps can remain stable despite surface traffic and movable objects.
- Ground Encoding enables GPR constraints in unknown or GPS-denied environments through learned relative factors.

## Failure Modes

- Requires specialized downward-looking GPR hardware, mounting space, and ground clearance.
- Performance depends on soil, pavement, moisture, depth, antenna design, and frequency.
- Water content, freeze/thaw cycles, resurfacing, construction, or ground works can alter signatures.
- Open concrete aprons or uniform engineered surfaces may have weak distinctive subsurface features.
- Speed, vibration, antenna coupling, and vehicle height changes can degrade signal repeatability.
- Prior-map approaches need careful survey and map maintenance.
- Learned models can fail when deployed on a different radar, soil type, pavement structure, or geographic domain.

## Airside/AV Fit

GPR localization is attractive for adverse-weather AVs because it is not blocked by fog, darkness, glare, snow cover, or many surface clutter changes. For airports, it could be valuable on fixed service roads, terminal-adjacent routes, tunnels, and repeatedly traversed apron corridors where GNSS multipath, wet markings, and dynamic vehicles create localization risk.

Airside caveats:

- Airport pavement is engineered and may be resurfaced, repaired, grooved, or patched; map validity must track maintenance records.
- Large open aprons may have limited subsurface texture depending on construction.
- Sensor mounting must not interfere with clearance, debris tolerance, or vehicle maintenance.
- GPR should be fused with LiDAR/radar/INS/wheel/GNSS rather than used as a single authority.
- Validation should include wet/dry, hot/cold, resurfaced, snow-covered, and construction-affected pavement.

GPR is best viewed as an alternative map-localization channel for known routes, not a replacement for general SLAM.

## Implementation Notes

- Treat GPR maps as route-specific assets with survey metadata and pavement-maintenance validity.
- Measure localization health through match score distributions, factor residuals, and repeatability by route segment.
- Calibrate antenna-to-base extrinsics and timestamp alignment; small errors can bias map matching.
- Use wheel odometry and IMU to constrain short-term motion between GPR corrections.
- Build fallback behavior for low-texture or altered-ground segments.
- Revalidate after resurfacing, trenching, utility work, or seasonal ground changes.
- Keep GPR factors independent in the fusion backend so their covariance can be inflated when subsurface evidence is weak.

## Sources

- Ground Encoding paper: https://arxiv.org/abs/2103.15317
- Ground Encoding CMU publication page: https://www.cs.cmu.edu/~kaess/pub/Baikovitz21iros.html
- Ground Encoding PDF: https://www.cs.cmu.edu/~kaess/pub/Baikovitz21iros.pdf
- GROUNDED dataset paper: https://journals.sagepub.com/doi/abs/10.1177/02783649231183460
- GROUNDED dataset site: http://lgprdata.com
- MIT Lincoln Laboratory GPR localization paper: https://saemobilus.sae.org/papers/ground-penetrating-radar-based-localization-2024-01-3438
- Local context: [robust multi-sensor localization](../overview/robust-state-estimation-multi-sensor.md), [radar odometry and radar SLAM](radar-odometry-radar-slam.md)
