// src/tools/notion_read_page.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readPage } from '../clients/notion.js';
import { logger } from '../utils/logger.js';

const InputSchema = z.object({
  page_id_or_url: z.string().describe('Notion page URL or 32-character page ID'),
});

export function registerNotionReadPage(server: McpServer): void {
  server.tool(
    'notion_read_page',
    'Read and return the structured content of a Notion page (title, blocks, plain text).',
    InputSchema.shape,
    async (input) => {
      try {
        logger.info(`notion_read_page: ${input.page_id_or_url}`);
        const content = await readPage(input.page_id_or_url);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  pageId: content.pageId,
                  title: content.title,
                  url: content.url,
                  plainText: content.plainText,
                  blockCount: content.blocks.length,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const hint = message.includes('Could not find page') || message.includes('404')
          ? ' Make sure the page is shared with your NotionCanvas integration.'
          : '';
        logger.error('notion_read_page failed:', message);
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: message + hint }) }],
          isError: true,
        };
      }
    },
  );
}
