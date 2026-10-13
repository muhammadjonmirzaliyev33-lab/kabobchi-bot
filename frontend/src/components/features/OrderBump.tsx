'use client';

import { ProductImage } from '@/components/features/ProductCard';
import { Switch } from '@/components/ui';
import { useCart } from '@/hooks/useCart';
import type { Product } from '@/lib/api';
import { cn, formatSum } from '@/lib/utils';

/* =====================================================================
 * Order Bump (kassadagi upsell):
 *  1) Firmenniy pishloqli sous: Switch -> darhol jami summaga qo'shiladi
 *     (backend: has_sauce + SAUCE_PRICE)
 *  2) Ichimlik qo'shish (savatda yo'q ichimliklar)
 * ===================================================================== */
export function OrderBump({ drinks = [] }: { drinks?: Product[] }) {
  const { hasSauce, saucePrice, toggleSauce, items, add } = useCart();
  const inCartIds = new Set(items.map((i) => i.product.id));
  const suggestions = drinks.filter((d) => !inCartIds.has(d.id)).slice(0, 4);

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'relative overflow-hidden rounded-3xl border-2 border-dashed p-4 transition-colors',
          hasSauce ? 'border-emerald-500 bg-emerald-500/10' : 'border-brand-400 bg-brand-50 dark:bg-brand-500/10'
        )}
      >
        {!hasSauce && (
          <span className="absolute top-0 right-0 rounded-bl-2xl bg-accent px-2.5 py-1 text-[11px] font-black text-white">
            TAVSIYA
          </span>
        )}
        <div className="flex items-center gap-3">
          <span className={cn('text-4xl transition', !hasSauce && 'animate-float')}>🧀</span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] leading-snug font-black">
              Atigi <span className="text-accent">+{formatSum(saucePrice)}</span>ga firmenniy pishloqli sous
              qo‘shasizmi?
            </p>
            <p className="mt-0.5 text-xs font-semibold text-hint">
              {hasSauce ? '✅ Sous qo‘shildi. Mazali bo‘ladi!' : 'Pitsaning qirralari bilan juda mos tushadi'}
            </p>
          </div>
          <Switch checked={hasSauce} onChange={toggleSauce} />
        </div>
      </div>

      {suggestions.length > 0 && (
        <div>
          <h3 className="mb-2 px-1 text-sm font-extrabold text-hint">🥤 Ichimlik ham olasizmi?</h3>
          <div className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4">
            {suggestions.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => add(d, null)}
                className="flex w-40 shrink-0 items-center gap-2 rounded-2xl bg-bg-secondary p-2 text-left transition active:scale-95"
              >
                <ProductImage product={d} className="size-11 shrink-0 rounded-xl text-2xl" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-black">{d.name}</span>
                  <span className="text-xs font-extrabold text-accent">+{formatSum(d.price)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderBump;
