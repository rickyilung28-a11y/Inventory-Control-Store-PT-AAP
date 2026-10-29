import React, { useEffect } from 'react';
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  AlertOctagon,
  X,
  Volume2,
  ArrowRight,
  ShoppingCart,
} from 'lucide-react';

export interface ToastItemPreview {
  sku: string;
  name: string;
  currentStock: number;
  minStock: number;
  unit: string;
  status: 'CRITICAL' | 'WARNING';
}

export interface ToastData {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  voucherNumber?: string;
  itemsPreview?: ToastItemPreview[];
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  durationMs?: number;
}

interface ToastProps {
  toast: ToastData | null;
  onDismiss: () => void;
  onViewVoucher?: (voucherNumber: string) => void;
}

export const ToastNotification: React.FC<ToastProps> = ({
  toast,
  onDismiss,
  onViewVoucher,
}) => {
  useEffect(() => {
    if (!toast) return;
    const dwell = toast.durationMs || (toast.itemsPreview?.length ? 12000 : 9000);
    const timer = setTimeout(() => {
      onDismiss();
    }, dwell);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isWarning = toast.type === 'warning';
  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full px-3 sm:px-0 animate-in slide-in-from-bottom-5 duration-200 no-print">
      <div
        className={`rounded-2xl border p-4 shadow-2xl backdrop-blur-md ${
          isSuccess
            ? 'bg-emerald-950/95 border-emerald-500/40 text-white'
            : isError
            ? 'bg-red-950/95 border-red-500/50 text-white'
            : isWarning
            ? 'bg-amber-950/95 border-amber-500/50 text-white'
            : 'bg-slate-900/95 border-slate-700 text-white'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {isSuccess ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : isError ? (
              <AlertOctagon className="w-5 h-5 text-red-400 animate-bounce" />
            ) : isWarning ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
            ) : (
              <Info className="w-5 h-5 text-sky-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10.5px] font-mono tracking-wider uppercase font-bold flex items-center gap-1 ${
                  isError
                    ? 'text-red-300'
                    : isWarning
                    ? 'text-amber-300'
                    : 'text-emerald-400'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                {toast.itemsPreview?.length
                  ? 'PENGINGAT OTOMATIS STOK MINIMUM'
                  : 'NOTIFIKASI REAL-TIME'}
              </span>
            </div>
            <h4 className="text-sm font-bold text-white mt-0.5 leading-snug">{toast.title}</h4>
            <p className="text-xs text-slate-200 mt-1 leading-relaxed">{toast.message}</p>

            {/* Daftar Ringkas Barang Mendekati / Di Bawah Min Stock */}
            {toast.itemsPreview && toast.itemsPreview.length > 0 && (
              <div className="mt-2.5 bg-black/30 border border-white/15 rounded-xl p-2.5 space-y-1.5 max-h-40 overflow-y-auto">
                {toast.itemsPreview.slice(0, 4).map((item) => (
                  <div
                    key={item.sku}
                    className="flex items-center justify-between gap-2 text-[11px] bg-white/5 px-2.5 py-1.5 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white truncate">{item.name}</div>
                      <div className="font-mono text-[10px] text-slate-300">{item.sku}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-white">
                        Stok: {item.currentStock} / Min: {item.minStock} {item.unit}
                      </div>
                      <span
                        className={`inline-block text-[9.5px] font-extrabold uppercase px-1.5 py-0.2 rounded ${
                          item.status === 'CRITICAL'
                            ? 'bg-red-500/30 text-red-200 border border-red-400/40'
                            : 'bg-amber-500/30 text-amber-200 border border-amber-400/40'
                        }`}
                      >
                        {item.status === 'CRITICAL' ? 'Di Bawah Min' : 'Mendekati Min'}
                      </span>
                    </div>
                  </div>
                ))}
                {toast.itemsPreview.length > 4 && (
                  <div className="text-[10.5px] text-center text-slate-300 font-medium pt-0.5">
                    +{toast.itemsPreview.length - 4} barang lainnya perlu pemesanan ulang
                  </div>
                )}
              </div>
            )}

            {(toast.voucherNumber || toast.actionLabel || toast.secondaryActionLabel) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {toast.voucherNumber && onViewVoucher && (
                  <button
                    type="button"
                    onClick={() => {
                      onViewVoucher(toast.voucherNumber!);
                      onDismiss();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    <span>Buka Dokumen {toast.voucherNumber}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {toast.actionLabel && toast.onAction && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.onAction?.();
                      onDismiss();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-slate-950 hover:bg-slate-100 rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 text-red-600" />
                    <span>{toast.actionLabel}</span>
                  </button>
                )}

                {toast.secondaryActionLabel && toast.onSecondaryAction && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.onSecondaryAction?.();
                      onDismiss();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 border border-white/20 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    <span>{toast.secondaryActionLabel}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 p-1 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
            title="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
