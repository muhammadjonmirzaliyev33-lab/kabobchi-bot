const User = require('../models/User');
const logger = require('../utils/logger');
const { openMiniAppInline, mainReplyKeyboard, adminMenu } = require('../utils/keyboards');

/** /start: foydalanuvchini bazaga yozadi va Mini App tugmasini chiqaradi */
async function start(ctx) {
  const user = await User.upsertFromTelegram(ctx.from);
  logger.info(`/start: ${ctx.from.id} (@${ctx.from.username || '-'})`);

  const name = ctx.from.first_name || 'do\'st';
  await ctx.reply(
    `Assalomu alaykum, ${name}! 🍕\n\n` +
      'Pizza Kuryer xizmatiga xush kelibsiz. Mazali pitsalarni bir necha bosishda buyurtma qiling!',
    mainReplyKeyboard()
  );
  await ctx.reply('👇 Menyuni ochish uchun tugmani bosing:', openMiniAppInline());

  if (user.role === 'admin') {
    await ctx.reply('🛠 Siz adminsiz. Boshqaruv:', adminMenu());
  }
}

/** Foydalanuvchi "Telefon raqamni yuborish" tugmasini bosganda */
async function saveContact(ctx) {
  const contact = ctx.message.contact;
  if (contact.user_id && contact.user_id !== ctx.from.id) {
    return ctx.reply('Iltimos, o\'zingizning raqamingizni yuboring.');
  }
  await User.upsertFromTelegram(ctx.from);
  await User.updatePhone(ctx.from.id, contact.phone_number);
  return ctx.reply('✅ Telefon raqamingiz saqlandi.', openMiniAppInline());
}

async function help(ctx) {
  return ctx.reply(
    '/start - Botni ishga tushirish\n/menu - Menyuni ochish\n/help - Yordam',
    openMiniAppInline()
  );
}

async function menu(ctx) {
  return ctx.reply('🍕 Menyu:', openMiniAppInline());
}

module.exports = { start, saveContact, help, menu };
