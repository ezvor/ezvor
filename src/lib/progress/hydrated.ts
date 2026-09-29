import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False during SSR and hydration, true afterwards. Gate anything that depends
 * on the viewer's clock or time zone (dates, "due in 2 days") behind it to
 * avoid hydration mismatches.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
