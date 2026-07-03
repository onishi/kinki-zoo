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
  animalCount: number;
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
  name_sort_key: string | null;
  class_name: string | null;
  order_name: string | null;
  family_name: string | null;
  genus_name: string | null;
  species_name: string | null;
}

interface AnimalListItem {
  displayNames: string[];
  canonicalName?: string;
  nameSortKey?: string;
  className?: string;
  orderName?: string;
  familyName?: string;
  genusName?: string;
  speciesName?: string;
  zoos: Zoo[];
}

type ClassificationStatus = "registered" | "llm_candidate" | "unclassified" | "rejected";

interface ZooAnimalDetail {
  displayName: string;
  canonicalName?: string;
  className?: string;
  orderName?: string;
  familyName?: string;
  genusName?: string;
  speciesName?: string;
  zoos: Zoo[];
  classificationStatus: ClassificationStatus;
}

interface ScrapeResultRow {
  zoo_id: string;
  scraped_at: string;
  error: string | null;
}

interface ZooCoverageStats {
  total: number;
  classified: number;
  partial: number;
  unclassified: number;
}

interface ZooAnimalTaxonomyRow {
  display_name: string;
  class_name: string | null;
}

type ScrapeDiffType = "added" | "removed" | "renamed";
type ScrapeWarningType = "scrape_error" | "empty_result" | "below_minimum" | "sharp_drop" | "high_removal_count";

interface ScrapeDiffRecord {
  type: ScrapeDiffType;
  previousDisplayName: string | null;
  currentDisplayName: string | null;
}

interface ScrapeWarningRecord {
  type: ScrapeWarningType;
  message: string;
  previousCount: number | null;
  currentCount: number;
  thresholdCount: number | null;
}

interface ScrapeHealthItem {
  zoo: Zoo;
  scrapedAt: string | null;
  error: string | null;
  animalCount: number;
  warningCount: number;
  warningMessages: string[];
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

interface AnimalImageRecord {
  animalKey: string;
  displayName: string;
  normalizedName: string;
  selectedGenerationId?: number;
  prompt: string;
  model: string;
  mimeType: string;
  imageBase64: string;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

interface AnimalImageGenerationRecord {
  id: number;
  animalKey: string;
  displayName: string;
  normalizedName: string;
  prompt: string;
  model: string;
  mimeType: string;
  imageBase64: string;
  width: number;
  height: number;
  createdAt: string;
  selected: boolean;
}

interface AnimalImageManageItem {
  displayName: string;
  animalKey: string;
  selectedGenerationId: number | null;
  generationCount: number;
  updatedAt: string | null;
  generations: AnimalImageGenerationSummary[];
}

interface AnimalImageGenerationSummary {
  id: number;
  animalKey: string;
  model: string;
  createdAt: string;
  selected: boolean;
}

type TaxonomyRank = "class" | "order" | "family" | "genus" | "species";
type AnimalListFilter = "all" | "unclassified";
type AnimalImageVersionIndex = Map<string, number | null>;

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

interface TaxonomyTreeNode {
  name: string;
  animalCount: number;
  zooCount: number;
  children: TaxonomyTreeNode[];
}

interface TaxonomyTreeRow {
  rank_level: "class" | "order" | "family";
  class_name: string;
  order_name: string | null;
  family_name: string | null;
  animal_count: number;
  zoo_count: number;
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
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const GEMINI_IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3-pro-image",
];
const ANIMAL_IMAGE_SIZE = 512;
const VERSIONED_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";
const UNVERSIONED_IMAGE_CACHE_CONTROL = "public, max-age=86400";
const SCRAPE_DROP_RATIO_WARNING = 0.2;
const SCRAPE_REMOVAL_COUNT_WARNING = 10;
const SCRAPE_MIN_COUNTS: Partial<Record<string, number>> = {
  "tennoji-zoo": 80,
};
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

function getActivePrefecture(url: URL): PrefectureCode | null {
  const pref = url.searchParams.get("pref");
  return pref && isPrefectureCode(pref) ? pref : null;
}

function getZooIdsForPrefecture(pref: PrefectureCode | null): string[] {
  return zoos
    .filter((zoo) => !pref || zoo.prefecture === pref)
    .map((zoo) => zoo.id);
}

function buildPlaceholders(values: unknown[]): string {
  return values.length > 0 ? values.map(() => "?").join(", ") : "NULL";
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

function normalizeAnimalNameForDiff(value: string): string {
  return normalizeAnimalNameForSearch(value).replace(/[\s　]+/g, "");
}

function normalizeAnimalImageKey(value: string): string {
  return normalizeAnimalNameForSearch(value).replace(/[\s　]+/g, "");
}

function uniqueDisplayNames(values: string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function buildScrapeDiffs(previousAnimals: string[], currentAnimals: string[]): ScrapeDiffRecord[] {
  const previousUnique = uniqueDisplayNames(previousAnimals);
  const currentUnique = uniqueDisplayNames(currentAnimals);
  const previousSet = new Set(previousUnique);
  const currentSet = new Set(currentUnique);
  const added = currentUnique
    .filter((name) => !previousSet.has(name))
    .map((name) => ({ name, normalized: normalizeAnimalNameForDiff(name), matched: false }));
  const removed = previousUnique
    .filter((name) => !currentSet.has(name))
    .map((name) => ({ name, normalized: normalizeAnimalNameForDiff(name), matched: false }));

  const removedByNormalized = new Map<string, number[]>();
  removed.forEach((entry, index) => {
    const indexes = removedByNormalized.get(entry.normalized) ?? [];
    indexes.push(index);
    removedByNormalized.set(entry.normalized, indexes);
  });

  const renamed: ScrapeDiffRecord[] = [];
  for (const entry of added) {
    const candidates = removedByNormalized.get(entry.normalized);
    const matchedRemovedIndex = candidates?.find((removedIndex) => !removed[removedIndex].matched);
    if (matchedRemovedIndex === undefined) continue;
    entry.matched = true;
    removed[matchedRemovedIndex].matched = true;
    renamed.push({
      type: "renamed",
      previousDisplayName: removed[matchedRemovedIndex].name,
      currentDisplayName: entry.name,
    });
  }

  const addedDiffs = added
    .filter((entry) => !entry.matched)
    .map<ScrapeDiffRecord>((entry) => ({
      type: "added",
      previousDisplayName: null,
      currentDisplayName: entry.name,
    }));
  const removedDiffs = removed
    .filter((entry) => !entry.matched)
    .map<ScrapeDiffRecord>((entry) => ({
      type: "removed",
      previousDisplayName: entry.name,
      currentDisplayName: null,
    }));

  return [...addedDiffs, ...removedDiffs, ...renamed];
}

function buildScrapeWarnings(
  zooId: string,
  result: ScrapeResult,
  previousAnimals: string[],
  diffs: ScrapeDiffRecord[]
): ScrapeWarningRecord[] {
  const previousCount = uniqueDisplayNames(previousAnimals).length;
  const currentCount = uniqueDisplayNames(result.animals).length;
  const warnings: ScrapeWarningRecord[] = [];

  if (result.error) {
    warnings.push({
      type: "scrape_error",
      message: `スクレイプエラー: ${result.error}`,
      previousCount,
      currentCount,
      thresholdCount: null,
    });
  }

  if (currentCount === 0) {
    warnings.push({
      type: "empty_result",
      message: "取得結果が 0 件です",
      previousCount,
      currentCount,
      thresholdCount: 1,
    });
  }

  const minimumCount = SCRAPE_MIN_COUNTS[zooId];
  if (minimumCount !== undefined && currentCount < minimumCount) {
    warnings.push({
      type: "below_minimum",
      message: `取得件数 ${currentCount} 件が期待最小 ${minimumCount} 件を下回っています`,
      previousCount,
      currentCount,
      thresholdCount: minimumCount,
    });
  }

  if (previousCount > 0) {
    const dropThreshold = Math.floor(previousCount * (1 - SCRAPE_DROP_RATIO_WARNING));
    if (currentCount < dropThreshold) {
      warnings.push({
        type: "sharp_drop",
        message: `前回 ${previousCount} 件から ${currentCount} 件へ大幅に減少しています`,
        previousCount,
        currentCount,
        thresholdCount: dropThreshold,
      });
    }
  }

  const removedCount = diffs.filter((diff) => diff.type === "removed").length;
  if (removedCount >= SCRAPE_REMOVAL_COUNT_WARNING) {
    warnings.push({
      type: "high_removal_count",
      message: `削除差分が ${removedCount} 件あります`,
      previousCount,
      currentCount,
      thresholdCount: SCRAPE_REMOVAL_COUNT_WARNING,
    });
  }

  return warnings;
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
    case "節足動物門":
      return "節足動物";
    default:
      return value;
  }
}

function normalizeOrderName(value: string | null): string | null {
  return value ? ORDER_NAME_ALIASES[value] ?? value : null;
}

function normalizeTaxonomyCandidate(candidate: TaxonomyCandidate): TaxonomyCandidate {
  const japaneseOnly = (value: string | null): string | null =>
    containsLatinLetters(value) ? null : value;
  return {
    ...candidate,
    canonicalName: japaneseOnly(candidate.canonicalName),
    className: japaneseOnly(normalizeClassName(candidate.className)),
    orderName: japaneseOnly(normalizeOrderName(candidate.orderName)),
    familyName: japaneseOnly(candidate.familyName),
    genusName: japaneseOnly(candidate.genusName),
    speciesName: japaneseOnly(candidate.speciesName),
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

function buildAnimalImagePrompt(displayName: string): string {
  return `正方形の動物アイコン画像を1枚生成してください。

対象の動物名: ${displayName}

要件:
- 512x512 の正方形。
- 背景は完全な白一色にする。グラデーション、影付きの背景、風景、小物、装飾は入れない。
- 動物の全身または顔と体の特徴がわかる構図。斜め向きや横向きなど、真正面を向いた構図は避ける。
- 図鑑風で、清潔感のある写実寄りのイラスト。
- 文字、ロゴ、透かし、枠、UI要素は入れない。
- 複数個体ではなく1個体を中心に描く。
- 動物園の公式写真や既存キャラクターを模倣しない。`;
}

function extractGeminiImage(response: unknown): { mimeType: string; data: string } {
  const data = response as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { mimeType?: unknown; data?: unknown };
          inline_data?: { mime_type?: unknown; data?: unknown };
        }>;
      };
    }>;
  };

  for (const candidate of data.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      const inlineData = part.inlineData;
      if (inlineData && typeof inlineData.data === "string") {
        return {
          mimeType: typeof inlineData.mimeType === "string" ? inlineData.mimeType : "image/png",
          data: inlineData.data,
        };
      }
      const inlineDataSnake = part.inline_data;
      if (inlineDataSnake && typeof inlineDataSnake.data === "string") {
        return {
          mimeType: typeof inlineDataSnake.mime_type === "string" ? inlineDataSnake.mime_type : "image/png",
          data: inlineDataSnake.data,
        };
      }
    }
  }

  throw new Error("Gemini response did not include an image");
}

async function generateAnimalImageWithGemini(
  apiKey: string,
  displayName: string,
  model = GEMINI_IMAGE_MODEL
): Promise<{ prompt: string; mimeType: string; imageBase64: string }> {
  const prompt = buildAnimalImagePrompt(displayName);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
        },
      }),
    }
  );

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini image API error ${response.status}: ${responseText.slice(0, 500)}`);
  }

  const image = extractGeminiImage(JSON.parse(responseText) as unknown);
  return {
    prompt,
    mimeType: image.mimeType,
    imageBase64: image.data,
  };
}

function base64ToUint8Array(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isVersionedImageRequest(url: URL): boolean {
  return Boolean(url.searchParams.get("v"));
}

function animalImageCacheControl(url: URL): string {
  return isVersionedImageRequest(url) ? VERSIONED_IMAGE_CACHE_CONTROL : UNVERSIONED_IMAGE_CACHE_CONTROL;
}

function buildAnimalImageResponse(
  body: BodyInit | null,
  headers: HeadersInit,
  url: URL
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Cache-Control", animalImageCacheControl(url));
  return new Response(body, { headers: responseHeaders });
}

async function cacheResponse(
  request: Request,
  response: Response,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method !== "GET" || response.status !== 200) return response;
  ctx.waitUntil(caches.default.put(request, response.clone()));
  return response;
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

function buildSearchResult(zoo: Zoo, animalCount = 0): ZooSearchResult {
  return {
    zoo,
    matchedAnimals: [],
    matchedFeatures: [],
    animalCount,
    animalSearchAvailable: false,
  };
}

async function loadZooAnimalCounts(db: D1Database, zooIds: string[]): Promise<Map<string, number>> {
  if (zooIds.length === 0) return new Map();

  const result = await db
    .prepare(
      `SELECT zoo_id, COUNT(DISTINCT display_name) AS animal_count
       FROM zoo_animals
       WHERE zoo_id IN (${buildPlaceholders(zooIds)})
       GROUP BY zoo_id`
    )
    .bind(...zooIds)
    .all<{ zoo_id: string; animal_count: number }>();

  return new Map((result.results ?? []).map((row) => [row.zoo_id, row.animal_count]));
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
           OR a.class_name LIKE ?
           OR a.order_name LIKE ?
           OR a.family_name LIKE ?
           OR a.genus_name LIKE ?
           OR a.species_name LIKE ?
         )
       ORDER BY za.zoo_id, za.display_name`
    )
    .bind(
      ...zooIds,
      `%${searchKeyword}%`,
      `%${searchKeyword}%`,
      `%${searchKeyword}%`,
      `%${searchKeyword}%`,
      `%${searchKeyword}%`,
      `%${searchKeyword}%`,
      `%${searchKeyword}%`
    )
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

async function loadZooCoverage(db: D1Database, zooId: string): Promise<ZooCoverageStats> {
  const row = await db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COUNT(CASE WHEN za.animal_id IS NOT NULL THEN 1 END) AS classified,
         COUNT(CASE WHEN za.animal_id IS NULL AND (
           NULLIF(c.canonical_name, 'null') IS NOT NULL OR
           NULLIF(c.class_name, 'null') IS NOT NULL OR
           NULLIF(c.order_name, 'null') IS NOT NULL OR
           NULLIF(c.family_name, 'null') IS NOT NULL OR
           NULLIF(c.genus_name, 'null') IS NOT NULL OR
           NULLIF(c.species_name, 'null') IS NOT NULL
         ) THEN 1 END) AS partial,
         COUNT(CASE WHEN za.animal_id IS NULL AND
           NULLIF(c.canonical_name, 'null') IS NULL AND
           NULLIF(c.class_name, 'null') IS NULL AND
           NULLIF(c.order_name, 'null') IS NULL AND
           NULLIF(c.family_name, 'null') IS NULL AND
           NULLIF(c.genus_name, 'null') IS NULL AND
           NULLIF(c.species_name, 'null') IS NULL
         THEN 1 END) AS unclassified
       FROM zoo_animals za
       LEFT JOIN animal_taxonomy_candidates c
         ON c.display_name = za.display_name
        AND za.animal_id IS NULL
        AND c.status IN ('partial', 'pending')
        AND c.confidence >= 0.8
       WHERE za.zoo_id = ?`
    )
    .bind(zooId)
    .first<{ total: number; classified: number; partial: number; unclassified: number }>();

  return {
    total: row?.total ?? 0,
    classified: row?.classified ?? 0,
    partial: row?.partial ?? 0,
    unclassified: row?.unclassified ?? 0,
  };
}

async function loadZooAnimalTaxonomyIndex(db: D1Database, zooId: string): Promise<Map<string, string>> {
  const result = await db
    .prepare(
      `SELECT
         za.display_name,
         COALESCE(a.class_name, NULLIF(c.class_name, 'null')) AS class_name
       FROM zoo_animals za
       LEFT JOIN animals a ON a.id = za.animal_id
       LEFT JOIN animal_taxonomy_candidates c
         ON c.display_name = za.display_name
        AND za.animal_id IS NULL
        AND c.status IN ('partial', 'pending')
        AND c.confidence >= 0.8
       WHERE za.zoo_id = ?`
    )
    .bind(zooId)
    .all<ZooAnimalTaxonomyRow>();

  return new Map(
    (result.results ?? [])
      .filter((row): row is { display_name: string; class_name: string } => Boolean(row.class_name))
      .map((row) => [row.display_name, row.class_name])
  );
}

async function loadScrapeHealth(db: D1Database): Promise<ScrapeHealthItem[]> {
  const zooIds = zoos.map((zoo) => zoo.id);
  const [scrapeRows, countRows, warningRows] = await Promise.all([
    db
      .prepare(
        `SELECT zoo_id, scraped_at, error
         FROM animal_scrape_results`
      )
      .all<{ zoo_id: string; scraped_at: string; error: string | null }>(),
    db
      .prepare(
        `SELECT zoo_id, COUNT(DISTINCT display_name) AS animal_count
         FROM zoo_animals
         GROUP BY zoo_id`
      )
      .all<{ zoo_id: string; animal_count: number }>(),
    db
      .prepare(
        `SELECT
           w.zoo_id,
           COUNT(*) AS warning_count,
           GROUP_CONCAT(w.message, '\n') AS warning_messages
         FROM animal_scrape_warnings w
         JOIN animal_scrape_results r
           ON r.zoo_id = w.zoo_id
          AND r.scraped_at = w.scraped_at
         WHERE w.zoo_id IN (${buildPlaceholders(zooIds)})
         GROUP BY w.zoo_id`
      )
      .bind(...zooIds)
      .all<{ zoo_id: string; warning_count: number; warning_messages: string | null }>(),
  ]);

  const scrapeByZoo = new Map((scrapeRows.results ?? []).map((row) => [row.zoo_id, row]));
  const countsByZoo = new Map((countRows.results ?? []).map((row) => [row.zoo_id, row.animal_count]));
  const warningsByZoo = new Map((warningRows.results ?? []).map((row) => [row.zoo_id, row]));

  return zoos.map((zoo) => {
    const scrape = scrapeByZoo.get(zoo.id);
    const warnings = warningsByZoo.get(zoo.id);
    return {
      zoo,
      scrapedAt: scrape?.scraped_at ?? null,
      error: scrape?.error ?? null,
      animalCount: countsByZoo.get(zoo.id) ?? 0,
      warningCount: warnings?.warning_count ?? 0,
      warningMessages: warnings?.warning_messages?.split("\n").filter(Boolean) ?? [],
    };
  });
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
      nameSortKey: row.name_sort_key ?? undefined,
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

async function loadAnimalList(
  db: D1Database,
  filter: AnimalListFilter = "all",
  pref: PrefectureCode | null = null
): Promise<AnimalListItem[]> {
  const conditions =
    filter === "unclassified"
      ? [`a.id IS NULL
           AND NULLIF(c.canonical_name, 'null') IS NULL
           AND NULLIF(c.class_name, 'null') IS NULL
           AND NULLIF(c.order_name, 'null') IS NULL
           AND NULLIF(c.family_name, 'null') IS NULL
           AND NULLIF(c.genus_name, 'null') IS NULL
           AND NULLIF(c.species_name, 'null') IS NULL`]
      : [];
  const zooIds = getZooIdsForPrefecture(pref);
  if (pref) {
    conditions.push(`za.zoo_id IN (${buildPlaceholders(zooIds)})`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await db
    .prepare(
      `SELECT
         za.display_name,
         za.zoo_id,
         za.animal_id,
         COALESCE(a.canonical_name, NULLIF(c.canonical_name, 'null')) AS canonical_name,
         COALESCE(a.sort_key, a.canonical_name, za.sort_key, za.display_name) AS name_sort_key,
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
       ORDER BY COALESCE(a.sort_key, a.normalized_name, za.sort_key, za.normalized_display_name), za.display_name, za.zoo_id`
    )
    .bind(...(pref ? zooIds : []))
    .all<AnimalListRow>();

  return buildAnimalListItems(result.results ?? []);
}

async function loadAnimalImageKeys(db: D1Database): Promise<AnimalImageVersionIndex> {
  const result = await db
    .prepare("SELECT animal_key, selected_generation_id FROM animal_images")
    .all<{ animal_key: string; selected_generation_id: number | null }>();
  return new Map((result.results ?? []).map((r) => [r.animal_key, r.selected_generation_id]));
}

async function loadAnimalImage(db: D1Database, displayName: string): Promise<AnimalImageRecord | null> {
  const animalKey = normalizeAnimalImageKey(displayName);
  const row = await db
    .prepare(
      `SELECT
         animal_key,
         display_name,
         normalized_name,
         prompt,
         model,
         mime_type,
         image_base64,
         selected_generation_id,
         width,
         height,
         created_at,
         updated_at
       FROM animal_images
       WHERE animal_key = ?`
    )
    .bind(animalKey)
    .first<{
      animal_key: string;
      display_name: string;
      normalized_name: string;
      prompt: string;
      model: string;
      mime_type: string;
      image_base64: string;
      selected_generation_id: number | null;
      width: number;
      height: number;
      created_at: string;
      updated_at: string;
    }>();

  return row
    ? {
        animalKey: row.animal_key,
        displayName: row.display_name,
        normalizedName: row.normalized_name,
        prompt: row.prompt,
        model: row.model,
        mimeType: row.mime_type,
        imageBase64: row.image_base64,
        selectedGenerationId: row.selected_generation_id ?? undefined,
        width: row.width,
        height: row.height,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    : null;
}

async function saveAnimalImage(
  db: D1Database,
  displayName: string,
  prompt: string,
  model: string,
  mimeType: string,
  imageBase64: string
): Promise<AnimalImageRecord> {
  const now = new Date().toISOString();
  const animalKey = normalizeAnimalImageKey(displayName);
  const normalizedName = normalizeAnimalNameForSearch(displayName);
  await db
    .prepare(
      `INSERT INTO animal_image_generations (
         animal_key,
         display_name,
         normalized_name,
         prompt,
         model,
         mime_type,
         image_base64,
         width,
         height,
         created_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      animalKey,
      displayName,
      normalizedName,
      prompt,
      model,
      mimeType,
      imageBase64,
      ANIMAL_IMAGE_SIZE,
      ANIMAL_IMAGE_SIZE,
      now
    )
    .run();
  const generation = await db
    .prepare(
      `SELECT id
       FROM animal_image_generations
       WHERE animal_key = ?
         AND created_at = ?
       ORDER BY id DESC
       LIMIT 1`
    )
    .bind(animalKey, now)
    .first<{ id: number }>();
  if (!generation) {
    throw new Error("Generated image was not saved");
  }

  await db
    .prepare(
      `INSERT INTO animal_images (
         animal_key,
         display_name,
         normalized_name,
         prompt,
         model,
         mime_type,
         image_base64,
         selected_generation_id,
         width,
         height,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(animal_key) DO UPDATE SET
         display_name = excluded.display_name,
         normalized_name = excluded.normalized_name,
         prompt = excluded.prompt,
         model = excluded.model,
         mime_type = excluded.mime_type,
         image_base64 = excluded.image_base64,
         selected_generation_id = excluded.selected_generation_id,
         width = excluded.width,
         height = excluded.height,
         updated_at = excluded.updated_at`
    )
    .bind(
      animalKey,
      displayName,
      normalizedName,
      prompt,
      model,
      mimeType,
      imageBase64,
      generation.id,
      ANIMAL_IMAGE_SIZE,
      ANIMAL_IMAGE_SIZE,
      now,
      now
    )
    .run();

  return {
    animalKey,
    displayName,
    normalizedName,
    selectedGenerationId: generation.id,
    prompt,
    model,
    mimeType,
    imageBase64,
    width: ANIMAL_IMAGE_SIZE,
    height: ANIMAL_IMAGE_SIZE,
    createdAt: now,
    updatedAt: now,
  };
}

