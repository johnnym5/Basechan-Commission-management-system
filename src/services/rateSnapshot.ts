/** Return cached rates only while the authenticated read scope still matches. */
export function selectRatesForScope<T>(rates: T[], snapshotScope: string | null, activeScope: string | null): T[] {
  return snapshotScope && snapshotScope === activeScope ? rates : [];
}
