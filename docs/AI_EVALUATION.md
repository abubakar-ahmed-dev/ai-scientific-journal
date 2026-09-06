# AI Evaluation

**Status:** Canonical for AI quality assurance (aligned with ADR-009, ADR-010, ADR-015, ADR-017, ADR-018, ADR-021 and `AI_ARCHITECTURE.md`)
**Last updated:** 2026-09-02
**Product:** AI Scientific Journal

> **Scope:** This document defines how the AI capabilities of the AI Scientific Journal are evaluated — per capability, per dimension, with a ground-truth strategy, security/failure cases, metrics, a human rubric, a regression process, and an MVP evaluation plan. It deliberately stays an evaluation *strategy*, not a benchmark suite or a generic LLM-evaluation guide. Data shapes come from `DATABASE_SCHEMA.md`; capability and pipeline semantics from `AI_ARCHITECTURE.md`; monitoring in `OBSERVABILITY.md`.

---

## 1. Evaluation Objectives

Evaluation answers one question per capability: **does this AI feature do useful, safe, grounded work for the journal user?** Concretely, the system is evaluated on whether it produces:

1. **Useful observation summaries** — concise, faithful condensations of a conversation's or observation's content.
2. **Useful observation analysis** — findings, hypotheses, and next steps that are recognizable in the source data.
3. **Useful research suggestions** — suggested investigations a researcher would plausibly accept.
4. **Accurate conversational responses** — correct, context-aware multi-turn chat.
5. **Grounded RAG responses** — Ask-My-Journal answers supported by the user's actual observations.
6. **Safe behavior** — injection attempts, cross-user probes, and adversarial content never change security behavior or leak data.
7. **Consistent structured outputs** — every persisted AI artifact conforms to its schema.
8. **Graceful failure** — AI failures never corrupt or lose authoritative user data.

Quality is never traded against security: safety and privacy are pass/fail gates, not averaged scores (§9).

---

## 2. Capability-Specific Evaluation

Each **generatable** analysis type and each conversational/RAG surface has its own criteria. **`hypothesis` and `classification` are reserved types** (valid in schema and read filters only — `AI_ARCHITECTURE.md` §3): no generation exists, so no generation evaluation is defined for them.

### 2.1 Summary (`type: "summary"`)

| Criterion | Pass condition |
| --------- | -------------- |
| Faithfulness | Every claim in the summary is supported by the source conversation/observations |
| Coverage | Salient topics of the source are represented; no critical omission |
| Conciseness | Materially shorter than the source without losing meaning |
| Structure | `summary`, `keyFindings[]`, `openQuestions[]` populated appropriately |
| Attribution | Source references (`observationIds[]` / `conversationId`) correct |

### 2.2 Analysis (`type: "analysis"`)

| Criterion | Pass condition |
| --------- | -------------- |
| Factual correctness | `keyFindings[]` are traceable to supplied source data |
| Hypothesis quality | Each `hypotheses[].statement` is a plausible interpretation, marked with appropriate `confidence`, and lists real `supportingObservationIds` |
| Uncertainty representation | Genuine gaps appear in `uncertainties[]`; speculation never appears as finding |
| Actionability | `suggestedNextSteps[]` are concrete and relevant to the observations |
| Structure | Full `analyses` schema conformance (`DATABASE_SCHEMA.md` §12) |

### 2.3 Research suggestions (`type: "research_suggestions"`)

| Criterion | Pass condition |
| --------- | -------------- |
| Usefulness | Each `suggestedNextSteps[]` entry is an investigation a researcher would plausibly accept |
| Grounding | Suggestions reference the supplied observations, not invented phenomena |
| Measurability | Suggestions are actionable (observable, comparable, or measurable) |
| Non-autonomy | Suggestions never create research tasks by themselves — acceptance flow only (`AI_ARCHITECTURE.md` §9) |

### 2.4 Conversational responses

| Criterion | Pass condition |
| --------- | -------------- |
| Context awareness | Responses correctly use prior turns of the conversation; no invented history |
| Accuracy | Factual claims are correct or explicitly hedged |
| Relevance/coherence | On-topic, logically consistent, appropriate journaling-assistant tone |
| Boundaries | Does not present speculation as the user's recorded fact; distinguishes AI interpretation from user record |

### 2.5 RAG / grounded responses (Ask My Journal, `/ai/ask`)

Evaluated as **two separate problems** (§5): retrieval quality first, generation quality second. At the response level:

