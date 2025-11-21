const db = require('../config/database');
const axios = require('axios');
const crypto = require('crypto');
const { TuyaContext } = require('@tuya/tuya-connector-nodejs');
const { loginDevice } = require("tp-link-tapo-connect");
const { Client } = require("tplink-smarthome-api");


const tuyaContext = new TuyaContext({
  baseUrl: process.env.TUYA_BASE_URL || 'https://openapi.tuyaeu.com',
  accessKey: process.env.TUYA_ACCESS_ID || '7ygcw9tj9kppejeegvp3',
  secretKey: process.env.TUYA_ACCESS_SECRET || '41b99977280f4d7b8af963e4c3ce0fb7'
});

console.log('✅ Tuya Context Initialized:');
console.log('   Base URL:', process.env.TUYA_BASE_URL || 'https://openapi.tuyaeu.com');
console.log('   Data Center:', process.env.TUYA_DATA_CENTER || 'Central Europe (EU)');
console.log('   Access ID:', (process.env.TUYA_ACCESS_ID || '7ygcw9tj9kppejeegvp3').substring(0, 8) + '...');


function normalizeMac(mac) {
  if (!mac) return null;

  return mac
    .toUpperCase()
    .replace(/[^A-F0-9]/g, "") // sirf hex digits rakho
    .match(/.{1,2}/g)          // 2-2 chars ke group
    .join(":");                // colon se join
}


async function controlTapoPlug(plug, action) {
  const normalizedMac = normalizeMac(plug.mac_address);
  const client = new Client();

  try {
    console.log("Received plug object:", plug);

    let device;
    let mode;

  
    if (plug.auth_username && plug.auth_password && plug.ip_address) {
      try {
        device = await loginDevice(plug.auth_username, plug.auth_password, plug.ip_address);
        mode = "WiFi";
        console.log(`✅ WiFi login success for ${plug.ip_address}`);
      } catch (wifiErr) {
        console.warn(`⚠️ WiFi login failed for ${plug.ip_address}: ${wifiErr.message}`);
      }
    }

   
    if (!device && plug.ip_address) {
      try {
        device = await client.getDevice({ host: plug.ip_address });
        mode = "LAN";
        console.log(`✅ LAN connection success for ${plug.ip_address}`);
      } catch (lanErr) {
        console.error(`❌ Could not connect via LAN at ${plug.ip_address}:`, lanErr.message);
        return {
          success: false,
          error: `Device not reachable: ${lanErr.message}`,
          plug_id: plug.plug_id || null,
          ip: plug.ip_address,
          mac: normalizedMac,
          mode: "LAN",
        };
      }
    }

    if (!device) {
      console.error(`❌ Device object is null or undefined for IP ${plug.ip_address}`);
      return {
        success: false,
        error: "Device object is null/undefined",
        plug_id: plug.plug_id || null,
        ip: plug.ip_address,
        mac: normalizedMac,
        mode: mode || "unknown",
      };
    }

    
    if (action === "on") {
      if (mode === "WiFi") await device.turnOn();
      else await device.setPowerState(true);
    } else if (action === "off") {
      if (mode === "WiFi") await device.turnOff();
      else await device.setPowerState(false);
    } else {
      throw new Error("Invalid action. Use 'on' or 'off'.");
    }

    console.log(
      `✅ Plug ${plug.plug_id || "UNKNOWN"} turned ${action.toUpperCase()} via ${mode} [MAC: ${normalizedMac}]`
    );

    return {
      success: true,
      plug_id: plug.plug_id || null,
      mac: normalizedMac,
      ip: plug.ip_address,
      mode,
      action,
    };
  } catch (err) {
    console.error("❌ Tapo control failed:", err.message);
    return {
      success: false,
      error: err.message,
      plug_id: plug.plug_id || null,
      ip: plug.ip_address,
      mac: normalizedMac,
      mode: "unknown",
    };
  }
}


