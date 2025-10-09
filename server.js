const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fileUpload = require('express-fileupload');
//const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
dotenv.config();

// Import database connection
const db = require('./config/database');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const tableRoutes = require('./routes/tableRoutes');
const orderRoutes = require('./routes/orderRoutes');
const menuRoutes = require('./routes/menuRoutes');
const reservationRoutes = require('./routes/reservationRoutes');
const billingRoutes = require('./routes/billingRoutes');
const printerRoutes = require('./routes/printerRoutes');
const plugRoutes = require('./routes/plugRoutes');
const reportRoutes = require('./routes/reportRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const businessSettingsRoutes = require('./routes/businessSettingsRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const alertsRoutes = require('./routes/alertsRoutes');
const testTapoRoutes = require('./routes/testTapoRoutes');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:5173', 'https://poslightcontrollive.netlify.app'],   // ✅ Same as app CORS
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], // ✅ Allowed HTTP methods
    credentials: true
  }
});

// Middleware
app.use(helmet());
// ---------- ALLOWED ORIGINS ----------
const allowedOrigins = [
  'http://localhost:5173',
  'https://poslightcontrol.netlify.app',
  'https://poslightcontrollive.netlify.app',
  'https://pos-light-controls.netlify.app'
];

// ---------- CORS CONFIG ----------
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow Postman / server-to-server
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      console.warn(`❌ Blocked by CORS: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Preflight for all routes
app.options('*', cors());

// ✅ Fix: trust proxy before rate limiting
app.set('trust proxy', 1);

// Rate limiting
//const limiter = rateLimit({
 // windowMs: 15 * 60 * 1000, // 15 minutes
 // max: 100 // limit each IP to 100 requests per windowMs
//});
//app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ useTempFiles: true }));
// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('join_table', (tableId) => {
    socket.join(`table_${tableId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Make io accessible to routes
app.set('io', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/printers', printerRoutes);
app.use('/api/plugs', plugRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/alerts', alertsRoutes);

app.use('/api/reports', reportsRoutes);

app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/subcategories', require('./routes/subcategoryRoutes'));
app.use('/api/items', require('./routes/itemRoutes'));
app.use('/api/business_settings', businessSettingsRoutes);
app.use('/api/tapotest', testTapoRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 6001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
