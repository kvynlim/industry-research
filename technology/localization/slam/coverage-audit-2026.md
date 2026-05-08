# SLAM Coverage Audit and Backlog

This audit exists to prevent method-library blind spots like the missing dedicated GLIM page. It consolidates parallel web-search agent findings across LiDAR SLAM, LiDAR-inertial odometry, visual SLAM, dense/RGB-D SLAM, LiDAR-visual-inertial SLAM, radar SLAM, registration, loop closure, and optimization backends.

The current SLAM library is useful, but it is not complete. Treat the P0 backlog below as required coverage before calling the method-level SLAM section comprehensive.

## Current Status

| Item | Status |
|---|---|
| Dedicated GLIM page | Added as [GLIM](glim.md). |
| GTSAM coverage | Present in [Factor Graph SLAM with iSAM2 and GTSAM](factor-graph-isam2-gtsam.md) and [GTSAM Factor Graph Optimization](../../../foundations/gtsam-factor-graphs.md). |
| Most severe structural gap | LiDAR-visual-inertial, radar, robust registration, loop-closure backend, and dataset coverage are underrepresented as first-class files. |
| How to use this audit | Add P0 files first, then P1, then P2 or mention-only aliases. Update this audit whenever a missing method is promoted into the library. |

## Second Latest-Method Sweep (2026-05-08)

This second sweep used parallel web-search agents plus direct spot checks for 2025-2026 SLAM methods. It focused on methods likely to be missed by older SLAM surveys: degeneracy-robust LIO, LiDAR-visual-inertial odometry, wheel/GNSS factors, 4D radar localization, Gaussian/foundation-model visual SLAM, and current benchmarks.

Interpretation:

- **P0 latest** means create a dedicated file before describing the SLAM library as current.
- **P1 latest** means create a dedicated file after P0s, or cross-link clearly from the closest existing method page.
- **Watch** means the technique is promising but venue status, code release, official source availability, or independent benchmark maturity is not strong enough yet.
- Venue claims are treated cautiously when only an arXiv comment, project page, or third-party index was found.

### P0 Latest Additions and Upgrades

| Suggested file | Method or technique | Category | Why it matters | Primary sources |
|---|---|---|---|---|
| `okvis2-x.md` | OKVIS2-X | Multi-modal VI/LiDAR/GNSS SLAM | Modern open keyframe VI SLAM configurable with dense depth, LiDAR, GNSS, volumetric submaps, and map-alignment factors; good companion to OKVIS/ROVIO/BASALT and VILENS. | https://arxiv.org/abs/2510.04612, https://github.com/ethz-mrl/OKVIS2-X |
| `mm-lins.md` | MM-LINS | Degeneracy-robust LIO | Multi-map LiDAR-inertial system for over-degenerate environments such as warehouses, crowds, smoke, temporary LiDAR blindness, and long corridors. | https://arxiv.org/abs/2503.19506 |
| `pg-lio.md` | PG-LIO | Intensity/photometric-geometric LIO | Uses LiDAR intensity to stabilize self-similar tunnels and corridors; directly relevant to GPS-denied indoor/outdoor transitions and long feature-poor routes. | https://arxiv.org/abs/2506.18583 |
| `lir-livo.md` | LIR-LIVO | LiDAR-visual-inertial odometry | Lightweight LIVO using illumination-resilient learned features, LiDAR depth association, SuperPoint, and LightGlue; upgrades FAST-LIVO-style coverage for poor lighting. | https://arxiv.org/abs/2502.08676 |
| `semantic-liw-odometry.md` | Semantic LiDAR-Inertial-Wheel odometry | Vehicle/industrial multi-sensor odometry | Strong deployment signal from automated-port operation; important for low-speed industrial vehicles where wheel odometry, semantics, and LiDAR need to coexist. | https://arxiv.org/abs/2509.14999 |
| `gv-iriom-4d-radar.md` | GV-iRIOM | GNSS/visual/4D-radar inertial odometry and mapping | Large-scale 4D radar SLAM extension combining radar inertial odometry, visual-inertial odometry, GNSS, loop closure, and map fusion for adverse weather. | https://www.sciencedirect.com/science/article/pii/S0924271625000449 |
| `cfear-teach-repeat.md` | CFEAR-Teach-and-Repeat | Radar-only teach-and-repeat localization | March 2026 radar-only localization pipeline with Boreas evaluation, reported 29 Hz operation, and strong adverse-weather relevance. | https://arxiv.org/abs/2603.06501 |
| `radarsplat-rio.md` | RadarSplat-RIO | Radar bundle adjustment / Gaussian radar map | April 2026 radar-inertial method that frames radar SLAM drift reduction as local bundle adjustment over range-azimuth-Doppler data with Gaussian splatting. | https://arxiv.org/abs/2604.13492 |
| `vggt-slam-plus-plus.md` | VGGT-SLAM++ | Foundation-model visual SLAM | April 2026 VGGT-based SLAM with DEM graph construction, DINOv2 retrieval, and local optimization; belongs beside SLAM3R/VGGT/AIM-SLAM coverage. | https://arxiv.org/abs/2604.06830 |
| `vista-slam.md` | ViSTA-SLAM | Foundation/pointmap monocular SLAM | Calibration-free monocular SLAM using lightweight pointmap/pose prediction and Sim(3) loop closure; relevant to the foundation-geometry SLAM lineage. | https://ganlinzhang.xyz/vista-slam/, https://github.com/zhangganlin/vista-slam, https://arxiv.org/abs/2509.01584 |
| `s3po-gs.md` | S3PO-GS | Outdoor monocular Gaussian SLAM | ICCV 2025 outdoor RGB-only Gaussian SLAM with global scale-consistent 3D Gaussian pointmaps; fills the outdoor 3DGS gap beyond indoor MonoGS/SplaTAM. | https://arxiv.org/abs/2507.03737, https://openaccess.thecvf.com/content/ICCV2025/html/Cheng_Outdoor_Monocular_SLAM_with_Global_Scale-Consistent_3D_Gaussian_Pointmaps_ICCV_2025_paper.html |
| `vigs-slam.md` | VIGS-SLAM | Visual-inertial Gaussian SLAM | Tightly couples visual, inertial, depth/pose optimization, and Gaussian mapping for blur, low texture, and exposure variation; promote out of the watchlist. | https://arxiv.org/abs/2512.02293, https://vigs-slam.github.io/ |
| `gaussianflow-slam.md` | GaussianFlow SLAM | Monocular Gaussian SLAM | April 2026 monocular 3DGS SLAM using optical-flow-guided GaussianFlow constraints to regularize pose and structure. | https://arxiv.org/abs/2604.15612 |
| `hi-slam2.md` | HI-SLAM2 | Geometry-aware monocular Gaussian SLAM | T-RO 2025 RGB-only Gaussian SLAM with monocular priors, scale alignment, loop closure, and instant map updates. | https://hi-slam2.github.io/, https://doi.org/10.1109/TRO.2025.3626627 |
| `segs-slam.md` | SEGS-SLAM | Structure-enhanced Gaussian SLAM | ICCV 2025 3DGS SLAM across monocular, stereo, and RGB-D inputs; useful for organizing the fast-moving Gaussian SLAM family. | https://segs-slam.github.io/ |
| `scalemaster-benchmark.md` | ScaleMaster | Learned monocular SLAM benchmark | February 2026 benchmark for scale consistency and map-to-map quality in deep monocular SLAM, especially large indoor and multi-floor sequences. | https://arxiv.org/abs/2602.18174 |
| `snail-radar-benchmark.md` | SNAIL Radar | 4D radar SLAM benchmark | IJRR 2025 radar benchmark with 4D radar, stereo, LiDAR, IMU, GNSS/INS, rain/night/tunnel coverage, and updated 2025 poses/extrinsics. | https://snail-radar.github.io/, https://arxiv.org/abs/2407.11705 |
| `hercules-radar-benchmark.md` | HeRCULES | Heterogeneous radar benchmark | ICRA 2025 benchmark combining 4D radar, spinning radar, FMCW LiDAR, IMU, GPS, and cameras for radar SLAM, place recognition, and fusion. | https://sites.google.com/view/herculesdataset, https://arxiv.org/abs/2502.01946 |
| `geode-degenerate-lidar-benchmark.md` | GEODE | Degenerate LiDAR benchmark | Large multi-LiDAR benchmark with many geometrically degenerate settings; directly supports the degeneracy-robust LIO backlog. | https://thisparticle.github.io/geode/, https://arxiv.org/abs/2409.04961 |

