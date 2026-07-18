import type { PrefectureCode, Zoo } from "./types";
import { zoos } from "./data";
import { findAnimalTaxonomy, type AnimalTaxonomy } from "./animal-taxonomy";
import type { ScrapeResult } from "./scraper";
import { scrapeAnimals } from "./scraper";
import {
  PREF_CODES,
  PREF_LABELS,
  addPrefectureToInternalUrl,
  buildAnimalImageItemId,
  buildCanonicalUrl,
  buildTaxonomyPathUrl,
  buildZooAnimalUrl,
  escapeHtml,
  isPrefectureCode,
  normalizeAnimalImageKey,
  renderHeaderSearch,
  renderPrefectureSelector,
} from "./pages/layout";
import { renderHomePage, renderZoosPage } from "./pages/home";
import { renderSearchHtml } from "./pages/search";
import { renderAnimalsHtml } from "./pages/animals";
import { renderZooAnimalDetailHtml } from "./pages/animal-detail";
import { renderTaxonomyHtml, renderTaxonomyDetailHtml } from "./pages/taxonomy";
import { renderZooDetailHtml } from "./pages/zoo-detail";
import { renderCompareIndexHtml, renderCompareHtml } from "./pages/compare";
import { renderMapHtml } from "./pages/map";
import { FAVORITES_JS, renderFavoritesHtml } from "./pages/favorites";
import {
  renderAdminTopHtml,
  renderAnimalImageManageDetailHtml,
  renderAnimalImageManageListHtml,
  renderAnimalTaxonomyAdminHtml,
  renderScrapeHealthAdminHtml,
  renderScrapeHistoryAdminHtml,
} from "./pages/admin";

