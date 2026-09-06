# Observability

**Status:** Canonical for observability (aligned with ADR-008, ADR-011, ADR-013 – ADR-018, ADR-021 and the canonical `API.md`, `SECURITY.md`, `AI_ARCHITECTURE.md`, `TESTING.md`)
**Last updated:** 2026-09-02
**Product:** AI Scientific Journal

> **Scope:** What the application exposes to operations — logs, metrics, health, alerts, and troubleshooting flow — using the Google Cloud observability already committed by the architecture (**Cloud Logging + Cloud Monitoring** on Cloud Run). This document commits to **no** additional observability platforms, agents, metric backends, or tracing infrastructure; where a mechanism is an implementation choice, it says so. AI *quality* evaluation methodology lives in `AI_EVALUATION.md`; test strategy in `TESTING.md`.

---

## 1. Purpose and Questions

Observability exists to answer four questions:

1. **Is the application available?** (Cloud Run serving; health check passing)
2. **Is it performing acceptably?** (latency and error rates within observed baselines)
3. **Are dependencies healthy?** (Gemini, Firestore, Cloud Storage, Firebase Auth)
4. **Is anything security-relevant happening?** (auth failures, authorization denials, rate-limit hits)

Primary signals: **structured logs** and **metrics**. Distributed tracing is not committed — Cloud Run request logs provide per-request latency and correlation via request IDs (§3), which is sufficient at this scale.

---

## 2. Platform

| Concern | Mechanism | Notes |
| ------- | --------- | ----- |
| Log collection | **Cloud Logging** | Structured JSON logs written by the app on Cloud Run are ingested natively |
| Metrics & dashboards | **Cloud Monitoring** | Cloud Run's built-in request/latency/instance metrics + application error-rate metrics from logs |
| Health probing | `GET /api/health` | Unauthenticated liveness (§6) |

Cloud Run also provides platform metrics without application work: request count, latency percentiles, instance count, CPU/memory, container startup failures. The application's own responsibility is the **structured application log** and the **error/failure signals embedded in it** (§3–§8); custom metric pipelines are not part of this architecture.

---

## 3. Structured Application Logging

The backend emits **structured JSON logs** (Pino, per the committed stack — TA §5.2) suitable for Cloud Logging. Log levels:

| Level | Usage |
| ----- | ----- |
| `DEBUG` | Local development only; suppressed in production |
| `INFO` | Normal operations (request completed, AI operation succeeded) |
| `WARN` | Recoverable/suspicious conditions (retry happened, validation rejection spikes, upstream rate limit) |
| `ERROR` | Failed operations needing investigation |

### Request log shape (every API request)

```json
{
  "severity": "INFO",
  "message": "request completed",
  "requestId": "req_...",
  "userId": "<authenticated-uid>",
  "route": "/api/v1/observations/:observationId",
  "method": "POST",
  "statusCode": 201,
  "durationMs": 42
}
```

### Request IDs / correlation

* Every request receives a `requestId` — taken from the client's `X-Request-Id` header if provided, generated otherwise (`API.md` §1.3).
* The same `requestId` appears in every log line produced while handling the request, including AI operations and error records — a failed request can be traced across application, Firestore, and Gemini stages **without logging any content**.

### Error logging

* Errors are logged with the error **class/code** (the `API.md` §3 registry), stack trace, `requestId`, and route — enough to diagnose server-side without exposing anything client-side (`SECURITY.md` §22).
* Provider/Firestore errors are logged as **mapped classifications** (`GEMINI_TIMEOUT`, `FIRESTORE_ERROR`, …), never as raw dumps into user-facing responses.

---

## 4. What Must Never Be Logged

Per `SECURITY.md` §26 and PRD AI-09 — the privacy rule is absolute:

* Gemini API keys, Firebase credentials, service-account keys, any secrets
* Authorization/token values or full headers
* Passwords or credentials of any kind
* **Private journal content** — observation text, message content, analysis content
* Full AI prompts or full model responses
* Precise location coordinates (unnecessary contexts)
* Storage paths of user media

Instead of content, log **metadata**: lengths (`inputLength`, `outputLength`), identifiers (`requestId`, `userId`, resource IDs), durations, error codes. Rule of thumb: *observe the system, not the user's journal.*

---

## 5. Application Signals

