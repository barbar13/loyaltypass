(function () {
  try { if (localStorage.getItem('fidelyzio_cookie_consent')) return; } catch (_) { return; }

  const banner = document.createElement('div');
  banner.id = 'fz-cookie-banner';
  banner.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
      <p style="margin:0;font-size:13px;color:rgba(255,255,255,.75);line-height:1.5;flex:1;min-width:200px">
        Fidelyzio utilise uniquement des cookies techniques nécessaires au fonctionnement du service. Aucun cookie publicitaire.
      </p>
      <div style="display:flex;gap:8px;flex-shrink:0">
        <a href="/privacy" style="display:inline-flex;align-items:center;padding:8px 14px;border:1px solid rgba(255,255,255,.2);border-radius:8px;color:rgba(255,255,255,.6);font-size:13px;font-weight:600;text-decoration:none;transition:border-color .15s" onmouseover="this.style.borderColor='rgba(255,255,255,.5)'" onmouseout="this.style.borderColor='rgba(255,255,255,.2)'">En savoir plus</a>
        <button onclick="fzAcceptCookies()" style="display:inline-flex;align-items:center;padding:8px 18px;background:#F59E0B;border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s" onmouseover="this.style.background='#D97706'" onmouseout="this.style.background='#F59E0B'">J'accepte</button>
      </div>
    </div>`;
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#0a0a0a;padding:14px 24px;border-top:1px solid rgba(255,255,255,.08);box-shadow:0 -4px 24px rgba(0,0,0,.3)';

  window.fzAcceptCookies = function () {
    try { localStorage.setItem('fidelyzio_cookie_consent', 'true'); } catch (_) {}
    const el = document.getElementById('fz-cookie-banner');
    if (el) el.remove();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(banner));
  } else {
    document.body.appendChild(banner);
  }
})();
