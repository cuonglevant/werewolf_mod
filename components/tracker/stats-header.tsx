import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

interface StatsHeaderProps {
  aliveCount: number;
  deadCount: number;
  onToggleLanguage: () => void;
  language: 'en' | 'vi';
  t: {
    alive: string;
    dead: string;
    langButton: string;
  };
}

const StatsHeaderComponent = ({
  aliveCount,
  deadCount,
  onToggleLanguage,
  language,
  t,
}: StatsHeaderProps) => {
  return (
    <View className="flex-row border-b border-border bg-surface px-4 py-3.5">
      <View className="flex-1 items-center">
        <Text className="text-[10px] text-text-muted uppercase tracking-wider">
          {t.alive}
        </Text>
        <Text className="mt-1 text-2xl font-bold text-[#6E9D6A]">
          {aliveCount}
        </Text>
      </View>
      <View className="flex-1 items-center">
        <Text className="text-[10px] text-text-muted uppercase tracking-wider">
          {t.dead}
        </Text>
        <Text className="mt-1 text-2xl font-bold text-accent">{deadCount}</Text>
      </View>
      <Pressable
        className="border border-border rounded-lg bg-surface-muted px-2.5 py-1.5 self-center"
        onPress={onToggleLanguage}
      >
        <Text className="text-text text-xs font-bold uppercase">
          {t.langButton}
        </Text>
      </Pressable>
    </View>
  );
};

export const StatsHeader = memo(StatsHeaderComponent);
StatsHeader.displayName = 'StatsHeader';
