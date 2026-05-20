import { useState } from 'react';
import ScanModal  from './ScanModal.jsx';
import { addReward, deleteReward } from '../api.js';

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

function ClientsTab({ customers }) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? customers.filter(c =>
        c.first_name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').includes(search)
      )
    : customers;

  return (
    <div className="px-5 pt-2 pb-6">
      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          type="search"
          placeholder="Rechercher par prénom ou téléphone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-900 border border-white/5 rounded-2xl pl-9 pr-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition"
        />
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
          const lastVisit = c.last_visit ? fmtRelative(c.last_visit) : null;
          return (
            <div key={c.id} className="bg-gray-900 border border-white/5 rounded-2xl px-4 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-white font-bold text-sm shrink-0">
                {c.first_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{c.first_name}</p>
                <p className="text-gray-600 text-xs truncate">
                  {c.phone || '—'}
                  {lastVisit ? ` · ${lastVisit}` : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white font-black text-lg leading-none">{c.points}</p>
                <p className="text-gray-600 text-[10px] uppercase tracking-wide">pts</p>
              </div>
            </div>
          );
        })}
      </div>
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
    { id: 'home',    label: 'Accueil',     Icon: IconHome  },
    { id: 'clients', label: 'Clients',     Icon: IconUsers },
    { id: 'rewards', label: 'Récompenses', Icon: IconGift  },
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
        {tab === 'home'    && <HomeTab    merchant={merchant} stats={stats} onScanClick={() => setShowScan(true)} />}
        {tab === 'clients' && <ClientsTab customers={customers} />}
        {tab === 'rewards' && <RewardsTab rewards={rewards} token={auth.token} onRewardsChange={onRefresh} />}
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
