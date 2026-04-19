import { clsx, type ClassValue } from 'clsx';
import { Pressable, Text, type PressableProps } from 'react-native';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends PressableProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  className?: string;
  labelClassName?: string;
}

export function Button({
  label,
  variant = 'primary',
  className,
  labelClassName,
  disabled,
  ...props
}: Readonly<ButtonProps>) {
  const variants = {
    primary: 'bg-accent border-accent',
    secondary: 'bg-surface-muted border-border',
    outline: 'bg-transparent border-accent',
    ghost: 'bg-transparent border-transparent',
  };

  const textVariants = {
    primary: 'text-white',
    secondary: 'text-text',
    outline: 'text-accent',
    ghost: 'text-text-muted',
  };

  return (
    <Pressable
      className={cn(
        'items-center justify-center rounded-xl border py-4 px-6',
        variants[variant],
        disabled && 'bg-disabled border-border opacity-70',
        className,
      )}
      disabled={disabled}
      {...props}
    >
      <Text
        className={cn(
          'text-base font-bold',
          textVariants[variant],
          disabled && 'text-text-muted',
          labelClassName,
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}