### P1 Latest Additions

| Suggested file | Method or technique | Category | Why it matters | Primary sources |
|---|---|---|---|---|
| `genz-icp.md` | GenZ-ICP | Degeneracy-robust LiDAR odometry / ICP | Already mentioned in broader LiDAR docs, but now deserves a focused file because degeneracy-robust registration is a 2025-2026 hotspot. | https://github.com/cocel-postech/genz-icp |
| `bev-lio-lc.md` | BEV-LIO-LC | LIO plus learned BEV loop closure | Bridges FAST-LIO-style odometry with BEV image place recognition for long warehouse, campus, and outdoor loops. | https://github.com/HxCa1/BEV-LIO-LC |
| `omni-livo.md` | Omni-LIVO | Multi-camera LiDAR-visual-inertial odometry | Extends LIVO toward surround/multi-camera FoV coverage, a better fit for AV-style sensor suites than monocular LIVO. | https://arxiv.org/abs/2509.15673 |
| `online-neural-liw-factor.md` | Online neural LiDAR-IMU-wheel factor graph | Wheel/vehicle state estimation | Learns skid-steer or terrain-dependent wheel kinematics inside the estimator rather than treating wheel odometry as fixed noise. | https://arxiv.org/abs/2407.08907 |
| `cm-liuw-odometry.md` | CM-LIUW-Odometry | LiDAR-IMU-UWB-wheel odometry | Underground/tunnel-focused fusion with nonholonomic constraints, lever-arm compensation, and adaptive mode switching. | https://arxiv.org/abs/2511.01379 |
| `4dral-radar-lidar-place-recognition.md` | 4DRaL | 4D radar / LiDAR place recognition | LiDAR-teacher distillation for radar-to-radar and radar-to-LiDAR retrieval; important for all-weather map lookup and loop closure. | https://arxiv.org/abs/2603.26206 |
| `sherloc-radar-place-recognition.md` | SHeRLoc | Heterogeneous radar place recognition | Cross-modal place recognition across spinning radar, 4D radar, and FMCW LiDAR for mixed-sensor fleets. | https://arxiv.org/abs/2506.15175 |
| `cao-ronet.md` | CAO-RONet | Learning-based 4D radar odometry | 2025 ICRA line for low-quality 4D radar point completion and context-aware association, useful for AV radar odometry comparison. | https://arxiv.org/abs/2503.01438, https://github.com/NEU-REAL/CAO-RONet |
| `radar-correspondence-rio.md` | Radar point correspondence learning for RIO | Radar-inertial frontend | Transformer-based radar point correspondences that can plug into radar-inertial odometry pipelines. | https://arxiv.org/abs/2506.18580, https://github.com/aau-cns/radar_transformer |
| `point-uncertainty-radar-slam.md` | Point uncertainty in radar SLAM | Radar backend modeling | Explicit radar point uncertainty improves association and backend estimation; useful ingredient across radar SLAM pages. | https://arxiv.org/abs/2402.16082, https://github.com/HKUST-Aerial-Robotics/RIO |
| `radar-inertial-online-calibration.md` | Online radar-IMU spatial and temporal calibration | Radar-inertial deployment hardening | March 2026 continuous-time calibration for radar-inertial odometry, important for productizing radar fusion. | https://arxiv.org/abs/2603.19958 |
| `gs-livm.md` | GS-LIVM | LiDAR-inertial-visual Gaussian mapping | ICCV 2025 real-time outdoor Gaussian mapping using LIVO poses, voxel GPR, and CUDA; compare with Gaussian-LIC and FAST-LIVO2. | https://openaccess.thecvf.com/content/ICCV2025/html/Xie_GS-LIVM_Real-Time_Photo-Realistic_LiDAR-Inertial-Visual_Mapping_with_Gaussian_Splatting_ICCV_2025_paper.html, https://github.com/xieyuser/GS-LIVM |
| `4dtam.md` | 4DTAM | Dynamic/non-rigid 4D Gaussian SLAM | CVPR 2025 dynamic-surface-Gaussian tracking and mapping; lower AV-localization priority but important for dynamic Gaussian maps. | https://github.com/muskie82/4dtam |
| `ace-slam.md` | ACE-SLAM | Neural implicit RGB-D SLAM | Scene-coordinate regression as live implicit map, compact relocalization angle; promote after code maturity is checked. | https://arxiv.org/abs/2512.14032, https://ialzugaray.github.io/ace-slam/ |
| `dropd-slam.md` | DropD-SLAM | Monocular dense/RGB-D replacement | Uses pretrained metric depth, learned keypoints, and segmentation to drive an RGB-D-style backend from monocular video. | https://arxiv.org/abs/2510.06216 |
| `levio.md` | LEVIO | Embedded visual-inertial odometry | Ultra-low-power VIO for RISC-V/embedded devices; useful if the corpus covers small robots or auxiliary wearable/camera nodes. | https://arxiv.org/abs/2602.03294 |
| `iilabs-3d-benchmark.md` | IILABS 3D | Indoor LiDAR SLAM benchmark | Indoor wheeled-robot benchmark with heterogeneous 3D LiDARs, IMU, wheel odometry, and MoCap ground truth. | https://jorgedfr.github.io/3d_lidar_slam_benchmark_at_iilab/ |
| `smapper-benchmark.md` | SMapper / SMapper-light | Open-hardware SLAM benchmark platform | Reproducible acquisition platform with public indoor/outdoor sequences and sub-cm offline SLAM ground truth. | https://snt-arg.github.io/smapper_docs/, https://arxiv.org/abs/2509.09509 |
| `agrilira4d-benchmark.md` | AgriLiRa4D | UAV LiDAR/radar benchmark | Agricultural UAV benchmark with 3D LiDAR, 4D radar, IMU, and RTK; useful for vegetation, repetitive texture, and outdoor robustness. | https://zhan994.github.io/AgriLiRa4D/, https://arxiv.org/abs/2512.01753 |
| `diter-plus-plus-benchmark.md` | DiTer++ | Multi-robot/multi-session benchmark | Legged-robot, thermal, RGB/RGB-D, LiDAR, IMU, and proprioception coverage for outdoor multi-session SLAM. | https://arxiv.org/abs/2412.05839 |

