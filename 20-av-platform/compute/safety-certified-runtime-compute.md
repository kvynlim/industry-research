# Safety-Certified Runtime Compute

**Last updated:** 2026-05-09

## Why It Matters

High-performance AV compute is not automatically safety-certified compute.
Perception accelerators, Linux containers, GPU kernels, neural networks, and
recorders can be mission-critical while still being unsuitable as the final
safety authority. A certifiable vehicle runtime separates the safety decision
path from the high-performance autonomy path, then proves freedom from
interference, bounded fallback timing, and traceable assumptions.

The practical pattern is a mixed-criticality compute stack: safety-certified
RTOS or hypervisor services supervise a safety controller, network processor, or
lockstep MCU, while Linux/ROS/AI workloads run in a constrained domain. Platforms
such as QNX OS for Safety, NXP S32G, and NVIDIA DRIVE can contribute evidence,
but the vehicle safety case must still prove the final integration.

## Architecture Decisions

| Decision | Practical rule |
|---|---|
| Safety island | Put E-stop, brake enable, speed limit, watchdog, geofence, and heartbeat supervision on an independent MCU, safety processor, or certified RTOS partition. |
| AI domain | Run perception, prediction, planning, foundation models, and logging on high-performance Linux/GPU compute as QM or lower-ASIL software unless explicitly qualified otherwise. |
| Gateway processor | Use a vehicle network processor such as S32G for CAN/Ethernet gatewaying, safety supervision, secure boot, and traffic control when the system needs ASIL-capable networking. |
| Certified OS | Use QNX OS for Safety or equivalent RTOS for safety services that require deterministic scheduling, safety manuals, certified libraries, and qualified toolchains. |
| Hypervisor | Partition Linux, QNX, service OSs, and recorder workloads only when CPU, memory, DMA, interrupt, and device ownership can be shown in the safety case. |
| NVIDIA DRIVE/Orin/Thor | Treat platform safety certifications, safety manuals, and process certifications as inputs. They do not certify the AV application by themselves. |
| Degraded operation | Define which autonomy functions continue after loss of GPU, Linux, network gateway, time source, recorder, or one sensor zone. |

Reference runtime split:

```
Safety domain
QNX / safety RTOS / lockstep MCU
        +-- watchdogs
        +-- speed and geofence limits
        +-- brake and E-stop supervision
        +-- safety CAN / TSN gateway checks

Autonomy domain
Linux / ROS 2 / CUDA / TensorRT
        +-- perception and fusion
        +-- planning and behavior
        +-- data recording and diagnostics
        +-- fleet and developer tools

Hardware controls
MMU, IOMMU, hypervisor, lockstep cores, secure boot, HSE/TPM,
partitioned network ports, bounded watchdog timeouts
```

## Evidence Artifacts

- Compute safety concept showing ASIL/QM allocation, safety goals, fallback
  timeouts, and independence assumptions.
- Platform safety manuals, safety certificates, SEooC assumptions, errata,
  qualified toolchain records, and OS/hypervisor configuration baselines.
- Resource partition evidence for CPU, GPU, DLA, memory, DMA, interrupts,
  storage, Ethernet, CAN, and PCIe devices.
- Boot chain and update evidence: secure boot state, measured boot logs,
  rollback policy, signing keys, and recovery image behavior.
- Watchdog and heartbeat traces for Linux hang, GPU timeout, process crash,
  scheduler overload, gateway reset, network partition, and time-source loss.
- Worst-case execution and latency budget for the safety path from hazard
  detection or heartbeat loss to actuator command.
- Thermal and power derating evidence proving safety timeouts hold under
  throttling, brownout, hot soak, and cold start.

## Acceptance Checks

- A full Linux autonomy-domain hang causes a safety response within the approved
  watchdog timeout.
- GPU reset, CUDA fault, or perception process crash cannot block the safety
  controller from commanding brake or safe torque off.
- Safety-domain code boots, runs, and logs its health without depending on cloud
  connectivity, ROS master/graph availability, or recorder availability.
- Shared memory, DMA devices, and PCIe endpoints cannot write into safety-domain
  memory or corrupt safety I/O.
- The system refuses mission start when safety manual assumptions are violated:
  wrong silicon revision, wrong OS build, wrong hypervisor config, or wrong
  safety-controller firmware.
- Runtime health messages distinguish degraded AI performance from loss of a
  safety function.
- Thermal throttling and power limiting are visible to the supervisor before
  they violate timing budgets.

## Failure Modes

| Failure mode | Detection | Safe response |
|---|---|---|
| Linux or ROS deadlock | Heartbeat timeout, scheduler watchdog, stale command lease | Safety domain commands controlled stop and blocks new missions. |
| GPU fault or thermal throttling | Driver error, watchdog reset, power/thermal telemetry | Drop to reduced perception mode or safe stop depending on ODD coverage. |
| Hypervisor misconfiguration | Config hash mismatch, partition test failure, device ownership error | Refuse release or mission start. |
| DMA or shared-memory interference | IOMMU fault, memory protection violation, unexplained safety data corruption | Isolate offending partition and enter safe state. |
| Safety MCU lockstep fault | Lockstep error, ECC fault, reset reason | Engage hardware fallback, preserve event log, require service inspection. |
| Network gateway reset | Missing gateway heartbeat, topology change, CAN/TSN path loss | Freeze command output and transition to safe stop if actuator path is affected. |
| Safety manual assumption drift | BOM, compiler, OS, or silicon revision mismatch | Block certification claim for that build until re-analysis is complete. |
| Recorder or storage hang | I/O timeout, queue depth saturation, power rail spike | Drop logging load before it can starve safety or control traffic. |

## Related Repository Docs

- [NVIDIA Orin Technical](nvidia-orin-technical.md)
- [NVIDIA DRIVE Thor](nvidia-drive-thor.md)
- [Edge Platforms](edge-platforms.md)
- [Edge-Cloud Hybrid Inference](edge-cloud-hybrid-inference.md)
- [Autonomy Power Distribution and Safe-Stop Energy](../power-electrical/autonomy-power-distribution.md)
- [Deterministic Real-Time Networking (TSN)](../networking-connectivity/deterministic-networking-tsn.md)
- [Functional Safety Software Implementation](../../60-safety-validation/standards-certification/functional-safety-software.md)
- [Fail-Operational Architecture](../../60-safety-validation/runtime-assurance/fail-operational-architecture.md)
- [Simplex Safety Architecture](../../60-safety-validation/runtime-assurance/simplex-safety-architecture.md)

## Sources

- BlackBerry QNX, [QNX OS for Safety](https://blackberry.qnx.com/en/products/safety-certified/black-channel)
- BlackBerry QNX, [QNX Hypervisor for Safety](https://blackberry.qnx.com/en/products/safety-certified)
- NXP, [S32G Vehicle Network Processors](https://www.nxp.com/products/processors-and-microcontrollers/s32-automotive-platform/s32g-vehicle-network-processors%3AS32G-PROCESSORS)
- NXP, [S32 Automotive Platform](https://www.nxp.com/pages/%3AS32)
- NVIDIA, [Autonomous Vehicle Safety / NVIDIA Halos](https://www.nvidia.com/en-us/ai-trust-center/halos/autonomous-vehicles/)
- NVIDIA Developer, [NVIDIA DRIVE OS](https://developer.nvidia.com/drive/driveos)
- NVIDIA Docs, [Autonomous Vehicle Development Platforms](https://docs.nvidia.com/drive/)
- ISO, [ISO 26262 Road vehicles - Functional safety](https://www.iso.org/standard/68383.html)
