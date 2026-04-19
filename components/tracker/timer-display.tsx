import React, { memo } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Card } from '../ui/card';

interface TimerDisplayProps {
  label: string;
  remaining: number;
  isRunning: boolean;
  onToggle: () => void;
  onReset: () => void;
  onDurationChange: (value: string) => void;
  onApplyDuration: () => void;
  durationInput: string;
  formatSeconds: (s: number) => string;
  t: {
    set: string;
    pause: string;
    start: string;
    reset: string;
  };
}

const TimerDisplayComponent = ({
  label,
  remaining,
  isRunning,
  onToggle,
  onReset,
  onDurationChange,
  onApplyDuration,
  durationInput,
  formatSeconds,
  t,
}: TimerDisplayProps) => {
  return (
    <Card className="mb-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-base font-bold text-text">{label}</Text>
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-text-muted">{t.set}:</Text>
          <TextInput
            keyboardType="number-pad"
            value={durationInput}
            onChangeText={onDurationChange}
            className="bg-surface-muted border border-border rounded-lg px-2 py-1 text-sm w-12 text-center text-text"
            maxLength={3}
          />
          <Pressable
            onPress={onApplyDuration}
            className="bg-surface border border-border rounded-lg px-3 py-1"
          >
            <Text className="text-xs font-bold text-text">{t.set}</Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-row items-center justify-between bg-surface-muted border border-border rounded-xl p-4">
        <Text
          className={`text-4xl font-mono font-bold ${remaining < 10 ? 'text-accent' : 'text-text'}`}
        >
          {formatSeconds(remaining)}
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            onPress={onReset}
            className="bg-surface border border-border rounded-lg px-4 py-2"
          >
            <Text className="text-sm font-bold text-text">{t.reset}</Text>
          </Pressable>
          <Pressable
            onPress={onToggle}
            className={`rounded-lg px-6 py-2 ${isRunning ? 'bg-accent/10 border border-accent' : 'bg-accent border border-accent'}`}
          >
            <Text
              className={`text-sm font-bold ${isRunning ? 'text-accent' : 'text-white'}`}
            >
              {isRunning ? t.pause : t.start}
            </Text>
          </Pressable>
        </View>
      </View>
    </Card>
  );
};

export const TimerDisplay = memo(TimerDisplayComponent);
TimerDisplay.displayName = 'TimerDisplay';
