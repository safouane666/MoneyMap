'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Copy, Check, Trash2 } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { can, type SpaceRole } from '@clear-money/domain';

type Member = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  acceptPath: string;
  expiresAt: string | null;
};

const INVITE_ROLES = ['contributor', 'viewer', 'admin', 'child'] as const;
const MEMBER_ROLES = ['owner', 'admin', 'contributor', 'viewer', 'child'] as const;

export function SpaceMembersPanel({
  spaceId,
  role,
}: {
  spaceId: string;
  role: SpaceRole;
}) {
  const { t } = useI18n();
  const canInvite = can(role, 'invite');
  const canManage = can(role, 'manage_members');
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<(typeof INVITE_ROLES)[number]>('contributor');
  const [loading, setLoading] = useState(false);
  const [roleUpdating, setRoleUpdating] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const membersResult = await apiFetch<Member[]>(`/spaces/${spaceId}/members`);
    if (!membersResult.offline && membersResult.data) {
      setMembers(membersResult.data);
    }
    if (canInvite) {
      const invitesResult = await apiFetch<Invitation[]>(`/spaces/${spaceId}/invitations`);
      if (!invitesResult.offline && invitesResult.data) {
        setInvites(invitesResult.data);
      }
    }
  }, [canInvite, spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onInvite = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInviteLink(null);
    setCopied(false);
    try {
      const result = await apiFetch<{ id: string; acceptPath: string }>(
        `/spaces/${spaceId}/members/invite`,
        {
          method: 'POST',
          body: JSON.stringify({ email, role: inviteRole }),
        },
      );
      if (result.offline || !result.data) {
        setError(t('spaces.needOnline'));
        return;
      }
      const link = `${window.location.origin}${result.data.acceptPath}`;
      setInviteLink(link);
      setEmail('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('spaces.inviteFailed'));
    } finally {
      setLoading(false);
    }
  };

  const onRoleChange = async (memberId: string, nextRole: string) => {
    setRoleUpdating(memberId);
    setError(null);
    try {
      const result = await apiFetch<{ ok: boolean; role: string }>(
        `/spaces/${spaceId}/members/${memberId}/role`,
        {
          method: 'PATCH',
          body: JSON.stringify({ role: nextRole }),
        },
      );
      if (result.offline || !result.data) {
        setError(t('spaces.needOnline'));
        return;
      }
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: result.data!.role } : m)),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('spaces.roleChangeFailed'));
      await load();
    } finally {
      setRoleUpdating(null);
    }
  };

  const onRemoveMember = async (member: Member) => {
    if (removingId) return;
    const label = member.name || member.email;
    if (!window.confirm(t('spaces.removeConfirm').replace('{name}', label))) return;
    setRemovingId(member.id);
    setError(null);
    try {
      const result = await apiFetch<{ ok: boolean }>(
        `/spaces/${spaceId}/members/${member.id}`,
        { method: 'DELETE' },
      );
      if (result.offline || !result.data) {
        setError(t('spaces.needOnline'));
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('spaces.removeFailed'));
      await load();
    } finally {
      setRemovingId(null);
    }
  };

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const roleLabel = (value: string) => {
    const key = `spaces.roles.${value}`;
    const translated = t(key);
    return translated === key ? value : translated;
  };

  return (
    <section id="members" className="space-y-4 scroll-mt-20">
      <h2 className="font-medium">{t('spaces.members')}</h2>
      {error ? <p className="text-sm text-expense">{error}</p> : null}
      <ul className="space-y-2">
        {members.map((member) => (
          <li
            key={member.id}
            className="flex items-center justify-between gap-3 rounded-[var(--cm-radius-control)] border border-border bg-surface px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{member.name || member.email}</p>
              <p className="truncate text-sm text-ink-secondary">{member.email}</p>
            </div>
            {canManage ? (
              <div className="flex shrink-0 items-center gap-2">
                <Select
                  value={MEMBER_ROLES.includes(member.role as (typeof MEMBER_ROLES)[number])
                    ? member.role
                    : 'contributor'}
                  onValueChange={(v) => void onRoleChange(member.id, v)}
                  disabled={roleUpdating === member.id || removingId === member.id}
                >
                  <SelectTrigger className="w-[9.5rem]" aria-label={t('spaces.role')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEMBER_ROLES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {roleLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="shrink-0 text-expense hover:bg-expense/10"
                  aria-label={t('spaces.removeMember')}
                  disabled={removingId === member.id}
                  onClick={() => void onRemoveMember(member)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Badge variant="secondary">{roleLabel(member.role)}</Badge>
            )}
          </li>
        ))}
        {!members.length ? (
          <li className="text-sm text-ink-secondary">{t('spaces.noMembers')}</li>
        ) : null}
      </ul>

      {canInvite ? (
        <div className="space-y-3 rounded-[var(--cm-radius-card)] border border-border bg-surface p-4">
          <h3 className="text-sm font-medium">{t('spaces.inviteTitle')}</h3>
          <p className="text-sm text-ink-secondary">{t('spaces.inviteBody')}</p>
          <form className="space-y-3" onSubmit={onInvite}>
            <div className="space-y-2">
              <Label htmlFor="invite-email">{t('auth.email')}</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">{t('spaces.role')}</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as (typeof INVITE_ROLES)[number])}
              >
                <SelectTrigger id="invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {roleLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? t('spaces.inviting') : t('spaces.invite')}
            </Button>
          </form>

          {inviteLink ? (
            <div className="space-y-2 rounded-[var(--cm-radius-control)] border border-border bg-canvas p-3">
              <p className="text-sm font-medium">{t('spaces.inviteReady')}</p>
              <p className="break-all text-xs text-ink-secondary">{inviteLink}</p>
              <Button type="button" variant="outline" size="sm" className="gap-2" onClick={copyLink}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t('spaces.copied') : t('spaces.copyLink')}
              </Button>
            </div>
          ) : null}

          {invites.length ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-ink-secondary">{t('spaces.pendingInvites')}</h4>
              <p className="text-xs text-ink-muted">{t('spaces.inviteEmailHint')}</p>
              <ul className="space-y-2">
                {invites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span className="truncate">
                      {invite.email} · {roleLabel(invite.role)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{invite.status}</Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={async () => {
                          const link = `${window.location.origin}${invite.acceptPath}`;
                          try {
                            await navigator.clipboard.writeText(link);
                            setInviteLink(link);
                            setCopied(true);
                            window.setTimeout(() => setCopied(false), 2000);
                          } catch {
                            setInviteLink(link);
                          }
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {t('spaces.copyLink')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
