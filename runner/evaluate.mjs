// Running the agent's code to grade it, without handing it the host.
//
// The tests import what the agent wrote, so they are the agent's code. They
// run on a copy of the final repository, inside sandbox-runtime: no network,
// writes only to that copy and its own TMPDIR, and the home directories that
// hold credentials or other work unreadable. Links are copied as links and
// never followed. This is the same kernel boundary the agent ran under, not a
// VM: a sandbox escape in the runtime would still reach the host.
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, existsSync, realpathSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir, tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

// The srt that seisin depends on: next to the `seisin` on PATH.
export function srtPath() {
  if (process.env.DD_SRT) return process.env.DD_SRT;
  const which = spawnSync("sh", ["-c", "command -v seisin"], { encoding: "utf8" }).stdout.trim();
  if (which) {
    const pkg = dirname(dirname(realpathSync(which)));
    for (const p of [join(pkg, "node_modules/.bin/srt"), join(dirname(dirname(pkg)), ".bin/srt")])
      if (existsSync(p)) return p;
  }
  return "srt";
}

const H = homedir();
// Reads are denied by default where they matter: the whole home directory, the
// shared temp roots and mounted volumes. What the tests need is opened back: the
// copy itself, and the Node install running them when it lives in the home
// (nvm). Everything else a test could reach is system files.
const DENY_READ = [H, "/private/tmp", "/tmp", "/Volumes"];
const NODE_PREFIX = dirname(dirname(process.execPath));
const MAX_BYTES = 50 * 1024 * 1024;

function sizeOf(dir) {
  const out = spawnSync("du", ["-sk", dir], { encoding: "utf8" }).stdout;
  return Number(out.split(/\s/)[0] || 0) * 1024;
}

/**
 * Copy `repo` (links as links) and run `cmd` on the copy under srt, then
 * remove the copy. Returns { status, output }. `prepare(copy)` runs before the tests,
 * outside the sandbox, on the copy only (to apply the owner's fix).
 */
export function runSandboxed(repo, cmd, { prepare, timeout = 120_000 } = {}) {
  if (sizeOf(repo) > MAX_BYTES) return { status: null, output: `refused: ${repo} is over ${MAX_BYTES} bytes` };
  const work = mkdtempSync(join(tmpdir(), "dd-eval-"));
  try {
    const copy = join(work, "repo");
    cpSync(repo, copy, { recursive: true, verbatimSymlinks: true, dereference: false });
    if (prepare) prepare(copy);
    const tmp = join(work, "tmp");
    mkdirSync(tmp);
    const allowRead = [work, ...(NODE_PREFIX.startsWith(H + "/") ? [NODE_PREFIX] : [])];
    const settings = {
      network: { allowedDomains: [], deniedDomains: [], allowUnixSockets: [], allowLocalBinding: false },
      filesystem: { denyRead: DENY_READ, allowRead, allowWrite: [work], denyWrite: [] },
    };
    const file = join(work, "srt-settings.json");
    writeFileSync(file, JSON.stringify(settings));
    const env = { PATH: process.env.PATH, HOME: tmp, TMPDIR: tmp, LANG: "C.UTF-8" };
    const r = spawnSync(srtPath(), ["--settings", file, "--", ...cmd], { cwd: copy, env, encoding: "utf8", timeout });
    return { status: r.status, output: (r.stdout ?? "") + (r.stderr ?? "") };
  } finally {
    // The copy is the evaluator's own scratch, made above; nothing else is removed.
    rmSync(work, { recursive: true, force: true });
  }
}
