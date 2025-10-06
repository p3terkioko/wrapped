const { PrismaClient } = require('../generated/prisma/edge');
const { withAccelerate } = require('@prisma/extension-accelerate');

const globalForPrisma = globalThis;

let prisma;

try {
  prisma = globalForPrisma.prisma || new PrismaClient().$extends(withAccelerate());
  
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
  }
  
  console.log('✅ Prisma client initialized successfully');
} catch (error) {
  console.error('❌ Prisma client initialization failed:', error.message);
  prisma = null;
}

module.exports = { prisma };