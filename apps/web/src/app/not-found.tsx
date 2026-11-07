import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="space-y-4 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-slate-600">We couldn&apos;t find that sponsor or page.</p>
      <Link href="/sponsors" className="text-indigo-700 hover:underline">Search sponsors</Link>
    </div>
  );
}
