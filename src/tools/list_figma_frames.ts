// src/tools/list_figma_frames.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listFigmaFrames } from '../clients/figma-rest.js';
import { logger } from '../utils/logger.js';

const InputSchema = z.object({
  figma_file_id: z.string().describe('Figma file key (from the Figma file URL)'),
});

export function registerListFigmaFrames(server: McpServer): void {
  server.tool(
    'list_figma_frames',
    'List all frames in a Figma file using the Figma REST API.',
    InputSchema.shape,
    async (input) => {
      try {
        logger.info(`list_figma_frames: ${input.figma_file_id}`);
        const frames = await listFigmaFrames(input.figma_file_id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  count: frames.length,
                  frames,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('list_figma_frames failed:', message);
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: message }) }],
          isError: true,
        };
      }
    },
  );
}
