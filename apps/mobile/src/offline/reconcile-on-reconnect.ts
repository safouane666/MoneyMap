import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import type { OfflineQueue } from './queue';
import {
  createReconcileGate,
  isNetInfoOnline,
  shouldReconcileOnAppStateChange,
  shouldReconcileOnNetworkChange,
} from './reconnect-policy';

export {
  createReconcileGate,
  isNetInfoOnline,
  shouldReconcileOnAppStateChange,
  shouldReconcileOnNetworkChange,
} from './reconnect-policy';

/**
 * Subscribe to network + AppState and call `queue.reconcile()` when back online.
 * Returns an unsubscribe function.
 */
export function startReconcileOnReconnect(queue: OfflineQueue): () => void {
  const gate = createReconcileGate(queue);
  let wasOnline: boolean | null = null;
  let appState: AppStateStatus = AppState.currentState;

  const onNetInfo = (state: NetInfoState) => {
    const online = isNetInfoOnline(state);
    if (shouldReconcileOnNetworkChange(wasOnline, online)) {
      void gate.run();
    }
    wasOnline = online;
  };

  const onAppState = (next: AppStateStatus) => {
    if (shouldReconcileOnAppStateChange(appState, next, wasOnline === true)) {
      void gate.run();
    }
    appState = next;
  };

  const netUnsub = NetInfo.addEventListener(onNetInfo);
  const appSub: NativeEventSubscription = AppState.addEventListener('change', onAppState);

  // Seed wasOnline without triggering reconcile on cold start.
  void NetInfo.fetch().then((state) => {
    wasOnline = isNetInfoOnline(state);
  });

  return () => {
    netUnsub();
    appSub.remove();
  };
}
