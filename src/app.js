'use strict';

const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const path         = require('path');

const { env }          = require('./config/env');
const publicRoutes     = require('./routes/public');
const adminRoutes      = require('./routes/admin');
const spotify          = require('./services/spotify');
const { prisma }       = require('./db/client');
const { readPayload }  = require('./services/payloads');
const { renderPage, renderUnavailable } = require('./views/page');
const { renderDashboard } = require('./views/dashboard');
const { errorHandler, asyncHandler } = require('./middleware/errorHandler');

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({
  origin: env.NODE_ENV === 'production' ? 'https://wrapped-beige.vercel.app' : 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
// Static files (on Vercel the CDN serves public/ directly; this is for local runs).
app.use(express.static(path.join(__dirname, '../public'), { index: false }));

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api/public', publicRoutes);
app.use('/api/admin',  adminRoutes);

// ── Auth routes (used once to obtain a Spotify refresh token) ──────────────────
app.get('/auth/login', (req, res) => {
  const state = Math.random().toString(36).substring(2, 15);
  res.cookie('oauth_state', state, { httpOnly: true, secure: env.NODE_ENV === 'production', maxAge: 600000 });
  res.redirect(spotify.getAuthURL(state));
});

app.get('/auth/callback', asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  const storedState     = req.cookies?.oauth_state;
  if (!code)                  return res.redirect('/?error=no_code');
  if (state !== storedState)  return res.redirect('/?error=state_mismatch');
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
  res.json({ authenticated: !!req.cookies?.spotify_access_token });
});

// ── Admin page ─────────────────────────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// ── The Crate: the dashboard page, reached from the end of the film ───────────
app.get('/dashboard', asyncHandler(async (req, res) => {
  const film = prisma ? await readPayload(prisma, 'film').catch(() => null) : null;
  res.set('Content-Type', 'text/html; charset=utf-8');
  if (!film) { res.set('Cache-Control', 'no-store'); return res.status(503).send(renderUnavailable()); }
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'wrapped-beige.vercel.app';
  res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400');
  res.send(renderDashboard({ ...film.data, version: film.version }, { url: `https://${host}/dashboard` }));
}));

// ── The film: server-rendered from the precomputed payload. Every other path
// (old links, shared URLs) lands here too. ─────────────────────────────────────
app.get('*', asyncHandler(async (req, res) => {
  const film = prisma ? await readPayload(prisma, 'film').catch(() => null) : null;
  res.set('Content-Type', 'text/html; charset=utf-8');
  if (!film) {
    res.set('Cache-Control', 'no-store');
    return res.status(503).send(renderUnavailable());
  }
  const me = typeof req.query.me === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(req.query.me) ? req.query.me : null;
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'wrapped-beige.vercel.app';
  const url = `https://${host}${req.originalUrl.split('#')[0]}`;
  // A minute at the CDN, so a refresh (and the day's new song) shows up fast.
  res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400');
  res.send(renderPage({ ...film.data, version: film.version }, { url, me }));
}));

// ── Global error handler ───────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
