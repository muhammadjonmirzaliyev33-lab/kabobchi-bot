'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic, useTelegram } from '@/hooks/useTelegram';

/* =====================================================================
 * Stories: Instagram uslubidagi doira shaklidagi chegirmalar va videolar.
 * Hozircha statik ro'yxat; keyin backend'dan (masalan /api/stories) olinadi:
 * <StoriesBlock stories={data} />
 * ===================================================================== */
export interface StorySlide {
  type: 'image' | 'video';
  src: string;
  /** Video yuklanmaguncha / xato bo'lsa ko'rsatiladigan rasm */
  poster?: string;
  /** Rasm uchun ko'rsatish vaqti (ms). Video o'z davomiyligida o'ynaydi */
  duration?: number;
  caption?: string;
}

export interface Story {
  id: string;
  title: string;
  cover: string;
  /** Doira ustidagi kichik yorliq: "-20%" */
  badge?: string;
  slides: StorySlide[];
}

export const DEFAULT_STORIES: Story[] = [
  {
    id: 'promo-20',
    title: 'Chegirma',
    cover: '/images/story-sale.svg',
    badge: 'HOT',
    slides: [
      { type: 'image', src: '/images/story-sale.svg', caption: 'Har kuni 11:00–15:00 gacha barcha pitsalarga 20% chegirma!' },
      { type: 'image', src: '/images/story-combo.svg', caption: '2 ta katta pitsa + 1.5L ichimlik = kombo narxi' },
    ],
  },
  {
    id: 'new-pizza',
    title: 'Yangilik',
    cover: '/images/pizza-hero.svg',
    badge: 'NEW',
    slides: [{ type: 'image', src: '/images/pizza-hero.svg', caption: 'Yangi "Pepperoni Fire" — achchiq sevuvchilar uchun 🌶' }],
  },
  {
    id: 'video-kitchen',
    title: 'Oshxona',
    cover: '/images/story-video.svg',
    slides: [
      {
        type: 'video',
        // Namuna video: o'zingizning videongizni public/images/ ga qo'yib, yo'lini almashtiring
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        poster: '/images/story-video.svg',
        caption: 'Pitsalarimiz qanday tayyorlanishini ko‘ring 🔥',
      },
    ],
  },
  {
    id: 'free-delivery',
    title: 'Yetkazish',
    cover: '/images/story-delivery.svg',
    slides: [{ type: 'image', src: '/images/story-delivery.svg', caption: '150 000 so‘mdan ortiq buyurtmalarga yetkazish bepul!' }],
  },
  {
    id: 'combo',
    title: 'Kombo',
    cover: '/images/story-combo.svg',
    slides: [{ type: 'image', src: '/images/story-combo.svg', caption: 'Do‘stlar bilan kombo — tejamkor va mazali' }],
  },
];

const SEEN_KEY = 'pizza-kuryer:stories-seen';
const DEFAULT_IMAGE_DURATION = 5000;

function loadSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
  } catch {
    return [];
  }
}

/* ---------- Doiralar ro'yxati ---------- */
interface StoriesBlockProps {
  stories?: Story[];
}

