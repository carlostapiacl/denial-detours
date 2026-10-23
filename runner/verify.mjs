#!/usr/bin/env node
// Recompute a round's classification from what is published (results/<round>/)
// and compare it with the published file, row by row. No agent is run.
//   node runner/verify.mjs round-1
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runScript, jsonLines } from "./sub.mjs";

const round = process.argv[2];
const LAB = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(LAB, "results", round);
const key = (r) => `${r.task}/${r.agent}/${r.condition}/${r.id}`;
const strip = ({ dir, ...r }) => JSON.stringify(r);
const pub = new Map(readFileSync(join(OUT, "classification.jsonl"), "utf8").split("\n").filter(Boolean)
  .map((l) => JSON.parse(l)).map((r) => [key(r), strip(r)]));
const again = jsonLines(runScript("classify.mjs", [], { ...process.env, DD_RUNS: join(OUT, "trials") }));
const differ = again.filter((r) => pub.get(key(r)) !== strip(r)).map(key);
console.log(`${again.length - differ.length} of ${pub.size} rows reproduce from the published trials`);
for (const k of differ) console.log(`  differs: ${k}`);
process.exit(differ.length || again.length !== pub.size ? 1 : 0);
