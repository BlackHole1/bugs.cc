import type { APIContext } from 'astro';
import { buildFeed } from '@/lib/feed';

export function GET(context: APIContext) {
  return buildFeed('en', context);
}
