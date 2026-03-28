// src/index.ts — NotionCanvas MCP server entry point
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import 'dotenv/config';

import { checkFigmaPATExpiry } from './utils/token-check.js';
import { startWebSocketServer } from './clients/figma-ws.js';
import { registerGenerateUiDesign } from './tools/generate_ui_design.js';
import { registerGenerateScreen } from './tools/generate_screen.js';
import { registerNotionReadPage } from './tools/notion_read_page.js';
import { registerNotionReadDb } from './tools/notion_read_db.js';
import { registerListFigmaFrames } from './tools/list_figma_frames.js';
import { registerGetDesignStatus } from './tools/get_design_status.js';

// Startup checks
checkFigmaPATExpiry();

// Start WebSocket server for Figma Bridge Plugin
const wss = await startWebSocketServer(Number(process.env.WS_PORT) || 9223);

// Create MCP server
const server = new McpServer({
  name: 'notioncanvas',
  version: '1.0.0',
});

// Register all tools
registerGenerateUiDesign(server, wss);
registerGenerateScreen(server, wss);
registerNotionReadPage(server);
registerNotionReadDb(server);
registerListFigmaFrames(server);
registerGetDesignStatus(server);

// Connect to stdio transport (Claude Desktop / Claude Code communication)
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('[NotionCanvas] MCP server running. Waiting for Claude...');
console.error(`[NotionCanvas] WebSocket bridge active on ws://localhost:${wss.port}`);
