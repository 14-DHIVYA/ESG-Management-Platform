const express = require('express');
const { body } = require('express-validator');
const crudFactory = require('../../utils/crudFactory');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');

const router = express.Router();
const fields = ['name', 'source_type', 'unit', 'co2_per_unit', 'valid_from', 'valid_to', 'status'];
const ctrl = crudFactory('emission_factors', fields);

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.post('/', authenticate, authorize('ADMIN'),
  [body('name').notEmpty(),
   body('source_type').isIn(['PURCHASE', 'MANUFACTURING', 'EXPENSE', 'FLEET']),
   body('unit').notEmpty(),
   body('co2_per_unit').isFloat({ gt: 0 }).withMessage('co2_per_unit must be a positive number')],
  validate, ctrl.create);
router.put('/:id', authenticate, authorize('ADMIN'), ctrl.update);
router.delete('/:id', authenticate, authorize('ADMIN'), ctrl.remove);

module.exports = router;
