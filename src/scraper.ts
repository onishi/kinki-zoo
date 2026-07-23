export interface ScrapeResult {
  zooId: string;
  animals: string[];
  scrapedAt: string;
  error?: string;
}

interface ZooScraperConfig {
  /** URL(s) of pages listing animals */
  animalsUrl?: string;
  animalsUrls?: string[];
  /** CSS selectors (comma-separated) for elements containing animal names */
  nameSelector: string;
  /** CSS selectors for elements whose attribute contains animal names */
  attributeSelector?: string;
  /** Attribute to read for attributeSelector (default: alt) */
  attributeName?: string;
  /** CSS selectors for elements that separate multiple names inside a selected element */
  breakSelector?: string;
  /** Regex string with one capture group for names in static HTML */
  htmlTextPattern?: string;
  /** Minimum character length for a valid animal name (default: 2) */
  minLength?: number;
  /** Maximum character length for a valid animal name (default: 20) */
  maxLength?: number;
}

const SCRAPER_CONFIGS: Record<string, ZooScraperConfig> = {
  "tennoji-zoo": {
    animalsUrls: [
      "https://www.tennojizoo.jp/picturebook/savanna/",
      "https://www.tennojizoo.jp/picturebook/asia/",
      "https://www.tennojizoo.jp/picturebook/fureai/",
      "https://www.tennojizoo.jp/picturebook/bird/",
    ],
    nameSelector: ".l-picbook-category-item .anc",
    minLength: 2,
    maxLength: 20,
  },
  "ikeda-zoo": {
    animalsUrl: "https://www.satsukiyamazoo.com/species/",
    nameSelector: ".sr-only",
    attributeSelector: 'a[href^="/species/"] img[alt]',
    minLength: 2,
    maxLength: 20,
  },
  "kyoto-zoo": {
    animalsUrl: "https://zoo.city.kyoto.lg.jp/zoo/animals/",
    nameSelector: ".title",
    minLength: 2,
    maxLength: 20,
  },
  "kobe-oji-zoo": {
    animalsUrl: "https://www.kobe-ojizoo.jp/animal/pictorial/",
    nameSelector: ".blkC td a",
    minLength: 2,
    maxLength: 20,
  },
  "kobe-animal-kingdom": {
    animalsUrl: "https://www.kobe-oukoku.com/animals",
    nameSelector: "main h3",
    htmlTextPattern: '\\\\"name\\\\":\\\\"([^"\\\\]+)\\\\"',
    minLength: 2,
    maxLength: 30,
  },
  "himeji-zoo": {
    animalsUrl: "https://www.city.himeji.lg.jp/dobutuen/0000007334.html",
    nameSelector: "#tmp_contents td",
    breakSelector: "#tmp_contents td br",
    htmlTextPattern: ">([^<>\\n]+?)<br\\s*/?>",
    minLength: 2,
    maxLength: 30,
  },
  "himeji-central-park": {
    animalsUrls: [
      "https://www.central-park.co.jp/safari/drivethrough/animals.html",
      "https://www.central-park.co.jp/safari/walking/animals.html",
      "https://www.central-park.co.jp/safari/childs-farm/animals.html",
    ],
    nameSelector: ".scraper-animal-name",
    attributeSelector: "#Main .sec .box li img[alt]",
    minLength: 2,
    maxLength: 30,
  },
  "awaji-farm-park": {
    animalsUrl: "https://www.england-hill.com/animal/",
    nameSelector: ".facility__detail-item, .modal__title, .feature__slide-figcaption",
    minLength: 2,
    maxLength: 20,
  },
  "gokatsura-animal-park": {
    animalsUrls: [
      "https://gokatsura.jp/animals-list/oinai-zone/",
      "https://gokatsura.jp/animals-list/mooboo-room/",
      "https://gokatsura.jp/animals-list/cliff-zone/",
      "https://gokatsura.jp/animals-list/kyun2-room/",
      "https://gokatsura.jp/dokidoki-room/",
      "https://gokatsura.jp/animals-list/me-be-zone/",
      "https://gokatsura.jp/animals-list/moko-me-house/",
      "https://gokatsura.jp/animals-list/new-area/",
      "https://gokatsura.jp/animals-list/serow-conservation-facility/",
      "https://gokatsura.jp/animals-list/information-center/",
    ],
    nameSelector: ".post_content p.is-style-border_left",
    minLength: 2,
    maxLength: 30,
  },
  "adventure-world": {
    animalsUrls: [
      "https://www.aws-s.com/animals/sea-animals/",
      "https://www.aws-s.com/animals/carnivore/",
      "https://www.aws-s.com/animals/herbivore/",
      "https://www.aws-s.com/animals/family/",
    ],
    nameSelector: ".animal-card__name",
    minLength: 2,
    maxLength: 30,
  },
  "wakayama-castle-zoo": {
    animalsUrl: "https://wakayamajo.jp/animal/map.html",
    nameSelector: ".img_yoko p",
    minLength: 2,
    maxLength: 20,
  },
};

