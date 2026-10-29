import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  IssueVoucherDocument,
  StockItem,
  UserRole,
  UserAccount,
  getEffectivePermissions,
} from '../types/inventory';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  PackageCheck,
  ShieldCheck,
  ShieldAlert,
  X,
  ScanBarcode,
  QrCode,
  CheckSquare,
  Square,
  ArrowRight,
  Clock,
  Sparkles,
  FileCheck2,
  Ban,
  Lock,
  MapPin,
  Camera,
  CameraOff,
  Check,
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

interface ApprovalModalProps {
  voucher: IssueVoucherDocument | null;
  stockItems: StockItem[];
  currentAdminName: string;
  currentUserRole?: UserRole;
  currentUser?: UserAccount | null;
  warehouseHeadDefaultName?: string;
  onClose: () => void;
  onApprove: (handoverData: {
    warehouseHeadName?: string;
    approverAdminName?: string;
    notes?: string;
    handoverOfficer?: string;
    recipientName?: string;
  }) => void;
  onCompleteHandover?: (handoverData: {
    handoverOfficer?: string;
    recipientName: string;
    warehouseHeadName?: string;
    notes?: string;
    validatedItems: {
      itemId: string;
      issuedQty: number;
      isCancelled: boolean;
      barcodeScanned?: boolean;
      sourceLocation?: string;
    }[];
  }) => { success: boolean; voucher?: IssueVoucherDocument; error?: string };
  onReject: (reason: string) => void;
  onSuccessPrint?: (voucher: IssueVoucherDocument) => void;
}

