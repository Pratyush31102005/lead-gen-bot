import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
});

export interface PhProduct {
  name: string;
  tagline: string;
  description: string;
  url: string;
  website: string | null;
  votesCount: number;
  createdAt: string;
  topics: string[];
  xHandle: string | null;
  email: string | null;
}

// ─── GraphQL API (primary — reliable, returns website + contacts) ────────────

const PH_GRAPHQL_URL = 'https://api.producthunt.com/v2/api/graphql';

const POSTS_QUERY = `
  query($first: Int!) {
    posts(first: $first, order: VOTES) {
      edges {
        node {
          id
          name
          tagline
          description
          url
          website
          votesCount
          createdAt
          topics {
            edges {
              node {
                name
              }
            }
          }
          user {
            name
            username
          }
        }
      }
    }
  }
`;

export async function fetchFromPhApi(token: string): Promise<PhProduct[]> {
  console.log('Using Product Hunt GraphQL API...');

  const res = await fetch(PH_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      query: POSTS_QUERY,
      variables: { first: 20 },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PH API error ${res.status}: ${text}`);
  }

  const data = await res.json();

  if (data.errors) {
    throw new Error(`PH API GraphQL errors: ${JSON.stringify(data.errors)}`);
  }

  const edges = data.data?.posts?.edges || [];

  return edges.map((edge: any) => {
    const node = edge.node;
    return {
      name: node.name || 'Unknown',
      tagline: node.tagline || '',
      description: node.description || node.tagline || '',
      url: node.url || '',
      website: node.website || null,
      votesCount: node.votesCount || 0,
      createdAt: node.createdAt || new Date().toISOString(),
      topics: (node.topics?.edges || []).map((t: any) => t.node.name),
      xHandle: null, // PH API doesn't provide twitter handle directly
      email: null,   // PH API doesn't provide email directly
    };
  });
}

// ─── RSS fallback (no token needed, but no website/contacts) ─────────────────

export async function fetchFromRss(): Promise<PhProduct[]> {
  console.log('Using RSS feed (no PH token — limited data)...');

  const feed = await parser.parseURL('https://www.producthunt.com/feed');

  return feed.items.slice(0, 20).map((item) => ({
    name: item.title || 'Unknown',
    tagline: item.contentSnippet?.substring(0, 100) || '',
    description: item.contentSnippet || '',
    url: item.link || '',
    website: null,
    votesCount: 0,
    createdAt: item.pubDate || new Date().toISOString(),
    topics: [],
    xHandle: null,
    email: null,
  }));
}

// ─── Unified fetcher ─────────────────────────────────────────────────────────

export async function fetchRecentProducts(): Promise<PhProduct[]> {
  const token = process.env.PH_TOKEN;

  if (token) {
    try {
      return await fetchFromPhApi(token);
    } catch (err) {
      console.error(`PH API failed, falling back to RSS: ${err}`);
      return await fetchFromRss();
    }
  }

  return await fetchFromRss();
}
