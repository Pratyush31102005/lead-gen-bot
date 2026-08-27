import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fetchRecentProducts } from './ph-api.js';
import { filterProducts } from './filter.js';
import { scrapeContacts } from './scraper.js';
import type { Lead } from './types.js';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log('=== Lead Gen Bot — Automated Lead Finder ===\n');

  const hasToken = !!process.env.PH_TOKEN;
  console.log(`PH Token: ${hasToken ? 'provided' : 'missing (using RSS fallback)'}\n`);

  // Step 1: Fetch recent products
  console.log('Fetching recent products from Product Hunt...');
  const products = await fetchRecentProducts();
  console.log(`Found ${products.length} products\n`);

  // Step 2: Filter for indie SaaS/AI
  console.log('Filtering for indie products...');
  const filtered = filterProducts(products);
  const relevant = filtered.filter((p) => p.isRelevant);
  console.log(`Kept ${relevant.length} / ${products.length} products\n`);

  // Step 3: Enrich with website scraping (for extra contacts)
  console.log('Enriching with website scraping...\n');
  const leads: Lead[] = [];

  for (const product of relevant) {
    try {
      process.stdout.write(`  ${product.name}...`);

      let websiteUrl = product.website;
      let xHandle = product.xHandle;
      let email = product.email;

      // If we have a website, scrape it for additional contact info
      if (websiteUrl) {
        const contacts = await scrapeContacts(websiteUrl);

        // Merge: prefer API data, fall back to scraped data
        if (!xHandle && contacts.xHandle) xHandle = contacts.xHandle;
        if (!email && contacts.email) email = contacts.email;

        const parts = [
          xHandle ? `X:@${xHandle}` : '',
          email ? `E:${email}` : '',
        ].filter(Boolean).join(' | ');

        console.log(` ${websiteUrl} ${parts ? '| ' + parts : ''}`);
      } else {
        console.log(' no website');
      }

      leads.push({
        companyName: product.name,
        description: product.description?.substring(0, 200) || product.tagline,
        tagline: product.tagline,
        xHandle,
        email,
        websiteUrl: websiteUrl || product.url,
        phUrl: product.url,
        sourceUrl: product.url,
        votesCount: product.votesCount,
        topics: product.topics,
        scrapedAt: new Date().toISOString(),
      });
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
  console.log(`With website: ${merged.filter((l) => l.websiteUrl !== l.phUrl).length}`);
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
