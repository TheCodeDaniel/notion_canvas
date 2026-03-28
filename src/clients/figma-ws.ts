// src/clients/figma-ws.ts
import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import type { WsCommand, WsResponse } from '../types/figma.js';
import { logger } from '../utils/logger.js';
import { sleep } from '../utils/retry.js';

const pendingRequests = new Map<
  string,
  { resolve: (r: unknown) => void; reject: (e: Error) => void }
>();

let pluginSocket: WebSocket | null = null;

export interface WssHandle {
  port: number;
  wss: WebSocketServer;
}

export async function startWebSocketServer(port: number): Promise<WssHandle> {
  const wss = new WebSocketServer({ host: '127.0.0.1', port });

  wss.on('connection', (ws) => {
    pluginSocket = ws;
    logger.info('Figma Bridge Plugin connected.');

    ws.on('message', (raw) => {
      let msg: WsResponse;
      try {
        msg = JSON.parse(raw.toString()) as WsResponse;
      } catch {
        logger.warn('Received malformed message from Figma plugin');
        return;
      }

      const pending = pendingRequests.get(msg.id);
      if (!pending) return;

      pendingRequests.delete(msg.id);
      if (msg.success) {
        pending.resolve(msg.result);
      } else {
        pending.reject(new Error(msg.error ?? 'Unknown plugin error'));
      }
    });

    ws.on('close', () => {
      pluginSocket = null;
      logger.info('Figma Bridge Plugin disconnected.');
    });

    ws.on('error', (err) => {
      logger.error('WebSocket error:', err.message);
    });
  });

  // Wait for WSS to be listening
  await new Promise<void>((resolve, reject) => {
    wss.once('listening', resolve);
    wss.once('error', reject);
  });

  logger.info(`WebSocket bridge listening on ws://127.0.0.1:${port}`);
  return { port, wss };
}

// ── Send a command to the Figma plugin and await the result ─────────────────
export async function sendToFigma<T>(
  action: string,
  payload: unknown,
  timeoutMs = 30_000,
): Promise<T> {
  if (!pluginSocket || pluginSocket.readyState !== WebSocket.OPEN) {
    throw new Error(
      'Figma Bridge Plugin is not connected. ' +
        'Open Figma Desktop and run the NotionCanvas Bridge plugin.',
    );
  }

  const id = randomUUID();
  const command: WsCommand = { id, action, payload };

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Figma command '${action}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pendingRequests.set(id, {
      resolve: (r) => {
        clearTimeout(timer);
        resolve(r as T);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });

    pluginSocket!.send(JSON.stringify(command));
  });
}

// ── Retry a Figma command once on timeout ────────────────────────────────────
export async function sendToFigmaWithRetry<T>(
  action: string,
  payload: unknown,
  timeoutMs = 30_000,
): Promise<T> {
  try {
    return await sendToFigma<T>(action, payload, timeoutMs);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('timed out')) {
      logger.warn(`Figma command '${action}' timed out — retrying once in 5s...`);
      await sleep(5000);
      return sendToFigma<T>(action, payload, timeoutMs);
    }
    throw err;
  }
}

export function isPluginConnected(): boolean {
  return pluginSocket !== null && pluginSocket.readyState === WebSocket.OPEN;
}