### Latest Watchlist

| Method or technique | Why watch | Current concern | Sources |
|---|---|---|---|
| LTR^2 / LiDAR Teach, Radar Repeat | Very relevant cross-modal LiDAR-teach and 4D-radar-repeat navigation, with long-term deployment claims across smoke/night/changed environments. | Official arXiv page did not surface in direct search yet; keep watch until primary arXiv/proceedings link is stable. | https://papers.cool/arxiv/2605.02809 |
| CUBE-LIO | Intensity-assisted cubemap projection for degenerate LIO. | Venue listing found, but paper/repo not found in this sweep. | https://ras.papercept.net/conferences/conferences/ICRA26/program/ICRA26_ContentListWeb_4.html |
| RMGS-SLAM | Real-time LIV Gaussian SLAM with loop closure on a global Gaussian map. | Preprint-only in this sweep. | https://arxiv.org/abs/2604.12942 |
| R-VoxelMap | 2026 VoxelMap successor candidate. | Code/release maturity unclear. | https://arxiv.org/abs/2601.12377 |
| LIO-MARS | Non-uniform continuous-time B-spline LIO. | Submitted status; wait for venue/code. | https://arxiv.org/abs/2511.13985 |
| AKF-LIO | Adaptive covariance and Gaussian map for degraded/dynamic scenes. | Code appears not released yet. | https://arxiv.org/abs/2503.06891 |
| Super4DR, DNOI-4DRO, Equi-RO | Fast-moving 4D radar odometry and Gaussian/radar learning line. | Good technical signal, but code and repeated external evaluation are not yet mature. | https://arxiv.org/abs/2512.09608, https://arxiv.org/abs/2505.12310, https://arxiv.org/abs/2509.20674 |
| SCE-SLAM and GSO-SLAM | Scene-coordinate and Gaussian/direct-VO visual SLAM variants worth tracking. | Strong preprint signal, but not yet core AV 3D SLAM coverage without code/benchmark maturity checks. | https://arxiv.org/abs/2601.09665, https://arxiv.org/abs/2602.11714 |
| D-GVIO and CT-VIR | Decentralized GNSS-VIO and visual-inertial-ranging fusion. | Interesting for multi-agent or UWB work, but not yet core AV 3D SLAM coverage. | https://arxiv.org/abs/2603.01404, https://arxiv.org/abs/2604.14545 |

## P0 Dedicated Files

