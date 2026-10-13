// Prisma singleton — returns null if DATABASE_URL is not configured.
// Production uses Prisma Postgres through Accelerate (prisma+postgres:// or
// prisma://), which needs the edge client. Local development uses a plain
// postgres:// URL (see scripts/dev-db.mjs), which needs the standard client.
'use strict';

const { env } = require('../config/env');

function getPrismaClient() {
  const url = env.DATABASE_URL;
  if (!url) return null;
  try {
    if (/^prisma(\+postgres)?:\/\//.test(url)) {
      const { PrismaClient } = require('../../generated/prisma/edge');
      const { withAccelerate } = require('@prisma/extension-accelerate');
      return new PrismaClient().$extends(withAccelerate());
    }
    const { PrismaClient } = require('../../generated/prisma');
    return new PrismaClient();
  } catch (err) {
    console.warn('Prisma init failed:', err.message);
    return null;
  }
}

const prisma = getPrismaClient();

module.exports = { prisma };
