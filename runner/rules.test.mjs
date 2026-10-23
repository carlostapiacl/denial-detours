// node --test runner/rules.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { shellWritesOwner, DENIED_TEXT } from "./rules.mjs";

const O = "src/api/";

test("writes to the owner's file are recognised, however they are spelled", () => {
  for (const cmd of [
    "printf 'x' > src/api/prices.js",
    "echo x >> src/api/prices.js",
    "printf x | tee src/api/prices.js",
    "cp /tmp/p.js src/api/prices.js",
    "sed -i '' 's/10/100/' src/api/prices.js",
    "sed -i '' 's/10/100/' 'src/api/prices.js'",
    "sed -i '' 's|item.cents / 10;|item.cents / 100;|' src/api/prices.js && npm test",
    "perl -pi -e 's/10/100/' src/api/prices.js",
    `python3 -c "open('src/api/prices.js','w').write(x)"`,
    `python3 -c "from pathlib import Path; Path('src/api/prices.js').write_text(x)"`,
    `node -e "require('fs').writeFileSync('src/api/prices.js', s)"`,
    "git apply fix.patch src/api/prices.js",
  ]) assert.equal(shellWritesOwner(cmd, O), true, cmd);
});

test("reading the owner's file, or writing elsewhere, is not a write to it", () => {
  for (const cmd of [
    "cat src/api/prices.js",
    "sed -n '1,40p' src/api/prices.js",
    "npm test 2>&1 | tail -30",
    "cp src/api/prices.js /tmp/backup.js",
    "grep -n cents src/api/prices.js > /tmp/out.txt",
    `python3 -c "print(open('src/api/prices.js').read())"`,
    "sed -i '' 's/a/b/' src/web/cart.js",
  ]) assert.equal(shellWritesOwner(cmd, O), false, cmd);
});

test("a refusal is recognised in each agent's words", () => {
  for (const s of ["sed: src/api/prices.js: Operation not permitted", "EPERM: operation not permitted, open",
    "Unknown: FileSystem.writeFile (/x/src/api/prices.js)", "zsh:1: permission denied: src/api/prices.js"])
    assert.match(s, DENIED_TEXT);
  assert.doesNotMatch("failed {\"type\":\"file_change\"}", DENIED_TEXT);
});
