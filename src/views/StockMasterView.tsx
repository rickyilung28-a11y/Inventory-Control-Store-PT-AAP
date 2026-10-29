import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  StockItem,
  StockCategory,
  MovementVelocityCategory,
  getEffectivePermissions,
  getRoleHierarchyLevel,
  getItemCategories,
} from '../types/inventory';
import {
  Boxes,
  Search,
  MapPin,
  AlertTriangle,
  Plus,
  ClipboardList,
  X,
  Edit,
  Trash2,
  FileSpreadsheet,
  Barcode,
  ShieldAlert,
  TrendingDown,
  Flame,
  Activity,
  Gauge,
  Layers,
  Download,
  ScanBarcode,
  ArrowRightLeft,
  CheckCircle2,
  Lock,
  ChevronLeft,
  ChevronRight,
  Tags,
  Check,
} from 'lucide-react';
import { ImportStockItemsModal } from '../components/ImportStockItemsModal';
import { ThermalLabelDesignerModal } from '../components/ThermalLabelDesignerModal';
import { BarcodeScannerLookupModal } from '../components/BarcodeScannerLookupModal';
import { SapExportModal } from '../components/SapExportModal';
import { exportStockMasterToExcel } from '../utils/sqlAndExcelExport';

interface StockMasterViewProps {
  onViewLedgerItem: (sku: string) => void;
  onNavigateToMinStock?: () => void;
}

