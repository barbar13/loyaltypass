require('dotenv').config();
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const QRCode  = require('qrcode');

const merchantRoutes  = require('./routes/merchants');
const customerRoutes  = require('./routes/customers');
const scanRoutes      = require('./routes/scan');
const adminRoutes     = require('./routes/admin');

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

// ─── Static pages ─────────────────────────────────────────────────────────────
const PUBLIC       = path.join(__dirname, '../public');
const SCANNER_DIST = path.join(__dirname, '../scanner/dist');

app.get('/enroll/:merchantId',  (_req, res) => res.sendFile(path.join(PUBLIC, 'enroll.html')));
app.get('/card/:qrCode',        (_req, res) => res.sendFile(path.join(PUBLIC, 'card.html')));
app.get('/my-card',             (_req, res) => res.sendFile(path.join(PUBLIC, 'my-card.html')));
app.get('/admin',               (_req, res) => res.sendFile(path.join(PUBLIC, 'admin.html')));
app.get('/login',               (_req, res) => res.sendFile(path.join(PUBLIC, 'login.html')));
app.get('/register',            (_req, res) => res.sendFile(path.join(PUBLIC, 'register.html')));
app.get('/forgot-password',     (_req, res) => res.sendFile(path.join(PUBLIC, 'forgot-password.html')));
app.get('/reset-password',      (_req, res) => res.sendFile(path.join(PUBLIC, 'reset-password.html')));
app.get('/merchant/qr-print',   (_req, res) => res.sendFile(path.join(PUBLIC, 'qr-print.html')));
app.get('/home',                (_req, res) => res.sendFile(path.join(PUBLIC, 'home.html')));
app.get('/cgu',                 (_req, res) => res.sendFile(path.join(PUBLIC, 'cgu.html')));
app.get('/privacy',             (_req, res) => res.sendFile(path.join(PUBLIC, 'privacy.html')));

// ─── Utility: server-side QR PNG (used by enroll + card pages) ───────────────
app.get('/api/qr/:text', async (req, res) => {
  const { text } = req.params;
  if (!text || text.length > 256) return res.status(400).json({ error: 'Invalid text' });
  const size = Math.min(parseInt(req.query.size, 10) || 200, 400);
  try {
    const buf = await QRCode.toBuffer(text, { type: 'png', width: size, margin: 1 });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: 'Erreur QR', detail: err.message });
  }
});

// ─── API ──────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'Fidevo API' }));
app.use('/api/merchants', merchantRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/scan',      scanRoutes);
app.use('/api/admin',     adminRoutes);

// ─── Scanner SPA (merchant dashboard, built by Vite) ─────────────────────────
app.use(express.static(SCANNER_DIST));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Route introuvable' }));

app.get('*', (_req, res) => {
  const index = path.join(SCANNER_DIST, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.status(404).send('Scanner not built. Run: npm run build');
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`LoyaltyPass API démarrée sur http://localhost:${PORT}`);
});

module.exports = app;
