// src/tools/generate_ui_design.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readPage } from '../clients/notion.js';
import { interpretWithClaude } from '../clients/claude.js';
import { sendToFigmaWithRetry } from '../clients/figma-ws.js';
import type { WssHandle } from '../clients/figma-ws.js';
import type { FigmaScreenResult } from '../types/figma.js';
import { logger } from '../utils/logger.js';

const InputSchema = z.object({
  notion_source: z.string().describe('Notion page URL or page ID'),
  figma_file_id: z.string().describe('Figma file key (from the Figma file URL)'),
  screen_type: z.enum(['mobile', 'web', 'tablet']).default('mobile').describe('Target screen type'),
  primary_color: z.string().optional().describe('Primary brand color as hex, e.g. #1A56DB'),
  font_family: z
    .enum(['Inter', 'Roboto', 'SF Pro', 'Plus Jakarta Sans'])
    .default('Inter')
    .describe('Font family to use'),
  theme: z.enum(['light', 'dark']).default('light').describe('Light or dark theme'),
  design_system: z
    .enum(['material3', 'cupertino', 'custom'])
    .default('material3')
    .describe('Design system to follow'),
  target_page: z
    .string()
    .optional()
    .describe('Figma page name to write frames to (uses current page if omitted)'),
});

export function registerGenerateUiDesign(server: McpServer, _wss: WssHandle): void {
  server.tool(
    'generate_ui_design',
    'Read a Notion page and generate Figma UI screens from its content using Claude AI.',
    InputSchema.shape,
    async (input) => {
      try {
        logger.info(`generate_ui_design: starting for Notion source: ${input.notion_source}`);

        // Step 1: Read Notion page
        const notionContent = await readPage(input.notion_source);
        logger.info(`Notion page read: "${notionContent.title}"`);

        // Step 2: Interpret with Claude → DesignIR[]
        const designs = await interpretWithClaude(notionContent, {
          screenType: input.screen_type,
          primaryColor: input.primary_color,
          fontFamily: input.font_family,
          theme: input.theme,
          designSystem: input.design_system,
        });

        logger.info(`Claude produced ${designs.length} screen(s)`);

        // Step 3: Send each validated screen to Figma via WebSocket
        const results: FigmaScreenResult[] = [];
        for (const design of designs) {
          logger.info(`Sending screen to Figma: ${design.screenName}`);
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
        logger.error('generate_ui_design failed:', message);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ status: 'error', error: message }),
            },
          ],
          isError: true,
        };
      }
    },
  );
}