const getAllPlugs = async (req, res) => {
  try {
    const [plugs] = await db.execute(`
      SELECT sp.*, t.table_number, t.table_name, t.table_type
      FROM smart_plugs sp
      LEFT JOIN tables t ON sp.table_id = t.id
      ORDER BY sp.name
    `);

   
    let ipWhitelistErrorDetected = false;
    const plugsWithStatus = await Promise.all(
      plugs.map(async (plug) => {
        const deviceId = plug.plug_id;
        if (!deviceId) {
          return { ...plug, power_state: "unknown" };
        }

        try {
          const statusResponse = await tuyaContext.request({
            method: "GET",
            path: `/v1.0/iot-03/devices/${deviceId}/status`,
          });

          const statusList = statusResponse.result || [];
          const switchStatus = statusList.find(s => s.code.includes("switch"));

          return {
            ...plug,
            power_state: switchStatus?.value ? "on" : "off",
            raw_status: statusList
          };
        } catch (statusErr) {
          const errorMsg = statusErr.message || "";
          
          if (errorMsg.includes("GET_TOKEN_FAILED") || errorMsg.includes("don't have access")) {
            if (!ipWhitelistErrorDetected) {
              console.warn(`⚠️ IP Whitelisting Required: Your server IP needs to be whitelisted in Tuya Cloud.`);
              ipWhitelistErrorDetected = true;
            }
            return { 
              ...plug, 
              power_state: plug.power_state || "off",
              _statusFetchError: "IP_WHITELIST_REQUIRED"
            };
          }
          
          console.error(`⚠️ Failed to fetch status for plug_id=${deviceId}:`, errorMsg);
          return { ...plug, power_state: "unknown" };
        }
      })
    );

    res.json({
      success: true,
      data: { plugs: plugsWithStatus }
    });
  } catch (error) {
    console.error("Get all plugs error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching smart plugs",
      error: error.message,
    });
  }
};


const getPlugById = async (req, res) => {
  try {
    const { id } = req.params;
    const [plugs] = await db.execute(`
      SELECT sp.*, t.table_number, t.table_name, t.table_type
      FROM smart_plugs sp
      LEFT JOIN tables t ON sp.table_id = t.id
      WHERE sp.id = ?
    `, [id]);

    if (plugs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Smart plug not found'
      });
    }

    res.json({
      success: true,
      data: { plug: plugs[0] }
    });
  } catch (error) {
    console.error('Get plug by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching smart plug',
      error: error.message
    });
  }
};


