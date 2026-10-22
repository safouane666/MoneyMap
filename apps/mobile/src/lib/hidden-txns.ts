/** @deprecated Prefer `archived-txns` — kept so older imports keep working. */
export {
  loadArchivedTxnIds as loadHiddenTxnIds,
  archiveTxnId as hideTxnId,
  restoreArchivedTxnId as unhideTxnId,
  loadArchivedTxnIds,
  archiveTxnId,
  restoreArchivedTxnId,
} from './archived-txns';
