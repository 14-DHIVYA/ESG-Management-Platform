const express = require('express');
const { body } = require('express-validator');
const { pool } = require('../../config/db');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

// Redeem a reward — wrapped in a transaction so stock/points can't go negative
// under concurrent requests.
router.post(
  '/',
  authenticate,
  [body('reward_id').isUUID()],
  validate,
  asyncHandler(async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const rewardResult = await client.query('SELECT * FROM rewards WHERE id = $1 FOR UPDATE', [req.body.reward_id]);
      const reward = rewardResult.rows[0];
      if (!reward || reward.status !== 'ACTIVE') throw new ApiError(404, 'Reward not found or inactive');
      if (reward.stock <= 0) throw new ApiError(400, 'Reward is out of stock');

      const empResult = await client.query('SELECT points_balance FROM employees WHERE id = $1 FOR UPDATE', [req.user.id]);
      const employee = empResult.rows[0];
      if (employee.points_balance < reward.points_required) throw new ApiError(400, 'Insufficient points balance');

      await client.query('UPDATE rewards SET stock = stock - 1 WHERE id = $1', [reward.id]);
      await client.query('UPDATE employees SET points_balance = points_balance - $1 WHERE id = $2', [reward.points_required, req.user.id]);
      const redemption = await client.query(
        `INSERT INTO reward_redemptions (employee_id, reward_id, points_deducted) VALUES ($1,$2,$3) RETURNING *`,
        [req.user.id, reward.id, reward.points_required]
      );

      await client.query('COMMIT');
      res.status(201).json({ success: true, data: redemption.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { employee_id } = req.query;
  const values = [];
  let whereSql = '';
  if (employee_id) { values.push(employee_id); whereSql = 'WHERE employee_id = $1'; }
  const rows = await pool.query(`SELECT * FROM reward_redemptions ${whereSql} ORDER BY redeemed_at DESC`, values);
  res.json({ success: true, data: rows.rows });
}));

module.exports = router;
