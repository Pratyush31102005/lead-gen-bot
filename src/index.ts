import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import { fetchRssLeads } from './rss.js';
import { fetchXHandle } from './scraper.js';
import { qualifyLead } from './gemini.js';
import type { QualifiedLead } from './types.js';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('ERROR: GEMINI_API_KEY is not set in .env');
    process.exit(1);
  }

  console.log('Fetching Product Hunt RSS feed...');
  const leads = await fetchRssLeads();
  console.log(`Found ${leads.length} leads\n`);

  const qualified: QualifiedLead[] = [];

  for (const lead of leads) {
    try {
      console.log(`Processing: ${lead.title}`);

      const { handle: xHandle, externalUrl } = await fetchXHandle(lead.link);
      console.log(`  X handle: ${xHandle ?? 'not found'}`);
      if (externalUrl) console.log(`  Website: ${externalUrl}`);

      const result = await qualifyLead(lead, xHandle, externalUrl);

      if (result.isGoodFit) {
        qualified.push(result);
        console.log(`  ✓ GOOD FIT — ${result.fitReason}`);
      } else {
        console.log(`  ✗ Skipped — ${result.fitReason}`);
      }

      console.log('');
    } catch (err) {
      console.error(`  ✗ Failed to process "${lead.title}":`, err);
      console.log('');
    }

    // Respect Gemini free-tier rate limit: 5 RPM, 20 RPD
    await delay(15_000);
  }

  console.log('='.repeat(60));
  console.log(`Qualified leads: ${qualified.length} / ${leads.length}`);
  console.log('='.repeat(60));

  for (const lead of qualified) {
    console.log(`\n[✓] ${lead.companyName}`);
    console.log(`    What they do: ${lead.whatTheyDo}`);
    console.log(`    X handle: ${lead.xHandle ?? 'N/A'}`);
    console.log(`    Website: ${lead.websiteUrl}`);
    console.log(`    Reason: ${lead.fitReason}`);
    console.log(`    Pitch:\n${lead.customPitch}`);
  }

  writeFileSync('leads.json', JSON.stringify(qualified, null, 2));
  console.log(`\nSaved ${qualified.length} qualified leads to leads.json`);
}

main();