const createPlug = async (req, res) => {
  try {
    const { plug_id, name, table_id, ip_address, mac_address, power_state, device_id, brand, auth_username, auth_password, api_key } = req.body;

    const [existing] = await db.execute(
      'SELECT id FROM smart_plugs WHERE plug_id = ?',
      [plug_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Plug ID already exists'
      });
    }

    const [result] = await db.execute(
      'INSERT INTO smart_plugs (plug_id, name, table_id, ip_address, mac_address, power_state, device_id, brand, auth_username, auth_password, api_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [plug_id, name, table_id, ip_address, mac_address, power_state, device_id, brand, auth_username, auth_password, api_key]
    );

    const [plug] = await db.execute(`
      SELECT sp.*, t.table_number, t.table_name, t.table_type
      FROM smart_plugs sp
      LEFT JOIN tables t ON sp.table_id = t.id
      WHERE sp.id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Smart plug created successfully',
      data: { plug: plug[0] }
    });
  } catch (error) {
    console.error('Create plug error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating smart plug',
      error: error.message
    });
  }
};


const updatePlug = async (req, res) => {
  try {
    const { id } = req.params;

    let { 
      plug_id, 
      name, 
      table_id, 
      ip_address, 
      mac_address, 
      status, 
      power_state, 
      device_id, 
      brand, 
      auth_username, 
      auth_password,
      api_key
    } = req.body;

    // Validate power state
    if (power_state === undefined || power_state === null || power_state === '') {
      power_state = 'off';
    } else {
      power_state = power_state.toString().toLowerCase().trim();
      if (!['on', 'off'].includes(power_state)) {
        power_state = 'off';
      }
    }

    plug_id = plug_id ?? null;
    name = name ?? null;
    table_id = table_id ?? null;
    ip_address = ip_address ?? null;
    mac_address = mac_address ?? null;
    status = status ?? null;
    device_id = device_id ?? null;
    brand = brand ?? null;
    auth_username = auth_username ?? null;
    auth_password = auth_password ?? null;
    api_key = api_key ?? null;

    const [existing] = await db.execute(
      'SELECT * FROM smart_plugs WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Smart plug not found'
      });
    }

    if (plug_id !== null && plug_id !== existing[0].plug_id) {
      const [duplicate] = await db.execute(
        'SELECT id FROM smart_plugs WHERE plug_id = ? AND id != ?',
        [plug_id, id]
      );

      if (duplicate.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Plug ID already exists'
        });
      }
    }

    console.log('✅ Updating plug with values:', {
      id,
      power_state,
      status,
      brand
    });

    const [result] = await db.execute(
      `UPDATE smart_plugs 
       SET plug_id = ?, name = ?, table_id = ?, ip_address = ?, 
           mac_address = ?, status = ?, power_state = ?, device_id = ?, 
           brand = ?, auth_username = ?, auth_password = ?, api_key = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [plug_id, name, table_id, ip_address, mac_address, status, power_state, 
       device_id, brand, auth_username, auth_password, api_key, id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update smart plug'
      });
    }

    const [plug] = await db.execute(`
      SELECT sp.*, t.table_number, t.table_name, t.table_type
      FROM smart_plugs sp
      LEFT JOIN tables t ON sp.table_id = t.id
      WHERE sp.id = ?
    `, [id]);

    res.json({
      success: true,
      message: 'Smart plug updated successfully',
      data: { plug: plug[0] }
    });
  } catch (error) {
    console.error('Update plug error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating smart plug',
      error: error.message
    });
  }
};


async function controlSonoffPlug(plug, action) {
  try {
    console.log("Received Sonoff plug object:", plug);
    let result;
    let mode;

    if (plug.auth_username && plug.auth_password) {
      try {
        const device = await loginSonoffCloud(plug.auth_username, plug.auth_password, plug.device_id);
        mode = "WiFi";
        if (action === "on") await device.turnOn();
        else await device.turnOff();
        return {
          success: true,
          plug_id: plug.plug_id || null,
          ip: plug.ip_address,
          mode,
          action,
        };
      } catch (wifiErr) {
        console.warn(`⚠️ Sonoff WiFi login failed: ${wifiErr.message}`);
      }
    }

    if (plug.ip_address && plug.device_id) {
      try {
        const response = await axios.post(
          `http://${plug.ip_address}/zeroconf/switch`,
          {
            deviceid: plug.device_id,
            data: { switch: action === "on" ? "on" : "off" },
          },
          { headers: { "Content-Type": "application/json" }, timeout: 5000 }
        );
        result = response.data;
        mode = "LAN";
      } catch (lanErr) {
        return {
          success: false,
          error: `Device not reachable: ${lanErr.message}`,
          plug_id: plug.plug_id || null,
          ip: plug.ip_address,
          mode: "LAN",
        };
      }
    }

    return {
      success: true,
      plug_id: plug.plug_id || null,
      ip: plug.ip_address,
      mode,
      action,
      response: result,
    };
  } catch (err) {
    console.error("❌ Sonoff control failed:", err.message);
    return { success: false, error: err.message, plug_id: plug.plug_id };
  }
}


