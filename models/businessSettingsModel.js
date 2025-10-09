const db = require('../config/database');

class BusinessSettings {
  static async getSettings() {
    const [rows] = await db.execute('SELECT * FROM business_settings LIMIT 1');
    return rows[0];
  }

static async updateSettings(data) {
  const query = `
    INSERT INTO business_settings (
      id, restaurant_mode, gamezone_mode, lounge_mode,
      weekdays_start, weekdays_end,
      saturday_start, saturday_end,
      sunday_start, sunday_end,
      receipt_logo, receipt_footer, system_mode, tax, updated_at
    ) VALUES (
      1, ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?, ?, NOW()
    )
    ON DUPLICATE KEY UPDATE
      restaurant_mode=VALUES(restaurant_mode),
      gamezone_mode=VALUES(gamezone_mode),
      lounge_mode=VALUES(lounge_mode),
      weekdays_start=VALUES(weekdays_start),
      weekdays_end=VALUES(weekdays_end),
      saturday_start=VALUES(saturday_start),
      saturday_end=VALUES(saturday_end),
      sunday_start=VALUES(sunday_start),
      sunday_end=VALUES(sunday_end),
      receipt_logo=VALUES(receipt_logo),
      receipt_footer=VALUES(receipt_footer),
      system_mode=VALUES(system_mode),
      tax=VALUES(tax),
      updated_at=NOW()
  `;

  const values = [
    data.restaurant_mode   ?? null,
    data.gamezone_mode     ?? null,
    data.lounge_mode       ?? null,
    data.weekdays_start    ?? null,
    data.weekdays_end      ?? null,
    data.saturday_start    ?? null,
    data.saturday_end      ?? null,
    data.sunday_start      ?? null,
    data.sunday_end        ?? null,
    data.receipt_logo      ?? null,
    data.receipt_footer    ?? null,
    data.system_mode       ?? null,
    data.tax               ?? null
  ];

  return db.execute(query, values);
}

}

module.exports = BusinessSettings;
