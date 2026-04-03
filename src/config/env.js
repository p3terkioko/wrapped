// Environment variable validation and normalisation
'use strict';

function required(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

function optional(name, fallback = '') {
  return process.env[name] || fallback;
}

const env = {
  SPOTIFY_CLIENT_ID:     required('SPOTIFY_CLIENT_ID'),
  SPOTIFY_CLIENT_SECRET: required('SPOTIFY_CLIENT_SECRET'),
  SPOTIFY_REFRESH_TOKEN: optional('SPOTIFY_REFRESH_TOKEN'),
  REDIRECT_URI:          optional('REDIRECT_URI', 'http://localhost:3000/auth/callback'),

  // Support both DEFAULT_PLAYLIST_ID (legacy .env) and SPOTIFY_PLAYLIST_ID
  SPOTIFY_PLAYLIST_ID:   optional('SPOTIFY_PLAYLIST_ID') || optional('DEFAULT_PLAYLIST_ID', '1BZY7mhShLhc2fIlI6uIa4'),

  ADMIN_PASSWORD:        optional('ADMIN_PASSWORD', 'admin123'),
  CRON_SECRET:           optional('CRON_SECRET'),
  DATABASE_URL:          optional('DATABASE_URL'),
  NODE_ENV:              optional('NODE_ENV', 'development'),
  PORT:                  parseInt(optional('PORT', '3000'), 10),
  ENABLE_SCHEDULER:      optional('ENABLE_SCHEDULER') === 'true',
};

module.exports = { env };
