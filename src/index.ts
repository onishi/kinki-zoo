import type { PrefectureCode, Zoo } from "./types";
import { zoos } from "./data";
import { findAnimalTaxonomy, type AnimalTaxonomy } from "./animal-taxonomy";
import type { ScrapeResult, NewsItem } from "./scraper";
import { scrapeAnimals, scrapeZooNews } from "./scraper";
import { getBasePath, normalizeBasePath, runWithBasePath, withBase } from "./request-context";

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

interface SiteSearchResults {
  query: string | null;
  animals: AnimalListItem[];
  zoos: ZooSearchResult[];
  taxonomies: TaxonomySearchResult[];
}

type ClassificationStatus = "registered" | "llm_candidate" | "unclassified" | "rejected";

interface ZooAnimalDetail {
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
type ScrapeWarningType =
  | "scrape_error"
  | "empty_result"
  | "below_minimum"
  | "sharp_drop"
  | "high_removal_count"
  | "update_held_back";

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
  addedCount: number;
  removedCount: number;
  renamedCount: number;
}

interface ScrapeHistoryItem {
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

interface AnimalTaxonomySelection {
  className: string | null;
  orderName: string | null;
  familyName: string | null;
  genusName: string | null;
}

interface FeaturedAnimal {
  displayName: string;
  imageVersion: number | null;
  zooCount: number;
}

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

interface TaxonomySearchResult {
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
// 前回から50%を超えて減少した場合は、スクレイパー側の不具合(セレクタ崩れ等)を
// 疑って自動反映を見送り、既存データを保持する。
const SCRAPE_HALT_DROP_RATIO = 0.5;
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

// Material Icons (Outlined) の path データ。https://fonts.google.com/icons 由来。
const ICONS = {
  home: '<path d="M12 5.69l5 4.5V18h-2v-6H9v6H7v-7.81l5-4.5M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z"/>',
  location_city:
    '<path d="M15 11V5l-3-3l-3 3v2H3v14h18V11h-6zm-8 8H5v-2h2v2zm0-4H5v-2h2v2zm0-4H5V9h2v2zm6 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V9h2v2zm0-4h-2V5h2v2zm6 12h-2v-2h2v2zm0-4h-2v-2h2v2z"/>',
  pets:
    '<circle cx="4.5" cy="9.5" r="2.5"/><circle cx="9" cy="5.5" r="2.5"/><circle cx="15" cy="5.5" r="2.5"/><circle cx="19.5" cy="9.5" r="2.5"/><path d="M17.34 14.86c-.87-1.02-1.6-1.89-2.48-2.91-.46-.54-1.05-1.08-1.75-1.32-.11-.04-.22-.07-.33-.09-.25-.04-.52-.04-.78-.04s-.53 0-.79.05c-.11.02-.22.05-.33.09-.7.24-1.28.78-1.75 1.32-.87 1.02-1.6 1.89-2.48 2.91-1.31 1.31-2.92 2.76-2.62 4.79.29 1.02 1.02 2.03 2.33 2.32.73.15 3.06-.44 5.54-.44h.18c2.48 0 4.81.58 5.54.44 1.31-.29 2.04-1.31 2.33-2.32.31-2.04-1.3-3.49-2.61-4.8z"/>',
  category:
    '<path d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84zM17.5 13c-2.49 0-4.5 2.01-4.5 4.5s2.01 4.5 4.5 4.5 4.5-2.01 4.5-4.5-2.01-4.5-4.5-4.5zm0 7a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5zM3 21.5h8v-8H3v8zm2-6h4v4H5v-4z"/>',
  map: '<path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM10 5.47l4 1.4v11.66l-4-1.4V5.47zm-5 .99l3-1.01v11.7l-3 1.16V6.46zm14 11.08l-3 1.01V6.86l3-1.16v11.84z"/>',
  compare_arrows:
    '<path d="M9.01 14H2v2h7.01v3L13 15l-3.99-4v3zm5.98-1v-3H22V8h-7.01V5L11 9l3.99 4z"/>',
  campaign:
    '<path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm5.03 1.71L11 9.53v4.94l-1.97-1.18-.48-.29H4v-2h4.55l.48-.29zM15.5 12c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z"/>',
  star: '<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2L9.19 8.63L2 9.24l5.46 4.73L5.82 21L12 17.27z"/>',
  star_border:
    '<path d="M22 9.24l-7.19-.62L12 2L9.19 8.63L2 9.24l5.46 4.73L5.82 21L12 17.27L18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27l1-4.28l-3.32-2.88l4.38-.38L12 6.1l1.71 4.04l4.38.38l-3.32 2.88l1 4.28L12 15.4z"/>',
  admin_panel_settings:
    '<circle cx="17" cy="15.5" r="1.12"/><path d="M17 17.5c-.73 0-2.19.36-2.24 1.08.5.71 1.32 1.17 2.24 1.17s1.74-.46 2.24-1.17c-.05-.72-1.51-1.08-2.24-1.08z"/><path d="M18 11.09V6.27L10.5 3L3 6.27v4.91c0 4.54 3.2 8.79 7.5 9.82.55-.13 1.08-.32 1.6-.55A5.973 5.973 0 0 0 17 23c3.31 0 6-2.69 6-6 0-2.97-2.16-5.43-5-5.91zM11 17c0 .56.08 1.11.23 1.62-.24.11-.48.22-.73.3-3.17-1-5.5-4.24-5.5-7.74v-3.6l5.5-2.4l5.5 2.4v3.51c-2.84.48-5 2.94-5 5.91zm6 4c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>',
  search:
    '<path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>',
  close:
    '<path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41z"/>',
  content_copy:
    '<path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>',
  link: '<path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z"/>',
  my_location:
    '<path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>',
  open_in_new:
    '<path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83l1.41 1.41L19 6.41V10h2V3h-7z"/>',
  delete:
    '<path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/>',
  expand_less: '<path d="M12 8l-6 6l1.41 1.41L12 10.83l4.59 4.58L18 14l-6-6z"/>',
  expand_more: '<path d="M16.59 8.59L12 13.17L7.41 8.59L6 10l6 6l6-6l-1.41-1.41z"/>',
  chevron_right: '<path d="M10 6L8.59 7.41L13.17 12l-4.58 4.59L10 18l6-6l-6-6z"/>',
  view_list: '<path d="M3 5v14h18V5H3zm4 2v2H5V7h2zm-2 6v-2h2v2H5zm0 2h2v2H5v-2zm14 2H9v-2h10v2zm0-4H9v-2h10v2zm0-4H9V7h10v2z"/>',
} as const satisfies Record<string, string>;

type IconName = keyof typeof ICONS;

function icon(name: IconName, className = ""): string {
  const cls = ["ui-icon", className].filter(Boolean).join(" ");
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
}

// count を max に対する比率で 0(無し)〜4(最も濃い)の5段階に量子化する。
// 比較ページのヒートマップ色分けで共通利用する。
function heatStep(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  const ratio = count / max;
  if (ratio >= 0.75) return 4;
  if (ratio >= 0.5) return 3;
  if (ratio >= 0.25) return 2;
  return 1;
}

const NEWS_CATEGORY_RULES: Array<{ label: string; bg: string; color: string; pattern: RegExp }> = [
  { label: "誕生", bg: "#fff0f5", color: "#b84b7a", pattern: /誕生|生まれ|赤ちゃん|赤ちゃん|出産|子ども誕生/ },
  { label: "訃報", bg: "#f5f5f5", color: "#555", pattern: /死亡|死去|なくなり|亡くなり|永眠/ },
  { label: "休園", bg: "#fff8e5", color: "#9a5f00", pattern: /休園|臨時休業|閉園|お休み|臨時閉/ },
  { label: "イベント", bg: "#f0f4ff", color: "#3a5fa0", pattern: /イベント|体験|教室|ツアー|開催|参加|ふれあい|工作/ },
  { label: "新展示", bg: "#f0fbf5", color: "#1f6b3d", pattern: /新展示|新しい仲間|来園|やってき|デビュー|初公開|仲間入り/ },
];

function detectNewsCategory(title: string): { label: string; bg: string; color: string } | null {
  for (const rule of NEWS_CATEGORY_RULES) {
    if (rule.pattern.test(title)) return rule;
  }
  return null;
}

function isNewNews(publishedAt: string | null): boolean {
  if (!publishedAt) return false;
  const pub = new Date(publishedAt);
  if (isNaN(pub.getTime())) return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return pub >= cutoff;
}

function renderNewsItemBadges(title: string, publishedAt: string | null): string {
  const parts: string[] = [];
  if (isNewNews(publishedAt)) {
    parts.push(`<span class="news-badge news-badge--new">NEW</span>`);
  }
  const cat = detectNewsCategory(title);
  if (cat) {
    parts.push(`<span class="news-badge" style="background:${cat.bg};color:${cat.color}">${cat.label}</span>`);
  }
  return parts.join("");
}

function renderFavoriteButton(
  type: "zoo" | "animal" | "taxonomy",
  id: string,
  label: string,
  href: string,
  variant: "icon" | "large" = "icon"
): string {
  const escId = escapeHtml(id);
  const escLabel = escapeHtml(label);
  // お気に入りは localStorage に保存され、後で /favorites がクライアント側で
  // このURLから <a href> を組み立てる(HTMLRewriter を経由しない)ため、
  // ここで basePath を確定させておく。
  const escHref = escapeHtml(withBase(href));
  const attrs = `data-fav-type="${type}" data-fav-id="${escId}" data-fav-name="${escLabel}" data-fav-href="${escHref}" aria-pressed="false"`;
  const stars = `<span class="fav-toggle-icon" aria-hidden="true">${icon("star", "fav-toggle-icon-on")}${icon("star_border", "fav-toggle-icon-off")}</span>`;
  if (variant === "large") {
    return `<button type="button" class="fav-toggle fav-toggle--large ui-btn ui-btn--secondary ui-touch-target" ${attrs}>${stars}<span class="fav-toggle-text">お気に入りに追加</span></button>`;
  }
  return `<button type="button" class="fav-toggle fav-toggle--icon" ${attrs} aria-label="お気に入りに追加">${stars}</button>`;
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

/**
 * サイト内パスへの redirect を返す。Location はホスト名を含まない
 * (basePath 付きの)相対パスにすることで、直アクセス/リバースプロキシ経由の
 * どちらでもブラウザが現在のオリジンを保ったまま正しく遷移できる。
 */
function redirectResponse(path: string, status: number): Response {
  return new Response(null, { status, headers: { Location: withBase(path) } });
}

function findMatches(values: string[], searchKeyword: string): string[] {
  return values.filter((value) =>
    value.toLocaleLowerCase("ja-JP").includes(searchKeyword)
  );
}

function hiraganaToKatakana(value: string): string {
  return value.replace(/[ぁ-ん]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60));
}

function normalizeTextForSearchIndex(value: string): string {
  return hiraganaToKatakana(value.normalize("NFKC"))
    .toLocaleLowerCase("ja-JP")
    .replace(/[\s　・･]/g, "");
}

// ひらがな→カタカナ変換のみ行い、SQLite の BINARY 照合でも
// ひらがな/カタカナ表記ゆれに関わらず同じ位置に並ぶようにする（漢字の読み順までは保証しない）。
function buildSortKey(value: string): string {
  return hiraganaToKatakana(value.normalize("NFKC"));
}

function matchesSearchQuery(values: Array<string | null | undefined>, query: string): boolean {
  const normalizedQuery = normalizeTextForSearchIndex(query);
  if (!normalizedQuery) return false;
  return values.some((value) => value ? normalizeTextForSearchIndex(value).includes(normalizedQuery) : false);
}

function normalizeAnimalNameForSearch(value: string): string {
  return value.toLocaleLowerCase("ja-JP");
}

const ANIMAL_DISPLAY_NAME_OVERRIDES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^カイウサギ\(家畜\)?$/, label: "カイウサギ" },
  { pattern: /^テンジクネズミ\(家畜\)?$/, label: "テンジクネズミ" },
  { pattern: /^ノマウマ\(野間馬\)?$/, label: "ノマウマ" },
  { pattern: /^ノマ$/, label: "ノマウマ" },
  { pattern: /^ヒツジ\(家畜\)?$/, label: "ヒツジ" },
  { pattern: /^ブラックバック\(メス\)?$/, label: "ブラックバック" },
  { pattern: /^アジアの森サソリ$/, label: "アジアンフォレストスコーピオン" },
];

