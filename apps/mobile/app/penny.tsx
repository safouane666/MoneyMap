import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { computePeriodTotals } from '@clear-money/domain';
import { PennyAvatar } from '../src/components/penny/PennyFigure';
import { applyPennyActions, type PennyAction } from '../src/lib/apply-penny-actions';
import { apiFetch } from '../src/lib/api';
import { t } from '../src/lib/i18n';
import {
  categoryName,
  getWebOrigin,
  loadLedger,
  transactionsForSpace,
} from '../src/lib/ledger';
import { getSessionCookie } from '../src/lib/session';
import { loadSetupSession } from '../src/lib/setup-session';
import { useThemeColors } from '../src/theme/ThemeContext';
import { radius, space } from '../src/theme/tokens';

type ChatMsg = { id: string; role: 'user' | 'assistant'; content: string };

const STARTERS = [
  'I spent 12.50 on coffee',
  'Create a goal for a laptop — 1200 over 6 months',
  'Add my salary 3000 on the 1st',
  'Delete the last expense',
  'Rename Coffee to Café',
  'What did I spend this month?',
];

function chipsFromActions(
  actions: PennyAction[],
  apiSuggestions?: Array<{ label?: string; value?: string }>,
): Array<{ label: string; value: string }> {
  const ask = actions.find((a) => a.type === 'ask_category') as
    | Extract<PennyAction, { type: 'ask_category' }>
    | undefined;
  if (ask?.suggestions?.length) {
    return ask.suggestions.map((s) => ({ label: s.label, value: s.value }));
  }
  if (apiSuggestions?.length) {
    return apiSuggestions
      .filter((s) => s.value)
      .map((s) => ({ label: s.label || String(s.value), value: String(s.value) }));
  }
  return [];
}

