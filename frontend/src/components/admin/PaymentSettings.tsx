'use client';

import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui';
import { haptic } from '@/hooks/useTelegram';
import { getAdminPaymentMethods, setPaymentMethodEnabled, type PaymentMethod, type PaymentMethodInfo } from '@/lib/api';

/* =====================================================================
 * To'lov turlarini yoqish/o'chirish. O'chirilgan tur checkout'da
 * ko'rinmaydi va backend uni qabul qilmaydi.
 * ===================================================================== */
const ICONS: Record<PaymentMethod, string> = { stars: '⭐', click: '💳', payme: '💳', cash: '💵' };

const NOTES: Partial<Record<PaymentMethod, string>> = {
  click: 'To‘liq integratsiya uchun backend .env ga CLICK_SERVICE_ID va CLICK_MERCHANT_ID kerak',
  payme: 'To‘liq integratsiya uchun backend .env ga PAYME_MERCHANT_ID kerak',
};

export function PaymentSettings() {
  const [methods, setMethods] = useState<PaymentMethodInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    getAdminPaymentMethods()
      .then(setMethods)
      .catch((err: Error) => setError(err.message));
  }, []);

  const toggle = async (method: PaymentMethod, value: boolean) => {
    if (!methods) return;
    const prev = methods;
    setMethods(methods.map((m) => (m.method === method ? { ...m, is_enabled: value } : m))); // optimistik
    setSaving(method);
    setError(null);
    try {
      await setPaymentMethodEnabled(method, value);
      haptic.notify('success');
    } catch (err) {
      setMethods(prev);
      haptic.notify('error');
      setError((err as Error).message);
    } finally {
      setSaving(null);
    }
  };

  if (!methods) {
    return error ? (
      <p className="rounded-2xl bg-red-500/10 p-3 text-sm font-bold text-red-600">{error}</p>
    ) : (
      <div className="h-64 animate-pulse rounded-3xl bg-bg-secondary" />
    );
  }

  const enabledCount = methods.filter((m) => m.is_enabled).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="divide-y divide-line overflow-hidden rounded-3xl bg-bg-secondary">
        {methods.map((m) => (
          <div key={m.method} className="flex items-center gap-3 p-4">
            <span className="text-2xl">{ICONS[m.method]}</span>
            <div className="min-w-0 flex-1">
              <p className="font-black">{m.label}</p>
              <p className="text-xs font-semibold text-hint">{m.is_enabled ? 'Aktiv' : 'Passiv'} · {m.description}</p>
              {NOTES[m.method] && <p className="mt-0.5 text-[11px] font-semibold text-amber-600">{NOTES[m.method]}</p>}
            </div>
            <Switch checked={m.is_enabled} disabled={saving === m.method} onChange={(v) => toggle(m.method, v)} />
          </div>
        ))}
      </div>

      {error && <p className="rounded-2xl bg-red-500/10 p-3 text-sm font-bold text-red-600">{error}</p>}
      {enabledCount === 0 && (
        <p className="rounded-2xl bg-amber-500/10 p-3 text-center text-sm font-bold text-amber-700 dark:text-amber-300">
          ⚠️ Barcha to‘lov turlari o‘chirilgan: mijozlar buyurtma bera olmaydi.
        </p>
      )}
    </div>
  );
}

export default PaymentSettings;
