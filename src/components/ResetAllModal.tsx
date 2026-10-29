import React, { useState } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  X,
  CheckCircle2,
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  PackageX,
} from 'lucide-react';

interface ResetAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: {
    stockCount: number;
    lpbCount: number;
    sivCount: number;
    movementCount: number;
    opnameCount: number;
  };
  onResetAllEmpty: () => Promise<void>;
  onResetTransactionsZeroStock: () => Promise<void>;
  onRestoreDemoData: () => void;
}

export const ResetAllModal: React.FC<ResetAllModalProps> = ({
  isOpen,
  onClose,
  stats,
  onResetAllEmpty,
  onResetTransactionsZeroStock,
  onRestoreDemoData,
}) => {
  const [selectedOption, setSelectedOption] = useState<
    'EMPTY_ALL' | 'ZERO_STOCK_ONLY' | 'RESTORE_DEMO'
  >('EMPTY_ALL');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      if (selectedOption === 'EMPTY_ALL') {
        await onResetAllEmpty();
      } else if (selectedOption === 'ZERO_STOCK_ONLY') {
        await onResetTransactionsZeroStock();
      } else {
        onRestoreDemoData();
      }
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Reset All — Kosongkan Transaksi &amp; Stok Store
              </h3>
              <p className="text-xs text-slate-400">
                Kosongkan kembali seluruh data LPB, Stok Barang, SIV, dan Kartu Stok
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Current Data Summary */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Ringkasan Data Saat Ini yang Akan Direset:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {stats.lpbCount}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Dokumen LPB</div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {stats.stockCount}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Item Stok</div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-amber-500 shrink-0" />
                <div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {stats.sivCount}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Nota SIV</div>
                </div>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-purple-500 shrink-0" />
                <div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {stats.movementCount}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">Mutasi Stok</div>
                </div>
              </div>
            </div>
          </div>

          {/* Selection Options */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Pilih Mode Reset Data:
            </label>

            {/* Option 1: Kosongkan Semua (LPB, Stok, SIV Kosong Total) */}
            <label
              onClick={() => setSelectedOption('EMPTY_ALL')}
              className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                selectedOption === 'EMPTY_ALL'
                  ? 'border-red-500 bg-red-50/70 dark:bg-red-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="resetMode"
                checked={selectedOption === 'EMPTY_ALL'}
                onChange={() => setSelectedOption('EMPTY_ALL')}
                className="mt-1 text-red-600 focus:ring-red-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
                    Reset All — Kosongkan Semua (LPB, Stok &amp; SIV Kosong Total)
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-red-600 text-white shrink-0">
                    0 DATA
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Menghapus dan mengosongkan seluruh transaksi <strong>LPB (0)</strong>,{' '}
                  <strong>Daftar &amp; Saldo Stok Barang (0)</strong>, <strong>Nota SIV (0)</strong>,{' '}
                  <strong>Kartu Stok (0)</strong>, serta <strong>Sesi Stock Opname</strong> hingga bersih kembali dari awal. Akun pengguna, lokasi rak, dan Cost Center tetap tersimpan.
                </p>
              </div>
            </label>

            {/* Option 2: Kosongkan Transaksi (LPB & SIV) & Nolkan Saldo Stok (Master Barang Tetap Ada) */}
            <label
              onClick={() => setSelectedOption('ZERO_STOCK_ONLY')}
              className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                selectedOption === 'ZERO_STOCK_ONLY'
                  ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="resetMode"
                checked={selectedOption === 'ZERO_STOCK_ONLY'}
                onChange={() => setSelectedOption('ZERO_STOCK_ONLY')}
                className="mt-1 text-amber-600 focus:ring-amber-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <PackageX className="w-4 h-4 text-amber-500 shrink-0" />
                    Kosongkan Transaksi (LPB &amp; SIV) &amp; Nolkan Saldo Stok (Stok = 0)
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-500 text-slate-950 shrink-0">
                    STOK = 0
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Mengosongkan seluruh dokumen <strong>LPB</strong>, <strong>Nota SIV</strong>, dan{' '}
                  <strong>Kartu Stok</strong>, serta mereset jumlah stok seluruh barang menjadi{' '}
                  <strong>0</strong> (daftar Material Code &amp; Nama Barang tetap tersimpan).
                </p>
              </div>
            </label>

            {/* Option 3: Kembalikan ke Data Demo Awal */}
            <label
              onClick={() => setSelectedOption('RESTORE_DEMO')}
              className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                selectedOption === 'RESTORE_DEMO'
                  ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name="resetMode"
                checked={selectedOption === 'RESTORE_DEMO'}
                onChange={() => setSelectedOption('RESTORE_DEMO')}
                className="mt-1 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-emerald-500 shrink-0" />
                    Kembalikan ke Data Contoh Awal (Data Demo Pabrik)
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Mengisi ulang database dengan data contoh bawaan aplikasi untuk keperluan simulasi atau pelatihan.
                </p>
              </div>
            </label>
          </div>

          {/* Warning Note */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>
              Perubahan ini akan langsung disinkronkan ke penyimpanan lokal dan database server SQLite (<code className="font-mono">.sql</code>). Anda dapat mengunduh <strong>Backup SQL (.sql)</strong> terlebih dahulu jika ingin menyimpan salinan transaksi lama.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className={`px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-50 ${
              selectedOption === 'EMPTY_ALL'
                ? 'bg-red-600 hover:bg-red-500'
                : selectedOption === 'ZERO_STOCK_ONLY'
                ? 'bg-amber-600 hover:bg-amber-500'
                : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {selectedOption === 'EMPTY_ALL' ? (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Mengosongkan...' : 'Ya, Kosongkan Semua (LPB, Stok & SIV)'}</span>
              </>
            ) : selectedOption === 'ZERO_STOCK_ONLY' ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Mereset...' : 'Ya, Kosongkan Transaksi & Nolkan Stok'}</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ya, Kembalikan Data Demo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
