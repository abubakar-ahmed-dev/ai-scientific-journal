# Phase 1 — Repository & Tooling Foundation: Setup Guide

**Source plan:** `plans/IMPLEMENTATION_PLAN.md` §3 Phase 1
**Governing docs:** TA §5, §9, §28, §34, §41, §44, §45, §77; API.md §1–§3; ADR-012, ADR-018, ADR-019; TESTING.md §1, §15; OBSERVABILITY.md §3; DEPLOYMENT.md §2, §4
**Branch:** `feature/phase-1-foundation` (off `dev` — never work on `main`)

---

## 0. Prerequisites Check

```bash
node -v        # expect v22.x LTS (v20 acceptable minimum)
npm -v
docker -v      # Docker Desktop must be running for the build check
git -v
```

Optional now, required later (do not block Phase 1 on these):

* Firebase CLI — `npm i -g firebase-tools` (needed Phase 2: emulators, rules deploy)
* Google Cloud CLI — <https://cloud.google.com/sdk/docs/install> (needed Phase 9: Cloud Run deploy)

## 0.1 Branch and Directory Scaffold

```bash
cd /c/Users/Admin/Desktop/FAST/projects/ai-scientific-journal
git checkout dev
git checkout -b feature/phase-1-foundation

mkdir -p backend/src/{config,lib,middleware,routes,types} backend/tests/unit
mkdir -p firebase infrastructure/cloud-run scripts .github/workflows
```

---

## 1. Root Files

### 1.1 Root `package.json` (convenience orchestration only — no root deps)

```json
{
  "name": "ai-scientific-journal",
  "private": true,
  "scripts": {
    "dev:backend": "npm --prefix backend run dev",
    "dev:frontend": "npm --prefix frontend run dev",
    "build": "npm --prefix backend run build && npm --prefix frontend run build",
    "test": "npm --prefix backend run test && npm --prefix frontend run test"
  }
}
```

### 1.2 `.gitignore` — **replace** current contents (currently only `.claude/`)

```gitignore
# dependencies
node_modules/

# builds
dist/
build/

# environment / secrets — never commit
.env
.env.*
!.env.example
service-account*.json
credentials.json
*.pem

# test / coverage
coverage/

# firebase
.firebase/
firebase-debug.log

# misc
.DS_Store
*.log
.claude/
```

### 1.3 `.dockerignore`

```gitignore
node_modules
**/node_modules
dist
**/dist
.env
**/.env
**/.env.*
!.env.example
.git
.github
.claude
coverage
*.log
service-account*.json
credentials.json
```

---

## 2. Backend

### 2.1 Install

```bash
cd backend
npm init -y

# Runtime deps (TA §5.2 subset needed now; Firebase Admin / Gemini SDK come in Phases 2/4)
npm install express@^5 cors helmet express-rate-limit pino zod

# Tooling
npm install -D typescript tsx vitest supertest eslint @eslint/js typescript-eslint \
  @types/node @types/express @types/cors @types/supertest
```

### 2.2 `package.json` scripts (set via `npm pkg set` — Windows-bash safe)

```bash
npm pkg set name="ai-scientific-journal-backend" version="0.1.0" private=true main="dist/server.js"
npm pkg set scripts.dev="tsx watch src/server.ts"
npm pkg set scripts.build="tsc -p tsconfig.build.json"
npm pkg set scripts.start="node dist/server.js"
npm pkg set scripts.test="vitest run"
npm pkg set scripts.lint="eslint src tests"
npm pkg set scripts.typecheck="tsc"
```

> No `"type": "module"` — the backend compiles to CommonJS (avoids ESM extension pitfalls; `tsx` handles both).

### 2.3 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```

### 2.4 `tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

### 2.5 `eslint.config.mjs`

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  js.configs.recommended,
  ...tseslint.configs.recommended
);
```

### 2.6 `.env.example` (placeholders only — real `.env` never committed)

```bash
# Runtime configuration (validated at startup — TA §44; fail fast on missing required values)
NODE_ENV=development
PORT=8081
CORS_ORIGIN=http://localhost:5173

# Phase 2 (Firebase Admin — server-side):
# FIREBASE_PROJECT_ID=
# Phase 4 (Gemini — local dev only; production value comes from Secret Manager at runtime, never a file):
# GEMINI_API_KEY=
# AI_MODEL=
```

### 2.7 Source files

**`src/config/env.ts`** — centralized, Zod-validated, fail-fast (TA §44):

```typescript
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8081),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}

