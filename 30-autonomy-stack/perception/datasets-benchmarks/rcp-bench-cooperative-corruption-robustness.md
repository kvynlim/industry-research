# RCP-Bench Cooperative Corruption Robustness

**Last updated:** 2026-05-09

RCP-Bench is a CVPR 2025 benchmark for robustness in collaborative perception under camera corruptions. It is useful because cooperative perception papers often report gains under ideal communication and sensor conditions, while deployed connected vehicles can face weather, camera faults, temporal misalignment, and corrupted collaborator inputs.

**Related pages:** [sensor corruption robustness benchmarks](sensor-corruption-robustness-benchmarks.md), [infrastructure cooperative perception](../overview/infrastructure-cooperative-perception.md), [MultiCorrupt](../methods/multicorrupt.md), [MSC-Bench](../methods/msc-bench.md), [RCooper](../methods/rcooper.md), [V2X-RealO](../methods/v2x-realo.md)

---

## Scope

| Item | Description |
|---|---|
| Core task | Robustness evaluation for collaborative 3D object detection. |
| Base datasets | OPV2V, V2XSet, and DAIR-V2X. |
| Corrupted datasets | OPV2V-C, V2XSet-C, and DAIR-V2X-C generated from test splits. |
| Corruptions | 14 camera corruptions with five severity levels. |
| Interference scenarios | Global, ego-only, and CAV-only interference, with six collaborative cases in the paper. |
| Models evaluated | 10 leading collaborative perception models according to the paper/repository. |
| Robustness strategies | RCP-Drop and RCP-Mix. |

RCP-Bench focuses on camera corruptions for collaborative perception. It does not cover LiDAR corruptions, communication packet loss in full network detail, cybersecurity attacks, or airport-specific sensor artifacts.

---

## Benchmark Design

RCP-Bench isolates where corruption enters a collaborative perception system:

| Scenario | Corrupted source | Operational meaning |
|---|---|---|
| Global interference | Ego and collaborators are corrupted | Shared weather, lighting, or widespread camera degradation. |
| Ego interference | Only the ego vehicle is corrupted | Collaboration may compensate for a degraded ego view. |
| CAV interference | One or more collaborating vehicles are corrupted | Collaboration can become harmful if bad remote features are fused. |
| Single corruption | One corruption type at a time | Controlled diagnosis. |
| Multiple / heterogeneous corruption | Different corruptions occur together or across agents | Closer to messy real deployments. |
| New scenes with corruption | Corruption under scene variation | Tests whether robustness survives distribution shift. |

This source isolation is the main value. A model that improves AP under ego-only corruption can still be unsafe if it degrades under corrupted collaborator features.

---

## Sensors, Labels, And Corruptions

| Field | Details |
|---|---|
| Modalities | Collaborative perception datasets with camera and 3D detection labels; RCP-Bench corrupts camera inputs. |
| Labels | Original 3D object detection labels from OPV2V, V2XSet, and DAIR-V2X. |
| External weather corruptions | Rain, fog, snow, brightness/darkness, frost. |
| Camera interior corruptions | Camera crash, Gaussian noise, shot noise, impulse noise, zoom blur, motion blur, defocus blur, color quantization. |
| Temporal corruption | Desynchronized capture times. |
| Severity | Five levels per corruption type, yielding 70 corruption conditions per relevant setting. |
| Dataset creation | Corrupted subsets are generated for evaluation from test splits, not used as training data in the repository workflow. |

The benchmark uses the same task labels while perturbing inputs, enabling clean-to-corrupt degradation and collaborative compensation/harm to be measured directly.

---

## Metrics

| Metric | Use |
|---|---|
| AP_cor | Detection AP under corrupted conditions. |
| RCE | Relative Corruption Error for robustness comparison. |
| PosC | Positive Collaborative Coefficient, measuring beneficial collaboration under corruption. |
| NegC | Negative Collaborative Coefficient, measuring harmful collaboration under corruption. |
| Clean AP | Required reference point; robustness without clean accuracy is incomplete. |
| Per-corruption AP | Diagnoses specific failures hidden by aggregate metrics. |
| Per-scenario AP | Separates global, ego, and CAV interference behavior. |

For safety review, keep the full per-class, per-corruption, per-severity table. Aggregate robustness can hide a fatal case such as pedestrian recall collapse under CAV temporal misalignment.

---

## Failure Modes Exposed

- Collaboration can amplify corrupted remote features instead of compensating for them.
- Global interference can remove the diversity benefit that cooperative perception relies on.
- Ego-only corruption can make collaboration look strong, while CAV-only corruption reveals trust and gating weaknesses.
- Attention-based or complex fusion modules may overfit clean collaborative patterns.
- More cameras and more collaborators improve stability only up to a point and can add noisy inputs.
- A model may remain strong under image noise but fail under temporal desynchronization.
- Camera-only corruption does not exercise LiDAR faults, radar faults, pose errors, or network delay in a physically complete way.

---

## AV, Indoor, Outdoor, And Airside Relevance

| Environment | Fit | Notes |
|---|---|---|
| Public-road V2X | Strong | Directly covers DAIR-V2X, OPV2V, and V2XSet-style collaborative perception. |
| Airport airside | Strong protocol proxy | Airport cooperative perception has fixed infrastructure and vehicles, but needs airside sensors and classes. |
| Indoor multi-robot | Moderate | Source-isolated corruption idea transfers, but camera/fusion setups differ. |
| Outdoor industrial sites | Strong | Similar fixed infrastructure plus mobile-agent collaboration patterns. |
| Runtime assurance | Strong | Useful for trust gating, collaborator dropout, and degraded-mode policies. |

Airports are a natural fit for the RCP-Bench style of evaluation because the operator can control infrastructure sensors and network topology. The missing pieces are airport classes, fixed-camera glare/night artifacts, jet-bridge occlusion, aircraft geometry, and ground-service vehicle behavior.

---

## Validation And Data-Engine Use

1. Run clean, global, ego-only, and CAV-only evaluations for every cooperative model candidate.
2. Treat corrupted collaborator harm as a first-class metric; do not only report cases where collaboration helps.
3. Add trust gating and collaborator health signals to the evaluation log: camera health, timestamp, pose quality, packet age, and confidence.
4. For airside transfer, clone the scenario structure with stand cameras, apron poles, vehicle cameras, and mobile equipment.
5. Add airport corruptions: floodlight glare, wet apron reflections, de-icing mist, jet exhaust shimmer, snow piles, dirt on fixed camera housings, and rolling-shutter flicker.
6. Validate fallback policies: ego-only, infrastructure-only, no-remote-fusion, and stop/slow modes under each corruption.
7. Keep corrupted data generation out of the final locked test holdout unless the safety case explicitly requires synthetic fault injection.

---

## Sources

- [RCP-Bench CVPR 2025 paper PDF](https://openaccess.thecvf.com/content/CVPR2025/papers/Du_RCP-Bench_Benchmarking_Robustness_for_Collaborative_Perception_Under_Diverse_Corruptions_CVPR_2025_paper.pdf)
- [RCP-Bench supplemental PDF](https://openaccess.thecvf.com/content/CVPR2025/supplemental/Du_RCP-Bench_Benchmarking_Robustness_CVPR_2025_supplemental.pdf)
- [RCP-Bench GitHub repository](https://github.com/LuckyDush/RCP-Bench)
- [DAIR-V2X dataset](https://thudair.baai.ac.cn/)
- [OPV2V project page](https://mobility-lab.seas.ucla.edu/opv2v/)
- [V2X-ViT / V2XSet repository](https://github.com/DerrickXuNu/v2x-vit)
