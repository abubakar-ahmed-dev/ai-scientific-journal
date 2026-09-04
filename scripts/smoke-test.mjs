#!/usr/bin/env node
/**
 * Post-deployment smoke test (DEPLOYMENT.md §13, TESTING.md §15).
 *
 * Usage:
 *   node scripts/smoke-test.mjs <BASE_URL> [--token <firebaseIdToken>]
 *
 * Examples:
 *   node scripts/smoke-test.mjs https://ai-scientific-journal-xxxx.run.app
 *   node scripts/smoke-test.mjs http://localhost:8080 --token ya29.abC...
 *
 * Checks (no dependencies beyond Node >= 18):
 *   1. GET /api/health            → 200 {"status":"ok"}          (ADR-018, unversioned)
 *   2. GET /                      → 200 HTML containing the SPA mount
 *   3. GET /api/v1/observations   → 401 with the registry error envelope
 *   4. (--token) GET /api/v1/me   → 200 with the authenticated profile
 *
 * Exit code 0 = all checks passed; 1 = one or more failed (CI-friendly).
 */

const args = process.argv.slice(2);
const baseUrl = args[0];
const tokenIndex = args.indexOf("--token");
const idToken = tokenIndex !== -1 ? args[tokenIndex + 1] : undefined;

if (!baseUrl) {
  console.error("Usage: node scripts/smoke-test.mjs <BASE_URL> [--token <firebaseIdToken>]");
  process.exit(1);
}

const base = baseUrl.replace(/\/+$/, "");

let failures = 0;

function report(name, ok, detail) {
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

async function checkJson(name, url, expectedStatus, validateBody) {
  try {
    const res = await fetch(url, { headers: idToken && url.includes("/api/v1") ? { Authorization: `Bearer ${idToken}` } : {} });
    const statusOk = res.status === expectedStatus;
    let body = null;
    try {
      body = await res.json();
    } catch {
      // non-JSON body — body checks handle null
    }
    const bodyOk = validateBody ? validateBody(body, res) : true;
    report(name, statusOk && bodyOk, `HTTP ${res.status}`);
    return { res, body };
  } catch (err) {
    report(name, false, `request failed: ${err.message}`);
    return { res: null, body: null };
  }
}

async function main() {
  console.log(`Smoke-testing ${base}\n`);

  // 1. Health — unversioned, public (ADR-018)
  await checkJson("health endpoint", `${base}/api/health`, 200, (body) =>
    body && body.status === "ok"
  );

  // 2. SPA served by the same origin (DEPLOYMENT.md §2 — one service)
  try {
    const res = await fetch(base);
    const html = await res.text();
    const ok = res.status === 200 && html.includes('<div id="root">');
    report("SPA served at /", ok, `HTTP ${res.status}`);
  } catch (err) {
    report("SPA served at /", false, `request failed: ${err.message}`);
  }

  // 3. Unauthenticated API access is rejected with the registry envelope
  await checkJson("unauthenticated /api/v1 rejected", `${base}/api/v1/observations`, 401, (body) =>
    Boolean(body && body.error && typeof body.error.code === "string" && typeof body.error.message === "string")
  );

  // 4. Optional authenticated probe
  if (idToken) {
    await checkJson("authenticated /api/v1/me", `${base}/api/v1/me`, 200, (body) =>
      Boolean(body && body.data)
    );
  } else {
    console.log("– skipping authenticated check (no --token provided)");
  }

  console.log(failures === 0 ? "\nAll smoke checks passed." : `\n${failures} smoke check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
