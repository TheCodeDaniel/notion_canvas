// src/interpreter/prompt.ts
import type { NotionContent } from '../types/notion.js';
import type { DesignOptions } from '../types/design-ir.js';

export function buildSystemPrompt(): string {
  return `You are an expert UI/UX designer and Figma specialist.
Your job is to analyze Notion page content and output a UI design specification
as a JSON array. You MUST output ONLY valid JSON — no markdown, no explanation,
no code fences. Just the raw JSON array.

Each object in the array represents one screen. Follow this exact schema:
- screenName: string (PascalCase, e.g. 'LoginScreen')
- width: number (390 for mobile, 1440 for web, 768 for tablet)
- height: number (844 for mobile, 900 for web, 1024 for tablet)
- backgroundColor: { r, g, b, a } (0-1 floats)
- components: array of component objects

Component types and their required fields:
  frame:       { type, name, x, y, width, height, layoutMode, children[], fillColor?, cornerRadius?, paddingLeft?, paddingRight?, paddingTop?, paddingBottom?, itemSpacing? }
  text:        { type, name, x, y, width, content, fontSize?, fontWeight?, fillColor?, textAlignHorizontal? }
  rectangle:   { type, name, x, y, width, height, fillColor?, cornerRadius?, strokeColor?, strokeWidth? }
  input_field: { type, name, x, y, width, height?, placeholder, inputType }
  button:      { type, name, x, y, width, height?, label, variant, fillColor? }

Rules:
- Positions are absolute (x, y from top-left of screen)
- Colors are RGBA with values 0–1 (NOT 0–255)
- Mobile screen = 390x844. Standard padding = 16-24px.
- Ensure no components overflow the screen width.
- fontWeight: 'Regular' | 'Medium' | 'SemiBold' | 'Bold'
- textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT'
- layoutMode: 'NONE' | 'VERTICAL' | 'HORIZONTAL'
- inputType: 'text' | 'email' | 'password' | 'number'
- button variant: 'primary' | 'secondary' | 'ghost' | 'destructive'
- Output ONLY the JSON array. No other text whatsoever.`;
}

export function buildUserPrompt(content: NotionContent, options: DesignOptions): string {
  return [
    '=== NOTION CONTENT ===',
    `Title: ${content.title}`,
    '',
    content.plainText,
    '',
    '=== DESIGN OPTIONS ===',
    JSON.stringify(options, null, 2),
    '',
    'Generate UI designs for this content. Output JSON array only.',
  ].join('\n');
}

export function buildRetryPrompt(originalResponse: string, errorMessage: string): string {
  return [
    'Your previous response was not valid JSON or did not match the required schema.',
    '',
    `Error: ${errorMessage}`,
    '',
    'Previous response (first 500 chars):',
    originalResponse.slice(0, 500),
    '',
    'Output ONLY the JSON array with no markdown, no code fences, no explanation.',
    'Start your response with [ and end with ].',
  ].join('\n');
}
