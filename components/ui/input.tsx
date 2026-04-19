import { TextInput, View, Text, type TextInputProps } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface InputProps extends TextInputProps {
  label?: string;
  className?: string;
  containerClassName?: string;
}

export function Input({
  label,
  className,
  containerClassName,
  ...props
}: InputProps) {
  return (
    <View className={cn('gap-2', containerClassName)}>
      {label && (
        <Text className="text-sm font-bold text-text">
          {label}
        </Text>
      )}
      <TextInput
        className={cn(
          'bg-surface-muted border border-border rounded-xl px-4 py-3 text-lg font-semibold text-text',
          className
        )}
        placeholderTextColor="#9AA0B5"
        {...props}
      />
    </View>
  );
}
