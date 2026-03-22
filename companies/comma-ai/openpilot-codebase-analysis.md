# comma.ai openpilot Codebase Analysis

Deep technical analysis of the openpilot codebase, world model architecture, and end-to-end driving implementation. Research conducted March 2026.

---

## 1. Repository Structure

openpilot is structured as a monorepo with three primary top-level directories: `selfdrive/`, `system/`, and `tools/`. The codebase operates as a distributed process architecture where independent daemons communicate via publish-subscribe messaging using Cap'n Proto serialization over zero-copy shared memory IPC.

### `selfdrive/` — The Driving Stack

The core autonomous driving logic. Key subdirectories:

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| `selfdrive/controls/` | 100Hz control loop | `controlsd.py` — main control daemon; `lib/latcontrol_torque.py`, `latcontrol_pid.py`, `latcontrol_angle.py` — lateral controllers; `lib/longcontrol.py` — longitudinal PID; `lib/desire_helper.py` — lane change logic |
| `selfdrive/modeld/` | Vision/ML inference pipeline | `modeld.py` — driving model daemon; `dmonitoringmodeld.py` — driver monitoring; `models/driving_vision.onnx`, `models/driving_policy.onnx` — the two ONNX models; `parse_model_outputs.py` — tensor post-processing; `fill_model_msg.py` — output parsing |
| `selfdrive/selfdrived/` | State machine and event system | `selfdrived.py` — engagement state machine (OpenpilotState: disabled, enabled, softDisabling, overriding, preEnabled); `events.py` — event definitions; `alertmanager.py` — driver alerts |
| `selfdrive/car/` | Vehicle interface abstraction | `card.py` — vehicle I/O daemon; per-manufacturer folders (`honda/`, `toyota/`, `hyundai/`, etc.) each containing `interface.py`, `carstate.py`, `carcontroller.py`, `values.py` |
| `selfdrive/monitoring/` | Driver awareness system | `dmonitoringd.py` — attention/distraction assessment from DM model outputs |
| `selfdrive/ui/` | On-device user interface | C++ Raylib-based rendering; `layouts/` for screen definitions |
| `selfdrive/test/` | Integration testing | `process_replay/` — deterministic replay regression testing; `test_onroad.py` — full system validation |

### `system/` — OS and Infrastructure

| Directory | Purpose |
|-----------|---------|
| `system/manager/` | Process orchestration — `process_config.py` defines ~30 managed processes with CPU budgets and frequencies |
| `system/hardware/` | Hardware abstraction — `hardwared.py`, `fan_controller.py`, `tici/` for comma 3X/four specific code |
| `system/loggerd/` | Data recording — writes rlog.bz2 (full capnproto message logs) and camera HEVC streams |
| `system/athena/` | Cloud connectivity — `athenad.py` websocket connection to comma servers, handles file upload, remote commands |
| `system/updated/` | OTA update management |

### `tools/` — Development and Debugging

| Directory | Purpose |
|-----------|---------|
| `tools/sim/` | Simulator bridge — MetaDrive integration via `run_bridge.py` |
| `tools/replay/` | Drive replay and service mocking |
| `tools/cabana/` | CAN message viewer and plotter |
| `tools/joystick/` | Joystick-based vehicle control for testing |
| `tools/plotjuggler/` | Log visualization |
| `tools/lib/` | Shared libraries for log reading (`logreader.py`) |

### Other Key Directories

- `cereal/` — Cap'n Proto message schemas (`log.capnp`), messaging infrastructure, `services.py` frequency/queue config
- `common/` — Shared utilities: `params.py` (persistent key-value store), `realtime.py` (timing/scheduling), `pid.py` (PID controller base)
- `opendbc/` (submodule → `github.com/commaai/opendbc`) — DBC files, CAN parsing library, car interface code, and **safety firmware** (C code for panda)
- `tinygrad/` (submodule → `github.com/tinygrad/tinygrad`) — ML inference runtime

### Process Communication

All services communicate using the `cereal` messaging framework:
- Built on Cap'n Proto for zero-copy serialization
- `msgq` — custom lock-free single-producer multi-consumer message queue using shared memory ring buffers
- Each message type has a dedicated socket (e.g., `carState`, `modelV2`, `controlsState`)
- `loggerd` subscribes to all messages, writing two log streams (rlog full-fidelity, qlog decimated)

### Key Control Loop (100Hz)

```
card.py (reads CAN → publishes carState)
  → selfdrived.py (event detection → engagement state → publishes selfdriveState)
    → controlsd.py (reads plan + carState → computes steering/accel → publishes carControl)
      → card.py (converts carControl to CAN commands → sends to panda → sends to car)
```

### Vision Pipeline (20Hz)

```
camerad (captures road frames at 20Hz via visionipc)
  → modeld (runs driving_vision.onnx → driving_policy.onnx)
    → plannerd (trajectory planning, publishes modelV2/plan)
      → controlsd (uses plan as input)
```

---

## 2. The Supercombo Model (Now: Vision + Policy Split)

### Historical Architecture

