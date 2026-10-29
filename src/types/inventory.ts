export type UserRole = 'superuser' | 'kepala_gudang' | 'admin' | 'user' | 'viewer' | string;

export interface UserPermissions {
  canViewStock: boolean; // Melihat stok barang
  canManageStockItems: boolean; // Menambahkan / edit barang baru di Master Stok
  canCreateSIV: boolean; // Menerbitkan SIV
  canViewAllSIV: boolean; // Melihat semua SIV yang masuk (jika false: hanya melihat SIV sendiri)
  canValidateSIV: boolean; // ACC SIV dan validasi/scan barcode barang
  canApproveSIVStockDeduction: boolean; // ACC final SIV untuk pengurangan stock
  canCreateLPB: boolean; // Input LPB
  canApproveLPBStockAddition: boolean; // ACC LPB untuk penambahan stock
  canManageCostCenterGL: boolean; // Menambahkan Cost Center dan GL
  canProposeMinStock: boolean; // Mengajukan usulan stok minimal
  canVerifyMinStock: boolean; // Verifikasi / ACC pengajuan stok minimal dari pemohon
  canApproveMinStockSystem: boolean; // ACC final pengajuan stok minimal & merubah stok minimal di sistem
  canAccessStockMovement: boolean; // Akses mutasi barang (Kartu Stok)
  canManageLowerUsers: boolean; // Menambahkan, edit username, reset password & atur hak akses user level di bawahnya
  canViewLowerAuditLogs: boolean; // Melihat log audit user level di bawahnya
  canManageCompanyProfile: boolean; // Mengelola profil perusahaan & lokasi rak
  canPerformStockOpname?: boolean; // Melakukan scan & hitung fisik Stock Opname (setelah dimulai & stok akhir ter-lock)
}

export interface RoleLevelDefinition {
  roleKey: string;
  levelNumber: number;
  name: string;
  badgeLabel: string;
  description: string;
  colorTheme: 'amber' | 'violet' | 'emerald' | 'blue' | 'slate' | 'rose' | 'cyan';
  isSystemDefault?: boolean;
  defaultPermissions: UserPermissions;
}

