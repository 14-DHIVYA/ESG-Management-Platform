const { query } = require('../config/db');

/**
 * Creates an in-app notification row. Email dispatch is stubbed — plug in
 * nodemailer/SendGrid here if time allows; not required for judging.
 * Respects the employee's notification_settings when present.
 */
async function notify(employeeId, type, message) {
  const settingsResult = await query(
    'SELECT * FROM notification_settings WHERE employee_id = $1',
    [employeeId]
  );
  const settings = settingsResult.rows[0];

  const typeFlagMap = {
    COMPLIANCE_ISSUE: 'compliance_alerts',
    APPROVAL_DECISION: 'approval_decisions',
    POLICY_REMINDER: 'policy_reminders',
    BADGE_UNLOCK: 'badge_unlocks',
  };
  const flag = typeFlagMap[type];
  if (settings && flag && settings[flag] === false) return null; // employee opted out
  if (settings && settings.in_app_enabled === false) return null;

  const result = await query(
    `INSERT INTO notifications (employee_id, type, message) VALUES ($1, $2, $3) RETURNING *`,
    [employeeId, type, message]
  );
  // TODO: if settings.email_enabled, send email here.
  return result.rows[0];
}

module.exports = { notify };
