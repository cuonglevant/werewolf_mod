import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ROLE_SHORT_DESCRIPTIONS, SPECIAL_ROLES } from '@/src/game/roles';
import { getRoleLabel, SPECIAL_ROLE_DESCRIPTIONS_VI } from '@/src/i18n/roles';
import { uiText } from '@/src/i18n/ui';
import { useGame } from '@/src/state/game-context';

const COLORS = {
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  surfaceMuted: '#F8FAFF',
  border: '#D6DCEB',
  text: '#1D2433',
  textMuted: '#667089',
  accent: '#B63A30',
  disabled: '#C8D0E0',
};

export default function SetupScreen() {
  const { width } = useWindowDimensions();
  const isNarrowScreen = width < 390;
  const gridItemWidth = isNarrowScreen ? '100%' : '48%';

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
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t.title}</Text>
          <Pressable style={styles.langButton} onPress={toggleLanguage}>
            <Text style={styles.langButtonText}>
              {uiText[language].langButton}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>{t.subtitle}</Text>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t.playerCount}</Text>
          <TextInput
            keyboardType="number-pad"
            value={playerCountInput}
            onChangeText={setPlayerCountInput}
            onEndEditing={commitPlayerCountInput}
            onBlur={commitPlayerCountInput}
            placeholder={language === 'vi' ? 'vd: 8' : 'e.g. 8'}
            placeholderTextColor="#9AA0B5"
            style={styles.input}
            maxLength={2}
          />

          <Text style={styles.inlineLabel}>{t.werewolfCount}</Text>
          <TextInput
            keyboardType="number-pad"
            value={werewolfCountInput}
            onChangeText={(value) => {
              setWerewolfCountInput(value);

              const parsed = Number.parseInt(value, 10);
              if (Number.isNaN(parsed)) {
                return;
              }

              setWerewolfCount(parsed);
            }}
            placeholder={language === 'vi' ? 'vd: 2' : 'e.g. 2'}
            placeholderTextColor="#687089"
            style={styles.input}
            maxLength={2}
          />

          <View style={styles.suggestionCard}>
            <Text style={styles.suggestionLabel}>{t.suggested}</Text>
            <Text style={styles.suggestionValue}>{suggestedWerewolfCount}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t.playerNames}</Text>
          <Text style={styles.sectionSubtitle}>{t.playerNamesHint}</Text>

          <View style={styles.gridContainer}>
            {playerNames.map((name, index) => (
              <TextInput
                key={`player-name-${index + 1}`}
                value={name}
                onChangeText={(value) => updatePlayerName(index, value)}
                onFocus={() => clearDefaultPlayerNameOnFocus(index)}
                placeholder={`${t.playerPlaceholderPrefix} ${index + 1}`}
                placeholderTextColor="#687089"
                style={[styles.gridInput, { width: gridItemWidth }]}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>{t.roleToggles}</Text>
          <Text style={styles.sectionSubtitle}>
            {t.selected}: {selectedCount} / {t.max}: {maxSpecialRoles}
          </Text>

          <View style={styles.gridContainer}>
            {SPECIAL_ROLES.map((role) => (
              <View
                key={role}
                style={[styles.roleCard, { width: gridItemWidth }]}
              >
                <View style={styles.roleHeaderRow}>
                  <View style={styles.roleTextWrap}>
                    <Text style={styles.roleName}>
                      {getRoleLabel(language, role)}
                    </Text>
                    <Text style={styles.roleDescription}>
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
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={!canGenerate}
          onPress={handleGenerate}
          style={[
            styles.startButton,
            canGenerate
              ? styles.startButtonEnabled
              : styles.startButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.startButtonText,
              canGenerate
                ? styles.startButtonTextEnabled
                : styles.startButtonTextDisabled,
            ]}
          >
            {t.start}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  langButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  langButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  sectionCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  inlineLabel: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  suggestionCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  suggestionValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.accent,
  },
  gridContainer: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridInput: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  roleCard: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  roleTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  roleName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  roleDescription: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  startButton: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 16,
  },
  startButtonEnabled: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  startButtonDisabled: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.disabled,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  startButtonTextEnabled: {
    color: '#FFFFFF',
  },
  startButtonTextDisabled: {
    color: COLORS.text,
  },
});
