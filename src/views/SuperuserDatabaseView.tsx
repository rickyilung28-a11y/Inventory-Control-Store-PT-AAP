import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  PERMISSION_DEFINITIONS,
  RoleLevelDefinition,
  UserPermissions,
  getRoleLabel,
} from '../types/inventory';
import {
  Database,
  ShieldAlert,
  Search,
  Download,
  Upload,
  RefreshCw,
  Edit3,
  Trash2,
  Plus,
  CheckCircle2,
  Layers,
  Users,
  Package,
  Truck,
  FileSpreadsheet,
  History,
  SlidersHorizontal,
  Landmark,
  MapPin,
  Building2,
  Activity,
  Bell,
  Save,
  X,
  ExternalLink,
  Crown,
  Code2,
  Eye,
  ClipboardCheck,
  ArrowRightLeft,
} from 'lucide-react';
import {
  downloadSqlBackupFile,
  parseSqlDumpToSnapshot,
  exportAllMasterDatabaseToExcel,
} from '../utils/sqlAndExcelExport';

interface SuperuserDatabaseViewProps {
  onNavigateTab?: (tab: string) => void;
}

type DatabaseCollectionKey =
  | 'roleDefinitions'
  | 'users'
  | 'stockItems'
  | 'lpbDocuments'
  | 'issueVouchers'
  | 'stockMovements'
  | 'minStockProposals'
  | 'stockOpnameSessions'
  | 'locationTransferRequests'
  | 'costCenters'
  | 'glAccounts'
  | 'storageLocations'
  | 'companyProfile'
  | 'activityLogs'
  | 'notifications';

