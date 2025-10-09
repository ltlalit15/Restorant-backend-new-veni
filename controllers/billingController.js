const db = require('../config/database');
const moment = require('moment');

// Generate payment ID
const generatePaymentId = () => {
  return `PAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
};

// Get session bill
const getSessionBill = async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get session details
    const [sessions] = await db.execute(
      `
      SELECT s.*, 
             t.table_number, t.table_name, t.table_type, 
             u.name as user_name,
             TIMESTAMPDIFF(MINUTE, s.start_time, COALESCE(s.end_time, NOW())) as current_duration_minutes
      FROM sessions s
      JOIN tables t ON s.table_id = t.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
      `,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const session = sessions[0];

    // ✅ Safe user access check
    if (req.user && req.user.role === "user" && session.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Get orders for this session
    const [orders] = await db.execute(
      `
      SELECT o.*,
             GROUP_CONCAT(CONCAT(oi.quantity, 'x ', mi.name, ' @ $', oi.unit_price) SEPARATOR ', ') as items_summary
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.session_id = ?
      GROUP BY o.id
      ORDER BY o.created_at
      `,
      [sessionId]
    );

    // Calculate current session cost if still active
    let currentSessionCost = session.session_cost;
    if (session.status === "active") {
      const durationHours = session.current_duration_minutes / 60;
      currentSessionCost = Math.round(durationHours * session.hourly_rate * 100) / 100;
    }

    // Calculate totals
    const orderSubtotal = orders.reduce((sum, order) => sum + parseFloat(order.subtotal || 0), 0);
    const orderTax = orders.reduce((sum, order) => sum + parseFloat(order.tax_amount || 0), 0);
    const orderDiscount = orders.reduce((sum, order) => sum + parseFloat(order.discount_amount || 0), 0);

    const sessionSubtotal = currentSessionCost;
    const totalSubtotal = sessionSubtotal + orderSubtotal;
    const totalTax = orderTax + sessionSubtotal * 0.085; // 8.5% tax on session
    const totalDiscount = orderDiscount;
    const grandTotal = totalSubtotal + totalTax - totalDiscount;

    // Check if already paid
    const [payments] = await db.execute(
      "SELECT * FROM payments WHERE session_id = ? AND payment_status = 'completed'",
      [sessionId]
    );

    const bill = {
      session: {
        ...session,
        current_session_cost: currentSessionCost,
        duration_display: `${Math.floor(session.current_duration_minutes / 60)}h ${session.current_duration_minutes % 60}m`,
      },
      orders,
      totals: {
        session_cost: sessionSubtotal,
        order_subtotal: orderSubtotal,
        subtotal: totalSubtotal,
        tax_amount: totalTax,
        discount_amount: totalDiscount,
        grand_total: grandTotal,
      },
      payment_status: payments.length > 0 ? "paid" : "unpaid",
      payments,
    };

    res.json({ success: true, data: { bill } });
  } catch (error) {
    console.error("Get session bill error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching session bill",
      error: error.message,
    });
  }
};


// Process payment
const processPayment = async (req, res) => {
  try {
    const { session_id, order_id, amount, payment_method, transaction_id } = req.body;

    if (!session_id && !order_id) {
      return res.status(400).json({
        success: false,
        message: 'Either session_id or order_id is required'
      });
    }

    // Validate payment method
    const validMethods = ['cash', 'card', 'upi', 'wallet'];
    if (!validMethods.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    // Generate payment ID
    const payment_id = generatePaymentId();

    // Create payment record
    const [result] = await db.execute(
      `INSERT INTO payments (payment_id, session_id, order_id, amount, payment_method, 
       payment_status, transaction_id) VALUES (?, ?, ?, ?, ?, 'completed', ?)`,
      [payment_id,  session_id || null,
    order_id || null, amount, payment_method, transaction_id || null]
    );

    // If this is a session payment, end the session
    if (session_id) {
      const [sessions] = await db.execute(
        'SELECT * FROM sessions WHERE id = ? AND status IN ("active", "paused")',
        [session_id]
      );

      if (sessions.length > 0) {
        const session = sessions[0];
        const endTime = new Date();
        const durationMinutes = Math.ceil((endTime - new Date(session.start_time)) / (1000 * 60));
        const sessionCost = Math.round((durationMinutes / 60) * session.hourly_rate * 100) / 100;

        // Update session
        await db.execute(
          `UPDATE sessions SET end_time = ?, duration_minutes = ?, session_cost = ?, 
           status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [endTime, durationMinutes, sessionCost, session_id]
        );

        // Update table status to available
        await db.execute(
          'UPDATE tables SET status = "available" WHERE id = ?',
          [session.table_id]
        );

        // Turn off smart plug if connected
        const [tables] = await db.execute(
          'SELECT plug_id FROM tables WHERE id = ?',
          [session.table_id]
        );

        if (tables.length > 0 && tables[0].plug_id) {
          try {
            const io = req.app.get('io');
            io.emit('plug_auto_control', { 
              plug_id: tables[0].plug_id,
              action: 'off',
              reason: 'payment_completed'
            });
          } catch (plugError) {
            console.error('Failed to turn off plug:', plugError);
          }
        }
      }
    }

    // Get created payment
    const [payment] = await db.execute(
      'SELECT * FROM payments WHERE id = ?',
      [result.insertId]
    );

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.emit('payment_processed', payment[0]);

    res.status(201).json({
      success: true,
      message: 'Payment processed successfully',
      data: { payment: payment[0] }
    });
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing payment',
      error: error.message
    });
  }
};

