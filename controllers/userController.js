const User = require('../models/User');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const role = req.query.role;

    const result = await User.getAll(page, limit, role);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching users',
      error: error.message
    });
  }
};

// Get user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user',
      error: error.message
    });
  }
};

// Create new user
const createUser = async (req, res) => {
  try {
    const { name, email, password, phone, role, discount_percentage, permissions } = req.body;

    // Check if email already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Ensure permissions is always an object
    const permissionsObject = typeof permissions === 'object' && permissions !== null ? permissions : {};

    // Create user
    const userId = await User.create({
      name,
      email,
      password,
      phone,
      role: role || 'user',
      discount_percentage: discount_percentage || 0,
      permissions: permissionsObject
    });

    // Get created user
    const user = await User.findById(userId);

    // ✅ Parse permissions back to JSON object
   // if (user && user.permissions) {
   //   try {
   //     user.permissions = JSON.parse(user.permissions);
   //   } catch (e) {
   //     user.permissions = [];
   //   }
   // }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
};

// Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, role, status, discount_percentage, permissions } = req.body;

    // Check if user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email is already taken by another user
    if (email !== existingUser.email) {
      const emailExists = await User.emailExists(email, id);
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

     // Ensure permissions is always an object
    const permissionsObject = typeof permissions === 'object' && permissions !== null ? permissions : {};

    // Update user
    const updated = await User.update(id, {
      name,
      email,
      phone,
      role,
      status,
      discount_percentage,
      permissions: permissionsObject
    });

    if (!updated) {
      return res.status(400).json({
        success: false,
        message: 'Failed to update user'
      });
    }

    // Get updated user
    const user = await User.findById(id);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

// Delete user
// Normal delete user
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await User.findById(id);
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent deleting admin users (optional)
    if (existingUser.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin users'
      });
    }

    // Hard delete user
    const deleted = await User.delete(id); // 👈 ye method DB se row hata dega
    if (!deleted) {
      return res.status(400).json({
        success: false,
        message: 'Failed to delete user'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

// Get user statistics
const getUserStats = async (req, res) => {
  try {
    const stats = await User.getStats();

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user statistics',
      error: error.message
    });
  }
};


const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findByEmail(email);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const tokenExpiry = Date.now() + 15 * 60 * 1000; // 15 min

    await User.saveResetToken(user.id, hashedToken, tokenExpiry);

    // ----------------- EMAIL SETUP -----------------
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'packageitappofficially@gmail.com',
        pass: 'epvuqqesdioohjvi', // Gmail App Password
      },
       tls: {
      rejectUnauthorized: false,
    },
    });

    const resetUrl = `https://poslightcontrollive.netlify.app/reset-password?token=${resetToken}`;

    // Professional HTML email (mobile-friendly, inline CSS)
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:600px;background:#fff;border-radius:10px;overflow:hidden;">
          <tr>
            <td style="background:#0a1a2f;padding:16px;color:#fff;font-weight:700;font-size:18px;">
              Restaurant Pos - Password Reset
            </td>
          </tr>
          <tr>
            <td style="padding:24px;color:#333;font-size:14px;line-height:20px;">
              <p>Hi <strong>${user.name || 'there'}</strong>,</p>
              <p>We received a request to reset your password. Click the button below to set a new one. This link expires in <strong>15 minutes</strong>.</p>
              <p style="text-align:center;margin:20px 0;">
                <a href="${resetUrl}" style="background:#0a1a2f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;">Reset Password</a>
              </p>
              <p style="font-size:12px;color:#666;">Or copy this link:<br/>
                <a href="${resetUrl}" style="color:#0a1a2f;word-break:break-all;">${resetUrl}</a>
              </p>
              <p style="font-size:12px;color:#888;">If you didn’t request this, ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f0f3f8;padding:12px;text-align:center;font-size:11px;color:#666;">
              © ${new Date().getFullYear()} Restaurant Pos • Automated email, please don’t reply
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    await transporter.sendMail({
      from: "sagar.kiaan12@gmail.com",
      to: user.email,
      subject: 'Password Reset Request',
      html,
    });

    return res.json({
      success: true,
      message: 'Password reset email sent successfully',
      token: resetToken, 
      expiresInMinutes: 15
    });

  } catch (error) {
    console.error('Forget password error:', error);
    return res.status(500).json({ success: false, message: 'Error in forget password', error: error.message });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    // hash incoming token
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // find user with token
    const user = await User.findByResetToken(hashedToken);
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired token" });
    }

    // check expiry
    if (new Date(user.reset_expires) < new Date()) {
      return res.status(400).json({ success: false, message: "Token expired" });
    }

    // hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // update password
    await User.updatePassword(user.id, hashedPassword);

    // clear token
    await User.clearResetToken(user.id);

    return res.json({ success: true, message: "Password reset successful" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};



module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getUserStats,
  forgetPassword,
  resetPassword
};
