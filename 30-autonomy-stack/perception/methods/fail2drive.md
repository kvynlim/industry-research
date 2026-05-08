# Fail2Drive

## What It Is

Fail2Drive is a closed-loop generalization benchmark for autonomous driving.

It is built in CARLA and focuses on how driving policies fail under shifted scenarios.

The benchmark pairs each out-of-distribution route with an in-distribution counterpart.

This pairing is the key design choice: it isolates the effect of scenario shift from route difficulty.

Fail2Drive is a benchmark and toolbox, not a perception model.

## Core Technical Idea

Fail2Drive evaluates autonomy in closed loop, where perception errors affect control and future observations.

The benchmark asks whether a driving model can handle new scenario attributes after appearing competent on similar in-distribution routes.

Scenario shifts include:

- Appearance shifts.
- Layout shifts.
- Behavioral shifts.
- Robustness shifts.

The paper reports a large average success-rate drop across recent driving models when evaluated on the shifted scenarios.

## Inputs and Outputs

Inputs:

- CARLA routes.
- Scenario definitions.
- Sensor configurations used by evaluated driving models.
- In-distribution and out-of-distribution paired route sets.
- A privileged expert policy for checking route solvability.

Outputs:

- Closed-loop driving rollouts.
- Success or failure outcomes.
- Driving-score style metrics.
- Failure categories by scenario shift.
- Evidence of whether a model generalizes beyond its training distribution.

The benchmark targets driving policies, but perception failure analysis is a major use case.

## Architecture or Benchmark Protocol

Fail2Drive defines 200 routes covering 17 new scenario classes.

Each shifted route is paired with an in-distribution route.

Protocol:

- Run the same autonomous driving model on the paired routes.
- Compare closed-loop outcomes under the controlled shift.
- Use the privileged expert to verify that the shifted route is solvable.
- Attribute model degradation to the scenario shift rather than impossible routes.

The toolbox provides scenario generation assets and evaluation scripts.

## Training and Evaluation

Fail2Drive is primarily an evaluation benchmark.

Models can be trained elsewhere, then run in the benchmark.

Evaluation focuses on:

- Route success rate.
- Driving score or related CARLA metrics.
- Collision and infraction behavior.
- Performance drop from paired in-distribution route to shifted route.
- Qualitative failure modes in perception and control.

The paper reports that seven recent autonomous driving methods show substantial degradation, with an average success-rate drop of 22.8 percentage points.

## Strengths

- Closed-loop evaluation captures compounding perception and planning failures.
- Paired routes make generalization gaps easier to interpret.
- Scenario taxonomy is explicit and extensible.
- Privileged expert policy helps avoid counting unsolvable scenarios as model failures.
- Open toolbox can support custom scenario generation.
- Useful complement to open-loop detection benchmarks.

## Failure Modes

- CARLA appearance and physics do not fully match real sensors.
- Closed-loop failures can be hard to attribute to perception, prediction, planning, or control.
- Scenario classes are road-driving oriented.
- A model may overfit the benchmark if scenarios become widely reused.
- Simulator LiDAR and camera artifacts can differ from airport hardware.
- Metrics may underweight near-miss behavior that matters in safety cases.

## Airside AV Fit

Fail2Drive is valuable as a validation pattern for airside autonomy.

Airport safety depends on closed-loop behavior under rare shifts, not just detector AP.

Airside scenario examples:

- Unexpected cone layout near a stand.
- Belt loader parked outside its usual staging area.
- Worker crossing behind aircraft ground equipment.
- Wet apron glare at night.
- Pushback tractor path differing from the nominal route.
- Temporary closure of a service-road segment.

An airport adaptation should use paired in-distribution and shifted routes in an apron simulator or digital twin.

## Implementation Notes

- Use Fail2Drive as a benchmark structure, not as airport evidence by itself.
- Build paired airside routes where only one factor changes.
- Keep solvability checks using a privileged expert or scripted safe policy.
- Record perception traces so failures can be attributed after closed-loop runs.
- Add airport metrics: stand-boundary violation, worker near-miss, aircraft clearance, speed-limit compliance, and forced-stop correctness.
- Use real sensor noise models before relying on simulator results for safety claims.

## Sources

- arXiv paper: https://arxiv.org/abs/2604.08535
- arXiv PDF: https://arxiv.org/pdf/2604.08535
- Project page: https://fail2drive.github.io/
- Official GitHub: https://github.com/zihengjackchen/iPrism
