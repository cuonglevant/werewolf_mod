import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ROLE_SHORT_DESCRIPTIONS, SPECIAL_ROLES } from '@/src/game/roles';
import { getRoleLabel, SPECIAL_ROLE_DESCRIPTIONS_VI } from '@/src/i18n/roles';
import { uiText } from '@/src/i18n/ui';
import { useGame } from '@/src/state/game-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/ui/header';
import { Input } from '@/components/ui/input';

export default function SetupScreen() {
  const { width } = useWindowDimensions();
  const isNarrowScreen = width < 390;

  const {
    playerCount,
    playerNames,
    selectedRoles,
    setPlayerCount,
    setPlayerNames,
    setWerewolfCount,
    toggleRole,
    generateGame,
    canGenerate,
    werewolfCount,
    suggestedWerewolfCount,
    language,
    toggleLanguage,
  } = useGame();

  const t = uiText[language].setup;
  const [playerCountInput, setPlayerCountInput] = useState(String(playerCount));
  const [werewolfCountInput, setWerewolfCountInput] = useState(
    String(werewolfCount),
  );

  useEffect(() => {
    setPlayerCountInput(String(playerCount));
  }, [playerCount]);

  useEffect(() => {
    setWerewolfCountInput(String(werewolfCount));
  }, [werewolfCount]);

  const selectedCount = SPECIAL_ROLES.filter(
    (role) => selectedRoles[role],
  ).length;
  const maxSpecialRoles = Math.max(0, playerCount - werewolfCount);

  const updatePlayerName = (index: number, name: string) => {
    setPlayerNames(
      playerNames.map((currentName, currentIndex) =>
        currentIndex === index ? name : currentName,
      ),
    );
  };

  const clearDefaultPlayerNameOnFocus = (index: number) => {
    const currentName = playerNames[index]?.trim() ?? '';
    if (!/^Player\s+\d+$/i.test(currentName)) {
      return;
    }

    updatePlayerName(index, '');
  };

  const commitPlayerCountInput = () => {
    const parsed = Number.parseInt(playerCountInput, 10);

    if (Number.isNaN(parsed)) {
      setPlayerCountInput(String(playerCount));
      return;
    }

    setPlayerCount(parsed);
  };

  const handleGenerate = () => {
    if (playerCount < 3) {
      Alert.alert(t.invalidPlayerTitle, t.invalidPlayerBody);
      return;
    }

    if (werewolfCount < 1 || werewolfCount >= playerCount) {
      Alert.alert(
        t.invalidWolfTitle,
        `${t.invalidWolfBodyPrefix} ${Math.max(1, playerCount - 1)} ${t.invalidWolfBodyMiddle} ${playerCount} ${t.invalidWolfBodySuffix}`,
      );
      return;
    }

    if (!canGenerate) {
      Alert.alert(
        t.roleLimitTitle,
        `${t.roleLimitBodyPrefix} ${playerCount} ${t.roleLimitBodyMiddle} ${werewolfCount} ${t.roleLimitBodyMiddle2} ${maxSpecialRoles} ${t.roleLimitBodySuffix}`,
      );
      return;
    }

    generateGame();
    router.push('/deck');
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        <Header
          title={t.title}
          subtitle={t.subtitle}
          action={{
            label: uiText[language].langButton,
            onPress: toggleLanguage,
          }}
        />

        <Card className="gap-4">
          <Input
            label={t.playerCount}
            keyboardType="number-pad"
            value={playerCountInput}
            onChangeText={setPlayerCountInput}
            onEndEditing={commitPlayerCountInput}
            onBlur={commitPlayerCountInput}
            placeholder={language === 'vi' ? 'vd: 8' : 'e.g. 8'}
            maxLength={2}
          />

          <Input
            label={t.werewolfCount}
            keyboardType="number-pad"
            value={werewolfCountInput}
            onChangeText={(value) => {
              setWerewolfCountInput(value);
              const parsed = Number.parseInt(value, 10);
              if (!Number.isNaN(parsed)) {
                setWerewolfCount(parsed);
              }
            }}
            placeholder={language === 'vi' ? 'vd: 2' : 'e.g. 2'}
            maxLength={2}
          />

          <View className="bg-surface-muted border border-border rounded-xl px-4 py-3">
            <Text className="text-xs text-text-muted">{t.suggested}</Text>
            <Text className="mt-1 text-lg font-bold text-accent">
              {suggestedWerewolfCount}
            </Text>
          </View>
        </Card>

        <Card className="mt-4">
          <Text className="text-base font-bold text-text">{t.playerNames}</Text>
          <Text className="mt-1 text-[13px] text-text-muted mb-3">
            {t.playerNamesHint}
          </Text>

          <View className="flex-row flex-wrap justify-between">
            {playerNames.map((name, index) => (
              <Input
                key={`player-name-${index + 1}`}
                value={name}
                onChangeText={(value) => updatePlayerName(index, value)}
                onFocus={() => clearDefaultPlayerNameOnFocus(index)}
                placeholder={`${t.playerPlaceholderPrefix} ${index + 1}`}
                containerClassName="mb-2"
                style={{
                  width: isNarrowScreen ? width - 64 : (width - 64) / 2 - 4,
                }}
              />
            ))}
          </View>
        </Card>

        <Card className="mt-4">
          <Text className="text-base font-bold text-text">{t.roleToggles}</Text>
          <Text className="mt-1 text-[13px] text-text-muted mb-3">
            {t.selected}: {selectedCount} / {t.max}: {maxSpecialRoles}
          </Text>

          <View className="flex-row flex-wrap justify-between">
            {SPECIAL_ROLES.map((role) => (
              <View
                key={role}
                className="bg-surface-muted border border-border rounded-xl p-3 mb-2"
                style={{
                  width: isNarrowScreen ? width - 64 : (width - 64) / 2 - 4,
                }}
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-bold text-text">
                      {getRoleLabel(language, role)}
                    </Text>
                    <Text className="mt-1 text-xs text-text-muted leading-4">
                      {language === 'vi'
                        ? SPECIAL_ROLE_DESCRIPTIONS_VI[role]
                        : ROLE_SHORT_DESCRIPTIONS[role]}
                    </Text>
                  </View>
                  <Switch
                    value={selectedRoles[role]}
                    onValueChange={() => toggleRole(role)}
                    trackColor={{ false: '#3A425B', true: '#C4473A' }}
                    thumbColor="#F4F6FB"
                  />
                </View>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-surface p-4 pb-8">
        <Button
          label={t.start}
          disabled={!canGenerate}
          onPress={handleGenerate}
        />
      </View>
    </SafeAreaView>
  );
}
