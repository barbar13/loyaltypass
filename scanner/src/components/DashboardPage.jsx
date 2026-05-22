import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import ScanModal  from './ScanModal.jsx';
import { addReward, deleteReward, redeemReward, updateProfile, getScans, createCheckout, getAnalytics } from '../api.js';

Chart.register(...registerables);

// ── Icons ─────────────────────────────────────────────────────────────────────

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

// ── Supplemental icons (emoji-free) ──────────────────────────────────────────

const IcoGift   = ({ s = 18 }) => <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/></svg>;
const IcoStar   = ({ s = 18 }) => <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"/></svg>;
const IcoScan   = ({ s = 18 }) => <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75V16.5ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z"/></svg>;
const IcoTrend  = ({ s = 20 }) => <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"/></svg>;
const IcoCal    = ({ s = 20 }) => <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"/></svg>;
const IcoWarn   = ({ s = 28 }) => <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>;
const IcoInbox  = ({ s = 24 }) => <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z"/></svg>;
const IcoPeople = ({ s = 24 }) => <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"/></svg>;
const IcoMobile = ({ s = 20 }) => <svg width={s} height={s} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3"/></svg>;

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

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function exportCSV(customers) {
  const headers = ['Prénom', 'Téléphone', 'Email', 'Points', 'Nombre de visites', 'Dernière visite', 'Date inscription'];
  const rows = customers.map(c => [
    c.first_name,
    c.phone      || '',
    c.email      || '',
    c.points     ?? '',
    c.visit_count != null ? Number(c.visit_count) : '',
    c.last_visit  ? new Date(c.last_visit).toLocaleDateString('fr-FR')  : '',
    c.joined_at   ? new Date(c.joined_at).toLocaleDateString('fr-FR')   : '',
  ]);
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `clients-fidelyzio-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skel({ h = 'h-4', w = 'w-full', rounded = 'rounded-lg' }) {
  return <div className={`${h} ${w} ${rounded} bg-white/[0.06] animate-pulse`} />;
}

// ── TrialBanner ───────────────────────────────────────────────────────────────

function TrialBanner({ merchant, token }) {
  const [loading, setLoading] = useState(false);
  const status = merchant.subscription_status;
  const days   = merchant.trial_days_left;
  if (status === 'active') return null;

  async function handleSubscribe() {
    setLoading(true);
    try { const { url } = await createCheckout(token); if (url) window.location.href = url; }
    catch (_) { setLoading(false); }
  }

  if (status === 'suspended' || status === 'canceled') {
    return (
      <div className="mx-5 mt-4 mb-0 rounded-2xl bg-red-500/10 border border-red-500/25 px-4 py-4">
        <p className="text-red-400 font-bold text-sm mb-1">Compte suspendu</p>
        <p className="text-red-300/70 text-xs mb-3">Votre abonnement est inactif. Les scans sont bloqués.</p>
        <button onClick={handleSubscribe} disabled={loading}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-sm disabled:opacity-60 transition-all">
          {loading ? 'Redirection…' : 'S\'abonner — 19 €/mois →'}
        </button>
      </div>
    );
  }

  const urgency = days <= 1 ? 'red' : days <= 3 ? 'amber' : 'indigo';
  const colors  = { red: 'bg-red-500/10 border-red-500/25 text-red-400', amber: 'bg-amber-500/10 border-amber-500/25 text-amber-400', indigo: 'bg-indigo-500/10 border-indigo-500/25 text-indigo-400' };
  const label   = days === 0 ? 'Essai expiré aujourd\'hui' : `Essai : encore ${days} jour${days > 1 ? 's' : ''}`;

  return (
    <div className={`mx-5 mt-4 mb-0 rounded-2xl border px-4 py-3 ${colors[urgency]}`}>
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

// ── OnboardingChecklist ───────────────────────────────────────────────────────

function OnboardingChecklist({ merchant, stats, rewards }) {
  const key      = `fidelyzio_ob_${merchant.id}`;
  const printKey = `fidelyzio_ob_print_${merchant.id}`;
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(key));
  const [printed,   setPrinted]   = useState(() => !!localStorage.getItem(printKey));
  if (dismissed) return null;

  const hasScanned = Number(stats?.total_points) > 0;
  const hasRewards = (rewards || []).filter(r => r.active).length > 0;
  const steps = [
    { id: 'account', done: true,       label: 'Compte créé',                  desc: 'Vous êtes prêt(e) !' },
    { id: 'print',   done: printed,    label: 'Afficher votre QR en caisse',  desc: 'Imprimez votre QR d\'inscription.' },
    { id: 'scan',    done: hasScanned, label: 'Premier scan client',           desc: 'Scannez la carte d\'un client.' },
    { id: 'reward',  done: hasRewards, label: 'Créer une récompense',          desc: 'Ajoutez votre première récompense.' },
  ];
  const doneCount = steps.filter(s => s.done).length;
  const allDone   = doneCount === steps.length;

  return (
    <div className="mx-5 mt-4 bg-[#0e0e18] border border-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white font-bold text-sm">Premiers pas avec Fidelyzio</p>
          <p className="text-gray-600 text-xs">{doneCount}/{steps.length} étapes complétées</p>
        </div>
        {allDone && <button onClick={() => { localStorage.setItem(key, '1'); setDismissed(true); }} className="text-gray-600 hover:text-gray-400 text-xs underline transition">Masquer</button>}
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full mb-4 overflow-hidden">
        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <div className="space-y-2.5">
        {steps.map(s => (
          <div key={s.id} className="flex items-center gap-3"
            onClick={s.id === 'print' && !printed ? () => { localStorage.setItem(printKey, '1'); setPrinted(true); } : undefined}
            style={{ cursor: s.id === 'print' && !printed ? 'pointer' : 'default' }}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${s.done ? 'bg-emerald-500 text-white' : 'bg-gray-800 border border-gray-700'}`}>
              {s.done && <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${s.done ? 'line-through text-gray-600' : 'text-white'}`}>{s.label}</p>
              {!s.done && <p className="text-gray-600 text-xs">{s.desc}</p>}
            </div>
            {s.id === 'print' && !printed && <span className="text-indigo-400 text-xs shrink-0">Marquer fait</span>}
          </div>
        ))}
      </div>
      {allDone && (
        <div className="mt-4 text-center">
          <p className="text-emerald-400 text-sm font-semibold">Tout est prêt !</p>
          <button onClick={() => { localStorage.setItem(key, '1'); setDismissed(true); }} className="mt-2 text-gray-600 text-xs underline hover:text-gray-400 transition">Masquer</button>
        </div>
      )}
    </div>
  );
}

// ── HomeTab ───────────────────────────────────────────────────────────────────

function HomeTab({ merchant, stats, rewards, token, onScanClick }) {
  const [recentScans, setRecentScans] = useState(null);
  const [showQr, setShowQr] = useState(false);
  const color       = merchant.color || '#6366f1';
  const enrollQr    = `/api/merchants/${merchant.id}/enroll-qr`;
  const enrollUrl   = `${window.location.origin}/enroll/${merchant.id}`;
  const activeRwds  = (rewards || []).filter(r => r.active).length;
  const today       = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  useEffect(() => {
    getScans(token, {})
      .then(d => setRecentScans((d.scans || []).slice(0, 5)))
      .catch(() => setRecentScans([]));
  }, [token]);

  const quickStats = [
    { label: 'Clients', value: stats?.total_customers ?? '—', icon: <IcoPeople s={20} /> },
    { label: 'Scans auj.', value: stats?.scans_today ?? '—', icon: <IcoScan s={20} /> },
    { label: 'Récompenses', value: activeRwds, icon: <IcoGift s={20} /> },
    { label: 'Points total', value: stats?.total_points != null ? Number(stats.total_points).toLocaleString('fr-FR') : '—', icon: <IcoStar s={20} /> },
  ];

  return (
    <div className="px-5 md:px-6 pt-5 pb-8 max-w-2xl">

      {/* Welcome */}
      <div className="mb-5">
        <p className="text-gray-500 text-xs capitalize">{today}</p>
        <h1 className="text-white font-bold text-xl mt-0.5">Bonjour, {merchant.name}</h1>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {quickStats.map(s => (
          <div key={s.label} className="bg-[#0e0e18] border border-white/5 rounded-2xl p-4">
            <div className="text-gray-500 mb-2">{s.icon}</div>
            <p className="text-2xl font-black text-white leading-none">{s.value}</p>
            <p className="text-gray-600 text-[10px] uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Scan button — mobile only */}
      <button
        onClick={onScanClick}
        className="md:hidden w-full py-6 rounded-3xl font-bold text-white text-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 20px 50px ${color}40` }}
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75V16.5ZM16.5 6.75h.75v.75h-.75v-.75ZM13.5 13.5h.75v.75h-.75v-.75ZM13.5 19.5h.75v.75h-.75v-.75ZM19.5 13.5h.75v.75h-.75v-.75ZM19.5 19.5h.75v.75h-.75v-.75ZM16.5 16.5h.75v.75h-.75v-.75Z" />
        </svg>
        Scanner un client
      </button>

      {/* Desktop: info message instead of scan button */}
      <div className="hidden md:flex items-center gap-3 bg-[#0e0e18] border border-white/5 rounded-2xl px-5 py-4">
        <div className="text-gray-500 shrink-0"><IcoMobile s={22} /></div>
        <p className="text-gray-400 text-sm">Utilisez l'application mobile pour scanner vos clients</p>
      </div>

      {/* Enrollment QR — always open on desktop, collapsible on mobile */}
      <div className="mt-4 bg-[#0e0e18] border border-white/5 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowQr(v => !v)}
          className="md:hidden w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2.5 text-left">
            <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5Z" />
            </svg>
            <div>
              <p className="text-white text-sm font-semibold">QR d'inscription</p>
              <p className="text-gray-600 text-xs">Affichez ce code en caisse</p>
            </div>
          </div>
          <svg className={`w-4 h-4 text-gray-600 transition-transform ${showQr ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {/* Desktop QR header (always visible) */}
        <div className="hidden md:flex items-center gap-2.5 px-5 py-4 border-b border-white/5">
          <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5Z" />
          </svg>
          <div>
            <p className="text-white text-sm font-semibold">QR d'inscription client</p>
            <p className="text-gray-600 text-xs">Affichez ce code en caisse pour que vos clients s'inscrivent</p>
          </div>
        </div>

        {/* QR content — hidden on mobile until expanded, always visible on desktop */}
        {(showQr || true) && (
          <div className={`${showQr ? '' : 'hidden'} md:block px-5 pb-5 border-t border-white/5 md:border-t-0`}>
            <div className="flex justify-center my-4">
              <div className="bg-white p-4 rounded-2xl shadow-xl md:p-5">
                <img src={enrollQr} alt="QR inscription" className="w-44 h-44 md:w-56 md:h-56 rounded-lg block"
                  onError={e => { e.target.style.opacity = '0.3'; }} />
              </div>
            </div>
            <div className="bg-[#080810] rounded-xl px-4 py-2.5 flex items-center gap-2 mb-3">
              <p className="text-gray-500 text-xs font-mono flex-1 truncate">{enrollUrl}</p>
              <button onClick={() => navigator.clipboard?.writeText(enrollUrl).catch(() => {})}
                className="text-gray-600 hover:text-gray-300 active:scale-90 transition p-1 rounded shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"/></svg>
              </button>
            </div>
            <a href="/merchant/qr-print" target="_blank" rel="noopener"
              className="flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all border border-white/5 active:scale-95 shadow-lg shadow-indigo-600/20">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z"/></svg>
              Imprimer mon QR code
            </a>
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="mt-5">
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">Activité récente</p>

        {recentScans === null && (
          <div className="space-y-2.5">
            {[1,2,3].map(i => (
              <div key={i} className="bg-[#0e0e18] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
                <Skel h="h-9" w="w-9" rounded="rounded-xl" />
                <div className="flex-1 space-y-1.5">
                  <Skel h="h-3.5" w="w-28" />
                  <Skel h="h-2.5" w="w-20" />
                </div>
                <Skel h="h-4" w="w-14" />
              </div>
            ))}
          </div>
        )}

        {recentScans !== null && recentScans.length === 0 && (
          <div className="bg-[#0e0e18] border border-white/5 rounded-2xl py-10 text-center">
            <div className="flex justify-center mb-3 text-gray-600"><IcoInbox s={32} /></div>
            <p className="text-gray-400 text-sm font-medium">Aucun scan encore</p>
            <p className="text-gray-600 text-xs mt-1">Affichez votre QR d'inscription en caisse pour commencer</p>
          </div>
        )}

        {recentScans !== null && recentScans.length > 0 && (
          <div className="space-y-2">
            {recentScans.map(s => {
              const isRedeem = s.points < 0;
              return (
                <div key={s.id} className="bg-[#0e0e18] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${isRedeem ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/10 text-white'}`}>
                    {isRedeem ? <IcoGift s={16} /> : s.first_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{s.first_name}</p>
                    <p className="text-gray-600 text-xs">{fmtRelative(s.created_at)}</p>
                  </div>
                  <p className={`text-sm font-bold shrink-0 ${isRedeem ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {isRedeem ? 'Récompense' : `+${s.points} pts`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ClientsTab ────────────────────────────────────────────────────────────────

function ClientsTab({ customers, rewards, token, onRewardsChange }) {
  const [search, setSearch]             = useState('');
  const [offerTarget, setOfferTarget]   = useState(null);
  const [offering, setOffering]         = useState(false);
  const [offerErr, setOfferErr]         = useState('');
  const [expandedId, setExpandedId]     = useState(null);
  const [clientScansCache, setCache]    = useState({}); // { [id]: 'loading' | scan[] }
  const [recentScans, setRecentScans]   = useState(null);

  const activeRewards = (rewards || []).filter(r => r.active);
  const filtered = search.trim()
    ? customers.filter(c => c.first_name.toLowerCase().includes(search.toLowerCase()) || (c.phone || '').includes(search))
    : customers;

  // Load global recent scans once
  useEffect(() => {
    getScans(token, {})
      .then(d => setRecentScans((d.scans || []).slice(0, 25)))
      .catch(() => setRecentScans([]));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleClient(id) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (clientScansCache[id] === undefined) {
      setCache(prev => ({ ...prev, [id]: 'loading' }));
      getScans(token, { customerId: id })
        .then(d => setCache(prev => ({ ...prev, [id]: d.scans || [] })))
        .catch(() => setCache(prev => ({ ...prev, [id]: [] })));
    }
  }

  function openOffer(c, e) {
    e?.stopPropagation();
    const available = activeRewards.filter(r => c.points >= r.points_required);
    if (!available.length) return;
    setOfferTarget({ customer: c, available }); setOfferErr('');
  }

  async function handleOffer(reward) {
    setOffering(true); setOfferErr('');
    try {
      await redeemReward(offerTarget.customer.membership_id, reward.id, token);
      // Clear cached scans for this customer so history refreshes on next expand
      setCache(prev => { const n = { ...prev }; delete n[offerTarget.customer.id]; return n; });
      setOfferTarget(null);
      onRewardsChange();
    } catch (err) { setOfferErr(err.message); }
    finally { setOffering(false); }
  }

  return (
    <div className="px-5 md:px-6 pt-2 pb-8">
      {/* Search + CSV */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input type="search" placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-white/5 rounded-2xl pl-9 pr-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition" />
        </div>
        {customers.length > 0 && (
          <button onClick={() => exportCSV(filtered)} title="Exporter CSV"
            className="px-3 py-3 bg-gray-900 border border-white/5 rounded-2xl text-gray-500 hover:text-white hover:bg-gray-800 active:scale-95 transition-all shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
          </button>
        )}
      </div>

      {/* Empty state */}
      {customers.length === 0 && (
        <div className="text-center py-16 bg-[#0e0e18] border border-white/5 rounded-2xl">
          <div className="flex justify-center mb-3 text-gray-600"><IcoPeople s={36} /></div>
          <p className="text-gray-400 text-sm font-medium">Aucun client encore inscrit</p>
          <p className="text-gray-600 text-xs mt-1">Affichez votre QR d'inscription en caisse</p>
        </div>
      )}
      {filtered.length === 0 && customers.length > 0 && (
        <p className="text-center text-gray-600 text-sm py-8">Aucun résultat pour « {search} »</p>
      )}

      {/* Client list — expandable */}
      <div className="space-y-2">
        {filtered.map(c => {
          const available  = activeRewards.filter(r => c.points >= r.points_required);
          const hasRewards = available.length > 0;
          const lastVisit  = c.last_visit ? fmtRelative(c.last_visit) : null;
          const isExpanded = expandedId === c.id;
          const scans      = clientScansCache[c.id];

          return (
            <div key={c.id} className={`bg-gray-900 rounded-2xl overflow-hidden border transition-all ${hasRewards ? 'border-amber-400/20' : 'border-white/5'}`}>
              {/* Reward banner — tap to open offer sheet */}
              {hasRewards && (
                <div className="bg-amber-500/10 border-b border-amber-400/15 px-4 py-2 flex items-center gap-2 cursor-pointer"
                     onClick={e => openOffer(c, e)}>
                  <span className="text-amber-400 shrink-0"><IcoGift s={14} /></span>
                  <p className="text-amber-300 text-xs font-semibold flex-1">
                    {available.length === 1 ? '1 récompense disponible' : `${available.length} récompenses disponibles`}
                  </p>
                  <span className="text-amber-400/60 text-[10px]">Offrir →</span>
                </div>
              )}

              {/* Main row — tap to expand/collapse */}
              <div className="px-4 py-3.5 flex items-center gap-3 cursor-pointer select-none" onClick={() => toggleClient(c.id)}>
                <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {c.first_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{c.first_name}</p>
                  <p className="text-gray-600 text-xs truncate">{c.phone || '—'}{lastVisit ? ` · ${lastVisit}` : ''}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-white font-black text-lg leading-none">{c.points}</p>
                    <p className="text-gray-600 text-[10px] uppercase tracking-wide">pts</p>
                  </div>
                  <svg className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                       fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div className="border-t border-white/5 bg-[#080810]">
                  {/* Client metadata */}
                  {(c.email || c.visit_count != null || c.joined_at) && (
                    <div className="px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-0.5 border-b border-white/[0.04]">
                      {c.email && <span className="text-gray-500 text-xs">{c.email}</span>}
                      {c.visit_count != null && (
                        <span className="text-gray-500 text-xs">{Number(c.visit_count)} visite{Number(c.visit_count) > 1 ? 's' : ''}</span>
                      )}
                      {c.joined_at && (
                        <span className="text-gray-500 text-xs">Inscrit le {new Date(c.joined_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                    </div>
                  )}

                  {/* Transaction history */}
                  <div className="px-4 pt-3 pb-4">
                    <p className="text-gray-600 text-[10px] uppercase tracking-wider mb-2.5">Historique des scans</p>
                    {scans === 'loading' && (
                      <div className="space-y-2">
                        {[1,2,3].map(i => <div key={i} className="h-7 bg-white/[0.04] rounded-xl animate-pulse" />)}
                      </div>
                    )}
                    {Array.isArray(scans) && scans.length === 0 && (
                      <p className="text-gray-700 text-xs text-center py-3">Aucune transaction enregistrée</p>
                    )}
                    {Array.isArray(scans) && scans.length > 0 && (
                      <div className="space-y-1.5">
                        {scans.slice(0, 20).map(s => {
                          const isRedeem = s.points < 0;
                          return (
                            <div key={s.id} className="flex items-center gap-2.5">
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isRedeem ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                {isRedeem ? <IcoGift s={12} /> : '+'}
                              </div>
                              <span className="flex-1 text-gray-500 text-xs">{fmtRelative(s.created_at)}</span>
                              <span className={`text-xs font-semibold shrink-0 ${isRedeem ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {isRedeem ? 'Récompense' : `+${s.points} pts`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Offer reward button */}
                    {hasRewards && (
                      <button onClick={e => openOffer(c, e)}
                        className="mt-3.5 w-full py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/20 text-amber-300 text-xs font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5">
                        <IcoGift s={14} /> Offrir une récompense
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Global recent scans */}
      {customers.length > 0 && (
        <div className="mt-7">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">Scans récents</p>
          {recentScans === null && (
            <div className="space-y-2">
              {[1,2,3,4].map(i => <div key={i} className="h-12 bg-[#0e0e18] border border-white/5 rounded-xl animate-pulse" />)}
            </div>
          )}
          {recentScans !== null && recentScans.length === 0 && (
            <div className="bg-[#0e0e18] border border-white/5 rounded-2xl py-8 text-center">
              <div className="flex justify-center mb-2 text-gray-600"><IcoInbox s={28} /></div>
              <p className="text-gray-600 text-sm">Aucun scan encore</p>
            </div>
          )}
          {recentScans !== null && recentScans.length > 0 && (
            <div className="space-y-2">
              {recentScans.map(s => {
                const isRedeem = s.points < 0;
                return (
                  <div key={s.id} className="bg-[#0e0e18] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${isRedeem ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/10 text-white'}`}>
                      {isRedeem ? <IcoGift s={14} /> : s.first_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{s.first_name}</p>
                      <p className="text-gray-600 text-xs">{fmtRelative(s.created_at)}</p>
                    </div>
                    <p className={`text-sm font-bold shrink-0 ${isRedeem ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {isRedeem ? 'Récompense' : `+${s.points} pts`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Reward offer bottom sheet */}
      {offerTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={() => setOfferTarget(null)} />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
            <div className="bg-gray-900 rounded-t-3xl px-5 pb-safe-bottom pb-8 pt-5 shadow-2xl">
              <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />
              <div className="flex items-center gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-gray-800 flex items-center justify-center text-white font-bold text-base shrink-0">{offerTarget.customer.first_name.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold">{offerTarget.customer.first_name}</p>
                  <p className="text-gray-500 text-xs">{offerTarget.customer.points} pts{offerTarget.customer.phone ? ` · ${offerTarget.customer.phone}` : ''}</p>
                </div>
                <button onClick={() => setOfferTarget(null)} className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-90 flex items-center justify-center text-gray-500 hover:text-white transition-all shrink-0">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                </button>
              </div>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">Récompenses disponibles</p>
              {offerErr && <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-2.5 mb-3 text-red-400 text-sm">{offerErr}</div>}
              <div className="space-y-3">
                {offerTarget.available.map(r => (
                  <div key={r.id} className="flex items-center gap-3 bg-gray-800 rounded-2xl px-4 py-3">
                    <span className="text-amber-400 shrink-0"><IcoGift s={20} /></span>
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

// ── RewardsTab ────────────────────────────────────────────────────────────────

function RewardsTab({ rewards, token, onRewardsChange }) {
  const [desc, setDesc]     = useState('');
  const [pts, setPts]       = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    const p = parseInt(pts, 10);
    if (!desc.trim() || isNaN(p) || p <= 0) { setErr('Veuillez remplir tous les champs.'); return; }
    setSaving(true); setErr('');
    try { await addReward(desc.trim(), p, token); setDesc(''); setPts(''); onRewardsChange(); }
    catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const active   = rewards.filter(r => r.active);
  const inactive = rewards.filter(r => !r.active);

  return (
    <div className="px-5 md:px-6 pt-2 pb-6 md:grid md:grid-cols-2 md:gap-6 md:items-start">
      <div>
        <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-3">Récompenses actives {active.length > 0 ? `(${active.length})` : ''}</p>
        {active.length === 0 && (
          <div className="text-center py-10 bg-[#0e0e18] border border-white/5 rounded-2xl">
            <div className="flex justify-center mb-2 text-gray-600"><IcoGift s={32} /></div>
            <p className="text-gray-500 text-sm">Aucune récompense configurée</p>
            <p className="text-gray-600 text-xs mt-1">Ajoutez-en une pour motiver vos clients</p>
          </div>
        )}
        <div className="space-y-3">
          {active.map(r => (
            <div key={r.id} className="bg-[#0e0e18] border border-white/5 rounded-2xl px-4 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{r.description}</p>
                <p className="text-amber-400/80 text-xs">{r.points_required} points requis</p>
              </div>
              <button onClick={() => deleteReward(r.id, token).then(onRewardsChange).catch(() => {})}
                className="w-8 h-8 rounded-xl bg-gray-800 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center text-gray-600 transition-all active:scale-90 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
        {inactive.length > 0 && <p className="text-gray-700 text-xs mt-3">{inactive.length} récompense{inactive.length > 1 ? 's' : ''} désactivée{inactive.length > 1 ? 's' : ''}</p>}
      </div>

      <div className="mt-4 md:mt-0 bg-[#0e0e18] border border-white/5 rounded-3xl p-5">
        <p className="text-gray-400 text-sm font-semibold mb-4">Ajouter une récompense</p>
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Description</label>
            <input type="text" placeholder="ex : 1 café gratuit" value={desc} onChange={e => setDesc(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Points requis</label>
            <input type="number" inputMode="numeric" min="1" placeholder="ex : 100" value={pts} onChange={e => setPts(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition" />
          </div>
          {err && <p className="text-red-400 text-xs">{err}</p>}
          <button type="submit" disabled={saving}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-60 text-white font-semibold text-sm transition-all">
            {saving ? 'Ajout…' : '+ Ajouter la récompense'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── HistoryTab ────────────────────────────────────────────────────────────────

function HistoryTab({ token }) {
  const [scans, setScans]       = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [loading,  setLoading]  = useState(false);

  async function load() {
    setLoading(true);
    try { const data = await getScans(token, { dateFrom, dateTo }); setScans(data.scans); }
    catch (_) {} finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="px-5 md:px-6 pt-2 pb-6 md:max-w-3xl">
      <div className="flex gap-2 mb-4 flex-wrap">
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="bg-gray-900 border border-white/5 rounded-xl px-3 py-2 text-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 min-w-0" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="bg-gray-900 border border-white/5 rounded-xl px-3 py-2 text-gray-300 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 min-w-0" />
        <button onClick={load} disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 rounded-xl text-white text-xs font-semibold disabled:opacity-60 transition-all shrink-0">
          {loading ? '…' : 'Filtrer'}
        </button>
      </div>
      {scans === null && (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="bg-[#0e0e18] border border-white/5 rounded-xl px-4 py-3 flex gap-3"><Skel h="h-8" w="w-8" rounded="rounded-xl" /><div className="flex-1 space-y-2"><Skel h="h-3" w="w-32" /><Skel h="h-2.5" w="w-24" /></div><Skel h="h-4" w="w-16" /></div>)}
        </div>
      )}
      {scans !== null && scans.length === 0 && <div className="text-center py-12 text-gray-600 text-sm">Aucun scan sur cette période.</div>}
      {scans !== null && scans.length > 0 && (
        <>
          <p className="text-gray-600 text-xs mb-3">{scans.length} transaction{scans.length > 1 ? 's' : ''}</p>
          <div className="space-y-2">
            {scans.map(s => {
              const isRedeem = s.points < 0;
              return (
                <div key={s.id} className="bg-[#0e0e18] border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${isRedeem ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{isRedeem ? <IcoGift s={14} /> : '+'}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{s.first_name}</p>
                    <p className="text-gray-600 text-xs truncate">{s.note || s.phone || '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-bold ${isRedeem ? 'text-red-400' : 'text-emerald-400'}`}>{isRedeem ? '' : '+'}{s.points} pts</p>
                    <p className="text-gray-600 text-[10px]">{fmtRelative(s.created_at)}</p>
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

// ── SettingsTab ───────────────────────────────────────────────────────────────

function SettingsTab({ merchant, token, onRefresh }) {
  const [name,   setName]   = useState(merchant.name);
  const [color,  setColor]  = useState(merchant.color || '#6366f1');
  const [pwd,    setPwd]    = useState('');
  const [pwd2,   setPwd2]   = useState('');
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState('');
  const [err,    setErr]    = useState('');

  async function handleSave(e) {
    e.preventDefault();
    if (pwd && pwd !== pwd2) { setErr('Les mots de passe ne correspondent pas.'); return; }
    if (pwd && pwd.length < 6) { setErr('Minimum 6 caractères.'); return; }
    setSaving(true); setErr(''); setMsg('');
    try {
      const payload = { name: name.trim(), color };
      if (pwd) payload.password = pwd;
      await updateProfile(payload, token);
      setPwd(''); setPwd2(''); setMsg('Profil mis à jour !'); onRefresh();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="px-5 md:px-6 pt-2 pb-6 md:max-w-lg">
      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-[#0e0e18] border border-white/5 rounded-2xl p-5 space-y-4">
          <p className="text-gray-400 text-sm font-semibold">Informations de l'établissement</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Nom de l'établissement</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Couleur de marque</label>
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-12 h-12 rounded-xl cursor-pointer border-0 bg-transparent" />
              <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm font-mono">{color}</div>
            </div>
          </div>
        </div>
        <div className="bg-[#0e0e18] border border-white/5 rounded-2xl p-5 space-y-4">
          <p className="text-gray-400 text-sm font-semibold">Changer le mot de passe</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Nouveau mot de passe</label>
            <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="Laisser vide pour ne pas changer"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition" />
          </div>
          {pwd && (
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Confirmer</label>
              <input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} placeholder="••••••••"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 transition" />
            </div>
          )}
        </div>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        {msg && <p className="text-emerald-400 text-sm">{msg}</p>}
        <button type="submit" disabled={saving}
          className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-[.98] disabled:opacity-60 text-white font-semibold text-base transition-all">
          {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
        </button>
      </form>
    </div>
  );
}

// ── Analytics: building blocks ────────────────────────────────────────────────

const CHART_COLORS = {
  indigo: '#6366f1', amber: '#f59e0b', emerald: '#10b981', rose: '#f43f5e',
  blue: '#3b82f6', violet: '#8b5cf6',
};

const TOOLTIP_OPTS = {
  enabled: true,
  backgroundColor: '#1c1c28', titleColor: '#9ca3af', bodyColor: '#f9fafb',
  borderColor: '#2d2d3a', borderWidth: 1, padding: 12, displayColors: false,
  titleFont: { size: 13 }, bodyFont: { size: 14 },
  cornerRadius: 10,
};

const BASE_CHART_OPTS = {
  responsive: true, maintainAspectRatio: false,
  // intersect:false makes tooltips appear on touch anywhere on the chart column,
  // not only when the finger is exactly on the data point
  interaction: { mode: 'index', intersect: false, axis: 'x' },
  plugins: {
    legend: { display: false },
    tooltip: TOOLTIP_OPTS,
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 13 }, maxRotation: 0 }, border: { display: false } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b7280', font: { size: 13 }, precision: 0, stepSize: 1 }, border: { display: false }, beginAtZero: true, min: 0 },
  },
};

function CanvasChart({ type, data, options, height = 180, chartKey }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const c = new Chart(ref.current, { type, data, options });
    return () => c.destroy();
  }, [chartKey]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div style={{ height, position: 'relative', minWidth: 0 }}><canvas ref={ref} /></div>;
}

function KpiCard({ label, value, sub, trend, borderColor }) {
  const up = trend > 0;
  return (
    <div className="bg-[#0e0e18] border border-white/5 rounded-2xl p-3.5 md:p-5 relative overflow-hidden">
      <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r" style={{ background: borderColor }} />
      <p className="text-gray-500 text-[10px] md:text-xs font-medium uppercase tracking-wider mb-2 md:mb-3 leading-tight">{label}</p>
      <p className="text-2xl md:text-3xl font-black text-white leading-none mb-1.5 md:mb-2">{value}</p>
      <div className="flex items-center gap-2">
        {trend != null && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded ${up ? 'bg-emerald-500/15 text-emerald-400' : 'text-red-400 bg-red-500/15'}`}>
            {up ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
        {sub && <span className="text-gray-600 text-xs">{sub}</span>}
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, action }) {
  return (
    <div className="bg-[#0e0e18] border border-white/5 rounded-2xl p-5 overflow-hidden min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white text-sm font-semibold">{title}</p>
          {subtitle && <p className="text-gray-600 text-xs mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ── TopClientsTable ───────────────────────────────────────────────────────────

function TopClientsTable({ customers }) {
  const [search,  setSearch]  = useState('');
  const [sortCol, setSortCol] = useState('points');
  const [sortDir, setSortDir] = useState('desc');
  const [page,    setPage]    = useState(0);
  const PAGE = 10;

  const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const maxPts = customers.length > 0 ? Math.max(...customers.map(c => c.points), 1) : 1;

  function status(c) {
    const isActive = c.last_visit && c.last_visit > d30;
    const isVip    = c.points >= maxPts * 0.5 && c.visit_count >= 4;
    return isVip ? 'vip' : isActive ? 'actif' : 'inactif';
  }

  const statusCfg = {
    vip:    { label: 'VIP',    cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/25' },
    actif:  { label: 'Actif',  cls: 'bg-emerald-500/15 text-emerald-400' },
    inactif:{ label: 'Inactif',cls: 'bg-gray-700/50 text-gray-500' },
  };

  const filtered = customers.filter(c =>
    c.first_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );

  const sorted = [...filtered].sort((a, b) => {
    let av = a[sortCol], bv = b[sortCol];
    if (sortCol === 'last_visit') { av = av || ''; bv = bv || ''; }
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE));
  const paged = sorted.slice(page * PAGE, (page + 1) * PAGE);

  function sort(col) {
    if (col === sortCol) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
    setPage(0);
  }

  function ThCol({ col, children, className = '' }) {
    const active = sortCol === col;
    return (
      <th className={`text-left px-3 md:px-4 py-3 md:py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition select-none ${className}`}
        onClick={() => sort(col)}>
        <span className="flex items-center gap-1">
          {children}
          <span className={`text-[10px] ${active ? 'text-indigo-400' : 'opacity-0'}`}>{sortDir === 'asc' ? '↑' : '↓'}</span>
        </span>
      </th>
    );
  }

  return (
    <div className="bg-[#0e0e18] border border-white/5 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-white text-sm font-semibold">Top clients</p>
          <p className="text-gray-600 text-xs mt-0.5">{filtered.length} client{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>
            <input type="search" placeholder="Rechercher…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="bg-gray-900 border border-white/5 rounded-xl pl-8 pr-4 py-2 text-gray-200 placeholder-gray-600 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition w-44" />
          </div>
          <button onClick={() => exportCSV(customers)} title="CSV"
            className="p-2 bg-gray-900 border border-white/5 rounded-xl text-gray-500 hover:text-white transition">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/></svg>
          </button>
        </div>
      </div>

      {/* Table */}
      {customers.length === 0 ? (
        <div className="py-14 text-center">
          <div className="flex justify-center mb-3 text-gray-600"><IcoPeople s={36} /></div>
          <p className="text-gray-500 text-sm">Aucun client encore</p>
          <p className="text-gray-600 text-xs mt-1">Scannez vos premiers clients pour voir les statistiques</p>
        </div>
      ) : paged.length === 0 ? (
        <div className="py-10 text-center text-gray-600 text-sm">Aucun résultat pour « {search} »</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <ThCol col="first_name">Nom</ThCol>
                <th className="text-left px-3 md:px-4 py-3 md:py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Téléphone</th>
                <ThCol col="points">Points</ThCol>
                <ThCol col="visit_count" className="hidden md:table-cell">Visites</ThCol>
                <ThCol col="last_visit">Dernière visite</ThCol>
                <th className="text-left px-3 md:px-4 py-3 md:py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c, i) => {
                const s = status(c);
                const sc = statusCfg[s];
                return (
                  <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 md:px-4 py-3 md:py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-gray-800 flex items-center justify-center text-white text-xs font-bold shrink-0">{c.first_name.charAt(0).toUpperCase()}</div>
                        <p className="text-white text-xs md:text-sm font-medium truncate max-w-[80px] md:max-w-none">{c.first_name}</p>
                      </div>
                    </td>
                    <td className="px-3 md:px-4 py-3 md:py-3.5 text-gray-500 text-xs hidden md:table-cell">{c.phone || '—'}</td>
                    <td className="px-3 md:px-4 py-3 md:py-3.5">
                      <span className="text-white font-bold text-sm">{Number(c.points).toLocaleString('fr-FR')}</span>
                      <span className="text-gray-600 text-xs"> pts</span>
                    </td>
                    <td className="px-3 md:px-4 py-3 md:py-3.5 text-gray-300 text-sm hidden md:table-cell">{c.visit_count ?? '—'}</td>
                    <td className="px-3 md:px-4 py-3 md:py-3.5 text-gray-500 text-xs">{fmtDate(c.last_visit)}</td>
                    <td className="px-3 md:px-4 py-3 md:py-3.5">
                      <span className={`inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold leading-4 ${sc.cls}`}>{sc.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-3.5 border-t border-white/5 flex items-center justify-between">
          <p className="text-gray-600 text-xs">Page {page + 1} / {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-xs disabled:opacity-40 transition">← Préc.</button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white text-xs disabled:opacity-40 transition">Suiv. →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AnalyticsTab ──────────────────────────────────────────────────────────────

function ChartEmpty({ icon, msg, sub, height = 160 }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 text-center" style={{ height }}>
      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-1 text-gray-500">
        {icon}
      </div>
      <p className="text-gray-500 text-sm font-medium">{msg}</p>
      {sub && <p className="text-gray-600 text-xs">{sub}</p>}
    </div>
  );
}

// ── DateRangePicker ───────────────────────────────────────────────────────────

const DATE_PRESETS = [
  { id: '7d',     label: '7 derniers jours',   days: 7 },
  { id: '30d',    label: '30 derniers jours',  days: 30 },
  { id: '3m',     label: '3 derniers mois',    days: 90 },
  { id: '6m',     label: '6 derniers mois',    days: 180 },
  { id: 'year',   label: 'Cette année',        days: null },
  { id: 'custom', label: 'Période personnalisée', days: 'custom' },
];

function todayStr() { return new Date().toISOString().slice(0, 10); }

function presetRange(preset) {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  if (preset.days === null) return { from: `${today.getFullYear()}-01-01`, to };
  const from = new Date(Date.now() - preset.days * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

function DateRangePicker({ value, onChange }) {
  const [customFrom, setCustomFrom] = useState(value.from);
  const [customTo,   setCustomTo]   = useState(value.to);
  const isCustom = value.presetId === 'custom';

  function handleSelect(e) {
    const id = e.target.value;
    if (id === 'custom') {
      onChange({ presetId: 'custom', from: value.from, to: value.to });
      return;
    }
    const preset = DATE_PRESETS.find(p => p.id === id);
    if (!preset) return;
    const { from, to } = presetRange(preset);
    onChange({ presetId: id, from, to });
  }

  function applyCustom() {
    if (!customFrom || !customTo || customFrom > customTo) return;
    onChange({ presetId: 'custom', from: customFrom, to: customTo });
  }

  return (
    <div className="bg-[#0e0e18] border border-white/5 rounded-2xl px-4 py-3">
      {/* Dropdown */}
      <div className="relative">
        <select
          value={value.presetId}
          onChange={handleSelect}
          className="w-full appearance-none bg-gray-800 border border-white/8 rounded-xl px-4 py-2.5 pr-9 text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          style={{ colorScheme: 'dark' }}
        >
          {DATE_PRESETS.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        {/* Chevron */}
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {/* Custom date inputs — shown only for "Période personnalisée" */}
      {isCustom && (
        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-white/5">
          <input type="date" value={customFrom} max={customTo || todayStr()}
            onChange={e => setCustomFrom(e.target.value)}
            className="bg-gray-900 border border-white/8 rounded-xl px-3 py-2 text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 min-w-[130px]"
            style={{ colorScheme: 'dark' }} />
          <span className="text-gray-600 text-xs shrink-0">→</span>
          <input type="date" value={customTo} min={customFrom} max={todayStr()}
            onChange={e => setCustomTo(e.target.value)}
            className="bg-gray-900 border border-white/8 rounded-xl px-3 py-2 text-gray-200 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 min-w-[130px]"
            style={{ colorScheme: 'dark' }} />
          <button onClick={applyCustom} disabled={!customFrom || !customTo || customFrom > customTo}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl text-white text-xs font-semibold transition-all active:scale-95 shrink-0">
            Appliquer
          </button>
        </div>
      )}

      {/* Date range label for preset selections */}
      {!isCustom && (
        <p className="text-gray-600 text-[10px] mt-2">
          Du {new Date(value.from + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
          {' '}au {new Date(value.to + 'T00:00:00Z').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}

function AnalyticsTab({ token, color }) {
  const defaultRange = () => {
    const to   = todayStr();
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    return { presetId: '30d', from, to };
  };

  const [dateRange,  setDateRange]  = useState(defaultRange);
  const [data,       setData]       = useState(null);
  const [firstLoad,  setFirstLoad]  = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [err,        setErr]        = useState('');
  const [loadKey,    setLoadKey]    = useState(0);
  const loadingRef    = useRef(false);
  const dateRangeRef  = useRef(dateRange);
  dateRangeRef.current = dateRange;

  async function load() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    const { from, to } = dateRangeRef.current;
    if (!data) setFirstLoad(true); else setRefreshing(true);
    setErr('');
    try {
      console.log(`[Analytics] Chargement période ${from} → ${to}`);
      const d = await getAnalytics(token, { dateFrom: from, dateTo: to });
      console.log('[Analytics] Reçu:', { customers: d.active_customers + d.inactive_customers, scans: d.scans_per_day?.reduce((s, x) => s + x.count, 0), points: d.total_points_distributed });
      setData(d);
      setLoadKey(k => k + 1);
      setLastUpdate(new Date());
    } catch (e) {
      console.error('[Analytics] Erreur:', e.message);
      setErr(e.message);
    } finally {
      setFirstLoad(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }

  // Re-fetch immediately when date range changes; also auto-refresh every 30s
  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [dateRange.from, dateRange.to]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRangeChange(range) {
    setDateRange(range);
  }

  const fmtTime = d => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const periodLabel = DATE_PRESETS.find(p => p.id === dateRange.presetId)?.label ?? `${dateRange.from} – ${dateRange.to}`;

  const LoadingSkeleton = () => (
    <div className="px-3 md:px-6 pt-4 pb-6 space-y-4">
      <Skel h="h-24" rounded="rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="bg-[#0e0e18] border border-white/5 rounded-2xl p-4 space-y-3"><Skel h="h-3" w="w-20" /><Skel h="h-8" w="w-16" /><Skel h="h-3" w="w-24" /></div>)}
      </div>
      <div className="grid md:grid-cols-5 gap-3 md:gap-4">
        <div className="md:col-span-3 bg-[#0e0e18] border border-white/5 rounded-2xl p-5"><Skel h="h-3" w="w-32" /><div className="mt-4"><Skel h="h-40" /></div></div>
        <div className="md:col-span-2 bg-[#0e0e18] border border-white/5 rounded-2xl p-5"><Skel h="h-3" w="w-28" /><div className="mt-4"><Skel h="h-40" /></div></div>
      </div>
    </div>
  );

  if (firstLoad) return <LoadingSkeleton />;

  if (err && !data) return (
    <div className="px-5 py-16 text-center">
      <div className="flex justify-center mb-3 text-red-400"><IcoWarn s={36} /></div>
      <p className="text-red-400 text-sm mb-1">Impossible de charger les statistiques</p>
      <p className="text-gray-600 text-xs mb-5">{err}</p>
      <button onClick={load} className="px-4 py-2 bg-gray-800 rounded-xl text-white text-sm hover:bg-gray-700 transition">Réessayer</button>
    </div>
  );
  if (!data) return null;

  const brand = color || CHART_COLORS.indigo;
  const DOW   = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const totalCustomers = data.active_customers + data.inactive_customers;
  const activePct      = totalCustomers > 0 ? Math.round((data.active_customers / totalCustomers) * 100) : 0;
  const periodScans    = data.scans_per_day.reduce((s, d) => s + d.count, 0);
  const ptsDist        = data.total_points_distributed || 0;
  const ptsRedeemed    = Math.min(data.total_points_redeemed || 0, ptsDist);
  const ptsNet         = Math.max(0, ptsDist - ptsRedeemed);

  const weeklyNew = data.cumulative_customers.map((w, i, arr) => ({
    label: w.label,
    count: i === 0 ? w.count : Math.max(0, w.count - arr[i - 1].count),
  })).slice(-8);

  const hasScans       = periodScans > 0;
  const hasWeekdayData = data.scans_by_weekday.some(v => v > 0);
  const hasWeeklyData  = weeklyNew.some(w => w.count > 0);

  const ck = String(loadKey);
  const TICK_OPTS_SM = { font: { size: 13 }, color: '#6b7280', precision: 0, stepSize: 1 };
  const noPeriodData = !hasScans && ptsDist === 0;

  return (
    <div className="px-3 md:px-6 pt-4 pb-8 space-y-4 w-full overflow-x-hidden">

      {/* ── Date range picker ────────────────────────────────────────────────── */}
      <DateRangePicker value={dateRange} onChange={handleRangeChange} />

      {/* Header: timestamp + refresh */}
      <div className="flex items-center justify-between">
        <p className="text-gray-600 text-xs">
          {lastUpdate ? `Mis à jour à ${fmtTime(lastUpdate)}` : ''}
        </p>
        <button onClick={load} disabled={refreshing}
          className="flex items-center gap-1.5 text-gray-500 hover:text-white text-xs px-3 py-1.5 rounded-xl hover:bg-white/5 transition-all active:scale-95 disabled:opacity-50">
          <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/>
          </svg>
          {refreshing ? 'Chargement…' : 'Actualiser'}
        </button>
      </div>

      {/* Erreur non-bloquante */}
      {err && data && (
        <div className="bg-red-500/8 border border-red-500/18 rounded-xl px-4 py-2.5 text-red-400 text-xs">
          Erreur de rafraîchissement : {err}
        </div>
      )}

      {/* No data for period */}
      {noPeriodData && (
        <div className="bg-[#0e0e18] border border-white/5 rounded-2xl py-10 text-center">
          <div className="flex justify-center mb-3 text-gray-600"><IcoInbox s={36} /></div>
          <p className="text-gray-400 text-sm font-medium">Aucune donnée sur cette période</p>
          <p className="text-gray-600 text-xs mt-1">Essayez une plage de dates plus large</p>
        </div>
      )}

      {/* ── Row 1: KPI cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total clients"     value={totalCustomers.toLocaleString('fr-FR')} sub="inscrits" borderColor={CHART_COLORS.indigo} />
        <KpiCard label="Scans"             value={periodScans.toLocaleString('fr-FR')} sub={periodLabel} borderColor={CHART_COLORS.amber} />
        <KpiCard label="Points distribués" value={ptsDist.toLocaleString('fr-FR')} sub={periodLabel} borderColor={CHART_COLORS.emerald} />
        <KpiCard label="Récompenses"       value={data.total_redeemed.toLocaleString('fr-FR')} sub={periodLabel} borderColor={CHART_COLORS.rose} />
      </div>

      {/* ── Row 2: Scans/day (3/5) + Weekday (2/5) ───────────────────────────── */}
      <div className="grid md:grid-cols-5 gap-3 md:gap-4">
        <div className="md:col-span-3 min-w-0">
          <ChartCard title="Scans par jour" subtitle={periodLabel}>
            {hasScans ? (
              <CanvasChart key={`sd-${ck}`} chartKey={ck} type="line" height={160}
                data={{
                  labels: data.scans_per_day.map(d => d.day.slice(5)),
                  datasets: [{ data: data.scans_per_day.map(d => d.count), borderColor: brand, backgroundColor: brand + '18', fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2 }],
                }}
                options={{ ...BASE_CHART_OPTS, scales: { ...BASE_CHART_OPTS.scales, x: { ...BASE_CHART_OPTS.scales.x, ticks: { ...TICK_OPTS_SM, maxTicksLimit: 7 } }, y: { ...BASE_CHART_OPTS.scales.y, ticks: TICK_OPTS_SM } } }}
              />
            ) : (
              <ChartEmpty icon={<IcoTrend s={22} />} msg="Aucun scan sur cette période" sub="Essayez une plage de dates plus large" />
            )}
          </ChartCard>
        </div>
        <div className="md:col-span-2 min-w-0">
          <ChartCard title="Visites par jour" subtitle={periodLabel}>
            {hasWeekdayData ? (
              <CanvasChart key={`dow-${ck}`} chartKey={ck} type="bar" height={160}
                data={{
                  labels: DOW,
                  datasets: [{ data: data.scans_by_weekday, backgroundColor: CHART_COLORS.amber + 'bb', hoverBackgroundColor: CHART_COLORS.amber, borderRadius: 4, borderSkipped: false }],
                }}
                options={{ ...BASE_CHART_OPTS, scales: { ...BASE_CHART_OPTS.scales, x: { ...BASE_CHART_OPTS.scales.x, ticks: TICK_OPTS_SM }, y: { ...BASE_CHART_OPTS.scales.y, ticks: TICK_OPTS_SM } } }}
              />
            ) : (
              <ChartEmpty icon={<IcoCal s={22} />} msg="Aucune donnée sur cette période" />
            )}
          </ChartCard>
        </div>
      </div>

      {/* ── Row 3: New clients + Points donut ────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-3 md:gap-4">
        <ChartCard title="Nouveaux clients" subtitle={periodLabel}>
          {hasWeeklyData ? (
            <CanvasChart key={`wc-${ck}`} chartKey={ck} type="bar" height={160}
              data={{
                labels: weeklyNew.map(w => w.label),
                datasets: [{ data: weeklyNew.map(w => w.count), backgroundColor: CHART_COLORS.emerald + 'bb', hoverBackgroundColor: CHART_COLORS.emerald, borderRadius: 4, borderSkipped: false }],
              }}
              options={{ ...BASE_CHART_OPTS, scales: { ...BASE_CHART_OPTS.scales, x: { ...BASE_CHART_OPTS.scales.x, ticks: { ...TICK_OPTS_SM, maxRotation: 30, maxTicksLimit: 8 } }, y: { ...BASE_CHART_OPTS.scales.y, ticks: TICK_OPTS_SM } } }}
            />
          ) : (
            <ChartEmpty icon={<IcoPeople s={22} />} msg="Aucun nouveau client sur cette période" />
          )}
        </ChartCard>

        <ChartCard title="Points distribués vs échangés" subtitle={periodLabel}>
          {ptsDist === 0 ? (
            <ChartEmpty icon={<IcoStar s={22} />} msg="Aucun point distribué sur cette période" height={170} />
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0" style={{ height: 170, position: 'relative' }}>
                <CanvasChart key={`donut-${ck}`} chartKey={ck} type="doughnut" height={170}
                  data={{
                    labels: ['Points actifs', 'Points échangés'],
                    datasets: [{ data: [ptsNet, ptsRedeemed], backgroundColor: [CHART_COLORS.indigo, CHART_COLORS.rose], borderColor: '#0e0e18', borderWidth: 3, hoverOffset: 4 }],
                  }}
                  options={{
                    responsive: true, maintainAspectRatio: false,
                    interaction: { mode: 'nearest', intersect: true },
                    plugins: {
                      legend: { display: true, position: 'bottom', labels: { color: '#6b7280', font: { size: 13 }, padding: 12, boxWidth: 10, usePointStyle: true } },
                      tooltip: { ...TOOLTIP_OPTS, displayColors: true },
                    },
                    cutout: '68%',
                  }}
                />
              </div>
              <div className="shrink-0 flex flex-row sm:flex-col gap-4 sm:gap-3 justify-around sm:justify-start">
                <div><p className="text-gray-600 text-[10px] uppercase tracking-wide">Distribués</p><p className="text-white font-bold text-base leading-none">{ptsDist.toLocaleString('fr-FR')}</p></div>
                <div><p className="text-gray-600 text-[10px] uppercase tracking-wide">Échangés</p><p className="text-rose-400 font-bold text-base leading-none">{ptsRedeemed.toLocaleString('fr-FR')}</p></div>
                <div><p className="text-gray-600 text-[10px] uppercase tracking-wide">Taux</p><p className="text-white font-bold text-base leading-none">{Math.round((ptsRedeemed / ptsDist) * 100)}%</p></div>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Row 4: Top clients table ──────────────────────────────────────────── */}
      <TopClientsTable customers={data.top_customers} />

      {/* ── Row 5: Analysis summary cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#0e0e18] border border-white/5 rounded-2xl p-4">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Actifs (période)</p>
          <p className="text-emerald-400 text-2xl font-black leading-none">{activePct}%</p>
          <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${activePct}%` }} /></div>
          <p className="text-gray-600 text-[10px] mt-1.5">{data.active_customers} / {totalCustomers}</p>
        </div>
        <div className="bg-[#0e0e18] border border-white/5 rounded-2xl p-4">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Fréq. moy.</p>
          <p className="text-white text-2xl font-black leading-none">{data.avg_visit_frequency}</p>
          <p className="text-gray-600 text-[10px] mt-1.5">visites / client actif</p>
        </div>
        <div className="bg-[#0e0e18] border border-white/5 rounded-2xl p-4">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Rétention</p>
          <p className={`text-2xl font-black leading-none ${data.retention_rate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>{data.retention_rate}%</p>
          <p className="text-gray-600 text-[10px] mt-1.5">revenus 2x+ (all time)</p>
        </div>
        <div className="bg-[#0e0e18] border border-white/5 rounded-2xl p-4">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Inactifs</p>
          <p className={`text-2xl font-black leading-none ${data.inactive_customers > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{data.inactive_customers}</p>
          <p className="text-gray-600 text-[10px] mt-1.5">hors période</p>
        </div>
      </div>

    </div>
  );
}

// ── Main DashboardPage ────────────────────────────────────────────────────────

export default function DashboardPage({ auth, dashData, dashLoading, onLogout, onRefresh }) {
  const [tab, setTab]           = useState('home');
  const [showScan, setShowScan] = useState(false);
  const cameraStreamRef         = useRef(null);

  // Pre-acquire camera stream so iOS Safari only asks permission once per session.
  // The stream stays alive in cameraStreamRef; QrReader clones it for each scan session.
  async function openScanner() {
    if (!cameraStreamRef.current?.active && navigator.mediaDevices?.getUserMedia) {
      try {
        cameraStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch { /* QrReader will request its own permission as fallback */ }
    }
    setShowScan(true);
  }

  const merchant  = dashData?.merchant ?? auth.merchant;
  const color     = merchant.color || '#6366f1';
  const stats     = dashData?.stats;
  const customers = dashData?.customers ?? [];
  const rewards   = dashData?.rewards   ?? [];

  const TABS = [
    { id: 'home',      label: 'Accueil',      short: 'Accueil', Icon: IconHome     },
    { id: 'clients',   label: 'Clients',      short: 'Clients', Icon: IconUsers    },
    { id: 'rewards',   label: 'Récompenses',  short: 'Récomp.', Icon: IconGift     },
    { id: 'analytics', label: 'Statistiques', short: 'Stats',   Icon: IconChart    },
    { id: 'settings',  label: 'Paramètres',   short: 'Compte',  Icon: IconSettings },
  ];

  const TAB_TITLES = {
    home: 'Tableau de bord', clients: 'Clients', rewards: 'Récompenses',
    analytics: 'Statistiques', settings: 'Paramètres',
  };

  return (
    <div className="min-h-dvh bg-[#0f0f14] flex">

      {/* ── Desktop sidebar ───────────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-56 bg-[#0c0c14] border-r border-white/5 z-40">
        <div className="px-4 py-5 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: color }}>
              {merchant.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white font-semibold text-sm truncate leading-none">{merchant.name}</p>
              <p className="text-gray-600 text-xs capitalize mt-0.5">{merchant.plan ?? 'free'}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${active ? 'bg-indigo-500/12 text-indigo-300' : 'text-gray-500 hover:bg-white/[0.04] hover:text-gray-200'}`}>
                <span className="shrink-0"><Icon /></span>
                {label}
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />}
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-white/5 space-y-0.5 shrink-0">
          <button onClick={onRefresh}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-white/[0.04] hover:text-gray-200 transition-all">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
            Actualiser
            {dashLoading && <div className="ml-auto w-3.5 h-3.5 border border-gray-600 border-t-gray-300 rounded-full animate-spin" />}
          </button>
          <button onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-300 hover:bg-white/[0.04] transition-all">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"/></svg>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-dvh md:ml-56">

        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-5 pt-safe-top pb-4 pt-5 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ backgroundColor: color }}>
              {merchant.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">{merchant.name}</p>
              <p className="text-gray-600 text-xs capitalize">{merchant.plan ?? 'free'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {dashLoading && <div className="w-4 h-4 border border-gray-700 border-t-gray-400 rounded-full animate-spin" />}
            <button onClick={onRefresh} title="Actualiser"
              className="w-9 h-9 rounded-xl bg-gray-900 hover:bg-gray-800 active:scale-90 flex items-center justify-center text-gray-500 hover:text-white transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
            </button>
            <button onClick={onLogout} title="Déconnexion"
              className="w-9 h-9 rounded-xl bg-gray-900 hover:bg-gray-800 active:scale-90 flex items-center justify-center text-gray-500 hover:text-white transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75"/></svg>
            </button>
          </div>
        </header>

        {/* Desktop header */}
        <header className="hidden md:flex items-center justify-between px-6 py-3.5 border-b border-white/5 shrink-0 sticky top-0 bg-[#0f0f14]/95 backdrop-blur z-20">
          <h1 className="text-white font-semibold text-base">{TAB_TITLES[tab] || 'Dashboard'}</h1>
          <div className="flex items-center gap-2">
            {dashLoading && <div className="w-4 h-4 border border-gray-700 border-t-gray-400 rounded-full animate-spin" />}
            <button onClick={onRefresh}
              className="flex items-center gap-1.5 text-gray-500 hover:text-white text-xs px-3 py-1.5 rounded-lg hover:bg-white/5 transition-all">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>
              Actualiser
            </button>
          </div>
        </header>

        {/* Tab content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-6">
          <TrialBanner merchant={merchant} token={auth.token} />
          {tab === 'home' && merchant.subscription_status !== 'suspended' && (
            <OnboardingChecklist merchant={merchant} stats={stats} rewards={rewards} />
          )}
          {tab === 'home'      && <HomeTab merchant={merchant} stats={stats} rewards={rewards} token={auth.token} onScanClick={openScanner} />}
          {tab === 'clients'   && <ClientsTab customers={customers} rewards={rewards} token={auth.token} onRewardsChange={onRefresh} />}
          {tab === 'rewards'   && <RewardsTab rewards={rewards} token={auth.token} onRewardsChange={onRefresh} />}
          {tab === 'analytics' && <AnalyticsTab token={auth.token} color={color} />}
          {tab === 'settings'  && <SettingsTab merchant={merchant} token={auth.token} onRefresh={onRefresh} />}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#0f0f14]/95 backdrop-blur border-t border-white/5 pb-safe-bottom z-30">
          <div className="flex">
            {TABS.map(({ id, label, short, Icon }) => {
              const active = tab === id;
              return (
                <button key={id} onClick={() => setTab(id)}
                  className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 transition-colors ${active ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`}>
                  <div className={`transition-transform ${active ? 'scale-110' : ''}`}><Icon /></div>
                  <span className="text-[10px] font-medium whitespace-nowrap">{short || label}</span>
                  {active && <span className="absolute bottom-0 w-6 h-0.5 rounded-full" style={{ background: color }} />}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {showScan && (
        <ScanModal token={auth.token} onClose={() => { setShowScan(false); onRefresh(); }} onRefresh={onRefresh} cameraStream={cameraStreamRef.current} />
      )}
    </div>
  );
}
