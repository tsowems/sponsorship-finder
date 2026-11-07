import type { MetadataRoute } from 'next';
import { getSponsorSitemapCount } from '@/lib/data';
import { IS_INDEXABLE, SITE_URL } from '@/lib/site';

export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!IS_INDEXABLE) return { rules: { userAgent: '*', disallow: '/' } };
  const chunks = await getSponsorSitemapCount();
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      ...Array.from({ length: chunks }, (_, i) => `${SITE_URL}/sponsors/sitemap/${i}.xml`),
    ],
  };
}
