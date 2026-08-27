import * as cheerio from 'cheerio';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const xPatterns = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?$/;
const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const junkDomains = [
  'example.com', 'sentry.io', 'vercel.com', 'github.io', 'images',
  'schema.org', 'w3.org', 'googleapis.com', 'gstatic.com',
  'facebook.com', 'twitter.com', 'x.com', 'cloudflare.com',
  'analytics', 'tracking', 'pixel', 'beacon',
];

async function fetchHtml(url: string, timeoutMs = 8000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractXHandle(html: string): string | null {
  const $ = cheerio.load(html);

  // 1. Meta tags
  for (const attr of ['twitter:site', 'twitter:creator']) {
    const content = $(`meta[name="${attr}"]`).attr('content');
    if (content) {
      const match = content.match(/@?([a-zA-Z0-9_]+)/);
      if (match && match[1].length > 1) return match[1];
    }
  }

  // 2. Links
  for (const el of $('a[href]').toArray()) {
    const href = $(el).attr('href') ?? '';
    const match = href.match(xPatterns);
    if (match && match[1].length > 1) return match[1];
  }

  // 3. Raw HTML
  const htmlMatch = html.match(xPatterns);
  if (htmlMatch && htmlMatch[1].length > 1) return htmlMatch[1];

  return null;
}

function extractEmail(html: string): string | null {
  const $ = cheerio.load(html);

  // 1. mailto links
  for (const el of $('a[href^="mailto:"]').toArray()) {
    const href = $(el).attr('href') || '';
    const email = href.replace('mailto:', '').split('?')[0].trim();
    if (emailPattern.test(email)) return email;
  }

  // 2. Meta tags
  for (const attr of ['og:email', 'contact', 'email']) {
    const content = $(`meta[name="${attr}"], meta[property="${attr}"]`).attr('content');
    if (content && emailPattern.test(content)) {
      const m = content.match(emailPattern);
      if (m) return m[0];
    }
  }

  // 3. Raw HTML scan
  const emails = html.match(emailPattern) || [];
  const filtered = [...new Set(emails)].filter((e) => {
    const domain = e.split('@')[1]?.toLowerCase() || '';
    return !junkDomains.some((d) => domain.includes(d)) && !e.startsWith('noreply');
  });

  return filtered[0] || null;
}

export interface ScrapedContacts {
  xHandle: string | null;
  email: string | null;
}

export async function scrapeContacts(url: string): Promise<ScrapedContacts> {
  const html = await fetchHtml(url);
  if (!html) return { xHandle: null, email: null };

  return {
    xHandle: extractXHandle(html),
    email: extractEmail(html),
  };
}
