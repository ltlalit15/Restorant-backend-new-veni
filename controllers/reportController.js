const db = require('../config/database');
const moment = require('moment');

// Get dashboard overview
const getDashboardOverview = async (req, res) => {
  try {
    // Overview: total revenue, sessions, orders, avg session duration
    const [overviewRows] = await db.execute(`
      SELECT 
        (SELECT COALESCE(SUM(total_amount), 0) FROM orders) AS total_revenue,
        (SELECT COUNT(*) FROM sessions) AS total_sessions,
        (SELECT COUNT(*) FROM orders) AS total_orders,
        (SELECT AVG(duration_minutes) FROM sessions) AS avg_session_duration
    `);

    // Table stats
    const [tableStats] = await db.execute(`
      SELECT 
        COUNT(*) AS total_tables,
        SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) AS available_tables,
        SUM(CASE WHEN status = 'occupied' THEN 1 ELSE 0 END) AS occupied_tables,
        SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) AS reserved_tables
      FROM tables
    `);

    // Revenue by category
const [categoryRevenue] = await db.execute(`
  SELECT 
    c.category_name AS category,
    SUM(oi.total_price) AS revenue
  FROM order_items oi
  JOIN item_new i ON oi.menu_item_id = i.id
  JOIN category c ON i.category_id = c.id
  JOIN orders o ON oi.order_id = o.id
  GROUP BY c.id, c.category_name
  ORDER BY revenue DESC
`);


    // Hourly revenue from orders
    const [hourlyRevenue] = await db.execute(`
      SELECT 
        HOUR(o.created_at) AS hour,
        SUM(o.total_amount) AS revenue
      FROM orders o
      GROUP BY HOUR(o.created_at)
      ORDER BY hour
    `);

    res.json({
      success: true,
      data: {
        overview: overviewRows[0],
        tables: tableStats[0],
        categoryRevenue,
        hourlyRevenue
      }
    });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard overview',
      error: error.message
    });
  }
};



