'use client';

import { useTelegram } from '@/hooks/useTelegram';

function greetingByHour(hour: number) {
  if (hour < 6) return 'Xayrli tun';
  if (hour < 12) return 'Xayrli tong';
  if (hour < 18) return 'Xayrli kun';
  return 'Xayrli kech';
}

export function Header() {
  const { user, isAdmin } = useTelegram();
  const name = user ? [user.first_name, user.last_name].filter(Boolean).join(' ') : '';
  const initials = (user?.first_name?.[0] ?? '🍕').toUpperCase();

  return (
    <header className="pt-safe sticky top-0 z-30 bg-bg/90 backdrop-blur-md">
      <div className="flex items-center gap-3 px-4 py-3">
        {user?.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photo_url} alt={name} className="size-12 rounded-full object-cover ring-2 ring-brand-500" />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-accent text-xl font-black text-white">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-hint">
            {greetingByHour(new Date().getHours())}, xush kelibsiz 👋
          </p>
          <h1 className="truncate text-lg font-black text-text">
            {name || 'Aziz mijoz'}
            {isAdmin && <span className="ml-1.5 align-middle text-xs font-extrabold text-brand-600">· Admin</span>}
          </h1>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-bg-secondary px-3 py-1.5 text-xs font-bold text-hint">
          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
          Ochiq
        </div>
      </div>
    </header>
  );
}

export default Header;
