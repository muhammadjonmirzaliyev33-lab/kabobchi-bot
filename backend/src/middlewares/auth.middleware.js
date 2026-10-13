const crypto = require('crypto');
const config = require('../config/default');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Telegram WebApp initData imzosini tekshiradi.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * @returns {object|null} tekshirilgan ma'lumot (user, auth_date, ...) yoki null
 */
function validateInitData(initData, botToken, maxAgeSeconds) {
  if (!initData || typeof initData !== 'string') return null;

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const a = Buffer.from(calculated, 'hex');
  const b = Buffer.from(hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const authDate = Number(params.get('auth_date'));
  if (maxAgeSeconds && (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds)) return null;

  const result = Object.fromEntries(params.entries());
  try {
    if (result.user) result.user = JSON.parse(result.user);
  } catch {
    return null;
  }
  return result;
}

/** initData ni so'rovdan olish: "Authorization: tma <initData>" yoki "X-Telegram-Init-Data" */
function extractInitData(req) {
  const auth = req.get('authorization') || '';
  if (auth.toLowerCase().startsWith('tma ')) return auth.slice(4);
  return req.get('x-telegram-init-data') || null;
}

/** Mini App so'rovlari uchun: initData ni tekshiradi, req.tgUser va req.user ni o'rnatadi */
async function telegramAuth(req, res, next) {
  try {
    const data = validateInitData(extractInitData(req), config.bot.token, config.bot.initDataMaxAge);
    if (!data?.user?.id) {
      return res.status(401).json({ ok: false, error: 'Telegram initData noto\'g\'ri yoki eskirgan' });
    }
    req.tgUser = data.user;
    req.user = await User.upsertFromTelegram(data.user);
    if (req.user.is_blocked) {
      return res.status(403).json({ ok: false, error: 'Foydalanuvchi bloklangan' });
    }
    return next();
  } catch (err) {
    logger.error(`telegramAuth: ${err.message}`);
    return next(err);
  }
}

/** telegramAuth dan keyin ishlatiladi: faqat adminlar */
async function requireAdmin(req, res, next) {
  try {
    if (!req.tgUser || !(await User.isAdmin(req.tgUser.id))) {
      return res.status(403).json({ ok: false, error: 'Faqat admin uchun' });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { validateInitData, telegramAuth, requireAdmin };