// Fail fast at startup — a partially configured application must not start (TA §44).
export const env = loadEnv();
```

**`src/lib/logger.ts`** — Pino structured logging (OBSERVABILITY.md §3, §14):

```typescript
import pino from "pino";
import { env } from "../config/env";

export const logger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
});
```

**`src/types/errors.ts`** — the canonical error-code registry (API.md §3.2 — single source):

```typescript
export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMIT_EXCEEDED"
  | "AI_INVALID_RESPONSE"
  | "AI_UNAVAILABLE"
  | "INTERNAL_ERROR";

const HTTP_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMIT_EXCEEDED: 429,
  AI_INVALID_RESPONSE: 502,
  AI_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly status: number;

  constructor(readonly code: ErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.status = HTTP_STATUS[code];
  }
}
```

**`src/types/express.d.ts`** — request correlation typing:

```typescript
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export {};
```

**`src/middleware/requestId.ts`** — `X-Request-Id` handling (API.md §1.3):

```typescript
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header("X-Request-Id");
  // Cap accepted length — an unbounded echo of a client header is a header-injection vector.
  req.requestId =
    incoming && incoming.length > 0 && incoming.length <= 128
      ? incoming
      : crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
}
```

**`src/middleware/requestLogger.ts`** — one structured line per request (OBSERVABILITY.md §3; never log bodies):

```typescript
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info(
      {
        requestId: req.requestId,
        method: req.method,
        route: req.route?.path ?? req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs),
      },
      "request completed"
    );
  });
  next();
}
```

**`src/middleware/rateLimit.ts`** — global IP backstop; per-user tiers arrive with auth (API.md §4.1):

```typescript
import rateLimit from "express-rate-limit";

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
        requestId: req.requestId,
      },
    });
  },
});
```

**`src/middleware/errorHandler.ts`** — registry codes only; internals logged, never returned (TA §45; SECURITY.md §22):

```typescript
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../types/errors";
import { logger } from "../lib/logger";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "The requested resource could not be found.",
      requestId: req.requestId,
    },
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, requestId: req.requestId },
    });
    return;
  }

  // body-parser failure classes → registry codes (never leak parser internals)
  const type = (err as { type?: string } | null)?.type;
  if (type === "entity.parse.failed") {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body is not valid JSON.",
        requestId: req.requestId,
      },
    });
    return;
  }
  if (type === "entity.too.large") {
    res.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request body exceeds the configured size limit.",
        requestId: req.requestId,
      },
    });
    return;
  }

  // Server-side detail only — the client response is always sanitized.
  logger.error(
    { err, requestId: req.requestId, route: req.originalUrl },
    "unhandled error"
  );
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      requestId: req.requestId,
    },
  });
}
```

**`src/routes/index.ts`** — v1 mount point (endpoints arrive in Phases 2–6):

```typescript
import { Router } from "express";

// Phase 2+: auth middleware, /me, projects, observations, conversations, /ai/* (API.md §6)
export const apiV1Router = Router();

apiV1Router.get("/", (_req, res) => {
  res.status(200).json({ data: { service: "ai-scientific-journal", apiVersion: "v1" } });
});
```

**`src/app.ts`** — canonical middleware order (TA §77); health unversioned (ADR-018):

```typescript
import fs from "fs";
import path from "path";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env";
import { requestId } from "./middleware/requestId";
import { requestLogger } from "./middleware/requestLogger";
import { apiRateLimiter } from "./middleware/rateLimit";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { apiV1Router } from "./routes";

