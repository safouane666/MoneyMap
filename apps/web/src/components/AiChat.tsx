'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Car,
  CircleDot,
  Coffee,
  Gift,
  Heart,
  Home,
  Laptop,
  Loader2,
  Mic,
  PartyPopper,
  Repeat,
  Send,
  ShoppingBag,
  Sparkles,
  Tag,
  Utensils,
} from 'lucide-react';
import {
  currencyDecimalPlaces,
  matchDefaultCategoryHint,
  monthlyTargetMinor,
  parseDisplayAmount,
  stripCategoryEmoji,
  type CurrencyCode,
  type LedgerTransaction,
} from '@clear-money/domain';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { VoicePanel } from '@/components/VoicePanel';
import { useToast } from '@/components/Toast';
import { PennyAvatar } from '@/components/penny/PennyAvatar';
import { PlanGate } from '@/components/PlanGate';
import { useI18n } from '@/lib/i18n';
import { usePennyNotify } from '@/lib/usePennyNotify';
import { useLedger } from '@/lib/ledger';
import { apiFetch } from '@/lib/api';
import {
  getActiveSpace,
  getSpaceTotals,
  getVisibleSpaceTransactions,
  type DemoCategory,
} from '@/lib/demo-state';
import { iconForCategory } from '@/lib/ai/tools';
import {
  applyDeterministicLedgerFallback,
  claimsLedgerSaved,
  looksLikeLedgerIntent,
  parseCreateCategory,
  parseMoneyUtterance,
  type MoneyDraft,
} from '@/lib/ai/ledger-intent';
import type {
  AiAction,
  AiChatMessage,
  AiChatResponse,
  AiLedgerContext,
  AiSuggestion,
} from '@/lib/ai/types';
import { useVoiceInput } from '@/lib/voice/useVoiceInput';
import { cn } from '@/lib/utils';

const HISTORY_PAGE_SIZE = 10;

type PennyTurnRow = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  status?: string;
};

function majorToMinorSafe(amountMajor: number, currency: string): number | null {
  if (!Number.isFinite(amountMajor) || amountMajor === 0) return null;
  try {
    const decimals = currencyDecimalPlaces(currency as CurrencyCode);
    const display = Math.abs(amountMajor).toFixed(decimals);
    const minor = Math.abs(parseDisplayAmount(display, currency as CurrencyCode));
    return minor > 0 ? minor : null;
  } catch {
    return null;
  }
}

/** Short replies while a spend draft is open — treat as category picks, not new AI turns. */
function looksLikeCategoryOnly(text: string): boolean {
  const value = text.trim();
  if (!value || value.length > 48) return false;
  if (/\d/.test(value)) return false;
  if (
    /\b(spent|spend|paid|pay|received|receive|earned|create|delete|rename|goal|invite|note)\b/i.test(
      value,
    )
  ) {
    return false;
  }
  return true;
}

const STARTER_PROMPTS = [
  'I spent 12.50 on coffee',
  'I also spent 50 TND on clothes',
  'Change the last note to buying clothes',
] as const;

const ICON_MAP = {
  utensils: Utensils,
  coffee: Coffee,
  car: Car,
  home: Home,
  'shopping-bag': ShoppingBag,
  'party-popper': PartyPopper,
  heart: Heart,
  'circle-dot': CircleDot,
  briefcase: Briefcase,
  laptop: Laptop,
  gift: Gift,
  sparkles: Sparkles,
  repeat: Repeat,
  tag: Tag,
} as const;

type IconKey = keyof typeof ICON_MAP;

interface UiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  report?: { title: string; body: string };
  suggestions?: AiSuggestion[];
}

function turnsToMessages(turns: PennyTurnRow[]): UiMessage[] {
  return turns
    .filter((t) => t.role === 'user' || t.role === 'assistant')
    .map((t) => ({
      id: t.id,
      role: t.role as 'user' | 'assistant',
      content: t.content,
    }));
}

interface PendingEntry {
  entryType: 'income' | 'expense';
  amountMajor: number;
  occurredAt?: string;
  note?: string;
}

function SuggestionIcon({ name }: { name: string }) {
  const key = (name as IconKey) in ICON_MAP ? (name as IconKey) : 'tag';
  const Comp = ICON_MAP[key];
  return <Comp className="h-3.5 w-3.5 shrink-0" />;
}

function ChipRow({
  items,
  disabled,
  onPick,
  emphasize,
}: {
  items: AiSuggestion[];
  disabled?: boolean;
  onPick: (item: AiSuggestion) => void;
  emphasize?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => (
        <button
          key={s.value}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
            emphasize
              ? 'border-brand/30 bg-brand-tint text-brand hover:bg-brand/15'
              : 'border-border bg-surface text-ink hover:border-brand/40 hover:bg-brand-tint',
          )}
        >
          <SuggestionIcon name={s.icon || iconForCategory(s.value)} />
          {s.label}
        </button>
      ))}
    </div>
  );
}

