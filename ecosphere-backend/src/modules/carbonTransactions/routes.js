const express = require('express');
const { body } = require('express-validator');
const { query } = require('../../config/db');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { authenticate, authorize } = require('../../middleware/auth');
const { calculateAndRecordEmission } = require('../../services/carbonCalculationService');

const router = express.Router();

// Manual entry (used when Settings → auto_emission_calc_enabled is OFF,
// or for one-off adjustments)
router.post(
  '/',
  authenticate, authorize('ADMIN', 'MANAGER'),
  [
    body('department_id').isUUID(),
    body('source_type').isIn(['PURCHASE', 'MANUFACTURING', 'EXPENSE', 'FLEET']),
    body('emission_factor_id').isUUID(),
    body('quantity').isFloat({ gt: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const record = await calculateAndRecordEmission({
      departmentId: req.body.department_id,
      sourceType: req.body.source_type,
      sourceReferenceId: req.body.source_reference_id,
      emissionFactorId: req.body.emission_factor_id,
      quantity: req.body.quantity,
      transactionDate: req.body.transaction_date,
      autoCalculated: false,
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data: record });
  })
);

// Simulated ERP hook: call this from your Purchase/Manufacturing/Expense/Fleet
// creation endpoints when esg_config.auto_emission_calc_enabled = true.
router.post(
  '/auto',
  authenticate,
  [
    body('department_id').isUUID(),
    body('source_type').isIn(['PURCHASE', 'MANUFACTURING', 'EXPENSE', 'FLEET']),
    body('source_reference_id').isUUID(),
    body('emission_factor_id').isUUID(),
    body('quantity').isFloat({ gt: 0 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const configResult = await query('SELECT auto_emission_calc_enabled FROM esg_config LIMIT 1');
    if (configResult.rows[0]?.auto_emission_calc_enabled === false) {
      throw new ApiError(400, 'Auto emission calculation is disabled in Settings');
    }
    const record = await calculateAndRecordEmission({
      departmentId: req.body.department_id,
      sourceType: req.body.source_type,
      sourceReferenceId: req.body.source_reference_id,
      emissionFactorId: req.body.emission_factor_id,
      quantity: req.body.quantity,
      autoCalculated: true,
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data: record });
  })
);

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { department_id, source_type, from, to, page = 1, limit = 20 } = req.query;
  const clauses = [];
  const values = [];
  if (department_id) { values.push(department_id); clauses.push(`department_id = $${values.length}`); }
  if (source_type) { values.push(source_type); clauses.push(`source_type = $${values.length}`); }
  if (from) { values.push(from); clauses.push(`transaction_date >= $${values.length}`); }
  if (to) { values.push(to); clauses.push(`transaction_date <= $${values.length}`); }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const offset = (Math.max(page, 1) - 1) * limit;
  const rows = await query(
    `SELECT * FROM carbon_transactions ${whereSql} ORDER BY transaction_date DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, limit, offset]
  );
  res.json({ success: true, data: rows.rows });
}));

router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM carbon_transactions WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) throw new ApiError(404, 'Carbon transaction not found');
  res.json({ success: true, data: result.rows[0] });
}));

module.exports = router;