class TextCollector {
  readonly texts: string[] = [];
  private chunks: string[] = [];

  flush(): void {
    const trimmed = this.chunks.join("").trim();
    if (trimmed) this.texts.push(trimmed);
    this.chunks = [];
  }

  text(chunk: Text): void {
    this.chunks.push(chunk.text);
    if (chunk.lastInTextNode) {
      this.flush();
    }
  }
}

class BreakCollector {
  constructor(private readonly textCollector: TextCollector) {}

  element(): void {
    this.textCollector.flush();
  }
}

class AttributeCollector {
  readonly texts: string[] = [];

  constructor(private readonly attributeName: string) {}

  element(element: Element): void {
    const value = element.getAttribute(this.attributeName);
    if (value) this.texts.push(value);
  }
}

function normalizeAnimalName(text: string): string[] {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/^[・●◆\s]+/, "")
    .replace(/詳しくみる/g, "")
    .trim();

  if (!normalized) return [];
  if (/お問い合わせ|関連団体|詳しくはこちら|園内マップ|公式|開園時間|動物園を|ご覧ください/.test(normalized)) {
    return [];
  }
  if (normalized === "動物園") return [];
  const withoutEnglish = normalized.replace(/[A-Za-z][A-Za-z\s.'’()-]*$/g, "").trim();
  const candidates = withoutEnglish
    .split(/[、,／/｜|]/)
    .map((candidate) => candidate.replace(/^[・●◆\s]+/, "").trim())
    .filter(Boolean);

  return candidates.length > 0 ? candidates : [withoutEnglish];
}

function hasJapanese(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(text);
}

export async function scrapeAnimals(zooId: string): Promise<ScrapeResult> {
  const config = SCRAPER_CONFIGS[zooId];
  const scrapedAt = new Date().toISOString();

  if (!config) {
    return {
      zooId,
      animals: [],
      scrapedAt,
      error: `スクレイピング設定が見つかりません: ${zooId}`,
    };
  }

  const urls = config.animalsUrls ?? (config.animalsUrl ? [config.animalsUrl] : []);
  const errors: string[] = [];
  const texts: string[] = [];

  for (const url of urls) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": "kinki-zoo-bot/1.0 (+https://github.com/onishi/kinki-zoo)",
          Accept: "text/html",
        },
      });
    } catch (err) {
      console.error(`[scraper] fetch failed for ${zooId}:`, err);
      errors.push(`ネットワークエラー: ${url}`);
      continue;
    }

    if (!response.ok) {
      errors.push(`HTTP ${response.status}: ${url}`);
      continue;
    }

    if (config.htmlTextPattern) {
      const html = await response.clone().text();
      const pattern = new RegExp(config.htmlTextPattern, "g");
      for (const match of html.matchAll(pattern)) {
        if (match[1]) texts.push(match[1]);
      }
    }

    const collector = new TextCollector();
    let rewriter = new HTMLRewriter().on(config.nameSelector, collector);
    if (config.breakSelector) {
      rewriter = rewriter.on(config.breakSelector, new BreakCollector(collector));
    }

    let attributeCollector: AttributeCollector | undefined;
    if (config.attributeSelector) {
      attributeCollector = new AttributeCollector(config.attributeName ?? "alt");
      rewriter = rewriter.on(config.attributeSelector, attributeCollector);
    }

    const transformed = rewriter.transform(response);
    await transformed.arrayBuffer();
    texts.push(...collector.texts);
    if (attributeCollector) texts.push(...attributeCollector.texts);
  }

  // Filter by character length to remove navigation items, headings, etc.
  // and retain typical Japanese animal name lengths (2–20 characters).
  const min = config.minLength ?? 2;
  const max = config.maxLength ?? 20;
  const animals = [
    ...new Set(
      texts
        .flatMap(normalizeAnimalName)
        .filter((t) => hasJapanese(t) && t.length >= min && t.length <= max),
    ),
  ];

  return {
    zooId,
    animals,
    scrapedAt,
    error: animals.length === 0 && errors.length > 0 ? errors.join("; ") : undefined,
  };
}

// ---- Zoo news scraping ----

export interface NewsItem {
  title: string;
  url: string;
  publishedAt: string | null;
}

interface NewsScraperConfig {
  rssUrl?: string;
  newsUrl?: string;
  linkSelector?: string;
  titleChildSelector?: string;
  dateChildSelector?: string;
}

const NEWS_SCRAPER_CONFIGS: Record<string, NewsScraperConfig> = {
  "tennoji-zoo": { rssUrl: "https://www.tennojizoo.jp/feed/" },
  "kyoto-zoo": { rssUrl: "https://zoo.city.kyoto.lg.jp/zoo/news/feed/" },
  "himeji-zoo": { rssUrl: "https://www.city.himeji.lg.jp/rss/rss_new_dobutuen.xml" },
  "awaji-farm-park": { rssUrl: "https://www.england-hill.com/feed/" },
  "gokatsura-animal-park": { rssUrl: "https://gokatsura.jp/feed/" },
  "ikeda-zoo": {
    newsUrl: "https://www.satsukiyamazoo.com/news/",
    linkSelector: "article a",
    titleChildSelector: "p",
    dateChildSelector: "time",
  },
  "adventure-world": {
    newsUrl: "https://www.aws-s.com/topics/",
    linkSelector: "ul li a[href]",
    titleChildSelector: "h3",
  },
};

function parseNewsDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  // RFC 822: "Wed, 23 Jul 2026 09:00:00 +0900"
  if (/^[A-Za-z]{3},/.test(s)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  // Japanese: "2026年7月23日" (possibly with brackets or day-of-week)
  const ja = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (ja) return `${ja[1]}-${ja[2].padStart(2, "0")}-${ja[3].padStart(2, "0")}`;
  // YYYY.MM.DD
  const dot = s.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (dot) return `${dot[1]}-${dot[2].padStart(2, "0")}-${dot[3].padStart(2, "0")}`;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // YYYY/MM/DD or "YYYY M/D"
  const slash = s.match(/(\d{4})[/ ](\d{1,2})\/(\d{1,2})/);
  if (slash) return `${slash[1]}-${slash[2].padStart(2, "0")}-${slash[3].padStart(2, "0")}`;
  return null;
}

function unescapeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function parseRssItems(xml: string, limit = 20): NewsItem[] {
  const items: NewsItem[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    if (items.length >= limit) break;
    const body = m[1];
    const rawTitle =
      body.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? "";
    const title = unescapeXmlEntities(rawTitle);
    const link =
      body.match(/<link>(https?:\/\/[^\s<]+)<\/link>/i)?.[1]?.trim() ??
      body.match(/<guid[^>]*>(https?:\/\/[^\s<]+)<\/guid>/i)?.[1]?.trim() ??
      "";
    const pubDateRaw =
      body.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? "";
    if (title && link) {
      items.push({ title, url: link, publishedAt: parseNewsDate(pubDateRaw) });
    }
  }
  return items;
}

class NewsHtmlCollector {
  readonly items: NewsItem[] = [];
  private current: { titleParts: string[]; dateParts: string[]; url: string } | null = null;

  onLink(element: Element, baseUrl: string): void {
    const href = element.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    let resolved: string;
    try {
      resolved = new URL(href, baseUrl).toString();
    } catch {
      resolved = href;
    }
    this.current = { titleParts: [], dateParts: [], url: resolved };
    element.onEndTag(() => {
      if (!this.current) return;
      const title = this.current.titleParts.join("").trim();
      if (title && this.current.url) {
        this.items.push({
          title,
          url: this.current.url,
          publishedAt: parseNewsDate(this.current.dateParts.join("").trim()),
        });
      }
      this.current = null;
    });
  }

  onTitle(chunk: Text): void {
    if (this.current) this.current.titleParts.push(chunk.text);
  }

  onDate(chunk: Text): void {
    if (this.current) this.current.dateParts.push(chunk.text);
  }
}

async function scrapeNewsFromHtml(config: NewsScraperConfig): Promise<NewsItem[]> {
  if (!config.newsUrl || !config.linkSelector) return [];
  let response: Response;
  try {
    response = await fetch(config.newsUrl, {
      headers: {
        "User-Agent": "kinki-zoo-bot/1.0 (+https://github.com/onishi/kinki-zoo)",
        Accept: "text/html",
      },
    });
  } catch {
    return [];
  }
  if (!response.ok) return [];

  const baseUrl = config.newsUrl;
  const collector = new NewsHtmlCollector();
  let rewriter = new HTMLRewriter().on(config.linkSelector, {
    element: (el) => collector.onLink(el, baseUrl),
  });
  if (config.titleChildSelector) {
    rewriter = rewriter.on(`${config.linkSelector} ${config.titleChildSelector}`, {
      text: (chunk) => collector.onTitle(chunk),
    });
  }
  if (config.dateChildSelector) {
    rewriter = rewriter.on(`${config.linkSelector} ${config.dateChildSelector}`, {
      text: (chunk) => collector.onDate(chunk),
    });
  }
  await rewriter.transform(response).arrayBuffer();
  return collector.items.slice(0, 20);
}

export async function scrapeZooNews(zooId: string): Promise<NewsItem[]> {
  const config = NEWS_SCRAPER_CONFIGS[zooId];
  if (!config) return [];
  try {
    if (config.rssUrl) {
      const response = await fetch(config.rssUrl, {
        headers: {
          "User-Agent": "kinki-zoo-bot/1.0 (+https://github.com/onishi/kinki-zoo)",
          Accept: "application/rss+xml, application/xml, text/xml",
        },
      });
      if (!response.ok) return [];
      const xml = await response.text();
      return parseRssItems(xml);
    }
    return await scrapeNewsFromHtml(config);
  } catch (err) {
    console.error(`[scraper] news fetch failed for ${zooId}:`, err);
    return [];
  }
}
