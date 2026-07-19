import type { ZooSearchResult } from "../index";
import type { PrefectureCode } from "../types";
import {
  COMMON_STYLES,
  PREF_LABELS,
  buildBrowseUrl,
  buildMapUrl,
  escapeHtml,
  renderGlobalNav,
  renderSiteHeader,
  renderStateMessage,
} from "./layout";

const MAP_CLASS_FILTERS = ["哺乳類", "鳥類", "爬虫類", "両生類", "魚類", "軟骨魚類", "無脊椎動物"];

const MAP_MOBILE_BREAKPOINT = 640;

export function renderMapHtml(
  results: ZooSearchResult[],
  activePref: PrefectureCode | null,
  animal: string | null,
  taxClass: string | null = null,
  initialLat: number | null = null,
  initialLon: number | null = null,
  initialZoom: number | null = null
): string {
  const escapedAnimal = escapeHtml(animal ?? "");

  // Embed only the data needed for map markers; safe to embed as JSON in <script>
  const mapData = JSON.stringify(
    results.map((result) => ({
      id: result.zoo.id,
      name: result.zoo.name,
      lat: result.zoo.lat,
      lon: result.zoo.lon,
      animalCount: result.animalCount,
      matchCount: result.matchedAnimals.length,
    }))
  ).replace(/<\//g, "<\\/");

  const count = results.length;
  const matchCount = results.reduce((sum, result) => sum + result.matchedAnimals.length, 0);
  const prefLabel = activePref ? PREF_LABELS[activePref] : "近畿一円";
  const summary = taxClass
    ? `${prefLabel} で${escapeHtml(taxClass)}を見られる動物園・施設: ${count} 件 / ${matchCount} 種`
    : animal
      ? `${prefLabel} で「${escapedAnimal}」を探せる動物園・施設: ${count} 件 / 検索ヒット: ${matchCount} 件`
      : `${prefLabel} の動物園・施設: ${count} 件`;

  const showPanel = (animal || taxClass) && results.length > 0;
  const mapStateMessage =
    count === 0
      ? renderStateMessage(
          animal
            ? "検索条件に該当する施設が見つかりませんでした。"
            : taxClass
              ? "選択した分類に該当する施設が見つかりませんでした。"
              : "表示できる施設が見つかりませんでした。",
          [
            ...(animal || taxClass ? [{ href: buildMapUrl(activePref, null), label: "検索条件をクリア" }] : []),
            { href: buildBrowseUrl(activePref, null), label: "動物園一覧へ戻る" },
          ]
        )
      : "";

  const resultListHtml = showPanel
    ? results.map((r) => {
        const matched = r.matchedAnimals.map((a) => `<a href="/animal/${encodeURIComponent(a)}">${escapeHtml(a)}</a>`).join("、");
        const cnt = r.matchedAnimals.length;
        return `<li class="result-item" data-zoo-id="${escapeHtml(r.zoo.id)}">
          <a class="result-link" href="/zoos/${encodeURIComponent(r.zoo.id)}${activePref ? `?pref=${activePref}` : ""}">
            <span class="result-name">${escapeHtml(r.zoo.name)}<span class="result-count">${cnt}種</span></span>
          </a>
          <p class="result-animals">${matched}</p>
        </li>`;
      }).join("\n")
    : "";

  const classChips = MAP_CLASS_FILTERS.map((cls) => {
    const active = cls === taxClass;
    const href = active ? buildMapUrl(activePref, null) : buildMapUrl(activePref, null, cls);
    return `<a href="${escapeHtml(href)}" class="cls-chip${active ? " cls-chip--active" : ""}">${escapeHtml(cls)}</a>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>地図 | 近畿動物園情報</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #fff; color: #222; display: flex; flex-direction: column; height: 100vh; height: 100dvh; }${COMMON_STYLES}
    .site-header { flex-shrink: 0; }
    .global-nav { flex-shrink: 0; }
    .map-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 0.55rem 1.5rem; border-bottom: 1px solid #ddd; flex-shrink: 0; gap: 0.5rem; }
    .list-link { font-size: 0.85rem; color: #1f5b45; text-decoration: none; }
    .list-link:hover { text-decoration: underline; }
    .map-toolbar-actions { display: flex; align-items: center; gap: 0.45rem; }
    .share-btn, .location-btn { font-size: 0.82rem; padding: 0.35rem 0.75rem; border: 1px solid #1f5b45; background: #fff; color: #1f5b45; cursor: pointer; line-height: 1; white-space: nowrap; }
    .share-btn:hover, .location-btn:hover { background: #f1f8f3; }
    .share-btn:focus-visible, .location-btn:focus-visible { outline: 2px solid #1f5b45; outline-offset: 2px; }
    .location-btn:disabled { opacity: 0.65; cursor: wait; }
    .result-distance { margin-left: auto; font-size: 0.7rem; font-weight: normal; color: #66756b; white-space: nowrap; }
    .share-toast { position: fixed; bottom: 1.25rem; left: 50%; transform: translateX(-50%); padding: 0.5rem 1.1rem; border-radius: 4px; font-size: 0.85rem; z-index: 2000; opacity: 0; visibility: hidden; transition: opacity 0.25s, visibility 0.25s; pointer-events: none; white-space: nowrap; }
    .share-toast--ok { background: #1f5b45; color: #fff; opacity: 1; visibility: visible; }
    .share-toast--error { background: #b91c1c; color: #fff; opacity: 1; visibility: visible; }
    .search-form { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding: 0.75rem 1.5rem; border-bottom: 1px solid #ddd; flex-shrink: 0; }
    .search-form input { flex: 1 1 220px; max-width: 320px; padding: 0.55rem 0.75rem; border: 1px solid #bbb; font-size: 0.95rem; }
    .search-form button, .search-form a { font-size: 0.875rem; }
    .search-form button { border: 1px solid #1f5b45; background: #1f5b45; color: #fff; padding: 0.5rem 0.9rem; cursor: pointer; }
    .search-form a { padding: 0.5rem 0.7rem; color: #1f5b45; text-decoration: none; border: 1px solid #1f5b45; }
    .cls-filter { display: flex; flex-wrap: wrap; gap: 0.35rem; padding: 0.5rem 1.5rem; border-bottom: 1px solid #ddd; flex-shrink: 0; }
    .cls-chip { font-size: 0.78rem; padding: 0.25rem 0.65rem; border: 1px solid #bbb; color: #555; text-decoration: none; background: #fff; white-space: nowrap; }
    .cls-chip:hover { border-color: #1f5b45; color: #1f5b45; }
    .cls-chip--active { background: #1f5b45; color: #fff; border-color: #1f5b45; }
    .summary { padding: 0.4rem 1.5rem; font-size: 0.9rem; color: #666; flex-shrink: 0; }
    .map-body { flex: 1; min-height: 0; display: flex; }
    #map { flex: 1; min-height: 0; min-width: 0; }
    .result-list-panel { width: 300px; flex-shrink: 0; border-left: 1px solid #ddd; display: ${showPanel ? "flex" : "none"}; flex-direction: column; min-height: 0; }
    .result-sheet-toggle { display: none; }
    .result-list-scroll { flex: 1; min-height: 0; overflow-y: auto; }
    .result-list { list-style: none; }
    .result-item { border-bottom: 1px solid #eee; }
    .result-item.is-focused { background: #f0fbf4; }
    .result-link { display: block; padding: 0.55rem 0.85rem 0.3rem; text-decoration: none; color: inherit; }
    .result-link:hover { background: #f5fbf8; }
    .result-name { display: flex; align-items: baseline; gap: 0.4rem; font-size: 0.9rem; font-weight: bold; color: #1f5b45; }
    .result-count { font-size: 0.72rem; font-weight: normal; color: #888; white-space: nowrap; }
    .result-animals { font-size: 0.72rem; color: #666; line-height: 1.6; padding: 0 0.85rem 0.5rem; overflow-wrap: anywhere; }
    .result-animals a { color: #1f5b45; text-decoration: none; }
    .result-animals a:hover { text-decoration: underline; }
    .marker-active { filter: hue-rotate(160deg) saturate(2) brightness(1.1); }
    @media (max-width: ${MAP_MOBILE_BREAKPOINT}px) {
      .map-toolbar { padding: 0 0.75rem; }
      .list-link { display: flex; min-height: 44px; align-items: center; }
      .share-btn, .location-btn { min-height: 44px; }
      .search-form { display: grid; grid-template-columns: 1fr auto; padding: 0.65rem 0.75rem; }
      .search-form input { width: 100%; max-width: none; min-width: 0; min-height: 44px; grid-column: 1 / -1; }
      .search-form button, .search-form a { display: inline-flex; min-height: 44px; align-items: center; justify-content: center; }
      .summary { padding: 0.45rem 0.75rem; font-size: 0.8rem; line-height: 1.4; }
      .map-body { position: relative; }
      #map { min-height: 320px; }
      .result-list-panel { position: absolute; left: 0; right: 0; bottom: 0; width: auto; border-left: none; border-top: 1px solid #ddd; border-radius: 14px 14px 0 0; box-shadow: 0 -4px 18px rgba(0,0,0,0.18); max-height: min(68%, 420px); background: #fff; transform: translateY(0); transition: transform 0.2s ease-in-out; padding-bottom: env(safe-area-inset-bottom); }
      .result-list-panel.is-collapsed { transform: translateY(calc(100% - 44px - env(safe-area-inset-bottom))); }
      .result-list-scroll { overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; }
      .result-sheet-toggle { display: flex; min-height: 44px; align-items: center; justify-content: center; border: 0; border-bottom: 1px solid #e8ece9; background: #fff; color: #1f5b45; font-size: 0.82rem; font-weight: bold; cursor: pointer; }
    }
  </style>
</head>
<body>
${renderSiteHeader()}
${renderGlobalNav("/map")}
  <nav class="map-toolbar">
    <a href="${buildBrowseUrl(activePref, animal)}" class="list-link">一覧で見る →</a>
    <div class="map-toolbar-actions">
      <button type="button" class="location-btn" id="location-btn">現在地から探す</button>
      <button type="button" class="share-btn" id="share-btn" aria-label="現在の地図状態のリンクをコピー">リンクをコピー</button>
    </div>
  </nav>
  <form class="search-form" action="/map" method="get">
    <input type="search" name="animal" value="${escapedAnimal}" placeholder="動物名で検索（例: パンダ）" aria-label="動物名で検索">
    <button type="submit">検索</button>
    ${animal ? `<a href="${buildMapUrl(activePref, null)}">クリア</a>` : ""}
  </form>
  <div class="cls-filter">${classChips}</div>
  <p class="summary">${summary}</p>
  ${mapStateMessage}
  <div class="map-body">
    <div id="map"></div>
    <aside class="result-list-panel" aria-label="検索結果一覧">
      <button type="button" class="result-sheet-toggle" aria-expanded="true">検索結果を閉じる</button>
      <div class="result-list-scroll">
        <ul class="result-list">${resultListHtml}</ul>
      </div>
    </aside>
  </div>
  <div class="share-toast" id="share-toast" role="status" aria-live="polite"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
  <script>
    var zoos = ${mapData};
    var mapInitLat = ${initialLat !== null ? String(initialLat) : "null"};
    var mapInitLon = ${initialLon !== null ? String(initialLon) : "null"};
    var mapInitZoom = ${initialZoom !== null ? String(initialZoom) : "null"};
    var map = (mapInitLat !== null && mapInitLon !== null && mapInitZoom !== null)
      ? L.map('map').setView([mapInitLat, mapInitLon], mapInitZoom)
      : L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    function esc(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    var markers = {};
    var resultItemsByZooId = {};
    var resultPanel = document.querySelector('.result-list-panel');
    var resultToggle = document.querySelector('.result-sheet-toggle');
    var mobileViewportQuery = window.matchMedia('(max-width: ${MAP_MOBILE_BREAKPOINT}px)');
    var reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var isSheetOpen = !mobileViewportQuery.matches;
    var prevFocused = null;
    var prevMarker = null;
    var locationMarker = null;

    function shouldSmoothScroll() {
      return !reducedMotionQuery.matches;
    }

    function setSheetOpen(nextOpen) {
      isSheetOpen = nextOpen;
      if (!resultPanel || !resultToggle) return;
      resultPanel.classList.toggle('is-collapsed', !isSheetOpen);
      resultToggle.setAttribute('aria-expanded', isSheetOpen ? 'true' : 'false');
      resultToggle.textContent = isSheetOpen ? '検索結果を閉じる' : '検索結果を開く';
    }

    if (resultToggle) {
      resultToggle.addEventListener('click', function() {
        setSheetOpen(!isSheetOpen);
      });
      setSheetOpen(isSheetOpen);
      var syncSheetToViewport = function(event) {
        setSheetOpen(!event.matches);
      };
      if (mobileViewportQuery.addEventListener) {
        mobileViewportQuery.addEventListener('change', syncSheetToViewport);
      } else if (mobileViewportQuery.addListener) {
        mobileViewportQuery.addListener(syncSheetToViewport);
      }
    }

    if (resultPanel) {
      // Prevent Leaflet from capturing scroll/wheel events within the bottom sheet panel,
      // which would otherwise zoom or pan the map while the user scrolls the result list.
      L.DomEvent.disableScrollPropagation(resultPanel);
    }

    if (window.visualViewport) {
      // On iOS Safari the visual viewport changes height when the address bar shows or
      // hides, but the layout viewport does not fire a regular resize event in time.
      // Calling invalidateSize() ensures Leaflet recalculates the map container size
      // after such changes so tiles and controls remain correctly positioned.
      window.visualViewport.addEventListener('resize', function() {
        map.invalidateSize();
      });
    }

    function activateResult(id, options) {
      options = options || {};
      if (options.openSheet || options.scroll) {
        setSheetOpen(true);
      }
      var item = resultItemsByZooId[id];
      if (item) {
        if (prevFocused) prevFocused.classList.remove('is-focused');
        item.classList.add('is-focused');
        prevFocused = item;
        if (options.scroll) item.scrollIntoView({ block: 'nearest', behavior: shouldSmoothScroll() ? 'smooth' : 'auto' });
      }
      if (prevMarker) {
        var prevEl = prevMarker.getElement();
        if (prevEl) prevEl.classList.remove('marker-active');
      }
      var marker = markers[id];
      if (marker) {
        var markerEl = marker.getElement();
        if (markerEl) markerEl.classList.add('marker-active');
        marker.openPopup();
        prevMarker = marker;
      }
    }

    function distanceInKm(lat1, lon1, lat2, lon2) {
      var radians = Math.PI / 180;
      var dLat = (lat2 - lat1) * radians;
      var dLon = (lon2 - lon1) * radians;
      var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * radians) * Math.cos(lat2 * radians) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function formatDistance(km) {
      return km < 1 ? Math.round(km * 1000) + 'm' : km.toFixed(km < 10 ? 1 : 0) + 'km';
    }

    function sortResultsByDistance(lat, lon) {
      var list = document.querySelector('.result-list');
      if (!list) return;
      var items = Object.keys(resultItemsByZooId).map(function(id) {
        var zoo = zoos.find(function(item) { return item.id === id; });
        var item = resultItemsByZooId[id];
        return { zoo: zoo, item: item, distance: zoo ? distanceInKm(lat, lon, zoo.lat, zoo.lon) : Infinity };
      }).filter(function(entry) { return entry.zoo && entry.item; });
      items.sort(function(a, b) { return a.distance - b.distance; });
      items.forEach(function(entry) {
        var name = entry.item.querySelector('.result-name');
        var distance = entry.item.querySelector('.result-distance');
        if (!distance) {
          distance = document.createElement('span');
          distance.className = 'result-distance';
          name.appendChild(distance);
        }
        distance.textContent = formatDistance(entry.distance);
        list.appendChild(entry.item);
      });
    }

    zoos.forEach(function(zoo) {
      var matchLine = ${animal ? "true" : "false"} ? '<br><span>検索ヒット: ' + zoo.matchCount + ' 件</span>' : '';
      var animalCountLine = '<br><span>動物種数: ' + (zoo.animalCount > 0 ? zoo.animalCount + ' 種' : '未取得') + '</span>';
      var marker = L.marker([zoo.lat, zoo.lon])
        .bindPopup('<b><a href="/zoos/' + esc(zoo.id) + '${activePref ? `?pref=${activePref}` : ""}">' + esc(zoo.name) + '</a></b>' + matchLine + animalCountLine)
        .addTo(map);
      marker.on('click', function() {
        activateResult(zoo.id, { openSheet: true, scroll: true });
      });
      markers[zoo.id] = marker;
    });
    if (mapInitLat === null || mapInitLon === null || mapInitZoom === null) {
      if (zoos.length > 0) {
        var bounds = L.latLngBounds(zoos.map(function(z) { return [z.lat, z.lon]; }));
        map.fitBounds(bounds, { padding: [40, 40] });
      } else {
        map.setView([34.7, 135.5], 8);
      }
    }

    function updateUrlFromMap() {
      var center = map.getCenter();
      var zoom = map.getZoom();
      var lat = Math.round(center.lat * 10000) / 10000;
      var lon = Math.round(center.lng * 10000) / 10000;
      var z = Math.round(zoom * 10) / 10;
      var url = new URL(window.location.href);
      url.searchParams.set('lat', String(lat));
      url.searchParams.set('lon', String(lon));
      url.searchParams.set('z', String(z));
      history.replaceState(null, '', url.toString());
    }
    map.on('moveend', updateUrlFromMap);
    map.on('zoomend', updateUrlFromMap);

    var shareBtn = document.getElementById('share-btn');
    var shareToast = document.getElementById('share-toast');
    var toastTimer = null;

    function showToast(msg, isError) {
      if (!shareToast) return;
      shareToast.textContent = msg;
      shareToast.className = 'share-toast ' + (isError ? 'share-toast--error' : 'share-toast--ok');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function() {
        shareToast.className = 'share-toast';
      }, 3000);
    }

    if (shareBtn) {
      shareBtn.addEventListener('click', function() {
        updateUrlFromMap();
        var shareUrl = window.location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(shareUrl).then(function() {
            showToast('URLをコピーしました', false);
          }, function() {
            showToast('コピーに失敗しました', true);
          });
        } else {
          try {
            var ta = document.createElement('textarea');
            ta.value = shareUrl;
            ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
            ta.setAttribute('readonly', '');
            document.body.appendChild(ta);
            ta.setSelectionRange(0, ta.value.length);
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('URLをコピーしました', false);
          } catch (e) {
            showToast('コピーに失敗しました', true);
          }
        }
      });
    }

    var locationBtn = document.getElementById('location-btn');
    if (locationBtn) {
      locationBtn.addEventListener('click', function() {
        if (!navigator.geolocation) {
          showToast('このブラウザでは現在地を取得できません', true);
          return;
        }
        locationBtn.disabled = true;
        locationBtn.textContent = '現在地を取得中…';
        navigator.geolocation.getCurrentPosition(function(position) {
          var lat = position.coords.latitude;
          var lon = position.coords.longitude;
          if (locationMarker) map.removeLayer(locationMarker);
          locationMarker = L.circleMarker([lat, lon], {
            radius: 9, color: '#155eef', weight: 3, fillColor: '#fff', fillOpacity: 1
          }).addTo(map).bindPopup('現在地').openPopup();
          map.setView([lat, lon], Math.max(map.getZoom(), 11));
          sortResultsByDistance(lat, lon);
          locationBtn.disabled = false;
          locationBtn.textContent = '現在地から探す';
          showToast('近い順に並べ替えました', false);
        }, function(error) {
          locationBtn.disabled = false;
          locationBtn.textContent = '現在地から探す';
          showToast(error.code === 1 ? '現在地の利用が許可されませんでした' : '現在地を取得できませんでした', true);
        }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
      });
    }

    document.querySelectorAll('.result-item').forEach(function(item) {
      var id = item.dataset.zooId;
      if (id) resultItemsByZooId[id] = item;
      function activate() {
        if (id) activateResult(id);
      }
      item.addEventListener('mouseenter', activate);
      item.addEventListener('focusin', activate);
      item.addEventListener('click', function() {
        if (id) activateResult(id, { openSheet: true });
      });
    });
  </script>
</body>
</html>`;
}
