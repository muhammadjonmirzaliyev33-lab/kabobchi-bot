const bot = require('../core/bot');
const config = require('../config/default');
const logger = require('../utils/logger');
const User = require('../models/User');
const { Order, ORDER_STATUSES, STATUS_LABELS, STATUS_GROUPS, PAYMENT_LABELS } = require('../models/Order');
const { adminOrderKeyboard, adminMenu, NEXT_STATUSES } = require('../utils/keyboards');

// ---------- Yordamchi funksiyalar ----------
const formatSum = (n) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Admin uchun buyurtma xabari (HTML) */
function formatOrderMessage(order) {
  const username = order.username ? ` (@${escapeHtml(order.username)})` : '';
  const items = (order.items || [])
    .map((i) => `   • ${escapeHtml(i.product_name || i.name)} × ${i.quantity} = ${formatSum(i.line_total)} so'm`)
    .join('\n');

  const lines = [
    `📥 <b>YANGI BUYURTMA #${order.id}</b>`,
    `👤 Mijoz: ${escapeHtml(order.customer_name)}${username}`,
    `📞 Tel: ${escapeHtml(order.phone)}`,
    `🍕 Mahsulotlar:\n${items}`,
    `➕ Order Bump (Sous): ${order.has_sauce ? 'Ha' : 'Yo\'q'}`,
    `💳 To'lov turi: ${PAYMENT_LABELS[order.payment_method] || order.payment_method}` +
      (order.payment_status === 'paid' ? ' (to\'langan ✅)' : ''),
    `💵 Jami: <b>${formatSum(order.total)} so'm</b>`,
  ];
  if (order.address) lines.push(`📍 Manzil: ${escapeHtml(order.address)}`);
  if (order.comment) lines.push(`💬 Izoh: ${escapeHtml(order.comment)}`);
  lines.push(`\n📌 Holat: ${STATUS_LABELS[order.status] || order.status}`);
  return lines.join('\n');
}

/** Yangi buyurtma haqida barcha adminlarga zudlik bilan xabar yuboradi */
async function notifyAdminsNewOrder(order) {
  const text = formatOrderMessage(order);
  for (const adminId of config.bot.adminIds) {
    try {
      const msg = await bot.telegram.sendMessage(adminId, text, {
        parse_mode: 'HTML',
        ...adminOrderKeyboard(order.id, order.status),
      });
      if (adminId === config.bot.adminIds[0]) await Order.setAdminMessageId(order.id, msg.message_id);
    } catch (err) {
      logger.error(`Admin ${adminId} ga xabar yuborilmadi (buyurtma #${order.id}): ${err.message}`);
    }
  }
}

const CUSTOMER_STATUS_TEXT = {
  accepted: '👨‍🍳 Buyurtmangiz tayyorlanmoqda.',
  on_the_way: '🚚 Buyurtmangiz kuryerga berildi va yo\'lda! Tez orada yetib boradi.',
  delivered: '✅ Buyurtmangiz yetkazildi. Yoqimli ishtaha! 🍕',
  cancelled: '❌ Buyurtmangiz bekor qilindi. Savollar bo\'lsa, biz bilan bog\'laning.',
};

/** Mijozga buyurtma holati o'zgargani haqida xabar */
async function notifyCustomerStatus(order) {
  if (!order.telegram_id) return;
  try {
    await bot.telegram.sendMessage(
      order.telegram_id,
      `Buyurtma #${order.id}: ${STATUS_LABELS[order.status]}\n${CUSTOMER_STATUS_TEXT[order.status] || ''}`.trim()
    );
  } catch (err) {
    logger.warn(`Mijozga xabar yuborilmadi (#${order.id}): ${err.message}`);
  }
}

/** Statusni o'zgartirish (API va bot tugmalari uchun umumiy) */
async function changeStatus(orderId, status) {
  const current = await Order.findById(orderId);
  if (!current) return { error: 'Buyurtma topilmadi', code: 404 };
  if (!(NEXT_STATUSES[current.status] || []).includes(status)) {
    return {
      error: `"${current.status}" holatidan "${status}" holatiga o'tib bo'lmaydi`,
      code: 409,
    };
  }
  await Order.updateStatus(orderId, status);
  const order = await Order.findById(orderId);
  await notifyCustomerStatus(order);
  logger.info(`Buyurtma #${orderId}: ${current.status} -> ${status}`);
  return { order };
}

