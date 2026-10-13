'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { getWebApp, haptic } from '@/hooks/useTelegram';
import {
  getAdminOrders,
  getOrderStats,
  NEXT_STATUSES,
  ORDER_GROUPS,
  STATUS_LABELS,
  updateOrderStatus,
  type AdminOrder,
  type OrderGroup,
  type OrderStatus,
} from '@/lib/api';
import { cn, formatSum } from '@/lib/utils';

/* =====================================================================
 * Buyurtmalarni boshqarish: Yangi / Bajarilayotgan / Yakunlangan.
 * Status o'zgarganda backend mijozga bot orqali avtomatik xabar yuboradi.
 * ===================================================================== */
const REFRESH_MS = 30_000;

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  accepted: 'Qabul qilish',
  on_the_way: '🚚 Kuryerga berildi',
  delivered: '✅ Bajarildi',
  cancelled: 'Bekor qilish',
};

const PAYMENT_LABELS: Record<string, string> = {
  stars: '⭐ Stars',
  click: '💳 Click',
  payme: '💳 Payme',
  cash: '💵 Naqd',
};

const STATUS_TONE: Record<OrderStatus, 'brand' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  new: 'brand',
  accepted: 'warning',
  on_the_way: 'warning',
  delivered: 'success',
  cancelled: 'danger',
};

function confirmAction(text: string): Promise<boolean> {
  const wa = getWebApp();
  if (wa) return new Promise((resolve) => wa.showConfirm(text, (ok) => resolve(Boolean(ok))));
  return Promise.resolve(window.confirm(text));
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function OrderManager() {
  const [group, setGroup] = useState<OrderGroup>('new');
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [counts, setCounts] = useState<Record<OrderGroup, number>>({ new: 0, active: 0, done: 0 });
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setOrders(null);
      setError(null);
      try {
        const [list, stats] = await Promise.all([getAdminOrders(group), getOrderStats()]);
        setOrders(list);
        const next = { new: 0, active: 0, done: 0 };
        for (const s of stats) {
          const g = (Object.keys(ORDER_GROUPS) as OrderGroup[]).find((k) => ORDER_GROUPS[k].statuses.includes(s.status));
          if (g) next[g] += s.count;
        }
        setCounts(next);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [group]
  );

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const changeStatus = async (order: AdminOrder, status: OrderStatus) => {
    if (status === 'cancelled' && !(await confirmAction(`Buyurtma #${order.id} bekor qilinsinmi?`))) return;
    setBusyId(order.id);
    try {
      await updateOrderStatus(order.id, status);
      haptic.notify('success');
      await load(true);
    } catch (err) {
      haptic.notify('error');
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Bo'limlar */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-bg-secondary p-1">
        {(Object.keys(ORDER_GROUPS) as OrderGroup[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => {
              if (g === group) return;
              haptic.select();
              setGroup(g);
            }}
            className={cn(
              'flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-extrabold transition',
              g === group ? 'bg-bg text-text shadow-sm' : 'text-hint'
            )}
          >
            {ORDER_GROUPS[g].label}
            {counts[g] > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] leading-[18px]',
                  g === 'new' ? 'bg-accent text-white' : 'bg-hint/20 text-hint'
                )}
              >
                {counts[g]}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-red-500/10 p-3 text-sm font-bold text-red-600">
          <span>{error}</span>
          <button type="button" onClick={() => load()} className="shrink-0 underline">
            Yangilash
          </button>
        </div>
      )}

      {!orders && !error && [0, 1, 2].map((i) => <div key={i} className="h-44 animate-pulse rounded-3xl bg-bg-secondary" />)}

      {orders?.length === 0 && (
        <p className="py-12 text-center font-bold text-hint">Bu bo‘limda buyurtmalar yo‘q ✅</p>
      )}

      {orders?.map((order) => (
        <OrderCard key={order.id} order={order} busy={busyId === order.id} onChange={(s) => changeStatus(order, s)} />
      ))}
    </div>
  );
}

function OrderCard({
  order,
  busy,
  onChange,
}: {
  order: AdminOrder;
  busy: boolean;
  onChange: (status: OrderStatus) => void;
}) {
  const actions = NEXT_STATUSES[order.status];
  const primary = actions.filter((s) => s !== 'cancelled');

  return (
    <article className="flex animate-slide-up flex-col gap-3 rounded-3xl bg-bg-secondary p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-black">#{order.id}</h3>
          <p className="text-xs font-semibold text-hint">{timeOf(order.created_at)}</p>
        </div>
        <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABELS[order.status]}</Badge>
      </div>

      <div className="flex flex-col gap-1 text-sm font-semibold">
        <p>
          👤 {order.customer_name}
          {order.username && <span className="text-hint"> · @{order.username}</span>}
        </p>
        <a href={`tel:${order.phone.replace(/[^\d+]/g, '')}`} className="text-link">
          📞 {order.phone}
        </a>
        {order.address && <p>📍 {order.address}</p>}
        {order.comment && <p className="text-hint">💬 {order.comment}</p>}
      </div>

      <ul className="flex flex-col gap-1 rounded-2xl bg-bg p-3 text-sm font-bold">
        {order.items.map((i, idx) => (
          <li key={idx} className="flex justify-between gap-2">
            <span className="min-w-0 truncate">
              {i.name || i.product_name} × {i.quantity}
            </span>
            <span className="shrink-0 tabular-nums">{formatSum(i.line_total)}</span>
          </li>
        ))}
        {order.has_sauce && (
          <li className="flex justify-between gap-2 text-hint">
            <span>🧀 Pishloqli sous</span>
            <span className="tabular-nums">{formatSum(order.sauce_price)}</span>
          </li>
        )}
      </ul>

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-hint">
          {PAYMENT_LABELS[order.payment_method] ?? order.payment_method} ·{' '}
          {order.payment_status === 'paid' ? (
            <span className="text-emerald-600">to‘langan</span>
          ) : (
            'to‘lanmagan'
          )}
        </span>
        <span className="text-xl font-black text-accent tabular-nums">{formatSum(order.total)}</span>
      </div>

      {actions.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${primary.length}, minmax(0, 1fr))` }}>
            {primary.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={s === 'accepted' ? 'secondary' : 'primary'}
                loading={busy}
                onClick={() => onChange(s)}
                className="h-11 whitespace-nowrap"
              >
                {ACTION_LABELS[s]}
              </Button>
            ))}
          </div>
          {actions.includes('cancelled') && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onChange('cancelled')}
              className="py-1 text-sm font-extrabold text-red-500 disabled:opacity-50"
            >
              {ACTION_LABELS.cancelled}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default OrderManager;
