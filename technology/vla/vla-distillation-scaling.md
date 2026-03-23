# VLA Distillation and Scaling for Edge Deployment

## Getting a 10B-Parameter Model Running on a 275 TOPS Device

---

## 1. The Problem

Alpamayo-R1 is 10B parameters (8.2B backbone + 2.3B action expert). Running it requires:
- **Inference:** ~20GB VRAM at FP16, ~99ms on datacenter GPU
- **Orin AGX 64GB:** 64GB unified memory, but 275 TOPS sparse — cannot run 10B in real-time
- **Orin AGX 32GB:** Impossible to even load the full model

**The solution: Distill the 10B teacher into a 100M-1B student that runs on Orin.**

This is NVIDIA's stated design intent — Alpamayo is a teacher model, not a deployment model.

---

## 2. Knowledge Distillation Fundamentals

### 2.1 Teacher-Student Framework

```
Teacher (Alpamayo 10B, runs on cloud/datacenter):
  Input: Multi-camera images + vehicle state
  Output: Trajectory τ_teacher, Reasoning r_teacher, Logits z_teacher

Student (100M-1B, runs on Orin):
  Input: Same images + vehicle state
  Output: Trajectory τ_student

Training objective:
  L = α · L_task(τ_student, τ_groundtruth)           — match ground truth
    + β · L_distill(τ_student, τ_teacher)             — match teacher trajectory
    + γ · L_feature(f_student, f_teacher)              — match teacher features
    + δ · L_logit(z_student, z_teacher/T)              — match soft teacher logits

Temperature T > 1 softens teacher logits → student learns relative preferences
Typical: α=1.0, β=0.5, γ=0.1, δ=0.3, T=4.0
```

### 2.2 What Knowledge Transfers

| Knowledge Type | Transfer Method | What Student Learns |
|---------------|----------------|-------------------|
| **Trajectory distribution** | MSE/Huber on trajectories | Where to drive |
| **Soft logits** | KL divergence with temperature | Teacher's uncertainty and preferences |
| **Intermediate features** | MSE on projected features | Rich scene understanding |
| **Attention patterns** | Attention transfer loss | What to look at |
| **Reasoning** | Not directly transferable | Student has no language — only actions |

### 2.3 The Reasoning Gap

Alpamayo's Chain-of-Causation reasoning produces explanations: *"Slowing because ground crew ahead, jet blast zone in 15m."* A distilled student cannot produce language — it outputs trajectories only.

**Workaround for explainability:**
- Log the teacher's reasoning for every training example
- At deployment: run teacher offline on recorded data to generate explanations
- Or: keep a small language model (500M) alongside the student for on-demand explanation generation

---

## 3. Student Architecture Options

### 3.1 Option A: FastViT + Transformer Policy (comma.ai Approach)

This is the proven production approach — comma.ai ships this today.

```
Architecture:
  FastViT backbone (12M params) → visual tokens
  + Vehicle state encoding (1M params)
  → Small Transformer (50-200M params) → trajectory

Total: 63-213M parameters
Latency on Orin: ~20-60ms (estimated from comma.ai Qualcomm benchmarks)
```

**Pros:** Proven in production (100M+ miles), small, fast, MIT-licensed architecture
**Cons:** No language reasoning, no multi-modal conditioning, limited to camera-only

### 3.2 Option B: BEV Encoder + Diffusion Policy Head

```
Architecture:
  PointPillars BEV encoder (5M params) → BEV features (LiDAR)
  + Optional: DINOv2-S camera encoder (22M) → camera BEV via LSS
  → BEV fusion (if multi-modal)
  → DiffusionDrive truncated diffusion head (50-100M params) → trajectory

Total: 55-127M parameters (LiDAR-only) or 77-149M (multi-modal)
Latency on Orin: ~30-80ms
```

**Pros:** Works with LiDAR-only (Phase 1), multi-modal ready, DiffusionDrive is CVPR 2025
**Cons:** Not a VLA (no language), diffusion head needs tuning

### 3.3 Option C: Small VLA with Language (Research)

```
Architecture:
  Phi-3-mini (3.8B) or Qwen2.5-VL-3B as backbone
  + Vision encoder (ViT-S, 22M)
  + Action head (flow matching, 50M)

Total: ~3.9B parameters
Latency on Orin: 200-500ms at INT4 (marginal for real-time)
On Thor: 50-100ms at FP8 (viable)
```

**Pros:** Full VLA with language reasoning, explainability, instruction following
**Cons:** Only viable on Thor (not Orin), INT4 quantization may degrade quality

### 3.4 Recommendation

| Phase | Architecture | Params | Target Hardware | Language? |
|-------|-------------|--------|----------------|-----------|
| **Phase 1** | BEV + diffusion policy | 55-127M | Orin | No |
| **Phase 2** | BEV + diffusion + camera | 77-149M | Orin | No |
| **Phase 3** | Small VLA (Qwen2.5-3B) | 3.9B | Thor | Yes |

