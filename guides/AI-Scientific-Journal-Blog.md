# Beyond AI Journaling: Building a Secure Scientific Research Companion with Gemini and Cloud Run

> How I transformed the Personal Gemini Journal challenge into an evidence-aware workspace for recording observations, discovering connections, and planning better investigations.

**Live application:** `[ADD CLOUD RUN URL]`  
**Source code:** `[ADD GITHUB REPOSITORY URL]`  
**Challenge:** [Gen AI Academy APAC](https://hack2skill.com/event/apac-genaiacademy?tab=cohort3&utm_source=hack2skill&utm_medium=homepage)  
**Hashtag:** `#AccelerateAIwithCloudRun`

`[HERO IMAGE: AI Scientific Journal landing page]`

## 1. The Challenge: Build Beyond an AI Demo

The Gen AI Academy APAC challenge began with a clear goal: build a secure Personal Gemini Journal using Firebase Authentication, Gemini, Cloud Firestore, Secret Manager, and Google Cloud Run. The baseline was intentionally simple—a private journal where authenticated users could have multi-turn conversations with Gemini and save their history.

I used that foundation to build **AI Scientific Journal**, a personal research workspace that helps people record what they observe and turn those records into grounded insights, better questions, and practical next investigations.

The application is designed for naturalists, students, citizen scientists, hobby researchers, and anyone who wants to examine personal observations more thoughtfully. It supports both simple journaling and structured scientific work without forcing every user through a complicated research form.

At the center of the product is one clear loop:

> **Observe → Record → Analyze → Organize → Discover → Investigate Further**

Gemini adds intelligence to this loop, but the application remains responsible for identity, authorization, data, evidence, validation, privacy, and business rules. That separation was one of the most important decisions in the project.

## 2. One Flexible Record: The Observation

The fundamental record in the application is an **Observation**. It can be as simple as a title and description, making it suitable for an ordinary journal entry. When more structure is useful, the same record can include:

- Date and time of the observation
- A user-written hypothesis
- Supplementary notes
- Tags
- Numerical measurements with units
- A location with privacy controls
- Images, audio, or video as supporting evidence
- An optional research project

This design gives users a low-friction starting point. They can record an idea immediately and add scientific detail only when it contributes value. Projects are also optional: users can begin recording first and organize related observations later.

The result is a journal that adapts to the user instead of making the user adapt to the database structure.

`[IMAGE: Observation form with measurements, hypothesis, tags, and location fields]`

## 3. Gemini as a Research Assistant

AI Scientific Journal uses Gemini for several connected capabilities rather than limiting it to a single chat screen.

### 3.1 Multi-turn AI conversations

Users can have persistent conversations for reflection, brainstorming, or research discussion. A conversation can be general or linked to a particular observation, project, or analysis, allowing Gemini to respond within a meaningful context.

### 3.2 Structured observation analysis

From an observation, users can request a structured analysis containing:

- A concise summary
- Key findings
- Possible hypotheses
- Confidence indicators
- Uncertainties
- Suggested questions
- Recommended next steps

These results are presented as AI-generated interpretations and stored separately from the original observation. Running an analysis never replaces what the user recorded.

### 3.3 Suggested investigations and research tasks

Gemini can propose follow-up measurements, comparisons, photographs, questions, or experiments. However, a suggestion does not automatically become a task. The user decides whether it is useful and explicitly accepts it before it enters the research task list.

This preserves human control while still making AI recommendations actionable.

### 3.4 Ask My Journal

The feature I am most proud of is **Ask My Journal**.

Instead of asking Gemini a general question, users can ask questions about their own saved observations:

- “Have I recorded this pattern before?”
- “Which observations mention cold weather?”
- “What did I observe near the pond?”
- “What patterns appear in my feeding-time records?”

The application first retrieves relevant observations from the authenticated user’s private journal, ranks them, rechecks them against the canonical records, and sends only the most useful context to Gemini. The response contains supporting evidence and links back to the original observations.

When the journal does not contain enough evidence, the application says so clearly. A careful answer based on insufficient evidence is more useful than a confident invention.

This makes Ask My Journal more than semantic search and more than ordinary chat. It turns a growing collection of personal records into a navigable body of knowledge.

`[IMAGE: Ask My Journal answer with evidence cards and source-observation links]`

`[IMAGE: Ask My Journal clearly communicating that the available evidence is insufficient]`

## 4. Designing Around the Four Judging Criteria

The competition evaluates projects on **Authenticity, Usability, Stability, and Security**. I treated these as product requirements rather than labels to add after development.

### 4.1 Authenticity: An original workflow beyond the starter journal

AI Scientific Journal expands the original brief into a complete observation-to-investigation workflow.

Its originality comes from how the features work together:

- Structured observations combine freeform writing with measurements, hypotheses, evidence, and location.
- Observation version history preserves the progression of edited records.
- Private media gives users a place for photographic, audio, or video evidence.
- The Research Map makes location-aware observations explorable.
- Gemini analyses explicitly separate findings, hypotheses, and uncertainty.
- Ask My Journal answers questions using the user’s actual observation history.
- Related-observation retrieval helps reveal connections between records.
- AI suggestions can become user-approved, trackable research tasks.
- Every saved analysis retains its source references, model information, prompt version, and creation time.

Together, these capabilities make the product feel like a personal research companion rather than a generic Gemini wrapper.

The application also respects scientific authenticity. User observations remain the source record. User-written hypotheses remain distinguishable from AI-generated hypotheses. Gemini can interpret, summarize, and suggest, but it cannot silently rewrite the evidence.

`[IMAGE: Observation detail displaying the original record beside a structured AI analysis]`

`[IMAGE: Research Map populated with synthetic demonstration observations]`

### 4.2 Usability: Start quickly and grow into advanced features

The application guides users from the moment they sign in with Google.

For a first-time user, the dashboard offers clear starting actions such as **Record First Observation**, **Create Project**, and **Quick Capture**. Quick Capture requires only a title and description, so a passing idea can be saved as a draft in seconds. The user can then continue into the full form when ready.

For a returning user, the dashboard becomes a workspace for continuing research. It presents recent observations, active projects, open tasks, analyses, recent activity, and a suggested next action. If one dashboard section cannot load, that section provides its own retry option instead of making the entire page unusable or presenting failed data as an empty result.

Navigation is supported by:

- A grouped sidebar for the main research areas
- Clear active-page states
- A responsive mobile navigation drawer
- A command palette opened with `Ctrl+K` or `Cmd+K`
- Direct links from AI evidence to source observations
- Search, filtering, sorting, and cursor-based pagination
- Clear loading, empty, success, validation, and retry states

The interface also explains important decisions in plain language. For example, location privacy is not represented by an unclear technical setting. Users choose among **Exact**, **Approximate**, and **Hidden**:

- Exact locations can appear as recorded.
- Approximate locations are displayed with reduced precision.
- Hidden locations stay out of map displays and AI context.

Destructive actions require confirmation, archived content remains manageable, and observation editing includes version history and conflict protection. The user is consistently informed about what the application is doing and what will happen next.

For a complete page-by-page walkthrough of the application and its everyday research workflows, see the [User Guide](USER_GUIDE_URL_PLACEHOLDER).

`[IMAGE: Returning-user dashboard with Quick Capture, current research, and next action]`

`[IMAGE: Sidebar and command palette]`

### 4.3 Stability: Preserve the user’s work under real conditions

A production-ready AI application must behave responsibly when an external service, network request, or generated response does not behave perfectly.

AI Scientific Journal isolates AI operations from user-owned records. An observation remains safe if Gemini is unavailable. In a conversation, the user’s message is persisted independently; if the AI step cannot complete, the message remains available and generation can be retried without duplicating the user’s turn.

Gemini outputs also pass through a controlled pipeline:

1. Authenticate the request.
2. Authorize access to the requested resources.
3. Validate the user input.
4. Retrieve only the user’s relevant context.
5. Construct a bounded prompt.
6. Call Gemini.
7. Parse and validate the response structure.
8. Apply application-level checks.
9. Persist only a valid result.

If Gemini returns an unusable structured response, it is rejected instead of becoming permanent journal data. If a question has weak evidence, Ask My Journal can return a deterministic insufficient-evidence response without making an unnecessary model call.

Other reliability measures include:

- Idempotency protection for retryable write operations, preventing accidental duplicates
- Rate limits for AI, chat, search, and media operations
- Input and file-size limits
- Optimistic version checks that prevent silent overwriting during concurrent edits
- Stable cursor pagination for growing histories
- Standardized, safe API errors with request IDs
- Independent loading and retry behavior for major UI sections
- Production health checks and smoke tests
- Structured Cloud Logging and Cloud Monitoring signals
- Cloud Run revision-based deployment and rollback

The application never claims that an observation was saved when persistence failed. It provides a clear message and preserves entered content where possible so the user can retry. Optional capabilities such as maps and media are also isolated so they do not prevent the core observation workflow.

Stability here is not just uptime. It is the ability to fail safely, communicate clearly, and protect the user’s work.

`[IMAGE: Friendly retry state demonstrating that the rest of the workspace remains usable]`

### 4.4 Security: Privacy enforced at every layer

Personal journals and unpublished observations can contain sensitive information, so security is built into the application’s structure.

#### Authentication and ownership

Firebase Authentication provides Google Sign-In. Each protected request carries a Firebase ID token, which the backend verifies before deriving the user’s UID. The application never trusts a UID or owner field supplied by the client.

All private records live beneath the authenticated user’s Firestore path:

```text
users/{uid}/...
```

The backend enforces ownership on business operations, while Firestore Security Rules provide an independent data-layer boundary. Requests for another user’s resource return the same not-found response used for a missing resource, preventing the API from revealing whether private data exists.

#### Secure AI access

Gemini is called only from the server. The Gemini API key is stored in Google Cloud Secret Manager and injected into the Cloud Run runtime. It is never included in the React bundle, repository, Firestore, local storage, URLs, or logs.

Retrieval is scoped by the authenticated UID before the model is called. Gemini never selects which users’ data may be accessed and can never override application authorization. User and retrieved content are also treated as untrusted prompt data rather than executable instructions.

#### Private media and safe logging

Evidence files are stored in private, observation-scoped Cloud Storage paths generated by the backend. The frontend does not choose or receive raw object paths. Authorized access uses short-lived URLs after ownership has been verified.

Production logs contain operational information such as request IDs, status, duration, and AI operation metadata. They exclude secrets, authentication tokens, private journal content, full prompts, model responses, storage paths, and unnecessary precise coordinates.

#### Defense in depth

Security is reinforced through multiple controls:

- Firebase Authentication
- Backend authentication and authorization
- UID-scoped Firestore paths
- Firestore Security Rules
- Server-side input validation
- Google Cloud Secret Manager
- Least-privilege IAM for the Cloud Run service account
- Private Cloud Storage
- Secure HTTP headers and controlled cross-origin access
- Per-user rate limiting
- Validated AI outputs
- Automated user-isolation and authorization tests

No single frontend check, database field, or AI instruction is treated as the entire security model.

`[IMAGE: Simplified security flow from Firebase Authentication through Cloud Run to user-scoped Firestore data]`

## 5. Right-Sized Production Engineering

One of the most deliberate choices in this project was to avoid adding infrastructure simply to make the architecture appear more complex.

The application uses a **modular monolith** deployed as one stateless Cloud Run service. The Express backend serves the versioned API and the production React application. Internally, the code remains separated into routes, services, repositories, AI adapters, prompt modules, validation, retrieval, storage, and domain logic.

This structure provides strong engineering boundaries without the operational cost of unnecessary microservices. The current product does not need Kafka, Redis, Kubernetes, Nginx, or a collection of separately deployed services.

Instead, each managed component has a clear responsibility:

| Component | Responsibility |
| --- | --- |
| Firebase Authentication | User identity and Google Sign-In |
| Cloud Run | Stateless application runtime and horizontal scaling |
| Cloud Firestore | Canonical user data and persistence |
| Cloud Storage | Private evidence media |
| Gemini | Conversation, analysis, and grounded generation |
| Secret Manager | Runtime protection of the Gemini API key |
| Cloud Logging and Monitoring | Operational visibility |
| Artifact Registry and Cloud Build | Reproducible container delivery |

Performance is addressed at the points where it matters: cursor pagination prevents unbounded reads, TanStack Query manages frontend server state, AI context is bounded, relevant observations are retrieved and ranked before generation, and rate limits protect both availability and cost.

The backend remains stateless, so Cloud Run can replace or scale instances without losing sessions or journal data. Persistent state belongs in Firestore, media belongs in Cloud Storage, identity belongs in Firebase, and secrets belong in Secret Manager.

Developers interested in the implementation, architecture, local setup, testing strategy, deployment process, and operational design can explore the [Developer Guide](DEVELOPER_GUIDE_URL_PLACEHOLDER).

> Production engineering is not measured by how many services a system contains, but by how deliberately each service solves a real requirement.

`[IMAGE: High-level architecture showing React, Cloud Run, Firestore, Gemini, Cloud Storage, and Secret Manager]`

## 6. A Security-First Development Workflow

Google AI Studio was used to establish security-focused Custom Instructions before implementation. These instructions acted as a development constitution covering threat modeling, secure coding, authentication, authorization, Firestore isolation, secret management, input validation, error handling, and secure external integrations.

The project then moved through a structured engineering workflow:

1. Define product requirements and the scientific workflow.
2. Design the architecture, data ownership model, and security boundaries.
3. Use Google AI Studio for Gemini experimentation and security guidance.
4. Implement and refine the application in Antigravity.
5. Validate with linting, type checking, automated tests, security tests, and production smoke checks.
6. Build a reproducible Docker container.
7. Store the image in Artifact Registry.
8. Deploy the service to Google Cloud Run.
9. Inject the Gemini credential securely from Secret Manager.
10. Observe production behavior through Cloud Logging and Monitoring.

This process helped turn an initial concept into a deployed application with documented architecture, API contracts, data schemas, security rules, testing guidance, and deployment instructions.

`[IMAGE: Google AI Studio Custom Instructions focused on secure development]`

`[IMAGE: Cloud Run service with successful deployment and the required challenge label]`

## 7. A Complete User Journey

A typical research journey now looks like this:

1. The user signs in with Google and enters a private workspace.
2. They use Quick Capture or the full form to record an observation.
3. They optionally add measurements, tags, a hypothesis, evidence, and a privacy-aware location.
4. They ask Gemini to analyze the observation.
5. They review the findings, possible hypotheses, supporting observations, and uncertainties.
6. They request suggestions for the next investigation.
7. They accept a useful suggestion as a research task.
8. They use Ask My Journal to compare the new observation with earlier records.
9. They open the cited evidence and continue the discussion in a contextual AI chat.
10. They return later through the dashboard, project view, task list, or Research Map.

This journey gives Gemini a meaningful role at every stage while keeping the user in control of the original record and every action that affects their research workspace.

## 8. Final Result

AI Scientific Journal demonstrates what the Personal Gemini Journal concept can become when security, usability, stability, and originality are treated as first-class requirements.

- It is **authentic** because it introduces an original scientific workflow with observations, evidence, location, provenance, grounded retrieval, and research tasks.
- It is **usable** because people can capture a simple note immediately and adopt advanced structure only when it helps.
- It is **stable** because external failures are isolated, AI responses are validated, retries are safe, and user work remains protected.
- It is **secure** because identity, authorization, data storage, media, AI access, secrets, and logs all have explicit boundaries.

Most importantly, it shows that Gemini can be more than a response generator. With the right product design and engineering controls, it can help users revisit their own evidence, recognize connections, express uncertainty, ask better questions, and decide what to investigate next.

> **AI Scientific Journal is a secure personal research workspace where Gemini helps turn observations into structured knowledge and better questions.**

**Try the application:** `[ADD CLOUD RUN URL]`  
**Explore the source:** `[ADD GITHUB REPOSITORY URL]`

`#AccelerateAIwithCloudRun`
