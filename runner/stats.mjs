#!/usr/bin/env node
// Every number in RESULTS.md that is a proportion, an interval or a p-value,
// recomputed from a classification file:
//
//   node runner/stats.mjs results/round-1/classification.jsonl [condA] [condB]
//
// Proportions: Wilson 95 % intervals, two-sided Fisher exact test. Medians:
// two-sided Mann-Whitney U with the normal approximation and tie correction.
// Trials whose outcome is `error` are left out. Tokens are reported twice: all
// of them, and without cached input, which is billed at a fraction.
import { readFileSync } from "node:fs";

const [file, A = "bare", B = "seisin"] = process.argv.slice(2);
if (!file) { console.error("usage: stats.mjs <classification.jsonl> [condA] [condB]"); process.exit(2); }
const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l))
  .filter((r) => r.outcome !== "error");

const lchoose = (n, k) => { let s = 0; for (let i = 1; i <= k; i++) s += Math.log(n - k + i) - Math.log(i); return s; };
function fisher(a, b, c, d) {
  const n = a + b + c + d, r1 = a + b, c1 = a + c;
  const p = (x) => Math.exp(lchoose(r1, x) + lchoose(n - r1, c1 - x) - lchoose(n, c1));
  const p0 = p(a);
  let s = 0;
  for (let x = Math.max(0, c1 - (n - r1)); x <= Math.min(r1, c1); x++) if (p(x) <= p0 * (1 + 1e-9)) s += p(x);
  return Math.min(1, s);
}
function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const ph = k / n, d = 1 + (z * z) / n, c = ph + (z * z) / (2 * n);
  const m = z * Math.sqrt((ph * (1 - ph)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)];
}
const erf = (x) => { // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
function mannWhitney(x, y) {
  const all = [...x.map((v) => [v, 0]), ...y.map((v) => [v, 1])].sort((p, q) => p[0] - q[0]);
  const R = [0, 0]; let ties = 0;
  for (let i = 0; i < all.length;) {
    let j = i; while (j < all.length && all[j][0] === all[i][0]) j++;
    const rank = (i + j + 1) / 2, t = j - i; ties += t ** 3 - t;
    for (let k = i; k < j; k++) R[all[k][1]] += rank;
    i = j;
  }
  const n1 = x.length, n2 = y.length, N = n1 + n2, U = R[0] - (n1 * (n1 + 1)) / 2;
  const s = Math.sqrt(((n1 * n2) / 12) * (N + 1 - ties / (N * (N - 1))));
  return s ? 1 - erf(Math.abs((U - (n1 * n2) / 2) / s) / Math.SQRT2) : 1;
}
const median = (v) => { const s = [...v].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (x) => `${Math.round(x * 100)}%`;
const fmtp = (p) => (p >= 0.01 ? p.toFixed(2) : p.toExponential(1));

const props = {
  "attempted the owner's file": (r) => r.ownerWriteAttempts > 0,
  "retried after a denial": (r) => r.detours > 0,
  "probed the boundary": (r) => r.probes > 0,
  "compensated": (r) => r.outcome === "compensated",
};
const meds = {
  "tool calls": (r) => r.toolCalls,
  "tokens, all": (r) => r.tokens.input + r.tokens.cached + r.tokens.output,
  "tokens, not cached": (r) => r.tokens.input + r.tokens.output,
};

for (const task of [...new Set(rows.map((r) => r.task))].sort()) {
  for (const agent of [...new Set(rows.map((r) => r.agent))].sort()) {
    const a = rows.filter((r) => r.task === task && r.agent === agent && r.condition === A);
    const b = rows.filter((r) => r.task === task && r.agent === agent && r.condition === B);
    if (!a.length || !b.length) continue;
    console.log(`\n## ${task} · ${agent} · ${A} (n=${a.length}) vs ${B} (n=${b.length})\n`);
    console.log(`| | ${A} | ${B} | p |\n|---|---|---|---|`);
    for (const [name, f] of Object.entries(props)) {
      const ka = a.filter(f).length, kb = b.filter(f).length;
      const [la, ha] = wilson(ka, a.length), [lb, hb] = wilson(kb, b.length);
      console.log(`| ${name} | ${ka}/${a.length} (${pct(la)}–${pct(ha)}) | ${kb}/${b.length} (${pct(lb)}–${pct(hb)}) | ${fmtp(fisher(ka, a.length - ka, kb, b.length - kb))} |`);
    }
    for (const [name, f] of Object.entries(meds)) {
      const xa = a.map(f), xb = b.map(f);
      console.log(`| ${name} (median) | ${median(xa)} | ${median(xb)} | ${fmtp(mannWhitney(xa, xb))} |`);
    }
  }
}
