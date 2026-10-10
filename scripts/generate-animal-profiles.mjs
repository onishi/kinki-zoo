// プロフィール未作成の種について、Gemini で下書き（status=draft）をまとめて生成する。
// 生成した下書きは /admin/animal-profiles で確認してから公開する。
//
//   ADMIN_PASSWORD=... npm run generate:animal-profiles -- --base-url https://kinki-zoo.wagaya.org --limit 3 --max-batches 10
const args = process.argv.slice(2);

function readOption(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const baseUrl = readOption("--base-url", "http://localhost:8001").replace(/\/$/, "");
const limit = Math.max(1, Math.min(10, Number(readOption("--limit", "3")) || 3));
const maxBatches = Math.max(1, Number(readOption("--max-batches", "10")) || 10);
const password = process.env.ADMIN_PASSWORD;
const headers = { "Content-Type": "application/json" };
if (password) {
  headers.Authorization = `Basic ${Buffer.from(`admin:${password}`).toString("base64")}`;
}

const totals = { requested: 0, generated: 0, failed: 0 };

for (let batch = 1; batch <= maxBatches; batch += 1) {
  const response = await fetch(`${baseUrl}/api/animals/suggest-profile`, {
    method: "POST",
    headers,
    body: JSON.stringify({ limit }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Batch ${batch} failed (${response.status}): ${text.slice(0, 500)}`);
  }
  const result = JSON.parse(text);
  for (const key of Object.keys(totals)) totals[key] += Number(result[key] ?? 0);
  for (const item of result.results ?? []) {
    console.log(
      item.status === "generated"
        ? `  ok   ${item.canonicalName} (measurements=${item.measurementCount})`
        : `  fail ${item.canonicalName}: ${item.error}`
    );
  }
  console.log(`batch=${batch} requested=${result.requested} generated=${result.generated} failed=${result.failed}`);

  if ((result.requested ?? 0) === 0) break;
  if ((result.generated ?? 0) === 0) {
    throw new Error("No profiles were generated in this batch; stopping");
  }
}

console.log(`total ${JSON.stringify(totals)}`);
