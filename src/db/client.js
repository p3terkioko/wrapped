// Prisma singleton — returns null if DATABASE_URL is not configured
'use strict';

const { env } = require('../config/env');

let prisma = null;

function getPrismaClient() {
  if (!env.DATABASE_URL) return null;
  try {
    const { PrismaClient } = require('../../generated/prisma/edge');
    const { withAccelerate } = require('@prisma/extension-accelerate');
    return new PrismaClient().$extends(withAccelerate());
  } catch (err) {
    console.warn('Prisma init failed:', err.message);
    return null;
  }
}

prisma = getPrismaClient();

module.exports = { prisma };