export const INITIAL_ROLE_DEFINITIONS: RoleLevelDefinition[] = [
  {
    roleKey: 'superuser',
    levelNumber: 0,
    name: 'Super User (All Akses)',
    badgeLabel: 'LVL 0 • SUPER USER',
    description:
      'Akses penuh ke seluruh modul aplikasi, Master Database Superuser, manajemen kategori level jabatan, mutasi barang, approval penuh, dan pengaturan semua level di bawahnya.',
    colorTheme: 'amber',
    isSystemDefault: true,
    defaultPermissions: {
      canViewStock: true,
      canManageStockItems: true,
      canCreateSIV: true,
      canViewAllSIV: true,
      canValidateSIV: true,
      canApproveSIVStockDeduction: true,
      canCreateLPB: true,
      canApproveLPBStockAddition: true,
      canManageCostCenterGL: true,
      canProposeMinStock: true,
      canVerifyMinStock: true,
      canApproveMinStockSystem: true,
      canAccessStockMovement: true,
      canManageLowerUsers: true,
      canViewLowerAuditLogs: true,
      canManageCompanyProfile: true,
      canPerformStockOpname: true,
    },
  },
  {
    roleKey: 'kepala_gudang',
    levelNumber: 1,
    name: 'Kepala Store',
    badgeLabel: 'LVL 1 • KEPALA STORE',
    description:
      'ACC SIV yang diterbitkan pemohon, ACC LPB penambahan stock, tambah Cost Center & GL, kelola user & hak akses level di bawahnya, ACC stok minimal sistem, akses mutasi barang, dan log audit level bawah.',
    colorTheme: 'violet',
    isSystemDefault: true,
    defaultPermissions: {
      canViewStock: true,
      canManageStockItems: true,
      canCreateSIV: true,
      canViewAllSIV: true,
      canValidateSIV: true,
      canApproveSIVStockDeduction: true,
      canCreateLPB: true,
      canApproveLPBStockAddition: true,
      canManageCostCenterGL: true,
      canProposeMinStock: true,
      canVerifyMinStock: true,
      canApproveMinStockSystem: true,
      canAccessStockMovement: true,
      canManageLowerUsers: true,
      canViewLowerAuditLogs: true,
      canManageCompanyProfile: true,
      canPerformStockOpname: true,
    },
  },
  {
    roleKey: 'admin',
    levelNumber: 2,
    name: 'Admin Store',
    badgeLabel: 'LVL 2 • ADMIN STORE',
    description:
      'Melihat semua SIV masuk, menyerahkan barang SIV ke penerima & validasi scan barcode (otomatis potong stok setelah di-ACC Kepala Store), input LPB, tambah barang baru, tambah Cost Center & GL, kelola user bawah, dan verifikasi stok minimal.',
    colorTheme: 'emerald',
    isSystemDefault: true,
    defaultPermissions: {
      canViewStock: true,
      canManageStockItems: true,
      canCreateSIV: true,
      canViewAllSIV: true,
      canValidateSIV: true,
      canApproveSIVStockDeduction: false,
      canCreateLPB: true,
      canApproveLPBStockAddition: false,
      canManageCostCenterGL: true,
      canProposeMinStock: true,
      canVerifyMinStock: true,
      canApproveMinStockSystem: false,
      canAccessStockMovement: true,
      canManageLowerUsers: true,
      canViewLowerAuditLogs: true,
      canManageCompanyProfile: true,
      canPerformStockOpname: true,
    },
  },
  {
    roleKey: 'user',
    levelNumber: 3,
    name: 'PIC',
    badgeLabel: 'LVL 3 • PIC',
    description:
      'Status PIC (Person In Charge) — Menerbitkan SIV (Nota Pengambilan Barang), melihat stok store, mengajukan perubahan stok minimal, membantu melakukan Stock Opname (saat stok akhir ter-lock), dan melihat riwayat SIV sendiri.',
    colorTheme: 'blue',
    isSystemDefault: true,
    defaultPermissions: {
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
      canPerformStockOpname: true,
    },
  },
  {
    roleKey: 'viewer',
    levelNumber: 4,
    name: 'View (Hanya Lihat Stok)',
    badgeLabel: 'LVL 4 • VIEW',
    description: 'Hanya dapat melihat posisi stok barang di store (Read-Only Monitoring).',
    colorTheme: 'slate',
    isSystemDefault: true,
    defaultPermissions: {
      canViewStock: true,
      canManageStockItems: false,
      canCreateSIV: false,
      canViewAllSIV: false,
      canValidateSIV: false,
      canApproveSIVStockDeduction: false,
      canCreateLPB: false,
      canApproveLPBStockAddition: false,
      canManageCostCenterGL: false,
      canProposeMinStock: false,
      canVerifyMinStock: false,
      canApproveMinStockSystem: false,
      canAccessStockMovement: false,
      canManageLowerUsers: false,
      canViewLowerAuditLogs: false,
      canManageCompanyProfile: false,
      canPerformStockOpname: false,
    },
  },
];

let dynamicRoleDefinitions: RoleLevelDefinition[] = [...INITIAL_ROLE_DEFINITIONS];

export function formatUserAccountId(id?: string): string {
  if (!id) return '';
  return String(id).trim().replace(/staff/gi, 'PIC');
}

export function normalizeGudangToStoreText(text: string): string {
  if (!text) return text;
  return text
    .replace(/KEPALA GUDANG/g, 'KEPALA STORE')
    .replace(/Kepala Gudang/g, 'Kepala Store')
    .replace(/kepala gudang/g, 'kepala store')
    .replace(/ADMIN GUDANG/g, 'ADMIN STORE')
    .replace(/Admin Gudang/g, 'Admin Store')
    .replace(/admin gudang/g, 'admin store')
    .replace(/GUDANG/g, 'STORE')
    .replace(/Gudang/g, 'Store')
    .replace(/gudang/g, 'store');
}

