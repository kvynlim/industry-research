# Functional Safety Software Implementation for ROS-Based Airside AVs

## ISO 26262 Part 6, MISRA C/C++, Static Analysis, and Production Safety Patterns

**Last updated:** 2026-04-11

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [ISO 26262 Part 6: Software Development](#2-iso-26262-part-6-software-development)
3. [MISRA C:2012 for ROS Noetic Safety-Critical Nodes](#3-misra-c2012-for-ros-noetic-safety-critical-nodes)
4. [Static Analysis Tools](#4-static-analysis-tools)
5. [Compiler Flags for Safety](#5-compiler-flags-for-safety)
6. [Runtime Safety Patterns for ROS](#6-runtime-safety-patterns-for-ros)
7. [Testing Strategy](#7-testing-strategy)
8. [CI/CD for Safety Compliance](#8-cicd-for-safety-compliance)
9. [ROS-Specific Safety Challenges](#9-ros-specific-safety-challenges)
10. [Airside-Specific Requirements](#10-airside-specific-requirements)
11. [comma.ai Panda Safety Layer Case Study](#11-commaai-panda-safety-layer-case-study)
12. [Recommended Implementation for Aurrigo](#12-recommended-implementation-for-aurrigo)
13. [References](#13-references)

---

## 1. Introduction

### 1.1 The Safety Gap in ROS-Based Autonomous Vehicles

ROS Noetic was designed as a research middleware, not a safety-critical runtime. Its architecture -- single-process rosmaster, unreliable UDP-based topic transport, unbounded dynamic memory allocation, no built-in watchdog mechanisms -- sits at the opposite end of the spectrum from what standards like ISO 26262 and ISO 3691-4 demand for autonomous vehicle software. Yet ROS is the foundation of most autonomous vehicle development stacks, including the 22-package Aurrigo ADS stack running on airport airside.

This gap is not academic. Airport airside autonomous vehicles operate within meters of aircraft worth $100M-$400M, alongside ground crew where 27,000 ramp accidents occur annually ($10B+ cost). The EU Machinery Regulation 2023/1230 (effective January 2027) now explicitly includes software as a safety-critical machine component, and the 2027 regulation mandates third-party conformity assessment for autonomous vehicles with AI control systems. ISO 3691-4:2023, harmonized with the Machinery Directive since May 2024, requires Performance Level d (PLd) for personnel detection and braking -- which implies structured software development processes at the code level.

The challenge is practical: how do you apply automotive functional safety rigor to a ROS Noetic codebase without rewriting the entire stack? This document provides the technical answer.

### 1.2 Why Code-Level Safety Matters for Certification

Assessors from notified bodies (TUV SUD, TUV Nord, SGS, Bureau Veritas) evaluating an autonomous vehicle under ISO 3691-4 or the Machinery Regulation will examine not only the system architecture and safety functions, but increasingly the software development process itself. The specific areas they inspect include:

- **Coding standards compliance**: Evidence that safety-critical code follows MISRA C/C++ or equivalent
- **Static analysis results**: Reports showing absence of undefined behavior, null pointer dereferences, buffer overflows, and type conversion errors in safety paths
- **Structural test coverage**: MC/DC or branch coverage metrics for safety-critical functions, depending on the integrity level
- **Traceability**: Bidirectional links from safety requirements through design, code, and test cases
- **Change management**: Evidence that modifications to safety-critical code trigger re-verification
- **Tool qualification**: Evidence that tools used for verification (compilers, static analyzers, test frameworks) are qualified for the claimed integrity level

Without code-level evidence, a safety case built on system-level arguments alone will not satisfy assessors for anything above Performance Level b (PLb). For the PLd functions required by ISO 3691-4 (braking, personnel detection), code-level safety is not optional.

### 1.3 Document Scope

This document covers functional safety software practices applicable to:

- **Primary target**: Aurrigo's ROS Noetic C++ nodelet stack (22 packages, GCC 9, Ubuntu 20.04)
- **Safety controller**: STM32-class microcontroller running CAN gateway firmware (bare-metal C)
- **Deployment platform**: NVIDIA Jetson Orin (aarch64, L4T/JetPack)
- **Standards context**: ISO 3691-4:2023, ISO 26262:2018 (applied by analogy), EU Machinery Regulation 2023/1230, ISO 13849-1

Where ISO 26262 is referenced, it is applied by analogy to industrial autonomous vehicles rather than by direct regulatory mandate. ISO 26262 is an automotive standard (road vehicles), but its software development methods (Part 6) represent the most mature framework for safety-critical embedded software and are widely adopted outside automotive for AV software engineering.

---

## 2. ISO 26262 Part 6: Software Development

### 2.1 V-Model Software Lifecycle for AV

ISO 26262-6:2018 prescribes a V-model lifecycle for safety-related software development. The left side of the V defines specification and design activities; the right side defines corresponding verification activities. Each phase produces work products that are inputs to the next phase and to the corresponding verification phase.

```
Safety Requirements ──────────────────────────────────── Software Verification
       │                                                         ▲
       ▼                                                         │
Software Arch Design ────────────────────────── Software Integration Testing
       │                                                         ▲
       ▼                                                         │
Software Unit Design ─────────────────────────── Software Unit Testing
       │                                                         ▲
       ▼                                                         │
       └──────────── Implementation ─────────────────────────────┘
```

**Phase mapping to ROS Noetic development:**

| V-Model Phase | ISO 26262-6 Clause | ROS Equivalent |
|---|---|---|
| Software safety requirements | Clause 6 | Requirements spec for each safety-critical nodelet (e.g., emergency braking, speed limiting, obstacle detection) |
| Software architectural design | Clause 7 | Node graph design, topic/service interfaces, namespace partitioning, Simplex architecture |
| Software unit design | Clause 8 | Individual class/function design within nodelets, state machines, data flow |
| Software unit implementation | Clause 8 | C++ source code for nodelets, header files, configuration |
| Software unit testing | Clause 9 | gtest/gmock unit tests for individual functions and classes |
| Software integration testing | Clause 10 | rostest-based integration tests, multi-node scenario tests |
| Software verification | Clause 11 | Static analysis, coverage measurement, requirements traceability |

### 2.2 ASIL Decomposition and Its Implications for ROS Nodes

ISO 26262 assigns Automotive Safety Integrity Levels (ASIL A through D) to safety goals based on severity, exposure, and controllability. Higher ASILs impose stricter requirements on every phase of development. ASIL decomposition (ISO 26262-9, Clause 5) allows splitting a high-ASIL requirement across redundant elements, each with a lower ASIL, provided they are sufficiently independent.

**ASIL levels and their software requirements:**

| ASIL | Structural Coverage | Static Analysis | Unit Test Method | Integration Test Method |
|---|---|---|---|---|
| QM | No requirement | Recommended | No requirement | No requirement |
| ASIL A | Statement coverage | Highly recommended | Recommended | Recommended |
| ASIL B | Branch coverage | Highly recommended | Highly recommended | Highly recommended |
| ASIL C | Branch coverage + MC/DC recommended | Highly recommended | Highly recommended | Highly recommended |
| ASIL D | MC/DC coverage | Highly recommended | Highly recommended | Highly recommended |

**Applying ASIL decomposition to the Simplex architecture:**

The Aurrigo Simplex architecture (see [../runtime-assurance/simplex-safety-architecture.md](../runtime-assurance/simplex-safety-architecture.md)) is a natural candidate for ASIL decomposition:

- **Arbitrator node** + **Production stack (Baseline Controller)**: ASIL B -- these form the safety-certified path. The arbitrator selects commands and enforces safety constraints. The production stack's Frenet planner and RANSAC perception provide verified, deterministic behavior.
- **Shadow/New stack (Advanced Controller)**: QM -- the world model stack, neural planner, and foundation model perception run as the high-performance path but are not trusted for safety. Their outputs are gated by the arbitrator.
- **Safety controller firmware (CAN gateway)**: ASIL B -- hardware-level speed limiting, geofencing, emergency stop, and heartbeat monitoring. Independent of the ROS stack.

This decomposition means the production stack and arbitrator must meet ASIL B software requirements (branch coverage, static analysis, MISRA compliance), while the shadow stack can follow QM practices. The safety controller firmware, being bare-metal C on an STM32, should target ASIL B independently.

**Freedom from interference (ISO 26262-6, Clause 7.4.4):**

For ASIL decomposition to be valid, the decomposed elements must be free from interference. In a ROS context, this means:

- The shadow stack must not be able to crash, block, or corrupt the production stack or arbitrator
- Shared resources (CPU, memory, network bandwidth, rosmaster) must be managed so that failure of the QM element does not affect ASIL B elements
- The arbitrator must not depend on correct behavior of the shadow stack for safety

ROS 1 does not natively provide freedom from interference. Mitigation strategies include: Linux cgroups for CPU/memory isolation, separate nodelets processes (not composed in the same nodelet manager), ROS namespace separation, and the hardware safety controller as a final backstop independent of ROS entirely.

### 2.3 Software Safety Requirements Specification

ISO 26262-6, Clause 6 requires that each software safety requirement be:

1. **Unambiguous**: One interpretation only
2. **Comprehensible**: Understandable by developers and testers
3. **Atomic**: Each requirement addresses one thing
4. **Internally consistent**: No contradictions within the set
5. **Feasible**: Achievable within the constraints
6. **Verifiable**: Can be tested or analyzed to confirm compliance
7. **Traceable**: Linked to the technical safety concept and to implementation/test

**Example safety requirements for Aurrigo's airside AV:**

```
SSR-001: The emergency braking node shall command maximum braking force 
         within 50ms of receiving an e-stop trigger on /safety/e_stop topic.
         [Traces to: TSC-003, Verified by: UT-001, IT-005]

SSR-002: The speed limiting function shall enforce a maximum speed of 
         8 km/h in Zones 1-3 (apron areas) and 15 km/h in Zone 4 
         (service roads), regardless of planner output.
         [Traces to: TSC-007, Verified by: UT-012, IT-008]

SSR-003: The arbitrator shall revert to production stack output within 
         one control cycle (20ms) if the shadow stack fails to publish 
         a valid command within its 500ms timeout.
         [Traces to: TSC-010, Verified by: UT-020, IT-015]

SSR-004: The obstacle detection pipeline shall detect a 200mm diameter 
         cylinder at ground level at a minimum range of 2.0m in all 
         directions, with detection latency <= 100ms.
         [Traces to: TSC-004, Verified by: IT-022, SysT-003]
```

### 2.4 Software Architectural Design

ISO 26262-6, Clause 7 addresses the software architecture with emphasis on:

**Modularity (Clause 7.4.1):** Each software component has a well-defined interface and limited coupling. In ROS, this maps naturally to nodes/nodelets with defined topic/service interfaces. The risk is that ROS makes it too easy to create hidden coupling through global parameters, shared tf trees, and implicit timing dependencies.

**Hierarchical structure (Clause 7.4.2):** Software components organized in layers. For Aurrigo:

```
Layer 4: Mission Management     (/mission_planner, /fleet_interface)
Layer 3: Navigation/Planning    (/frenet_planner, /path_tracker)
Layer 2: Perception/Localization (/obstacle_detection, /gtsam_localization)
Layer 1: Sensor/Actuator        (/rslidar_driver_*, /imu_driver, /can_interface)
Layer 0: Safety Infrastructure  (/arbitrator, /safety_monitor, /watchdog)
```

**Freedom from interference (Clause 7.4.4):** The most challenging requirement for ROS. Specific mechanisms:

| Interference Type | ROS Risk | Mitigation |
|---|---|---|
| Spatial (memory corruption) | Shared nodelet manager process space | Separate ASIL B nodes into own processes; use process-level memory protection |
| Temporal (CPU starvation) | GIL in Python nodes; unbounded callbacks | RT_PREEMPT kernel; SCHED_FIFO for safety nodes; cgroups CPU reservation |
| Communication (message loss/corruption) | ROS 1 TCP/UDP, no checksums beyond TCP | CRC32 in safety-critical message payloads; sequence number verification |
| Service (shared resource exhaustion) | Single rosmaster; shared /tf tree | Watchdog on rosmaster; independent CAN-based safety channel bypassing ROS |

**Partitioning for mixed-criticality:**

```xml
<!-- safety_nodes.launch — ASIL B partition -->
<launch>
  <!-- Run safety nodes in separate processes with RT priority -->
  <node pkg="safety_monitor" type="arbitrator_node" name="arbitrator"
        output="screen" launch-prefix="chrt -f 90">
    <param name="heartbeat_timeout" value="0.2"/>
    <param name="max_latency_ms" value="20"/>
  </node>
  
  <node pkg="safety_monitor" type="watchdog_node" name="watchdog"
        output="screen" launch-prefix="chrt -f 95">
    <param name="monitored_nodes" value="arbitrator,obstacle_detection,can_interface"/>
  </node>
  
  <node pkg="vehicle_interface" type="can_safety_node" name="can_safety"
        output="screen" launch-prefix="chrt -f 99">
    <!-- Highest RT priority — CAN heartbeat and e-stop -->
  </node>
</launch>
```

### 2.5 Software Unit Design and Implementation

ISO 26262-6, Clause 8 specifies requirements for detailed design and coding:

**Design principles (Clause 8.4.3):**
- One entry and one exit point per function
- No dynamic objects in safety-critical paths after initialization
- Explicit data flow through parameters and return values (minimize global/shared state)
- Limited use of pointers and pointer arithmetic
- No recursion in safety-critical code
- Finite, bounded loops only

**Naming conventions for safety-critical code:**

```cpp
// Safety-critical functions prefixed with 'safe_' for audit visibility
bool safe_check_speed_limit(double current_speed_mps, ZoneType zone);
bool safe_validate_command(const geometry_msgs::Twist& cmd);
void safe_trigger_emergency_stop(EStopReason reason);

// Non-safety functions use standard naming
void publishDiagnostics(const DiagnosticStatus& status);
double computePathCurvature(const Path& path, size_t index);
```

### 2.6 Software Unit Testing

ISO 26262-6, Clause 9 specifies structural coverage metrics by ASIL:

- **ASIL A**: Statement coverage (every line executed at least once)
- **ASIL B**: Branch coverage (every decision branch taken at least once)  
- **ASIL C**: Branch coverage, with MC/DC highly recommended
- **ASIL D**: MC/DC (Modified Condition/Decision Coverage) -- every condition in every decision independently affects the outcome

**MC/DC example for a safety-critical function:**

```cpp
// Function under test
bool safe_allow_motion(bool e_stop_clear, bool speed_ok, 
                       bool obstacles_clear, bool heartbeat_valid) {
    return e_stop_clear && speed_ok && obstacles_clear && heartbeat_valid;
}
```

**MC/DC test cases (each condition independently toggles the outcome):**

| Test | e_stop_clear | speed_ok | obstacles_clear | heartbeat_valid | Result | Condition Tested |
|------|-------------|----------|-----------------|-----------------|--------|------------------|
| T1 | true | true | true | true | true | Baseline (all true) |
| T2 | **false** | true | true | true | **false** | e_stop_clear |
| T3 | true | **false** | true | true | **false** | speed_ok |
| T4 | true | true | **false** | true | **false** | obstacles_clear |
| T5 | true | true | true | **false** | **false** | heartbeat_valid |

Five tests achieve 100% MC/DC for this decision. For complex boolean expressions, MC/DC can require significantly more test cases than branch coverage alone.

### 2.7 Software Integration Testing

ISO 26262-6, Clause 10 requires testing the interaction between software components. In ROS, this means testing multi-node scenarios:

- **Message passing correctness**: Verify that published messages arrive at subscribers with correct content and timing
- **Timing behavior**: Verify that end-to-end latency from sensor input to actuator command meets the specified budget (e.g., 100ms for obstacle detection to braking)
- **Failure handling**: Verify that node crashes, topic timeouts, and parameter server failures are handled correctly
- **Resource behavior**: Verify that memory usage, CPU usage, and message queue depths remain within bounds under sustained operation

### 2.8 Software Verification

ISO 26262-6, Clause 11 covers the overall verification of software against safety requirements through:

1. **Requirements-based testing**: Every software safety requirement has at least one test case
2. **Structural coverage analysis**: Coverage metrics meet ASIL-level thresholds
3. **Static analysis**: Code analyzed for MISRA compliance, undefined behavior, and potential runtime errors
4. **Code review**: Safety-critical code reviewed by independent reviewer (not the author)
5. **Back-to-back testing**: If model-based development is used, verify code matches model behavior

---

## 3. MISRA C:2012 for ROS Noetic Safety-Critical Nodes

### 3.1 Overview of MISRA C Rule Categories

MISRA C:2012 (with Amendment 2 and Technical Corrigendum 2, updated through 2023) contains 175 guidelines organized as:

- **16 Directives**: High-level guidance that may require judgment to verify (e.g., Dir 4.1: "Run-time failures shall be minimized")
- **159 Rules**: Specific, automatically checkable constraints on code constructs

Each guideline has a category:

| Category | Meaning | Deviation Requirement |
|---|---|---|
| **Mandatory** | Must be followed; no deviation permitted | None allowed |
| **Required** | Must be followed unless formally deviated | Written deviation record with justification |
| **Advisory** | Should be followed; may be disapplied without formal deviation | Project policy decision |

**Distribution in MISRA C:2012:**
- Mandatory: 10 rules
- Required: 110 rules + 14 directives
- Advisory: 39 rules + 2 directives

### 3.2 Most Relevant Rules for ROS C++ Nodelets

Although Aurrigo's nodelets are C++, MISRA C:2012 rules remain relevant for the safety controller firmware (pure C) and for C-style patterns within C++ code. MISRA C++:2023 (Section 3.3) covers the C++ nodelets directly.

**Rule 1.3 (Mandatory) -- No undefined behavior:**
The most critical rule. Undefined behavior in C/C++ means the compiler can assume the situation never occurs and optimize accordingly, potentially removing safety checks. Common UB in ROS code:

- Signed integer overflow in timestamp arithmetic
- Null pointer dereference when sensor data is unavailable
- Use-after-free in callback closures that capture references
- Buffer overflows in fixed-size arrays used for point cloud processing
- Data races between callback threads accessing shared state without locks

**Rule 10.x -- Type conversions:**
ROS message types use specific integer widths (uint32_t for sequence numbers, float64 for coordinates). Implicit conversions between these types, especially narrowing conversions (double to float, int64_t to int32_t), can silently lose data.

```cpp
// MISRA violation: implicit narrowing conversion
float speed = msg->twist.linear.x;  // double to float, potential precision loss

// Compliant: explicit cast with range check
double speed_raw = msg->twist.linear.x;
if (speed_raw > static_cast<double>(std::numeric_limits<float>::max())) {
    safe_trigger_emergency_stop(ESTOP_INVALID_DATA);
    return;
}
float speed = static_cast<float>(speed_raw);
```

**Rule 17.x -- Functions:**
- Rule 17.2 (Required): Functions shall not call themselves (no recursion). This rules out recursive tree traversals sometimes used in octree-based obstacle maps.
- Rule 17.7 (Required): Return values shall be used. ROS code frequently ignores return values from `ros::ok()`, `subscriber.getNumPublishers()`, and similar.

**Rule 21.x -- Standard library:**
- Rule 21.3 (Required): `<stdlib.h>` memory allocation functions (`malloc`, `calloc`, `realloc`, `free`) shall not be used. This conflicts directly with ROS's pervasive dynamic allocation (every message publish allocates).
- Rule 21.6 (Required): `<stdio.h>` input/output functions shall not be used. ROS logging macros (`ROS_INFO`, `ROS_ERROR`) internally use stdio.

### 3.3 MISRA C++:2023 -- The New Standard

MISRA C++:2023, published October 2023, replaces both MISRA C++:2008 and subsumes AUTOSAR C++14 guidelines. It targets C++17 and represents a fundamental rewrite rather than an incremental update.

**Key changes from MISRA C++:2008:**

| Aspect | MISRA C++:2008 | MISRA C++:2023 |
|---|---|---|
| Language standard | C++03 | C++17 |
| Number of guidelines | 228 rules | 179 guidelines (4 directives + 175 rules) |
| AUTOSAR alignment | Separate standard | Merged (AUTOSAR C++14 absorbed) |
| Modern C++ features | Not covered | constexpr, structured bindings, std::optional, std::variant, lambdas, move semantics |
| Template metaprogramming | Minimal coverage | Comprehensive rules for safe template usage |
| Exception handling | Blanket "do not use" approach | Nuanced rules; exceptions permitted with constraints |
| Smart pointers | Not covered (pre-C++11) | Rules for std::unique_ptr, std::shared_ptr usage |

**MISRA C++:2023 rules most relevant to ROS Noetic C++ nodelets:**

- **Rule 0.1.1 (Required)**: A variable shall not have an in-scope value that is not accessed. Common in ROS when error codes from service calls are discarded.
- **Rule 6.0.1 (Required)**: A block scope variable shall not shadow a higher-scope variable. Frequent in ROS callbacks where `msg` parameters shadow class member names.
- **Rule 6.4.1 (Required)**: An init-statement or a condition in a selection or iteration statement shall not contain a function call with non-essential side effects.
- **Rule 8.2.5 (Required)**: A virtual function shall not be overridden by a non-virtual function. Relevant to nodelet plugin interfaces.
- **Rule 11.3.1 (Required)**: Variables of arithmetic type shall not be used in boolean expressions. Common in ROS code like `if (subscriber.getNumPublishers())`.
- **Rule 15.1.1 (Advisory)**: An exception object shall not be a pointer. ROS exception handling often uses pointers.
- **Rule 21.6.4 (Required)**: The macro offsetof shall not be used. Sometimes seen in custom serialization code.
- **Rule 28.6.2 (Required)**: The operand of a typeid expression shall not be an expression of polymorphic class type. Occurs in dynamic plugin loading (pluginlib).

### 3.4 ROS C++ Patterns That Violate MISRA and How to Fix Them

**Pattern 1: Unchecked topic subscription data**

```cpp
// NON-COMPLIANT: No null check, potential undefined behavior
void callback(const sensor_msgs::PointCloud2::ConstPtr& msg) {
    int num_points = msg->width * msg->height;  // Rule 1.3: UB if msg is null
    // Rule 10.4: implicit conversion uint32*uint32 may overflow
}

// COMPLIANT:
void callback(const sensor_msgs::PointCloud2::ConstPtr& msg) {
    if (!msg) {
        ROS_ERROR("Null message received on point cloud topic");
        return;
    }
    const uint64_t num_points = 
        static_cast<uint64_t>(msg->width) * static_cast<uint64_t>(msg->height);
    if (num_points > MAX_SAFE_POINT_COUNT) {
        ROS_WARN("Point count %lu exceeds safety limit", num_points);
        return;
    }
}
```

**Pattern 2: Global state mutation in callbacks**

```cpp
// NON-COMPLIANT: Shared mutable state without synchronization (Rule 1.3: data race = UB)
class ObstacleDetector : public nodelet::Nodelet {
    std::vector<Obstacle> obstacles_;  // Written by callback, read by timer
    
    void cloudCallback(const sensor_msgs::PointCloud2::ConstPtr& msg) {
        obstacles_.clear();  // Data race with timer callback
        // ... populate obstacles_ ...
    }
    
    void publishObstacles(const ros::TimerEvent&) {
        for (const auto& obs : obstacles_) {  // Data race with cloud callback
            // ...
        }
    }
};

// COMPLIANT: Lock-free double buffer or mutex-protected swap
class ObstacleDetector : public nodelet::Nodelet {
    std::array<std::vector<Obstacle>, 2U> obstacle_buffers_;
    std::atomic<uint8_t> active_buffer_{0U};
    
    void cloudCallback(const sensor_msgs::PointCloud2::ConstPtr& msg) {
        if (!msg) { return; }
        const uint8_t write_idx = 1U - active_buffer_.load(std::memory_order_acquire);
        obstacle_buffers_[write_idx].clear();
        // ... populate obstacle_buffers_[write_idx] ...
        active_buffer_.store(write_idx, std::memory_order_release);
    }
    
    void publishObstacles(const ros::TimerEvent&) {
        const uint8_t read_idx = active_buffer_.load(std::memory_order_acquire);
        for (const auto& obs : obstacle_buffers_[read_idx]) {
            // Safe: reading from buffer not being written
        }
    }
};
```

**Pattern 3: Dynamic allocation in real-time path**

```cpp
// NON-COMPLIANT: std::vector resize in real-time callback (MISRA C Rule 21.3 analogy)
void planCallback(const ros::TimerEvent&) {
    std::vector<TrajectoryPoint> candidates;  // Heap allocation
    candidates.reserve(420);  // Another allocation if capacity insufficient
    for (int i = 0; i < 420; ++i) {
        candidates.push_back(generateCandidate(i));  // May trigger reallocation
    }
}

// COMPLIANT: Pre-allocated fixed buffer
class FrenetPlanner {
    static constexpr size_t MAX_CANDIDATES = 512U;
    std::array<TrajectoryPoint, MAX_CANDIDATES> candidate_buffer_;
    
    void planCallback(const ros::TimerEvent&) {
        size_t count = 0U;
        for (size_t i = 0U; (i < 420U) && (i < MAX_CANDIDATES); ++i) {
            candidate_buffer_[i] = generateCandidate(i);
            ++count;
        }
        // Use candidate_buffer_[0..count-1]
    }
};
```

### 3.5 Example: Converting a Typical ROS Callback to MISRA-Compliant Code

**Before (typical ROS style):**

```cpp
void SafetyNode::laserCallback(const sensor_msgs::LaserScan::ConstPtr& scan) {
    bool obstacle_near = false;
    for (int i = 0; i < scan->ranges.size(); i++) {
        float r = scan->ranges[i];
        if (r < min_range_ && r > scan->range_min) {
            obstacle_near = true;
            last_obstacle_time_ = ros::Time::now();
            break;
        }
    }
    if (obstacle_near || (ros::Time::now() - last_obstacle_time_).toSec() < holdoff_sec_) {
        geometry_msgs::Twist stop;
        cmd_pub_.publish(stop);
    }
}
```

**MISRA violations in the above:**

1. Rule 1.3: No null check on `scan`
2. Rule 10.4: `int i` compared with `size_t` (signed/unsigned mismatch)
3. Rule 10.3: `float r` assigned from potentially double-precision value
4. Rule 12.1: Operator precedence unclear in compound condition
5. Rule 14.2: Loop variable `i` is `int` but compared with unsigned
6. Shared `last_obstacle_time_` potentially accessed from multiple threads without synchronization

**After (MISRA-compliant):**

```cpp
void SafetyNode::laserCallback(const sensor_msgs::LaserScan::ConstPtr& scan) {
    if (!scan) {
        safe_trigger_emergency_stop(ESTOP_NULL_SENSOR_DATA);
        return;
    }
    
    const size_t range_count = scan->ranges.size();
    if (range_count == 0U) {
        return;
    }
    
    bool obstacle_near = false;
    const float range_min = scan->range_min;
    const float threshold = static_cast<float>(min_range_);
    
    for (size_t i = 0U; i < range_count; ++i) {
        const float range_val = scan->ranges[i];
        const bool above_minimum = (range_val > range_min);
        const bool below_threshold = (range_val < threshold);
        
        if (above_minimum && below_threshold) {
            obstacle_near = true;
            last_obstacle_time_.store(
                ros::Time::now().toSec(), std::memory_order_release);
            break;
        }
    }
    
    const double elapsed = ros::Time::now().toSec() 
        - last_obstacle_time_.load(std::memory_order_acquire);
    const bool in_holdoff = (elapsed < holdoff_sec_);
    
    if (obstacle_near || in_holdoff) {
        geometry_msgs::Twist stop_cmd;
        stop_cmd.linear.x = 0.0;
        stop_cmd.linear.y = 0.0;
        stop_cmd.angular.z = 0.0;
        cmd_pub_.publish(stop_cmd);
    }
}
```

---

## 4. Static Analysis Tools

### 4.1 Polyspace (MathWorks)

**Polyspace Bug Finder** performs pattern-based static analysis similar to lint tools but with deeper inter-procedural analysis. It detects MISRA violations, CWE weaknesses, and common coding defects.

**Polyspace Code Prover** performs abstract interpretation -- a formal method that mathematically proves the absence of specific runtime errors (division by zero, buffer overflow, null pointer dereference) or identifies code paths where such errors are possible. This is the gold standard for safety-critical code verification.

- **ISO 26262 qualification**: TUV SUD certified; IEC Certification Kit available for ISO 26262 and IEC 61508 tool qualification
- **MISRA coverage**: Full MISRA C:2012, MISRA C:2023, MISRA C++:2023, AUTOSAR C++14
- **Integration**: MATLAB/Simulink integration, Jenkins/CI plugins, Eclipse IDE
- **Platforms**: Supports cross-compilation analysis for aarch64 (Orin)
- **Estimated cost**: $15,000-$50,000/year depending on product (Bug Finder vs Code Prover) and license type

### 4.2 Parasoft C/C++test

Parasoft provides a unified static analysis, unit testing, and code coverage platform certified by TUV SUD for ISO 26262, IEC 61508, IEC 62304, and EN 50128.

- **ISO 26262 qualification**: TUV SUD certified; comes with ISO 26262 Qualification Kit
- **MISRA coverage**: Full MISRA C:2012, MISRA C:2023, MISRA C++:2008, MISRA C++:2023, AUTOSAR C++14; over 2,500 rules total
- **Unit testing**: Built-in framework with automatic test case generation and MC/DC coverage measurement
- **Integration**: Jenkins, GitLab CI, Azure DevOps, Eclipse, VS Code
- **MISRA Compliance Pack**: Generates MISRA compliance documentation automatically
- **Estimated cost**: $5,000-$20,000/seat/year

### 4.3 PC-lint Plus (Vector/Gimpel)

PC-lint Plus (acquired by Vector Informatik in 2022) is a deep semantic analysis tool for C/C++ that goes beyond pattern matching using value tracking, interprocedural analysis, and strong type enforcement.

- **ISO 26262 qualification**: Not TUV-certified as a qualified tool, but widely used in automotive; teams must perform their own tool qualification per ISO 26262-8, Clause 11
- **MISRA coverage**: Over 90% of MISRA C++:2023 guidelines (as of 2025 SP1); MISRA C:2012, MISRA C:2023, MISRA C:2025, AUTOSAR C++14/17, CERT C
- **Key strength**: Value tracking -- propagates known values through code paths to detect errors that simpler checkers miss
- **Integration**: Command-line tool, integrates with any CI system, IDE plugins for VS Code and Eclipse
- **Estimated cost**: Team-based licensing, approximately $1,000-$5,000/team/year (contact sales@gimpel.com)

### 4.4 cppcheck

cppcheck is the most widely used open-source C/C++ static analysis tool, used by comma.ai for MISRA compliance checking on their panda safety firmware.

- **ISO 26262 qualification**: Not qualified; not suitable as the sole static analysis tool for ASIL B+ claims. Acceptable as a supplementary tool or for QM-level code.
- **MISRA coverage**: MISRA C:2012 addon (community-maintained, covers approximately 60-70% of rules); MISRA C++ support more limited
- **Key strength**: Zero cost, easy integration, low false-positive rate, good baseline coverage
- **Integration**: Native CMake/GCC integration, Jenkins plugin, GitHub Actions
- **Platform**: Cross-platform, works on aarch64 natively
- **Cost**: Free (GPLv3)

**cppcheck MISRA usage (as used by comma.ai panda):**

```bash
# Run cppcheck with MISRA C:2012 addon
cppcheck --addon=misra.json \
         --enable=all \
         --suppress=missingIncludeSystem \
         --error-exitcode=1 \
         --inline-suppr \
         board/safety/*.c board/safety/*.h
```

### 4.5 clang-tidy

clang-tidy is Clang's linter/static analysis frontend. While it does not implement MISRA rules directly, its checker groups overlap significantly with MISRA intent:

- **cert-\***: CERT C/C++ Secure Coding Standard (significant overlap with MISRA)
- **bugprone-\***: Detects common bug patterns (null dereference, dangling references, narrowing conversions)
- **performance-\***: Unnecessary copies, inefficient container usage
- **readability-\***: Naming conventions, implicit conversions, misleading indentation
- **cppcoreguidelines-\***: C++ Core Guidelines (Stroustrup/Sutter)
- **modernize-\***: Identifies legacy patterns that should use C++17 features

- **ISO 26262 qualification**: Not qualified
- **MISRA coverage**: Indirect -- covers ~30-40% of MISRA intent through cert-* and bugprone-* checkers
- **Key strength**: Deep Clang AST analysis, excellent for C++17 code, integrates with clang-format
- **Cost**: Free (Apache 2.0)

### 4.6 Coverity (Synopsys / Black Duck)

Coverity is an enterprise-grade static analysis tool with the lowest false-positive rate among commercial tools (industry claims of <15% false positive rate).

- **ISO 26262 qualification**: TUV SUD certified for IEC 61508, classified as T2 for use up to ASIL D per ISO 26262:2018
- **MISRA coverage**: MISRA C:2012, MISRA C++:2008, MISRA C++:2023, CERT, AUTOSAR, CWE
- **Key strength**: Interprocedural whole-program analysis; defect prioritization by severity; lowest false-positive rate
- **Integration**: Coverity Connect server, Jenkins, GitHub, GitLab, Jira
- **Qualification Kit**: Available for ISO 26262 tool validation within customer's build environment
- **Estimated cost**: $25,000-$100,000+/year (enterprise pricing, project-based)

### 4.7 Comparison Table

| Tool | Cost (Annual) | MISRA C:2012 | MISRA C++:2023 | ISO 26262 Qualified | MC/DC Coverage | CI Integration |
|---|---|---|---|---|---|---|
| Polyspace Bug Finder | $15K-$30K | Full | Full | TUV SUD | No (separate tool) | Jenkins, GitLab |
| Polyspace Code Prover | $30K-$50K | Full | Full | TUV SUD | No | Jenkins, GitLab |
| Parasoft C/C++test | $5K-$20K/seat | Full | Full | TUV SUD | Yes (built-in) | Jenkins, GitLab, Azure |
| PC-lint Plus | $1K-$5K/team | Full | >90% | Not certified (self-qualify) | No | Any (CLI) |
| cppcheck | Free | ~60-70% (addon) | Limited | No | No | Any (CLI) |
| clang-tidy | Free | Indirect (~35%) | Indirect (~35%) | No | No | Any (CLI) |
| Coverity | $25K-$100K+ | Full | Full | TUV SUD (ASIL D) | No | Coverity Connect |

**Recommended approach for Aurrigo (cost-effective):**

1. **Immediate (free)**: cppcheck + clang-tidy in CI for all code
2. **Phase 2 ($5K-$10K)**: PC-lint Plus for ASIL B nodelets and safety controller firmware
3. **Phase 3 ($20K+)**: Parasoft C/C++test or Polyspace for certification-grade evidence on safety-critical paths

---

## 5. Compiler Flags for Safety

### 5.1 GCC/Clang Safety Flags

The default `catkin_make` configuration uses minimal warning flags. Safety-critical code requires significantly stricter settings.

**Recommended CMakeLists.txt for safety-critical nodelets:**

```cmake
# Safety-critical compilation flags for ASIL B nodelets
set(SAFETY_CXX_FLAGS
    -Wall                    # Enable all standard warnings
    -Wextra                  # Extra warnings beyond -Wall
    -Werror                  # Treat all warnings as errors
    -Wpedantic               # Strict ISO C++ compliance warnings
    -Wconversion             # Warn on implicit type conversions (MISRA 10.x)
    -Wsign-conversion        # Warn on sign conversion (MISRA 10.3)
    -Wfloat-conversion       # Warn on float-to-int conversion
    -Wshadow                 # Warn on variable shadowing (MISRA 6.0.1)
    -Wdouble-promotion       # Warn when float is implicitly promoted to double
    -Wformat=2               # Enhanced format string checking
    -Wformat-security        # Warn about format string vulnerabilities
    -Wnull-dereference       # Warn about null pointer dereferences
    -Wuninitialized          # Warn about uninitialized variable use
    -Wstrict-overflow=4      # Warn about signed overflow assumptions
    -Wcast-align             # Warn about pointer cast alignment issues
    -Wno-unused-parameter    # Suppress for ROS callback signatures (deviation documented)
    -fno-strict-aliasing     # Disable strict aliasing (safer, minor perf cost)
    -fstack-protector-strong # Stack canary for functions with local arrays/buffers
    -fstack-clash-protection # Prevent stack clash attacks
    -D_FORTIFY_SOURCE=2      # Runtime buffer overflow detection in libc
    -D_GLIBCXX_ASSERTIONS    # Enable libstdc++ assertion checks
)

# Apply to safety-critical targets only
target_compile_options(arbitrator_nodelet PRIVATE ${SAFETY_CXX_FLAGS})
target_compile_options(obstacle_detection_nodelet PRIVATE ${SAFETY_CXX_FLAGS})
target_compile_options(can_safety_node PRIVATE ${SAFETY_CXX_FLAGS})
```

**For the safety controller firmware (bare-metal C, GCC ARM):**

```makefile
# Safety controller firmware flags (matches comma.ai panda approach)
SAFETY_CFLAGS = \
    -Wall -Wextra -Werror \
    -Wstrict-prototypes \
    -Wmissing-prototypes \
    -Wold-style-definition \
    -Wno-unused-parameter \
    -fno-common \
    -ffunction-sections \
    -fdata-sections \
    -fno-exceptions \
    -fno-unwind-tables \
    -fno-asynchronous-unwind-tables \
    -fstack-protector-strong \
    -mthumb -mcpu=cortex-m7 \
    -specs=nano.specs
```

### 5.2 Undefined Behavior Sanitizers for Testing

Sanitizers instrument the binary at compile time to detect undefined behavior at runtime. They must be enabled for test builds, not production builds (5-15x performance overhead).

```cmake
# Test build configuration with sanitizers
if(ENABLE_SANITIZERS)
    set(SANITIZER_FLAGS
        -fsanitize=undefined      # UndefinedBehaviorSanitizer: signed overflow,
                                  # null deref, misaligned access, etc.
        -fsanitize=address        # AddressSanitizer: buffer overflow, use-after-free,
                                  # use-after-return, double-free
        -fsanitize=thread         # ThreadSanitizer: data races (cannot combine with ASan)
        -fno-omit-frame-pointer   # Better stack traces in sanitizer reports
        -fno-sanitize-recover=all # Abort on first violation (don't continue)
    )
    # NOTE: ASan and TSan cannot be used simultaneously.
    # Run separate CI jobs for each.
endif()
```

**Usage in CI pipeline:**

```bash
# Job 1: Build and test with AddressSanitizer + UBSan
catkin_make -DCMAKE_BUILD_TYPE=Debug \
    -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer" \
    -DCMAKE_EXE_LINKER_FLAGS="-fsanitize=address,undefined"
catkin_make run_tests

# Job 2: Build and test with ThreadSanitizer
catkin_make -DCMAKE_BUILD_TYPE=Debug \
    -DCMAKE_CXX_FLAGS="-fsanitize=thread -fno-omit-frame-pointer" \
    -DCMAKE_EXE_LINKER_FLAGS="-fsanitize=thread"
catkin_make run_tests
```

### 5.3 Deterministic Builds for Reproducibility

ISO 26262-6, Clause 8.4.5 requires that the build process be reproducible. The same source code, build environment, and configuration must produce identical binaries.

```cmake
# Deterministic build flags
set(DETERMINISTIC_FLAGS
    -ffile-prefix-map=${CMAKE_SOURCE_DIR}=.  # Strip absolute paths from debug info
    -fmacro-prefix-map=${CMAKE_SOURCE_DIR}=. # Strip paths from __FILE__ macro
    -fdebug-prefix-map=${CMAKE_SOURCE_DIR}=. # Strip paths from DWARF debug info
    -frandom-seed=${TARGET_NAME}             # Deterministic random seed per target
)

# Reproducibility: fix timestamps
set(ENV{SOURCE_DATE_EPOCH} "0")  # Epoch 0 for reproducible embedded timestamps
```

**Verification:**

```bash
# Build twice, compare SHA-256 hashes
sha256sum build_1/devel/lib/libarbitrator_nodelet.so
sha256sum build_2/devel/lib/libarbitrator_nodelet.so
# Hashes must match for certification evidence
```

### 5.4 Cross-Compilation for Orin (aarch64)

The Orin runs on aarch64 (ARM64) architecture. Safety flags must be verified on the target architecture, as some behaviors differ:

```cmake
# aarch64-specific considerations
if(CMAKE_SYSTEM_PROCESSOR STREQUAL "aarch64")
    # Stack protection: verify GCC >= 7 for proper aarch64 stack frame layout
    # Earlier versions may not detect dynamically-sized local variable overflows
    if(CMAKE_CXX_COMPILER_VERSION VERSION_LESS "7.0")
        message(FATAL_ERROR "GCC >= 7 required for aarch64 stack protection")
    endif()
    
    # ARM-specific security features
    list(APPEND SAFETY_CXX_FLAGS
        -mbranch-protection=standard  # Branch Target Identification (BTI)
                                      # + Pointer Authentication (PAC)
        -moutline-atomics             # Use outline atomics for better
                                      # compatibility across Cortex-A variants
    )
    
    # Shadow call stack (Clang only, strong return address protection)
    if(CMAKE_CXX_COMPILER_ID STREQUAL "Clang")
        list(APPEND SAFETY_CXX_FLAGS -fsanitize=shadow-call-stack)
    endif()
endif()
```

---

## 6. Runtime Safety Patterns for ROS

### 6.1 Watchdog Timers for Node Health

A watchdog timer detects when a node has stopped functioning (hang, deadlock, infinite loop) and triggers recovery action.

**Watchdog timer implementation for safety-critical ROS nodes:**

```cpp
#include <ros/ros.h>
#include <std_msgs/Bool.h>
#include <std_msgs/String.h>
#include <atomic>
#include <cstdint>

/**
 * @brief Software watchdog for safety-critical ROS nodes.
 * 
 * Each monitored node must call kick() periodically (via heartbeat topic).
 * If any monitored node fails to kick within its timeout, the watchdog
 * triggers an emergency stop.
 * 
 * Design: ASIL B compliant
 * - No dynamic allocation after initialization
 * - Deterministic timing via ros::Timer
 * - Atomic state variables for thread safety
 * - Single entry/exit per function
 */
class SafetyWatchdog {
public:
    static constexpr uint32_t MAX_MONITORED_NODES = 16U;
    
    struct MonitoredNode {
        std::string name;
        double timeout_sec;
        std::atomic<double> last_kick_time{0.0};
        std::atomic<bool> alive{false};
        ros::Subscriber heartbeat_sub;
    };

private:
    std::array<MonitoredNode, MAX_MONITORED_NODES> nodes_;
    uint32_t node_count_;
    ros::Publisher estop_pub_;
    ros::Publisher status_pub_;
    ros::Timer check_timer_;
    std::atomic<bool> system_healthy_{true};

public:
    explicit SafetyWatchdog(ros::NodeHandle& nh) : node_count_(0U) {
        estop_pub_ = nh.advertise<std_msgs::Bool>("/safety/e_stop", 1, true);
        status_pub_ = nh.advertise<std_msgs::String>("/safety/watchdog_status", 1);
        
        // Check at 50Hz (20ms period) — must be faster than shortest timeout
        check_timer_ = nh.createTimer(
            ros::Duration(0.02), &SafetyWatchdog::checkAll, this);
    }
    
    bool addNode(ros::NodeHandle& nh, const std::string& node_name, 
                 const std::string& heartbeat_topic, double timeout_sec) {
        if (node_count_ >= MAX_MONITORED_NODES) {
            ROS_FATAL("Watchdog: cannot monitor more than %u nodes", 
                      MAX_MONITORED_NODES);
            return false;
        }
        
        const uint32_t idx = node_count_;
        nodes_[idx].name = node_name;
        nodes_[idx].timeout_sec = timeout_sec;
        nodes_[idx].last_kick_time.store(ros::Time::now().toSec(),
                                          std::memory_order_release);
        nodes_[idx].alive.store(true, std::memory_order_release);
        
        // Capture index by value (not reference) for thread safety
        nodes_[idx].heartbeat_sub = nh.subscribe<std_msgs::Bool>(
            heartbeat_topic, 1,
            [this, idx](const std_msgs::Bool::ConstPtr& msg) {
                if (msg && msg->data) {
                    nodes_[idx].last_kick_time.store(
                        ros::Time::now().toSec(), std::memory_order_release);
                }
            });
        
        ++node_count_;
        return true;
    }
    
    void checkAll(const ros::TimerEvent& /*event*/) {
        const double now = ros::Time::now().toSec();
        bool all_healthy = true;
        
        for (uint32_t i = 0U; i < node_count_; ++i) {
            const double last_kick = 
                nodes_[i].last_kick_time.load(std::memory_order_acquire);
            const double elapsed = now - last_kick;
            const bool node_ok = (elapsed < nodes_[i].timeout_sec);
            
            nodes_[i].alive.store(node_ok, std::memory_order_release);
            
            if (!node_ok) {
                ROS_ERROR_THROTTLE(1.0, "Watchdog: node '%s' timeout (%.3fs > %.3fs)",
                    nodes_[i].name.c_str(), elapsed, nodes_[i].timeout_sec);
                all_healthy = false;
            }
        }
        
        if (!all_healthy) {
            triggerEmergencyStop();
        }
        
        system_healthy_.store(all_healthy, std::memory_order_release);
    }

private:
    void triggerEmergencyStop() {
        std_msgs::Bool estop_msg;
        estop_msg.data = true;
        estop_pub_.publish(estop_msg);
        // Also trigger hardware e-stop via CAN (independent of ROS)
    }
};
```

### 6.2 Heartbeat Monitoring Between Nodes

Each safety-critical node publishes a heartbeat at a defined rate. The heartbeat message includes a sequence counter to detect not only absence but also duplication or reordering.

```cpp
// In each safety-critical node's initialization:
class SafetyNodeBase {
protected:
    ros::Publisher heartbeat_pub_;
    ros::Timer heartbeat_timer_;
    uint32_t heartbeat_seq_;
    
    void initHeartbeat(ros::NodeHandle& nh, double rate_hz) {
        heartbeat_pub_ = nh.advertise<std_msgs::Bool>(
            "~heartbeat", 1);
        heartbeat_seq_ = 0U;
        heartbeat_timer_ = nh.createTimer(
            ros::Duration(1.0 / rate_hz), 
            &SafetyNodeBase::publishHeartbeat, this);
    }
    
    void publishHeartbeat(const ros::TimerEvent& /*event*/) {
        std_msgs::Bool msg;
        msg.data = true;
        heartbeat_pub_.publish(msg);
        ++heartbeat_seq_;
    }
};
```

### 6.3 Memory Allocation: Avoiding Dynamic Allocation in Safety-Critical Paths

Dynamic memory allocation (`new`, `malloc`, `std::vector::push_back`) is non-deterministic in timing and can fail unpredictably. For safety-critical code paths (ASIL B+), all memory must be pre-allocated during initialization.

**Strategy: pool allocators for ROS messages**

```cpp
#include <array>
#include <atomic>
#include <cstdint>

/**
 * @brief Fixed-size pool allocator for safety-critical message handling.
 * 
 * Pre-allocates N objects of type T at construction time.
 * acquire() and release() are lock-free and O(1).
 * No heap allocation occurs after construction.
 */
template <typename T, size_t N>
class SafeMessagePool {
    static_assert(N > 0U, "Pool size must be positive");
    static_assert(N <= 256U, "Pool size limited to 256 for index type");
    
    struct Slot {
        T object;
        std::atomic<bool> in_use{false};
    };
    
    std::array<Slot, N> pool_;
    
public:
    SafeMessagePool() = default;
    
    // Returns pointer to available object, or nullptr if pool exhausted
    T* acquire() {
        for (size_t i = 0U; i < N; ++i) {
            bool expected = false;
            if (pool_[i].in_use.compare_exchange_strong(
                    expected, true, std::memory_order_acq_rel)) {
                return &(pool_[i].object);
            }
        }
        return nullptr;  // Pool exhausted — caller must handle
    }
    
    void release(T* obj) {
        if (obj == nullptr) { return; }
        for (size_t i = 0U; i < N; ++i) {
            if (&(pool_[i].object) == obj) {
                pool_[i].in_use.store(false, std::memory_order_release);
                return;
            }
        }
        // Object not from this pool — programming error, log and continue
    }
    
    size_t available() const {
        size_t count = 0U;
        for (size_t i = 0U; i < N; ++i) {
            if (!pool_[i].in_use.load(std::memory_order_acquire)) {
                ++count;
            }
        }
        return count;
    }
};
```

### 6.4 Thread Safety: Lock-Free Patterns for Real-Time Callbacks

ROS callback queues invoke callbacks from spinner threads. In a multi-threaded spinner configuration (which Aurrigo uses for performance), callbacks from different topics can execute concurrently. Mutexes are not suitable for safety-critical real-time code because they introduce priority inversion and unbounded blocking.

**Lock-free SPSC (Single-Producer, Single-Consumer) ring buffer:**

```cpp
/**
 * @brief Lock-free single-producer single-consumer ring buffer.
 * 
 * Suitable for passing data from a ROS subscriber callback (producer)
 * to a timer callback (consumer) without locks.
 * 
 * Constraints:
 * - Exactly one thread calls push(), exactly one calls pop()
 * - Size must be power of 2 for efficient modulo
 * - No dynamic allocation
 */
template <typename T, size_t SIZE>
class SPSCRingBuffer {
    static_assert((SIZE & (SIZE - 1U)) == 0U, "SIZE must be power of 2");
    
    std::array<T, SIZE> buffer_;
    std::atomic<size_t> head_{0U};  // Written by producer
    std::atomic<size_t> tail_{0U};  // Written by consumer
    
    static constexpr size_t MASK = SIZE - 1U;
    
public:
    bool push(const T& item) {
        const size_t h = head_.load(std::memory_order_relaxed);
        const size_t next_h = (h + 1U) & MASK;
        if (next_h == tail_.load(std::memory_order_acquire)) {
            return false;  // Buffer full
        }
        buffer_[h] = item;
        head_.store(next_h, std::memory_order_release);
        return true;
    }
    
    bool pop(T& item) {
        const size_t t = tail_.load(std::memory_order_relaxed);
        if (t == head_.load(std::memory_order_acquire)) {
            return false;  // Buffer empty
        }
        item = buffer_[t];
        tail_.store((t + 1U) & MASK, std::memory_order_release);
        return true;
    }
};
```

### 6.5 Exception Handling Policy

**Rule for safety-critical ROS nodes: no exceptions in the safety path.**

Exceptions in C++ introduce non-local control flow that is difficult to reason about in safety analysis. Stack unwinding is non-deterministic in timing and can interact badly with RT scheduling. MISRA C++:2023 permits exceptions with constraints, but for ASIL B airside AVs, the simpler approach is to prohibit them in safety-critical code.

```cmake
# For safety-critical nodelets: disable exceptions entirely
target_compile_options(arbitrator_nodelet PRIVATE -fno-exceptions -fno-rtti)

# Note: this means the nodelet CANNOT use:
# - try/catch blocks
# - throw statements
# - dynamic_cast<> (requires RTTI)
# - std::any, std::variant visit with exceptions
# Error handling must use return codes or std::optional<T>
```

**Error handling pattern without exceptions:**

```cpp
enum class SafeResult : uint8_t {
    OK = 0U,
    ERROR_NULL_INPUT = 1U,
    ERROR_OUT_OF_RANGE = 2U,
    ERROR_TIMEOUT = 3U,
    ERROR_INVALID_STATE = 4U
};

struct CommandResult {
    SafeResult status;
    geometry_msgs::Twist command;
};

CommandResult safe_compute_command(
    const nav_msgs::Odometry* odom,
    const std::array<Obstacle, 64>& obstacles,
    size_t obstacle_count) 
{
    CommandResult result;
    result.status = SafeResult::OK;
    result.command = geometry_msgs::Twist();  // Zero-initialized
    
    if (odom == nullptr) {
        result.status = SafeResult::ERROR_NULL_INPUT;
        return result;  // Single exit point pattern: always returns result
    }
    
    if (obstacle_count > 64U) {
        result.status = SafeResult::ERROR_OUT_OF_RANGE;
        return result;
    }
    
    // ... compute command ...
    
    return result;
}
```

### 6.6 Deterministic Timing: RT_PREEMPT Kernel, SCHED_FIFO

For safety-critical nodes that must meet hard timing deadlines (e.g., 20ms control loop, 100ms obstacle detection), the standard Linux kernel is insufficient. The PREEMPT_RT patch transforms the kernel into a fully preemptible real-time kernel, reducing worst-case latencies from milliseconds to microseconds.

**Setup for Orin (JetPack / L4T):**

```bash
# Verify RT_PREEMPT is enabled in the running kernel
uname -a  # Should show "PREEMPT RT" or "PREEMPT_RT"

# If not available in stock JetPack, build a custom kernel:
# 1. Get NVIDIA kernel sources for your JetPack version
# 2. Apply PREEMPT_RT patch matching the kernel version
# 3. Configure: CONFIG_PREEMPT_RT=y, CONFIG_HZ=1000
# 4. Cross-compile and flash

# Verify RT scheduling capability
chrt -m  # Shows available scheduling policies
```

**Setting RT priority for safety-critical nodes:**

```cpp
#include <sched.h>
#include <sys/mman.h>

void configureRealTime(int priority) {
    // Lock all current and future memory pages (prevent page faults)
    if (mlockall(MCL_CURRENT | MCL_FUTURE) != 0) {
        ROS_FATAL("Failed to lock memory: %s", strerror(errno));
        // Continue — degraded but not fatal
    }
    
    // Set SCHED_FIFO scheduling policy
    struct sched_param param;
    param.sched_priority = priority;  // 1-99, higher = more urgent
    
    if (sched_setscheduler(0, SCHED_FIFO, &param) != 0) {
        ROS_ERROR("Failed to set RT scheduling: %s", strerror(errno));
        // Fallback: continue with normal scheduling
    }
}

// In node main() or nodelet onInit():
// Priority mapping:
//   99: Hardware watchdog / CAN safety (highest)
//   95: Software watchdog
//   90: Arbitrator
//   85: Emergency braking
//   80: Obstacle detection
//   70: Localization
//   50: Planning
//   Default: Perception, logging, diagnostics
```

**Launch file with RT priority via chrt:**

```xml
<!-- Safety-critical nodes with RT scheduling -->
<node pkg="safety_monitor" type="watchdog_node" name="watchdog"
      launch-prefix="chrt -f 95" required="true"/>
      
<node pkg="safety_monitor" type="arbitrator_node" name="arbitrator"
      launch-prefix="chrt -f 90" required="true"/>

<!-- Note: required="true" means roslaunch kills all nodes if this one dies -->
```

---

## 7. Testing Strategy

### 7.1 Unit Testing with gtest/gmock for ROS Nodes

ISO 26262-6, Clause 9 requires unit-level testing of safety-critical software components. For ROS C++ nodelets, the standard framework is Google Test (gtest) with Google Mock (gmock).

**Testing a safety-critical function:**

```cpp
// File: test/test_speed_limiter.cpp
#include <gtest/gtest.h>
#include "safety_monitor/speed_limiter.h"

class SpeedLimiterTest : public ::testing::Test {
protected:
    SpeedLimiter limiter_;
    
    void SetUp() override {
        limiter_.setZoneSpeed(ZoneType::APRON, 8.0 / 3.6);       // 8 km/h in m/s
        limiter_.setZoneSpeed(ZoneType::SERVICE_ROAD, 15.0 / 3.6); // 15 km/h
        limiter_.setZoneSpeed(ZoneType::MAINTENANCE, 5.0 / 3.6);   // 5 km/h
    }
};

// Statement coverage: basic functionality
TEST_F(SpeedLimiterTest, ApronZoneSpeedIsLimited) {
    geometry_msgs::Twist cmd;
    cmd.linear.x = 5.0;  // 5 m/s = 18 km/h — exceeds 8 km/h limit
    
    const auto result = limiter_.limit(cmd, ZoneType::APRON);
    
    EXPECT_NEAR(result.command.linear.x, 8.0 / 3.6, 0.01);
    EXPECT_EQ(result.was_limited, true);
}

// Branch coverage: speed within limit
TEST_F(SpeedLimiterTest, SpeedWithinLimitIsNotModified) {
    geometry_msgs::Twist cmd;
    cmd.linear.x = 1.0;  // 1 m/s = 3.6 km/h — within 8 km/h limit
    
    const auto result = limiter_.limit(cmd, ZoneType::APRON);
    
    EXPECT_NEAR(result.command.linear.x, 1.0, 0.001);
    EXPECT_EQ(result.was_limited, false);
}

// Branch coverage: negative speed (reverse)
TEST_F(SpeedLimiterTest, ReverseSpeedIsAlsoLimited) {
    geometry_msgs::Twist cmd;
    cmd.linear.x = -5.0;  // Reverse at 18 km/h
    
    const auto result = limiter_.limit(cmd, ZoneType::APRON);
    
    EXPECT_NEAR(result.command.linear.x, -(8.0 / 3.6), 0.01);
}

// MC/DC: compound decision in safety check
TEST_F(SpeedLimiterTest, MCDCAllowMotion) {
    // MC/DC test set for: e_stop_clear && speed_ok && obstacles_clear && heartbeat_valid
    
    // T1: All true → motion allowed
    EXPECT_TRUE(limiter_.allowMotion(true, true, true, true));
    // T2: e_stop_clear=false → motion denied
    EXPECT_FALSE(limiter_.allowMotion(false, true, true, true));
    // T3: speed_ok=false → motion denied
    EXPECT_FALSE(limiter_.allowMotion(true, false, true, true));
    // T4: obstacles_clear=false → motion denied
    EXPECT_FALSE(limiter_.allowMotion(true, true, false, true));
    // T5: heartbeat_valid=false → motion denied
    EXPECT_FALSE(limiter_.allowMotion(true, true, true, false));
}

// Boundary value analysis: speed exactly at limit
TEST_F(SpeedLimiterTest, SpeedExactlyAtLimitIsNotModified) {
    geometry_msgs::Twist cmd;
    cmd.linear.x = 8.0 / 3.6;  // Exactly at limit
    
    const auto result = limiter_.limit(cmd, ZoneType::APRON);
    
    EXPECT_NEAR(result.command.linear.x, 8.0 / 3.6, 0.001);
    EXPECT_EQ(result.was_limited, false);
}
```

### 7.2 MC/DC Coverage Requirements by ASIL Level

| ASIL | Required Coverage | Description |
|------|------------------|-------------|
| QM | None specified | Good practice: aim for 60%+ statement coverage |
| A | Statement coverage | Every executable statement reached at least once |
| B | Branch coverage (100%) | Every decision branch (if-true, if-false, each case) taken |
| C | Branch + MC/DC highly recommended | MC/DC demonstrates each condition independently affects outcome |
| D | MC/DC (100%) | Every condition in every decision independently shown to affect outcome |

**Coverage measurement with gcov/lcov in catkin:**

```cmake
# Enable coverage instrumentation
if(ENABLE_COVERAGE)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} --coverage -fprofile-arcs -ftest-coverage")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} --coverage")
endif()
```

```bash
# Run tests and generate coverage report
catkin_make run_tests -DENABLE_COVERAGE=ON
lcov --capture --directory build/ --output-file coverage.info
lcov --remove coverage.info '/usr/*' '*/test/*' --output-file filtered.info
genhtml filtered.info --output-directory coverage_report/

# For MC/DC coverage: gcov provides branch coverage only.
# MC/DC requires dedicated tools (Parasoft, VectorCAST, LDRA Testbed)
```

### 7.3 Integration Testing with rostest

```xml
<!-- test/integration/test_emergency_stop.test -->
<launch>
  <!-- Start safety nodes under test -->
  <include file="$(find safety_monitor)/launch/safety_nodes.launch">
    <arg name="sim_mode" value="true"/>
  </include>
  
  <!-- Test node -->
  <test test-name="test_emergency_stop" pkg="safety_monitor"
        type="test_emergency_stop_integration" time-limit="30.0"/>
</launch>
```

```cpp
// test/integration/test_emergency_stop_integration.cpp
#include <ros/ros.h>
#include <gtest/gtest.h>
#include <std_msgs/Bool.h>
#include <geometry_msgs/Twist.h>

class EmergencyStopIntegrationTest : public ::testing::Test {
protected:
    ros::NodeHandle nh_;
    ros::Publisher estop_trigger_pub_;
    ros::Subscriber cmd_sub_;
    geometry_msgs::Twist last_cmd_;
    bool cmd_received_;
    
    void SetUp() override {
        estop_trigger_pub_ = nh_.advertise<std_msgs::Bool>("/safety/e_stop", 1, true);
        cmd_sub_ = nh_.subscribe("/av_nav/cmd_twist", 1,
            &EmergencyStopIntegrationTest::cmdCallback, this);
        cmd_received_ = false;
        ros::Duration(1.0).sleep();  // Wait for connections
    }
    
    void cmdCallback(const geometry_msgs::Twist::ConstPtr& msg) {
        last_cmd_ = *msg;
        cmd_received_ = true;
    }
};

TEST_F(EmergencyStopIntegrationTest, EStopZerosCommand) {
    // Trigger e-stop
    std_msgs::Bool trigger;
    trigger.data = true;
    estop_trigger_pub_.publish(trigger);
    
    // Wait for response (50ms timeout budget + margin)
    ros::Time deadline = ros::Time::now() + ros::Duration(0.1);
    while (ros::Time::now() < deadline && ros::ok()) {
        ros::spinOnce();
        ros::Duration(0.001).sleep();
    }
    
    // Verify command output is zero
    ASSERT_TRUE(cmd_received_);
    EXPECT_NEAR(last_cmd_.linear.x, 0.0, 0.001);
    EXPECT_NEAR(last_cmd_.angular.z, 0.0, 0.001);
}

int main(int argc, char** argv) {
    ros::init(argc, argv, "test_emergency_stop_integration");
    testing::InitGoogleTest(&argc, argv);
    ros::AsyncSpinner spinner(1);
    spinner.start();
    int result = RUN_ALL_TESTS();
    spinner.stop();
    return result;
}
```

### 7.4 Hardware-in-the-Loop (HiL) Testing

HiL testing validates that the safety software interacts correctly with the actual hardware interfaces (CAN bus, GPIO e-stop, safety controller MCU).

**HiL test architecture for Aurrigo:**

```
┌──────────────────┐     CAN Bus      ┌──────────────────────┐
│ Test PC           │◄────────────────►│ Vehicle ECU / Safety  │
│ (HiL Controller)  │                  │ Controller (STM32)    │
│                   │     GPIO          │                      │
│ - Sends simulated │◄────────────────►│ - E-stop relay       │
│   sensor data     │                  │ - Speed encoder sim   │
│ - Verifies CAN    │     Ethernet     │ - Steering feedback   │
│   responses       │◄────────────────►│                      │
│ - Injects faults  │                  │ Orin (ROS stack)      │
│ - Measures timing │                  │                      │
└──────────────────┘                  └──────────────────────┘
```

**What to test in HiL:**

| Test Category | Example Test Cases |
|---|---|
| E-stop response time | Measure time from e-stop trigger to CAN bus brake command; must be < 50ms |
| CAN message integrity | Verify all safety CAN messages have correct DLC, ID, and checksum |
| Heartbeat failure | Disconnect Orin from CAN bus; verify safety controller enters safe state within timeout |
| Speed limiting | Send high-speed CAN commands; verify safety controller clips to zone limit |
| Geofence enforcement | Send GPS coordinates outside geofence; verify controlled stop triggered |
| Power-cycle recovery | Power-cycle the Orin; verify safety controller maintains safe state independently |

### 7.5 Fault Injection Testing

ISO 26262-6, Clause 9.4.5 recommends fault injection to verify robustness. Types of faults to inject in ROS:

```python
#!/usr/bin/env python3
"""Fault injection test harness for ROS safety nodes."""

import rospy
from std_msgs.msg import Bool, Float64
from geometry_msgs.msg import Twist
import random

class FaultInjector:
    """Injects faults into ROS topics to test safety responses."""
    
    def __init__(self):
        rospy.init_node('fault_injector')
        
        # Publishers for injecting faults
        self.corrupt_odom_pub = rospy.Publisher(
            '/odom/fused', Twist, queue_size=1)
    
    def inject_topic_silence(self, topic_name, duration_sec):
        """Stop publishing on a topic for specified duration.
        Tests: timeout detection and failsafe behavior."""
        rospy.logwarn(f"FAULT: Silencing {topic_name} for {duration_sec}s")
        # Implementation: kill the publishing node, wait, restart
        
    def inject_corrupt_data(self, topic_name, corruption_type):
        """Publish corrupted data on a topic.
        Tests: input validation and range checking."""
        msg = Twist()
        if corruption_type == "nan":
            msg.linear.x = float('nan')
        elif corruption_type == "inf":
            msg.linear.x = float('inf')
        elif corruption_type == "extreme":
            msg.linear.x = 999999.0  # Physically impossible speed
        
        rospy.logwarn(f"FAULT: Publishing corrupt {corruption_type} on {topic_name}")
        self.corrupt_odom_pub.publish(msg)
    
    def inject_timing_jitter(self, topic_name, jitter_ms):
        """Add random delay to message publication.
        Tests: timing tolerance and deadline detection."""
        delay = random.uniform(0, jitter_ms / 1000.0)
        rospy.logwarn(f"FAULT: Adding {delay*1000:.1f}ms jitter to {topic_name}")
        rospy.sleep(delay)
```

### 7.6 Regression Test Suites for Safety-Critical Changes

Every change to safety-critical code (files tagged with `[SAFETY]` in commit messages or in designated safety directories) must pass the full regression suite before merge.

```yaml
# .github/workflows/safety-regression.yml
name: Safety Regression Tests
on:
  pull_request:
    paths:
      - 'src/safety_monitor/**'
      - 'src/vehicle_interface/**'
      - 'src/arbitrator/**'
      - 'firmware/safety_controller/**'

jobs:
  safety-regression:
    runs-on: [self-hosted, orin]  # Run on actual Orin hardware
    steps:
      - uses: actions/checkout@v4
      
      - name: Static Analysis (cppcheck + clang-tidy)
        run: |
          cppcheck --addon=misra.json --error-exitcode=1 src/safety_monitor/
          clang-tidy src/safety_monitor/src/*.cpp -- -std=c++17
      
      - name: Build with Safety Flags
        run: |
          catkin_make -DENABLE_SAFETY_FLAGS=ON -DENABLE_COVERAGE=ON
      
      - name: Unit Tests
        run: catkin_make run_tests_safety_monitor
      
      - name: Integration Tests
        run: rostest safety_monitor test_all_integration.test
      
      - name: Coverage Check (branch coverage >= 95%)
        run: |
          lcov --capture --directory build/ --output-file coverage.info
          COVERAGE=$(lcov --summary coverage.info 2>&1 | grep branches | awk '{print $2}' | sed 's/%//')
          if (( $(echo "$COVERAGE < 95.0" | bc -l) )); then
            echo "Branch coverage $COVERAGE% < 95% threshold"
            exit 1
          fi
      
      - name: Sanitizer Tests (UBSan + ASan)
        run: |
          catkin_make -DCMAKE_BUILD_TYPE=Debug \
            -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined"
          catkin_make run_tests_safety_monitor
```

---

## 8. CI/CD for Safety Compliance

### 8.1 Pipeline Architecture

A safety-compliant CI/CD pipeline for ROS development enforces quality gates at every stage. Each stage produces artifacts that contribute to the safety case.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CI/CD Pipeline for Safety                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Stage 1: Lint & Format                                                │
│  ├── clang-format (code style consistency)                             │
│  ├── cppcheck (basic defect detection)                                 │
│  ├── clang-tidy (CERT, bugprone, performance checks)                   │
│  └── MISRA deviation audit (verify all suppressions are documented)    │
│                                                                         │
│  Stage 2: Build                                                         │
│  ├── Build with safety flags (see Section 5)                           │
│  ├── Zero warnings (treated as errors)                                 │
│  ├── Cross-compile for aarch64 (Orin target)                           │
│  └── Deterministic build verification (compare hashes)                 │
│                                                                         │
│  Stage 3: Static Analysis                                               │
│  ├── PC-lint Plus / Parasoft MISRA compliance check                    │
│  ├── Generate MISRA compliance report                                  │
│  └── Fail on any new mandatory/required rule violation                 │
│                                                                         │
│  Stage 4: Unit Tests                                                    │
│  ├── gtest unit tests for all safety-critical functions                │
│  ├── Coverage measurement (gcov/lcov)                                  │
│  ├── Branch coverage gate: >= 95% for ASIL B nodes                    │
│  └── MC/DC coverage report (if using Parasoft/VectorCAST)             │
│                                                                         │
│  Stage 5: Integration Tests                                             │
│  ├── rostest multi-node integration tests                              │
│  ├── Fault injection test suite                                        │
│  ├── Timing verification (end-to-end latency within budget)           │
│  └── Resource usage verification (memory, CPU within bounds)           │
│                                                                         │
│  Stage 6: Artifact Generation                                           │
│  ├── Coverage report (HTML + machine-readable)                         │
│  ├── MISRA compliance report                                           │
│  ├── Static analysis findings report                                   │
│  ├── Traceability matrix update                                        │
│  └── Binary hash + build metadata record                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Automated MISRA Compliance Checking in CI

```bash
#!/bin/bash
# scripts/ci/misra_check.sh — Run MISRA compliance check on safety-critical code

set -euo pipefail

SAFETY_DIRS="src/safety_monitor src/vehicle_interface src/arbitrator"
MISRA_REPORT="build/reports/misra_compliance.txt"
DEVIATION_LOG="docs/safety/misra_deviations.csv"

echo "=== MISRA C++:2023 Compliance Check ==="

# Run cppcheck with MISRA addon (baseline, free)
for dir in $SAFETY_DIRS; do
    cppcheck \
        --addon=misra.json \
        --enable=all \
        --suppress=missingIncludeSystem \
        --suppress=unusedFunction \
        --inline-suppr \
        --template='{file}:{line}: [{severity}] {id}: {message} [MISRA {code}]' \
        --output-file="${MISRA_REPORT}.${dir//\//_}" \
        "$dir"
done

# Count violations by category
MANDATORY=$(grep -c '\[mandatory\]' ${MISRA_REPORT}.* 2>/dev/null || echo 0)
REQUIRED=$(grep -c '\[required\]' ${MISRA_REPORT}.* 2>/dev/null || echo 0)
ADVISORY=$(grep -c '\[advisory\]' ${MISRA_REPORT}.* 2>/dev/null || echo 0)

echo "Mandatory violations: $MANDATORY (must be 0)"
echo "Required violations: $REQUIRED (must have deviation records)"
echo "Advisory violations: $ADVISORY (documented in project policy)"

# Fail on any mandatory violation
if [ "$MANDATORY" -gt 0 ]; then
    echo "FAIL: Mandatory MISRA violations found. These cannot be deviated."
    exit 1
fi

# Check that all required violations have deviation records
# (Implementation: cross-reference violation IDs against deviation log)
echo "=== Checking deviation records ==="
# ... deviation cross-reference logic ...

echo "MISRA compliance check complete."
```

### 8.3 Traceability: Linking Requirements to Code to Tests

ISO 26262-6 requires bidirectional traceability between:
- Safety requirements and software architecture
- Software architecture and detailed design/code
- Code and test cases
- Test cases and test results

**Practical traceability approach for a small ROS codebase:**

```
docs/safety/
├── requirements/
│   ├── SSR-001_emergency_braking.md      # Requirement specification
│   ├── SSR-002_speed_limiting.md
│   └── traceability_matrix.csv           # Master traceability document
├── design/
│   ├── SDD-001_arbitrator_design.md      # Software design document
│   └── SDD-002_safety_monitor_design.md
├── deviations/
│   ├── MISRA_deviations.csv              # All MISRA rule deviations
│   └── MISRA_deviation_template.md
└── reports/
    ├── coverage/                          # Generated by CI
    ├── misra/                             # Generated by CI
    └── test_results/                      # Generated by CI
```

**Traceability matrix format (CSV):**

```csv
Requirement ID,Requirement Text,Design Component,Source File(s),Unit Test(s),Integration Test(s),Coverage %,Status
SSR-001,Emergency braking within 50ms,SDD-001 Sec 3.2,arbitrator.cpp:L120-L180,test_estop.cpp:T1-T5,test_estop_integration.test,98.2%,Verified
SSR-002,Speed limit 8km/h in apron zones,SDD-002 Sec 2.1,speed_limiter.cpp:L30-L95,test_speed_limiter.cpp:T1-T8,test_speed_integration.test,100%,Verified
SSR-003,Arbitrator fallback within 20ms,SDD-001 Sec 3.4,arbitrator.cpp:L200-L250,test_arbitrator.cpp:T10-T15,test_fallback_integration.test,96.1%,Verified
```

### 8.4 Change Impact Analysis for Safety-Critical Modifications

When a pull request modifies safety-critical code, the CI pipeline performs change impact analysis to determine which safety requirements and test cases are affected.

```python
#!/usr/bin/env python3
"""Change impact analysis for safety-critical code modifications."""

import subprocess
import csv
import sys
from pathlib import Path

def get_changed_files():
    """Get list of files changed in this PR."""
    result = subprocess.run(
        ['git', 'diff', '--name-only', 'origin/main...HEAD'],
        capture_output=True, text=True, check=True)
    return result.stdout.strip().split('\n')

def load_traceability_matrix(matrix_path):
    """Load the requirements-to-code traceability matrix."""
    with open(matrix_path) as f:
        reader = csv.DictReader(f)
        return list(reader)

def analyze_impact(changed_files, trace_matrix):
    """Determine which requirements are affected by the changed files."""
    affected_requirements = []
    for row in trace_matrix:
        source_files = row['Source File(s)'].split(',')
        for src in source_files:
            src_path = src.split(':')[0].strip()
            for changed in changed_files:
                if src_path in changed:
                    affected_requirements.append(row)
                    break
    return affected_requirements

def main():
    changed = get_changed_files()
    matrix = load_traceability_matrix('docs/safety/requirements/traceability_matrix.csv')
    affected = analyze_impact(changed, matrix)
    
    if affected:
        print(f"=== SAFETY IMPACT: {len(affected)} requirement(s) affected ===")
        for req in affected:
            print(f"  {req['Requirement ID']}: {req['Requirement Text']}")
            print(f"    Tests to re-run: {req['Unit Test(s)']}, {req['Integration Test(s)']}")
        # Return non-zero to flag PR for safety review
        sys.exit(0)  # Still pass — but annotate PR with safety review needed
    else:
        print("No safety requirements affected by this change.")

if __name__ == '__main__':
    main()
```

### 8.5 Binary Reproducibility Verification

```bash
#!/bin/bash
# scripts/ci/verify_reproducibility.sh
# Build twice in clean environments, verify identical binaries

set -euo pipefail

SAFETY_LIBS=(
    "devel/lib/libarbitrator_nodelet.so"
    "devel/lib/libsafety_monitor_nodelet.so"
    "devel/lib/libcan_safety_node.so"
)

echo "=== Build 1 ==="
catkin_make clean && catkin_make -DENABLE_SAFETY_FLAGS=ON
for lib in "${SAFETY_LIBS[@]}"; do
    sha256sum "build/$lib" >> /tmp/build1_hashes.txt
done

echo "=== Build 2 ==="
catkin_make clean && catkin_make -DENABLE_SAFETY_FLAGS=ON
for lib in "${SAFETY_LIBS[@]}"; do
    sha256sum "build/$lib" >> /tmp/build2_hashes.txt
done

echo "=== Comparing hashes ==="
if diff /tmp/build1_hashes.txt /tmp/build2_hashes.txt; then
    echo "PASS: Builds are reproducible"
else
    echo "FAIL: Builds are NOT reproducible — investigate non-determinism"
    diff /tmp/build1_hashes.txt /tmp/build2_hashes.txt
    exit 1
fi
```

---

## 9. ROS-Specific Safety Challenges

### 9.1 Topic Message Loss (No Guaranteed Delivery in ROS 1)

ROS 1 topics use TCP (TCPROS) or UDP (UDPROS) transport. Neither provides guaranteed delivery in the sense required for safety-critical communication:

- **TCPROS**: Reliable delivery but with potentially unbounded latency (TCP retransmits, Nagle's algorithm, buffer bloat). If a subscriber's incoming buffer is full, messages are dropped.
- **UDPROS**: Low latency but unreliable -- packets can be lost, duplicated, or reordered with no notification.
- **Queue size**: If `queue_size` is set to N and the subscriber cannot process messages fast enough, the oldest messages are silently dropped. There is no callback, no error, and no count of dropped messages.

**Mitigation for safety-critical topics:**

```cpp
// 1. Use sequence numbers in custom safety messages
// safety_msgs/SafetyCommand.msg:
// uint32 sequence
// float64 timestamp
// uint32 crc32
// geometry_msgs/Twist command

class SafetyPublisher {
    uint32_t seq_ = 0U;
    ros::Publisher pub_;
    
    void publish(const geometry_msgs::Twist& cmd) {
        safety_msgs::SafetyCommand msg;
        msg.sequence = seq_++;
        msg.timestamp = ros::Time::now().toSec();
        msg.command = cmd;
        msg.crc32 = computeCRC32(&msg, sizeof(msg) - sizeof(uint32_t));
        pub_.publish(msg);
    }
};

class SafetySubscriber {
    uint32_t expected_seq_ = 0U;
    uint32_t dropped_count_ = 0U;
    
    void callback(const safety_msgs::SafetyCommand::ConstPtr& msg) {
        // Verify CRC
        uint32_t expected_crc = computeCRC32(
            msg.get(), sizeof(*msg) - sizeof(uint32_t));
        if (msg->crc32 != expected_crc) {
            ROS_ERROR("CRC mismatch on safety topic — message corrupted");
            return;
        }
        
        // Check sequence continuity
        if (msg->sequence != expected_seq_) {
            const uint32_t gap = msg->sequence - expected_seq_;
            dropped_count_ += gap;
            ROS_WARN("Safety topic: %u messages dropped (seq gap: %u→%u)",
                     gap, expected_seq_, msg->sequence);
        }
        expected_seq_ = msg->sequence + 1U;
        
        // Check freshness
        const double age = ros::Time::now().toSec() - msg->timestamp;
        if (age > 0.1) {  // 100ms staleness threshold
            ROS_WARN("Safety message stale: %.1fms old", age * 1000.0);
        }
        
        // Process message...
    }
};
```

### 9.2 Callback Queue Overflow Under Load

When the system is under heavy load (e.g., 8 LiDAR sensors each producing 300K points at 10Hz), callback queues can overflow. The default behavior is silent message dropping.

**Mitigations:**

```cpp
// 1. Use dedicated callback queues for safety-critical subscribers
ros::CallbackQueue safety_queue;
ros::NodeHandle safety_nh;
safety_nh.setCallbackQueue(&safety_queue);

// Subscribe on the safety callback queue
ros::Subscriber estop_sub = safety_nh.subscribe(
    "/safety/e_stop", 10, estopCallback);

// Spin the safety queue in a dedicated thread with RT priority
std::thread safety_thread([&safety_queue]() {
    configureRealTime(90);  // RT priority
    while (ros::ok()) {
        safety_queue.callAvailable(ros::WallDuration(0.001));
    }
});

// 2. Monitor queue depth (diagnostic)
// Custom queue wrapper that tracks high-water mark
class MonitoredCallbackQueue : public ros::CallbackQueue {
    std::atomic<size_t> high_water_mark_{0U};
    size_t capacity_;
    
    // Override addCallback to track depth
    // Note: ros::CallbackQueue does not provide depth query natively
    // This requires patching or wrapping the queue
};
```

### 9.3 Time Synchronization Between Nodes

ROS 1 uses `ros::Time` which can be driven by system clock (`/use_sim_time=false`) or simulated time (`/use_sim_time=true`). In production, system clock is used, but clock skew between nodes (if running on different machines) can cause:

- Stale data accepted as fresh
- Future timestamps causing TF lookup failures
- Inconsistent sensor fusion due to misaligned timestamps

**Safety-critical time handling:**

```cpp
// Always validate timestamps against expected ranges
bool isTimestampValid(const ros::Time& stamp) {
    const ros::Time now = ros::Time::now();
    const double age = (now - stamp).toSec();
    
    // Reject messages from the future (clock skew)
    if (age < -0.05) {  // 50ms tolerance for clock skew
        return false;
    }
    
    // Reject stale messages
    if (age > 0.5) {  // 500ms maximum age
        return false;
    }
    
    return true;
}
```

### 9.4 Parameter Server Single Point of Failure

The ROS parameter server is part of rosmaster. If rosmaster crashes or becomes unresponsive, no node can read or write parameters. Safety-critical parameters (speed limits, geofence coordinates, sensor timeouts) must not depend on the parameter server's runtime availability.

**Mitigation: load parameters at initialization, cache locally**

```cpp
class SafetyConfig {
    // All safety parameters cached locally at startup
    double max_speed_apron_;
    double max_speed_service_;
    double estop_timeout_;
    double heartbeat_timeout_;
    
    bool loadParameters(ros::NodeHandle& nh) {
        bool all_loaded = true;
        
        all_loaded &= nh.getParam("max_speed_apron_mps", max_speed_apron_);
        all_loaded &= nh.getParam("max_speed_service_mps", max_speed_service_);
        all_loaded &= nh.getParam("estop_timeout_sec", estop_timeout_);
        all_loaded &= nh.getParam("heartbeat_timeout_sec", heartbeat_timeout_);
        
        if (!all_loaded) {
            ROS_FATAL("Failed to load safety parameters — cannot start");
            return false;
        }
        
        // Validate ranges
        if (max_speed_apron_ <= 0.0 || max_speed_apron_ > 5.0) {
            ROS_FATAL("Invalid max_speed_apron: %.2f (expected 0-5 m/s)", 
                      max_speed_apron_);
            return false;
        }
        
        // Parameters are now cached — no further parameter server dependency
        return true;
    }
    
    // Getter methods return cached values — no network call
    double maxSpeedApron() const { return max_speed_apron_; }
};
```

### 9.5 roslaunch Process Management Limitations

roslaunch provides basic process management but lacks safety-critical features:

- **No guaranteed startup order**: Nodes may start in any order, even with `<arg>` dependencies
- **No guaranteed shutdown order**: Killing roslaunch sends SIGINT to all nodes simultaneously
- **`required="true"` is coarse**: If a required node dies, ALL nodes are killed -- no graceful degradation
- **No health monitoring**: roslaunch does not check if a node is actually functioning, only if the process is alive
- **No automatic restart with backoff**: A crashing node is either restarted immediately (`respawn="true"`) or not at all

**Mitigations:**

1. **Startup sequencing**: Use shell scripts or `roslaunch` `<arg>` with `<group>` to enforce order. Safety nodes start first and verify readiness before other nodes.
2. **Health monitoring**: The watchdog node (Section 6.1) provides application-level health monitoring independent of roslaunch.
3. **Graceful degradation**: The arbitrator handles component failures by falling back to the production stack or controlled stop, rather than relying on roslaunch's `required` attribute.
4. **Systemd integration**: Run the safety controller and CAN interface as systemd services with restart policies, independent of roslaunch.

### 9.6 Comparison: ROS 1 vs ROS 2 for Functional Safety

| Feature | ROS 1 (Noetic) | ROS 2 (Humble/Iron/Jazzy) | Safety Impact |
|---|---|---|---|
| Transport | TCPROS/UDPROS, custom | DDS (multiple vendors) | DDS provides QoS policies (reliability, deadline, liveliness) |
| Real-time support | None built-in | Executor model, some RT executors | ROS 2 enables deterministic callback scheduling |
| Lifecycle management | None | Managed nodes with state machine | Controlled startup/shutdown for safety nodes |
| QoS policies | queue_size only | Reliability, deadline, liveliness, history depth | Critical for safety-critical message delivery guarantees |
| Node composition | Nodelets (shared process) | Components (similar, but with lifecycle) | Both share process space — same interference risks |
| Parameter validation | None | Parameter descriptors with ranges | Prevents invalid parameter values at runtime |
| Certified variant | None | Apex.OS (TUV Nord ASIL D), Safe DDS 3.0 (ASIL D) | Production path for highest safety certification |
| Multi-machine | Requires rosmaster | DDS discovery (no single point of failure) | Eliminates rosmaster SPOF |
| Security | None built-in | SROS2 (DDS security) | Authenticated, encrypted communication |

**Assessment for Aurrigo's current position:**

Migrating from ROS 1 to ROS 2 is not required for ISO 3691-4 certification, and the cost/risk of migration is substantial (22 packages, extensive testing, vehicle downtime). The recommended approach is:

1. **Short-term**: Apply the safety patterns in this document to ROS 1 Noetic
2. **Medium-term**: Build the safety controller firmware as an independent, ROS-agnostic CAN gateway (like comma.ai's panda)
3. **Long-term**: When developing the next-generation stack (world model, neural planning), build it on ROS 2 with Apex.OS or equivalent for the safety-critical path

Apex.OS, developed by Apex.AI, is a safety-certified fork of ROS 2 that has achieved TUV Nord ISO 26262 ASIL D certification as a Safety Element out of Context (SEooC). It removes all runtime memory allocations and blocking calls from the ROS 2 codebase, enabling deterministic real-time operation. For future ASIL D certification needs, Apex.OS represents the production-ready path. Safe DDS 3.0 by eProsima has also achieved ISO 26262 ASIL D certification and can serve as the middleware layer.

---

## 10. Airside-Specific Requirements

### 10.1 Machinery Directive 2006/42/EC to Machinery Regulation 2023/1230

The EU Machinery Directive 2006/42/EC has governed machine safety in Europe since 2009. It is being replaced by the Machinery Regulation (EU) 2023/1230, which applies from **20 January 2027**.

**Key changes affecting autonomous airside vehicles:**

| Aspect | Directive 2006/42/EC | Regulation 2023/1230 |
|---|---|---|
| Legal form | Directive (transposed into national law) | Regulation (directly applicable in all EU member states) |
| Software scope | Implicit only | **Explicitly includes software as a safety component** |
| AI/autonomous systems | Not addressed | **Specific requirements for fully/partly autonomous machines** |
| Cybersecurity | Not addressed | **Elevated to a safety objective** |
| Third-party assessment | Self-certification for most machines | **Mandatory third-party assessment for high-risk AI autonomous vehicles** (Annex I, Section 1) |
| Digital instructions | Paper manual required | Digital format permitted |
| Substantial modification | Not clearly defined | **Defined: software updates that affect safety are substantial modifications** |

**Software-specific requirements under 2023/1230:**

1. **Software as a safety component**: Standalone software that performs a safety function is explicitly within scope. This includes the ROS safety monitor, arbitrator, and obstacle detection nodes.
2. **AI autonomous systems**: Machines that operate fully or partly autonomously must not activate without supervision, must block parameter/rule changes that could create hazardous situations, all safety-related decisions must be logged, and AI control systems must be updateable at any time to address safety issues.
3. **Cybersecurity as safety**: The regulation treats cybersecurity vulnerabilities as safety risks. See [../cybersecurity/cybersecurity-airside-av.md](../cybersecurity/cybersecurity-airside-av.md) for detailed treatment.
4. **Conformity assessment**: Autonomous vehicles with AI will require third-party conformity assessment by a notified body (e.g., TUV, SGS, Bureau Veritas), not self-certification.

### 10.2 ISO 3691-4 Software Requirements

ISO 3691-4:2023, Clause 4.3 specifies software-related requirements for driverless industrial trucks:

- **Safety-related software** must comply with IEC 62443 (cybersecurity) or provide equivalent protection
- **Performance Level** requirements reference ISO 13849-1, which in turn references IEC 62061 for complex programmable electronic systems
- **Software validation** must demonstrate that the software performs its intended safety functions correctly under all specified conditions
- **Modification control**: Any software modification must trigger re-validation of affected safety functions

**ISO 13849-1 and software:**
ISO 13849-1:2023 (referenced by ISO 3691-4) addresses software through its Category system. For Category 3 and Category 4 architectures (required for PLd), the standard requires:
- Software developed according to a V-model or equivalent lifecycle
- Coding guidelines (MISRA or equivalent) for safety-related embedded software
- Functional testing with fault simulation
- Software validation documentation

### 10.3 EASA Requirements for Airside Autonomous Systems

EASA (European Union Aviation Safety Agency) does not currently have binding standards for autonomous ground vehicles on airside. However, EASA's AI Roadmap 2.0 (2024) establishes the direction:

- **Level 1 AI (assistance)**: Existing oversight and approval processes apply
- **Level 2 AI (human-AI teaming)**: Requires demonstrations of AI trustworthiness, explainability, and robustness
- **Level 3 AI (advanced automation)**: Full certification with continuous monitoring post-deployment

For airside AVs, the practical path is:
1. Certify the vehicle under ISO 3691-4 / Machinery Regulation (ground vehicle standards)
2. Obtain airport operator approval per local aviation authority requirements (FAA Part 139, EASA aerodrome rules)
3. Provide a safety case that addresses aviation-specific hazards (aircraft proximity, jet blast, FOD) per the airport's risk assessment

See [../../80-industry-intel/regulations/regulatory-trajectory-deep-dive.md](../../80-industry-intel/regulations/regulatory-trajectory-deep-dive.md) for detailed timelines and regulatory pathways.

### 10.4 Emergency Stop Chain: Software to CAN to Actuator

The emergency stop chain must be designed so that no single software fault can prevent the vehicle from stopping. This requires defense in depth:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Layer 1: Software E-Stop (ROS)                                       │
│ ├── Obstacle detected within safety zone → /safety/e_stop = true    │
│ ├── Watchdog timeout on critical node → /safety/e_stop = true       │
│ ├── Arbitrator detects inconsistency → /safety/e_stop = true        │
│ └── Publishes CAN e-stop command to safety controller               │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 2: Safety Controller (STM32 firmware)                          │
│ ├── Receives CAN e-stop from ROS stack → activates brake relay      │
│ ├── Heartbeat timeout from ROS stack → activates brake relay         │
│ ├── Speed exceeds limit (from wheel encoder) → activates brake       │
│ ├── Geofence violation (from GPS) → activates brake                  │
│ └── Operates independently — no dependency on ROS or Orin           │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 3: Hardware E-Stop (physical button)                           │
│ ├── Wired directly to brake relay — no software in the path         │
│ ├── Breaks the safety circuit → immediate hydraulic/electric brake   │
│ └── Meets ISO 13850:2015 requirements for emergency stop function   │
├──────────────────────────────────────────────────────────────────────┤
│ Layer 4: Mechanical Failsafe                                         │
│ ├── Spring-applied, hydraulically/electrically released parking brake│
│ ├── Loss of power → brake automatically applied (fail-safe)         │
│ └── No software, no electronics — pure mechanical/pneumatic         │
└──────────────────────────────────────────────────────────────────────┘
```

**Design principle**: Layers 3 and 4 contain zero software. Layer 2 runs on an independent microcontroller with MISRA-compliant firmware. Only Layer 1 involves ROS. A total ROS stack failure (Orin crashes, rosmaster dies, all nodes terminate) results in Layer 2 detecting heartbeat loss and activating brakes within its timeout period (typically 200-500ms).

---

## 11. comma.ai Panda Safety Layer Case Study

### 11.1 Architecture Overview

The comma.ai panda is a custom hardware device (STM32H725 ARM Cortex-M7 microcontroller) that sits physically between the comma 3X/four computer and the vehicle's CAN bus. It is the only path for control messages to reach the vehicle actuators. The panda firmware enforces safety constraints in hardware, independent of the neural network, the main processor, and even the openpilot software stack.

**Key design decisions:**

1. **Hardware-enforced safety boundary**: The panda is not optional or bypassable. Every CAN message to the vehicle passes through panda firmware validation. There is no alternative path.
2. **Single boolean gate**: A `controls_allowed` variable must be `true` for any control CAN messages to pass. It is set `true` when the driver activates cruise control and set `false` immediately on brake press, cancel, or any safety violation.
3. **Default to silence**: When the panda detects any anomaly (heartbeat loss, invalid CAN messages, safety violation), it defaults to `SAFETY_SILENT` -- it stops forwarding control messages entirely. The vehicle's own safety systems (ABS, stability control, power steering) remain functional.
4. **Vehicle-specific safety profiles**: Each supported car has a dedicated safety profile (C code file) that defines the exact CAN message IDs, value ranges, and rate limits allowed for that vehicle. Messages not matching the profile are silently dropped.

### 11.2 Code Quality Standards

The panda safety firmware (in `opendbc/safety/`) follows these standards:

- **MISRA C:2012 compliance**: Enforced via cppcheck with the MISRA C addon. Violations are CI failures.
- **Compiler flags**: `-Wall -Wextra -Wstrict-prototypes -Werror` -- all warnings are errors.
- **100% line coverage**: Every line of safety firmware code is exercised by unit tests. Coverage is measured and reported in CI.
- **Mutation testing**: A custom mutation testing runner modifies safety logic (e.g., flipping comparisons, changing constants) and verifies that tests catch every mutation. This runs in 30 seconds (replacing a third-party tool that took 45 minutes).
- **Hardware-in-the-loop testing**: Physical panda units connected to CAN bus simulators validate message sending, receiving, and forwarding on all panda variants.
- **Static analysis**: cppcheck runs on every commit. The codebase maintains zero warnings.

### 11.3 Lessons Applicable to Aurrigo's Safety Controller

| Panda Design Choice | Aurrigo Equivalent | Implementation Notes |
|---|---|---|
| STM32H725 CAN gateway | STM32-class MCU on vehicle CAN bus | Same MCU family; can reuse panda's MISRA-compliant CAN library patterns |
| `controls_allowed` boolean | `ops_allowed` flag in safety controller | Requires active confirmation from ground control, vehicle health, and operator acknowledgment |
| MISRA C:2012 via cppcheck | Same tool, same approach | Zero cost; add cppcheck MISRA addon to firmware CI |
| 100% line coverage | Target 100% for safety controller firmware | Achievable for small, focused firmware (~2K-5K SLOC) |
| Mutation testing | Custom mutation runner or mull | Validates test quality beyond coverage metrics |
| Heartbeat from main computer | Heartbeat from Orin/ROS to STM32 over CAN | If heartbeats stop, safety controller activates brakes |
| Vehicle-specific safety profiles | Airport-specific safety profiles | Speed limits per zone, geofence boundaries, allowed CAN messages per vehicle type (ADT3, STL2, POD, ACA1) |
| Default to silence (SAFETY_SILENT) | Default to brake (fail-safe) | Airside difference: silence is not safe (vehicle might roll on slopes). Default must be active braking + parking brake. |

**Critical difference from comma.ai**: Comma's panda defaults to silence because openpilot is a Level 2 ADAS system -- the driver is always present and always able to retake control. Aurrigo's airside vehicles operate without a driver onboard (or with a safety operator who may not be able to physically reach controls quickly). The safety controller must default to **active braking and parking brake engagement**, not silence. Loss of communication with the ROS stack must result in a controlled stop, not coasting.

### 11.4 Panda Safety Code Structure

```
opendbc/safety/
├── safety.h                    # Core safety infrastructure
├── safety_declarations.h       # Shared types and declarations  
├── safety_defaults.h           # Default safety implementations
├── safety_honda.h              # Honda-specific safety logic
├── safety_toyota.h             # Toyota-specific safety logic
├── safety_hyundai.h            # Hyundai-specific safety logic
├── ... (one file per manufacturer)
└── tests/
    ├── test_honda.py           # Vehicle-specific unit tests
    ├── test_toyota.py
    └── ...
```

Each vehicle safety file implements a standard interface:
- `init()`: Initialize vehicle-specific state
- `rx()`: Process incoming CAN messages (detect cruise state, brake press, speed)
- `tx()`: Validate outgoing CAN messages (check limits, enforce rate)
- `fwd()`: Decide which messages to forward between buses

This pattern -- a standard safety interface with vehicle-specific implementations -- maps directly to Aurrigo's need for platform-specific safety profiles (ADT3, STL2, POD, ACA1 each have different CAN interfaces and actuator characteristics).

---

## 12. Recommended Implementation for Aurrigo

### 12.1 Phased Approach

**Phase 1: Audit and Baseline (Weeks 1-4, ~$5K)**

| Activity | Output | Tools |
|---|---|---|
| Identify safety-critical nodes (by analyzing data flow to actuators) | Safety-critical node list with justification | Manual analysis |
| Run cppcheck + clang-tidy on all safety-critical code | Baseline defect report | cppcheck, clang-tidy (free) |
| Document current test coverage | Coverage baseline report | gcov/lcov (free) |
| Map safety requirements to code (initial traceability) | Draft traceability matrix | Spreadsheet |
| Review compiler flags against Section 5 recommendations | Updated CMakeLists.txt | GCC (free) |

**Phase 2: Static Analysis and MISRA Remediation (Weeks 5-16, ~$10K-$15K)**

| Activity | Output | Tools |
|---|---|---|
| Purchase and integrate PC-lint Plus | MISRA compliance baseline for safety nodes | PC-lint Plus ($1K-$5K) |
| Fix mandatory and required MISRA violations | Compliant code + deviation records | Developer time |
| Add MISRA checking to CI pipeline | Automated compliance gate | CI integration |
| Implement runtime safety patterns (watchdog, heartbeat) | Safety infrastructure nodes | Developer time |
| Add safety compiler flags to CMakeLists.txt | Hardened build configuration | GCC (free) |

**Phase 3: Testing and Coverage (Weeks 17-28, ~$15K-$25K)**

| Activity | Output | Tools |
|---|---|---|
| Write unit tests to achieve branch coverage >= 95% for ASIL B nodes | Test suite + coverage reports | gtest/gmock (free), gcov/lcov |
| Write integration tests for safety scenarios | rostest suite | rostest (free) |
| Implement fault injection test framework | Fault injection tests | Custom (free) |
| Add sanitizer builds to CI | UBSan/ASan/TSan test jobs | GCC/Clang sanitizers (free) |
| Set up deterministic build verification | Reproducibility evidence | Scripts (free) |

**Phase 4: Safety Controller Firmware (Weeks 12-28, parallel, ~$10K-$20K)**

| Activity | Output | Tools |
|---|---|---|
| Design safety controller firmware (STM32) | Firmware design document | Manual |
| Implement CAN gateway with safety enforcement | Firmware source code | STM32CubeIDE (free) |
| MISRA C:2012 compliance from the start | Clean codebase | cppcheck MISRA addon (free) |
| 100% line coverage unit tests | Test suite + coverage | Unity test framework (free) |
| HiL test setup and execution | HiL test results | CAN interface hardware ($2K-$5K) |

**Phase 5: Certification Evidence (Weeks 29-40, ~$20K-$50K)**

| Activity | Output | Tools |
|---|---|---|
| Complete traceability matrix | Bidirectional traceability evidence | Spreadsheet or Polarion/DOORS |
| Generate MISRA compliance report | Formal compliance documentation | PC-lint Plus / Parasoft |
| Compile safety case software evidence | Software safety case chapter | Manual + templates |
| Pre-assessment review with notified body | Gap analysis and action items | Notified body consulting ($5K-$15K) |
| Formal assessment | Certification evidence package | Notified body ($15K-$30K) |

### 12.2 Which Nodes Need ASIL B vs QM Treatment

Based on Aurrigo's 22-package architecture and the Simplex safety design:

**ASIL B (full safety treatment required):**

| Node/Package | Justification |
|---|---|
| `arbitrator` | Selects between stacks; controls what reaches actuators |
| `safety_monitor` / `watchdog` | Monitors system health; triggers e-stop |
| `can_interface` | Sends commands to physical actuators via CAN |
| `obstacle_detection` (RANSAC pipeline) | Personnel detection — PLd safety function per ISO 3691-4 |
| `speed_limiter` | Enforces zone-based speed limits |
| `e_stop_handler` | Emergency stop logic |
| `localization` (safety-relevant subset) | Position used for geofencing and zone determination |
| Safety controller firmware (STM32) | Independent hardware safety layer |

**QM (standard development practices sufficient):**

| Node/Package | Justification |
|---|---|
| Shadow stack (world model, neural planner) | Outputs gated by ASIL B arbitrator; cannot directly actuate |
| Logging / data recording | No safety function |
| Fleet management interface | No safety function |
| Diagnostics / visualization | No safety function |
| Mission planner | Commands validated by safety monitor before execution |
| Map server | Static data; validated at load time |

### 12.3 Cost and Timeline Estimates

**Total estimated cost: $60K-$115K over 10 months**

| Phase | Duration | Cost Range | Primary Expenses |
|---|---|---|---|
| 1. Audit | 4 weeks | $3K-$5K | Staff time only |
| 2. MISRA remediation | 12 weeks | $10K-$15K | PC-lint Plus license + staff time |
| 3. Testing | 12 weeks | $15K-$25K | Staff time + optional Parasoft license |
| 4. Safety controller | 16 weeks (parallel) | $10K-$20K | STM32 dev hardware + HiL test equipment |
| 5. Certification evidence | 12 weeks | $20K-$50K | Notified body fees + staff time |

**For context:** The full ISO 3691-4 certification cost (including mechanical, electrical, and software) is estimated at $130K-$380K over 12-24 months (see [certification-guide.md](certification-guide.md)). The software safety work outlined here constitutes approximately 30-50% of the total certification effort but provides evidence applicable to both ISO 3691-4 and the 2027 Machinery Regulation.

**Risk factors:**
- If the codebase has significant MISRA violations (likely, given ROS C++ conventions), remediation time may double
- MC/DC coverage tooling (if required for PLd claim) adds $10K-$20K for Parasoft or VectorCAST licenses
- Notified body feedback may require additional remediation cycles

---

## 13. References

### Standards

1. **ISO 26262:2018** — Road vehicles — Functional safety (Parts 1-12). Part 6: Product development at the software level.
2. **ISO 3691-4:2023** — Industrial trucks — Safety requirements and verification — Part 4: Driverless industrial trucks and their systems.
3. **ISO 13849-1:2023** — Safety of machinery — Safety-related parts of control systems — Part 1: General principles for design.
4. **ISO 13850:2015** — Safety of machinery — Emergency stop function — Principles for design.
5. **IEC 62443** — Industrial communication networks — Network and system security (series).
6. **EU Machinery Regulation 2023/1230** — Regulation (EU) 2023/1230 on machinery and related products. Official Journal of the European Union, 2023.
7. **MISRA C:2012** — Guidelines for the Use of the C Language in Critical Systems. Third Edition (with Amendment 2, 2020).
8. **MISRA C++:2023** — Guidelines for the Use of C++17 in Critical Systems. Published October 2023.
9. **MISRA C++:2008** — Guidelines for the Use of the C++ Language in Critical Systems (superseded by C++:2023).
10. **EU Product Liability Directive 2024/2853** — Directive on liability for defective products. Transpose by December 2026.
11. **UL 4600** — Standard for Safety for the Evaluation of Autonomous Products (safety case methodology).
12. **ISO/PAS 8800** — Road vehicles — Safety and artificial intelligence.

### Tools and Platforms

13. **Polyspace Bug Finder / Code Prover** — MathWorks. https://www.mathworks.com/products/polyspace.html
14. **Parasoft C/C++test** — Parasoft Corporation. https://www.parasoft.com/products/parasoft-c-ctest/
15. **PC-lint Plus** — Gimpel Software / Vector Informatik. https://pclintplus.com/
16. **cppcheck** — Open-source static analysis. https://cppcheck.sourceforge.io/
17. **Coverity** — Synopsys / Black Duck. https://www.synopsys.com/software-integrity/security-testing/static-analysis-sast/coverity.html
18. **Apex.OS** — Apex.AI. TUV Nord ISO 26262 ASIL D certified ROS 2 distribution. https://www.apex.ai/
19. **Safe DDS 3.0** — eProsima. ISO 26262 ASIL D certified DDS middleware. https://www.eprosima.com/
20. **comma.ai panda** — Open-source safety controller firmware. https://github.com/commaai/panda

### Technical References

21. **OpenSSF Compiler Options Hardening Guide for C and C++** — https://best.openssf.org/Compiler-Hardening-Guides/Compiler-Options-Hardening-Guide-for-C-and-C++.html
22. **ROS 2 Real-time Design** — https://design.ros2.org/articles/realtime_proposal.html
23. **PREEMPT_RT for Linux** — https://wiki.linuxfoundation.org/realtime/start
24. **UndefinedBehaviorSanitizer** — Clang documentation. https://clang.llvm.org/docs/UndefinedBehaviorSanitizer.html
25. **GCC Instrumentation Options** — https://gcc.gnu.org/onlinedocs/gcc/Instrumentation-Options.html

### Related Documents in This Repository

26. [ISO 3691-4 Deep Dive](iso-3691-4-deep-dive.md) — Clause-level analysis of the primary certification standard
27. [Safety Verification and Certification Guide](safety-verification-certification.md) — End-to-end certification landscape
28. [Certification Guide](certification-guide.md) — Cost, timeline, and process for ISO 3691-4 / Machinery Regulation certification
29. [Simplex Safety Architecture](../runtime-assurance/simplex-safety-architecture.md) — Dual-stack architecture with safety arbitration
30. [Regulatory Trajectory Deep Dive](../../80-industry-intel/regulations/regulatory-trajectory-deep-dive.md) — FAA, EASA, ICAO regulatory timeline
31. [Cybersecurity for Airside AVs](../cybersecurity/cybersecurity-airside-av.md) — Threat models, ISO 21434, defense strategies
32. [Ground Crew and Pedestrian Safety](../../70-operations-domains/airside/safety/ground-crew-pedestrian-safety.md) — Ramp accident data, detection challenges
33. [Failure Modes Analysis](../safety-case/failure-modes-analysis.md) — FMEA for airside AV systems
34. [comma.ai Openpilot Codebase Analysis](../../companies/comma-ai/openpilot-codebase-analysis.md) — Detailed analysis of panda safety firmware
35. [comma.ai Production World Model](../../companies/comma-ai/production-world-model.md) — Safety architecture in production