// ---------- REST API (Admin panel) ----------

/**
 * GET /api/admin/orders?group=new|active|done  yoki  ?status=new,accepted  &limit=50&offset=0
 *   group: new = Yangi, active = Bajarilayotgan, done = Yakunlangan
 */
async function listOrders(req, res, next) {
  try {
    const { group } = req.query;
    if (group && !STATUS_GROUPS[group]) {
      return res.status(400).json({ ok: false, error: `group: ${Object.keys(STATUS_GROUPS).join(', ')}` });
    }
    const status = group
      ? STATUS_GROUPS[group]
      : String(req.query.status || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (status.some((s) => !ORDER_STATUSES.includes(s))) {
      return res.status(400).json({ ok: false, error: `status: ${ORDER_STATUSES.join(', ')}` });
    }
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const orders = await Order.list({ status, limit, offset });
    return res.json({ ok: true, data: orders });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/admin/orders/:id */
async function getOrder(req, res, next) {
  try {
    const order = await Order.findById(Number(req.params.id));
    if (!order) return res.status(404).json({ ok: false, error: 'Buyurtma topilmadi' });
    return res.json({ ok: true, data: order });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/admin/orders/:id/status  body: { status: "accepted" | "on_the_way" | "delivered" | "cancelled" } */
async function updateOrderStatus(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    if (!Number.isInteger(id) || !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, error: `status: ${ORDER_STATUSES.join(', ')}` });
    }
    const result = await changeStatus(id, status);
    if (result.error) return res.status(result.code).json({ ok: false, error: result.error });

    // Admin chatidagi xabar tugmalarini yangilash
    if (result.order.admin_message_id && config.bot.adminIds[0]) {
      bot.telegram
        .editMessageText(config.bot.adminIds[0], Number(result.order.admin_message_id), undefined,
          formatOrderMessage(result.order),
          { parse_mode: 'HTML', ...adminOrderKeyboard(id, result.order.status) })
        .catch((err) => logger.warn(`Admin xabari yangilanmadi: ${err.message}`));
    }
    return res.json({ ok: true, data: result.order });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/admin/stats */
async function stats(req, res, next) {
  try {
    return res.json({ ok: true, data: await Order.stats() });
  } catch (err) {
    return next(err);
  }
}

// ---------- Bot handlerlari ----------

/** Inline tugma: order:<id>:<status> */
async function handleStatusCallback(ctx) {
  const [, idStr, status] = ctx.match;
  if (!(await User.isAdmin(ctx.from.id))) return ctx.answerCbQuery('Faqat admin uchun', { show_alert: true });

  const result = await changeStatus(Number(idStr), status);
  if (result.error) return ctx.answerCbQuery(result.error, { show_alert: true });

  await ctx.answerCbQuery(STATUS_LABELS[status]);
  return ctx.editMessageText(formatOrderMessage(result.order), {
    parse_mode: 'HTML',
    ...adminOrderKeyboard(result.order.id, result.order.status),
  });
}

/** /orders buyrug'i yoki "Yangi buyurtmalar" tugmasi */
async function listNewOrdersInChat(ctx) {
  if (!(await User.isAdmin(ctx.from.id))) {
    return ctx.callbackQuery ? ctx.answerCbQuery('Faqat admin uchun') : undefined;
  }
  if (ctx.callbackQuery) await ctx.answerCbQuery();

  const orders = await Order.list({ status: 'new', limit: 10 });
  if (!orders.length) return ctx.reply('Yangi buyurtmalar yo\'q ✅');
  for (const order of orders) {
    await ctx.reply(formatOrderMessage(order), {
      parse_mode: 'HTML',
      ...adminOrderKeyboard(order.id, order.status),
    });
  }
  return undefined;
}

/** /admin buyrug'i */
async function adminPanel(ctx) {
  if (!(await User.isAdmin(ctx.from.id))) return ctx.reply('Bu buyruq faqat admin uchun.');
  return ctx.reply('🛠 Admin boshqaruvi:', adminMenu());
}

module.exports = {
  adminPanel,
  formatSum,
  formatOrderMessage,
  notifyAdminsNewOrder,
  listOrders,
  getOrder,
  updateOrderStatus,
  stats,
  handleStatusCallback,
  listNewOrdersInChat,
};
