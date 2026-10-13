'use client';

import { useContext } from 'react';
import { TelegramContext } from '@/providers/TelegramProvider';

/* =====================================================================
 * Telegram WebApp tiplari (faqat ishlatiladigan qismi)
 * https://core.telegram.org/bots/webapps
 * ===================================================================== */
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export type HapticImpact = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
export type HapticNotification = 'error' | 'success' | 'warning';

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramUser; start_param?: string; auth_date?: number; hash?: string };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string | undefined>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  isVersionAtLeast: (version: string) => boolean;
  setHeaderColor: (color: string) => void;
  setBackgroundColor: (color: string) => void;
  disableVerticalSwipes?: () => void;
  enableClosingConfirmation: () => void;
  onEvent: (event: string, cb: () => void) => void;
  offEvent: (event: string, cb: () => void) => void;
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  /** Telegram Stars / to'lov invoysi (Bot API 6.1+) */
  openInvoice?: (url: string, cb?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void) => void;
  showAlert: (message: string, cb?: () => void) => void;
  showConfirm: (message: string, cb?: (ok: boolean) => void) => void;
  HapticFeedback: {
    impactOccurred: (style: HapticImpact) => void;
    notificationOccurred: (type: HapticNotification) => void;
    selectionChanged: () => void;
  };
  BackButton: {
    isVisible: boolean;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
  MainButton: {
    text: string;
    isVisible: boolean;
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    showProgress: (leaveActive?: boolean) => void;
    hideProgress: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp };
  }
}

/** Telegram WebApp obyekti (SSR va oddiy brauzerda null) */
export function getWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  const wa = window.Telegram?.WebApp;
  // Skript Telegram'dan tashqarida ham yuklanadi, lekin initData bo'sh bo'ladi
  return wa && wa.initData ? wa : null;
}

/* =====================================================================
 * Haptic feedback: Telegram'dan tashqarida jim ishlaydi
 * ===================================================================== */
export const haptic = {
  impact(style: HapticImpact = 'light') {
    getWebApp()?.HapticFeedback.impactOccurred(style);
  },
  notify(type: HapticNotification) {
    getWebApp()?.HapticFeedback.notificationOccurred(type);
  },
  select() {
    getWebApp()?.HapticFeedback.selectionChanged();
  },
};

/* =====================================================================
 * Backend API so'rovlari. Himoyalangan endpointlar uchun
 * "Authorization: tma <initData>" headeri avtomatik qo'shiladi.
 * Backend javob formati: { ok: true, data } | { ok: false, error }
 * ===================================================================== */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const initData = getWebApp()?.initData;
  if (initData) headers.set('Authorization', `tma ${initData}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, { ...init, headers });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new ApiError(json?.error || `So'rov xatosi (${res.status})`, res.status);
  }
  return json.data as T;
}

/**
 * Asosiy hook: foydalanuvchi, admin holati, haptic va WebApp obyekti.
 * TelegramProvider ichida ishlatiladi.
 */
export function useTelegram() {
  const ctx = useContext(TelegramContext);
  if (!ctx) throw new Error('useTelegram faqat <TelegramProvider> ichida ishlatiladi');
  return { ...ctx, haptic, apiFetch };
}
