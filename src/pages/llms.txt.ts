import type { APIContext } from 'astro';
import { buildLlmsIndex, siteOf, textResponse } from '@/lib/llms';

export async function GET(context: APIContext) {
  return textResponse(await buildLlmsIndex(siteOf(context.site)));
}
