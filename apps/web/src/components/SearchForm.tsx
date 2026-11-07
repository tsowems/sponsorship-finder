import { SearchAutocomplete } from './SearchAutocomplete';

export function SearchForm({
  q,
  town,
  rating,
  status,
  size = 'md',
  showFilters = false,
}: {
  q?: string;
  town?: string;
  rating?: string;
  status?: string;
  size?: 'md' | 'lg';
  showFilters?: boolean;
}) {
  const input =
    'w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
  return (
    <form action="/sponsors" method="get" role="search" className="w-full">
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchAutocomplete defaultValue={q} className={`${input} ${size === 'lg' ? 'h-14 text-lg' : 'h-11'}`} />
        <label className="sr-only" htmlFor="town">Town or city</label>
        <input
          id="town"
          name="town"
          defaultValue={town}
          placeholder="Town / city (optional)"
          className={`${input} ${size === 'lg' ? 'h-14 text-lg' : 'h-11'} sm:max-w-56`}
        />
        <button
          type="submit"
          className={`rounded-lg bg-indigo-600 px-6 font-medium text-white hover:bg-indigo-700 ${size === 'lg' ? 'h-14 text-lg' : 'h-11'}`}
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
