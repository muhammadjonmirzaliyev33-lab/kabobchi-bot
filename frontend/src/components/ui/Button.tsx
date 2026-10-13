'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { haptic } from '@/hooks/useTelegram';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  /** Bosilganda tebranish (default: true) */
  withHaptic?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-brand-500 to-accent text-white shadow-lg shadow-brand-500/30 hover:brightness-105',
  secondary: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  ghost: 'bg-transparent text-text hover:bg-bg-secondary',
  outline: 'border-2 border-brand-500 text-brand-600 bg-transparent',
  danger: 'bg-red-500 text-white shadow-lg shadow-red-500/25',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-xl gap-1.5',
  md: 'h-11 px-4 text-base rounded-2xl gap-2',
  lg: 'h-13 px-6 text-lg rounded-2xl gap-2',
  xl: 'h-16 px-8 text-xl rounded-3xl gap-3 tracking-wide',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth,
    loading,
    leftIcon,
    rightIcon,
    withHaptic = true,
    className = '',
    disabled,
    onClick,
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      onClick={(e) => {
        if (withHaptic) haptic.impact('light');
        onClick?.(e);
      }}
      className={[
        'inline-flex select-none items-center justify-center font-extrabold transition active:scale-[0.97]',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? (
        <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
