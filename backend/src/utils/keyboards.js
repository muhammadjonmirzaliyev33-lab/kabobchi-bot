const { Markup } = require('telegraf');
const config = require('../config/default');
const { STATUS_LABELS } = require('../models/Order');

const hasWebApp = () => config.bot.webAppUrl.startsWith('https://');
const adminUrl = () => `${config.bot.webAppUrl.replace(/\/$/, '')}/admin`;

/** Xabar ostidagi "Menyuni ochish" (Mini App) tugmasi */
function openMiniAppInline() {
  if (!hasWebApp()) return Markup.inlineKeyboard([]);
  return Markup.inlineKeyboard([[Markup.button.webApp('🍕 Menyuni ochish', config.bot.webAppUrl)]]);
}

/** Pastki doimiy klaviatura: Mini App + telefon raqamni yuborish */
function mainReplyKeyboard() {
  const rows = [];
  if (hasWebApp()) rows.push([Markup.button.webApp('🍕 Buyurtma berish', config.bot.webAppUrl)]);
  rows.push([Markup.button.contactRequest('📞 Telefon raqamni yuborish')]);
  return Markup.keyboard(rows).resize();
}

/** Admin uchun bosh menyu */
function adminMenu() {
  const rows = [[Markup.button.callback('📋 Yangi buyurtmalar', 'admin:orders:new')]];
  if (hasWebApp()) rows.push([Markup.button.webApp('🛠 Admin panel', adminUrl())]);
  return Markup.inlineKeyboard(rows);
}

/** Buyurtma holatiga qarab keyingi mumkin bo'lgan holatlar */
const NEXT_STATUSES = {
  new: ['accepted', 'on_the_way', 'cancelled'],
  accepted: ['on_the_way', 'cancelled'],
  on_the_way: ['delivered'],
  delivered: [],
  cancelled: [],
};

/** Admin xabaridagi status tugmalari (callback: order:<id>:<status>) */
function adminOrderKeyboard(orderId, currentStatus = 'new') {
  const buttons = (NEXT_STATUSES[currentStatus] || []).map((status) =>
    Markup.button.callback(STATUS_LABELS[status], `order:${orderId}:${status}`)
  );
  return Markup.inlineKeyboard(buttons.length ? [buttons] : []);
}

module.exports = {
  openMiniAppInline,
  mainReplyKeyboard,
  adminMenu,
  adminOrderKeyboard,
  NEXT_STATUSES,
};
