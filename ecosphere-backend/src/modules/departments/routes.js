const express = require('express');
const { body } = require('express-validator');
const crudFactory = require('../../utils/crudFactory');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');

const router = express.Router();
const fields = ['name', 'code', 'head_employee_id', 'parent_department_id', 'employee_count', 'status'];
const ctrl = crudFactory('departments', fields);

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.post(
  '/',
  authenticate, authorize('ADMIN'),
  [body('name').notEmpty().withMessage('name is required'),
   body('code').notEmpty().withMessage('code is required')],
  validate,
  ctrl.create
);
router.put('/:id', authenticate, authorize('ADMIN'), ctrl.update);
router.delete('/:id', authenticate, authorize('ADMIN'), ctrl.remove);

module.exports = router;
