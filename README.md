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

## One-time setup (~10 minutes)

### 1. Clone & install

```bash
git clone https://github.com/TheCodeDaniel/notion_canvas
cd notioncanvas-mcp
npm install
```

### 2. Configure credentials

```bash
cp .env.example .env
```

Edit `.env` with your three credentials:

| Variable | Where to get it |
|----------|----------------|
| `NOTION_TOKEN` | notion.com → Settings → Connections → Develop integrations → New integration (Internal) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `FIGMA_ACCESS_TOKEN` | figma.com → Settings → Security → Personal access tokens (scopes: `file_content:read`, `file_metadata:read`) |
| `FIGMA_PAT_EXPIRES` | ISO date of your PAT expiry, e.g. `2026-06-25` |

### 3. Build

```bash
npm run build
```

### 4. Configure Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "notioncanvas": {
      "command": "node",
      "args": ["/absolute/path/to/notioncanvas-mcp/dist/index.js"],
      "env": {
        "NOTION_TOKEN": "secret_xxxx",
        "ANTHROPIC_API_KEY": "sk-ant-xxxx",
        "FIGMA_ACCESS_TOKEN": "figd_xxxx",
        "FIGMA_PAT_EXPIRES": "2026-06-25"
      }
    }
  }
}
```

> **Important:** Use an absolute path. Relative paths do not work in Claude Desktop MCP configs.

### 5. Share Notion pages with your integration

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
