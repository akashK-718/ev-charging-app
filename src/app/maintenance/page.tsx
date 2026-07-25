export default function MaintenancePage() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-surface-page">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-copper-soft flex items-center justify-center mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="text-copper">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-ink">Temporarily unavailable</h1>
        <p className="text-sm text-muted leading-relaxed">
          Kirin is undergoing scheduled maintenance. We&apos;ll be back shortly.
        </p>
        <p className="text-xs text-muted">
          If you need urgent assistance, contact us at{' '}
          <a href="mailto:support@kirin.app" className="text-green underline">
            support@kirin.app
          </a>
          .
        </p>
      </div>
    </div>
  );
}
