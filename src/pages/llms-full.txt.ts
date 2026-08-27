import type { APIContext } from 'astro';
import { buildLlmsFull, siteOf, textResponse } from '@/lib/llms';

export async function GET(context: APIContext) {
  return textResponse(await buildLlmsFull(siteOf(context.site)));
}
