const express = require('express');
const { body } = require('express-validator');
const crudFactory = require('../../utils/crudFactory');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');

const router = express.Router();
const fields = ['department_id', 'title', 'target_metric', 'target_value', 'current_value', 'unit', 'deadline', 'status'];
const ctrl = crudFactory('environmental_goals', fields);

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'),
  [body('title').notEmpty(), body('target_value').isFloat()], validate, ctrl.create);
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), ctrl.update);
router.delete('/:id', authenticate, authorize('ADMIN'), ctrl.remove);

module.exports = router;
