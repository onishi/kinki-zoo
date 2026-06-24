import { readFile } from "node:fs/promises";

const dataSource = await readFile(new URL("../src/data.ts", import.meta.url), "utf8");
const memberSource = await readFile(new URL("../src/jaza-members.ts", import.meta.url), "utf8");

function hostname(url) {
  return new URL(url).hostname.replace(/^www\./, "");
}

const currentHosts = new Set(
  [...dataSource.matchAll(/website:\s*"([^"]+)"/g)].map((match) => hostname(match[1]))
);
const jazaZoosJson = memberSource.match(/JAZA_KINKI_ZOOS[^=]*=\s*(\[[\s\S]*?\]);/)?.[1];
if (!jazaZoosJson) throw new Error("JAZA_KINKI_ZOOS を読み取れませんでした");

const jazaZoos = JSON.parse(jazaZoosJson);
const missing = jazaZoos.filter((facility) => !currentHosts.has(hostname(facility.website)));

if (missing.length === 0) {
  console.log("JAZA近畿の動物園はすべて掲載済みです。");
} else {
  console.log("JAZA近畿の未掲載候補:");
  for (const facility of missing) console.log(`- ${facility.name}: ${facility.website}`);
}
