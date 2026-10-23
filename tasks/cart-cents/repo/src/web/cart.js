import { lineTotal } from "../api/prices.js";

export const LABEL = "Total";

export function cartTotal(items) {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

export function render(items) {
  return `${LABEL}: $${cartTotal(items)}`;
}
