import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createIdempotencyKey } from '@clear-money/domain';
import { Body, PrimaryButton, Title } from '../src/components/ui';
import { colors, radius, space } from '../src/theme/tokens';
import { OfflineQueue } from '../src/offline/queue';
import { createSqliteStoreStub } from '../src/offline/store';

const queue = new OfflineQueue(createSqliteStoreStub(), {
  async upsertTransaction() {
    return { ok: false as const, error: 'offline' };
  },
});

export default function AddTransactionModal() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [category, setCategory] = useState('Food');
  const [categories, setCategories] = useState(['Food', 'Transport', 'Rent', 'Salary', 'Freelance']);
  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas, padding: space[6] }}>
      <Title>Add money</Title>
      <Body>Spend or receive. Amount first.</Body>
      <Text
        style={{
          fontSize: 40,
          fontWeight: '700',
          color: type === 'expense' ? colors.expense : colors.income,
          fontVariant: ['tabular-nums'],
          marginBottom: space[4],
        }}
      >
        {amount || '0'}
      </Text>
      <TextInput
        accessibilityLabel="Amount"
        keyboardType="decimal-pad"
        value={amount}
        onChangeText={setAmount}
        placeholder="0.00"
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.control,
          paddingHorizontal: space[4],
          marginBottom: space[4],
          backgroundColor: colors.surface,
          color: colors.ink,
        }}
      />
      <View style={{ flexDirection: 'row', gap: space[2], marginBottom: space[4] }}>
        {(['expense', 'income'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setType(t)}
            style={{
              flex: 1,
              minHeight: 48,
              borderRadius: radius.control,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: type === t ? colors.brandTint : colors.surface,
              borderWidth: 1,
              borderColor: type === t ? colors.brand : colors.border,
            }}
          >
            <Text style={{ color: type === t ? colors.brand : colors.inkSecondary, fontWeight: '600' }}>
              {t === 'expense' ? 'Spend' : 'Receive'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={{ color: colors.inkSecondary, marginBottom: space[2], fontWeight: '600' }}>Category</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginBottom: space[3] }}>
        {categories.map((c) => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            style={{
              paddingVertical: space[2],
              paddingHorizontal: space[3],
              borderRadius: radius.control,
              borderWidth: 1,
              borderColor: category === c ? colors.brand : colors.border,
              backgroundColor: category === c ? colors.brandTint : colors.surface,
            }}
          >
            <Text style={{ color: category === c ? colors.brand : colors.ink }}>{c}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setAddingCat(true)}>
          <Text style={{ color: colors.brand, paddingVertical: space[2] }}>+ New</Text>
        </Pressable>
      </View>
      {addingCat ? (
        <View style={{ flexDirection: 'row', gap: space[2], marginBottom: space[4] }}>
          <TextInput
            value={newCat}
            onChangeText={setNewCat}
            placeholder="Category name"
            style={{
              flex: 1,
              minHeight: 48,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.control,
              paddingHorizontal: space[3],
              backgroundColor: colors.surface,
            }}
          />
          <Pressable
            onPress={() => {
              const name = newCat.trim();
              if (!name) return;
              setCategories((prev) => [...prev, name]);
              setCategory(name);
              setNewCat('');
              setAddingCat(false);
            }}
            style={{
              minHeight: 48,
              paddingHorizontal: space[4],
              borderRadius: radius.control,
              backgroundColor: colors.brand,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
          </Pressable>
        </View>
      ) : null}
      <PrimaryButton
        label={type === 'expense' ? 'Save expense' : 'Save income'}
        onPress={async () => {
          const major = Number(amount || '0');
          const amountMinor = Math.round(major * 100);
          await queue.enqueueLocal({
            spaceId: 'space_local',
            type,
            amountMinor,
            currency: 'USD',
            description: category,
            idempotencyKey: createIdempotencyKey(),
          });
          router.back();
        }}
      />
    </SafeAreaView>
  );
}
