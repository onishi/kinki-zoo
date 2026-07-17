#!/usr/bin/env node

/**
 * ローカルの D1 データと R2 画像を Cloudflare に差分同期する。
 * 方向: ローカル → リモート（一方通行）
 *
 * D1:  INSERT OR REPLACE（UPSERT）でローカルの追加・更新を反映し、
 *      ローカルに存在しない行をリモートから削除する。
 *      animal_image_generations（725MB）はスキップ。
 *      animal_images は image_base64 を除外（画像は R2 が担う）。
 *
 * R2:  .r2-sync-state.json で管理し、selected_generation_id が変わった
 *      画像だけアップロードする。
 *
 * 使い方:
 *   node scripts/sync-to-remote.mjs           # D1 + R2 を両方同期
 *   node scripts/sync-to-remote.mjs --d1-only # D1 のみ
 *   node scripts/sync-to-remote.mjs --r2-only # R2 のみ
 *   node scripts/sync-to-remote.mjs -y        # 確認プロンプトをスキップ
 */

import { execSync, spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { argv, exit } from "node:process";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const SQLITE_PATH =
  ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/54b3d70771db946c7b33fec3e48f851c1dcc3a1477d247720a97145206913efd.sqlite";
const DB_NAME = "kinki-zoo-animals";
const BUCKET = "kinki-zoo-images";
const R2_STATE_FILE = ".r2-sync-state.json";

// テーブルごとの設定: PK 列（削除検出に使用）
// composite PK は配列で指定
const TABLE_CONFIG = [
  { table: "animals",                  pk: ["id"] },
  { table: "zoo_animals",              pk: ["zoo_id", "display_name"] },
  { table: "animal_scrape_results",    pk: ["zoo_id"] },
  { table: "animal_scrape_diffs",      pk: ["id"] },
  { table: "animal_scrape_warnings",   pk: ["id"] },
  { table: "animal_taxonomy_candidates", pk: ["display_name"] },
  // animal_images は別処理（image_base64 を空文字に置換）
];

// animal_images の同期対象カラム（image_base64 を除く）
const ANIMAL_IMAGES_COLUMNS = [
  "animal_key",
  "display_name",
  "normalized_name",
  "prompt",
  "model",
  "mime_type",
  "width",
  "height",
  "created_at",
  "updated_at",
  "selected_generation_id",
];

const args = new Set(argv.slice(2));
const d1Only = args.has("--d1-only");
const r2Only = args.has("--r2-only");
const skipConfirm = args.has("--yes") || args.has("-y");

const syncD1 = !r2Only;
const syncR2 = !d1Only;

// sqlite3 の .mode insert は非 ASCII を unistr('\uXXXX') で出力するが D1 未対応。
// 通常の SQL 文字列リテラルに変換する。
function convertUnistr(sql) {
  return sql.replace(/unistr\('((?:[^'\\]|\\u[0-9a-fA-F]{4}|\\\\)*)'\)/g, (_, content) => {
    const decoded = content
      .replace(/\\u([0-9a-fA-F]{4})/g, (__, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/\\\\/g, "\\");
    return "'" + decoded.replace(/'/g, "''") + "'";
  });
}

// INSERT INTO → INSERT OR REPLACE INTO に変換（差分 UPSERT 用）
function toUpsert(sql) {
  return sql.replace(/^INSERT INTO /gm, "INSERT OR REPLACE INTO ");
}

function sqlStr(v) {
  if (v === null || v === undefined) return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: "inherit", ...opts });
}

function runCapture(cmd) {
  return execSync(cmd, { encoding: "utf8" });
}

function querySqlite(sql) {
  const out = runCapture(`sqlite3 -json "${SQLITE_PATH}" "${sql.replace(/"/g, '\\"')}"`).trim();
  return out ? JSON.parse(out) : [];
}

async function confirm(message) {
  if (skipConfirm) return true;
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(`${message} [y/N] `);
  rl.close();
  return answer.trim().toLowerCase() === "y";
}

// ---- D1 同期 ----

// テーブルの全行数を返す
function localCount(table) {
  return runCapture(`sqlite3 "${SQLITE_PATH}" "SELECT count(*) FROM ${table}"`).trim();
}

// PK 列の値を使って DELETE ... WHERE pk NOT IN (...) を生成する
function buildDeleteOldSQL(table, pk, rows) {
  if (rows.length === 0) return `DELETE FROM ${table};`;

  if (pk.length === 1) {
    const col = pk[0];
    const values = rows.map((r) => sqlStr(r[col])).join(", ");
    return `DELETE FROM ${table} WHERE ${col} NOT IN (${values});`;
  }

  // composite PK: 連結文字列で比較
  const sep = "\x00"; // NUL を区切り文字として使用
  const concat = pk.map((c) => `CAST(${c} AS TEXT)`).join(` || '${sep}' || `);
  const values = rows
    .map((r) => sqlStr(pk.map((c) => String(r[c] ?? "")).join(sep)))
    .join(", ");
  return `DELETE FROM ${table} WHERE (${concat}) NOT IN (${values});`;
}

