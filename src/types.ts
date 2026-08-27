export interface Lead {
  companyName: string;
  description: string;
  tagline: string;
  xHandle: string | null;
  email: string | null;
  websiteUrl: string;
  phUrl: string;
  sourceUrl: string;
  votesCount: number;
  topics: string[];
  scrapedAt: string;
}
