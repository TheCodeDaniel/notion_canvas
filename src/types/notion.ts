// src/types/notion.ts

export interface RichTextItem {
  type: string;
  plain_text: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
    code?: boolean;
    color?: string;
  };
}

export interface NotionBlock {
  id: string;
  type: string;
  has_children: boolean;
  children?: NotionBlock[];
  // Block content keyed by block type (e.g. block.paragraph.rich_text)
  [key: string]: unknown;
}

export interface NotionPage {
  id: string;
  object: 'page';
  properties: Record<string, unknown>;
  url: string;
  [key: string]: unknown;
}

export interface NotionContent {
  pageId: string;
  title: string;
  url: string;
  properties: Record<string, unknown>;
  blocks: NotionBlock[];
  /** Flat plain-text summary of all block content (used for Claude prompt) */
  plainText: string;
}

export interface NotionDatabaseEntry {
  id: string;
  properties: Record<string, unknown>;
  url: string;
}
