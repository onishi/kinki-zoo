import type { PrefectureCode } from "../types";
import type { TaxonomyPathLevel, TaxonomyRank, ZooSearchResult } from "../index";

export const PREF_LABELS: Record<PrefectureCode, string> = {
  osaka: "大阪府",
  kyoto: "京都府",
  hyogo: "兵庫県",
  nara: "奈良県",
  shiga: "滋賀県",
  mie: "三重県",
  wakayama: "和歌山県",
};

export const PREF_CODES = Object.keys(PREF_LABELS) as PrefectureCode[];

export function isPrefectureCode(value: string): value is PrefectureCode {
  return PREF_CODES.includes(value as PrefectureCode);
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderFavoriteButton(
  type: "zoo" | "animal",
  id: string,
  label: string,
  href: string,
  variant: "icon" | "large" = "icon"
): string {
  const escId = escapeHtml(id);
  const escLabel = escapeHtml(label);
  const escHref = escapeHtml(href);
  const attrs = `data-fav-type="${type}" data-fav-id="${escId}" data-fav-name="${escLabel}" data-fav-href="${escHref}" aria-pressed="false"`;
  if (variant === "large") {
    return `<button type="button" class="fav-toggle fav-toggle--large ui-btn ui-btn--secondary ui-touch-target" ${attrs}><span class="fav-toggle-icon" aria-hidden="true">☆</span><span class="fav-toggle-text">お気に入りに追加</span></button>`;
  }
  return `<button type="button" class="fav-toggle fav-toggle--icon" ${attrs} aria-label="お気に入りに追加"><span class="fav-toggle-icon" aria-hidden="true">☆</span></button>`;
}

export function normalizeAnimalImageKey(value: string): string {
  return value.toLocaleLowerCase("ja-JP").replace(/[\s　]+/g, "");
}

export function renderMatchedValues(
  label: string,
  values: string[],
  linkBuilder?: (value: string) => string
): string {
  if (values.length === 0) return "";
  const visibleValues = values.slice(0, 8);
  const hiddenCount = values.length - visibleValues.length;
  const chips = visibleValues
    .map((value) => {
      const escapedValue = escapeHtml(value);
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

export function renderMatchSummary(result: ZooSearchResult): string {
  const animalMatches = renderMatchedValues(
    "ヒットした動物・分類",
    result.matchedAnimals,
    buildZooAnimalUrl
  );
  const featureMatches = renderMatchedValues("ヒットした施設情報", result.matchedFeatures);

  if (!animalMatches && !featureMatches) return "";

  return `<div class="match-box">${featureMatches}${animalMatches}</div>`;
}

export function renderZooCard(result: ZooSearchResult, includeMatchSummary: boolean): string {
  const zoo = result.zoo;
  const zooId = encodeURIComponent(zoo.id);
  const zooDomId = `zoo-${zoo.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const prefLabel = PREF_LABELS[zoo.prefecture];
  const wikiLink = zoo.wikipediaUrl
    ? `<a href="${escapeHtml(zoo.wikipediaUrl)}" target="_blank" rel="noopener noreferrer">Wikipedia</a>`
    : "";
  return `
    <tr id="${escapeHtml(zooDomId)}">
      <th scope="row" class="zoo-name">
        <div class="name-with-fav">
          <a href="/zoos/${zooId}">${escapeHtml(zoo.name)}</a>
          ${renderFavoriteButton("zoo", zoo.id, zoo.name, `/zoos/${zooId}`)}
        </div>
        <p class="kana">${escapeHtml(zoo.nameKana)}</p>
        <p class="zoo-name-links">
          <a href="${escapeHtml(zoo.website)}" target="_blank" rel="noopener noreferrer">公式サイト</a>
          ${wikiLink}
        </p>
      </th>
      <td data-label="都道府県">${prefLabel}</td>
      <td data-label="住所">${escapeHtml(zoo.address)}</td>
      <td data-label="動物種数">${result.animalCount > 0 ? `${result.animalCount} 種` : "未取得"}</td>
      <td data-label="基本情報">
        <ul class="meta-list">
          <li><b>開園時間:</b> ${escapeHtml(zoo.openingHours)}</li>
          <li><b>休園日:</b> ${escapeHtml(zoo.closedDays)}</li>
          <li><b>入園料:</b> ${escapeHtml(zoo.admission)}</li>
        </ul>
      </td>
      ${includeMatchSummary ? `<td data-label="検索ヒット">${renderMatchSummary(result)}</td>` : ""}
    </tr>`;
}

export function buildBrowseUrl(pref: PrefectureCode | null, animal: string | null): string {
  const params = new URLSearchParams();
  if (pref) params.set("pref", pref);
  if (animal) params.set("animal", animal);
  const query = params.toString();
  return query ? `/zoos?${query}` : "/zoos";
}

export function buildMapUrl(pref: PrefectureCode | null, animal: string | null, taxClass?: string | null): string {
  const params = new URLSearchParams();
  if (pref) params.set("pref", pref);
  if (animal) params.set("animal", animal);
  if (taxClass) params.set("cls", taxClass);
  const query = params.toString();
  return query ? `/map?${query}` : "/map";
}

export function buildAnimalSearchUrl(animal: string): string {
  const params = new URLSearchParams({ animal });
  return `/zoos?${params.toString()}`;
}

export function buildZooAnimalUrl(displayName: string): string {
  return `/animal/${encodeURIComponent(displayName)}`;
}

export function buildJapaneseWikipediaUrl(title: string): string {
  return `https://ja.wikipedia.org/wiki/${encodeURIComponent(title)}`;
}

export function buildTaxonomyPathUrl(values: string[]): string {
  return `/taxonomy/${values.map((value) => encodeURIComponent(value)).join("/")}`;
}

export function buildLegacyTaxonomyUrl(rank: TaxonomyRank, value: string): string {
  return `/taxonomy/${rank}/${encodeURIComponent(value)}`;
}

// Query parameters that contribute to page content and belong in the canonical URL.
export const CANONICAL_SEARCH_PARAMS = new Set(["animal", "filter", "cls", "a", "b", "c"]);

export function buildCanonicalUrl(url: URL): string {
  const canonical = new URLSearchParams();
  for (const key of CANONICAL_SEARCH_PARAMS) {
    const value = url.searchParams.get(key);
    if (value !== null) {
      canonical.set(key, value);
    }
  }
  const query = canonical.toString();
  return `${url.origin}${url.pathname}${query ? `?${query}` : ""}`;
}

export function buildTaxonomyUrl(levels: TaxonomyPathLevel[], value: string): string {
  return buildTaxonomyPathUrl([...levels.map((level) => level.value), value]);
}

export function renderTaxonomyValueLink(value: string, pathValues: string[] | null): string {
  const label = escapeHtml(value);
  return pathValues
    ? `<a href="${buildTaxonomyPathUrl(pathValues)}">${label}</a>`
    : label;
}

export function buildTaxonomyDisplayParts(values: Array<[string, string | undefined]>): Array<{
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

export function addPrefectureToInternalUrl(href: string, pref: PrefectureCode | null): string {
  if (!pref || !href.startsWith("/") || href.startsWith("//")) return href;
  const parsed = new URL(href, "https://kinki-zoo.invalid");
  if (!parsed.searchParams.has("pref")) {
    parsed.searchParams.set("pref", pref);
  }
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function renderPrefectureSelector(url: URL, activePref: PrefectureCode | null): string {
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

  return `<form class="pref-selector" action="${escapeHtml(url.pathname)}" method="get">
    ${hiddenInputs}
    <label for="prefecture-select">地域</label>
    <select id="prefecture-select" name="pref" onchange="this.form.submit()">${options}</select>
    <noscript><button type="submit">表示</button></noscript>
  </form>`;
}

export function getHeaderSearchValue(url: URL): string {
  return url.searchParams.get("q") ?? url.searchParams.get("animal") ?? "";
}

export function renderHeaderSearch(url: URL, activePref: PrefectureCode | null): string {
  const value = getHeaderSearchValue(url);
  const prefInput = activePref
    ? `<input type="hidden" name="pref" value="${escapeHtml(activePref)}">`
    : "";
  return `<form class="header-search" action="/search" method="get" role="search">
    ${prefInput}
    <label for="header-search-input">サイト内検索</label>
    <input id="header-search-input" type="search" name="q" value="${escapeHtml(value)}" placeholder="動物・動物園を検索" autocomplete="off">
    <button type="submit">検索</button>
  </form>`;
}

export function renderBreadcrumb(crumbs: Array<{ href?: string; label: string }>): string {
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

export function renderStateMessage(
  message: string,
  actions: Array<{ href: string; label: string; external?: boolean }> = [],
  tone: "empty" | "error" = "empty"
): string {
  const links = actions
    .map((action) => {
      const extraAttrs = action.external ? ` target="_blank" rel="noopener noreferrer"` : "";
      const buttonClass = tone === "error" ? "ui-btn--primary" : "ui-btn--secondary";
      return `<a href="${escapeHtml(action.href)}" class="ui-btn ${buttonClass} ui-touch-target"${extraAttrs}>${escapeHtml(action.label)}</a>`;
    })
    .join("");
  const linksHtml = links ? `<div class="ui-state-actions">${links}</div>` : "";
  return `<section class="ui-state${tone === "error" ? " ui-state--error" : ""}" role="${tone === "error" ? "alert" : "status"}">
    <p class="ui-state-message">${escapeHtml(message)}</p>
    ${linksHtml}
  </section>`;
}

export function renderTaxonomyBreadcrumb(levels: TaxonomyPathLevel[]): string {
  return renderBreadcrumb([
    { href: "/taxonomy", label: "分類一覧" },
    ...levels.map((level, index) => ({
      href:
        index === levels.length - 1
          ? undefined
          : buildTaxonomyPathUrl(levels.slice(0, index + 1).map((item) => item.value)),
      label: `${level.rank.label}: ${level.value}`,
    })),
  ]);
}

export function renderPrefTab(
  code: PrefectureCode,
  label: string,
  active: boolean,
  animal: string | null
): string {
  const cls = active ? 'class="tab active"' : 'class="tab"';
  return `<a href="${buildBrowseUrl(code, animal)}" ${cls}>${label}</a>`;
}

export const COMMON_STYLES = `
    html { -webkit-text-size-adjust: 100%; }
    body { min-width: 0; overflow-wrap: anywhere; }
    img, svg { max-width: 100%; }
    button, input, select { font: inherit; }
    .ui-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; border: 1px solid #1f5b45; padding: 0.45rem 0.8rem; text-decoration: none; }
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
    .ui-touch-target { min-height: 40px; }
    .fav-toggle { border: 1px solid #d8c98a; background: #fff; color: #b8930b; cursor: pointer; }
    .fav-toggle:disabled { opacity: 0.4; cursor: not-allowed; }
    .fav-toggle--icon { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 1.9rem; height: 1.9rem; padding: 0; font-size: 1.05rem; border-radius: 4px; margin-left: auto; }
    .fav-toggle--icon[aria-pressed="true"] { background: #fdf6e0; }
    .fav-toggle--large { display: inline-flex; align-items: center; gap: 0.35rem; }
    .fav-toggle--large[aria-pressed="true"] { background: #fdf6e0; }
    .fav-toggle-icon { color: #d9a900; }
    .name-with-fav { display: flex; align-items: center; gap: 0.4rem; }
    .site-header { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem 2rem; padding: 1rem 1.5rem; border-bottom: 1px solid #ddd; }
    .site-heading { flex: 1 1 320px; min-width: 0; }
    .site-header h1 { font-size: 1.5rem; }
    .site-header h1 a { color: inherit; text-decoration: none; }
    .site-header p { font-size: 0.9rem; color: #555; margin-top: 0.25rem; }
    .header-search { display: flex; flex: 1 1 300px; max-width: 460px; align-items: center; gap: 0.4rem; }
    .header-search label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    .header-search input { flex: 1 1 auto; min-width: 0; min-height: 40px; border: 1px solid #aaa; background: #fff; padding: 0.5rem 0.65rem; font-size: 0.9rem; }
    .header-search button { flex: 0 0 auto; min-height: 40px; border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.45rem 0.75rem; font-size: 0.86rem; cursor: pointer; }
    .header-search button:hover { background: #184a38; border-color: #184a38; }
    .pref-selector { display: flex; align-items: center; gap: 0.5rem; }
    .pref-selector label { color: #555; font-size: 0.82rem; font-weight: bold; }
    .pref-selector select { min-width: 9rem; border: 1px solid #aaa; background: #fff; padding: 0.45rem 2rem 0.45rem 0.6rem; font: inherit; }
    .pref-selector button { border: 1px solid #1f5b45; background: #fff; color: #1f5b45; padding: 0.4rem 0.65rem; }
    .global-nav { display: flex; flex-wrap: wrap; gap: 1rem; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; }
    .global-nav a { color: #1f5b45; text-decoration: none; font-size: 0.9rem; }
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
      .site-header { display: grid; gap: 0.75rem; padding: 0.75rem; }
      .site-heading { width: 100%; }
      .site-header h1 { font-size: 1.2rem; line-height: 1.35; }
      .site-header p { font-size: 0.78rem; line-height: 1.45; }
      .header-search { width: 100%; max-width: none; }
      .header-search input, .header-search button { min-height: 44px; }
      .pref-selector { width: 100%; }
      .pref-selector label { flex: 0 0 auto; }
      .pref-selector select { flex: 1 1 auto; min-width: 0; min-height: 44px; }
      .pref-selector button { min-height: 44px; }
      .global-nav { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0; padding: 0; }
      .global-nav a { display: flex; min-width: 0; min-height: 44px; align-items: center; justify-content: center; padding: 0.55rem 0.35rem; border-right: 1px solid #eee; border-bottom: 1px solid #eee; text-align: center; font-size: 0.82rem; }
      .global-nav a:nth-child(2n) { border-right: 0; }
      .breadcrumb ol { padding: 0.6rem 0.75rem; }
      .page-nav { gap: 0.5rem; }
      .page-nav a { display: inline-flex; align-items: center; min-height: 44px; }
      .ui-state { margin: 0.75rem; padding: 0.85rem; }
    }`;

export function renderSiteHeader(): string {
  return `  <header class="site-header">
    <div class="site-heading">
      <h1><a href="/">近畿動物園情報</a></h1>
      <p>近畿一円の動物園・施設をまとめて調べられます</p>
    </div>
  </header>`;
}

export function renderGlobalNav(activePath: string): string {
  const navItems: [string, string][] = [
    ["/", "トップ"],
    ["/search", "検索"],
    ["/zoos", "動物園一覧"],
    ["/animals", "動物一覧"],
    ["/taxonomy", "分類から探す"],
    ["/map", "地図で見る"],
    ["/compare", "動物園を比較"],
    ["/favorites", "お気に入り"],
    ["/admin", "動物管理"],
  ];
  const links = navItems
    .map(([href, label], i) => {
      const isActive = href === "/" ? activePath === "/" : activePath === href || activePath.startsWith(`${href}/`);
      const cls = i === navItems.length - 1 ? ' class="nav-admin"' : "";
      return `<a href="${href}"${cls}${isActive ? ' aria-current="page"' : ""}>${label}</a>`;
    })
    .join("\n    ");
  return `  <nav class="global-nav" aria-label="サイトナビゲーション">
    ${links}
  </nav>`;
}

export function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("ja-JP") : "-";
}

export function buildAnimalImageManageUrl(displayName: string): string {
  return `/admin/animal-images/manage/${encodeURIComponent(displayName)}`;
}

export function buildAnimalImageItemId(animalKey: string): string {
  return `animal-image-${encodeURIComponent(animalKey).replace(/%/g, "")}`;
}

export function buildAnimalImageUrl(displayName: string, version?: number | null): string {
  const url = `/animal-images/${encodeURIComponent(displayName)}`;
  return version ? `${url}?v=${encodeURIComponent(String(version))}` : url;
}

export const ADMIN_BREADCRUMB_CSS = `
    .admin-breadcrumb { display: flex; align-items: center; flex-wrap: wrap; gap: 0.2rem; font-size: 0.8rem; color: #aaa; }
    .admin-breadcrumb a { color: #1f5b45; text-decoration: none; }
    .admin-breadcrumb a:hover { text-decoration: underline; }
    .admin-breadcrumb .sep { margin: 0 0.15rem; }
    .admin-breadcrumb [aria-current] { color: #555; }`;

export function renderAdminBreadcrumb(crumbs: { href?: string; label: string }[]): string {
  const all = [{ href: "/admin" as string | undefined, label: "動物管理" }, ...crumbs];
  const parts = all.map((c, i) => {
    const isLast = i === all.length - 1;
    const el = isLast
      ? `<span aria-current="page">${escapeHtml(c.label)}</span>`
      : `<a href="${c.href}">${escapeHtml(c.label)}</a>`;
    return i < all.length - 1 ? `${el}<span class="sep">/</span>` : el;
  });
  return `<nav class="admin-breadcrumb" aria-label="管理パンくず">${parts.join("")}</nav>`;
}
