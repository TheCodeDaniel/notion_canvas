// src/clients/figma-rest.ts — Figma REST API (read-only)
import type { FigmaFrame } from '../types/figma.js';
import { logger } from '../utils/logger.js';

const FIGMA_API = 'https://api.figma.com/v1';

function getToken(): string {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) throw new Error('FIGMA_ACCESS_TOKEN is not set in environment');
  return token;
}

async function figmaGet<T>(path: string): Promise<T> {
  const res = await fetch(`${FIGMA_API}${path}`, {
    headers: { 'X-Figma-Token': getToken() },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Figma API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

// ── List all frames on the current page of a Figma file ──────────────────────
export async function listFigmaFrames(fileId: string): Promise<FigmaFrame[]> {
  logger.info(`Listing frames in Figma file: ${fileId}`);

  const data = await figmaGet<{
    document: {
      children: Array<{
        id: string;
        name: string;
        type: string;
        children?: Array<{ id: string; name: string; type: string }>;
      }>;
    };
  }>(`/files/${fileId}`);

  const frames: FigmaFrame[] = [];

  // Collect FRAME nodes from all pages
  for (const page of data.document.children) {
    if (page.children) {
      for (const node of page.children) {
        if (node.type === 'FRAME') {
          frames.push({ id: node.id, name: node.name });
        }
      }
    }
  }

  return frames;
}
