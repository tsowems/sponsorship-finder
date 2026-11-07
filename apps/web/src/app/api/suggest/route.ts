import type { NextRequest } from 'next/server';
import { suggestSponsors } from '@/lib/data';

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 100);
  const suggestions = await suggestSponsors(q);
  return Response.json(
    { suggestions },
    // Let browsers/CDNs reuse identical prefixes for a few minutes.
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=600, stale-while-revalidate=3600' } },
  );
}