async function applyImmediateActions(
  actions: AiAction[],
  helpers: {
    currency: string;
    spaceId: string;
    categories: DemoCategory[];
    defaultSource?: LedgerTransaction['source'];
    addCategory: (input: {
      name: string;
      type: 'income' | 'expense';
    }) => Promise<DemoCategory>;
    renameCategory: (id: string, name: string) => void;
    deleteCategory: (id: string) => void;
    addTransaction: (input: {
      spaceId: string;
      type: 'income' | 'expense';
      amountMinor: number;
      currency: string;
      categoryId: string | null;
      description: string | null;
      occurredAt: string;
      source?: LedgerTransaction['source'];
    }) => LedgerTransaction;
    updateTransaction: (
      id: string,
      patch: {
        description?: string | null;
        categoryId?: string | null;
        amountMinor?: number;
        occurredAt?: string;
      },
    ) => void;
    undoTransaction: (id: string) => void;
    hideTransaction: (id: string) => void;
    createGoal: (input: {
      name: string;
      targetMinor: number;
      currency: string;
      durationMonths: number;
      startDate?: string;
      plannedContributionMinor?: number;
    }) => Promise<unknown>;
    updateGoal: (
      id: string,
      patch: { name?: string; savedMinor?: number; status?: string },
    ) => Promise<unknown>;
    deleteGoal: (id: string) => Promise<void>;
    createRecurring: (input: {
      name: string;
      amountMinor: number;
      kind: 'income' | 'expense';
      dayOfMonth: number;
    }) => Promise<unknown>;
    updateRecurring: (
      id: string,
      patch: {
        name?: string;
        amountMinor?: number;
        kind?: 'income' | 'expense';
        dayOfMonth?: number;
        active?: boolean;
      },
    ) => Promise<void>;
    deleteRecurring: (id: string) => Promise<void>;
    createSpace: (input: {
      name: string;
      type?: string;
      currency?: string;
    }) => Promise<unknown>;
    setSpace: (spaceId: string) => void;
    inviteMember: (email: string, role: string) => Promise<void>;
  },
) {
  const reports: Array<{ title: string; body: string }> = [];
  let categories = [...helpers.categories];
  let applied = 0;
  let pending: PendingEntry | null = null;
  let categorySuggestions: AiSuggestion[] = [];
  let lastCreatedId: string | null = null;
  let updated = 0;
  let goalsCreated = 0;
  let lastGoalName: string | null = null;

  const resolveId = (
    name: string | undefined,
    type: 'income' | 'expense',
    opts?: { mapDefaults?: boolean },
  ) => {
    if (!name) return null;
    const mapped =
      opts?.mapDefaults === false
        ? stripCategoryEmoji(name)
        : matchDefaultCategoryHint(name, type) ?? stripCategoryEmoji(name);
    const needle = (mapped || name).toLowerCase();
    return (
      categories.find((c) => {
        if (c.type !== type) return false;
        const cleaned = stripCategoryEmoji(c.name).toLowerCase();
        return (
          c.name.toLowerCase() === needle ||
          cleaned === needle ||
          cleaned === name.toLowerCase()
        );
      })?.id ?? null
    );
  };

  for (const action of actions) {
    if (action.type === 'ask_category') {
      pending = {
        entryType: action.entryType,
        amountMajor: action.amountMajor,
        occurredAt: action.occurredAt,
        note: action.note,
      };
      categorySuggestions = action.suggestions;
      continue;
    }
    if (action.type === 'create_category') {
      if (!resolveId(action.name, action.categoryType, { mapDefaults: false })) {
        const created = await helpers.addCategory({
          name: action.name,
          type: action.categoryType,
        });
        categories = [...categories, created];
        applied += 1;
      }
    } else if (action.type === 'rename_category') {
      let id = action.categoryId;
      if (!id && action.fromName) {
        const type = action.categoryType;
        const match = categories.find(
          (c) =>
            c.name.toLowerCase() === action.fromName!.toLowerCase() &&
            (!type || c.type === type),
        );
        id = match?.id;
      }
      if (id) {
        helpers.renameCategory(id, action.toName);
        categories = categories.map((c) =>
          c.id === id ? { ...c, name: action.toName.trim() } : c,
        );
        applied += 1;
      }
    } else if (action.type === 'delete_category') {
      let id = action.categoryId;
      if (!id && action.name) {
        const type = action.categoryType;
        const match = categories.find(
          (c) =>
            c.name.toLowerCase() === action.name!.toLowerCase() &&
            (!type || c.type === type),
        );
        id = match?.id;
      }
      if (id) {
        helpers.deleteCategory(id);
        categories = categories.filter((c) => c.id !== id);
        applied += 1;
      }
    } else if (action.type === 'update_transaction') {
      let categoryId: string | null | undefined;
      if (action.category) {
        let type: 'income' | 'expense' = 'expense';
        const existing = categories.find(
          (c) =>
            stripCategoryEmoji(c.name).toLowerCase() ===
              stripCategoryEmoji(action.category!).toLowerCase() ||
            c.name.toLowerCase() === action.category!.toLowerCase(),
        );
        if (existing) type = existing.type;
        const mapped =
          matchDefaultCategoryHint(action.category, type) ??
          stripCategoryEmoji(action.category) ??
          action.category;
        let id = resolveId(mapped, type) ?? resolveId(action.category, type);
        if (!id) {
          const created = await helpers.addCategory({ name: mapped, type });
          categories = [...categories, created];
          id = created.id;
        }
        categoryId = id;
      }
      const amountMinor =
        action.amountMajor != null
          ? majorToMinorSafe(action.amountMajor, helpers.currency)
          : undefined;
      helpers.updateTransaction(action.transactionId, {
        description: action.note !== undefined ? action.note : undefined,
        categoryId,
        amountMinor: amountMinor ?? undefined,
        occurredAt: action.occurredAt
          ? new Date(action.occurredAt).toISOString()
          : undefined,
      });
      updated += 1;
      applied += 1;
    } else if (action.type === 'delete_transaction') {
      helpers.undoTransaction(action.transactionId);
      applied += 1;
    } else if (action.type === 'hide_transaction') {
      helpers.hideTransaction(action.transactionId);
      applied += 1;
    } else if (action.type === 'add_transaction') {
      const amountMinor = majorToMinorSafe(action.amountMajor, helpers.currency);
      if (amountMinor == null) continue;
      if (!action.category) {
        pending = {
          entryType: action.entryType,
          amountMajor: action.amountMajor,
          occurredAt: action.occurredAt,
          note: action.note,
        };
        continue;
      }
      const mapped =
        matchDefaultCategoryHint(action.category, action.entryType) ??
        stripCategoryEmoji(action.category) ??
        action.category;
      let categoryId =
        resolveId(mapped, action.entryType) ?? resolveId(action.category, action.entryType);
      if (!categoryId) {
        const created = await helpers.addCategory({
          name: mapped,
          type: action.entryType,
        });
        categories = [...categories, created];
        categoryId = created.id;
      }
      const txn = helpers.addTransaction({
        spaceId: helpers.spaceId,
        type: action.entryType,
        amountMinor,
        currency: helpers.currency,
        categoryId,
        description: action.note?.trim() || null,
        occurredAt: action.occurredAt
          ? new Date(action.occurredAt).toISOString()
          : new Date().toISOString(),
        source: helpers.defaultSource ?? 'manual',
      });
      lastCreatedId = txn.id;
      applied += 1;
    } else if (action.type === 'create_goal') {
      const targetMinor = majorToMinorSafe(action.targetMajor, helpers.currency);
      if (targetMinor == null) continue;
      const durationMonths =
        Number.isFinite(action.durationMonths) && action.durationMonths >= 1
          ? Math.floor(action.durationMonths)
          : 1;
      const plannedContributionMinor = monthlyTargetMinor({
        targetMinor,
        durationMonths,
        plannedContributionMinor: 0,
      });
      try {
        await helpers.createGoal({
          name: action.name.trim(),
          targetMinor,
          currency: helpers.currency,
          durationMonths,
          startDate: action.startDate,
          plannedContributionMinor,
        });
        goalsCreated += 1;
        lastGoalName = action.name.trim();
        applied += 1;
      } catch {
        // offline / cap — leave reply to explain
      }
    } else if (action.type === 'update_goal') {
      try {
        const savedMinor =
          action.savedMajor != null
            ? majorToMinorSafe(action.savedMajor, helpers.currency)
            : undefined;
        await helpers.updateGoal(action.goalId, {
          name: action.name,
          savedMinor: savedMinor ?? undefined,
          status: action.status,
        });
        applied += 1;
      } catch {
        /* ignore */
      }
    } else if (action.type === 'delete_goal') {
      try {
        await helpers.deleteGoal(action.goalId);
        applied += 1;
      } catch {
        /* ignore */
      }
    } else if (action.type === 'create_recurring') {
      const amountMinor = majorToMinorSafe(action.amountMajor, helpers.currency);
      if (amountMinor == null) continue;
      try {
        await helpers.createRecurring({
          name: action.name.trim(),
          amountMinor,
          kind: action.kind,
          dayOfMonth: action.dayOfMonth,
        });
        applied += 1;
      } catch {
        /* ignore */
      }
    } else if (action.type === 'update_recurring') {
      try {
        const amountMinor =
          action.amountMajor != null
            ? majorToMinorSafe(action.amountMajor, helpers.currency)
            : undefined;
        await helpers.updateRecurring(action.recurringId, {
          name: action.name,
          amountMinor: amountMinor ?? undefined,
          kind: action.kind,
          dayOfMonth: action.dayOfMonth,
          active: action.active,
        });
        applied += 1;
      } catch {
        /* ignore */
      }
    } else if (action.type === 'delete_recurring') {
      try {
        await helpers.deleteRecurring(action.recurringId);
        applied += 1;
      } catch {
        /* ignore */
      }
    } else if (action.type === 'create_space') {
      try {
        await helpers.createSpace({
          name: action.name.trim(),
          type: action.spaceType,
          currency: action.currency,
        });
        applied += 1;
      } catch {
        /* ignore */
      }
    } else if (action.type === 'switch_space') {
      if (action.spaceId) {
        helpers.setSpace(action.spaceId);
        applied += 1;
      }
    } else if (action.type === 'invite_member') {
      try {
        await helpers.inviteMember(action.email, action.role);
        applied += 1;
      } catch {
        /* ignore */
      }
    } else if (action.type === 'report') {
      reports.push({ title: action.title, body: action.body });
    }
  }

  return {
    applied,
    reports,
    pending,
    categorySuggestions,
    lastCreatedId,
    updated,
    goalsCreated,
    lastGoalName,
  };
}

