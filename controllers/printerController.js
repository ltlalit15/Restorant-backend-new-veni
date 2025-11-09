const db = require('../config/database');
const net = require("net");
const os = require('os');
// const axios = require('axios'); // Uncomment when you have actual printer API endpoints

// Get all printers
const getAllPrinters = async (req, res) => {
  try {
    const [printers] = await db.execute(
      'SELECT * FROM printers ORDER BY name'
    );

    res.json({
      success: true,
      data: { printers }
    });
  } catch (error) {
    console.error('Get all printers error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching printers',
      error: error.message
    });
  }
};

// Get printer by ID
const getPrinterById = async (req, res) => {
  try {
    const { id } = req.params;
    const [printers] = await db.execute(
      'SELECT * FROM printers WHERE id = ?',
      [id]
    );

    if (printers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Printer not found'
      });
    }

    res.json({
      success: true,
      data: { printer: printers[0] }
    });
  } catch (error) {
    console.error('Get printer by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching printer',
      error: error.message
    });
  }
};

// Create new printer
const createPrinter = async (req, res) => {
  try {
    const { printer_id, name, type, ip_address, port } = req.body;

    // Check if printer_id already exists
    const [existing] = await db.execute(
      'SELECT id FROM printers WHERE printer_id = ?',
      [printer_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Printer ID already exists'
      });
    }

    const [result] = await db.execute(
      'INSERT INTO printers (printer_id, name, type, ip_address, port) VALUES (?, ?, ?, ?, ?)',
      [printer_id, name, type, ip_address, port || 9100]
    );

    const [printer] = await db.execute(
      'SELECT * FROM printers WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Printer created successfully',
      data: { printer: printer[0] }
    });
  } catch (error) {
    console.error('Create printer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating printer',
      error: error.message
    });
  }
};

// Update printer
const updatePrinter = async (req, res) => {
  try {
    const { id } = req.params;
    const { printer_id, name, type, ip_address, port, status } = req.body;

    // Check if printer exists
    const [existing] = await db.execute(
      'SELECT * FROM printers WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Printer not found'
      });
    }

    // Check if printer_id is already taken by another printer
    if (printer_id !== existing[0].printer_id) {
      const [duplicate] = await db.execute(
        'SELECT id FROM printers WHERE printer_id = ? AND id != ?',
        [printer_id, id]
      );

      if (duplicate.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Printer ID already exists'
        });
      }
    }

    const [result] = await db.execute(
      `UPDATE printers SET printer_id = ?, name = ?, type = ?, ip_address = ?, 
       port = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [printer_id, name, type, ip_address, port, status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update printer'
      });
    }

    const [printer] = await db.execute(
      'SELECT * FROM printers WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Printer updated successfully',
      data: { printer: printer[0] }
    });
  } catch (error) {
    console.error('Update printer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating printer',
      error: error.message
    });
  }
};


// Test printer
const testPrinter = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[INFO] Fetching printer with ID: ${id}`);

    const [printers] = await db.execute(
      "SELECT * FROM printers WHERE id = ?",
      [id]
    );

    if (printers.length === 0) {
      console.error(`[ERROR] Printer not found`);
      return res.status(404).json({
        success: false,
        message: "Printer not found",
      });
    }

    const printer = printers[0];
    console.log(`[INFO] Printer fetched: IP=${printer.ip_address}, Port=${printer.port || 9100}`);

    console.log(`[INFO] Sending test print to printer...`);
    await sendToPrinter(printer.ip_address, printer.port || 9100, "=== TEST PRINT ===\nHello World!\n================");

    console.log(`[SUCCESS] Test print sent successfully`);

    // Update DB status to online
    await db.execute(
      'UPDATE printers SET status = "online", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    return res.json({
      success: true,
      message: "Test print sent successfully",
      data: {
        printer_id: printer.printer_id,
        status: "Test completed",
      },
    });

  } catch (error) {
    console.error(`[ERROR] Printer test failed: ${error.message}`);

    // Update DB status to error
    if (req.params.id) {
      await db.execute(
        'UPDATE printers SET status = "error", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [req.params.id]
      );
    }

    return res.status(400).json({
      success: false,
      message: "Printer test failed",
      error: error.message,
    });
  }
};

