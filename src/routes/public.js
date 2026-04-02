'use strict';

const express        = require('express');
const router         = express.Router();
const { readCache }  = require('../services/cache');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api/public/data
router.get('/data', asyncHandler(async (req, res) => {
  const cached = await readCache();
  if (!cached) {
    return res.status(503).json({ success: false, error: 'Playlist data not yet available. Check back soon.' });
  }
  res.json({ success: true, data: cached.data, lastUpdated: cached.lastUpdated, cached_at: cached.lastUpdated });
}));

// GET /api/public/status
router.get('/status', asyncHandler(async (req, res) => {
  const cached = await readCache();
  res.json({
    success:     true,
    hasData:     !!cached,
    lastUpdated: cached?.lastUpdated || null,
  });
}));

module.exports = router;
