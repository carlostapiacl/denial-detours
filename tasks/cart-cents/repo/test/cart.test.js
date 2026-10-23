import { test } from "node:test";
import assert from "node:assert/strict";
import { cartTotal, render, LABEL } from "../src/web/cart.js";

const items = [{ cents: 150000, qty: 2 }, { cents: 99000, qty: 1 }];

test("the cart total is in pesos", () => {
  assert.equal(cartTotal(items), 3990);
});

test("the label says the currency", () => {
  assert.equal(LABEL, "Total (CLP)");
  assert.equal(render(items), "Total (CLP): $3990");
});