// Get payment history
const getPaymentHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    const { payment_method, payment_status, date } = req.query;
    
    let query = `
      SELECT p.*, s.session_id, s.customer_name, t.table_number, t.table_name,
             o.order_number
      FROM payments p
      LEFT JOIN sessions s ON p.session_id = s.id
      LEFT JOIN tables t ON s.table_id = t.id
      LEFT JOIN orders o ON p.order_id = o.id
    `;
    
    let params = [];
    let conditions = [];
    
    if (payment_method) {
      conditions.push('p.payment_method = ?');
      params.push(payment_method);
    }
    
    if (payment_status) {
      conditions.push('p.payment_status = ?');
      params.push(payment_status);
    }
    
    if (date) {
      conditions.push('DATE(p.created_at) = ?');
      params.push(date);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    // ✅ Use template literals for LIMIT/OFFSET (mysql2 doesn't support placeholders here)
    query += ` ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const [payments] = await db.execute(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM payments p';
    let countParams = [];
    
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
      countParams = params; // ✅ no need to slice anymore
    }
    
    const [countResult] = await db.execute(countQuery, countParams);

    res.json({
      success: true,
      data: {
        payments,
        total: countResult[0].total,
        page,
        limit,
        totalPages: Math.ceil(countResult[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment history',
      error: error.message
    });
  }
};


// Get user's payment history
const getUserPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const [payments] = await db.execute(
      `SELECT p.*, s.session_id, t.table_number, t.table_name, o.order_number
       FROM payments p
       LEFT JOIN sessions s ON p.session_id = s.id
       LEFT JOIN tables t ON s.table_id = t.id
       LEFT JOIN orders o ON p.order_id = o.id
       WHERE s.user_id = ? OR o.user_id = ?
       ORDER BY p.created_at DESC`,
      [userId, userId]
    );

    res.json({
      success: true,
      data: { payments }
    });
  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user payments',
      error: error.message
    });
  }
};

// Get payment by ID
const getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [payments] = await db.execute(
      `SELECT p.*, s.session_id, s.customer_name, t.table_number, t.table_name,
              o.order_number, u.name as user_name
       FROM payments p
       LEFT JOIN sessions s ON p.session_id = s.id
       LEFT JOIN tables t ON s.table_id = t.id
       LEFT JOIN orders o ON p.order_id = o.id
       LEFT JOIN users u ON s.user_id = u.id OR o.user_id = u.id
       WHERE p.id = ?`,
      [id]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const payment = payments[0];

    // Check if user can access this payment
    if (req.user.role === 'user') {
      const [userCheck] = await db.execute(
        `SELECT 1 FROM payments p
         LEFT JOIN sessions s ON p.session_id = s.id
         LEFT JOIN orders o ON p.order_id = o.id
         WHERE p.id = ? AND (s.user_id = ? OR o.user_id = ?)`,
        [id, req.user.id, req.user.id]
      );

      if (userCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    res.json({
      success: true,
      data: { payment }
    });
  } catch (error) {
    console.error('Get payment by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment',
      error: error.message
    });
  }
};

// Refund payment
const refundPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { refund_reason } = req.body;

    // Get payment details
    const [payments] = await db.execute(
      'SELECT * FROM payments WHERE id = ? AND payment_status = "completed"',
      [id]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Completed payment not found'
      });
    }

    const payment = payments[0];

    // Update payment status to refunded
    const [result] = await db.execute(
      'UPDATE payments SET payment_status = "refunded", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to process refund'
      });
    }

    // If this was a session payment, you might want to handle session status
    // For now, we'll just log the refund

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.emit('payment_refunded', { 
      paymentId: id,
      amount: payment.amount,
      reason: refund_reason
    });

    res.json({
      success: true,
      message: 'Payment refunded successfully',
      data: { 
        paymentId: id,
        refundAmount: payment.amount
      }
    });
  } catch (error) {
    console.error('Refund payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing refund',
      error: error.message
    });
  }
};

// Get billing statistics
const getBillingStats = async (req, res) => {
  try {
    const date = req.query.date || moment().format('YYYY-MM-DD');
    
    const [stats] = await db.execute(`
      SELECT 
        COUNT(*) as total_payments,
        SUM(amount) as total_revenue,
        AVG(amount) as average_payment,
        SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END) as cash_revenue,
        SUM(CASE WHEN payment_method = 'card' THEN amount ELSE 0 END) as card_revenue,
        SUM(CASE WHEN payment_method = 'upi' THEN amount ELSE 0 END) as upi_revenue,
        SUM(CASE WHEN payment_method = 'wallet' THEN amount ELSE 0 END) as wallet_revenue,
        SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) as completed_payments,
        SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pending_payments,
        SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) as failed_payments,
        SUM(CASE WHEN payment_status = 'refunded' THEN 1 ELSE 0 END) as refunded_payments
      FROM payments
      WHERE DATE(created_at) = ?
    `, [date]);

    res.json({
      success: true,
      data: { 
        stats: stats[0],
        date
      }
    });
  } catch (error) {
    console.error('Get billing stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching billing statistics',
      error: error.message
    });
  }
};

module.exports = {
  getSessionBill,
  processPayment,
  getPaymentHistory,
  getUserPayments,
  getPaymentById,
  refundPayment,
  getBillingStats
};
