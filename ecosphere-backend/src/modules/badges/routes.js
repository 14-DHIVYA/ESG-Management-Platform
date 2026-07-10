const express = require('express');
const { body } = require('express-validator');
const crudFactory = require('../../utils/crudFactory');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const { query } = require('../../config/db');
const asyncHandler = require('../../utils/asyncHandler');

const router = express.Router();
const fields = ['name', 'description', 'unlock_rule', 'icon_url', 'status'];
const ctrl = crudFactory('badges', fields);

router.get('/', authenticate, ctrl.list);
router.get('/earned', authenticate, asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT eb.id, eb.employee_id, eb.badge_id, eb.awarded_at, b.name, b.description, b.icon_url
     FROM employee_badges eb
     JOIN badges b ON b.id = eb.badge_id
     WHERE eb.employee_id = $1
     ORDER BY eb.awarded_at DESC`,
    [req.user.id]
  );
  res.json({ success: true, data: result.rows });
}));
router.get('/:id', authenticate, ctrl.getById);
router.post('/', authenticate, authorize('ADMIN'),
  [body('name').notEmpty(), body('unlock_rule').isObject().withMessage('unlock_rule must be a JSON object')],
  validate, ctrl.create);
router.put('/:id', authenticate, authorize('ADMIN'), ctrl.update);
router.delete('/:id', authenticate, authorize('ADMIN'), ctrl.remove);

module.exports = router;
