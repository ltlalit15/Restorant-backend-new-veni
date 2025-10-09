const db = require('../config/database');

class Category {
  static async getAll() {
    return db.execute('SELECT * FROM category WHERE status="active" ORDER BY category_name');
  }

  static async create(category_name, printer_id) {
    return db.execute('INSERT INTO category (category_name, printer_id) VALUES (?, ?)', [category_name, printer_id]);
  }
  
static async update(id, fields) {
  const updates = [];
  const values = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {   // sirf wahi field jo bheja gaya
      updates.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (updates.length === 0) {
    throw new Error("No fields to update");
  }

  values.push(id);

  const sql = `UPDATE category SET ${updates.join(', ')} WHERE id = ?`;
  return db.execute(sql, values);
}


  


 // Category.js
static async delete(id) {
  
  await db.execute('DELETE FROM item_new WHERE category_id=?', [id]);
  
  await db.execute(
    `DELETE i FROM item_new i 
     JOIN sub_category s ON i.subcategory_id = s.id 
     WHERE s.category_id = ?`,
    [id]
  );

  // 3. Subcategories delete
  await db.execute('DELETE FROM sub_category WHERE category_id=?', [id]);

  // 4. Finally category delete
  return db.execute('DELETE FROM category WHERE id=?', [id]);
}


}

module.exports = Category;
