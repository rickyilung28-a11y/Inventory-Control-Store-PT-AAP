import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  UserAccount,
  AppNotification,
  IssueVoucherDocument,
  getEffectivePermissions,
  getRoleShortBadge,
  getRoleLabel,
} from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { useTheme } from '../context/ThemeContext';
import {
  Boxes,
  Bell,
  RotateCcw,
  ChevronDown,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  ClipboardList,
  Users,
  LogOut,
  Building2,
  ShieldAlert,
  MapPin,
  Settings,
  Activity,
  Search,
  X,
  FileText,
  Printer,
  CheckCircle2,
  Database,
  ClipboardCheck,
  ScanBarcode,
  Lock,
  RefreshCw,
  AlertCircle,
  Sun,
  Moon,
  Maximize,
  Minimize,
} from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  currentUser: UserAccount;
  allUsers: UserAccount[];
  onSwitchUser: (userId: string) => void;
  onLogout: () => void;
  notifications: AppNotification[];
  onOpenNotifications: () => void;
  onResetData: () => void;
  pendingApprovalsCount: number;
  onOpenAndroidMode?: () => void;
  isAndroidModeActive?: boolean;
  onSelectSearchItem?: (sku: string) => void;
  onSelectSearchVoucher?: (voucher: IssueVoucherDocument) => void;
  onOpenBarcodeScanner?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  onLogout,
  notifications,
  onOpenNotifications,
  onResetData,
  pendingApprovalsCount,
  onSelectSearchItem,
  onSelectSearchVoucher,
  onOpenBarcodeScanner,
}) => {
  const {
    companyProfile,
    stockItems,
    issueVouchers,
    lowStockItems,
    nearMinStockItems,
    minStockProposals,
    openPrintPreview,
    isStockLockedForOpname,
    locationTransferRequests,
    syncStatus,
    forceSyncNow,
  } = useInventory();
  const { theme, toggleTheme, setTheme } = useTheme();

  const [isSyncPopoverOpen, setIsSyncPopoverOpen] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const syncPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (syncPopoverRef.current && !syncPopoverRef.current.contains(e.target as Node)) {
        setIsSyncPopoverOpen(false);
      }
    };
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const perms = useMemo(() => getEffectivePermissions(currentUser), [currentUser]);
  const canSeeLPB = perms.canCreateLPB || perms.canApproveLPBStockAddition;
  const canSeeSIV =
    perms.canCreateSIV ||
    perms.canViewAllSIV ||
    perms.canValidateSIV ||
    perms.canApproveSIVStockDeduction;
  const canSeeMinStock =
    perms.canProposeMinStock || perms.canVerifyMinStock || perms.canApproveMinStockSystem;
  const canSeeLocations = perms.canManageCompanyProfile || perms.canManageStockItems;
  const canSeeOpname =
    Boolean(perms.canPerformStockOpname) ||
    perms.canManageStockItems ||
    perms.canApproveMinStockSystem ||
    isStockLockedForOpname ||
    currentUser.role === 'superuser' ||
    currentUser.role === 'kepala_gudang' ||
    currentUser.role === 'admin' ||
    currentUser.role === 'user';
  const canSeeLedger = perms.canAccessStockMovement;
  const canSeeAuditLog = perms.canViewLowerAuditLogs;
  const canSeeAccounting = perms.canManageCostCenterGL;
  const canSeeCompany = perms.canManageCompanyProfile;
  const canSeeUsers = perms.canManageLowerUsers;

  const alertStockCount = lowStockItems.length + nearMinStockItems.length;
  const pendingMinStockProposals = minStockProposals.filter(
    (p) => p.status === 'PENDING' || p.status === 'VERIFIED_ADMIN'
  ).length;
  const pendingLocationTransfersCount = locationTransferRequests.filter(
    (r) => r.status === 'PENDING_KEPALA' || r.status === 'PENDING_APPROVAL'
  ).length;

  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState<'all' | 'items' | 'siv'>('all');
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Ctrl+K / Cmd+K to focus search, Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsSearchOpen(true);
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Role-filtered SIVs for search
  const visibleVouchers = useMemo(() => {
    if (!canSeeSIV) return [];
    if (!perms.canViewAllSIV) {
      return issueVouchers.filter(
        (v) =>
          v.userId === currentUser.id ||
          v.requestedBy.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      );
    }
    return issueVouchers;
  }, [issueVouchers, currentUser, canSeeSIV, perms.canViewAllSIV]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Matching Stock Items by SKU, Name, Category, or Rack Location
  const matchedStockItems = useMemo(() => {
    if (!normalizedQuery) return [];
    return stockItems
      .filter(
        (item) =>
          item.sku.toLowerCase().includes(normalizedQuery) ||
          item.name.toLowerCase().includes(normalizedQuery) ||
          item.category.toLowerCase().includes(normalizedQuery) ||
          (item.location && item.location.toLowerCase().includes(normalizedQuery))
      )
      .slice(0, 8);
  }, [stockItems, normalizedQuery]);

  // Matching Issue Vouchers (SIV)
  const matchedVouchers = useMemo(() => {
    if (!normalizedQuery || !canSeeSIV) return [];
    return visibleVouchers
      .filter(
        (v) =>
          v.voucherNumber.toLowerCase().includes(normalizedQuery) ||
          v.requestedBy.toLowerCase().includes(normalizedQuery) ||
          v.department.toLowerCase().includes(normalizedQuery) ||
          v.purpose.toLowerCase().includes(normalizedQuery) ||
          v.items.some(
            (it) =>
              it.sku.toLowerCase().includes(normalizedQuery) ||
              it.itemName.toLowerCase().includes(normalizedQuery)
          )
      )
      .slice(0, 8);
  }, [visibleVouchers, normalizedQuery, canSeeSIV]);

  const totalMatches = matchedStockItems.length + matchedVouchers.length;

  // Unread notifications for current user/role
  const unreadCount = notifications.filter((n) => {
    if (n.read) return false;
    if (n.targetUserId && n.targetUserId === currentUser.id) return true;
    if (n.targetRole === 'all' || n.targetRole === currentUser.role) return true;
    if (currentUser.role === 'superuser' && (n.targetRole === 'admin' || n.targetRole === 'kepala_gudang')) {
      return true;
    }
    return false;
  }).length;

  const isSuperUser = currentUser.role === 'superuser';
  const isKepala = currentUser.role === 'kepala_gudang';
  const isAdmin = currentUser.role === 'admin';

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900 border-b border-slate-800 text-white no-print">
      <div className="w-full px-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-1.5 sm:gap-3 py-2 md:py-0 md:h-16 min-w-0">
          {/* Zone 1: Brand Wordmark & Dynamic Logo */}
          <div
            onClick={() => onSelectTab('dashboard')}
            className="order-1 flex items-center gap-2 min-w-0 shrink cursor-pointer"
          >
            {companyProfile.logoUrl ? (
              <img
                src={companyProfile.logoUrl}
                alt="Logo"
                className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-lg bg-white/10 p-0.5 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Boxes className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] sm:text-sm font-extrabold tracking-tight text-white leading-tight max-w-[125px] xs:max-w-[160px] sm:max-w-[230px] truncate">
                {companyProfile.appName && companyProfile.appName !== 'GudangPresisi'
                  ? companyProfile.appName
                  : 'SISTEM INVENTORY CONTROL STORE'}
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono font-bold text-emerald-400 tracking-wider uppercase leading-tight max-w-[125px] xs:max-w-[160px] sm:max-w-[230px] truncate">
                {companyProfile.companyName || 'PT ABADI AGROSINDO PERSADA'}
              </span>
            </div>
          </div>

          {/* Zone 1.5: Global Search Bar (Full width row on mobile, inline on tablet/desktop) */}
          <div
            ref={searchContainerRef}
            className="order-3 md:order-2 relative w-full md:w-auto md:flex-1 min-w-0 md:max-w-xs lg:max-w-sm mt-1 md:mt-0"
          >
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchOpen(true);
                }}
                placeholder={
                  canSeeSIV
                    ? 'Cari Material Code, nama barang, atau No. SIV...'
                    : 'Cari Material Code, nama barang, atau lokasi rak...'
                }
                className="w-full min-w-0 pl-8 pr-14 py-1.5 bg-slate-800/90 hover:bg-slate-800 focus:bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-hidden transition-all"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 p-0.5 text-slate-400 hover:text-white rounded cursor-pointer"
                  title="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd className="hidden sm:inline-block absolute right-2.5 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-slate-400 bg-slate-900 border border-slate-700 rounded pointer-events-none">
                  Ctrl+K
                </kbd>
              )}
            </div>

            {/* Global Search Results Popover */}
            {isSearchOpen && normalizedQuery.length > 0 && (
              <div className="fixed sm:absolute left-3 right-3 sm:left-0 sm:right-auto mt-2 sm:w-[440px] bg-white text-slate-800 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px]">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSearchFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                        searchFilter === 'all'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      Semua ({totalMatches})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchFilter('items')}
                      className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                        searchFilter === 'items'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-600 hover:bg-slate-200/70'
                      }`}
                    >
                      Barang / Material Code ({matchedStockItems.length})
                    </button>
                    {canSeeSIV && (
                      <button
                        type="button"
                        onClick={() => setSearchFilter('siv')}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                          searchFilter === 'siv'
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-600 hover:bg-slate-200/70'
                        }`}
                      >
                        Nota SIV ({matchedVouchers.length})
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="max-h-[70vh] sm:max-h-[420px] overflow-y-auto divide-y divide-slate-100">
                  {totalMatches === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">
                      Tidak ditemukan hasil untuk kata kunci{' '}
                      <strong className="text-slate-800">&ldquo;{searchQuery}&rdquo;</strong>.
                    </div>
                  ) : (
                    <>
                      {(searchFilter === 'all' || searchFilter === 'items') &&
                        matchedStockItems.length > 0 && (
                          <div className="p-2">
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                              <span>Master Barang &amp; Material Code ({matchedStockItems.length})</span>
                              <span>Stok Aktual</span>
                            </div>
                            <div className="space-y-1 mt-1">
                              {matchedStockItems.map((item) => {
                                const isLow = item.currentStock <= item.minStock;
                                return (
                                  <div
                                    key={item.id}
                                    className="p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all flex items-center justify-between gap-3"
                                  >
                                    <div
                                      onClick={() => {
                                        onSelectTab('items');
                                        setIsSearchOpen(false);
                                      }}
                                      className="min-w-0 flex-1 cursor-pointer"
                                    >
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400 font-mono text-[10px] font-bold">
                                          {item.sku}
                                        </span>
                                        <span className="font-bold text-xs text-slate-900 truncate">
                                          {item.name}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                        <span>{item.category}</span>
                                        <span>&middot;</span>
                                        <span className="font-mono text-slate-600">
                                          Rak: {item.location}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex flex-col items-end shrink-0 gap-1">
                                      <span
                                        className={`text-xs font-extrabold tabular-nums px-2 py-0.5 rounded-md ${
                                          isLow
                                            ? 'bg-red-100 text-red-700'
                                            : 'bg-emerald-100 text-emerald-800'
                                        }`}
                                      >
                                        {item.currentStock} {item.unit}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onSelectTab('items');
                                            setIsSearchOpen(false);
                                          }}
                                          className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                        >
                                          Master
                                        </button>
                                        {canSeeLedger && onSelectSearchItem && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onSelectSearchItem(item.sku);
                                              setIsSearchOpen(false);
                                            }}
                                            className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer"
                                          >
                                            Kartu Stok
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                      {canSeeSIV &&
                        (searchFilter === 'all' || searchFilter === 'siv') &&
                        matchedVouchers.length > 0 && (
                          <div className="p-2">
                            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                              <span>Nota Pengambilan Barang / SIV ({matchedVouchers.length})</span>
                              <span>Status &amp; Aksi</span>
                            </div>
                            <div className="space-y-1 mt-1">
                              {matchedVouchers.map((voucher) => {
                                const statusBadge =
                                  voucher.status === 'HANDOVER_COMPLETED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : voucher.status === 'APPROVED'
                                    ? 'bg-blue-100 text-blue-800'
                                    : voucher.status === 'REJECTED'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-amber-100 text-amber-800';

                                const statusText =
                                  voucher.status === 'HANDOVER_COMPLETED'
                                    ? 'SELESAI'
                                    : voucher.status === 'APPROVED'
                                    ? 'DI-ACC ADMIN'
                                    : voucher.status === 'REJECTED'
                                    ? 'DITOLAK'
                                    : 'PENDING';

                                return (
                                  <div
                                    key={voucher.id}
                                    className="p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all flex items-center justify-between gap-3"
                                  >
                                    <div
                                      onClick={() => {
                                        onSelectTab('vouchers');
                                        setIsSearchOpen(false);
                                      }}
                                      className="min-w-0 flex-1 cursor-pointer"
                                    >
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                        <span className="font-mono font-extrabold text-xs text-slate-900">
                                          {voucher.voucherNumber}
                                        </span>
                                        <span
                                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${statusBadge}`}
                                        >
                                          {statusText}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-600 truncate mt-0.5">
                                        {voucher.requestedBy} &middot; {voucher.department}
                                      </div>
                                      <div className="text-[10px] text-slate-400 truncate">
                                        {voucher.items
                                          .map((i) => `${i.sku} (${i.requestedQty})`)
                                          .join(', ')}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          openPrintPreview('NPB', voucher);
                                          setIsSearchOpen(false);
                                        }}
                                        className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                        title="Cetak / Lihat Dokumen SIV"
                                      >
                                        <Printer className="w-3 h-3" />
                                        <span>Detail</span>
                                      </button>

                                      {onSelectSearchVoucher &&
                                        (voucher.status === 'PENDING' ||
                                          voucher.status === 'APPROVED') &&
                                        (perms.canValidateSIV ||
                                          perms.canApproveSIVStockDeduction) && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              onSelectSearchVoucher(voucher);
                                              setIsSearchOpen(false);
                                            }}
                                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                            title="Validasi Scan / Approve SIV"
                                          >
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span>Proses</span>
                                          </button>
                                        )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Zone 2: Navigation Links based on Effective Permissions */}
          <nav className="hidden xl:flex items-center gap-1 text-xs font-medium text-slate-300">
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                currentTab === 'dashboard'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              Dashboard
            </button>

            {canSeeLPB && (
              <button
                onClick={() => onSelectTab('lpb')}
                className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 ${
                  currentTab === 'lpb'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-400" />
                LPB
              </button>
            )}

            {canSeeSIV && (
              <button
                onClick={() => onSelectTab('vouchers')}
                className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 ${
                  currentTab === 'vouchers'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                Nota (SIV)
                {pendingApprovalsCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-500 text-slate-950 rounded-full tabular-nums">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => onSelectTab('items')}
              className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 ${
                currentTab === 'items'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              Master Stok
            </button>

            {canSeeOpname && (
              <button
                onClick={() => onSelectTab('opname')}
                className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 ${
                  currentTab === 'opname'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'hover:text-white hover:bg-slate-800/60'
                }`}
                title="Stock Opname Fisik Store (Lock Stok & Scan Barcode)"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Stock Opname</span>
                {isStockLockedForOpname && (
                  <span className="inline-flex items-center gap-0.5 text-[9.5px] font-extrabold px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full animate-pulse">
                    <Lock className="w-2.5 h-2.5" />
                    <span>LOCK</span>
                  </span>
                )}
              </button>
            )}

            {canSeeMinStock && (
              <button
                onClick={() => onSelectTab('min-stock')}
                className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 ${
                  currentTab === 'min-stock'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'hover:text-white hover:bg-slate-800/60'
                }`}
                title="Pantau stok yang mendekati atau melampaui batas minimal serta pengajuan perubahan batas stok"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                <span>Stok Min</span>
                {alertStockCount > 0 && (
                  <span className="text-[10px] font-black px-1.5 py-0.2 bg-red-600 text-white rounded-full tabular-nums animate-pulse">
                    {alertStockCount}
                  </span>
                )}
                {pendingMinStockProposals > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full tabular-nums">
                    {pendingMinStockProposals}
                  </span>
                )}
              </button>
            )}

            {canSeeLocations && (
              <button
                onClick={() => onSelectTab('locations')}
                className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 ${
                  currentTab === 'locations'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                <span>Rak</span>
                {pendingLocationTransfersCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-indigo-500 text-white rounded-full tabular-nums">
                    {pendingLocationTransfersCount}
                  </span>
                )}
              </button>
            )}

            {canSeeLedger && (
              <button
                onClick={() => onSelectTab('ledger')}
                className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 ${
                  currentTab === 'ledger'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
                Kartu Stok
              </button>
            )}

            {canSeeAuditLog && (
              <button
                onClick={() => onSelectTab('activity-log')}
                className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 ${
                  currentTab === 'activity-log'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'hover:text-white hover:bg-slate-800/60'
                }`}
                title="System Activity Log: Riwayat Penyesuaian Stok, Approval, dan Perubahan User"
              >
                <Activity className="w-3.5 h-3.5 text-indigo-400" />
                <span>Log</span>
              </button>
            )}

            {canSeeAccounting && (
              <button
                onClick={() => onSelectTab('accounting')}
                className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 ${
                  currentTab === 'accounting'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                CC/GL
              </button>
            )}

            {canSeeCompany && (
              <button
                onClick={() => onSelectTab('company')}
                className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 ${
                  currentTab === 'company'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'hover:text-white hover:bg-slate-800/60'
                }`}
                title="Edit logo, nama aplikasi, dan data profil perusahaan"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                Profil
              </button>
            )}

            {canSeeUsers && (
              <button
                onClick={() => onSelectTab('users')}
                className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 ${
                  currentTab === 'users'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                {isSuperUser ? 'User & Level' : 'Kelola User'}
              </button>
            )}

            {isSuperUser && (
              <button
                onClick={() => onSelectTab('superuser-db')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1 border ${
                  currentTab === 'superuser-db'
                    ? 'bg-amber-400 text-slate-950 font-extrabold border-amber-300 shadow-xs'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25'
                }`}
                title="Master Database Superuser — Akses Semua Modul & Tabel Aplikasi"
              >
                <Database className="w-3.5 h-3.5" />
                Database Superuser
              </button>
            )}
          </nav>

          {/* Zone 3: Actions, Scan Barcode, Notification Bell, User Dropdown, Logout */}
          <div className="order-2 md:order-3 flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Visual SQL Database Synchronization Indicator */}
            <div ref={syncPopoverRef} className="relative">
              <button
                type="button"
                onClick={() => setIsSyncPopoverOpen(!isSyncPopoverOpen)}
                className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  syncStatus.isSyncing || isManualSyncing
                    ? 'bg-cyan-950/70 border-cyan-500/50 text-cyan-300 ring-1 ring-cyan-500/30'
                    : syncStatus.hasError || !syncStatus.connected
                    ? 'bg-rose-950/70 border-rose-500/50 text-rose-300 animate-pulse'
                    : 'bg-slate-800/90 border-slate-700/80 hover:bg-slate-800 text-emerald-400'
                }`}
                title="Status Sinkronisasi State Lokal dengan Database SQL"
              >
                {syncStatus.isSyncing || isManualSyncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                    <span className="hidden md:inline font-mono text-[11px] text-cyan-300">Menyimpan SQL...</span>
                  </>
                ) : syncStatus.hasError || !syncStatus.connected ? (
                  <>
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden md:inline text-[11px] font-bold text-rose-300">Perlu Perhatian</span>
                  </>
                ) : (
                  <>
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="hidden lg:inline font-mono text-[11px] text-slate-300 font-normal">
                      SQL Sync
                    </span>
                  </>
                )}
              </button>

              {/* Sync Status Popover */}
              {isSyncPopoverOpen && (
                <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 mt-2 sm:w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3.5 text-xs text-white z-50">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-slate-200">Status Database SQL</span>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        syncStatus.isSyncing || isManualSyncing
                          ? 'bg-cyan-900 text-cyan-200 border border-cyan-600'
                          : syncStatus.hasError || !syncStatus.connected
                          ? 'bg-rose-950 text-rose-300 border border-rose-600'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                      }`}
                    >
                      {syncStatus.isSyncing || isManualSyncing
                        ? 'BACKING UP'
                        : syncStatus.hasError || !syncStatus.connected
                        ? 'PERLU PERHATIAN'
                        : 'TERKONEKSI'}
                    </span>
                  </div>

                  <div className="space-y-2 text-[11px] text-slate-300">
                    <div className="flex items-center justify-between bg-slate-800/60 p-2 rounded-lg">
                      <span className="text-slate-400">Sinkronisasi SQL:</span>
                      <span className="font-semibold text-white">
                        {syncStatus.isSyncing || isManualSyncing
                          ? 'Sedang mencadangkan ke file .sql & SQLite'
                          : syncStatus.hasError || !syncStatus.connected
                          ? 'Koneksi terputus / perlu perhatian'
                          : 'State lokal & SQL sinkron'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <span className="text-slate-400">Revisi Terakhir:</span>
                      <span className="font-mono font-bold text-emerald-400">#{syncStatus.revision}</span>
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <span className="text-slate-400">Update Terakhir:</span>
                      <span className="text-slate-200">
                        {syncStatus.lastSyncAt
                          ? new Date(syncStatus.lastSyncAt).toLocaleTimeString('id-ID')
                          : 'Baru saja'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between px-1">
                      <span className="text-slate-400">Penyimpanan:</span>
                      <span className="text-slate-300 font-mono text-[10px]">SQLite3 + SQL Dump</span>
                    </div>

                    {syncStatus.errorMessage && (
                      <div className="p-2 rounded bg-rose-950/80 border border-rose-700 text-rose-200 text-[10px]">
                        {syncStatus.errorMessage}
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={isManualSyncing}
                      onClick={async () => {
                        setIsManualSyncing(true);
                        await forceSyncNow();
                        setTimeout(() => setIsManualSyncing(false), 600);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing ? 'animate-spin' : ''}`} />
                      <span>Sinkronkan Sekarang</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Switcher Button (Light / Dark Mode) */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
              title={
                theme === 'dark'
                  ? 'Mode Gelap Aktif — Klik untuk beralih ke Mode Terang'
                  : 'Mode Terang Aktif — Klik untuk beralih ke Mode Gelap'
              }
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="hidden lg:inline text-[11px] text-amber-300">Terang</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="hidden lg:inline text-[11px] text-slate-300">Gelap</span>
                </>
              )}
            </button>

            {/* Fullscreen Mode Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? 'Keluar dari Layar Penuh (Exit Fullscreen)' : 'Tampilan Layar Penuh (Fullscreen)'}
            >
              {isFullscreen ? (
                <>
                  <Minimize className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span className="hidden lg:inline text-[11px] text-cyan-300">Normal</span>
                </>
              ) : (
                <>
                  <Maximize className="w-4 h-4 text-slate-300 shrink-0" />
                  <span className="hidden lg:inline text-[11px] text-slate-300">Layar Penuh</span>
                </>
              )}
            </button>

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative p-1.5 sm:p-2 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Notifikasi Real-time"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Role & User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-lg text-xs text-left transition-colors cursor-pointer"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] text-white shrink-0 ${
                    isSuperUser
                      ? 'bg-purple-600'
                      : isKepala
                      ? 'bg-blue-600'
                      : isAdmin
                      ? 'bg-emerald-600'
                      : currentUser.role === 'user'
                      ? 'bg-amber-600'
                      : 'bg-slate-600'
                  }`}
                >
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden sm:block">
                  <div className="font-semibold text-white leading-tight truncate max-w-[110px]">
                    {currentUser.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[110px] font-mono">
                    {getRoleShortBadge(currentUser.role, isSuperUser)}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5 shrink-0" />
              </button>

              {userDropdownOpen && (
                <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 mt-2 sm:w-80 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 text-slate-800 text-xs z-50 max-h-[80vh] overflow-y-auto">
                  {/* Current Active Account Header */}
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                        AKUN AKTIF
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          isSuperUser
                            ? 'bg-purple-100 text-purple-800'
                            : isKepala
                            ? 'bg-blue-100 text-blue-800'
                            : isAdmin
                            ? 'bg-emerald-100 text-emerald-800'
                            : currentUser.role === 'user'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {getRoleShortBadge(currentUser.role, isSuperUser)}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 text-sm mt-1">{currentUser.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      Username: @{currentUser.username}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      {getRoleLabel(currentUser.role, isSuperUser)} &middot; {currentUser.department}
                    </div>
                  </div>

                  {/* Admin & Superuser Shortcuts */}
                  {(canSeeUsers || isSuperUser) && (
                    <div className="p-2 border-b border-slate-100 space-y-1">
                      {isSuperUser && (
                        <button
                          onClick={() => {
                            onSelectTab('superuser-db');
                            setUserDropdownOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs text-amber-900 bg-amber-50 hover:bg-amber-100 rounded flex items-center gap-2 font-bold"
                        >
                          <Database className="w-3.5 h-3.5 text-amber-600" />
                          <span>Master Database Superuser (All Akses)</span>
                        </button>
                      )}
                      {canSeeUsers && (
                        <button
                          onClick={() => {
                            onSelectTab('users');
                            setUserDropdownOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded flex items-center gap-2 font-medium"
                        >
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            {isSuperUser
                              ? 'Kelola User, Kategori Level & Hak Akses'
                              : 'Kelola User & Hak Akses'}
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Theme Switcher Selector inside User Dropdown */}
                  <div className="px-3 py-2.5 border-b border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono mb-1.5">
                      TEMA TAMPILAN APLIKASI
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                          theme === 'light'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5" />
                        <span>Mode Terang</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                          theme === 'dark'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span>Mode Gelap</span>
                      </button>
                    </div>
                  </div>

                  {/* Actions: Reset & Logout */}
                  <div className="p-2 space-y-1 bg-slate-50 border-t border-slate-100">
                    {(isSuperUser || isKepala || isAdmin) && (
                      <button
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onResetData();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded font-bold transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                        Reset All (Kosongkan LPB, Stok &amp; SIV)
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setUserDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] text-red-600 hover:text-red-700 hover:bg-red-50 rounded font-semibold transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Keluar dari Akun (Logout)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Logout Button (Visible on both Mobile & Desktop) */}
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
              title="Keluar dari Akun (Logout)"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile & Tablet Touch-Optimized Nav Bar (Adapts to Phone & Tablet Screens) */}
      <div className="xl:hidden w-full flex items-center gap-1 border-t border-slate-800 py-1.5 px-3 sm:px-6 text-[11px] bg-slate-900/95 backdrop-blur-md overflow-x-auto no-scrollbar">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`min-w-[62px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
            currentTab === 'dashboard'
              ? 'bg-slate-800 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] whitespace-nowrap">Beranda</span>
        </button>

        {canSeeLPB && (
          <button
            onClick={() => onSelectTab('lpb')}
            className={`min-w-[62px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
              currentTab === 'lpb'
                ? 'bg-slate-800 text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 mb-0.5 text-emerald-400" />
            <span className="text-[10px] whitespace-nowrap">LPB Masuk</span>
          </button>
        )}

        {canSeeSIV && (
          <button
            onClick={() => onSelectTab('vouchers')}
            className={`relative min-w-[62px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
              currentTab === 'vouchers'
                ? 'bg-slate-800 text-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 mb-0.5 text-amber-400" />
            <span className="text-[10px] whitespace-nowrap">Nota SIV</span>
            {pendingApprovalsCount > 0 && (
              <span className="absolute top-1 right-1.5 w-4 h-4 bg-amber-500 text-slate-950 text-[9px] font-bold rounded-full flex items-center justify-center">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => onSelectTab('items')}
          className={`min-w-[62px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
            currentTab === 'items'
              ? 'bg-slate-800 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span className="text-[10px] whitespace-nowrap">Master</span>
        </button>

        {canSeeOpname && (
          <button
            onClick={() => onSelectTab('opname')}
            className={`relative min-w-[64px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
              currentTab === 'opname'
                ? 'bg-slate-800 text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 mb-0.5 text-emerald-400" />
            <span className="text-[10px] whitespace-nowrap">Opname</span>
            {isStockLockedForOpname && (
              <span className="absolute top-1 right-1 px-1 bg-amber-400 text-slate-950 text-[8px] font-extrabold rounded">
                LOCK
              </span>
            )}
          </button>
        )}

        {canSeeMinStock && (
          <button
            onClick={() => onSelectTab('min-stock')}
            className={`relative min-w-[62px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
              currentTab === 'min-stock'
                ? 'bg-slate-800 text-red-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldAlert className="w-4 h-4 mb-0.5 text-red-400" />
            <span className="text-[10px] whitespace-nowrap">Stok Min</span>
            {alertStockCount > 0 && (
              <span className="absolute top-1 right-1.5 w-4 h-4 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {alertStockCount}
              </span>
            )}
          </button>
        )}

        {canSeeLocations && (
          <button
            onClick={() => onSelectTab('locations')}
            className={`relative min-w-[58px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
              currentTab === 'locations'
                ? 'bg-slate-800 text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MapPin className="w-4 h-4 mb-0.5 text-emerald-400" />
            <span className="text-[10px] whitespace-nowrap">Rak</span>
            {pendingLocationTransfersCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {pendingLocationTransfersCount}
              </span>
            )}
          </button>
        )}

        {canSeeLedger && (
          <button
            onClick={() => onSelectTab('ledger')}
            className={`min-w-[62px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
              currentTab === 'ledger'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] whitespace-nowrap">Mutasi</span>
          </button>
        )}

        {canSeeAuditLog && (
          <button
            onClick={() => onSelectTab('activity-log')}
            className={`min-w-[62px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
              currentTab === 'activity-log'
                ? 'bg-slate-800 text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4 mb-0.5 text-indigo-400" />
            <span className="text-[10px] whitespace-nowrap">Log Audit</span>
          </button>
        )}

        {canSeeAccounting && (
          <button
            onClick={() => onSelectTab('accounting')}
            className={`min-w-[62px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
              currentTab === 'accounting'
                ? 'bg-slate-800 text-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4 mb-0.5 text-amber-400" />
            <span className="text-[10px] whitespace-nowrap">Cost/GL</span>
          </button>
        )}

        {canSeeCompany && (
          <button
            onClick={() => onSelectTab('company')}
            className={`min-w-[58px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
              currentTab === 'company'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4 mb-0.5 text-slate-400" />
            <span className="text-[10px] whitespace-nowrap">Profil</span>
          </button>
        )}

        {canSeeUsers && (
          <button
            onClick={() => onSelectTab('users')}
            className={`min-w-[62px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
              currentTab === 'users'
                ? 'bg-slate-800 text-emerald-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4 mb-0.5 text-emerald-400" />
            <span className="text-[10px] whitespace-nowrap">User</span>
          </button>
        )}

        {isSuperUser && (
          <button
            onClick={() => onSelectTab('superuser-db')}
            className={`min-w-[68px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] ${
              currentTab === 'superuser-db'
                ? 'bg-amber-400 text-slate-950 font-bold'
                : 'text-amber-300 hover:text-amber-200'
            }`}
          >
            <Database className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] whitespace-nowrap">DB Super</span>
          </button>
        )}

        <button
          onClick={onLogout}
          className="min-w-[62px] shrink-0 py-1.5 px-2 rounded-lg flex flex-col items-center justify-center transition-colors min-h-[44px] text-red-400 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 font-bold ml-auto"
          title="Keluar dari Akun (Logout)"
        >
          <LogOut className="w-4 h-4 mb-0.5 text-red-400" />
          <span className="text-[10px] whitespace-nowrap">Keluar</span>
        </button>
      </div>
    </header>
  );
};
