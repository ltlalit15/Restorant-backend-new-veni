const db = require('../config/database');

class Alerts {
  // Table Timeout Alerts
  static async getTableTimeoutAlerts() {
    const query = `
      SELECT 
        r.id AS reservation_id,
        r.table_id,
        t.table_number,
        t.table_name,
        t.location,
        r.customer_name,
        r.reservation_date,
        r.reservation_time,
        r.duration_hours,
        r.status,
        TIMESTAMP(
          r.reservation_date, r.reservation_time
        ) AS start_time,
        TIMESTAMP(
          r.reservation_date, r.reservation_time
        ) + INTERVAL r.duration_hours HOUR AS expected_end_time,
        TIMESTAMPDIFF(MINUTE, 
          TIMESTAMP(r.reservation_date, r.reservation_time) + INTERVAL r.duration_hours HOUR, 
          NOW()
        ) AS exceeded_minutes
      FROM reservations r
      JOIN tables t ON r.table_id = t.id
      WHERE r.status = 'confirmed'
      ORDER BY expected_end_time ASC;
    `;
    return db.execute(query);
  }

  // Reservation Reminders
  static async getReservationReminders() {
    const query = `
      SELECT 
        r.id AS reservation_id,
        r.customer_name,
        r.table_id,
        t.table_number,
        t.table_name,
        t.location,
        r.reservation_date,
        r.reservation_time,
        r.party_size,
        r.status,
        TIMESTAMPDIFF(MINUTE, NOW(), TIMESTAMP(r.reservation_date, r.reservation_time)) AS minutes_remaining
      FROM reservations r
      JOIN tables t ON r.table_id = t.id
      WHERE r.status = 'confirmed'
        AND r.reservation_date = CURDATE()
      ORDER BY r.reservation_time ASC;
    `;
    return db.execute(query);
  }
}

module.exports = Alerts;
