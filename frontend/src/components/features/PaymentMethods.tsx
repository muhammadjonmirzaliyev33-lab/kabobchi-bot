'use client';

import { useEffect, useMemo, useState } from 'react';
import { haptic } from '@/hooks/useTelegram';
import { getPaymentMethods, type PaymentMethod, type PaymentMethodInfo } from '@/lib/api';
import { cn } from '@/lib/utils';

/* =====================================================================
 * To'lov turlari (Checkout):
 *   ⭐ Telegram Stars  ·  💳 Click / Payme  ·  💵 Naqd pul
 * Faqat admin yoqib qo'ygan turlar ko'rsatiladi (GET /payment-methods).
 * ===================================================================== */
type OptionId = 'stars' | 'cards' | 'cash';

const OPTIONS: Record<OptionId, { icon: string; title: string; subtitle: string; methods: PaymentMethod[] }> = {
  stars: { icon: '⭐', title: 'Telegram Stars', subtitle: 'Telegram ichida tezkor to‘lov', methods: ['stars'] },
  cards: { icon: '💳', title: 'Click / Payme', subtitle: 'O‘zbekiston kartalari: Uzcard, Humo', methods: ['click', 'payme'] },
  cash: { icon: '💵', title: 'Naqd pul', subtitle: 'Kuryerga yetkazilganda to‘laysiz', methods: ['cash'] },
};

const optionOf = (m: PaymentMethod): OptionId => (m === 'click' || m === 'payme' ? 'cards' : m);

interface PaymentMethodsProps {
  value: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
  /** Stars summasini ko'rsatish uchun (so'mda) */
  total: number;
}

export function PaymentMethods({ value, onChange, total }: PaymentMethodsProps) {
  const [methods, setMethods] = useState<PaymentMethodInfo[] | null>(null);
  const [somPerStar, setSomPerStar] = useState(200);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    getPaymentMethods()
      .then((res) => {
        setMethods(res.methods);
        setSomPerStar(res.somPerStar);
      })
      .catch((err: Error) => setError(err.message));
  };
  useEffect(load, []);

  const enabled = useMemo(() => new Set((methods ?? []).map((m) => m.method)), [methods]);
  const options = (Object.keys(OPTIONS) as OptionId[]).filter((id) => OPTIONS[id].methods.some((m) => enabled.has(m)));

  // Tanlangan tur o'chirib qo'yilgan bo'lsa yoki hali tanlanmagan bo'lsa: birinchi mavjudini tanlash
  useEffect(() => {
    if (!methods || (value && enabled.has(value))) return;
    const first = methods[0]?.method;
    if (first) onChange(first);
  }, [methods, value, enabled, onChange]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl bg-bg-secondary p-4 text-center">
        <p className="text-sm font-bold text-red-500">{error}</p>
        <button type="button" onClick={load} className="text-sm font-extrabold text-brand-600">
          Qayta urinish
        </button>
      </div>
    );
  }

  if (!methods) {
    return (
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-3xl bg-bg-secondary" />
        ))}
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <p className="rounded-3xl bg-bg-secondary p-4 text-center text-sm font-bold text-hint">
        Hozircha to‘lov turlari mavjud emas. Keyinroq urinib ko‘ring.
      </p>
    );
  }

  const selectedOption = value ? optionOf(value) : null;

  return (
    <div role="radiogroup" aria-label="To‘lov turi" className="flex flex-col gap-2.5">
      {options.map((id) => {
        const opt = OPTIONS[id];
        const active = selectedOption === id;
        const available = opt.methods.filter((m) => enabled.has(m));
        const stars = Math.max(1, Math.ceil(total / somPerStar));

        return (
          <div
            key={id}
            className={cn(
              'rounded-3xl border-2 transition-colors',
              active ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-transparent bg-bg-secondary'
            )}
          >
            <button
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                if (active) return;
                haptic.select();
                onChange(available[0]);
              }}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-bg text-2xl">{opt.icon}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-black">{opt.title}</span>
                <span className="text-xs font-semibold text-hint">
                  {id === 'stars' && total > 0 ? `≈ ${stars.toLocaleString('en-US')} ⭐ · ${opt.subtitle}` : opt.subtitle}
                </span>
              </span>
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition',
                  active ? 'border-brand-500 bg-brand-500' : 'border-hint/40'
                )}
              >
                {active && <span className="size-2.5 rounded-full bg-white" />}
              </span>
            </button>

            {/* Click yoki Payme: ikkalasi ham yoqilgan bo'lsa tanlash */}
            {id === 'cards' && active && available.length > 1 && (
              <div className="flex gap-2 px-4 pb-4">
                {available.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      if (m === value) return;
                      haptic.select();
                      onChange(m);
                    }}
                    className={cn(
                      'h-10 flex-1 rounded-2xl text-sm font-black transition active:scale-95',
                      m === value ? 'bg-brand-500 text-white' : 'bg-bg text-hint'
                    )}
                  >
                    {m === 'click' ? 'Click' : 'Payme'}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PaymentMethods;
