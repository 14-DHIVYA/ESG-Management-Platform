const express = require('express');
const { body } = require('express-validator');
const crudFactory = require('../../utils/crudFactory');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');

const router = express.Router();
const fields = ['department_id', 'period_start', 'period_end', 'gender_male', 'gender_female', 'gender_other', 'age_group_data'];
const ctrl = crudFactory('diversity_metrics', fields);

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'),
  [body('department_id').isUUID(), body('period_start').isISO8601(), body('period_end').isISO8601()],
  validate, ctrl.create);
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), ctrl.update);

module.exports = router;
