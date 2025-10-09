# POS Restaurant & Pool System Backend API

A comprehensive Node.js backend API for a Point of Sale (POS) system designed for restaurants and gaming zones (pool, snooker, PlayStation). This system includes table management, order processing, reservations, billing, smart plug control, and printer integration.

## Features

### 🔐 Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin, Staff, User)
- Permission-based route protection
- Secure password hashing with bcrypt

### 🏢 User Management
- User registration and login
- Profile management
- Role assignment and permissions
- User statistics and analytics

### 🪑 Table Management
- Multiple table types (Restaurant, Pool, Snooker, PlayStation, Dining)
- Table grouping and categorization
- Real-time table status updates
- Table availability checking

### 📋 Order Management
- Complete order lifecycle management
- Kitchen Order Ticket (KOT) system
- Order item tracking
- Real-time order status updates

### 📅 Reservation System
- Table booking and reservation management
- Conflict detection and prevention
- Customer notification system
- Reservation analytics

### 💰 Billing & Payments
- Session-based billing
- Multiple payment methods (Cash, Card, UPI, Wallet)
- Tax calculation and discount application
- Payment history and refunds

### 🖨️ Printer Integration
- Kitchen, Bar, and Receipt printer support
- Automatic order routing to appropriate printers
- Printer status monitoring
- Test printing functionality

### 🔌 Smart Plug Control
- Remote power control for gaming equipment
- Real-time power consumption monitoring
- Automatic plug control based on sessions
- Bulk plug operations

### 📊 Reports & Analytics
- Revenue reports and analytics
- Table utilization reports
- Menu performance analysis
- Customer analytics
- Hourly performance tracking
- Data export capabilities (JSON, CSV)

### 🔄 Real-time Updates
- Socket.io integration for live updates
- Real-time table status changes
- Live order tracking
- Instant notification system

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   - Create a MySQL database
   - Import the database schema from `config/database.sql`
   - Update database credentials in `.env` file

4. **Environment Configuration**
   - Copy `.env.example` to `.env`
   - Update all environment variables with your values

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication
All protected routes require a Bearer token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### User Roles & Permissions

#### Admin
- Full system access
- User management
- Table and menu management
- Printer and smart plug configuration
- All reports and analytics

#### Staff
- Table operations
- Order management
- Reservation handling
- Billing and payments
- Basic reports

#### User
- Personal reservations
- Session tracking
- Personal billing history

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - User login
- `GET /auth/profile` - Get user profile
- `PUT /auth/profile` - Update profile
- `PUT /auth/change-password` - Change password
- `POST /auth/logout` - Logout

### Users (Admin only)
- `GET /users` - Get all users
- `GET /users/:id` - Get user by ID
- `POST /users` - Create new user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user
- `GET /users/stats/overview` - User statistics

### Tables
- `GET /tables` - Get all tables
- `GET /tables/available` - Get available tables
- `GET /tables/:id` - Get table by ID
- `POST /tables` - Create table (Admin)
- `PUT /tables/:id` - Update table
- `PATCH /tables/:id/status` - Update table status
- `DELETE /tables/:id` - Delete table (Admin)
- `GET /tables/groups/all` - Get table groups
- `POST /tables/groups` - Create table group (Admin)
- `GET /tables/stats` - Table statistics

### Menu
- `GET /menu/categories` - Get all categories
- `GET /menu/items` - Get all menu items
- `GET /menu/categories/:categoryId/items` - Get items by category
- `GET /menu/items/:id` - Get menu item by ID
- `POST /menu/categories` - Create category (Admin)
- `POST /menu/items` - Create menu item (Admin)
- `PUT /menu/categories/:id` - Update category (Admin)
- `PUT /menu/items/:id` - Update menu item (Admin)
- `DELETE /menu/categories/:id` - Delete category (Admin)
- `DELETE /menu/items/:id` - Delete menu item (Admin)

### Orders
- `GET /orders` - Get all orders
- `GET /orders/pending` - Get pending orders (KOT)
- `GET /orders/:id` - Get order by ID
- `POST /orders` - Create new order
- `PATCH /orders/:id/status` - Update order status
- `PATCH /orders/items/:itemId/status` - Update order item status
- `GET /orders/table/:tableId` - Get orders by table
- `GET /orders/session/:sessionId` - Get orders by session
- `GET /orders/stats` - Order statistics
- `DELETE /orders/:id` - Delete order (Admin)

### Sessions
- `GET /sessions` - Get all sessions
- `GET /sessions/active` - Get active sessions
- `GET /sessions/my-sessions` - Get user's sessions
- `GET /sessions/:id` - Get session by ID
- `POST /sessions/start` - Start new session
- `PATCH /sessions/:id/end` - End session
- `PATCH /sessions/:id/pause` - Pause session
- `PATCH /sessions/:id/resume` - Resume session
- `PATCH /sessions/:id/extend` - Extend session
- `GET /sessions/stats/overview` - Session statistics

