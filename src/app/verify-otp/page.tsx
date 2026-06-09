export default function VerifyOtpPage() {
  return (
    <main className="min-h-screen flex flex-col px-6 py-12">
      <h1 className="font-display font-extrabold text-3xl text-ink">
        Enter the code
      </h1>
      <p className="mt-2 text-muted">
        We sent a 6-digit code to your phone.
      </p>
      {/* TODO: 6-digit OTP input + verify button. See Milestone 1, step 2. */}
    </main>
  );
}
