/**
 * /admin — admin overview dashboard.
 * TODO (Milestone 6): metrics, recent activity, alerts.
 * IMPORTANT: gate this behind admin role check via middleware.
 */
export default function AdminHomePage() {
  return (
    <main className="min-h-screen px-6 py-12">
      <h1 className="font-display font-extrabold text-3xl">Admin</h1>
      <p className="mt-2 text-muted">Admin dashboard coming in Milestone 6.</p>
    </main>
  );
}
