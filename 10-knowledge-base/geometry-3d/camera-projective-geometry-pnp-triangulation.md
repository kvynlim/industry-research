# Camera Projective Geometry, PnP, and Triangulation

Cameras measure rays, not depth. Projective geometry is the bookkeeping that
connects 3D points, camera intrinsics, camera extrinsics, image measurements,
and multi-view constraints. PnP estimates a camera pose from 3D-to-2D
correspondences; triangulation estimates 3D points from 2D measurements across
known camera poses. Both are first-principles building blocks for calibration,
localization, visual SLAM, and map validation.

---

## 1. Related Docs

- [Camera Imaging, Noise, and Calibration](camera-imaging-noise-calibration.md)
- [Coordinate Frames, Projections, and SE(3)](coordinate-frames-projections-se3.md)
- [Lie Groups SE(3), SO(3), Adjoints, and Jacobians](lie-groups-se3-so3-jacobians.md)
- [Sensor Calibration and Time Synchronization](sensor-calibration-time-synchronization.md)

---

## 2. Why It Matters for AV, Perception, SLAM, and Mapping

| Workflow | Geometry role | AV risk if wrong |
|---|---|---|
| Camera localization | PnP estimates `T_camera_map` from landmarks or map features. | Vehicle appears lane-correct but camera pose is mirrored or behind the scene. |
| Visual odometry | Triangulated tracks create motion constraints. | Low-baseline tracks produce unstable scale and depth. |
| Camera-LiDAR calibration | 3D LiDAR points project into camera pixels through intrinsics and extrinsics. | Object boxes are shifted in image space, corrupting fusion labels. |
| HD map QA | Reprojected poles, signs, lane markings, and landmarks validate map alignment. | System reports false map change because datum, frame, or camera convention is wrong. |
| Data labeling | 3D annotations are projected to image for review and training. | Training labels encode systematic geometry bias. |

---

## 3. Core Math

### 3.1 Pinhole Projection

For a world point `X_w = [X, Y, Z, 1]^T`, the camera transform maps it into
camera coordinates:

```text
X_c = T_c_w * X_w
    = [R_c_w t_c_w] * X_w

x_n = X_c / Z_c
y_n = Y_c / Z_c
```

The intrinsic matrix maps normalized coordinates to pixels:

```text
[u]   [fx  s  cx] [x_n]
[v] = [ 0 fy  cy] [y_n]
[1]   [ 0  0   1] [ 1 ]
```

Most OpenCV camera APIs use the optical camera convention:

```text
x right, y down, z forward
```

That differs from the common ROS vehicle body convention:

```text
x forward, y left, z up
```

The projection model is undefined for points with `Z_c <= 0`; those points are
behind the camera and must fail cheirality checks.

### 3.2 Distortion

Calibration normally estimates distortion parameters in addition to `K`.
Undistort points before applying ideal pinhole epipolar geometry, or pass
distortion coefficients consistently to projection and PnP functions.

For radial-tangential distortion, the normalized point is adjusted before the
intrinsic matrix:

```text
r2 = x^2 + y^2
x_d = x * (1 + k1 r2 + k2 r2^2 + k3 r2^3) + 2 p1 x y + p2 (r2 + 2 x^2)
y_d = y * (1 + k1 r2 + k2 r2^2 + k3 r2^3) + p1 (r2 + 2 y^2) + 2 p2 x y
```

### 3.3 PnP

Perspective-n-Point solves:

```text
minimize over R, t:
sum_i rho( || z_i - project(K, distortion, R * X_i + t) ||^2 )
```

where:

- `X_i` are known 3D points in an object, map, or calibration-target frame.
- `z_i` are measured 2D pixels.
- `R, t` transform those points into the camera frame.
- `rho` is often a robust loss or RANSAC inlier rule.

Common solver families:

| Solver | Use | Notes |
|---|---|---|
| P3P/AP3P | Minimal RANSAC hypothesis. | Needs disambiguation and cheirality checks. |
| EPnP | Fast non-iterative estimate for many correspondences. | Often followed by nonlinear reprojection refinement. |
| Iterative LM/GN | Final maximum-likelihood style refinement. | Needs a good initial pose and correct noise model. |
| IPPE | Planar targets. | Handles planar pose ambiguity better than generic PnP. |

### 3.4 Triangulation

Given two camera matrices:

```text
P1 = K1 [R1 t1]
P2 = K2 [R2 t2]
```

and corresponding pixels `x1`, `x2`, triangulation estimates homogeneous point
`X` such that:

```text
x1 cross (P1 X) = 0
x2 cross (P2 X) = 0
```

