import { useState, useCallback, useRef } from 'react';
import QrReader from './QrReader.jsx';
import { lookupCustomer, scanCustomer, redeemReward } from '../api.js';

const IcoGift = ({ s = 24 }) => (
  <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
  </svg>
);

// ── Numeric keypad ─────────────────────────────────────────────────────────────
function PointsKeypad({ onConfirm, onBack, confirming }) {
  const [display, setDisplay] = useState('');
  const pts     = parseInt(display) || 0;
  const canSend = pts >= 1 && pts <= 9999;

  function press(key) {
    if (key === '⌫') { setDisplay(d => d.slice(0, -1)); return; }
    if (typeof key === 'number') { setDisplay(String(key)); return; } // preset: SET
    setDisplay(d => {
      if (d.length >= 4) return d;
      const next = d === '0' ? key : d + key;
      return next.replace(/^0+(\d)/, '$1');
    });
  }

  const KB = 'h-[60px] flex items-center justify-center rounded-2xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-white font-bold text-2xl transition-all select-none cursor-pointer';

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-gray-800 rounded-2xl px-5 py-4 flex items-center justify-between">
        <button onClick={onBack} className="text-gray-500 hover:text-white text-sm transition-colors">← Retour</button>
        <span className="text-4xl font-black text-white tracking-tight">{display || '0'}</span>
        <span className="text-gray-500 text-sm">pts</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[5, 10, 20, 50].map(v => (
          <button key={v} onClick={() => press(v)}
            className="h-12 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/30 border border-indigo-500/20 text-indigo-300 font-bold text-sm active:scale-95 transition-all">
            +{v}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[7,8,9,4,5,6,1,2,3].map(n => (
          <button key={n} onClick={() => press(String(n))} className={KB}>{n}</button>
        ))}
        <button onClick={() => press('⌫')} className={`${KB} text-lg text-gray-400`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.374-6.375a1.125 1.125 0 0 1 0-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33Z"/>
          </svg>
        </button>
        <button onClick={() => press('0')} className={KB}>0</button>
        <div />
      </div>
      <button onClick={() => canSend && onConfirm(pts)} disabled={!canSend || confirming}
        className="h-[60px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20">
        {confirming
          ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Ajout…</>
          : <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>Ajouter {pts} point{pts > 1 ? 's' : ''}</>}
      </button>
    </div>
  );
}

// ── Stamp panel ────────────────────────────────────────────────────────────────
function StampPanel({ onStamp, onBack, stamping }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-gray-500 hover:text-white text-sm transition-colors">← Retour</button>
        <span className="text-gray-400 text-sm">1 tampon par visite</span>
      </div>
      <button onClick={onStamp} disabled={stamping}
        className="w-full py-7 rounded-2xl font-black text-xl text-white active:scale-[0.97] disabled:opacity-50 transition-all flex items-center justify-center gap-3"
        style={{ background: stamping ? '#374151' : 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: stamping ? 'none' : '0 16px 48px rgba(245,158,11,.35)' }}>
        {stamping
          ? <><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>En cours…</>
          : <><svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>Tamponner</>}
      </button>
    </div>
  );
}

