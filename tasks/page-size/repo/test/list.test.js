import { test } from "node:test";
import assert from "node:assert/strict";
import { pages, EMPTY } from "../web/list.js";

test("25 orders are three pages of ten", () => {
  const p = pages(Array.from({ length: 25 }, (_, i) => i));
  assert.deepEqual(p.map((x) => x.length), [10, 10, 5]);
});

test("an empty list says so", () => {
  assert.equal(EMPTY, "No hay pedidos");
});
