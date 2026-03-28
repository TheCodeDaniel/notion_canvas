// src/clients/claude.ts
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, buildUserPrompt, buildRetryPrompt } from '../interpreter/prompt.js';
import { DesignIRZ, type DesignIR } from '../interpreter/schema.js';
import type { NotionContent } from '../types/notion.js';
import type { DesignOptions } from '../types/design-ir.js';
import { logger } from '../utils/logger.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;
const MAX_RETRIES = 2;

export async function interpretWithClaude(
  content: NotionContent,
  options: DesignOptions,
): Promise<DesignIR[]> {
  logger.info('Sending content to Claude for UI interpretation...');

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(content, options);

  let lastResponse = '';
  let lastError = '';

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const messages: Anthropic.MessageParam[] = attempt === 1
      ? [{ role: 'user', content: userPrompt }]
      : [
          { role: 'user', content: userPrompt },
          { role: 'assistant', content: lastResponse },
          { role: 'user', content: buildRetryPrompt(lastResponse, lastError) },
        ];

    logger.debug(`Claude attempt ${attempt}/${MAX_RETRIES + 1}`);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      lastError = 'No text content in Claude response';
      lastResponse = '';
      continue;
    }

    lastResponse = textBlock.text.trim();
    logger.debug(`Claude response length: ${lastResponse.length} chars`);

    // Strip markdown code fences if Claude added them despite instructions
    const cleaned = lastResponse
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    // Parse JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      lastError = `JSON parse error: ${err instanceof Error ? err.message : String(err)}`;
      logger.warn(`Attempt ${attempt}: ${lastError}`);
      continue;
    }

    if (!Array.isArray(parsed)) {
      lastError = 'Response is not a JSON array';
      logger.warn(`Attempt ${attempt}: ${lastError}`);
      continue;
    }

    // Validate each screen with Zod
    const designs: DesignIR[] = [];
    let validationError = '';

    for (let i = 0; i < parsed.length; i++) {
      const result = DesignIRZ.safeParse(parsed[i]);
      if (!result.success) {
        validationError = `Screen ${i} (${(parsed[i] as Record<string, unknown>)?.screenName ?? 'unknown'}): ${result.error.message}`;
        break;
      }
      designs.push(result.data);
    }

    if (validationError) {
      lastError = validationError;
      logger.warn(`Attempt ${attempt}: Zod validation failed — ${lastError}`);
      continue;
    }

    logger.info(`Claude generated ${designs.length} screen(s) successfully.`);
    return designs;
  }

  throw new Error(`Claude failed to produce valid DesignIR after ${MAX_RETRIES + 1} attempts. Last error: ${lastError}`);
}

// ── Generate a single screen from a plain-text description (no Notion) ───────
export async function interpretDescriptionWithClaude(
  description: string,
  screenName: string,
  options: DesignOptions,
): Promise<DesignIR[]> {
  const fakeContent: NotionContent = {
    pageId: 'manual',
    title: screenName,
    url: '',
    properties: {},
    blocks: [],
    plainText: description,
  };
  return interpretWithClaude(fakeContent, options);
}
