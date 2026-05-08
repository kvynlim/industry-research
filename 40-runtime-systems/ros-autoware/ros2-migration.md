# ROS 2 Migration Strategy and NVIDIA Isaac ROS Integration

## For Airport Airside Autonomous Vehicle Stack

---

## Table of Contents

1. [ROS Noetic End of Life](#1-ros-noetic-end-of-life)
2. [ROS 2 for Autonomous Vehicles](#2-ros-2-for-autonomous-vehicles)
3. [Key Migration Technical Reference](#3-key-migration-technical-reference)
4. [Hybrid Architecture with ros1_bridge](#4-hybrid-architecture-with-ros1_bridge)
5. [ROS 2 ML Integration](#5-ros-2-ml-integration)
6. [NVIDIA Isaac ROS Deep Dive](#6-nvidia-isaac-ros-deep-dive)
7. [Practical Phased Migration Strategy](#7-practical-phased-migration-strategy)

---

## 1. ROS Noetic End of Life

### 1.1 Timeline

ROS 1 Noetic Ninjemys, the final ROS 1 distribution, reached **end of life on May 31, 2025**, coinciding with Ubuntu 20.04 Focal Fossa's end of standard support. The ROS PMC formally voted on this date after extensive community consultation.

| Milestone | Date |
|-----------|------|
| Noetic release | May 2020 |
| EOL announcement | Late 2024 |
| **Official EOL** | **May 31, 2025** |
| Ubuntu 20.04 standard support EOL | May 2025 |
| Ubuntu 20.04 ESM ends | April 2030 |
| Canonical ROS ESM (extended) | Up to April 2035 |

### 1.2 What EOL Means in Practice

After May 31, 2025, the ROS team discontinued:

- **New features or capabilities** -- no further development
- **Security updates** -- no CVE patches from upstream
- **Bug fixes, patches, and support** -- issues will not be addressed
- **Updated binaries** -- no new package releases

What does **not** change:

- ROS 1 binaries remain hosted on `packages.ros.org`
- Existing ROS 1 projects continue functioning identically
- Source code remains accessible on GitHub
- ROS 1 will not suddenly stop working

### 1.3 Can You Still Use It?

**Yes, but with significant caveats for safety-critical AV applications.**

You can still run ROS Noetic on Ubuntu 20.04 indefinitely. The software does not expire. However, for an autonomous vehicle operating on airport airside, the implications are serious:

1. **Security exposure**: Unpatched vulnerabilities in the ROS communication stack, serialization libraries, and dependencies create attack surface. The EU Cyber Resilience Act (CRA) mandates keeping systems updated -- running unsupported software on operational networks is typically a compliance violation.

2. **Dependency rot**: As upstream libraries (Boost, PCL, OpenCV, Eigen) evolve, building and maintaining ROS Noetic packages becomes progressively harder. Newer GPU drivers, CUDA versions, and kernel releases may break compatibility.

3. **Ecosystem abandonment**: Hardware vendors (sensor manufacturers, compute platform vendors like NVIDIA) are dropping ROS 1 support. New sensor drivers, calibration tools, and perception libraries target ROS 2 exclusively.

4. **Talent availability**: New robotics engineers are trained on ROS 2. Maintaining a Noetic codebase increasingly requires specialized institutional knowledge.

### 1.4 Extended Support Options

For organizations that cannot migrate immediately:

**Canonical ROS ESM (Extended Security Maintenance)**

- Part of Ubuntu Pro for Applications
- Provides 5 additional years of security patches and CVE fixes beyond EOL (through 2030)
- Covers 600+ packages across ROS 1 distributions (Kinetic, Melodic, Noetic) and ROS 2 Foxy
- Ubuntu Pro is free for personal use; commercial pricing designed for device makers
- Deployment via dedicated PPA, Docker containers, or Snap packages
- ESM-enabled content snaps (e.g., `ros-noetic-desktop`, `ros-noetic-ros-base`) receive security updates on the Snap Store without requiring a Pro token

**ROS-O (Community Effort)**

- Volunteer-run community effort to extend ROS 1 support
- Not officially supported by Open Robotics
- Builds ROS 1 packages on newer Ubuntu versions
- Useful as a stopgap but should not be relied upon for production safety-critical systems

**Practical recommendation for airside AV**: Use Canonical ROS ESM as a bridge during migration. This provides the security coverage needed for compliance while allowing a controlled, phased migration to ROS 2. Do not plan on remaining on Noetic beyond 2027 -- by then, the ecosystem divergence will be too severe.

---

## 2. ROS 2 for Autonomous Vehicles

### 2.1 Why ROS 2 for AV Systems

ROS 2 addresses fundamental limitations of ROS 1 that matter critically for autonomous vehicles:

| Capability | ROS 1 | ROS 2 |
|-----------|-------|-------|
| Communication | Custom TCPROS/UDPROS | DDS (industry standard) |
| Discovery | Central rosmaster | Decentralized peer-to-peer |
| Real-time | No deterministic guarantees | DDS QoS profiles, real-time executor |
| Multi-robot | Complex workarounds | Native domain separation |
| Security | None built-in | DDS Security (SROS2) |
| Lifecycle | Ad-hoc | Managed node lifecycle |
| Quality of Service | Best-effort only | Configurable reliability, durability, deadline |
| Platform support | Ubuntu only | Linux, Windows, macOS, RTOS |

For an airside AV, the QoS system is particularly valuable. ROS 2 provides configurable QoS profiles that let you specify:

- **Reliability**: RELIABLE (TCP-like guaranteed delivery) vs. BEST_EFFORT (UDP-like, lower latency)
- **Durability**: TRANSIENT_LOCAL (late-joining subscribers get last message) vs. VOLATILE
- **Deadline**: Maximum acceptable period between messages
- **Liveliness**: Automatic heartbeat detection for node health monitoring
- **History depth**: How many messages to keep in queue

Recommended QoS profiles for AV subsystems:

```
Sensor data (LiDAR, camera):  BEST_EFFORT, VOLATILE, history=1
Control commands:              RELIABLE, VOLATILE, deadline=20ms
Localization:                  RELIABLE, TRANSIENT_LOCAL, history=1
Safety/diagnostics:            RELIABLE, TRANSIENT_LOCAL, history=10
Map data:                      RELIABLE, TRANSIENT_LOCAL, history=1
```

### 2.2 Distribution Selection

As of March 2026, three ROS 2 distributions are relevant:

| Distribution | Release | EOL | Ubuntu | Status |
|-------------|---------|-----|--------|--------|
| **Humble Hawksbill** | May 2022 | May 2027 | 22.04 | LTS, mature, broad ecosystem |
| **Jazzy Jalisco** | May 2024 | May 2029 | 24.04 | LTS, growing ecosystem |
| **Kilted Kaiju** | May 2025 | Nov 2026 | 24.04 | Non-LTS, short support |
| Rolling Ridley | Ongoing | N/A | Latest | Development only |

**Recommendation for airside AV: Start with Jazzy Jalisco.**

Rationale:

1. **Longest support window**: Jazzy is supported through May 2029, giving a 3+ year runway for production deployment and iteration.
2. **Ubuntu 24.04 LTS**: Aligns with the latest long-term supported Ubuntu, which will be supported through April 2029 (standard) and April 2034 (ESM).
3. **Isaac ROS compatibility**: NVIDIA Isaac ROS 4.x supports ROS 2 Jazzy. The latest Isaac ROS 4.2.0 (released February 2026) targets JetPack 7.1 on Ubuntu 24.04.
4. **Autoware trajectory**: Autoware Foundation is actively migrating to Jazzy, with Jazzy Docker Beta in February 2026 and full support planned by April 2026. Humble enters soft-freeze January 2027.
5. **Modern DDS and tooling**: Jazzy includes updated Fast DDS, improved type description support, and more mature composable node infrastructure.

If your team needs to deploy before Jazzy support matures in your dependency tree, start development on Jazzy but maintain Humble CI as a fallback. The API differences between Humble and Jazzy are modest.

### 2.3 Autoware.Universe Architecture

Autoware is the world's leading open-source autonomous driving stack, built natively on ROS 2. Understanding its architecture is essential because it represents the industry-standard reference for how an AV stack should be structured on ROS 2.

**Four-Layer Stack**:

```
Layer 4: Vehicle Interface (CAN bus, drive-by-wire)
Layer 3: Core Pipeline (Sensing → Localization → Perception → Planning → Control)
Layer 2: ROS 2 Middleware (DDS, QoS, lifecycle management)
Layer 1: Sensors & Infrastructure (LiDAR, cameras, GNSS/IMU, HD maps)
```

**Core Functional Modules**:

| Module | Responsibility | Key Algorithms |
|--------|---------------|----------------|
| **Sensing** | Raw data acquisition, preprocessing, sensor fusion | Point cloud filtering, image rectification, time synchronization |
| **Localization** | Global and local pose estimation | NDT matching, EKF fusion, GNSS/IMU integration |
| **Perception** | Object detection, tracking, segmentation | PointPillars, CenterPoint, YOLO families, clustering |
| **Prediction** | Future trajectory estimation for detected objects | Motion prediction, lane-following models |
| **Planning** | Route planning, behavior planning, motion planning | Lanelet2 routing, lattice planner, optimization-based planners |
| **Control** | Trajectory following, vehicle dynamics | MPC, PID, pure pursuit |
| **Vehicle** | Hardware abstraction for drive-by-wire | CAN interface, actuator commands |
| **Map** | HD map loading and serving | Lanelet2, point cloud maps |
| **System** | Diagnostics, monitoring, mode management | Health monitoring, emergency stop |

**Communication patterns**: The system operates at multiple frequencies -- sensing and control at 30-100 Hz, planning at 10-30 Hz, and map updates at 1-10 Hz. ROS 2's QoS system handles these heterogeneous requirements naturally.

**Relevance to airside AV**: For airport airside operations, you would adopt the Autoware architecture pattern but customize several modules:
- **Perception**: Add aircraft and GSE (ground support equipment) detection classes
- **Planning**: Implement airport-specific traffic rules, stand assignments, taxiway following
- **Map**: Use airport GIS data and airside HD maps instead of road HD maps
- **Safety**: Add geofencing for restricted zones, runway incursion prevention

---

## 3. Key Migration Technical Reference

### 3.1 roscpp to rclcpp

The C++ client library has been completely rewritten. Here is a comprehensive mapping of the most common patterns:

**Initialization and Node Creation**:

```cpp
// ROS 1
#include "ros/ros.h"
int main(int argc, char** argv) {
    ros::init(argc, argv, "my_node");
    ros::NodeHandle nh;
    ros::NodeHandle pnh("~");  // private namespace
    // ...
    ros::spin();
}

// ROS 2
#include "rclcpp/rclcpp.hpp"
class MyNode : public rclcpp::Node {
public:
    MyNode() : Node("my_node") {
        // parameters, publishers, subscribers declared here
    }
};
int main(int argc, char** argv) {
    rclcpp::init(argc, argv);
    auto node = std::make_shared<MyNode>();
    rclcpp::spin(node);
    rclcpp::shutdown();
}
```

**Publishers and Subscribers**:

```cpp
// ROS 1
ros::Publisher pub = nh.advertise<std_msgs::String>("topic", 10);
ros::Subscriber sub = nh.subscribe("topic", 10, callback);

// ROS 2
auto pub = this->create_publisher<std_msgs::msg::String>("topic", 10);
auto sub = this->create_subscription<std_msgs::msg::String>(
    "topic", 10, std::bind(&MyNode::callback, this, std::placeholders::_1));
```

**Services**:

```cpp
// ROS 1 -- service callbacks return bool
bool callback(nav_msgs::GetMap::Request& req,
              nav_msgs::GetMap::Response& res) {
    // ...
    return true;
}

// ROS 2 -- service callbacks return void, use shared_ptr args
void callback(const std::shared_ptr<nav_msgs::srv::GetMap::Request> req,
              std::shared_ptr<nav_msgs::srv::GetMap::Response> res) {
    // throw exceptions on failure instead of returning false
}
```

**Parameters**:

```cpp
// ROS 1
int val;
nh.param("my_param", val, 42);

// ROS 2
this->declare_parameter("my_param", 42);
int val = this->get_parameter("my_param").as_int();
```

**Logging**:

```cpp
// ROS 1
ROS_INFO("Message: %s", str.c_str());
ROS_WARN_ONCE("Warning");
ROS_DEBUG_THROTTLE(1.0, "Debug every 1s");

// ROS 2
RCLCPP_INFO(this->get_logger(), "Message: %s", str.c_str());
RCLCPP_WARN_ONCE(this->get_logger(), "Warning");
RCLCPP_DEBUG_THROTTLE(this->get_logger(), *this->get_clock(),
                       1000, "Debug every 1s");  // milliseconds
```

**Time and Rate**:

```cpp
// ROS 1
ros::Time now = ros::Time::now();
ros::Duration d(1.5);
ros::Rate rate(30.0);

// ROS 2
rclcpp::Time now = this->now();
rclcpp::Duration d(1, 500000000);  // seconds, nanoseconds
rclcpp::Rate rate(30.0);
// Note: field "nsec" renamed to "nanosec" in messages
```

**Timers**:

```cpp
// ROS 1
ros::Timer timer = nh.createTimer(ros::Duration(0.1), timerCallback);

// ROS 2
auto timer = this->create_wall_timer(
    std::chrono::milliseconds(100),
    std::bind(&MyNode::timerCallback, this));
```

**Message Headers**:

```cpp
// ROS 1
#include <std_msgs/String.h>
#include <geometry_msgs/PointStamped.h>
std_msgs::String msg;
geometry_msgs::PointStamped point;

// ROS 2 -- note the /msg/ subfolder and .hpp extension
#include <std_msgs/msg/string.hpp>
#include <geometry_msgs/msg/point_stamped.hpp>
std_msgs::msg::String msg;
geometry_msgs::msg::PointStamped point;
```

**Standard Library Replacements** (Boost to std):

| ROS 1 (Boost) | ROS 2 (std) |
|---------------|-------------|
| `boost::shared_ptr<T>` | `std::shared_ptr<T>` |
| `boost::mutex::scoped_lock` | `std::unique_lock<std::mutex>` |
| `boost::function` | `std::function` |
| `boost::unordered_map` | `std::unordered_map` |
| `boost::bind` | `std::bind` |
| `boost::thread` | `std::thread` |

### 3.2 Nodelets to Components (Composable Nodes)

ROS 2 expanded and improved the nodelet concept, replacing it with **composable nodes** (Components). This is critical for AV perception pipelines where eliminating inter-process serialization overhead is essential.

**Key differences**:

| Aspect | ROS 1 Nodelets | ROS 2 Components |
|--------|---------------|------------------|
| API | Different from standalone nodes | Same API as standalone nodes |
| Loading | Nodelet manager process | Component container |
| Communication | Shared memory via nodelet manager | Intra-process communication + zero-copy |
| Registration | `PLUGINLIB_EXPORT_CLASS` | `RCLCPP_COMPONENTS_REGISTER_NODE` |
| Launch | XML with nodelet manager | Python/XML with ComposableNodeContainer |

**Writing a ROS 2 Component**:

```cpp
// my_component.hpp
#include "rclcpp/rclcpp.hpp"
#include "rclcpp_components/register_node_macro.hpp"

class MyComponent : public rclcpp::Node {
public:
    explicit MyComponent(const rclcpp::NodeOptions& options)
        : Node("my_component", options) {
        // Same code as a standalone node
    }
};

RCLCPP_COMPONENTS_REGISTER_NODE(MyComponent)
```

**Intra-process communication**: When components are loaded into the same container process with IPC enabled, publishing with `std::unique_ptr` enables true zero-copy transport -- the subscriber receives the same memory buffer without any copy. This is critical for large messages like point clouds and images.

```cpp
// Enable intra-process communication in launch
ComposableNodeContainer(
    name='perception_container',
    namespace='',
    package='rclcpp_components',
    executable='component_container',
    composable_node_descriptions=[
        ComposableNode(
            package='my_package',
            plugin='MyComponent',
            name='my_component',
            extra_arguments=[{'use_intra_process_comms': True}]
        ),
    ],
)
```

### 3.3 catkin to colcon / ament

**Build System Migration**:

| Aspect | ROS 1 | ROS 2 |
|--------|-------|-------|
| Build tool | `catkin_make` / `catkin build` | `colcon build` |
| Build system | catkin (CMake wrapper) | ament_cmake (CMake macros) |
| Workspace | `catkin_ws/src/` | `ros2_ws/src/` |
| Source | `source devel/setup.bash` | `source install/setup.bash` |

**package.xml changes**:

```xml
<!-- ROS 1 -->
<buildtool_depend>catkin</buildtool_depend>
<depend>roscpp</depend>
<depend>std_msgs</depend>

<!-- ROS 2 -->
<buildtool_depend>ament_cmake</buildtool_depend>
<depend>rclcpp</depend>
<depend>std_msgs</depend>
<export>
  <build_type>ament_cmake</build_type>
</export>
```

**CMakeLists.txt changes**:

```cmake
# ROS 1
cmake_minimum_required(VERSION 2.8.12)
project(my_package)
find_package(catkin REQUIRED COMPONENTS roscpp std_msgs)
catkin_package()
include_directories(${catkin_INCLUDE_DIRS})
add_executable(my_node src/my_node.cpp)
target_link_libraries(my_node ${catkin_LIBRARIES})

# ROS 2
cmake_minimum_required(VERSION 3.14.4)
project(my_package)
set(CMAKE_CXX_STANDARD 17)

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(std_msgs REQUIRED)

add_executable(my_node src/my_node.cpp)
target_link_libraries(my_node PUBLIC rclcpp::rclcpp)
ament_target_dependencies(my_node PUBLIC std_msgs)

install(TARGETS my_node DESTINATION lib/${PROJECT_NAME})

ament_package()
```

**Message generation**:

```cmake
# ROS 1
add_message_files(DIRECTORY msg FILES MyMsg.msg)
add_service_files(DIRECTORY srv FILES MySrv.srv)
generate_messages(DEPENDENCIES std_msgs geometry_msgs)

# ROS 2
find_package(rosidl_default_generators REQUIRED)
rosidl_generate_interfaces(${PROJECT_NAME}
    "msg/MyMsg.msg"
    "srv/MySrv.srv"
    DEPENDENCIES std_msgs geometry_msgs
)
```

**Installation paths**:

| catkin destination | ament equivalent |
|-------------------|-----------------|
| `CATKIN_GLOBAL_BIN_DESTINATION` | `bin` |
| `CATKIN_PACKAGE_LIB_DESTINATION` | `lib` |
| `CATKIN_PACKAGE_INCLUDE_DESTINATION` | `include/${PROJECT_NAME}` |
| `CATKIN_PACKAGE_SHARE_DESTINATION` | `share/${PROJECT_NAME}` |

### 3.4 Launch File Migration

ROS 2 launch files can be written in Python, XML, or YAML. Python is recommended for complex logic; XML works well for straightforward configurations.

**XML syntax changes**:

```xml
<!-- ROS 1 -->
<launch>
  <arg name="use_sim" default="true" doc="Use simulation time"/>
  <node pkg="my_pkg" type="my_node" name="my_node" output="screen">
    <param name="rate" value="30.0"/>
    <remap from="input" to="/sensor/data"/>
  </node>
  <include file="$(find other_pkg)/launch/other.launch">
    <arg name="sim" value="$(arg use_sim)"/>
  </include>
</launch>

<!-- ROS 2 XML -->
<launch>
  <arg name="use_sim" default="true" description="Use simulation time"/>
  <node pkg="my_pkg" exec="my_node" name="my_node" output="screen">
    <param name="rate" value="30.0"/>
    <remap from="input" to="/sensor/data"/>
  </node>
  <include file="$(find-pkg-share other_pkg)/launch/other.launch.xml">
    <arg name="sim" value="$(var use_sim)"/>
  </include>
</launch>
```

**Key XML attribute changes**:

| ROS 1 | ROS 2 |
|-------|-------|
| `type="node_executable"` | `exec="node_executable"` |
| `ns="namespace"` | `namespace="namespace"` |
| `doc="description"` | `description="description"` |
| `$(find pkg)` | `$(find-pkg-share pkg)` |
| `$(arg var)` | `$(var var)` |

**Removed features**: `machine`, `respawn_delay`, `clear_params`, `$(anon ...)` are not available in ROS 2. Global parameters do not exist -- all parameters are node-scoped.

**Automated migration**: AWS provides a `ros2-launch-file-migrator` tool that converts ROS 1 XML launch files to ROS 2 Python launch files automatically, useful as a starting point for bulk migration.

### 3.5 TF2 Migration

TF2 is conceptually identical between ROS 1 and ROS 2, but the implementation differs due to the underlying client library changes.

**TransformBroadcaster**:

```cpp
// ROS 1
#include <tf2_ros/transform_broadcaster.h>
tf2_ros::TransformBroadcaster br;
br.sendTransform(transform_stamped);

// ROS 2 -- requires node reference
#include <tf2_ros/transform_broadcaster.h>
auto br = std::make_shared<tf2_ros::TransformBroadcaster>(this);
br->sendTransform(transform_stamped);
```

**TransformListener and Buffer**:

```cpp
// ROS 1
tf2_ros::Buffer tf_buffer;
tf2_ros::TransformListener tf_listener(tf_buffer);
auto transform = tf_buffer.lookupTransform("target", "source", ros::Time(0));

// ROS 2
auto tf_buffer = std::make_shared<tf2_ros::Buffer>(this->get_clock());
auto tf_listener = std::make_shared<tf2_ros::TransformListener>(*tf_buffer);
auto transform = tf_buffer->lookupTransform("target", "source", tf2::TimePointZero);
```

**Key change**: The Buffer constructor in ROS 2 takes a `rclcpp::Clock` reference instead of using the global `ros::Time`. This enables proper simulation time support through the `/clock` topic.

### 3.6 Message Compatibility

ROS 1 and ROS 2 messages are **not binary-compatible** but are semantically equivalent for standard message types. The `ros1_bridge` handles translation. Key differences:

- **Namespace insertion**: `geometry_msgs/Pose` becomes `geometry_msgs/msg/Pose`
- **Header changes**: `Header` moved to `std_msgs/msg/Header`
- **Time fields**: `nsec` renamed to `nanosec`
- **Duration**: Same structural change as Time
- **String type**: Uses `std::string` directly (no custom String class)
- **Arrays**: Use `std::vector` consistently

Custom messages must be defined separately in both ROS 1 and ROS 2 workspaces, with a mapping file for `ros1_bridge` to translate between them.

---

## 4. Hybrid Architecture with ros1_bridge

### 4.1 Why a Hybrid Architecture

A full rewrite of an AV stack is high-risk. The hybrid approach lets you:

1. Keep validated ROS 1 components running during migration
2. Migrate and test one module at a time
3. Run ROS 2 components alongside ROS 1 with bidirectional communication
4. Validate ROS 2 components against ROS 1 ground truth

### 4.2 ros1_bridge Architecture

The `ros1_bridge` is a ROS 2 package that translates messages and services between ROS 1 and ROS 2 at runtime. It speaks TCPROS to the ROS 1 side and DDS to the ROS 2 side.

**Two modes of operation**:

| Mode | Command | Behavior | Use Case |
|------|---------|----------|----------|
| **Dynamic bridge** | `ros2 run ros1_bridge dynamic_bridge` | Automatically bridges all topics with matching publisher-subscriber pairs | Development, testing |
| **Parameter bridge** | `ros2 run ros1_bridge parameter_bridge` | Selectively bridges configured topics only | Production, performance-sensitive |

**Supported types**: The prebuilt bridge supports all standard message types from `ros2/common_interfaces` (std_msgs, sensor_msgs, geometry_msgs, nav_msgs, etc.) and `tf2_msgs`. Custom messages require building the bridge from source.

**Service bridging**: Services are monodirectional -- you must specify `services_1_to_2` or `services_2_to_1` in the parameter configuration.

### 4.3 Performance Overhead

The bridge introduces measurable overhead. Based on community benchmarks and reported issues:

| Metric | Typical Values | Notes |
|--------|---------------|-------|
| **Latency per hop** | 2-7 ms for small messages (<3 KB) | Varies with CPU speed and message size |
| **TF latency** | +50-110 ms additional | Reported in production systems |
| **CPU impact** | Significant at >100 Hz | 2.4 GHz CPU crashes above 100 Hz; 3.6 GHz sustains 1000 Hz |
| **Memory** | Grows over time with dynamic bridge | CPU/memory usage can increase steadily in ROS1-to-ROS2 direction |
| **Throughput** | Linear degradation with data size | Large sensor messages (images, point clouds) incur proportionally more overhead |

**Critical considerations for airside AV**:

- **Do not bridge high-bandwidth sensor data** (raw camera images, dense LiDAR point clouds) if avoidable. Instead, migrate the sensor driver and its immediate consumers together.
- **Use the parameter bridge** (static configuration) in production. The dynamic bridge bridges everything, adding unnecessary CPU and memory overhead.
- **Bridge only cross-boundary interfaces**: If perception runs on ROS 2 and planning on ROS 1, bridge only the perception output (detected objects, occupancy grid), not raw sensor streams.

### 4.4 Docker Isolation Strategy

Running ROS 1 and ROS 2 in separate Docker containers is the cleanest deployment architecture for a hybrid system.

**Recommended architecture**:

```
┌─────────────────────────────────────────────────────────┐
│                    Host (Ubuntu 24.04)                   │
│                                                         │
│  ┌──────────────────┐  ┌─────────────────────────────┐  │
│  │ Docker: ROS 1    │  │ Native/Docker: ROS 2 Jazzy  │  │
│  │ (Ubuntu 20.04)   │  │                             │  │
│  │                  │  │  ┌───────────────────────┐  │  │
│  │  Legacy nodes:   │  │  │  ros1_bridge           │  │  │
│  │  - Planning      │  │  │  (parameter_bridge)    │  │  │
│  │  - Control       │  │  │                       │  │  │
│  │                  │  │  └───────────────────────┘  │  │
│  │                  │  │                             │  │
│  │                  │  │  New ROS 2 nodes:           │  │
│  │                  │  │  - Sensor drivers           │  │
│  │                  │  │  - Perception (Isaac ROS)   │  │
│  │                  │  │  - Localization             │  │
│  └──────────────────┘  └─────────────────────────────┘  │
│                                                         │
│  Shared: --network=host, /dev/shm, /dev (sensors)       │
└─────────────────────────────────────────────────────────┘
```

**Docker configuration requirements**:

- `--network=host`: Required for ROS 1 master discovery and DDS peer discovery
- `-v /dev/shm:/dev/shm`: Shared memory for DDS fast transport
- `-v /dev:/dev --privileged`: Access to sensor hardware (cameras, LiDAR, CAN bus)
- X11 forwarding for visualization tools (RViz, rqt)

**Building the bridge in Docker**: Because the bridge must compile against both ROS 1 and ROS 2 message definitions, build it in a dedicated container that has both environments. Community-maintained Dockerfiles exist for this purpose (e.g., `ros-humble-ros1-bridge-builder` by TommyChangUMD, Noetic+Humble bridge on JetPack by various community members).

**Platform constraint**: Ubuntu 24.04 has no native ROS 1 support. The ROS 1 stack must run in a Docker container based on Ubuntu 20.04, or use community ports. This makes Docker isolation not just convenient but architecturally necessary on modern host OS versions.

### 4.5 Recommended Bridge Configuration

For the airside AV, bridge only the minimum necessary interfaces:

```yaml
# bridge_config.yaml
topics:
  # Perception output (ROS 2) -> Planning (ROS 1)
  - topic: /perception/detected_objects
    type: autoware_msgs/DetectedObjectArray
    queue_size: 1

  - topic: /perception/occupancy_grid
    type: nav_msgs/OccupancyGrid
    queue_size: 1

  # Localization (ROS 2) -> Planning (ROS 1)
  - topic: /localization/pose
    type: geometry_msgs/PoseStamped
    queue_size: 1

  # Planning (ROS 1) -> Control (either side)
  - topic: /planning/trajectory
    type: autoware_msgs/Trajectory
    queue_size: 1

  # TF -- essential for coordinate frame consistency
  - topic: /tf
    type: tf2_msgs/TFMessage
    queue_size: 100

  - topic: /tf_static
    type: tf2_msgs/TFMessage
    queue_size: 100
```

---

## 5. ROS 2 ML Integration

### 5.1 Isaac ROS DNN Inference

NVIDIA Isaac ROS provides two GPU-accelerated inference nodes, both NITROS-compatible for zero-copy integration:

**TensorRT Node** (`isaac_ros_tensor_rt`):

- CUDA-based, on-GPU inference framework
- Supports ONNX and TensorRT Engine Plan formats
- Automatically converts ONNX models to optimized Engine Plans (one-time startup cost)
- Minimal configuration overhead
- Best for: dedicated GPU inference with pre-optimized models

**Triton Node** (`isaac_ros_triton`):

- Based on NVIDIA Triton Inference Server
- Supports TensorFlow, TensorRT, PyTorch, ONNX Runtime
- Supports both GPU and CPU inference
- Requires model repository setup and configuration files
- Best for: multi-framework deployments, shared GPU resources, model versioning

**Pipeline architecture**: Both nodes follow the encoder-inference-decoder pattern:

```
Raw ROS msg → DNN Image Encoder → Tensor List → TensorRT/Triton → Tensor List → Decoder → ROS msg
                (resize, normalize,              (inference)        (interpret output:
                 type conversion)                                    detections, masks,
                                                                     poses, etc.)
```

**Performance**: Both nodes deliver comparable inference speed. Selection should be based on deployment constraints rather than raw performance:

| Benchmark (Isaac ROS 4.2) | Hardware | FPS | Latency |
|---------------------------|----------|-----|---------|
| TensorRT (PeopleSemSegNet) | x86 + RTX 5090 | 1,570 | 1.5 ms |
| TensorRT (PeopleSemSegNet) | AGX Thor T5000 | ~385 | 2.9 ms |
| DNN Stereo Disparity | x86 + RTX 5090 | 350 | 5.3 ms |
| H.264 Encoder | DGX Spark | 921 | 2.7 ms |

### 5.2 GPU Memory Sharing and NITROS

**NVIDIA Isaac Transport for ROS (NITROS)** is the key technology enabling efficient GPU-accelerated perception pipelines in ROS 2.

**How NITROS works**:

1. **Type Adaptation (REP-2007)**: Allows ROS nodes to work with hardware-optimized data formats (e.g., GPU buffers) instead of standard ROS messages. When data needs to cross to a non-NITROS node, it is automatically converted back to standard format.

2. **Type Negotiation (REP-2009)**: Nodes advertise their supported data types, and the framework selects the format that yields optimal performance. This happens transparently at graph construction time.

3. **Zero-copy transport**: When NITROS nodes operate in the same process (composable node container), data stays in GPU memory and is passed by pointer -- no CPU copies, no serialization.

**Performance impact**:

| Platform | Improvement over baseline ROS 2 |
|----------|-------------------------------|
| Jetson AGX Xavier | 3x framework throughput |
| Jetson AGX Orin | 7x framework throughput |

**Constraints**:
- All NITROS nodes in a pipeline must run in the same process
- Only one negotiating publisher per topic
- Frame IDs must be constant at runtime

**NITROS data types**: One-to-one mappings with standard ROS messages:

- `NitrosImage` ↔ `sensor_msgs/msg/Image`
- `NitrosPointCloud` ↔ `sensor_msgs/msg/PointCloud2`
- `NitrosOccupancyGrid` ↔ `nav_msgs/msg/OccupancyGrid`
- `NitrosDetection2DArray` ↔ `vision_msgs/msg/Detection2DArray`
- `NitrosDetection3DArray` ↔ `vision_msgs/msg/Detection3DArray`
- `NitrosCameraInfo` ↔ `sensor_msgs/msg/CameraInfo`
- `NitrosDisparityImage` ↔ `stereo_msgs/msg/DisparityImage`
- `NitrosImu` ↔ `sensor_msgs/msg/Imu`
- `NitrosOdometry` ↔ `nav_msgs/msg/Odometry`
- `NitrosTensorList` ↔ Isaac ROS tensor format

**CUDA with NITROS**: Custom ROS nodes can publish GPU data directly to NITROS pipelines using the NITROS publisher. This lets your own CUDA kernels produce output in GPU memory and hand it off to Isaac ROS nodes without any CPU round-trip. This is essential for custom point cloud preprocessing or image transformations.

### 5.3 Zero-Copy for Point Clouds

Point clouds are the largest data structures in a typical AV pipeline. A 128-beam LiDAR at 10 Hz can generate 2+ million points per frame, each with XYZI fields -- roughly 32 MB/s of raw data.

**Strategies for zero-copy point cloud handling in ROS 2**:

1. **Intra-process communication**: Load point cloud producer and consumer nodes into the same composable node container. Publish with `std::unique_ptr<sensor_msgs::msg::PointCloud2>` to enable zero-copy handoff.

2. **NITROS NitrosPointCloud**: If using Isaac ROS perception nodes, the point cloud stays in GPU memory throughout the pipeline (e.g., preprocessing → voxelization → PointPillars inference → detection output).

3. **Shared memory transport**: ROS 2 with Eclipse iceoryx or Fast DDS shared memory transport can eliminate serialization for inter-process point cloud transfer on the same machine.

4. **CUDA PointPillars integration**: Projects like `CUDA-PointPillars-ROS2` demonstrate feeding ROS 2 `PointCloud2` data directly into CUDA C++ pointers for GPU-accelerated LiDAR perception, achieving real-time processing at 26-30 Hz for 16-beam LiDAR.

---

## 6. NVIDIA Isaac ROS Deep Dive

### 6.1 Complete Package Inventory for AV Applications

The following Isaac ROS packages are directly relevant to airside autonomous vehicle development:

#### Perception

| Package | Description | AV Relevance |
|---------|------------|--------------|
| `isaac_ros_dnn_inference` | TensorRT and Triton DNN inference | Core inference engine for all DNN-based perception |
| `isaac_ros_detectnet` | DetectNet 2D object detection | Vehicle and GSE detection |
| `isaac_ros_yolov8` | YOLOv8 detection and segmentation | Real-time multi-class object detection |
| `isaac_ros_rtdetr` | Real-time DETR detection | Transformer-based detection with better small-object performance |
| `isaac_ros_segformer` | Semantic segmentation (SegFormer) | Road/taxiway surface segmentation |
| `isaac_ros_unet` | U-Net semantic segmentation | Freespace and drivable area segmentation |
| `isaac_ros_segment_anything` | SAM foundation model | Zero-shot segmentation for novel objects |
| `isaac_ros_foundationpose` | 6-DoF pose estimation | Precise object pose for obstacle avoidance |
| `isaac_ros_grounding_dino` | Zero-shot object detection | Detecting novel/rare airport objects without retraining |

#### Depth and Stereo

| Package | Description | AV Relevance |
|---------|------------|--------------|
| `isaac_ros_ess` | DNN-based stereo depth estimation | Dense depth maps from stereo cameras |
| `isaac_ros_foundationstereo` | Foundation model stereo disparity | State-of-art depth estimation (v2 in 4.2) |
| `isaac_ros_depth_segmentation` | Bi3D depth/proximity segmentation | Obstacle proximity detection on DLA |
| `isaac_ros_image_pipeline` | Camera processing (rectification, etc.) | Baseline camera preprocessing |
| `isaac_ros_stereo_image_proc` | Stereo image processing | Stereo camera preprocessing |

#### Localization and Mapping

| Package | Description | AV Relevance |
|---------|------------|--------------|
| `isaac_ros_visual_slam` | cuVSLAM visual-inertial SLAM | Primary visual localization |
| `isaac_ros_nvblox` | 3D scene reconstruction + costmaps | Dynamic obstacle mapping |
| `isaac_ros_occupancy_grid_localizer` | Grid-based localization | Localization within known maps |
| `isaac_mapping_ros` | Visual map creation and management | Pre-mapping airside environment |
| `isaac_ros_pointcloud_utils` | Point cloud utilities | LiDAR data processing |

#### Infrastructure

| Package | Description | AV Relevance |
|---------|------------|--------------|
| `isaac_ros_nitros` | Zero-copy GPU transport | Performance backbone |
| `isaac_ros_h264_encoder/decoder` | Hardware video compression | Camera stream recording/replay |
| `isaac_ros_apriltag` | CUDA AprilTag detection | Landmark-based localization, docking |
| `isaac_ros_benchmark` | Performance benchmarking tools | Validating real-time performance |
| `isaac_ros_jetson` | Jetson hardware monitoring | System health in production |

### 6.2 cuVSLAM Deep Dive

cuVSLAM is a GPU-accelerated visual-inertial SLAM library purpose-built for robotics applications.

**Architecture**:

- Visual odometry and SLAM run in parallel threads
- Input images are transferred to GPU for feature extraction
- 2D features are tracked across frames and maintained as 3D landmarks
- Pose graph optimization handles loop closures without map size explosion (revisited landmarks merge rather than duplicate)

**Multi-camera support**: Up to 32 cameras (16 stereo pairs), providing robust localization even in featureless environments. Performance scales: >30 fps with 4 stereo camera pairs on Jetson AGX Orin. With fewer cameras, performance exceeds 250 fps.

**IMU fusion**: When visual odometry fails (poor lighting, uniform surfaces, fast motion), cuVSLAM automatically falls back to IMU-only tracking. This provides acceptable pose quality for approximately 1 second of visual degradation -- enough to bridge temporary occlusions or transitions.

**Map management**:
- `SaveMap`: Persists landmarks and pose graph to disk
- `LocalizeInMap`: Runtime localization against a saved map with prior pose estimates
- Supports both SLAM (exploration) and localization-only (known environment) modes

**Coordinate frames**: Manages four reference frames:
- `base_frame`: Robot/camera rig
- `map_frame`: Map origin (global)
- `odom_frame`: Odometry origin (local, drift-free short-term)
- `camera_optical_frames`: Individual camera centers

**Airside AV application**: Pre-map the airside environment using cuVSLAM's mapping mode during supervised runs. Then deploy in localization-only mode for production operations, with the ability to update maps incrementally as the environment changes (new construction, seasonal changes, aircraft positions).

### 6.3 nvblox for Dynamic Obstacle Mapping

nvblox builds real-time 3D voxel maps from depth sensors (stereo cameras, RGB-D cameras, LiDAR) using TSDF (Truncated Signed Distance Function).

**Key capabilities for AV**:

1. **Real-time 3D reconstruction**: Builds dense voxel maps at 30 Hz from depth input
2. **ESDF generation**: Euclidean Signed Distance Function enables instant collision checking at any point in space
3. **Costmap output**: Generates 2D costmaps compatible with Nav2 for path planning
4. **Dynamic obstacle detection**: Separate processing modes for static environment and dynamic objects
5. **Human/people segmentation**: Dedicated mode for detecting and tracking people near the vehicle

**Performance on Jetson Orin 64GB at 30 Hz**:

| Mode | Max Cameras |
|------|-------------|
| Static reconstruction | 4 |
| People segmentation | 3 |
| Dynamics mode | 4 |

**Performance advantage**: 100x faster than CPU-centric methods for obstacle detection and costmap generation within 5-meter range.

**Airside AV application**: nvblox is particularly valuable for detecting unexpected obstacles on the ramp -- luggage, FOD (foreign object debris), personnel, and ground equipment that may not appear in pre-built maps. The real-time costmap output integrates directly with Nav2 for reactive obstacle avoidance.

### 6.4 Freespace Segmentation and Proximity Detection

**Freespace Segmentation** (`isaac_ros_freespace_segmentation`):

- Processes Bi3D freespace segmentation masks with robot pose to produce occupancy grids
- Designed for Nav2 integration -- outputs directly compatible with the local costmap layer
- Identifies drivable vs. non-drivable surfaces from stereo camera input

**Proximity/Depth Segmentation** (`isaac_ros_depth_segmentation`):

- Bi3D predicts whether obstacles are within a configurable proximity field
- Runs on NVIDIA DLA (not GPU), providing functional safety diversity
- DLA delivers ~46 fps on Jetson AGX Orin with ~30 ms latency
- Frees GPU resources for other perception tasks
- Simultaneously predicts freespace from ground plane

**Significance of DLA for safety-critical AV**: Running proximity detection on DLA while other perception runs on GPU provides hardware diversity -- if the GPU has a fault, the DLA-based proximity detector continues operating independently. This is a meaningful contribution to functional safety arguments.

### 6.5 Jetson AGX Orin Platform for AV

The Jetson AGX Orin is the recommended compute platform for deploying Isaac ROS in an autonomous vehicle.

**Specifications**:

| Spec | AGX Orin 64GB |
|------|---------------|
| AI Performance | 275 TOPS (INT8 sparse) |
| GPU | 2048-core Ampere |
| DLA | 2x NVDLA v2.0 |
| CPU | 12-core Arm Cortex-A78AE |
| Memory | 64 GB LPDDR5 (204.8 GB/s) |
| Power | 15W - 60W configurable |
| Storage | 64 GB eMMC + NVMe support |

**DLA contribution to total performance**:

| Power Mode | DLA TOPS | % of Total | DLA Perf/Watt vs GPU |
|-----------|----------|------------|---------------------|
| MAXN (60W) | 105 | 38% | 3-5x better |
| 50W | 92 | 46% | 3-5x better |
| 30W | 90 | 69% | 3-5x better |
| 15W | 40 | 74% | 3-5x better |

**Recommended workload distribution for airside AV on AGX Orin**:

```
GPU: cuVSLAM, PointPillars/CenterPoint, YOLOv8, nvblox TSDF,
     TensorRT inference for primary detection models
DLA: Bi3D proximity detection, secondary safety-critical DNNs,
     PeopleNet for personnel detection
CPU: ROS 2 orchestration, planning algorithms, control loops,
     CAN bus communication, diagnostics
```

This distribution ensures that safety-critical proximity detection runs on DLA independently of GPU workloads, while maximizing GPU utilization for primary perception tasks.

---

## 7. Practical Phased Migration Strategy

### 7.1 Guiding Principles

1. **Never break the running system**: The vehicle must remain operational throughout migration
2. **Migrate bottom-up**: Start with sensor drivers (leaf nodes), work toward planning/control (integration nodes)
3. **Validate continuously**: Every migrated component must be tested against ROS 1 ground truth
4. **Bridge minimally**: Only bridge the interfaces between migrated and unmigrated components
5. **Containerize everything**: Use Docker for isolation and reproducibility

### 7.2 Phase 0: Foundation (Weeks 1-4)

**Goal**: Establish ROS 2 development environment without touching production code.

| Task | Details |
|------|---------|
| Set up ROS 2 Jazzy workspace | Install on development machines and Jetson Orin devkit |
| Enable Canonical ROS ESM | Secure the existing Noetic fleet during migration |
| Docker infrastructure | Create Dockerfiles for Noetic (Ubuntu 20.04) and Jazzy (Ubuntu 24.04) |
| Build ros1_bridge | Compile bridge with all custom message types |
| CI pipeline | Set up colcon-based CI alongside existing catkin CI |
| Isaac ROS setup | Install Isaac ROS 4.x on Jetson Orin devkit |
| Message definition audit | Identify all custom messages; create ROS 2 equivalents |

**Deliverable**: Development environment where ROS 1 and ROS 2 coexist, bridge operational, team trained on ROS 2 basics.

### 7.3 Phase 1: Sensor Drivers and Data Recording (Weeks 5-10)

**Goal**: Migrate sensor interfaces to ROS 2, establish data pipeline.

**Why sensor drivers first**:
- They are leaf nodes with no downstream ROS dependencies
- Most sensor vendors now provide ROS 2 drivers
- Enables recording ROS 2 rosbags for downstream development
- Bridge output to ROS 1 stack via ros1_bridge

| Component | Migration Approach |
|-----------|--------------------|
| **LiDAR drivers** | Use vendor ROS 2 driver (Ouster, Velodyne, Hesai all have ROS 2 packages) |
| **Camera drivers** | Use Isaac ROS-compatible drivers or vendor packages |
| **GNSS/IMU** | Port or replace with ROS 2 driver packages |
| **CAN bus interface** | Port `socketcan_bridge` to ROS 2 (available as `ros2_socketcan`) |
| **Time synchronization** | Configure `chrony` + ROS 2 `/clock` topic for simulation time |
| **Data recording** | Use `ros2 bag` with MCAP format for efficient recording |

**Validation**:
- Record synchronized ROS 2 rosbags alongside ROS 1 rosbags
- Compare sensor timestamps, message rates, and data integrity
- Bridge ROS 2 sensor topics to ROS 1 stack; verify no functional regression

### 7.4 Phase 2: Perception Pipeline (Weeks 11-20)

**Goal**: Migrate perception to ROS 2 with Isaac ROS acceleration.

This is the highest-value migration phase because it unlocks NVIDIA GPU acceleration through NITROS.

| Component | Isaac ROS Package | Notes |
|-----------|------------------|-------|
| **Point cloud preprocessing** | Custom NITROS node | Filtering, ground removal, ROI extraction |
| **3D object detection** | `isaac_ros_dnn_inference` + custom model | PointPillars or CenterPoint via TensorRT |
| **2D object detection** | `isaac_ros_yolov8` or `isaac_ros_rtdetr` | Camera-based detection for vehicles, personnel, GSE |
| **Freespace segmentation** | `isaac_ros_freespace_segmentation` | Drivable area from stereo cameras |
| **Proximity detection** | `isaac_ros_depth_segmentation` | Bi3D on DLA for safety-critical obstacle detection |
| **3D reconstruction** | `isaac_ros_nvblox` | Dynamic obstacle mapping and costmap generation |
| **Sensor fusion** | Custom composable nodes | Fuse LiDAR detections with camera detections |
| **Object tracking** | Custom or Autoware tracker port | Multi-object tracking across frames |

**Architecture**: Load all perception nodes into a single composable node container with NITROS and intra-process communication enabled. This ensures zero-copy GPU data flow from sensor preprocessing through inference to detection output.

**Bridge interface**: Bridge only the perception outputs (detected objects, occupancy grid, freespace mask) to the ROS 1 planning stack. Do NOT bridge raw sensor data.

**Validation**:
- Replay ROS 2 rosbags through new perception pipeline
- Compare detections against ROS 1 perception output (precision, recall, latency)
- Run A/B testing: same sensor input, compare ROS 1 vs. ROS 2 perception output
- Measure end-to-end perception latency (sensor timestamp to detection output)

### 7.5 Phase 3: Localization (Weeks 15-22, overlaps with Phase 2)

**Goal**: Migrate localization to ROS 2 with cuVSLAM integration.

| Component | Approach |
|-----------|----------|
| **Visual SLAM** | Deploy `isaac_ros_visual_slam` (cuVSLAM) |
| **LiDAR localization** | Port NDT matching or use Autoware's `ndt_scan_matcher` |
| **GNSS fusion** | Port EKF to ROS 2 using `robot_localization` package |
| **Map management** | Use `isaac_mapping_ros` for visual map creation |
| **TF tree** | Migrate transform broadcasters and listeners |

**Pre-mapping workflow**:
1. Drive the vehicle through the entire airside operational area in mapping mode
2. cuVSLAM creates a visual feature map
3. Save and version the map
4. Deploy in localization-only mode for production

**Validation**:
- Compare ROS 2 pose estimates against ROS 1 localization
- Measure drift over long runs (>1 hour continuous operation)
- Test recovery from localization failures (entering/exiting buildings, GPS outages)
- Verify TF tree consistency across the bridge

### 7.6 Phase 4: Planning and Control (Weeks 23-32)

**Goal**: Migrate planning and control to ROS 2, remove ros1_bridge dependency.

This is the most critical phase because planning and control are the most tightly integrated and safety-critical components.

| Component | Approach |
|-----------|----------|
| **Global route planning** | Port to ROS 2 or adopt Autoware's planning modules |
| **Behavior planning** | Port state machines to ROS 2 lifecycle nodes |
| **Motion planning** | Port trajectory optimization to ROS 2 |
| **MPC/PID control** | Port controllers using `ros2_control` framework |
| **Vehicle interface** | Port CAN bus interface (already done in Phase 1) |
| **Safety monitor** | Port watchdog and emergency stop logic |

**ros2_control integration**: ROS 2 provides the `ros2_control` framework, which is significantly more mature than ROS 1's `ros_control`. It provides:
- Hardware abstraction layer for actuators
- Controller manager for real-time control loops
- Lifecycle management for controlled startup/shutdown
- Chainable controllers for cascade control architectures

**Validation**:
- Run full planning/control stack in simulation (Isaac Sim or CARLA with ROS 2 bridge)
- Compare trajectory outputs against ROS 1 reference trajectories
- Test emergency stop response time (must meet safety requirements)
- Closed-loop testing on a controlled section of the airside

### 7.7 Phase 5: Integration and Hardening (Weeks 33-40)

**Goal**: Full ROS 2 stack without bridge, production-ready.

| Task | Details |
|------|---------|
| **Remove ros1_bridge** | All components now native ROS 2 |
| **System integration testing** | Full stack on vehicle hardware |
| **Performance profiling** | NITROS pipeline validation, latency budgets |
| **Fault injection testing** | Sensor failures, compute overload, communication loss |
| **Operational scenario testing** | All airside scenarios (stand approach, taxiway following, obstacle avoidance, emergency stops) |
| **Rosbag regression suite** | Build comprehensive test suite from recorded scenarios |
| **Documentation** | System architecture, deployment procedures, troubleshooting |

### 7.8 Testing Strategy During Migration

**Parallel operation**: During Phases 1-4, run both ROS 1 and ROS 2 components simultaneously. Compare outputs to catch regressions.

**Rosbag replay testing**:

```bash
# Record sensor data in ROS 2 format
ros2 bag record -a --storage mcap -o scenario_001

# Replay through perception pipeline for regression testing
ros2 bag play scenario_001 --clock 100
# In another terminal:
ros2 launch perception_stack perception.launch.py use_sim_time:=true
```

**CI/CD pipeline structure**:

```
1. Build: colcon build --packages-up-to <package>
2. Unit tests: colcon test --packages-select <package>
3. Integration tests: Launch subsystem, replay rosbag, assert outputs
4. Simulation: Isaac Sim scenario tests (SITL)
5. Performance: NITROS benchmark suite
6. Regression: Compare against golden outputs from ROS 1 stack
```

**Simulation environments**:
- **NVIDIA Isaac Sim**: Full physics simulation with ROS 2 native support, sensor models, and airport environment modeling
- **CARLA**: Open-source driving simulator with ROS 2 bridge
- **Gazebo (Harmonic)**: ROS 2-native simulation for component-level testing

**Key metrics to track during migration**:

| Metric | Target | Tool |
|--------|--------|------|
| Perception latency (sensor to detection) | <100 ms | `ros2 topic delay`, NITROS benchmark |
| Localization accuracy | <10 cm CEP | Comparison against RTK-GPS ground truth |
| Control loop rate | >50 Hz | `ros2 topic hz` |
| Emergency stop response | <200 ms | Hardware-in-the-loop test |
| CPU utilization | <70% sustained | `isaac_ros_jetson_stats` |
| GPU utilization | <80% sustained | `nvidia-smi`, `tegrastats` |
| Memory (RAM + GPU) | Headroom for 2x current usage | System monitoring |
| Bridge latency (during hybrid phase) | <10 ms per hop | Timestamped message comparison |

---

## Summary: Migration Timeline

```
Month 1:       Phase 0 — Foundation and environment setup
Months 2-3:    Phase 1 — Sensor drivers and data recording
Months 3-5:    Phase 2 — Perception pipeline (Isaac ROS)
Months 4-6:    Phase 3 — Localization (cuVSLAM) [overlaps Phase 2]
Months 6-8:    Phase 4 — Planning and control
Months 8-10:   Phase 5 — Integration, testing, hardening
```

Total estimated timeline: **8-10 months** for a team of 3-4 engineers working primarily on migration. This assumes an existing AV stack of moderate complexity (~30-50 ROS 1 packages) and access to a test vehicle.

The highest-ROI phase is **Phase 2 (Perception)** because it unlocks NVIDIA Isaac ROS acceleration, which can deliver 3-7x performance improvement over CPU-based ROS 1 perception. This alone may justify the migration effort by enabling new perception capabilities (real-time 3D reconstruction, multi-camera SLAM, DNN-based freespace segmentation) that were not feasible on the ROS 1 stack.

---

## Sources

- [ROS: Upcoming ROS 1 End of Life](https://www.ros.org/blog/noetic-eol/)
- [ROS Noetic End-of-Life: May 31, 2025 -- Open Robotics Discourse](https://discourse.openrobotics.org/t/ros-noetic-end-of-life-may-31-2025/43160)
- [ROS Noetic is EOL -- Canonical/Ubuntu](https://ubuntu.com/blog/ros-noetic-is-eol-take-action-to-maintain-fleet-security)
- [ROS Expanded Security Maintenance](https://ubuntu.com/robotics/ros-esm)
- [Extending ROS Noetic Support with ESM-Enabled Content Snaps](https://ubuntu.com/blog/extending-ros-noetic-support-with-esm-enabled-content-snaps)
- [ROS 2 Distributions and Releases](https://docs.ros.org/en/jazzy/Releases.html)
- [REP 2000 -- ROS 2 Releases and Target Platforms](https://www.ros.org/reps/rep-2000.html)
- [Migrating C++ Packages Reference -- ROS 2 Humble](https://docs.ros.org/en/humble/How-To-Guides/Migrating-from-ROS1/Migrating-CPP-Packages.html)
- [Migrating a C++ Package Example -- ROS 2 Jazzy](https://docs.ros.org/en/jazzy/How-To-Guides/Migrating-from-ROS1/Migrating-CPP-Package-Example.html)
- [Migrating Launch Files from ROS 1 to ROS 2](https://docs.ros.org/en/foxy/How-To-Guides/Launch-files-migration-guide.html)
- [ROS 2 Quality of Service Settings](https://docs.ros.org/en/rolling/Concepts/Intermediate/About-Quality-of-Service-Settings.html)
- [ros2/ros1_bridge -- GitHub](https://github.com/ros2/ros1_bridge)
- [ROS 1 - ROS 2 Bridge -- Robotics Knowledgebase](https://roboticsknowledgebase.com/wiki/interfacing/ros1_ros2_bridge/)
- [ros-humble-ros1-bridge-builder -- GitHub](https://github.com/TommyChangUMD/ros-humble-ros1-bridge-builder)
- [NVIDIA Isaac ROS Developer Page](https://developer.nvidia.com/isaac/ros)
- [NVIDIA Isaac ROS Documentation](https://nvidia-isaac-ros.github.io/)
- [Isaac ROS Repositories and Packages](https://nvidia-isaac-ros.github.io/repositories_and_packages/index.html)
- [Isaac ROS Release Notes](https://nvidia-isaac-ros.github.io/releases/index.html)
- [NITROS -- Isaac ROS](https://nvidia-isaac-ros.github.io/concepts/nitros/index.html)
- [CUDA with NITROS -- Isaac ROS](https://nvidia-isaac-ros.github.io/concepts/nitros/cuda_with_nitros.html)
- [Isaac ROS TensorRT and Triton for DNN Inference](https://nvidia-isaac-ros.github.io/concepts/dnn_inference/tensorrt_and_triton_info.html)
- [Improve Perception Performance with NITROS -- NVIDIA Blog](https://developer.nvidia.com/blog/improve-perception-performance-for-ros-2-applications-with-nvidia-isaac-transport-for-ros/)
- [cuVSLAM -- Isaac ROS](https://nvidia-isaac-ros.github.io/concepts/visual_slam/cuvslam/index.html)
- [Isaac ROS Visual SLAM -- GitHub](https://github.com/NVIDIA-ISAAC-ROS/isaac_ros_visual_slam)
- [Nvblox -- Isaac ROS](https://nvidia-isaac-ros.github.io/concepts/scene_reconstruction/nvblox/index.html)
- [Isaac ROS Freespace Segmentation](https://nvidia-isaac-ros.github.io/repositories_and_packages/isaac_ros_freespace_segmentation/index.html)
- [Isaac ROS Depth Segmentation (Bi3D/Proximity)](https://github.com/NVIDIA-ISAAC-ROS/isaac_ros_proximity_segmentation)
- [Maximizing DL Performance on Jetson Orin with DLA -- NVIDIA Blog](https://developer.nvidia.com/blog/maximizing-deep-learning-performance-on-nvidia-jetson-orin-with-dla/)
- [Autoware -- GitHub](https://github.com/autowarefoundation/autoware)
- [Support ROS 2 Jazzy Jalisco -- Autoware Issue #6695](https://github.com/autowarefoundation/autoware/issues/6695)
- [Autoware Universe Jazzy Support -- Issue #7598](https://github.com/autowarefoundation/autoware_universe/issues/7598)
- [ROS 2-Based Architecture for Autonomous Driving Systems (2025)](https://www.mdpi.com/1424-8220/26/2/463)
- [Performance Evaluation of ROS2-DDS for Cooperative Driving in AV](https://arxiv.org/html/2412.07485v1)
- [ROS 2 Composable Nodes -- Foxglove](https://foxglove.dev/blog/ros-2-composable-nodes)
- [About Composition -- ROS 2 Documentation](https://docs.ros.org/en/foxy/Concepts/About-Composition.html)
- [ros2-launch-file-migrator -- AWS Robotics GitHub](https://github.com/aws-robotics/ros2-launch-file-migrator)
- [CUDA-PointPillars-ROS2 -- GitHub](https://github.com/cdefg/CUDA-PointPillars-ROS2)
- [Jetson AGX Orin -- NVIDIA](https://www.nvidia.com/en-us/autonomous-machines/embedded-systems/jetson-orin/)
