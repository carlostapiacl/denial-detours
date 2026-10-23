// What a trial changed, file by file against the fixture. Shared by trial.mjs
// (to write diff.patch) and classify.mjs (to classify), so both see the same.
import { readFileSync, readdirSync, existsSync, lstatSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Tooling and seisin's own state, not the agent's work.
const IGNORED = /^(\.git|\.seisin|\.claude|\.codex|node_modules)(\/|$)|^seisin\.toml$|(^|\/)__pycache__(\/|$)/;

// The tree is the agent's output, so it is untrusted: links are never followed
// (lstat, not stat). A link is a change in itself, compared by where it points,
// and its target is never read. Depth and file count are capped.
const MAX_DEPTH = 12, MAX_FILES = 5000;
function filesUnder(root, rel = "", depth = 0, out = []) {
  if (depth > MAX_DEPTH || out.length > MAX_FILES) throw new Error(`${root}: tree too deep or too large`);
  for (const name of readdirSync(join(root, rel))) {
    const r = rel ? `${rel}/${name}` : name;
    if (IGNORED.test(r)) continue;
    const st = lstatSync(join(root, r), { throwIfNoEntry: false });
    if (!st) continue;
    if (st.isDirectory()) filesUnder(root, r, depth + 1, out);
    else if (st.isFile() || st.isSymbolicLink()) out.push(r);
  }
  return out;
}

// A file's content, or `symlink -> target` for a link; null when absent.
const read = (p) => {
  const st = lstatSync(p, { throwIfNoEntry: false });
  if (!st) return null;
  if (st.isSymbolicLink()) return `symlink -> ${readlinkSync(p)}`;
  return readFileSync(p, "utf8");
};

export function changedFiles(fixture, repo) {
  const all = new Set([...filesUnder(fixture), ...filesUnder(repo)]);
  return [...all].filter((f) => read(join(fixture, f)) !== read(join(repo, f))).sort();
}

export function diffAgainst(fixture, repo) {
  return changedFiles(fixture, repo).map((f) => {
    const link = (p) => lstatSync(p, { throwIfNoEntry: false })?.isSymbolicLink();
    if (link(join(repo, f)) || link(join(fixture, f)))
      return `link ${f}: ${read(join(fixture, f)) ?? "(none)"} => ${read(join(repo, f)) ?? "(none)"}\n`;
    const a = existsSync(join(fixture, f)) ? join(fixture, f) : "/dev/null";
    const b = existsSync(join(repo, f)) ? join(repo, f) : "/dev/null";
    return spawnSync("git", ["diff", "--no-index", "--", a, b], { encoding: "utf8" }).stdout;
  }).join("");
}