The original "supercombo" model was a single monolithic ONNX file (`supercombo.onnx`) combining perception and planning. It consisted of:
- A ResNet-based convolutional feature extractor
- Fully-connected branches outputting paths, lane lines, road edges, lead cars, etc.
- A GRU block for temporal context across frames

**Legacy supercombo inputs:**
- Two consecutive camera frames in YUV420, reprojected and stacked: tensor shape `(N, 12, 128, 256)`
- Desire input (lane change intent)
- Traffic convention (left-hand vs right-hand drive)
- Previous temporal features (recurrent state)
- Camera calibration angles (roll, pitch, yaw) as 3 x float32

**Legacy supercombo output:** A single 1D tensor with 11,337 elements encoding: predicted driving path (x/y/z coordinates), left lane line, right lane line, road edges, lead car detections (up to 3), pose predictions, and standard deviations for each output.

### Current Architecture (post-0.10): Vision + Policy Split

Starting with openpilot 0.10 ("Tomb Raider" architecture), the monolithic supercombo was split into two separate ONNX models:

**`driving_vision.onnx`** — Off-policy perception model
- Architecture: FastViT (Fast Vision Transformer)
- Input: Two camera views (narrow: 3x128x256, wide: 3x128x256) at 20Hz
- Outputs: Lane lines, road edges, lead car information, ego trajectory prediction
- These outputs are used primarily for visualization and lead car fallback (not part of the e2e policy)
- Produces a 1024-dimensional feature vector for the policy model

**`driving_policy.onnx`** — On-policy temporal planning model
- Architecture: Small Transformer
- Input: Features from the frozen FastViT extractor over the last 2 seconds (at 5 FPS = 10 frames)
- Outputs: Same as vision model plus **next action** (desired curvature and desired longitudinal acceleration)
- Trained on-policy using the World Model simulator (IMPALA-style distributed training)
- Uses multi-hypothesis planning (MHP) loss with 5 hypotheses and heteroscedastic NLL with Laplace prior

**`dmonitoring_model.onnx`** — Driver monitoring
- Input: Single 1440x960 luminance channel image (driver-facing camera)
- Output: 84 x float32 = face pose (12 values), eye openness, gaze direction, attention probability, hand position for two front-seat occupants

### Why the Split Matters

The split enables:
1. The vision model to be trained off-policy (supervised learning on massive labeled data)
2. The policy model to be trained on-policy using the World Model simulator
3. The frozen vision encoder acts as an information bottleneck (~700 bits via Gaussian noise regularization), preventing the policy from exploiting simulator artifacts — solving the "cheater" problem from earlier e2e approaches

---

## 3. The World Model: DiT Architecture

### Evolution

1. **commaVQ era (2023):** VQ-VAE compressing frames into 128 tokens of 10 bits each (shape 1200x8x16 per 1-minute segment at 20 FPS). A GPT model trained on 3M minutes of driving video predicted next tokens. Published at `github.com/commaai/commavq`.

2. **Current era (2025, openpilot 0.11+):** Stable Diffusion VAE + Diffusion Transformer (DiT). This is the architecture described in the CVPR 2025 paper "Learning to Drive from a World Model."

### Where in the Repo

The world model training code is **not** in the openpilot repo. It lives in comma's internal training infrastructure. The openpilot repo contains only:
- The trained ONNX model weights (inference only)
- `selfdrive/modeld/` for running inference
- The commaVQ dataset and earlier world model prototypes at `github.com/commaai/commavq`

The CVPR 2025 paper provides the architecture details:

### Frame Compressor (VAE)

- **Encoder:** Vision Transformer (ViT) with 50M parameters
- **Decoder:** 100M parameters
- Encodes 2 camera views (narrow + wide, each 3x128x256) into a 32x16x32 latent space
- Uses Masked Auto Encoder (MAE) formulation with random patch masking during training
- Training losses: LPIPS (perceptual), adversarial loss, least squares error
- MAE achieves 2.7x better "modelability" versus baseline VAE
- Based on the pretrained Stable Diffusion image VAE (`vae-ft-mse-840000-ema-pruned`) with 8x8 compression factor and 4 latent channels

### Diffusion Transformer (DiT)

**Three size variants (GPT-2 style scaling):**

| Variant | Parameters | Usage |
|---------|-----------|-------|
| Small | 250M | Ablation studies |
| Medium | 500M | Primary experiments in paper |
| Large | 1B | Scaling experiments |
| Production (0.11) | **2B** | Shipped in openpilot 0.11 |

**Production model (2B) specs:**
- 48 Transformer layers
- 25 attention heads
- 1600 embedding dimension
- Trained on **2.5 million minutes** of driving video

**Architecture details:**
- Extends standard DiT to 3D data: input/output patching uses a 3D table, then flattens all 3 dimensions before Transformer blocks
- **Block-causal attention:** Frame-wise triangular causal mask — each token can attend to tokens from its own frame and past frames, but not future frames. This enables autoregressive generation while maintaining spatial context within each frame.
- **AdaLN-single (Adaptive Layer Normalization):** Vehicle poses (6DOF relative positions), world timesteps (frame indices), and diffusion noise timesteps are encoded and injected into the transformer via adaptive layer normalization. Modified to support different conditioning vectors along the time dimension.
- **KV-caching** for efficient inference (achieves 12.2 frames/second/GPU throughput)