### Reservations
- `GET /reservations` - Get all reservations
- `GET /reservations/my-reservations` - Get user's reservations
- `GET /reservations/:id` - Get reservation by ID
- `POST /reservations` - Create reservation
- `PUT /reservations/:id` - Update reservation
- `PATCH /reservations/:id/status` - Update reservation status
- `PATCH /reservations/:id/cancel` - Cancel reservation
- `DELETE /reservations/:id` - Delete reservation (Admin)
- `GET /reservations/stats/overview` - Reservation statistics

### Smart Plugs
- `GET /plugs` - Get all smart plugs
- `GET /plugs/:id` - Get plug by ID
- `POST /plugs` - Create smart plug (Admin)
- `PUT /plugs/:id` - Update smart plug (Admin)
- `POST /plugs/:id/power` - Control plug power
- `GET /plugs/:id/status` - Get plug status
- `PATCH /plugs/:id/status` - Update plug status
- `GET /plugs/:id/consumption` - Get power consumption
- `POST /plugs/bulk/control` - Bulk control plugs
- `DELETE /plugs/:id` - Delete plug (Admin)

### Printers
- `GET /printers` - Get all printers
- `GET /printers/:id` - Get printer by ID
- `POST /printers` - Create printer (Admin)
- `PUT /printers/:id` - Update printer (Admin)
- `POST /printers/:id/test` - Test printer
- `POST /printers/print-order` - Print order (KOT)
- `POST /printers/print-receipt` - Print receipt
- `PATCH /printers/:id/status` - Update printer status
- `DELETE /printers/:id` - Delete printer (Admin)

### Billing & Payments
- `GET /billing/session/:sessionId` - Get session bill
- `POST /billing/payment` - Process payment
- `GET /billing/payments` - Get payment history
- `GET /billing/my-payments` - Get user's payments
- `GET /billing/payments/:id` - Get payment by ID
- `POST /billing/payments/:id/refund` - Refund payment (Admin)
- `GET /billing/stats` - Billing statistics

### Reports
- `GET /reports/dashboard` - Dashboard overview
- `GET /reports/revenue` - Revenue reports
- `GET /reports/table-utilization` - Table utilization
- `GET /reports/menu-performance` - Menu performance
- `GET /reports/customer-analytics` - Customer analytics
- `GET /reports/hourly-performance` - Hourly performance
- `GET /reports/export/:reportType` - Export reports

## Testing with Postman

1. **Import the Collection**
   - Import `postman_collection.json` into Postman
   - Set the `base_url` variable to your server URL

2. **Authentication Flow**
   - Use the "Login" request to authenticate
   - The auth token will be automatically set for subsequent requests

3. **Test Scenarios**
   - Create users with different roles
   - Set up tables and table groups
   - Create menu categories and items
   - Start sessions and create orders
   - Process payments and generate reports

## Database Schema

The system uses MySQL with the following main tables:
- `users` - User accounts and authentication
- `tables` - Table definitions and status
- `table_groups` - Table categorization
- `sessions` - Gaming/dining sessions
- `orders` - Customer orders
- `order_items` - Individual order items
- `menu_categories` - Menu categorization
- `menu_items` - Menu items and pricing
- `reservations` - Table reservations
- `payments` - Payment transactions
- `printers` - Printer configurations
- `smart_plugs` - Smart plug devices
- `permissions` - System permissions
- `role_permissions` - Role-based permissions

## Real-time Features

The API includes Socket.io for real-time updates:
- Table status changes
- New orders and status updates
- Session start/end notifications
- Payment confirmations
- Smart plug control events

## Security Features

- JWT token authentication
- Role-based access control
- Permission-based route protection
- Input validation and sanitization
- Rate limiting
- CORS protection
- Helmet security headers

## Error Handling

The API includes comprehensive error handling:
- Validation errors with detailed messages
- Database connection error handling
- External API integration error handling
- Proper HTTP status codes
- Structured error responses

## External Integrations

### Printer API
Configure printer endpoints in environment variables:
- Kitchen printers for food orders
- Bar printers for beverage orders
- Receipt printers for billing

### Smart Plug API
Configure smart plug endpoints for:
- Remote power control
- Power consumption monitoring
- Automated session-based control

## Development

### Running Tests
```bash
npm test
```

### Code Structure
```
backend/
├── config/          # Database and configuration
├── controllers/     # Route controllers
├── middleware/      # Authentication and validation
├── models/          # Database models
├── routes/          # API routes
├── server.js        # Main server file
└── package.json     # Dependencies
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure production database
3. Set secure JWT secret
4. Configure external API endpoints
5. Set up SSL/TLS certificates
6. Configure reverse proxy (nginx)
7. Set up monitoring and logging

## Support

For issues and questions:
1. Check the API documentation
2. Review the Postman collection examples
3. Check server logs for error details
4. Verify database connections and external API configurations