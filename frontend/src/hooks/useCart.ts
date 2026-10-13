'use client';

import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { haptic } from '@/hooks/useTelegram';
import { calculateCart, type CartCalculation, type Product, type ProductSize } from '@/lib/api';
import { selectSubtotal, selectTotalCount, toOrderPayload, useCartStore } from '@/store/cartStore';

/** Mahsulotning standart o'lchami: "m" (30 sm) bo'lsa o'sha, aks holda birinchisi */
export function defaultSize(product: Product): ProductSize | null {
  const sizes = product.sizes ?? [];
  return sizes.find((s) => s.code === 'm') ?? sizes[0] ?? null;
}

/* =====================================================================
 * Savatcha mantiqi: hisob-kitob, haptic bilan amallar va
 * checkout oldidan server bilan tekshirish.
 * ===================================================================== */
export function useCart() {
  const { items, hasSauce, saucePrice, deliveryFee } = useCartStore(
    useShallow((s) => ({ items: s.items, hasSauce: s.hasSauce, saucePrice: s.saucePrice, deliveryFee: s.deliveryFee }))
  );
  const count = useCartStore(selectTotalCount);
  const subtotal = useCartStore(selectSubtotal);
  const store = useCartStore.getState;

  // localStorage'dan tiklanadi: hydration farqi bo'lmasligi uchun mount'dan keyin ko'rsatamiz
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const sauceTotal = hasSauce && count > 0 ? saucePrice : 0;
  const total = count > 0 ? subtotal + sauceTotal + deliveryFee : 0;

  /** Katalogdagi "+" va Bottom Sheet CTA */
  const add = useCallback((product: Product, size: ProductSize | null = defaultSize(product), quantity = 1) => {
    store().addItem(product, size, quantity);
    haptic.impact('medium');
    haptic.notify('success');
  }, [store]);

  const increment = useCallback((key: string) => {
    haptic.impact('light');
    store().increment(key);
  }, [store]);

  const decrement = useCallback((key: string) => {
    const item = store().items.find((i) => i.key === key);
    haptic.impact(item?.quantity === 1 ? 'rigid' : 'light');
    store().decrement(key);
  }, [store]);

  const remove = useCallback((key: string) => {
    haptic.notify('warning');
    store().removeItem(key);
  }, [store]);

  const toggleSauce = useCallback((value: boolean) => {
    if (value) haptic.notify('success');
    store().setSauce(value);
  }, [store]);

  /**
   * Checkout oldidan: narxlarni serverda qayta hisoblash.
   * 4-qism (to'lov) shu natijani ishlatadi.
   */
  const [validating, setValidating] = useState(false);
  const validate = useCallback(async (): Promise<CartCalculation> => {
    setValidating(true);
    try {
      return await calculateCart(toOrderPayload(store()));
    } finally {
      setValidating(false);
    }
  }, [store]);

  return {
    hydrated,
    items: hydrated ? items : [],
    count: hydrated ? count : 0,
    subtotal: hydrated ? subtotal : 0,
    hasSauce,
    saucePrice,
    sauceTotal: hydrated ? sauceTotal : 0,
    deliveryFee,
    total: hydrated ? total : 0,
    add,
    increment,
    decrement,
    remove,
    toggleSauce,
    clear: () => store().clear(),
    validate,
    validating,
  };
}
