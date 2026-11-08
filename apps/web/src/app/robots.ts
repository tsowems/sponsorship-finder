import type { MetadataRoute } from 'next';
import { getSponsorSitemapCount } from '@/lib/data';
import { IS_INDEXABLE, SITE_URL } from '@/lib/site';

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!IS_INDEXABLE) return { rules: { userAgent: '*', disallow: '/' } };
  const chunks = await getSponsorSitemapCount();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Search/filter variations and APIs: endless URL combinations, no SEO value, each costs a render.
        disallow: ['/sponsors?', '/changes?', '/api/', '/login', '/account', '/unsubscribe'],
      },
      {
        // Heavy crawlers that don't send visitors: SEO-tool bots and AI *training* crawlers.
        // (AI search crawlers such as OAI-SearchBot and PerplexityBot stay allowed, like Google and Bing.)
        userAgent: [
          'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'BLEXBot', 'DataForSeoBot', 'PetalBot', 'Barkrowler',
          'SeekportBot', 'GPTBot', 'CCBot', 'Bytespider', 'ClaudeBot', 'anthropic-ai', 'Google-Extended',
          'Applebot-Extended', 'meta-externalagent', 'Diffbot', 'ImagesiftBot', 'Omgilibot', 'Timpibot',
        ],
        disallow: '/',
      },
    ],
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      ...Array.from({ length: chunks }, (_, i) => `${SITE_URL}/sponsors/sitemap/${i}.xml`),
    ],
  };
}
