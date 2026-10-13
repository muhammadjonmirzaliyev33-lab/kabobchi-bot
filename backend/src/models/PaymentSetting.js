const { query } = require('../database/connection');

/** To'lov turlarini yoqish/o'chirish sozlamalari (payment_settings jadvali) */
const PaymentSetting = {
  async getAll() {
    const { rows } = await query(
      'SELECT method, is_enabled, sort_order, updated_at FROM payment_settings ORDER BY sort_order, method'
    );
    return rows;
  },

  async isEnabled(method) {
    const { rows } = await query('SELECT is_enabled FROM payment_settings WHERE method = $1', [method]);
    // Jadvalda yozuv bo'lmasa (eski baza) — yoqilgan deb hisoblanadi
    return rows.length ? rows[0].is_enabled : true;
  },

  async setEnabled(method, isEnabled) {
    const { rows } = await query(
      `INSERT INTO payment_settings (method, is_enabled) VALUES ($1, $2)
       ON CONFLICT (method) DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = NOW()
       RETURNING method, is_enabled, sort_order, updated_at`,
      [method, isEnabled]
    );
    return rows[0];
  },
};

module.exports = PaymentSetting;
