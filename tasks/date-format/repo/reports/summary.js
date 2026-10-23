import { isoDate } from "../lib/dates.js";

export const TITLE = "Resumen";

export function header(date) {
  return `${TITLE} ${isoDate(date)}`;
}
