import type { MetadataRoute } from 'next';
import { getTowns, LETTERS, MIN_INDEXED_TOWN } from '@/lib/browse';
import { getCouncils, NATIONS } from '@/lib/councils';
import { INDUSTRIES } from '@/lib/industries';
import { SITE_URL } from '@/lib/site';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [towns, councils] = await Promise.all([getTowns(), getCouncils()]);
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/sponsors`, changeFrequency: 'daily' },
    { url: `${SITE_URL}/browse`, changeFrequency: 'daily' },
    { url: `${SITE_URL}/browse/towns`, changeFrequency: 'weekly' },
    ...LETTERS.map((l) => ({ url: `${SITE_URL}/browse/${l}`, changeFrequency: 'daily' as const })),
    ...towns.filter((t) => t.count >= MIN_INDEXED_TOWN).map((t) => ({ url: `${SITE_URL}/browse/towns/${t.slug}`, changeFrequency: 'weekly' as const })),
    { url: `${SITE_URL}/industries`, changeFrequency: 'weekly' },
    ...INDUSTRIES.map((i) => ({ url: `${SITE_URL}/industries/${i.slug}`, changeFrequency: 'weekly' as const })),
    { url: `${SITE_URL}/councils`, changeFrequency: 'weekly' },
    ...NATIONS.filter((n) => councils[n.slug].length > 0).map((n) => ({ url: `${SITE_URL}/councils/${n.slug}`, changeFrequency: 'weekly' as const })),
    { url: `${SITE_URL}/faq`, changeFrequency: 'monthly' },
    { url: `${SITE_URL}/changes`, changeFrequency: 'daily' },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly' },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly' },
  ];
}
