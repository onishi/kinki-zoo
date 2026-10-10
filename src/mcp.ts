// MCP (Model Context Protocol) サーバー。
// Streamable HTTP トランスポートのうち、セッションを持たない JSON 応答だけを実装する。
// 公開するツールはすべて読み取り専用で、D1 への問い合わせは index.ts から McpDeps として受け取る。
import type { PrefectureCode, Zoo } from "./types";
import {
  ACTIVITY_PATTERN_LABELS,
  CONTEXT_LABELS,
  DIET_TYPE_LABELS,
  DISTRIBUTION_REGION_LABELS,
  IUCN_STATUS_LABELS,
  METRIC_DEFINITIONS,
  SEX_LABELS,
  SOCIAL_STRUCTURE_LABELS,
  formatMeasurementValue,
  getMetricSortValue,
  isThreatened,
  summarizeMeasurements,
  type ActivityPattern,
  type AnimalProfile,
  type DietType,
  type DistributionRegion,
  type MeasurementMetric,
} from "./animal-profile";

const SUPPORTED_PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];
const SERVER_INFO = { name: "kinki-zoo", title: "近畿動物園情報", version: "1.0.0" };
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_NEWS_LIMIT = 50;
const MAX_FIND_ANIMAL_RESULTS = 20;
const MAX_COMPARE_ZOOS = 5;
const MAX_SEARCH_ANIMALS_LIMIT = 50;

const SERVER_INSTRUCTIONS = [
  "近畿地方（大阪・京都・兵庫・奈良・滋賀・三重・和歌山）の動物園・水族館の情報を返します。",
  "動物一覧とお知らせは各施設の公式サイトから定期取得したもので、表記は施設ごとの公式表示に従います。",
  "どの施設で見られるかは find_animal、施設の詳細は get_zoo、迷ったら search を使ってください。",
  "夜行性・肉食・絶滅危惧・分布地域などの特徴で動物を探すときや、体重・大きさ・寿命で並べるときは search_animals、",
  "1種の解説・サイズ・寿命・出典をくわしく知りたいときは get_animal_profile を使ってください（プロフィールは確認済みの種だけ公開しています）。",
  "都道府県は osaka, kyoto, hyogo, nara, shiga, mie, wakayama のコードで指定します。",
].join("\n");

interface McpAnimalItem {
  displayNames: string[];
  canonicalName?: string;
  className?: string;
  orderName?: string;
  familyName?: string;
  genusName?: string;
  speciesName?: string;
  zoos: Zoo[];
  profile?: AnimalProfile;
}

interface McpZooSearchResult {
  zoo: Zoo;
  matchedAnimals: string[];
  matchedFeatures: string[];
  animalCount: number;
}

interface McpNewsRow {
  zoo_id: string;
  title: string;
  url: string;
  published_at: string | null;
  body: string | null;
  animal_names: string | null;
}

interface McpTaxonomyResult {
  rank: { label: string };
  name: string;
  href: string;
  animalCount: number;
  zooCount: number;
}

export interface McpDeps {
  origin: string;
  zoos: Zoo[];
  prefLabels: Record<PrefectureCode, string>;
  matchesSearchQuery(values: Array<string | null | undefined>, query: string): boolean;
  searchSite(pref: PrefectureCode | null, query: string): Promise<{
    animals: McpAnimalItem[];
    zoos: McpZooSearchResult[];
    taxonomies: McpTaxonomyResult[];
    news: McpNewsRow[];
  }>;
  searchZoos(pref: PrefectureCode | null, animal: string | null): Promise<McpZooSearchResult[]>;
  loadAnimalList(pref: PrefectureCode | null): Promise<McpAnimalItem[]>;
  loadZooAnimals(zooId: string): Promise<{ animals: string[]; scrapedAt: string; error?: string } | null>;
  loadZooNews(zooId: string, limit: number): Promise<McpNewsRow[]>;
  loadAllZooNews(limit: number, query: string | null, pref: PrefectureCode | null): Promise<McpNewsRow[]>;
  loadZooAnimalsForCompare(zooIds: string[]): Promise<Map<string, Array<{ display_name: string; class_name: string | null }>>>;
  /** 公開済みプロフィール（出典つき）を animals.canonical_name で引く。 */
  loadAnimalProfile(canonicalName: string): Promise<AnimalProfile | null>;
}

