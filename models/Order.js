const db = require('../config/database');

class Order {
  // Create new order
  static async create(orderData) {
    const connection = await db.getConnection();
    console.log("order Data : ", orderData);
    try {
      await connection.beginTransaction();

      const {
        session_id = null,
        table_id = null,
        user_id,
        customer_name,
        order_type = 'dine_in',
        special_instructions,
        items,
        subtotal,
        tax_amount,
        total_amount
      } = orderData;



      // Generate order number
      const order_number = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Create order using provided totals
      const [orderResult] = await connection.execute(
        `INSERT INTO orders 
        (order_number, session_id, table_id, user_id, customer_name, 
         order_type, subtotal, tax_amount, total_amount, special_instructions) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [order_number, session_id || null, table_id || null, user_id, customer_name, order_type,
          subtotal, tax_amount, total_amount, special_instructions]
      );

      const orderId = orderResult.insertId;

      // Insert order items using payload totals
      // Insert order items with validation
      for (const item of items) {
        const menuItemId = item.item_details.id;

        // Validate menu_item_id exists
        const [menuCheck] = await connection.execute(
          "SELECT id FROM item_new WHERE id = ?",
          [menuItemId]
        );
        if (menuCheck.length === 0) {
          throw new Error(`Menu item with id ${menuItemId} does not exist`);
        }

        await connection.execute(
          `INSERT INTO order_items 
          (order_id, menu_item_id, quantity, unit_price, total_price, tax_amount, total_with_tax, special_instructions) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            menuItemId,
            item.quantity,
            parseFloat(item.base_price),
            parseFloat(item.item_total_before_tax),
            parseFloat(item.item_tax),
            parseFloat(item.item_total_with_tax),
            item.special_instructions || null
          ]
        );
      }

