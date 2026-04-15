import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ROLE_DISPLAY_ORDER } from '@/src/game/roles';
import { getRoleLabel } from '@/src/i18n/roles';
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
  accentSoft: '#FBEDEC',
  disabled: '#C8D0E0',
};

export default function DeckScreen() {
  const { width } = useWindowDimensions();
  const isNarrowScreen = width < 390;
  const gridItemWidth = isNarrowScreen ? '100%' : '48%';

  const { generated, counts, deckList, language, toggleLanguage } = useGame();
  const t = uiText[language].deck;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {generated ? (
          <>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{t.title}</Text>
              <Pressable style={styles.langButton} onPress={toggleLanguage}>
                <Text style={styles.langButtonText}>
                  {uiText[language].langButton}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.subtitle}>
              {t.subtitlePrefix} {deckList.length} {t.subtitleSuffix}
            </Text>

            <View style={styles.gridContainer}>
              {ROLE_DISPLAY_ORDER.filter((role) => counts[role] > 0).map(
                (role) => (
                  <View
                    key={role}
                    style={[
                      styles.roleCard,
                      role === 'Werewolf'
                        ? styles.roleCardWerewolf
                        : styles.roleCardDefault,
                      { width: gridItemWidth },
                    ]}
                  >
                    <View style={styles.roleHeaderRow}>
                      <Text style={styles.roleName}>
                        {getRoleLabel(language, role)}
                      </Text>
                      <View style={styles.roleCountBadge}>
                        <Text style={styles.roleCountText}>
                          {counts[role]}x
                        </Text>
                      </View>
                    </View>
                  </View>
                ),
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyStateWrap}>
            <Text style={styles.emptyStateText}>{t.noDeck}</Text>
            <Pressable
              style={styles.backButton}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.backButtonText}>{t.back}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={!generated}
          style={[
            styles.startButton,
            generated ? styles.startButtonEnabled : styles.startButtonDisabled,
          ]}
          onPress={() => {
            if (generated) {
              router.push('/tracker');
            }
          }}
        >
          <Text
            style={[
              styles.startButtonText,
              generated
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
  gridContainer: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  roleCard: {
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    padding: 14,
  },
  roleCardDefault: {
    borderColor: COLORS.border,
  },
  roleCardWerewolf: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roleName: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.text,
  },
  roleCountBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  roleCountText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyStateWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    textAlign: 'center',
    fontSize: 16,
    color: COLORS.textMuted,
  },
  backButton: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
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
