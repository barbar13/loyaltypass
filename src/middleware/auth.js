const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant ou invalide' });
  }

  const token = header.slice(7);
  try {
    req.merchant = jwt.verify(token, process.env.JWT_SECRET || 'loyaltypass_dev_secret_change_in_prod');
    next();
  } catch {
    res.status(401).json({ error: 'Token expiré ou invalide' });
  }
}

module.exports = authMiddleware;
