
const Category = require('../models/Category');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await Category.getAll();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { category_name, printer_id } = req.body;
    await Category.create(category_name, printer_id);
    res.status(201).json({ success: true, message: "Category created" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_name, printer_id, status } = req.body;

    // Sirf wahi fields bhejenge jo update karni hai
    await Category.update(id, { category_name, printer_id, status });

    res.json({ success: true, message: "Category updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



// categoryController.js
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await Category.delete(id);
    res.json({ success: true, message: "Category & related subcategories + items deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
