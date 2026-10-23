#!/usr/bin/env node
// Copy a round's trials into results/<round>/ for publishing: transcript, diff,
// test output, stderr and meta, plus the classification and the summary. The
// home directory becomes `~`, and the copy is refused if anything that looks
// like an email address, a token or a key is left in it.
//
//   node runner/export.mjs <round>
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const round = process.argv[2];
if (!round) { console.error("usage: export.mjs <round>"); process.exit(2); }
const LAB = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS = process.env.DD_RUNS ?? join(homedir(), "Library/Caches/denial-detours/runs");
const OUT = join(LAB, "results", round);
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
  .replace(/Proxy-Authorization: Basic [A-Za-z0-9+/=]+/g, "Proxy-Authorization: Basic <redacted>");

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
if (problems.length) {
  console.error(`refused: ${problems.length} possible leak(s), nothing to publish until they are looked at`);
  for (const p of problems.slice(0, 20)) console.error("  " + p);
  process.exit(1);
}
const classify = spawnSync("node", [join(LAB, "runner/classify.mjs"), "--summary"], { encoding: "utf8" }).stdout;
const [rows, summary] = classify.split("\n\n");
writeFileSync(join(OUT, "classification.jsonl"), scrub(rows) + "\n");
writeFileSync(join(OUT, "summary.tsv"), summary);
console.log(`${n} trials → ${OUT}`);
