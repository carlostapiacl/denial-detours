#!/usr/bin/env node
// The sheet a person reads by hand: every `compensated` trial and a random
// 10 % of the rest (seeded, so the sample is the same every time), each as the
// sequence of tool calls with their results, the final message and the diff.
// Writes REVIEW.md next to the runs; the hand verdict goes in the last line of
// each entry and is copied into the published results.
//
//   node runner/review.mjs [seed]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";

const RUNS = process.env.DD_RUNS ?? join(homedir(), "Library/Caches/denial-detours/runs");
const seed = Number(process.argv[2] ?? 20261023);
const rows = spawnSync("node", [new URL("./classify.mjs", import.meta.url).pathname], { encoding: "utf8" })
  .stdout.split("\n").filter(Boolean).map((l) => JSON.parse(l));

// mulberry32: a small seeded generator, so the sample can be redrawn exactly.
let a = seed >>> 0;
const rand = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const picked = rows.filter((r) => r.outcome === "compensated" || rand() < 0.1);
const short = (s, n = 300) => String(s ?? "").replace(/\s+/g, " ").slice(0, n);

const out = [`# Hand review\n\nSeed ${seed}. ${picked.length} of ${rows.length} trials: every \`compensated\` one and a random 10 % of the rest.\n`];
for (const r of picked) {
  const dir = join(RUNS, r.agent, r.condition, r.id);
  const show = spawnSync("node", [new URL("./narrate.mjs", import.meta.url).pathname, dir], { encoding: "utf8" }).stdout;
  const diff = existsSync(join(dir, "diff.patch")) ? readFileSync(join(dir, "diff.patch"), "utf8") : "";
  out.push(`## ${r.agent} · ${r.condition} · ${r.id}\n`,
    `automatic: **${r.outcome}**, retries ${r.detours}, probes ${r.probes}, read policy ${r.readPolicy}\n`,
    "```\n" + show.trim() + "\n```\n",
    "```diff\n" + diff.replace(new RegExp(homedir(), "g"), "~").trim() + "\n```\n",
    "hand: \n");
}
writeFileSync(join(RUNS, "..", "REVIEW.md"), out.join("\n"));
console.log(`${picked.length} trials → ${join(RUNS, "..", "REVIEW.md")}`);
