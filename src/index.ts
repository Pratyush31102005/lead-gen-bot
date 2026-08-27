import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Lead } from './types.js';
import { writeFileSync } from 'node:fs';
import { fetchRssLeads } from './rss.js';

chromium.use(StealthPlugin());

const xPatterns = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?$/;
const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const junkDomains = ['example.com', 'sentry.io', 'vercel.com', 'github.io', 'images', 'schema.org', 'w3.org', 'googleapis.com', 'gstatic.com', 'facebook.com', 'twitter.com', 'x.com'];

function extractFromHtml(html: string): { xHandle: string | null; email: string | null } {
  const xMatch = html.match(xPatterns);
  const xHandle = xMatch && xMatch[1].length > 1 ? xMatch[1] : null;

  const emails = html.match(emailPattern) || [];
  const filtered = [...new Set(emails)].filter((e) => {
    const domain = e.split('@')[1]?.toLowerCase() || '';
    return !junkDomains.some((d) => domain.includes(d));
  });

  return { xHandle, email: filtered[0] || null };
}

async function main() {
  console.log('Fetching Product Hunt RSS feed...');
  const rssLeads = await fetchRssLeads();
  console.log(`Found ${rssLeads.length} leads\n`);

  const browser = await chromium.launch({ headless: true });
  const leads: Lead[] = [];

  try {
    for (const rss of rssLeads) {
      try {
        process.stdout.write(`Processing: ${rss.title}...`);

        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
        });

        try {
          await page.goto(rss.link, { waitUntil: 'networkidle', timeout: 20000 });
          await page.waitForTimeout(3000);

          const html = await page.content();

          // Check if we hit Cloudflare
          if (html.includes('cloudflare') || html.includes('challenge')) {
            console.log(' (Cloudflare blocked)');
            leads.push({
              companyName: rss.title,
              description: rss.contentSnippet.substring(0, 200),
              xHandle: null,
              email: null,
              websiteUrl: rss.link,
              sourceUrl: rss.link,
              scrapedAt: new Date().toISOString(),
            });
            continue;
          }

          // Find external website
          const externalUrl = await page.evaluate(() => {
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
                return href;
              }
            }
            return null;
          });

          const phData = extractFromHtml(html);

          // Try scraping external site
          let extData = { xHandle: null as string | null, email: null as string | null };
          if (externalUrl && !externalUrl.includes('cloudflare')) {
            try {
              const extPage = await browser.newPage();
              await extPage.goto(externalUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
              await extPage.waitForTimeout(1500);
              const extHtml = await extPage.content();
              extData = extractFromHtml(extHtml);
              await extPage.close();
            } catch {
              // External site failed, use PH data
            }
          }

          leads.push({
            companyName: rss.title,
            description: rss.contentSnippet.substring(0, 200),
            xHandle: extData.xHandle || phData.xHandle,
            email: extData.email || phData.email,
            websiteUrl: externalUrl || rss.link,
            sourceUrl: rss.link,
            scrapedAt: new Date().toISOString(),
          });

          const xHandle = extData.xHandle || phData.xHandle;
          const email = extData.email || phData.email;
          const contacts = [xHandle ? `X: @${xHandle}` : '', email ? `Email: ${email}` : ''].filter(Boolean).join(', ');
          console.log(` ${contacts || 'no contacts found'}`);
        } finally {
          await page.close();
        }
      } catch (err) {
        console.log(` failed: ${err}`);
      }
    }
  } finally {
    await browser.close();
  }

  writeFileSync('leads.json', JSON.stringify(leads, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log(`Scraped ${leads.length} leads`);
  console.log(`With X handle: ${leads.filter((l) => l.xHandle).length}`);
  console.log(`With email: ${leads.filter((l) => l.email).length}`);
  console.log('='.repeat(60));

  console.log('\nCompany | X Handle | Email | Website');
  console.log('-'.repeat(80));
  for (const lead of leads) {
    console.log(
      `${lead.companyName} | ${lead.xHandle ? '@' + lead.xHandle : '—'} | ${lead.email || '—'} | ${lead.websiteUrl}`
    );
  }

  console.log(`\nSaved to leads.json`);
}

main();
