#!/usr/bin/env node
// Rebuild every published trial from what is public and grade it again:
// copy the fixture (checked against its hash), apply the trial's diff.patch,
// run the tests in the sandboxed evaluator, and compare with `testsPass` in
// the published classification. For every `compensated` trial, also apply the
// owner's fix and compare with the published counterfactual. Exits 1 on any
// difference, missing row or patch that does not apply. No agent is run.
//
//   node runner/replay.mjs round-1
import { readFileSync, existsSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runSandboxed } from "./evaluate.mjs";

const round = process.argv[2];
if (!round) { console.error("usage: replay.mjs <round>"); process.exit(2); }
const LAB = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(LAB, "results", round);
const jsonl = (f) => readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const key = (r) => `${r.task}/${r.agent}/${r.condition}/${r.id}`;
const rows = jsonl(join(OUT, "classification.jsonl"));
const cf = new Map(jsonl(join(OUT, "counterfactual.jsonl")).map((r) => [key(r), r.survivesOwnerFix]));

// Round 1 ran on fixture/; round 2 on tasks/<task>/repo. Each is checked
// against its recorded hashes before anything is built on it.
const fixtureOf = (task) => round === "round-1"
  ? { dir: join(LAB, "fixture"), sums: join(LAB, "runner/fixture.sha256") }
  : { dir: join(LAB, "tasks", task, "repo"), sums: join(LAB, "tasks", task, "fixture.sha256") };
const checked = new Map();
function fixture(task) {
  if (!checked.has(task)) {
    const f = fixtureOf(task);
    const ok = spawnSync("shasum", ["-a", "256", "-c", f.sums], { cwd: f.dir, encoding: "utf8" }).status === 0;
    if (!ok) { console.error(`${task}: fixture does not match its hashes`); process.exit(1); }
    checked.set(task, f.dir);
  }
  return checked.get(task);
}

const problems = [];
let graded = 0, replayed = 0;
for (const r of rows) {
  if (r.outcome === "error") continue; // timed out: no final state was graded
  const task = JSON.parse(readFileSync(join(LAB, "tasks", r.task, "task.json"), "utf8"));
  const patch = join(LAB, r.dir, "diff.patch");
  if (!existsSync(patch)) { problems.push(`${key(r)}: no diff.patch`); continue; }
  const work = mkdtempSync(join(tmpdir(), "dd-replay-"));
  try {
    const repo = join(work, "repo");
    cpSync(fixture(r.task), repo, { recursive: true });
    spawnSync("chmod", ["-R", "u+w", repo]);
    // git apply refuses paths outside the directory; the patch is untrusted.
    if (readFileSync(patch, "utf8").trim()) {
      const a = spawnSync("git", ["apply", "--whitespace=nowarn", patch], { cwd: repo, encoding: "utf8" });
      if (a.status !== 0) { problems.push(`${key(r)}: patch does not apply: ${a.stderr.trim().split("\n")[0]}`); continue; }
    }
    const pass = runSandboxed(repo, task.test).status === 0;
    graded++;
    if (pass !== r.testsPass) problems.push(`${key(r)}: tests ${pass ? "pass" : "fail"}, published ${r.testsPass}`);
    if (r.outcome === "compensated") {
      const survives = runSandboxed(repo, task.test, {
        prepare: (copy) => cpSync(join(LAB, "tasks", r.task, "owner-fix"), copy, { recursive: true }),
      }).status === 0;
      replayed++;
      if (!cf.has(key(r))) problems.push(`${key(r)}: no published counterfactual`);
      else if (cf.get(key(r)) !== survives) problems.push(`${key(r)}: survives the owner's fix ${survives}, published ${cf.get(key(r))}`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true }); // the copy made above
  }
}
const extra = [...cf.keys()].filter((k) => !rows.some((r) => key(r) === k && r.outcome === "compensated"));
for (const k of extra) problems.push(`${k}: counterfactual without a compensated row`);
console.log(`${graded} trials rebuilt and graded, ${replayed} counterfactuals replayed, ${problems.length} difference(s)`);
for (const p of problems) console.log(`  ${p}`);
process.exit(problems.length ? 1 : 0);
