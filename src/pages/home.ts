import { zoos } from "../data";
import type { FeaturedAnimal, ZooSearchResult } from "../index";
import type { PrefectureCode } from "../types";
import {
  COMMON_STYLES,
  PREF_LABELS,
  buildAnimalImageUrl,
  buildBrowseUrl,
  buildMapUrl,
  buildZooAnimalUrl,
  escapeHtml,
  renderGlobalNav,
  renderSiteHeader,
  renderStateMessage,
  renderZooCard,
} from "./layout";

export function renderHomeOverview(
  activePref: PrefectureCode | null,
  facilityCount: number,
  totalAnimalCount: number,
  featuredZoos: ZooSearchResult[]
): string {
  const prefLabel = activePref ? PREF_LABELS[activePref] : "近畿一円";
  const prefectureCount = activePref ? 1 : new Set(zoos.map((zoo) => zoo.prefecture)).size;
  const topZoo = featuredZoos[0];
  const stats = [
    { label: "掲載施設", value: `${facilityCount}`, unit: "施設" },
    { label: "登録動物", value: `${totalAnimalCount}`, unit: "件" },
    { label: "対象地域", value: `${prefectureCount}`, unit: activePref ? "府県" : "府県" },
  ];
  const topZooHtml = topZoo
    ? `<a class="home-featured-link" href="/zoos/${encodeURIComponent(topZoo.zoo.id)}">
        <span>${escapeHtml(topZoo.zoo.name)}</span>
        <small>${topZoo.animalCount} 種</small>
      </a>`
    : `<span class="home-featured-empty">集計中</span>`;

  return `
  <section class="home-overview" aria-labelledby="home-overview-title">
    <div class="home-overview-main">
      <p class="home-kicker">${escapeHtml(prefLabel)}</p>
      <h2 id="home-overview-title">動物園・動物・分類をまとめて探す</h2>
      <p class="home-lead">施設一覧、地図、動物名、分類から近畿の動物園情報を確認できます。</p>
      <div class="home-primary-actions">
        <a href="${buildBrowseUrl(activePref, null)}" class="ui-btn ui-btn--primary ui-touch-target">動物園一覧</a>
        <a href="${buildMapUrl(activePref, null)}" class="ui-btn ui-btn--secondary ui-touch-target">地図で見る</a>
      </div>
    </div>
    <div class="home-overview-side" aria-label="掲載状況">
      <dl class="home-stats">
        ${stats
          .map(
            (stat) => `
        <div>
          <dt>${escapeHtml(stat.label)}</dt>
          <dd><strong>${escapeHtml(stat.value)}</strong><span>${escapeHtml(stat.unit)}</span></dd>
        </div>`
          )
          .join("")}
      </dl>
      <div class="home-featured-zoo">
        <span>動物掲載数が多い施設</span>
        ${topZooHtml}
      </div>
    </div>
  </section>`;
}

