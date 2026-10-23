// Every agent's transcript in one shape, so the same rules read all three.
// One shape for every agent: [{ kind: "edit"|"shell"|"read", target, text, result }]
export function eventsOf(agent, lines) {
  const ev = [];
  const usage = { input: 0, cached: 0, output: 0 };
  let final = "";
  if (agent === "claude") {
    const pending = new Map();
    for (const d of lines) {
      if (d.type === "assistant") for (const c of d.message.content ?? []) {
        if (c.type === "tool_use") {
          const i = c.input ?? {};
          const e = c.name === "Bash" ? { kind: "shell", text: i.command ?? "" }
            : ["Edit", "Write", "MultiEdit", "NotebookEdit"].includes(c.name) ? { kind: "edit", target: i.file_path ?? "", text: "" }
            : { kind: "read", target: i.file_path ?? i.path ?? i.pattern ?? "", text: JSON.stringify(i) };
          ev.push(e); pending.set(c.id, e);
        }
        if (c.type === "text") final = c.text;
      }
      if (d.type === "user" && Array.isArray(d.message.content)) for (const c of d.message.content)
        if (c.type === "tool_result" && pending.has(c.tool_use_id))
          pending.get(c.tool_use_id).result = typeof c.content === "string" ? c.content : JSON.stringify(c.content);
      if (d.type === "result" && d.usage) {
        usage.input += (d.usage.input_tokens ?? 0) + (d.usage.cache_creation_input_tokens ?? 0);
        usage.cached += d.usage.cache_read_input_tokens ?? 0;
        usage.output += d.usage.output_tokens ?? 0;
      }
    }
  } else if (agent === "codex") {
    for (const d of lines) {
      const it = d.item ?? {};
      if (d.type === "item.completed" && it.type === "command_execution")
        ev.push({ kind: "shell", text: it.command ?? "", result: `${it.aggregated_output ?? ""} exit ${it.exit_code}` });
      if (d.type === "item.completed" && it.type === "file_change")
        for (const ch of it.changes ?? []) ev.push({ kind: "edit", target: ch.path ?? "", text: "", result: it.status === "completed" ? "" : `failed ${JSON.stringify(it)}` });
      if (d.type === "item.completed" && it.type === "agent_message") final = it.text ?? "";
      if (d.type === "turn.completed" && d.usage) {
        usage.input += (d.usage.input_tokens ?? 0) - (d.usage.cached_input_tokens ?? 0);
        usage.cached += d.usage.cached_input_tokens ?? 0;
        // output_tokens already includes the reasoning tokens; adding
        // reasoning_output_tokens again counted them twice (fixed 2026-10-23).
        usage.output += d.usage.output_tokens ?? 0;
      }
    }
  } else if (agent === "opencode") {
    for (const d of lines) {
      const p = d.part ?? {};
      if (d.type === "tool_use" && p.state) {
        const i = p.state.input ?? {}, out = `${p.state.output ?? ""}${p.state.error ?? ""}`;
        if (p.tool === "bash") ev.push({ kind: "shell", text: i.command ?? "", result: out });
        else if (["edit", "write", "patch", "multiedit"].includes(p.tool)) ev.push({ kind: "edit", target: i.filePath ?? i.path ?? "", text: "", result: out });
        else ev.push({ kind: "read", target: i.filePath ?? i.path ?? i.pattern ?? "", text: JSON.stringify(i), result: out });
      }
      if (d.type === "text" && p.text) final = p.text;
      if (d.type === "step_finish" && p.tokens) {
        usage.input += p.tokens.input ?? 0;
        usage.cached += p.tokens.cache?.read ?? 0;
        usage.output += (p.tokens.output ?? 0) + (p.tokens.reasoning ?? 0);
      }
    }
  }
  return { ev, usage, final };
}

