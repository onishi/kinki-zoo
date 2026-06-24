import type { PrefectureCode, Zoo } from "./types";
import { zoos } from "./data";
import { findAnimalTaxonomy, type AnimalTaxonomy } from "./animal-taxonomy";
import type { ScrapeResult } from "./scraper";
import { scrapeAnimals } from "./scraper";

const PREF_LABELS: Record<PrefectureCode, string> = {
  osaka: "大阪府",
  kyoto: "京都府",
  hyogo: "兵庫県",
  nara: "奈良県",
  shiga: "滋賀県",
  mie: "三重県",
  wakayama: "和歌山県",
};

const PREF_CODES = Object.keys(PREF_LABELS) as PrefectureCode[];

interface ZooSearchResult {
  zoo: Zoo;
  matchedAnimals: string[];
  matchedFeatures: string[];
  animalSearchAvailable: boolean;
  animalSearchError?: string;
}

interface AnimalRow {
  zoo_id: string;
  display_name: string;
}

interface AnimalListRow {
  display_name: string;
  zoo_id: string;
  animal_id: string | null;
  canonical_name: string | null;
  class_name: string | null;
  order_name: string | null;
  family_name: string | null;
  genus_name: string | null;
  species_name: string | null;
}

interface AnimalListItem {
  displayNames: string[];
  canonicalName?: string;
  className?: string;
  orderName?: string;
  familyName?: string;
  genusName?: string;
  speciesName?: string;
  zoos: Zoo[];
}

interface ZooAnimalDetail {
  displayName: string;
  canonicalName?: string;
  className?: string;
  orderName?: string;
  familyName?: string;
  genusName?: string;
  speciesName?: string;
  zoos: Zoo[];
}

interface ScrapeResultRow {
  zoo_id: string;
  scraped_at: string;
  error: string | null;
}

interface ClassifyResult {
  classifiedDisplayNames: number;
  linkedRows: number;
  masterRows: number;
}

interface TaxonomyCandidate {
  displayName: string;
  canonicalName: string | null;
  className: string | null;
  orderName: string | null;
  familyName: string | null;
  genusName: string | null;
  speciesName: string | null;
  confidence: number;
  reason: string;
  sources: Array<{ title?: string; url: string }>;
}

interface GeminiSuggestionResponse {
  candidates: TaxonomyCandidate[];
}

interface TaxonomyCandidateApplyResult {
  status: "applied" | "partial" | "rejected";
  candidate: TaxonomyCandidate;
}

type TaxonomyRank = "class" | "order" | "family" | "genus" | "species";
type AnimalListFilter = "all" | "unclassified";

interface TaxonomyRankConfig {
  key: TaxonomyRank;
  label: string;
  column: "class_name" | "order_name" | "family_name" | "genus_name" | "species_name";
}

interface TaxonomyValueRow {
  name: string;
  animal_count: number;
  zoo_count: number;
}

interface TaxonomyOverviewSection extends TaxonomyRankConfig {
  values: TaxonomyValueRow[];
}

interface TaxonomyPathLevel {
  rank: TaxonomyRankConfig;
  value: string;
}

const TAXONOMY_RANKS: TaxonomyRankConfig[] = [
  { key: "class", label: "類", column: "class_name" },
  { key: "order", label: "目", column: "order_name" },
  { key: "family", label: "科", column: "family_name" },
  { key: "genus", label: "属", column: "genus_name" },
  { key: "species", label: "種", column: "species_name" },
];

const GEMINI_TAXONOMY_MODEL = "gemini-2.5-flash-lite";
const APPLICABLE_CLASS_NAMES = new Set(["哺乳類", "鳥類", "爬虫類", "両生類", "魚類", "昆虫類", "節足動物", "軟体動物"]);
const ORDER_NAME_ALIASES: Record<string, string> = {
  インコ目: "オウム目",
  ガンカモ目: "カモ目",
  サル目: "霊長目",
  ネコ目: "食肉目",
  兎形目: "ウサギ目",
  偶蹄目: "鯨偶蹄目",
};

function isPrefectureCode(value: string): value is PrefectureCode {
  return PREF_CODES.includes(value as PrefectureCode);
}

function normalizeSearchTerm(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function notFound(message: string): Response {
  return jsonResponse({ error: message }, 404);
}

function findMatches(values: string[], searchKeyword: string): string[] {
  return values.filter((value) =>
    value.toLocaleLowerCase("ja-JP").includes(searchKeyword)
  );
}

function normalizeAnimalNameForSearch(value: string): string {
  return value.toLocaleLowerCase("ja-JP");
}

function uniqueTaxonomies(taxonomies: AnimalTaxonomy[]): AnimalTaxonomy[] {
  return [...new Map(taxonomies.map((taxonomy) => [taxonomy.id, taxonomy])).values()];
}

function clampConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalizeOptionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null") return null;
  return text;
}

function normalizeClassName(value: string | null): string | null {
  switch (value) {
    case "哺乳綱":
      return "哺乳類";
    case "鳥綱":
      return "鳥類";
    case "爬虫綱":
      return "爬虫類";
    case "両生綱":
      return "両生類";
    default:
      return value;
  }
}

function normalizeOrderName(value: string | null): string | null {
  return value ? ORDER_NAME_ALIASES[value] ?? value : null;
}

function normalizeTaxonomyCandidate(candidate: TaxonomyCandidate): TaxonomyCandidate {
  return {
    ...candidate,
    className: normalizeClassName(candidate.className),
    orderName: normalizeOrderName(candidate.orderName),
  };
}

function containsLatinLetters(value: string | null): boolean {
  return typeof value === "string" && /[A-Za-z]/.test(value);
}

function isApplicableTaxonomyCandidate(candidate: TaxonomyCandidate): boolean {
  return Boolean(
    candidate.confidence >= 0.8 &&
      candidate.canonicalName &&
      candidate.className &&
      candidate.orderName &&
      candidate.familyName &&
      candidate.genusName &&
      candidate.speciesName &&
      !containsLatinLetters(candidate.canonicalName) &&
      !containsLatinLetters(candidate.className) &&
      !containsLatinLetters(candidate.orderName) &&
      !containsLatinLetters(candidate.familyName) &&
      !containsLatinLetters(candidate.genusName) &&
      !containsLatinLetters(candidate.speciesName) &&
      APPLICABLE_CLASS_NAMES.has(candidate.className)
  );
}

function hasUsablePartialTaxonomyCandidate(candidate: TaxonomyCandidate): boolean {
  const values = [
    candidate.canonicalName,
    candidate.className,
    candidate.orderName,
    candidate.familyName,
    candidate.genusName,
    candidate.speciesName,
  ];
  return Boolean(
    candidate.confidence >= 0.8 &&
      candidate.className &&
      APPLICABLE_CLASS_NAMES.has(candidate.className) &&
      values.some(Boolean) &&
      values.every((value) => !containsLatinLetters(value))
  );
}

function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function extractGeminiOutputText(response: unknown): string {
  const data = response as {
    output_text?: unknown;
    outputText?: unknown;
    steps?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: unknown }>;
    }>;
  };

  if (typeof data.output_text === "string") return data.output_text;
  if (typeof data.outputText === "string") return data.outputText;

  const modelOutput = data.steps?.find((step) => step.type === "model_output");
  const textBlock = modelOutput?.content?.find((block) => block.type === "text");
  return typeof textBlock?.text === "string" ? textBlock.text : "";
}

function extractGeminiCitations(response: unknown): Array<{ title?: string; url: string }> {
  const data = response as {
    steps?: Array<{
      type?: string;
      content?: Array<{
        type?: string;
        annotations?: Array<{ type?: string; title?: unknown; url?: unknown }>;
      }>;
    }>;
  };

  const citations = new Map<string, { title?: string; url: string }>();
  for (const step of data.steps ?? []) {
    if (step.type !== "model_output") continue;
    for (const block of step.content ?? []) {
      if (block.type !== "text") continue;
      for (const annotation of block.annotations ?? []) {
        if (annotation.type !== "url_citation" || typeof annotation.url !== "string") continue;
        citations.set(annotation.url, {
          url: annotation.url,
          title: typeof annotation.title === "string" ? annotation.title : undefined,
        });
      }
    }
  }
  return [...citations.values()];
}

function parseGeminiSuggestionResponse(text: string): GeminiSuggestionResponse {
  const parsed = JSON.parse(extractJsonObject(text)) as GeminiSuggestionResponse;
  if (!Array.isArray(parsed.candidates)) {
    throw new Error("Gemini response does not contain candidates");
  }

  return {
    candidates: parsed.candidates.map((candidate) => ({
      displayName: String(candidate.displayName ?? ""),
      canonicalName: normalizeOptionalText(candidate.canonicalName),
      className: normalizeOptionalText(candidate.className),
      orderName: normalizeOptionalText(candidate.orderName),
      familyName: normalizeOptionalText(candidate.familyName),
      genusName: normalizeOptionalText(candidate.genusName),
      speciesName: normalizeOptionalText(candidate.speciesName),
      confidence: clampConfidence(candidate.confidence),
      reason: candidate.reason ? String(candidate.reason) : "",
      sources: Array.isArray(candidate.sources)
        ? candidate.sources
            .filter((source) => source && typeof source.url === "string")
            .map((source) => ({
              url: source.url,
              title: typeof source.title === "string" ? source.title : undefined,
            }))
        : [],
    })),
  };
}

function parseSourcesJson(value: string | null): Array<{ title?: string; url: string }> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((source): source is { title?: string; url: string } => {
        return typeof source === "object" && source !== null && typeof (source as { url?: unknown }).url === "string";
      })
      .map((source) => ({
        url: source.url,
        title: typeof source.title === "string" ? source.title : undefined,
      }));
  } catch {
    return [];
  }
}

function buildSearchResult(zoo: Zoo): ZooSearchResult {
  return {
    zoo,
    matchedAnimals: [],
    matchedFeatures: [],
    animalSearchAvailable: false,
  };
}