export function renderExploreCards(activePref: PrefectureCode | null, facilityCount: number, totalAnimalCount: number): string {
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
      body: "動物名、分類、見られる施設を一覧で確認できます。",
    },
    {
      href: activePref ? `/taxonomy?pref=${activePref}` : "/taxonomy",
      label: "分類から探す",
      meta: "類・目・科で探索",
      body: "哺乳類、鳥類、爬虫類など、分類ツリーから動物をたどれます。",
    },
  ];

  return `
  <section class="explore-section" aria-labelledby="explore-title">
    <div class="explore-heading">
      <h2 id="explore-title">主要ページ</h2>
      <a href="/compare" class="section-link">動物園を比較 →</a>
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

export function renderSpotlightSection(
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
            <span>${escapeHtml(animal.displayName)}</span>
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

function renderHomeOrZoosPage(
  results: ZooSearchResult[],
  activePref: PrefectureCode | null,
  animal: string | null,
  featuredAnimals: FeaturedAnimal[] = [],
  page: "home" | "zoos" = "zoos"
): string {
  const isHome = page === "home";
  const includeMatchSummary = Boolean(animal);
  const rows = results.map((result) => renderZooCard(result, includeMatchSummary)).join("\n");
  const escapedAnimal = escapeHtml(animal ?? "");

  const count = results.length;
  const matchCount = results.reduce((sum, result) => sum + result.matchedAnimals.length, 0);
  const totalAnimalCount = results.reduce((sum, result) => sum + result.animalCount, 0);
  const prefLabel = activePref ? PREF_LABELS[activePref] : "近畿一円";
  const summary = animal
    ? `${prefLabel}で「${escapedAnimal}」を探せる動物園・施設: ${count} 件 / 検索ヒット: ${matchCount} 件`
    : `${prefLabel}の動物園・施設: ${count} 件`;
  const emptyMessage = animal
    ? `「${escapedAnimal}」に該当する施設が見つかりませんでした。`
    : "該当する施設が見つかりませんでした。";
  let zooListHtml = renderStateMessage(
    emptyMessage,
    animal
      ? [
          { href: buildBrowseUrl(activePref, null), label: "検索をクリア" },
          { href: buildMapUrl(activePref, null), label: "地図で見る" },
        ]
      : [{ href: "/taxonomy", label: "分類から探す" }]
  );
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

  const featuredZoos = animal
    ? []
    : [...results]
        .filter((r) => r.animalCount > 0)
        .sort((a, b) => b.animalCount - a.animalCount || a.zoo.name.localeCompare(b.zoo.name, "ja-JP"))
        .slice(0, 4);

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
    .search-form button, .search-form a { padding: 0.5rem 0.9rem; }
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
    .match-chip { border-color: #b7dcc3; background: #fff; color: #1b5e3b; padding: 0.18rem 0.55rem; font-size: 0.75rem; font-weight: bold; }
    .match-more { color: #5d7166; font-size: 0.75rem; align-self: center; }
    .match-note { color: #6d756f; font-size: 0.75rem; line-height: 1.5; }
    .empty { padding: 2rem 1.5rem; color: #888; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
    @media (max-width: 700px) {
      .search-form { display: grid; grid-template-columns: 1fr auto; padding: 0.75rem; }
      .search-form input { width: 100%; max-width: none; min-width: 0; min-height: 44px; grid-column: 1 / -1; }
      .search-form button, .search-form a { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; }
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
${renderGlobalNav(isHome ? "/" : "/zoos")}
  ${isHome ? renderHomeOverview(activePref, count, totalAnimalCount, featuredZoos) : ""}
  ${isHome ? "" : `<form class="search-form" action="/zoos" method="get">
    <input type="search" name="animal" value="${escapedAnimal}" placeholder="動物名で検索（例: パンダ）" aria-label="動物名で検索">
    <button type="submit" class="ui-btn ui-btn--primary ui-touch-target">検索</button>
    ${animal ? `<a href="${buildBrowseUrl(activePref, null)}" class="ui-btn ui-btn--secondary ui-touch-target">クリア</a>` : ""}
  </form>`}
  ${isHome ? renderExploreCards(activePref, count, totalAnimalCount) : ""}
  ${isHome ? renderSpotlightSection(featuredAnimals, featuredZoos, activePref) : ""}
  ${
    isHome
      ? ""
      : `<p class="summary">${summary}</p>
  ${zooListHtml}`
  }
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
  <script src="/favorites.js" defer></script>
</body>
</html>`;
}

export function renderHomePage(
  results: ZooSearchResult[],
  activePref: PrefectureCode | null,
  featuredAnimals: FeaturedAnimal[] = []
): string {
  return renderHomeOrZoosPage(results, activePref, null, featuredAnimals, "home");
}

export function renderZoosPage(
  results: ZooSearchResult[],
  activePref: PrefectureCode | null,
  animal: string | null
): string {
  return renderHomeOrZoosPage(results, activePref, animal, [], "zoos");
}
