import { desc, eq, inArray, or, sql } from 'drizzle-orm';
import {
  getDb,
  registerSnapshots,
  slugify,
  sponsorEvents,
  sponsors,
  type NewSponsor,
} from '@sponsors/db';
import { diffRegister, type ExistingSponsor, type RegisterDiff } from './diff';
import { groupSkilledWorkerSponsors, type RegisterSponsor } from './group';
import { parseRegister, SKILLED_WORKER_ROUTE } from './parse';
import { downloadRegister, getLatestRegisterSource, sha256 } from './source';

/** Refuse to mark more than this share of active sponsors as removed in one go (protects against a broken file). */
const MAX_REMOVAL_SHARE = 0.05;
const BATCH = 1000;

export interface ImportOptions {
  /** Import a local CSV instead of downloading. */
  file?: { text: string; publishedAt: Date; sourceUrl: string };
  /** Process even if this file was already imported / looks suspicious. */
  force?: boolean;
  /** Compute and print the diff without writing anything. */
  dryRun?: boolean;
  log?: (msg: string) => void;
}

export type ImportResult =
  | { status: 'skipped' | 'unchanged'; reason: string }
  | { status: 'imported' | 'dry-run'; snapshotId?: number; isBaseline: boolean; sponsorCount: number; counts: DiffCounts };

export interface DiffCounts {
  added: number;
  removed: number;
  readded: number;
  ratingChanged: number;
  detailsChanged: number;
}

const countsOf = (d: RegisterDiff): DiffCounts => ({
  added: d.added.length,
  removed: d.removed.length,
  readded: d.readded.length,
  ratingChanged: d.ratingChanged.length,
  detailsChanged: d.detailsChanged.length,
});

async function recordUnchanged(sourceUrl: string, hash: string, publishedAt: Date, totalRows: number, skilledWorkerRows: number, sponsorCount: number) {
  await getDb()
    .insert(registerSnapshots)
    .values({ sourceUrl, sha256: hash, publishedAt, hasChanges: false, totalRows, skilledWorkerRows, sponsorCount })
    .onConflictDoNothing({ target: registerSnapshots.sourceUrl });
}

