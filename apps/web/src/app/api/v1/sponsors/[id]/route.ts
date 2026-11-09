import { apiError, apiJson, apiOptions, getSponsorApi, handleApi } from '@/lib/public-api';

/** GET /api/v1/sponsors/{slug or id}: one sponsor with history and open roles (API key required). */
export function GET(request: Request, ctx: RouteContext<'/api/v1/sponsors/[id]'>) {
  return handleApi(request, async () => {
    const { id } = await ctx.params;
    const result = await getSponsorApi(decodeURIComponent(id).slice(0, 200));
    return result ? apiJson(request, result) : apiError(request, 404, 'Sponsor not found');
  });
}

export const OPTIONS = apiOptions;