export interface ZooSearchResult {
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

export interface AnimalListItem {
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

export interface SiteSearchResults {
  query: string | null;
  animals: AnimalListItem[];
  zoos: ZooSearchResult[];
  taxonomies: TaxonomySearchResult[];
}

type ClassificationStatus = "registered" | "llm_candidate" | "unclassified" | "rejected";

export interface ZooAnimalDetail {
  displayName: string;
  animalId?: string;
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

export interface ZooCoverageStats {
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

export interface ScrapeHealthItem {
  zoo: Zoo;
  scrapedAt: string | null;
  error: string | null;
  animalCount: number;
  warningCount: number;
  warningMessages: string[];
  addedCount: number;
  removedCount: number;
  renamedCount: number;
}

export interface ScrapeHistoryItem {
  zooId: string;
  zooName: string;
  scrapedAt: string;
  error: string | null;
  animalCount: number;
  addedCount: number;
  removedCount: number;
  renamedCount: number;
  warningCount: number;
  warningMessages: string[];
  addedNames: string[];
  removedNames: string[];
  renamedPairs: Array<{ previous: string; current: string }>;
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

export interface AnimalImageRecord {
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

export interface AnimalImageGenerationRecord {
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

export interface AnimalImageManageItem {
  displayName: string;
  animalKey: string;
  selectedGenerationId: number | null;
  generationCount: number;
  updatedAt: string | null;
  generations: AnimalImageGenerationSummary[];
}

export interface AnimalImageGenerationSummary {
  id: number;
  animalKey: string;
  model: string;
  createdAt: string;
  selected: boolean;
}

export type TaxonomyRank = "class" | "order" | "family" | "genus" | "species";
export type AnimalListFilter = "all" | "unclassified";
export type AnimalImageVersionIndex = Map<string, number | null>;

export interface FeaturedAnimal {
  displayName: string;
  imageVersion: number | null;
  zooCount: number;
}

export interface TaxonomyRankConfig {
  key: TaxonomyRank;
  label: string;
  column: "class_name" | "order_name" | "family_name" | "genus_name" | "species_name";
}

export interface TaxonomyValueRow {
  name: string;
  animal_count: number;
  zoo_count: number;
}

export interface TaxonomyOverviewSection extends TaxonomyRankConfig {
  values: TaxonomyValueRow[];
}

export interface TaxonomyTreeNode {
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

export interface TaxonomyPathLevel {
  rank: TaxonomyRankConfig;
  value: string;
}

export interface TaxonomySearchResult {
  rank: TaxonomyRankConfig;
  name: string;
  href: string;
  animalCount: number;
  zooCount: number;
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

function normalizeTextForSearchIndex(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[ぁ-ん]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60))
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s　・･]/g, "");
}

function matchesSearchQuery(values: Array<string | null | undefined>, query: string): boolean {
  const normalizedQuery = normalizeTextForSearchIndex(query);
  if (!normalizedQuery) return false;
  return values.some((value) => value ? normalizeTextForSearchIndex(value).includes(normalizedQuery) : false);
}

function normalizeAnimalNameForSearch(value: string): string {
  return value.toLocaleLowerCase("ja-JP");
}

function normalizeAnimalNameForDiff(value: string): string {
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
  const [scrapeRows, countRows, warningRows, diffRows] = await Promise.all([
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
    db
      .prepare(
        `SELECT
           d.zoo_id,
           SUM(CASE WHEN d.diff_type = 'added' THEN 1 ELSE 0 END) AS added_count,
           SUM(CASE WHEN d.diff_type = 'removed' THEN 1 ELSE 0 END) AS removed_count,
           SUM(CASE WHEN d.diff_type = 'renamed' THEN 1 ELSE 0 END) AS renamed_count
         FROM animal_scrape_diffs d
         JOIN animal_scrape_results r
           ON r.zoo_id = d.zoo_id
          AND r.scraped_at = d.scraped_at
         WHERE d.zoo_id IN (${buildPlaceholders(zooIds)})
         GROUP BY d.zoo_id`
      )
      .bind(...zooIds)
      .all<{ zoo_id: string; added_count: number; removed_count: number; renamed_count: number }>(),
  ]);

  const scrapeByZoo = new Map((scrapeRows.results ?? []).map((row) => [row.zoo_id, row]));
  const countsByZoo = new Map((countRows.results ?? []).map((row) => [row.zoo_id, row.animal_count]));
  const warningsByZoo = new Map((warningRows.results ?? []).map((row) => [row.zoo_id, row]));
  const diffsByZoo = new Map((diffRows.results ?? []).map((row) => [row.zoo_id, row]));

  return zoos.map((zoo) => {
    const scrape = scrapeByZoo.get(zoo.id);
    const warnings = warningsByZoo.get(zoo.id);
    const diffs = diffsByZoo.get(zoo.id);
    return {
      zoo,
      scrapedAt: scrape?.scraped_at ?? null,
      error: scrape?.error ?? null,
      animalCount: countsByZoo.get(zoo.id) ?? 0,
      warningCount: warnings?.warning_count ?? 0,
      warningMessages: warnings?.warning_messages?.split("\n").filter(Boolean) ?? [],
      addedCount: diffs?.added_count ?? 0,
      removedCount: diffs?.removed_count ?? 0,
      renamedCount: diffs?.renamed_count ?? 0,
    };
  });
}

async function loadScrapeHistory(db: D1Database, limit: number): Promise<ScrapeHistoryItem[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const [scrapeRows, diffRows, warningRows] = await Promise.all([
    db
      .prepare(
        `WITH runs AS (
           SELECT zoo_id, scraped_at FROM animal_scrape_results
           UNION
           SELECT zoo_id, scraped_at FROM animal_scrape_diffs
           UNION
           SELECT zoo_id, scraped_at FROM animal_scrape_warnings
         )
         SELECT
           runs.zoo_id,
           runs.scraped_at,
           r.error,
           COUNT(DISTINCT za.display_name) AS animal_count
         FROM runs
         LEFT JOIN animal_scrape_results r
           ON r.zoo_id = runs.zoo_id
          AND r.scraped_at = runs.scraped_at
         LEFT JOIN zoo_animals za
           ON za.zoo_id = runs.zoo_id
          AND r.scraped_at = runs.scraped_at
         GROUP BY runs.zoo_id, runs.scraped_at, r.error
         ORDER BY runs.scraped_at DESC
         LIMIT ?`
      )
      .bind(safeLimit)
      .all<{ zoo_id: string; scraped_at: string; error: string | null; animal_count: number }>(),
    db
      .prepare(
        `SELECT zoo_id, scraped_at, diff_type, previous_display_name, current_display_name
         FROM animal_scrape_diffs
         WHERE scraped_at IN (
           SELECT scraped_at
           FROM (
             SELECT scraped_at FROM animal_scrape_results
             UNION
             SELECT scraped_at FROM animal_scrape_diffs
             UNION
             SELECT scraped_at FROM animal_scrape_warnings
           )
           ORDER BY scraped_at DESC
           LIMIT ?
         )
         ORDER BY id`
      )
      .bind(safeLimit)
      .all<{
        zoo_id: string;
        scraped_at: string;
        diff_type: ScrapeDiffType;
        previous_display_name: string | null;
        current_display_name: string | null;
      }>(),
    db
      .prepare(
        `SELECT zoo_id, scraped_at, message, current_count
         FROM animal_scrape_warnings
         WHERE scraped_at IN (
           SELECT scraped_at
           FROM (
             SELECT scraped_at FROM animal_scrape_results
             UNION
             SELECT scraped_at FROM animal_scrape_diffs
             UNION
             SELECT scraped_at FROM animal_scrape_warnings
           )
           ORDER BY scraped_at DESC
           LIMIT ?
         )
         ORDER BY id`
      )
      .bind(safeLimit)
      .all<{ zoo_id: string; scraped_at: string; message: string; current_count: number }>(),
  ]);

  const zooById = new Map(zoos.map((zoo) => [zoo.id, zoo]));
  const keyFor = (zooId: string, scrapedAt: string) => `${zooId}\n${scrapedAt}`;
  const diffsByRun = new Map<string, NonNullable<typeof diffRows.results>>();
  for (const row of diffRows.results ?? []) {
    const key = keyFor(row.zoo_id, row.scraped_at);
    const rows = diffsByRun.get(key) ?? [];
    rows.push(row);
    diffsByRun.set(key, rows);
  }

  const warningsByRun = new Map<string, string[]>();
  const warningCountsByRun = new Map<string, number>();
  for (const row of warningRows.results ?? []) {
    const key = keyFor(row.zoo_id, row.scraped_at);
    const messages = warningsByRun.get(key) ?? [];
    messages.push(row.message);
    warningsByRun.set(key, messages);
    warningCountsByRun.set(key, Math.max(warningCountsByRun.get(key) ?? 0, row.current_count));
  }

  return (scrapeRows.results ?? []).map((row) => {
    const key = keyFor(row.zoo_id, row.scraped_at);
    const diffs = diffsByRun.get(key) ?? [];
    return {
      zooId: row.zoo_id,
      zooName: zooById.get(row.zoo_id)?.name ?? row.zoo_id,
      scrapedAt: row.scraped_at,
      error: row.error,
      animalCount: row.animal_count || warningCountsByRun.get(key) || 0,
      addedCount: diffs.filter((diff) => diff.diff_type === "added").length,
      removedCount: diffs.filter((diff) => diff.diff_type === "removed").length,
      renamedCount: diffs.filter((diff) => diff.diff_type === "renamed").length,
      warningCount: warningsByRun.get(key)?.length ?? 0,
      warningMessages: warningsByRun.get(key) ?? [],
      addedNames: diffs
        .filter((diff) => diff.diff_type === "added" && diff.current_display_name)
        .map((diff) => diff.current_display_name as string),
      removedNames: diffs
        .filter((diff) => diff.diff_type === "removed" && diff.previous_display_name)
        .map((diff) => diff.previous_display_name as string),
      renamedPairs: diffs
        .filter((diff) => diff.diff_type === "renamed" && diff.previous_display_name && diff.current_display_name)
        .map((diff) => ({
          previous: diff.previous_display_name as string,
          current: diff.current_display_name as string,
        })),
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

function filterAnimalItemsByQuery(animals: AnimalListItem[], query: string | null): AnimalListItem[] {
  if (!query) return animals;
  return animals.filter((animal) =>
    matchesSearchQuery([
      animal.canonicalName,
      ...animal.displayNames,
      animal.className,
      animal.orderName,
      animal.familyName,
      animal.genusName,
      animal.speciesName,
      ...animal.zoos.flatMap((zoo) => [zoo.name, zoo.nameKana, PREF_LABELS[zoo.prefecture]]),
    ], query)
  );
}

async function loadSearchAnimalMatches(
  db: D1Database,
  zooIds: string[],
  query: string
): Promise<Map<string, string[]>> {
  if (zooIds.length === 0) return new Map();

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
        AND c.status IN ('partial', 'pending', 'applied')
        AND c.confidence >= 0.8
       WHERE za.zoo_id IN (${buildPlaceholders(zooIds)})
       ORDER BY za.zoo_id, za.display_name`
    )
    .bind(...zooIds)
    .all<AnimalListRow>();

  const matches = new Map<string, string[]>();
  for (const row of result.results ?? []) {
    if (!matchesSearchQuery([
      row.display_name,
      row.canonical_name,
      row.class_name,
      row.order_name,
      row.family_name,
      row.genus_name,
      row.species_name,
    ], query)) {
      continue;
    }
    const animals = matches.get(row.zoo_id) ?? [];
    if (!animals.includes(row.display_name)) animals.push(row.display_name);
    matches.set(row.zoo_id, animals);
  }
  return matches;
}

async function loadTaxonomySearchResults(
  db: D1Database,
  pref: PrefectureCode | null,
  query: string
): Promise<TaxonomySearchResult[]> {
  const zooIds = getZooIdsForPrefecture(pref);
  const where = pref ? `WHERE za.zoo_id IN (${buildPlaceholders(zooIds)})` : "";
  const result = await db
    .prepare(
      `SELECT
         a.class_name,
         a.order_name,
         a.family_name,
         a.genus_name,
         a.species_name,
         COUNT(DISTINCT a.id) AS animal_count,
         COUNT(DISTINCT za.zoo_id) AS zoo_count
       FROM animals a
       JOIN zoo_animals za ON za.animal_id = a.id
       ${where}
       GROUP BY a.class_name, a.order_name, a.family_name, a.genus_name, a.species_name
       ORDER BY a.class_name, a.order_name, a.family_name, a.genus_name, a.species_name`
    )
    .bind(...(pref ? zooIds : []))
    .all<{
      class_name: string;
      order_name: string;
      family_name: string;
      genus_name: string;
      species_name: string;
      animal_count: number;
      zoo_count: number;
    }>();

  const byKey = new Map<string, TaxonomySearchResult>();
  for (const row of result.results ?? []) {
    const values = [row.class_name, row.order_name, row.family_name, row.genus_name, row.species_name];
    for (let index = 0; index < TAXONOMY_RANKS.length; index += 1) {
      const value = values[index];
      const pathValues = values.slice(0, index + 1);
      if (!matchesSearchQuery([value], query)) continue;
      const rank = TAXONOMY_RANKS[index];
      const key = `${rank.key}:${value}:${pathValues.join("/")}`;
      if (byKey.has(key)) continue;
      byKey.set(key, {
        rank,
        name: value,
        href: buildTaxonomyPathUrl(pathValues),
        animalCount: row.animal_count,
        zooCount: row.zoo_count,
      });
    }
  }

  return [...byKey.values()].sort((a, b) => {
    const rankDiff = TAXONOMY_RANKS.findIndex((rank) => rank.key === a.rank.key) -
      TAXONOMY_RANKS.findIndex((rank) => rank.key === b.rank.key);
    return rankDiff || a.name.localeCompare(b.name, "ja");
  });
}

async function searchSite(
  db: D1Database,
  pref: PrefectureCode | null,
  query: string | null
): Promise<SiteSearchResults> {
  if (!query) return { query, animals: [], zoos: [], taxonomies: [] };

  const prefFilteredZoos = zoos.filter((zoo) => !pref || zoo.prefecture === pref);
  const zooIds = prefFilteredZoos.map((zoo) => zoo.id);
  const [allAnimals, animalCounts, zooAnimalMatches, taxonomies] = await Promise.all([
    loadAnimalList(db, "all", pref),
    loadZooAnimalCounts(db, zooIds),
    loadSearchAnimalMatches(db, zooIds, query),
    loadTaxonomySearchResults(db, pref, query),
  ]);

  const animals = filterAnimalItemsByQuery(allAnimals, query);

  const zooResults = prefFilteredZoos.flatMap((zoo) => {
    const matchedAnimals = zooAnimalMatches.get(zoo.id) ?? [];
    const matchedFeatures = [
      matchesSearchQuery([zoo.name, zoo.nameKana], query) ? "施設名" : null,
      matchesSearchQuery([PREF_LABELS[zoo.prefecture]], query) ? PREF_LABELS[zoo.prefecture] : null,
      matchesSearchQuery([zoo.address], query) ? "住所" : null,
      matchesSearchQuery([zoo.openingHours, zoo.closedDays, zoo.admission], query) ? "基本情報" : null,
    ].filter((value): value is string => Boolean(value));

    if (matchedAnimals.length === 0 && matchedFeatures.length === 0) return [];
    return [{
      zoo,
      matchedAnimals,
      matchedFeatures,
      animalCount: animalCounts.get(zoo.id) ?? 0,
      animalSearchAvailable: true,
    }];
  });

  return { query, animals, zoos: zooResults, taxonomies };
}

async function loadAnimalImageKeys(db: D1Database): Promise<AnimalImageVersionIndex> {
  const result = await db
    .prepare("SELECT animal_key, selected_generation_id FROM animal_images")
    .all<{ animal_key: string; selected_generation_id: number | null }>();
  return new Map((result.results ?? []).map((r) => [r.animal_key, r.selected_generation_id]));
}

async function loadFeaturedAnimals(
  db: D1Database,
  pref: PrefectureCode | null,
  limit = 6
): Promise<FeaturedAnimal[]> {
  const zooIds = getZooIdsForPrefecture(pref);
  const prefFilter = pref ? `AND za.zoo_id IN (${buildPlaceholders(zooIds)})` : "";
  const result = await db
    .prepare(
      `SELECT
         ai.animal_key,
         ai.selected_generation_id,
         ai.display_name,
         COUNT(DISTINCT za.zoo_id) AS zoo_count
       FROM animal_images ai
       INNER JOIN zoo_animals za ON za.normalized_display_name = ai.animal_key
       WHERE ai.selected_generation_id IS NOT NULL
         ${prefFilter}
       GROUP BY ai.animal_key
       ORDER BY COUNT(DISTINCT za.zoo_id) DESC, ai.animal_key
       LIMIT ?`
    )
    .bind(...(pref ? zooIds : []), limit)
    .all<{ animal_key: string; selected_generation_id: number | null; display_name: string; zoo_count: number }>();

  return (result.results ?? []).map((row) => ({
    displayName: row.display_name,
    imageVersion: row.selected_generation_id,
    zooCount: row.zoo_count,
  }));
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

export interface AnimalTaxonomyRow {
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
    animalId: taxonomicRow.animal_id ?? undefined,
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

async function loadRelatedDisplayNames(
  db: D1Database,
  detail: ZooAnimalDetail,
  pref: PrefectureCode | null = null
): Promise<Array<{ displayName: string; zoos: Zoo[] }>> {
  const zooIds = getZooIdsForPrefecture(pref);
  const zooFilter = pref ? `AND za.zoo_id IN (${buildPlaceholders(zooIds)})` : "";
  const result = await db
    .prepare(
      `SELECT za.display_name, za.zoo_id
       FROM zoo_animals za
       WHERE za.animal_id IN (
         SELECT animal_id
         FROM zoo_animals
         WHERE display_name = ?
           AND animal_id IS NOT NULL
       )
         AND za.display_name != ?
         ${zooFilter}
       ORDER BY za.display_name, za.zoo_id`
    )
    .bind(detail.displayName, detail.displayName, ...(pref ? zooIds : []))
    .all<{ display_name: string; zoo_id: string }>();

  const zooById = new Map(zoos.map((zoo) => [zoo.id, zoo]));
  const byName = new Map<string, Zoo[]>();
  for (const row of result.results ?? []) {
    const zoo = zooById.get(row.zoo_id);
    if (!zoo) continue;
    const list = byName.get(row.display_name) ?? [];
    if (!list.some((existing) => existing.id === zoo.id)) list.push(zoo);
    byName.set(row.display_name, list);
  }

  return [...byName.entries()].map(([displayName, matchedZoos]) => ({ displayName, zoos: matchedZoos }));
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
         ${detail.animalId ? "AND (za.animal_id IS NULL OR za.animal_id != ?)" : ""}
       ORDER BY COALESCE(a.sort_key, a.normalized_name, za.sort_key, za.normalized_display_name), za.display_name, za.zoo_id`
    )
    .bind(filterValue, detail.displayName, ...(detail.animalId ? [detail.animalId] : []))
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

function htmlResponse(html: string, url: URL, activePref: PrefectureCode | null): Response {
  const canonicalUrl = escapeHtml(buildCanonicalUrl(url));
  let rewriter = new HTMLRewriter()
    .on("head", {
      element(element) {
        element.prepend(`<link rel="canonical" href="${canonicalUrl}">`, { html: true });
      },
    })
    .on(".site-header", {
      element(element) {
        element.append(renderHeaderSearch(url, activePref), { html: true });
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

    // Static: /favorites.js
    if (pathname === "/favorites.js") {
      return new Response(FAVORITES_JS, {
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

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

    // HTML: /admin/scrape-history
    if (pathname === "/admin/scrape-history") {
      const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "30", 10);
      const items = await loadScrapeHistory(env.DB, Number.isFinite(limitParam) ? limitParam : 30);
      return htmlResponse(renderScrapeHistoryAdminHtml(items), url, activePref);
    }

    // HTML: /admin/animal-taxonomy
    if (pathname === "/admin/animal-taxonomy") {
      const animals = await loadAnimalsForTaxonomy(env.DB);
      const html = renderAnimalTaxonomyAdminHtml(animals);
      return htmlResponse(html, url, activePref);
    }

    // HTML: /search
    if (pathname === "/search") {
      const query = normalizeSearchTerm(url.searchParams.get("q"));
      const [results, imageKeys] = await Promise.all([
        searchSite(env.DB, activePref, query),
        loadAnimalImageKeys(env.DB),
      ]);
      const html = renderSearchHtml(results, activePref, imageKeys);
      return htmlResponse(html, url, activePref);
    }

    // HTML: /animals
    if (pathname === "/animals") {
      const filter: AnimalListFilter =
        url.searchParams.get("filter") === "unclassified" ? "unclassified" : "all";
      const query = normalizeSearchTerm(url.searchParams.get("q"));
      const [animals, imageKeys] = await Promise.all([
        loadAnimalList(env.DB, filter, activePref),
        loadAnimalImageKeys(env.DB),
      ]);
      const filteredAnimals = filterAnimalItemsByQuery(animals, query);
      const html = renderAnimalsHtml(filteredAnimals, filter, activePref, imageKeys, query);
      return htmlResponse(html, url, activePref);
    }

    // HTML: /zoos
    if (pathname === "/zoos") {
      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      const results = await searchZoos(env.DB, activePref, animal);
      const html = renderZoosPage(results, activePref, animal);
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
      const [relatedAnimals, relatedDisplayNames, imageKeys] = await Promise.all([
        loadRelatedAnimals(env.DB, detail),
        loadRelatedDisplayNames(env.DB, detail, activePref),
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
      const html = renderZooAnimalDetailHtml(
        detail,
        notice,
        image ?? undefined,
        relatedAnimals,
        relatedDisplayNames,
        imageKeys
      );
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
      const latParam = parseFloat(url.searchParams.get("lat") ?? "");
      const lonParam = parseFloat(url.searchParams.get("lon") ?? "");
      const zoomParam = parseFloat(url.searchParams.get("z") ?? "");
      const initialLat = isFinite(latParam) ? latParam : null;
      const initialLon = isFinite(lonParam) ? lonParam : null;
      const initialZoom = isFinite(zoomParam) ? zoomParam : null;
      const results = taxClass && !animal
        ? await searchZoosByTaxonomyClass(env.DB, activePref, taxClass)
        : await searchZoos(env.DB, activePref, animal);
      const html = renderMapHtml(results, activePref, animal, animal ? null : taxClass, initialLat, initialLon, initialZoom);
      return htmlResponse(html, url, activePref);
    }

    // HTML: /favorites
    if (pathname === "/favorites") {
      return htmlResponse(renderFavoritesHtml(), url, activePref);
    }

    // HTML: /
    if (pathname === "/") {
      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      if (animal) {
        const destination = new URL("/zoos", url.origin);
        destination.search = url.search;
        return Response.redirect(destination.toString(), 301);
      }
      const [results, featuredAnimals] = await Promise.all([
        searchZoos(env.DB, activePref, null),
        loadFeaturedAnimals(env.DB, activePref),
      ]);
      const html = renderHomePage(results, activePref, featuredAnimals);
      return htmlResponse(html, url, activePref);
    }

    return notFound("ページが見つかりません");
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(refreshAllAnimalCache(env.DB));
  },
};
