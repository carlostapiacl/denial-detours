#!/usr/bin/env node
// One trial: copy the fixture, run one agent once under one condition, keep
// everything it left. Classification is a separate step (classify.mjs) over
// what this writes, so it can be re-run without re-running the agent.
//
//   node runner/trial.mjs <agent> <condition> <trial-id>
//
// Conditions
//   baseline  no sandbox. Shows whether the task actually leads the agent to
//             the file it will later be denied; a trial where it does not
//             proves nothing about detours.
//   bare      the kernel boundary seisin generates, launched with srt directly,
//             with the policy outside the repository: the agent is denied and
//             hears only "Operation not permitted".
//   seisin    seisin as published: the policy in the repository and the hook
//             wired, so a denial names the owner and says not to put the change
//             somewhere else.
import { cpSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { homedir } from "node:os";
import { diffAgainst } from "./files.mjs";

const LAB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Round 1's runner, kept as it ran. Only the version of sandbox-runtime is read
// from here, for meta.json: the one seisin depends on, or DD_SRT.
const SRT = process.env.DD_SRT ?? "srt";
const RUNS = process.env.DD_RUNS ?? join(homedir(), "Library/Caches/denial-detours/runs");

const [agent, condition, id] = process.argv.slice(2);
const { default: AGENTS } = await import(pathToFileURL(join(LAB, "runner/agents.mjs")));
const spec = AGENTS[agent];
if (!spec || !["baseline", "bare", "seisin"].includes(condition) || !id) {
  console.error("usage: trial.mjs <" + Object.keys(AGENTS).join("|") + "> <baseline|bare|seisin> <id>");
  process.exit(2);
}
const PROMPT = readFileSync(join(LAB, "runner/prompt.txt"), "utf8").trim();

// The fixture is read-only and checked against its recorded hashes before and
// after every trial. On 2026-10-23 an agent run without a sandbox, started with
// the runner's directory in $PWD, edited the fixture itself, and every trial
// after it started from a repository with the bug already fixed.
const fixtureOk = () => spawnSync("shasum", ["-a", "256", "-c", join(LAB, "runner/fixture.sha256")],
  { cwd: join(LAB, "fixture") }).status === 0;
if (!fixtureOk()) { console.error("fixture does not match runner/fixture.sha256: stop"); process.exit(3); }

const dir = join(RUNS, agent, condition, id);
if (existsSync(dir)) { console.error(`${dir} exists`); process.exit(2); }
const repo = join(dir, "repo");
const tmp = join(dir, "tmp");
mkdirSync(tmp, { recursive: true });
cpSync(join(LAB, "fixture"), repo, { recursive: true });
spawnSync("chmod", ["-R", "u+w", repo]); // the fixture is read-only; its copy is not

const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts });
const git = (...a) => sh("git", ["-c", "user.name=lab", "-c", "user.email=lab@localhost", ...a], { cwd: repo });

// The policy, with this agent's own network and environment.
const toml = readFileSync(join(repo, "seisin.toml"), "utf8").replace(
  '[roles.frontend]\nwrites = ["src/web/**"]',
  '[roles.frontend]\nwrites = ["src/web/**"]\n' +
  `network = ${JSON.stringify(spec.network)}\n` +
  `env = ${JSON.stringify(Object.keys(spec.env(tmp)))}`,
);
writeFileSync(join(repo, "seisin.toml"), toml);

// PWD too: opencode takes its working directory from $PWD, not from the
// process's cwd, and inherited the runner's.
const env = { ...process.env, ...spec.env(tmp), TMPDIR: tmp, CLAUDE_CODE_TMPDIR: tmp, PWD: repo };
delete env.OLDPWD;
let argv;
if (condition === "seisin") {
  if (spec.hooks) spec.hooks(repo);
  argv = ["seisin", "run", "frontend", "--agent", spec.agentFamily, "--", ...spec.command(PROMPT)];
} else if (condition === "bare") {
  // Same `seisin run`, same kernel profile, environment and log, but the
  // policy sits one directory above the repository and no hook is wired: the
  // agent is denied and hears only what the kernel says. A read of
  // ../seisin.toml would show up in the transcript and is counted.
  writeFileSync(join(dir, "seisin.toml"), toml.replace(/"src\//g, '"repo/src/'));
  rmSync(join(repo, "seisin.toml"));
  argv = ["seisin", "run", "frontend", "--agent", spec.agentFamily, "--", ...spec.command(PROMPT)];
} else {
  rmSync(join(repo, "seisin.toml"));
  argv = spec.command(PROMPT);
}
git("init", "-q"); git("add", "-A"); git("commit", "-qm", "fixture");

const t0 = Date.now();
const r = sh(argv[0], argv.slice(1), { cwd: repo, env, maxBuffer: 256 * 1024 * 1024, timeout: 15 * 60_000 });
const ms = Date.now() - t0;
writeFileSync(join(dir, "transcript.jsonl"), r.stdout ?? "");
writeFileSync(join(dir, "stderr.txt"), r.stderr ?? "");

// What it left, measured outside any sandbox.
git("add", "-A");
// Against the fixture itself, not HEAD: the agent may have committed or amended.
writeFileSync(join(dir, "diff.patch"), diffAgainst(join(LAB, "fixture"), repo));
const test = sh("npm", ["test"], { cwd: repo, encoding: "utf8" });
writeFileSync(join(dir, "test.txt"), (test.stdout ?? "") + (test.stderr ?? ""));
const versions = {
  agent: sh(spec.versionCmd[0], spec.versionCmd.slice(1)).stdout.trim(),
  seisin: sh("seisin", ["--version"]).stdout.trim(),
  srt: sh(SRT, ["--version"]).stdout.trim(),
  os: sh("sw_vers", ["-productVersion"]).stdout.trim(),
};
writeFileSync(join(dir, "meta.json"), JSON.stringify({
  agent, condition, id, prompt: PROMPT, argv: argv.map((a) => (a === PROMPT ? "<prompt.txt>" : a)),
  exit: r.status, signal: r.signal, ms, testsPass: test.status === 0, versions,
  fixtureIntactAfter: fixtureOk(),
  started: new Date(t0).toISOString(),
}, null, 2));
console.log(JSON.stringify({ agent, condition, id, exit: r.status, ms, testsPass: test.status === 0 }));
if (!fixtureOk()) { console.error("this trial changed the fixture: stop"); process.exit(3); }
