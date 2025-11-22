const jwt = require('jsonwebtoken');
const User = require('../models/User');

const bcrypt = require("bcryptjs");
const pool = require("../config/database.js");




// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET, // use env secret
    { expiresIn: "30d" }
  );
};


// Register new user
const register = async (req, res) => {
  try {
    const { name, email, password, phone, role, permissions } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Create new user
    const userId = await User.create({
      name,
      email,
      password,
      phone,
      role: role || 'user',
      permissions: permissions || null
    });

    // Get created user
    const user = await User.findById(userId);

    // Generate token
    const token = generateToken(userId);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          permissions: user.permissions
        },
        token
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isPasswordValid = await User.verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

 

    // Generate token
    const token = generateToken(user.id);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          discount_percentage: user.discount_percentage,
          permissions: user.permissions 
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          discount_percentage: user.discount_percentage,
          permissions: user.permissions,
          created_at: user.created_at
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { name, phone } = req.body;
    const userId = req.params.id;

    // Prepare updated fields safely (avoid undefined)
    const updatedFields = {
      name: name ?? null,
      phone: phone ?? null,
      email: req.user?.email ?? null,
      role: req.user?.role ?? null,
      status: 'active',
      discount_percentage: req.user?.discount_percentage ?? 0
     // permissions: permissions ?? req.user?.permissions ?? null
    };

    // Update user
    const updated = await User.update(userId, updatedFields);

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update profile'
      });
    }

    // Get updated user
    const user = await User.findById(userId);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          discount_percentage: user.discount_percentage
         // permissions: user.permissions
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

// Change password
// const changePassword = async (req, res) => {
//   try {
//     const { newPassword } = req.body;
//     const userId = req.params.id; // userId params se lo

//     // Get user with password by id
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: 'User not found'
//       });
//     }
//     // Update password
//     const updated = await User.updatePassword(userId, newPassword);
//     if (!updated) {
//       return res.status(400).json({
//         success: false,
//         message: 'Failed to update password'
//       });
//     }

//     res.json({
//       success: true,
//       message: 'Password changed successfully'
//     });
//   } catch (error) {
//     console.error('Change password error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Error changing password',
//       error: error.message
//     });
//   }
// };










  // your MySQL connection file

const changePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    const userId = req.params.id;

    // Validation
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password is required"
      });
    }

    // Check if user exists
    const [user] = await pool.query("SELECT * FROM users WHERE id = ?", [userId]);

    if (user.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      "UPDATE users SET password = ?, reset_token = NULL, reset_expires = NULL, updated_at = NOW() WHERE id = ?",
      [hashedPassword, userId]
    );

    return res.json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      message: "Error changing password",
      error: error.message
    });
  }
};







// Logout (client-side token removal)
const logout = async (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  logout
};
