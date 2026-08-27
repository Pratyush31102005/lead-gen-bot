export interface RssLead {
  title: string;
  link: string;
  contentSnippet: string;
  pubDate: string;
}

export interface QualifiedLead {
  companyName: string;
  whatTheyDo: string;
  xHandle: string | null;
  websiteUrl: string;
  isGoodFit: boolean;
  fitReason: string;
  customPitch: string;
}
