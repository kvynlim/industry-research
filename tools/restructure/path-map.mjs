import path from 'node:path'

export const CONTENT_ROOTS = [
  'companies',
  'cross-cutting',
  'foundations',
  'hardware',
  'operations',
  'synthesis',
  'technology'
]

export const TARGET_ROOTS = [
  '00-start-here',
  '10-knowledge-base',
  '20-av-platform',
  '30-autonomy-stack',
  '40-runtime-systems',
  '50-cloud-fleet',
  '60-safety-validation',
  '70-operations-domains',
  '80-industry-intel',
  '90-synthesis'
]

const EXACT_MOVES = new Map([
  ['foundations/architecture-innovations.md', '10-knowledge-base/systems-engineering/architecture-innovations.md'],
  ['foundations/diffusion-models.md', '10-knowledge-base/machine-learning/diffusion-models.md'],
  ['foundations/frenet-trajectory-math.md', '10-knowledge-base/controls/frenet-trajectory-math.md'],
  ['foundations/gtsam-factor-graphs.md', '10-knowledge-base/state-estimation/gtsam-factor-graphs.md'],
  ['foundations/lanelet2-maps.md', '10-knowledge-base/robotics/lanelet2-maps.md'],
  ['foundations/mamba-ssm-for-driving.md', '10-knowledge-base/machine-learning/mamba-ssm-for-driving.md'],
  ['foundations/pointpillars.md', '10-knowledge-base/geometry-3d/pointpillars.md'],
  ['foundations/rtk-gps-imu-localization.md', '10-knowledge-base/state-estimation/rtk-gps-imu-localization.md'],
  ['foundations/sparse-attention-3d-perception.md', '10-knowledge-base/machine-learning/sparse-attention-3d-perception.md'],
  ['foundations/theoretical-foundations.md', '10-knowledge-base/systems-engineering/theoretical-foundations.md'],
  ['foundations/transformer-world-models.md', '10-knowledge-base/machine-learning/transformer-world-models.md'],
  ['foundations/vqvae-tokenization.md', '10-knowledge-base/machine-learning/vqvae-tokenization.md'],

  ['cross-cutting/3d-annotation-tools.md', '50-cloud-fleet/data-platform/3d-annotation-tools.md'],
  ['cross-cutting/autoware-universe-deep-dive.md', '40-runtime-systems/ros-autoware/autoware-universe-deep-dive.md'],
  ['cross-cutting/calibration-tracking.md', '20-av-platform/sensors/calibration-tracking.md'],
  ['cross-cutting/cloud-backend-infrastructure.md', '50-cloud-fleet/data-platform/cloud-backend-infrastructure.md'],
  ['cross-cutting/continual-learning.md', '50-cloud-fleet/mlops/continual-learning.md'],
  ['cross-cutting/data-engine-from-bags.md', '50-cloud-fleet/data-platform/data-engine-from-bags.md'],
  ['cross-cutting/data-engines-datasets.md', '50-cloud-fleet/data-platform/data-engines-datasets.md'],
  ['cross-cutting/data-flywheel-airside.md', '50-cloud-fleet/mlops/data-flywheel-airside.md'],
  ['cross-cutting/embodied-ai-crossover.md', '10-knowledge-base/robotics/embodied-ai-crossover.md'],
  ['cross-cutting/evaluation-benchmarks.md', '60-safety-validation/verification-validation/evaluation-benchmarks.md'],
  ['cross-cutting/federated-learning-fleet.md', '50-cloud-fleet/mlops/federated-learning-fleet.md'],
  ['cross-cutting/fleet-data-pipeline.md', '50-cloud-fleet/data-platform/fleet-data-pipeline.md'],
  ['cross-cutting/formal-methods-regulatory.md', '60-safety-validation/standards-certification/formal-methods-regulatory.md'],
  ['cross-cutting/fusion-geometric.md', '30-autonomy-stack/perception/overview/fusion-geometric.md'],
  ['cross-cutting/ground-safety.md', '60-safety-validation/safety-case/ground-safety.md'],
  ['cross-cutting/isaac-ros-for-airside.md', '40-runtime-systems/ros-autoware/isaac-ros-for-airside.md'],
  ['cross-cutting/lidar-data-augmentation.md', '50-cloud-fleet/mlops/lidar-data-augmentation.md'],
  ['cross-cutting/nuscenes-waymo-practical-guide.md', '30-autonomy-stack/perception/datasets-benchmarks/nuscenes-waymo-practical-guide.md'],
  ['cross-cutting/on-vehicle-data-triage-selective-upload.md', '40-runtime-systems/data-logging/on-vehicle-data-triage-selective-upload.md'],
  ['cross-cutting/opensource-ecosystem.md', '40-runtime-systems/ml-deployment/opensource-ecosystem.md'],
  ['cross-cutting/radar-lidar-fusion-adverse-weather.md', '30-autonomy-stack/perception/overview/radar-lidar-fusion-adverse-weather.md'],
  ['cross-cutting/ros2-migration.md', '40-runtime-systems/ros-autoware/ros2-migration.md'],
  ['cross-cutting/sensor-fusion-architectures.md', '30-autonomy-stack/perception/overview/sensor-fusion-architectures.md'],
  ['cross-cutting/signal-processing-weather.md', '10-knowledge-base/systems-engineering/signal-processing-weather.md'],
  ['cross-cutting/synthetic-data-generation.md', '50-cloud-fleet/data-platform/synthetic-data-generation.md'],
  ['cross-cutting/transfer-learning.md', '50-cloud-fleet/mlops/transfer-learning.md'],

  ['operations/deployment/av-cicd-devops-pipeline.md', '40-runtime-systems/ml-deployment/av-cicd-devops-pipeline.md'],
  ['operations/deployment/deployment-playbook.md', '70-operations-domains/deployment-playbooks/deployment-playbook.md'],
  ['operations/deployment/ev-fleet-energy-co-optimization.md', '50-cloud-fleet/fleet-management/ev-fleet-energy-co-optimization.md'],
  ['operations/deployment/fleet-anomaly-root-cause-attribution.md', '50-cloud-fleet/observability/fleet-anomaly-root-cause-attribution.md'],
  ['operations/deployment/fleet-management-dispatch.md', '50-cloud-fleet/fleet-management/fleet-management-dispatch.md'],
  ['operations/deployment/fleet-predictive-maintenance.md', '50-cloud-fleet/fleet-management/fleet-predictive-maintenance.md'],
  ['operations/deployment/fleet-tco-business-case.md', '70-operations-domains/airside/business-case/fleet-tco-business-case.md'],
  ['operations/deployment/hmi-operator-interface.md', '40-runtime-systems/monitoring-observability/hmi-operator-interface.md'],
  ['operations/deployment/multi-airport-adaptation.md', '70-operations-domains/deployment-playbooks/multi-airport-adaptation.md'],
  ['operations/deployment/ota-fleet-management.md', '50-cloud-fleet/ota/ota-fleet-management.md'],
  ['operations/deployment/production-ml-deployment.md', '40-runtime-systems/ml-deployment/production-ml-deployment.md'],
  ['operations/deployment/shadow-mode.md', '60-safety-validation/verification-validation/shadow-mode.md'],
  ['operations/deployment/workforce-transition.md', '70-operations-domains/deployment-playbooks/workforce-transition.md'],

  ['operations/safety/airside-scenario-taxonomy.md', '60-safety-validation/verification-validation/airside-scenario-taxonomy.md'],
  ['operations/safety/certification-guide.md', '60-safety-validation/standards-certification/certification-guide.md'],
  ['operations/safety/cybersecurity-airside-av.md', '60-safety-validation/cybersecurity/cybersecurity-airside-av.md'],
  ['operations/safety/fail-operational-architecture.md', '60-safety-validation/runtime-assurance/fail-operational-architecture.md'],
  ['operations/safety/failure-modes-analysis.md', '60-safety-validation/safety-case/failure-modes-analysis.md'],
  ['operations/safety/formal-verification-neural-networks.md', '60-safety-validation/verification-validation/formal-verification-neural-networks.md'],
  ['operations/safety/functional-safety-software.md', '60-safety-validation/standards-certification/functional-safety-software.md'],
  ['operations/safety/ground-crew-pedestrian-safety.md', '70-operations-domains/airside/safety/ground-crew-pedestrian-safety.md'],
  ['operations/safety/insurance-liability-airside.md', '80-industry-intel/regulations/insurance-liability-airside.md'],
  ['operations/safety/iso-3691-4-deep-dive.md', '60-safety-validation/standards-certification/iso-3691-4-deep-dive.md'],
  ['operations/safety/online-perception-monitoring-odd-enforcement.md', '60-safety-validation/runtime-assurance/online-perception-monitoring-odd-enforcement.md'],
  ['operations/safety/regulatory-trajectory-deep-dive.md', '80-industry-intel/regulations/regulatory-trajectory-deep-dive.md'],
  ['operations/safety/runtime-verification-monitoring.md', '60-safety-validation/runtime-assurance/runtime-verification-monitoring.md'],
  ['operations/safety/safety-incidents-lessons.md', '60-safety-validation/safety-case/safety-incidents-lessons.md'],
  ['operations/safety/safety-verification-certification.md', '60-safety-validation/standards-certification/safety-verification-certification.md'],
  ['operations/safety/simplex-safety-architecture.md', '60-safety-validation/runtime-assurance/simplex-safety-architecture.md'],
  ['operations/safety/testing-validation-methodology.md', '60-safety-validation/verification-validation/testing-validation-methodology.md'],
  ['operations/safety/weather-adaptive-odd-management.md', '60-safety-validation/runtime-assurance/weather-adaptive-odd-management.md'],
  ['operations/teleoperation/teleoperation-systems.md', '40-runtime-systems/monitoring-observability/teleoperation-systems.md'],

  ['technology/localization/hd-map-change-detection-maintenance.md', '30-autonomy-stack/localization-mapping/maps/hd-map-change-detection-maintenance.md'],
  ['technology/localization/hd-map-standards-airside.md', '30-autonomy-stack/localization-mapping/maps/hd-map-standards-airside.md'],
  ['technology/localization/lidar-place-recognition-relocalization.md', '30-autonomy-stack/localization-mapping/overview/lidar-place-recognition-relocalization.md'],
  ['technology/localization/lidar-slam-algorithms.md', '30-autonomy-stack/localization-mapping/overview/lidar-slam-algorithms.md'],
  ['technology/localization/map-construction-pipeline.md', '30-autonomy-stack/localization-mapping/maps/map-construction-pipeline.md'],
  ['technology/localization/map-free-driving.md', '30-autonomy-stack/localization-mapping/maps/map-free-driving.md'],
  ['technology/localization/map-tile-versioning-distribution.md', '30-autonomy-stack/localization-mapping/maps/map-tile-versioning-distribution.md'],
  ['technology/localization/mapping-and-localization.md', '30-autonomy-stack/localization-mapping/overview/mapping-and-localization.md'],
  ['technology/localization/neural-online-mapping-sota.md', '30-autonomy-stack/localization-mapping/maps/neural-online-mapping-sota.md'],
  ['technology/localization/production-lidar-map-localization.md', '30-autonomy-stack/localization-mapping/overview/production-lidar-map-localization.md'],
  ['technology/localization/realtime-occupancy-grid-mapping.md', '30-autonomy-stack/localization-mapping/maps/realtime-occupancy-grid-mapping.md'],
  ['technology/localization/robust-state-estimation-multi-sensor.md', '30-autonomy-stack/localization-mapping/overview/robust-state-estimation-multi-sensor.md'],
  ['technology/localization/semantic-mapping-learned-priors.md', '30-autonomy-stack/localization-mapping/maps/semantic-mapping-learned-priors.md'],

  ['technology/robustness/adverse-conditions.md', '60-safety-validation/verification-validation/robustness/adverse-conditions.md'],
  ['technology/robustness/airside-adverse-conditions.md', '60-safety-validation/verification-validation/robustness/airside-adverse-conditions.md'],
  ['technology/robustness/test-time-adaptation-airside.md', '30-autonomy-stack/perception/overview/test-time-adaptation-airside.md'],
  ['technology/robustness/test-time-training-airport-onboarding.md', '30-autonomy-stack/perception/overview/test-time-training-airport-onboarding.md'],

  ['synthesis/master-synthesis.md', '90-synthesis/master/master-synthesis.md'],
  ['synthesis/getting-started.md', '90-synthesis/master/getting-started.md'],
  ['synthesis/design-spec.md', '90-synthesis/decisions/design-spec.md'],
  ['synthesis/decision-framework.md', '90-synthesis/decisions/decision-framework.md'],
  ['synthesis/poc-proposals.md', '90-synthesis/poc-roadmaps/poc-proposals.md'],
  ['synthesis/technology-readiness.md', '90-synthesis/readiness-risk/technology-readiness.md'],
  ['synthesis/risk-register.md', '90-synthesis/readiness-risk/risk-register.md'],
  ['synthesis/competitive-landscape.md', '80-industry-intel/market-competitive/competitive-landscape.md']
])

