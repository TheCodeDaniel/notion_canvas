// src/clients/notion.ts
import { Client } from '@notionhq/client';
import PQueue from 'p-queue';
import type { NotionContent, NotionBlock, NotionDatabaseEntry } from '../types/notion.js';
import { logger } from '../utils/logger.js';

const notion = new Client({ auth: process.env.NOTION_TOKEN });

// Rate limiter: max 1 request per 350ms ≈ 2.8 req/sec (safely under Notion's 3/sec limit)
const queue = new PQueue({ concurrency: 1, interval: 350, intervalCap: 1 });

const call = <T>(fn: () => Promise<T>): Promise<T> =>
  queue.add(fn, { throwOnTimeout: false }) as Promise<T>;

// ── Read a page and all its blocks recursively ──────────────────────────────
export async function readPage(pageIdOrUrl: string): Promise<NotionContent> {
  const pageId = extractPageId(pageIdOrUrl);
  logger.info(`Reading Notion page: ${pageId}`);

  const [page, blocks] = await Promise.all([
    call(() => notion.pages.retrieve({ page_id: pageId })),
    fetchAllBlocks(pageId),
  ]);

  return parseNotionContent(page as Record<string, unknown>, blocks);
}

// ── Paginate through all blocks (handles 100-block API page limit) ───────────
async function fetchAllBlocks(blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const res = await call(() =>
      notion.blocks.children.list({
        block_id: blockId,
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      })
    );

    for (const block of res.results as NotionBlock[]) {
      blocks.push(block);
      if (block.has_children) {
        block.children = await fetchAllBlocks(block.id);
      }
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return blocks;
}

// ── Parse raw Notion API response into NotionContent ────────────────────────
function parseNotionContent(page: Record<string, unknown>, blocks: NotionBlock[]): NotionContent {
  const properties = (page.properties ?? {}) as Record<string, unknown>;

  // Extract title from common property names
  let title = 'Untitled';
  for (const [, value] of Object.entries(properties)) {
    const prop = value as Record<string, unknown>;
    if (prop.type === 'title') {
      const titleArr = prop.title as Array<{ plain_text: string }>;
      title = titleArr.map((t) => t.plain_text).join('') || 'Untitled';
      break;
    }
  }

  const plainText = blocksToPlainText(blocks);

  return {
    pageId: page.id as string,
    title,
    url: page.url as string,
    properties,
    blocks,
    plainText,
  };
}

// ── Convert blocks to a flat plain-text string for Claude ───────────────────
function blocksToPlainText(blocks: NotionBlock[], depth = 0): string {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  for (const block of blocks) {
    const type = block.type as string;
    const content = block[type] as Record<string, unknown> | undefined;
    const richText = content?.rich_text as Array<{ plain_text: string }> | undefined;
    const text = richText?.map((t) => t.plain_text).join('') ?? '';

    switch (type) {
      case 'heading_1': lines.push(`${indent}# ${text}`); break;
      case 'heading_2': lines.push(`${indent}## ${text}`); break;
      case 'heading_3': lines.push(`${indent}### ${text}`); break;
      case 'paragraph': if (text) lines.push(`${indent}${text}`); break;
      case 'bulleted_list_item': lines.push(`${indent}- ${text}`); break;
      case 'numbered_list_item': lines.push(`${indent}1. ${text}`); break;
      case 'to_do': {
        const checked = (content?.checked as boolean) ? '[x]' : '[ ]';
        lines.push(`${indent}${checked} ${text}`);
        break;
      }
      case 'toggle': lines.push(`${indent}▶ ${text}`); break;
      case 'callout': lines.push(`${indent}💡 ${text}`); break;
      case 'quote': lines.push(`${indent}> ${text}`); break;
      case 'code': lines.push(`${indent}\`\`\`\n${indent}${text}\n${indent}\`\`\``); break;
      case 'divider': lines.push(`${indent}---`); break;
      default: if (text) lines.push(`${indent}${text}`);
    }

    if (block.children && block.children.length > 0) {
      lines.push(blocksToPlainText(block.children, depth + 1));
    }
  }

  return lines.join('\n');
}

// ── Extract page ID from full URL or bare ID ─────────────────────────────────
export function extractPageId(input: string): string {
  // https://notion.so/workspace/Page-Title-abc123def456 → abc123def456
  const match = input.match(/([a-f0-9]{32}|[a-f0-9-]{36})(?:[?#].*)?$/i);
  if (match) return match[1].replace(/-/g, '');

  // Bare 32-char ID
  if (/^[a-f0-9]{32}$/i.test(input)) return input;

  throw new Error(`Cannot extract Notion page ID from: ${input}`);
}

// ── Query a Notion database ───────────────────────────────────────────────────
export async function queryDatabase(
  databaseId: string,
  filter?: Record<string, unknown>
): Promise<NotionDatabaseEntry[]> {
  logger.info(`Querying Notion database: ${databaseId}`);

  const entries: NotionDatabaseEntry[] = [];
  let cursor: string | undefined;

  do {
    const res = await call(() =>
      notion.databases.query({
        database_id: databaseId,
        ...(filter ? { filter: filter as Parameters<typeof notion.databases.query>[0]['filter'] } : {}),
        ...(cursor ? { start_cursor: cursor } : {}),
        page_size: 100,
      })
    );

    for (const page of res.results) {
      const p = page as Record<string, unknown>;
      entries.push({
        id: p.id as string,
        properties: p.properties as Record<string, unknown>,
        url: p.url as string,
      });
    }

    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return entries;
}
