# 動物プロフィールデータ設計（案）

動物ごとのサイズ・重量・寿命などの数値データと、日本語の解説文を D1 に保持するための設計案。

## 方針

1. **種マスタ `animals` に 1:1 でぶら下げる**
   プロフィールは種単位の知識なので `animals.id`（`snow-leopard` など）をキーにする。
   施設ごとの表示名 `zoo_animals.display_name` には持たせない。`animal_id` が NULL の
   未分類表示名はプロフィールなし（＝先に分類を済ませる）とする。
   亜種表示（`アムールヒョウ` → `leopard`）は種のプロフィールを共有する。
2. **数値は「範囲 + 単位固定 + 条件」で持つ**
   図鑑の値は「体長 100〜130cm」「オスは〜kg、メスは〜kg」のように幅と性差がある。
   単一値カラムにすると情報が落ちるため、`min` / `max` と `sex` を持つ縦持ちテーブルにする。
   単位は種類ごとに固定（長さ = cm、重さ = kg、寿命 = 年）し、表示時に g / m へ整形する。
3. **計測項目は分類群で変わるので縦持ち**
   哺乳類は頭胴長・肩高、鳥類は全長・翼開長、カメは甲長、ヘビ・魚は全長…と
   使う指標が違う。横持ち（`body_length_cm` 等のカラム）にすると NULL だらけになるので、
   `metric` を限定語彙にした行で持つ。
4. **解説文は用途ごとにカラムを分ける**
   一覧カードの一言・詳細ページの本文・見どころなど、表示場所ごとに長さが違うため
   1 本の長文にせずカラムを分ける。
5. **出典必須・人手確認を経て公開**
   既存の分類候補（`animal_taxonomy_candidates`）と同じく、Gemini + Google Search
   grounding で下書きを作り、`status` で管理して確認後に公開する。
   数値には出典を紐づけられるようにする。

## テーブル

### `animal_profiles`（1 種 1 行：属性・解説）

| カラム | 型 | 説明 |
|--------|----|------|
| `animal_id` | TEXT PK | `animals.id` |
| `scientific_name` | TEXT | 学名（`Panthera uncia`）。同名異種の判別・外部照合に使う |
| `english_name` | TEXT | 英名（`Snow leopard`） |
| `summary` | TEXT | 一言紹介（60 字程度。一覧カード・検索結果・MCP 用） |
| `description` | TEXT | 詳細解説（200〜400 字。詳細ページ本文） |
| `habitat` | TEXT | 生息地・環境の説明（「中央アジアの標高 3,000〜5,000m の岩場」） |
| `distribution_regions` | TEXT | 分布地域コードの JSON 配列（`["asia"]`）。絞り込み用 |
| `diet` | TEXT | 食性の説明文 |
| `diet_type` | TEXT | `carnivore` / `herbivore` / `omnivore` / `insectivore` / `piscivore` / `other` |
| `activity_pattern` | TEXT | `diurnal`（昼行性） / `nocturnal`（夜行性） / `crepuscular`（薄明薄暮性） / `cathemeral` |
| `social_structure` | TEXT | `solitary` / `pair` / `group` など |
| `viewing_tips` | TEXT | 動物園での見どころ（「尾の長さに注目」など） |
| `trivia` | TEXT | 豆知識（任意） |
| `iucn_status` | TEXT | `EX` `EW` `CR` `EN` `VU` `NT` `LC` `DD` `NE` |
| `iucn_assessed_year` | INTEGER | IUCN 評価年 |
| `moe_redlist_category` | TEXT | 環境省レッドリストのカテゴリ（日本の在来種のみ。例 `絶滅危惧IB類`） |
| `cites_appendix` | TEXT | `I` / `II` / `III` / NULL |
| `status` | TEXT | `draft` / `reviewed` / `published` / `rejected` |
| `model` | TEXT | 下書きを生成したモデル（人手作成なら NULL） |
| `generated_at` | TEXT | 下書き生成日時 |
| `reviewed_at` | TEXT | 確認日時 |
| `created_at` / `updated_at` | TEXT | |

※ 生成した文章の言語は日本語固定。将来多言語化するなら `animal_profile_texts(animal_id, lang, field, body)` に切り出す。

### `animal_measurements`（1 種 N 行：数値データ）

| カラム | 型 | 説明 |
|--------|----|------|
| `id` | INTEGER PK | |
| `animal_id` | TEXT | `animals.id` |
| `metric` | TEXT | 計測項目（下表の語彙） |
| `sex` | TEXT | `any` / `male` / `female` |
| `min_value` | REAL | 下限（不明なら NULL） |
| `max_value` | REAL | 上限（単一値なら min と同値） |
| `unit` | TEXT | `cm` / `kg` / `year` / `day`（metric ごとに固定、CHECK で担保） |
| `context` | TEXT | `wild`（野生） / `captive`（飼育下） / `any`。主に寿命で使う |
| `note` | TEXT | 補足（「尾を除く」「最高記録」など） |
| `source_id` | INTEGER | `animal_profile_sources.id`（任意） |
| `sort_order` | INTEGER | 表示順 |

