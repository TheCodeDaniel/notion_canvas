# NotionCanvas MCP

**Notion → Claude AI → Figma** — Read a Notion page, interpret it with Claude, draw UI screens in Figma.

## How it works

```
Claude Desktop/Code
       │  stdio
       ▼
notioncanvas-mcp (Node.js)
  ├─ Notion API  →  reads page content
  ├─ Claude API  →  generates DesignIR JSON
  └─ WebSocket   →  sends commands to Figma plugin
                           │
                    Figma Desktop
               (NotionCanvas Bridge Plugin)
                   draws frames on canvas
```

## One-time setup (~5 minutes)

### 1. Clone, install & build

```bash
git clone https://github.com/TheCodeDaniel/notion_canvas
cd notion_canvas
npm install
npm run build
```

### 2. Fill in `.env` and run setup

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

| Variable | Where to get it |
|----------|----------------|
| `NOTION_TOKEN` | notion.com → Settings → Connections → Develop integrations → New integration (Internal) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `FIGMA_ACCESS_TOKEN` | figma.com → Settings → Security → Personal access tokens (scopes: `file_content:read`, `file_metadata:read`) |
| `FIGMA_PAT_EXPIRES` | ISO expiry date of your PAT, e.g. `2026-09-25` |

Then run:

```bash
npm run setup
```

That's it. The command reads your `.env` and:
- **Auto-detects** the Claude Desktop config path for your OS (macOS / Windows)
- **Creates** the config file + directory if they don't exist
- **Merges** the `notioncanvas` entry without touching other MCP servers you may have
- **Auto-resolves** the absolute path to `dist/index.js` — nothing to edit manually

### 3. Share Notion pages with your integration

For each Notion page you want to use:
1. Open the page in Notion
2. Click **•••** (top right) → **Connections** → find your integration → connect

If a page is not shared, the API returns 404.

### 6. Install the Figma Bridge Plugin

1. Open Figma Desktop
2. **Plugins → Development → Import plugin from manifest**
3. Select `plugin/manifest.json` from this repo
4. Click **Run** to start the bridge

## Per-session usage

1. Open Figma Desktop with your target file open
2. Run the **NotionCanvas Bridge** plugin (Plugins → Development → NotionCanvas Bridge)
3. Open Claude Desktop — `notioncanvas` should appear as a connected tool
4. Prompt Claude:

```
Generate a mobile UI design from my Notion page https://notion.so/...
into Figma file abc123xyz (use a blue theme)
```

## Available MCP tools

| Tool | Description |
|------|-------------|
| `generate_ui_design` | Full pipeline: Notion page → Claude → Figma screens |
| `generate_screen` | Single screen from a plain-text description (no Notion) |
| `notion_read_page` | Read and return structured content of a Notion page |
| `notion_read_db` | Query a Notion database and return all entries |
| `list_figma_frames` | List all frames in a Figma file |
| `get_design_status` | Check if the Figma Bridge Plugin is connected |

## Development

```bash
npm run dev     # Run with tsx watch (no build needed)
npm run build   # Compile TypeScript to dist/
npm test        # Run vitest
```

## Known limitations

- Figma Desktop must be open and the plugin must be running (not headless)
- Figma PAT expires every 90 days — server warns 14 days before expiry
- Claude-generated layouts may need minor manual adjustment in Figma
- Inter font must be available in Figma Desktop (install from Google Fonts if missing)

## Cost

Each `generate_ui_design` call uses ~1,500–4,000 tokens. At Claude Sonnet pricing (~$3/$15 per M tokens), each design generation costs ~$0.01–$0.06.
