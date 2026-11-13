'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getDb, linkSuggestions, sponsors } from '@sponsors/db';
import { enrichSponsor } from '@sponsors/enrich';
import { requireAdmin } from '@/lib/admin';

/** Approve, reject or remove a suggested link, then look the company up again so its page reflects the decision. */
async function decide(id: number, status: 'accepted' | 'rejected') {
  await requireAdmin();
  if (!Number.isInteger(id) || id <= 0) return;
  const db = getDb();
  const [row] = await db
    .update(linkSuggestions)
    .set({ status, acceptedBy: status === 'accepted' ? 'admin' : null, reviewedAt: new Date() })
    .where(eq(linkSuggestions.id, id))
    .returning({ sponsorId: linkSuggestions.sponsorId });
  if (!row) return;
  // Re-run the lookup with the accepted links (an approved website is used even if the site blocks our checks).
  await enrichSponsor(row.sponsorId).catch(() => null);
  const [s] = await db.select({ slug: sponsors.slug }).from(sponsors).where(eq(sponsors.id, row.sponsorId));
  if (s) revalidateTag(`sponsor:${s.slug}`, { expire: 0 });
  revalidatePath('/admin/suggestions');
}

export async function approveSuggestion(formData: FormData) {
  await decide(Number(formData.get('id')), 'accepted');
}

export async function rejectSuggestion(formData: FormData) {
  await decide(Number(formData.get('id')), 'rejected');
}
