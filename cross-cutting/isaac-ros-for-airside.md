# NVIDIA Isaac ROS for Airside Autonomous Vehicles

## GPU-Accelerated ROS 2 Packages on Jetson Orin

---

## 1. What Isaac ROS Provides

Isaac ROS is NVIDIA's collection of **hardware-accelerated ROS 2 packages** optimized for Jetson platforms. Key value: operations that take 50-100ms on CPU run in 5-15ms on Orin's GPU/DLA/VIC hardware accelerators.

### 1.1 NITROS Zero-Copy Transport

The foundation enabling all Isaac ROS acceleration:

```
Standard ROS 2 message passing:
  GPU computation → copy to CPU → serialize → DDS → deserialize → copy to GPU
  Overhead: 5-20ms per message, CPU bottleneck

NITROS (NVIDIA Isaac Transport for ROS):
  GPU computation → NITROS shared memory → next GPU node (zero-copy)
  Overhead: <0.1ms per message

Performance improvement:
  Jetson AGX Xavier: 3x improvement
  Jetson AGX Orin: 7x improvement
  Measured: camera pipeline 24ms → 3.4ms on Orin
```

**How NITROS works:**
- Messages stay in GPU memory (CUDA unified memory)
- Nodes exchange pointers, not data
- Compatible with standard ROS 2 publishers/subscribers (auto-negotiates)
- If a non-NITROS node subscribes, data is transparently copied to CPU

### 1.2 Building NITROS Nodes

```python
# Standard ROS 2 node (CPU, slow)
class MyNode(Node):
    def callback(self, msg):
        # Data arrives on CPU, must copy to GPU for processing
        gpu_data = torch.from_numpy(msg.data).cuda()  # expensive copy
        result = my_model(gpu_data)
        # Must copy back to CPU for publishing
        out_msg = to_ros_msg(result.cpu())  # expensive copy

# NITROS node (GPU, fast)
# Use Isaac ROS managed nodes — data stays on GPU throughout
# Register as NITROS-compatible via NitrosNode base class
# Key: use isaac_ros_nitros message types (NitrosImage, NitrosTensorList)
```

---

## 2. Relevant Packages for Airside AV

### 2.1 Perception

| Package | Function | Airside Relevance | HW Accel |
|---------|----------|------------------|----------|
| **isaac_ros_dnn_inference** | TensorRT/Triton model inference | Run CenterPoint, PointPillars, BEVFusion | GPU + DLA |
| **isaac_ros_centerpose** | 6-DoF object pose estimation | ULD container pose, trailer pose | GPU |
| **isaac_ros_yolov8** | YOLOv8 object detection | Camera-based GSE/aircraft detection | GPU + DLA |
| **isaac_ros_foundationpose** | Foundation model-based pose | Novel object pose (any GSE type) | GPU |
| **isaac_ros_freespace_segmentation** | Drivable area detection | Apron/taxiway drivable space | GPU |
| **isaac_ros_proximity_segmentation** | Near-field obstacle detection | Close-range safety around vehicle | DLA |

### 2.2 Depth and 3D

| Package | Function | Airside Relevance | HW Accel |
|---------|----------|------------------|----------|
| **isaac_ros_depth_estimation** | Monocular/stereo depth | Depth from cameras (when added) | GPU |
| **isaac_ros_nvblox** | GPU-accelerated 3D reconstruction | Real-time occupancy grid, ESDF, costmap | GPU |
| **isaac_ros_pointcloud_utils** | Point cloud processing | LiDAR preprocessing acceleration | GPU |

### 2.3 Localization

| Package | Function | Airside Relevance | HW Accel |
|---------|----------|------------------|----------|
| **isaac_ros_visual_slam** (cuVSLAM) | CUDA Visual SLAM | Visual odometry when cameras added | GPU |
| **isaac_ros_map_localization** | Occupancy grid localization | Localize against pre-built 2D maps | GPU |

### 2.4 Infrastructure

| Package | Function | Airside Relevance | HW Accel |
|---------|----------|------------------|----------|
| **isaac_ros_image_pipeline** | Image preprocessing | Rectification, resize, format conversion | VIC (dedicated) |
| **isaac_ros_h264_encoder** | H.264 video encoding | Teleoperation video streaming | NVENC |
| **isaac_ros_argus_camera** | GMSL camera driver | Direct camera-to-GPU capture | ISP + VIC |

---

## 3. Key Package Deep Dives

### 3.1 isaac_ros_dnn_inference

This is the workhorse — runs any TensorRT or Triton model as a ROS 2 node.

