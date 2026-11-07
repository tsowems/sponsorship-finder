'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { TownSuggestion } from '@/lib/data';

const DEBOUNCE_MS = 120;
const nf = new Intl.NumberFormat('en-GB');

/** Town/city box with suggestions. Picking a town fills the box; Enter without a highlight submits the search. */
export function TownAutocomplete({ defaultValue, className }: { defaultValue?: string; className?: string }) {
  const listId = useId();
  const [value, setValue] = useState(defaultValue ?? '');
  const [result, setResult] = useState<{ q: string; towns: TownSuggestion[] }>({ q: '', towns: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const cache = useRef(new Map<string, TownSuggestion[]>());

  const trimmed = value.trim();
  const enabled = trimmed.length >= 2;
  const towns = enabled ? result.towns : [];
  // Don't suggest the exact town that's already chosen
  const showList = open && enabled && towns.length > 0 && !(towns.length === 1 && towns[0].town.toLowerCase() === trimmed.toLowerCase());

  useEffect(() => {
    if (trimmed.length < 2) return;
    const key = trimmed.toLowerCase();
    const cached = cache.current.get(key);
    const ctrl = new AbortController();
    const timer = setTimeout(
      async () => {
        if (cached) return setResult({ q: trimmed, towns: cached });
        try {
          const res = await fetch(`/api/towns?q=${encodeURIComponent(trimmed)}`, { signal: ctrl.signal });
          if (!res.ok) return;
          const { towns } = (await res.json()) as { towns: TownSuggestion[] };
          cache.current.set(key, towns);
          setResult({ q: trimmed, towns });
        } catch {
          /* aborted/offline */
        }
      },
      cached ? 0 : DEBOUNCE_MS,
    );
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [trimmed]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const choose = (t: TownSuggestion) => {
    setValue(t.town);
    setOpen(false);
    setActive(-1);
  };

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % towns.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? towns.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(towns[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className="relative w-full sm:max-w-56">
      <label className="sr-only" htmlFor={`${listId}-town`}>Town or city</label>
      <input
        id={`${listId}-town`}
        name="town"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Town / city (optional)"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className={className}
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute top-full right-0 left-0 z-20 mt-1 max-h-[min(55vh,22rem)] overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white text-left shadow-lg">
          {towns.map((t, i) => (
            <li
              key={t.town}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(t)}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 ${i === active ? 'bg-indigo-50' : ''}`}
            >
              <span className="truncate font-medium text-slate-900">{t.town}</span>
              <span className="shrink-0 text-xs text-slate-500">{nf.format(t.count)} sponsors</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
