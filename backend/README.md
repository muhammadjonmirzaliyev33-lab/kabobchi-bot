# Pizza Kuryer — Backend

Node.js (Express) + Telegraf + Neon PostgreSQL.

## Ishga tushirish
```bash
npm install
npm run db:init   # src/database/schema.sql ni Neon bazasida ishga tushiradi (qayta ishlatish xavfsiz)
npm start         # yoki: npm run dev
```
`.env` da `WEBAPP_URL` ga frontend (Mini App) ning HTTPS manzilini yozing.
`WEBHOOK_DOMAIN` bo'sh bo'lsa bot long polling rejimida ishlaydi.

## Autentifikatsiya
Mini App himoyalangan so'rovlarda header yuboradi:
```
Authorization: tma <window.Telegram.WebApp.initData>
```
Server imzoni bot tokeni bilan tekshiradi. Admin: `.env` dagi `ADMIN_IDS` yoki `users.role = 'admin'`.

## API (javob: `{ ok: true, data }` yoki `{ ok: false, error }`)
| Metod | Yo'l | Auth | Tavsif |
|---|---|---|---|
| GET | /api/health | — | Holat |
| GET | /api/categories | — | Kategoriyalar |
| GET | /api/products?category_id= | — | Mahsulotlar + `meta.sauce_price` |
| GET | /api/me | tma | Joriy foydalanuvchi |
| POST | /api/cart/calculate | tma | `{ items:[{product_id,quantity}], has_sauce }` → hisob |
| POST | /api/orders | tma | Checkout (pastga qarang) |
| GET | /api/orders/my | tma | Mening buyurtmalarim |
| GET | /api/admin/orders?status=new&limit=50&offset=0 | admin | Buyurtmalar ro'yxati |
| GET | /api/admin/orders/:id | admin | Bitta buyurtma |
| PATCH | /api/admin/orders/:id/status | admin | `{ status }` |
| GET | /api/admin/stats | admin | Holatlar bo'yicha statistika |
| GET | /api/payment-methods | — | Yoqilgan to'lov turlari |
| GET | /api/admin/orders?group=new\|active\|done | admin | Yangi / Bajarilayotgan / Yakunlangan |
| GET | /api/admin/payment-methods | admin | Barcha to'lov turlari |
| PATCH | /api/admin/payment-methods/:method | admin | `{ is_enabled }` |

Mahsulot maydonlari (katalog uchun): `price`, `old_price` (ustidan chizilgan narx), `tags`
(`popular` = Mashhur, `cheesy` = Pishloqli, `spicy` = Achiq), `ingredients` (tarkib ro'yxati),
`sizes` (`[{ code, label, price, old_price }]`, bo'sh bo'lsa `price` ishlatiladi).
Savatdagi har bir qatorda ixtiyoriy `size` (o'lcham kodi) yuboriladi; narx o'sha o'lchamdan olinadi.

Checkout body:
```json
{
  "items": [{ "product_id": 1, "quantity": 2, "size": "m" }],
  "has_sauce": true,
  "payment_method": "click | payme | cash | stars",
  "name": "Ali",
  "phone": "+998901234567",
  "address": "Toshkent, ...",
  "comment": "Domofon 12"
}
```
Narxlar faqat bazadan hisoblanadi; buyurtma yaratilgach admin(lar)ga darhol Telegram xabari yuboriladi.

Buyurtma holatlari: `new` (Yangi) → `accepted` (Tayyorlanmoqda) → `on_the_way` (Kuryerga berildi) → `delivered` (Bajarildi); `new`/`accepted` dan `cancelled` ham mumkin.

To'lovlar (Telegram Stars, Click/Payme stub) va deploy: `../ISHGA_TUSHIRISH.md`.
Admin holatni API orqali yoki bot xabaridagi tugmalar bilan o'zgartiradi; mijozga avtomatik xabar boradi.

## Bot buyruqlari
`/start`, `/menu`, `/help`, admin uchun `/admin`, `/orders`.