`UNIQUE (animal_id, metric, sex, context)`

#### `metric` の語彙

| metric | 日本語ラベル | 単位 | 主な対象 |
|--------|-------------|------|----------|
| `head_body_length` | 頭胴長 | cm | 哺乳類 |
| `tail_length` | 尾長 | cm | 哺乳類 |
| `shoulder_height` | 肩高 | cm | 大型哺乳類 |
| `height` | 体高・身長 | cm | キリン、類人猿、ペンギンなど |
| `total_length` | 全長 | cm | 鳥類・爬虫類・魚類 |
| `wingspan` | 翼開長 | cm | 鳥類・コウモリ |
| `carapace_length` | 甲長 | cm | カメ |
| `weight` | 体重 | kg | 全般 |
| `lifespan` | 寿命 | year | 全般（`context` で野生/飼育下を区別） |
| `gestation_period` | 妊娠期間 | day | 哺乳類 |
| `incubation_period` | 抱卵（孵化）期間 | day | 鳥類・爬虫類 |
| `litter_size` | 産子数・産卵数 | count | 全般 |

ラベル・単位・表示フォーマッタは TypeScript 側（`src/animal-profile.ts`）に定数で持ち、
DB には語彙コードだけを入れる。語彙を増やすときはコード側の定数を追加するだけで済む。

### `animal_profile_sources`（出典）

| カラム | 型 | 説明 |
|--------|----|------|
| `id` | INTEGER PK | |
| `animal_id` | TEXT | `animals.id` |
| `title` | TEXT | ページタイトル |
| `url` | TEXT | URL |
| `publisher` | TEXT | 発行元（IUCN、環境省、動物園公式など） |
| `accessed_at` | TEXT | 参照日 |

Gemini grounding の `groundingMetadata` から自動で入れ、詳細ページ下部に「出典」として表示する。

## SQL（マイグレーション案）

```sql
CREATE TABLE IF NOT EXISTS animal_profiles (
  animal_id TEXT PRIMARY KEY REFERENCES animals(id) ON DELETE CASCADE,
  scientific_name TEXT,
  english_name TEXT,
  summary TEXT,
  description TEXT,
  habitat TEXT,
  distribution_regions TEXT,
  diet TEXT,
  diet_type TEXT CHECK (diet_type IN ('carnivore','herbivore','omnivore','insectivore','piscivore','other')),
  activity_pattern TEXT CHECK (activity_pattern IN ('diurnal','nocturnal','crepuscular','cathemeral')),
  social_structure TEXT,
  viewing_tips TEXT,
  trivia TEXT,
  iucn_status TEXT CHECK (iucn_status IN ('EX','EW','CR','EN','VU','NT','LC','DD','NE')),
  iucn_assessed_year INTEGER,
  moe_redlist_category TEXT,
  cites_appendix TEXT CHECK (cites_appendix IN ('I','II','III')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','reviewed','published','rejected')),
  model TEXT,
  generated_at TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_animal_profiles_status ON animal_profiles (status);
CREATE INDEX IF NOT EXISTS idx_animal_profiles_iucn ON animal_profiles (iucn_status);

CREATE TABLE IF NOT EXISTS animal_profile_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  animal_id TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  title TEXT,
  url TEXT NOT NULL,
  publisher TEXT,
  accessed_at TEXT NOT NULL,
  UNIQUE (animal_id, url)
);

CREATE TABLE IF NOT EXISTS animal_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  animal_id TEXT NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  sex TEXT NOT NULL DEFAULT 'any' CHECK (sex IN ('any','male','female')),
  context TEXT NOT NULL DEFAULT 'any' CHECK (context IN ('any','wild','captive')),
  min_value REAL,
  max_value REAL,
  unit TEXT NOT NULL CHECK (unit IN ('cm','kg','year','day','count')),
  note TEXT,
  source_id INTEGER REFERENCES animal_profile_sources(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK (min_value IS NOT NULL OR max_value IS NOT NULL),
  CHECK (min_value IS NULL OR max_value IS NULL OR min_value <= max_value),
  UNIQUE (animal_id, metric, sex, context)
);

CREATE INDEX IF NOT EXISTS idx_animal_measurements_metric
  ON animal_measurements (metric, max_value);
```

`idx_animal_measurements_metric` は「体重が重い順」「大きい動物ランキング」のような横断クエリ用。

## データ例（ユキヒョウ）

