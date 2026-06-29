#!/usr/bin/env node

/**
 * ローカル D1 SQLite の animal_image_generations から
 * 各動物の selected 画像を R2 バケットにアップロードする。
 *
 * 事前に `wrangler r2 bucket create kinki-zoo-images` を実行しておくこと。
 *
 * 使い方:
 *   node scripts/upload-images-to-r2.mjs
 *   node scripts/upload-images-to-r2.mjs --sqlite <path> --bucket <name>
 */

import { execSync, spawnSync } from "node:child_process";
import { argv } from "node:process";

const SQLITE_DEFAULT =
  ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/54b3d70771db946c7b33fec3e48f851c1dcc3a1477d247720a97145206913efd.sqlite";
const BUCKET_DEFAULT = "kinki-zoo-images";

let sqlitePath = SQLITE_DEFAULT;
let bucket = BUCKET_DEFAULT;

for (let i = 2; i < argv.length; i++) {
  if (argv[i] === "--sqlite") sqlitePath = argv[++i];
  else if (argv[i] === "--bucket") bucket = argv[++i];
}

// selected 画像の一覧を取得（animal_key, mime_type, generation id）
const rows = JSON.parse(
  execSync(
    `sqlite3 -json "${sqlitePath}" "SELECT ai.animal_key, ai.mime_type, ai.selected_generation_id FROM animal_images ai WHERE ai.selected_generation_id IS NOT NULL ORDER BY ai.animal_key"`
  ).toString()
);

console.log(`Uploading ${rows.length} images to R2 bucket '${bucket}'...`);

let success = 0;
let failed = 0;
const failedKeys = [];

for (const { animal_key, mime_type, selected_generation_id } of rows) {
  try {
    // 1件ずつ base64 を取得してデコード
    const b64 = execSync(
      `sqlite3 "${sqlitePath}" "SELECT image_base64 FROM animal_image_generations WHERE id = ${selected_generation_id}"`,
      { maxBuffer: 10 * 1024 * 1024 }
    )
      .toString()
      .trim();

    const buffer = Buffer.from(b64, "base64");

    // wrangler r2 object put --pipe で stdin から binary をアップロード
    const result = spawnSync(
      "npx",
      [
        "wrangler",
        "r2",
        "object",
        "put",
        `${bucket}/${animal_key}`,
        "--pipe",
        "--content-type",
        mime_type,
      ],
      {
        input: buffer,
        stdio: ["pipe", "pipe", "inherit"],
        maxBuffer: 10 * 1024 * 1024,
      }
    );

    if (result.status !== 0) {
      throw new Error(`wrangler exited with status ${result.status}`);
    }

    success++;
    process.stdout.write(`\r[${success + failed}/${rows.length}] ${animal_key}`.padEnd(80));
  } catch (err) {
    failed++;
    failedKeys.push(animal_key);
    process.stdout.write("\n");
    console.error(`Failed: ${animal_key}: ${err.message}`);
  }
}

process.stdout.write("\n");
console.log(`\nDone: ${success} uploaded, ${failed} failed`);
if (failedKeys.length > 0) {
  console.error("Failed keys:", failedKeys);
  process.exitCode = 1;
}
