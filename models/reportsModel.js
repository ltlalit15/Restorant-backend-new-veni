const db = require('../config/database');

class Reports {
  static async getReports(reportBy, reportType, startDate, endDate) {
    let dateCondition = '';

    // 📌 Date Filters (on orders.created_at)
    switch (reportBy) {
      case 'Daily':
        dateCondition = `DATE(o.created_at) = CURDATE()`;
        break;
      case 'Last 7 days':
        dateCondition = `o.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`;
        break;
      case 'Last 30 days':
        dateCondition = `o.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
        break;
      case 'Last year':
        dateCondition = `YEAR(o.created_at) = YEAR(CURDATE() - INTERVAL 1 YEAR)`;
        break;
      case 'Year until end':
        dateCondition = `YEAR(o.created_at) = YEAR(CURDATE())`;
        break;
      case 'Custom range':
        if (!startDate || !endDate) throw new Error('Start and end date required for custom range');
        dateCondition = `o.created_at BETWEEN '${startDate}' AND '${endDate}'`;
        break;
      default:
        dateCondition = `DATE(o.created_at) = CURDATE()`;
    }

    let sql = '';

    // 📊 Report Queries
    switch (reportType) {
      // 1️⃣ X Report (Summary)
      case 'X Report (Summary)':
        sql = `
          SELECT 
            COUNT(DISTINCT o.id) AS total_orders,
            SUM(o.total_amount) AS total_sales,
            COUNT(DISTINCT o.session_id) AS total_sessions,
            SUM(oi.quantity) AS total_items_sold
          FROM orders o
          LEFT JOIN order_items oi ON oi.order_id = o.id
          WHERE ${dateCondition}
        `;
        break;

      // 2️⃣ Item Sales Report
      case 'Item Sales Report':
        sql = `
          SELECT 
            i.item_name AS item_name,
            SUM(oi.quantity) AS total_sold,
            SUM(oi.unit_price * oi.quantity) AS total_revenue
          FROM order_items oi
          JOIN item_new i ON oi.menu_item_id = i.id
          JOIN orders o ON oi.order_id = o.id
          WHERE ${dateCondition}
          GROUP BY i.id, i.item_name
          ORDER BY total_revenue DESC
        `;
        break;

      // 3️⃣ Table Revenue Report
      case 'Table Revenue Report':
        sql = `
          SELECT 
            t.table_name,
            SUM(o.total_amount) AS total_revenue,
            COUNT(o.id) AS orders_count
          FROM orders o
          JOIN tables t ON o.table_id = t.id
          WHERE ${dateCondition}
          GROUP BY t.id, t.table_name
          ORDER BY total_revenue DESC
        `;
        break;

      // 4️⃣ Category Sales Report
      case 'Category Sales Report':
        sql = `
          SELECT 
            c.category_name AS category_name,
            SUM(oi.quantity) AS total_quantity,
            SUM(oi.unit_price * oi.quantity) AS total_sales
          FROM order_items oi
          JOIN item_new i ON oi.menu_item_id = i.id
          JOIN category c ON i.category_id = c.id
          JOIN orders o ON oi.order_id = o.id
          WHERE ${dateCondition}
          GROUP BY c.id, c.category_name
          ORDER BY total_sales DESC
        `;
        break;

      // 5️⃣ Detailed Transactions
      case 'Detailed Transactions':
        sql = `
          SELECT 
            o.id AS order_id,
            o.session_id,
            u.name AS staff_name,
            o.customer_name,
            o.total_amount,
            o.created_at,
            i.item_name,
            oi.quantity,
            oi.total_price
          FROM orders o
          JOIN users u ON o.user_id = u.id
          JOIN order_items oi ON oi.order_id = o.id
          JOIN item_new i ON oi.menu_item_id = i.id
          WHERE ${dateCondition}
          ORDER BY o.created_at DESC
        `;
        break;

      // 6️⃣ Staff Summary Report
      case 'Staff Summary Report':
        sql = `
          SELECT 
            u.name AS staff_name,
            u.role,
            COUNT(DISTINCT o.id) AS total_orders,
            SUM(o.total_amount) AS revenue_generated
          FROM users u
          LEFT JOIN orders o ON u.id = o.user_id
          WHERE ${dateCondition}
          GROUP BY u.id, u.name, u.role
          ORDER BY revenue_generated DESC
        `;
        break;

      // 7️⃣ Financial Summary
      case 'Financial Summary':
        sql = `
          SELECT 
            SUM(o.total_amount) AS gross_sales,
            SUM(o.tax_amount) AS total_tax,
            SUM(o.discount_amount) AS total_discount,
            (SUM(o.total_amount) - SUM(o.discount_amount)) AS net_sales
          FROM orders o
          WHERE ${dateCondition}
        `;
        break;

      default:
        throw new Error('Invalid report type');
    }

    const [results] = await db.execute(sql);
    return results;
}




static async getTableOrdersByDate() {
  const sql = `
 SELECT 
    DATE(o.created_at) AS order_date,
    t.table_name,
    t.capacity AS people,

    COUNT(DISTINCT o.id) AS total_orders,
    COALESCE(SUM(oi.quantity), 0) AS total_items,
    COALESCE(SUM(oi.total_price), 0) AS total_revenue,

    CAST(
      COALESCE(
        JSON_ARRAYAGG(
          CASE 
            WHEN o.id IS NOT NULL THEN
              JSON_OBJECT(
                'orderId', o.id,
                'customerNo', CONCAT('C-', LPAD(u.id, 4, '0')),
                'customerName', COALESCE(u.name, s.customer_name, o.customer_name, ''),
                'phone', COALESCE(u.phone, s.customer_phone, ''),
                'sessionId', s.id,
                'sessionStatus', s.status,
                'items', (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'itemName', COALESCE(mi.item_name, 'Item name not available'),
                            'quantity', oi2.quantity,
                            'price', oi2.total_price
                        )
                    )
                    FROM order_items oi2
                    LEFT JOIN item_new mi ON oi2.menu_item_id = mi.id
                    WHERE oi2.order_id = o.id
                ),
                'orderTotal', (
                    SELECT SUM(oi3.total_price)
                    FROM order_items oi3
                    WHERE oi3.order_id = o.id
                )
              )
          END
        ),
        JSON_ARRAY()
      ) AS CHAR
    ) AS orders
FROM tables t
LEFT JOIN sessions s ON s.table_id = t.id
LEFT JOIN orders o ON o.session_id = s.id OR o.table_id = t.id   -- ✅ orders linked by session OR direct table_id
LEFT JOIN users u ON s.user_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY order_date, t.table_name, t.capacity
ORDER BY order_date DESC, t.table_name;





  `;

  const [results] = await db.execute(sql);
  return results;
}







  
}

module.exports = Reports;
