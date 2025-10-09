const BusinessSettings = require('../models/businessSettingsModel');

const cloudinary = require("cloudinary").v2;
const fs = require("fs");

// Cloudinary config
cloudinary.config({
  cloud_name: "dkqcqrrbp",
  api_key: "418838712271323",
  api_secret: "p12EKWICdyHWx8LcihuWYqIruWQ",
});




exports.getSettings = async (req, res) => {
  try {
    const settings = await BusinessSettings.getSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error fetching settings', error: err.message });
  }
};

// exports.updateSettings = async (req, res) => {
//   try {
//     await BusinessSettings.updateSettings(req.body);
//     res.json({ success: true, message: 'Business settings updated successfully' });
//   } catch (err) {
//     res.status(500).json({ success: false, message: 'Error updating settings', error: err.message });
//   }
// };


exports.updateSettings = async (req, res) => {
  try {
    let logoUrl = req.body.receipt_logo; // Default agar naya file nahi bheja

    // Agar naya file bheja gaya hai (form-data me)
    if (req.files && req.files.receipt_logo) {
      const file = req.files.receipt_logo;

      // Upload on Cloudinary
      const result = await cloudinary.uploader.upload(file.tempFilePath, {
        folder: "business_settings_logo"
      });

      logoUrl = result.secure_url;

      // temp file delete kar do
      fs.unlinkSync(file.tempFilePath);
    }

    // DB Update
    await BusinessSettings.updateSettings({
      ...req.body,
      receipt_logo: logoUrl
    });

    res.json({
      success: true,
      message: "Business settings updated successfully",
      logo: logoUrl
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error updating settings",
      error: err.message
    });
  }
};