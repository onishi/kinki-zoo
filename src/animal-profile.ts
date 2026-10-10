// 種ごとのプロフィール（数値データ・日本語解説・保全状況）。
// 設計は docs/animal-profile-design.md を参照。

export type MeasurementMetric =
  | "head_body_length"
  | "tail_length"
  | "shoulder_height"
  | "height"
  | "total_length"
  | "wingspan"
  | "carapace_length"
  | "weight"
  | "lifespan"
  | "gestation_period"
  | "incubation_period"
  | "litter_size";

export type MeasurementUnit = "cm" | "kg" | "year" | "day" | "count";
export type MeasurementSex = "any" | "male" | "female";
export type MeasurementContext = "any" | "wild" | "captive";
export type DietType = "carnivore" | "herbivore" | "omnivore" | "insectivore" | "piscivore" | "other";
export type ActivityPattern = "diurnal" | "nocturnal" | "crepuscular" | "cathemeral";
export type SocialStructure = "solitary" | "pair" | "group" | "colony";
export type IucnStatus = "EX" | "EW" | "CR" | "EN" | "VU" | "NT" | "LC" | "DD" | "NE";
export type CitesAppendix = "I" | "II" | "III";
export type AnimalProfileStatus = "draft" | "reviewed" | "published" | "rejected";

export interface AnimalMeasurement {
  metric: MeasurementMetric;
  sex: MeasurementSex;
  context: MeasurementContext;
  min: number | null;
  max: number | null;
  unit: MeasurementUnit;
  note?: string;
}

export interface AnimalProfileSource {
  title?: string;
  url: string;
  publisher?: string;
}

export interface AnimalProfileContent {
  scientificName?: string;
  englishName?: string;
  summary?: string;
  description?: string;
  habitat?: string;
  distributionRegions: DistributionRegion[];
  diet?: string;
  dietType?: DietType;
  activityPattern?: ActivityPattern;
  socialStructure?: SocialStructure;
  viewingTips?: string;
  trivia?: string;
  iucnStatus?: IucnStatus;
  iucnAssessedYear?: number;
  moeRedlistCategory?: string;
  citesAppendix?: CitesAppendix;
  measurements: AnimalMeasurement[];
  sources: AnimalProfileSource[];
}

export interface AnimalProfile extends AnimalProfileContent {
  animalId: string;
  status: AnimalProfileStatus;
  model?: string;
  generatedAt?: string;
  reviewedAt?: string;
  updatedAt: string;
}

export interface MetricDefinition {
  label: string;
  unit: MeasurementUnit;
}

// 表示順はこの定義順。
export const METRIC_DEFINITIONS: Record<MeasurementMetric, MetricDefinition> = {
  head_body_length: { label: "頭胴長", unit: "cm" },
  tail_length: { label: "尾長", unit: "cm" },
  shoulder_height: { label: "肩高", unit: "cm" },
  height: { label: "体高・身長", unit: "cm" },
  total_length: { label: "全長", unit: "cm" },
  wingspan: { label: "翼開長", unit: "cm" },
  carapace_length: { label: "甲長", unit: "cm" },
  weight: { label: "体重", unit: "kg" },
  lifespan: { label: "寿命", unit: "year" },
  gestation_period: { label: "妊娠期間", unit: "day" },
  incubation_period: { label: "抱卵期間", unit: "day" },
  litter_size: { label: "産子数・産卵数", unit: "count" },
};

export const MEASUREMENT_METRICS = Object.keys(METRIC_DEFINITIONS) as MeasurementMetric[];

export const SEX_LABELS: Record<MeasurementSex, string> = { any: "", male: "オス", female: "メス" };
export const CONTEXT_LABELS: Record<MeasurementContext, string> = { any: "", wild: "野生", captive: "飼育下" };

export const DIET_TYPE_LABELS: Record<DietType, string> = {
  carnivore: "肉食",
  herbivore: "草食",
  omnivore: "雑食",
  insectivore: "昆虫食",
  piscivore: "魚食",
  other: "その他",
};

export const ACTIVITY_PATTERN_LABELS: Record<ActivityPattern, string> = {
  diurnal: "昼行性",
  nocturnal: "夜行性",
  crepuscular: "薄明薄暮性",
  cathemeral: "昼夜とも活動",
};

export const SOCIAL_STRUCTURE_LABELS: Record<SocialStructure, string> = {
  solitary: "単独",
  pair: "ペア",
  group: "群れ",
  colony: "コロニー",
};

export const IUCN_STATUS_LABELS: Record<IucnStatus, string> = {
  EX: "絶滅",
  EW: "野生絶滅",
  CR: "深刻な危機",
  EN: "危機",
  VU: "危急",
  NT: "準絶滅危惧",
  LC: "低懸念",
  DD: "情報不足",
  NE: "未評価",
};

export const DISTRIBUTION_REGION_LABELS = {
  japan: "日本",
  asia: "アジア",
  europe: "ヨーロッパ",
  africa: "アフリカ",
  north_america: "北アメリカ",
  south_america: "南アメリカ",
  oceania: "オセアニア",
  antarctica: "南極",
  ocean: "海洋",
  domestic: "家畜・飼育品種",
} as const;

export type DistributionRegion = keyof typeof DISTRIBUTION_REGION_LABELS;