function formatAnimalDisplayName(value: string): string {
  const normalized = value.normalize("NFKC").trim();
  return ANIMAL_DISPLAY_NAME_OVERRIDES.find(({ pattern }) => pattern.test(normalized))?.label ?? value;
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

/**
 * 取得結果が明らかにスクレイパー側の不具合(セレクタ崩れ・サイト構造変更等)を
 * 疑うべき内容の場合、既存データを上書きせず反映を見送るべきかどうかを判定する。
 */
function shouldHaltScrapeApply(
  result: ScrapeResult,
  previousCount: number,
  currentCount: number
): boolean {
  if (result.error) return true;
  if (previousCount === 0) return false;
  if (currentCount === 0) return true;
  return currentCount < previousCount * (1 - SCRAPE_HALT_DROP_RATIO);
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

async function loadScrapeHistory(
  db: D1Database,
  limit: number,
  zooId: string | null = null
): Promise<ScrapeHistoryItem[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const zooFilter = zooId ? "AND zoo_id = ?" : "";
  const zooBind = zooId ? [zooId] : [];
  const [scrapeRows, diffRows, warningRows] = await Promise.all([
    db
      .prepare(
        `WITH runs AS (
           SELECT zoo_id, scraped_at FROM animal_scrape_results WHERE 1=1 ${zooFilter}
           UNION
           SELECT zoo_id, scraped_at FROM animal_scrape_diffs WHERE 1=1 ${zooFilter}
           UNION
           SELECT zoo_id, scraped_at FROM animal_scrape_warnings WHERE 1=1 ${zooFilter}
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
      .bind(...zooBind, ...zooBind, ...zooBind, safeLimit)
      .all<{ zoo_id: string; scraped_at: string; error: string | null; animal_count: number }>(),
    db
      .prepare(
        `SELECT zoo_id, scraped_at, diff_type, previous_display_name, current_display_name
         FROM animal_scrape_diffs
         WHERE scraped_at IN (
           SELECT scraped_at
           FROM (
             SELECT zoo_id, scraped_at FROM animal_scrape_results WHERE 1=1 ${zooFilter}
             UNION
             SELECT zoo_id, scraped_at FROM animal_scrape_diffs WHERE 1=1 ${zooFilter}
             UNION
             SELECT zoo_id, scraped_at FROM animal_scrape_warnings WHERE 1=1 ${zooFilter}
           )
           ORDER BY scraped_at DESC
           LIMIT ?
         )
         ${zooFilter}
         ORDER BY id`
      )
      .bind(...zooBind, ...zooBind, ...zooBind, safeLimit, ...zooBind)
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
             SELECT zoo_id, scraped_at FROM animal_scrape_results WHERE 1=1 ${zooFilter}
             UNION
             SELECT zoo_id, scraped_at FROM animal_scrape_diffs WHERE 1=1 ${zooFilter}
             UNION
             SELECT zoo_id, scraped_at FROM animal_scrape_warnings WHERE 1=1 ${zooFilter}
           )
           ORDER BY scraped_at DESC
           LIMIT ?
         )
         ${zooFilter}
         ORDER BY id`
      )
      .bind(...zooBind, ...zooBind, ...zooBind, safeLimit, ...zooBind)
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

function filterAnimalItemsByTaxonomy(
  animals: AnimalListItem[],
  taxonomy: AnimalTaxonomySelection
): AnimalListItem[] {
  return animals.filter(
    (animal) =>
      (!taxonomy.className || animal.className === taxonomy.className) &&
      (!taxonomy.orderName || animal.orderName === taxonomy.orderName) &&
      (!taxonomy.familyName || animal.familyName === taxonomy.familyName) &&
      (!taxonomy.genusName || animal.genusName === taxonomy.genusName)
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
  query: string | null = null,
  noImage: boolean = false
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
    if (noImage && selected?.selectedGenerationId != null) continue;
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

interface AnimalPastZoo {
  zoo: Zoo;
  lastSeenMissingAt: string;
}

// 展示終了を断定せず、直近のスクレイピングで「表示名が消えた」と判定された
// 施設を推定として一覧化する（名称変更による removed は diff_type で除外済み）。
async function loadAnimalPastZoos(
  db: D1Database,
  displayName: string,
  currentZooIds: string[],
  pref: PrefectureCode | null = null
): Promise<AnimalPastZoo[]> {
  const zooIds = getZooIdsForPrefecture(pref);
  const zooFilter = pref ? `AND zoo_id IN (${buildPlaceholders(zooIds)})` : "";
  const result = await db
    .prepare(
      `SELECT zoo_id, MAX(scraped_at) AS last_seen_missing_at
       FROM animal_scrape_diffs
       WHERE diff_type = 'removed' AND previous_display_name = ?
       ${zooFilter}
       GROUP BY zoo_id`
    )
    .bind(displayName, ...(pref ? zooIds : []))
    .all<{ zoo_id: string; last_seen_missing_at: string }>();

  const currentSet = new Set(currentZooIds);
  const zooById = new Map(zoos.map((zoo) => [zoo.id, zoo]));
  return (result.results ?? [])
    .filter((row) => !currentSet.has(row.zoo_id))
    .flatMap((row) => {
      const zoo = zooById.get(row.zoo_id);
      return zoo ? [{ zoo, lastSeenMissingAt: row.last_seen_missing_at }] : [];
    })
    .sort((a, b) => b.lastSeenMissingAt.localeCompare(a.lastSeenMissingAt));
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
  limit = 6
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

  const items = buildAnimalListItems(result.results ?? []);
  // 同じ科を先頭に並べる
  if (detail.familyName) {
    items.sort((a, b) => {
      const af = a.familyName === detail.familyName ? 0 : 1;
      const bf = b.familyName === detail.familyName ? 0 : 1;
      return af - bf;
    });
  }
  return items.slice(0, limit);
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
       ORDER BY animal_count DESC, COALESCE(a.${childRank.column}, NULLIF(c.${childRank.column}, 'null'))`
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
             updated_at,
             sort_key
           )
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          updatedAt,
          buildSortKey(taxonomy.canonicalName)
        );
    })
  );
}

async function saveScrapeResult(db: D1Database, result: ScrapeResult): Promise<void> {
  const previousRows = await db
    .prepare(
      `SELECT display_name, sort_key
       FROM zoo_animals
       WHERE zoo_id = ?
       ORDER BY display_name`
    )
    .bind(result.zooId)
    .all<{ display_name: string; sort_key: string | null }>();
  const previousAnimals = (previousRows.results ?? []).map((row) => row.display_name);
  const previousSortKeys = new Map(
    (previousRows.results ?? []).map((row) => [row.display_name, row.sort_key])
  );
  const diffs = buildScrapeDiffs(previousAnimals, result.animals);
  const warnings = buildScrapeWarnings(result.zooId, result, previousAnimals, diffs);

  const previousCount = uniqueDisplayNames(previousAnimals).length;
  const currentCount = uniqueDisplayNames(result.animals).length;
  const halted = shouldHaltScrapeApply(result, previousCount, currentCount);
  if (halted) {
    warnings.push({
      type: "update_held_back",
      message: "変化が大きすぎるため、今回の取得結果の反映を見送り既存データを保持しました",
      previousCount,
      currentCount,
      thresholdCount: null,
    });
  }

  if (!halted) {
    const taxonomies = result.animals.flatMap((animal) => {
      const taxonomy = findAnimalTaxonomy(animal);
      return taxonomy ? [taxonomy] : [];
    });
    await upsertAnimalMasters(db, taxonomies);
  }

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
    ...(halted
      ? []
      : [
          db.prepare("DELETE FROM zoo_animals WHERE zoo_id = ?").bind(result.zooId),
          ...result.animals.map((animal) => {
            const taxonomy = findAnimalTaxonomy(animal);
            const sortKey = previousSortKeys.get(animal) ?? buildSortKey(animal);
            return db
              .prepare(
                `INSERT INTO zoo_animals (zoo_id, display_name, normalized_display_name, animal_id, sort_key)
                 VALUES (?, ?, ?, ?, ?)`
              )
              .bind(
                result.zooId,
                animal,
                normalizeAnimalNameForSearch(animal),
                taxonomy?.id ?? null,
                sortKey
              );
          }),
        ]),
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

interface ZooNewsRow {
  id: number;
  zoo_id: string;
  title: string;
  url: string;
  published_at: string | null;
  fetched_at: string;
  body: string | null;
  animal_names: string | null;
}

interface AnimalNewsRow {
  news_id: number;
  zoo_id: string;
  title: string;
  url: string;
  published_at: string | null;
}

async function loadZooNews(db: D1Database, zooId: string, limit = 5): Promise<ZooNewsRow[]> {
  const rows = await db
    .prepare(
      `SELECT n.id, n.zoo_id, n.title, n.url, n.published_at, n.fetched_at, n.body,
              GROUP_CONCAT(a.animal_name) AS animal_names
       FROM zoo_news n
       LEFT JOIN zoo_news_animals a ON a.news_id = n.id
       WHERE n.zoo_id = ?
       GROUP BY n.id
       ORDER BY CASE WHEN n.published_at IS NULL THEN 1 ELSE 0 END, n.published_at DESC
       LIMIT ?`
    )
    .bind(zooId, limit)
    .all<ZooNewsRow>();
  return rows.results ?? [];
}

async function loadAllZooAnimalNames(db: D1Database): Promise<Set<string>> {
  const rows = await db
    .prepare(`SELECT DISTINCT display_name FROM zoo_animals`)
    .all<{ display_name: string }>();
  return new Set((rows.results ?? []).map((r) => r.display_name));
}

function extractAnimalNamesFromText(text: string, animalNames: Set<string>): string[] {
  const found: string[] = [];
  for (const name of animalNames) {
    if (name.length >= 2 && text.includes(name)) {
      found.push(name);
    }
  }
  return found;
}

async function saveZooNews(
  db: D1Database,
  zooId: string,
  items: NewsItem[],
  allAnimalNames: Set<string>
): Promise<void> {
  if (items.length === 0) return;
  const fetchedAt = new Date().toISOString();
  await db.batch(
    items.map((item) =>
      db
        .prepare(
          `INSERT INTO zoo_news (zoo_id, title, url, published_at, fetched_at, body)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(zoo_id, url) DO UPDATE SET
             title = excluded.title,
             published_at = COALESCE(excluded.published_at, zoo_news.published_at),
             body = COALESCE(excluded.body, zoo_news.body),
             fetched_at = excluded.fetched_at`
        )
        .bind(zooId, item.title, item.url, item.publishedAt ?? null, fetchedAt, item.body ?? null)
    )
  );

  // Extract and save animal name links
  const animalInserts: ReturnType<D1Database["prepare"]>[] = [];
  for (const item of items) {
    const row = await db
      .prepare(`SELECT id FROM zoo_news WHERE zoo_id = ? AND url = ?`)
      .bind(zooId, item.url)
      .first<{ id: number }>();
    if (!row) continue;
    const text = `${item.title} ${item.body ?? ""}`;
    for (const name of extractAnimalNamesFromText(text, allAnimalNames)) {
      animalInserts.push(
        db
          .prepare(`INSERT OR IGNORE INTO zoo_news_animals (news_id, animal_name) VALUES (?, ?)`)
          .bind(row.id, name)
      );
    }
  }
  if (animalInserts.length > 0) await db.batch(animalInserts);
}

async function loadAnimalNews(
  db: D1Database,
  displayName: string,
  canonicalName: string | null,
  limit = 5
): Promise<AnimalNewsRow[]> {
  const names = [displayName];
  if (canonicalName && canonicalName !== displayName) names.push(canonicalName);
  const placeholders = names.map(() => "?").join(", ");
  const rows = await db
    .prepare(
      `SELECT DISTINCT n.id as news_id, n.zoo_id, n.title, n.url, n.published_at
       FROM zoo_news n
       JOIN zoo_news_animals a ON a.news_id = n.id
       WHERE a.animal_name IN (${placeholders})
       ORDER BY CASE WHEN n.published_at IS NULL THEN 1 ELSE 0 END, n.published_at DESC
       LIMIT ?`
    )
    .bind(...names, limit)
    .all<AnimalNewsRow>();
  return rows.results ?? [];
}

async function loadAllZooNews(db: D1Database, limit = 50): Promise<ZooNewsRow[]> {
  const rows = await db
    .prepare(
      `SELECT n.id, n.zoo_id, n.title, n.url, n.published_at, n.fetched_at, n.body,
              GROUP_CONCAT(a.animal_name) AS animal_names
       FROM zoo_news n
       LEFT JOIN zoo_news_animals a ON a.news_id = n.id
       GROUP BY n.id
       ORDER BY CASE WHEN n.published_at IS NULL THEN 1 ELSE 0 END, n.published_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<ZooNewsRow>();
  return rows.results ?? [];
}

interface ScrapeStatusRow {
  zoo_id: string;
  animal_scraped_at: string | null;
  news_fetched_at: string | null;
  news_count: number;
}

async function loadScrapeStatus(db: D1Database): Promise<ScrapeStatusRow[]> {
  const rows = await db.prepare(
    `SELECT
       z.zoo_id,
       r.scraped_at AS animal_scraped_at,
       n.last_fetched AS news_fetched_at,
       COALESCE(n.cnt, 0) AS news_count
     FROM (SELECT DISTINCT zoo_id FROM animal_scrape_results) z
     LEFT JOIN (
       SELECT zoo_id, MAX(scraped_at) AS scraped_at FROM animal_scrape_results GROUP BY zoo_id
     ) r ON r.zoo_id = z.zoo_id
     LEFT JOIN (
       SELECT zoo_id, MAX(fetched_at) AS last_fetched, COUNT(*) AS cnt FROM zoo_news GROUP BY zoo_id
     ) n ON n.zoo_id = z.zoo_id
     ORDER BY z.zoo_id`
  ).all<ScrapeStatusRow>();
  return rows.results ?? [];
}

async function refreshAllZooNews(db: D1Database): Promise<void> {
  const allAnimalNames = await loadAllZooAnimalNames(db);
  for (const zoo of zoos) {
    const items = await scrapeZooNews(zoo.id);
    await saveZooNews(db, zoo.id, items, allAnimalNames);
  }
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

function renderMatchedValues(
  label: string,
  values: string[],
  linkBuilder?: (value: string) => string,
  valueFormatter: (value: string) => string = (value) => value
): string {
  if (values.length === 0) return "";
  const visibleValues = values.slice(0, 8);
  const hiddenCount = values.length - visibleValues.length;
  const chips = visibleValues
    .map((value) => {
      const escapedValue = escapeHtml(valueFormatter(value));
      return linkBuilder
        ? `<a class="match-chip ui-chip ui-pill" href="${escapeHtml(linkBuilder(value))}">${escapedValue}</a>`
        : `<span class="match-chip ui-chip ui-pill">${escapedValue}</span>`;
    })
    .join("");
  const more = hiddenCount > 0 ? `<span class="match-more">ほか ${hiddenCount} 件</span>` : "";

  return `
    <div class="match-row">
      <span class="match-label">${label}</span>
      <span class="match-values">${chips}${more}</span>
    </div>`;
}

function renderMatchSummary(result: ZooSearchResult): string {
  const animalMatches = renderMatchedValues(
    "ヒットした動物・分類",
    result.matchedAnimals,
    buildZooAnimalUrl,
    formatAnimalDisplayName
  );
  const featureMatches = renderMatchedValues("ヒットした施設情報", result.matchedFeatures);

  if (!animalMatches && !featureMatches) return "";

  return `<div class="match-box">${featureMatches}${animalMatches}</div>`;
}

function renderZooCard(result: ZooSearchResult, includeMatchSummary: boolean): string {
  const zoo = result.zoo;
  const zooId = encodeURIComponent(zoo.id);
  const zooDomId = `zoo-${zoo.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const prefLabel = PREF_LABELS[zoo.prefecture];
  return `
    <tr id="${escapeHtml(zooDomId)}">
      <th scope="row" class="zoo-name">
        <div class="name-with-fav">
          <a href="/zoos/${zooId}">${escapeHtml(zoo.name)}</a>
          ${renderFavoriteButton("zoo", zoo.id, zoo.name, `/zoos/${zooId}`)}
        </div>
        <p class="kana">${escapeHtml(zoo.nameKana)}</p>
        <label class="zoo-compare-option">
          <input type="checkbox" data-compare-zoo="${escapeHtml(zoo.id)}" data-compare-name="${escapeHtml(zoo.name)}">
          <span data-compare-label>比較に追加</span>
        </label>
      </th>
      <td data-label="都道府県">${prefLabel}</td>
      <td data-label="動物種数">${result.animalCount > 0 ? `${result.animalCount} 種` : "未取得"}</td>
      ${includeMatchSummary ? `<td data-label="検索ヒット">${renderMatchSummary(result)}</td>` : ""}
    </tr>`;
}

type ZooView = "list" | "map" | "taxonomy";

function buildZoosUrl(
  pref: PrefectureCode | null,
  animal: string | null,
  opts: { cls?: string | null; view?: ZooView } = {}
): string {
  const params = new URLSearchParams();
  if (pref) params.set("pref", pref);
  if (animal) params.set("animal", animal);
  if (opts.cls) params.set("cls", opts.cls);
  if (opts.view && opts.view !== "list") params.set("view", opts.view);
  const query = params.toString();
  return query ? `/zoos?${query}` : "/zoos";
}

function buildBrowseUrl(pref: PrefectureCode | null, animal: string | null): string {
  return buildZoosUrl(pref, animal);
}

// 「地図で見る」系のリンクは /zoos の地図タブへのディープリンクを返す。
function buildMapUrl(pref: PrefectureCode | null, animal: string | null, taxClass?: string | null): string {
  return buildZoosUrl(pref, animal, { cls: taxClass, view: "map" });
}

function renderHomeOverview(
  activePref: PrefectureCode | null,
  facilityCount: number,
  totalAnimalCount: number,
): string {
  const prefLabel = activePref ? PREF_LABELS[activePref] : "近畿一円";
  const prefectureCount = activePref ? 1 : new Set(zoos.map((zoo) => zoo.prefecture)).size;
  const stats = [
    { label: "掲載施設", value: `${facilityCount}`, unit: "施設" },
    { label: "登録動物", value: `${totalAnimalCount}`, unit: "件" },
    { label: "対象地域", value: `${prefectureCount}`, unit: "府県" },
  ];

  return `
  <section class="home-overview" aria-labelledby="home-overview-title">
    <p class="home-kicker">${escapeHtml(prefLabel)}</p>
    <h2 id="home-overview-title">動物園・動物・分類をまとめて探す</h2>
    <div class="home-primary-actions">
      <a href="${buildBrowseUrl(activePref, null)}" class="ui-btn ui-btn--primary ui-touch-target">${icon("location_city")}動物園一覧</a>
      <a href="${buildMapUrl(activePref, null)}" class="ui-btn ui-btn--secondary ui-touch-target">${icon("map")}地図で見る</a>
    </div>
    <dl class="home-stats">
      ${stats.map((stat) => `
      <div>
        <dt>${escapeHtml(stat.label)}</dt>
        <dd><strong>${escapeHtml(stat.value)}</strong><span>${escapeHtml(stat.unit)}</span></dd>
      </div>`).join("")}
    </dl>
  </section>`;
}

function renderExploreCards(activePref: PrefectureCode | null, facilityCount: number, totalAnimalCount: number): string {
  const prefLabel = activePref ? PREF_LABELS[activePref] : "近畿一円";
  const cards = [
    {
      href: buildBrowseUrl(activePref, null),
      label: "動物園一覧",
      meta: `${prefLabel}の ${facilityCount} 施設`,
      body: "施設名、地域、住所、基本情報を一覧で確認できます。",
    },
    {
      href: buildMapUrl(activePref, null),
      label: "地図で探す",
      meta: `${prefLabel}の ${facilityCount} 施設`,
      body: "現在地や旅行先に近い動物園を地図から探せます。",
    },
    {
      href: activePref ? `/animals?pref=${activePref}` : "/animals",
      label: "動物から探す",
      meta: totalAnimalCount > 0 ? `動物 ${totalAnimalCount} 種` : "動物一覧",
      body: "動物名の検索と、哺乳類・鳥類などの分類絞り込みで見られる施設を確認できます。",
    },
  ];

  return `
  <section class="explore-section" aria-labelledby="explore-title">
    <div class="explore-heading">
      <h2 id="explore-title">主要ページ</h2>
      <a href="${buildZoosUrl(activePref, null, { view: "taxonomy" })}" class="section-link">動物園を比較 →</a>
    </div>
    <div class="explore-grid">
      ${cards
        .map(
          (card) => `
            <a class="explore-card ui-card-link ui-touch-target" href="${card.href}">
              <span>${escapeHtml(card.label)}</span>
              <small>${escapeHtml(card.meta)}</small>
              <em>${escapeHtml(card.body)}</em>
            </a>`
        )
        .join("")}
    </div>
  </section>`;
}

function renderSpotlightSection(
  featuredAnimals: FeaturedAnimal[],
  featuredZoos: ZooSearchResult[],
  activePref: PrefectureCode | null
): string {
  if (featuredAnimals.length === 0 && featuredZoos.length === 0) return "";

  const prefLabel = activePref ? PREF_LABELS[activePref] : "近畿一円";

  const animalsHtml =
    featuredAnimals.length > 0
      ? `<div class="spotlight-block">
      <div class="spotlight-sub-heading">
        <h3>画像のある動物</h3>
        <a href="${activePref ? `/animals?pref=${activePref}` : "/animals"}" class="spotlight-more">動物一覧へ →</a>
      </div>
      <div class="spotlight-animal-grid">
        ${featuredAnimals
          .map(
            (animal) => `
          <a class="spotlight-animal-card ui-card-link ui-touch-target" href="${buildZooAnimalUrl(animal.displayName)}">
            <img src="${buildAnimalImageUrl(animal.displayName, animal.imageVersion)}" alt="" class="spotlight-animal-img" width="72" height="72" loading="lazy">
            <span>${escapeHtml(formatAnimalDisplayName(animal.displayName))}</span>
            <small>${animal.zooCount} 施設</small>
          </a>`
          )
          .join("")}
      </div>
    </div>`
      : "";

  const zoosHtml =
    featuredZoos.length > 0
      ? `<div class="spotlight-block">
      <div class="spotlight-sub-heading">
        <h3>動物の多い施設</h3>
        <a href="${buildBrowseUrl(activePref, null)}" class="spotlight-more">施設一覧へ →</a>
      </div>
      <div class="spotlight-zoo-grid">
        ${featuredZoos
          .map(
            (result) => `
          <a class="spotlight-zoo-card ui-card-link ui-touch-target" href="/zoos/${encodeURIComponent(result.zoo.id)}">
            <span>${escapeHtml(result.zoo.name)}</span>
            ${result.animalCount > 0 ? `<small>${result.animalCount} 種</small>` : ""}
          </a>`
          )
          .join("")}
      </div>
    </div>`
      : "";

  return `
  <section class="spotlight-section" aria-labelledby="spotlight-title">
    <div class="spotlight-heading">
      <h2 id="spotlight-title">注目の動物・施設</h2>
      <p>${escapeHtml(prefLabel)}の見どころ</p>
    </div>
    ${animalsHtml}
    ${zoosHtml}
  </section>`;
}

function buildAnimalSearchUrl(animal: string): string {
  const params = new URLSearchParams({ animal });
  return `/zoos?${params.toString()}`;
}

function buildZooAnimalUrl(displayName: string): string {
  return `/animal/${encodeURIComponent(displayName)}`;
}

function buildJapaneseWikipediaUrl(title: string): string {
  return `https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}`;
}

function buildTaxonomyPathUrl(values: string[]): string {
  return `/taxonomy/${values.map((value) => encodeURIComponent(value)).join("/")}`;
}

// Query parameters that contribute to page content and belong in the canonical URL.
const CANONICAL_SEARCH_PARAMS = new Set([
  "animal",
  "filter",
  "cls",
  "order",
  "family",
  "genus",
  "a",
  "b",
  "c",
]);

function buildCanonicalUrl(url: URL): string {
  const canonical = new URLSearchParams();
  for (const key of CANONICAL_SEARCH_PARAMS) {
    const value = url.searchParams.get(key);
    if (value !== null) {
      canonical.set(key, value);
    }
  }
  const query = canonical.toString();
  return `${url.origin}${withBase(url.pathname)}${query ? `?${query}` : ""}`;
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

  return `<form class="pref-selector" action="${escapeHtml(withBase(url.pathname))}" method="get">
    ${hiddenInputs}
    <label for="prefecture-select">地域</label>
    <select id="prefecture-select" name="pref" onchange="this.form.submit()">${options}</select>
    <noscript><button type="submit">表示</button></noscript>
  </form>`;
}

function getHeaderSearchValue(url: URL): string {
  return url.searchParams.get("q") ?? url.searchParams.get("animal") ?? "";
}

function renderHeaderSearch(url: URL, activePref: PrefectureCode | null): string {
  const value = getHeaderSearchValue(url);
  const prefInput = activePref
    ? `<input type="hidden" name="pref" value="${escapeHtml(activePref)}">`
    : "";
  return `<form class="header-search" action="${withBase("/search")}" method="get" role="search">
    ${prefInput}
    <label for="header-search-input">サイト内検索</label>
    <input id="header-search-input" type="search" name="q" value="${escapeHtml(value)}" placeholder="動物・動物園を検索" autocomplete="off">
    <button type="submit" aria-label="検索">${icon("search")}<span>検索</span></button>
  </form>`;
}

const HEADER_TOGGLE_SCRIPT = `(function () {
  var STORAGE_KEY = "kz-header-collapsed";
  var collapsed = false;
  try {
    collapsed = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch (e) {}
  if (collapsed) document.documentElement.classList.add("kz-header-collapsed");
  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.querySelector("[data-header-toggle]");
    if (!btn) return;
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.addEventListener("click", function () {
      collapsed = !collapsed;
      document.documentElement.classList.toggle("kz-header-collapsed", collapsed);
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      try {
        window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
      } catch (e) {}
    });
  });
})();`;

function htmlResponse(html: string, url: URL, activePref: PrefectureCode | null): Response {
  const canonicalUrl = escapeHtml(buildCanonicalUrl(url));
  const basePath = getBasePath();
  let rewriter = new HTMLRewriter()
    .on("head", {
      element(element) {
        element.prepend(
          `<script>window.__BASE_PATH__=${JSON.stringify(basePath)};</script>` +
            `<link rel="canonical" href="${canonicalUrl}">` +
            `<script>${HEADER_TOGGLE_SCRIPT}</script>`,
          { html: true }
        );
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
        if (href && href.startsWith("/") && !href.startsWith("//")) {
          element.setAttribute("href", withBase(addPrefectureToInternalUrl(href, activePref)));
        }
      },
    })
    .on("img[src]", {
      element(element) {
        const src = element.getAttribute("src");
        if (src && src.startsWith("/") && !src.startsWith("//")) {
          element.setAttribute("src", withBase(src));
        }
      },
    })
    .on("script[src]", {
      element(element) {
        const src = element.getAttribute("src");
        if (src && src.startsWith("/") && !src.startsWith("//")) {
          element.setAttribute("src", withBase(src));
        }
      },
    })
    .on("form[action]", {
      element(element) {
        const action = element.getAttribute("action");
        if (action && action.startsWith("/") && !action.startsWith("//")) {
          element.setAttribute("action", withBase(action));
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

function renderBreadcrumb(crumbs: Array<{ href?: string; label: string }>): string {
  const items = crumbs
    .map((crumb, index) => {
      const content =
        crumb.href && index !== crumbs.length - 1
          ? `<a href="${escapeHtml(crumb.href)}">${escapeHtml(crumb.label)}</a>`
          : `<span aria-current="page">${escapeHtml(crumb.label)}</span>`;
      return `<li>${content}</li>`;
    })
    .join("");

  return `<nav class="breadcrumb" aria-label="パンくず"><ol>${items}</ol></nav>`;
}

/**
 * 空状態・エラー状態の案内と次アクションを共通レイアウトで描画する。
 */
function renderStateMessage(
  message: string,
  actions: Array<{ href: string; label: string; external?: boolean }> = [],
  tone: "empty" | "error" = "empty"
): string {
  const links = actions
    .map((action) => {
      const extraAttrs = action.external ? ` target="_blank" rel="noopener noreferrer"` : "";
      const buttonClass = tone === "error" ? "ui-btn--primary" : "ui-btn--secondary";
      const iconHtml = action.external ? icon("open_in_new") : "";
      return `<a href="${escapeHtml(action.href)}" class="ui-btn ${buttonClass} ui-touch-target"${extraAttrs}>${iconHtml}${escapeHtml(action.label)}</a>`;
    })
    .join("");
  const linksHtml = links ? `<div class="ui-state-actions">${links}</div>` : "";
  return `<section class="ui-state${tone === "error" ? " ui-state--error" : ""}" role="${tone === "error" ? "alert" : "status"}">
    <p class="ui-state-message">${escapeHtml(message)}</p>
    ${linksHtml}
  </section>`;
}

function renderTaxonomyBreadcrumb(levels: TaxonomyPathLevel[]): string {
  return renderBreadcrumb([
    { href: buildTaxonomyIndexUrl(), label: "分類一覧" },
    ...levels.map((level, index) => ({
      href:
        index === levels.length - 1
          ? undefined
          : buildTaxonomyPathUrl(levels.slice(0, index + 1).map((item) => item.value)),
      label: `${level.rank.label}: ${level.value}`,
    })),
  ]);
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
    html { -webkit-text-size-adjust: 100%; scrollbar-gutter: stable; }
    body { min-width: 0; overflow-wrap: anywhere; }
    img, svg { max-width: 100%; }
    button, input, select { font: inherit; }
    .ui-icon { width: 1.15em; height: 1.15em; flex: 0 0 auto; fill: currentColor; }
    .icon-heading { display: inline-flex; align-items: center; gap: 0.35rem; }
    .ui-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; min-height: 40px; border: 1px solid #1f5b45; padding: 0.45rem 0.8rem; text-decoration: none; }
    .ui-btn:not(:disabled) { cursor: pointer; }
    .ui-btn--primary { background: #1f5b45; color: #fff; }
    .ui-btn--primary:hover { background: #184a38; border-color: #184a38; }
    .ui-btn--secondary { background: #fff; color: #1f5b45; }
    .ui-btn--secondary:hover { background: #f1f8f3; }
    .ui-card-link { display: grid; border: 1px solid #dce7df; background: #f8fbf9; color: #1f5b45; text-decoration: none; }
    .ui-card-link:hover { background: #f1f8f3; border-color: #9bc4ab; }
    .ui-chip { display: inline-flex; align-items: center; gap: 0.25rem; color: #2d6a4f; border: 1px solid #d3e4d8; background: #f7fbf8; padding: 0.2rem 0.45rem; font-size: 0.78rem; text-decoration: none; }
    .ui-chip:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .ui-chip--active { background: #1f5b45; border-color: #1f5b45; color: #fff; }
    .ui-pill { border-radius: 999px; font-weight: bold; }
    .ui-btn:focus-visible, .ui-card-link:focus-visible, .ui-chip:focus-visible { outline: 2px solid #1f5b45; outline-offset: 2px; }
    .ui-thumb { display: block; object-fit: cover; flex-shrink: 0; border-radius: 2px; background: #f0f0f0; }
    .ui-thumb--36 { width: 36px; height: 36px; }
    .ui-animal-placeholder {
      --animal-placeholder-gap: 0.28rem;
      --animal-placeholder-padding: 0.4rem;
      --animal-placeholder-font-size: clamp(0.52rem, 1.3vw, 0.82rem);
      display: grid;
      align-content: center;
      justify-items: center;
      gap: var(--animal-placeholder-gap);
      padding: var(--animal-placeholder-padding);
      border: 1px dashed #cfd9d3;
      background:
        linear-gradient(135deg, rgba(255, 255, 255, 0.4), rgba(236, 243, 239, 0.96)),
        repeating-linear-gradient(135deg, rgba(141, 163, 151, 0.08) 0 8px, rgba(141, 163, 151, 0.14) 8px 16px);
      color: #66786e;
      text-align: center;
      line-height: 1.35;
      overflow: hidden;
    }
    .ui-animal-placeholder--compact {
      --animal-placeholder-gap: 0.16rem;
      --animal-placeholder-padding: 0.22rem;
      --animal-placeholder-font-size: clamp(0.46rem, 1vw, 0.64rem);
    }
    .ui-animal-placeholder-icon {
      width: min(42%, 2.25rem);
      aspect-ratio: 1;
      border: 1.5px solid currentColor;
      border-radius: 4px;
      position: relative;
      opacity: 0.55;
    }
    .ui-animal-placeholder-icon::before {
      content: "";
      position: absolute;
      top: 18%;
      right: 18%;
      width: 24%;
      aspect-ratio: 1;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.7;
    }
    .ui-animal-placeholder-icon::after {
      content: "";
      position: absolute;
      left: 14%;
      right: 14%;
      bottom: 18%;
      height: 34%;
      background:
        linear-gradient(135deg, transparent 0 18%, currentColor 18% 34%, transparent 34% 100%),
        linear-gradient(45deg, transparent 0 44%, currentColor 44% 62%, transparent 62% 100%);
      opacity: 0.5;
    }
    .ui-animal-placeholder strong {
      max-width: 100%;
      font-size: var(--animal-placeholder-font-size);
      font-weight: bold;
      letter-spacing: 0.04em;
      overflow-wrap: anywhere;
    }
    .ui-animal-placeholder small {
      max-width: 16em;
      font-size: calc(var(--animal-placeholder-font-size) - 0.08rem);
      color: #6f8077;
      overflow-wrap: anywhere;
    }
    .ui-touch-target { min-height: 40px; }
    .news-badge { display: inline-flex; align-items: center; font-size: 0.68rem; font-weight: bold; padding: 0.05rem 0.35rem; border-radius: 2px; flex-shrink: 0; }
    .news-badge--new { background: #dc2626; color: #fff; }
    .news-animals a { display: inline-flex; align-items: center; gap: 0.3rem; }
    .news-animal-thumb { display: block; width: 24px; height: 24px; flex: 0 0 24px; border-radius: 50%; object-fit: cover; background: #e7eee9; }
    .fav-toggle { border: 1px solid #d8c98a; background: #fff; color: #b8930b; cursor: pointer; }
    .fav-toggle:disabled { opacity: 0.4; cursor: not-allowed; }
    .fav-toggle--icon { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 1.9rem; height: 1.9rem; padding: 0; font-size: 1.05rem; border-radius: 4px; margin-left: auto; }
    .fav-toggle--icon[aria-pressed="true"] { background: #fdf6e0; }
    .fav-toggle--large { display: inline-flex; align-items: center; gap: 0.35rem; }
    .fav-toggle--large[aria-pressed="true"] { background: #fdf6e0; }
    .fav-toggle-icon { display: inline-flex; color: #d9a900; }
    .fav-toggle-icon .fav-toggle-icon-on { display: none; }
    .fav-toggle[aria-pressed="true"] .fav-toggle-icon-on { display: inline-flex; }
    .fav-toggle[aria-pressed="true"] .fav-toggle-icon-off { display: none; }
    .name-with-fav { display: flex; align-items: center; gap: 0.4rem; }
    .site-header { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem 2rem; padding: 1rem 1.5rem; border-bottom: 1px solid #ddd; }
    .site-heading { flex: 1 1 320px; min-width: 0; }
    .site-header h1 { font-size: 1.5rem; }
    .site-header h1 a { color: inherit; text-decoration: none; }
    .site-header p { font-size: 0.9rem; color: #555; margin-top: 0.25rem; }
    .header-search { display: flex; flex: 1 1 300px; max-width: 460px; align-items: center; gap: 0.4rem; }
    .header-search label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .header-search input { flex: 1 1 auto; min-width: 0; min-height: 40px; border: 1px solid #aaa; background: #fff; padding: 0.5rem 0.65rem; font-size: 0.9rem; }
    .header-search button { display: inline-flex; align-items: center; gap: 0.3rem; flex: 0 0 auto; min-height: 40px; border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.45rem 0.75rem; font-size: 0.86rem; cursor: pointer; }
    .header-search button:hover { background: #184a38; border-color: #184a38; }
    .pref-selector { display: flex; align-items: center; gap: 0.5rem; }
    .pref-selector label { color: #555; font-size: 0.82rem; font-weight: bold; }
    .pref-selector select { min-width: 9rem; border: 1px solid #aaa; background: #fff; padding: 0.45rem 2rem 0.45rem 0.6rem; font: inherit; }
    .pref-selector button { border: 1px solid #1f5b45; background: #fff; color: #1f5b45; padding: 0.4rem 0.65rem; }
    .header-toggle { display: none; }
    .global-nav { display: flex; flex-wrap: wrap; gap: 1rem; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; }
    .global-nav a { display: inline-flex; align-items: center; gap: 0.3rem; color: #1f5b45; text-decoration: none; font-size: 0.9rem; }
    .global-nav a .ui-icon { width: 1.05em; height: 1.05em; opacity: 0.85; }
    .global-nav a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .global-nav a[aria-current="page"] { font-weight: bold; text-decoration: underline; text-underline-offset: 0.2em; }
    .global-nav .nav-admin { margin-left: auto; color: #888; font-size: 0.82rem; }
    .breadcrumb { border-bottom: 1px solid #e5e5e5; color: #777; font-size: 0.78rem; }
    .breadcrumb ol { display: flex; flex-wrap: wrap; gap: 0.35rem 0.45rem; align-items: center; padding: 0.65rem 1.5rem; list-style: none; }
    .breadcrumb li { display: flex; min-width: 0; align-items: center; gap: 0.45rem; }
    .breadcrumb li + li::before { content: "/"; color: #aaa; flex: 0 0 auto; }
    .breadcrumb a { color: #1f5b45; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .breadcrumb span[aria-current="page"] { color: #333; font-weight: bold; overflow-wrap: anywhere; }
    .page-nav { margin-bottom: 1rem; display: flex; gap: 1rem; flex-wrap: wrap; }
    .page-nav a { color: #2d6a4f; text-decoration: none; }
    .ui-state {
      margin: 1rem 1.5rem;
      border: 1px solid #d7e4dd;
      background: #f8fbf9;
      padding: 1rem;
      display: grid;
      gap: 0.75rem;
      color: #3f4f45;
    }
    .ui-state--error { border-color: #edc8cd; background: #fff7f8; color: #6a2a33; }
    .ui-state-message { line-height: 1.6; }
    .ui-state-actions { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    @media (max-width: 640px) {
      .ui-btn, .ui-touch-target { min-height: 44px; }
      .site-header { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.6rem; padding: 0.75rem; }
      .site-heading { flex: 1 1 100%; }
      .site-header h1 { font-size: 1.2rem; line-height: 1.35; }
      .site-header p { font-size: 0.78rem; line-height: 1.45; }
      .header-search { flex: 1 1 140px; width: auto; min-width: 0; max-width: none; }
      .header-search input, .header-search button { min-height: 44px; }
      .header-search button span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      .pref-selector { flex: 0 1 auto; width: auto; }
      .pref-selector label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
      .pref-selector select { flex: 1 1 auto; min-width: 0; max-width: 8rem; min-height: 44px; }
      .pref-selector button { min-height: 44px; }
      .header-toggle { display: inline-flex; align-items: center; justify-content: center; order: 2; margin-left: auto; width: 40px; height: 40px; padding: 0; border: 1px solid #cddbd2; background: #fff; color: #1f5b45; cursor: pointer; }
      .header-toggle .ht-icon-collapsed { display: none; }
      .header-toggle[aria-expanded="false"] .ht-icon-expanded { display: none; }
      .header-toggle[aria-expanded="false"] .ht-icon-collapsed { display: inline-flex; }
      html.kz-header-collapsed .site-header { gap: 0.5rem; padding: 0.5rem 0.75rem; }
      html.kz-header-collapsed .site-header .site-heading p,
      html.kz-header-collapsed .header-search,
      html.kz-header-collapsed .pref-selector { display: none; }
      html.kz-header-collapsed .global-nav { display: none; }
      .global-nav { display: flex; flex-wrap: nowrap; gap: 0; padding: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
      .global-nav a { flex: 0 0 auto; display: flex; gap: 0.3rem; min-height: 44px; align-items: center; white-space: nowrap; padding: 0.55rem 0.85rem; border-right: 1px solid #eee; font-size: 0.82rem; }
      .global-nav a:last-child { border-right: 0; }
      .global-nav .nav-admin { margin-left: 0; }
      .breadcrumb ol { padding: 0.6rem 0.75rem; }
      .page-nav { gap: 0.5rem; }
      .page-nav a { display: inline-flex; align-items: center; min-height: 44px; }
      .ui-state { margin: 0.75rem; padding: 0.85rem; }
    }`;

function renderSiteHeader(): string {
  return `  <header class="site-header">
    <div class="site-heading">
      <h1><a href="/">近畿動物園情報</a></h1>
      <p>近畿一円の動物園・施設をまとめて調べられます</p>
    </div>
    <button type="button" class="header-toggle" data-header-toggle aria-expanded="true" aria-label="ヘッダーとメニューの開閉">${icon("expand_less", "ht-icon-expanded")}${icon("expand_more", "ht-icon-collapsed")}</button>
  </header>`;
}

function renderGlobalNav(activePath: string): string {
  const navItems: [href: string, iconName: IconName, label: string][] = [
    ["/", "home", "トップ"],
    ["/zoos", "location_city", "動物園"],
    ["/animals", "pets", "動物一覧"],
    ["/news", "campaign", "お知らせ"],
    ["/favorites", "star_border", "お気に入り"],
    ["/admin", "admin_panel_settings", "管理"],
  ];
  const links = navItems
    .map(([href, iconName, label], i) => {
      const isActive = href === "/" ? activePath === "/" : activePath === href || activePath.startsWith(`${href}/`);
      const cls = i === navItems.length - 1 ? ' class="nav-admin"' : "";
      return `<a href="${href}"${cls}${isActive ? ' aria-current="page"' : ""}>${icon(iconName)}<span>${label}</span></a>`;
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

function renderNewsAnimalLinks(
  animals: string[],
  imageKeys: AnimalImageVersionIndex = new Map()
): string {
  return animals
    .map((name) => {
      const animalKey = normalizeAnimalImageKey(name);
      const thumb = imageKeys.has(animalKey)
        ? `<img src="${buildAnimalImageUrl(name, imageKeys.get(animalKey))}" alt="" class="news-animal-thumb" loading="lazy" width="24" height="24">`
        : "";
      return `<a href="${buildZooAnimalUrl(name)}">${thumb}<span>${escapeHtml(formatAnimalDisplayName(name))}</span></a>`;
    })
    .join("");
}

function renderAnimalImagePlaceholder(
  className: string,
  options: {
    label?: string;
    detail?: string;
    compact?: boolean;
    ariaHidden?: boolean;
  } = {}
): string {
  const {
    label = "準備中",
    detail,
    compact = false,
    ariaHidden = false,
  } = options;
  const classes = [
    className,
    "ui-animal-placeholder",
    compact ? "ui-animal-placeholder--compact" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const textHtml = `<strong>${escapeHtml(label)}</strong>`;
  const detailHtml = detail ? `<small>${escapeHtml(detail)}</small>` : "";
  return `<div class="${classes}"${ariaHidden ? ' aria-hidden="true"' : ""}>
    <span class="ui-animal-placeholder-icon"></span>
    ${textHtml}
    ${detailHtml}
  </div>`;
}

const ADMIN_BREADCRUMB_CSS = `
    .admin-breadcrumb { display: flex; align-items: center; flex-wrap: wrap; gap: 0.2rem; font-size: 0.8rem; color: #aaa; }
    .admin-breadcrumb a { color: #1f5b45; text-decoration: none; }
    .admin-breadcrumb a:hover { text-decoration: underline; }
    .admin-breadcrumb .sep { margin: 0 0.15rem; }
    .admin-breadcrumb [aria-current] { color: #555; }`;

function renderAdminBreadcrumb(crumbs: { href?: string; label: string }[]): string {
  const all = [{ href: "/admin" as string | undefined, label: "管理" }, ...crumbs];
  const parts = all.map((c, i) => {
    const isLast = i === all.length - 1;
    const el = isLast
      ? `<span aria-current="page">${escapeHtml(c.label)}</span>`
      : `<a href="${c.href}">${escapeHtml(c.label)}</a>`;
    return i < all.length - 1 ? `${el}<span class="sep">/</span>` : el;
  });
  return `<nav class="admin-breadcrumb" aria-label="管理パンくず">${parts.join("")}</nav>`;
}

function renderScrapeStatusHtml(rows: ScrapeStatusRow[]): string {
  const now = new Date();
  const fmt = (iso: string | null) => {
    if (!iso) return `<span class="status-none">未取得</span>`;
    const d = new Date(iso);
    const hoursAgo = (now.getTime() - d.getTime()) / 3600000;
    const label = iso.slice(0, 16).replace("T", " ");
    const cls = hoursAgo > 30 ? "status-stale" : "status-ok";
    return `<span class="${cls}">${label}</span>`;
  };

  const rowsHtml = rows.map((row) => {
    const zoo = zoos.find((z) => z.id === row.zoo_id);
    return `<tr>
      <td><a href="/zoos/${escapeHtml(row.zoo_id)}">${escapeHtml(zoo?.name ?? row.zoo_id)}</a></td>
      <td>${fmt(row.animal_scraped_at)}</td>
      <td>${fmt(row.news_fetched_at)}</td>
      <td>${row.news_count}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>スクレイプ状況 | 管理</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 900px; margin: 0 auto; padding: 1.5rem; display: grid; gap: 1.5rem; }
    h1 { font-size: 1.2rem; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; vertical-align: middle; }
    thead th { background: #f5f5f5; font-weight: bold; }
    a { color: #1f5b45; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .status-ok { color: #1f6b3d; }
    .status-stale { color: #b36a00; font-weight: bold; }
    .status-none { color: #999; }${ADMIN_BREADCRUMB_CSS}
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/admin")}
  <main>
    ${renderAdminBreadcrumb([{ label: "スクレイプ状況" }])}
    <h1>スクレイプ状況</h1>
    <table>
      <thead><tr><th>動物園</th><th>動物 最終取得</th><th>お知らせ 最終取得</th><th>お知らせ件数</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </main>
</body>
</html>`;
}

function renderAdminTopHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>管理 | 近畿動物園情報</title>
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
    <h1>管理</h1>
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
        <a href="/admin/scrape-status">
          スクレイプ状況
          <small>動物・お知らせの最終取得日時と件数を確認する</small>
        </a>
      </li>
      <li>
        <a href="/admin/scrape-health">
          スクレイプ監視
          <small>取得件数の急減・エラー・期待件数割れを確認する</small>
        </a>
      </li>
      <li>
        <a href="/admin/scrape-history">
          データ更新履歴
          <small>スクレイピングごとの追加・削除・警告を確認する</small>
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
          <td class="diff-counts">
            <span class="diff-added">+${item.addedCount}</span>
            <span class="diff-removed">-${item.removedCount}</span>
            <span class="diff-renamed">名 ${item.renamedCount}</span>
          </td>
          <td>${refreshed}</td>
          <td>${item.error ? escapeHtml(item.error) : warnings}</td>
          <td><a href="/api/zoos/${encodeURIComponent(item.zoo.id)}/animals?refresh=1">再取得</a></td>
        </tr>`;
    })
    .join("");
  const warningCount = items.filter((item) => item.error || item.warningCount > 0).length;
  const staleCount = items.filter((item) => !item.scrapedAt).length;
  const totalAdded = items.reduce((sum, item) => sum + item.addedCount, 0);
  const totalRemoved = items.reduce((sum, item) => sum + item.removedCount, 0);
  const totalRenamed = items.reduce((sum, item) => sum + item.renamedCount, 0);

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
    .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.65rem; }
    .summary-card { border: 1px solid #dce7df; background: #f8fbf9; padding: 0.75rem; }
    .summary-card dt { color: #666; font-size: 0.76rem; margin-bottom: 0.2rem; }
    .summary-card dd { color: #222; font-size: 1.25rem; font-weight: bold; }
    .admin-links { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.86rem; }
    .admin-links a { color: #1f5b45; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { border-bottom: 1px solid #e5e5e5; padding: 0.65rem 0.5rem; text-align: left; vertical-align: top; }
    thead th { color: #666; font-size: 0.78rem; background: #f7faf8; }
    tbody th { font-weight: normal; }
    tbody tr.warning { background: #fff9e8; }
    tbody tr.error { background: #fff0f0; }
    .status { display: inline-block; min-width: 3.4rem; border-radius: 999px; padding: 0.16rem 0.5rem; text-align: center; font-size: 0.78rem; background: #edf7ef; color: #1f5b45; }
    tr.warning .status { background: #fff1bf; color: #765000; }
    tr.error .status { background: #ffd6d6; color: #8a1f1f; }
    .diff-counts { white-space: nowrap; }
    .diff-counts span { display: inline-block; margin-right: 0.45rem; font-size: 0.82rem; }
    .diff-added { color: #1f6f3d; }
    .diff-removed { color: #a12b2b; }
    .diff-renamed { color: #765000; }
    td ul { padding-left: 1.1rem; }
    td a, th a { color: #1f5b45; }
    @media (max-width: 720px) {
      main { padding: 1rem 0.75rem; }
      .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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
    <dl class="summary-grid">
      <div class="summary-card"><dt>警告・エラー</dt><dd>${warningCount}</dd></div>
      <div class="summary-card"><dt>未取得</dt><dd>${staleCount}</dd></div>
      <div class="summary-card"><dt>追加 / 削除</dt><dd>+${totalAdded} / -${totalRemoved}</dd></div>
      <div class="summary-card"><dt>名称変更候補</dt><dd>${totalRenamed}</dd></div>
    </dl>
    <p class="summary">最新取得に紐づく警告と差分を施設ごとに表示しています。</p>
    <p class="admin-links"><a href="/admin/scrape-history">更新履歴を見る</a></p>
    <table>
      <thead>
        <tr>
          <th scope="col">施設</th>
          <th scope="col">状態</th>
          <th scope="col">件数</th>
          <th scope="col">最新差分</th>
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

function renderScrapeHistoryAdminHtml(items: ScrapeHistoryItem[], zooId: string | null = null): string {
  const zooFilterHtml = `<form class="zoo-history-filter" action="/admin/scrape-history" method="get">
    <select name="zoo" onchange="this.form.submit()">
      <option value="">すべての施設</option>
      ${zoos
        .map(
          (zoo) =>
            `<option value="${escapeHtml(zoo.id)}"${zoo.id === zooId ? " selected" : ""}>${escapeHtml(zoo.name)}</option>`
        )
        .join("")}
    </select>
    <noscript><button type="submit">絞り込む</button></noscript>
  </form>`;
  const previewList = (values: string[], emptyLabel: string) => {
    if (values.length === 0) return `<span class="muted">${emptyLabel}</span>`;
    const visible = values.slice(0, 6);
    const more = values.length - visible.length;
    return `${visible.map((value) => `<span class="name-chip">${escapeHtml(value)}</span>`).join("")}${more > 0 ? `<span class="muted">ほか ${more} 件</span>` : ""}`;
  };
  const rows = items
    .map((item) => {
      const statusClass = item.error ? "error" : item.warningCount > 0 ? "warning" : "";
      const warnings = item.warningMessages.length > 0
        ? `<ul>${item.warningMessages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>`
        : `<span class="muted">なし</span>`;
      const renamed = item.renamedPairs.length === 0
        ? `<span class="muted">なし</span>`
        : item.renamedPairs
            .slice(0, 4)
            .map((pair) => `<span class="rename-chip">${escapeHtml(pair.previous)} → ${escapeHtml(pair.current)}</span>`)
            .join("");
      const hiddenRenamed = item.renamedPairs.length > 4 ? `<span class="muted">ほか ${item.renamedPairs.length - 4} 件</span>` : "";
      return `
        <article class="history-item ${statusClass}">
          <header class="history-header">
            <div>
              <h2><a href="/zoos/${encodeURIComponent(item.zooId)}">${escapeHtml(item.zooName)}</a></h2>
              <p>${formatDateTime(item.scrapedAt)} / ${item.animalCount} 件</p>
            </div>
            <dl class="diff-summary">
              <div><dt>追加</dt><dd class="diff-added">+${item.addedCount}</dd></div>
              <div><dt>削除</dt><dd class="diff-removed">-${item.removedCount}</dd></div>
              <div><dt>名称変更</dt><dd class="diff-renamed">${item.renamedCount}</dd></div>
              <div><dt>警告</dt><dd>${item.warningCount}</dd></div>
            </dl>
          </header>
          ${item.error ? `<p class="error-text">取得エラー: ${escapeHtml(item.error)}</p>` : ""}
          <div class="history-grid">
            <section>
              <h3>追加</h3>
              <p>${previewList(item.addedNames, "なし")}</p>
            </section>
            <section>
              <h3>削除</h3>
              <p>${previewList(item.removedNames, "なし")}</p>
            </section>
            <section>
              <h3>名称変更候補</h3>
              <p>${renamed}${hiddenRenamed}</p>
            </section>
            <section>
              <h3>警告</h3>
              ${warnings}
            </section>
          </div>
        </article>`;
    })
    .join("");
  const empty = items.length === 0 ? `<p class="empty">更新履歴はまだありません。</p>` : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>データ更新履歴 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1120px; margin: 0 auto; padding: 1.25rem 1.5rem 2rem; display: grid; gap: 1rem; }
    h1 { font-size: 1.2rem; }
    .summary { color: #555; font-size: 0.9rem; }
    .admin-links { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.86rem; }
    .admin-links a, h2 a { color: #1f5b45; }
    .zoo-history-filter select { min-height: 38px; border: 1px solid #bbb; padding: 0.35rem 0.55rem; font-size: 0.86rem; max-width: 20rem; }
    .history-list { display: grid; gap: 0.85rem; }
    .history-item { border: 1px solid #ddd; padding: 0.9rem; display: grid; gap: 0.8rem; }
    .history-item.warning { background: #fffaf0; border-color: #eed89a; }
    .history-item.error { background: #fff4f4; border-color: #efb3b3; }
    .history-header { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
    .history-header h2 { font-size: 1rem; margin-bottom: 0.2rem; }
    .history-header p { color: #666; font-size: 0.82rem; }
    .diff-summary { display: grid; grid-template-columns: repeat(4, minmax(4rem, 1fr)); gap: 0.45rem; min-width: 22rem; }
    .diff-summary div { background: #fff; border: 1px solid #e1e8e3; padding: 0.45rem; }
    .diff-summary dt { color: #666; font-size: 0.72rem; }
    .diff-summary dd { font-weight: bold; margin-top: 0.12rem; }
    .diff-added { color: #1f6f3d; }
    .diff-removed { color: #a12b2b; }
    .diff-renamed { color: #765000; }
    .history-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; }
    .history-grid h3 { color: #666; font-size: 0.78rem; margin-bottom: 0.35rem; }
    .history-grid p { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .history-grid ul { padding-left: 1.1rem; color: #555; font-size: 0.82rem; }
    .name-chip, .rename-chip { display: inline-block; border: 1px solid #d7eadc; background: #fff; color: #1f5b45; padding: 0.18rem 0.45rem; font-size: 0.76rem; }
    .rename-chip { color: #765000; border-color: #eadca6; }
    .muted { color: #888; font-size: 0.78rem; }
    .error-text { color: #9b1c1c; font-size: 0.86rem; }
    .empty { color: #777; padding: 1rem; border: 1px solid #ddd; }
    @media (max-width: 760px) {
      main { padding: 1rem 0.75rem; }
      .history-header { display: grid; }
      .diff-summary, .history-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); min-width: 0; }
    }${ADMIN_BREADCRUMB_CSS}
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/admin")}
  <main>
    ${renderAdminBreadcrumb([{ label: "データ更新履歴" }])}
    <h1>データ更新履歴</h1>
    <p class="summary">直近 ${items.length} 件のスクレイピング実行から、追加・削除・名称変更候補・警告を表示します。</p>
    <p class="admin-links"><a href="/admin/scrape-health">スクレイプ監視へ戻る</a></p>
    ${zooFilterHtml}
    ${empty || `<div class="history-list">${rows}</div>`}
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
    const displayLabel = formatAnimalDisplayName(a.display_name);
    const canonicalLabel = a.canonical_name ? formatAnimalDisplayName(a.canonical_name) : null;
    const classifyBtn = group === "applied"
      ? `<button class="classify-btn classify-btn--rerun" data-name="${escapeHtml(a.display_name)}">再分類</button>`
      : `<button class="classify-btn" data-name="${escapeHtml(a.display_name)}">分類</button>`;
    return `<tr data-group="${group}">
      <td class="name-cell"><a href="/animal/${encodeURIComponent(a.display_name)}">${escapeHtml(displayLabel)}</a>${canonicalLabel && canonicalLabel !== displayLabel ? `<br><small>${escapeHtml(canonicalLabel)}</small>` : ""}</td>
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
        var res = await fetch((window.__BASE_PATH__ || '') + '/animal/' + encodeURIComponent(name) + '/classify', {method: 'POST'});
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
  notice?: string,
  noImage: boolean = false
): string {
  const escapedQuery = query ? escapeHtml(query) : "";
  const modelOptions = GEMINI_IMAGE_MODELS.map(
    (model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`
  ).join("");
  const rows = items
    .map((item) => {
      const displayLabel = formatAnimalDisplayName(item.displayName);
      const selected = item.selectedGenerationId
        ? `<span class="status selected">選択済み #${item.selectedGenerationId}</span>`
        : `<span class="status empty">未選択</span>`;
      const preview = item.selectedGenerationId
        ? `<img src="/animal-images/${encodeURIComponent(item.displayName)}?v=${item.selectedGenerationId}" alt="${escapeHtml(displayLabel)}">`
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
                <img src="/admin/animal-image-generations/${generation.id}" alt="${escapeHtml(displayLabel)} #${generation.id}">
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
              <h2>${escapeHtml(displayLabel)}</h2>
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
  <title>管理 | 近畿動物園情報</title>
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
    .toolbar-check { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.86rem; cursor: pointer; }
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
      <label class="toolbar-check"><input type="checkbox" name="no_image" value="1"${noImage ? " checked" : ""}> 画像なしのみ</label>
      <button type="submit">検索</button>
      ${query || noImage ? `<a href="/admin/animal-images">クリア</a>` : ""}
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
  const displayLabel = formatAnimalDisplayName(displayName);
  const escapedName = escapeHtml(displayLabel);
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
        ? `<button type="submit" class="ui-btn ui-btn--secondary ui-touch-target" disabled>使用中</button>`
        : `<button type="submit" class="ui-btn ui-btn--secondary ui-touch-target">この画像を使う</button>`;
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
    .generate-form button { justify-self: start; }
    .hint { color: #666; font-size: 0.82rem; line-height: 1.5; }
    .gallery-section { border-top: 1px solid #ddd; padding-top: 1rem; }
    .generation-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.9rem; }
    .generation-card { display: grid; gap: 0.55rem; min-width: 0; }
    .generation-image { position: relative; aspect-ratio: 1; border: 1px solid #ddd; background: #f7f7f7; overflow: hidden; }
    .generation-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .selected-badge { position: absolute; top: 0.45rem; left: 0.45rem; background: #1f5b45; color: #fff; font-size: 0.76rem; padding: 0.18rem 0.45rem; }
    .generation-meta { display: grid; gap: 0.2rem; font-size: 0.8rem; color: #555; }
    .generation-meta h3 { font-size: 0.9rem; color: #222; }
    .generation-card button { width: 100%; }
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
    ${renderAdminBreadcrumb([{ href: "/admin/animal-images", label: "画像管理" }, { label: displayLabel }])}
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
          <button type="submit" class="ui-btn ui-btn--primary ui-touch-target">画像生成</button>
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

function renderHomeHtml(
  results: ZooSearchResult[],
  activePref: PrefectureCode | null,
  latestNews: ZooNewsRow[] = [],
  imageKeys: AnimalImageVersionIndex = new Map()
): string {
  const count = results.length;
  const totalAnimalCount = results.reduce((sum, result) => sum + result.animalCount, 0);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    .home-overview { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr); gap: 1.25rem; padding: 1.35rem 1.5rem; border-bottom: 1px solid #ddd; background: #fbfcfb; }
    .home-overview-main { display: grid; align-content: center; gap: 0.55rem; min-width: 0; }
    .home-kicker { color: #617469; font-size: 0.8rem; font-weight: bold; }
    .home-overview h2 { font-size: 1.35rem; line-height: 1.35; }
    .home-lead { max-width: 44rem; color: #4c5d53; font-size: 0.92rem; line-height: 1.65; }
    .home-primary-actions { display: flex; flex-wrap: wrap; gap: 0.55rem; margin-top: 0.15rem; }
    .home-overview-side { display: grid; gap: 0.65rem; align-content: start; min-width: 0; }
    .home-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.45rem; }
    .home-stats div { min-width: 0; border: 1px solid #e0e8e3; background: #fff; padding: 0.6rem 0.65rem; }
    .home-stats dt { color: #66756b; font-size: 0.72rem; margin-bottom: 0.2rem; }
    .home-stats dd { display: flex; align-items: baseline; gap: 0.22rem; color: #222; }
    .home-stats strong { font-size: 1.25rem; line-height: 1; }
    .home-stats span { color: #66756b; font-size: 0.72rem; }
    .home-featured-zoo { display: grid; gap: 0.25rem; border: 1px solid #e0e8e3; background: #fff; padding: 0.7rem; }
    .home-featured-zoo > span { color: #66756b; font-size: 0.74rem; font-weight: bold; }
    .home-featured-link { display: flex; justify-content: space-between; gap: 0.75rem; align-items: baseline; color: #1f5b45; text-decoration: none; }
    .home-featured-link:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .home-featured-link span { font-weight: bold; overflow-wrap: anywhere; }
    .home-featured-link small, .home-featured-empty { color: #66756b; font-size: 0.78rem; }
    .explore-section { padding: 1rem 1.5rem; border-bottom: 1px solid #ddd; display: grid; gap: 0.85rem; }
    .explore-heading { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; align-items: baseline; justify-content: space-between; }
    .explore-heading h2 { font-size: 1.08rem; }
    .explore-heading p { color: #666; font-size: 0.86rem; }
    .section-link { color: #1f5b45; font-size: 0.82rem; text-decoration: none; }
    .section-link:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .explore-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.7rem; }
    .explore-card { display: grid; gap: 0.24rem; min-height: 7rem; align-content: start; padding: 0.85rem; }
    .explore-card span { font-weight: bold; font-size: 0.98rem; }
    .explore-card small { color: #617469; font-size: 0.76rem; }
    .explore-card em { color: #3f4f45; font-size: 0.8rem; line-height: 1.45; font-style: normal; }
    .spotlight-section { padding: 1rem 1.5rem; border-bottom: 1px solid #ddd; display: grid; gap: 0.85rem; }
    .spotlight-heading { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; align-items: baseline; justify-content: space-between; }
    .spotlight-heading h2 { font-size: 1.08rem; }
    .spotlight-heading p { color: #666; font-size: 0.86rem; }
    .spotlight-block { display: grid; gap: 0.5rem; }
    .spotlight-sub-heading { display: flex; align-items: baseline; gap: 0.5rem; }
    .spotlight-sub-heading h3 { font-size: 0.88rem; color: #444; font-weight: bold; }
    .spotlight-more { font-size: 0.78rem; color: #1f5b45; text-decoration: none; margin-left: auto; }
    .spotlight-more:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .spotlight-animal-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 0.5rem; }
    .spotlight-animal-card { display: grid; gap: 0.2rem; padding: 0.5rem; align-content: start; justify-items: center; text-align: center; }
    .spotlight-animal-img { width: 72px; height: 72px; object-fit: cover; border-radius: 3px; background: #f0f0f0; display: block; }
    .spotlight-animal-card span { font-size: 0.82rem; font-weight: bold; }
    .spotlight-animal-card small { color: #617469; font-size: 0.72rem; }
    .spotlight-zoo-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.5rem; }
    .spotlight-zoo-card { display: grid; gap: 0.2rem; padding: 0.85rem; align-content: start; }
    .spotlight-zoo-card span { font-weight: bold; font-size: 0.9rem; }
    .spotlight-zoo-card small { color: #617469; font-size: 0.76rem; }
    .latest-news-section { padding: 1rem 1.5rem; border-bottom: 1px solid #ddd; display: grid; gap: 0.65rem; background: #fafcfb; }
    .latest-news-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
    .latest-news-heading h2 { font-size: 1.08rem; }
    .section-link { font-size: 0.8rem; color: #1f5b45; text-decoration: none; white-space: nowrap; }
    .section-link:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .latest-news-list { list-style: none; display: grid; gap: 0; }
    .latest-news-list li { display: grid; gap: 0.25rem; padding: 0.65rem 0.5rem; border-bottom: 1px solid #e5eee8; }
    .latest-news-list li:first-child { border-top: 1px solid #e5eee8; }
    .latest-news-list li:hover { background: #f2f8f4; }
    .news-meta { display: flex; flex-wrap: wrap; gap: 0.3rem 0.5rem; align-items: center; }
    .news-date { color: #888; font-size: 0.74rem; font-variant-numeric: tabular-nums; flex-shrink: 0; }
    .news-zoo-label { color: #1f5b45; font-size: 0.76rem; font-weight: bold; text-decoration: none; flex-shrink: 0; }
    .news-zoo-label:hover { text-decoration: underline; }
    .news-title { color: #1a1a1a; text-decoration: none; font-size: 0.9rem; line-height: 1.5; overflow-wrap: anywhere; }
    .news-title:hover { color: #1f5b45; text-decoration: underline; text-underline-offset: 0.2em; }
    .latest-news-list .news-animals { display: flex; flex-wrap: wrap; gap: 0.25rem; }
    .latest-news-list .news-animals a { font-size: 0.7rem; color: #1f5b45; background: #f0f7f3; border: 1px solid #c5dece; padding: 0.08rem 0.4rem; text-decoration: none; }
    .latest-news-list .news-animals a:hover { background: #e1f0e8; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
    @media (max-width: 700px) {
      .home-overview { grid-template-columns: 1fr; gap: 0.85rem; padding: 1rem 0.75rem; }
      .home-overview h2 { font-size: 1.15rem; }
      .home-lead { font-size: 0.86rem; }
      .home-primary-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .home-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .home-stats div { padding: 0.55rem 0.45rem; }
      .home-stats strong { font-size: 1.05rem; }
      .explore-section { padding: 0.75rem; }
      .explore-heading { display: grid; gap: 0.25rem; }
      .explore-grid { grid-template-columns: 1fr; gap: 0.5rem; }
      .explore-card { min-height: 0; }
      .spotlight-section { padding: 0.75rem; }
      .spotlight-heading { display: grid; gap: 0.25rem; }
      .spotlight-animal-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .spotlight-zoo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      footer { padding: 1rem 0.75rem; line-height: 1.5; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/")}
  ${renderHomeOverview(activePref, count, totalAnimalCount)}
  ${latestNews.length > 0 ? `<section class="latest-news-section">
    <div class="latest-news-heading">
      <h2 class="icon-heading">${icon("campaign")}最新のお知らせ</h2>
      <a href="/news" class="section-link">すべて見る →</a>
    </div>
    <ul class="latest-news-list">
      ${latestNews.map((item) => {
        const zoo = zoos.find((z) => z.id === item.zoo_id);
        const animals = item.animal_names ? item.animal_names.split(",").filter(Boolean) : [];
        const animalsHtml = animals.length > 0
          ? `<div class="news-animals">${renderNewsAnimalLinks(animals, imageKeys)}</div>`
          : "";
        const badges = renderNewsItemBadges(item.title, item.published_at);
        return `<li>
          <div class="news-meta">
            ${item.published_at ? `<span class="news-date">${escapeHtml(item.published_at)}</span>` : ""}
            ${zoo ? `<a class="news-zoo-label" href="/zoos/${escapeHtml(zoo.id)}">${escapeHtml(zoo.name)}</a>` : ""}
            ${badges}
          </div>
          <a class="news-title" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
          ${animalsHtml}
        </li>`;
      }).join("")}
    </ul>
  </section>` : ""}
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
  <script src="/favorites.js?v=5" defer></script>
</body>
</html>`;
}

function renderSearchAnimalCards(
  animals: AnimalListItem[],
  imageKeys: AnimalImageVersionIndex
): string {
  return animals
    .map((item) => {
      const primaryDisplayName = item.displayNames[0] ?? item.canonicalName ?? "";
      const rawTitle = item.canonicalName ?? primaryDisplayName;
      const title = formatAnimalDisplayName(rawTitle);
      const primaryDisplayLabel = formatAnimalDisplayName(primaryDisplayName);
      const imageDisplayName = item.displayNames.find((name) => imageKeys.has(normalizeAnimalImageKey(name)));
      const imageVersion = imageDisplayName ? imageKeys.get(normalizeAnimalImageKey(imageDisplayName)) : null;
      const thumb = imageDisplayName
        ? `<img src="${buildAnimalImageUrl(imageDisplayName, imageVersion)}" alt="" class="search-animal-thumb ui-thumb" loading="lazy" width="56" height="56">`
        : renderAnimalImagePlaceholder("search-animal-thumb", { compact: true, ariaHidden: true });
      const taxonomy = [item.className, item.orderName, item.familyName].filter(Boolean).join(" / ");
      const aliases = uniqueDisplayNames(item.displayNames.map(formatAnimalDisplayName))
        .filter((name) => name !== title)
        .slice(0, 3);
      const aliasText = aliases.length > 0 ? `<p class="search-alias">別名: ${aliases.map(escapeHtml).join("、")}</p>` : "";
      const zooLinks = item.zoos
        .slice(0, 8)
        .map((zoo) => `<a class="ui-chip" href="/zoos/${encodeURIComponent(zoo.id)}">${escapeHtml(zoo.name)}</a>`)
        .join("");
      const moreZoos = item.zoos.length > 8 ? `<span class="search-more">ほか ${item.zoos.length - 8} 施設</span>` : "";

      return `
        <article class="search-animal-card">
          <div class="search-animal-head">
            <a class="search-animal-main" href="${buildZooAnimalUrl(primaryDisplayName)}">
              ${thumb}
              <span>
                <strong>${escapeHtml(title)}</strong>
                ${primaryDisplayName && title !== primaryDisplayLabel ? `<small>${escapeHtml(primaryDisplayLabel)}</small>` : ""}
              </span>
            </a>
            ${renderFavoriteButton("animal", rawTitle, title, buildZooAnimalUrl(primaryDisplayName))}
          </div>
          ${taxonomy ? `<p class="search-taxonomy">${escapeHtml(taxonomy)}</p>` : `<p class="search-taxonomy">分類未設定</p>`}
          ${aliasText}
          <div class="search-zoo-links" aria-label="見られる施設">${zooLinks}${moreZoos}</div>
        </article>`;
    })
    .join("");
}

function renderSearchTaxonomyCards(taxonomies: TaxonomySearchResult[]): string {
  return taxonomies
    .map(
      (item) => `
        <a class="search-taxonomy-card ui-card-link ui-touch-target" href="${item.href}">
          <span>${escapeHtml(item.name)}</span>
          <small>${escapeHtml(item.rank.label)} / ${item.animalCount} 種 / ${item.zooCount} 施設</small>
        </a>`
    )
    .join("");
}

function renderSearchHtml(
  results: SiteSearchResults,
  activePref: PrefectureCode | null,
  imageKeys: AnimalImageVersionIndex
): string {
  const query = results.query ?? "";
  const escapedQuery = escapeHtml(query);
  const prefLabel = activePref ? PREF_LABELS[activePref] : "近畿一円";
  const hasQuery = Boolean(query);
  const hasResults = results.animals.length > 0 || results.zoos.length > 0 || results.taxonomies.length > 0;
  const visibleAnimals = results.animals.slice(0, 5);
  const visibleZoos = results.zoos.slice(0, 5);
  const visibleTaxonomies = results.taxonomies.slice(0, 5);
  const animalCards = renderSearchAnimalCards(visibleAnimals, imageKeys);
  const taxonomyCards = renderSearchTaxonomyCards(visibleTaxonomies);
  const zooRows = visibleZoos.map((result) => renderZooCard(result, true)).join("\n");
  const animalMore = results.animals.length > visibleAnimals.length
    ? `<a href="/animals?q=${encodeURIComponent(query)}" class="section-link">動物をもっと見る →</a>`
    : "";
  const zooMore = results.zoos.length > visibleZoos.length
    ? `<div class="section-actions">
        <a href="${buildBrowseUrl(activePref, query)}" class="section-link">動物園一覧へ →</a>
        <a href="${buildMapUrl(activePref, query)}" class="section-link">地図を見る →</a>
      </div>`
    : "";
  const taxonomyMore = results.taxonomies.length > visibleTaxonomies.length
    ? `<a href="${buildTaxonomyIndexUrl()}" class="section-link">分類一覧へ →</a>`
    : "";
  const emptyHtml = !hasQuery
    ? renderStateMessage("動物名、施設名、分類名で検索できます。", [
        { href: "/animals", label: "動物一覧" },
        { href: buildBrowseUrl(activePref, null), label: "動物園一覧" },
      ])
    : !hasResults
      ? renderStateMessage(`「${query}」に該当する動物・施設が見つかりませんでした。`, [
          { href: "/animals", label: "動物一覧" },
          { href: buildTaxonomyIndexUrl(), label: "分類から探す" },
          { href: buildMapUrl(activePref, null), label: "地図で見る" },
        ])
      : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${hasQuery ? `${escapedQuery} の検索結果` : "検索"} | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1120px; margin: 0 auto; padding: 1rem 1.5rem 1.5rem; display: grid; gap: 1rem; }
    .search-title { display: grid; gap: 0.25rem; }
    .search-title h1 { font-size: 1.25rem; line-height: 1.35; }
    .search-title p { color: #666; font-size: 0.88rem; }
    .site-search-form { display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 0.5rem; align-items: center; padding: 0.75rem; border: 1px solid #dce7df; background: #f8fbf9; }
    .site-search-form input { min-width: 0; min-height: 44px; border: 1px solid #aaa; background: #fff; padding: 0.55rem 0.7rem; }
    .search-summary { color: #555; font-size: 0.9rem; }
    .search-section { display: grid; gap: 0.75rem; border-top: 1px solid #ddd; padding-top: 1rem; }
    .search-section-heading { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; align-items: baseline; justify-content: space-between; }
    .search-section-heading h2 { font-size: 1.05rem; }
    .search-section-heading small { color: #666; font-size: 0.8rem; }
    .section-link { color: #1f5b45; font-size: 0.82rem; text-decoration: none; }
    .section-link:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .section-actions { display: flex; flex-wrap: wrap; gap: 0.5rem 0.9rem; align-items: center; }
    .search-animal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; }
    .search-animal-card { display: grid; gap: 0.55rem; border: 1px solid #dce7df; padding: 0.75rem; background: #fff; }
    .search-animal-head { display: flex; align-items: center; gap: 0.5rem; }
    .search-animal-main { flex: 1 1 auto; min-width: 0; display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 0.65rem; align-items: center; color: #1f5b45; text-decoration: none; }
    .search-animal-main strong { display: block; overflow-wrap: anywhere; }
    .search-animal-main small { display: block; margin-top: 0.15rem; color: #66756b; font-size: 0.76rem; }
    .search-animal-main:hover strong { text-decoration: underline; text-underline-offset: 0.2em; }
    .search-animal-thumb { width: 56px; height: 56px; }
    img.search-animal-thumb { object-fit: cover; background: #f0f0f0; }
    .search-taxonomy, .search-alias { color: #555; font-size: 0.8rem; line-height: 1.45; }
    .search-zoo-links { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .search-zoo-links a { font-size: 0.76rem; }
    .search-more { color: #66756b; font-size: 0.76rem; align-self: center; }
    .search-taxonomy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.6rem; }
    .search-taxonomy-card { display: grid; gap: 0.2rem; padding: 0.65rem 0.75rem; }
    .search-taxonomy-card span { font-weight: bold; overflow-wrap: anywhere; }
    .search-taxonomy-card small { color: #617469; font-size: 0.75rem; }
    .zoo-list { overflow-x: auto; }
    .zoo-table { width: 100%; border-collapse: collapse; min-width: 480px; border: 1px solid #ddd; }
    .zoo-table th, .zoo-table td { border: 1px solid #ddd; padding: 0.65rem; vertical-align: top; font-size: 0.86rem; text-align: left; }
    .zoo-table thead th { background: #f7f7f7; color: #555; }
    .zoo-name a { color: #2d6a4f; text-decoration: none; font-size: 1rem; }
    .zoo-name a:hover { text-decoration: underline; }
    .kana { font-size: 0.8rem; color: #888; margin-top: 0.25rem; }
    .match-box { padding: 0.55rem; border: 1px solid #d7eadc; border-radius: 6px; background: #f3fbf5; display: grid; gap: 0.45rem; }
    .match-row { display: grid; gap: 0.35rem; }
    .match-label { color: #456052; font-size: 0.75rem; font-weight: bold; }
    .match-values { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .match-chip { border-color: #b7dcc3; background: #fff; color: #1b5e3b; padding: 0.18rem 0.55rem; font-size: 0.75rem; font-weight: bold; }
    .match-more { color: #5d7166; font-size: 0.75rem; align-self: center; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; border-top: 1px solid #eee; }
    @media (max-width: 700px) {
      main { padding: 0.85rem 0.75rem 1.25rem; }
      .site-search-form { grid-template-columns: 1fr; }
      .site-search-form button { min-height: 44px; }
      .search-animal-grid { grid-template-columns: 1fr; }
      .search-taxonomy-grid { grid-template-columns: 1fr; }
      .zoo-list { overflow: visible; }
      .zoo-table { min-width: 0; border: 0; }
      .zoo-table thead { display: none; }
      .zoo-table tbody, .zoo-table tr, .zoo-table th, .zoo-table td { display: block; width: 100%; }
      .zoo-table tr { margin-bottom: 0.5rem; border: 1px solid #d8ddd9; }
      .zoo-table th, .zoo-table td { border: 0; border-bottom: 1px solid #e5e8e6; padding: 0.45rem 0.75rem; }
      .zoo-table tr > :last-child { border-bottom: 0; }
      .zoo-table td::before { content: attr(data-label); display: block; margin-bottom: 0.25rem; color: #6a746d; font-size: 0.7rem; font-weight: bold; }
      .zoo-table td[data-label="都道府県"],
      .zoo-table td[data-label="動物種数"] { display: flex; align-items: baseline; gap: 0.5rem; }
      .zoo-table td[data-label="都道府県"]::before,
      .zoo-table td[data-label="動物種数"]::before { display: inline; margin-bottom: 0; flex: 0 0 auto; }
      .zoo-name { background: #f7faf8; padding: 0.6rem 0.75rem; }
      footer { padding: 1rem 0.75rem; line-height: 1.5; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/search")}
  <main>
    <div class="search-title">
      <h1>検索</h1>
      <p>${escapeHtml(prefLabel)}の動物、動物園、分類をまとめて探せます。</p>
    </div>
    <form class="site-search-form" action="/search" method="get">
      <input type="search" name="q" value="${escapedQuery}" placeholder="動物名・施設名・分類で検索" aria-label="検索キーワード">
      <button type="submit" class="ui-btn ui-btn--primary ui-touch-target">${icon("search")}検索</button>
    </form>
    ${hasQuery ? `<p class="search-summary">「${escapedQuery}」の検索結果: 動物 ${results.animals.length} 件 / 動物園 ${results.zoos.length} 件 / 分類 ${results.taxonomies.length} 件</p>` : ""}
    ${emptyHtml}
    ${results.animals.length > 0 ? `
    <section class="search-section" aria-labelledby="search-animals-title">
      <div class="search-section-heading">
        <h2 id="search-animals-title">動物</h2>
        ${animalMore || `<small>見られる施設も表示</small>`}
      </div>
      <div class="search-animal-grid">${animalCards}</div>
    </section>` : ""}
    ${results.taxonomies.length > 0 ? `
    <section class="search-section" aria-labelledby="search-taxonomy-title">
      <div class="search-section-heading">
        <h2 id="search-taxonomy-title">分類</h2>
        ${taxonomyMore || `<small>分類ページへ移動</small>`}
      </div>
      <div class="search-taxonomy-grid">${taxonomyCards}</div>
    </section>` : ""}
    ${results.zoos.length > 0 ? `
    <section class="search-section" aria-labelledby="search-zoos-title">
      <div class="search-section-heading">
        <h2 id="search-zoos-title">動物園・施設</h2>
        ${zooMore || `<small>施設名または掲載動物に一致</small>`}
      </div>
      <div class="zoo-list"><table class="zoo-table">
        <thead>
          <tr>
            <th scope="col">施設名</th>
            <th scope="col">都道府県</th>
            <th scope="col">動物種数</th>
            <th scope="col">検索ヒット</th>
          </tr>
        </thead>
        <tbody>${zooRows}</tbody>
      </table></div>
    </section>` : ""}
  </main>
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
  <script src="/favorites.js?v=5" defer></script>
</body>
</html>`;
}

function buildAnimalsUrl(
  filter: AnimalListFilter,
  query: string | null = null,
  taxonomy: Partial<AnimalTaxonomySelection> = {}
): string {
  const params = new URLSearchParams();
  if (filter === "unclassified") params.set("filter", "unclassified");
  if (query) params.set("q", query);
  if (taxonomy.className) params.set("cls", taxonomy.className);
  if (taxonomy.orderName) params.set("order", taxonomy.orderName);
  if (taxonomy.familyName) params.set("family", taxonomy.familyName);
  if (taxonomy.genusName) params.set("genus", taxonomy.genusName);
  const serialized = params.toString();
  return serialized ? `/animals?${serialized}` : "/animals";
}

function countAnimalTaxonomyValues(
  animals: AnimalListItem[],
  getValue: (animal: AnimalListItem) => string | undefined
): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const animal of animals) {
    const value = getValue(animal);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, "ja-JP"));
}

function renderAnimalTaxonomyFilterRow(
  label: string,
  values: Array<{ name: string; count: number }>,
  selectedValue: string | null,
  allCount: number,
  allHref: string,
  buildValueHref: (value: string) => string
): string {
  const visibleValues = selectedValue && !values.some((value) => value.name === selectedValue)
    ? [{ name: selectedValue, count: 0 }, ...values]
    : values;
  const valueChips = visibleValues
    .map(({ name, count }) => {
      const active = name === selectedValue;
      return `<a href="${escapeHtml(buildValueHref(name))}" class="ui-chip ui-touch-target${active ? " ui-chip--active" : ""}"${active ? ' aria-current="true"' : ""}>${escapeHtml(name)} <span>${count}</span></a>`;
    })
    .join("");

  return `<div class="taxonomy-filter-row">
    <h3>${escapeHtml(label)}を選ぶ</h3>
    <div class="taxonomy-filter-values" aria-label="${escapeHtml(label)}で絞り込み">
      <a href="${escapeHtml(allHref)}" class="ui-chip ui-touch-target${selectedValue ? "" : " ui-chip--active"}"${selectedValue ? "" : ' aria-current="true"'}>すべての${escapeHtml(label)} <span>${allCount}</span></a>
      ${valueChips}
    </div>
  </div>`;
}

// 分類ツリー/分類タブは廃止し、/animals の分類絞り込みチップに一本化した。
function buildTaxonomyIndexUrl(): string {
  return "/animals";
}

function renderAnimalsHtml(
  allAnimals: AnimalListItem[],
  filter: AnimalListFilter,
  activePref: PrefectureCode | null,
  imageKeys: AnimalImageVersionIndex = new Map(),
  query: string | null = null,
  taxonomy: AnimalTaxonomySelection = {
    className: null,
    orderName: null,
    familyName: null,
    genusName: null,
  }
): string {
  const classValues = countAnimalTaxonomyValues(allAnimals, (animal) => animal.className);
  const classAnimals = taxonomy.className
    ? allAnimals.filter((animal) => animal.className === taxonomy.className)
    : allAnimals;
  const orderValues = countAnimalTaxonomyValues(classAnimals, (animal) => animal.orderName);
  const orderAnimals = taxonomy.orderName
    ? classAnimals.filter((animal) => animal.orderName === taxonomy.orderName)
    : classAnimals;
  const familyValues = countAnimalTaxonomyValues(orderAnimals, (animal) => animal.familyName);
  const familyAnimals = taxonomy.familyName
    ? orderAnimals.filter((animal) => animal.familyName === taxonomy.familyName)
    : orderAnimals;
  const genusValues = countAnimalTaxonomyValues(familyAnimals, (animal) => animal.genusName);
  const animals = filterAnimalItemsByTaxonomy(allAnimals, taxonomy);
  const items = renderAnimalCards(animals, imageKeys);
  const prefLabel = activePref ? PREF_LABELS[activePref] : "近畿一円";
  const escapedQuery = escapeHtml(query ?? "");

  const selectedTaxonomyLevels = [
    taxonomy.className
      ? { label: "類", value: taxonomy.className, href: buildAnimalsUrl(filter, query) }
      : null,
    taxonomy.orderName
      ? {
          label: "目",
          value: taxonomy.orderName,
          href: buildAnimalsUrl(filter, query, { className: taxonomy.className }),
        }
      : null,
    taxonomy.familyName
      ? {
          label: "科",
          value: taxonomy.familyName,
          href: buildAnimalsUrl(filter, query, {
            className: taxonomy.className,
            orderName: taxonomy.orderName,
          }),
        }
      : null,
    taxonomy.genusName
      ? {
          label: "属",
          value: taxonomy.genusName,
          href: buildAnimalsUrl(filter, query, {
            className: taxonomy.className,
            orderName: taxonomy.orderName,
            familyName: taxonomy.familyName,
          }),
        }
      : null,
  ].filter((level): level is { label: string; value: string; href: string } => Boolean(level));
  const selectedTaxonomy = selectedTaxonomyLevels.map((level) => level.value);
  const selectedTaxonomyLabel = selectedTaxonomy.map((value) => escapeHtml(value)).join(" › ");
  const favoriteTaxonomy = taxonomy.genusName
    ? { rank: "genus", value: taxonomy.genusName }
    : taxonomy.familyName
    ? { rank: "family", value: taxonomy.familyName }
    : taxonomy.orderName
    ? { rank: "order", value: taxonomy.orderName }
    : taxonomy.className
    ? { rank: "class", value: taxonomy.className }
    : null;
  const taxonomyFavoriteButtonHtml = favoriteTaxonomy
    ? renderFavoriteButton(
        "taxonomy",
        `${favoriteTaxonomy.rank}:${favoriteTaxonomy.value}`,
        favoriteTaxonomy.value,
        buildAnimalsUrl("all", null, taxonomy),
        "large"
      )
    : "";
  const taxonomyBreadcrumbHtml = selectedTaxonomyLevels.length > 0
    ? `<div class="taxonomy-selection">
        <nav class="taxonomy-path" aria-label="選択中の分類">
          ${selectedTaxonomyLevels
            .map(
              (level, index) => `${index > 0 ? '<span class="taxonomy-path-separator" aria-hidden="true">›</span>' : ""}<a href="${escapeHtml(level.href)}" title="${escapeHtml(level.label)}から選び直す"><small>${escapeHtml(level.label)}</small>${escapeHtml(level.value)}</a>`
            )
            .join("")}
        </nav>
        <div class="taxonomy-selection-actions">
          ${taxonomyFavoriteButtonHtml}
          <a class="taxonomy-clear" href="${escapeHtml(buildAnimalsUrl(filter, query))}">${icon("close")}分類を解除</a>
        </div>
      </div>`
    : `<p class="taxonomy-path-empty">分類はまだ選択されていません。</p>`;

  let taxonomyChoiceRow: string;
  let nextTaxonomyLabel: string;
  if (!taxonomy.className) {
    nextTaxonomyLabel = "類";
    taxonomyChoiceRow = renderAnimalTaxonomyFilterRow(
      nextTaxonomyLabel,
      classValues,
      null,
      allAnimals.length,
      buildAnimalsUrl(filter, query),
      (className) => buildAnimalsUrl(filter, query, { className })
    );
  } else if (!taxonomy.orderName) {
    nextTaxonomyLabel = "目";
    taxonomyChoiceRow = renderAnimalTaxonomyFilterRow(
      nextTaxonomyLabel,
      orderValues,
      null,
      classAnimals.length,
      buildAnimalsUrl(filter, query, { className: taxonomy.className }),
      (orderName) => buildAnimalsUrl(filter, query, {
        className: taxonomy.className,
        orderName,
      })
    );
  } else if (!taxonomy.familyName) {
    nextTaxonomyLabel = "科";
    taxonomyChoiceRow = renderAnimalTaxonomyFilterRow(
      nextTaxonomyLabel,
      familyValues,
      null,
      orderAnimals.length,
      buildAnimalsUrl(filter, query, {
        className: taxonomy.className,
        orderName: taxonomy.orderName,
      }),
      (familyName) => buildAnimalsUrl(filter, query, {
        className: taxonomy.className,
        orderName: taxonomy.orderName,
        familyName,
      })
    );
  } else {
    nextTaxonomyLabel = "属";
    taxonomyChoiceRow = renderAnimalTaxonomyFilterRow(
      nextTaxonomyLabel,
      genusValues,
      taxonomy.genusName,
      familyAnimals.length,
      buildAnimalsUrl(filter, query, {
        className: taxonomy.className,
        orderName: taxonomy.orderName,
        familyName: taxonomy.familyName,
      }),
      (genusName) => buildAnimalsUrl(filter, query, {
        className: taxonomy.className,
        orderName: taxonomy.orderName,
        familyName: taxonomy.familyName,
        genusName,
      })
    );
  }
  const taxonomyPanelBody = `${taxonomyBreadcrumbHtml}${taxonomyChoiceRow}`;
  const mobileTaxonomyStatus = selectedTaxonomyLabel || "未選択";
  const taxonomyFilterHtml = filter === "all" && (classValues.length > 0 || taxonomy.className)
    ? `<button type="button" class="taxonomy-filter-trigger ui-touch-target" data-taxonomy-filter-open aria-haspopup="dialog" aria-controls="taxonomy-filter-dialog" aria-expanded="false">
        <span>分類で絞り込む</span>
        <small>${mobileTaxonomyStatus}・${animals.length} 件</small>
      </button>
      <section class="taxonomy-filter-panel taxonomy-filter-panel--desktop" aria-labelledby="taxonomy-filter-title">
        <div class="taxonomy-filter-heading">
          <div><h2 id="taxonomy-filter-title">分類から絞り込む</h2><p>選択中の分類から、次の${nextTaxonomyLabel}を選べます。</p></div>
        </div>
        ${taxonomyPanelBody}
      </section>
      <dialog class="taxonomy-filter-dialog" id="taxonomy-filter-dialog" aria-labelledby="taxonomy-filter-dialog-title">
        <div class="taxonomy-filter-heading">
          <div><h2 id="taxonomy-filter-dialog-title">分類から絞り込む</h2><p>選択中の分類から、次の${nextTaxonomyLabel}を選べます。</p></div>
          <button type="button" class="taxonomy-dialog-close ui-touch-target" data-taxonomy-filter-close aria-label="分類絞り込みを閉じる">${icon("close")}</button>
        </div>
        ${taxonomyPanelBody}
      </dialog>`
    : "";
  const summary =
    selectedTaxonomy.length > 0 && query
      ? `${prefLabel}で分類「${selectedTaxonomyLabel}」に属し、「${escapedQuery}」に一致する動物: ${animals.length} 件`
      : selectedTaxonomy.length > 0
      ? `${prefLabel}で分類「${selectedTaxonomyLabel}」に属する動物: ${animals.length} 件`
      : query
      ? `${prefLabel}で「${escapedQuery}」に一致する動物: ${animals.length} 件`
      : filter === "unclassified"
      ? `${prefLabel}の分類未設定: ${animals.length} 件`
      : `${prefLabel}の登録動物: ${animals.length} 件`;

  const emptyMessage =
    animals.length === 0
      ? query || selectedTaxonomy.length > 0
        ? renderStateMessage("該当する動物が見つかりませんでした。", [
            { href: buildAnimalsUrl(filter), label: "絞り込みをクリア" },
            { href: "/search", label: "横断検索" },
          ])
        : filter === "unclassified"
        ? renderStateMessage("分類未設定の動物はありません。", [
            { href: buildAnimalsUrl("all", query), label: "すべての動物を見る" },
          ])
        : renderStateMessage(
            "動物データがまだありません。動物園一覧から気になる施設を開き、掲載動物をご確認ください。",
            [
              { href: buildBrowseUrl(activePref, null), label: "動物園一覧へ戻る" },
              { href: buildMapUrl(activePref, null), label: "地図で見る" },
            ]
          )
      : "";
  const taxonomyHiddenInputs = filter === "all"
    ? [
        taxonomy.className ? `<input type="hidden" name="cls" value="${escapeHtml(taxonomy.className)}">` : "",
        taxonomy.orderName ? `<input type="hidden" name="order" value="${escapeHtml(taxonomy.orderName)}">` : "",
        taxonomy.familyName ? `<input type="hidden" name="family" value="${escapeHtml(taxonomy.familyName)}">` : "",
        taxonomy.genusName ? `<input type="hidden" name="genus" value="${escapeHtml(taxonomy.genusName)}">` : "",
      ].join("")
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
    .animal-search-form { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; background: #f8fbf9; }
    .animal-search-form input { flex: 1 1 220px; max-width: 360px; min-height: 42px; border: 1px solid #aaa; padding: 0.5rem 0.65rem; }
    .tab { color: #1f5b45; text-decoration: none; font-size: 0.9rem; }
    .tab.active { font-weight: bold; text-decoration: underline; text-underline-offset: 0.2em; }
    .tab:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .taxonomy-filter-trigger, .taxonomy-filter-dialog { display: none; }
    .taxonomy-filter-panel { display: grid; gap: 0.85rem; padding: 1rem 1.5rem; border-bottom: 1px solid #ddd; background: #fff; }
    .taxonomy-filter-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
    .taxonomy-filter-heading > div { display: grid; gap: 0.2rem; }
    .taxonomy-filter-heading h2 { font-size: 1rem; }
    .taxonomy-filter-heading p { color: #66736c; font-size: 0.78rem; line-height: 1.5; }
    .taxonomy-selection { display: flex; gap: 0.75rem; align-items: center; justify-content: space-between; min-width: 0; }
    .taxonomy-selection-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 0.5rem; }
    .taxonomy-selection-actions .fav-toggle { white-space: nowrap; }
    .taxonomy-path { display: flex; align-items: center; gap: 0.35rem; min-width: 0; overflow-x: auto; padding: 0.15rem 0; scrollbar-width: thin; }
    .taxonomy-path a { display: inline-flex; flex: 0 0 auto; gap: 0.28rem; align-items: baseline; min-height: 40px; padding: 0.5rem 0.6rem; border: 1px solid #d3e4d8; background: #f7fbf8; color: #1f5b45; font-size: 0.82rem; font-weight: bold; text-decoration: none; white-space: nowrap; }
    .taxonomy-path a:hover { background: #edf7f0; text-decoration: underline; text-underline-offset: 0.2em; }
    .taxonomy-path a small { color: #6b7c72; font-size: 0.66rem; font-weight: normal; }
    .taxonomy-path-separator { flex: 0 0 auto; color: #8b978f; }
    .taxonomy-path-empty { color: #66736c; font-size: 0.82rem; }
    .taxonomy-clear { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 0.25rem; min-height: 40px; color: #59685f; font-size: 0.78rem; text-decoration: none; }
    .taxonomy-clear:hover { color: #1f5b45; text-decoration: underline; text-underline-offset: 0.2em; }
    .taxonomy-filter-row { display: grid; gap: 0.55rem; min-width: 0; }
    .taxonomy-filter-row h3 { color: #3e5046; font-size: 0.86rem; }
    .taxonomy-filter-values { display: flex; flex-wrap: wrap; gap: 0.4rem; min-width: 0; }
    .taxonomy-filter-values a { font: inherit; font-size: 0.82rem; }
    .taxonomy-filter-values span { opacity: 0.78; font-size: 0.72rem; }
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
    .animal-thumb { width: 36px; height: 36px; }
    .animal-name a { color: #1f5b45; text-decoration: none; font-size: 0.95rem; }
    .animal-name a:hover { text-decoration: underline; }
    .taxonomy { color: #444; line-height: 1.5; }
    .taxonomy a { color: #1f5b45; text-decoration: none; }
    .taxonomy a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .unclassified { color: #777; }
    .facility-count { color: #666; font-size: 0.85rem; }
    .zoo-links { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .zoo-links a { font-size: 0.78rem; }
    .zoo-links a:hover { text-decoration: underline; }
    .empty { padding: 2rem 1.5rem; color: #888; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
    @media (max-width: 700px) {
      .tabs { padding: 0.65rem 0.75rem; }
      .taxonomy-filter-panel--desktop { display: none; }
      .taxonomy-filter-trigger { display: flex; width: calc(100% - 1.5rem); margin: 0.75rem; padding: 0.65rem 0.75rem; border: 1px solid #b9d4c2; background: #f4faf6; color: #1f5b45; align-items: center; justify-content: space-between; gap: 0.75rem; text-align: left; cursor: pointer; }
      .taxonomy-filter-trigger span { font-size: 0.9rem; font-weight: bold; }
      .taxonomy-filter-trigger small { min-width: 0; color: #59685f; font-size: 0.72rem; font-weight: normal; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .taxonomy-filter-dialog { width: 100%; max-width: none; max-height: 85vh; max-height: 85dvh; margin: auto 0 0; padding: 1rem 0.75rem calc(1rem + env(safe-area-inset-bottom)); border: 0; border-radius: 16px 16px 0 0; background: #fff; color: #222; overflow-y: auto; }
      .taxonomy-filter-dialog[open] { display: grid; gap: 0.9rem; }
      .taxonomy-filter-dialog::backdrop { background: rgba(13, 25, 18, 0.48); }
      .taxonomy-dialog-close { display: inline-flex; flex: 0 0 auto; width: 44px; height: 44px; padding: 0; border: 1px solid #d5ddd8; background: #fff; color: #405047; align-items: center; justify-content: center; cursor: pointer; }
      .taxonomy-selection { display: grid; gap: 0.35rem; }
      .taxonomy-selection-actions { width: 100%; flex-wrap: wrap; }
      .taxonomy-path { width: 100%; padding-bottom: 0.3rem; scrollbar-width: none; -ms-overflow-style: none; }
      .taxonomy-path a { min-height: 44px; }
      .taxonomy-clear { justify-self: start; min-height: 44px; }
      .taxonomy-filter-row { gap: 0.45rem; }
      .taxonomy-path::-webkit-scrollbar { display: none; }
      .taxonomy-filter-values a { min-height: 44px; white-space: nowrap; }
      .animal-search-form { display: grid; grid-template-columns: 1fr; padding: 0.65rem 0.75rem; }
      .animal-search-form input, .animal-search-form button, .animal-search-form a { max-width: none; min-height: 44px; }
      .tab { display: inline-flex; min-height: 44px; align-items: center; }
      .summary { padding: 0.7rem 0.75rem; line-height: 1.5; }
      .animal-list { padding: 0.75rem; overflow: visible; }
      .animal-table { min-width: 0; border: 0; }
      .animal-table thead { display: none; }
      .animal-table tbody, .animal-table tr, .animal-table th, .animal-table td { display: block; width: 100%; }
      .animal-table tr { margin-bottom: 0.5rem; border: 1px solid #d8ddd9; }
      .animal-table th, .animal-table td { border: 0; border-bottom: 1px solid #e5e8e6; padding: 0.45rem 0.75rem; }
      .animal-table tr > :last-child { border-bottom: 0; }
      .animal-table td::before { content: attr(data-label); display: block; margin-bottom: 0.25rem; color: #6a746d; font-size: 0.7rem; font-weight: bold; }
      .animal-table td[data-label="施設数"] { display: none; }
      .animal-table td[data-label="分類"]::before,
      .animal-table td[data-label="施設一覧"]::before { display: none; }
      .animal-table th.animal-name { display: flex; align-items: center; background: #f7faf8; padding: 0.6rem 0.75rem; }
      .empty { padding: 1.5rem 0.75rem; }
      footer { padding: 1rem 0.75rem; line-height: 1.5; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/animals")}
  <nav class="tabs">
    <a href="${buildAnimalsUrl("all", query)}" class="tab${filter === "all" ? " active" : ""}">すべて</a>
    <a href="${buildAnimalsUrl("unclassified", query)}" class="tab${filter === "unclassified" ? " active" : ""}">分類未設定</a>
  </nav>
  <form class="animal-search-form" action="/animals" method="get">
    ${filter === "unclassified" ? `<input type="hidden" name="filter" value="unclassified">` : ""}
    ${taxonomyHiddenInputs}
    <input type="search" name="q" value="${escapedQuery}" placeholder="動物名・分類・施設名で検索" aria-label="動物を検索">
    <button type="submit" class="ui-btn ui-btn--primary ui-touch-target">${icon("search")}検索</button>
    ${query ? `<a href="${buildAnimalsUrl(filter, null, taxonomy)}" class="ui-btn ui-btn--secondary ui-touch-target">${icon("close")}検索をクリア</a>` : ""}
  </form>
  ${taxonomyFilterHtml}
  <p class="summary">${summary}</p>
  ${animalListHtml}
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
  <script src="/favorites.js?v=5" defer></script>
<script>
(function () {
  const taxonomyDialog = document.getElementById('taxonomy-filter-dialog');
  const taxonomyOpenButton = document.querySelector('[data-taxonomy-filter-open]');
  const taxonomyCloseButton = document.querySelector('[data-taxonomy-filter-close]');
  if (taxonomyDialog && taxonomyOpenButton) {
    function closeTaxonomyDialog() {
      if (typeof taxonomyDialog.close === 'function') taxonomyDialog.close();
      else {
        taxonomyDialog.removeAttribute('open');
        taxonomyOpenButton.setAttribute('aria-expanded', 'false');
        taxonomyOpenButton.focus();
      }
    }

    taxonomyOpenButton.addEventListener('click', () => {
      if (typeof taxonomyDialog.showModal === 'function') taxonomyDialog.showModal();
      else taxonomyDialog.setAttribute('open', '');
      taxonomyOpenButton.setAttribute('aria-expanded', 'true');
    });
    taxonomyCloseButton?.addEventListener('click', closeTaxonomyDialog);
    taxonomyDialog.addEventListener('click', (event) => {
      if (event.target !== taxonomyDialog) return;
      const rect = taxonomyDialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) closeTaxonomyDialog();
    });
    taxonomyDialog.addEventListener('close', () => {
      taxonomyOpenButton.setAttribute('aria-expanded', 'false');
      taxonomyOpenButton.focus();
    });
  }

  const table = document.getElementById('animal-table');
  if (table) {
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
  }
})();
</script>
</body>
</html>`;
}

function renderAnimalCards(animals: AnimalListItem[], imageKeys: AnimalImageVersionIndex = new Map()): string {
  return animals
    .map((item) => {
      const zooLinks = item.zoos
        .map((zoo) => `<a class="ui-chip" href="/zoos/${encodeURIComponent(zoo.id)}">${escapeHtml(zoo.name)}</a>`)
        .join("");
      const primaryDisplayName = item.displayNames[0] ?? item.canonicalName ?? "";
      const searchName = item.canonicalName ?? primaryDisplayName;
      const displayTitle = formatAnimalDisplayName(searchName);
      const title = escapeHtml(displayTitle);
      const titleHref = primaryDisplayName ? buildZooAnimalUrl(primaryDisplayName) : buildAnimalSearchUrl(searchName);
      const imageDisplayName = item.displayNames.find((n) => imageKeys.has(normalizeAnimalImageKey(n)));
      const imageVersion = imageDisplayName ? imageKeys.get(normalizeAnimalImageKey(imageDisplayName)) : null;
      const thumbHtml = imageDisplayName
        ? `<img src="${buildAnimalImageUrl(imageDisplayName, imageVersion)}" alt="" class="animal-thumb ui-thumb ui-thumb--36" loading="lazy" width="36" height="36">`
        : renderAnimalImagePlaceholder("animal-thumb ui-thumb--36", { compact: true, ariaHidden: true });
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
          <th scope="row" class="animal-name">${thumbHtml}<a href="${escapeHtml(titleHref)}">${title}</a>${renderFavoriteButton("animal", searchName, displayTitle, titleHref)}</th>
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
  relatedDisplayNames: Array<{ displayName: string; zoos: Zoo[] }> = [],
  imageKeys: AnimalImageVersionIndex = new Map(),
  animalNews: AnimalNewsRow[] = [],
  pastZoos: AnimalPastZoo[] = []
): string {
  const displayLabel = formatAnimalDisplayName(detail.displayName);
  const canonicalLabel = detail.canonicalName ? formatAnimalDisplayName(detail.canonicalName) : null;
  const escapedDisplayName = escapeHtml(displayLabel);
  const title = canonicalLabel && canonicalLabel !== displayLabel
    ? `${escapeHtml(canonicalLabel)} | ${escapedDisplayName}`
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
  const breadcrumb = renderBreadcrumb([
    { href: "/animals", label: "動物一覧" },
    ...(detail.className ? [{ href: buildTaxonomyPathUrl([detail.className]), label: detail.className }] : []),
    { label: displayLabel },
  ]);
  const taxonomyHtml = taxonomyDetails
    ? `<dl class="taxonomy-details">${taxonomyDetails}</dl>`
    : `<p class="unclassified">分類未設定</p>`;
  const canonicalHtml =
    canonicalLabel && canonicalLabel !== displayLabel
      ? `<p class="canonical">分類マスタ: ${escapeHtml(canonicalLabel)}</p>`
      : "";
  const wikipediaTitle = detail.speciesName ?? detail.canonicalName ?? detail.displayName;
  const externalLinksHtml = `<p class="animal-external-links">
    <a href="${escapeHtml(buildJapaneseWikipediaUrl(wikipediaTitle))}" target="_blank" rel="noopener noreferrer">Wikipedia</a>
  </p>`;
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

  const pastZooSection = pastZoos.length > 0 ? `
    <section>
      <h2>過去に確認された施設</h2>
      <p class="past-zoo-note">直近の取得で表示名が見つからなくなった施設です。展示終了と断定するものではありません。</p>
      <ul class="zoo-list zoo-list--past">
        ${pastZoos
          .map(
            (item) => `
        <li>
          <a href="/zoos/${item.zoo.id}">${escapeHtml(item.zoo.name)}</a>
          <span>${escapeHtml(PREF_LABELS[item.zoo.prefecture])} / ${escapeHtml(item.lastSeenMissingAt.slice(0, 10))} 頃から未確認</span>
        </li>`
          )
          .join("")}
      </ul>
    </section>` : "";

  const imageHtml = image
    ? `<img src="${buildAnimalImageUrl(detail.displayName, image.selectedGenerationId)}" alt="${escapedDisplayName}" class="animal-image" width="320" height="320">`
    : renderAnimalImagePlaceholder("animal-image animal-image--empty", {
        label: "画像準備中",
        detail: "現在この動物の画像はありません",
      });

  const relatedDisplaySection = relatedDisplayNames.length > 0 ? `
    <section>
      <h2>同じ動物の施設表示名</h2>
      <div class="alias-list">
        ${relatedDisplayNames
          .map((item) => {
            const zooLabels = item.zoos.map((zoo) => escapeHtml(zoo.name)).join("、");
            return `<a href="${buildZooAnimalUrl(item.displayName)}" class="alias-card ui-card-link ui-touch-target">
              <span>${escapeHtml(formatAnimalDisplayName(item.displayName))}</span>
              <small>${zooLabels}</small>
            </a>`;
          })
          .join("")}
      </div>
    </section>` : "";

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
      : renderAnimalImagePlaceholder("related-thumb related-thumb--empty", { compact: true, ariaHidden: true });
    const label = formatAnimalDisplayName(item.canonicalName ?? name);
    const taxonomy = [item.className, item.orderName, item.familyName].filter(Boolean).join(" / ");
    const visibleZoos = item.zoos.slice(0, 2);
    const zooChips = visibleZoos
      .map((zoo) => `<a class="ui-chip" href="/zoos/${encodeURIComponent(zoo.id)}">${escapeHtml(zoo.name)}</a>`)
      .join("");
    const moreZoosCount = item.zoos.length - visibleZoos.length;
    const zooLinksHtml = item.zoos.length > 0
      ? `<div class="related-zoo-links">${zooChips}${moreZoosCount > 0 ? `<span class="related-more-zoos">ほか${moreZoosCount}施設</span>` : ""}</div>`
      : "";
    return `<div class="related-card ui-card-link">
      <a href="/animal/${encodeURIComponent(name)}" class="related-card-main ui-touch-target">
        ${thumb}
        <span class="related-name">${escapeHtml(label)}</span>
      </a>
      ${taxonomy ? `<p class="related-taxonomy">${escapeHtml(taxonomy)}</p>` : ""}
      ${zooLinksHtml}
    </div>`;
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
    main { display: grid; gap: 0; max-width: 1040px; margin: 0 auto; }
    .hero { display: grid; grid-template-columns: minmax(240px, 320px) 1fr; gap: 1.5rem; align-items: start; padding: 1.25rem 1.5rem; }
    .animal-image { width: 100%; max-width: 320px; aspect-ratio: 1; border: 1px solid #e1e1e1; flex-shrink: 0; }
    img.animal-image { display: block; height: auto; object-fit: cover; background: #f7f7f7; }
    .animal-image--empty { border-style: dashed; }
    .hero-info { display: grid; gap: 0.75rem; }
    .hero-name-row { display: flex; align-items: center; flex-wrap: wrap; gap: 0.75rem; }
    .hero-name { font-size: 1.5rem; font-weight: bold; overflow-wrap: anywhere; line-height: 1.3; }
    .canonical { color: #777; font-size: 0.88rem; }
    .animal-external-links { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .animal-external-links a { color: #1f5b45; font-size: 0.88rem; font-weight: bold; text-decoration: none; }
    .animal-external-links a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
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
    .zoo-list--past li { background: #fafafa; border-color: #e5e5e5; }
    .zoo-list--past a { color: #6a746d; }
    .past-zoo-note { color: #777; font-size: 0.82rem; margin-bottom: 0.5rem; }
    .alias-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.55rem; }
    .alias-card { display: grid; gap: 0.25rem; padding: 0.65rem 0.75rem; }
    .alias-card span { font-weight: bold; overflow-wrap: anywhere; }
    .alias-card small { color: #777; font-size: 0.76rem; line-height: 1.45; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 0.7rem; }
    .related-card { display: grid; gap: 0.35rem; padding: 0.55rem; min-width: 0; }
    .related-card-main { display: grid; gap: 0.35rem; color: inherit; text-decoration: none; }
    .related-thumb { width: 100%; aspect-ratio: 1; }
    img.related-thumb { display: block; height: auto; object-fit: cover; background: #f7f7f7; }
    .related-name { font-size: 0.82rem; font-weight: bold; line-height: 1.35; overflow-wrap: anywhere; }
    .related-taxonomy { color: #777; font-size: 0.72rem; line-height: 1.35; }
    .related-zoo-links { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
    .related-zoo-links a { font-size: 0.7rem; padding: 0.15rem 0.4rem; }
    .related-more-zoos { color: #999; font-size: 0.68rem; }
    .animal-news-list { list-style: none; display: grid; gap: 0; }
    .animal-news-list li { display: grid; gap: 0.28rem; padding: 0.6rem 0; border-bottom: 1px solid #eee; }
    .animal-news-list li:last-child { border-bottom: 0; }
    .animal-news-meta { display: flex; flex-wrap: wrap; gap: 0.3rem 0.5rem; align-items: center; }
    .animal-news-zoo { color: #1f5b45; font-size: 0.78rem; font-weight: bold; flex: 0 0 auto; }
    .animal-news-date { color: #888; font-size: 0.76rem; flex: 0 0 auto; font-variant-numeric: tabular-nums; }
    .animal-news-title { color: #1a1a1a; text-decoration: none; font-size: 0.9rem; line-height: 1.5; overflow-wrap: anywhere; }
    .animal-news-title:hover { color: #1f5b45; text-decoration: underline; text-underline-offset: 0.2em; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; border-top: 1px solid #eee; }
    @media (max-width: 640px) {
      .hero { grid-template-columns: 1fr; padding: 1rem 0.75rem; gap: 1rem; }
      .animal-image { max-width: none; }
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
  ${breadcrumb}
  <main>
    ${noticeHtml ? `<div style="padding:0.6rem 1.5rem">${noticeHtml}</div>` : ""}
    <div class="hero">
      ${imageHtml}
      <div class="hero-info">
        <div class="hero-name-row">
          <h1 class="hero-name">${escapedDisplayName}</h1>
          ${renderFavoriteButton(
            "animal",
            detail.canonicalName ?? detail.displayName,
            canonicalLabel ?? displayLabel,
            buildZooAnimalUrl(detail.displayName),
            "large"
          )}
        </div>
        ${canonicalHtml}
        ${externalLinksHtml}
        ${taxonomyHtml}
      </div>
    </div>
    <section>
      <h2>見られる施設</h2>
      <ul class="zoo-list">${zooLinks}</ul>
    </section>
    ${pastZooSection}
    ${relatedDisplaySection}
    ${relatedSection}
    ${
      animalNews.length > 0
        ? `<section>
        <h2 class="icon-heading">${icon("campaign")}お知らせ（このどうぶつを含む）</h2>
        <ul class="animal-news-list">
          ${animalNews
            .map((item) => {
              const zoo = zoos.find((z) => z.id === item.zoo_id);
              const badges = renderNewsItemBadges(item.title, item.published_at);
              return `<li>
                <div class="animal-news-meta">
                  ${zoo ? `<span class="animal-news-zoo">${escapeHtml(zoo.name)}</span>` : ""}
                  ${item.published_at ? `<span class="animal-news-date">${escapeHtml(item.published_at)}</span>` : ""}
                  ${badges}
                </div>
                <a class="animal-news-title" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
              </li>`;
            })
            .join("")}
        </ul>
      </section>`
        : ""
    }
  </main>
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
  <script src="/favorites.js?v=5" defer></script>
</body>
</html>`;
}

function renderAnimalGoneHtml(displayName: string, pastZoos: AnimalPastZoo[]): string {
  const displayLabel = formatAnimalDisplayName(displayName);
  const escapedDisplayName = escapeHtml(displayLabel);
  const breadcrumb = renderBreadcrumb([
    { href: "/animals", label: "動物一覧" },
    { label: displayLabel },
  ]);
  const pastZooListHtml = pastZoos
    .map(
      (item) => `
        <li>
          <a href="/zoos/${item.zoo.id}">${escapeHtml(item.zoo.name)}</a>
          <span>${escapeHtml(PREF_LABELS[item.zoo.prefecture])} / ${escapeHtml(item.lastSeenMissingAt.slice(0, 10))} 頃から未確認</span>
        </li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedDisplayName} | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 720px; margin: 0 auto; padding: 1.5rem; display: grid; gap: 1rem; }
    h1 { font-size: 1.3rem; }
    .gone-note { color: #555; font-size: 0.9rem; line-height: 1.6; border: 1px solid #eadca6; background: #fffaf0; padding: 0.85rem 1rem; }
    .zoo-list { display: grid; gap: 0.45rem; list-style: none; }
    .zoo-list li { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: baseline; border: 1px solid #e5e5e5; background: #fafafa; padding: 0.65rem 0.75rem; }
    .zoo-list a { color: #6a746d; font-weight: bold; text-decoration: none; }
    .zoo-list a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .zoo-list span { color: #777; font-size: 0.8rem; }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/animals")}
  <main>
    ${breadcrumb}
    <h1>${escapedDisplayName}</h1>
    <p class="gone-note">現在、この表示名で確認できる施設はありません。過去の取得結果からの推定であり、展示終了を断定するものではありません。</p>
    ${
      pastZoos.length > 0
        ? `<section><h2>過去に確認された施設</h2><ul class="zoo-list">${pastZooListHtml}</ul></section>`
        : ""
    }
    ${renderStateMessage("最新情報は各施設の公式サイトでご確認ください。", [
      { href: "/animals", label: "動物一覧へ戻る" },
    ])}
  </main>
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
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
  const favoriteButtonHtml = rank.key !== "species"
    ? renderFavoriteButton(
        "taxonomy",
        `${rank.key}:${value}`,
        value,
        buildTaxonomyPathUrl(levels.map((level) => level.value)),
        "large"
      )
    : "";

  const zooAnimalCounts = new Map<string, { zoo: Zoo; count: number }>();
  for (const item of animals) {
    for (const zoo of item.zoos) {
      const existing = zooAnimalCounts.get(zoo.id);
      if (existing) existing.count += 1;
      else zooAnimalCounts.set(zoo.id, { zoo, count: 1 });
    }
  }
  const topZoos = [...zooAnimalCounts.values()]
    .sort((a, b) => b.count - a.count || a.zoo.name.localeCompare(b.zoo.name, "ja-JP"))
    .slice(0, 5);
  const topZoosHtml =
    topZoos.length > 0
      ? `
        <section class="top-zoos-section">
          <h2>${escapeHtml(rank.label)}「${escapedValue}」の動物が多い施設</h2>
          <ol class="top-zoos-list">
            ${topZoos
              .map(
                ({ zoo, count }) => `
                  <li><a href="/zoos/${encodeURIComponent(zoo.id)}">${escapeHtml(zoo.name)}</a><span>${count} 種</span></li>`
              )
              .join("")}
          </ol>
        </section>`
      : "";

  const representativeAnimals = animals
    .flatMap((item) => {
      const imageDisplayName = item.displayNames.find((n) => imageKeys.has(normalizeAnimalImageKey(n)));
      return imageDisplayName ? [{ item, imageDisplayName }] : [];
    })
    .slice(0, 8);
  const representativeHtml =
    representativeAnimals.length > 0
      ? `
        <section class="representative-section">
          <h2>代表的な動物</h2>
          <div class="featured-grid">
            ${representativeAnimals
              .map(({ item, imageDisplayName }) => {
                const primaryDisplayName = item.displayNames[0] ?? item.canonicalName ?? "";
                const title = item.canonicalName ?? primaryDisplayName;
                const href = primaryDisplayName
                  ? buildZooAnimalUrl(primaryDisplayName)
                  : buildAnimalSearchUrl(title);
                const imageVersion = imageKeys.get(normalizeAnimalImageKey(imageDisplayName));
                return `
                  <a class="featured-animal" href="${href}">
                    <img src="${buildAnimalImageUrl(imageDisplayName, imageVersion)}" alt="" loading="lazy" width="112" height="112">
                    <span>${escapeHtml(title)}</span>
                    <small>${item.zoos.length} 施設</small>
                  </a>`;
              })
              .join("")}
          </div>
        </section>`
      : "";

  const childLinks =
    childSection && childSection.values.length > 0
      ? childSection.values
          .map(
            (child) => `
              <a class="taxonomy-link ui-card-link ui-touch-target" href="${buildTaxonomyUrl(levels, child.name)}">
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
    .taxonomy-detail-heading { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.85rem 1.5rem 0; }
    .taxonomy-detail-heading h1 { min-width: 0; font-size: 1.35rem; overflow-wrap: anywhere; }
    .summary { padding: 0.75rem 1.5rem; font-size: 0.9rem; color: #666; }
    .child-taxonomy, .representative-section, .top-zoos-section { padding: 1rem 1.5rem; border-bottom: 1px solid #ddd; }
    .child-taxonomy h2, .representative-section h2, .top-zoos-section h2 { font-size: 1.05rem; margin-bottom: 0.75rem; }
    .taxonomy-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.55rem; }
    .taxonomy-link { display: grid; gap: 0.2rem; padding: 0.65rem 0.75rem; }
    .taxonomy-link span { font-weight: bold; overflow-wrap: anywhere; }
    .taxonomy-link small { color: #617469; font-size: 0.75rem; }
    .featured-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 0.65rem; }
    .featured-animal { display: grid; gap: 0.25rem; min-width: 0; color: #222; text-decoration: none; }
    .featured-animal img { width: 100%; aspect-ratio: 1; height: auto; object-fit: cover; border: 1px solid #ddd; background: #f7f7f7; }
    .featured-animal span { color: #1f5b45; font-size: 0.86rem; font-weight: bold; overflow-wrap: anywhere; }
    .featured-animal small { color: #777; font-size: 0.72rem; }
    .top-zoos-list { list-style: none; display: grid; gap: 0.4rem; counter-reset: top-zoos; }
    .top-zoos-list li { counter-increment: top-zoos; display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.65rem; background: #f8fbf9; border: 1px solid #e0e8e3; }
    .top-zoos-list li::before { content: counter(top-zoos); flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 1.5rem; height: 1.5rem; background: #1f5b45; color: #fff; font-size: 0.75rem; font-weight: bold; border-radius: 50%; }
    .top-zoos-list a { flex: 1 1 auto; min-width: 0; color: #1f5b45; text-decoration: none; font-weight: bold; overflow-wrap: anywhere; }
    .top-zoos-list a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .top-zoos-list span { flex: 0 0 auto; color: #617469; font-size: 0.82rem; }
    .animal-list { padding: 1rem 1.5rem; overflow-x: auto; }
    .animal-table { width: 100%; min-width: 900px; border-collapse: collapse; }
    .animal-table th, .animal-table td { border: none; border-bottom: 1px solid #e8e8e8; padding: 0.65rem; vertical-align: top; text-align: left; font-size: 0.84rem; }
    .animal-table thead th { background: #f7f7f7; color: #555; border-bottom: 2px solid #ddd; }
    .animal-name { display: flex; align-items: center; gap: 0.5rem; }
    .animal-thumb { width: 40px; height: 40px; }
    .animal-name a { color: #1f5b45; text-decoration: none; font-size: 0.98rem; }
    .animal-name a:hover { text-decoration: underline; }
    .taxonomy { color: #444; line-height: 1.5; }
    .taxonomy a { color: #1f5b45; text-decoration: none; }
    .taxonomy a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .unclassified { color: #777; }
    .facility-count { color: #666; font-size: 0.85rem; }
    .zoo-links { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .zoo-links a { font-size: 0.78rem; }
    .zoo-links a:hover { text-decoration: underline; }
    .empty { padding: 2rem 1.5rem; color: #888; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
    @media (max-width: 700px) {
      .taxonomy-detail-heading { align-items: flex-start; padding-left: 0.75rem; padding-right: 0.75rem; }
      .summary, .child-taxonomy, .representative-section, .top-zoos-section { padding-left: 0.75rem; padding-right: 0.75rem; }
      .taxonomy-links { grid-template-columns: 1fr; }
      .animal-list { padding: 0.75rem; overflow: visible; }
      .animal-table { min-width: 0; border: 0; }
      .animal-table thead { display: none; }
      .animal-table tbody, .animal-table tr, .animal-table th, .animal-table td { display: block; width: 100%; }
      .animal-table tr { margin-bottom: 0.5rem; border: 1px solid #d8ddd9; }
      .animal-table th, .animal-table td { border: 0; border-bottom: 1px solid #e5e8e6; padding: 0.45rem 0.75rem; }
      .animal-table tr > :last-child { border-bottom: 0; }
      .animal-table td::before { content: attr(data-label); display: block; margin-bottom: 0.25rem; color: #6a746d; font-size: 0.7rem; font-weight: bold; }
      .animal-table td[data-label="施設数"] { display: none; }
      .animal-table td[data-label="分類"]::before,
      .animal-table td[data-label="施設一覧"]::before { display: none; }
      .animal-table th.animal-name { display: flex; align-items: center; background: #f7faf8; padding: 0.6rem 0.75rem; }
      footer { padding: 1rem 0.75rem; line-height: 1.5; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/animals")}
  ${breadcrumb}
  <div class="taxonomy-detail-heading">
    <h1>${escapedValue}</h1>
    ${favoriteButtonHtml}
  </div>
  <p class="summary">${escapeHtml(rank.label)}: ${escapedValue} / 動物: ${animals.length} 件 / 施設: ${zooAnimalCounts.size} 施設</p>
  ${representativeHtml}
  ${topZoosHtml}
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
      : renderStateMessage("該当する動物がありません。", [
          { href: buildTaxonomyIndexUrl(), label: "分類一覧へ戻る" },
          { href: buildAnimalsUrl("all"), label: "動物一覧を見る" },
        ])
  }
  <footer>分類は利用者が探しやすい粒度で整理しています。最新情報は各施設の公式サイトでご確認ください。</footer>
  <script src="/favorites.js?v=5" defer></script>
</body>
</html>`;
}

function renderZooDetailHtml(
  zoo: Zoo,
  scraped: ScrapeResult,
  coverage: ZooCoverageStats,
  imageKeys: AnimalImageVersionIndex = new Map(),
  taxonomyByAnimal: Map<string, string> = new Map(),
  news: ZooNewsRow[] = [],
  pageUrl?: string
): string {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Zoo",
    name: zoo.name,
    ...(pageUrl ? { url: pageUrl } : {}),
    address: zoo.address,
    geo: { "@type": "GeoCoordinates", latitude: zoo.lat, longitude: zoo.lon },
    sameAs: [zoo.website, zoo.wikipediaUrl].filter((value): value is string => Boolean(value)),
  };
  const structuredDataJson = JSON.stringify(structuredData).replace(/<\//g, "<\\/");
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
        `<button type="button" class="ui-chip ui-touch-target" data-class-filter="${escapeHtml(className)}" aria-pressed="false">${escapeHtml(className)} <span>${count}</span></button>`
    )
    .join("");
  const classFilterHtml = classCounts.size > 0
    ? `<div class="class-filters" aria-label="分類で絞り込み">
        <button type="button" class="ui-chip ui-chip--active ui-touch-target" data-class-filter="all" aria-pressed="true">すべて <span>${scraped.animals.length}</span></button>
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
                  <span>${escapeHtml(formatAnimalDisplayName(animal))}</span>
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
        ? `<img src="${buildAnimalImageUrl(animal, imageKeys.get(animalKey))}" alt="" class="animal-thumb ui-thumb ui-thumb--36" loading="lazy" width="36" height="36">`
        : renderAnimalImagePlaceholder("animal-thumb ui-thumb--36", { compact: true, ariaHidden: true });
      return `<li data-class="${escapeHtml(className)}"><a href="${buildZooAnimalUrl(animal)}">${thumb}<span>${escapeHtml(formatAnimalDisplayName(animal))}</span><small>${escapeHtml(className)}</small></a></li>`;
    })
    .join("\n");
  const updatedAt = new Date(scraped.scrapedAt).toLocaleString("ja-JP");
  const shortUpdatedAt = new Date(scraped.scrapedAt).toLocaleDateString("ja-JP");
  const animalListHtml =
    scraped.animals.length > 0
      ? `${classFilterHtml}<ul class="animal-links" id="zoo-animal-list">${animalLinks}</ul>`
      : renderStateMessage(
          "動物一覧をまだ取得できていません。最新の情報は公式サイトでご確認ください。",
          [
            { href: zoo.website, label: "公式サイトを見る", external: true },
            { href: buildBrowseUrl(zoo.prefecture, null), label: "動物園一覧へ戻る" },
          ]
        );
  const coverageHtml = coverage.total > 0
    ? `<dl class="coverage-stats">
        <div><dt>総動物数</dt><dd>${coverage.total}</dd></div>
        <div><dt>分類済み</dt><dd>${coverage.classified}</dd></div>
        <div><dt>部分分類</dt><dd>${coverage.partial}</dd></div>
        <div><dt>未分類</dt><dd>${coverage.unclassified}</dd></div>
      </dl>`
    : "";
  const quickFacts = [
    ["動物種数", scraped.animals.length > 0 ? `${scraped.animals.length} 種` : "未取得"],
    ["地域", prefLabel],
    ["開園時間", zoo.openingHours],
    ["入園料", zoo.admission],
    ["最終取得", scraped.scrapedAt ? shortUpdatedAt : "未取得"],
  ];
  const quickFactsHtml = `<dl class="quick-facts">
    ${quickFacts
      .map(
        ([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`
      )
      .join("")}
  </dl>`;
  const breadcrumb = renderBreadcrumb([
    { href: "/zoos", label: "動物園一覧" },
    { href: `/zoos?pref=${zoo.prefecture}`, label: prefLabel },
    { label: zoo.name },
  ]);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(zoo.name)} | 近畿動物園情報</title>
  <script type="application/ld+json">${structuredDataJson}</script>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1.5rem; }
    .section { border: 1px solid #ddd; padding: 1rem; margin-bottom: 1rem; }
    h2 { margin-bottom: 0.5rem; }
    h3 { font-size: 1.05rem; margin-bottom: 0.75rem; }
    .zoo-title-row { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; margin-bottom: 0.75rem; }
    .zoo-title-main { min-width: 0; }
    .zoo-title-main h2 { margin-bottom: 0.25rem; }
    .kana { color: #777; }
    .hero-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.55rem; flex: 0 0 auto; }
    .hero-actions a { font-size: 0.86rem; }
    .quick-facts { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0.5rem; margin-bottom: 0.85rem; }
    .quick-facts div { min-width: 0; border: 1px solid #e0e8e3; background: #f8fbf9; padding: 0.55rem 0.65rem; }
    .quick-facts dt { color: #66756b; font-size: 0.72rem; margin-bottom: 0.18rem; }
    .quick-facts dd { color: #222; font-size: 0.86rem; font-weight: bold; line-height: 1.35; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
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
    .class-filters button { font: inherit; font-size: 0.82rem; }
    .class-filters span { opacity: 0.78; font-size: 0.72rem; }
    .animal-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.4rem 1rem; padding: 0; list-style: none; }
    .animal-links li { min-width: 0; }
    .animal-links a { display: flex; align-items: center; gap: 0.5rem; color: #1f5b45; border-bottom: 1px solid #e7eee9; padding: 0.35rem 0; text-decoration: none; overflow-wrap: anywhere; }
    .animal-links a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .animal-links a small { margin-left: auto; color: #777; font-size: 0.7rem; }
    .animal-links li.is-hidden { display: none; }
    .animal-links .animal-thumb { width: 36px; height: 36px; }
    .animal-meta { color: #777; font-size: 0.78rem; margin-top: 0.85rem; }
    .error { color: #b00020; margin-bottom: 0.75rem; }
    .empty { color: #777; }
    .zoo-news-section { background: #fafcfb; border-left: 3px solid #1f5b45; }
    .section-ext-link { display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.78rem; color: #1f5b45; text-decoration: none; }
    .section-ext-link:hover { text-decoration: underline; }
    .zoo-news-list { list-style: none; display: grid; gap: 0; }
    .zoo-news-list li { display: grid; gap: 0.28rem; padding: 0.6rem 0; border-bottom: 1px solid #e5eee8; }
    .zoo-news-list li:last-child { border-bottom: 0; }
    .news-meta { display: flex; flex-wrap: wrap; gap: 0.3rem 0.45rem; align-items: center; }
    .news-date { flex: 0 0 auto; color: #888; font-size: 0.76rem; font-variant-numeric: tabular-nums; }
    .news-title { color: #1a1a1a; text-decoration: none; font-size: 0.9rem; line-height: 1.5; overflow-wrap: anywhere; }
    .news-title:hover { color: #1f5b45; text-decoration: underline; text-underline-offset: 0.2em; }
    .news-animals { display: flex; flex-wrap: wrap; gap: 0.3rem; }
    .news-animals a { font-size: 0.72rem; color: #1f5b45; background: #f0f7f3; border: 1px solid #c5dece; padding: 0.1rem 0.45rem; text-decoration: none; }
    .news-animals a:hover { background: #e1f0e8; }
    #map { height: 320px; border: 1px solid #ddd; }
    @media (max-width: 640px) {
      main { padding: 0.75rem; }
      .section { padding: 0.75rem; }
      .zoo-title-row { display: grid; gap: 0.75rem; }
      .hero-actions { justify-content: flex-start; }
      .quick-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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
${renderGlobalNav("/zoos")}
  ${breadcrumb}
  <main>
    <nav class="page-nav">
      ${news.length > 0 ? `<a href="#zoo-news">お知らせ</a>` : ""}
      <a href="#animals">動物一覧</a>
      <a href="${escapeHtml(zoo.website)}" target="_blank" rel="noopener noreferrer">公式サイト</a>
    </nav>
    <section class="section">
      <div class="zoo-title-row">
        <div class="zoo-title-main">
          <h2>${escapeHtml(zoo.name)}</h2>
          <p class="kana">${escapeHtml(zoo.nameKana)}</p>
        </div>
        <div class="hero-actions">
          <a class="primary-link ui-btn ui-btn--primary ui-touch-target" href="${escapeHtml(zoo.website)}" target="_blank" rel="noopener noreferrer">${icon("open_in_new")}公式サイトを見る</a>
          <a class="secondary-link ui-btn ui-btn--secondary ui-touch-target" href="${buildMapUrl(zoo.prefecture, null)}#zoo-${escapeHtml(zoo.id)}">${icon("map")}地図で見る</a>
          ${renderFavoriteButton("zoo", zoo.id, zoo.name, `/zoos/${encodeURIComponent(zoo.id)}`, "large")}
        </div>
      </div>
      ${quickFactsHtml}
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
    ${
      news.length > 0
        ? `<section class="section zoo-news-section" id="zoo-news">
        <div class="section-heading">
          <h3 class="icon-heading">${icon("campaign")}お知らせ</h3>
          <a href="${escapeHtml(zoo.website)}" target="_blank" rel="noopener noreferrer" class="section-ext-link">公式サイトで見る${icon("open_in_new")}</a>
        </div>
        <ul class="zoo-news-list">
          ${news
            .map((item) => {
              const animals = item.animal_names
                ? item.animal_names.split(",").filter(Boolean)
                : [];
              const animalsHtml = animals.length > 0
                ? `<div class="news-animals">${renderNewsAnimalLinks(animals, imageKeys)}</div>`
                : "";
              const badges = renderNewsItemBadges(item.title, item.published_at);
              return `<li>
                <div class="news-meta">
                  ${item.published_at ? `<span class="news-date">${escapeHtml(item.published_at)}</span>` : ""}
                  ${badges}
                </div>
                <a class="news-title" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
                ${animalsHtml}
              </li>`;
            })
            .join("")}
        </ul>
      </section>`
        : ""
    }
    ${featuredHtml}
    <section class="section" id="animals">
      <h3>見られる動物</h3>
      ${coverageHtml}
      <p class="animal-summary">${scraped.animals.length} 件</p>
      ${
        scraped.error
          ? renderStateMessage(
              "動物一覧の取得で問題が発生しました。時間をおいて再度ご確認いただくか、公式サイトをご確認ください。",
              [{ href: zoo.website, label: "公式サイトを見る", external: true }],
              "error"
            )
          : ""
      }
      ${animalListHtml}
      <p class="animal-meta">最終取得: ${escapeHtml(updatedAt)}</p>
    </section>
    <div id="map"></div>
  </main>
  <script src="/favorites.js?v=5" defer></script>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
    var filterButtons = document.querySelectorAll('[data-class-filter]');
    var animalItems = document.querySelectorAll('#zoo-animal-list li[data-class]');
    function applyClassFilter(value) {
      var matched = false;
      filterButtons.forEach(function(item) {
        var isCurrent = item.dataset.classFilter === value;
        if (isCurrent) matched = true;
        item.classList.toggle('ui-chip--active', isCurrent);
        item.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
      });
      if (!matched) return;
      animalItems.forEach(function(item) {
        item.classList.toggle('is-hidden', value !== 'all' && item.dataset.class !== value);
      });
    }
    filterButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        applyClassFilter(button.dataset.classFilter);
      });
    });
    var requestedClass = new URLSearchParams(location.search).get('class');
    if (requestedClass) {
      applyClassFilter(requestedClass);
      var animalListEl = document.getElementById('zoo-animal-list');
      if (animalListEl) animalListEl.scrollIntoView({ block: 'start' });
    }

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

function renderNewsItems(
  news: ZooNewsRow[],
  imageKeys: AnimalImageVersionIndex = new Map(),
  emptyMessage = "お知らせはまだありません。"
): string {
  if (news.length === 0) return `<li class="news-empty">${escapeHtml(emptyMessage)}</li>`;
  return news
    .map((item) => {
      const zoo = zoos.find((z) => z.id === item.zoo_id);
      const animals = item.animal_names ? item.animal_names.split(",").filter(Boolean) : [];
      const animalsHtml = animals.length > 0
        ? `<div class="news-animals">${renderNewsAnimalLinks(animals, imageKeys)}</div>`
        : "";
      const badges = renderNewsItemBadges(item.title, item.published_at);
      return `<li data-zoo="${escapeHtml(item.zoo_id)}" data-animals="${escapeHtml(animals.join(","))}">
          <div class="news-meta">
            ${item.published_at ? `<span class="news-date">${escapeHtml(item.published_at)}</span>` : ""}
            ${zoo ? `<a class="news-zoo-label" href="/zoos/${escapeHtml(zoo.id)}">${escapeHtml(zoo.name)}</a>` : ""}
            ${badges}
          </div>
          <a class="news-title" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a>
          ${animalsHtml}
        </li>`;
    })
    .join("");
}

function renderNewsListHtml(
  news: ZooNewsRow[],
  activePref: PrefectureCode | null,
  imageKeys: AnimalImageVersionIndex = new Map()
): string {
  const zooIds = [...new Set(news.map((n) => n.zoo_id))];
  const zooFilterHtml = zooIds.length > 1
    ? `<div class="news-zoo-filters">
        <button type="button" class="ui-chip ui-chip--active ui-touch-target" data-zoo-filter="all" aria-pressed="true">すべて</button>
        ${zooIds
          .map((id) => {
            const zoo = zoos.find((z) => z.id === id);
            return zoo
              ? `<button type="button" class="ui-chip ui-touch-target" data-zoo-filter="${escapeHtml(id)}" aria-pressed="false">${escapeHtml(zoo.name)}</button>`
              : "";
          })
          .join("")}
      </div>`
    : "";

  const itemsHtml = renderNewsItems(news, imageKeys);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>お知らせ一覧 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 900px; margin: 0 auto; padding: 1.5rem; }
    h1 { font-size: 1.3rem; margin-bottom: 1rem; }
    .news-zoo-filters { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1rem; }
    .news-zoo-filters button { font: inherit; font-size: 0.82rem; }
    .news-list { list-style: none; display: grid; gap: 0; }
    .news-list li { display: grid; gap: 0.3rem; border-bottom: 1px solid #eee; padding: 0.85rem 0.65rem; }
    .news-list li:first-child { border-top: 1px solid #eee; }
    .news-list li:hover { background: #fafcfb; }
    .news-list li.is-hidden { display: none; }
    .news-meta { display: flex; flex-wrap: wrap; gap: 0.35rem 0.55rem; align-items: center; }
    .news-date { flex: 0 0 auto; color: #888; font-size: 0.76rem; font-variant-numeric: tabular-nums; }
    .news-zoo-label { flex: 0 0 auto; color: #1f5b45; font-size: 0.78rem; font-weight: bold; text-decoration: none; }
    .news-zoo-label:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .news-title { color: #1a1a1a; text-decoration: none; font-size: 0.93rem; line-height: 1.5; overflow-wrap: anywhere; }
    .news-title:hover { color: #1f5b45; text-decoration: underline; text-underline-offset: 0.2em; }
    .news-animals { display: flex; flex-wrap: wrap; gap: 0.3rem; }
    .news-animals a { font-size: 0.72rem; color: #1f5b45; background: #f0f7f3; border: 1px solid #c5dece; padding: 0.1rem 0.45rem; text-decoration: none; }
    .news-animals a:hover { background: #e1f0e8; }
    .news-empty { color: #777; font-size: 0.9rem; }
    @media (max-width: 640px) { main { padding: 0.75rem; } .news-list li { padding: 0.75rem 0.35rem; } }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/news")}
  <main>
    <h1>お知らせ一覧</h1>
    ${zooFilterHtml}
    <ul class="news-list">${itemsHtml}</ul>
  </main>
  <script defer>
    var filterBtns = document.querySelectorAll('[data-zoo-filter]');
    var newsItems = document.querySelectorAll('.news-list li[data-zoo]');
    var activeZoo = 'all';

    function applyFilters() {
      newsItems.forEach(function(item) {
        var zooMatch = activeZoo === 'all' || item.dataset.zoo === activeZoo;
        item.classList.toggle('is-hidden', !zooMatch);
      });
    }

    filterBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        activeZoo = btn.dataset.zooFilter;
        filterBtns.forEach(function(b) {
          var on = b === btn;
          b.classList.toggle('ui-chip--active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        applyFilters();
      });
    });
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

const CLASS_SORT_ORDER = ["魚類", "鳥類", "軟骨魚類", "爬虫類", "哺乳類", "無脊椎動物", "両生類"];

function renderZooViewTabs(
  activePref: PrefectureCode | null,
  activeView: ZooView,
  animal: string | null = null,
  taxClass: string | null = null
): string {
  const tabs: Array<{ view: ZooView; label: string; iconName: IconName }> = [
    { view: "list", label: "一覧", iconName: "view_list" },
    { view: "map", label: "地図", iconName: "map" },
    { view: "taxonomy", label: "分類表", iconName: "compare_arrows" },
  ];
  return `<nav class="view-toggle" aria-label="動物園の表示切り替え">
    ${tabs.map((tab) => {
      const preserveFilters = tab.view !== "taxonomy";
      const href = buildZoosUrl(
        activePref,
        preserveFilters ? animal : null,
        { cls: preserveFilters ? taxClass : null, view: tab.view }
      );
      return `<a href="${escapeHtml(href)}" class="view-toggle-btn${tab.view === activeView ? " view-toggle-btn--active" : ""}"${tab.view === activeView ? ' aria-current="page"' : ""}>${icon(tab.iconName)}${tab.label}</a>`;
    }).join("")}
  </nav>`;
}

function renderZooCompareBar(): string {
  return `<div class="compare-bar" id="compare-bar" hidden>
    <span class="compare-bar-text" id="compare-bar-text" aria-live="polite"></span>
    <button type="button" class="compare-go" id="compare-go" disabled>${icon("compare_arrows")}比較する</button>
    <button type="button" class="compare-clear" id="compare-clear">${icon("close")}クリア</button>
  </div>`;
}

function renderZooCompareScript(activePref: PrefectureCode | null): string {
  const allowedZooIds = zoos
    .filter((zoo) => !activePref || zoo.prefecture === activePref)
    .map((zoo) => zoo.id);
  return `<script>
  (function() {
    var storageKey = 'kinkizoo:compare:v1';
    var allowedZooIds = new Set(${JSON.stringify(allowedZooIds)});
    var selected = [];
    try {
      var parsed = JSON.parse(window.sessionStorage.getItem(storageKey) || '[]');
      if (Array.isArray(parsed)) {
        selected = parsed.filter(function(item) {
          return item && typeof item.id === 'string' && typeof item.name === 'string' && allowedZooIds.has(item.id);
        }).slice(0, 3);
      }
    } catch (e) {
      selected = [];
    }

    var bar = document.getElementById('compare-bar');
    var barText = document.getElementById('compare-bar-text');
    var goBtn = document.getElementById('compare-go');
    var clearBtn = document.getElementById('compare-clear');

    function save() {
      try { window.sessionStorage.setItem(storageKey, JSON.stringify(selected)); } catch (e) {}
    }

    function selectedIndex(id) {
      return selected.findIndex(function(item) { return item.id === id; });
    }

    function syncTableHighlight() {
      var heads = Array.prototype.slice.call(document.querySelectorAll('.zoo-head'));
      heads.forEach(function(head) {
        var control = head.querySelector('[data-compare-zoo]');
        head.classList.toggle('is-checked', Boolean(control && selectedIndex(control.dataset.compareZoo) >= 0));
      });
      document.querySelectorAll('.cnt-cell').forEach(function(cell) {
        cell.classList.remove('is-checked-a', 'is-checked-b', 'is-checked-c');
      });
      selected.forEach(function(item, selectedPosition) {
        var columnPosition = heads.findIndex(function(head) {
          var control = head.querySelector('[data-compare-zoo]');
          return control && control.dataset.compareZoo === item.id;
        });
        if (columnPosition < 0) return;
        document.querySelectorAll('.pivot-table tbody tr').forEach(function(row) {
          var cell = row.children[columnPosition + 1];
          if (cell) cell.classList.add(['is-checked-a', 'is-checked-b', 'is-checked-c'][selectedPosition]);
        });
      });
    }

    function sync() {
      document.querySelectorAll('[data-compare-zoo]').forEach(function(control) {
        var active = selectedIndex(control.dataset.compareZoo) >= 0;
        if (control.tagName === 'INPUT') {
          control.checked = active;
          control.disabled = !active && selected.length >= 3;
          var labelText = control.parentElement && control.parentElement.querySelector('[data-compare-label]');
          if (labelText) labelText.textContent = active ? '比較から外す' : '比較に追加';
        } else {
          control.setAttribute('aria-pressed', active ? 'true' : 'false');
          control.disabled = !active && selected.length >= 3;
          control.textContent = active ? '比較から外す' : '比較に追加';
        }
      });
      document.querySelectorAll('.zoo-table tbody tr').forEach(function(row) {
        var control = row.querySelector('[data-compare-zoo]');
        row.classList.toggle('is-compare-selected', Boolean(control && selectedIndex(control.dataset.compareZoo) >= 0));
      });
      syncTableHighlight();
      if (bar && barText && goBtn) {
        bar.hidden = selected.length === 0;
        document.documentElement.classList.toggle('has-compare-selection', selected.length > 0);
        barText.textContent = selected.length + '/3園: ' + selected.map(function(item) { return item.name; }).join('・');
        goBtn.disabled = selected.length < 2;
      }
    }

    function toggle(id, name, nextActive) {
      var index = selectedIndex(id);
      var shouldAdd = typeof nextActive === 'boolean' ? nextActive : index < 0;
      if (shouldAdd && index < 0 && selected.length < 3) selected.push({ id: id, name: name || id });
      if (!shouldAdd && index >= 0) selected.splice(index, 1);
      save();
      sync();
    }

    document.addEventListener('change', function(event) {
      var control = event.target && event.target.closest ? event.target.closest('input[data-compare-zoo]') : null;
      if (!control) return;
      toggle(control.dataset.compareZoo, control.dataset.compareName, control.checked);
    });

    document.addEventListener('click', function(event) {
      var control = event.target && event.target.closest ? event.target.closest('button[data-compare-zoo]') : null;
      if (!control) return;
      event.preventDefault();
      toggle(control.dataset.compareZoo, control.dataset.compareName);
    });

    if (goBtn) {
      goBtn.addEventListener('click', function() {
        if (selected.length < 2) return;
        var params = new URLSearchParams();
        ['a', 'b', 'c'].forEach(function(key, index) {
          if (selected[index]) params.set(key, selected[index].id);
        });
        ${activePref ? `params.set('pref', ${JSON.stringify(activePref)});` : ""}
        location.href = (window.__BASE_PATH__ || '') + '/zoos?' + params.toString();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        selected = [];
        save();
        sync();
      });
    }

    window.KinkiZooCompare = { sync: sync };
    save();
    sync();
  })();
  </script>`;
}

function renderCompareIndexHtml(
  countRows: TaxonomyCountRow[],
  animalCounts: Map<string, number>,
  activePref: PrefectureCode | null
): string {
  // Build lookup: zooId -> className -> orderName -> count
  const lookup = new Map<string, Map<string, Map<string, number>>>();
  const classOrderMap = new Map<string, Set<string>>();
  const eligibleZoos = zoos.filter((zoo) => !activePref || zoo.prefecture === activePref);
  const eligibleZooIds = new Set(eligibleZoos.map((zoo) => zoo.id));

  for (const row of countRows) {
    if (!eligibleZooIds.has(row.zoo_id)) continue;
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

  const sortedZoos = eligibleZoos
    .sort((a, b) => (animalCounts.get(b.id) ?? 0) - (animalCounts.get(a.id) ?? 0));

  // Column-local heat scale: each zoo列は自分の最も展示数が多い「目」を基準に
  // 濃淡を付けるので、動物園ごとの得意な分類が規模差に関わらず浮かび上がる。
  const zooOrderMax = new Map<string, number>(
    sortedZoos.map((zoo) => {
      const byClass = lookup.get(zoo.id);
      const max = byClass
        ? Math.max(0, ...[...byClass.values()].flatMap((byOrder) => [...byOrder.values()]))
        : 0;
      return [zoo.id, max];
    })
  );

  const headerCells = sortedZoos
    .map(
      (zoo) => `<th class="zoo-head" scope="col">
        <label class="zoo-label">
          <input type="checkbox" class="zoo-check" value="${escapeHtml(zoo.id)}" data-compare-zoo="${escapeHtml(zoo.id)}" data-compare-name="${escapeHtml(zoo.name)}">
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
              const heat = heatStep(cnt, zooOrderMax.get(zoo.id) ?? 0);
              return `<td class="cnt-cell heat-${heat}">${cnt || ""}</td>`;
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
  <title>動物園の分類表 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1.25rem 1.5rem 5rem; display: grid; gap: 1.25rem; }
    h1 { font-size: 1.15rem; }
    .taxonomy-view-heading { display: grid; gap: 0.35rem; }
    .taxonomy-view-heading h2 { font-size: 1rem; }
    .taxonomy-view-heading p { color: #666; font-size: 0.82rem; line-height: 1.5; }
    .view-toggle { display: inline-flex; gap: 0.3rem; border: 1px solid #d3e0d8; background: #f3f7f4; padding: 0.25rem; border-radius: 6px; width: fit-content; }
    .view-toggle-btn { display: inline-flex; align-items: center; gap: 0.35rem; border-radius: 4px; color: #4c5d53; padding: 0.4rem 0.9rem; font-size: 0.85rem; font-weight: bold; text-decoration: none; }
    .view-toggle-btn--active { background: #1f5b45; color: #fff; }
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
    .cnt-cell.heat-1 { background: #e4f1eb; }
    .cnt-cell.heat-2 { background: #c9e3d8; }
    .cnt-cell.heat-3 { background: #b7dacb; }
    .cnt-cell.heat-4 { background: #a5d0be; }
    .cnt-cell.is-checked-a, .cnt-cell.is-checked-b, .cnt-cell.is-checked-c { box-shadow: inset 0 0 0 2px #4f8f71; }
    .heat-legend { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: #777; }
    .heat-legend-scale { display: flex; }
    .heat-legend-scale span { width: 1.1rem; height: 0.75rem; }
    .heat-legend-scale span:nth-child(1) { background: #fff; border: 1px solid #eee; }
    .heat-legend-scale span:nth-child(2) { background: #e4f1eb; }
    .heat-legend-scale span:nth-child(3) { background: #c9e3d8; }
    .heat-legend-scale span:nth-child(4) { background: #b7dacb; }
    .heat-legend-scale span:nth-child(5) { background: #a5d0be; }
    .compare-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1f5b45; color: #fff; padding: 0.75rem 1.5rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; z-index: 100; box-shadow: 0 -2px 8px rgba(0,0,0,0.15); }
    .compare-bar[hidden] { display: none; }
    .compare-bar-text { flex: 1; font-size: 0.88rem; }
    .compare-go { display: inline-flex; align-items: center; gap: 0.3rem; border: 2px solid #fff; background: #fff; color: #1f5b45; padding: 0.4rem 1rem; cursor: pointer; font-size: 0.88rem; font-weight: bold; }
    .compare-go:disabled { opacity: 0.5; cursor: default; }
    .compare-clear { display: inline-flex; align-items: center; gap: 0.3rem; border: 1px solid rgba(255,255,255,0.5); background: transparent; color: #fff; padding: 0.4rem 0.75rem; cursor: pointer; font-size: 0.82rem; }
    html.has-compare-selection body { padding-bottom: 4.5rem; }
    @media (max-width: 640px) {
      main { padding: 0.75rem 0.5rem 5rem; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/zoos")}
  <main>
    <h1>動物園</h1>
    ${renderZooViewTabs(activePref, "taxonomy")}
    <div class="taxonomy-view-heading">
      <h2>分類表</h2>
      <p>分類ごとの掲載数を見ながら、比較したい動物園を2〜3園選べます。</p>
    </div>
    <p class="heat-legend">各列内で展示数が多い「目」ほど濃い色: <span class="heat-legend-scale"><span></span><span></span><span></span><span></span><span></span></span> 少ない→多い</p>
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
  ${renderZooCompareBar()}
  ${renderZooCompareScript(activePref)}
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
  animalCounts: Map<string, number>,
  activePref: PrefectureCode | null
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

  // Column-local heat scale: each column (共通 + 各動物園) is colored relative to
  // its own busiest 目 so a zoo's standout orders show up regardless of how the
  // other selected zoos' collections compare in size.
  const columnOrderCounts = [commonAnimals, ...exclusiveLists].map((rows) => groupByOrder(rows));
  const columnMax = columnOrderCounts.map((grp) =>
    Math.max(0, ...[...grp.values()].map((names) => names.length))
  );

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
    `<li><a href="/animal/${encodeURIComponent(name)}">${escapeHtml(formatAnimalDisplayName(name))}</a></li>`;

  const zooOptions = (sel: string, name: string) =>
    `<div class="select-group"><select name="${escapeHtml(name)}"><option value="">（なし）</option>${
      zoos.filter((z) => !activePref || z.prefecture === activePref).map((z) => {
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

    const zooClassUrl = (zooId: string) =>
      `/zoos/${encodeURIComponent(zooId)}?class=${encodeURIComponent(cls)}`;
    const clsSummaryParts = [
      clsCommon.length ? `共通: ${clsCommon.length}` : "",
      ...clsExcl.map((l, i) =>
        l.length
          ? `<a href="${zooClassUrl(selected[i].zoo.id)}">${escapeHtml(selected[i].zoo.name.slice(0, 4))}: ${l.length}</a>`
          : ""
      ),
    ].filter(Boolean).join(" · ");

    const orderSections = allOrders.map((ord) => {
      const oCommon = ordGrpCommon.get(ord) ?? [];
      const oExcl = ordGrpExcl.map((g) => g.get(ord) ?? []);
      const ordSummary = [
        oCommon.length ? `共通: ${oCommon.length}` : "",
        ...oExcl.map((l, i) => (l.length ? `${selected[i].zoo.name.slice(0, 4)}: ${l.length}` : "")),
      ].filter(Boolean).join(" · ");
      const commonHeat = heatStep(oCommon.length, columnMax[0]);
      return `<div class="order-section">
        <div class="order-heading">${escapeHtml(ord)}<span class="class-counts">${escapeHtml(ordSummary)}</span></div>
        <div class="compare-grid" style="grid-template-columns:${gridCols}">
          <div class="compare-col compare-col--common heat-${commonHeat}"><ul class="col-list">${oCommon.map(animalLink).join("")}</ul></div>
          ${oExcl.map((l, i) => `<div class="compare-col heat-${heatStep(l.length, columnMax[i + 1])}"><ul class="col-list">${l.map(animalLink).join("")}</ul></div>`).join("")}
        </div>
      </div>`;
    }).join("");

    return `<section class="class-section">
      <h2 class="class-heading">${escapeHtml(cls)}<span class="class-counts">${clsSummaryParts}</span></h2>
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
    .compare-back { width: fit-content; color: #1f5b45; font-size: 0.85rem; font-weight: bold; text-decoration: none; }
    .compare-back:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .compare-form { display: flex; flex-wrap: nowrap; gap: 0.5rem; align-items: center; padding: 0.75rem; background: #f8fbf9; border: 1px solid #dce7df; }
    .select-group { flex: 1 1 0; min-width: 0; }
    .select-group select { width: 100%; min-height: 42px; border: 1px solid #bbb; padding: 0.4rem 0.6rem; background: #fff; }
    .compare-form button { display: inline-flex; align-items: center; gap: 0.3rem; min-height: 42px; border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.4rem 1.1rem; cursor: pointer; font-size: 0.9rem; flex-shrink: 0; white-space: nowrap; }
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
    .class-counts a { color: #1f5b45; text-decoration: none; }
    .class-counts a:hover { text-decoration: underline; }
    .order-section { border-top: 1px solid #eee; }
    .order-section:first-child { border-top: none; }
    .order-heading { font-size: 0.78rem; color: #777; background: #fcfcfc; padding: 0.3rem 0.85rem 0.3rem 1.4rem; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: baseline; }
    .compare-grid { display: grid; }
    .compare-col { border-right: 1px solid #eee; min-height: 1px; }
    .compare-col:last-child { border-right: none; }
    .compare-col--common { background: #fafffe; }
    .compare-col.heat-1 { background: #e4f1eb; }
    .compare-col.heat-2 { background: #c9e3d8; }
    .compare-col.heat-3 { background: #b7dacb; }
    .compare-col.heat-4 { background: #a5d0be; }
    .col-list { list-style: none; }
    .col-list li { border-bottom: 1px solid #f5f5f5; }
    .col-list li:last-child { border-bottom: none; }
    .col-list a { display: block; padding: 0.28rem 0.85rem; font-size: 0.82rem; color: #1f5b45; text-decoration: none; }
    .col-list a:hover { background: #f5fbf8; }
    .heat-legend { display: flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; color: #777; }
    .heat-legend-scale { display: flex; }
    .heat-legend-scale span { width: 1.1rem; height: 0.75rem; }
    .heat-legend-scale span:nth-child(1) { background: #fff; border: 1px solid #eee; }
    .heat-legend-scale span:nth-child(2) { background: #e4f1eb; }
    .heat-legend-scale span:nth-child(3) { background: #c9e3d8; }
    .heat-legend-scale span:nth-child(4) { background: #b7dacb; }
    .heat-legend-scale span:nth-child(5) { background: #a5d0be; }
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
${renderGlobalNav("/zoos")}
  <main>
    <h1>動物園を比較</h1>
    <a class="compare-back" href="${escapeHtml(buildZoosUrl(activePref, null))}">← 動物園を選び直す</a>
    <form class="compare-form" action="/zoos" method="get">
      ${activePref ? `<input type="hidden" name="pref" value="${escapeHtml(activePref)}">` : ""}
      ${zooOptions(selected[0]?.zoo.id ?? "", "a")}
      ${zooOptions(selected[1]?.zoo.id ?? "", "b")}
      ${zooOptions(selected[2]?.zoo.id ?? "", "c")}
      <button type="submit">${icon("compare_arrows")}比較する</button>
    </form>
    <p class="heat-legend">各列内で展示数が多い「目」ほど濃い色: <span class="heat-legend-scale"><span></span><span></span><span></span><span></span><span></span></span> 少ない→多い</p>
    <div class="compare-header">${headerLabels}</div>
    ${classSections}
  </main>
</body>
</html>`;
}

const MAP_CLASS_FILTERS = ["魚類", "鳥類", "軟骨魚類", "爬虫類", "哺乳類", "無脊椎動物", "両生類"];
const MAP_MOBILE_BREAKPOINT = 640;

function renderZoosHtml(
  results: ZooSearchResult[],
  activePref: PrefectureCode | null,
  animal: string | null,
  taxClass: string | null = null,
  view: Exclude<ZooView, "taxonomy"> = "list",
  initialLat: number | null = null,
  initialLon: number | null = null,
  initialZoom: number | null = null
): string {
  const escapedAnimal = escapeHtml(animal ?? "");
  const includeMatchSummary = Boolean(animal || taxClass);

  const count = results.length;
  const matchCount = results.reduce((sum, result) => sum + result.matchedAnimals.length, 0);
  const prefLabel = activePref && isPrefectureCode(activePref) ? PREF_LABELS[activePref] : "近畿一円";
  const summary = taxClass
    ? `${prefLabel}で${escapeHtml(taxClass)}を見られる動物園・施設: ${count} 件 / ${matchCount} 種`
    : animal
      ? `${prefLabel}で「${escapedAnimal}」を探せる動物園・施設: ${count} 件 / 検索ヒット: ${matchCount} 件`
      : `${prefLabel}の動物園・施設: ${count} 件`;

  const classChips = MAP_CLASS_FILTERS.map((cls) => {
    const active = cls === taxClass;
    const href = active
      ? buildZoosUrl(activePref, null, { view })
      : buildZoosUrl(activePref, null, { cls, view });
    return `<a href="${escapeHtml(href)}" class="cls-chip${active ? " cls-chip--active" : ""}">${escapeHtml(cls)}</a>`;
  }).join("");

  const clearHref = buildZoosUrl(activePref, null, { view });

  if (count === 0) {
    const emptyMessage = animal
      ? `「${escapedAnimal}」に該当する施設が見つかりませんでした。`
      : taxClass
        ? "選択した分類に該当する施設が見つかりませんでした。"
        : "表示できる施設が見つかりませんでした。";
    const emptyStateHtml = renderStateMessage(emptyMessage, [
      ...(animal || taxClass ? [{ href: clearHref, label: "検索条件をクリア" }] : []),
      { href: buildZoosUrl(activePref, null), label: "動物園一覧へ戻る" },
    ]);
    return renderZoosShell({
      activePref,
      animal,
      escapedAnimal,
      taxClass,
      view,
      classChips,
      bodyHtml: `<p class="summary">${summary}</p>\n  ${emptyStateHtml}`,
      showResultPanel: false,
    });
  }

  const rows = results.map((result) => renderZooCard(result, includeMatchSummary)).join("\n");
  const zooListHtml = `<div class="zoo-list"><table class="zoo-table">
    <thead>
      <tr>
        <th scope="col">施設名</th>
        <th scope="col">都道府県</th>
        <th scope="col">動物種数</th>
        ${includeMatchSummary ? `<th scope="col">検索ヒット</th>` : ""}
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table></div>`;

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

  const showPanel = Boolean(animal || taxClass);
  const resultListHtml = showPanel
    ? results.map((r) => {
        const matched = r.matchedAnimals.map((a) => `<a href="/animal/${encodeURIComponent(a)}">${escapeHtml(formatAnimalDisplayName(a))}</a>`).join("、");
        const cnt = r.matchedAnimals.length;
        return `<li class="result-item" data-zoo-id="${escapeHtml(r.zoo.id)}">
          <a class="result-link" href="/zoos/${encodeURIComponent(r.zoo.id)}${activePref ? `?pref=${activePref}` : ""}">
            <span class="result-name">${escapeHtml(r.zoo.name)}<span class="result-count">${cnt}種</span></span>
          </a>
          <p class="result-animals">${matched}</p>
          <button type="button" class="map-compare-toggle" data-compare-zoo="${escapeHtml(r.zoo.id)}" data-compare-name="${escapeHtml(r.zoo.name)}">比較に追加</button>
        </li>`;
      }).join("\n")
    : "";

  const mapPaneHtml = `<div class="view-pane" id="view-map"${view === "map" ? "" : " hidden"}>
    <nav class="map-toolbar">
      <div class="map-toolbar-actions">
        <button type="button" class="location-btn" id="location-btn">${icon("my_location")}現在地から探す</button>
        <button type="button" class="share-btn" id="share-btn" aria-label="現在の地図状態のリンクをコピー">${icon("link")}リンクをコピー</button>
      </div>
    </nav>
    <div class="map-body">
      <div id="map"></div>
      <aside class="result-list-panel" aria-label="検索結果一覧">
        <button type="button" class="result-sheet-toggle" aria-expanded="true">${icon("expand_less", "rst-icon-expanded")}${icon("expand_more", "rst-icon-collapsed")}<span class="rst-label">検索結果を閉じる</span></button>
        <div class="result-list-scroll">
          <ul class="result-list">${resultListHtml}</ul>
        </div>
      </aside>
    </div>
    <div class="share-toast" id="share-toast" role="status" aria-live="polite"></div>
  </div>`;

  const listPaneHtml = `<div class="view-pane" id="view-list"${view === "map" ? " hidden" : ""}>
    ${zooListHtml}
  </div>`;

  const mapScript = `
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
    var kzZoos = ${mapData};
    var kzInitLat = ${initialLat !== null ? String(initialLat) : "null"};
    var kzInitLon = ${initialLon !== null ? String(initialLon) : "null"};
    var kzInitZoom = ${initialZoom !== null ? String(initialZoom) : "null"};
    var kzMap = null;
    var kzMapInitialized = false;

    function esc(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function initMapIfNeeded() {
      if (kzMapInitialized) return;
      kzMapInitialized = true;

      var map = (kzInitLat !== null && kzInitLon !== null && kzInitZoom !== null)
        ? L.map('map').setView([kzInitLat, kzInitLon], kzInitZoom)
        : L.map('map');
      kzMap = map;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      var markers = {};
      var resultItemsByZooId = {};
      var resultPanel = document.querySelector('.result-list-panel');
      var resultToggle = document.querySelector('.result-sheet-toggle');
      var mobileViewportQuery = window.matchMedia('(max-width: ${MAP_MOBILE_BREAKPOINT}px)');
      var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      var hasSearchResults = ${showPanel ? "true" : "false"};
      var isSheetOpen = !mobileViewportQuery.matches || hasSearchResults;
      var prevFocused = null;
      var prevMarker = null;
      var locationMarker = null;

      function shouldSmoothScroll() {
        return !reducedMotionQuery.matches;
      }

      function setSheetOpen(nextOpen) {
        isSheetOpen = nextOpen;
        if (!resultPanel || !resultToggle) return;
        resultPanel.classList.toggle('is-collapsed', !isSheetOpen);
        resultToggle.setAttribute('aria-expanded', isSheetOpen ? 'true' : 'false');
        var resultToggleLabel = resultToggle.querySelector('.rst-label');
        if (resultToggleLabel) resultToggleLabel.textContent = isSheetOpen ? '検索結果を閉じる' : '検索結果を開く';
      }

      if (resultToggle) {
        resultToggle.addEventListener('click', function() {
          setSheetOpen(!isSheetOpen);
        });
        setSheetOpen(isSheetOpen);
        var syncSheetToViewport = function(event) {
          setSheetOpen(!event.matches || hasSearchResults);
        };
        if (mobileViewportQuery.addEventListener) {
          mobileViewportQuery.addEventListener('change', syncSheetToViewport);
        } else if (mobileViewportQuery.addListener) {
          mobileViewportQuery.addListener(syncSheetToViewport);
        }
      }

      if (resultPanel) {
        // Prevent Leaflet from capturing scroll/wheel events within the bottom sheet panel,
        // which would otherwise zoom or pan the map while the user scrolls the result list.
        L.DomEvent.disableScrollPropagation(resultPanel);
      }

      if (window.visualViewport) {
        // On iOS Safari the visual viewport changes height when the address bar shows or
        // hides, but the layout viewport does not fire a regular resize event in time.
        // Calling invalidateSize() ensures Leaflet recalculates the map container size
        // after such changes so tiles and controls remain correctly positioned.
        window.visualViewport.addEventListener('resize', function() {
          map.invalidateSize();
        });
      }

      function activateResult(id, options) {
        options = options || {};
        if (options.openSheet || options.scroll) {
          setSheetOpen(true);
        }
        var item = resultItemsByZooId[id];
        if (item) {
          if (prevFocused) prevFocused.classList.remove('is-focused');
          item.classList.add('is-focused');
          prevFocused = item;
          if (options.scroll) item.scrollIntoView({ block: 'nearest', behavior: shouldSmoothScroll() ? 'smooth' : 'auto' });
        }
        if (prevMarker) {
          var prevEl = prevMarker.getElement();
          if (prevEl) prevEl.classList.remove('marker-active');
        }
        var marker = markers[id];
        if (marker) {
          var markerEl = marker.getElement();
          if (markerEl) markerEl.classList.add('marker-active');
          marker.openPopup();
          prevMarker = marker;
        }
      }

      function distanceInKm(lat1, lon1, lat2, lon2) {
        var radians = Math.PI / 180;
        var dLat = (lat2 - lat1) * radians;
        var dLon = (lon2 - lon1) * radians;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * radians) * Math.cos(lat2 * radians) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      function formatDistance(km) {
        return km < 1 ? Math.round(km * 1000) + 'm' : km.toFixed(km < 10 ? 1 : 0) + 'km';
      }

      function sortResultsByDistance(lat, lon) {
        var list = document.querySelector('.result-list');
        if (!list) return;
        var items = Object.keys(resultItemsByZooId).map(function(id) {
          var zoo = kzZoos.find(function(item) { return item.id === id; });
          var item = resultItemsByZooId[id];
          return { zoo: zoo, item: item, distance: zoo ? distanceInKm(lat, lon, zoo.lat, zoo.lon) : Infinity };
        }).filter(function(entry) { return entry.zoo && entry.item; });
        items.sort(function(a, b) { return a.distance - b.distance; });
        items.forEach(function(entry) {
          var name = entry.item.querySelector('.result-name');
          var distance = entry.item.querySelector('.result-distance');
          if (!distance) {
            distance = document.createElement('span');
            distance.className = 'result-distance';
            name.appendChild(distance);
          }
          distance.textContent = formatDistance(entry.distance);
          list.appendChild(entry.item);
        });
      }

      kzZoos.forEach(function(zoo) {
        var matchLine = ${animal ? "true" : "false"} ? '<br><span>検索ヒット: ' + zoo.matchCount + ' 件</span>' : '';
        var animalCountLine = '<br><span>動物種数: ' + (zoo.animalCount > 0 ? zoo.animalCount + ' 種' : '未取得') + '</span>';
        var mapAppUrl = 'https://www.google.com/maps/search/?api=1&query=' + zoo.lat + ',' + zoo.lon;
        var mapAppLine = '<br><a class="popup-map-app" href="' + mapAppUrl + '" target="_blank" rel="noopener noreferrer">地図アプリで見る</a>';
        var compareLine = '<br><button type="button" class="map-compare-toggle map-compare-toggle--popup" data-compare-zoo="' + esc(zoo.id) + '" data-compare-name="' + esc(zoo.name) + '">比較に追加</button>';
        var marker = L.marker([zoo.lat, zoo.lon])
          .bindPopup('<b><a href="/zoos/' + esc(zoo.id) + '${activePref ? `?pref=${activePref}` : ""}">' + esc(zoo.name) + '</a></b>' + matchLine + animalCountLine + mapAppLine + compareLine)
          .addTo(map);
        marker.on('click', function() {
          activateResult(zoo.id, { openSheet: true, scroll: true });
        });
        marker.on('popupopen', function() {
          if (window.KinkiZooCompare) window.KinkiZooCompare.sync();
        });
        markers[zoo.id] = marker;
      });
      if (kzInitLat === null || kzInitLon === null || kzInitZoom === null) {
        if (kzZoos.length > 0) {
          var bounds = L.latLngBounds(kzZoos.map(function(z) { return [z.lat, z.lon]; }));
          map.fitBounds(bounds, { padding: [40, 40] });
        } else {
          map.setView([34.7, 135.5], 8);
        }
      }

      function updateUrlFromMap() {
        var center = map.getCenter();
        var zoom = map.getZoom();
        var lat = Math.round(center.lat * 10000) / 10000;
        var lon = Math.round(center.lng * 10000) / 10000;
        var z = Math.round(zoom * 10) / 10;
        var url = new URL(window.location.href);
        url.searchParams.set('lat', String(lat));
        url.searchParams.set('lon', String(lon));
        url.searchParams.set('z', String(z));
        history.replaceState(null, '', url.toString());
      }
      map.on('moveend', updateUrlFromMap);
      map.on('zoomend', updateUrlFromMap);

      var shareBtn = document.getElementById('share-btn');
      var shareToast = document.getElementById('share-toast');
      var toastTimer = null;

      function showToast(msg, isError) {
        if (!shareToast) return;
        shareToast.textContent = msg;
        shareToast.className = 'share-toast ' + (isError ? 'share-toast--error' : 'share-toast--ok');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function() {
          shareToast.className = 'share-toast';
        }, 3000);
      }

      if (shareBtn) {
        shareBtn.addEventListener('click', function() {
          updateUrlFromMap();
          var shareUrl = window.location.href;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(function() {
              showToast('URLをコピーしました', false);
            }, function() {
              showToast('コピーに失敗しました', true);
            });
          } else {
            try {
              var ta = document.createElement('textarea');
              ta.value = shareUrl;
              ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
              ta.setAttribute('readonly', '');
              document.body.appendChild(ta);
              ta.setSelectionRange(0, ta.value.length);
              document.execCommand('copy');
              document.body.removeChild(ta);
              showToast('URLをコピーしました', false);
            } catch (e) {
              showToast('コピーに失敗しました', true);
            }
          }
        });
      }

      var locationBtn = document.getElementById('location-btn');
      if (locationBtn) {
        locationBtn.addEventListener('click', function() {
          if (!navigator.geolocation) {
            showToast('このブラウザでは現在地を取得できません', true);
            return;
          }
          locationBtn.disabled = true;
          locationBtn.textContent = '現在地を取得中…';
          navigator.geolocation.getCurrentPosition(function(position) {
            var lat = position.coords.latitude;
            var lon = position.coords.longitude;
            if (locationMarker) map.removeLayer(locationMarker);
            locationMarker = L.circleMarker([lat, lon], {
              radius: 9, color: '#155eef', weight: 3, fillColor: '#fff', fillOpacity: 1
            }).addTo(map).bindPopup('現在地').openPopup();
            map.setView([lat, lon], Math.max(map.getZoom(), 11));
            sortResultsByDistance(lat, lon);
            locationBtn.disabled = false;
            locationBtn.textContent = '現在地から探す';
            showToast('近い順に並べ替えました', false);
          }, function(error) {
            locationBtn.disabled = false;
            locationBtn.textContent = '現在地から探す';
            showToast(error.code === 1 ? '現在地の利用が許可されませんでした' : '現在地を取得できませんでした', true);
          }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
        });
      }

      document.querySelectorAll('.result-item').forEach(function(item) {
        var id = item.dataset.zooId;
        if (id) resultItemsByZooId[id] = item;
        function activate() {
          if (id) activateResult(id);
        }
        item.addEventListener('mouseenter', activate);
        item.addEventListener('focusin', activate);
        item.addEventListener('click', function() {
          if (id) activateResult(id, { openSheet: true });
        });
      });

      requestAnimationFrame(function() { map.invalidateSize(); });
    }

    var kzCurrentView = ${JSON.stringify(view)};

    function kzSetView(next) {
      kzCurrentView = next;
      var listPane = document.getElementById('view-list');
      var mapPane = document.getElementById('view-map');
      if (listPane) listPane.hidden = next !== 'list';
      if (mapPane) mapPane.hidden = next !== 'map';
      document.querySelectorAll('[data-view-btn]').forEach(function(btn) {
        var active = btn.dataset.viewBtn === next;
        btn.classList.toggle('view-toggle-btn--active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      var url = new URL(window.location.href);
      url.searchParams.set('view', next);
      history.replaceState(null, '', url.toString());
      var viewInput = document.getElementById('search-form-view');
      if (viewInput) viewInput.value = next;
      if (next === 'map') {
        initMapIfNeeded();
        if (kzMap) requestAnimationFrame(function() { kzMap.invalidateSize(); });
      }
    }

    document.querySelectorAll('[data-view-btn]').forEach(function(btn) {
      btn.addEventListener('click', function() { kzSetView(btn.dataset.viewBtn); });
    });

    kzSetView(kzCurrentView);
  </script>`;

  return renderZoosShell({
    activePref,
    animal,
    escapedAnimal,
    taxClass,
    view,
    classChips,
    bodyHtml: `<p class="summary">${summary}</p>
  ${renderZooViewTabs(activePref, view, animal, taxClass)}
  ${listPaneHtml}
  ${mapPaneHtml}`,
    showResultPanel: showPanel,
    mapScript,
  });
}

function renderZoosShell(opts: {
  activePref: PrefectureCode | null;
  animal: string | null;
  escapedAnimal: string;
  taxClass: string | null;
  view: Exclude<ZooView, "taxonomy">;
  classChips: string;
  bodyHtml: string;
  showResultPanel?: boolean;
  mapScript?: string;
}): string {
  const { activePref, animal, escapedAnimal, taxClass, view, classChips, bodyHtml, mapScript } = opts;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>動物園一覧 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    .zoo-page-title { padding: 1rem 1.5rem 0; font-size: 1.15rem; }
    .search-form { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; }
    .search-form input { flex: 1 1 220px; max-width: 320px; padding: 0.55rem 0.75rem; border: 1px solid #bbb; font-size: 0.95rem; }
    .search-form button, .search-form a { font-size: 0.875rem; padding: 0.5rem 0.9rem; }
    .cls-filter { display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0.6rem 1.5rem; border-bottom: 1px solid #ddd; }
    .cls-chip { font-size: 0.78rem; padding: 0.25rem 0.65rem; border: 1px solid #bbb; color: #555; text-decoration: none; background: #fff; white-space: nowrap; }
    .cls-chip:hover { border-color: #1f5b45; color: #1f5b45; }
    .cls-chip--active { background: #1f5b45; color: #fff; border-color: #1f5b45; }
    .summary { padding: 0.75rem 1.5rem 0; font-size: 0.9rem; color: #666; }
    .view-toggle { display: inline-flex; gap: 0.3rem; margin: 0.75rem 1.5rem; border: 1px solid #d3e0d8; background: #f3f7f4; padding: 0.25rem; border-radius: 6px; width: fit-content; }
    .view-toggle-btn { display: inline-flex; align-items: center; gap: 0.35rem; border: 0; background: transparent; color: #4c5d53; padding: 0.4rem 0.9rem; font-size: 0.85rem; font-weight: bold; cursor: pointer; border-radius: 4px; text-decoration: none; }
    .view-toggle-btn--active { background: #1f5b45; color: #fff; }
    .view-pane[hidden] { display: none; }
    .zoo-list { padding: 0 1.5rem 1.5rem; overflow-x: auto; }
    .zoo-table { width: 100%; border-collapse: collapse; min-width: 480px; border: 1px solid #ddd; }
    .zoo-table th, .zoo-table td { border: 1px solid #ddd; padding: 0.65rem; vertical-align: top; font-size: 0.86rem; text-align: left; }
    .zoo-table thead th { background: #f7f7f7; color: #555; }
    .zoo-name a { color: #2d6a4f; text-decoration: none; font-size: 1rem; }
    .zoo-name a:hover { text-decoration: underline; }
    .kana { font-size: 0.8rem; color: #888; margin-top: 0.25rem; }
    .zoo-compare-option { display: inline-flex; align-items: center; gap: 0.35rem; margin-top: 0.45rem; color: #4f6257; font-size: 0.75rem; font-weight: normal; cursor: pointer; }
    .zoo-compare-option input { width: 1rem; height: 1rem; accent-color: #1f5b45; }
    .zoo-table tr.is-compare-selected { background: #f0fbf4; }
    .match-box { padding: 0.55rem; border: 1px solid #d7eadc; border-radius: 6px; background: #f3fbf5; display: grid; gap: 0.45rem; }
    .match-row { display: grid; gap: 0.35rem; }
    .match-label { color: #456052; font-size: 0.75rem; font-weight: bold; }
    .match-values { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .match-chip { border-color: #b7dcc3; background: #fff; color: #1b5e3b; padding: 0.18rem 0.55rem; font-size: 0.75rem; font-weight: bold; }
    .match-more { color: #5d7166; font-size: 0.75rem; align-self: center; }
    .match-note { color: #6d756f; font-size: 0.75rem; line-height: 1.5; }
    .empty { padding: 2rem 1.5rem; color: #888; }
    .map-toolbar { display: flex; justify-content: flex-end; align-items: center; padding: 0.6rem 1.5rem 0; gap: 0.5rem; }
    .map-toolbar-actions { display: flex; align-items: center; gap: 0.45rem; }
    .share-btn, .location-btn { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.82rem; padding: 0.35rem 0.75rem; border: 1px solid #1f5b45; background: #fff; color: #1f5b45; cursor: pointer; line-height: 1; white-space: nowrap; }
    .share-btn:hover, .location-btn:hover { background: #f1f8f3; }
    .share-btn:focus-visible, .location-btn:focus-visible { outline: 2px solid #1f5b45; outline-offset: 2px; }
    .location-btn:disabled { opacity: 0.65; cursor: wait; }
    .result-distance { margin-left: auto; font-size: 0.7rem; font-weight: normal; color: #66756b; white-space: nowrap; }
    .share-toast { position: fixed; bottom: 1.25rem; left: 50%; transform: translateX(-50%); padding: 0.5rem 1.1rem; border-radius: 4px; font-size: 0.85rem; z-index: 2000; opacity: 0; visibility: hidden; transition: opacity 0.25s, visibility 0.25s; pointer-events: none; white-space: nowrap; }
    .share-toast--ok { background: #1f5b45; color: #fff; opacity: 1; visibility: visible; }
    .share-toast--error { background: #b91c1c; color: #fff; opacity: 1; visibility: visible; }
    .map-body { position: relative; height: min(70vh, 640px); min-height: 420px; display: flex; margin: 0.75rem 1.5rem 1.5rem; border: 1px solid #ddd; }
    #map { flex: 1; min-height: 0; min-width: 0; }
    .result-list-panel { width: 300px; flex-shrink: 0; border-left: 1px solid #ddd; display: ${opts.showResultPanel ? "flex" : "none"}; flex-direction: column; min-height: 0; }
    .result-sheet-toggle { display: none; }
    .result-list-scroll { flex: 1; min-height: 0; overflow-y: auto; }
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
    .map-compare-toggle { margin: 0 0.85rem 0.55rem; border: 1px solid #87ad99; background: #fff; color: #1f5b45; padding: 0.25rem 0.6rem; font-size: 0.72rem; font-weight: bold; cursor: pointer; }
    .map-compare-toggle[aria-pressed="true"] { background: #1f5b45; color: #fff; }
    .map-compare-toggle:disabled { opacity: 0.5; cursor: default; }
    .map-compare-toggle--popup { margin: 0.45rem 0 0; }
    .marker-active { filter: hue-rotate(160deg) saturate(2) brightness(1.1); }
    .popup-map-app { display: none; }
    .compare-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1f5b45; color: #fff; padding: 0.75rem 1.5rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; z-index: 2000; box-shadow: 0 -2px 8px rgba(0,0,0,0.15); }
    .compare-bar[hidden] { display: none; }
    .compare-bar-text { flex: 1; min-width: 12rem; font-size: 0.82rem; line-height: 1.4; }
    .compare-go { display: inline-flex; align-items: center; gap: 0.3rem; border: 2px solid #fff; background: #fff; color: #1f5b45; padding: 0.4rem 1rem; cursor: pointer; font-size: 0.88rem; font-weight: bold; }
    .compare-go:disabled { opacity: 0.5; cursor: default; }
    .compare-clear { display: inline-flex; align-items: center; gap: 0.3rem; border: 1px solid rgba(255,255,255,0.5); background: transparent; color: #fff; padding: 0.4rem 0.75rem; cursor: pointer; font-size: 0.82rem; }
    html.has-compare-selection body { padding-bottom: 4.5rem; }
    @media (max-width: 700px) {
      .popup-map-app { display: inline-block; margin-top: 0.3rem; font-size: 0.78rem; color: #1f5b45; text-decoration: none; }
      .popup-map-app:hover { text-decoration: underline; }
      .search-form { display: grid; grid-template-columns: 1fr auto; padding: 0.75rem; }
      .zoo-page-title { padding: 0.85rem 0.75rem 0; }
      .search-form input { width: 100%; max-width: none; min-width: 0; min-height: 44px; grid-column: 1 / -1; }
      .search-form button, .search-form a { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; }
      .summary { padding: 0.7rem 0.75rem 0; line-height: 1.5; }
      .view-toggle { margin: 0.65rem 0.75rem; }
      .zoo-list { padding: 0 0.75rem 0.75rem; overflow: visible; }
      .zoo-table { min-width: 0; border: 0; }
      .zoo-table thead { display: none; }
      .zoo-table tbody, .zoo-table tr, .zoo-table th, .zoo-table td { display: block; width: 100%; }
      .zoo-table tr { margin-bottom: 0.5rem; border: 1px solid #d8ddd9; }
      .zoo-table th, .zoo-table td { border: 0; border-bottom: 1px solid #e5e8e6; padding: 0.45rem 0.75rem; }
      .zoo-table td:empty { display: none; }
      .zoo-table tr > :last-child { border-bottom: 0; }
      .zoo-table td::before { content: attr(data-label); display: block; margin-bottom: 0.25rem; color: #6a746d; font-size: 0.7rem; font-weight: bold; }
      .zoo-table td[data-label="都道府県"],
      .zoo-table td[data-label="動物種数"] { display: flex; align-items: baseline; gap: 0.5rem; }
      .zoo-table td[data-label="都道府県"]::before,
      .zoo-table td[data-label="動物種数"]::before { display: inline; margin-bottom: 0; flex: 0 0 auto; }
      .zoo-name { background: #f7faf8; padding: 0.6rem 0.75rem; }
      .zoo-table tr.is-compare-selected .zoo-name { background: #e7f5ec; }
      .empty { padding: 1.5rem 0.75rem; }
      .map-toolbar { padding: 0.5rem 0.75rem 0; }
      .share-btn, .location-btn { min-height: 44px; }
      .map-body { position: relative; margin: 0.5rem 0.75rem 0.75rem; height: 60vh; min-height: 320px; }
      .result-list-panel { position: absolute; left: 0; right: 0; bottom: 0; z-index: 1000; width: auto; border-left: none; border-top: 1px solid #ddd; border-radius: 14px 14px 0 0; box-shadow: 0 -4px 18px rgba(0,0,0,0.18); max-height: min(68%, 420px); background: #fff; transform: translateY(0); transition: transform 0.2s ease-in-out; padding-bottom: env(safe-area-inset-bottom); }
      .result-list-panel.is-collapsed { transform: translateY(calc(100% - 44px - env(safe-area-inset-bottom))); }
      .result-list-scroll { overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; }
      .result-sheet-toggle { display: flex; min-height: 44px; align-items: center; justify-content: center; gap: 0.3rem; border: 0; border-bottom: 1px solid #e8ece9; background: #fff; color: #1f5b45; font-size: 0.82rem; font-weight: bold; cursor: pointer; flex-shrink: 0; }
      .result-sheet-toggle .rst-icon-collapsed { display: none; }
      .result-sheet-toggle[aria-expanded="false"] .rst-icon-expanded { display: none; }
      .result-sheet-toggle[aria-expanded="false"] .rst-icon-collapsed { display: inline-flex; }
      footer { padding: 1rem 0.75rem; line-height: 1.5; }
      .compare-bar { gap: 0.55rem; padding: 0.6rem 0.75rem calc(0.6rem + env(safe-area-inset-bottom)); }
      .compare-bar-text { flex: 1 1 100%; min-width: 0; }
      html.has-compare-selection body { padding-bottom: 7.5rem; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/zoos")}
  <h1 class="zoo-page-title">動物園</h1>
  <form class="search-form" action="/zoos" method="get">
    <input type="search" name="animal" value="${escapedAnimal}" placeholder="動物名で検索（例: パンダ）" aria-label="動物名で検索">
    ${taxClass ? `<input type="hidden" name="cls" value="${escapeHtml(taxClass)}">` : ""}
    <input type="hidden" name="view" id="search-form-view" value="${view}">
    <button type="submit" class="ui-btn ui-btn--primary ui-touch-target">${icon("search")}検索</button>
    ${animal ? `<a href="${escapeHtml(buildZoosUrl(activePref, null, { cls: taxClass, view }))}" class="ui-btn ui-btn--secondary ui-touch-target">${icon("close")}クリア</a>` : ""}
  </form>
  <div class="cls-filter">${classChips}</div>
  ${bodyHtml}
  ${renderZooCompareBar()}
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
  <script src="/favorites.js?v=5" defer></script>${mapScript ?? ""}
  ${renderZooCompareScript(activePref)}
</body>
</html>`;
}

const FAVORITES_JS = `(function () {
  var STORAGE_KEY = "kinkizoo:favorites:v1";
  var hasStorage = (function () {
    try {
      var testKey = "__kinkizoo_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  })();

  function loadFavorites() {
    if (!hasStorage) return { zoos: {}, animals: {}, taxonomies: {} };
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { zoos: {}, animals: {}, taxonomies: {} };
      var parsed = JSON.parse(raw);
      return {
        zoos: parsed && typeof parsed.zoos === "object" && parsed.zoos ? parsed.zoos : {},
        animals: parsed && typeof parsed.animals === "object" && parsed.animals ? parsed.animals : {},
        taxonomies: parsed && typeof parsed.taxonomies === "object" && parsed.taxonomies ? parsed.taxonomies : {}
      };
    } catch (e) {
      return { zoos: {}, animals: {}, taxonomies: {} };
    }
  }

  function saveFavorites(data) {
    if (!hasStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // ignore write failures (private mode, quota)
    }
  }

  function bucketFor(data, type) {
    if (type === "zoo") return data.zoos;
    if (type === "taxonomy") return data.taxonomies;
    return data.animals;
  }

  function isFavorite(data, type, id) {
    return Object.prototype.hasOwnProperty.call(bucketFor(data, type), id);
  }

  function toggleFavorite(type, id, label, href) {
    var data = loadFavorites();
    var bucket = bucketFor(data, type);
    if (Object.prototype.hasOwnProperty.call(bucket, id)) {
      delete bucket[id];
    } else {
      bucket[id] = { label: label, href: href };
    }
    saveFavorites(data);
    return isFavorite(data, type, id);
  }

  function syncButton(button) {
    var type = button.getAttribute("data-fav-type");
    var id = button.getAttribute("data-fav-id");
    if (!type || !id) return;
    var active = isFavorite(loadFavorites(), type, id);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    var text = button.querySelector(".fav-toggle-text");
    if (text) text.textContent = active ? "お気に入り済み" : "お気に入りに追加";
    if (!text) {
      button.setAttribute("aria-label", active ? "お気に入り解除" : "お気に入りに追加");
    }
  }

  function initButtons(root) {
    var buttons = (root || document).querySelectorAll("[data-fav-type][data-fav-id]");
    buttons.forEach(function (button) {
      if (button.dataset.favBound === "1") return;
      button.dataset.favBound = "1";
      if (!hasStorage) {
        button.disabled = true;
        button.title = "このブラウザではお気に入りを保存できません";
        return;
      }
      syncButton(button);
      button.addEventListener("click", function (event) {
        event.preventDefault();
        var type = button.getAttribute("data-fav-type");
        var id = button.getAttribute("data-fav-id");
        var label = button.getAttribute("data-fav-name") || id;
        var href = button.getAttribute("data-fav-href") || "";
        toggleFavorite(type, id, label, href);
        document.querySelectorAll('[data-fav-type="' + type + '"][data-fav-id="' + CSS.escape(id) + '"]').forEach(syncButton);
        renderFavoritesPage();
        syncFavoritesNews();
      });
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function favoriteAnimalThumb(label) {
    var imageUrls = window.KinkiZooAnimalImageUrls || {};
    var imageKey = String(formatFavoriteAnimalLabel(label)).toLocaleLowerCase("ja-JP").replace(/[\\s　]+/g, "");
    var imageUrl = imageUrls[imageKey];
    return imageUrl
      ? '<img src="' + escapeHtml(imageUrl) + '" alt="" class="favorites-animal-thumb" loading="lazy" width="32" height="32">'
      : "";
  }

  function favoriteTaxonomyThumb(id) {
    var rankingData = window.KinkiZooFavoriteRankingData || { animals: [] };
    var animal = (rankingData.animals || []).find(function (item) {
      return item.taxonomyIds.indexOf(id) >= 0 && item.imageUrl;
    });
    return animal && animal.imageUrl
      ? '<img src="' + escapeHtml(animal.imageUrl) + '" alt="" class="favorites-animal-thumb" loading="lazy" width="32" height="32">'
      : "";
  }

  function taxonomyRankLabel(id) {
    var rank = String(id).split(":", 1)[0];
    return { "class": "類", "order": "目", "family": "科", "genus": "属" }[rank] || "分類";
  }

  function normalizeFavoriteAnimalKey(value) {
    return String(value).toLocaleLowerCase("ja-JP").replace(/[\\s　]+/g, "");
  }

  function formatFavoriteAnimalLabel(value) {
    var normalized = String(value).normalize("NFKC").trim();
    var overrides = {
      "カイウサギ(家畜)": "カイウサギ",
      "カイウサギ(家畜": "カイウサギ",
      "テンジクネズミ(家畜)": "テンジクネズミ",
      "テンジクネズミ(家畜": "テンジクネズミ",
      "ノマウマ(野間馬)": "ノマウマ",
      "ノマウマ(野間馬": "ノマウマ",
      "ノマ": "ノマウマ",
      "ヒツジ(家畜)": "ヒツジ",
      "ヒツジ(家畜": "ヒツジ",
      "ブラックバック(メス)": "ブラックバック",
      "ブラックバック(メス": "ブラックバック",
      "アジアの森サソリ": "アジアンフォレストスコーピオン"
    };
    return overrides[normalized] || value;
  }

  function renderFavoriteZooRanking(data) {
    var rankingData = window.KinkiZooFavoriteRankingData || { animals: [], zoos: [] };
    var favoriteAnimalKeys = new Set();
    Object.keys(data.animals).forEach(function (id) {
      favoriteAnimalKeys.add(normalizeFavoriteAnimalKey(id));
      favoriteAnimalKeys.add(normalizeFavoriteAnimalKey(data.animals[id].label || id));
    });
    var favoriteTaxonomyIds = new Set(Object.keys(data.taxonomies));
    var zooById = {};
    (rankingData.zoos || []).forEach(function (zoo) { zooById[zoo.id] = zoo; });
    var matchesByZoo = {};

    (rankingData.animals || []).forEach(function (animal) {
      var directMatch = animal.aliases.some(function (alias) { return favoriteAnimalKeys.has(alias); });
      var taxonomyMatches = animal.taxonomyIds.filter(function (id) { return favoriteTaxonomyIds.has(id); });
      if (!directMatch && taxonomyMatches.length === 0) return;
      animal.zooIds.forEach(function (zooId) {
        if (!zooById[zooId]) return;
        var match = matchesByZoo[zooId] || { zoo: zooById[zooId], animals: {} };
        var existing = match.animals[animal.key];
        match.animals[animal.key] = existing || {
          key: animal.key,
          label: animal.label,
          href: animal.href,
          imageUrl: animal.imageUrl,
          direct: false,
          taxonomyIds: []
        };
        match.animals[animal.key].direct = match.animals[animal.key].direct || directMatch;
        taxonomyMatches.forEach(function (id) {
          if (match.animals[animal.key].taxonomyIds.indexOf(id) < 0) match.animals[animal.key].taxonomyIds.push(id);
        });
        matchesByZoo[zooId] = match;
      });
    });

    var ranked = Object.keys(matchesByZoo).map(function (zooId) {
      var match = matchesByZoo[zooId];
      match.animalList = Object.keys(match.animals).map(function (key) { return match.animals[key]; });
      return match;
    }).sort(function (a, b) {
      return b.animalList.length - a.animalList.length || a.zoo.name.localeCompare(b.zoo.name, "ja-JP");
    });

    var hasFavoriteTargets = favoriteAnimalKeys.size > 0 || favoriteTaxonomyIds.size > 0;
    if (ranked.length === 0) {
      var message = hasFavoriteTargets
        ? "お気に入りに一致する動物園が見つかりませんでした。"
        : "動物または分類をお気に入りに追加すると、たくさん会える動物園を表示します。";
      return '<section class="favorites-section favorites-ranking"><h2>お気に入りに会える動物園</h2><p class="favorites-empty">' + message + "</p></section>";
    }

    var items = ranked.slice(0, 10).map(function (match, index) {
      var directCount = match.animalList.filter(function (animal) { return animal.direct; }).length;
      var taxonomyIds = [];
      match.animalList.forEach(function (animal) {
        animal.taxonomyIds.forEach(function (id) {
          if (taxonomyIds.indexOf(id) < 0) taxonomyIds.push(id);
        });
      });
      var taxonomyLabels = taxonomyIds.map(function (id) {
        var entry = data.taxonomies[id];
        return entry ? entry.label : id.split(":").slice(1).join(":");
      });
      var meta = [];
      if (directCount > 0) meta.push("直接お気に入り " + directCount + "種");
      if (taxonomyLabels.length > 0) meta.push(taxonomyLabels.join("・"));
      var images = match.animalList.filter(function (animal) { return animal.imageUrl; }).slice(0, 6).map(function (animal) {
        return '<img src="' + escapeHtml(animal.imageUrl) + '" alt="" loading="lazy" width="32" height="32">';
      }).join("");
      var labels = match.animalList.slice(0, 5).map(function (animal) { return animal.label; });
      var more = match.animalList.length > labels.length ? "、ほか" + (match.animalList.length - labels.length) + "種" : "";
      return '<li><a href="' + escapeHtml(match.zoo.href) + '"><span class="ranking-position">' + (index + 1) + '</span><span class="ranking-main"><span class="ranking-title">' + escapeHtml(match.zoo.name) + '</span><strong>' + match.animalList.length + '種に会えます</strong><small>' + escapeHtml(meta.join(" / ")) + '</small><span class="ranking-animals">' + images + '<span>' + escapeHtml(labels.join("、") + more) + '</span></span></span></a></li>';
    }).join("");
    return '<section class="favorites-section favorites-ranking"><div class="favorites-ranking-heading"><h2>お気に入りに会える動物園</h2><small>掲載中の動物を重複せず集計</small></div><ol class="favorites-ranking-list">' + items + "</ol></section>";
  }

  function renderFavoritesPage() {
    var root = document.getElementById("favorites-root");
    if (!root) return;
    if (!hasStorage) {
      root.innerHTML = '<p class="favorites-empty">このブラウザではお気に入りを利用できません（プライベートブラウズなど localStorage が無効な環境です）。</p>';
      return;
    }
    var data = loadFavorites();
    var zooEntries = Object.keys(data.zoos).map(function (id) {
      var entry = data.zoos[id];
      return { id: id, label: entry.label || id, href: entry.href || "#" };
    });
    var animalEntries = Object.keys(data.animals).map(function (id) {
      var entry = data.animals[id];
      return { id: id, label: entry.label || id, href: entry.href || "#" };
    });
    var taxonomyEntries = Object.keys(data.taxonomies).map(function (id) {
      var entry = data.taxonomies[id];
      return { id: id, label: entry.label || id, href: entry.href || "#" };
    });

    function renderSection(type, title, entries, emptyMessage) {
      if (entries.length === 0) {
        return '<section class="favorites-section"><h2>' + title + '</h2><p class="favorites-empty">' + emptyMessage + '</p></section>';
      }
      var items = entries
        .map(function (entry) {
          var displayLabel = type === "animal" ? formatFavoriteAnimalLabel(entry.label) : entry.label;
          var thumb = type === "animal"
            ? favoriteAnimalThumb(entry.label)
            : type === "taxonomy"
            ? favoriteTaxonomyThumb(entry.id)
            : "";
          var rank = type === "taxonomy" ? '<small>' + taxonomyRankLabel(entry.id) + "</small>" : "";
          return (
            '<li><a href="' + escapeHtml(entry.href) + '">' + thumb + '<span>' + escapeHtml(displayLabel) + rank + "</span></a>" +
            '<button type="button" class="ui-btn ui-btn--secondary favorites-remove" data-fav-remove aria-label="' +
            escapeHtml(displayLabel) + 'をお気に入りから削除" data-fav-type="' +
            type + '" data-fav-id="' + escapeHtml(entry.id) + '">' +
            '<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M16 9v10H8V9h8m-1.5-6h-5l-1 1H5v2h14V4h-3.5l-1-1zM18 7H6v12c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7z"/></svg></button></li>'
          );
        })
        .join("");
      return '<section class="favorites-section"><h2>' + title + "（" + entries.length + "）</h2><ul class=\\"favorites-list\\">" + items + "</ul></section>";
    }

    root.innerHTML =
      renderSection("taxonomy", "分類", taxonomyEntries, "お気に入りの分類はまだありません。") +
      renderSection("animal", "動物", animalEntries, "お気に入りの動物はまだありません。") +
      renderSection("zoo", "動物園", zooEntries, "お気に入りの動物園はまだありません。") +
      renderFavoriteZooRanking(data);

    root.querySelectorAll("[data-fav-remove]").forEach(function (button) {
      button.addEventListener("click", function () {
        var type = button.getAttribute("data-fav-type");
        var id = button.getAttribute("data-fav-id");
        toggleFavorite(type, id, "", "");
        document.querySelectorAll('[data-fav-type="' + type + '"][data-fav-id="' + CSS.escape(id) + '"]').forEach(syncButton);
        renderFavoritesPage();
        syncFavoritesNews();
      });
    });
  }

  function syncFavoritesNews() {
    var section = document.getElementById("favorites-news-section");
    var list = document.getElementById("favorites-news-list");
    var emptyMsg = document.getElementById("favorites-news-empty");
    if (!section || !list) return;
    var data = loadFavorites();
    var hasAnyFavorite = Object.keys(data.zoos).length > 0 || Object.keys(data.animals).length > 0 || Object.keys(data.taxonomies).length > 0;
    if (!hasStorage || !hasAnyFavorite) {
      section.hidden = true;
      return;
    }
    var favoriteTaxonomyIds = new Set(Object.keys(data.taxonomies));
    var taxonomyFavoriteAnimalKeys = new Set();
    if (favoriteTaxonomyIds.size > 0) {
      var rankingData = window.KinkiZooFavoriteRankingData || { animals: [] };
      (rankingData.animals || []).forEach(function (animal) {
        var taxonomyMatch = animal.taxonomyIds.some(function (id) { return favoriteTaxonomyIds.has(id); });
        if (!taxonomyMatch) return;
        animal.aliases.forEach(function (alias) { taxonomyFavoriteAnimalKeys.add(alias); });
      });
    }
    var visibleCount = 0;
    list.querySelectorAll("li[data-zoo]").forEach(function (item) {
      var zooId = item.getAttribute("data-zoo");
      var animalNames = (item.getAttribute("data-animals") || "").split(",").filter(Boolean);
      var match = isFavorite(data, "zoo", zooId) || animalNames.some(function (name) {
        return isFavorite(data, "animal", name) || taxonomyFavoriteAnimalKeys.has(normalizeFavoriteAnimalKey(name));
      });
      item.classList.toggle("is-hidden", !match);
      if (match) visibleCount++;
    });
    section.hidden = false;
    list.hidden = visibleCount === 0;
    if (emptyMsg) {
      emptyMsg.hidden = visibleCount > 0;
      emptyMsg.textContent = "お気に入りに関連するお知らせはまだありません。";
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    initButtons();
    renderFavoritesPage();
    syncFavoritesNews();
  });

  window.KinkiZooFavorites = {
    hasStorage: function () { return hasStorage; },
    isFavoriteAnimal: function (name) {
      return isFavorite(loadFavorites(), "animal", name);
    },
    hasAnyFavoriteAnimal: function (names) {
      var data = loadFavorites();
      return (names || []).some(function (name) {
        return isFavorite(data, "animal", name);
      });
    }
  };
})();
`;

function renderFavoritesHtml(
  news: ZooNewsRow[],
  imageKeys: AnimalImageVersionIndex = new Map(),
  animals: AnimalListItem[] = [],
  activePref: PrefectureCode | null = null
): string {
  const newsItemsHtml = news.length > 0 ? renderNewsItems(news, imageKeys) : "";
  const animalImageUrlsJson = JSON.stringify(
    Object.fromEntries(
      [...imageKeys].map(([animalKey, version]) => [
        animalKey,
        withBase(buildAnimalImageUrl(animalKey, version)),
      ])
    )
  ).replace(/</g, "\\u003c");
  const rankingAnimals = animals.map((animal) => {
    const primaryDisplayName = animal.displayNames[0] ?? animal.canonicalName ?? "";
    const rawLabel = animal.canonicalName ?? primaryDisplayName;
    const label = formatAnimalDisplayName(rawLabel);
    const key = normalizeAnimalImageKey(rawLabel);
    const aliases = uniqueDisplayNames(
      [animal.canonicalName, ...animal.displayNames]
        .filter((name): name is string => Boolean(name))
        .map(normalizeAnimalImageKey)
    );
    const taxonomyIds = [
      animal.className ? `class:${animal.className}` : null,
      animal.orderName ? `order:${animal.orderName}` : null,
      animal.familyName ? `family:${animal.familyName}` : null,
      animal.genusName ? `genus:${animal.genusName}` : null,
    ].filter((id): id is string => Boolean(id));
    const imageDisplayName = [animal.canonicalName, ...animal.displayNames]
      .filter((name): name is string => Boolean(name))
      .find((name) => imageKeys.has(normalizeAnimalImageKey(name)));
    const imageUrl = imageDisplayName
      ? withBase(buildAnimalImageUrl(imageDisplayName, imageKeys.get(normalizeAnimalImageKey(imageDisplayName))))
      : null;
    return {
      key,
      label,
      href: withBase(addPrefectureToInternalUrl(buildZooAnimalUrl(primaryDisplayName), activePref)),
      aliases,
      taxonomyIds,
      zooIds: animal.zoos.map((zoo) => zoo.id),
      imageUrl,
    };
  });
  const rankingZooIds = new Set(rankingAnimals.flatMap((animal) => animal.zooIds));
  const favoriteRankingDataJson = JSON.stringify({
    animals: rankingAnimals,
    zoos: zoos
      .filter((zoo) => rankingZooIds.has(zoo.id))
      .map((zoo) => ({
        id: zoo.id,
        name: zoo.name,
        href: withBase(addPrefectureToInternalUrl(`/zoos/${encodeURIComponent(zoo.id)}`, activePref)),
      })),
  }).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>お気に入り | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 800px; margin: 0 auto; padding: 1.5rem; display: grid; gap: 1.25rem; }
    main > p.lead { color: #666; font-size: 0.9rem; line-height: 1.6; }
    #favorites-root { display: grid; gap: 1.25rem; }
    .favorites-section { display: grid; gap: 0.6rem; }
    .favorites-section[hidden] { display: none; }
    .favorites-section h2 { font-size: 1.05rem; }
    .favorites-empty { color: #777; font-size: 0.88rem; border: 1px solid #e1e1e1; background: #f7f7f7; padding: 0.75rem; }
    .favorites-list { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.4rem; }
    .favorites-list li { min-width: 0; display: flex; align-items: center; gap: 0.35rem; border: 1px solid #dce7df; padding: 0.35rem 0.4rem 0.35rem 0.65rem; }
    .favorites-list a { display: flex; flex: 1 1 auto; min-width: 0; align-items: center; gap: 0.4rem; color: #1f5b45; font-size: 0.88rem; font-weight: bold; line-height: 1.35; text-decoration: none; overflow-wrap: anywhere; }
    .favorites-list a span { min-width: 0; }
    .favorites-list a small { display: block; margin-top: 0.1rem; color: #718078; font-size: 0.68rem; font-weight: normal; }
    .favorites-list a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .favorites-animal-thumb { display: block; width: 32px; height: 32px; flex: 0 0 32px; border-radius: 50%; object-fit: cover; background: #e7eee9; }
    .favorites-remove { flex: 0 0 2.25rem; width: 2.25rem; min-height: 2.25rem; padding: 0; border-color: transparent; }
    .favorites-remove .ui-icon { width: 1rem; height: 1rem; }
    .favorites-ranking { border-top: 1px solid #e5e9e6; padding-top: 1rem; }
    .favorites-ranking-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.25rem 0.75rem; color: #4f5d55; }
    .favorites-ranking-heading small { color: #718078; font-size: 0.72rem; }
    .favorites-ranking-list { list-style: none; display: grid; gap: 0; }
    .favorites-ranking-list li { min-width: 0; border-bottom: 1px solid #e5e9e6; }
    .favorites-ranking-list a { display: flex; min-width: 0; gap: 0.6rem; align-items: flex-start; padding: 0.6rem 0.35rem; color: inherit; text-decoration: none; }
    .favorites-ranking-list a:hover { background: #f7faf8; }
    .ranking-position { display: inline-flex; width: 1.5rem; height: 1.5rem; flex: 0 0 1.5rem; align-items: center; justify-content: center; border-radius: 50%; background: #edf2ef; color: #5b6a61; font-size: 0.72rem; font-weight: bold; }
    .ranking-main { display: grid; min-width: 0; flex: 1 1 auto; gap: 0.18rem; }
    .ranking-title { color: #315f4c; font-size: 0.88rem; font-weight: bold; }
    .ranking-main > strong { color: #45534b; font-size: 0.78rem; }
    .ranking-main > small { color: #66736c; font-size: 0.72rem; }
    .ranking-animals { display: flex; min-width: 0; flex-wrap: wrap; gap: 0.3rem; align-items: center; margin-top: 0.25rem; color: #536159; font-size: 0.72rem; line-height: 1.4; }
    .ranking-animals img { width: 28px; height: 28px; flex: 0 0 28px; border-radius: 50%; object-fit: cover; background: #e7eee9; }
    .news-list { list-style: none; display: grid; gap: 0; }
    .news-list[hidden] { display: none; }
    .news-list li { display: grid; gap: 0.3rem; border-bottom: 1px solid #eee; padding: 0.85rem 0.65rem; }
    .news-list li:first-child { border-top: 1px solid #eee; }
    .news-list li:hover { background: #fafcfb; }
    .news-list li.is-hidden { display: none; }
    .news-meta { display: flex; flex-wrap: wrap; gap: 0.35rem 0.55rem; align-items: center; }
    .news-date { flex: 0 0 auto; color: #888; font-size: 0.76rem; font-variant-numeric: tabular-nums; }
    .news-zoo-label { flex: 0 0 auto; color: #1f5b45; font-size: 0.78rem; font-weight: bold; text-decoration: none; }
    .news-zoo-label:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .news-title { color: #1a1a1a; text-decoration: none; font-size: 0.93rem; line-height: 1.5; overflow-wrap: anywhere; }
    .news-title:hover { color: #1f5b45; text-decoration: underline; text-underline-offset: 0.2em; }
    .news-animals { display: flex; flex-wrap: wrap; gap: 0.3rem; }
    .news-animals a { font-size: 0.72rem; color: #1f5b45; background: #f0f7f3; border: 1px solid #c5dece; padding: 0.1rem 0.45rem; text-decoration: none; }
    .news-animals a:hover { background: #e1f0e8; }
    .news-empty { color: #777; font-size: 0.9rem; }
    noscript p { color: #777; font-size: 0.88rem; border: 1px solid #e1e1e1; background: #f7f7f7; padding: 0.75rem; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
    @media (max-width: 640px) {
      main { padding: 0.85rem; }
      .news-list li { padding: 0.75rem 0.35rem; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/favorites")}
  <main>
    <div>
      <h1>お気に入り</h1>
      <p class="lead">お気に入りに追加した動物園・動物・分類は、このブラウザの端末内にのみ保存されます。他の端末やブラウザとは共有されません。</p>
    </div>
    <noscript><p>お気に入り機能を利用するには JavaScript を有効にしてください。</p></noscript>
    <div id="favorites-root"></div>
    <section class="favorites-section" id="favorites-news-section" hidden>
      <h2 class="icon-heading">${icon("campaign")}お気に入りのお知らせ</h2>
      <ul class="news-list" id="favorites-news-list">${newsItemsHtml}</ul>
      <p class="favorites-empty" id="favorites-news-empty" hidden></p>
    </section>
  </main>
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
  <script>window.KinkiZooAnimalImageUrls = ${animalImageUrlsJson};window.KinkiZooFavoriteRankingData = ${favoriteRankingDataJson};</script>
  <script src="/favorites.js?v=5" defer></script>
</body>
</html>`;
}

interface SitemapEntry {
  path: string;
  lastmod?: string;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function loadAllTaxonomyPaths(db: D1Database): Promise<string[][]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT a.class_name, a.order_name, a.family_name, a.genus_name, a.species_name
       FROM animals a
       JOIN zoo_animals za ON za.animal_id = a.id`
    )
    .all<{
      class_name: string;
      order_name: string;
      family_name: string;
      genus_name: string;
      species_name: string;
    }>();

  const seen = new Set<string>();
  const paths: string[][] = [];
  for (const row of result.results ?? []) {
    const values = [row.class_name, row.order_name, row.family_name, row.genus_name, row.species_name];
    for (let index = 0; index < TAXONOMY_RANKS.length; index += 1) {
      const pathValues = values.slice(0, index + 1);
      const key = pathValues.join("/");
      if (seen.has(key)) continue;
      seen.add(key);
      paths.push(pathValues);
    }
  }
  return paths;
}

async function loadSitemapEntries(db: D1Database): Promise<SitemapEntry[]> {
  const [scrapeRows, animalRows, taxonomyPaths] = await Promise.all([
    db
      .prepare(`SELECT zoo_id, scraped_at FROM animal_scrape_results`)
      .all<{ zoo_id: string; scraped_at: string }>(),
    db
      .prepare(
        `SELECT za.display_name, MAX(r.scraped_at) AS last_scraped_at
         FROM zoo_animals za
         JOIN animal_scrape_results r ON r.zoo_id = za.zoo_id
         GROUP BY za.display_name`
      )
      .all<{ display_name: string; last_scraped_at: string | null }>(),
    loadAllTaxonomyPaths(db),
  ]);

  const scrapedAtByZoo = new Map((scrapeRows.results ?? []).map((row) => [row.zoo_id, row.scraped_at]));

  const entries: SitemapEntry[] = [
    { path: "/" },
    { path: "/zoos" },
    { path: "/animals" },
    { path: "/news" },
  ];

  for (const zoo of zoos) {
    const scrapedAt = scrapedAtByZoo.get(zoo.id);
    entries.push({ path: `/zoos/${zoo.id}`, lastmod: scrapedAt?.slice(0, 10) });
  }

  for (const row of animalRows.results ?? []) {
    entries.push({
      path: `/animal/${encodeURIComponent(row.display_name)}`,
      lastmod: row.last_scraped_at?.slice(0, 10),
    });
  }

  for (const pathValues of taxonomyPaths) {
    entries.push({ path: buildTaxonomyPathUrl(pathValues) });
  }

  return entries;
}

function renderSitemapXml(origin: string, entries: SitemapEntry[]): string {
  const urlsXml = entries
    .map((entry) => {
      const loc = `${origin}${withBase(entry.path)}`;
      const lastmodXml = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      return `<url><loc>${escapeXml(loc)}</loc>${lastmodXml}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urlsXml}</urlset>`;
}

function isAdminPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin") ||
    pathname === "/api/animal-images/generate" ||
    pathname === "/api/animals/refresh" ||
    pathname === "/api/news/refresh" ||
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
    const basePath = normalizeBasePath(request.headers.get("x-forwarded-prefix"));
    return runWithBasePath(basePath, () => handleFetch(request, env, ctx));
  },
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        await refreshAllAnimalCache(env.DB);
        await refreshAllZooNews(env.DB);
      })()
    );
  },
};

const CANONICAL_HOSTNAME = "kinki-zoo.wagaya.org";

async function handleFetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.hostname === "kinki-zoo.anison.workers.dev") {
      url.hostname = CANONICAL_HOSTNAME;
      url.port = "";
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
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

    // Static: /sitemap.xml
    if (pathname === "/sitemap.xml") {
      const entries = await loadSitemapEntries(env.DB);
      return new Response(renderSitemapXml(url.origin, entries), {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    // Static: /robots.txt
    if (pathname === "/robots.txt") {
      const body = `User-agent: *\nDisallow: ${withBase("/admin")}\nSitemap: ${url.origin}${withBase("/sitemap.xml")}\n`;
      return new Response(body, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
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

    // JSON API: refresh all zoo news caches
    if (pathname === "/api/news/refresh") {
      if (request.method !== "POST") {
        return jsonResponse({ error: "POST を使用してください" }, 405);
      }
      await refreshAllZooNews(env.DB);
      const status = await loadScrapeStatus(env.DB);
      return jsonResponse({ status });
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
      const noImage = url.searchParams.get("no_image") === "1";
      const items = await loadAnimalImageManageItems(env.DB, query, noImage);
      const html = renderAnimalImageManageListHtml(items, query, notice, noImage);
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
        return redirectResponse(addPrefectureToInternalUrl(href, activePref), 303);
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
      return redirectResponse(addPrefectureToInternalUrl(href, activePref), 303);
    }

    // HTML: /admin/animal-images/manage/:displayName
    const animalImageManageMatch = pathname.match(/^\/admin\/animal-images\/manage\/(.+)$/);
    if (animalImageManageMatch) {
      const displayName = decodeURIComponent(animalImageManageMatch[1]);
      const destination = new URL("/admin/animal-images", url.origin);
      destination.searchParams.set("q", displayName);
      destination.hash = buildAnimalImageItemId(normalizeAnimalImageKey(displayName));
      return redirectResponse(`${destination.pathname}${destination.search}${destination.hash}`, 301);
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
          "X-Animal-Image-Key": encodeURIComponent(generation.animalKey),
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
              "X-Animal-Image-Key": encodeURIComponent(image.animalKey),
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
            "X-Animal-Image-Key": encodeURIComponent(image.animalKey),
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

    // HTML: /admin/scrape-status
    if (pathname === "/admin/scrape-status") {
      const rows = await loadScrapeStatus(env.DB);
      return htmlResponse(renderScrapeStatusHtml(rows), url, activePref);
    }

    // HTML: /admin/scrape-health
    if (pathname === "/admin/scrape-health") {
      const items = await loadScrapeHealth(env.DB);
      return htmlResponse(renderScrapeHealthAdminHtml(items), url, activePref);
    }

    // HTML: /admin/scrape-history
    if (pathname === "/admin/scrape-history") {
      const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "30", 10);
      const zooIdParam = url.searchParams.get("zoo");
      const zooId = zooIdParam && zoos.some((zoo) => zoo.id === zooIdParam) ? zooIdParam : null;
      const items = await loadScrapeHistory(env.DB, Number.isFinite(limitParam) ? limitParam : 30, zooId);
      return htmlResponse(renderScrapeHistoryAdminHtml(items, zooId), url, activePref);
    }

    // HTML: /admin/animal-taxonomy
    if (pathname === "/admin/animal-taxonomy") {
      const animals = await loadAnimalsForTaxonomy(env.DB);
      const html = renderAnimalTaxonomyAdminHtml(animals);
      return htmlResponse(html, url, activePref);
    }

    // HTML: /news
    if (pathname === "/news") {
      const [allNews, imageKeys] = await Promise.all([
        loadAllZooNews(env.DB),
        loadAnimalImageKeys(env.DB),
      ]);
      const news = activePref
        ? allNews.filter((n) => zoos.find((z) => z.id === n.zoo_id)?.prefecture === activePref)
        : allNews;
      return htmlResponse(renderNewsListHtml(news, activePref, imageKeys), url, activePref);
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
    // HTML: /animals（一覧・分類の統合ページ）
    if (pathname === "/animals") {
      const filter: AnimalListFilter =
        url.searchParams.get("filter") === "unclassified" ? "unclassified" : "all";
      const query = normalizeSearchTerm(url.searchParams.get("q"));
      const className = filter === "all" ? normalizeSearchTerm(url.searchParams.get("cls")) : null;
      const orderName = className ? normalizeSearchTerm(url.searchParams.get("order")) : null;
      const familyName = orderName ? normalizeSearchTerm(url.searchParams.get("family")) : null;
      const genusName = familyName ? normalizeSearchTerm(url.searchParams.get("genus")) : null;
      const taxonomy: AnimalTaxonomySelection = { className, orderName, familyName, genusName };
      const [animals, imageKeys] = await Promise.all([
        loadAnimalList(env.DB, filter, activePref),
        loadAnimalImageKeys(env.DB),
      ]);
      const filteredAnimals = filterAnimalItemsByQuery(animals, query);
      const html = renderAnimalsHtml(filteredAnimals, filter, activePref, imageKeys, query, taxonomy);
      return htmlResponse(html, url, activePref);
    }

    // HTML: /zoos（一覧・地図・分類表・比較の統合ページ）
    if (pathname === "/zoos") {
      const selectedZoos = ["a", "b", "c"]
        .map((key) => url.searchParams.get(key) ?? "")
        .map((id) => zoos.find((zoo) => zoo.id === id) ?? null)
        .filter((zoo): zoo is Zoo => Boolean(zoo && (!activePref || zoo.prefecture === activePref)))
        .filter((zoo, index, items) => items.findIndex((item) => item.id === zoo.id) === index);
      if (selectedZoos.length >= 2) {
        const [animalLists, animalCounts] = await Promise.all([
          Promise.all(selectedZoos.map((zoo) => loadZooAnimalsForCompare(env.DB, zoo.id))),
          loadZooAnimalCounts(env.DB, zoos.map((zoo) => zoo.id)),
        ]);
        const selected = selectedZoos.map((zoo, index) => ({ zoo, animals: animalLists[index] }));
        return htmlResponse(renderCompareHtml(selected, animalCounts, activePref), url, activePref);
      }

      const requestedView = url.searchParams.get("view");
      if (requestedView === "taxonomy") {
        const [countRows, animalCounts] = await Promise.all([
          loadTaxonomyCountsByZoo(env.DB),
          loadZooAnimalCounts(env.DB, zoos.map((zoo) => zoo.id)),
        ]);
        return htmlResponse(renderCompareIndexHtml(countRows, animalCounts, activePref), url, activePref);
      }

      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      const taxClass = url.searchParams.get("cls") ?? null;
      const view: Exclude<ZooView, "taxonomy"> = requestedView === "map" ? "map" : "list";
      const latParam = parseFloat(url.searchParams.get("lat") ?? "");
      const lonParam = parseFloat(url.searchParams.get("lon") ?? "");
      const zoomParam = parseFloat(url.searchParams.get("z") ?? "");
      const initialLat = isFinite(latParam) ? latParam : null;
      const initialLon = isFinite(lonParam) ? lonParam : null;
      const initialZoom = isFinite(zoomParam) ? zoomParam : null;
      const results = taxClass && !animal
        ? await searchZoosByTaxonomyClass(env.DB, activePref, taxClass)
        : await searchZoos(env.DB, activePref, animal);
      const html = renderZoosHtml(
        results,
        activePref,
        animal,
        animal ? null : taxClass,
        view,
        initialLat,
        initialLon,
        initialZoom
      );
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
        redirectResponse(
          addPrefectureToInternalUrl(
            `${buildZooAnimalUrl(displayName)}?llm=${encodeURIComponent(status)}`,
            activePref
          ),
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
      if (!detail) {
        const pastZoos = await loadAnimalPastZoos(env.DB, displayName, [], activePref);
        if (pastZoos.length === 0) return notFound(`動物 '${displayName}' が見つかりません`);
        return htmlResponse(renderAnimalGoneHtml(displayName, pastZoos), url, activePref);
      }
      const [relatedAnimals, relatedDisplayNames, imageKeys, animalNews, pastZoos] = await Promise.all([
        loadRelatedAnimals(env.DB, detail),
        loadRelatedDisplayNames(env.DB, detail, activePref),
        loadAnimalImageKeys(env.DB),
        loadAnimalNews(env.DB, detail.displayName, detail.canonicalName ?? null),
        loadAnimalPastZoos(env.DB, displayName, detail.zoos.map((zoo) => zoo.id), activePref),
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
        imageKeys,
        animalNews,
        pastZoos
      );
      return htmlResponse(html, url, activePref);
    }

    // HTML: /taxonomy
    // 分類ツリーは廃止し /animals の分類絞り込みに統合済み。既存リンク・ブックマークのため恒久リダイレクトする。
    if (pathname === "/taxonomy") {
      const destination = new URL("/animals", url.origin);
      destination.search = url.search;
      destination.searchParams.delete("view");
      return redirectResponse(`${destination.pathname}${destination.search}`, 301);
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
        return redirectResponse(`${destination.pathname}${destination.search}`, 301);
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
      return redirectResponse(`${destination.pathname}${destination.search}${destination.hash}`, 301);
    }

    // HTML: /zoos/:id
    const zooPageMatch = pathname.match(/^\/zoos\/([^/]+)$/);
    if (zooPageMatch) {
      const id = zooPageMatch[1];
      const zoo = zoos.find((z) => z.id === id);
      if (!zoo || (activePref && zoo.prefecture !== activePref)) {
        return notFound(`選択中の地域に動物園 '${id}' が見つかりません`);
      }
      const [scraped, coverage, imageKeys, taxonomyByAnimal, news] = await Promise.all([
        getAnimalResult(env.DB, id, url.searchParams.get("refresh") === "1"),
        loadZooCoverage(env.DB, id),
        loadAnimalImageKeys(env.DB),
        loadZooAnimalTaxonomyIndex(env.DB, id),
        loadZooNews(env.DB, id),
      ]);
      const pageUrl = `${url.origin}${withBase(`/zoos/${zoo.id}`)}`;
      const html = renderZooDetailHtml(zoo, scraped, coverage, imageKeys, taxonomyByAnimal, news, pageUrl);
      return htmlResponse(html, url, activePref);
    }

    // HTML: /map
    // /compare は /zoos の分類表・比較結果へ統合済み。既存リンク・ブックマークのため恒久リダイレクトする。
    if (pathname === "/compare") {
      const destination = new URL("/zoos", url.origin);
      destination.search = url.search;
      const validSelectedIds = new Set(["a", "b", "c"].map((key) => {
        const id = destination.searchParams.get(key);
        return id && zoos.some((zoo) => zoo.id === id && (!activePref || zoo.prefecture === activePref)) ? id : null;
      }).filter((id): id is string => id !== null));
      if (validSelectedIds.size < 2) {
        destination.searchParams.delete("a");
        destination.searchParams.delete("b");
        destination.searchParams.delete("c");
        destination.searchParams.set("view", "taxonomy");
      }
      return redirectResponse(`${destination.pathname}${destination.search}`, 301);
    }

    // /map は /zoos の地図タブへ統合済み。既存リンク・ブックマークのため恒久リダイレクトする。
    if (pathname === "/map") {
      const destination = new URL("/zoos", url.origin);
      destination.search = url.search;
      destination.searchParams.set("view", "map");
      return redirectResponse(`${destination.pathname}${destination.search}`, 301);
    }

    // HTML: /favorites
    if (pathname === "/favorites") {
      const [news, imageKeys, animals] = await Promise.all([
        loadAllZooNews(env.DB, 500),
        loadAnimalImageKeys(env.DB),
        loadAnimalList(env.DB, "all", activePref),
      ]);
      return htmlResponse(renderFavoritesHtml(news, imageKeys, animals, activePref), url, activePref);
    }

    // HTML: /
    if (pathname === "/") {
      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      if (animal) {
        const destination = new URL("/zoos", url.origin);
        destination.search = url.search;
        return redirectResponse(`${destination.pathname}${destination.search}`, 301);
      }
      const [results, latestNews, imageKeys] = await Promise.all([
        searchZoos(env.DB, activePref, null),
        loadAllZooNews(env.DB, 10),
        loadAnimalImageKeys(env.DB),
      ]);
      const html = renderHomeHtml(results, activePref, latestNews, imageKeys);
      return htmlResponse(html, url, activePref);
    }

    return notFound("ページが見つかりません");
}
