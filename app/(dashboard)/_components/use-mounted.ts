import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

// SSR-safe "has this component reached the client yet" check — used to defer
// a createPortal(..., document.body) call, since `document` doesn't exist
// during the server render. Mount status never changes after the initial
// client render, so there's nothing to actually subscribe to; expressed via
// useSyncExternalStore (rather than useState+useEffect) so it doesn't trip
// the react-hooks/set-state-in-effect lint rule.
export function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
