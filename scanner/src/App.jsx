import { useState, useEffect, useCallback } from 'react';
import LoginPage     from './components/LoginPage.jsx';
import DashboardPage from './components/DashboardPage.jsx';
import { getDashboard } from './api.js';

const STORAGE_KEY = 'fidelyzio_auth';

export default function App() {
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? null; }
    catch { return null; }
  });
  const [dashData, setDashData] = useState(null);
  const [dashLoading, setDashLoading] = useState(false);

  const refreshDashboard = useCallback(async (token) => {
    setDashLoading(true);
    try {
      const data = await getDashboard(token);
      setDashData(data);
    } catch (err) {
      // JWT expired
      if (err.message.toLowerCase().includes('token')) {
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
