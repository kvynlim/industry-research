# LIORNet

## What It Is

- LIORNet is a 2026 self-supervised LiDAR snow-removal framework for autonomous driving under adverse weather.
- It targets spurious LiDAR returns from falling snow and is explicitly motivated by degradation in snow, rain, and fog, but its demonstrated filtering task is snow removal.
- It combines learned segmentation with physical and statistical priors instead of relying only on fixed distance or intensity thresholds.
- It is not a general object detector, localization system, or full adverse-weather perception stack.
- It should be read beside [Radar-LiDAR Fusion in Adverse Weather](../overview/radar-lidar-fusion-adverse-weather.md), [Production Perception Systems](../overview/production-perception-systems.md), and learned snow filters such as [LiSnowNet](lisnownet.md) and [SLiDE](slide-lidar-desnowing.md).

## Core Technical Idea

- Convert each LiDAR sweep into a structured range image with range, intensity, and reflectivity channels.
- Train a U-Net++ encoder-decoder to predict a point-wise snow mask from that range/intensity/reflectivity range image.
- Use residual blocks, nested skip connections, bilinear upsampling, and deep supervision to stabilize dense mask learning on sparse, noisy data.
- Avoid manual snow labels by generating pseudo-labels from physics and rules: range-dependent intensity thresholds, reflectivity consistency, spatial sparsity, edge conditions, and sensing-range constraints.
- Produce a sigmoid snow mask, then map it back one-to-one to the original LiDAR points so the output point cloud preserves the input ordering and geometry for non-snow points.
- Apply physics/rule post-processing after the learned mask to correct false positives using LiDAR height, plausible snow sensing distance, ground conditions, and range constraints.

## Inputs and Outputs

- Input: one LiDAR sweep with per-point range, intensity, and reflectivity values that can be projected into a range image.
- Input during training: unlabeled snowy point clouds plus pseudo-labels generated from LIORNet's physical and statistical rules.
- Output: a binary or probabilistic snow mask over the range image.
- Output: a denoised point cloud formed by removing points classified as snow.
- Intermediate output: supervised heads at multiple decoder depths when deep supervision is enabled.
- Non-output: it does not classify objects, estimate motion, correct ego pose, restore occluded geometry, or produce radar corroboration.

## Architecture or Pipeline

- Project the raw point cloud to a spherical range-image representation with channels for range, intensity, and reflectivity.
- Generate pseudo-labels by sequentially applying intensity, reflectivity, edge, sparsity, and range conditions to identify likely snow points.
- Feed the three-channel range image into a U-Net++ style encoder-decoder.
- Use residual blocks made from convolution, batch normalization, and ReLU layers.
- Use nested skip paths to fuse shallow spatial detail with deeper semantic context.
- Use deep supervision to train multiple decoder outputs instead of relying only on the final mask.
- Apply a sigmoid activation to obtain the snow probability mask.
- Reproject the mask back to the original point cloud with a one-to-one point mapping.
- Apply physics/rule post-processing to suppress implausible snow predictions and preserve environmental structures.

## Training and Evaluation

- The paper trains on WADS and evaluates on WADS, CADC, and self-collected snow data from South Korea, Sweden, and Denmark.
- Reported baselines include DROR, LIOR, D-LIOR, DSOR, DDIOR, and LiSnowNet.
- The best reported configuration combines U-Net++, deep supervision, and post-processing.
- The paper reports strong recall and a 43.5 Hz runtime for the U-Net++ with post-processing configuration on WADS, which is above common 10-20 Hz spinning-LiDAR frame rates.
- The authors report that post-processing reduces false-positive snow classifications, improving the precision/recall balance.
- Evaluation is primarily about snow/noise filtering and structural preservation, not downstream safety-case performance.

## Strengths

- Keeps useful hand-engineered physics in the loop while adding a learned mask for more adaptive snow separation.
- Uses range, intensity, and reflectivity together instead of depending on a single threshold.
- Avoids manual snow annotation by using pseudo-labels, which matters because snow points are small, dense, and transient.
- The one-to-one point mapping makes integration easier for pipelines that expect the original point ordering or per-point metadata.
- U-Net++ nested skips and deep supervision are a reasonable fit for thin structures, curbs, road boundaries, poles, and walls in range-image form.
- Post-processing gives an explicit guardrail against learned over-filtering near the ground and sensor.

## Failure Modes

- It is still a snow-removal method; rain, fog, road spray, de-icing mist or steam, dust, and multipath ghosts require separate validation.
- Reflectivity and intensity distributions vary by LiDAR vendor, firmware, gain settings, target material, wetness, and range.
- Rule-derived pseudo-labels can bake in the same sensor and weather assumptions that the learned model is meant to overcome.
- Range-image projection can blur nonuniform vertical beam layouts and can lose detail where multiple 3D points collide into one pixel.
- Close dynamic-object points, exhaust plumes, aircraft de-icing spray, reflective paint, and wet ground splash can look snow-like to range/intensity rules.
- Post-processing improves stability but can hide systematic errors if it is tuned on a narrow sensor height or weather regime.
- The paper is recent research, not a production safety argument.

## Airside AV Fit

- Strong research fit for gates, service roads, aprons, and perimeter roads that must operate in snowfall.
- Useful as a LiDAR preprocessing candidate before obstacle detection, mapping, and freespace extraction, especially when false snow obstacles cause nuisance stops.
- Airside validation must include de-icing mist, glycol spray, jet blast disturbed snow, rain-on-snow, wet concrete, reflective aircraft skins, cones, chocks, personnel, and GSE.
- It should not be the only adverse-weather mitigation; production stacks need radar, camera confidence handling, weather state estimation, health monitoring, and fallback behavior.
- Best used with [Radar-LiDAR Fusion in Adverse Weather](../overview/radar-lidar-fusion-adverse-weather.md) so radar can challenge LiDAR-only filtering decisions.
- Treat it as a candidate module feeding a larger [Production Perception Systems](../overview/production-perception-systems.md) design, not as standalone airside perception.

## Implementation Notes

- Preserve original point indices so downstream boxes, tracks, and map updates can be audited against removed points.
- Calibrate intensity and reflectivity normalization per sensor SKU, firmware version, and operating mode.
- Keep pseudo-label generation, post-processing thresholds, and model weights versioned together.
- Log the raw point cloud, projected range image, predicted mask, post-processed mask, and removed point set for every regression scenario.
- Add explicit test buckets for snow, rain, fog, road spray, de-icing mist, steam, dust, ghost/multipath returns, and dynamic-object points even if the model is trained only for snow.
- Monitor over-removal around small obstacles, cone tips, personnel legs, tow bars, wing edges, and low-profile chocks.
- Benchmark on embedded hardware; U-Net++ can meet nominal frame rates in the paper, but full system latency includes projection, post-processing, copying, and downstream perception.

## Sources

- arXiv abstract: https://arxiv.org/abs/2603.19936
- arXiv HTML paper: https://arxiv.org/html/2603.19936v1
- Ouster blog, corrected official URL: https://ouster.com/insights/blog/inha-liornet-lidar-in-the-snow
