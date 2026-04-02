'use strict';

const { prisma } = require('../db/client');
const { env }   = require('../config/env');
const { AppError } = require('../middleware/errorHandler');

function ensurePrisma() {
  if (!prisma) throw new AppError(503, 'Database not available');
}

async function readCache() {
  ensurePrisma();
  const row = await prisma.playlistData.findUnique({
    where: { playlistId: env.SPOTIFY_PLAYLIST_ID },
  });
  return row ? { data: row.data, lastUpdated: row.lastUpdated } : null;
}

async function writeCache(insights) {
  ensurePrisma();
  await prisma.playlistData.upsert({
    where:  { playlistId: env.SPOTIFY_PLAYLIST_ID },
    update: { data: insights, lastUpdated: new Date() },
    create: { playlistId: env.SPOTIFY_PLAYLIST_ID, data: insights },
  });
}

async function logUpdate(status, message, tracksCount = null, triggeredBy = 'admin') {
  if (!prisma) return;
  try {
    await prisma.updateLog.create({
      data: { playlistId: env.SPOTIFY_PLAYLIST_ID, status, message, tracksCount, triggeredBy },
    });
  } catch (err) {
    console.warn('Failed to write update log:', err.message);
  }
}

async function getRecentLogs(limit = 20) {
  ensurePrisma();
  return prisma.updateLog.findMany({
    where:   { playlistId: env.SPOTIFY_PLAYLIST_ID },
    orderBy: { createdAt: 'desc' },
    take:    limit,
  });
}

module.exports = { readCache, writeCache, logUpdate, getRecentLogs };
