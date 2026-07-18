import type {
  AnimalImageGenerationRecord,
  AnimalImageManageItem,
  AnimalImageRecord,
  AnimalTaxonomyRow,
  ScrapeHealthItem,
  ScrapeHistoryItem,
} from "../index";
import {
  ADMIN_BREADCRUMB_CSS,
  COMMON_STYLES,
  buildAnimalImageItemId,
  buildAnimalImageManageUrl,
  escapeHtml,
  formatDateTime,
  renderAdminBreadcrumb,
  renderGlobalNav,
  renderSiteHeader,
} from "./layout";

const GEMINI_IMAGE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3-pro-image",
];

export function renderAdminTopHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>動物管理 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1.25rem 1.5rem 2rem; display: grid; gap: 1rem; }
    h1 { font-size: 1.2rem; }
    .admin-nav { display: grid; gap: 0.65rem; list-style: none; }
    .admin-nav a { display: block; border: 1px solid #dce7df; background: #f8fbf9; color: #1f5b45; padding: 0.85rem 1rem; text-decoration: none; font-size: 0.95rem; }
    .admin-nav a:hover { background: #f1f8f3; border-color: #9bc4ab; }
    .admin-nav small { display: block; color: #666; font-size: 0.78rem; margin-top: 0.2rem; }${ADMIN_BREADCRUMB_CSS}
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/admin")}
  <main>
    ${renderAdminBreadcrumb([])}
    <h1>動物管理</h1>
    <ul class="admin-nav">
      <li>
        <a href="/admin/animal-taxonomy">
          分類管理
          <small>未分類・部分分類の動物を LLM で分類する</small>
        </a>
      </li>
      <li>
        <a href="/admin/animal-images">
          画像管理
          <small>動物画像の生成・選択を管理する</small>
        </a>
      </li>
      <li>
        <a href="/admin/scrape-health">
          スクレイプ監視
          <small>取得件数の急減・エラー・期待件数割れを確認する</small>
        </a>
      </li>
      <li>
        <a href="/admin/scrape-history">
          データ更新履歴
          <small>スクレイピングごとの追加・削除・警告を確認する</small>
        </a>
      </li>
    </ul>
  </main>
</body>
</html>`;
}

export function renderScrapeHealthAdminHtml(items: ScrapeHealthItem[]): string {
  const rows = items
    .map((item) => {
      const statusClass = item.error ? "error" : item.warningCount > 0 ? "warning" : "ok";
      const statusLabel = item.error ? "エラー" : item.warningCount > 0 ? "警告" : "正常";
      const warnings = item.warningMessages.length > 0
        ? `<ul>${item.warningMessages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>`
        : "-";
      const refreshed = item.scrapedAt ? formatDateTime(item.scrapedAt) : "-";
      return `
        <tr class="${statusClass}">
          <th scope="row"><a href="/zoos/${encodeURIComponent(item.zoo.id)}">${escapeHtml(item.zoo.name)}</a></th>
          <td><span class="status">${statusLabel}</span></td>
          <td>${item.animalCount}</td>
          <td class="diff-counts">
            <span class="diff-added">+${item.addedCount}</span>
            <span class="diff-removed">-${item.removedCount}</span>
            <span class="diff-renamed">名 ${item.renamedCount}</span>
          </td>
          <td>${refreshed}</td>
          <td>${item.error ? escapeHtml(item.error) : warnings}</td>
          <td><a href="/api/zoos/${encodeURIComponent(item.zoo.id)}/animals?refresh=1">再取得</a></td>
        </tr>`;
    })
    .join("");
  const warningCount = items.filter((item) => item.error || item.warningCount > 0).length;
  const staleCount = items.filter((item) => !item.scrapedAt).length;
  const totalAdded = items.reduce((sum, item) => sum + item.addedCount, 0);
  const totalRemoved = items.reduce((sum, item) => sum + item.removedCount, 0);
  const totalRenamed = items.reduce((sum, item) => sum + item.renamedCount, 0);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>スクレイプ監視 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1120px; margin: 0 auto; padding: 1.25rem 1.5rem 2rem; display: grid; gap: 1rem; }
    h1 { font-size: 1.2rem; }
    .summary { color: #555; font-size: 0.9rem; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.65rem; }
    .summary-card { border: 1px solid #dce7df; background: #f8fbf9; padding: 0.75rem; }
    .summary-card dt { color: #666; font-size: 0.76rem; margin-bottom: 0.2rem; }
    .summary-card dd { color: #222; font-size: 1.25rem; font-weight: bold; }
    .admin-links { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.86rem; }
    .admin-links a { color: #1f5b45; }
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    th, td { border-bottom: 1px solid #e5e5e5; padding: 0.65rem 0.5rem; text-align: left; vertical-align: top; }
    thead th { color: #666; font-size: 0.78rem; background: #f7faf8; }
    tbody th { font-weight: normal; }
    tbody tr.warning { background: #fff9e8; }
    tbody tr.error { background: #fff0f0; }
    .status { display: inline-block; min-width: 3.4rem; border-radius: 999px; padding: 0.16rem 0.5rem; text-align: center; font-size: 0.78rem; background: #edf7ef; color: #1f5b45; }
    tr.warning .status { background: #fff1bf; color: #765000; }
    tr.error .status { background: #ffd6d6; color: #8a1f1f; }
    .diff-counts { white-space: nowrap; }
    .diff-counts span { display: inline-block; margin-right: 0.45rem; font-size: 0.82rem; }
    .diff-added { color: #1f6f3d; }
    .diff-removed { color: #a12b2b; }
    .diff-renamed { color: #765000; }
    td ul { padding-left: 1.1rem; }
    td a, th a { color: #1f5b45; }
    @media (max-width: 720px) {
      main { padding: 1rem 0.75rem; }
      .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      table { font-size: 0.8rem; }
      th, td { padding: 0.5rem 0.35rem; }
    }${ADMIN_BREADCRUMB_CSS}
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/admin")}
  <main>
    ${renderAdminBreadcrumb([{ label: "スクレイプ監視" }])}
    <h1>スクレイプ監視</h1>
    <dl class="summary-grid">
      <div class="summary-card"><dt>警告・エラー</dt><dd>${warningCount}</dd></div>
      <div class="summary-card"><dt>未取得</dt><dd>${staleCount}</dd></div>
      <div class="summary-card"><dt>追加 / 削除</dt><dd>+${totalAdded} / -${totalRemoved}</dd></div>
      <div class="summary-card"><dt>名称変更候補</dt><dd>${totalRenamed}</dd></div>
    </dl>
    <p class="summary">最新取得に紐づく警告と差分を施設ごとに表示しています。</p>
    <p class="admin-links"><a href="/admin/scrape-history">更新履歴を見る</a></p>
    <table>
      <thead>
        <tr>
          <th scope="col">施設</th>
          <th scope="col">状態</th>
          <th scope="col">件数</th>
          <th scope="col">最新差分</th>
          <th scope="col">最終取得</th>
          <th scope="col">警告・エラー</th>
          <th scope="col">操作</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </main>
</body>
</html>`;
}

export function renderScrapeHistoryAdminHtml(items: ScrapeHistoryItem[]): string {
  const previewList = (values: string[], emptyLabel: string) => {
    if (values.length === 0) return `<span class="muted">${emptyLabel}</span>`;
    const visible = values.slice(0, 6);
    const more = values.length - visible.length;
    return `${visible.map((value) => `<span class="name-chip">${escapeHtml(value)}</span>`).join("")}${more > 0 ? `<span class="muted">ほか ${more} 件</span>` : ""}`;
  };
  const rows = items
    .map((item) => {
      const statusClass = item.error ? "error" : item.warningCount > 0 ? "warning" : "";
      const warnings = item.warningMessages.length > 0
        ? `<ul>${item.warningMessages.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>`
        : `<span class="muted">なし</span>`;
      const renamed = item.renamedPairs.length === 0
        ? `<span class="muted">なし</span>`
        : item.renamedPairs
            .slice(0, 4)
            .map((pair) => `<span class="rename-chip">${escapeHtml(pair.previous)} → ${escapeHtml(pair.current)}</span>`)
            .join("");
      const hiddenRenamed = item.renamedPairs.length > 4 ? `<span class="muted">ほか ${item.renamedPairs.length - 4} 件</span>` : "";
      return `
        <article class="history-item ${statusClass}">
          <header class="history-header">
            <div>
              <h2><a href="/zoos/${encodeURIComponent(item.zooId)}">${escapeHtml(item.zooName)}</a></h2>
              <p>${formatDateTime(item.scrapedAt)} / ${item.animalCount} 件</p>
            </div>
            <dl class="diff-summary">
              <div><dt>追加</dt><dd class="diff-added">+${item.addedCount}</dd></div>
              <div><dt>削除</dt><dd class="diff-removed">-${item.removedCount}</dd></div>
              <div><dt>名称変更</dt><dd class="diff-renamed">${item.renamedCount}</dd></div>
              <div><dt>警告</dt><dd>${item.warningCount}</dd></div>
            </dl>
          </header>
          ${item.error ? `<p class="error-text">取得エラー: ${escapeHtml(item.error)}</p>` : ""}
          <div class="history-grid">
            <section>
              <h3>追加</h3>
              <p>${previewList(item.addedNames, "なし")}</p>
            </section>
            <section>
              <h3>削除</h3>
              <p>${previewList(item.removedNames, "なし")}</p>
            </section>
            <section>
              <h3>名称変更候補</h3>
              <p>${renamed}${hiddenRenamed}</p>
            </section>
            <section>
              <h3>警告</h3>
              ${warnings}
            </section>
          </div>
        </article>`;
    })
    .join("");
  const empty = items.length === 0 ? `<p class="empty">更新履歴はまだありません。</p>` : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>データ更新履歴 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1120px; margin: 0 auto; padding: 1.25rem 1.5rem 2rem; display: grid; gap: 1rem; }
    h1 { font-size: 1.2rem; }
    .summary { color: #555; font-size: 0.9rem; }
    .admin-links { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.86rem; }
    .admin-links a, h2 a { color: #1f5b45; }
    .history-list { display: grid; gap: 0.85rem; }
    .history-item { border: 1px solid #ddd; padding: 0.9rem; display: grid; gap: 0.8rem; }
    .history-item.warning { background: #fffaf0; border-color: #eed89a; }
    .history-item.error { background: #fff4f4; border-color: #efb3b3; }
    .history-header { display: flex; justify-content: space-between; gap: 1rem; align-items: start; }
    .history-header h2 { font-size: 1rem; margin-bottom: 0.2rem; }
    .history-header p { color: #666; font-size: 0.82rem; }
    .diff-summary { display: grid; grid-template-columns: repeat(4, minmax(4rem, 1fr)); gap: 0.45rem; min-width: 22rem; }
    .diff-summary div { background: #fff; border: 1px solid #e1e8e3; padding: 0.45rem; }
    .diff-summary dt { color: #666; font-size: 0.72rem; }
    .diff-summary dd { font-weight: bold; margin-top: 0.12rem; }
    .diff-added { color: #1f6f3d; }
    .diff-removed { color: #a12b2b; }
    .diff-renamed { color: #765000; }
    .history-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.75rem; }
    .history-grid h3 { color: #666; font-size: 0.78rem; margin-bottom: 0.35rem; }
    .history-grid p { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .history-grid ul { padding-left: 1.1rem; color: #555; font-size: 0.82rem; }
    .name-chip, .rename-chip { display: inline-block; border: 1px solid #d7eadc; background: #fff; color: #1f5b45; padding: 0.18rem 0.45rem; font-size: 0.76rem; }
    .rename-chip { color: #765000; border-color: #eadca6; }
    .muted { color: #888; font-size: 0.78rem; }
    .error-text { color: #9b1c1c; font-size: 0.86rem; }
    .empty { color: #777; padding: 1rem; border: 1px solid #ddd; }
    @media (max-width: 760px) {
      main { padding: 1rem 0.75rem; }
      .history-header { display: grid; }
      .diff-summary, .history-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); min-width: 0; }
    }${ADMIN_BREADCRUMB_CSS}
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/admin")}
  <main>
    ${renderAdminBreadcrumb([{ label: "データ更新履歴" }])}
    <h1>データ更新履歴</h1>
    <p class="summary">直近 ${items.length} 件のスクレイピング実行から、追加・削除・名称変更候補・警告を表示します。</p>
    <p class="admin-links"><a href="/admin/scrape-health">スクレイプ監視へ戻る</a></p>
    ${empty || `<div class="history-list">${rows}</div>`}
  </main>
</body>
</html>`;
}

export function renderAnimalTaxonomyAdminHtml(animals: AnimalTaxonomyRow[], notice?: string): string {
  const noticeHtml = notice ? `<p class="notice">${escapeHtml(notice)}</p>` : "";
  const statusLabel: Record<string, string> = {
    pending: "候補あり",
    partial: "部分分類",
    applied: "適用済み",
    rejected: "却下",
  };

  const countApplied = animals.filter((a) => a.animal_id !== null).length;
  const countPartial = animals.filter((a) => a.animal_id === null && a.candidate_status !== null).length;
  const countNone = animals.filter((a) => a.animal_id === null && a.candidate_status === null).length;

  const rows = animals.map((a) => {
    const group = a.animal_id !== null ? "applied" : a.candidate_status !== null ? "partial" : "none";
    const statusText = a.candidate_status ? (statusLabel[a.candidate_status] ?? a.candidate_status) : "未取得";
    const taxonomyText = [a.class_name, a.order_name, a.family_name].filter(Boolean).join(" / ") || "—";
    const classifyBtn = group === "applied"
      ? `<button class="classify-btn classify-btn--rerun" data-name="${escapeHtml(a.display_name)}">再分類</button>`
      : `<button class="classify-btn" data-name="${escapeHtml(a.display_name)}">分類</button>`;
    return `<tr data-group="${group}">
      <td class="name-cell"><a href="/animal/${encodeURIComponent(a.display_name)}">${escapeHtml(a.display_name)}</a>${a.canonical_name && a.canonical_name !== a.display_name ? `<br><small>${escapeHtml(a.canonical_name)}</small>` : ""}</td>
      <td><span class="status-badge status-${escapeHtml(a.candidate_status ?? "none")}">${statusText}</span></td>
      <td class="taxonomy-cell">${escapeHtml(taxonomyText)}</td>
      <td>${a.confidence != null ? `${Math.round(a.confidence * 100)}%` : "—"}</td>
      <td>${classifyBtn}</td>
    </tr>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>分類管理 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1rem 1.5rem 2rem; display: grid; gap: 1rem; }
    h1 { font-size: 1.15rem; }
${ADMIN_BREADCRUMB_CSS}
    .notice { border: 1px solid #cfe5d8; background: #f5fbf7; color: #244d37; padding: 0.6rem 0.75rem; font-size: 0.86rem; }
    .filter-tabs { display: flex; gap: 0; border-bottom: 2px solid #ddd; }
    .filter-tab { border: none; border-bottom: 2px solid transparent; background: none; padding: 0.5rem 1rem; font-size: 0.84rem; cursor: pointer; color: #555; margin-bottom: -2px; white-space: nowrap; }
    .filter-tab:hover { color: #1f5b45; }
    .filter-tab.active { border-bottom-color: #1f5b45; color: #1f5b45; font-weight: bold; }
    .filter-tab .count { font-size: 0.75rem; color: #888; margin-left: 0.3rem; }
    .filter-tab.active .count { color: #1f5b45; }
    .bulk-classify { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; padding: 0.65rem 0.75rem; background: #f8fbf9; border: 1px solid #dce7df; }
    .bulk-classify-btn { min-height: 34px; border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.3rem 0.8rem; cursor: pointer; font-size: 0.82rem; }
    .bulk-classify-btn:disabled { border-color: #aaa; background: #aaa; cursor: default; }
    .bulk-status { font-size: 0.82rem; color: #555; }
    .visible-count { font-size: 0.82rem; color: #888; }
    .animal-table { width: 100%; border-collapse: collapse; }
    .animal-table th, .animal-table td { border: none; border-bottom: 1px solid #e8e8e8; padding: 0.5rem 0.65rem; text-align: left; font-size: 0.84rem; vertical-align: middle; }
    .animal-table thead th { background: #f7f7f7; color: #555; border-bottom: 2px solid #ddd; font-size: 0.8rem; }
    .animal-table tbody tr:hover { background: #f5fbf8; }
    .animal-table tr.classifying { opacity: 0.5; }
    .animal-table tr.done td { background: #f0fbf4; }
    .name-cell a { color: #1f5b45; text-decoration: none; font-weight: bold; }
    .name-cell a:hover { text-decoration: underline; }
    .name-cell small { color: #888; }
    .taxonomy-cell { color: #555; font-size: 0.78rem; }
    .status-badge { display: inline-block; font-size: 0.72rem; padding: 0.15rem 0.45rem; border-radius: 2px; white-space: nowrap; }
    .status-pending { background: #fef9e7; border: 1px solid #f0d98a; color: #7a5c00; }
    .status-partial { background: #fff3e0; border: 1px solid #f0c878; color: #7a4a00; }
    .status-applied { background: #e8f5ee; border: 1px solid #b6ddc8; color: #1f5b45; }
    .status-rejected { background: #fef0ec; border: 1px solid #f0c0b0; color: #8b3a20; }
    .status-none { background: #f7f7f7; border: 1px solid #e1e1e1; color: #888; }
    .classify-btn { border: 1px solid #1f5b45; background: #fff; color: #1f5b45; padding: 0.25rem 0.65rem; font-size: 0.78rem; cursor: pointer; white-space: nowrap; }
    .classify-btn--rerun { border-color: #aaa; color: #999; }
    .classify-btn--rerun:hover:not(:disabled) { border-color: #1f5b45; color: #1f5b45; }
    .classify-btn:disabled { border-color: #ccc; color: #ccc; cursor: default; }
    .classify-btn.done { border-color: #aaa; color: #aaa; }
    @media (max-width: 640px) {
      main { padding: 0.75rem; }
      .filter-tab { padding: 0.4rem 0.6rem; font-size: 0.8rem; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/admin")}
  <main>
    ${renderAdminBreadcrumb([{ href: "/admin/animal-taxonomy", label: "分類管理" }])}
    <h1>分類管理</h1>
    ${noticeHtml}
    <div class="filter-tabs" role="tablist">
      <button class="filter-tab active" data-filter="all" role="tab">全て<span class="count">${animals.length}</span></button>
      <button class="filter-tab" data-filter="applied" role="tab">分類済<span class="count">${countApplied}</span></button>
      <button class="filter-tab" data-filter="partial" role="tab">一部分類<span class="count">${countPartial}</span></button>
      <button class="filter-tab" data-filter="none" role="tab">未分類<span class="count">${countNone}</span></button>
    </div>
    <div class="bulk-classify">
      <button id="bulk-classify-btn" class="bulk-classify-btn">表示中をまとめて分類</button>
      <span id="bulk-status" class="bulk-status"></span>
      <span id="visible-count" class="visible-count"></span>
    </div>
    <table class="animal-table">
      <thead>
        <tr>
          <th>動物名</th>
          <th>ステータス</th>
          <th>分類</th>
          <th>確度</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="taxonomy-tbody">
        ${rows}
      </tbody>
    </table>
  </main>
  <script>
    var currentFilter = 'all';

    function applyFilter(filter) {
      currentFilter = filter;
      var rows = document.querySelectorAll('#taxonomy-tbody tr');
      var visible = 0;
      rows.forEach(function(row) {
        var show = filter === 'all' || row.dataset.group === filter;
        row.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      document.querySelectorAll('.filter-tab').forEach(function(tab) {
        tab.classList.toggle('active', tab.dataset.filter === filter);
      });
      document.getElementById('visible-count').textContent = filter === 'all' ? '' : visible + ' 件表示中';
    }

    document.querySelectorAll('.filter-tab').forEach(function(tab) {
      tab.addEventListener('click', function() { applyFilter(tab.dataset.filter); });
    });

    async function classifyAnimal(name, btn) {
      btn.disabled = true;
      btn.textContent = '分類中…';
      var row = btn.closest('tr');
      row.classList.add('classifying');
      try {
        var res = await fetch('/animal/' + encodeURIComponent(name) + '/classify', {method: 'POST'});
        var finalUrl = new URL(res.url);
        var status = finalUrl.searchParams.get('llm') || 'done';
        row.classList.remove('classifying');
        row.classList.add('done');
        btn.textContent = status;
        btn.classList.add('done');
      } catch(e) {
        row.classList.remove('classifying');
        btn.disabled = false;
        btn.textContent = 'エラー';
      }
    }

    document.querySelectorAll('.classify-btn').forEach(function(btn) {
      btn.addEventListener('click', function() { classifyAnimal(btn.dataset.name, btn); });
    });

    var bulkBtn = document.getElementById('bulk-classify-btn');
    var bulkStatus = document.getElementById('bulk-status');
    if (bulkBtn) {
      bulkBtn.addEventListener('click', async function() {
        var pending = Array.from(document.querySelectorAll('#taxonomy-tbody tr:not([style*="display: none"]) .classify-btn:not(.done):not([disabled])'));
        if (!pending.length) { bulkStatus.textContent = '対象なし'; return; }
        bulkBtn.disabled = true;
        bulkStatus.textContent = '0 / ' + pending.length + ' 件';
        var done = 0;
        for (var btn of pending) {
          await classifyAnimal(btn.dataset.name, btn);
          done++;
          bulkStatus.textContent = done + ' / ' + pending.length + ' 件完了';
        }
        bulkBtn.disabled = false;
      });
    }
  </script>
</body>
</html>`;
}

export function renderAnimalImageManageListHtml(
  items: AnimalImageManageItem[],
  query: string | null,
  notice?: string
): string {
  const escapedQuery = query ? escapeHtml(query) : "";
  const modelOptions = GEMINI_IMAGE_MODELS.map(
    (model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`
  ).join("");
  const rows = items
    .map((item) => {
      const selected = item.selectedGenerationId
        ? `<span class="status selected">選択済み #${item.selectedGenerationId}</span>`
        : `<span class="status empty">未選択</span>`;
      const preview = item.selectedGenerationId
        ? `<img src="/animal-images/${encodeURIComponent(item.displayName)}?v=${item.selectedGenerationId}" alt="${escapeHtml(item.displayName)}">`
        : `<div class="image-placeholder">No image</div>`;
      const generations = item.generations
        .map((generation) => {
          const selectedBadge = generation.selected ? `<span class="selected-badge">使用中</span>` : "";
          const selectButton = generation.selected
            ? `<button type="submit" disabled>使用中</button>`
            : `<button type="submit">使う</button>`;
          return `
            <article class="generation-thumb">
              <div class="thumb-image">
                <img src="/admin/animal-image-generations/${generation.id}" alt="${escapeHtml(item.displayName)} #${generation.id}">
                ${selectedBadge}
              </div>
              <div class="thumb-meta">
                <b>#${generation.id}</b>
                <span>${escapeHtml(generation.model)}</span>
                <span>${escapeHtml(formatDateTime(generation.createdAt))}</span>
              </div>
              <form action="/admin/animal-images/select" method="post">
                <input type="hidden" name="displayName" value="${escapeHtml(item.displayName)}">
                <input type="hidden" name="generationId" value="${generation.id}">
                ${selectButton}
              </form>
            </article>`;
        })
        .join("");
      return `
        <article class="image-list-item" id="${escapeHtml(buildAnimalImageItemId(item.animalKey))}">
          <div class="preview">${preview}</div>
          <div class="image-list-body">
            <div class="image-list-heading">
              <h2>${escapeHtml(item.displayName)}</h2>
              <form class="inline-generate-form" action="/admin/animal-images/generate" method="post">
                <input type="hidden" name="displayName" value="${escapeHtml(item.displayName)}">
                <input type="hidden" name="model" class="model-field">
                <input type="hidden" name="customModel" class="custom-model-field">
                <button type="submit">生成</button>
              </form>
            </div>
            <dl>
              <div><dt>状態</dt><dd>${selected}</dd></div>
              <div><dt>生成数</dt><dd>${item.generationCount}</dd></div>
              <div><dt>最終更新</dt><dd>${escapeHtml(formatDateTime(item.updatedAt))}</dd></div>
            </dl>
            <div class="generation-strip">
              ${generations || `<p class="empty-generations">まだ画像がありません。</p>`}
            </div>
          </div>
        </article>`;
    })
    .join("");
  const emptyHtml = `<p class="empty-message">対象の動物名がありません。</p>`;
  const noticeHtml = notice ? `<p class="notice">${escapeHtml(notice)}</p>` : "";
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>動物管理 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1rem 1.5rem 1.5rem; display: grid; gap: 1rem; }
    .page-title { font-size: 1.15rem; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding-bottom: 0.75rem; border-bottom: 1px solid #ddd; }
    .toolbar input { min-height: 42px; flex: 1 1 220px; max-width: 360px; border: 1px solid #bbb; padding: 0.5rem 0.65rem; }
    .toolbar button, .toolbar a { min-height: 42px; display: inline-flex; align-items: center; border: 1px solid #1f5b45; padding: 0.45rem 0.7rem; font-size: 0.86rem; }
    .toolbar button { background: #1f5b45; color: #fff; cursor: pointer; }
    .toolbar a { color: #1f5b45; text-decoration: none; background: #fff; }
    .model-toolbar { display: grid; grid-template-columns: minmax(220px, 320px) minmax(220px, 1fr); gap: 0.75rem; align-items: end; padding: 0.75rem; background: #f7faf8; border: 1px solid #dce7df; }
    .model-field-group { display: grid; gap: 0.35rem; }
    .model-field-group label { color: #555; font-size: 0.82rem; font-weight: bold; }
    .model-field-group select, .model-field-group input { min-height: 42px; border: 1px solid #bbb; background: #fff; padding: 0.5rem 0.65rem; }
    .notice { border: 1px solid #cfe5d8; background: #f5fbf7; color: #244d37; padding: 0.6rem 0.75rem; font-size: 0.86rem; }
    .summary { color: #666; font-size: 0.86rem; }
    .image-list { display: grid; gap: 0.75rem; }
    .image-list-item { display: grid; grid-template-columns: 108px minmax(0, 1fr); gap: 0.9rem; align-items: start; border-bottom: 1px solid #e2e2e2; padding: 0.9rem 0; scroll-margin-top: 1rem; }
    .preview { display: block; width: 108px; aspect-ratio: 1; border: 1px solid #ddd; background: #f7f7f7; text-decoration: none; overflow: hidden; }
    .preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .image-placeholder { width: 100%; height: 100%; display: grid; place-items: center; color: #888; font-size: 0.72rem; }
    .image-list-body { min-width: 0; display: grid; gap: 0.45rem; }
    .image-list-heading { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: space-between; align-items: center; }
    .image-list-body h2 { font-size: 1rem; line-height: 1.35; }
    .image-list-body dl { display: flex; flex-wrap: wrap; gap: 0.45rem 1rem; color: #555; font-size: 0.82rem; }
    .image-list-body dl div { display: flex; gap: 0.25rem; }
    .image-list-body dt { color: #777; }
    .status { display: inline-flex; align-items: center; min-height: 1.5rem; padding: 0.1rem 0.45rem; border-radius: 2px; font-size: 0.78rem; }
    .status.selected { background: #e8f5ee; border: 1px solid #b6ddc8; color: #1f5b45; }
    .status.empty { background: #f7f7f7; border: 1px solid #e1e1e1; color: #777; }
    .inline-generate-form button { min-height: 38px; border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.4rem 0.75rem; cursor: pointer; font-size: 0.84rem; }
    .generation-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.65rem; margin-top: 0.35rem; }
    .generation-thumb { display: grid; gap: 0.35rem; min-width: 0; }
    .thumb-image { position: relative; aspect-ratio: 1; border: 1px solid #ddd; background: #f7f7f7; overflow: hidden; }
    .thumb-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .selected-badge { position: absolute; top: 0.3rem; left: 0.3rem; background: #1f5b45; color: #fff; font-size: 0.68rem; padding: 0.12rem 0.35rem; }
    .thumb-meta { display: grid; gap: 0.12rem; color: #555; font-size: 0.72rem; line-height: 1.35; }
    .thumb-meta span { overflow-wrap: anywhere; }
    .generation-thumb button { width: 100%; min-height: 36px; border: 1px solid #1f5b45; background: #fff; color: #1f5b45; cursor: pointer; font-size: 0.8rem; }
    .generation-thumb button:disabled { border-color: #ccc; color: #777; background: #f7f7f7; cursor: default; }
    .empty-generations { color: #777; font-size: 0.82rem; }
    .empty-message { color: #777; padding: 1rem 0; }${ADMIN_BREADCRUMB_CSS}
    @media (max-width: 640px) {
      main { padding: 0.85rem 0.75rem 1.25rem; }
      .toolbar { display: grid; grid-template-columns: 1fr auto; }
      .toolbar input { max-width: none; min-width: 0; grid-column: 1 / -1; }
      .model-toolbar { grid-template-columns: 1fr; padding: 0.65rem; }
      .image-list-item { grid-template-columns: 72px minmax(0, 1fr); align-items: start; }
      .preview { width: 72px; }
      .image-list-heading { display: grid; gap: 0.45rem; }
      .inline-generate-form button { min-height: 44px; }
      .image-list-body dl { display: grid; gap: 0.3rem; }
      .generation-strip { grid-column: 1 / -1; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/admin")}
  <main>
    ${renderAdminBreadcrumb([{ href: "/admin/animal-images", label: "画像管理" }])}
    <h1 class="page-title">画像管理</h1>
    ${noticeHtml}
    <section class="model-toolbar" aria-label="画像生成モデル">
      <div class="model-field-group">
        <label for="shared-image-model">生成モデル</label>
        <select id="shared-image-model">${modelOptions}</select>
      </div>
      <div class="model-field-group">
        <label for="shared-custom-model">任意のモデル名</label>
        <input id="shared-custom-model" placeholder="例: gemini-2.5-flash-image">
      </div>
    </section>
    <form class="toolbar" action="/admin/animal-images" method="get">
      <input type="search" name="q" value="${escapedQuery}" placeholder="動物名で検索" aria-label="動物名で検索">
      <button type="submit">検索</button>
      ${query ? `<a href="/admin/animal-images">クリア</a>` : ""}
    </form>
    <p class="summary">${items.length} 件</p>
    <section class="image-list">
      ${rows || emptyHtml}
    </section>
  </main>
  <script>
    var modelSelect = document.getElementById('shared-image-model');
    var customModel = document.getElementById('shared-custom-model');
    document.querySelectorAll('.inline-generate-form').forEach(function(form) {
      form.addEventListener('submit', function() {
        var modelField = form.querySelector('.model-field');
        var customModelField = form.querySelector('.custom-model-field');
        if (modelField && modelSelect) modelField.value = modelSelect.value;
        if (customModelField && customModel) customModelField.value = customModel.value;
      });
    });
  </script>
</body>
</html>`;
}

export function renderAnimalImageManageDetailHtml(
  displayName: string,
  activeImage: AnimalImageRecord | null,
  generations: AnimalImageGenerationRecord[],
  notice?: string
): string {
  const escapedName = escapeHtml(displayName);
  const modelOptions = GEMINI_IMAGE_MODELS.map(
    (model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`
  ).join("");
  const activePreview = activeImage
    ? `<img src="/animal-images/${encodeURIComponent(displayName)}?v=${activeImage.selectedGenerationId}" alt="${escapedName}">`
    : `<div class="image-placeholder">No image</div>`;
  const gallery = generations
    .map((generation) => {
      const selectedBadge = generation.selected ? `<span class="selected-badge">使用中</span>` : "";
      const selectButton = generation.selected
        ? `<button type="submit" class="ui-btn ui-btn--secondary ui-touch-target" disabled>使用中</button>`
        : `<button type="submit" class="ui-btn ui-btn--secondary ui-touch-target">この画像を使う</button>`;
      return `
        <article class="generation-card">
          <div class="generation-image">
            <img src="/admin/animal-image-generations/${generation.id}" alt="${escapedName} #${generation.id}">
            ${selectedBadge}
          </div>
          <div class="generation-meta">
            <h3>#${generation.id}</h3>
            <p>${escapeHtml(generation.model)}</p>
            <p>${escapeHtml(formatDateTime(generation.createdAt))}</p>
          </div>
          <form action="${buildAnimalImageManageUrl(displayName)}/select" method="post">
            <input type="hidden" name="generationId" value="${generation.id}">
            ${selectButton}
          </form>
        </article>`;
    })
    .join("");
  const noticeHtml = notice ? `<p class="notice">${escapeHtml(notice)}</p>` : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedName} 画像管理 | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 1040px; margin: 0 auto; padding: 1rem 1.5rem 1.5rem; display: grid; gap: 1rem; }
${ADMIN_BREADCRUMB_CSS}
    .page-title { font-size: 1.2rem; line-height: 1.35; }
    .notice { border: 1px solid #cfe5d8; background: #f5fbf7; color: #244d37; padding: 0.6rem 0.75rem; font-size: 0.86rem; }
    .detail-layout { display: grid; grid-template-columns: minmax(220px, 320px) minmax(0, 1fr); gap: 1.2rem; align-items: start; }
    .active-panel, .generate-panel { border-top: 1px solid #ddd; padding-top: 1rem; }
    .active-panel h2, .generate-panel h2, .gallery-section h2 { font-size: 1rem; margin-bottom: 0.75rem; }
    .active-image { width: 100%; aspect-ratio: 1; border: 1px solid #ddd; background: #f7f7f7; overflow: hidden; }
    .active-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .image-placeholder { width: 100%; height: 100%; display: grid; place-items: center; color: #888; font-size: 0.82rem; }
    .generate-form { display: grid; gap: 0.75rem; max-width: 520px; }
    .field { display: grid; gap: 0.35rem; }
    .field label { color: #555; font-size: 0.82rem; font-weight: bold; }
    .field select, .field input { min-height: 42px; border: 1px solid #bbb; padding: 0.5rem 0.65rem; }
    .generate-form button { justify-self: start; }
    .hint { color: #666; font-size: 0.82rem; line-height: 1.5; }
    .gallery-section { border-top: 1px solid #ddd; padding-top: 1rem; }
    .generation-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.9rem; }
    .generation-card { display: grid; gap: 0.55rem; min-width: 0; }
    .generation-image { position: relative; aspect-ratio: 1; border: 1px solid #ddd; background: #f7f7f7; overflow: hidden; }
    .generation-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .selected-badge { position: absolute; top: 0.45rem; left: 0.45rem; background: #1f5b45; color: #fff; font-size: 0.76rem; padding: 0.18rem 0.45rem; }
    .generation-meta { display: grid; gap: 0.2rem; font-size: 0.8rem; color: #555; }
    .generation-meta h3 { font-size: 0.9rem; color: #222; }
    .generation-card button { width: 100%; }
    .generation-card button:disabled { border-color: #ccc; color: #777; background: #f7f7f7; cursor: default; }
    .empty-message { color: #777; padding: 0.75rem 0; }
    @media (max-width: 720px) {
      main { padding: 0.85rem 0.75rem 1.25rem; }
      .detail-layout { grid-template-columns: 1fr; }
      .active-image { max-width: 320px; }
      .generate-form button { width: 100%; min-height: 44px; }
      .generation-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/admin")}
  <main>
    ${renderAdminBreadcrumb([{ href: "/admin/animal-images", label: "画像管理" }, { label: displayName }])}
    <h1 class="page-title">${escapedName}</h1>
    ${noticeHtml}
    <div class="detail-layout">
      <section class="active-panel">
        <h2>使用中の画像</h2>
        <div class="active-image">${activePreview}</div>
      </section>
      <section class="generate-panel">
        <h2>Geminiで生成</h2>
        <form class="generate-form" action="${buildAnimalImageManageUrl(displayName)}/generate" method="post">
          <div class="field">
            <label for="model">モデル</label>
            <select id="model" name="model">${modelOptions}</select>
          </div>
          <div class="field">
            <label for="custom-model">任意のモデル名</label>
            <input id="custom-model" name="customModel" placeholder="例: gemini-2.5-flash-image">
          </div>
          <p class="hint">任意のモデル名を入力すると、上の選択より優先します。生成した画像は履歴に残り、新しい画像が使用中になります。</p>
          <button type="submit" class="ui-btn ui-btn--primary ui-touch-target">画像生成</button>
        </form>
      </section>
    </div>
    <section class="gallery-section">
      <h2>生成履歴</h2>
      <div class="generation-grid">
        ${gallery || `<p class="empty-message">まだ画像がありません。</p>`}
      </div>
    </section>
  </main>
</body>
</html>`;
}
