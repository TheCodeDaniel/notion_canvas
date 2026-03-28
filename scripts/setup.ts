#!/usr/bin/env tsx
// scripts/setup.ts
//
// Usage:
//   1. Fill in your credentials in .env (copy .env.example → .env)
//   2. npm run build
//   3. npm run setup
//
// What this does:
//   - Reads credentials from .env
//   - Validates all required vars are present
//   - Auto-detects the Claude Desktop config path (macOS / Windows / Linux)
//   - Creates the config file + directory if they don't exist
//   - Merges the notioncanvas MCP entry without touching other servers
//   - Auto-resolves the absolute path to dist/index.js

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Resolve project root (scripts/ is one level below root) ─────────────────
const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(__filename), '..');
const ENV_PATH = path.join(PROJECT_ROOT, '.env');
const DIST_ENTRY = path.join(PROJECT_ROOT, 'dist', 'index.js');

// ── Parse a .env file into a key/value map ───────────────────────────────────
function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const vars: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq !== -1) vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

// ── Detect Claude Desktop config path by OS ──────────────────────────────────
function getClaudeConfigPath(): string {
  switch (os.platform()) {
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    case 'win32': {
      const appdata = process.env.APPDATA;
      if (!appdata) throw new Error('APPDATA environment variable is not set');
      return path.join(appdata, 'Claude', 'claude_desktop_config.json');
    }
    case 'linux':
      return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
    default:
      throw new Error(`Unsupported platform: ${os.platform()}`);
  }
}

// ── Read existing Claude Desktop config, back up if JSON is broken ───────────
function readClaudeConfig(configPath: string): Record<string, unknown> {
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, unknown>;
  } catch {
    const backup = `${configPath}.bak.${Date.now()}`;
    fs.copyFileSync(configPath, backup);
    console.warn(`  ⚠  Existing config had invalid JSON — backed up to:\n     ${backup}`);
    return {};
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
function main(): void {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║     NotionCanvas MCP — Setup             ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // 1. Check dist/index.js exists
  if (!fs.existsSync(DIST_ENTRY)) {
    console.error('  ✖  dist/index.js not found. Run `npm run build` first.\n');
    process.exit(1);
  }

  // 2. Read .env
  if (!fs.existsSync(ENV_PATH)) {
    console.error(`  ✖  .env not found at ${ENV_PATH}`);
    console.error('     Run: cp .env.example .env  — then fill in your credentials.\n');
    process.exit(1);
  }

  const env = parseEnvFile(ENV_PATH);

  // 3. Validate required vars
  const required = ['NOTION_TOKEN', 'ANTHROPIC_API_KEY', 'FIGMA_ACCESS_TOKEN'] as const;
  const missing = required.filter((k) => !env[k] || env[k].includes('xxx'));
  if (missing.length > 0) {
    console.error('  ✖  The following credentials are missing or still have placeholder values in .env:');
    for (const k of missing) console.error(`       ${k}=${env[k] ?? '(not set)'}`);
    console.error('');
    process.exit(1);
  }

  console.log('  ✔  .env loaded');
  console.log(`       NOTION_TOKEN       = ${env['NOTION_TOKEN']!.slice(0, 12)}...`);
  console.log(`       ANTHROPIC_API_KEY  = ${env['ANTHROPIC_API_KEY']!.slice(0, 12)}...`);
  console.log(`       FIGMA_ACCESS_TOKEN = ${env['FIGMA_ACCESS_TOKEN']!.slice(0, 12)}...`);
  if (env['FIGMA_PAT_EXPIRES']) {
    console.log(`       FIGMA_PAT_EXPIRES  = ${env['FIGMA_PAT_EXPIRES']}`);
  }

  // 4. Detect config path
  let configPath: string;
  try {
    configPath = getClaudeConfigPath();
  } catch (err) {
    console.error(`\n  ✖  ${(err as Error).message}\n`);
    process.exit(1);
  }

  const configExists = fs.existsSync(configPath);
  console.log(`\n  Claude Desktop config: ${configPath}`);
  console.log(`  File exists: ${configExists ? 'yes — will merge' : 'no — will create'}`);

  // 5. Read + merge
  const config = readClaudeConfig(configPath);
  if (!config['mcpServers'] || typeof config['mcpServers'] !== 'object') {
    config['mcpServers'] = {};
  }
  const mcpServers = config['mcpServers'] as Record<string, unknown>;
  const alreadyHad = 'notioncanvas' in mcpServers;
  const otherServers = Object.keys(mcpServers).filter((k) => k !== 'notioncanvas');

  mcpServers['notioncanvas'] = {
    command: 'node',
    args: [DIST_ENTRY],
    env: {
      NOTION_TOKEN: env['NOTION_TOKEN'],
      ANTHROPIC_API_KEY: env['ANTHROPIC_API_KEY'],
      FIGMA_ACCESS_TOKEN: env['FIGMA_ACCESS_TOKEN'],
      FIGMA_PAT_EXPIRES: env['FIGMA_PAT_EXPIRES'] ?? '',
      WS_PORT: env['WS_PORT'] ?? '9223',
      LOG_LEVEL: env['LOG_LEVEL'] ?? 'info',
    },
  };

  // 6. Create directory + write
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`  ✔  Created directory: ${configDir}`);
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

  if (otherServers.length > 0) {
    console.log(`  ✔  Preserved existing MCP servers: ${otherServers.join(', ')}`);
  }
  console.log(`  ✔  notioncanvas ${alreadyHad ? 'updated' : 'added'}`);
  console.log(`  ✔  dist/index.js → ${DIST_ENTRY}`);

  // 7. Done
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  Done! Restart Claude Desktop to apply.  ║');
  console.log('╚══════════════════════════════════════════╝\n');
  console.log('Remaining manual steps:');
  console.log('  • Notion: share each target page with your integration');
  console.log('    (page ••• → Connections → your integration)');
  console.log('  • Figma Desktop: Plugins → Development → Import plugin from manifest');
  console.log('    → select plugin/manifest.json → Run\n');
}

main();
