'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  BarChart3,
  Home,
  LayoutGrid,
  Plus,
  Settings,
  Target,
  UserRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { SpaceSwitcher } from '@/components/SpaceSwitcher';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TransactionForm } from '@/components/TransactionForm';
import { AiChat } from '@/components/AiChat';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PermissionGate } from '@/components/PermissionGate';
import { PennyAvatar } from '@/components/penny/PennyAvatar';
import { useToast } from '@/components/Toast';
import { useLedger } from '@/lib/ledger';
import { getActiveSpace } from '@/lib/demo-state';
import { loadSetupSession } from '@/lib/setup-session';
import { can } from '@clear-money/domain';

const TIP_KEY = 'cm.penny.tip.day';

const desktopNav = [
  { href: '/app/home', key: 'nav.home', icon: Home },
  { href: '/app/activity', key: 'nav.activity', icon: Activity },
  { href: '/app/reports', key: 'nav.reports', icon: BarChart3 },
  { href: '/app/spaces', key: 'nav.spaces', icon: LayoutGrid },
  { href: '/app/goals', key: 'nav.goals', icon: Target },
  { href: '/app/account', key: 'nav.account', icon: UserRound },
  { href: '/app/settings', key: 'nav.settings', icon: Settings },
] as const;

const mobileNav = [
  { href: '/app/home', key: 'nav.home', icon: Home },
  { href: '/app/activity', key: 'nav.activity', icon: Activity },
  { href: '/app/spaces', key: 'nav.spaces', icon: LayoutGrid },
  { href: '/app/goals', key: 'nav.goals', icon: Target },
  { href: '/app/account', key: 'nav.account', icon: UserRound },
] as const;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const { state, offline, signedIn, sessionUser, showLoginPrompt, dismissLoginPrompt } = useLedger();
  const { showPennyTip } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const space = getActiveSpace(state);
  const canCreate = can(space.role, 'create');

  useEffect(() => {
    if (!pathname.startsWith('/app/home')) return;
    if (typeof window === 'undefined') return;
    if (!loadSetupSession().notificationsEnabled) return;
    if (localStorage.getItem(TIP_KEY) === todayKey()) return;

    const id = window.setTimeout(() => {
      localStorage.setItem(TIP_KEY, todayKey());
      showPennyTip({
        title: t('ai.tipTitle'),
        message: t('ai.tipDaily'),
        actionLabel: t('ai.tipCta'),
        pose: 'wave',
        onAction: () => setAiOpen(true),
      });
    }, 1200);

    return () => window.clearTimeout(id);
  }, [pathname, showPennyTip, t]);

  const next = encodeURIComponent(pathname || '/app/home');

  return (
    <div className="min-h-dvh bg-canvas text-ink md:flex">
      <aside className="hidden w-[var(--cm-sidebar-width)] shrink-0 border-e border-border bg-surface md:flex md:flex-col">
        <div className="px-5 py-6">
          <Link href="/app/home" className="text-lg font-semibold tracking-tight text-ink">
            {t('brand')}
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 pb-6">
          {desktopNav.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex h-11 items-center gap-3 rounded-[var(--cm-radius-control)] px-3 text-sm font-medium transition-colors',
                  active ? 'bg-brand-tint text-brand' : 'text-ink-secondary hover:bg-canvas hover:text-ink',
                )}
              >
                <Icon className="h-4 w-4" />
                {t(item.key)}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setAiOpen(true)}
            className="mt-2 flex h-12 items-center gap-3 rounded-[var(--cm-radius-control)] px-3 text-sm font-medium text-ink-secondary transition-colors hover:bg-canvas hover:text-ink"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-visible">
              <PennyAvatar pose="idle" size="nav" name={t('nav.ai')} className="h-9 w-9" />
            </span>
            {t('nav.ai')}
          </button>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur md:px-6">
          <SpaceSwitcher />
          <div className="flex items-center gap-2">
            {signedIn && sessionUser ? (
              <Link
                href="/app/account"
                className="hidden max-w-[10rem] truncate rounded-full border border-border px-3 py-1 text-xs font-medium text-ink-secondary hover:bg-canvas sm:inline-flex"
                title={sessionUser.email}
              >
                {sessionUser.name}
              </Link>
            ) : (
              <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
                <Link href={`/auth/sign-in?next=${next}`}>{t('nav.signIn')}</Link>
              </Button>
            )}
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              aria-label={t('nav.ai')}
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-visible rounded-full border border-border bg-surface shadow-sm transition-transform duration-[var(--cm-motion-fast)] hover:bg-brand-tint active:scale-95"
            >
              <PennyAvatar pose="roll" size="nav" name={t('nav.ai')} className="h-11 w-11" />
            </button>
            <PermissionGate role={space.role} action="create" fallback={null}>
              <Button size="sm" className="hidden md:inline-flex" onClick={() => setAddOpen(true)}>
                <Plus className="h-4 w-4" />
                {t('nav.add')}
              </Button>
            </PermissionGate>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-36 md:px-6 md:pb-8">
          <div className="cm-content animate-reveal space-y-4">
            {!signedIn ? (
              <Alert variant="warning">
                <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                  <span>{t('account.keepData')}</span>
                  <Button asChild size="sm">
                    <Link href={`/auth/sign-in?next=${next}`}>{t('nav.signIn')}</Link>
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
            {offline && signedIn === false ? (
              <Alert variant="info">
                <AlertDescription>{t('app.offline')}</AlertDescription>
              </Alert>
            ) : null}
            {showLoginPrompt && !signedIn ? (
              <Alert variant="warning">
                <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                  <span>{t('account.loginPrompt')}</span>
                  <div className="flex gap-2">
                    <Button asChild size="sm">
                      <Link href={`/auth/sign-up?next=${next}`}>{t('nav.signUp')}</Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={dismissLoginPrompt}>
                      {t('account.dismiss')}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}
            {children}
          </div>
        </main>
      </div>

      {/* FAB sits fully above the tab bar so the center Spaces tab stays tappable. */}
      {canCreate ? (
        <button
          type="button"
          aria-label={t('nav.add')}
          onClick={() => setAddOpen(true)}
          className="cm-fab-pulse fixed start-1/2 z-50 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-brand text-white cm-shadow transition-transform duration-[var(--cm-motion-fast)] active:scale-95 rtl:translate-x-1/2 md:hidden bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))]"
        >
          <Plus className="h-6 w-6" />
        </button>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex h-12 flex-col items-center justify-center gap-0.5 rounded-[var(--cm-radius-sm)] text-[11px] font-medium',
                  active ? 'text-brand' : 'text-ink-muted',
                )}
              >
                <Icon className="h-5 w-5" />
                {t(item.key)}
              </Link>
            );
          })}
        </div>
      </nav>

      <Sheet open={addOpen && canCreate} onOpenChange={setAddOpen}>
        <SheetContent side="bottom" className="md:inset-y-0 md:start-auto md:end-0 md:max-w-md md:rounded-none md:border-s">
          <SheetHeader>
            <SheetTitle>{t('txn.addTitle')}</SheetTitle>
            <p className="text-sm text-ink-secondary">{t('txn.addSubtitle')}</p>
          </SheetHeader>
          <PermissionGate role={space.role} action="create">
            <TransactionForm onSaved={() => setAddOpen(false)} />
          </PermissionGate>
        </SheetContent>
      </Sheet>

      <AiChat open={aiOpen} onOpenChange={setAiOpen} />
    </div>
  );
}
