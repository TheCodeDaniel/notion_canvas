// src/tools/get_design_status.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { isPluginConnected } from '../clients/figma-ws.js';

const InputSchema = z.object({});

export function registerGetDesignStatus(server: McpServer): void {
  server.tool(
    'get_design_status',
    'Check whether the NotionCanvas Figma Bridge Plugin is connected and ready.',
    InputSchema.shape,
    async () => {
      const connected = isPluginConnected();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: 'success',
                plugin_connected: connected,
                plugin_version: '1.0.0',
                message: connected
                  ? 'Figma Bridge Plugin is connected and ready.'
                  : 'Figma Bridge Plugin is NOT connected. Open Figma Desktop and run the NotionCanvas Bridge plugin.',
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
