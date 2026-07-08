const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const { query } = require('../../config/db');
const validate = require('../../middleware/validate');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const { authenticate } = require('../../middleware/auth');

const router = express.Router();

router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('name is required'),
    body('email').isEmail().withMessage('a valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('password must be at least 8 characters'),
    body('department_id').optional().isUUID().withMessage('department_id must be a valid UUID'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, email, password, department_id, role } = req.body;
    const existing = await query('SELECT id FROM employees WHERE email = $1', [email]);
    if (existing.rows[0]) throw new ApiError(409, 'An account with this email already exists');

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO employees (name, email, password_hash, role, department_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, department_id, xp_points`,
      [name, email, hash, role || 'EMPLOYEE', department_id || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  })
);

router.post(
  '/login',
  [body('email').isEmail(), body('password').notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await query('SELECT * FROM employees WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user) throw new ApiError(401, 'Invalid email or password');

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw new ApiError(401, 'Invalid email or password');

    const token = jwt.sign(
      { id: user.id, role: user.role, departmentId: user.department_id },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '12h' }
    );
    res.json({
      success: true,
      data: { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } },
    });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await query(
      'SELECT id, name, email, role, department_id, xp_points, points_balance FROM employees WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) throw new ApiError(404, 'User not found');
    res.json({ success: true, data: result.rows[0] });
  })
);

module.exports = router;
