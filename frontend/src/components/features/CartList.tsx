'use client';

import { ProductImage } from '@/components/features/ProductCard';
import { useCart } from '@/hooks/useCart';
import { formatSum } from '@/lib/utils';
import { unitPrice, type CartItem } from '@/store/cartStore';

/* =====================================================================
 * Order Stack: savatdagi mahsulotlar va +/- tugmalari
 * ===================================================================== */
export function CartList({ onItemClick }: { onItemClick?: (item: CartItem) => void }) {
  const { items, increment, decrement, remove } = useCart();

  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => {
        const price = unitPrice(item);
        return (
          <li key={item.key} className="flex animate-slide-up items-center gap-3 rounded-3xl bg-bg-secondary p-2.5">
            <button
              type="button"
              onClick={() => onItemClick?.(item)}
              className="size-[72px] shrink-0 overflow-hidden rounded-2xl bg-bg"
              aria-label={item.product.name}
            >
              <ProductImage product={item.product} className="size-full" />
            </button>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-1 font-black leading-tight">{item.product.name}</h3>
                <button
                  type="button"
                  onClick={() => remove(item.key)}
                  aria-label="O‘chirish"
                  className="-mt-0.5 shrink-0 px-1 text-sm text-hint transition active:scale-90"
                >
                  ✕
                </button>
              </div>
              <span className="text-xs font-bold text-hint">
                {item.size ? `${item.size.label} · ` : ''}
                {formatSum(price)}
              </span>

              <div className="mt-1 flex items-center justify-between gap-2">
                <div className="flex h-9 items-center rounded-xl bg-bg">
                  <QtyButton label="Kamaytirish" onClick={() => decrement(item.key)}>
                    {item.quantity === 1 ? '🗑' : '−'}
                  </QtyButton>
                  <span className="w-6 text-center font-black tabular-nums">{item.quantity}</span>
                  <QtyButton label="Ko‘paytirish" onClick={() => increment(item.key)} disabled={item.quantity >= 50}>
                    +
                  </QtyButton>
                </div>
                <span className="font-black tabular-nums">{formatSum(price * item.quantity)}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function QtyButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-9 items-center justify-center text-xl font-black text-brand-600 transition active:scale-90 disabled:opacity-30 dark:text-brand-400"
    >
      {children}
    </button>
  );
}

export default CartList;
