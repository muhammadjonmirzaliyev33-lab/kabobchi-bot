import asyncio
import logging
import time
from collections import defaultdict
from aiogram import Bot, Dispatcher, F
from aiogram.types import Message, WebAppInfo, KeyboardButton, ReplyKeyboardMarkup, MenuButtonCommands, BotCommand, BotCommandScopeDefault
from aiogram.filters import CommandStart, Command
from aiogram.enums import ParseMode
from aiogram.client.default import DefaultBotProperties

BOT_TOKEN = "8994020477:AAHrKIEsHwPTzC81WeEWDKh88AodaxBWu1o"
WEBAPP_URL = "https://kabobchi-web.vercel.app"

# Premium emojis
PREMIUM = {
    "fire": "🔥", "diamond": "💎", "star": "⭐", "money": "💰",
    "gift": "🎁", "lightning": "⚡", "thinking": "🤔", "heart": "❤️",
    "clap": "👏", "cool": "😎", "laugh": "😂", "pray": "🙏",
    "rocket": "🚀", "check": "✅", "crown": "👑", "muscle": "💪",
}

# Xavfsizlik sozlamalari
RATE_LIMIT = 5  # 5 xabar
RATE_LIMIT_WINDOW = 60  # 60 soniyada
MAX_MESSAGE_LENGTH = 500
BLOCK_DURATION = 300  # 5 daqiqa block

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

# Xavfsizlik ma'lumotlari
user_messages = defaultdict(list)
blocked_users = {}
spam_warnings = defaultdict(int)
admin_ids = [123456789]  # Admin ID lar shu yerga qo'shiladi


def is_rate_limited(user_id: int) -> bool:
    now = time.time()
    user_messages[user_id] = [t for t in user_messages[user_id] if now - t < RATE_LIMIT_WINDOW]
    if len(user_messages[user_id]) >= RATE_LIMIT:
        return True
    user_messages[user_id].append(now)
    return False


def is_blocked(user_id: int) -> bool:
    if user_id in blocked_users:
        if time.time() - blocked_users[user_id] < BLOCK_DURATION:
            return True
        else:
            del blocked_users[user_id]
            spam_warnings[user_id] = 0
    return False


def block_user(user_id: int):
    blocked_users[user_id] = time.time()
    spam_warnings[user_id] = 0


def check_spam(user_id: int) -> bool:
    spam_warnings[user_id] += 1
    if spam_warnings[user_id] >= 3:
        block_user(user_id)
        return True
    return False


def is_admin(user_id: int) -> bool:
    return user_id in admin_ids


def validate_input(text: str) -> bool:
    if not text or len(text) > MAX_MESSAGE_LENGTH:
        return False
    dangerous_patterns = [
        "<script", "javascript:", "onerror=", "onload=",
        "eval(", "document.cookie", "window.location",
        "DROP TABLE", "DELETE FROM", "INSERT INTO",
        "../../", "..\\", "%00", "\x00",
    ]
    text_lower = text.lower()
    for pattern in dangerous_patterns:
        if pattern.lower() in text_lower:
            return False
    return True


def get_main_keyboard():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=f"{PREMIUM['fire']} Menyu", web_app=WebAppInfo(url=WEBAPP_URL))],
            [KeyboardButton(text=f"{PREMIUM['diamond']} Buyurtmalarim"), KeyboardButton(text=f"{PREMIUM['star']} Kafe haqida")],
            [KeyboardButton(text=f"{PREMIUM['money']} Manzil"), KeyboardButton(text=f"{PREMIUM['gift']} Aloqa")]
        ],
        resize_keyboard=True
    )


async def set_bot_commands():
    commands = [
        BotCommand(command="start", description=f"{PREMIUM['rocket']} Botni ishga tushirish"),
        BotCommand(command="menu", description=f"{PREMIUM['fire']} Menyuni ochish"),
        BotCommand(command="orders", description=f"{PREMIUM['diamond']} Buyurtmalarim"),
        BotCommand(command="about", description=f"{PREMIUM['star']} Kafe haqida"),
        BotCommand(command="location", description=f"{PREMIUM['money']} Manzil"),
        BotCommand(command="contact", description=f"{PREMIUM['gift']} Aloqa"),
        BotCommand(command="help", description=f"{PREMIUM['thinking']} Yordam"),
    ]
    await bot.set_my_commands(commands, scope=BotCommandScopeDefault())
    await bot.set_chat_menu_button(menu_button=MenuButtonCommands())


