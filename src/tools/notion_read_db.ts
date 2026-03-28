// src/tools/notion_read_db.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { queryDatabase } from '../clients/notion.js';
import { logger } from '../utils/logger.js';

const InputSchema = z.object({
  database_id: z.string().describe('Notion database ID or URL'),
  filter: z
    .string()
    .optional()
    .describe('Optional Notion filter as a JSON string (Notion filter object format)'),
});

export function registerNotionReadDb(server: McpServer): void {
  server.tool(
    'notion_read_db',
    'Query a Notion database and return all entries with their properties.',
    InputSchema.shape,
    async (input) => {
      try {
        logger.info(`notion_read_db: ${input.database_id}`);

        let filter: Record<string, unknown> | undefined;
        if (input.filter) {
          try {
            filter = JSON.parse(input.filter) as Record<string, unknown>;
          } catch {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    status: 'error',
                    error: 'filter must be valid JSON (Notion filter object format)',
                  }),
                },
              ],
              isError: true,
            };
          }
        }

        const entries = await queryDatabase(input.database_id, filter);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  count: entries.length,
                  entries: entries.map((e) => ({ id: e.id, url: e.url, properties: e.properties })),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('notion_read_db failed:', message);
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: message }) }],
          isError: true,
        };
      }
    },
  );
}
