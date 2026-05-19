import { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage.jsx';
import ScannerPage from './components/ScannerPage.jsx';

const STORAGE_KEY = 'loyaltypass_auth';

export default function App() {
  const [auth, setAuth] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? null;
    } catch {
      return null;
    }
  });

  function handleLogin(merchant, token) {
    const session = { merchant, token };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setAuth(session);
  }

  function handleLogout() {
    localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }

  if (!auth) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <ScannerPage
      merchant={auth.merchant}
      token={auth.token}
      onLogout={handleLogout}
    />
  );
}
