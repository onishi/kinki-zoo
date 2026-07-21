import type {
  AnimalImageRecord,
  AnimalImageVersionIndex,
  AnimalListItem,
  ZooAnimalDetail,
} from "../index";
import type { Zoo } from "../types";
import {
  COMMON_STYLES,
  PREF_LABELS,
  buildAnimalImageManageUrl,
  buildAnimalImageUrl,
  buildJapaneseWikipediaUrl,
  buildTaxonomyDisplayParts,
  buildTaxonomyPathUrl,
  buildZooAnimalUrl,
  escapeHtml,
  normalizeAnimalImageKey,
  renderBreadcrumb,
  renderFavoriteButton,
  renderGlobalNav,
  renderSiteHeader,
  renderTaxonomyValueLink,
} from "./layout";

export function renderZooAnimalDetailHtml(
  detail: ZooAnimalDetail,
  notice?: string,
  image?: AnimalImageRecord,
  relatedAnimals: AnimalListItem[] = [],
  relatedDisplayNames: Array<{ displayName: string; zoos: Zoo[] }> = [],
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
  const breadcrumb = renderBreadcrumb([
    { href: "/animals", label: "動物一覧" },
    ...(detail.className ? [{ href: buildTaxonomyPathUrl([detail.className]), label: detail.className }] : []),
    { label: detail.displayName },
  ]);
  const taxonomyHtml = taxonomyDetails
    ? `<dl class="taxonomy-details">${taxonomyDetails}</dl>`
    : `<p class="unclassified">分類未設定</p>`;
  const canonicalHtml =
    detail.canonicalName && detail.canonicalName !== detail.displayName
      ? `<p class="canonical">分類マスタ: ${escapeHtml(detail.canonicalName)}</p>`
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

  const imageHtml = image
    ? `<img src="${buildAnimalImageUrl(detail.displayName, image.selectedGenerationId)}" alt="${escapedDisplayName}" class="animal-image" width="320" height="320">`
    : `<div class="animal-image animal-image--empty">
        <span>画像未生成</span>
        <a href="${buildAnimalImageManageUrl(detail.displayName)}">画像管理で生成</a>
      </div>`;

  const relatedDisplaySection = relatedDisplayNames.length > 0 ? `
    <section>
      <h2>同じ動物の施設表示名</h2>
      <div class="alias-list">
        ${relatedDisplayNames
          .map((item) => {
            const zooLabels = item.zoos.map((zoo) => escapeHtml(zoo.name)).join("、");
            return `<a href="${buildZooAnimalUrl(item.displayName)}" class="alias-card ui-card-link ui-touch-target">
              <span>${escapeHtml(item.displayName)}</span>
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
      : `<div class="related-thumb related-thumb--empty"></div>`;
    const label = item.canonicalName ?? name;
    const taxonomy = [item.className, item.orderName, item.familyName].filter(Boolean).join(" / ");
    const visibleZoos = item.zoos.slice(0, 2);
    const zooChips = visibleZoos
      .map((zoo: Zoo) => `<a class="ui-chip" href="/zoos/${encodeURIComponent(zoo.id)}">${escapeHtml(zoo.name)}</a>`)
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
    .animal-image { display: block; width: 100%; max-width: 320px; aspect-ratio: 1; height: auto; object-fit: cover; background: #f7f7f7; border: 1px solid #e1e1e1; flex-shrink: 0; }
    .animal-image--empty { display: grid; place-items: center; align-content: center; gap: 0.5rem; color: #777; font-size: 0.9rem; }
    .animal-image--empty a { color: #1f5b45; font-size: 0.82rem; }
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
    .alias-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.55rem; }
    .alias-card { display: grid; gap: 0.25rem; padding: 0.65rem 0.75rem; }
    .alias-card span { font-weight: bold; overflow-wrap: anywhere; }
    .alias-card small { color: #777; font-size: 0.76rem; line-height: 1.45; }
    .related-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 0.7rem; }
    .related-card { display: grid; gap: 0.35rem; padding: 0.55rem; min-width: 0; }
    .related-card-main { display: grid; gap: 0.35rem; color: inherit; text-decoration: none; }
    .related-thumb { display: block; width: 100%; aspect-ratio: 1; height: auto; object-fit: cover; background: #f7f7f7; }
    .related-thumb--empty { background: #f0f0f0; }
    .related-name { font-size: 0.82rem; font-weight: bold; line-height: 1.35; overflow-wrap: anywhere; }
    .related-taxonomy { color: #777; font-size: 0.72rem; line-height: 1.35; }
    .related-zoo-links { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
    .related-zoo-links a { font-size: 0.7rem; padding: 0.15rem 0.4rem; }
    .related-more-zoos { color: #999; font-size: 0.68rem; }
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
            detail.canonicalName ?? detail.displayName,
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
    ${relatedDisplaySection}
    ${relatedSection}
  </main>
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
  <script src="/favorites.js" defer></script>
</body>
</html>`;
}