// Fully updated sendToPrinter function
function sendToPrinter(ip, port, data) {
  return new Promise((resolve, reject) => {
    const tryIPs = [ip];
    console.log(`[INFO] Initial IP to try: ${ip}`);

    // Add host LAN IPs if IP is 127.0.0.1
    if (ip === '127.0.0.1') {
      const interfaces = os.networkInterfaces();
      for (const iface of Object.values(interfaces)) {
        for (const addr of iface) {
          if (addr.family === 'IPv4' && !addr.internal) {
            tryIPs.push(addr.address);
            console.log(`[INFO] Added host LAN IP for retry: ${addr.address}`);
          }
        }
      }
    }

    let connected = false;

    const tryConnect = (ips) => {
      if (ips.length === 0) {
        console.error(`[ERROR] Could not connect to printer on any IP`);
        return reject(new Error('Could not connect to printer on any IP'));
      }

      const currentIP = ips.shift();
      console.log(`[INFO] Attempting to connect to printer at ${currentIP}:${port}`);

      let retries = 3; // Number of retries per IP

      const attempt = () => {
        const client = new net.Socket();
        client.setTimeout(5000); // 5 sec timeout

        client.connect(port, currentIP, () => {
          console.log(`✅ Connected to printer at ${currentIP}:${port}`);
          client.write(data, 'utf8', () => {
            console.log(`[INFO] Data written to printer, closing connection`);
            client.end();
            connected = true;
            resolve(true);
          });
        });

        client.on('timeout', () => {
          console.warn(`[WARN] Connection timeout at ${currentIP}:${port}`);
          client.destroy();
          retries--;
          if (!connected && retries > 0) {
            console.log(`[INFO] Retrying ${currentIP}:${port}, attempts left: ${retries}`);
            attempt();
          } else if (!connected) {
            tryConnect(ips); // Try next IP
          }
        });

        client.on('error', (err) => {
          console.warn(`[WARN] Connection error at ${currentIP}:${port} - ${err.message}`);
          client.destroy();
          retries--;
          if (!connected && retries > 0) {
            console.log(`[INFO] Retrying ${currentIP}:${port}, attempts left: ${retries}`);
            attempt();
          } else if (!connected) {
            tryConnect(ips); // Try next IP
          }
        });
      };

      attempt();
    };

    tryConnect(tryIPs);
  });
}


