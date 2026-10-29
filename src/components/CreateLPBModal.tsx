import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StockItem, LPBItem, LPBDocument } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { ItemPickerModal } from './ItemPickerModal';
import { BarcodeAddScannerPanel } from './BarcodeAddScannerPanel';
import {
  Plus,
  Trash2,
  PackageCheck,
  X,
  AlertCircle,
  Boxes,
  MapPin,
  Target,
  ScanBarcode,
  CheckCircle2,
  Camera,
  CameraOff,
  Check,
  Volume2,
  Search,
  RefreshCw,
  Minus,
  PackagePlus,
} from 'lucide-react';
import { soundService } from '../services/soundService';

interface CreateLPBModalProps {
  stockItems: StockItem[];
  currentUser?: { name: string };
  onClose: () => void;
  onSubmit: (data: {
    sjNumber: string;
    sjDate: string;
    supplierName: string;
    receivedDate: string;
    poNumber?: string;
    driverName?: string;
    vehiclePlate?: string;
    usagePurpose?: string;
    storageLocation?: string;
    notes?: string;
    items: Omit<LPBItem, 'sku' | 'itemName' | 'unit'>[];
  }) => LPBDocument;
  onSuccessPrint: (doc: LPBDocument) => void;
}

export const CreateLPBModal: React.FC<CreateLPBModalProps> = ({
  stockItems,
  currentUser: propCurrentUser,
  onClose,
  onSubmit,
  onSuccessPrint,
}) => {
  const {
    currentUser: ctxCurrentUser,
    storageLocations,
    addStorageLocation,
    addNewStockItem,
  } = useInventory();
  const activeUserName = propCurrentUser?.name || ctxCurrentUser?.name || 'Admin Store';
  const today = new Date().toISOString().split('T')[0];

  const [sjNumber, setSjNumber] = useState('');
  const [sjDate, setSjDate] = useState(today);
  const [supplierName, setSupplierName] = useState('');
  const [receivedDate, setReceivedDate] = useState(today);
  const [poNumber, setPoNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [usagePurpose, setUsagePurpose] = useState('Pemenuhan Stok Logistik Gudang');
  const [defaultStorageLocation, setDefaultStorageLocation] = useState(
    stockItems[0]?.location || storageLocations[0]?.code || 'Rak A-01'
  );
  const [notes, setNotes] = useState('');

  // Quick add new rack inline
  const [showAddLocInline, setShowAddLocInline] = useState(false);
  const [newLocCode, setNewLocCode] = useState('');
  const [newLocName, setNewLocName] = useState('');

  const availableLocations = useMemo(() => {
    return Array.from(
      new Set([
        ...storageLocations.map((l) => l.code),
        ...stockItems.map((i) => i.location).filter(Boolean),
      ])
    ).sort();
  }, [storageLocations, stockItems]);

  const handleQuickAddLocation = () => {
    if (!newLocCode.trim()) return;
    const res = addStorageLocation({
      code: newLocCode.trim(),
      name: newLocName.trim() || `Area Simpan ${newLocCode.trim()}`,
      zone: 'Zona Gudang',
    });
    if (res.success && res.location) {
      setDefaultStorageLocation(res.location.code);
      setNewLocCode('');
      setNewLocName('');
      setShowAddLocInline(false);
    }
  };

  const [items, setItems] = useState<
    Array<{
      itemId: string;
      quantity: number;
      batchNo: string;
      condition: 'Baik' | 'Kurang' | 'Rusak';
      notes: string;
      storageLocation: string;
      barcodeValidated: boolean;
      barcodeScannedAt?: string;
      scanInputText: string;
    }>
  >(() =>
    stockItems[0]
      ? [
          {
            itemId: stockItems[0].id,
            quantity: 10,
            batchNo: '',
            condition: 'Baik',
            notes: '',
            storageLocation: stockItems[0].location || 'Rak A-01',
            barcodeValidated: false,
            scanInputText: '',
          },
        ]
      : []
  );

  // Track if the initial row was untouched so picking from catalog/search replaces it cleanly
  const [hasTouchedInitialRow, setHasTouchedInitialRow] = useState(false);

  const [errorMsg, setErrorMsg] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [replacingRowIndex, setReplacingRowIndex] = useState<number | null>(null);

  // Quick Search & Add Bar State
  const [quickSearchText, setQuickSearchText] = useState('');
  const [quickSearchQty, setQuickSearchQty] = useState(10);
  const [showQuickDropdown, setShowQuickDropdown] = useState(false);
  const [showBarcodeAddScanner, setShowBarcodeAddScanner] = useState(false);

  // Quick New Master Item Inline Modal/Panel
  const [showQuickNewMaster, setShowQuickNewMaster] = useState(false);
  const [newMasterSku, setNewMasterSku] = useState('');
  const [newMasterName, setNewMasterName] = useState('');
  const [newMasterCategory, setNewMasterCategory] = useState('Sparepart Mesin');
  const [newMasterUnit, setNewMasterUnit] = useState('Pcs');
  const [newMasterMinStock, setNewMasterMinStock] = useState(5);
  const [newMasterLocation, setNewMasterLocation] = useState(defaultStorageLocation || 'Rak A-01');
  const [newMasterReceiveQty, setNewMasterReceiveQty] = useState(10);

  // Camera Scanner State for LPB Item (Otomatis aktif di baris pertama apabila dibuka via HP)
  const isMobilePhone =
    typeof window !== 'undefined' &&
    (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent || ''
    ) ||
      (window.innerWidth <= 820 && navigator.maxTouchPoints > 0));

  const [activeCameraRowIdx, setActiveCameraRowIdx] = useState<number | null>(() =>
    isMobilePhone ? 0 : null
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastCameraScanInfo, setLastCameraScanInfo] = useState<string | null>(null);
  const [lastScannedItemId, setLastScannedItemId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  const playBeep = () => {
    soundService.playScanSuccess();
  };

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
    if (activeCameraRowIdx === null) {
      stopCameraScanner();
      return;
    }

    let isMounted = true;
    setCameraError(null);
    setLastCameraScanInfo(null);

    const startCamera = async () => {
      stopCameraScanner();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(
          'Browser tidak mendukung akses kamera. Gunakan tombol Simulasi Scan atau ketik Material Code manual.'
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
                const cleaned = barcodes[0].rawValue.trim().toUpperCase();
                setLastCameraScanInfo(`Terbaca: ${cleaned}`);

                const targetRow = items[activeCameraRowIdx];
                const expectedStock = stockItems.find((s) => s.id === targetRow?.itemId);

                if (
                  expectedStock &&
                  (cleaned === expectedStock.sku.toUpperCase() ||
                    cleaned.includes(expectedStock.sku.toUpperCase()))
                ) {
                  playBeep();
                  setItems((prev) =>
                    prev.map((row, i) =>
                      i === activeCameraRowIdx
                        ? {
                            ...row,
                            barcodeValidated: true,
                            barcodeScannedAt: new Date().toISOString(),
                            scanInputText: expectedStock.sku,
                          }
                        : row
                    )
                  );
                  setErrorMsg('');
                  setActiveCameraRowIdx(null);
                }
              }
            } catch {
              // ignore frame detection error
            }
          }, 300);
        }
      } catch {
        if (isMounted) {
          setCameraError(
            'Kamera tidak dapat diakses pada perangkat ini. Gunakan tombol Simulasi Scan atau ketik Material Code manual.'
          );
        }
      }
    };

    startCamera();
    return () => {
      isMounted = false;
      stopCameraScanner();
    };
  }, [activeCameraRowIdx]);

  // Quick Search Filtered Results
  const quickSearchResults = useMemo(() => {
    if (!quickSearchText.trim()) return [];
    const q = quickSearchText.toLowerCase();
    return stockItems
      .filter(
        (item) =>
          item.sku.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [stockItems, quickSearchText]);

  // Helper to add or merge an item into LPB items list
  const addOrMergeItemToLPB = (
    selectedItem: StockItem,
    addedQty: number,
    replaceIdx: number | null = null,
    isFromBarcodeScan = false
  ) => {
    const cleanQty = Math.max(1, Number(addedQty) || 1);
    const nowIso = new Date().toISOString();
    setErrorMsg('');
    if (isFromBarcodeScan) {
      setLastScannedItemId(selectedItem.id);
    }

    setItems((prev) => {
      // Case 1: Replacing a specific row
      if (replaceIdx !== null && replaceIdx >= 0 && replaceIdx < prev.length) {
        const otherIdx = prev.findIndex(
          (r, idx) => idx !== replaceIdx && r.itemId === selectedItem.id
        );
        if (otherIdx >= 0) {
          return prev
            .map((r, idx) =>
              idx === otherIdx
                ? {
                    ...r,
                    quantity: r.quantity + cleanQty,
                    barcodeValidated: isFromBarcodeScan ? true : r.barcodeValidated,
                    barcodeScannedAt: isFromBarcodeScan ? nowIso : r.barcodeScannedAt,
                    scanInputText: isFromBarcodeScan ? selectedItem.sku : r.scanInputText,
                  }
                : r
            )
            .filter((_, idx) => idx !== replaceIdx);
        }
        return prev.map((r, idx) =>
          idx === replaceIdx
            ? {
                ...r,
                itemId: selectedItem.id,
                quantity: cleanQty,
                storageLocation: selectedItem.location || defaultStorageLocation,
                barcodeValidated: isFromBarcodeScan,
                barcodeScannedAt: isFromBarcodeScan ? nowIso : undefined,
                scanInputText: isFromBarcodeScan ? selectedItem.sku : '',
              }
            : r
        );
      }

      // Case 2: If the initial default row is untouched and user picks a different item first
      if (
        !hasTouchedInitialRow &&
        prev.length === 1 &&
        !prev[0].barcodeValidated &&
        prev[0].itemId !== selectedItem.id
      ) {
        setHasTouchedInitialRow(true);
        return [
          {
            itemId: selectedItem.id,
            quantity: cleanQty,
            batchNo: '',
            condition: 'Baik',
            notes: '',
            storageLocation: selectedItem.location || defaultStorageLocation,
            barcodeValidated: isFromBarcodeScan,
            barcodeScannedAt: isFromBarcodeScan ? nowIso : undefined,
            scanInputText: isFromBarcodeScan ? selectedItem.sku : '',
          },
        ];
      }

      setHasTouchedInitialRow(true);

      // Case 3: Item already exists in LPB -> add quantity
      const existingIdx = prev.findIndex((i) => i.itemId === selectedItem.id);
      if (existingIdx >= 0) {
        return prev.map((it, idx) =>
          idx === existingIdx
            ? {
                ...it,
                quantity: it.quantity + cleanQty,
                barcodeValidated: isFromBarcodeScan ? true : it.barcodeValidated,
                barcodeScannedAt: isFromBarcodeScan ? nowIso : it.barcodeScannedAt,
                scanInputText: isFromBarcodeScan ? selectedItem.sku : it.scanInputText,
              }
            : it
        );
      }

      // Case 4: Append new row
      return [
        ...prev,
        {
          itemId: selectedItem.id,
          quantity: cleanQty,
          batchNo: '',
          condition: 'Baik',
          notes: '',
          storageLocation: selectedItem.location || defaultStorageLocation,
          barcodeValidated: isFromBarcodeScan,
          barcodeScannedAt: isFromBarcodeScan ? nowIso : undefined,
          scanInputText: isFromBarcodeScan ? selectedItem.sku : '',
        },
      ];
    });
  };

  const handleAddItemRow = () => {
    setHasTouchedInitialRow(true);
    setErrorMsg('');

    const usedIds = new Set(items.map((i) => i.itemId));
    const nextAvailableItem = stockItems.find((s) => !usedIds.has(s.id)) || stockItems[0];

    if (!nextAvailableItem) return;

    if (usedIds.has(nextAvailableItem.id)) {
      setReplacingRowIndex(null);
      setIsPickerOpen(true);
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        itemId: nextAvailableItem.id,
        quantity: 1,
        batchNo: '',
        condition: 'Baik',
        notes: '',
        storageLocation: nextAvailableItem.location || defaultStorageLocation,
        barcodeValidated: false,
        scanInputText: '',
      },
    ]);
  };

  const handleOpenPickerForAdd = () => {
    setReplacingRowIndex(null);
    setIsPickerOpen(true);
  };

  const handleOpenPickerForReplace = (idx: number) => {
    setHasTouchedInitialRow(true);
    setReplacingRowIndex(idx);
    setIsPickerOpen(true);
  };

  const handleSelectFromPicker = (selectedItem: StockItem, requestedQty: number) => {
    addOrMergeItemToLPB(selectedItem, requestedQty, replacingRowIndex);
  };

  const handleCreateNewMasterFromPicker = (
    newItemData: Omit<StockItem, 'id' | 'allocatedStock' | 'updatedAt'>,
    initialReceiveQty: number
  ) => {
    const created = addNewStockItem(newItemData);
    addOrMergeItemToLPB(created, initialReceiveQty, replacingRowIndex);
  };

  const handleQuickCreateNewMasterInline = () => {
    const cleanSku = newMasterSku.trim().toUpperCase();
    const cleanName = newMasterName.trim();
    if (!cleanSku || !cleanName) {
      setErrorMsg('Material Code dan Nama Barang baru wajib diisi.');
      return;
    }
    if (stockItems.some((s) => s.sku.toUpperCase() === cleanSku)) {
      setErrorMsg(`Material Code "${cleanSku}" sudah terdaftar di Master Stok.`);
      return;
    }
    const created = addNewStockItem({
      sku: cleanSku,
      name: cleanName,
      category: newMasterCategory.trim() || 'Sparepart Mesin',
      unit: newMasterUnit.trim() || 'Pcs',
      currentStock: 0,
      minStock: Math.max(0, Number(newMasterMinStock) || 0),
      location: newMasterLocation.trim() || defaultStorageLocation || 'Rak A-01',
      description: 'Didaftarkan saat penerimaan LPB',
    });
    addOrMergeItemToLPB(created, Math.max(1, Number(newMasterReceiveQty) || 1), null);
    setNewMasterSku('');
    setNewMasterName('');
    setShowQuickNewMaster(false);
  };

  const handleRemoveItemRow = (index: number) => {
    setHasTouchedInitialRow(true);
    setItems((prev) => prev.filter((_, i) => i !== index));
    setErrorMsg('');
  };

  const handleItemChange = (index: number, field: string, value: string | number | boolean) => {
    setHasTouchedInitialRow(true);
    setItems((prev) => {
      if (field === 'itemId') {
        const newItemId = String(value);
        const targetStock = stockItems.find((s) => s.id === newItemId);
        const duplicateIdx = prev.findIndex((r, idx) => idx !== index && r.itemId === newItemId);
        if (duplicateIdx >= 0) {
          const currentRowQty = prev[index].quantity;
          return prev
            .map((r, idx) =>
              idx === duplicateIdx ? { ...r, quantity: r.quantity + currentRowQty } : r
            )
            .filter((_, idx) => idx !== index);
        }

        return prev.map((item, i) =>
          i === index
            ? {
                ...item,
                itemId: newItemId,
                storageLocation:
                  targetStock?.location || item.storageLocation || defaultStorageLocation,
                barcodeValidated: false,
                barcodeScannedAt: undefined,
                scanInputText: '',
              }
            : item
        );
      }

      return prev.map((item, i) => (i === index ? { ...item, [field]: value } : item));
    });
  };

  const handleValidateBarcodeRow = (index: number, enteredCode?: string) => {
    const row = items[index];
    const stock = stockItems.find((s) => s.id === row.itemId);
    if (!stock) return;

    const codeToVerify = (enteredCode !== undefined ? enteredCode : row.scanInputText)
      .trim()
      .toUpperCase();
    if (!codeToVerify || codeToVerify === stock.sku.toUpperCase()) {
      playBeep();
      setHasTouchedInitialRow(true);
      setLastScannedItemId(stock.id);
      setItems((prev) =>
        prev.map((it, idx) =>
          idx === index
            ? {
                ...it,
                barcodeValidated: true,
                barcodeScannedAt: new Date().toISOString(),
                scanInputText: stock.sku,
              }
            : it
        )
      );
      setErrorMsg('');
    } else {
      soundService.playScanError();
      setErrorMsg(
        `Kode scan "${codeToVerify}" tidak cocok dengan Material Code barang "${stock.sku}" (${stock.name})!`
      );
    }
  };

  const handleValidateAllBarcodes = () => {
    const nowIso = new Date().toISOString();
    playBeep();
    setHasTouchedInitialRow(true);
    setItems((prev) =>
      prev.map((it) => {
        const st = stockItems.find((s) => s.id === it.itemId);
        return {
          ...it,
          barcodeValidated: true,
          barcodeScannedAt: it.barcodeScannedAt || nowIso,
          scanInputText: st ? st.sku : it.scanInputText,
        };
      })
    );
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!sjNumber.trim() || !supplierName.trim()) {
      setErrorMsg('Nomor Surat Jalan (SJ) dan Nama Supplier wajib diisi.');
      return;
    }

    if (items.length === 0) {
      setErrorMsg('Minimal harus ada 1 item barang yang diterima dalam LPB.');
      return;
    }

    for (const item of items) {
      if (!item.itemId || item.quantity <= 0) {
        setErrorMsg('Pastikan semua barang dipilih dan jumlah diterima lebih dari 0.');
        return;
      }
      if (!item.barcodeValidated) {
        const st = stockItems.find((s) => s.id === item.itemId);
        setErrorMsg(
          `Barang "${st?.name || item.itemId}" (${st?.sku}) belum divalidasi / scan barcode oleh Admin Gudang! Silakan klik tombol Scan / Validasi Barcode terlebih dahulu.`
        );
        return;
      }
    }

    const createdDoc = onSubmit({
      sjNumber: sjNumber.trim(),
      sjDate,
      supplierName: supplierName.trim(),
      receivedDate,
      poNumber: poNumber.trim() || '-',
      driverName: driverName.trim() || '-',
      vehiclePlate: vehiclePlate.trim() || '-',
      usagePurpose: usagePurpose.trim() || 'Pemenuhan Stok Logistik Gudang',
      storageLocation: defaultStorageLocation,
      notes: notes.trim(),
      items: items.map((i) => ({
        itemId: i.itemId,
        quantity: Number(i.quantity),
        batchNo: i.batchNo.trim() || '-',
        condition: i.condition,
        notes: i.notes.trim(),
        storageLocation: i.storageLocation || defaultStorageLocation,
        barcodeValidated: i.barcodeValidated,
        barcodeScannedAt: i.barcodeScannedAt || new Date().toISOString(),
      })),
    });

    onClose();
    onSuccessPrint(createdDoc);
  };

  const selectedQuantitiesMap = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((i) => {
      map[i.itemId] = (map[i.itemId] || 0) + Number(i.quantity || 0);
    });
    return map;
  }, [items]);

  const stockMap = useMemo(() => {
    const m = new Map<string, StockItem>();
    stockItems.forEach((s) => m.set(s.id, s));
    return m;
  }, [stockItems]);

  const usedItemIdsSet = useMemo(() => new Set(items.map((i) => i.itemId)), [items]);

  const inlineSelectBaseOptions = useMemo(() => stockItems.slice(0, 100), [stockItems]);

  const totalUnits = items.reduce((acc, r) => acc + Number(r.quantity || 0), 0);

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[94vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-emerald-950 text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-semibold">
                  Input Surat Jalan Supplier &rarr; Terbitkan LPB (Barang Masuk)
                </h2>
                <p className="text-[11px] sm:text-xs text-emerald-200/80">
                  Tahap 1 (Admin Gudang): Input SJ & Validasi Scan Barcode &bull; Tahap 2 (Kepala Gudang): Approve Penambahan Stock
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

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Supplier & SJ Metadata */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nomor Surat Jalan (SJ Supplier) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sjNumber}
                  onChange={(e) => setSjNumber(e.target.value)}
                  placeholder="Contoh: SJ/2025/05/8821"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nama Perusahaan Supplier <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Contoh: PT. Kawan Lama Sejahtera"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Nomor Purchase Order (PO) Ref
                </label>
                <input
                  type="text"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="Contoh: PO-PROC-2025-102"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Tanggal Surat Jalan</label>
                <input
                  type="date"
                  value={sjDate}
                  onChange={(e) => setSjDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Tanggal Diterima di Gudang
                </label>
                <input
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Ekspedisi / Pengemudi & Nopol
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    placeholder="Nama Sopir"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                  <input
                    type="text"
                    value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="B 9120 TX"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Keperluan & Lokasi Rak Penyimpanan */}
            <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div>
                <label className="block font-semibold text-emerald-950 mb-1 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Keperluan / Peruntukan Barang Masuk</span>
                </label>
                <input
                  type="text"
                  value={usagePurpose}
                  onChange={(e) => setUsagePurpose(e.target.value)}
                  placeholder="Misal: Stok Sparepart Line 2 / Proyek Overhaul"
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-emerald-950 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Lokasi Rak Penyimpanan Default</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAddLocInline(!showAddLocInline)}
                    className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline"
                  >
                    {showAddLocInline ? 'Batal' : '+ Tambah Rak Baru'}
                  </button>
                </div>

                {showAddLocInline ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newLocCode}
                      onChange={(e) => setNewLocCode(e.target.value)}
                      placeholder="Kode Rak (Cth: Rak F-01)"
                      className="w-1/2 px-2.5 py-1.5 bg-white border border-emerald-400 rounded-lg text-xs font-mono"
                    />
                    <input
                      type="text"
                      value={newLocName}
                      onChange={(e) => setNewLocName(e.target.value)}
                      placeholder="Keterangan"
                      className="w-1/2 px-2.5 py-1.5 bg-white border border-emerald-400 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleQuickAddLocation}
                      className="px-2.5 py-1.5 bg-emerald-700 text-white font-semibold rounded-lg text-xs shrink-0"
                    >
                      Simpan
                    </button>
                  </div>
                ) : (
                  <select
                    value={defaultStorageLocation}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDefaultStorageLocation(val);
                      setItems((prev) =>
                        prev.map((it) => ({ ...it, storageLocation: val }))
                      );
                    }}
                    className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg font-medium text-slate-800 focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                  >
                    {availableLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Line Items Table + Multi-Method Add Barang */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Daftar Rincian Barang Diterima ({items.length} Macam &middot; {totalUnits} Total Unit)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cari cepat di bawah, pilih dari Katalog, atau daftarkan Barang Baru jika belum ada di Master.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBarcodeAddScanner((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shadow-xs ${
                      showBarcodeAddScanner
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-900 hover:bg-slate-800 text-amber-400'
                    }`}
                  >
                    <ScanBarcode className="w-3.5 h-3.5" />
                    {showBarcodeAddScanner ? 'Tutup Scan Tambah' : '+ Scan Barcode Tambah Item'}
                  </button>
                  <button
                    type="button"
                    onClick={handleValidateAllBarcodes}
                    disabled={items.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Validasi Semua Barcode
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowQuickNewMaster((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-900 bg-white hover:bg-emerald-50 border border-emerald-400 rounded-lg transition-colors"
                  >
                    <PackagePlus className="w-3.5 h-3.5 text-emerald-700" />
                    {showQuickNewMaster ? 'Tutup Barang Baru' : '+ Barang Baru (Master)'}
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenPickerForAdd}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg transition-colors shadow-xs"
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    + Pilih dari Katalog
                  </button>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Baris
                  </button>
                </div>
              </div>

              {/* Barcode Scanner Panel for Directly Adding & Validating LPB Items */}
              {showBarcodeAddScanner && (
                <BarcodeAddScannerPanel
                  mode="LPB"
                  stockItems={stockItems}
                  selectedQuantitiesMap={selectedQuantitiesMap}
                  onBarcodeAddItem={(item, qty) => addOrMergeItemToLPB(item, qty, null, true)}
                  onUnrecognizedBarcodeInLPB={(scannedCode, qty) => {
                    setNewMasterSku(scannedCode);
                    setNewMasterReceiveQty(qty);
                    setShowQuickNewMaster(true);
                    setShowBarcodeAddScanner(false);
                  }}
                  onClose={() => setShowBarcodeAddScanner(false)}
                />
              )}

              {/* Inline Form: Daftar Barang Baru (Master) */}
              {showQuickNewMaster && (
                <div className="mb-3 p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <PackagePlus className="w-4 h-4 text-emerald-700" />
                      <span>Daftarkan Barang Baru ke Master Stok & Tambahkan ke LPB Ini</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowQuickNewMaster(false)}
                      className="text-slate-500 hover:text-slate-800 text-[11px] font-semibold"
                    >
                      Tutup
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-2.5">
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        Material Code *
                      </label>
                      <input
                        type="text"
                        value={newMasterSku}
                        onChange={(e) => setNewMasterSku(e.target.value.toUpperCase())}
                        placeholder="BRG-0099"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono uppercase text-xs"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        Nama & Spesifikasi Barang *
                      </label>
                      <input
                        type="text"
                        value={newMasterName}
                        onChange={(e) => setNewMasterName(e.target.value)}
                        placeholder="Contoh: Seal Kit Hydraulic Cylinder Ø50"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        Kategori
                      </label>
                      <input
                        type="text"
                        value={newMasterCategory}
                        onChange={(e) => setNewMasterCategory(e.target.value)}
                        placeholder="Mechanical"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="block text-[11px] font-medium text-slate-700 mb-1">
                        Satuan & Rak
                      </label>
                      <div className="flex gap-1">
                        <select
                          value={newMasterUnit}
                          onChange={(e) => setNewMasterUnit(e.target.value)}
                          className="w-1/2 px-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        >
                          {['Pcs', 'Set', 'Unit', 'Box', 'Roll', 'Meter', 'Liter', 'Kaleng', 'Kg'].map(
                            (u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            )
                          )}
                        </select>
                        <select
                          value={newMasterLocation}
                          onChange={(e) => setNewMasterLocation(e.target.value)}
                          className="w-1/2 px-1.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        >
                          {availableLocations.map((loc) => (
                            <option key={loc} value={loc}>
                              {loc}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="sm:col-span-1 flex items-end gap-1.5">
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-emerald-900 mb-1">
                          Qty Masuk *
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={newMasterReceiveQty}
                          onChange={(e) =>
                            setNewMasterReceiveQty(Math.max(1, parseInt(e.target.value) || 1))
                          }
                          className="w-full px-2 py-1.5 bg-white border border-emerald-400 rounded-lg font-mono font-bold text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleQuickCreateNewMasterInline}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-xs shrink-0"
                      >
                        + Simpan
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Search & Direct Add Bar */}
              <div className="mb-3 relative">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-slate-100/80 border border-slate-200 rounded-xl">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={quickSearchText}
                      onFocus={() => setShowQuickDropdown(true)}
                      onChange={(e) => {
                        setQuickSearchText(e.target.value);
                        setShowQuickDropdown(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && quickSearchText.trim()) {
                          e.preventDefault();
                          const clean = quickSearchText.trim().toUpperCase();
                          const exactMatch = stockItems.find(
                            (s) => s.sku.toUpperCase() === clean
                          );
                          const target =
                            exactMatch ||
                            (quickSearchResults.length === 1 ? quickSearchResults[0] : null);
                          if (target) {
                            playBeep();
                            addOrMergeItemToLPB(
                              target,
                              quickSearchQty,
                              null,
                              Boolean(exactMatch)
                            );
                            setQuickSearchText('');
                            setShowQuickDropdown(false);
                          }
                        }
                      }}
                      placeholder="Scan Barcode (Enter) atau ketik Material Code / Nama Barang untuk tambah cepat ke LPB..."
                      className="w-full pl-9 pr-14 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-700 focus:outline-hidden"
                    />
                    {quickSearchText && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickSearchText('');
                          setShowQuickDropdown(false);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 hover:text-slate-700"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-medium text-slate-600">Qty Masuk:</span>
                    <input
                      type="number"
                      min="1"
                      value={quickSearchQty}
                      onChange={(e) => setQuickSearchQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs text-center"
                    />
                  </div>
                </div>

                {/* Quick Search Autocomplete Dropdown */}
                {showQuickDropdown && quickSearchText.trim().length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 z-30 bg-white border border-slate-300 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {quickSearchResults.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 flex items-center justify-between">
                        <span>
                          Tidak ditemukan barang dengan kata kunci <strong>"{quickSearchText}"</strong>.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewMasterSku(
                              !quickSearchText.includes(' ')
                                ? quickSearchText.trim().toUpperCase()
                                : `MAT-${String(stockItems.length + 1).padStart(4, '0')}`
                            );
                            setNewMasterName(quickSearchText.includes(' ') ? quickSearchText.trim() : '');
                            setShowQuickNewMaster(true);
                            setShowQuickDropdown(false);
                          }}
                          className="px-2.5 py-1 bg-emerald-700 text-white font-semibold rounded-lg text-[11px]"
                        >
                          + Daftarkan Barang Baru
                        </button>
                      </div>
                    ) : (
                      quickSearchResults.map((item) => {
                        const alreadyInList = items.some((i) => i.itemId === item.id);
                        return (
                          <div
                            key={item.id}
                            className="px-3.5 py-2.5 hover:bg-emerald-50/60 flex items-center justify-between gap-2 text-xs transition-colors"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {item.sku}
                                </span>
                                <span className="font-semibold text-slate-800">{item.name}</span>
                                {alreadyInList && (
                                  <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                    Sudah di daftar
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Kategori: {item.category} &bull; Rak: {item.location} &bull; Stok Saat Ini:{' '}
                                <strong>
                                  {item.currentStock} {item.unit}
                                </strong>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                addOrMergeItemToLPB(item, quickSearchQty, null);
                                setQuickSearchText('');
                                setShowQuickDropdown(false);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-lg text-xs shrink-0 shadow-2xs"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>
                                {alreadyInList
                                  ? `+ Tambah Qty (${quickSearchQty})`
                                  : `+ Masukkan (${quickSearchQty} ${item.unit})`}
                              </span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* Camera Barcode Scanner Box for LPB */}
              {activeCameraRowIdx !== null && (
                <div className="mb-3 p-3.5 bg-slate-900 text-white rounded-xl border border-emerald-500/40 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span className="text-xs font-semibold">
                        Kamera Pemindai Barcode Aktif (Baris #{activeCameraRowIdx + 1}:{' '}
                        {stockItems.find((s) => s.id === items[activeCameraRowIdx]?.itemId)?.sku || ''})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveCameraRowIdx(null)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px]"
                    >
                      <CameraOff className="w-3.5 h-3.5" />
                      Tutup Kamera
                    </button>
                  </div>

                  <div className="relative w-full max-w-sm mx-auto overflow-hidden rounded-lg bg-black border border-slate-700 aspect-video flex items-center justify-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400/80 shadow-[0_0_8px_#34d399]" />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs">
                    {lastCameraScanInfo ? (
                      <div className="font-mono text-emerald-300 flex items-center gap-1.5">
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>{lastCameraScanInfo}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px]">
                        Arahkan kamera ke barcode barang...
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        playBeep();
                        handleValidateBarcodeRow(activeCameraRowIdx, '');
                        setActiveCameraRowIdx(null);
                      }}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shrink-0"
                    >
                      Konfirmasi Scan Sesuai
                    </button>
                  </div>

                  {cameraError && (
                    <div className="p-2.5 bg-amber-950/90 border border-amber-600/50 rounded-lg text-[11px] text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span>{cameraError}</span>
                    </div>
                  )}
                </div>
              )}

              {items.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-300 rounded-xl text-center space-y-3 bg-slate-50">
                  <p className="text-xs text-slate-600 font-medium">
                    Belum ada barang di dalam daftar LPB ini.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBarcodeAddScanner(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-400 bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                    >
                      <ScanBarcode className="w-4 h-4" />
                      + Scan Barcode Tambah Barang
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenPickerForAdd}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg shadow-xs"
                    >
                      <Boxes className="w-4 h-4" />
                      + Pilih Barang dari Katalog
                    </button>
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Baris Manual
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                  {items.map((row, idx) => {
                    const selected = stockMap.get(row.itemId);
                    const rowOptions =
                      selected && !inlineSelectBaseOptions.some((o) => o.id === selected.id)
                        ? [selected, ...inlineSelectBaseOptions]
                        : inlineSelectBaseOptions;
                    const isRecentlyScanned = lastScannedItemId === row.itemId;
                    const scannedTimeStr = row.barcodeScannedAt
                      ? new Date(row.barcodeScannedAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })
                      : '';
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border transition-all space-y-2.5 text-xs ${
                          row.barcodeValidated
                            ? isRecentlyScanned
                              ? 'bg-emerald-50/50 border-2 border-emerald-500 ring-2 ring-emerald-400/40'
                              : 'bg-emerald-50/25 border-emerald-300'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                          {/* Select Item + Replace from Catalog */}
                          <div className="sm:col-span-5">
                            <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <label className="text-[11px] font-semibold text-slate-700">
                                  Barang #{idx + 1} (Material Code - Nama)
                                </label>
                                {row.barcodeValidated && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold shadow-2xs">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                                    <span>
                                      ✓ BARANG BERHASIL DISCAN
                                      {scannedTimeStr ? ` (${scannedTimeStr})` : ''}
                                    </span>
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenPickerForReplace(idx)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 transition-colors"
                                title="Cari & ganti barang baris ini melalui Katalog"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>Cari di Katalog</span>
                              </button>
                            </div>
                            <select
                              value={row.itemId}
                              onChange={(e) => handleItemChange(idx, 'itemId', e.target.value)}
                              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-medium"
                            >
                              {rowOptions.map((item) => {
                                const usedInOtherRow =
                                  item.id !== row.itemId && usedItemIdsSet.has(item.id);
                                return (
                                  <option key={item.id} value={item.id}>
                                    {item.sku} — {item.name} (Stok: {item.currentStock} {item.unit} | Min:{' '}
                                    {item.minStock} {item.unit})
                                    {usedInOtherRow ? ' [Sudah di daftar]' : ''}
                                  </option>
                                );
                              })}
                              {stockItems.length > 100 && (
                                <option disabled value="">
                                  ── Klik &quot;Cari di Katalog&quot; untuk mencari dari{' '}
                                  {stockItems.length.toLocaleString('id-ID')} barang ──
                                </option>
                              )}
                            </select>
                          </div>

                          {/* Quantity Stepper */}
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Qty Diterima ({selected?.unit || 'Unit'})
                            </label>
                            <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                              <button
                                type="button"
                                onClick={() =>
                                  handleItemChange(idx, 'quantity', Math.max(1, Number(row.quantity) - 1))
                                }
                                disabled={row.quantity <= 1}
                                className="px-2.5 py-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min="1"
                                required
                                value={row.quantity}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  handleItemChange(idx, 'quantity', isNaN(val) ? 1 : Math.max(1, val));
                                }}
                                className="w-full py-1.5 text-center font-mono font-bold text-xs focus:outline-hidden"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleItemChange(idx, 'quantity', Number(row.quantity || 0) + 1)
                                }
                                className="px-2.5 py-2 text-slate-600 hover:bg-slate-100"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Storage Location per Item */}
                          <div className="sm:col-span-3">
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Lokasi Rak Simpan
                            </label>
                            <select
                              value={row.storageLocation || defaultStorageLocation}
                              onChange={(e) =>
                                handleItemChange(idx, 'storageLocation', e.target.value)
                              }
                              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                            >
                              {availableLocations.map((loc) => (
                                <option key={loc} value={loc}>
                                  {loc}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Remove Action */}
                          <div className="sm:col-span-1 flex items-end justify-end pt-4">
                            <button
                              type="button"
                              onClick={() => handleRemoveItemRow(idx)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Hapus baris barang ini"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Secondary Row: Condition, Batch No & Barcode Scan Validation */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-slate-200/70 items-center">
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] text-slate-500 mb-0.5">
                              Kondisi Fisik
                            </label>
                            <select
                              value={row.condition}
                              onChange={(e) => handleItemChange(idx, 'condition', e.target.value)}
                              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                            >
                              <option value="Baik">Baik (Sesuai Standar)</option>
                              <option value="Kurang">Kurang (Selisih / Minor)</option>
                              <option value="Rusak">Rusak / Cacat Fisik</option>
                            </select>
                          </div>

                          <div className="sm:col-span-3">
                            <label className="block text-[10px] text-slate-500 mb-0.5">
                              No. Batch / Lot
                            </label>
                            <input
                              type="text"
                              value={row.batchNo}
                              onChange={(e) => handleItemChange(idx, 'batchNo', e.target.value)}
                              placeholder="LOT-2025-A"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                            />
                          </div>

                          {/* Scan / Validasi Barcode Barang oleh Admin Gudang */}
                          <div className="sm:col-span-6">
                            <label className="block text-[10px] text-slate-500 mb-0.5">
                              Validasi Scan Barcode Barang (Wajib oleh Admin Gudang)
                            </label>
                            {row.barcodeValidated ? (
                              <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-600 text-white border border-emerald-700 rounded-lg shadow-2xs">
                                <div className="flex items-center gap-1.5 font-extrabold text-xs">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                                  <span>
                                    ✓ BARANG BERHASIL DISCAN ({selected?.sku})
                                    {scannedTimeStr ? ` • ${scannedTimeStr}` : ''}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleItemChange(idx, 'barcodeValidated', false)}
                                  className="text-[11px] text-emerald-100 hover:text-white underline font-semibold"
                                >
                                  Ulangi Scan
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={row.scanInputText}
                                  onChange={(e) =>
                                    handleItemChange(idx, 'scanInputText', e.target.value)
                                  }
                                  placeholder={`Ketik / Scan Material Code (${selected?.sku || ''})`}
                                  className="flex-1 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-emerald-600 focus:outline-hidden"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveCameraRowIdx(activeCameraRowIdx === idx ? null : idx)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-semibold rounded-lg text-xs shrink-0 transition-colors"
                                  title="Buka Kamera HP Pemindai Barcode"
                                >
                                  <Camera className="w-3.5 h-3.5" />
                                  <span>Scan Kamera</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Apabila menggunakan HP dan kolom input masih kosong & kamera belum aktif untuk baris ini, aktifkan kamera HP terlebih dahulu
                                    if (
                                      isMobilePhone &&
                                      !row.scanInputText.trim() &&
                                      activeCameraRowIdx !== idx
                                    ) {
                                      setActiveCameraRowIdx(idx);
                                      return;
                                    }
                                    handleValidateBarcodeRow(idx);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-lg text-xs shrink-0 transition-colors"
                                  title="Validasi Scan Barcode"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Validasi</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Remarks & Verifier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs pt-2 border-t border-slate-100">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Petugas Penerima & Validasi (Admin Gudang)
                </label>
                <input
                  type="text"
                  disabled
                  value={`${activeUserName} (Menunggu Approve Penambahan Stock Kepala Gudang)`}
                  className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-600 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Catatan Pemeriksaan Fisik / Keterangan LPB
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Kemasan palet utuh, segel pabrik lengkap"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                * Tahap 1: Admin Gudang meng-ACC & validasi scan barang (stok fisik <strong>belum bertambah</strong>). Stok otomatis bertambah setelah <strong>Kepala Gudang meng-approve penambahan stock</strong>.
              </p>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg transition-colors shadow-xs"
                >
                  <PackageCheck className="w-4 h-4" />
                  ACC & Validasi LPB (Kirim ke Kepala Gudang)
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <ItemPickerModal
        isOpen={isPickerOpen}
        onClose={() => {
          setIsPickerOpen(false);
          setReplacingRowIndex(null);
        }}
        mode="LPB"
        stockItems={stockItems}
        selectedItemIds={items.map((i) => i.itemId)}
        selectedQuantitiesMap={selectedQuantitiesMap}
        onSelectItem={handleSelectFromPicker}
        onCreateNewMasterItem={handleCreateNewMasterFromPicker}
        availableLocations={availableLocations}
        replaceModeIndex={replacingRowIndex}
        title={
          replacingRowIndex !== null
            ? `Ganti Barang Baris #${replacingRowIndex + 1} (LPB)`
            : 'Pilih Barang Masuk untuk LPB'
        }
        subtitle="Pilih dari katalog gudang atau daftarkan barang baru jika belum terdaftar di Master."
      />
    </>
  );
};
