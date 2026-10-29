import React, { useState, useMemo, useRef, useEffect, useDeferredValue } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  getRoleLevel,
  getRoleLabel,
  getEffectivePermissions,
  StockOpnameItemEntry,
} from '../types/inventory';
import { exportStockOpnameToExcel } from '../utils/sqlAndExcelExport';
import {
  ClipboardCheck,
  Lock,
  Unlock,
  Barcode,
  Camera,
  CameraOff,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  X,
  RefreshCw,
  ArrowUpDown,
  MapPin,
  Boxes,
  History,
  ShieldAlert,
  Sparkles,
  Check,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { soundService } from '../services/soundService';

const isMobilePhoneDevice = (): boolean => {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (window.innerWidth <= 820 && navigator.maxTouchPoints > 0)
  );
};

export const StockOpnameView: React.FC = () => {
  const {
    currentUser,
    stockItems,
    storageLocations,
    stockOpnameSessions,
    activeStockOpname,
    isStockLockedForOpname,
    startStockOpname,
    scanOrUpdateOpnameItem,
    completeStockOpname,
    cancelStockOpname,
    forceSyncNow,
  } = useInventory();

  const userLevel = currentUser ? getRoleLevel(currentUser.role) : 4;
  const perms = useMemo(() => getEffectivePermissions(currentUser), [currentUser]);
  // Level 1 (Kepala Store) ke atas (Level 0 Super User & Level 1 Kepala Store)
  const canStartOrCompleteOpname = userLevel <= 1;
  // Petugas yang dapat melakukan scan / hitung fisik setelah Stock Opname dimulai & stok akhir ter-lock:
  // Level 0, Level 1, Level 2 (Admin Store), serta Level 3 (Pemohon yang diminta bantuan Dept. Store)
  const canPerformCount = Boolean(
    isStockLockedForOpname && (perms.canPerformStockOpname || userLevel <= 3)
  );

  // Modal Start Stock Opname
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [opnameTitle, setOpnameTitle] = useState(
    `Stock Opname Store — ${new Date().toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
    })}`
  );
  const [opnameNotes, setOpnameNotes] = useState('');
  const [actionError, setActionError] = useState('');

  // Modal Complete / Finish Stock Opname
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [applyAdjustmentOnComplete, setApplyAdjustmentOnComplete] = useState(true);
  const [completionNotes, setCompletionNotes] = useState('');

  // Modal Cancel Stock Opname
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Barcode Scanner State during Active Stock Opname
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanMode, setScanMode] = useState<'input_qty' | 'auto_plus_one'>('input_qty');
  const [scannedEntry, setScannedEntry] = useState<StockOpnameItemEntry | null>(null);
  const [scannedPhysicalQty, setScannedPhysicalQty] = useState<string>('');
  const [scannedVerifiedLocation, setScannedVerifiedLocation] = useState<string>('');
  const [scannedItemNotes, setScannedItemNotes] = useState<string>('');
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Camera Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  // Worksheet Filters
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedRack, setSelectedRack] = useState<string>('ALL');
  const [filterCountStatus, setFilterCountStatus] = useState<
    'ALL' | 'UNCOUNTED' | 'COUNTED' | 'VARIANCE'
  >('ALL');
  const [opnamePage, setOpnamePage] = useState<number>(1);
  const [opnamePageSize, setOpnamePageSize] = useState<number>(50);

  const detectorIntervalRef = useRef<number | null>(null);

  // Stop camera on unmount or when session ends
  const stopCamera = () => {
    if (detectorIntervalRef.current) {
      window.clearInterval(detectorIntervalRef.current);
      detectorIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (detectorIntervalRef.current) {
        window.clearInterval(detectorIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startCameraScanner = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();

          const BarcodeDetectorAPI = (window as unknown as { BarcodeDetector?: new (opts?: { formats: string[] }) => { detect: (el: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
          if (BarcodeDetectorAPI) {
            try {
              const detector = new BarcodeDetectorAPI({
                formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e'],
              });
              if (detectorIntervalRef.current) {
                window.clearInterval(detectorIntervalRef.current);
              }
              detectorIntervalRef.current = window.setInterval(async () => {
                if (videoRef.current && videoRef.current.readyState >= 2) {
                  try {
                    const codes = await detector.detect(videoRef.current);
                    if (codes && codes.length > 0 && codes[0].rawValue) {
                      handleProcessBarcodeScan(codes[0].rawValue);
                    }
                  } catch {
                    // ignore frame error
                  }
                }
              }, 600);
            } catch {
              // ignore unsupported detector
            }
          }
        }
      }, 100);
    } catch {
      setCameraError(
        'Kamera tidak dapat diakses pada perangkat ini. Gunakan kolom Scan Barcode USB/Bluetooth atau tombol Simulasi Scan Cepat di bawah.'
      );
      setIsCameraActive(false);
    }
  };

  // Handle Barcode Scan Execution
  const handleProcessBarcodeScan = (rawCode: string) => {
    const cleanCode = rawCode.trim().replace(/^\*|\*$/g, '');
    if (!cleanCode || !activeStockOpname) return;

    if (scanMode === 'auto_plus_one') {
      const res = scanOrUpdateOpnameItem({
        skuOrId: cleanCode,
        incrementByOne: true,
        barcodeScanned: true,
      });
      if (res.success && res.entry) {
        soundService.playScanSuccess();
        setScannedEntry(res.entry);
        setScannedPhysicalQty(String(res.entry.physicalStock ?? 0));
        setScannedItemNotes(res.entry.notes || '');
        setScanFeedback({
          type: 'success',
          message: `✓ BARANG BERHASIL DISCAN! [${res.entry.sku}] tervalidasi — Stok fisik bertambah +1 menjadi ${res.entry.physicalStock} ${res.entry.unit}.`,
        });
      } else {
        soundService.playScanError();
        setScanFeedback({
          type: 'error',
          message: res.error || `Barcode "${cleanCode}" tidak ditemukan.`,
        });
      }
      setBarcodeInput('');
      return;
    }

    // Mode: Input Qty Fisik Aktual setelah Scan Barcode
    const found = activeStockOpname.items.find(
      (i) =>
        i.sku.toUpperCase() === cleanCode.toUpperCase() ||
        i.itemId.toUpperCase() === cleanCode.toUpperCase()
    );
    if (!found) {
      soundService.playScanError();
      setScanFeedback({
        type: 'error',
        message: `Kode Barcode / Material Code "${cleanCode}" tidak ditemukan di dalam daftar Stock Opname.`,
      });
      return;
    }

    soundService.playScanSuccess();
    setScannedEntry(found);
    setScannedPhysicalQty(
      String(found.physicalStock !== null ? found.physicalStock : found.systemStockSnapshot)
    );
    setScannedVerifiedLocation(found.verifiedLocation || found.location);
    setScannedItemNotes(found.notes || '');
    setScanFeedback({
      type: 'success',
      message: `✓ BARANG BERHASIL DISCAN! [${found.sku} — ${found.itemName}]. Silakan konfirmasi jumlah fisik aktual dan lokasi rak.`,
    });
    setBarcodeInput('');
  };

  const handleSaveScannedEntryQty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedEntry) return;
    const numQty = Math.max(0, Number(scannedPhysicalQty) || 0);
    const res = scanOrUpdateOpnameItem({
      skuOrId: scannedEntry.sku,
      physicalStock: numQty,
      verifiedLocation: scannedVerifiedLocation.trim() || scannedEntry.location,
      barcodeScanned: true,
      notes: scannedItemNotes.trim(),
    });
    if (res.success && res.entry) {
      setScannedEntry(res.entry);
      setScanFeedback({
        type: 'success',
        message: `Hasil opname [${res.entry.sku}] disimpan: Fisik ${res.entry.physicalStock} ${res.entry.unit} (Selisih: ${res.entry.variance > 0 ? '+' : ''}${res.entry.variance}).`,
      });
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 50);
    }
  };

  const handleStartOpnameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    const res = startStockOpname({
      title: opnameTitle,
      notes: opnameNotes,
    });
    if (!res.success) {
      setActionError(res.error || 'Gagal memulai Stock Opname.');
      return;
    }
    setIsStartModalOpen(false);
    setOpnameNotes('');
    void forceSyncNow();
  };

  const handleCompleteOpnameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError('');
    const res = completeStockOpname({
      applyAdjustment: applyAdjustmentOnComplete,
      notes: completionNotes,
    });
    if (!res.success) {
      setActionError(res.error || 'Gagal menyelesaikan Stock Opname.');
      return;
    }
    stopCamera();
    setIsCompleteModalOpen(false);
    setCompletionNotes('');
    setScannedEntry(null);
    void forceSyncNow();
  };

  const handleCancelOpnameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = cancelStockOpname(cancelReason);
    if (res.success) {
      stopCamera();
      setIsCancelModalOpen(false);
      setCancelReason('');
      setScannedEntry(null);
      void forceSyncNow();
    }
  };

  // Summary metrics for active session
  const opnameStats = useMemo(() => {
    if (!activeStockOpname) {
      return { total: 0, counted: 0, uncounted: 0, withVariance: 0, scannedCount: 0, progressPct: 0 };
    }
    const total = activeStockOpname.items.length;
    const counted = activeStockOpname.items.filter((i) => i.isCounted).length;
    const uncounted = total - counted;
    const withVariance = activeStockOpname.items.filter(
      (i) => i.isCounted && i.variance !== 0
    ).length;
    const scannedCount = activeStockOpname.items.filter((i) => i.barcodeScanned).length;
    const progressPct = total > 0 ? Math.round((counted / total) * 100) : 0;
    return { total, counted, uncounted, withVariance, scannedCount, progressPct };
  }, [activeStockOpname]);

  const filteredOpnameItems = useMemo(() => {
    if (!activeStockOpname) return [];
    const q = deferredSearchQuery.trim().toLowerCase();
    return activeStockOpname.items.filter((item) => {
      if (selectedRack !== 'ALL' && item.location !== selectedRack) return false;
      if (filterCountStatus === 'UNCOUNTED' && item.isCounted) return false;
      if (filterCountStatus === 'COUNTED' && !item.isCounted) return false;
      if (filterCountStatus === 'VARIANCE' && (!item.isCounted || item.variance === 0))
        return false;
      if (!q) return true;
      return (
        item.sku.toLowerCase().includes(q) ||
        item.itemName.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [activeStockOpname, selectedRack, filterCountStatus, deferredSearchQuery]);

  useEffect(() => {
    setOpnamePage(1);
  }, [selectedRack, filterCountStatus, deferredSearchQuery, opnamePageSize]);

  const totalOpnamePages = Math.max(1, Math.ceil(filteredOpnameItems.length / opnamePageSize));
  const safeOpnamePage = Math.min(opnamePage, totalOpnamePages);

  const paginatedOpnameItems = useMemo(() => {
    const startIdx = (safeOpnamePage - 1) * opnamePageSize;
    return filteredOpnameItems.slice(startIdx, startIdx + opnamePageSize);
  }, [filteredOpnameItems, safeOpnamePage, opnamePageSize]);

  const uniqueRacks = useMemo(() => {
    const set = new Set<string>(stockItems.map((i) => i.location));
    storageLocations.forEach((l) => set.add(l.code));
    return ['ALL', ...Array.from(set)];
  }, [stockItems, storageLocations]);

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div
        className={`rounded-2xl p-5 sm:p-6 text-white border shadow-lg transition-all ${
          isStockLockedForOpname
            ? 'bg-gradient-to-r from-red-950 via-red-900 to-amber-950 border-red-500/40'
            : 'bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 border-slate-800'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                isStockLockedForOpname
                  ? 'bg-red-500/20 border-red-400/40 text-red-300 animate-pulse'
                  : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
              }`}
            >
              {isStockLockedForOpname ? (
                <Lock className="w-6 h-6" />
              ) : (
                <ClipboardCheck className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {isStockLockedForOpname ? (
                  <span className="px-2.5 py-0.5 rounded-md bg-red-500 text-white text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    STOK STORE SEDANG DI-LOCK (STOCK OPNAME AKTIF)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Unlock className="w-3 h-3" />
                    STOK STORE NORMAL (TIDAK TERKUNCI)
                  </span>
                )}
                {activeStockOpname && (
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-mono text-[11px] font-extrabold">
                    #{activeStockOpname.opnameNumber}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold mt-1.5">
                Stock Opname Fisik &amp; Validasi Scan Barcode Store
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                Saat Stock Opname dimulai oleh <strong>Kepala Store</strong> dan stok akhir{' '}
                <strong>TER-LOCK</strong>, seluruh transaksi LPB &amp; SIV dikunci sementara.{' '}
                <strong>Admin Store</strong> beserta <strong>Pemohon (Level 3)</strong> yang diminta
                bantuan Departemen Store dapat melakukan <strong>Scan Barcode &amp; Input Stok Fisik</strong>{' '}
                selama sesi Stock Opname berlangsung.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {!isStockLockedForOpname ? (
              canStartOrCompleteOpname ? (
                <button
                  type="button"
                  onClick={() => {
                    setActionError('');
                    setIsStartModalOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-2 shadow-md transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  <span>Mulai Stock Opname &amp; Lock Stok</span>
                </button>
              ) : (
                <div className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-slate-200 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Menunggu Kepala Store memulai Stock Opname &amp; mengunci stok akhir agar Anda
                    dapat membantu hitung fisik
                  </span>
                </div>
              )
            ) : (
              <>
                {activeStockOpname &&
                  (currentUser?.role === 'superuser' ||
                    currentUser?.role === 'kepala_gudang' ||
                    currentUser?.role === 'admin') && (
                    <button
                      type="button"
                      onClick={() => exportStockOpnameToExcel(activeStockOpname)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Export Excel Opname (.XLSX)</span>
                    </button>
                  )}

                {canStartOrCompleteOpname && (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsCancelModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <X className="w-4 h-4 text-red-300" />
                      <span>Batalkan &amp; Unlock</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActionError('');
                        setIsCompleteModalOpen(true);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-2 shadow-md transition-colors"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>Selesaikan Stock Opname &amp; Buka Lock</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ACTIVE STOCK OPNAME WORKSPACE */}
      {activeStockOpname ? (
        <div className="space-y-6">
          {/* Progress & Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-2xs">
              <p className="text-[11px] font-semibold text-slate-500 uppercase">Total Material Code Store</p>
              <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                {opnameStats.total}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Stok sistem dikunci</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-emerald-200 shadow-2xs">
              <p className="text-[11px] font-bold text-emerald-700 uppercase">Sudah Dihitung</p>
              <p className="text-2xl font-bold font-mono text-emerald-600 mt-1">
                {opnameStats.counted}{' '}
                <span className="text-xs font-normal text-slate-500">
                  ({opnameStats.progressPct}%)
                </span>
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                {opnameStats.scannedCount} tervalidasi barcode
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-2xs">
              <p className="text-[11px] font-bold text-amber-700 uppercase">Belum Dihitung</p>
              <p className="text-2xl font-bold font-mono text-amber-600 mt-1">
                {opnameStats.uncounted}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Menunggu scan / hitung</p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-rose-200 shadow-2xs">
              <p className="text-[11px] font-bold text-rose-700 uppercase">Ada Selisih (Variance)</p>
              <p className="text-2xl font-bold font-mono text-rose-600 mt-1">
                {opnameStats.withVariance}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Fisik ≠ Stok Sistem</p>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-red-50 rounded-xl p-4 border border-red-200 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-red-800 uppercase">Status Lock</span>
                <Lock className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-xs font-bold text-red-900 mt-1">LPB &amp; SIV Terkunci</p>
              <p className="text-[10.5px] text-red-700 mt-0.5 truncate">
                Oleh: {activeStockOpname.startedBy}
              </p>
            </div>
          </div>

          {/* Info Banner Akses Bantuan Stock Opname untuk Pemohon (Level 3) */}
          {userLevel === 3 && canPerformCount && (
            <div className="rounded-xl bg-amber-50 border border-amber-300 p-4 flex items-start gap-3 text-xs text-amber-950">
              <Users className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">
                  Akses Bantuan Stock Opname Aktif untuk Pemohon ({currentUser?.name} — @
                  {currentUser?.username})
                </p>
                <p className="text-amber-800 mt-0.5">
                  Karena sesi Stock Opname <strong>#{activeStockOpname.opnameNumber}</strong> telah
                  dimulai dan stok akhir telah ter-lock, akun Anda dapat membantu Departemen Store
                  melakukan <strong>Scan Barcode</strong>, menginput <strong>Stok Fisik Aktual</strong>,
                  serta memverifikasi lokasi rak di bawah ini. Nama &amp; akun Anda akan tercatat
                  otomatis sebagai petugas penghitung.
                </p>
              </div>
            </div>
          )}

          {/* BARCODE SCANNER CONSOLE FOR STOCK OPNAME */}
          {canPerformCount && (
            <div className="bg-white rounded-2xl border-2 border-amber-400 shadow-md overflow-hidden">
              <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0">
                    <Barcode className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                      <span>Pemindai Scan Barcode Stock Opname</span>
                      <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-mono">
                        USB / PDA Laser / Kamera HP
                      </span>
                    </h2>
                    <p className="text-xs text-slate-300">
                      Scan barcode stiker pada barang/rak untuk langsung menginput atau menambah
                      hitungan stok fisik aktual
                    </p>
                  </div>
                </div>

                {/* Mode Switcher */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex p-0.5 rounded-lg bg-slate-800 border border-slate-700 text-xs">
                    <button
                      type="button"
                      onClick={() => setScanMode('input_qty')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        scanMode === 'input_qty'
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Scan &amp; Input Qty Fisik
                    </button>
                    <button
                      type="button"
                      onClick={() => setScanMode('auto_plus_one')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                        scanMode === 'auto_plus_one'
                          ? 'bg-amber-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Scan Cepat (+1 Otomatis)
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => (isCameraActive ? stopCamera() : void startCameraScanner())}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                      isCameraActive
                        ? 'bg-red-600 hover:bg-red-500 text-white'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isCameraActive ? (
                      <>
                        <CameraOff className="w-3.5 h-3.5" />
                        <span>Tutup Kamera</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-3.5 h-3.5" />
                        <span>Buka Kamera Scan</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Live Camera Viewport if enabled */}
                {isCameraActive && (
                  <div className="bg-slate-950 rounded-xl p-4 text-white flex flex-col items-center justify-center relative overflow-hidden">
                    <video
                      ref={videoRef}
                      className="w-full max-w-md h-52 object-cover rounded-lg border-2 border-amber-400"
                      playsInline
                      muted
                    />
                    <p className="text-xs text-amber-300 mt-2 font-medium">
                      Arahkan kamera ke Barcode / QR Code stiker barang atau klik tombol simulasi
                      scan di bawah
                    </p>
                  </div>
                )}

                {cameraError && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                    {cameraError}
                  </div>
                )}

                {/* Barcode Input Form */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  <div className="lg:col-span-6 space-y-3">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleProcessBarcodeScan(barcodeInput);
                      }}
                      className="flex gap-2"
                    >
                      <div className="relative flex-1">
                        <Barcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          ref={barcodeInputRef}
                          type="text"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          placeholder="Scan barcode barang di sini atau ketik Material Code (misal: BRG-ELK-001) lalu Enter..."
                          className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-hidden"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shrink-0 flex items-center gap-1.5 transition-colors"
                      >
                        <Barcode className="w-4 h-4 text-amber-400" />
                        <span>Proses Scan</span>
                      </button>
                    </form>

                    {/* Quick Scan Simulation Buttons for fast testing */}
                    <div>
                      <p className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>Klik Cepat Simulasi Scan Barcode Barang:</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                        {activeStockOpname.items.slice(0, 24).map((it) => (
                          <button
                            key={it.itemId}
                            type="button"
                            onClick={() => handleProcessBarcodeScan(it.sku)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all flex items-center gap-1 ${
                              it.barcodeScanned
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                                : 'bg-slate-100 hover:bg-amber-100 border-slate-200 text-slate-800'
                            }`}
                          >
                            <Barcode className="w-3 h-3" />
                            <span>{it.sku}</span>
                            {it.barcodeScanned && (
                              <span className="text-[9px] px-1 rounded bg-emerald-600 text-white font-extrabold">
                                ✓ DISCAN
                              </span>
                            )}
                            {it.isCounted && (
                              <span className="text-[10px] px-1 rounded bg-white">
                                {it.physicalStock}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Scanned Item Verification & Physical Stock Entry Card */}
                  <div className="lg:col-span-6">
                    {scanFeedback && (
                      <div
                        className={`mb-3 p-3 rounded-xl border-2 text-xs font-semibold flex items-center justify-between gap-2 ${
                          scanFeedback.type === 'success'
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-xs'
                            : 'bg-red-50 border-red-300 text-red-800'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {scanFeedback.type === 'success' && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          <span>{scanFeedback.message}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setScanFeedback(null)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {scannedEntry ? (
                      <form
                        onSubmit={handleSaveScannedEntryQty}
                        className="p-4 rounded-xl bg-emerald-50/60 border-2 border-emerald-400 space-y-3 shadow-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold">
                                <CheckCircle2 className="w-3 h-3" />
                                ✓ BARANG BERHASIL DISCAN
                              </span>
                              <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-xs font-bold">
                                {scannedEntry.sku}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Rak: {scannedEntry.location}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 mt-1">
                              {scannedEntry.itemName}
                            </h4>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-semibold text-slate-500 block">
                              Stok Sistem (Saat Lock)
                            </span>
                            <span className="text-base font-extrabold font-mono text-slate-900">
                              {scannedEntry.systemStockSnapshot} {scannedEntry.unit}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-amber-200/80">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Jumlah Stok Fisik Aktual ({scannedEntry.unit}):
                            </label>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={scannedPhysicalQty}
                              onChange={(e) => setScannedPhysicalQty(e.target.value)}
                              className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-lg text-sm font-mono font-extrabold text-slate-900 focus:border-amber-500 focus:outline-hidden"
                              autoFocus
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Catatan Pemeriksaan Fisik (Opsional):
                            </label>
                            <input
                              type="text"
                              value={scannedItemNotes}
                              onChange={(e) => setScannedItemNotes(e.target.value)}
                              placeholder="Misal: Sesuai rak / 1 unit rusak..."
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:border-amber-500 focus:outline-hidden"
                            />
                          </div>
                        </div>

                        {/* Verifikasi Lokasi Rak (Hasil Opname Dapat Merubah Lokasi Sistem) */}
                        <div className="pt-2 border-t border-amber-200/80">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-slate-900">
                              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Verifikasi Lokasi Rak Barang:</span>
                            </span>
                            {scannedVerifiedLocation &&
                              scannedVerifiedLocation !== scannedEntry.location && (
                                <span className="text-[10.5px] font-bold text-amber-800 bg-amber-200 px-2 py-0.5 rounded">
                                  Pindah dari {scannedEntry.location} &rarr; {scannedVerifiedLocation}
                                </span>
                              )}
                          </label>
                          <select
                            value={scannedVerifiedLocation}
                            onChange={(e) => setScannedVerifiedLocation(e.target.value)}
                            className="w-full px-3 py-2 bg-white border-2 border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:border-amber-500 focus:outline-hidden"
                          >
                            <option value={scannedEntry.location}>
                              {scannedEntry.location} (Lokasi Terdaftar di Sistem)
                            </option>
                            {storageLocations
                              .filter((l) => l.code !== scannedEntry.location)
                              .map((loc) => (
                                <option key={loc.id} value={loc.code}>
                                  {loc.code} &mdash; {loc.name}
                                </option>
                              ))}
                          </select>
                          <p className="text-[10px] text-slate-500 mt-1">
                            Jika fisik barang ditemukan di rak berbeda, ubah lokasi rak di atas. Saat Stock Opname diselesaikan, sistem otomatis memperbarui lokasi barang.
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="text-xs font-semibold">
                            Selisih:{' '}
                            <span
                              className={`font-mono font-bold ${
                                (Number(scannedPhysicalQty) || 0) -
                                  scannedEntry.systemStockSnapshot ===
                                0
                                  ? 'text-emerald-700'
                                  : 'text-rose-600'
                              }`}
                            >
                              {(Number(scannedPhysicalQty) || 0) -
                                scannedEntry.systemStockSnapshot >
                              0
                                ? '+'
                                : ''}
                              {(Number(scannedPhysicalQty) || 0) -
                                scannedEntry.systemStockSnapshot}{' '}
                              {scannedEntry.unit}
                            </span>
                          </div>
                          <button
                            type="submit"
                            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                          >
                            <Check className="w-4 h-4" />
                            <span>Simpan Hasil Scan Fisik</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
                        Silakan scan barcode barang atau klik salah satu Material Code di sebelah kiri
                        untuk menampilkan kartu input hitung fisik.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WORKSHEET TABLE & FILTERS */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Kertas Kerja Stock Opname #{activeStockOpname.opnameNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  {activeStockOpname.title} • Dimulai pada{' '}
                  {new Date(activeStockOpname.startedAt).toLocaleString('id-ID')} oleh{' '}
                  {activeStockOpname.startedBy}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select
                  value={selectedRack}
                  onChange={(e) => setSelectedRack(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700"
                >
                  {uniqueRacks.map((r) => (
                    <option key={r} value={r}>
                      {r === 'ALL' ? 'Semua Lokasi Rak' : `Rak: ${r}`}
                    </option>
                  ))}
                </select>

                <select
                  value={filterCountStatus}
                  onChange={(e) =>
                    setFilterCountStatus(e.target.value as typeof filterCountStatus)
                  }
                  className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-700"
                >
                  <option value="ALL">Semua Status ({activeStockOpname.items.length})</option>
                  <option value="UNCOUNTED">Belum Dihitung ({opnameStats.uncounted})</option>
                  <option value="COUNTED">Sudah Dihitung ({opnameStats.counted})</option>
                  <option value="VARIANCE">Ada Selisih ({opnameStats.withVariance})</option>
                </select>

                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari Material Code, barang, rak..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-900 text-white uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Material Code &amp; Nama Barang</th>
                    <th className="px-4 py-3">Lokasi Rak</th>
                    <th className="px-4 py-3 text-right">Stok Sistem (Saat Lock)</th>
                    <th className="px-4 py-3 text-center w-44">Stok Fisik Aktual</th>
                    <th className="px-4 py-3 text-right">Selisih (Variance)</th>
                    <th className="px-4 py-3 text-center">Status Validasi</th>
                    <th className="px-4 py-3">Catatan Opname</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedOpnameItems.map((entry) => {
                    const isMatch = entry.isCounted && entry.variance === 0;
                    const hasDiff = entry.isCounted && entry.variance !== 0;
                    return (
                      <tr
                        key={entry.itemId}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          scannedEntry?.itemId === entry.itemId ? 'bg-amber-50/60' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-slate-900">{entry.sku}</span>
                            {entry.barcodeScanned && (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                                <Barcode className="w-3 h-3" />
                                Scanned
                              </span>
                            )}
                          </div>
                          <div className="font-semibold text-slate-800 mt-0.5">
                            {entry.itemName}
                          </div>
                          <div className="text-[11px] text-slate-400">{entry.category}</div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] font-semibold">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {entry.location}
                            </span>
                            {canPerformCount ? (
                              <select
                                value={entry.verifiedLocation || entry.location}
                                onChange={(e) =>
                                  scanOrUpdateOpnameItem({
                                    skuOrId: entry.sku,
                                    verifiedLocation: e.target.value,
                                  })
                                }
                                className={`text-[10px] px-1.5 py-0.5 rounded border focus:outline-hidden max-w-[130px] font-mono ${
                                  entry.verifiedLocation && entry.verifiedLocation !== entry.location
                                    ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                                    : 'bg-white border-slate-200 text-slate-700'
                                }`}
                                title="Verifikasi lokasi rak (dapat mengubah lokasi di sistem saat selesai opname)"
                              >
                                <option value={entry.location}>{entry.location} (Asal)</option>
                                {storageLocations
                                  .filter((l) => l.code !== entry.location)
                                  .map((loc) => (
                                    <option key={loc.id} value={loc.code}>
                                      {loc.code}
                                    </option>
                                  ))}
                              </select>
                            ) : entry.verifiedLocation && entry.verifiedLocation !== entry.location ? (
                              <span className="text-[10px] text-amber-700 font-bold">
                                &rarr; {entry.verifiedLocation}
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                          {entry.systemStockSnapshot} {entry.unit}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {canPerformCount ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                value={entry.physicalStock !== null ? entry.physicalStock : ''}
                                placeholder="Belum"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '') return;
                                  scanOrUpdateOpnameItem({
                                    skuOrId: entry.sku,
                                    physicalStock: Math.max(0, Number(val)),
                                    barcodeScanned: entry.barcodeScanned,
                                  });
                                }}
                                className="w-24 px-2.5 py-1.5 text-center font-mono font-bold rounded-lg border border-slate-300 bg-white focus:border-amber-500 focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  scanOrUpdateOpnameItem({
                                    skuOrId: entry.sku,
                                    physicalStock: entry.systemStockSnapshot,
                                    barcodeScanned: true,
                                  })
                                }
                                title="Set sesuai stok sistem & tandai tervalidasi"
                                className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 text-[10px] font-bold"
                              >
                                = Sistem
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono font-bold">
                              {entry.physicalStock !== null
                                ? `${entry.physicalStock} ${entry.unit}`
                                : '-'}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-bold">
                          {!entry.isCounted ? (
                            <span className="text-slate-400">-</span>
                          ) : entry.variance === 0 ? (
                            <span className="text-emerald-600">0 (Sesuai)</span>
                          ) : (
                            <span
                              className={
                                entry.variance > 0 ? 'text-blue-600' : 'text-rose-600'
                              }
                            >
                              {entry.variance > 0 ? `+${entry.variance}` : entry.variance}{' '}
                              {entry.unit}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            {!entry.isCounted ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10.5px] font-bold">
                                Belum Dihitung
                              </span>
                            ) : isMatch ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10.5px] font-bold">
                                Cocok (Sesuai)
                              </span>
                            ) : hasDiff ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10.5px] font-bold">
                                Selisih ({entry.variance > 0 ? '+' : ''}
                                {entry.variance})
                              </span>
                            ) : null}
                            {entry.isCounted && entry.countedBy && (
                              <span className="text-[10px] font-mono text-slate-500 truncate max-w-[140px]">
                                Oleh: {entry.countedBy}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          {canPerformCount ? (
                            <input
                              type="text"
                              value={entry.notes || ''}
                              onChange={(e) =>
                                scanOrUpdateOpnameItem({
                                  skuOrId: entry.sku,
                                  physicalStock:
                                    entry.physicalStock ?? entry.systemStockSnapshot,
                                  notes: e.target.value,
                                })
                              }
                              placeholder="Catatan..."
                              className="w-full min-w-[140px] px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-xs focus:bg-white focus:outline-hidden"
                            />
                          ) : (
                            <span className="text-slate-600">{entry.notes || '-'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredOpnameItems.length > 0 && (
              <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
                <div className="flex flex-wrap items-center gap-2">
                  <span>
                    Menampilkan{' '}
                    <strong className="font-mono text-slate-900">
                      {(safeOpnamePage - 1) * opnamePageSize + 1}&ndash;
                      {Math.min(safeOpnamePage * opnamePageSize, filteredOpnameItems.length)}
                    </strong>{' '}
                    dari <strong className="font-mono text-slate-900">{filteredOpnameItems.length}</strong> barang opname
                  </span>
                  <select
                    value={opnamePageSize}
                    onChange={(e) => setOpnamePageSize(Number(e.target.value))}
                    className="px-2 py-1 bg-white border border-slate-300 rounded-lg font-mono font-semibold text-slate-800"
                  >
                    {[25, 50, 100, 250].map((sz) => (
                      <option key={sz} value={sz}>
                        {sz} / hal
                      </option>
                    ))}
                  </select>
                </div>
                {totalOpnamePages > 1 && (
                  <div className="flex items-center gap-1.5 justify-end">
                    <button
                      type="button"
                      onClick={() => setOpnamePage((p) => Math.max(1, p - 1))}
                      disabled={safeOpnamePage <= 1}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 font-semibold"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev</span>
                    </button>
                    <span className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-mono font-bold">
                      Hal {safeOpnamePage}/{totalOpnamePages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpnamePage((p) => Math.min(totalOpnamePages, p + 1))}
                      disabled={safeOpnamePage >= totalOpnamePages}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 font-semibold"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* NO ACTIVE STOCK OPNAME -> SHOW EXPLANATION & HISTORY */
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="w-5 h-5 text-slate-700" />
                <span>Riwayat Sesi Stock Opname Store</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar pelaksanaan perhitungan fisik stok beserta penyesuaian selisih (variance)
              </p>
            </div>
          </div>

          {stockOpnameSessions.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <ClipboardCheck className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto">
                <p className="text-sm font-bold text-slate-800">
                  Belum Ada Riwayat Sesi Stock Opname
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Klik tombol <strong>&ldquo;Mulai Stock Opname &amp; Lock Stok&rdquo;</strong> di
                  atas (khusus Kepala Store ke atas) untuk mengunci pergerakan stok dan memulai
                  validasi scan barcode barang di rak.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {stockOpnameSessions.map((sess) => {
                const countedCount = sess.items.filter((i) => i.isCounted).length;
                const varianceCount = sess.items.filter(
                  (i) => i.isCounted && i.variance !== 0
                ).length;
                return (
                  <div
                    key={sess.id}
                    className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-xs font-bold">
                          #{sess.opnameNumber}
                        </span>
                        <span className="text-sm font-bold text-slate-900">{sess.title}</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold uppercase ${
                            sess.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sess.status === 'CANCELLED'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {sess.status === 'COMPLETED'
                            ? 'Selesai (Stok Un-Locked)'
                            : sess.status === 'CANCELLED'
                            ? 'Dibatalkan'
                            : 'Sedang Berlangsung'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1">
                        Dimulai oleh <strong>{sess.startedBy}</strong> pada{' '}
                        {new Date(sess.startedAt).toLocaleString('id-ID')}
                        {sess.completedAt &&
                          ` • Selesai: ${new Date(sess.completedAt).toLocaleString('id-ID')}`}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Dihitung: <strong>{countedCount}</strong> dari {sess.items.length} Material Code •
                        Selisih: <strong>{varianceCount} Material Code</strong> • Penyesuaian Sistem:{' '}
                        <strong>{sess.appliedAdjustment ? 'Diterapkan' : 'Tidak'}</strong>
                      </p>
                    </div>

                    {(currentUser?.role === 'superuser' ||
                      currentUser?.role === 'kepala_gudang' ||
                      currentUser?.role === 'admin') && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => exportStockOpnameToExcel(sess)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Export Excel</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL MULAI STOCK OPNAME */}
      {isStartModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Mulai Stock Opname &amp; Lock Stok Store</h3>
                  <p className="text-xs text-slate-300">
                    Seluruh penambahan &amp; pengurangan stok akan dikunci sementara
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsStartModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartOpnameSubmit} className="p-5 space-y-4 text-xs">
              {actionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-semibold">
                  {actionError}
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Konfirmasi Penguncian Stok (Stock Lock):</span>
                </p>
                <p className="text-[11px] leading-relaxed">
                  Selama proses Stock Opname aktif, pengguna <strong>tidak dapat</strong> menambah
                  stok baru (Approve LPB / Import) maupun mengurangi stok (Menerbitkan / Validasi /
                  Approve SIV) hingga Stock Opname dinyatakan selesai.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Judul / Periode Stock Opname:
                </label>
                <input
                  type="text"
                  required
                  value={opnameTitle}
                  onChange={(e) => setOpnameTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Catatan Instruksi Opname (Opsional):
                </label>
                <textarea
                  rows={3}
                  value={opnameNotes}
                  onChange={(e) => setOpnameNotes(e.target.value)}
                  placeholder="Misal: Pemeriksaan rutin bulanan seluruh rak Zona A & B..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStartModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Lock className="w-4 h-4" />
                  <span>Mulai Opname &amp; Lock Stok Sekarang</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SELESAIKAN STOCK OPNAME */}
      {isCompleteModalOpen && activeStockOpname && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    Selesaikan Stock Opname &amp; Buka Lock Stok
                  </h3>
                  <p className="text-xs text-slate-300">
                    #{activeStockOpname.opnameNumber} • {opnameStats.counted} dari{' '}
                    {opnameStats.total} Material Code telah dihitung
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCompleteModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteOpnameSubmit} className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyAdjustmentOnComplete}
                    onChange={(e) => setApplyAdjustmentOnComplete(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-emerald-600 rounded"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">
                      Sesuaikan Saldo Stok Sistem dengan Hasil Hitung Fisik Opname
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Jika dicentang, barang yang memiliki selisih ({opnameStats.withVariance} Material Code)
                      akan otomatis diperbarui saldo fisiknya dan dicatat pada Kartu Stok (Mutasi
                      Penyesuaian Opname).
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Catatan Berita Acara Penyelesaian:
                </label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Misal: Stock Opname selesai diverifikasi Kepala Store, stok kembali dibuka..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Selesaikan &amp; Buka Lock Stok</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BATALKAN STOCK OPNAME */}
      {isCancelModalOpen && activeStockOpname && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-4 bg-red-600 text-white flex items-center justify-between">
              <h3 className="text-sm font-bold">Batalkan Sesi Stock Opname &amp; Buka Lock</h3>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="text-red-100 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCancelOpnameSubmit} className="p-5 space-y-4 text-xs">
              <p className="text-slate-600">
                Membatalkan sesi <strong>#{activeStockOpname.opnameNumber}</strong> akan langsung
                membuka kembali kunci stok tanpa mengubah saldo stok barang di sistem.
              </p>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Alasan Pembatalan:</label>
                <input
                  type="text"
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Masukkan alasan pembatalan..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold"
                >
                  Ya, Batalkan &amp; Buka Lock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