---

## 4. Distillation Pipeline

### 4.1 Step 1: Generate Teacher Labels

```python
# Run Alpamayo teacher on all training data (offline, on cloud GPUs)
# For each driving scene:
#   Input: multi-camera images + vehicle state
#   Output: trajectory, reasoning trace, intermediate features

for scene in training_data:
    teacher_output = alpamayo.forward(
        cameras=scene.images,
        vehicle_state=scene.ego_state,
    )
    # Save teacher predictions as training labels
    save_distillation_labels(scene.id, {
        'trajectory': teacher_output.trajectory,        # (T, 3) waypoints
        'features': teacher_output.hidden_features,      # intermediate representations
        'reasoning': teacher_output.reasoning_text,      # CoC explanation
        'confidence': teacher_output.confidence,          # prediction confidence
    })
```

### 4.2 Step 2: Train Student

```python
class DistillationTrainer:
    def __init__(self, student, teacher_labels):
        self.student = student  # 100M-1B model
        self.optimizer = AdamW(student.parameters(), lr=1e-4)

    def train_step(self, batch):
        # Student forward pass
        student_traj = self.student(batch['sensor_data'])

        # Ground truth loss (match expert driving)
        gt_loss = F.huber_loss(student_traj, batch['gt_trajectory'])

        # Distillation loss (match teacher predictions)
        teacher_traj = batch['teacher_trajectory']
        distill_loss = F.mse_loss(student_traj, teacher_traj)

        # Feature matching loss (optional, if architectures align)
        if hasattr(self.student, 'get_features'):
            student_feat = self.student.get_features()
            teacher_feat = batch['teacher_features']
            # Project to common dimension if needed
            feat_loss = F.mse_loss(
                self.student.feature_projector(student_feat),
                teacher_feat
            )
        else:
            feat_loss = 0

        # Combined loss
        loss = gt_loss + 0.5 * distill_loss + 0.1 * feat_loss
        return loss
```

### 4.3 Step 3: Progressive Distillation

Don't distill directly from 10B → 100M. Use intermediate students:

```
10B Teacher (Alpamayo)
    ↓ distill
3B Intermediate Student
    ↓ distill
1B Student
    ↓ distill
200M Student (target for Orin)

Each step preserves ~90-95% of teacher accuracy.
Three steps: 0.95³ = 85.7% accuracy retention.
```

### 4.4 Step 4: Quantize and Deploy

```bash
# Export to ONNX
python export.py --model student_200M.pth --format onnx

# Build TensorRT FP16 engine
trtexec --onnx=student.onnx --saveEngine=student_fp16.engine --fp16

# Build INT8 with calibration
trtexec --onnx=student.onnx --saveEngine=student_int8.engine \
    --int8 --calib=calibration_data/

# Measure latency
trtexec --loadEngine=student_fp16.engine --dumpProfile
```

---

## 5. Published Distillation Results for Driving

### 5.1 NVIDIA's Stated Approach

Alpamayo is explicitly designed as a teacher:
- 10B teacher trains on 1,727 hours across 25 countries
- Distilled students target 1-3B for on-vehicle deployment
- DriveOS LLM SDK on Thor supports Cosmos-Reason2 inference
- Mercedes CLA deploying Q1 2026 will use distilled models (not full Alpamayo)

### 5.2 Waymo's Teacher-Student

Waymo uses a "Think Fast / Think Slow" Foundation Model:
- **Think Slow (teacher):** Large model with comprehensive reasoning
- **Think Fast (student):** Smaller model distilled for real-time inference
- Production uses distilled models, not the full EMMA research model

### 5.3 comma.ai's Architecture Split

comma.ai's approach is the cleanest example:
- **World model (2B DiT):** Teacher, runs only during training (in cloud)
- **Driving policy (FastViT + small Transformer):** Student, runs on device
- The policy is trained ON-POLICY inside the world model
- This is not traditional distillation — it's RL inside a learned simulator

### 5.4 Academic Results

| Paper | Teacher | Student | Accuracy Retention | Speedup |
|-------|---------|---------|-------------------|---------|
| BEVDistill (ICLR 2023) | BEVFormer (200M) | Smaller BEV (50M) | 96% NDS | 3x |
| TinyBEV (2023) | BEVDet4D | TinyBEV | 93% mAP | 4x |
| UniDistill (CVPR 2023) | Multi-modal teacher | Single-modal student | 97% NDS | 2x |
| SparseDistill (2024) | Dense BEV | Sparse detector | 95% mAP | 5x |

**Takeaway:** 93-97% accuracy retention is typical with 2-5x speedup.

---

## 6. Scaling Laws in Reverse

### 6.1 How Much Accuracy Do You Lose?

Based on published driving model scaling:

```
Model Size vs. Performance (approximate, from GAIA-1/DriveGPT scaling):

10B:   100% (teacher baseline)
3B:    ~95% (minor degradation, still very good)
1B:    ~88% (noticeable on edge cases, fine for most scenarios)
500M:  ~82% (degrades on complex scenarios)
200M:  ~75% (adequate for simple scenarios, needs safety fallback)
100M:  ~68% (limited capability, must combine with classical planner)
50M:   ~60% (minimal model, classical planner still needed)

These are rough estimates — actual values depend on data, architecture, and training.
```

### 6.2 Compute-Optimal Distillation

How much teacher data do you need?

```
Rule of thumb (from LLM distillation research):
  Student tokens = 10-50x student parameters

For 200M student:
  Tokens needed: 2-10B tokens
  At 1K tokens/frame, 10 FPS:
  = 200K-1M seconds of driving = 56-278 hours

Your airside data (50-200 hours) + nuScenes (28K frames) + Waymo might be sufficient
for a 200M student, but not for a 1B student without more data.
```

---

## 7. Alternative: Skip VLA, Use World Model + Classical Planner

The design spec's Phase 1 approach avoids distillation entirely:

```
Instead of: Alpamayo 10B → distill → student VLA on Orin

Do: OccWorld (50-200M) → predicts future occupancy
    + Existing Frenet planner → scores trajectories against predictions
    = No VLA needed for Phase 1

Benefits:
  - No distillation pipeline needed
  - No camera dependency (LiDAR-only for OccWorld)
  - No licensing issues (OccWorld is open-source)
  - Frenet planner is already proven
  - World model adds prediction value without replacing the planner

When to add VLA (Phase 3):
  - After cameras are added
  - After Thor hardware is available
  - When language reasoning adds clear value (ground control instructions)
  - When 3B VLA can run on Thor at <100ms
```

**This is the recommended approach.** VLA distillation is a Phase 3 activity, not Phase 1.

---

## 8. Open-Source Small VLAs Worth Evaluating

| Model | Params | Backbone | Action Head | License | Driving? |
|-------|--------|----------|-------------|---------|----------|
| **OpenVLA** | 7B | Llama-2 + SigLIP | Regression | MIT | No (manipulation) |
| **OpenVLA-OFT** | 7B | + token-free output | Flow matching | MIT | No |
| **Octo** | 93M | Transformer | Diffusion | MIT | No (manipulation) |
| **RT-2-X** | 55B (huge) | PaLM-E | Regression | Google internal | No |
| **LINGO-2** (Wayve) | Unknown | Proprietary | Trajectory | Proprietary | **Yes** |
| **DriveVLM** | 7B+ | InternVL | Trajectory | Partial open | **Yes** |
| **FastDriveVLA** | 3B? | Unknown | Unknown | Not released | **Yes** |
| **AutoVLA** | Unknown | Unknown | Unknown | Not released | **Yes** |

**The honest assessment:** No fully open-source, small (<3B), driving-specific VLA exists as of March 2026. The closest options are:
1. **Distill from Alpamayo** (non-commercial license — research only)
2. **Build from open backbone** (Qwen2.5-VL-3B + custom action head)
3. **Skip VLA** and use world model + classical planner (recommended for Phase 1-2)

---

## 9. Practical Distillation Recipe for Airside

### If You Proceed with Distillation (Phase 3)

```yaml
# Step 1: Data preparation
teacher_data:
  source: Alpamayo inference on airside bags + nuScenes
  format: (images, vehicle_state) → (trajectory, features, reasoning)
  volume: 200+ hours minimum
  gpu: 4x A100, ~48 hours to label all data

# Step 2: Student architecture
student:
  backbone: FastViT-SA12 (12M params)
  fusion: Concat + Conv1x1 (if multi-modal)
  policy_head: DiffusionDrive truncated (50M params)
  total: ~62M params

# Step 3: Training
training:
  optimizer: AdamW, lr=1e-4, weight_decay=0.01
  schedule: CosineAnnealing, 100 epochs
  batch_size: 32 (per GPU)
  gpu: 4x A100, ~24 hours
  loss: Huber(gt) + 0.5*MSE(teacher_traj) + 0.1*MSE(features)

# Step 4: Quantization
quantization:
  method: PTQ with 500 calibration samples
  precision: FP16 (Orin), FP8 (Thor)
  expected_accuracy_loss: <2% trajectory error

# Step 5: Deployment
deployment:
  format: TensorRT engine
  target: Orin (FP16) or Thor (FP8)
  expected_latency: 20-40ms (Orin), 5-15ms (Thor)
```

---

## Sources

- NVIDIA Alpamayo documentation (NVlabs/alpamayo)
- comma.ai openpilot architecture (commaai/openpilot)
- Hinton et al. "Distilling the Knowledge in a Neural Network." arXiv, 2015
- BEVDistill: "BEV-Guided Multi-Modality Fusion." ICLR, 2023
- UniDistill: "Universal Cross-Modality Knowledge Distillation." CVPR, 2023
- Waymo Think Fast / Think Slow architecture
- DiffusionDrive, CVPR 2025
- FastViT: "Fast Hybrid Vision Transformer." ICCV, 2023
