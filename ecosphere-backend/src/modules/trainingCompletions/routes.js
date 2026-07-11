const express = require('express');
const { body } = require('express-validator');
const crudFactory = require('../../utils/crudFactory');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');

const router = express.Router();
const fields = ['employee_id', 'training_name', 'completed_date', 'status'];
const ctrl = crudFactory('training_completions', fields);

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), [body('employee_id').isUUID(), body('training_name').notEmpty()], validate, ctrl.create);
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), ctrl.update);

module.exports = router;
