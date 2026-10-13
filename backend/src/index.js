const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config/default');
const logger = require('./utils/logger');
const bot = require('./core/bot');
const { pool, checkConnection, applySchema } = require('./database/connection');
const { apiRouter, registerBotHandlers } = require('./routes/bot.routes');

const app = express();
// CSP va frameguard o'chirilgan: Mini App Telegram ichida (web.telegram.org iframe) ochiladi
app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
app.use(express.json({ limit: '100kb' }));

registerBotHandlers(bot);

// Webhook rejimi (WEBHOOK_DOMAIN berilgan bo'lsa)
if (config.bot.webhookDomain) {
  app.use(
    bot.webhookCallback(config.bot.webhookPath, {
      secretToken: config.bot.webhookSecret || undefined,
    })
  );
}

app.use('/api', apiRouter);

// Frontend statik build (frontend/out) shu serverning o'zidan beriladi
const staticDir = path.resolve(__dirname, '../../frontend/out');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir, { extensions: ['html'] }));
  logger.info(`Frontend statik fayllari: ${staticDir}`);
}

app.use((req, res) => res.status(404).json({ ok: false, error: 'Topilmadi' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) logger.error(err.stack || err.message);
  res.status(status).json({ ok: false, error: status >= 500 ? 'Serverda xatolik' : err.message });
});

async function setupBot() {
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Botni ishga tushirish' },
    { command: 'menu', description: 'Menyuni ochish' },
    { command: 'help', description: 'Yordam' },
  ]);

  if (config.bot.webAppUrl.startsWith('https://')) {
    await bot.telegram.setChatMenuButton({
      menuButton: { type: 'web_app', text: '🍕 Menyu', web_app: { url: config.bot.webAppUrl } },
    });
  }

  if (config.bot.webhookDomain) {
    const url = `${config.bot.webhookDomain.replace(/\/$/, '')}${config.bot.webhookPath}`;
    await bot.telegram.setWebhook(url, {
      secret_token: config.bot.webhookSecret || undefined,
      drop_pending_updates: false,
    });
    logger.info(`Bot webhook o'rnatildi: ${url}`);
  } else {
    // Long polling: launch() bot to'xtaguncha resolve bo'lmaydi, shuning uchun await qilinmaydi
    bot.launch({ dropPendingUpdates: false }).catch((err) => {
      logger.error(`Bot ishga tushmadi: ${err.message}`);
      process.exit(1);
    });
    logger.info(`Bot long polling rejimida ishga tushdi (@${config.bot.username})`);
  }
}

async function main() {
  await checkConnection();
  if (config.db.autoInit) await applySchema();
  const server = app.listen(config.port, () => logger.info(`API server: http://localhost:${config.port}`));
  await setupBot();

  const shutdown = async (signal) => {
    logger.info(`${signal} qabul qilindi, to'xtatilmoqda...`);
    try {
      if (!config.bot.webhookDomain) bot.stop(signal);
    } catch {
      /* bot hali ishga tushmagan bo'lishi mumkin */
    }
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error(`Ishga tushirishda xato: ${err.stack || err.message}`);
  process.exit(1);
});

module.exports = app;
