// utils/fileStore.ts
import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data/saved-search.json");

export function readSavedSearches() {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

export function writeSavedSearches(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}
