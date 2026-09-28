import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@clear-money/i18n';
import { colors, space } from '../../src/theme/tokens';

export default function SpacesScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('en', 'spaces.title')}</Text>
        <Text style={styles.group}>{t('en', 'spaces.personal')}</Text>
        <Text style={styles.group}>{t('en', 'spaces.projects')}</Text>
        <Text style={styles.group}>{t('en', 'spaces.family')}</Text>
        <Text style={styles.group}>{t('en', 'spaces.company')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: space[6], gap: space[3] },
  title: { fontSize: 28, fontWeight: '700', color: colors.ink, marginBottom: space[4] },
  group: { fontSize: 16, color: colors.ink, fontWeight: '600' },
});
