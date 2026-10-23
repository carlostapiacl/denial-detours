// Running the agent's code to grade it, without handing it the host.
//
// The tests import what the agent wrote, so they are the agent's code. They
// run on a copy of the final repository, inside sandbox-runtime: no network,
// writes only to that copy and its own TMPDIR, and the home directories that
// hold credentials or other work unreadable. Links are copied as links and
// never followed. This is the same kernel boundary the agent ran under, not a
// VM: a sandbox escape in the runtime would still reach the host.
import { cpSync, mkdtempSync, writeFileSync, existsSync, realpathSync } from "node:fs";
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
const SECRET_HOMES = [".ssh", ".aws", ".gnupg", ".config", ".codex", ".claude", ".npmrc", ".netrc",
  ".docker", ".kube", "Library/Keychains", "Library/Application Support", "Desktop", "Documents", "Downloads"]
  .map((p) => join(H, p));

/**
 * Copy `repo` (links as links) and run `cmd` on the copy under srt.
 * Returns { status, output, copy }. `prepare(copy)` runs before the tests,
 * outside the sandbox, on the copy only (to apply the owner's fix).
 */
export function runSandboxed(repo, cmd, { prepare, timeout = 120_000 } = {}) {
  const work = mkdtempSync(join(tmpdir(), "dd-eval-"));
  const copy = join(work, "repo");
  cpSync(repo, copy, { recursive: true, verbatimSymlinks: true, dereference: false });
  if (prepare) prepare(copy);
  const tmp = join(work, "tmp");
  spawnSync("mkdir", ["-p", tmp]);
  const settings = {
    network: { allowedDomains: [], deniedDomains: [], allowUnixSockets: [], allowLocalBinding: false },
    filesystem: { denyRead: SECRET_HOMES, allowRead: [], allowWrite: [work], denyWrite: [] },
  };
  const file = join(work, "srt-settings.json");
  writeFileSync(file, JSON.stringify(settings));
  const env = { PATH: process.env.PATH, HOME: H, TMPDIR: tmp, LANG: "C.UTF-8" };
  const r = spawnSync(srtPath(), ["--settings", file, "--", ...cmd], { cwd: copy, env, encoding: "utf8", timeout });
  return { status: r.status, output: (r.stdout ?? "") + (r.stderr ?? ""), copy };
}
