const express = require('express');
const { body } = require('express-validator');
const { query } = require('../../config/db');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { authenticate, authorize } = require('../../middleware/auth');
const { notify } = require('../../services/notificationService');

const router = express.Router();

// Employee registers/logs their participation in a CSR activity
router.post(
  '/',
  authenticate,
  [body('activity_id').isUUID(), body('proof_url').optional().isString()],
  validate,
  asyncHandler(async (req, res) => {
    const result = await query(
      `INSERT INTO employee_participations (employee_id, activity_id, proof_url)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, req.body.activity_id, req.body.proof_url || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { employee_id, activity_id, approval_status } = req.query;
  const clauses = [];
  const values = [];
  if (employee_id) { values.push(employee_id); clauses.push(`employee_id = $${values.length}`); }
  if (activity_id) { values.push(activity_id); clauses.push(`activity_id = $${values.length}`); }
  if (approval_status) { values.push(approval_status); clauses.push(`approval_status = $${values.length}`); }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await query(`SELECT * FROM employee_participations ${whereSql} ORDER BY created_at DESC`, values);
  res.json({ success: true, data: rows.rows });
}));

// Manager/Admin approval — enforces the "Evidence Requirement" business rule
router.patch(
  '/:id/decision',
  authenticate, authorize('ADMIN', 'MANAGER'),
  [
    body('approval_status').isIn(['APPROVED', 'REJECTED']),
    body('points_earned').optional().isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { approval_status, points_earned } = req.body;

    const participationResult = await query('SELECT * FROM employee_participations WHERE id = $1', [req.params.id]);
    const participation = participationResult.rows[0];
    if (!participation) throw new ApiError(404, 'Participation record not found');

    if (approval_status === 'APPROVED') {
      const configResult = await query('SELECT evidence_requirement_enabled FROM esg_config LIMIT 1');
      const evidenceRequired = configResult.rows[0]?.evidence_requirement_enabled ?? true;
      if (evidenceRequired && !participation.proof_url) {
        throw new ApiError(400, 'Cannot approve: proof file is required (Evidence Requirement is enabled)');
      }
    }

    const points = approval_status === 'APPROVED' ? (points_earned || 0) : 0;
    const updated = await query(
      `UPDATE employee_participations
       SET approval_status = $1, points_earned = $2, completion_date = CASE WHEN $1 = 'APPROVED' THEN CURRENT_DATE ELSE completion_date END, approved_by = $3
       WHERE id = $4 RETURNING *`,
      [approval_status, points, req.user.id, req.params.id]
    );

    if (approval_status === 'APPROVED' && points > 0) {
      await query('UPDATE employees SET points_balance = points_balance + $1 WHERE id = $2', [points, participation.employee_id]);
    }

    await notify(
      participation.employee_id,
      'APPROVAL_DECISION',
      `Your CSR activity participation was ${approval_status.toLowerCase()}.`
    );

    res.json({ success: true, data: updated.rows[0] });
  })
);

module.exports = router;
