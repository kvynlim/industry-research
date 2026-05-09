# Classical LiDAR Outlier Removal

## What It Is

Classical LiDAR outlier removal is the family of deterministic point-cloud filters that remove measurements that look physically implausible before detection, segmentation, SLAM, or map building. These filters are not one method. They include baseline library operators such as Statistical Outlier Removal (SOR) and Radius Outlier Removal (ROR), weather-tuned extensions such as DROR, DSOR, LIOR, DDIOR, D-LIOR, IDSOR, DVIOR, SDOR, and LIDSOR, and production wrappers that expose removed points as diagnostics rather than silently dropping them.

The core deployment value is explainability. A team can inspect which points were removed, why they were removed, and how the filter changes downstream localization or object detection. That makes these filters useful as baselines and safety monitors even when learned methods such as LIORNet are also evaluated.

## Core Technical Idea

Most classical filters test one or more of these signals:

- Neighborhood sparsity: isolated points have too few neighbors.
- Statistical distance: a point's mean distance to nearby points is abnormal.
- Range dependence: far LiDAR points are naturally sparser than near points.
- Intensity: precipitation, mist, dust, and low-reflectance particles often have different return intensity distributions from solid objects.
- Sector or local density: point spacing varies by azimuth, elevation, scan pattern, and occlusion.
- Temporal persistence: real structure is repeated; falling particles are often unstable frame to frame.

The best filters are usually conservative and context aware. A fixed radius that works at 5 m can delete valid structure at 80 m; a fixed intensity threshold can delete black tires, rubber chocks, dark clothing, wet asphalt, or low-reflectance aircraft surfaces.

## Inputs and Outputs

| Item | Required | Notes |
|---|---:|---|
| XYZ point cloud | Yes | Usually one LiDAR frame or a fused multi-LiDAR cloud. |
| Intensity or reflectivity | Useful | Needed by LIOR, DDIOR, D-LIOR, IDSOR, DVIOR, and LIDSOR-style filters. |
| Ring/channel index | Useful | Helps sector, vertical, and channel-aware filtering. |
| Per-point timestamp | Useful | Needed if filtering after deskewing or multi-frame persistence checks. |
| Sensor angular resolution | Useful | Needed by DROR/DSOR-style range-adaptive radii. |
| Weather or health state | Optional | Lets the stack choose normal, rain, snow, fog, dust, or blockage parameters. |

Outputs should include:

- Filtered inlier cloud.
- Removed outlier cloud.
- Per-point or per-cell removal reason when feasible.
- Aggregate diagnostics: removal ratio, per-sector removal ratio, range bins, intensity bins, and static inlier count.

## Architecture or Pipeline

1. Remove NaNs, invalid rings, impossible ranges, and points inside the vehicle body.
2. Deskew or use raw scan coordinates consistently; mixing states creates false sparsity.
3. Downsample only if the chosen filter is defined on the downsampled density.
4. Apply a conservative baseline filter such as SOR or ROR for gross isolated points.
5. Apply weather-specific filters only when weather, intensity, or diagnostics justify it.
6. Preserve removed points on a debug topic or log channel.
7. Gate downstream consumers separately: detection may tolerate more noise than localization, while map construction needs stricter dynamic and artifact rejection.
8. Validate filter impact on both false positives and false negatives.

## Technique Taxonomy

| Filter | Main signal | Best use | Main risk |
|---|---|---|---|
| SOR | Mean distance to k nearest neighbors versus global distribution | General isolated outlier removal; Open3D and PCL baseline | Deletes valid sparse long-range structure if density is non-uniform. |
| ROR | Minimum neighbors inside fixed radius | Fast local density screen | Fixed radius is brittle across range and scan pattern. |
| DROR | Radius grows with point range and angular resolution | Snow/rain where far points are naturally sparse | Still distance-driven; dense near precipitation can survive. |
| DSOR | Statistical outlier threshold adjusted by range | Severe snow; WADS-style winter data | Better snow recall can over-remove thin/far static features. |
| LIOR | Low-intensity preselection plus neighbor rescue | Snow points with low intensity; fast filtering | Fixed intensity thresholds are hardware and material dependent. |
| DDIOR | Distance and intensity combined into dynamic threshold | Snow with near-dense, far-sparse behavior | Requires intensity calibration; not a universal artifact filter. |
| D-LIOR | Dynamic low-intensity threshold estimated from data | Adaptive snow filtering with real-time goals | Public details are newer and should be validated independently. |
| IDSOR | Intensity plus distance-aware statistical sparsity | Rain/snow where empirical range distribution is available | Needs trustworthy weather-return model and target-domain checks. |
| DVIOR | Distance, vertical/height cues, and low intensity | Snow noise above ground or with vertical structure | Vertical priors may fail on ramps, curbs, aircraft gear, or stands. |
| SDOR | Sector-wise density adaptation and parallel filtering | Large clouds under rain, snow, and fog | Sector boundaries and density estimates can bias sparse sensors. |
| LIDSOR | Low-intensity dynamic statistical filtering with distance/intensity thresholds | Rain and snow noise with fitted spatial distributions | Thresholds transfer poorly across LiDARs without calibration. |

