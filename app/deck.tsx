import { router } from 'expo-router';
import {
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ROLE_DISPLAY_ORDER } from '@/src/game/roles';
import { getRoleLabel } from '@/src/i18n/roles';
import { uiText } from '@/src/i18n/ui';
import { useGame } from '@/src/state/game-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/ui/header';

export default function DeckScreen() {
  const { width } = useWindowDimensions();
  const isNarrowScreen = width < 390;

  const { generated, counts, deckList, language, toggleLanguage } = useGame();
  const t = uiText[language].deck;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        {generated ? (
          <>
            <Header
              title={t.title}
              subtitle={`${t.subtitlePrefix} ${deckList.length} ${t.subtitleSuffix}`}
              action={{
                label: uiText[language].langButton,
                onPress: toggleLanguage
              }}
            />

            <View className="flex-row flex-wrap justify-between mt-4">
              {ROLE_DISPLAY_ORDER.filter((role) => counts[role] > 0).map(
                (role) => (
                  <Card
                    key={role}
                    className={`mb-3 p-3.5 ${role === 'Werewolf' ? 'border-accent bg-accent/5' : ''}`}
                    style={{ width: isNarrowScreen ? width - 32 : (width - 40) / 2 }}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xl font-semibold text-text">
                        {getRoleLabel(language, role)}
                      </Text>
                      <View className="bg-surface-muted border border-border rounded-full px-3 py-1">
                        <Text className="text-base font-bold text-text">
                          {counts[role]}x
                        </Text>
                      </View>
                    </View>
                  </Card>
                ),
              )}
            </View>
          </>
        ) : (
          <View className="items-center justify-center py-16">
            <Text className="text-center text-base text-text-muted">{t.noDeck}</Text>
            <Button
              label={t.back}
              onPress={() => router.replace('/')}
              className="mt-5"
            />
          </View>
        )}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-surface p-4 pb-8">
        <Button
          label={t.start}
          disabled={!generated}
          onPress={() => {
            if (generated) {
              router.push('/tracker');
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}
