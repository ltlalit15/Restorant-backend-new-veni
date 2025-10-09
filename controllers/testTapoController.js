const db = require('../config/database');
const { controlTapoPlug } = require("../controllers/plugController");

// ------------------ Test Controller ------------------
const testDummyTapoPlug = async (req, res) => {
  try {
    // Dummy plug
    const fakePlug = {
      plug_id: "TEST123",
      ip_address: "192.168.1.250", // koi bhi local IP (exist karna zaroori nahi)
      mac_address: "a1b2c3d4e5f6",
      email: "fake@example.com",   // WiFi login test ke liye fake email
      password: "wrongpass"
    };

    console.log("---- Testing Plug ON ----");
    const resultOn = await controlTapoPlug(fakePlug, "on");

    console.log("\n---- Testing Plug OFF ----");
    const resultOff = await controlTapoPlug(fakePlug, "off");

    // API style response
    res.json({
      success: true,
      data: {
        plug: fakePlug.plug_id,
        onResult: resultOn,
        offResult: resultOff
      }
    });
  } catch (err) {
    console.error("❌ Dummy test failed:", err.message);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};


module.exports = {
 testDummyTapoPlug
}  

