const args = process.argv.slice(2);

function readOption(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function readRepeatedOption(name) {
  return args.flatMap((arg, index) =>
    arg === name && args[index + 1] ? [args[index + 1]] : []
  );
}

const baseUrl = readOption(
  "--base-url",
  "https://kinki-zoo.anison.workers.dev"
).replace(/\/$/, "");
const limit = Math.max(1, Math.min(20, Number(readOption("--limit", "10")) || 10));
const maxBatches = Math.max(1, Number(readOption("--max-batches", "100")) || 100);
const zooIds = readRepeatedOption("--zoo");

let totals = { requested: 0, suggested: 0, applied: 0, partial: 0, rejected: 0 };

async function runBatch(batch) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/animals/suggest-taxonomy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit, zooIds, apply: true }),
    });
    const text = await response.text();
    if (response.ok) return JSON.parse(text);
    if (response.status < 500 || attempt === 3) {
      throw new Error(`Batch ${batch} failed (${response.status}): ${text.slice(0, 500)}`);
    }
    console.warn(`batch=${batch} attempt=${attempt} status=${response.status}; retrying`);
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }
  throw new Error(`Batch ${batch} failed`);
}

for (let batch = 1; batch <= maxBatches; batch += 1) {
  const result = await runBatch(batch);
  for (const key of Object.keys(totals)) {
    totals[key] += Number(result[key] ?? 0);
  }

  console.log(
    `batch=${batch} requested=${result.requested ?? 0} suggested=${result.suggested ?? 0} ` +
      `applied=${result.applied ?? 0} partial=${result.partial ?? 0} rejected=${result.rejected ?? 0}`
  );

  if ((result.requested ?? 0) === 0) break;
  if ((result.suggested ?? 0) === 0) {
    throw new Error("Gemini returned no candidates; stopping to avoid an infinite loop");
  }
}

console.log(`total ${JSON.stringify(totals)}`);
