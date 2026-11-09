import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins/magic-link';
import { eq } from 'drizzle-orm';
import { authSchema, getDb } from '@sponsors/db';
import { magicLinkEmail, sendEmail } from '@sponsors/email';
import { SITE_URL } from './site';

export const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const auth = betterAuth({
  baseURL: SITE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getDb(), { provider: 'pg', schema: authSchema }),
  socialProviders: googleEnabled
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!, prompt: 'select_account' } }
    : {},
  // Signing in with Google and with an email link for the same address gives one account.
  account: { accountLinking: { enabled: true, trustedProviders: ['google'] } },
  user: { additionalFields: { alertsEnabled: { type: 'boolean', defaultValue: true, input: false } } },
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
  // A new session = a sign-in: remember when, for the admin users list. Never blocks signing in.
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await getDb()
            .update(authSchema.user)
            .set({ lastSignInAt: new Date() })
            .where(eq(authSchema.user.id, session.userId))
            .catch(() => {});
        },
      },
    },
  },
  plugins: [
    magicLink({
      expiresIn: 15 * 60,
      storeToken: 'hashed',
      sendMagicLink: async ({ email, url }) => {
        const msg = magicLinkEmail(url);
        await sendEmail({ to: email, ...msg });
      },
    }),
    nextCookies(), // must be last
  ],
});

export type SessionUser = typeof auth.$Infer.Session.user;
