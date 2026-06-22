# kinki-zoo

近畿一円の動物園情報を提供する Web サービスです。TypeScript + Cloudflare Workers で実装し、ローカル開発は `wrangler dev` で行います。

## 仕様

### 概要

- 近畿地方（大阪・京都・兵庫・奈良・滋賀・和歌山）の動物園・動物施設を一覧表示
- 都道府県での絞り込みが可能
- 登録済みの特徴タグをもとに、動物名での絞り込みが可能
- ブラウザで見やすい HTML ページと、アプリ連携向けの JSON API を提供

### エンドポイント

| パス | 説明 |
|------|------|
| `GET /` | 動物園一覧 HTML（都道府県タブで絞り込み可） |
| `GET /map` | 動物園位置を地図で表示 HTML（都道府県・動物名での絞り込み可） |
| `GET /zoos/:id` | 動物園ごとの詳細 HTML ページ（地図付き） |
| `GET /zoos/:id/animals` | 動物園ごとの動物一覧 HTML ページ（公式サイトをスクレイピング） |
| `GET /api/zoos` | 全動物園を JSON で返す |
| `GET /api/zoos?pref=osaka` | 都道府県コードで絞り込んだ動物園を返す |
| `GET /api/zoos?animal=パンダ` | 特徴タグに一致する動物園を返す |
| `GET /api/zoos/:id` | 特定の動物園の詳細を JSON で返す |
| `GET /api/zoos/:id/animals` | 動物園の公式サイトをスクレイピングして動物リストを返す |

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
- [x] 動物園詳細ページ（`/zoos/:id`）
- [x] 動物園ごとの動物一覧ページ（`/zoos/:id/animals`）
- [x] JSON API（`/api/zoos`, `/api/zoos/:id`, `/api/zoos/:id/animals`）
- [x] [各動物園スクレイピング](https://github.com/onishi/kinki-zoo/issues/10)
- [x] [動物園ごとのページ / 動物一覧ページ作成](https://github.com/onishi/kinki-zoo/issues/15)
- [x] [動物検索の改善（スクレイピング結果を活用）](https://github.com/onishi/kinki-zoo/issues/19)

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

## ローカル開発

```bash
npm run dev
```

ブラウザで `http://localhost:8787` を開くと動物園一覧が表示されます。

## 型チェック

```bash
npm run typecheck
```

## Cloudflare へのデプロイ

```bash
npm run deploy
```

`wrangler login` でログインしておく必要があります。

## 情報源

- 各動物園の公式サイト
- 環境省「全国動物園・水族館等調査」
