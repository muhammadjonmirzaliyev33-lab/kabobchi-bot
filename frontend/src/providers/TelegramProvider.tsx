'use client';

import { createContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, getWebApp, type TelegramUser, type TelegramWebApp } from '@/hooks/useTelegram';

/** Backend /api/me javobi (users jadvali) */
export interface BackendUser {
  id: number;
  telegram_id: number | string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  phone: string | null;
  role: 'user' | 'admin';
}

interface TelegramContextValue {
  webApp: TelegramWebApp | null;
  /** Telegram ichida ochilganmi */
  isTelegram: boolean;
  /** SDK tayyor bo'ldimi (hydration tugadi) */
  isReady: boolean;
  user: TelegramUser | null;
  /** Backend'dagi foydalanuvchi yozuvi (telefon, rol) */
  profile: BackendUser | null;
  isAdmin: boolean;
  colorScheme: 'light' | 'dark';
  initData: string;
}

export const TelegramContext = createContext<TelegramContextValue | null>(null);

const ADMIN_ID = Number(process.env.NEXT_PUBLIC_ADMIN_ID || 0);

// Brauzerda (Telegram'dan tashqarida) ishlab chiqish uchun soxta foydalanuvchi
const DEV_USER: TelegramUser = { id: 0, first_name: 'Mehmon', language_code: 'uz' };

/** Telegram themeParams -> CSS o'zgaruvchilari (Telegram ham o'rnatadi, bu zaxira) */
function applyTheme(wa: TelegramWebApp) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(wa.themeParams)) {
    if (value) root.style.setProperty(`--tg-theme-${key.replace(/_/g, '-')}`, value);
  }
  root.dataset.theme = wa.colorScheme;
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');
  const [profile, setProfile] = useState<BackendUser | null>(null);
  const [roleChecked, setRoleChecked] = useState(false);

  // SDK init
  useEffect(() => {
    const wa = getWebApp();
    if (wa) {
      wa.ready();
      wa.expand();
      if (wa.isVersionAtLeast('7.7')) wa.disableVerticalSwipes?.();
      if (wa.isVersionAtLeast('6.1')) {
        wa.setHeaderColor('bg_color');
        wa.setBackgroundColor(wa.themeParams.bg_color || '#ffffff');
      }
      applyTheme(wa);
      setColorScheme(wa.colorScheme);

      const onTheme = () => {
        applyTheme(wa);
        setColorScheme(wa.colorScheme);
      };
      wa.onEvent('themeChanged', onTheme);
      setWebApp(wa);
      setIsReady(true);
      return () => wa.offEvent('themeChanged', onTheme);
    }

    // Oddiy brauzer: tizim temasiga moslash
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      const scheme = mq.matches ? 'dark' : 'light';
      document.documentElement.dataset.theme = scheme;
      setColorScheme(scheme);
    };
    sync();
    mq.addEventListener('change', sync);
    setIsReady(true);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Backend'dan rolni olish (asosiy admin tekshiruvi)
  useEffect(() => {
    if (!webApp) return;
    let cancelled = false;
    apiFetch<BackendUser>('/me')
      .then((me) => !cancelled && setProfile(me))
      .catch(() => {
        /* backend ishlamasa .env dagi ADMIN_ID ga tayanamiz */
      })
      .finally(() => !cancelled && setRoleChecked(true));
    return () => {
      cancelled = true;
    };
  }, [webApp]);

  const value = useMemo<TelegramContextValue>(() => {
    const tgUser = webApp?.initDataUnsafe.user ?? null;
    const user = tgUser ?? (isReady && process.env.NODE_ENV === 'development' ? DEV_USER : null);
    const envAdmin = Boolean(ADMIN_ID && tgUser && tgUser.id === ADMIN_ID);
    // Backend javob bergan bo'lsa uning roli hal qiladi, aks holda .env zaxirasi
    const isAdmin = roleChecked && profile ? profile.role === 'admin' : envAdmin;
    return {
      webApp,
      isTelegram: Boolean(webApp),
      isReady,
      user,
      profile,
      isAdmin,
      colorScheme,
      initData: webApp?.initData ?? '',
    };
  }, [webApp, isReady, profile, roleChecked, colorScheme]);

  return <TelegramContext.Provider value={value}>{children}</TelegramContext.Provider>;
}

export default TelegramProvider;
