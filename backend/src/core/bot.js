const { Telegraf } = require('telegraf');
const config = require('../config/default');
const logger = require('../utils/logger');

// Yagona bot instansiyasi. Handlerlar routes/bot.routes.js da ulanadi.
const bot = new Telegraf(config.bot.token);

bot.catch((err, ctx) => {
  logger.error(`Bot xatosi (${ctx.updateType}): ${err.stack || err.message}`);
});

module.exports = bot;
