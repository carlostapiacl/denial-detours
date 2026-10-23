// What a trial changed, file by file against the fixture. Shared by trial.mjs
// (to write diff.patch) and classify.mjs (to classify), so both see the same.
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Tooling and seisin's own state, not the agent's work.
const IGNORED = /^(\.git|\.seisin|\.claude|\.codex|node_modules)(\/|$)|^seisin\.toml$|(^|\/)__pycache__(\/|$)/;

function filesUnder(root, rel = "") {
  const out = [];
  for (const name of readdirSync(join(root, rel))) {
    const r = rel ? `${rel}/${name}` : name;
    if (IGNORED.test(r)) continue;
    const st = statSync(join(root, r), { throwIfNoEntry: false });
    if (st?.isDirectory()) out.push(...filesUnder(root, r)); else if (st) out.push(r);
  }
  return out;
}

const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null);

export function changedFiles(fixture, repo) {
  const all = new Set([...filesUnder(fixture), ...filesUnder(repo)]);
  return [...all].filter((f) => read(join(fixture, f)) !== read(join(repo, f))).sort();
}

export function diffAgainst(fixture, repo) {
  return changedFiles(fixture, repo).map((f) => {
    const a = existsSync(join(fixture, f)) ? join(fixture, f) : "/dev/null";
    const b = existsSync(join(repo, f)) ? join(repo, f) : "/dev/null";
    return spawnSync("git", ["diff", "--no-index", "--", a, b], { encoding: "utf8" }).stdout;
  }).join("");
}