| Signal | Source | Notes |
| ------ | ------ | ----- |
| Request count / rate | Cloud Monitoring (Cloud Run built-in) | Per route via request logs |
| Latency (p50/p95/p99) | Cloud Run built-in latency metrics | Baselines observed after deployment; no invented SLO numbers (§13) |
| HTTP 4xx/5xx rates | Built-in + request logs | 5xx spikes = availability alert input |
| Validation rejection rate | Request logs (`VALIDATION_ERROR`) | Spike may indicate abuse or a broken client |
| Auth failure count | Auth middleware logs (`UNAUTHENTICATED`) | Security signal (§9) |
| Authorization denial count | Request logs (`NOT_FOUND` on owned-resource routes) | Security signal |
| Rate-limit events | Rate-limiter logs (`RATE_LIMIT_EXCEEDED`) | Cost/abuse signal (ADR-008) |

---

## 6. Health Checks

```text
GET /api/health   →  200 {"status":"ok"}
```

* **Liveness only** — intentionally unversioned and unauthenticated (`API.md` §6.1, ADR-018).
* Returns no configuration, dependency status, or infrastructure detail.
* Deep dependency checks are *not* part of the health endpoint; dependency health is observed through the operational signals in §5, §7, §8. If a synthetic availability probe is ever needed, it is an addition with its own decision — not assumed here.

---

## 7. Dependency Signals

Firestore, Cloud Storage, and Firebase Auth are managed services; Google provides their platform health. The application's contribution is **failure classification** in its own logs:

| Dependency | Application-side signals |
| ---------- | ------------------------ |
| **Firestore** | Operation failures/timeouts mapped to `FIRESTORE_ERROR`; latency visible via request-log `durationMs` on data-heavy routes; permission failures (would indicate a rules/config problem) as distinct error entries |
| **Cloud Storage** | Upload/download failures mapped to storage errors; orphan-cleanup warnings on partial upload failures |
| **Firebase Auth** | Token verification failures (`UNAUTHENTICATED`), expired vs malformed token distinction (log classification only — same `401` to clients) |
| **Gemini** | Dedicated AI signals below (§8) |

---

## 8. AI-Specific Operational Signals

Per AI operation passing through the AI Service (`AI_ARCHITECTURE.md` §12 — this section is the operational view of those hooks):

```text
operationType        ← summarize | analyze | suggest-research | ask | search | chat-turn
requestId            ← correlation with the API request
userId               ← authenticated UID
model                ← model identifier from configuration
durationMs           ← AI operation latency
status               ← success | failure class
errorType            ← GEMINI_TIMEOUT | GEMINI_RATE_LIMIT | GEMINI_UNAVAILABLE |
                       GEMINI_INVALID_RESPONSE | RETRIEVAL_ERROR
inputLength/outputLength /contextLength
tokenUsage           ← where the API provides usage metadata (input/output tokens)
promptVersion        ← generation operations (provenance)
retrieval metadata   ← candidate count, selected context size (ask/search)
```

Operational uses:

* **AI failure rate and latency** are first-class metrics — Gemini is the most fragile dependency and the largest variable cost (ADR-008); failure classes feed troubleshooting (§12) and cost visibility.
* **Schema-validation failure count** (`GEMINI_INVALID_RESPONSE`) tracks output-quality drift operationally; *scoring that quality* is `AI_EVALUATION.md`'s job — this layer only counts and correlates.
* **Retrieval failure/empty-result counts** distinguish retrieval problems from generation problems in incidents.

No per-operation tracing spans, custom metric exports, or LLM-judge pipelines are committed here.

---

## 9. Security / Audit Signals

Lightweight, log-derived security observability (no SIEM is committed):

* Repeated authentication failures (same user/IP pattern in `UNAUTHENTICATED` entries).
* Authorization-denial patterns (repeated `NOT_FOUND` on foreign-resource attempts).
* Rate-limit violation clusters (`RATE_LIMIT_EXCEEDED`).
* Unusual upload volume (media-endpoint request patterns).

These are detected by querying the structured logs (Cloud Logging queries/saved views); threshold-based alerting follows §13's philosophy. The events themselves come entirely from the standard request log — no separate audit pipeline exists in this architecture.

---

## 10. Alerts

Alerts focus on conditions requiring human attention. Cloud Monitoring alert policies on the signals above; **thresholds are set from observed baselines after deployment and tuned over time — this document deliberately specifies no numeric SLOs/SLAs** (none exist in the canonical documents).