export function setDynamicRoleDefinitions(defs: RoleLevelDefinition[]) {
  if (!Array.isArray(defs) || defs.length === 0) {
    dynamicRoleDefinitions = [...INITIAL_ROLE_DEFINITIONS];
    return;
  }
  const mergedMap = new Map<string, RoleLevelDefinition>();
  for (const base of INITIAL_ROLE_DEFINITIONS) {
    mergedMap.set(base.roleKey, base);
  }
  for (const item of defs) {
    if (item && item.roleKey) {
      let normName = normalizeGudangToStoreText(item.name);
      let normBadge = normalizeGudangToStoreText(item.badgeLabel);
      if (item.roleKey === 'user') {
        if (!normName || /pemohon|staff/i.test(normName)) {
          normName = 'PIC';
        }
        if (!normBadge || /pemohon|staff/i.test(normBadge)) {
          normBadge = 'LVL 3 • PIC';
        }
      }
      mergedMap.set(item.roleKey, {
        ...item,
        name: normName,
        badgeLabel: normBadge,
        description: normalizeGudangToStoreText(item.description),
      });
    }
  }
  dynamicRoleDefinitions = Array.from(mergedMap.values()).sort(
    (a, b) => a.levelNumber - b.levelNumber
  );
}

export function getAllRoleDefinitions(): RoleLevelDefinition[] {
  return [...dynamicRoleDefinitions].sort((a, b) => a.levelNumber - b.levelNumber);
}

export function getRoleDefinition(role: UserRole): RoleLevelDefinition | undefined {
  return dynamicRoleDefinitions.find((r) => r.roleKey === role);
}

export function getRoleLevel(role: UserRole): number {
  const found = getRoleDefinition(role);
  if (found) return found.levelNumber;
  switch (role) {
    case 'superuser':
      return 0;
    case 'kepala_gudang':
      return 1;
    case 'admin':
      return 2;
    case 'user':
      return 3;
    case 'viewer':
      return 4;
    default:
      return 4;
  }
}

export const getRoleHierarchyLevel = getRoleLevel;

export function getRoleLabel(
  role: UserRole,
  showLevelOrDefs: boolean | RoleLevelDefinition[] = false
): string {
  const showLevel = typeof showLevelOrDefs === 'boolean' ? showLevelOrDefs : false;
  const found = getRoleDefinition(role);
  if (found) {
    return showLevel ? `Level ${found.levelNumber} — ${found.name}` : found.name;
  }
  switch (role) {
    case 'superuser':
      return showLevel ? 'Level 0 — Super User (All Akses)' : 'Super User (All Akses)';
    case 'kepala_gudang':
      return showLevel ? 'Level 1 — Kepala Store' : 'Kepala Store';
    case 'admin':
      return showLevel ? 'Level 2 — Admin Store' : 'Admin Store';
    case 'user':
      return showLevel ? 'Level 3 — PIC' : 'PIC';
    case 'viewer':
      return showLevel ? 'Level 4 — View (Hanya Lihat Stok)' : 'View (Hanya Lihat Stok)';
    default:
      return String(role);
  }
}

export function getRoleShortBadge(role: UserRole, showLevel = false): string {
  const found = getRoleDefinition(role);
  if (found) {
    const rawBadge = found.badgeLabel || `LVL ${found.levelNumber} • ${found.name.toUpperCase()}`;
    if (showLevel) return rawBadge;
    return rawBadge.replace(/^LVL\s*\d+\s*[•·-]\s*/i, '').trim() || found.name.toUpperCase();
  }
  switch (role) {
    case 'superuser':
      return showLevel ? 'LVL 0 • SUPER USER' : 'SUPER USER';
    case 'kepala_gudang':
      return showLevel ? 'LVL 1 • KEPALA STORE' : 'KEPALA STORE';
    case 'admin':
      return showLevel ? 'LVL 2 • ADMIN STORE' : 'ADMIN STORE';
    case 'user':
      return showLevel ? 'LVL 3 • PIC' : 'PIC';
    case 'viewer':
      return showLevel ? 'LVL 4 • VIEW' : 'VIEW';
    default:
      return String(role).toUpperCase();
  }
}

export function canManageTargetRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === 'superuser') return true; // Level 0 dapat mengelola semua level
  const actorLvl = getRoleLevel(actorRole);
  const targetLvl = getRoleLevel(targetRole);
  return targetLvl > actorLvl; // Hanya dapat mengelola level di bawahnya (angka level lebih besar)
}

export function getCreatableRoles(actorRole: UserRole): UserRole[] {
  const allDefs = getAllRoleDefinitions();
  if (actorRole === 'superuser') {
    return allDefs.map((d) => d.roleKey);
  }
  const actorLvl = getRoleLevel(actorRole);
  return allDefs.filter((d) => d.levelNumber > actorLvl).map((d) => d.roleKey);
}

