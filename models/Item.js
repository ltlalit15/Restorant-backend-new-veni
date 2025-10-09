const db = require('../config/database');

class Item {
  static async getAll(category_id, subcategory_id) {
    let query = `
      SELECT i.*, c.category_name, s.subcategory_name
      FROM 	item_new i
      JOIN category c ON i.category_id=c.id
      JOIN sub_category s ON i.subcategory_id=s.id
      WHERE 1=1
    `;
    let params = [];

    if (category_id) {
      query += " AND i.category_id=?";
      params.push(category_id);
    }

    if (subcategory_id) {
      query += " AND i.subcategory_id=?";
      params.push(subcategory_id);
    }

    query += " ORDER BY i.item_name";

    return db.execute(query, params);
  }

  static async create(category_id, subcategory_id, printer_id, items) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (let item of items) {
        await conn.execute(
          'INSERT INTO 	item_new (category_id, subcategory_id, printer_id, item_name, price) VALUES (?, ?, ?, ?, ?)',
          [category_id, subcategory_id, printer_id, item.item_name, item.price]
        );
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async update(id, item_name, price, category_id, subcategory_id, printer_id, status) {
    return db.execute(
      `UPDATE 	item_new 
       SET item_name=?, price=?, category_id=?, subcategory_id=?, printer_id=?, status=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`,
      [item_name, price, category_id, subcategory_id, printer_id, status, id]
    );
  }

  static async delete(id) {
    return db.execute('DELETE FROM 	item_new WHERE id=?', [id]);
  }

    static async getBySubcategoryId(subcategory_id) {
    return db.execute(
      `
      SELECT i.*, c.category_name, s.subcategory_name, p.name AS printer_name
      FROM item_new i
      JOIN category c ON i.category_id = c.id
      LEFT JOIN sub_category s ON i.subcategory_id = s.id
       LEFT JOIN printers p ON i.printer_id = p.id
      WHERE i.subcategory_id = ?
      ORDER BY i.item_name
      `,
      [subcategory_id]
    );
  }
}

module.exports = Item;