export const PROFILE_STATUS_LABELS: Record<AnimalProfileStatus, string> = {
  draft: "下書き",
  reviewed: "確認済み",
  published: "公開",
  rejected: "却下",
};

function pickEnum<T extends string>(value: unknown, labels: Record<T, unknown>): T | undefined {
  return typeof value === "string" && value in labels ? (value as T) : undefined;
}

function cleanText(value: unknown, maxLength = 2000): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function cleanNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(num) && num > 0 ? num : null;
}

function cleanUrl(value: unknown): string | undefined {
  const text = cleanText(value, 1000);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function sanitizeMeasurements(values: unknown): AnimalMeasurement[] {
  if (!Array.isArray(values)) return [];
  const byKey = new Map<string, AnimalMeasurement>();
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const metric = pickEnum(item.metric, METRIC_DEFINITIONS);
    if (!metric) continue;
    let min = cleanNumber(item.min);
    let max = cleanNumber(item.max);
    if (min === null && max === null) continue;
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    const measurement: AnimalMeasurement = {
      metric,
      sex: pickEnum(item.sex, SEX_LABELS) ?? "any",
      context: pickEnum(item.context, CONTEXT_LABELS) ?? "any",
      min,
      max,
      // 単位は metric ごとに固定。入力値の unit は信用しない。
      unit: METRIC_DEFINITIONS[metric].unit,
      note: cleanText(item.note, 200),
    };
    byKey.set(`${measurement.metric}|${measurement.sex}|${measurement.context}`, measurement);
  }
  return sortMeasurements([...byKey.values()]);
}

export function sortMeasurements(measurements: AnimalMeasurement[]): AnimalMeasurement[] {
  const sexOrder: MeasurementSex[] = ["any", "male", "female"];
  const contextOrder: MeasurementContext[] = ["any", "wild", "captive"];
  return [...measurements].sort(
    (a, b) =>
      MEASUREMENT_METRICS.indexOf(a.metric) - MEASUREMENT_METRICS.indexOf(b.metric) ||
      contextOrder.indexOf(a.context) - contextOrder.indexOf(b.context) ||
      sexOrder.indexOf(a.sex) - sexOrder.indexOf(b.sex)
  );
}

export function sanitizeSources(values: unknown): AnimalProfileSource[] {
  if (!Array.isArray(values)) return [];
  const byUrl = new Map<string, AnimalProfileSource>();
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const item = value as Record<string, unknown>;
    const url = cleanUrl(item.url);
    if (!url) continue;
    byUrl.set(url, { url, title: cleanText(item.title, 300), publisher: cleanText(item.publisher, 100) });
  }
  return [...byUrl.values()].slice(0, 20);
}

export function sanitizeProfileContent(value: unknown): AnimalProfileContent {
  const item = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const year = cleanNumber(item.iucnAssessedYear);
  const regions = Array.isArray(item.distributionRegions)
    ? [...new Set(item.distributionRegions.filter((region): region is DistributionRegion =>
        typeof region === "string" && region in DISTRIBUTION_REGION_LABELS
      ))]
    : [];
  return {
    scientificName: cleanText(item.scientificName, 200),
    englishName: cleanText(item.englishName, 200),
    summary: cleanText(item.summary, 300),
    description: cleanText(item.description, 2000),
    habitat: cleanText(item.habitat, 500),
    distributionRegions: regions,
    diet: cleanText(item.diet, 500),
    dietType: pickEnum(item.dietType, DIET_TYPE_LABELS),
    activityPattern: pickEnum(item.activityPattern, ACTIVITY_PATTERN_LABELS),
    socialStructure: pickEnum(item.socialStructure, SOCIAL_STRUCTURE_LABELS),
    viewingTips: cleanText(item.viewingTips, 500),
    trivia: cleanText(item.trivia, 500),
    iucnStatus: pickEnum(item.iucnStatus, IUCN_STATUS_LABELS),
    iucnAssessedYear: year && year >= 1960 && year <= 2100 ? Math.floor(year) : undefined,
    moeRedlistCategory: cleanText(item.moeRedlistCategory, 50),
    citesAppendix: pickEnum(item.citesAppendix, { I: "I", II: "II", III: "III" }),
    measurements: sanitizeMeasurements(item.measurements),
    sources: sanitizeSources(item.sources),
  };
}

// ---------- D1 ----------

interface AnimalProfileRow {
  animal_id: string;
  scientific_name: string | null;
  english_name: string | null;
  summary: string | null;
  description: string | null;
  habitat: string | null;
  distribution_regions: string | null;
  diet: string | null;
  diet_type: string | null;
  activity_pattern: string | null;
  social_structure: string | null;
  viewing_tips: string | null;
  trivia: string | null;
  iucn_status: string | null;
  iucn_assessed_year: number | null;
  moe_redlist_category: string | null;
  cites_appendix: string | null;
  status: AnimalProfileStatus;
  model: string | null;
  generated_at: string | null;
  reviewed_at: string | null;
  updated_at: string;
}

interface AnimalMeasurementRow {
  animal_id: string;
  metric: string;
  sex: string;
  context: string;
  min_value: number | null;
  max_value: number | null;
  note: string | null;
}

interface AnimalProfileSourceRow {
  animal_id: string;
  title: string | null;
  url: string;
  publisher: string | null;
}