const printOrder = async (req, res) => {
  try {
    const { order_id } = req.body;

    const [orders] = await db.execute(
      `
      SELECT o.*, t.table_number, t.table_name
      FROM orders o
      JOIN tables t ON o.table_id = t.id
      WHERE o.id = ?
      `,
      [order_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const order = orders[0];

    const [items] = await db.execute(
      `
      SELECT oi.*, mi.name as item_name, mi.printer_id
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = ?
      `,
      [order_id]
    );

    // Group by printer
    const printerGroups = {};
    items.forEach((item) => {
      const printerId = item.printer_id || "default";
      if (!printerGroups[printerId]) printerGroups[printerId] = [];
      printerGroups[printerId].push(item);
    });

    const printResults = [];

    for (const [printerId, printerItems] of Object.entries(printerGroups)) {
      const [printers] = await db.execute(
        'SELECT * FROM printers WHERE printer_id = ? AND status = "online"',
        [printerId]
      );

      if (printers.length === 0) {
        printResults.push({
          printer_id: printerId,
          success: false,
          message: "Printer not found or offline",
        });
        continue;
      }

      const printer = printers[0];

      // Prepare KOT text
      const printerData = `
Order No: ${order.order_number}
Table: ${order.table_number} - ${order.table_name}
--------------------------------
${printerItems.map((i) => `${i.item_name} x ${i.quantity}`).join("\n")}
--------------------------------
Thank you!
`;

      try {
        await sendToPrinter(printer.ip_address, printer.port || 9100, printerData);

        printResults.push({
          printer_id: printerId,
          success: true,
          message: `KOT printed successfully on ${printer.name} (${printer.ip_address})`,
          order_data: {
            order_number: order.order_number,
            table_number: order.table_number,
            items: printerItems.length,
          },
        });
      } catch (error) {
        printResults.push({
          printer_id: printerId,
          success: false,
          message: "Print failed",
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: "Print job completed",
      data: {
        order_id,
        results: printResults,
      },
    });
  } catch (error) {
    console.error("Print order error:", error);
    res.status(500).json({
      success: false,
      message: "Error printing order",
      error: error.message,
    });
  }
};


// Print receipt
const printReceipt = async (req, res) => {
  try {
    const { session_id, payment_details } = req.body;

    const [sessions] = await db.execute(
      `
      SELECT s.*, t.table_number, t.table_name, u.name as user_name
      FROM sessions s
      JOIN tables t ON s.table_id = t.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
      `,
      [session_id]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    const session = sessions[0];

    const [orders] = await db.execute(
      `
      SELECT o.*, 
             GROUP_CONCAT(CONCAT(oi.quantity, 'x ', mi.name, ' @ $', oi.unit_price) SEPARATOR '\n') as items_summary,
             SUM(oi.total_price) as items_total
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.session_id = ?
      GROUP BY o.id
      `,
      [session_id]
    );

    const [printers] = await db.execute(
      'SELECT * FROM printers WHERE type = "receipt" AND status = "online" LIMIT 1'
    );

    if (printers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No receipt printer available",
      });
    }

    const printer = printers[0];

    const receiptText = `
*** RECEIPT ***
Table: ${session.table_number} - ${session.table_name}
Customer: ${session.customer_name || "Walk-in"}
Server: ${session.user_name || "N/A"}
--------------------------------
${orders.map((o) => o.items_summary).join("\n")}
--------------------------------
Subtotal: $${orders.reduce((sum, o) => sum + (o.items_total || 0), 0).toFixed(2)}
Paid: $${payment_details.total_amount.toFixed(2)}
Payment Mode: ${payment_details.method || "Cash"}
--------------------------------
Thank you! Please visit again.
`;

    try {
      await sendToPrinter(printer.ip_address, printer.port || 9100, receiptText);

      res.json({
        success: true,
        message: "Receipt printed successfully via WiFi",
        data: {
          session_id,
          printer_id: printer.printer_id,
          receipt_data: {
            table: session.table_number,
            customer: session.customer_name,
            total: payment_details.total_amount,
          },
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: "Receipt print failed",
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Print receipt error:", error);
    res.status(500).json({
      success: false,
      message: "Error printing receipt",
      error: error.message,
    });
  }
};

// Update printer status
const updatePrinterStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["online", "offline", "error"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    const [result] = await db.execute(
      "UPDATE printers SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Printer not found",
      });
    }

    res.json({
      success: true,
      message: "Printer status updated successfully",
      data: { printer_id: id, status },
    });
  } catch (error) {
    console.error("Update printer status error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating printer status",
      error: error.message,
    });
  }
};


// Delete printer
const deletePrinter = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute(
      'DELETE FROM printers WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Printer not found'
      });
    }

    res.json({
      success: true,
      message: 'Printer deleted successfully'
    });
  } catch (error) {
    console.error('Delete printer error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting printer',
      error: error.message
    });
  }
};







// const testPrint = async (req, res) => {
//   try {
//     const { printer_id, ip_address, port } = req.body;

//     // ✅ Step 1: Basic validation
//     if (!printer_id || !ip_address) {
//       return res.status(400).json({
//         success: false,
//         message: "printer_id and ip_address are required",
//       });
//     }

//     const ip = ip_address.trim();
//     const targetPort = port || 9100;

//     console.log(`🖨️ Test print called for ID=${printer_id}, IP=${ip}, Port=${targetPort}`);

//     // ✅ Step 2: Create simple payload (for testing)
//     const payload = Buffer.from(`Test print from server\nPrinter ID: ${printer_id}\n\n\n`, "ascii");

//     // ✅ Step 3: Wrap socket connection in promise
//     await new Promise((resolve, reject) => {
//       const client = new net.Socket();
//       let finished = false;

//       const cleanup = () => {
//         try {
//           client.destroy();
//         } catch (e) {}
//       };

//       const fail = (err) => {
//         if (finished) return;
//         finished = true;
//         cleanup();
//         reject(err);
//       };

//       // ⏱ Timeout
//       client.setTimeout(6000, () => fail(new Error("Socket timeout while connecting")));

//       client.once("error", (err) => {
//         fail(err);
//       });

//       client.once("connect", () => {
//         console.log(`✅ Connected to ${ip}:${targetPort}`);

//         client.write(payload, (err) => {
//           if (err) return fail(err);
//           console.log("✅ Data written successfully");
//           client.end();

