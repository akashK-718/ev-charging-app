import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/PageHeader';

export const metadata: Metadata = {
  title: 'Terms and Privacy — Kirin',
};

export default function TermsPage() {
  return (
    <main className="max-w-2xl mx-auto pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:pb-10">
      <PageHeader title="Terms and Privacy" subtitle="Last updated: July 2026" href="/profile" />

      <div className="px-4 space-y-8 text-sm text-ink leading-relaxed">
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