export const SuperuserDatabaseView: React.FC<SuperuserDatabaseViewProps> = ({
  onNavigateTab,
}) => {
  const {
    currentUser,
    roleDefinitions,
    addRoleDefinition,
    updateRoleDefinition,
    deleteRoleDefinition,
    users,
    stockItems,
    lpbDocuments,
    issueVouchers,
    stockMovements,
    minStockProposals,
    stockOpnameSessions,
    locationTransferRequests,
    costCenters,
    glAccounts,
    storageLocations,
    companyProfile,
    activityLogs,
    notifications,
    syncStatus,
    forceSyncNow,
    updateDatabaseCollection,
    replaceEntireDatabase,
    resetToDefaultData,
    resetAllTransactionsAndStock,
  } = useInventory();

  const [selectedCollection, setSelectedCollection] =
    useState<DatabaseCollectionKey>('roleDefinitions');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRecordIndex, setEditingRecordIndex] = useState<number | null>(null);
  const [editingJsonText, setEditingJsonText] = useState<string>('');
  const [jsonError, setJsonError] = useState<string>('');
  const [isRawTableMode, setIsRawTableMode] = useState<boolean>(false);
  const [rawCollectionJson, setRawCollectionJson] = useState<string>('');

  // Modal state for adding/editing Role Level Category directly from Superuser Database
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRoleKey, setEditingRoleKey] = useState<string | null>(null);
  const [roleFormKey, setRoleFormKey] = useState('');
  const [roleFormLevel, setRoleFormLevel] = useState<number>(3);
  const [roleFormName, setRoleFormName] = useState('');
  const [roleFormBadge, setRoleFormBadge] = useState('');
  const [roleFormDesc, setRoleFormDesc] = useState('');
  const [roleFormColor, setRoleFormColor] =
    useState<RoleLevelDefinition['colorTheme']>('blue');
  const [roleFormPerms, setRoleFormPerms] = useState<UserPermissions>({
    canViewStock: true,
    canManageStockItems: false,
    canCreateSIV: true,
    canViewAllSIV: false,
    canValidateSIV: false,
    canApproveSIVStockDeduction: false,
    canCreateLPB: false,
    canApproveLPBStockAddition: false,
    canManageCostCenterGL: false,
    canProposeMinStock: true,
    canVerifyMinStock: false,
    canApproveMinStockSystem: false,
    canAccessStockMovement: false,
    canManageLowerUsers: false,
    canViewLowerAuditLogs: false,
    canManageCompanyProfile: false,
  });
  const [roleModalError, setRoleModalError] = useState('');

  const collectionsMeta: {
    key: DatabaseCollectionKey;
    label: string;
    subtitle: string;
    icon: React.ReactNode;
    count: number;
    linkedTab?: string;
  }[] = [
    {
      key: 'roleDefinitions',
      label: 'Kategori Level & Jabatan',
      subtitle: 'Master Level RBAC (0 s/d Custom)',
      icon: <Crown className="w-4 h-4 text-amber-400" />,
      count: roleDefinitions.length,
      linkedTab: 'users',
    },
    {
      key: 'users',
      label: 'Database Akun Pengguna',
      subtitle: 'Kredensial Login & Hak Akses User',
      icon: <Users className="w-4 h-4 text-violet-400" />,
      count: users.length,
      linkedTab: 'users',
    },
    {
      key: 'stockItems',
      label: 'Master Stok Barang Store',
      subtitle: 'SKU, Saldo Fisik, Alokasi & Stok Min',
      icon: <Package className="w-4 h-4 text-emerald-400" />,
      count: stockItems.length,
      linkedTab: 'items',
    },
    {
      key: 'lpbDocuments',
      label: 'Dokumen LPB (Barang Masuk)',
      subtitle: 'Surat Jalan Supplier & Approval LPB',
      icon: <Truck className="w-4 h-4 text-sky-400" />,
      count: lpbDocuments.length,
      linkedTab: 'lpb',
    },
    {
      key: 'issueVouchers',
      label: 'Dokumen SIV (Pengambilan)',
      subtitle: 'Nota Pengambilan Barang Store',
      icon: <FileSpreadsheet className="w-4 h-4 text-indigo-400" />,
      count: issueVouchers.length,
      linkedTab: 'vouchers',
    },
    {
      key: 'stockMovements',
      label: 'Kartu Stok (Mutasi IN/OUT)',
      subtitle: 'Buku Besar Riwayat Mutasi Barang',
      icon: <History className="w-4 h-4 text-teal-400" />,
      count: stockMovements.length,
      linkedTab: 'ledger',
    },
    {
      key: 'minStockProposals',
      label: 'Pengajuan Stok Minimal',
      subtitle: 'Usulan, Verifikasi Admin & ACC Kepala Store',
      icon: <SlidersHorizontal className="w-4 h-4 text-amber-400" />,
      count: minStockProposals.length,
      linkedTab: 'min-stock',
    },
    {
      key: 'stockOpnameSessions',
      label: 'Sesi Stock Opname Store',
      subtitle: 'Audit Fisik, Lock Stok & Rekonsiliasi',
      icon: <ClipboardCheck className="w-4 h-4 text-emerald-400" />,
      count: stockOpnameSessions.length,
      linkedTab: 'opname',
    },
    {
      key: 'locationTransferRequests',
      label: 'Pengajuan Pindah Lokasi Rak',
      subtitle: 'Usulan Admin & ACC Realisasi Kepala Store',
      icon: <ArrowRightLeft className="w-4 h-4 text-indigo-400" />,
      count: locationTransferRequests.length,
      linkedTab: 'locations',
    },
    {
      key: 'costCenters',
      label: 'Master Cost Center',
      subtitle: 'Kode & Nama Cost Center Pabrik',
      icon: <Landmark className="w-4 h-4 text-cyan-400" />,
      count: costCenters.length,
      linkedTab: 'accounting',
    },
    {
      key: 'glAccounts',
      label: 'Master GL Account',
      subtitle: 'Kode Akun Buku Besar Biaya',
      icon: <Landmark className="w-4 h-4 text-blue-400" />,
      count: glAccounts.length,
      linkedTab: 'accounting',
    },
    {
      key: 'storageLocations',
      label: 'Lokasi Rak Penyimpanan',
      subtitle: 'Master Rak & Zona Store',
      icon: <MapPin className="w-4 h-4 text-rose-400" />,
      count: storageLocations.length,
      linkedTab: 'locations',
    },
    {
      key: 'companyProfile',
      label: 'Profil & Identitas Perusahaan',
      subtitle: 'Konfigurasi Kop Dokumen & Nama Aplikasi',
      icon: <Building2 className="w-4 h-4 text-emerald-400" />,
      count: 1,
      linkedTab: 'company',
    },
    {
      key: 'activityLogs',
      label: 'System Audit Trail (Log)',
      subtitle: 'Rekam Jejak Seluruh Level User',
      icon: <Activity className="w-4 h-4 text-orange-400" />,
      count: activityLogs.length,
      linkedTab: 'activity-log',
    },
    {
      key: 'notifications',
      label: 'Notifikasi Sistem',
      subtitle: 'Antrean Peringatan & Notifikasi User',
      icon: <Bell className="w-4 h-4 text-pink-400" />,
      count: notifications.length,
    },
  ];

  const currentCollectionData = useMemo<unknown[]>(() => {
    switch (selectedCollection) {
      case 'roleDefinitions':
        return roleDefinitions;
      case 'users':
        return users;
      case 'stockItems':
        return stockItems;
      case 'lpbDocuments':
        return lpbDocuments;
      case 'issueVouchers':
        return issueVouchers;
      case 'stockMovements':
        return stockMovements;
      case 'minStockProposals':
        return minStockProposals;
      case 'stockOpnameSessions':
        return stockOpnameSessions;
      case 'locationTransferRequests':
        return locationTransferRequests;
      case 'costCenters':
        return costCenters;
      case 'glAccounts':
        return glAccounts;
      case 'storageLocations':
        return storageLocations;
      case 'companyProfile':
        return [companyProfile];
      case 'activityLogs':
        return activityLogs;
      case 'notifications':
        return notifications;
      default:
        return [];
    }
  }, [
    selectedCollection,
    roleDefinitions,
    users,
    stockItems,
    lpbDocuments,
    issueVouchers,
    stockMovements,
    minStockProposals,
    stockOpnameSessions,
    locationTransferRequests,
    costCenters,
    glAccounts,
    storageLocations,
    companyProfile,
    activityLogs,
    notifications,
  ]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return currentCollectionData
      .map((item, originalIndex) => ({ item, originalIndex }))
      .filter(({ item }) => {
        if (!q) return true;
        return JSON.stringify(item).toLowerCase().includes(q);
      });
  }, [currentCollectionData, searchQuery]);

  if (currentUser?.role !== 'superuser') {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center max-w-xl mx-auto my-12 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          Akses Terbatas — Khusus Super User (Level 0)
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Halaman Master Database Superuser hanya dapat diakses oleh akun dengan otorisasi{' '}
          <span className="font-semibold text-slate-800">Level 0 — Super User (All Akses)</span>.
        </p>
      </div>
    );
  }

  const totalRecordsCount = collectionsMeta.reduce((acc, c) => acc + c.count, 0);

  const handleOpenAddRoleModal = () => {
    setEditingRoleKey(null);
    setRoleFormKey('');
    const maxLvl = roleDefinitions.reduce((m, r) => Math.max(m, r.levelNumber), 4);
    setRoleFormLevel(maxLvl + 1);
    setRoleFormName('');
    setRoleFormBadge('');
    setRoleFormDesc('');
    setRoleFormColor('cyan');
    setRoleFormPerms({
      canViewStock: true,
      canManageStockItems: false,
      canCreateSIV: true,
      canViewAllSIV: false,
      canValidateSIV: false,
      canApproveSIVStockDeduction: false,
      canCreateLPB: false,
      canApproveLPBStockAddition: false,
      canManageCostCenterGL: false,
      canProposeMinStock: true,
      canVerifyMinStock: false,
      canApproveMinStockSystem: false,
      canAccessStockMovement: false,
      canManageLowerUsers: false,
      canViewLowerAuditLogs: false,
      canManageCompanyProfile: false,
    });
    setRoleModalError('');
    setShowRoleModal(true);
  };

  const handleOpenEditRoleModal = (def: RoleLevelDefinition) => {
    setEditingRoleKey(def.roleKey);
    setRoleFormKey(def.roleKey);
    setRoleFormLevel(def.levelNumber);
    setRoleFormName(def.name);
    setRoleFormBadge(def.badgeLabel);
    setRoleFormDesc(def.description);
    setRoleFormColor(def.colorTheme || 'blue');
    setRoleFormPerms({ ...def.defaultPermissions });
    setRoleModalError('');
    setShowRoleModal(true);
  };

  const handleSaveRoleModal = (e: React.FormEvent) => {
    e.preventDefault();
    setRoleModalError('');
    if (editingRoleKey) {
      const res = updateRoleDefinition(editingRoleKey, {
        levelNumber: roleFormLevel,
        name: roleFormName,
        badgeLabel:
          roleFormBadge.trim() ||
          `LVL ${roleFormLevel} • ${roleFormName.trim().toUpperCase()}`,
        description: roleFormDesc,
        colorTheme: roleFormColor,
        defaultPermissions: roleFormPerms,
      });
      if (!res.success) {
        setRoleModalError(res.error || 'Gagal menyimpan kategori level.');
        return;
      }
      setShowRoleModal(false);
    } else {
      const autoKey =
        roleFormKey.trim() ||
        roleFormName
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '');
      const res = addRoleDefinition({
        roleKey: autoKey,
        levelNumber: roleFormLevel,
        name: roleFormName,
        badgeLabel:
          roleFormBadge.trim() ||
          `LVL ${roleFormLevel} • ${roleFormName.trim().toUpperCase()}`,
        description: roleFormDesc,
        colorTheme: roleFormColor,
        defaultPermissions: roleFormPerms,
      });
      if (!res.success) {
        setRoleModalError(res.error || 'Gagal menambahkan kategori level.');
        return;
      }
      setShowRoleModal(false);
    }
  };

  const buildSnapshotPayload = () => ({
    exportedAt: new Date().toISOString(),
    exportedBy: currentUser.username,
    version: syncStatus.revision,
    roleDefinitions,
    users,
    stockItems,
    lpbDocuments,
    issueVouchers,
    stockMovements,
    minStockProposals,
    stockOpnameSessions,
    locationTransferRequests,
    costCenters,
    glAccounts,
    storageLocations,
    companyProfile,
    activityLogs,
    notifications,
  });

  const handleExportFullDatabase = () => {
    const dump = buildSnapshotPayload();
    const blob = new Blob([JSON.stringify(dump, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `database-superuser-store-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSqlDatabase = () => {
    downloadSqlBackupFile(buildSnapshotPayload());
  };

  const handleImportSqlDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        setJsonError('');
        const sqlText = String(ev.target?.result || '');
        // Try server SQL import endpoint first for relational SQLite + SQL dump sync
        const resp = await fetch('/api/database/import-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sqlContent: sqlText }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.state) {
            await replaceEntireDatabase(data.state);
            return;
          }
        }
        // Fallback client-side SQL parser
        const parsedSnapshot = parseSqlDumpToSnapshot(sqlText);
        if (!parsedSnapshot) {
          setJsonError(
            'File SQL tidak berisi tabel database Store Inventory yang valid.'
          );
          return;
        }
        await replaceEntireDatabase(parsedSnapshot);
      } catch {
        setJsonError('Gagal melakukan restore dari file SQL.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportFullDatabase = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        setJsonError('');
        const rawText = String(ev.target?.result || '');
        if (file.name.toLowerCase().endsWith('.sql')) {
          const parsedSql = parseSqlDumpToSnapshot(rawText);
          if (!parsedSql) {
            setJsonError('File SQL backup tidak valid.');
            return;
          }
          await replaceEntireDatabase(parsedSql);
          return;
        }
        const parsed = JSON.parse(rawText || '{}');
        await replaceEntireDatabase(parsed);
      } catch {
        setJsonError('File backup database tidak valid.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleStartEditRecord = (index: number, item: unknown) => {
    setEditingRecordIndex(index);
    setEditingJsonText(JSON.stringify(item, null, 2));
    setJsonError('');
  };

  const handleSaveEditedRecord = () => {
    if (editingRecordIndex === null) return;
    try {
      const parsed = JSON.parse(editingJsonText);
      if (selectedCollection === 'companyProfile') {
        const res = updateDatabaseCollection('companyProfile', parsed);
        if (!res.success) {
          setJsonError(res.error || 'Gagal menyimpan');
          return;
        }
      } else {
        const nextArray = [...currentCollectionData];
        nextArray[editingRecordIndex] = parsed;
        const res = updateDatabaseCollection(selectedCollection, nextArray);
        if (!res.success) {
          setJsonError(res.error || 'Gagal menyimpan');
          return;
        }
      }
      setEditingRecordIndex(null);
      setEditingJsonText('');
      setJsonError('');
    } catch (err) {
      setJsonError(
        err instanceof Error ? `Format JSON tidak valid: ${err.message}` : 'Format JSON salah'
      );
    }
  };

  const handleDeleteRecord = (index: number) => {
    if (selectedCollection === 'companyProfile') return;
    const nextArray = currentCollectionData.filter((_, idx) => idx !== index);
    updateDatabaseCollection(selectedCollection, nextArray);
  };

  const handleAddNewRecordTemplate = () => {
    if (selectedCollection === 'roleDefinitions') {
      handleOpenAddRoleModal();
      return;
    }
    const sample =
      currentCollectionData.length > 0
        ? { ...(currentCollectionData[0] as Record<string, unknown>), id: `new_${Date.now()}` }
        : { id: `new_${Date.now()}` };
    const nextArray = [sample, ...currentCollectionData];
    updateDatabaseCollection(selectedCollection, nextArray);
    setEditingRecordIndex(0);
    setEditingJsonText(JSON.stringify(sample, null, 2));
  };

  const handleToggleRawTableEditor = () => {
    if (!isRawTableMode) {
      const dataToEdit =
        selectedCollection === 'companyProfile' ? companyProfile : currentCollectionData;
      setRawCollectionJson(JSON.stringify(dataToEdit, null, 2));
      setJsonError('');
      setIsRawTableMode(true);
    } else {
      setIsRawTableMode(false);
      setJsonError('');
    }
  };

  const handleSaveRawCollection = () => {
    try {
      const parsed = JSON.parse(rawCollectionJson);
      const res = updateDatabaseCollection(selectedCollection, parsed);
      if (!res.success) {
        setJsonError(res.error || 'Gagal menyimpan koleksi.');
        return;
      }
      setIsRawTableMode(false);
      setJsonError('');
    } catch (err) {
      setJsonError(
        err instanceof Error ? `JSON Error: ${err.message}` : 'Format JSON tidak valid'
      );
    }
  };

  const activeCollectionMeta = collectionsMeta.find((c) => c.key === selectedCollection)!;

  return (
    <div className="space-y-6">
      {/* Top Banner: Superuser Master Database Console */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 rounded-2xl p-6 text-white border border-amber-500/30 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-md bg-amber-400 text-slate-950 text-[11px] font-extrabold uppercase tracking-wider">
                  LVL 0 • DATABASE SUPERUSER &amp; SQL SERVER
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-semibold">
                  SQLite + SQL Sync Rev #{syncStatus.revision} • Online
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold mt-1.5">
                Master Database SQL &amp; Backup/Restore Server Mandiri (Self-Hosted)
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
                Seluruh tabel aplikasi Store otomatis tersinkronisasi dengan database relasional SQLite (<code className="text-amber-300">/data/store-inventory.sqlite</code>) dan file dump SQL standar (<code className="text-amber-300">/data/store-inventory-database.sql</code>) sehingga siap di-export maupun di-import kapan saja saat aplikasi di-hosting di server sendiri.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => forceSyncNow()}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
              Sync SQL Server
            </button>

            <button
              onClick={handleExportSqlDatabase}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Download Full Backup Database dalam format SQL (.sql) untuk MySQL / PostgreSQL / SQLite"
            >
              <Download className="w-3.5 h-3.5" />
              Backup Database (.SQL)
            </button>

            <label
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
              title="Import / Restore Database dari file .SQL"
            >
              <Upload className="w-3.5 h-3.5" />
              Restore Database (.SQL)
              <input
                type="file"
                accept=".sql"
                onChange={handleImportSqlDatabase}
                className="hidden"
              />
            </label>

            <button
              onClick={() =>
                exportAllMasterDatabaseToExcel({
                  stockItems,
                  storageLocations,
                  costCenters,
                  glAccounts,
                  users,
                  stockOpnameSessions,
                  locationTransferRequests,
                })
              }
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Export seluruh Master Data ke satu file Workbook Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Export Semua Master (.XLSX)
            </button>

            <button
              onClick={handleExportFullDatabase}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Backup (.JSON)
            </button>

            <label className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              Restore (.JSON)
              <input
                type="file"
                accept=".json,.sql"
                onChange={handleImportFullDatabase}
                className="hidden"
              />
            </label>

            <button
              onClick={() => resetAllTransactionsAndStock('EMPTY_ALL')}
              className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
              title="Kosongkan semua transaksi LPB, Stok Barang, Nota SIV, dan Kartu Stok"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Reset All (Kosongkan LPB, Stok &amp; SIV)
            </button>
          </div>
        </div>

        {/* Quick Jump All Application Modules */}
        {onNavigateTab && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300/90 mb-2.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Pintasan Cepat Akses Seluruh Modul Aplikasi (All Access Level 0):
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { tab: 'dashboard', label: '1. Dashboard Store' },
                { tab: 'items', label: '2. Master Stok Barang' },
                { tab: 'opname', label: '3. Stock Opname (Lock & Scan)' },
                { tab: 'lpb', label: '4. Penerimaan Barang (LPB)' },
                { tab: 'vouchers', label: '5. Nota Pengambilan (SIV)' },
                { tab: 'ledger', label: '6. Kartu Stok (Mutasi)' },
                { tab: 'min-stock', label: '7. Batas Stok Minimal' },
                { tab: 'locations', label: '8. Lokasi Rak & Pindah Lokasi' },
                { tab: 'accounting', label: '9. Cost Center & GL' },
                { tab: 'users', label: '10. Kelola User & Kategori Level' },
                { tab: 'activity-log', label: '11. Log Audit Sistem' },
                { tab: 'company', label: '12. Profil Perusahaan' },
              ].map((m) => (
                <button
                  key={m.tab}
                  onClick={() => onNavigateTab(m.tab)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-amber-400 hover:text-slate-950 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all"
                >
                  <span>{m.label}</span>
                  <ExternalLink className="w-3 h-3 opacity-75" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Total Tabel / Koleksi</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{collectionsMeta.length} Tabel</p>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
            Aktif & Tersinkronisasi
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Total Baris Record Database</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalRecordsCount} Record</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Seluruh entitas aplikasi</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Kategori Level Jabatan</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {roleDefinitions.length} Kategori Level
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Dapat ditambah oleh Super User
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs">
          <p className="text-xs text-slate-500 font-medium">Total Akun User Terdaftar</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{users.length} Akun</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {users.filter((u) => u.isActive).length} aktif •{' '}
            {users.filter((u) => !u.isActive).length} terkunci
          </p>
        </div>
      </div>

      {/* Main Database Explorer Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: 13 Collections */}
        <div className="lg:col-span-4 xl:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                Daftar Tabel Database
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Pilih koleksi untuk inspeksi & edit
              </p>
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-300">
              13 Tabel
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
            {collectionsMeta.map((col) => {
              const isSelected = selectedCollection === col.key;
              return (
                <button
                  key={col.key}
                  onClick={() => {
                    setSelectedCollection(col.key);
                    setEditingRecordIndex(null);
                    setIsRawTableMode(false);
                    setJsonError('');
                  }}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                    isSelected
                      ? 'bg-amber-50/90 border-l-4 border-l-amber-500'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                      {col.icon}
                    </div>
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-bold truncate ${
                          isSelected ? 'text-slate-950' : 'text-slate-800'
                        }`}
                      >
                        {col.label}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{col.subtitle}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {col.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Selected Table Inspector & Editor */}
        <div className="lg:col-span-8 xl:col-span-9 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          {/* Table Header */}
          <div className="p-5 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 font-mono text-[11px] font-bold">
                  db.{selectedCollection}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  ({currentCollectionData.length} record)
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-1">
                {activeCollectionMeta.label}
              </h3>
              <p className="text-xs text-slate-500">{activeCollectionMeta.subtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedCollection === 'roleDefinitions' && (
                <button
                  onClick={handleOpenAddRoleModal}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Kategori Level Baru
                </button>
              )}

              {selectedCollection !== 'companyProfile' &&
                selectedCollection !== 'roleDefinitions' && (
                  <button
                    onClick={handleAddNewRecordTemplate}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Record
                  </button>
                )}

              <button
                onClick={handleToggleRawTableEditor}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                  isRawTableMode
                    ? 'bg-slate-900 text-amber-300 border-slate-900'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                {isRawTableMode ? 'Mode Tabel Visual' : 'Edit Raw JSON Koleksi'}
              </button>

              {activeCollectionMeta.linkedTab && onNavigateTab && (
                <button
                  onClick={() => onNavigateTab(activeCollectionMeta.linkedTab!)}
                  className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Buka Modul
                </button>
              )}
            </div>
          </div>

          {/* Search bar */}
          {!isRawTableMode && (
            <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Cari kata kunci di dalam tabel ${activeCollectionMeta.label}...`}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  Reset Filter
                </button>
              )}
            </div>
          )}

          {jsonError && (
            <div className="mx-5 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
              {jsonError}
            </div>
          )}

          {/* Content Body */}
          <div className="p-5 flex-1 overflow-y-auto max-h-[640px]">
            {isRawTableMode ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700">
                    Editor JSON Langsung untuk Koleksi{' '}
                    <span className="font-mono text-amber-700">db.{selectedCollection}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsRawTableMode(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSaveRawCollection}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Simpan Koleksi ke Database
                    </button>
                  </div>
                </div>
                <textarea
                  value={rawCollectionJson}
                  onChange={(e) => setRawCollectionJson(e.target.value)}
                  rows={22}
                  className="w-full font-mono text-xs p-4 rounded-xl bg-slate-950 text-emerald-300 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            ) : selectedCollection === 'roleDefinitions' ? (
              <div className="space-y-3">
                {roleDefinitions.map((def) => {
                  const enabledPermsCount = Object.values(def.defaultPermissions).filter(
                    Boolean
                  ).length;
                  return (
                    <div
                      key={def.roleKey}
                      className="rounded-xl border border-slate-200 p-4 hover:border-amber-400/60 transition-all bg-white shadow-2xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-amber-300 text-xs font-extrabold">
                              Level {def.levelNumber}
                            </span>
                            <span className="text-sm font-bold text-slate-900">{def.name}</span>
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                              key: {def.roleKey}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[11px] font-semibold">
                              Badge: {def.badgeLabel}
                            </span>
                            {def.isSystemDefault ? (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase">
                                Default Sistem
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase">
                                Kategori Level Tambahan
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 mt-1.5">{def.description}</p>
                          <p className="text-[11px] text-slate-500 mt-1">
                            Hak Akses Default Aktif:{' '}
                            <span className="font-bold text-slate-800">
                              {enabledPermsCount} dari {PERMISSION_DEFINITIONS.length} izin
                            </span>{' '}
                            • Jumlah User:{' '}
                            <span className="font-bold text-slate-800">
                              {users.filter((u) => u.role === def.roleKey).length} akun
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleOpenEditRoleModal(def)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Level
                          </button>
                          {!def.isSystemDefault && (
                            <button
                              onClick={() => deleteRoleDefinition(def.roleKey)}
                              className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold flex items-center gap-1.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Hapus
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecords.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    Tidak ada record yang cocok dengan pencarian.
                  </div>
                ) : (
                  filteredRecords.map(({ item, originalIndex }) => {
                    const obj = (item || {}) as Record<string, unknown>;
                    const primaryTitle =
                      String(
                        obj.name ||
                          obj.itemName ||
                          obj.lpbNumber ||
                          obj.voucherNumber ||
                          obj.proposalNumber ||
                          obj.title ||
                          obj.code ||
                          obj.appName ||
                          obj.id ||
                          `Record #${originalIndex + 1}`
                      );
                    const secondaryInfo = String(
                      obj.username
                        ? `@${obj.username} • ${getRoleLabel(String(obj.role || ''))} • ${obj.department || ''}`
                        : obj.sku
                        ? `${obj.sku} • Stok: ${obj.currentStock ?? obj.quantity ?? '-'} ${obj.unit || ''}`
                        : obj.supplierName ||
                          obj.requestedBy ||
                          obj.referenceNumber ||
                          obj.description ||
                          obj.message ||
                          ''
                    );

                    const isEditingThis = editingRecordIndex === originalIndex;

                    return (
                      <div
                        key={String(obj.id || obj.code || originalIndex)}
                        className="rounded-xl border border-slate-200 p-4 bg-white hover:border-slate-300 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-bold">
                                #{originalIndex + 1}
                              </span>
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {primaryTitle}
                              </p>
                            </div>
                            {secondaryInfo && (
                              <p className="text-xs text-slate-500 mt-0.5 truncate">
                                {secondaryInfo}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() =>
                                isEditingThis
                                  ? setEditingRecordIndex(null)
                                  : handleStartEditRecord(originalIndex, item)
                              }
                              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              {isEditingThis ? 'Tutup Editor' : 'Edit Record JSON'}
                            </button>
                            {selectedCollection !== 'companyProfile' && (
                              <button
                                onClick={() => handleDeleteRecord(originalIndex)}
                                className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {isEditingThis && (
                          <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                            <textarea
                              value={editingJsonText}
                              onChange={(e) => setEditingJsonText(e.target.value)}
                              rows={10}
                              className="w-full font-mono text-xs p-3 rounded-xl bg-slate-950 text-emerald-300 border border-slate-800 focus:outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setEditingRecordIndex(null)}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600"
                              >
                                Batal
                              </button>
                              <button
                                onClick={handleSaveEditedRecord}
                                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Simpan Perubahan Record
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Footer Reset Demo Data */}
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Penyimpanan Server: <code className="font-mono">/data/shared-inventory-state.json</code>
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => resetAllTransactionsAndStock('ZERO_STOCK_ONLY')}
                className="text-amber-600 hover:text-amber-700 font-semibold cursor-pointer"
              >
                Kosongkan Transaksi &amp; Nolkan Stok (Stok=0)
              </button>
              <span>&middot;</span>
              <button
                onClick={() => resetAllTransactionsAndStock('EMPTY_ALL')}
                className="text-red-600 hover:text-red-700 font-bold cursor-pointer"
              >
                Reset All (Kosongkan LPB, Stok &amp; SIV)
              </button>
              <span>&middot;</span>
              <button
                onClick={resetToDefaultData}
                className="text-slate-600 hover:text-slate-800 font-semibold cursor-pointer"
              >
                Restore Data Demo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Tambah / Edit Kategori Level Baru */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-8">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingRoleKey
                      ? `Edit Kategori Level — ${roleFormName}`
                      : 'Tambah Kategori Level Jabatan Baru'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    Super User dapat menambahkan kategori level baru beserta hak akses default-nya
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRoleModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoleModal} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {roleModalError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                  {roleModalError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor Urut Level *
                  </label>
                  <input
                    type="number"
                    min={editingRoleKey === 'superuser' ? 0 : 1}
                    max={99}
                    disabled={editingRoleKey === 'superuser'}
                    value={roleFormLevel}
                    onChange={(e) => setRoleFormLevel(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Angka lebih kecil = hierarki lebih tinggi
                  </p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Kategori Level / Jabatan *
                  </label>
                  <input
                    type="text"
                    value={roleFormName}
                    onChange={(e) => setRoleFormName(e.target.value)}
                    placeholder="Contoh: Supervisor Store / Checker Store / Koordinator"
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kode ID Role (Unik)
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(editingRoleKey)}
                    value={roleFormKey}
                    onChange={(e) => setRoleFormKey(e.target.value)}
                    placeholder="Otomatis dari nama"
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 bg-slate-50 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Label Badge Pendek
                  </label>
                  <input
                    type="text"
                    value={roleFormBadge}
                    onChange={(e) => setRoleFormBadge(e.target.value)}
                    placeholder={`LVL ${roleFormLevel} • ${roleFormName ? roleFormName.toUpperCase() : 'NAMA LEVEL'}`}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tema Warna Badge
                  </label>
                  <select
                    value={roleFormColor}
                    onChange={(e) =>
                      setRoleFormColor(e.target.value as RoleLevelDefinition['colorTheme'])
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none"
                  >
                    <option value="amber">Amber (Emas)</option>
                    <option value="violet">Violet (Ungu)</option>
                    <option value="emerald">Emerald (Hijau)</option>
                    <option value="blue">Blue (Biru)</option>
                    <option value="cyan">Cyan (Biru Muda)</option>
                    <option value="rose">Rose (Merah Muda)</option>
                    <option value="slate">Slate (Abu-abu)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Deskripsi Tugas & Wewenang Level
                </label>
                <textarea
                  value={roleFormDesc}
                  onChange={(e) => setRoleFormDesc(e.target.value)}
                  rows={2}
                  placeholder="Jelaskan cakupan wewenang kategori level ini di Store..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none"
                />
              </div>

              {/* Default Permissions Matrix */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800">
                    Hak Akses Default untuk Kategori Level Ini:
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allTrue = {} as UserPermissions;
                        PERMISSION_DEFINITIONS.forEach((p) => {
                          allTrue[p.key] = true;
                        });
                        setRoleFormPerms(allTrue);
                      }}
                      className="text-[11px] font-semibold text-emerald-600 hover:underline"
                    >
                      Centang Semua
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => {
                        const minTrue = {} as UserPermissions;
                        PERMISSION_DEFINITIONS.forEach((p) => {
                          minTrue[p.key] = p.key === 'canViewStock';
                        });
                        setRoleFormPerms(minTrue);
                      }}
                      className="text-[11px] font-semibold text-slate-500 hover:underline"
                    >
                      Hanya Lihat Stok
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-3 rounded-xl bg-slate-50 border border-slate-200">
                  {PERMISSION_DEFINITIONS.map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200/80 cursor-pointer hover:border-amber-400"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(roleFormPerms[perm.key])}
                        onChange={(e) =>
                          setRoleFormPerms((prev) => ({
                            ...prev,
                            [perm.key]: e.target.checked,
                          }))
                        }
                        className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-800 leading-tight">
                          {perm.label}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                          {perm.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  Simpan Kategori Level
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
