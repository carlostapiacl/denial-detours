#!/usr/bin/env node
// One trial as text: each tool call, its result, and the final message.
//   node runner/narrate.mjs <trial dir>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { eventsOf } from "./events.mjs";

const dir = process.argv[2];
const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8"));
const lines = readFileSync(join(dir, "transcript.jsonl"), "utf8").split("\n")
  .flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
const { ev, usage, final } = eventsOf(meta.agent, lines);
const clean = (s, n) => String(s ?? "").replaceAll(homedir(), "~").replace(/\s+/g, " ").slice(0, n);
for (const e of ev) {
  console.log(`${e.kind.padEnd(5)} ${clean(e.kind === "shell" ? e.text : e.target, 220)}`);
  if (e.result) console.log(`   -> ${clean(e.result, 200)}`);
}
console.log(`final: ${clean(final, 600)}`);
console.log(`tokens: ${JSON.stringify(usage)} · tests ${meta.testsPass ? "pass" : "fail"}`);
