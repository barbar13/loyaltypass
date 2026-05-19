import { useState, useCallback } from 'react';
import QrReader from './QrReader.jsx';
import { getCard, scanCard } from '../api.js';

const PRESETS = [5, 10, 25, 50];

// phase: 'idle' | 'loading' | 'card' | 'confirming' | 'success' | 'error'
export default function ScannerPage({ merchant, token, onLogout }) {
  const [phase, setPhase]       = useState('idle');
  const [cardData, setCardData] = useState(null);
  const [points, setPoints]     = useState(10);
  const [result, setResult]     = useState(null);
  const [apiError, setApiError] = useState('');
  const [showEnrollQr, setShowEnrollQr] = useState(false);

  const handleScan = useCallback(async (qrCode) => {
    setPhase('loading');
    try {
      const data = await getCard(qrCode);
      setCardData(data);
      setPoints(10);
      setPhase('card');
    } catch (err) {
      setApiError(err.message);
      setPhase('error');
    }
  }, []);

  async function handleConfirm() {
    setPhase('confirming');
    try {
      const data = await scanCard(cardData.card.qr_code, points, token);
      setResult({ updatedCard: data.card, pointsAdded: data.points_added });
      setPhase('success');
      setTimeout(resetToIdle, 3000);
    } catch (err) {
      setApiError(err.message);
      setPhase('error');
    }
  }

  function resetToIdle() {
    setPhase('idle');
    setCardData(null);
    setResult(null);
    setApiError('');
  }

  const isScanning = phase === 'idle';
  const enrollQrUrl = `/api/merchants/${merchant.id}/enroll-qr`;

  return (
    <div className="min-h-dvh bg-[#0f0f14] flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-safe-top pb-4 pt-6">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: merchant.color || '#6366f1' }}
          >
            {merchant.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">{merchant.name}</p>
            <p className="text-gray-500 text-xs">Scanner de fidélité</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Enrollment QR button */}
          <button
            onClick={() => setShowEnrollQr(true)}
            title="QR d'inscription client"
            className="flex items-center gap-1.5 text-gray-400 hover:text-white active:opacity-70 transition text-sm px-2 py-1 rounded-lg hover:bg-white/5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75V16.5ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
            </svg>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white active:opacity-70 transition text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            Déconnexion
          </button>
        </div>
      </header>

      {/* ── Camera + states ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col px-5 pb-6">
        <div className="relative">
          <QrReader active={isScanning} onScan={handleScan} />
          {phase === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl backdrop-blur-sm animate-fade-in">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-300 text-sm">Chargement…</span>
              </div>
            </div>
          )}
        </div>

        {isScanning && (
          <p className="text-center text-gray-500 text-sm mt-4 animate-fade-in">
            Pointez vers le QR code du client
          </p>
        )}

        {phase === 'success' && result && (
          <div className="flex-1 flex flex-col items-center justify-center mt-6 animate-scale-in">
            <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-white">+{result.pointsAdded} points</p>
            <p className="text-gray-400 mt-1 text-sm">
              Total : <span className="text-white font-semibold">{result.updatedCard.points} pts</span>
            </p>
            <p className="text-gray-600 text-xs mt-4">Retour au scanner dans 3s…</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center mt-6 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-400 text-center font-medium">{apiError}</p>
            <button onClick={resetToIdle} className="mt-6 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-xl text-white text-sm font-medium transition-all">
              Réessayer
            </button>
          </div>
        )}
      </div>

      {/* ── Card info panel (slide-up) ───────────────────────────────────────── */}
      {(phase === 'card' || phase === 'confirming') && cardData && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in z-10" onClick={resetToIdle} />
          <div className="fixed inset-x-0 bottom-0 z-20 animate-slide-up">
            <div className="bg-gray-900 rounded-t-3xl px-5 pb-safe-bottom pb-8 pt-5 shadow-2xl">
              <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-brand-600/20 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold truncate">
                    {cardData.customer.first_name
                      ? `${cardData.customer.first_name}${cardData.customer.phone ? ' · ' + cardData.customer.phone : ''}`
                      : cardData.customer.email || cardData.customer.phone || 'Client'}
                  </p>
                  {cardData.customer.email && (
                    <p className="text-gray-500 text-xs truncate">{cardData.customer.email}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-white">{cardData.card.points}</p>
                  <p className="text-gray-500 text-xs">points actuels</p>
                </div>
              </div>
              <div className="h-px bg-gray-800 mb-5" />
              <p className="text-gray-400 text-sm font-medium mb-3">Points à ajouter</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {PRESETS.map(p => (
                  <button key={p} onClick={() => setPoints(p)}
                    className={`py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95 ${
                      points === p ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}>
                    +{p}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setPoints(p => Math.max(1, p - 1))}
                  className="w-11 h-11 rounded-2xl bg-gray-800 hover:bg-gray-700 active:scale-90 text-white text-xl font-light flex items-center justify-center transition-all">
                  −
                </button>
                <input type="number" inputMode="numeric" min="1" max="9999" value={points}
                  onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) setPoints(v); }}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-2xl text-center text-white text-lg font-semibold py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
                <button onClick={() => setPoints(p => Math.min(9999, p + 1))}
                  className="w-11 h-11 rounded-2xl bg-gray-800 hover:bg-gray-700 active:scale-90 text-white text-xl font-light flex items-center justify-center transition-all">
                  +
                </button>
              </div>
              <div className="flex gap-3">
                <button onClick={resetToIdle} disabled={phase === 'confirming'}
                  className="flex-1 py-4 rounded-2xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-300 font-semibold transition-all disabled:opacity-50">
                  Annuler
                </button>
                <button onClick={handleConfirm} disabled={phase === 'confirming'}
                  className="flex-[2] py-4 rounded-2xl bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-semibold transition-all disabled:opacity-60 shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2">
                  {phase === 'confirming' ? (
                    <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Envoi…</>
                  ) : (
                    <>Ajouter {points} pts <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Enrollment QR modal ──────────────────────────────────────────────── */}
      {showEnrollQr && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 animate-fade-in" onClick={() => setShowEnrollQr(false)} />
          <div className="fixed inset-x-0 bottom-0 z-40 animate-slide-up">
            <div className="bg-gray-900 rounded-t-3xl px-5 pb-safe-bottom pb-8 pt-5">
              <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />
              <h2 className="text-white font-bold text-lg text-center mb-1">QR d'inscription</h2>
              <p className="text-gray-500 text-sm text-center mb-6">
                Affichez ce code en caisse — vos clients s'inscrivent eux-mêmes
              </p>

              {/* QR code image from API */}
              <div className="flex justify-center mb-5">
                <div className="bg-white p-3 rounded-2xl shadow-xl">
                  <img
                    src={enrollQrUrl}
                    alt="QR code d'inscription"
                    className="w-52 h-52 rounded-lg"
                    onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                  />
                  <div className="hidden w-52 h-52 items-center justify-center text-gray-400 text-xs text-center">
                    Erreur de chargement
                  </div>
                </div>
              </div>

              {/* Enrollment URL */}
              <div className="bg-gray-800 rounded-2xl px-4 py-3 mb-6 text-center">
                <p className="text-gray-500 text-xs mb-1">Lien d'inscription</p>
                <p className="text-gray-300 text-xs font-mono break-all">
                  {window.location.origin}/enroll/{merchant.id}
                </p>
              </div>

              <button
                onClick={() => setShowEnrollQr(false)}
                className="w-full py-4 rounded-2xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-300 font-semibold transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
