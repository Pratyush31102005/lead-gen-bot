import type { PhProduct } from './ph-api.js';

// Enterprise brands to skip
const ENTERPRISE_KEYWORDS = [
  'google', 'microsoft', 'apple', 'amazon', 'facebook', 'meta',
  'netflix', 'spotify', 'uber', 'airbnb', 'stripe', 'shopify',
  'salesforce', 'adobe', 'slack', 'notion', 'figma', 'canva',
  'dropbox', 'twitter', 'linkedin', 'github', 'gitlab', 'atlassian',
  'zoom', 'discord', 'twitch', 'reddit', 'pinterest', 'snapchat',
  'tiktok', 'openai', 'anthropic', 'nvidia', 'intel', 'amd',
  'samsung', 'sony', 'tesla', 'spacex',
];

export interface FilteredProduct extends PhProduct {
  isRelevant: boolean;
  reason: string;
}

function isEnterprise(product: PhProduct): boolean {
  const combined = (product.name + ' ' + product.tagline).toLowerCase();
  return ENTERPRISE_KEYWORDS.some((k) => combined.includes(k));
}

export function filterProducts(products: PhProduct[]): FilteredProduct[] {
  return products.map((product) => {
    // Skip enterprise
    if (isEnterprise(product)) {
      return { ...product, isRelevant: false, reason: 'Enterprise company' };
    }

    // Everything else is relevant (we'll scrape and see what we find)
    return { ...product, isRelevant: true, reason: 'Potential lead' };
  });
}
