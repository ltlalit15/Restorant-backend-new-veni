const Reports = require('../models/reportsModel');

const getReports = async (req, res) => {
  try {
    const { reportBy, reportType, startDate, endDate } = req.query;

    const results = await Reports.getReports(reportBy, reportType, startDate, endDate);

    res.status(200).json({
      success: true,
      reportBy,
      reportType,
      data: results
    });

  } catch (error) {
    console.error('Reports API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message
    });
  }
};
const getTableOrdersByDate = async (req, res) => {
  try {
    const results = await Reports.getTableOrdersByDate();

    // Ensure orders is always an array
    const parsedResults = results.map(row => {
      let orders = row.orders;

      if (typeof orders === "string") {
        try {
          orders = JSON.parse(orders);
        } catch (e) {
          console.error("JSON parse error for orders:", e.message);
          orders = [];
        }
      }

      return {
        ...row,
        orders: Array.isArray(orders) ? orders : []
      };
    });

    res.status(200).json({
      success: true,
      data: parsedResults
    });

  } catch (error) {
    console.error("Table Orders API Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching table orders report",
      error: error.message,
    });
  }
};








module.exports = {
  getReports,
  getTableOrdersByDate
};
