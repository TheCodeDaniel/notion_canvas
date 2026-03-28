// src/types/figma.ts

export interface FigmaFrame {
  id: string;
  name: string;
}

export interface FigmaScreenResult {
  nodeId: string;
  screenName: string;
}

export interface FigmaResult {
  status: 'success' | 'error';
  screens_generated?: string[];
  figma_url?: string;
  results?: FigmaScreenResult[];
  error?: string;
}

export interface WsCommand {
  id: string;
  action: string;
  payload: unknown;
}

export interface WsResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}
