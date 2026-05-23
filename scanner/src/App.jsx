import { useState, useEffect, useCallback } from 'react';
import LoginPage     from './components/LoginPage.jsx';
import DashboardPage from './components/DashboardPage.jsx';
import { getDashboard } from './api.js';

const STORAGE_KEY = 'fidelyzio_auth';

function isTokenValid(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp * 1000 > Date.now();
  } catch { return false; }
}

export default function App() {
  const [auth, setAuth] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!stored?.token) return null;
      if (!isTokenValid(stored.token)) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return stored;
    } catch { return null; }
  });
  const [dashData, setDashData] = useState(null);
  const [dashLoading, setDashLoading] = useState(false);

  const refreshDashboard = useCallback(async (token) => {
    setDashLoading(true);
    try {
      const data = await getDashboard(token);
      setDashData(data);
    } catch (err) {
      // Only clear session on definitive auth failure (401), not network errors or 500s
      if (err.status === 401) {
        localStorage.removeItem(STORAGE_KEY);
        setAuth(null);
        setDashData(null);
      }
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth) refreshDashboard(auth.token);
  }, [auth, refreshDashboard]);

  function handleLogin(merchant, token) {
    const session = { merchant, token };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAuth(session);
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
    setDashData(null);
  }

  if (!auth) return <LoginPage onLogin={handleLogin} />;

  return (
    <DashboardPage
      auth={auth}
      dashData={dashData}
      dashLoading={dashLoading}
      onLogout={handleLogout}
      onRefresh={() => refreshDashboard(auth.token)}
    />
  );
}
