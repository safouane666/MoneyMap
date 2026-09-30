import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { can } from '@clear-money/domain';
import { AppHeader } from '../../src/components/AppHeader';
import { t } from '../../src/lib/i18n';
import {
  loadCachedLedger,
  loadLedger,
  type MobileSpace,
} from '../../src/lib/ledger';
import { loadSetupSession } from '../../src/lib/setup-session';
import { useThemeColors } from '../../src/theme/ThemeContext';
import { radius, shadow, space, touchTarget } from '../../src/theme/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];

function TabsChrome() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const barHeight = 56 + Math.max(insets.bottom, space[2]);
  const [spaceName, setSpaceName] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<MobileSpace[]>([]);
  const [activeSpaceId, setActiveId] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [locale, setLocale] = useState('en');
  const [canCreate, setCanCreate] = useState(true);
  const [tick, setTick] = useState(0);

  const refreshHeader = useCallback(async () => {
    setLocale((await loadSetupSession()).language);
    const cached = await loadCachedLedger().catch(() => null);
    const ledger = cached ?? (await loadLedger().catch(() => null));
    if (!ledger) return;
    const space = ledger.spaces.find((s) => s.id === ledger.activeSpaceId);
    setSpaceName(space?.name ?? null);
    setSpaces(ledger.spaces);
    setActiveId(ledger.activeSpaceId);
    setSignedIn(ledger.userId !== 'guest');
    setUserName(ledger.userName ?? null);
    setCanCreate(space ? can(space.role, 'create') : true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshHeader();
    }, [refreshHeader, tick]),
  );

  const tabIcon = (name: IconName, focused: boolean) => (
    <Ionicons name={name} size={20} color={focused ? colors.brand : colors.inkMuted} />
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <AppHeader
        spaceName={spaceName}
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        signedIn={signedIn}
        userName={userName}
        locale={locale}
        onSpaceChanged={() => {
          setTick((n) => n + 1);
          void refreshHeader();
        }}
      />

      <View style={styles.tabs}>
        <Tabs
          key={activeSpaceId ?? 'space'}
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.brand,
            tabBarInactiveTintColor: colors.inkMuted,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: barHeight,
              paddingBottom: Math.max(insets.bottom, space[2]),
              paddingTop: space[2],
            },
            tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
            tabBarItemStyle: { borderRadius: radius.sm },
          }}
        >
          <Tabs.Screen
            name="home"
            options={{
              title: t(locale, 'nav.home'),
              tabBarIcon: ({ focused }) =>
                tabIcon(focused ? 'home' : 'home-outline', focused),
            }}
          />
          <Tabs.Screen
            name="activity"
            options={{
              title: t(locale, 'nav.activity'),
              tabBarIcon: ({ focused }) =>
                tabIcon(focused ? 'list' : 'list-outline', focused),
            }}
          />
          <Tabs.Screen
            name="spaces"
            options={{
              title: t(locale, 'nav.spaces'),
              tabBarIcon: ({ focused }) =>
                tabIcon(focused ? 'grid' : 'grid-outline', focused),
            }}
          />
          <Tabs.Screen
            name="goals"
            options={{
              title: t(locale, 'nav.goals'),
              tabBarIcon: ({ focused }) =>
                tabIcon(focused ? 'flag' : 'flag-outline', focused),
            }}
          />
          <Tabs.Screen
            name="account"
            options={{
              title: t(locale, 'nav.account'),
              tabBarIcon: ({ focused }) =>
                tabIcon(focused ? 'person' : 'person-outline', focused),
            }}
          />
          <Tabs.Screen name="reports" options={{ href: null, title: 'Reports' }} />
        </Tabs>
      </View>

      {canCreate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(locale, 'nav.add')}
          onPress={() => router.push('/add-transaction')}
          style={[
            styles.fab,
            { bottom: barHeight + 4, backgroundColor: colors.brand },
            shadow.fab,
          ]}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Authenticated shell — light by default (respects ThemeProvider). */
export default function TabsLayout() {
  return <TabsChrome />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { flex: 1 },
  fab: {
    position: 'absolute',
    alignSelf: 'center',
    left: '50%',
    marginLeft: -(touchTarget + 8) / 2,
    width: touchTarget + 8,
    height: touchTarget + 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
});