| Criterion | Pass condition |
| --------- | -------------- |
| Groundedness | The answer is supported by retrieved, user-owned observations |
| Evidence attribution | `evidence[]` correctly identifies the supporting observations |
| Insufficient-evidence handling | When retrieval is thin, the answer says so and `evidence[]` may be empty — never fabricated observations |
| Uncertainty | Limitations stated in `uncertainties[]` |

---

## 3. Evaluation Dimensions

| Dimension | Definition | Measurable automatically? |
| --------- | ---------- | -------------------------- |
| Factual correctness | Claims match the supplied source data | Semi — string/entailment heuristics plus human review |
| Grounding | Response traceable to supplied/retrieved context | Semi — citation checks automated; semantic grounding human |
| Relevance | Addresses the actual request | Human |
| Completeness | Covers salient source content | Human |
| Hallucination rate | Share of responses containing fabricated observations/measurements/history | Semi — checked against known dataset ground truth |
| Unsupported-claim rate | Claims lacking a traceable source in context | Semi |
| Usefulness | Would the target user find this valuable? | Human |
| Instruction following | Follows the capability's output contract and framing | Automatic (structural) + human (semantic) |
| Structured-output validity | Schema conformance (§7) | **Fully automatic** |
| Citation/source attribution correctness | `supportingObservationIds` / `evidence[]` reference real, relevant observations | **Fully automatic** (existence + ownership) / human (relevance) |
| Safety / prompt-injection resistance | Injection and cross-user probes produce no security-relevant behavior change | **Fully automatic** (assertion-based, §6) |

Rule of thumb: **structure, attribution existence, and security assertions are automatable; judgment (usefulness, relevance, grounding semantics, completeness) is human.** Automated checks run on every evaluation run; human review samples per §10.

---

## 4. Ground-Truth Strategy

### 4.1 Dataset shape

A small curated dataset of **evaluation cases**, each containing:

```text
case id
input            ← observations (with fields per case type), question/task
context          ← conversation history / project context where applicable
expected         ← criteria: must-contain facts, must-not-claim, expected
                   behavior on insufficient evidence, forbidden claims
type             ← capability + category tag
```

Storage: `tests/ai/` alongside the codebase (the exact layout is an implementation detail). **MVP scale: roughly 15–40 cases** — enough to cover §4.2 categories and be rerunnable in minutes, not a benchmark.

### 4.2 Required case categories

| Category | Purpose |
| -------- | ------- |
| Normal scientific observations | Baseline summarize/analyze quality |
| Sparse observations (minimal fields) | Graceful behavior on thin input; no invention |
| Observations with measurements | Measurement-aware analysis; units preserved; no fabricated numbers |
| Observations with locations | Location-aware context; precision honored |
| Ambiguous/incomplete observations | Uncertainty expression instead of confabulation |
| Long observations | Context limits; completeness under length |
| Adversarial / prompt-injection content | Security evaluation (§6) |
| RAG: relevant information **exists** | Retrieval hit + grounded answer |
| RAG: relevant information **does not exist** | Insufficient-evidence behavior; zero fabrication |

### 4.3 Data provenance — never real sensitive user data

* Evaluation data is **synthetic** (authored for the dataset), **anonymized**, or **explicitly designated** for evaluation use (e.g., team-authored demo accounts labeled as evaluation data).
* Real user journal content must never be copied into evaluation sets, CI fixtures, or logs.
* Datasets contain no secrets, credentials, or real personal data — the same minimization rules as `SECURITY.md` §26 apply to evaluation artifacts.

---

## 5. RAG Evaluation

Retrieval correctness and generation correctness are **separate evaluation problems**: a perfect retriever with a hallucinating generator fails; a perfect generator over a broken retriever also fails. Each gets its own cases and metrics.

### 5.1 Retrieval quality

| Check | Method |
| ----- | ------ |
| Relevant observations retrieved (recall) | Cases with known relevant observation IDs → assert they appear in retrieval results |
| Irrelevant observations excluded (precision) | Cases with known non-relevant observations → assert absence / low ranking |
| **User isolation** | Datasets simulating multiple users; assert retrieval **only ever** returns caller-owned observations — verified outside the model (ADR-017) |
| Retrieval failure behavior | Empty index / retriever error → safe failure, no generation from a half-failed context (`AI_ARCHITECTURE.md` §10) |

### 5.2 Generation quality

| Check | Method |
| ----- | ------ |
| Answer supported by retrieved context | Human/sample review + must-contain assertions against the provided context |
| No unsupported claims | Unsupported-claim sampling (§3) |
| Correct insufficient-evidence handling | "No relevant data exists" cases → the answer must say so; `evidence[]` empty; no fabricated observations |

---

