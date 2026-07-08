const express = require('express');
const { query } = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { department_id, role, status = 'ACTIVE' } = req.query;
  const clauses = [];
  const values = [];

  if (department_id) {
    values.push(department_id);
    clauses.push(`e.department_id = $${values.length}`);
  }
  if (role) {
    values.push(role);
    clauses.push(`e.role = $${values.length}`);
  }
  if (status) {
    values.push(status);
    clauses.push(`e.status = $${values.length}`);
  }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const result = await query(
    `SELECT e.id, e.name, e.email, e.role, e.department_id, e.xp_points, e.points_balance,
            d.name AS department_name
     FROM employees e
     LEFT JOIN departments d ON d.id = e.department_id
     ${whereSql}
     ORDER BY e.name ASC`,
    values
  );

  res.json({ success: true, data: result.rows });
}));

module.exports = router;
