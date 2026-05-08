# Autonomous Docking and Precision Positioning for Airside GSE

Autonomous ground support equipment (GSE) on airport aprons must routinely position themselves within centimeter-level tolerances to interact with aircraft and other ground infrastructure. A belt loader must align its conveyor head to within +-5 cm of a cargo door sill, a pushback tug must center its nose-gear cradle to within +-10 cm for coupling, a fuel truck must park so the hydrant hose reaches the underwing fuel panel, and a catering truck's scissor lift must match the aircraft service door height and lateral offset. These precision docking maneuvers are fundamentally different from the open-road navigation problem addressed by Frenet-frame planners: the tolerances are 10-100x tighter, the environment is highly constrained by aircraft geometry, and physical contact is sometimes the success criterion rather than a failure mode. This document covers the two-phase approach (coarse navigation followed by fine docking), the sensor modalities and algorithms for final-approach precision (visual servoing, LiDAR ICP alignment, fiducial markers), docking-specific control architectures (MPC, impedance control, velocity profiling), aircraft-specific geometric constraints, safety mechanisms during close-proximity operations, and the advantages of Aurrigo's ADT3 crab-steering capability for lateral docking maneuvers. Implementation guidance targets the existing Aurrigo ROS Noetic stack with 4-8 RoboSense LiDARs running on NVIDIA Orin.

---

## Table of Contents

