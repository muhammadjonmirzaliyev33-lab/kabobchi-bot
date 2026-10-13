'use client';

import { useEffect, useState } from 'react';
import { haptic, useTelegram } from '@/hooks/useTelegram';
import { selectTotalCount, useCartStore } from '@/store/cartStore';
import { Badge } from '@/components/ui';

export type NavTab = 'home' | 'catalog' | 'cart' | 'admin' | 'profile';

interface NavItem {
  id: NavTab;
  label: string;
  icon: string;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Bosh sahifa', icon: '🏠' },
  { id: 'catalog', label: 'Katalog', icon: '🔍' },
  { id: 'cart', label: 'Savatcha', icon: '🛒' },
  { id: 'admin', label: 'Admin', icon: '⚙️', adminOnly: true },
  { id: 'profile', label: 'Profil', icon: '🙎‍♂️' },
];

interface BottomNavigationProps {
  active: NavTab;
  onChange: (tab: NavTab) => void;
}

export function BottomNavigation({ active, onChange }: BottomNavigationProps) {
  const { isAdmin } = useTelegram();
  const cartCount = useCartStore(selectTotalCount);

  // Savatcha soni localStorage'dan keladi: hydration farqi bo'lmasligi uchun mount'dan keyin ko'rsatamiz
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Savatchaga mahsulot qo'shilganda nishonni "sakratish"
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (!mounted || cartCount === 0) return;
    setBump(true);
    const t = setTimeout(() => setBump(false), 300);
    return () => clearTimeout(t);
  }, [cartCount, mounted]);

  const items = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur-md">
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <li key={item.id} className="flex-1">
              <button
                type="button"
                onClick={() => {
                  if (!isActive) haptic.select();
                  onChange(item.id);
                }}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex w-full flex-col items-center gap-0.5 py-1"
              >
                <span
                  className={[
                    'relative flex h-8 w-12 items-center justify-center rounded-full text-xl transition',
                    isActive ? 'scale-110 bg-brand-100 dark:bg-brand-500/20' : 'grayscale-[60%] opacity-80',
                    item.id === 'cart' && bump ? 'animate-pop' : '',
                  ].join(' ')}
                >
                  {item.icon}
                  {item.id === 'cart' && mounted && cartCount > 0 && (
                    <Badge dot className="absolute -top-1 -right-0.5">
                      {cartCount > 99 ? '99+' : cartCount}
                    </Badge>
                  )}
                </span>
                <span
                  className={`text-[11px] leading-tight font-bold ${isActive ? 'text-brand-600 dark:text-brand-400' : 'text-hint'}`}
                >
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default BottomNavigation;
