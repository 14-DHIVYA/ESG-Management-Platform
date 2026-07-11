const express = require('express');
const { query } = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM notifications WHERE employee_id = $1 ORDER BY created_at DESC', [req.user.id]);
  res.json({ success: true, data: rows.rows });
}));

router.patch('/:id/read', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND employee_id = $2 RETURNING *',
    [req.params.id, req.user.id]
  );
  res.json({ success: true, data: result.rows[0] });
}));

router.get('/settings', authenticate, asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM notification_settings WHERE employee_id = $1', [req.user.id]);
  res.json({ success: true, data: result.rows[0] || null });
}));

router.put('/settings', authenticate, asyncHandler(async (req, res) => {
  const { compliance_alerts, approval_decisions, policy_reminders, badge_unlocks, email_enabled, in_app_enabled } = req.body;
  const result = await query(
    `INSERT INTO notification_settings (employee_id, compliance_alerts, approval_decisions, policy_reminders, badge_unlocks, email_enabled, in_app_enabled)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (employee_id) DO UPDATE SET
       compliance_alerts = $2, approval_decisions = $3, policy_reminders = $4,
       badge_unlocks = $5, email_enabled = $6, in_app_enabled = $7
     RETURNING *`,
    [req.user.id, compliance_alerts, approval_decisions, policy_reminders, badge_unlocks, email_enabled, in_app_enabled]
  );
  res.json({ success: true, data: result.rows[0] });
}));

module.exports = router;
