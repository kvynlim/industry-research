# Perception Method Library Overview

This directory is the method-level perception library. Each page should represent one technique, method, benchmark, or dataset-backed evaluation primitive. Broad synthesis pages in `technology/perception/` remain useful for system design, but this library is where individual methods get enough space for architecture, data, benchmarks, failure modes, deployment fit, and airside relevance.

## How to Use This Library

| Need | Start here |
|---|---|
| Camera BEV and camera occupancy | [BEVDet](bevdet.md), [BEVDepth](bevdepth.md), [BEVStereo](bevstereo.md), [SOLOFusion](solo-fusion.md), [TPVFormer](tpvformer.md), [SurroundOcc](surroundocc.md), [SparseOcc](sparseocc.md), [FlashOcc](flashocc.md), [SelfOcc](selfocc.md), [RenderOcc](renderocc.md) |
| LiDAR motion and temporal segmentation | [LiDAR-MOS](lidar-mos.md), [4DMOS](4dmos.md), [InsMOS](insmos.md), [StreamMOS](streammos.md), [4DSegStreamer](4dsegstreamer.md), [SegNet4D](segnet4d.md), [Mask4D](mask4d.md), [Instantaneous Motion Perception](instantaneous-motion-perception.md) |
| Radar, 4D radar, and event perception | [RadarPillars](radarpillars.md), [K-Radar](k-radar.md), [V2X-Radar](v2x-radar.md), [Ev-3DOD](ev-3dod.md), [AevaScenes](aevascenes.md) |
| Open-world and open-vocabulary perception | [OpenAD](openad.md), [OP3Det](op3det.md), [WildDet3D](wilddet3d.md), [DetAny3D](detany3d.md), [OW-OVD](ow-ovd.md), [Clipomaly](clipomaly.md), [S2M](s2m.md), [SAM 3](sam3.md), [3D-AVS](3d-avs.md), [Mosaic3D](mosaic3d.md), [OpenVox](openvox.md) |
| Robust fusion and perception validation | [MoME](mome.md), [GraphBEV](graphbev.md), [SOAC](soac.md), [RC-AutoCalib](rc-autocalib.md), [ASF](availability-aware-sensor-fusion.md), [MSC-Bench](msc-bench.md), [MultiCorrupt](multicorrupt.md), [S2R-Bench](s2r-bench.md), [Occluded nuScenes](occluded-nuscenes.md), [Conformal Boxes](conformal-boxes.md) |
| Cooperative, online, and data-engine methods | [RCooper](rcooper.md), [HoloVIC](holovic.md), [CoInfra](coinfra.md), [V2X-ReaLO](v2x-realo.md), [CoHFF](cohff.md), [CoSDH](cosdh.md), [CoopTrack](cooptrack.md), [LASP](lasp.md), [Fail2Drive](fail2drive.md), [AIDE](aide.md) |

## File Boundary Rules

| Rule | Practical meaning |
|---|---|
| One file, one method | A page should not bundle multiple unrelated methods just because they share a modality. If two papers solve the same exact technique lineage, the page can compare versions, but the title must still name the primary method. |
| Overview pages link out | Existing files such as [BEV Encoding Architectures](../bev-encoding.md), [Streaming Temporal Perception](../streaming-temporal-perception.md), and [Infrastructure Cooperative Perception](../infrastructure-cooperative-perception.md) should summarize families and point here for method-level details. |
| Benchmarks count as methods when they shape evaluation | Pages such as MSC-Bench, S2R-Bench, LASP, OpenAD, and Fail2Drive deserve first-class treatment because they define what a deployment team measures. |
| Airside fit is mandatory | Every page should explicitly say what transfers to airport apron autonomy, what does not, and what evidence would be required before using it in a safety case. |
| Sources stay close to claims | Each method page must include primary paper, project, dataset, or repository links so future refreshes can verify claims quickly. |

## Standard Page Shape

Each method page should include:

1. What the method is.
2. Core technical idea.
3. Inputs, outputs, and model/data assumptions.
4. Architecture or pipeline.
5. Training/evaluation setup and benchmark signals.
6. Strengths.
7. Failure modes and deployment risks.
8. Airside autonomous-vehicle fit.
9. Implementation notes.
10. Sources.

## Relationship to the Perception Stack

| Existing synthesis page | Method-library role |
|---|---|
| [BEV Encoding Architectures](../bev-encoding.md) | Explains the BEV design space, then links to BEVDet/BEVDepth/BEVStereo/SOLOFusion and camera occupancy methods. |
| [Camera-Only Degraded Perception](../camera-fallback-perception.md) | Uses camera BEV, occupancy, depth, and open-vocabulary method pages to define fallback modes. |
| [LiDAR Semantic Segmentation](../lidar-semantic-segmentation.md) | Summarizes segmentation architecture choices, then links to LiDAR-MOS, 4DMOS, SegNet4D, Mask4D, and HeLiMOS-style evaluation. |
| [Streaming Temporal Perception](../streaming-temporal-perception.md) | Connects StreamMOS, 4DSegStreamer, LASP, sparse-query detection, and temporal occupancy into a runtime stack. |
| [Open-Vocabulary and Zero-Shot Detection](../open-vocab-detection.md) | Stays as the broad open-vocabulary primer; OpenAD, OP3Det, WildDet3D, DetAny3D, OW-OVD, Clipomaly, S2M, and SAM 3 get individual pages here. |
| [Infrastructure Cooperative Perception](../infrastructure-cooperative-perception.md) | Synthesizes V2X deployment tradeoffs; RCooper, HoloVIC, CoInfra, V2X-ReaLO, CoHFF, CoSDH, and CoopTrack live here as atomic references. |
| [Production Perception Systems](../production-perception-systems.md) | Uses this library as the evidence base for validation matrices, degradation policies, and sensor-suite decisions. |

## Expansion Backlog

The first wave focuses on methods already identified as P0/P1 in the [Perception Coverage Audit](../coverage-audit-2026.md). Future waves should split remaining grouped rows into atomic pages, especially:

- PanoOcc, LangOcc, VEON, and OpenOcc.
- Cam4DOcc, StreamingFlow, UnO, DFIT-OccWorld, and Drive-OccWorld.
- Sparse4D, SparseBEV, DETR4D, DySS, and ForeSight.
- TacoDepth, RaCFormer, CVFusion, RobuRCDet, 4DRC-OCC, and SAMFusion.
- SparseCoop, CoDS, JigsawComm, QuantV2X, TruckV2X, V2XScenes, and UrbanIng-V2X.
- OVAD/OVODA, DriveBench, Airport-FOD3S, RDD5000, DualFOD/FOD-UAS, DSERT-RoLL, RainSense, REHEARSE-3D, and CMHT.

## Sources

- Perception coverage audit and backlog: [coverage-audit-2026.md](../coverage-audit-2026.md)
- Existing perception synthesis index: [Research Index - Perception](../../../INDEX.md#perception)
