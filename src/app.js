'use strict';

const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const path         = require('path');

const { env }          = require('./config/env');
const publicRoutes     = require('./routes/public');
const adminRoutes      = require('./routes/admin');
const spotify          = require('./services/spotify');
const { errorHandler, asyncHandler, AppError } = require('./middleware/errorHandler');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api/public', publicRoutes);
app.use('/api/admin',  adminRoutes);

// ── Auth routes ────────────────────────────────────────────────────────────────
app.get('/auth/login', (req, res) => {
  const state = Math.random().toString(36).substring(2, 15);
  res.cookie('oauth_state', state, { httpOnly: true, secure: env.NODE_ENV === 'production', maxAge: 600000 });
  res.redirect(spotify.getAuthURL(state));
});

app.get('/auth/callback', asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  const storedState     = req.cookies?.oauth_state;

  if (!code)              return res.redirect('/?error=no_code');
  if (state !== storedState) return res.redirect('/?error=state_mismatch');

  const tokenData = await spotify.getAccessToken(code);
  res.cookie('spotify_access_token', tokenData.access_token,  { httpOnly: true, secure: env.NODE_ENV === 'production', maxAge: tokenData.expires_in * 1000 });
  res.cookie('spotify_refresh_token', tokenData.refresh_token, { httpOnly: true, secure: env.NODE_ENV === 'production', maxAge: 30 * 24 * 3600 * 1000 });
  res.clearCookie('oauth_state');
  res.redirect('/admin?auth=success');
}));

app.get('/auth/logout', (req, res) => {
  res.clearCookie('spotify_access_token');
  res.clearCookie('spotify_refresh_token');
  res.json({ success: true, message: 'Logged out' });
});

app.get('/auth/status', (req, res) => {
  const token = req.cookies?.spotify_access_token;
  res.json({ authenticated: !!token });
});

// ── Named page routes ──────────────────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// ── SPA fallback ───────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Global error handler ───────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
