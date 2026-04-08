import type { ErrorBoundaryProps } from 'expo-router';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider } from '@react-navigation/native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as React from 'react';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { Text } from '@/components/ui';
import { useThemeConfig } from '@/components/ui/use-theme-config';
import { useUserStore } from '@/features/profile/use-user-store';
import { configureLLM } from '@/lib/ai/llm-client';
import { APIProvider } from '@/lib/api';
import { db, expoDb } from '@/lib/db';
import { seedExercises } from '@/lib/db/seed';
import { loadSelectedTheme } from '@/lib/hooks/use-selected-theme';
import { loadSelectedLanguage } from '@/lib/i18n';
import { hydrateStorage } from '@/lib/storage';
import migrations from '../../drizzle/migrations';

import '../global.css';

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-charcoal-950 px-6">
      <Text className="mb-3 text-center text-xl font-bold text-white">
        Startup failed
      </Text>
      <Text className="mb-6 text-center text-sm text-charcoal-300">
        {error.message}
      </Text>
      <Pressable
        onPress={() => {
          void retry();
        }}
        className="rounded-xl bg-white px-4 py-3"
      >
        <Text className="font-semibold text-black">Retry</Text>
      </Pressable>
    </View>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const unstable_settings = {
  initialRouteName: '(app)',
};

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 500, fade: true });

// One-shot non-DB bootstrap (storage, theme, LLM)
let bootstrapped = false;
async function bootstrapNonDb() {
  if (bootstrapped)
    return;
  bootstrapped = true;
  await hydrateStorage();
  loadSelectedLanguage();
  loadSelectedTheme();
  const key = process.env.EXPO_PUBLIC_GROQ_KEY;
  if (key)
    configureLLM(key, process.env.EXPO_PUBLIC_GROQ_MODEL);
  else
    console.warn('[bootstrap] EXPO_PUBLIC_GROQ_KEY not set — coach LLM disabled, dashboard will fall back to rule engine');
}

export default function RootLayout() {
  const [bootReady, setBootReady] = React.useState(false);
  const { success: migrationsReady, error: migrationsError } = useMigrations(db, migrations);
  const [postInitReady, setPostInitReady] = React.useState(false);
  const loadUser = useUserStore(s => s.loadUser);

  useEffect(() => {
    bootstrapNonDb()
      .catch(err => console.error('bootstrapNonDb failed:', err))
      .finally(() => setBootReady(true));
  }, []);

  useEffect(() => {
    if (!migrationsReady)
      return;
    (async () => {
      try {
        await seedExercises(expoDb);
        await loadUser();
      }
      catch (err) {
        console.error('post-migration init failed:', err);
      }
      finally {
        setPostInitReady(true);
        SplashScreen.hideAsync();
      }
    })();
  }, [migrationsReady, loadUser]);

  if (migrationsError) {
    return (
      <View className="flex-1 items-center justify-center bg-charcoal-950 px-6">
        <Text className="mb-3 text-center text-xl font-bold text-white">
          Database error
        </Text>
        <Text className="text-center text-sm text-charcoal-300">
          {migrationsError.message}
        </Text>
      </View>
    );
  }

  if (!bootReady || !migrationsReady || !postInitReady)
    return null;

  return (
    <Providers>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(app)" />
      </Stack>
    </Providers>
  );
}

function Providers({ children }: { children: React.ReactNode }) {
  const theme = useThemeConfig();
  return (
    <GestureHandlerRootView
      style={styles.container}
      // eslint-disable-next-line better-tailwindcss/no-unknown-classes
      className={theme.dark ? 'dark' : undefined}
    >
      <KeyboardProvider>
        <ThemeProvider value={theme}>
          <APIProvider>
            <BottomSheetModalProvider>
              {children}
              <FlashMessage position="top" />
            </BottomSheetModalProvider>
          </APIProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
