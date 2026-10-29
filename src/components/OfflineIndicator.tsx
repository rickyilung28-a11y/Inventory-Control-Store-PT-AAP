import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xl border border-amber-400/40 no-print">
      <WifiOff className="w-4 h-4 shrink-0 animate-bounce" />
      <div>
        <div>Mode Offline Android / Web Aktif</div>
        <div className="text-[10px] font-normal text-amber-100">
          Aktivitas disimpan lokal &amp; otomatis tersinkron ke server saat koneksi pulih.
        </div>
      </div>
    </div>
  );
};
