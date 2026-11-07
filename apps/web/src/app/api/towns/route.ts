import type { NextRequest } from 'next/server';
import { suggestTowns } from '@/lib/data';

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 60);
  return Response.json(
    { towns: await suggestTowns(q) },
    { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' } },
  );
}
