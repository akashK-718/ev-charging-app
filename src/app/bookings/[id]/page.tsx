/**
 * /bookings/[id] — single booking detail (active session, completed, etc.)
 * TODO (Milestone 3): show status, confirmation code, session details.
 */
export default function BookingDetailPage({
  params
}: {
  params: { id: string };
}) {
  return (
    <main className="min-h-screen px-6 py-12">
      <h1 className="font-display font-extrabold text-2xl">
        Booking {params.id}
      </h1>
    </main>
  );
}
