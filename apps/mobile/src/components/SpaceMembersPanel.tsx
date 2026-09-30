import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { can, type SpaceRole } from '@clear-money/domain';
import { t } from '../lib/i18n';
import { apiFetch } from '../lib/api';
import { getWebOrigin, inviteSpaceMember } from '../lib/ledger';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, space } from '../theme/tokens';

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
};

const INVITE_ROLES = ['contributor', 'viewer', 'admin', 'child'] as const;

export function SpaceMembersPanel({
  spaceId,
  role,
  locale = 'en',
}: {
  spaceId: string;
  role: SpaceRole;
  locale?: string;
}) {
  const colors = useThemeColors();
  const canInvite = can(role, 'invite');
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<(typeof INVITE_ROLES)[number]>('contributor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    const membersRes = await apiFetch(`/spaces/${spaceId}/members`);
    if (membersRes.ok) {
      setMembers(((await membersRes.json()) as Member[]) ?? []);
    }
    if (canInvite) {
      const invitesRes = await apiFetch(`/spaces/${spaceId}/invitations`);
      if (invitesRes.ok) {
        setInvites(((await invitesRes.json()) as Invitation[]) ?? []);
      }
    }
  }, [canInvite, spaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.ink }]}>{t(locale, 'spaces.members')}</Text>
      {members.length === 0 ? (
        <Text style={{ color: colors.inkMuted, fontSize: 13 }}>{t(locale, 'spaces.noMembers')}</Text>
      ) : (
        members.map((m) => (
          <View key={m.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.ink, fontWeight: '600' }}>{m.name || m.email}</Text>
              <Text style={{ color: colors.inkMuted, fontSize: 12 }}>{m.email}</Text>
            </View>
            <Text style={{ color: colors.inkSecondary, fontSize: 12, textTransform: 'capitalize' }}>
              {m.role}
            </Text>
          </View>
        ))
      )}

      {canInvite ? (
        <View style={{ gap: space[2], marginTop: space[3] }}>
          <Text style={{ color: colors.inkSecondary, fontWeight: '600', fontSize: 13 }}>
            {t(locale, 'spaces.inviteTitle')}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="friend@email.com"
            placeholderTextColor={colors.inkMuted}
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.ink, backgroundColor: colors.canvas },
            ]}
          />
          <View style={styles.types}>
            {INVITE_ROLES.map((r) => {
              const on = inviteRole === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setInviteRole(r)}
                  style={[
                    styles.chip,
                    {
                      borderColor: on ? colors.brand : colors.border,
                      backgroundColor: on ? colors.brandTint : colors.canvas,
                    },
                  ]}
                >
                  <Text style={{ color: on ? colors.brand : colors.ink, fontSize: 12, fontWeight: '600' }}>
                    {r}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {error ? <Text style={{ color: colors.expense, fontSize: 13 }}>{error}</Text> : null}
          {inviteLink ? (
            <Text style={{ color: colors.inkSecondary, fontSize: 12 }}>{inviteLink}</Text>
          ) : null}
          <Pressable
            disabled={busy || !email.trim()}
            onPress={() => {
              void (async () => {
                setBusy(true);
                setError(null);
                try {
                  const result = await inviteSpaceMember(spaceId, email, inviteRole);
                  const link = `${getWebOrigin()}${result.acceptPath}`;
                  setInviteLink(link);
                  setEmail('');
                  await load();
                  await Share.share({ message: link }).catch(() => undefined);
                } catch (err) {
                  setError(err instanceof Error ? err.message : t(locale, 'spaces.inviteFailed'));
                } finally {
                  setBusy(false);
                }
              })();
            }}
            style={[styles.cta, { backgroundColor: colors.brand, opacity: busy || !email.trim() ? 0.5 : 1 }]}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>{t(locale, 'spaces.invite')}</Text>
          </Pressable>
          {invites.length ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: colors.inkMuted, fontSize: 12 }}>{t(locale, 'spaces.pendingInvites')}</Text>
              {invites.map((inv) => (
                <Text key={inv.id} style={{ color: colors.inkSecondary, fontSize: 12 }}>
                  {inv.email} · {inv.role} · {inv.status}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[5],
    gap: space[3],
  },
  title: { fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: space[3],
  },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space[3],
    paddingVertical: 6,
  },
  cta: {
    minHeight: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