| Suggested file | Method or technique | Category | Why it matters | Primary sources |
|---|---|---|---|---|
| `lvi-sam.md` | LVI-SAM | LiDAR-visual-inertial factor-graph SLAM | Canonical bridge from LIO-SAM and VINS-Mono into LVIO; relevant for GNSS-denied terminal edges, covered roads, hangars, and weak LiDAR/vision handoff. | https://arxiv.org/abs/2104.10831, https://github.com/TixiaoShan/LVI-SAM |
| `fast-livo-fast-livo2.md` | FAST-LIVO and FAST-LIVO2 | Direct LiDAR-inertial-visual odometry | Natural companion to [FAST-LIO2](fast-lio-fast-lio2.md); high-value open-source LIV baseline for spinning and solid-state LiDAR with camera/IMU fusion. | https://arxiv.org/abs/2203.00893, https://arxiv.org/abs/2408.14035, https://github.com/hku-mars/FAST-LIVO, https://github.com/hku-mars/FAST-LIVO2 |
| `r2live-r3live.md` | R2LIVE and R3LIVE | LiDAR-inertial-visual fusion and RGB map reconstruction | Real-time tightly coupled LIV line from HKU-MARS; useful for colorized survey maps, digital twins, and robustness when either LiDAR geometry or visual texture is weak. | https://arxiv.org/abs/2102.12400, https://arxiv.org/abs/2109.07982, https://github.com/hku-mars/r2live, https://github.com/hku-mars/r3live |
| `ground-fusion-m2dgr-m3dgr.md` | M2DGR, Ground-Fusion, Ground-Fusion++ / M3DGR | Ground-robot multi-sensor SLAM and benchmark lineage | Strong fit for airport GSE: RGB-D/camera, IMU, wheel, GNSS, LiDAR, indoor/outdoor transitions, wheel slip, GNSS denial, and LiDAR degeneracy. | https://arxiv.org/abs/2112.13659, https://github.com/SJTU-ViSYS/M2DGR, https://arxiv.org/abs/2402.14308, https://arxiv.org/abs/2507.08364 |
| `gvins-glio-gnss-raw-factor-fusion.md` | GVINS and GLIO | GNSS-visual-inertial and GNSS-LiDAR-IMU factor graphs | Core AV localization gap: raw GNSS pseudorange/Doppler factors, urban-canyon handling, GNSS reacquisition, and drift-free global pose. | https://arxiv.org/abs/2103.07899, https://github.com/HKUST-Aerial-Robotics/GVINS, https://github.com/XikunLiu-huskit/GLIO |
| `wheel-odometry-vehicle-motion-factors.md` | Wheel odometry, nonholonomic constraints, vehicle motion factors | Vehicle localization factors | Needed for low-speed airport vehicles, tug/dolly slip detection, 4WS/skid-steer constraints, and dead reckoning during GNSS/LiDAR degradation. | https://mars.cs.umn.edu/papers/KejianWu_VINSonWheels.pdf, https://woosiklee.com/downloads/papers/Lee2020IROS.pdf, https://arxiv.org/abs/2404.02515 |
| `4d-imaging-radar-rio-slam.md` | iRIOM, Go-RIO, x-RIO, multi-radar IO | 4D imaging radar-inertial SLAM | Direct all-weather localization relevance; Doppler/elevation improve observability over 2D spinning radar and sparse automotive radar. | https://arxiv.org/abs/2303.13962, https://github.com/wooseongY/Go-RIO, https://christopherdoer.github.io/publications/2022_02_JGN2022, https://www.cs.cmu.edu/~kaess/pub/Huang24icra.pdf |
| `robust-global-registration.md` | TEASER++, Fast Global Registration, Super4PCS/4PCS, Go-ICP | Coarse/global point-cloud registration | Required for cold start, loop verification, map merging, and kidnapped-robot recovery when ICP/NDT initialization is weak. | https://github.com/MIT-SPARK/TEASER-plusplus, https://arxiv.org/abs/2001.07715, https://github.com/isl-org/FastGlobalRegistration, https://nmellado.github.io/Super4PCS/, https://jlyang.org/go-icp/ |
| `scan-context-family.md` | Scan Context, Scan Context++, ISC, FreSCo-style variants | LiDAR place recognition | Deterministic LiDAR loop/relocalization baseline; easier to validate for airside/warehouse use than learned descriptors. | https://github.com/SignalImageCV/scancontext, https://gisbi-kim.github.io/publications/gkim-2018-iros.pdf, https://arxiv.org/abs/2109.13494 |
| `robust-loop-closure-backends.md` | Switchable constraints, DCS, max-mixtures, robust kernels, loop quarantine | Robust graph backend | False loop closure is one of the highest-severity SLAM failures; this should explain backend insertion, rejection, rollback, and robust factors. | https://doi.org/10.1109/IROS.2012.6385590, https://www.tu-chemnitz.de/etit/proaut/ICRAWorkshopFactorGraphs/ICRA_Workshop_on_Robust_and_Multimodal_Inference_in_Factor_Graphs/Program_files/4%20-%20DCS.pdf, https://gtsam.org/docs/ |
| `lidar-bundle-adjustment-factors.md` | BALM, BALM 2.0, BA-CLM, LiDAR BA cost factors, `gtsam_points` factors | LiDAR mapping backend | Visual BA is already covered, but LiDAR BA optimizes poses against geometric edge/plane/voxel structure and matters for HD-map quality. | https://arxiv.org/abs/2010.08215, https://github.com/hku-mars/BALM, https://pmc.ncbi.nlm.nih.gov/articles/PMC11398242/, https://github.com/koide3/gtsam_points |
| `bad-slam.md` | BAD SLAM | RGB-D dense SLAM | Strong missing dense RGB-D baseline: direct bundle adjustment over dense RGB-D maps with calibration/sync sensitivity and ETH3D relevance. | https://openaccess.thecvf.com/content_CVPR_2019/html/Schops_BAD_SLAM_Bundle_Adjusted_Direct_RGB-D_SLAM_CVPR_2019_paper.html, https://github.com/ETH3D/badslam |
| `okvis-rovio-basalt.md` | OKVIS, ROVIO, BASALT, VI-DSO line | Classical VIO | Fills the gap between OpenVINS, VINS, Kimera, and ORB-SLAM3; key estimator tradeoffs across EKF, direct filtering, and nonlinear optimization. | https://github.com/ethz-asl/okvis, https://www.research-collection.ethz.ch/handle/20.500.11850/236658, https://www.research-collection.ethz.ch/handle/20.500.11850/187364, https://cvg.cit.tum.de/research/vslam/basalt, https://arxiv.org/abs/1904.06504 |
| `colmap-sfm-mvs.md` | COLMAP / SfM + MVS | Offline visual mapping backend | Not online SLAM, but industry-standard for offline camera poses, 3D reconstruction, 3DGS initialization, dataset building, and map QA. | https://colmap.org/, https://www.cv-foundation.org/openaccess/content_cvpr_2016/app/S18-10.pdf |
| `slam3r-vggt-foundation-slam.md` | SLAM3R, VGGT, CUT3R, AIM-SLAM, InfiniteVGGT | Foundation-model dense SLAM/reconstruction | MASt3R-SLAM is covered, but feed-forward pointmap/geometry-transformer SLAM is now a distinct 2024-2026 lineage. | https://arxiv.org/abs/2412.09401, https://github.com/PKU-VCL-3DV/SLAM3R, https://arxiv.org/abs/2503.11651, https://cut3r.github.io/, https://arxiv.org/abs/2603.05097, https://arxiv.org/abs/2601.02281 |
| `kiss-slam.md` | KISS-SLAM | Full LiDAR-only SLAM | [KISS-ICP](kiss-icp.md) covers odometry; KISS-SLAM adds loop closure and full 3D LiDAR SLAM with a simple baseline philosophy. | https://arxiv.org/abs/2503.12660, https://github.com/PRBonn/kiss-slam |

