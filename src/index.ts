import type { PrefectureCode, Zoo } from "./types";
import { zoos } from "./data";
import { scrapeAnimals } from "./scraper";

const PREF_LABELS: Record<PrefectureCode, string> = {
  osaka: "大阪府",
  kyoto: "京都府",
  hyogo: "兵庫県",
  nara: "奈良県",
  shiga: "滋賀県",
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

function buildSearchResult(zoo: Zoo): ZooSearchResult {
  return {
    zoo,
    matchedAnimals: [],
    matchedFeatures: [],
    animalSearchAvailable: false,
  };
}

async function searchZoos(pref?: string | null, animal?: string | null): Promise<ZooSearchResult[]> {
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
  const scrapeResults = await Promise.allSettled(
    prefFiltered.map((zoo) => scrapeAnimals(zoo.id))
  );

  return prefFiltered.flatMap((zoo, index) => {
    const result = scrapeResults[index];
    const matchedFeatures = findMatches(zoo.features, searchKeyword);
    const searchResult: ZooSearchResult = {
      zoo,
      matchedAnimals: [],
      matchedFeatures,
      animalSearchAvailable: false,
    };

    if (result.status === "fulfilled") {
      searchResult.animalSearchAvailable = !result.value.error;
      searchResult.animalSearchError = result.value.error;
      searchResult.matchedAnimals = result.value.error
        ? []
        : findMatches(result.value.animals, searchKeyword);
    } else {
      searchResult.animalSearchError = String(result.reason);
    }

    if (searchResult.matchedAnimals.length > 0 || matchedFeatures.length > 0) {
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

function renderPrefTab(
  code: PrefectureCode,
  label: string,
  active: boolean,
  animal: string | null
): string {
  const cls = active ? 'class="tab active"' : 'class="tab"';
  return `<a href="${buildBrowseUrl(code, animal)}" ${cls}>${label}</a>`;
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
    body { font-family: sans-serif; background: #fff; color: #222; }
    header { padding: 1rem 1.5rem; border-bottom: 1px solid #ddd; }
    header h1 { font-size: 1.5rem; }
    header p { font-size: 0.9rem; color: #555; margin-top: 0.25rem; }
    .tabs { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; }
    .tab { color: #1f5b45; text-decoration: none; font-size: 0.9rem; }
    .tab.active { font-weight: bold; text-decoration: underline; text-underline-offset: 0.2em; }
    .tab:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .map-link { margin-left: auto; }
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
  <header>
    <h1>近畿動物園情報</h1>
    <p>近畿一円の動物園・動物施設をまとめて調べられます</p>
  </header>
  <nav class="tabs">
    ${allTab}
    ${prefTabs}
    <a href="${buildMapUrl(activePref, animal)}" class="tab map-link">🗺 地図で見る</a>
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

function renderZooDetailHtml(zoo: Zoo): string {
  const prefLabel = PREF_LABELS[zoo.prefecture];
  const features = zoo.features
    .map((feature) => `<li>${escapeHtml(feature)}</li>`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(zoo.name)} | 近畿動物園情報</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <style>
    body { font-family: sans-serif; margin: 0; background: #fff; color: #222; }
    main { max-width: 840px; margin: 0 auto; padding: 1.5rem; }
    .nav { margin-bottom: 1rem; display: flex; gap: 1rem; flex-wrap: wrap; }
    .nav a { color: #2d6a4f; text-decoration: none; }
    .card { background: #fff; border: 1px solid #ddd; padding: 1.25rem; margin-bottom: 1rem; }
    h1 { margin-bottom: 0.5rem; }
    .kana { color: #777; margin-bottom: 1rem; }
    dl { display: grid; grid-template-columns: 6em 1fr; gap: 0.25rem 0.5rem; margin-bottom: 1rem; }
    dt { color: #666; font-weight: bold; }
    ul { padding-left: 1.2rem; }
    #map { height: 320px; border: 1px solid #ddd; }
  </style>
</head>
<body>
  <main>
    <nav class="nav">
      <a href="/">← 一覧へ戻る</a>
      <a href="/zoos/${zoo.id}/animals">この動物園の動物一覧</a>
      <a href="${escapeHtml(zoo.website)}" target="_blank" rel="noopener noreferrer">公式サイト</a>
    </nav>
    <section class="card">
      <h1>${escapeHtml(zoo.name)}</h1>
      <p class="kana">${escapeHtml(zoo.nameKana)}</p>
      <dl>
        <dt>都道府県</dt><dd>${prefLabel}</dd>
        <dt>住所</dt><dd>${escapeHtml(zoo.address)}</dd>
        <dt>開園時間</dt><dd>${escapeHtml(zoo.openingHours)}</dd>
        <dt>休園日</dt><dd>${escapeHtml(zoo.closedDays)}</dd>
        <dt>入園料</dt><dd>${escapeHtml(zoo.admission)}</dd>
      </dl>
      <h2>特徴</h2>
      <ul>${features}</ul>
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
    body { font-family: sans-serif; background: #fff; color: #222; display: flex; flex-direction: column; height: 100vh; }
    header { padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; flex-shrink: 0; }
    header h1 { font-size: 1.5rem; }
    header p { font-size: 0.9rem; color: #555; margin-top: 0.25rem; }
    .tabs { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; flex-shrink: 0; }
    .tab { color: #1f5b45; text-decoration: none; font-size: 0.9rem; }
    .tab.active { font-weight: bold; text-decoration: underline; text-underline-offset: 0.2em; }
    .tab:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .search-form { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; flex-shrink: 0; }
    .search-form input { flex: 1 1 220px; max-width: 320px; padding: 0.55rem 0.75rem; border: 1px solid #bbb; font-size: 0.95rem; }
    .search-form button, .search-form a { font-size: 0.875rem; }
    .search-form button { border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.5rem 0.9rem; cursor: pointer; }
    .search-form a { padding: 0.5rem 0.7rem; color: #1f5b45; text-decoration: none; border: 1px solid #1f5b45; }
    .list-link { margin-left: auto; font-size: 0.85rem; color: #1f5b45; text-decoration: none; }
    .list-link:hover { text-decoration: underline; }
    .summary { padding: 0.4rem 1.5rem; font-size: 0.9rem; color: #666; flex-shrink: 0; }
    #map { flex: 1; min-height: 0; }
  </style>
</head>
<body>
  <header>
    <h1>近畿動物園情報</h1>
    <p>近畿一円の動物園・動物施設をまとめて調べられます</p>
  </header>
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
    body { font-family: sans-serif; margin: 0; background: #fff; color: #222; }
    main { max-width: 840px; margin: 0 auto; padding: 1.5rem; }
    .nav { margin-bottom: 1rem; display: flex; gap: 1rem; flex-wrap: wrap; }
    .nav a { color: #2d6a4f; text-decoration: none; }
    .card { background: #fff; border: 1px solid #ddd; padding: 1.25rem; }
    ul { padding-left: 1.2rem; }
    li { margin-bottom: 0.35rem; }
    .meta { margin-top: 1rem; color: #666; font-size: 0.85rem; }
    .error { color: #b00020; margin-bottom: 0.75rem; }
  </style>
</head>
<body>
  <main>
    <nav class="nav">
      <a href="/">← 一覧へ戻る</a>
      <a href="/zoos/${zoo.id}">${escapeHtml(zoo.name)}の詳細</a>
      <a href="${escapeHtml(zoo.website)}" target="_blank" rel="noopener noreferrer">公式サイト</a>
    </nav>
    <section class="card">
      <h1>${escapeHtml(zoo.name)}の動物一覧</h1>
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
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // JSON API: /api/zoos
    if (pathname === "/api/zoos") {
      const pref = url.searchParams.get("pref");
      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      if (pref && !isPrefectureCode(pref)) {
        return notFound(`都道府県コード '${pref}' は無効です`);
      }
      const results = await searchZoos(pref, animal);
      return jsonResponse(results.map((result) => toApiZoo(result, Boolean(animal))));
    }

    // JSON API: /api/zoos/:id/animals
    const zooAnimalsMatch = pathname.match(/^\/api\/zoos\/([^/]+)\/animals$/);
    if (zooAnimalsMatch) {
      const id = zooAnimalsMatch[1];
      const zoo = zoos.find((z) => z.id === id);
      if (!zoo) return notFound(`動物園 '${id}' が見つかりません`);
      const result = await scrapeAnimals(id);
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
      const scraped = await scrapeAnimals(id);
      const html = renderZooAnimalsHtml(zoo, scraped);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // HTML: /zoos/:id
    const zooPageMatch = pathname.match(/^\/zoos\/([^/]+)$/);
    if (zooPageMatch) {
      const id = zooPageMatch[1];
      const zoo = zoos.find((z) => z.id === id);
      if (!zoo) return notFound(`動物園 '${id}' が見つかりません`);
      const html = renderZooDetailHtml(zoo);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // HTML: /map
    if (pathname === "/map") {
      const pref = url.searchParams.get("pref");
      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      const activePref: PrefectureCode | null = pref && isPrefectureCode(pref) ? pref : null;
      const filtered = (await searchZoos(activePref, animal)).map((result) => result.zoo);
      const html = renderMapHtml(filtered, activePref, animal);
      return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }

    // HTML: /
    if (pathname === "/") {
      const pref = url.searchParams.get("pref");
      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      const activePref: PrefectureCode | null = pref && isPrefectureCode(pref) ? pref : null;
      const results = await searchZoos(activePref, animal);
      const html = renderHtml(results, activePref, animal);
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return notFound("ページが見つかりません");
  },
};
