'use client';

import { memo } from 'react';
import { defaultSize, useCart } from '@/hooks/useCart';
import type { Product } from '@/lib/api';
import { cn, discountPercent, formatSum, isProductTag, PRODUCT_TAGS } from '@/lib/utils';
import { selectProductQuantity, useCartStore } from '@/store/cartStore';

/** Mahsulot rasmi; rasm yo'q bo'lsa kategoriyaga mos zaxira */
export function ProductImage({ product, className = '' }: { product: Product; className?: string }) {
  const isDrink = /ichimlik/i.test(product.category_name ?? '');
  if (!product.image_url && isDrink) {
    return (
      <div className={cn('flex items-center justify-center bg-gradient-to-br from-sky-100 to-cyan-50 text-5xl dark:from-sky-500/15 dark:to-cyan-500/5', className)}>
        🥤
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={product.image_url || '/images/pizza-hero.svg'}
      alt={product.name}
      loading="lazy"
      draggable={false}
      className={cn('object-cover', className)}
    />
  );
}

/** Kartochka va Bottom Sheet uchun narx (standart o'lcham bo'yicha) */
export function productPricing(product: Product) {
  const size = defaultSize(product);
  const price = size?.price ?? product.price;
  const oldPrice = size ? size.old_price ?? null : product.old_price ?? null;
  return { size, price, oldPrice, discount: discountPercent(oldPrice, price) };
}

interface ProductCardProps {
  product: Product;
  onOpen: (product: Product) => void;
}

export const ProductCard = memo(function ProductCard({ product, onOpen }: ProductCardProps) {
  const { add, hydrated } = useCart();
  const inCart = useCartStore(selectProductQuantity(product.id));
  const { size, price, oldPrice, discount } = productPricing(product);
  const tags = (product.tags ?? []).filter(isProductTag);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(product)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(product)}
      className="group flex flex-col overflow-hidden rounded-3xl bg-bg-secondary transition active:scale-[0.98]"
    >
      <div className="relative aspect-square overflow-hidden">
        <ProductImage product={product} className="size-full transition duration-300 group-active:scale-105" />
        {discount > 0 && (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-accent px-2 py-0.5 text-xs font-black text-white shadow">
            −{discount}%
          </span>
        )}
        {tags.length > 0 && (
          <span className="absolute top-2.5 right-2.5 flex gap-0.5 rounded-full bg-bg/85 px-1.5 py-0.5 text-sm backdrop-blur">
            {tags.map((t) => (
              <span key={t} title={PRODUCT_TAGS[t].label}>
                {PRODUCT_TAGS[t].icon}
              </span>
            ))}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-1 text-base leading-tight font-black">{product.name}</h3>
        {product.description && (
          <p className="line-clamp-2 text-xs leading-snug font-semibold text-hint">{product.description}</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <div className="flex min-w-0 flex-col">
            {oldPrice ? (
              <span className="text-xs font-bold text-hint line-through decoration-accent/70">
                {formatSum(oldPrice, false)}
              </span>
            ) : (
              size && <span className="text-xs font-bold text-hint">{size.label}</span>
            )}
            <span className="truncate text-[15px] leading-tight font-black text-accent">{formatSum(price)}</span>
          </div>

          <button
            type="button"
            aria-label={`${product.name}ni savatchaga qo'shish`}
            onClick={(e) => {
              e.stopPropagation(); // kartochka (Bottom Sheet) ochilmasin
              add(product, size);
            }}
            className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent text-2xl leading-none font-black text-white shadow-md shadow-brand-500/30 transition active:scale-90"
          >
            +
            {hydrated && inCart > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-[18px] min-w-[18px] animate-pop items-center justify-center rounded-full bg-text px-1 text-[11px] font-black text-bg">
                {inCart}
              </span>
            )}
          </button>
        </div>
      </div>
    </article>
  );
});

/** Yuklanayotgandagi skelet */
export function ProductCardSkeleton() {
  return (
    <div className="flex animate-pulse flex-col overflow-hidden rounded-3xl bg-bg-secondary">
      <div className="aspect-square bg-hint/15" />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-4 w-3/4 rounded bg-hint/15" />
        <div className="h-3 w-full rounded bg-hint/10" />
        <div className="mt-2 flex items-center justify-between">
          <div className="h-5 w-1/2 rounded bg-hint/15" />
          <div className="size-9 rounded-full bg-hint/15" />
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
