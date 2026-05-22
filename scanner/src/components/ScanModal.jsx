import { useState, useCallback, useRef } from 'react';
import QrReader from './QrReader.jsx';
import { lookupCustomer, scanCustomer, redeemReward } from '../api.js';

const IcoGift = ({ s = 24 }) => (
  <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
  </svg>
);

// ── Numeric keypad for points mechanic ────────────────────────────────────────

function PointsKeypad({ onConfirm, confirming }) {
  const [display, setDisplay] = useState('');

  function press(key) {
    if (key === '⌫') { setDisplay(d => d.slice(0, -1)); return; }
    if (typeof key === 'number') {
      // Preset: SET the display value
      setDisplay(String(key));
      return;
    }
    // Digit: APPEND to compose a custom number
    setDisplay(d => {
      if (d.length >= 4) return d;
      const next = d === '0' ? key : d + key;
      return next.replace(/^0+(\d)/, '$1');
    });
  }

  const pts     = parseInt(display) || 0;
  const canSend = pts >= 1 && pts <= 9999;

  const KEY_BTN = 'flex items-center justify-center rounded-2xl bg-gray-800 hover:bg-gray-700 active:scale-95 text-white font-bold transition-all select-none cursor-pointer';
  const KEY_H   = 'h-[62px] text-2xl'; // large tappable size

  return (
    <div className="flex flex-col gap-3">
      {/* Display */}
      <div className="bg-gray-800 rounded-2xl px-5 py-4 flex items-center justify-between">
        <span className="text-gray-500 text-sm font-medium">Points à ajouter</span>
        <span className="text-4xl font-black text-white tracking-tight leading-none">{display || '0'}</span>
      </div>

      {/* Quick presets */}
      <div className="grid grid-cols-4 gap-2">
        {[5, 10, 20, 50].map(v => (
          <button key={v} onClick={() => press(v)}
            className="h-12 rounded-xl bg-indigo-600/15 hover:bg-indigo-600/30 border border-indigo-500/20 text-indigo-300 font-bold text-sm active:scale-95 transition-all">
            +{v}
          </button>
        ))}
      </div>

      {/* Number grid */}
      <div className="grid grid-cols-3 gap-2">
        {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(n => (
          <button key={n} onClick={() => press(String(n))} className={`${KEY_BTN} ${KEY_H}`}>{n}</button>
        ))}
        {/* Bottom row */}
        <button onClick={() => press('⌫')} className={`${KEY_BTN} ${KEY_H} text-lg text-gray-400`}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.374-6.375a1.125 1.125 0 0 1 0-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33Z"/>
          </svg>
        </button>
        <button onClick={() => press('0')} className={`${KEY_BTN} ${KEY_H}`}>0</button>
        <div /> {/* empty cell */}
      </div>

      {/* Confirm */}
      <button onClick={() => canSend && onConfirm(pts)} disabled={!canSend || confirming}
        className="w-full h-[62px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20">
        {confirming ? (
          <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Ajout en cours…</>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
            Ajouter {pts} point{pts > 1 ? 's' : ''} →
          </>
        )}
      </button>
    </div>
  );
}

// ── Stamp card UI for tampons mechanic ────────────────────────────────────────

