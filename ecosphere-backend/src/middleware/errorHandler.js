const ApiError = require('../utils/ApiError');

function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details || undefined,
    });
  }

  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Duplicate value violates a unique constraint', details: err.detail });
  }
  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Invalid reference to related record', details: err.detail });
  }
  if (err.code === '23514' || err.code === '23502') {
    return res.status(400).json({ success: false, message: 'Invalid value provided', details: err.detail || err.column });
  }

  console.error(err);
  return res.status(500).json({ success: false, message: 'Internal server error' });
}

module.exports = errorHandler;
