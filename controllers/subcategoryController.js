const Subcategory = require('../models/Subcategory');



exports.getallsubCategory = async (req, res) => {
  try {
    const [rows] = await Subcategory.getallsubCategory();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};



exports.getByCategory = async (req, res) => {
  try {
    const { category_id } = req.query;
    const [rows] = await Subcategory.getByCategory(category_id);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { category_id, subcategory_name, printer_id } = req.body;
    await Subcategory.create(category_id, subcategory_name, printer_id);
    res.status(201).json({ success: true, message: "Subcategory created" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    let { category_id, subcategory_name, printer_id } = req.body;
    // Replace undefined with null
    subcategory_name = subcategory_name ?? null;
    printer_id = printer_id ?? null;
    category_id = category_id ?? null;
    
    await Subcategory.update(id, category_id, subcategory_name, printer_id);
    res.json({ success: true, message: "Subcategory updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// subCategoryController.js
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await Subcategory.delete(id);
    res.json({ success: true, message: "Subcategory & related items deleted successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
