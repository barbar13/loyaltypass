import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const STATE_SCANNING = 1;
const STATE_PAUSED   = 2;

// stream prop: a persistent MediaStream from DashboardPage.
// We CLONE it before passing to html5-qrcode so that scanner.stop()
// stops the clone's tracks, not the original — preventing iOS Safari
// from requiring a new permission prompt on the next modal open.
export default function QrReader({ active, onScan, stream: externalStream }) {
  const scannerRef = useRef(null);
  const onScanRef  = useRef(onScan);
  const activeRef  = useRef(active);
  const [camError, setCamError] = useState(null);

  onScanRef.current = onScan;
  activeRef.current = active;

  useEffect(() => {
    let cancelled = false;
    setCamError(null);

    const timer = setTimeout(async () => {
      if (cancelled) return;

      const scanner = new Html5Qrcode('qr-viewport');
      scannerRef.current = scanner;

      const config = { fps: 15, qrbox: { width: 220, height: 220 } };
      const onSuccess = (text) => {
        try { scanner.pause(false); } catch {}
        onScanRef.current(text);
      };

      let started = false;

      // Try reusing the persistent stream first (no permission dialog)
      if (externalStream?.active) {
        try {
          const clone = externalStream.clone(); // clone so stop() doesn't kill original
          await scanner.startWithStream(clone, config, onSuccess, () => {});
          started = true;
        } catch { /* fall through to normal start */ }
      }

      // Fall back: request camera normally (first use or stream expired)
      if (!started) {
        try {
          await scanner.start({ facingMode: 'environment' }, config, onSuccess, () => {});
          started = true;
        } catch {
          try {
            await scanner.start({ facingMode: 'user' }, config, onSuccess, () => {});
            started = true;
          } catch {
            if (!cancelled) setCamError('Impossible d\'accéder à la caméra. Vérifiez les permissions dans les réglages.');
            return;
          }
        }
      }

      // Apply initial active state (may have changed while camera was starting)
      if (!activeRef.current) {
        try { scanner.pause(false); } catch {}
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) s.stop().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume or pause scanning when active prop changes (stream stays alive)
  useEffect(() => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      const state = s.getState?.();
      if (active && state === STATE_PAUSED) {
        s.resume();
      } else if (!active && state === STATE_SCANNING) {
        s.pause(false);
      }
    } catch {}
  }, [active]);

  return (
    <div className="relative w-full aspect-square max-w-sm mx-auto">
      <div id="qr-viewport" className="w-full h-full rounded-2xl overflow-hidden bg-gray-900" />

      {!camError && active && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute inset-8">
            {[
              'top-0 left-0 border-t-2 border-l-2 rounded-tl-md',
              'top-0 right-0 border-t-2 border-r-2 rounded-tr-md',
              'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md',
              'bottom-0 right-0 border-b-2 border-r-2 rounded-br-md',
            ].map((cls, i) => (
              <div key={i} className={`absolute w-8 h-8 border-white/70 ${cls}`} />
            ))}
          </div>
        </div>
      )}

      {camError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 rounded-2xl px-6 text-center animate-fade-in">
          <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
          </svg>
          <p className="text-gray-400 text-sm">{camError}</p>
          <p className="text-gray-600 text-xs mt-2">Autorisez l'accès dans Réglages → Safari → Caméra</p>
        </div>
      )}
    </div>
  );
}