async function loadCachedAnimalMatches(
  db: D1Database,
  zooIds: string[],
  searchKeyword: string
): Promise<Map<string, string[]>> {
  if (zooIds.length === 0) return new Map();

  const placeholders = zooIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT za.zoo_id, za.display_name
       FROM zoo_animals za
       LEFT JOIN animals a ON a.id = za.animal_id
       WHERE za.zoo_id IN (${placeholders})
         AND (
           za.normalized_display_name LIKE ?
           OR a.normalized_name LIKE ?
           OR a.genus_name LIKE ?
           OR a.species_name LIKE ?
         )
       ORDER BY za.zoo_id, za.display_name`
    )
    .bind(...zooIds, `%${searchKeyword}%`, `%${searchKeyword}%`, `%${searchKeyword}%`, `%${searchKeyword}%`)
    .all<AnimalRow>();

  const matches = new Map<string, string[]>();
  for (const row of result.results ?? []) {
    const animals = matches.get(row.zoo_id) ?? [];
    animals.push(row.display_name);
    matches.set(row.zoo_id, animals);
  }
  return matches;
}

async function loadCachedScrapeResult(db: D1Database, zooId: string): Promise<ScrapeResult | null> {
  const meta = await db
    .prepare(
      `SELECT zoo_id, scraped_at, error
       FROM animal_scrape_results
       WHERE zoo_id = ?`
    )
    .bind(zooId)
    .first<ScrapeResultRow>();

  if (!meta) return null;

  const animalsResult = await db
    .prepare(
      `SELECT display_name
       FROM zoo_animals
       WHERE zoo_id = ?
       ORDER BY display_name`
    )
    .bind(zooId)
    .all<{ display_name: string }>();

  return {
    zooId: meta.zoo_id,
    animals: (animalsResult.results ?? []).map((row) => row.display_name),
    scrapedAt: meta.scraped_at,
    error: meta.error ?? undefined,
  };
}

function buildAnimalListItems(rows: AnimalListRow[]): AnimalListItem[] {
  const zooById = new Map(zoos.map((zoo) => [zoo.id, zoo]));
  const animals = new Map<string, AnimalListItem>();

  for (const row of rows) {
    const zoo = zooById.get(row.zoo_id);
    if (!zoo) continue;
    const key = row.animal_id ?? `display:${row.display_name}`;
    const item = animals.get(key) ?? {
      displayNames: [],
      canonicalName: row.canonical_name ?? undefined,
      className: row.class_name ?? undefined,
      orderName: row.order_name ?? undefined,
      familyName: row.family_name ?? undefined,
      genusName: row.genus_name ?? undefined,
      speciesName: row.species_name ?? undefined,
      zoos: [],
    };
    if (!item.displayNames.includes(row.display_name)) {
      item.displayNames.push(row.display_name);
    }
    if (!item.zoos.some((existing) => existing.id === zoo.id)) {
      item.zoos.push(zoo);
    }
    animals.set(key, item);
  }

  return [...animals.values()];
}

async function loadAnimalList(db: D1Database, filter: AnimalListFilter = "all"): Promise<AnimalListItem[]> {
  const where =
    filter === "unclassified"
      ? `WHERE a.id IS NULL
           AND NULLIF(c.canonical_name, 'null') IS NULL
           AND NULLIF(c.class_name, 'null') IS NULL
           AND NULLIF(c.order_name, 'null') IS NULL
           AND NULLIF(c.family_name, 'null') IS NULL
           AND NULLIF(c.genus_name, 'null') IS NULL
           AND NULLIF(c.species_name, 'null') IS NULL`
      : "";
  const result = await db
    .prepare(
      `SELECT
         za.display_name,
         za.zoo_id,
         za.animal_id,
         COALESCE(a.canonical_name, NULLIF(c.canonical_name, 'null')) AS canonical_name,
         COALESCE(a.class_name, NULLIF(c.class_name, 'null')) AS class_name,
         COALESCE(a.order_name, NULLIF(c.order_name, 'null')) AS order_name,
         COALESCE(a.family_name, NULLIF(c.family_name, 'null')) AS family_name,
         COALESCE(a.genus_name, NULLIF(c.genus_name, 'null')) AS genus_name,
         COALESCE(a.species_name, NULLIF(c.species_name, 'null')) AS species_name
       FROM zoo_animals za
       LEFT JOIN animals a ON a.id = za.animal_id
       LEFT JOIN animal_taxonomy_candidates c
         ON c.display_name = za.display_name
        AND za.animal_id IS NULL
        AND c.status IN ('partial', 'pending')
        AND c.confidence >= 0.8
       ${where}
       ORDER BY COALESCE(a.normalized_name, za.normalized_display_name), za.display_name, za.zoo_id`
    )
    .all<AnimalListRow>();

  return buildAnimalListItems(result.results ?? []);
}

async function loadZooAnimalDetail(db: D1Database, displayName: string): Promise<ZooAnimalDetail | null> {
  const result = await db
    .prepare(
      `SELECT
         za.display_name,
         za.zoo_id,
         za.animal_id,
         a.canonical_name,
         a.class_name,
         a.order_name,
         a.family_name,
         a.genus_name,
         a.species_name
       FROM zoo_animals za
       LEFT JOIN animals a ON a.id = za.animal_id
       WHERE za.display_name = ?
       ORDER BY za.zoo_id`
    )
    .bind(displayName)
    .all<AnimalListRow>();

  const rows = result.results ?? [];
  if (rows.length === 0) return null;

  const zooById = new Map(zoos.map((zoo) => [zoo.id, zoo]));
  const taxonomicRow = rows.find((row) => row.animal_id) ?? rows[0];
  const candidate =
    taxonomicRow.animal_id
      ? null
      : await db
          .prepare(
            `SELECT
               canonical_name,
               class_name,
               order_name,
               family_name,
               genus_name,
               species_name
             FROM animal_taxonomy_candidates
             WHERE display_name = ?
               AND status IN ('partial', 'pending')
               AND confidence >= 0.8
             ORDER BY updated_at DESC
             LIMIT 1`
          )
          .bind(displayName)
          .first<{
            canonical_name: string | null;
            class_name: string | null;
            order_name: string | null;
            family_name: string | null;
            genus_name: string | null;
            species_name: string | null;
          }>();
  return {
    displayName,
    canonicalName: taxonomicRow.canonical_name ?? normalizeOptionalText(candidate?.canonical_name) ?? undefined,
    className: taxonomicRow.class_name ?? normalizeOptionalText(candidate?.class_name) ?? undefined,
    orderName: taxonomicRow.order_name ?? normalizeOptionalText(candidate?.order_name) ?? undefined,
    familyName: taxonomicRow.family_name ?? normalizeOptionalText(candidate?.family_name) ?? undefined,
    genusName: taxonomicRow.genus_name ?? normalizeOptionalText(candidate?.genus_name) ?? undefined,
    speciesName: taxonomicRow.species_name ?? normalizeOptionalText(candidate?.species_name) ?? undefined,
    zoos: rows.flatMap((row) => {
      const zoo = zooById.get(row.zoo_id);
      return zoo ? [zoo] : [];
    }),
  };
}

async function loadTaxonomyOverview(db: D1Database): Promise<TaxonomyOverviewSection[]> {
  const sections: TaxonomyOverviewSection[] = [];

  for (const rank of TAXONOMY_RANKS) {
    const result = await db
      .prepare(
        `SELECT
           a.${rank.column} AS name,
           COUNT(DISTINCT a.id) AS animal_count,
           COUNT(DISTINCT za.zoo_id) AS zoo_count
         FROM animals a
         JOIN zoo_animals za ON za.animal_id = a.id
         GROUP BY a.${rank.column}
         ORDER BY a.${rank.column}`
      )
      .all<TaxonomyValueRow>();

    sections.push({ ...rank, values: result.results ?? [] });
  }

  return sections;
}

function getTaxonomyRank(value: string): TaxonomyRankConfig | undefined {
  return TAXONOMY_RANKS.find((rank) => rank.key === value);
}

function getNextTaxonomyRank(rank: TaxonomyRankConfig): TaxonomyRankConfig | undefined {
  const index = TAXONOMY_RANKS.findIndex((candidate) => candidate.key === rank.key);
  return index >= 0 ? TAXONOMY_RANKS[index + 1] : undefined;
}

function getTaxonomyRankByDepth(depth: number): TaxonomyRankConfig | undefined {
  return TAXONOMY_RANKS[depth - 1];
}

function buildTaxonomyWhereClause(levels: TaxonomyPathLevel[]): string {
  return levels.map((level) => `a.${level.rank.column} = ?`).join(" AND ");
}

function parseTaxonomyPath(pathname: string): TaxonomyPathLevel[] | null {
  const parts = pathname
    .replace(/^\/taxonomy\/?/, "")
    .split("/")
    .filter(Boolean)
    .map((part) => decodeURIComponent(part));

  if (parts.length === 0 || parts.length > TAXONOMY_RANKS.length) return null;

  return parts.map((value, index) => {
    const rank = getTaxonomyRankByDepth(index + 1);
    if (!rank) throw new Error(`Invalid taxonomy depth: ${index + 1}`);
    return { rank, value };
  });
}

async function loadChildTaxonomyValues(
  db: D1Database,
  levels: TaxonomyPathLevel[]
): Promise<TaxonomyOverviewSection | null> {
  const current = levels.at(-1);
  if (!current) return null;
  const { rank } = current;
  const childRank = getNextTaxonomyRank(rank);
  if (!childRank) return null;
  const where = buildTaxonomyWhereClause(levels);

  const result = await db
    .prepare(
      `SELECT
         a.${childRank.column} AS name,
         COUNT(DISTINCT a.id) AS animal_count,
         COUNT(DISTINCT za.zoo_id) AS zoo_count
       FROM animals a
       JOIN zoo_animals za ON za.animal_id = a.id
       WHERE ${where}
       GROUP BY a.${childRank.column}
       ORDER BY a.${childRank.column}`
    )
    .bind(...levels.map((level) => level.value))
    .all<TaxonomyValueRow>();

  return { ...childRank, values: result.results ?? [] };
}

async function loadTaxonomyAnimals(
  db: D1Database,
  levels: TaxonomyPathLevel[]
): Promise<AnimalListItem[]> {
  const where = buildTaxonomyWhereClause(levels);
  const result = await db
    .prepare(
      `SELECT
         za.display_name,
         za.zoo_id,
         za.animal_id,
         a.canonical_name,
         a.class_name,
         a.order_name,
         a.family_name,
         a.genus_name,
         a.species_name
       FROM animals a
       JOIN zoo_animals za ON za.animal_id = a.id
       WHERE ${where}
       ORDER BY a.normalized_name, za.display_name, za.zoo_id`
    )
    .bind(...levels.map((level) => level.value))
    .all<AnimalListRow>();

  return buildAnimalListItems(result.results ?? []);
}

async function loadUnclassifiedDisplayNames(db: D1Database, limit: number): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT za.display_name
       FROM zoo_animals za
       LEFT JOIN animal_taxonomy_candidates c ON c.display_name = za.display_name
       WHERE za.animal_id IS NULL
         AND c.display_name IS NULL
       ORDER BY za.display_name
       LIMIT ?`
    )
    .bind(limit)
    .all<{ display_name: string }>();

  return (result.results ?? []).map((row) => row.display_name);
}

