import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { IssueVoucherDocument, LPBDocument, StockItem } from '../types/inventory';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  downloadApkSafely,
  downloadStandaloneHtmlAppSafely,
} from '../utils/apkDownloadHelper';
import { BarcodeAddScannerPanel } from '../components/BarcodeAddScannerPanel';
import {
  Smartphone,
  Wifi,
  BatteryCharging,
  SignalHigh,
  QrCode,
  ArrowUpRight,
  ArrowDownLeft,
  Layers,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  RefreshCw,
  Printer,
  ShieldCheck,
  ScanLine,
  PackageCheck,
  UserCheck,
  Monitor,
  Columns2,
  Trash2,
  Edit3,
  AlertTriangle,
  Download,
  Activity,
  MapPin,
  XCircle,
} from 'lucide-react';

interface AndroidAppViewProps {
  onOpenCreateLPB: () => void;
  onOpenCreateVoucher: () => void;
  onOpenEditVoucher: (voucher: IssueVoucherDocument) => void;
  onOpenApprovalModal: (voucher: IssueVoucherDocument) => void;
  onPrintDocument: (type: 'LPB' | 'NPB', doc: LPBDocument | IssueVoucherDocument) => void;
  onExitAndroidMode?: () => void;
  onToggleSplitMode?: () => void;
  isSplitMode?: boolean;
}

