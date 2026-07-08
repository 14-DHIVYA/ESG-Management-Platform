const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new ApiError(401, 'Missing or invalid Authorization header'));
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.user = payload; // { id, role, departmentId }
    next();
  } catch (err) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'Not authenticated'));
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }
    next();
  };
}

module.exports = { authenticate, authorize };