**Sampling parameters:**
- 15 Euler steps with delta_tau = 1/15
- Classifier-Free Guidance with strength 2.0
- Context window: 2 seconds (10 frames at 5 Hz)
- Simulation window: 0-7 seconds
- Future anchoring: 1 second of future conditioning at fixed timesteps (tau=0), enabling recovery from prediction drift

**Training formulation — Rectified Flow:**
- Noise sampling: tau ~ Logit-Normal(0.0, 1.0)
- Noising: o_tau = tau * epsilon + (1 - tau) * o
- Combined loss: L = L_RF + alpha * L_T (rectified flow loss + multi-hypothesis planning loss)
- Noise level augmentation applied with probability p=0.3 at world timesteps 1 to T-1

### Action Space

Two continuous values per timestep:
1. **Desired turning curvature** (1/radius in meters)
2. **Desired longitudinal acceleration** (m/s^2)

### Plan Head

A stack of residual feed-forward blocks appended to the dynamics model:
- Predicts ideal driving trajectories
- Trained using human driving paths as ground truth
- Uses 5 hypotheses with heteroscedastic NLL loss and Laplace prior
- Trajectory prediction horizon: 10 seconds

---

## 4. tinygrad: comma's Custom ML Framework

### What It Is

tinygrad (`github.com/tinygrad/tinygrad`) is a minimalist deep learning framework created by George Hotz (comma.ai CEO). It serves as both the training and inference runtime for comma.ai's models.

### Why Not PyTorch?

1. **Size and simplicity:** tinygrad was originally <1000 lines of Python. PyTorch is millions of lines with massive dependency trees. For embedded deployment on a Snapdragon 845, this matters enormously.

2. **Custom kernel compilation:** tinygrad compiles a custom kernel for every operation, allowing extreme shape specialization. All tensors are lazy, enabling aggressive operation fusion.

3. **Hardware portability:** tinygrad has a custom QCOM (Qualcomm Adreno) GPU driver that runs directly on the comma 3X's Snapdragon 845. PyTorch has no equivalent — running PyTorch on Qualcomm mobile GPUs requires going through SNPE/QNN which adds abstraction layers and limits what operations are supported.

4. **End-to-end control:** comma owns the entire stack from training to inference. When tinygrad generates suboptimal code for Adreno, they fix it in tinygrad. When PyTorch generates suboptimal SNPE graphs, you file a ticket with Qualcomm.