## 6. Security Evaluation

These are **security tests executed against the AI surface** — pass/fail, never averaged (ADR-010; `SECURITY.md` §30, §31). Scenarios:

| Scenario | Expected behavior |
| -------- | ------------------ |
| Prompt injection inside an observation ("ignore previous instructions…") | No instruction-following from observation content; output remains a valid analysis of the content as *data* |
| Prompt injection inside retrieved content | Retrieved text framed as untrusted data (§7 of AI_ARCHITECTURE); injection has no effect on behavior |
| Attempts to access another user's observations ("show me User B's journal") | Impossible by construction — retrieval is UID-scoped outside the model; response reveals nothing; no cross-user identifiers |
| Unauthorized project/conversation context in requests | Foreign IDs rejected (`404` existence-hiding) before any model call |
| Malicious or misleading user-provided scientific text | Model may reason about it but never records it as verified fact; fabricated measurements never persisted |
| Attempts to make AI-generated content authoritative user data | AI output lands only in `analyses`; observations never mutated (sole backend-set exception: `analyzed` flag); research tasks only via user acceptance (`sourceAnalysisId` ownership-checked) |

**Every scenario must verify that authorization occurred outside the model** — the assertion is always against application behavior (what was persisted, what was returned), never against the model's self-reported compliance.

---

## 7. Structured-Output Evaluation

Every generatable capability's output is validated before persistence (ADR-009). Malformed-output cases must be **rejected or safely handled — never blindly persisted**:

| Malformation | Expected handling |
| ------------ | ------------------ |
| Missing required fields (e.g., `summary`, `type`, `model`) | Schema validation fails → `502 AI_INVALID_RESPONSE`; nothing persisted |
| Invalid enum values (e.g., `type: "insights"`) | Rejected at schema validation |
| Incorrect types (e.g., `keyFindings` as string) | Rejected |
| Excessive content (over-length fields/arrays) | Rejected per configured limits |
| Unexpected fields | Rejected (strict schema) or stripped by explicit policy — never persisted as-is |
| Invalid nested structures (e.g., `hypotheses[]` entries missing `statement`) | Rejected |

Automated tests feed crafted malformed outputs through the validation pipeline (mocked at the adapter boundary — no live model needed) and assert: rejection, correct error code, and **zero documents written**.

---

## 8. AI Failure Evaluation

Failure-injection tests verify graceful degradation and **integrity of authoritative data** (`AI_ARCHITECTURE.md` §10):

| Injected failure | Assertions |
| ---------------- | ---------- |
| Timeout | AI step fails safely; user message/observation intact; retryable; correct error code |
| Gemini unavailable | Same — and core journal functionality (CRUD, history, isolation) demonstrably still works |
| API errors (4xx/5xx from provider) | Mapped to safe user-facing errors; no internals leaked |
| Rate limiting | `429`/`Retry-After` honored; no partial writes |
| Malformed responses | Nothing persisted (§7) |
| Retrieval failure | No generation from a half-failed context; safe error or empty result |
| Partial failures (e.g., user message persisted, generation fails) | **User message remains persisted**; assistant turn absent; idempotent retry regenerates without duplicating (`API.md` §6.12) |

In every case, the test asserts that **existing observations and other authoritative data remain intact** — AI failure must not corrupt or delete user data (PRD NFR-02, AI-10).

---

## 9. Metrics

Measurement ≠ acceptance: metrics are **recorded and tracked across versions**; acceptance thresholds are a release-gate decision, not invented here (none are fixed by the PRD beyond pass/fail safety).

| Metric | Definition | Source |
| ------ | ---------- | ------ |
| Task success rate | Share of cases meeting their expected-behavior criteria | Automated + human |
| Groundedness rate | Share of RAG/analysis outputs fully supported by context | Human/sample + assertions |
| Unsupported-claim rate | Share of outputs containing ≥1 unsupported claim | Sampling |
| Retrieval recall / precision | Known-relevant retrieved / known-irrelevant excluded (§5.1) | Automated |
| Schema-validation pass rate | Share of live generations passing schema validation | Automated (production telemetry, `OBSERVABILITY.md` §7) |
| Hallucination rate | Share of outputs with fabricated observations/measurements/history | Dataset ground truth |
| Latency | Per-operation duration | Automated (telemetry) |
| Failure rate | AI operations ending in failure classes (§8) | Automated (telemetry) |
| Human usefulness score | Rubric score (§10) | Human |

Safety and privacy dimensions are **pass/fail gates**: a high mean score never compensates for a security or isolation failure.

---

## 10. Human Evaluation