@dp.message(CommandStart())
async def cmd_start(message: Message):
    user_id = message.from_user.id

    if is_blocked(user_id):
        await message.answer(f"{PREMIUM['diamond']} Siz vaqtincha bloklangansiz. {BLOCK_DURATION} soniya kuting.")
        return

    if is_rate_limited(user_id):
        if check_spam(user_id):
            await message.answer(f"{PREMIUM['fire']} Spam aniqlandi! Siz bloklandingiz.")
        else:
            await message.answer(f"{PREMIUM['thinking']} Tezlik juda ko'p. {RATE_LIMIT_WINDOW} soniya kuting.")
        return

    if not validate_input(message.text):
        await message.answer(f"{PREMIUM['diamond']} Noto'g'ri ma'lumot kiritildi.")
        return

    text = (
        f"{PREMIUM['fire']} <b>Xush kelibsiz, {message.from_user.first_name}!</b>\n\n"
        f"🍢 <b>Kabobchi</b> — Bekobod shahridagi eng mazali kabob va turk taomlari kafesi! {PREMIUM['diamond']}\n\n"
        f"📍 <b>Manzil:</b> Bekobod shahri, Milliy ko'cha 15\n"
        f"🕐 <b>Ish vaqti:</b> 10:00 - 23:00\n"
        f"📞 <b>Telefon:</b> +998 90 123 45 67\n\n"
        f"🍔 <b>Bizning afzalliklarimiz:</b>\n"
        f"• 🥩 Yangi va sifatli mahsulotlar\n"
        f"• ⚡ Tez yetkazib berish\n"
        f"• 💰 Qulay narxlar\n"
        f"• 🎁 Doimiy aksiyalar\n\n"
        f"⬇️ Buyurtma berish uchun quyidagi <b>🍽 Menyu</b> tugmasini bosing:"
    )
    await message.answer(text, reply_markup=get_main_keyboard())


@dp.message(Command("menu"))
async def cmd_menu(message: Message):
    user_id = message.from_user.id
    if is_blocked(user_id) or is_rate_limited(user_id):
        return

    text = (
        f"🍽 <b>Menyuni ochish uchun pastdagi {PREMIUM['fire']} Menyu tugmasini bosing!</b>\n\n"
        f"{PREMIUM['diamond']} Yoki quyidagi havolani bosishingiz mumkin:"
    )
    await message.answer(text, reply_markup=get_main_keyboard())


@dp.message(Command("orders"))
@dp.message(F.text.contains("Buyurtmalarim"))
async def my_orders(message: Message):
    user_id = message.from_user.id
    if is_blocked(user_id) or is_rate_limited(user_id):
        return

    text = (
        f"{PREMIUM['diamond']} <b>Sizning buyurtmalaringiz</b>\n\n"
        f"{PREMIUM['fire']} Hozircha buyurtmalar yo'q.\n"
        f"{PREMIUM['gift']} Buyurtma berish uchun 🍽 Menyu tugmasini bosing!"
    )
    await message.answer(text, reply_markup=get_main_keyboard())


