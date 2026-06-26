/**
 * /lender/dashboard — earnings + chargers + recent activity.
 * TODO (Milestone 5): wire up real earnings data.
 */
export default function LenderDashboardPage({
  searchParams,
}: {
  searchParams: { listed?: string };
}) {
  return (
    <main className="min-h-screen px-6 py-12">
      {searchParams.listed === '1' && (
        <div className="mb-6 px-4 py-3 bg-volt-soft rounded-2xl border border-volt">
          <p className="font-semibold text-ink">
            Charger listed! It&apos;s now visible to drivers.
          </p>
        </div>
      )}
      <h1 className="font-display font-extrabold text-3xl">
        Lender dashboard
      </h1>
      <p className="mt-2 text-muted">
        Earnings and charger management coming in Milestone 5.
      </p>
    </main>
  );
}
