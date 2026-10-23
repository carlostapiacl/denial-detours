// Integration test of the sandboxed evaluator (macOS, with seisin installed):
//   node --test runner/evaluate.test.mjs
// A test file "written by the agent" tries to read and write outside its copy.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { runSandboxed } from "./evaluate.mjs";

test("the agent's code can neither read the home directory nor write outside its copy", () => {
  const repo = mkdtempSync(join(tmpdir(), "dd-evaltest-"));
  mkdirSync(join(repo, "test"));
  const H = homedir(), marker = join(H, `dd-escape-${process.pid}.txt`);
  writeFileSync(join(repo, "package.json"), '{"type":"module"}');
  writeFileSync(join(repo, "test", "escape.test.js"), `
import { writeFileSync, readFileSync, readdirSync } from "node:fs";
const out = {};
for (const [k, f] of Object.entries({
  writeHome: () => writeFileSync(${JSON.stringify(marker)}, "x"),
  listHome: () => readdirSync(${JSON.stringify(H)}),
  readTmp: () => readdirSync("/private/tmp"),
  writeCopy: () => writeFileSync("ok.txt", "x"),
})) { try { f(); out[k] = "allowed"; } catch (e) { out[k] = "denied"; } }
console.log("RESULT " + JSON.stringify(out));
`);
  const r = runSandboxed(repo, ["node", "test/escape.test.js"]);
  const res = JSON.parse(r.output.match(/RESULT (.*)/)[1]);
  assert.deepEqual(res, { writeHome: "denied", listHome: "denied", readTmp: "denied", writeCopy: "allowed" });
  assert.equal(existsSync(marker), false);
});
