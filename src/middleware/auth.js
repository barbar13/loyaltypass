const jwt = require('jsonwebtoken');
const db  = require('../database');

async function authMiddleware(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('FATAL: JWT_SECRET is not configured.');
    return res.status(500).json({ error: 'Configuration serveur incorrecte' });
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant ou invalide' });
  }

  const token = header.slice(7);
  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    return res.status(401).json({ error: 'Token expiré ou invalide' });
  }

  // Invalidate tokens that were issued before the last password change.
  // decoded.iat is seconds since epoch; password_changed_at is a DB timestamp.
  try {
    const row = await db.one(
      'SELECT password_changed_at FROM merchants WHERE id = $1',
      [decoded.id]
    );
    if (row?.password_changed_at) {
      const changedAtSec = Math.floor(new Date(row.password_changed_at).getTime() / 1000);
      if (decoded.iat < changedAtSec) {
        return res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
      }
    }
  } catch {
    // DB unavailable — fail open so auth still works; the app would be degraded anyway
  }

  req.merchant = decoded;
  next();
}

module.exports = authMiddleware;