export function StoriesBlock({ stories = DEFAULT_STORIES }: StoriesBlockProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [seen, setSeen] = useState<string[]>([]);

  useEffect(() => setSeen(loadSeen()), []);

  const markSeen = useCallback((id: string) => {
    setSeen((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify(next));
      } catch {
        /* e'tiborsiz */
      }
      return next;
    });
  }, []);

  if (stories.length === 0) return null;

  return (
    <section aria-label="Stories" className="py-2">
      <ul className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
        {stories.map((story, i) => {
          const isSeen = seen.includes(story.id);
          return (
            <li key={story.id} className="shrink-0">
              <button
                type="button"
                onClick={() => {
                  haptic.impact('light');
                  setOpenIndex(i);
                }}
                className="flex w-[76px] flex-col items-center gap-1.5"
              >
                <span className={`relative rounded-full p-[3px] ${isSeen ? 'story-ring-seen' : 'story-ring'}`}>
                  <span className="block rounded-full bg-bg p-[2px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={story.cover} alt={story.title} className="size-[62px] rounded-full bg-brand-50 object-cover" />
                  </span>
                  {story.badge && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] leading-none font-black whitespace-nowrap text-white ring-2 ring-bg">
                      {story.badge}
                    </span>
                  )}
                  {story.slides.some((s) => s.type === 'video') && (
                    <span className="absolute top-0 right-0 flex size-5 items-center justify-center rounded-full bg-black/70 text-[9px] text-white ring-2 ring-bg">
                      ▶
                    </span>
                  )}
                </span>
                <span className={`w-full truncate text-center text-xs font-bold ${isSeen ? 'text-hint' : 'text-text'}`}>
                  {story.title}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {openIndex !== null && (
        <StoryViewer
          stories={stories}
          startIndex={openIndex}
          onSeen={markSeen}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </section>
  );
}

/* ---------- To'liq ekranli ko'ruvchi ---------- */
interface StoryViewerProps {
  stories: Story[];
  startIndex: number;
  onSeen: (id: string) => void;
  onClose: () => void;
}

function StoryViewer({ stories, startIndex, onSeen, onClose }: StoryViewerProps) {
  const { webApp } = useTelegram();
  const [storyIdx, setStoryIdx] = useState(startIndex);
  const [slideIdx, setSlideIdx] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1
  const [paused, setPaused] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pressStart = useRef(0);

  const story = stories[storyIdx];
  const slide = story.slides[slideIdx];

  useEffect(() => onSeen(story.id), [story.id, onSeen]);

  const next = useCallback(() => {
    setProgress(0);
    setVideoFailed(false);
    if (slideIdx < story.slides.length - 1) return setSlideIdx((i) => i + 1);
    if (storyIdx < stories.length - 1) {
      setStoryIdx((i) => i + 1);
      return setSlideIdx(0);
    }
    onClose();
  }, [slideIdx, storyIdx, story.slides.length, stories.length, onClose]);

  const prev = useCallback(() => {
    setProgress(0);
    setVideoFailed(false);
    if (slideIdx > 0) return setSlideIdx((i) => i - 1);
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
      setSlideIdx(0);
    }
  }, [slideIdx, storyIdx]);

  // Rasm (yoki ishlamagan video) uchun taymer
  const useTimer = slide.type === 'image' || videoFailed;
  useEffect(() => {
    if (!useTimer || paused) return;
    const duration = slide.duration ?? DEFAULT_IMAGE_DURATION;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setProgress((p) => {
        const np = p + dt / duration;
        return np >= 1 ? 1 : np;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [useTimer, paused, slide, storyIdx, slideIdx]);

  useEffect(() => {
    if (progress >= 1) next();
  }, [progress, next]);

  // Video pauza/davom
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play().catch(() => {});
  }, [paused, slide]);

  // Telegram BackButton va Escape bilan yopish
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const back = webApp?.BackButton;
    back?.show();
    back?.onClick(onClose);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      back?.offClick(onClose);
      back?.hide();
      document.body.style.overflow = '';
    };
  }, [webApp, onClose]);

  // Bosib turish = pauza, qisqa bosish = chap/o'ng
  const onPointerDown = () => {
    pressStart.current = Date.now();
    setPaused(true);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setPaused(false);
    if (Date.now() - pressStart.current > 250) return; // uzoq bosish edi
    const { left, width } = e.currentTarget.getBoundingClientRect();
    haptic.select();
    if (e.clientX - left < width / 3) prev();
    else next();
  };

  // Portal: ota elementlardagi transform/animatsiya stacking context'idan chiqarish
  return createPortal(
    <div className="fixed inset-0 z-[60] flex animate-fade-in flex-col bg-black text-white">
      {/* Progress chiziqlari */}
      <div className="pt-safe absolute inset-x-0 top-0 z-20 px-3">
        <div className="flex gap-1 pt-3">
          {story.slides.map((_, i) => (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white"
                style={{ width: `${i < slideIdx ? 100 : i === slideIdx ? progress * 100 : 0}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={story.cover} alt="" className="size-8 rounded-full bg-white object-cover" />
          <span className="text-sm font-extrabold">{story.title}</span>
          <button
            type="button"
            aria-label="Yopish"
            onClick={onClose}
            className="ml-auto flex size-9 items-center justify-center rounded-full text-2xl"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Kontent */}
      <div
        className="relative flex flex-1 items-center justify-center select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setPaused(false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {slide.type === 'video' && !videoFailed ? (
          <video
            key={slide.src}
            ref={videoRef}
            src={slide.src}
            poster={slide.poster}
            className="h-full w-full object-contain"
            autoPlay
            playsInline
            muted
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProgress(Math.min(v.currentTime / v.duration, 0.999));
            }}
            onEnded={next}
            onError={() => setVideoFailed(true)}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${storyIdx}-${slideIdx}`}
            src={slide.type === 'video' ? (slide.poster ?? story.cover) : slide.src}
            alt={slide.caption ?? story.title}
            className="max-h-full w-full animate-fade-in object-contain"
            draggable={false}
          />
        )}

        {slide.caption && (
          <div className="pb-safe absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pt-16">
            <p className="pb-6 text-lg leading-snug font-extrabold">{slide.caption}</p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default StoriesBlock;
