import { NextResponse, type NextRequest } from 'next/server';
import { isAdminUser } from '@/lib/admin';
import { auth } from '@/lib/auth';

/**
 * Runs only for /admin. Non-admins get the site's normal 404 (real 404 status, no "Admin" title),
 * so the admin area is indistinguishable from a page that doesn't exist. Pages check again.
 */
export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (isAdminUser(session?.user)) return NextResponse.next();
  return NextResponse.rewrite(new URL('/_admin-not-found', request.url), { status: 404 });
}

export const config = { matcher: ['/admin', '/admin/:path*'] };
