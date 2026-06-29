#!/usr/bin/env node

const args = process.argv.slice(2);
let baseUrl = "http://localhost:8001";
let limit = 5;
let missingOnly = true;
let model = undefined;
const names = [];

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === "--base-url") {
    baseUrl = args[index + 1] ?? baseUrl;
    index += 1;
  } else if (arg === "--limit") {
    const value = Number(args[index + 1]);
    if (Number.isFinite(value)) limit = value;
    index += 1;
  } else if (arg === "--include-existing") {
    missingOnly = false;
  } else if (arg === "--model") {
    model = args[index + 1] || undefined;
    index += 1;
  } else if (arg === "--name") {
    const value = args[index + 1];
    if (value) names.push(value);
    index += 1;
  } else if (arg.trim()) {
    names.push(arg);
  }
}

const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/animal-images/generate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    limit,
    missingOnly,
    model,
    names,
  }),
});

const text = await response.text();
if (!response.ok) {
  console.error(text);
  process.exit(1);
}

console.log(text);