5. **Attention support:** SNPE (Qualcomm's own framework) only supports fixed-weight models — no attention mechanisms. tinygrad supports dynamic attention, enabling transformer-based driving models.

6. **Training + inference in one framework:** tinygrad handles both training on their GPU cluster and inference on the comma device. No framework translation step (PyTorch → ONNX → SNPE) needed beyond ONNX as an interchange format.

### Historical Runtime Evolution

```
SNPE (Qualcomm proprietary)
  → thneed (comma's SNPE accelerator wrapper)
    → tinygrad with QCOM driver (current, fully replaced SNPE in 0.9.8)
```

### tinygrad on comma Devices

- Runs driving model and DM model on Snapdragon 845 Adreno 630 GPU
- Image transformation moved to GPU (previously CPU)
- ISP (Image Signal Processor) now handles raw Bayer → YUV conversion (saves 500mW, reduces latency by 10ms)
- External GPU support: tinygrad's USB GPU driver allows plugging a desktop GPU into the comma 3X's auxiliary USB-C port for running larger models

---

## 5. Training Infrastructure

### Hardware

comma.ai operates an in-house compute cluster:
- **~450 GPUs** (mix of consumer and datacenter cards)
- **~5,000 CPUs**
- **~3 petabytes SSD storage**
- **10 Gbit/s interconnects**
- Lower cost than cloud, with full customization control

### tinybox (the tiny corp's training appliance)

comma/tinygrad's commercial GPU appliance for AI training:
- **tinybox red:** 6x AMD Radeon RX 7900 XTX, 144GB GPU RAM, 5.76 TB/s bandwidth — $15,000
- **tinybox green:** 6x NVIDIA RTX 4090 — $25,000
- **tinybox green v2:** 4x NVIDIA RTX 5090
- Full-fabric PCIe 4.0 x16 links between all GPUs
- Two 1600W PSUs

### Training Philosophy

- **24-hour autokill constraint:** Any training job exceeding 24 hours is automatically terminated. Forces iterative efficiency and prevents runaway experiments.
- **Automated training tests:** Tests run at regular intervals throughout model development
- **30-month flat line count:** Despite expanding from ~50 to 300+ supported vehicles, the codebase maintained relatively constant size through aggressive simplification

### Training Data

- **2.5 million minutes** of driving video (for the 2B DiT world model)
- Data collected from openpilot users' comma devices worldwide
- Sampled at 5 Hz for world model training (20 Hz raw capture)
- Includes road-facing cameras, CAN bus data, GPS, IMU, magnetometer, thermal sensors

### Training Process (World Model → Policy)

**Stage 1: Train the World Model (DiT)**
- Input: Driving video segments (1 minute each, at 5 FPS)
- Objective: Rectified Flow diffusion — predict denoised next frames given context + action conditioning
- Dataset: 100k-400k segments for ablations, full corpus for production

**Stage 2: Train the Driving Policy (On-Policy)**
- Architecture: IMPALA-style distributed + asynchronous rollout data collection
- Parallel actors generate driving rollouts in the World Model simulator
- Central learner updates the policy from these rollouts
- Policy learns to predict actions that match what the World Model would do given the history
- Information bottleneck regularization (~700 bits) prevents simulator exploitation
- Trained with action/observation noise injection: lateral lag, longitudinal pitch variations, etc.

---

## 6. Driving Policy: How Trajectory is Generated

### The Pipeline (post-0.10)

```
Camera frames (20Hz)
  → driving_vision.onnx (FastViT: extracts features, lane lines, road edges, leads)
    → Feature vector (1024-dim) feeds into...
      → driving_policy.onnx (small Transformer: 2s context at 5 FPS)
        → Output: desired curvature + desired acceleration
          → controlsd.py (100Hz PID loop converts to steering torque + accel commands)
            → card.py → panda → CAN bus → car actuators
```

### Key Architectural Shift: MPC Removal

**Before 0.10 (Chill + Experimental):**
- The driving model predicted a path a human *would be driving* — this path did not start from the car's current state
- An MPC (Model Predictive Control) solver generated a feasible trajectory from the car's current state to the model's predicted path
- Required careful tuning of MPC cost functions

**After 0.10 ("Tomb Raider"):**
- The model directly predicts trajectories starting from the car's current position
- MPC removed entirely for lateral control (both Chill and Experimental modes)
- MPC removed for longitudinal control in Experimental mode
- Chill mode longitudinal still uses classical lead-following policy with radar fusion

### Lateral Control

Three controller types depending on vehicle capabilities:
- **Torque control** (`latcontrol_torque.py`): Sends steering torque directly — preferred when available
- **Angle control** (`latcontrol_angle.py`): Sends desired steering angle — car's own controller handles torque
- **PID control** (`latcontrol_pid.py`): Legacy PID-based steering — fallback

All receive the desired curvature from the planning pipeline and operate at 100Hz.

### Longitudinal Control

- **Chill mode:** Classical ACC policy using lead detection (from FastViT) + radar fusion. Gas Gating feature uses the e2e model's gas/brake predictions to suppress unnatural acceleration.
- **Experimental mode:** Full e2e longitudinal — the driving model sets speed, handles traffic lights, stop signs, turns. Cruise set speed used only as upper bound.

---

## 7. Safety Layer: Panda Microcontroller

### Hardware

- **Microcontroller:** STM32H725 (ARM Cortex-M7)
- **Protocols:** CAN and CAN FD
- **Communication:** SPI to comma device, CAN to vehicle
- The panda sits physically between the comma device and the car's CAN bus — it is the only path for control messages to reach the car

### What It Enforces

The panda implements a **hardware-level safety layer** independent of the neural network and main processing unit. Three core principles:

1. **Driver must always be paying attention** (enforced by driver monitoring + steering wheel interaction)
2. **Driver must always be able to immediately retake control** (brake pedal and cancel button always work)
3. **Vehicle must not alter trajectory too quickly for safe driver reaction** (actuator rate limiting)

### Safety Modes

Defined in `opendbc/safety/` as C code, with vehicle-specific implementations:

- **`SAFETY_SILENT`** — Default mode at boot. All CAN buses forced silent. No messages can be sent.
- **`SAFETY_ALLOUTPUT`** — Unrestricted CAN transmission. Only available in developer firmware; disabled in release builds.
- **Vehicle-specific modes** (e.g., Honda, Toyota, Hyundai) — Each enforces manufacturer-appropriate limits

### `controls_allowed` State Variable

The critical boolean gate:
- **Enters `true`:** When the driver activates cruise control (car-specific CAN message detected)
- **Exits to `false`:** When the driver presses brake, presses cancel, or any safety violation occurs
- When `false`: No control CAN messages can pass through the panda to the car, regardless of what openpilot requests

### Actuator Limits

- **Lateral:** Constrained per ISO 11270 and ISO 15622 — maximum 0.9 seconds of actuation to achieve a 1-meter lateral deviation
- **Steering torque:** Rate-limited per vehicle (e.g., Toyota has specific Nm/s limits defined in safety C code)
- **Acceleration:** Bounded per vehicle capability and safety margins
- CAN messages restricted to those "designed for ADAS" — the panda will not transmit arbitrary CAN messages

### Heartbeat and Watchdog

- The panda expects periodic heartbeat messages from openpilot
- If heartbeats stop (openpilot crash, cable disconnect), the panda reverts to `SAFETY_SILENT`
- Hardware watchdog timer resets the microcontroller if firmware hangs

### MISRA C Compliance

The safety firmware in `opendbc/safety/` follows:
- **MISRA C:2012** — Automotive coding standard enforced via cppcheck addon
- **ISO 26262** — Functional safety standard
- **Compiler flags:** `-Wall -Wextra -Wstrict-prototypes -Werror`
- **Static analysis:** cppcheck with MISRA C:2012 violation checks
- **100% line coverage** on unit tests
- **Mutation testing** on safety logic — custom runner completing in 30 seconds (replaced third-party `mull` which took 45 minutes)
- **Hardware-in-the-loop testing** validates receiving, sending, and forwarding CAN messages on all buses for every panda variant

### Safety Architecture Independence

Critically: **Functional safety does NOT depend on the neural network or the main processing unit.** It depends only on:
1. Panda firmware (C code, MISRA-compliant)
2. Driver monitoring system
3. The car's own built-in safety systems

The philosophy: "Doing nothing is always a safe option" in a Level 2 system — the panda defaults to silence if anything goes wrong.

---

## 8. Data Pipeline: Car → Cloud → Training

### On-Device Logging

**What gets logged:**
- Road-facing cameras: fcamera.hevc (H.265, 20Hz)
- Wide-road camera: ecamera.hevc
- Driver-facing camera: dcamera.hevc (only if user opts in)
- CAN bus messages (all buses)
- GPS, IMU (gyroscope, accelerometer, magnetometer)
- Thermal sensors
- Crash events
- OS logs

**Segment structure:**
- Routes are divided into 1-minute segments
- Each segment contains: `rlog.bz2` (full capnproto messages), camera HEVC files, `qlog.bz2` (decimated), `qcamera.ts` (low-bitrate preview)
- Segments rotate at ignition on/off boundaries

### Upload Behavior

| Data Type | Upload Behavior |
|-----------|----------------|
| `qlog.bz2` + `qcamera.ts` | Automatically uploaded on Wi-Fi — small enough for any connection |
| `rlog.bz2` + full cameras | Manual upload or Firehose Mode |
| Preview video | Auto-uploaded for comma connect viewing |

### Firehose Mode

Introduced in 0.9.8 to scale data ingestion **100x**:
- Device connects directly to comma backend
- Uploads as much data as possible when on unmetered internet + power
- Fork support (sunnypilot was first fork enabled for training set contribution)
- Enables rapid expansion of training data diversity

### Cloud Infrastructure

- **comma connect** — Web/mobile app for drive management. Free: 3-day retention. Paid subscription: 1-year retention.
- **athenad** — Daemon on device maintaining WebSocket to comma servers. Handles remote file requests, log uploads, remote commands (SSH, firmware updates).
- **comma API** — REST API at `api.comma.ai` for querying routes, segments, device state

### Data Flow to Training

```
Car driving with openpilot
  → loggerd writes segments to device storage
    → athenad uploads qlogs automatically (+ full logs via firehose)
      → comma cloud ingestion pipeline
        → Data selection and curation
          → Training cluster (450 GPUs, 3PB SSD)
            → World model training → Policy training → New ONNX weights
              → OTA update to devices
```

---

## 9. Model Deployment: ONNX + tinygrad Runtime

### Model Format

Models are distributed as ONNX files in the openpilot repo:
- `selfdrive/modeld/models/driving_vision.onnx`
- `selfdrive/modeld/models/driving_policy.onnx`
- `selfdrive/modeld/models/dmonitoring_model.onnx`

ONNX serves as the interchange format between training (tinygrad) and inference (tinygrad).

### Compilation Pipeline

```
Training (tinygrad on GPU cluster)
  → Export to ONNX
    → commit to openpilot repo
      → On-device: tinygrad loads ONNX → compiles to optimized GPU kernels
        → Cached as pickle files (e.g., /tmp/openpilot.pkl)
          → Runs on Qualcomm Adreno 630 GPU (Snapdragon 845)
```

**Key compilation details:**
- `compile3.py` in the tinygrad integration handles ONNX → tinygrad compilation
- Environment flag `QCOM=1` targets the Qualcomm Adreno GPU backend
- Kernels are shape-specialized and operation-fused for maximum throughput
- DM model and driving model both run entirely on GPU (previously DM used DSP)

### Runtime Architecture on Device

```
camerad (ISP: raw Bayer → YUV, 20Hz)
  → visionipc (zero-copy frame sharing)
    → modeld.py
      → tinygrad loads compiled model
      → GPU: image preprocessing (warp, crop, normalize)
      → GPU: driving_vision.onnx inference
      → GPU: driving_policy.onnx inference
      → CPU: parse outputs → publish modelV2 message
```

### Performance Optimizations

- ISP handles raw Bayer → YUV conversion (saves 500mW, reduces latency 10ms vs GPU processing)
- Image transformation runs on GPU (eliminates CPU↔GPU buffer copies)
- Avoids DSP quantization issues (SNPE required INT8, losing precision on important features)
- External GPU support via USB-C: tinygrad USB GPU driver enables plugging desktop GPUs into comma 3X auxiliary port

### Hardware Targets

- **comma 3X / comma four:** Snapdragon 845, Adreno 630 GPU
- **PC:** Any GPU supported by tinygrad (AMD, NVIDIA, Apple Silicon)
- **Future:** External GPU via USB-C for running larger models

---

## 10. Engagement/Disengagement Logic

### State Machine (`selfdrived.py`)

The engagement state is managed by `selfdrived.py` using the `OpenpilotState` enum (defined in cereal's `log.capnp`):

| State | Description |
|-------|-------------|
| `disabled` | System off. No control commands sent. Default state. |
| `preEnabled` | Transitioning to enabled. Brief period for system checks. |
| `enabled` | Actively controlling steering and/or acceleration. |
| `softDisabling` | Gracefully disengaging due to a non-critical event (e.g., driver distraction warning timeout). Ramps down control over ~1-2 seconds. |
| `overriding` | Driver is actively steering against openpilot (gas/brake override detected). |

### Engagement Flow

```
Driver presses cruise control SET/RES button
  → car sends cruise-active CAN message
    → panda detects cruise engagement → sets controls_allowed = true
      → selfdrived.py transitions: disabled → preEnabled → enabled
        → controlsd.py begins sending steering/accel commands through panda
```

### Disengagement Triggers

**Immediate disengagement (→ disabled):**
- Driver presses brake pedal (CAN message detected by panda, immediately clears `controls_allowed`)
- Driver presses cancel button
- Panda communication lost
- Critical system fault (sensor failure, temperature exceeded)

**Soft disengagement (→ softDisabling → disabled):**
- Driver distraction detected by DM system (progressive warnings → eventual disable)
- Model uncertainty too high
- Steering torque intercept by driver beyond threshold

**Events system (`events.py`):**
- Events are categorized by severity: `NO_ENTRY`, `SOFT_DISABLE`, `IMMEDIATE_DISABLE`, `PERMANENT`, `WARNING`
- Each event has associated alerts defined in `alertmanager.py`
- Events flow from multiple sources: driver monitoring, car state, model confidence, system health

### Driver Monitoring Enforcement

```
dmonitoringmodeld.py → dmonitoringd.py → selfdrived.py events
```

- DM model predicts: head pose, eye openness, gaze direction, sunglasses detection, hand position
- `dmonitoringd.py` applies temporal filtering and thresholds
- Progressive alerting: visual warning → audible warning → soft disable
- Sensitivity varies: higher attention required at higher speeds, in experimental mode, when hands off wheel

---

## 11. Experimental → Chill Graduation

### Mode Definitions

**Chill Mode:** Production-quality features. Classical ACC longitudinal with e2e lateral. Designed for reliability.

**Experimental Mode:** Alpha features enabled. Full e2e longitudinal (model controls speed, handles traffic lights, stop signs). Higher disengagement rate expected. Requires more attentive driving.

### How Graduation Works in Code

The mode selection is a user setting stored via `params.py`:
```
# In selfdrive/selfdrived/selfdrived.py or similar
experimental_mode = Params().get_bool("ExperimentalMode")
```

Features graduate from Experimental to Chill through a process of:

1. **Feature flag introduction:** New capability added behind `ExperimentalMode` check
2. **Alpha testing:** Deployed to experimental mode users, monitoring disengagement rates and user reports
3. **Partial graduation (Gas Gating pattern):** Specific sub-features are selectively enabled in Chill mode
4. **Full graduation:** Feature becomes default in Chill mode, experimental flag removed

### Gas Gating: The Graduation Pattern

Gas Gating is the canonical example of partial feature graduation:

- **Origin:** Full e2e longitudinal control (experimental mode) predicts when a human would press gas/brake
- **Graduated feature:** In Chill mode, the classical ACC is still primary, but the e2e model's gas/brake predictions gate whether acceleration is applied
- **Effect:** Prevents unnatural acceleration (e.g., speeding up when approaching a red light with no lead car)
- **Code path:** The model's `allow_gas` / `allow_brake` outputs are used to conditionally suppress the classical ACC's acceleration commands

### Roadmap to 1.0

openpilot 1.0 is defined as the version where:
- End-to-end longitudinal control fully graduates from Experimental to Chill mode
- Target: at least 1,000 hours between unplanned disengagements
- MPC completely removed from all modes
- The neural network directly controls both lateral and longitudinal in all modes

---

## 12. Licensing: MIT vs. Proprietary

### MIT Licensed (Open Source)

Everything in the openpilot GitHub repository:
- All driving control code (`selfdrive/`, `system/`, `tools/`)
- The cereal messaging framework
- The panda safety firmware (in `opendbc/safety/`)
- opendbc CAN database and car interface code
- tinygrad (separate repo, also MIT)
- Model inference code (how models are loaded and run)
- **The trained ONNX model weight files** — these binary blobs are included in the repo and distributed under MIT

### Proprietary / Not Open Source

- **Model training code:** The actual training pipelines, data loaders, loss functions, hyperparameter configs for training the driving models and world model are internal to comma.ai
- **Training data:** The 2.5M+ minutes of driving video collected from users is comma.ai's proprietary dataset
- **Cloud infrastructure code:** comma connect, athenad backend, data ingestion pipeline
- **Hardware designs:** comma 3X/four PCB designs, case molds, etc.

### Partial Open Source

- **commaVQ** (`github.com/commaai/commavq`): Dataset of 100k minutes of compressed driving video + VQ-VAE encoder/decoder + GPT world model code. This was an earlier iteration of the world model, openly published.
- **Research publications:** The CVPR 2025 paper describes the world model architecture in detail but does not include training code.

### Practical Implications

You can:
- Fork openpilot and modify the control logic, car interfaces, UI — MIT license
- Use the shipped ONNX model weights in your own projects — MIT license
- Run openpilot on your own hardware with your own modifications
- Disable data collection entirely (user opt-out is supported)

You cannot:
- Retrain the driving models (training code is not available)
- Access the raw training dataset
- Replicate comma's training infrastructure from open source alone

---

## 13. Simulation: MetaDrive and CARLA

### MetaDrive (Primary Simulator)

Located at `tools/sim/` in the openpilot repo. MetaDrive replaced CARLA as the preferred simulator due to portability and ease of installation.

**Setup:**
```bash
# MetaDrive is included in openpilot's pip dependencies
# Terminal 1: Launch openpilot
./tools/sim/launch_openpilot.sh

# Terminal 2: Start the bridge
./run_bridge.py
```

**Bridge options:**
- `--joystick` — Enable joystick control
- `--high_quality` — Enhanced graphics
- `--dual_camera` — Dual camera simulation

**Keyboard controls:**
| Key | Action |
|-----|--------|
| 1 | Resume cruise / accelerate |
| 2 | Set cruise speed / decelerate |
| 3 | Cancel cruise control |
| R | Reset simulation |
| I | Toggle ignition |
| Q | Quit |
| WASD | Manual control |

**What the bridge simulates:**
- Generates realistic CAN messages, GPS data, IMU readings from simulator state
- Feeds simulated camera frames to openpilot's vision pipeline
- Receives openpilot's control outputs (steering, throttle, brake) and applies them to the virtual vehicle
- The full openpilot stack runs as if connected to a real car

**Testing integration:**
- MetaDrive simulation tests run in CI
- End-to-end validation: model weights → openpilot IPC → CAN message output
- Used for regression testing alongside process replay

### CARLA Bridge (Legacy)

Previously used CARLA simulator with `carla_bridge`. Required CUDA, cuDNN, and onnxruntime-gpu. Deprecated in favor of MetaDrive due to:
- Heavy installation requirements
- Less portable
- Slower iteration cycle

### ML Simulator (World Model as Simulator)

The world model itself serves as the primary training simulator (not MetaDrive):
- Takes driving context + actions → generates future frames
- Policy is trained on-policy inside this learned simulator
- No hand-coded physics rules — dynamics are learned from data
- This is what powers the CVPR 2025 "Learning to Drive from a World Model" work

---

## 14. Lessons for Building an Airside World Model Stack

### Architectural Lessons

**1. Separate perception from policy.**
comma.ai's split into `driving_vision.onnx` (off-policy, supervised) and `driving_policy.onnx` (on-policy, RL) is directly applicable. For airside operations: train a perception model on labeled airport data (taxiways, gate areas, ground vehicles, aircraft, FOD) and a separate policy model that learns to navigate from the frozen perception features.

**2. The world model replaces the classical simulator.**
comma's key insight: a learned world model trained on real driving data produces more realistic training scenarios than hand-coded simulators. For airside: collecting video from actual airside operations and training a world model would produce a simulator that captures the messy realities of ramp operations — irregular vehicle movements, unpredictable ground crew behavior, weather variations — that are nearly impossible to hand-code.

**3. Information bottleneck prevents simulator exploitation.**
The ~700-bit Gaussian noise regularization on the feature vector is critical. Without it, the policy learns to exploit artifacts of the simulator rather than learning actual driving behavior. Any world-model-trained airside policy needs the same protection.

**4. Block-causal attention for temporal consistency.**
The DiT's frame-wise causal masking is essential for video generation that respects temporal causality. For airside, where movements are slower but precision requirements are higher, this architecture could be adapted with longer context windows.

**5. Future anchoring for trajectory stability.**
Conditioning the world model on future frames at fixed timesteps prevents drift during long rollouts. Airside operations involve longer, slower maneuvers (pushback, taxiing) where this is even more important.

### Safety Architecture Lessons

**6. Hardware safety layer independent of ML.**
The panda's MISRA C firmware enforcing safety constraints regardless of neural network output is the gold standard. An airside AV needs equivalent hardware-level safety: speed limits enforced in firmware, geofencing in firmware, emergency stop on hardware watchdog. The ML system should never be trusted for safety-critical functions.

**7. Controls_allowed pattern.**
The single boolean gate controlling all actuation is elegant and auditable. Airside equivalent: a hardware-level "ops_allowed" flag that requires active confirmation from ground control integration, vehicle health checks, and operator acknowledgment before any movement commands can reach actuators.

**8. Actuator rate limiting.**
ISO 11270/15622 limits translated to 0.9s for 1m lateral deviation. Airside vehicles operate at lower speeds but around high-value assets (aircraft). Rate limiting should be even more conservative, with speed-dependent thresholds near aircraft.

### Data Pipeline Lessons

**9. Segment-based logging with two fidelity levels.**
The rlog (full) / qlog (decimated) split is practical. Full sensor logs for training, decimated logs for fleet monitoring and debugging. The 1-minute segment rotation is simple and robust.

**10. Firehose Mode for training data scaling.**
The 100x data ingestion scaling through opportunistic upload is clever. Airside vehicles operating within airport Wi-Fi/5G coverage could maintain near-continuous data upload.

**11. Process replay for deterministic testing.**
Being able to replay recorded sensor data through every daemon for regression testing is invaluable. This requires strict process isolation and deterministic message handling — comma's cereal/msgq architecture makes this possible.

### Infrastructure Lessons

**12. Own your ML framework for embedded deployment.**
tinygrad's value proposition: train and deploy on the same framework, compile to the specific GPU on your target hardware. For airside AVs with specific compute constraints (e.g., NVIDIA Jetson, Qualcomm RB5), having control over the compilation pipeline avoids the "export to ONNX → hope it works" problem.

**13. 24-hour training autokill.**
Forces experimental discipline. Prevents the "let it train for a week and see" anti-pattern. Encourages smaller, faster experiments that compound.

**14. Flat codebase growth despite feature expansion.**
comma went from 50 to 300+ vehicles without proportional code growth by using ML to replace conditional logic. For airside: use learned models to handle the diversity of airport configurations rather than hand-coding rules for each airport layout.

### Scale Differences to Consider

| Factor | openpilot (Road) | Airside AV |
|--------|-----------------|------------|
| Speed range | 0-130 mph | 0-25 mph |
| Operating domain | Open roads worldwide | Constrained airport geometry |
| Other agents | Millions of diverse drivers | Known vehicle types, semi-predictable |
| Regulatory | Consumer L2 ADAS | Aviation-grade safety requirements |
| Connectivity | Intermittent cellular/Wi-Fi | Consistent airport network |
| Training data | 2.5M+ minutes from fleet | Smaller but more controlled dataset |
| Error tolerance | Driver backup | No driver in autonomous mode |
| Map requirements | Optional (vision-only) | Essential (precise airport map) |

The biggest divergence: openpilot is Level 2 (driver always present as backup, "doing nothing is always safe"). Airside autonomous operations may be Level 4 (no driver), fundamentally changing the safety architecture — the hardware safety layer must handle failure modes that openpilot handles by alerting the driver.

---

## Sources

- [openpilot GitHub Repository](https://github.com/commaai/openpilot)
- [openpilot modeld Models README](https://github.com/commaai/openpilot/blob/master/selfdrive/modeld/models/README.md)
- [Learning to Drive from a World Model — comma.ai blog](https://blog.comma.ai/mlsim)
- [Learning to Drive from a World Model — CVPR 2025 Paper (arXiv)](https://arxiv.org/html/2504.19077v1)
- [openpilot 0.11 Release](https://blog.comma.ai/011release/)
- [openpilot 0.10 Release](https://blog.comma.ai/010release/)
- [openpilot 0.9.8 Release](https://blog.comma.ai/098release/)
- [openpilot 0.9.0 Release](https://blog.comma.ai/090release/)
- [Development Speed Over Everything](https://blog.comma.ai/dev-speed/)
- [Understanding the openpilot Safety Model](https://blog.comma.ai/understanding-the-openpilot-safety-model/)
- [The Road to openpilot 1.0](https://blog.comma.ai/the-road-to-openpilot-1-0/)
- [End-to-End Lateral Planning](https://blog.comma.ai/end-to-end-lateral-planning/)
- [How openpilot Works in 2021](https://blog.comma.ai/openpilot-in-2021/)
- [openpilot Safety Documentation](https://docs.comma.ai/concepts/safety/)
- [openpilot Logs Documentation](https://docs.comma.ai/concepts/logs/)
- [panda GitHub Repository](https://github.com/commaai/panda)
- [opendbc GitHub Repository](https://github.com/commaai/opendbc)
- [commaVQ GitHub Repository](https://github.com/commaai/commavq)
- [tinygrad GitHub Repository](https://github.com/tinygrad/tinygrad)
- [tinybox Documentation](https://docs.tinygrad.org/tinybox/)
- [openpilot Simulation README](https://github.com/commaai/openpilot/blob/master/tools/sim/README.md)
- [openpilot DeepWiki Analysis](https://deepwiki.com/commaai/openpilot)
- [Introducing the comma four](https://blog.comma.ai/comma-four/)
- [Open Sourcing openpilot Development Tools](https://blog.comma.ai/open-sourcing-openpilot-development-tools/)
