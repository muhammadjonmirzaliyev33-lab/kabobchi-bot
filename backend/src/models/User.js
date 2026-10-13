const { query } = require('../database/connection');
const config = require('../config/default');

const User = {
  /** Telegram foydalanuvchisini yaratadi yoki ma'lumotlarini yangilaydi */
  async upsertFromTelegram(tgUser) {
    const role = config.bot.adminIds.includes(Number(tgUser.id)) ? 'admin' : 'user';
    const { rows } = await query(
      `INSERT INTO users (telegram_id, first_name, last_name, username, language_code, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (telegram_id) DO UPDATE SET
         first_name    = EXCLUDED.first_name,
         last_name     = EXCLUDED.last_name,
         username      = EXCLUDED.username,
         language_code = EXCLUDED.language_code,
         role          = CASE WHEN users.role = 'admin' THEN 'admin' ELSE EXCLUDED.role END
       RETURNING *`,
      [
        tgUser.id,
        tgUser.first_name || null,
        tgUser.last_name || null,
        tgUser.username || null,
        tgUser.language_code || null,
        role,
      ]
    );
    return rows[0];
  },

  async findByTelegramId(telegramId) {
    const { rows } = await query('SELECT * FROM users WHERE telegram_id = $1', [telegramId]);
    return rows[0] || null;
  },

  async updatePhone(telegramId, phone) {
    const { rows } = await query(
      'UPDATE users SET phone = $2 WHERE telegram_id = $1 RETURNING *',
      [telegramId, phone]
    );
    return rows[0] || null;
  },

  /** Admin: .env dagi ADMIN_IDS yoki bazadagi role = 'admin' */
  async isAdmin(telegramId) {
    if (config.bot.adminIds.includes(Number(telegramId))) return true;
    const user = await User.findByTelegramId(telegramId);
    return user?.role === 'admin';
  },
};

module.exports = User;
