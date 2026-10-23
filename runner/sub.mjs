// Another runner script's stdout, or a stop: a helper that fails must not hand
// its partial output to the next step.
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const RUNNER = dirname(fileURLToPath(import.meta.url));
export function runScript(script, args = [], env = process.env) {
  const r = spawnSync("node", [join(RUNNER, script), ...args], { encoding: "utf8", env, maxBuffer: 1 << 28 });
  if (r.status !== 0 || r.error) {
    console.error(`${script} failed (${r.error?.message ?? `exit ${r.status}`})`);
    if (r.stderr) console.error(r.stderr.trim().split("\n").slice(-5).join("\n"));
    process.exit(1);
  }
  return r.stdout;
}
export const jsonLines = (s) => s.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l));
