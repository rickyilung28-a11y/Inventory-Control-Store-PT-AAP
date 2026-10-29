import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { StockItem } from '../types/inventory';
import { BarcodeAddScannerPanel } from './BarcodeAddScannerPanel';
import {
  Search,
  Check,
  MapPin,
  X,
  Plus,
  Boxes,
  Minus,
  PackagePlus,
  CheckCircle2,
  ScanBarcode,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface ItemPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockItems: StockItem[];
  selectedItemIds: string[];
  selectedQuantitiesMap?: Record<string, number>;
  initialAllocationsMap?: Record<string, number>;
  onSelectItem: (item: StockItem, requestedQty: number) => void;
  onCreateNewMasterItem?: (
    newItemData: Omit<StockItem, 'id' | 'allocatedStock' | 'updatedAt'>,
    initialReceiveQty: number
  ) => void;
  mode?: 'SIV' | 'LPB';
  title?: string;
  subtitle?: string;
  replaceModeIndex?: number | null;
  availableLocations?: string[];
}

const PICKER_PAGE_SIZE = 50;

export const ItemPickerModal: React.FC<ItemPickerModalProps> = ({
  isOpen,
  onClose,
  stockItems,
  selectedItemIds,
  selectedQuantitiesMap = {},
  initialAllocationsMap = {},
  onSelectItem,
  onCreateNewMasterItem,
  mode = 'SIV',
  title = 'Pilih Item Barang dari Gudang',
  subtitle = 'Cari dan tentukan jumlah barang yang akan dimasukkan ke dokumen.',
  replaceModeIndex = null,
  availableLocations = ['Rak A-01', 'Rak A-02', 'Rak B-01', 'Rak B-02', 'Rak C-01'],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  // Quick New Master Item Form (for LPB mode)
  const [showNewItemForm, setShowNewItemForm] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Sparepart Mesin');
  const [newUnit, setNewUnit] = useState('Pcs');
  const [newMinStock, setNewMinStock] = useState(5);
  const [newLocation, setNewLocation] = useState(availableLocations[0] || 'Rak A-01');
  const [newReceiveQty, setNewReceiveQty] = useState(10);
  const [newItemError, setNewItemError] = useState('');

  const isLPBMode = mode === 'LPB';

  const selectedItemIdsSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

  // Unique categories
  const categories = useMemo(() => {
    return ['ALL', ...Array.from(new Set(stockItems.map((i) => i.category)))];
  }, [stockItems]);

  const filteredItems = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return stockItems.filter((item) => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    });
  }, [stockItems, selectedCategory, deferredSearchQuery]);

  // Reset page to 1 when search or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [deferredSearchQuery, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PICKER_PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * PICKER_PAGE_SIZE;
    return filteredItems.slice(startIdx, startIdx + PICKER_PAGE_SIZE);
  }, [filteredItems, safeCurrentPage]);

  if (!isOpen) return null;

  const getAvailableForSIV = (item: StockItem) => {
    const extraReservedByThisVoucher = initialAllocationsMap[item.id] || 0;
    return Math.max(0, item.currentStock - item.allocatedStock + extraReservedByThisVoucher);
  };

  const getQty = (item: StockItem) => {
    const val = quantities[item.id];
    if (isLPBMode) {
      return val !== undefined ? Math.max(1, val) : 1;
    }
    const available = getAvailableForSIV(item);
    if (val !== undefined) return Math.max(1, Math.min(val, Math.max(1, available)));
    return 1;
  };

  const handleQtyChange = (item: StockItem, val: number) => {
    if (isLPBMode) {
      const clamped = Math.max(1, val);
      setQuantities((prev) => ({ ...prev, [item.id]: clamped }));
    } else {
      const available = getAvailableForSIV(item);
      const clamped = Math.max(1, Math.min(val, Math.max(1, available)));
      setQuantities((prev) => ({ ...prev, [item.id]: clamped }));
    }
  };

  const handleConfirmSelect = (item: StockItem, closeAfter = false) => {
    const qty = getQty(item);
    onSelectItem(item, qty);
    if (replaceModeIndex !== null || closeAfter) {
      onClose();
    } else {
      setJustAddedId(item.id);
      setTimeout(() => {
        setJustAddedId((prev) => (prev === item.id ? null : prev));
      }, 1800);
    }
  };

  const handleOpenNewItemForm = () => {
    const suggestedCode =
      searchQuery.trim() && !searchQuery.includes(' ')
        ? searchQuery.trim().toUpperCase()
        : `MAT-${String(stockItems.length + 1).padStart(4, '0')}`;
    setNewSku(suggestedCode);
    setNewName(searchQuery.trim().includes(' ') ? searchQuery.trim() : '');
    setNewItemError('');
    setShowNewItemForm(true);
  };

  const handleCreateMasterAndSelect = (e: React.FormEvent) => {
    e.preventDefault();
    setNewItemError('');
    const cleanSku = newSku.trim().toUpperCase();
    const cleanName = newName.trim();

    if (!cleanSku) {
      setNewItemError('Material Code wajib diisi.');
      return;
    }
    if (!cleanName) {
      setNewItemError('Nama & spesifikasi barang wajib diisi.');
      return;
    }
    if (stockItems.some((s) => s.sku.toUpperCase() === cleanSku)) {
      setNewItemError(`Material Code "${cleanSku}" sudah terdaftar di katalog.`);
      return;
    }
    if (newReceiveQty <= 0) {
      setNewItemError('Jumlah diterima harus lebih dari 0.');
      return;
    }

    if (onCreateNewMasterItem) {
      onCreateNewMasterItem(
        {
          sku: cleanSku,
          name: cleanName,
          category: newCategory.trim() || 'Sparepart Mesin',
          unit: newUnit.trim() || 'Pcs',
          currentStock: 0,
          minStock: Math.max(0, Number(newMinStock) || 0),
          location: newLocation.trim() || 'Rak A-01',
          description: 'Didaftarkan langsung saat penerimaan LPB',
        },
        Math.max(1, Number(newReceiveQty) || 1)
      );
      setShowNewItemForm(false);
      setSearchQuery('');
      if (replaceModeIndex !== null) {
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 sm:px-6 py-3.5 text-white shrink-0 ${
            isLPBMode ? 'bg-emerald-950' : 'bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isLPBMode
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/20 border border-amber-500/30 text-amber-400'
              }`}
            >
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">{title}</h2>
              <p className="text-[11px] sm:text-xs text-slate-300">
                {replaceModeIndex !== null
                  ? `Pilih barang pengganti untuk Baris #${replaceModeIndex + 1}`
                  : subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBarcodeScanner((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-xs ${
                showBarcodeScanner
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
              }`}
            >
              <ScanBarcode className="w-3.5 h-3.5" />
              <span>{showBarcodeScanner ? 'Tutup Scanner' : 'Scan Barcode'}</span>
            </button>
            {isLPBMode && onCreateNewMasterItem && (
              <button
                type="button"
                onClick={() => (showNewItemForm ? setShowNewItemForm(false) : handleOpenNewItemForm())}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-xs"
              >
                <PackagePlus className="w-3.5 h-3.5" />
                <span>{showNewItemForm ? 'Tutup Form Baru' : '+ Barang Baru (Master)'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Inline Form for Creating New Master Item (LPB Mode) */}
        {showNewItemForm && onCreateNewMasterItem && (
          <form
            onSubmit={handleCreateMasterAndSelect}
            className="p-4 bg-emerald-50/90 border-b border-emerald-200 space-y-3 text-xs shrink-0"
          >
            <div className="flex items-center justify-between">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <PackagePlus className="w-4 h-4 text-emerald-700" />
                <span>Daftarkan Barang Baru ke Katalog Master & Masukkan ke LPB</span>
              </div>
              <button
                type="button"
                onClick={() => setShowNewItemForm(false)}
                className="text-slate-500 hover:text-slate-800 font-medium"
              >
                Batal
              </button>
            </div>

            {newItemError && (
              <div className="p-2 bg-red-100 border border-red-300 text-red-800 rounded-lg text-[11px] font-medium">
                {newItemError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Material Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                  placeholder="Misal: BRG-6205-ZZ"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono uppercase text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Nama & Spesifikasi Barang <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Misal: Deep Groove Ball Bearing SKF 6205-2RS"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Kategori</label>
                <input
                  type="text"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Misal: Mechanical / Elektrikal"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Satuan</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    {['Pcs', 'Set', 'Unit', 'Box', 'Roll', 'Meter', 'Liter', 'Kaleng', 'Kg', 'Pasang'].map(
                      (u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      )
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Stok Min</label>
                  <input
                    type="number"
                    min="0"
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Rak Simpan</label>
                  <select
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    {availableLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-emerald-800 mb-1">
                    Qty Diterima <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newReceiveQty}
                    onChange={(e) => setNewReceiveQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2 py-1.5 bg-white border border-emerald-400 rounded-lg font-mono font-bold text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-lg shadow-xs transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan Master & Masukkan ke LPB</span>
              </button>
            </div>
          </form>
        )}

        {/* Barcode Scanner inside Catalog Modal */}
        {showBarcodeScanner && (
          <div className="px-3 sm:px-4 pt-3 bg-slate-100 border-b border-slate-200 shrink-0">
            <BarcodeAddScannerPanel
              mode={mode}
              stockItems={stockItems}
              initialAllocationsMap={initialAllocationsMap}
              selectedQuantitiesMap={selectedQuantitiesMap}
              onBarcodeAddItem={(item, qty) => {
                onSelectItem(item, qty);
                if (replaceModeIndex !== null) {
                  onClose();
                } else {
                  setJustAddedId(item.id);
                  setTimeout(() => {
                    setJustAddedId((prev) => (prev === item.id ? null : prev));
                  }, 1800);
                }
              }}
              onUnrecognizedBarcodeInLPB={
                isLPBMode && onCreateNewMasterItem
                  ? (scannedCode, qty) => {
                      setNewSku(scannedCode);
                      setNewReceiveQty(qty);
                      setShowNewItemForm(true);
                      setShowBarcodeScanner(false);
                    }
                  : undefined
              }
              onClose={() => setShowBarcodeScanner(false)}
            />
          </div>
        )}

        {/* Search & Category Filter Bar */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus={!showNewItemForm && !showBarcodeScanner}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  e.preventDefault();
                  const clean = searchQuery.trim().toUpperCase();
                  const exactMatch = stockItems.find((s) => s.sku.toUpperCase() === clean);
                  const target =
                    exactMatch || (filteredItems.length === 1 ? filteredItems[0] : null);
                  if (target) {
                    if (!isLPBMode && getAvailableForSIV(target) <= 0) return;
                    handleConfirmSelect(target, false);
                    setSearchQuery('');
                  }
                }
              }}
              placeholder="Scan Barcode (Enter) atau ketik Material Code, nama barang, rak, atau spesifikasi..."
              className="w-full pl-9 pr-16 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-medium"
              >
                Reset
              </button>
            )}
          </div>

          {/* Categories Tab Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 font-medium rounded-lg whitespace-nowrap transition-colors text-xs ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {cat === 'ALL' ? 'Semua Kategori' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Item List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-slate-500 text-xs">
                Tidak ada barang yang cocok dengan pencarian <strong>"{searchQuery}"</strong>.
              </p>
              {isLPBMode && onCreateNewMasterItem && !showNewItemForm && (
                <button
                  type="button"
                  onClick={handleOpenNewItemForm}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <PackagePlus className="w-4 h-4" />
                  <span>+ Daftarkan "{searchQuery || 'Barang Baru'}" ke Master Stok</span>
                </button>
              )}
            </div>
          ) : (
            paginatedItems.map((item) => {
              const available = getAvailableForSIV(item);
              const isOutOfStockForSIV = !isLPBMode && available <= 0;
              const isAlreadySelected = selectedItemIdsSet.has(item.id);
              const existingQtyInDoc = selectedQuantitiesMap[item.id] || 0;
              const currentQty = getQty(item);
              const wasJustAdded = justAddedId === item.id;

              return (
                <div
                  key={item.id}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col gap-3 ${
                    isOutOfStockForSIV
                      ? 'bg-slate-50 border-slate-200 opacity-60'
                      : isAlreadySelected
                      ? 'bg-amber-50/40 border-amber-300'
                      : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                  }`}
                >
                  {/* Top: Info Row */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold bg-slate-100 text-slate-900 px-2 py-0.5 rounded">
                          {item.sku}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500">{item.category}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-600 flex items-center gap-1 font-mono">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {item.location}
                        </span>
                        {isAlreadySelected && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md border border-amber-300">
                            <CheckCircle2 className="w-3 h-3 text-amber-700" />
                            <span>
                              Sudah di daftar{existingQtyInDoc > 0 ? `: ${existingQtyInDoc} ${item.unit}` : ''}
                            </span>
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                        {item.name}
                      </h4>

                      {item.description && (
                        <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
                      )}

                      {/* Stock status indicator */}
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs pt-1">
                        <span className="text-slate-500">
                          Fisik di rak: <strong>{item.currentStock} {item.unit}</strong>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-700 font-medium">
                          Stok Min: <strong className="font-mono text-slate-900">{item.minStock} {item.unit}</strong>
                        </span>
                        {item.allocatedStock > 0 && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="text-amber-700">
                              Dialokasikan: {item.allocatedStock} {item.unit}
                            </span>
                          </>
                        )}
                        <span className="text-slate-300">·</span>
                        <span
                          className={`font-semibold font-mono tabular-nums ${
                            available > 5
                              ? 'text-emerald-700'
                              : available > 0
                              ? 'text-amber-700'
                              : 'text-red-600'
                          }`}
                        >
                          Siap Diambil: {available} {item.unit}
                        </span>
                      </div>
                    </div>

                    {/* Stock Badge */}
                    <div className="shrink-0 self-start sm:self-auto">
                      {isLPBMode ? (
                        <span className="text-xs font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                          Stok Saat Ini: {item.currentStock} {item.unit}
                        </span>
                      ) : isOutOfStockForSIV ? (
                        <span className="text-xs font-semibold text-red-600 px-2.5 py-1 bg-red-50 rounded-lg border border-red-200">
                          Stok Habis
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                          Maks: {available} {item.unit}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bottom: Quantity Entry & Action Bar */}
                  {!isOutOfStockForSIV && (
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-2.5 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">
                          {isLPBMode ? 'Jumlah Diterima (Masuk):' : 'Jumlah Diambil (Keluar):'}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {isLPBMode ? `(Satuan: ${item.unit})` : `(Maks. ${available} ${item.unit})`}
                        </span>
                      </div>

                      {/* Stepper + Select Action Button */}
                      <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                        {/* Quick Presets */}
                        {isLPBMode ? (
                          <div className="hidden sm:flex items-center gap-1">
                            {[1, 5, 10, 25, 50, 100].map((presetVal) => (
                              <button
                                key={presetVal}
                                type="button"
                                onClick={() => handleQtyChange(item, presetVal)}
                                className={`px-2 py-1 text-[10px] font-semibold border rounded transition-colors ${
                                  currentQty === presetVal
                                    ? 'bg-emerald-700 text-white border-emerald-700'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                {presetVal}
                              </button>
                            ))}
                          </div>
                        ) : (
                          available >= 2 && (
                            <div className="hidden sm:flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleQtyChange(item, 1)}
                                className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 rounded hover:bg-slate-100"
                              >
                                1
                              </button>
                              {available >= 4 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleQtyChange(item, Math.max(1, Math.floor(available / 2)))
                                  }
                                  className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 rounded hover:bg-slate-100"
                                >
                                  50%
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleQtyChange(item, available)}
                                className="px-2 py-1 text-[10px] font-semibold bg-white border border-slate-200 rounded hover:bg-slate-100"
                              >
                                Maks ({available})
                              </button>
                            </div>
                          )
                        )}

                        {/* Plus / Minus Stepper */}
                        <div className="flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => handleQtyChange(item, currentQty - 1)}
                            disabled={currentQty <= 1}
                            className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={isLPBMode ? undefined : available}
                            value={currentQty}
                            onChange={(e) => {
                              const parsed = parseInt(e.target.value, 10);
                              if (!isNaN(parsed)) {
                                handleQtyChange(item, parsed);
                              }
                            }}
                            className="w-14 py-1 text-center font-mono font-bold text-xs focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => handleQtyChange(item, currentQty + 1)}
                            disabled={!isLPBMode && currentQty >= available}
                            className="px-2.5 py-1.5 text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Select Button */}
                        {replaceModeIndex !== null ? (
                          <button
                            type="button"
                            onClick={() => handleConfirmSelect(item, true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Pilih Pengganti</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmSelect(item, false)}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs ${
                                wasJustAdded
                                  ? 'bg-emerald-600 text-white'
                                  : isAlreadySelected
                                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                  : isLPBMode
                                  ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                                  : 'bg-slate-900 hover:bg-slate-800 text-white'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>
                                {wasJustAdded
                                  ? 'Ditambahkan!'
                                  : isAlreadySelected
                                  ? `+ Tambah (${currentQty})`
                                  : '+ Tambah'}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-2 text-slate-600 text-[11px] sm:text-xs">
            <span>
              Menampilkan{' '}
              <strong>
                {filteredItems.length === 0
                  ? 0
                  : (safeCurrentPage - 1) * PICKER_PAGE_SIZE + 1}
                &ndash;
                {Math.min(safeCurrentPage * PICKER_PAGE_SIZE, filteredItems.length)}
              </strong>{' '}
              dari <strong>{filteredItems.length}</strong> barang (Total: {stockItems.length})
            </span>
            {selectedItemIds.length > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-semibold text-emerald-700">
                  {selectedItemIds.length} Barang terpilih di dokumen
                </span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {totalPages > 1 && (
              <div className="flex items-center gap-1 mr-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  title="Halaman sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 py-1 font-mono font-semibold text-slate-700">
                  Hal {safeCurrentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                  title="Halaman berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
            >
              Selesai & Kembali ke Form ({selectedItemIds.length} Item)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