type JsonObject = Record<string, unknown>;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: JsonObject;
}

class JsonRpcError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
}

// ツールの引数エラーなど、モデルに読ませて言い直してもらう失敗。
class ToolInputError extends Error {}

const PREF_SCHEMA = {
  type: "string",
  enum: ["osaka", "kyoto", "hyogo", "nara", "shiga", "mie", "wakayama"],
  description: "都道府県コード（osaka=大阪府, kyoto=京都府, hyogo=兵庫県, nara=奈良県, shiga=滋賀県, mie=三重県, wakayama=和歌山県）",
};

const READ_ONLY_ANNOTATIONS = { readOnlyHint: true, openWorldHint: false };

interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonObject;
  run(args: JsonObject, deps: McpDeps): Promise<unknown>;
}

const TOOLS: ToolDefinition[] = [
  {
    name: "search",
    title: "サイト内検索",
    description: "キーワードで動物・施設・分類・お知らせをまとめて検索する。動物は名前のほか「夜行性」「肉食」「絶滅危惧」「アフリカ」などの特徴語や学名・英名でも見つかり、空白区切りの語はすべてを満たすもの（AND）を返す。何を調べればよいか決まっていないときに使う。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "検索語（例: パンダ、ネコ科、天王寺、イベント、夜行性 アフリカ）" },
        pref: PREF_SCHEMA,
      },
      required: ["query"],
    },
    async run(args, deps) {
      const query = requireString(args, "query");
      const pref = optionalPref(args);
      const result = await deps.searchSite(pref, query);
      return {
        animals: result.animals.slice(0, MAX_FIND_ANIMAL_RESULTS).map((animal) => summarizeAnimal(animal, deps)),
        animalTotal: result.animals.length,
        zoos: result.zoos.map((item) => ({
          ...summarizeZoo(item.zoo, deps),
          matchedAnimals: item.matchedAnimals,
          matchedFields: item.matchedFeatures,
          animalCount: item.animalCount,
        })),
        taxonomies: result.taxonomies.map((item) => ({
          rank: item.rank.label,
          name: item.name,
          animalCount: item.animalCount,
          zooCount: item.zooCount,
          url: new URL(item.href, deps.origin).toString(),
        })),
        news: result.news.slice(0, 10).map((row) => summarizeNews(row, deps, false)),
      };
    },
  },
  {
    name: "search_zoos",
    title: "動物園を探す",
    description: "都道府県や動物名・分類名（例: パンダ、ペンギン、霊長目）で施設を絞り込む。両方省略すると全施設を返す。",
    inputSchema: {
      type: "object",
      properties: {
        pref: PREF_SCHEMA,
        animal: { type: "string", description: "動物名または分類名。部分一致で検索する" },
      },
    },
    async run(args, deps) {
      const pref = optionalPref(args);
      const animal = optionalString(args, "animal");
      const results = await deps.searchZoos(pref, animal);
      return {
        count: results.length,
        zoos: results.map((item) => ({
          ...summarizeZoo(item.zoo, deps),
          animalCount: item.animalCount,
          ...(animal ? { matchedAnimals: item.matchedAnimals } : {}),
        })),
      };
    },
  },
  {
    name: "get_zoo",
    title: "動物園の詳細",
    description: "施設 ID を指定して、基本情報（住所・営業時間・休園日・料金）、飼育動物の一覧、最新のお知らせを返す。施設 ID は search_zoos で調べられる。",
    inputSchema: {
      type: "object",
      properties: {
        zoo_id: { type: "string", description: "施設 ID（例: tennoji-zoo）" },
      },
      required: ["zoo_id"],
    },
    async run(args, deps) {
      const zoo = requireZoo(args, deps);
      const [animals, news] = await Promise.all([
        deps.loadZooAnimals(zoo.id),
        deps.loadZooNews(zoo.id, 5),
      ]);
      return {
        ...summarizeZoo(zoo, deps),
        nameKana: zoo.nameKana,
        lat: zoo.lat,
        lon: zoo.lon,
        features: zoo.features,
        wikipediaUrl: zoo.wikipediaUrl,
        animals: animals?.animals ?? [],
        animalsFetchedAt: animals?.scrapedAt ?? null,
        ...(animals?.error ? { animalsError: animals.error } : {}),
        latestNews: news.map((row) => summarizeNews(row, deps, false)),
      };
    },
  },
  {
    name: "find_animal",
    title: "動物を見られる施設",
    description: "動物名（例: レッサーパンダ、カピバラ、ゾウ。学名・英名も可）から、その動物を見られる施設と分類（類・目・科・属・種）を返す。プロフィールが公開されている種は、学名・一言紹介・IUCN ランク・サイズ・体重・寿命も返す。表記ゆれ（ひらがな・カタカナ）は吸収する。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "動物名。部分一致で検索する" },
        pref: PREF_SCHEMA,
      },
      required: ["name"],
    },
    async run(args, deps) {
      const name = requireString(args, "name");
      const pref = optionalPref(args);
      const animals = (await deps.loadAnimalList(pref)).filter((animal) =>
        deps.matchesSearchQuery(
          [animal.canonicalName, ...animal.displayNames, animal.speciesName, animal.profile?.scientificName, animal.profile?.englishName],
          name
        )
      );
      return {
        count: animals.length,
        animals: animals.slice(0, MAX_FIND_ANIMAL_RESULTS).map((animal) => summarizeAnimal(animal, deps)),
        ...(animals.length > MAX_FIND_ANIMAL_RESULTS
          ? { note: `一致が多いため先頭 ${MAX_FIND_ANIMAL_RESULTS} 件だけ返しています。名前を詳しくしてください。` }
          : {}),
      };
    },
  },
  {
    name: "search_animals",
    title: "特徴で動物を探す",
    description:
      "動物の特徴（活動時間・食性・保全状況・分布地域・類）で絞り込み、体重・大きさ・寿命などの数値で並べ替えて返す。" +
      "「大阪で見られる夜行性の動物」「アフリカの絶滅危惧種」「いちばん重い動物」のような質問に使う。" +
      "対象はプロフィールが公開されている種だけなので、該当なしでも存在しないとは限らない（profileCoverage を参照）。",
    inputSchema: {
      type: "object",
      properties: {
        pref: PREF_SCHEMA,
        class_name: { type: "string", description: "類（例: 哺乳類、鳥類、爬虫類、両生類、魚類）" },
        activity: { type: "string", enum: Object.keys(ACTIVITY_PATTERN_LABELS), description: "活動時間（diurnal=昼行性, nocturnal=夜行性, crepuscular=薄明薄暮性, cathemeral=昼夜とも活動）" },
        diet: { type: "string", enum: Object.keys(DIET_TYPE_LABELS), description: "食性（carnivore=肉食, herbivore=草食, omnivore=雑食, insectivore=昆虫食, piscivore=魚食）" },
        region: { type: "string", enum: Object.keys(DISTRIBUTION_REGION_LABELS), description: "分布地域（japan, asia, europe, africa, north_america, south_america, oceania, antarctica, ocean, domestic=家畜・飼育品種）" },
        threatened: { type: "boolean", description: "true で絶滅危惧種（IUCN の CR/EN/VU または環境省レッドリストの絶滅危惧）だけ、false で絶滅危惧でない種だけ" },
        sort_by: { type: "string", enum: Object.keys(METRIC_DEFINITIONS), description: "並べ替える数値（weight=体重, head_body_length=頭胴長, total_length=全長, shoulder_height=肩高, height=体高, wingspan=翼開長, lifespan=寿命 など）。指定するとその数値がない種は除く" },
        order: { type: "string", enum: ["desc", "asc"], default: "desc", description: "desc=大きい順, asc=小さい順" },
        limit: { type: "integer", minimum: 1, maximum: MAX_SEARCH_ANIMALS_LIMIT, default: 20, description: "最大件数" },
      },
    },
    async run(args, deps) {
      const pref = optionalPref(args);
      const className = optionalString(args, "class_name");
      const activity = optionalEnum(args, "activity", Object.keys(ACTIVITY_PATTERN_LABELS) as ActivityPattern[]);
      const diet = optionalEnum(args, "diet", Object.keys(DIET_TYPE_LABELS) as DietType[]);
      const region = optionalEnum(args, "region", Object.keys(DISTRIBUTION_REGION_LABELS) as DistributionRegion[]);
      const threatened = optionalBoolean(args, "threatened");
      const sortBy = optionalEnum(args, "sort_by", Object.keys(METRIC_DEFINITIONS) as MeasurementMetric[]);
      const order = optionalEnum(args, "order", ["desc", "asc"] as const) ?? "desc";
      const limit = optionalLimit(args, 20, MAX_SEARCH_ANIMALS_LIMIT);

      const all = await deps.loadAnimalList(pref);
      const withProfile = all.filter(
        (animal): animal is McpAnimalItem & { profile: AnimalProfile } => Boolean(animal.profile)
      );
      let matched = withProfile.filter(({ profile, className: animalClass }) =>
        (!className || animalClass === className) &&
        (!activity || profile.activityPattern === activity) &&
        (!diet || profile.dietType === diet) &&
        (!region || profile.distributionRegions.includes(region)) &&
        (threatened === null || isThreatened(profile) === threatened)
      );
      if (sortBy) {
        const valued = matched
          .map((animal) => ({ animal, value: getMetricSortValue(animal.profile, sortBy) }))
          .filter((item): item is { animal: typeof item.animal; value: number } => item.value !== null);
        valued.sort((a, b) => (order === "asc" ? a.value - b.value : b.value - a.value));
        matched = valued.map((item) => item.animal);
      }
      return {
        count: matched.length,
        profileCoverage: `${withProfile.length} / ${all.length} 種でプロフィール公開済み`,
        ...(sortBy ? { sortedBy: `${METRIC_DEFINITIONS[sortBy].label}（${order === "asc" ? "小さい順" : "大きい順"}）` } : {}),
        animals: matched.slice(0, limit).map((animal) => summarizeAnimal(animal, deps)),
      };
    },
  },
  {
    name: "get_animal_profile",
    title: "動物のプロフィール",
    description: "動物名（和名・施設での表示名・学名・英名）を指定して、解説・生息地・食べもの・見どころ・豆知識・サイズや体重や寿命の数値（性別・野生/飼育下の別つき）・保全状況・出典と、見られる施設を返す。",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "動物名。完全一致を優先し、なければ部分一致の先頭を使う" },
        pref: PREF_SCHEMA,
      },
      required: ["name"],
    },
    async run(args, deps) {
      const name = requireString(args, "name");
      const pref = optionalPref(args);
      const animals = await deps.loadAnimalList(pref);
      const names = (animal: McpAnimalItem) => [
        animal.canonicalName,
        ...animal.displayNames,
        animal.speciesName,
        animal.profile?.scientificName,
        animal.profile?.englishName,
      ];
      const normalized = name.normalize("NFKC").toLocaleLowerCase("ja-JP");
      const exact = animals.find((animal) =>
        names(animal).some((value) => value?.normalize("NFKC").toLocaleLowerCase("ja-JP") === normalized)
      );
      const animal = exact ?? animals.find((item) => deps.matchesSearchQuery(names(item), name));
      if (!animal) {
        throw new ToolInputError(`'${name}' に一致する動物が見つかりません。find_animal や search で名前を確認してください`);
      }
      const profile = animal.canonicalName ? await deps.loadAnimalProfile(animal.canonicalName) : null;
      const base = summarizeAnimal({ ...animal, profile: undefined }, deps);
      if (!profile) {
        return { ...base, profile: null, note: "この動物のプロフィールはまだ公開されていません。" };
      }
      return {
        ...base,
        profile: {
          scientificName: profile.scientificName,
          englishName: profile.englishName,
          summary: profile.summary,
          description: profile.description,
          habitat: profile.habitat,
          distribution: profile.distributionRegions.map((region) => DISTRIBUTION_REGION_LABELS[region]),
          diet: profile.diet,
          dietType: profile.dietType ? DIET_TYPE_LABELS[profile.dietType] : undefined,
          activityPattern: profile.activityPattern ? ACTIVITY_PATTERN_LABELS[profile.activityPattern] : undefined,
          socialStructure: profile.socialStructure ? SOCIAL_STRUCTURE_LABELS[profile.socialStructure] : undefined,
          viewingTips: profile.viewingTips,
          trivia: profile.trivia,
          conservation: summarizeConservation(profile),
          measurements: profile.measurements.map((m) => ({
            item: METRIC_DEFINITIONS[m.metric].label,
            sex: SEX_LABELS[m.sex] || undefined,
            condition: CONTEXT_LABELS[m.context] || undefined,
            value: formatMeasurementValue(m),
            min: m.min,
            max: m.max,
            unit: m.unit,
            note: m.note,
          })),
          sources: profile.sources,
          updatedAt: profile.updatedAt,
        },
      };
    },
  },
  {
    name: "list_news",
    title: "お知らせ一覧",
    description: "各施設のお知らせ（イベント・誕生・休園など）を新しい順に返す。キーワード・都道府県・施設で絞り込める。",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "タイトル・本文に含まれる語" },
        pref: PREF_SCHEMA,
        zoo_id: { type: "string", description: "施設 ID" },
        limit: { type: "integer", minimum: 1, maximum: MAX_NEWS_LIMIT, default: 20, description: "最大件数" },
      },
    },
    async run(args, deps) {
      const query = optionalString(args, "query");
      const pref = optionalPref(args);
      const limit = optionalLimit(args, 20, MAX_NEWS_LIMIT);
      let rows: McpNewsRow[];
      if (optionalString(args, "zoo_id")) {
        const zoo = requireZoo(args, deps);
        const zooNews = await deps.loadZooNews(zoo.id, query ? 200 : limit);
        rows = (query
          ? zooNews.filter((row) => deps.matchesSearchQuery([row.title, row.body], query))
          : zooNews
        ).slice(0, limit);
      } else {
        rows = await deps.loadAllZooNews(limit, query, pref);
      }
      return { count: rows.length, news: rows.map((row) => summarizeNews(row, deps, true)) };
    },
  },
  {
    name: "compare_zoos",
    title: "動物園を比較",
    description: `2〜${MAX_COMPARE_ZOOS} 施設の飼育動物を比べ、共通して見られる動物と各施設だけで見られる動物を返す。`,
    inputSchema: {
      type: "object",
      properties: {
        zoo_ids: {
          type: "array",
          items: { type: "string" },
          minItems: 2,
          maxItems: MAX_COMPARE_ZOOS,
          description: "施設 ID の配列",
        },
      },
      required: ["zoo_ids"],
    },
    async run(args, deps) {
      const rawIds = args.zoo_ids;
      if (!Array.isArray(rawIds) || rawIds.some((id) => typeof id !== "string")) {
        throw new ToolInputError("zoo_ids は施設 ID の文字列配列で指定してください");
      }
      const zooIds = [...new Set(rawIds as string[])];
      if (zooIds.length < 2 || zooIds.length > MAX_COMPARE_ZOOS) {
        throw new ToolInputError(`zoo_ids は異なる施設を 2〜${MAX_COMPARE_ZOOS} 件指定してください`);
      }
      const targets = zooIds.map((zooId) => requireZoo({ zoo_id: zooId }, deps));
      const byZoo = await deps.loadZooAnimalsForCompare(zooIds);
      const namesByZoo = new Map(
        targets.map((zoo) => [zoo.id, new Set((byZoo.get(zoo.id) ?? []).map((row) => row.display_name))])
      );
      const allNames = new Set([...namesByZoo.values()].flatMap((names) => [...names]));
      const common = [...allNames].filter((name) => [...namesByZoo.values()].every((names) => names.has(name)));
      return {
        common: common.sort(),
        zoos: targets.map((zoo) => {
          const own = namesByZoo.get(zoo.id) ?? new Set<string>();
          const others = targets.filter((other) => other.id !== zoo.id).map((other) => namesByZoo.get(other.id)!);
          return {
            ...summarizeZoo(zoo, deps),
            animalCount: own.size,
            onlyHere: [...own].filter((name) => others.every((names) => !names.has(name))).sort(),
          };
        }),
      };
    },
  },
];

