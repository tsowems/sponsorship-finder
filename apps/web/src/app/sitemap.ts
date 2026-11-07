import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/sponsors`, changeFrequency: 'daily' },
    { url: `${SITE_URL}/changes`, changeFrequency: 'daily' },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly' },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly' },
  ];
}