function parseJsonArray(value: string | null): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToProfile(
  row: AnimalProfileRow,
  measurementRows: AnimalMeasurementRow[],
  sourceRows: AnimalProfileSourceRow[]
): AnimalProfile {
  const content = sanitizeProfileContent({
    scientificName: row.scientific_name,
    englishName: row.english_name,
    summary: row.summary,
    description: row.description,
    habitat: row.habitat,
    distributionRegions: parseJsonArray(row.distribution_regions),
    diet: row.diet,
    dietType: row.diet_type,
    activityPattern: row.activity_pattern,
    socialStructure: row.social_structure,
    viewingTips: row.viewing_tips,
    trivia: row.trivia,
    iucnStatus: row.iucn_status,
    iucnAssessedYear: row.iucn_assessed_year,
    moeRedlistCategory: row.moe_redlist_category,
    citesAppendix: row.cites_appendix,
    measurements: measurementRows.map((m) => ({
      metric: m.metric,
      sex: m.sex,
      context: m.context,
      min: m.min_value,
      max: m.max_value,
      note: m.note,
    })),
    sources: sourceRows,
  });
  return {
    ...content,
    animalId: row.animal_id,
    status: row.status,
    model: row.model ?? undefined,
    generatedAt: row.generated_at ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    updatedAt: row.updated_at,
  };
}

const PROFILE_COLUMNS = `animal_id, scientific_name, english_name, summary, description, habitat,
  distribution_regions, diet, diet_type, activity_pattern, social_structure, viewing_tips, trivia,
  iucn_status, iucn_assessed_year, moe_redlist_category, cites_appendix, status, model,
  generated_at, reviewed_at, updated_at`;

async function loadProfilesByIds(
  db: D1Database,
  animalIds: string[],
  publishedOnly: boolean
): Promise<Map<string, AnimalProfile>> {
  const profiles = new Map<string, AnimalProfile>();
  if (animalIds.length === 0) return profiles;
  const placeholders = animalIds.map(() => "?").join(", ");
  const statusFilter = publishedOnly ? "AND status = 'published'" : "";
  const [profileResult, measurementResult, sourceResult] = await db.batch([
    db
      .prepare(`SELECT ${PROFILE_COLUMNS} FROM animal_profiles WHERE animal_id IN (${placeholders}) ${statusFilter}`)
      .bind(...animalIds),
    db
      .prepare(
        `SELECT animal_id, metric, sex, context, min_value, max_value, note
         FROM animal_measurements
         WHERE animal_id IN (${placeholders})
         ORDER BY sort_order, id`
      )
      .bind(...animalIds),
    db
      .prepare(
        `SELECT animal_id, title, url, publisher
         FROM animal_profile_sources
         WHERE animal_id IN (${placeholders})
         ORDER BY id`
      )
      .bind(...animalIds),
  ]);
  const measurementRows = (measurementResult.results ?? []) as unknown as AnimalMeasurementRow[];
  const sourceRows = (sourceResult.results ?? []) as unknown as AnimalProfileSourceRow[];
  for (const row of (profileResult.results ?? []) as unknown as AnimalProfileRow[]) {
    profiles.set(
      row.animal_id,
      rowToProfile(
        row,
        measurementRows.filter((m) => m.animal_id === row.animal_id),
        sourceRows.filter((s) => s.animal_id === row.animal_id)
      )
    );
  }
  return profiles;
}

export async function loadAnimalProfile(
  db: D1Database,
  animalId: string,
  options: { publishedOnly: boolean }
): Promise<AnimalProfile | null> {
  const profiles = await loadProfilesByIds(db, [animalId], options.publishedOnly);
  return profiles.get(animalId) ?? null;
}

