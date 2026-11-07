/** Override with the SITE_NAME env var (also used in emails sent by the worker). */
export const SITE_NAME = process.env.SITE_NAME || 'Sponsorship Hunter';
export const SITE_TAGLINE = 'Find UK employers licensed to sponsor Skilled Worker visas';
export const SITE_URL = (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
export const REGISTER_URL =
  'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers';

/**
 * Staging/preview deployments must never be indexed (duplicate content would hurt the real site).
 * Vercel sets VERCEL_ENV=preview for non-production branches; SITE_ENV=staging covers other hosts.
 */
export const IS_INDEXABLE = process.env.VERCEL_ENV !== 'preview' && process.env.SITE_ENV !== 'staging';

/** Shown on the privacy page. Set up forwarding for this address at your registrar (Namecheap: Domain → Redirect Email). */
export const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'privacy@sponsorshiphunter.com';
