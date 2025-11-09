const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

// Create connection pool
const pool = mysql.createPool({
  host: "mainline.proxy.rlwy.net",   // Railway host
  user: "root",                      // Railway user
  password: "KAErjQuChBKKFuEOJVoEJtMmGizbsjFY",  // Railway password
  database: "railway",               // Railway DB name
  port: 42087,                       // Railway port
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Get promise-based connection
const promisePool = pool.promise();

// Test database connection
const testConnection = async () => {
  try {
    const connection = await promisePool.getConnection();
    
    console.log('✅ Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

testConnection();

module.exports = promisePool;


