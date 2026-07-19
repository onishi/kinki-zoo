import { zoos } from "../data";
import type { Zoo } from "../types";
import {
  COMMON_STYLES,
  escapeHtml,
  renderGlobalNav,
  renderSiteHeader,
} from "./layout";

interface CompareAnimalRow {
  display_name: string;
  class_name: string | null;
  order_name: string | null;
}

interface TaxonomyCountRow {
  zoo_id: string;
  cls: string | null;
  ord: string | null;
  cnt: number;
}

export const CLASS_SORT_ORDER = ["哺乳類", "鳥類", "爬虫類", "両生類", "魚類", "軟骨魚類", "無脊椎動物"];

export function renderCompareIndexHtml(countRows: TaxonomyCountRow[], animalCounts: Map<string, number>): string {
  // Build lookup: zooId -> className -> orderName -> count
  const lookup = new Map<string, Map<string, Map<string, number>>>();
  const classOrderMap = new Map<string, Set<string>>();

  for (const row of countRows) {
    const cls = row.cls ?? "未分類";
    const ord = row.ord ?? "不明";
    if (!lookup.has(row.zoo_id)) lookup.set(row.zoo_id, new Map());
    const byClass = lookup.get(row.zoo_id)!;
    if (!byClass.has(cls)) byClass.set(cls, new Map());
    byClass.get(cls)!.set(ord, row.cnt);
    if (!classOrderMap.has(cls)) classOrderMap.set(cls, new Set());
    classOrderMap.get(cls)!.add(ord);
  }

  const sortedClasses = [...classOrderMap.keys()].sort((a, b) => {
    const ia = CLASS_SORT_ORDER.indexOf(a), ib = CLASS_SORT_ORDER.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a === "未分類" ? 1 : b === "未分類" ? -1 : a.localeCompare(b, "ja");
  });

  const sortedZoos = [...zoos].sort((a, b) => (animalCounts.get(b.id) ?? 0) - (animalCounts.get(a.id) ?? 0));

  const headerCells = sortedZoos
    .map(
      (zoo) => `<th class="zoo-head" scope="col">
        <label class="zoo-label">
          <input type="checkbox" class="zoo-check" value="${escapeHtml(zoo.id)}" data-name="${escapeHtml(zoo.name)}">
          <span class="zoo-name">${escapeHtml(zoo.name)}</span>
          <span class="zoo-cnt">${animalCounts.get(zoo.id) ?? 0}種</span>
        </label>
      </th>`
    )
    .join("");

  const tableRows = sortedClasses
    .flatMap((cls) => {
      const orders = [...classOrderMap.get(cls)!].sort((a, b) =>
        a === "不明" ? 1 : b === "不明" ? -1 : a.localeCompare(b, "ja")
      );
      const classCells = sortedZoos
        .map((zoo) => {
          const byClass = lookup.get(zoo.id)?.get(cls);
          const total = byClass ? [...byClass.values()].reduce((s, v) => s + v, 0) : 0;
          return `<td class="cnt-cell cnt-class">${total || ""}</td>`;
        })
        .join("");
      const classRow = `<tr class="class-row"><th class="tax-cell class-cell" scope="row">${escapeHtml(cls)}</th>${classCells}</tr>`;
      const orderRows = orders
        .map((ord) => {
          const cells = sortedZoos
            .map((zoo) => {
              const cnt = lookup.get(zoo.id)?.get(cls)?.get(ord) ?? 0;
              return `<td class="cnt-cell">${cnt || ""}</td>`;
            })
            .join("");
          return `<tr class="order-row"><th class="tax-cell order-cell" scope="row">${escapeHtml(ord)}</th>${cells}</tr>`;
        })
        .join("");
      return classRow + orderRows;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>動物園を比較 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1.25rem 1.5rem 5rem; display: grid; gap: 1.25rem; }
    h1 { font-size: 1.15rem; }
    .table-wrap { overflow-x: auto; border: 1px solid #ddd; }
    .pivot-table { border-collapse: separate; border-spacing: 0; font-size: 0.8rem; border: 1px solid #ddd; }
    .pivot-table th, .pivot-table td { border-right: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8; }
    .zoo-head { position: sticky; top: 0; background: #fff; z-index: 2; min-width: 72px; vertical-align: bottom; padding: 0.4rem 0.35rem; border-bottom: 2px solid #ccc !important; text-align: center; }
    .tax-head { position: sticky; top: 0; left: 0; background: #fff; z-index: 3; padding: 0.4rem 0.6rem; border-bottom: 2px solid #ccc !important; border-right: 2px solid #ccc !important; font-size: 0.75rem; color: #888; min-width: 100px; }
    .zoo-label { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; cursor: pointer; }
    .zoo-check { width: 15px; height: 15px; cursor: pointer; accent-color: #1f5b45; }
    .zoo-name { font-size: 0.72rem; line-height: 1.3; word-break: break-all; color: #333; }
    .zoo-cnt { font-size: 0.68rem; color: #888; }
    .zoo-head.is-checked { background: #f0fbf4; }
    .zoo-head.is-checked .zoo-name { color: #1f5b45; font-weight: bold; }
    .tax-cell { position: sticky; left: 0; background: #fff; z-index: 1; white-space: nowrap; padding: 0.25rem 0.6rem; border-right: 2px solid #ddd !important; font-weight: normal; text-align: left; }
    .class-cell { background: #f5f5f5 !important; font-weight: bold; font-size: 0.8rem; color: #333; border-top: 2px solid #ccc !important; }
    .order-cell { font-size: 0.75rem; color: #555; padding-left: 1.2rem; }
    .cnt-cell { text-align: center; padding: 0.22rem 0.4rem; color: #444; min-width: 44px; }
    .cnt-class { background: #f9f9f9; font-weight: bold; color: #333; border-top: 2px solid #ccc !important; }
    .cnt-cell.is-checked-a { background: #e8f5ee; }
    .cnt-cell.is-checked-b { background: #e8f5ee; }
    .compare-bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1f5b45; color: #fff; padding: 0.75rem 1.5rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; z-index: 100; box-shadow: 0 -2px 8px rgba(0,0,0,0.15); }
    .compare-bar-text { flex: 1; font-size: 0.88rem; }
    .compare-go { border: 2px solid #fff; background: #fff; color: #1f5b45; padding: 0.4rem 1rem; cursor: pointer; font-size: 0.88rem; font-weight: bold; }
    .compare-go:disabled { opacity: 0.5; cursor: default; }
    .compare-clear { border: 1px solid rgba(255,255,255,0.5); background: transparent; color: #fff; padding: 0.4rem 0.75rem; cursor: pointer; font-size: 0.82rem; }
    @media (max-width: 640px) {
      main { padding: 0.75rem 0.5rem 5rem; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/compare")}
  <main>
    <h1>動物園を比較 <span style="font-size:0.82rem;font-weight:normal;color:#888">2〜3つ選んで比較できます</span></h1>
    <div class="table-wrap">
      <table class="pivot-table">
        <thead>
          <tr>
            <th class="tax-head" scope="col">分類</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </main>
  <div class="compare-bar" id="compare-bar" hidden>
    <span class="compare-bar-text" id="compare-bar-text"></span>
    <button class="compare-go" id="compare-go" disabled>比較する</button>
    <button class="compare-clear" id="compare-clear">クリア</button>
  </div>
  <script>
    var checked = [];
    var bar = document.getElementById('compare-bar');
    var barText = document.getElementById('compare-bar-text');
    var goBtn = document.getElementById('compare-go');
    var clearBtn = document.getElementById('compare-clear');

    function colIndex(zooId) {
      var heads = document.querySelectorAll('.zoo-head');
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].querySelector('.zoo-check').value === zooId) return i + 2;
      }
      return -1;
    }

    function updateHighlight() {
      document.querySelectorAll('.zoo-head').forEach(function(th) {
        th.classList.toggle('is-checked', checked.some(function(c) { return c.id === th.querySelector('.zoo-check').value; }));
      });
      document.querySelectorAll('.cnt-cell').forEach(function(td) { td.classList.remove('is-checked-a', 'is-checked-b'); });
      checked.forEach(function(c, i) {
        var idx = colIndex(c.id);
        document.querySelectorAll('.pivot-table tbody tr').forEach(function(tr) {
          var td = tr.children[idx - 1];
          if (td) td.classList.add(i === 0 ? 'is-checked-a' : 'is-checked-b');
        });
      });
    }

    function updateBar() {
      bar.hidden = checked.length === 0;
      if (checked.length > 0) {
        barText.textContent = checked.map(function(c) { return c.name; }).join(' と ');
        goBtn.disabled = checked.length < 2;
      }
    }

    document.querySelectorAll('.zoo-check').forEach(function(cb) {
      cb.addEventListener('change', function() {
        if (cb.checked) {
          if (checked.length >= 3) { cb.checked = false; return; }
          checked.push({ id: cb.value, name: cb.dataset.name });
        } else {
          checked = checked.filter(function(c) { return c.id !== cb.value; });
        }
        updateHighlight();
        updateBar();
      });
    });

    goBtn.addEventListener('click', function() {
      if (checked.length >= 2) {
        var keys = ['a', 'b', 'c'];
        var params = checked.map(function(c, i) { return keys[i] + '=' + encodeURIComponent(c.id); }).join('&');
        location.href = '/compare?' + params;
      }
    });

    clearBtn.addEventListener('click', function() {
      checked = [];
      document.querySelectorAll('.zoo-check').forEach(function(cb) { cb.checked = false; });
      updateHighlight();
      updateBar();
    });
  </script>
</body>
</html>`;
}

export function renderCompareHtml(
  selected: { zoo: Zoo; animals: CompareAnimalRow[] }[],
  animalCounts: Map<string, number>
): string {
  const n = selected.length;
  const nameSets = selected.map(({ animals }) => new Set(animals.map((a) => a.display_name)));

  // class/order lookup across all zoos
  const classOf = new Map<string, string | null>();
  const orderOf = new Map<string, string | null>();
  for (const { animals } of selected) {
    for (const a of animals) {
      if (!classOf.has(a.display_name)) classOf.set(a.display_name, a.class_name);
      if (!orderOf.has(a.display_name)) orderOf.set(a.display_name, a.order_name);
    }
  }

  // Common = in ALL selected zoos
  const commonNames = new Set(
    [...nameSets[0]].filter((name) => nameSets.every((s) => s.has(name)))
  );
  const commonAnimals = selected[0].animals.filter((a) => commonNames.has(a.display_name));

  // Each zoo's column: animals in this zoo that are NOT in 共通 (not in all selected zoos)
  // Animals shared by exactly 2-of-3 zoos appear in both of those zoo columns
  const exclusiveLists = selected.map(({ animals }) =>
    animals.filter((a) => !commonNames.has(a.display_name))
  );

  const cols = n + 1; // 共通 + N 園
  const gridCols = `repeat(${cols}, minmax(0, 1fr))`;

  const groupByOrder = (rows: CompareAnimalRow[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const ord = r.order_name ?? "不明";
      if (!map.has(ord)) map.set(ord, []);
      map.get(ord)!.push(r.display_name);
    }
    return map;
  };

  const groupByOrderNames = (names: string[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    for (const name of names) {
      const ord = orderOf.get(name) ?? "不明";
      if (!map.has(ord)) map.set(ord, []);
      map.get(ord)!.push(name);
    }
    return map;
  };

  const allClasses = [
    ...new Set([
      ...commonAnimals.map((a) => a.class_name ?? "未分類"),
      ...exclusiveLists.flatMap((list) => list.map((a) => a.class_name ?? "未分類")),
    ]),
  ].sort((a, b) => {
    const ia = CLASS_SORT_ORDER.indexOf(a), ib = CLASS_SORT_ORDER.indexOf(b);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1; if (ib >= 0) return 1;
    return a === "未分類" ? 1 : b === "未分類" ? -1 : a.localeCompare(b, "ja");
  });

  const animalLink = (name: string) =>
    `<li><a href="/animal/${encodeURIComponent(name)}">${escapeHtml(name)}</a></li>`;

  const zooOptions = (sel: string, name: string) =>
    `<div class="select-group"><select name="${escapeHtml(name)}"><option value="">（なし）</option>${
      zoos.map((z) => {
        const cnt = animalCounts.get(z.id);
        const text = cnt != null ? `${z.name}（${cnt}種）` : z.name;
        return `<option value="${escapeHtml(z.id)}"${z.id === sel ? " selected" : ""}>${escapeHtml(text)}</option>`;
      }).join("")
    }</select></div>`;

  const classSections = allClasses.map((cls) => {
    const clsCommon = commonAnimals.filter((a) => (a.class_name ?? "未分類") === cls);
    const clsExcl = exclusiveLists.map((list) =>
      list.filter((a) => (a.class_name ?? "未分類") === cls)
    );
    const total = clsCommon.length + clsExcl.reduce((s, l) => s + l.length, 0);
    if (total === 0) return "";

    const ordGrpCommon = groupByOrder(clsCommon);
    const ordGrpExcl = clsExcl.map((list) => groupByOrder(list));
    const allOrders = [
      ...new Set([...ordGrpCommon.keys(), ...ordGrpExcl.flatMap((g) => [...g.keys()])]),
    ].sort((a, b) => (a === "不明" ? 1 : b === "不明" ? -1 : a.localeCompare(b, "ja")));

    const clsSummaryParts = [
      clsCommon.length ? `共通: ${clsCommon.length}` : "",
      ...clsExcl.map((l, i) => (l.length ? `${selected[i].zoo.name.slice(0, 4)}: ${l.length}` : "")),
    ].filter(Boolean).join(" · ");

    const orderSections = allOrders.map((ord) => {
      const oCommon = ordGrpCommon.get(ord) ?? [];
      const oExcl = ordGrpExcl.map((g) => g.get(ord) ?? []);
      const ordSummary = [
        oCommon.length ? `共通: ${oCommon.length}` : "",
        ...oExcl.map((l, i) => (l.length ? `${selected[i].zoo.name.slice(0, 4)}: ${l.length}` : "")),
      ].filter(Boolean).join(" · ");
      return `<div class="order-section">
        <div class="order-heading">${escapeHtml(ord)}<span class="class-counts">${escapeHtml(ordSummary)}</span></div>
        <div class="compare-grid" style="grid-template-columns:${gridCols}">
          <div class="compare-col compare-col--common"><ul class="col-list">${oCommon.map(animalLink).join("")}</ul></div>
          ${oExcl.map((l) => `<div class="compare-col"><ul class="col-list">${l.map(animalLink).join("")}</ul></div>`).join("")}
        </div>
      </div>`;
    }).join("");

    return `<section class="class-section">
      <h2 class="class-heading">${escapeHtml(cls)}<span class="class-counts">${escapeHtml(clsSummaryParts)}</span></h2>
      ${orderSections}
    </section>`;
  }).join("");

  const headerLabels = [
    `<div class="compare-label compare-label--common">共通<span class="compare-total">${commonAnimals.length}種</span></div>`,
    ...selected.map((s, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C
      return `<div class="compare-label">${escapeHtml(s.zoo.name)}<span class="compare-total">${exclusiveLists[i].length}種</span></div>`;
    }),
  ].join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>動物園を比較 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1.25rem 1.5rem 3rem; display: grid; gap: 1.5rem; }
    h1 { font-size: 1.15rem; }
    .compare-form { display: flex; flex-wrap: nowrap; gap: 0.5rem; align-items: center; padding: 0.75rem; background: #f8fbf9; border: 1px solid #dce7df; }
    .select-group { flex: 1 1 0; min-width: 0; }
    .select-group select { width: 100%; min-height: 42px; border: 1px solid #bbb; padding: 0.4rem 0.6rem; background: #fff; }
    .compare-form button { min-height: 42px; border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.4rem 1.1rem; cursor: pointer; font-size: 0.9rem; flex-shrink: 0; white-space: nowrap; }
    @media (max-width: 640px) { .compare-form { flex-wrap: wrap; } .select-group { flex: 1 1 100%; } }
    .compare-header { display: grid; grid-template-columns: ${gridCols}; border: 1px solid #ddd; border-bottom: none; position: sticky; top: 0; z-index: 10; }
    .compare-label { padding: 0.6rem 0.85rem; background: #f3f3f3; font-size: 0.82rem; font-weight: bold; color: #555; border-right: 1px solid #ddd; display: flex; justify-content: space-between; align-items: baseline; gap: 0.4rem; }
    .compare-label:last-child { border-right: none; }
    .compare-label--common { background: #f0fbf4; color: #1f5b45; }
    .compare-total { font-size: 0.75rem; font-weight: normal; color: #888; white-space: nowrap; }
    .compare-label--common .compare-total { color: #1f5b45; }
    .class-section { border: 1px solid #ddd; border-top: none; }
    .class-heading { font-size: 0.82rem; font-weight: bold; color: #555; background: #f9f9f9; padding: 0.4rem 0.85rem; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: baseline; }
    .class-counts { font-size: 0.72rem; font-weight: normal; color: #aaa; }
    .order-section { border-top: 1px solid #eee; }
    .order-section:first-child { border-top: none; }
    .order-heading { font-size: 0.78rem; color: #777; background: #fcfcfc; padding: 0.3rem 0.85rem 0.3rem 1.4rem; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: baseline; }
    .compare-grid { display: grid; }
    .compare-col { border-right: 1px solid #eee; min-height: 1px; }
    .compare-col:last-child { border-right: none; }
    .compare-col--common { background: #fafffe; }
    .col-list { list-style: none; }
    .col-list li { border-bottom: 1px solid #f5f5f5; }
    .col-list li:last-child { border-bottom: none; }
    .col-list a { display: block; padding: 0.28rem 0.85rem; font-size: 0.82rem; color: #1f5b45; text-decoration: none; }
    .col-list a:hover { background: #f5fbf8; }
    @media (max-width: 640px) {
      main { padding: 0.75rem 0.75rem 2rem; gap: 1rem; }
      .compare-label { font-size: 0.68rem; padding: 0.45rem 0.35rem; }
      .col-list a { padding: 0.28rem 0.4rem; font-size: 0.78rem; }
      .class-heading { font-size: 0.78rem; padding: 0.35rem 0.4rem; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/compare")}
  <main>
    <h1>動物園を比較</h1>
    <form class="compare-form" action="/compare" method="get">
      ${zooOptions(selected[0]?.zoo.id ?? "", "a")}
      ${zooOptions(selected[1]?.zoo.id ?? "", "b")}
      ${zooOptions(selected[2]?.zoo.id ?? "", "c")}
      <button type="submit">比較する</button>
    </form>
    <div class="compare-header">${headerLabels}</div>
    ${classSections}
  </main>
</body>
</html>`;
}
