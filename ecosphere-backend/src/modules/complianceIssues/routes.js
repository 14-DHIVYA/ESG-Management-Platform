const express = require('express');
const { body } = require('express-validator');
const { query } = require('../../config/db');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { authenticate, authorize } = require('../../middleware/auth');
const { notify } = require('../../services/notificationService');

const router = express.Router();

router.post(
  '/',
  authenticate, authorize('ADMIN', 'AUDITOR'),
  [
    body('audit_id').isUUID(),
    body('severity').isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    body('description').notEmpty(),
    body('owner_id').isUUID(),
    body('due_date').isISO8601().withMessage('due_date must be a valid date'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { audit_id, severity, description, owner_id, due_date } = req.body;
    const result = await query(
      `INSERT INTO compliance_issues (audit_id, severity, description, owner_id, due_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [audit_id, severity, description, owner_id, due_date]
    );
    await notify(owner_id, 'COMPLIANCE_ISSUE', `A new ${severity} compliance issue was assigned to you: ${description}`);
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.patch(
  '/:id',
  authenticate, authorize('ADMIN', 'AUDITOR'),
  [body('status').optional().isIn(['OPEN', 'IN_PROGRESS', 'RESOLVED'])],
  validate,
  asyncHandler(async (req, res) => {
    const fields = ['status', 'severity', 'description', 'owner_id', 'due_date'];
    const setFields = fields.filter((f) => req.body[f] !== undefined);
    if (!setFields.length) throw new ApiError(400, 'No valid fields provided');
    const setSql = setFields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    const values = setFields.map((f) => req.body[f]);
    const result = await query(
      `UPDATE compliance_issues SET ${setSql} WHERE id = $${setFields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    if (!result.rows[0]) throw new ApiError(404, 'Compliance issue not found');
    res.json({ success: true, data: result.rows[0] });
  })
);

// Run periodically (cron / manual trigger) to flag overdue open issues and notify owners.
router.post('/flag-overdue', authenticate, authorize('ADMIN'), asyncHandler(async (req, res) => {
  const overdue = await query(
    `UPDATE compliance_issues SET flagged = true
     WHERE due_date < CURRENT_DATE AND status != 'RESOLVED' AND flagged = false
     RETURNING *`
  );
  for (const issue of overdue.rows) {
    await notify(issue.owner_id, 'COMPLIANCE_ISSUE', `Compliance issue is overdue: ${issue.description}`);
  }
  res.json({ success: true, flaggedCount: overdue.rows.length, data: overdue.rows });
}));

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { audit_id, status, owner_id, flagged } = req.query;
  const clauses = [];
  const values = [];
  if (audit_id) { values.push(audit_id); clauses.push(`audit_id = $${values.length}`); }
  if (status) { values.push(status); clauses.push(`status = $${values.length}`); }
  if (owner_id) { values.push(owner_id); clauses.push(`owner_id = $${values.length}`); }
  if (flagged) { values.push(flagged === 'true'); clauses.push(`flagged = $${values.length}`); }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await query(`SELECT * FROM compliance_issues ${whereSql} ORDER BY due_date ASC`, values);
  res.json({ success: true, data: rows.rows });
}));

module.exports = router;
