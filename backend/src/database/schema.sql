-- Pizza Kuryer: Neon PostgreSQL schema
-- Qayta ishga tushirish xavfsiz (IF NOT EXISTS / ON CONFLICT).

-- ============ USERS ============
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    telegram_id   BIGINT      NOT NULL UNIQUE,
    first_name    VARCHAR(255),
    last_name     VARCHAR(255),
    username      VARCHAR(255),
    phone         VARCHAR(32),
    language_code VARCHAR(10),
    role          VARCHAR(16) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    is_blocked    BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============ CATEGORIES ============
CREATE TABLE IF NOT EXISTS categories (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    sort_order INT          NOT NULL DEFAULT 0,
    is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============ PRODUCTS ============
CREATE TABLE IF NOT EXISTS products (
    id           SERIAL PRIMARY KEY,
    category_id  INT          REFERENCES categories(id) ON DELETE SET NULL,
    name         VARCHAR(150) NOT NULL UNIQUE,
    description  TEXT,
    price        INT          NOT NULL CHECK (price >= 0),  -- so'mda
    image_url    TEXT,
    is_available BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order   INT          NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- Katalog (3-qism): eski narx, teglar, tarkib va o'lchamlar
--   tags:        'popular' (Mashhur), 'cheesy' (Pishloqli), 'spicy' (Achiq)
--   sizes:       [{ "code": "m", "label": "30 sm", "price": 85000, "old_price": 99000 }]
--                Bo'sh bo'lsa products.price ishlatiladi.
ALTER TABLE products ADD COLUMN IF NOT EXISTS old_price   INT CHECK (old_price IS NULL OR old_price >= 0);
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags        TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes       JSONB  NOT NULL DEFAULT '[]'::jsonb;

-- ============ ORDERS ============
CREATE TABLE IF NOT EXISTS orders (
    id               SERIAL PRIMARY KEY,
    user_id          INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    customer_name    VARCHAR(255) NOT NULL,
    phone            VARCHAR(32)  NOT NULL,
    address          TEXT,
    comment          TEXT,
    has_sauce        BOOLEAN      NOT NULL DEFAULT FALSE,   -- Order Bump (Sous)
    sauce_price      INT          NOT NULL DEFAULT 0,
    subtotal         INT          NOT NULL CHECK (subtotal >= 0),
    delivery_fee     INT          NOT NULL DEFAULT 0,
    total            INT          NOT NULL CHECK (total >= 0),
    payment_method   VARCHAR(16)  NOT NULL CHECK (payment_method IN ('click', 'payme', 'cash', 'stars')),
    payment_status   VARCHAR(16)  NOT NULL DEFAULT 'pending'
                     CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    status           VARCHAR(16)  NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new', 'accepted', 'on_the_way', 'delivered', 'cancelled')),
    admin_message_id BIGINT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user       ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- ============ ORDER ITEMS ============
CREATE TABLE IF NOT EXISTS order_items (
    id           SERIAL PRIMARY KEY,
    order_id     INT          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id   INT          REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(150) NOT NULL,   -- buyurtma paytidagi nom (snapshot)
    unit_price   INT          NOT NULL,   -- buyurtma paytidagi narx (snapshot)
    quantity     INT          NOT NULL CHECK (quantity > 0),
    line_total   INT          NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size VARCHAR(16);  -- tanlangan o'lcham kodi

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated    ON users;
DROP TRIGGER IF EXISTS trg_products_updated ON products;
DROP TRIGGER IF EXISTS trg_orders_updated   ON orders;
CREATE TRIGGER trg_users_updated    BEFORE UPDATE ON users    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_updated   BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============ Boshlang'ich ma'lumotlar (seed) ============
INSERT INTO categories (name, sort_order) VALUES
    ('Pitsalar', 1),
    ('Ichimliklar', 2)
ON CONFLICT (name) DO NOTHING;

INSERT INTO products (category_id, name, description, price, sort_order) VALUES
    ((SELECT id FROM categories WHERE name = 'Pitsalar'),    'Margarita',     'Pomidor sousi, mozzarella, rayhon', 65000, 1),
    ((SELECT id FROM categories WHERE name = 'Pitsalar'),    'Pepperoni',     'Pepperoni kolbasa, mozzarella',     75000, 2),
    ((SELECT id FROM categories WHERE name = 'Pitsalar'),    'To''rt pishloq', 'Mozzarella, parmezan, chedder, dor blyu', 85000, 3),
    ((SELECT id FROM categories WHERE name = 'Pitsalar'),    'Achchiq Meksika', 'Jalapeno, mol go''shti, achchiq sous', 79000, 4),
    ((SELECT id FROM categories WHERE name = 'Pitsalar'),    'Tovuqli BBQ',     'Tovuq, BBQ sousi, piyoz, mozzarella', 72000, 5),
    ((SELECT id FROM categories WHERE name = 'Ichimliklar'), 'Coca-Cola 1L',  NULL, 12000, 1),
    ((SELECT id FROM categories WHERE name = 'Ichimliklar'), 'Fanta 0.5L',    NULL, 8000, 2)
ON CONFLICT (name) DO NOTHING;

-- Katalog ma'lumotlari (faqat hali to'ldirilmagan mahsulotlar uchun)
UPDATE products p SET
    old_price   = v.old_price,
    tags        = v.tags,
    ingredients = v.ingredients,
    sizes       = v.sizes::jsonb
FROM (VALUES
    ('Margarita', 75000, ARRAY['popular'],
        ARRAY['Pomidor sousi', 'Mozzarella', 'Yangi rayhon', 'Zaytun moyi'],
        '[{"code":"s","label":"25 sm","price":55000,"old_price":62000},{"code":"m","label":"30 sm","price":65000,"old_price":75000},{"code":"l","label":"35 sm","price":79000,"old_price":89000}]'),
    ('Pepperoni', 89000, ARRAY['popular', 'spicy'],
        ARRAY['Pepperoni kolbasa', 'Mozzarella', 'Pomidor sousi', 'Oregano'],
        '[{"code":"s","label":"25 sm","price":62000,"old_price":72000},{"code":"m","label":"30 sm","price":75000,"old_price":89000},{"code":"l","label":"35 sm","price":92000,"old_price":105000}]'),
    ('To''rt pishloq', 99000, ARRAY['popular', 'cheesy'],
        ARRAY['Mozzarella', 'Parmezan', 'Chedder', 'Dor blyu', 'Qaymoqli sous'],
        '[{"code":"s","label":"25 sm","price":72000,"old_price":82000},{"code":"m","label":"30 sm","price":85000,"old_price":99000},{"code":"l","label":"35 sm","price":105000,"old_price":119000}]'),
    ('Achchiq Meksika', 92000, ARRAY['spicy'],
        ARRAY['Mol go''shti', 'Jalapeno', 'Achchiq sous', 'Bolgar qalampiri', 'Mozzarella'],
        '[{"code":"s","label":"25 sm","price":66000,"old_price":76000},{"code":"m","label":"30 sm","price":79000,"old_price":92000},{"code":"l","label":"35 sm","price":96000,"old_price":110000}]'),
    ('Tovuqli BBQ', NULL, ARRAY['cheesy'],
        ARRAY['Tovuq filesi', 'BBQ sousi', 'Qizil piyoz', 'Mozzarella', 'Chedder'],
        '[{"code":"s","label":"25 sm","price":60000},{"code":"m","label":"30 sm","price":72000},{"code":"l","label":"35 sm","price":88000}]'),
    ('Coca-Cola 1L', NULL, ARRAY[]::text[], ARRAY[]::text[], '[]'),
    ('Fanta 0.5L',   NULL, ARRAY[]::text[], ARRAY[]::text[], '[]')
) AS v(name, old_price, tags, ingredients, sizes)
WHERE p.name = v.name AND p.sizes = '[]'::jsonb AND cardinality(p.tags) = 0;

-- ============ TO'LOV TURLARI SOZLAMALARI (4-qism) ============
-- Admin panelda har bir to'lov turini yoqish/o'chirish mumkin.
CREATE TABLE IF NOT EXISTS payment_settings (
    method     VARCHAR(16) PRIMARY KEY CHECK (method IN ('click', 'payme', 'cash', 'stars')),
    is_enabled BOOLEAN     NOT NULL DEFAULT TRUE,
    sort_order INT         NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO payment_settings (method, is_enabled, sort_order) VALUES
    ('stars', TRUE, 1),
    ('click', TRUE, 2),
    ('payme', TRUE, 3),
    ('cash',  TRUE, 4)
ON CONFLICT (method) DO NOTHING;

-- Telegram Stars to'lovi uchun
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stars_amount INT;                       -- invoysdagi Stars soni
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_charge_id VARCHAR(255);          -- telegram_payment_charge_id