## P1 Dedicated Files

| Suggested file | Method or technique | Category | Why it matters | Primary sources |
|---|---|---|---|---|
| `faster-lio-ivox.md` | Faster-LIO and iVox | Fast tightly coupled LIO | Complements FAST-LIO2 with parallel sparse incremental voxels for throughput and resource-constrained robots. | https://github.com/gaoxiang12/faster-lio, https://raw.githubusercontent.com/gaoxiang12/faster-lio/main/doc/faster-lio.pdf |
| `direct-lidar-odometry-dlio-dliom.md` | DLO, DLIO, DLIOM | Direct dense LiDAR odometry/LIO/SLAM | NASA/JPL field-robotics lineage with minimally preprocessed dense clouds, continuous-time correction, and degraded-environment robustness. | https://arxiv.org/abs/2110.00605, https://github.com/vectr-ucla/direct_lidar_odometry, https://arxiv.org/abs/2203.03749, https://github.com/vectr-ucla/direct_lidar_inertial_odometry, https://arxiv.org/abs/2305.01843 |
| `voxelmap-lio.md` | VoxelMap, VoxelMap++, CT-VoxelMap | Probabilistic/adaptive voxel map representation | Important for scan-to-map registration, memory, solid-state LiDAR support, and modern LIO/LVIO map management. | https://arxiv.org/abs/2109.07082, https://github.com/hku-mars/VoxelMap, https://arxiv.org/abs/2308.02799, https://arxiv.org/abs/2604.03747 |
| `slict-clins-continuous-time-lio.md` | SLICT and CLINS | Continuous-time LiDAR-inertial odometry/mapping | Important for aggressive motion, scan distortion, asynchronous sensors, multi-LiDAR input, and high-quality mapping on rough terrain. | https://arxiv.org/abs/2211.03900, https://arxiv.org/abs/2109.04687, https://github.com/APRIL-ZJU |
| `locus-lamp-nebula.md` | LOCUS, LOCUS 2.0, LAMP | Field LiDAR odometry and multi-robot SLAM | Relevant for tunnels, mines, SubT-style operation, uncertainty-aware fusion, health-aware mapping, and multi-robot pose graphs. | https://arxiv.org/abs/2012.14447, https://robotics.jpl.nasa.gov/media/documents/2205.11784.pdf, https://arxiv.org/abs/2003.01744, https://software.nasa.gov/software/NPO-51451-1 |
| `mola.md` | MOLA / MOLA-LO/LIO | Modular ROS 2 LiDAR odometry, mapping, localization | Production localization relevance: ROS 2-ready, modular ICP/SLAM pipelines, map manipulation, and localization-only modes. | https://github.com/MOLAorg/mola, https://arxiv.org/abs/2407.20465, https://docs.mola-slam.org/latest/mola_lidar_odometry.html, https://docs.mola-slam.org/latest/localization.html |
| `mulls.md` | MULLS | LiDAR-only SLAM / multi-metric ICP | Useful for AV and survey mapping because it targets indoor/outdoor complex scenes and multiple LiDAR specifications. | https://arxiv.org/abs/2102.03771, https://yujie-he.github.io/publication/2021_mulls_icra/, https://github.com/YuePanEdward/MULLS |
| `rko-lio.md` | RKO-LIO | Robust LiDAR-inertial odometry | PRBonn 2025/RA-L 2026 line aimed at sensor-agnostic LIO and single-configuration multi-platform use. | https://arxiv.org/abs/2509.06593, https://github.com/PRBonn/rko_lio, https://docs.ros.org/en/jazzy/p/rko_lio/pages/quickstart.html |
| `lic-fusion-lvio-fusion.md` | LIC-Fusion, LIC-Fusion 2.0, LVIO-Fusion | LiDAR-inertial-camera odometry | Earlier tightly coupled LIC/LVIO line with online calibration and plane tracking; complements HKU-MARS direct methods. | https://arxiv.org/abs/1909.04102, https://arxiv.org/abs/2008.07196, https://researchportal.hkust.edu.hk/en/publications/lvio-fusiontightly-coupled-lidar-visual-inertial-odometry-and-map/ |
| `vilens-and-multimodal-landmark-tracking.md` | VILENS and unified multi-modal landmark tracking | Multi-modal factor graph odometry | Legged-focused but useful for weak/degenerate modality fusion in degraded apron, tunnel, hangar, and underground-like transitions. | https://arxiv.org/abs/2107.07243, https://robots.ox.ac.uk/~mfallon/publications/2022TRO_wisth.pdf, https://arxiv.org/abs/2011.06838 |
| `cfear-radarodometry.md` | CFEAR Radarodometry | Radar odometry | Strong learning-free spinning-radar baseline for adverse weather and indoor/outdoor generalization. | https://arxiv.org/abs/2105.01457, https://arxiv.org/abs/2211.02445, https://github.com/dan11003/CFEAR_Radarodometry |
| `under-the-radar-hero-radar-odometry.md` | Under the Radar and HERO | Learned radar keypoints / radar odometry | Important learned radar baselines on Oxford/Boreas; HERO combines learned radar features with classical probabilistic estimation. | https://arxiv.org/abs/2001.10789, https://arxiv.org/abs/2105.14152, https://github.com/utiasASRL/hero_radar_odometry |
| `steam-icp-continuous-time-radar-lidar-odometry.md` | STEAM-ICP, STEAM-RO/RIO/LIO | Continuous-time radar/LiDAR/inertial odometry | Important for spinning radar motion distortion, asynchronous sensors, and smooth trajectory factors. | https://github.com/utiasASRL/steam_icp, https://www.roboticsproceedings.org/rss17/p029.pdf |
| `doppler-radar-lidar-slam.md` | Doppler-SLAM, Radarize, DRO | Doppler radar and radar-LiDAR SLAM | Missing bridge between radar-only, radar-inertial, and radar-LiDAR fusion pages. | https://arxiv.org/abs/2504.11634, https://github.com/Wayne-DWA/Doppler-SLAM, https://arxiv.org/abs/2311.11260, https://radarize.github.io/, https://arxiv.org/abs/2504.20339 |
| `radar-to-lidar-map-localization.md` | Radar-on-LiDAR, RaLL, UnLoc, RLPR | Cross-modal all-weather localization | AV relevance: localize radar/camera/LiDAR observations against existing LiDAR maps when LiDAR/camera degrade. | https://arxiv.org/abs/2005.04644, https://arxiv.org/abs/2009.07061, https://arxiv.org/abs/2307.00741, https://arxiv.org/abs/2603.07920 |
| `learned-lidar-place-recognition.md` | PointNetVLAD, MinkLoc3D, LoGG3D-Net, LCDNet, OverlapNet, BEVPlace | Learned loop/place recognition | Existing survey is rich but broad; this page should focus on training data, domain shift, descriptor indexing, and retrieval-vs-pose estimation. | https://github.com/mikacuy/pointnetvlad, https://github.com/jac99/MinkLoc3D, https://github.com/csiro-robotics/LoGG3D-Net, https://lcdnet.cs.uni-freiburg.de/, https://github.com/PRBonn/OverlapNet, https://arxiv.org/abs/2302.14325 |
| `ndt-variants-and-ndt-maps.md` | NDT-D2D, NDT-OM, NDT-MCL, multi-resolution NDT maps | Registration/map representation | [NDT](ndt.md) covers the core method, but NDT is also a map representation and dynamic mapping family. | https://ieeexplore.ieee.org/document/1249285/, https://journals.sagepub.com/doi/10.1177/0278364913499415 |
| `continuous-time-factor-graphs-steam.md` | STEAM, GP motion priors, exactly sparse continuous-time trajectories | Continuous-time backend | Explains GP priors, asynchronous sensors, rolling-shutter LiDAR/cameras, and continuous-time smoothing beyond registration. | https://github.com/utiasASRL/steam, https://arxiv.org/abs/1412.0630, https://journals.sagepub.com/doi/10.1177/0278364915585860 |
| `surfel-mapping-and-registration.md` | Surfels across ElasticFusion, SuMa, semantic surfels | Map representation/registration | Surfels are spread across method pages; representation-level treatment should cover primitives, render-based association, semantics, and dynamic filtering. | https://journals.sagepub.com/doi/abs/10.1177/0278364916669237, https://github.com/jbehley/SuMa, https://arxiv.org/abs/2105.11320 |
| `incremental-lidar-map-data-structures.md` | ikd-tree, iVox, voxel hashes, incremental voxel maps | Map data structures | Determines whether real-time LIO and scan-to-map can run on embedded hardware. | https://arxiv.org/abs/2102.10808, https://arxiv.org/abs/2107.06829, https://github.com/gaoxiang12/faster-lio |
| `openvslam-ov2slam.md` | OpenVSLAM and OV2SLAM | Open-source visual SLAM frameworks | Practical feature-based frameworks beyond ORB-SLAM: camera-model flexibility, online BoW, API concerns, ROS integration. | https://arxiv.org/abs/1910.01122, https://github.com/lp-research/openvslam, https://arxiv.org/abs/2102.04060, https://github.com/ov2slam/ov2slam |
| `infinitam-voxel-hashing-kintinuous.md` | InfiniTAM, voxel hashing, Kintinuous | RGB-D dense mapping lineage | Core large-scale TSDF engineering patterns for indoor mapping and robotics. | https://www.robots.ox.ac.uk/~victor/infinitam/, https://arxiv.org/abs/1708.00783, https://www.graphics.stanford.edu/~niessner/niessner2013hashing.html |
| `vox-fusion-go-slam.md` | Vox-Fusion, Vox-Fusion++, GO-SLAM | Neural implicit dense RGB-D/monocular SLAM | Complements iMAP/NICE/Co-SLAM/ESLAM with scalable voxelized neural fields and global optimization. | https://arxiv.org/abs/2210.15858, https://github.com/zju3dv/Vox-Fusion, https://arxiv.org/abs/2403.12536, https://arxiv.org/abs/2309.02436, https://github.com/youmi-zym/GO-SLAM |
| `codeslam-deepfactors.md` | CodeSLAM and DeepFactors | Learned compact dense monocular SLAM | Bridge from learned depth priors to iMAP/NeRF-SLAM through compact optimizable depth codes inside SLAM graphs. | https://arxiv.org/abs/1804.00874, https://openaccess.thecvf.com/content_cvpr_2018/papers/Bloesch_CodeSLAM_--_Learning_CVPR_2018_paper.pdf, https://arxiv.org/abs/2001.05049, https://github.com/jczarnowski/DeepFactors |
| `cuvslam-isaac-ros-visual-slam.md` | NVIDIA cuVSLAM / Isaac ROS Visual SLAM | Production visual-inertial SLAM | Practical ROS 2 / Jetson stack for stereo, RGB-D, multi-camera, and IMU robots. | https://nvidia-isaac-ros.github.io/v/release-3.1/concepts/visual_slam/cuvslam/index.html, https://arxiv.org/abs/2506.04359, https://developer.nvidia.com/isaac/ros |
| `gaussian-lic.md` | Gaussian-LIC / Gaussian-LIC2 | LiDAR-inertial-camera Gaussian SLAM | Bridges metric LIV odometry and photorealistic 3DGS maps for AV map QA, simulation, and digital twins. | https://github.com/APRIL-ZJU/Gaussian-LIC, https://arxiv.org/abs/2507.04004 |
| `vings-mono.md` | VINGS-Mono | Visual-inertial Gaussian monocular SLAM | Large-scene monocular/VI 3DGS SLAM with kilometer-scale demos and loop closure via novel-view synthesis. | https://arxiv.org/abs/2501.08286, https://vings-mono.github.io/ |
| `neural-gaussian-slam-surveys.md` | 2024-2026 NeRF/3DGS SLAM surveys | Survey/taxonomy | Fast-moving neural/Gaussian SLAM needs a periodic taxonomy page so individual method pages stay organized. | https://arxiv.org/abs/2402.13255, https://arxiv.org/abs/2602.04251, https://arxiv.org/abs/2510.23988 |