// Get revenue report
const getRevenueReport = async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;
    
    let dateFormat;
    switch (group_by) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00:00';
        break;
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-%u';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const [revenueData] = await db.execute(`
      SELECT 
        DATE_FORMAT(p.created_at, ?) as period,
        SUM(p.amount) as total_revenue,
        COUNT(DISTINCT p.session_id) as session_count,
        COUNT(DISTINCT p.order_id) as order_count,
        AVG(p.amount) as avg_payment
      FROM payments p
      WHERE p.payment_status = 'completed'
        AND DATE(p.created_at) BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(p.created_at, ?)
      ORDER BY period
    `, [dateFormat, start_date, end_date, dateFormat]);

    // Get payment method breakdown
    const [paymentMethods] = await db.execute(`
      SELECT 
        payment_method,
        SUM(amount) as revenue,
        COUNT(*) as transaction_count
      FROM payments
      WHERE payment_status = 'completed'
        AND DATE(created_at) BETWEEN ? AND ?
      GROUP BY payment_method
    `, [start_date, end_date]);

    res.json({
      success: true,
      data: {
        revenueData,
        paymentMethods,
        period: { start_date, end_date, group_by }
      }
    });
  } catch (error) {
    console.error('Get revenue report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching revenue report',
      error: error.message
    });
  }
};

// Get table utilization report
const getTableUtilizationReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const [utilizationData] = await db.execute(`
      SELECT 
        t.table_number,
        t.table_name,
        t.table_type,
        COUNT(s.id) as session_count,
        SUM(s.duration_minutes) as total_minutes,
        AVG(s.duration_minutes) as avg_session_duration,
        SUM(s.session_cost) as total_revenue,
        AVG(s.session_cost) as avg_revenue_per_session
      FROM tables t
      LEFT JOIN sessions s ON t.id = s.table_id 
        AND DATE(s.start_time) BETWEEN ? AND ?
        AND s.status = 'completed'
      GROUP BY t.id, t.table_number, t.table_name, t.table_type
      ORDER BY total_revenue DESC
    `, [start_date, end_date]);

    // Calculate utilization percentage (assuming 12 hours operation per day)
    const daysDiff = moment(end_date).diff(moment(start_date), 'days') + 1;
    const totalAvailableMinutes = daysDiff * 12 * 60; // 12 hours per day

    const utilizationWithPercentage = utilizationData.map(table => ({
      ...table,
      utilization_percentage: table.total_minutes ? 
        Math.round((table.total_minutes / totalAvailableMinutes) * 100 * 100) / 100 : 0
    }));

    res.json({
      success: true,
      data: {
        utilization: utilizationWithPercentage,
        period: { start_date, end_date, days: daysDiff }
      }
    });
  } catch (error) {
    console.error('Get table utilization report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching table utilization report',
      error: error.message
    });
  }
};

// Get menu performance report
const getMenuPerformanceReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    const [menuPerformance] = await db.execute(`
      SELECT 
        mi.name as item_name,
        mc.name as category_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total_price) as total_revenue,
        AVG(oi.unit_price) as avg_price,
        COUNT(DISTINCT oi.order_id) as order_count
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN menu_categories mc ON mi.category_id = mc.id
      JOIN orders o ON oi.order_id = o.id
      WHERE DATE(o.created_at) BETWEEN ? AND ?
      GROUP BY mi.id, mi.name, mc.name
      ORDER BY total_revenue DESC
    `, [start_date, end_date]);

    // Get category performance
    const [categoryPerformance] = await db.execute(`
      SELECT 
        mc.name as category_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.total_price) as total_revenue,
        COUNT(DISTINCT mi.id) as item_count,
        COUNT(DISTINCT oi.order_id) as order_count
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN menu_categories mc ON mi.category_id = mc.id
      JOIN orders o ON oi.order_id = o.id
      WHERE DATE(o.created_at) BETWEEN ? AND ?
      GROUP BY mc.id, mc.name
      ORDER BY total_revenue DESC
    `, [start_date, end_date]);

    res.json({
      success: true,
      data: {
        menuItems: menuPerformance,
        categories: categoryPerformance,
        period: { start_date, end_date }
      }
    });
  } catch (error) {
    console.error('Get menu performance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching menu performance report',
      error: error.message
    });
  }
};

// Get customer analytics
const getCustomerAnalytics = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Get customer session data
    const [customerData] = await db.execute(`
      SELECT 
        COALESCE(u.name, s.customer_name, 'Walk-in') as customer_name,
        COUNT(s.id) as session_count,
        SUM(s.duration_minutes) as total_minutes,
        SUM(s.session_cost) as total_spent,
        AVG(s.duration_minutes) as avg_session_duration,
        AVG(s.session_cost) as avg_spending
      FROM sessions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE DATE(s.start_time) BETWEEN ? AND ?
        AND s.status = 'completed'
      GROUP BY COALESCE(u.id, s.customer_name)
      HAVING session_count > 0
      ORDER BY total_spent DESC
      LIMIT 50
    `, [start_date, end_date]);

    // Get new vs returning customers
    const [customerTypes] = await db.execute(`
      SELECT 
        CASE 
          WHEN customer_sessions.session_count = 1 THEN 'New'
          ELSE 'Returning'
        END as customer_type,
        COUNT(*) as count,
        SUM(customer_sessions.total_spent) as revenue
      FROM (
        SELECT 
          COALESCE(u.id, s.customer_name) as customer_id,
          COUNT(s.id) as session_count,
          SUM(s.session_cost) as total_spent
        FROM sessions s
        LEFT JOIN users u ON s.user_id = u.id
        WHERE DATE(s.start_time) BETWEEN ? AND ?
          AND s.status = 'completed'
        GROUP BY COALESCE(u.id, s.customer_name)
      ) as customer_sessions
      GROUP BY customer_type
    `, [start_date, end_date]);

    res.json({
      success: true,
      data: {
        topCustomers: customerData,
        customerTypes,
        period: { start_date, end_date }
      }
    });
  } catch (error) {
    console.error('Get customer analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer analytics',
      error: error.message
    });
  }
};

// Get hourly performance
const getHourlyPerformance = async (req, res) => {
  try {
    const date = req.query.date || moment().format('YYYY-MM-DD');
    
    const [hourlyData] = await db.execute(`
      SELECT 
        HOUR(p.created_at) as hour,
        COUNT(DISTINCT s.id) as sessions,
        COUNT(DISTINCT o.id) as orders,
        SUM(p.amount) as revenue,
        COUNT(p.id) as transactions
      FROM payments p
      LEFT JOIN sessions s ON p.session_id = s.id
      LEFT JOIN orders o ON p.order_id = o.id
      WHERE DATE(p.created_at) = ?
        AND p.payment_status = 'completed'
      GROUP BY HOUR(p.created_at)
      ORDER BY hour
    `, [date]);

    // Fill in missing hours with zero values
    const completeHourlyData = [];
    for (let hour = 0; hour < 24; hour++) {
      const existingData = hourlyData.find(d => d.hour === hour);
      completeHourlyData.push({
        hour,
        sessions: existingData ? existingData.sessions : 0,
        orders: existingData ? existingData.orders : 0,
        revenue: existingData ? parseFloat(existingData.revenue) : 0,
        transactions: existingData ? existingData.transactions : 0
      });
    }

    res.json({
      success: true,
      data: {
        hourlyPerformance: completeHourlyData,
        date
      }
    });
  } catch (error) {
    console.error('Get hourly performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching hourly performance',
      error: error.message
    });
  }
};

// Export report data
const exportReport = async (req, res) => {
  try {
    const { reportType } = req.params;
    const { start_date, end_date, format = 'json' } = req.query;
    
    let data = {};
    
    switch (reportType) {
      case 'revenue':
        const [revenueData] = await db.execute(`
          SELECT 
            DATE(p.created_at) as date,
            SUM(p.amount) as total_revenue,
            COUNT(*) as transaction_count,
            p.payment_method
          FROM payments p
          WHERE p.payment_status = 'completed'
            AND DATE(p.created_at) BETWEEN ? AND ?
          GROUP BY DATE(p.created_at), p.payment_method
          ORDER BY date, payment_method
        `, [start_date, end_date]);
        data = { revenue: revenueData };
        break;
        
      case 'sessions':
        const [sessionData] = await db.execute(`
          SELECT 
            s.session_id,
            t.table_number,
            t.table_type,
            s.customer_name,
            s.start_time,
            s.end_time,
            s.duration_minutes,
            s.session_cost,
            s.status
          FROM sessions s
          JOIN tables t ON s.table_id = t.id
          WHERE DATE(s.start_time) BETWEEN ? AND ?
          ORDER BY s.start_time
        `, [start_date, end_date]);
        data = { sessions: sessionData };
        break;
        
      case 'orders':
        const [orderData] = await db.execute(`
          SELECT 
            o.order_number,
            t.table_number,
            o.customer_name,
            o.subtotal,
            o.tax_amount,
            o.total_amount,
            o.status,
            o.created_at,
            GROUP_CONCAT(CONCAT(oi.quantity, 'x ', mi.name) SEPARATOR ', ') as items
          FROM orders o
          JOIN tables t ON o.table_id = t.id
          LEFT JOIN order_items oi ON o.id = oi.order_id
          LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
          WHERE DATE(o.created_at) BETWEEN ? AND ?
          GROUP BY o.id
          ORDER BY o.created_at
        `, [start_date, end_date]);
        data = { orders: orderData };
        break;
        
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid report type'
        });
    }
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvData = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportType}_${start_date}_${end_date}.csv"`);
      return res.send(csvData);
    }
    
    res.json({
      success: true,
      data,
      meta: {
        reportType,
        period: { start_date, end_date },
        exportedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting report',
      error: error.message
    });
  }
};

// Helper function to convert data to CSV
const convertToCSV = (data) => {
  const firstKey = Object.keys(data)[0];
  const rows = data[firstKey];
  
  if (!rows || rows.length === 0) {
    return '';
  }
  
  const headers = Object.keys(rows[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = rows.map(row => 
    headers.map(header => {
      const value = row[header];
      // Escape commas and quotes in CSV
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
};

module.exports = {
  getDashboardOverview,
  getRevenueReport,
  getTableUtilizationReport,
  getMenuPerformanceReport,
  getCustomerAnalytics,
  getHourlyPerformance,
  exportReport
};
