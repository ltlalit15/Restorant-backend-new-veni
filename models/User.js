const db = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require("crypto");

class User {
  // Create new user
  static async create(userData) {
    const { name, email, password, phone, role = 'user', discount_percentage = 0, permissions } = userData;
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Store nested object as JSON string
    const permissionsString = JSON.stringify(permissions);
    
    const [result] = await db.execute(
      `INSERT INTO users (name, email, password, phone, role, discount_percentage, permissions) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, hashedPassword, phone, role, discount_percentage, permissionsString]
    );
    
    return result.insertId;
  }

  // Find user by email
  static async findByEmail(email) {
    const [users] = await db.execute(
      'SELECT * FROM users WHERE email = ? AND status = "active"',
      [email]
    );
    return users[0];
  }

 // Find user by ID
  static async findById(id) {
    const [users] = await db.execute(
      'SELECT id, name, email, phone, role, status, discount_percentage, permissions, created_at FROM users WHERE id = ?',
      [id]
    );
    const user = users[0];

    if (user && typeof user.permissions === 'string') {
  try {
    user.permissions = JSON.parse(user.permissions);
  } catch (e) {
    user.permissions = [];
  }
}

    return user;
  }

  // Get all users with pagination
  // Get all users with pagination
static async getAll(page = 1, limit = 10, role = null) {
  const offset = (page - 1) * limit;

  // force integers (fixes Incorrect arguments to mysqld_stmt_execute)
  const safeLimit = parseInt(limit, 10);
  const safeOffset = parseInt(offset, 10);

  let query = 'SELECT id, name, email, phone, role, status, discount_percentage, permissions, created_at FROM users';
  let params = [];

  if (role) {
    query += ' WHERE role = ?';
    params.push(role);
  }

  // ✅ safe: numbers are injected directly
  query += ` ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;

  const [users] = await db.execute(query, params);

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM users';
  let countParams = [];

  if (role) {
    countQuery += ' WHERE role = ?';
    countParams.push(role);
  }

  const [countResult] = await db.execute(countQuery, countParams);

  return {
    users,
    total: countResult[0].total,
    page,
    limit: safeLimit,
    totalPages: Math.ceil(countResult[0].total / safeLimit)
  };
}


  // Update user
  static async update(id, userData) {
    const { name, email, phone, role, status, discount_percentage, permissions } = userData;

    // Ensure permissions is always an object
    const permissionsObject = typeof permissions === 'object' && permissions !== null ? permissions : {};

    // Convert permissions object to JSON string for DB
    const permissionsString = JSON.stringify(permissionsObject);
    
    const [result] = await db.execute(
      `UPDATE users SET name = ?, email = ?, phone = ?, role = ?, status = ?, discount_percentage = ?, permissions = ?
       WHERE id = ?`,
      [name, email, phone, role, status, discount_percentage, permissionsString, id]
    );
    
    return result.affectedRows > 0;
  }

  // Update password
  static async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const [result] = await db.execute(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );
    
    return result.affectedRows > 0;
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Delete user (soft delete)
// Delete user (hard delete)
static async delete(id) {
  const [result] = await db.execute(
    "DELETE FROM users WHERE id = ?",
    [id]
  );

  return result.affectedRows > 0;
}


  // Check if email exists
  static async emailExists(email, excludeId = null) {
    let query = 'SELECT id FROM users WHERE email = ?';
    let params = [email];
    
    if (excludeId) {
      query += ' AND id != ?';
      params.push(excludeId);
    }
    
    const [users] = await db.execute(query, params);
    return users.length > 0;
  }

  static async findByEmail(email) {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  }

static async saveResetToken(id, hashedToken, expiry) {
    // expiry ko Date object me convert karke ISO string banaye
    const expiryString = new Date(expiry).toISOString();
    await db.execute(
      'UPDATE users SET reset_token=?, reset_expires=? WHERE id=?',
      [hashedToken, expiryString, id]
    );
  }

 static async clearResetToken(id) {
    await db.execute(
      'UPDATE users SET reset_token=NULL, reset_expires=NULL WHERE id=?',
      [id]
    );
  }


 static async findByResetToken(token) {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE reset_token=?',
      [token]
    );
    return rows.length ? rows[0] : null;
  }

  
  static async updatePassword(id, hashedPassword) {
    await db.execute("UPDATE users SET password=? WHERE id=?", [hashedPassword, id]);
  }

 static async updatePassword(id, password) {
  const [result] = await db.execute(
    'UPDATE users SET password=?, reset_token=NULL, reset_expires=NULL WHERE id=?',
    [password, id]
  );
  return result.affectedRows > 0;
}


  // Get user statistics
  static async getStats() {
    const [stats] = await db.execute(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
        SUM(CASE WHEN role = 'staff' THEN 1 ELSE 0 END) as staff_count,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as user_count,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_users,
        SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) as inactive_users
      FROM users
    `);
    
    return stats[0];
  }
}




module.exports = User;
