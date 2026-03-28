// src/tools/generate_screen.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { interpretDescriptionWithClaude } from '../clients/claude.js';
import { sendToFigmaWithRetry } from '../clients/figma-ws.js';
import type { WssHandle } from '../clients/figma-ws.js';
import type { FigmaScreenResult } from '../types/figma.js';
import { logger } from '../utils/logger.js';

const InputSchema = z.object({
  description: z.string().describe('Plain-text description of the screen to generate'),
  screen_name: z.string().describe('Name for the screen, e.g. LoginScreen'),
  figma_file_id: z.string().describe('Figma file key (from the Figma file URL)'),
  screen_type: z.enum(['mobile', 'web', 'tablet']).default('mobile'),
  primary_color: z.string().optional().describe('Hex color e.g. #1A56DB'),
  font_family: z.enum(['Inter', 'Roboto', 'SF Pro', 'Plus Jakarta Sans']).default('Inter'),
  theme: z.enum(['light', 'dark']).default('light'),
  design_system: z.enum(['material3', 'cupertino', 'custom']).default('material3'),
  target_page: z.string().optional().describe('Figma page name to write to'),
});

export function registerGenerateScreen(server: McpServer, _wss: WssHandle): void {
  server.tool(
    'generate_screen',
    'Generate a single Figma screen from a plain-text description (no Notion page required).',
    InputSchema.shape,
    async (input) => {
      try {
        logger.info(`generate_screen: "${input.screen_name}"`);

        const designs = await interpretDescriptionWithClaude(input.description, input.screen_name, {
          screenType: input.screen_type,
          primaryColor: input.primary_color,
          fontFamily: input.font_family,
          theme: input.theme,
          designSystem: input.design_system,
        });

        const results: FigmaScreenResult[] = [];
        for (const design of designs) {
          const result = await sendToFigmaWithRetry<FigmaScreenResult>('create_screen', {
            design,
            fileId: input.figma_file_id,
            targetPage: input.target_page,
          });
          results.push(result);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  screens_generated: designs.map((d) => d.screenName),
                  figma_url: `https://www.figma.com/design/${input.figma_file_id}`,
                  results,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('generate_screen failed:', message);
        return {
          content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: message }) }],
          isError: true,
        };
      }
    },
  );
}
