import { GoogleGenerativeAI } from '@google/generative-ai';
import type { RssLead, QualifiedLead } from './types.js';

const PORTFOLIO_URL = 'https://nextjs-template-seven-flame.vercel.app/';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function qualifyLead(
  lead: RssLead,
  xHandle: string | null,
  externalUrl: string | null,
): Promise<QualifiedLead> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const websiteUrl = externalUrl ?? lead.link;

  const prompt = `You are a lead qualification analyst for a freelance UI/UX designer who builds high-end Next.js landing pages.

Analyze this Product Hunt lead and determine if they are a good fit for a $350 custom Next.js landing page upgrade.

Lead data:
- Title: ${lead.title}
- Description: ${lead.contentSnippet}
- Product Hunt Link: ${lead.link}
- Actual product website: ${websiteUrl}
- X/Twitter handle found: ${xHandle ?? 'None found'}

Criteria for a good fit:
- Early-stage SaaS, tool, or indie product (not a massive enterprise)
- Has a website but the landing page looks basic, outdated, or could be improved
- Would benefit from a modern, high-converting landing page

Respond with STRICT JSON only (no markdown fences, no extra text):
{
  "companyName": "<extract or infer the company/product name>",
  "whatTheyDo": "<one sentence summary of what the product does>",
  "xHandle": ${xHandle ? `"${xHandle}"` : 'null'},
  "websiteUrl": "${websiteUrl}",
  "isGoodFit": <true or false>,
  "fitReason": "<if good fit: why they need a landing page upgrade. if not: why they don't>",
  "customPitch": "<if good fit: a 3-sentence DM pitching a $350 custom Next.js landing page build. Include the portfolio link ${PORTFOLIO_URL}. Be specific about what you'd improve for their product. if not good fit: empty string>"
}`;

  // Retry with exponential backoff on 429 rate limits
  const MAX_RETRIES = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      // Strip markdown code fences if Gemini wraps them
      const cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

      const parsed = JSON.parse(cleaned) as QualifiedLead;
      return parsed;
    } catch (err: any) {
      lastError = err;
      const is429 = err?.message?.includes('429') || err?.status === 429;

      if (is429 && attempt < MAX_RETRIES - 1) {
        // Extract retry delay from error message if available
        const retryMatch = err?.message?.match(/retryDelay['":\s]+(\d+)s/);
        const retrySeconds = retryMatch ? parseInt(retryMatch[1]) + 2 : 30 * (attempt + 1);
        console.log(`    Rate limited. Retrying in ${retrySeconds}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        await delay(retrySeconds * 1000);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}
