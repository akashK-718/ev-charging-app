export function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="rise-in flex flex-col items-center text-center py-14 px-8">
      <div className="size-16 grid place-items-center rounded-3xl bg-green-soft text-green mb-4">
        {icon}
      </div>
      <p className="font-bold text-ink">{title}</p>
      <p className="text-sm text-muted mt-1 leading-relaxed">{subtitle}</p>
    </div>
  );
}
