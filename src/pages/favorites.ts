import { COMMON_STYLES, renderGlobalNav, renderSiteHeader } from "./layout";

export const FAVORITES_JS = `(function () {
  var STORAGE_KEY = "kinkizoo:favorites:v1";
  var hasStorage = (function () {
    try {
      var testKey = "__kinkizoo_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  })();

  function loadFavorites() {
    if (!hasStorage) return { zoos: {}, animals: {} };
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { zoos: {}, animals: {} };
      var parsed = JSON.parse(raw);
      return {
        zoos: parsed && typeof parsed.zoos === "object" && parsed.zoos ? parsed.zoos : {},
        animals: parsed && typeof parsed.animals === "object" && parsed.animals ? parsed.animals : {}
      };
    } catch (e) {
      return { zoos: {}, animals: {} };
    }
  }

  function saveFavorites(data) {
    if (!hasStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      // ignore write failures (private mode, quota)
    }
  }

  function bucketFor(data, type) {
    return type === "zoo" ? data.zoos : data.animals;
  }

  function isFavorite(data, type, id) {
    return Object.prototype.hasOwnProperty.call(bucketFor(data, type), id);
  }

  function toggleFavorite(type, id, label, href) {
    var data = loadFavorites();
    var bucket = bucketFor(data, type);
    if (Object.prototype.hasOwnProperty.call(bucket, id)) {
      delete bucket[id];
    } else {
      bucket[id] = { label: label, href: href };
    }
    saveFavorites(data);
    return isFavorite(data, type, id);
  }

  function syncButton(button) {
    var type = button.getAttribute("data-fav-type");
    var id = button.getAttribute("data-fav-id");
    if (!type || !id) return;
    var active = isFavorite(loadFavorites(), type, id);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    var icon = button.querySelector(".fav-toggle-icon");
    if (icon) icon.textContent = active ? "\u2605" : "\u2606";
    var text = button.querySelector(".fav-toggle-text");
    if (text) text.textContent = active ? "お気に入り済み" : "お気に入りに追加";
    if (!text) {
      button.setAttribute("aria-label", active ? "お気に入り解除" : "お気に入りに追加");
    }
  }

  function initButtons(root) {
    var buttons = (root || document).querySelectorAll("[data-fav-type][data-fav-id]");
    buttons.forEach(function (button) {
      if (button.dataset.favBound === "1") return;
      button.dataset.favBound = "1";
      if (!hasStorage) {
        button.disabled = true;
        button.title = "このブラウザではお気に入りを保存できません";
        return;
      }
      syncButton(button);
      button.addEventListener("click", function (event) {
        event.preventDefault();
        var type = button.getAttribute("data-fav-type");
        var id = button.getAttribute("data-fav-id");
        var label = button.getAttribute("data-fav-name") || id;
        var href = button.getAttribute("data-fav-href") || "";
        toggleFavorite(type, id, label, href);
        document.querySelectorAll('[data-fav-type="' + type + '"][data-fav-id="' + CSS.escape(id) + '"]').forEach(syncButton);
        renderFavoritesPage();
      });
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function renderFavoritesPage() {
    var root = document.getElementById("favorites-root");
    if (!root) return;
    if (!hasStorage) {
      root.innerHTML = '<p class="favorites-empty">このブラウザではお気に入りを利用できません（プライベートブラウズなど localStorage が無効な環境です）。</p>';
      return;
    }
    var data = loadFavorites();
    var zooEntries = Object.keys(data.zoos).map(function (id) {
      var entry = data.zoos[id];
      return { id: id, label: entry.label || id, href: entry.href || "#" };
    });
    var animalEntries = Object.keys(data.animals).map(function (id) {
      var entry = data.animals[id];
      return { id: id, label: entry.label || id, href: entry.href || "#" };
    });

    function renderSection(type, title, entries, emptyMessage) {
      if (entries.length === 0) {
        return '<section class="favorites-section"><h2>' + title + '</h2><p class="favorites-empty">' + emptyMessage + '</p></section>';
      }
      var items = entries
        .map(function (entry) {
          return (
            '<li><a href="' + escapeHtml(entry.href) + '">' + escapeHtml(entry.label) + "</a>" +
            '<button type="button" class="ui-btn ui-btn--secondary favorites-remove" data-fav-remove data-fav-type="' +
            type + '" data-fav-id="' + escapeHtml(entry.id) + '">削除</button></li>'
          );
        })
        .join("");
      return '<section class="favorites-section"><h2>' + title + "（" + entries.length + "）</h2><ul class=\\"favorites-list\\">" + items + "</ul></section>";
    }

    root.innerHTML =
      renderSection("zoo", "動物園", zooEntries, "お気に入りの動物園はまだありません。") +
      renderSection("animal", "動物", animalEntries, "お気に入りの動物はまだありません。");

    root.querySelectorAll("[data-fav-remove]").forEach(function (button) {
      button.addEventListener("click", function () {
        var type = button.getAttribute("data-fav-type");
        var id = button.getAttribute("data-fav-id");
        toggleFavorite(type, id, "", "");
        document.querySelectorAll('[data-fav-type="' + type + '"][data-fav-id="' + CSS.escape(id) + '"]').forEach(syncButton);
        renderFavoritesPage();
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initButtons();
    renderFavoritesPage();
  });
})();
`;

export function renderFavoritesHtml(): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>お気に入り | 近畿動物園情報</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; }${COMMON_STYLES}
    main { max-width: 800px; margin: 0 auto; padding: 1.5rem; display: grid; gap: 1.25rem; }
    main > p.lead { color: #666; font-size: 0.9rem; line-height: 1.6; }
    .favorites-section { display: grid; gap: 0.6rem; }
    .favorites-section h2 { font-size: 1.05rem; }
    .favorites-empty { color: #777; font-size: 0.88rem; border: 1px solid #e1e1e1; background: #f7f7f7; padding: 0.75rem; }
    .favorites-list { list-style: none; display: grid; gap: 0.5rem; }
    .favorites-list li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; border: 1px solid #dce7df; padding: 0.65rem 0.85rem; }
    .favorites-list a { color: #1f5b45; font-weight: bold; text-decoration: none; overflow-wrap: anywhere; }
    .favorites-list a:hover { text-decoration: underline; text-underline-offset: 0.2em; }
    .favorites-remove { flex: 0 0 auto; font-size: 0.78rem; padding: 0.35rem 0.65rem; min-height: 0; }
    noscript p { color: #777; font-size: 0.88rem; border: 1px solid #e1e1e1; background: #f7f7f7; padding: 0.75rem; }
    footer { text-align: center; padding: 1.5rem; font-size: 0.8rem; color: #aaa; }
    @media (max-width: 640px) {
      main { padding: 0.85rem; }
      .favorites-list li { flex-wrap: wrap; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/favorites")}
  <main>
    <div>
      <h1>お気に入り</h1>
      <p class="lead">お気に入りに追加した動物園・動物は、このブラウザの端末内にのみ保存されます。他の端末やブラウザとは共有されません。</p>
    </div>
    <noscript><p>お気に入り機能を利用するには JavaScript を有効にしてください。</p></noscript>
    <div id="favorites-root"></div>
  </main>
  <footer>データは各施設の公式情報をもとに作成。最新情報は各施設の公式サイトでご確認ください。</footer>
  <script src="/favorites.js" defer></script>
</body>
</html>`;
}
