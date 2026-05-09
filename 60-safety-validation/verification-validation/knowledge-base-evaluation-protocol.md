# Knowledge Base Evaluation Protocol

**Last updated:** 2026-05-09

Knowledge-base and retrieval-augmented generation systems need validation beyond generic answer quality. For safety, operations, and engineering research use, the system must retrieve the right sources, answer only from supported evidence, preserve uncertainty, and fail safely when the knowledge base lacks an answer.

This protocol is intended for evaluating internal knowledge-base assistants, RAG pipelines, and source-backed research workflows.

---

## Safety Claim

For the validated knowledge domain and document corpus, the knowledge-base system returns answers that are grounded in retrievable authoritative sources, correctly represents uncertainty and temporal scope, cites the evidence used, and refuses or escalates when the corpus does not support an answer.

The claim is bounded by corpus freshness, source authority, retrieval coverage, tool availability, model version, prompts, evaluation set, and task type. It does not claim open-web truth unless web retrieval is explicitly part of the validated system.

---

## Hazards And Failures

| Failure | Cause | Consequence | Required evidence |
|---|---|---|---|
| Unsupported answer | Generator fills gaps without retrieved evidence | Hallucinated operational or engineering guidance | Faithfulness and citation-support evaluation. |
| Wrong source retrieved | Retriever misses authoritative document or ranks stale content higher | Plausible but incorrect answer | Context recall, source authority checks, and retrieval audits. |
| Stale answer | Corpus or index is outdated | Incorrect current policy, standard, product, or procedure | Freshness metadata and temporal test cases. |
| Over-refusal | System says it cannot answer despite sufficient evidence | Lost utility and operator workaround risk | Answerability and missing-answer analysis. |
| Under-refusal | System answers when evidence is absent or contradictory | False confidence | Unanswerable and conflicting-source tests. |
| Citation laundering | Citation is present but does not support the claim | Hard-to-detect hallucination | Claim-to-source entailment checks. |
| Long-tail entity failure | Retriever or generator fails rare entities | Hidden accuracy drop | Popularity and rarity stratification. |
| Multi-hop reasoning failure | Answer requires combining documents or tables | Incomplete or wrong synthesis | Multi-hop evaluation set and step-level trace review. |
| Tool/API mismatch | Search, KG, or document tools return partial data | Incorrect final answer from tool gaps | Tool-call logs and API-contract tests. |

---

## Evidence Required

| Evidence type | Minimum content |
|---|---|
| Corpus manifest | Document IDs, versions, owners, source URLs, ingestion time, effective dates, and authority level. |
| Retrieval test set | Queries with gold documents, acceptable alternate documents, stale distractors, and no-answer cases. |
| Answer test set | Question, reference answer, required citations, unacceptable claims, temporal scope, and grading rubric. |
| Long-tail coverage | Rare entities, old documents, newly updated documents, acronyms, aliases, and domain-specific terminology. |
| Multi-hop cases | Questions requiring cross-document synthesis, table lookup, or policy plus exception logic. |
| Adversarial cases | Ambiguous questions, misleading phrasing, conflicting documents, outdated source traps, and unsupported premise questions. |
| Human review set | Expert-labeled examples for calibration and periodic evaluation of automatic graders. |
| Runtime traces | Query, rewritten query, retrieved chunks, ranks, scores, prompts, model output, citations, tool calls, and refusal path. |

---

## Metrics

| Layer | Metrics |
|---|---|
| Retrieval | Recall@k, precision@k, MRR, nDCG, gold-source coverage, authority-weighted recall, stale-source rate. |
| Context quality | Ragas context precision, context recall, context entities recall, and noise sensitivity. |
| Generation | Faithfulness, answer relevancy, factual correctness, exact match where appropriate, and rubric score. |
| Citation support | Claim-level citation precision/recall, unsupported-claim rate, citation span correctness. |
| Answerability | Correct refusal rate, incorrect refusal rate, missing-answer rate, unsupported-answer rate. |
| Temporal robustness | Current-answer accuracy, stale-answer rate, effective-date handling, time-sensitive query accuracy. |
| CRAG-style QA | Perfect, acceptable, missing, and incorrect response categories; correct/missing/incorrect scoring where applicable. |
| Statistical confidence | Confidence intervals over key metrics, especially when using ARES-style prediction-powered inference. |

