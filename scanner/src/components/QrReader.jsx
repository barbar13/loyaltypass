import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QrReader({ active, onScan }) {
  const scannerRef = useRef(null);
  const [camError, setCamError] = useState(null);

  useEffect(() => {
    if (!active) {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
      return;
    }

    let cancelled = false;
    setCamError(null);

    // Small delay so the DOM element is ready (especially after re-mount)
    const timer = setTimeout(async () => {
      if (cancelled) return;

      const scanner = new Html5Qrcode('qr-viewport');
      scannerRef.current = scanner;

      const config = { fps: 12, qrbox: { width: 220, height: 220 }, aspectRatio: 1 };
      const onSuccess = (text) => {
        if (!scanner.isScanning) return;
        scanner.stop().catch(() => {});
        onScan(text);
      };
      const onErr = () => {};

      try {
        // Prefer rear camera (environment) — required for iPhone back cam
        await scanner.start({ facingMode: 'environment' }, config, onSuccess, onErr);
      } catch {
        // Fallback: let the browser pick any camera
        try {
          await scanner.start({ facingMode: 'user' }, config, onSuccess, onErr);
        } catch (err) {
          if (!cancelled) setCamError('Impossible d\'accéder à la caméra. Vérifiez les permissions dans les réglages.');
        }
      }
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [active, onScan]);

  return (
    <div className="relative w-full aspect-square max-w-sm mx-auto">
      {/* Camera feed injected here by html5-qrcode */}
      <div id="qr-viewport" className="w-full h-full rounded-2xl overflow-hidden bg-gray-900" />

      {/* Corner guide overlay */}
      {!camError && active && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute inset-8">
            {/* Corners */}
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

      {/* Camera permission error */}
      {camError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 rounded-2xl px-6 text-center animate-fade-in">
          <svg className="w-12 h-12 text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
          </svg>
          <p className="text-gray-400 text-sm">{camError}</p>
        </div>
      )}
    </div>
  );
}
