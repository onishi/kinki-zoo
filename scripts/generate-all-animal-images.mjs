#!/usr/bin/env node

const args = process.argv.slice(2);
let baseUrl = "http://localhost:8001";
let batchSize = 5;
let maxBatches = Number.POSITIVE_INFINITY;
const models = ["gemini-2.5-flash-image"];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--base-url") {
    baseUrl = args[index + 1] ?? baseUrl;
    index += 1;
  } else if (arg === "--batch-size") {
    const value = Number(args[index + 1]);
    if (Number.isFinite(value)) batchSize = Math.max(1, Math.min(10, Math.floor(value)));
    index += 1;
  } else if (arg === "--max-batches") {
    const value = Number(args[index + 1]);
    if (Number.isFinite(value)) maxBatches = Math.max(1, Math.floor(value));
    index += 1;
  } else if (arg === "--model") {
    const value = args[index + 1];
    if (value && !models.includes(value)) models.push(value);
    index += 1;
  }
}

const endpoint = `${baseUrl.replace(/\/$/, "")}/api/animal-images/generate`;
const failedNames = new Map();

async function generateBatch(model, excludeNames) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      limit: batchSize,
      missingOnly: true,
      missingModelOnly: true,
      model,
      excludeNames,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text);
  }
  return JSON.parse(text);
}

for (const model of models) {
  console.log(`\n== ${model} ==`);
  for (let batch = 1; batch <= maxBatches; batch += 1) {
    const result = await generateBatch(model, [...failedNames.keys()]);
    console.log(
      `batch ${batch}: requested=${result.requested} generated=${result.generated} errors=${result.errors?.length ?? 0}`
    );
    for (const image of result.images ?? []) {
      console.log(`  generated: ${image.displayName} #${image.generationId ?? "-"}`);
    }
    if (result.errors?.length) {
      for (const error of result.errors) {
        console.error(`  error: ${error.displayName}: ${error.error}`);
        failedNames.set(error.displayName, error.error);
      }
    }
    if (result.requested === 0 || result.generated === 0) break;
  }
}

if (failedNames.size > 0) {
  console.error("\nFailed names:");
  for (const [name, error] of failedNames) {
    console.error(`- ${name}: ${error}`);
  }
  process.exitCode = 1;
}
