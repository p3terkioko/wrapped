'use strict';

const { env } = require('../config/env');
const { AppError } = require('./errorHandler');

function adminAuth(req, res, next) {
  const password = req.body?.password || req.headers['x-admin-password'];
  if (!password || password !== env.ADMIN_PASSWORD) {
    return next(new AppError(401, 'Unauthorized'));
  }
  next();
}

module.exports = { adminAuth };
