const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`.env da ${name} o'zgaruvchisi topilmadi`);
  return value;
}

const toInt = (value, fallback) => {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? fallback : n;
};

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  logLevel: process.env.LOG_LEVEL || 'info',

  bot: {
    token: required('BOT_TOKEN'),
    username: process.env.BOT_USERNAME || 'Pizza_kuryer_bot',
    adminIds: (process.env.ADMIN_IDS || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map(Number),
    // Render avtomatik beradigan RENDER_EXTERNAL_URL zaxira sifatida ishlatiladi
    webAppUrl: process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_URL || '',
    webhookDomain: process.env.WEBHOOK_DOMAIN || process.env.RENDER_EXTERNAL_URL || '',
    webhookPath: '/telegram/webhook',
    // Berilmasa bot tokenidan hosil qilinadi (Telegram faqat [A-Za-z0-9_-] qabul qiladi)
    webhookSecret:
      process.env.WEBHOOK_SECRET ||
      crypto.createHash('sha256').update(process.env.BOT_TOKEN || '').digest('hex'),
    initDataMaxAge: toInt(process.env.INIT_DATA_MAX_AGE, 86400), // soniya
  },

  db: {
    url: required('DATABASE_URL'),
    // true bo'lsa server har ishga tushganda schema.sql qo'llanadi
    autoInit: process.env.DB_AUTO_INIT === 'true',
  },

  payments: {
    // 1 Telegram Star necha so'mga teng (Stars summasi shu kurs bo'yicha hisoblanadi)
    somPerStar: toInt(process.env.SOM_PER_STAR, 200),
    // Click / Payme merchant ma'lumotlari (bo'sh bo'lsa to'lov havolasi yaratilmaydi)
    clickServiceId: process.env.CLICK_SERVICE_ID || '',
    clickMerchantId: process.env.CLICK_MERCHANT_ID || '',
    paymeMerchantId: process.env.PAYME_MERCHANT_ID || '',
  },

  business: {
    saucePrice: toInt(process.env.SAUCE_PRICE, 15000),
    deliveryFee: toInt(process.env.DELIVERY_FEE, 0),
  },
};
