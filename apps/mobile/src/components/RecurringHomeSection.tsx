import {
  currencyDecimalPlaces,
  formatDate,
  formatMinorUnits,
  parseDisplayAmount,
  type CurrencyCode,
} from '@clear-money/domain';
import { t } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  createRecurring,
  deleteRecurring,
  updateRecurring,
  type MobileRecurring,
} from '../lib/ledger';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, shadow, space } from '../theme/tokens';

function isDueWithinHours(nextDueAt: string | null, hours: number): boolean {
  if (!nextDueAt) return false;
  const due = new Date(nextDueAt).getTime();
  const now = Date.now();
  return due >= now && due <= now + hours * 3600 * 1000;
}

function RecurringListColumn({
  kind,
  items,
  currency,
  locale,
  signedIn,
  onAdd,
  onEdit,
  onDelete,
}: {
  kind: 'income' | 'expense';
  items: MobileRecurring[];
  currency: string;
  locale: string;
  signedIn: boolean;
  onAdd: () => void;
  onEdit: (item: MobileRecurring) => void;
  onDelete: (item: MobileRecurring) => void;
}) {
  const colors = useThemeColors();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const title =
    kind === 'income'
      ? t(locale, 'recurring.salaryTitle')
      : t(locale, 'recurring.subscriptionsTitle');
  const empty =
    kind === 'income'
      ? t(locale, 'recurring.salaryEmpty')
      : t(locale, 'recurring.subscriptionsEmpty');
  const addLabel =
    kind === 'income'
      ? t(locale, 'recurring.addSalary')
      : t(locale, 'recurring.addSubscription');

  return (
    <View style={styles.col}>
      <View style={styles.colHead}>
        <Text style={[styles.colTitle, { color: colors.inkSecondary }]}>{title}</Text>
        <Pressable
          onPress={onAdd}
          hitSlop={8}
          disabled={!signedIn}
          style={[styles.addBtn, { opacity: signedIn ? 1 : 0.45 }]}
        >
          <Ionicons name="add" size={14} color={colors.ink} />
          <Text style={[styles.addLabel, { color: colors.ink }]}>{addLabel}</Text>
        </Pressable>
      </View>
      {!signedIn ? (
        <Text style={[styles.needLogin, { color: colors.inkMuted }]}>
          {t(locale, 'recurring.needLogin')}
        </Text>
      ) : null}
      <View
        style={[
          styles.card,
          shadow.card,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        {items.length === 0 ? (
          <Text style={[styles.empty, { color: colors.inkMuted }]}>{empty}</Text>
        ) : (
          items.map((item, index) => {
            const dueSoon = isDueWithinHours(item.nextDueAt, 24);
            return (
              <View
                key={item.id}
                style={[
                  styles.row,
                  index < items.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.name, { color: colors.ink }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.meta, { color: colors.inkMuted }]}>
                    {t(locale, 'recurring.dayLabel', { day: item.dayOfMonth })}
                    {item.nextDueAt
                      ? ` · ${t(locale, 'recurring.nextDue')} ${formatDate(
                          item.nextDueAt,
                          locale,
                          tz,
                        )}`
                      : null}
                  </Text>
                  {dueSoon ? (
                    <View
                      style={[
                        styles.dueBadge,
                        { backgroundColor: 'rgba(217,93,93,0.18)' },
                      ]}
                    >
                      <Text style={[styles.dueBadgeText, { color: colors.expense }]}>
                        {t(locale, 'recurring.dueSoon')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.right}>
                  <Text
                    style={[
                      styles.amount,
                      { color: kind === 'income' ? colors.income : colors.expense },
                    ]}
                  >
                    {kind === 'expense' ? '−' : '+'}
                    {formatMinorUnits(item.amountMinor, currency, locale)}
                  </Text>
                  <View style={styles.actions}>
                    <Pressable
                      hitSlop={8}
                      onPress={() => onEdit(item)}
                      disabled={!signedIn}
                      accessibilityLabel={t(locale, 'recurring.edit')}
                      style={styles.iconBtn}
                    >
                      <Ionicons name="pencil-outline" size={14} color={colors.inkSecondary} />
                    </Pressable>
                    <Pressable
                      hitSlop={8}
                      onPress={() => onDelete(item)}
                      disabled={!signedIn}
                      accessibilityLabel={t(locale, 'recurring.remove')}
                      style={styles.iconBtn}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.expense} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

/** Salary & subscriptions — same layout/CRUD as web RecurringHomeSection. */
export function RecurringHomeSection({
  items,
  currency,
  locale,
  spaceId,
  signedIn,
  onChanged,
}: {
  items: MobileRecurring[];
  currency: string;
  locale: string;
  spaceId: string;
  signedIn: boolean;
  onChanged: () => void;
}) {
  const colors = useThemeColors();
  const salary = items.filter((r) => r.kind === 'income');
  const subscriptions = items.filter((r) => r.kind === 'expense');
  const dueToastShown = useRef(false);

  const [kind, setKind] = useState<'income' | 'expense'>('income');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MobileRecurring | null>(null);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [day, setDay] = useState('1');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      const decimals = currencyDecimalPlaces(currency as CurrencyCode);
      setAmount(String(editing.amountMinor / 10 ** decimals));
      setDay(String(editing.dayOfMonth));
    } else {
      setName('');
      setAmount('');
      setDay('1');
    }
    setError(null);
  }, [open, editing, currency]);

  useEffect(() => {
    if (!signedIn || dueToastShown.current) return;
    const due = [...salary, ...subscriptions].filter((r) =>
      isDueWithinHours(r.nextDueAt, 24),
    );
    if (due.length === 0) return;
    dueToastShown.current = true;
    const names = due.map((d) => d.name).join(', ');
    Alert.alert(t(locale, 'recurring.dueSoon'), t(locale, 'recurring.dueSoonToast', { names }));
  }, [signedIn, salary, subscriptions, locale]);

  const openCreate = (k: 'income' | 'expense') => {
    if (!signedIn) {
      Alert.alert('Sign in required', t(locale, 'recurring.needLogin'));
      return;
    }
    setEditing(null);
    setKind(k);
    setOpen(true);
  };

  const openEdit = (item: MobileRecurring) => {
    setEditing(item);
    setKind(item.kind);
    setOpen(true);
  };

  const handleDelete = (item: MobileRecurring) => {
    Alert.alert(t(locale, 'recurring.remove'), `Remove “${item.name}”?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: t(locale, 'recurring.remove'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteRecurring(spaceId, item.id);
              onChanged();
            } catch (err) {
              Alert.alert(
                'Error',
                err instanceof Error ? err.message : t(locale, 'recurring.removeFailed'),
              );
            }
          })();
        },
      },
    ]);
  };

  const onSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const amountMinor = Math.abs(parseDisplayAmount(amount, currency as CurrencyCode));
      if (amountMinor <= 0) throw new Error(t(locale, 'recurring.invalidAmount'));
      const dayOfMonth = Math.trunc(Number(day));
      if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) {
        throw new Error(t(locale, 'recurring.invalidDay'));
      }
      const trimmed = name.trim();
      if (!trimmed) throw new Error(t(locale, 'recurring.invalidName'));
      if (editing) {
        await updateRecurring(spaceId, editing.id, {
          name: trimmed,
          amountMinor,
          dayOfMonth,
          kind,
        });
      } else {
        await createRecurring({
          spaceId,
          name: trimmed,
          amountMinor,
          kind,
          dayOfMonth,
        });
      }
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(locale, 'recurring.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const dialogTitle =
    kind === 'income'
      ? editing
        ? t(locale, 'recurring.editSalary')
        : t(locale, 'recurring.addSalary')
      : editing
        ? t(locale, 'recurring.editSubscription')
        : t(locale, 'recurring.addSubscription');

  return (
    <View style={styles.wrap}>
      <RecurringListColumn
        kind="income"
        items={salary}
        currency={currency}
        locale={locale}
        signedIn={signedIn}
        onAdd={() => openCreate('income')}
        onEdit={openEdit}
        onDelete={handleDelete}
      />
      <RecurringListColumn
        kind="expense"
        items={subscriptions}
        currency={currency}
        locale={locale}
        signedIn={signedIn}
        onAdd={() => openCreate('expense')}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.modalTitle, { color: colors.ink }]}>{dialogTitle}</Text>
            <Text style={[styles.fieldLabel, { color: colors.inkSecondary }]}>
              {t(locale, 'recurring.name')}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.ink, backgroundColor: colors.canvas },
              ]}
              placeholderTextColor={colors.inkMuted}
              autoCapitalize="sentences"
            />
            <Text style={[styles.fieldLabel, { color: colors.inkSecondary }]}>
              {t(locale, 'recurring.amount')}
            </Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.ink, backgroundColor: colors.canvas },
              ]}
              placeholderTextColor={colors.inkMuted}
            />
            <Text style={[styles.fieldLabel, { color: colors.inkSecondary }]}>
              {t(locale, 'recurring.dayOfMonth')}
            </Text>
            <TextInput
              value={day}
              onChangeText={setDay}
              keyboardType="number-pad"
              style={[
                styles.input,
                { borderColor: colors.border, color: colors.ink, backgroundColor: colors.canvas },
              ]}
              placeholderTextColor={colors.inkMuted}
            />
            <Text style={[styles.dayHint, { color: colors.inkMuted }]}>
              {t(locale, 'recurring.dayHint')}
            </Text>
            {error ? (
              <Text style={{ color: colors.expense, marginBottom: space[2] }}>{error}</Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setOpen(false)} style={styles.modalBtn}>
                <Text style={{ color: colors.inkSecondary, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onSave()}
                disabled={busy}
                style={[styles.modalBtnPrimary, { backgroundColor: colors.brand }]}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    {t(locale, 'recurring.save')}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space[4] },
  col: { gap: space[3] },
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[2],
  },
  colTitle: { fontSize: 14, fontWeight: '500', flexShrink: 1 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: space[1],
  },
  addLabel: { fontSize: 13, fontWeight: '500' },
  needLogin: { fontSize: 12, marginTop: -4 },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  empty: {
    paddingHorizontal: space[4],
    paddingVertical: space[6],
    textAlign: 'center',
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  name: { fontSize: 15, fontWeight: '500' },
  meta: { marginTop: 2, fontSize: 12 },
  dueBadge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    borderRadius: radius.pill,
    paddingHorizontal: space[2],
    paddingVertical: 2,
  },
  dueBadgeText: { fontSize: 11, fontWeight: '600' },
  right: { alignItems: 'flex-end', gap: 4 },
  amount: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  actions: { flexDirection: 'row', gap: 4 },
  iconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: radius.feature,
    borderTopRightRadius: radius.feature,
    borderWidth: 1,
    padding: space[5],
    paddingBottom: space[8],
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: space[4] },
  fieldLabel: { fontSize: 13, marginBottom: space[1] },
  input: {
    borderWidth: 1,
    borderRadius: radius.control,
    minHeight: 44,
    paddingHorizontal: space[3],
    marginBottom: space[3],
    fontSize: 16,
  },
  dayHint: { fontSize: 12, marginTop: -space[2], marginBottom: space[3] },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space[3],
    marginTop: space[2],
  },
  modalBtn: {
    minHeight: 44,
    paddingHorizontal: space[4],
    justifyContent: 'center',
  },
  modalBtnPrimary: {
    minHeight: 44,
    minWidth: 88,
    borderRadius: radius.control,
    paddingHorizontal: space[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