export async function saveAnimalProfile(
  db: D1Database,
  animalId: string,
  content: AnimalProfileContent,
  meta: { status: AnimalProfileStatus; model?: string | null; generatedAt?: string | null }
): Promise<void> {
  const now = new Date().toISOString();
  const reviewedAt = meta.status === "reviewed" || meta.status === "published" ? now : null;
  const statements = [
    db
      .prepare(
        `INSERT INTO animal_profiles (
           animal_id, scientific_name, english_name, summary, description, habitat,
           distribution_regions, diet, diet_type, activity_pattern, social_structure, viewing_tips, trivia,
           iucn_status, iucn_assessed_year, moe_redlist_category, cites_appendix, status, model,
           generated_at, reviewed_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (animal_id) DO UPDATE SET
           scientific_name = excluded.scientific_name,
           english_name = excluded.english_name,
           summary = excluded.summary,
           description = excluded.description,
           habitat = excluded.habitat,
           distribution_regions = excluded.distribution_regions,
           diet = excluded.diet,
           diet_type = excluded.diet_type,
           activity_pattern = excluded.activity_pattern,
           social_structure = excluded.social_structure,
           viewing_tips = excluded.viewing_tips,
           trivia = excluded.trivia,
           iucn_status = excluded.iucn_status,
           iucn_assessed_year = excluded.iucn_assessed_year,
           moe_redlist_category = excluded.moe_redlist_category,
           cites_appendix = excluded.cites_appendix,
           status = excluded.status,
           model = COALESCE(excluded.model, animal_profiles.model),
           generated_at = COALESCE(excluded.generated_at, animal_profiles.generated_at),
           reviewed_at = COALESCE(excluded.reviewed_at, animal_profiles.reviewed_at),
           updated_at = excluded.updated_at`
      )
      .bind(
        animalId,
        content.scientificName ?? null,
        content.englishName ?? null,
        content.summary ?? null,
        content.description ?? null,
        content.habitat ?? null,
        JSON.stringify(content.distributionRegions),
        content.diet ?? null,
        content.dietType ?? null,
        content.activityPattern ?? null,
        content.socialStructure ?? null,
        content.viewingTips ?? null,
        content.trivia ?? null,
        content.iucnStatus ?? null,
        content.iucnAssessedYear ?? null,
        content.moeRedlistCategory ?? null,
        content.citesAppendix ?? null,
        meta.status,
        meta.model ?? null,
        meta.generatedAt ?? null,
        reviewedAt,
        now,
        now
      ),
    db.prepare(`DELETE FROM animal_measurements WHERE animal_id = ?`).bind(animalId),
    db.prepare(`DELETE FROM animal_profile_sources WHERE animal_id = ?`).bind(animalId),
    ...sortMeasurements(content.measurements).map((m, index) =>
      db
        .prepare(
          `INSERT INTO animal_measurements (animal_id, metric, sex, context, min_value, max_value, unit, note, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(animalId, m.metric, m.sex, m.context, m.min, m.max, m.unit, m.note ?? null, index)
    ),
    ...content.sources.map((source) =>
      db
        .prepare(
          `INSERT INTO animal_profile_sources (animal_id, title, url, publisher, accessed_at)
           VALUES (?, ?, ?, ?, ?)`
        )
        .bind(animalId, source.title ?? null, source.url, source.publisher ?? null, now)
    ),
  ];
  await db.batch(statements);
}

export async function updateAnimalProfileStatus(
  db: D1Database,
  animalId: string,
  status: AnimalProfileStatus
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `UPDATE animal_profiles
       SET status = ?,
           reviewed_at = CASE WHEN ? IN ('reviewed', 'published') THEN ? ELSE reviewed_at END,
           updated_at = ?
       WHERE animal_id = ?`
    )
    .bind(status, status, now, now, animalId)
    .run();
}

export interface ProfileTargetAnimal {
  id: string;
  canonicalName: string;
  className: string;
  orderName: string;
  familyName: string;
  genusName: string;
  speciesName: string;
}

interface ProfileTargetRow {
  id: string;
  canonical_name: string;
  class_name: string;
  order_name: string;
  family_name: string;
  genus_name: string;
  species_name: string;
}

function toTarget(row: ProfileTargetRow): ProfileTargetAnimal {
  return {
    id: row.id,
    canonicalName: row.canonical_name,
    className: row.class_name,
    orderName: row.order_name,
    familyName: row.family_name,
    genusName: row.genus_name,
    speciesName: row.species_name,
  };
}

/**
 * 下書き生成の対象を返す。animalIds 指定時はそれを対象にし、確認済み・公開済みは除く。
 * 未指定時は実際に施設で見られる種のうち、プロフィール未作成のものを返す。
 */
export async function loadProfileTargets(
  db: D1Database,
  limit: number,
  animalIds: string[] = []
): Promise<ProfileTargetAnimal[]> {
  if (animalIds.length > 0) {
    const result = await db
      .prepare(
        `SELECT a.id, a.canonical_name, a.class_name, a.order_name, a.family_name, a.genus_name, a.species_name
         FROM animals a
         LEFT JOIN animal_profiles p ON p.animal_id = a.id
         WHERE a.id IN (${animalIds.map(() => "?").join(", ")})
           AND (p.status IS NULL OR p.status IN ('draft', 'rejected'))
         LIMIT ?`
      )
      .bind(...animalIds, limit)
      .all<ProfileTargetRow>();
    return (result.results ?? []).map(toTarget);
  }
  const result = await db
    .prepare(
      `SELECT a.id, a.canonical_name, a.class_name, a.order_name, a.family_name, a.genus_name, a.species_name
       FROM animals a
       LEFT JOIN animal_profiles p ON p.animal_id = a.id
       WHERE p.animal_id IS NULL
         AND EXISTS (SELECT 1 FROM zoo_animals za WHERE za.animal_id = a.id)
       ORDER BY (SELECT COUNT(DISTINCT za.zoo_id) FROM zoo_animals za WHERE za.animal_id = a.id) DESC,
                COALESCE(a.sort_key, a.canonical_name)
       LIMIT ?`
    )
    .bind(limit)
    .all<ProfileTargetRow>();
  return (result.results ?? []).map(toTarget);
}

export interface ProfileAdminRow {
  animalId: string;
  canonicalName: string;
  className: string;
  displayName: string | null;
  zooCount: number;
  status: AnimalProfileStatus | null;
  summary: string | null;
  measurementCount: number;
  updatedAt: string | null;
}

export async function loadProfileAdminRows(
  db: D1Database,
  status: AnimalProfileStatus | "none" | null,
  query: string | null
): Promise<ProfileAdminRow[]> {
  const conditions: string[] = ["EXISTS (SELECT 1 FROM zoo_animals za WHERE za.animal_id = a.id)"];
  const binds: unknown[] = [];
  if (status === "none") conditions.push("p.animal_id IS NULL");
  else if (status) {
    conditions.push("p.status = ?");
    binds.push(status);
  }
  if (query) {
    conditions.push("(a.canonical_name LIKE ? OR a.species_name LIKE ? OR p.scientific_name LIKE ?)");
    binds.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  const result = await db
    .prepare(
      `SELECT
         a.id AS animal_id,
         a.canonical_name,
         a.class_name,
         (SELECT MIN(za.display_name) FROM zoo_animals za WHERE za.animal_id = a.id) AS display_name,
         (SELECT COUNT(DISTINCT za.zoo_id) FROM zoo_animals za WHERE za.animal_id = a.id) AS zoo_count,
         p.status,
         p.summary,
         (SELECT COUNT(*) FROM animal_measurements m WHERE m.animal_id = a.id) AS measurement_count,
         p.updated_at
       FROM animals a
       LEFT JOIN animal_profiles p ON p.animal_id = a.id
       WHERE ${conditions.join(" AND ")}
       ORDER BY zoo_count DESC, COALESCE(a.sort_key, a.canonical_name)`
    )
    .bind(...binds)
    .all<{
      animal_id: string;
      canonical_name: string;
      class_name: string;
      display_name: string | null;
      zoo_count: number;
      status: AnimalProfileStatus | null;
      summary: string | null;
      measurement_count: number;
      updated_at: string | null;
    }>();
  return (result.results ?? []).map((row) => ({
    animalId: row.animal_id,
    canonicalName: row.canonical_name,
    className: row.class_name,
    displayName: row.display_name,
    zooCount: row.zoo_count,
    status: row.status,
    summary: row.summary,
    measurementCount: row.measurement_count,
    updatedAt: row.updated_at,
  }));
}

export async function loadProfileStatusCounts(db: D1Database): Promise<Record<AnimalProfileStatus | "none", number>> {
  const result = await db
    .prepare(
      `SELECT COALESCE(p.status, 'none') AS status, COUNT(*) AS count
       FROM animals a
       LEFT JOIN animal_profiles p ON p.animal_id = a.id
       WHERE EXISTS (SELECT 1 FROM zoo_animals za WHERE za.animal_id = a.id)
       GROUP BY COALESCE(p.status, 'none')`
    )
    .all<{ status: AnimalProfileStatus | "none"; count: number }>();
  const counts = { none: 0, draft: 0, reviewed: 0, published: 0, rejected: 0 };
  for (const row of result.results ?? []) counts[row.status] = row.count;
  return counts;
}

// ---------- Gemini ----------

export const GEMINI_PROFILE_MODEL = "gemini-2.5-flash";

export function buildProfilePrompt(animal: ProfileTargetAnimal): string {
  const metricLines = MEASUREMENT_METRICS.map(
    (metric) => `  - ${metric}: ${METRIC_DEFINITIONS[metric].label}（単位 ${METRIC_DEFINITIONS[metric].unit}）`
  ).join("\n");
  return `日本の動物園サイトに掲載する動物プロフィールを作成してください。
Google検索で信頼できる情報源（IUCN レッドリスト、環境省、大学・博物館、動物園・水族館の公式サイト、学術文献、Wikipedia など）を確認し、確認できた事実だけを書いてください。

対象の種:
- 和名: ${animal.canonicalName}
- 分類: ${animal.className} / ${animal.orderName} / ${animal.familyName} / ${animal.genusName} / ${animal.speciesName}

出力は次の JSON オブジェクト1つだけにしてください。説明文やコードフェンスは不要です。
わからない項目は null、数値データは確認できたものだけ measurements に入れてください。

{
  "scientificName": "学名（イタリックなし、例: Panthera uncia）",
  "englishName": "英名",
  "summary": "一言紹介。日本語60字程度。です・ます調にしない",
  "description": "詳細解説。日本語200〜400字。形態・生態・人との関わりなど。です・ます調にしない",
  "habitat": "生息地・生息環境の説明（日本語）",
  "distributionRegions": ["japan" | "asia" | "europe" | "africa" | "north_america" | "south_america" | "oceania" | "antarctica" | "ocean" | "domestic"],
  "diet": "食性の説明（日本語）",
  "dietType": "carnivore" | "herbivore" | "omnivore" | "insectivore" | "piscivore" | "other",
  "activityPattern": "diurnal" | "nocturnal" | "crepuscular" | "cathemeral",
  "socialStructure": "solitary" | "pair" | "group" | "colony",
  "viewingTips": "動物園で観察するときの見どころ（日本語、1〜2文）",
  "trivia": "豆知識（日本語、1〜2文）",
  "iucnStatus": "EX" | "EW" | "CR" | "EN" | "VU" | "NT" | "LC" | "DD" | "NE",
  "iucnAssessedYear": 2020,
  "moeRedlistCategory": "環境省レッドリストのカテゴリ（日本の在来種で該当する場合のみ。例: 絶滅危惧IB類）",
  "citesAppendix": "I" | "II" | "III" | null,
  "measurements": [
    { "metric": "weight", "sex": "any" | "male" | "female", "context": "any" | "wild" | "captive", "min": 35, "max": 55, "note": "補足（任意）" }
  ],
  "sources": [{ "title": "ページタイトル", "url": "https://...", "publisher": "発行元" }]
}

measurements の metric は次のいずれか。単位は固定なので換算して数値だけ入れる（g は kg に、m は cm に、月は日や年に換算）。
${metricLines}

measurements のルール:
- 分類群に合った指標を選ぶ（哺乳類は頭胴長・尾長・肩高、鳥類は全長・翼開長、カメは甲長、ヘビ・魚は全長など）。
- 雌雄で大きく異なる場合は sex を male / female に分けて書く。
- 寿命は野生（wild）と飼育下（captive）を区別できる場合は分ける。
- 単一の値しかない場合は min と max に同じ値を入れる。最大値しかわからない場合は min を null にする。
- 家畜・品種差の大きい動物は無理に数値を入れず、note で補足するか省略する。`;
}

export function parseProfileResponse(jsonText: string): AnimalProfileContent {
  return sanitizeProfileContent(JSON.parse(jsonText) as unknown);
}

// ---------- 表示 ----------

function formatNumber(value: number): string {
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return rounded.toLocaleString("ja-JP");
}

function convertForDisplay(value: number, scale: "g" | "m" | null): string {
  if (scale === "g") return formatNumber(value * 1000);
  if (scale === "m") return formatNumber(value / 100);
  return formatNumber(value);
}

const UNIT_SUFFIX: Record<MeasurementUnit, string> = { cm: "cm", kg: "kg", year: "年", day: "日", count: "" };

/** 例: 100〜130cm / 約350g / 最大22年 */
export function formatMeasurementValue(measurement: Pick<AnimalMeasurement, "min" | "max" | "unit">): string {
  const { min, max, unit } = measurement;
  const reference = max ?? min ?? 0;
  const scale = unit === "kg" && reference < 1 ? "g" : unit === "cm" && reference >= 1000 ? "m" : null;
  const suffix = scale ?? UNIT_SUFFIX[unit];
  const fmt = (value: number) => convertForDisplay(value, scale);
  if (min !== null && max !== null) {
    return min === max ? `約${fmt(min)}${suffix}` : `${fmt(min)}〜${fmt(max)}${suffix}`;
  }
  if (max !== null) return `最大${fmt(max)}${suffix}`;
  if (min !== null) return `${fmt(min)}${suffix}以上`;
  return "";
}

export interface MeasurementDisplayRow {
  metric: MeasurementMetric;
  label: string;
  values: Array<{ qualifier: string; value: string; note?: string }>;
}

export function groupMeasurementsForDisplay(measurements: AnimalMeasurement[]): MeasurementDisplayRow[] {
  const rows: MeasurementDisplayRow[] = [];
  for (const m of sortMeasurements(measurements)) {
    let row = rows.find((item) => item.metric === m.metric);
    if (!row) {
      row = { metric: m.metric, label: METRIC_DEFINITIONS[m.metric].label, values: [] };
      rows.push(row);
    }
    const qualifier = [CONTEXT_LABELS[m.context], SEX_LABELS[m.sex]].filter(Boolean).join("・");
    row.values.push({ qualifier, value: formatMeasurementValue(m), note: m.note });
  }
  return rows;
}

/** MCP・API 向けに、主要な数値を日本語の短い文字列にまとめる。 */
export function summarizeMeasurements(measurements: AnimalMeasurement[]): Record<string, string> {
  const summary: Record<string, string> = {};
  for (const row of groupMeasurementsForDisplay(measurements)) {
    summary[row.label] = row.values
      .map((value) => (value.qualifier ? `${value.qualifier} ${value.value}` : value.value))
      .join(" / ");
  }
  return summary;
}

function escape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}|\r\n\r\n/)
    .map((para) => `<p>${escape(para.trim()).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

export const ANIMAL_PROFILE_CSS = `
    .profile-summary { font-size: 0.95rem; line-height: 1.7; color: #333; }
    .profile-names { color: #5f5f5f; font-size: 0.85rem; }
    .profile-names i { font-style: italic; }
    .profile-badges { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .profile-badge { border: 1px solid #d7e4dd; background: #f7fbf8; color: #244d37; font-size: 0.75rem; padding: 0.15rem 0.5rem; }
    .profile-badge--iucn-CR, .profile-badge--iucn-EN, .profile-badge--iucn-EW, .profile-badge--iucn-EX { border-color: #e2b4b4; background: #fdf3f3; color: #8a2525; }
    .profile-badge--iucn-VU, .profile-badge--iucn-NT { border-color: #ead7a8; background: #fdf9ee; color: #7a5a12; }
    .profile-body { display: grid; gap: 1rem; }
    .profile-text { display: grid; gap: 0.5rem; font-size: 0.92rem; line-height: 1.8; }
    .profile-measurements { display: grid; grid-template-columns: max-content 1fr; border: 1px solid #e1e1e1; font-size: 0.88rem; }
    .profile-measurements dt { background: #f6f8f7; color: #555; padding: 0.45rem 0.7rem; border-bottom: 1px solid #e1e1e1; }
    .profile-measurements dd { padding: 0.45rem 0.7rem; border-bottom: 1px solid #e1e1e1; }
    .profile-measurements dt:last-of-type, .profile-measurements dd:last-of-type { border-bottom: 0; }
    .profile-measurements small { color: #6e6e6e; }
    .profile-facts { display: grid; gap: 0.6rem; }
    .profile-facts h3 { font-size: 0.85rem; color: #555; margin-bottom: 0.2rem; }
    .profile-facts p { font-size: 0.9rem; line-height: 1.7; }
    .profile-sources { font-size: 0.78rem; color: #6e6e6e; }
    .profile-sources ul { list-style: none; display: grid; gap: 0.2rem; margin-top: 0.25rem; }
    .profile-sources a { color: #1f5b45; overflow-wrap: anywhere; }
    @media (max-width: 700px) {
      .profile-measurements { grid-template-columns: 1fr; }
      .profile-measurements dt { border-bottom: 0; padding-bottom: 0.15rem; }
    }`;

export function renderAnimalProfileBadges(profile: AnimalProfile): string {
  const badges: string[] = [];
  if (profile.iucnStatus) {
    badges.push(
      `<span class="profile-badge profile-badge--iucn-${profile.iucnStatus}" title="IUCNレッドリスト${profile.iucnAssessedYear ? `（${profile.iucnAssessedYear}年評価）` : ""}">IUCN ${profile.iucnStatus} ${escape(IUCN_STATUS_LABELS[profile.iucnStatus])}</span>`
    );
  }
  if (profile.moeRedlistCategory) badges.push(`<span class="profile-badge">環境省 ${escape(profile.moeRedlistCategory)}</span>`);
  if (profile.citesAppendix) badges.push(`<span class="profile-badge">ワシントン条約 附属書${profile.citesAppendix}</span>`);
  if (profile.activityPattern) badges.push(`<span class="profile-badge">${ACTIVITY_PATTERN_LABELS[profile.activityPattern]}</span>`);
  if (profile.dietType) badges.push(`<span class="profile-badge">${DIET_TYPE_LABELS[profile.dietType]}</span>`);
  if (profile.socialStructure) badges.push(`<span class="profile-badge">${SOCIAL_STRUCTURE_LABELS[profile.socialStructure]}で暮らす</span>`);
  return badges.length > 0 ? `<div class="profile-badges">${badges.join("")}</div>` : "";
}

/** 詳細ページのヒーロー下に置く「特徴」セクション。 */
export function renderAnimalProfileSection(profile: AnimalProfile): string {
  const measurementRows = groupMeasurementsForDisplay(profile.measurements);
  const measurementsHtml = measurementRows.length > 0
    ? `<dl class="profile-measurements">${measurementRows
        .map(
          (row) => `<dt>${escape(row.label)}</dt><dd>${row.values
            .map(
              (value) =>
                `${value.qualifier ? `${escape(value.qualifier)} ` : ""}${escape(value.value)}${value.note ? ` <small>（${escape(value.note)}）</small>` : ""}`
            )
            .join(" / ")}</dd>`
        )
        .join("")}</dl>`
    : "";
  const regions = profile.distributionRegions.map((region) => DISTRIBUTION_REGION_LABELS[region]).join("・");
  const facts: Array<[string, string | undefined]> = [
    ["生息地", [profile.habitat, regions && !profile.habitat?.includes(regions) ? `（${regions}）` : ""].filter(Boolean).join("") || undefined],
    ["食べもの", profile.diet],
    ["見どころ", profile.viewingTips],
    ["豆知識", profile.trivia],
  ];
  const factsHtml = facts
    .filter(([, value]) => value)
    .map(([label, value]) => `<div><h3>${escape(label)}</h3><p>${escape(value!)}</p></div>`)
    .join("");
  const sourcesHtml = profile.sources.length > 0
    ? `<details class="profile-sources"><summary>出典（${profile.sources.length}件）</summary><ul>${profile.sources
        .map(
          (source) =>
            `<li><a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">${escape(source.title ?? source.url)}</a>${source.publisher ? ` - ${escape(source.publisher)}` : ""}</li>`
        )
        .join("")}</ul></details>`
    : "";
  return `
    <section class="animal-profile">
      <h2>特徴</h2>
      <div class="profile-body">
        ${profile.description ? `<div class="profile-text">${paragraphs(profile.description)}</div>` : ""}
        ${measurementsHtml}
        ${factsHtml ? `<div class="profile-facts">${factsHtml}</div>` : ""}
        ${sourcesHtml}
      </div>
    </section>`;
}

/** ヒーロー部分（名前の下）に出す一言紹介・学名・バッジ。 */
export function renderAnimalProfileHero(profile: AnimalProfile): string {
  const names = [
    profile.scientificName ? `<i>${escape(profile.scientificName)}</i>` : "",
    profile.englishName ? escape(profile.englishName) : "",
  ].filter(Boolean).join(" / ");
  return `
    ${names ? `<p class="profile-names">${names}</p>` : ""}
    ${profile.summary ? `<p class="profile-summary">${escape(profile.summary)}</p>` : ""}
    ${renderAnimalProfileBadges(profile)}`;
}

/** API レスポンス用の JSON 形。 */
export function toApiProfile(profile: AnimalProfile) {
  return {
    ...profile,
    measurementsSummary: summarizeMeasurements(profile.measurements),
  };
}

// ---------- 検索 ----------

/** 公開済みプロフィールを animals.canonical_name をキーにまとめて読む（出典は読まない）。検索・一覧用。 */
export async function loadPublishedProfileIndex(db: D1Database): Promise<Map<string, AnimalProfile>> {
  const [profileResult, measurementResult] = await db.batch([
    db.prepare(
      `SELECT ${PROFILE_COLUMNS.split(",").map((column) => `p.${column.trim()}`).join(", ")}, a.canonical_name
       FROM animal_profiles p
       JOIN animals a ON a.id = p.animal_id
       WHERE p.status = 'published'`
    ),
    db.prepare(
      `SELECT m.animal_id, m.metric, m.sex, m.context, m.min_value, m.max_value, m.note
       FROM animal_measurements m
       JOIN animal_profiles p ON p.animal_id = m.animal_id AND p.status = 'published'
       ORDER BY m.sort_order, m.id`
    ),
  ]);
  const measurementsById = new Map<string, AnimalMeasurementRow[]>();
  for (const row of (measurementResult.results ?? []) as unknown as AnimalMeasurementRow[]) {
    const list = measurementsById.get(row.animal_id) ?? [];
    list.push(row);
    measurementsById.set(row.animal_id, list);
  }
  const index = new Map<string, AnimalProfile>();
  for (const row of (profileResult.results ?? []) as unknown as Array<AnimalProfileRow & { canonical_name: string }>) {
    index.set(row.canonical_name, rowToProfile(row, measurementsById.get(row.animal_id) ?? [], []));
  }
  return index;
}

const THREATENED_IUCN: ReadonlySet<IucnStatus> = new Set(["CR", "EN", "VU"]);

export function isThreatened(profile: AnimalProfile): boolean {
  return (
    (profile.iucnStatus !== undefined && THREATENED_IUCN.has(profile.iucnStatus)) ||
    Boolean(profile.moeRedlistCategory?.startsWith("絶滅危惧"))
  );
}

/**
 * 検索語と完全一致させる特徴タグ。部分一致にすると「絶滅危惧」が「準絶滅危惧」に当たるため、
 * 区分値由来の語はここに集めて完全一致で比べる。
 */
export function buildProfileSearchTags(profile: AnimalProfile): string[] {
  const tags: string[] = [];
  if (profile.activityPattern) {
    const label = ACTIVITY_PATTERN_LABELS[profile.activityPattern];
    tags.push(label, `${label}の動物`);
  }
  if (profile.dietType && profile.dietType !== "other") {
    const label = DIET_TYPE_LABELS[profile.dietType];
    tags.push(label, `${label}性`, `${label}動物`);
  }
  if (profile.socialStructure) {
    const label = SOCIAL_STRUCTURE_LABELS[profile.socialStructure];
    tags.push(label, `${label}で暮らす`);
  }
  if (isThreatened(profile)) tags.push("絶滅危惧", "絶滅危惧種", "絶滅危惧動物", "レッドリスト");
  if (profile.iucnStatus) {
    tags.push(profile.iucnStatus, `IUCN${profile.iucnStatus}`, IUCN_STATUS_LABELS[profile.iucnStatus]);
    if (profile.iucnStatus === "NT") tags.push("準絶滅危惧種");
  }
  if (profile.moeRedlistCategory) tags.push(profile.moeRedlistCategory, "環境省レッドリスト");
  if (profile.citesAppendix) {
    tags.push("ワシントン条約", "CITES", `附属書${profile.citesAppendix}`, `ワシントン条約附属書${profile.citesAppendix}`);
  }
  for (const region of profile.distributionRegions) {
    const label = DISTRIBUTION_REGION_LABELS[region];
    tags.push(label, region === "domestic" ? "家畜" : `${label}の動物`);
  }
  return tags;
}

/** 検索語を部分一致させる自由記述の項目（長い詳細解説は他の動物名を含みやすいので除く）。 */
export function buildProfileSearchTexts(profile: AnimalProfile): Array<string | undefined> {
  return [profile.scientificName, profile.englishName, profile.summary, profile.habitat, profile.diet];
}

export interface ProfileTraitFilter {
  /** /animals?q= に入れる語。buildProfileSearchTags の語と一致させる。 */
  term: string;
  group: string;
  matches(profile: AnimalProfile): boolean;
}

export const PROFILE_TRAIT_FILTERS: ProfileTraitFilter[] = [
  { term: "絶滅危惧", group: "保全", matches: isThreatened },
  ...(Object.keys(ACTIVITY_PATTERN_LABELS) as ActivityPattern[]).map((value) => ({
    term: ACTIVITY_PATTERN_LABELS[value],
    group: "活動時間",
    matches: (profile: AnimalProfile) => profile.activityPattern === value,
  })),
  ...(Object.keys(DIET_TYPE_LABELS) as DietType[])
    .filter((value) => value !== "other")
    .map((value) => ({
      term: DIET_TYPE_LABELS[value],
      group: "食性",
      matches: (profile: AnimalProfile) => profile.dietType === value,
    })),
  ...(Object.keys(DISTRIBUTION_REGION_LABELS) as DistributionRegion[]).map((value) => ({
    term: DISTRIBUTION_REGION_LABELS[value],
    group: "分布",
    matches: (profile: AnimalProfile) => profile.distributionRegions.includes(value),
  })),
];

/** 並べ替え用の代表値（その項目の上限の最大値。上限がなければ下限）。 */
export function getMetricSortValue(profile: AnimalProfile, metric: MeasurementMetric): number | null {
  let best: number | null = null;
  for (const m of profile.measurements) {
    if (m.metric !== metric) continue;
    const value = m.max ?? m.min;
    if (value !== null && (best === null || value > best)) best = value;
  }
  return best;
}
