const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
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

export function getDashboard(token) {
  return request('/merchants/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function lookupCustomer(customerQrCode, token) {
  return request(`/scan/lookup/${encodeURIComponent(customerQrCode)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function scanCustomer(customerQrCode, points, token) {
  return request('/scan', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ customer_qr_code: customerQrCode, points }),
  });
}

export function addReward(description, pointsRequired, token) {
  return request('/merchants/rewards', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ description, points_required: pointsRequired }),
  });
}

export function deleteReward(id, token) {
  return request(`/merchants/rewards/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}
