import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@clear-money/i18n';
import { colors, space } from '../../src/theme/tokens';

export default function ReportsScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('en', 'reports.title')}</Text>
        <Text style={styles.body}>{t('en', 'reports.empty')}</Text>
        <Text style={styles.tabs}>
          {t('en', 'reports.overview')} · {t('en', 'reports.categories')} ·{' '}
          {t('en', 'reports.time')} · {t('en', 'reports.members')}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space[6] },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: space[3] },
  body: { color: colors.inkSecondary, fontSize: 16, marginBottom: space[4] },
  tabs: { color: colors.inkMuted, fontSize: 13 },
});
