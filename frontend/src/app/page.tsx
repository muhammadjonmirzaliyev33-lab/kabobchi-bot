'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CartList } from '@/components/features/CartList';
import { OnboardingSwipe, isOnboardingDone } from '@/components/features/OnboardingSwipe';
import { OrderBump } from '@/components/features/OrderBump';
import { ProductBottomSheet } from '@/components/features/ProductBottomSheet';
import { ProductCard, ProductCardSkeleton } from '@/components/features/ProductCard';
import { StoriesBlock } from '@/components/features/StoriesBlock';
import { Header } from '@/components/layout/Header';
import { BottomNavigation, type NavTab } from '@/components/layout/BottomNavigation';
import { Badge, Button } from '@/components/ui';
import { useCart } from '@/hooks/useCart';
import { haptic, useTelegram } from '@/hooks/useTelegram';
import { useMenu, type CartCalculation, type Menu, type Product } from '@/lib/api';
import { cn, formatSum, PRODUCT_TAGS, type ProductTag } from '@/lib/utils';
import { useCartStore } from '@/store/cartStore';

type Stage = 'loading' | 'onboarding' | 'app';

/* =====================================================================
 * Bosh sahifa: onboarding tekshiruvi va tablar bo'yicha router.
 * Mini App bitta sahifada ishlaydi; har bir tab alohida "view".
 * Mahsulot oynasi (Bottom Sheet) shu yerda: istalgan tabdan ochiladi.
 * ===================================================================== */
export default function Page() {
  const router = useRouter();
  const { webApp, isReady } = useTelegram();
  const [stage, setStage] = useState<Stage>('loading');
  const [tab, setTab] = useState<NavTab>('home');
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const menuState = useMenu();

  // Sous va yetkazish narxi backend'dan (SAUCE_PRICE, DELIVERY_FEE)
  const meta = menuState.menu?.meta;
  useEffect(() => {
    if (meta) useCartStore.getState().setPricing({ saucePrice: meta.sauce_price, deliveryFee: meta.delivery_fee });
  }, [meta]);

  // localStorage faqat brauzerda: mount'dan keyin tekshiramiz
  useEffect(() => {
    if (!isReady) return;
    setStage(isOnboardingDone() ? 'app' : 'onboarding');
  }, [isReady]);

  // /?tab=cart kabi havola (checkout'dan qaytish) kerakli tabni ochadi
  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('tab');
    if (initial === 'catalog' || initial === 'cart' || initial === 'profile') setTab(initial);
  }, []);

  // Telegram "Orqaga" tugmasi: avval Bottom Sheet'ni yopadi, keyin bosh sahifaga qaytaradi
  useEffect(() => {
    const back = webApp?.BackButton;
    if (!back || stage !== 'app') return;
    const goBack = () => (sheetProduct ? setSheetProduct(null) : setTab('home'));
    if (tab === 'home' && !sheetProduct) back.hide();
    else {
      back.show();
      back.onClick(goBack);
    }
    return () => back.offClick(goBack);
  }, [webApp, tab, stage, sheetProduct]);

  const changeTab = (next: NavTab) => {
    // Admin panel alohida marshrutda (/admin)
    if (next === 'admin') {
      router.push('/admin');
      return;
    }
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  if (stage === 'loading') return <Splash />;
  if (stage === 'onboarding') return <OnboardingSwipe onFinish={() => setStage('app')} />;

  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-[calc(var(--app-nav-height)+env(safe-area-inset-bottom))]">
      <main key={tab} className="animate-fade-in">
        {tab === 'home' && <HomeView onNavigate={changeTab} />}
        {tab === 'catalog' && <CatalogView {...menuState} onOpen={setSheetProduct} />}
        {tab === 'cart' && (
          <CartView
            menu={menuState.menu}
            onNavigate={changeTab}
            onOpen={setSheetProduct}
            onCheckout={() => router.push('/checkout')}
          />
        )}
        {tab === 'profile' && <ProfileView />}
      </main>
      <BottomNavigation active={tab} onChange={changeTab} />
      <ProductBottomSheet product={sheetProduct} onClose={() => setSheetProduct(null)} />
    </div>
  );
}

/* ---------- Splash ---------- */
function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg">
      <span className="animate-float text-6xl">🍕</span>
      <span className="text-lg font-black text-text">Pizza Kuryer</span>
    </div>
  );
}