async function syncD1Data() {
  console.log("\n=== D1 差分同期 (ローカル → リモート) ===");

  for (const { table } of [...TABLE_CONFIG, { table: "animal_images" }]) {
    console.log(`  ${table}: ${localCount(table)} 行`);
  }

  const ok = await confirm("\nリモートへの差分適用を実行しますか？");
  if (!ok) { console.log("中止しました。"); exit(0); }

  // 1. リモートマイグレーション
  console.log("\n[1/3] リモートマイグレーションを確認中...");
  run(`npx wrangler d1 migrations apply ${DB_NAME} --remote`);

  // 2. SQL ファイルを生成
  console.log("\n[2/3] 差分 SQL を生成中...");
  const tmpFile = join(tmpdir(), `kinki-zoo-sync-${Date.now()}.sql`);
  let sql = "";

  for (const { table, pk } of TABLE_CONFIG) {
    // ローカルの全行を UPSERT
    const insertSql = runCapture(
      `sqlite3 "${SQLITE_PATH}" ".mode insert ${table}" "SELECT * FROM ${table}"`
    );
    sql += toUpsert(insertSql);

    // リモートに残った古い行を削除
    const rows = querySqlite(`SELECT ${pk.join(", ")} FROM ${table}`);
    sql += buildDeleteOldSQL(table, pk, rows) + "\n";
  }

  // animal_images: image_base64 を '' に置換してメタデータのみ UPSERT
  const cols = ANIMAL_IMAGES_COLUMNS.join(", ");
  const allCols = [...ANIMAL_IMAGES_COLUMNS, "image_base64"].join(", ");
  const aiInsertSql = runCapture(
    `sqlite3 "${SQLITE_PATH}" ".mode insert animal_images" "SELECT ${cols}, '' FROM animal_images"`
  ).replace(/^INSERT INTO animal_images VALUES/gm,
    `INSERT OR REPLACE INTO animal_images(${allCols}) VALUES`);
  sql += aiInsertSql;

  // animal_images の削除処理
  const aiRows = querySqlite(`SELECT animal_key FROM animal_images`);
  sql += buildDeleteOldSQL("animal_images", ["animal_key"], aiRows) + "\n";

  // unistr() 変換
  writeFileSync(tmpFile, convertUnistr(sql), "utf8");

  const sizeKb = Math.round(
    parseInt(runCapture(`wc -c < "${tmpFile}"`).trim()) / 1024
  );
  console.log(`  SQL 生成完了: ${sizeKb} KB`);

  // 3. リモートに適用
  console.log("\n[3/3] リモート D1 に適用中...");
  run(`npx wrangler d1 execute ${DB_NAME} --remote --file="${tmpFile}" -y`);

  unlinkSync(tmpFile);
  console.log("\nD1 同期完了。");
}

// ---- R2 同期 ----

async function syncR2Images() {
  console.log("\n=== R2 画像差分同期 (ローカル → リモート) ===");

  // ローカルの選択済み画像一覧を取得
  const rows = querySqlite(
    "SELECT ai.animal_key, ai.mime_type, ai.selected_generation_id FROM animal_images ai WHERE ai.selected_generation_id IS NOT NULL ORDER BY ai.animal_key"
  );

  // 前回の同期状態を読み込む
  const state = existsSync(R2_STATE_FILE)
    ? JSON.parse(readFileSync(R2_STATE_FILE, "utf8"))
    : {};

  // 差分を計算: selected_generation_id が変わった or 新規
  const toUpload = rows.filter(
    (r) => state[r.animal_key] !== r.selected_generation_id
  );

  console.log(`  合計: ${rows.length} 枚 / 差分: ${toUpload.length} 枚`);
  if (toUpload.length === 0) {
    console.log("  アップロード不要。");
    return;
  }

  const ok = await confirm(`${toUpload.length} 枚を R2 にアップロードしますか？`);
  if (!ok) { console.log("R2 同期をスキップしました。"); return; }

  let success = 0;
  let failed = 0;
  const failedKeys = [];
  const newState = { ...state };

  for (const { animal_key, mime_type, selected_generation_id } of toUpload) {
    try {
      const b64 = execSync(
        `sqlite3 "${SQLITE_PATH}" "SELECT image_base64 FROM animal_image_generations WHERE id = ${selected_generation_id}"`,
        { maxBuffer: 10 * 1024 * 1024 }
      ).toString().trim();

      const buffer = Buffer.from(b64, "base64");

      const result = spawnSync(
        "npx",
        ["wrangler", "r2", "object", "put", `${BUCKET}/${animal_key}`, "--pipe", "--content-type", mime_type],
        { input: buffer, stdio: ["pipe", "pipe", "inherit"], maxBuffer: 10 * 1024 * 1024 }
      );

      if (result.status !== 0) throw new Error(`wrangler exited with status ${result.status}`);

      newState[animal_key] = selected_generation_id;
      success++;
      process.stdout.write(`\r[${success + failed}/${toUpload.length}] ${animal_key}`.padEnd(80));
    } catch (err) {
      failed++;
      failedKeys.push(animal_key);
      process.stdout.write("\n");
      console.error(`Failed: ${animal_key}: ${err.message}`);
    }
  }

  process.stdout.write("\n");

  // 成功分だけ状態を保存
  writeFileSync(R2_STATE_FILE, JSON.stringify(newState, null, 2), "utf8");

  console.log(`\nDone: ${success} uploaded, ${failed} failed`);
  if (failedKeys.length > 0) {
    console.error("Failed keys:", failedKeys);
    process.exitCode = 1;
  }
  console.log("R2 同期完了。");
}

// ---- メイン ----
(async () => {
  console.log("kinki-zoo ローカル → リモート差分同期");
  console.log(`  D1: ${syncD1 ? "実行" : "スキップ"}`);
  console.log(`  R2: ${syncR2 ? "実行" : "スキップ"}`);

  if (syncD1) await syncD1Data();
  if (syncR2) await syncR2Images();

  console.log("\n完了しました。");
})();