export function canViewAuditLogOfRole(viewerRole: UserRole, logActorRole: UserRole): boolean {
  if (viewerRole === 'superuser') return true; // Level 0 melihat semua log audit
  const viewerLvl = getRoleLevel(viewerRole);
  const actorLvl = getRoleLevel(logActorRole);
  return actorLvl > viewerLvl; // Melihat log audit level di bawahnya
}

export const PERMISSION_DEFINITIONS: {
  key: keyof UserPermissions;
  label: string;
  description: string;
  category: 'Stok & Mutasi' | 'Transaksi SIV & LPB' | 'Stok Minimal' | 'Master, User & Audit';
}[] = [
  {
    key: 'canViewStock',
    label: 'Melihat Master Stok Barang',
    description: 'Melihat daftar barang, posisi stok fisik store, dan lokasi rak.',
    category: 'Stok & Mutasi',
  },
  {
    key: 'canManageStockItems',
    label: 'Menambahkan & Edit Barang Baru',
    description: 'Menambah SKU baru, import Excel stok, dan cetak barcode barang.',
    category: 'Stok & Mutasi',
  },
  {
    key: 'canAccessStockMovement',
    label: 'Akses Mutasi Barang (Kartu Stok)',
    description: 'Membuka riwayat keluar-masuk barang (Kartu Stok / Ledger).',
    category: 'Stok & Mutasi',
  },
  {
    key: 'canPerformStockOpname',
    label: 'Melakukan Stock Opname (Saat Stok Akhir Ter-Lock)',
    description:
      'Membantu departemen store melakukan scan barcode & input jumlah fisik barang setelah Stock Opname dimulai dan stok akhir ter-lock.',
    category: 'Stok & Mutasi',
  },
  {
    key: 'canCreateSIV',
    label: 'Menerbitkan SIV (Nota Pengambilan)',
    description: 'Membuat permohonan pengambilan barang store (SIV).',
    category: 'Transaksi SIV & LPB',
  },
  {
    key: 'canViewAllSIV',
    label: 'Melihat Semua SIV yang Masuk',
    description: 'Melihat seluruh SIV dari semua pemohon (jika nonaktif: hanya SIV milik sendiri).',
    category: 'Transaksi SIV & LPB',
  },
  {
    key: 'canApproveSIVStockDeduction',
    label: 'ACC SIV (Persetujuan Kepala Store)',
    description: 'Menyetujui (ACC) nota pengambilan barang (SIV) yang diterbitkan pemohon sebelum diserahkan Admin ke penerima.',
    category: 'Transaksi SIV & LPB',
  },
  {
    key: 'canValidateSIV',
    label: 'Menyerahkan Barang SIV ke Penerima & Scan Barcode (Otomatis Potong Stok)',
    description: 'Validasi scan barcode & menyerahkan barang SIV yang sudah di-ACC Kepala Store kepada penerima (otomatis memotong stok).',
    category: 'Transaksi SIV & LPB',
  },
  {
    key: 'canCreateLPB',
    label: 'Input LPB (Penerimaan Barang)',
    description: 'Mencatat Surat Jalan Supplier / Laporan Penerimaan Barang (LPB).',
    category: 'Transaksi SIV & LPB',
  },
  {
    key: 'canApproveLPBStockAddition',
    label: 'ACC LPB untuk Penambahan Stock',
    description: 'Persetujuan akhir (Approve) LPB agar stok fisik bertambah di sistem.',
    category: 'Transaksi SIV & LPB',
  },
  {
    key: 'canProposeMinStock',
    label: 'Mengajukan Usulan Stok Minimal',
    description: 'Membuat pengajuan perubahan batas stok minimal barang.',
    category: 'Stok Minimal',
  },
  {
    key: 'canVerifyMinStock',
    label: 'Verifikasi / ACC Pengajuan Stok Minimal dari User',
    description: 'Memverifikasi dan mengunci pengajuan stok minimal dari pemohon.',
    category: 'Stok Minimal',
  },
  {
    key: 'canApproveMinStockSystem',
    label: 'ACC Pengajuan & Merubah Stok Minimal di Sistem',
    description: 'Approve final pengajuan stok minimal dan mengubah batas stok minimal langsung di sistem.',
    category: 'Stok Minimal',
  },
  {
    key: 'canManageCostCenterGL',
    label: 'Menambahkan Cost Center & GL Account',
    description: 'Menambah, mengubah, dan import data Master Cost Center & GL.',
    category: 'Master, User & Audit',
  },
  {
    key: 'canManageLowerUsers',
    label: 'Kelola User, Edit Username, Reset Password & Hak Akses Level di Bawahnya',
    description: 'Menambah user baru, edit username/hak akses, lock akun, dan reset password untuk level di bawahnya.',
    category: 'Master, User & Audit',
  },
  {
    key: 'canViewLowerAuditLogs',
    label: 'Melihat Log Audit Level User di Bawahnya',
    description: 'Mengakses System Activity Log untuk memantau jejak audit level di bawahnya.',
    category: 'Master, User & Audit',
  },
  {
    key: 'canManageCompanyProfile',
    label: 'Kelola Lokasi Rak & Profil Perusahaan',
    description: 'Mengatur master lokasi penyimpanan rak serta identitas perusahaan.',
    category: 'Master, User & Audit',
  },
];

