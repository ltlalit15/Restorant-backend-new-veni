const db = require('../config/database');

class Subcategory {
  static async getByCategory(category_id) {
    return db.execute('SELECT * FROM sub_category WHERE category_id=?', [category_id]);
  }

    static async getallsubCategory() {
    return db.execute('SELECT * FROM sub_category');
  }

 

  static async create(category_id, subcategory_name, printer_id) {
    return db.execute('INSERT INTO sub_category (category_id, subcategory_name, printer_id) VALUES (?, ?, ?)', [category_id, subcategory_name, printer_id]);
  }

  static async update(id, category_id, subcategory_name, printer_id) {
    return db.execute('UPDATE sub_category SET category_id = ?, subcategory_name=?, printer_id = ? WHERE id=?', [category_id, subcategory_name, printer_id, id]);
  }

// Subcategory.js
static async delete(id) {
  // 1. Delete items of this subcategory
  await db.execute('DELETE FROM item_new WHERE subcategory_id=?', [id]);

  // 2. Delete the subcategory itself
  return db.execute('DELETE FROM sub_category WHERE id=?', [id]);
}
}

module.exports = Subcategory;
