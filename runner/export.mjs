#!/usr/bin/env node
// Copy a round's trials into results/<round>/ for publishing: transcript, diff,
// test output, stderr and meta, plus the classification and the summary. The
// home directory becomes `~`, and the copy is refused if anything that looks
// like an email address, a token or a key is left in it.
//
//   node runner/export.mjs <round>
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync, mkdtempSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const round = process.argv[2];
if (!round) { console.error("usage: export.mjs <round>"); process.exit(2); }
const LAB = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS = process.env.DD_RUNS ?? join(homedir(), "Library/Caches/denial-detours/runs");
// Built in a staging directory next to results/<round> (same file system, so
// the final step is a rename), checked whole, and only then promoted: a refused
// or failed export leaves results/ as it was. The staging directory is
// private (mkdtemp, 0700) and ignored by git. A previous export of the same
// round is moved aside, not deleted.
const FINAL = join(LAB, "results", round);
mkdirSync(dirname(FINAL), { recursive: true });
const OUT = mkdtempSync(join(LAB, "results", `.staging-${round}-`));
const FILES = ["transcript.jsonl", "diff.patch", "test.txt", "stderr.txt", "meta.json"];
const LEAK = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}|sk-[A-Za-z0-9_-]{16,}|ghp_[A-Za-z0-9]{20,}|xox[bap]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{30,}\.|-----BEGIN [A-Z ]*PRIVATE KEY/;
// Addresses that are part of the work, not of anyone: git's fixture identity and the
// made-up addresses of the email-validate task.
const ALLOWED = new Set(["lab@localhost", "local@domain.tld", "ana+tienda@correo.cl"]);
// Whatever names the machine is replaced, not just the home directory: the
// lab's and seisin's own folders, and each run's proxy credentials (random,
// valid only on localhost for that run, but credentials all the same). Diffs
// are made relative to the fixture and the trial's repository.
const LAB_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const scrub = (s) => s
  .replace(/(?<=^|\s)([ab])\/Users\/[^\s]*?\/(?:tasks\/[^/\s]+\/repo|fixture|repo)\//gm, "$1/")
  .replaceAll(LAB_DIR, "<lab>")
  .replaceAll(homedir(), "~")
  .replace(/~\/[^\s"'\\]*?\/seisin\/seisin/g, "<seisin>")
  .replace(/~\/Desktop\/[^\s"'\\]*/g, "<private>")
  .replace(/srt\.[A-Za-z0-9%=._-]+:[0-9a-f]{16,}@/g, "<proxy-credentials>@")
  .replace(/(PASSWORD=|USERNAME=)[^\s"\\]+/g, "$1<redacted>")
  .replace(/Proxy-Authorization: Basic [A-Za-z0-9+/=]+/g, "Proxy-Authorization: Basic <redacted>")
  // The account's claude.ai connectors are listed in each session's init
  // event; they are not part of the trial and say what else the account uses.
  .replace(/\{"name":"claude\.ai [^"]*","status":"[^"]*","source":"claudeai"\},/g, "")
  .replace(/,?\{"name":"claude\.ai [^"]*","status":"[^"]*","source":"claudeai"\}/g, "")
  .replace(/"mcp__claude_ai_[A-Za-z0-9_-]+",/g, "")
  .replace(/,?"mcp__claude_ai_[A-Za-z0-9_-]+"/g, "");

let n = 0;
const problems = [];
// Every trial directory at any depth (round 1: agent/condition/id; round 2:
// task/agent/condition/id), copied to the same relative path.
const trials = [];
(function walk(d) {
  if (existsSync(join(d, "meta.json"))) { trials.push(d); return; }
  for (const x of readdirSync(d)) if (statSync(join(d, x)).isDirectory() && x !== "repo" && x !== "tmp") walk(join(d, x));
})(RUNS);
for (const src of trials) {
  {
    const dst = join(OUT, "trials", src.slice(RUNS.length + 1));
    const [agent, cond, id] = src.slice(RUNS.length + 1).split("/").slice(-3);
    mkdirSync(dst, { recursive: true });
    // The kernel's refused operations for this run, from seisin's log: time,
    // action and target, so the denial counts can be recomputed from here.
    for (const log of [join(src, ".seisin", "log.jsonl"), join(src, "repo", ".seisin", "log.jsonl")]) {
      if (!existsSync(log)) continue;
      const events = readFileSync(log, "utf8").split("\n").flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } })
        .filter((e) => e.source === "kernel" && e.verdict === "denied")
        .map((e) => JSON.stringify({ at: e.at, run: e.run, action: e.action, kind: e.kind, target: e.target, verdict: e.verdict, source: e.source }));
      writeFileSync(join(dst, "kernel.jsonl"), scrub(events.join("\n") + (events.length ? "\n" : "")));
      break;
    }
    for (const f of FILES) {
      if (!existsSync(join(src, f))) continue;
      const text = scrub(readFileSync(join(src, f), "utf8"));
      for (const m of text.matchAll(new RegExp(LEAK, "g")))
        if (!ALLOWED.has(m[0])) problems.push(`${agent}/${cond}/${id}/${f}: ${m[0].slice(0, 12)}…`);
      writeFileSync(join(dst, f), text);
    }
    n++;
  }
}
// kernel.jsonl and the generated files are checked with the rest.
function checkTree(d) {
  for (const x of readdirSync(d)) {
    const p = join(d, x);
    if (statSync(p).isDirectory()) { checkTree(p); continue; }
    const text = readFileSync(p, "utf8");
    for (const m of text.matchAll(new RegExp(LEAK, "g"))) if (!ALLOWED.has(m[0])) problems.push(`${p.slice(OUT.length + 1)}: ${m[0].slice(0, 12)}…`);
    if (/\/Users\/|Desktop\/proyectos|01-activos/.test(text)) problems.push(`${p.slice(OUT.length + 1)}: a private path`);
  }
}
function refuseIfProblems() {
  if (!problems.length) return;
  console.error(`refused: ${problems.length} possible leak(s); nothing was written to results/. Staging left in ${OUT}`);
  for (const p of [...new Set(problems)].slice(0, 20)) console.error("  " + p);
  process.exit(1);
}
refuseIfProblems();
// A helper that fails stops the export: its partial output is never published.
function node(script, ...args) {
  const r = spawnSync("node", [join(LAB, "runner", script), ...args], { encoding: "utf8", env: process.env, maxBuffer: 1 << 28 });
  if (r.status !== 0 || r.error) {
    console.error(`refused: ${script} failed (${r.error?.message ?? `exit ${r.status}`}); nothing was written to results/. Staging left in ${OUT}`);
    if (r.stderr) console.error(r.stderr.trim().split("\n").slice(-5).join("\n"));
    process.exit(1);
  }
  return r.stdout;
}
const [rows, summary] = node("classify.mjs", "--summary").split("\n\n");
// The trial directory is the machine's; the published path stands in for it.
const published = rows.split("\n").filter(Boolean).map((l) => {
  const r = JSON.parse(l); r.dir = join("results", round, "trials", r.dir.slice(RUNS.length + 1)); return JSON.stringify(r);
}).join("\n");
writeFileSync(join(OUT, "classification.jsonl"), scrub(published) + "\n");
writeFileSync(join(OUT, "summary.tsv"), summary);
writeFileSync(join(OUT, "counterfactual.jsonl"), scrub(node("counterfactual.mjs")));
writeFileSync(join(OUT, "annotations.jsonl"), scrub(node("annotate.mjs")));
writeFileSync(join(OUT, "stats.md"), node("stats.mjs", join(OUT, "classification.jsonl")));
// The files must agree with each other and with the trials: one row per trial,
// no key twice, and one annotation and one counterfactual per compensation.
const jsonl = (f) => readFileSync(join(OUT, f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const key = (r) => `${r.task}/${r.agent}/${r.condition}/${r.id}`;
const cls = jsonl("classification.jsonl");
const comp = new Set(cls.filter((r) => r.outcome === "compensated").map(key));
if (cls.length !== n) problems.push(`classification.jsonl: ${cls.length} rows for ${n} trials`);
if (new Set(cls.map(key)).size !== cls.length) problems.push("classification.jsonl: a key appears twice");
for (const f of ["annotations.jsonl", "counterfactual.jsonl"]) {
  const keys = jsonl(f).map(key);
  if (keys.length !== comp.size || new Set(keys).size !== keys.length || keys.some((k) => !comp.has(k)))
    problems.push(`${f}: ${keys.length} rows do not match the ${comp.size} compensated trials`);
}
if (!/\|/.test(readFileSync(join(OUT, "stats.md"), "utf8"))) problems.push("stats.md: no table");
checkTree(OUT);
refuseIfProblems();
// Promotion: two renames on one file system. If the second fails, the first
// is undone, so results/<round> is either the old export or the new one.
let previous = null;
if (existsSync(FINAL)) {
  previous = join(LAB, "results", `.previous-${round}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  renameSync(FINAL, previous);
}
try {
  renameSync(OUT, FINAL);
} catch (e) {
  if (previous) renameSync(previous, FINAL);
  console.error(`refused: could not promote ${OUT} (${e.message}); results/${round} left as it was`);
  process.exit(1);
}
console.log(`${n} trials → ${FINAL}${previous ? ` (previous export in ${previous})` : ""}`);
