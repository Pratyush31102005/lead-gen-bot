import Parser from 'rss-parser';
import type { RssLead } from './types.js';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
});

export async function fetchRssLeads(): Promise<RssLead[]> {
  const feed = await parser.parseURL('https://www.producthunt.com/feed');

  return feed.items.slice(0, 10).map((item) => ({
    title: item.title ?? 'Unknown',
    link: item.link ?? '',
    contentSnippet: item.contentSnippet ?? '',
    pubDate: item.pubDate ?? '',
  }));
}
