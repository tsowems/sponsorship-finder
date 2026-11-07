import type { MetadataRoute } from 'next';
import { getSponsorSitemapCount } from '@/lib/data';
import { SITE_URL } from '@/lib/site';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const chunks = await getSponsorSitemapCount();
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      ...Array.from({ length: chunks }, (_, i) => `${SITE_URL}/sponsors/sitemap/${i}.xml`),
    ],
  };
}