interface ItemHandoverState {
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  requestedQty: number;
  issuedQty: number;
  isCancelled: boolean; // Centang barang tidak jadi dikeluarkan (qty = 0)
  barcodeValidated: boolean; // Hasil validasi scan barcode
  barcodeScannedAt?: string;
  sourceLocation: string; // Lokasi rak tempat barang fisik diambil saat validasi
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  voucher,
  stockItems,
  currentAdminName,
  currentUserRole = 'admin',
  currentUser,
  warehouseHeadDefaultName = 'Suryadi',
  onClose,
  onApprove,
  onCompleteHandover,
  onReject,
  onSuccessPrint,
}) => {
  if (!voucher) return null;

  // Alur Baru SIV:
  // Tahap 1: Pemohon menerbitkan SIV (status === 'PENDING')
  // Tahap 2: Kepala Store ACC SIV (saat status === 'PENDING' -> berubah ke 'APPROVED')
  // Tahap 3: Admin Store menyerahkan barang ke penerima & validasi barcode (saat status === 'APPROVED' -> berubah ke 'HANDOVER_COMPLETED' & otomatis potong stock)
  const isHeadApprovalStage = voucher.status === 'PENDING';
  const isAdminHandoverStage = voucher.status === 'APPROVED';

  const perms = currentUser ? getEffectivePermissions(currentUser) : null;
  const canPerformHeadApproval = perms
    ? perms.canApproveSIVStockDeduction
    : currentUserRole === 'superuser' || currentUserRole === 'kepala_gudang';
  const canPerformAdminHandover = perms
    ? perms.canValidateSIV
    : currentUserRole === 'superuser' ||
      currentUserRole === 'kepala_gudang' ||
      currentUserRole === 'admin';

  // State untuk Tahap 3: Admin Store (Menyerahkan Barang ke Penerima & Validasi Scan Barcode -> Otomatis Potong Stock)
  const [recipientName, setRecipientName] = useState(
    voucher.recipientName || voucher.requestedBy || ''
  );
  const [handoverOfficer, setHandoverOfficer] = useState(
    voucher.handoverOfficer || voucher.approvedByAdmin || currentAdminName || 'Hendra Gunawan'
  );
  const [handoverNotes, setHandoverNotes] = useState(voucher.notes || '');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
    sku?: string;
    scannedAt?: string;
  } | null>(null);
  const [lastScannedSku, setLastScannedSku] = useState<string | null>(null);
  const [justScannedFlash, setJustScannedFlash] = useState<{
    sku: string;
    itemName: string;
  } | null>(null);

  // Camera Scanner State (Otomatis aktif apabila dibuka menggunakan HP pada tahap Penyerahan Barang Admin)
  const [isCameraActive, setIsCameraActive] = useState<boolean>(() => isMobilePhoneDevice());
  const [targetScanRowIdx, setTargetScanRowIdx] = useState<number | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const lastCameraScanRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });
  const flashTimerRef = useRef<number | null>(null);

  // State untuk Tahap 2: Kepala Store (ACC SIV)
  const [warehouseHeadName, setWarehouseHeadName] = useState(
    voucher.warehouseHeadName ||
      voucher.approvedByWarehouseHead ||
      (currentUserRole === 'kepala_gudang' ? currentAdminName : warehouseHeadDefaultName) ||
      'Suryadi'
  );
  const [headVerificationNotes, setHeadVerificationNotes] = useState('');

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const { storageLocations } = useInventory();

  const [itemsState, setItemsState] = useState<ItemHandoverState[]>(() =>
    voucher.items.map((it) => {
      const stockObj = stockItems.find((s) => s.id === it.itemId || s.sku === it.sku);
      return {
        itemId: it.itemId,
        sku: it.sku,
        itemName: it.itemName,
        unit: it.unit,
        requestedQty: it.requestedQty,
        issuedQty:
          it.issuedQty !== undefined
            ? it.issuedQty
            : it.approvedQty !== undefined
            ? it.approvedQty
            : it.requestedQty,
        isCancelled: it.isCancelled || false,
        barcodeValidated: it.barcodeValidated || false,
        barcodeScannedAt: it.barcodeScannedAt,
        sourceLocation: it.sourceLocation || stockObj?.location || 'Store Utama',
      };
    })
  );

  const handleSourceLocationChange = (index: number, newLocation: string) => {
    setItemsState((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, sourceLocation: newLocation } : item))
    );
  };

  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const stopCameraScanner = () => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (isAdminHandoverStage && !isMobilePhoneDevice() && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
    return () => {
      stopCameraScanner();
      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current);
      }
    };
  }, [isAdminHandoverStage]);

  // Fungsi memproses hasil scan barcode (via Kamera HP / scanner USB / ketik manual / tombol scan)
  const processBarcodeScan = (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;

    setErrorMsg('');
    const matchIdx = itemsState.findIndex(
      (i) =>
        i.sku.toUpperCase() === code ||
        code.includes(i.sku.toUpperCase()) ||
        i.itemId.toUpperCase() === code ||
        i.itemName.toUpperCase().includes(code)
    );

    if (matchIdx === -1) {
      soundService.playScanError();
      setScanFeedback({
        type: 'error',
        text: `Kode Barcode "${rawCode}" tidak ditemukan dalam daftar barang Nota SIV #${voucher.voucherNumber}!`,
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const timeStr = new Date(nowIso).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const target = itemsState[matchIdx];

    soundService.playScanSuccess();
    setLastScannedSku(target.sku);
    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }
    setJustScannedFlash({ sku: target.sku, itemName: target.itemName });
    flashTimerRef.current = window.setTimeout(() => {
      setJustScannedFlash(null);
    }, 1800);

    setItemsState((prev) =>
      prev.map((row, idx) => {
        if (idx !== matchIdx) return row;
        const restoredQty =
          row.isCancelled || row.issuedQty === 0 ? row.requestedQty : row.issuedQty;
        return {
          ...row,
          barcodeValidated: true,
          barcodeScannedAt: nowIso,
          isCancelled: false,
          issuedQty: restoredQty,
        };
      })
    );

    setScanFeedback({
      type: 'success',
      sku: target.sku,
      scannedAt: timeStr,
      text: `✓ BARANG BERHASIL DISCAN! [${target.sku}] "${target.itemName}" telah tervalidasi pada ${timeStr}. Silakan pastikan jumlah penyerahan (${target.requestedQty} ${target.unit}).`,
    });
    setBarcodeInput('');
    if (targetScanRowIdx === matchIdx) {
      setTargetScanRowIdx(null);
    }
  };

  // Efek mengaktifkan kamera belakang HP saat isCameraActive = true pada tahap Penyerahan Admin
  useEffect(() => {
    if (!isAdminHandoverStage || !isCameraActive || isRejecting) {
      stopCameraScanner();
      return;
    }

    let isMounted = true;
    setCameraError(null);

    const startCamera = async () => {
      stopCameraScanner();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Browser perangkat ini tidak mendukung akses kamera langsung. Gunakan tombol Konfirmasi Scan di bawah atau input manual.'
        );
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const BarcodeDetectorClass = (
          window as unknown as {
            BarcodeDetector?: new (opts?: { formats: string[] }) => {
              detect: (el: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
            };
          }
        ).BarcodeDetector;

        if (BarcodeDetectorClass) {
          const detector = new BarcodeDetectorClass({
            formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'qr_code', 'upc_a'],
          });

          scanIntervalRef.current = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                const raw = barcodes[0].rawValue.trim().toUpperCase();
                const now = Date.now();
                if (
                  raw === lastCameraScanRef.current.code &&
                  now - lastCameraScanRef.current.ts < 1500
                ) {
                  return;
                }
                lastCameraScanRef.current = { code: raw, ts: now };
                processBarcodeScan(raw);
              }
            } catch {
              // ignore frame error
            }
          }, 300);
        }
      } catch {
        if (isMounted) {
          setCameraError(
            'Izin kamera belum diaktifkan. Izinkan akses kamera pada browser HP Anda atau klik tombol barang di bawah untuk konfirmasi scan.'
          );
        }
      }
    };

    startCamera();
    return () => {
      isMounted = false;
      stopCameraScanner();
    };
  }, [isAdminHandoverStage, isCameraActive, isRejecting, itemsState]);

  const handleBarcodeFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) {
      // Apabila di HP dan user menekan tombol Validasi Barcode saat input kosong -> aktifkan kamera!
      setIsCameraActive(true);
      return;
    }
    processBarcodeScan(barcodeInput);
  };

  // Ubah Qty barang yang diserahkan
  // Apabila diisi 0, maka otomatis dianggap "barang tidak jadi dikeluarkan" (isCancelled = true)
  const handleIssuedQtyChange = (idx: number, rawVal: string) => {
    const parsed = Math.max(0, parseInt(rawVal || '0', 10) || 0);
    setErrorMsg('');
    setItemsState((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const isZero = parsed === 0;
        return {
          ...row,
          issuedQty: parsed,
          isCancelled: isZero,
          barcodeValidated: isZero ? true : row.barcodeValidated,
        };
      })
    );
  };

  // Centang / uncentang "Barang tidak jadi dikeluarkan" (otomatis set Qty = 0)
  const handleToggleCancelItem = (idx: number) => {
    setErrorMsg('');
    setItemsState((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const nextCancelled = !row.isCancelled;
        return {
          ...row,
          isCancelled: nextCancelled,
          issuedQty: nextCancelled ? 0 : row.requestedQty,
          barcodeValidated: nextCancelled ? true : row.barcodeValidated,
        };
      })
    );
  };

  // Validasi semua barcode sekaligus (untuk kemudahan demo / percepatan)
  const handleScanAllBarcodes = () => {
    const nowIso = new Date().toISOString();
    const timeStr = new Date(nowIso).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    soundService.playScanSuccess();
    setItemsState((prev) =>
      prev.map((row) => ({
        ...row,
        barcodeValidated: true,
        barcodeScannedAt: row.barcodeScannedAt || nowIso,
      }))
    );
    setScanFeedback({
      type: 'success',
      scannedAt: timeStr,
      text: `✓ BARANG BERHASIL DISCAN! Seluruh item barang (${itemsState.length} item) pada Nota SIV ini telah berhasil divalidasi barcode.`,
    });
  };

  // Tahap 2 (Kepala Store): ACC SIV
  // -> SIV Terkunci, Pemohon tidak bisa edit/hapus, menunggu Admin Store menyerahkan barang ke penerima (Stok belum berubah)
  const handleConfirmHeadApproval = () => {
    setErrorMsg('');
    if (!canPerformHeadApproval) {
      setErrorMsg('Hanya User Kepala Store yang memiliki wewenang untuk ACC SIV.');
      return;
    }
    if (!warehouseHeadName.trim()) {
      setErrorMsg('Nama Kepala Store wajib diisi untuk ACC SIV.');
      return;
    }

    onApprove({
      warehouseHeadName: warehouseHeadName.trim(),
      notes: headVerificationNotes.trim() || undefined,
    });
  };

  // Tahap 3 (Admin Store): Menyerahkan Barang ke Penerima & Validasi Scan Barcode
  // -> Setelah Admin menyerahkan barang, OTOMATIS STOCK BERKURANG pada sistem!
  const handleConfirmAdminHandover = () => {
    setErrorMsg('');

    if (!canPerformAdminHandover) {
      setErrorMsg('Hanya User Admin Store yang memiliki wewenang untuk menyerahkan barang SIV ke penerima.');
      return;
    }

    if (!recipientName.trim()) {
      setErrorMsg('Nama Penerima barang wajib diinputkan oleh Admin Store.');
      return;
    }

    if (!handoverOfficer.trim()) {
      setErrorMsg('Nama Petugas Admin Store yang menyerahkan barang wajib diisi.');
      return;
    }

    // Cek apakah semua barang yang qty > 0 sudah di-scan barcode & stok fisik mencukupi
    for (const row of itemsState) {
      if (!row.isCancelled && row.issuedQty > 0) {
        if (!row.barcodeValidated) {
          setErrorMsg(
            `Barang "${row.itemName}" (${row.sku}) belum divalidasi Scan Barcode! Silakan scan barcode barang tersebut atau centang "Tidak Jadi Dikeluarkan (Qty 0)".`
          );
          return;
        }

        const stock = stockItems.find((s) => s.id === row.itemId || s.sku === row.sku);
        const currentStock = stock ? stock.currentStock : 0;
        if (row.issuedQty > currentStock) {
          setErrorMsg(
            `Jumlah penyerahan "${row.itemName}" (${row.issuedQty} ${row.unit}) melebihi stok fisik di rak (${currentStock} ${row.unit}).`
          );
          return;
        }
      }
    }

    if (onCompleteHandover) {
      const res = onCompleteHandover({
        recipientName: recipientName.trim(),
        handoverOfficer: handoverOfficer.trim() || currentAdminName,
        warehouseHeadName:
          voucher.warehouseHeadName ||
          voucher.approvedByWarehouseHead ||
          warehouseHeadName.trim() ||
          warehouseHeadDefaultName,
        notes: handoverNotes.trim() || undefined,
        validatedItems: itemsState.map((i) => ({
          itemId: i.itemId,
          issuedQty: i.isCancelled ? 0 : i.issuedQty,
          isCancelled: i.isCancelled || i.issuedQty === 0,
          barcodeScanned: i.barcodeValidated,
          sourceLocation: i.sourceLocation,
        })),
      });

      if (!res.success && res.error) {
        setErrorMsg(res.error);
      } else if (res.success && res.voucher && onSuccessPrint) {
        onSuccessPrint(res.voucher);
      }
    }
  };

  const handleConfirmRejection = () => {
    if (!rejectionReason.trim()) {
      setErrorMsg('Alasan penolakan nota wajib diisi.');
      return;
    }
    onReject(rejectionReason);
  };

  const formatTimeShort = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '';
    }
  };

  const activeItemsToExport = itemsState.filter((i) => !i.isCancelled && i.issuedQty > 0);
  const cancelledItemsCount = itemsState.filter((i) => i.isCancelled || i.issuedQty === 0).length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            {isHeadApprovalStage ? (
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                <ScanBarcode className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold">
                  {isHeadApprovalStage
                    ? 'Tahap 2 (Kepala Store): ACC SIV (Persetujuan Nota Pengambilan)'
                    : 'Tahap 3 (Admin Store): Serahkan Barang ke Penerima & Scan Barcode (Otomatis Potong Stock)'}
                </h2>
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                    isHeadApprovalStage
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {isHeadApprovalStage
                    ? 'MENUNGGU ACC KEPALA STORE'
                    : 'DI-ACC KEPALA STORE · SIAP DISERAHKAN ADMIN'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-300 font-mono">
                Nota Pengambilan #{voucher.voucherNumber} &middot; Pemohon: {voucher.requestedBy} ({voucher.department})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Alur Tahapan SIV */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 sm:px-6 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>1. Pemohon Menerbitkan SIV ({voucher.requestedBy})</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <div
              className={`flex items-center gap-1.5 font-semibold ${
                isAdminHandoverStage
                  ? 'text-emerald-700'
                  : 'text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300'
              }`}
            >
              {isAdminHandoverStage ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-amber-600" />
              )}
              <span>2. Kepala Store ACC SIV (SIV Terkunci, Menunggu Penyerahan Admin)</span>
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            <div
              className={`flex items-center gap-1.5 font-semibold ${
                isAdminHandoverStage
                  ? 'text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300'
                  : 'text-slate-400'
              }`}
            >
              <PackageCheck className="w-4 h-4" />
              <span>3. Admin Store Menyerahkan Barang ke Penerima (Otomatis Stock Berkurang)</span>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Information summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Diterbitkan Oleh (Pemohon):</span>
              <span className="font-bold text-slate-900">{voucher.requestedBy}</span>
              <span className="text-slate-500 block text-[11px]">{voucher.department}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Tanggal Permintaan:</span>
              <span className="font-semibold text-slate-900">{voucher.requestDate}</span>
              {(voucher.warehouseHeadName || voucher.approvedByWarehouseHead) && (
                <span className="text-blue-700 block text-[11px] font-medium">
                  Di-ACC Kepala Store: {voucher.warehouseHeadName || voucher.approvedByWarehouseHead}
                </span>
              )}
            </div>
            <div>
              <span className="text-slate-500 block">Keperluan Pemakaian:</span>
              <span className="text-slate-800 font-semibold">{voucher.purpose}</span>
              {voucher.recipientName && (
                <span className="text-emerald-700 block text-[11px] font-medium">
                  Penerima Barang: {voucher.recipientName}
                </span>
              )}
            </div>
          </div>

          {/* =================================================================== */}
          {/* TAHAP 2 (STATUS PENDING): KEPALA STORE ACC SIV                      */}
          {/* -> SIV Terkunci, Pemohon tidak bisa edit/hapus, Stok belum berubah  */}
          {/* =================================================================== */}
          {isHeadApprovalStage && !isRejecting && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-700" />
                  Tahap 2 (Kepala Store): ACC SIV yang Diterbitkan oleh Pemohon
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Setelah Kepala Store meng-ACC SIV ini, <strong>Nota SIV akan langsung TERKUNCI</strong> (Pemohon tidak dapat lagi mengedit atau menghapus SIV) dan diteruskan ke <strong>Admin Store</strong> untuk penyerahan fisik barang kepada penerima. <strong>Stock fisik belum berkurang</strong> sampai Admin Store menyerahkan barang ke penerima.
                </p>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Daftar Permintaan Barang SIV ({voucher.items.length} Item)
                </h3>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">Barang &amp; Material Code</th>
                        <th className="px-3 py-2.5 text-center">Lokasi Rak</th>
                        <th className="px-3 py-2.5 text-center">Stok Fisik Saat Ini</th>
                        <th className="px-3 py-2.5 text-right">Qty Diminta Pemohon</th>
                        <th className="px-3 py-2.5 text-center">Cost Center / GL Acc</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {voucher.items.map((item, idx) => {
                        const currentItem = stockItems.find(
                          (s) => s.id === item.itemId || s.sku === item.sku
                        );
                        const currentStock = currentItem ? currentItem.currentStock : 0;

                        return (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2.5">
                              <div className="font-semibold text-slate-900">{item.itemName}</div>
                              <div className="text-[11px] font-mono text-slate-500">{item.sku}</div>
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono text-[10px]">
                                <MapPin className="w-2.5 h-2.5" />
                                <span>
                                  {item.sourceLocation || currentItem?.location || 'Store Utama'}
                                </span>
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-700">
                              {currentStock} {item.unit}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-blue-700">
                              {item.requestedQty} {item.unit}
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-600">
                              {item.costCenter || '-'} / {item.glAcc || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Nama Kepala Store (Pemberi ACC SIV) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={warehouseHeadName}
                    onChange={(e) => setWarehouseHeadName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                    placeholder="Contoh: Suryadi"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Tercetak di kolom <strong>Disetujui (Kepala Store)</strong> + TTD Digital Tanggal &amp; Waktu ACC
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Catatan ACC Kepala Store (Opsional)
                  </label>
                  <input
                    type="text"
                    value={headVerificationNotes}
                    onChange={(e) => setHeadVerificationNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                    placeholder="Contoh: SIV disetujui Kepala Store, silakan Admin serahkan barang"
                  />
                </div>
              </div>
            </>
          )}

          {/* =================================================================== */}
          {/* TAHAP 3 (STATUS APPROVED): ADMIN STORE SERAHKAN BARANG KE PENERIMA  */}
          {/* -> Validasi Scan Barcode, Input Penerima & OTOMATIS POTONG STOCK    */}
          {/* =================================================================== */}
          {isAdminHandoverStage && !isRejecting && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-950 flex items-start gap-2.5">
                <PackageCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">
                    Prosedur Tahap 3 (Admin Store): Menyerahkan Barang ke Penerima &amp; Scan Barcode (Otomatis Stock Berkurang)
                  </span>
                  <span className="text-[11px] text-emerald-900">
                    Nota SIV ini telah di-ACC oleh Kepala Store (<strong>{voucher.warehouseHeadName || voucher.approvedByWarehouseHead || 'Kepala Store'}</strong>). Silakan scan barcode fisik barang yang akan diserahkan dan input Nama Penerima. <strong>Begitu Admin Store menyerahkan barang, stock fisik di sistem OTOMATIS BERKURANG</strong> sesuai jumlah yang diserahkan!
                  </span>
                </div>
              </div>

              {/* Scanner Input & Live Mobile Camera Box */}
              <div
                className={`rounded-xl p-4 border-2 shadow-xs space-y-3 transition-all ${
                  justScannedFlash
                    ? 'bg-emerald-950 text-white border-emerald-400 ring-4 ring-emerald-400/30'
                    : 'bg-blue-950 text-white border-blue-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-blue-400 shrink-0" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xs sm:text-sm font-bold text-white">
                          Validasi Scan Barcode Barang &amp; Input Quantity yang Diserahkan ke Penerima
                        </h3>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-mono font-bold">
                          <Check className="w-3 h-3" />
                          <span>
                            {
                              itemsState.filter((i) => i.barcodeValidated || i.isCancelled).length
                            }{' '}
                            / {itemsState.length} Barang Berhasil Discan
                          </span>
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-200">
                        Gunakan Kamera HP untuk scan barcode fisik barang atau gunakan scanner laser / tombol scan pada tabel.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setIsCameraActive((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        isCameraActive
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      }`}
                    >
                      {isCameraActive ? (
                        <>
                          <CameraOff className="w-3.5 h-3.5" />
                          <span>Tutup Kamera HP</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5" />
                          <span>Buka Kamera Scan HP</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleScanAllBarcodes}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-blue-100 rounded-lg text-xs font-semibold border border-blue-600 transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Validasi Semua</span>
                    </button>
                  </div>
                </div>

                {/* Live Camera Viewfinder (Otomatis aktif saat buka di HP atau klik tombol Scan Barcode) */}
                {isCameraActive && (
                  <div className="p-3 bg-slate-900/90 border border-blue-700/80 rounded-xl space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                        <Camera className="w-4 h-4 animate-pulse text-emerald-400" />
                        <span>
                          {targetScanRowIdx !== null && itemsState[targetScanRowIdx]
                            ? `Kamera HP Aktif — Arahkan ke Barcode [${itemsState[targetScanRowIdx].sku}] ${itemsState[targetScanRowIdx].itemName}`
                            : 'Kamera Pemindai Barcode HP Aktif — Arahkan ke Stiker Barcode Barang'}
                        </span>
                      </span>
                      {targetScanRowIdx !== null && itemsState[targetScanRowIdx] && (
                        <button
                          type="button"
                          onClick={() => processBarcodeScan(itemsState[targetScanRowIdx].sku)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            ✓ Konfirmasi Scan [{itemsState[targetScanRowIdx].sku}] Sesuai
                          </span>
                        </button>
                      )}
                    </div>

                    <div className="relative w-full max-w-md mx-auto overflow-hidden rounded-xl bg-black border-2 border-slate-700 aspect-video flex items-center justify-center">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4">
                        <div
                          className={`w-4/5 h-24 border-2 rounded-xl flex items-center justify-center transition-all ${
                            justScannedFlash
                              ? 'border-emerald-400 bg-emerald-500/35 shadow-[0_0_25px_#10b981]'
                              : 'border-dashed border-amber-400/80'
                          }`}
                        >
                          {justScannedFlash ? (
                            <div className="text-center px-2">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-extrabold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" />✓ BARANG BERHASIL DISCAN!
                              </span>
                              <div className="font-mono font-bold text-white text-xs mt-1">
                                {justScannedFlash.sku} — {justScannedFlash.itemName}
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-0.5 bg-red-500/90 shadow-[0_0_10px_#ef4444] animate-pulse" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Tombol Cepat Konfirmasi Scan per Item di Bawah Kamera */}
                    <div className="pt-1">
                      <span className="block text-[10.5px] text-blue-200 mb-1.5 font-medium">
                        Klik barang di bawah apabila kamera sudah diarahkan ke barcode fisik untuk langsung memvalidasi:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {itemsState.map((it, idx) => (
                          <button
                            key={it.itemId + idx}
                            type="button"
                            onClick={() => processBarcodeScan(it.sku)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                              it.barcodeValidated
                                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-100'
                                : 'bg-slate-800 hover:bg-emerald-600 border-slate-600 text-white'
                            }`}
                          >
                            {it.barcodeValidated ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <ScanBarcode className="w-3.5 h-3.5 text-amber-400" />
                            )}
                            <span>{it.sku}</span>
                            <span className="font-sans font-normal truncate max-w-[120px]">
                              {it.itemName}
                            </span>
                            {it.barcodeValidated && (
                              <span className="px-1 rounded bg-emerald-400 text-slate-950 text-[9px] font-extrabold">
                                ✓ DISCAN
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {cameraError && (
                      <div className="p-2 rounded-lg bg-amber-500/20 border border-amber-400/40 text-[11px] text-amber-200">
                        {cameraError}
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handleBarcodeFormSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanBarcode className="w-4 h-4 text-blue-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      ref={barcodeInputRef}
                      type="text"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="Arahkan scanner barcode atau ketik Material Code lalu tekan Enter..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-blue-700 rounded-lg text-xs text-white placeholder-slate-400 font-mono focus:ring-2 focus:ring-blue-400 focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shrink-0 flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5 sm:hidden" />
                    <span>Validasi Barcode</span>
                  </button>
                </form>

                {scanFeedback && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2.5 font-semibold border-2 ${
                      scanFeedback.type === 'success'
                        ? 'bg-emerald-900/90 text-white border-emerald-400 shadow-md'
                        : 'bg-red-900/80 text-red-100 border-red-500'
                    }`}
                  >
                    {scanFeedback.type === 'success' ? (
                      <div className="w-7 h-7 rounded-lg bg-emerald-400 text-slate-950 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                      </div>
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                    <div>
                      {scanFeedback.type === 'success' && (
                        <span className="inline-block px-2 py-0.5 rounded bg-emerald-400 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider mr-2 mb-0.5">
                          ✓ BARANG BERHASIL DISCAN
                        </span>
                      )}
                      <span>{scanFeedback.text}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabel Validasi Penyerahan Barang & Pemotongan Stock */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Daftar Penyerahan Barang ke Penerima ({itemsState.length} Item)
                  </h3>
                  <span className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded font-semibold">
                    Otomatis Potong Stock: Stok langsung berkurang sesuai <strong>Qty Diserahkan</strong>
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">Material Code &amp; Nama Barang</th>
                        <th className="px-2.5 py-2.5 text-center">Stok Rak</th>
                        <th className="px-2.5 py-2.5 text-center">Diminta</th>
                        <th className="px-3 py-2.5 text-center">Validasi Barcode</th>
                        <th className="px-3 py-2.5 text-center">Lokasi Ambil Fisik</th>
                        <th className="px-3 py-2.5 text-center w-36">Qty Diserahkan</th>
                        <th className="px-2.5 py-2.5 text-center">Sisa Stok</th>
                        <th className="px-3 py-2.5 text-center">Tidak Jadi Dikeluarkan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itemsState.map((row, idx) => {
                        const stockObj = stockItems.find(
                          (s) => s.id === row.itemId || s.sku === row.sku
                        );
                        const currentStock = stockObj ? stockObj.currentStock : 0;
                        const isZeroOrCancelled = row.isCancelled || row.issuedQty === 0;
                        const isRecentlyScanned = lastScannedSku === row.sku;
                        const remainingStockAfterHandover = Math.max(
                          0,
                          currentStock - (isZeroOrCancelled ? 0 : row.issuedQty)
                        );

                        return (
                          <tr
                            key={row.itemId + idx}
                            className={`transition-colors ${
                              isZeroOrCancelled
                                ? 'bg-red-50/40 text-slate-400'
                                : row.barcodeValidated
                                ? isRecentlyScanned
                                  ? 'bg-emerald-100/70'
                                  : 'bg-emerald-50/40'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            {/* Material Code & Nama Barang */}
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`font-semibold ${
                                    isZeroOrCancelled ? 'line-through text-slate-400' : 'text-slate-900'
                                  }`}
                                >
                                  {row.itemName}
                                </span>
                                {!isZeroOrCancelled && row.barcodeValidated && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[9.5px] font-extrabold">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                                    <span>✓ BERHASIL DISCAN</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded">
                                  {row.sku}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  {stockObj?.location || '-'}
                                </span>
                              </div>
                            </td>

                            {/* Stok Rak */}
                            <td className="px-2.5 py-2.5 text-center font-mono tabular-nums text-slate-600">
                              {currentStock} {row.unit}
                            </td>

                            {/* Diminta */}
                            <td className="px-2.5 py-2.5 text-center font-mono font-bold tabular-nums text-slate-800">
                              {row.requestedQty} {row.unit}
                            </td>

                            {/* Tombol / Status Scan Barcode */}
                            <td className="px-3 py-2.5 text-center">
                              {isZeroOrCancelled ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                                  <Ban className="w-3.5 h-3.5" />
                                  Dibatalkan (0)
                                </span>
                              ) : row.barcodeValidated ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 text-white font-extrabold text-[11px] shadow-2xs">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                                    ✓ BARANG BERHASIL DISCAN
                                  </span>
                                  {row.barcodeScannedAt && (
                                    <span className="text-[9.5px] font-mono font-semibold text-emerald-700 mt-0.5">
                                      Jam {formatTimeShort(row.barcodeScannedAt)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="inline-flex flex-wrap items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isMobilePhoneDevice() && !isCameraActive) {
                                        setTargetScanRowIdx(idx);
                                        setIsCameraActive(true);
                                      } else {
                                        processBarcodeScan(row.sku);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-semibold shadow-2xs transition-colors"
                                    title={`Validasi scan barcode ${row.sku}`}
                                  >
                                    <Camera className="w-3.5 h-3.5 sm:hidden" />
                                    <ScanBarcode className="w-3.5 h-3.5 hidden sm:inline" />
                                    <span>Scan Barcode</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTargetScanRowIdx(idx);
                                      setIsCameraActive(true);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-lg text-[11px] font-semibold transition-colors"
                                    title="Buka Kamera HP untuk scan barcode barang ini"
                                  >
                                    <Camera className="w-3.5 h-3.5" />
                                    <span className="hidden md:inline">Kamera</span>
                                  </button>
                                </div>
                              )}
                            </td>

                            {/* Verifikasi Lokasi Pengambilan Fisik */}
                            <td className="px-2.5 py-2.5 text-center">
                              {isZeroOrCancelled ? (
                                <span className="text-[10px] text-slate-400 font-mono">-</span>
                              ) : (
                                <div className="inline-flex flex-col items-center gap-0.5">
                                  <select
                                    value={row.sourceLocation}
                                    onChange={(e) => handleSourceLocationChange(idx, e.target.value)}
                                    className="px-2 py-1 bg-white border border-slate-300 text-slate-900 rounded-lg text-[11px] font-semibold focus:ring-1 focus:ring-blue-600 focus:outline-hidden max-w-[130px]"
                                    title="Verifikasi lokasi rak fisik tempat barang diambil"
                                  >
                                    {stockObj?.location && (
                                      <option value={stockObj.location}>
                                        {stockObj.location} (Utama)
                                      </option>
                                    )}
                                    {stockObj?.locations
                                      ?.filter((loc) => loc !== stockObj.location)
                                      .map((loc) => (
                                        <option key={loc} value={loc}>
                                          {loc}
                                        </option>
                                      ))}
                                    {storageLocations
                                      .filter(
                                        (l) =>
                                          l.code !== stockObj?.location &&
                                          !(stockObj?.locations || []).includes(l.code)
                                      )
                                      .map((l) => (
                                        <option key={l.code} value={l.code}>
                                          {l.code}
                                        </option>
                                      ))}
                                  </select>
                                  {stockObj?.locations && stockObj.locations.length > 1 && (
                                    <span className="text-[9px] font-mono text-indigo-600 font-bold">
                                      Multi-Lokasi ({stockObj.locations.length})
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Input Quantity Barang yang Diserahkan */}
                            <td className="px-3 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min={0}
                                  max={currentStock}
                                  value={row.isCancelled ? 0 : row.issuedQty}
                                  onChange={(e) => handleIssuedQtyChange(idx, e.target.value)}
                                  className={`w-16 px-2 py-1 text-center font-mono font-bold text-xs rounded-lg border focus:outline-hidden ${
                                    isZeroOrCancelled
                                      ? 'bg-red-50 border-red-300 text-red-700'
                                      : 'bg-white border-slate-300 text-slate-900 focus:ring-1 focus:ring-blue-600'
                                  }`}
                                />
                                <span className="text-[11px] text-slate-500">{row.unit}</span>
                              </div>
                            </td>

                            {/* Sisa Stok Otomatis Setelah Diserahkan */}
                            <td className="px-2.5 py-2.5 text-center font-mono font-bold tabular-nums text-emerald-700">
                              {remainingStockAfterHandover} {row.unit}
                            </td>

                            {/* Centang Barang Tidak Jadi Dikeluarkan */}
                            <td className="px-3 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleCancelItem(idx)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                  isZeroOrCancelled
                                    ? 'bg-red-100 border-red-300 text-red-800'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                                title="Centang apabila barang tidak jadi dikeluarkan (otomatis mengisi Qty = 0)"
                              >
                                {isZeroOrCancelled ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-red-600" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-400" />
                                )}
                                <span>{isZeroOrCancelled ? 'Batal Keluar (0)' : 'Tidak Jadi'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Ringkasan Filter Bukti PDF SIV */}
                <div className="mt-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-4">
                    <span className="text-slate-700">
                      Diserahkan &amp; Potong Stock (Qty &gt; 0):{' '}
                      <strong className="text-emerald-700">{activeItemsToExport.length} barang</strong>
                    </span>
                    {cancelledItemsCount > 0 && (
                      <span className="text-red-700 font-medium">
                        Tidak Jadi Dikeluarkan (Qty = 0):{' '}
                        <strong>{cancelledItemsCount} barang (Tidak dipotong stock)</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Nama Penerima & Petugas Admin Store */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nama Penerima Barang (Diinput Admin) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      placeholder="Masukkan nama penerima fisik barang..."
                    />
                    <span className="text-[10.5px] text-slate-500 mt-0.5 block">
                      Tercetak pada kolom <strong>Diterima</strong> (Penerima Barang)
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Nama Admin Store (Yang Menyerahkan) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={handoverOfficer}
                      onChange={(e) => setHandoverOfficer(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                      placeholder="Contoh: Hendra Gunawan"
                    />
                    <span className="text-[10.5px] text-slate-500 mt-0.5 block">
                      Tercetak pada kolom <strong>Diserahkan</strong> + TTD Digital Penyerahan
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Catatan Penyerahan Barang (Opsional)
                    </label>
                    <input
                      type="text"
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                      placeholder="Contoh: Barang telah di-scan barcode & diserahkan ke penerima"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Rejection Form */}
          {isRejecting && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900">
                <div className="font-semibold flex items-center gap-1.5 text-red-800 mb-1">
                  <XCircle className="w-4 h-4 text-red-600" />
                  Form Penolakan Nota Pengambilan
                </div>
                <p className="text-[11px] text-red-700">
                  Stok yang sebelumnya dialokasikan akan dikembalikan menjadi tersedia kembali untuk pemohon lain.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Alasan Penolakan <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-red-600 focus:outline-hidden"
                  placeholder="Contoh: Spesifikasi tidak sesuai / belum ada otorisasi departemen."
                />
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          {!isRejecting ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsRejecting(true);
                  setErrorMsg('');
                }}
                className="px-3.5 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                Tolak Nota SIV
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>

                {isHeadApprovalStage ? (
                  canPerformHeadApproval ? (
                    <button
                      type="button"
                      onClick={handleConfirmHeadApproval}
                      className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-xs transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>ACC SIV (Kepala Store)</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                      <Lock className="w-4 h-4 text-amber-600" />
                      <span>Menunggu ACC Kepala Store</span>
                    </span>
                  )
                ) : canPerformAdminHandover ? (
                  <button
                    type="button"
                    onClick={handleConfirmAdminHandover}
                    className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs transition-colors"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>Serahkan Barang ke Penerima &amp; Potong Stock (Admin Store)</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg">
                    <Lock className="w-4 h-4 text-blue-600" />
                    <span>Menunggu Admin Store Menyerahkan Barang ke Penerima</span>
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setIsRejecting(false);
                  setErrorMsg('');
                }}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                &larr; Kembali ke Verifikasi
              </button>

              <button
                type="button"
                onClick={handleConfirmRejection}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-xs transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Konfirmasi Tolak Nota
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
