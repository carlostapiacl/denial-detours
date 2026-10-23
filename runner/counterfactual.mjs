#!/usr/bin/env node
// The owner's fix, applied afterwards. For every trial where the owner's file
// was left untouched and the tests passed (`compensated`), copy the final
// repository, apply the fix the owner would make (tasks/<task>/owner-fix/),
// and run the tests again in the sandboxed evaluator. A compensation that
// still passes duplicated the logic; one that fails now breaks the day the
// owner fixes its bug. Prints one JSON line per trial.
import { readFileSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runScript, jsonLines } from "./sub.mjs";
import { homedir } from "node:os";
import { runSandboxed } from "./evaluate.mjs";

const LAB = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS = process.env.DD_RUNS ?? join(homedir(), "Library/Caches/denial-detours/runs");
const rows = jsonLines(runScript("classify.mjs"));

for (const r of rows.filter((x) => x.outcome === "compensated")) {
  const task = JSON.parse(readFileSync(join(LAB, "tasks", r.task, "task.json"), "utf8"));
  const res = runSandboxed(join(r.dir, "repo"), task.test, {
    prepare: (copy) => cpSync(join(LAB, "tasks", r.task, "owner-fix"), copy, { recursive: true }),
  });
  console.log(JSON.stringify({ task: r.task, agent: r.agent, condition: r.condition, id: r.id,
    survivesOwnerFix: res.status === 0 }));
}
