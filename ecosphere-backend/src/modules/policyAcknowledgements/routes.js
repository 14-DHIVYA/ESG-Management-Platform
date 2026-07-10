const express = require('express');
const { body } = require('express-validator');
const { query } = require('../../config/db');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

router.post(
  '/',
  authenticate,
  [body('policy_id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const result = await query(
      `INSERT INTO policy_acknowledgements (policy_id, employee_id) VALUES ($1, $2)
       ON CONFLICT (policy_id, employee_id) DO NOTHING RETURNING *`,
      [req.body.policy_id, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] || { message: 'Already acknowledged' } });
  })
);

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { policy_id, employee_id } = req.query;
  const clauses = [];
  const values = [];
  if (policy_id) { values.push(policy_id); clauses.push(`policy_id = $${values.length}`); }
  if (employee_id) { values.push(employee_id); clauses.push(`employee_id = $${values.length}`); }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await query(`SELECT * FROM policy_acknowledgements ${whereSql} ORDER BY acknowledged_at DESC`, values);
  res.json({ success: true, data: rows.rows });
}));

module.exports = router;
