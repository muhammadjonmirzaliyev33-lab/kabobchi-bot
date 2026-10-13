'use client';

import axios, { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { API_URL, ApiError, getWebApp } from '@/hooks/useTelegram';

/* =====================================================================
 * Backend tiplari (backend/src/database/schema.sql ga mos)
 * ===================================================================== */
export interface Category {
  id: number;
  name: string;
  sort_order: number;
}

export interface ProductSize {
  code: string; // "s" | "m" | "l"
  label: string; // "30 sm"
  price: number;
  old_price?: number | null;
}

export interface Product {
  id: number;
  category_id: number | null;
  category_name?: string | null;
  name: string;
  description: string | null;
  price: number;
  old_price?: number | null;
  image_url: string | null;
  tags?: string[];
  ingredients?: string[];
  sizes?: ProductSize[];
}

export interface MenuMeta {
  sauce_price: number;
  delivery_fee: number;
}

export interface CartLinePayload {
  product_id: number;
  quantity: number;
  size?: string | null;
}

export interface CartPayload {
  items: CartLinePayload[];
  has_sauce: boolean;
}

/** POST /cart/calculate javobi: narxlar faqat serverda hisoblanadi */
export interface CartCalculation {
  items: Array<CartLinePayload & { product_name: string; unit_price: number; line_total: number }>;
  has_sauce: boolean;
  sauce_price: number;
  subtotal: number;
  delivery_fee: number;
  total: number;
}

export type PaymentMethod = 'click' | 'payme' | 'cash' | 'stars';

export interface CheckoutPayload extends CartPayload {
  payment_method: PaymentMethod;
  name?: string;
  phone: string;
  address?: string;
  comment?: string;
}

export type OrderStatus = 'new' | 'accepted' | 'on_the_way' | 'delivered' | 'cancelled';

/** POST /orders javobidagi to'lov ma'lumoti (4-qism) */
export interface OrderPayment {
  type: PaymentMethod;
  /** Telegram Stars: WebApp.openInvoice uchun havola */
  invoice_link?: string;
  stars_amount?: number;
  /** Click / Payme to'lov sahifasi (merchant kalitlari sozlanmagan bo'lsa null) */
  payment_url?: string | null;
  error?: string;
}

export interface Order extends Omit<CartCalculation, 'items'> {
  id: number;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  created_at: string;
  items: CartCalculation['items'];
  payment?: OrderPayment;
}

/** Admin ro'yxatidagi buyurtma (mijoz ma'lumotlari bilan) */
export interface AdminOrder extends Order {
  customer_name: string;
  phone: string;
  address: string | null;
  comment: string | null;
  telegram_id: number | string;
  username: string | null;
  stars_amount: number | null;
  items: Array<CartCalculation['items'][number] & { name?: string }>;
}

export interface PaymentMethodInfo {
  method: PaymentMethod;
  label: string;
  description: string;
  is_enabled: boolean;
  sort_order: number;
}

/** Admin panel bo'limlari: Yangi / Bajarilayotgan / Yakunlangan */
export type OrderGroup = 'new' | 'active' | 'done';

export const ORDER_GROUPS: Record<OrderGroup, { label: string; statuses: OrderStatus[] }> = {
  new: { label: 'Yangi', statuses: ['new'] },
  active: { label: 'Bajarilayotgan', statuses: ['accepted', 'on_the_way'] },
  done: { label: 'Yakunlangan', statuses: ['delivered', 'cancelled'] },
};

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: '🆕 Yangi',
  accepted: '👨‍🍳 Tayyorlanmoqda',
  on_the_way: '🚚 Kuryerga berildi',
  delivered: '✅ Bajarildi',
  cancelled: '❌ Bekor qilindi',
};

/** Backend (utils/keyboards.js NEXT_STATUSES) bilan bir xil o'tishlar */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  new: ['accepted', 'on_the_way', 'cancelled'],
  accepted: ['on_the_way', 'cancelled'],
  on_the_way: ['delivered'],
  delivered: [],
  cancelled: [],
};

/* =====================================================================
 * Axios klienti. "Authorization: tma <initData>" har so'rovga qo'shiladi,
 * backend javobi { ok, data } dan "data" ochib beriladi.
 * ===================================================================== */
