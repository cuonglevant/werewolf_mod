import { View, type ViewProps } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CardProps extends ViewProps {
  className?: string;
}

export function Card({ style, className, ...props }: CardProps) {
  return (
    <View
      className={cn(
        'bg-surface border border-border rounded-2xl p-4',
        className
      )}
      style={style}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return <View className={cn('mb-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ViewProps & { className?: string }) {
  return (
    <View className={cn('flex-row items-center justify-between', className)} {...props} />
  );
}
