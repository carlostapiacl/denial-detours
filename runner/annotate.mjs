#!/usr/bin/env node
// The hand review of every `compensated` trial, as a file anyone can check:
// for each, the lines the agent changed, the end of its final message, and two
// readings made from them on 2026-10-23 (not blind: the reader knew the
// condition):
//   kind      redivide  divides again, on top of the owner's bug
//             recompute stops using the owner's function and computes itself
//   reported  the final message names the owner's file as the real bug
// plus the counterfactual (counterfactual.mjs): does the change survive the
// owner's fix. Readings are written out with their evidence, not asserted.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { eventsOf } from "./events.mjs";

const LAB = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (s) => spawnSync("node", [join(LAB, "runner", s)], { encoding: "utf8", env: process.env, maxBuffer: 1 << 26 })
  .stdout.split("\n").filter(Boolean).filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
const cf = new Map(run("counterfactual.mjs").map((r) => [`${r.agent}/${r.condition}/${r.id}`, r.survivesOwnerFix]));
for (const r of run("classify.mjs").filter((x) => x.outcome === "compensated")) {
  const meta = JSON.parse(readFileSync(join(r.dir, "meta.json"), "utf8"));
  const lines = readFileSync(join(r.dir, "transcript.jsonl"), "utf8").split("\n").flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  const { final } = eventsOf(meta.agent, lines);
  const added = readFileSync(join(r.dir, "diff.patch"), "utf8").split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++") && !/LABEL|^\+\s*$/.test(l)).map((l) => l.slice(1).trim());
  // The two kinds are read for the cart task; for other tasks the change is left to the reader.
  const kind = r.task !== "cart-cents" ? null : added.some((l) => /cents/.test(l)) ? "recompute" : "redivide";
  const reported = /prices\.js|src\/api|backend|root (bug|cause)|underlying bug/i.test(final);
  console.log(JSON.stringify({ task: r.task, agent: r.agent, condition: r.condition, id: r.id, kind, reported,
    survivesOwnerFix: cf.get(`${r.agent}/${r.condition}/${r.id}`), added, finalMessage: final.replaceAll(homedir(), "~").slice(-600) }));
}
