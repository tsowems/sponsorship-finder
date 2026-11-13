'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Kind = 'website' | 'careers';
type Result = { tone: 'ok' | 'wait' | 'error'; text: string } | null;

/** "Suggest a link": signed-in users can send us a company's website or careers page; we check it like our own search. */
export function SuggestLink({ sponsorId, hasWebsite, hasCareers }: { sponsorId: number; hasWebsite: boolean; hasCareers: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>(hasWebsite ? 'careers' : 'website');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result>(null);

  const prompt = !hasWebsite ? 'Know their website or careers page?' : !hasCareers ? 'Know their careers or jobs page?' : 'Wrong or missing link?';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorId, kind, url }),
      });
      const data = (await res.json().catch(() => ({}))) as { status?: string; error?: string };
      if (data.status === 'accepted') {
        setResult({ tone: 'ok', text: 'Thanks! We confirmed it and added it to this page.' });
        setUrl('');
        router.refresh();
      } else if (data.status === 'pending') {
        setResult({ tone: 'wait', text: 'Thanks! We couldn’t confirm it automatically, so we’ll check it by hand and add it if it’s right.' });
        setUrl('');
      } else {
        setResult({ tone: 'error', text: data.error ?? 'Something went wrong. Please try again.' });
      }
    } catch {
      setResult({ tone: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <p className="text-sm text-slate-600">
        {prompt}{' '}
        <button type="button" onClick={() => setOpen(true)} className="font-medium text-indigo-700 hover:underline">
          Suggest a link
        </button>
      </p>
    );
  }

  const pill = (k: Kind, label: string) => (
    <label className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${kind === k ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700'}`}>
      <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
      {label}
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-medium text-slate-900">Suggest a link</p>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">What kind of link</legend>
        {pill('website', 'Website')}
        {pill('careers', 'Careers or jobs page')}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          inputMode="url"
          autoComplete="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={kind === 'website' ? 'www.example.co.uk' : 'www.example.co.uk/careers'}
          aria-label={kind === 'website' ? 'Website address' : 'Careers or jobs page address'}
          className="min-w-[14rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60">
          {busy ? 'Checking…' : 'Check and add'}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        {busy
          ? 'Checking the link. This can take up to 30 seconds.'
          : 'We add it straight away if the site shows the company’s registration number or full registered name. Otherwise we check it by hand first. Job boards and social media pages can’t be used.'}
      </p>
      {result && (
        <p role="status" className={`text-sm ${result.tone === 'ok' ? 'text-emerald-700' : result.tone === 'wait' ? 'text-slate-700' : 'text-red-700'}`}>
          {result.text}
        </p>
      )}
    </form>
  );
}
