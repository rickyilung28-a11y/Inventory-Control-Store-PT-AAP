import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  LPBDocument,
  UserAccount,
  getEffectivePermissions,
  getItemCategories,
} from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { SapExportModal } from '../components/SapExportModal';
import {
  Search,
  Printer,
  Plus,
  ArrowDownLeft,
  ChevronDown,
  ChevronUp,
  Calendar,
  Building2,
  RotateCcw,
  FileSpreadsheet,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ScanBarcode,
  Info,
  X,
  Filter,
  User,
  UserCheck,
  Tags,
} from 'lucide-react';

interface LPBViewProps {
  currentUser: UserAccount;
  lpbDocuments: LPBDocument[];
  onOpenCreateLPB: () => void;
  onPrintLPB: (doc: LPBDocument) => void;
}

export const LPBView: React.FC<LPBViewProps> = ({
  currentUser,
  lpbDocuments,
  onOpenCreateLPB,
  onPrintLPB,
}) => {
  const {
    approveLPBStockAddition,
    rejectLPB,
    stockItems,
    stockCategories,
    issueVouchers,
    costCenters,
    glAccounts,
  } = useInventory();

  const perms = getEffectivePermissions(currentUser);
  const isAdmin = perms.canCreateLPB;
  const isKepalaGudang = perms.canApproveLPBStockAddition;
  const canExportSap =
    currentUser.role === 'superuser' ||
    currentUser.role === 'kepala_gudang' ||
    currentUser.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('');
  const [statusTab, setStatusTab] = useState<'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'>(
    'ALL'
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSapExportModalOpen, setIsSapExportModalOpen] = useState(false);

  // Modal state for Kepala Gudang Approve / Reject Penambahan Stock LPB
  const [lpbToApprove, setLpbToApprove] = useState<LPBDocument | null>(null);
  const [headApprovalNotes, setHeadApprovalNotes] = useState('');
  const [isRejectingLpb, setIsRejectingLpb] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Filter Rentang Tanggal untuk melihat LPB apa saja yang diterbitkan
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const applyDatePreset = (preset: 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH') => {
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const now = new Date();
    const toYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (preset === 'TODAY') {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'LAST_7_DAYS') {
      const past = new Date(now);
      past.setDate(now.getDate() - 7);
      setStartDate(toYMD(past));
      setEndDate(toYMD(now));
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toYMD(firstDay));
      setEndDate(toYMD(now));
    }
  };

  const dateFilteredDocs = useMemo(() => {
    return lpbDocuments.filter((doc) => {
      if (startDate || endDate) {
        const docDateStr = doc.receivedDate || doc.createdAt;
        const docDate = new Date(docDateStr);
        if (!isNaN(docDate.getTime())) {
          if (startDate) {
            const start = new Date(`${startDate}T00:00:00`);
            if (docDate < start) return false;
          }
          if (endDate) {
            const end = new Date(`${endDate}T23:59:59.999`);
            if (docDate > end) return false;
          }
        }
      }
      return true;
    });
  }, [lpbDocuments, startDate, endDate]);

  const pendingApprovalCount = dateFilteredDocs.filter(
    (d) => d.status === 'PENDING_APPROVAL'
  ).length;
  const approvedCount = dateFilteredDocs.filter(
    (d) => !d.status || d.status === 'APPROVED'
  ).length;
  const rejectedCount = dateFilteredDocs.filter((d) => d.status === 'REJECTED').length;

  const uniqueLpbCreators = useMemo(() => {
    const set = new Set<string>();
    lpbDocuments.forEach((doc) => {
      if (doc.receivedByAdmin && doc.receivedByAdmin.trim()) {
        set.add(doc.receivedByAdmin.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [lpbDocuments]);

  const uniqueLpbRecipients = useMemo(() => {
    const set = new Set<string>();
    lpbDocuments.forEach((doc) => {
      if (doc.approvedByWarehouseHead && doc.approvedByWarehouseHead.trim()) {
        set.add(doc.approvedByWarehouseHead.trim());
      }
      if (doc.verifiedBy && doc.verifiedBy.trim()) {
        set.add(doc.verifiedBy.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [lpbDocuments]);

  const stockCategoriesByKey = useMemo(() => {
    const bySku = new Map<string, string[]>();
    const byId = new Map<string, string[]>();
    stockItems.forEach((item) => {
      const cats = getItemCategories(item);
      bySku.set(item.sku.toLowerCase(), cats);
      byId.set(item.id.toLowerCase(), cats);
    });
    return { bySku, byId };
  }, [stockItems]);

  const getCategoriesForLpbItem = (item: { itemId?: string; sku: string }): string[] => {
    if (item.itemId) {
      const foundById = stockCategoriesByKey.byId.get(item.itemId.toLowerCase());
      if (foundById && foundById.length > 0) return foundById;
    }
    const foundBySku = stockCategoriesByKey.bySku.get((item.sku || '').toLowerCase());
    if (foundBySku && foundBySku.length > 0) return foundBySku;
    return ['Umum & Konsumsi Gudang'];
  };

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    stockCategories.forEach((c) => {
      if (c.name && c.name.trim()) {
        map.set(c.name.trim().toLowerCase(), c.name.trim());
      }
    });
    stockItems.forEach((item) => {
      getItemCategories(item).forEach((catName) => {
        const key = catName.toLowerCase();
        if (!map.has(key)) map.set(key, catName);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [stockCategories, stockItems]);

  const hasActiveLpbFilters = Boolean(
    searchQuery.trim() ||
      categoryFilter !== 'ALL' ||
      creatorFilter.trim() ||
      recipientFilter.trim() ||
      startDate ||
      endDate ||
      statusTab !== 'ALL'
  );

  const resetAllLpbFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setCreatorFilter('');
    setRecipientFilter('');
    setStartDate('');
    setEndDate('');
    setStatusTab('ALL');
  };

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const creatorQ = creatorFilter.trim().toLowerCase();
    const recipientQ = recipientFilter.trim().toLowerCase();
    const catFilterLower = categoryFilter.toLowerCase();

    return dateFilteredDocs.filter((doc) => {
      const effectiveStatus = doc.status || 'APPROVED';
      if (statusTab !== 'ALL' && effectiveStatus !== statusTab) return false;

      // Filter berdasarkan Kategori Barang
      if (categoryFilter !== 'ALL') {
        const matchesCategory = doc.items.some((it) =>
          getCategoriesForLpbItem(it).some((c) => c.toLowerCase() === catFilterLower)
        );
        if (!matchesCategory) return false;
      }

      if (creatorQ && !(doc.receivedByAdmin || '').toLowerCase().includes(creatorQ)) {
        return false;
      }

      if (recipientQ) {
        const approver = (doc.approvedByWarehouseHead || '').toLowerCase();
        const verifier = (doc.verifiedBy || '').toLowerCase();
        const adminReceiver = (doc.receivedByAdmin || '').toLowerCase();
        if (
          !approver.includes(recipientQ) &&
          !verifier.includes(recipientQ) &&
          !adminReceiver.includes(recipientQ)
        ) {
          return false;
        }
      }

      if (!q) return true;
      return (
        doc.lpbNumber.toLowerCase().includes(q) ||
        doc.sjNumber.toLowerCase().includes(q) ||
        doc.supplierName.toLowerCase().includes(q) ||
        (doc.poNumber && doc.poNumber.toLowerCase().includes(q)) ||
        (doc.receivedByAdmin && doc.receivedByAdmin.toLowerCase().includes(q)) ||
        (doc.approvedByWarehouseHead && doc.approvedByWarehouseHead.toLowerCase().includes(q)) ||
        doc.items.some(
          (i) =>
            i.sku.toLowerCase().includes(q) ||
            i.itemName.toLowerCase().includes(q) ||
            getCategoriesForLpbItem(i).some((c) => c.toLowerCase().includes(q))
        )
      );
    });
  }, [
    dateFilteredDocs,
    statusTab,
    categoryFilter,
    searchQuery,
    creatorFilter,
    recipientFilter,
    stockCategoriesByKey,
  ]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return iso;
    }
  };

  // Unduh Rekap LPB dalam format Excel (.xlsx)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headerRows = [
      ['REKAPITULASI LAPORAN PENERIMAAN BARANG (LPB) DARI SJ SUPPLIER'],
      [
        `Periode Terbit: ${
          startDate || endDate
            ? `${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`
            : 'Semua Tanggal'
        }`,
      ],
      [],
      [
        'No',
        'No. LPB',
        'Tanggal Diterima',
        'No. Surat Jalan (SJ)',
        'No. PO',
        'Nama Supplier',
        'Status LPB',
        'Divalidasi/Scan Admin Gudang',
        'Di-Approve Kepala Gudang',
        'Material Code',
        'Nama Barang',
        'Qty Diterima',
        'Satuan',
        'Kondisi',
        'Batch / Lot',
        'Catatan Item',
      ],
    ];

    const dataRows: (string | number)[][] = [];
    let rowIdx = 1;

    filteredDocs.forEach((doc) => {
      const statusText =
        doc.status === 'PENDING_APPROVAL'
          ? 'Divalidasi Admin (Menunggu Approve Penambahan Stock Kepala Gudang)'
          : doc.status === 'REJECTED'
          ? 'Ditolak'
          : 'Approved Kepala Gudang (Stok Bertambah)';

      doc.items.forEach((item) => {
        dataRows.push([
          rowIdx++,
          doc.lpbNumber,
          formatDate(doc.receivedDate),
          doc.sjNumber,
          doc.poNumber || '-',
          doc.supplierName,
          statusText,
          doc.receivedByAdmin,
          doc.approvedByWarehouseHead || doc.verifiedBy || '-',
          item.sku,
          item.itemName,
          item.quantity,
          item.unit,
          item.condition,
          item.batchNo || '-',
          item.notes || doc.notes || '-',
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 15 },
      { wch: 20 },
      { wch: 16 },
      { wch: 28 },
      { wch: 30 },
      { wch: 20 },
      { wch: 22 },
      { wch: 16 },
      { wch: 32 },
      { wch: 14 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 28 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Daftar LPB');

    const suffix =
      startDate || endDate
        ? `${startDate || 'Awal'}_sd_${endDate || 'Akhir'}`
        : new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Rekap_LPB_${suffix}.xlsx`);
  };

  const handleConfirmHeadApproveLPB = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lpbToApprove) return;
    approveLPBStockAddition(lpbToApprove.id, {
      warehouseHeadName: currentUser.name,
      notes: headApprovalNotes.trim() || undefined,
    });
    setLpbToApprove(null);
    setHeadApprovalNotes('');
  };

  const handleConfirmRejectLPB = () => {
    if (!lpbToApprove || !rejectReason.trim()) return;
    rejectLPB(lpbToApprove.id, rejectReason.trim());
    setLpbToApprove(null);
    setRejectReason('');
    setIsRejectingLpb(false);
  };

  return (
    <div className="space-y-5">
      {/* Header & Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">
              <ArrowDownLeft className="w-4 h-4" />
              <span>Inbound / Penambahan Stok Gudang (LPB)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Laporan Penerimaan Barang (LPB) dari SJ Supplier
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
              Prosedur Penambahan Stock: (1) <strong>User Admin Gudang</strong> melakukan input SJ Supplier, ACC &amp; validasi barang / scan barcode (stok belum bertambah), (2) <strong>User Kepala Gudang</strong> melakukan <strong>Approve Penambahan Stock</strong> sehingga stok fisik otomatis bertambah.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {canExportSap && (
              <>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
                  title="Unduh daftar LPB sesuai filter rentang tanggal ke file Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Unduh Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSapExportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 border border-amber-500 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  title="Export data LPB ke format Excel (.xlsx) atau CSV (.csv) standar untuk Import Sistem SAP (MIGO Goods Receipt Mvt 101 / 501)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-950" />
                  <span>Export SAP (.xlsx / .csv)</span>
                </button>
              </>
            )}

            {isAdmin ? (
              <button
                onClick={onOpenCreateLPB}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-xs"
              >
                <ScanBarcode className="w-4 h-4 text-white" />
                Input &amp; Validasi/Scan SJ Supplier (Admin Gudang)
              </button>
            ) : isKepalaGudang ? (
              <div className="text-xs text-emerald-900 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Mode Kepala Gudang: Wewenang Approve Penambahan Stock LPB</span>
              </div>
            ) : (
              <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                Validasi SJ oleh <strong>Admin Gudang</strong> &middot; Approve Penambahan Stock oleh <strong>Kepala Gudang</strong>
              </div>
            )}
          </div>
        </div>

        {/* Panel Pencarian & Filter Lanjutan Nota LPB (Real-Time) */}
        <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                <Filter className="w-4 h-4 text-emerald-600" />
                <span>Pencarian & Filter Lanjutan Nota LPB (Real-Time)</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-mono text-slate-700">
                Menampilkan <strong>{filteredDocs.length}</strong> dari{' '}
                <strong>{lpbDocuments.length}</strong> Nota LPB
              </span>
            </div>

            {hasActiveLpbFilters && (
              <button
                type="button"
                onClick={resetAllLpbFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Semua Filter</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* 1. Pencarian Cepat No. LPB / SJ / Supplier / Barang / SKU / Kategori */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Cari No. LPB / SJ / Supplier / Barang / SKU
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik No. LPB, SJ, nama barang, SKU..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Filter Kategori Barang */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Filter Kategori Barang
              </label>
              <div className="relative">
                <Tags className="w-3.5 h-3.5 text-emerald-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="ALL">Semua Kategori Barang</option>
                  {categoryOptions.map((catName) => (
                    <option key={catName} value={catName}>
                      {catName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Filter Status Nota LPB (Pending / Approved) */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Status Nota LPB (Pending / Approved)
              </label>
              <select
                value={statusTab}
                onChange={(e) =>
                  setStatusTab(
                    e.target.value as 'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
                  )
                }
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              >
                <option value="ALL">Semua Status ({dateFilteredDocs.length})</option>
                <option value="PENDING_APPROVAL">
                  Pending — Menunggu Approve Kepala Gudang ({pendingApprovalCount})
                </option>
                <option value="APPROVED">
                  Approved — Sudah Di-Approve Kepala Gudang ({approvedCount})
                </option>
                <option value="REJECTED">Ditolak / Rejected ({rejectedCount})</option>
              </select>
            </div>

            {/* 4. Filter Pembuat Nota (Admin Penerima) */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Pembuat Nota (Admin Store)
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  list="lpb-creator-options"
                  value={creatorFilter}
                  onChange={(e) => setCreatorFilter(e.target.value)}
                  placeholder="Pilih / ketik nama pembuat LPB..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
                <datalist id="lpb-creator-options">
                  {uniqueLpbCreators.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                {creatorFilter && (
                  <button
                    type="button"
                    onClick={() => setCreatorFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 5. Filter Penerima / Pejabat Verifikasi Gudang */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Penerima / Approver Gudang
              </label>
              <div className="relative">
                <UserCheck className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  list="lpb-recipient-options"
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                  placeholder="Pilih / ketik penerima / approver..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
                <datalist id="lpb-recipient-options">
                  {uniqueLpbRecipients.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                {recipientFilter && (
                  <button
                    type="button"
                    onClick={() => setRecipientFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Baris Filter Tanggal */}
          <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>Filter Tanggal LPB:</span>
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                  <span className="text-slate-500 font-medium">Dari:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs font-mono text-slate-900 focus:outline-hidden"
                  />
                </div>

                <span className="text-slate-400 font-bold">s/d</span>

                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                  <span className="text-slate-500 font-medium">Sampai:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs font-mono text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => applyDatePreset('TODAY')}
                  className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium transition-colors"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('LAST_7_DAYS')}
                  className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium transition-colors"
                >
                  7 Hari Terakhir
                </button>
                <button
                  type="button"
                  onClick={() => applyDatePreset('THIS_MONTH')}
                  className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium transition-colors"
                >
                  Bulan Ini
                </button>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => applyDatePreset('ALL')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Tanggal</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Status Filter Tabs Cepat */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs overflow-x-auto">
            <button
              onClick={() => setStatusTab('ALL')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                statusTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua LPB ({dateFilteredDocs.length})
            </button>

            <button
              onClick={() => setStatusTab('PENDING_APPROVAL')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                statusTab === 'PENDING_APPROVAL'
                  ? 'bg-white text-amber-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Pending — Menunggu Approve Kepala Gudang ({pendingApprovalCount})
            </button>

            <button
              onClick={() => setStatusTab('APPROVED')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                statusTab === 'APPROVED'
                  ? 'bg-white text-emerald-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Approved — Stok Bertambah ({approvedCount})
            </button>

            {rejectedCount > 0 && (
              <button
                onClick={() => setStatusTab('REJECTED')}
                className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  statusTab === 'REJECTED'
                    ? 'bg-white text-red-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                Ditolak ({rejectedCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Rules Notice Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Ketentuan Otorisasi Penambahan Stock (LPB):</strong> (1){' '}
          <strong>User Admin Gudang</strong> hanya melakukan ACC, input SJ Supplier, dan validasi barang / scan barcode (pada tahap ini <strong>stok fisik gudang belum bertambah</strong>). (2){' '}
          <strong>User Kepala Gudang</strong> melakukan <strong>Approve Penambahan Stock</strong> atas hasil validasi Admin Gudang sehingga stok fisik gudang otomatis bertambah dan tercatat di Kartu Stok.
        </p>
      </div>

      {/* LPB Table / Cards */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {filteredDocs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Tidak ditemukan dokumen penerimaan barang (LPB) pada rentang tanggal atau status ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredDocs.map((doc) => {
              const isExpanded = expandedId === doc.id;
              const totalItemsCount = doc.items.reduce((a, b) => a + b.quantity, 0);
              const isPendingHeadApprove = doc.status === 'PENDING_APPROVAL';
              const isRejected = doc.status === 'REJECTED';
              const isApproved = !doc.status || doc.status === 'APPROVED';

              return (
                <div key={doc.id} className="transition-colors hover:bg-slate-50/50">
                  <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {doc.lpbNumber}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          {doc.supplierName}
                        </span>
                        <span className="text-slate-300">·</span>
                        {isPendingHeadApprove && (
                          <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Tahap 1: Di-ACC &amp; Scan Admin Gudang (Stok Belum Bertambah) &mdash; Menunggu Approve Penambahan Stock Kepala Gudang
                          </span>
                        )}
                        {isApproved && (
                          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Tahap 2 Selesai: Penambahan Stock Di-Approve Kepala Gudang (+{totalItemsCount} Unit Masuk Stok)
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                            Ditolak Kepala Gudang
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span className="font-mono text-slate-700">
                          No. SJ: <strong>{doc.sjNumber}</strong>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          Terima: {formatDate(doc.receivedDate)}
                        </span>
                        <span>·</span>
                        <span className="text-blue-700 font-medium">
                          ACC &amp; Scan Admin: <strong>{doc.receivedByAdmin}</strong>
                        </span>
                        {isApproved && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-700 font-medium">
                              Approve Penambahan Stock (Ka. Gudang):{' '}
                              <strong>{doc.approvedByWarehouseHead || doc.verifiedBy}</strong>
                            </span>
                          </>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500">
                        Total {totalItemsCount} unit barang ({doc.items.length} macam Material Code) &middot;{' '}
                        {isPendingHeadApprove
                          ? 'Stok fisik gudang belum bertambah (menunggu Approve Kepala Gudang).'
                          : isApproved
                          ? 'Stok fisik gudang telah bertambah dan tercatat di Kartu Stok.'
                          : `Ditolak: ${doc.rejectionReason || '-'}`}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        onClick={() => onPrintLPB(doc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs"
                        title="Cetak atau Unduh Dokumen LPB Penerimaan Barang (PDF)"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Cetak / Unduh PDF</span>
                      </button>

                      {/* HANYA USER KEPALA GUDANG yang bisa Approve Penambahan Stock LPB */}
                      {isPendingHeadApprove && isKepalaGudang && (
                        <button
                          onClick={() => {
                            setLpbToApprove(doc);
                            setHeadApprovalNotes('');
                            setIsRejectingLpb(false);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-2xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Approve Penambahan Stock (Kepala Gudang)</span>
                        </button>
                      )}

                      {/* Jika login sebagai Admin Gudang atau Pemohon pada LPB yang menunggu Kepala Gudang */}
                      {isPendingHeadApprove && !isKepalaGudang && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Menunggu Approve Penambahan Stock (Kepala Gudang)</span>
                        </span>
                      )}

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                        title={isExpanded ? 'Tutup rincian' : 'Lihat rincian item'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Item Details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 bg-slate-50/70 border-t border-slate-100">
                      <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2 text-center w-10">No</th>
                              <th className="px-3 py-2">Material Code</th>
                              <th className="px-3 py-2">Nama Barang</th>
                              <th className="px-3 py-2">Kategori Barang</th>
                              <th className="px-3 py-2 text-center">Validasi Barcode (Admin)</th>
                              <th className="px-3 py-2 text-center">Kondisi</th>
                              <th className="px-3 py-2 text-right">Qty &amp; Status Penambahan Stok</th>
                              <th className="px-3 py-2">Lot / Catatan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {doc.items.map((item, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2 text-center tabular-nums text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="px-3 py-2 font-mono text-slate-700">{item.sku}</td>
                                <td className="px-3 py-2 font-medium text-slate-900">
                                  {item.itemName}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {getCategoriesForLpbItem(item).map((catName) => (
                                      <span
                                        key={catName}
                                        onClick={() => setCategoryFilter(catName)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200 text-[10px] font-semibold cursor-pointer hover:bg-emerald-100"
                                        title="Klik untuk memfilter LPB berdasarkan kategori ini"
                                      >
                                        <Tags className="w-2.5 h-2.5 text-emerald-600" />
                                        <span>{catName}</span>
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10.5px] font-semibold">
                                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                                    Tervalidasi Scan Admin
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className="text-emerald-700 font-semibold">
                                    {item.condition}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                                  {isApproved ? (
                                    <span className="text-emerald-700">
                                      +{item.quantity} {item.unit} (Stok Bertambah)
                                    </span>
                                  ) : isPendingHeadApprove ? (
                                    <span className="text-amber-700">
                                      +{item.quantity} {item.unit} (Menunggu Approve Ka. Gudang)
                                    </span>
                                  ) : (
                                    <span className="text-red-600 line-through">
                                      {item.quantity} {item.unit}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-slate-500">
                                  {item.batchNo && item.batchNo !== '-'
                                    ? `Lot: ${item.batchNo} `
                                    : ''}
                                  {item.notes}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {doc.notes && (
                        <p className="mt-2 text-xs text-slate-600">
                          <strong>Catatan Tambahan:</strong> {doc.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL APPROVE PENAMBAHAN STOCK LPB OLEH KEPALA GUDANG */}
      {lpbToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-4">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold">
                    Tahap 2 (Kepala Gudang): Approve Penambahan Stock LPB
                  </h3>
                  <p className="text-[11px] text-slate-300 font-mono">
                    {lpbToApprove.lpbNumber} &middot; SJ: {lpbToApprove.sjNumber} ({lpbToApprove.supplierName})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLpbToApprove(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Otorisasi Penambahan Stock oleh Kepala Gudang ({currentUser.name})
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Dokumen LPB ini telah di-ACC &amp; divalidasi scan barcode oleh Admin Gudang (<strong>{lpbToApprove.receivedByAdmin}</strong>). Saat ini stok fisik gudang <strong>belum bertambah</strong>. Dengan menekan tombol <strong>Approve Penambahan Stock</strong> di bawah, saldo stok fisik gudang akan langsung bertambah secara otomatis dan tercatat di Kartu Stok.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5">Barang &amp; Material Code</th>
                      <th className="px-3 py-2.5 text-center">Stok Saat Ini</th>
                      <th className="px-3 py-2.5 text-right">Qty Masuk (Validasi Admin)</th>
                      <th className="px-3 py-2.5 text-right">Stok Setelah Approve</th>
                      <th className="px-3 py-2.5 text-center">Status Scan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lpbToApprove.items.map((item, idx) => {
                      const st = stockItems.find((s) => s.id === item.itemId || s.sku === item.sku);
                      const curStock = st ? st.currentStock : 0;
                      const afterStock = curStock + item.quantity;

                      return (
                        <tr key={idx}>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-slate-900">{item.itemName}</div>
                            <div className="font-mono text-[11px] text-slate-500">{item.sku}</div>
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-slate-700">
                            {curStock} {item.unit}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-blue-700">
                            +{item.quantity} {item.unit}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">
                            {afterStock} {item.unit}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10.5px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Barcode Tervalidasi
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {!isRejectingLpb ? (
                <form onSubmit={handleConfirmHeadApproveLPB} className="space-y-3 pt-2">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Catatan Approval Kepala Gudang (Opsional):
                    </label>
                    <input
                      type="text"
                      value={headApprovalNotes}
                      onChange={(e) => setHeadApprovalNotes(e.target.value)}
                      placeholder="Contoh: Penambahan stock disetujui Kepala Gudang sesuai hasil scan Admin..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-600 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsRejectingLpb(true)}
                      className="px-3.5 py-2 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50"
                    >
                      Tolak LPB
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLpbToApprove(null)}
                        className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Approve Penambahan Stock (+Stok Gudang)</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block font-bold text-red-800 mb-1">
                      Alasan Penolakan Penambahan Stock LPB <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Contoh: Jumlah fisik barang tidak sesuai dengan Surat Jalan..."
                      className="w-full px-3 py-2 border border-red-300 rounded-lg text-xs focus:ring-1 focus:ring-red-600 focus:outline-hidden"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setIsRejectingLpb(false)}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      &larr; Kembali ke Approve
                    </button>
                    <button
                      type="button"
                      disabled={!rejectReason.trim()}
                      onClick={handleConfirmRejectLPB}
                      className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-lg"
                    >
                      Konfirmasi Tolak LPB
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {canExportSap && isSapExportModalOpen && (
        <SapExportModal
          isOpen={isSapExportModalOpen}
          onClose={() => setIsSapExportModalOpen(false)}
          defaultModule="LPB_GR_101"
          vouchers={issueVouchers}
          lpbDocs={filteredDocs}
          stockItems={stockItems}
          costCenters={costCenters}
          glAccounts={glAccounts}
          initialStartDate={startDate}
          initialEndDate={endDate}
        />
      )}
    </div>
  );
};
