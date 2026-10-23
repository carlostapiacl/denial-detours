import { test } from "node:test";
import assert from "node:assert/strict";
import { canSubmit, BUTTON } from "../web/signup.js";

test("an address with a plus sign can sign up", () => {
  assert.equal(canSubmit({ email: "ana+tienda@correo.cl", password: "12345678" }), true);
});

test("the button is in Spanish", () => {
  assert.equal(BUTTON, "Crear cuenta");
});