A linear DLT triangulation stacks these equations into `A X = 0` and solves by
SVD. The Euclidean point is:

```text
X_euclidean = [X0/X3, X1/X3, X2/X3]
```

Linear triangulation is a useful initializer. A refined estimate minimizes
reprojection error in all views:

```text
minimize_X sum_j || z_j - project(P_j X) ||^2
```

Depth uncertainty grows rapidly when rays are nearly parallel. For stereo with
baseline `b`, focal length `f`, disparity `d`, and disparity noise `sigma_d`:

```text
Z = f * b / d
sigma_Z ~= f * b * sigma_d / d^2
```

Small disparity at long range means large depth uncertainty.

---

## 4. Algorithm Steps

### 4.1 Robust PnP Pose Estimate

1. Normalize or undistort image points using the same calibration used by the
   projection code.
2. Build 2D-to-3D correspondences with point IDs, timestamps, and frame names.
3. Run a minimal solver inside RANSAC using a pixel threshold tied to detection
   noise.
4. Reject hypotheses with negative depths, impossible height, or impossible
   vehicle motion.
5. Refine the best pose using all inliers and nonlinear reprojection error.
6. Report pose, inlier count, residual distribution, and covariance or Hessian
   quality if available.
7. Validate by reprojecting held-out points and checking spatial residual
   patterns across the image.

### 4.2 Multi-View Triangulation

1. Start with calibrated and time-synchronized camera poses.
2. Undistort observations or use a projection model that includes distortion.
3. Triangulate with DLT from the strongest baseline pair or all views.
4. Enforce cheirality: point depth must be positive in every contributing view.
5. Refine by minimizing reprojection error.
6. Filter by triangulation angle, covariance, reprojection residual, and track
   length.
7. Store the point in a documented map or anchor frame, not in a moving camera
   frame.

---

## 5. Implementation Notes

- In OpenCV, `solvePnP` estimates the transform from object/world coordinates
  into the camera frame. Name the output `T_camera_object` or convert it
  immediately.
- Use `solvePnPRansac` when correspondences come from feature matching,
  detector association, or semantic landmarks.
- For planar calibration boards, use a planar-aware method and explicitly
  handle the two-pose ambiguity.
- Do not triangulate raw distorted pixels with an ideal pinhole matrix.
- Use a minimum triangulation angle; one degree can be too small for accurate
  AV-range depth.
- Use double precision for calibration and mapping; pixel residuals are small
  and normal equations can become ill-conditioned.
- Keep image timestamp, exposure midpoint, rolling-shutter model, and vehicle
  pose interpolation together. Geometry cannot fix temporal misalignment.

---

## 6. Failure Modes and Diagnostics

| Symptom | Likely cause | Diagnostic |
|---|---|---|
| PnP solution is behind the target. | Ambiguous minimal solution or transform direction mistake. | Check depths of all 3D points in camera frame and draw axes on the image. |
| Reprojection residual grows near image edges. | Distortion model mismatch or undistorted/raw point mix. | Plot residual vectors by image location. |
| Depth explodes for distant features. | Low disparity or narrow triangulation angle. | Plot depth uncertainty versus triangulation angle. |
| Planar marker pose flips between two orientations. | Planar PnP ambiguity. | Use IPPE-style solver, temporal continuity, or off-plane points. |
| Camera localization is biased after hard braking. | Rolling shutter or timestamp offset. | Compare residuals against image row and vehicle angular velocity. |
| RANSAC finds many inliers but wrong pose. | Repeated structures or map association ambiguity. | Check semantic IDs, spatial distribution, and multiple-hypothesis scores. |

---

## 7. Sources

- OpenCV, "Perspective-n-Point (PnP) pose computation": https://docs.opencv.org/4.x/d5/d1f/calib3d_solvePnP.html
- OpenCV calib3d module documentation: https://docs.opencv.org/4.x/d9/d0c/group__calib3d.html
- Richard Hartley and Andrew Zisserman, "Multiple View Geometry in Computer Vision", Cambridge University Press: https://www.cambridge.org/core/books/multiple-view-geometry-in-computer-vision/0B6F289C78B2B23F596CAA76D3D43F7A
- Hartley and Zisserman book figures and errata, Oxford VGG: https://www.robots.ox.ac.uk/~vgg/hzbook/
- Vincent Lepetit, Francesc Moreno-Noguer, and Pascal Fua, "EPnP: Efficient Perspective-n-Point Camera Pose Estimation": https://www.epfl.ch/labs/cvlab/software/multi-view-stereo/epnp/
- ROS REP-103 camera optical frame convention: https://www.ros.org/reps/rep-0103.html
