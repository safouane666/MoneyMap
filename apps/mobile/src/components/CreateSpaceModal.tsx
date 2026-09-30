import { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { t } from '../lib/i18n';
import { createSpace } from '../lib/ledger';
import { useThemeColors } from '../theme/ThemeContext';
import { radius, space } from '../theme/tokens';

const SPACE_TYPES = ['personal', 'project', 'family', 'company'] as const;

export function CreateSpaceModal({
  visible,
  onClose,
  locale = 'en',
  currency,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  locale?: string;
  currency?: string;
  onCreated?: (id: string) => void;
}) {
  const colors = useThemeColors();
  const [name, setName] = useState('');
  const [type, setType] = useState<(typeof SPACE_TYPES)[number]>('project');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createSpace({ name: name.trim(), type, currency });
      setName('');
      setType('project');
      onClose();
      onCreated?.(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(locale, 'spaces.createFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.ink }]}>{t(locale, 'spaces.createTitle')}</Text>
          <Text style={[styles.body, { color: colors.inkSecondary }]}>
            {t(locale, 'spaces.createBody')}
          </Text>
          <Text style={[styles.label, { color: colors.inkSecondary }]}>{t(locale, 'spaces.name')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t(locale, 'spaces.namePlaceholder')}
            placeholderTextColor={colors.inkMuted}
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.ink, backgroundColor: colors.canvas },
            ]}
          />
          <Text style={[styles.label, { color: colors.inkSecondary }]}>{t(locale, 'spaces.type')}</Text>
          <View style={styles.types}>
            {SPACE_TYPES.map((value) => {
              const on = type === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setType(value)}
                  style={[
                    styles.typeChip,
                    {
                      borderColor: on ? colors.brand : colors.border,
                      backgroundColor: on ? colors.brandTint : colors.canvas,
                    },
                  ]}
                >
                  <Text style={{ color: on ? colors.brand : colors.ink, fontWeight: '600', fontSize: 13 }}>
                    {t(locale, `spaces.types.${value}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {error ? <Text style={{ color: colors.expense, fontSize: 13 }}>{error}</Text> : null}
          <Pressable
            onPress={() => void submit()}
            disabled={busy || !name.trim()}
            style={[styles.cta, { backgroundColor: colors.brand, opacity: busy || !name.trim() ? 0.5 : 1 }]}
          >
            <Text style={styles.ctaText}>
              {busy ? t(locale, 'spaces.creating') : t(locale, 'spaces.create')}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: space[6],
  },
  sheet: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space[5],
    gap: space[3],
  },
  title: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 12, fontWeight: '600' },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: space[3],
  },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  typeChip: {
    borderWidth: 1,
    borderRadius: radius.control,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    minHeight: 40,
    justifyContent: 'center',
  },
  cta: {
    minHeight: 44,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '700' },
});