## P2 or Mention-Only Queue

| Method or technique | Recommended handling | Sources |
|---|---|---|
| MonoSLAM and PTAM | P1/P2 if the library needs historical foundations; otherwise alias from [Bundle Adjustment SLAM](bundle-adjustment-slam.md). | https://www.robots.ox.ac.uk/~lav/Papers/davison_etal_pami2007/davison_etal_pami2007.html, https://www.robots.ox.ac.uk/~dwm/Publications/Papers/klein_murray_ismar2007/klein_murray_ismar2007.pdf |
| LOAM implementation lineage: A-LOAM, F-LOAM | P2 short file or add to [LOAM](loam.md); useful for implementation history. | https://github.com/HKUST-Aerial-Robotics/A-LOAM, https://arxiv.org/abs/2107.00822, https://sairlab.org/floam/ |
| LOAM-Livox and LIO-Livox | P2 if solid-state/Livox coverage matters; otherwise mention in LOAM/LIO pages. | https://arxiv.org/abs/1909.06700, https://github.com/hku-mars/loam_livox, https://github.com/Livox-SDK/LIO-Livox |
| M-LOAM / multi-LiDAR SLAM | P2 if multi-LiDAR calibration plus SLAM becomes a major thread. | https://arxiv.org/abs/2010.14294, https://github.com/gogojjh/M-LOAM |
| LINS and LIO-mapping | P2 historical transition from LOAM-style odometry to tightly coupled LiDAR-IMU filtering. | https://arxiv.org/abs/1907.02233, https://arxiv.org/abs/1904.06993, https://github.com/hyye/lio-mapping |
| NeuralRecon, Atlas, SimpleRecon | P2 because these usually consume poses rather than solve SLAM, but they matter for learned dense mapping. | https://arxiv.org/abs/2104.00681, https://arxiv.org/abs/2003.10432, https://github.com/magicleap/Atlas, https://arxiv.org/abs/2208.14743 |
| Localizing ground-penetrating radar and GROUNDED | P2 all-weather fallback concept for repeatable routes, not standard SLAM. | https://tisl.cs.toronto.edu/publication/202005-ral-lgpr/ral20-lgpr.pdf, https://journals.sagepub.com/doi/10.1177/02783649231183460 |
| Optimization solver comparison: Ceres, g2o, GTSAM | P2, because [GTSAM](../../../foundations/gtsam-factor-graphs.md) already exists; add only if readers need solver selection. | https://ceres-solver.org/, https://github.com/RainerKuemmerle/g2o, https://gtsam.org/docs/ |
| Submap graphs and map-centric SLAM | P2 design-pattern page; [Cartographer 3D](cartographer-3d.md) covers one implementation. | https://google-cartographer.readthedocs.io/ |
| CPD, colored ICP, SegMatch, M2DP, ISC, OverlapNet | Mention under registration/place-recognition pages unless the repo expands those sublibraries. | https://arxiv.org/abs/0905.2635, https://www.open3d.org/docs/0.9.0/tutorial/Advanced/colored_pointcloud_registration.html, https://github.com/PRBonn/OverlapNet |
| RMGS-SLAM, PINGS, MegaSaM, VGGT/SwiftVGGT/Reloc-VGGT, QLIO, Dy3DGS-SLAM, Super4DR | Track as 2024-2026 emerging methods; most should live in a survey page until code/adoption stabilizes. VIGS-SLAM and VGGT-SLAM++ were promoted in the 2026-05-08 latest-method sweep. | https://arxiv.org/abs/2604.12942, https://www.roboticsproceedings.org/rss21/p040.pdf, https://mega-sam.github.io/, https://arxiv.org/abs/2503.11651, https://arxiv.org/abs/2512.02293, https://arxiv.org/abs/2604.06830 |