Automatic LLM judges are useful but not sufficient. Keep a calibrated human-labeled set and periodically measure judge agreement, drift, and failure modes.

---

## Acceptance Rules

| Rule | Rationale |
|---|---|
| Every factual answer must cite supporting sources. | Enables audit and catches unsupported synthesis. |
| Citations must support the exact claim, not merely the topic. | Prevents citation laundering. |
| No-answer cases are first-class tests. | Refusal behavior is part of safe KB operation. |
| Freshness metadata must be visible to evaluation. | Many KB failures are temporal, not semantic. |
| Retrieval and generation are scored separately. | A good answer can hide bad retrieval, and good retrieval can be ruined by generation. |
| Stale or lower-authority sources cannot override current authoritative sources. | Source governance is part of correctness. |
| Thresholds are domain-specific and versioned. | Legal, safety, engineering, and general research use have different risk tolerance. |
| Any prompt, model, chunking, embedding, reranker, or corpus change triggers regression evaluation. | RAG behavior can change without application code changes. |

For safety-relevant domains, require zero known critical unsupported claims in the locked acceptance set. Non-critical quality thresholds can be statistical, but critical hallucinations require root-cause analysis before release.

---

## Test Matrix

| Dimension | Required slices |
|---|---|
| Query type | Fact lookup, summary, comparison, procedural answer, table extraction, multi-hop synthesis, recommendation with constraints. |
| Answerability | Answerable, partially answerable, unanswerable, ambiguous, contradictory evidence. |
| Source authority | Primary source, official documentation, peer-reviewed paper, internal note, stale document, low-authority source. |
| Temporality | Stable fact, recently changed fact, effective date, superseded standard, future schedule, historical question. |
| Entity popularity | Head, torso, long-tail, aliases/acronyms, renamed entities. |
| Retrieval difficulty | Exact keyword, paraphrase, synonym, table-only answer, image/PDF-derived text, cross-document dependency. |
| Corpus state | Fresh index, stale index, missing document, duplicate document, conflicting versions. |
| Response behavior | Direct answer, cited answer, uncertainty statement, refusal, escalation to human review. |

---

## Traceability

| Artifact | Trace to |
|---|---|
| KB safety claim | Domain scope, corpus manifest, allowed tools, source authority policy, and refusal policy. |
| Requirements | Grounding, citation, freshness, retrieval recall, answer accuracy, refusal, and escalation requirements. |
| Evaluation set | Requirement IDs, source documents, gold answers, no-answer labels, and risk class. |
| Runtime logs | Query ID, retrieved chunks, generated answer, citations, model/prompt/index versions, and grader result. |
| Failures | Root cause category: retrieval miss, chunking issue, stale corpus, source conflict, prompt issue, generator hallucination, grader error. |
| Release decision | Metric summary, critical failures, accepted residual risks, monitoring plan, and rollback criteria. |

Production monitoring should sample real queries into the same taxonomy. Evaluation is not a one-time benchmark; it is a regression system for corpus and model change.

---

## Implementation Notes

1. Build a small expert-labeled acceptance set before relying on synthetic test generation.
2. Use CRAG-style categories for factual QA: perfect, acceptable, missing, and incorrect.
3. Use Ragas-style metrics for context precision, context recall, response relevancy, and faithfulness, but inspect failures manually.
4. Use ARES-style labeled and unlabeled sets when estimating scores with statistical confidence at larger scale.
5. Store claim-level citations, not only answer-level citations.
6. Include negative tests with unsupported premises such as "according to AC X, Y is required" when AC X does not say Y.
7. Keep temporal prompts explicit: the evaluator should know the current date, document effective date, and whether web freshness is allowed.
8. Version every component: corpus, chunker, embeddings, retriever, reranker, prompt, generator, tools, and judge.

---

## Sources

- [CRAG GitHub repository](https://github.com/facebookresearch/CRAG)
- [CRAG arXiv paper](https://arxiv.org/abs/2406.04744)
- [ARES GitHub repository](https://github.com/stanford-futuredata/ARES)
- [ARES documentation site](https://ares-ai.vercel.app/)
- [Ragas documentation v0.3.5](https://docs.ragas.io/en/v0.3.5/)
- [Ragas metrics documentation](https://docs.ragas.io/en/v0.3.5/concepts/metrics/)
