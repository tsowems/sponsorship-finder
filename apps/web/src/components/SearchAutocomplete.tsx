'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import type { Suggestion } from '@/lib/data';

const DEBOUNCE_MS = 150;

export function SearchAutocomplete({ defaultValue, className }: { defaultValue?: string; className?: string }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState(defaultValue ?? '');
  // Latest response, tagged with the query it answers. Loading = we're showing an older answer.
  const [result, setResult] = useState<{ q: string; items: Suggestion[] }>({ q: '', items: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, Suggestion[]>());

  const trimmed = query.trim();
  const enabled = trimmed.length >= 2;
  const items = enabled ? result.items : [];
  const loading = enabled && result.q !== trimmed;

  useEffect(() => {
    if (trimmed.length < 2) return;
    const ctrl = new AbortController();
    const key = trimmed.toLowerCase();
    const cached = cache.current.get(key);
    const timer = setTimeout(
      async () => {
        if (cached) return setResult({ q: trimmed, items: cached });
        try {
          const res = await fetch(`/api/suggest?q=${encodeURIComponent(trimmed)}`, { signal: ctrl.signal });
          if (!res.ok) return;
          const { suggestions } = (await res.json()) as { suggestions: Suggestion[] };
          cache.current.set(key, suggestions);
          setResult({ q: trimmed, items: suggestions });
        } catch {
          /* aborted or offline: keep previous list */
        }
      },
      cached ? 0 : DEBOUNCE_MS,
    );
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [trimmed]);

  // Close when clicking elsewhere
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const showList = open && enabled;

  function go(s: Suggestion) {
    setOpen(false);
    router.push(`/sponsors/${s.slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList || items.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault(); // open the highlighted company instead of submitting the form
      go(items[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <label className="sr-only" htmlFor={`${listId}-input`}>Company name</label>
      <input
        id={`${listId}-input`}
        name="q"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search a company, e.g. Deloitte"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className={className}
      />
      {showList && (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white text-left shadow-lg">
          {items.length > 0 ? (
            <ul id={listId} role="listbox">
              {items.map((s, i) => (
                <li
                  key={s.slug}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    go(s);
                  }}
                  onPointerEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 ${i === active ? 'bg-indigo-50' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">{s.name}</span>
                    <span className="block text-sm text-slate-500">{s.town}</span>
                  </span>
                  {s.status === 'removed' ? (
                    <span className="shrink-0 text-xs font-medium text-red-700">Removed</span>
                  ) : s.rating.startsWith('B') ? (
                    <span className="shrink-0 text-xs font-medium text-amber-700">B rating</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2 text-sm text-slate-500">{loading ? 'Searching…' : 'No matching sponsors'}</p>
          )}
          <button
            type="submit"
            className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm text-indigo-700 hover:bg-slate-50"
          >
            See all results for “{query.trim()}”
          </button>
        </div>
      )}
    </div>
  );
}