export function createApp(): express.Express {
  const app = express();

  // Cloud Run terminates TLS behind a load balancer (DEPLOYMENT.md §6)
  app.set("trust proxy", 1);

  // Canonical middleware order (TA §77): requestId → headers → CORS → body → logging → rate limit
  app.use(requestId);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);
  app.use(apiRateLimiter);

  // Liveness — public, deliberately unversioned, zero infrastructure detail (API.md §6.1)
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  // All business endpoints (ADR-018)
  app.use("/api/v1", apiV1Router);

  // Production: this service serves the built SPA — one container, one service (DEPLOYMENT.md §2)
  const staticRoot = path.resolve(__dirname, "../../frontend/dist");
  if (env.NODE_ENV === "production" && fs.existsSync(staticRoot)) {
    app.use(express.static(staticRoot));
    app.use((req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(staticRoot, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
```

**`src/server.ts`** — listens on `$PORT` (DEPLOYMENT.md §4); SIGTERM drain:

```typescript
import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./lib/logger";

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`server listening on port ${env.PORT} (${env.NODE_ENV})`);
});

// Cloud Run sends SIGTERM on redeploys — drain in-flight requests
process.on("SIGTERM", () => {
  logger.info("SIGTERM received — shutting down");
  server.close(() => process.exit(0));
});
```

### 2.8 Tests (`backend/tests/unit/`)

**`env.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { loadEnv } from "../../src/config/env";

describe("loadEnv", () => {
  it("applies development defaults", () => {
    expect(loadEnv({})).toMatchObject({ NODE_ENV: "development", PORT: 8080 });
  });

  it("fails fast on an invalid PORT (TA §44)", () => {
    expect(() => loadEnv({ PORT: "not-a-number" })).toThrow(
      /Invalid environment configuration/
    );
  });
});
```

**`health.test.ts`** — also asserts the error-envelope contract (API.md §1.4, §3.1):

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";

describe("GET /api/health", () => {
  it("returns 200 {status: ok} with no auth and no detail", async () => {
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("unknown routes", () => {
  it("returns the canonical error envelope with a requestId", async () => {
    const res = await request(createApp()).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.error.requestId).toBeDefined();
  });
});

describe("request correlation", () => {
  it("honors a client X-Request-Id (API.md §1.3)", async () => {
    const res = await request(createApp())
      .get("/api/health")
      .set("X-Request-Id", "req_test_123");
    expect(res.headers["x-request-id"]).toBe("req_test_123");
  });
});
```

---

## 3. Frontend

### 3.1 Scaffold

```bash
cd ..   # repo root
npm create vite@latest frontend -- --template react-ts

cd frontend
npm install
npm install @tanstack/react-query react-router-dom
npm install tailwindcss @tailwindcss/vite
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm pkg set scripts.test="vitest run" scripts.typecheck="tsc -b"
```

### 3.2 `vite.config.ts` — **replace** template version (Tailwind v4 plugin, `@` alias, API proxy, Vitest)

```typescript
/// <reference types="vitest/config" />
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  server: {
    proxy: { "/api": "http://localhost:8081" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
```

### 3.3 Path alias in `tsconfig.app.json` (add inside `compilerOptions` — required by shadcn/ui later)

```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

### 3.4 `.env.example` (frontend config is public-by-design — DEPLOYMENT.md §7)

```bash
# Backend API base (dev uses the Vite proxy; production uses same-origin)
VITE_API_BASE_URL=/api/v1

# Phase 2 — Firebase web config (public identifiers, NOT secrets):
# VITE_FIREBASE_API_KEY=
# VITE_FIREBASE_AUTH_DOMAIN=
# VITE_FIREBASE_PROJECT_ID=
# VITE_FIREBASE_APP_ID=
```

### 3.5 App shell files

**`src/index.css`** — **replace** contents:

```css
@import "tailwindcss";
```

**`src/test/setup.ts`**

```typescript
import "@testing-library/jest-dom/vitest";
```

**`src/lib/queryClient.ts`**

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
  },
});
```

**`src/lib/api.ts`** — envelope-aware client; token wire format now, Firebase wiring in Phase 2:

```typescript
const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

type ApiEnvelope<T> = { data: T; meta?: unknown };
type ApiErrorBody = { error?: { code: string; message: string; requestId: string } };

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly requestId?: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

// Phase 2 replaces this with the Firebase ID token provider.
let tokenProvider: () => Promise<string | null> = async () => null;
export function setAuthTokenProvider(provider: () => Promise<string | null>): void {
  tokenProvider = provider;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<ApiEnvelope<T>> {
  const token = await tokenProvider();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const body = (await res.json().catch(() => null)) as
    | ApiEnvelope<unknown>
    | ApiErrorBody
    | null;

  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiRequestError(
      err?.code ?? "INTERNAL_ERROR",
      err?.message ?? "Request failed.",
      err?.requestId,
      res.status
    );
  }
  return body as ApiEnvelope<T>;
}
```

**`src/pages/LandingPage.tsx`**

```tsx
export default function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">AI Scientific Journal</h1>
        <p className="mt-2 text-gray-500">
          Phase 1 scaffold — authentication arrives in Phase 2.
        </p>
      </div>
    </main>
  );
}
```

**`src/app/providers.tsx`**

```tsx
import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "../lib/queryClient";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}
```

**`src/app/App.tsx`** — **replace** template `App.tsx` (delete `App.css` usage):

```tsx
import { Routes, Route } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
    </Routes>
  );
}
```

**`src/main.tsx`** — **replace** template:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import { Providers } from "@/app/providers";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>
);
```

**`src/pages/LandingPage.test.tsx`**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";

describe("LandingPage", () => {
  it("renders the product title", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("heading", { name: /ai scientific journal/i })
    ).toBeInTheDocument();
  });
});
```

