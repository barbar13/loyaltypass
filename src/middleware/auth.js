const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
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
  try {
    req.merchant = jwt.verify(token, secret);
    next();
  } catch {
    res.status(401).json({ error: 'Token expiré ou invalide' });
  }
}

module.exports = authMiddleware;
