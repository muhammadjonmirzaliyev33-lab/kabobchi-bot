const express = require('express');
const { message } = require('telegraf/filters');
const startController = require('../controllers/startController');
const cartController = require('../controllers/cartController');
const adminController = require('../controllers/adminController');
const paymentController = require('../controllers/paymentController');
const { telegramAuth, requireAdmin } = require('../middlewares/auth.middleware');

/* =====================================================================
 * REST API (Mini App uchun). Barcha himoyalangan so'rovlar
 * "Authorization: tma <Telegram.WebApp.initData>" headerini yuborishi kerak.
 * Javob formati: { ok: true, data } yoki { ok: false, error }
 * ===================================================================== */
const apiRouter = express.Router();

// Ochiq (menyu)
apiRouter.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
apiRouter.get('/categories', cartController.getCategories);
apiRouter.get('/products', cartController.getProducts);
apiRouter.get('/payment-methods', paymentController.listEnabled);

// To'lov tizimlari webhooklari (STUB — merchant kalitlari olingach yoziladi)
apiRouter.post('/payments/click', paymentController.clickWebhook);
apiRouter.post('/payments/payme', paymentController.paymeWebhook);

// Mijoz (initData talab qilinadi)
apiRouter.get('/me', telegramAuth, cartController.me);
apiRouter.post('/cart/calculate', telegramAuth, cartController.calculate);
apiRouter.post('/orders', telegramAuth, cartController.createOrder);
apiRouter.get('/orders/my', telegramAuth, cartController.myOrders);

// Admin (initData + admin roli)
const admin = express.Router();
admin.use(telegramAuth, requireAdmin);
admin.get('/orders', adminController.listOrders);
admin.get('/orders/:id', adminController.getOrder);
admin.patch('/orders/:id/status', adminController.updateOrderStatus);
admin.get('/stats', adminController.stats);
admin.get('/payment-methods', paymentController.adminList);
admin.patch('/payment-methods/:method', paymentController.adminUpdate);
apiRouter.use('/admin', admin);

/* =====================================================================
 * Bot handlerlari
 * ===================================================================== */
function registerBotHandlers(bot) {
  bot.start(startController.start);
  bot.help(startController.help);
  bot.command('menu', startController.menu);
  bot.on('contact', startController.saveContact);

  // Telegram Stars to'lovlari
  bot.on('pre_checkout_query', paymentController.handlePreCheckout);
  bot.on(message('successful_payment'), paymentController.handleSuccessfulPayment);

  bot.command('admin', adminController.adminPanel);
  bot.command('orders', adminController.listNewOrdersInChat);
  bot.action('admin:orders:new', adminController.listNewOrdersInChat);
  bot.action(/^order:(\d+):(accepted|on_the_way|delivered|cancelled)$/, adminController.handleStatusCallback);
}

module.exports = { apiRouter, registerBotHandlers };
