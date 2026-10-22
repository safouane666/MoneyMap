import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { SetupShell } from '../../src/components/SetupShell';
import { PrimaryButton, SecondaryButton } from '../../src/components/ui';
import { useSetupLocale } from '../../src/lib/setup-locale';
import { markSetupStep } from '../../src/lib/setup-session';
import { nextSetupRoute, prevSetupRoute } from '../../src/lib/setup-steps';
import { colors, radius, space } from '../../src/theme/tokens';

const SLIDE_KEYS = [
  { title: 'setup.features.ledgerTitle', body: 'setup.features.ledgerBody' },
  { title: 'setup.features.spacesTitle', body: 'setup.features.spacesBody' },
  { title: 'setup.features.aiTitle', body: 'setup.features.aiBody' },
] as const;

export default function FeaturesScreen() {
  const router = useRouter();
  const { t } = useSetupLocale();
  const { width: windowWidth } = useWindowDimensions();
  const slideWidth = Math.max(280, windowWidth - space[4] * 2);
  const [index, setIndex] = useState(0);
  const ref = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / slideWidth);
    setIndex(i);
  };

  return (
    <SetupShell stepId="features">
      <Text style={styles.title}>{t('setup.featuresTitle')}</Text>
      <Text style={styles.body}>{t('setup.featuresBody')}</Text>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ marginBottom: space[3] }}
      >
        {SLIDE_KEYS.map((s) => (
          <View key={s.title} style={[styles.slide, { width: slideWidth }]}>
            <Text style={styles.slideTitle}>{t(s.title)}</Text>
            <Text style={styles.slideBody}>{t(s.body)}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {SLIDE_KEYS.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
        ))}
      </View>
      <View style={styles.row}>
        <SecondaryButton
          label={t('setup.features.prev')}
          onPress={() => {
            if (index > 0) {
              const next = index - 1;
              ref.current?.scrollTo({ x: next * slideWidth, animated: true });
              setIndex(next);
              return;
            }
            const backTo = prevSetupRoute('features');
            if (backTo) router.replace(backTo as Href);
          }}
        />
        {index < SLIDE_KEYS.length - 1 ? (
          <PrimaryButton
            label={t('setup.features.next')}
            onPress={() => {
              const next = Math.min(SLIDE_KEYS.length - 1, index + 1);
              ref.current?.scrollTo({ x: next * slideWidth, animated: true });
              setIndex(next);
            }}
          />
        ) : (
          <PrimaryButton
            label={t('setup.continue')}
            onPress={async () => {
              await markSetupStep('features');
              router.push(nextSetupRoute('features') as Href);
            }}
          />
        )}
      </View>
    </SetupShell>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, letterSpacing: -0.3 },
  body: { fontSize: 15, lineHeight: 22, color: colors.inkSecondary, marginBottom: space[4] },
  slide: {
    backgroundColor: colors.surface,
    borderRadius: radius.feature,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space[5],
    marginRight: space[2],
    minHeight: 160,
  },
  slideTitle: { fontSize: 20, fontWeight: '700', color: colors.ink, marginBottom: space[2] },
  slideBody: { fontSize: 15, lineHeight: 22, color: colors.inkSecondary },
  dots: { flexDirection: 'row', gap: 6, marginBottom: space[5], justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.brand },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space[3] },
});
