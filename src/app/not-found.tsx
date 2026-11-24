import Link from 'next/link';

export const metadata = {
  title: 'Page not found',
};

const linkClass =
  'block w-full min-h-[44px] px-4 py-3 rounded-xl border border-[var(--if-text-muted)] bg-[var(--if-surface)] text-[var(--if-text)] font-semibold text-center hover:border-[var(--if-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--if-accent)]';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--if-page)]">
      <div className="w-full max-w-md text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--if-accent)] mb-2">404</p>
        <h1 className="text-2xl font-bold text-[var(--if-text)] mb-2">Page not found</h1>
        <p className="text-sm text-[var(--if-text-secondary)] mb-8">
          We couldn&apos;t find that page. Choose where you&apos;d like to go.
        </p>
        <nav aria-label="Where to go next" className="space-y-3">
          <Link href="/" className={linkClass}>Home</Link>
          <Link href="/login" className={linkClass}>Admin / owner log in</Link>
          <Link href="/staff-login" className={linkClass}>Staff log in</Link>
          <Link href="/portal/login" className={linkClass}>Parent portal</Link>
        </nav>
      </div>
    </main>
  );
}
