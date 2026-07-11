const express = require('express');
const { body } = require('express-validator');
const crudFactory = require('../../utils/crudFactory');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');

const router = express.Router();
const fields = ['title', 'department_id', 'audit_date', 'auditor', 'scope', 'status'];
const ctrl = crudFactory('audits', fields);

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.post('/', authenticate, authorize('ADMIN', 'AUDITOR'), [body('title').notEmpty()], validate, ctrl.create);
router.put('/:id', authenticate, authorize('ADMIN', 'AUDITOR'), ctrl.update);
router.delete('/:id', authenticate, authorize('ADMIN'), ctrl.remove);

module.exports = router;
