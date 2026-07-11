const express = require('express');
const { query } = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate, authorize } = require('../../middleware/auth');

const router = express.Router();

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM esg_config LIMIT 1');
  res.json({ success: true, data: result.rows[0] });
}));

router.put('/', authenticate, authorize('ADMIN'), asyncHandler(async (req, res) => {
  const {
    environmental_weight, social_weight, governance_weight,
    auto_emission_calc_enabled, evidence_requirement_enabled, badge_auto_award_enabled,
  } = req.body;

  const existing = await query('SELECT id FROM esg_config LIMIT 1');
  if (!existing.rows[0]) {
    const created = await query(
      `INSERT INTO esg_config (environmental_weight, social_weight, governance_weight, auto_emission_calc_enabled, evidence_requirement_enabled, badge_auto_award_enabled)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [environmental_weight, social_weight, governance_weight, auto_emission_calc_enabled, evidence_requirement_enabled, badge_auto_award_enabled]
    );
    return res.json({ success: true, data: created.rows[0] });
  }

  const updated = await query(
    `UPDATE esg_config SET
       environmental_weight = COALESCE($1, environmental_weight),
       social_weight = COALESCE($2, social_weight),
       governance_weight = COALESCE($3, governance_weight),
       auto_emission_calc_enabled = COALESCE($4, auto_emission_calc_enabled),
       evidence_requirement_enabled = COALESCE($5, evidence_requirement_enabled),
       badge_auto_award_enabled = COALESCE($6, badge_auto_award_enabled),
       updated_at = now()
     WHERE id = $7 RETURNING *`,
    [environmental_weight, social_weight, governance_weight, auto_emission_calc_enabled, evidence_requirement_enabled, badge_auto_award_enabled, existing.rows[0].id]
  );
  res.json({ success: true, data: updated.rows[0] });
}));

module.exports = router;
