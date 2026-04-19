import React, { memo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Card } from '../ui/card';

interface NightGuideStep {
  id: string;
  title: string;
  call: string;
  notes: string;
}

interface NightGuideProps {
  steps: NightGuideStep[];
  currentNight: number;
  t: {
    nightGuide: string;
    night: string;
  };
}

const NightGuideComponent = ({ steps, currentNight, t }: NightGuideProps) => {
  return (
    <Card className="mt-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-base font-bold text-text">{t.nightGuide}</Text>
        <View className="bg-accent/10 border border-accent/20 rounded-full px-3 py-1">
          <Text className="text-xs font-bold text-accent">
            {t.night} {currentNight}
          </Text>
        </View>
      </View>

      <ScrollView className="max-h-80" showsVerticalScrollIndicator={false}>
        {steps.map((step, index) => (
          <View
            key={step.id}
            className={`py-3 ${index < steps.length - 1 ? 'border-b border-border' : ''}`}
          >
            <View className="flex-row items-start gap-3">
              <View className="bg-surface-muted border border-border rounded-full w-6 h-6 items-center justify-center">
                <Text className="text-xs font-bold text-text-muted">
                  {index + 1}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-text">
                  {step.title}
                </Text>
                <Text className="mt-1 text-sm text-text italic">
                  &quot;{step.call}&quot;
                </Text>
                <Text className="mt-1 text-xs text-text-muted leading-4">
                  {step.notes}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </Card>
  );
};

export const NightGuide = memo(NightGuideComponent);
NightGuide.displayName = 'NightGuide';