## Benchmark and Dataset Gaps

| Dataset or benchmark | Why it should be added to [SLAM Benchmarking Metrics and Datasets](benchmarking-metrics-datasets.md) | Sources |
|---|---|---|
| LaMAria / city-scale egocentric VI SLAM | Current hard visual-inertial benchmark with low light, moving platforms, long routes, and time-varying calibration. | https://lamaria.ethz.ch/, https://openaccess.thecvf.com/content/ICCV2025/papers/Krishnan_Benchmarking_Egocentric_Visual-Inertial_SLAM_at_City_Scale_ICCV_2025_paper.pdf |
| M3DGR / Ground-Fusion++ | Ground-robot sensor-fusion benchmark for visual degradation, LiDAR degeneracy, wheel slip, and GNSS denial, with broad baseline evaluation. | https://arxiv.org/abs/2507.08364, https://github.com/SJTU-ViSYS/Ground-Fusion |
| SNAIL Radar | 4D radar SLAM/localization benchmark with stereo, LiDAR, IMU, GNSS/INS, and difficult rain/night/tunnel conditions. | https://snail-radar.github.io/, https://arxiv.org/abs/2407.11705 |
| HeRCULES | Heterogeneous radar benchmark combining 4D radar, spinning radar, FMCW LiDAR, IMU, GPS, and cameras for multi-session radar SLAM and place recognition. | https://sites.google.com/view/herculesdataset, https://arxiv.org/abs/2502.01946 |
| GEODE | Large degenerate-scene LiDAR benchmark for stress-testing LIO and multi-LiDAR pipelines in weak geometry. | https://thisparticle.github.io/geode/, https://arxiv.org/abs/2409.04961 |
| ScaleMaster | Learned monocular SLAM benchmark for scale consistency and map quality in large indoor and multi-floor environments. | https://arxiv.org/abs/2602.18174 |
| IILABS 3D | Indoor 3D LiDAR SLAM benchmark with wheeled robot, IMU, wheel odometry, MoCap ground truth, and multiple LiDAR types. | https://jorgedfr.github.io/3d_lidar_slam_benchmark_at_iilab/ |
| HeLiPR | Heterogeneous LiDAR and long-term place recognition, important for sensors and route revisits. | https://sites.google.com/view/heliprdataset, https://journals.sagepub.com/doi/10.1177/02783649241242136 |
| FusionPortableV2 | Generalized multi-platform SLAM evaluation: handheld, legged robot, UGV, vehicle, 27 sequences, 38.7 km. | https://arxiv.org/abs/2404.08563 |
| Oxford Spires | LiDAR, cameras, IMU, TLS reference maps, and large landmark-scale reconstruction for radiance-field/SLAM/localization work. | https://dynamic.robots.ox.ac.uk/datasets/oxford-spires/, https://arxiv.org/abs/2411.10546 |
| Hilti x Trimble 360 Visual-Inertial SLAM Challenge 2026 | Adds 360 visual-inertial data and floor-plan priors beyond Hilti 2023. | https://github.com/Hilti-Research/hilti-trimble-slam-challenge-2026 |
| ETH3D SLAM benchmark | Visual-inertial mono/stereo/RGB-D evaluation; useful for dense visual/neural SLAM sanity checks. | https://eth3d.ethz.ch/slam_benchmark |
| VBR: Vision Benchmark in Rome | Urban outdoor visual odometry/SLAM with RGB, point clouds, IMU, and GPS. | https://arxiv.org/abs/2404.11322 |
| M2DGR, NTU VIRAL, UrbanLoco | Older but important multimodal ground/aerial SLAM benchmarks that should be explicit rows. | https://github.com/SJTU-ViSYS/M2DGR, https://arxiv.org/abs/2112.13659, https://ntu-aris.github.io/ntu_viral_dataset/ |

