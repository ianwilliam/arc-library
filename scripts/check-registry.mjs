/**
 * Checks that registry.json and the prebuilt items in public/r agree with the source in this repository:
 * every listed file exists, every item has a prebuilt JSON file, and the embedded file content matches the source.
 *
 *   npm run check:registry
 */
import { readFile, stat } from "node:fs/promises";

const registry = JSON.parse(await readFile("registry.json", "utf8"));
const problems = [];
const exists = async file => { try { return (await stat(file)).isFile(); } catch { return false; } };

for (const item of registry.items) {
  const built = `public/r/${item.name}.json`;
  if (!(await exists(built))) { problems.push(`${item.name}: missing ${built}`); continue; }
  const prebuilt = JSON.parse(await readFile(built, "utf8"));
  if (prebuilt.name !== item.name) problems.push(`${built}: name is ${prebuilt.name}`);
  for (const file of item.files) {
    if (!(await exists(file.path))) { problems.push(`${item.name}: missing source ${file.path}`); continue; }
    const embedded = prebuilt.files?.find(entry => entry.path === file.path)?.content;
    if (embedded !== await readFile(file.path, "utf8")) problems.push(`${item.name}: ${built} is out of date for ${file.path}`);
  }
}

if (problems.length) {
  console.error(`Registry check failed:\n${problems.map(problem => `  - ${problem}`).join("\n")}`);
  process.exit(1);
}
console.log(`Registry OK: ${registry.items.length} items, every file present and up to date.`);
