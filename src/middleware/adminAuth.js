'use strict';

const crypto = require('crypto');
const { env } = require('../config/env');
const { AppError } = require('./errorHandler');

// Constant-time comparison of two secrets of any length.
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function adminAuth(req, res, next) {
  if (!env.ADMIN_PASSWORD) return next(new AppError(503, 'Admin is disabled: ADMIN_PASSWORD is not set'));
  const password = req.headers['x-admin-password'] || req.body?.password;
  if (!password || !safeEqual(password, env.ADMIN_PASSWORD)) return next(new AppError(401, 'Unauthorized'));
  next();
}

// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". Without a configured
// secret every request is rejected, so the endpoint can never run unauthenticated.
function cronAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!env.CRON_SECRET || !token || !safeEqual(token, env.CRON_SECRET)) {
    return next(new AppError(401, 'Unauthorized'));
  }
  next();
}

module.exports = { adminAuth, cronAuth, safeEqual };
