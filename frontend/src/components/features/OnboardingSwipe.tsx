'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import { haptic } from '@/hooks/useTelegram';

export const ONBOARDING_STORAGE_KEY = 'pizza-kuryer:onboarding-done';

/** Onboarding ko'rilganmi (localStorage) */
export function isOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
  } catch {
    /* private rejim: keyingi safar yana ko'rinadi */
  }
}

interface Slide {
  title: string;
  text: string;
  visual: ReactNode;
  bg: string;
}

/* ---------- Slayd vizuallari ---------- */
function HotPizzaVisual() {
  return (
    <div className="relative flex size-64 items-center justify-center">
      <div className="absolute inset-6 rounded-full bg-brand-400/30 blur-2xl" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/pizza-hero.svg" alt="Issiq pitsa" className="relative size-56 animate-float drop-shadow-2xl" />
      <span className="absolute top-2 left-10 animate-float text-3xl [animation-delay:0.4s]">♨️</span>
      <span className="absolute right-4 bottom-8 animate-float text-4xl [animation-delay:0.8s]">🛵</span>
    </div>
  );
}

function StepsVisual() {
  const steps = [
    { n: 1, icon: '🍕', label: 'Tanlang' },
    { n: 2, icon: '💳', label: "To'lang" },
    { n: 3, icon: '😋', label: 'Boshlang' },
  ];
  return (
    <div className="flex w-full max-w-xs items-center justify-between">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-2 animate-slide-up" style={{ animationDelay: `${i * 150}ms` }}>
            <div className="relative flex size-20 items-center justify-center rounded-3xl bg-white text-4xl shadow-xl shadow-brand-500/20 dark:bg-white/10">
              {s.icon}
              <span className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent text-sm font-black text-white">
                {s.n}
              </span>
            </div>
            <span className="text-sm font-extrabold text-text">{s.label}</span>
          </div>
          {i < steps.length - 1 && <span className="mx-1 mb-7 text-xl font-black text-brand-400">→</span>}
        </div>
      ))}
    </div>
  );
}

function CommunityVisual() {
  const faces = ['👨', '👩', '🧔', '👧', '👴', '👩‍🦱'];
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex -space-x-3">
        {faces.map((f, i) => (
          <span
            key={i}
            className="flex size-14 animate-slide-up items-center justify-center rounded-full border-4 border-bg bg-brand-100 text-2xl dark:bg-brand-500/20"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {f}
          </span>
        ))}
      </div>
      <div className="bg-gradient-to-r from-brand-500 to-accent bg-clip-text text-6xl font-black text-transparent">
        10,000+
      </div>
      <div className="flex gap-1 text-2xl">⭐⭐⭐⭐⭐</div>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    title: 'Sizni issiq va mazali pitsa yo‘qligi qiynayabdimi?',
    text: 'Biz tezda yetkazib beramiz!',
    visual: <HotPizzaVisual />,
    bg: 'from-brand-100 via-bg to-bg dark:from-brand-500/15',
  },
  {
    title: '1-2-3 qadamda buyurtma',
    text: 'Tanlang → To‘lang → Boshlang!',
    visual: <StepsVisual />,
    bg: 'from-rose-100 via-bg to-bg dark:from-rose-500/15',
  },
  {
    title: '10,000+ odam allaqachon biz bilan',
    text: 'Siz ham qo‘shiling!',
    visual: <CommunityVisual />,
    bg: 'from-amber-100 via-bg to-bg dark:from-amber-500/15',
  },
];

const SWIPE_THRESHOLD = 50; // px

interface OnboardingSwipeProps {
  onFinish: () => void;
}

export function OnboardingSwipe({ onFinish }: OnboardingSwipeProps) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef<number | null>(null);
  const isLast = index === SLIDES.length - 1;

  const goTo = (next: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, next));
    if (clamped !== index) haptic.select();
    setIndex(clamped);
  };

  const finish = () => {
    haptic.notify('success');
    markOnboardingDone();
    onFinish();
  };

  /* ---------- Swipe (touch + mouse uchun pointer events) ---------- */
  const onPointerDown = (e: React.PointerEvent) => {
    startX.current = e.clientX;
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startX.current === null) return;
    let dx = e.clientX - startX.current;
    // Chetlarda qarshilik
    if ((index === 0 && dx > 0) || (isLast && dx < 0)) dx *= 0.3;
    setDragX(dx);
  };
  const onPointerEnd = () => {
    if (startX.current === null) return;
    if (dragX < -SWIPE_THRESHOLD) goTo(index + 1);
    else if (dragX > SWIPE_THRESHOLD) goTo(index - 1);
    startX.current = null;
    setDragging(false);
    setDragX(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg">
      {/* Yuqori: o'tkazib yuborish */}
      <div className="pt-safe flex h-14 items-center justify-end px-4">
        {!isLast && (
          <button type="button" onClick={finish} className="px-2 py-1 text-sm font-bold text-hint">
            O‘tkazib yuborish
          </button>
        )}
      </div>

      {/* Slaydlar */}
      <div
        className="relative flex-1 touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerLeave={onPointerEnd}
      >
        <div
          className="flex h-full"
          style={{
            width: `${SLIDES.length * 100}%`,
            transform: `translateX(calc(${(-index * 100) / SLIDES.length}% + ${dragX}px))`,
            transition: !dragging ? 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }}
        >
          {SLIDES.map((slide, i) => (
            <section
              key={i}
              aria-hidden={i !== index}
              className={`flex h-full flex-col items-center justify-center gap-10 bg-gradient-to-b px-8 text-center ${slide.bg}`}
              style={{ width: `${100 / SLIDES.length}%` }}
            >
              <div className="flex min-h-64 items-center justify-center">{i === index && slide.visual}</div>
              <div className="flex max-w-sm flex-col gap-3">
                <h2 className="text-2xl leading-tight font-black text-text">{slide.title}</h2>
                <p className="text-lg font-bold text-brand-600 dark:text-brand-400">{slide.text}</p>
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Pastki qism: nuqtalar va tugma */}
      <div className="pb-safe flex flex-col items-center gap-6 px-6 pt-4">
        <div className="flex gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1}-slayd`}
              onClick={() => goTo(i)}
              className={`h-2.5 rounded-full transition-all ${i === index ? 'w-8 bg-brand-500' : 'w-2.5 bg-hint/30'}`}
            />
          ))}
        </div>

        {isLast ? (
          <Button size="xl" fullWidth onClick={finish} className="animate-slide-up" rightIcon={<span>🚀</span>}>
            BOSHLASH
          </Button>
        ) : (
          <Button size="xl" variant="secondary" fullWidth onClick={() => goTo(index + 1)} rightIcon={<span>→</span>}>
            Keyingi
          </Button>
        )}
        <div className="h-2" />
      </div>
    </div>
  );
}

export default OnboardingSwipe;
