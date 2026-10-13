'use client';

import { useId } from 'react';
import { haptic } from '@/hooks/useTelegram';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, label, description, disabled, className = '' }: SwitchProps) {
  const id = useId();

  const toggle = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        haptic.select();
        onChange(!checked);
      }}
      className={[
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-brand-500' : 'bg-hint/30',
      ].join(' ')}
    >
      <span
        className={[
          'inline-block size-6 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[22px]' : 'translate-x-0.5',
        ].join(' ')}
      />
    </button>
  );

  if (!label) return <span className={className}>{toggle}</span>;

  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <label htmlFor={id} className="flex flex-col">
        <span className="font-bold text-text">{label}</span>
        {description && <span className="text-sm text-hint">{description}</span>}
      </label>
      {toggle}
    </div>
  );
}
