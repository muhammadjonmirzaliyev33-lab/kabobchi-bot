const { query, withTransaction } = require('../database/connection');

const ORDER_STATUSES = ['new', 'accepted', 'on_the_way', 'delivered', 'cancelled'];
const PAYMENT_METHODS = ['click', 'payme', 'cash', 'stars'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];

const STATUS_LABELS = {
  new: '🆕 Yangi',
  accepted: '👨‍🍳 Tayyorlanmoqda',
  on_the_way: '🚚 Kuryerga berildi',
  delivered: '✅ Bajarildi',
  cancelled: '❌ Bekor qilindi',
};

/** Admin panel bo'limlari: Yangi / Bajarilayotgan / Yakunlangan */
const STATUS_GROUPS = {
  new: ['new'],
  active: ['accepted', 'on_the_way'],
  done: ['delivered', 'cancelled'],
};

const PAYMENT_LABELS = {
  click: 'Click',
  payme: 'Payme',
  cash: 'Naqd',
  stars: 'Telegram Stars',
};

const ITEMS_JSON = `
  COALESCE(
    (SELECT json_agg(json_build_object(
              'product_id', oi.product_id, 'name', oi.product_name, 'size', oi.size,
              'unit_price', oi.unit_price, 'quantity', oi.quantity,
              'line_total', oi.line_total) ORDER BY oi.id)
       FROM order_items oi WHERE oi.order_id = o.id),
    '[]'::json) AS items`;

const Order = {
  /**
   * Buyurtma va uning mahsulotlarini bitta tranzaksiyada yaratadi.
   * items: [{ product_id, product_name, size, unit_price, quantity, line_total }]
   */
  async create(data, items) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO orders (user_id, customer_name, phone, address, comment, has_sauce,
                             sauce_price, subtotal, delivery_fee, total, payment_method)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING *`,
        [
          data.user_id, data.customer_name, data.phone, data.address, data.comment,
          data.has_sauce, data.sauce_price, data.subtotal, data.delivery_fee, data.total,
          data.payment_method,
        ]
      );
      const order = rows[0];

      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, size, unit_price, quantity, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [order.id, item.product_id, item.product_name, item.size ?? null, item.unit_price, item.quantity, item.line_total]
        );
      }
      order.items = items;
      return order;
    });
  },

  async findById(id) {
    const { rows } = await query(
      `SELECT o.*, u.telegram_id, u.username, ${ITEMS_JSON}
         FROM orders o JOIN users u ON u.id = o.user_id
        WHERE o.id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  /** Admin ro'yxati: status (bitta yoki massiv) bo'yicha filtr va sahifalash */
  async list({ status, limit = 50, offset = 0 } = {}) {
    const params = [];
    let where = '';
    const statuses = [].concat(status || []);
    if (statuses.length) {
      params.push(statuses);
      where = `WHERE o.status = ANY($${params.length}::text[])`;
    }
    params.push(limit, offset);
    const { rows } = await query(
      `SELECT o.*, u.telegram_id, u.username, ${ITEMS_JSON}
         FROM orders o JOIN users u ON u.id = o.user_id
        ${where}
        ORDER BY o.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return rows;
  },

  async listByUser(userId, limit = 20) {
    const { rows } = await query(
      `SELECT o.*, ${ITEMS_JSON} FROM orders o
        WHERE o.user_id = $1 ORDER BY o.created_at DESC LIMIT $2`,
      [userId, limit]
    );
    return rows;
  },

  async updateStatus(id, status) {
    const { rows } = await query(
      'UPDATE orders SET status = $2 WHERE id = $1 RETURNING *',
      [id, status]
    );
    return rows[0] || null;
  },

  async updatePaymentStatus(id, paymentStatus) {
    const { rows } = await query(
      'UPDATE orders SET payment_status = $2 WHERE id = $1 RETURNING *',
      [id, paymentStatus]
    );
    return rows[0] || null;
  },

  async setStarsAmount(id, starsAmount) {
    await query('UPDATE orders SET stars_amount = $2 WHERE id = $1', [id, starsAmount]);
  },

  /** To'lov tasdiqlandi (Telegram Stars successful_payment) */
  async markPaid(id, chargeId) {
    const { rows } = await query(
      `UPDATE orders SET payment_status = 'paid', payment_charge_id = $2
        WHERE id = $1 AND payment_status = 'pending' RETURNING *`,
      [id, chargeId]
    );
    return rows[0] || null;
  },

  async setAdminMessageId(id, messageId) {
    await query('UPDATE orders SET admin_message_id = $2 WHERE id = $1', [id, messageId]);
  },

  async stats() {
    const { rows } = await query(
      `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(total),0)::bigint AS sum
         FROM orders GROUP BY status`
    );
    return rows;
  },
};

module.exports = {
  Order,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  STATUS_LABELS,
  STATUS_GROUPS,
  PAYMENT_LABELS,
};