// ── Main ScanModal ─────────────────────────────────────────────────────────────
// phases: scanning → loading → choice → (keypad|stamp) → confirming
//         → success | reward → redeeming → redeemed
//         | fraud | error
export default function ScanModal({ token, onClose, onRefresh, cameraStream }) {
  const [phase,        setPhase]        = useState('scanning');
  const [inputMode,    setInputMode]    = useState(null);   // 'points' | 'stamps'
  const [previewData,  setPreview]      = useState(null);
  const [result,       setResult]       = useState(null);
  const [redeemResult, setRedeemResult] = useState(null);
  const [errMsg,       setErrMsg]       = useState('');

  const scannedQrRef = useRef('');
  const forceRef     = useRef(false);
  const camActive    = phase === 'scanning';

  function reset() {
    scannedQrRef.current = '';
    forceRef.current = false;
    setPhase('scanning');
    setInputMode(null);
    setPreview(null);
    setResult(null);
    setRedeemResult(null);
    setErrMsg('');
  }

  const handleScan = useCallback(async (qrCode) => {
    scannedQrRef.current = qrCode;
    setPhase('loading');
    try {
      const data = await lookupCustomer(qrCode, token);
      setPreview(data);
      if (data.already_scanned_today) {
        setPhase('fraud');
      } else {
        setPhase('choice');
      }
    } catch (err) {
      setErrMsg(err.message);
      setPhase('error');
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm(type, pts) {
    setPhase('confirming');
    try {
      const data = await scanCustomer(scannedQrRef.current, pts, token, type, forceRef.current);
      setResult(data);
      const unlocked = (data.rewards || []).filter(r => {
        if (r.mechanic === 'stamps') return (data.membership.stamps_count ?? 0) >= r.points_required;
        return data.membership.points >= r.points_required;
      });
      if (unlocked.length > 0) {
        setPhase('reward');
      } else {
        setPhase('success');
        setTimeout(() => { onRefresh?.(); reset(); }, 1600);
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
      setTimeout(() => { onRefresh?.(); reset(); }, 2500);
    } catch (err) {
      setErrMsg(err.message);
      setPhase('reward');
    }
  }

  const inReward   = phase === 'reward' || phase === 'redeeming';
  const showPanel  = ['choice', 'keypad', 'stamp', 'confirming'].includes(phase);

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f14] flex flex-col">
      <header className="flex items-center justify-between px-5 pt-safe-top pb-4 pt-5 shrink-0">
        <h2 className="text-white font-semibold text-base">
          {inReward ? 'Récompense client' : 'Scanner un client'}
        </h2>
        <button onClick={onClose}
          className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-90 flex items-center justify-center transition-all text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/>
          </svg>
        </button>
      </header>

      {/* Camera — always mounted for iOS stream persistence */}
      <div className={`flex-1 flex flex-col px-5 ${(inReward || phase === 'redeemed') ? 'hidden' : ''}`}>
        <div className="relative">
          <QrReader active={camActive} onScan={handleScan} stream={cameraStream} />
          {phase === 'loading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-300 text-sm">Recherche du client…</span>
              </div>
            </div>
          )}
        </div>

        {phase === 'scanning' && (
          <p className="text-center text-gray-500 text-sm mt-4">Pointez vers le QR code du client</p>
        )}

        {/* Success flash */}
        {phase === 'success' && result && (
          <div className="flex-1 flex flex-col items-center justify-center mt-6 gap-4 animate-scale-in">
            <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
              </svg>
            </div>
            <div className="text-center">
              {result.type === 'stamps'
                ? <p className="text-2xl font-black text-white">+1 tampon</p>
                : <p className="text-3xl font-black text-white">+{result.points_added} pts</p>}
              <p className="text-gray-400 mt-1 text-sm">
                {result.customer.first_name} · {result.membership.points} pts · {result.membership.stamps_count ?? 0} tampons
              </p>
            </div>
            <p className="text-gray-600 text-xs">Scanner suivant…</p>
          </div>
        )}

        {/* Fraud — avertissement + possibilité de forcer */}
        {phase === 'fraud' && previewData && (
          <div className="flex-1 flex flex-col items-center justify-center mt-6 gap-5 px-2 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-amber-500/15 flex items-center justify-center">
              <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-amber-400 font-semibold text-base">Déjà scanné aujourd'hui</p>
              <p className="text-gray-400 text-sm mt-1">
                {previewData.customer.first_name} a déjà reçu des points ou un tampon chez vous aujourd'hui.
              </p>
            </div>
            <div className="w-full flex flex-col gap-2.5">
              <button
                onClick={() => { forceRef.current = true; setPhase('choice'); }}
                className="w-full py-4 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-300 font-semibold text-sm active:scale-[0.98] transition-all">
                Scanner quand même
              </button>
              <button
                onClick={reset}
                className="w-full py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-400 font-semibold text-sm active:scale-[0.98] transition-all">
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center mt-6 gap-5 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/>
              </svg>
            </div>
            <p className="text-red-400 text-center font-medium px-4">{errMsg}</p>
            <button onClick={reset} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white text-sm font-semibold transition-all">Réessayer</button>
          </div>
        )}
      </div>

      {/* Reward overlay */}
      {inReward && result && (() => {
        const unlocked = (result.rewards || []).filter(r => {
          if (r.mechanic === 'stamps') return (result.membership.stamps_count ?? 0) >= r.points_required;
          return result.membership.points >= r.points_required;
        });
        return (
          <div className="flex-1 flex flex-col px-5 pb-safe-bottom pb-6 overflow-y-auto animate-fade-in">
            <div className="text-center pb-5 border-b border-white/5 mb-5">
              <div className="flex justify-center mb-3 text-amber-400"><IcoGift s={48} /></div>
              <h2 className="text-white font-black text-2xl">Récompense disponible !</h2>
              <p className="text-gray-400 text-sm mt-2">{result.customer.first_name}</p>
              <p className="text-white font-semibold text-sm mt-1">
                {result.membership.points} pts · {result.membership.stamps_count ?? 0} tampons
              </p>
            </div>
            {errMsg && <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 mb-4 text-red-400 text-sm">{errMsg}</div>}
            <div className="space-y-3 flex-1">
              {unlocked.map(r => (
                <div key={r.id} className="bg-gray-900 border border-amber-400/25 rounded-2xl overflow-hidden">
                  <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center text-amber-400 shrink-0"><IcoGift s={22} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-base">{r.description}</p>
                      <p className="text-amber-400/80 text-xs mt-0.5">
                        {r.points_required} {r.mechanic === 'stamps' ? 'tampons' : 'pts'} requis
                      </p>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <button onClick={() => handleRedeem(r)} disabled={phase === 'redeeming'}
                      className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                      {phase === 'redeeming'
                        ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Offre en cours…</>
                        : 'Offrir cette récompense →'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => { onRefresh?.(); reset(); }} disabled={phase === 'redeeming'}
              className="w-full py-4 rounded-2xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-400 font-semibold text-sm mt-4 transition-all disabled:opacity-40">
              Ignorer pour cette fois
            </button>
          </div>
        );
      })()}

      {/* Redeemed flash */}
      {phase === 'redeemed' && redeemResult && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 gap-5 animate-scale-in">
          <div className="w-24 h-24 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400"><IcoGift s={52} /></div>
          <div className="text-center">
            <p className="text-white font-black text-2xl">Récompense offerte !</p>
            <p className="text-amber-300 font-semibold text-lg mt-1">{redeemResult.reward.description}</p>
            <p className="text-gray-400 text-sm mt-3">{redeemResult.customer.first_name}</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-3 text-center">
            <p className="text-red-400 font-semibold">−{redeemResult.points_deducted} {redeemResult.reward?.mechanic === 'stamps' ? 'tampons' : 'pts'} déduits</p>
          </div>
          <p className="text-gray-600 text-xs">Scanner suivant…</p>
        </div>
      )}

      {/* Customer panel */}
      {showPanel && previewData && (
        <>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-10" onClick={reset} />
          <div className="fixed inset-x-0 bottom-0 z-20 animate-slide-up max-h-[92vh] overflow-y-auto">
            <div className="bg-gray-900 rounded-t-3xl px-5 pb-safe-bottom pb-6 pt-5 shadow-2xl">
              <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />

              {/* Customer info */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold">
                    {previewData.customer.first_name}
                    {previewData.customer.phone ? <span className="text-gray-500 font-normal"> · {previewData.customer.phone}</span> : null}
                  </p>
                  {previewData.is_new_customer && <p className="text-indigo-400 text-xs font-medium">Nouveau client</p>}
                </div>
                {/* Balances */}
                <div className="flex gap-3 shrink-0">
                  <div className="text-right">
                    <p className="text-xl font-black text-white leading-none">{previewData.membership.points ?? 0}</p>
                    <p className="text-gray-600 text-[10px] uppercase tracking-wide">pts</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-amber-400 leading-none">{previewData.membership.stamps_count ?? 0}</p>
                    <p className="text-gray-600 text-[10px] uppercase tracking-wide">tamp.</p>
                  </div>
                </div>
              </div>

              <div className="h-px bg-gray-800 mb-5" />

              {/* Phase: choice */}
              {phase === 'choice' && (
                <div className="flex flex-col gap-3">
                  <button onClick={() => { setInputMode('points'); setPhase('keypad'); }}
                    className="w-full py-5 rounded-2xl bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/25 text-white font-bold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5M9 15h.008v.008H9V15Zm3 0h.008v.008H12V15Zm3 0h.008v.008H15V15Z"/>
                    </svg>
                    Ajouter des points
                  </button>
                  <button onClick={() => { setInputMode('stamps'); setPhase('stamp'); }}
                    className="w-full py-5 rounded-2xl font-bold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                    </svg>
                    Ajouter un tampon
                  </button>
                  <button onClick={reset} className="text-gray-600 text-sm text-center py-2 hover:text-gray-400 transition-colors">Annuler</button>
                </div>
              )}

              {/* Phase: keypad */}
              {(phase === 'keypad' || (phase === 'confirming' && inputMode === 'points')) && (
                <PointsKeypad
                  onConfirm={pts => handleConfirm('points', pts)}
                  onBack={() => setPhase('choice')}
                  confirming={phase === 'confirming'}
                />
              )}

              {/* Phase: stamp */}
              {(phase === 'stamp' || (phase === 'confirming' && inputMode === 'stamps')) && (
                <StampPanel
                  onStamp={() => handleConfirm('stamps', 1)}
                  onBack={() => setPhase('choice')}
                  stamping={phase === 'confirming'}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
