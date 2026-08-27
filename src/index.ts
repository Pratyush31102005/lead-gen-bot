import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fetchRecentProducts } from './ph-api.js';
import { filterProducts } from './filter.js';
import { scrapeContacts } from './scraper.js';
import type { Lead } from './types.js';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('=== Lead Gen Bot — Automated Lead Finder ===\n');

  // Step 1: Fetch recent products from PH RSS
  console.log('Fetching recent products from Product Hunt RSS...');
  const products = await fetchRecentProducts();
  console.log(`Found ${products.length} products\n`);

  // Step 2: Filter (keep all non-enterprise)
  console.log('Filtering for indie products...');
  const filtered = filterProducts(products);
  const relevant = filtered.filter((p) => p.isRelevant);
  console.log(`Kept ${relevant.length} / ${products.length} products\n`);

  // Step 3: Scrape each product's PH page and external website
  console.log('Scraping for X handles and emails...\n');
  const leads: Lead[] = [];

  for (const product of relevant) {
    try {
      process.stdout.write(`  ${product.name}...`);

      // Try to find website from PH page
      let websiteUrl = product.website;

      if (!websiteUrl) {
        // Try fetching the PH page for external links
        try {
          const res = await fetch(product.url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            redirect: 'follow',
          });
          if (res.ok) {
            const html = await res.text();
            // Simple regex to find external URLs
            const urlMatch = html.match(/href="(https?:\/\/(?!.*producthunt)[^"]+)"/);
            if (urlMatch) {
              websiteUrl = urlMatch[1];
            }
          }
        } catch {
          // PH page blocked, continue
        }
      }

      if (!websiteUrl) {
        console.log(' no website found');
        leads.push({
          companyName: product.name,
          description: product.description?.substring(0, 200) || product.tagline,
          tagline: product.tagline,
          xHandle: null,
          email: null,
          websiteUrl: product.url,
          sourceUrl: product.url,
          votesCount: product.votesCount,
          topics: product.topics,
          scrapedAt: new Date().toISOString(),
        });
        continue;
      }

      // Scrape the external website
      const contacts = await scrapeContacts(websiteUrl);

      const lead: Lead = {
        companyName: product.name,
        description: product.description?.substring(0, 200) || product.tagline,
        tagline: product.tagline,
        xHandle: contacts.xHandle,
        email: contacts.email,
        websiteUrl,
        sourceUrl: product.url,
        votesCount: product.votesCount,
        topics: product.topics,
        scrapedAt: new Date().toISOString(),
      };

      leads.push(lead);

      const parts = [
        contacts.xHandle ? `X:@${contacts.xHandle}` : '',
        contacts.email ? `E:${contacts.email}` : '',
      ].filter(Boolean).join(' | ');

      console.log(` ${websiteUrl} ${parts ? '| ' + parts : ''}`);
    } catch (err) {
      console.log(` error: ${err}`);
    }

    await delay(1500);
  }

  // Step 4: Load existing leads and merge (deduplicate)
  const existingLeads = loadExistingLeads();
  const merged = mergeLeads(existingLeads, leads);

  // Step 5: Save
  saveLeads(merged);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`New leads scraped: ${leads.length}`);
  console.log(`Total leads (with previous): ${merged.length}`);
  console.log(`With X handle: ${merged.filter((l) => l.xHandle).length}`);
  console.log(`With email: ${merged.filter((l) => l.email).length}`);
  console.log('='.repeat(60));

  // Print table
  console.log('\nCompany | X Handle | Email | Website');
  console.log('-'.repeat(90));
  for (const lead of leads) {
    console.log(
      `${lead.companyName} | ${lead.xHandle ? '@' + lead.xHandle : '—'} | ${lead.email || '—'} | ${lead.websiteUrl}`
    );
  }

  console.log(`\nSaved ${merged.length} leads to leads.json`);
}

function loadExistingLeads(): Lead[] {
  if (!existsSync('leads.json')) return [];
  try {
    const data = readFileSync('leads.json', 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function mergeLeads(existing: Lead[], newLeads: Lead[]): Lead[] {
  const seen = new Set(existing.map((l) => l.sourceUrl));
  const merged = [...existing];

  for (const lead of newLeads) {
    if (!seen.has(lead.sourceUrl)) {
      merged.push(lead);
      seen.add(lead.sourceUrl);
    }
  }

  return merged;
}

function saveLeads(leads: Lead[]) {
  writeFileSync('leads.json', JSON.stringify(leads, null, 2));
}

main();
