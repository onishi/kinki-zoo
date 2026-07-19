import type { AnimalImageVersionIndex, SiteSearchResults, TaxonomySearchResult } from "../index";
import type { AnimalListItem } from "../index";
import type { PrefectureCode } from "../types";
import {
  COMMON_STYLES,
  PREF_LABELS,
  buildAnimalImageUrl,
  buildBrowseUrl,
  buildMapUrl,
  buildZooAnimalUrl,
  escapeHtml,
  normalizeAnimalImageKey,
  renderFavoriteButton,
  renderGlobalNav,
  renderSiteHeader,
  renderStateMessage,
  renderZooCard,
} from "./layout";

export function renderSearchAnimalCards(
  animals: AnimalListItem[],
  imageKeys: AnimalImageVersionIndex
): string {
  return animals
    .map((item) => {
      const primaryDisplayName = item.displayNames[0] ?? item.canonicalName ?? "";
      const title = item.canonicalName ?? primaryDisplayName;
      const imageDisplayName = item.displayNames.find((name) => imageKeys.has(normalizeAnimalImageKey(name)));
      const imageVersion = imageDisplayName ? imageKeys.get(normalizeAnimalImageKey(imageDisplayName)) : null;
      const thumb = imageDisplayName
        ? `<img src="${buildAnimalImageUrl(imageDisplayName, imageVersion)}" alt="" class="search-animal-thumb ui-thumb" loading="lazy" width="56" height="56">`
        : `<span class="search-animal-thumb search-animal-thumb--empty" aria-hidden="true"></span>`;
      const taxonomy = [item.className, item.orderName, item.familyName].filter(Boolean).join(" / ");
      const aliases = item.displayNames.filter((name) => name !== title).slice(0, 3);
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
                ${primaryDisplayName && title !== primaryDisplayName ? `<small>${escapeHtml(primaryDisplayName)}</small>` : ""}
              </span>
            </a>
            ${renderFavoriteButton("animal", title, title, buildZooAnimalUrl(primaryDisplayName))}
          </div>
          ${taxonomy ? `<p class="search-taxonomy">${escapeHtml(taxonomy)}</p>` : `<p class="search-taxonomy">分類未設定</p>`}
          ${aliasText}
          <div class="search-zoo-links" aria-label="見られる施設">${zooLinks}${moreZoos}</div>
        </article>`;
    })
    .join("");
}

export function renderSearchTaxonomyCards(taxonomies: TaxonomySearchResult[]): string {
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

export function renderSearchHtml(
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
    ? `<a href="/taxonomy" class="section-link">分類一覧へ →</a>`
    : "";
  const emptyHtml = !hasQuery
    ? renderStateMessage("動物名、施設名、分類名で検索できます。", [
        { href: "/animals", label: "動物一覧" },
        { href: buildBrowseUrl(activePref, null), label: "動物園一覧" },
      ])
    : !hasResults
      ? renderStateMessage(`「${query}」に該当する動物・施設が見つかりませんでした。`, [
          { href: "/animals", label: "動物一覧" },
          { href: "/taxonomy", label: "分類から探す" },
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
    .search-animal-thumb { width: 56px; height: 56px; object-fit: cover; background: #f0f0f0; }
    .search-animal-thumb--empty { display: block; border: 1px solid #e1e1e1; }
    .search-taxonomy, .search-alias { color: #555; font-size: 0.8rem; line-height: 1.45; }
    .search-zoo-links { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .search-zoo-links a { font-size: 0.76rem; }
    .search-more { color: #66756b; font-size: 0.76rem; align-self: center; }
    .search-taxonomy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.6rem; }
    .search-taxonomy-card { display: grid; gap: 0.2rem; padding: 0.65rem 0.75rem; }
    .search-taxonomy-card span { font-weight: bold; overflow-wrap: anywhere; }
    .search-taxonomy-card small { color: #617469; font-size: 0.75rem; }
    .zoo-list { overflow-x: auto; }
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
      .zoo-table tr { margin-bottom: 0.75rem; border: 1px solid #d8ddd9; }
      .zoo-table th, .zoo-table td { border: 0; border-bottom: 1px solid #e5e8e6; padding: 0.7rem 0.75rem; }
      .zoo-table tr > :last-child { border-bottom: 0; }
      .zoo-table td::before { content: attr(data-label); display: block; margin-bottom: 0.35rem; color: #6a746d; font-size: 0.7rem; font-weight: bold; }
      .zoo-name { background: #f7faf8; }
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
      <button type="submit" class="ui-btn ui-btn--primary ui-touch-target">検索</button>
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
            <th scope="col">住所</th>
            <th scope="col">動物種数</th>
            <th scope="col">基本情報</th>
            <th scope="col">検索ヒット</th>
          </tr>
        </thead>
        <tbody>${zooRows}</tbody>
      </table></div>
    </section>` : ""}
  </main>
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
  <script src="/favorites.js" defer></script>
</body>
</html>`;
}
