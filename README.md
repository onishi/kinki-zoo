# kinki-zoo

近畿一円の動物園情報を提供する Web サービスです。TypeScript + Cloudflare Workers で実装し、ローカル開発は `wrangler dev` で行います。

## 仕様

### 概要

- 近畿地方（大阪・京都・兵庫・奈良・滋賀・三重・和歌山）の動物園・動物施設を一覧表示
- 都道府県での絞り込みが可能
- D1 に保存したスクレイピング結果と分類マスタをもとに、動物名・分類名での絞り込みが可能
- ブラウザで見やすい HTML ページと、アプリ連携向けの JSON API を提供

### エンドポイント

| パス | 説明 |
|------|------|
| `GET /` | 動物園一覧 HTML（都道府県タブで絞り込み可） |
| `GET /animals` | D1 に保存済みの動物一覧 HTML（動物ごとに見られる施設を表示） |
| `GET /taxonomy` | 類・目・科・属・種から動物を探せる分類一覧 HTML |
| `GET /taxonomy/:rank/:value` | 指定した分類値に属する動物一覧 HTML |
| `GET /taxonomy/:class/:order/:family/:genus/:species` | 分類階層を URL にした動物一覧 HTML（途中階層まででも可） |
| `GET /map` | 動物園位置を地図で表示 HTML（都道府県・動物名での絞り込み可） |
| `GET /animal-images` | 動物名ごとの画像生成・選択管理 HTML。一覧上で共通モデルを選び、生成履歴から使用画像を選択する |
| `GET /zoos/:id` | 動物園ごとの詳細 HTML ページ（地図付き） |
| `GET /api/zoos` | 全動物園を JSON で返す |
| `GET /api/zoos?pref=osaka` | 都道府県コードで絞り込んだ動物園を返す |
| `GET /api/zoos?animal=パンダ` | D1 に保存済みの動物名・分類名に一致する動物園を返す |
| `GET /api/zoos/:id` | 特定の動物園の詳細を JSON で返す |
| `GET /api/zoos/:id/animals` | D1 キャッシュ優先で動物リストを返す（`?refresh=1` で再取得・保存） |
| `POST /api/animals/refresh` | 全動物園の動物リストを再スクレイピングして D1 に保存する |
| `POST /api/animals/classify` | 保存済みの公式表示名を分類マスタに投入し、`zoo_animals.animal_id` を紐づける |
| `POST /api/animals/suggest-taxonomy` | 未分類の公式表示名を Gemini + Google Search grounding で分類候補化する |
| `GET /api/animals/taxonomy-candidates` | Gemini が作成した分類候補を JSON で返す |
| `GET /animal-images/:name` | 動物名キーで保存した正方形画像を返す |
| `POST /api/animal-images/generate` | Gemini で動物画像を生成し、動物名キーで D1 に保存する |
| `GET /animal-image-generations/:id` | 生成履歴に残した個別画像を返す |

### 都道府県コード

| コード | 都道府県 |
|--------|---------|
| `osaka` | 大阪府 |
| `kyoto` | 京都府 |
| `hyogo` | 兵庫県 |
| `nara` | 奈良県 |
| `shiga` | 滋賀県 |
| `wakayama` | 和歌山県 |

### 動物園データ構造（JSON）

```json
{
  "id": "tennoji-zoo",
  "name": "天王寺動物園",
  "nameKana": "てんのうじどうぶつえん",
  "prefecture": "osaka",
  "address": "大阪府大阪市天王寺区茶臼山町1-108",
  "lat": 34.6494,
  "lon": 135.5063,
  "openingHours": "9:30〜17:00（入園は16:00まで）",
  "closedDays": "毎週月曜日（祝日の場合は翌平日）、年末年始",
  "admission": "大人500円、中学生以下無料",
  "website": "https://www.tennojizoo.jp/",
  "wikipediaUrl": "https://ja.wikipedia.org/wiki/%E5%A4%A9%E7%8E%8B%E5%AF%BA%E5%8B%95%E7%89%A9%E5%9C%92",
  "features": ["パンダ", "大型類人猿", "夜行性動物館"]
}
```

### スクレイピング結果データ構造（`/api/zoos/:id/animals`）

```json
{
  "zooId": "tennoji-zoo",
  "animals": ["ライオン", "キリン", "ゾウ"],
  "scrapedAt": "2024-01-01T00:00:00.000Z",
  "error": "（エラー時のみ）"
}
```

## 開発状況と今後の計画

### 現在の実装状況（2026-06 時点）

