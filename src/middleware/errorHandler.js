'use strict';

class AppError extends Error {
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
  }
}

function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message    = err.isOperational ? err.message : 'Internal server error';

  if (!err.isOperational) console.error(err);

  res.status(statusCode).json({ success: false, error: message });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { AppError, errorHandler, asyncHandler };
