# Natural-Language Cooperative Autonomy

**Last updated:** 2026-05-09

## Why It Matters

Natural language is becoming a candidate side channel for cooperative autonomy because it can compress intent, uncertainty, and local context across heterogeneous agents. LangCoop shows the attraction: language-based packaging can reduce bandwidth sharply compared with image sharing while keeping competitive closed-loop performance in CARLA. V2V-LLM and V2V-GoT show a related research direction: multimodal LLMs can fuse information from multiple connected vehicles and answer cooperative grounding, notable-object, prediction, and planning questions.

This does not mean vehicles should negotiate safety in free-form prose. For deployment, natural language should be a bounded representation layer over structured, authenticated facts: "I am yielding at stand B7 because an aircraft tug is reversing" is useful; "go ahead, looks safe" without source, TTL, geometry, and authority is not.

## Evaluation/Design Pattern

Use natural language as a compact intent summary, not as the safety authority:

```text
local perception + map + task + reservation state
  -> structured facts and confidence
  -> bounded language summary
  -> receiver parses to structured intent/risk proposal
  -> cross-check against V2X state, perception, map, and rules
  -> planner may adjust prediction/costs, never bypass validators
```

Minimum message contract:

| Field | Requirement |
|---|---|
| Source | Vehicle/RSU/operator identity, signature, authority class |
| Time | Timestamp, sequence number, expiry/TTL |
| Frame | Map version, coordinate frame, referenced zone/stand/lane |
| Intent | Yield, proceed, reserve, reverse, stop, clear, reroute, request priority |
| Evidence | Object IDs, hazard IDs, trajectory/reservation IDs, confidence |
| Language | Short human-readable explanation generated from the structured fields |
| Receiver action | Advisory only, constraint proposal, reservation update, or operator display |

Evaluation should compare four baselines:

- Onboard-only planning.
- Structured V2X without language.
- Language-only summaries.
- Structured facts plus bounded language summaries.

Score bandwidth, latency, parse success, contradiction detection, cooperative planning benefit, safety violations, and behavior under missing/misleading messages.

## Airside Transfer

Airside is a strong fit because the actors are known, the network is private, the language is procedural, and the authority hierarchy is explicit. Practical message examples:

| Airside Cooperative Message | Use |
|---|---|
| "Tug T12 reversing with aircraft A320 from stand B7, sweep path reserved until 10:32:15." | Hold and path reservation |
| "Fuel truck F3 stopped at service-road merge, requesting priority due active turnaround task." | Tactical yield decision |
| "Marshaller M2 detected crossing behind belt loader L4, confidence 0.82, occluded from ego." | Occlusion-aware risk forecast |
| "FOD report at grid C4 confirmed by stand camera, lane blocked until cleared." | Reroute and scenario logging |
| "Clearance message expired; default hold at taxiway service crossing." | Authority fallback |

Keep free-form text out of the direct control path. The local vehicle must still obey hard map constraints, hold lines, geofences, aircraft priority, personnel detection, and Simplex safety monitors. Language can improve shared situational awareness and operator readability, but structured state remains the machine contract.

## Acceptance Checks

- Every language message is generated from structured fields and can be parsed back into the same fields.
- Messages include source identity, timestamp, TTL, map/zone reference, confidence, and authority class.
- The receiver rejects stale, unsigned, out-of-zone, contradictory, or unparsable messages.
- Natural-language summaries are advisory unless paired with validated structured reservations or constraints.
- Closed-loop tests include occlusion, packet loss, delayed messages, wrong intent, conflicting agents, and partial participation.
- V2V-LLM/V2V-GoT-style reasoning is evaluated on cooperative perception, prediction, and planning tasks, not only answer fluency.
- LangCoop-style bandwidth savings are reported alongside safety and latency, not as a standalone win.
- Operator-facing text is logged with the structured facts that produced it for incident review.

## Failure Modes

| Failure Mode | Example | Control |
|---|---|---|
| Free-form ambiguity | "I will go after you" has no precise timing or route | Fixed intent schema, TTL, and reservation IDs |
| Hallucinated cooperation | LLM invents a yielding vehicle or clearance | Structured-source grounding and local cross-checks |
| Stale language | Vehicle acts on an old "clear" message | Sequence numbers, TTL, and default-deny expiry |
| Authority confusion | Peer vehicle text conflicts with ramp-control hold | Authority hierarchy and hard-rule validator |
| Bandwidth-only optimization | Messages are short but omit safety-critical uncertainty | Required confidence, evidence, and contradiction fields |
| Parse mismatch | Receiver interprets a summary differently from sender | Round-trip parse tests and canonical templates |
| Overtrust in remote view | Ego ignores unconnected worker not seen by peers | Onboard/infrastructure perception remains authoritative |
| Prompt or injection attack | Malicious text asks vehicle to ignore rules | Signed structured messages and prompt sanitization |

## Related Repository Docs

- [V2X Cooperative Planning](v2x-cooperative-planning.md)
- [V2X Protocols for Airside](v2x-protocols-airside.md)
- [Airside Multi-Agent Coordination](airside-multi-agent.md)
- [Fleet Coordination](fleet-coordination.md)
- [Ramp Traffic Conflict Detection and Deadlock Prevention](ramp-traffic-conflict-deadlock-prevention.md)
- [Infrastructure-Cooperative Perception](../perception/overview/infrastructure-cooperative-perception.md)
- [VLM Scene Understanding](../vla-vlm/vlm-scene-understanding.md)
- [Ground Control Instruction Understanding](../../70-operations-domains/airside/operations/ground-control-instructions.md)
- [Cybersecurity for Airside AV](../../60-safety-validation/cybersecurity/cybersecurity-airside-av.md)

## Sources

- LangCoop: Collaborative Driving with Language: https://arxiv.org/abs/2504.13406
- V2V-LLM: Vehicle-to-Vehicle Cooperative Autonomous Driving with Multimodal Large Language Models: https://arxiv.org/abs/2502.09980
- V2V-LLM project page: https://eddyhkchiu.github.io/v2vllm.github.io/
- V2V-GoT: Vehicle-to-Vehicle Cooperative Autonomous Driving with Multimodal Large Language Models and Graph-of-Thoughts: https://arxiv.org/abs/2509.18053
- V2V-GoT project page: https://eddyhkchiu.github.io/v2vgot.github.io/
