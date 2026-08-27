import type { APIContext } from 'astro';
import { postMarkdown, siteOf, textResponse } from '@/lib/llms';
import { getPosts, slugOf, type Post } from '@/lib/posts';

export async function getStaticPaths() {
  const posts = await getPosts('zh');
  return posts.map((post) => ({ params: { slug: slugOf(post) }, props: { post } }));
}

export async function GET({ props, site }: APIContext<{ post: Post }>) {
  return textResponse(await postMarkdown(props.post, siteOf(site)), 'text/markdown');
}