export function getDefaultPermissionsForRole(role: UserRole): UserPermissions {
  const found = getRoleDefinition(role);
  if (found && found.defaultPermissions) {
    return { ...found.defaultPermissions };
  }
  const fallbackViewer = INITIAL_ROLE_DEFINITIONS.find((r) => r.roleKey === 'viewer')!;
  return { ...fallbackViewer.defaultPermissions };
}

export function getEffectivePermissions(
  user?: UserAccount | null,
  _roleDefs?: RoleLevelDefinition[]
): UserPermissions {
  if (!user) return getDefaultPermissionsForRole('viewer');
  if (user.role === 'superuser') return getDefaultPermissionsForRole('superuser');
  const defaults = getDefaultPermissionsForRole(user.role);
  if (!user.permissions) return defaults;
  return {
    ...defaults,
    ...user.permissions,
  };
}

export interface UserAccount {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  department: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  permissions?: Partial<UserPermissions>;
}

export interface StockCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const INITIAL_STOCK_CATEGORIES: StockCategory[] = [
  {
    id: 'cat_sparepart_mesin',
    name: 'Sparepart Mesin',
    description: 'Suku cadang mekanikal, bearing, seal, valve, dan komponen mesin produksi',
    color: 'blue',
  },
  {
    id: 'cat_elektrikal',
    name: 'Komponen Elektrikal',
    description: 'Komponen listrik, sensor, kontaktor, kabel, motor listrik, dan instrumen PLC',
    color: 'amber',
  },
  {
    id: 'cat_kimia_pelumas',
    name: 'Bahan Kimia & Pelumas',
    description: 'Oli industri, grease, pelumas mesin, bahan kimia pengolahan, dan cairan pembersih',
    color: 'emerald',
  },
  {
    id: 'cat_peralatan_workshop',
    name: 'Peralatan Workshop',
    description: 'Perkakas teknik, hand tools, mata bor, batu gerinda, dan alat kerja bengkel',
    color: 'indigo',
  },
  {
    id: 'cat_apd_safety',
    name: 'Peralatan Keselamatan (APD)',
    description: 'Alat pelindung diri, helm safety, sarung tangan, sepatu safety, dan masker',
    color: 'rose',
  },
  {
    id: 'cat_kemasan_logistik',
    name: 'Kemasan & Logistik',
    description: 'Karung, plastik wrapping, strapping band, lakban, palet, dan material pengemasan',
    color: 'purple',
  },
  {
    id: 'cat_umum_gudang',
    name: 'Umum & Konsumsi Gudang',
    description: 'Perlengkapan operasional store, ATK gudang, kebersihan, dan kebutuhan umum',
    color: 'slate',
  },
];

export interface StockItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  categories?: string[]; // 1 barang dapat dikaitkan dengan satu atau lebih kategori
  unit: string;
  currentStock: number;
  allocatedStock: number; // Qty requested in pending/approved vouchers waiting handover/verification
  minStock: number;
  location: string;
  locations?: string[]; // 1 jenis barang dapat berada pada beberapa lokasi rak
  unitPrice?: number;
  description?: string;
  updatedAt: string;
}