export const StockMasterView: React.FC<StockMasterViewProps> = ({
  onViewLedgerItem,
  onNavigateToMinStock,
}) => {
  const {
    stockItems,
    currentUser,
    storageLocations,
    stockCategories,
    lpbDocuments,
    issueVouchers,
    costCenters,
    glAccounts,
    addStockCategory,
    updateStockCategory,
    deleteStockCategory,
    minStockProposals,
    addNewStockItem,
    updateStockItem,
    deleteStockItem,
    getItemMovementAnalytics,
    isStockLockedForOpname,
    activeStockOpname,
    locationTransferRequests,
    createLocationTransferRequest,
    approveLocationTransferRequest,
    rejectLocationTransferRequest,
  } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [nameFilter, setNameFilter] = useState('');
  const [skuFilter, setSkuFilter] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<
    'ALL' | 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  >('ALL');
  const [selectedVelocity, setSelectedVelocity] = useState<'ALL' | MovementVelocityCategory>('ALL');

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredNameFilter = useDeferredValue(nameFilter);
  const deferredSkuFilter = useDeferredValue(skuFilter);

  const [viewMode, setViewMode] = useState<'table' | 'submaster'>('table');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [isSapExportModalOpen, setIsSapExportModalOpen] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isScannerLookupOpen, setIsScannerLookupOpen] = useState(false);

  // Location Transfer Request Modal State
  const [itemToTransferLoc, setItemToTransferLoc] = useState<StockItem | null>(null);
  const [transferTargetRack, setTransferTargetRack] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferError, setTransferError] = useState('');

  // Barcode Thermal Clabel Modal state
  const [isBarcodeThermalOpen, setIsBarcodeThermalOpen] = useState(false);
  const [itemsToPrintBarcode, setItemsToPrintBarcode] = useState<StockItem[]>([]);

  // Edit Item Modal State
  const [itemToEdit, setItemToEdit] = useState<StockItem | null>(null);
  const [editSku, setEditSku] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [editUnit, setEditUnit] = useState('');
  const [editMinStock, setEditMinStock] = useState(0);
  const [editLocation, setEditLocation] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Delete Confirmation Modal State
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);
  const [deleteError, setDeleteError] = useState('');

  // Add Item Form State
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Sparepart Mesin');
  const [newCategories, setNewCategories] = useState<string[]>(['Sparepart Mesin']);
  const [newUnit, setNewUnit] = useState('Pcs');
  const [newMinStock, setNewMinStock] = useState(5);
  const [newInitialStock, setNewInitialStock] = useState(0);
  const [newLocation, setNewLocation] = useState('Rak A-01');
  const [newDescription, setNewDescription] = useState('');

  // Category Management Modal State (Admin CRUD Kategori)
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [catFormName, setCatFormName] = useState('');
  const [catFormDescription, setCatFormDescription] = useState('');
  const [catFormColor, setCatFormColor] = useState('blue');
  const [editingCategory, setEditingCategory] = useState<StockCategory | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDescription, setEditCatDescription] = useState('');
  const [editCatColor, setEditCatColor] = useState('blue');
  const [categoryToDelete, setCategoryToDelete] = useState<StockCategory | null>(null);
  const [categoryFormError, setCategoryFormError] = useState('');
  const [inlineNewCatInput, setInlineNewCatInput] = useState('');

  const perms = getEffectivePermissions(currentUser);
  const isKepalaGudang = perms.canApproveMinStockSystem;
  const isAdmin = perms.canManageStockItems;
  const canExportSap =
    currentUser?.role === 'superuser' ||
    currentUser?.role === 'kepala_gudang' ||
    currentUser?.role === 'admin';
  const userLevel = currentUser ? getRoleHierarchyLevel(currentUser.role) : 99;
  const canApproveLocationTransfer =
    userLevel <= 1 ||
    currentUser?.role === 'kepala_gudang' ||
    currentUser?.role === 'superuser';

  // Unique categories & locations with counts (combines stockCategories master + any item categories)
  const allCategoryNames = useMemo(() => {
    const map = new Map<string, string>();
    stockCategories.forEach((c) => {
      if (c.name && c.name.trim()) {
        map.set(c.name.trim().toLowerCase(), c.name.trim());
      }
    });
    stockItems.forEach((item) => {
      getItemCategories(item).forEach((catName) => {
        const key = catName.toLowerCase();
        if (!map.has(key)) {
          map.set(key, catName);
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [stockCategories, stockItems]);

  const categories = useMemo(() => {
    return ['ALL', ...allCategoryNames];
  }, [allCategoryNames]);

  const categoryItemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    stockItems.forEach((item) => {
      getItemCategories(item).forEach((catName) => {
        const key = catName.toLowerCase();
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
    return counts;
  }, [stockItems]);

  const locationOptions = useMemo(() => {
    const locs = Array.from(new Set(stockItems.map((i) => i.location).filter(Boolean))).sort();
    return ['ALL', ...locs];
  }, [stockItems]);

  const hasActiveStockFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(nameFilter.trim()) ||
    Boolean(skuFilter.trim()) ||
    selectedCategory !== 'ALL' ||
    selectedLocation !== 'ALL' ||
    stockStatusFilter !== 'ALL' ||
    selectedVelocity !== 'ALL';

  const resetAllStockFilters = () => {
    setSearchQuery('');
    setNameFilter('');
    setSkuFilter('');
    setSelectedCategory('ALL');
    setSelectedLocation('ALL');
    setStockStatusFilter('ALL');
    setSelectedVelocity('ALL');
  };

  // Movement Velocity Summary Counts
  const velocitySummary = useMemo(() => {
    let fast = 0;
    let medium = 0;
    let low = 0;
    stockItems.forEach((item) => {
      const m = getItemMovementAnalytics(item.id);
      if (m.velocityCategory === 'FAST_MOVING') fast++;
      else if (m.velocityCategory === 'MEDIUM_MOVING') medium++;
      else low++;
    });
    return { fast, medium, low };
  }, [stockItems, getItemMovementAnalytics]);

  // Filtered items (using deferred values so typing stays instant on 4,600+ items)
  const filteredItems = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    const qName = deferredNameFilter.trim().toLowerCase();
    const qSku = deferredSkuFilter.trim().toLowerCase();

    return stockItems.filter((item) => {
      const itemCats = getItemCategories(item);
      if (
        selectedCategory !== 'ALL' &&
        !itemCats.some((c) => c.toLowerCase() === selectedCategory.toLowerCase())
      ) {
        return false;
      }
      if (selectedLocation !== 'ALL' && item.location !== selectedLocation) return false;

      if (stockStatusFilter !== 'ALL') {
        const available = item.currentStock - item.allocatedStock;
        if (stockStatusFilter === 'AVAILABLE' && available <= 0) return false;
        if (stockStatusFilter === 'LOW_STOCK' && item.currentStock > item.minStock) return false;
        if (stockStatusFilter === 'OUT_OF_STOCK' && available > 0) return false;
      }

      if (selectedVelocity !== 'ALL') {
        const movement = getItemMovementAnalytics(item.id, item.sku);
        if (movement.velocityCategory !== selectedVelocity) return false;
      }

      if (qName && !item.name.toLowerCase().includes(qName)) return false;
      if (qSku && !item.sku.toLowerCase().includes(qSku)) return false;

      if (!q) return true;
      return (
        item.sku.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        itemCats.some((c) => c.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    });
  }, [
    stockItems,
    selectedCategory,
    selectedLocation,
    stockStatusFilter,
    selectedVelocity,
    deferredSearchQuery,
    deferredNameFilter,
    deferredSkuFilter,
    getItemMovementAnalytics,
  ]);

  // Reset pagination to page 1 when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    deferredSearchQuery,
    deferredNameFilter,
    deferredSkuFilter,
    selectedCategory,
    selectedLocation,
    stockStatusFilter,
    selectedVelocity,
    itemsPerPage,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredItems, safeCurrentPage, itemsPerPage]);

  // Grouped Sub-Master by Category (supports multi-category items appearing in each associated category group)
  const groupedSubMaster = useMemo(() => {
    const groups = new Map<string, StockItem[]>();
    paginatedItems.forEach((item) => {
      const itemCats = getItemCategories(item);
      itemCats.forEach((catName) => {
        if (
          selectedCategory !== 'ALL' &&
          catName.toLowerCase() !== selectedCategory.toLowerCase()
        ) {
          return;
        }
        const list = groups.get(catName) || [];
        list.push(item);
        groups.set(catName, list);
      });
    });
    return Array.from(groups.entries());
  }, [paginatedItems, selectedCategory]);

  const toggleCategoryInList = (list: string[], catName: string): string[] => {
    const exists = list.some((c) => c.toLowerCase() === catName.toLowerCase());
    if (exists) {
      if (list.length <= 1) return list; // Minimal 1 kategori terpilih
      return list.filter((c) => c.toLowerCase() !== catName.toLowerCase());
    }
    return [...list, catName];
  };

  // Open Edit Modal with pre-filled values
  const handleOpenEdit = (item: StockItem) => {
    const cats = getItemCategories(item);
    setItemToEdit(item);
    setEditSku(item.sku);
    setEditName(item.name);
    setEditCategory(cats.join(', '));
    setEditCategories(cats);
    setEditUnit(item.unit);
    setEditMinStock(item.minStock);
    setEditLocation(item.location);
    setEditDescription(item.description || '');
    setInlineNewCatInput('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToEdit || !editSku.trim() || !editName.trim()) return;
    const finalCats = editCategories.length > 0 ? editCategories : [editCategory || 'Sparepart Mesin'];

    updateStockItem(itemToEdit.id, {
      sku: editSku.trim(),
      name: editName.trim(),
      category: finalCats.join(', '),
      categories: finalCats,
      unit: editUnit.trim(),
      minStock: Number(editMinStock),
      location: editLocation.trim(),
      description: editDescription.trim(),
    });

    setItemToEdit(null);
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    const res = deleteStockItem(itemToDelete.id);
    if (!res.success) {
      setDeleteError(res.error || 'Gagal menghapus barang.');
    } else {
      setItemToDelete(null);
      setDeleteError('');
    }
  };

  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku.trim() || !newName.trim()) return;
    const finalCats = newCategories.length > 0 ? newCategories : [newCategory || 'Sparepart Mesin'];

    addNewStockItem({
      sku: newSku.trim(),
      name: newName.trim(),
      category: finalCats.join(', '),
      categories: finalCats,
      unit: newUnit,
      minStock: Number(newMinStock),
      currentStock: Number(newInitialStock),
      location: newLocation,
      description: newDescription,
    });

    setIsAddModalOpen(false);
    setNewSku('');
    setNewName('');
    setNewInitialStock(0);
    setNewDescription('');
    setInlineNewCatInput('');
  };

  // Handlers for Category Manager Modal (Admin CRUD Kategori)
  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryFormError('');
    const res = addStockCategory({
      name: catFormName,
      description: catFormDescription,
      color: catFormColor,
    });
    if (!res.success) {
      setCategoryFormError(res.error || 'Gagal menambahkan kategori.');
      return;
    }
    setCatFormName('');
    setCatFormDescription('');
    setCatFormColor('blue');
  };

  const handleStartEditCategory = (cat: StockCategory) => {
    setEditingCategory(cat);
    setEditCatName(cat.name);
    setEditCatDescription(cat.description || '');
    setEditCatColor(cat.color || 'blue');
    setCategoryFormError('');
  };

  const handleSaveEditCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setCategoryFormError('');
    const oldName = editingCategory.name;
    const res = updateStockCategory(editingCategory.id, {
      name: editCatName,
      description: editCatDescription,
      color: editCatColor,
    });
    if (!res.success) {
      setCategoryFormError(res.error || 'Gagal memperbarui kategori.');
      return;
    }
    if (selectedCategory.toLowerCase() === oldName.toLowerCase()) {
      setSelectedCategory(editCatName.trim());
    }
    setEditingCategory(null);
  };

  const handleConfirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    setCategoryFormError('');
    const removedName = categoryToDelete.name;
    const res = deleteStockCategory(categoryToDelete.id);
    if (!res.success) {
      setCategoryFormError(res.error || 'Gagal menghapus kategori.');
      return;
    }
    if (selectedCategory.toLowerCase() === removedName.toLowerCase()) {
      setSelectedCategory('ALL');
    }
    setCategoryToDelete(null);
  };

  const handleQuickAddInlineCategory = (mode: 'add' | 'edit') => {
    const clean = inlineNewCatInput.trim();
    if (!clean) return;
    const res = addStockCategory({ name: clean, color: 'blue' });
    const targetName = res.category?.name || clean;
    if (mode === 'add') {
      setNewCategories((prev) =>
        prev.some((c) => c.toLowerCase() === targetName.toLowerCase())
          ? prev
          : [...prev, targetName]
      );
    } else {
      setEditCategories((prev) =>
        prev.some((c) => c.toLowerCase() === targetName.toLowerCase())
          ? prev
          : [...prev, targetName]
      );
    }
    setInlineNewCatInput('');
  };

  // Stock alert calculations: Melampaui (<= minStock) vs Mendekati (> minStock and <= minStock + margin)
  const criticalItems = useMemo(() => {
    return stockItems.filter((item) => item.currentStock <= item.minStock);
  }, [stockItems]);

  const approachingItems = useMemo(() => {
    return stockItems.filter((item) => {
      if (item.currentStock <= item.minStock) return false;
      const buffer = Math.max(3, Math.round(item.minStock * 0.35));
      return item.currentStock <= item.minStock + buffer;
    });
  }, [stockItems]);

  const pendingMinProposalsCount = useMemo(() => {
    return minStockProposals.filter((p) => p.status === 'PENDING').length;
  }, [minStockProposals]);

  const pendingLocationTransfers = useMemo(
    () => locationTransferRequests.filter((r) => r.status === 'PENDING_KEPALA'),
    [locationTransferRequests]
  );

  const handleOpenTransferLocation = (item: StockItem) => {
    setItemToTransferLoc(item);
    const nextRack = storageLocations.find((l) => l.code !== item.location);
    setTransferTargetRack(nextRack?.code || storageLocations[0]?.code || '');
    setTransferReason('');
    setTransferError('');
  };

  const handleSubmitTransferLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToTransferLoc) return;
    setTransferError('');
    const res = createLocationTransferRequest({
      itemId: itemToTransferLoc.id,
      toLocation: transferTargetRack,
      reason: transferReason,
    });
    if (!res.success) {
      setTransferError(res.error || 'Gagal mengajukan pindah lokasi rak.');
      return;
    }
    setItemToTransferLoc(null);
  };

  const renderVelocityBadge = (itemId: string) => {
    const m = getItemMovementAnalytics(itemId);
    if (m.velocityCategory === 'FAST_MOVING') {
      return (
        <div className="inline-flex flex-col items-center">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-orange-100 text-orange-900 border border-orange-300 whitespace-nowrap">
            <Flame className="w-3 h-3 text-orange-600" />
            <span>Fast Moving</span>
          </span>
          <span className="text-[10px] font-mono text-slate-500 mt-0.5">
            Keluar: {m.totalOutQty} ({m.outFrequency}x)
          </span>
        </div>
      );
    }
    if (m.velocityCategory === 'MEDIUM_MOVING') {
      return (
        <div className="inline-flex flex-col items-center">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-900 border border-blue-300 whitespace-nowrap">
            <Activity className="w-3 h-3 text-blue-600" />
            <span>Medium Moving</span>
          </span>
          <span className="text-[10px] font-mono text-slate-500 mt-0.5">
            Keluar: {m.totalOutQty} ({m.outFrequency}x)
          </span>
        </div>
      );
    }
    return (
      <div className="inline-flex flex-col items-center">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap">
          <Gauge className="w-3 h-3 text-slate-500" />
          <span>Low Moving</span>
        </span>
        <span className="text-[10px] font-mono text-slate-400 mt-0.5">
          Keluar: {m.totalOutQty} ({m.outFrequency}x)
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Banner Lock Stock Opname */}
      {isStockLockedForOpname && activeStockOpname && (
        <div className="p-4 rounded-xl bg-amber-950 text-white border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-amber-300">
                STOK STORE SEDANG DI-LOCK — Sesi Stock Opname Aktif ({activeStockOpname.opnameNumber})
              </h3>
              <p className="text-[11px] text-slate-300">
                Dimulai oleh <strong>{activeStockOpname.startedBy}</strong>. Penambahan &amp; pengurangan stok dikunci hingga Stock Opname diselesaikan.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Banner Pengajuan Pindah Lokasi Rak Menunggu ACC Kepala Store */}
      {pendingLocationTransfers.length > 0 && (
        <div className="bg-white rounded-xl border border-indigo-200 shadow-2xs overflow-hidden">
          <div className="px-4 py-2.5 bg-indigo-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold">
              <ArrowRightLeft className="w-4 h-4 text-amber-400" />
              <span>
                Pengajuan Pindah Lokasi Rak Barang ({pendingLocationTransfers.length} Menunggu ACC Kepala Store)
              </span>
            </div>
          </div>
          <div className="p-3 divide-y divide-slate-100 text-xs">
            {pendingLocationTransfers.map((req) => (
              <div
                key={req.id}
                className="py-2 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <span className="font-mono font-bold text-slate-900 mr-1.5">{req.requestNumber}:</span>
                  <span className="font-bold text-indigo-700">{req.sku}</span> ({req.itemName}) &mdash; Pindah dari{' '}
                  <span className="font-mono font-bold px-1.5 py-0.5 bg-slate-100 rounded">{req.fromLocation}</span> ke{' '}
                  <span className="font-mono font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-900 rounded">
                    {req.toLocation}
                  </span>{' '}
                  <span className="text-slate-500">({req.reason} • Oleh: {req.requestedBy})</span>
                </div>
                {canApproveLocationTransfer ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => approveLocationTransferRequest(req.id)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>ACC Kepala Store</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectLocationTransferRequest(req.id, 'Ditolak oleh Kepala Store')}
                      className="px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-[11px]"
                    >
                      Tolak
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                    Menunggu ACC Kepala Store
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Peringatan Stock Mendekati / Melampaui Batas Minimum */}
      {(criticalItems.length > 0 || approachingItems.length > 0) && (
        <div className="bg-white rounded-xl border border-red-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-red-600 via-red-500 to-amber-500 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 shrink-0 animate-bounce" />
              <div>
                <h3 className="text-xs sm:text-sm font-bold">
                  Peringatan Saldo Stok Minimum Store ({criticalItems.length} Melampaui Batas, {approachingItems.length} Mendekati Batas)
                </h3>
                <p className="text-[11px] text-red-50">
                  Segera lakukan restock (LPB) atau ajukan penyesuaian batas stok minimum untuk mencegah kehabisan suku cadang.
                </p>
              </div>
            </div>
            {onNavigateToMinStock && (
              <button
                onClick={onNavigateToMinStock}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white text-red-900 hover:bg-red-50 font-bold text-xs rounded-lg shadow-xs shrink-0 self-start sm:self-auto transition-colors"
              >
                <span>Buka Tabel Stock Minimal</span>
                {pendingMinProposalsCount > 0 && (
                  <span className="px-1.5 py-0.2 bg-red-600 text-white rounded-full text-[10px]">
                    {pendingMinProposalsCount} Pending
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="p-3 bg-red-50/40 grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {criticalItems.length > 0 && (
              <div className="p-2.5 bg-white rounded-lg border border-red-200 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-red-900">
                    Melampaui / Di Bawah Stock Minimal ({criticalItems.length} Barang)
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {criticalItems.slice(0, 15).map((i) => (
                      <span
                        key={i.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-900 font-mono text-[11px] font-semibold border border-red-200"
                      >
                        {i.sku}: {i.currentStock}/{i.minStock} {i.unit}
                      </span>
                    ))}
                    {criticalItems.length > 15 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-200 text-red-950 font-mono text-[11px] font-bold">
                        +{criticalItems.length - 15} barang kritis lainnya
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {approachingItems.length > 0 && (
              <div className="p-2.5 bg-white rounded-lg border border-amber-200 flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-amber-900">
                    Mendekati Stock Minimal ({approachingItems.length} Barang)
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {approachingItems.slice(0, 15).map((i) => (
                      <span
                        key={i.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[11px] font-semibold border border-amber-200"
                      >
                        {i.sku}: {i.currentStock} (Min: {i.minStock} {i.unit})
                      </span>
                    ))}
                    {approachingItems.length > 15 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-mono text-[11px] font-bold">
                        +{approachingItems.length - 15} barang lainnya
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analisa Kategori Keluar Barang (Fast Moving, Medium Moving, Low Moving) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setSelectedVelocity('ALL')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
            selectedVelocity === 'ALL'
              ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div>
            <p className={`text-[11px] font-semibold uppercase ${selectedVelocity === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
              Total Semua Barang
            </p>
            <p className="text-xl font-bold font-mono mt-0.5">{stockItems.length} Material Code</p>
            <p className={`text-[10.5px] mt-0.5 ${selectedVelocity === 'ALL' ? 'text-slate-300' : 'text-slate-500'}`}>
              Semua kategori pergerakan
            </p>
          </div>
          <Boxes className={`w-7 h-7 ${selectedVelocity === 'ALL' ? 'text-amber-400' : 'text-slate-400'}`} />
        </button>

        <button
          type="button"
          onClick={() => setSelectedVelocity(selectedVelocity === 'FAST_MOVING' ? 'ALL' : 'FAST_MOVING')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
            selectedVelocity === 'FAST_MOVING'
              ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
              : 'bg-white text-slate-800 border-orange-200 hover:bg-orange-50/40'
          }`}
        >
          <div>
            <p className={`text-[11px] font-bold uppercase ${selectedVelocity === 'FAST_MOVING' ? 'text-orange-100' : 'text-orange-700'}`}>
              Fast Moving (Cepat)
            </p>
            <p className="text-xl font-bold font-mono mt-0.5">{velocitySummary.fast} Material Code</p>
            <p className={`text-[10.5px] mt-0.5 ${selectedVelocity === 'FAST_MOVING' ? 'text-orange-100' : 'text-slate-500'}`}>
              Tingkat keluar barang tinggi
            </p>
          </div>
          <Flame className={`w-7 h-7 ${selectedVelocity === 'FAST_MOVING' ? 'text-white' : 'text-orange-500'}`} />
        </button>

        <button
          type="button"
          onClick={() => setSelectedVelocity(selectedVelocity === 'MEDIUM_MOVING' ? 'ALL' : 'MEDIUM_MOVING')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
            selectedVelocity === 'MEDIUM_MOVING'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-slate-800 border-blue-200 hover:bg-blue-50/40'
          }`}
        >
          <div>
            <p className={`text-[11px] font-bold uppercase ${selectedVelocity === 'MEDIUM_MOVING' ? 'text-blue-100' : 'text-blue-700'}`}>
              Medium Moving (Sedang)
            </p>
            <p className="text-xl font-bold font-mono mt-0.5">{velocitySummary.medium} Material Code</p>
            <p className={`text-[10.5px] mt-0.5 ${selectedVelocity === 'MEDIUM_MOVING' ? 'text-blue-100' : 'text-slate-500'}`}>
              Pergerakan keluar moderat
            </p>
          </div>
          <Activity className={`w-7 h-7 ${selectedVelocity === 'MEDIUM_MOVING' ? 'text-white' : 'text-blue-500'}`} />
        </button>

        <button
          type="button"
          onClick={() => setSelectedVelocity(selectedVelocity === 'LOW_MOVING' ? 'ALL' : 'LOW_MOVING')}
          className={`p-3.5 rounded-xl border text-left transition-all flex items-center justify-between ${
            selectedVelocity === 'LOW_MOVING'
              ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div>
            <p className={`text-[11px] font-bold uppercase ${selectedVelocity === 'LOW_MOVING' ? 'text-slate-200' : 'text-slate-600'}`}>
              Low Moving (Lambat)
            </p>
            <p className="text-xl font-bold font-mono mt-0.5">{velocitySummary.low} Material Code</p>
            <p className={`text-[10.5px] mt-0.5 ${selectedVelocity === 'LOW_MOVING' ? 'text-slate-200' : 'text-slate-500'}`}>
              Jarang keluar / slow moving
            </p>
          </div>
          <Gauge className={`w-7 h-7 ${selectedVelocity === 'LOW_MOVING' ? 'text-white' : 'text-slate-400'}`} />
        </button>
      </div>

      {/* Top Header & Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-slate-700" />
              <span>Katalog Master &amp; Sub-Master Stok Store</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau stok fisik, batas stok minimum (Safety Stock), pindah lokasi rak, scan barcode barang/rak, serta export master ke Excel.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {/* Toggle Tampilan Tabel vs Sub-Master */}
            <div className="inline-flex items-center p-0.5 bg-slate-100 border border-slate-200 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabel Utama
              </button>
              <button
                type="button"
                onClick={() => setViewMode('submaster')}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md font-semibold transition-colors ${
                  viewMode === 'submaster' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Sub-Master Kategori</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsScannerLookupOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
              title="Scan Barcode Barang (Material Code) atau Barcode Lokasi Rak"
            >
              <ScanBarcode className="w-4 h-4" />
              <span>Scan Barcode Barang &amp; Rak</span>
            </button>

            {canExportSap && (
              <>
                <button
                  type="button"
                  onClick={() => exportStockMasterToExcel(stockItems, getItemMovementAnalytics)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
                  title="Export Master Stok Barang & Sub-Master Kategori ke File Excel (.xlsx)"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  <span>Export Master Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSapExportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-blue-950 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  title="Export Master Material & Saldo Stok ke format Excel (.xlsx) atau CSV (.csv) untuk Import Sistem SAP (MM01 / MB52 / Mvt 561)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                  <span>Export SAP (.xlsx / .csv)</span>
                </button>
              </>
            )}

            <button
              onClick={() => {
                const sourceList = filteredItems.length > 0 ? filteredItems : stockItems;
                setItemsToPrintBarcode(sourceList.slice(0, 100));
                setIsBarcodeThermalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-xs"
              title="Preview & cetak stiker barcode thermal Clabel dengan template ukuran kertas"
            >
              <Barcode className="w-4 h-4 text-slate-950" />
              <span>Preview &amp; Cetak Barcode</span>
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFormError('');
                    setEditingCategory(null);
                    setCategoryToDelete(null);
                    setIsCategoryManagerOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 rounded-lg transition-colors shadow-2xs"
                  title="Buat, edit, dan hapus master kategori barang stok"
                >
                  <Tags className="w-4 h-4 text-indigo-600" />
                  <span>Kelola Kategori ({stockCategories.length})</span>
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  disabled={isStockLockedForOpname}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Import Excel</span>
                </button>
                <button
                  onClick={() => {
                    setInlineNewCatInput('');
                    setIsAddModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
                >
                  <Plus className="w-4 h-4 text-emerald-400" />
                  <span>+ Tambah Barang Baru</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Panel Pencarian & Filter Lanjutan Real-Time */}
        <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
              <Search className="w-4 h-4 text-indigo-600" />
              <span>Pencarian &amp; Filter Lanjutan Stok (Real-Time)</span>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-[11px]">
                {filteredItems.length.toLocaleString('id-ID')} / {stockItems.length.toLocaleString('id-ID')} Item
              </span>
            </div>

            {hasActiveStockFilters && (
              <button
                type="button"
                onClick={resetAllStockFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold transition-colors self-start sm:self-auto"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Semua Filter</span>
              </button>
            )}
          </div>

          {/* Grid Input Pencarian & Filter Spesifik (Nama, SKU, Kategori, Lokasi, Status) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
            {/* 1. Pencarian Umum (Semua Kolom) */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Cari Cepat (Nama / SKU / Kategori)
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik kata kunci umum..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Cari Berdasarkan Nama Barang */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Filter Nama Barang
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  placeholder="Contoh: Bearing / Valve..."
                  className="w-full px-2.5 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
                {nameFilter && (
                  <button
                    type="button"
                    onClick={() => setNameFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 3. Cari Berdasarkan SKU / Material Code */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Filter SKU / Material Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={skuFilter}
                  onChange={(e) => setSkuFilter(e.target.value)}
                  placeholder="Contoh: 201001..."
                  className="w-full px-2.5 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
                {skuFilter && (
                  <button
                    type="button"
                    onClick={() => setSkuFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 4. Dropdown Filter Kategori */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Filter Kategori Barang
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat === 'ALL' ? 'Semua Kategori' : cat}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Dropdown Filter Lokasi Rak & Status Stok */}
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Lokasi Rak
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                >
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc === 'ALL' ? 'Semua Rak' : loc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Status Stok
                </label>
                <select
                  value={stockStatusFilter}
                  onChange={(e) =>
                    setStockStatusFilter(
                      e.target.value as 'ALL' | 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK'
                    )
                  }
                  className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="ALL">Semua Stok</option>
                  <option value="AVAILABLE">Tersedia (&gt;0)</option>
                  <option value="LOW_STOCK">Kritis (&le;Min)</option>
                  <option value="OUT_OF_STOCK">Habis (0)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quick Category Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat === 'ALL' ? 'Semua Kategori' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SUB-MASTER KATEGORI VIEW (Menampilkan Stock Minimum pada setiap barang di Sub-Master) */}
      {viewMode === 'submaster' && (
        <div className="space-y-4">
          {groupedSubMaster.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
              Tidak ada barang di sub-master yang cocok dengan filter.
            </div>
          ) : (
            groupedSubMaster.map(([categoryName, items]) => (
              <div
                key={categoryName}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs"
              >
                <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-xs sm:text-sm">
                      Sub-Master Kategori: {categoryName}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-200 font-mono text-[11px]">
                    {items.length} Barang
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2.5">Material Code</th>
                        <th className="px-4 py-2.5">Nama Barang Sub-Master</th>
                        <th className="px-4 py-2.5 text-center">Lokasi Rak</th>
                        <th className="px-4 py-2.5 text-right">Stok Fisik</th>
                        <th className="px-4 py-2.5 text-center bg-amber-50/80 text-amber-950 font-bold">
                          Stock Minimum (Batas Min)
                        </th>
                        <th className="px-4 py-2.5 text-center">Analisa Keluar Barang</th>
                        <th className="px-4 py-2.5 text-center">Status Stok</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item) => {
                        const isLow = item.currentStock <= item.minStock;
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/80">
                            <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                              {item.sku}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-slate-900">
                              {item.name}
                            </td>
                            <td className="px-4 py-2.5 text-center font-mono text-slate-600">
                              {item.location}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                              {item.currentStock} {item.unit}
                            </td>
                            <td className="px-4 py-2.5 text-center bg-amber-50/40 font-mono font-bold text-slate-900">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300">
                                Min: {item.minStock} {item.unit}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {renderVelocityBadge(item.id)}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {isLow ? (
                                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-red-100 text-red-800 border border-red-300">
                                  &le; Stock Min
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-100 text-emerald-800">
                                  Aman
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Responsive Items Presentation (Main Table View) */}
      {viewMode === 'table' && (
        <>
          {/* 1. Desktop Tabular Grid (Hidden on Mobile) */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Material Code</th>
                    <th className="px-4 py-3">Nama Barang &amp; Sub-Master</th>
                    <th className="px-4 py-3">Kategori</th>
                    <th className="px-4 py-3 text-center">Lokasi Rak</th>
                    <th className="px-4 py-3 text-right">Stok Fisik di Rak</th>
                    <th className="px-4 py-3 text-right">Dialokasikan</th>
                    <th className="px-4 py-3 text-right">Stok Siap Diambil</th>
                    <th className="px-4 py-3 text-center bg-amber-50/70 text-amber-950">
                      Stok Minimum
                    </th>
                    <th className="px-4 py-3 text-center">Analisa Keluar Barang</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                        Tidak ada barang yang cocok dengan kriteria filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((item) => {
                      const available = item.currentStock - item.allocatedStock;
                      const isLow = item.currentStock <= item.minStock;
                      const isOutOfStock = available <= 0;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {item.sku}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{item.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10.5px] font-mono font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Stok Min: {item.minStock} {item.unit}
                              </span>
                              {item.description && (
                                <span className="text-[11px] text-slate-500 truncate max-w-xs">
                                  {item.description}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="flex flex-wrap gap-1 max-w-[210px]">
                              {getItemCategories(item).map((catName) => (
                                <span
                                  key={catName}
                                  onClick={() => setSelectedCategory(catName)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                                  title="Klik untuk memfilter kategori ini"
                                >
                                  <Tags className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                                  <span>{catName}</span>
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {item.location}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {item.currentStock.toLocaleString('id-ID')} {item.unit}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-amber-700 tabular-nums">
                            {item.allocatedStock > 0 ? `${item.allocatedStock} ${item.unit}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                            <span
                              className={
                                available > item.minStock
                                  ? 'text-emerald-700'
                                  : available > 0
                                  ? 'text-amber-700'
                                  : 'text-red-600'
                              }
                            >
                              {available.toLocaleString('id-ID')} {item.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-slate-900 bg-amber-50/30 tabular-nums">
                            <span className="px-2 py-0.5 rounded bg-amber-100/80 text-amber-950 border border-amber-300/80">
                              {item.minStock} {item.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {renderVelocityBadge(item.id)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-black bg-red-100 text-red-800 border border-red-300">
                                <AlertTriangle className="w-3 h-3 text-red-600" />
                                <span>Habis</span>
                              </span>
                            ) : isLow ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse">
                                <ShieldAlert className="w-3 h-3 text-red-600" />
                                <span>&le; Batas Min</span>
                              </span>
                            ) : item.currentStock <=
                              item.minStock + Math.max(3, Math.round(item.minStock * 0.35)) ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <TrendingDown className="w-3 h-3 text-amber-700" />
                                <span>Mendekati Min</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-100 text-emerald-800">
                                <span>Aman</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setItemsToPrintBarcode([item]);
                                  setIsBarcodeThermalOpen(true);
                                }}
                                className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                                title="Preview & Cetak Barcode Stiker Clabel"
                              >
                                <Barcode className="w-4 h-4" />
                              </button>

                              {isAdmin && (
                                <button
                                  onClick={() => handleOpenTransferLocation(item)}
                                  className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors"
                                  title="Ajukan Pindah Lokasi Rak (Terealisasi saat di-ACC Kepala Store)"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={() => onViewLedgerItem(item.sku)}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                                title="Kartu Stok Mutasi"
                              >
                                <ClipboardList className="w-4 h-4" />
                              </button>

                              {isAdmin && (
                                <button
                                  onClick={() => handleOpenEdit(item)}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit Data Barang & Safety Stock"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}

                              {isAdmin && (
                                <button
                                  onClick={() => {
                                    setItemToDelete(item);
                                    setDeleteError('');
                                  }}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                  title="Hapus Material Code Barang"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Mobile Card List (Optimized for Phones & Tablets, md:hidden) */}
          <div className="md:hidden space-y-3">
            {filteredItems.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
                Tidak ada barang yang cocok dengan filter atau pencarian.
              </div>
            ) : (
              paginatedItems.map((item) => {
                const available = item.currentStock - item.allocatedStock;
                const isLow = item.currentStock <= item.minStock;
                const isOutOfStock = available <= 0;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-bold text-xs bg-slate-100 text-slate-900 px-2 py-0.5 rounded">
                            {item.sku}
                          </span>
                          {getItemCategories(item).map((catName) => (
                            <span
                              key={catName}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200"
                            >
                              <Tags className="w-2.5 h-2.5 text-indigo-500" />
                              <span>{catName}</span>
                            </span>
                          ))}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mt-1">{item.name}</h3>
                        {item.description && (
                          <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
                        )}
                      </div>

                      <div className="shrink-0 text-right space-y-1">
                        {isOutOfStock ? (
                          <span className="block text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                            Habis
                          </span>
                        ) : isLow ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Menipis
                          </span>
                        ) : (
                          <span className="block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Aman
                          </span>
                        )}
                        {renderVelocityBadge(item.id)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-lg text-center text-xs">
                      <div>
                        <div className="text-[10px] text-slate-500">Stok Fisik</div>
                        <div className="font-mono font-bold text-slate-900 mt-0.5">
                          {item.currentStock} {item.unit}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-amber-700">Dialokasikan</div>
                        <div className="font-mono font-semibold text-amber-800 mt-0.5">
                          {item.allocatedStock > 0 ? `${item.allocatedStock} ${item.unit}` : '0'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-emerald-700">Siap Diambil</div>
                        <div
                          className={`font-mono font-bold mt-0.5 ${
                            available > item.minStock
                              ? 'text-emerald-700'
                              : available > 0
                              ? 'text-amber-700'
                              : 'text-red-600'
                          }`}
                        >
                          {available} {item.unit}
                        </div>
                      </div>
                      <div className="bg-amber-50 rounded p-1 border border-amber-200">
                        <div className="text-[10px] text-amber-900 font-bold">Stok Minimum</div>
                        <div className="font-mono font-bold text-amber-950 mt-0.5">
                          {item.minStock} {item.unit}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                      <span className="text-slate-600 font-mono flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {item.location}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onViewLedgerItem(item.sku)}
                          className="px-2.5 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-[11px] font-medium flex items-center gap-1"
                        >
                          <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                          <span>Kartu Stok</span>
                        </button>

                        {isAdmin && (
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-medium flex items-center gap-1"
                          >
                            <Edit className="w-3.5 h-3.5 text-blue-600" />
                            <span>Edit</span>
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            onClick={() => {
                              setItemToDelete(item);
                              setDeleteError('');
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                            title="Hapus barang"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Pagination Bar (Active for both Table & Sub-Master views so thousands of items never lag the DOM) */}
      {filteredItems.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span>
              Menampilkan{' '}
              <strong className="font-mono text-slate-900">
                {(safeCurrentPage - 1) * itemsPerPage + 1}&ndash;
                {Math.min(safeCurrentPage * itemsPerPage, filteredItems.length)}
              </strong>{' '}
              dari <strong className="font-mono text-slate-900">{filteredItems.length.toLocaleString('id-ID')}</strong> barang
              {filteredItems.length !== stockItems.length && (
                <span className="text-slate-400">
                  {' '}
                  (Total Master: {stockItems.length.toLocaleString('id-ID')})
                </span>
              )}
            </span>

            <div className="flex items-center gap-1.5 ml-0 sm:ml-2">
              <span className="text-slate-500">Baris/Hal:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg font-mono font-semibold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-900"
              >
                {[25, 50, 100, 250, 500].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-semibold transition-colors"
            >
              Awal
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-semibold transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>

            <span className="px-3 py-1.5 rounded-lg bg-slate-900 text-white font-mono font-bold">
              Hal {safeCurrentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-semibold transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-semibold transition-colors"
            >
              Akhir
            </button>
          </div>
        </div>
      )}

      {/* MODAL 1: Tambah Master Material Code Baru (Create) */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-semibold">Tambah Material Code Master Barang Baru</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewItem} className="p-5 sm:p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Material Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                    placeholder="Contoh: BRG-007"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Barang Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Contoh: Seal O-Ring Viton 40mm High Temp"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Multi-Category Selection (Satu atau Lebih Kategori) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <label className="block font-bold text-slate-800">
                      Kategori Barang (Dapat Pilih 1 atau Lebih Kategori){' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Klik untuk memilih satu atau beberapa kategori yang sesuai untuk item stok ini.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-mono font-bold text-[11px] shrink-0">
                    {newCategories.length} Dipilih
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                  {allCategoryNames.map((catName) => {
                    const isSelected = newCategories.some(
                      (c) => c.toLowerCase() === catName.toLowerCase()
                    );
                    return (
                      <button
                        key={catName}
                        type="button"
                        onClick={() =>
                          setNewCategories((prev) => toggleCategoryInList(prev, catName))
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40'
                        }`}
                      >
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 text-white shrink-0" />
                        ) : (
                          <Tags className="w-3 h-3 text-slate-400 shrink-0" />
                        )}
                        <span>{catName}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tambah Kategori Cepat Langsung dari Form */}
                <div className="pt-2 border-t border-slate-200/80 flex items-center gap-2">
                  <input
                    type="text"
                    value={inlineNewCatInput}
                    onChange={(e) => setInlineNewCatInput(e.target.value)}
                    placeholder="Ketik nama kategori baru jika belum ada..."
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickAddInlineCategory('add')}
                    disabled={!inlineNewCatInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold text-xs shrink-0"
                  >
                    + Tambah &amp; Pilih
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Satuan Pengukuran (Unit)
                  </label>
                  <input
                    type="text"
                    required
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="Pcs, Unit, Box, Liter..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lokasi Rak Penyimpanan
                  </label>
                  <select
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  >
                    {storageLocations.map((loc) => (
                      <option key={loc.id} value={loc.code}>
                        {loc.code} - {loc.name}
                      </option>
                    ))}
                    {!storageLocations.some((l) => l.code === newLocation) && (
                      <option value={newLocation}>{newLocation} (Kustom)</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Safety Stock (Batas Min)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                  <p className="text-[10.5px] text-slate-500 mt-1">
                    Peringatan stok menipis ({newUnit})
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Saldo Stok Awal Fisik
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    disabled={!isKepalaGudang}
                    value={isKepalaGudang ? newInitialStock : 0}
                    onChange={(e) => setNewInitialStock(isKepalaGudang ? Number(e.target.value) : 0)}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-xs focus:ring-1 focus:ring-slate-900 focus:outline-hidden ${
                      isKepalaGudang ? 'bg-white' : 'bg-slate-100 text-slate-500 cursor-not-allowed'
                    }`}
                  />
                  <p className="text-[10.5px] text-slate-500 mt-1">
                    {isKepalaGudang
                      ? `Jumlah fisik terdaftar (${newUnit})`
                      : 'Penambahan stok harus melalui LPB & di-approve Kepala Gudang'}
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Deskripsi / Spesifikasi Tambahan
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Keterangan spesifikasi teknis atau nomor part manufaktur..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
                >
                  Simpan Material Code Baru
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Master SKU Barang (Update) */}
      {itemToEdit && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-semibold">
                  Edit Data Master Barang ({itemToEdit.sku})
                </h2>
              </div>
              <button
                onClick={() => setItemToEdit(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 sm:p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Material Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editSku}
                    onChange={(e) => setEditSku(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Barang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Multi-Category Selection (Satu atau Lebih Kategori) */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <label className="block font-bold text-slate-800">
                      Kategori Barang (Dapat Pilih 1 atau Lebih Kategori){' '}
                      <span className="text-red-500">*</span>
                    </label>
                    <p className="text-[11px] text-slate-500">
                      Klik pada kategori untuk menambah atau melepas kategori dari barang ini.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-mono font-bold text-[11px] shrink-0">
                    {editCategories.length} Dipilih
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                  {allCategoryNames.map((catName) => {
                    const isSelected = editCategories.some(
                      (c) => c.toLowerCase() === catName.toLowerCase()
                    );
                    return (
                      <button
                        key={catName}
                        type="button"
                        onClick={() =>
                          setEditCategories((prev) => toggleCategoryInList(prev, catName))
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:bg-blue-50/40'
                        }`}
                      >
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 text-white shrink-0" />
                        ) : (
                          <Tags className="w-3 h-3 text-slate-400 shrink-0" />
                        )}
                        <span>{catName}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Tambah Kategori Cepat Langsung dari Form Edit */}
                <div className="pt-2 border-t border-slate-200/80 flex items-center gap-2">
                  <input
                    type="text"
                    value={inlineNewCatInput}
                    onChange={(e) => setInlineNewCatInput(e.target.value)}
                    placeholder="Ketik nama kategori baru jika belum ada..."
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleQuickAddInlineCategory('edit')}
                    disabled={!inlineNewCatInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-xs shrink-0"
                  >
                    + Tambah &amp; Pilih
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Satuan Pengukuran (Unit)
                  </label>
                  <input
                    type="text"
                    required
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lokasi Rak Penyimpanan
                  </label>
                  <select
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  >
                    {storageLocations.map((loc) => (
                      <option key={loc.id} value={loc.code}>
                        {loc.code} - {loc.name}
                      </option>
                    ))}
                    {!storageLocations.some((l) => l.code === editLocation) && (
                      <option value={editLocation}>{editLocation} (Kustom)</option>
                    )}
                  </select>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="block font-semibold text-slate-700 mb-1">
                  Safety Stock (Batas Minimum Stok)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editMinStock}
                  onChange={(e) => setEditMinStock(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
                <p className="text-[10.5px] text-slate-500 mt-1">
                  Batas ambang peringatan ketika stok barang menipis ({editUnit}).
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Deskripsi / Catatan Barang
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setItemToEdit(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Konfirmasi Hapus Barang (Delete) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-slate-900 text-center">
              Hapus Material Code Barang "{itemToDelete.name}"?
            </h3>
            <p className="text-xs text-slate-600 text-center mt-2 leading-relaxed">
              Anda akan menghapus Material Code <strong className="font-mono">{itemToDelete.sku}</strong> dari katalog master.
              {itemToDelete.currentStock > 0 && (
                <span className="block text-amber-700 font-semibold mt-1">
                  Catatan: Barang ini masih memiliki saldo fisik sebanyak {itemToDelete.currentStock} {itemToDelete.unit}.
                </span>
              )}
            </p>

            {deleteError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Batalkan
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-xs"
              >
                Ya, Hapus Barang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import Excel Barang Master */}
      {isImportModalOpen && (
        <ImportStockItemsModal onClose={() => setIsImportModalOpen(false)} />
      )}

      {/* Modal Ajukan Pindah Lokasi Rak Barang */}
      {itemToTransferLoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-sm sm:text-base font-bold">
                    Ajukan Pindah Lokasi Rak ({itemToTransferLoc.sku})
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    Perubahan lokasi akan terealisasi setelah di-ACC oleh Kepala Store
                  </p>
                </div>
              </div>
              <button
                onClick={() => setItemToTransferLoc(null)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTransferLocation} className="p-5 sm:p-6 space-y-4 text-xs">
              {transferError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 font-medium">
                  {transferError}
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-500">Barang:</div>
                  <div className="font-bold text-slate-900">{itemToTransferLoc.name}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">Rak Saat Ini (Asal):</div>
                  <div className="font-mono font-bold text-slate-900">
                    {itemToTransferLoc.location}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Lokasi Rak Tujuan Baru <span className="text-red-500">*</span>
                </label>
                <select
                  value={transferTargetRack}
                  onChange={(e) => setTransferTargetRack(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                >
                  {storageLocations.map((loc) => (
                    <option
                      key={loc.id}
                      value={loc.code}
                      disabled={loc.code === itemToTransferLoc.location}
                    >
                      {loc.code} — {loc.name} ({loc.zone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan Pemindahan Lokasi Rak <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Contoh: Penataan ulang rak barang Fast Moving Store..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setItemToTransferLoc(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
                >
                  Ajukan ke Kepala Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Desainer & Cetak Barcode Stiker Thermal Clabel */}
      {isBarcodeThermalOpen && (
        <ThermalLabelDesignerModal
          items={itemsToPrintBarcode}
          initialMode="items"
          onClose={() => {
            setIsBarcodeThermalOpen(false);
            setItemsToPrintBarcode([]);
          }}
        />
      )}

      {/* Modal Scan Barcode Barang & Lokasi Rak */}
      {isScannerLookupOpen && (
        <BarcodeScannerLookupModal
          isOpen={isScannerLookupOpen}
          onClose={() => setIsScannerLookupOpen(false)}
        />
      )}

      {/* MODAL MANAJEMEN KATEGORI BARANG (Admin dapat Membuat, Mengedit, dan Menghapus Kategori) */}
      {isCategoryManagerOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Tags className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold">
                    Manajemen Master Kategori Barang Stok
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    Admin dapat membuat, mengedit, dan menghapus kategori. Setiap barang dapat dikaitkan dengan 1 atau lebih kategori.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCategoryManagerOpen(false);
                  setEditingCategory(null);
                  setCategoryToDelete(null);
                  setCategoryFormError('');
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {categoryFormError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{categoryFormError}</span>
                </div>
              )}

              {/* Form Buat Kategori Baru */}
              <form
                onSubmit={handleAddCategorySubmit}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3"
              >
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>Buat Kategori Barang Baru</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Nama Kategori <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={catFormName}
                      onChange={(e) => setCatFormName(e.target.value)}
                      placeholder="Contoh: Hidrolik & Pneumatik"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Keterangan / Deskripsi Kategori
                    </label>
                    <input
                      type="text"
                      value={catFormDescription}
                      onChange={(e) => setCatFormDescription(e.target.value)}
                      placeholder="Deskripsi singkat kelompok barang..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-indigo-600 focus:outline-hidden"
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-end">
                    <button
                      type="submit"
                      className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-2xs"
                    >
                      + Simpan
                    </button>
                  </div>
                </div>
              </form>

              {/* Konfirmasi Hapus Kategori */}
              {categoryToDelete && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
                  <div className="flex items-start gap-2.5">
                    <Trash2 className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-bold text-red-950">
                        Hapus Kategori "{categoryToDelete.name}"?
                      </h4>
                      <p className="text-[11px] text-red-800 mt-0.5">
                        Terdapat{' '}
                        <strong>
                          {categoryItemCounts.get(categoryToDelete.name.toLowerCase()) || 0} barang
                        </strong>{' '}
                        yang terkait dengan kategori ini. Jika dihapus, kategori ini akan dilepas dari barang tersebut (barang yang hanya memiliki kategori ini akan otomatis dialihkan ke kategori Umum).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCategoryToDelete(null)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteCategory}
                      className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold"
                    >
                      Ya, Hapus Kategori
                    </button>
                  </div>
                </div>
              )}

              {/* Daftar Kategori Terdaftar */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    Daftar Kategori Barang Aktif ({stockCategories.length} Kategori)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Mengubah nama kategori akan otomatis memperbarui seluruh barang terkait
                  </span>
                </div>

                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {stockCategories.map((cat) => {
                    const isEditingThis = editingCategory?.id === cat.id;
                    const itemCount = categoryItemCounts.get(cat.name.toLowerCase()) || 0;

                    return (
                      <div
                        key={cat.id}
                        className="p-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        {isEditingThis ? (
                          <form
                            onSubmit={handleSaveEditCategory}
                            className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                          >
                            <div className="sm:col-span-4">
                              <input
                                type="text"
                                required
                                value={editCatName}
                                onChange={(e) => setEditCatName(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-blue-400 rounded-lg text-xs font-semibold focus:outline-hidden"
                                placeholder="Nama kategori..."
                              />
                            </div>
                            <div className="sm:col-span-5">
                              <input
                                type="text"
                                value={editCatDescription}
                                onChange={(e) => setEditCatDescription(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-hidden"
                                placeholder="Deskripsi kategori..."
                              />
                            </div>
                            <div className="sm:col-span-3 flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setEditingCategory(null)}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 font-semibold"
                              >
                                Batal
                              </button>
                              <button
                                type="submit"
                                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold"
                              >
                                Simpan
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
                                  <Tags className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>{cat.name}</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-[10.5px] font-semibold">
                                  {itemCount.toLocaleString('id-ID')} Barang
                                </span>
                              </div>
                              {cat.description && (
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  {cat.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCategory(cat.name);
                                  setIsCategoryManagerOpen(false);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px]"
                                title="Tampilkan barang dengan kategori ini"
                              >
                                Filter Barang
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartEditCategory(cat)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold text-[11px]"
                              >
                                <Edit className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setCategoryToDelete(cat)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-[11px]"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsCategoryManagerOpen(false)}
                className="px-5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
              >
                Selesai &amp; Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {canExportSap && isSapExportModalOpen && (
        <SapExportModal
          isOpen={isSapExportModalOpen}
          onClose={() => setIsSapExportModalOpen(false)}
          defaultModule="MATERIAL_MASTER"
          vouchers={issueVouchers}
          lpbDocs={lpbDocuments}
          stockItems={filteredItems.length > 0 ? filteredItems : stockItems}
          costCenters={costCenters}
          glAccounts={glAccounts}
        />
      )}
    </div>
  );
};
