const config = require('../config/default');
const logger = require('../utils/logger');
const bot = require('../core/bot');
const User = require('../models/User');
const Product = require('../models/Product');
const { Order, PAYMENT_METHODS, PAYMENT_LABELS } = require('../models/Order');
const PaymentSetting = require('../models/PaymentSetting');
const { notifyAdminsNewOrder, formatSum } = require('./adminController');
const { createPaymentForOrder } = require('./paymentController');

const MAX_QTY_PER_ITEM = 50;

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

/**
 * Savatni server tomonida hisoblaydi (narxlar faqat bazadan olinadi).
 * input: { items: [{ product_id, quantity, size? }], has_sauce: boolean }
 */
async function calculateCart({ items, has_sauce: hasSauce }) {
  if (!Array.isArray(items) || items.length === 0) throw new ValidationError('Savat bo\'sh');

  // Bir xil mahsulot + o'lchamni birlashtirish
  const lineByKey = new Map();
  for (const item of items) {
    const id = Number(item?.product_id);
    const qty = Number(item?.quantity);
    const size = item?.size == null || item.size === '' ? null : String(item.size).slice(0, 16);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      throw new ValidationError('Mahsulot yoki miqdor noto\'g\'ri');
    }
    const key = `${id}:${size ?? ''}`;
    const prev = lineByKey.get(key);
    const quantity = (prev?.quantity || 0) + qty;
    if (quantity > MAX_QTY_PER_ITEM) throw new ValidationError('Mahsulot yoki miqdor noto\'g\'ri');
    lineByKey.set(key, { id, size, quantity });
  }

  const ids = [...new Set([...lineByKey.values()].map((l) => l.id))];
  const products = await Product.findAvailableByIds(ids);
  if (products.length !== ids.length) throw new ValidationError('Ba\'zi mahsulotlar mavjud emas');
  const productById = new Map(products.map((p) => [p.id, p]));

  const lines = [...lineByKey.values()].map(({ id, size, quantity }) => {
    const p = productById.get(id);
    const sizes = Array.isArray(p.sizes) ? p.sizes : [];
    let unitPrice = p.price;
    let name = p.name;
    if (size) {
      const s = sizes.find((x) => x.code === size);
      if (!s) throw new ValidationError(`"${p.name}" uchun o'lcham noto'g'ri`);
      unitPrice = Number(s.price);
      name = `${p.name} (${s.label})`;
    }
    return {
      product_id: p.id,
      product_name: name,
      size,
      unit_price: unitPrice,
      quantity,
      line_total: unitPrice * quantity,
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.line_total, 0);
  const saucePrice = hasSauce ? config.business.saucePrice : 0;
  const deliveryFee = config.business.deliveryFee;

  return {
    items: lines,
    has_sauce: Boolean(hasSauce),
    sauce_price: saucePrice,
    subtotal,
    delivery_fee: deliveryFee,
    total: subtotal + saucePrice + deliveryFee,
  };
}

// ---------- Menyu ----------

/** GET /api/categories */
async function getCategories(req, res, next) {
  try {
    return res.json({ ok: true, data: await Product.getCategories() });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/products?category_id=1 */
async function getProducts(req, res, next) {
  try {
    const categoryId = req.query.category_id ? Number(req.query.category_id) : undefined;
    return res.json({
      ok: true,
      data: await Product.getAll({ categoryId }),
      meta: { sauce_price: config.business.saucePrice, delivery_fee: config.business.deliveryFee },
    });
  } catch (err) {
    return next(err);
  }
}

// ---------- Savat va buyurtma ----------

/** POST /api/cart/calculate  body: { items, has_sauce } */
async function calculate(req, res, next) {
  try {
    return res.json({ ok: true, data: await calculateCart(req.body || {}) });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/orders (Checkout)
 * body: { items: [{product_id, quantity, size?}], has_sauce, payment_method, name, phone, address?, comment? }
 */
async function createOrder(req, res, next) {
  try {
    const body = req.body || {};
    const paymentMethod = String(body.payment_method || '').toLowerCase();
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw new ValidationError(`payment_method: ${PAYMENT_METHODS.join(', ')}`);
    }
    if (!(await PaymentSetting.isEnabled(paymentMethod))) {
      throw new ValidationError(`${PAYMENT_LABELS[paymentMethod]} orqali to'lov hozircha o'chirilgan`);
    }

    const phone = String(body.phone || req.user.phone || '').trim();
    if (!/^\+?\d[\d\s\-()]{6,20}$/.test(phone)) throw new ValidationError('Telefon raqam noto\'g\'ri');

    const customerName =
      String(body.name || '').trim() ||
      [req.tgUser.first_name, req.tgUser.last_name].filter(Boolean).join(' ') ||
      'Mijoz';

    const cart = await calculateCart(body);

    const order = await Order.create(
      {
        user_id: req.user.id,
        customer_name: customerName.slice(0, 255),
        phone,
        address: body.address ? String(body.address).slice(0, 1000) : null,
        comment: body.comment ? String(body.comment).slice(0, 1000) : null,
        has_sauce: cart.has_sauce,
        sauce_price: cart.sauce_price,
        subtotal: cart.subtotal,
        delivery_fee: cart.delivery_fee,
        total: cart.total,
        payment_method: paymentMethod,
      },
      cart.items
    );

    if (!req.user.phone) await User.updatePhone(req.tgUser.id, phone);
    logger.info(`Yangi buyurtma #${order.id}: ${order.total} so'm (${paymentMethod})`);

    // Admin(lar)ga zudlik bilan xabar
    await notifyAdminsNewOrder({ ...order, username: req.user.username });

    // To'lov (Stars invoys / Click, Payme havolasi). Xato bo'lsa ham buyurtma saqlanib qoladi.
    let payment;
    try {
      payment = await createPaymentForOrder(order);
    } catch (err) {
      logger.error(`Buyurtma #${order.id} uchun to'lov yaratilmadi: ${err.message}`);
      payment = { type: paymentMethod, error: 'To\'lovni yaratib bo\'lmadi, operator siz bilan bog\'lanadi' };
    }

    // Mijozga tasdiq
    const payHint = paymentMethod === 'cash' ? 'To\'lov kuryerga naqd beriladi.' : 'Tez orada operator siz bilan bog\'lanadi.';
    bot.telegram
      .sendMessage(
        req.tgUser.id,
        `✅ Buyurtmangiz qabul qilindi! #${order.id}\n` +
          `💵 Jami: ${formatSum(order.total)} so'm\n` +
          `💳 To'lov: ${PAYMENT_LABELS[paymentMethod]}\n\n${payHint}`
      )
      .catch((err) => logger.warn(`Mijozga tasdiq yuborilmadi: ${err.message}`));

    return res.status(201).json({ ok: true, data: { ...order, payment } });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/orders/my */
async function myOrders(req, res, next) {
  try {
    return res.json({ ok: true, data: await Order.listByUser(req.user.id) });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/me */
async function me(req, res) {
  return res.json({ ok: true, data: req.user });
}

module.exports = {
  calculateCart,
  getCategories,
  getProducts,
  calculate,
  createOrder,
  myOrders,
  me,
};
