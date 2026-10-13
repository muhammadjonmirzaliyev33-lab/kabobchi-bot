# Pizza Kuryer: ishga tushirish va deploy yo'riqnomasi

Loyiha ikki qismdan iborat:

| Papka | Texnologiya | Lokal port |
|---|---|---|
| `backend/` | Node.js (Express) + Telegraf + PostgreSQL (Neon) | 3000 |
| `frontend/` | Next.js 15 + Tailwind 4 + Zustand (Telegram Mini App) | 3001 |

Kerak bo'ladi: **Node.js 18+** (20 yoki 22 tavsiya), **npm**, Telegram bot tokeni (@BotFather), Neon hisobi.

---

## 1. Ma'lumotlar bazasi (Neon)

1. https://neon.tech da yangi loyiha yarating (region: Frankfurt, O'zbekistonga eng yaqin).
2. **Dashboard → Connect** dan connection string'ni oling, masalan:
   `postgresql://user:parol@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
3. Uni `backend/.env` dagi `DATABASE_URL` ga yozing.
4. Jadvallarni yarating (qayta ishga tushirish xavfsiz, mavjud ma'lumot o'chmaydi):
   ```bash
   cd backend
   npm install
   npm run db:init
   ```
   Muqobil: `backend/src/database/schema.sql` matnini Neon **SQL Editor** ga qo'yib ishga tushiring.

> 4-qism yangilanishi: `payment_settings` jadvali va `orders.stars_amount`, `orders.payment_charge_id` ustunlari qo'shildi. Eski bazada ham `npm run db:init` ni yana bir marta ishga tushiring.

---

## 2. Lokal ishga tushirish (npm run dev)

### Backend
```bash
cd backend
npm install
cp .env.example .env     # .env allaqachon bo'lsa shart emas
npm run dev              # http://localhost:3000/api/health
```
`.env` dagi asosiy o'zgaruvchilar:

| O'zgaruvchi | Qiymat |
|---|---|
| `BOT_TOKEN` | @BotFather bergan token |
| `ADMIN_IDS` | `1027530770` (vergul bilan bir nechta) |
| `DATABASE_URL` | Neon connection string |
| `WEBAPP_URL` | Mini App ning **HTTPS** manzili (pastga qarang) |
| `WEBHOOK_DOMAIN` | Lokal uchun **bo'sh** qoldiring: bot long polling'da ishlaydi |
| `CORS_ORIGIN` | Lokal uchun `*`, production'da frontend domeni |
| `SOM_PER_STAR` | 1 Telegram Star necha so'm (standart 200) |
| `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `PAYME_MERCHANT_ID` | Merchant shartnomasidan keyin (hozircha bo'sh) |

### Frontend
```bash
cd frontend
npm install
npm run dev              # http://localhost:3001
```
`frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_ADMIN_ID=1027530770
```
Brauzerda `http://localhost:3001` ochiladi, lekin Telegram foydalanuvchisi bo'lmagani uchun buyurtma berish va admin panel ishlamaydi (backend `initData` imzosini talab qiladi).

### Telegram ichida lokal sinash
Telegram Mini App faqat **HTTPS** manzilni ochadi, telefoningiz esa `localhost` ni ko'rmaydi. Ikkala portni tunnel orqali chiqaring:
```bash
npx cloudflared tunnel --url http://localhost:3001   # -> https://aaa.trycloudflare.com  (frontend)
npx cloudflared tunnel --url http://localhost:3000   # -> https://bbb.trycloudflare.com  (backend)
```
So'ng:
1. `frontend/.env.local`: `NEXT_PUBLIC_API_URL=https://bbb.trycloudflare.com/api`, frontendni qayta ishga tushiring.
2. `backend/.env`: `WEBAPP_URL=https://aaa.trycloudflare.com`, backendni qayta ishga tushiring.
3. Botga `/start` yozing va "🍕 Menyu" tugmasini bosing.

> Bitta bot tokeni bilan bir vaqtda faqat **bitta** backend ishlashi kerak. Serverda webhook o'rnatilgan bo'lsa, lokal long polling ishlamaydi (yoki aksincha).

---

## 3. Production deploy

### Eng oson yo'l: Render Blueprint (bitta servis)

Repo ildizidagi `render.yaml` hammasini sozlaydi: frontend statik build qilinadi va backend shu domendan beradi,
`DB_AUTO_INIT=true` bo'lgani uchun Neon jadvallari server har ishga tushganda yaratiladi (mavjud ma'lumot o'chmaydi),
`WEBAPP_URL` va `WEBHOOK_DOMAIN` Render manzilidan (`RENDER_EXTERNAL_URL`) avtomatik olinadi.

1. https://render.com/deploy?repo=https://github.com/muhammadjonmirzaliyev33-lab/My-professional-app/tree/pizza-kuryer ni oching (GitHub bilan kiring).
2. `BOT_TOKEN` va `DATABASE_URL` ni kiriting, **Apply** bosing.
3. Build tugagach botga `/start` yozing, "🍕 Menyu" tugmasi ishlaydi.

Quyidagi qo'lda sozlash (Render + Vercel alohida) ham ishlaydi.


Tartib: **Backend → Frontend → Backend'ga frontend manzilini yozish → BotFather**.

### 3.1 Backend: Render (yoki Railway)

**Render** (https://render.com → New → Web Service → GitHub repo):

| Sozlama | Qiymat |
|---|---|
| Root Directory | `backend` |
| Build Command | `npm ci` |
| Start Command | `npm start` |
| Environment | `.env` dagi barcha o'zgaruvchilar |

Qo'shimcha env:
```
NODE_ENV=production
WEBHOOK_DOMAIN=https://pizza-kuryer-api.onrender.com   # Render bergan manzil
WEBHOOK_SECRET=<uzun tasodifiy satr>
```
`WEBHOOK_DOMAIN` berilganda bot avtomatik ravishda `https://.../telegram/webhook` ga webhook o'rnatadi.

> Render'ning bepul tarifi 15 daqiqa ishlatilmasa "uxlaydi" va birinchi so'rovga ~50 soniyada uyg'onadi. Haqiqiy do'kon uchun pullik tarif yoki Railway tavsiya etiladi.

**Railway** (https://railway.app → New Project → Deploy from GitHub): Settings → Root Directory = `backend`, Start Command = `npm start`, Variables bo'limiga env'larni qo'shing, Networking → **Generate Domain** va shu domenni `WEBHOOK_DOMAIN` ga yozing.

Tekshirish: `https://<backend-domen>/api/health` → `{"ok":true,...}`

### 3.2 Frontend: Vercel

https://vercel.com → Add New → Project → repo'ni tanlang:

| Sozlama | Qiymat |
|---|---|
| Root Directory | `frontend` |
| Framework | Next.js (avtomatik) |
| Env: `NEXT_PUBLIC_API_URL` | `https://<backend-domen>/api` |
| Env: `NEXT_PUBLIC_ADMIN_ID` | `1027530770` |

Deploy tugagach manzil chiqadi, masalan `https://pizza-kuryer.vercel.app`.
`NEXT_PUBLIC_*` o'zgaruvchilar build paytida kodga yoziladi: ularni o'zgartirsangiz **Redeploy** qiling.

### 3.3 Backend'ga frontend manzilini yozish

Render/Railway env'da:
```
WEBAPP_URL=https://pizza-kuryer.vercel.app
CORS_ORIGIN=https://pizza-kuryer.vercel.app
```
Backend qayta ishga tushganda o'zi:
- bot menyu tugmasini (`🍕 Menyu`) shu manzilga o'rnatadi (`setChatMenuButton`);
- admin uchun "🛠 Admin panel" tugmasi `WEBAPP_URL/admin` ni ochadi.

### 3.4 BotFather

Backend menyu tugmasini avtomatik o'rnatadi. Qo'lda sozlash yoki tekshirish uchun:
1. @BotFather → `/mybots` → botingiz → **Bot Settings → Menu Button** → URL: `https://pizza-kuryer.vercel.app`, matn: `🍕 Menyu`.
2. (Ixtiyoriy) `/newapp` → shu URL bilan Mini App yarating: `t.me/Pizza_kuryer_bot/app` ko'rinishidagi havola paydo bo'ladi.
3. (Ixtiyoriy) `/setdescription`, `/setuserpic`: bot tavsifi va rasmi.

---

## 4. To'lov turlari

| Tur | Holat | Nima kerak |
|---|---|---|
| ⭐ **Telegram Stars** | To'liq ishlaydi | Hech narsa: provider token kerak emas. Summa `SOM_PER_STAR` kursi bo'yicha Stars'ga aylantiriladi. To'lov tasdiqlansa buyurtma `paid` bo'ladi va adminga xabar boradi. Stars Telegram ichida bot balansiga tushadi (@BotFather → Bot → Balance). |
| 💳 **Click** | Tanlash va to'lov sahifasiga havola tayyor; **to'lovni tasdiqlash (webhook) STUB** | Click bilan shartnoma → `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, secret key. `backend/src/controllers/paymentController.js` dagi `clickWebhook` (Prepare/Complete) ni yozish kerak. |
| 💳 **Payme** | Tanlash va checkout havolasi tayyor; **Merchant API STUB** | Payme Business kabineti → `PAYME_MERCHANT_ID`, kalit. `paymeWebhook` (CheckPerformTransaction, CreateTransaction, PerformTransaction...) ni yozish kerak. |
| 💵 **Naqd** | To'liq ishlaydi | Hech narsa |

Merchant kalitlari bo'lmasa Click/Payme buyurtmasi baribir yaratiladi (`pending`), mijozga "operator bog'lanadi" deyiladi.
Admin panel → **To'lov turlari** bo'limida har bir turni aktiv/passiv qilish mumkin; o'chirilgan tur checkout'da ko'rinmaydi va backend uni rad etadi.

---

## 5. Admin panel

- Kirish: bot'da `/admin` → **🛠 Admin panel** yoki Mini App pastki menyusidagi **Admin** tabi (`/admin` sahifasi).
- Faqat `ADMIN_IDS` dagi ID (1027530770) kiradi. Tekshiruv **serverda**: har bir `/api/admin/*` so'rovi Telegram `initData` imzosi va ID bo'yicha tekshiriladi, boshqa foydalanuvchiga 403 qaytadi.
- Bo'limlar: **Yangi** (new), **Bajarilayotgan** (Tayyorlanmoqda, Kuryerga berildi), **Yakunlangan** (Bajarildi, Bekor qilindi). Ro'yxat har 30 soniyada yangilanadi.
- Holat tugmalari: *Qabul qilish*, *🚚 Kuryerga berildi*, *✅ Bajarildi*, *Bekor qilish*. Har o'zgarishda mijozga bot orqali avtomatik xabar boradi. Xuddi shu tugmalar admin chatidagi buyurtma xabarida ham bor.
- Yangi buyurtma tushishi bilan admin (1027530770) ga Telegram'da darhol xabar keladi.

---

## 6. API (4-qism qo'shimchalari)

| Metod | Yo'l | Auth | Tavsif |
|---|---|---|---|
| GET | `/api/payment-methods` | — | Yoqilgan to'lov turlari + `meta.som_per_star` |
| POST | `/api/orders` | tma | Javobda `data.payment`: `{type:'stars', invoice_link, stars_amount}` yoki `{type:'click'/'payme', payment_url}` yoki `{type:'cash'}` |
| GET | `/api/admin/orders?group=new\|active\|done` | admin | Bo'lim bo'yicha ro'yxat (`?status=new,accepted` ham ishlaydi) |
| PATCH | `/api/admin/orders/:id/status` | admin | `{ status: "accepted" \| "on_the_way" \| "delivered" \| "cancelled" }` |
| GET | `/api/admin/payment-methods` | admin | Barcha to'lov turlari |
| PATCH | `/api/admin/payment-methods/:method` | admin | `{ is_enabled: true \| false }` |
| POST | `/api/payments/click`, `/api/payments/payme` | — | Webhook STUB (501) |

Holatlar: `new` (Yangi) → `accepted` (Tayyorlanmoqda) → `on_the_way` (Kuryerga berildi) → `delivered` (Bajarildi); `new` dan to'g'ridan-to'g'ri "Kuryerga berildi" ham mumkin; `new`/`accepted` dan `cancelled`.

---

## 7. Muammolar

| Belgi | Sabab va yechim |
|---|---|
| Mini App "Telegram initData noto'g'ri" | Frontend Telegram tashqarisida ochilgan yoki `BOT_TOKEN` boshqa botniki. |
| Mini App'da "Internet aloqasini tekshiring" | `NEXT_PUBLIC_API_URL` noto'g'ri, backend uxlab yotibdi yoki `CORS_ORIGIN` frontend domeniga mos emas. |
| Admin panel "Faqat admin uchun" | Telegram ID `ADMIN_IDS` da yo'q. |
| Bot javob bermaydi | Webhook boshqa serverga o'rnatilgan: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo` ni tekshiring. |
| Stars oynasi ochilmaydi | Telegram ilovasi eski (Bot API 6.1+ kerak) yoki brauzerda ochilgan. |
| `npm run db:init` ulanmaydi | `DATABASE_URL` oxirida `?sslmode=require` borligini tekshiring. |
