import { SearchAutocomplete } from './SearchAutocomplete';
import { TownAutocomplete } from './TownAutocomplete';

export function SearchForm({
  q,
  town,
  rating,
  status,
  size = 'md',
  showFilters = false,
  onBrand = false,
}: {
  q?: string;
  town?: string;
  rating?: string;
  status?: string;
  size?: 'md' | 'lg';
  showFilters?: boolean;
  /** Sitting on the violet banner: borderless inputs and a white button. */
  onBrand?: boolean;
}) {
  const input = `w-full rounded-xl border bg-white px-4 text-slate-900 placeholder:text-slate-400 focus:outline-none ${
    onBrand ? 'border-transparent shadow-sm focus:ring-4 focus:ring-white/40' : 'border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
  }`;
  return (
    <form action="/sponsors" method="get" role="search" className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchAutocomplete defaultValue={q} className={`${input} ${size === 'lg' ? 'h-14 text-lg' : 'h-11'}`} />
        <TownAutocomplete defaultValue={town} className={`${input} ${size === 'lg' ? 'h-14 text-lg' : 'h-11'}`} />
        <button
          type="submit"
          className={`rounded-xl px-6 font-semibold ${
            onBrand ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          } ${size === 'lg' ? 'h-14 text-lg' : 'h-11'}`}
        >
          Search
        </button>
      </div>
      {showFilters && (
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            Rating
            <select name="rating" defaultValue={rating ?? ''} className="h-9 rounded-md border border-slate-300 bg-white px-2">
              <option value="">Any</option>
              <option value="A">A-rated</option>
              <option value="B">B-rated (downgraded)</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            Status
            <select name="status" defaultValue={status ?? 'active'} className="h-9 rounded-md border border-slate-300 bg-white px-2">
              <option value="active">Currently licensed</option>
              <option value="removed">Removed from register</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>
      )}
    </form>
  );
}
