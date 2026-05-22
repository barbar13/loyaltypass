const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.error || 'Erreur serveur');
    err.status = res.status;
    throw err;
  }
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

export function scanCustomer(customerQrCode, points, token, type = 'points', force = false) {
  const body = JSON.stringify({ customer_qr_code: customerQrCode, points, type, force });
  return request('/scan', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
}

export function addReward(description, pointsRequired, token, mechanic = 'points') {
  return request('/merchants/rewards', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ description, points_required: pointsRequired, mechanic }),
  });
}

export function redeemReward(membershipId, rewardId, token) {
  return request('/scan/redeem', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ membership_id: membershipId, reward_id: rewardId }),
  });
}

export function createCheckout(token) {
  return request('/billing/create-checkout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function updateProfile(data, token) {
  return request('/merchants/profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
}

export function getScans(token, { dateFrom, dateTo, customerId } = {}) {
  const p = new URLSearchParams();
  if (dateFrom)   p.set('date_from', dateFrom);
  if (dateTo)     p.set('date_to', dateTo);
  if (customerId) p.set('customer_id', customerId);
  const qs = p.toString();
  return request(`/merchants/scans${qs ? '?' + qs : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function deleteReward(id, token) {
  return request(`/merchants/rewards/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function sendNotification(token, { title, body, audience }) {
  return request('/merchants/notify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, body, audience }),
  });
}

export function getNotifications(token) {
  return request('/merchants/notifications', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getAnalytics(token, { dateFrom, dateTo } = {}) {
  const p = new URLSearchParams();
  if (dateFrom) p.set('date_from', dateFrom);
  if (dateTo)   p.set('date_to',   dateTo);
  const qs = p.toString();
  return request(`/merchants/analytics${qs ? '?' + qs : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
