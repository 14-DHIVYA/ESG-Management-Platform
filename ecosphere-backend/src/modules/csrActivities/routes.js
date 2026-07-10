const express = require('express');
const { body } = require('express-validator');
const crudFactory = require('../../utils/crudFactory');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');

const router = express.Router();
const fields = ['title', 'category_id', 'department_id', 'description', 'start_date', 'end_date', 'status'];
const ctrl = crudFactory('csr_activities', fields);

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), [body('title').notEmpty()], validate, ctrl.create);
router.put('/:id', authenticate, authorize('ADMIN', 'MANAGER'), ctrl.update);
router.delete('/:id', authenticate, authorize('ADMIN'), ctrl.remove);

module.exports = router;
