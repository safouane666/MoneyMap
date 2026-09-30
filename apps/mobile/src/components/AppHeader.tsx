import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PennyAvatar } from './penny/PennyFigure';
import { CreateSpaceModal } from './CreateSpaceModal';
import { t } from '../lib/i18n';
import type { MobileSpace } from '../lib/ledger';
import { setActiveSpaceId } from '../lib/ledger';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, space } from '../theme/tokens';

/**
 * Matches web AppShell sticky header on phone:
 * SpaceSwitcher dropdown + create-space (+) + Penny avatar.
 * Control height ~44 (web h-11).
 */
export function AppHeader({
  spaceName,
  spaces = [],
  activeSpaceId,
  signedIn,
  userName,
  locale = 'en',
  onSpaceChanged,
}: {
  spaceName?: string | null;
  spaces?: MobileSpace[];
  activeSpaceId?: string | null;
  signedIn?: boolean;
  userName?: string | null;
  locale?: string;
  onSpaceChanged?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const currency = spaces.find((s) => s.id === activeSpaceId)?.currency;
  const label = useMemo(
    () => spaceName?.trim() || spaces.find((s) => s.id === activeSpaceId)?.name || 'Personal',
    [spaceName, spaces, activeSpaceId],
  );
  const accountInitials = useMemo(() => {
    const trimmed = userName?.trim();
    if (!trimmed) return null;
    return trimmed.slice(0, 2).toUpperCase();
  }, [userName]);

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: Math.max(insets.top, space[2]),
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={styles.left}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch space"
          onPress={() => setOpen(true)}
          style={[
            styles.spaceChip,
            { borderColor: colors.border, backgroundColor: colors.elevated },
          ]}
        >
          <Text style={[styles.spaceLabel, { color: colors.ink }]} numberOfLines={1}>
            {label}
          </Text>
          <Ionicons name="chevron-expand" size={16} color={colors.inkMuted} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(locale, 'spaces.create')}
          onPress={() => setCreateOpen(true)}
          style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: colors.elevated }]}
        >
          <Ionicons name="add" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.right}>
        {signedIn && accountInitials ? (
          <Pressable
            onPress={() => router.push('/(tabs)/account')}
            accessibilityRole="button"
            accessibilityLabel={userName ?? 'Account'}
            style={[styles.accountBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.accountInitials, { color: colors.inkSecondary }]}>
              {accountInitials}
            </Text>
          </Pressable>
        ) : !signedIn ? (
          <Pressable
            onPress={() => router.push('/auth/sign-in')}
            style={[styles.signIn, { borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <Text style={[styles.signInLabel, { color: colors.inkSecondary }]}>
              {t(locale, 'nav.signIn')}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask Penny"
          onPress={() => router.push('/penny')}
          style={[
            styles.pennyBtn,
            { backgroundColor: colors.elevated, borderColor: colors.border },
          ]}
        >
          <PennyAvatar pose="roll" size="nav" name="Penny" />
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.menu,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.menuTitle, { color: colors.inkMuted }]}>Spaces</Text>
            {spaces.map((space) => {
              const active = space.id === activeSpaceId;
              return (
                <Pressable
                  key={space.id}
                  onPress={() => {
                    void (async () => {
                      await setActiveSpaceId(space.id);
                      setOpen(false);
                      onSpaceChanged?.();
                    })();
                  }}
                  style={[
                    styles.menuItem,
                    active && { backgroundColor: colors.brandTint },
                  ]}
                >
                  <Text
                    style={[
                      styles.menuItemLabel,
                      { color: active ? colors.brand : colors.ink },
                    ]}
                    numberOfLines={1}
                  >
                    {space.name}
                  </Text>
                  <Text style={[styles.menuCurrency, { color: colors.inkMuted }]}>
                    {space.currency}
                  </Text>
                </Pressable>
              );
            })}
            {spaces.length === 0 ? (
              <Text style={[styles.menuEmpty, { color: colors.inkMuted }]}>No spaces yet</Text>
            ) : null}
          </View>
        </Pressable>
      </Modal>
      <CreateSpaceModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        locale={locale}
        currency={currency}
        onCreated={(id) => {
          onSpaceChanged?.();
          router.push(`/space/${id}` as Href);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    minHeight: 56,
    paddingHorizontal: space[4],
    paddingBottom: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexShrink: 1,
    minWidth: 0,
  },
  spaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: 200,
    minHeight: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
  },
  spaceLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexShrink: 0,
  },
  signIn: {
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    minHeight: 44,
    justifyContent: 'center',
  },
  signInLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  accountBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.control,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInitials: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pennyBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'visible',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-start',
    paddingTop: 100,
    paddingHorizontal: space[4],
  },
  menu: {
    borderRadius: radius.card,
    borderWidth: 1,
    overflow: 'hidden',
    maxWidth: 320,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: space[4],
    paddingTop: space[3],
    paddingBottom: space[2],
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: space[4],
    paddingVertical: space[3] + 2,
    minHeight: 44,
  },
  menuItemLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
  menuCurrency: { fontSize: 12 },
  menuEmpty: { padding: space[4], fontSize: 14 },
});
