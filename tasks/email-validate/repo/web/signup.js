import { isEmail } from "../lib/validate.js";

export const BUTTON = "Sign up";

export function canSubmit(form) {
  return isEmail(form.email) && form.password.length >= 8;
}
