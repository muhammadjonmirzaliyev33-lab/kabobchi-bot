# Pizza Kuryer: Frontend (Telegram Mini App)

Next.js 15 (App Router) + TailwindCSS 4 + Zustand 5.

```bash
npm install
npm run dev      # http://localhost:3001 (backend 3000-portda)
npm run build && npm start
```

`.env.local`:
- `NEXT_PUBLIC_API_URL`: backend manzili, masalan `https://api.domen.uz/api`
- `NEXT_PUBLIC_ADMIN_ID`: admin Telegram ID (zaxira; asosiy tekshiruv backend `/api/me` -> `role`)

Telegram'da ochish uchun frontendni HTTPS domenga joylang va backend `.env` dagi `WEBAPP_URL` ga shu manzilni yozing.
Onboarding'ni qayta ko'rish: brauzer konsolida `localStorage.removeItem('pizza-kuryer:onboarding-done')`.

## Katalog, mahsulot oynasi, savatcha (3-qism)
- `src/lib/api.ts`: Axios klienti (`tma <initData>` header), `getProducts`, `calculateCart`, `createOrder` va `useMenu()`.
- `src/lib/utils.ts`: `formatSum(85000)` → `85,000 so'm`, chegirma foizi, teglar (Mashhur/Pishloqli/Achiq).
- `src/hooks/useCart.ts`: savatcha amallari (haptic bilan), jami summa, checkout oldidan server tekshiruvi.
- Checkout (4-qism) uchun ulanish nuqtasi: `src/app/page.tsx` dagi `handleCheckout(calc)`.

## To'lov va Admin panel (4-qism)
- `src/app/checkout/page.tsx`: kontakt, to'lov turi, "Buyurtma berish" (Stars tanlansa `WebApp.openInvoice`).
- `src/components/features/PaymentMethods.tsx`: Telegram Stars / Click, Payme / Naqd (faqat admin yoqqanlari).
- `src/app/admin/page.tsx` + `src/components/admin/OrderManager.tsx`, `PaymentSettings.tsx`: buyurtmalar (Yangi / Bajarilayotgan / Yakunlangan), status o'zgartirish, to'lov turlarini aktiv/passiv qilish.
- To'liq ishga tushirish va deploy: `../ISHGA_TUSHIRISH.md`.
