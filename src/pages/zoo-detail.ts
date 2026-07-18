import type { AnimalImageVersionIndex, ZooCoverageStats } from "../index";
import type { Zoo } from "../types";
import type { ScrapeResult } from "../scraper";
import {
  COMMON_STYLES,
  PREF_LABELS,
  buildAnimalImageUrl,
  buildBrowseUrl,
  buildMapUrl,
  buildZooAnimalUrl,
  escapeHtml,
  normalizeAnimalImageKey,
  renderBreadcrumb,
  renderFavoriteButton,
  renderGlobalNav,
  renderSiteHeader,
  renderStateMessage,
} from "./layout";

export function renderZooDetailHtml(
  zoo: Zoo,
  scraped: ScrapeResult,
  coverage: ZooCoverageStats,
  imageKeys: AnimalImageVersionIndex = new Map(),
  taxonomyByAnimal: Map<string, string> = new Map()
): string {
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
                  <span>${escapeHtml(animal)}</span>
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
        : `<span class="animal-thumb ui-thumb ui-thumb--36"></span>`;
      return `<li data-class="${escapeHtml(className)}"><a href="${buildZooAnimalUrl(animal)}">${thumb}<span>${escapeHtml(animal)}</span><small>${escapeHtml(className)}</small></a></li>`;
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
          <a class="primary-link ui-btn ui-btn--primary ui-touch-target" href="${escapeHtml(zoo.website)}" target="_blank" rel="noopener noreferrer">公式サイトを見る</a>
          <a class="secondary-link ui-btn ui-btn--secondary ui-touch-target" href="${buildMapUrl(zoo.prefecture, null)}#zoo-${escapeHtml(zoo.id)}">地図で見る</a>
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
  <script src="/favorites.js" defer></script>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
    var filterButtons = document.querySelectorAll('[data-class-filter]');
    var animalItems = document.querySelectorAll('#zoo-animal-list li[data-class]');
    filterButtons.forEach(function(button) {
      button.addEventListener('click', function() {
        var active = button.dataset.classFilter;
        filterButtons.forEach(function(item) {
          var isCurrent = item === button;
          item.classList.toggle('ui-chip--active', isCurrent);
          item.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
        });
        animalItems.forEach(function(item) {
          item.classList.toggle('is-hidden', active !== 'all' && item.dataset.class !== active);
        });
      });
    });

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
