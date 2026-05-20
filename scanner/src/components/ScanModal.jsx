import { useState, useCallback, useRef } from 'react';
import QrReader from './QrReader.jsx';
import { lookupCustomer, scanCustomer } from '../api.js';

const PRESETS = [5, 10, 25, 50];

// phase: 'scanning' | 'loading' | 'preview' | 'confirming' | 'success' | 'error' | 'fraud'
export default function ScanModal({ token, onClose, onSuccess }) {
  const [phase, setPhase]         = useState('scanning');
  const [previewData, setPreview] = useState(null);
  const [points, setPoints]       = useState(10);
  const [result, setResult]       = useState(null);
  const [errMsg, setErrMsg]       = useState('');

  // useRef instead of useState: always holds the current value regardless of
  // render cycles, so handleConfirm never reads a stale closure copy.
  const scannedQrRef = useRef('');

  const handleScan = useCallback(async (qrCode) => {
    console.log('[ScanModal] QR scanned:', qrCode);
    scannedQrRef.current = qrCode;
    setPhase('loading');
    try {
      const data = await lookupCustomer(qrCode, token);
      console.log('[ScanModal] lookup ok, already_scanned_today:', data.already_scanned_today);
      if (data.already_scanned_today) {
        setPreview(data);
        setPhase('fraud');
      } else {
        setPreview(data);
        setPoints(10);
        setPhase('preview');
      }
    } catch (err) {
      console.error('[ScanModal] lookup error:', err.message);
      setErrMsg(err.message);
      setPhase('error');
    }
  }, [token]);

  async function handleConfirm() {
    const qrCode = scannedQrRef.current;
    console.log('[ScanModal] confirm clicked — qrCode:', qrCode, 'points:', points);
    setPhase('confirming');
    try {
      const data = await scanCustomer(qrCode, points, token);
      console.log('[ScanModal] scan success:', data);
      setResult(data);
      setPhase('success');
      setTimeout(() => { onSuccess(); }, 2500);
    } catch (err) {
      console.error('[ScanModal] scan error:', err.message);
      setErrMsg(err.message);
      setPhase('error');
    }
  }

  function reset() {
    scannedQrRef.current = '';
    setPhase('scanning');
    setPreview(null);
    setResult(null);
    setErrMsg('');
  }

  const isScanning = phase === 'scanning';
  const showPanel  = phase === 'preview' || phase === 'confirming';

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f14] flex flex-col">

      {/* Top bar */}
      <header className="flex items-center justify-between px-5 pt-safe-top pb-4 pt-5">
        <h2 className="text-white font-semibold text-base">Scanner un client</h2>
        <button onClick={onClose}
          className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-90 flex items-center justify-center transition-all text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Camera */}
      <div className="flex-1 flex flex-col px-5">
        <div className="relative">
          <QrReader active={isScanning} onScan={handleScan} />

          {phase === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-300 text-sm">Recherche du client…</span>
              </div>
            </div>
          )}
        </div>

        {isScanning && (
          <p className="text-center text-gray-500 text-sm mt-4 animate-fade-in">
            Pointez vers le QR code du client
          </p>
        )}

        {/* Success */}
        {phase === 'success' && result && (
          <div className="flex-1 flex flex-col items-center justify-center mt-6 animate-scale-in gap-4">
            <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-3xl font-black text-white">+{result.points_added} pts</p>
              <p className="text-gray-400 mt-1 text-sm">
                {result.customer.first_name} · Total{' '}
                <span className="text-white font-semibold">{result.membership.points} pts</span>
              </p>
            </div>
            {result.rewards?.some(r => result.membership.points >= r.points_required) && (
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-4 py-3 text-center">
                <p className="text-emerald-400 text-sm font-semibold">🎁 Récompense disponible !</p>
                {result.rewards.filter(r => result.membership.points >= r.points_required).map(r => (
                  <p key={r.id} className="text-emerald-300 text-xs mt-1">{r.description} ({r.points_required} pts)</p>
                ))}
              </div>
            )}
            <p className="text-gray-700 text-xs">Fermeture automatique…</p>
          </div>
        )}

        {/* Anti-fraud: already scanned today */}
        {phase === 'fraud' && previewData && (
          <div className="flex-1 flex flex-col items-center justify-center mt-6 animate-fade-in gap-5">
            <div className="w-20 h-20 rounded-full bg-amber-500/15 flex items-center justify-center">
              <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-amber-400 font-semibold text-base">Déjà scanné aujourd'hui</p>
              <p className="text-gray-400 text-sm mt-1">
                {previewData.customer.first_name} a déjà reçu des points chez vous aujourd'hui.
              </p>
              <p className="text-gray-600 text-xs mt-2">
                Points actuels : {previewData.membership.points} pts
              </p>
            </div>
            <button onClick={reset}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white text-sm font-semibold transition-all">
              Scanner un autre client
            </button>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center mt-6 animate-fade-in gap-5">
            <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-400 text-center font-medium">{errMsg}</p>
            <button onClick={reset}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white text-sm font-semibold transition-all">
              Réessayer
            </button>
          </div>
        )}
      </div>

      {/* Customer info panel (slide up from bottom) */}
      {showPanel && previewData && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-10" onClick={reset} />
          <div className="fixed inset-x-0 bottom-0 z-20 animate-slide-up">
            <div className="bg-gray-900 rounded-t-3xl px-5 pb-safe-bottom pb-8 pt-5 shadow-2xl">
              <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />

              {/* Customer info */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold">
                    {previewData.customer.first_name}
                    {previewData.customer.phone ? <span className="text-gray-500 font-normal"> · {previewData.customer.phone}</span> : null}
                  </p>
                  {previewData.is_new_customer && (
                    <p className="text-brand-500 text-xs font-medium">Nouveau client 🎉</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-white leading-none">{previewData.membership.points}</p>
                  <p className="text-gray-500 text-xs">pts actuels</p>
                </div>
              </div>

              <div className="h-px bg-gray-800 mb-5" />

              {/* Points selector */}
              <p className="text-gray-400 text-sm font-medium mb-3">Points à ajouter</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {PRESETS.map(p => (
                  <button key={p} onClick={() => setPoints(p)}
                    className={`py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95 ${
                      points === p
                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
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

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={reset} disabled={phase === 'confirming'}
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
    </div>
  );
}