/**
 * Mengambil daftar kategori bersih untuk satu item stok (mendukung 1 atau lebih kategori).
 */
export function getItemCategories(
  item?: Pick<StockItem, 'category' | 'categories'> | null
): string[] {
  if (!item) return ['Umum & Konsumsi Gudang'];
  const result: string[] = [];
  const seen = new Set<string>();

  const pushClean = (raw?: string) => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(trimmed);
    }
  };

  if (Array.isArray(item.categories) && item.categories.length > 0) {
    item.categories.forEach((c) => pushClean(c));
  }

  if (result.length === 0 && item.category) {
    // Support legacy single category or comma-separated categories
    item.category
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((c) => pushClean(c));
  }

  return result.length > 0 ? result : ['Umum & Konsumsi Gudang'];
}

export function formatItemCategories(
  item?: Pick<StockItem, 'category' | 'categories'> | null
): string {
  return getItemCategories(item).join(', ');
}


export type LPBStatus = 'PENDING_APPROVAL' | 'PENDING_HEAD_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface LPBItem {
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  quantity: number;
  batchNo?: string;
  condition: 'Baik' | 'Kurang' | 'Rusak';
  notes?: string;
  specification?: string;
  storageLocation?: string;
  barcodeValidated?: boolean;
  barcodeScannedAt?: string;
}

export interface LPBDocument {
  id: string;
  lpbNumber: string; // LPB-202610-XXXX
  sjNumber: string; // Surat Jalan Supplier
  sjDate: string;
  supplierName: string;
  supplierAddress?: string;
  receivedDate: string;
  poNumber?: string;
  driverName?: string;
  vehiclePlate?: string;
  usagePurpose?: string;
  storageLocation?: string;
  notes?: string;
  status?: LPBStatus; // PENDING_APPROVAL (Admin sudah ACC & validasi/scan, stok belum bertambah) | APPROVED (Kepala Gudang sudah approve penambahan stock) | REJECTED
  receivedByAdmin: string; // Admin Gudang yang ACC & Validasi/Scan Barang Masuk
  receivedByAdminId?: string; // ID akun Admin Store yang memvalidasi LPB
  receivedByAdminUsername?: string; // Username akun Admin Store yang memvalidasi LPB
  adminValidatedAt?: string;
  verifiedBy: string; // Kepala Gudang yang Approve Penambahan Stock
  approvedByWarehouseHead?: string;
  approvedByWarehouseHeadId?: string; // ID akun Kepala Store yang meng-approve penambahan stock
  approvedByWarehouseHeadUsername?: string; // Username akun Kepala Store yang meng-approve penambahan stock
  approvedAt?: string;
  headApprovalNotes?: string;
  rejectionReason?: string;
  items: LPBItem[];
  createdAt: string;
}

export interface CostCenterEntry {
  code: string; // e.g. "60"
  name: string; // e.g. "Bagging Plant 2 & Pemuatan"
  description?: string;
}

export interface GLAccountEntry {
  code: string; // e.g. "51010"
  name: string; // e.g. "Biaya Sparepart Mesin & Peralatan"
  description?: string;
}

export interface StorageLocation {
  id: string;
  code: string; // e.g. "RAK-A1"
  name: string; // e.g. "Rak A1 - Sparepart Mesin"
  zone?: string; // e.g. "Zona A (Mekanik & Mesin)"
  description?: string;
}

export interface CompanyProfile {
  appName: string; // e.g. "GudangPresisi"
  appTagline: string; // e.g. "SISTEM INVENTORY"
  companyName: string; // e.g. "PT. Abadi Agrosindo Persada"
  city: string; // e.g. "Sidoarjo"
  address: string; // e.g. "Kawasan Industri, Sidoarjo - Jawa Timur"
  phone?: string;
  email?: string;
  logoUrl?: string; // custom uploaded logo base64 or url; if empty uses default sprout logo
  sivDocCode: string; // e.g. "FR/AAP/G-STR/23/001"
  lpbDocCode: string; // e.g. "FR/AAP/G-LPB/23/002"
  permanentLoginUrl?: string; // Link login tetap / permanen agar tidak berubah saat update
}

