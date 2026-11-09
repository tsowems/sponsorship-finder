import type { NextRequest } from 'next/server';
import { apiJson, apiOptions, handleApi, listSponsorsApi } from '@/lib/public-api';

/** GET /api/v1/sponsors: list/filter sponsors (API key required). Parameters: see listSponsorsApi. */
export function GET(request: NextRequest) {
  return handleApi(request, async () => apiJson(request, await listSponsorsApi(request.nextUrl.searchParams)));
}

export const OPTIONS = apiOptions;
