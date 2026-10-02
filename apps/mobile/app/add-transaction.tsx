import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  categoryChipParts,
  createIdempotencyKey,
  formatMinorUnits,
  parseAmountInput,
  type CurrencyCode,
} from '@clear-money/domain';
import { t } from '../src/lib/i18n';
import { apiFetch } from '../src/lib/api';
import {
  appendGuestTransaction,
  loadLedger,
  type MobileCategory,
  type MobileLedger,
} from '../src/lib/ledger';
import { notifyPennyEntry } from '../src/lib/penny-notify';
import { getPersonalSpaceId } from '../src/lib/session';
import { loadSetupSession } from '../src/lib/setup-session';
import { offlineQueue } from '../src/offline/client';
import { useToast } from '../src/components/Toast';
import { useThemeColors } from '../src/theme/ThemeContext';
import { radius, space } from '../src/theme/tokens';

const OPS = ['+', '−', '×', '÷'] as const;

function toLocalInputValue(date = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AddTransactionModal() {
  const router = useRouter();
  const colors = useThemeColors();
  const { showPennyTip, showToast } = useToast();
  const [locale, setLocale] = useState('en');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [ledger, setLedger] = useState<MobileLedger | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [note, setNote] = useState('');
  const [occurredAt, setOccurredAt] = useState(toLocalInputValue());
  const [moreOpen, setMoreOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLocale((await loadSetupSession()).language);
      const data = await loadLedger().catch(() => null);
      if (!data) return;
      setLedger(data);
      const first = data.categories.find((c) => c.type === 'expense');
      if (first) setCategoryId(first.id);
    })();
  }, []);

  const categories = useMemo(
    () =>
      (ledger?.categories ?? []).filter(
        (c) =>
          c.type === type &&
          (c.spaceId == null || c.spaceId === ledger?.activeSpaceId),
      ),
    [ledger, type],
  );

  useEffect(() => {
    if (!categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0]?.id ?? null);
    }
  }, [categories, categoryId]);

  const activeSpace = ledger?.spaces.find((s) => s.id === ledger.activeSpaceId);
  const currency = activeSpace?.currency ?? 'USD';

  async function createCategory(name: string): Promise<MobileCategory | null> {
    const spaceId = ledger?.activeSpaceId;
    if (!spaceId) return null;
    const res = await apiFetch('/categories', {
      method: 'POST',
      body: JSON.stringify({ name, type, spaceId }),
    });
    if (!res.ok) return null;
    const row = (await res.json()) as MobileCategory;
    setLedger((prev) => (prev ? { ...prev, categories: [...prev.categories, row] } : prev));
    return row;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.ink }]}>{t(locale, 'txn.addTitle')}</Text>
        <Text style={[styles.sub, { color: colors.inkSecondary }]}>{t(locale, 'txn.addSubtitle')}</Text>

        <View
          style={[
            styles.hero,
            {
              backgroundColor:
                type === 'expense' ? 'rgba(217,93,93,0.08)' : 'rgba(21,154,114,0.08)',
            },
          ]}
        >
          <Text style={[styles.currency, { color: colors.inkMuted }]}>{currency}</Text>
          <TextInput
            accessibilityLabel={t(locale, 'txn.amount')}
            keyboardType="numbers-and-punctuation"
            value={amount}
            onChangeText={(text) => setAmount(text.replace(/[^0-9.+\-×÷x*/]/gi, ''))}
            placeholder="0 or 12+3.5"
            placeholderTextColor={colors.inkMuted}
            style={[
              styles.amount,
              { color: type === 'expense' ? colors.expense : colors.income },
            ]}
          />
          <View style={styles.ops}>
            {OPS.map((op) => (
              <Pressable
                key={op}
                onPress={() => {
                  setAmount((prev) => {
                    if (!prev) return prev;
                    if (/[+\-−×÷*/x]$/i.test(prev)) return `${prev.slice(0, -1)}${op}`;
                    return `${prev}${op}`;
                  });
                }}
                style={[styles.opBtn, { backgroundColor: colors.brandTint }]}
              >
                <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 18 }}>{op}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.tabs, { backgroundColor: colors.canvas }]}>
          {(['expense', 'income'] as const).map((value) => {
            const on = type === value;
            return (
              <Pressable
                key={value}
                onPress={() => {
                  setType(value);
                  setAddingCat(false);
                }}
                style={[
                  styles.tab,
                  on && { backgroundColor: colors.surface },
                ]}
              >
                <Text
                  style={{
                    fontWeight: '700',
                    color: on
                      ? value === 'expense'
                        ? colors.expense
                        : colors.income
                      : colors.inkSecondary,
                  }}
                >
                  {value === 'expense' ? t(locale, 'txn.spend') : t(locale, 'txn.receive')}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.catHead}>
          <Text style={{ color: colors.inkSecondary, fontWeight: '600' }}>{t(locale, 'txn.category')}</Text>
          <Pressable onPress={() => setAddingCat((v) => !v)}>
            <Text style={{ color: colors.brand, fontWeight: '600', fontSize: 12 }}>
              {t(locale, 'txn.addCategory')}
            </Text>
          </Pressable>
        </View>
        <View style={styles.chips}>
          {categories.length === 0 ? (
            <Text style={{ color: colors.inkMuted, fontSize: 13, marginHorizontal: 4 }}>
              {t(locale, 'txn.noCategories')}
            </Text>
          ) : (
            categories.map((c) => {
              const parts = categoryChipParts(c.name, c.stableKey);
              const on = categoryId === c.id;
              return (
                <View key={c.id} style={styles.chipCell}>
                  <Pressable
                    onPress={() => setCategoryId(c.id)}
                    style={[
                      styles.chip,
                      {
                        borderColor: on ? colors.brand : colors.border,
                        backgroundColor: on ? colors.brandTint : colors.surface,
                      },
                    ]}
                  >
                    {parts.emoji ? (
                      <Text style={styles.chipEmoji} allowFontScaling={false}>
                        {parts.emoji}
                      </Text>
                    ) : null}
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[styles.chipLabel, { color: on ? colors.brand : colors.ink }]}
                    >
                      {parts.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
        {addingCat ? (
          <View style={styles.addCat}>
            <TextInput
              value={newCat}
              onChangeText={setNewCat}
              placeholder={t(locale, 'txn.category')}
              placeholderTextColor={colors.inkMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.ink, backgroundColor: colors.surface }]}
            />
            <Pressable
              onPress={() => {
                void (async () => {
                  const created = await createCategory(newCat.trim());
                  if (created) {
                    setCategoryId(created.id);
                    setNewCat('');
                    setAddingCat(false);
                  } else setError(t(locale, 'errors.generic'));
                })();
              }}
              style={[styles.smallCta, { backgroundColor: colors.brand }]}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{t(locale, 'txn.save')}</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable onPress={() => setMoreOpen((v) => !v)}>
          <Text style={{ color: colors.brand, fontWeight: '600' }}>{t(locale, 'txn.more')}</Text>
        </Pressable>
        {moreOpen ? (
          <View style={{ gap: space[3] }}>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t(locale, 'txn.notePlaceholder')}
              placeholderTextColor={colors.inkMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.ink, backgroundColor: colors.surface }]}
            />
            <TextInput
              value={occurredAt}
              onChangeText={setOccurredAt}
              placeholder={t(locale, 'txn.when')}
              placeholderTextColor={colors.inkMuted}
              style={[styles.input, { borderColor: colors.border, color: colors.ink, backgroundColor: colors.surface }]}
            />
          </View>
        ) : null}

        {error ? <Text style={{ color: colors.expense }}>{error}</Text> : null}

        <Pressable
          disabled={saving}
          onPress={() => {
            void (async () => {
              if (saving) return;
              setSaving(true);
              setError(null);
              try {
                const amountMinor = Math.abs(parseAmountInput(amount || '0', currency as CurrencyCode));
                if (amountMinor <= 0) {
                  setError(t(locale, 'txn.enterAmount'));
                  return;
                }
                const setup = await loadSetupSession();
                const spaceId = ledger?.activeSpaceId || (await getPersonalSpaceId()) || 'space_local';
                const spaceCurrency =
                  ledger?.spaces.find((s) => s.id === spaceId)?.currency || setup.currency || 'USD';
                const cat = categories.find((c) => c.id === categoryId);
                const description = note.trim() || cat?.name || null;
                const occurredIso = new Date(occurredAt.replace(' ', 'T')).toISOString();

                if (ledger?.userId === 'guest') {
                  await appendGuestTransaction({
                    type,
                    amountMinor,
                    currency: spaceCurrency,
                    categoryId,
                    description,
                    occurredAt: occurredIso,
                  });
                } else {
                  await offlineQueue.enqueueLocal({
                    spaceId,
                    type,
                    amountMinor,
                    currency: spaceCurrency,
                    categoryId,
                    description,
                    occurredAt: occurredIso,
                    idempotencyKey: createIdempotencyKey(),
                  });
                  await offlineQueue.reconcile();
                }
                await notifyPennyEntry({
                  type,
                  amountMinor,
                  currency: spaceCurrency,
                  spaceId,
                  goals: ledger?.goals ?? [],
                  locale,
                  formatAmount: (minor, cur) => formatMinorUnits(minor, cur, locale),
                  showPennyTip,
                  showToast,
                  fallbackMessage: t(locale, 'app.saved'),
                });
                router.back();
              } catch (err) {
                setError(err instanceof Error ? err.message : t(locale, 'errors.generic'));
              } finally {
                setSaving(false);
              }
            })();
          }}
          style={[styles.save, { backgroundColor: colors.brand, opacity: saving ? 0.6 : 1 }]}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {saving
              ? '…'
              : type === 'expense'
                ? t(locale, 'txn.saveExpense')
                : t(locale, 'txn.saveIncome')}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[6], gap: space[4], paddingBottom: space[12] },
  title: { fontSize: 24, fontWeight: '600' },
  sub: { fontSize: 14, marginTop: -8 },
  hero: { borderRadius: 20, padding: space[4], gap: space[3] },
  currency: { fontSize: 13, fontWeight: '600' },
  amount: { fontSize: 40, fontWeight: '700', fontVariant: ['tabular-nums'] },
  ops: { flexDirection: 'row', gap: space[2] },
  opBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { flexDirection: 'row', borderRadius: radius.control, padding: 4, gap: 4 },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.control - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // 2-column grid like web `grid-cols-2`.
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  chipCell: {
    width: '50%',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  chip: {
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space[3],
  },
  chipEmoji: { fontSize: 16, lineHeight: 20 },
  chipLabel: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  addCat: { flexDirection: 'row', gap: space[2] },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: space[3],
  },
  smallCta: { minHeight: 48, paddingHorizontal: space[4], borderRadius: radius.control, justifyContent: 'center' },
  save: { minHeight: 48, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
});