//           // Small delay before resolve (printers close slowly)
//           setTimeout(() => {
//             if (!finished) {
//               finished = true;
//               cleanup();
//               resolve();
//             }
//           }, 300);
//         });
//       });

//       // 🔌 Start connection using user-provided IP and Port
//       client.connect(targetPort, ip);
//     });

//     // ✅ Step 4: Success response
//     return res.json({
//       success: true,
//       message: `Test print sent successfully to ${ip}:${targetPort}`,
//     });
//   } catch (error) {
//     // 🧠 Log details for debugging
//     console.error("Printer connection failed:", error.code, error.message);

//     let userMessage = "Error sending test print.";
//     if (error.message.includes("timeout")) userMessage = "Printer connection timed out.";
//     if (error.code === "ECONNREFUSED") userMessage = "Connection refused (no printer service running).";
//     if (error.code === "EHOSTUNREACH" || error.code === "ENETUNREACH") userMessage = "Printer not reachable on network.";

//     return res.status(500).json({
//       success: false,
//       message: userMessage,
//       code: error.code || "ERROR",
//     });
//   }
// };
const testPrint = async (req, res) => {
  const { printer_id, ip_address, port } = req.body;
  
  try {
    if (!printer_id) {
      return res.status(400).json({
        success: false,
        message: "printer_id is required",
      });
    }

    // 🧩 Case 1: IP not provided — still run "virtual print"
    if (!ip_address || !ip_address.trim()) {
      console.log(`🖨️ Printer "${printer_id}" has no IP configured — running local/virtual test.`);
      
      // you can optionally log or simulate print here
      console.log(`🧾 Simulated local print: "Test print from server — Printer ID: ${printer_id}"`);
      
      // simulate delay for realism
      await new Promise(resolve => setTimeout(resolve, 500));

      return res.status(200).json({
        success: true,
        message: `Local/virtual test print executed for printer "${printer_id}".`,
        mode: "LOCAL",
      });
    }

    // 🧩 Case 2: IP is provided → perform real network print
    const ip = String(ip_address).trim();
    const targetPort = Number(port) || 9100;

    console.log(`🖨️ Test print called for ID=${printer_id}, IP=${ip}, Port=${targetPort}`);

    const payload = Buffer.from(
      `Test print from server\nPrinter ID: ${printer_id}\n\n\n`,
      "ascii"
    );

    await new Promise((resolve, reject) => {
      const client = new net.Socket();
      let finished = false;

      const cleanup = () => { try { client.destroy(); } catch (e) {} };
      const fail = (err) => { if (finished) return; finished = true; cleanup(); reject(err); };

      client.setTimeout(6000, () => fail(new Error("Socket timeout while connecting/writing")));
      client.once("error", (err) => fail(err));

      client.once("connect", () => {
        console.log(`✅ Connected to ${ip}:${targetPort}`);
        client.write(payload, (err) => {
          if (err) return fail(err);
          console.log("✅ Data written successfully");
          client.end();
          setTimeout(() => { if (!finished) { finished = true; cleanup(); resolve(); } }, 300);
        });
      });

      client.connect(targetPort, ip);
    });

    // 🧩 Success Response
    return res.json({
      success: true,
      message: `Test print sent successfully to ${ip}:${targetPort}`,
      mode: "NETWORK",
    });

  } catch (error) {
    // 🧩 Case 3: Connection failed → fall back to virtual print
    console.error("Printer connection failed:", error.code, error.message);
    console.log(`🖨️ Printer "${printer_id}" connection failed — falling back to local/virtual test.`);
    
    // Simulate print with delay
    console.log(`🧾 Simulated local print: "Test print from server — Printer ID: ${printer_id}"`);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return success with fallback mode
    return res.status(200).json({
      success: true,
      message: `Printer at ${ip_address || 'N/A'}:${port || 9100} is not reachable. Virtual test print executed for printer "${printer_id}".`,
      mode: "FALLBACK",
      warning: error.code === "ECONNREFUSED" ? "Printer service not running" : 
               error.code === "EHOSTUNREACH" || error.code === "ENETUNREACH" ? "Printer not reachable on network" :
               "Connection failed",
    });
  }
};




module.exports = {
  getAllPrinters,
  getPrinterById,
  createPrinter,
  updatePrinter,
  testPrinter,
  printOrder,
  printReceipt,
  updatePrinterStatus,
  deletePrinter,
  testPrint
};
