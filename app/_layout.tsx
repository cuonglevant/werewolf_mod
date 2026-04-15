import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { GameProvider } from '@/src/state/game-context';

const screenOptions = {
  headerStyle: {
    backgroundColor: '#131522',
  },
  headerTintColor: '#DCE1F1',
  headerTitleStyle: {
    fontWeight: '700' as const,
  },
  contentStyle: {
    backgroundColor: '#FFFFFF',
  },
};

export default function RootLayout() {
  return (
    <GameProvider>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="index" options={{ title: 'Werewolf Moderator' }} />
        <Stack.Screen name="deck" options={{ title: 'Deck Preparation' }} />
        <Stack.Screen name="tracker" options={{ title: 'Moderator Tracker' }} />
      </Stack>
      <StatusBar style="light" />
    </GameProvider>
  );
}