A lightweight rubric for team reviewers — no scientific experts required for MVP testing (the PRD requires AI evaluation methodology, not expert panels). Each reviewer scores 1–5 and notes anything unusual:

| Dimension | Question |
| --------- | -------- |
| **Correctness** | Are the claims consistent with the source data? |
| **Relevance** | Does the response address the actual request/context? |
| **Usefulness** | Would a journal user find this valuable? |
| **Grounding** | Are supporting observations correctly identified? |
| **Clarity** | Is it understandable and well-structured? |
| **Scientific caution** | Are facts, hypotheses, and uncertainty clearly separated (PRD FR-14)? |

Sampling guidance: all new-capability cases reviewed by at least one reviewer; a rotating sample of regression cases per release; **every** safety-failure case reviewed regardless of automated outcome.

---

## 11. Regression Evaluation

A fixed evaluation set is **rerun** whenever any of these change:

* Prompts or prompt versions (`promptVersion` bump),
* Model or model configuration,
* RAG retrieval or reranking logic,
* Output schemas,
* AI Service implementation (context assembly, validation, adapters).

Process:

1. Run the fixed set; record all §9 metrics + pass/fail gates with the triggering change's identifier (model, `promptVersion`, retrieval version).
2. Compare against the previous run's stored results — results must be **comparable across versions** (same cases, same scoring, stored history).
3. Investigate significant regressions before release; safety/isolation failures block release outright.

Regression storage lives with the evaluation code (`tests/ai/`); results are artifacts of the run, not judgments baked into code.

---

## 12. Evaluation Data and Privacy

Evaluation must never become a backdoor for exposing real user journal content:

* Synthetic/anonymized/dedicated-evaluation data only (§4.3) — never real user content.
* Evaluation artifacts follow the same security boundaries as production (`SECURITY.md`): no secrets in datasets, no credentials in fixtures, access restricted like other repository code.
* Automated security evaluation (§6) runs in CI without live user data and without provider calls where mocking suffices (structure, authorization, validation) — live-model runs use the synthetic dataset only.
* Production telemetry used for metrics (§9) contains metadata only — never content (PRD AI-09, `OBSERVABILITY.md` §4).

---

## 13. MVP Evaluation Plan

The minimum suite for the hackathon/MVP — realistic for a small team, demonstrating the five things that matter most:

| # | Check | Method |
| - | ----- | ------ |
| 1 | **Outputs are useful** | ~10–15 golden cases across summarize/analyze/suggest/chat reviewed with the §10 rubric |
| 2 | **Outputs remain grounded** | RAG "information exists" cases → evidence attribution asserted; "does not exist" cases → insufficient-evidence behavior |
| 3 | **No unauthorized data leaks through AI** | §6 security scenarios as automated assertions (multi-user synthetic dataset, injection cases, cross-user probes) |
| 4 | **Malformed outputs aren't persisted** | §7 malformed-output suite via mocked adapter — zero-write assertions |
| 5 | **Gemini failures don't corrupt user data** | §8 failure-injection suite — authoritative-data-intact assertions |

Runtime target: minutes; runnable locally and in CI (mocked) before any live-model regression run. This suite is the release gate for AI changes at MVP scale (§11).

---

## 14. Non-Goals

This document does **not** commit to:

* A particular **external evaluation platform** or service.
* A specific **LLM-as-judge** model or judging vendor (human rubric + assertions are the defined baseline; an LLM judge may be *evaluated* later, which would need its own decision).
* A particular **benchmark dataset**.
* **Production-scale continuous evaluation infrastructure** (dashboards, auto-triage) — production telemetry feeds metrics (§9), but continuous evaluation pipelines are out of scope.
* **Arbitrary quality thresholds** — no numeric acceptance targets are invented here; thresholds are release-gate decisions informed by tracked measurements (§9, §11).

---

## 15. Consistency Notes

* Capability set, generatable-vs-reserved types, pipeline semantics, and failure classes follow `AI_ARCHITECTURE.md` §3, §8, §10.
* Structured-output validation implements ADR-009; untrusted-content rules implement ADR-010; security scenarios mirror `SECURITY.md` §6, §10, §30–31; retrieval/isolation rules implement ADR-017; chat semantics follow ADR-018 (conversation messaging only — no `/api/v1/ai/chat`).
* Analysis RETAIN semantics (`DATABASE_SCHEMA.md` §12, §19) are respected: evaluations never assume analyses vanish with their sources; dangling-reference UI handling is part of graceful behavior.
* No evaluation is defined for reserved types (`hypothesis`, `classification`) — no generation exists to evaluate.