async function loadAnimalImageGenerations(
  db: D1Database,
  displayName: string
): Promise<AnimalImageGenerationRecord[]> {
  const animalKey = normalizeAnimalImageKey(displayName);
  const active = await loadAnimalImage(db, displayName);
  const result = await db
    .prepare(
      `SELECT
         id,
         animal_key,
         display_name,
         normalized_name,
         prompt,
         model,
         mime_type,
         image_base64,
         width,
         height,
         created_at
       FROM animal_image_generations
       WHERE animal_key = ?
       ORDER BY id DESC`
    )
    .bind(animalKey)
    .all<{
      id: number;
      animal_key: string;
      display_name: string;
      normalized_name: string;
      prompt: string;
      model: string;
      mime_type: string;
      image_base64: string;
      width: number;
      height: number;
      created_at: string;
    }>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    animalKey: row.animal_key,
    displayName: row.display_name,
    normalizedName: row.normalized_name,
    prompt: row.prompt,
    model: row.model,
    mimeType: row.mime_type,
    imageBase64: row.image_base64,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
    selected: active?.selectedGenerationId === row.id,
  }));
}

async function loadAnimalImageGenerationById(
  db: D1Database,
  id: number
): Promise<AnimalImageGenerationRecord | null> {
  const row = await db
    .prepare(
      `SELECT
         id,
         animal_key,
         display_name,
         normalized_name,
         prompt,
         model,
         mime_type,
         image_base64,
         width,
         height,
         created_at
       FROM animal_image_generations
       WHERE id = ?`
    )
    .bind(id)
    .first<{
      id: number;
      animal_key: string;
      display_name: string;
      normalized_name: string;
      prompt: string;
      model: string;
      mime_type: string;
      image_base64: string;
      width: number;
      height: number;
      created_at: string;
    }>();

  return row
    ? {
        id: row.id,
        animalKey: row.animal_key,
        displayName: row.display_name,
        normalizedName: row.normalized_name,
        prompt: row.prompt,
        model: row.model,
        mimeType: row.mime_type,
        imageBase64: row.image_base64,
        width: row.width,
        height: row.height,
        createdAt: row.created_at,
        selected: false,
      }
    : null;
}

async function selectAnimalImageGeneration(
  db: D1Database,
  displayName: string,
  generationId: number
): Promise<AnimalImageRecord | null> {
  const animalKey = normalizeAnimalImageKey(displayName);
  const generation = await loadAnimalImageGenerationById(db, generationId);
  if (!generation || generation.animalKey !== animalKey) return null;

  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO animal_images (
         animal_key,
         display_name,
         normalized_name,
         prompt,
         model,
         mime_type,
         image_base64,
         selected_generation_id,
         width,
         height,
         created_at,
         updated_at
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(animal_key) DO UPDATE SET
         display_name = excluded.display_name,
         normalized_name = excluded.normalized_name,
         prompt = excluded.prompt,
         model = excluded.model,
         mime_type = excluded.mime_type,
         image_base64 = excluded.image_base64,
         selected_generation_id = excluded.selected_generation_id,
         width = excluded.width,
         height = excluded.height,
         updated_at = excluded.updated_at`
    )
    .bind(
      animalKey,
      generation.displayName,
      generation.normalizedName,
      generation.prompt,
      generation.model,
      generation.mimeType,
      generation.imageBase64,
      generation.id,
      generation.width,
      generation.height,
      now,
      now
    )
    .run();

  return loadAnimalImage(db, displayName);
}

async function loadAnimalImageGenerationNames(
  db: D1Database,
  limit: number,
  requestedNames: string[] = [],
  missingOnly = true,
  missingModel?: string,
  excludedNames: string[] = []
): Promise<string[]> {
  const sourceNames =
    requestedNames.length > 0
      ? requestedNames
      : ((
          await db
            .prepare(
              `SELECT name
               FROM (
                 SELECT canonical_name AS name
                 FROM animals
                 WHERE canonical_name IS NOT NULL
                 UNION
                 SELECT display_name AS name
                 FROM zoo_animals
               )
               ORDER BY name`
            )
            .all<{ name: string }>()
        ).results ?? []).map((row) => row.name);

  const uniqueNames: string[] = [];
  const seen = new Set<string>();
  const excludedKeys = new Set(excludedNames.map(normalizeAnimalImageKey));
  for (const name of sourceNames) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = normalizeAnimalImageKey(trimmed);
    if (seen.has(key)) continue;
    if (excludedKeys.has(key)) continue;
    seen.add(key);
    uniqueNames.push(trimmed);
  }

  if (!missingOnly) return uniqueNames.slice(0, limit);

  const existingRows = missingModel
    ? await db
        .prepare(
          `SELECT DISTINCT animal_key
           FROM animal_image_generations
           WHERE model = ?`
        )
        .bind(missingModel)
        .all<{ animal_key: string }>()
    : await db
        .prepare("SELECT animal_key FROM animal_images")
        .all<{ animal_key: string }>();
  const existingKeys = new Set((existingRows.results ?? []).map((row) => row.animal_key));
  return uniqueNames
    .filter((name) => !existingKeys.has(normalizeAnimalImageKey(name)))
    .slice(0, limit);
}

interface AnimalTaxonomyRow {
  display_name: string;
  animal_id: number | null;
  candidate_status: string | null;
  confidence: number | null;
  class_name: string | null;
  order_name: string | null;
  family_name: string | null;
  canonical_name: string | null;
}

async function loadAnimalsForTaxonomy(db: D1Database): Promise<AnimalTaxonomyRow[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT
         za.display_name,
         za.animal_id,
         c.status AS candidate_status,
         c.confidence,
         c.class_name,
         c.order_name,
         c.family_name,
         c.canonical_name
       FROM zoo_animals za
       LEFT JOIN animal_taxonomy_candidates c ON c.display_name = za.display_name
       ORDER BY za.display_name`
    )
    .all<AnimalTaxonomyRow>();
  return result.results ?? [];
}

async function loadAnimalImageManageItems(
  db: D1Database,
  query: string | null = null
): Promise<AnimalImageManageItem[]> {
  const result = await db
    .prepare(
      `SELECT name
       FROM (
         SELECT canonical_name AS name
         FROM animals
         WHERE canonical_name IS NOT NULL
         UNION
         SELECT display_name AS name
         FROM zoo_animals
       )
       ORDER BY name`
    )
    .all<{ name: string }>();
  const selectedRows = await db
    .prepare(
      `SELECT animal_key, selected_generation_id, updated_at
       FROM animal_images`
    )
    .all<{ animal_key: string; selected_generation_id: number | null; updated_at: string }>();
  const generationRows = await db
    .prepare(
      `SELECT id, animal_key, model, created_at
       FROM animal_image_generations
       ORDER BY animal_key, id DESC`
    )
    .all<{ id: number; animal_key: string; model: string; created_at: string }>();

  const selectedByKey = new Map(
    (selectedRows.results ?? []).map((row) => [
      row.animal_key,
      {
        selectedGenerationId: row.selected_generation_id,
        updatedAt: row.updated_at,
      },
    ])
  );
  const generationsByKey = new Map<string, AnimalImageGenerationSummary[]>();
  for (const row of generationRows.results ?? []) {
    const selected = selectedByKey.get(row.animal_key);
    const generations = generationsByKey.get(row.animal_key) ?? [];
    generations.push({
      id: row.id,
      animalKey: row.animal_key,
      model: row.model,
      createdAt: row.created_at,
      selected: selected?.selectedGenerationId === row.id,
    });
    generationsByKey.set(row.animal_key, generations);
  }
  const normalizedQuery = query ? normalizeAnimalNameForSearch(query) : null;
  const items: AnimalImageManageItem[] = [];
  const seen = new Set<string>();
  for (const row of result.results ?? []) {
    const displayName = row.name.trim();
    if (!displayName) continue;
    const animalKey = normalizeAnimalImageKey(displayName);
    if (seen.has(animalKey)) continue;
    if (normalizedQuery && !normalizeAnimalNameForSearch(displayName).includes(normalizedQuery)) continue;
    seen.add(animalKey);
    const selected = selectedByKey.get(animalKey);
    const generations = generationsByKey.get(animalKey) ?? [];
    items.push({
      displayName,
      animalKey,
      selectedGenerationId: selected?.selectedGenerationId ?? null,
      generationCount: generations.length,
      updatedAt: selected?.updatedAt ?? null,
      generations,
    });
  }

  return items;
}

async function loadZooAnimalDetail(
  db: D1Database,
  displayName: string,
  pref: PrefectureCode | null = null
): Promise<ZooAnimalDetail | null> {
  const zooIds = getZooIdsForPrefecture(pref);
  const zooFilter = pref
    ? `AND za.zoo_id IN (${buildPlaceholders(zooIds)})`
    : "";
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
       ${zooFilter}
       ORDER BY za.zoo_id`
    )
    .bind(displayName, ...(pref ? zooIds : []))
    .all<AnimalListRow>();

  const rows = result.results ?? [];
  if (rows.length === 0) return null;

  const zooById = new Map(zoos.map((zoo) => [zoo.id, zoo]));
  const taxonomicRow = rows.find((row) => row.animal_id) ?? rows[0];
  const candidateRow =
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
               species_name,
               status,
               confidence
             FROM animal_taxonomy_candidates
             WHERE display_name = ?
             ORDER BY
               /* Prioritize qualifying candidates (status='partial'/'pending' with high confidence)
                  so taxonomy data is used for display only when reliable */
               CASE WHEN status IN ('partial', 'pending') AND confidence >= 0.8 THEN 0 ELSE 1 END,
               updated_at DESC
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
            status: string;
            confidence: number;
          }>();
  const isQualifyingCandidate =
    candidateRow !== null &&
    (candidateRow.status === "partial" || candidateRow.status === "pending") &&
    candidateRow.confidence >= 0.8;
  const candidate = isQualifyingCandidate ? candidateRow : null;
  const classificationStatus: ClassificationStatus = taxonomicRow.animal_id
    ? "registered"
    : isQualifyingCandidate
      ? "llm_candidate"
      : candidateRow?.status === "rejected"
        ? "rejected"
        : "unclassified";
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
    classificationStatus,
  };
}

async function loadRelatedAnimals(
  db: D1Database,
  detail: ZooAnimalDetail,
  limit = 30
): Promise<AnimalListItem[]> {
  const filterField = detail.orderName ? "order_name" : detail.className ? "class_name" : null;
  const filterValue = detail.orderName ?? detail.className ?? null;
  if (!filterField || !filterValue) return [];

  const col =
    filterField === "order_name"
      ? "COALESCE(a.order_name, NULLIF(c.order_name, 'null'))"
      : "COALESCE(a.class_name, NULLIF(c.class_name, 'null'))";

  const result = await db
    .prepare(
      `SELECT
         za.display_name,
         za.zoo_id,
         za.animal_id,
         COALESCE(a.canonical_name, NULLIF(c.canonical_name, 'null')) AS canonical_name,
         COALESCE(a.sort_key, a.canonical_name, za.sort_key, za.display_name) AS name_sort_key,
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
       WHERE ${col} = ?
         AND za.display_name != ?
       ORDER BY COALESCE(a.sort_key, a.normalized_name, za.sort_key, za.normalized_display_name), za.display_name, za.zoo_id`
    )
    .bind(filterValue, detail.displayName)
    .all<AnimalListRow>();

  return buildAnimalListItems(result.results ?? []).slice(0, limit);
}

async function loadTaxonomyOverview(
  db: D1Database,
  pref: PrefectureCode | null = null
): Promise<TaxonomyOverviewSection[]> {
  const sections: TaxonomyOverviewSection[] = [];
  const zooIds = getZooIdsForPrefecture(pref);
  const where = pref
    ? `WHERE za.zoo_id IN (${buildPlaceholders(zooIds)})`
    : "";

  for (const rank of TAXONOMY_RANKS) {
    const result = await db
      .prepare(
        `SELECT
           a.${rank.column} AS name,
           COUNT(DISTINCT a.id) AS animal_count,
           COUNT(DISTINCT za.zoo_id) AS zoo_count
         FROM animals a
         JOIN zoo_animals za ON za.animal_id = a.id
         ${where}
         GROUP BY a.${rank.column}
         ORDER BY a.${rank.column}`
      )
      .bind(...(pref ? zooIds : []))
      .all<TaxonomyValueRow>();

    sections.push({ ...rank, values: result.results ?? [] });
  }

  return sections;
}

async function loadTaxonomyTree(
  db: D1Database,
  pref: PrefectureCode | null = null
): Promise<TaxonomyTreeNode[]> {
  const zooIds = getZooIdsForPrefecture(pref);
  const where = pref
    ? `WHERE za.zoo_id IN (${buildPlaceholders(zooIds)})`
    : "";
  const result = await db
    .prepare(
      `SELECT
         'class' AS rank_level,
         a.class_name,
         NULL AS order_name,
         NULL AS family_name,
         COUNT(DISTINCT a.id) AS animal_count,
         COUNT(DISTINCT za.zoo_id) AS zoo_count
       FROM animals a
       JOIN zoo_animals za ON za.animal_id = a.id
       ${where}
       GROUP BY a.class_name
       UNION ALL
       SELECT
         'order' AS rank_level,
         a.class_name,
         a.order_name,
         NULL AS family_name,
         COUNT(DISTINCT a.id) AS animal_count,
         COUNT(DISTINCT za.zoo_id) AS zoo_count
       FROM animals a
       JOIN zoo_animals za ON za.animal_id = a.id
       ${where}
       GROUP BY a.class_name, a.order_name
       UNION ALL
       SELECT
         'family' AS rank_level,
         a.class_name,
         a.order_name,
         a.family_name,
         COUNT(DISTINCT a.id) AS animal_count,
         COUNT(DISTINCT za.zoo_id) AS zoo_count
       FROM animals a
       JOIN zoo_animals za ON za.animal_id = a.id
       ${where}
       GROUP BY a.class_name, a.order_name, a.family_name
       ORDER BY class_name, order_name, family_name`
    )
    .bind(
      ...(pref ? zooIds : []),
      ...(pref ? zooIds : []),
      ...(pref ? zooIds : [])
    )
    .all<TaxonomyTreeRow>();

  const classes = new Map<string, TaxonomyTreeNode>();
  for (const row of result.results ?? []) {
    const classNode = classes.get(row.class_name) ?? {
      name: row.class_name,
      animalCount: 0,
      zooCount: 0,
      children: [],
    };
    if (row.rank_level === "class") {
      classNode.animalCount = row.animal_count;
      classNode.zooCount = row.zoo_count;
      classes.set(row.class_name, classNode);
      continue;
    }
    if (!row.order_name) continue;
    let orderNode = classNode.children.find((node) => node.name === row.order_name);
    if (!orderNode) {
      orderNode = {
        name: row.order_name,
        animalCount: 0,
        zooCount: 0,
        children: [],
      };
      classNode.children.push(orderNode);
    }
    if (row.rank_level === "order") {
      orderNode.animalCount = row.animal_count;
      orderNode.zooCount = row.zoo_count;
      classes.set(row.class_name, classNode);
      continue;
    }
    if (!row.family_name) continue;
    orderNode.children.push({
      name: row.family_name,
      animalCount: row.animal_count,
      zooCount: row.zoo_count,
      children: [],
    });
    classes.set(row.class_name, classNode);
  }

  return [...classes.values()];
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
  return levels
    .map((level) => `COALESCE(a.${level.rank.column}, NULLIF(c.${level.rank.column}, 'null')) = ?`)
    .join(" AND ");
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
  levels: TaxonomyPathLevel[],
  pref: PrefectureCode | null = null
): Promise<TaxonomyOverviewSection | null> {
  const current = levels.at(-1);
  if (!current) return null;
  const { rank } = current;
  const childRank = getNextTaxonomyRank(rank);
  if (!childRank) return null;
  const zooIds = getZooIdsForPrefecture(pref);
  const where = [
    buildTaxonomyWhereClause(levels),
    ...(pref ? [`za.zoo_id IN (${buildPlaceholders(zooIds)})`] : []),
  ].join(" AND ");

  const result = await db
    .prepare(
      `SELECT
         COALESCE(a.${childRank.column}, NULLIF(c.${childRank.column}, 'null')) AS name,
         COUNT(DISTINCT COALESCE(a.id, c.display_name)) AS animal_count,
         COUNT(DISTINCT za.zoo_id) AS zoo_count
       FROM zoo_animals za
       LEFT JOIN animals a ON a.id = za.animal_id
       LEFT JOIN animal_taxonomy_candidates c
         ON c.display_name = za.display_name
        AND za.animal_id IS NULL
        AND c.status IN ('partial', 'pending')
        AND c.confidence >= 0.8
       WHERE ${where}
         AND COALESCE(a.${childRank.column}, NULLIF(c.${childRank.column}, 'null')) IS NOT NULL
       GROUP BY COALESCE(a.${childRank.column}, NULLIF(c.${childRank.column}, 'null'))
       ORDER BY COALESCE(a.${childRank.column}, NULLIF(c.${childRank.column}, 'null'))`
    )
    .bind(...levels.map((level) => level.value), ...(pref ? zooIds : []))
    .all<TaxonomyValueRow>();

  return { ...childRank, values: result.results ?? [] };
}

async function loadTaxonomyAnimals(
  db: D1Database,
  levels: TaxonomyPathLevel[],
  pref: PrefectureCode | null = null
): Promise<AnimalListItem[]> {
  const zooIds = getZooIdsForPrefecture(pref);
  const where = [
    buildTaxonomyWhereClause(levels),
    ...(pref ? [`za.zoo_id IN (${buildPlaceholders(zooIds)})`] : []),
  ].join(" AND ");
  const result = await db
    .prepare(
      `SELECT
         za.display_name,
         za.zoo_id,
         za.animal_id,
         COALESCE(a.canonical_name, NULLIF(c.canonical_name, 'null')) AS canonical_name,
         COALESCE(a.sort_key, a.canonical_name, za.sort_key, za.display_name) AS name_sort_key,
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
       WHERE ${where}
       ORDER BY COALESCE(a.sort_key, a.normalized_name, za.sort_key, za.normalized_display_name), za.display_name, za.zoo_id`
    )
    .bind(...levels.map((level) => level.value), ...(pref ? zooIds : []))
    .all<AnimalListRow>();

  return buildAnimalListItems(result.results ?? []);
}

async function resolveLegacyTaxonomyPath(
  db: D1Database,
  rank: TaxonomyRankConfig,
  value: string,
  pref: PrefectureCode | null = null
): Promise<string[] | null> {
  const rankIndex = TAXONOMY_RANKS.findIndex((candidate) => candidate.key === rank.key);
  if (rankIndex < 0) return null;

  const pathRanks = TAXONOMY_RANKS.slice(0, rankIndex + 1);
  const zooIds = getZooIdsForPrefecture(pref);
  const prefFilter = pref ? `AND za.zoo_id IN (${buildPlaceholders(zooIds)})` : "";
  const result = await db
    .prepare(
      `SELECT DISTINCT
         ${pathRanks.map((item) => `a.${item.column} AS ${item.key}_name`).join(",\n         ")}
       FROM animals a
       JOIN zoo_animals za ON za.animal_id = a.id
       WHERE a.${rank.column} = ?
         ${prefFilter}
       ORDER BY ${pathRanks.map((item) => `${item.key}_name`).join(", ")}
       LIMIT 2`
    )
    .bind(value, ...(pref ? zooIds : []))
    .all<Record<string, string>>();

  const rows = result.results ?? [];
  if (rows.length !== 1) return null;

  return pathRanks.map((item) => rows[0][`${item.key}_name`]);
}

async function loadUnclassifiedDisplayNames(
  db: D1Database,
  limit: number,
  zooIds: string[] = []
): Promise<string[]> {
  const zooFilter =
    zooIds.length > 0
      ? `AND za.zoo_id IN (${zooIds.map(() => "?").join(", ")})`
      : "";
  const result = await db
    .prepare(
      `SELECT DISTINCT za.display_name
       FROM zoo_animals za
       LEFT JOIN animal_taxonomy_candidates c ON c.display_name = za.display_name
       WHERE za.animal_id IS NULL
         AND c.display_name IS NULL
         ${zooFilter}
       ORDER BY za.display_name
       LIMIT ?`
    )
    .bind(...zooIds, limit)
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

async function loadPendingTaxonomyCandidates(
  db: D1Database,
  limit: number,
  zooIds: string[] = []
): Promise<TaxonomyCandidate[]> {
  const zooFilter =
    zooIds.length > 0
      ? `AND za.zoo_id IN (${zooIds.map(() => "?").join(", ")})`
      : "";
  const result = await db
    .prepare(
      `SELECT DISTINCT
         c.display_name,
         c.canonical_name,
         c.class_name,
         c.order_name,
         c.family_name,
         c.genus_name,
         c.species_name,
         c.confidence,
         c.reason,
         c.sources_json
       FROM animal_taxonomy_candidates c
       JOIN zoo_animals za ON za.display_name = c.display_name
       WHERE za.animal_id IS NULL
         AND c.status = 'pending'
         ${zooFilter}
       ORDER BY c.display_name
       LIMIT ?`
    )
    .bind(...zooIds, limit)
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
    reason: row.reason ?? "",
    sources: parseSourcesJson(row.sources_json),
  }));
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
- 表示名が総称、品種、展示名、愛称、または種まで断定できない場合でも、確認できる上位分類は入れ、確認できない項目だけ null にする。
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

  const existingAnimal = await db
    .prepare(
      `SELECT id
       FROM animals
       WHERE canonical_name = ?
          OR (genus_name = ? AND species_name = ?)
       LIMIT 1`
    )
    .bind(canonicalName, genusName, speciesName)
    .first<{ id: string }>();
  const animalId = existingAnimal?.id ?? taxonomy.id;
  if (!existingAnimal) {
    await upsertAnimalMasters(db, [taxonomy]);
  }
  await db.batch([
    db
      .prepare(
        `UPDATE zoo_animals
         SET animal_id = ?
         WHERE display_name = ?`
      )
      .bind(animalId, normalized.displayName),
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
  const previousRows = await db
    .prepare(
      `SELECT display_name
       FROM zoo_animals
       WHERE zoo_id = ?
       ORDER BY display_name`
    )
    .bind(result.zooId)
    .all<{ display_name: string }>();
  const previousAnimals = (previousRows.results ?? []).map((row) => row.display_name);
  const diffs = buildScrapeDiffs(previousAnimals, result.animals);
  const warnings = buildScrapeWarnings(result.zooId, result, previousAnimals, diffs);
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
    ...diffs.map((diff) =>
      db
        .prepare(
          `INSERT INTO animal_scrape_diffs (
            zoo_id,
            scraped_at,
            diff_type,
            previous_display_name,
            current_display_name
          )
          VALUES (?, ?, ?, ?, ?)`
        )
        .bind(
          result.zooId,
          result.scrapedAt,
          diff.type,
          diff.previousDisplayName,
          diff.currentDisplayName
        )
    ),
    ...warnings.map((warning) =>
      db
        .prepare(
          `INSERT INTO animal_scrape_warnings (
            zoo_id,
            scraped_at,
            warning_type,
            message,
            previous_count,
            current_count,
            threshold_count
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          result.zooId,
          result.scrapedAt,
          warning.type,
          warning.message,
          warning.previousCount,
          warning.currentCount,
          warning.thresholdCount
        )
    ),
    db
      .prepare(
        `UPDATE zoo_animals
         SET animal_id = (
           SELECT a.id
           FROM animal_taxonomy_candidates c
           JOIN animals a
             ON a.canonical_name = c.canonical_name
             OR (
               a.genus_name = c.genus_name
               AND a.species_name = c.species_name
             )
           WHERE c.display_name = zoo_animals.display_name
             AND c.status = 'applied'
           LIMIT 1
         )
         WHERE zoo_id = ?
           AND animal_id IS NULL
           AND EXISTS (
             SELECT 1
             FROM animal_taxonomy_candidates c
             JOIN animals a
               ON a.canonical_name = c.canonical_name
               OR (
                 a.genus_name = c.genus_name
                 AND a.species_name = c.species_name
               )
             WHERE c.display_name = zoo_animals.display_name
               AND c.status = 'applied'
           )`
      )
      .bind(result.zooId),
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
  const animalCounts = await loadZooAnimalCounts(
    db,
    prefFiltered.map((zoo) => zoo.id)
  );

  if (!normalizedAnimal) {
    return prefFiltered.map((zoo) => buildSearchResult(zoo, animalCounts.get(zoo.id) ?? 0));
  }

  const searchKeyword = normalizedAnimal.toLocaleLowerCase("ja-JP");
  const animalMatches = await loadCachedAnimalMatches(
    db,
    prefFiltered.map((zoo) => zoo.id),
    searchKeyword
  );

  return prefFiltered.flatMap((zoo) => {
    const matchedAnimals = animalMatches.get(zoo.id) ?? [];
    const searchResult: ZooSearchResult = {
      zoo,
      matchedAnimals,
      matchedFeatures: [],
      animalCount: animalCounts.get(zoo.id) ?? 0,
      animalSearchAvailable: true,
    };

    if (matchedAnimals.length > 0) {
      return [searchResult];
    }

    return [];
  });
}

