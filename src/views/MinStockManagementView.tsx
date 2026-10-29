import React, { useState, useMemo, useDeferredValue, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useInventory } from '../context/InventoryContext';
import {
  StockItem,
  MinStockProposal,
  getEffectivePermissions,
} from '../types/inventory';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Search,
  Check,
  X,
  TrendingDown,
  ArrowRight,
  MapPin,
  User,
  FileText,
  AlertCircle,
  Package,
  Lock,
  ShieldCheck,
  Edit3,
  Trash2,
  FileSpreadsheet,
  Info,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface MinStockManagementViewProps {
  onNavigateToLPB?: () => void;
  onNavigateToStockMaster?: () => void;
}

export const MinStockManagementView: React.FC<MinStockManagementViewProps> = () => {
  const {
    currentUser,
    stockItems,
    minStockProposals,
    createMinStockProposal,
    updateMinStockProposal,
    deleteMinStockProposal,
    verifyMinStockProposal,
    approveMinStockProposal,
    rejectMinStockProposal,
    lowStockItems,
    nearMinStockItems,
  } = useInventory();

  const perms = getEffectivePermissions(currentUser);
  const isAdmin = perms.canVerifyMinStock;
  const isKepalaGudang = perms.canApproveMinStockSystem;
  const isRequesterUser = currentUser?.role === 'user';

  // Navigation tabs: 'monitor' (Table & Alerts) vs 'proposals' (Proposals & 3-Step Verification/Approval)
  const [activeMainTab, setActiveMainTab] = useState<'monitor' | 'proposals'>('monitor');

  // Filter state for Tab 1 (Monitor)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'SAFE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);

  // Filter state for Tab 2 (Proposals)
  const [proposalStatusFilter, setProposalStatusFilter] = useState<
    'ALL' | 'PENDING' | 'VERIFIED_ADMIN' | 'APPROVED' | 'REJECTED'
  >('ALL');

  // Modal State for New / Edit Proposal
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<MinStockProposal | null>(null);
  const [selectedItemIdForProposal, setSelectedItemIdForProposal] = useState<string>('');
  const [proposalItemSearch, setProposalItemSearch] = useState<string>('');
  const [proposedMinStockInput, setProposedMinStockInput] = useState<number>(10);
  const [proposalReasonInput, setProposalReasonInput] = useState<string>('');
  const [proposalError, setProposalError] = useState<string>('');

  // Modal State for Admin Gudang Verification (Tahap 2: Kunci permohonan, belum ubah sistem)
  const [verifyingProposal, setVerifyingProposal] = useState<MinStockProposal | null>(null);
  const [verifiedMinStockInput, setVerifiedMinStockInput] = useState<number>(10);
  const [adminVerificationNotes, setAdminVerificationNotes] = useState<string>('');

  // Modal State for Kepala Gudang Approval (Tahap 3: Approve hasil verifikasi Admin & ubah sistem)
  const [approvingProposal, setApprovingProposal] = useState<MinStockProposal | null>(null);
  const [headApprovalNotes, setHeadApprovalNotes] = useState<string>('');

  // Modal State for Rejection Notes
  const [rejectingProposal, setRejectingProposal] = useState<MinStockProposal | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(stockItems.map((i) => i.category));
    return ['ALL', ...Array.from(set)];
  }, [stockItems]);

  // Evaluated stock items with warning level
  const evaluatedItems = useMemo(() => {
    return stockItems.map((item) => {
      const isCritical = item.currentStock <= item.minStock;
      const warningThreshold = item.minStock + Math.max(3, Math.round(item.minStock * 0.35));
      const isWarning = !isCritical && item.currentStock <= warningThreshold;
      const isSafe = !isCritical && !isWarning;
      const deficit = item.currentStock - item.minStock;

      return {
        ...item,
        isCritical,
        isWarning,
        isSafe,
        warningThreshold,
        deficit,
      };
    });
  }, [stockItems]);

  // Filtered items for Monitor Table
  const filteredItems = useMemo(() => {
    const q = deferredSearchQuery.trim().toLowerCase();
    return evaluatedItems.filter((item) => {
      if (statusFilter === 'CRITICAL' && !item.isCritical) return false;
      if (statusFilter === 'WARNING' && !item.isWarning) return false;
      if (statusFilter === 'SAFE' && !item.isSafe) return false;

      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;

      if (q) {
        const matchSku = item.sku.toLowerCase().includes(q);
        const matchName = item.name.toLowerCase().includes(q);
        const matchLoc = (item.location || '').toLowerCase().includes(q);
        return matchSku || matchName || matchLoc;
      }

      return true;
    });
  }, [evaluatedItems, statusFilter, categoryFilter, deferredSearchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, categoryFilter, deferredSearchQuery, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedMonitorItems = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredItems, safeCurrentPage, itemsPerPage]);

  const proposalModalOptions = useMemo(() => {
    const q = proposalItemSearch.trim().toLowerCase();
    const matched = q
      ? stockItems.filter(
          (i) => i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
        )
      : stockItems;
    const sliced = matched.slice(0, 100);
    if (selectedItemIdForProposal && !sliced.some((i) => i.id === selectedItemIdForProposal)) {
      const current = stockItems.find((i) => i.id === selectedItemIdForProposal);
      if (current) return [current, ...sliced];
    }
    return sliced;
  }, [stockItems, proposalItemSearch, selectedItemIdForProposal]);

  // Filtered proposals
  const filteredProposals = useMemo(() => {
    return minStockProposals.filter((prop) => {
      if (proposalStatusFilter !== 'ALL' && prop.status !== proposalStatusFilter) return false;
      return true;
    });
  }, [minStockProposals, proposalStatusFilter]);

  // Counts for badges
  const pendingAdminVerifyCount = useMemo(
    () => minStockProposals.filter((p) => p.status === 'PENDING').length,
    [minStockProposals]
  );
  const verifiedWaitingHeadCount = useMemo(
    () => minStockProposals.filter((p) => p.status === 'VERIFIED_ADMIN').length,
    [minStockProposals]
  );
  const approvedCount = useMemo(
    () => minStockProposals.filter((p) => p.status === 'APPROVED').length,
    [minStockProposals]
  );

  // Handler to open proposal modal for specific item
  const handleOpenProposalForItem = (item: StockItem) => {
    setEditingProposal(null);
    setSelectedItemIdForProposal(item.id);
    setProposedMinStockInput(Math.max(1, Math.round(item.minStock * 1.5)));
    setProposalReasonInput('');
    setProposalError('');
    setIsProposalModalOpen(true);
  };

  // Handler to open Edit modal for PENDING proposal
  const handleOpenEditProposal = (prop: MinStockProposal) => {
    setEditingProposal(prop);
    setSelectedItemIdForProposal(prop.itemId);
    setProposedMinStockInput(prop.proposedMinStock);
    setProposalReasonInput(prop.reason);
    setProposalError('');
    setIsProposalModalOpen(true);
  };

  // Handler to submit new or edited proposal
  const handleSubmitProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemIdForProposal) {
      setProposalError('Silakan pilih item barang terlebih dahulu.');
      return;
    }
    if (proposedMinStockInput <= 0) {
      setProposalError('Batas stok minimal baru harus lebih dari 0.');
      return;
    }
    if (!proposalReasonInput.trim()) {
      setProposalError('Alasan atau justifikasi perubahan stok minimal wajib diisi.');
      return;
    }

    if (editingProposal) {
      const res = updateMinStockProposal(editingProposal.id, {
        proposedMinStock: proposedMinStockInput,
        reason: proposalReasonInput.trim(),
      });
      if (res.success) {
        setIsProposalModalOpen(false);
        setEditingProposal(null);
        setProposalError('');
      } else {
        setProposalError(res.error || 'Gagal memperbarui pengajuan.');
      }
      return;
    }

    const res = createMinStockProposal({
      itemId: selectedItemIdForProposal,
      proposedMinStock: proposedMinStockInput,
      reason: proposalReasonInput.trim(),
    });

    if (res.success) {
      setIsProposalModalOpen(false);
      setSelectedItemIdForProposal('');
      setProposalReasonInput('');
      setProposalError('');
      setActiveMainTab('proposals');
    } else {
      setProposalError(res.error || 'Gagal mengirim pengajuan.');
    }
  };

  // Tahap 2: Admin Gudang Verifikasi (Kunci permohonan, belum ubah data minimal stock sistem)
  const handleConfirmAdminVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingProposal) return;
    verifyMinStockProposal(
      verifyingProposal.id,
      adminVerificationNotes.trim() ||
        'Telah diverifikasi oleh Admin Gudang. Permohonan dikunci dan diteruskan ke Kepala Gudang.',
      verifiedMinStockInput
    );
    setVerifyingProposal(null);
    setAdminVerificationNotes('');
  };

  // Tahap 3: Kepala Gudang Approve dari hasil verifikasi Admin Gudang (Otomatis mengubah data minimal stock sistem)
  const handleConfirmHeadApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingProposal) return;
    approveMinStockProposal(
      approvingProposal.id,
      headApprovalNotes.trim() ||
        'Approved oleh Kepala Gudang dari hasil verifikasi Admin Gudang. Data minimal stock sistem diperbarui.'
    );
    setApprovingProposal(null);
    setHeadApprovalNotes('');
  };

  // Reject confirmation handler
  const handleConfirmReject = () => {
    if (!rejectingProposal) return;
    if (!rejectionNotes.trim()) {
      return;
    }
    rejectMinStockProposal(rejectingProposal.id, rejectionNotes.trim());
    setRejectingProposal(null);
    setRejectionNotes('');
  };

  // Export Excel (.xlsx)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const monitorRows = [
      ['TABEL PANTAUAN BATAS STOK MINIMAL & PERINGATAN DINI'],
      [`Dicetak Tanggal: ${new Date().toLocaleDateString('id-ID')}`],
      [],
      [
        'No',
        'Material Code',
        'Nama Barang',
        'Kategori',
        'Lokasi Rak',
        'Stok Fisik Saat Ini',
        'Batas Stok Minimal Sistem',
        'Satuan',
        'Selisih Buffer',
        'Status Peringatan',
      ],
      ...filteredItems.map((it, idx) => [
        idx + 1,
        it.sku,
        it.name,
        it.category,
        it.location || '-',
        it.currentStock,
        it.minStock,
        it.unit,
        it.deficit,
        it.isCritical ? 'MELAMPAUI / KRITIS' : it.isWarning ? 'MENDEKATI MINIMAL' : 'STOK AMAN',
      ]),
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(monitorRows);
    ws1['!cols'] = [
      { wch: 5 },
      { wch: 16 },
      { wch: 34 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 20 },
      { wch: 10 },
      { wch: 14 },
      { wch: 20 },
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Pantauan Stok Minimal');

    const propRows = [
      ['DAFTAR PENGAJUAN PERUBAHAN BATAS STOK MINIMAL (ALUR 3 TAHAP)'],
      [],
      [
        'No',
        'No. Pengajuan',
        'Tanggal Pengajuan',
        'Material Code',
        'Nama Barang',
        'Min Stok Lama',
        'Usulan Pemohon',
        'Hasil Verifikasi Admin',
        'Satuan',
        'Pemohon',
        'Alasan Pengajuan',
        'Status Permohonan',
        'Diverifikasi Admin Gudang',
        'Approved Kepala Gudang',
      ],
      ...minStockProposals.map((p, idx) => [
        idx + 1,
        p.proposalNumber,
        new Date(p.requestDate).toLocaleDateString('id-ID'),
        p.sku,
        p.itemName,
        p.currentMinStock,
        p.proposedMinStock,
        p.verifiedMinStock ?? p.proposedMinStock,
        p.unit,
        p.requestedBy,
        p.reason,
        p.status === 'PENDING'
          ? 'Menunggu Verifikasi Admin Gudang'
          : p.status === 'VERIFIED_ADMIN'
          ? 'Terverifikasi Admin (Terkunci · Menunggu Approved Kepala Gudang)'
          : p.status === 'APPROVED'
          ? 'Approved Kepala Gudang (Data Sistem Berubah)'
          : 'Ditolak',
        p.verifiedByAdmin || '-',
        p.approvedByWarehouseHead || '-',
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(propRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Pengajuan Stok Minimal');

    XLSX.writeFile(wb, `Stok_Minimal_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const selectedItemObj = stockItems.find((i) => i.id === selectedItemIdForProposal);

  return (
    <div className="space-y-6">
      {/* 1. HEADER BANNER */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-600 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  Tabel Batas Stok Minimal &amp; Peringatan Dini
                </h1>
                <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                  Buffer &amp; Safety Stock
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Prosedur Pengajuan: (1) User Pemohon mengajukan &rarr; (2) User Admin Gudang memverifikasi (permohonan terkunci, belum mengubah sistem) &rarr; (3) User Kepala Gudang meng-approve hasil verifikasi Admin Gudang (otomatis mengubah data minimal stock sistem).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
            {(currentUser?.role === 'superuser' ||
              currentUser?.role === 'kepala_gudang' ||
              currentUser?.role === 'admin') && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors shadow-2xs"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Unduh Excel (.xlsx)</span>
              </button>
            )}

            <button
              onClick={() => {
                setEditingProposal(null);
                setSelectedItemIdForProposal(stockItems[0]?.id || '');
                setProposedMinStockInput(
                  stockItems[0]?.minStock ? Math.round(stockItems[0].minStock * 1.5) : 10
                );
                setProposalReasonInput('');
                setProposalError('');
                setIsProposalModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4 text-emerald-400" />
              <span>+ Ajukan Perubahan Stok Minimal</span>
            </button>
          </div>
        </div>

        {/* 2. STAT CARDS / RINGKASAN STOK MINIMAL */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-100">
          {/* Card 1: Total SKU Master */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Master Barang
              </span>
              <span className="text-xl font-black text-slate-900 font-mono">
                {stockItems.length} Material Code
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 shadow-2xs">
              <Package className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Kritis / Melampaui Batas Min */}
          <button
            onClick={() => {
              setActiveMainTab('monitor');
              setStatusFilter('CRITICAL');
            }}
            className={`rounded-xl p-3.5 border text-left flex items-center justify-between transition-all ${
              statusFilter === 'CRITICAL' && activeMainTab === 'monitor'
                ? 'bg-red-500 text-white border-red-600 shadow-sm'
                : 'bg-red-50 hover:bg-red-100/80 border-red-200 text-red-950'
            }`}
          >
            <div>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider block ${
                  statusFilter === 'CRITICAL' && activeMainTab === 'monitor'
                    ? 'text-red-100'
                    : 'text-red-700'
                }`}
              >
                Melampaui / Kritis (Stok &le; Min)
              </span>
              <span className="text-xl font-black font-mono">{lowStockItems.length} Barang</span>
            </div>
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-2xs ${
                statusFilter === 'CRITICAL' && activeMainTab === 'monitor'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-500 text-white'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
          </button>

          {/* Card 3: Menunggu Verifikasi Admin Gudang */}
          <button
            onClick={() => {
              setActiveMainTab('proposals');
              setProposalStatusFilter('PENDING');
            }}
            className={`rounded-xl p-3.5 border text-left flex items-center justify-between transition-all ${
              activeMainTab === 'proposals' && proposalStatusFilter === 'PENDING'
                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                : 'bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-amber-950'
            }`}
          >
            <div>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider block ${
                  activeMainTab === 'proposals' && proposalStatusFilter === 'PENDING'
                    ? 'text-slate-900'
                    : 'text-amber-800'
                }`}
              >
                Tahap 1: Menunggu Verifikasi Admin
              </span>
              <span className="text-xl font-black font-mono">
                {pendingAdminVerifyCount} Usulan
              </span>
            </div>
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-2xs">
              <Clock className="w-5 h-5" />
            </div>
          </button>

          {/* Card 4: Terverifikasi Admin (Terkunci) -> Menunggu Approved Kepala Gudang */}
          <button
            onClick={() => {
              setActiveMainTab('proposals');
              setProposalStatusFilter('VERIFIED_ADMIN');
            }}
            className={`rounded-xl p-3.5 border text-left flex items-center justify-between transition-all ${
              activeMainTab === 'proposals' && proposalStatusFilter === 'VERIFIED_ADMIN'
                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                : 'bg-blue-50 hover:bg-blue-100/80 border-blue-200 text-blue-950'
            }`}
          >
            <div>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider block ${
                  activeMainTab === 'proposals' && proposalStatusFilter === 'VERIFIED_ADMIN'
                    ? 'text-blue-100'
                    : 'text-blue-700'
                }`}
              >
                Tahap 2: Menunggu Approved Ka. Gudang
              </span>
              <span className="text-xl font-black font-mono">
                {verifiedWaitingHeadCount} Terkunci
              </span>
            </div>
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-2xs ${
                activeMainTab === 'proposals' && proposalStatusFilter === 'VERIFIED_ADMIN'
                  ? 'bg-blue-700 text-white'
                  : 'bg-blue-600 text-white'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
          </button>
        </div>
      </div>

      {/* 3. MAIN NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-2 shadow-2xs">
        <button
          onClick={() => setActiveMainTab('monitor')}
          className={`pb-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeMainTab === 'monitor'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-red-600" />
          <span>Tabel Pantauan Stok Minimal &amp; Peringatan ({stockItems.length})</span>
          {(lowStockItems.length > 0 || nearMinStockItems.length > 0) && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-red-600 text-white">
              {lowStockItems.length + nearMinStockItems.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveMainTab('proposals')}
          className={`pb-3 px-4 font-bold text-xs sm:text-sm border-b-2 transition-colors flex items-center gap-2 ${
            activeMainTab === 'proposals'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 text-blue-600" />
          <span>Daftar Pengajuan Perubahan Batas ({minStockProposals.length})</span>
          {(pendingAdminVerifyCount > 0 || verifiedWaitingHeadCount > 0) && (
            <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-slate-950">
              {pendingAdminVerifyCount + verifiedWaitingHeadCount} Aktif
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: TABEL PANTAUAN STOK MINIMAL & PERINGATAN */}
      {activeMainTab === 'monitor' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-4 sm:p-6 shadow-2xs space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-colors ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Barang ({stockItems.length})
              </button>

              <button
                onClick={() => setStatusFilter('CRITICAL')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'CRITICAL'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'text-red-700 hover:bg-red-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Melampaui / Kritis ({lowStockItems.length})</span>
              </button>

              <button
                onClick={() => setStatusFilter('WARNING')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'WARNING'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Mendekati Minimal ({nearMinStockItems.length})</span>
              </button>

              <button
                onClick={() => setStatusFilter('SAFE')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'SAFE'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Stok Aman</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'ALL' ? 'Semua Kategori' : c}
                  </option>
                ))}
              </select>

              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari Material Code, nama barang, rak..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10.5px]">
                <tr>
                  <th className="px-4 py-3">Barang &amp; Material Code</th>
                  <th className="px-4 py-3">Kategori &amp; Rak</th>
                  <th className="px-4 py-3 text-right">Stok Fisik Saat Ini</th>
                  <th className="px-4 py-3 text-right">Batas Stok Minimal Sistem</th>
                  <th className="px-4 py-3 text-center">Status Peringatan</th>
                  <th className="px-4 py-3 text-right">Selisih Buffer</th>
                  <th className="px-4 py-3 text-center">Aksi Pengajuan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-medium">
                      Tidak ada data barang yang cocok dengan kriteria filter saat ini.
                    </td>
                  </tr>
                ) : (
                  paginatedMonitorItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        item.isCritical
                          ? 'bg-red-50/40'
                          : item.isWarning
                          ? 'bg-amber-50/30'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="font-mono text-[11px] text-slate-500 font-semibold mt-0.5">
                          {item.sku}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-slate-600">
                        <div className="font-semibold">{item.category}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{item.location || '-'}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-black text-sm">
                        <span
                          className={
                            item.isCritical
                              ? 'text-red-700'
                              : item.isWarning
                              ? 'text-amber-700'
                              : 'text-slate-900'
                          }
                        >
                          {item.currentStock.toLocaleString('id-ID')} {item.unit}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                        <span>
                          {item.minStock.toLocaleString('id-ID')} {item.unit}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.isCritical ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-black bg-red-100 text-red-800 border border-red-300 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                            <span>MELAMPAUI / KRITIS</span>
                          </span>
                        ) : item.isWarning ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            <TrendingDown className="w-3.5 h-3.5 text-amber-700" />
                            <span>MENDEKATI MINIMAL</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Stok Aman</span>
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-xs whitespace-nowrap">
                        {item.deficit < 0 ? (
                          <span className="text-red-600">
                            Kurang {Math.abs(item.deficit)} {item.unit}
                          </span>
                        ) : item.deficit === 0 ? (
                          <span className="text-red-600">Pas Batas Min</span>
                        ) : item.isWarning ? (
                          <span className="text-amber-700">
                            Sisa +{item.deficit} {item.unit}
                          </span>
                        ) : (
                          <span className="text-emerald-700">
                            +{item.deficit} {item.unit} (Aman)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleOpenProposalForItem(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-colors"
                          title="Ajukan perubahan batas stok minimal baru untuk barang ini"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ajukan Perubahan</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer for Monitor Table */}
          {filteredItems.length > 0 && (
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-2">
                <span>
                  Menampilkan{' '}
                  <strong className="font-mono text-slate-900">
                    {(safeCurrentPage - 1) * itemsPerPage + 1}&ndash;
                    {Math.min(safeCurrentPage * itemsPerPage, filteredItems.length)}
                  </strong>{' '}
                  dari <strong className="font-mono text-slate-900">{filteredItems.length}</strong> barang
                </span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg font-mono font-semibold text-slate-800"
                >
                  {[25, 50, 100, 250].map((sz) => (
                    <option key={sz} value={sz}>
                      {sz} / hal
                    </option>
                  ))}
                </select>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage <= 1}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-semibold"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Prev</span>
                  </button>
                  <span className="px-2.5 py-1.5 rounded-lg bg-slate-900 text-white font-mono font-bold">
                    Hal {safeCurrentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage >= totalPages}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-semibold"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DAFTAR PENGAJUAN PERUBAHAN BATAS (ALUR 3 TAHAP) */}
      {activeMainTab === 'proposals' && (
        <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-4 sm:p-6 shadow-2xs space-y-4">
          {/* Prosedur Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>Prosedur Pengajuan Minimal Stock:</strong> (1){' '}
              <strong>User Pemohon</strong> mengajukan perubahan minimal stock (dapat diedit/dihapus sebelum diverifikasi Admin Gudang). (2){' '}
              <strong>User Admin Gudang</strong> melakukan verifikasi terhadap pengajuan &mdash;{' '}
              <strong>permohonan terkunci tetapi belum mengganti data minimal stock pada sistem</strong>. (3){' '}
              <strong>User Kepala Gudang</strong> melakukan <strong>Approved</strong> dari hasil verifikasi Admin Gudang &mdash;{' '}
              <strong>data minimal stock pada sistem otomatis berubah</strong>.
            </div>
          </div>

          {/* Proposal Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs">
              <button
                onClick={() => setProposalStatusFilter('ALL')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-colors ${
                  proposalStatusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({minStockProposals.length})
              </button>
              <button
                onClick={() => setProposalStatusFilter('PENDING')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  proposalStatusFilter === 'PENDING'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                    : 'text-amber-800 hover:bg-amber-50'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Menunggu Verifikasi Admin ({pendingAdminVerifyCount})</span>
              </button>
              <button
                onClick={() => setProposalStatusFilter('VERIFIED_ADMIN')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  proposalStatusFilter === 'VERIFIED_ADMIN'
                    ? 'bg-blue-600 text-white font-bold shadow-2xs'
                    : 'text-blue-800 hover:bg-blue-50'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Terverifikasi Admin · Menunggu Approved Ka. Gudang ({verifiedWaitingHeadCount})</span>
              </button>
              <button
                onClick={() => setProposalStatusFilter('APPROVED')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  proposalStatusFilter === 'APPROVED'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approved Ka. Gudang · Berlaku di Sistem ({approvedCount})</span>
              </button>
              <button
                onClick={() => setProposalStatusFilter('REJECTED')}
                className={`px-3 py-1.5 font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                  proposalStatusFilter === 'REJECTED'
                    ? 'bg-red-600 text-white shadow-2xs'
                    : 'text-red-700 hover:bg-red-50'
                }`}
              >
                <X className="w-3.5 h-3.5" />
                <span>Ditolak</span>
              </button>
            </div>

            <div className="text-xs text-slate-500">
              {isAdmin ? (
                <span className="font-semibold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                  Login: Admin Gudang (Berwenang Verifikasi &amp; Mengunci Permohonan)
                </span>
              ) : isKepalaGudang ? (
                <span className="font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  Login: Kepala Gudang (Berwenang Approved Hasil Verifikasi Admin &amp; Mengubah Sistem)
                </span>
              ) : (
                <span>
                  Sebagai User Pemohon, permohonan dapat diedit/dihapus sebelum diverifikasi Admin Gudang.
                </span>
              )}
            </div>
          </div>

          {/* Proposals List Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10.5px]">
                <tr>
                  <th className="px-4 py-3">No. Pengajuan &amp; Tgl</th>
                  <th className="px-4 py-3">Item Barang</th>
                  <th className="px-4 py-3 text-center">Batas Min Lama &rarr; Usulan Baru</th>
                  <th className="px-4 py-3">Pemohon &amp; Alasan</th>
                  <th className="px-4 py-3 text-center">Status &amp; Posisi Alur</th>
                  <th className="px-4 py-3 text-center">Verifikasi Admin &amp; Approval Ka. Gudang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProposals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-medium">
                      Belum ada pengajuan batas stok minimal dalam status ini.
                    </td>
                  </tr>
                ) : (
                  filteredProposals.map((prop) => {
                    const isPending = prop.status === 'PENDING';
                    const isVerifiedAdmin = prop.status === 'VERIFIED_ADMIN';
                    const isApproved = prop.status === 'APPROVED';
                    const isRejected = prop.status === 'REJECTED';
                    const isLocked = isVerifiedAdmin || isApproved;
                    const canRequesterEdit =
                      isPending &&
                      (prop.requestedByUserId === currentUser?.id ||
                        prop.requestedBy === currentUser?.name ||
                        isRequesterUser);

                    return (
                      <tr key={prop.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* 1. Doc Number & Date */}
                        <td className="px-4 py-3 font-mono">
                          <div className="font-bold text-slate-900">{prop.proposalNumber}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {new Date(prop.requestDate).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </td>

                        {/* 2. Item */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{prop.itemName}</div>
                          <div className="font-mono text-[11px] text-slate-500">{prop.sku}</div>
                        </td>

                        {/* 3. Old vs Proposed */}
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-100 rounded-lg font-mono font-bold text-xs">
                            <span className="text-slate-600 line-through">
                              {prop.currentMinStock} {prop.unit}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-amber-600" />
                            <span className="text-emerald-700 text-sm font-black">
                              {prop.verifiedMinStock ?? prop.proposedMinStock} {prop.unit}
                            </span>
                          </div>
                          {isVerifiedAdmin && (
                            <span className="block text-[10px] font-semibold text-blue-700 mt-1">
                              Sistem masih {prop.currentMinStock} {prop.unit} (Menunggu Approved Ka. Gudang)
                            </span>
                          )}
                          {isApproved && (
                            <span className="block text-[10px] font-semibold text-emerald-700 mt-1">
                              Sistem resmi berubah: {prop.verifiedMinStock ?? prop.proposedMinStock}{' '}
                              {prop.unit}
                            </span>
                          )}
                        </td>

                        {/* 4. Requester & Reason */}
                        <td className="px-4 py-3 max-w-xs">
                          <div className="font-semibold text-slate-900 flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{prop.requestedBy}</span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2 italic bg-slate-50 p-1.5 rounded-md border border-slate-200">
                            &ldquo;{prop.reason}&rdquo;
                          </div>
                        </td>

                        {/* 5. Status Badge */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {isPending && (
                            <div className="inline-flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <Clock className="w-3 h-3 text-amber-700" />
                                <span>Tahap 1: Menunggu Verifikasi Admin Gudang</span>
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Belum Terkunci (Pemohon bisa Edit/Hapus)
                              </span>
                            </div>
                          )}
                          {isVerifiedAdmin && (
                            <div className="inline-flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
                                <Lock className="w-3 h-3 text-blue-700" />
                                <span>Tahap 2: Terverifikasi Admin (Permohonan Terkunci)</span>
                              </span>
                              <span className="text-[10px] text-blue-700 font-semibold">
                                Belum mengubah sistem &middot; Menunggu Approved Kepala Gudang
                              </span>
                            </div>
                          )}
                          {isApproved && (
                            <div className="inline-flex flex-col items-center gap-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Tahap 3: Approved Kepala Gudang (Aktif di Sistem)</span>
                              </span>
                              <span className="text-[10px] text-emerald-700 font-semibold">
                                Data minimal stock pada sistem telah berubah
                              </span>
                            </div>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-red-100 text-red-800 border border-red-300">
                              <X className="w-3 h-3 text-red-600" />
                              <span>Ditolak</span>
                            </span>
                          )}
                        </td>

                        {/* 6. Actions / Audit Trail */}
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {isPending && (
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              {isAdmin && (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setVerifyingProposal(prop);
                                      setVerifiedMinStockInput(prop.proposedMinStock);
                                      setAdminVerificationNotes('');
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-2xs transition-colors"
                                    title="Verifikasi permohonan ini oleh Admin Gudang (Permohonan terkunci tetapi belum mengubah data minimal stock sistem)"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>Verifikasi &amp; Kunci (Admin Gudang)</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectingProposal(prop);
                                      setRejectionNotes('');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-red-50 border border-red-200 text-red-600 font-semibold rounded-lg transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Tolak</span>
                                  </button>
                                </div>
                              )}

                              {isKepalaGudang && (
                                <span className="text-[10.5px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 font-medium">
                                  Menunggu Verifikasi Admin Gudang terlebih dahulu
                                </span>
                              )}

                              {canRequesterEdit && (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditProposal(prop)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
                                    title="Edit permohonan minimal stock (sebelum diverifikasi Admin Gudang)"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Batalkan dan hapus permohonan #${prop.proposalNumber}?`
                                        )
                                      ) {
                                        deleteMinStockProposal(prop.id);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-red-600 bg-white hover:bg-red-50 border border-red-200 rounded-lg transition-colors"
                                    title="Hapus permohonan (sebelum diverifikasi Admin Gudang)"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Hapus</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {isVerifiedAdmin && (
                            <div className="flex flex-col items-center justify-center gap-1.5">
                              <div className="text-[10.5px] text-blue-900 font-medium">
                                Diverifikasi Admin: <strong>{prop.verifiedByAdmin || 'Admin Gudang'}</strong>
                              </div>

                              {isKepalaGudang ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setApprovingProposal(prop);
                                      setHeadApprovalNotes('');
                                    }}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-2xs transition-colors"
                                    title="Approved oleh Kepala Gudang dari hasil verifikasi Admin Gudang (Otomatis mengubah data minimal stock sistem)"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Approve &amp; Ubah Sistem (Kepala Gudang)</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRejectingProposal(prop);
                                      setRejectionNotes('');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-red-50 border border-red-200 text-red-600 font-semibold rounded-lg transition-colors"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Tolak</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-blue-800 bg-blue-50 px-2.5 py-1 rounded border border-blue-200 font-medium">
                                  <Lock className="w-3 h-3 text-blue-600" />
                                  <span>Permohonan Terkunci · Menunggu Approved Kepala Gudang</span>
                                </span>
                              )}
                            </div>
                          )}

                          {isApproved && (
                            <div className="text-[10.5px] text-emerald-900 font-medium space-y-0.5">
                              {prop.verifiedByAdmin && (
                                <div className="text-blue-800">
                                  Verifikasi Admin: <strong>{prop.verifiedByAdmin}</strong>
                                </div>
                              )}
                              <div>
                                Approved Ka. Gudang:{' '}
                                <strong>{prop.approvedByWarehouseHead || prop.reviewedByAdmin}</strong>
                              </div>
                              <div className="text-[9.5px] text-slate-500">
                                {prop.approvedAt || prop.reviewedAt
                                  ? new Date(
                                      (prop.approvedAt || prop.reviewedAt)!
                                    ).toLocaleDateString('id-ID', {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : ''}
                              </div>
                            </div>
                          )}

                          {isRejected && (
                            <div
                              className="text-[10.5px] text-red-900 font-medium max-w-[200px] truncate mx-auto"
                              title={prop.adminNotes}
                            >
                              <div>Ditolak: {prop.reviewedByAdmin}</div>
                              <div className="text-[9.5px] text-slate-500 italic truncate">
                                Alasan: {prop.adminNotes || '-'}
                              </div>
                            </div>
                          )}

                          {isLocked && isRequesterUser && (
                            <div className="mt-1 text-[10px] text-slate-400 flex items-center justify-center gap-1">
                              <Lock className="w-3 h-3" />
                              <span>Terkunci (Tidak dapat diedit/dihapus)</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: AJUKAN / EDIT PERUBAHAN BATAS STOK MINIMAL (PEMOHON) */}
      {isProposalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingProposal
                      ? `Edit Permohonan #${editingProposal.proposalNumber}`
                      : 'Form Pengajuan Batas Stok Minimal'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Diverifikasi oleh Admin Gudang (mengunci permohonan), lalu di-approve oleh Kepala Gudang untuk mengubah data sistem.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsProposalModalOpen(false);
                  setEditingProposal(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitProposal} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  Pilih Item Master Barang:
                </label>
                {!editingProposal && stockItems.length > 50 && (
                  <input
                    type="text"
                    value={proposalItemSearch}
                    onChange={(e) => setProposalItemSearch(e.target.value)}
                    placeholder="Ketik Material Code / nama barang untuk menyaring pilihan..."
                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                )}
                <select
                  disabled={!!editingProposal}
                  value={selectedItemIdForProposal}
                  onChange={(e) => {
                    setSelectedItemIdForProposal(e.target.value);
                    const itm = stockItems.find((i) => i.id === e.target.value);
                    if (itm) {
                      setProposedMinStockInput(Math.max(1, Math.round(itm.minStock * 1.5)));
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900 disabled:opacity-60"
                >
                  <option value="">-- Pilih Barang --</option>
                  {proposalModalOptions.map((itm) => (
                    <option key={itm.id} value={itm.id}>
                      {itm.sku} - {itm.name} (Min saat ini: {itm.minStock} {itm.unit} | Fisik:{' '}
                      {itm.currentStock} {itm.unit})
                    </option>
                  ))}
                </select>
              </div>

              {selectedItemObj && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Stok Fisik di Rak:</span>
                    <strong className="text-slate-900 font-mono text-sm">
                      {selectedItemObj.currentStock} {selectedItemObj.unit}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Batas Min Sistem Saat Ini:</span>
                    <strong className="text-slate-900 font-mono text-sm">
                      {selectedItemObj.minStock} {selectedItemObj.unit}
                    </strong>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Usulan Batas Stok Minimal Baru:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={proposedMinStockInput}
                    onChange={(e) =>
                      setProposedMinStockInput(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-black font-mono text-slate-900 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                  />
                  <span className="text-xs font-bold text-slate-700 shrink-0">
                    {selectedItemObj?.unit || 'Unit'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Alasan &amp; Justifikasi Kebutuhan Perubahan:
                </label>
                <textarea
                  rows={3}
                  value={proposalReasonInput}
                  onChange={(e) => setProposalReasonInput(e.target.value)}
                  placeholder="Misal: Lead time pengiriman dari vendor meningkat dari 3 hari menjadi 10 hari..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-slate-900"
                />
              </div>

              {proposalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{proposalError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsProposalModalOpen(false);
                    setEditingProposal(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  {editingProposal ? 'Simpan Perubahan Permohonan' : 'Kirim Pengajuan ke Admin Gudang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VERIFIKASI OLEH USER ADMIN GUDANG (TAHAP 2 — KUNCI PERMOHONAN, BELUM UBAH SISTEM) */}
      {verifyingProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Verifikasi Pengajuan Minimal Stock (Admin Gudang)
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {verifyingProposal.proposalNumber} &middot; Pemohon: {verifyingProposal.requestedBy}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setVerifyingProposal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAdminVerify} className="space-y-4 text-xs">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-blue-900">
                  <Lock className="w-4 h-4 text-blue-700" />
                  Tahap 2: Permohonan Terkunci Namun Belum Mengubah Sistem
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Setelah diverifikasi oleh Admin Gudang, <strong>permohonan ini akan terkunci</strong> (pemohon tidak dapat mengedit/menghapus), <strong>tetapi belum mengganti data minimal stock pada sistem</strong>. Data minimal stock baru akan berubah apabila <strong>User Kepala Gudang sudah Approved</strong> dari hasil verifikasi ini.
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900">
                  {verifyingProposal.itemName} ({verifyingProposal.sku})
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Batas Minimal Sistem Saat Ini:</span>
                  <strong className="font-mono text-slate-900">
                    {verifyingProposal.currentMinStock} {verifyingProposal.unit}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Usulan dari Pemohon ({verifyingProposal.requestedBy}):</span>
                  <strong className="font-mono text-emerald-700">
                    {verifyingProposal.proposedMinStock} {verifyingProposal.unit}
                  </strong>
                </div>
                <div className="text-[11px] italic text-slate-600 pt-1 border-t border-slate-200">
                  Alasan Pemohon: &ldquo;{verifyingProposal.reason}&rdquo;
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Angka Minimal Stock Hasil Verifikasi Admin Gudang ({verifyingProposal.unit}):
                </label>
                <input
                  type="number"
                  min={1}
                  value={verifiedMinStockInput}
                  onChange={(e) =>
                    setVerifiedMinStockInput(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-black font-mono text-slate-900 focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Catatan Verifikasi Admin Gudang (Opsional):
                </label>
                <textarea
                  rows={2}
                  value={adminVerificationNotes}
                  onChange={(e) => setAdminVerificationNotes(e.target.value)}
                  placeholder="Contoh: Telah diverifikasi sesuai histori pemakaian, diteruskan ke Kepala Gudang..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVerifyingProposal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Konfirmasi Verifikasi &amp; Kunci Permohonan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: APPROVAL FINAL OLEH USER KEPALA GUDANG (TAHAP 3 — MENGUBAH DATA MINIMAL STOCK SISTEM) */}
      {approvingProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Approval Kepala Gudang — Ubah Minimal Stock Sistem
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {approvingProposal.proposalNumber} &middot; Terverifikasi oleh:{' '}
                    {approvingProposal.verifiedByAdmin || 'Admin Gudang'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApprovingProposal(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmHeadApprove} className="space-y-4 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Tahap 3: Approved Kepala Gudang dari Hasil Verifikasi Admin Gudang
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Dengan meng-approve permohonan yang telah diverifikasi Admin Gudang ini, <strong>data minimal stock pada sistem akan langsung berubah secara otomatis</strong> dari{' '}
                  <strong>
                    {approvingProposal.currentMinStock} {approvingProposal.unit}
                  </strong>{' '}
                  menjadi{' '}
                  <strong>
                    {approvingProposal.verifiedMinStock ?? approvingProposal.proposedMinStock}{' '}
                    {approvingProposal.unit}
                  </strong>
                  .
                </p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900">
                  {approvingProposal.itemName} ({approvingProposal.sku})
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Pemohon Awal:</span>
                  <strong className="text-slate-900">{approvingProposal.requestedBy}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Diverifikasi oleh Admin Gudang:</span>
                  <strong className="text-blue-700">
                    {approvingProposal.verifiedByAdmin || 'Admin Gudang'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Perubahan Minimal Stock Sistem:</span>
                  <strong className="font-mono text-emerald-700 text-sm">
                    {approvingProposal.currentMinStock} {approvingProposal.unit} &rarr;{' '}
                    {approvingProposal.verifiedMinStock ?? approvingProposal.proposedMinStock}{' '}
                    {approvingProposal.unit}
                  </strong>
                </div>
                {approvingProposal.adminVerificationNotes && (
                  <div className="text-[11px] text-blue-800 pt-1 border-t border-slate-200">
                    Catatan Verifikasi Admin: &ldquo;{approvingProposal.adminVerificationNotes}&rdquo;
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Catatan Approval Kepala Gudang (Opsional):
                </label>
                <textarea
                  rows={2}
                  value={headApprovalNotes}
                  onChange={(e) => setHeadApprovalNotes(e.target.value)}
                  placeholder="Contoh: Disetujui Kepala Gudang dari hasil verifikasi Admin Gudang, efektif berlaku di sistem."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setApprovingProposal(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Approved &amp; Perbarui Data Minimal Stock Sistem</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: TOLAK PENGAJUAN */}
      {rejectingProposal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-2xl border border-slate-200 w-full max-w-md">
            <h3 className="font-bold text-slate-900 text-base mb-1">
              Tolak Pengajuan Stok Minimal
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {rejectingProposal.proposalNumber} &mdash; {rejectingProposal.itemName} (Usulan:{' '}
              {rejectingProposal.proposedMinStock} {rejectingProposal.unit})
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Alasan Penolakan:
                </label>
                <textarea
                  rows={3}
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  placeholder="Contoh: Kapasitas rak saat ini belum mencukupi..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-red-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setRejectingProposal(null)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmReject}
                  disabled={!rejectionNotes.trim()}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg"
                >
                  Konfirmasi Tolak
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