- [x] 動物園一覧ページ（都道府県タブ・動物検索）
- [x] 動物園詳細ページ（`/zoos/:id`、動物一覧を含む）
- [x] JSON API（`/api/zoos`, `/api/zoos/:id`, `/api/zoos/:id/animals`）
- [x] [各動物園スクレイピング](https://github.com/onishi/kinki-zoo/issues/10)
- [x] [動物園ごとのページ / 動物一覧ページ作成](https://github.com/onishi/kinki-zoo/issues/15)
- [x] [動物検索の改善（スクレイピング結果を活用）](https://github.com/onishi/kinki-zoo/issues/19)
- [x] スクレイピング結果の D1 保存と検索高速化

### 今後の開発計画（優先候補）

- [ ] [神戸どうぶつ王国追加](https://github.com/onishi/kinki-zoo/issues/12)
- [ ] [デザイン変更](https://github.com/onishi/kinki-zoo/issues/13)
- [ ] [地図表示を追加する](https://github.com/onishi/kinki-zoo/issues/1)
- [ ] [Cloudflare KV にデータをキャッシュする](https://github.com/onishi/kinki-zoo/issues/3)
- [ ] [Cloudflare Pages フロントエンドを分離する](https://github.com/onishi/kinki-zoo/issues/4)

## セットアップ

```bash
npm install
```

### 施設一覧のデータソース

加盟施設の基準データには、日本動物園水族館協会（JAZA）の
[加盟園館検索](https://www.jaza.jp/search-enkan)を使用します。
JAZAから施設名と公式URLを同期し、住所・緯度経度・営業時間などは `src/data.ts` で補完します。

```bash
npm run sync:jaza   # JAZA近畿の加盟動物園・水族館を同期
npm run check:jaza  # 現在の掲載施設と比較して未掲載候補を表示
```

## ローカル開発

```bash
npm run dev
```

ブラウザで `http://localhost:8001` を開くと動物園一覧が表示されます。

## 型チェック

```bash
npm run typecheck
```

## D1

スクレイピング結果は Cloudflare D1 の `kinki-zoo-animals` に保存します。

動物園の公式表示を尊重するため、施設ごとの動物一覧と分類用の動物マスタは分けています。

| テーブル | 役割 |
|----------|------|
| `zoo_animals` | 施設公式の表示名を `display_name` として保存。`animal_id` は分類マスタへの任意リンク |
| `animals` | 種マスタ。代表名、類・目・科・属・種を保持し、属・種の組み合わせをユニークにする |
| `animal_images` | `animals` と `zoo_animals` で共通利用する選択中の正方形画像。正規化した動物名をキーに保存 |
| `animal_image_generations` | Gemini で生成した画像履歴。生成した全画像を残し、`animal_images.selected_generation_id` で使用画像を選ぶ |
| `animal_scrape_results` | 施設ごとのスクレイピング日時とエラー情報 |
| `animal_scrape_diffs` | 前回取得との差分（追加・削除・表記変更らしきペア）を履歴として保存 |

分類マスタは `src/animal-taxonomy.ts` のゆるい分類ルールから投入します。`animals` は種まで特定できるものだけを保持し、属・種まで判断できない公式表示名は `zoo_animals.animal_id` を `NULL` のまま保持します。例えば `ユキヒョウ` は `ヒョウ属 + ユキヒョウ`、`アムールヒョウ` は `ヒョウ属 + ヒョウ` として別の種に紐づけます。

```bash
npm run d1:migrate          # ローカル D1 にマイグレーション適用
npm run d1:migrate:remote   # リモート D1 にマイグレーション適用
```

動物データは、各動物園の動物一覧 API に初回アクセスした時、または `?refresh=1` を付けた時に保存されます。全件更新は次の API で実行できます。

```bash
curl -X POST http://localhost:8001/api/animals/refresh
curl -X POST http://localhost:8001/api/animals/classify
curl -X POST http://localhost:8001/api/animals/suggest-taxonomy
curl -X POST http://localhost:8001/api/animal-images/generate
npm run generate:animal-images -- --limit 10
npm run generate:animal-images -- --name アオサギ --include-existing
npm run generate:animal-images -- --name アオサギ --model gemini-2.5-flash-image --include-existing
npm run generate:all-animal-images -- --batch-size 5
npm run classify:unclassified -- --base-url http://localhost:8001 --zoo kobe-animal-kingdom
```

分類バッチは `--zoo` を複数指定できます。省略時は全動物園の未分類データを対象にし、
Gemini候補の生成と適用を未処理データがなくなるまで繰り返します。

Gemini による分類候補生成には `GEMINI_API_KEY` が必要です。ローカルでは `.dev.vars` に設定します。
動物画像生成も同じ `GEMINI_API_KEY` を使用します。`/api/animal-images/generate` は `animals.canonical_name` と
`zoo_animals.display_name` を動物名として集め、正規化した名前が同じものは同じ `animal_images.animal_key` に保存します。
任意の名前だけ生成する場合は `{"names":["アオサギ"],"missingOnly":false}` のように POST します。
ブラウザでは `/animal-images` の一覧上でモデルを一度選び、各動物の画像生成と使用画像の選択ができます。
全件バッチ `generate:all-animal-images` は当面 `gemini-2.5-flash-image` のみを対象にします。

```bash
echo 'GEMINI_API_KEY=your_api_key' > .dev.vars
npm run dev
```

本番では secret として設定します。

```bash
npx wrangler secret put GEMINI_API_KEY
```

`/api/animals/suggest-taxonomy` は `animals` へ直接投入せず、`animal_taxonomy_candidates` に候補として保存します。種まで断定できない表示名は `NULL` 候補として残し、人間が確認してから採用する想定です。

本番では `wrangler.toml` の cron により毎日自動更新します。

## Cloudflare へのデプロイ

```bash
npm run deploy
```

`wrangler login` でログインしておく必要があります。

## 情報源

- 各動物園の公式サイト
- 環境省「全国動物園・水族館等調査」
