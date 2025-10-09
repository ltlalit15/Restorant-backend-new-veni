const Item = require('../models/Item');

exports.getAll = async (req, res) => {
  try {
    const { category_id, subcategory_id } = req.query;
    const [rows] = await Item.getAll(category_id, subcategory_id);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { category_id, subcategory_id, printer_id, items } = req.body;
    await Item.create(category_id, subcategory_id, printer_id, items);
    res.status(201).json({ success: true, message: "Items created" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { item_name, price, category_id, subcategory_id, printer_id, status } = req.body;
    await Item.update(id, item_name, price, category_id, subcategory_id, printer_id, status);
    res.json({ success: true, message: "Item updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    await Item.delete(id);
    res.json({ success: true, message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};


exports.getBySubcategoryId = async (req, res) => {
  try {
    const { subcategory_id } = req.params;
    const [items] = await Item.getBySubcategoryId(subcategory_id); // fetch items
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};