async function saveTaxonomyCandidates(
  db: D1Database,
  candidates: TaxonomyCandidate[],
  model: string,
  fallbackSources: Array<{ title?: string; url: string }>
): Promise<void> {
  if (candidates.length === 0) return;

  const now = new Date().toISOString();
  await db.batch(
    candidates.map((candidate) => {
      const sources = candidate.sources.length > 0 ? candidate.sources : fallbackSources;
      return db
        .prepare(
          `INSERT INTO animal_taxonomy_candidates (
             display_name,
             canonical_name,
             class_name,
             order_name,
             family_name,
             genus_name,
             species_name,
             confidence,
             reason,
             sources_json,
             status,
             model,
             grounded_at,
             created_at,
             updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
           ON CONFLICT(display_name) DO UPDATE SET
             canonical_name = excluded.canonical_name,
             class_name = excluded.class_name,
             order_name = excluded.order_name,
             family_name = excluded.family_name,
             genus_name = excluded.genus_name,
             species_name = excluded.species_name,
             confidence = excluded.confidence,
             reason = excluded.reason,
             sources_json = excluded.sources_json,
             status = 'pending',
             model = excluded.model,
             grounded_at = excluded.grounded_at,
             updated_at = excluded.updated_at`
        )
        .bind(
          candidate.displayName,
          candidate.canonicalName,
          candidate.className,
          candidate.orderName,
          candidate.familyName,
          candidate.genusName,
          candidate.speciesName,
          candidate.confidence,
          candidate.reason,
          JSON.stringify(sources),
          model,
          now,
          now,
          now
        );
    })
  );
}

async function loadTaxonomyCandidates(db: D1Database): Promise<unknown[]> {
  const result = await db
    .prepare(
      `SELECT
         display_name,
         canonical_name,
         class_name,
         order_name,
         family_name,
         genus_name,
         species_name,
         confidence,
         reason,
         sources_json,
         status,
         model,
         grounded_at,
         updated_at
       FROM animal_taxonomy_candidates
       ORDER BY status, confidence DESC, display_name`
    )
    .all<{
      display_name: string;
      canonical_name: string | null;
      class_name: string | null;
      order_name: string | null;
      family_name: string | null;
      genus_name: string | null;
      species_name: string | null;
      confidence: number;
      reason: string | null;
      sources_json: string | null;
      status: string;
      model: string;
      grounded_at: string;
      updated_at: string;
    }>();

  return (result.results ?? []).map((row) => ({
    displayName: row.display_name,
    canonicalName: row.canonical_name,
    className: row.class_name,
    orderName: row.order_name,
    familyName: row.family_name,
    genusName: row.genus_name,
    speciesName: row.species_name,
    confidence: row.confidence,
    reason: row.reason,
    sources: parseSourcesJson(row.sources_json),
    status: row.status,
    model: row.model,
    groundedAt: row.grounded_at,
    updatedAt: row.updated_at,
  }));
}

function buildTaxonomySuggestionPrompt(displayNames: string[]): string {
  return `あなたは動物園の動物表示名を分類する補助システムです。
Google Search で確認しながら、次の日本語の動物表示名を分類してください。

重要なルール:
- 種まで特定できる場合だけ genusName と speciesName を入れる。
- 表示名が総称、品種、展示名、愛称、または種まで断定できない場合は canonicalName/className/orderName/familyName/genusName/speciesName をすべて null にする。
- canonicalName/className/orderName/familyName/genusName/speciesName は必ず日本語表記にする。
- genusName は「ヒョウ属」「カモメ属」のような日本語の属名だけを入れる。Panthera、Larus、Centrochelys、sulcata などの学名・英字・ローマ字は絶対に入れない。
- speciesName は「ユキヒョウ」「ウミネコ」のような日本語の種名だけを入れる。学名や種小名しか確認できない場合は null にする。
- className は「哺乳類」「鳥類」「爬虫類」「両生類」「魚類」「昆虫類」など利用者向けの日本語分類名にする。「哺乳綱」「鳥綱」「爬虫綱」「両生綱」は使わない。
- orderName は利用者向けに次の表記へ統一する: インコ目は「オウム目」、ガンカモ目は「カモ目」、サル目は「霊長目」、ネコ目は「食肉目」、兎形目は「ウサギ目」、偶蹄目は「鯨偶蹄目」とする。
- 日本語の属名または日本語の種名が確認できない場合でも、className/orderName/familyName など確認できた上位分類は日本語で入れる。確認できない項目だけ null にする。
- canonicalName は表示名に対応する代表和名を確認できる場合だけ入れる。代表和名を断定できない場合は null にする。
- 無理に推測しない。曖昧なら null にする。
- confidence は 0 から 1。入力した分類項目全体の確からしさを表す。
- 種まで確認できない場合でも、入れた上位分類が信頼できるなら 0.8 以上にしてよい。未確認の項目は null にする。
- 出力は JSON のみ。Markdown や説明文を付けない。
- sources には分類判断に使った URL を入れる。

JSON schema:
{
  "candidates": [
    {
      "displayName": "入力表示名",
      "canonicalName": "代表和名または null",
      "className": "類または null",
      "orderName": "目または null",
      "familyName": "科または null",
      "genusName": "属または null",
      "speciesName": "種または null",
      "confidence": 0.0,
      "reason": "短い判断理由",
      "sources": [{"title": "source title", "url": "https://..."}]
    }
  ]
}

対象:
${displayNames.map((name) => `- ${name}`).join("\n")}`;
}

async function suggestTaxonomyWithGemini(
  apiKey: string,
  displayNames: string[]
): Promise<{ candidates: TaxonomyCandidate[]; sources: Array<{ title?: string; url: string }>; rawText: string }> {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: GEMINI_TAXONOMY_MODEL,
      input: buildTaxonomySuggestionPrompt(displayNames),
      tools: [{ type: "google_search" }],
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${responseText.slice(0, 500)}`);
  }

  const data = JSON.parse(responseText) as unknown;
  const rawText = extractGeminiOutputText(data);
  if (!rawText) {
    throw new Error("Gemini response did not include output text");
  }

  const parsed = parseGeminiSuggestionResponse(rawText);
  return {
    candidates: parsed.candidates
      .filter((candidate) => displayNames.includes(candidate.displayName))
      .map(normalizeTaxonomyCandidate),
    sources: extractGeminiCitations(data),
    rawText,
  };
}

async function applyTaxonomyCandidate(
  db: D1Database,
  candidate: TaxonomyCandidate
): Promise<TaxonomyCandidateApplyResult> {
  const normalized = normalizeTaxonomyCandidate(candidate);
  const now = new Date().toISOString();

  if (!isApplicableTaxonomyCandidate(normalized)) {
    const status = hasUsablePartialTaxonomyCandidate(normalized) ? "partial" : "rejected";
    await db.batch([
      db
        .prepare(
          `UPDATE animal_taxonomy_candidates
           SET status = ?,
               class_name = ?,
               updated_at = ?
           WHERE display_name = ?`
        )
        .bind(status, normalized.className, now, normalized.displayName),
      db
        .prepare(
          `UPDATE zoo_animals
           SET animal_id = NULL
           WHERE display_name = ?`
        )
        .bind(normalized.displayName),
    ]);
    return { status, candidate: normalized };
  }

  const canonicalName = normalized.canonicalName;
  const className = normalized.className;
  const orderName = normalized.orderName;
  const familyName = normalized.familyName;
  const genusName = normalized.genusName;
  const speciesName = normalized.speciesName;
  if (!canonicalName || !className || !orderName || !familyName || !genusName || !speciesName) {
    return { status: "rejected", candidate: normalized };
  }

  const taxonomy: AnimalTaxonomy = {
    id: `gemini:${canonicalName}`,
    canonicalName,
    className,
    orderName,
    familyName,
    genusName,
    speciesName,
    notes: "Gemini web grounding候補から投入",
  };

  await upsertAnimalMasters(db, [taxonomy]);
  await db.batch([
    db
      .prepare(
        `UPDATE zoo_animals
         SET animal_id = ?
         WHERE display_name = ?`
      )
      .bind(taxonomy.id, normalized.displayName),
    db
      .prepare(
        `UPDATE animal_taxonomy_candidates
         SET status = 'applied',
             class_name = ?,
             updated_at = ?
         WHERE display_name = ?`
      )
      .bind(normalized.className, now, normalized.displayName),
  ]);

  return { status: "applied", candidate: normalized };
}

async function upsertAnimalMasters(db: D1Database, taxonomies: AnimalTaxonomy[]): Promise<void> {
  const unique = uniqueTaxonomies(taxonomies);
  if (unique.length === 0) return;

  const updatedAt = new Date().toISOString();
  await db.batch(
    unique.map((taxonomy) => {
      const orderName = normalizeOrderName(taxonomy.orderName) ?? taxonomy.orderName;
      return db
        .prepare(
          `INSERT INTO animals (
             id,
             canonical_name,
             normalized_name,
             class_name,
             order_name,
             family_name,
             genus_name,
             species_name,
             notes,
             updated_at
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             canonical_name = excluded.canonical_name,
             normalized_name = excluded.normalized_name,
             class_name = excluded.class_name,
             order_name = excluded.order_name,
             family_name = excluded.family_name,
             genus_name = excluded.genus_name,
             species_name = excluded.species_name,
             notes = excluded.notes,
             updated_at = excluded.updated_at`
        )
        .bind(
          taxonomy.id,
          taxonomy.canonicalName,
          normalizeAnimalNameForSearch(taxonomy.canonicalName),
          taxonomy.className,
          orderName,
          taxonomy.familyName,
          taxonomy.genusName,
          taxonomy.speciesName,
          taxonomy.notes ?? null,
          updatedAt
        );
    })
  );
}

async function saveScrapeResult(db: D1Database, result: ScrapeResult): Promise<void> {
  const taxonomies = result.animals.flatMap((animal) => {
    const taxonomy = findAnimalTaxonomy(animal);
    return taxonomy ? [taxonomy] : [];
  });
  await upsertAnimalMasters(db, taxonomies);

  const statements = [
    db
      .prepare(
        `INSERT INTO animal_scrape_results (zoo_id, scraped_at, error)
         VALUES (?, ?, ?)
         ON CONFLICT(zoo_id) DO UPDATE SET
           scraped_at = excluded.scraped_at,
           error = excluded.error`
      )
      .bind(result.zooId, result.scrapedAt, result.error ?? null),
    db.prepare("DELETE FROM zoo_animals WHERE zoo_id = ?").bind(result.zooId),
    ...result.animals.map((animal) => {
      const taxonomy = findAnimalTaxonomy(animal);
      return db
        .prepare(
          `INSERT INTO zoo_animals (zoo_id, display_name, normalized_display_name, animal_id)
           VALUES (?, ?, ?, ?)`
        )
        .bind(
          result.zooId,
          animal,
          normalizeAnimalNameForSearch(animal),
          taxonomy?.id ?? null
        );
    }),
  ];

  await db.batch(statements);
}

async function classifyCachedZooAnimals(db: D1Database): Promise<ClassifyResult> {
  const rows = await db
    .prepare(
      `SELECT DISTINCT display_name
       FROM zoo_animals
       ORDER BY display_name`
    )
    .all<{ display_name: string }>();
  const displayNames = rows.results ?? [];
  const classified = displayNames.flatMap((row) => {
    const taxonomy = findAnimalTaxonomy(row.display_name);
    return taxonomy ? [{ displayName: row.display_name, taxonomy }] : [];
  });

  await db.prepare("UPDATE zoo_animals SET animal_id = NULL").run();
  await db.prepare("DELETE FROM animals").run();

  await upsertAnimalMasters(
    db,
    classified.map((item) => item.taxonomy)
  );

  if (classified.length > 0) {
    await db.batch(
      classified.map((item) =>
        db
          .prepare(
            `UPDATE zoo_animals
             SET animal_id = ?
             WHERE display_name = ?`
          )
          .bind(item.taxonomy.id, item.displayName)
      )
    );
  }

  const stats = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM zoo_animals WHERE animal_id IS NOT NULL) AS linked_rows,
         (SELECT COUNT(*) FROM animals) AS master_rows`
    )
    .first<{ linked_rows: number; master_rows: number }>();

  return {
    classifiedDisplayNames: classified.length,
    linkedRows: stats?.linked_rows ?? 0,
    masterRows: stats?.master_rows ?? 0,
  };
}

