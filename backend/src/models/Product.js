const { query } = require('../database/connection');

const Product = {
  async getCategories() {
    const { rows } = await query(
      'SELECT id, name, sort_order FROM categories WHERE is_active = TRUE ORDER BY sort_order, id'
    );
    return rows;
  },

  /** Mini App menyusi: faqat mavjud mahsulotlar */
  async getAll({ categoryId } = {}) {
    const params = [];
    let where = 'p.is_available = TRUE';
    if (categoryId) {
      params.push(categoryId);
      where += ` AND p.category_id = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT p.id, p.name, p.description, p.price, p.old_price, p.image_url, p.category_id,
              p.tags, p.ingredients, p.sizes,
              c.name AS category_name
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE ${where}
        ORDER BY c.sort_order NULLS LAST, p.sort_order, p.id`,
      params
    );
    return rows;
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM products WHERE id = $1', [id]);
    return rows[0] || null;
  },

  /** Narxlarni hisoblash uchun bir nechta mahsulotni olish */
  async findAvailableByIds(ids) {
    const { rows } = await query(
      'SELECT id, name, price, sizes FROM products WHERE id = ANY($1::int[]) AND is_available = TRUE',
      [ids]
    );
    return rows;
  },
};

module.exports = Product;
