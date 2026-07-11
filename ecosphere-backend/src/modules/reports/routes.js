const express = require('express');
const { query } = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// Shared filter builder — Department, Date Range, Module, Employee, Challenge, ESG Category
function buildFilters(q, tableAlias) {
  const clauses = [];
  const values = [];
  if (q.department_id) { values.push(q.department_id); clauses.push(`${tableAlias}.department_id = $${values.length}`); }
  if (q.from) { values.push(q.from); clauses.push(`${tableAlias}.created_at >= $${values.length}`); }
  if (q.to) { values.push(q.to); clauses.push(`${tableAlias}.created_at <= $${values.length}`); }
  return { whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', values };
}

router.get('/environmental', authenticate, asyncHandler(async (req, res) => {
  const { whereSql, values } = buildFilters(req.query, 'ct');
  const rows = await query(
    `SELECT ct.department_id, d.name AS department_name, SUM(ct.co2_equivalent) AS total_co2,
            COUNT(*) AS transaction_count
     FROM carbon_transactions ct JOIN departments d ON d.id = ct.department_id
     ${whereSql}
     GROUP BY ct.department_id, d.name
     ORDER BY total_co2 DESC`,
    values
  );
  res.json({ success: true, report: 'environmental', data: rows.rows });
}));

router.get('/social', authenticate, asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT ca.department_id, d.name AS department_name,
           COUNT(*) FILTER (WHERE ep.approval_status = 'APPROVED') AS approved_participations,
           SUM(ep.points_earned) AS total_points_earned
    FROM employee_participations ep
    JOIN csr_activities ca ON ca.id = ep.activity_id
    JOIN departments d ON d.id = ca.department_id
    GROUP BY ca.department_id, d.name
    ORDER BY approved_participations DESC
  `);
  res.json({ success: true, report: 'social', data: rows.rows });
}));

router.get('/governance', authenticate, asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT a.department_id, d.name AS department_name,
           COUNT(ci.*) AS total_issues,
           COUNT(*) FILTER (WHERE ci.status = 'OPEN') AS open_issues,
           COUNT(*) FILTER (WHERE ci.flagged = true) AS flagged_issues
    FROM compliance_issues ci
    JOIN audits a ON a.id = ci.audit_id
    JOIN departments d ON d.id = a.department_id
    GROUP BY a.department_id, d.name
    ORDER BY open_issues DESC
  `);
  res.json({ success: true, report: 'governance', data: rows.rows });
}));

router.get('/esg-summary', authenticate, asyncHandler(async (req, res) => {
  const rows = await query(`
    SELECT DISTINCT ON (ds.department_id) ds.*, d.name AS department_name
    FROM department_scores ds JOIN departments d ON d.id = ds.department_id
    ORDER BY ds.department_id, ds.period_end DESC
  `);
  res.json({ success: true, report: 'esg-summary', data: rows.rows });
}));

// Custom Report Builder — combine filters across module + export format is
// handled client-side (CSV/PDF/Excel) from this JSON payload.
router.get('/custom', authenticate, asyncHandler(async (req, res) => {
  const { module: reportModule, department_id, from, to, employee_id, challenge_id, esg_category } = req.query;
  const tableMap = {
    environmental: 'carbon_transactions',
    social: 'employee_participations',
    governance: 'compliance_issues',
    gamification: 'challenge_participations',
  };
  const table = tableMap[reportModule] || 'carbon_transactions';

  const clauses = [];
  const values = [];
  if (department_id && table === 'carbon_transactions') { values.push(department_id); clauses.push(`department_id = $${values.length}`); }
  if (employee_id) { values.push(employee_id); clauses.push(`employee_id = $${values.length}`); }
  if (challenge_id && table === 'challenge_participations') { values.push(challenge_id); clauses.push(`challenge_id = $${values.length}`); }
  if (from) { values.push(from); clauses.push(`created_at >= $${values.length}`); }
  if (to) { values.push(to); clauses.push(`created_at <= $${values.length}`); }

  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await query(`SELECT * FROM ${table} ${whereSql} ORDER BY created_at DESC LIMIT 500`, values);
  res.json({ success: true, report: 'custom', module: reportModule, data: rows.rows });
}));

module.exports = router;
