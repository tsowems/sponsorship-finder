import 'server-only';
import { notFound } from 'next/navigation';
import { getCurrentUser } from './session';
// (also imported by src/proxy.ts)

/**
 * Admin access = signed in with a verified email listed in ADMIN_EMAILS (comma-separated).
 * Everyone else gets a plain 404, so the admin area doesn't reveal that it exists.
 */
function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: { email: string; emailVerified?: boolean | null } | null | undefined): boolean {
  return Boolean(user?.emailVerified && adminEmails().includes(user.email.toLowerCase()));
}

/** Call at the top of every admin page and admin API route (not just the layout). */
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!isAdminUser(user)) notFound();
  return user!;
}
