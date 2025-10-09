const Order = require('../models/Order');

// Get all orders
// const getAllOrders = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const offset = (page - 1) * limit;

//     const filters = {
//       status: req.query.status || null,
//       table_id: req.query.table_id || null,
//       date: req.query.date || null
//     };

//     const result = await Order.getAll(page, limit, filters, offset);

//     res.json({
//       success: true,
//       data: result
//     });
//   } catch (error) {
//     console.error('Get all orders error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching orders',
//       error: error.message
//     });
//   }
// };


const getAllOrders = async (req, res) => {
  try {
    const result = await Order.getAll(); // Fetch all orders without filters
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching orders', 
      error: error.message 
    });
  }
};



const getPendingOrders = async (req, res) => {
  try {
    const orders = await Order.getPendingOrdersGrouped();

    res.json({
      success: true,
      data: {
        printers: orders   // yahan pe group kiya hua data aa raha hai
      }
    });
  } catch (error) {
    console.error('Get pending orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending orders',
      error: error.message
    });
  }
};


// Get order by ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      data: { order }
    });
  } catch (error) {
    console.error('Get order by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message
    });
  }
};

// Create new order
const createOrder = async (req, res) => {
  try {
    const orderData = req.body;
    
    // Add user ID if authenticated
    if (req.user) {
      orderData.user_id = req.user.id;
    }

    const orderId = await Order.create(orderData);
    const order = await Order.findById(orderId);

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.emit('new_order', order);
    io.to(`table_${orderData.table_id}`).emit('order_created', order);

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: { order }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating order',
      error: error.message
    });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'cancelled', 'paid'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const updated = await Order.updateStatus(id, status);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Get updated order
    const order = await Order.findById(id);

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.emit('order_status_updated', { orderId: id, status });
    if (order) {
      io.to(`table_${order.table_id}`).emit('order_updated', order);
    }

    res.json({
      success: true,
      message: 'Order status updated successfully',
      data: { orderId: id, status }
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order status',
      error: error.message
    });
  }
};

// Update order item status
const updateOrderItemStatus = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'preparing', 'ready', 'served'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const updated = await Order.updateItemStatus(itemId, status);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found'
      });
    }

    // Emit socket event for real-time updates
    const io = req.app.get('io');
    io.emit('order_item_status_updated', { itemId, status });

    res.json({
      success: true,
      message: 'Order item status updated successfully',
      data: { itemId, status }
    });
  } catch (error) {
    console.error('Update order item status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order item status',
      error: error.message
    });
  }
};

// Get orders by table
const getOrdersByTable = async (req, res) => {
  try {
    const { tableId } = req.params;
    const orders = await Order.getByTable(tableId);

    res.json({
      success: true,
      data: { orders }
    });
  } catch (error) {
    console.error('Get orders by table error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders by table',
      error: error.message
    });
  }
};

// Get orders by session
// const getOrdersBySession = async (req, res) => {
//   try {
//     const { sessionId } = req.params;
//     const orders = await Order.getBySession(sessionId);



//     res.json({
//       success: true,
//       data: { orders }
//     });
//   } catch (error) {
//     console.error('Get orders by session error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error fetching orders by session',
//       error: error.message
//     });
//   }
// };

const getOrdersBySession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    

    // Validate sessionId
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Fetch all orders for the given session
    const orders = await Order.getBySession(sessionId);
console.log("orders : ", orders);
    // If no orders found
    if (!orders || orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found for this session",
        data: { orders: [], total_amount: 0 },
      });
    }

    // ✅ Calculate total_amount safely
    const total_amount = orders.reduce(
      (sum, order) => sum + parseFloat(order.total_amount || 0),
      0
    );

    // ✅ Send optimized response
    res.status(200).json({
      success: true,
      data: {
        orders,
        total_amount: total_amount.toFixed(2), // keep consistent 2-decimal format
      },
    });

  } catch (error) {
    console.error("Get orders by session error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching orders by session",
      error: error.message,
    });
  }
};

// Get order statistics
const getOrderStats = async (req, res) => {
  try {
    const date = req.query.date;
    const stats = await Order.getStats(date);

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order statistics',
      error: error.message
    });
  }
};

// Delete order
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Order.delete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order deleted successfully'
    });
  } catch (error) {
    console.error('Delete order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting order',
      error: error.message
    });
  }
};

module.exports = {
  getAllOrders,
  getPendingOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  updateOrderItemStatus,
  getOrdersByTable,
  getOrdersBySession,
  getOrderStats,
  deleteOrder
};