1. [The Precision Positioning Challenge for Airside GSE](#1-the-precision-positioning-challenge-for-airside-gse)
2. [Two-Phase Approach: Coarse Navigation to Fine Docking](#2-two-phase-approach-coarse-navigation-to-fine-docking)
3. [Visual Servoing for Final Approach](#3-visual-servoing-for-final-approach)
4. [LiDAR-Based Fine Alignment](#4-lidar-based-fine-alignment)
5. [Fiducial Marker Systems](#5-fiducial-marker-systems)
6. [Sensor Fusion for the Final 2 Meters](#6-sensor-fusion-for-the-final-2-meters)
7. [Docking Controllers](#7-docking-controllers)
8. [Aircraft-Specific Docking Geometry](#8-aircraft-specific-docking-geometry)
9. [Safety During Docking Operations](#9-safety-during-docking-operations)
10. [Ackermann and Crab Steering Advantages](#10-ackermann-and-crab-steering-advantages)
11. [Implementation with ROS Noetic](#11-implementation-with-ros-noetic)
12. [Key Takeaways](#12-key-takeaways)

---

## 1. The Precision Positioning Challenge for Airside GSE

### 1.1 Why Centimeter Precision Matters

Every aircraft turnaround involves multiple GSE vehicles approaching the aircraft fuselage to distances measured in centimeters. Unlike on-road autonomous driving where the nearest target is typically meters away, airside docking is a controlled near-contact or contact operation. The consequences of positioning error are severe:

- **Aircraft damage**: A belt loader contacting the fuselage at even 2-3 km/h can cause dents or cracks costing $50K-250K to repair. A misaligned pushback tug can damage nose landing gear (NLG) components worth $500K+. Aircraft fuselage skin is 1.0-2.0 mm aluminum alloy (2024-T3 or 7075-T6) that deforms under surprisingly low forces.
- **Equipment damage**: Scissor lifts, conveyor heads, and coupling mechanisms are precision-engineered assemblies. Misalignment during mating causes bent frames, worn seals, and hydraulic failures.
- **Personnel safety**: Ground crew frequently work in the gap between GSE and aircraft. A 10 cm overshoot could crush a person against the fuselage.
- **Operational disruption**: A failed docking attempt requires repositioning, adding 2-5 minutes per attempt. During a 25-45 minute turnaround window, even one failed attempt significantly impacts on-time performance.

### 1.2 Precision Requirements by GSE Type

| GSE Type | Target Interface | Lateral Tolerance | Longitudinal Tolerance | Vertical Tolerance | Angular Tolerance | Approach Speed | Contact Type |
|----------|-----------------|-------------------|----------------------|-------------------|------------------|---------------|-------------|
| Belt loader | Cargo door sill | +-5 cm | +-5 cm | +-3 cm (conveyor height) | +-2 deg yaw | 0.05 m/s final | Near-contact |
| Container loader | Cargo door sill | +-5 cm | +-5 cm | +-2 cm (platform) | +-1.5 deg yaw | 0.05 m/s final | Near-contact |
| Pushback tug (towbarless) | Nose landing gear | +-10 cm lateral | +-15 cm longitudinal | N/A (cradle adjusts) | +-3 deg yaw | 0.1 m/s final | Full contact/lift |
| Pushback tug (towbar) | NLG tow fitting | +-5 cm (pin alignment) | +-5 cm | N/A | +-2 deg yaw | 0.05 m/s final | Mechanical coupling |
| Fuel truck / hydrant cart | Underwing fuel panel | +-30 cm (hose reach compensates) | +-30 cm | N/A | +-5 deg yaw | 0.1 m/s final | Parked, hose connected manually |
| Catering truck | Service door | +-5 cm lateral | +-10 cm longitudinal | +-2 cm (scissor lift) | +-1 deg yaw | 0.05 m/s final | Platform-to-sill contact |
| Passenger stairs | PAX door | +-5 cm lateral | +-5 cm longitudinal | +-3 cm (top step) | +-2 deg yaw | 0.05 m/s final | Contact (handrail to sill) |
| GPU (ground power) | Electrical panel | +-20 cm (cable reach) | +-20 cm | N/A | +-5 deg yaw | 0.1 m/s final | Parked, cable connected |
| Baggage cart train | Conveyor belt end | +-15 cm | +-20 cm | N/A | +-5 deg yaw | 0.1 m/s final | Near-contact |

### 1.3 What Makes Airside Docking Uniquely Hard

Compared to warehouse or factory docking (where AGVs routinely achieve +-1 cm precision), airside docking presents additional challenges:

1. **Non-standardized targets**: Aircraft parking positions vary by stand. Even the same aircraft type parks with +-0.5 m lateral variation and +-1.0 m longitudinal variation relative to the stand centerline. The docking target is not fixed infrastructure -- it is a parked aircraft whose exact position must be measured each time.
2. **Environmental degradation**: Rain, fog, jet exhaust, de-icing fluid spray, and nighttime darkness degrade sensor performance precisely when precision matters most.
3. **Dynamic obstacles**: Ground crew, other GSE, fueling hoses, and boarding bridges create a cluttered environment around the aircraft that changes second by second.
4. **Non-rigid targets**: Aircraft fuselage flexes under loading. A fully loaded wing drops 10-30 cm compared to empty. Cargo doors shift slightly as cargo is loaded.
5. **Wind loading**: Crosswinds above 15 knots affect vehicle positioning, especially for tall vehicles like catering trucks with extended scissor lifts (high center of gravity, large sail area).
6. **Surface conditions**: Apron surfaces are often wet, oily, or covered in de-icing fluid, affecting tire traction and making precise low-speed maneuvers more difficult.
7. **No GPS precision**: RTK-GPS provides +-2 cm in open sky, but under aircraft wings and near terminal buildings, multipath degrades accuracy to +-10-50 cm -- precisely the zone where centimeter precision is needed.

---

## 2. Two-Phase Approach: Coarse Navigation to Fine Docking

### 2.1 Phase Architecture

The fundamental insight for autonomous docking is that the problem naturally decomposes into two phases with radically different requirements:

```
Phase 1: Coarse Navigation (Global/Frenet Planner)
  - From: Current position (anywhere on apron)
  - To: "Docking approach point" 3-5m from target
  - Tolerance: +-0.5m lateral, +-1.0m longitudinal
  - Speed: Up to 25 km/h en route, decelerating to 5 km/h
  - Sensors: GTSAM localization (LiDAR + IMU + RTK + wheel odometry)
  - Planner: Frenet sampling (420 candidates/cycle) or A* on lane graph
  - Frame rate: 10 Hz

Phase 2: Fine Docking (Local Precision Controller)
  - From: Docking approach point (3-5m from target)
  - To: Final docking position
  - Tolerance: +-2-10cm (GSE-type dependent)
  - Speed: 0.5-2.0 km/h, creep to 0.05-0.1 m/s final
  - Sensors: Visual servoing + LiDAR ICP + ultrasonics + fiducials
  - Controller: MPC or visual servo law, 20-50 Hz
  - Frame rate: 20-50 Hz (higher than navigation loop)
```

The handoff between phases occurs at a **docking approach point (DAP)** defined relative to the detected target. The DAP is chosen such that: (a) the target is visible to all docking sensors, (b) there is a clear, obstacle-free corridor to the final position, and (c) the vehicle heading is roughly aligned (within +-10 degrees) with the required docking heading.

### 2.2 Docking Approach Point Selection

The DAP is not a fixed offset from the aircraft. It is computed dynamically based on the actual aircraft position (measured by GTSAM localization or LiDAR detection) and the stand layout:

```
DAP_belt_loader:
  - 4m aft of cargo door centerline (longitudinal)
  - 3m outboard (lateral clearance for conveyor swing)
  - Heading: perpendicular to fuselage axis +-5 deg
  
DAP_pushback_tug:
  - 5m ahead of nose gear on extended centerline
  - 0m lateral offset (aligned with NLG centerline)
  - Heading: aligned with aircraft longitudinal axis
  
DAP_catering_truck:
  - 4m outboard of service door
  - Aligned with door longitudinal position
  - Heading: perpendicular to fuselage
```

### 2.3 Phase Transition Logic

The transition from Phase 1 to Phase 2 is guarded by a set of preconditions:

1. **Position**: Vehicle within 5m of DAP (measured by GTSAM localization).
2. **Heading**: Within +-10 degrees of required docking heading.
3. **Speed**: Below 5 km/h and decelerating.
4. **Target visibility**: Docking sensor (camera / close-range LiDAR) has acquired the target with confidence > 0.9.
5. **Obstacle clearance**: No dynamic obstacles in the docking corridor.
6. **Personnel clear**: No detected persons within the docking exclusion zone (see Section 9).

If any precondition fails during Phase 2, the controller reverts to Phase 1 for repositioning. This conservative behavior is essential -- there is no "pushing through" a failed docking attempt.

### 2.4 Relationship to Existing Frenet Planner

Phase 1 uses the existing Aurrigo Frenet planner (see `technology/planning/frenet-planner-augmentation.md`) with a modified terminal condition. Instead of following a lane indefinitely, the planner targets the DAP as a terminal state with specified position and heading. The 420-candidate sampling naturally handles obstacle avoidance during approach. The Frenet planner's lateral offset capability is particularly useful: the DAP may require a specific lateral offset from the reference path to position for a perpendicular docking approach.

---

## 3. Visual Servoing for Final Approach

### 3.1 Visual Servoing Fundamentals

Visual servoing (VS) uses real-time visual feedback to control robot/vehicle motion. For docking, the camera observes the target (cargo door, nose gear, fiducial marker) and the controller drives the vehicle to minimize the error between the current and desired visual observation.

Two fundamental approaches:

**Image-Based Visual Servoing (IBVS)**

- Control law operates directly in image space (pixel coordinates).
- Error = (current image features) - (desired image features).
- Does not require 3D reconstruction or target model.
- Inherently robust to camera calibration errors and target model errors.
- Can exhibit unintuitive 3D trajectories (camera retreat, orbital motions).
- Well-suited for planar targets at close range.

**Position-Based Visual Servoing (PBVS)**

- Extracts 3D pose of target from image, then controls in Cartesian space.
- Error = (current 3D pose) - (desired 3D pose).
- Requires accurate camera calibration and target 3D model.
- Produces straight-line 3D trajectories (more predictable for vehicles).
- Sensitive to calibration errors -- small errors in camera-to-vehicle transform propagate.
- Better for large initial offsets where IBVS might produce erratic motions.

**Recommendation for airside docking**: Use PBVS for the 3-5m to 1m range (predictable straight-line approach) and switch to IBVS for the final 1m (robust to accumulated calibration errors at close range where precision matters most).

### 3.2 Camera Configuration

**Eye-in-hand**: Camera mounted on the vehicle, looking at the target.
- Natural for approaching a static target (aircraft door).
- Target grows in image as vehicle approaches -- field of view narrows.
- Risk of losing target at very close range.

**Eye-to-hand**: Camera mounted on fixed infrastructure or aircraft, looking at the vehicle.
- Uncommon for GSE (would require cameras on aircraft or ground infrastructure).
- However, CCTV cameras on stands or boarding bridges could serve this role for cooperative localization.

**Practical setup for Aurrigo vehicles**: Mount a forward-facing docking camera (1080p, 90-degree FOV, global shutter) on the docking interface -- the conveyor head of a belt loader, the front face of a pushback tug below the NLG cradle, or the platform edge of a catering lift. This camera sees the target throughout the approach. A wider-angle secondary camera (120-150 degree FOV) provides situational awareness and target acquisition at greater range.

### 3.3 Visual Servoing Controller

The classic PBVS control law for a non-holonomic vehicle:

```python
"""
Position-Based Visual Servoing (PBVS) Controller for GSE Docking.

Computes velocity commands to drive the vehicle toward a target pose
estimated from camera observations (fiducial markers, template matching,
or LiDAR-camera fusion).

Assumes unicycle/bicycle kinematic model with (v, omega) control.
"""

import numpy as np
from dataclasses import dataclass
from typing import Tuple, Optional


@dataclass
class DockingTarget:
    """Target pose in vehicle body frame."""
    x: float       # Forward distance to target (m)
    y: float       # Lateral offset to target (m), positive = left
    theta: float   # Heading error (rad), positive = target is to the left
    confidence: float  # Detection confidence [0, 1]


@dataclass
class DockingParams:
    """Tunable parameters for the docking controller."""
    # Gains
    k_rho: float = 0.3       # Forward gain (m/s per m distance)
    k_alpha: float = 0.8     # Steering gain for heading-to-target
    k_beta: float = -0.15    # Steering gain for final heading alignment
    
    # Limits
    v_max: float = 0.5       # Max forward speed during docking (m/s)
    v_min: float = 0.02      # Creep speed for final approach (m/s)
    omega_max: float = 0.3   # Max yaw rate (rad/s)
    
    # Thresholds
    dist_slow: float = 1.5   # Distance to begin slowing (m)
    dist_creep: float = 0.3  # Distance to enter creep mode (m)
    dist_done: float = 0.05  # Position tolerance for "docked" (m)
    theta_done: float = 0.02 # Heading tolerance for "docked" (rad)
    
    # Safety
    min_confidence: float = 0.8   # Minimum detection confidence to continue
    abort_lateral: float = 0.5    # Abort if lateral error exceeds this (m)


class PBVSDockingController:
    """
    PBVS docking controller using polar coordinate error representation.
    
    Converts Cartesian error (x, y, theta) into polar coordinates (rho, alpha, beta)
    and applies Lyapunov-stable control gains. This formulation handles the
    non-holonomic constraint naturally and guarantees convergence for
    k_rho > 0, k_beta < 0, k_alpha - k_rho > 0.
    """
    
    def __init__(self, params: DockingParams = None):
        self.params = params or DockingParams()
        self._validate_gains()
    
    def _validate_gains(self):
        """Check Lyapunov stability conditions."""
        p = self.params
        assert p.k_rho > 0, "k_rho must be positive"
        assert p.k_beta < 0, "k_beta must be negative"
        assert p.k_alpha - p.k_rho > 0, "k_alpha must exceed k_rho"
    
    def compute_command(
        self, target: DockingTarget
    ) -> Tuple[float, float, bool]:
        """
        Compute (v, omega) velocity commands for docking.
        
        Returns:
            v: Forward velocity (m/s)
            omega: Yaw rate (rad/s)
            docked: True if within position and heading tolerance
        """
        p = self.params
        
        # Safety check: abort if confidence too low
        if target.confidence < p.min_confidence:
            return 0.0, 0.0, False
        
        # Safety check: abort if lateral error too large
        if abs(target.y) > p.abort_lateral:
            return 0.0, 0.0, False
        
        # Polar coordinate error
        rho = np.sqrt(target.x**2 + target.y**2)
        alpha = np.arctan2(target.y, target.x)  # Angle to target
        beta = target.theta - alpha               # Final heading correction
        
        # Wrap angles to [-pi, pi]
        alpha = (alpha + np.pi) % (2 * np.pi) - np.pi
        beta = (beta + np.pi) % (2 * np.pi) - np.pi
        
        # Check if docked
        if rho < p.dist_done and abs(target.theta) < p.theta_done:
            return 0.0, 0.0, True
        
        # Velocity profile: full -> slow -> creep
        if rho > p.dist_slow:
            v_desired = p.v_max
        elif rho > p.dist_creep:
            # Linear ramp from v_max to v_min
            t = (rho - p.dist_creep) / (p.dist_slow - p.dist_creep)
            v_desired = p.v_min + t * (p.v_max - p.v_min)
        else:
            v_desired = p.v_min
        
        # Control law (Lyapunov-based polar coordinates)
        v = p.k_rho * rho
        v = np.clip(v, p.v_min, v_desired)
        
        omega = p.k_alpha * alpha + p.k_beta * beta
        omega = np.clip(omega, -p.omega_max, p.omega_max)
        
        return float(v), float(omega), False
    
    def compute_bicycle_command(
        self, target: DockingTarget, wheelbase: float = 2.5
    ) -> Tuple[float, float, bool]:
        """
        Convert (v, omega) to bicycle model (v, steering_angle).
        
        For Aurrigo vehicles with Ackermann steering:
          steering_angle = arctan(wheelbase * omega / v)
        """
        v, omega, docked = self.compute_command(target)
        
        if docked or abs(v) < 1e-6:
            return v, 0.0, docked
        
        # Bicycle model: delta = arctan(L * omega / v)
        steering_angle = np.arctan2(wheelbase * omega, v)
        
        # Clamp steering angle (typical max +-35 degrees)
        max_steer = np.radians(35.0)
        steering_angle = np.clip(steering_angle, -max_steer, max_steer)
        
        return float(v), float(steering_angle), docked
```

### 3.4 Target Detection for Visual Servoing

The visual servoing controller requires a continuous stream of target pose estimates. For each GSE type, different visual features serve as the target:

| GSE Type | Visual Target | Detection Method | Typical Accuracy (at 2m) |
|----------|--------------|-----------------|------------------------|
| Belt loader | Cargo door frame edges | Edge detection + template matching | +-3 cm |
| Pushback tug | Nose wheel assembly | Trained detector (YOLO/CenterPoint) + keypoint | +-5 cm |
| Catering truck | Service door frame | Edge detection + AprilTag (if installed) | +-2 cm |
| Fuel truck | Underwing fuel panel markings | Color segmentation + template | +-10 cm |
| Passenger stairs | PAX door frame | Edge detection + geometric fitting | +-3 cm |

The most reliable approach combines a learned detector (for initial acquisition and coarse localization) with geometric fitting (for sub-pixel refinement). A YOLO-v8 nano model running at 30 FPS on Orin can detect and classify the target interface, after which classical computer vision (Canny edges, Hough lines, template matching) refines the pose estimate.

---

## 4. LiDAR-Based Fine Alignment

### 4.1 Why LiDAR for Docking

Aurrigo vehicles already carry 4-8 RoboSense LiDARs (RSHELIOS and RSBP -- see `20-av-platform/sensors/robosense-lidar.md`). While primary LiDAR is used for GTSAM localization and obstacle detection, the dense point clouds from close-range LiDAR returns provide excellent geometric information for docking:

- **Range accuracy**: RSHELIOS specifies +-2 cm range accuracy at distances under 30m. At 2-5m docking range, effective accuracy is +-1-2 cm.
- **No lighting dependence**: LiDAR works identically in daylight, darkness, and artificial lighting (unlike cameras).
- **Direct 3D measurement**: No monocular depth ambiguity. Point clouds give metric distances directly.
- **Known target geometry**: Aircraft fuselages, cargo doors, and nose gear have well-defined 3D geometry that can be matched against CAD models.

The limitation is angular resolution: at 2m range, the 0.2-degree angular resolution of RSHELIOS produces points spaced ~7 mm apart -- sufficient for the +-5 cm tolerances required, but not for sub-millimeter precision.

### 4.2 ICP-Based Target Alignment

Iterative Closest Point (ICP) registration aligns a scanned point cloud to a known 3D template. For docking, the template is a CAD-derived model of the target interface (cargo door frame, nose gear assembly, service door surround). The ICP algorithm finds the rigid transformation (rotation R, translation t) that minimizes the distance between the scan and the template.

```python
"""
ICP-based fine alignment for GSE docking.

Aligns a LiDAR scan of the aircraft target interface to a pre-stored
3D template model. Returns the 6-DOF pose error for the docking controller.

Uses point-to-plane ICP for faster convergence on planar surfaces
(aircraft fuselage is locally planar).
"""

import numpy as np
from typing import Tuple, Optional
from dataclasses import dataclass


@dataclass
class ICPResult:
    """Result of ICP alignment."""
    translation: np.ndarray   # [dx, dy, dz] in meters
    rotation: np.ndarray      # 3x3 rotation matrix
    rms_error: float          # RMS point-to-plane distance (m)
    num_inliers: int          # Number of matched points
    converged: bool           # Whether ICP converged
    fitness: float            # Fraction of template points matched


def estimate_normals(points: np.ndarray, k: int = 20) -> np.ndarray:
    """
    Estimate surface normals via PCA on k-nearest neighbors.
    For production, use Open3D or PCL implementation.
    """
    from scipy.spatial import cKDTree
    tree = cKDTree(points)
    normals = np.zeros_like(points)
    
    for i in range(len(points)):
        _, idx = tree.query(points[i], k=k)
        neighbors = points[idx]
        cov = np.cov(neighbors.T)
        eigenvalues, eigenvectors = np.linalg.eigh(cov)
        normals[i] = eigenvectors[:, 0]  # Smallest eigenvalue = normal
    
    return normals


def icp_point_to_plane(
    source: np.ndarray,        # Nx3 scan points (in vehicle frame)
    target: np.ndarray,        # Mx3 template points (in target frame)
    target_normals: np.ndarray, # Mx3 template normals
    max_iterations: int = 50,
    tolerance: float = 1e-5,   # Convergence threshold (m)
    max_correspondence_dist: float = 0.2,  # Max match distance (m)
    initial_transform: Optional[np.ndarray] = None  # 4x4 initial guess
) -> ICPResult:
    """
    Point-to-plane ICP registration.
    
    Minimizes sum of (n_i . (T*s_i - t_i))^2 where n_i is the target
    normal at correspondence t_i. This converges ~10x faster than
    point-to-point ICP on planar surfaces like aircraft fuselage.
    
    For production use, replace with Open3D's
    o3d.pipelines.registration.registration_icp() or PCL's
    pcl::IterativeClosestPointWithNormals for GPU-accelerated performance.
    """
    from scipy.spatial import cKDTree
    
    # Apply initial transform if provided
    if initial_transform is not None:
        R_init = initial_transform[:3, :3]
        t_init = initial_transform[:3, 3]
        src = (R_init @ source.T).T + t_init
    else:
        src = source.copy()
    
    R_total = np.eye(3) if initial_transform is None else R_init.copy()
    t_total = np.zeros(3) if initial_transform is None else t_init.copy()
    
    prev_error = float('inf')
    
    for iteration in range(max_iterations):
        # Find correspondences
        tree = cKDTree(target)
        distances, indices = tree.query(src, k=1)
        
        # Filter by max correspondence distance
        mask = distances < max_correspondence_dist
        if np.sum(mask) < 10:
            return ICPResult(
                translation=t_total, rotation=R_total,
                rms_error=float('inf'), num_inliers=0,
                converged=False, fitness=0.0
            )
        
        src_matched = src[mask]
        tgt_matched = target[indices[mask]]
        nrm_matched = target_normals[indices[mask]]
        
        # Point-to-plane linearization: solve for small (R, t)
        # n . (R*s + t - tgt) = 0 => [s x n | n] . [r | t] = n . (tgt - s)
        A = np.zeros((np.sum(mask), 6))
        b = np.zeros(np.sum(mask))
        
        for i in range(len(src_matched)):
            s = src_matched[i]
            n = nrm_matched[i]
            A[i, :3] = np.cross(s, n)
            A[i, 3:] = n
            b[i] = n @ (tgt_matched[i] - s)
        
        # Solve least squares
        result, _, _, _ = np.linalg.lstsq(A, b, rcond=None)
        
        # Extract small rotation (Rodrigues) and translation
        rx, ry, rz = result[:3]
        tx, ty, tz = result[3:]
        
        # Small-angle rotation matrix
        dR = np.array([
            [1, -rz, ry],
            [rz, 1, -rx],
            [-ry, rx, 1]
        ])
        dt = np.array([tx, ty, tz])
        
        # Update
        src = (dR @ src.T).T + dt
        R_total = dR @ R_total
        t_total = dR @ t_total + dt
        
        # Check convergence
        rms = np.sqrt(np.mean(b**2))
        if abs(prev_error - rms) < tolerance:
            break
        prev_error = rms
    
    fitness = np.sum(mask) / len(target)
    
    return ICPResult(
        translation=t_total,
        rotation=R_total,
        rms_error=rms,
        num_inliers=int(np.sum(mask)),
        converged=(abs(prev_error - rms) < tolerance),
        fitness=fitness
    )


class LiDARDockingAligner:
    """
    Manages LiDAR-based alignment for a specific docking target type.
    
    Stores the 3D template, handles point cloud preprocessing (cropping,
    downsampling, normal estimation), and provides continuous pose updates
    to the docking controller.
    """
    
    def __init__(
        self,
        template_points: np.ndarray,
        template_normals: np.ndarray,
        crop_box_min: np.ndarray = np.array([-2.0, -3.0, -1.0]),
        crop_box_max: np.ndarray = np.array([8.0, 3.0, 3.0]),
        voxel_size: float = 0.02  # 2cm downsampling
    ):
        self.template = template_points
        self.template_normals = template_normals
        self.crop_min = crop_box_min
        self.crop_max = crop_box_max
        self.voxel_size = voxel_size
        self.last_transform = None
    
    def crop_and_downsample(self, points: np.ndarray) -> np.ndarray:
        """Crop to region of interest and voxel-downsample."""
        # Crop
        mask = np.all(
            (points >= self.crop_min) & (points <= self.crop_max), axis=1
        )
        cropped = points[mask]
        
        # Voxel downsample (simple grid-based)
        if len(cropped) == 0:
            return cropped
        
        grid = np.floor(cropped / self.voxel_size).astype(int)
        _, unique_idx = np.unique(grid, axis=0, return_index=True)
        return cropped[unique_idx]
    
    def align(self, scan_points: np.ndarray) -> Optional[ICPResult]:
        """
        Run ICP alignment on a new LiDAR scan.
        
        Uses previous transform as initial guess for temporal consistency.
        """
        # Preprocess
        processed = self.crop_and_downsample(scan_points)
        if len(processed) < 50:
            return None
        
        # Use previous result as initial guess (warm start)
        initial = None
        if self.last_transform is not None:
            initial = self.last_transform
        
        result = icp_point_to_plane(
            source=processed,
            target=self.template,
            target_normals=self.template_normals,
            initial_transform=initial
        )
        
        # Store for next iteration
        if result.converged and result.fitness > 0.3:
            T = np.eye(4)
            T[:3, :3] = result.rotation
            T[:3, 3] = result.translation
            self.last_transform = T
        
        return result
```

### 4.3 Template Models

For each aircraft type at each docking interface, a 3D template model is required. These can be sourced from:

1. **Aircraft OEM CAD data**: Boeing and Airbus provide 3D models to ground handlers under NDA. The relevant sections (cargo door surround, nose gear assembly, service door frame) are extracted and simplified to 500-2000 points.
2. **As-built LiDAR scans**: During manual operations, capture high-density LiDAR scans of the target interface from 1-2m range. Average multiple scans to create a consensus template. This captures real-world geometry including wear, repairs, and airline-specific modifications.
3. **Parametric models**: For simple geometry (fuselage cross-section is a near-perfect circle of known radius for each aircraft type), analytical models can generate point clouds. A320 fuselage radius = 1.975m, B737 = 1.88m.

**Template library size**: A fleet serving a typical mid-size airport needs templates for 3-5 aircraft families x 3-5 interface types = 9-25 templates, each ~50 KB. Total library < 2 MB.

### 4.4 Point Cloud Feature Matching

Beyond ICP, learned point cloud features can provide coarse-to-fine alignment:

- **FPFH (Fast Point Feature Histograms)**: Classical descriptor, no training required. Used for initial alignment before ICP refinement. Available in Open3D and PCL.
- **FCGF (Fully Convolutional Geometric Features)**: Learned 3D descriptor, more robust to partial views. Runs at ~50 ms on Orin with TensorRT.
- **GeoTransformer**: Transformer-based registration, state-of-the-art accuracy, but ~200 ms on Orin -- too slow for 20 Hz docking loop. Suitable for initial target acquisition.

**Recommended pipeline**: FPFH for initial coarse alignment (once, at target acquisition) -> point-to-plane ICP for continuous tracking (every frame at 10-20 Hz).

---

## 5. Fiducial Marker Systems

### 5.1 Why Fiducials for Airside Docking

Fiducial markers provide the highest-accuracy, lowest-latency pose estimation for cooperative targets. If markers can be placed on or near the docking interface, they dramatically simplify the perception problem:

- **Known geometry**: The marker's physical dimensions are known exactly, enabling direct PnP (Perspective-n-Point) pose estimation from a single camera image.
- **Unique IDs**: Each marker encodes a unique identifier, eliminating data association ambiguity. Marker ID maps directly to the target type and position.
- **Sub-centimeter accuracy**: At 2m range with a 1080p camera, AprilTag pose estimation achieves +-0.5-1.0 cm translation and +-0.5 degree rotation accuracy.
- **Fast detection**: AprilTag3 runs at 50+ FPS on a single Orin CPU core. ArUco in OpenCV runs at 100+ FPS.

### 5.2 Marker Comparison

| System | Library Size | Detection Speed | Pose Accuracy (2m) | False Positive Rate | Robustness to Occlusion | Notes |
|--------|-------------|----------------|--------------------|--------------------|------------------------|-------|
| AprilTag3 | 48-587 IDs | 50+ FPS (CPU) | +-0.5 cm / +-0.3 deg | 1 in 10^12 | Moderate (needs 60%+ visible) | Best overall. C library, ROS wrapper available |
| ArUco (OpenCV) | 50-1000 IDs | 100+ FPS (CPU) | +-1.0 cm / +-0.5 deg | ~1 in 10^6 | Low | Built into OpenCV. Higher FP rate |
| ChromaTag | 30 IDs | 30 FPS | +-0.5 cm / +-0.3 deg | Very low | Moderate | Color-coded, better in cluttered scenes |
| Custom retroreflective | Unlimited | N/A (LiDAR-based) | +-0.5 cm (range) | Very low | High | Uses LiDAR intensity, works in darkness |

### 5.3 Marker Placement Strategies

**On the aircraft (requires airline/airport cooperation)**:
- Small (10x10 cm) AprilTags near cargo door frames, painted or adhesive.
- Retroreflective tape strips along cargo door sill edges -- visible to LiDAR at high intensity.
- Existing markings: Many aircraft already have yellow/black cargo door edge markings and nose gear centerline markings that can serve as visual features.

**On ground infrastructure**:
- Painted markers on apron surface at known positions relative to the stand centerline. These provide ground-truth references even when the aircraft is not present (for system testing).
- Marker posts at stand boundaries encoding stand ID and aircraft parking reference point.

**On GSE (for cooperative localization)**:
- AprilTags on the GSE chassis visible to stand-mounted cameras. The camera detects the tag, computes the GSE pose, and transmits correction via V2X (see `technology/multi-agent/v2x-protocols-airside.md` planned).

### 5.4 Retroreflective Target System

For LiDAR-based docking, retroreflective targets offer a compelling alternative to visual fiducials:

- **3M Diamond Grade reflective tape** returns LiDAR pulses at 10-50x the intensity of normal surfaces.
- Easy to detect: simple intensity threshold on LiDAR returns identifies retroreflective targets.
- Works in complete darkness and any weather (LiDAR is the sensor, not camera).
- Configurable patterns: L-shaped, T-shaped, or coded patterns of retroreflective tape provide both position and orientation information.
- Extremely low cost: $5-10 per target, $50-100 for a full aircraft docking set.
- Durable: rated for 7-12 years outdoors.

**Intensity-based detection on RoboSense**: Both RSHELIOS and RSBP report per-point intensity. Retroreflective targets produce intensity values > 200 (on 0-255 scale) while typical apron surfaces return 10-80. A simple threshold at intensity > 150 with clustering identifies targets with near-zero false positives.

---

## 6. Sensor Fusion for the Final 2 Meters

### 6.1 Multi-Sensor Architecture for Docking

No single sensor provides sufficient reliability and accuracy for safety-critical docking. The fusion architecture combines complementary modalities:

```
Sensor          Range    Accuracy     Rate    Failure Mode
------          -----    --------     ----    ------------
LiDAR (ICP)     0.5-5m   +-1-2 cm     10 Hz   Wet/reflective surfaces, few returns at <1m
Camera (VS)     0.3-5m   +-0.5-3 cm   30 Hz   Darkness, glare, rain on lens
Fiducial (tag)  0.3-4m   +-0.5-1 cm   30 Hz   Occlusion, distance limit
Ultrasonic      0.02-3m  +-1 cm       20 Hz   Cross-talk, wind, narrow beam
Bumper contact  0 cm     Binary       1 kHz   Only detects contact, not approach
```

### 6.2 Sensor Accuracy at Docking Ranges

| Sensor | 0.1 m | 0.5 m | 1.0 m | 2.0 m | 5.0 m |
|--------|-------|-------|-------|-------|-------|
| RoboSense RSHELIOS (LiDAR) | Unreliable (<min range) | +-1.5 cm | +-1.5 cm | +-2.0 cm | +-2.0 cm |
| RoboSense RSBP (LiDAR) | Unreliable | +-1.0 cm | +-1.5 cm | +-2.0 cm | +-2.0 cm |
| 1080p camera + AprilTag | High distortion | +-0.3 cm | +-0.5 cm | +-1.0 cm | +-3.0 cm |
| 1080p camera + template match | +-5 cm | +-1 cm | +-2 cm | +-3 cm | +-8 cm |
| Ultrasonic (Pepperl+Fuchs UC2000) | +-0.5 cm | +-0.5 cm | +-1.0 cm | +-1.5 cm | Out of range |
| Ultrasonic (MaxBotix MB1240) | +-1 cm | +-1 cm | +-1 cm | +-2 cm | +-3 cm |
| Capacitive proximity (custom) | +-0.1 cm | Out of range | - | - | - |
| Contact bumper switch | Binary | - | - | - | - |

### 6.3 Kalman Filter Fusion

A standard Extended Kalman Filter (EKF) fuses the multi-sensor pose estimates into a single docking state estimate:

**State vector**: `[x, y, theta, v, omega]` -- position, heading, and velocities relative to the docking target.

**Measurement updates**:
- LiDAR ICP: Full pose (x, y, theta) at 10 Hz with covariance from ICP residuals.
- Camera fiducial: Full pose (x, y, theta) at 30 Hz with covariance from PnP reprojection error.
- Ultrasonic: Range-only (x) at 20 Hz per sensor. Multiple sensors at different positions provide lateral information.
- Wheel odometry: Velocity (v, omega) at 100 Hz for dead-reckoning between sensor updates.

**Sensor weighting strategy**: As distance decreases, sensor reliability shifts:
- 2-5m: LiDAR ICP dominant (best geometric accuracy at range).
- 0.5-2m: Camera fiducial dominant (sub-centimeter accuracy, high frame rate).
- 0.1-0.5m: Ultrasonic dominant (reliable at close range where LiDAR has blind zone and camera loses focus).
- <0.1m: Contact sensors + ultrasonic only.

This is implemented by adjusting measurement noise covariance matrices as a function of distance:

```
R_lidar(d) = R_lidar_base * (1 + max(0, 1 - d/0.5)^2 * 10)   # Increase noise below 0.5m
R_camera(d) = R_camera_base * (1 + (d/3.0)^2)                   # Increase noise above 3m
R_ultrasonic(d) = R_ultra_base * (1 + max(0, d/2.0 - 1)^2 * 5) # Increase noise above 2m
```

### 6.4 Degraded Mode Handling

If any sensor fails during docking, the system must either continue with reduced confidence or abort:

| Failed Sensor | Remaining Sensors | Action | Max Speed |
|--------------|-------------------|--------|-----------|
| LiDAR | Camera + Ultrasonic | Continue with wider margins | 0.3 m/s |
| Camera | LiDAR + Ultrasonic | Continue (LiDAR provides pose) | 0.3 m/s |
| Ultrasonic | LiDAR + Camera | Continue but stop at 0.3m (no close-range sensor) | 0.3 m/s, stop at 0.3m |
| LiDAR + Camera | Ultrasonic only | Abort, reposition | 0.0 m/s (abort) |
| All proximity | Contact bumper only | Emergency stop | 0.0 m/s (e-stop) |

---

## 7. Docking Controllers

### 7.1 Model Predictive Control for Non-Holonomic Docking

MPC is the gold standard for precision docking because it naturally handles:
- Non-holonomic constraints (the vehicle cannot move sideways -- unless using crab steering).
- State and input constraints (speed limits, steering limits, exclusion zones).
- Preview/prediction of the trajectory before executing it.
- Smooth, jerk-limited trajectories that minimize mechanical stress.

For airside docking, a short-horizon MPC (N = 10-20 steps, dt = 0.1s, horizon = 1-2 seconds) balances responsiveness with computational tractability.

```python
"""
MPC-based Docking Controller for Non-Holonomic GSE Vehicles.

Uses a bicycle kinematic model and solves a constrained optimization
problem at each timestep to produce smooth, precise docking trajectories.

Requires: casadi (pip install casadi) for efficient NLP solving on Orin.
CasADi uses IPOPT internally and generates efficient C code.
"""

import numpy as np
from typing import Tuple, List, Optional
from dataclasses import dataclass

# In production, use CasADi for real-time MPC:
# import casadi as ca


@dataclass
class MPCDockingConfig:
    """MPC controller configuration."""
    # Model
    wheelbase: float = 2.5        # Vehicle wheelbase (m) -- ADT3
    
    # Horizon
    N: int = 15                   # Prediction horizon (steps)
    dt: float = 0.1               # Timestep (s)
    
    # State bounds
    v_max: float = 0.5            # Max docking speed (m/s)
    v_min: float = -0.1           # Allow slight reverse for corrections
    steer_max: float = 0.61       # Max steering angle (35 deg, rad)
    
    # Input rate bounds (smoothness)
    dv_max: float = 0.3           # Max acceleration (m/s^2)
    dsteer_max: float = 0.3       # Max steering rate (rad/s)
    
    # Cost weights
    w_x: float = 50.0             # Lateral position error weight
    w_y: float = 50.0             # Longitudinal position error weight
    w_theta: float = 30.0         # Heading error weight
    w_v: float = 1.0              # Velocity cost (prefer slow)
    w_steer: float = 5.0          # Steering effort cost
    w_dv: float = 10.0            # Acceleration smoothness
    w_dsteer: float = 20.0        # Steering rate smoothness
    w_terminal: float = 100.0     # Terminal cost multiplier


class MPCDockingController:
    """
    Receding-horizon MPC for precision docking.
    
    Solves at each timestep:
      min sum_{k=0}^{N-1} stage_cost(x_k, u_k) + terminal_cost(x_N)
      s.t. x_{k+1} = f(x_k, u_k)     -- bicycle kinematics
           u_min <= u_k <= u_max       -- input bounds
           |du_k| <= du_max            -- rate bounds
           h(x_k) <= 0                 -- obstacle constraints
    
    State: [x, y, theta] relative to docking target
    Input: [v, delta] velocity and steering angle
    
    On Orin with CasADi/IPOPT: ~2-5 ms per solve for N=15.
    """
    
    def __init__(self, config: MPCDockingConfig = None):
        self.cfg = config or MPCDockingConfig()
        self.prev_v = 0.0
        self.prev_steer = 0.0
        self._warmstart_x = None
        self._warmstart_u = None
    
    def bicycle_dynamics(
        self, state: np.ndarray, control: np.ndarray
    ) -> np.ndarray:
        """
        Bicycle kinematic model discrete update.
        
        state: [x, y, theta]
        control: [v, delta]
        """
        x, y, theta = state
        v, delta = control
        L = self.cfg.wheelbase
        dt = self.cfg.dt
        
        x_next = x + v * np.cos(theta) * dt
        y_next = y + v * np.sin(theta) * dt
        theta_next = theta + (v / L) * np.tan(delta) * dt
        
        return np.array([x_next, y_next, theta_next])
    
    def solve(
        self,
        current_state: np.ndarray,     # [x, y, theta] relative to target
        target_state: np.ndarray = None, # [0, 0, 0] by default
        obstacles: Optional[List[np.ndarray]] = None  # List of [x, y, radius]
    ) -> Tuple[float, float, np.ndarray]:
        """
        Solve the MPC problem and return the first control input.
        
        Returns:
            v: Velocity command (m/s)
            delta: Steering angle command (rad)
            predicted_trajectory: Nx3 predicted states for visualization
        
        NOTE: This is a simplified sequential QP implementation for
        illustration. Production code should use CasADi with IPOPT or
        acados for real-time certified MPC solving.
        """
        cfg = self.cfg
        
        if target_state is None:
            target_state = np.array([0.0, 0.0, 0.0])
        
        # Initialize with previous solution (warm start) or straight line
        if self._warmstart_u is not None:
            # Shift previous solution
            u_traj = np.roll(self._warmstart_u, -1, axis=0)
            u_traj[-1] = u_traj[-2]  # Repeat last input
        else:
            u_traj = np.zeros((cfg.N, 2))
        
        # Simple iterative optimization (in production, use CasADi)
        best_cost = float('inf')
        best_u = u_traj.copy()
        
        for iteration in range(5):  # SQP-like iterations
            # Forward simulate
            x_traj = np.zeros((cfg.N + 1, 3))
            x_traj[0] = current_state
            for k in range(cfg.N):
                x_traj[k + 1] = self.bicycle_dynamics(x_traj[k], u_traj[k])
            
            # Compute cost and gradient (simplified)
            total_cost = 0.0
            for k in range(cfg.N):
                err = x_traj[k] - target_state
                total_cost += (
                    cfg.w_x * err[0]**2 +
                    cfg.w_y * err[1]**2 +
                    cfg.w_theta * err[2]**2 +
                    cfg.w_v * u_traj[k, 0]**2 +
                    cfg.w_steer * u_traj[k, 1]**2
                )
                # Input rate costs
                if k > 0:
                    du = u_traj[k] - u_traj[k - 1]
                    total_cost += cfg.w_dv * du[0]**2 + cfg.w_dsteer * du[1]**2
            
            # Terminal cost (heavier)
            err_N = x_traj[cfg.N] - target_state
            total_cost += cfg.w_terminal * (
                cfg.w_x * err_N[0]**2 +
                cfg.w_y * err_N[1]**2 +
                cfg.w_theta * err_N[2]**2
            )
            
            # Obstacle avoidance cost
            if obstacles is not None:
                for obs in obstacles:
                    for k in range(cfg.N + 1):
                        dist = np.sqrt(
                            (x_traj[k, 0] - obs[0])**2 +
                            (x_traj[k, 1] - obs[1])**2
                        )
                        if dist < obs[2] + 0.5:  # 0.5m safety buffer
                            total_cost += 1e4 * (obs[2] + 0.5 - dist)**2
            
            # Gradient descent on controls (simplified)
            if total_cost < best_cost:
                best_cost = total_cost
                best_u = u_traj.copy()
            
            # Numerical gradient (in production, CasADi provides analytic)
            eps = 1e-3
            grad = np.zeros_like(u_traj)
            for k in range(cfg.N):
                for j in range(2):
                    u_plus = u_traj.copy()
                    u_plus[k, j] += eps
                    # Recompute cost with perturbation
                    x_temp = np.zeros((cfg.N + 1, 3))
                    x_temp[0] = current_state
                    for kk in range(cfg.N):
                        x_temp[kk + 1] = self.bicycle_dynamics(
                            x_temp[kk], u_plus[kk]
                        )
                    cost_plus = 0.0
                    for kk in range(cfg.N):
                        err_k = x_temp[kk] - target_state
                        cost_plus += (
                            cfg.w_x * err_k[0]**2 +
                            cfg.w_y * err_k[1]**2 +
                            cfg.w_theta * err_k[2]**2
                        )
                    err_t = x_temp[cfg.N] - target_state
                    cost_plus += cfg.w_terminal * (
                        cfg.w_x * err_t[0]**2 +
                        cfg.w_y * err_t[1]**2 +
                        cfg.w_theta * err_t[2]**2
                    )
                    grad[k, j] = (cost_plus - total_cost) / eps
            
            # Update
            lr = 0.01 / (1 + iteration)
            u_traj = u_traj - lr * grad
            
            # Enforce constraints
            u_traj[:, 0] = np.clip(u_traj[:, 0], cfg.v_min, cfg.v_max)
            u_traj[:, 1] = np.clip(u_traj[:, 1], -cfg.steer_max, cfg.steer_max)
            
            # Rate constraints
            for k in range(1, cfg.N):
                dv = u_traj[k, 0] - u_traj[k - 1, 0]
                ds = u_traj[k, 1] - u_traj[k - 1, 1]
                u_traj[k, 0] = u_traj[k - 1, 0] + np.clip(
                    dv, -cfg.dv_max * cfg.dt, cfg.dv_max * cfg.dt
                )
                u_traj[k, 1] = u_traj[k - 1, 1] + np.clip(
                    ds, -cfg.dsteer_max * cfg.dt, cfg.dsteer_max * cfg.dt
                )
        
        # Store for warm start
        self._warmstart_u = best_u
        
        # Forward simulate best trajectory for visualization
        x_pred = np.zeros((cfg.N + 1, 3))
        x_pred[0] = current_state
        for k in range(cfg.N):
            x_pred[k + 1] = self.bicycle_dynamics(x_pred[k], best_u[k])
        self._warmstart_x = x_pred
        
        # Return first control
        v_cmd = float(best_u[0, 0])
        delta_cmd = float(best_u[0, 1])
        
        return v_cmd, delta_cmd, x_pred
```

### 7.2 Impedance Control for Physical Contact

Pushback tug docking is unique among GSE operations because the success criterion is physical contact and mechanical coupling with the aircraft nose gear. The tug must:

1. Approach the nose gear until the hydraulic cradle contacts the tire.
2. Apply controlled forward force to seat the tire in the cradle.
3. Lift the nose gear assembly (20-50 kN depending on aircraft type).

This requires **impedance control** -- the vehicle behaves as a mass-spring-damper system relative to the contact point:

```
F_applied = K * (x_desired - x_actual) + D * (v_desired - v_actual) + M * a_desired

Where:
  K = stiffness (N/m) -- how aggressively to push toward target
  D = damping (N*s/m) -- how much to resist velocity deviations
  M = virtual mass (kg) -- inertia of the controlled response
```

**Parameter tuning for nose gear coupling**:
- K = 500-2000 N/m (soft approach, firm seating).
- D = 1000-5000 N*s/m (overdamped to prevent oscillation/bouncing).
- M = 500-2000 kg (virtual mass, slower response than actual vehicle mass for safety).

The impedance controller transitions through phases:
1. **Free approach** (>0.3m): Standard position control, no impedance.
2. **Soft contact** (0-0.3m): K = 500 N/m, D = 5000 N*s/m. Gentle approach.
3. **Seating** (contact detected): K = 2000 N/m, D = 2000 N*s/m. Push tire into cradle.
4. **Lift**: Hydraulic pressure control (not impedance). Force-controlled lift to target NLG load.

Contact detection uses a combination of: (a) force/torque sensor on the cradle (if equipped), (b) sudden deceleration detected by IMU (>0.5 g longitudinal), (c) motor current spike (proportional to pushing force).

### 7.3 Velocity Profiling for Docking

All docking operations follow a monotonically decreasing velocity profile as the vehicle approaches the target. The profile is parameterized by distance-to-target:

```
Phase             Distance      Speed         Acceleration
-----             --------      -----         ------------
Transit           > 50m         Up to 25 km/h  Normal
Approach          5-50m         5-15 km/h      -0.5 m/s^2
Slow approach     2-5m          1-5 km/h       -0.3 m/s^2
Fine docking      0.5-2m        0.2-1 km/h     -0.1 m/s^2
Creep             0.1-0.5m      0.05-0.2 m/s   -0.05 m/s^2
Final contact     0-0.1m        0.02-0.05 m/s  Coast
```

The creep phase is critical: the vehicle moves at near-walking speed (0.05-0.1 m/s, or 3.6-7.2 m/min) under continuous sensor feedback. At 0.05 m/s, a 0.1-second control loop latency produces only 5 mm of uncontrolled travel -- well within tolerance for +-5 cm docking.

### 7.4 CBF Safety Filter Integration

The docking controller output passes through a Control Barrier Function (CBF) safety filter before reaching actuators (see `technology/planning/safety-critical-planning-cbf.md`). The CBF enforces hard constraints during docking:

- **Aircraft proximity**: Prevent contact above creep speed. The barrier function h(x) = d_aircraft - d_min must remain positive unless in authorized contact phase (pushback coupling).
- **Personnel clearance**: Hard barrier on any detected person. h(x) = d_person - 2.0m. No exceptions during docking.
- **Speed limit**: h(x) = v_max(d) - v. Speed is a function of distance to target.

The CBF-QP solves in <1 ms on Orin (OSQP solver) and adds negligible latency to the docking control loop.

---

## 8. Aircraft-Specific Docking Geometry

### 8.1 Cargo Door Positions

Cargo door positions determine where belt loaders and container loaders must dock. Positions are measured from the aircraft nose tip and are standardized by aircraft type, but there are important variants:

| Aircraft | Door | Position from Nose (m) | Sill Height (m) | Width (m) | Height (m) | Notes |
|----------|------|----------------------|-----------------|-----------|------------|-------|
| **B737-800** | Fwd cargo (bulk) | 16.0 | 1.52 | 1.12 | 0.84 | Bulk loading, no container |
| B737-800 | Aft cargo (bulk) | 25.5 | 1.47 | 1.24 | 0.91 | Primary baggage |
| **A320-200** | Fwd cargo | 12.6 | 1.70 | 1.24 | 1.10 | LD3-45 container compatible |
| A320-200 | Aft cargo | 22.1 | 1.67 | 1.24 | 1.10 | Bulk + containerized |
| **A320neo** | Fwd cargo | 12.6 | 1.70 | 1.24 | 1.10 | Same as A320-200 |
| A320neo | Aft cargo | 22.1 | 1.67 | 1.24 | 1.10 | Same as A320-200 |
| **A330-300** | Fwd cargo | 18.5 | 2.62 | 2.69 | 1.70 | LD3 container |
| A330-300 | Aft cargo | 34.0 | 2.59 | 2.69 | 1.70 | LD3 container |
| A330-300 | Bulk cargo | 43.5 | 2.56 | 1.10 | 0.84 | Loose/bulk only |
| **B777-300ER** | Fwd cargo | 21.0 | 2.64 | 2.69 | 1.70 | LD3 container |
| B777-300ER | Aft cargo | 37.5 | 2.61 | 2.69 | 1.70 | LD3 container |
| B777-300ER | Bulk cargo | 50.0 | 2.56 | 1.10 | 0.84 | Loose/bulk |
| **B787-9** | Fwd cargo | 19.5 | 2.45 | 2.69 | 1.70 | LD3 container |
| B787-9 | Aft cargo | 35.0 | 2.43 | 2.69 | 1.70 | LD3 container |
| B787-9 | Bulk cargo | 47.0 | 2.39 | 1.10 | 0.84 | Loose/bulk |

**Key observation**: Sill heights vary from 1.47m (B737 aft) to 2.64m (B777 fwd). A belt loader's conveyor must adjust height over a ~1.2m range. The height adjustment is typically hydraulic with +-2 cm precision, but the vehicle must position longitudinally so that the conveyor head is centered on the door opening.

### 8.2 Nose Landing Gear Geometry

For pushback tug docking, the critical dimension is the nose gear assembly:

| Aircraft | NLG Track Width (m) | Tire Diameter (m) | Tire Width (m) | Tow Fitting Height (m) | NLG to Nose Tip (m) | Cradle Width Required (m) |
|----------|--------------------|--------------------|----------------|----------------------|---------------------|--------------------------|
| B737 (all) | 0.61 | 0.69 | 0.22 | 0.45 | 3.9 | 0.75-0.85 |
| A320 family | 0.64 | 0.75 | 0.25 | 0.50 | 4.1 | 0.80-0.90 |
| A330 | 0.76 | 1.14 | 0.35 | 0.65 | 5.3 | 0.95-1.10 |
| B777 | 0.76 | 1.14 | 0.35 | 0.70 | 5.5 | 0.95-1.10 |
| B787 | 0.76 | 1.14 | 0.35 | 0.65 | 5.2 | 0.95-1.10 |
| A380 | 0.92 | 1.26 | 0.41 | 0.80 | 7.8 | 1.10-1.30 |

**Coupling sequence for towbarless tug**:
1. Align centerline with NLG centerline (+-10 cm lateral).
2. Drive forward until cradle is under the nose tires.
3. Activate hydraulic cradle to grip and lift the tire assembly.
4. Verify load (weight sensor reads expected NLG weight +-10%).
5. NLG steering is now locked by the cradle -- tug controls aircraft direction.

The critical alignment is **lateral centering**: the cradle must capture both nose wheels symmetrically. For a B737 with 0.61m track width and a 0.85m cradle, the lateral tolerance is approximately +-(0.85 - 0.61)/2 = +-0.12m. For the wider A380, it is +-(1.30 - 0.92)/2 = +-0.19m. These are the absolute limits -- operational tolerance should be half of this for reliable coupling.

### 8.3 Service Door Positions

Catering trucks and cleaning vehicles dock at the service doors:

| Aircraft | Door | Side | Position from Nose (m) | Sill Height (m) | Width (m) | Notes |
|----------|------|------|----------------------|-----------------|-----------|-------|
| B737-800 | L1 (fwd PAX) | Left | 5.9 | 2.69 | 0.86 | Primary catering |
| B737-800 | L2 (aft PAX) | Left | 22.0 | 2.63 | 0.86 | Secondary |
| A320 | Door 1L | Left | 6.0 | 2.78 | 0.81 | Primary catering (galley adjacent) |
| A320 | Door 4L | Left | 28.5 | 2.75 | 0.81 | Aft catering |
| A330 | Door 1L | Left | 7.3 | 3.83 | 1.07 | Upper deck catering |
| B777 | Door 1L | Left | 7.5 | 4.01 | 1.07 | Upper deck catering |

**Catering truck docking challenge**: The scissor lift must extend to match sill heights ranging from 2.6m to 4.0m. The platform must align to within +-5 cm laterally and +-2 cm vertically so that the platform edge meets the door sill cleanly and ground crew can safely roll catering carts across the gap. A misalignment greater than 3 cm vertically creates a trip hazard; greater than 10 cm laterally means the platform does not fully cover the door opening.

### 8.4 Stand Layout Constraints

Aircraft parking stands impose geometric constraints on docking approaches:

- **Lead-in lines**: Painted markings guide the aircraft to the parking position. The aircraft's actual position may deviate from the intended position by up to +-0.5m lateral and +-1.0m longitudinal.
- **Equipment positioning marks**: Many stands have painted outlines showing where each GSE type should park. These are guides, not precision references -- the actual docking target depends on where the aircraft actually parked, not where the paint says it should be.
- **Obstacle clearances**: Boarding bridges, hydrant pits, ground power cabinets, and other fixed infrastructure create constraints on approach paths. A belt loader approaching the aft cargo door must navigate around the fwd belt loader and any containers staged in the loading area.
- **Multi-GSE coordination**: During peak turnaround, 6-12 GSE vehicles may be positioned around a single aircraft simultaneously. The approach corridor for each vehicle must not conflict with other vehicles' positions or approach paths.

---

## 9. Safety During Docking Operations

### 9.1 The Docking Safety Envelope

Docking is the highest-risk phase of any GSE operation because vehicles are moving in close proximity to aircraft (very high-value asset), ground crew (safety-of-life), and other equipment. The safety architecture must be more restrictive than open-apron driving.

### 9.2 Proximity Sensor System

Supplementary proximity sensors beyond the primary perception stack:

| Sensor Type | Mounting | Range | Purpose | Cost |
|-------------|----------|-------|---------|------|
| Ultrasonic (x4-8) | Bumper corners, sides | 0.02-3m | Close-range obstacle detection | $50-200 each |
| Time-of-flight (ToF) | Docking face | 0.01-4m | Precision range to target | $100-300 each |
| Contact bumper strip | Full perimeter | 0 (contact) | Last-resort collision detection | $200-500 per strip |
| Force/torque sensor | Coupling mechanism | N/A | Contact force measurement | $500-2000 |
| Capacitive proximity | Docking face | 0-0.3m | Final millimeter approach | $50-100 each |
| Safety laser scanner | Low-mount, forward | 0.1-30m | Personnel detection in docking zone | $1500-4000 |

### 9.3 Speed and Force Limits

| Phase | Max Speed | Max Kinetic Energy | Max Contact Force | Emergency Stop Distance |
|-------|-----------|-------------------|------------------|----------------------|
| Transit (>50m) | 25 km/h | ~15 kJ (3t vehicle) | N/A | ~5m |
| Approach (5-50m) | 10 km/h | ~2.3 kJ | N/A | ~2m |
| Slow approach (2-5m) | 3 km/h | ~0.2 kJ | N/A | ~0.5m |
| Fine docking (0.5-2m) | 1 km/h | ~0.03 kJ | N/A | ~0.15m |
| Creep (<0.5m) | 0.2 km/h | ~0.001 kJ | N/A | ~0.03m |
| Contact (pushback) | 0.05 m/s | ~3.75 J | 2-5 kN | Immediate |

**Aircraft damage threshold**: Aluminum fuselage skin (2024-T3, 1.2mm) dents under ~50-100 N/cm^2 of localized pressure. At 3 km/h (0.83 m/s), a 3000 kg belt loader has 1.04 kJ of kinetic energy -- enough to cause significant damage if concentrated on a small area. The creep speed of 0.2 km/h (0.056 m/s) reduces kinetic energy to 4.6 J -- unlikely to cause damage even in a direct collision, but still requires soft bumpers and force limiting.

### 9.4 Personnel Exclusion Zones

During autonomous docking, no personnel should be in the zone between the GSE vehicle and the aircraft. However, current operations rely on ground crew being in this zone (to visually verify alignment, connect hoses, etc.). The transition to autonomous docking must handle this:

**Zone definitions**:
- **Red zone (exclusion)**: The corridor between the vehicle's docking face and the aircraft surface, extending 1m on each side. No personnel permitted while vehicle is moving. Detection of any person triggers immediate stop.
- **Yellow zone (caution)**: 2m perimeter around the vehicle's path of travel. Personnel may be present but the vehicle reduces speed and increases monitoring.
- **Green zone (operational)**: Beyond 2m. Normal operations -- ground crew working on other tasks.

**Personnel detection for docking**: The standard PointPillars-based LiDAR detection may miss crouching or kneeling personnel at very close range (they may be below the LiDAR scan plane). Supplementary detection methods:
- Low-mounted safety laser scanner (Sick microScan3 or equivalent): single-plane scan at 0.3m height, 275-degree FOV, certified to IEC 61496 / ISO 13849 PL d. Detects legs/feet of personnel in the docking corridor.
- Thermal camera (FLIR Boson 640): detects body heat regardless of clothing, posture, or lighting.
- Ultrasonic array: detects any object in the close-range blind zone of LiDAR.

### 9.5 Emergency Stop During Docking

Multiple independent e-stop mechanisms:

1. **Software e-stop**: Docking controller detects anomaly (loss of target lock, unexpected obstacle, excessive force), commands zero velocity and brakes.
2. **Safety PLC e-stop**: Hardwired safety circuit monitors contact bumper strips, safety laser scanner, and e-stop buttons. If any trigger fires, power to drive motors is cut at the electrical level, independent of software. Response time: <50 ms from detection to brake application.
3. **Operator e-stop**: Physical button on the vehicle and on the remote operator interface. Directly cuts the safety relay.
4. **Watchdog timeout**: If the docking controller fails to send a heartbeat within 100 ms, the safety PLC assumes software failure and engages brakes.

### 9.6 Docking Abort Criteria

The docking controller must abort and retreat to the DAP if any of these conditions occur:

1. Target lock lost for >0.5 seconds.
2. Lateral error exceeds +-30 cm (risk of hitting fuselage edge or door frame).
3. Any person detected in the red zone.
4. Contact detected before expected (premature collision).
5. Vehicle heading error exceeds +-15 degrees.
6. Any sensor failure (LiDAR dropout, camera failure, ultrasonic timeout).
7. External e-stop command received.
8. Wind speed exceeds 30 knots (for elevated platforms like catering trucks).

After abort, the vehicle reverses slowly (0.1 m/s) to the DAP. A human operator is notified and must authorize a retry or take manual control.

---

## 10. Ackermann and Crab Steering Advantages

### 10.1 ADT3 Steering Modes

The Aurrigo ADT3 features independent steering on all four wheels, enabling three steering modes (see `20-av-platform/drive-by-wire/can-bus-dbw.md` for the steering chain):

1. **Ackermann steering**: Front wheels steer, rear wheels fixed. Standard car-like turning. Used for normal driving.
2. **Crab steering**: All four wheels steer to the same angle. The vehicle translates laterally without changing heading. Unique capability for docking.
3. **Zero-radius (spin) steering**: Left and right wheels steer in opposite directions. The vehicle rotates in place around its center.

### 10.2 Crab Steering for Lateral Docking

Crab steering transforms the docking problem from a non-holonomic constraint problem to a nearly holonomic one:

**Without crab steering (standard Ackermann)**:
- The vehicle cannot move sideways. To correct a 20 cm lateral error at 1m from the target, the vehicle must execute a complex sequence: steer away, drive forward, steer back, drive forward -- multiple maneuvers in a tight space.
- Three-point turns or multi-point repositioning may be needed.
- Minimum turning radius limits the correction achievable in a short distance.
- Not possible to make fine lateral adjustments while maintaining heading.

**With crab steering (ADT3)**:
- Lateral correction is a single motion: steer all wheels to 90 degrees, drive sideways the required distance.
- No heading change during lateral correction -- the vehicle remains perfectly aligned with the target.
- Can approach perpendicular to the fuselage (normal Ackermann) then crab sideways for final alignment.
- Eliminates the need for complex parking-style maneuvers in tight spaces.

### 10.3 Docking Sequence with Crab Steering

```
Step 1: Approach (Ackermann)
  - Drive from current position to DAP using Frenet planner
  - Heading approximately aligned with required docking heading
  
Step 2: Heading Correction (Zero-radius)
  - Rotate in place to achieve exact heading alignment (+-1 degree)
  - No position change needed
  
Step 3: Longitudinal Approach (Ackermann, straight)
  - Drive forward slowly toward target
  - Maintain heading with small corrections
  
Step 4: Lateral Fine Adjustment (Crab)
  - At 1-2m from target, crab sideways to correct lateral offset
  - Continuous camera/LiDAR feedback for alignment
  - No heading change during this maneuver
  
Step 5: Final Approach (Ackermann, straight, creep speed)
  - Drive final 0.5-1m at creep speed
  - All sensors active for final alignment
  
Step 6: Contact/Dock (impedance control or position hold)
  - Make contact (pushback) or hold position (belt loader)
```

This sequence decouples heading, lateral, and longitudinal alignment into independent sequential steps, dramatically simplifying the control problem compared to simultaneous correction with Ackermann-only steering.

### 10.4 MPC with Crab Steering

The MPC formulation extends to crab steering by adding the crab angle as a control input:

**Extended state**: `[x, y, theta]` (unchanged)
**Extended control**: `[v, delta_front, delta_rear]` or equivalently `[v, delta_ackermann, delta_crab]`

In crab mode, `delta_front = delta_rear = delta_crab`, and the kinematic model becomes:

```
x_dot = v * cos(theta + delta_crab)
y_dot = v * sin(theta + delta_crab)
theta_dot = 0  (heading unchanged in pure crab)
```

The MPC optimizer can choose between Ackermann and crab modes by varying the relationship between front and rear steering angles. In practice, it is simpler to define discrete modes and use a state machine to select the mode, then run a mode-specific MPC within each mode.

---

## 11. Implementation with ROS Noetic

### 11.1 Node Architecture

```
                    +-----------------+
                    | /docking_master |  (State machine, Python)
                    +--------+--------+
                             |
             +---------------+---------------+
             |               |               |
    +--------v-------+  +----v----+  +-------v--------+
    | /docking_target |  | /dock   |  | /docking_safety|
    | _detector       |  | _mpc    |  |                |
    | (LiDAR ICP +    |  | (MPC    |  | (Personnel     |
    |  camera VS +    |  |  solver,|  |  detection,    |
    |  fiducial)      |  |  20 Hz) |  |  e-stop, zone  |
    +--------+--------+  +----+----+  |  monitoring)   |
             |               |        +-------+--------+
             |               |                |
             v               v                v
        /docking/target  /cmd_vel or    /docking/safety
        _pose            /cmd_steer     _status
                             |
                    +--------v--------+
                    | /vehicle_control|  (CAN bus interface)
                    +-----------------+
```

### 11.2 ROS Topics

| Topic | Type | Rate | Description |
|-------|------|------|-------------|
| `/docking/state` | `std_msgs/String` | 10 Hz | Current docking state (IDLE, APPROACH, FINE_DOCK, CREEP, CONTACT, DOCKED, ABORT) |
| `/docking/target_pose` | `geometry_msgs/PoseStamped` | 10-30 Hz | Target pose relative to vehicle (from sensor fusion) |
| `/docking/target_confidence` | `std_msgs/Float32` | 10-30 Hz | Detection confidence [0, 1] |
| `/docking/error` | `geometry_msgs/Twist` | 20 Hz | Position and heading error from MPC |
| `/docking/cmd_vel` | `geometry_msgs/Twist` | 20 Hz | Velocity commands from docking controller |
| `/docking/safety_status` | `std_msgs/String` | 10 Hz | Safety status (OK, CAUTION, STOP, ABORT) |
| `/docking/proximity` | `sensor_msgs/Range` | 20 Hz | Ultrasonic range readings |
| `/docking/contact` | `std_msgs/Bool` | 100 Hz | Contact bumper state |

### 11.3 Docking State Machine

```python
#!/usr/bin/env python
"""
ROS Noetic Docking State Machine Node.

Orchestrates the complete docking sequence from approach to contact/dock.
Manages phase transitions, safety checks, and abort/retry logic.
"""

import rospy
import smach
import smach_ros
from geometry_msgs.msg import PoseStamped, Twist
from std_msgs.msg import String, Float32, Bool
from sensor_msgs.msg import Range
import numpy as np
from typing import Optional


class DockingContext:
    """Shared context for all docking states."""
    
    def __init__(self):
        # Parameters
        self.gse_type = rospy.get_param('~gse_type', 'belt_loader')
        self.wheelbase = rospy.get_param('~wheelbase', 2.5)
        self.crab_enabled = rospy.get_param('~crab_enabled', True)
        
        # Tolerances (loaded per GSE type)
        tolerances = {
            'belt_loader':    {'lateral': 0.05, 'longitudinal': 0.05, 'heading': 0.035},
            'pushback_tug':   {'lateral': 0.10, 'longitudinal': 0.15, 'heading': 0.052},
            'catering_truck': {'lateral': 0.05, 'longitudinal': 0.10, 'heading': 0.017},
            'fuel_truck':     {'lateral': 0.30, 'longitudinal': 0.30, 'heading': 0.087},
        }
        tol = tolerances.get(self.gse_type, tolerances['belt_loader'])
        self.tol_lateral = tol['lateral']
        self.tol_longitudinal = tol['longitudinal']
        self.tol_heading = tol['heading']
        
        # State
        self.target_pose = None        # geometry_msgs/PoseStamped
        self.target_confidence = 0.0
        self.safety_status = 'OK'
        self.contact_detected = False
        self.proximity_min = float('inf')
        self.retry_count = 0
        self.max_retries = 3
        
        # Publishers
        self.cmd_pub = rospy.Publisher('/docking/cmd_vel', Twist, queue_size=1)
        self.state_pub = rospy.Publisher('/docking/state', String, queue_size=1)
        
        # Subscribers
        rospy.Subscriber(
            '/docking/target_pose', PoseStamped, self._target_cb
        )
        rospy.Subscriber(
            '/docking/target_confidence', Float32, self._confidence_cb
        )
        rospy.Subscriber(
            '/docking/safety_status', String, self._safety_cb
        )
        rospy.Subscriber(
            '/docking/contact', Bool, self._contact_cb
        )
        rospy.Subscriber(
            '/docking/proximity', Range, self._proximity_cb
        )
    
    def _target_cb(self, msg):
        self.target_pose = msg
    
    def _confidence_cb(self, msg):
        self.target_confidence = msg.data
    
    def _safety_cb(self, msg):
        self.safety_status = msg.data
    
    def _contact_cb(self, msg):
        self.contact_detected = msg.data
    
    def _proximity_cb(self, msg):
        self.proximity_min = min(self.proximity_min, msg.range)
    
    def stop_vehicle(self):
        """Publish zero velocity command."""
        self.cmd_pub.publish(Twist())
    
    def publish_state(self, state_name: str):
        """Publish current docking state."""
        self.state_pub.publish(String(data=state_name))
    
    def get_distance_to_target(self) -> float:
        """Distance to docking target in meters."""
        if self.target_pose is None:
            return float('inf')
        p = self.target_pose.pose.position
        return np.sqrt(p.x**2 + p.y**2)
    
    def get_lateral_error(self) -> float:
        """Lateral offset to target in meters."""
        if self.target_pose is None:
            return float('inf')
        return abs(self.target_pose.pose.position.y)


class IdleState(smach.State):
    """Wait for docking command."""
    
    def __init__(self, ctx: DockingContext):
        smach.State.__init__(
            self, outcomes=['start_docking', 'preempted']
        )
        self.ctx = ctx
    
    def execute(self, userdata):
        self.ctx.publish_state('IDLE')
        rate = rospy.Rate(10)
        
        while not rospy.is_shutdown():
            if self.preempt_requested():
                self.service_preempt()
                return 'preempted'
            
            # Wait for docking trigger (service call or topic)
            if rospy.get_param('/docking/trigger', False):
                rospy.set_param('/docking/trigger', False)
                return 'start_docking'
            
            rate.sleep()
        
        return 'preempted'


class ApproachState(smach.State):
    """Coarse approach to docking approach point (DAP)."""
    
    def __init__(self, ctx: DockingContext):
        smach.State.__init__(
            self,
            outcomes=['at_dap', 'target_lost', 'safety_abort', 'preempted']
        )
        self.ctx = ctx
    
    def execute(self, userdata):
        self.ctx.publish_state('APPROACH')
        rate = rospy.Rate(10)
        
        while not rospy.is_shutdown():
            if self.preempt_requested():
                self.ctx.stop_vehicle()
                self.service_preempt()
                return 'preempted'
            
            # Safety check
            if self.ctx.safety_status in ('STOP', 'ABORT'):
                self.ctx.stop_vehicle()
                return 'safety_abort'
            
            # Target check
            if self.ctx.target_confidence < 0.5:
                self.ctx.stop_vehicle()
                return 'target_lost'
            
            # Check if at DAP (within 3m of target, heading aligned)
            dist = self.ctx.get_distance_to_target()
            if dist < 3.0 and self.ctx.target_confidence > 0.8:
                return 'at_dap'
            
            # During approach, the Frenet planner handles motion.
            # This state only monitors and guards the transition.
            rate.sleep()
        
        return 'preempted'


class FineDockState(smach.State):
    """Fine docking under MPC/visual servoing control."""
    
    def __init__(self, ctx: DockingContext):
        smach.State.__init__(
            self,
            outcomes=[
                'docked', 'creep_phase', 'target_lost',
                'safety_abort', 'preempted'
            ]
        )
        self.ctx = ctx
    
    def execute(self, userdata):
        self.ctx.publish_state('FINE_DOCK')
        rate = rospy.Rate(20)  # 20 Hz for fine control
        
        while not rospy.is_shutdown():
            if self.preempt_requested():
                self.ctx.stop_vehicle()
                self.service_preempt()
                return 'preempted'
            
            # Safety check (every cycle)
            if self.ctx.safety_status in ('STOP', 'ABORT'):
                self.ctx.stop_vehicle()
                return 'safety_abort'
            
            # Target confidence check
            if self.ctx.target_confidence < 0.8:
                self.ctx.stop_vehicle()
                rospy.sleep(0.5)  # Brief wait for reacquisition
                if self.ctx.target_confidence < 0.8:
                    return 'target_lost'
            
            dist = self.ctx.get_distance_to_target()
            lat_err = self.ctx.get_lateral_error()
            
            # Abort if lateral error too large
            if lat_err > 0.30:
                self.ctx.stop_vehicle()
                return 'safety_abort'
            
            # Transition to creep phase
            if dist < 0.5:
                return 'creep_phase'
            
            # MPC controller handles velocity commands via /docking/cmd_vel
            # This state monitors and guards transitions only.
            # The /dock_mpc node runs continuously and publishes commands
            # based on /docking/target_pose.
            
            rate.sleep()
        
        return 'preempted'


class CreepState(smach.State):
    """Final creep to contact/dock position."""
    
    def __init__(self, ctx: DockingContext):
        smach.State.__init__(
            self,
            outcomes=[
                'docked', 'contact', 'target_lost',
                'safety_abort', 'preempted'
            ]
        )
        self.ctx = ctx
    
    def execute(self, userdata):
        self.ctx.publish_state('CREEP')
        rate = rospy.Rate(50)  # 50 Hz for creep phase
        
        while not rospy.is_shutdown():
            if self.preempt_requested():
                self.ctx.stop_vehicle()
                self.service_preempt()
                return 'preempted'
            
            # Safety check
            if self.ctx.safety_status in ('STOP', 'ABORT'):
                self.ctx.stop_vehicle()
                return 'safety_abort'
            
            # Contact detection (pushback tug)
            if self.ctx.contact_detected:
                self.ctx.stop_vehicle()
                return 'contact'
            
            # Target confidence
            if self.ctx.target_confidence < 0.9:
                self.ctx.stop_vehicle()
                return 'target_lost'
            
            # Check if position tolerances met (non-contact docking)
            dist = self.ctx.get_distance_to_target()
            lat_err = self.ctx.get_lateral_error()
            
            if (dist < self.ctx.tol_longitudinal and
                    lat_err < self.ctx.tol_lateral):
                self.ctx.stop_vehicle()
                return 'docked'
            
            # Publish creep velocity (max 0.05 m/s)
            cmd = Twist()
            if self.ctx.target_pose is not None:
                p = self.ctx.target_pose.pose.position
                # Simple proportional creep
                cmd.linear.x = min(0.05, 0.1 * p.x)
                cmd.linear.y = 0.0  # Crab handled by steering mode
            self.ctx.cmd_pub.publish(cmd)
            
            rate.sleep()
        
        return 'preempted'


class DockedState(smach.State):
    """Vehicle is docked. Hold position."""
    
    def __init__(self, ctx: DockingContext):
        smach.State.__init__(
            self, outcomes=['undock', 'safety_abort', 'preempted']
        )
        self.ctx = ctx
    
    def execute(self, userdata):
        self.ctx.publish_state('DOCKED')
        self.ctx.stop_vehicle()
        rate = rospy.Rate(10)
        
        while not rospy.is_shutdown():
            if self.preempt_requested():
                self.service_preempt()
                return 'preempted'
            
            if self.ctx.safety_status == 'ABORT':
                return 'safety_abort'
            
            # Wait for undock command
            if rospy.get_param('/docking/undock', False):
                rospy.set_param('/docking/undock', False)
                return 'undock'
            
            rate.sleep()
        
        return 'preempted'


class AbortState(smach.State):
    """Abort docking and retreat to DAP."""
    
    def __init__(self, ctx: DockingContext):
        smach.State.__init__(
            self, outcomes=['retry', 'give_up', 'preempted']
        )
        self.ctx = ctx
    
    def execute(self, userdata):
        self.ctx.publish_state('ABORT')
        self.ctx.stop_vehicle()
        
        rospy.logwarn(
            f"Docking aborted. Retry {self.ctx.retry_count}/{self.ctx.max_retries}"
        )
        
        # Reverse slowly for 2 seconds
        cmd = Twist()
        cmd.linear.x = -0.1  # Reverse at 0.1 m/s
        rate = rospy.Rate(20)
        for _ in range(40):  # 2 seconds at 20 Hz
            if rospy.is_shutdown():
                return 'preempted'
            self.ctx.cmd_pub.publish(cmd)
            rate.sleep()
        
        self.ctx.stop_vehicle()
        
        # Retry logic
        self.ctx.retry_count += 1
        if self.ctx.retry_count <= self.ctx.max_retries:
            return 'retry'
        else:
            rospy.logerr("Max docking retries exceeded. Requesting operator.")
            return 'give_up'


def build_docking_state_machine() -> smach.StateMachine:
    """Build the complete docking state machine."""
    ctx = DockingContext()
    
    sm = smach.StateMachine(outcomes=['succeeded', 'failed', 'preempted'])
    
    with sm:
        smach.StateMachine.add(
            'IDLE', IdleState(ctx),
            transitions={
                'start_docking': 'APPROACH',
                'preempted': 'preempted'
            }
        )
        
        smach.StateMachine.add(
            'APPROACH', ApproachState(ctx),
            transitions={
                'at_dap': 'FINE_DOCK',
                'target_lost': 'ABORT',
                'safety_abort': 'ABORT',
                'preempted': 'preempted'
            }
        )
        
        smach.StateMachine.add(
            'FINE_DOCK', FineDockState(ctx),
            transitions={
                'docked': 'DOCKED',
                'creep_phase': 'CREEP',
                'target_lost': 'ABORT',
                'safety_abort': 'ABORT',
                'preempted': 'preempted'
            }
        )
        
        smach.StateMachine.add(
            'CREEP', CreepState(ctx),
            transitions={
                'docked': 'DOCKED',
                'contact': 'DOCKED',
                'target_lost': 'ABORT',
                'safety_abort': 'ABORT',
                'preempted': 'preempted'
            }
        )
        
        smach.StateMachine.add(
            'DOCKED', DockedState(ctx),
            transitions={
                'undock': 'IDLE',
                'safety_abort': 'ABORT',
                'preempted': 'preempted'
            }
        )
        
        smach.StateMachine.add(
            'ABORT', AbortState(ctx),
            transitions={
                'retry': 'APPROACH',
                'give_up': 'failed',
                'preempted': 'preempted'
            }
        )
    
    return sm


def main():
    rospy.init_node('docking_master')
    
    sm = build_docking_state_machine()
    
    # Optional: SMACH introspection server for visualization
    sis = smach_ros.IntrospectionServer('docking_sm', sm, '/DOCKING')
    sis.start()
    
    outcome = sm.execute()
    rospy.loginfo(f"Docking state machine finished with outcome: {outcome}")
    
    sis.stop()


if __name__ == '__main__':
    main()
```

### 11.4 Launch File

```xml
<!-- docking.launch -->
<launch>
  <!-- Arguments -->
  <arg name="gse_type" default="belt_loader" />
  <arg name="crab_enabled" default="true" />
  <arg name="wheelbase" default="2.5" />
  <arg name="use_fiducials" default="true" />
  <arg name="use_lidar_icp" default="true" />
  <arg name="use_ultrasonics" default="true" />
  
  <!-- Docking state machine (master) -->
  <node name="docking_master" pkg="aurrigo_docking" type="docking_state_machine.py"
        output="screen">
    <param name="gse_type" value="$(arg gse_type)" />
    <param name="crab_enabled" value="$(arg crab_enabled)" />
    <param name="wheelbase" value="$(arg wheelbase)" />
  </node>
  
  <!-- Target detector (LiDAR ICP + camera + fiducials) -->
  <node name="docking_target_detector" pkg="aurrigo_docking" type="target_detector_node"
        output="screen">
    <param name="use_fiducials" value="$(arg use_fiducials)" />
    <param name="use_lidar_icp" value="$(arg use_lidar_icp)" />
    <param name="template_dir" value="$(find aurrigo_docking)/templates/" />
    <remap from="~pointcloud" to="/rslidar_points" />
    <remap from="~image" to="/docking_camera/image_raw" />
  </node>
  
  <!-- MPC docking controller -->
  <node name="dock_mpc" pkg="aurrigo_docking" type="dock_mpc_node.py"
        output="screen">
    <param name="wheelbase" value="$(arg wheelbase)" />
    <param name="control_rate" value="20.0" />
    <remap from="~target_pose" to="/docking/target_pose" />
    <remap from="~cmd_vel" to="/docking/cmd_vel" />
  </node>
  
  <!-- Docking safety monitor -->
  <node name="docking_safety" pkg="aurrigo_docking" type="docking_safety_node"
        output="screen">
    <param name="use_ultrasonics" value="$(arg use_ultrasonics)" />
    <param name="exclusion_zone_width" value="2.0" />
    <remap from="~scan" to="/safety_scanner/scan" />
    <remap from="~ultrasonic" to="/ultrasonic/ranges" />
  </node>
  
  <!-- Ultrasonic driver (if enabled) -->
  <group if="$(arg use_ultrasonics)">
    <node name="ultrasonic_driver" pkg="aurrigo_drivers" type="ultrasonic_array_node"
          output="screen">
      <param name="port" value="/dev/ttyUSB_ULTRA" />
      <param name="num_sensors" value="6" />
      <param name="rate" value="20.0" />
    </node>
  </group>
  
  <!-- AprilTag detector (if fiducials enabled) -->
  <group if="$(arg use_fiducials)">
    <node name="apriltag_detector" pkg="apriltag_ros" type="apriltag_ros_continuous_node"
          output="screen">
      <remap from="image_rect" to="/docking_camera/image_rect" />
      <remap from="camera_info" to="/docking_camera/camera_info" />
      <rosparam command="load" file="$(find aurrigo_docking)/config/apriltag.yaml" />
    </node>
  </group>
</launch>
```

### 11.5 Integration with Existing Stack

The docking system integrates with the existing Aurrigo stack at several points:

| Integration Point | Existing Component | Interface | Notes |
|-------------------|-------------------|-----------|-------|
| Coarse navigation | Frenet planner | `/move_base` or custom action | Planner drives to DAP |
| Vehicle control | CAN bus DBW interface | `/cmd_vel` or `/cmd_steer` | Same interface as driving |
| Localization | GTSAM | `/localization/pose` | Used for Phase 1 only |
| LiDAR data | RoboSense driver | `/rslidar_points` | Same pointcloud, new consumer |
| Safety | Simplex architecture | `/safety/status` | Docking adds stricter constraints |
| Mission management | Fleet dispatch | Service call / action | Triggers docking sequence |

The key architectural decision is that docking is a **mode** of the existing vehicle controller, not a separate system. When the docking state machine is active, it takes priority over the Frenet planner for velocity commands. The CBF safety filter (see `technology/planning/safety-critical-planning-cbf.md`) operates on docking commands identically to driving commands -- the barrier functions simply have tighter parameters during docking mode.

---

## 12. Key Takeaways

1. **Airside docking tolerances are +-5-10 cm**, 10-100x tighter than open-road driving. Belt loaders and catering trucks require +-5 cm lateral precision; pushback tugs need +-10 cm for nose gear capture.

2. **The two-phase architecture is fundamental**: coarse navigation with the Frenet planner to a docking approach point (DAP) 3-5m from the target, then handoff to a fine docking controller running at 20-50 Hz with dedicated proximity sensors.

3. **No single sensor is sufficient for docking**. LiDAR excels at 1-5m but has a blind zone under 0.5m. Cameras with fiducials achieve +-0.5 cm accuracy at 2m but fail in darkness. Ultrasonics fill the 0.02-2m gap. The fusion architecture shifts sensor weighting as distance decreases.

4. **ICP alignment to known aircraft templates achieves +-1-2 cm accuracy** at docking range, using the same RoboSense LiDARs already on the vehicle. Templates per aircraft type are small (~50 KB) and straightforward to build from LiDAR scans during manual operations.

5. **AprilTag fiducial markers are the highest-accuracy, lowest-latency option** (+-0.5 cm at 2m, 50+ FPS on CPU). If markers can be placed on or near docking interfaces, they simplify the perception problem dramatically. Retroreflective tape targets offer a LiDAR-based alternative that works in complete darkness for +-0.5 cm range accuracy at near-zero cost.

6. **MPC is the gold standard for docking control** because it naturally handles non-holonomic constraints, speed/steering limits, and obstacle avoidance within a preview horizon. CasADi/IPOPT solves the 15-step horizon in 2-5 ms on Orin.

7. **Pushback tug docking is uniquely a contact task** requiring impedance control. The transition from position control to force control at the moment of nose gear contact is the most complex control challenge in airside docking.

8. **Aircraft geometry varies significantly across types**: cargo door sill heights range from 1.47m (B737 aft) to 2.64m (B777 fwd), nose gear track widths range from 0.61m (B737) to 0.92m (A380). The system must store per-type geometry and select the correct template based on aircraft identification.

9. **ADT3's crab steering is a decisive advantage for docking**. It decouples lateral correction from heading, allowing the vehicle to slide sideways for alignment without changing orientation. This eliminates multi-point repositioning maneuvers required by Ackermann-only vehicles and is not available on any competing autonomous GSE platform.

10. **Safety during docking requires defense-in-depth**: software e-stop, hardwired safety PLC monitoring contact bumpers and safety laser scanners, operator e-stop button, and watchdog timeout. At creep speed (0.05 m/s), kinetic energy is under 5 J -- insufficient to damage aircraft, but personnel risk remains and is addressed by exclusion zone enforcement.

11. **Personnel exclusion zones are non-negotiable**: any detected person in the corridor between vehicle and aircraft triggers an immediate stop. Low-mounted safety laser scanners (IEC 61496 certified) catch crouching/kneeling personnel missed by elevated LiDAR.

12. **Velocity profiling follows a strict monotonic decrease** from 25 km/h (transit) to 0.05 m/s (creep). At 0.05 m/s with a 20 Hz control loop, each control cycle covers 2.5 mm -- well within tolerance for +-5 cm docking.

13. **The docking state machine (SMACH) has clear abort criteria**: target lock lost >0.5s, lateral error >30 cm, personnel in exclusion zone, unexpected contact, sensor failure, or external e-stop. After abort, the vehicle retreats to the DAP and an operator is notified. Maximum 3 automatic retries before human takeover is required.

14. **CBF safety filters apply to docking commands** identically to driving commands but with tighter parameters. Aircraft proximity, personnel clearance, and speed-distance barriers are enforced in <1 ms by the OSQP solver on Orin.

15. **GPS is unreliable in the docking zone** due to multipath from aircraft fuselage and terminal building. The fine docking controller must rely entirely on relative sensors (LiDAR, camera, ultrasonics) for the final 3-5m.

16. **Template library maintenance is minimal**: 3-5 aircraft families x 3-5 interface types = 9-25 templates, each <50 KB. New aircraft types require a single supervised scan during manual operations.

17. **Estimated hardware cost per vehicle for docking sensors**: $2,000-5,000 (docking camera + ultrasonic array + contact bumpers + safety laser scanner). The primary LiDARs, compute (Orin), and vehicle control interface are already present.

18. **Estimated development cost**: $50-80K for the complete docking subsystem (target detection, MPC controller, safety monitoring, state machine, per-GSE-type tuning). This is a 3-4 month effort for a team of 2-3 engineers.

19. **Competitive differentiation**: No competing autonomous GSE platform (UISEE, TractEasy, AeroVect) has published details on centimeter-precision docking. UISEE's tractors appear to stop short and rely on manual coupling. TractEasy uses teleop for final positioning. Autonomous docking to full tolerance is an unsolved production problem in the industry.

20. **The docking subsystem is a prerequisite for fully autonomous turnaround operations**. Without it, every GSE vehicle still requires a human for the final 3-5 meters, negating much of the labor savings that justify autonomous GSE deployment.

---

## Cost Estimates

| Component | Development Cost | Hardware Cost (per vehicle) | Timeline |
|-----------|-----------------|---------------------------|----------|
| Target detection (ICP + camera + fiducial) | $15-25K | $500-1500 (docking camera) | 4-6 weeks |
| MPC docking controller | $10-15K | $0 (runs on Orin) | 3-4 weeks |
| Sensor fusion (EKF) | $5-10K | $0 (runs on Orin) | 2-3 weeks |
| Safety monitoring node | $5-10K | $1500-3500 (ultrasonic + bumper + safety scanner) | 2-3 weeks |
| State machine + integration | $5-10K | $0 | 2-3 weeks |
| Aircraft template library | $3-5K | $0 | 1-2 weeks |
| Per-GSE-type tuning + testing | $10-15K | $0 | 3-4 weeks |
| **Total** | **$53-90K** | **$2,000-5,000 per vehicle** | **12-18 weeks** |

---

## References

### Internal Repository
- `technology/planning/frenet-planner-augmentation.md` -- Frenet planner architecture and sampling strategy
- `20-av-platform/sensors/robosense-lidar.md` -- RoboSense RSHELIOS and RSBP specifications
- `20-av-platform/drive-by-wire/can-bus-dbw.md` -- CAN bus interface and ADT3 steering chain
- `operations/airside/pushback-systems.md` -- Pushback operations and tug types
- `technology/planning/safety-critical-planning-cbf.md` -- CBF safety filter architecture

### External
- Chaumette, F. & Hutchinson, S. (2006). "Visual servo control, Part I: Basic approaches." IEEE Robotics & Automation Magazine.
- Besl, P.J. & McKay, N.D. (1992). "A Method for Registration of 3-D Shapes." IEEE PAMI -- ICP algorithm.
- Olson, E. (2011). "AprilTag: A robust and flexible visual fiducial system." IEEE ICRA.
- Werling, M. et al. (2010). "Optimal Trajectory Generation for Dynamic Street Scenarios in a Frenet Frame." IEEE ICRA.
- De Luca, A. et al. (2008). "Feedback control for a nonholonomic car-like robot." In Robot Motion Planning and Control, Springer.
- Hogan, N. (1985). "Impedance Control: An Approach to Manipulation." ASME Journal of Dynamic Systems.