async function scrapeAndSaveAnimals(db: D1Database, zooId: string): Promise<ScrapeResult> {
  const result = await scrapeAnimals(zooId);
  await saveScrapeResult(db, result);
  return result;
}

async function getAnimalResult(
  db: D1Database,
  zooId: string,
  forceRefresh: boolean
): Promise<ScrapeResult> {
  if (!forceRefresh) {
    const cached = await loadCachedScrapeResult(db, zooId);
    if (cached) return cached;
  }

  return scrapeAndSaveAnimals(db, zooId);
}

async function refreshAllAnimalCache(db: D1Database): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = [];
  for (const zoo of zoos) {
    results.push(await scrapeAndSaveAnimals(db, zoo.id));
  }
  return results;
}

async function searchZoos(db: D1Database, pref?: string | null, animal?: string | null): Promise<ZooSearchResult[]> {
  const normalizedAnimal = normalizeSearchTerm(animal);

  const prefFiltered = zoos.filter((zoo) => {
    if (pref && (!isPrefectureCode(pref) || zoo.prefecture !== pref)) {
      return false;
    }
    return true;
  });

  if (!normalizedAnimal) {
    return prefFiltered.map(buildSearchResult);
  }

  const searchKeyword = normalizedAnimal.toLocaleLowerCase("ja-JP");
  const animalMatches = await loadCachedAnimalMatches(
    db,
    prefFiltered.map((zoo) => zoo.id),
    searchKeyword
  );

  return prefFiltered.flatMap((zoo) => {
    const matchedFeatures = findMatches(zoo.features, searchKeyword);
    const matchedAnimals = animalMatches.get(zoo.id) ?? [];
    const searchResult: ZooSearchResult = {
      zoo,
      matchedAnimals,
      matchedFeatures,
      animalSearchAvailable: true,
    };

    if (matchedAnimals.length > 0 || matchedFeatures.length > 0) {
      return [searchResult];
    }

    return [];
  });
}

function toApiZoo(result: ZooSearchResult, includeMatches: boolean): Zoo & {
  matchedAnimals?: string[];
  matchedFeatures?: string[];
} {
  if (!includeMatches) return result.zoo;
  return {
    ...result.zoo,
    matchedAnimals: result.matchedAnimals,
    matchedFeatures: result.matchedFeatures,
  };
}

function renderMatchedValues(label: string, values: string[]): string {
  if (values.length === 0) return "";
  const visibleValues = values.slice(0, 8);
  const hiddenCount = values.length - visibleValues.length;
  const chips = visibleValues
    .map((value) => `<span class="match-chip">${escapeHtml(value)}</span>`)
    .join("");
  const more = hiddenCount > 0 ? `<span class="match-more">ほか ${hiddenCount} 件</span>` : "";

  return `
    <div class="match-row">
      <span class="match-label">${label}</span>
      <span class="match-values">${chips}${more}</span>
    </div>`;
}

function renderMatchSummary(result: ZooSearchResult): string {
  const animalMatches = renderMatchedValues("ヒットした動物", result.matchedAnimals);
  const featureMatches = renderMatchedValues("関連する特徴", result.matchedFeatures);
  const notice =
    result.animalSearchError && result.matchedAnimals.length === 0
      ? `<p class="match-note">動物一覧を取得できなかったため、登録済みの特徴タグで判定しました。</p>`
      : "";

  if (!animalMatches && !featureMatches && !notice) return "";

  return `<div class="match-box">${animalMatches}${featureMatches}${notice}</div>`;
}

function renderZooCard(result: ZooSearchResult): string {
  const zoo = result.zoo;
  const prefLabel = PREF_LABELS[zoo.prefecture];
  const features = zoo.features.map((f) => `<span class="tag">${f}</span>`).join("");
  const wikiLink = zoo.wikipediaUrl
    ? `<a class="wiki-link" href="${zoo.wikipediaUrl}" target="_blank" rel="noopener noreferrer">Wikipedia</a>`
    : "";
  return `
    <article class="zoo-card" id="${zoo.id}">
      <h2><a href="/zoos/${zoo.id}">${zoo.name}</a></h2>
      ${wikiLink}
      <p class="kana">${zoo.nameKana}</p>
      <dl>
        <dt>都道府県</dt><dd>${prefLabel}</dd>
        <dt>住所</dt><dd>${zoo.address}</dd>
        <dt>開園時間</dt><dd>${zoo.openingHours}</dd>
        <dt>休園日</dt><dd>${zoo.closedDays}</dd>
        <dt>入園料</dt><dd>${zoo.admission}</dd>
      </dl>
      <p class="links">
        <a href="/zoos/${zoo.id}/animals">動物一覧</a>
        <a href="${zoo.website}" target="_blank" rel="noopener noreferrer">公式サイト</a>
      </p>
      ${renderMatchSummary(result)}
      <div class="features">${features}</div>
    </article>`;
}

