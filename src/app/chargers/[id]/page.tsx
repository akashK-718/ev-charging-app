/**
 * /chargers/[id] — single charger detail page.
 * TODO (Milestone 2): photos, specs, host, reviews, "Book a slot" CTA.
 */
export default function ChargerDetailPage({
  params
}: {
  params: { id: string };
}) {
  return (
    <main className="min-h-screen px-6 py-12">
      <h1 className="font-display font-extrabold text-2xl">
        Charger {params.id}
      </h1>
      <p className="mt-2 text-muted">Detail page coming in Milestone 2.</p>
    </main>
  );
}
