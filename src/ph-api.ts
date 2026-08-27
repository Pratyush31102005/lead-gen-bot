// Product Hunt data extraction via RSS + scraping
// RSS works reliably, then we scrape external sites for contacts

import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
});

export interface PhProduct {
  name: string;
  tagline: string;
  description: string;
  url: string;
  website: string | null;
  votesCount: number;
  createdAt: string;
  topics: string[];
}

export async function fetchRecentProducts(): Promise<PhProduct[]> {
  const feed = await parser.parseURL('https://www.producthunt.com/feed');

  return feed.items.slice(0, 20).map((item) => ({
    name: item.title || 'Unknown',
    tagline: item.contentSnippet?.substring(0, 100) || '',
    description: item.contentSnippet || '',
    url: item.link || '',
    website: null, // Will be found by scraping
    votesCount: 0,
    createdAt: item.pubDate || new Date().toISOString(),
    topics: [],
  }));
}

export async function findWebsiteUrl(phUrl: string): Promise<string | null> {
  try {
    const res = await fetch(phUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'follow',
    });

    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    // Find external website link
    for (const el of $('a[href]').toArray()) {
      const href = $(el).attr('href') ?? '';
      if (
        href.startsWith('http') &&
        !href.includes('producthunt.com') &&
        !href.includes('twitter.com') &&
        !href.includes('x.com') &&
        !href.includes('facebook.com') &&
        !href.includes('linkedin.com') &&
        !href.includes('instagram.com') &&
        !href.includes('cloudflare.com')
      ) {
        return href;
      }
    }

    return null;
  } catch {
    return null;
  }
}
