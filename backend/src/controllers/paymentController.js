const bot = require('../core/bot');
const config = require('../config/default');
const logger = require('../utils/logger');
const PaymentSetting = require('../models/PaymentSetting');
const { Order, PAYMENT_METHODS, PAYMENT_LABELS } = require('../models/Order');

const PAYMENT_DESCRIPTIONS = {
  stars: 'Telegram ichida to\'lov',
  click: 'O\'zbekiston kartalari (Uzcard, Humo)',
  payme: 'O\'zbekiston kartalari (Uzcard, Humo)',
  cash: 'Kuryerga yetkazilganda',
};

const formatMethod = (row) => ({
  method: row.method,
  label: PAYMENT_LABELS[row.method] || row.method,
  description: PAYMENT_DESCRIPTIONS[row.method] || '',
  is_enabled: row.is_enabled,
  sort_order: row.sort_order,
});

/** So'mdagi summani Telegram Stars ga aylantirish (yuqoriga yaxlitlanadi, kamida 1) */
const toStars = (sum) => Math.max(1, Math.ceil(Number(sum) / config.payments.somPerStar));

// ---------- REST API ----------

/** GET /api/payment-methods — checkout uchun faqat yoqilgan to'lov turlari */
async function listEnabled(req, res, next) {
  try {
    const rows = await PaymentSetting.getAll();
    const data = rows.filter((r) => r.is_enabled).map(formatMethod);
    return res.json({ ok: true, data, meta: { som_per_star: config.payments.somPerStar } });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/admin/payment-methods — barcha to'lov turlari (yoqilgan va o'chirilgan) */
async function adminList(req, res, next) {
  try {
    return res.json({ ok: true, data: (await PaymentSetting.getAll()).map(formatMethod) });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/admin/payment-methods/:method  body: { is_enabled: boolean } */
async function adminUpdate(req, res, next) {
  try {
    const { method } = req.params;
    const isEnabled = req.body?.is_enabled;
    if (!PAYMENT_METHODS.includes(method) || typeof isEnabled !== 'boolean') {
      return res.status(400).json({ ok: false, error: `method: ${PAYMENT_METHODS.join(', ')}; is_enabled: boolean` });
    }
    const row = await PaymentSetting.setEnabled(method, isEnabled);
    logger.info(`To'lov turi ${method}: ${isEnabled ? 'yoqildi' : 'o\'chirildi'} (admin ${req.tgUser.id})`);
    return res.json({ ok: true, data: formatMethod(row) });
  } catch (err) {
    return next(err);
  }
}

// ---------- Buyurtma uchun to'lov yaratish ----------

/**
 * Buyurtma yaratilgandan so'ng to'lov ma'lumotini qaytaradi.
 *  - stars: Telegram Stars invoys havolasi (Mini App da WebApp.openInvoice bilan ochiladi)
 *  - click / payme: to'lov sahifasi havolasi (STUB, pastga qarang)
 *  - cash: to'lov kuryerga beriladi
 */
async function createPaymentForOrder(order) {
  switch (order.payment_method) {
    case 'stars': {
      const stars = toStars(order.total);
      await Order.setStarsAmount(order.id, stars);
      const invoiceLink = await bot.telegram.createInvoiceLink({
        title: `Buyurtma #${order.id}`,
        description: `Pizza Kuryer buyurtmasi: ${order.total} so'm`,
        payload: `order:${order.id}`,
        provider_token: '', // Telegram Stars uchun bo'sh qoldiriladi
        currency: 'XTR',
        prices: [{ label: `Buyurtma #${order.id}`, amount: stars }],
      });
      return { type: 'stars', invoice_link: invoiceLink, stars_amount: stars };
    }
    case 'click':
      return { type: 'click', payment_url: buildClickUrl(order) };
    case 'payme':
      return { type: 'payme', payment_url: buildPaymeUrl(order) };
    default:
      return { type: 'cash' };
  }
}

/*
 * ==================== CLICK / PAYME (STUB) ====================
 * Quyidagi funksiyalar faqat to'lov sahifasiga havola yasaydi.
 * To'lovni TASDIQLASH uchun Click (Prepare/Complete) va Payme (Merchant API, JSON-RPC)
 * webhooklarini merchant kalitlari olingandan keyin yozish kerak — clickWebhook / paymeWebhook.
 * Kalitlar .env da bo'lmasa havola null bo'ladi va buyurtma "pending" holatida qoladi
 * (operator mijoz bilan bog'lanadi).
 */
function buildClickUrl(order) {
  const { clickServiceId, clickMerchantId } = config.payments;
  if (!clickServiceId || !clickMerchantId) return null;
  const params = new URLSearchParams({
    service_id: clickServiceId,
    merchant_id: clickMerchantId,
    amount: String(order.total),
    transaction_param: String(order.id),
  });
  if (config.bot.webAppUrl) params.set('return_url', config.bot.webAppUrl);
  return `https://my.click.uz/services/pay?${params}`;
}

function buildPaymeUrl(order) {
  const { paymeMerchantId } = config.payments;
  if (!paymeMerchantId) return null;
  // Payme summani tiyinda qabul qiladi (1 so'm = 100 tiyin)
  const parts = [`m=${paymeMerchantId}`, `ac.order_id=${order.id}`, `a=${order.total * 100}`];
  if (config.bot.webAppUrl) parts.push(`c=${config.bot.webAppUrl}`);
  return `https://checkout.paycom.uz/${Buffer.from(parts.join(';')).toString('base64')}`;
}

/** POST /api/payments/click — TODO: Click Prepare/Complete (SIGN_STRING tekshiruvi bilan) */
function clickWebhook(req, res) {
  logger.warn('Click webhook chaqirildi, lekin integratsiya hali yozilmagan (stub)');
  return res.status(501).json({ error: -8, error_note: 'Click integratsiyasi sozlanmagan' });
}

/** POST /api/payments/payme — TODO: Payme Merchant API (CheckPerformTransaction, CreateTransaction, ...) */
function paymeWebhook(req, res) {
  logger.warn('Payme webhook chaqirildi, lekin integratsiya hali yozilmagan (stub)');
  return res.status(501).json({
    jsonrpc: '2.0',
    id: req.body?.id ?? null,
    error: { code: -32400, message: 'Payme integratsiyasi sozlanmagan' },
  });
}

// ---------- Telegram Stars: bot handlerlari ----------

const parsePayload = (payload) => {
  const m = /^order:(\d+)$/.exec(payload || '');
  return m ? Number(m[1]) : null;
};

/** pre_checkout_query: to'lovdan oldin buyurtmani tekshirish (10 soniya ichida javob berish shart) */
async function handlePreCheckout(ctx) {
  const q = ctx.preCheckoutQuery;
  try {
    const order = await Order.findById(parsePayload(q.invoice_payload));
    const valid =
      order &&
      order.payment_method === 'stars' &&
      order.payment_status === 'pending' &&
      order.status !== 'cancelled' &&
      Number(order.telegram_id) === q.from.id &&
      q.currency === 'XTR' &&
      q.total_amount === order.stars_amount;
    if (!valid) return ctx.answerPreCheckoutQuery(false, 'Buyurtma topilmadi yoki allaqachon to\'langan');
    return ctx.answerPreCheckoutQuery(true);
  } catch (err) {
    logger.error(`pre_checkout_query xatosi: ${err.message}`);
    return ctx.answerPreCheckoutQuery(false, 'Serverda xatolik, keyinroq urinib ko\'ring');
  }
}

/** successful_payment: buyurtmani "paid" qilish, mijoz va adminga xabar */
async function handleSuccessfulPayment(ctx) {
  const payment = ctx.message.successful_payment;
  const orderId = parsePayload(payment.invoice_payload);
  const order = orderId && (await Order.markPaid(orderId, payment.telegram_payment_charge_id));
  if (!order) {
    logger.warn(`successful_payment: buyurtma topilmadi yoki allaqachon to'langan (${payment.invoice_payload})`);
    return;
  }
  logger.info(`Buyurtma #${orderId} Telegram Stars bilan to'landi: ${payment.total_amount} XTR`);
  await ctx.reply(`⭐ To'lov qabul qilindi! Buyurtma #${orderId} tayyorlanmoqda.`);
  for (const adminId of config.bot.adminIds) {
    bot.telegram
      .sendMessage(adminId, `⭐ Buyurtma #${orderId} to'landi: ${payment.total_amount} Stars`)
      .catch((err) => logger.warn(`Admin ${adminId} ga to'lov xabari yuborilmadi: ${err.message}`));
  }
}

module.exports = {
  listEnabled,
  adminList,
  adminUpdate,
  createPaymentForOrder,
  clickWebhook,
  paymeWebhook,
  handlePreCheckout,
  handleSuccessfulPayment,
  toStars,
};
