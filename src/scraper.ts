import * as cheerio from 'cheerio';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const xPatterns = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?$/;

async function fetchHtml(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractXHandle(html: string): string | null {
  const $ = cheerio.load(html);

  // 1. Check <meta name="twitter:site"> and <meta name="twitter:creator">
  for (const attr of ['twitter:site', 'twitter:creator']) {
    const content = $(`meta[name="${attr}"]`).attr('content');
    if (content) {
      const match = content.match(/@?([a-zA-Z0-9_]+)/);
      if (match) return match[1];
    }
  }

  // 2. Check <meta property="og:url">
  const ogUrl = $('meta[property="og:url"]').attr('content');
  if (ogUrl) {
    const match = ogUrl.match(xPatterns);
    if (match) return match[1];
  }

  // 3. Scan all <a> hrefs
  for (const el of $('a[href]').toArray()) {
    const href = $(el).attr('href') ?? '';
    const match = href.match(xPatterns);
    if (match) return match[1];
  }

  // 4. Regex scan raw HTML as a last resort
  const htmlMatch = html.match(xPatterns);
  if (htmlMatch) return htmlMatch[1];

  return null;
}

async function getExternalUrl(phUrl: string): Promise<string | null> {
  const html = await fetchHtml(phUrl);
  if (!html) return null;

  const $ = cheerio.load(html);

  // Product Hunt pages link to the product's external site
  // Look for the "Website" link or similar external link patterns
  for (const el of $('a[href]').toArray()) {
    const href = $(el).attr('href') ?? '';
    // Skip internal PH links, social links, and common non-product domains
    if (
      href.startsWith('#') ||
      href.includes('producthunt.com') ||
      href.includes('twitter.com') ||
      href.includes('x.com') ||
      href.includes('facebook.com') ||
      href.includes('linkedin.com') ||
      href.includes('instagram.com') ||
      href.includes('youtube.com') ||
      href.includes('github.com') ||
      href.includes('mailto:')
    ) {
      continue;
    }
    // Must be a real external HTTP(S) URL
    if (/^https?:\/\/.+\..+/.test(href)) {
      return href;
    }
  }

  return null;
}

export async function fetchXHandle(url: string): Promise<{ handle: string | null; externalUrl: string | null }> {
  // Step 1: Try to find the actual product website from the Product Hunt page
  const externalUrl = await getExternalUrl(url);

  // Step 2: Scrape the external site for X handles
  if (externalUrl) {
    const html = await fetchHtml(externalUrl);
    if (html) {
      const handle = extractXHandle(html);
      if (handle) return { handle, externalUrl };
    }
  }

  // Step 3: Fallback — scrape the Product Hunt page itself
  const phHtml = await fetchHtml(url);
  if (phHtml) {
    const handle = extractXHandle(phHtml);
    return { handle, externalUrl };
  }

  return { handle: null, externalUrl };
}
