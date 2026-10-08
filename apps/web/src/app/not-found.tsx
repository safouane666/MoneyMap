import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas px-4 text-ink">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-ink-secondary">That route is not part of Penny.</p>
      <Link href="/" className="text-brand underline-offset-4 hover:underline">
        Back home
      </Link>
    </main>
  );
}