export function AiChat({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, locale } = useI18n();
  const {
    state,
    addCategory,
    addTransaction,
    updateTransaction,
    undoTransaction,
    hideTransaction,
    createGoal,
    updateGoal,
    deleteGoal,
    createRecurring,
    updateRecurring,
    deleteRecurring,
    createSpace,
    setSpace,
    renameCategory,
    deleteCategory,
    signedIn,
  } = useLedger();
  const { showToast } = useToast();
  const { notifyEntry } = usePennyNotify();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingEntry | null>(null);
  const [awaitingNoteId, setAwaitingNoteId] = useState<string | null>(null);
  const [chips, setChips] = useState<AiSuggestion[]>([]);
  const [creditsLeft, setCreditsLeft] = useState<number | null>(null);
  const [gateError, setGateError] = useState<'auth' | 'credits' | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([
    { id: 'welcome', role: 'assistant', content: t('ai.welcome') },
  ]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [oldestCreatedAt, setOldestCreatedAt] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const messagesRef = useRef(messages);
  const historyLoadedRef = useRef(false);
  const loadingOlderRef = useRef(false);
  /** Unfinished spend when the model asked for category in prose (no ask_category action). */
  const spendDraftRef = useRef<MoneyDraft | null>(null);
  const chatSessionIdRef = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `psess_${Date.now()}`,
  );
  messagesRef.current = messages;
  busyRef.current = busy;

  const voiceLang = locale === 'ar' ? 'ar-SA' : locale === 'fr' ? 'fr-FR' : 'en-US';
  const voice = useVoiceInput({ lang: voiceLang });

  const skipChip: AiSuggestion = {
    label: t('ai.skipNote'),
    value: '__skip_note__',
    icon: 'circle-dot',
  };

  const space = getActiveSpace(state);

  const context: AiLedgerContext = useMemo(() => {
    const totals = getSpaceTotals(state, space.id);
    const recent = getVisibleSpaceTransactions(state, space.id)
      .filter((txn) => txn.type !== 'transfer')
      .slice(0, 12)
      .map((txn) => ({
        id: txn.id,
        type: txn.type,
        amountMinor: txn.amountMinor,
        description: txn.description,
        category: state.categories.find((c) => c.id === txn.categoryId)?.name ?? null,
        occurredAt: txn.occurredAt,
      }));

    return {
      currency: space.currency,
      spaceName: space.name,
      spaceId: space.id,
      categories: state.categories
        .filter((c) => c.spaceId == null || c.spaceId === space.id)
        .map((c) => ({ id: c.id, name: c.name, type: c.type })),
      totals: {
        incomeMinor: totals.incomeMinor,
        expenseMinor: totals.expenseMinor,
        netMinor: totals.netMinor,
      },
      recent,
      goals: (state.goals ?? [])
        .filter((g) => g.spaceId === space.id && g.status !== 'cancelled')
        .slice(0, 12)
        .map((g) => ({
          id: g.id,
          name: g.name,
          targetMinor: g.targetMinor,
          savedMinor: g.savedMinor ?? 0,
          durationMonths: g.durationMonths,
          status: g.status,
          paceStatus: g.paceStatus ?? null,
        })),
      recurring: (state.recurring ?? [])
        .filter((r) => r.spaceId === space.id)
        .slice(0, 12)
        .map((r) => ({
          id: r.id,
          name: r.name,
          amountMinor: r.amountMinor,
          kind: r.kind,
          dayOfMonth: r.dayOfMonth,
          active: r.active,
        })),
      spaces: state.spaces.map((s) => ({
        id: s.id,
        name: s.name,
        currency: s.currency,
      })),
    };
  }, [space.currency, space.id, space.name, state]);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const loadHistoryPage = async (before?: string | null) => {
    const qs = new URLSearchParams({ limit: String(HISTORY_PAGE_SIZE) });
    if (before) qs.set('before', before);
    const result = await apiFetch<{
      turns: PennyTurnRow[];
      hasMore?: boolean;
      nextBefore?: string | null;
    }>(`/ai/penny/turns?${qs.toString()}`);
    if (result.offline || !result.data) {
      return { turns: [] as PennyTurnRow[], hasMore: false, nextBefore: null as string | null };
    }
    return {
      turns: result.data.turns ?? [],
      hasMore: Boolean(result.data.hasMore ?? (result.data.turns?.length ?? 0) >= HISTORY_PAGE_SIZE),
      nextBefore: result.data.nextBefore ?? result.data.turns?.at(-1)?.createdAt ?? null,
    };
  };

  useEffect(() => {
    if (!open || !signedIn || historyLoadedRef.current) return;
    historyLoadedRef.current = true;
    let cancelled = false;
    setHistoryLoading(true);
    void (async () => {
      try {
        const page = await loadHistoryPage();
        if (cancelled) return;
        if (page.turns.length === 0) {
          setHasMoreHistory(false);
          setOldestCreatedAt(null);
          return;
        }
        // API returns newest-first; chat UI is oldest → newest.
        const chronological = [...page.turns].reverse();
        setMessages(turnsToMessages(chronological));
        setHasMoreHistory(page.hasMore);
        setOldestCreatedAt(page.nextBefore ?? page.turns[page.turns.length - 1]?.createdAt ?? null);
        requestAnimationFrame(() => {
          listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
        });
      } catch {
        /* keep welcome */
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per mount when sheet opens signed-in
  }, [open, signedIn]);

  const loadOlderHistory = async () => {
    if (!hasMoreHistory || loadingOlderRef.current || !oldestCreatedAt) return;
    const el = listRef.current;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    try {
      const page = await loadHistoryPage(oldestCreatedAt);
      if (page.turns.length === 0) {
        setHasMoreHistory(false);
        return;
      }
      const chronological = [...page.turns].reverse();
      const older = turnsToMessages(chronological);
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const fresh = older.filter((m) => !seen.has(m.id));
        return [...fresh, ...prev.filter((m) => m.id !== 'welcome')];
      });
      setHasMoreHistory(page.hasMore);
      setOldestCreatedAt(page.turns[page.turns.length - 1]?.createdAt ?? null);
      requestAnimationFrame(() => {
        if (!el) return;
        el.scrollTop = prevTop + (el.scrollHeight - prevHeight);
      });
    } catch {
      /* ignore */
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  };

  const onMessagesScroll = () => {
    const el = listRef.current;
    if (!el || loadingOlderRef.current || !hasMoreHistory) return;
    if (el.scrollTop <= 48) {
      void loadOlderHistory();
    }
  };

  useEffect(() => {
    if (!open && voice.phase !== 'idle') voice.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when sheet closes
  }, [open]);

  const voiceErrorLabel = (() => {
    switch (voice.error) {
      case 'unsupported':
      case 'start':
        return t('ai.voiceUnsupported');
      case 'permission':
        return t('ai.voicePermission');
      case 'empty':
        return t('ai.speakNow');
      case 'restart':
        return t('ai.voiceRestart');
      default:
        return null;
    }
  })();

  const NOTES_PREF_KEY = 'cm.penny.askNotes';

  const shouldAskNotes = () => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(NOTES_PREF_KEY) === 'true';
    } catch {
      return false;
    }
  };

  const setAskNotesPref = (ask: boolean) => {
    try {
      localStorage.setItem(NOTES_PREF_KEY, ask ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  };

  const isNoteDecline = (text: string) => {
    const t = text.trim().toLowerCase();
    if (!t) return false;
    if (/^(__skip_note__|skip|no|nope|nah|non|لا)$/i.test(t)) return true;
    return (
      /\b(don'?t|do not|never|stop|no more)\b.{0,40}\bnote/i.test(t) ||
      /\b(no note|without a note|skip( the)? note)\b/i.test(t) ||
      /\bif i (do )?not ask\b.{0,40}\bnote/i.test(t)
    );
  };

  const promptForNote = (txnId: string, preface?: string) => {
    // Notes are opt-in — never interrupt after a save unless the user enabled it.
    if (!shouldAskNotes()) {
      setAwaitingNoteId(null);
      setChips([]);
      if (preface) {
        setMessages((prev) => [
          ...prev,
          { id: `a_saved_${Date.now()}`, role: 'assistant', content: preface },
        ]);
        scrollToEnd();
      }
      return;
    }
    setAwaitingNoteId(txnId);
    setChips([skipChip]);
    setMessages((prev) => [
      ...prev,
      {
        id: `a_note_${Date.now()}`,
        role: 'assistant',
        content: preface ? `${preface}\n\n${t('ai.askNote')}` : t('ai.askNote'),
        suggestions: [skipChip],
      },
    ]);
    scrollToEnd();
  };

  const savePendingWithCategory = async (categoryName: string) => {
    if (!pending) return;

    let resolvedName = categoryName.trim();
    const createMatch =
      resolvedName.match(
        /\b(?:create|add|make)\s+(?:an?\s+)?(?:new\s+)?(?:expense\s+|income\s+)?categor(?:y|ies)\s+(?:called\s+|named\s+|for\s+)?["']?([^"'?.!,]+)["']?/i,
      ) ||
      resolvedName.match(
        /\b(?:create|add|make)\s+(?:an?\s+)?["']?([^"'?.!,]+?)["']?\s+categor(?:y|ies)\b/i,
      );
    if (createMatch?.[1]) {
      resolvedName = createMatch[1].trim().replace(/^(a|an|the)\s+/i, '');
    }
    const mapped =
      matchDefaultCategoryHint(resolvedName, pending.entryType) ??
      stripCategoryEmoji(resolvedName) ??
      resolvedName;
    resolvedName = mapped
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => (w === '&' ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ');
    // Keep known default casing
    const known = matchDefaultCategoryHint(resolvedName, pending.entryType);
    if (known) resolvedName = known;
    if (!resolvedName) return;

    const amountMinor = majorToMinorSafe(pending.amountMajor, space.currency);
    if (amountMinor == null) return;

    let category =
      state.categories.find((c) => {
        if (c.type !== pending.entryType) return false;
        if (c.spaceId != null && c.spaceId !== space.id) return false;
        const cleaned = stripCategoryEmoji(c.name).toLowerCase();
        return (
          cleaned === resolvedName.toLowerCase() ||
          c.name.toLowerCase() === resolvedName.toLowerCase() ||
          cleaned === categoryName.trim().toLowerCase()
        );
      }) ?? null;
    if (!category) {
      try {
        category = await addCategory({ name: resolvedName, type: pending.entryType });
      } catch {
        showToast({ message: t('ai.error') });
        return;
      }
    }

    const created = addTransaction({
      spaceId: space.id,
      type: pending.entryType,
      amountMinor,
      currency: space.currency,
      categoryId: category.id,
      description: pending.note?.trim() || null,
      occurredAt: pending.occurredAt
        ? new Date(pending.occurredAt).toISOString()
        : new Date().toISOString(),
    });

    if (!created?.id) {
      showToast({ message: t('ai.error') });
      return;
    }

    const savedPending = pending;
    setPending(null);
    spendDraftRef.current = null;
    setMessages((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: 'user', content: categoryName },
      {
        id: `a_${Date.now() + 1}`,
        role: 'assistant',
        content: t('ai.savedQuip'),
      },
    ]);
    notifyEntry({
      type: savedPending.entryType,
      amountMinor,
      currency: space.currency,
      spaceId: space.id,
      fallbackMessage: t('ai.applied'),
    });
    // Do not auto-ask for a note — only if user opted in.
    if (shouldAskNotes()) {
      promptForNote(created.id);
    }
    scrollToEnd();
  };

  const finishNote = (note: string | null) => {
    if (!awaitingNoteId) return;
    if (note?.trim()) {
      updateTransaction(awaitingNoteId, { description: note.trim() });
      showToast({ message: t('ai.noteSaved') });
    }
    setAwaitingNoteId(null);
    setChips([]);
  };

  const sendToAi = async (
    text: string,
    opts?: { force?: boolean; source?: 'text' | 'voice' },
  ) => {
    const content = text.trim();
    if (!content) return;
    if (busyRef.current && !opts?.force) return;
    const source = opts?.source === 'voice' ? 'voice' : 'text';

    if (!signedIn) {
      setGateError('auth');
      return;
    }

    // Voice always starts a fresh assistant turn (don't treat spoken sentences as category picks)
    if (awaitingNoteId && !opts?.force) {
      setMessages((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', content }]);
      if (isNoteDecline(content)) {
        setAskNotesPref(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now() + 1}`,
            role: 'assistant',
            content: t('ai.noteSkipped'),
          },
        ]);
        finishNote(null);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: `a_${Date.now() + 1}`, role: 'assistant', content: t('ai.noteThanks') },
        ]);
        finishNote(content);
      }
      setInput('');
      scrollToEnd();
      return;
    }

    // Preference update even when not awaiting a note
    if (isNoteDecline(content) && /\bnote/i.test(content) && !pending) {
      setAskNotesPref(false);
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', content },
        {
          id: `a_${Date.now() + 1}`,
          role: 'assistant',
          content: "Got it — I won't ask for notes unless you want one.",
        },
      ]);
      setInput('');
      scrollToEnd();
      return;
    }

    if (pending && !opts?.force) {
      void savePendingWithCategory(content);
      setInput('');
      return;
    }

    // Model asked for category in free text → we still hold a draft. Complete it locally.
    if (spendDraftRef.current && !opts?.force) {
      const draft = spendDraftRef.current;
      const createdCat = parseCreateCategory(content);
      const rawName = createdCat?.name ?? (looksLikeCategoryOnly(content) ? content.trim() : null);
      const categoryName =
        (rawName && matchDefaultCategoryHint(rawName, draft.entryType)) ||
        (rawName ? stripCategoryEmoji(rawName) : null);
      if (categoryName) {
        const amountMinor = majorToMinorSafe(draft.amount, space.currency);
        if (amountMinor != null) {
          let category =
            state.categories.find((c) => {
              if (c.type !== draft.entryType) return false;
              const cleaned = stripCategoryEmoji(c.name).toLowerCase();
              return (
                cleaned === categoryName.toLowerCase() ||
                c.name.toLowerCase() === categoryName.toLowerCase()
              );
            }) ?? null;
          if (!category) {
            try {
              category = await addCategory({ name: categoryName, type: draft.entryType });
            } catch {
              /* fall through to AI */
            }
          }
          if (category) {
            const created = addTransaction({
              spaceId: space.id,
              type: draft.entryType,
              amountMinor,
              currency: space.currency,
              categoryId: category.id,
              description: draft.note?.trim() || null,
              occurredAt: new Date().toISOString(),
            });
            spendDraftRef.current = null;
            setPending(null);
            setMessages((prev) => [
              ...prev,
              { id: `u_${Date.now()}`, role: 'user', content },
              {
                id: `a_${Date.now() + 1}`,
                role: 'assistant',
                content: t('ai.savedQuip'),
              },
            ]);
            if (created?.id) {
              notifyEntry({
                type: draft.entryType,
                amountMinor,
                currency: space.currency,
                spaceId: space.id,
                fallbackMessage: t('ai.applied'),
              });
              if (shouldAskNotes()) promptForNote(created.id);
              setInput('');
              scrollToEnd();
              return;
            }
          }
        }
      }
    }

    if (opts?.force && (pending || awaitingNoteId)) {
      setPending(null);
      setAwaitingNoteId(null);
      setChips([]);
    }

    const userMsg: UiMessage = { id: `u_${Date.now()}`, role: 'user', content };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setChips([]);
    setBusy(true);
    busyRef.current = true;
    setGateError(null);
    scrollToEnd();

    try {
      const history: AiChatMessage[] = [...messagesRef.current.filter((m) => m.id !== 'welcome'), userMsg].map(
        (m) => ({ role: m.role, content: m.content }),
      );

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          context,
          source,
          sessionId: chatSessionIdRef.current,
          locale,
        }),
      });
      const data = (await res.json()) as AiChatResponse & {
        error?: string;
        code?: string;
        usage?: { remaining?: number | null };
      };
      if (res.status === 401) {
        setGateError('auth');
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        throw new Error(data.error || t('ai.needLogin'));
      }
      if (res.status === 402) {
        setGateError('credits');
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
        throw new Error(data.error || t('ai.outOfCredits'));
      }
      if (!res.ok) throw new Error(t('ai.error'));
      if (typeof data.usage?.remaining === 'number') setCreditsLeft(data.usage.remaining);

      // Capture spend draft early so later "create category" / "yes" turns can finish the write.
      const parsedSpend = parseMoneyUtterance(content);
      if (parsedSpend) {
        spendDraftRef.current = parsedSpend;
      }

      // Client safety net: if the model claimed a save but returned no money actions, synthesize them.
      const actions: AiAction[] = [...(data.actions ?? [])];
      const hasMoney = actions.some((a) => a.type === 'ask_category' || a.type === 'add_transaction');
      if ((looksLikeLedgerIntent(content) || Boolean(spendDraftRef.current)) && !hasMoney) {
        await applyDeterministicLedgerFallback(
          content,
          context,
          actions,
          spendDraftRef.current,
        );
      }

      const result = await applyImmediateActions(actions, {
        currency: space.currency,
        spaceId: space.id,
        categories: state.categories,
        defaultSource: source === 'voice' ? 'voice' : 'manual',
        addCategory,
        renameCategory,
        deleteCategory,
        addTransaction,
        updateTransaction,
        undoTransaction,
        hideTransaction,
        createGoal,
        updateGoal,
        deleteGoal,
        createRecurring,
        updateRecurring,
        deleteRecurring,
        createSpace,
        setSpace,
        inviteMember: async (_email, role) => {
          const res = await apiFetch(`/spaces/${space.id}/members/invite`, {
            method: 'POST',
            body: JSON.stringify({ openLink: true, role }),
          });
          if (res.offline || !res.data) {
            throw new Error('Could not create invite link');
          }
        },
      });

      const suggestions = data.suggestions ?? result.categorySuggestions;
      let replyText = data.reply || t('ai.done');
      const savedForReal = Boolean(result.lastCreatedId);
      if (result.pending) {
        spendDraftRef.current = {
          entryType: result.pending.entryType,
          amount: result.pending.amountMajor,
          note: result.pending.note,
          categoryHint: spendDraftRef.current?.categoryHint,
        };
        if (claimsLedgerSaved(replyText)) {
          replyText =
            result.pending.entryType === 'expense'
              ? `Got it — ${result.pending.amountMajor} ${space.currency} out the door. Where should we park this one?`
              : `Nice — ${result.pending.amountMajor} ${space.currency} coming in. What kind of income is this?`;
        }
      } else if (savedForReal) {
        spendDraftRef.current = null;
      } else if (claimsLedgerSaved(replyText)) {
        // Model lied — do not show a fake success.
        replyText = spendDraftRef.current
          ? `I haven't written this to your ledger yet. Amount ${spendDraftRef.current.amount} ${space.currency}${spendDraftRef.current.note ? ` · ${spendDraftRef.current.note}` : ''}. Pick or create a category and I'll save it for real.`
          : `I haven't written anything to your ledger yet. Try again with an amount and category (e.g. "I spent 12.50 on coffee").`;
      }

      if (result.pending) {
        setPending(result.pending);
        setChips(suggestions);
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            content: replyText,
            report: result.reports[0],
            suggestions,
          },
        ]);
      } else {
        if (savedForReal) setPending(null);
        setChips([]);
        setMessages((prev) => [
          ...prev,
          {
            id: `a_${Date.now()}`,
            role: 'assistant',
            content: replyText,
            report: result.reports[0],
          },
        ]);
        if (result.goalsCreated > 0) {
          showToast({
            message: result.lastGoalName
              ? `Goal “${result.lastGoalName}” created`
              : t('ai.applied'),
          });
        } else if (savedForReal) {
          showToast({
            message: result.updated > 0 ? t('ai.updated') : t('ai.applied'),
          });
        } else if (actions.some((a) => a.type === 'add_transaction')) {
          showToast({ message: t('ai.error') });
        }
        if (
          result.lastCreatedId &&
          shouldAskNotes() &&
          !actions.some((a) => a.type === 'add_transaction' && a.note)
        ) {
          promptForNote(result.lastCreatedId);
        }
      }
      scrollToEnd();
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          // Prefer i18n copy — avoid surfacing raw AI provider/host error strings.
          content: t('ai.error'),
        },
      ]);
      throw error;
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  };

  const sendVoice = async (text: string) => {
    const content = text.trim();
    if (!content) {
      showToast({ message: t('ai.speakNow') });
      return;
    }

    voice.beginSending();
    const started = Date.now();
    try {
      await sendToAi(content, { force: true, source: 'voice' });
    } catch {
      /* surfaced in chat */
    } finally {
      const elapsed = Date.now() - started;
      // Keep the sending panel visible long enough to be obvious on mobile
      if (elapsed < 700) {
        await new Promise((r) => setTimeout(r, 700 - elapsed));
      }
      voice.endSending();
    }
  };

  const onChip = (suggestion: AiSuggestion) => {
    if (busy || voice.phase !== 'idle') return;
    if (suggestion.value === '__skip_note__') {
      setAskNotesPref(false);
      setMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', content: t('ai.skipNote') },
        { id: `a_${Date.now() + 1}`, role: 'assistant', content: t('ai.noteSkipped') },
      ]);
      finishNote(null);
      scrollToEnd();
      return;
    }
    if (pending) {
      void savePendingWithCategory(suggestion.value);
      return;
    }
    void sendToAi(suggestion.value);
  };

  const startMic = () => {
    if (!voice.supported) {
      showToast({ message: t('ai.voiceUnsupported') });
      return;
    }
    const ok = voice.startListening();
    if (!ok && voice.error === 'permission') {
      showToast({ message: t('ai.voicePermission') });
    }
  };

  const starterChips: AiSuggestion[] = STARTER_PROMPTS.map((label) => ({
    label,
    value: label,
    icon: 'sparkles',
  }));

  const voiceActive = voice.phase !== 'idle';
  const showStarters =
    !pending && !awaitingNoteId && !voiceActive && messages.length <= 2 && chips.length === 0;
  const last = messages[messages.length - 1];
  const inlineSuggestions = last?.role === 'assistant' ? last.suggestions : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[92dvh] max-h-[92dvh] flex-col overflow-hidden md:inset-y-0 md:start-auto md:end-0 md:h-full md:max-h-none md:max-w-md md:rounded-none md:border-s"
        onPointerDownOutside={(e) => {
          if (voice.phase !== 'idle') e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (voice.phase !== 'idle') e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (voice.phase !== 'idle') {
            e.preventDefault();
            voice.cancel();
          }
        }}
      >
        <SheetHeader className="shrink-0">
          <SheetTitle className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center">
              <PennyAvatar pose="hello" size="nav" name={t('ai.title')} className="h-11 w-11" />
            </span>
            {t('ai.title')}
          </SheetTitle>
          <p className="text-sm text-ink-secondary">{t('ai.subtitle')}</p>
          {signedIn && creditsLeft !== null ? (
            <p className="text-xs text-ink-muted">
              {t('ai.creditsLeft', { count: creditsLeft })}
            </p>
          ) : null}
        </SheetHeader>

        {!signedIn || gateError === 'auth' ? (
          <div className="mt-4 shrink-0 space-y-3 rounded-[var(--cm-radius-card)] border border-border bg-canvas p-4">
            <p className="text-sm text-ink-secondary">{t('ai.needLogin')}</p>
            <Button asChild>
              <Link href="/auth/sign-in?next=/app/home">{t('nav.signIn')}</Link>
            </Button>
          </div>
        ) : null}

        {gateError === 'credits' ? (
          <div className="mt-4 shrink-0">
            <PlanGate title={t('ai.outOfCredits')} body={t('ai.upgradeForCredits')} />
          </div>
        ) : null}

        <div
          ref={listRef}
          onScroll={onMessagesScroll}
          className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pe-1"
        >
          {historyLoading ? (
            <div className="flex items-center gap-2 py-2 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('ai.thinking')}
            </div>
          ) : null}
          {loadingOlder ? (
            <div className="flex justify-center py-1 text-xs text-ink-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
          ) : null}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {msg.role === 'assistant' ? (
                <PennyAvatar
                  pose={busy && msg.id === messages[messages.length - 1]?.id ? 'think' : 'idle'}
                  size="sm"
                  name={t('ai.title')}
                  className="mt-0.5"
                />
              ) : null}
              <div
                className={cn(
                  'max-w-[85%] rounded-[var(--cm-radius-card)] px-3.5 py-2.5 text-sm leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-brand text-white'
                    : 'border border-border bg-canvas text-ink',
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.report ? (
                  <div className="mt-3 rounded-[var(--cm-radius-control)] border border-border bg-surface p-3 text-ink">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      {msg.report.title}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink-secondary">{msg.report.body}</p>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
          {busy || voice.phase === 'sending' ? (
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <PennyAvatar pose="answer" size="sm" animate name={t('ai.title')} />
              <Loader2 className="h-4 w-4 animate-spin" />
              {voice.phase === 'sending' ? t('ai.voiceSending') : t('ai.thinking')}
            </div>
          ) : null}
        </div>

        {!voiceActive ? (
          <div className="mt-3 shrink-0 space-y-2 border-t border-border pt-3">
            {inlineSuggestions && inlineSuggestions.length > 0 ? (
              <ChipRow items={inlineSuggestions} disabled={busy} onPick={onChip} emphasize />
            ) : chips.length > 0 ? (
              <ChipRow items={chips} disabled={busy} onPick={onChip} emphasize />
            ) : showStarters ? (
              <ChipRow items={starterChips} disabled={busy} onPick={onChip} />
            ) : null}
          </div>
        ) : null}

        {voice.phase === 'listening' || voice.phase === 'review' || voice.phase === 'sending' ? (
          <div className="shrink-0">
          <VoicePanel
            phase={voice.phase}
            liveTranscript={voice.liveTranscript}
            reviewText={voice.finalTranscript}
            errorMessage={voiceErrorLabel}
            labels={{
              listening: t('ai.recording'),
              listeningHint: t('ai.listeningHint'),
              speakNow: t('ai.speakNow'),
              done: t('ai.voiceDone'),
              cancel: t('ai.voiceCancel'),
              reviewTitle: t('ai.voiceReview'),
              reviewHint: t('ai.voiceReviewHint'),
              send: t('ai.voiceSend'),
              rerecord: t('ai.voiceRerecord'),
              sending: t('ai.voiceSending'),
              sendingHint: t('ai.voiceSendingHint'),
              queued: t('ai.voiceQueued'),
              processing: t('ai.voiceProcessing'),
            }}
            onDoneListening={(text) => voice.finishListening(text)}
            onCancel={voice.cancel}
            onReviewChange={voice.updateReviewText}
            onSend={(text) => void sendVoice(text)}
            onRerecord={() => voice.startListening()}
          />
          </div>
        ) : (
          <form
            className="mt-3 flex shrink-0 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void sendToAi(input);
            }}
          >
            {voice.supported ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={startMic}
                aria-label={t('ai.voiceStart')}
                disabled={busy}
              >
                <Mic className="h-4 w-4" />
              </Button>
            ) : null}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                awaitingNoteId
                  ? t('ai.notePlaceholder')
                  : pending
                    ? t('ai.categoryPlaceholder')
                    : t('ai.placeholder')
              }
              disabled={busy}
              className="h-11 flex-1 rounded-[var(--cm-radius-control)] border border-border bg-surface px-3 text-sm text-ink outline-none focus:ring-2 focus:ring-brand"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label={t('ai.send')}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        )}
        {!voice.supported ? (
          <p className="mt-2 shrink-0 text-center text-xs text-ink-muted">{t('ai.voiceTypeInstead')}</p>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