@dp.message(Command("about"))
@dp.message(F.text.contains("Kafe haqida"))
async def about_cafe(message: Message):
    user_id = message.from_user.id
    if is_blocked(user_id) or is_rate_limited(user_id):
        return

    text = (
        f"🍢 <b>Kabobchi kafesi haqida</b> {PREMIUM['diamond']}\n\n"
        f"<b>Bizning tariximiz:</b>\n"
        f"{PREMIUM['fire']} Kabobchi kafesi 2020-yildan beri Bekobod shahrida faoliyat yuritmoqda. "
        f"Biz an'anaviy o'zbek va turk taomlarini eng yuqori sifatda taqdim etamiz.\n\n"
        f"<b>Bizning xizmatlarimiz:</b>\n"
        f"• 🍢 Kaboblar (Tovuz, Qanotli, Shashlik, Adana)\n"
        f"• 🥙 Turk taomlari (Lahmacun, Doner)\n"
        f"• 🥗 Salatlar\n"
        f"• 🥤 Ichimliklar\n"
        f"• 🍰 Shirinliklar\n\n"
        f"<b>Afzalliklarimiz:</b>\n"
        f"• 🥩 Faqat yangi go'sht\n"
        f"• 🔥 Halol mahsulotlar\n"
        f"• ⚡ 30 daqiqada yetkazib berish\n"
        f"• 💰 Qulay narxlar\n"
        f"• 🎁 Har 5-buyurtmaga 10% chegirma\n\n"
        f"📍 <b>Manzil:</b> Bekobod shahri, Milliy ko'cha 15\n"
        f"🕐 <b>Ish vaqti:</b> 10:00 - 23:00 (Har kuni)\n"
        f"📞 <b>Telefon:</b> +998 90 123 45 67"
    )
    await message.answer(text)


@dp.message(Command("location"))
@dp.message(F.text.contains("Manzil"))
async def location(message: Message):
    user_id = message.from_user.id
    if is_blocked(user_id) or is_rate_limited(user_id):
        return

    text = (
        f"📍 <b>Bizning manzilimiz:</b> {PREMIUM['diamond']}\n\n"
        f"🏙 <b>Shahar:</b> Bekobod\n"
        f"📫 <b>Ko'cha:</b> Milliy ko'cha, 15-uy\n\n"
        f"🕐 <b>Ish vaqti:</b> 10:00 - 23:00 (Har kuni)\n"
        f"📞 <b>Telefon:</b> +998 90 123 45 67"
    )
    await message.answer(text)


@dp.message(Command("contact"))
@dp.message(F.text.contains("Aloqa"))
async def contact(message: Message):
    user_id = message.from_user.id
    if is_blocked(user_id) or is_rate_limited(user_id):
        return

    text = (
        f"📞 <b>Biz bilan bog'laning:</b> {PREMIUM['diamond']}\n\n"
        f"📱 <b>Telefon:</b> +998 90 123 45 67\n"
        f"📱 <b>Telegram:</b> @kabobchi_bot\n"
        f"📷 <b>Instagram:</b> @kabobchi_bekobod\n\n"
        f"💬 <b>Murojaat uchun:</b>\n"
        f"{PREMIUM['fire']} Savollaringiz bo'lsa, bizga Telegram orqali yozing!"
    )
    await message.answer(text)


@dp.message(Command("help"))
async def cmd_help(message: Message):
    user_id = message.from_user.id
    if is_blocked(user_id) or is_rate_limited(user_id):
        return

    text = (
        f"{PREMIUM['thinking']} <b>Yordam</b>\n\n"
        f"Buyruqlar:\n"
        f"/start — Botni ishga tushirish\n"
        f"/menu — Menyuni ochish\n"
        f"/orders — Buyurtmalarim\n"
        f"/about — Kafe haqida\n"
        f"/location — Manzil\n"
        f"/contact — Aloqa\n"
        f"/help — Yordam\n\n"
        f"{PREMIUM['diamond']} Savollaringiz bo'lsa, bizga yozing!"
    )
    await message.answer(text)


@dp.message()
async def unknown(message: Message):
    user_id = message.from_user.id

    if is_blocked(user_id):
        return

    if is_rate_limited(user_id):
        return

    if not validate_input(message.text):
        await message.answer(f"{PREMIUM['diamond']} Noto'g'ri ma'lumot kiritildi.")
        return

    text = (
        f"🤔 Noma'lum buyruq.\n\n"
        f"{PREMIUM['gift']} Buyurtma berish uchun 🍽 <b>Menyu</b> tugmasini bosing!"
    )
    await message.answer(text, reply_markup=get_main_keyboard())


async def main():
    await set_bot_commands()
    logger.info(f"{PREMIUM['fire']} Kabobchi bot is starting with security enabled...")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
