/** A generation guard prevents obsolete async work from committing state. */
export function createRequestGuard() {
  let generation = 0;
  const capture = () => {
    const current = generation;
    return () => current === generation;
  };
  return {
    capture,
    begin() { generation += 1; return capture(); },
    invalidate() { generation += 1; },
  };
}