## Training and Evaluation

Classical filters do not train a model, but they still need calibration and validation. Evaluate them as algorithms with tuned parameters, not as one-size-fits-all utilities.

Minimum evaluation:

- Precision, recall, F1, and removed-point class mix on labeled noisy points.
- Downstream detector false positives and false negatives before and after filtering.
- Localization residual, ICP/NDT/VGICP inlier count, and degeneracy before and after filtering.
- Static map completeness and ghost-clutter rate after map construction.
- Runtime at full point rate, not only after aggressive crop boxes.

Useful public signals include WADS for severe winter snow, CADC/RADIATE for adverse-condition context, Weather-KITTI-style synthetic weather, and SemanticKITTI-derived map-cleaning labels. Airside data is still required for aircraft, GSE, glycol mist, wet concrete, retroreflective markings, chocks, cones, and personnel.

## Strengths

- Explainable and easy to audit.
- Works without labels, training data, or GPU inference.
- Good first-line protection against isolated false points.
- Good as a regression baseline for learned denoisers.
- Produces useful health diagnostics when removed points are preserved.
- Can be implemented with mature Open3D, PCL, or ROS point-cloud preprocessors.

## Failure Modes

- Over-removal of thin static structures such as poles, tow bars, cones, fences, light stands, and aircraft gear.
- Deletion of dark, wet, or low-reflectance real objects when intensity thresholds are too aggressive.
- Under-removal of dense spray, fog, dust, or wet-surface multipath that looks locally coherent.
- Hardware transfer failure because intensity units are not standardized across LiDAR vendors.
- False confidence when the cleaned cloud looks neat but has lost safety-critical obstacles.
- Hidden downstream coupling when a detector was trained on unfiltered clouds but deployed on filtered clouds.

## Airside AV Fit

Classical filtering is high value for airside autonomy, but it should be treated as a monitored preprocessing layer, not as proof that the scene is safe.

Recommended use:

- Run SOR/ROR or light DROR/DSOR as baseline diagnostics.
- Enable intensity/range filters only with per-LiDAR calibration and weather state.
- Keep rain/snow/fog/glycol/dust parameters separate from normal clear-weather parameters.
- Exempt safety-critical near-field classes from permanent deletion unless another sensor confirms the point is artifact.
- Feed removed-point ratios into ODD management, speed limiting, and sensor cleaning decisions.
- Use radar and camera/thermal agreement to avoid deleting real people or GSE during heavy weather.

## Implementation Notes

- Start with Open3D/PCL baselines and log the removed cloud.
- Tune by range bin, not by a single global threshold.
- Treat intensity as sensor-specific; do not copy thresholds across Ouster, Hesai, RoboSense, Aeva, or Velodyne without calibration.
- Validate on merged multi-LiDAR clouds after checking extrinsics and timing; misregistration looks like outlier noise.
- Publish `removed_reason` or separate topics such as `removed_sor`, `removed_weather`, and `removed_geometry` when possible.
- Never update a persistent map from filtered data unless the filter configuration and diagnostics are archived with the map build.

## Sources

- Open3D point cloud outlier removal tutorial: https://www.open3d.org/docs/latest/tutorial/Advanced/pointcloud_outlier_removal.html
- PCL filters module: https://pointclouds.org/documentation/group__filters.html
- DSOR and WADS: https://arxiv.org/abs/2109.07078
- DDIOR: https://www.mdpi.com/2072-4292/14/6/1468
- LIOR: https://doi.org/10.1109/ACCESS.2020.3020266
- KAIST LIOR publication page: https://pure.kaist.ac.kr/en/publications/fast-and-accurate-desnowing-algorithm-for-lidar-point-clouds
- DVIOR: https://www.mdpi.com/2079-9292/14/18/3662
- IDSOR: https://arxiv.org/abs/2602.05876
- SDOR: https://www.nature.com/articles/s41598-026-38674-6
- LIORNet: https://arxiv.org/abs/2603.19936
- LIDSOR: https://isprs-archives.copernicus.org/articles/XLVIII-1-W2-2023/733/2023/
