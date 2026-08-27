import { chromium } from 'playwright';

const xPatterns = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?$/;
const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const junkDomains = ['example.com', 'sentry.io', 'vercel.com', 'github.io', 'images', 'schema.org', 'w3.org', 'googleapis.com', 'gstatic.com', 'facebook.com', 'twitter.com', 'x.com'];

function extractXHandle(html: string): string | null {
  const match = html.match(xPatterns);
  if (match && match[1].length > 1 && !junkDomains.some((d) => match[1].toLowerCase().includes(d))) {
    return match[1];
  }
  return null;
}

function extractEmail(html: string): string | null {
  const emails = html.match(emailPattern) || [];
  const filtered = [...new Set(emails)].filter((e) => {
    const domain = e.split('@')[1]?.toLowerCase() || '';
    return !junkDomains.some((d) => domain.includes(d));
  });
  return filtered[0] || null;
}

export async function scrapeLead(phUrl: string): Promise<{
  xHandle: string | null;
  email: string | null;
  websiteUrl: string | null;
}> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Go to PH page
    await page.goto(phUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000); // Wait for SPA to render

    // Extract data from the rendered page
    const data = await page.evaluate(() => {
      const xPattern = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?$/;
      const emailP = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

      // Find X handle
      let xHandle: string | null = null;
      for (const el of document.querySelectorAll('a[href]')) {
        const href = el.getAttribute('href') || '';
        const m = href.match(xPattern);
        if (m && m[1].length > 1) { xHandle = m[1]; break; }
      }

      // Find email
      let email: string | null = null;
      for (const el of document.querySelectorAll('a[href^="mailto:"]')) {
        const e = (el.getAttribute('href') || '').replace('mailto:', '').split('?')[0].trim();
        if (emailP.test(e)) { email = e; break; }
      }
      if (!email) {
        const html = document.documentElement.innerHTML;
        const emails = html.match(emailP) || [];
        if (emails.length > 0) email = emails[0];
      }

      // Find external website URL
      let websiteUrl: string | null = null;
      for (const el of document.querySelectorAll('a[href]')) {
        const href = el.getAttribute('href') || '';
        if (
          href.startsWith('http') &&
          !href.includes('producthunt.com') &&
          !href.includes('twitter.com') &&
          !href.includes('x.com') &&
          !href.includes('facebook.com') &&
          !href.includes('linkedin.com')
        ) {
          websiteUrl = href;
          break;
        }
      }

      return { xHandle, email, websiteUrl };
    });

    return data;
  } catch (err) {
    console.error(`  Playwright error: ${err}`);
    return { xHandle: null, email: null, websiteUrl: null };
  } finally {
    await browser.close();
  }
}