```yaml
# Example: Run CenterPoint on LiDAR point clouds
# config/centerpoint.yaml
model:
  engine_file: /models/centerpoint_fp16.engine
  input_tensor_names: [voxels, voxel_num, voxel_coords]
  output_tensor_names: [heatmap, offset, height, dim, rot, vel]
  input_binding_names: [voxels, voxel_num, voxel_coords]
  output_binding_names: [heatmap, offset, height, dim, rot, vel]

# Supports:
#   - TensorRT engines (fastest)
#   - Triton model repository (most flexible)
#   - ONNX Runtime (fallback)
#   - DLA execution (power-efficient)
```

**DLA deployment for power savings:**
```yaml
# Force specific layers onto DLA
trt_config:
  use_dla: true
  dla_core: 0  # or 1 (Orin has 2 DLA cores)
  allow_gpu_fallback: true  # GPU handles unsupported layers
  # DLA contributes 74% of compute at 15W mode
```

### 3.2 isaac_ros_nvblox

GPU-accelerated 3D reconstruction — directly relevant to world model occupancy:

```
What nvblox does:
  - TSDF (Truncated Signed Distance Function) volumetric reconstruction
  - ESDF (Euclidean Signed Distance Field) for path planning
  - 2D costmap generation for navigation
  - 100x faster than CPU-based alternatives

For airside AV:
  - Real-time occupancy grid from LiDAR (alternative to OccWorld for baseline)
  - ESDF enables safe distance computation to all obstacles
  - Costmap feeds directly into navigation planner
  - GPU acceleration keeps it real-time on Orin

Limitations:
  - Static scene assumption (handles slow dynamics)
  - Not a world MODEL — no prediction of future state
  - But excellent as a real-time occupancy baseline
```

### 3.3 isaac_ros_visual_slam (cuVSLAM)

When cameras are added (Phase 2), cuVSLAM provides visual odometry:

```
Features:
  - Multi-camera support (up to 16 cameras)
  - IMU fusion for robust tracking
  - Map management (save/load/relocalize)
  - GPU-accelerated feature extraction and matching
  - 100+ FPS on Orin

For airside:
  - Supplements GTSAM localization (additional factor)
  - Useful in GPS-degraded areas (near terminals)
  - Camera-based loop closure detection
  - Map building from visual features

Note: Aurrigo currently uses LiDAR VGICP for localization.
cuVSLAM would ADD visual odometry as an additional GTSAM factor,
not replace LiDAR localization.
```

---

## 4. Isaac ROS + World Model Integration

### 4.1 Architecture

```
Sensor drivers (Isaac ROS)
    │
    ├── isaac_ros_argus_camera → NitrosImage (stays on GPU)
    ├── rslidar_sdk → PointCloud2 (CPU, then copy to GPU)
    │
    ├── isaac_ros_image_pipeline → rectified images (GPU)
    │
    ├── isaac_ros_dnn_inference
    │   ├── Run PointPillars BEV encoder (TensorRT on GPU/DLA)
    │   ├── Run CenterPoint detection (TensorRT on GPU)
    │   └── Run world model inference (TensorRT on GPU)
    │
    ├── isaac_ros_nvblox → real-time occupancy grid (GPU)
    │   └── Baseline occupancy (complements world model prediction)
    │
    └── Custom world model node (NITROS-compatible)
        ├── BEV features → VQ-VAE tokenize → transformer predict → decode
        ├── Uses NITROS for zero-copy GPU tensor passing
        └── Publishes predicted future occupancy
```

### 4.2 Custom NITROS Node for World Model

```cpp
// Simplified: Register a custom NITROS-compatible world model node
#include "isaac_ros_nitros/nitros_node.hpp"

class WorldModelNode : public nvidia::isaac_ros::nitros::NitrosNode {
public:
  WorldModelNode() : NitrosNode("world_model") {
    // Register NITROS inputs (GPU tensors, no copy)
    registerInput<NitrosTensorList>("bev_features");

    // Register NITROS outputs
    registerOutput<NitrosTensorList>("predicted_occupancy");
  }

  void callback(const NitrosTensorList::SharedPtr msg) {
    // Data is already on GPU — no copy needed!
    // Run TensorRT world model inference
    auto prediction = trt_engine_->infer(msg->tensors);

    // Publish prediction (stays on GPU for downstream NITROS nodes)
    publish("predicted_occupancy", prediction);
  }
};
```

---

## 5. Installation and Setup

### 5.1 Docker (Recommended)

