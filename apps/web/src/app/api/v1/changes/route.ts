import type { NextRequest } from 'next/server';
import { apiJson, apiOptions, handleApi, listChangesApi } from '@/lib/public-api';

/** GET /api/v1/changes: register change feed, newest first (API key required). Parameters: see listChangesApi. */
export function GET(request: NextRequest) {
  return handleApi(request, async () => apiJson(request, await listChangesApi(request.nextUrl.searchParams)));
}

export const OPTIONS = apiOptions;
