const express = require('express');
const { body } = require('express-validator');
const { query } = require('../../config/db');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { authenticate, authorize } = require('../../middleware/auth');
const { notify } = require('../../services/notificationService');
const { evaluateAndAwardBadges } = require('../../services/badgeAwardService');

const router = express.Router();

// Employee joins a challenge
router.post(
  '/',
  authenticate,
  [body('challenge_id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const challengeResult = await query('SELECT * FROM challenges WHERE id = $1', [req.body.challenge_id]);
    const challenge = challengeResult.rows[0];
    if (!challenge) throw new ApiError(404, 'Challenge not found');
    if (challenge.status !== 'ACTIVE') throw new ApiError(400, 'Challenge is not currently active');

    const result = await query(
      `INSERT INTO challenge_participations (challenge_id, employee_id) VALUES ($1, $2) RETURNING *`,
      [req.body.challenge_id, req.user.id]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

// Employee updates their own progress / uploads proof
router.patch(
  '/:id/progress',
  authenticate,
  [body('progress').isInt({ min: 0, max: 100 }), body('proof_url').optional().isString()],
  validate,
  asyncHandler(async (req, res) => {
    const result = await query(
      `UPDATE challenge_participations SET progress = $1, proof_url = COALESCE($2, proof_url)
       WHERE id = $3 AND employee_id = $4 RETURNING *`,
      [req.body.progress, req.body.proof_url, req.params.id, req.user.id]
    );
    if (!result.rows[0]) throw new ApiError(404, 'Participation record not found');
    res.json({ success: true, data: result.rows[0] });
  })
);

// Manager/Admin approves — awards XP, checks evidence rule, triggers badge evaluation
router.patch(
  '/:id/decision',
  authenticate, authorize('ADMIN', 'MANAGER'),
  [body('approval_status').isIn(['APPROVED', 'REJECTED'])],
  validate,
  asyncHandler(async (req, res) => {
    const participationResult = await query(
      `SELECT cp.*, c.xp, c.evidence_required FROM challenge_participations cp
       JOIN challenges c ON c.id = cp.challenge_id WHERE cp.id = $1`,
      [req.params.id]
    );
    const participation = participationResult.rows[0];
    if (!participation) throw new ApiError(404, 'Participation record not found');

    if (req.body.approval_status === 'APPROVED') {
      const configResult = await query('SELECT evidence_requirement_enabled FROM esg_config LIMIT 1');
      const evidenceRequired = (configResult.rows[0]?.evidence_requirement_enabled ?? true) && participation.evidence_required;
      if (evidenceRequired && !participation.proof_url) {
        throw new ApiError(400, 'Cannot approve: proof file is required for this challenge');
      }
    }

    const xpAwarded = req.body.approval_status === 'APPROVED' ? participation.xp : 0;
    const updated = await query(
      `UPDATE challenge_participations SET approval_status = $1, xp_awarded = $2 WHERE id = $3 RETURNING *`,
      [req.body.approval_status, xpAwarded, req.params.id]
    );

    let newBadges = [];
    if (xpAwarded > 0) {
      await query('UPDATE employees SET xp_points = xp_points + $1 WHERE id = $2', [xpAwarded, participation.employee_id]);
      newBadges = await evaluateAndAwardBadges(participation.employee_id);
    }

    await notify(
      participation.employee_id,
      'APPROVAL_DECISION',
      `Your challenge submission was ${req.body.approval_status.toLowerCase()}.`
    );

    res.json({ success: true, data: updated.rows[0], badgesAwarded: newBadges });
  })
);

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { challenge_id, employee_id, approval_status } = req.query;
  const clauses = [];
  const values = [];
  if (challenge_id) { values.push(challenge_id); clauses.push(`challenge_id = $${values.length}`); }
  if (employee_id) { values.push(employee_id); clauses.push(`employee_id = $${values.length}`); }
  if (approval_status) { values.push(approval_status); clauses.push(`approval_status = $${values.length}`); }
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await query(`SELECT * FROM challenge_participations ${whereSql} ORDER BY created_at DESC`, values);
  res.json({ success: true, data: rows.rows });
}));

module.exports = router;
