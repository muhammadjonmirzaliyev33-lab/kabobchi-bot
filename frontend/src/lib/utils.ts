/* =====================================================================
 * Umumiy yordamchi funksiyalar (formatlash, chegirma, teglar)
 * ===================================================================== */

/** 85000 -> "85,000 so'm" */
export function formatSum(value: number, withCurrency = true): string {
  const n = Math.round(Number(value) || 0)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return withCurrency ? `${n} so'm` : n;
}

/** Eski va yangi narxdan chegirma foizi: (99000, 85000) -> 14 */
export function discountPercent(oldPrice: number | null | undefined, price: number): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

/** Tailwind klasslarini birlashtirish (falsy qiymatlar tashlab yuboriladi) */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Backend products.tags qiymatlari va ularning nomlari */
export const PRODUCT_TAGS = {
  popular: { label: 'Mashhur', icon: '🔥' },
  cheesy: { label: 'Pishloqli', icon: '🧀' },
  spicy: { label: 'Achiq', icon: '🌶️' },
} as const;

export type ProductTag = keyof typeof PRODUCT_TAGS;

export const isProductTag = (tag: string): tag is ProductTag => tag in PRODUCT_TAGS;
