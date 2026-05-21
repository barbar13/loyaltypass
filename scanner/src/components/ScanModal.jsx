import { useState, useCallback, useRef } from 'react';
import QrReader from './QrReader.jsx';
import { lookupCustomer, scanCustomer, redeemReward } from '../api.js';

const PRESETS = [5, 10, 25, 50];

const IcoGift = ({ s = 24 }) => (
  <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
  </svg>
);

// phase: 'scanning' | 'loading' | 'preview' | 'confirming'
//        | 'success'   (no reward, auto-closes 2.5s)
//        | 'reward'    (reward available, persistent — merchant must act)
//        | 'redeeming' (POST /api/scan/redeem in progress)
//        | 'redeemed'  (redemption done, auto-closes 3s)
//        | 'fraud' | 'error'
export default function ScanModal({ token, onClose, onSuccess }) {
  const [phase, setPhase]             = useState('scanning');
  const [previewData, setPreview]     = useState(null);
  const [points, setPoints]           = useState(10);
  const [result, setResult]           = useState(null);
  const [redeemResult, setRedeemResult] = useState(null);
  const [errMsg, setErrMsg]           = useState('');

  const scannedQrRef = useRef('');

  const handleScan = useCallback(async (qrCode) => {
    console.log('[ScanModal] QR scanned:', qrCode);
    scannedQrRef.current = qrCode;
    setPhase('loading');
    try {
      const data = await lookupCustomer(qrCode, token);
      if (data.already_scanned_today) {
        setPreview(data);
        setPhase('fraud');
      } else {
        setPreview(data);
        setPoints(10);
        setPhase('preview');
      }
    } catch (err) {
      setErrMsg(err.message);
      setPhase('error');
    }
  }, [token]);

  async function handleConfirm() {
    const qrCode = scannedQrRef.current;
    setPhase('confirming');
    try {
      const data = await scanCustomer(qrCode, points, token);
      setResult(data);
      const unlocked = (data.rewards || []).filter(r => data.membership.points >= r.points_required);
      if (unlocked.length > 0) {
        setPhase('reward');          // persistent — merchant decides whether to redeem
      } else {
        setPhase('success');
        setTimeout(() => onSuccess(), 2500);
      }
    } catch (err) {
      setErrMsg(err.message);
      setPhase('error');
    }
  }

  async function handleRedeem(reward) {
    setErrMsg('');
    setPhase('redeeming');
    try {
      const data = await redeemReward(result.membership.id, reward.id, token);
      setRedeemResult(data);
      setPhase('redeemed');
      setTimeout(() => onSuccess(), 3000);
    } catch (err) {
      setErrMsg(err.message);
      setPhase('reward');      // back to reward modal, error shown inline
    }
  }

  function reset() {
    scannedQrRef.current = '';
    setPhase('scanning');
    setPreview(null);
    setResult(null);
    setRedeemResult(null);
    setErrMsg('');
  }

  const isScanning = phase === 'scanning';
  const showPanel  = phase === 'preview' || phase === 'confirming';
  const inReward   = phase === 'reward'  || phase === 'redeeming';

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f14] flex flex-col">

      {/* Top bar */}
      <header className="flex items-center justify-between px-5 pt-safe-top pb-4 pt-5 shrink-0">
        <h2 className="text-white font-semibold text-base">
          {inReward ? 'Récompense client' : 'Scanner un client'}
        </h2>
        <button onClick={inReward ? () => onSuccess() : onClose}
          className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-90 flex items-center justify-center transition-all text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* ── REWARD MODAL (persistent, replaces camera area) ─────────────────── */}
      {inReward && result && (() => {
        const unlocked = (result.rewards || []).filter(r => result.membership.points >= r.points_required);
        return (
          <div className="flex-1 flex flex-col px-5 pb-safe-bottom pb-6 overflow-y-auto animate-fade-in">

            {/* Customer + points summary */}
            <div className="text-center pb-5 border-b border-white/5 mb-5">
              <div className="flex justify-center mb-3 text-amber-400"><IcoGift s={48} /></div>
              <h2 className="text-white font-black text-2xl leading-tight">Récompense disponible !</h2>
              <p className="text-gray-400 text-sm mt-2">
                {result.customer.first_name}
                {result.customer.phone
                  ? <span className="text-gray-600"> · {result.customer.phone}</span>
                  : null}
              </p>
              <p className="text-white font-semibold text-lg mt-1">
                {result.membership.points} pts
                <span className="text-emerald-400 font-semibold text-sm ml-2">(+{result.points_added} ajoutés)</span>
              </p>
            </div>

            {/* Inline error if redeem failed */}
            {errMsg && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 mb-4 flex items-center gap-2 text-red-400 text-sm">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/>
                </svg>
                {errMsg}
              </div>
            )}

            {/* One card per unlocked reward */}
            <div className="space-y-3 flex-1">
              {unlocked.map(r => (
                <div key={r.id}
                  className="bg-gray-900 border border-amber-400/25 rounded-2xl overflow-hidden">
                  <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center text-amber-400 shrink-0">
                      <IcoGift s={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-base leading-tight">{r.description}</p>
                      <p className="text-amber-400/80 text-xs mt-0.5">{r.points_required} pts requis</p>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => handleRedeem(r)}
                      disabled={phase === 'redeeming'}
                      className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25">
                      {phase === 'redeeming' ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                          </svg>
                          Offre en cours…
                        </>
                      ) : (
                        'Offrir cette récompense →'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Ignore */}
            <button
              onClick={() => onSuccess()}
              disabled={phase === 'redeeming'}
              className="w-full py-4 rounded-2xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-400 hover:text-gray-200 font-semibold text-sm mt-4 transition-all disabled:opacity-40">
              Ignorer pour cette fois
            </button>
          </div>
        );
      })()}

      {/* ── REDEEMED ─────────────────────────────────────────────────────────── */}
      {phase === 'redeemed' && redeemResult && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 animate-scale-in gap-5">
          <div className="w-24 h-24 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400">
            <IcoGift s={52} />
          </div>
          <div className="text-center">
            <p className="text-white font-black text-2xl">Récompense offerte !</p>
            <p className="text-amber-300 font-semibold text-lg mt-1">{redeemResult.reward.description}</p>
            <p className="text-gray-400 text-sm mt-3">
              {redeemResult.customer.first_name} · Nouveau solde :{' '}
              <span className="text-white font-semibold">{redeemResult.membership.points} pts</span>
            </p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-3 text-center">
            <p className="text-red-400 font-semibold">−{redeemResult.points_deducted} pts déduits</p>
          </div>
          <p className="text-gray-700 text-xs">Fermeture automatique…</p>
        </div>
      )}

      {/* ── CAMERA + OTHER STATES ────────────────────────────────────────────── */}
      {!inReward && phase !== 'redeemed' && (
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

          {/* Success (no reward) */}
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
              <p className="text-gray-700 text-xs">Fermeture automatique…</p>
            </div>
          )}

          {/* Anti-fraud */}
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
                <p className="text-gray-600 text-xs mt-2">Points actuels : {previewData.membership.points} pts</p>
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
              <p className="text-red-400 text-center font-medium px-4">{errMsg}</p>
              <button onClick={reset}
                className="px-6 py-3 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white text-sm font-semibold transition-all">
                Réessayer
              </button>
            </div>
          )}
        </div>
      )}

      {/* Customer info panel (slide up from bottom) */}
      {showPanel && previewData && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-10" onClick={reset} />
          <div className="fixed inset-x-0 bottom-0 z-20 animate-slide-up">
            <div className="bg-gray-900 rounded-t-3xl px-5 pb-safe-bottom pb-8 pt-5 shadow-2xl">
              <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />

              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold">
                    {previewData.customer.first_name}
                    {previewData.customer.phone
                      ? <span className="text-gray-500 font-normal"> · {previewData.customer.phone}</span>
                      : null}
                  </p>
                  {previewData.is_new_customer && (
                    <p className="text-brand-500 text-xs font-medium">Nouveau client</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-white leading-none">{previewData.membership.points}</p>
                  <p className="text-gray-500 text-xs">pts actuels</p>
                </div>
              </div>

              <div className="h-px bg-gray-800 mb-5" />

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
                  className="w-11 h-11 rounded-2xl bg-gray-800 hover:bg-gray-700 active:scale-90 text-white text-xl font-light flex items-center justify-center transition-all">−</button>
                <input type="number" inputMode="numeric" min="1" max="9999" value={points}
                  onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) setPoints(v); }}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-2xl text-center text-white text-lg font-semibold py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent" />
                <button onClick={() => setPoints(p => Math.min(9999, p + 1))}
                  className="w-11 h-11 rounded-2xl bg-gray-800 hover:bg-gray-700 active:scale-90 text-white text-xl font-light flex items-center justify-center transition-all">+</button>
              </div>

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
