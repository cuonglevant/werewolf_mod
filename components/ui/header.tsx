import { View, Text, Pressable } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  className?: string;
}

export function Header({ title, subtitle, action, className }: HeaderProps) {
  return (
    <View className={cn('mb-6', className)}>
      <View className="flex-row items-center justify-between">
        <Text className="text-3xl font-bold text-text">{title}</Text>
        {action && (
          <Pressable
            onPress={action.onPress}
            className="border border-border rounded-lg bg-surface px-3 py-1.5"
          >
            <Text className="text-xs font-bold text-text">
              {action.label}
            </Text>
          </Pressable>
        )}
      </View>
      {subtitle && (
        <Text className="mt-2 text-sm text-text-muted">{subtitle}</Text>
      )}
    </View>
  );
}
