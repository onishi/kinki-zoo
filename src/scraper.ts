export interface ScrapeResult {
  zooId: string;
  animals: string[];
  scrapedAt: string;
  error?: string;
}

interface ZooScraperConfig {
  /** URL of the page listing animals */
  animalsUrl: string;
  /** CSS selectors (comma-separated) for elements containing animal names */
  nameSelector: string;
  /** Minimum character length for a valid animal name (default: 2) */
  minLength?: number;
  /** Maximum character length for a valid animal name (default: 20) */
  maxLength?: number;
}

const SCRAPER_CONFIGS: Record<string, ZooScraperConfig> = {
  "tennoji-zoo": {
    animalsUrl: "https://www.tennojizoo.jp/animals/",
    nameSelector: "h2, h3, h4, .animal_name",
    minLength: 2,
    maxLength: 20,
  },
  "ikeda-zoo": {
    animalsUrl: "https://www.city.ikeda.osaka.jp/soshiki/6/339.html",
    nameSelector: "td, li",
    minLength: 2,
    maxLength: 20,
  },
  "kyoto-zoo": {
    animalsUrl: "https://www5.city.kyoto.jp/zoo/animals/",
    nameSelector: "h2, h3, .animal_name, .name",
    minLength: 2,
    maxLength: 20,
  },
  "kobe-oji-zoo": {
    animalsUrl: "https://www.city.kobe.lg.jp/oji-zoo/enjoy/animals/",
    nameSelector: "h3, h4, td",
    minLength: 2,
    maxLength: 20,
  },
  "himeji-zoo": {
    animalsUrl: "https://www.city.himeji.lg.jp/zoo/category/0300/",
    nameSelector: "h3, h4, td",
    minLength: 2,
    maxLength: 20,
  },
  "awaji-farm-park": {
    animalsUrl: "https://www.england-hill.com/enjoy/",
    nameSelector: "h3, h4, .title",
    minLength: 2,
    maxLength: 20,
  },
  "nara-koen-deer": {
    animalsUrl: "https://www.pref.nara.jp/1708.htm",
    nameSelector: "h2, h3, p, li",
    minLength: 2,
    maxLength: 20,
  },
  "adventure-world": {
    animalsUrl: "https://www.aws-s.com/adventure/animals/",
    nameSelector: "h3, h4, .animalName, .animal_name",
    minLength: 2,
    maxLength: 20,
  },
  "wakayama-castle-zoo": {
    animalsUrl: "https://www.city.wakayama.wakayama.jp/shisei/hokeneisei/1004234/1004412.html",
    nameSelector: "td, li, h3",
    minLength: 2,
    maxLength: 20,
  },
};

class TextCollector {
  readonly texts: string[] = [];
  private buf = "";

  text(chunk: Text): void {
    this.buf += chunk.text;
    if (chunk.lastInTextNode) {
      const trimmed = this.buf.trim();
      if (trimmed) this.texts.push(trimmed);
      this.buf = "";
    }
  }
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

  let response: Response;
  try {
    response = await fetch(config.animalsUrl, {
      headers: {
        "User-Agent": "kinki-zoo-bot/1.0 (+https://github.com/onishi/kinki-zoo)",
        Accept: "text/html",
      },
    });
  } catch (err) {
    return { zooId, animals: [], scrapedAt, error: `フェッチ失敗: ${err}` };
  }

  if (!response.ok) {
    return {
      zooId,
      animals: [],
      scrapedAt,
      error: `HTTP ${response.status}: ${config.animalsUrl}`,
    };
  }

  const collector = new TextCollector();
  const rewriter = new HTMLRewriter().on(config.nameSelector, collector);
  const transformed = rewriter.transform(response);
  await transformed.arrayBuffer();

  const min = config.minLength ?? 2;
  const max = config.maxLength ?? 20;
  const animals = [
    ...new Set(collector.texts.filter((t) => t.length >= min && t.length <= max)),
  ];

  return { zooId, animals, scrapedAt };
}
