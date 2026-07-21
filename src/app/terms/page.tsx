import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms and Privacy — Kirin',
};

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-8 pb-24">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </Link>

      <h1 className="text-2xl font-semibold text-ink mb-2">Terms and Privacy</h1>
      <p className="text-sm text-muted mb-8">Last updated: July 2026</p>

      <div className="space-y-8 text-sm text-ink leading-relaxed">
        <section>
          <h2 className="font-semibold text-base mb-2">Terms of Service</h2>
          <p className="text-muted">
            Full terms of service are being drafted and will be published here before
            the public launch. By using Kirin during this beta period you agree to
            use the platform in good faith and in accordance with applicable law.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">Privacy Policy</h2>
          <p className="text-muted">
            A full privacy policy is being drafted and will be published here before
            the public launch. Kirin collects only the information necessary to
            operate the charging network (phone number, name, location for charger
            discovery) and does not sell personal data to third parties.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-base mb-2">Contact</h2>
          <p className="text-muted">
            Questions about terms or privacy? Reach us through the Help and Support
            section in your profile.
          </p>
        </section>
      </div>
    </main>
  );
}
