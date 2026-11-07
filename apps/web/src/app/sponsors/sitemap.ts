import type { MetadataRoute } from 'next';
import { getSponsorSitemapChunk, getSponsorSitemapCount } from '@/lib/data';
import { SITE_URL } from '@/lib/site';

export async function generateSitemaps() {
  const chunks = await getSponsorSitemapCount();
  return Array.from({ length: chunks }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const id = Number(await props.id);
  const rows = await getSponsorSitemapChunk(id);
  return rows.map((r) => ({ url: `${SITE_URL}/sponsors/${r.slug}`, lastModified: r.updatedAt }));
}
