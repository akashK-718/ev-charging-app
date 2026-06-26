import Link from 'next/link';
import { Clock, Lock, Shield } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col px-6 py-10 animate-page-in">
      {/* Hero */}
      <section className="flex-1 flex flex-col justify-center">
        <h1 className="font-display font-extrabold text-4xl text-ink leading-tight tracking-tight">
          Charge your EV at a neighbour&apos;s home.
        </h1>
        <p className="mt-4 text-muted text-base leading-relaxed">
          A community-powered network of home EV chargers. Find one nearby,
          book a slot, charge, and pay — all in one app.
        </p>

        <div className="mt-8">
          <Link
            href="/login"
            className="block w-full bg-volt text-ink font-display font-bold text-center py-4 rounded-2xl hover:bg-volt-deep hover:text-white transition-colors"
          >
            Get started
          </Link>
        </div>

        {/* Trust strip */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          {[
            { Icon: Shield, label: 'Verified hosts' },
            { Icon: Lock,   label: 'Secure payments' },
            { Icon: Clock,  label: 'Real-time booking' },
          ].map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon className="w-4 h-4 text-volt-deep shrink-0" />
              <span className="text-sm text-muted">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="pt-10 text-center text-xs text-muted">
        Prototype · BETA
      </footer>
    </main>
  );
}
