const express = require('express');
const { body } = require('express-validator');
const crudFactory = require('../../utils/crudFactory');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');

const router = express.Router();
const fields = ['name', 'description', 'points_required', 'stock', 'status'];
const ctrl = crudFactory('rewards', fields);

router.get('/', authenticate, ctrl.list);
router.get('/:id', authenticate, ctrl.getById);
router.post('/', authenticate, authorize('ADMIN'),
  [body('name').notEmpty(), body('points_required').isInt({ gt: 0 })], validate, ctrl.create);
router.put('/:id', authenticate, authorize('ADMIN'), ctrl.update);
router.delete('/:id', authenticate, authorize('ADMIN'), ctrl.remove);

module.exports = router;
