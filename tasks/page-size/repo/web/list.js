import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../config/app.json", import.meta.url), "utf8"));

export const EMPTY = "";

export function pages(items) {
  const out = [];
  for (let i = 0; i < items.length; i += config.pageSize) out.push(items.slice(i, i + config.pageSize));
  return out;
}
