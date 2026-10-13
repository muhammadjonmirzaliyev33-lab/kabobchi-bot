import type { HTMLAttributes } from 'react';

type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  /** Kichik qizil hisoblagich (savatcha soni kabi) */
  dot?: boolean;
}

const tones: Record<Tone, string> = {
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  danger: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  neutral: 'bg-bg-secondary text-hint',
};

export function Badge({ tone = 'brand', dot, className = '', children, ...props }: BadgeProps) {
  if (dot) {
    return (
      <span
        className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[11px] leading-none font-extrabold text-white ring-2 ring-bg ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${tones[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