function StampPanel({ currentPoints, threshold, onStamp, stamping }) {
  const total  = Math.max(threshold || 10, 1);
  const filled = Math.min(currentPoints, total);
  // Arrange stamps in rows of 5
  const cols   = total <= 5 ? total : 5;
  const rows   = Math.ceil(total / cols);

  return (
    <div className="flex flex-col gap-4">
      {/* Points / stamp count */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm font-medium">Tampons</span>
        <span className="text-white font-black text-xl tabular-nums">{filled}<span className="text-gray-600 font-semibold text-base">/{total}</span></span>
      </div>

      {/* Stamp grid */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '10px' }}>
        {Array.from({ length: total }, (_, i) => {
          const done = i < filled;
          return (
            <div key={i} className={`aspect-square rounded-xl flex items-center justify-center transition-all ${done ? 'bg-amber-500' : 'bg-gray-800 border-2 border-gray-700'}`}>
              {done && (
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* Reward available banner */}
      {filled >= total && (
        <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-2">
          <IcoGift s={16} />
          <span className="text-amber-300 text-sm font-semibold">Récompense disponible !</span>
        </div>
      )}

      {/* Big stamp button */}
      <button onClick={onStamp} disabled={stamping}
        className="w-full py-5 rounded-2xl font-black text-xl text-white active:scale-[0.97] disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-xl"
        style={{ background: stamping ? '#374151' : 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: stamping ? 'none' : '0 16px 40px rgba(245,158,11,0.35)' }}>
        {stamping ? (
          <><svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>En cours…</>
        ) : (
          <>
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
            </svg>
            Tamponner
          </>
        )}
      </button>
    </div>
  );
}

// ── Main ScanModal ────────────────────────────────────────────────────────────

// mechanic: 'points' (keypad) | 'stamps' (stamp card)
// stampThreshold: number of stamps for full card (lowest reward points_required)
export default function ScanModal({ token, onClose, onRefresh, cameraStream, mechanic = 'points', stampThreshold = 10 }) {
  const [phase,        setPhase]        = useState('scanning');
  const [previewData,  setPreview]      = useState(null);
  const [result,       setResult]       = useState(null);
  const [redeemResult, setRedeemResult] = useState(null);
  const [errMsg,       setErrMsg]       = useState('');

  const scannedQrRef = useRef('');
  const camActive    = phase === 'scanning';

  function reset() {
    scannedQrRef.current = '';
    setPhase('scanning');
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
      if (data.already_scanned_today) {
        setPreview(data);
        setPhase('fraud');
        setTimeout(() => reset(), 2500);
      } else {
        setPreview(data);
        setPhase('preview');
      }
    } catch (err) {
      setErrMsg(err.message);
      setPhase('error');
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleConfirm(pts) {
    if (!pts || pts < 1) return;
    setPhase('confirming');
    try {
      const data = await scanCustomer(scannedQrRef.current, pts, token);
      setResult(data);
      const unlocked = (data.rewards || []).filter(r => data.membership.points >= r.points_required);
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

  const inReward  = phase === 'reward' || phase === 'redeeming';
  const showPanel = phase === 'preview' || phase === 'confirming';

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0f14] flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-safe-top pb-4 pt-5 shrink-0">
        <h2 className="text-white font-semibold text-base">
          {inReward ? 'Récompense client' : 'Scanner un client'}
        </h2>
        <button onClick={onClose}
          className="w-9 h-9 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-90 flex items-center justify-center transition-all text-gray-400 hover:text-white">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      {/* Camera area — always mounted to preserve stream on iOS */}
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div className="text-center">
              {mechanic === 'stamps'
                ? <p className="text-2xl font-black text-white">+1 tampon</p>
                : <p className="text-3xl font-black text-white">+{result.points_added} pts</p>}
              <p className="text-gray-400 mt-1 text-sm">
                {result.customer.first_name} · Total{' '}
                <span className="text-white font-semibold">
                  {mechanic === 'stamps'
                    ? `${result.membership.points}/${stampThreshold} tampons`
                    : `${result.membership.points} pts`}
                </span>
              </p>
            </div>
            <p className="text-gray-600 text-xs">Scanner suivant…</p>
          </div>
        )}

        {/* Fraud */}
        {phase === 'fraud' && previewData && (
          <div className="flex-1 flex flex-col items-center justify-center mt-6 gap-5 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-amber-500/15 flex items-center justify-center">
              <svg className="w-10 h-10 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-amber-400 font-semibold text-base">Déjà scanné aujourd'hui</p>
              <p className="text-gray-400 text-sm mt-1">{previewData.customer.first_name} a déjà reçu des points chez vous aujourd'hui.</p>
            </div>
            <p className="text-gray-600 text-xs">Scanner suivant…</p>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center mt-6 gap-5 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-red-500/15 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-400 text-center font-medium px-4">{errMsg}</p>
            <button onClick={reset} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 active:scale-95 rounded-2xl text-white text-sm font-semibold transition-all">
              Réessayer
            </button>
          </div>
        )}
      </div>

      {/* Reward overlay */}
      {inReward && result && (() => {
        const unlocked = (result.rewards || []).filter(r => result.membership.points >= r.points_required);
        return (
          <div className="flex-1 flex flex-col px-5 pb-safe-bottom pb-6 overflow-y-auto animate-fade-in">
            <div className="text-center pb-5 border-b border-white/5 mb-5">
              <div className="flex justify-center mb-3 text-amber-400"><IcoGift s={48} /></div>
              <h2 className="text-white font-black text-2xl">Récompense disponible !</h2>
              <p className="text-gray-400 text-sm mt-2">
                {result.customer.first_name}
                {result.customer.phone ? <span className="text-gray-600"> · {result.customer.phone}</span> : null}
              </p>
              <p className="text-white font-semibold text-lg mt-1">
                {result.membership.points} pts
                <span className="text-emerald-400 font-semibold text-sm ml-2">(+{result.points_added} ajoutés)</span>
              </p>
            </div>
            {errMsg && (
              <div className="bg-red-500/10 border border-red-500/25 rounded-2xl px-4 py-3 mb-4 text-red-400 text-sm">{errMsg}</div>
            )}
            <div className="space-y-3 flex-1">
              {unlocked.map(r => (
                <div key={r.id} className="bg-gray-900 border border-amber-400/25 rounded-2xl overflow-hidden">
                  <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-400/25 flex items-center justify-center text-amber-400 shrink-0"><IcoGift s={22} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-base">{r.description}</p>
                      <p className="text-amber-400/80 text-xs mt-0.5">{r.points_required} pts requis</p>
                    </div>
                  </div>
                  <div className="px-4 pb-4">
                    <button onClick={() => handleRedeem(r)} disabled={phase === 'redeeming'}
                      className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                      {phase === 'redeeming' ? (
                        <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Offre en cours…</>
                      ) : 'Offrir cette récompense →'}
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
          <div className="w-24 h-24 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400">
            <IcoGift s={52} />
          </div>
          <div className="text-center">
            <p className="text-white font-black text-2xl">Récompense offerte !</p>
            <p className="text-amber-300 font-semibold text-lg mt-1">{redeemResult.reward.description}</p>
            <p className="text-gray-400 text-sm mt-3">
              {redeemResult.customer.first_name} · Nouveau solde : <span className="text-white font-semibold">{redeemResult.membership.points} pts</span>
            </p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-3 text-center">
            <p className="text-red-400 font-semibold">−{redeemResult.points_deducted} pts déduits</p>
          </div>
          <p className="text-gray-600 text-xs">Scanner suivant…</p>
        </div>
      )}

      {/* Customer panel — slide up with keypad or stamp UI */}
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
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold">
                    {previewData.customer.first_name}
                    {previewData.customer.phone ? <span className="text-gray-500 font-normal"> · {previewData.customer.phone}</span> : null}
                  </p>
                  {previewData.is_new_customer && (
                    <p className="text-indigo-400 text-xs font-medium">Nouveau client</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-black text-white leading-none">
                    {mechanic === 'stamps' ? previewData.membership.points : previewData.membership.points}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {mechanic === 'stamps' ? 'tampons' : 'pts actuels'}
                  </p>
                </div>
              </div>

              <div className="h-px bg-gray-800 mb-5" />

              {/* Input zone */}
              {mechanic === 'stamps' ? (
                <StampPanel
                  currentPoints={previewData.membership.points}
                  threshold={stampThreshold}
                  onStamp={() => handleConfirm(1)}
                  stamping={phase === 'confirming'}
                />
              ) : (
                <PointsKeypad
                  onConfirm={handleConfirm}
                  confirming={phase === 'confirming'}
                />
              )}

              {/* Cancel link */}
              <button onClick={reset} disabled={phase === 'confirming'}
                className="w-full mt-4 py-3 text-gray-600 text-sm font-medium hover:text-gray-400 transition-colors disabled:opacity-40">
                Annuler
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