const PREFIX_MOVES = [
  ['companies/', '80-industry-intel/companies/'],
  ['hardware/compute/', '20-av-platform/compute/'],
  ['hardware/connectivity/', '20-av-platform/networking-connectivity/'],
  ['hardware/sensors/', '20-av-platform/sensors/'],
  ['hardware/vehicle/', '20-av-platform/drive-by-wire/'],
  ['technology/perception/methods/', '30-autonomy-stack/perception/methods/'],
  ['technology/perception/', '30-autonomy-stack/perception/overview/'],
  ['technology/localization/slam/', '30-autonomy-stack/localization-mapping/slam-methods/'],
  ['technology/planning/', '30-autonomy-stack/planning/'],
  ['technology/world-models/', '30-autonomy-stack/world-models/'],
  ['technology/vla/', '30-autonomy-stack/vla-vlm/'],
  ['technology/multi-agent/', '30-autonomy-stack/multi-agent-v2x/'],
  ['technology/simulation/', '30-autonomy-stack/simulation/'],
  ['technology/e2e-driving/', '30-autonomy-stack/end-to-end-driving/'],
  ['operations/airside/', '70-operations-domains/airside/operations/']
]

export function normalizeRelPath(relPath) {
  let normalized = String(relPath).replaceAll(path.win32.sep, path.posix.sep)
  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2)
  }
  return normalized
}

export function shouldMove(relPath) {
  const normalized = normalizeRelPath(relPath)
  if (!normalized.toLowerCase().endsWith('.md')) {
    return false
  }
  const root = normalized.split('/')[0]
  return CONTENT_ROOTS.includes(root)
}

export function targetPathFor(relPath) {
  const normalized = normalizeRelPath(relPath)
  const exactTarget = EXACT_MOVES.get(normalized)
  if (exactTarget) {
    return exactTarget
  }

  for (const [oldPrefix, newPrefix] of PREFIX_MOVES) {
    if (normalized.startsWith(oldPrefix)) {
      return `${newPrefix}${normalized.slice(oldPrefix.length)}`
    }
  }

  if (shouldMove(normalized)) {
    throw new Error(`No restructure target for ${normalized}`)
  }

  return normalized
}

export function buildMoveMap(relPaths) {
  const moveMap = new Map()
  for (const relPath of relPaths) {
    const normalized = normalizeRelPath(relPath)
    if (shouldMove(normalized)) {
      moveMap.set(normalized, targetPathFor(normalized))
    }
  }
  return moveMap
}
