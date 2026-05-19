const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}

export function login(email, password) {
  return request('/merchants/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function getCard(qrCode) {
  return request(`/cards/${qrCode}`);
}

export function scanCard(qrCode, points, token) {
  return request('/cards/scan', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ qr_code: qrCode, points }),
  });
}
