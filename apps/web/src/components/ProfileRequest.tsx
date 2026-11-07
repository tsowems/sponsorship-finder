'use client';

import { useEffect } from 'react';

/** Invisible: tells the server someone looked at a company we haven't researched yet. */
export function ProfileRequest({ sponsorId }: { sponsorId: number }) {
  useEffect(() => {
    const key = `profile-requested:${sponsorId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* storage blocked: just send it */
    }
    fetch('/api/profile-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sponsorId }),
      keepalive: true,
    }).catch(() => {});
  }, [sponsorId]);
  return null;
}