async function searchZoosByTaxonomyClass(
  db: D1Database,
  pref: PrefectureCode | null,
  className: string
): Promise<ZooSearchResult[]> {
  const prefFiltered = zoos.filter((zoo) => !pref || zoo.prefecture === pref);
  const zooIds = prefFiltered.map((z) => z.id);
  if (zooIds.length === 0) return [];

  const [animalCounts, result] = await Promise.all([
    loadZooAnimalCounts(db, zooIds),
    db
      .prepare(
        `SELECT za.zoo_id, za.display_name
         FROM zoo_animals za
         LEFT JOIN animals a ON a.id = za.animal_id
         LEFT JOIN animal_taxonomy_candidates c
           ON c.display_name = za.display_name
          AND za.animal_id IS NULL
          AND c.status IN ('partial', 'pending')
          AND c.confidence >= 0.8
         WHERE COALESCE(a.class_name, NULLIF(c.class_name, 'null')) = ?
           AND za.zoo_id IN (${buildPlaceholders(zooIds)})
         ORDER BY za.zoo_id, za.display_name`
      )
      .bind(className, ...zooIds)
      .all<{ zoo_id: string; display_name: string }>(),
  ]);

  const byZoo = new Map<string, string[]>();
  for (const row of result.results ?? []) {
    if (!byZoo.has(row.zoo_id)) byZoo.set(row.zoo_id, []);
    byZoo.get(row.zoo_id)!.push(row.display_name);
  }

  return prefFiltered
    .filter((zoo) => byZoo.has(zoo.id))
    .map((zoo) => ({
      zoo,
      matchedAnimals: byZoo.get(zoo.id) ?? [],
      matchedFeatures: [],
      animalCount: animalCounts.get(zoo.id) ?? 0,
      animalSearchAvailable: true,
    }));
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
  const animalMatches = renderMatchedValues("ヒットした動物・分類", result.matchedAnimals);

  if (!animalMatches) return "";

  return `<div class="match-box">${animalMatches}</div>`;
}

function renderZooCard(result: ZooSearchResult, includeMatchSummary: boolean): string {
  const zoo = result.zoo;
  const zooId = encodeURIComponent(zoo.id);
  const zooDomId = `zoo-${zoo.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const prefLabel = PREF_LABELS[zoo.prefecture];
  const wikiLink = zoo.wikipediaUrl
    ? `<a href="${escapeHtml(zoo.wikipediaUrl)}" target="_blank" rel="noopener noreferrer">Wikipedia</a>`
    : "";
  return `
    <tr id="${escapeHtml(zooDomId)}">
      <th scope="row" class="zoo-name">
        <a href="/zoos/${zooId}">${escapeHtml(zoo.name)}</a>
        <p class="kana">${escapeHtml(zoo.nameKana)}</p>
        <p class="zoo-name-links">
          <a href="${escapeHtml(zoo.website)}" target="_blank" rel="noopener noreferrer">公式サイト</a>
          ${wikiLink}
        </p>
      </th>
      <td data-label="都道府県">${prefLabel}</td>
      <td data-label="住所">${escapeHtml(zoo.address)}</td>
      <td data-label="動物種数">${result.animalCount > 0 ? `${result.animalCount} 種` : "未取得"}</td>
      <td data-label="基本情報">
        <ul class="meta-list">
          <li><b>開園時間:</b> ${escapeHtml(zoo.openingHours)}</li>
          <li><b>休園日:</b> ${escapeHtml(zoo.closedDays)}</li>
          <li><b>入園料:</b> ${escapeHtml(zoo.admission)}</li>
        </ul>
      </td>
      ${includeMatchSummary ? `<td data-label="検索ヒット">${renderMatchSummary(result)}</td>` : ""}
    </tr>`;
}

function buildBrowseUrl(pref: PrefectureCode | null, animal: string | null): string {
  const params = new URLSearchParams();
  if (pref) params.set("pref", pref);
  if (animal) params.set("animal", animal);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function buildMapUrl(pref: PrefectureCode | null, animal: string | null, taxClass?: string | null): string {
  const params = new URLSearchParams();
  if (pref) params.set("pref", pref);
  if (animal) params.set("animal", animal);
  if (taxClass) params.set("cls", taxClass);
  const query = params.toString();
  return query ? `/map?${query}` : "/map";
}

function renderExploreCards(activePref: PrefectureCode | null, facilityCount: number, totalAnimalCount: number): string {
  const prefLabel = activePref ? PREF_LABELS[activePref] : "近畿一円";
  const cards = [
    {
      href: buildMapUrl(activePref, null),
      label: "地図で探す",
      meta: `${prefLabel}の ${facilityCount} 施設`,
      body: "現在地や旅行先に近い動物園を地図から探せます。",
    },
    {
      href: activePref ? `/animals?pref=${activePref}` : "/animals",
      label: "動物から探す",
      meta: totalAnimalCount > 0 ? `登録表示名 ${totalAnimalCount} 件` : "動物一覧",
      body: "動物名、分類、見られる施設を一覧で確認できます。",
    },
    {
      href: activePref ? `/taxonomy?pref=${activePref}` : "/taxonomy",
      label: "分類から探す",
      meta: "類・目・科で探索",
      body: "哺乳類、鳥類、爬虫類など、分類ツリーから動物をたどれます。",
    },
    {
      href: "/compare",
      label: "動物園を比較",
      meta: "共通・固有の動物",
      body: "気になる施設を選んで、見られる動物の違いを比較できます。",
    },
  ];

  return `
  <section class="explore-section" aria-labelledby="explore-title">
    <div class="explore-heading">
      <h2 id="explore-title">探し方を選ぶ</h2>
      <p>${escapeHtml(prefLabel)}の動物園を、場所・動物・分類から探せます。</p>
    </div>
    <div class="explore-grid">
      ${cards
        .map(
          (card) => `
            <a class="explore-card" href="${card.href}">
              <span>${escapeHtml(card.label)}</span>
              <small>${escapeHtml(card.meta)}</small>
              <em>${escapeHtml(card.body)}</em>
            </a>`
        )
        .join("")}
    </div>
  </section>`;
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

function renderTaxonomyValueLink(value: string, pathValues: string[] | null): string {
  const label = escapeHtml(value);
  return pathValues
    ? `<a href="${buildTaxonomyPathUrl(pathValues)}">${label}</a>`
    : label;
}

function buildTaxonomyDisplayParts(values: Array<[string, string | undefined]>): Array<{
  label: string;
  value: string;
  pathValues: string[] | null;
}> {
  const parts: Array<{ label: string; value: string; pathValues: string[] | null }> = [];
  const pathValues: string[] = [];
  let canBuildPath = true;

  for (const [label, value] of values) {
    if (!value) {
      canBuildPath = false;
      continue;
    }
    const currentPath = canBuildPath ? [...pathValues, value] : null;
    parts.push({ label, value, pathValues: currentPath });
    if (canBuildPath) {
      pathValues.push(value);
    }
  }

  return parts;
}

function addPrefectureToInternalUrl(href: string, pref: PrefectureCode | null): string {
  if (!pref || !href.startsWith("/") || href.startsWith("//")) return href;
  const parsed = new URL(href, "https://kinki-zoo.invalid");
  if (!parsed.searchParams.has("pref")) {
    parsed.searchParams.set("pref", pref);
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function renderPrefectureSelector(url: URL, activePref: PrefectureCode | null): string {
  const hiddenInputs = [...url.searchParams.entries()]
    .filter(([name]) => name !== "pref")
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`
    )
    .join("");
  const options = [
    `<option value=""${activePref ? "" : " selected"}>近畿一円</option>`,
    ...PREF_CODES.map(
      (code) =>
        `<option value="${code}"${code === activePref ? " selected" : ""}>${escapeHtml(PREF_LABELS[code])}</option>`
    ),
  ].join("");

  return `<form class="pref-selector" action="${escapeHtml(url.pathname)}" method="get">
    ${hiddenInputs}
    <label for="prefecture-select">地域</label>
    <select id="prefecture-select" name="pref" onchange="this.form.submit()">${options}</select>
    <noscript><button type="submit">表示</button></noscript>
  </form>`;
}

