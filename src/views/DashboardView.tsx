import React, { useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  IssueVoucherDocument,
  LPBDocument,
  StockItem,
  getEffectivePermissions,
  getRoleLabel,
} from '../types/inventory';
import {
  Package,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  Printer,
  ChevronRight,
  UserCheck,
  Layers,
  ShieldAlert,
  Lock,
  ScanBarcode,
  SlidersHorizontal,
} from 'lucide-react';

interface DashboardViewProps {
  onOpenCreateLPB: () => void;
  onOpenCreateVoucher: () => void;
  onOpenApproval: (voucher: IssueVoucherDocument) => void;
  onPrintDocument: (type: 'LPB' | 'NPB', doc: LPBDocument | IssueVoucherDocument) => void;
  onNavigateTab: (tab: string) => void;
}

interface UrgentStockPreview {
  item: StockItem;
  availableStock: number;
  status: 'CRITICAL' | 'WARNING';
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onOpenCreateLPB,
  onOpenCreateVoucher,
  onOpenApproval,
  onPrintDocument,
  onNavigateTab,
}) => {
  const {
    currentUser,
    roleDefinitions,
    stockItems,
    lpbDocuments,
    issueVouchers,
    stockMovements,
    minStockProposals,
    activeStockOpname,
    isStockLockedForOpname,
  } = useInventory();

  const perms = useMemo(
    () => getEffectivePermissions(currentUser, roleDefinitions),
    [currentUser, roleDefinitions]
  );

  const isRequesterUser = !perms.canViewAllSIV;
  const isViewerOnly =
    !perms.canCreateSIV &&
    !perms.canCreateLPB &&
    !perms.canValidateSIV &&
    !perms.canApproveSIVStockDeduction;

  // Single-pass O(N) lightweight summary calculation without cloning all items
  const stockSummary = useMemo(() => {
    let totalPhysicalStock = 0;
    let safeCount = 0;
    let warningCount = 0;
    let criticalCount = 0;
    const urgentList: UrgentStockPreview[] = [];

    for (let i = 0; i < stockItems.length; i++) {
      const item = stockItems[i];
      const current = Number(item.currentStock) || 0;
      const allocated = Number(item.allocatedStock) || 0;
      const min = Number(item.minStock) || 0;
      const available = Math.max(0, current - allocated);

      totalPhysicalStock += current;

      if (min > 0 && current <= min) {
        criticalCount++;
        if (urgentList.length < 24) {
          urgentList.push({ item, availableStock: available, status: 'CRITICAL' });
        }
      } else if (min > 0 && current <= Math.ceil(min * 1.25)) {
        warningCount++;
        if (urgentList.length < 24) {
          urgentList.push({ item, availableStock: available, status: 'WARNING' });
        }
      } else {
        safeCount++;
      }
    }

    urgentList.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'CRITICAL' ? -1 : 1;
      return a.item.currentStock - b.item.currentStock;
    });

    return {
      totalSku: stockItems.length,
      totalPhysicalStock,
      safeCount,
      warningCount,
      criticalCount,
      topUrgentItems: urgentList.slice(0, 6),
    };
  }, [stockItems]);

  // Filter & prioritize active SIV vouchers (PENDING first, capped for fast rendering)
  const { pendingVouchers, completedCount } = useMemo(() => {
    const visible = isRequesterUser
      ? issueVouchers.filter(
          (v) => v.userId === currentUser?.id || v.requestedBy === currentUser?.name
        )
      : issueVouchers;

    const active: IssueVoucherDocument[] = [];
    let done = 0;

    for (let i = 0; i < visible.length; i++) {
      const v = visible[i];
      if (v.status === 'PENDING' || v.status === 'APPROVED') {
        active.push(v);
      } else if (v.status === 'COMPLETED' || v.status === 'HANDOVER_COMPLETED') {
        done++;
      }
    }

    // Prioritize PENDING at the top
    active.sort((a, b) => {
      if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
      if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
      return (b.requestDate || '').localeCompare(a.requestDate || '');
    });

    return {
      pendingVouchers: active,
      completedCount: done,
    };
  }, [issueVouchers, isRequesterUser, currentUser]);

  const activeMinStockProposalsCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < minStockProposals.length; i++) {
      const s = minStockProposals[i].status;
      if (s === 'PENDING' || s === 'VERIFIED_ADMIN') count++;
    }
    return count;
  }, [minStockProposals]);

  const recentLpbs = useMemo(() => lpbDocuments.slice(0, 3), [lpbDocuments]);
  const recentMovements = useMemo(() => stockMovements.slice(0, 5), [stockMovements]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-5">
      {/* Stock Opname Lock Banner (only shown when active) */}
      {isStockLockedForOpname && activeStockOpname && (
        <div className="bg-rose-950 text-white rounded-xl p-4 border border-rose-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-600 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-200">
                  Stok Akhir Terkunci Sementara
                </span>
                <span className="text-xs font-mono text-rose-300">
                  ({activeStockOpname.opnameNumber})
                </span>
              </div>
              <p className="text-xs text-rose-100 mt-0.5">
                Sesi <strong>{activeStockOpname.title}</strong> sedang berjalan. Transaksi LPB &amp; SIV dikunci sementara hingga perhitungan fisik selesai.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('stock-opname')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-white text-rose-950 hover:bg-rose-100 rounded-lg transition-colors shrink-0 cursor-pointer"
          >
            <ScanBarcode className="w-4 h-4 text-rose-700" />
            <span>Buka Stock Opname</span>
          </button>
        </div>
      )}

      {/* Compact Welcome & Quick Actions Bar */}
      <div className="bg-slate-900 text-white rounded-xl p-4 sm:p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="font-semibold text-emerald-400">
              {getRoleLabel(currentUser?.role || 'viewer', roleDefinitions)}
            </span>
            <span>&middot;</span>
            <span>{currentUser?.department || 'Operasional Store'}</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight mt-1">
            Selamat bertugas, {currentUser?.name}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Ringkasan cepat posisi stok gudang, antrean persetujuan SIV, dan penerimaan LPB.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {perms.canCreateLPB && !isStockLockedForOpname && (
            <button
              onClick={onOpenCreateLPB}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>+ Input LPB</span>
            </button>
          )}

          {perms.canCreateSIV && !isStockLockedForOpname && (
            <button
              onClick={onOpenCreateVoucher}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>+ Buat Nota SIV</span>
            </button>
          )}

          <button
            onClick={() => onNavigateTab('stock')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <Package className="w-4 h-4 text-emerald-400" />
            <span>Master Stok ({stockSummary.totalSku.toLocaleString('id-ID')})</span>
          </button>
        </div>
      </div>

      {/* 4 Simple, Fast KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigateTab('stock')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Total Katalog Barang</span>
            <Package className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
              {stockSummary.totalSku.toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-slate-500">SKU</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{stockSummary.safeCount.toLocaleString('id-ID')} SKU Stok Aman</span>
            <span className="text-emerald-700 font-semibold">Lihat Katalog &rarr;</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab( isViewerOnly ? 'stock' : 'min-stock')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-red-300 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Stok Kritis (&le; Min)</span>
            <ShieldAlert className="w-4 h-4 text-red-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-red-600 tabular-nums">
              {stockSummary.criticalCount.toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-red-700 font-medium">SKU Wajib Restock</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Melewati batas minimal</span>
            <span className="text-red-700 font-semibold">Cek Detail &rarr;</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateTab(isViewerOnly ? 'stock' : 'min-stock')}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-amber-300 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">Stok Menipis (Mendekati Min)</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-600 tabular-nums">
              {stockSummary.warningCount.toLocaleString('id-ID')}
            </span>
            <span className="text-xs text-amber-700 font-medium">SKU Siaga</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              {activeMinStockProposalsCount > 0
                ? `${activeMinStockProposalsCount} usulan min stok aktif`
                : 'Pantau kebutuhan order'}
            </span>
            <span className="text-amber-700 font-semibold">Kelola &rarr;</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            if (perms.canCreateSIV || perms.canViewAllSIV) {
              onNavigateTab('vouchers');
            }
          }}
          className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-300 text-left transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-semibold">
              {isRequesterUser ? 'Nota SIV Anda (Proses)' : 'Antrean Nota SIV Aktif'}
            </span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-blue-600 tabular-nums">
              {pendingVouchers.length}
            </span>
            <span className="text-xs text-blue-700 font-medium">
              Nota ({completedCount} Selesai)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              {pendingVouchers.length > 0 ? 'Menunggu ACC / Verifikasi' : 'Semua nota selesai'}
            </span>
            <span className="text-blue-700 font-semibold">Buka SIV &rarr;</span>
          </div>
        </button>
      </div>

      {/* Main 2-Column Operational Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column (2 cols): Pending SIV Queue & Recent LPB */}
        <div className="lg:col-span-2 space-y-5">
          {/* Active SIV Queue (capped at 5 items for instant load) */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <h2 className="text-sm font-bold text-slate-900">
                  {isRequesterUser
                    ? `Antrean Nota SIV Anda (${pendingVouchers.length})`
                    : `Antrean Validasi & Approval Nota SIV (${pendingVouchers.length})`}
                </h2>
              </div>
              {(perms.canCreateSIV || perms.canViewAllSIV) && (
                <button
                  onClick={() => onNavigateTab('vouchers')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>Lihat Semua</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {pendingVouchers.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs flex flex-col items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <span>Tidak ada antrean nota SIV yang menunggu validasi saat ini.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingVouchers.slice(0, 5).map((voucher) => {
                  const isWaitingAdminHandover = voucher.status === 'APPROVED';
                  return (
                    <div
                      key={voucher.id}
                      className="p-3.5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-mono font-bold text-slate-900">
                            {voucher.voucherNumber}
                          </span>
                          <span className="text-slate-300">&middot;</span>
                          <span className="text-slate-700 font-medium">{voucher.department}</span>
                          <span className="text-slate-300">&middot;</span>
                          <span className="text-slate-500">{formatDate(voucher.requestDate)}</span>
                        </div>

                        <p className="text-xs text-slate-800 font-medium mt-0.5 truncate">
                          {voucher.purpose}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span>Pemohon: {voucher.requestedBy}</span>
                          <span>&middot;</span>
                          <span>{voucher.items.length} macam barang</span>
                          <span>&middot;</span>
                          <span
                            className={
                              isWaitingAdminHandover
                                ? 'text-blue-700 font-semibold'
                                : 'text-amber-700 font-semibold'
                            }
                          >
                            {isWaitingAdminHandover
                              ? 'Di-ACC Kepala Store · Menunggu Penyerahan Admin'
                              : 'Menunggu ACC Kepala Store'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onPrintDocument('NPB', voucher)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Cetak</span>
                        </button>

                        {((!isWaitingAdminHandover && perms.canApproveSIVStockDeduction) ||
                          (isWaitingAdminHandover && perms.canValidateSIV)) && (
                          <button
                            onClick={() => onOpenApproval(voucher)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                              isWaitingAdminHandover
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                : 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold'
                            }`}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>
                              {isWaitingAdminHandover ? 'Serahkan Barang' : 'ACC SIV'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {pendingVouchers.length > 5 && (
                  <div className="px-4 py-2.5 bg-slate-50 text-center">
                    <button
                      onClick={() => onNavigateTab('vouchers')}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                    >
                      Lihat {pendingVouchers.length - 5} antrean nota SIV lainnya &rarr;
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent LPB Documents (capped at 3) */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                <h2 className="text-sm font-bold text-slate-900">
                  Penerimaan Barang Terkini (LPB)
                </h2>
              </div>
              {(perms.canCreateLPB || perms.canApproveLPBStockAddition) && (
                <button
                  onClick={() => onNavigateTab('lpb')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>Lihat Semua</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {recentLpbs.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                Belum ada riwayat dokumen LPB penerimaan barang.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentLpbs.map((lpb) => {
                  const isPendingLpb = lpb.status === 'PENDING_APPROVAL';
                  return (
                    <div
                      key={lpb.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/70"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="font-mono font-bold text-slate-900">
                            {lpb.lpbNumber}
                          </span>
                          <span className="text-slate-300">&middot;</span>
                          <span className="text-slate-600 font-mono">SJ: {lpb.sjNumber}</span>
                          <span className="text-slate-300">&middot;</span>
                          <span
                            className={
                              isPendingLpb
                                ? 'text-amber-700 font-semibold'
                                : 'text-emerald-700 font-semibold'
                            }
                          >
                            {isPendingLpb ? 'Menunggu Approve Ka. Store' : 'Stok Bertambah'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-800 font-medium mt-0.5 truncate">
                          {lpb.supplierName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {formatDate(lpb.receivedDate)} &middot; {lpb.items.length} item barang
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isPendingLpb && perms.canApproveLPBStockAddition && (
                          <button
                            onClick={() => onNavigateTab('lpb')}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
                          >
                            Approve LPB
                          </button>
                        )}
                        <button
                          onClick={() => onPrintDocument('LPB', lpb)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Cetak</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Urgent Restock (Max 6) & Latest Movements (Max 5) */}
        <div className="space-y-5">
          {/* Urgent Restock Items */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h2 className="text-sm font-bold text-slate-900">Prioritas Restock</h2>
              </div>
              <button
                onClick={() => onNavigateTab(isViewerOnly ? 'stock' : 'min-stock')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Semua ({stockSummary.criticalCount + stockSummary.warningCount})</span>
              </button>
            </div>

            {stockSummary.topUrgentItems.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-500">
                Seluruh barang berada pada level stok aman di atas batas minimal.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {stockSummary.topUrgentItems.map(({ item, status }) => {
                  const isCrit = status === 'CRITICAL';
                  return (
                    <div key={item.id} className="p-3 text-xs hover:bg-slate-50/70">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-semibold text-slate-900 block truncate">
                            {item.name}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {item.sku} &middot; {item.location}
                          </span>
                        </div>
                        <span
                          className={`font-mono font-bold tabular-nums shrink-0 ${
                            isCrit ? 'text-red-600' : 'text-amber-600'
                          }`}
                        >
                          {item.currentStock} {item.unit}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>
                          Min: <strong>{item.minStock} {item.unit}</strong> &middot;{' '}
                          <span className={isCrit ? 'text-red-700 font-semibold' : 'text-amber-700 font-semibold'}>
                            {isCrit ? 'Kritis' : 'Menipis'}
                          </span>
                        </span>
                        {perms.canCreateLPB && !isStockLockedForOpname && (
                          <button
                            onClick={onOpenCreateLPB}
                            className="text-emerald-700 hover:text-emerald-900 font-semibold underline cursor-pointer"
                          >
                            + LPB
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Latest Stock Movements */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">Mutasi Terakhir</h3>
              </div>
              {perms.canAccessStockMovement && (
                <button
                  onClick={() => onNavigateTab('movements')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                >
                  Kartu Stok &rarr;
                </button>
              )}
            </div>

            {recentMovements.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-500">
                Belum ada riwayat mutasi barang.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentMovements.map((mov) => {
                  const isIncoming = mov.type === 'IN';
                  return (
                    <div key={mov.id} className="p-3 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-900 truncate">
                          {mov.itemName}
                        </span>
                        <span
                          className={`font-mono font-bold tabular-nums shrink-0 ${
                            isIncoming ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {isIncoming ? '+' : '-'}
                          {mov.quantity}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center justify-between">
                        <span className="font-mono">{mov.referenceNumber}</span>
                        <span>Saldo: {mov.balanceAfter}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