Delete the template's `src/App.css` and `src/assets/react.svg` usage.

### 3.6 shadcn/ui (in Phase 1 scope; interactive — or defer within the phase without blocking others)

```bash
npx shadcn@latest init    # prompts: TypeScript=yes, style per preference, base color=neutral, CSS variables=yes
npx shadcn@latest add button   # smoke-check one component
```

---

## 4. Firebase / Infrastructure / CI Placeholders

**`firebase/firebase.json`**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

**`firebase/firestore.rules`** — deny-by-default placeholder; Phase 2 replaces with the full UID-subtree model (SECURITY.md §6):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Phase 2 replaces this with the UID-isolation model (SECURITY.md §6):
    //   match /users/{uid}/{document=**} {
    //     allow read, write: if request.auth != null && request.auth.uid == uid;
    //   }
    // Secure by default until then (SECURITY.md §32): deny everything.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**`firebase/firestore.indexes.json`**

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

**`infrastructure/cloud-run/README.md`** — one paragraph: service `ai-scientific-journal`, label `dev-tutorial=cloud-run-ai-challenge`; concrete config lands in Phase 9 (DEPLOYMENT.md §6, §9–§11).

**`scripts/README.md`** — one line: dev utilities (seed, env validation, smoke tests) land with the phases that need them (TA §9).

### `.github/workflows/ci.yml` — per-app checks + Docker build (TESTING.md §15)

```yaml
name: CI

on:
  push:
    branches: [dev, main]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build

  docker:
    runs-on: ubuntu-latest
    needs: [backend, frontend]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v6
        with:
          context: .
          push: false
          tags: ai-scientific-journal:ci
```

---

## 5. Dockerfile (repo root) — single-service container (ADR-012, DEPLOYMENT.md §4–§5)

```dockerfile
# ---- frontend build ----
FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- backend build ----
FROM node:22-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

# ---- runtime ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/package.json ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
USER node
EXPOSE 8080
CMD ["node", "backend/dist/server.js"]
```

---

## 6. Validation (definition of done — CLAUDE.md §Validation; plan Phase 1 outcome)

```bash
# Backend
cd backend && npm run lint && npm run typecheck && npm test && npm run build && cd ..

# Frontend
cd frontend && npm run lint && npm run typecheck && npm test && npm run build && cd ..

# Container (serves SPA + API on $PORT)
docker build -t ai-scientific-journal:dev .
docker run --rm -p 8080:8080 ai-scientific-journal:dev &
sleep 3
curl -s http://localhost:8080/api/health          # expect {"status":"ok"}
curl -s http://localhost:8080/api/v1/nope         # expect NOT_FOUND envelope with requestId
curl -sI http://localhost:8080/ | head -1         # expect HTTP/1.1 200 (SPA served)
docker rm -f $(docker ps -q --filter ancestor=ai-scientific-journal:dev)

# Dev mode (two terminals)
npm run dev:backend     # :8080
npm run dev:frontend    # :5173 — http://localhost:5173 renders Landing; /api proxies to :8080
```

## 7. Commit (plans/CLAUDE.md §Git)

```bash
git add -A
git status                      # confirm no .env, no node_modules, no dist
git diff --staged               # review
git commit -m "feat: phase 1 - repository, CI, backend/frontend skeletons, Docker"

git push -u origin feature/phase-1-foundation   # CI must be green before merge to dev
```

---

## 8. Explicitly NOT in Phase 1 (scope guard — plan §3 Phase 1 risks)

* No Firebase Admin SDK, no Firestore repositories, no auth middleware (Phase 2)
* No Gemini SDK / AI Service (Phase 4)
* No analysis/versions/media schemas or endpoints (Phases 3–5) — the error registry and
  envelope are the only API-contract artifacts built now
* No root `tests/` directory — per-app tests only (ADR-019)
* No staging environment, no automated deploy workflow (Phase 9)