async function controlBaytionPlug(plug, action) {
  try {
    console.log("Received Baytion plug object:", plug);
    let mode = "TuyaCloud";

    const deviceId = (plug.device_id && plug.device_id.trim()) || plug.plug_id;
    if (!deviceId || !deviceId.trim()) {
      console.error("❌ No device_id available for Baytion plug");
      return { 
        success: false, 
        error: "No device_id available. Please set device_id or plug_id for Baytion plug.", 
        plug_id: plug.plug_id || null 
      };
    }
    
    console.log(`🔑 Using device_id: ${deviceId} for Baytion plug control`);

     
    let switchCode = "switch_1";
    try {
      const fnResponse = await tuyaContext.request({
        method: "GET",
        path: `/v1.0/iot-03/devices/${deviceId}/functions`
      });

      const functions = fnResponse.result?.functions || [];
      const switchFn = functions.find(f => f.code.includes("switch"));
      if (switchFn) {
        switchCode = switchFn.code;
        console.log(`✅ Using switch code: ${switchCode}`);
      } else {
        console.warn("⚠️ No switch function found, falling back to 'switch_1'");
      }
    } catch (fnErr) {
      console.error("⚠️ Failed to fetch device functions:", fnErr.message);
    }

    try {
      console.log(`🔹 Controlling plug ${deviceId} with action: ${action}, code: ${switchCode}`);

      
      const response = await tuyaContext.request({
        path: `/v1.0/iot-03/devices/${deviceId}/commands`,
        method: "POST",
        body: {
          commands: [{ code: switchCode, value: action === "on" }]
        }
      });

      console.log("✅ Tuya Cloud response:", response);

      
      let statusCheck = null;
      try {
        statusCheck = await tuyaContext.request({
          method: "GET",
          path: `/v1.0/iot-03/devices/${deviceId}/status`
        });
        console.log("🔍 Device status after command:", JSON.stringify(statusCheck, null, 2));
      } catch (statusErr) {
        console.error("⚠️ Failed to fetch status:", statusErr.message);
      }

      return {
        success: true,
        plug_id: plug.plug_id || null,
        mode,
        action,
        used_code: switchCode,
        response,
        status: statusCheck?.result || null
      };
    } catch (cloudErr) {
      console.error("❌ Tuya Cloud control failed:", {
        message: cloudErr.message,
        response: cloudErr.response?.data,
        status: cloudErr.response?.status
      });
      return {
        success: false,
        error: cloudErr.message,
        plug_id: plug.plug_id || null,
        mode,
      };
    }
  } catch (err) {
    console.error("❌ Baytion control failed:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status
    });
    return { success: false, error: err.message, plug_id: plug.plug_id || null };
  }
}