/* ---------- Bosh sahifa ---------- */
function HomeView({ onNavigate }: { onNavigate: (tab: NavTab) => void }) {
  return (
    <>
      <Header />
      <StoriesBlock />

      <section className="px-4 pt-3">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-500 to-accent p-5 text-white shadow-xl shadow-brand-500/25">
          <div className="relative z-10 flex max-w-[62%] flex-col gap-3">
            <Badge className="w-fit bg-white/20 text-white">🔥 Issiq taklif</Badge>
            <h2 className="text-2xl leading-tight font-black">Issiq pitsa eshigingizgacha</h2>
            <Button
              size="sm"
              variant="secondary"
              className="w-fit bg-white text-brand-700"
              onClick={() => onNavigate('catalog')}
            >
              Buyurtma berish →
            </Button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/pizza-hero.svg"
            alt=""
            className="absolute -right-8 -bottom-8 size-44 rotate-12 drop-shadow-2xl"
          />
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3 px-4 pt-4">
        {[
          { icon: '🍕', label: 'Tanlang' },
          { icon: '💳', label: 'To‘lang' },
          { icon: '🛵', label: 'Kuting' },
        ].map((s, i) => (
          <div key={s.label} className="flex flex-col items-center gap-1 rounded-2xl bg-bg-secondary py-3">
            <span className="text-2xl">{s.icon}</span>
            <span className="text-xs font-extrabold text-hint">
              {i + 1}. {s.label}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

/* ---------- Katalog ---------- */
type Filter = { type: 'all' } | { type: 'tag'; tag: ProductTag } | { type: 'category'; id: number };

function CatalogView({
  menu,
  loading,
  error,
  reload,
  onOpen,
}: ReturnType<typeof useMenu> & { onOpen: (p: Product) => void }) {
  const [filter, setFilter] = useState<Filter>({ type: 'all' });

  const chips = useMemo(() => {
    const list: { id: string; label: string; filter: Filter }[] = [
      { id: 'all', label: 'Barchasi', filter: { type: 'all' } },
      ...(Object.keys(PRODUCT_TAGS) as ProductTag[]).map((tag) => ({
        id: `tag:${tag}`,
        label: `${PRODUCT_TAGS[tag].icon} ${PRODUCT_TAGS[tag].label}`,
        filter: { type: 'tag', tag } as Filter,
      })),
      ...(menu?.categories ?? []).map((c) => ({
        id: `cat:${c.id}`,
        label: c.name,
        filter: { type: 'category', id: c.id } as Filter,
      })),
    ];
    return list;
  }, [menu?.categories]);

  const activeId =
    filter.type === 'all' ? 'all' : filter.type === 'tag' ? `tag:${filter.tag}` : `cat:${filter.id}`;

  const products = useMemo(() => {
    const all = menu?.products ?? [];
    if (filter.type === 'tag') return all.filter((p) => p.tags?.includes(filter.tag));
    if (filter.type === 'category') return all.filter((p) => p.category_id === filter.id);
    return all;
  }, [menu?.products, filter]);

  return (
    <div className="flex flex-col">
      <div className="pt-safe sticky top-0 z-30 bg-bg/95 backdrop-blur-md">
        <h1 className="px-4 pt-4 pb-2 text-2xl font-black">Katalog</h1>
        {/* Gorizontal scroll kategoriyalari */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
          {chips.map((chip) => {
            const active = chip.id === activeId;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  if (!active) haptic.select();
                  setFilter(chip.filter);
                }}
                className={cn(
                  'h-9 shrink-0 rounded-full px-4 text-sm font-extrabold whitespace-nowrap transition active:scale-95',
                  active
                    ? 'bg-gradient-to-r from-brand-500 to-accent text-white shadow-md shadow-brand-500/30'
                    : 'bg-bg-secondary text-hint'
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <PlaceholderView icon="😕" title="Menyu yuklanmadi" text={error}>
          <Button onClick={reload}>Qayta urinish</Button>
        </PlaceholderView>
      ) : (
        <div className="grid grid-cols-2 gap-3 px-4 pt-1 pb-4">
          {loading && !menu
            ? Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)
            : products.map((p) => <ProductCard key={p.id} product={p} onOpen={onOpen} />)}
          {!loading && menu && products.length === 0 && (
            <p className="col-span-2 py-12 text-center font-bold text-hint">Bu bo‘limda hozircha mahsulot yo‘q</p>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Savatcha + Order Bump ---------- */
function CartView({
  menu,
  onNavigate,
  onOpen,
  onCheckout,
}: {
  menu: Menu | null;
  onNavigate: (tab: NavTab) => void;
  onOpen: (p: Product) => void;
  onCheckout: (calc: CartCalculation) => void;
}) {
  const { hydrated, count, subtotal, sauceTotal, deliveryFee, total, clear, validate, validating } = useCart();
  const [error, setError] = useState<string | null>(null);
  const drinks = useMemo(
    () => (menu?.products ?? []).filter((p) => /ichimlik/i.test(p.category_name ?? '')),
    [menu?.products]
  );

  if (!hydrated) return null;
  if (count === 0) {
    return (
      <PlaceholderView icon="🛒" title="Savatcha bo‘sh" text="Katalogdan sevimli pitsangizni tanlang.">
        <Button onClick={() => onNavigate('catalog')}>Katalogga o‘tish</Button>
      </PlaceholderView>
    );
  }

  const checkout = async () => {
    setError(null);
    try {
      const calc = await validate();
      haptic.notify('success');
      onCheckout(calc);
    } catch (err) {
      haptic.notify('error');
      setError((err as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-28">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">
          Savatcha <span className="text-hint">· {count}</span>
        </h1>
        <button
          type="button"
          onClick={() => {
            haptic.notify('warning');
            clear();
          }}
          className="text-sm font-extrabold text-hint"
        >
          Tozalash
        </button>
      </div>

      <CartList onItemClick={(item) => onOpen(item.product)} />
      <OrderBump drinks={drinks} />

      {/* Hisob */}
      <section className="flex flex-col gap-2 rounded-3xl bg-bg-secondary p-4">
        <SummaryRow label="Mahsulotlar" value={formatSum(subtotal)} />
        {sauceTotal > 0 && <SummaryRow label="🧀 Pishloqli sous" value={`+${formatSum(sauceTotal)}`} />}
        <SummaryRow
          label="Yetkazib berish"
          value={deliveryFee > 0 ? formatSum(deliveryFee) : <span className="text-emerald-600">Bepul</span>}
        />
        <div className="my-1 border-t border-dashed border-line" />
        <div className="flex items-end justify-between">
          <span className="text-lg font-black">Jami</span>
          <span key={total} className="animate-pop text-3xl font-black text-accent tabular-nums">
            {formatSum(total)}
          </span>
        </div>
      </section>
      {error && <p className="text-center text-sm font-bold text-red-500">{error}</p>}

      {/* Checkout: pastki menyu ustida yopishqoq */}
      <div className="fixed inset-x-0 bottom-[calc(var(--app-nav-height)+env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg px-4 pb-3">
        <Button size="lg" fullWidth loading={validating} onClick={checkout} className="h-14 justify-between px-5">
          <span>Rasmiylashtirish</span>
          <span className="tabular-nums">{formatSum(total)}</span>
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm font-bold">
      <span className="text-hint">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/* ---------- Profil ---------- */
function ProfileView() {
  const { user, profile, isAdmin, isTelegram } = useTelegram();
  const rows: [string, ReactNode][] = [
    ['Ism', [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '—'],
    ['Username', user?.username ? `@${user.username}` : '—'],
    ['Telegram ID', user?.id || '—'],
    ['Telefon', profile?.phone || '—'],
    ['Rol', isAdmin ? <Badge key="r">Admin</Badge> : <Badge key="r" tone="neutral">Mijoz</Badge>],
  ];
  return (
    <div className="flex flex-col gap-4 px-4 pt-6">
      <h1 className="text-2xl font-black">Profil</h1>
      <div className="divide-y divide-line overflow-hidden rounded-3xl bg-bg-secondary">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between px-4 py-3.5">
            <span className="font-semibold text-hint">{k}</span>
            <span className="font-bold">{v}</span>
          </div>
        ))}
      </div>
      {!isTelegram && (
        <p className="text-center text-sm text-hint">Ilova brauzerda ochilgan. To‘liq ishlashi uchun Telegram orqali oching.</p>
      )}
    </div>
  );
}

/* ---------- Bo'sh holat / xabar ---------- */
function PlaceholderView({ icon, title, text, children }: { icon: string; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="text-6xl">{icon}</span>
      <h1 className="text-2xl font-black">{title}</h1>
      <p className="font-semibold text-hint">{text}</p>
      {children}
    </div>
  );
}
