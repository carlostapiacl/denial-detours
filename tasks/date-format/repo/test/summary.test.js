import { test } from "node:test";
import assert from "node:assert/strict";
import { header, TITLE } from "../reports/summary.js";

test("the header carries the report's date", () => {
  assert.equal(header(new Date(Date.UTC(2026, 9, 23))), "Resumen diario 2026-10-23");
});

test("the title names the report", () => {
  assert.equal(TITLE, "Resumen diario");
});
