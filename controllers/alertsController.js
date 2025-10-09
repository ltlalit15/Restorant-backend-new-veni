
const Alerts = require('../models/alertsModel');

const getAllAlerts = async (req, res) => {
  try {
    const [tableAlerts] = await Alerts.getTableTimeoutAlerts();
    const [reservationReminders] = await Alerts.getReservationReminders();

    res.status(200).json({
      success: true,
      data: {
        activeAlerts: tableAlerts.length + reservationReminders.length,
        overdueTables: tableAlerts.filter(t => t.exceeded_minutes > 0).length,
        tableTimeoutAlerts: tableAlerts,
        reservationReminders: reservationReminders
      }
    });
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({ success: false, message: "Error fetching alerts", error: error.message });
  }
};

module.exports = { getAllAlerts };