```json
{
  "animalId": "snow-leopard",
  "scientificName": "Panthera uncia",
  "englishName": "Snow leopard",
  "summary": "中央アジアの高山に暮らすネコ科動物。太く長い尾でバランスをとり、岩場を自在に移動する。",
  "description": "標高3,000〜5,000mの岩場や草原に単独で暮らす。厚い毛皮と広い足裏で雪や寒さに適応し…",
  "habitat": "中央アジアの山岳地帯（ヒマラヤ、天山山脈など）の岩場・高山草原",
  "distributionRegions": ["asia"],
  "diet": "アイベックスやバーラルなどの野生ヤギ類、マーモットなど",
  "dietType": "carnivore",
  "activityPattern": "crepuscular",
  "socialStructure": "solitary",
  "viewingTips": "体とほぼ同じ長さの太い尾に注目。寝るときは尾を襟巻きのように使う。",
  "iucnStatus": "VU",
  "iucnAssessedYear": 2017,
  "citesAppendix": "I",
  "measurements": [
    { "metric": "head_body_length", "sex": "any", "min": 100, "max": 130, "unit": "cm" },
    { "metric": "tail_length", "sex": "any", "min": 80, "max": 100, "unit": "cm" },
    { "metric": "weight", "sex": "male", "min": 45, "max": 55, "unit": "kg" },
    { "metric": "weight", "sex": "female", "min": 35, "max": 40, "unit": "kg" },
    { "metric": "lifespan", "context": "wild", "min": 10, "max": 12, "unit": "year" },
    { "metric": "lifespan", "context": "captive", "max": 22, "unit": "year", "note": "飼育下の長寿例" }
  ],
  "sources": [{ "title": "Panthera uncia", "url": "https://www.iucnredlist.org/...", "publisher": "IUCN" }],
  "status": "published"
}
```

（数値はイメージ。実データは出典に基づいて投入する）

## TypeScript 型

```ts
export type MeasurementMetric =
  | "head_body_length" | "tail_length" | "shoulder_height" | "height"
  | "total_length" | "wingspan" | "carapace_length" | "weight"
  | "lifespan" | "gestation_period" | "incubation_period" | "litter_size";

export interface AnimalMeasurement {
  metric: MeasurementMetric;
  sex: "any" | "male" | "female";
  context: "any" | "wild" | "captive";
  min: number | null;
  max: number | null;
  unit: "cm" | "kg" | "year" | "day" | "count";
  note?: string;
}

export interface AnimalProfile {
  animalId: string;
  scientificName?: string;
  englishName?: string;
  summary?: string;
  description?: string;
  habitat?: string;
  distributionRegions: string[];
  diet?: string;
  dietType?: "carnivore" | "herbivore" | "omnivore" | "insectivore" | "piscivore" | "other";
  activityPattern?: "diurnal" | "nocturnal" | "crepuscular" | "cathemeral";
  socialStructure?: string;
  viewingTips?: string;
  trivia?: string;
  iucnStatus?: "EX" | "EW" | "CR" | "EN" | "VU" | "NT" | "LC" | "DD" | "NE";
  iucnAssessedYear?: number;
  moeRedlistCategory?: string;
  citesAppendix?: "I" | "II" | "III";
  measurements: AnimalMeasurement[];
  sources: { title?: string; url: string; publisher?: string }[];
  status: "draft" | "reviewed" | "published" | "rejected";
}
```

## 作成フロー

1. `POST /api/animals/suggest-profile`（Basic 認証）
   `animals` のうちプロフィール未作成の種について、Gemini + Google Search grounding に
   `canonical_name` と分類（類〜種）を渡し、上記 JSON スキーマ（`responseSchema`）で出力させる。
   結果は `status = 'draft'` で保存し、grounding の出典を `animal_profile_sources` に入れる。
2. `/admin/animal-management` にプロフィール列を追加し、下書きの確認・編集・公開を行う。
   数値の妥当性チェック（min ≤ max、体重 0 以下など）は保存時に弾く。
3. 公開画面・API・MCP は `status = 'published'` のみ参照する。

既存の `classify:unclassified` と同様に、全件バッチ用スクリプト
`scripts/generate-animal-profiles.mjs` を用意する想定。

## 利用先

| 場所 | 使う項目 |
|------|----------|
| `/animal/:displayName` | 全項目。数値は「体長 100〜130cm（尾を除く）」「体重 オス 45〜55kg / メス 35〜40kg」のように整形 |
| `/animals` 一覧カード | `summary`、IUCN バッジ |
| `/animals` 絞り込み | `activity_pattern`（夜行性）、`iucn_status`（絶滅危惧種）、`distribution_regions` |
| `/api/animals/:id/profile` | JSON で全項目 |
| MCP `find_animal` | `summary`・主要数値・IUCN を追加で返す |

## 検討事項

- **表示名単位の補足**: 施設独自の個体情報（名前・誕生日など）はプロフィールではなく別テーブル（`zoo_animal_individuals` など）で扱う。
- **品種・家畜**: イヌ・ニワトリなど品種差が大きいものは `note` で「品種により大きく異なる」とし、数値は空でもよい。
- **再生成**: 下書きを作り直す場合は `published` を上書きしない。必要なら `animal_profile_revisions` に履歴を残す（画像の `animal_image_generations` と同じ考え方）。
