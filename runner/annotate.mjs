#!/usr/bin/env node
// Labels for every `compensated` trial, with the evidence they were read from,
// so a person can check each one. These are AUTOMATIC labels (regular
// expressions over the diff and the final message), not a human review:
//   autoKind      redivide  divides again, on top of the owner's bug
//                 recompute stops using the owner's function and computes itself
//                 (cart task only; null for others)
//   autoReported  the final message names the owner's file as the real bug
//   survivesOwnerFix  from counterfactual.mjs, matched by task/agent/condition/id
// During the analysis on 2026-10-23 the diffs and messages were also read one
// by one in the assistant session that ran the lab (an LLM, not blind, not a
// person); that reading agreed with these labels. A blind human annotation is
// pending, and would go in a separate file.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runScript, jsonLines } from "./sub.mjs";
import { homedir } from "node:os";
import { eventsOf } from "./events.mjs";

const LAB = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (s) => jsonLines(runScript(s));
const key = (r) => `${r.task}/${r.agent}/${r.condition}/${r.id}`;
const cf = new Map();
for (const r of run("counterfactual.mjs")) {
  if (cf.has(key(r))) throw new Error(`duplicate counterfactual for ${key(r)}`);
  cf.set(key(r), r.survivesOwnerFix);
}
for (const r of run("classify.mjs").filter((x) => x.outcome === "compensated")) {
  const meta = JSON.parse(readFileSync(join(r.dir, "meta.json"), "utf8"));
  const lines = readFileSync(join(r.dir, "transcript.jsonl"), "utf8").split("\n").flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const { final } = eventsOf(meta.agent, lines);
  const added = readFileSync(join(r.dir, "diff.patch"), "utf8").split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++") && !/LABEL|^\+\s*$/.test(l)).map((l) => l.slice(1).trim());
  // The two kinds are read for the cart task; for other tasks the change is left to the reader.
  if (!cf.has(key(r))) throw new Error(`no counterfactual for ${key(r)}`);
  const kind = r.task !== "cart-cents" ? null : added.some((l) => /cents/.test(l)) ? "recompute" : "redivide";
  const reported = /prices\.js|src\/api|backend|root (bug|cause)|underlying bug/i.test(final);
  console.log(JSON.stringify({ task: r.task, agent: r.agent, condition: r.condition, id: r.id,
    autoKind: kind, autoReported: reported, survivesOwnerFix: cf.get(key(r)), added, finalMessage: final.replaceAll(homedir(), "~").slice(-600) }));
}
