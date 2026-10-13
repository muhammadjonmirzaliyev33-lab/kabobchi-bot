'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PaymentMethods } from '@/components/features/PaymentMethods';
import { Button, Input } from '@/components/ui';
import { useCart } from '@/hooks/useCart';
import { getWebApp, haptic, useTelegram } from '@/hooks/useTelegram';
import { createOrder, type Order, type PaymentMethod } from '@/lib/api';
import { formatSum } from '@/lib/utils';
import { toOrderPayload, unitPrice, useCartStore } from '@/store/cartStore';

/* =====================================================================
 * Checkout: kontakt ma'lumotlari, to'lov turi va "Buyurtma berish".
 * POST /orders -> backend admin (1027530770) ga darhol Telegram xabari yuboradi.
 * Stars tanlansa Telegram invoysi (WebApp.openInvoice) ochiladi.
 * ===================================================================== */
const CONTACT_KEY = 'pizza-kuryer:contact';

interface Contact {
  name: string;
  phone: string;
  address: string;
  comment: string;
}

type PayState = 'none' | 'pending' | 'paid' | 'cancelled' | 'failed';

function readContact(): Partial<Contact> {
  try {
    return JSON.parse(localStorage.getItem(CONTACT_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveContact(c: Contact) {
  try {
    localStorage.setItem(CONTACT_KEY, JSON.stringify({ name: c.name, phone: c.phone, address: c.address }));
  } catch {
    /* localStorage mavjud emas */
  }
}

function alertUser(text: string) {
  const wa = getWebApp();
  if (wa) wa.showAlert(text);
  else window.alert(text);
}

export default function CheckoutPage() {
  const router = useRouter();
  const { webApp, user, profile } = useTelegram();
  const { hydrated, items, count, subtotal, sauceTotal, deliveryFee, total, clear } = useCart();

  const [contact, setContact] = useState<Contact>({ name: '', phone: '', address: '', comment: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Contact, string>>>({});
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [payState, setPayState] = useState<PayState>('none');

  // Saqlangan kontakt + Telegram ismi + backend'dagi telefon
  useEffect(() => {
    const saved = readContact();
    setContact((c) => ({
      ...c,
      name: c.name || saved.name || [user?.first_name, user?.last_name].filter(Boolean).join(' '),
      phone: c.phone || saved.phone || profile?.phone || '',
      address: c.address || saved.address || '',
    }));
  }, [user, profile]);

  const goBack = useCallback(() => {
    if (order) router.replace('/');
    else router.replace('/?tab=cart');
  }, [order, router]);

  // Telegram "Orqaga" tugmasi
  useEffect(() => {
    const back = webApp?.BackButton;
    if (!back) return;
    back.show();
    back.onClick(goBack);
    return () => {
      back.offClick(goBack);
      back.hide();
    };
  }, [webApp, goBack]);

  const set = (key: keyof Contact) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setContact((c) => ({ ...c, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
  };

  /** Stars invoysini ochish (buyurtma yaratilgandan keyin yoki "Qayta to'lash") */
  const openStarsInvoice = (link: string) => {
    const wa = getWebApp();
    if (!wa?.openInvoice) {
      alertUser('Telegram Stars bilan to‘lash uchun ilovani Telegram ichida oching.');
      return;
    }
    setPayState('pending');
    wa.openInvoice(link, (status) => {
      if (status === 'paid') haptic.notify('success');
      else if (status === 'failed') haptic.notify('error');
      setPayState(status === 'paid' ? 'paid' : status === 'pending' ? 'pending' : status);
    });
  };

  const openPaymentUrl = (url: string) => {
    const wa = getWebApp();
    if (wa) wa.openLink(url);
    else window.open(url, '_blank', 'noopener');
  };

  const submit = async () => {
    const next: typeof errors = {};
    if (contact.name.trim().length < 2) next.name = 'Ismingizni kiriting';
    if (!/^\+?\d[\d\s\-()]{6,20}$/.test(contact.phone.trim())) next.phone = 'Telefon raqam noto‘g‘ri (masalan: +998901234567)';
    if (contact.address.trim().length < 5) next.address = 'Yetkazish manzilini kiriting';
    setErrors(next);
    if (Object.keys(next).length) {
      haptic.notify('error');
      return;
    }
    if (!method) {
      haptic.notify('error');
      setSubmitError('To‘lov turini tanlang');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createOrder({
        ...toOrderPayload(useCartStore.getState()),
        payment_method: method,
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        address: contact.address.trim(),
        comment: contact.comment.trim() || undefined,
      });
      saveContact(contact);
      clear();
      haptic.notify('success');
      setOrder(created);
      window.scrollTo({ top: 0 });

      const payment = created.payment;
      if (payment?.type === 'stars' && payment.invoice_link) openStarsInvoice(payment.invoice_link);
      else if ((payment?.type === 'click' || payment?.type === 'payme') && payment.payment_url) {
        setPayState('pending');
        openPaymentUrl(payment.payment_url);
      }
    } catch (err) {
      haptic.notify('error');
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (order) {
    return (
      <SuccessView
        order={order}
        payState={payState}
        onRetryStars={() => order.payment?.invoice_link && openStarsInvoice(order.payment.invoice_link)}
        onOpenPayment={() => order.payment?.payment_url && openPaymentUrl(order.payment.payment_url)}
        onHome={() => router.replace('/')}
      />
    );
  }

  if (!hydrated) return null;

  if (count === 0) {
    return (
      <Centered icon="🛒" title="Savatcha bo‘sh" text="Buyurtma berish uchun avval pitsa tanlang.">
        <Button onClick={() => router.replace('/?tab=catalog')}>Katalogga o‘tish</Button>
      </Centered>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-4 pt-safe pb-32">
      <header className="flex items-center gap-3 pt-4">
        {!webApp && (
          <button type="button" onClick={goBack} aria-label="Orqaga" className="text-2xl font-black">
            ←
          </button>
        )}
        <h1 className="text-2xl font-black">Rasmiylashtirish</h1>
      </header>

      {/* Buyurtma tarkibi */}
      <Section title="🍕 Buyurtmangiz">
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.key} className="flex items-center justify-between gap-3 text-sm font-bold">
              <span className="min-w-0 truncate">
                {i.product.name}
                {i.size ? <span className="text-hint"> · {i.size.label}</span> : null}
                <span className="text-hint"> × {i.quantity}</span>
              </span>
              <span className="shrink-0 tabular-nums">{formatSum(unitPrice(i) * i.quantity)}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Kontakt */}
      <Section title="📍 Yetkazib berish">
        <div className="flex flex-col gap-3">
          <Input label="Ism" value={contact.name} onChange={set('name')} error={errors.name} autoComplete="name" />
          <Input
            label="Telefon"
            type="tel"
            inputMode="tel"
            placeholder="+998 90 123 45 67"
            value={contact.phone}
            onChange={set('phone')}
            error={errors.phone}
            autoComplete="tel"
          />
          <Input
            label="Manzil"
            placeholder="Shahar, ko‘cha, uy, xonadon"
            value={contact.address}
            onChange={set('address')}
            error={errors.address}
            autoComplete="street-address"
          />
          <Input label="Izoh (ixtiyoriy)" placeholder="Domofon, mo‘ljal..." value={contact.comment} onChange={set('comment')} />
        </div>
      </Section>

      {/* To'lov turi */}
      <Section title="💳 To‘lov turi">
        <PaymentMethods value={method} onChange={setMethod} total={total} />
      </Section>

      {/* Hisob */}
      <section className="flex flex-col gap-2 rounded-3xl bg-bg-secondary p-4">
        <Row label="Mahsulotlar" value={formatSum(subtotal)} />
        {sauceTotal > 0 && <Row label="🧀 Pishloqli sous" value={`+${formatSum(sauceTotal)}`} />}
        <Row label="Yetkazib berish" value={deliveryFee > 0 ? formatSum(deliveryFee) : 'Bepul'} />
        <div className="my-1 border-t border-dashed border-line" />
        <div className="flex items-end justify-between">
          <span className="text-lg font-black">Jami</span>
          <span className="text-3xl font-black text-accent tabular-nums">{formatSum(total)}</span>
        </div>
      </section>

      {submitError && <p className="text-center text-sm font-bold text-red-500">{submitError}</p>}

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-6">
        <Button size="lg" fullWidth loading={submitting} onClick={submit} className="h-14 justify-between px-5">
          <span>Buyurtma berish</span>
          <span className="tabular-nums">{formatSum(total)}</span>
        </Button>
      </div>
    </div>
  );
}

/* ---------- Buyurtma qabul qilindi ---------- */
function SuccessView({
  order,
  payState,
  onRetryStars,
  onOpenPayment,
  onHome,
}: {
  order: Order;
  payState: PayState;
  onRetryStars: () => void;
  onOpenPayment: () => void;
  onHome: () => void;
}) {
  const payment = order.payment;
  let payNote: ReactNode = null;

  if (order.payment_method === 'stars') {
    if (payState === 'paid') payNote = <Note tone="success">⭐ To‘lov qabul qilindi. Rahmat!</Note>;
    else if (payment?.invoice_link)
      payNote = (
        <div className="flex flex-col gap-2">
          <Note tone="warning">
            {payState === 'failed' ? 'To‘lov amalga oshmadi.' : 'To‘lov hali yakunlanmadi.'} Buyurtma saqlandi.
          </Note>
          <Button variant="secondary" onClick={onRetryStars}>
            ⭐ {payment.stars_amount} Stars bilan to‘lash
          </Button>
        </div>
      );
    else payNote = <Note tone="warning">{payment?.error || 'Operator to‘lov bo‘yicha siz bilan bog‘lanadi.'}</Note>;
  } else if (order.payment_method === 'click' || order.payment_method === 'payme') {
    payNote = payment?.payment_url ? (
      <Button variant="secondary" onClick={onOpenPayment}>
        💳 {order.payment_method === 'click' ? 'Click' : 'Payme'} orqali to‘lash
      </Button>
    ) : (
      <Note tone="warning">Karta orqali to‘lov bo‘yicha operator siz bilan bog‘lanadi.</Note>
    );
  } else {
    payNote = <Note tone="success">💵 To‘lovni kuryerga naqd berasiz.</Note>;
  }

  return (
    <Centered icon="🎉" title={`Buyurtma #${order.id} qabul qilindi!`} text="Operator tez orada bog‘lanadi. Holat o‘zgarganda bot orqali xabar olasiz.">
      <p className="text-3xl font-black text-accent tabular-nums">{formatSum(order.total)}</p>
      <div className="flex w-full flex-col gap-3">{payNote}</div>
      <Button variant="ghost" onClick={onHome}>
        Bosh sahifaga qaytish
      </Button>
    </Centered>
  );
}

/* ---------- Kichik bloklar ---------- */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="px-1 text-lg font-black">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm font-bold">
      <span className="text-hint">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Note({ tone, children }: { tone: 'success' | 'warning'; children: ReactNode }) {
  return (
    <p
      className={
        tone === 'success'
          ? 'rounded-2xl bg-emerald-500/10 p-3 text-center text-sm font-bold text-emerald-700 dark:text-emerald-300'
          : 'rounded-2xl bg-amber-500/10 p-3 text-center text-sm font-bold text-amber-700 dark:text-amber-300'
      }
    >
      {children}
    </p>
  );
}

function Centered({ icon, title, text, children }: { icon: string; title: string; text: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg animate-fade-in flex-col items-center justify-center gap-4 px-8 text-center">
      <span className="text-6xl">{icon}</span>
      <h1 className="text-2xl font-black">{title}</h1>
      <p className="font-semibold text-hint">{text}</p>
      {children}
    </div>
  );
}
