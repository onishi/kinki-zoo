/**
 * monitor.wagaya.org 向けの共通ヘルスチェック規格（Monitor Health Check Protocol v1）に
 * 沿ったレスポンスを返す。仕様: https://github.com/onishi/monitor/blob/main/SPEC.md#22
 *
 * - web: D1への疎通確認（動物園マスタが1件以上読めるか）
 * - batch: 毎日18:00 UTCのスクレイピングCronの直近実行結果（animal_scrape_results）
 */

interface LatestScrapeRow {
  last_scraped_at: string | null;
  total: number;
  error_count: number;
}

export async function checkHealth(db: D1Database): Promise<Response> {
  const now = new Date().toISOString();

  let webStatus: "ok" | "critical" = "ok";
  let webMessage = "D1への疎通に成功";
  try {
    const row = await db.prepare("SELECT COUNT(*) AS count FROM zoo_animals").first<{ count: number }>();
    if (!row) throw new Error("クエリ結果が空です");
  } catch (err) {
    webStatus = "critical";
    webMessage = `D1への疎通に失敗: ${err instanceof Error ? err.message : String(err)}`;
  }

  let batchStatus: "ok" | "warning" | "critical" = "critical";
  let batchMessage = "スクレイピング結果が見つかりません";
  let lastSuccessAt: string | undefined;
  try {
    const row = await db
      .prepare(
        `WITH latest AS (SELECT MAX(scraped_at) AS ts FROM animal_scrape_results)
         SELECT
           latest.ts AS last_scraped_at,
           COUNT(r.zoo_id) AS total,
           SUM(CASE WHEN r.error IS NOT NULL THEN 1 ELSE 0 END) AS error_count
         FROM latest
         LEFT JOIN animal_scrape_results r ON r.scraped_at = latest.ts`,
      )
      .first<LatestScrapeRow>();

    if (row?.last_scraped_at) {
      lastSuccessAt = new Date(row.last_scraped_at).toISOString();
      const { total, error_count: errorCount } = row;
      if (errorCount === 0) {
        batchStatus = "ok";
        batchMessage = `${total}件の動物園で成功`;
      } else if (errorCount < total) {
        batchStatus = "warning";
        batchMessage = `${total}件中${errorCount}件でエラー`;
      } else {
        batchStatus = "critical";
        batchMessage = `${total}件すべてでエラー`;
      }
    }
  } catch (err) {
    batchStatus = "critical";
    batchMessage = `スクレイピング結果の取得に失敗: ${err instanceof Error ? err.message : String(err)}`;
  }

  const statuses = [webStatus, batchStatus];
  const overall = statuses.includes("critical") ? "critical" : statuses.includes("warning") ? "warning" : "ok";

  const body = {
    protocol_version: "1.0",
    service: { id: "kinki-zoo", name: "kinki-zoo", environment: "production" },
    generated_at: now,
    status: overall,
    checks: [
      {
        id: "web-root",
        type: "web",
        name: "D1疎通確認",
        status: webStatus,
        message: webMessage,
        checked_at: now,
      },
      {
        id: "scrape-batch",
        type: "batch",
        name: "動物園スクレイピング（毎日18:00 UTC）",
        status: batchStatus,
        message: batchMessage,
        ...(lastSuccessAt ? { last_success_at: lastSuccessAt } : {}),
        expected_interval_sec: 86400,
        checked_at: now,
      },
    ],
    alert_urls: [
      {
        label: "スクレイピング状況（管理画面）",
        url: "https://kinki-zoo.wagaya.org/admin/scrape-health",
      },
      {
        label: "Cloudflare Workers ダッシュボード",
        url: "https://dash.cloudflare.com/?to=/:account/workers/services/view/kinki-zoo",
      },
      { label: "GitHub リポジトリ", url: "https://github.com/onishi/kinki-zoo" },
    ],
  };

  return Response.json(body, { status: 200 });
}