```bash
# Pull Isaac ROS container for Orin
docker pull nvcr.io/nvidia/isaac/ros:3.2.0-aarch64

# Run with GPU access
docker run --runtime nvidia --network host \
    -v /dev:/dev \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    nvcr.io/nvidia/isaac/ros:3.2.0-aarch64

# Inside container: all Isaac ROS packages pre-installed
# ROS 2 Humble (current), Jazzy support in progress
```

### 5.2 Native Build

```bash
# Prerequisites: JetPack 6.x, ROS 2 Humble
sudo apt install ros-humble-isaac-ros-*

# Or build from source
mkdir -p ~/workspaces/isaac_ros/src
cd ~/workspaces/isaac_ros/src
git clone https://github.com/NVIDIA-ISAAC-ROS/isaac_ros_common.git
git clone https://github.com/NVIDIA-ISAAC-ROS/isaac_ros_dnn_inference.git
git clone https://github.com/NVIDIA-ISAAC-ROS/isaac_ros_nvblox.git
# ... add other packages as needed

cd ~/workspaces/isaac_ros
colcon build --symlink-install
```

---

## 6. Gaps for Airside AV

### 6.1 What Isaac ROS Does NOT Provide

| Gap | Description | Solution |
|-----|-------------|----------|
| **LiDAR-native packages** | No PointPillars/CenterPoint nodes | Use `isaac_ros_dnn_inference` with custom TensorRT engines |
| **Multi-LiDAR fusion** | No built-in multi-LiDAR aggregation | Port Aurrigo's `pointcloud_aggregator` to ROS 2 |
| **Lanelet2 support** | No zone/map management | Port Aurrigo's `zone_manager` or use Autoware's Lanelet2 loader |
| **World model inference** | No occupancy prediction | Build custom NITROS node (Section 4.2) |
| **4D radar support** | No radar processing packages | Use `continental_ars548` ROS 2 driver |
| **ADS-B integration** | No aviation data packages | Build custom node (documented in `operations/airside/airport-data-integration.md`) |
| **Frenet planning** | No trajectory planning | Port Aurrigo's `aurrigo_nav` or use Autoware's planner |
| **CAN interface** | No vehicle-specific CAN | Port Aurrigo's `av_comms` to ROS 2 |

### 6.2 What to Reuse vs Build Custom

```
REUSE from Isaac ROS:
  ✓ NITROS zero-copy transport (7x speedup on Orin)
  ✓ isaac_ros_dnn_inference (TensorRT wrapper)
  ✓ isaac_ros_nvblox (baseline occupancy grid)
  ✓ isaac_ros_image_pipeline (when cameras added)
  ✓ isaac_ros_h264_encoder (teleoperation)
  ✓ isaac_ros_visual_slam (when cameras added)

PORT from Aurrigo (Noetic → ROS 2):
  → pointcloud_aggregator (multi-LiDAR fusion)
  → zone_manager (Lanelet2 zones)
  → av_comms (CAN vehicle interface)
  → nav stack (Frenet planner, behavior FSM)

BUILD NEW:
  ★ World model NITROS node (VQ-VAE + transformer)
  ★ BEV encoder NITROS node (PointPillars on GPU)
  ★ Safety monitor node (OOD detection, RSS)
  ★ Airport context manager (ADS-B, A-CDM, NOTAM)
  ★ Arbitrator node (Simplex stack switching)
```

---

## 7. Performance Expectations on Orin

| Pipeline | CPU (ROS 2 standard) | Isaac ROS (GPU/NITROS) | Speedup |
|----------|---------------------|----------------------|---------|
| Camera preprocessing (6 cameras) | ~60ms | ~8ms | 7.5x |
| Point cloud preprocessing | ~15ms | ~5ms | 3x |
| DNN inference (PointPillars) | ~50ms (CPU ONNX) | ~7ms (TensorRT+DLA) | 7x |
| Occupancy grid (nvblox) | ~100ms (CPU) | ~10ms (GPU) | 10x |
| Video encoding (teleoperation) | ~30ms (CPU) | ~5ms (NVENC) | 6x |
| Full perception pipeline | ~255ms | ~35ms | **7x** |

**7x improvement** means the difference between 4Hz and 28Hz perception — well within the 10Hz target.

---

## Sources

- NVIDIA Isaac ROS documentation: https://nvidia-isaac-ros.github.io/
- Isaac ROS GitHub: https://github.com/NVIDIA-ISAAC-ROS
- NITROS architecture paper: NVIDIA Developer Blog
- nvblox: https://github.com/nvidia-isaac/nvblox
- JetPack 6.x documentation
- Isaac ROS Benchmark results
