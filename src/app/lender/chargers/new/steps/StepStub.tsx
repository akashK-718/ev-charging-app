interface StepStubProps {
  stepName: string;
}

export function StepStub({ stepName }: StepStubProps) {
  return (
    <div>
      <h1 className="font-display font-extrabold text-3xl text-ink">{stepName}</h1>
      <div className="mt-8 p-8 rounded-2xl border-2 border-dashed border-gray-200 text-center">
        <p className="text-sm text-muted">Coming in the next PR</p>
      </div>
    </div>
  );
}