## Already Covered, But Needs Better Discoverability

| Existing file | Add aliases or cross-links for |
|---|---|
| [FAST-LIO and FAST-LIO2](fast-lio-fast-lio2.md) | Faster-LIO, iVox, VoxelMap, Point-LIO, Livox-specific methods, and a clear note that FAST-LIVO is a different LIV family. |
| [KISS-ICP](kiss-icp.md) | KISS-SLAM as the full SLAM stack rather than odometry. |
| [Continuous-Time Registration](continuous-time-registration.md) and [CT-ICP](ct-icp.md) | SLICT, CLINS, DLIO continuous-time motion correction, CT-VoxelMap, and STEAM/GP priors. |
| [Bundle Adjustment SLAM](bundle-adjustment-slam.md) | BALM/BALM2 as LiDAR-specific BA, plus COLMAP, MonoSLAM, and PTAM aliases. |
| [Loop Closure and Place Recognition](loop-closure-place-recognition.md) | Scan Context, learned LiDAR descriptors, switchable constraints, DCS, loop quarantine. |
| [HDL Graph SLAM](hdl-graph-slam.md) | GLIM and `gtsam_points` as the modern Koide ecosystem continuation. |
| [LOAM](loam.md) and [LeGO-LOAM](lego-loam.md) | A-LOAM, F-LOAM, LOAM-Livox, MULLS, BALM, LINS, and LIO-mapping. |
| [Radar Odometry and Radar SLAM](radar-odometry-radar-slam.md) | CFEAR, HERO, Under the Radar, Navtech/Oxford Radar RobotCar, Boreas, MulRan, RADIATE, K-Radar. |
| [Radar-Inertial Odometry](radar-inertial-odometry.md) | iRIOM, Go-RIO, x-RIO, multi-radar IO, EKF-RIO-TC, DeRO. |
| [Radar-LiDAR-Inertial Fusion](radar-lidar-inertial-fusion.md) | Doppler-SLAM, Radarize, DRO, GaRLIO, DR-LRIO, radar-to-LiDAR map localization. |
| [OpenVINS](openvins.md) | MSCKF family alias and explicit contrast to OKVIS/ROVIO/BASALT. |
| [MASt3R-SLAM](mast3r-slam.md) | SLAM3R, VGGT, CUT3R, MegaSaM, MonST3R, and feed-forward geometry-model SLAM. |
| [KinectFusion](kinectfusion.md) and [ElasticFusion](elasticfusion.md) | InfiniTAM, voxel hashing, Kintinuous, BAD SLAM, surfel maps. |
| [iMAP](imap.md), [NICE-SLAM](nice-slam.md), [Co-SLAM and ESLAM](co-slam-eslam.md), [NeRF-SLAM](nerf-slam.md) | CodeSLAM, DeepFactors, Vox-Fusion, GO-SLAM, and neural dense SLAM survey. |
| [Open-Source SLAM Stack Comparison](open-source-stack-comparison.md) | MOLA, GLIM, KISS-SLAM, LOCUS/LAMP, FAST-LIVO2/R3LIVE, DLIO/DLIOM, cuVSLAM/Isaac ROS. |
| [Splat-LOAM](splat-loam.md) | Already covers LiDAR Gaussian-splatting odometry and mapping; cross-link it with GS-LIVM, Gaussian-LIC, RadarSplat-RIO, S3PO-GS, and the neural/Gaussian survey page. |
| [WildGS-SLAM](wildgs-slam.md) | Already covers dynamic monocular Gaussian SLAM; add aliases from the latest sweep so WildGS is discoverable from Gaussian, dynamic-scene, and visual SLAM paths. |
| [LiDAR SLAM Algorithms](../lidar-slam-algorithms.md) | GenZ-ICP is already mentioned there; promote to a dedicated file if degeneracy-robust registration becomes a first-class subsection. |

## Guardrail Process

When adding or revising SLAM research:

1. Check whether the method is already a dedicated file, a mention-only item, or a backlog item in this audit.
2. If it is P0, create a dedicated file before expanding lower-priority coverage.
3. If it is P1, either create a dedicated file or add a clear cross-link from the closest existing method page.
4. If it is P2 or mention-only, add aliases in [INDEX](../../../INDEX.md), overview text, or the relevant method file so search catches the method name.
5. After every SLAM expansion, update this audit, [SLAM Method Library Overview](overview.md), [Open-Source SLAM Stack Comparison](open-source-stack-comparison.md), [README](../../../README.md), and [Research Index](../../../INDEX.md).
