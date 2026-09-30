import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, type Href } from 'expo-router';
import { can } from '@clear-money/domain';
import { t } from '../../src/lib/i18n';
import { CreateSpaceModal } from '../../src/components/CreateSpaceModal';
import {
  loadLedger,
  setActiveSpaceId,
  type MobileLedger,
  type MobileSpace,
} from '../../src/lib/ledger';
import { loadSetupSession } from '../../src/lib/setup-session';
import { useThemeColors } from '../../src/theme/ThemeContext';
import { radius, shadow, space } from '../../src/theme/tokens';

export default function SpacesScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [locale, setLocale] = useState('en');
  const [ledger, setLedger] = useState<MobileLedger | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLocale((await loadSetupSession()).language);
    setLedger(await loadLedger());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh().catch(() => undefined);
    }, [refresh]),
  );

  const guest = !ledger || ledger.userId === 'guest';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.canvas }]} edges={[]}>
      <FlatList
        contentContainerStyle={styles.content}
        data={ledger?.spaces ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.ink }]}>{t(locale, 'spaces.title')}</Text>
            {!guest ? (
              <Pressable
                onPress={() => setCreateOpen(true)}
                style={[styles.create, { backgroundColor: colors.brand }]}
              >
                <Text style={styles.createText}>{t(locale, 'spaces.create')}</Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: colors.inkSecondary, fontSize: 14 }}>{t(locale, 'spaces.empty')}</Text>
        }
        renderItem={({ item }) => (
          <SpaceCard
            item={item}
            active={item.id === ledger?.activeSpaceId}
            locale={locale}
            onOpen={() => {
              void setActiveSpaceId(item.id).then(() => router.push(`/space/${item.id}` as Href));
            }}
            onInvite={() => {
              void setActiveSpaceId(item.id).then(() => router.push(`/space/${item.id}` as Href));
            }}
          />
        )}
      />
      <CreateSpaceModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        locale={locale}
        currency={ledger?.spaces.find((s) => s.id === ledger.activeSpaceId)?.currency}
        onCreated={(id) => {
          void refresh().then(() => router.push(`/space/${id}` as Href));
        }}
      />
    </SafeAreaView>
  );
}

function SpaceCard({
  item,
  active,
  locale,
  onOpen,
  onInvite,
}: {
  item: MobileSpace;
  active: boolean;
  locale: string;
  onOpen: () => void;
  onInvite: () => void;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        shadow.card,
        {
          borderColor: active ? colors.brand : colors.border,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: colors.ink }]}>{item.name}</Text>
          <Text style={[styles.meta, { color: colors.inkSecondary }]}>{item.currency}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.brandTint }]}>
          <Text style={{ color: colors.brand, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>
            {item.role}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={onOpen}
          style={[styles.outline, { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 13 }}>{t(locale, 'spaces.open')}</Text>
        </Pressable>
        {can(item.role, 'invite') ? (
          <Pressable
            onPress={onInvite}
            style={[styles.solid, { backgroundColor: colors.brand }]}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>{t(locale, 'spaces.invite')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: space[4], paddingTop: space[6], paddingBottom: 180, gap: space[4] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], marginBottom: space[2] },
  title: { fontSize: 24, fontWeight: '600', letterSpacing: -0.3, flex: 1 },
  create: { minHeight: 40, borderRadius: radius.control, paddingHorizontal: space[3], justifyContent: 'center' },
  createText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  card: { borderRadius: radius.card, borderWidth: 1, padding: space[5], gap: space[4] },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  name: { fontSize: 18, fontWeight: '600' },
  meta: { marginTop: 4, fontSize: 14 },
  badge: { borderRadius: radius.pill, paddingHorizontal: space[2], paddingVertical: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  outline: {
    minHeight: 36,
    borderRadius: radius.control,
    borderWidth: 1,
    paddingHorizontal: space[3],
    justifyContent: 'center',
  },
  solid: {
    minHeight: 36,
    borderRadius: radius.control,
    paddingHorizontal: space[3],
    justifyContent: 'center',
  },
});
