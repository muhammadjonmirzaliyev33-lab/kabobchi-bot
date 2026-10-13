'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, rightSlot, className = '', id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="px-1 text-sm font-bold text-hint">
          {label}
        </label>
      )}
      <div
        className={[
          'flex h-12 items-center gap-2 rounded-2xl border-2 bg-bg-secondary px-4 transition',
          'focus-within:border-brand-500 focus-within:bg-bg',
          error ? 'border-red-500' : 'border-transparent',
        ].join(' ')}
      >
        {leftIcon && <span className="text-hint">{leftIcon}</span>}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={`h-full w-full bg-transparent text-base font-semibold text-text outline-none placeholder:text-hint/70 ${className}`}
          {...props}
        />
        {rightSlot}
      </div>
      {(error || hint) && (
        <p className={`px-1 text-xs font-semibold ${error ? 'text-red-500' : 'text-hint'}`}>{error || hint}</p>
      )}
    </div>
  );
});
