import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-6 pt-12 pb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-ink grid place-items-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
              <path
                d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z"
                fill="#10d96a"
              />
            </svg>
          </div>
          <h1 className="font-display font-bold text-xl text-ink">EV Charger</h1>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 px-6 flex flex-col justify-center">
        <h2 className="font-display font-extrabold text-4xl text-ink leading-tight tracking-tight">
          Charge your EV at a neighbour&apos;s home.
        </h2>
        <p className="mt-4 text-muted text-base leading-relaxed">
          A community-powered network of home EV chargers. Find one nearby,
          book a slot, charge, and pay — all in one app.
        </p>

        <div className="mt-10">
          <Link
            href="/login"
            className="block w-full bg-volt text-ink font-display font-bold text-center py-4 rounded-2xl"
          >
            Get started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-xs text-muted">
        Prototype · BETA
      </footer>
    </main>
  );
}
