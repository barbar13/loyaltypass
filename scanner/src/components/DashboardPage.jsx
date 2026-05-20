import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import ScanModal  from './ScanModal.jsx';
import { addReward, deleteReward, redeemReward, updateProfile, getScans, createCheckout, getAnalytics } from '../api.js';

Chart.register(...registerables);

// ── Tab icons ─────────────────────────────────────────────────────────────────

const IconHome = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>
);
const IconUsers = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
  </svg>
);
const IconGift = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
  </svg>
);

const IconHistory = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);
const IconChart = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
);
const IconSettings = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtRelative(iso) {
  if (!iso) return null;
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins  <  2) return 'À l\'instant';
  if (mins  < 60) return `Il y a ${mins} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days  <  7) return `Il y a ${days}j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ── Sub-pages ─────────────────────────────────────────────────────────────────

// ── Trial banner ──────────────────────────────────────────────────────────────

function TrialBanner({ merchant, token }) {
  const [loading, setLoading] = useState(false);
  const status   = merchant.subscription_status;
  const days     = merchant.trial_days_left;

  if (status === 'active') return null; // no banner for paying subscribers

  async function handleSubscribe() {
    setLoading(true);
    try {
      const { url } = await createCheckout(token);
      if (url) window.location.href = url;
    } catch (_) { setLoading(false); }
  }

  if (status === 'suspended' || status === 'canceled') {
    return (
      <div className="mx-5 mt-4 mb-1 rounded-2xl bg-red-500/10 border border-red-500/25 px-4 py-4">
        <p className="text-red-400 font-bold text-sm mb-1">Compte suspendu</p>
        <p className="text-red-300/70 text-xs mb-3">Votre abonnement est inactif. Les scans sont bloqués.</p>
        <button onClick={handleSubscribe} disabled={loading}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-sm disabled:opacity-60 transition-all">
          {loading ? 'Redirection…' : 'S\'abonner — 19 €/mois →'}
        </button>
      </div>
    );
  }

  // Trial
  const urgency = days <= 1 ? 'red' : days <= 3 ? 'amber' : 'indigo';
  const colors  = {
    red:    'bg-red-500/10 border-red-500/25 text-red-400',
    amber:  'bg-amber-500/10 border-amber-500/25 text-amber-400',
    indigo: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400',
  };
  const label = days === 0 ? 'Essai expiré aujourd\'hui' : `Essai : encore ${days} jour${days > 1 ? 's' : ''}`;

  return (
    <div className={`mx-5 mt-4 mb-1 rounded-2xl border px-4 py-3 ${colors[urgency]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <button onClick={handleSubscribe} disabled={loading}
          className="shrink-0 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold disabled:opacity-60 transition-all">
          {loading ? '…' : 'S\'abonner'}
        </button>
      </div>
    </div>
  );
}

// ── Onboarding checklist ──────────────────────────────────────────────────────

function OnboardingChecklist({ merchant, stats, rewards }) {
  const key         = `fidevo_ob_${merchant.id}`;
  const printKey    = `fidevo_ob_print_${merchant.id}`;
  const [dismissed, setDismissed]   = useState(() => !!localStorage.getItem(key));
  const [printed,   setPrinted]     = useState(() => !!localStorage.getItem(printKey));

  if (dismissed) return null;

  const hasScanned  = Number(stats?.total_points) > 0;
  const hasRewards  = (rewards || []).filter(r => r.active).length > 0;

  const steps = [
    { id: 'account', done: true,      label: 'Compte créé', desc: 'Vous êtes prêt(e) !' },
    { id: 'print',   done: printed,   label: 'Afficher votre QR en caisse', desc: 'Imprimez votre QR d\'inscription.' },
    { id: 'scan',    done: hasScanned, label: 'Premier scan client', desc: 'Scannez la carte d\'un client.' },
    { id: 'reward',  done: hasRewards, label: 'Créer une récompense', desc: 'Ajoutez votre première récompense fidélité.' },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone   = doneCount === steps.length;

  function markPrinted() { localStorage.setItem(printKey, '1'); setPrinted(true); }
  function dismiss()     { localStorage.setItem(key, '1'); setDismissed(true); }

  return (
    <div className="mx-5 mt-4 mb-1 bg-gray-900 border border-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white font-bold text-sm">Premiers pas avec Fidelyzio</p>
          <p className="text-gray-600 text-xs">{doneCount}/{steps.length} étapes complétées</p>
        </div>
        {allDone && (
          <button onClick={dismiss} className="text-gray-600 hover:text-gray-400 text-xs underline transition">Masquer</button>
        )}
      </div>
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-800 rounded-full mb-4 overflow-hidden">
        <div className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <div className="space-y-2.5">
        {steps.map(s => (
          <div key={s.id} className="flex items-center gap-3"
               onClick={s.id === 'print' && !printed ? markPrinted : undefined}
               style={{ cursor: s.id === 'print' && !printed ? 'pointer' : 'default' }}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
              s.done ? 'bg-emerald-500 text-white' : 'bg-gray-800 border border-gray-700'
            }`}>
              {s.done && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/>
              </svg>}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${s.done ? 'line-through text-gray-600' : 'text-white'}`}>
                {s.label}
              </p>
              {!s.done && <p className="text-gray-600 text-xs">{s.desc}</p>}
            </div>
            {s.id === 'print' && !printed && (
              <span className="text-indigo-400 text-xs shrink-0">Tap pour marquer ✓</span>
            )}
          </div>
        ))}
      </div>
      {allDone && (
        <div className="mt-4 text-center">
          <p className="text-emerald-400 text-sm font-semibold">🎉 Bravo, vous êtes prêt(e) !</p>
          <button onClick={dismiss} className="mt-2 text-gray-600 text-xs underline hover:text-gray-400 transition">Masquer ce guide</button>
        </div>
      )}
    </div>
  );
}

function HomeTab({ merchant, stats, onScanClick }) {
  const color   = merchant.color || '#6366f1';
  const enrollQr = `/api/merchants/${merchant.id}/enroll-qr`;
  const enrollUrl = `${window.location.origin}/enroll/${merchant.id}`;

  return (
    <div className="px-5 pt-2 pb-6 space-y-5">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Clients',    value: stats?.total_customers ?? '—' },
          { label: 'Pts total',  value: stats?.total_points    ?? '—' },
          { label: 'Auj.',       value: stats?.scans_today     ?? '—' },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-white/5 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-white leading-none">{s.value}</p>
            <p className="text-gray-600 text-[10px] uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Scan button */}
      <button
        onClick={onScanClick}
        className="w-full py-5 rounded-3xl font-bold text-white text-base flex items-center justify-center gap-3 active:scale-[0.98] transition-all shadow-2xl"
        style={{ background: color, boxShadow: `0 20px 50px ${color}40` }}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75V16.5ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
        </svg>
        Scanner un client
      </button>

      {/* Enrollment QR */}
      <div className="bg-gray-900 border border-white/5 rounded-3xl p-5">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-1">QR d'inscription</p>
        <p className="text-gray-600 text-xs mb-4">Affichez ce code en caisse — vos clients s'inscrivent eux-mêmes</p>
        <div className="flex justify-center mb-4">
          <div className="bg-white p-3 rounded-2xl shadow-xl">
            <img src={enrollQr} alt="QR inscription" className="w-44 h-44 rounded-lg block"
              onError={e => { e.target.style.opacity = '0.3'; }} />
          </div>
        </div>
        <div className="bg-gray-800 rounded-2xl px-4 py-2.5 flex items-center gap-2">
          <p className="text-gray-400 text-xs font-mono flex-1 truncate">{enrollUrl}</p>
          <button onClick={() => navigator.clipboard?.writeText(enrollUrl).catch(() => {})}
            title="Copier le lien"
            className="text-gray-600 hover:text-gray-300 active:scale-90 transition p-1 rounded-lg hover:bg-white/10 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
            </svg>
          </button>
        </div>
        {/* Print QR button */}
        <a href="/merchant/qr-print" target="_blank" rel="noopener"
           className="flex items-center justify-center gap-2 mt-3 py-2.5 rounded-2xl bg-gray-800/60 hover:bg-gray-700 active:scale-95 text-gray-500 hover:text-gray-200 text-xs font-medium transition-all border border-white/5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
          </svg>
          Imprimer mon QR d'inscription
        </a>
      </div>
    </div>
  );
}

function exportCSV(customers) {
  const headers = ['Prénom', 'Téléphone', 'Points', 'Dernière visite', 'Inscrit le'];
  const rows = customers.map(c => [
    c.first_name,
    c.phone || '',
    c.points,
    c.last_visit ? new Date(c.last_visit).toLocaleDateString('fr-FR') : '',
    c.joined_at  ? new Date(c.joined_at).toLocaleDateString('fr-FR')  : '',
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `clients-fidevo-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ClientsTab({ customers, rewards, token, onRewardsChange }) {
  const [search, setSearch]           = useState('');
  const [offerTarget, setOfferTarget] = useState(null); // { customer, available }
  const [offering, setOffering]       = useState(false);
  const [offerErr, setOfferErr]       = useState('');

  const activeRewards = (rewards || []).filter(r => r.active);

  const filtered = search.trim()
    ? customers.filter(c =>
        c.first_name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').includes(search)
      )
    : customers;

  function openOffer(c) {
    const available = activeRewards.filter(r => c.points >= r.points_required);
    if (!available.length) return;
    setOfferTarget({ customer: c, available });
    setOfferErr('');
  }

  async function handleOffer(reward) {
    setOffering(true);
    setOfferErr('');
    try {
      await redeemReward(offerTarget.customer.membership_id, reward.id, token);
      setOfferTarget(null);
      onRewardsChange();
    } catch (err) {
      setOfferErr(err.message);
    } finally {
      setOffering(false);
    }
  }

  return (
    <div className="px-5 pt-2 pb-6">
      {/* Search + CSV export */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input type="search" placeholder="Rechercher…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-white/5 rounded-2xl pl-9 pr-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition" />
        </div>
        {customers.length > 0 && (
          <button onClick={() => exportCSV(filtered)} title="Exporter CSV"
            className="px-3 py-3 bg-gray-900 border border-white/5 rounded-2xl text-gray-500 hover:text-white hover:bg-gray-800 active:scale-95 transition-all shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </button>
        )}
      </div>

      {customers.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
          </div>
          <p className="text-gray-600 text-sm">Aucun client encore inscrit.</p>
          <p className="text-gray-700 text-xs mt-1">Affichez votre QR d'inscription en caisse.</p>
        </div>
      )}

      {filtered.length === 0 && customers.length > 0 && (
        <p className="text-center text-gray-600 text-sm py-8">Aucun résultat pour « {search} »</p>
      )}

      <div className="space-y-3">
        {filtered.map(c => {
          const lastVisit  = c.last_visit ? fmtRelative(c.last_visit) : null;
          const available  = activeRewards.filter(r => c.points >= r.points_required);
          const hasRewards = available.length > 0;
          return (
            <div key={c.id}
              className={`bg-gray-900 rounded-2xl overflow-hidden border ${
                hasRewards ? 'border-amber-400/25 cursor-pointer active:scale-[0.99] transition-transform' : 'border-white/5'
              }`}
              onClick={() => hasRewards && openOffer(c)}>
              {/* Reward banner */}
              {hasRewards && (
                <div className="bg-amber-500/10 border-b border-amber-400/15 px-4 py-2 flex items-center gap-2">
                  <span className="text-base shrink-0">🎁</span>
                  <p className="text-amber-300 text-xs font-semibold flex-1">
                    {available.length === 1 ? '1 récompense disponible' : `${available.length} récompenses disponibles`}
                  </p>
                  <span className="text-amber-400/60 text-[10px]">Appuyer pour offrir →</span>
                </div>
              )}
              <div className="px-4 py-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {c.first_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{c.first_name}</p>
                  <p className="text-gray-600 text-xs truncate">
                    {c.phone || '—'}{lastVisit ? ` · ${lastVisit}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white font-black text-lg leading-none">{c.points}</p>
                  <p className="text-gray-600 text-[10px] uppercase tracking-wide">pts</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Offer reward bottom sheet ─────────────────────────────────────── */}
      {offerTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setOfferTarget(null)} />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
            <div className="bg-gray-900 rounded-t-3xl px-5 pb-safe-bottom pb-8 pt-5 shadow-2xl">
              <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />

              {/* Customer header */}
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-gray-800 flex items-center justify-center text-white font-bold text-base shrink-0">
                  {offerTarget.customer.first_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold">{offerTarget.customer.first_name}</p>
                  <p className="text-gray-500 text-xs">
                    {offerTarget.customer.points} pts
                    {offerTarget.customer.phone ? ` · ${offerTarget.customer.phone}` : ''}
                  </p>
                </div>
                <button onClick={() => setOfferTarget(null)}
                  className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-90 flex items-center justify-center text-gray-500 hover:text-white transition-all shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">
                Récompenses disponibles
              </p>

              {offerErr && (
                <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-2.5 mb-3 text-red-400 text-sm">
                  {offerErr}
                </div>
              )}

              <div className="space-y-3">
                {offerTarget.available.map(r => (
                  <div key={r.id}
                    className="flex items-center gap-3 bg-gray-800 rounded-2xl px-4 py-3">
                    <span className="text-xl shrink-0">🎁</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{r.description}</p>
                      <p className="text-amber-400/80 text-xs">{r.points_required} pts requis</p>
                    </div>
                    <button onClick={() => handleOffer(r)} disabled={offering}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-white font-bold text-xs disabled:opacity-60 transition-all shrink-0">
                      {offering ? '…' : 'Offrir'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RewardsTab({ rewards, token, onRewardsChange }) {
  const [desc, setDesc]         = useState('');
  const [pts, setPts]           = useState('');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    const p = parseInt(pts, 10);
    if (!desc.trim() || isNaN(p) || p <= 0) {
      setErr('Veuillez remplir tous les champs correctement.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      await addReward(desc.trim(), p, token);
      setDesc(''); setPts('');
      onRewardsChange();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteReward(id, token);
      onRewardsChange();
    } catch (e) {
      setErr(e.message);
    }
  }

  const active   = rewards.filter(r => r.active);
  const inactive = rewards.filter(r => !r.active);

  return (
    <div className="px-5 pt-2 pb-6 space-y-5">
      {/* Active rewards */}
      <div>
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">
          Récompenses actives {active.length > 0 ? `(${active.length})` : ''}
        </p>

        {active.length === 0 && (
          <div className="text-center py-8 bg-gray-900 border border-white/5 rounded-2xl">
            <p className="text-gray-600 text-sm">Aucune récompense configurée.</p>
            <p className="text-gray-700 text-xs mt-1">Ajoutez-en une ci-dessous pour motiver vos clients.</p>
          </div>
        )}

        <div className="space-y-3">
          {active.map(r => (
            <div key={r.id} className="bg-gray-900 border border-white/5 rounded-2xl px-4 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{r.description}</p>
                <p className="text-amber-400/80 text-xs">{r.points_required} points requis</p>
              </div>
              <button onClick={() => handleDelete(r.id)}
                className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center text-gray-600 transition-all active:scale-90 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add reward form */}
      <div className="bg-gray-900 border border-white/5 rounded-3xl p-5">
        <p className="text-gray-400 text-sm font-semibold mb-4">Ajouter une récompense</p>
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Description</label>
            <input
              type="text"
              placeholder="ex : 1 café gratuit"
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Points requis</label>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="ex : 100"
              value={pts}
              onChange={e => setPts(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition"
            />
          </div>
          {err && (
            <p className="text-red-400 text-xs">{err}</p>
          )}
          <button type="submit" disabled={saving}
            className="w-full py-3.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] disabled:opacity-60 text-white font-semibold text-sm transition-all">
            {saving ? 'Ajout…' : '+ Ajouter la récompense'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryTab({ token }) {
  const [scans, setScans]         = useState(null);
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo,   setDateTo]     = useState('');
  const [loading,  setLoading]    = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getScans(token, { dateFrom, dateTo });
      setScans(data.scans);
    } catch (_) {}
    finally { setLoading(false); }
  }

  // Load on first mount
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function fmtDT(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('fr-FR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="px-5 pt-2 pb-6">
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="bg-gray-900 border border-white/5 rounded-xl px-3 py-2 text-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 flex-1 min-w-0" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="bg-gray-900 border border-white/5 rounded-xl px-3 py-2 text-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 flex-1 min-w-0" />
        <button onClick={load} disabled={loading}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 active:scale-95 rounded-xl text-white text-xs font-semibold disabled:opacity-60 transition-all shrink-0">
          {loading ? '…' : 'Filtrer'}
        </button>
      </div>

      {scans === null && (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {scans !== null && scans.length === 0 && (
        <div className="text-center py-12 text-gray-600 text-sm">Aucun scan sur cette période.</div>
      )}

      {scans !== null && scans.length > 0 && (
        <>
          <p className="text-gray-600 text-xs mb-3">{scans.length} transaction{scans.length > 1 ? 's' : ''}</p>
          <div className="space-y-2">
            {scans.map(s => {
              const isRedeem = s.points < 0;
              return (
                <div key={s.id} className="bg-gray-900 border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${
                    isRedeem ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    {isRedeem ? '🎁' : '+'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{s.first_name}</p>
                    <p className="text-gray-600 text-xs truncate">{s.note || s.phone || '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${isRedeem ? 'text-red-400' : 'text-emerald-400'}`}>
                      {isRedeem ? '' : '+'}{s.points} pts
                    </p>
                    <p className="text-gray-600 text-[10px]">{fmtDT(s.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ── Settings tab ──────────────────────────────────────────────────────────────

function SettingsTab({ merchant, token, onRefresh }) {
  const [name,    setName]    = useState(merchant.name);
  const [color,   setColor]   = useState(merchant.color || '#6366f1');
  const [pwd,     setPwd]     = useState('');
  const [pwd2,    setPwd2]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [err,     setErr]     = useState('');

  async function handleSave(e) {
    e.preventDefault();
    if (pwd && pwd !== pwd2) { setErr('Les mots de passe ne correspondent pas.'); return; }
    if (pwd && pwd.length < 6) { setErr('Minimum 6 caractères.'); return; }
    setSaving(true); setErr(''); setMsg('');
    try {
      const payload = { name: name.trim(), color };
      if (pwd) payload.password = pwd;
      await updateProfile(payload, token);
      setPwd(''); setPwd2('');
      setMsg('Profil mis à jour !');
      onRefresh();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-5 pt-2 pb-6">
      <form onSubmit={handleSave} className="space-y-5">

        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5 space-y-4">
          <p className="text-gray-400 text-sm font-semibold">Informations de l'établissement</p>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Nom de l'établissement</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition" />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Couleur de marque</label>
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                className="w-12 h-12 rounded-xl cursor-pointer border-0 bg-transparent" />
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm font-mono">
                {color}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 border border-white/5 rounded-2xl p-5 space-y-4">
          <p className="text-gray-400 text-sm font-semibold">Changer le mot de passe</p>

          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Nouveau mot de passe</label>
            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
              placeholder="Laisser vide pour ne pas changer"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition" />
          </div>

          {pwd && (
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Confirmer</label>
              <input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition" />
            </div>
          )}
        </div>

        {err && <p className="text-red-400 text-sm">{err}</p>}
        {msg && <p className="text-emerald-400 text-sm">{msg}</p>}

        <button type="submit" disabled={saving}
          className="w-full py-4 rounded-2xl bg-brand-600 hover:bg-brand-700 active:scale-[.98] disabled:opacity-60 text-white font-semibold text-base transition-all">
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
      </form>
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1c1c28', titleColor: '#9ca3af', bodyColor: '#f9fafb',
      borderColor: '#2d2d3a', borderWidth: 1, padding: 10, displayColors: false,
    },
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 10 }, maxRotation: 0 }, border: { display: false } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 10 }, precision: 0 }, border: { display: false }, beginAtZero: true },
  },
};

function CanvasChart({ type, data, options, height = 160 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const c = new Chart(ref.current, { type, data, options });
    return () => c.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div style={{ height }}><canvas ref={ref} /></div>;
}

function ACard({ title, subtitle, children }) {
  return (
    <div className="bg-gray-900 border border-white/5 rounded-2xl p-4">
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-white text-sm font-semibold">{title}</p>
        {subtitle && <span className="text-gray-600 text-xs">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function KpiRow({ items }) {
  return (
    <div className={`grid gap-3 grid-cols-${items.length}`}>
      {items.map(({ label, value, sub, up }) => (
        <div key={label} className="bg-gray-900 border border-white/5 rounded-2xl p-3.5 text-center">
          <p className="text-2xl font-black text-white leading-none">{value}</p>
          {sub !== undefined && (
            <p className={`text-xs font-semibold mt-0.5 ${up === true ? 'text-emerald-400' : up === false ? 'text-red-400' : 'text-gray-600'}`}>
              {sub}
            </p>
          )}
          <p className="text-gray-600 text-[10px] uppercase tracking-wider mt-1 leading-tight">{label}</p>
        </div>
      ))}
    </div>
  );
}

function SectionLabel({ children }) {
  return <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mt-5 mb-3">{children}</p>;
}

function TrendChip({ value }) {
  if (value === null || value === undefined) return null;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${up ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(value)}%
    </span>
  );
}

function AnalyticsTab({ token, color }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState('');

  async function load() {
    setLoading(true); setErr('');
    try { setData(await getAnalytics(token)); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-7 h-7 rounded-full border-2 border-white/10 border-t-white/60 animate-spin" />
    </div>
  );
  if (err) return (
    <div className="px-5 py-12 text-center">
      <p className="text-red-400 text-sm mb-4">{err}</p>
      <button onClick={load} className="px-4 py-2 bg-gray-800 rounded-xl text-white text-sm hover:bg-gray-700 transition">Réessayer</button>
    </div>
  );
  if (!data) return null;

  const brand = color || '#6366f1';
  const DOW   = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const weekTrend = data.new_customers_last_week > 0
    ? Math.round(((data.new_customers_this_week - data.new_customers_last_week) / data.new_customers_last_week) * 100)
    : data.new_customers_this_week > 0 ? 100 : 0;
  const monthScanTrend = data.last_month_scans > 0
    ? Math.round(((data.this_month_scans - data.last_month_scans) / data.last_month_scans) * 100)
    : null;

  const totalCustomers = data.active_customers + data.inactive_customers;
  const activePct = totalCustomers > 0 ? Math.round((data.active_customers / totalCustomers) * 100) : 0;

  return (
    <div className="px-5 pt-2 pb-6 space-y-1">

      {/* Refresh */}
      <div className="flex justify-end pt-2 pb-1">
        <button onClick={load} className="flex items-center gap-1.5 text-gray-500 hover:text-white text-xs px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all active:scale-95">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Actualiser
        </button>
      </div>

      {/* ── Weekly summary ─────────────────────────────────────────────────── */}
      <SectionLabel>Cette semaine</SectionLabel>
      <KpiRow items={[
        { label: 'Nouveaux clients', value: data.weekly_new_customers, sub: `${weekTrend >= 0 ? '+' : ''}${weekTrend}% vs S-1`, up: weekTrend >= 0 },
        { label: 'Scans', value: data.weekly_scans },
        { label: 'Récompenses', value: data.weekly_redemptions },
      ]} />

      {/* ── Customer analysis ──────────────────────────────────────────────── */}
      <SectionLabel>Analyse clients</SectionLabel>

      {/* Active vs inactive */}
      <div className="bg-gray-900 border border-white/5 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white text-sm font-semibold">Clients actifs vs inactifs</p>
          <span className="text-gray-500 text-xs">30 derniers jours</span>
        </div>
        <div className="flex gap-4 mb-3">
          <div>
            <p className="text-2xl font-black text-emerald-400 leading-none">{data.active_customers}</p>
            <p className="text-gray-600 text-[10px] uppercase tracking-wide mt-0.5">Actifs</p>
          </div>
          <div>
            <p className="text-2xl font-black text-gray-500 leading-none">{data.inactive_customers}</p>
            <p className="text-gray-600 text-[10px] uppercase tracking-wide mt-0.5">Inactifs</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xl font-black text-white leading-none">{activePct}%</p>
            <p className="text-gray-600 text-[10px] uppercase tracking-wide mt-0.5">Actifs</p>
          </div>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${activePct}%` }} />
        </div>
      </div>

      {/* KPIs */}
      <KpiRow items={[
        { label: 'Fréquence moy.', value: `${data.avg_visit_frequency}`, sub: 'visites / mois' },
        { label: 'Nouveaux S-1', value: data.new_customers_this_week, sub: <TrendChip value={weekTrend} /> },
        { label: 'Taux rétention', value: `${data.retention_rate}%` },
      ]} />

      {/* Top 10 customers */}
      <ACard title="Top 10 clients" subtitle="par points cumulés">
        {data.top_customers.length === 0
          ? <p className="text-gray-600 text-sm text-center py-4">Aucun client encore.</p>
          : <div className="space-y-2.5">
              {data.top_customers.map((c, i) => {
                const maxPts = data.top_customers[0].points || 1;
                const pct    = Math.round((c.points / maxPts) * 100);
                return (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="text-gray-600 text-xs w-4 text-right shrink-0 font-semibold">{i + 1}</span>
                    <div className="w-7 h-7 rounded-lg bg-gray-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {c.first_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white text-xs font-medium truncate mr-2">{c.first_name}</span>
                        <span className="text-gray-500 text-[10px] shrink-0">{c.points} pts · {c.visit_count} visites</span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: brand }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
        }
      </ACard>

      {/* Lost customers */}
      {data.lost_customers.length > 0 && (
        <ACard title="Clients à relancer" subtitle="+30j sans visite">
          <div className="space-y-2">
            {data.lost_customers.slice(0, 8).map((c, i) => (
              <div key={i} className="flex items-center gap-3 bg-gray-800/50 rounded-xl px-3 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-gray-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {c.first_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{c.first_name}</p>
                  <p className="text-gray-600 text-xs">{c.last_visit ? fmtRelative(c.last_visit) : 'Jamais'} · {c.points} pts</p>
                </div>
                <button className="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-400 text-xs font-semibold border border-indigo-500/20 opacity-60 cursor-not-allowed" disabled>
                  Relancer
                </button>
              </div>
            ))}
          </div>
          {data.lost_customers.length > 8 && (
            <p className="text-gray-600 text-xs text-center mt-3">+{data.lost_customers.length - 8} autres clients inactifs</p>
          )}
        </ACard>
      )}

      {/* ── Time analysis ──────────────────────────────────────────────────── */}
      <SectionLabel>Activité dans le temps</SectionLabel>

      {/* Scans per day */}
      <ACard title="Scans par jour" subtitle="30 derniers jours">
        <CanvasChart key="scan-day" type="line" height={150}
          data={{
            labels: data.scans_per_day.map(d => d.day.slice(5)),
            datasets: [{ data: data.scans_per_day.map(d => d.count), borderColor: brand, backgroundColor: brand + '18', fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 }],
          }}
          options={{ ...CHART_OPTS, scales: { ...CHART_OPTS.scales, x: { ...CHART_OPTS.scales.x, ticks: { ...CHART_OPTS.scales.x.ticks, maxTicksLimit: 7 } } } }}
        />
      </ACard>

      {/* Scans by weekday */}
      <ACard title="Scans par jour de semaine" subtitle="30 derniers jours">
        <CanvasChart key="scan-dow" type="bar" height={140}
          data={{
            labels: DOW,
            datasets: [{ data: data.scans_by_weekday, backgroundColor: brand + 'aa', hoverBackgroundColor: brand, borderRadius: 4, borderSkipped: false }],
          }}
          options={CHART_OPTS}
        />
      </ACard>

      {/* Scans by hour */}
      <ACard title="Scans par heure" subtitle="30 derniers jours">
        <CanvasChart key="scan-hour" type="bar" height={130}
          data={{
            labels: Array.from({ length: 24 }, (_, i) => i + 'h'),
            datasets: [{ data: data.scans_by_hour, backgroundColor: '#22c55e99', hoverBackgroundColor: '#22c55e', borderRadius: 3, borderSkipped: false }],
          }}
          options={{ ...CHART_OPTS, scales: { ...CHART_OPTS.scales, x: { ...CHART_OPTS.scales.x, ticks: { ...CHART_OPTS.scales.x.ticks, maxTicksLimit: 8 } } } }}
        />
      </ACard>

      {/* Monthly comparison */}
      <div className="bg-gray-900 border border-white/5 rounded-2xl p-4">
        <p className="text-white text-sm font-semibold mb-3">Comparaison mensuelle</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Scans ce mois', value: data.this_month_scans, prev: data.last_month_scans, trend: monthScanTrend },
            { label: 'Nouveaux clients', value: data.this_month_customers, prev: data.last_month_customers,
              trend: data.last_month_customers > 0 ? Math.round(((data.this_month_customers - data.last_month_customers) / data.last_month_customers) * 100) : null },
          ].map(item => (
            <div key={item.label} className="bg-gray-800/60 rounded-xl p-3">
              <p className="text-gray-500 text-[10px] uppercase tracking-wide mb-1">{item.label}</p>
              <p className="text-white text-2xl font-black leading-none">{item.value}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <TrendChip value={item.trend} />
                <span className="text-gray-600 text-[10px]">vs mois dernier ({item.prev})</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Rewards analysis ───────────────────────────────────────────────── */}
      <SectionLabel>Récompenses</SectionLabel>

      <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-500 text-[10px] uppercase tracking-wide">Taux de rachat</p>
            <p className="text-white text-3xl font-black">{data.redemption_rate}%</p>
            <p className="text-gray-600 text-xs mt-0.5">des clients ont racheté une récompense</p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-[10px] uppercase tracking-wide">Rachats</p>
            <p className="text-white text-2xl font-black">{data.total_redeemed}</p>
            <p className="text-gray-600 text-xs mt-0.5">{data.total_points_distributed.toLocaleString('fr-FR')} pts distribués</p>
          </div>
        </div>
        {data.most_popular_reward && (
          <div className="bg-amber-500/8 border border-amber-500/18 rounded-xl px-3 py-2.5">
            <p className="text-amber-300/60 text-[10px] uppercase tracking-wide mb-0.5">Récompense la plus populaire</p>
            <p className="text-amber-300 text-sm font-semibold">{data.most_popular_reward}</p>
          </div>
        )}
        {data.avg_points_before_first_redemption > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Pts moyens avant 1er rachat</span>
            <span className="text-white font-bold">{data.avg_points_before_first_redemption} pts</span>
          </div>
        )}
      </div>

      {/* ── Business indicators ─────────────────────────────────────────────── */}
      <SectionLabel>Indicateurs business</SectionLabel>

      <KpiRow items={[
        { label: 'Score fidélité moy.', value: data.avg_loyalty_score, sub: 'pts / visite' },
        { label: 'Taux rétention', value: `${data.retention_rate}%`, sub: 'clients revenus' },
      ]} />

      {/* Customer growth chart */}
      <ACard title="Croissance clients" subtitle="12 dernières semaines">
        <CanvasChart key="cust-growth" type="line" height={140}
          data={{
            labels: data.cumulative_customers.map(c => c.label),
            datasets: [{ data: data.cumulative_customers.map(c => c.count), borderColor: '#22c55e', backgroundColor: '#22c55e18', fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 }],
          }}
          options={{ ...CHART_OPTS, scales: { ...CHART_OPTS.scales, x: { ...CHART_OPTS.scales.x, ticks: { ...CHART_OPTS.scales.x.ticks, maxTicksLimit: 6 } } } }}
        />
      </ACard>

      <div style={{ height: '0.5rem' }} />
    </div>
  );
}

// ── Main DashboardPage ────────────────────────────────────────────────────────

export default function DashboardPage({ auth, dashData, dashLoading, onLogout, onRefresh }) {
  const [tab, setTab]           = useState('home');
  const [showScan, setShowScan] = useState(false);

  const merchant  = dashData?.merchant ?? auth.merchant;
  const color     = merchant.color || '#6366f1';
  const stats     = dashData?.stats;
  const customers = dashData?.customers ?? [];
  const rewards   = dashData?.rewards   ?? [];

  function handleScanSuccess() {
    setShowScan(false);
    onRefresh();
  }

  const TABS = [
    { id: 'home',      label: 'Accueil', Icon: IconHome     },
    { id: 'clients',   label: 'Clients', Icon: IconUsers    },
    { id: 'rewards',   label: 'Primes',  Icon: IconGift     },
    { id: 'analytics', label: 'Stats',   Icon: IconChart    },
    { id: 'history',   label: 'Scans',   Icon: IconHistory  },
    { id: 'settings',  label: 'Compte',  Icon: IconSettings },
  ];

  return (
    <div className="min-h-dvh bg-[#0f0f14] flex flex-col">

      {/* Header */}
      <header className="flex items-center justify-between px-5 pt-safe-top pb-4 pt-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
            style={{ backgroundColor: color }}
          >
            {merchant.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">{merchant.name}</p>
            <p className="text-gray-600 text-xs capitalize">{merchant.plan ?? 'free'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dashLoading && (
            <div className="w-4 h-4 border border-gray-700 border-t-gray-400 rounded-full animate-spin" />
          )}
          <button onClick={onRefresh} title="Actualiser"
            className="w-9 h-9 rounded-xl bg-gray-900 hover:bg-gray-800 active:scale-90 flex items-center justify-center text-gray-500 hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
          <button onClick={onLogout} title="Déconnexion"
            className="w-9 h-9 rounded-xl bg-gray-900 hover:bg-gray-800 active:scale-90 flex items-center justify-center text-gray-500 hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>
      </header>

      {/* Tab content */}
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: '5rem' }}>
        {/* Trial banner — always visible */}
        <TrialBanner merchant={merchant} token={auth.token} />
        {/* Onboarding — only on home tab */}
        {tab === 'home' && merchant.subscription_status !== 'suspended' && (
          <OnboardingChecklist merchant={merchant} stats={stats} rewards={rewards} />
        )}
        {tab === 'home'      && <HomeTab merchant={merchant} stats={stats} onScanClick={() => setShowScan(true)} />}
        {tab === 'clients'   && (
          <ClientsTab customers={customers} rewards={rewards} token={auth.token} onRewardsChange={onRefresh} />
        )}
        {tab === 'rewards'   && <RewardsTab rewards={rewards} token={auth.token} onRewardsChange={onRefresh} />}
        {tab === 'analytics' && <AnalyticsTab token={auth.token} color={color} />}
        {tab === 'history'   && <HistoryTab token={auth.token} />}
        {tab === 'settings'  && <SettingsTab merchant={merchant} token={auth.token} onRefresh={onRefresh} />}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 bg-[#0f0f14]/95 backdrop-blur border-t border-white/5 pb-safe-bottom">
        <div className="flex">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                  active ? 'text-white' : 'text-gray-600 hover:text-gray-400'
                }`}>
                <div className={`transition-transform ${active ? 'scale-110' : ''}`}>
                  <Icon />
                </div>
                <span className="text-[10px] font-medium">{label}</span>
                {active && (
                  <span className="absolute bottom-0 w-6 h-0.5 rounded-full" style={{ background: color }} />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Scan modal */}
      {showScan && (
        <ScanModal
          token={auth.token}
          onClose={() => setShowScan(false)}
          onSuccess={handleScanSuccess}
        />
      )}
    </div>
  );
}
