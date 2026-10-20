import Env from 'env';
import { useRouter } from 'expo-router';
import { useUniwind } from 'uniwind';

import {
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { translate } from '@/lib/i18n';
import { useNotionConnection } from '@/lib/notion/notion-connection';
import { LanguageItem } from './components/language-item';
import { SettingsContainer } from './components/settings-container';
import { SettingsItem } from './components/settings-item';
import { ThemeItem } from './components/theme-item';

export function SettingsScreen() {
  const router = useRouter();
  // theme is unused now that we hide icon-only placeholder rows
  useUniwind();
  const notion = useNotionConnection();
  return (
    <>
      <FocusAwareStatusBar />

      <ScrollView>
        <View className="flex-1 px-4 pt-16">
          <Text className="text-xl font-bold">
            {translate('settings.title')}
          </Text>
          <SettingsContainer title="settings.generale">
            <SettingsItem
              text="Profile"
              onPress={() => router.push('/(app)/profile')}
            />
            <SettingsItem
              text="Notion meal log"
              value={notion ? 'Connected' : 'Off'}
              onPress={() => router.push('/(app)/notion')}
            />
            <LanguageItem />
            <ThemeItem />
          </SettingsContainer>

          <SettingsContainer title="settings.about">
            <SettingsItem
              text="settings.app_name"
              value={Env.EXPO_PUBLIC_NAME}
            />
            <SettingsItem
              text="settings.version"
              value={Env.EXPO_PUBLIC_VERSION}
            />
          </SettingsContainer>

        </View>
      </ScrollView>
    </>
  );
}
