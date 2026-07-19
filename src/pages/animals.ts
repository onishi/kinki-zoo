import type { AnimalImageVersionIndex, AnimalListFilter, AnimalListItem } from "../index";
import type { PrefectureCode } from "../types";
import {
  COMMON_STYLES,
  PREF_LABELS,
  buildAnimalImageUrl,
  buildAnimalSearchUrl,
  buildBrowseUrl,
  buildMapUrl,
  buildTaxonomyDisplayParts,
  buildZooAnimalUrl,
  escapeHtml,
  normalizeAnimalImageKey,
  renderFavoriteButton,
  renderGlobalNav,
  renderSiteHeader,
  renderStateMessage,
  renderTaxonomyValueLink,
} from "./layout";

export function buildAnimalsUrl(filter: AnimalListFilter, query: string | null = null): string {
  const params = new URLSearchParams();
  if (filter === "unclassified") params.set("filter", "unclassified");
  if (query) params.set("q", query);
  const serialized = params.toString();
  return serialized ? `/animals?${serialized}` : "/animals";
}

export function renderAnimalsHtml(
  animals: AnimalListItem[],
  filter: AnimalListFilter,
  activePref: PrefectureCode | null,
  imageKeys: AnimalImageVersionIndex = new Map(),
  query: string | null = null
): string {
  const items = renderAnimalCards(animals, imageKeys);
  const prefLabel = activePref ? PREF_LABELS[activePref] : "近畿一円";
  const escapedQuery = escapeHtml(query ?? "");
  const summary =
    query
      ? `${prefLabel}で「${escapedQuery}」に一致する動物: ${animals.length} 件`
      : filter === "unclassified"
      ? `${prefLabel}の分類未設定: ${animals.length} 件`
      : `${prefLabel}の登録動物: ${animals.length} 件`;

  const emptyMessage =
    animals.length === 0
      ? query
        ? renderStateMessage(`「${query}」に該当する動物が見つかりませんでした。`, [
            { href: buildAnimalsUrl("all"), label: "検索をクリア" },
            { href: "/search", label: "横断検索" },
            { href: "/taxonomy", label: "分類から探す" },
          ])
        : filter === "unclassified"
        ? renderStateMessage("分類未設定の動物はありません。", [
            { href: buildAnimalsUrl("all", query), label: "すべての動物を見る" },
            { href: "/taxonomy", label: "分類から探す" },
          ])
        : renderStateMessage(
            "動物データがまだありません。動物園一覧から気になる施設を開き、掲載動物をご確認ください。",
            [
              { href: buildBrowseUrl(activePref, null), label: "動物園一覧へ戻る" },
              { href: buildMapUrl(activePref, null), label: "地図で見る" },
            ]
          )
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
      .animal-search-form { display: grid; grid-template-columns: 1fr; padding: 0.65rem 0.75rem; }
      .animal-search-form input, .animal-search-form button, .animal-search-form a { max-width: none; min-height: 44px; }
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
    <a href="${buildAnimalsUrl("all", query)}" class="tab${filter === "all" ? " active" : ""}">すべて</a>
    <a href="${buildAnimalsUrl("unclassified", query)}" class="tab${filter === "unclassified" ? " active" : ""}">分類未設定</a>
  </nav>
  <form class="animal-search-form" action="/animals" method="get">
    ${filter === "unclassified" ? `<input type="hidden" name="filter" value="unclassified">` : ""}
    <input type="search" name="q" value="${escapedQuery}" placeholder="動物名・分類・施設名で検索" aria-label="動物を検索">
    <button type="submit" class="ui-btn ui-btn--primary ui-touch-target">検索</button>
    ${query ? `<a href="${buildAnimalsUrl(filter)}" class="ui-btn ui-btn--secondary ui-touch-target">クリア</a>` : ""}
  </form>
  <p class="summary">${summary}</p>
  ${animalListHtml}
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
  <script src="/favorites.js" defer></script>
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

export function renderAnimalCards(animals: AnimalListItem[], imageKeys: AnimalImageVersionIndex = new Map()): string {
  return animals
    .map((item) => {
      const zooLinks = item.zoos
        .map((zoo) => `<a class="ui-chip" href="/zoos/${encodeURIComponent(zoo.id)}">${escapeHtml(zoo.name)}</a>`)
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
        ? `<img src="${buildAnimalImageUrl(imageDisplayName, imageVersion)}" alt="" class="animal-thumb ui-thumb ui-thumb--36" loading="lazy" width="36" height="36">`
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
          <th scope="row" class="animal-name">${thumbHtml}<a href="${escapeHtml(titleHref)}">${title}</a>${renderFavoriteButton("animal", searchName, item.canonicalName ?? primaryDisplayName, titleHref)}</th>
          <td data-label="分類">${taxonomyRow}</td>
          <td data-label="施設数"><span class="facility-count">${item.zoos.length}</span></td>
          <td data-label="施設一覧"><div class="zoo-links">${zooLinks}</div></td>
        </tr>`;
    })
    .join("\n");
}
