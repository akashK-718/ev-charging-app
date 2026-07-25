export default function EmergencyPage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-surface-page">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-danger-soft flex items-center justify-center mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="text-danger">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-ink">Service unavailable</h1>
        <p className="text-sm text-muted leading-relaxed">
          Kirin is currently unavailable. Our team has been notified and is
          working to restore service.
        </p>
        <p className="text-xs text-muted">
          For urgent matters, contact{' '}
          <a href="mailto:support@kirin.app" className="text-green underline">
            support@kirin.app
          </a>
          .
        </p>
        <a
          href="/auth"
          className="inline-block text-xs text-muted underline underline-offset-2"
        >
          Admin sign in
        </a>
      </div>
    </div>
  );
}
