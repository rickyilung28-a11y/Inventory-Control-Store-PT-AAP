import React, { useState, useRef, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import { StockItem, StorageLocation, getRoleLevel } from '../types/inventory';
import {
  Barcode,
  Camera,
  CameraOff,
  Search,
  MapPin,
  Boxes,
  ArrowRightLeft,
  X,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  History,
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

interface BarcodeScannerLookupModalProps {
  isOpen?: boolean;
  onClose: () => void;
  initialMode?: 'all' | 'item' | 'rack';
  onSelectScannedItem?: (item: StockItem) => void;
  onSelectScannedRack?: (location: StorageLocation) => void;
  onViewLedgerItem?: (sku: string) => void;
}

export const BarcodeScannerLookupModal: React.FC<BarcodeScannerLookupModalProps> = ({
  isOpen = true,
  onClose,
  initialMode = 'all',
  onSelectScannedItem,
  onSelectScannedRack,
  onViewLedgerItem,
}) => {
  if (isOpen === false) return null;
  const {
    currentUser,
    stockItems,
    storageLocations,
    locationTransferRequests,
    createLocationTransferRequest,
    approveLocationTransferRequest,
  } = useInventory();

  const [scanInput, setScanInput] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'item' | 'rack'>(initialMode);
  const [matchedItem, setMatchedItem] = useState<StockItem | null>(null);
  const [matchedRack, setMatchedRack] = useState<StorageLocation | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Quick Location Transfer state inside scanner result
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferTargetRack, setTransferTargetRack] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferNotice, setTransferNotice] = useState('');

  // Live Camera state (Otomatis aktif apabila dibuka menggunakan HP)
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scannedTimeStr, setScannedTimeStr] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const lastScanRef = useRef<{ code: string; ts: number }>({ code: '', ts: 0 });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const userLevel = currentUser ? getRoleLevel(currentUser.role) : 4;
  const canRequestLocationTransfer = userLevel <= 2; // Admin Store, Kepala Store, Superuser
  const canApproveLocationTransfer = userLevel <= 1; // Kepala Store, Superuser

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraOpen(false);
  };

  const handleExecuteScan = (rawCode: string) => {
    const clean = rawCode.trim().replace(/^\*|\*$/g, '');
    if (!clean) return;
    setErrorMessage('');
    setTransferNotice('');
    setShowTransferForm(false);

    const upper = clean.toUpperCase();
    const nowTime = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // 1. Check Stock Items by SKU or ID
    if (activeTab !== 'rack') {
      const foundItem = stockItems.find(
        (i) => i.sku.toUpperCase() === upper || i.id.toUpperCase() === upper
      );
      if (foundItem) {
        soundService.playScanSuccess();
        setScannedTimeStr(nowTime);
        setMatchedItem(foundItem);
        const itemRack = storageLocations.find(
          (l) =>
            l.code.toLowerCase() === foundItem.location.toLowerCase() ||
            l.name.toLowerCase() === foundItem.location.toLowerCase()
        );
        setMatchedRack(itemRack || null);
        setScanInput('');
        if (onSelectScannedItem) {
          onSelectScannedItem(foundItem);
        }
        return;
      }
    }

    // 2. Check Storage Locations (Rak) by Code or Name
    if (activeTab !== 'item') {
      const foundRack = storageLocations.find(
        (l) =>
          l.code.toUpperCase() === upper ||
          l.name.toUpperCase() === upper ||
          l.id.toUpperCase() === upper
      );
      if (foundRack) {
        soundService.playScanSuccess();
        setScannedTimeStr(nowTime);
        setMatchedRack(foundRack);
        setMatchedItem(null);
        setScanInput('');
        if (onSelectScannedRack) {
          onSelectScannedRack(foundRack);
        }
        return;
      }
    }

    soundService.playScanError();
    setMatchedItem(null);
    setMatchedRack(null);
    setErrorMessage(
      `Kode Barcode "${clean}" tidak ditemukan pada database Barang (Material Code) maupun Lokasi Rak Store.`
    );
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      setIsCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      }, 100);

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
              if (raw === lastScanRef.current.code && now - lastScanRef.current.ts < 1500) {
                return;
              }
              lastScanRef.current = { code: raw, ts: now };
              handleExecuteScan(raw);
            }
          } catch {
            // ignore detection error
          }
        }, 300);
      }
    } catch {
      setCameraError(
        'Kamera tidak dapat diakses. Gunakan pemindai USB/Bluetooth atau klik tombol simulasi barcode di bawah.'
      );
      setIsCameraOpen(false);
    }
  };

  useEffect(() => {
    if (isMobilePhoneDevice()) {
      void startCamera();
    } else {
      inputRef.current?.focus();
    }
    return () => {
      stopCamera();
    };
  }, []);

  const handleSubmitQuickTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedItem || !transferTargetRack) return;
    const res = createLocationTransferRequest({
      itemId: matchedItem.id,
      toLocation: transferTargetRack,
      reason: transferReason || 'Pemindahan lokasi via Scan Barcode',
    });
    if (res.success && res.request) {
      setTransferNotice(
        `Pengajuan pindah lokasi #${res.request.transferNumber} (${matchedItem.location} → ${transferTargetRack}) berhasil dibuat! Menunggu ACC Kepala Store agar perpindahan lokasi terealisasi.`
      );
      setShowTransferForm(false);
      setTransferReason('');
    } else {
      setErrorMessage(res.error || 'Gagal mengajukan pindah lokasi.');
    }
  };

  const rackItems = matchedRack
    ? stockItems.filter(
        (i) =>
          i.location.trim().toLowerCase() === matchedRack.code.trim().toLowerCase() ||
          i.location.trim().toLowerCase() === matchedRack.name.trim().toLowerCase()
      )
    : [];

  const pendingTransfersForMatchedItem = matchedItem
    ? locationTransferRequests.filter(
        (r) => r.itemId === matchedItem.id && r.status === 'PENDING_APPROVAL'
      )
    : [];

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold">
                Pemindai Scan Barcode Barang &amp; Lokasi Rak Store
              </h2>
              <p className="text-xs text-slate-300">
                Scan barcode Material Code barang atau barcode lokasi rak untuk cek posisi stok, isi rak,
                dan mutasi lokasi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector & Camera Toggle */}
        <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="inline-flex p-0.5 bg-white rounded-lg border border-slate-200">
            {[
              { id: 'all', label: 'Scan Barang & Lokasi Rak' },
              { id: 'item', label: 'Khusus Barcode Barang (Material Code)' },
              { id: 'rack', label: 'Khusus Barcode Lokasi Rak' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  activeTab === t.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => (isCameraOpen ? stopCamera() : void startCamera())}
            className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors ${
              isCameraOpen
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isCameraOpen ? (
              <>
                <CameraOff className="w-3.5 h-3.5" />
                <span>Matikan Kamera</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5" />
                <span>Scan via Kamera HP / Webcam</span>
              </>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {isCameraOpen && (
            <div className="bg-slate-950 rounded-xl p-4 text-center text-white">
              <video
                ref={videoRef}
                className="w-full max-w-md h-48 object-cover rounded-lg border-2 border-amber-400 mx-auto"
                playsInline
                muted
              />
              <p className="text-xs text-amber-300 mt-2">
                Arahkan kamera ke stiker Barcode Barang (Material Code) atau Barcode Rak Penyimpanan
              </p>
            </div>
          )}

          {cameraError && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              {cameraError}
            </div>
          )}

          {/* Barcode Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleExecuteScan(scanInput);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Barcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Scan atau ketik Barcode Barang (misal: BRG-ELK-001) atau Kode Rak (misal: Rak A-01)..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-amber-500 focus:outline-hidden"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0"
            >
              <Search className="w-4 h-4 text-amber-400" />
              <span>Cek Barcode</span>
            </button>
          </form>

          {/* Quick Simulation Chips for Both Barang & Lokasi Rak */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
            {activeTab !== 'rack' && (
              <div>
                <p className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                  <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Simulasi Scan Barcode Barang (Material Code):</span>
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {stockItems.slice(0, 24).map((it) => (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => handleExecuteScan(it.sku)}
                      className="px-2 py-1 rounded bg-white hover:bg-amber-100 border border-slate-200 font-mono text-[11px] font-bold text-slate-800"
                    >
                      {it.sku}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeTab !== 'item' && (
              <div>
                <p className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  <span>Simulasi Scan Barcode Lokasi Rak:</span>
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {storageLocations.map((loc) => (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => handleExecuteScan(loc.code)}
                      className="px-2 py-1 rounded bg-white hover:bg-emerald-100 border border-slate-200 font-mono text-[11px] font-bold text-slate-800"
                    >
                      {loc.code}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-semibold">
              {errorMessage}
            </div>
          )}

          {transferNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold">
              {transferNotice}
            </div>
          )}

          {/* RESULT CARD: SCANNED STOCK ITEM */}
          {matchedItem && (
            <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 p-4 space-y-4 shadow-md">
              <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-emerald-200">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-extrabold shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                  <span>✓ BARANG BERHASIL DISCAN</span>
                </span>
                {scannedTimeStr && (
                  <span className="text-xs font-mono font-bold text-emerald-800">
                    Waktu Scan: {scannedTimeStr}
                  </span>
                )}
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-xs font-extrabold">
                      BARANG: {matchedItem.sku}
                    </span>
                    <span className="px-2.5 py-0.5 rounded bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Lokasi Rak: {matchedItem.location}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[11px] font-semibold">
                      {matchedItem.category}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1.5">
                    {matchedItem.name}
                  </h3>
                  {matchedItem.description && (
                    <p className="text-xs text-slate-600 mt-0.5">{matchedItem.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-emerald-200 shrink-0">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Stok Fisik Store
                    </span>
                    <span className="text-lg font-extrabold font-mono text-slate-900">
                      {matchedItem.currentStock} {matchedItem.unit}
                    </span>
                  </div>
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">
                      Stok Minimal
                    </span>
                    <span className="text-sm font-bold font-mono text-amber-700">
                      {matchedItem.minStock} {matchedItem.unit}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pending Location Transfer Alert on this item */}
              {pendingTransfersForMatchedItem.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div>
                    <span className="font-bold text-amber-950 block">
                      Menunggu ACC Kepala Store — Pengajuan Pindah Lokasi Rak:
                    </span>
                    <span className="text-amber-800">
                      Dari <strong>{pendingTransfersForMatchedItem[0].fromLocation}</strong> ke{' '}
                      <strong>{pendingTransfersForMatchedItem[0].toLocation}</strong> (Diajukan oleh{' '}
                      {pendingTransfersForMatchedItem[0].requestedBy})
                    </span>
                  </div>
                  {canApproveLocationTransfer && (
                    <button
                      type="button"
                      onClick={() =>
                        approveLocationTransferRequest(pendingTransfersForMatchedItem[0].id)
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shrink-0"
                    >
                      ACC &amp; Realisasikan Sekarang
                    </button>
                  )}
                </div>
              )}

              {/* Actions on Scanned Item */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-200/80">
                {canRequestLocationTransfer && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransferForm(!showTransferForm);
                      setTransferTargetRack(
                        storageLocations.find((l) => l.code !== matchedItem.location)?.code || ''
                      );
                    }}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ajukan Pindah Lokasi Rak</span>
                  </button>
                )}

                {onViewLedgerItem && (
                  <button
                    type="button"
                    onClick={() => {
                      onViewLedgerItem(matchedItem.sku);
                      onClose();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold flex items-center gap-1.5"
                  >
                    <History className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Buka Kartu Stok (Mutasi)</span>
                  </button>
                )}
              </div>

              {/* Inline Pindah Lokasi Form */}
              {showTransferForm && (
                <form
                  onSubmit={handleSubmitQuickTransfer}
                  className="p-3.5 rounded-xl bg-white border border-slate-300 space-y-3 text-xs"
                >
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>
                      Form Pengajuan Pindah Lokasi Rak (Menunggu ACC Kepala Store)
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      Rak Saat Ini: {matchedItem.location}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Pilih / Scan Lokasi Rak Tujuan Baru:
                      </label>
                      <select
                        required
                        value={transferTargetRack}
                        onChange={(e) => setTransferTargetRack(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-slate-900"
                      >
                        <option value="">-- Pilih Rak Tujuan --</option>
                        {storageLocations
                          .filter(
                            (l) =>
                              l.code.toLowerCase() !== matchedItem.location.toLowerCase()
                          )
                          .map((l) => (
                            <option key={l.id} value={l.code}>
                              {l.code} — {l.name} ({l.zone})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Alasan Pemindahan Lokasi:
                      </label>
                      <input
                        type="text"
                        required
                        value={transferReason}
                        onChange={(e) => setTransferReason(e.target.value)}
                        placeholder="Misal: Relokasi ke rak fast moving..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTransferForm(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold"
                    >
                      Kirim Pengajuan ke Kepala Store
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* RESULT CARD: SCANNED STORAGE LOCATION (RAK) */}
          {matchedRack && !matchedItem && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/40 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-xs font-extrabold">
                      LOKASI RAK: {matchedRack.code}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 text-[11px] font-bold">
                      {matchedRack.zone || 'Zona Store'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {matchedRack.name}
                  </h3>
                  {matchedRack.description && (
                    <p className="text-xs text-slate-600">{matchedRack.description}</p>
                  )}
                </div>

                <div className="bg-white px-3.5 py-2 rounded-xl border border-amber-200 text-right shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    Total Material di Rak Ini
                  </span>
                  <span className="text-lg font-extrabold font-mono text-slate-900">
                    {rackItems.length} Barang
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200/80">
                <p className="text-xs font-bold text-slate-800 mb-2">
                  Daftar Barang yang Tersimpan di {matchedRack.code}:
                </p>
                {rackItems.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    Belum ada barang yang ditempatkan di rak ini.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {rackItems.map((ri) => (
                      <div
                        key={ri.id}
                        onClick={() => setMatchedItem(ri)}
                        className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-amber-400 cursor-pointer flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-[11px] font-bold text-slate-900 block">
                            {ri.sku}
                          </span>
                          <span className="text-xs font-semibold text-slate-700 truncate block">
                            {ri.name}
                          </span>
                        </div>
                        <span className="px-2 py-1 rounded bg-slate-100 font-mono text-xs font-bold text-slate-900 shrink-0">
                          {ri.currentStock} {ri.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
