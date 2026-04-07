import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider } from '@react-navigation/native';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as React from 'react';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { useThemeConfig } from '@/components/ui/use-theme-config';
import { useBodyStore } from '@/features/body/use-body-store';
import { useUserStore } from '@/features/profile/use-user-store';
import { useWorkoutStore } from '@/features/workouts/use-workout-store';
import { configureLLM } from '@/lib/ai/llm-client';
import { APIProvider } from '@/lib/api';
import { migrate } from '@/lib/db/database';
import { seedExercises } from '@/lib/db/seed';
import { loadSelectedTheme } from '@/lib/hooks/use-selected-theme';
import { hydrateStorage } from '@/lib/storage';

import '../global.css';

export { ErrorBoundary } from 'expo-router';

// eslint-disable-next-line react-refresh/only-export-components
export const unstable_settings = {
  initialRouteName: '(app)',
};

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 500, fade: true });

// One-shot non-DB bootstrap (storage, theme, LLM)
let bootstrapped = false;
async function bootstrapNonDb() {
  if (bootstrapped) return;
  bootstrapped = true;
  await hydrateStorage();
  loadSelectedTheme();
  const key = process.env.EXPO_PUBLIC_OPENROUTER_KEY;
  if (key) configureLLM(key, 'qwen/qwen3.6-plus:free');
}

export default function RootLayout() {
  useEffect(() => {
    void bootstrapNonDb();
  }, []);

  return (
    <SQLiteProvider
      databaseName="gym.db"
      onInit={async (db) => {
        await migrate(db);
        await seedExercises(db);
      }}
      onError={(err) => {
        console.error('SQLiteProvider failed to open db:', err);
        SplashScreen.hideAsync();
      }}
      useSuspense
    >
      <DbBridge>
        <Providers>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(app)" />
          </Stack>
        </Providers>
      </DbBridge>
    </SQLiteProvider>
  );
}

// Pushes the live SQLite handle into Zustand stores. Re-runs on every
// SQLiteProvider mount, so a fresh handle replaces any stale one after
// Fast Refresh / Activity recreate.
function DbBridge({ children }: { children: React.ReactNode }) {
  const db = useSQLiteContext();
  const setUserDb = useUserStore(s => s.setDb);
  const setBodyDb = useBodyStore(s => s.setDb);
  const setWorkoutDb = useWorkoutStore(s => s.setDb);
  const loadUser = useUserStore(s => s.loadUser);
  const [ready, setReady] = React.useState(false);

  useEffect(() => {
    setUserDb(db);
    setBodyDb(db);
    setWorkoutDb(db);
    loadUser()
      .catch(err => console.error('loadUser failed:', err))
      .finally(() => {
        setReady(true);
        SplashScreen.hideAsync();
      });
  }, [db, setUserDb, setBodyDb, setWorkoutDb, loadUser]);

  if (!ready) return null;
  return <>{children}</>;
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
