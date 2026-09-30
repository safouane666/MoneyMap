import { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { SetupShell } from '../../src/components/SetupShell';
import { PrimaryButton, SecondaryButton } from '../../src/components/ui';
import { markSetupStep } from '../../src/lib/setup-session';
import { nextSetupRoute } from '../../src/lib/setup-steps';
import { colors, radius, space } from '../../src/theme/tokens';

const SLIDES = [
  {
    title: 'A calm ledger',
    body: 'Capture income and spending in seconds — clear totals, no spreadsheet stress.',
  },
  {
    title: 'Spaces that stay separate',
    body: 'Personal, shared, or project money — each with its own picture.',
  },
  {
    title: 'AI that helps, quietly',
    body: 'Ask in plain language. Get answers without leaving your flow.',
  },
];

const WIDTH = Dimensions.get('window').width - space[4] * 2;

export default function FeaturesScreen() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const ref = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / WIDTH);
    setIndex(i);
  };

  return (
    <SetupShell stepId="features">
      <Text style={styles.title}>Here&apos;s what you get</Text>
      <Text style={styles.body}>Swipe through the highlights, then we&apos;ll finish your preferences.</Text>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ marginBottom: space[3] }}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.slide, { width: WIDTH }]}>
            <Text style={styles.slideTitle}>{s.title}</Text>
            <Text style={styles.slideBody}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
        ))}
      </View>
      <View style={styles.row}>
        <SecondaryButton
          label="Back"
          onPress={() => {
            const next = Math.max(0, index - 1);
            ref.current?.scrollTo({ x: next * WIDTH, animated: true });
            setIndex(next);
          }}
        />
        {index < SLIDES.length - 1 ? (
          <PrimaryButton
            label="Next"
            onPress={() => {
              const next = Math.min(SLIDES.length - 1, index + 1);
              ref.current?.scrollTo({ x: next * WIDTH, animated: true });
              setIndex(next);
            }}
          />
        ) : (
          <PrimaryButton
            label="Continue"
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