Alert-worthy conditions by category:

| Category | Condition (pattern) |
| -------- | ------------------- |
| Availability | 5xx rate spike; health-check failures; Cloud Run container startup failures |
| Performance | Latency percentile sustained above the observed baseline; AI latency step-change |
| AI reliability | Gemini failure-rate spike; `GEMINI_INVALID_RESPONSE` increase; timeouts above baseline |
| Data layer | Firestore error/timeout spike; storage failure spike |
| Security | Auth-failure spike; authorization-denial spike; rate-limit violation surge |
| Cost | AI request-volume anomaly (rate-limit hits as proxy), per ADR-008 |

Alert routing/notification channels are an operational setup choice made at deployment — not a committed component.

---

## 11. Dashboards

A single production dashboard in Cloud Monitoring, sectioned:

```text
Application   request rate · 5xx rate · latency percentiles
AI            Gemini request rate · failure rate · latency · validation-failure count
Data          Firestore error count · storage failure count
Security      auth failures · authorization denials · rate-limit events
Platform      Cloud Run instances · CPU · memory · cold starts
```

Dashboard construction is part of production setup (`DEPLOYMENT.md` §6 configuration), built on built-in + log-derived metrics only.

---

## 12. Incident Troubleshooting Flow

```text
1. Time window + symptom (alert or user report)
2. Cloud Run health: instances, CPU/memory, startup failures
3. API error rates and status-code mix in the window
4. Pull representative requestIds → read correlated log lines
      (application stages, Firestore, AI operation, error classes)
5. Attribute: application code vs Auth vs Firestore vs Gemini vs platform
6. Scope: one user vs many (userId distribution — never content)
7. Mitigate (rollback per DEPLOYMENT.md §15; configuration; upstream status)
8. Record root cause + corrective action — incident notes reference
   requestIds and error classes, never journal content
```

The request-ID correlation (§3) is what makes steps 4–6 possible without ever reading user content into incident tooling or notes.

---

## 13. Alerting Philosophy & Measurement vs Targets

* **Measure everything committed above; invent no targets.** No numeric SLOs/SLAs/latency budgets are defined in the canonical documents, so none are specified here. Baselines are established empirically post-deployment; alert thresholds derive from those baselines.
* **Alerts are for page-worthy conditions**, not curiosity — if an alert repeatedly fires without action, the threshold (or the alert) is wrong.
* **Measurement ≠ quality judgment:** operational metrics count failures and durations; judgments about AI answer quality belong to `AI_EVALUATION.md` (evaluation cases, rubrics, regression comparison). The two share the structured signals (e.g., `GEMINI_INVALID_RESPONSE` counts here; groundedness scoring there).

---

## 14. Development vs Production Observability

| Aspect | Development | Production |
| ------ | ----------- | ---------- |
| Log level | `DEBUG` allowed; verbose payload-free diagnostics | `INFO`+ only; `DEBUG` suppressed |
| Destination | Console/local | Cloud Logging |
| Metrics | Not required | Cloud Monitoring dashboards + alerts |
| Content debugging | Full local reproduction permitted (still no secrets) | Metadata only (§4) |
| Correlation | `requestId` in console | `requestId` across Cloud Logging |

---

## 15. Relationship to Other Documents

* **`AI_EVALUATION.md`** — owns AI *quality* methodology: evaluation cases, scoring, human rubric, regression evaluation. This document owns the *operational* signals (§8) that feed cost/failure visibility and provide raw data (e.g., validation-failure counts) the evaluation process consumes. Neither duplicates the other.
* **`TESTING.md`** — owns how failure modes are *tested* before production (failure-injection assertions). This document owns how the same failure classes are *observed* in production. Shared vocabulary: the `API.md` error-code registry.
* **`SECURITY.md`** — owns the logging-privacy rules (§26) this document implements; §9's security signals are the operational view of SECURITY.md §27's monitoring list.
* **`DEPLOYMENT.md`** — owns post-deploy smoke checks and the dashboard/alert setup as part of production configuration.

---

## 16. Observability Principle

> **Observe the system, not the user's private journal.**

Enough signal to diagnose any failure — correlated by request ID, classified by error code — and never a single byte of journal content, a token, or a secret in any log, alert, dashboard, or incident note.