export const AndroidAppView: React.FC<AndroidAppViewProps> = ({
  onOpenCreateLPB,
  onOpenCreateVoucher,
  onOpenEditVoucher,
  onOpenApprovalModal,
  onPrintDocument,
  onExitAndroidMode,
  onToggleSplitMode,
  isSplitMode = false,
}) => {
  const {
    currentUser,
    users,
    login,
    stockItems,
    lpbDocuments,
    issueVouchers,
    minStockProposals,
    activityLogs,
    createIssueVoucher,
    approveIssueVoucher,
    completeIssueVoucherHandover,
    deleteIssueVoucher,
    approveLPBStockAddition,
    createMinStockProposal,
    verifyMinStockProposal,
    approveMinStockProposal,
    syncStatus,
    forceSyncNow,
    setDeviceMode,
  } = useInventory();

  const { isInstallable, isInstalled, install } = usePWAInstall();

  const [activeAndroidTab, setActiveAndroidTab] = useState<
    'home' | 'scanner' | 'transactions' | 'stock' | 'sync'
  >('home');

  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );

  useEffect(() => {
    setDeviceMode('ANDROID');
    const timer = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      );
    }, 15000);
    return () => clearInterval(timer);
  }, [setDeviceMode]);

  // Scanner & Quick Validation State
  const [scannedSkuInput, setScannedSkuInput] = useState('');
  const [selectedScannedItem, setSelectedScannedItem] = useState<StockItem | null>(null);
  const [selectedVoucherForAndroidScan, setSelectedVoucherForAndroidScan] =
    useState<IssueVoucherDocument | null>(null);
  const [recipientNameInput, setRecipientNameInput] = useState('');
  const [scanNotesInput, setScanNotesInput] = useState('');
  const [itemScanState, setItemScanState] = useState<
    Record<string, { scanned: boolean; qty: number; cancelled: boolean }>
  >({});

  // Transactions Sub-tab ('siv' | 'lpb')
  const [txSubTab, setTxSubTab] = useState<'siv' | 'lpb'>('siv');
  const [showQuickCreateSIV, setShowQuickCreateSIV] = useState(false);
  const [showQuickSivBarcodeScanner, setShowQuickSivBarcodeScanner] = useState(false);
  const [quickSivPurpose, setQuickSivPurpose] = useState('');
  const [quickSivItems, setQuickSivItems] = useState<Array<{ itemId: string; qty: number }>>(() => {
    const firstAvail = stockItems.find((s) => s.currentStock - s.allocatedStock > 0) || stockItems[0];
    return firstAvail ? [{ itemId: firstAvail.id, qty: 1 }] : [];
  });

  // Stock & Min Stock Sub-tab
  const [stockSearch, setStockSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'proposals'>('all');
  const [proposeItemId, setProposeItemId] = useState('');
  const [proposeMinVal, setProposeMinVal] = useState(10);
  const [proposeReason, setProposeReason] = useState('');

  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'admin';
  const isKepalaGudang = currentUser.role === 'kepala_gudang';
  const isPemohon = currentUser.role === 'user';

  // User pemohon SIV hanya dapat melihat SIV yang diterbitkan oleh dirinya sendiri
  const visibleVouchers = isPemohon
    ? issueVouchers.filter(
        (v) =>
          v.userId === currentUser.id ||
          v.requestedBy.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      )
    : issueVouchers;

  const pendingAdminSIVs = visibleVouchers.filter((v) => v.status === 'PENDING');
  const pendingHeadSIVs = visibleVouchers.filter((v) => v.status === 'APPROVED');
  const pendingHeadLPBs = lpbDocuments.filter((l) => l.status === 'PENDING_HEAD_APPROVAL');
  const lowStockCount = stockItems.filter((i) => i.currentStock <= i.minStock).length;

  const showQuickFeedback = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleSelectVoucherToScan = (v: IssueVoucherDocument) => {
    setSelectedVoucherForAndroidScan(v);
    setRecipientNameInput(v.recipientName || v.requestedBy);
    setScanNotesInput(v.notes || '');
    const initMap: Record<string, { scanned: boolean; qty: number; cancelled: boolean }> = {};
    v.items.forEach((it) => {
      initMap[it.itemId] = {
        scanned: true,
        qty: it.issuedQty !== undefined ? it.issuedQty : it.requestedQty,
        cancelled: it.isCancelled || false,
      };
    });
    setItemScanState(initMap);
    setActiveAndroidTab('scanner');
  };

  const handleAdminSubmitScanAndroid = () => {
    if (!selectedVoucherForAndroidScan) return;
    if (!isAdmin) {
      showQuickFeedback('Hanya User Admin Gudang yang berwenang melakukan ACC & Scan Barcode SIV.');
      return;
    }
    if (!recipientNameInput.trim()) {
      showQuickFeedback('Masukkan Nama Penerima Barang terlebih dahulu.');
      return;
    }

    const itemsValidation = selectedVoucherForAndroidScan.items.map((it) => {
      const st = itemScanState[it.itemId] || {
        scanned: true,
        qty: it.requestedQty,
        cancelled: false,
      };
      return {
        itemId: it.itemId,
        sku: it.sku,
        issuedQty: st.cancelled ? 0 : st.qty,
        isCancelled: st.cancelled || st.qty === 0,
        barcodeValidated: true,
        barcodeScanned: true,
        barcodeScannedAt: new Date().toISOString(),
      };
    });

    const res = completeIssueVoucherHandover(selectedVoucherForAndroidScan.id, {
      recipientName: recipientNameInput.trim(),
      handoverOfficer: currentUser.name,
      notes: scanNotesInput.trim() || 'Validasi Scan Barcode via Aplikasi Android',
      itemsValidation,
    });

    if (res.success) {
      showQuickFeedback(
        `SIV #${selectedVoucherForAndroidScan.voucherNumber} berhasil di-ACC & Scan via Android! Tersinkron ke Website.`
      );
      setSelectedVoucherForAndroidScan(null);
    } else if (res.error) {
      showQuickFeedback(res.error);
    }
  };

  const handleKepalaApproveSIVAndroid = (v: IssueVoucherDocument) => {
    if (!isKepalaGudang) {
      showQuickFeedback('Hanya Kepala Gudang yang berwenang melakukan Approve Pengurangan Stock.');
      return;
    }
    const res = approveIssueVoucher(v.id, {
      warehouseHeadName: currentUser.name,
      approverAdminName: v.approvedByAdmin || 'Admin Gudang',
      recipientName: v.recipientName || v.requestedBy,
      notes: 'Approve Pengurangan Stock oleh Kepala Gudang via Aplikasi Android',
    });
    if (res.success) {
      showQuickFeedback(
        `Stok SIV #${v.voucherNumber} resmi dipotong oleh Kepala Gudang & tersinkron ke Website!`
      );
    } else if (res.error) {
      showQuickFeedback(res.error);
    }
  };

  const handleKepalaApproveLPBAndroid = (lpb: LPBDocument) => {
    if (!isKepalaGudang) {
      showQuickFeedback('Hanya Kepala Gudang yang berwenang melakukan Approve Penambahan Stock LPB.');
      return;
    }
    const res = approveLPBStockAddition(lpb.id, {
      warehouseHeadName: currentUser.name,
      notes: 'Approve Penambahan Stock LPB via Aplikasi Android',
    });
    if (res.success) {
      showQuickFeedback(
        `Stok LPB #${lpb.lpbNumber} resmi ditambahkan oleh Kepala Gudang & tersinkron ke Website!`
      );
    } else if (res.error) {
      showQuickFeedback(res.error);
    }
  };

  const handleQuickCreateSIVSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSivPurpose.trim() || quickSivItems.length === 0) return;
    const validItems = quickSivItems.filter((it) => it.itemId && it.qty > 0);
    if (validItems.length === 0) return;
    const res = createIssueVoucher({
      purpose: `${quickSivPurpose.trim()} (Diterbitkan via Android)`,
      department: currentUser.department,
      notes: 'Diterbitkan langsung dari Aplikasi Android GudangPresisi',
      items: validItems.map((it) => ({ itemId: it.itemId, requestedQty: Number(it.qty) })),
    });
    if (res.success && res.voucher) {
      setQuickSivPurpose('');
      const firstAvail = stockItems.find((s) => s.currentStock - s.allocatedStock > 0) || stockItems[0];
      setQuickSivItems(firstAvail ? [{ itemId: firstAvail.id, qty: 1 }] : []);
      setShowQuickCreateSIV(false);
      showQuickFeedback(
        `SIV #${res.voucher.voucherNumber} berhasil diterbitkan dari Android & langsung tampil di Website!`
      );
    } else if (res.error) {
      showQuickFeedback(res.error);
    }
  };

  const handleQuickProposeMinStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposeItemId || !proposeReason.trim()) return;
    const res = createMinStockProposal({
      itemId: proposeItemId,
      proposedMinStock: Number(proposeMinVal),
      reason: `${proposeReason.trim()} (Via Android)`,
    });
    if (res.success) {
      setProposeItemId('');
      setProposeReason('');
      showQuickFeedback('Pengajuan Minimal Stock berhasil dikirim dari Android & tersinkron ke Website!');
    } else if (res.error) {
      showQuickFeedback(res.error);
    }
  };

  const handleSwitchUserRole = (role: 'user' | 'admin' | 'kepala_gudang') => {
    const target = users.find((u) => u.role === role && u.isActive !== false);
    if (target) {
      login(target.username, target.password);
      showQuickFeedback(`Beralih akun Android ke: ${target.name} (${target.role.toUpperCase()})`);
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-start py-2 px-1 sm:px-4 select-none">
      {/* Top Control Bar (Outside Phone Frame on Desktop) */}
      <div className="w-full max-w-[440px] mb-2.5 bg-slate-900 text-white rounded-2xl px-3.5 py-2.5 border border-slate-800 shadow-lg flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
              <span>GudangPresisi Android v2.6</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <div className="text-[10px] text-emerald-400 font-mono truncate">
              Sync Server Rev #{syncStatus.revision} &bull; Live ke Website
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleSplitMode && (
            <button
              onClick={onToggleSplitMode}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
                isSplitMode
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="Tampilkan Android & Website berdampingan untuk melihat sinkronisasi langsung"
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isSplitMode ? 'Split Aktif' : 'Split Web+Android'}</span>
            </button>
          )}
          {onExitAndroidMode && (
            <button
              onClick={() => {
                setDeviceMode('WEBSITE');
                onExitAndroidMode();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Kembali ke tampilan Website penuh"
            >
              <Monitor className="w-3.5 h-3.5 text-blue-400" />
              <span>Layar Web</span>
            </button>
          )}
        </div>
      </div>

      {/* ANDROID SMARTPHONE / HANDHELD SHELL */}
      <div className="w-full max-w-[440px] bg-slate-950 rounded-[36px] p-2.5 shadow-2xl border-[3px] border-slate-800 relative overflow-hidden">
        <div className="bg-slate-50 rounded-[28px] overflow-hidden flex flex-col min-h-[740px] max-h-[840px]">
          {/* Android System Status Bar */}
          <div className="bg-slate-950 text-white px-5 pt-2 pb-1.5 flex items-center justify-between text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className="font-bold">{currentTime}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                SYNC ON
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <SignalHigh className="w-3.5 h-3.5 text-emerald-400" />
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <div className="flex items-center gap-0.5 text-[10px]">
                <span>98%</span>
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>
          </div>

          {/* Android App Top Bar & Fast Role Switcher */}
          <div className="bg-slate-900 text-white px-4 py-3 border-b border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold tracking-tight text-white leading-tight">
                    SISTEN INVENTORY CONTROL STORE
                  </span>
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 font-black shrink-0">
                    ANDROID
                  </span>
                </div>
                <div className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wide mt-0.5">
                  PT ABADI AGROSINDO PERSADA
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-1.5">
                  <span className="truncate max-w-[160px] font-semibold text-white">
                    {currentUser.name}
                  </span>
                  <span>&bull;</span>
                  <span
                    className={`font-mono text-[10px] font-bold ${
                      isKepalaGudang
                        ? 'text-blue-400'
                        : isAdmin
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {isKepalaGudang
                      ? 'KEPALA GUDANG'
                      : isAdmin
                      ? 'ADMIN GUDANG'
                      : 'PEMOHON SIV'}
                  </span>
                </div>
              </div>

              <button
                onClick={async () => {
                  setIsSyncingNow(true);
                  await forceSyncNow();
                  setTimeout(() => setIsSyncingNow(false), 500);
                  showQuickFeedback('Data Android disinkronkan ke Server Website!');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-mono text-emerald-400 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isSyncingNow ? 'animate-spin' : ''}`} />
                <span>Rev #{syncStatus.revision}</span>
              </button>
            </div>

            {/* 1-Tap Role Switcher inside Android App */}
            <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-1">
              <span className="text-[9px] font-mono uppercase text-slate-400 mr-1">Peran:</span>
              <button
                onClick={() => handleSwitchUserRole('user')}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                  isPemohon
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
                }`}
              >
                1. Pemohon
              </button>
              <button
                onClick={() => handleSwitchUserRole('admin')}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                  isAdmin
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-emerald-300 hover:bg-slate-700'
                }`}
              >
                2. Admin (Scan)
              </button>
              <button
                onClick={() => handleSwitchUserRole('kepala_gudang')}
                className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                  isKepalaGudang
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-800 text-blue-300 hover:bg-slate-700'
                }`}
              >
                3. Ka. Gudang
              </button>
            </div>
          </div>

          {/* Instant Feedback Banner inside Android Screen */}
          {feedbackBanner && (
            <div className="bg-emerald-600 text-white px-3.5 py-2 text-xs font-semibold flex items-center justify-between gap-2 shadow-md">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{feedbackBanner}</span>
              </div>
              <button onClick={() => setFeedbackBanner(null)} className="text-white/80 hover:text-white">
                &times;
              </button>
            </div>
          )}

          {/* SCROLLABLE ANDROID SCREEN BODY */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
            {/* ==================== TAB 1: BERANDA ANDROID ==================== */}
            {activeAndroidTab === 'home' && (
              <>
                {/* Real-time Cloud Sync Status & Direct .APK Download Pill */}
                <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-emerald-950 text-white p-3.5 shadow-sm border border-emerald-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Sinkronisasi Otomatis Android &harr; Website
                    </span>
                    <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded-full">
                      {syncStatus.connectedDevices.length} Device Aktif
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Semua pengguna (Pemohon SIV, Admin Gudang, Kepala Gudang) di aplikasi Android ini terhubung langsung dengan versi Website secara real-time.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        downloadApkSafely((msg) => setFeedbackBanner(msg));
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-sm transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .APK (v3.0)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        downloadStandaloneHtmlAppSafely().then((ok) => {
                          if (ok) {
                            setFeedbackBanner(
                              'Aplikasi Mobile (Android & iOS) berhasil diunduh! Bebas 403 & langsung login username/password.'
                            );
                          }
                        });
                      }}
                      className="inline-flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-300 font-bold text-[11px] border border-emerald-500/30 transition cursor-pointer"
                    >
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>App iOS / Android (.HTML)</span>
                    </button>
                  </div>
                </div>

                {/* 4 Mobile KPI Cards */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div
                    onClick={() => {
                      setTxSubTab('siv');
                      setActiveAndroidTab('transactions');
                    }}
                    className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs cursor-pointer active:scale-[0.99] transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        SIV Menunggu Scan
                      </span>
                      <ScanLine className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-xl font-black text-slate-900 mt-1 tabular-nums">
                      {pendingAdminSIVs.length}
                    </div>
                    <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                      Tahap 2: Validasi Admin
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setTxSubTab('siv');
                      setActiveAndroidTab('transactions');
                    }}
                    className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs cursor-pointer active:scale-[0.99] transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        Siap Potong Stok
                      </span>
                      <ShieldCheck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-xl font-black text-slate-900 mt-1 tabular-nums">
                      {pendingHeadSIVs.length + pendingHeadLPBs.length}
                    </div>
                    <div className="text-[10px] text-blue-700 font-medium mt-0.5">
                      Tahap 3: Approve Ka.Gudang
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setStockFilter('all');
                      setActiveAndroidTab('stock');
                    }}
                    className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs cursor-pointer active:scale-[0.99] transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        Total Master SKU
                      </span>
                      <Layers className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-xl font-black text-slate-900 mt-1 tabular-nums">
                      {stockItems.length}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                      Tersinkron dengan Website
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setStockFilter('low');
                      setActiveAndroidTab('stock');
                    }}
                    className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs cursor-pointer active:scale-[0.99] transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400">
                        Stok Kritis / Min
                      </span>
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="text-xl font-black text-red-600 mt-1 tabular-nums">
                      {lowStockCount}
                    </div>
                    <div className="text-[10px] text-red-600 font-medium mt-0.5">
                      Perlu Restock Segera
                    </div>
                  </div>
                </div>

                {/* Role-Specific Primary Actions on Android */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-2.5">
                  <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                    <span>Menu Cepat Operasional Android</span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {isPemohon ? 'PEMOHON' : isAdmin ? 'ADMIN GUDANG' : 'KEPALA GUDANG'}
                    </span>
                  </div>

                  {isPemohon && (
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => {
                          setTxSubTab('siv');
                          setShowQuickCreateSIV(true);
                          setActiveAndroidTab('transactions');
                        }}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-between shadow-xs cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <Plus className="w-4 h-4" />
                          <span>Terbitkan Nota SIV Baru (Android)</span>
                        </span>
                        <ArrowUpRight className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setStockFilter('proposals');
                          setActiveAndroidTab('stock');
                        }}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-between cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-amber-400" />
                          <span>Ajukan Perubahan Minimal Stock</span>
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => setActiveAndroidTab('scanner')}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-between shadow-xs cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <ScanLine className="w-4 h-4" />
                          <span>Scan Barcode &amp; ACC SIV ({pendingAdminSIVs.length} Pending)</span>
                        </span>
                        <ArrowUpRight className="w-4 h-4" />
                      </button>

                      <button
                        onClick={onOpenCreateLPB}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-between cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                          <span>Input Penerimaan Barang / LPB Supplier</span>
                        </span>
                        <Plus className="w-4 h-4 text-emerald-400" />
                      </button>
                    </div>
                  )}

                  {isKepalaGudang && (
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => setActiveAndroidTab('scanner')}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-between shadow-xs cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4" />
                          <span>
                            Approve Pengurangan / Penambahan Stok (
                            {pendingHeadSIVs.length + pendingHeadLPBs.length})
                          </span>
                        </span>
                        <ArrowUpRight className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setStockFilter('proposals');
                          setActiveAndroidTab('stock');
                        }}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center justify-between cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Approve Final Minimal Stock</span>
                        </span>
                        <ArrowUpRight className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Live Activity Log Stream (Android & Website) */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Aktivitas Real-Time (Android &amp; Website)</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 font-bold">
                      LIVE
                    </span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {activityLogs.slice(0, 8).map((log) => {
                      const isFromAndroid = log.title.includes('[ANDROID]');
                      return (
                        <div
                          key={log.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                isFromAndroid
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {isFromAndroid ? '📱 ANDROID SYNC' : '💻 WEBSITE SYNC'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="font-bold text-slate-900 mt-1">
                            {log.title.replace('[ANDROID] ', '').replace('[WEB] ', '')}
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                            {log.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ==================== TAB 2: SCANNER & VALIDASI ANDROID ==================== */}
            {activeAndroidTab === 'scanner' && (
              <div className="space-y-3.5">
                {/* Handheld Barcode Laser / Camera Box */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 relative overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                      <QrCode className="w-4 h-4" />
                      <span>Android Barcode / SKU Scanner</span>
                    </span>
                    <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded">
                      LASER READY
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={scannedSkuInput}
                      onChange={(e) => setScannedSkuInput(e.target.value)}
                      placeholder="Ketik / Scan SKU (contoh: BRG-001)..."
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      onClick={() => {
                        const found = stockItems.find(
                          (it) =>
                            it.sku.toLowerCase() === scannedSkuInput.trim().toLowerCase() ||
                            it.name.toLowerCase().includes(scannedSkuInput.trim().toLowerCase())
                        );
                        if (found) {
                          setSelectedScannedItem(found);
                          showQuickFeedback(`Barcode ditemukan: ${found.sku} — ${found.name}`);
                        } else {
                          showQuickFeedback('SKU tidak ditemukan. Pilih dari daftar cepat di bawah.');
                        }
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      Scan
                    </button>
                  </div>

                  {/* Quick SKU Chips to Simulate Laser Scan */}
                  <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1">
                    <span className="text-[10px] text-slate-400 shrink-0">Tap SKU:</span>
                    {stockItems.slice(0, 5).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setScannedSkuInput(item.sku);
                          setSelectedScannedItem(item);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-emerald-300 border border-slate-700 shrink-0 cursor-pointer"
                      >
                        {item.sku}
                      </button>
                    ))}
                  </div>

                  {selectedScannedItem && (
                    <div className="mt-3 p-3 rounded-xl bg-slate-800/90 border border-emerald-500/40 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-emerald-400">
                          {selectedScannedItem.sku}
                        </span>
                        <span className="text-[10px] font-mono bg-slate-700 px-2 py-0.5 rounded text-slate-200 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-400" />
                          {selectedScannedItem.location}
                        </span>
                      </div>
                      <div className="font-bold text-white mt-1">{selectedScannedItem.name}</div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-300">
                        <span>
                          Stok Fisik:{' '}
                          <strong className="text-white font-mono">
                            {selectedScannedItem.currentStock} {selectedScannedItem.unit}
                          </strong>
                        </span>
                        <span>
                          Min Stok:{' '}
                          <strong className="text-amber-400 font-mono">
                            {selectedScannedItem.minStock} {selectedScannedItem.unit}
                          </strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* SECTION FOR ADMIN GUDANG: VALIDASI BARCODE & ACC SIV */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Tahap 2: Validasi Scan &amp; ACC SIV (Admin Gudang)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        SIV terkunci setelah di-ACC Admin, stok baru berkurang saat di-Approve Kepala Gudang
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      {pendingAdminSIVs.length} SIV
                    </span>
                  </div>

                  {selectedVoucherForAndroidScan ? (
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold font-mono text-emerald-950">
                            {selectedVoucherForAndroidScan.voucherNumber}
                          </span>
                          <div className="text-[11px] text-slate-600">
                            Pemohon: {selectedVoucherForAndroidScan.requestedBy} (
                            {selectedVoucherForAndroidScan.department})
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedVoucherForAndroidScan(null)}
                          className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold"
                        >
                          Tutup
                        </button>
                      </div>

                      <div className="space-y-2">
                        {selectedVoucherForAndroidScan.items.map((item) => {
                          const st = itemScanState[item.itemId] || {
                            scanned: true,
                            qty: item.requestedQty,
                            cancelled: false,
                          };
                          return (
                            <div
                              key={item.itemId}
                              className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-slate-700">{item.sku}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                  ✓ BARCODE SCANNED
                                </span>
                              </div>
                              <div className="font-semibold text-slate-900">{item.itemName}</div>
                              <div className="flex items-center justify-between gap-2 pt-1">
                                <span className="text-[11px] text-slate-500">
                                  Diminta: <strong>{item.requestedQty}</strong> {item.unit}
                                </span>
                                <div className="flex items-center gap-2">
                                  <label className="text-[11px] text-slate-700 font-medium">
                                    Qty Keluar:
                                  </label>
                                  <input
                                    type="number"
                                    min={0}
                                    max={item.requestedQty}
                                    value={st.cancelled ? 0 : st.qty}
                                    onChange={(e) => {
                                      const val = Math.max(0, Number(e.target.value));
                                      setItemScanState((prev) => ({
                                        ...prev,
                                        [item.itemId]: {
                                          scanned: true,
                                          qty: val,
                                          cancelled: val === 0,
                                        },
                                      }));
                                    }}
                                    className="w-16 px-2 py-1 rounded-lg border border-slate-300 text-center font-mono font-bold text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Nama Penerima Barang (Wajib):
                        </label>
                        <input
                          type="text"
                          value={recipientNameInput}
                          onChange={(e) => setRecipientNameInput(e.target.value)}
                          placeholder="Nama penerima fisik barang..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                        />
                      </div>

                      {isAdmin ? (
                        <button
                          onClick={handleAdminSubmitScanAndroid}
                          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                        >
                          <PackageCheck className="w-4 h-4" />
                          <span>ACC SIV &amp; Validasi Barang (Sync ke Website)</span>
                        </button>
                      ) : (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
                          <span>Khusus Admin Gudang untuk ACC &amp; Scan SIV.</span>
                          <button
                            onClick={() => handleSwitchUserRole('admin')}
                            className="px-2 py-1 rounded bg-amber-500 text-slate-950 font-bold text-[10px]"
                          >
                            Ganti ke Admin
                          </button>
                        </div>
                      )}
                    </div>
                  ) : pendingAdminSIVs.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      Tidak ada SIV berstatus PENDING yang menunggu scan Admin.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingAdminSIVs.map((v) => (
                        <div
                          key={v.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                        >
                          <div>
                            <div className="text-xs font-bold font-mono text-slate-900">
                              {v.voucherNumber}
                            </div>
                            <div className="text-[11px] text-slate-600">
                              {v.requestedBy} &bull; {v.items.length} jenis barang
                            </div>
                          </div>
                          <button
                            onClick={() => handleSelectVoucherToScan(v)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                          >
                            <ScanLine className="w-3.5 h-3.5" />
                            <span>Scan &amp; ACC</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SECTION FOR KEPALA GUDANG: APPROVE PENGURANGAN & PENAMBAHAN STOCK */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        Tahap 3: Approve Stok (Kepala Gudang)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Otorisasi final pengurangan stok (SIV) &amp; penambahan stok (LPB)
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      {pendingHeadSIVs.length + pendingHeadLPBs.length} Dokumen
                    </span>
                  </div>

                  {!isKepalaGudang && (pendingHeadSIVs.length > 0 || pendingHeadLPBs.length > 0) && (
                    <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-center justify-between">
                      <span>Login sebagai Kepala Gudang untuk meng-approve mutasi stok.</span>
                      <button
                        onClick={() => handleSwitchUserRole('kepala_gudang')}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[10px]"
                      >
                        Beralih Ka. Gudang
                      </button>
                    </div>
                  )}

                  {pendingHeadSIVs.map((v) => (
                    <div
                      key={v.id}
                      className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-blue-950">
                          SIV #{v.voucherNumber}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                          Sudah Di-ACC Admin ({v.approvedByAdmin || 'Admin'})
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Penerima: <strong>{v.recipientName || v.requestedBy}</strong> &bull;{' '}
                        {v.items.length} item
                      </div>
                      <button
                        onClick={() => handleKepalaApproveSIVAndroid(v)}
                        disabled={!isKepalaGudang}
                        className={`w-full py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                          isKepalaGudang
                            ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'
                            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Approve Pengurangan Stock (Kepala Gudang)</span>
                      </button>
                    </div>
                  ))}

                  {pendingHeadLPBs.map((lpb) => (
                    <div
                      key={lpb.id}
                      className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold font-mono text-emerald-950">
                          LPB #{lpb.lpbNumber}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                          SJ: {lpb.sjNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Supplier: <strong>{lpb.supplierName}</strong> &bull; {lpb.items.length} item
                      </div>
                      <button
                        onClick={() => handleKepalaApproveLPBAndroid(lpb)}
                        disabled={!isKepalaGudang}
                        className={`w-full py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                          isKepalaGudang
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Approve Penambahan Stock (Kepala Gudang)</span>
                      </button>
                    </div>
                  ))}

                  {pendingHeadSIVs.length === 0 && pendingHeadLPBs.length === 0 && (
                    <div className="text-center py-4 text-xs text-slate-400">
                      Seluruh dokumen SIV &amp; LPB telah selesai di-approve Kepala Gudang.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ==================== TAB 3: SIV & LPB MOBILE ==================== */}
            {activeAndroidTab === 'transactions' && (
              <div className="space-y-3">
                {/* Switch SIV vs LPB */}
                <div className="grid grid-cols-2 gap-1.5 bg-slate-200 p-1 rounded-xl">
                  <button
                    onClick={() => setTxSubTab('siv')}
                    className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      txSubTab === 'siv'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Nota SIV ({visibleVouchers.length})
                  </button>
                  <button
                    onClick={() => setTxSubTab('lpb')}
                    className={`py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                      txSubTab === 'lpb'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    LPB Masuk ({lpbDocuments.length})
                  </button>
                </div>

                {txSubTab === 'siv' ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => setShowQuickCreateSIV(!showQuickCreateSIV)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Buat SIV Cepat (Android)</span>
                      </button>
                      <button
                        onClick={onOpenCreateVoucher}
                        className="py-2.5 px-3 rounded-xl bg-slate-900 text-white font-semibold text-xs cursor-pointer"
                      >
                        Form Lengkap
                      </button>
                    </div>

                    {showQuickCreateSIV && (
                      <form
                        onSubmit={handleQuickCreateSIVSubmit}
                        className="bg-amber-50/90 border border-amber-300 rounded-2xl p-3.5 space-y-2.5"
                      >
                        <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                          <span>Terbitkan SIV Baru dari Android</span>
                          <button
                            type="button"
                            onClick={() => setShowQuickCreateSIV(false)}
                            className="text-slate-500 text-xs"
                          >
                            Batal
                          </button>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Keperluan Pengambilan Barang:
                          </label>
                          <input
                            type="text"
                            required
                            value={quickSivPurpose}
                            onChange={(e) => setQuickSivPurpose(e.target.value)}
                            placeholder="Contoh: Penggantian Bearing Conveyor Line 2"
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs"
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-1">
                            <label className="text-[11px] font-semibold text-slate-700">
                              Daftar Barang ({quickSivItems.length} Item):
                            </label>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setShowQuickSivBarcodeScanner((prev) => !prev)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg font-bold text-[10px] ${
                                  showQuickSivBarcodeScanner
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-emerald-700 text-white'
                                }`}
                              >
                                <ScanLine className="w-3 h-3" />
                                <span>{showQuickSivBarcodeScanner ? 'Tutup Scan' : '+ Scan Barcode'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const usedIds = new Set(quickSivItems.map((i) => i.itemId));
                                  const next =
                                    stockItems.find(
                                      (s) => !usedIds.has(s.id) && s.currentStock - s.allocatedStock > 0
                                    ) || stockItems[0];
                                  if (next) {
                                    setQuickSivItems((prev) => [...prev, { itemId: next.id, qty: 1 }]);
                                  }
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 text-amber-400 font-bold text-[10px]"
                              >
                                <Plus className="w-3 h-3" />
                                <span>+ Baris</span>
                              </button>
                            </div>
                          </div>

                          {showQuickSivBarcodeScanner && (
                            <BarcodeAddScannerPanel
                              mode="SIV"
                              stockItems={stockItems}
                              onBarcodeAddItem={(item, qty) => {
                                const avail = Math.max(0, item.currentStock - item.allocatedStock);
                                if (avail <= 0) return;
                                setQuickSivItems((prev) => {
                                  const existingIdx = prev.findIndex((r) => r.itemId === item.id);
                                  if (existingIdx >= 0) {
                                    return prev.map((r, i) =>
                                      i === existingIdx
                                        ? { ...r, qty: Math.min(avail, r.qty + qty) }
                                        : r
                                    );
                                  }
                                  return [...prev, { itemId: item.id, qty: Math.min(avail, qty) }];
                                });
                              }}
                              onClose={() => setShowQuickSivBarcodeScanner(false)}
                            />
                          )}

                          {quickSivItems.map((row, idx) => {
                            const selected = stockItems.find((s) => s.id === row.itemId);
                            const avail = selected
                              ? Math.max(0, selected.currentStock - selected.allocatedStock)
                              : 1;
                            return (
                              <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                                <div className="col-span-8">
                                  <select
                                    value={row.itemId}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setQuickSivItems((prev) =>
                                        prev.map((r, i) => (i === idx ? { ...r, itemId: val, qty: 1 } : r))
                                      );
                                    }}
                                    className="w-full px-2 py-1.5 rounded-xl border border-slate-300 bg-white text-xs"
                                  >
                                    {stockItems.map((it) => {
                                      const itAvail = Math.max(0, it.currentStock - it.allocatedStock);
                                      return (
                                        <option
                                          key={it.id}
                                          value={it.id}
                                          disabled={itAvail <= 0 && it.id !== row.itemId}
                                        >
                                          {it.sku} - {it.name} (Siap: {itAvail} {it.unit})
                                        </option>
                                      );
                                    })}
                                  </select>
                                </div>
                                <div className="col-span-3">
                                  <input
                                    type="number"
                                    min={1}
                                    max={avail}
                                    required
                                    value={row.qty}
                                    onChange={(e) => {
                                      const v = Math.max(1, Math.min(avail, Number(e.target.value) || 1));
                                      setQuickSivItems((prev) =>
                                        prev.map((r, i) => (i === idx ? { ...r, qty: v } : r))
                                      );
                                    }}
                                    className="w-full px-2 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-center"
                                  />
                                </div>
                                <div className="col-span-1 flex justify-end">
                                  {quickSivItems.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setQuickSivItems((prev) => prev.filter((_, i) => i !== idx))
                                      }
                                      className="p-1 text-red-500 hover:bg-red-100 rounded-lg"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <button
                          type="submit"
                          className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                        >
                          Terbitkan SIV &amp; Sinkronkan ke Website
                        </button>
                      </form>
                    )}

                    <div className="space-y-2.5">
                      {visibleVouchers.map((v) => {
                        const isPending = v.status === 'PENDING';
                        const isApprovedAdmin = v.status === 'APPROVED';
                        const isCompleted = v.status === 'COMPLETED';
                        return (
                          <div
                            key={v.id}
                            className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-bold text-xs text-slate-900">
                                {v.voucherNumber}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isCompleted
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isApprovedAdmin
                                    ? 'bg-blue-100 text-blue-800'
                                    : isPending
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {isCompleted
                                  ? 'SELESAI (STOK DIPOTONG)'
                                  : isApprovedAdmin
                                  ? 'DI-ACC ADMIN (TUNGGU KA.GUDANG)'
                                  : isPending
                                  ? 'MENUNGGU ACC ADMIN'
                                  : 'DITOLAK'}
                              </span>
                            </div>

                            <div className="text-xs font-semibold text-slate-800">{v.purpose}</div>
                            <div className="text-[11px] text-slate-500">
                              Pemohon: <strong>{v.requestedBy}</strong> ({v.department})
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1.5">
                              <button
                                onClick={() => onPrintDocument('NPB', v)}
                                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Nota PDF</span>
                              </button>

                              <div className="flex items-center gap-1.5">
                                {/* Pemohon can edit/delete only when PENDING */}
                                {isPending && (
                                  <>
                                    <button
                                      onClick={() => onOpenEditVoucher(v)}
                                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                                      title="Edit SIV"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => deleteIssueVoucher(v.id)}
                                      className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                                      title="Hapus SIV"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}

                                {/* Admin Gudang button for Tahap 2 */}
                                {isPending && isAdmin && (
                                  <button
                                    onClick={() => handleSelectVoucherToScan(v)}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <ScanLine className="w-3.5 h-3.5" />
                                    <span>ACC &amp; Scan</span>
                                  </button>
                                )}

                                {/* Kepala Gudang button for Tahap 3 */}
                                {isApprovedAdmin && isKepalaGudang && (
                                  <button
                                    onClick={() => handleKepalaApproveSIVAndroid(v)}
                                    className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>Approve Stok</span>
                                  </button>
                                )}

                                {(isPending || isApprovedAdmin) && (
                                  <button
                                    onClick={() => onOpenApprovalModal(v)}
                                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold cursor-pointer"
                                  >
                                    Detail
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="space-y-2.5">
                    {(isAdmin || isKepalaGudang) && (
                      <button
                        onClick={onOpenCreateLPB}
                        className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Input LPB / Surat Jalan Supplier (Android)</span>
                      </button>
                    )}

                    {lpbDocuments.map((lpb) => {
                      const isWaitingHead = lpb.status === 'PENDING_HEAD_APPROVAL';
                      return (
                        <div
                          key={lpb.id}
                          className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-slate-900">
                              {lpb.lpbNumber}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isWaitingHead
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isWaitingHead
                                ? 'MENUNGGU APPROVE KA.GUDANG'
                                : 'STOK RESMI BERTAMBAH'}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-800">
                            {lpb.supplierName} (SJ: {lpb.sjNumber})
                          </div>
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <button
                              onClick={() => onPrintDocument('LPB', lpb)}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Cetak A5</span>
                            </button>

                            {isWaitingHead && isKepalaGudang && (
                              <button
                                onClick={() => handleKepalaApproveLPBAndroid(lpb)}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Approve Tambah Stok</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ==================== TAB 4: STOK & PENGAJUAN MINIMAL STOCK ==================== */}
            {activeAndroidTab === 'stock' && (
              <div className="space-y-3">
                <div className="flex gap-1.5 bg-slate-200 p-1 rounded-xl">
                  <button
                    onClick={() => setStockFilter('all')}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                      stockFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Semua ({stockItems.length})
                  </button>
                  <button
                    onClick={() => setStockFilter('low')}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                      stockFilter === 'low' ? 'bg-white text-red-600 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Kritis ({lowStockCount})
                  </button>
                  <button
                    onClick={() => setStockFilter('proposals')}
                    className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                      stockFilter === 'proposals'
                        ? 'bg-white text-amber-700 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    Ajuan Min ({minStockProposals.length})
                  </button>
                </div>

                {stockFilter !== 'proposals' ? (
                  <>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={stockSearch}
                        onChange={(e) => setStockSearch(e.target.value)}
                        placeholder="Cari Material Code, nama barang, atau rak..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-200 text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      {stockItems
                        .filter((i) => (stockFilter === 'low' ? i.currentStock <= i.minStock : true))
                        .filter(
                          (i) =>
                            i.sku.toLowerCase().includes(stockSearch.toLowerCase()) ||
                            i.name.toLowerCase().includes(stockSearch.toLowerCase()) ||
                            i.location.toLowerCase().includes(stockSearch.toLowerCase())
                        )
                        .map((item) => {
                          const isLow = item.currentStock <= item.minStock;
                          return (
                            <div
                              key={item.id}
                              className="bg-white rounded-2xl border border-slate-200 p-3 shadow-xs flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-xs text-slate-900">
                                    {item.sku}
                                  </span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                    {item.location}
                                  </span>
                                  {isLow && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-100 text-red-700">
                                      KRITIS
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-semibold text-slate-800 truncate mt-0.5">
                                  {item.name}
                                </div>
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  Min Stock: <strong>{item.minStock}</strong> {item.unit}
                                </div>
                              </div>

                              <div className="text-right shrink-0">
                                <div
                                  className={`text-sm font-black font-mono ${
                                    isLow ? 'text-red-600' : 'text-emerald-700'
                                  }`}
                                >
                                  {item.currentStock} {item.unit}
                                </div>
                                <button
                                  onClick={() => {
                                    setProposeItemId(item.id);
                                    setProposeMinVal(item.minStock + 5);
                                    setStockFilter('proposals');
                                  }}
                                  className="mt-1 text-[10px] font-semibold text-blue-600 hover:underline cursor-pointer"
                                >
                                  Ubah Min Stok
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    {/* Form Pengajuan Minimal Stock via Android */}
                    <form
                      onSubmit={handleQuickProposeMinStock}
                      className="bg-white rounded-2xl border border-slate-200 p-3.5 space-y-2.5"
                    >
                      <div className="text-xs font-bold text-slate-900">
                        Ajukan Perubahan Minimal Stock (Android)
                      </div>
                      <select
                        required
                        value={proposeItemId}
                        onChange={(e) => setProposeItemId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                      >
                        <option value="">-- Pilih Barang --</option>
                        {stockItems.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.sku} - {it.name} (Min Saat Ini: {it.minStock})
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            Min Baru:
                          </label>
                          <input
                            type="number"
                            min={0}
                            required
                            value={proposeMinVal}
                            onChange={(e) => setProposeMinVal(Number(e.target.value))}
                            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            Alasan Pengajuan:
                          </label>
                          <input
                            type="text"
                            required
                            value={proposeReason}
                            onChange={(e) => setProposeReason(e.target.value)}
                            placeholder="Contoh: Lead time meningkat"
                            className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
                      >
                        Kirim Pengajuan Minimal Stock
                      </button>
                    </form>

                    {/* List Pengajuan Minimal Stock (3-Stage Workflow) */}
                    <div className="space-y-2">
                      {minStockProposals.map((p) => (
                        <div
                          key={p.id}
                          className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-bold text-xs text-slate-900">
                              {p.proposalNumber} &bull; {p.sku}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                p.status === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : p.status === 'VERIFIED_ADMIN'
                                  ? 'bg-blue-100 text-blue-800'
                                  : p.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {p.status === 'APPROVED'
                                ? 'DISETUJUI KA.GUDANG'
                                : p.status === 'VERIFIED_ADMIN'
                                ? 'TERVERIFIKASI ADMIN (LOCKED)'
                                : p.status === 'PENDING'
                                ? 'MENUNGGU VERIFIKASI ADMIN'
                                : 'DITOLAK'}
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-slate-800">{p.itemName}</div>
                          <div className="text-[11px] text-slate-600">
                            Min Lama: <strong>{p.currentMinStock}</strong> &rarr; Usulan Baru:{' '}
                            <strong className="text-emerald-700">{p.proposedMinStock}</strong>{' '}
                            {p.unit}
                          </div>

                          {/* Tahap 2: Admin Gudang Verifikasi (Terkunci, belum ubah sistem) */}
                          {p.status === 'PENDING' && isAdmin && (
                            <button
                              onClick={() => {
                                verifyMinStockProposal(
                                  p.id,
                                  'Diverifikasi oleh Admin Gudang via Android'
                                );
                                showQuickFeedback(
                                  `Pengajuan ${p.proposalNumber} diverifikasi Admin (Terkunci, menunggu Approve Kepala Gudang).`
                                );
                              }}
                              className="w-full py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                            >
                              Verifikasi Admin Gudang (Kunci Usulan)
                            </button>
                          )}

                          {/* Tahap 3: Kepala Gudang Approve Final (Mengubah Min Stock Sistem) */}
                          {p.status === 'VERIFIED_ADMIN' && isKepalaGudang && (
                            <button
                              onClick={() => {
                                approveMinStockProposal(
                                  p.id,
                                  'Disetujui Final oleh Kepala Gudang via Android'
                                );
                                showQuickFeedback(
                                  `Pengajuan ${p.proposalNumber} di-Approve Kepala Gudang! Min Stock resmi berubah.`
                                );
                              }}
                              className="w-full py-1.5 rounded-xl bg-blue-600 text-white font-bold text-xs cursor-pointer"
                            >
                              Approve Final Kepala Gudang (Perbarui Sistem)
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ==================== TAB 5: CLOUD SYNC & INSTALL APK/PWA ==================== */}
            {activeAndroidTab === 'sync' && (
              <div className="space-y-3.5">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      Status Sinkronisasi Android &harr; Website
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {syncStatus.connected ? 'ONLINE REAL-TIME' : 'RECONNECTING'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] text-slate-500">Revisi Server</div>
                      <div className="text-sm font-black font-mono text-slate-900">
                        #{syncStatus.revision}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="text-[10px] text-slate-500">Update Terakhir</div>
                      <div className="text-xs font-bold text-slate-900">
                        {syncStatus.lastSyncAt
                          ? new Date(syncStatus.lastSyncAt).toLocaleTimeString('id-ID')
                          : 'Baru saja'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      setIsSyncingNow(true);
                      await forceSyncNow();
                      setTimeout(() => setIsSyncingNow(false), 500);
                      showQuickFeedback('Sinkronisasi penuh ke Website berhasil!');
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncingNow ? 'animate-spin' : ''}`} />
                    <span>Sinkronkan Sekarang ke Website</span>
                  </button>
                </div>

                {/* Connected Devices List */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
                  <div className="text-xs font-bold text-slate-900">
                    Perangkat Terhubung ke Server Gudang ({syncStatus.connectedDevices.length})
                  </div>
                  <div className="space-y-2">
                    {syncStatus.connectedDevices.map((dev) => (
                      <div
                        key={dev.clientId}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {dev.deviceType === 'ANDROID' ? (
                            <Smartphone className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Monitor className="w-4 h-4 text-blue-600" />
                          )}
                          <div>
                            <div className="font-bold text-slate-900">{dev.deviceName}</div>
                            <div className="text-[10px] text-slate-500">
                              {dev.userName} ({dev.userRole})
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                          ONLINE
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Install PWA to Android Home Screen */}
                <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-2.5">
                  <div className="text-xs font-bold text-emerald-400">
                    Pasang Aplikasi di Layar Utama Android
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Aplikasi ini mendukung standar Progressive Web App (PWA) Android. Pasang ke layar utama HP Android untuk berjalan layar penuh (standalone) tanpa bar browser.
                  </p>
                  {!isInstalled && isInstallable ? (
                    <button
                      onClick={install}
                      className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Install Aplikasi Android Sekarang</span>
                    </button>
                  ) : (
                    <div className="text-[11px] text-emerald-300 font-mono">
                      ✓ Siap digunakan di Android Chrome (Menu &rarr; Tambahkan ke Layar Utama)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ANDROID BOTTOM NAVIGATION BAR */}
          <div className="bg-slate-950 border-t border-slate-800 px-2 py-1.5 grid grid-cols-5 gap-1">
            <button
              onClick={() => setActiveAndroidTab('home')}
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                activeAndroidTab === 'home'
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4 mb-0.5" />
              <span className="text-[10px]">Beranda</span>
            </button>

            <button
              onClick={() => setActiveAndroidTab('scanner')}
              className={`relative py-1.5 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                activeAndroidTab === 'scanner'
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ScanLine className="w-4 h-4 mb-0.5" />
              <span className="text-[10px]">Scanner</span>
              {pendingAdminSIVs.length + pendingHeadSIVs.length > 0 && (
                <span className="absolute top-1 right-2.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
                  {pendingAdminSIVs.length + pendingHeadSIVs.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveAndroidTab('transactions')}
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                activeAndroidTab === 'transactions'
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 mb-0.5" />
              <span className="text-[10px]">SIV / LPB</span>
            </button>

            <button
              onClick={() => setActiveAndroidTab('stock')}
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                activeAndroidTab === 'stock'
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4 mb-0.5" />
              <span className="text-[10px]">Stok/Min</span>
            </button>

            <button
              onClick={() => setActiveAndroidTab('sync')}
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center transition cursor-pointer ${
                activeAndroidTab === 'sync'
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wifi className="w-4 h-4 mb-0.5 text-emerald-400" />
              <span className="text-[10px]">Sync</span>
            </button>
          </div>

          {/* Android Gesture Navigation Pill */}
          <div className="bg-slate-950 pb-2 pt-0.5 flex justify-center">
            <div className="w-28 h-1 rounded-full bg-slate-700" />
          </div>
        </div>
      </div>
    </div>
  );
};
