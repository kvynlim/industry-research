# Occupancy Prediction Deployment on NVIDIA Orin

## Practical Guide: From Research Models to Real-Time Airside Perception

**Last updated:** 2026-04-11

---

## Table of Contents

1. [Why Occupancy on Orin for Airside](#1-why-occupancy-on-orin-for-airside)
2. [Orin Compute Budget for Occupancy](#2-orin-compute-budget-for-occupancy)
3. [FlashOcc: The Fast Path](#3-flashocc-the-fast-path)
4. [SparseOcc: The Accurate Path](#4-sparseocc-the-accurate-path)
5. [LiDAR-Based Occupancy on Orin](#5-lidar-based-occupancy-on-orin)
6. [nvblox: NVIDIA's Built-In Occupancy](#6-nvblox-nvidias-built-in-occupancy)
7. [TensorRT Optimization Cookbook](#7-tensorrt-optimization-cookbook)
8. [Resolution and Range Tradeoffs](#8-resolution-and-range-tradeoffs)
9. [Integration with Aurrigo ROS Stack](#9-integration-with-aurrigo-ros-stack)
10. [Benchmarks on Orin](#10-benchmarks-on-orin)
11. [Recommended Deployment Strategy](#11-recommended-deployment-strategy)
12. [References](#12-references)

---

## 1. Why Occupancy on Orin for Airside

### 1.1 The Case for Occupancy

Traditional object detection detects known classes (car, pedestrian, cyclist). Occupancy prediction classifies every voxel in 3D space as occupied/free — **class-agnostic** by nature.

**This is transformative for airside:**

| Problem | Object Detection | Occupancy Prediction |
|---------|-----------------|---------------------|
| Detect 30+ GSE types | Need per-class training data for each | Just predicts "occupied" — works for all |
| 100+ aircraft variants | Need per-variant annotations | Treats as occupied volume |
| FOD (foreign objects) | Unknown class = missed | Any occupied voxel detected |
| Jet blast zone | Cannot detect invisible hazard | Can learn thermal/flow patterns as occupancy |
| Novel objects (never seen) | Fails silently | Still predicts "occupied" |
| Construction debris | Rare class, poor detection | Any obstacle is occupied |

### 1.2 Requirements for Airside Deployment

| Requirement | Value | Rationale |
|-------------|-------|-----------|
| Latency | <100ms (10 Hz) | Minimum for 30 km/h operation |
| Range | 50-100m forward | Stopping distance + reaction time at 30 km/h |
| Resolution | 0.2-0.5m voxels | Detect personnel (0.5m wide) and FOD (>0.1m) |
| GPU memory | <8 GB | Leave headroom for other tasks on 32GB Orin |
| Power | <30W (occupancy task) | Share 60W total with perception, planning, mapping |
| Semantic classes | 5-10 (airside-specific) | Ground, vehicle, aircraft, personnel, structure, unknown-occupied |

---

## 2. Orin Compute Budget for Occupancy

### 2.1 NVIDIA Orin AGX 64GB Specification

| Resource | Total | Available for Occupancy |
|----------|-------|------------------------|
| GPU cores | 2048 Ampere CUDA + 64 Tensor Cores | ~30-40% (shared with other perception) |
| GPU memory | 64 GB unified (or 32 GB on smaller SKU) | 6-10 GB |
| GPU compute | 275 TOPS (INT8) / 137.5 TFLOPS (FP16) | ~40-55 TFLOPS (FP16, shared) |
| DLA | 2x NVDLA v2.0 | Could offload pre/post-processing |
| Power budget | 60W (MAX mode) / 30W (30W mode) | 10-20W for occupancy |

### 2.2 Compute Budget Allocation

```
Orin 60W Total Budget:
  ├── LiDAR processing (PointPillars/CenterPoint): 7-15ms, 2-4 GB
  ├── Camera processing (backbone + BEV): 20-40ms, 3-6 GB
  ├── Occupancy prediction: 20-50ms, 3-6 GB    ← THIS DOCUMENT
  ├── Online mapping (MapTracker): 50-80ms, 4-6 GB
  ├── Planning (Frenet/neural): 10-30ms, 1-2 GB
  ├── Localization (GTSAM + VGICP): 15-25ms, 2-3 GB
  └── Infrastructure fusion + misc: 5-10ms, 1-2 GB

Note: Pipeline is NOT sequential — many run in parallel
Total GPU memory: ~16-29 GB (fits in 32 GB Orin AGX)
```

### 2.3 FPS Requirements Analysis

| Speed (km/h) | Stopping Distance (dry) | At 10 Hz: Distance/Frame | Voxels Swept/Frame |
|--------------|------------------------|--------------------------|-------------------|
| 5 | 1.4m | 0.14m | Minimal |
| 15 | 5.6m | 0.42m | ~1 voxel at 0.4m |
| 30 | 15.0m | 0.83m | ~2 voxels at 0.4m |

**Conclusion:** 10 Hz (100ms budget) is sufficient for airside speeds. Even 5 Hz (200ms) is acceptable at 5-15 km/h. This is much more relaxed than highway driving (requires 20+ Hz).

---

## 3. FlashOcc: The Fast Path

### 3.1 Why FlashOcc for Orin

FlashOcc is the **only occupancy method that achieves real-time on consumer GPUs** (197.6 FPS on RTX 3090). Its core innovation — Channel-to-Height (C2H) plugin — eliminates the 3D convolution bottleneck.

**Architecture:**

```
Camera images → 2D backbone (ResNet-50) → BEV features (C × H × W)
                                                    │
                              Channel-to-Height (C2H) plugin
                              Reshape: (C × H × W) → (Z × Cls × H × W)
                              No 3D convolutions needed!
                                                    │
                              3D occupancy grid (Z × H × W) with class labels
```

The C2H trick: instead of explicitly constructing a 3D volume and running 3D convolutions (slow, memory-hungry), FlashOcc encodes the height dimension in the channel dimension of 2D BEV features. A simple reshape converts 2D BEV features into a 3D occupancy grid.

### 3.2 FlashOcc Variants on Orin

| Variant | mIoU (Occ3D) | FPS (3090 TRT FP16) | Est. FPS (Orin FP16) | Memory |
|---------|-------------|--------------------|--------------------|--------|
| FlashOcc-M0 | 31.95 | 197.6 | ~50-60 | ~2.0 GB |
| FlashOcc-M1 | 32.08 | 152.7 | ~40-50 | ~2.3 GB |
| FlashOcc-M4 | 32.90 | ~154 | ~40-50 | ~2.6 GB |
| FlashOcc-R101 | ~37.0 | ~80 | ~20-25 | ~4.0 GB |

**Estimation basis:** Orin GPU is ~3-4x slower than RTX 3090 for FP16 workloads (Orin has 137.5 TFLOPS FP16 vs 3090's 285.6 TFLOPS). But TensorRT optimizations on Orin are highly efficient due to native INT8 support.

### 3.3 TensorRT Conversion for FlashOcc

```python
"""
FlashOcc TensorRT export pipeline for NVIDIA Orin.

Steps:
1. Export PyTorch model to ONNX
2. Convert ONNX to TensorRT engine with Orin-specific optimizations
3. Benchmark on target hardware
"""

import torch
import tensorrt as trt

# Step 1: Export to ONNX
def export_flashocc_onnx(model, output_path="flashocc.onnx"):
    """Export FlashOcc to ONNX with dynamic batch size."""
    model.eval()
    
    # Dummy inputs (6 cameras, 256x704 each)
    dummy_imgs = torch.randn(1, 6, 3, 256, 704).cuda()
    dummy_intrinsics = torch.randn(1, 6, 4, 4).cuda()
    dummy_extrinsics = torch.randn(1, 6, 4, 4).cuda()
    
    torch.onnx.export(
        model,
        (dummy_imgs, dummy_intrinsics, dummy_extrinsics),
        output_path,
        opset_version=17,
        input_names=["images", "intrinsics", "extrinsics"],
        output_names=["occupancy"],
        dynamic_axes={
            "images": {0: "batch"},
            "occupancy": {0: "batch"},
        },
    )
    print(f"Exported to {output_path}")


# Step 2: Build TensorRT engine for Orin
def build_trt_engine(onnx_path, engine_path, precision="fp16"):
    """Build TensorRT engine optimized for Orin."""
    logger = trt.Logger(trt.Logger.WARNING)
    builder = trt.Builder(logger)
    network = builder.create_network(
        1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH)
    )
    parser = trt.OnnxParser(network, logger)
    
    with open(onnx_path, "rb") as f:
        parser.parse(f.read())
    
    config = builder.create_builder_config()
    config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, 4 << 30)  # 4GB
    
    if precision == "fp16":
        config.set_flag(trt.BuilderFlag.FP16)
    elif precision == "int8":
        config.set_flag(trt.BuilderFlag.INT8)
        # INT8 requires calibration dataset
        config.int8_calibrator = FlashOccCalibrator(
            calib_data="path/to/calib/images",
            batch_size=1,
        )
    
    # Orin-specific optimizations
    config.set_flag(trt.BuilderFlag.PREFER_PRECISION_CONSTRAINTS)
    
    # Build engine
    engine = builder.build_serialized_network(network, config)
    with open(engine_path, "wb") as f:
        f.write(engine)
    
    print(f"Built TensorRT engine: {engine_path}")
    return engine


# Step 3: INT8 calibration for maximum performance
class FlashOccCalibrator(trt.IInt8EntropyCalibrator2):
    """
    INT8 calibration for FlashOcc on Orin.
    Uses 500-1000 representative frames from airside data.
    """
    def __init__(self, calib_data, batch_size=1):
        super().__init__()
        self.batch_size = batch_size
        self.data_loader = load_calibration_data(calib_data)
        self.current_idx = 0
        # Allocate device memory for calibration batch
        self.device_input = cuda.mem_alloc(
            batch_size * 6 * 3 * 256 * 704 * 4  # float32
        )
    
    def get_batch_size(self):
        return self.batch_size
    
    def get_batch(self, names):
        if self.current_idx >= len(self.data_loader):
            return None
        batch = self.data_loader[self.current_idx]
        cuda.memcpy_htod(self.device_input, batch.numpy())
        self.current_idx += 1
        return [int(self.device_input)]
```

### 3.4 FlashOcc INT8 on Orin: Expected Performance

| Precision | Est. FPS (Orin AGX) | Memory | mIoU Loss vs FP32 |
|-----------|--------------------|---------|--------------------|
| FP32 | ~15-20 | ~4 GB | Baseline |
| FP16 | ~40-60 | ~2.5 GB | <0.5% |
| INT8 (PTQ) | ~70-100 | ~1.5 GB | ~1-2% |
| INT8 (QAT) | ~70-100 | ~1.5 GB | <0.5% |

**INT8 is recommended for Orin deployment.** Based on PointPillars INT8 experience (0.80% mAP loss for 2.2x speedup), FlashOcc should tolerate INT8 well since its operations are primarily 2D convolutions.

---

## 4. SparseOcc: The Accurate Path

### 4.1 Why SparseOcc

SparseOcc (ECCV 2024) achieves significantly higher accuracy than FlashOcc (39.4 vs 32.9 mIoU) by using sparse voxel representations:

**Architecture:**

```
Camera images → 2D backbone → BEV features
                                    │
                    Sparse query sampling
                    (only query occupied regions, not empty space)
                                    │
                    Mask-informed sparse decoder
                    (deformable attention on sparse voxels only)
                                    │
                    Sparse 3D occupancy (only occupied voxels stored)
```

**Key advantage:** By only processing occupied voxels (~5-15% of total volume), SparseOcc is much more memory-efficient than dense methods while being more accurate.

### 4.2 SparseOcc on Orin

| Config | mIoU | FPS (A100) | Est. FPS (Orin FP16) | Memory |
|--------|------|-----------|--------------------|---------| 
| SparseOcc-8f (R50) | 39.4 | 17.3 | ~5-7 | ~6 GB |
| SparseOcc-16f (R50) | 40.3 | 12.5 | ~3-5 | ~8 GB |

**Challenge:** SparseOcc at 5-7 FPS on Orin is below the 10 Hz target. Options:
1. **Accept 5 Hz** — sufficient for <15 km/h operations (most airside work)
2. **Reduce temporal frames:** 4f instead of 8f (faster, slightly less accurate)
3. **Reduce resolution:** 0.5m voxels instead of 0.4m
4. **Backbone distillation:** Replace ResNet-50 with MobileNetV3 or EfficientNet-B0

### 4.3 SparseOcc Optimization Strategy

```
Optimization pipeline for Orin:

1. Backbone swap: ResNet-50 → EfficientNet-B0 (2-3x faster, ~2 mIoU loss)
2. BEV resolution: 200×200 → 150×150 (~1.8x faster, ~1 mIoU loss)
3. Temporal frames: 8 → 4 (~2x faster, ~1 mIoU loss)
4. TensorRT FP16: 2-3x faster
5. Sparse attention: Reduce max queries from 2048 to 1024

Combined: ~5 FPS → ~25-35 FPS on Orin (meeting 10Hz target)
Accuracy: ~39.4 → ~34-36 mIoU (still significantly better than FlashOcc)
```

---

## 5. LiDAR-Based Occupancy on Orin

### 5.1 The Aurrigo Case: LiDAR-First

The Aurrigo stack uses 4-8 RoboSense LiDARs with no cameras. Most occupancy methods are camera-only. LiDAR-based occupancy options:

### 5.2 Point Cloud → Voxel Occupancy (Direct)

The simplest approach — no neural network needed for basic occupancy:

```python
"""
Direct LiDAR point cloud to occupancy grid conversion.
No ML model — pure geometric computation. Runs on CPU or GPU.
"""

import numpy as np


class LiDARToOccupancy:
    """
    Convert multi-LiDAR point cloud to 3D occupancy grid.
    
    This is the baseline: fast, deterministic, no training needed.
    Limitations: no semantic labels, no prediction beyond current frame,
    no reasoning about occluded space.
    """
    
    def __init__(self, 
                 x_range=(-50, 50),     # meters
                 y_range=(-50, 50),
                 z_range=(-3, 5),
                 voxel_size=0.4):       # meters per voxel
        self.x_range = x_range
        self.y_range = y_range
        self.z_range = z_range
        self.voxel_size = voxel_size
        
        # Grid dimensions
        self.nx = int((x_range[1] - x_range[0]) / voxel_size)  # 250
        self.ny = int((y_range[1] - y_range[0]) / voxel_size)  # 250
        self.nz = int((z_range[1] - z_range[0]) / voxel_size)  # 20
        
    def points_to_occupancy(self, points):
        """
        Convert point cloud (N, 3) to occupancy grid (nz, ny, nx).
        
        Args:
            points: np.array of shape (N, 3+) — x, y, z [, intensity, ...]
        Returns:
            occupancy: np.array of shape (nz, ny, nx), dtype=uint8
                0 = unknown, 1 = free (ray-traced), 2 = occupied
        """
        occupancy = np.zeros((self.nz, self.ny, self.nx), dtype=np.uint8)
        
        # Voxelize points
        vx = ((points[:, 0] - self.x_range[0]) / self.voxel_size).astype(int)
        vy = ((points[:, 1] - self.y_range[0]) / self.voxel_size).astype(int)
        vz = ((points[:, 2] - self.z_range[0]) / self.voxel_size).astype(int)
        
        # Filter in-bounds
        mask = (vx >= 0) & (vx < self.nx) & \
               (vy >= 0) & (vy < self.ny) & \
               (vz >= 0) & (vz < self.nz)
        
        vx, vy, vz = vx[mask], vy[mask], vz[mask]
        
        # Mark occupied voxels
        occupancy[vz, vy, vx] = 2  # Occupied
        
        # Ray-trace to mark free space (optional, more expensive)
        # For each point, all voxels between sensor origin and point are free
        # self._raytrace_free_space(occupancy, points[mask])
        
        return occupancy
    
    def raytrace_free_space_gpu(self, points, sensor_origin=(0, 0, 1.5)):
        """
        GPU-accelerated ray tracing using CUDA.
        Marks voxels along LiDAR rays as free space.
        
        Uses Bresenham's 3D line algorithm on GPU (via CuPy or custom CUDA kernel).
        Runtime: ~2-5ms for 100K points on Orin GPU.
        """
        # Implementation via CuPy or custom CUDA kernel
        pass


class SemanticLiDAROccupancy:
    """
    Adds semantic labels to LiDAR occupancy using point-level segmentation.
    
    Pipeline:
      LiDAR points → Cylinder3D/SPVCNN → per-point labels
      → Voxelize with majority voting → Semantic occupancy grid
    """
    
    def __init__(self, segmentation_model, voxel_size=0.4):
        self.seg_model = segmentation_model  # e.g., Cylinder3D with TensorRT
        self.voxelizer = LiDARToOccupancy(voxel_size=voxel_size)
    
    def predict(self, points):
        # Step 1: Semantic segmentation (per-point labels)
        labels = self.seg_model(points)  # (N,) — class IDs
        
        # Step 2: Voxelize with labels
        # For each voxel, take majority vote of contained point labels
        occupancy = self.voxelizer.points_to_occupancy(points)
        semantic_grid = self.voxelize_with_labels(points, labels)
        
        return semantic_grid
```

### 5.3 UnO: Self-Supervised LiDAR Occupancy

**UnO** (Agro et al., 2024) is the only occupancy method explicitly designed for LiDAR-only with self-supervised training:

```
Architecture:
  Multi-sweep LiDAR (T frames) → 4D spatio-temporal encoder
      │
      ├── Encode 4D occupancy field (x, y, z, t)
      │
      ├── Self-supervised: predict future LiDAR points
      │   (no manual labels needed — future scans are ground truth)
      │
      └── Output: 4D occupancy field with forecasting

Training:
  - Input: N past LiDAR sweeps
  - Predict: M future LiDAR sweeps
  - Loss: Chamfer distance between predicted and actual future points
  - Labels: None needed (self-supervised)

Airside advantage:
  - No annotation cost
  - Train on Aurrigo's existing ROS bag data
  - Learns occupancy + forecasting simultaneously
```

### 5.4 nvblox-Based Occupancy (See Section 6)

NVIDIA's nvblox provides real-time 3D reconstruction and occupancy from depth data, highly optimized for Orin. See next section.

---

## 6. nvblox: NVIDIA's Built-In Occupancy

### 6.1 Overview

nvblox is NVIDIA's GPU-accelerated 3D reconstruction and occupancy mapping library, part of Isaac ROS (see `40-runtime-systems/ros-autoware/isaac-ros-for-airside.md`).

**Key specs:**
- **TSDF (Truncated Signed Distance Function)** + ESDF (Euclidean SDF) + occupancy
- **100x faster** than OctoMap on Orin (NVIDIA benchmark)
- **Input:** Depth images (from cameras) or LiDAR point clouds
- **Output:** 3D occupancy grid, distance field, mesh
- **Integration:** Native ROS 2 node, Isaac ROS compatible, also works with ROS 1 via bridge

### 6.2 nvblox Architecture

```
Input: Depth image or point cloud + pose (from SLAM)
    │
    ├── TSDF Integration
    │   - Raycasting from sensor to each depth measurement
    │   - Update truncated signed distance for each voxel
    │   - GPU-parallelized: one thread per ray
    │
    ├── ESDF Computation (optional)
    │   - Euclidean distance to nearest surface
    │   - Used for path planning (safe distance)
    │
    ├── Occupancy Grid
    │   - Binary: each voxel occupied (TSDF < 0) or free (TSDF > 0)
    │   - Probabilistic: log-odds update for dynamic environments
    │
    └── Mesh Extraction (optional)
        - Marching cubes on TSDF
        - Real-time mesh for visualization
```

### 6.3 nvblox Performance on Orin

| Configuration | Resolution | FPS (Orin AGX) | Memory | Notes |
|--------------|-----------|---------------|---------|-------|
| Depth camera input | 5cm voxels | 30+ Hz | ~1 GB | Default configuration |
| Depth camera input | 2cm voxels | 15-20 Hz | ~4 GB | High resolution |
| LiDAR input | 10cm voxels | 40+ Hz | ~0.5 GB | Coarser for speed |
| LiDAR input | 5cm voxels | 20-30 Hz | ~2 GB | Balanced |
| Multi-sensor (2 depth + 1 LiDAR) | 5cm voxels | 15-20 Hz | ~3 GB | Realistic config |

### 6.4 nvblox vs Neural Occupancy

| Aspect | nvblox | FlashOcc/SparseOcc |
|--------|--------|-------------------|
| **Approach** | Geometric (TSDF) | Learned (neural network) |
| **Semantic labels** | No (binary occupied/free) | Yes (per-class) |
| **Occlusion handling** | No (only observed space) | Yes (predicts behind objects) |
| **Prediction** | No (current frame only) | Temporal models predict future |
| **Novel objects** | Detects any obstacle | Detects any obstacle |
| **Training data** | None needed | Requires annotated data |
| **Accuracy** | Exact (up to sensor noise) | ~30-40 mIoU (benchmarks) |
| **Latency (Orin)** | 5-30ms | 10-100ms |
| **Memory (Orin)** | 0.5-4 GB | 2-8 GB |
| **Best for** | Safety-critical baseline | Rich scene understanding |

**Recommendation:** Use nvblox as the **safety-critical baseline** (always running, fast, geometric) and neural occupancy (FlashOcc/SparseOcc) as the **high-level understanding layer** (semantic classes, prediction).

### 6.5 nvblox + ROS 1 Bridge for Aurrigo

The Aurrigo stack runs ROS Noetic (ROS 1). nvblox is natively ROS 2. Bridge options:

```bash
# Option 1: ros1_bridge (standard, some latency)
# Run ROS 2 nvblox node and bridge topics to ROS 1
ros2 launch nvblox_ros nvblox.launch.py \
  input_depth_topic:=/depth_from_lidar \
  input_pose_topic:=/current_pose

# In separate terminal:
ros2 run ros1_bridge dynamic_bridge

# Option 2: Shared memory (zero-copy, requires custom code)
# Use NVIDIA GXF/NitROS for shared memory between ROS 1 and nvblox

# Option 3: Run nvblox as C++ library directly from ROS 1 node
# Link against libnvblox, call API directly from ROS 1 nodelet
# Avoids any bridging overhead
```

**Recommended:** Option 3 — call nvblox C++ API directly from a ROS 1 nodelet. This avoids all bridging overhead and gives the lowest latency.

---

## 7. TensorRT Optimization Cookbook

### 7.1 General TensorRT Tips for Occupancy on Orin

```
Optimization checklist:

1. ONNX export:
   ├── Use opset 17 (latest stable for TRT 8.6+)
   ├── Fuse BatchNorm into Conv before export
   ├── Use torch.onnx.export with dynamic_axes for batch
   └── Verify with onnxruntime before TRT conversion

2. TensorRT build:
   ├── FP16 mode (default — always use on Orin)
   ├── INT8 mode (if accuracy allows — 1.5-2x over FP16)
   ├── Set workspace to 4-8 GB
   ├── Enable builder optimizations (kTF32, SPARSE_WEIGHTS if applicable)
   └── Profile on target Orin (do NOT build on x86 for Orin)

3. Layer-level optimizations:
   ├── Replace 3D convolutions with 2D + reshape (FlashOcc approach)
   ├── Use depth-wise separable convolutions where possible
   ├── Fuse activation functions (ReLU, SiLU) into preceding layers
   └── Use TensorRT's implicit batch mode for fixed batch size

4. Memory optimizations:
   ├── Reduce feature map channels (e.g., 256 → 128)
   ├── Use shared memory for intermediate tensors
   ├── Enable GPU memory pool for inference
   └── Profile with trtexec --memPoolSize
```

### 7.2 Quantization Strategies

| Strategy | Speed Gain | Accuracy Loss | Effort |
|----------|-----------|--------------|--------|
| FP16 (default) | 2x vs FP32 | <0.5% | Zero (just a flag) |
| INT8 PTQ (post-training) | 3-4x vs FP32 | 1-3% | Low (500-1K calib frames) |
| INT8 QAT (quantization-aware training) | 3-4x vs FP32 | <1% | Medium (retrain with fake quant) |
| Mixed INT8/FP16 | 2.5-3.5x vs FP32 | <1% | Medium (per-layer sensitivity) |
| Sparse weights + INT8 | 4-6x vs FP32 | 1-2% | High (structured pruning + QAT) |

**For occupancy on Orin:** Start with FP16 (zero effort), then INT8 PTQ if more speed needed. QAT only if PTQ causes unacceptable accuracy loss.

### 7.3 Profiling Tools

```bash
# Profile TRT engine on Orin
trtexec --loadEngine=flashocc_fp16.engine \
        --shapes=images:1x6x3x256x704 \
        --warmUp=1000 --duration=10 \
        --verbose 2>&1 | tee profile.log

# Layer-by-layer timing
trtexec --loadEngine=flashocc_fp16.engine \
        --profilingVerbosity=detailed \
        --dumpLayerInfo --dumpProfile

# Memory usage
nvidia-smi dmon -d 1 -s u  # Monitor GPU utilization and memory
```

---

## 8. Resolution and Range Tradeoffs

### 8.1 Voxel Size Impact

| Voxel Size | Grid (100m range) | Memory | Compute | Can Detect |
|-----------|-------------------|---------|---------|-----------|
| 0.1m | 1000³ = 1B voxels | ~1 GB | Very slow | 0.1m FOD |
| 0.2m | 500³ = 125M voxels | ~125 MB | Slow | 0.2m objects, personnel limbs |
| 0.4m | 250³ = 15.6M voxels | ~16 MB | Fast | Personnel (0.5m), small GSE |
| 0.5m | 200³ = 8M voxels | ~8 MB | Very fast | Personnel, all GSE, aircraft |
| 1.0m | 100³ = 1M voxels | ~1 MB | Minimal | Large objects only |

**Airside recommendation:** 0.4m voxels within 50m, 0.8m voxels from 50-100m (multi-resolution grid). Detects personnel (0.5m) at close range while maintaining long-range awareness.

### 8.2 Multi-Resolution Grid

```
Multi-resolution occupancy grid for airside:

Close range (0-20m): 0.2m voxels
  - Personnel detection (safety-critical)
  - FOD detection
  - Precise obstacle avoidance

Medium range (20-50m): 0.4m voxels  
  - Standard occupancy
  - Vehicle/GSE detection
  - Path planning horizon

Long range (50-100m): 0.8m voxels
  - Aircraft awareness
  - Situational understanding
  - Route-level planning

Implementation:
  - Use separate voxel grids at each resolution
  - Or use octree structure (nvblox supports this natively)
  - Output: unified costmap for planner
```

### 8.3 Airside-Specific Range Requirements

| Scenario | Required Range | Required Resolution | Reason |
|----------|---------------|--------------------|----|
| Stand approach | 20m | 0.2m | Precise positioning near aircraft |
| Taxiway driving | 50-80m | 0.4m | See ahead at 30 km/h |
| Intersection detection | 30-50m | 0.4m | Detect crossing traffic |
| Aircraft awareness | 100m+ | 1.0m | Know aircraft positions |
| FOD detection | 30m | 0.1-0.2m | See small debris |
| Personnel safety | 30m | 0.2m | Detect person at distance |

---

## 9. Integration with Aurrigo ROS Stack

### 9.1 Current Aurrigo Perception Pipeline

```
Current (no occupancy):
  4-8 RoboSense LiDAR → Point cloud
      │
      ├── RANSAC ground segmentation
      ├── Euclidean clustering → obstacles
      └── GTSAM localization (VGICP matching)
      
  No occupancy grid → No reasoning about free space,
  no prediction about future occupancy, no semantic understanding
```

### 9.2 Proposed Occupancy Integration

```
Proposed (with occupancy):
  4-8 RoboSense LiDAR → Point cloud
      │
      ├── [Existing] RANSAC ground segmentation
      ├── [Existing] GTSAM localization
      │
      ├── [New] nvblox occupancy (safety baseline)
      │   └── Binary occupancy grid at 5cm → costmap
      │
      ├── [New] Semantic LiDAR segmentation (Cylinder3D/TensorRT)
      │   └── Per-point class labels → semantic occupancy
      │
      └── [Future] Neural occupancy (FlashOcc/SparseOcc when cameras added)
          └── Semantic 3D occupancy with prediction

ROS node graph:
  /lidar_merger → /nvblox_node → /occupancy_grid (nav_msgs/OccupancyGrid)
                               → /costmap_3d (custom msg)
                
  /lidar_merger → /semantic_seg → /semantic_occupancy (custom msg)

  /costmap_3d + /semantic_occupancy → /planner (Frenet/lattice)
```

### 9.3 ROS Message Types

```python
# Standard 2D occupancy grid (for backward compatibility with move_base)
nav_msgs/OccupancyGrid:
  header: std_msgs/Header
  info: nav_msgs/MapMetaData  # resolution, width, height, origin
  data: int8[]  # -1 = unknown, 0 = free, 100 = occupied

# Custom 3D occupancy grid
airside_msgs/OccupancyGrid3D:
  header: std_msgs/Header
  resolution: float32          # voxel size in meters
  width: uint32                # number of voxels in x
  height: uint32               # number of voxels in y
  depth: uint32                # number of voxels in z
  origin: geometry_msgs/Point  # world frame origin
  data: uint8[]                # 0=unknown, 1=free, 2=occupied
  semantic_data: uint8[]       # (optional) class per voxel

# Custom semantic occupancy with classes
airside_msgs/SemanticOccupancy:
  header: std_msgs/Header
  resolution: float32
  grid_size: [uint32, uint32, uint32]  # x, y, z
  origin: geometry_msgs/Point
  classes: string[]            # ["ground", "vehicle", "aircraft", "person", ...]
  voxels: airside_msgs/Voxel[]
  
airside_msgs/Voxel:
  x: uint16
  y: uint16
  z: uint16
  class_id: uint8
  confidence: float32
```

---

## 10. Benchmarks on Orin

### 10.1 Measured and Estimated Performance

| Method | Input | FPS (Orin AGX) | Memory | Semantic | Source |
|--------|-------|---------------|---------|----------|--------|
| nvblox (5cm) | LiDAR depth | 30+ Hz | ~1 GB | No | NVIDIA measured |
| nvblox (2cm) | LiDAR depth | 15-20 Hz | ~4 GB | No | NVIDIA measured |
| Direct voxelization | LiDAR | 100+ Hz | ~100 MB | No | Trivial compute |
| PointPillars + voxelize | LiDAR | ~40 Hz | ~2 GB | Partial (detected classes) | Estimated from TRT benchmarks |
| Cylinder3D (TRT FP16) | LiDAR | ~15-20 Hz | ~3 GB | Yes (point-level) | Estimated |
| FlashOcc-M0 (TRT FP16) | Camera | ~50-60 Hz | ~2 GB | Yes | Estimated from 3090 |
| FlashOcc-M0 (TRT INT8) | Camera | ~70-100 Hz | ~1.5 GB | Yes | Estimated |
| SparseOcc-4f (TRT FP16) | Camera | ~8-12 Hz | ~5 GB | Yes | Estimated from A100 |

### 10.2 Recommended Configuration for Each Deployment Phase

**Phase 1: LiDAR-Only (Current Aurrigo Stack)**

```
nvblox occupancy (safety layer):
  Input: Merged LiDAR point cloud
  Resolution: 5cm (close), 10cm (far)
  FPS: 30+ Hz
  Memory: ~1.5 GB
  Role: Binary obstacle detection, costmap generation

Cylinder3D semantic segmentation (understanding layer):
  Input: Merged LiDAR point cloud
  Resolution: Per-point labels
  FPS: ~15-20 Hz
  Memory: ~3 GB
  Role: Classify ground, vehicle, person, structure

Total: ~4.5 GB GPU, 15-30 Hz update rate
```

**Phase 2: LiDAR + Camera (Future)**

```
nvblox (safety baseline): same as Phase 1
FlashOcc (semantic occupancy): 
  Input: 6-8 cameras
  Resolution: 0.4m voxels, 50m range
  FPS: 50-100 Hz (INT8)
  Memory: ~1.5 GB
  Role: Dense semantic 3D understanding

Total: ~6 GB GPU, 15-30 Hz update rate (bottleneck: Cylinder3D)
```

**Phase 3: Full Neural Occupancy (With Thor or Next-Gen)**

```
SparseOcc (high-accuracy semantic): 
  Input: 6-8 cameras + LiDAR
  Resolution: 0.4m voxels, 100m range
  FPS: 20-30 Hz (on Thor ~1000 TOPS)
  Memory: ~5 GB

OccWorld (4D prediction):
  Input: SparseOcc output
  Prediction: 3-second future occupancy
  FPS: 10 Hz
  Memory: ~4 GB

Total: ~9 GB GPU on Thor
```

---

## 11. Recommended Deployment Strategy

### 11.1 Decision Tree

```
Q: Do you have cameras?
├── No (LiDAR-only) → nvblox + Cylinder3D semantic segmentation
│     ├── nvblox: real-time safety-critical occupancy (30 Hz)
│     ├── Cylinder3D: semantic understanding (15-20 Hz)
│     └── Total: ~4.5 GB on Orin
│
└── Yes (cameras available) →
    Q: Do you need >35 mIoU accuracy?
    ├── No → FlashOcc (INT8, 70-100 Hz, 1.5 GB) + nvblox safety baseline
    └── Yes →
        Q: Is >10 Hz required?
        ├── Yes → SparseOcc (optimized, 4f, ~10-12 Hz) + nvblox safety
        └── No → SparseOcc (16f, ~5 Hz, best accuracy)
```

### 11.2 Phased Rollout

| Phase | Timeline | What | Compute | Investment |
|-------|----------|------|---------|-----------|
| 0 | Now | Direct LiDAR voxelization (no ML) | CPU/minimal GPU | ~$5K dev |
| 1 | 0-3 months | nvblox + Cylinder3D on Orin | 4.5 GB GPU | ~$20K dev |
| 2 | 3-12 months | Add cameras + FlashOcc | +1.5 GB GPU | ~$50K (cameras + dev) |
| 3 | 12-24 months | SparseOcc + OccWorld | Thor needed | ~$100K+ (Thor + dev) |

### 11.3 Validation Strategy

```
Occupancy validation for airside:

1. Known object test:
   - Place known objects at known positions
   - Verify occupancy grid shows correct voxels
   - Measure: position error, completeness, false positive rate

2. Personnel detection test (safety-critical):
   - Person standing at 10m, 20m, 30m, 50m
   - Person behind GSE (partial occlusion)
   - Person at night (with thermal + LiDAR)
   - Measure: detection rate, latency to first detection

3. Aircraft clearance test:
   - Approach parked aircraft at 5 km/h
   - Verify occupancy shows correct aircraft boundary
   - Measure: closest approach distance accuracy

4. Free space accuracy:
   - Drive known route
   - Verify occupancy correctly shows all navigable space
   - Measure: false occupied rate (phantom obstacles)

5. Dynamic update test:
   - GSE drives through scene
   - Verify occupancy updates within 100ms
   - Verify no "ghost" occupancy after GSE leaves
```

---

## 12. References

### Methods
- FlashOcc: Yu et al., "FlashOcc: Fast and Memory-Efficient Occupancy Prediction via Channel-to-Height Plugin," 2023
- SparseOcc: Tang et al., "SparseOcc: Rethinking Sparse Latent Representation for Vision-Based Semantic Occupancy Prediction," ECCV 2024
- FB-OCC: Li et al., "FB-OCC: 3D Occupancy Prediction based on Forward-Backward View Transformation," 2023
- UnO: Agro et al., "UnO: Unsupervised Occupancy Fields for Perception and Forecasting," CVPR 2024
- nvblox: Millane et al., "nvblox: GPU-Accelerated Incremental Signed Distance Field Mapping," ICRA 2024
- Cylinder3D: Zhu et al., "Cylindrical and Asymmetrical 3D Convolution Networks for LiDAR Segmentation," CVPR 2021

### Tools
- nvblox: `https://github.com/nvidia-isaac/nvblox` (Apache 2.0)
- FlashOcc: `https://github.com/Yzichen/FlashOCC` (Apache 2.0)
- SparseOcc: `https://github.com/MCG-NJU/SparseOcc` (Apache 2.0)
- OccWorld: `https://github.com/wzzheng/OccWorld` (Apache 2.0)
- Cylinder3D: `https://github.com/xinge008/Cylinder3D` (Apache 2.0)
- TensorRT: `https://developer.nvidia.com/tensorrt`

## Related Documents

| Topic | Document |
|-------|----------|
| Occupancy networks comparison (20 methods) | `30-autonomy-stack/world-models/occupancy-networks-comparison.md` |
| Occupancy world models | `30-autonomy-stack/world-models/occupancy-world-models.md` |
| TensorRT deployment guide | `20-av-platform/compute/tensorrt-deployment-guide.md` |
| NVIDIA Orin technical | `20-av-platform/compute/nvidia-orin-technical.md` |
| Isaac ROS for airside | `40-runtime-systems/ros-autoware/isaac-ros-for-airside.md` |
| RoboSense LiDAR | `20-av-platform/sensors/robosense-lidar.md` |
| PointPillars foundation | `10-knowledge-base/geometry-3d/pointpillars.md` |
| LiDAR foundation models | `30-autonomy-stack/perception/overview/lidar-foundation-models.md` |