function buildBrowseUrl(pref: PrefectureCode | null, animal: string | null): string {
  const params = new URLSearchParams();
  if (pref) params.set("pref", pref);
  if (animal) params.set("animal", animal);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function buildMapUrl(pref: PrefectureCode | null, animal: string | null): string {
  const params = new URLSearchParams();
  if (pref) params.set("pref", pref);
  if (animal) params.set("animal", animal);
  const query = params.toString();
  return query ? `/map?${query}` : "/map";
}

function buildAnimalSearchUrl(animal: string): string {
  const params = new URLSearchParams({ animal });
  return `/?${params.toString()}`;
}

function buildZooAnimalUrl(displayName: string): string {
  return `/animal/${encodeURIComponent(displayName)}`;
}

function buildTaxonomyPathUrl(values: string[]): string {
  return `/taxonomy/${values.map((value) => encodeURIComponent(value)).join("/")}`;
}

function buildLegacyTaxonomyUrl(rank: TaxonomyRank, value: string): string {
  return `/taxonomy/${rank}/${encodeURIComponent(value)}`;
}

function buildTaxonomyUrl(levels: TaxonomyPathLevel[], value: string): string {
  return buildTaxonomyPathUrl([...levels.map((level) => level.value), value]);
}

function renderTaxonomyBreadcrumb(levels: TaxonomyPathLevel[]): string {
  const crumbs = [
    `<a href="/taxonomy">分類一覧</a>`,
    ...levels.map((level, index) => {
      const label = `${level.rank.label}: ${level.value}`;
      if (index === levels.length - 1) {
        return `<span aria-current="page">${escapeHtml(label)}</span>`;
      }
      const href = buildTaxonomyPathUrl(levels.slice(0, index + 1).map((item) => item.value));
      return `<a href="${href}">${escapeHtml(label)}</a>`;
    }),
  ];

  return `<nav class="breadcrumb" aria-label="パンくず">${crumbs.join("<span>/</span>")}</nav>`;
}

function renderPrefTab(
  code: PrefectureCode,
  label: string,
  active: boolean,
  animal: string | null
): string {
  const cls = active ? 'class="tab active"' : 'class="tab"';
  return `<a href="${buildBrowseUrl(code, animal)}" ${cls}>${label}</a>`;
}

const COMMON_STYLES = `
    .site-header { padding: 1rem 1.5rem; border-bottom: 1px solid #ddd; }
    .site-header h1 { font-size: 1.5rem; }
    .site-header h1 a { color: inherit; text-decoration: none; }
    .site-header p { font-size: 0.9rem; color: #555; margin-top: 0.25rem; }
    .global-nav { display: flex; flex-wrap: wrap; gap: 1rem; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; }
    .global-nav a { color: #1f5b45; text-decoration: none; font-size: 0.9rem; }
    .global-nav a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .global-nav a[aria-current="page"] { font-weight: bold; text-decoration: underline; text-underline-offset: 0.2em; }
    .page-nav { margin-bottom: 1rem; display: flex; gap: 1rem; flex-wrap: wrap; }
    .page-nav a { color: #2d6a4f; text-decoration: none; }`;

function renderSiteHeader(): string {
  return `  <header class="site-header">
    <h1><a href="/">近畿動物園情報</a></h1>
    <p>近畿一円の動物園・動物施設をまとめて調べられます</p>
  </header>`;
}

function renderGlobalNav(activePath: string): string {
  const navItems: [string, string][] = [
    ["/", "動物園一覧"],
    ["/animals", "動物一覧"],
    ["/taxonomy", "分類から探す"],
    ["/map", "地図で見る"],
  ];
  const links = navItems
    .map(([href, label]) => {
      const isActive = href === "/" ? activePath === "/" : activePath === href || activePath.startsWith(`${href}/`);
      return `<a href="${href}"${isActive ? ' aria-current="page"' : ""}>${label}</a>`;
    })
    .join("\n    ");
  return `  <nav class="global-nav" aria-label="サイトナビゲーション">
    ${links}
  </nav>`;
}

function renderHtml(
  results: ZooSearchResult[],
  activePref: PrefectureCode | null,
  animal: string | null
): string {
  const cards = results.map(renderZooCard).join("\n");
  const escapedAnimal = animal ? escapeHtml(animal) : "";
  const allTab = activePref
    ? `<a href="${buildBrowseUrl(null, animal)}" class="tab">すべて</a>`
    : `<a href="${buildBrowseUrl(null, animal)}" class="tab active">すべて</a>`;
  const prefTabs = PREF_CODES.map((code) =>
    renderPrefTab(code, PREF_LABELS[code], code === activePref, animal)
  ).join("\n");

  const count = results.length;
  const prefLabel = activePref && isPrefectureCode(activePref) ? PREF_LABELS[activePref] : "近畿一円";
  const summary = animal
    ? `${prefLabel} で「${escapedAnimal}」を探せる動物園・施設: ${count} 件`
    : `${prefLabel} の動物園・施設: ${count} 件`;
  const emptyMessage = animal
    ? `「${escapedAnimal}」に該当する施設が見つかりませんでした。`
    : "該当する施設が見つかりませんでした。";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    .tabs { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; }
    .tab { color: #1f5b45; text-decoration: none; font-size: 0.9rem; }
    .tab.active { font-weight: bold; text-decoration: underline; text-underline-offset: 0.2em; }
    .tab:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .search-form { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; }
    .search-form input { flex: 1 1 220px; max-width: 320px; padding: 0.55rem 0.75rem; border: 1px solid #bbb; font-size: 0.95rem; }
    .search-form button, .search-form a { font-size: 0.875rem; }
    .search-form button { border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.5rem 0.9rem; cursor: pointer; }
    .search-form a { padding: 0.5rem 0.7rem; color: #1f5b45; text-decoration: none; border: 1px solid #1f5b45; }
    .summary { padding: 0.75rem 1.5rem; font-size: 0.9rem; color: #666; }
    .zoo-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; padding: 1rem 1.5rem; }
    .zoo-card { background: #fff; border: 1px solid #ddd; padding: 1rem; }
    .zoo-card h2 { font-size: 1.1rem; margin-bottom: 0.25rem; }
    .zoo-card h2 a { color: #2d6a4f; text-decoration: none; }
    .zoo-card h2 a:hover { text-decoration: underline; }
    .wiki-link { font-size: 0.8rem; font-weight: normal; margin-left: 0.5rem; color: #666; text-decoration: none; }
    .wiki-link:hover { text-decoration: underline; }
    .kana { font-size: 0.8rem; color: #888; margin-bottom: 0.75rem; }
    dl { display: grid; grid-template-columns: 5.5em 1fr; gap: 0.2rem 0.5rem; font-size: 0.85rem; }
    dt { color: #666; font-weight: bold; }
    .links { margin-top: 0.75rem; display: flex; gap: 0.75rem; font-size: 0.85rem; }
    .links a { color: #2d6a4f; text-decoration: none; }
    .links a:hover { text-decoration: underline; }
    .match-box { margin-top: 0.85rem; padding: 0.75rem; border: 1px solid #d7eadc; border-radius: 8px; background: #f3fbf5; display: grid; gap: 0.55rem; }
    .match-row { display: grid; gap: 0.35rem; }
    .match-label { color: #456052; font-size: 0.75rem; font-weight: bold; }
    .match-values { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .match-chip { background: #fff; color: #1b5e3b; border: 1px solid #b7dcc3; border-radius: 999px; padding: 0.18rem 0.55rem; font-size: 0.75rem; font-weight: bold; }
    .match-more { color: #5d7166; font-size: 0.75rem; align-self: center; }
    .match-note { color: #6d756f; font-size: 0.75rem; line-height: 1.5; }
    .features { margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .tag { color: #555; font-size: 0.8rem; }
    .tag::before { content: "・"; }
    .empty { padding: 2rem 1.5rem; color: #888; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/")}
  <nav class="tabs">
    ${allTab}
    ${prefTabs}
  </nav>
  <form class="search-form" action="/" method="get">
    ${activePref ? `<input type="hidden" name="pref" value="${activePref}">` : ""}
    <input type="search" name="animal" value="${escapedAnimal}" placeholder="動物名で検索（例: パンダ）" aria-label="動物名で検索">
    <button type="submit">検索</button>
    ${animal ? `<a href="${buildBrowseUrl(activePref, null)}">クリア</a>` : ""}
  </form>
  <p class="summary">${summary}</p>
  ${count > 0 ? `<div class="zoo-list">${cards}</div>` : `<p class="empty">${emptyMessage}</p>`}
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
</body>
</html>`;
}

function buildAnimalsUrl(filter: AnimalListFilter): string {
  return filter === "unclassified" ? "/animals?filter=unclassified" : "/animals";
}

function renderAnimalsHtml(animals: AnimalListItem[], filter: AnimalListFilter): string {
  const items = renderAnimalCards(animals);
  const summary =
    filter === "unclassified"
      ? `分類未設定: ${animals.length} 件`
      : `登録動物: ${animals.length} 件`;

  const emptyMessage =
    animals.length === 0
      ? filter === "unclassified"
        ? `<p class="empty">分類未設定の動物はありません。</p>`
        : `<p class="empty">動物データがまだありません。各動物園の動物一覧を取得するか、全件更新を実行してください。</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>動物一覧 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    .tabs { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; }
    .tab { color: #1f5b45; text-decoration: none; font-size: 0.9rem; }
    .tab.active { font-weight: bold; text-decoration: underline; text-underline-offset: 0.2em; }
    .tab:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .summary { padding: 0.75rem 1.5rem; font-size: 0.9rem; color: #666; }
    .animal-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; padding: 1rem 1.5rem; }
    .animal-item { border: 1px solid #ddd; padding: 1rem; }
    .animal-item h2 { font-size: 1.05rem; margin-bottom: 0.35rem; }
    .animal-item h2 a { color: #1f5b45; text-decoration: none; }
    .animal-item h2 a:hover { text-decoration: underline; }
    .taxonomy-details { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border: 1px solid #e1e1e1; margin-bottom: 0.65rem; }
    .taxonomy-details div { min-width: 0; border-right: 1px solid #e1e1e1; }
    .taxonomy-details div:last-child { border-right: 0; }
    .taxonomy-details dt { background: #f6f8f7; color: #666; font-size: 0.7rem; padding: 0.28rem 0.35rem; border-bottom: 1px solid #e1e1e1; }
    .taxonomy-details dd { color: #222; font-size: 0.78rem; padding: 0.35rem; min-height: 2.2rem; overflow-wrap: anywhere; }
    .unclassified { color: #777; background: #f7f7f7; border: 1px solid #e1e1e1; padding: 0.45rem 0.55rem; margin-bottom: 0.65rem; font-size: 0.8rem; }
    .display-names { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; margin-bottom: 0.55rem; color: #666; font-size: 0.75rem; }
    .display-names b { color: #555; margin-right: 0.1rem; }
    .display-names a { background: #f7f7f7; border: 1px solid #e1e1e1; color: #1f5b45; padding: 0.12rem 0.35rem; text-decoration: none; }
    .display-names a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .animal-item p { color: #666; font-size: 0.85rem; margin-bottom: 0.65rem; }
    .zoo-links { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .zoo-links a { color: #2d6a4f; border: 1px solid #d3e4d8; background: #f7fbf8; padding: 0.2rem 0.45rem; font-size: 0.78rem; text-decoration: none; }
    .zoo-links a:hover { text-decoration: underline; }
    .empty { padding: 2rem 1.5rem; color: #888; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
    @media (max-width: 560px) {
      .taxonomy-details { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .taxonomy-details div { border-bottom: 1px solid #e1e1e1; }
      .taxonomy-details div:nth-child(2n) { border-right: 0; }
      .taxonomy-details div:last-child { border-bottom: 0; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/animals")}
  <nav class="tabs">
    <a href="${buildAnimalsUrl("all")}" class="tab${filter === "all" ? " active" : ""}">すべて</a>
    <a href="${buildAnimalsUrl("unclassified")}" class="tab${filter === "unclassified" ? " active" : ""}">分類未設定</a>
  </nav>
  <p class="summary">${summary}</p>
  ${animals.length > 0 ? `<div class="animal-list">${items}</div>` : emptyMessage}
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
</body>
</html>`;
}

function renderAnimalCards(animals: AnimalListItem[]): string {
  return animals
    .map((item) => {
      const zooLinks = item.zoos
        .map((zoo) => `<a href="/zoos/${zoo.id}">${escapeHtml(zoo.name)}</a>`)
        .join("");
      const primaryDisplayName = item.displayNames[0] ?? item.canonicalName ?? "";
      const searchName = item.canonicalName ?? primaryDisplayName;
      const title = item.canonicalName
        ? escapeHtml(item.canonicalName)
        : escapeHtml(primaryDisplayName);
      const titleHref = primaryDisplayName ? buildZooAnimalUrl(primaryDisplayName) : buildAnimalSearchUrl(searchName);
      const taxonomyDetails = [
        ["類", item.className],
        ["目", item.orderName],
        ["科", item.familyName],
        ["属", item.genusName],
        ["種", item.speciesName],
      ]
        .filter((detail): detail is [string, string] => Boolean(detail[1]))
        .map(
          ([label, value]) => `
            <div>
              <dt>${escapeHtml(label)}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>`
        )
        .join("");
      const taxonomyRow = taxonomyDetails
        ? `<dl class="taxonomy-details">${taxonomyDetails}</dl>`
        : `<p class="unclassified">分類未設定</p>`;
      const displayNames = item.displayNames
        .map((displayName) => `<a href="${buildZooAnimalUrl(displayName)}">${escapeHtml(displayName)}</a>`)
        .join("");
      const displayNamesRow =
        item.canonicalName && displayNames
          ? `<div class="display-names"><b>公式表示</b>${displayNames}</div>`
          : "";

      return `
        <article class="animal-item">
          <h2><a href="${titleHref}">${title}</a></h2>
          ${taxonomyRow}
          ${displayNamesRow}
          <p>${item.zoos.length} 施設</p>
          <div class="zoo-links">${zooLinks}</div>
        </article>`;
    })
    .join("\n");
}

function renderZooAnimalDetailHtml(detail: ZooAnimalDetail, notice?: string): string {
  const escapedDisplayName = escapeHtml(detail.displayName);
  const title = detail.canonicalName && detail.canonicalName !== detail.displayName
    ? `${escapeHtml(detail.canonicalName)} | ${escapedDisplayName}`
    : escapedDisplayName;
  const taxonomyDetails = [
    ["類", detail.className],
    ["目", detail.orderName],
    ["科", detail.familyName],
    ["属", detail.genusName],
    ["種", detail.speciesName],
  ]
    .filter((item): item is [string, string] => Boolean(item[1]))
    .map(
      ([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>`
    )
    .join("");
  const taxonomyPath =
    detail.className && detail.orderName && detail.familyName && detail.genusName && detail.speciesName
      ? buildTaxonomyPathUrl([
          detail.className,
          detail.orderName,
          detail.familyName,
          detail.genusName,
          detail.speciesName,
        ])
      : null;
  const taxonomyHtml = taxonomyDetails
    ? `<dl class="taxonomy-details">${taxonomyDetails}</dl>`
    : `<p class="unclassified">分類未設定</p>`;
  const canonicalHtml =
    detail.canonicalName && detail.canonicalName !== detail.displayName
      ? `<p class="canonical">分類マスタ: ${escapeHtml(detail.canonicalName)}</p>`
      : "";
  const taxonomyLink = taxonomyPath
    ? `<a href="${taxonomyPath}">分類ページ</a>`
    : "";
  const noticeHtml = notice
    ? `<p class="notice">${escapeHtml(notice)}</p>`
    : "";
  const classifyAction = `${buildZooAnimalUrl(detail.displayName)}/classify`;
  const classifyForm = `
    <form class="classify-form" action="${classifyAction}" method="post">
      <button type="submit">LLMで分類しなおす</button>
    </form>`;
  const zooLinks = detail.zoos
    .map(
      (zoo) => `
        <li>
          <a href="/zoos/${zoo.id}">${escapeHtml(zoo.name)}</a>
          <span>${escapeHtml(PREF_LABELS[zoo.prefecture])}</span>
        </li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { display: grid; gap: 1rem; padding: 1rem 1.5rem 1.5rem; max-width: 880px; }
    .page-title { font-size: 1.1rem; font-weight: bold; overflow-wrap: anywhere; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; color: #333; }
    section { border-top: 1px solid #ddd; padding-top: 1rem; }
    section:first-child { border-top: 0; padding-top: 0; }
    h2 { font-size: 1.05rem; margin-bottom: 0.75rem; }
    .canonical { color: #555; font-size: 0.9rem; margin-bottom: 0.75rem; }
    .taxonomy-details { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border: 1px solid #e1e1e1; }
    .taxonomy-details div { min-width: 0; border-right: 1px solid #e1e1e1; }
    .taxonomy-details div:last-child { border-right: 0; }
    .taxonomy-details dt { background: #f6f8f7; color: #666; font-size: 0.72rem; padding: 0.32rem 0.4rem; border-bottom: 1px solid #e1e1e1; }
    .taxonomy-details dd { color: #222; font-size: 0.86rem; padding: 0.45rem 0.4rem; min-height: 2.35rem; overflow-wrap: anywhere; }
    .unclassified { color: #777; background: #f7f7f7; border: 1px solid #e1e1e1; padding: 0.55rem 0.65rem; font-size: 0.85rem; }
    .notice { border: 1px solid #cfe5d8; background: #f5fbf7; color: #244d37; padding: 0.6rem 0.75rem; font-size: 0.86rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
    .actions a { color: #1f5b45; border: 1px solid #d3e4d8; background: #f7fbf8; padding: 0.35rem 0.6rem; font-size: 0.82rem; text-decoration: none; }
    .actions a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .classify-form { margin-top: 0.75rem; }
    .classify-form button { border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.48rem 0.8rem; font-size: 0.86rem; cursor: pointer; }
    .classify-form button:hover { background: #174533; }
    .zoo-list { display: grid; gap: 0.45rem; list-style: none; }
    .zoo-list li { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: baseline; border: 1px solid #e1e1e1; padding: 0.65rem 0.75rem; }
    .zoo-list a { color: #1f5b45; font-weight: bold; text-decoration: none; }
    .zoo-list a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .zoo-list span { color: #777; font-size: 0.8rem; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
    @media (max-width: 560px) {
      .taxonomy-details { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .taxonomy-details div { border-bottom: 1px solid #e1e1e1; }
      .taxonomy-details div:nth-child(2n) { border-right: 0; }
      .taxonomy-details div:last-child { border-bottom: 0; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/animals")}
  <p class="page-title">${escapedDisplayName}</p>
  <main>
    ${noticeHtml}
    <section>
      <h2>分類</h2>
      ${canonicalHtml}
      ${taxonomyHtml}
      ${taxonomyLink ? `<div class="actions">${taxonomyLink}</div>` : ""}
      ${classifyForm}
      <div class="actions"><a href="${buildAnimalSearchUrl(detail.displayName)}">この名前で検索</a></div>
    </section>
    <section>
      <h2>見られる施設</h2>
      <ul class="zoo-list">${zooLinks}</ul>
    </section>
  </main>
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
</body>
</html>`;
}

function renderTaxonomyHtml(sections: TaxonomyOverviewSection[]): string {
  const sectionHtml = sections
    .map((section) => {
      const values = section.values
        .map((value) => {
          const href =
            section.key === "class"
              ? buildTaxonomyPathUrl([value.name])
              : buildLegacyTaxonomyUrl(section.key, value.name);
          return `
            <a class="taxonomy-link" href="${href}">
              <span>${escapeHtml(value.name)}</span>
              <small>${value.animal_count} 種 / ${value.zoo_count} 施設</small>
            </a>`;
        })
        .join("");

      return `
        <section class="taxonomy-section">
          <h2>${escapeHtml(section.label)}</h2>
          <div class="taxonomy-links">${values}</div>
        </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>分類から探す | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    .taxonomy-page { display: grid; gap: 1.25rem; padding: 1rem 1.5rem 1.5rem; }
    .taxonomy-section { border-top: 1px solid #ddd; padding-top: 1rem; }
    .taxonomy-section:first-child { border-top: 0; padding-top: 0; }
    .taxonomy-section h2 { font-size: 1.05rem; margin-bottom: 0.75rem; }
    .taxonomy-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.55rem; }
    .taxonomy-link { display: grid; gap: 0.2rem; border: 1px solid #dce7df; background: #f8fbf9; color: #1f5b45; padding: 0.65rem 0.75rem; text-decoration: none; }
    .taxonomy-link:hover { border-color: #9bc4ab; background: #f1f8f3; }
    .taxonomy-link span { font-weight: bold; overflow-wrap: anywhere; }
    .taxonomy-link small { color: #617469; font-size: 0.75rem; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/taxonomy")}
  <main class="taxonomy-page">${sectionHtml}</main>
  <footer>分類は利用者が探しやすい粒度で整理しています。最新情報は各施設の公式サイトでご確認ください。</footer>
</body>
</html>`;
}

function renderTaxonomyDetailHtml(
  levels: TaxonomyPathLevel[],
  childSection: TaxonomyOverviewSection | null,
  animals: AnimalListItem[]
): string {
  const current = levels[levels.length - 1];
  const { rank, value } = current;
  const escapedValue = escapeHtml(value);
  const items = renderAnimalCards(animals);
  const breadcrumb = renderTaxonomyBreadcrumb(levels);
  const childLinks =
    childSection && childSection.values.length > 0
      ? childSection.values
          .map(
            (child) => `
              <a class="taxonomy-link" href="${buildTaxonomyUrl(levels, child.name)}">
                <span>${escapeHtml(child.name)}</span>
                <small>${child.animal_count} 種 / ${child.zoo_count} 施設</small>
              </a>`
          )
          .join("")
      : "";
  const childSectionHtml =
    childSection && childLinks
      ? `
        <section class="child-taxonomy">
          <h2>この${escapeHtml(rank.label)}に含まれる${escapeHtml(childSection.label)}</h2>
          <div class="taxonomy-links">${childLinks}</div>
        </section>`
      : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedValue} | 分類から探す | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    .breadcrumb { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; padding: 0.65rem 1.5rem; border-bottom: 1px solid #e5e5e5; color: #777; font-size: 0.78rem; }
    .breadcrumb a { color: #1f5b45; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .breadcrumb span[aria-current="page"] { color: #333; font-weight: bold; overflow-wrap: anywhere; }
    .summary { padding: 0.75rem 1.5rem; font-size: 0.9rem; color: #666; }
    .child-taxonomy { padding: 1rem 1.5rem; border-bottom: 1px solid #ddd; }
    .child-taxonomy h2 { font-size: 1.05rem; margin-bottom: 0.75rem; }
    .taxonomy-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.55rem; }
    .taxonomy-link { display: grid; gap: 0.2rem; border: 1px solid #dce7df; background: #f8fbf9; color: #1f5b45; padding: 0.65rem 0.75rem; text-decoration: none; }
    .taxonomy-link:hover { border-color: #9bc4ab; background: #f1f8f3; }
    .taxonomy-link span { font-weight: bold; overflow-wrap: anywhere; }
    .taxonomy-link small { color: #617469; font-size: 0.75rem; }
    .animal-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; padding: 1rem 1.5rem; }
    .animal-item { border: 1px solid #ddd; padding: 1rem; }
    .animal-item h2 { font-size: 1.05rem; margin-bottom: 0.35rem; }
    .animal-item h2 a { color: #1f5b45; text-decoration: none; }
    .animal-item h2 a:hover { text-decoration: underline; }
    .taxonomy-details { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border: 1px solid #e1e1e1; margin-bottom: 0.65rem; }
    .taxonomy-details div { min-width: 0; border-right: 1px solid #e1e1e1; }
    .taxonomy-details div:last-child { border-right: 0; }
    .taxonomy-details dt { background: #f6f8f7; color: #666; font-size: 0.7rem; padding: 0.28rem 0.35rem; border-bottom: 1px solid #e1e1e1; }
    .taxonomy-details dd { color: #222; font-size: 0.78rem; padding: 0.35rem; min-height: 2.2rem; overflow-wrap: anywhere; }
    .display-names { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; margin-bottom: 0.55rem; color: #666; font-size: 0.75rem; }
    .display-names b { color: #555; margin-right: 0.1rem; }
    .display-names span { background: #f7f7f7; border: 1px solid #e1e1e1; padding: 0.12rem 0.35rem; }
    .animal-item p { color: #666; font-size: 0.85rem; margin-bottom: 0.65rem; }
    .zoo-links { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .zoo-links a { color: #2d6a4f; border: 1px solid #d3e4d8; background: #f7fbf8; padding: 0.2rem 0.45rem; font-size: 0.78rem; text-decoration: none; }
    .zoo-links a:hover { text-decoration: underline; }
    .empty { padding: 2rem 1.5rem; color: #888; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
    @media (max-width: 560px) {
      .taxonomy-details { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .taxonomy-details div { border-bottom: 1px solid #e1e1e1; }
      .taxonomy-details div:nth-child(2n) { border-right: 0; }
      .taxonomy-details div:last-child { border-bottom: 0; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/taxonomy")}
  ${breadcrumb}
  <p class="summary">${escapeHtml(rank.label)}: ${escapedValue} / 動物: ${animals.length} 件</p>
  ${childSectionHtml}
  ${animals.length > 0 ? `<div class="animal-list">${items}</div>` : `<p class="empty">該当する動物がありません。</p>`}
  <footer>分類は利用者が探しやすい粒度で整理しています。最新情報は各施設の公式サイトでご確認ください。</footer>
</body>
</html>`;
}

function renderZooDetailHtml(zoo: Zoo, scraped: ScrapeResult): string {
  const prefLabel = PREF_LABELS[zoo.prefecture];
  const features = zoo.features
    .map((feature) => `<li>${escapeHtml(feature)}</li>`)
    .join("\n");
  const animalLinks = scraped.animals
    .map(
      (animal) =>
        `<li><a href="${buildZooAnimalUrl(animal)}">${escapeHtml(animal)}</a></li>`
    )
    .join("\n");
  const updatedAt = new Date(scraped.scrapedAt).toLocaleString("ja-JP");
  const animalListHtml =
    scraped.animals.length > 0
      ? `<ul class="animal-links">${animalLinks}</ul>`
      : `<p class="empty">動物一覧を取得できませんでした。公式サイトもあわせてご確認ください。</p>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(zoo.name)} | 近畿動物園情報</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 840px; margin: 0 auto; padding: 1.5rem; }
    .card { background: #fff; border: 1px solid #ddd; padding: 1.25rem; margin-bottom: 1rem; }
    h2 { margin-bottom: 0.5rem; }
    h3 { font-size: 1.05rem; margin-bottom: 0.75rem; }
    .kana { color: #777; margin-bottom: 1rem; }
    dl { display: grid; grid-template-columns: 6em 1fr; gap: 0.25rem 0.5rem; margin-bottom: 1rem; }
    dt { color: #666; font-weight: bold; }
    ul { padding-left: 1.2rem; }
    .animal-summary { color: #666; font-size: 0.85rem; margin-bottom: 0.75rem; }
    .animal-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.4rem 1rem; padding: 0; list-style: none; }
    .animal-links li { min-width: 0; }
    .animal-links a { display: block; color: #1f5b45; border-bottom: 1px solid #e7eee9; padding: 0.35rem 0; text-decoration: none; overflow-wrap: anywhere; }
    .animal-links a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .animal-meta { color: #777; font-size: 0.78rem; margin-top: 0.85rem; }
    .error { color: #b00020; margin-bottom: 0.75rem; }
    .empty { color: #777; }
    #map { height: 320px; border: 1px solid #ddd; }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/")}
  <main>
    <nav class="page-nav">
      <a href="#animals">動物一覧</a>
      <a href="/zoos/${zoo.id}/animals">動物一覧だけ見る</a>
      <a href="${escapeHtml(zoo.website)}" target="_blank" rel="noopener noreferrer">公式サイト</a>
    </nav>
    <section class="card">
      <h2>${escapeHtml(zoo.name)}</h2>
      <p class="kana">${escapeHtml(zoo.nameKana)}</p>
      <dl>
        <dt>都道府県</dt><dd>${prefLabel}</dd>
        <dt>住所</dt><dd>${escapeHtml(zoo.address)}</dd>
        <dt>開園時間</dt><dd>${escapeHtml(zoo.openingHours)}</dd>
        <dt>休園日</dt><dd>${escapeHtml(zoo.closedDays)}</dd>
        <dt>入園料</dt><dd>${escapeHtml(zoo.admission)}</dd>
        ${
          zoo.directorySourceName && zoo.directorySourceUrl
            ? `<dt>施設一覧出典</dt><dd><a href="${escapeHtml(zoo.directorySourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(zoo.directorySourceName)}</a></dd>`
            : ""
        }
      </dl>
      <h3>特徴</h3>
      <ul>${features}</ul>
    </section>
    <section class="card" id="animals">
      <h3>見られる動物</h3>
      <p class="animal-summary">${scraped.animals.length} 件</p>
      ${scraped.error ? `<p class="error">取得に失敗しました: ${escapeHtml(scraped.error)}</p>` : ""}
      ${animalListHtml}
      <p class="animal-meta">最終取得: ${escapeHtml(updatedAt)}</p>
    </section>
    <div id="map"></div>
  </main>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
    var map = L.map('map').setView([${zoo.lat}, ${zoo.lon}], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    L.marker([${zoo.lat}, ${zoo.lon}])
      .bindPopup(${JSON.stringify(escapeHtml(zoo.name))})
      .addTo(map)
      .openPopup();
  </script>
</body>
</html>`;
}

function renderMapHtml(filteredZoos: Zoo[], activePref: PrefectureCode | null, animal: string | null): string {
  const escapedAnimal = animal ? escapeHtml(animal) : "";
  const allTab = activePref
    ? `<a href="${buildMapUrl(null, animal)}" class="tab">すべて</a>`
    : `<a href="${buildMapUrl(null, animal)}" class="tab active">すべて</a>`;
  const prefTabs = PREF_CODES.map((code) =>
    `<a href="${buildMapUrl(code, animal)}" class="${code === activePref ? "tab active" : "tab"}">${PREF_LABELS[code]}</a>`
  ).join("\n");

  // Embed only the data needed for map markers; safe to embed as JSON in <script>
  const mapData = JSON.stringify(
    filteredZoos.map((z) => ({ id: z.id, name: z.name, lat: z.lat, lon: z.lon }))
  ).replace(/<\//g, "<\\/");

  const count = filteredZoos.length;
  const prefLabel = activePref && isPrefectureCode(activePref) ? PREF_LABELS[activePref] : "近畿一円";
  const summary = animal
    ? `${prefLabel} で「${escapedAnimal}」を探せる動物園・施設: ${count} 件`
    : `${prefLabel} の動物園・施設: ${count} 件`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>地図 | 近畿動物園情報</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; display: flex; flex-direction: column; height: 100vh; }${COMMON_STYLES}
    .site-header { flex-shrink: 0; }
    .global-nav { flex-shrink: 0; }
    .tabs { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; flex-shrink: 0; }
    .tab { color: #1f5b45; text-decoration: none; font-size: 0.9rem; }
    .tab.active { font-weight: bold; text-decoration: underline; text-underline-offset: 0.2em; }
    .tab:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .list-link { margin-left: auto; font-size: 0.85rem; color: #1f5b45; text-decoration: none; }
    .list-link:hover { text-decoration: underline; }
    .search-form { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; flex-shrink: 0; }
    .search-form input { flex: 1 1 220px; max-width: 320px; padding: 0.55rem 0.75rem; border: 1px solid #bbb; font-size: 0.95rem; }
    .search-form button, .search-form a { font-size: 0.875rem; }
    .search-form button { border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.5rem 0.9rem; cursor: pointer; }
    .search-form a { padding: 0.5rem 0.7rem; color: #1f5b45; text-decoration: none; border: 1px solid #1f5b45; }
    .summary { padding: 0.4rem 1.5rem; font-size: 0.9rem; color: #666; flex-shrink: 0; }
    #map { flex: 1; min-height: 0; }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/map")}
  <nav class="tabs">
    ${allTab}
    ${prefTabs}
    <a href="${buildBrowseUrl(activePref, animal)}" class="list-link">一覧で見る →</a>
  </nav>
  <form class="search-form" action="/map" method="get">
    ${activePref ? `<input type="hidden" name="pref" value="${activePref}">` : ""}
    <input type="search" name="animal" value="${escapedAnimal}" placeholder="動物名で検索（例: パンダ）" aria-label="動物名で検索">
    <button type="submit">検索</button>
    ${animal ? `<a href="${buildMapUrl(activePref, null)}">クリア</a>` : ""}
  </form>
  <p class="summary">${summary}</p>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
    var zoos = ${mapData};
    var map = L.map('map').setView([34.7, 135.5], 8);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    function esc(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    zoos.forEach(function(zoo) {
      L.marker([zoo.lat, zoo.lon])
        .bindPopup('<b><a href="/zoos/' + esc(zoo.id) + '">' + esc(zoo.name) + '</a></b>')
        .addTo(map);
    });
    if (zoos.length > 0) {
      var bounds = L.latLngBounds(zoos.map(function(z) { return [z.lat, z.lon]; }));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  </script>
</body>
</html>`;
}

function renderZooAnimalsHtml(zoo: Zoo, scraped: Awaited<ReturnType<typeof scrapeAnimals>>): string {
  const items = scraped.animals
    .map((animal) => `<li>${escapeHtml(animal)}</li>`)
    .join("\n");
  const updatedAt = new Date(scraped.scrapedAt).toLocaleString("ja-JP");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(zoo.name)}の動物一覧 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 840px; margin: 0 auto; padding: 1.5rem; }
    .card { background: #fff; border: 1px solid #ddd; padding: 1.25rem; }
    h2 { margin-bottom: 0.75rem; }
    ul { padding-left: 1.2rem; }
    li { margin-bottom: 0.35rem; }
    .meta { margin-top: 1rem; color: #666; font-size: 0.85rem; }
    .error { color: #b00020; margin-bottom: 0.75rem; }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/")}
  <main>
    <nav class="page-nav">
      <a href="/zoos/${zoo.id}">${escapeHtml(zoo.name)}の詳細</a>
      <a href="${escapeHtml(zoo.website)}" target="_blank" rel="noopener noreferrer">公式サイト</a>
    </nav>
    <section class="card">
      <h2>${escapeHtml(zoo.name)}の動物一覧</h2>
      ${scraped.error ? `<p class="error">取得に失敗しました: ${escapeHtml(scraped.error)}</p>` : ""}
      ${
        scraped.animals.length > 0
          ? `<ul>${items}</ul>`
          : "<p>動物一覧を取得できませんでした。公式サイトもあわせてご確認ください。</p>"
      }
      <p class="meta">最終取得: ${escapeHtml(updatedAt)}</p>
    </section>
  </main>
</body>
</html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // JSON API: /api/zoos
    if (pathname === "/api/zoos") {
      const pref = url.searchParams.get("pref");
      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      if (pref && !isPrefectureCode(pref)) {
        return notFound(`都道府県コード '${pref}' は無効です`);
      }
      const results = await searchZoos(env.DB, pref, animal);
      return jsonResponse(results.map((result) => toApiZoo(result, Boolean(animal))));
    }

    // JSON API: refresh all animal caches
    if (pathname === "/api/animals/refresh") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "POST を使用してください" }, 405);
      }
      const results = await refreshAllAnimalCache(env.DB);
      return jsonResponse({ refreshed: results.length, results });
    }

    // JSON API: classify cached zoo animal display names
    if (pathname === "/api/animals/classify") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "POST を使用してください" }, 405);
      }
      const result = await classifyCachedZooAnimals(env.DB);
      return jsonResponse(result);
    }

    // JSON API: suggest taxonomy candidates with Gemini grounding
    if (pathname === "/api/animals/suggest-taxonomy") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "POST を使用してください" }, 405);
      }
      if (!env.GEMINI_API_KEY) {
        return jsonResponse({ error: "GEMINI_API_KEY が設定されていません" }, 500);
      }

      const body = (await request.json().catch(() => ({}))) as {
        displayNames?: unknown;
        limit?: unknown;
      };
      const requestedNames = Array.isArray(body.displayNames)
        ? body.displayNames.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
      const limit =
        typeof body.limit === "number" && Number.isFinite(body.limit)
          ? Math.max(1, Math.min(20, Math.floor(body.limit)))
          : 10;
      const displayNames =
        requestedNames.length > 0
          ? [...new Set(requestedNames.map((name) => name.trim()))].slice(0, 20)
          : await loadUnclassifiedDisplayNames(env.DB, limit);

      if (displayNames.length === 0) {
        return jsonResponse({ suggested: 0, candidates: [] });
      }

      const suggestion = await suggestTaxonomyWithGemini(env.GEMINI_API_KEY, displayNames);
      await saveTaxonomyCandidates(
        env.DB,
        suggestion.candidates,
        GEMINI_TAXONOMY_MODEL,
        suggestion.sources
      );

      return jsonResponse({
        requested: displayNames.length,
        suggested: suggestion.candidates.length,
        candidates: suggestion.candidates,
        groundingSources: suggestion.sources,
      });
    }

    // JSON API: list taxonomy candidates
    if (pathname === "/api/animals/taxonomy-candidates") {
      if (request.method !== "GET") {
        return jsonResponse({ error: "GET を使用してください" }, 405);
      }
      const candidates = await loadTaxonomyCandidates(env.DB);
      return jsonResponse({ candidates });
    }

    // HTML: /animals
    if (pathname === "/animals") {
      const filter: AnimalListFilter =
        url.searchParams.get("filter") === "unclassified" ? "unclassified" : "all";
      const animals = await loadAnimalList(env.DB, filter);
      const html = renderAnimalsHtml(animals, filter);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // HTML: /animal/:displayName
    const animalClassifyMatch = pathname.match(/^\/animal\/(.+)\/classify$/);
    if (animalClassifyMatch) {
      if (request.method !== "POST") {
        return jsonResponse({ error: "POST を使用してください" }, 405);
      }
      const displayName = decodeURIComponent(animalClassifyMatch[1]);
      const detail = await loadZooAnimalDetail(env.DB, displayName);
      if (!detail) return notFound(`動物 '${displayName}' が見つかりません`);
      const redirectTo = (status: string) =>
        Response.redirect(`${url.origin}${buildZooAnimalUrl(displayName)}?llm=${encodeURIComponent(status)}`, 303);

      if (!env.GEMINI_API_KEY) {
        return redirectTo("missing-key");
      }

      try {
        const suggestion = await suggestTaxonomyWithGemini(env.GEMINI_API_KEY, [displayName]);
        await saveTaxonomyCandidates(env.DB, suggestion.candidates, GEMINI_TAXONOMY_MODEL, suggestion.sources);
        const candidate = suggestion.candidates.find((item) => item.displayName === displayName);
        if (!candidate) return redirectTo("no-candidate");

        const result = await applyTaxonomyCandidate(env.DB, candidate);
        return redirectTo(result.status);
      } catch (error) {
        console.error(error);
        return redirectTo("error");
      }
    }

    if (pathname.startsWith("/animal/")) {
      const displayName = decodeURIComponent(pathname.slice("/animal/".length));
      const detail = await loadZooAnimalDetail(env.DB, displayName);
      if (!detail) return notFound(`動物 '${displayName}' が見つかりません`);
      const llmStatus = url.searchParams.get("llm");
      const notice =
        llmStatus === "applied"
          ? "LLM分類を反映しました。"
          : llmStatus === "partial"
            ? "LLM分類を実行し、確認できた範囲の分類を反映しました。"
          : llmStatus === "rejected"
            ? "LLM分類を実行しましたが、分類を確定できませんでした。"
            : llmStatus === "missing-key"
              ? "GEMINI_API_KEY が設定されていないため、LLM分類を実行できません。"
              : llmStatus === "no-candidate"
                ? "LLM分類結果にこの表示名の候補がありませんでした。"
                : llmStatus === "error"
                  ? "LLM分類でエラーが発生しました。"
                  : undefined;
      const html = renderZooAnimalDetailHtml(detail, notice);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // HTML: /taxonomy
    if (pathname === "/taxonomy") {
      const sections = await loadTaxonomyOverview(env.DB);
      const html = renderTaxonomyHtml(sections);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // HTML: /taxonomy/:rank/:value
    const taxonomyPageMatch = pathname.match(/^\/taxonomy\/([^/]+)\/([^/]+)$/);
    if (taxonomyPageMatch) {
      const rank = getTaxonomyRank(taxonomyPageMatch[1]);
      if (rank) {
        const value = decodeURIComponent(taxonomyPageMatch[2]);
        const levels = [{ rank, value }];
        const childSection = await loadChildTaxonomyValues(env.DB, levels);
        const animals = await loadTaxonomyAnimals(env.DB, levels);
        if (animals.length === 0) return notFound(`分類 '${value}' に該当する動物が見つかりません`);
        const html = renderTaxonomyDetailHtml(levels, childSection, animals);
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    }

    // HTML: /taxonomy/:class/:order?/:family?/:genus?/:species?
    if (pathname.startsWith("/taxonomy/")) {
      const levels = parseTaxonomyPath(pathname);
      if (!levels) return notFound("分類 URL が無効です");
      const childSection = await loadChildTaxonomyValues(env.DB, levels);
      const animals = await loadTaxonomyAnimals(env.DB, levels);
      if (animals.length === 0) {
        return notFound(`分類 '${levels.at(-1)?.value ?? ""}' に該当する動物が見つかりません`);
      }
      const html = renderTaxonomyDetailHtml(levels, childSection, animals);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // JSON API: /api/zoos/:id/animals
    const zooAnimalsMatch = pathname.match(/^\/api\/zoos\/([^/]+)\/animals$/);
    if (zooAnimalsMatch) {
      const id = zooAnimalsMatch[1];
      const zoo = zoos.find((z) => z.id === id);
      if (!zoo) return notFound(`動物園 '${id}' が見つかりません`);
      const result = await getAnimalResult(env.DB, id, url.searchParams.get("refresh") === "1");
      return jsonResponse(result);
    }

    // JSON API: /api/zoos/:id
    const zooIdMatch = pathname.match(/^\/api\/zoos\/([^/]+)$/);
    if (zooIdMatch) {
      const id = zooIdMatch[1];
      const zoo = zoos.find((z) => z.id === id);
      if (!zoo) return notFound(`動物園 '${id}' が見つかりません`);
      return jsonResponse(zoo);
    }

    // HTML: /zoos/:id/animals
    const zooAnimalsPageMatch = pathname.match(/^\/zoos\/([^/]+)\/animals$/);
    if (zooAnimalsPageMatch) {
      const id = zooAnimalsPageMatch[1];
      const zoo = zoos.find((z) => z.id === id);
      if (!zoo) return notFound(`動物園 '${id}' が見つかりません`);
      const scraped = await getAnimalResult(env.DB, id, url.searchParams.get("refresh") === "1");
      const html = renderZooAnimalsHtml(zoo, scraped);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // HTML: /zoos/:id
    const zooPageMatch = pathname.match(/^\/zoos\/([^/]+)$/);
    if (zooPageMatch) {
      const id = zooPageMatch[1];
      const zoo = zoos.find((z) => z.id === id);
      if (!zoo) return notFound(`動物園 '${id}' が見つかりません`);
      const scraped = await getAnimalResult(env.DB, id, url.searchParams.get("refresh") === "1");
      const html = renderZooDetailHtml(zoo, scraped);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // HTML: /map
    if (pathname === "/map") {
      const pref = url.searchParams.get("pref");
      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      const activePref: PrefectureCode | null = pref && isPrefectureCode(pref) ? pref : null;
      const filtered = (await searchZoos(env.DB, activePref, animal)).map((result) => result.zoo);
      const html = renderMapHtml(filtered, activePref, animal);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // HTML: /
    if (pathname === "/") {
      const pref = url.searchParams.get("pref");
      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      const activePref: PrefectureCode | null = pref && isPrefectureCode(pref) ? pref : null;
      const results = await searchZoos(env.DB, activePref, animal);
      const html = renderHtml(results, activePref, animal);
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return notFound("ページが見つかりません");
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refreshAllAnimalCache(env.DB));
  },
};