export default function PennyScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [locale, setLocale] = useState('en');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guest, setGuest] = useState(false);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [categoryChips, setCategoryChips] = useState<Array<{ label: string; value: string }>>([]);
  const pendingAskRef = useRef<PennyAction | null>(null);
  const listRef = useRef<FlatList>(null);

  const boot = useCallback(async () => {
    const setup = await loadSetupSession();
    setLocale(setup.language);
    const ledger = await loadLedger().catch(() => null);
    const isGuest = !ledger || ledger.userId === 'guest';
    setGuest(isGuest);
    if (isGuest) {
      setMessages([
        { id: 'welcome', role: 'assistant', content: t(setup.language, 'ai.needLogin') },
      ]);
      setHistoryLoading(false);
      return;
    }
    const usage = await apiFetch('/ai/usage');
    if (usage.ok) {
      const body = (await usage.json()) as { remaining?: number };
      if (typeof body.remaining === 'number') setCreditsLeft(body.remaining);
    }
    const turnsRes = await apiFetch('/ai/penny/turns?limit=10');
    if (turnsRes.ok) {
      const body = (await turnsRes.json()) as {
        turns?: Array<{ id: string; role: string; content: string }>;
      };
      const turns = (body.turns ?? [])
        .filter((row) => row.role === 'user' || row.role === 'assistant')
        .reverse()
        .map((row) => ({
          id: row.id,
          role: row.role as 'user' | 'assistant',
          content: row.content,
        }));
      setMessages(
        turns.length
          ? turns
          : [{ id: 'welcome', role: 'assistant', content: t(setup.language, 'ai.welcome') }],
      );
    } else {
      setMessages([{ id: 'welcome', role: 'assistant', content: t(setup.language, 'ai.welcome') }]);
    }
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  async function send(textRaw?: string) {
    const text = (textRaw ?? input).trim();
    if (!text || busy || guest) return;
    setInput('');
    setBusy(true);
    setError(null);
    setCategoryChips([]);
    const userMsg: ChatMsg = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((m) => [...m, userMsg]);

    try {
      const setup = await loadSetupSession();
      let ledger = await loadLedger();

      // If Penny asked for a category, complete the pending spend locally first.
      const pending = pendingAskRef.current;
      if (pending && pending.type === 'ask_category') {
        const appliedLocal = await applyPennyActions(
          [
            {
              type: 'add_transaction',
              entryType: pending.entryType,
              amountMajor: pending.amountMajor,
              category: text,
              note: pending.note,
              occurredAt: pending.occurredAt,
            },
          ],
          ledger,
        );
        pendingAskRef.current = null;
        if (appliedLocal.applied > 0) {
          ledger = await loadLedger().catch(() => ledger);
          setMessages((m) => [
            ...m,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: `Saved — ${pending.entryType} ${pending.amountMajor} · ${text}.`,
            },
          ]);
          setBusy(false);
          return;
        }
        setMessages((m) => [
          ...m,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: t(locale, 'ai.error'),
          },
        ]);
        setBusy(false);
        return;
      }

      const space = ledger.spaces.find((s) => s.id === ledger.activeSpaceId);
      const txns = transactionsForSpace(ledger);
      const totals = computePeriodTotals(txns, space?.currency ?? 'USD');
      const cookie = await getSessionCookie();

      const history = [...messages, userMsg]
        .filter((m) => m.id !== 'welcome')
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${getWebOrigin()}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify({
          messages: history,
          locale: setup.language,
          context: {
            currency: space?.currency ?? 'USD',
            spaceName: space?.name ?? 'Personal',
            spaceId: ledger.activeSpaceId,
            categories: ledger.categories
              .filter((c) => c.spaceId == null || c.spaceId === ledger.activeSpaceId)
              .map((c) => ({
                id: c.id,
                name: c.name,
                type: c.type,
              })),
            totals: {
              incomeMinor: totals.incomeMinor,
              expenseMinor: totals.expenseMinor,
              netMinor: totals.netMinor,
            },
            recent: txns.slice(0, 12).map((row) => ({
              id: row.id,
              type: row.type,
              amountMinor: row.amountMinor,
              category: categoryName(ledger, row.categoryId),
              description: row.description,
              occurredAt: row.occurredAt,
            })),
            goals: ledger.goals
              .filter((g) => g.spaceId === ledger.activeSpaceId && g.status !== 'cancelled')
              .slice(0, 12)
              .map((g) => ({
                id: g.id,
                name: g.name,
                targetMinor: g.targetMinor,
                savedMinor: g.savedMinor,
                durationMonths: g.durationMonths,
                status: g.status,
                paceStatus: g.paceStatus ?? null,
              })),
            recurring: ledger.recurring
              .filter((r) => r.spaceId === ledger.activeSpaceId)
              .slice(0, 12)
              .map((r) => ({
                id: r.id,
                name: r.name,
                amountMinor: r.amountMinor,
                kind: r.kind,
                dayOfMonth: r.dayOfMonth,
                active: r.active,
              })),
            spaces: ledger.spaces.map((s) => ({
              id: s.id,
              name: s.name,
              currency: s.currency,
            })),
          },
        }),
      });

      const body = (await res.json().catch(() => ({}))) as {
        reply?: string;
        message?: string;
        error?: string;
        actions?: PennyAction[];
        suggestions?: Array<{ label?: string; value?: string }>;
        usage?: { remaining?: number };
      };
      if (typeof body.usage?.remaining === 'number') setCreditsLeft(body.usage.remaining);
      if (res.status === 401) throw new Error(t(locale, 'ai.needLogin'));
      if (res.status === 402) throw new Error(t(locale, 'ai.outOfCredits'));
      if (!res.ok) throw new Error(body.error || body.message || t(locale, 'ai.error'));

      const actions = Array.isArray(body.actions) ? body.actions : [];
      const applied = await applyPennyActions(actions, ledger);
      pendingAskRef.current = applied.pendingAsk;
      setCategoryChips(chipsFromActions(actions, body.suggestions));

      let reply = body.reply || body.message || t(locale, 'ai.error');
      if (applied.reports.length) {
        reply = `${reply}\n\n${applied.reports.map((r) => `${r.title}\n${r.body}`).join('\n\n')}`;
      }
      if (applied.applied > 0) {
        ledger = await loadLedger().catch(() => ledger);
      }
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t(locale, 'ai.error');
      setError(msg);
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: msg }]);
    } finally {
      setBusy(false);
    }
  }

  const pose = busy ? 'think' : error ? 'alert' : 'hello';
  const showStarters = !guest && messages.length <= 2 && !busy && categoryChips.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <PennyAvatar pose={pose} size="nav" name={t(locale, 'ai.title')} />
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: colors.ink }]}>{t(locale, 'ai.title')}</Text>
          <Text style={[styles.headerSub, { color: colors.inkMuted }]}>
            {busy ? t(locale, 'ai.thinking') : t(locale, 'ai.subtitle')}
          </Text>
          {creditsLeft != null && !guest ? (
            <Text style={[styles.credits, { color: colors.inkMuted }]}>
              {t(locale, 'ai.creditsLeft', { count: creditsLeft })}
            </Text>
          ) : null}
        </View>
      </View>

      {guest ? (
        <View style={[styles.gate, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.inkSecondary, fontSize: 14 }}>{t(locale, 'ai.needLogin')}</Text>
          <Pressable
            onPress={() => router.push('/auth/sign-in')}
            style={[styles.signIn, { backgroundColor: colors.brand }]}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{t(locale, 'nav.signIn')}</Text>
          </Pressable>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        {historyLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.brand} />
            <Text style={{ color: colors.inkMuted }}>{t(locale, 'ai.thinking')}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.row,
                  item.role === 'user' ? styles.rowUser : styles.rowAssistant,
                ]}
              >
                {item.role === 'assistant' ? (
                  <PennyAvatar
                    pose={busy && item.id === messages[messages.length - 1]?.id ? 'think' : 'idle'}
                    size="sm"
                  />
                ) : null}
                <View
                  style={[
                    styles.bubble,
                    item.role === 'user'
                      ? { backgroundColor: colors.brand }
                      : { backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={{
                      color: item.role === 'user' ? '#fff' : colors.ink,
                      fontSize: 15,
                      lineHeight: 22,
                    }}
                  >
                    {item.content}
                  </Text>
                </View>
              </View>
            )}
          />
        )}

        {showStarters ? (
          <View style={styles.chips}>
            {STARTERS.map((label) => (
              <Pressable
                key={label}
                disabled={busy}
                onPress={() => void send(label)}
                style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {categoryChips.length ? (
          <View style={styles.chips}>
            {categoryChips.map((chip) => (
              <Pressable
                key={chip.value}
                disabled={busy}
                onPress={() => void send(chip.value)}
                style={[styles.chip, { borderColor: colors.brand, backgroundColor: colors.brandTint }]}
              >
                <Text style={{ color: colors.brand, fontSize: 12, fontWeight: '700' }}>{chip.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {error ? <Text style={[styles.error, { color: colors.expense }]}>{error}</Text> : null}

        <View
          style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t(locale, 'ai.placeholder')}
            placeholderTextColor={colors.inkMuted}
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.ink, backgroundColor: colors.canvas },
            ]}
            editable={!busy && !guest}
            onSubmitEditing={() => void send()}
          />
          <Pressable
            style={[
              styles.send,
              { backgroundColor: colors.brand, opacity: busy || !input.trim() || guest ? 0.5 : 1 },
            ]}
            disabled={busy || !input.trim() || guest}
            onPress={() => void send()}
            accessibilityLabel={t(locale, 'ai.send')}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[3],
    paddingBottom: space[3],
    borderBottomWidth: 1,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  headerSub: { fontSize: 12, marginTop: 2 },
  credits: { fontSize: 11, marginTop: 2 },
  gate: {
    margin: space[4],
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[4],
    gap: space[3],
  },
  signIn: {
    minHeight: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[2] },
  list: { padding: space[4], gap: space[3], paddingBottom: space[6] },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space[2] },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.card,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingBottom: space[2],
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: space[3],
    paddingVertical: 8,
  },
  error: { paddingHorizontal: space[4], marginBottom: space[2] },
  composer: {
    flexDirection: 'row',
    gap: space[2],
    padding: space[4],
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: space[3],
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
