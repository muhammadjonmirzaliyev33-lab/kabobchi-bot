'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OrderManager } from '@/components/admin/OrderManager';
import { PaymentSettings } from '@/components/admin/PaymentSettings';
import { Button } from '@/components/ui';
import { haptic, useTelegram } from '@/hooks/useTelegram';
import { cn } from '@/lib/utils';

/* =====================================================================
 * Admin Panel (/admin). Bot'dagi "🛠 Admin panel" tugmasi shu sahifani ochadi.
 * Kirish: Telegram ID 1027530770 (backend ADMIN_IDS). Asosiy tekshiruv
 * serverda: har bir /api/admin/* so'rovi initData imzosi va ID bo'yicha tekshiriladi.
 * ===================================================================== */
type Section = 'orders' | 'payments';

export default function AdminPage() {
  const router = useRouter();
  const { webApp, isReady, isAdmin, user } = useTelegram();
  const [section, setSection] = useState<Section>('orders');

  const goHome = useCallback(() => router.replace('/'), [router]);

  useEffect(() => {
    const back = webApp?.BackButton;
    if (!back) return;
    back.show();
    back.onClick(goHome);
    return () => {
      back.offClick(goHome);
      back.hide();
    };
  }, [webApp, goHome]);

  if (!isReady) return null;

  if (!isAdmin) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-8 text-center">
        <span className="text-6xl">🔒</span>
        <h1 className="text-2xl font-black">Faqat admin uchun</h1>
        <p className="font-semibold text-hint">
          {webApp ? `Sizning ID: ${user?.id}. Bu bo‘lim faqat administratorga ochiq.` : 'Admin panelni Telegram ichida oching.'}
        </p>
        <Button onClick={goHome}>Bosh sahifaga</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-4 px-4 pt-safe pb-10">
      <header className="sticky top-0 z-20 -mx-4 flex flex-col gap-3 bg-bg/95 px-4 pt-4 pb-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {!webApp && (
            <button type="button" onClick={goHome} aria-label="Orqaga" className="text-2xl font-black">
              ←
            </button>
          )}
          <h1 className="text-2xl font-black">🛠 Admin panel</h1>
        </div>
        <div className="flex gap-2">
          {(
            [
              ['orders', '📋 Buyurtmalar'],
              ['payments', '💳 To‘lov turlari'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                if (id === section) return;
                haptic.select();
                setSection(id);
              }}
              className={cn(
                'h-9 rounded-full px-4 text-sm font-extrabold transition active:scale-95',
                id === section
                  ? 'bg-gradient-to-r from-brand-500 to-accent text-white shadow-md shadow-brand-500/30'
                  : 'bg-bg-secondary text-hint'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {section === 'orders' ? <OrderManager /> : <PaymentSettings />}
    </div>
  );
}
