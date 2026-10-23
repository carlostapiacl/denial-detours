// How each agent is started, what it needs to reach, and how to ask its version.
// Every run starts from a clean configuration: no user-level instructions or
// memory, so what the agent knows about the repository is what the repository
// and the denial tell it.
//
// `hooks` is where seisin's hook is installed for the "seisin" condition, or
// null for an agent that has no hooks (opencode): there the owner reaches the
// agent only through the policy file in the repository.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// `extra`, when given, is a sentence added at session start by one more hook
// (the seisin-nocomp condition of round 2), as additional context.
const sessionNote = (extra) => ({ type: "command", command: "printf '%s' '" + JSON.stringify(
  { hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: extra } }) + "'" });
const wireClaude = (repo, extra = null) => {
  const r = spawnSync("seisin", ["wire"], { cwd: repo, encoding: "utf8" });
  if (r.status !== 0) throw new Error("seisin wire: " + r.stderr);
  if (extra) {
    const p = join(repo, ".claude/settings.json");
    const s = JSON.parse(readFileSync(p, "utf8"));
    s.hooks.SessionStart[0].hooks.push(sessionNote(extra));
    writeFileSync(p, JSON.stringify(s, null, 2));
  }
};
// Codex reads the same hook protocol from .codex/hooks.json; seisin's hook
// already parses Codex's events (src/hook.js). Same events seisin wire installs.
const wireCodex = (repo, extra = null) => {
  wireClaude(repo, extra);
  const claude = JSON.parse(readFileSync(join(repo, ".claude/settings.json"), "utf8"));
  mkdirSync(join(repo, ".codex"), { recursive: true });
  writeFileSync(join(repo, ".codex/hooks.json"), JSON.stringify({ hooks: claude.hooks }, null, 2));
};

export default {
  claude: {
    agentFamily: "claude",
    hooks: wireClaude,
    network: ["api.anthropic.com", "statsig.anthropic.com"],
    env: () => ({ CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1", CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" }),
    command: (prompt) => ["claude", "-p", prompt, "--output-format", "stream-json", "--verbose",
      "--permission-mode", "bypassPermissions", "--setting-sources", "project,local"],
    versionCmd: ["claude", "--version"],
  },
  codex: {
    agentFamily: "codex",
    hooks: wireCodex,
    network: ["chatgpt.com", "ab.chatgpt.com"],
    env: () => ({}),
    command: (prompt) => ["codex", "exec", "--json", "-s", "danger-full-access", "--ignore-user-config",
      "--ignore-rules", "--ephemeral", "--skip-git-repo-check", "--dangerously-bypass-hook-trust",
      "-m", "gpt-5.6-sol", "-c", "model_reasoning_effort=\"low\"", prompt],
    versionCmd: ["codex", "--version"],
  },
  opencode: {
    agentFamily: "none",
    hooks: null,
    network: ["opencode.ai", "*.opencode.ai"],
    // opencode also reads Claude Code's ~/.claude/CLAUDE.md and skills unless told not to.
    env: (tmp) => ({ OPENCODE_DISABLE_CLAUDE_CODE: "1", XDG_CONFIG_HOME: join(tmp, "xdg-config"), XDG_DATA_HOME: join(tmp, "xdg-data"),
      XDG_STATE_HOME: join(tmp, "xdg-state"), XDG_CACHE_HOME: join(tmp, "xdg-cache") }),
    command: (prompt) => ["opencode", "run", "--pure", "--auto", "--format", "json", "-m", "opencode/big-pickle", prompt],
    versionCmd: ["opencode", "--version"],
  },
};
