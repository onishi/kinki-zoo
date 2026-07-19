import type {
  AnimalImageVersionIndex,
  AnimalListItem,
  TaxonomyOverviewSection,
  TaxonomyPathLevel,
  TaxonomyTreeNode,
} from "../index";
import type { PrefectureCode } from "../types";
import { buildAnimalsUrl, renderAnimalCards } from "./animals";
import {
  COMMON_STYLES,
  PREF_LABELS,
  buildBrowseUrl,
  buildLegacyTaxonomyUrl,
  buildTaxonomyPathUrl,
  buildTaxonomyUrl,
  escapeHtml,
  renderGlobalNav,
  renderSiteHeader,
  renderStateMessage,
  renderTaxonomyBreadcrumb,
} from "./layout";

export function renderTaxonomyHtml(
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
            <a class="taxonomy-link ui-card-link ui-touch-target" href="${href}">
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
    .taxonomy-link { display: grid; gap: 0.2rem; padding: 0.65rem 0.75rem; }
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
          : renderStateMessage(
              "この地域には分類済みの動物がありません。",
              [
                { href: buildAnimalsUrl("unclassified"), label: "分類未設定の動物を見る" },
                { href: buildBrowseUrl(activePref, null), label: "動物園一覧へ戻る" },
              ]
            )
      }
    </section>
    <h2 class="rank-sections-title">ランク別一覧</h2>
    ${sectionHtml}
  </main>
  <footer>分類は利用者が探しやすい粒度で整理しています。最新情報は各施設の公式サイトでご確認ください。</footer>
</body>
</html>`;
}

export function renderTaxonomyDetailHtml(
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
    .summary { padding: 0.75rem 1.5rem; font-size: 0.9rem; color: #666; }
    .child-taxonomy { padding: 1rem 1.5rem; border-bottom: 1px solid #ddd; }
    .child-taxonomy h2 { font-size: 1.05rem; margin-bottom: 0.75rem; }
    .taxonomy-links { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 0.55rem; }
    .taxonomy-link { display: grid; gap: 0.2rem; padding: 0.65rem 0.75rem; }
    .taxonomy-link span { font-weight: bold; overflow-wrap: anywhere; }
    .taxonomy-link small { color: #617469; font-size: 0.75rem; }
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
      .summary, .child-taxonomy { padding-left: 0.75rem; padding-right: 0.75rem; }
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
      : renderStateMessage("該当する動物がありません。", [
          { href: "/taxonomy", label: "分類一覧へ戻る" },
          { href: buildAnimalsUrl("all"), label: "動物一覧を見る" },
        ])
  }
  <footer>分類は利用者が探しやすい粒度で整理しています。最新情報は各施設の公式サイトでご確認ください。</footer>
</body>
</html>`;
}