export type IssueVoucherStatus = 'PENDING' | 'APPROVED' | 'HANDOVER_COMPLETED' | 'COMPLETED' | 'REJECTED';

export interface IssueVoucherItem {
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  requestedQty: number;
  approvedQty?: number;
  issuedQty?: number; // Jumlah realisasi yang dikeluarkan saat validasi scan barcode oleh Admin Gudang (0 = tidak jadi dikeluarkan)
  isCancelled?: boolean; // Centang barang tidak jadi dikeluarkan (qty pengeluaran = 0)
  barcodeValidated?: boolean; // Sudah divalidasi dengan scan barcode barang
  barcodeScannedAt?: string; // Waktu scan barcode barang
  sourceLocation?: string; // Lokasi rak dari mana barang fisik diambil saat validasi penyerahan oleh Admin
  availableStockSnapshot?: number;
  costCenter?: string;
  glAcc?: string;
  glAccount?: string;
}

export interface IssueVoucherDocument {
  id: string;
  voucherNumber: string; // NPB-202610-XXXX
  requestedBy: string; // User yang Menerbitkan Nota Pengambilan Barang
  userId: string;
  requesterUsername?: string; // Username akun Pemohon yang menerbitkan SIV
  department: string;
  requestDate: string;
  purpose: string;
  notes?: string;
  costCenter?: string;
  glAccount?: string;
  status: IssueVoucherStatus;
  items: IssueVoucherItem[];
  approvedByRequester?: string; // User yang Menerbitkan Nota Pengambilan Barang
  approvedByWarehouseHead?: string; // Nama Kepala Gudang yang Verifikasi Pengeluaran Stok
  approvedByWarehouseHeadId?: string; // ID akun Kepala Store yang Verifikasi Pengeluaran Stok
  approvedByWarehouseHeadUsername?: string; // Username akun Kepala Store yang Verifikasi Pengeluaran Stok
  warehouseHeadName?: string; // Nama Kepala Gudang
  headApprovedAt?: string; // Tanggal dan waktu Verifikasi Pengeluaran Stok oleh Kepala Gudang
  approvedByAdmin?: string; // Nama User Admin Gudang yang ACC SIV
  approvedByAdminId?: string; // ID akun Admin Store yang ACC SIV
  approvedByAdminUsername?: string; // Username akun Admin Store yang ACC SIV
  approvedAt?: string; // Tanggal dan waktu ACC SIV / Verifikasi Final
  handoverOfficer?: string; // Petugas / Admin Gudang yang meng-ACC SIV & memvalidasi pengeluaran barang
  handoverAt?: string; // Tanggal dan waktu Penyerahan & Validasi barang oleh Admin Gudang
  recipientName?: string; // Nama penerima (yang diinputkan admin saat penyerahan)
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type MovementType = 'IN' | 'OUT';

export interface StockMovement {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  type: MovementType;
  source: 'LPB_SUPPLIER' | 'NOTA_PENGAMBILAN' | 'PENYESUAIAN_AWAL' | 'PENYESUAIAN_OPNAME';
  referenceNumber: string; // LPB No or NPB No or SO No
  secondaryRef?: string; // SJ No or Dept Pemohon
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  date: string;
  actor: string;
  notes?: string;
}

export type StockOpnameStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface StockOpnameItemEntry {
  itemId: string;
  sku: string;
  itemName: string;
  category: string;
  unit: string;
  location: string;
  verifiedLocation?: string; // Lokasi rak hasil verifikasi fisik saat stock opname (dapat merubah lokasi sistem)
  systemStockSnapshot: number; // Stok sistem pada saat Stock Opname dimulai (ter-lock)
  allocatedStockSnapshot: number;
  physicalStock: number | null; // null = belum dihitung/di-scan, angka = hasil hitung fisik
  variance: number; // physicalStock - systemStockSnapshot
  isCounted: boolean;
  barcodeScanned: boolean;
  lastScannedAt?: string;
  countedBy?: string;
  notes?: string;
}

export interface StockOpnameSession {
  id: string;
  opnameNumber: string; // e.g. "SO-202610-0001"
  title: string;
  status: StockOpnameStatus; // 'IN_PROGRESS' = Stok Ter-Lock!
  startedAt: string;
  startedBy: string;
  startedByUsername: string;
  startedByRole: UserRole;
  completedAt?: string;
  completedBy?: string;
  appliedAdjustment?: boolean; // Apakah selisih diterapkan ke stok sistem
  notes?: string;
  items: StockOpnameItemEntry[];
}

export type LocationTransferStatus = 'PENDING_APPROVAL' | 'PENDING_KEPALA' | 'APPROVED' | 'REJECTED';

export interface LocationTransferRequest {
  id: string;
  transferNumber: string; // e.g. "TRF-LOC-202610-0001"
  requestNumber?: string; // alias used in views
  itemId: string;
  sku: string;
  itemName: string;
  category: string;
  currentStockSnapshot: number;
  unit: string;
  fromLocation: string; // Lokasi Rak Asal
  toLocation: string; // Lokasi Rak Tujuan Baru
  reason: string;
  status: LocationTransferStatus; // 'PENDING_APPROVAL' | 'PENDING_KEPALA' -> Belum berubah sampai di-ACC Kepala Store
  requestedBy: string;
  requestedByUsername: string;
  requestedByRole: UserRole;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  approvalNotes?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

export interface AppNotification {
  id: string;
  targetUserId?: string; // If specific to a user
  targetRole?: UserRole | 'all';
  type:
    | 'voucher_approved'
    | 'voucher_rejected'
    | 'voucher_created'
    | 'lpb_created'
    | 'low_stock'
    | 'min_stock_proposal'
    | 'min_stock_verified'
    | 'min_stock_approved'
    | 'min_stock_rejected';
  title: string;
  message: string;
  voucherId?: string;
  lpbId?: string;
  proposalId?: string;
  read: boolean;
  timestamp: string;
}

export type MinStockProposalStatus = 'PENDING' | 'VERIFIED_ADMIN' | 'APPROVED' | 'REJECTED';

export interface MinStockProposal {
  id: string;
  proposalNumber: string; // e.g. "PROP-MIN-202610-0001"
  itemId: string;
  sku: string;
  itemName: string;
  unit: string;
  currentMinStock: number; // Stok minimal sebelum usulan
  proposedMinStock: number; // Usulan stok minimal baru dari pemohon
  verifiedMinStock?: number; // Usulan stok minimal hasil verifikasi Admin Gudang
  reason: string; // Alasan/justifikasi kebutuhan perubahan stok minimal
  requestedBy: string; // Nama user pemohon
  requestedByUserId: string;
  requestedByRole: UserRole;
  requestDate: string; // ISO date
  status: MinStockProposalStatus;
  verifiedByAdmin?: string; // Nama Admin Gudang yang memverifikasi (mengunci permohonan)
  verifiedAt?: string; // Waktu verifikasi Admin Gudang
  adminVerificationNotes?: string; // Catatan verifikasi Admin Gudang
  approvedByWarehouseHead?: string; // Nama Kepala Gudang yang meng-approve final (mengubah sistem)
  approvedAt?: string; // Waktu approve Kepala Gudang
  headApprovalNotes?: string; // Catatan approve Kepala Gudang
  reviewedByAdmin?: string; // Nama pejabat terakhir yang menyetujui / memverifikasi / menolak
  reviewedAt?: string;
  adminNotes?: string; // Catatan review / penolakan
}

export type MovementVelocityCategory = 'FAST_MOVING' | 'MEDIUM_MOVING' | 'LOW_MOVING';

export type ActivityLogCategory =
  | 'STOCK_ADJUSTMENT'
  | 'APPROVAL_WORKFLOW'
  | 'USER_CHANGE'
  | 'MASTER_DATA';

export interface SystemActivityLog {
  id: string;
  timestamp: string; // ISO string
  category: ActivityLogCategory;
  action: string; // Short action badge e.g. 'LPB_CREATED', 'SIV_APPROVED', 'USER_ADDED', 'MIN_STOCK_APPROVED', 'CC_GL_IMPORTED'
  title: string;
  description: string;
  actorId?: string;
  actorName: string;
  actorUsername?: string;
  actorRole: UserRole;
  actorDepartment?: string;
  referenceNumber?: string; // e.g. LPB-..., NPB-..., SKU-..., PROP-...
  metadata?: Record<string, string | number | boolean>;
}