function htmlResponse(html: string, url: URL, activePref: PrefectureCode | null): Response {
  let rewriter = new HTMLRewriter()
    .on(".site-header", {
      element(element) {
        element.append(renderPrefectureSelector(url, activePref), { html: true });
      },
    })
    .on("a[href]", {
      element(element) {
        const href = element.getAttribute("href");
        if (href) {
          element.setAttribute("href", addPrefectureToInternalUrl(href, activePref));
        }
      },
    });

  if (activePref) {
    rewriter = rewriter.on("form:not(.pref-selector)", {
      element(element) {
        element.prepend(
          `<input type="hidden" name="pref" value="${escapeHtml(activePref)}">`,
          { html: true }
        );
      },
    });
  }

  return rewriter.transform(
    new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } })
  );
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
    html { -webkit-text-size-adjust: 100%; }
    body { min-width: 0; overflow-wrap: anywhere; }
    img, svg { max-width: 100%; }
    button, input, select { font: inherit; }
    .site-header { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem 2rem; padding: 1rem 1.5rem; border-bottom: 1px solid #ddd; }
    .site-heading { flex: 1 1 320px; min-width: 0; }
    .site-header h1 { font-size: 1.5rem; }
    .site-header h1 a { color: inherit; text-decoration: none; }
    .site-header p { font-size: 0.9rem; color: #555; margin-top: 0.25rem; }
    .pref-selector { display: flex; align-items: center; gap: 0.5rem; }
    .pref-selector label { color: #555; font-size: 0.82rem; font-weight: bold; }
    .pref-selector select { min-width: 9rem; border: 1px solid #aaa; background: #fff; padding: 0.45rem 2rem 0.45rem 0.6rem; font: inherit; }
    .pref-selector button { border: 1px solid #1f5b45; background: #fff; color: #1f5b45; padding: 0.4rem 0.65rem; }
    .global-nav { display: flex; flex-wrap: wrap; gap: 1rem; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; }
    .global-nav a { color: #1f5b45; text-decoration: none; font-size: 0.9rem; }
    .global-nav a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .global-nav a[aria-current="page"] { font-weight: bold; text-decoration: underline; text-underline-offset: 0.2em; }
    .global-nav .nav-admin { margin-left: auto; color: #888; font-size: 0.82rem; }
    .page-nav { margin-bottom: 1rem; display: flex; gap: 1rem; flex-wrap: wrap; }
    .page-nav a { color: #2d6a4f; text-decoration: none; }
    @media (max-width: 640px) {
      .site-header { display: grid; gap: 0.75rem; padding: 0.75rem; }
      .site-heading { width: 100%; }
      .site-header h1 { font-size: 1.2rem; line-height: 1.35; }
      .site-header p { font-size: 0.78rem; line-height: 1.45; }
      .pref-selector { width: 100%; }
      .pref-selector label { flex: 0 0 auto; }
      .pref-selector select { flex: 1 1 auto; min-width: 0; min-height: 44px; }
      .pref-selector button { min-height: 44px; }
      .global-nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0; padding: 0; }
      .global-nav a { display: flex; min-width: 0; min-height: 44px; align-items: center; justify-content: center; padding: 0.55rem 0.35rem; border-right: 1px solid #eee; border-bottom: 1px solid #eee; text-align: center; font-size: 0.82rem; }
      .global-nav a:nth-child(2n) { border-right: 0; }
      .page-nav { gap: 0.5rem; }
      .page-nav a { display: inline-flex; align-items: center; min-height: 44px; }
    }`;

function renderSiteHeader(): string {
  return `  <header class="site-header">
    <div class="site-heading">
      <h1><a href="/">近畿動物園情報</a></h1>
      <p>近畿一円の動物園・動物施設をまとめて調べられます</p>
    </div>
  </header>`;
}

function renderGlobalNav(activePath: string): string {
  const navItems: [string, string][] = [
    ["/", "動物園一覧"],
    ["/animals", "動物一覧"],
    ["/taxonomy", "分類から探す"],
    ["/map", "地図で見る"],
    ["/compare", "動物園を比較"],
    ["/admin", "動物管理"],
  ];
  const links = navItems
    .map(([href, label], i) => {
      const isActive = href === "/" ? activePath === "/" : activePath === href || activePath.startsWith(`${href}/`);
      const cls = i === navItems.length - 1 ? ' class="nav-admin"' : "";
      return `<a href="${href}"${cls}${isActive ? ' aria-current="page"' : ""}>${label}</a>`;
    })
    .join("\n    ");
  return `  <nav class="global-nav" aria-label="サイトナビゲーション">
    ${links}
  </nav>`;
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("ja-JP") : "-";
}

function buildAnimalImageManageUrl(displayName: string): string {
  return `/admin/animal-images/manage/${encodeURIComponent(displayName)}`;
}

function buildAnimalImageItemId(animalKey: string): string {
  return `animal-image-${encodeURIComponent(animalKey).replace(/%/g, "")}`;
}

function buildAnimalImageUrl(displayName: string, version?: number | null): string {
  const url = `/animal-images/${encodeURIComponent(displayName)}`;
  return version ? `${url}?v=${encodeURIComponent(String(version))}` : url;
}

const ADMIN_BREADCRUMB_CSS = `
    .admin-breadcrumb { display: flex; align-items: center; flex-wrap: wrap; gap: 0.2rem; font-size: 0.8rem; color: #aaa; }
    .admin-breadcrumb a { color: #1f5b45; text-decoration: none; }
    .admin-breadcrumb a:hover { text-decoration: underline; }
    .admin-breadcrumb .sep { margin: 0 0.15rem; }
    .admin-breadcrumb [aria-current] { color: #555; }`;

function renderAdminBreadcrumb(crumbs: { href?: string; label: string }[]): string {
  const all = [{ href: "/admin" as string | undefined, label: "動物管理" }, ...crumbs];
  const parts = all.map((c, i) => {
    const isLast = i === all.length - 1;
    const el = isLast
      ? `<span aria-current="page">${escapeHtml(c.label)}</span>`
      : `<a href="${c.href}">${escapeHtml(c.label)}</a>`;
    return i < all.length - 1 ? `${el}<span class="sep">/</span>` : el;
  });
  return `<nav class="admin-breadcrumb" aria-label="管理パンくず">${parts.join("")}</nav>`;
}

function renderAdminTopHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>動物管理 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1.25rem 1.5rem 2rem; display: grid; gap: 1rem; }
    h1 { font-size: 1.2rem; }
    .admin-nav { display: grid; gap: 0.65rem; list-style: none; }
    .admin-nav a { display: block; border: 1px solid #dce7df; background: #f8fbf9; color: #1f5b45; padding: 0.85rem 1rem; text-decoration: none; font-size: 0.95rem; }
    .admin-nav a:hover { background: #f1f8f3; border-color: #9bc4ab; }
    .admin-nav small { display: block; color: #666; font-size: 0.78rem; margin-top: 0.2rem; }${ADMIN_BREADCRUMB_CSS}
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/admin")}
  <main>
    ${renderAdminBreadcrumb([])}
    <h1>動物管理</h1>
    <ul class="admin-nav">
      <li>
        <a href="/admin/animal-taxonomy">
          分類管理
          <small>未分類・部分分類の動物を LLM で分類する</small>
        </a>
      </li>
      <li>
        <a href="/admin/animal-images">
          画像管理
          <small>動物画像の生成・選択を管理する</small>
        </a>
      </li>
      <li>
        <a href="/admin/scrape-health">
          スクレイプ監視
          <small>取得件数の急減・エラー・期待件数割れを確認する</small>
        </a>
      </li>
    </ul>
  </main>
</body>
</html>`;
}

function renderScrapeHealthAdminHtml(items: ScrapeHealthItem[]): string {
  const rows = items
    .map((item) => {
      const statusClass = item.error ? "error" : item.warningCount > 0 ? "warning" : "ok";
      const statusLabel = item.error ? "エラー" : item.warningCount > 0 ? "警告" : "正常";
      const warnings = item.warningMessages.length > 0
        ? `<ul>${item.warningMessages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>`
        : "-";
      const refreshed = item.scrapedAt ? formatDateTime(item.scrapedAt) : "-";
      return `
        <tr class="${statusClass}">
          <th scope="row"><a href="/zoos/${encodeURIComponent(item.zoo.id)}">${escapeHtml(item.zoo.name)}</a></th>
          <td><span class="status">${statusLabel}</span></td>
          <td>${item.animalCount}</td>
          <td>${refreshed}</td>
          <td>${item.error ? escapeHtml(item.error) : warnings}</td>
          <td><a href="/api/zoos/${encodeURIComponent(item.zoo.id)}/animals?refresh=1">再取得</a></td>
        </tr>`;
    })
    .join("");
  const warningCount = items.filter((item) => item.error || item.warningCount > 0).length;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>スクレイプ監視 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1120px; margin: 0 auto; padding: 1.25rem 1.5rem 2rem; display: grid; gap: 1rem; }
    h1 { font-size: 1.2rem; }
    .summary { color: #555; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { border-bottom: 1px solid #e5e5e5; padding: 0.65rem 0.5rem; text-align: left; vertical-align: top; }
    thead th { color: #666; font-size: 0.78rem; background: #f7faf8; }
    tbody th { font-weight: normal; }
    tbody tr.warning { background: #fff9e8; }
    tbody tr.error { background: #fff0f0; }
    .status { display: inline-block; min-width: 3.4rem; border-radius: 999px; padding: 0.16rem 0.5rem; text-align: center; font-size: 0.78rem; background: #edf7ef; color: #1f5b45; }
    tr.warning .status { background: #fff1bf; color: #765000; }
    tr.error .status { background: #ffd6d6; color: #8a1f1f; }
    td ul { padding-left: 1.1rem; }
    td a, th a { color: #1f5b45; }
    @media (max-width: 720px) {
      main { padding: 1rem 0.75rem; }
      table { font-size: 0.8rem; }
      th, td { padding: 0.5rem 0.35rem; }
    }${ADMIN_BREADCRUMB_CSS}
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/admin")}
  <main>
    ${renderAdminBreadcrumb([{ label: "スクレイプ監視" }])}
    <h1>スクレイプ監視</h1>
    <p class="summary">警告あり: ${warningCount} / ${items.length} 施設</p>
    <table>
      <thead>
        <tr>
          <th scope="col">施設</th>
          <th scope="col">状態</th>
          <th scope="col">件数</th>
          <th scope="col">最終取得</th>
          <th scope="col">警告・エラー</th>
          <th scope="col">操作</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>`;
}

function renderAnimalTaxonomyAdminHtml(animals: AnimalTaxonomyRow[], notice?: string): string {
  const noticeHtml = notice ? `<p class="notice">${escapeHtml(notice)}</p>` : "";
  const statusLabel: Record<string, string> = {
    pending: "候補あり",
    partial: "部分分類",
    applied: "適用済み",
    rejected: "却下",
  };

  const countApplied = animals.filter((a) => a.animal_id !== null).length;
  const countPartial = animals.filter((a) => a.animal_id === null && a.candidate_status !== null).length;
  const countNone = animals.filter((a) => a.animal_id === null && a.candidate_status === null).length;

  const rows = animals.map((a) => {
    const group = a.animal_id !== null ? "applied" : a.candidate_status !== null ? "partial" : "none";
    const statusText = a.candidate_status ? (statusLabel[a.candidate_status] ?? a.candidate_status) : "未取得";
    const taxonomyText = [a.class_name, a.order_name, a.family_name].filter(Boolean).join(" / ") || "—";
    const classifyBtn = group === "applied"
      ? `<button class="classify-btn classify-btn--rerun" data-name="${escapeHtml(a.display_name)}">再分類</button>`
      : `<button class="classify-btn" data-name="${escapeHtml(a.display_name)}">分類</button>`;
    return `<tr data-group="${group}">
      <td class="name-cell"><a href="/animal/${encodeURIComponent(a.display_name)}">${escapeHtml(a.display_name)}</a>${a.canonical_name && a.canonical_name !== a.display_name ? `<br><small>${escapeHtml(a.canonical_name)}</small>` : ""}</td>
      <td><span class="status-badge status-${escapeHtml(a.candidate_status ?? "none")}">${statusText}</span></td>
      <td class="taxonomy-cell">${escapeHtml(taxonomyText)}</td>
      <td>${a.confidence != null ? `${Math.round(a.confidence * 100)}%` : "—"}</td>
      <td>${classifyBtn}</td>
    </tr>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>分類管理 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1rem 1.5rem 2rem; display: grid; gap: 1rem; }
    h1 { font-size: 1.15rem; }
${ADMIN_BREADCRUMB_CSS}
    .notice { border: 1px solid #cfe5d8; background: #f5fbf7; color: #244d37; padding: 0.6rem 0.75rem; font-size: 0.86rem; }
    .filter-tabs { display: flex; gap: 0; border-bottom: 2px solid #ddd; }
    .filter-tab { border: none; border-bottom: 2px solid transparent; background: none; padding: 0.5rem 1rem; font-size: 0.84rem; cursor: pointer; color: #555; margin-bottom: -2px; white-space: nowrap; }
    .filter-tab:hover { color: #1f5b45; }
    .filter-tab.active { border-bottom-color: #1f5b45; color: #1f5b45; font-weight: bold; }
    .filter-tab .count { font-size: 0.75rem; color: #888; margin-left: 0.3rem; }
    .filter-tab.active .count { color: #1f5b45; }
    .bulk-classify { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; padding: 0.65rem 0.75rem; background: #f8fbf9; border: 1px solid #dce7df; }
    .bulk-classify-btn { min-height: 34px; border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.3rem 0.8rem; cursor: pointer; font-size: 0.82rem; }
    .bulk-classify-btn:disabled { border-color: #aaa; background: #aaa; cursor: default; }
    .bulk-status { font-size: 0.82rem; color: #555; }
    .visible-count { font-size: 0.82rem; color: #888; }
    .animal-table { width: 100%; border-collapse: collapse; }
    .animal-table th, .animal-table td { border: none; border-bottom: 1px solid #e8e8e8; padding: 0.5rem 0.65rem; text-align: left; font-size: 0.84rem; vertical-align: middle; }
    .animal-table thead th { background: #f7f7f7; color: #555; border-bottom: 2px solid #ddd; font-size: 0.8rem; }
    .animal-table tbody tr:hover { background: #f5fbf8; }
    .animal-table tr.classifying { opacity: 0.5; }
    .animal-table tr.done td { background: #f0fbf4; }
    .name-cell a { color: #1f5b45; text-decoration: none; font-weight: bold; }
    .name-cell a:hover { text-decoration: underline; }
    .name-cell small { color: #888; }
    .taxonomy-cell { color: #555; font-size: 0.78rem; }
    .status-badge { display: inline-block; font-size: 0.72rem; padding: 0.15rem 0.45rem; border-radius: 2px; white-space: nowrap; }
    .status-pending { background: #fef9e7; border: 1px solid #f0d98a; color: #7a5c00; }
    .status-partial { background: #fff3e0; border: 1px solid #f0c878; color: #7a4a00; }
    .status-applied { background: #e8f5ee; border: 1px solid #b6ddc8; color: #1f5b45; }
    .status-rejected { background: #fef0ec; border: 1px solid #f0c0b0; color: #8b3a20; }
    .status-none { background: #f7f7f7; border: 1px solid #e1e1e1; color: #888; }
    .classify-btn { border: 1px solid #1f5b45; background: #fff; color: #1f5b45; padding: 0.25rem 0.65rem; font-size: 0.78rem; cursor: pointer; white-space: nowrap; }
    .classify-btn--rerun { border-color: #aaa; color: #999; }
    .classify-btn--rerun:hover:not(:disabled) { border-color: #1f5b45; color: #1f5b45; }
    .classify-btn:disabled { border-color: #ccc; color: #ccc; cursor: default; }
    .classify-btn.done { border-color: #aaa; color: #aaa; }
    @media (max-width: 640px) {
      main { padding: 0.75rem; }
      .filter-tab { padding: 0.4rem 0.6rem; font-size: 0.8rem; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/admin")}
  <main>
    ${renderAdminBreadcrumb([{ href: "/admin/animal-taxonomy", label: "分類管理" }])}
    <h1>分類管理</h1>
    ${noticeHtml}
    <div class="filter-tabs" role="tablist">
      <button class="filter-tab active" data-filter="all" role="tab">全て<span class="count">${animals.length}</span></button>
      <button class="filter-tab" data-filter="applied" role="tab">分類済<span class="count">${countApplied}</span></button>
      <button class="filter-tab" data-filter="partial" role="tab">一部分類<span class="count">${countPartial}</span></button>
      <button class="filter-tab" data-filter="none" role="tab">未分類<span class="count">${countNone}</span></button>
    </div>
    <div class="bulk-classify">
      <button id="bulk-classify-btn" class="bulk-classify-btn">表示中をまとめて分類</button>
      <span id="bulk-status" class="bulk-status"></span>
      <span id="visible-count" class="visible-count"></span>
    </div>
    <table class="animal-table">
      <thead>
        <tr>
          <th>動物名</th>
          <th>ステータス</th>
          <th>分類</th>
          <th>確度</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="taxonomy-tbody">
        ${rows}
      </tbody>
    </table>
  </main>
  <script>
    var currentFilter = 'all';

    function applyFilter(filter) {
      currentFilter = filter;
      var rows = document.querySelectorAll('#taxonomy-tbody tr');
      var visible = 0;
      rows.forEach(function(row) {
        var show = filter === 'all' || row.dataset.group === filter;
        row.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      document.querySelectorAll('.filter-tab').forEach(function(tab) {
        tab.classList.toggle('active', tab.dataset.filter === filter);
      });
      document.getElementById('visible-count').textContent = filter === 'all' ? '' : visible + ' 件表示中';
    }

    document.querySelectorAll('.filter-tab').forEach(function(tab) {
      tab.addEventListener('click', function() { applyFilter(tab.dataset.filter); });
    });

    async function classifyAnimal(name, btn) {
      btn.disabled = true;
      btn.textContent = '分類中…';
      var row = btn.closest('tr');
      row.classList.add('classifying');
      try {
        var res = await fetch('/animal/' + encodeURIComponent(name) + '/classify', {method: 'POST'});
        var finalUrl = new URL(res.url);
        var status = finalUrl.searchParams.get('llm') || 'done';
        row.classList.remove('classifying');
        row.classList.add('done');
        btn.textContent = status;
        btn.classList.add('done');
      } catch(e) {
        row.classList.remove('classifying');
        btn.disabled = false;
        btn.textContent = 'エラー';
      }
    }

    document.querySelectorAll('.classify-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { classifyAnimal(btn.dataset.name, btn); });
    });

    var bulkBtn = document.getElementById('bulk-classify-btn');
    var bulkStatus = document.getElementById('bulk-status');
    if (bulkBtn) {
      bulkBtn.addEventListener('click', async function() {
        var pending = Array.from(document.querySelectorAll('#taxonomy-tbody tr:not([style*="display: none"]) .classify-btn:not(.done):not([disabled])'));
        if (!pending.length) { bulkStatus.textContent = '対象なし'; return; }
        bulkBtn.disabled = true;
        bulkStatus.textContent = '0 / ' + pending.length + ' 件';
        var done = 0;
        for (var btn of pending) {
          await classifyAnimal(btn.dataset.name, btn);
          done++;
          bulkStatus.textContent = done + ' / ' + pending.length + ' 件完了';
        }
        bulkBtn.disabled = false;
      });
    }
  </script>
</body>
</html>`;
}

function renderAnimalImageManageListHtml(
  items: AnimalImageManageItem[],
  query: string | null,
  notice?: string
): string {
  const escapedQuery = query ? escapeHtml(query) : "";
  const modelOptions = GEMINI_IMAGE_MODELS.map(
    (model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`
  ).join("");
  const rows = items
    .map((item) => {
      const selected = item.selectedGenerationId
        ? `<span class="status selected">選択済み #${item.selectedGenerationId}</span>`
        : `<span class="status empty">未選択</span>`;
      const preview = item.selectedGenerationId
        ? `<img src="/animal-images/${encodeURIComponent(item.displayName)}?v=${item.selectedGenerationId}" alt="${escapeHtml(item.displayName)}">`
        : `<div class="image-placeholder">No image</div>`;
      const generations = item.generations
        .map((generation) => {
          const selectedBadge = generation.selected ? `<span class="selected-badge">使用中</span>` : "";
          const selectButton = generation.selected
            ? `<button type="submit" disabled>使用中</button>`
            : `<button type="submit">使う</button>`;
          return `
            <article class="generation-thumb">
              <div class="thumb-image">
                <img src="/admin/animal-image-generations/${generation.id}" alt="${escapeHtml(item.displayName)} #${generation.id}">
                ${selectedBadge}
              </div>
              <div class="thumb-meta">
                <b>#${generation.id}</b>
                <span>${escapeHtml(generation.model)}</span>
                <span>${escapeHtml(formatDateTime(generation.createdAt))}</span>
              </div>
              <form action="/admin/animal-images/select" method="post">
                <input type="hidden" name="displayName" value="${escapeHtml(item.displayName)}">
                <input type="hidden" name="generationId" value="${generation.id}">
                ${selectButton}
              </form>
            </article>`;
        })
        .join("");
      return `
        <article class="image-list-item" id="${escapeHtml(buildAnimalImageItemId(item.animalKey))}">
          <div class="preview">${preview}</div>
          <div class="image-list-body">
            <div class="image-list-heading">
              <h2>${escapeHtml(item.displayName)}</h2>
              <form class="inline-generate-form" action="/admin/animal-images/generate" method="post">
                <input type="hidden" name="displayName" value="${escapeHtml(item.displayName)}">
                <input type="hidden" name="model" class="model-field">
                <input type="hidden" name="customModel" class="custom-model-field">
                <button type="submit">生成</button>
              </form>
            </div>
            <dl>
              <div><dt>状態</dt><dd>${selected}</dd></div>
              <div><dt>生成数</dt><dd>${item.generationCount}</dd></div>
              <div><dt>最終更新</dt><dd>${escapeHtml(formatDateTime(item.updatedAt))}</dd></div>
            </dl>
            <div class="generation-strip">
              ${generations || `<p class="empty-generations">まだ画像がありません。</p>`}
            </div>
          </div>
        </article>`;
    })
    .join("");
  const emptyHtml = `<p class="empty-message">対象の動物名がありません。</p>`;
  const noticeHtml = notice ? `<p class="notice">${escapeHtml(notice)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>動物管理 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1rem 1.5rem 1.5rem; display: grid; gap: 1rem; }
    .page-title { font-size: 1.15rem; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding-bottom: 0.75rem; border-bottom: 1px solid #ddd; }
    .toolbar input { min-height: 42px; flex: 1 1 220px; max-width: 360px; border: 1px solid #bbb; padding: 0.5rem 0.65rem; }
    .toolbar button, .toolbar a { min-height: 42px; display: inline-flex; align-items: center; border: 1px solid #1f5b45; padding: 0.45rem 0.7rem; font-size: 0.86rem; }
    .toolbar button { background: #1f5b45; color: #fff; cursor: pointer; }
    .toolbar a { color: #1f5b45; text-decoration: none; background: #fff; }
    .model-toolbar { display: grid; grid-template-columns: minmax(220px, 320px) minmax(220px, 1fr); gap: 0.75rem; align-items: end; padding: 0.75rem; background: #f7faf8; border: 1px solid #dce7df; }
    .model-field-group { display: grid; gap: 0.35rem; }
    .model-field-group label { color: #555; font-size: 0.82rem; font-weight: bold; }
    .model-field-group select, .model-field-group input { min-height: 42px; border: 1px solid #bbb; background: #fff; padding: 0.5rem 0.65rem; }
    .notice { border: 1px solid #cfe5d8; background: #f5fbf7; color: #244d37; padding: 0.6rem 0.75rem; font-size: 0.86rem; }
    .summary { color: #666; font-size: 0.86rem; }
    .image-list { display: grid; gap: 0.75rem; }
    .image-list-item { display: grid; grid-template-columns: 108px minmax(0, 1fr); gap: 0.9rem; align-items: start; border-bottom: 1px solid #e2e2e2; padding: 0.9rem 0; scroll-margin-top: 1rem; }
    .preview { display: block; width: 108px; aspect-ratio: 1; border: 1px solid #ddd; background: #f7f7f7; text-decoration: none; overflow: hidden; }
    .preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .image-placeholder { width: 100%; height: 100%; display: grid; place-items: center; color: #888; font-size: 0.72rem; }
    .image-list-body { min-width: 0; display: grid; gap: 0.45rem; }
    .image-list-heading { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: space-between; align-items: center; }
    .image-list-body h2 { font-size: 1rem; line-height: 1.35; }
    .image-list-body dl { display: flex; flex-wrap: wrap; gap: 0.45rem 1rem; color: #555; font-size: 0.82rem; }
    .image-list-body dl div { display: flex; gap: 0.25rem; }
    .image-list-body dt { color: #777; }
    .status { display: inline-flex; align-items: center; min-height: 1.5rem; padding: 0.1rem 0.45rem; border-radius: 2px; font-size: 0.78rem; }
    .status.selected { background: #e8f5ee; border: 1px solid #b6ddc8; color: #1f5b45; }
    .status.empty { background: #f7f7f7; border: 1px solid #e1e1e1; color: #777; }
    .inline-generate-form button { min-height: 38px; border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.4rem 0.75rem; cursor: pointer; font-size: 0.84rem; }
    .generation-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.65rem; margin-top: 0.35rem; }
    .generation-thumb { display: grid; gap: 0.35rem; min-width: 0; }
    .thumb-image { position: relative; aspect-ratio: 1; border: 1px solid #ddd; background: #f7f7f7; overflow: hidden; }
    .thumb-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .selected-badge { position: absolute; top: 0.3rem; left: 0.3rem; background: #1f5b45; color: #fff; font-size: 0.68rem; padding: 0.12rem 0.35rem; }
    .thumb-meta { display: grid; gap: 0.12rem; color: #555; font-size: 0.72rem; line-height: 1.35; }
    .thumb-meta span { overflow-wrap: anywhere; }
    .generation-thumb button { width: 100%; min-height: 36px; border: 1px solid #1f5b45; background: #fff; color: #1f5b45; cursor: pointer; font-size: 0.8rem; }
    .generation-thumb button:disabled { border-color: #ccc; color: #777; background: #f7f7f7; cursor: default; }
    .empty-generations { color: #777; font-size: 0.82rem; }
    .empty-message { color: #777; padding: 1rem 0; }${ADMIN_BREADCRUMB_CSS}
    @media (max-width: 640px) {
      main { padding: 0.85rem 0.75rem 1.25rem; }
      .toolbar { display: grid; grid-template-columns: 1fr auto; }
      .toolbar input { max-width: none; min-width: 0; grid-column: 1 / -1; }
      .model-toolbar { grid-template-columns: 1fr; padding: 0.65rem; }
      .image-list-item { grid-template-columns: 72px minmax(0, 1fr); align-items: start; }
      .preview { width: 72px; }
      .image-list-heading { display: grid; gap: 0.45rem; }
      .inline-generate-form button { min-height: 44px; }
      .image-list-body dl { display: grid; gap: 0.3rem; }
      .generation-strip { grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/admin")}
  <main>
    ${renderAdminBreadcrumb([{ href: "/admin/animal-images", label: "画像管理" }])}
    <h1 class="page-title">画像管理</h1>
    ${noticeHtml}
    <section class="model-toolbar" aria-label="画像生成モデル">
      <div class="model-field-group">
        <label for="shared-image-model">生成モデル</label>
        <select id="shared-image-model">${modelOptions}</select>
      </div>
      <div class="model-field-group">
        <label for="shared-custom-model">任意のモデル名</label>
        <input id="shared-custom-model" placeholder="例: gemini-2.5-flash-image">
      </div>
    </section>
    <form class="toolbar" action="/admin/animal-images" method="get">
      <input type="search" name="q" value="${escapedQuery}" placeholder="動物名で検索" aria-label="動物名で検索">
      <button type="submit">検索</button>
      ${query ? `<a href="/admin/animal-images">クリア</a>` : ""}
    </form>
    <p class="summary">${items.length} 件</p>
    <section class="image-list">
      ${rows || emptyHtml}
    </section>
  </main>
  <script>
    var modelSelect = document.getElementById('shared-image-model');
    var customModel = document.getElementById('shared-custom-model');
    document.querySelectorAll('.inline-generate-form').forEach(function(form) {
      form.addEventListener('submit', function() {
        var modelField = form.querySelector('.model-field');
        var customModelField = form.querySelector('.custom-model-field');
        if (modelField && modelSelect) modelField.value = modelSelect.value;
        if (customModelField && customModel) customModelField.value = customModel.value;
      });
    });
  </script>
</body>
</html>`;
}

function renderAnimalImageManageDetailHtml(
  displayName: string,
  activeImage: AnimalImageRecord | null,
  generations: AnimalImageGenerationRecord[],
  notice?: string
): string {
  const escapedName = escapeHtml(displayName);
  const modelOptions = GEMINI_IMAGE_MODELS.map(
    (model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`
  ).join("");
  const activePreview = activeImage
    ? `<img src="/animal-images/${encodeURIComponent(displayName)}?v=${activeImage.selectedGenerationId}" alt="${escapedName}">`
    : `<div class="image-placeholder">No image</div>`;
  const gallery = generations
    .map((generation) => {
      const selectedBadge = generation.selected ? `<span class="selected-badge">使用中</span>` : "";
      const selectButton = generation.selected
        ? `<button type="submit" disabled>使用中</button>`
        : `<button type="submit">この画像を使う</button>`;
      return `
        <article class="generation-card">
          <div class="generation-image">
            <img src="/admin/animal-image-generations/${generation.id}" alt="${escapedName} #${generation.id}">
            ${selectedBadge}
          </div>
          <div class="generation-meta">
            <h3>#${generation.id}</h3>
            <p>${escapeHtml(generation.model)}</p>
            <p>${escapeHtml(formatDateTime(generation.createdAt))}</p>
          </div>
          <form action="${buildAnimalImageManageUrl(displayName)}/select" method="post">
            <input type="hidden" name="generationId" value="${generation.id}">
            ${selectButton}
          </form>
        </article>`;
    })
    .join("");
  const noticeHtml = notice ? `<p class="notice">${escapeHtml(notice)}</p>` : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedName} 画像管理 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1rem 1.5rem 1.5rem; display: grid; gap: 1rem; }
${ADMIN_BREADCRUMB_CSS}
    .page-title { font-size: 1.2rem; line-height: 1.35; }
    .notice { border: 1px solid #cfe5d8; background: #f5fbf7; color: #244d37; padding: 0.6rem 0.75rem; font-size: 0.86rem; }
    .detail-layout { display: grid; grid-template-columns: minmax(220px, 320px) minmax(0, 1fr); gap: 1.2rem; align-items: start; }
    .active-panel, .generate-panel { border-top: 1px solid #ddd; padding-top: 1rem; }
    .active-panel h2, .generate-panel h2, .gallery-section h2 { font-size: 1rem; margin-bottom: 0.75rem; }
    .active-image { width: 100%; aspect-ratio: 1; border: 1px solid #ddd; background: #f7f7f7; overflow: hidden; }
    .active-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .image-placeholder { width: 100%; height: 100%; display: grid; place-items: center; color: #888; font-size: 0.82rem; }
    .generate-form { display: grid; gap: 0.75rem; max-width: 520px; }
    .field { display: grid; gap: 0.35rem; }
    .field label { color: #555; font-size: 0.82rem; font-weight: bold; }
    .field select, .field input { min-height: 42px; border: 1px solid #bbb; padding: 0.5rem 0.65rem; }
    .generate-form button { justify-self: start; border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.55rem 0.85rem; cursor: pointer; }
    .hint { color: #666; font-size: 0.82rem; line-height: 1.5; }
    .gallery-section { border-top: 1px solid #ddd; padding-top: 1rem; }
    .generation-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.9rem; }
    .generation-card { display: grid; gap: 0.55rem; min-width: 0; }
    .generation-image { position: relative; aspect-ratio: 1; border: 1px solid #ddd; background: #f7f7f7; overflow: hidden; }
    .generation-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .selected-badge { position: absolute; top: 0.45rem; left: 0.45rem; background: #1f5b45; color: #fff; font-size: 0.76rem; padding: 0.18rem 0.45rem; }
    .generation-meta { display: grid; gap: 0.2rem; font-size: 0.8rem; color: #555; }
    .generation-meta h3 { font-size: 0.9rem; color: #222; }
    .generation-card button { width: 100%; min-height: 40px; border: 1px solid #1f5b45; background: #fff; color: #1f5b45; cursor: pointer; }
    .generation-card button:disabled { border-color: #ccc; color: #777; background: #f7f7f7; cursor: default; }
    .empty-message { color: #777; padding: 0.75rem 0; }
    @media (max-width: 720px) {
      main { padding: 0.85rem 0.75rem 1.25rem; }
      .detail-layout { grid-template-columns: 1fr; }
      .active-image { max-width: 320px; }
      .generate-form button { width: 100%; min-height: 44px; }
      .generation-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/admin")}
  <main>
    ${renderAdminBreadcrumb([{ href: "/admin/animal-images", label: "画像管理" }, { label: displayName }])}
    <h1 class="page-title">${escapedName}</h1>
    ${noticeHtml}
    <div class="detail-layout">
      <section class="active-panel">
        <h2>使用中の画像</h2>
        <div class="active-image">${activePreview}</div>
      </section>
      <section class="generate-panel">
        <h2>Geminiで生成</h2>
        <form class="generate-form" action="${buildAnimalImageManageUrl(displayName)}/generate" method="post">
          <div class="field">
            <label for="model">モデル</label>
            <select id="model" name="model">${modelOptions}</select>
          </div>
          <div class="field">
            <label for="custom-model">任意のモデル名</label>
            <input id="custom-model" name="customModel" placeholder="例: gemini-2.5-flash-image">
          </div>
          <p class="hint">任意のモデル名を入力すると、上の選択より優先します。生成した画像は履歴に残り、新しい画像が使用中になります。</p>
          <button type="submit">画像生成</button>
        </form>
      </section>
    </div>
    <section class="gallery-section">
      <h2>生成履歴</h2>
      <div class="generation-grid">
        ${gallery || `<p class="empty-message">まだ画像がありません。</p>`}
      </div>
    </section>
  </main>
</body>
</html>`;
}

function renderHtml(
  results: ZooSearchResult[],
  activePref: PrefectureCode | null,
  animal: string | null
): string {
  const includeMatchSummary = Boolean(animal);
  const rows = results.map((result) => renderZooCard(result, includeMatchSummary)).join("\n");
  const escapedAnimal = animal ? escapeHtml(animal) : "";

  const count = results.length;
  const matchCount = results.reduce((sum, result) => sum + result.matchedAnimals.length, 0);
  const totalAnimalCount = results.reduce((sum, result) => sum + result.animalCount, 0);
  const prefLabel = activePref && isPrefectureCode(activePref) ? PREF_LABELS[activePref] : "近畿一円";
  const summary = animal
    ? `${prefLabel} で「${escapedAnimal}」を探せる動物園・施設: ${count} 件 / 検索ヒット: ${matchCount} 件`
    : `${prefLabel} の動物園・施設: ${count} 件`;
  const emptyMessage = animal
    ? `「${escapedAnimal}」に該当する施設が見つかりませんでした。`
    : "該当する施設が見つかりませんでした。";
  let zooListHtml = `<p class="empty">${emptyMessage}</p>`;
  if (count > 0) {
    zooListHtml = `<div class="zoo-list"><table class="zoo-table">
    <thead>
      <tr>
        <th scope="col">施設名</th>
        <th scope="col">都道府県</th>
        <th scope="col">住所</th>
        <th scope="col">動物種数</th>
        <th scope="col">基本情報</th>
        ${includeMatchSummary ? `<th scope="col">検索ヒット</th>` : ""}
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table></div>`;
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    .search-form { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; }
    .search-form input { flex: 1 1 220px; max-width: 320px; padding: 0.55rem 0.75rem; border: 1px solid #bbb; font-size: 0.95rem; }
    .search-form button, .search-form a { font-size: 0.875rem; }
    .search-form button { border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.5rem 0.9rem; cursor: pointer; }
    .search-form a { padding: 0.5rem 0.7rem; color: #1f5b45; text-decoration: none; border: 1px solid #1f5b45; }
    .explore-section { padding: 1rem 1.5rem; border-bottom: 1px solid #ddd; display: grid; gap: 0.85rem; }
    .explore-heading { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; align-items: baseline; justify-content: space-between; }
    .explore-heading h2 { font-size: 1.08rem; }
    .explore-heading p { color: #666; font-size: 0.86rem; }
    .explore-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.7rem; }
    .explore-card { display: grid; gap: 0.24rem; min-height: 7rem; align-content: start; border: 1px solid #dce7df; background: #f8fbf9; color: #1f5b45; padding: 0.85rem; text-decoration: none; }
    .explore-card:hover { background: #f1f8f3; border-color: #9bc4ab; }
    .explore-card span { font-weight: bold; font-size: 0.98rem; }
    .explore-card small { color: #617469; font-size: 0.76rem; }
    .explore-card em { color: #3f4f45; font-size: 0.8rem; line-height: 1.45; font-style: normal; }
    .summary { padding: 0.75rem 1.5rem; font-size: 0.9rem; color: #666; }
    .zoo-list { padding: 1rem 1.5rem; overflow-x: auto; }
    .zoo-table { width: 100%; border-collapse: collapse; min-width: 960px; border: 1px solid #ddd; }
    .zoo-table th, .zoo-table td { border: 1px solid #ddd; padding: 0.65rem; vertical-align: top; font-size: 0.86rem; text-align: left; }
    .zoo-table thead th { background: #f7f7f7; color: #555; }
    .zoo-name a { color: #2d6a4f; text-decoration: none; font-size: 1rem; }
    .zoo-name a:hover { text-decoration: underline; }
    .zoo-name-links { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.45rem; font-size: 0.8rem; }
    .zoo-name-links a { font-size: 0.8rem; font-weight: normal; }
    .kana { font-size: 0.8rem; color: #888; margin-top: 0.25rem; }
    .meta-list { list-style: none; display: grid; gap: 0.25rem; }
    .meta-list li { color: #444; }
    .match-box { padding: 0.55rem; border: 1px solid #d7eadc; border-radius: 6px; background: #f3fbf5; display: grid; gap: 0.45rem; }
    .match-row { display: grid; gap: 0.35rem; }
    .match-label { color: #456052; font-size: 0.75rem; font-weight: bold; }
    .match-values { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .match-chip { background: #fff; color: #1b5e3b; border: 1px solid #b7dcc3; border-radius: 999px; padding: 0.18rem 0.55rem; font-size: 0.75rem; font-weight: bold; }
    .match-more { color: #5d7166; font-size: 0.75rem; align-self: center; }
    .match-note { color: #6d756f; font-size: 0.75rem; line-height: 1.5; }
    .empty { padding: 2rem 1.5rem; color: #888; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
    @media (max-width: 700px) {
      .search-form { display: grid; grid-template-columns: 1fr auto; padding: 0.75rem; }
      .search-form input { width: 100%; max-width: none; min-width: 0; min-height: 44px; grid-column: 1 / -1; }
      .search-form button, .search-form a { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; }
      .explore-section { padding: 0.75rem; }
      .explore-heading { display: grid; gap: 0.25rem; }
      .explore-grid { grid-template-columns: 1fr; gap: 0.5rem; }
      .explore-card { min-height: 0; }
      .summary { padding: 0.7rem 0.75rem; line-height: 1.5; }
      .zoo-list { padding: 0.75rem; overflow: visible; }
      .zoo-table { min-width: 0; border: 0; }
      .zoo-table thead { display: none; }
      .zoo-table tbody, .zoo-table tr, .zoo-table th, .zoo-table td { display: block; width: 100%; }
      .zoo-table tr { margin-bottom: 0.75rem; border: 1px solid #d8ddd9; }
      .zoo-table th, .zoo-table td { border: 0; border-bottom: 1px solid #e5e8e6; padding: 0.7rem 0.75rem; }
      .zoo-table td:empty { display: none; }
      .zoo-table tr > :last-child { border-bottom: 0; }
      .zoo-table td::before { content: attr(data-label); display: block; margin-bottom: 0.35rem; color: #6a746d; font-size: 0.7rem; font-weight: bold; }
      .zoo-name { background: #f7faf8; }
      .empty { padding: 1.5rem 0.75rem; }
      footer { padding: 1rem 0.75rem; line-height: 1.5; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/")}
  <form class="search-form" action="/" method="get">
    <input type="search" name="animal" value="${escapedAnimal}" placeholder="動物名で検索（例: パンダ）" aria-label="動物名で検索">
    <button type="submit">検索</button>
    ${animal ? `<a href="${buildBrowseUrl(activePref, null)}">クリア</a>` : ""}
  </form>
  ${animal ? "" : renderExploreCards(activePref, count, totalAnimalCount)}
  <p class="summary">${summary}</p>
  ${zooListHtml}
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
</body>
</html>`;
}

function buildAnimalsUrl(filter: AnimalListFilter): string {
  return filter === "unclassified" ? "/animals?filter=unclassified" : "/animals";
}

function renderAnimalsHtml(
  animals: AnimalListItem[],
  filter: AnimalListFilter,
  activePref: PrefectureCode | null,
  imageKeys: AnimalImageVersionIndex = new Map()
): string {
  const items = renderAnimalCards(animals, imageKeys);
  const prefLabel = activePref ? PREF_LABELS[activePref] : "近畿一円";
  const summary =
    filter === "unclassified"
      ? `${prefLabel}の分類未設定: ${animals.length} 件`
      : `${prefLabel}の登録動物: ${animals.length} 件`;

  const emptyMessage =
    animals.length === 0
      ? filter === "unclassified"
        ? `<p class="empty">分類未設定の動物はありません。</p>`
        : `<p class="empty">動物データがまだありません。各動物園の動物一覧を取得するか、全件更新を実行してください。</p>`
      : "";
  let animalListHtml = emptyMessage;
  if (animals.length > 0) {
    animalListHtml = `<div class="animal-list"><table class="animal-table" id="animal-table">
    <thead>
      <tr>
        <th scope="col"><button data-col="name" data-dir="asc">動物名</button></th>
        <th scope="col"><button data-col="class">分類</button></th>
        <th scope="col"><button data-col="count">施設数</button></th>
        <th scope="col">施設一覧</th>
      </tr>
    </thead>
    <tbody>
      ${items}
    </tbody>
  </table></div>`;
  }

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
    .animal-list { padding: 1rem 1.5rem; overflow-x: auto; }
    .animal-table { width: 100%; min-width: 860px; border-collapse: collapse; }
    .animal-table th, .animal-table td { border: none; border-bottom: 1px solid #e8e8e8; padding: 0.45rem 0.65rem; vertical-align: top; text-align: left; font-size: 0.84rem; }
    .animal-table thead th { background: #f7f7f7; color: #555; padding: 0.5rem 0.65rem; border-bottom: 2px solid #ddd; }
    .animal-table tbody tr:hover { background: #f5fbf8; }
    .animal-table thead th button { background: none; border: none; cursor: pointer; font: inherit; color: inherit; width: 100%; text-align: left; padding: 0; display: flex; align-items: center; gap: 0.3em; white-space: nowrap; }
    .animal-table thead th button::after { content: "⇅"; color: #ccc; font-size: 0.8em; }
    .animal-table thead th button[data-dir="asc"]::after { content: "▲"; color: #444; }
    .animal-table thead th button[data-dir="desc"]::after { content: "▼"; color: #444; }
    .animal-name { display: flex; align-items: center; gap: 0.55rem; }
    .animal-thumb { width: 36px; height: 36px; object-fit: cover; flex-shrink: 0; border-radius: 2px; background: #f0f0f0; }
    .animal-name a { color: #1f5b45; text-decoration: none; font-size: 0.95rem; }
    .animal-name a:hover { text-decoration: underline; }
    .taxonomy { color: #444; line-height: 1.5; }
    .taxonomy a { color: #1f5b45; text-decoration: none; }
    .taxonomy a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .unclassified { color: #777; }
    .facility-count { color: #666; font-size: 0.85rem; }
    .zoo-links { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .zoo-links a { color: #2d6a4f; border: 1px solid #d3e4d8; background: #f7fbf8; padding: 0.2rem 0.45rem; font-size: 0.78rem; text-decoration: none; }
    .zoo-links a:hover { text-decoration: underline; }
    .empty { padding: 2rem 1.5rem; color: #888; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
    @media (max-width: 700px) {
      .tabs { padding: 0.65rem 0.75rem; }
      .tab { display: inline-flex; min-height: 44px; align-items: center; }
      .summary { padding: 0.7rem 0.75rem; line-height: 1.5; }
      .animal-list { padding: 0.75rem; overflow: visible; }
      .animal-table { min-width: 0; border: 0; }
      .animal-table thead { display: none; }
      .animal-table tbody, .animal-table tr, .animal-table th, .animal-table td { display: block; width: 100%; }
      .animal-table tr { margin-bottom: 0.75rem; border: 1px solid #d8ddd9; }
      .animal-table th, .animal-table td { border: 0; border-bottom: 1px solid #e5e8e6; padding: 0.7rem 0.75rem; }
      .animal-table tr > :last-child { border-bottom: 0; }
      .animal-table td::before { content: attr(data-label); display: block; margin-bottom: 0.35rem; color: #6a746d; font-size: 0.7rem; font-weight: bold; }
      .animal-name { background: #f7faf8; }
      .empty { padding: 1.5rem 0.75rem; }
      footer { padding: 1rem 0.75rem; line-height: 1.5; }
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
  ${animalListHtml}
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
<script>
(function () {
  const table = document.getElementById('animal-table');
  if (!table) return;
  const tbody = table.querySelector('tbody');
  const buttons = table.querySelectorAll('thead th button[data-col]');

  function sortTable(col, dir) {
    const rows = [...tbody.querySelectorAll('tr')];
    rows.sort((a, b) => {
      const av = a.dataset[col] ?? '';
      const bv = b.dataset[col] ?? '';
      if (col === 'count') return (Number(av) - Number(bv)) * dir;
      return av.localeCompare(bv, 'ja') * dir;
    });
    rows.forEach(r => tbody.appendChild(r));
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.dataset.col;
      const prev = btn.dataset.dir;
      const dir = prev === 'asc' ? -1 : 1;
      buttons.forEach(b => delete b.dataset.dir);
      btn.dataset.dir = dir === 1 ? 'asc' : 'desc';
      sortTable(col, dir);
    });
  });
})();
</script>
</body>
</html>`;
}

function renderAnimalCards(animals: AnimalListItem[], imageKeys: AnimalImageVersionIndex = new Map()): string {
  return animals
    .map((item) => {
      const zooLinks = item.zoos
        .map((zoo) => `<a href="/zoos/${encodeURIComponent(zoo.id)}">${escapeHtml(zoo.name)}</a>`)
        .join("");
      const primaryDisplayName = item.displayNames[0] ?? item.canonicalName ?? "";
      const searchName = item.canonicalName ?? primaryDisplayName;
      const title = item.canonicalName
        ? escapeHtml(item.canonicalName)
        : escapeHtml(primaryDisplayName);
      const titleHref = primaryDisplayName ? buildZooAnimalUrl(primaryDisplayName) : buildAnimalSearchUrl(searchName);
      const imageDisplayName = item.displayNames.find((n) => imageKeys.has(normalizeAnimalImageKey(n)));
      const imageVersion = imageDisplayName ? imageKeys.get(normalizeAnimalImageKey(imageDisplayName)) : null;
      const thumbHtml = imageDisplayName
        ? `<img src="${buildAnimalImageUrl(imageDisplayName, imageVersion)}" alt="" class="animal-thumb" loading="lazy" width="36" height="36">`
        : "";
      const taxonomyDetails = buildTaxonomyDisplayParts([
        ["類", item.className],
        ["目", item.orderName],
        ["科", item.familyName],
        ["属", item.genusName],
        ["種", item.speciesName],
      ])
        .map(({ label, value, pathValues }) =>
          renderTaxonomyValueLink(value, pathValues)
        )
        .join(" / ");
      const taxonomyRow = taxonomyDetails
        ? `<p class="taxonomy">${taxonomyDetails}</p>`
        : `<p class="unclassified">分類未設定</p>`;
      const sortName = escapeHtml(item.nameSortKey ?? item.canonicalName ?? primaryDisplayName);
      const sortClass = escapeHtml(
        [item.className, item.orderName, item.familyName].filter(Boolean).join("|") || "\u{FFFF}"
      );
      const sortZoo = escapeHtml(item.zoos[0]?.name ?? "\u{FFFF}");
      return `
        <tr data-name="${sortName}" data-class="${sortClass}" data-count="${item.zoos.length}" data-zoo="${sortZoo}">
          <th scope="row" class="animal-name">${thumbHtml}<a href="${escapeHtml(titleHref)}">${title}</a></th>
          <td data-label="分類">${taxonomyRow}</td>
          <td data-label="施設数"><span class="facility-count">${item.zoos.length}</span></td>
          <td data-label="施設一覧"><div class="zoo-links">${zooLinks}</div></td>
        </tr>`;
    })
    .join("\n");
}

function renderZooAnimalDetailHtml(
  detail: ZooAnimalDetail,
  notice?: string,
  image?: AnimalImageRecord,
  relatedAnimals: AnimalListItem[] = [],
  imageKeys: AnimalImageVersionIndex = new Map()
): string {
  const escapedDisplayName = escapeHtml(detail.displayName);
  const title = detail.canonicalName && detail.canonicalName !== detail.displayName
    ? `${escapeHtml(detail.canonicalName)} | ${escapedDisplayName}`
    : escapedDisplayName;
  const taxonomyDetails = buildTaxonomyDisplayParts([
    ["類", detail.className],
    ["目", detail.orderName],
    ["科", detail.familyName],
    ["属", detail.genusName],
    ["種", detail.speciesName],
  ])
    .map(
      ({ label, value, pathValues }) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${renderTaxonomyValueLink(value, pathValues)}</dd>
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
  const noticeHtml = notice
    ? `<p class="notice">${escapeHtml(notice)}</p>`
    : "";
  const zooLinks = detail.zoos
    .map(
      (zoo) => `
        <li>
          <a href="/zoos/${zoo.id}">${escapeHtml(zoo.name)}</a>
          <span>${escapeHtml(PREF_LABELS[zoo.prefecture])}</span>
        </li>`
    )
    .join("");

  const imageHtml = image
    ? `<img src="${buildAnimalImageUrl(detail.displayName, image.selectedGenerationId)}" alt="${escapedDisplayName}" class="animal-image" width="240" height="240">`
    : "";

  const relatedLabel = detail.orderName
    ? `同じ目の動物（${escapeHtml(detail.orderName)}）`
    : detail.className
      ? `同じ類の動物（${escapeHtml(detail.className)}）`
      : "";

  const relatedCards = relatedAnimals.map((item) => {
    const name = item.displayNames[0] ?? item.canonicalName ?? "";
    const displayKey = item.displayNames.find((n) => imageKeys.has(normalizeAnimalImageKey(n)));
    const imageVersion = displayKey ? imageKeys.get(normalizeAnimalImageKey(displayKey)) : null;
    const thumb = displayKey
      ? `<img src="${buildAnimalImageUrl(displayKey, imageVersion)}" alt="" class="related-thumb" loading="lazy" width="72" height="72">`
      : `<div class="related-thumb related-thumb--empty"></div>`;
    const label = item.canonicalName ?? name;
    return `<a href="/animal/${encodeURIComponent(name)}" class="related-card">${thumb}<span class="related-name">${escapeHtml(label)}</span></a>`;
  }).join("");

  const relatedSection = relatedAnimals.length > 0 ? `
    <section>
      <h2>${relatedLabel}</h2>
      <div class="related-grid">${relatedCards}</div>
    </section>` : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { display: grid; gap: 0; max-width: 880px; }
    .hero { display: grid; grid-template-columns: ${image ? "200px 1fr" : "1fr"}; gap: 1.5rem; align-items: start; padding: 1.25rem 1.5rem; }
    .animal-image { display: block; width: 200px; height: 200px; object-fit: contain; background: #f7f7f7; border: 1px solid #e1e1e1; flex-shrink: 0; }
    .hero-info { display: grid; gap: 0.75rem; }
    .hero-name { font-size: 1.5rem; font-weight: bold; overflow-wrap: anywhere; line-height: 1.3; }
    .canonical { color: #777; font-size: 0.88rem; }
    .notice { border: 1px solid #cfe5d8; background: #f5fbf7; color: #244d37; padding: 0.6rem 0.75rem; font-size: 0.86rem; }
    .taxonomy-details { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border: 1px solid #e1e1e1; }
    .taxonomy-details div { min-width: 0; border-right: 1px solid #e1e1e1; }
    .taxonomy-details div:last-child { border-right: 0; }
    .taxonomy-details dt { background: #f6f8f7; color: #666; font-size: 0.72rem; padding: 0.32rem 0.4rem; border-bottom: 1px solid #e1e1e1; }
    .taxonomy-details dd { color: #222; font-size: 0.86rem; padding: 0.45rem 0.4rem; min-height: 2.35rem; overflow-wrap: anywhere; }
    .taxonomy-details dd a { color: #1f5b45; text-decoration: none; }
    .taxonomy-details dd a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .unclassified { color: #777; background: #f7f7f7; border: 1px solid #e1e1e1; padding: 0.55rem 0.65rem; font-size: 0.85rem; }
    section { border-top: 1px solid #ddd; padding: 1rem 1.5rem; }
    h2 { font-size: 1rem; margin-bottom: 0.75rem; color: #444; }
    .zoo-list { display: grid; gap: 0.45rem; list-style: none; }
    .zoo-list li { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: baseline; border: 1px solid #e1e1e1; padding: 0.65rem 0.75rem; }
    .zoo-list a { color: #1f5b45; font-weight: bold; text-decoration: none; }
    .zoo-list a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .zoo-list span { color: #777; font-size: 0.8rem; }
    .related-grid { display: flex; flex-wrap: wrap; gap: 0.6rem; }
    .related-card { display: flex; flex-direction: column; align-items: center; gap: 0.35rem; text-decoration: none; color: #1f5b45; border: 1px solid #e1e1e1; padding: 0.5rem 0.4rem; width: 88px; background: #fff; }
    .related-card:hover { background: #f5fbf8; border-color: #1f5b45; }
    .related-thumb { display: block; width: 72px; height: 72px; object-fit: contain; background: #f7f7f7; }
    .related-thumb--empty { background: #f0f0f0; }
    .related-name { font-size: 0.72rem; text-align: center; line-height: 1.3; overflow-wrap: anywhere; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; border-top: 1px solid #eee; }
    @media (max-width: 640px) {
      .hero { grid-template-columns: ${image ? "160px 1fr" : "1fr"}; padding: 1rem 0.75rem; gap: 1rem; }
      .animal-image { width: 160px; height: 160px; }
      .hero-name { font-size: 1.3rem; }
      section { padding: 0.9rem 0.75rem; }
      .taxonomy-details { grid-template-columns: repeat(3, 1fr); }
      .taxonomy-details div:nth-child(3) { border-right: 0; }
      .taxonomy-details div:nth-child(4), .taxonomy-details div:nth-child(5) { border-top: 1px solid #e1e1e1; }
      .taxonomy-details div:nth-child(5) { border-right: 0; }
      .taxonomy-details dd { min-height: 0; }
      .zoo-list li { align-items: center; }
      footer { padding: 1rem 0.75rem; line-height: 1.5; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/animals")}
  <main>
    ${noticeHtml ? `<div style="padding:0.6rem 1.5rem">${noticeHtml}</div>` : ""}
    <div class="hero">
      ${imageHtml}
      <div class="hero-info">
        <h1 class="hero-name">${escapedDisplayName}</h1>
        ${canonicalHtml}
        ${taxonomyHtml}
      </div>
    </div>
    <section>
      <h2>見られる施設</h2>
      <ul class="zoo-list">${zooLinks}</ul>
    </section>
    ${relatedSection}
  </main>
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
</body>
</html>`;
}

function renderTaxonomyHtml(
  sections: TaxonomyOverviewSection[],
  tree: TaxonomyTreeNode[],
  activePref: PrefectureCode | null
): string {
  const prefLabel = activePref ? PREF_LABELS[activePref] : "近畿一円";
  const treeHtml = tree
    .map((classNode) => {
      const classUrl = buildTaxonomyPathUrl([classNode.name]);
      const orders = classNode.children
        .map((orderNode) => {
          const orderUrl = buildTaxonomyPathUrl([classNode.name, orderNode.name]);
          const families = orderNode.children
            .map(
              (familyNode) => `
                <li class="family-node">
                  <a href="${buildTaxonomyPathUrl([
                    classNode.name,
                    orderNode.name,
                    familyNode.name,
                  ])}">${escapeHtml(familyNode.name)}</a>
                  <small>${familyNode.animalCount} 種 / ${familyNode.zooCount} 施設</small>
                </li>`
            )
            .join("");
          return `
            <li class="order-node">
              <details>
                <summary>
                  <a href="${orderUrl}">${escapeHtml(orderNode.name)}</a>
                  <small>${orderNode.animalCount} 種 / ${orderNode.zooCount} 施設</small>
                </summary>
                <ul>${families}</ul>
              </details>
            </li>`;
        })
        .join("");
      return `
        <li class="class-node">
          <details>
            <summary>
              <a href="${classUrl}">${escapeHtml(classNode.name)}</a>
              <small>${classNode.animalCount} 種 / ${classNode.zooCount} 施設</small>
            </summary>
            <ul>${orders}</ul>
          </details>
        </li>`;
    })
    .join("");
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
    .taxonomy-scope { padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; color: #666; font-size: 0.9rem; }
    .taxonomy-page { display: grid; gap: 1.25rem; padding: 1rem 1.5rem 1.5rem; }
    .tree-section { border-bottom: 1px solid #ddd; padding-bottom: 1.25rem; }
    .tree-section h2, .rank-sections-title { font-size: 1.08rem; margin-bottom: 0.75rem; }
    .taxonomy-tree, .taxonomy-tree ul { list-style: none; }
    .taxonomy-tree { display: grid; gap: 0.55rem; }
    .taxonomy-tree ul { margin: 0.4rem 0 0 0.65rem; padding-left: 1rem; border-left: 1px solid #cbd8cf; }
    .taxonomy-tree li + li { margin-top: 0.35rem; }
    .taxonomy-tree summary { display: flex; align-items: center; gap: 0.55rem; min-height: 2.75rem; cursor: pointer; padding: 0.55rem 0.65rem; list-style: none; }
    .taxonomy-tree summary::-webkit-details-marker { display: none; }
    .taxonomy-tree summary::before { content: "▶"; flex: 0 0 1.15rem; color: #587466; font-size: 1.05rem; line-height: 1; text-align: center; transition: transform 0.15s ease; }
    .taxonomy-tree details[open] > summary::before { transform: rotate(90deg); }
    .taxonomy-tree summary:hover { background: #f3f7f4; }
    .taxonomy-tree summary:focus-visible { outline: 2px solid #1f5b45; outline-offset: -2px; }
    .taxonomy-tree a { color: #1f5b45; font-weight: bold; text-decoration: none; }
    .taxonomy-tree a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .taxonomy-tree small { margin-left: 0.45rem; color: #6b786f; font-size: 0.72rem; font-weight: normal; }
    .class-node > details > summary { font-size: 1rem; border-bottom: 1px solid #e3e9e5; }
    .order-node > details > summary { min-height: 2.5rem; font-size: 0.9rem; }
    .family-node { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.2rem; padding: 0.22rem 0; font-size: 0.84rem; }
    .family-node a { font-weight: normal; }
    .family-node small { margin-left: 0.25rem; }
    .taxonomy-section { border-top: 1px solid #ddd; padding-top: 1rem; }
    .taxonomy-section:first-child { border-top: 0; padding-top: 0; }
    .taxonomy-section h2 { font-size: 1.05rem; margin-bottom: 0.75rem; }
    .taxonomy-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.55rem; }
    .taxonomy-link { display: grid; gap: 0.2rem; border: 1px solid #dce7df; background: #f8fbf9; color: #1f5b45; padding: 0.65rem 0.75rem; text-decoration: none; }
    .taxonomy-link:hover { border-color: #9bc4ab; background: #f1f8f3; }
    .taxonomy-link span { font-weight: bold; overflow-wrap: anywhere; }
    .taxonomy-link small { color: #617469; font-size: 0.75rem; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
    @media (max-width: 640px) {
      .taxonomy-scope { padding: 0.7rem 0.75rem; }
      .taxonomy-page { gap: 1rem; padding: 0.75rem; }
      .taxonomy-tree { gap: 0.35rem; }
      .taxonomy-tree ul { margin-left: 0.25rem; padding-left: 0.45rem; }
      .taxonomy-tree summary { align-items: flex-start; gap: 0.35rem; min-height: 44px; padding: 0.65rem 0.35rem; }
      .taxonomy-tree summary::before { flex-basis: 1.35rem; font-size: 1.15rem; margin-top: 0.05rem; }
      .taxonomy-tree summary small { margin-left: auto; padding-left: 0.25rem; text-align: right; line-height: 1.4; }
      .family-node { min-height: 40px; align-items: center; padding: 0.35rem; }
      .taxonomy-links { grid-template-columns: 1fr; }
      .taxonomy-link { min-height: 54px; }
      footer { padding: 1rem 0.75rem; line-height: 1.5; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/taxonomy")}
  <p class="taxonomy-scope">${escapeHtml(prefLabel)}の分類</p>
  <main class="taxonomy-page">
    <section class="tree-section">
      <h2>分類ツリー（類・目・科）</h2>
      ${
        treeHtml
          ? `<ul class="taxonomy-tree">${treeHtml}</ul>`
          : `<p>この地域には分類済みの動物がありません。</p>`
      }
    </section>
    <h2 class="rank-sections-title">ランク別一覧</h2>
    ${sectionHtml}
  </main>
  <footer>分類は利用者が探しやすい粒度で整理しています。最新情報は各施設の公式サイトでご確認ください。</footer>
</body>
</html>`;
}

function renderTaxonomyDetailHtml(
  levels: TaxonomyPathLevel[],
  childSection: TaxonomyOverviewSection | null,
  animals: AnimalListItem[],
  imageKeys: AnimalImageVersionIndex = new Map()
): string {
  const current = levels[levels.length - 1];
  const { rank, value } = current;
  const escapedValue = escapeHtml(value);
  const items = renderAnimalCards(animals, imageKeys);
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
    .animal-list { padding: 1rem 1.5rem; overflow-x: auto; }
    .animal-table { width: 100%; min-width: 900px; border-collapse: collapse; }
    .animal-table th, .animal-table td { border: none; border-bottom: 1px solid #e8e8e8; padding: 0.65rem; vertical-align: top; text-align: left; font-size: 0.84rem; }
    .animal-table thead th { background: #f7f7f7; color: #555; border-bottom: 2px solid #ddd; }
    .animal-name { display: flex; align-items: center; gap: 0.5rem; }
    .animal-thumb { width: 40px; height: 40px; object-fit: cover; flex-shrink: 0; border-radius: 2px; background: #f0f0f0; }
    .animal-name a { color: #1f5b45; text-decoration: none; font-size: 0.98rem; }
    .animal-name a:hover { text-decoration: underline; }
    .taxonomy { color: #444; line-height: 1.5; }
    .taxonomy a { color: #1f5b45; text-decoration: none; }
    .taxonomy a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .unclassified { color: #777; }
    .facility-count { color: #666; font-size: 0.85rem; }
    .zoo-links { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .zoo-links a { color: #2d6a4f; border: 1px solid #d3e4d8; background: #f7fbf8; padding: 0.2rem 0.45rem; font-size: 0.78rem; text-decoration: none; }
    .zoo-links a:hover { text-decoration: underline; }
    .empty { padding: 2rem 1.5rem; color: #888; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
    @media (max-width: 700px) {
      .breadcrumb, .summary, .child-taxonomy { padding-left: 0.75rem; padding-right: 0.75rem; }
      .taxonomy-links { grid-template-columns: 1fr; }
      .animal-list { padding: 0.75rem; overflow: visible; }
      .animal-table { min-width: 0; border: 0; }
      .animal-table thead { display: none; }
      .animal-table tbody, .animal-table tr, .animal-table th, .animal-table td { display: block; width: 100%; }
      .animal-table tr { margin-bottom: 0.75rem; border: 1px solid #d8ddd9; }
      .animal-table th, .animal-table td { border: 0; border-bottom: 1px solid #e5e8e6; padding: 0.7rem 0.75rem; }
      .animal-table tr > :last-child { border-bottom: 0; }
      .animal-table td::before { content: attr(data-label); display: block; margin-bottom: 0.35rem; color: #6a746d; font-size: 0.7rem; font-weight: bold; }
      .animal-name { background: #f7faf8; }
      footer { padding: 1rem 0.75rem; line-height: 1.5; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/taxonomy")}
  ${breadcrumb}
  <p class="summary">${escapeHtml(rank.label)}: ${escapedValue} / 動物: ${animals.length} 件</p>
  ${childSectionHtml}
  ${
    animals.length > 0
      ? `<div class="animal-list"><table class="animal-table">
    <thead>
      <tr>
        <th scope="col">動物名</th>
        <th scope="col">分類</th>
        <th scope="col">施設数</th>
        <th scope="col">施設一覧</th>
      </tr>
    </thead>
    <tbody>${items}</tbody>
  </table></div>`
      : `<p class="empty">該当する動物がありません。</p>`
  }
  <footer>分類は利用者が探しやすい粒度で整理しています。最新情報は各施設の公式サイトでご確認ください。</footer>
</body>
</html>`;
}

function renderZooDetailHtml(
  zoo: Zoo,
  scraped: ScrapeResult,
  coverage: ZooCoverageStats,
  imageKeys: AnimalImageVersionIndex = new Map(),
  taxonomyByAnimal: Map<string, string> = new Map()
): string {
  const prefLabel = PREF_LABELS[zoo.prefecture];
  const classCounts = new Map<string, number>();
  for (const animal of scraped.animals) {
    const className = taxonomyByAnimal.get(animal) ?? "未分類";
    classCounts.set(className, (classCounts.get(className) ?? 0) + 1);
  }
  const classFilterButtons = [...classCounts.entries()]
    .sort(([a], [b]) => (a === "未分類" ? 1 : b === "未分類" ? -1 : a.localeCompare(b, "ja-JP")))
    .map(
      ([className, count]) =>
        `<button type="button" data-class-filter="${escapeHtml(className)}">${escapeHtml(className)} <span>${count}</span></button>`
    )
    .join("");
  const classFilterHtml = classCounts.size > 0
    ? `<div class="class-filters" aria-label="分類で絞り込み">
        <button type="button" class="active" data-class-filter="all">すべて <span>${scraped.animals.length}</span></button>
        ${classFilterButtons}
      </div>`
    : "";
  const featuredAnimals = scraped.animals
    .filter((animal) => imageKeys.has(normalizeAnimalImageKey(animal)))
    .slice(0, 8);
  const featuredHtml = featuredAnimals.length > 0
    ? `<section class="section featured-section">
        <div class="section-heading">
          <h3>画像で見る代表動物</h3>
          <a href="/animals?pref=${zoo.prefecture}">動物一覧へ</a>
        </div>
        <div class="featured-grid">
          ${featuredAnimals
            .map((animal) => {
              const animalKey = normalizeAnimalImageKey(animal);
              const className = taxonomyByAnimal.get(animal) ?? "未分類";
              return `
                <a class="featured-animal" href="${buildZooAnimalUrl(animal)}">
                  <img src="${buildAnimalImageUrl(animal, imageKeys.get(animalKey))}" alt="" loading="lazy" width="96" height="96">
                  <span>${escapeHtml(animal)}</span>
                  <small>${escapeHtml(className)}</small>
                </a>`;
            })
            .join("")}
        </div>
      </section>`
    : "";
  const animalLinks = scraped.animals
    .map((animal) => {
      const animalKey = normalizeAnimalImageKey(animal);
      const className = taxonomyByAnimal.get(animal) ?? "未分類";
      const thumb = imageKeys.has(animalKey)
        ? `<img src="${buildAnimalImageUrl(animal, imageKeys.get(animalKey))}" alt="" class="animal-thumb" loading="lazy" width="36" height="36">`
        : `<span class="animal-thumb"></span>`;
      return `<li data-class="${escapeHtml(className)}"><a href="${buildZooAnimalUrl(animal)}">${thumb}<span>${escapeHtml(animal)}</span><small>${escapeHtml(className)}</small></a></li>`;
    })
    .join("\n");
  const updatedAt = new Date(scraped.scrapedAt).toLocaleString("ja-JP");
  const animalListHtml =
    scraped.animals.length > 0
      ? `${classFilterHtml}<ul class="animal-links" id="zoo-animal-list">${animalLinks}</ul>`
      : `<p class="empty">動物一覧を取得できませんでした。公式サイトもあわせてご確認ください。</p>`;
  const coverageHtml = coverage.total > 0
    ? `<dl class="coverage-stats">
        <div><dt>総動物数</dt><dd>${coverage.total}</dd></div>
        <div><dt>分類済み</dt><dd>${coverage.classified}</dd></div>
        <div><dt>部分分類</dt><dd>${coverage.partial}</dd></div>
        <div><dt>未分類</dt><dd>${coverage.unclassified}</dd></div>
      </dl>`
    : "";

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
    main { max-width: 1040px; margin: 0 auto; padding: 1.5rem; }
    .section { border: 1px solid #ddd; padding: 1rem; margin-bottom: 1rem; }
    h2 { margin-bottom: 0.5rem; }
    h3 { font-size: 1.05rem; margin-bottom: 0.75rem; }
    .kana { color: #777; margin-bottom: 1rem; }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 0.55rem; margin: 1rem 0; }
    .hero-actions a { display: inline-flex; min-height: 40px; align-items: center; border: 1px solid #1f5b45; padding: 0.45rem 0.8rem; text-decoration: none; font-size: 0.86rem; }
    .primary-link { background: #1f5b45; color: #fff; }
    .secondary-link { background: #fff; color: #1f5b45; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
    .info-table th, .info-table td { border: 1px solid #ddd; padding: 0.45rem 0.55rem; text-align: left; vertical-align: top; font-size: 0.86rem; }
    .info-table th { width: 8em; background: #f7f7f7; color: #666; font-weight: bold; }
    .directions-link { display: inline-block; margin-top: 0.35rem; font-size: 0.78rem; color: #1f5b45; text-decoration: none; }
    .directions-link:hover { text-decoration: underline; }
    .animal-summary { color: #666; font-size: 0.85rem; margin-bottom: 0.75rem; }
    .coverage-stats { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0; list-style: none; }
    .coverage-stats div { background: #f7f7f7; border: 1px solid #e0e0e0; border-radius: 4px; padding: 0.4rem 0.65rem; min-width: 6em; }
    .coverage-stats dt { font-size: 0.72rem; color: #777; margin-bottom: 0.15rem; }
    .coverage-stats dd { font-size: 1rem; font-weight: bold; color: #222; }
    .section-heading { display: flex; justify-content: space-between; gap: 0.75rem; align-items: baseline; margin-bottom: 0.75rem; }
    .section-heading h3 { margin: 0; }
    .section-heading a { color: #1f5b45; font-size: 0.82rem; text-decoration: none; }
    .section-heading a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .featured-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 0.65rem; }
    .featured-animal { display: grid; gap: 0.25rem; min-width: 0; color: #222; text-decoration: none; }
    .featured-animal img { width: 100%; aspect-ratio: 1; height: auto; object-fit: cover; border: 1px solid #ddd; background: #f7f7f7; }
    .featured-animal span { color: #1f5b45; font-size: 0.86rem; font-weight: bold; overflow-wrap: anywhere; }
    .featured-animal small { color: #777; font-size: 0.72rem; }
    .class-filters { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }
    .class-filters button { min-height: 36px; border: 1px solid #cddbd2; background: #fff; color: #1f5b45; padding: 0.3rem 0.65rem; cursor: pointer; font: inherit; font-size: 0.82rem; }
    .class-filters button.active { background: #1f5b45; border-color: #1f5b45; color: #fff; }
    .class-filters span { opacity: 0.78; font-size: 0.72rem; }
    .animal-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.4rem 1rem; padding: 0; list-style: none; }
    .animal-links li { min-width: 0; }
    .animal-links a { display: flex; align-items: center; gap: 0.5rem; color: #1f5b45; border-bottom: 1px solid #e7eee9; padding: 0.35rem 0; text-decoration: none; overflow-wrap: anywhere; }
    .animal-links a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .animal-links a small { margin-left: auto; color: #777; font-size: 0.7rem; }
    .animal-links li.is-hidden { display: none; }
    .animal-links .animal-thumb { width: 36px; height: 36px; object-fit: cover; flex-shrink: 0; border-radius: 2px; background: #f0f0f0; }
    .animal-meta { color: #777; font-size: 0.78rem; margin-top: 0.85rem; }
    .error { color: #b00020; margin-bottom: 0.75rem; }
    .empty { color: #777; }
    #map { height: 320px; border: 1px solid #ddd; }
    @media (max-width: 640px) {
      main { padding: 0.75rem; }
      .section { padding: 0.75rem; }
      .info-table, .info-table tbody, .info-table tr, .info-table th, .info-table td { display: block; width: 100%; }
      .info-table tr { border: 1px solid #ddd; border-bottom: 0; }
      .info-table tr:last-child { border-bottom: 1px solid #ddd; }
      .info-table th, .info-table td { border: 0; }
      .info-table th { padding-bottom: 0.2rem; }
      .info-table td { padding-top: 0.2rem; }
      .featured-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .animal-links { grid-template-columns: 1fr; }
      .animal-links a small { display: none; }
      #map { height: 260px; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/")}
  <main>
    <nav class="page-nav">
      <a href="#animals">動物一覧</a>
      <a href="${escapeHtml(zoo.website)}" target="_blank" rel="noopener noreferrer">公式サイト</a>
    </nav>
    <section class="section">
      <h2>${escapeHtml(zoo.name)}</h2>
      <p class="kana">${escapeHtml(zoo.nameKana)}</p>
      <div class="hero-actions">
        <a class="primary-link" href="${escapeHtml(zoo.website)}" target="_blank" rel="noopener noreferrer">公式サイトを見る</a>
        <a class="secondary-link" href="${buildMapUrl(zoo.prefecture, null)}#zoo-${escapeHtml(zoo.id)}">地図で見る</a>
      </div>
      <table class="info-table">
        <tbody>
          <tr><th scope="row">都道府県</th><td>${prefLabel}</td></tr>
          <tr><th scope="row">住所</th><td>${escapeHtml(zoo.address)}<br><a class="directions-link" href="https://www.google.com/maps/dir/?api=1&destination=${zoo.lat},${zoo.lon}&travelmode=driving" target="_blank" rel="noopener noreferrer">車で経路を調べる (Google マップ)</a></td></tr>
          <tr><th scope="row">開園時間</th><td>${escapeHtml(zoo.openingHours)}</td></tr>
          <tr><th scope="row">休園日</th><td>${escapeHtml(zoo.closedDays)}</td></tr>
          <tr><th scope="row">入園料</th><td>${escapeHtml(zoo.admission)}</td></tr>
          ${
            zoo.directorySourceName && zoo.directorySourceUrl
              ? `<tr><th scope="row">施設一覧出典</th><td><a href="${escapeHtml(zoo.directorySourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(zoo.directorySourceName)}</a></td></tr>`
              : ""
          }
        </tbody>
      </table>
    </section>
    ${featuredHtml}
    <section class="section" id="animals">
      <h3>見られる動物</h3>
      ${coverageHtml}
      <p class="animal-summary">${scraped.animals.length} 件</p>
      ${scraped.error ? `<p class="error">取得に失敗しました: ${escapeHtml(scraped.error)}</p>` : ""}
      ${animalListHtml}
      <p class="animal-meta">最終取得: ${escapeHtml(updatedAt)}</p>
    </section>
    <div id="map"></div>
  </main>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
    var filterButtons = document.querySelectorAll('[data-class-filter]');
    var animalItems = document.querySelectorAll('#zoo-animal-list li[data-class]');
    filterButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        var active = button.dataset.classFilter;
        filterButtons.forEach(function(item) { item.classList.toggle('active', item === button); });
        animalItems.forEach(function(item) {
          item.classList.toggle('is-hidden', active !== 'all' && item.dataset.class !== active);
        });
      });
    });

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

interface CompareAnimalRow {
  display_name: string;
  class_name: string | null;
  order_name: string | null;
}

interface TaxonomyCountRow {
  zoo_id: string;
  cls: string | null;
  ord: string | null;
  cnt: number;
}

async function loadTaxonomyCountsByZoo(db: D1Database): Promise<TaxonomyCountRow[]> {
  const result = await db
    .prepare(
      `SELECT za.zoo_id,
              COALESCE(a.class_name, NULLIF(c.class_name, 'null')) AS cls,
              COALESCE(a.order_name, NULLIF(c.order_name, 'null')) AS ord,
              COUNT(DISTINCT za.display_name) AS cnt
       FROM zoo_animals za
       LEFT JOIN animals a ON a.id = za.animal_id
       LEFT JOIN animal_taxonomy_candidates c
         ON c.display_name = za.display_name
        AND za.animal_id IS NULL
        AND c.status IN ('partial', 'pending', 'applied')
        AND c.confidence >= 0.7
       GROUP BY za.zoo_id, cls, ord`
    )
    .all<TaxonomyCountRow>();
  return result.results ?? [];
}

const CLASS_SORT_ORDER = ["哺乳類", "鳥類", "爬虫類", "両生類", "魚類", "軟骨魚類", "無脊椎動物"];

function renderCompareIndexHtml(countRows: TaxonomyCountRow[], animalCounts: Map<string, number>): string {
  // Build lookup: zooId -> className -> orderName -> count
  const lookup = new Map<string, Map<string, Map<string, number>>>();
  const classOrderMap = new Map<string, Set<string>>();

  for (const row of countRows) {
    const cls = row.cls ?? "未分類";
    const ord = row.ord ?? "不明";
    if (!lookup.has(row.zoo_id)) lookup.set(row.zoo_id, new Map());
    const byClass = lookup.get(row.zoo_id)!;
    if (!byClass.has(cls)) byClass.set(cls, new Map());
    byClass.get(cls)!.set(ord, row.cnt);
    if (!classOrderMap.has(cls)) classOrderMap.set(cls, new Set());
    classOrderMap.get(cls)!.add(ord);
  }

  const sortedClasses = [...classOrderMap.keys()].sort((a, b) => {
    const ia = CLASS_SORT_ORDER.indexOf(a), ib = CLASS_SORT_ORDER.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a === "未分類" ? 1 : b === "未分類" ? -1 : a.localeCompare(b, "ja");
  });

  const sortedZoos = [...zoos].sort((a, b) => (animalCounts.get(b.id) ?? 0) - (animalCounts.get(a.id) ?? 0));

  const headerCells = sortedZoos
    .map(
      (zoo) => `<th class="zoo-head" scope="col">
        <label class="zoo-label">
          <input type="checkbox" class="zoo-check" value="${escapeHtml(zoo.id)}" data-name="${escapeHtml(zoo.name)}">
          <span class="zoo-name">${escapeHtml(zoo.name)}</span>
          <span class="zoo-cnt">${animalCounts.get(zoo.id) ?? 0}種</span>
        </label>
      </th>`
    )
    .join("");

  const tableRows = sortedClasses
    .flatMap((cls) => {
      const orders = [...classOrderMap.get(cls)!].sort((a, b) =>
        a === "不明" ? 1 : b === "不明" ? -1 : a.localeCompare(b, "ja")
      );
      const classCells = sortedZoos
        .map((zoo) => {
          const byClass = lookup.get(zoo.id)?.get(cls);
          const total = byClass ? [...byClass.values()].reduce((s, v) => s + v, 0) : 0;
          return `<td class="cnt-cell cnt-class">${total || ""}</td>`;
        })
        .join("");
      const classRow = `<tr class="class-row"><th class="tax-cell class-cell" scope="row">${escapeHtml(cls)}</th>${classCells}</tr>`;
      const orderRows = orders
        .map((ord) => {
          const cells = sortedZoos
            .map((zoo) => {
              const cnt = lookup.get(zoo.id)?.get(cls)?.get(ord) ?? 0;
              return `<td class="cnt-cell">${cnt || ""}</td>`;
            })
            .join("");
          return `<tr class="order-row"><th class="tax-cell order-cell" scope="row">${escapeHtml(ord)}</th>${cells}</tr>`;
        })
        .join("");
      return classRow + orderRows;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>動物園を比較 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1.25rem 1.5rem 5rem; display: grid; gap: 1.25rem; }
    h1 { font-size: 1.15rem; }
    .table-wrap { overflow-x: auto; border: 1px solid #ddd; }
    .pivot-table { border-collapse: separate; border-spacing: 0; font-size: 0.8rem; border: 1px solid #ddd; }
    .pivot-table th, .pivot-table td { border-right: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8; }
    .zoo-head { position: sticky; top: 0; background: #fff; z-index: 2; min-width: 72px; vertical-align: bottom; padding: 0.4rem 0.35rem; border-bottom: 2px solid #ccc !important; text-align: center; }
    .tax-head { position: sticky; top: 0; left: 0; background: #fff; z-index: 3; padding: 0.4rem 0.6rem; border-bottom: 2px solid #ccc !important; border-right: 2px solid #ccc !important; font-size: 0.75rem; color: #888; min-width: 100px; }
    .zoo-label { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; cursor: pointer; }
    .zoo-check { width: 15px; height: 15px; cursor: pointer; accent-color: #1f5b45; }
    .zoo-name { font-size: 0.72rem; line-height: 1.3; word-break: break-all; color: #333; }
    .zoo-cnt { font-size: 0.68rem; color: #888; }
    .zoo-head.is-checked { background: #f0fbf4; }
    .zoo-head.is-checked .zoo-name { color: #1f5b45; font-weight: bold; }
    .tax-cell { position: sticky; left: 0; background: #fff; z-index: 1; white-space: nowrap; padding: 0.25rem 0.6rem; border-right: 2px solid #ddd !important; font-weight: normal; text-align: left; }
    .class-cell { background: #f5f5f5 !important; font-weight: bold; font-size: 0.8rem; color: #333; border-top: 2px solid #ccc !important; }
    .order-cell { font-size: 0.75rem; color: #555; padding-left: 1.2rem; }
    .cnt-cell { text-align: center; padding: 0.22rem 0.4rem; color: #444; min-width: 44px; }
    .cnt-class { background: #f9f9f9; font-weight: bold; color: #333; border-top: 2px solid #ccc !important; }
    .cnt-cell.is-checked-a { background: #e8f5ee; }
    .cnt-cell.is-checked-b { background: #e8f5ee; }
    .compare-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1f5b45; color: #fff; padding: 0.75rem 1.5rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; z-index: 100; box-shadow: 0 -2px 8px rgba(0,0,0,0.15); }
    .compare-bar-text { flex: 1; font-size: 0.88rem; }
    .compare-go { border: 2px solid #fff; background: #fff; color: #1f5b45; padding: 0.4rem 1rem; cursor: pointer; font-size: 0.88rem; font-weight: bold; }
    .compare-go:disabled { opacity: 0.5; cursor: default; }
    .compare-clear { border: 1px solid rgba(255,255,255,0.5); background: transparent; color: #fff; padding: 0.4rem 0.75rem; cursor: pointer; font-size: 0.82rem; }
    @media (max-width: 640px) {
      main { padding: 0.75rem 0.5rem 5rem; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/compare")}
  <main>
    <h1>動物園を比較 <span style="font-size:0.82rem;font-weight:normal;color:#888">2〜3つ選んで比較できます</span></h1>
    <div class="table-wrap">
      <table class="pivot-table">
        <thead>
          <tr>
            <th class="tax-head" scope="col">分類</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </main>
  <div class="compare-bar" id="compare-bar" hidden>
    <span class="compare-bar-text" id="compare-bar-text"></span>
    <button class="compare-go" id="compare-go" disabled>比較する</button>
    <button class="compare-clear" id="compare-clear">クリア</button>
  </div>
  <script>
    var checked = [];
    var bar = document.getElementById('compare-bar');
    var barText = document.getElementById('compare-bar-text');
    var goBtn = document.getElementById('compare-go');
    var clearBtn = document.getElementById('compare-clear');

    function colIndex(zooId) {
      var heads = document.querySelectorAll('.zoo-head');
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].querySelector('.zoo-check').value === zooId) return i + 2;
      }
      return -1;
    }

    function updateHighlight() {
      document.querySelectorAll('.zoo-head').forEach(function(th) {
        th.classList.toggle('is-checked', checked.some(function(c) { return c.id === th.querySelector('.zoo-check').value; }));
      });
      document.querySelectorAll('.cnt-cell').forEach(function(td) { td.classList.remove('is-checked-a', 'is-checked-b'); });
      checked.forEach(function(c, i) {
        var idx = colIndex(c.id);
        document.querySelectorAll('.pivot-table tbody tr').forEach(function(tr) {
          var td = tr.children[idx - 1];
          if (td) td.classList.add(i === 0 ? 'is-checked-a' : 'is-checked-b');
        });
      });
    }

    function updateBar() {
      bar.hidden = checked.length === 0;
      if (checked.length > 0) {
        barText.textContent = checked.map(function(c) { return c.name; }).join(' と ');
        goBtn.disabled = checked.length < 2;
      }
    }

    document.querySelectorAll('.zoo-check').forEach(function(cb) {
      cb.addEventListener('change', function() {
        if (cb.checked) {
          if (checked.length >= 3) { cb.checked = false; return; }
          checked.push({ id: cb.value, name: cb.dataset.name });
        } else {
          checked = checked.filter(function(c) { return c.id !== cb.value; });
        }
        updateHighlight();
        updateBar();
      });
    });

    goBtn.addEventListener('click', function() {
      if (checked.length >= 2) {
        var keys = ['a', 'b', 'c'];
        var params = checked.map(function(c, i) { return keys[i] + '=' + encodeURIComponent(c.id); }).join('&');
        location.href = '/compare?' + params;
      }
    });

    clearBtn.addEventListener('click', function() {
      checked = [];
      document.querySelectorAll('.zoo-check').forEach(function(cb) { cb.checked = false; });
      updateHighlight();
      updateBar();
    });
  </script>
</body>
</html>`;
}

async function loadZooAnimalsForCompare(db: D1Database, zooId: string): Promise<CompareAnimalRow[]> {
  const result = await db
    .prepare(
      `SELECT za.display_name,
              COALESCE(a.class_name, NULLIF(c.class_name, 'null')) AS class_name,
              COALESCE(a.order_name, NULLIF(c.order_name, 'null')) AS order_name
       FROM zoo_animals za
       LEFT JOIN animals a ON a.id = za.animal_id
       LEFT JOIN animal_taxonomy_candidates c
         ON c.display_name = za.display_name
        AND za.animal_id IS NULL
        AND c.status IN ('partial', 'pending', 'applied')
        AND c.confidence >= 0.7
       WHERE za.zoo_id = ?
       ORDER BY COALESCE(a.sort_key, za.sort_key, za.display_name)`
    )
    .bind(zooId)
    .all<CompareAnimalRow>();
  return result.results ?? [];
}

function renderCompareHtml(
  selected: { zoo: Zoo; animals: CompareAnimalRow[] }[],
  animalCounts: Map<string, number>
): string {
  const n = selected.length;
  const nameSets = selected.map(({ animals }) => new Set(animals.map((a) => a.display_name)));

  // class/order lookup across all zoos
  const classOf = new Map<string, string | null>();
  const orderOf = new Map<string, string | null>();
  for (const { animals } of selected) {
    for (const a of animals) {
      if (!classOf.has(a.display_name)) classOf.set(a.display_name, a.class_name);
      if (!orderOf.has(a.display_name)) orderOf.set(a.display_name, a.order_name);
    }
  }

  // Common = in ALL selected zoos
  const commonNames = new Set(
    [...nameSets[0]].filter((name) => nameSets.every((s) => s.has(name)))
  );
  const commonAnimals = selected[0].animals.filter((a) => commonNames.has(a.display_name));

  // Each zoo's column: animals in this zoo that are NOT in 共通 (not in all selected zoos)
  // Animals shared by exactly 2-of-3 zoos appear in both of those zoo columns
  const exclusiveLists = selected.map(({ animals }) =>
    animals.filter((a) => !commonNames.has(a.display_name))
  );

  const cols = n + 1; // 共通 + N 園
  const gridCols = `repeat(${cols}, minmax(0, 1fr))`;

  const groupByOrder = (rows: CompareAnimalRow[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const ord = r.order_name ?? "不明";
      if (!map.has(ord)) map.set(ord, []);
      map.get(ord)!.push(r.display_name);
    }
    return map;
  };

  const groupByOrderNames = (names: string[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    for (const name of names) {
      const ord = orderOf.get(name) ?? "不明";
      if (!map.has(ord)) map.set(ord, []);
      map.get(ord)!.push(name);
    }
    return map;
  };

  const allClasses = [
    ...new Set([
      ...commonAnimals.map((a) => a.class_name ?? "未分類"),
      ...exclusiveLists.flatMap((list) => list.map((a) => a.class_name ?? "未分類")),
    ]),
  ].sort((a, b) => {
    const ia = CLASS_SORT_ORDER.indexOf(a), ib = CLASS_SORT_ORDER.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1; if (ib >= 0) return 1;
    return a === "未分類" ? 1 : b === "未分類" ? -1 : a.localeCompare(b, "ja");
  });

  const animalLink = (name: string) =>
    `<li><a href="/animal/${encodeURIComponent(name)}">${escapeHtml(name)}</a></li>`;

  const zooOptions = (sel: string, name: string) =>
    `<div class="select-group"><select name="${escapeHtml(name)}"><option value="">（なし）</option>${
      zoos.map((z) => {
        const cnt = animalCounts.get(z.id);
        const text = cnt != null ? `${z.name}（${cnt}種）` : z.name;
        return `<option value="${escapeHtml(z.id)}"${z.id === sel ? " selected" : ""}>${escapeHtml(text)}</option>`;
      }).join("")
    }</select></div>`;

  const classSections = allClasses.map((cls) => {
    const clsCommon = commonAnimals.filter((a) => (a.class_name ?? "未分類") === cls);
    const clsExcl = exclusiveLists.map((list) =>
      list.filter((a) => (a.class_name ?? "未分類") === cls)
    );
    const total = clsCommon.length + clsExcl.reduce((s, l) => s + l.length, 0);
    if (total === 0) return "";

    const ordGrpCommon = groupByOrder(clsCommon);
    const ordGrpExcl = clsExcl.map((list) => groupByOrder(list));
    const allOrders = [
      ...new Set([...ordGrpCommon.keys(), ...ordGrpExcl.flatMap((g) => [...g.keys()])]),
    ].sort((a, b) => (a === "不明" ? 1 : b === "不明" ? -1 : a.localeCompare(b, "ja")));

    const clsSummaryParts = [
      clsCommon.length ? `共通: ${clsCommon.length}` : "",
      ...clsExcl.map((l, i) => (l.length ? `${selected[i].zoo.name.slice(0, 4)}: ${l.length}` : "")),
    ].filter(Boolean).join(" · ");

    const orderSections = allOrders.map((ord) => {
      const oCommon = ordGrpCommon.get(ord) ?? [];
      const oExcl = ordGrpExcl.map((g) => g.get(ord) ?? []);
      const ordSummary = [
        oCommon.length ? `共通: ${oCommon.length}` : "",
        ...oExcl.map((l, i) => (l.length ? `${selected[i].zoo.name.slice(0, 4)}: ${l.length}` : "")),
      ].filter(Boolean).join(" · ");
      return `<div class="order-section">
        <div class="order-heading">${escapeHtml(ord)}<span class="class-counts">${escapeHtml(ordSummary)}</span></div>
        <div class="compare-grid" style="grid-template-columns:${gridCols}">
          <div class="compare-col compare-col--common"><ul class="col-list">${oCommon.map(animalLink).join("")}</ul></div>
          ${oExcl.map((l) => `<div class="compare-col"><ul class="col-list">${l.map(animalLink).join("")}</ul></div>`).join("")}
        </div>
      </div>`;
    }).join("");

    return `<section class="class-section">
      <h2 class="class-heading">${escapeHtml(cls)}<span class="class-counts">${escapeHtml(clsSummaryParts)}</span></h2>
      ${orderSections}
    </section>`;
  }).join("");

  const headerLabels = [
    `<div class="compare-label compare-label--common">共通<span class="compare-total">${commonAnimals.length}種</span></div>`,
    ...selected.map((s, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C
      return `<div class="compare-label">${escapeHtml(s.zoo.name)}<span class="compare-total">${exclusiveLists[i].length}種</span></div>`;
    }),
  ].join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>動物園を比較 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1.25rem 1.5rem 3rem; display: grid; gap: 1.5rem; }
    h1 { font-size: 1.15rem; }
    .compare-form { display: flex; flex-wrap: nowrap; gap: 0.5rem; align-items: center; padding: 0.75rem; background: #f8fbf9; border: 1px solid #dce7df; }
    .select-group { flex: 1 1 0; min-width: 0; }
    .select-group select { width: 100%; min-height: 42px; border: 1px solid #bbb; padding: 0.4rem 0.6rem; background: #fff; }
    .compare-form button { min-height: 42px; border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.4rem 1.1rem; cursor: pointer; font-size: 0.9rem; flex-shrink: 0; white-space: nowrap; }
    @media (max-width: 640px) { .compare-form { flex-wrap: wrap; } .select-group { flex: 1 1 100%; } }
    .compare-header { display: grid; grid-template-columns: ${gridCols}; border: 1px solid #ddd; border-bottom: none; position: sticky; top: 0; z-index: 10; }
    .compare-label { padding: 0.6rem 0.85rem; background: #f3f3f3; font-size: 0.82rem; font-weight: bold; color: #555; border-right: 1px solid #ddd; display: flex; justify-content: space-between; align-items: baseline; gap: 0.4rem; }
    .compare-label:last-child { border-right: none; }
    .compare-label--common { background: #f0fbf4; color: #1f5b45; }
    .compare-total { font-size: 0.75rem; font-weight: normal; color: #888; white-space: nowrap; }
    .compare-label--common .compare-total { color: #1f5b45; }
    .class-section { border: 1px solid #ddd; border-top: none; }
    .class-heading { font-size: 0.82rem; font-weight: bold; color: #555; background: #f9f9f9; padding: 0.4rem 0.85rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: baseline; }
    .class-counts { font-size: 0.72rem; font-weight: normal; color: #aaa; }
    .order-section { border-top: 1px solid #eee; }
    .order-section:first-child { border-top: none; }
    .order-heading { font-size: 0.78rem; color: #777; background: #fcfcfc; padding: 0.3rem 0.85rem 0.3rem 1.4rem; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: baseline; }
    .compare-grid { display: grid; }
    .compare-col { border-right: 1px solid #eee; min-height: 1px; }
    .compare-col:last-child { border-right: none; }
    .compare-col--common { background: #fafffe; }
    .col-list { list-style: none; }
    .col-list li { border-bottom: 1px solid #f5f5f5; }
    .col-list li:last-child { border-bottom: none; }
    .col-list a { display: block; padding: 0.28rem 0.85rem; font-size: 0.82rem; color: #1f5b45; text-decoration: none; }
    .col-list a:hover { background: #f5fbf8; }
    @media (max-width: 640px) {
      main { padding: 0.75rem 0.75rem 2rem; gap: 1rem; }
      .compare-label { font-size: 0.68rem; padding: 0.45rem 0.35rem; }
      .col-list a { padding: 0.28rem 0.4rem; font-size: 0.78rem; }
      .class-heading { font-size: 0.78rem; padding: 0.35rem 0.4rem; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/compare")}
  <main>
    <h1>動物園を比較</h1>
    <form class="compare-form" action="/compare" method="get">
      ${zooOptions(selected[0]?.zoo.id ?? "", "a")}
      ${zooOptions(selected[1]?.zoo.id ?? "", "b")}
      ${zooOptions(selected[2]?.zoo.id ?? "", "c")}
      <button type="submit">比較する</button>
    </form>
    <div class="compare-header">${headerLabels}</div>
    ${classSections}
  </main>
</body>
</html>`;
}

const MAP_CLASS_FILTERS = ["哺乳類", "鳥類", "爬虫類", "両生類", "魚類", "軟骨魚類", "無脊椎動物"];

function renderMapHtml(
  results: ZooSearchResult[],
  activePref: PrefectureCode | null,
  animal: string | null,
  taxClass: string | null = null
): string {
  const escapedAnimal = animal ? escapeHtml(animal) : "";

  // Embed only the data needed for map markers; safe to embed as JSON in <script>
  const mapData = JSON.stringify(
    results.map((result) => ({
      id: result.zoo.id,
      name: result.zoo.name,
      lat: result.zoo.lat,
      lon: result.zoo.lon,
      animalCount: result.animalCount,
      matchCount: result.matchedAnimals.length,
    }))
  ).replace(/<\//g, "<\\/");

  const count = results.length;
  const matchCount = results.reduce((sum, result) => sum + result.matchedAnimals.length, 0);
  const prefLabel = activePref && isPrefectureCode(activePref) ? PREF_LABELS[activePref] : "近畿一円";
  const summary = taxClass
    ? `${prefLabel} で${escapeHtml(taxClass)}を見られる動物園・施設: ${count} 件 / ${matchCount} 種`
    : animal
      ? `${prefLabel} で「${escapedAnimal}」を探せる動物園・施設: ${count} 件 / 検索ヒット: ${matchCount} 件`
      : `${prefLabel} の動物園・施設: ${count} 件`;

  const showPanel = (animal || taxClass) && results.length > 0;

  const resultListHtml = showPanel
    ? results.map((r) => {
        const matched = r.matchedAnimals.map((a) => `<a href="/animal/${encodeURIComponent(a)}">${escapeHtml(a)}</a>`).join("、");
        const cnt = r.matchedAnimals.length;
        return `<li class="result-item" data-zoo-id="${escapeHtml(r.zoo.id)}">
          <a class="result-link" href="/zoos/${encodeURIComponent(r.zoo.id)}${activePref ? `?pref=${activePref}` : ""}">
            <span class="result-name">${escapeHtml(r.zoo.name)}<span class="result-count">${cnt}種</span></span>
          </a>
          <p class="result-animals">${matched}</p>
        </li>`;
      }).join("\n")
    : "";

  const classChips = MAP_CLASS_FILTERS.map((cls) => {
    const active = cls === taxClass;
    const href = active ? buildMapUrl(activePref, null) : buildMapUrl(activePref, null, cls);
    return `<a href="${escapeHtml(href)}" class="cls-chip${active ? " cls-chip--active" : ""}">${escapeHtml(cls)}</a>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>地図 | 近畿動物園情報</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; display: flex; flex-direction: column; height: 100vh; height: 100dvh; }${COMMON_STYLES}
    .site-header { flex-shrink: 0; }
    .global-nav { flex-shrink: 0; }
    .map-toolbar { display: flex; justify-content: flex-end; padding: 0.55rem 1.5rem; border-bottom: 1px solid #ddd; flex-shrink: 0; }
    .list-link { font-size: 0.85rem; color: #1f5b45; text-decoration: none; }
    .list-link:hover { text-decoration: underline; }
    .search-form { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; flex-shrink: 0; }
    .search-form input { flex: 1 1 220px; max-width: 320px; padding: 0.55rem 0.75rem; border: 1px solid #bbb; font-size: 0.95rem; }
    .search-form button, .search-form a { font-size: 0.875rem; }
    .search-form button { border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.5rem 0.9rem; cursor: pointer; }
    .search-form a { padding: 0.5rem 0.7rem; color: #1f5b45; text-decoration: none; border: 1px solid #1f5b45; }
    .cls-filter { display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0.5rem 1.5rem; border-bottom: 1px solid #ddd; flex-shrink: 0; }
    .cls-chip { font-size: 0.78rem; padding: 0.25rem 0.65rem; border: 1px solid #bbb; color: #555; text-decoration: none; background: #fff; white-space: nowrap; }
    .cls-chip:hover { border-color: #1f5b45; color: #1f5b45; }
    .cls-chip--active { background: #1f5b45; color: #fff; border-color: #1f5b45; }
    .summary { padding: 0.4rem 1.5rem; font-size: 0.9rem; color: #666; flex-shrink: 0; }
    .map-body { flex: 1; min-height: 0; display: flex; }
    #map { flex: 1; min-height: 0; min-width: 0; }
    .result-list-panel { width: 300px; flex-shrink: 0; border-left: 1px solid #ddd; overflow-y: auto; display: ${showPanel ? "block" : "none"}; }
    .result-list { list-style: none; }
    .result-item { border-bottom: 1px solid #eee; }
    .result-item.is-focused { background: #f0fbf4; }
    .result-link { display: block; padding: 0.55rem 0.85rem 0.3rem; text-decoration: none; color: inherit; }
    .result-link:hover { background: #f5fbf8; }
    .result-name { display: flex; align-items: baseline; gap: 0.4rem; font-size: 0.9rem; font-weight: bold; color: #1f5b45; }
    .result-count { font-size: 0.72rem; font-weight: normal; color: #888; white-space: nowrap; }
    .result-animals { font-size: 0.72rem; color: #666; line-height: 1.6; padding: 0 0.85rem 0.5rem; overflow-wrap: anywhere; }
    .result-animals a { color: #1f5b45; text-decoration: none; }
    .result-animals a:hover { text-decoration: underline; }
    .marker-active { filter: hue-rotate(160deg) saturate(2) brightness(1.1); }
    @media (max-width: 640px) {
      .map-toolbar { justify-content: stretch; padding: 0 0.75rem; }
      .list-link { display: flex; min-height: 40px; align-items: center; }
      .search-form { display: grid; grid-template-columns: 1fr auto; padding: 0.65rem 0.75rem; }
      .search-form input { width: 100%; max-width: none; min-width: 0; min-height: 44px; grid-column: 1 / -1; }
      .search-form button, .search-form a { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; }
      .summary { padding: 0.45rem 0.75rem; font-size: 0.8rem; line-height: 1.4; }
      .map-body { flex-direction: column; }
      #map { flex: none; height: 300px; }
      .result-list-panel { width: 100%; border-left: none; border-top: 1px solid #ddd; flex: 1; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/map")}
  <nav class="map-toolbar">
    <a href="${buildBrowseUrl(activePref, animal)}" class="list-link">一覧で見る →</a>
  </nav>
  <form class="search-form" action="/map" method="get">
    <input type="search" name="animal" value="${escapedAnimal}" placeholder="動物名で検索（例: パンダ）" aria-label="動物名で検索">
    <button type="submit">検索</button>
    ${animal ? `<a href="${buildMapUrl(activePref, null)}">クリア</a>` : ""}
  </form>
  <div class="cls-filter">${classChips}</div>
  <p class="summary">${summary}</p>
  <div class="map-body">
    <div id="map"></div>
    <aside class="result-list-panel" aria-label="検索結果一覧">
      <ul class="result-list">${resultListHtml}</ul>
    </aside>
  </div>
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
    var markers = {};
    zoos.forEach(function(zoo) {
      var matchLine = ${animal ? "true" : "false"} ? '<br><span>検索ヒット: ' + zoo.matchCount + ' 件</span>' : '';
      var animalCountLine = '<br><span>動物種数: ' + (zoo.animalCount > 0 ? zoo.animalCount + ' 種' : '未取得') + '</span>';
      var marker = L.marker([zoo.lat, zoo.lon])
        .bindPopup('<b><a href="/zoos/' + esc(zoo.id) + '${activePref ? `?pref=${activePref}` : ""}">' + esc(zoo.name) + '</a></b>' + matchLine + animalCountLine)
        .addTo(map);
      markers[zoo.id] = marker;
    });
    if (zoos.length > 0) {
      var bounds = L.latLngBounds(zoos.map(function(z) { return [z.lat, z.lon]; }));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
    var prevFocused = null;
    var prevMarker = null;
    document.querySelectorAll('.result-item').forEach(function(item) {
      function activate() {
        if (prevFocused) prevFocused.classList.remove('is-focused');
        item.classList.add('is-focused');
        prevFocused = item;
        if (prevMarker) {
          var el = prevMarker.getElement();
          if (el) el.classList.remove('marker-active');
        }
        var id = item.dataset.zooId;
        var marker = markers[id];
        if (marker) {
          var el = marker.getElement();
          if (el) el.classList.add('marker-active');
          marker.openPopup();
          prevMarker = marker;
        }
      }
      item.addEventListener('mouseenter', activate);
      item.addEventListener('focusin', activate);
    });
  </script>
</body>
</html>`;
}

function isAdminPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname === "/api/animal-images/generate" ||
    pathname === "/api/animals/refresh" ||
    pathname === "/api/animals/classify" ||
    pathname === "/api/animals/suggest-taxonomy" ||
    pathname === "/api/animals/taxonomy-candidates" ||
    /^\/animal\/.+\/classify$/.test(pathname)
  );
}

function checkAdminAuth(request: Request, adminPassword: string): boolean {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Basic ")) return false;
  const decoded = atob(auth.slice(6));
  const colon = decoded.indexOf(":");
  const password = colon >= 0 ? decoded.slice(colon + 1) : decoded;
  return password === adminPassword;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const prefParam = url.searchParams.get("pref");
    if (prefParam && !isPrefectureCode(prefParam)) {
      return notFound(`都道府県コード '${prefParam}' は無効です`);
    }
    const activePref = getActivePrefecture(url);

    if (isAdminPath(pathname)) {
      if (!env.ADMIN_PASSWORD || !checkAdminAuth(request, env.ADMIN_PASSWORD)) {
        return new Response("Unauthorized", {
          status: 401,
          headers: { "WWW-Authenticate": 'Basic realm="Admin", charset="UTF-8"' },
        });
      }
    }

    // JSON API: /api/zoos
    if (pathname === "/api/zoos") {
      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      const results = await searchZoos(env.DB, activePref, animal);
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
        zooIds?: unknown;
        apply?: unknown;
      };
      const requestedNames = Array.isArray(body.displayNames)
        ? body.displayNames.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
      const limit =
        typeof body.limit === "number" && Number.isFinite(body.limit)
          ? Math.max(1, Math.min(20, Math.floor(body.limit)))
          : 10;
      const requestedZooIds = Array.isArray(body.zooIds)
        ? body.zooIds.filter(
            (value): value is string =>
              typeof value === "string" && zoos.some((zoo) => zoo.id === value)
          )
        : [];
      const displayNames =
        requestedNames.length > 0
          ? [...new Set(requestedNames.map((name) => name.trim()))].slice(0, 20)
          : await loadUnclassifiedDisplayNames(env.DB, limit, [...new Set(requestedZooIds)]);

      if (body.apply === true && requestedNames.length === 0) {
        const pendingCandidates = await loadPendingTaxonomyCandidates(
          env.DB,
          limit,
          [...new Set(requestedZooIds)]
        );
        if (pendingCandidates.length > 0) {
          const pendingResults: TaxonomyCandidateApplyResult[] = [];
          for (const candidate of pendingCandidates) {
            pendingResults.push(await applyTaxonomyCandidate(env.DB, candidate));
          }
          return jsonResponse({
            requested: pendingCandidates.length,
            suggested: pendingCandidates.length,
            candidates: pendingCandidates,
            groundingSources: [],
            applied: pendingResults.filter((result) => result.status === "applied").length,
            partial: pendingResults.filter((result) => result.status === "partial").length,
            rejected: pendingResults.filter((result) => result.status === "rejected").length,
            reusedPending: true,
          });
        }
      }

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
      const applyResults: TaxonomyCandidateApplyResult[] = [];
      if (body.apply === true) {
        for (const candidate of suggestion.candidates) {
          applyResults.push(await applyTaxonomyCandidate(env.DB, candidate));
        }
      }

      return jsonResponse({
        requested: displayNames.length,
        suggested: suggestion.candidates.length,
        candidates: suggestion.candidates,
        groundingSources: suggestion.sources,
        applied: applyResults.filter((result) => result.status === "applied").length,
        partial: applyResults.filter((result) => result.status === "partial").length,
        rejected: applyResults.filter((result) => result.status === "rejected").length,
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

    // HTML: /admin/animal-images
    if (pathname === "/admin/animal-images") {
      const query = normalizeSearchTerm(url.searchParams.get("q"));
      const imageStatus = url.searchParams.get("image");
      const imageError = normalizeOptionalText(url.searchParams.get("message"));
      const notice =
        imageStatus === "generated"
          ? "画像を生成して使用中にしました。"
          : imageStatus === "selected"
            ? "使用する画像を変更しました。"
            : imageStatus === "missing-key"
              ? "GEMINI_API_KEY が設定されていないため、画像生成を実行できません。"
              : imageStatus === "select-error"
                ? "指定した画像を選択できませんでした。"
                : imageStatus === "error"
                  ? `画像生成でエラーが発生しました。${imageError ? ` ${imageError}` : ""}`
                  : undefined;
      const items = await loadAnimalImageManageItems(env.DB, query);
      const html = renderAnimalImageManageListHtml(items, query, notice);
      return htmlResponse(html, url, activePref);
    }

    // HTML form: generate image for one animal from the list
    if (pathname === "/admin/animal-images/generate") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "POST を使用してください" }, 405);
      }
      const formData = await request.formData();
      const displayName = normalizeOptionalText(formData.get("displayName"));
      const redirectTo = (status: string, name: string | null = displayName, message?: string) => {
        const destination = new URL("/admin/animal-images", url.origin);
        if (name) {
          destination.searchParams.set("q", name);
          destination.hash = buildAnimalImageItemId(normalizeAnimalImageKey(name));
        }
        destination.searchParams.set("image", status);
        if (message) {
          destination.searchParams.set("message", message.slice(0, 180));
        }
        const href = `${destination.pathname}${destination.search}${destination.hash}`;
        return Response.redirect(
          `${url.origin}${addPrefectureToInternalUrl(href, activePref)}`,
          303
        );
      };
      if (!displayName) return redirectTo("error", null);
      if (!env.GEMINI_API_KEY) return redirectTo("missing-key");
      try {
        const customModel = normalizeOptionalText(formData.get("customModel"));
        const selectedModel = normalizeOptionalText(formData.get("model"));
        const model = customModel ?? selectedModel ?? GEMINI_IMAGE_MODEL;
        const generated = await generateAnimalImageWithGemini(env.GEMINI_API_KEY, displayName, model);
        const saved = await saveAnimalImage(
          env.DB,
          displayName,
          generated.prompt,
          model,
          generated.mimeType,
          generated.imageBase64
        );
        await env.IMAGES.put(saved.animalKey, base64ToUint8Array(saved.imageBase64), {
          httpMetadata: { contentType: saved.mimeType },
        });
        return redirectTo("generated");
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);
        return redirectTo("error", displayName, message);
      }
    }

    // HTML form: select an existing generated image from the list
    if (pathname === "/admin/animal-images/select") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "POST を使用してください" }, 405);
      }
      const formData = await request.formData();
      const displayName = normalizeOptionalText(formData.get("displayName"));
      const generationId = Number(formData.get("generationId"));
      const selected = displayName && Number.isFinite(generationId)
        ? await selectAnimalImageGeneration(env.DB, displayName, Math.floor(generationId))
        : null;
      if (selected) {
        await env.IMAGES.put(selected.animalKey, base64ToUint8Array(selected.imageBase64), {
          httpMetadata: { contentType: selected.mimeType },
        });
      }
      const status = selected ? "selected" : "select-error";
      const destination = new URL("/admin/animal-images", url.origin);
      if (displayName) {
        destination.searchParams.set("q", displayName);
        destination.hash = buildAnimalImageItemId(normalizeAnimalImageKey(displayName));
      }
      destination.searchParams.set("image", status);
      const href = `${destination.pathname}${destination.search}${destination.hash}`;
      return Response.redirect(`${url.origin}${addPrefectureToInternalUrl(href, activePref)}`, 303);
    }

    // HTML: /admin/animal-images/manage/:displayName
    const animalImageManageMatch = pathname.match(/^\/admin\/animal-images\/manage\/(.+)$/);
    if (animalImageManageMatch) {
      const displayName = decodeURIComponent(animalImageManageMatch[1]);
      const destination = new URL("/admin/animal-images", url.origin);
      destination.searchParams.set("q", displayName);
      destination.hash = buildAnimalImageItemId(normalizeAnimalImageKey(displayName));
      return Response.redirect(destination.toString(), 301);
    }

    // Image: generated image history
    const animalImageGenerationMatch = pathname.match(/^\/admin\/animal-image-generations\/(\d+)$/);
    if (animalImageGenerationMatch) {
      const generation = await loadAnimalImageGenerationById(env.DB, Number(animalImageGenerationMatch[1]));
      if (!generation) return notFound(`生成画像 '${animalImageGenerationMatch[1]}' が見つかりません`);
      return new Response(base64ToUint8Array(generation.imageBase64), {
        headers: {
          "Content-Type": generation.mimeType,
          "Cache-Control": "public, max-age=86400",
          "X-Animal-Image-Key": generation.animalKey,
        },
      });
    }

    // Image: /animal-images/:displayName
    const animalImageMatch = pathname.match(/^\/animal-images\/(.+)$/);
    if (animalImageMatch) {
      const cached = await caches.default.match(request);
      if (cached) return cached;

      const displayName = decodeURIComponent(animalImageMatch[1]);
      const image = await loadAnimalImage(env.DB, displayName);
      if (!image) return notFound(`動物画像 '${displayName}' が見つかりません`);
      const r2Object = await env.IMAGES.get(image.animalKey);
      if (r2Object) {
        return cacheResponse(
          request,
          buildAnimalImageResponse(
            r2Object.body,
            {
              "Content-Type": r2Object.httpMetadata?.contentType ?? image.mimeType,
              "X-Animal-Image-Key": image.animalKey,
            },
            url
          ),
          ctx
        );
      }
      return cacheResponse(
        request,
        buildAnimalImageResponse(
          base64ToUint8Array(image.imageBase64),
          {
            "Content-Type": image.mimeType,
            "X-Animal-Image-Key": image.animalKey,
          },
          url
        ),
        ctx
      );
    }

    // JSON API: generate shared animal images
    if (pathname === "/api/animal-images/generate") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "POST を使用してください" }, 405);
      }
      if (!env.GEMINI_API_KEY) {
        return jsonResponse({ error: "GEMINI_API_KEY が設定されていません" }, 500);
      }

      const body = (await request.json().catch(() => ({}))) as {
        names?: unknown;
        limit?: unknown;
        missingOnly?: unknown;
        missingModelOnly?: unknown;
        excludeNames?: unknown;
        model?: unknown;
      };
      const requestedNames = Array.isArray(body.names)
        ? body.names.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
      const excludedNames = Array.isArray(body.excludeNames)
        ? body.excludeNames.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
      const limit =
        typeof body.limit === "number" && Number.isFinite(body.limit)
          ? Math.max(1, Math.min(10, Math.floor(body.limit)))
          : 5;
      const missingOnly = body.missingOnly !== false;
      const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : GEMINI_IMAGE_MODEL;
      const missingModel = body.missingModelOnly === true ? model : undefined;
      const displayNames = await loadAnimalImageGenerationNames(
        env.DB,
        limit,
        [...new Set(requestedNames.map((name) => name.trim()))],
        missingOnly,
        missingModel,
        [...new Set(excludedNames.map((name) => name.trim()))]
      );

      const images: Array<{
        displayName: string;
        animalKey: string;
        generationId?: number;
        imageUrl: string;
        mimeType: string;
      }> = [];
      const errors: Array<{ displayName: string; error: string }> = [];
      for (const displayName of displayNames) {
        try {
          const generated = await generateAnimalImageWithGemini(env.GEMINI_API_KEY, displayName, model);
          const saved = await saveAnimalImage(
            env.DB,
            displayName,
            generated.prompt,
            model,
            generated.mimeType,
            generated.imageBase64
          );
          await env.IMAGES.put(saved.animalKey, base64ToUint8Array(saved.imageBase64), {
            httpMetadata: { contentType: saved.mimeType },
          });
          images.push({
            displayName: saved.displayName,
            animalKey: saved.animalKey,
            generationId: saved.selectedGenerationId,
            imageUrl: `/animal-images/${encodeURIComponent(saved.displayName)}`,
            mimeType: saved.mimeType,
          });
        } catch (error) {
          errors.push({
            displayName,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return jsonResponse({
        requested: displayNames.length,
        generated: images.length,
        images,
        errors,
      });
    }

    // HTML: /admin
    if (pathname === "/admin") {
      return htmlResponse(renderAdminTopHtml(), url, activePref);
    }

    // HTML: /admin/scrape-health
    if (pathname === "/admin/scrape-health") {
      const items = await loadScrapeHealth(env.DB);
      return htmlResponse(renderScrapeHealthAdminHtml(items), url, activePref);
    }

    // HTML: /admin/animal-taxonomy
    if (pathname === "/admin/animal-taxonomy") {
      const animals = await loadAnimalsForTaxonomy(env.DB);
      const html = renderAnimalTaxonomyAdminHtml(animals);
      return htmlResponse(html, url, activePref);
    }

    // HTML: /animals
    if (pathname === "/animals") {
      const filter: AnimalListFilter =
        url.searchParams.get("filter") === "unclassified" ? "unclassified" : "all";
      const [animals, imageKeys] = await Promise.all([
        loadAnimalList(env.DB, filter, activePref),
        loadAnimalImageKeys(env.DB),
      ]);
      const html = renderAnimalsHtml(animals, filter, activePref, imageKeys);
      return htmlResponse(html, url, activePref);
    }

    // HTML: /animal/:displayName
    const animalClassifyMatch = pathname.match(/^\/animal\/(.+)\/classify$/);
    if (animalClassifyMatch) {
      if (request.method !== "POST") {
        return jsonResponse({ error: "POST を使用してください" }, 405);
      }
      const displayName = decodeURIComponent(animalClassifyMatch[1]);
      const detail = await loadZooAnimalDetail(env.DB, displayName, activePref);
      if (!detail) return notFound(`動物 '${displayName}' が見つかりません`);
      const redirectTo = (status: string) =>
        Response.redirect(
          `${url.origin}${addPrefectureToInternalUrl(
            `${buildZooAnimalUrl(displayName)}?llm=${encodeURIComponent(status)}`,
            activePref
          )}`,
          303
        );

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
      const [detail, image] = await Promise.all([
        loadZooAnimalDetail(env.DB, displayName, activePref),
        loadAnimalImage(env.DB, displayName),
      ]);
      if (!detail) return notFound(`動物 '${displayName}' が見つかりません`);
      const [relatedAnimals, imageKeys] = await Promise.all([
        loadRelatedAnimals(env.DB, detail),
        loadAnimalImageKeys(env.DB),
      ]);
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
      const html = renderZooAnimalDetailHtml(detail, notice, image ?? undefined, relatedAnimals, imageKeys);
      return htmlResponse(html, url, activePref);
    }

    // HTML: /taxonomy
    if (pathname === "/taxonomy") {
      const [sections, tree] = await Promise.all([
        loadTaxonomyOverview(env.DB, activePref),
        loadTaxonomyTree(env.DB, activePref),
      ]);
      const html = renderTaxonomyHtml(sections, tree, activePref);
      return htmlResponse(html, url, activePref);
    }

    // HTML: /taxonomy/:rank/:value
    const taxonomyPageMatch = pathname.match(/^\/taxonomy\/([^/]+)\/([^/]+)$/);
    if (taxonomyPageMatch) {
      const rank = getTaxonomyRank(taxonomyPageMatch[1]);
      if (rank) {
        const value = decodeURIComponent(taxonomyPageMatch[2]);
        const canonicalPath = await resolveLegacyTaxonomyPath(env.DB, rank, value, activePref);
        if (!canonicalPath) return notFound(`分類 '${value}' に該当する動物が見つかりません`);
        const destination = new URL(buildTaxonomyPathUrl(canonicalPath), url.origin);
        if (activePref) destination.searchParams.set("pref", activePref);
        return Response.redirect(destination.toString(), 301);
      }
    }

    // HTML: /taxonomy/:class/:order?/:family?/:genus?/:species?
    if (pathname.startsWith("/taxonomy/")) {
      const levels = parseTaxonomyPath(pathname);
      if (!levels) return notFound("分類 URL が無効です");
      const [childSection, animals, imageKeys] = await Promise.all([
        loadChildTaxonomyValues(env.DB, levels, activePref),
        loadTaxonomyAnimals(env.DB, levels, activePref),
        loadAnimalImageKeys(env.DB),
      ]);
      if (animals.length === 0) {
        return notFound(`分類 '${levels.at(-1)?.value ?? ""}' に該当する動物が見つかりません`);
      }
      const html = renderTaxonomyDetailHtml(levels, childSection, animals, imageKeys);
      return htmlResponse(html, url, activePref);
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
      if (!zoo || (activePref && zoo.prefecture !== activePref)) {
        return notFound(`選択中の地域に動物園 '${id}' が見つかりません`);
      }
      const destination = new URL(`/zoos/${encodeURIComponent(id)}`, url.origin);
      if (activePref) destination.searchParams.set("pref", activePref);
      destination.hash = "animals";
      return Response.redirect(destination.toString(), 301);
    }

    // HTML: /zoos/:id
    const zooPageMatch = pathname.match(/^\/zoos\/([^/]+)$/);
    if (zooPageMatch) {
      const id = zooPageMatch[1];
      const zoo = zoos.find((z) => z.id === id);
      if (!zoo || (activePref && zoo.prefecture !== activePref)) {
        return notFound(`選択中の地域に動物園 '${id}' が見つかりません`);
      }
      const [scraped, coverage, imageKeys, taxonomyByAnimal] = await Promise.all([
        getAnimalResult(env.DB, id, url.searchParams.get("refresh") === "1"),
        loadZooCoverage(env.DB, id),
        loadAnimalImageKeys(env.DB),
        loadZooAnimalTaxonomyIndex(env.DB, id),
      ]);
      const html = renderZooDetailHtml(zoo, scraped, coverage, imageKeys, taxonomyByAnimal);
      return htmlResponse(html, url, activePref);
    }

    // HTML: /map
    // HTML: /compare
    if (pathname === "/compare") {
      const paramKeys = ["a", "b", "c"];
      const selectedZoos = paramKeys
        .map((k) => url.searchParams.get(k) ?? "")
        .map((id) => zoos.find((z) => z.id === id) ?? null)
        .filter((z): z is Zoo => z !== null);
      if (selectedZoos.length >= 2) {
        const [animalLists, animalCounts] = await Promise.all([
          Promise.all(selectedZoos.map((z) => loadZooAnimalsForCompare(env.DB, z.id))),
          loadZooAnimalCounts(env.DB, zoos.map((z) => z.id)),
        ]);
        const selected = selectedZoos.map((zoo, i) => ({ zoo, animals: animalLists[i] }));
        return htmlResponse(renderCompareHtml(selected, animalCounts), url, activePref);
      }
      const [countRows, animalCounts] = await Promise.all([
        loadTaxonomyCountsByZoo(env.DB),
        loadZooAnimalCounts(env.DB, zoos.map((z) => z.id)),
      ]);
      return htmlResponse(renderCompareIndexHtml(countRows, animalCounts), url, activePref);
    }

    if (pathname === "/map") {
      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      const taxClass = url.searchParams.get("cls") ?? null;
      const results = taxClass && !animal
        ? await searchZoosByTaxonomyClass(env.DB, activePref, taxClass)
        : await searchZoos(env.DB, activePref, animal);
      const html = renderMapHtml(results, activePref, animal, animal ? null : taxClass);
      return htmlResponse(html, url, activePref);
    }

    // HTML: /
    if (pathname === "/") {
      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      const results = await searchZoos(env.DB, activePref, animal);
      const html = renderHtml(results, activePref, animal);
      return htmlResponse(html, url, activePref);
    }

    return notFound("ページが見つかりません");
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refreshAllAnimalCache(env.DB));
  },
};
