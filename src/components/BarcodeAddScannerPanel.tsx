import React, { useState, useEffect, useRef } from 'react';
import { StockItem } from '../types/inventory';
import { soundService } from '../services/soundService';
import {
  Camera,
  CameraOff,
  ScanBarcode,
  CheckCircle2,
  AlertCircle,
  Volume2,
  Plus,
  Minus,
  Sparkles,
  PackagePlus,
  Check,
  Clock,
} from 'lucide-react';

interface BarcodeAddScannerPanelProps {
  mode: 'SIV' | 'LPB';
  stockItems: StockItem[];
  initialAllocationsMap?: Record<string, number>;
  selectedQuantitiesMap?: Record<string, number>;
  onBarcodeAddItem: (item: StockItem, quantity: number, scannedCode: string) => void;
  onUnrecognizedBarcodeInLPB?: (scannedCode: string, quantity: number) => void;
  onClose?: () => void;
}

interface ScannedSessionLog {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  lastQtyAdded: number;
  totalScannedQty: number;
  scanCount: number;
  lastScannedAt: string;
}

export const BarcodeAddScannerPanel: React.FC<BarcodeAddScannerPanelProps> = ({
  mode,
  stockItems,
  initialAllocationsMap = {},
  selectedQuantitiesMap = {},
  onBarcodeAddItem,
  onUnrecognizedBarcodeInLPB,
  onClose,
}) => {
  const isLPB = mode === 'LPB';
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [scanQty, setScanQty] = useState<number>(isLPB ? 10 : 1);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'error' | 'unrecognized';
    message: string;
    code?: string;
    item?: StockItem;
    scannedAt?: string;
    qtyAdded?: number;
  } | null>(null);
  const [justScannedFlash, setJustScannedFlash] = useState<{
    sku: string;
    name: string;
    qty: number;
    unit: string;
  } | null>(null);
  const [scannedHistory, setScannedHistory] = useState<ScannedSessionLog[]>([]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; timestamp: number }>({ code: '', timestamp: 0 });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const flashTimerRef = useRef<number | null>(null);

  const getAvailableForSIV = (item: StockItem) => {
    const extraReserved = initialAllocationsMap[item.id] || 0;
    return Math.max(0, item.currentStock - item.allocatedStock + extraReserved);
  };

  const triggerVisualFlash = (item: StockItem, qty: number) => {
    if (flashTimerRef.current) {
      window.clearTimeout(flashTimerRef.current);
    }
    setJustScannedFlash({
      sku: item.sku,
      name: item.name,
      qty,
      unit: item.unit,
    });
    flashTimerRef.current = window.setTimeout(() => {
      setJustScannedFlash(null);
    }, 1800);
  };

  const processScannedCode = (rawCode: string) => {
    const cleaned = rawCode.trim().toUpperCase();
    if (!cleaned) return;

    // Find matching item by exact SKU first, then partial SKU or exact name
    const exactMatch =
      stockItems.find((s) => s.sku.toUpperCase() === cleaned) ||
      stockItems.find(
        (s) =>
          cleaned.includes(s.sku.toUpperCase()) ||
          s.sku.toUpperCase().includes(cleaned) ||
          s.name.toUpperCase() === cleaned
      );

    if (!exactMatch) {
      soundService.playScanError();
      if (isLPB && onUnrecognizedBarcodeInLPB) {
        setScanFeedback({
          type: 'unrecognized',
          code: cleaned,
          message: `Barcode "${cleaned}" belum terdaftar di Master Stok. Anda dapat langsung mendaftarkannya sebagai Barang Baru.`,
        });
      } else {
        setScanFeedback({
          type: 'error',
          code: cleaned,
          message: `Barcode "${cleaned}" tidak ditemukan dalam katalog Master Gudang.`,
        });
      }
      return;
    }

    if (!isLPB) {
      const avail = getAvailableForSIV(exactMatch);
      const alreadyInDoc = selectedQuantitiesMap[exactMatch.id] || 0;
      if (avail <= 0) {
        soundService.playScanError();
        setScanFeedback({
          type: 'error',
          code: exactMatch.sku,
          item: exactMatch,
          message: `Stok "${exactMatch.name}" (${exactMatch.sku}) sedang habis (Tersedia: 0 ${exactMatch.unit}).`,
        });
        return;
      }
      if (alreadyInDoc >= avail) {
        soundService.playScanError();
        setScanFeedback({
          type: 'error',
          code: exactMatch.sku,
          item: exactMatch,
          message: `Item "${exactMatch.name}" (${exactMatch.sku}) di daftar sudah mencapai batas maksimal stok tersedia (${avail} ${exactMatch.unit}).`,
        });
        return;
      }
    }

    const effectiveQty = Math.max(1, Number(scanQty) || 1);
    const timeStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    soundService.playScanSuccess();
    triggerVisualFlash(exactMatch, effectiveQty);
    onBarcodeAddItem(exactMatch, effectiveQty, exactMatch.sku);
    setBarcodeInput('');

    setScannedHistory((prev) => {
      const existing = prev.find((p) => p.itemId === exactMatch.id);
      if (existing) {
        return [
          {
            ...existing,
            lastQtyAdded: effectiveQty,
            totalScannedQty: existing.totalScannedQty + effectiveQty,
            scanCount: existing.scanCount + 1,
            lastScannedAt: timeStr,
          },
          ...prev.filter((p) => p.itemId !== exactMatch.id),
        ];
      }
      return [
        {
          itemId: exactMatch.id,
          sku: exactMatch.sku,
          name: exactMatch.name,
          unit: exactMatch.unit,
          lastQtyAdded: effectiveQty,
          totalScannedQty: effectiveQty,
          scanCount: 1,
          lastScannedAt: timeStr,
        },
        ...prev,
      ];
    });

    setScanFeedback({
      type: 'success',
      code: exactMatch.sku,
      item: exactMatch,
      scannedAt: timeStr,
      qtyAdded: effectiveQty,
      message: isLPB
        ? `BARANG BERHASIL DISCAN! [${exactMatch.sku}] "${exactMatch.name}" (+${effectiveQty} ${exactMatch.unit}) otomatis masuk daftar & tervalidasi scan.`
        : `BARANG BERHASIL DISCAN! [${exactMatch.sku}] "${exactMatch.name}" (+${effectiveQty} ${exactMatch.unit}) berhasil masuk ke daftar SIV.`,
    });
  };

  const stopCamera = () => {
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
    return () => {
      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isCameraActive) {
      stopCamera();
      return;
    }

    let isMounted = true;
    setCameraError(null);

    const startCamera = async () => {
      stopCamera();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Perangkat ini tidak menyediakan akses kamera langsung. Gunakan kolom input Scanner Laser atau klik tombol Simulasi Scan Barcode di bawah.'
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
                  raw === lastScanRef.current.code &&
                  now - lastScanRef.current.timestamp < 1600
                ) {
                  return;
                }
                lastScanRef.current = { code: raw, timestamp: now };
                processScannedCode(raw);
              }
            } catch {
              // ignore frame error
            }
          }, 300);
        }
      } catch {
        if (isMounted) {
          setCameraError(
            'Izin kamera tidak aktif atau perangkat tanpa kamera. Anda tetap dapat menggunakan Laser Barcode Scanner (USB/Bluetooth) pada kolom di bawah atau klik Simulasi Barcode.'
          );
        }
      }
    };

    startCamera();
    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [isCameraActive, scanQty, stockItems]);

  const handleManualScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    processScannedCode(barcodeInput);
  };

  const quickSimulationItems = stockItems.slice(0, 24);

  return (
    <div
      className={`mb-3.5 rounded-xl border-2 p-3.5 space-y-3 text-xs shadow-sm transition-all ${
        justScannedFlash
          ? 'bg-emerald-950 text-white border-emerald-400 ring-4 ring-emerald-400/30'
          : isLPB
          ? 'bg-emerald-950 text-white border-emerald-500/40'
          : 'bg-slate-900 text-white border-amber-500/40'
      }`}
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              justScannedFlash
                ? 'bg-emerald-400 text-slate-950'
                : isLPB
                ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-300'
                : 'bg-amber-500/20 border border-amber-400/30 text-amber-300'
            }`}
          >
            {justScannedFlash ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <ScanBarcode className="w-4 h-4" />
            )}
          </div>
          <div>
            <h4 className="font-bold text-xs sm:text-sm text-white flex flex-wrap items-center gap-2">
              <span>
                Scan Barcode untuk Tambah Item {isLPB ? 'LPB (Barang Masuk)' : 'SIV (Barang Keluar)'}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                  isCameraActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isCameraActive ? '● KAMERA & LASER AKTIF' : 'MODE LASER / INPUT'}
              </span>
              {scannedHistory.length > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-extrabold">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>{scannedHistory.length} Barang Berhasil Discan</span>
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-300">
              {isLPB
                ? 'Arahkan kamera ke barcode barang atau gunakan scanner laser. Barang otomatis masuk daftar & diberi tanda Berhasil Discan.'
                : 'Arahkan kamera ke barcode barang atau gunakan scanner laser untuk langsung menambahkan ke Nota SIV.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsCameraActive((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              isCameraActive
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isCameraActive ? (
              <>
                <CameraOff className="w-3.5 h-3.5" />
                <span>Matikan Kamera</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                <span>Nyalakan Kamera</span>
              </>
            )}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-colors"
            >
              Selesai Scan
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Camera Viewfinder + Laser Input & Quantity Control */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
        {/* Camera Preview Box */}
        {isCameraActive && (
          <div className="sm:col-span-5 flex flex-col justify-between bg-black/80 rounded-xl border border-slate-700 overflow-hidden relative min-h-[150px]">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-40 object-cover"
            />
            {/* Laser Target Overlay */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-4">
              <div
                className={`w-4/5 h-20 border-2 rounded-lg relative flex items-center justify-center transition-all ${
                  justScannedFlash
                    ? 'border-emerald-400 bg-emerald-500/30 shadow-[0_0_25px_#10b981]'
                    : 'border-dashed border-amber-400/70'
                }`}
              >
                {justScannedFlash ? (
                  <div className="flex flex-col items-center justify-center text-center px-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      BERHASIL DISCAN!
                    </span>
                    <span className="font-mono font-bold text-white text-xs mt-1 truncate max-w-full">
                      {justScannedFlash.sku} (+{justScannedFlash.qty} {justScannedFlash.unit})
                    </span>
                  </div>
                ) : (
                  <div className="w-full h-0.5 bg-red-500/90 shadow-[0_0_10px_#ef4444] animate-pulse" />
                )}
              </div>
              <span className="mt-1.5 text-[10px] font-mono text-white/90 bg-slate-950/80 px-2 py-0.5 rounded">
                {justScannedFlash
                  ? `✓ ${justScannedFlash.name}`
                  : 'Arahkan Barcode / QR ke Area Kotak'}
              </span>
            </div>
          </div>
        )}

        {/* Controls: Quantity per Scan + Laser Gun Input + Quick Barcode Tap */}
        <div
          className={`${
            isCameraActive ? 'sm:col-span-7' : 'sm:col-span-12'
          } flex flex-col justify-between gap-2.5 bg-white/5 rounded-xl p-3 border border-white/10`}
        >
          {/* Row 1: Quantity to add per barcode scan + Manual/Laser Barcode Input */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                Qty Otomatis per Scan:
              </label>
              <div className="flex items-center bg-slate-800 border border-slate-600 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setScanQty((q) => Math.max(1, q - 1))}
                  className="px-2.5 py-1.5 text-slate-200 hover:bg-slate-700"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={scanQty}
                  onChange={(e) => setScanQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full py-1.5 bg-transparent text-center font-mono font-bold text-white text-xs focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setScanQty((q) => q + 1)}
                  className="px-2.5 py-1.5 text-slate-200 hover:bg-slate-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="sm:col-span-8">
              <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                Input Scanner Laser (USB/Bluetooth) / Ketik Kode Barcode:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleManualScanSubmit(e);
                    }
                  }}
                  placeholder="Scan atau ketik Material Code (Cth: 1000283) lalu Enter..."
                  className="flex-1 px-3 py-1.5 bg-white text-slate-900 rounded-lg font-mono text-xs placeholder:text-slate-400 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleManualScanSubmit}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs shrink-0 transition-colors ${
                    isLPB
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  }`}
                >
                  + Scan Masuk
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Simulasi Scan Barcode Cepat (1-Click Tap Barcode Chips) */}
          <div className="pt-1 border-t border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>
                  Simulasi Scan Cepat (Klik label barcode di bawah untuk langsung scan &amp; tambah):
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {quickSimulationItems.map((item) => {
                const avail = getAvailableForSIV(item);
                const isDisabledSIV = !isLPB && avail <= 0;
                const inDocQty = selectedQuantitiesMap[item.id] || 0;
                const wasScanned = scannedHistory.some((h) => h.itemId === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={isDisabledSIV}
                    onClick={() => processScannedCode(item.sku)}
                    className={`group px-2.5 py-1 rounded-lg border text-left shrink-0 transition-all flex items-center gap-2 ${
                      isDisabledSIV
                        ? 'bg-slate-800/40 border-slate-700 opacity-40 cursor-not-allowed'
                        : wasScanned
                        ? 'bg-emerald-500/25 border-emerald-400 hover:bg-emerald-500/35 text-white'
                        : inDocQty > 0
                        ? 'bg-amber-500/20 border-amber-400/60 hover:bg-amber-500/30 text-white'
                        : 'bg-slate-800/90 border-slate-600 hover:border-emerald-400 hover:bg-slate-800 text-white'
                    }`}
                    title={`${item.sku} - ${item.name} (${
                      isLPB ? `Stok: ${item.currentStock}` : `Siap Diambil: ${avail}`
                    } ${item.unit})`}
                  >
                    {wasScanned ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <ScanBarcode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-mono font-bold text-[10px] leading-tight flex items-center gap-1">
                        <span>{item.sku}</span>
                        {wasScanned && (
                          <span className="px-1 rounded bg-emerald-400 text-slate-950 text-[8.5px] font-extrabold">
                            ✓ DISCAN
                          </span>
                        )}
                        {inDocQty > 0 && (
                          <span className="px-1 rounded bg-amber-400 text-slate-950 text-[9px] font-extrabold">
                            {inDocQty}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-300 truncate max-w-[110px]">
                        {item.name}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Camera Warning if any */}
      {cameraError && isCameraActive && (
        <div className="p-2 bg-amber-500/15 border border-amber-400/30 rounded-lg text-[11px] text-amber-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{cameraError}</span>
        </div>
      )}

      {/* TANDA BARANG BERHASIL DISCAN (Prominent Live Scan Result Banner) */}
      {scanFeedback && (
        <div
          className={`p-3 rounded-xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-all ${
            scanFeedback.type === 'success'
              ? 'bg-emerald-500/25 border-emerald-400 text-white shadow-md'
              : scanFeedback.type === 'unrecognized'
              ? 'bg-amber-500/20 border-amber-400/50 text-amber-100'
              : 'bg-red-500/20 border-red-400/50 text-red-200'
          }`}
        >
          <div className="flex items-start sm:items-center gap-2.5">
            {scanFeedback.type === 'success' ? (
              <div className="w-8 h-8 rounded-lg bg-emerald-400 text-slate-950 flex items-center justify-center shrink-0 font-extrabold shadow-xs">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
              </div>
            ) : (
              <Volume2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            )}
            <div>
              {scanFeedback.type === 'success' && scanFeedback.item && (
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-400 text-slate-950 font-extrabold text-[10px] uppercase tracking-wider">
                    <Check className="w-3 h-3 stroke-[3]" />
                    BARANG BERHASIL DISCAN
                  </span>
                  <span className="font-mono font-bold text-amber-300 text-xs">
                    [{scanFeedback.item.sku}]
                  </span>
                  {scanFeedback.scannedAt && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-200">
                      <Clock className="w-3 h-3" />
                      {scanFeedback.scannedAt}
                    </span>
                  )}
                </div>
              )}
              <span className="font-semibold block">{scanFeedback.message}</span>
            </div>
          </div>

          {scanFeedback.type === 'unrecognized' &&
            isLPB &&
            onUnrecognizedBarcodeInLPB &&
            scanFeedback.code && (
              <button
                type="button"
                onClick={() => {
                  onUnrecognizedBarcodeInLPB(scanFeedback.code!, Math.max(1, scanQty));
                  setScanFeedback(null);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs shrink-0"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>+ Daftarkan &quot;{scanFeedback.code}&quot; ke Master &amp; LPB</span>
              </button>
            )}
        </div>
      )}

      {/* Daftar Riwayat Barang yang Sudah Berhasil Discan pada Sesi Ini */}
      {scannedHistory.length > 0 && (
        <div className="pt-2 border-t border-white/15">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10.5px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Daftar Barang Berhasil Discan ({scannedHistory.length} Jenis Barang):</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {scannedHistory.map((log) => (
              <div
                key={log.itemId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/50 text-white text-[11px]"
              >
                <span className="w-4 h-4 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center font-extrabold text-[10px]">
                  ✓
                </span>
                <span className="font-mono font-bold text-amber-300">{log.sku}</span>
                <span className="truncate max-w-[140px] text-slate-100">{log.name}</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-400/30 text-emerald-200 font-mono font-bold text-[10px]">
                  +{log.totalScannedQty} {log.unit} ({log.scanCount}x scan)
                </span>
                <span className="text-[9.5px] font-mono text-emerald-300/80">
                  {log.lastScannedAt}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

