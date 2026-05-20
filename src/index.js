require('dotenv').config();
const express = require('express');
const path    = require('path');
const fs      = require('fs');

const merchantRoutes = require('./routes/merchants');
const cardRoutes     = require('./routes/cards');
const adminRoutes    = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ─── Static directories ───────────────────────────────────────────────────────
const PUBLIC       = path.join(__dirname, '../public');
const SCANNER_DIST = path.join(__dirname, '../scanner/dist');

// /enroll/:merchantId — self-enrollment page
app.get('/enroll/:merchantId', (_req, res) => res.sendFile(path.join(PUBLIC, 'enroll.html')));

// /admin — platform owner dashboard
app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC, 'admin.html')));

// /register — new merchant registration
app.get('/register', (_req, res) => res.sendFile(path.join(PUBLIC, 'register.html')));

// ─── API ─────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'LoyaltyPass API' }));
app.use('/api/merchants', merchantRoutes);
app.use('/api/cards',     cardRoutes);
app.use('/api/admin',     adminRoutes);

// ─── Scanner SPA (production build) ──────────────────────────────────────────
app.use(express.static(SCANNER_DIST));

// JSON 404 for unmatched /api/* routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route introuvable' }));

// SPA fallback for all other routes (scanner React app)
app.get('*', (_req, res) => {
  const index = path.join(SCANNER_DIST, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(404).send('Scanner not built. Run: npm run build');
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`LoyaltyPass API démarrée sur http://localhost:${PORT}`);
});

module.exports = app;