      await connection.commit();
      return orderId;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }






  // Get order by ID with items
  static async findById(id) {
    const [orders] = await db.execute(
      `SELECT o.*, t.table_number, t.table_name, u.name as user_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [id]
    );

    if (orders.length === 0) return null;

    const order = orders[0];

    // Get order items
    const [items] = await db.execute(
      `SELECT oi.*, mi.name as item_name, mi.description as item_description
       FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = ?`,
      [id]
    );


    order.items = items;
    return order;
  }


  //static async getAll(page, limit, filters, offset) {
  //   let query = `
  //     SELECT o.*, t.table_number, t.table_name, u.name as user_name
  //     FROM orders o
  //     LEFT JOIN tables t ON o.table_id = t.id
  //     LEFT JOIN users u ON o.user_id = u.id
  //     WHERE 1=1
  //   `;
  //   const params = [];

  //   if (filters.status) {
  //     query += ` AND o.status = ?`;
  //     params.push(filters.status);
  //   }

  //   if (filters.table_id) {
  //     query += ` AND o.table_id = ?`;
  //     params.push(filters.table_id);
  //   }

  //   if (filters.date) {
  //     query += ` AND DATE(o.created_at) = ?`;
  //     params.push(filters.date);
  //   }

  //   // 🚨 Limit & Offset must be injected as numbers, not bound placeholders
  //   query += ` ORDER BY o.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

  //   const [orders] = await db.execute(query, params);

  //   // total count for pagination
  //   let countQuery = `SELECT COUNT(*) as total FROM orders o WHERE 1=1`;
  //   const countParams = [];

  //   if (filters.status) {
  //     countQuery += ` AND o.status = ?`;
  //     countParams.push(filters.status);
  //   }
  //   if (filters.table_id) {
  //     countQuery += ` AND o.table_id = ?`;
  //     countParams.push(filters.table_id);
  //   }
  //   if (filters.date) {
  //     countQuery += ` AND DATE(o.created_at) = ?`;
  //     countParams.push(filters.date);
  //   }

  //   const [countResult] = await db.execute(countQuery, countParams);

  //   return {
  //     orders,
  //     total: countResult[0].total,
  //     page,
  //     limit,
  //     totalPages: Math.ceil(countResult[0].total / limit)
  //   };
  // }

  static async getAll() {
    // 1️⃣ Get all orders with table and user info
    const ordersQuery = `
    SELECT o.*, t.table_number, t.table_name, u.name as user_name
    FROM orders o
    LEFT JOIN tables t ON o.table_id = t.id
    LEFT JOIN users u ON o.user_id = u.id
    ORDER BY o.created_at DESC
  `;
    const [orders] = await db.execute(ordersQuery);

    // 2️⃣ Get all items for the fetched orders
    const orderIds = orders.map(o => o.id);
    if (orderIds.length === 0) return []; // no orders

    const itemsQuery = `
    SELECT oi.*, mi.item_name, mi.category_id, mi.subcategory_id, mi.printer_id
    FROM order_items oi
    LEFT JOIN item_new mi ON oi.menu_item_id = mi.id
    WHERE oi.order_id IN (?)
  `;

    const [items] = await db.query(itemsQuery, [orderIds]);
    console.log('Items:', items);

    // 3️⃣ Map items to their orders
    const ordersWithItems = orders.map(order => {
      const orderItems = items
        .filter(i => i.order_id === order.id)
        .map(i => ({
          item_details: {
            id: i.menu_item_id,
            item_name: i.item_name || 'Unnamed Item',
            category_id: i.category_id,
            subcategory_id: i.subcategory_id,
            printer_id: i.printer_id
          },
          quantity: i.quantity,
          base_price: i.unit_price,
          item_total_before_tax: i.total_price,
          item_tax: i.tax_amount,
          item_total_with_tax: i.total_with_tax,
          special_instructions: i.special_instructions
        }));

      return {
        ...order,
        items: orderItems
      };
    });

    return ordersWithItems;
  }





  // Update order status
  static async updateStatus(id, status) {
    const [result] = await db.execute(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    return result.affectedRows > 0;
  }

  // Update order item status
  static async updateItemStatus(orderItemId, status) {
    const [result] = await db.execute(
      'UPDATE order_items SET status = ? WHERE id = ?',
      [status, orderItemId]
    );

    return result.affectedRows > 0;
  }

  // Get orders by table
  static async getByTable(tableId) {
    const [orders] = await db.execute(
      `SELECT o.*, u.name as user_name
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.table_id = ?
       ORDER BY o.created_at DESC`,
      [tableId]
    );

    return orders;
  }

  // Get orders by session
  static async getBySession(sessionId) {
    const [orders] = await db.execute(
      `SELECT o.*, t.table_number, t.table_name, u.name as user_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.session_id = ?
       ORDER BY o.created_at DESC`,
      [sessionId]
    );

    return orders;
  }

  static async getPendingOrdersGrouped() {
    const [rows] = await db.execute(`
    SELECT 
      o.id as order_id, o.order_number, o.created_at,
      t.table_number, t.table_name,
      oi.id as item_id, oi.quantity, oi.special_instructions, oi.status as item_status,
      i.item_name, i.printer_id,
      c.id as category_id, c.category_name,
      sc.id as subcategory_id, sc.subcategory_name
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN item_new i ON oi.menu_item_id = i.id
    LEFT JOIN tables t ON o.table_id = t.id
    LEFT JOIN category c ON i.category_id = c.id
    LEFT JOIN sub_category sc ON i.subcategory_id = sc.id
    WHERE oi.status IN ('pending', 'preparing')
    ORDER BY o.created_at ASC
  `);

    const printers = {};
    for (let row of rows) {
      if (!printers[row.printer_id]) {
        printers[row.printer_id] = {
          printer_id: row.printer_id,
          items: []
        };
      }

      printers[row.printer_id].items.push({
        order_id: row.order_id,
        order_number: row.order_number,
        created_at: row.created_at,
        table_number: row.table_number,
        table_name: row.table_name,
        item_id: row.item_id,
        item_name: row.item_name,
        quantity: row.quantity,
        special_instructions: row.special_instructions,
        item_status: row.item_status,
        category_id: row.category_id,
        category_name: row.category_name,
        subcategory_id: row.subcategory_id,
        subcategory_name: row.subcategory_name
      });
    }

    return Object.values(printers);
  }




  static async getReadyOrdersGrouped() {
    const [rows] = await db.execute(`
    SELECT 
      o.id as order_id, o.order_number, o.created_at, o.customer_name, o.subtotal,o.tax_amount,o.discount_amount,o.total_amount,
      t.table_number, t.table_name,
      oi.id as item_id, oi.quantity, oi.special_instructions, oi.status as item_status,
      i.item_name, i.price as item_price,i.printer_id,
      c.id as category_id, c.category_name,
      sc.id as subcategory_id, sc.subcategory_name
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN item_new i ON oi.menu_item_id = i.id
    LEFT JOIN tables t ON o.table_id = t.id
    LEFT JOIN category c ON i.category_id = c.id
    LEFT JOIN sub_category sc ON i.subcategory_id = sc.id
    WHERE oi.status = 'ready'
    ORDER BY o.created_at ASC
  `);

    const printers = {};
    for (let row of rows) {
      if (!printers[row.printer_id]) {
        printers[row.printer_id] = {
          printer_id: row.printer_id,
          items: []
        };
      }

      printers[row.printer_id].items.push({
        order_id: row.order_id,
        order_number: row.order_number,
        customer_name: row.customer_name,
        subtotal: row.subtotal,
        tax_amount: row.tax_amount,
        discount_amount: row.discount_amount,
        total_amount: row.total_amount,
        created_at: row.created_at,
        table_number: row.table_number,
        table_name: row.table_name,
        item_id: row.item_id,
        item_name: row.item_name,
         item_price: row.item_price,
        quantity: row.quantity,
        special_instructions: row.special_instructions,
        item_status: row.item_status,
        category_id: row.category_id,
        category_name: row.category_name,
        subcategory_id: row.subcategory_id,
        subcategory_name: row.subcategory_name
      });
    }

    return Object.values(printers);
  }




  // Get order statistics
  static async getStats(date = null) {
    let query = `
      SELECT 
        COUNT(*) as total_orders,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as average_order_value,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_orders,
        SUM(CASE WHEN status = 'preparing' THEN 1 ELSE 0 END) as preparing_orders,
        SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready_orders,
        SUM(CASE WHEN status = 'served' THEN 1 ELSE 0 END) as served_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM orders
    `;

    let params = [];

    if (date) {
      query += ' WHERE DATE(created_at) = ?';
      params.push(date);
    }

    const [stats] = await db.execute(query, params);
    return stats[0];
  }

  // Delete order
  static async delete(id) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Delete order items first
      await connection.execute('DELETE FROM order_items WHERE order_id = ?', [id]);

      // Delete order
      const [result] = await connection.execute('DELETE FROM orders WHERE id = ?', [id]);

      await connection.commit();
      return result.affectedRows > 0;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = Order;