function summarizeZoo(zoo: Zoo, deps: McpDeps) {
  return {
    id: zoo.id,
    name: zoo.name,
    prefecture: deps.prefLabels[zoo.prefecture],
    address: zoo.address,
    openingHours: zoo.openingHours,
    closedDays: zoo.closedDays,
    admission: zoo.admission,
    website: zoo.website,
    url: `${deps.origin}/zoos/${encodeURIComponent(zoo.id)}`,
  };
}

function summarizeAnimal(animal: McpAnimalItem, deps: McpDeps) {
  const name = animal.canonicalName ?? animal.displayNames[0];
  const taxonomy = {
    class: animal.className,
    order: animal.orderName,
    family: animal.familyName,
    genus: animal.genusName,
    species: animal.speciesName,
  };
  return {
    name,
    displayNames: animal.displayNames,
    taxonomy: Object.values(taxonomy).some(Boolean) ? taxonomy : undefined,
    zoos: animal.zoos.map((zoo) => ({ id: zoo.id, name: zoo.name, prefecture: deps.prefLabels[zoo.prefecture] })),
    url: `${deps.origin}/animal/${encodeURIComponent(animal.displayNames[0] ?? name)}`,
    ...(animal.profile ? { profile: summarizeProfile(animal.profile) } : {}),
  };
}

