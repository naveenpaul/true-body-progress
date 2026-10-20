import { useRouter } from 'expo-router';
import * as React from 'react';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { expoDb } from '@/lib/db';
import * as nutritionRepo from '@/lib/db/nutrition-repo';
import { MEAL_COLUMNS } from '@/lib/notion/notion-client';
import {
  clearNotionConnection,
  parseDatabaseId,
  saveNotionConnection,
  useNotionConnection,
  verifyNotionConnection,
} from '@/lib/notion/notion-connection';

const INTEGRATIONS_URL = 'https://www.notion.so/my-integrations';

export function NotionConnectScreen() {
  const router = useRouter();
  const connection = useNotionConnection();
  const [token, setToken] = useState('');
  const [link, setLink] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    const databaseId = parseDatabaseId(link);
    if (!databaseId) {
      setError('Paste the link to your meals database (it ends in a long id).');
      return;
    }
    setError(null);
    setChecking(true);
    const candidate = { token: token.trim(), databaseId };
    const result = await verifyNotionConnection(candidate);
    setChecking(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await saveNotionConnection({ ...candidate, title: result.title });
    setToken('');
    setLink('');
    const missing = result.missingColumns.length > 0
      ? `\n\nNo ${result.missingColumns.map(c => `"${c}"`).join(', ')} column found, so those meals are skipped.`
      : '';
    Alert.alert('Notion connected', `Meals from "${result.title}" will sync on the Nutrition tab.${missing}`);
  };

  const disconnect = () => {
    Alert.alert('Disconnect Notion?', 'Meals already synced can stay in the app or be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Keep meals', onPress: () => clearNotionConnection() },
      {
        text: 'Remove meals',
        style: 'destructive',
        onPress: async () => {
          await clearNotionConnection();
          await nutritionRepo.deleteNotionMeals(expoDb);
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-ink-base" contentContainerClassName="p-4 pb-10 pt-14" keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} hitSlop={8} className="mb-4">
        <Text className="text-sm text-ink-muted">‹ Settings</Text>
      </Pressable>
      <Text className="mb-2 text-2xl font-bold text-ink-text">Notion meal log</Text>
      <Text className="mb-6 text-sm text-ink-muted">
        Log meals in a Notion table and the app estimates their macros. Optional: without it, add meals by hand on the Nutrition tab.
      </Text>

      {connection
        ? (
            <View className="rounded-2xl border border-ink-hairline bg-ink-card p-4">
              <Text className="text-xs font-bold text-success-500 uppercase" style={{ letterSpacing: 0.8 }}>Connected</Text>
              <Text className="mt-1 text-base font-semibold text-ink-text">{connection.title ?? 'Notion database'}</Text>
              <Text className="mt-1 mb-4 text-sm text-ink-muted">Syncs when you open the Nutrition tab or pull down on it.</Text>
              <Button
                label="Disconnect"
                variant="outline"
                onPress={disconnect}
                className="border-danger-400"
                textClassName="text-danger-400"
              />
            </View>
          )
        : (
            <>
              <Step n={1}>
                <Text className="text-sm text-ink-text">
                  {'Create an integration at '}
                  <Text className="text-sm text-success-500" onPress={() => Linking.openURL(INTEGRATIONS_URL)}>notion.so/my-integrations</Text>
                  {' and copy its secret.'}
                </Text>
              </Step>
              <Step n={2}>
                <Text className="text-sm text-ink-text">In Notion, open your meals table → ••• → Connections → add that integration.</Text>
              </Step>
              <Step n={3}>
                <Text className="text-sm text-ink-text">
                  {`The table needs a "Date" column and text columns named ${MEAL_COLUMNS.map(c => `"${c}"`).join(', ')}. Copy the table's link (••• → Copy link).`}
                </Text>
              </Step>

              <Text className="mt-2 mb-1 text-sm text-ink-muted">Integration secret</Text>
              <TextInput
                value={token}
                onChangeText={setToken}
                placeholder="ntn_…"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                className="mb-4 rounded-xl border border-ink-hairline bg-ink-card px-4 py-3 text-base text-ink-text"
                placeholderTextColor="#71717A"
              />
              <Text className="mb-1 text-sm text-ink-muted">Meals table link</Text>
              <TextInput
                value={link}
                onChangeText={setLink}
                placeholder="https://www.notion.so/…"
                autoCapitalize="none"
                autoCorrect={false}
                className="mb-4 rounded-xl border border-ink-hairline bg-ink-card px-4 py-3 text-base text-ink-text"
                placeholderTextColor="#71717A"
              />

              {error && <Text className="mb-3 text-sm text-danger-400">{error}</Text>}

              <Button
                label={checking ? 'Checking…' : 'Connect'}
                onPress={connect}
                disabled={checking || !token.trim() || !link.trim()}
                className="bg-success-500"
                textClassName="font-bold text-black"
              />
              <Text className="mt-3 text-xs text-ink-faint">The secret is stored encrypted on this phone only and is used to read that table.</Text>
            </>
          )}
    </ScrollView>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View className="mb-3 flex-row gap-3">
      <Text className="w-5 text-sm font-bold text-success-500">{`${n}.`}</Text>
      <View className="flex-1">{children}</View>
    </View>
  );
}
