'use client';

import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { ProductImage } from '@/components/features/ProductCard';
import { Badge, Button } from '@/components/ui';
import { haptic } from '@/hooks/useTelegram';
import { defaultSize, useCart } from '@/hooks/useCart';
import type { Product, ProductSize } from '@/lib/api';
import { cn, discountPercent, formatSum, isProductTag, PRODUCT_TAGS } from '@/lib/utils';

const ANIMATION_MS = 320;
const DRAG_CLOSE_PX = 110;

interface ProductBottomSheetProps {
  /** null bo'lsa oyna yopiq */
  product: Product | null;
  onClose: () => void;
}

/* =====================================================================
 * Pastdan qalqib chiquvchi mahsulot oynasi.
 * Telegram "Orqaga" tugmasi page.tsx da shu oynani yopadi.
 * ===================================================================== */
export function ProductBottomSheet({ product, onClose }: ProductBottomSheetProps) {
  // Yopilish animatsiyasi davomida oxirgi mahsulotni ko'rsatib turamiz
  const [shown, setShown] = useState<Product | null>(product);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (product) {
      setShown(product);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const t = setTimeout(() => setShown(null), ANIMATION_MS);
    return () => clearTimeout(t);
  }, [product]);

  // Orqa fon scroll bo'lmasin
  useEffect(() => {
    if (!shown) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [shown]);

  if (!shown) return null;
  return <SheetBody key={shown.id} product={shown} visible={visible} onClose={onClose} />;
}

function SheetBody({ product, visible, onClose }: { product: Product; visible: boolean; onClose: () => void }) {
  const { add } = useCart();
  const sizes = product.sizes ?? [];
  const [size, setSize] = useState<ProductSize | null>(() => defaultSize(product));
  const [qty, setQty] = useState(1);

  const price = size?.price ?? product.price;
  const oldPrice = size ? size.old_price ?? null : product.old_price ?? null;
  const discount = discountPercent(oldPrice, price);
  const tags = (product.tags ?? []).filter(isProductTag);
  const ingredients = product.ingredients?.length
    ? product.ingredients
    : (product.description ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  /* ---------- Pastga tortib yopish ---------- */
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onTouchStart = (e: TouchEvent) => {
    // Faqat kontent tepasida bo'lsak tortish mumkin
    if ((scrollRef.current?.scrollTop ?? 0) > 0) return;
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: TouchEvent) => {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onTouchEnd = () => {
    if (startY.current === null) return;
    startY.current = null;
    if (dragY > DRAG_CLOSE_PX) {
      haptic.impact('soft');
      onClose();
    }
    setDragY(0);
  };

  const submit = () => {
    add(product, size, qty);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={product.name}>
      {/* Fon */}
      <button
        type="button"
        aria-label="Yopish"
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0'
        )}
      />

      {/* Oyna */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: visible ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: dragY ? 'none' : `transform ${ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] max-w-lg flex-col overflow-hidden rounded-t-[2rem] bg-bg shadow-2xl"
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <span className="h-1.5 w-12 rounded-full bg-hint/30" />
        </div>

        <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {/* Katta rasm */}
          <div className="relative mt-1 overflow-hidden rounded-3xl bg-bg-secondary">
            <ProductImage product={product} className="aspect-[4/3] w-full" />
            {discount > 0 && (
              <span className="absolute top-3 left-3 rounded-full bg-accent px-2.5 py-1 text-sm font-black text-white shadow">
                −{discount}%
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-bg/85 text-lg font-black backdrop-blur"
            >
              ✕
            </button>
          </div>

          {/* Nomi va teglar */}
          <div className="mt-4 flex flex-col gap-2">
            <h2 className="text-2xl leading-tight font-black">{product.name}</h2>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <Badge key={t} tone={t === 'spicy' ? 'danger' : t === 'cheesy' ? 'warning' : 'brand'}>
                    {PRODUCT_TAGS[t].icon} {PRODUCT_TAGS[t].label}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span className="text-2xl font-black text-accent">{formatSum(price)}</span>
                {oldPrice && (
                  <span className="text-base font-bold text-hint line-through decoration-accent/70">
                    {formatSum(oldPrice)}
                  </span>
                )}
              </div>
              <div className="flex h-11 shrink-0 items-center rounded-2xl bg-bg-secondary">
                <StepButton label="Kamaytirish" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </StepButton>
                <span className="w-6 text-center text-lg font-black tabular-nums">{qty}</span>
                <StepButton label="Ko'paytirish" disabled={qty >= 50} onClick={() => setQty((q) => Math.min(50, q + 1))}>
                  +
                </StepButton>
              </div>
            </div>
          </div>

          {/* O'lcham tanlovi */}
          {sizes.length > 1 && (
            <section className="mt-4">
              <h3 className="mb-2 text-sm font-extrabold text-hint">Hajmini tanlang</h3>
              <div className="grid gap-1 rounded-2xl bg-bg-secondary p-1" style={{ gridTemplateColumns: `repeat(${sizes.length}, 1fr)` }}>
                {sizes.map((s) => {
                  const active = s.code === size?.code;
                  return (
                    <button
                      key={s.code}
                      type="button"
                      onClick={() => {
                        if (!active) haptic.select();
                        setSize(s);
                      }}
                      className={cn(
                        'flex flex-col items-center rounded-xl py-2 transition',
                        active ? 'bg-bg shadow-md' : 'opacity-70'
                      )}
                    >
                      <span className={cn('text-sm font-black', active && 'text-brand-600 dark:text-brand-400')}>{s.label}</span>
                      <span className="text-[11px] font-bold text-hint">{formatSum(s.price, false)}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Tarkibi */}
          {ingredients.length > 0 && (
            <section className="mt-5">
              <h3 className="mb-2 text-sm font-extrabold text-hint">Tarkibi</h3>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {ingredients.map((ing) => (
                  <li key={ing} className="flex items-center gap-2 text-sm font-bold">
                    <span className="size-1.5 shrink-0 rounded-full bg-brand-500" />
                    {ing}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Xavfni yopish (risk reversal) */}
          <section className="mt-5 grid grid-cols-2 gap-2">
            <Guarantee icon="🔥" title="100% Issiq yetkazish kafolati" text="Sovuq kelsa, pulini qaytaramiz" />
            <Guarantee icon="🎧" title="24/7 Yordam" text="Operator doim aloqada" />
          </section>
        </div>

        {/* Sticky CTA */}
        <div className="pb-safe border-t border-line bg-bg px-4 pt-3">
          <Button size="lg" fullWidth withHaptic={false} onClick={submit} className="h-14 whitespace-nowrap">
            Savatchaga qo‘shish — {formatSum(price * qty)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Guarantee({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-emerald-500/25 bg-emerald-500/8 p-3">
      <span className="text-xl">{icon}</span>
      <span className="text-[13px] leading-tight font-black">{title}</span>
      <span className="text-[11px] leading-tight font-semibold text-hint">{text}</span>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        haptic.impact('light');
        onClick();
      }}
      className="flex size-10 items-center justify-center text-2xl font-black text-brand-600 transition active:scale-90 disabled:opacity-30 dark:text-brand-400"
    >
      {children}
    </button>
  );
}

export default ProductBottomSheet;