function chunk<T>(items: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function runImport(opts: ImportOptions = {}): Promise<ImportResult> {
  const log = opts.log ?? console.log;
  const db = getDb();

  // 1. Locate + download the file
  let sourceUrl: string, publishedAt: Date, text: string, hash: string;
  if (opts.file) {
    ({ sourceUrl, publishedAt, text } = opts.file);
    hash = sha256(text);
  } else {
    const source = await getLatestRegisterSource();
    sourceUrl = source.url;
    publishedAt = source.publishedAt;
    const [already] = await db
      .select({ id: registerSnapshots.id })
      .from(registerSnapshots)
      .where(eq(registerSnapshots.sourceUrl, sourceUrl));
    if (already && !opts.force) return { status: 'skipped', reason: `already imported ${sourceUrl}` };
    log(`Downloading ${sourceUrl}`);
    ({ text, sha256: hash } = await downloadRegister(sourceUrl));
  }

  const [latest] = await db.select().from(registerSnapshots).orderBy(desc(registerSnapshots.publishedAt)).limit(1);
  if (!opts.force) {
    const [dupe] = await db
      .select({ id: registerSnapshots.id })
      .from(registerSnapshots)
      .where(or(eq(registerSnapshots.sha256, hash), eq(registerSnapshots.sourceUrl, sourceUrl)));
    if (dupe) {
      // Same bytes re-published under a new URL: remember the URL so we stop re-downloading it.
      const [sameUrl] = await db.select({ id: registerSnapshots.id }).from(registerSnapshots).where(eq(registerSnapshots.sourceUrl, sourceUrl));
      if (!sameUrl && latest) {
        await recordUnchanged(sourceUrl, hash, publishedAt, latest.totalRows, latest.skilledWorkerRows, latest.sponsorCount);
      }
      return { status: 'unchanged', reason: 'file content identical to a previous import' };
    }
    if (latest && publishedAt < latest.publishedAt) {
      return { status: 'skipped', reason: `file (${publishedAt.toISOString()}) is older than latest snapshot` };
    }
  }

  // 2. Parse + group
  const rows = parseRegister(text);
  const incoming = groupSkilledWorkerSponsors(rows);
  const skilledWorkerRows = rows.filter((r) => r.route === SKILLED_WORKER_ROUTE).length;
  log(`Parsed ${rows.length} rows, ${skilledWorkerRows} Skilled Worker rows -> ${incoming.size} sponsors`);

  // 3. Compare against stored state
  const existing: ExistingSponsor[] = await db
    .select({
      id: sponsors.id,
      key: sponsors.key,
      status: sponsors.status,
      rating: sponsors.rating,
      name: sponsors.name,
      county: sponsors.county,
      entryCount: sponsors.entryCount,
    })
    .from(sponsors);
  const isBaseline = !latest;
  const diff = diffRegister(existing, incoming);
  const counts = countsOf(diff);
  log(`Diff: ${JSON.stringify(counts)}${isBaseline ? ' (baseline import)' : ''}`);

  const activeCount = existing.filter((e) => e.status === 'active').length;
  if (!opts.force && activeCount > 0 && diff.removed.length > activeCount * MAX_REMOVAL_SHARE) {
    throw new Error(
      `Refusing to import: ${diff.removed.length} of ${activeCount} active sponsors would be removed. ` +
        'The file may be truncated or the format may have changed. Re-run with --force if this is genuine.',
    );
  }

  if (opts.dryRun) return { status: 'dry-run', isBaseline, sponsorCount: incoming.size, counts };

  // 4. Nothing differs: log the file (so the hourly check won't download it again) and stop.
  const hasChanges = isBaseline || Object.values(counts).some((n) => n > 0);
  if (!hasChanges) {
    await recordUnchanged(sourceUrl, hash, publishedAt, rows.length, skilledWorkerRows, incoming.size);
    return { status: 'unchanged', reason: 'new file published but no sponsor differences' };
  }

  // 5. Write everything in one transaction
  const takenSlugs = new Set(
    (await db.select({ slug: sponsors.slug }).from(sponsors)).map((r) => r.slug),
  );
  const uniqueSlug = (s: RegisterSponsor) => {
    const base = slugify(`${s.name} ${s.town}`) || 'sponsor';
    let slug = base;
    for (let n = 2; takenSlugs.has(slug); n++) slug = `${base}-${n}`;
    takenSlugs.add(slug);
    return slug;
  };

  const snapshotId = await db.transaction(async (tx) => {
    const [snap] = await tx
      .insert(registerSnapshots)
      .values({
        sourceUrl,
        sha256: hash,
        publishedAt,
        isBaseline,
        totalRows: rows.length,
        skilledWorkerRows,
        sponsorCount: incoming.size,
        addedCount: isBaseline ? 0 : counts.added,
        removedCount: counts.removed,
        readdedCount: counts.readded,
        ratingChangedCount: counts.ratingChanged,
      })
      .returning({ id: registerSnapshots.id });

    const event = (sponsorId: number, type: 'added' | 'removed' | 'readded' | 'rating_changed', oldValue: string | null = null, newValue: string | null = null) => ({
      sponsorId,
      snapshotId: snap.id,
      type,
      oldValue,
      newValue,
      occurredAt: publishedAt,
    });

    // New sponsors
    for (const batch of chunk(diff.added)) {
      const values: NewSponsor[] = batch.map((s) => ({
        key: s.key,
        slug: uniqueSlug(s),
        name: s.name,
        normalizedName: s.normalizedName,
        town: s.town,
        normalizedTown: s.normalizedTown,
        county: s.county,
        rating: s.rating,
        ratingRaw: s.ratingRaw,
        entryCount: s.entryCount,
        status: 'active',
        inBaseline: isBaseline,
        firstSeenAt: publishedAt,
        lastSeenAt: publishedAt,
      }));
      const inserted = await tx.insert(sponsors).values(values).returning({ id: sponsors.id, rating: sponsors.rating });
      if (!isBaseline) {
        await tx.insert(sponsorEvents).values(inserted.map((r) => event(r.id, 'added', null, r.rating)));
      }
    }

    // Back on the register
    for (const { id, sponsor } of diff.readded) {
      await tx
        .update(sponsors)
        .set({ status: 'active', removedAt: null, rating: sponsor.rating, ratingRaw: sponsor.ratingRaw, name: sponsor.name, county: sponsor.county, entryCount: sponsor.entryCount, updatedAt: sql`now()` })
        .where(eq(sponsors.id, id));
      await tx.insert(sponsorEvents).values(event(id, 'readded', null, sponsor.rating));
    }

    // Rating changes (e.g. A -> B)
    for (const { id, from, to, sponsor } of diff.ratingChanged) {
      await tx
        .update(sponsors)
        .set({ rating: to, ratingRaw: sponsor.ratingRaw, name: sponsor.name, county: sponsor.county, entryCount: sponsor.entryCount, updatedAt: sql`now()` })
        .where(eq(sponsors.id, id));
      await tx.insert(sponsorEvents).values(event(id, 'rating_changed', from, to));
    }

    // Cosmetic updates
    for (const { id, sponsor } of diff.detailsChanged) {
      await tx
        .update(sponsors)
        .set({ name: sponsor.name, county: sponsor.county, entryCount: sponsor.entryCount, updatedAt: sql`now()` })
        .where(eq(sponsors.id, id));
    }

    // Everything still active was seen in this file
    await tx.update(sponsors).set({ lastSeenAt: publishedAt }).where(eq(sponsors.status, 'active'));

    // Removed from the register
    for (const batch of chunk(diff.removed)) {
      const ids = batch.map((r) => r.id);
      await tx
        .update(sponsors)
        .set({ status: 'removed', removedAt: publishedAt, updatedAt: sql`now()` })
        .where(inArray(sponsors.id, ids));
      await tx.insert(sponsorEvents).values(ids.map((id) => event(id, 'removed')));
    }

    return snap.id;
  });

  log(`Imported snapshot #${snapshotId}`);
  return { status: 'imported', snapshotId, isBaseline, sponsorCount: incoming.size, counts };
}
