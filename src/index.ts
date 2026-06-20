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

function matchesAnimalFeatures(zoo: Zoo, searchKeyword: string): boolean {
  return zoo.features.some((feature) =>
    feature.toLocaleLowerCase("ja-JP").includes(searchKeyword)
  );
}

function matchesScrapedAnimals(animals: string[], searchKeyword: string): boolean {
  return animals.some((animal) =>
    animal.toLocaleLowerCase("ja-JP").includes(searchKeyword)
  );
}

async function filterZoos(pref?: string | null, animal?: string | null): Promise<Zoo[]> {
  const normalizedAnimal = normalizeSearchTerm(animal);

  const prefFiltered = zoos.filter((zoo) => {
    if (pref && (!isPrefectureCode(pref) || zoo.prefecture !== pref)) {
      return false;
    }
    return true;
  });

  if (!normalizedAnimal) {
    return prefFiltered;
  }

  const searchKeyword = normalizedAnimal.toLocaleLowerCase("ja-JP");
  const scrapeResults = await Promise.allSettled(
    prefFiltered.map((zoo) => scrapeAnimals(zoo.id))
  );

  return prefFiltered.filter((zoo, index) => {
    const result = scrapeResults[index];
    if (result.status === "fulfilled" && !result.value.error) {
      return matchesScrapedAnimals(result.value.animals, searchKeyword);
    }
    return matchesAnimalFeatures(zoo, searchKeyword);
  });
}

function renderZooCard(zoo: Zoo): string {
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
  filteredZoos: Zoo[],
  activePref: PrefectureCode | null,
  animal: string | null
): string {
  const cards = filteredZoos.map(renderZooCard).join("\n");
  const escapedAnimal = animal ? escapeHtml(animal) : "";
  const allTab = activePref
    ? `<a href="${buildBrowseUrl(null, animal)}" class="tab">すべて</a>`
    : `<a href="${buildBrowseUrl(null, animal)}" class="tab active">すべて</a>`;
  const prefTabs = PREF_CODES.map((code) =>
    renderPrefTab(code, PREF_LABELS[code], code === activePref, animal)
  ).join("\n");

  const count = filteredZoos.length;
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
    body { font-family: sans-serif; background: #f7f9fc; color: #333; }
    header { background: #2d6a4f; color: #fff; padding: 1rem 1.5rem; }
    header h1 { font-size: 1.5rem; }
    header p { font-size: 0.9rem; opacity: 0.85; margin-top: 0.25rem; }
    .tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 1rem 1.5rem; background: #fff; border-bottom: 1px solid #ddd; }
    .tab { padding: 0.4rem 0.9rem; border-radius: 999px; border: 1px solid #2d6a4f; color: #2d6a4f; text-decoration: none; font-size: 0.875rem; }
    .tab.active, .tab:hover { background: #2d6a4f; color: #fff; }
    .search-form { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0 1.5rem 1rem; background: #fff; }
    .search-form input { flex: 1 1 220px; max-width: 320px; padding: 0.55rem 0.75rem; border: 1px solid #c8d5cc; border-radius: 999px; font-size: 0.95rem; }
    .search-form button, .search-form a { border-radius: 999px; font-size: 0.875rem; }
    .search-form button { border: none; background: #2d6a4f; color: #fff; padding: 0.55rem 1rem; cursor: pointer; }
    .search-form a { padding: 0.5rem 0.9rem; color: #2d6a4f; text-decoration: none; border: 1px solid #2d6a4f; }
    .summary { padding: 0.75rem 1.5rem; font-size: 0.9rem; color: #666; }
    .zoo-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; padding: 1rem 1.5rem; }
    .zoo-card { background: #fff; border-radius: 8px; padding: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .zoo-card h2 { font-size: 1.1rem; margin-bottom: 0.25rem; }
    .zoo-card h2 a { color: #2d6a4f; text-decoration: none; }
    .zoo-card h2 a:hover { text-decoration: underline; }
    .wiki-link { font-size: 0.7rem; font-weight: normal; margin-left: 0.5rem; color: #888; border: 1px solid #ccc; border-radius: 3px; padding: 0.1rem 0.4rem; vertical-align: middle; text-decoration: none; }
    .wiki-link:hover { background: #f0f0f0; }
    .kana { font-size: 0.8rem; color: #888; margin-bottom: 0.75rem; }
    dl { display: grid; grid-template-columns: 5.5em 1fr; gap: 0.2rem 0.5rem; font-size: 0.85rem; }
    dt { color: #666; font-weight: bold; }
    .links { margin-top: 0.75rem; display: flex; gap: 0.75rem; font-size: 0.85rem; }
    .links a { color: #2d6a4f; text-decoration: none; }
    .links a:hover { text-decoration: underline; }
    .features { margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .tag { background: #e8f5e9; color: #2d6a4f; border-radius: 999px; padding: 0.2rem 0.6rem; font-size: 0.75rem; }
    .empty { padding: 2rem 1.5rem; color: #888; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
  </style>
</head>
<body>
  <header>
    <h1>🦁 近畿動物園情報</h1>
    <p>近畿一円の動物園・動物施設をまとめて調べられます</p>
  </header>
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
  <style>
    body { font-family: sans-serif; margin: 0; background: #f7f9fc; color: #333; }
    main { max-width: 840px; margin: 0 auto; padding: 1.5rem; }
    .nav { margin-bottom: 1rem; display: flex; gap: 1rem; flex-wrap: wrap; }
    .nav a { color: #2d6a4f; text-decoration: none; }
    .card { background: #fff; border-radius: 8px; padding: 1.25rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    h1 { margin-bottom: 0.5rem; }
    .kana { color: #777; margin-bottom: 1rem; }
    dl { display: grid; grid-template-columns: 6em 1fr; gap: 0.25rem 0.5rem; margin-bottom: 1rem; }
    dt { color: #666; font-weight: bold; }
    ul { padding-left: 1.2rem; }
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
  </main>
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
    body { font-family: sans-serif; margin: 0; background: #f7f9fc; color: #333; }
    main { max-width: 840px; margin: 0 auto; padding: 1.5rem; }
    .nav { margin-bottom: 1rem; display: flex; gap: 1rem; flex-wrap: wrap; }
    .nav a { color: #2d6a4f; text-decoration: none; }
    .card { background: #fff; border-radius: 8px; padding: 1.25rem; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    ul { columns: 2; padding-left: 1.2rem; }
    li { break-inside: avoid; margin-bottom: 0.35rem; }
    .meta { margin-top: 1rem; color: #666; font-size: 0.85rem; }
    .error { color: #b00020; margin-bottom: 0.75rem; }
    @media (max-width: 640px) { ul { columns: 1; } }
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
      const result = await filterZoos(pref, animal);
      return jsonResponse(result);
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

    // HTML: /
    if (pathname === "/") {
      const pref = url.searchParams.get("pref");
      const animal = normalizeSearchTerm(url.searchParams.get("animal"));
      const activePref: PrefectureCode | null = pref && isPrefectureCode(pref) ? pref : null;
      const filtered = await filterZoos(activePref, animal);
      const html = renderHtml(filtered, activePref, animal);
      return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return notFound("ページが見つかりません");
  },
};