const controlPlugPower = async (req, res) => {
  try {
    const { id } = req.params;
    let { action } = req.body;

    console.log(`[controlPlugPower] Request - ID: ${id}, Action: ${action}, Body:`, req.body);

    if (action && typeof action === 'string') {
      action = action.trim().toLowerCase();
    }

    if (!action || !["on", "off"].includes(action)) {
      console.error(`[controlPlugPower] Invalid action. Received: ${req.body.action}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "on" or "off"',
        received: req.body.action,
      });
    }

    const [plugs] = await db.execute(
      "SELECT * FROM smart_plugs WHERE id = ?",
      [id]
    );
    
    console.log(`[controlPlugPower] Found ${plugs.length} plug(s) with ID: ${id}`);
    
    if (plugs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Smart plug not found",
      });
    }

    const plug = plugs[0];
    let result;

    try {
      if (plug.brand === "Sonoff") {
        result = await controlSonoffPlug(plug, action);
      } else if (plug.brand === "Tapo") {
        result = await controlTapoPlug(plug, action);
      } else if (plug.brand === "Baytion") {
        result = await controlBaytionPlug(plug, action);
      } else {
        console.log(
          `➡️ Simulating control request for plug ${plug.plug_id} with action: ${action}`
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        result = { success: true };
      }

      
      if (!result.success) {
        const errorMsg = result.error || "Unknown error";
        
        let statusCode = 400;
        let message = `Failed to control smart plug via ${plug.brand || "simulation"}`;
        
        if (errorMsg.includes("GET_TOKEN_FAILED") || errorMsg.includes("don't have access")) {
          statusCode = 403;
          message = "API access denied. Your server IP needs to be whitelisted in the Tuya Cloud API settings.";
          
        
          console.log(`⚠️ Simulating plug control (API access denied): ${plug.name} -> ${action}`);
          await new Promise((resolve) => setTimeout(resolve, 500));
          await db.execute(
            'UPDATE smart_plugs SET power_state = ?, status = "online", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [action, id]
          );

          const io = req.app.get("io");
          if (io) {
            io.emit("plug_power_changed", {
              plugId: id,
              plug_id: plug.plug_id,
              power_state: action,
              table_id: plug.table_id,
            });
          }

          return res.json({
            success: true,
            message: `Plug ${plug.name} turned ${action.toUpperCase()} (SIMULATED - IP whitelist required)`,
            data: {
              plug_id: plug.plug_id,
              power_state: action,
              brand: plug.brand,
            },
            mode: "SIMULATION",
            warning: "Whitelist your server IP in Tuya Cloud: API Settings → IP Whitelist",
          });
        } else if (errorMsg.includes("device offline") || errorMsg.includes("device not online")) {
          message = "Device is offline. Please check the device connection.";
        } else if (errorMsg.includes("timeout") || errorMsg.includes("TIMEOUT")) {
          message = "Request timed out. The device may be unreachable.";
        }
        
        if (!errorMsg.includes("GET_TOKEN_FAILED") && !errorMsg.includes("don't have access")) {
          await db.execute(
            'UPDATE smart_plugs SET status = "offline", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
          );
        }

        return res.status(statusCode).json({
          success: false,
          message: message,
          error: errorMsg,
          brand: plug.brand,
          instructions: errorMsg.includes("GET_TOKEN_FAILED") || errorMsg.includes("don't have access") 
            ? "To fix: Go to Tuya Cloud → API Settings → IP Whitelist → Add your server IPs"
            : undefined,
        });
      }

      
      await db.execute(
        'UPDATE smart_plugs SET power_state = ?, status = "online", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [action, id]
      );

    
      const io = req.app.get("io");
      if (io) {
        io.emit("plug_power_changed", {
          plugId: id,
          plug_id: plug.plug_id,
          power_state: action,
          table_id: plug.table_id,
        });
      }

      return res.json({
        success: true,
        message: `Smart plug turned ${action} successfully via ${plug.brand || "simulation"}`,
        data: {
          plug_id: plug.plug_id,
          power_state: action,
          brand: plug.brand,
        },
      });
    } catch (error) {
      console.error("❌ Plug control failed:", error.message);

      await db.execute(
        'UPDATE smart_plugs SET status = "offline", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [id]
      );

      return res.status(400).json({
        success: false,
        message: `Failed to control smart plug via ${plug.brand || "simulation"}`,
        error: error.message,
      });
    }
  } catch (error) {
    console.error("Control plug power error:", error);
    res.status(500).json({
      success: false,
      message: "Error controlling smart plug",
      error: error.message,
    });
  }
};


const getPlugStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const [plugs] = await db.execute(
      'SELECT * FROM smart_plugs WHERE id = ?',
      [id]
    );

    if (plugs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Smart plug not found'
      });
    }

    const plug = plugs[0];

    try {
      const simulatedConsumption = plug.power_state === 'on' ? 
        Math.floor(Math.random() * 200) + 50 : 0;
      
      await db.execute(
        `UPDATE smart_plugs SET power_consumption = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [simulatedConsumption, id]
      );

      res.json({
        success: true,
        data: {
          plug_id: plug.plug_id,
          name: plug.name,
          status: plug.status,
          power_state: plug.power_state,
          power_consumption: simulatedConsumption,
          last_updated: new Date().toISOString(),
          simulation: true
        }
      });
    } catch (error) {
      res.json({
        success: true,
        data: {
          plug_id: plug.plug_id,
          name: plug.name,
          status: plug.status,
          power_state: plug.power_state,
          power_consumption: plug.power_consumption,
          last_updated: plug.updated_at,
          note: 'Cached status from database'
        }
      });
    }
  } catch (error) {
    console.error('Get plug status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching plug status',
      error: error.message
    });
  }
};


const updatePlugStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['online', 'offline'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const [result] = await db.execute(
      'UPDATE smart_plugs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Smart plug not found'
      });
    }

    res.json({
      success: true,
      message: 'Smart plug status updated successfully',
      data: { plug_id: id, status }
    });
  } catch (error) {
    console.error('Update plug status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating plug status',
      error: error.message
    });
  }
};


const getPowerConsumption = async (req, res) => {
  try {
    const { id } = req.params;
    const { period } = req.query;

    const [plugs] = await db.execute(
      'SELECT * FROM smart_plugs WHERE id = ?',
      [id]
    );

    if (plugs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Smart plug not found'
      });
    }

    const plug = plugs[0];

    const generateConsumptionData = (period) => {
      const data = [];
      const points = period === 'hour' ? 60 : period === 'day' ? 24 : period === 'week' ? 7 : 30;
      
      for (let i = 0; i < points; i++) {
        data.push({
          timestamp: new Date(Date.now() - (points - i) * (period === 'hour' ? 60000 : period === 'day' ? 3600000 : 86400000)),
          consumption: plug.power_state === 'on' ? Math.floor(Math.random() * 50) + 100 : 0
        });
      }
      return data;
    };

    res.json({
      success: true,
      data: {
        plug_id: plug.plug_id,
        name: plug.name,
        period: period || 'day',
        consumption_data: generateConsumptionData(period || 'day'),
        simulation: true
      }
    });
  } catch (error) {
    console.error('Get power consumption error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching power consumption',
      error: error.message
    });
  }
};


const bulkControlPlugs = async (req, res) => {
  try {
    const { plug_ids, action } = req.body;

    if (!Array.isArray(plug_ids) || plug_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'plug_ids must be a non-empty array'
      });
    }

    if (!['on', 'off'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "on" or "off"'
      });
    }

    const results = [];

    for (const plugId of plug_ids) {
      try {
        const [plugs] = await db.execute(
          'SELECT * FROM smart_plugs WHERE id = ?',
          [plugId]
        );

        if (plugs.length === 0) {
          results.push({
            plug_id: plugId,
            success: false,
            message: 'Smart plug not found'
          });
          continue;
        }

        const plug = plugs[0];

        await new Promise(resolve => setTimeout(resolve, 200));

        await db.execute(
          'UPDATE smart_plugs SET power_state = ?, status = "online", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [action, plugId]
        );

        results.push({
          plug_id: plugId,
          success: true,
          message: `Smart plug turned ${action} successfully (simulated)`,
          simulation: true
        });
      } catch (error) {
        results.push({
          plug_id: plugId,
          success: false,
          message: 'Failed to control smart plug',
          error: error.message
        });
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('bulk_plug_control', { action, results });
    }

    res.json({
      success: true,
      message: 'Bulk control operation completed',
      data: { results }
    });
  } catch (error) {
    console.error('Bulk control plugs error:', error);
    res.status(500).json({
      success: false,
      message: 'Error controlling smart plugs',
      error: error.message
    });
  }
};


const deletePlug = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await db.execute(
      'DELETE FROM smart_plugs WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Smart plug not found'
      });
    }

    res.json({
      success: true,
      message: 'Smart plug deleted successfully'
    });
  } catch (error) {
    console.error('Delete plug error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting smart plug',
      error: error.message
    });
  }
};


module.exports = {
  getAllPlugs,
  getPlugById,
  createPlug,
  updatePlug,
  controlPlugPower,
  getPlugStatus,
  updatePlugStatus,
  getPowerConsumption,
  bulkControlPlugs,
  deletePlug,
  controlSonoffPlug,
  controlTapoPlug,
  controlBaytionPlug
};
