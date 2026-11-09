import type { MetadataRoute } from 'next';
import { getTowns, LETTERS, MIN_INDEXED_TOWN } from '@/lib/browse';
import { SITE_URL } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const towns = await getTowns();
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/sponsors`, changeFrequency: 'daily' },
    { url: `${SITE_URL}/browse`, changeFrequency: 'daily' },
    { url: `${SITE_URL}/browse/towns`, changeFrequency: 'weekly' },
    ...LETTERS.map((l) => ({ url: `${SITE_URL}/browse/${l}`, changeFrequency: 'daily' as const })),
    ...towns.filter((t) => t.count >= MIN_INDEXED_TOWN).map((t) => ({ url: `${SITE_URL}/browse/towns/${t.slug}`, changeFrequency: 'weekly' as const })),
    { url: `${SITE_URL}/changes`, changeFrequency: 'daily' },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly' },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly' },
  ];
}
