const express = require('express');
const { body } = require('express-validator');
const { query } = require('../../config/db');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middleware/auth');
const { recomputeDepartmentScore } = require('../../services/scoreAggregationService');

const router = express.Router();

// Trigger recalculation for a department + period (call after seeding data, or on a schedule)
router.post(
  '/recompute',
  authenticate, authorize('ADMIN'),
  [body('department_id').isUUID(), body('period_start').isISO8601(), body('period_end').isISO8601()],
  validate,
  asyncHandler(async (req, res) => {
    const score = await recomputeDepartmentScore(req.body.department_id, req.body.period_start, req.body.period_end);
    res.json({ success: true, data: score });
  })
);

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { department_id } = req.query;
  const clauses = [];
  const values = [];
  if (department_id) { values.push(department_id); clauses.push(`department_id = $${values.length}`); }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await query(`SELECT * FROM department_scores ${whereSql} ORDER BY period_end DESC`, values);
  res.json({ success: true, data: rows.rows });
}));

// Ranking leaderboard across departments for the most recent period
router.get('/rankings', authenticate, asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT DISTINCT ON (ds.department_id) ds.*, d.name AS department_name
    FROM department_scores ds
    JOIN departments d ON d.id = ds.department_id
    ORDER BY ds.department_id, ds.period_end DESC
  `);
  const ranked = rows.rows.sort((a, b) => b.total_score - a.total_score);
  res.json({ success: true, data: ranked });
}));

module.exports = router;
