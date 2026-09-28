/**
 * Pure reconnect / reconcile helpers — unit-testable without native NetInfo.
 */

export function shouldReconcileOnNetworkChange(
  wasOnline: boolean | null,
  isOnline: boolean,
): boolean {
  if (!isOnline) return false;
  // First observation while online: do not auto-reconcile (screens already sync on focus).
  if (wasOnline === null) return false;
  return wasOnline === false;
}

export function shouldReconcileOnAppStateChange(
  prev: string,
  next: string,
  isOnline: boolean,
): boolean {
  if (!isOnline) return false;
  if (next !== 'active') return false;
  return prev === 'background' || prev === 'inactive';
}

export function isNetInfoOnline(state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): boolean {
  // Treat null isInternetReachable as "assume online if connected" (common on first event).
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return state.isConnected === true;
}

export type ReconcileRunner = {
  reconcile: () => Promise<{ synced: number; conflicts: number }>;
};

/**
 * Serializes reconcile calls so AppState + NetInfo cannot race and double-POST.
 * Idempotency keys on the queue still protect the server; this avoids duplicate work.
 */
export function createReconcileGate(runner: ReconcileRunner) {
  let inFlight: Promise<{ synced: number; conflicts: number }> | null = null;

  return {
    async run(): Promise<{ synced: number; conflicts: number } | null> {
      if (inFlight) return inFlight;
      inFlight = runner
        .reconcile()
        .catch(() => ({ synced: 0, conflicts: 0 }))
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
  };
}