/** 一覧向けのプロフィール要約。区分値は日本語ラベルにして返す。 */
function summarizeProfile(profile: AnimalProfile) {
  return {
    scientificName: profile.scientificName,
    englishName: profile.englishName,
    summary: profile.summary,
    activityPattern: profile.activityPattern ? ACTIVITY_PATTERN_LABELS[profile.activityPattern] : undefined,
    diet: profile.dietType ? DIET_TYPE_LABELS[profile.dietType] : undefined,
    conservation: summarizeConservation(profile),
    distribution: profile.distributionRegions.map((region) => DISTRIBUTION_REGION_LABELS[region]),
    measurements: summarizeMeasurements(profile.measurements),
  };
}

function summarizeConservation(profile: AnimalProfile) {
  if (!profile.iucnStatus && !profile.moeRedlistCategory && !profile.citesAppendix) return undefined;
  return {
    threatened: isThreatened(profile),
    iucn: profile.iucnStatus
      ? `${profile.iucnStatus}（${IUCN_STATUS_LABELS[profile.iucnStatus]}）${profile.iucnAssessedYear ? ` ${profile.iucnAssessedYear}年評価` : ""}`
      : undefined,
    japanRedList: profile.moeRedlistCategory,
    cites: profile.citesAppendix ? `附属書${profile.citesAppendix}` : undefined,
  };
}

