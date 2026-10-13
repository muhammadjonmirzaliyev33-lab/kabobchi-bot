'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartPayload, Product, ProductSize } from '@/lib/api';
import { formatSum } from '@/lib/utils';

export type { Product, ProductSize } from '@/lib/api';
export { formatSum };

/** Savatdagi qator: bir xil pitsaning turli o'lchamlari alohida qator */
export interface CartItem {
  key: string; // `${product.id}:${size?.code ?? ''}`
  product: Product;
  size: ProductSize | null;
  quantity: number;
}

const MAX_QTY_PER_ITEM = 50; // backend bilan bir xil cheklov
export const DEFAULT_SAUCE_PRICE = 15000;

export const cartKey = (productId: number, size?: ProductSize | null) => `${productId}:${size?.code ?? ''}`;

/** Qatorning bir dona narxi (o'lcham tanlangan bo'lsa, o'shaniki) */
export const unitPrice = (item: Pick<CartItem, 'product' | 'size'>) => item.size?.price ?? item.product.price;

interface CartState {
  items: CartItem[];
  /** Order Bump: firmenniy pishloqli sous */
  hasSauce: boolean;
  /** Backend /products meta'sidan keladi */
  saucePrice: number;
  deliveryFee: number;

  addItem: (product: Product, size?: ProductSize | null, quantity?: number) => void;
  removeItem: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  increment: (key: string) => void;
  decrement: (key: string) => void;
  setSauce: (value: boolean) => void;
  setPricing: (pricing: { saucePrice: number; deliveryFee: number }) => void;
  clear: () => void;
}

const clampQty = (q: number) => Math.min(Math.max(q, 0), MAX_QTY_PER_ITEM);

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      hasSauce: false,
      saucePrice: DEFAULT_SAUCE_PRICE,
      deliveryFee: 0,

      addItem: (product, size = null, quantity = 1) =>
        set((state) => {
          const key = cartKey(product.id, size);
          const existing = state.items.find((i) => i.key === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.key === key ? { ...i, product, size, quantity: clampQty(i.quantity + quantity) } : i
              ),
            };
          }
          return { items: [...state.items, { key, product, size, quantity: clampQty(quantity) }] };
        }),

      removeItem: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),

      setQuantity: (key, quantity) =>
        set((state) => ({
          items:
            quantity < 1
              ? state.items.filter((i) => i.key !== key)
              : state.items.map((i) => (i.key === key ? { ...i, quantity: clampQty(quantity) } : i)),
        })),

      increment: (key) =>
        set((state) => ({
          items: state.items.map((i) => (i.key === key ? { ...i, quantity: clampQty(i.quantity + 1) } : i)),
        })),

      decrement: (key) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.key === key ? { ...i, quantity: i.quantity - 1 } : i))
            .filter((i) => i.quantity > 0),
        })),

      setSauce: (value) => set({ hasSauce: value }),
      setPricing: ({ saucePrice, deliveryFee }) => set({ saucePrice, deliveryFee }),
      clear: () => set({ items: [], hasSauce: false }),
    }),
    {
      name: 'pizza-kuryer-cart',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // v1 (o'lchamsiz) savatni yangi formatga o'tkazish
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<CartState> & { items?: Array<Partial<CartItem>> };
        if (version < 2) {
          state.items = (state.items ?? [])
            .filter((i) => i?.product)
            .map((i) => ({ key: cartKey(i.product!.id, null), product: i.product!, size: null, quantity: i.quantity ?? 1 }));
          state.saucePrice = DEFAULT_SAUCE_PRICE;
          state.deliveryFee = 0;
        }
        return state as CartState;
      },
    }
  )
);

/* ---------- Selektorlar ---------- */
export const selectTotalCount = (s: CartState) => s.items.reduce((sum, i) => sum + i.quantity, 0);
export const selectSubtotal = (s: CartState) => s.items.reduce((sum, i) => sum + unitPrice(i) * i.quantity, 0);
/** Mahsulotning barcha o'lchamlari bo'yicha savatdagi soni */
export const selectProductQuantity = (productId: number) => (s: CartState) =>
  s.items.filter((i) => i.product.id === productId).reduce((sum, i) => sum + i.quantity, 0);

/** Backend /cart/calculate va /orders uchun payload */
export const toOrderPayload = (s: Pick<CartState, 'items' | 'hasSauce'>): CartPayload => ({
  items: s.items.map((i) => ({ product_id: i.product.id, quantity: i.quantity, size: i.size?.code ?? null })),
  has_sauce: s.hasSauce,
});
