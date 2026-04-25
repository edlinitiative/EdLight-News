#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function findRepoRoot(startDir = process.cwd()) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 10; i++) {
    if (existsSync(path.join(dir, ".github", "workflows", "deploy-worker.yml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(startDir);
}

const ROOT = findRepoRoot();

function read(relPath) {
  const abs = path.join(ROOT, relPath);
  return readFileSync(abs, "utf8");
}

function assertIncludes(haystack, needle, context) {
  if (!haystack.includes(needle)) {
    throw new Error(`[guardrail] Missing required snippet in ${context}: ${needle}`);
  }
}

function main() {
  const deployWorkflowPath = ".github/workflows/deploy-worker.yml";
  const tickPath = "apps/worker/src/routes/tick.ts";
  const generatePath = "apps/worker/src/services/generate.ts";

  const deployWorkflow = read(deployWorkflowPath);
  const tick = read(tickPath);
  const generate = read(generatePath);

  // ── Scheduler invocation IAM guard ───────────────────────────────────────
  // Protects against regressions where Scheduler no longer has run.invoker,
  // which leads to silent 403 / status code 13 scheduler attempts.
  assertIncludes(deployWorkflow, "Grant invoker to Scheduler SA", deployWorkflowPath);
  assertIncludes(deployWorkflow, "serviceAccount:$SCHEDULER_SA", deployWorkflowPath);
  assertIncludes(deployWorkflow, "roles/run.invoker", deployWorkflowPath);

  // ── Tick resiliency telemetry guard ──────────────────────────────────────
  // Ensures /tick keeps per-step health status diagnostics.
  assertIncludes(tick, "const stepStatus", tickPath);
  assertIncludes(tick, "const markStep", tickPath);
  assertIncludes(tick, "markStep(\"ingest\"", tickPath);
  assertIncludes(tick, "markStep(\"generate\"", tickPath);
  assertIncludes(tick, "markStep(\"facebook\"", tickPath);
  assertIncludes(tick, "stepStatus,", tickPath);

  // ── Generate fail-soft backlog guard ─────────────────────────────────────
  // Ensures opportunites backlog query failure cannot abort the generate step.
  assertIncludes(generate, "let oppBacklog", generatePath);
  assertIncludes(generate, "opportunity backlog query failed", generatePath);

  console.log("[guardrail] Pipeline guardrails validated ✅");
}

main();