function optionalEnum<T extends string>(args: JsonObject, key: string, values: readonly T[]): T | null {
  const value = optionalString(args, key);
  if (!value) return null;
  if (!(values as readonly string[]).includes(value)) {
    throw new ToolInputError(`${key} '${value}' は無効です。${values.join(", ")} のいずれかを指定してください`);
  }
  return value as T;
}

function optionalBoolean(args: JsonObject, key: string): boolean | null {
  const value = args[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") throw new ToolInputError(`${key} は true / false で指定してください`);
  return value;
}

function summarizeNews(row: McpNewsRow, deps: McpDeps, includeBody: boolean) {
  const zoo = deps.zoos.find((item) => item.id === row.zoo_id);
  return {
    zooId: row.zoo_id,
    zooName: zoo?.name ?? row.zoo_id,
    title: row.title,
    url: row.url,
    publishedAt: row.published_at,
    animals: row.animal_names ? row.animal_names.split(",") : [],
    ...(includeBody && row.body ? { body: truncate(row.body, 400) } : {}),
  };
}

function truncate(value: string, max: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > max ? `${compact.slice(0, max)}…` : compact;
}

function optionalString(args: JsonObject, key: string): string | null {
  const value = args[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new ToolInputError(`${key} は文字列で指定してください`);
  return value.trim() || null;
}

function requireString(args: JsonObject, key: string): string {
  const value = optionalString(args, key);
  if (!value) throw new ToolInputError(`${key} を指定してください`);
  return value;
}

function optionalPref(args: JsonObject): PrefectureCode | null {
  const value = optionalString(args, "pref");
  if (!value) return null;
  if (!(PREF_SCHEMA.enum as string[]).includes(value)) {
    throw new ToolInputError(`pref '${value}' は無効です。${PREF_SCHEMA.enum.join(", ")} のいずれかを指定してください`);
  }
  return value as PrefectureCode;
}

function optionalLimit(args: JsonObject, fallback: number, max: number): number {
  const value = args.limit;
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ToolInputError("limit は 1 以上の整数で指定してください");
  }
  return Math.min(value, max);
}

function requireZoo(args: JsonObject, deps: McpDeps): Zoo {
  const zooId = requireString(args, "zoo_id");
  const zoo = deps.zoos.find((item) => item.id === zooId);
  if (!zoo) throw new ToolInputError(`施設 ID '${zooId}' は見つかりません。search_zoos で ID を確認してください`);
  return zoo;
}

async function callTool(params: JsonObject | undefined, deps: McpDeps): Promise<JsonObject> {
  const name = params?.name;
  const tool = TOOLS.find((item) => item.name === name);
  if (!tool) throw new JsonRpcError(-32602, `Unknown tool: ${String(name)}`);
  const args = params?.arguments ?? {};
  if (typeof args !== "object" || Array.isArray(args)) throw new JsonRpcError(-32602, "arguments must be an object");

  try {
    const result = await tool.run(args as JsonObject, deps);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  } catch (error) {
    if (error instanceof ToolInputError) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    console.error(`[mcp] tool ${tool.name} failed:`, error);
    return { content: [{ type: "text", text: "データの取得に失敗しました。時間をおいて再度お試しください。" }], isError: true };
  }
}

async function dispatch(request: JsonRpcRequest, deps: McpDeps): Promise<unknown> {
  switch (request.method) {
    case "initialize": {
      const requested = request.params?.protocolVersion;
      const protocolVersion =
        typeof requested === "string" && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
          ? requested
          : LATEST_PROTOCOL_VERSION;
      return {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: SERVER_INSTRUCTIONS,
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return {
        tools: TOOLS.map(({ name, title, description, inputSchema }) => ({
          name,
          title,
          description,
          inputSchema,
          annotations: { title, ...READ_ONLY_ANNOTATIONS },
        })),
      };
    case "tools/call":
      return callTool(request.params, deps);
    default:
      throw new JsonRpcError(-32601, `Method not found: ${request.method}`);
  }
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const message = value as JsonObject;
  return message.jsonrpc === "2.0" && typeof message.method === "string"
    && (message.params === undefined || (typeof message.params === "object" && message.params !== null && !Array.isArray(message.params)));
}

function errorResponse(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

// 通知（id なし）とクライアントからの応答には何も返さない。
async function handleMessage(message: unknown, deps: McpDeps): Promise<unknown | null> {
  if (!isJsonRpcRequest(message)) {
    const isClientResponse = message && typeof message === "object" && "id" in message
      && ("result" in message || "error" in message);
    if (isClientResponse) return null;
    const id = message && typeof message === "object" ? (message as JsonObject).id : null;
    return errorResponse(id, -32600, "Invalid Request");
  }
  if (message.id === undefined) return null;
  try {
    return { jsonrpc: "2.0", id: message.id, result: await dispatch(message, deps) };
  } catch (error) {
    if (error instanceof JsonRpcError) return errorResponse(message.id, error.code, error.message);
    console.error("[mcp] request failed:", error);
    return errorResponse(message.id, -32603, "Internal error");
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function handleMcpRequest(request: Request, deps: McpDeps): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...CORS_HEADERS, "Access-Control-Max-Age": "86400" } });
  }
  if (request.method === "GET") {
    // サーバーからの SSE ストリームは提供しない。ブラウザで開いた人向けに接続方法を返す。
    const endpoint = new URL(request.url);
    endpoint.search = "";
    const message = [
      `This is the MCP server for ${endpoint.host}.`,
      "It speaks the Model Context Protocol (Streamable HTTP) and accepts JSON-RPC requests via POST only.",
      `To use it, add ${endpoint.toString()} as a remote MCP server in your MCP client.`,
      "",
    ].join("\n");
    return new Response(message, {
      status: 405,
      headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS", "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  if (request.method !== "POST") {
    // セッションを持たないため、セッション終了（DELETE）は提供しない。
    return new Response("Method Not Allowed", { status: 405, headers: { ...CORS_HEADERS, Allow: "POST, OPTIONS" } });
  }

  const text = await request.text();
  if (text.length > MAX_REQUEST_BYTES) {
    return jsonResponse(errorResponse(null, -32600, "Request too large"), 413);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return jsonResponse(errorResponse(null, -32700, "Parse error"), 400);
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) return jsonResponse(errorResponse(null, -32600, "Invalid Request"), 400);
    const responses = (await Promise.all(payload.map((message) => handleMessage(message, deps))))
      .filter((response) => response !== null);
    return responses.length > 0 ? jsonResponse(responses) : new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  const response = await handleMessage(payload, deps);
  return response === null ? new Response(null, { status: 202, headers: CORS_HEADERS }) : jsonResponse(response);
}