export const api = axios.create({ baseURL: API_URL, timeout: 15000 });

api.interceptors.request.use((config) => {
  const initData = getWebApp()?.initData;
  if (initData) config.headers.set('Authorization', `tma ${initData}`);
  return config;
});

api.interceptors.response.use(
  (res) => {
    if (res.data && res.data.ok === false) {
      return Promise.reject(new ApiError(res.data.error || 'So‘rov xatosi', res.status));
    }
    return res;
  },
  (err: AxiosError<{ error?: string }>) => {
    const status = err.response?.status ?? 0;
    const message =
      err.response?.data?.error || (status ? `So'rov xatosi (${status})` : 'Internet aloqasini tekshiring');
    return Promise.reject(new ApiError(message, status));
  }
);

/* ---------- Endpointlar ---------- */
export async function getCategories(): Promise<Category[]> {
  const { data } = await api.get('/categories');
  return data.data;
}

export async function getProducts(categoryId?: number): Promise<{ products: Product[]; meta: MenuMeta }> {
  const { data } = await api.get('/products', { params: categoryId ? { category_id: categoryId } : undefined });
  return { products: data.data, meta: data.meta };
}

/** Savatni server bilan tekshirish (checkout oldidan) */
export async function calculateCart(payload: CartPayload): Promise<CartCalculation> {
  const { data } = await api.post('/cart/calculate', payload);
  return data.data;
}

/** Checkout: buyurtma yaratish (4-qism: to'lov oynasi shu yerni chaqiradi) */
export async function createOrder(payload: CheckoutPayload): Promise<Order> {
  const { data } = await api.post('/orders', payload);
  return data.data;
}

export async function getMyOrders(): Promise<Order[]> {
  const { data } = await api.get('/orders/my');
  return data.data;
}

/** Checkout: faqat admin yoqib qo'ygan to'lov turlari */
export async function getPaymentMethods(): Promise<{ methods: PaymentMethodInfo[]; somPerStar: number }> {
  const { data } = await api.get('/payment-methods');
  return { methods: data.data, somPerStar: data.meta?.som_per_star ?? 200 };
}

/* ---------- Admin (backend admin ID ni initData orqali tekshiradi) ---------- */
export async function getAdminOrders(group: OrderGroup, limit = 50): Promise<AdminOrder[]> {
  const { data } = await api.get('/admin/orders', { params: { group, limit } });
  return data.data;
}

export async function updateOrderStatus(id: number, status: OrderStatus): Promise<AdminOrder> {
  const { data } = await api.patch(`/admin/orders/${id}/status`, { status });
  return data.data;
}

export async function getOrderStats(): Promise<Array<{ status: OrderStatus; count: number; sum: number }>> {
  const { data } = await api.get('/admin/stats');
  return data.data;
}

export async function getAdminPaymentMethods(): Promise<PaymentMethodInfo[]> {
  const { data } = await api.get('/admin/payment-methods');
  return data.data;
}

export async function setPaymentMethodEnabled(method: PaymentMethod, isEnabled: boolean): Promise<PaymentMethodInfo> {
  const { data } = await api.patch(`/admin/payment-methods/${method}`, { is_enabled: isEnabled });
  return data.data;
}

/* =====================================================================
 * Menyu (kategoriyalar + mahsulotlar) bir marta yuklanadi va
 * Katalog hamda Savatcha (Order Bump ichimliklari) o'rtasida bo'lishiladi.
 * ===================================================================== */
export interface Menu {
  categories: Category[];
  products: Product[];
  meta: MenuMeta;
}

let menuPromise: Promise<Menu> | null = null;

export function loadMenu(force = false): Promise<Menu> {
  if (!menuPromise || force) {
    menuPromise = Promise.all([getCategories(), getProducts()])
      .then(([categories, { products, meta }]) => ({ categories, products, meta }))
      .catch((err) => {
        menuPromise = null; // keyingi urinishda qayta so'raladi
        throw err;
      });
  }
  return menuPromise;
}

export function useMenu() {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = (force = false) => {
    setLoading(true);
    setError(null);
    loadMenu(force)
      .then(setMenu)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { menu, error, loading, reload: () => load(true) };
}
