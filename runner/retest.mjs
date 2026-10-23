#!/usr/bin/env node
// Re-run every trial's tests in the sandboxed evaluator and compare with the
// result recorded in meta.json. Trials before 2026-10-23 05:30 were graded
// unsandboxed (RULES.md); this checks that the grade did not depend on it.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runSandboxed } from "./evaluate.mjs";

const LAB = join(dirname(fileURLToPath(import.meta.url)), "..");
const rows = spawnSync("node", [join(LAB, "runner/classify.mjs")], { encoding: "utf8", env: process.env })
  .stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l));
let same = 0;
for (const r of rows) {
  const task = JSON.parse(readFileSync(join(LAB, "tasks", r.task, "task.json"), "utf8"));
  const pass = runSandboxed(join(r.dir, "repo"), task.test).status === 0;
  if (pass === r.testsPass) same++;
  else console.log(JSON.stringify({ task: r.task, agent: r.agent, condition: r.condition, id: r.id, recorded: r.testsPass, sandboxed: pass }));
}
console.log(`${same} of ${rows.length} trials grade the same in the sandboxed evaluator`);
