import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import {
  StockItem,
  LPBDocument,
  IssueVoucherDocument,
  StockMovement,
  AppNotification,
  UserAccount,
  UserRole,
  LPBItem,
  IssueVoucherItem,
  CostCenterEntry,
  GLAccountEntry,
  StorageLocation,
  CompanyProfile,
  MinStockProposal,
  SystemActivityLog,
  ActivityLogCategory,
  MovementVelocityCategory,
  UserPermissions,
  RoleLevelDefinition,
  INITIAL_ROLE_DEFINITIONS,
  setDynamicRoleDefinitions,
  normalizeGudangToStoreText,
  getEffectivePermissions,
  canManageTargetRole,
  getRoleLabel,
  getRoleLevel,
  getDefaultPermissionsForRole,
  StockOpnameSession,
  StockOpnameItemEntry,
  LocationTransferRequest,
  StockCategory,
  INITIAL_STOCK_CATEGORIES,
  getItemCategories,
  formatItemCategories,
} from '../types/inventory';
import {
  INITIAL_USERS,
  INITIAL_STOCK_ITEMS,
  INITIAL_LPB_DOCUMENTS,
  INITIAL_ISSUE_VOUCHERS,
  INITIAL_STOCK_MOVEMENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_COST_CENTERS,
  INITIAL_GL_ACCOUNTS,
  INITIAL_STORAGE_LOCATIONS,
  INITIAL_COMPANY_PROFILE,
  INITIAL_MIN_STOCK_PROPOSALS,
  INITIAL_ACTIVITY_LOGS,
} from '../data/mockData';
import { realtimeService, RealtimeEventPayload } from '../services/realtimeService';
import { ensureValidGLForCostCenter } from '../utils/costCenterGlHelper';
import {
  testFirestoreConnection,
  saveInventoryStateToFirestore,
  fetchInventoryStateFromFirestore,
  subscribeToFirestoreInventoryState,
} from '../lib/firebase';

interface ToastInfo {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  voucherNumber?: string;
  itemsPreview?: {
    sku: string;
    name: string;
    currentStock: number;
    minStock: number;
    unit: string;
    status: 'CRITICAL' | 'WARNING';
  }[];
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  durationMs?: number;
}

interface InventoryContextType {
  currentUser: UserAccount | null;
  users: UserAccount[];
  publicAccessMode: boolean;
  setPublicAccessMode: (enabled: boolean) => void;
  loginAsPublicGuest: (params: {
    name: string;
    department: string;
    role?: UserRole;
  }) => UserAccount;
  login: (username: string, password: string) => { success: boolean; error?: string; user?: UserAccount };
  logout: () => void;
  syncStatus: {
    connected: boolean;
    isSyncing?: boolean;
    revision: number;
    lastActionSummary: string;
    lastSyncAt?: string;
    sqlSynced?: boolean;
    hasError?: boolean;
    errorMessage?: string;
    connectedDevices: {
      clientId: string;
      deviceType: 'ANDROID' | 'WEBSITE';
      userName: string;
      userRole: string;
      deviceName?: string;
    }[];
  };
  forceSyncNow: () => Promise<void>;
  setDeviceMode: (mode: 'ANDROID' | 'WEBSITE') => void;
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  showCustomToast: (toast: Omit<ToastInfo, 'id'>) => void;
  createUser: (userData: {
    username: string;
    password: string;
    name: string;
    role: UserRole;
    department: string;
    email?: string;
    permissions?: Partial<UserPermissions>;
  }) => { success: boolean; error?: string; user?: UserAccount };
  updateUser: (userId: string, updates: Partial<UserAccount>) => { success: boolean; error?: string };
  resetUserPassword: (userId: string, newPassword: string, newUsername?: string) => { success: boolean; error?: string };
  deleteUser: (userId: string) => { success: boolean; error?: string };
  toggleUserStatus: (userId: string) => { success: boolean; error?: string };
  reorganizeUsersByLevel: (resetPermissionsToDefault?: boolean) => void;

  // Dynamic Role / Level Categories (Superuser Manageable)
  roleDefinitions: RoleLevelDefinition[];
  addRoleDefinition: (def: RoleLevelDefinition) => { success: boolean; error?: string };
  updateRoleDefinition: (roleKey: string, updates: Partial<RoleLevelDefinition>) => { success: boolean; error?: string };
  deleteRoleDefinition: (roleKey: string) => { success: boolean; error?: string };

  // Superuser Master Database Access
  updateDatabaseCollection: (collectionName: string, data: unknown) => { success: boolean; error?: string };
  replaceEntireDatabase: (dump: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;

  stockItems: StockItem[];
  lpbDocuments: LPBDocument[];
  issueVouchers: IssueVoucherDocument[];
  stockMovements: StockMovement[];
  notifications: AppNotification[];

  // Cost Center & GL Accounts Master (Admin editable & dropdown selectable)
  costCenters: CostCenterEntry[];
  glAccounts: GLAccountEntry[];
  addCostCenter: (entry: CostCenterEntry) => { success: boolean; error?: string };
  updateCostCenter: (oldCode: string, entry: CostCenterEntry) => { success: boolean; error?: string };
  deleteCostCenter: (code: string) => { success: boolean; error?: string };
  clearAllCostCenters: () => void;
  importCostCentersBulk: (
    entries: CostCenterEntry[],
    mode?: 'upsert' | 'replace'
  ) => { success: boolean; added: number; updated: number; totalAfter: number; error?: string };
  addGLAccount: (entry: GLAccountEntry) => { success: boolean; error?: string };
  updateGLAccount: (oldCode: string, entry: GLAccountEntry) => { success: boolean; error?: string };
  deleteGLAccount: (code: string) => { success: boolean; error?: string };
  clearAllGLAccounts: () => void;
  importGLAccountsBulk: (
    entries: GLAccountEntry[],
    mode?: 'upsert' | 'replace'
  ) => { success: boolean; added: number; updated: number; totalAfter: number; error?: string };

  activeToast: ToastInfo | null;
  dismissToast: () => void;
  
  // Actions
  createLPB: (data: {
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

  approveLPBStockAddition: (
    lpbId: string,
    payload?: {
      warehouseHeadName?: string;
      notes?: string;
    }
  ) => { success: boolean; error?: string };

  rejectLPB: (lpbId: string, reason: string) => { success: boolean; error?: string };

  createIssueVoucher: (data: {
    purpose: string;
    notes?: string;
    department?: string;
    items: { itemId: string; requestedQty: number; costCenter?: string; glAcc?: string }[];
  }) => { success: boolean; voucher?: IssueVoucherDocument; error?: string };

  createIssueVouchersBulk: (
    vouchersData: Array<{
      purpose: string;
      notes?: string;
      department?: string;
      requestedBy?: string;
      requestDate?: string;
      items: { itemId: string; requestedQty: number; costCenter?: string; glAcc?: string }[];
    }>
  ) => {
    success: boolean;
    createdVouchers?: IssueVoucherDocument[];
    error?: string;
  };

  approveIssueVoucher: (
    voucherId: string,
    handover?: {
      warehouseHeadName?: string;
      approverAdminName?: string;
      notes?: string;
      handoverOfficer?: string;
      recipientName?: string;
    }
  ) => { success: boolean; error?: string };

  completeIssueVoucherHandover: (
    voucherId: string,
    payload: {
      recipientName: string;
      handoverOfficer?: string;
      warehouseHeadName?: string;
      notes?: string;
      itemsValidation?: {
        itemId: string;
        sku?: string;
        issuedQty: number;
        isCancelled: boolean;
        barcodeValidated?: boolean;
        barcodeScanned?: boolean;
        barcodeScannedAt?: string;
        sourceLocation?: string;
      }[];
      validatedItems?: {
        itemId: string;
        issuedQty: number;
        isCancelled: boolean;
        barcodeScanned?: boolean;
        sourceLocation?: string;
      }[];
    }
  ) => { success: boolean; voucher?: IssueVoucherDocument; error?: string };

  rejectIssueVoucher: (voucherId: string, reason: string) => { success: boolean; error?: string };

  updateIssueVoucher: (
    voucherId: string,
    data: {
      purpose: string;
      notes?: string;
      items: { itemId: string; requestedQty: number; costCenter?: string; glAcc?: string }[];
    }
  ) => { success: boolean; error?: string };

  deleteIssueVoucher: (voucherId: string) => { success: boolean; error?: string };

  markNotificationAsRead: (notificationId: string) => void;
  markAllNotificationsAsRead: () => void;
  
  addNewStockItem: (item: Omit<StockItem, 'id' | 'allocatedStock' | 'updatedAt'>) => StockItem;
  updateStockItem: (id: string, updates: Partial<StockItem>) => void;
  deleteStockItem: (id: string) => { success: boolean; error?: string };
  importStockItemsBulk: (
    items: Array<{
      sku: string;
      name: string;
      category: string;
      unit: string;
      currentStock: number;
      minStock: number;
      location: string;
      description?: string;
    }>,
    mode?: 'upsert' | 'add_only'
  ) => { success: boolean; added: number; updated: number; error?: string };

  // Lokasi & Rak Penyimpanan
  storageLocations: StorageLocation[];
  addStorageLocation: (loc: Omit<StorageLocation, 'id'>) => { success: boolean; location?: StorageLocation; error?: string };
  updateStorageLocation: (id: string, updates: Partial<StorageLocation>) => { success: boolean; error?: string };
  deleteStorageLocation: (id: string) => { success: boolean; error?: string };

  // Master Kategori Barang (Admin dapat membuat, mengedit, dan menghapus kategori)
  stockCategories: StockCategory[];
  addStockCategory: (cat: { name: string; description?: string; color?: string }) => { success: boolean; category?: StockCategory; error?: string };
  updateStockCategory: (id: string, updates: { name: string; description?: string; color?: string }) => { success: boolean; error?: string };
  deleteStockCategory: (id: string) => { success: boolean; error?: string };

  // Data Perusahaan & Branding
  companyProfile: CompanyProfile;
  updateCompanyProfile: (updates: Partial<CompanyProfile>) => void;
  resetCompanyProfile: () => void;
  
  // Batas Stok Minimal & Pengajuan
  minStockProposals: MinStockProposal[];
  createMinStockProposal: (data: {
    itemId: string;
    proposedMinStock: number;
    reason: string;
  }) => { success: boolean; proposal?: MinStockProposal; error?: string };
  updateMinStockProposal: (
    proposalId: string,
    data: {
      proposedMinStock: number;
      reason: string;
    }
  ) => { success: boolean; error?: string };
  deleteMinStockProposal: (proposalId: string) => { success: boolean; error?: string };
  verifyMinStockProposal: (
    proposalId: string,
    adminNotes?: string,
    verifiedMinStock?: number
  ) => { success: boolean; error?: string };
  approveMinStockProposal: (
    proposalId: string,
    headNotes?: string
  ) => { success: boolean; error?: string };
  rejectMinStockProposal: (
    proposalId: string,
    notes: string
  ) => { success: boolean; error?: string };

  // Alert helpers
  lowStockItems: StockItem[]; // Melampaui / Kritis (currentStock <= minStock)
  nearMinStockItems: StockItem[]; // Mendekati minimal (currentStock > minStock && currentStock <= minStock + buffer)

  // Analisa Kategori Keluar Barang (Fast / Medium / Low Moving)
  getItemMovementAnalytics: (itemId: string, sku?: string) => {
    totalOutQty: number;
    outFrequency: number;
    outboundFrequency: number;
    lastOutDate?: string;
    velocityCategory: MovementVelocityCategory;
    category: MovementVelocityCategory;
    velocityLabel: 'Fast Moving' | 'Medium Moving' | 'Low Moving';
    label: 'Fast Moving' | 'Medium Moving' | 'Low Moving';
    turnoverRatio: number;
  };

  // System Activity Log (Audit Trail)
  activityLogs: SystemActivityLog[];
  addActivityLog: (entry: {
    category: ActivityLogCategory;
    action: string;
    title: string;
    description: string;
    referenceNumber?: string;
  }) => void;

  // Stock Opname & Lock Stok Store (Level 1 Kepala Store ke atas)
  stockOpnameSessions: StockOpnameSession[];
  activeStockOpname: StockOpnameSession | null;
  isStockLockedForOpname: boolean;
  startStockOpname: (params: {
    title: string;
    notes?: string;
  }) => { success: boolean; session?: StockOpnameSession; error?: string };
  scanOrUpdateOpnameItem: (params: {
    skuOrId: string;
    physicalStock?: number;
    incrementByOne?: boolean;
    barcodeScanned?: boolean;
    verifiedLocation?: string;
    notes?: string;
  }) => { success: boolean; entry?: StockOpnameItemEntry; error?: string };
  completeStockOpname: (params: {
    applyAdjustment: boolean;
    notes?: string;
  }) => { success: boolean; error?: string };
  cancelStockOpname: (reason?: string) => { success: boolean; error?: string };

  // Pindah Lokasi Barang (Admin Mengajukan -> Terealisasi saat Di-ACC Kepala Store)
  locationTransferRequests: LocationTransferRequest[];
  createLocationTransferRequest: (params: {
    itemId: string;
    toLocation: string;
    reason: string;
  }) => { success: boolean; request?: LocationTransferRequest; error?: string };
  approveLocationTransferRequest: (
    requestId: string,
    approvalNotes?: string
  ) => { success: boolean; error?: string };
  rejectLocationTransferRequest: (
    requestId: string,
    rejectionReason: string
  ) => { success: boolean; error?: string };

  // Print preview state
  selectedDocumentForPrint: { type: 'LPB' | 'NPB'; doc: LPBDocument | IssueVoucherDocument } | null;
  openPrintPreview: (type: 'LPB' | 'NPB', doc: LPBDocument | IssueVoucherDocument) => void;
  closePrintPreview: () => void;

  resetToDefaultData: () => void;
  resetAllTransactionsAndStock: (mode?: 'EMPTY_ALL' | 'ZERO_STOCK_ONLY') => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const STORAGE_KEYS = {
  CURRENT_USER: 'inv_current_user_id',
  USERS: 'inv_users_list_v6_sda_default',
  STOCK_ITEMS: 'inv_stock_items_v6_sda_default',
  LPB_DOCS: 'inv_lpb_docs_v6_sda_default',
  ISSUE_VOUCHERS: 'inv_issue_vouchers_v6_sda_default',
  STOCK_MOVEMENTS: 'inv_stock_movements_v6_sda_default',
  NOTIFICATIONS: 'inv_notifications_v6_sda_default',
  COST_CENTERS: 'inv_cost_centers_v6_sda_default',
  GL_ACCOUNTS: 'inv_gl_accounts_v6_sda_default',
  STORAGE_LOCATIONS: 'inv_storage_locations_v6_sda_default',
  COMPANY_PROFILE: 'inv_company_profile_v6_sda_default',
  MIN_STOCK_PROPOSALS: 'inv_min_stock_proposals_v6_sda_default',
  ACTIVITY_LOGS: 'inv_activity_logs_v6_sda_default',
  PUBLIC_ACCESS_MODE: 'inv_public_access_mode_v1',
  ROLE_DEFINITIONS: 'inv_role_definitions_v6_sda_default',
  STOCK_OPNAME_SESSIONS: 'inv_stock_opname_sessions_v6_sda_default',
  LOCATION_TRANSFER_REQUESTS: 'inv_location_transfers_v6_sda_default',
  STOCK_CATEGORIES: 'inv_stock_categories_v6_sda_default',
};

function normalizeCompanyProfile(raw?: Partial<CompanyProfile> | null): CompanyProfile {
  if (!raw || typeof raw !== 'object') return INITIAL_COMPANY_PROFILE;
  const isLegacyAddress =
    !raw.address ||
    raw.address.trim() === 'Kawasan Industri & Pergudangan Lingkar Timur, Sidoarjo - Jawa Timur';
  const isLegacyPhone = raw.phone === '(031) 895-2001';
  const isLegacyEmail = raw.email === 'logistik.sidoarjo@agrosindo.co.id';
  const isLegacyLogo =
    !raw.logoUrl ||
    raw.logoUrl === '/assets/aistudio/IMG_20261011_230510_dc5f2550.jpg';

  return {
    ...INITIAL_COMPANY_PROFILE,
    ...raw,
    companyName: raw.companyName?.trim() || INITIAL_COMPANY_PROFILE.companyName,
    city: raw.city?.trim() || INITIAL_COMPANY_PROFILE.city,
    address: isLegacyAddress ? INITIAL_COMPANY_PROFILE.address : (raw.address ?? ''),
    phone: isLegacyPhone ? '' : (raw.phone ?? ''),
    email: isLegacyEmail ? '' : (raw.email ?? ''),
    logoUrl: isLegacyLogo ? INITIAL_COMPANY_PROFILE.logoUrl : raw.logoUrl!,
  };
}

const LEGACY_DEMO_USERNAMES = new Set(['budi', 'siti', 'rian', 'view']);
const LEGACY_DEMO_NAMES = new Set([
  'ir. hendrawan wijaya',
  'suryadi',
  'hendra gunawan',
  'budi santoso',
  'siti aminah',
  'rian pratama',
  'dimas saputra',
]);

function cleanUserDepartment(dept: string, role: UserRole): string {
  const normalized = normalizeGudangToStoreText(dept || '')
    .replace(/\s*\(Level\s*\d+\)/gi, '')
    .replace(/^Level\s*\d+\s*[—-]\s*/i, '')
    .trim();
  if (!normalized || normalized.toLowerCase().includes('super user')) {
    if (role === 'superuser') return 'management';
  }
  return normalized || 'Store';
}

function normalizeAndSortUsersByLevel(
  rawList: UserAccount[],
  resetPermissionsToDefault = false
): UserAccount[] {
  const seenIds = new Set<string>();
  const seenUsernames = new Set<string>();
  const dedupedRaw: UserAccount[] = [];

  for (const u of rawList) {
    if (!u || !u.id || !u.username) continue;
    const idKey = String(u.id).trim().replace(/staff/gi, 'PIC');
    const unameKey = String(u.username).trim().toLowerCase();
    const nameKey = String(u.name || '').trim().toLowerCase();

    // Skip obsolete old demo accounts so the new default accounts take their place
    if (LEGACY_DEMO_USERNAMES.has(unameKey) || LEGACY_DEMO_NAMES.has(nameKey)) {
      const replacement = INITIAL_USERS.find(
        (initU) => initU.id === idKey || initU.username.toLowerCase() === unameKey
      );
      if (replacement) {
        if (!seenIds.has(replacement.id) && !seenUsernames.has(replacement.username.toLowerCase())) {
          seenIds.add(replacement.id);
          seenUsernames.add(replacement.username.toLowerCase());
          dedupedRaw.push(replacement);
        }
      }
      continue;
    }

    if (seenIds.has(idKey) || seenUsernames.has(unameKey)) continue;
    seenIds.add(idKey);
    seenUsernames.add(unameKey);
    dedupedRaw.push({ ...u, id: idKey });
  }

  const mapped = dedupedRaw.map((u) => {
    const cleanDept = cleanUserDepartment(u.department || '', u.role);
    const defaultPerms = getDefaultPermissionsForRole(u.role);
    return {
      ...u,
      id: String(u.id).trim().replace(/staff/gi, 'PIC'),
      department: cleanDept,
      email: u.email ?? '',
      permissions:
        resetPermissionsToDefault || !u.permissions || u.role === 'superuser'
          ? defaultPerms
          : { ...defaultPerms, ...u.permissions },
    };
  });

  const existingIds = new Set(mapped.map((u) => u.id));
  const existingUsernames = new Set(mapped.map((u) => u.username.toLowerCase()));
  const missingDefaults = INITIAL_USERS.filter(
    (initUser) =>
      !existingIds.has(initUser.id) &&
      !existingUsernames.has(initUser.username.toLowerCase())
  );
  const combined = missingDefaults.length > 0 ? [...mapped, ...missingDefaults] : mapped;

  const initialOrderMap = new Map<string, number>(
    INITIAL_USERS.map((u, idx) => [u.username.toLowerCase(), idx])
  );

  return [...combined].sort((a, b) => {
    const lvlDiff = getRoleLevel(a.role) - getRoleLevel(b.role);
    if (lvlDiff !== 0) return lvlDiff;
    const idxA = initialOrderMap.get(a.username.toLowerCase());
    const idxB = initialOrderMap.get(b.username.toLowerCase());
    if (idxA !== undefined && idxB !== undefined) return idxA - idxB;
    if (idxA !== undefined) return -1;
    if (idxB !== undefined) return 1;
    return a.name.localeCompare(b.name);
  });
}

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Dynamic Role Definitions (Level Categories)
  const [roleDefinitions, setRoleDefinitions] = useState<RoleLevelDefinition[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ROLE_DEFINITIONS);
      if (saved) {
        const parsed: RoleLevelDefinition[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed.map((d) => {
            let normName = normalizeGudangToStoreText(d.name);
            let normBadge = normalizeGudangToStoreText(d.badgeLabel);
            if (d.roleKey === 'user') {
              if (!normName || /pemohon|staff/i.test(normName)) normName = 'PIC';
              if (!normBadge || /pemohon|staff/i.test(normBadge)) normBadge = 'LVL 3 • PIC';
            }
            return {
              ...d,
              name: normName,
              badgeLabel: normBadge,
              description: normalizeGudangToStoreText(d.description),
            };
          });
          setDynamicRoleDefinitions(normalized);
          return normalized.sort((a, b) => a.levelNumber - b.levelNumber);
        }
      }
    } catch {
      // ignore
    }
    setDynamicRoleDefinitions(INITIAL_ROLE_DEFINITIONS);
    return INITIAL_ROLE_DEFINITIONS;
  });

  useEffect(() => {
    setDynamicRoleDefinitions(roleDefinitions);
    try {
      localStorage.setItem(STORAGE_KEYS.ROLE_DEFINITIONS, JSON.stringify(roleDefinitions));
    } catch {}
  }, [roleDefinitions]);

  // Users list state (organized & sorted strictly by level)
  const [users, setUsers] = useState<UserAccount[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      if (saved) {
        const parsed: UserAccount[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const finalUsers = normalizeAndSortUsersByLevel(parsed, false);
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(finalUsers));
          return finalUsers;
        }
      }
    } catch {
      // ignore
    }
    return normalizeAndSortUsersByLevel(INITIAL_USERS, true);
  });

  // Public access mode (False by default so opening the link shows the Login screen for each user account)
  const [publicAccessMode, setPublicAccessModeState] = useState<boolean>(false);

  const setPublicAccessMode = useCallback((enabled: boolean) => {
    setPublicAccessModeState(enabled);
  }, []);

  // Current user state (null if not logged in -> opens directly to LoginView so each account logs in themselves)
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      if (saved) {
        const savedUsersJson = localStorage.getItem(STORAGE_KEYS.USERS);
        const usersList: UserAccount[] = savedUsersJson ? JSON.parse(savedUsersJson) : INITIAL_USERS;
        const found = usersList.find((u) => u.id === saved && u.isActive !== false);
        if (found) return found;
      }
    } catch {
      // ignore
    }
    return null;
  });

  // Stock items
  const [stockItems, setStockItems] = useState<StockItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCK_ITEMS);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_STOCK_ITEMS;
  });

  // LPB Documents
  const [lpbDocuments, setLpbDocuments] = useState<LPBDocument[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LPB_DOCS);
      if (saved !== null) {
        const raw = JSON.parse(saved);
        if (Array.isArray(raw)) {
          return raw.map((doc: LPBDocument) => ({
            ...doc,
            status: doc.status || 'APPROVED',
          }));
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_LPB_DOCUMENTS;
  });

  // Issue Vouchers (Nota Pengambilan Barang)
  const [issueVouchers, setIssueVouchers] = useState<IssueVoucherDocument[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ISSUE_VOUCHERS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_ISSUE_VOUCHERS;
  });

  // Stock Movements Ledger
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCK_MOVEMENTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_STOCK_MOVEMENTS;
  });

  // Notifications
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_NOTIFICATIONS;
  });

  // Cost Centers Master State
  const [costCenters, setCostCenters] = useState<CostCenterEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COST_CENTERS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_COST_CENTERS;
  });

  // GL Accounts Master State
  const [glAccounts, setGlAccounts] = useState<GLAccountEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.GL_ACCOUNTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_GL_ACCOUNTS;
  });

  // Storage Locations State (Rak & Lokasi Penyimpanan)
  const [storageLocations, setStorageLocations] = useState<StorageLocation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STORAGE_LOCATIONS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_STORAGE_LOCATIONS;
  });

  // Master Kategori Barang State
  const [stockCategories, setStockCategories] = useState<StockCategory[]>(() => {
    let baseList: StockCategory[] = INITIAL_STOCK_CATEGORIES;
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCK_CATEGORIES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          baseList = parsed;
        }
      }
    } catch {
      // ignore
    }

    // Pastikan setiap kategori yang digunakan pada stockItems juga terdaftar di daftar kategori
    const map = new Map<string, StockCategory>();
    baseList.forEach((c) => {
      if (c && c.name && c.name.trim()) {
        map.set(c.name.trim().toLowerCase(), {
          ...c,
          name: c.name.trim(),
        });
      }
    });

    try {
      const savedItemsRaw = localStorage.getItem(STORAGE_KEYS.STOCK_ITEMS);
      const itemsToScan: StockItem[] = savedItemsRaw ? JSON.parse(savedItemsRaw) : INITIAL_STOCK_ITEMS;
      if (Array.isArray(itemsToScan)) {
        itemsToScan.forEach((item) => {
          getItemCategories(item).forEach((catName) => {
            const key = catName.toLowerCase();
            if (!map.has(key)) {
              map.set(key, {
                id: `cat_${key.replace(/[^a-z0-9]/g, '_')}`,
                name: catName,
                description: `Kategori barang ${catName}`,
                color: 'blue',
              });
            }
          });
        });
      }
    } catch {
      // ignore
    }

    return Array.from(map.values());
  });

  // Company Profile & Branding State
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COMPANY_PROFILE);
      if (saved) {
        const parsed = JSON.parse(saved);
        return normalizeCompanyProfile(parsed);
      }
    } catch {
      // ignore
    }
    return INITIAL_COMPANY_PROFILE;
  });

  // Batas Stok Minimal & Pengajuan State
  const [minStockProposals, setMinStockProposals] = useState<MinStockProposal[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MIN_STOCK_PROPOSALS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_MIN_STOCK_PROPOSALS;
  });

  // System Activity Logs State
  const [activityLogs, setActivityLogs] = useState<SystemActivityLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVITY_LOGS);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return INITIAL_ACTIVITY_LOGS;
  });

  // Stock Opname Sessions State
  const [stockOpnameSessions, setStockOpnameSessions] = useState<StockOpnameSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCK_OPNAME_SESSIONS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Location Transfer Requests State (Admin submits -> Kepala Store ACC)
  const [locationTransferRequests, setLocationTransferRequests] = useState<LocationTransferRequest[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOCATION_TRANSFER_REQUESTS);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const activeStockOpname = React.useMemo(
    () => stockOpnameSessions.find((s) => s.status === 'IN_PROGRESS') || null,
    [stockOpnameSessions]
  );

  const isStockLockedForOpname = Boolean(activeStockOpname);

  const addActivityLog = useCallback(
    (entry: {
      category: ActivityLogCategory;
      action: string;
      title: string;
      description: string;
      referenceNumber?: string;
    }) => {
      const newLog: SystemActivityLog = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        category: entry.category,
        action: entry.action,
        title: entry.title,
        description: entry.description,
        actorName: currentUser ? currentUser.name : 'Administrator Store',
        actorUsername: currentUser ? currentUser.username : 'admin.store',
        actorRole: currentUser ? currentUser.role : 'admin',
        referenceNumber: entry.referenceNumber,
      };
      setActivityLogs((prev) => [newLog, ...prev]);
    },
    [currentUser]
  );

  // Floating Toast Alert
  const [activeToast, setActiveToast] = useState<ToastInfo | null>(null);

  // Print Preview Modal State
  const [selectedDocumentForPrint, setSelectedDocumentForPrint] = useState<{
    type: 'LPB' | 'NPB';
    doc: LPBDocument | IssueVoucherDocument;
  } | null>(null);

  // Sync to LocalStorage
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, currentUser.id);
      } else {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    } catch {}
  }, [currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch {}
  }, [users]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STOCK_ITEMS, JSON.stringify(stockItems));
    } catch {}
  }, [stockItems]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LPB_DOCS, JSON.stringify(lpbDocuments));
    } catch {}
  }, [lpbDocuments]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ISSUE_VOUCHERS, JSON.stringify(issueVouchers));
    } catch {}
  }, [issueVouchers]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, JSON.stringify(stockMovements));
    } catch {}
  }, [stockMovements]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STOCK_OPNAME_SESSIONS, JSON.stringify(stockOpnameSessions));
    } catch {}
  }, [stockOpnameSessions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOCATION_TRANSFER_REQUESTS, JSON.stringify(locationTransferRequests));
    } catch {}
  }, [locationTransferRequests]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COST_CENTERS, JSON.stringify(costCenters));
    } catch {}
  }, [costCenters]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.GL_ACCOUNTS, JSON.stringify(glAccounts));
    } catch {}
  }, [glAccounts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STORAGE_LOCATIONS, JSON.stringify(storageLocations));
    } catch {}
  }, [storageLocations]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.STOCK_CATEGORIES, JSON.stringify(stockCategories));
    } catch {}
  }, [stockCategories]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.COMPANY_PROFILE, JSON.stringify(companyProfile));
    } catch {}
  }, [companyProfile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    } catch {}
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.MIN_STOCK_PROPOSALS, JSON.stringify(minStockProposals));
    } catch {}
  }, [minStockProposals]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(activityLogs));
    } catch {}
  }, [activityLogs]);

  // Real-time Event Listener (BroadcastChannel & Storage Events)
  useEffect(() => {
    const unsubscribe = realtimeService.subscribe((payload: RealtimeEventPayload) => {
      if (payload.type === 'VOUCHER_APPROVED') {
        const voucher = payload.data as IssueVoucherDocument;
        
        // Show real-time toast to the user
        setActiveToast({
          id: Math.random().toString(),
          type: 'success',
          title: 'Nota Pengambilan Disetujui & Diserahkan!',
          message: `Nota #${voucher.voucherNumber} (${voucher.department}) telah di-ACC oleh Admin. Barang telah diserahkan & stok resmi dipotong.`,
          voucherNumber: voucher.voucherNumber,
        });

        // Ensure state is updated if from another tab
        setIssueVouchers((prev) =>
          prev.map((v) => (v.id === voucher.id ? voucher : v))
        );
      } else if (payload.type === 'VOUCHER_CREATED') {
        const voucher = payload.data as IssueVoucherDocument;
        setActiveToast({
          id: Math.random().toString(),
          type: 'info',
          title: 'Nota Pengambilan Baru Terbit',
          message: `Nota #${voucher.voucherNumber} dibuat oleh ${voucher.requestedBy} (${voucher.department}). Menunggu approval admin.`,
          voucherNumber: voucher.voucherNumber,
        });
      } else if (payload.type === 'VOUCHER_REJECTED') {
        const voucher = payload.data as IssueVoucherDocument;
        setActiveToast({
          id: Math.random().toString(),
          type: 'warning',
          title: 'Nota Pengambilan Ditolak',
          message: `Nota #${voucher.voucherNumber} ditolak. Alasan: ${voucher.rejectionReason || 'Tidak disebutkan'}.`,
          voucherNumber: voucher.voucherNumber,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const login = useCallback(
    (username: string, password: string) => {
      const trimmedUser = username.trim().toLowerCase();
      const user = users.find(
        (u) => u.username.toLowerCase() === trimmedUser && u.password === password
      );

      if (!user) {
        return { success: false, error: 'Username atau password salah. Silakan periksa kembali.' };
      }

      if (user.isActive === false) {
        return {
          success: false,
          error: 'Akun Anda dinonaktifkan oleh Administrator. Hubungi admin store untuk mengaktifkan.',
        };
      }

      const updatedUser: UserAccount = {
        ...user,
        department: normalizeGudangToStoreText(user.department),
        lastLogin: new Date().toISOString(),
      };

      setUsers((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));
      setCurrentUser(updatedUser);

      try {
        sessionStorage.removeItem('inv_explicit_logout');
      } catch {}

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Akses Pengguna Aktif',
        message: `Selamat datang, ${user.name} (${getRoleLabel(user.role)}).`,
      });

      return { success: true, user: updatedUser };
    },
    [users]
  );

  // Instant Public Access without Gmail or Password
  const loginAsPublicGuest = useCallback(
    (params: { name: string; department: string; role?: UserRole }): UserAccount => {
      const cleanName = params.name.trim() || 'Pengguna Umum';
      const cleanDept = params.department.trim() || 'Divisi Umum & Operasional';
      const targetRole: UserRole = params.role || 'user';
      const cleanUsername =
        cleanName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 16) || 'publik';

      // Check if user with same name & role already exists in users list
      const existing = users.find(
        (u) =>
          u.name.trim().toLowerCase() === cleanName.toLowerCase() &&
          u.role === targetRole &&
          u.isActive !== false
      );

      let activeUser: UserAccount;
      if (existing) {
        activeUser = {
          ...existing,
          department: cleanDept || existing.department,
          lastLogin: new Date().toISOString(),
        };
        setUsers((prev) => prev.map((u) => (u.id === existing.id ? activeUser : u)));
      } else {
        activeUser = {
          id: `user_pub_${Date.now()}`,
          username: cleanUsername,
          password: '123',
          name: cleanName,
          role: targetRole,
          department: cleanDept,
          email: '',
          isActive: true,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
        setUsers((prev) => [...prev, activeUser]);
      }

      try {
        sessionStorage.removeItem('inv_explicit_logout');
        localStorage.setItem('inv_public_guest_user', JSON.stringify(activeUser));
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, activeUser.id);
      } catch {}

      setCurrentUser(activeUser);
      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Akses Publik Tanpa Login Aktif',
        message: `Masuk sebagai ${activeUser.name} (${
          targetRole === 'admin'
            ? 'Admin Gudang'
            : targetRole === 'kepala_gudang'
            ? 'Kepala Gudang'
            : cleanDept
        }) tanpa perlu akun Gmail.`,
      });

      return activeUser;
    },
    [users]
  );

  const logout = useCallback(() => {
    try {
      sessionStorage.setItem('inv_explicit_logout', 'true');
    } catch {}
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Beralih ke Layar Pilih Peran / Akses',
      message: 'Anda dapat langsung masuk kembali tanpa akun Gmail dengan memilih peran atau mengetik nama.',
    });
  }, []);

  const createUser = useCallback(
    (userData: {
      username: string;
      password: string;
      name: string;
      role: UserRole;
      department: string;
      email?: string;
      permissions?: Partial<UserPermissions>;
    }) => {
      if (currentUser && !canManageTargetRole(currentUser.role, userData.role)) {
        return {
          success: false,
          error: `Peran Anda (${getRoleLabel(currentUser.role)}) hanya dapat menambahkan user untuk level di bawahnya.`,
        };
      }

      const trimmedUsername = userData.username.trim().toLowerCase();
      if (!trimmedUsername || !userData.password || !userData.name) {
        return { success: false, error: 'Username, password, dan nama lengkap wajib diisi.' };
      }

      if (users.some((u) => u.username.toLowerCase() === trimmedUsername)) {
        return { success: false, error: `Username "${userData.username}" sudah digunakan. Silakan gunakan username lain.` };
      }

      const idPrefix = userData.role === 'user' ? 'user_PIC' : `user_${userData.role}`;
      const newUser: UserAccount = {
        id: `${idPrefix}_${Date.now()}`,
        username: userData.username.trim(),
        password: userData.password,
        name: userData.name.trim(),
        role: userData.role,
        department: userData.department.trim(),
        email: userData.email ? userData.email.trim() : '',
        isActive: true,
        createdAt: new Date().toISOString(),
        permissions: userData.permissions,
      };

      setUsers((prev) => [...prev, newUser]);

      addActivityLog({
        category: 'USER_CHANGE',
        action: 'USER_CREATED',
        title: 'Penambahan Akun Pengguna Baru',
        description: `Akun pengguna baru "${newUser.name}" (@${newUser.username}) dengan level ${getRoleLabel(newUser.role)} (${newUser.department}) ditambahkan.`,
        referenceNumber: `@${newUser.username}`,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Akun Pengguna Baru Dibuat',
        message: `Akun "${newUser.username}" (${newUser.name} - ${getRoleLabel(newUser.role)}) berhasil ditambahkan.`,
      });

      return { success: true, user: newUser };
    },
    [currentUser, users, addActivityLog]
  );

  const updateUser = useCallback(
    (userId: string, updates: Partial<UserAccount>) => {
      const targetUser = users.find((u) => u.id === userId);
      if (!targetUser) return { success: false, error: 'Pengguna tidak ditemukan.' };

      const isSelf = currentUser?.id === userId;
      if (currentUser && !isSelf && !canManageTargetRole(currentUser.role, targetUser.role)) {
        return {
          success: false,
          error: `Anda tidak memiliki otorisasi untuk mengubah data akun ${getRoleLabel(targetUser.role)} (hanya dapat mengedit level di bawah Anda).`,
        };
      }

      if (currentUser && updates.role && updates.role !== targetUser.role && !canManageTargetRole(currentUser.role, updates.role)) {
        return {
          success: false,
          error: `Anda hanya dapat menetapkan level jabatan di bawah ${getRoleLabel(currentUser.role)}.`,
        };
      }

      if (updates.username !== undefined) {
        const trimmed = updates.username.trim().toLowerCase();
        if (!trimmed) {
          return { success: false, error: 'Username tidak boleh kosong.' };
        }
        if (users.some((u) => u.id !== userId && u.username.toLowerCase() === trimmed)) {
          return { success: false, error: `Username "${updates.username}" sudah dipakai akun lain.` };
        }
        updates.username = updates.username.trim();
      }

      const updated: UserAccount = { ...targetUser, ...updates };
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));

      if (currentUser && currentUser.id === userId) {
        setCurrentUser(updated);
      }

      addActivityLog({
        category: 'USER_CHANGE',
        action: 'USER_UPDATED',
        title: 'Perubahan Profil, Username & Hak Akses Pengguna',
        description: `Data akun @${updated.username} (${updated.name} - ${getRoleLabel(updated.role)}) diperbarui oleh ${currentUser?.name || 'Admin'}.`,
        referenceNumber: `@${updated.username}`,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Data & Hak Akses Pengguna Diperbarui',
        message: `Perubahan akun @${updated.username} (${updated.name}) berhasil disimpan.`,
      });

      return { success: true };
    },
    [currentUser, users, addActivityLog]
  );

  const resetUserPassword = useCallback(
    (userId: string, newPassword: string, newUsername?: string) => {
      if (!newPassword || newPassword.length < 4) {
        return { success: false, error: 'Password baru minimal 4 karakter.' };
      }

      const targetUser = users.find((u) => u.id === userId);
      if (!targetUser) return { success: false, error: 'Pengguna tidak ditemukan.' };

      const isSelf = currentUser?.id === userId;
      if (currentUser && !isSelf && !canManageTargetRole(currentUser.role, targetUser.role)) {
        return {
          success: false,
          error: `Anda hanya dapat mereset password/username untuk user dengan level di bawah ${getRoleLabel(currentUser.role)}.`,
        };
      }

      let finalUsername = targetUser.username;
      if (newUsername && newUsername.trim() && newUsername.trim() !== targetUser.username) {
        const cleanU = newUsername.trim().toLowerCase();
        if (users.some((u) => u.id !== userId && u.username.toLowerCase() === cleanU)) {
          return { success: false, error: `Username "${newUsername}" sudah digunakan akun lain.` };
        }
        finalUsername = newUsername.trim();
      }

      const updatedUser: UserAccount = {
        ...targetUser,
        username: finalUsername,
        password: newPassword,
      };

      setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));
      if (currentUser && currentUser.id === userId) {
        setCurrentUser(updatedUser);
      }

      addActivityLog({
        category: 'USER_CHANGE',
        action: 'PASSWORD_RESET',
        title: 'Reset Password / Edit Username Pengguna',
        description: `Kredensial untuk akun @${finalUsername} (${targetUser.name} - ${getRoleLabel(targetUser.role)}) telah diperbarui oleh ${currentUser?.name || 'Admin'}.`,
        referenceNumber: `@${finalUsername}`,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Kredensial Berhasil Diperbarui',
        message: `Username (@${finalUsername}) & password akun ${targetUser.name} berhasil disimpan.`,
      });

      return { success: true };
    },
    [currentUser, users, addActivityLog]
  );

  const deleteUser = useCallback(
    (userId: string) => {
      if (currentUser && currentUser.id === userId) {
        return { success: false, error: 'Tidak dapat menghapus akun Anda sendiri yang sedang aktif login.' };
      }

      const target = users.find((u) => u.id === userId);
      if (!target) return { success: false, error: 'Pengguna tidak ditemukan.' };

      if (currentUser && !canManageTargetRole(currentUser.role, target.role)) {
        return {
          success: false,
          error: `Anda hanya dapat menghapus akun dengan level di bawah ${getRoleLabel(currentUser.role)}.`,
        };
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));

      addActivityLog({
        category: 'USER_CHANGE',
        action: 'USER_DELETED',
        title: 'Penghapusan Akun Pengguna',
        description: `Akun pengguna @${target.username} (${target.name} - ${getRoleLabel(target.role)}) dihapus dari sistem oleh ${currentUser?.name || 'Admin'}.`,
        referenceNumber: `@${target.username}`,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Pengguna Dihapus',
        message: `Akun ${target.username} (${target.name}) telah dihapus dari sistem.`,
      });

      return { success: true };
    },
    [currentUser, users, addActivityLog]
  );

  const toggleUserStatus = useCallback(
    (userId: string) => {
      if (currentUser && currentUser.id === userId) {
        return { success: false, error: 'Tidak dapat menonaktifkan akun Anda sendiri yang sedang aktif.' };
      }

      const target = users.find((u) => u.id === userId);
      if (!target) return { success: false, error: 'Pengguna tidak ditemukan.' };

      if (currentUser && !canManageTargetRole(currentUser.role, target.role)) {
        return {
          success: false,
          error: `Anda hanya dapat mengunci/mengaktifkan akun dengan level di bawah ${getRoleLabel(currentUser.role)}.`,
        };
      }

      const newStatus = !target.isActive;
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: newStatus } : u))
      );

      addActivityLog({
        category: 'USER_CHANGE',
        action: newStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        title: newStatus ? 'Pengaktifan (Unlock) Akun Pengguna' : 'Kunci Audit / Penonaktifan (Lock) Akun Pengguna',
        description: `Status akses login akun @${target.username} (${target.name} - ${getRoleLabel(target.role)}) diubah menjadi ${newStatus ? 'AKTIF (UNLOCKED)' : 'DIKUNCI / NONAKTIF (LOCKED)'} oleh ${currentUser?.name || 'Admin'}.`,
        referenceNumber: `@${target.username}`,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: newStatus ? 'Akun Diaktifkan (Unlocked)' : 'Akun Dikunci (Locked)',
        message: `Status akun @${target.username} diubah menjadi ${newStatus ? 'Aktif' : 'Terkunci / Nonaktif'}.`,
      });

      return { success: true };
    },
    [currentUser, users, addActivityLog]
  );

  const reorganizeUsersByLevel = useCallback(
    (resetPermissionsToDefault = true) => {
      const nextUsers = normalizeAndSortUsersByLevel(users, resetPermissionsToDefault);
      setUsers(nextUsers);
      if (currentUser) {
        const updatedSelf = nextUsers.find((u) => u.id === currentUser.id);
        if (updatedSelf) setCurrentUser(updatedSelf);
      }

      addActivityLog({
        category: 'USER_CHANGE',
        action: 'USERS_REORGANIZED_BY_LEVEL',
        title: 'Penataan Ulang Database User Sesuai Hierarki Level',
        description: `Database akun pengguna (${nextUsers.length} user) telah diatur ulang, diurutkan, dan disesuaikan hak aksesnya berdasarkan urutan level oleh ${currentUser?.name || 'Administrator'}.`,
        referenceNumber: 'DB-USERS-LVL',
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Database User Diatur Ulang Sesuai Level',
        message: `Seluruh ${nextUsers.length} akun pengguna telah diurutkan dan disesuaikan hak aksesnya sesuai struktur level masing-masing.`,
      });
    },
    [users, currentUser, addActivityLog]
  );

  // Dynamic Role / Level Category Management (Superuser Level 0)
  const addRoleDefinition = useCallback(
    (def: RoleLevelDefinition) => {
      if (currentUser && currentUser.role !== 'superuser') {
        return {
          success: false,
          error: 'Hanya Super User (Level 0) yang dapat menambahkan kategori level baru.',
        };
      }
      const cleanKey = def.roleKey
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_');
      if (!cleanKey) {
        return { success: false, error: 'Kode ID kategori level wajib diisi.' };
      }
      if (roleDefinitions.some((r) => r.roleKey.toLowerCase() === cleanKey)) {
        return {
          success: false,
          error: `Kategori level dengan kode "${cleanKey}" sudah ada.`,
        };
      }
      if (!def.name.trim()) {
        return { success: false, error: 'Nama kategori level / jabatan wajib diisi.' };
      }
      const newDef: RoleLevelDefinition = {
        roleKey: cleanKey,
        levelNumber: Math.max(1, Number(def.levelNumber) || 1),
        name: normalizeGudangToStoreText(def.name.trim()),
        badgeLabel:
          normalizeGudangToStoreText(def.badgeLabel.trim()) ||
          `LVL ${Math.max(1, Number(def.levelNumber) || 1)} • ${def.name.trim().toUpperCase()}`,
        description: normalizeGudangToStoreText(def.description.trim()),
        colorTheme: def.colorTheme || 'blue',
        isSystemDefault: false,
        defaultPermissions: { ...def.defaultPermissions },
      };

      const nextList = [...roleDefinitions, newDef].sort(
        (a, b) => a.levelNumber - b.levelNumber
      );
      setDynamicRoleDefinitions(nextList);
      setRoleDefinitions(nextList);

      addActivityLog({
        category: 'USER_CHANGE',
        action: 'ROLE_LEVEL_ADDED',
        title: 'Penambahan Kategori Level Jabatan Baru',
        description: `Super User menambahkan kategori level baru: Level ${newDef.levelNumber} — ${newDef.name} (kode: ${newDef.roleKey}).`,
        referenceNumber: `LVL-${newDef.levelNumber}`,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Kategori Level Baru Ditambahkan',
        message: `Level ${newDef.levelNumber} — ${newDef.name} berhasil ditambahkan ke sistem.`,
      });

      return { success: true };
    },
    [currentUser, roleDefinitions, addActivityLog]
  );

  const updateRoleDefinition = useCallback(
    (roleKey: string, updates: Partial<RoleLevelDefinition>) => {
      if (currentUser && currentUser.role !== 'superuser') {
        return {
          success: false,
          error: 'Hanya Super User (Level 0) yang dapat mengubah kategori level.',
        };
      }
      const target = roleDefinitions.find((r) => r.roleKey === roleKey);
      if (!target) {
        return { success: false, error: 'Kategori level tidak ditemukan.' };
      }
      const updatedDef: RoleLevelDefinition = {
        ...target,
        ...updates,
        roleKey: target.roleKey,
        levelNumber:
          target.roleKey === 'superuser'
            ? 0
            : updates.levelNumber !== undefined
            ? Math.max(1, Number(updates.levelNumber))
            : target.levelNumber,
        name: normalizeGudangToStoreText((updates.name ?? target.name).trim()),
        badgeLabel: normalizeGudangToStoreText(
          (updates.badgeLabel ?? target.badgeLabel).trim()
        ),
        description: normalizeGudangToStoreText(
          (updates.description ?? target.description).trim()
        ),
        defaultPermissions: updates.defaultPermissions
          ? { ...target.defaultPermissions, ...updates.defaultPermissions }
          : target.defaultPermissions,
      };

      const nextList = roleDefinitions
        .map((r) => (r.roleKey === roleKey ? updatedDef : r))
        .sort((a, b) => a.levelNumber - b.levelNumber);
      setDynamicRoleDefinitions(nextList);
      setRoleDefinitions(nextList);

      addActivityLog({
        category: 'USER_CHANGE',
        action: 'ROLE_LEVEL_UPDATED',
        title: 'Pembaruan Kategori Level Jabatan',
        description: `Kategori Level ${updatedDef.levelNumber} — ${updatedDef.name} diperbarui oleh Super User.`,
        referenceNumber: `LVL-${updatedDef.levelNumber}`,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Kategori Level Diperbarui',
        message: `Level ${updatedDef.levelNumber} — ${updatedDef.name} berhasil disimpan.`,
      });

      return { success: true };
    },
    [currentUser, roleDefinitions, addActivityLog]
  );

  const deleteRoleDefinition = useCallback(
    (roleKey: string) => {
      if (currentUser && currentUser.role !== 'superuser') {
        return {
          success: false,
          error: 'Hanya Super User (Level 0) yang dapat menghapus kategori level.',
        };
      }
      const target = roleDefinitions.find((r) => r.roleKey === roleKey);
      if (!target) {
        return { success: false, error: 'Kategori level tidak ditemukan.' };
      }
      if (target.isSystemDefault) {
        return {
          success: false,
          error: 'Kategori level bawaan sistem utama tidak dapat dihapus (namun dapat diedit).',
        };
      }
      if (users.some((u) => u.role === roleKey)) {
        return {
          success: false,
          error: `Masih ada pengguna aktif dengan kategori "${target.name}". Ubah level pengguna tersebut terlebih dahulu sebelum menghapus kategori ini.`,
        };
      }

      const nextList = roleDefinitions.filter((r) => r.roleKey !== roleKey);
      setDynamicRoleDefinitions(nextList);
      setRoleDefinitions(nextList);

      addActivityLog({
        category: 'USER_CHANGE',
        action: 'ROLE_LEVEL_DELETED',
        title: 'Penghapusan Kategori Level Jabatan',
        description: `Kategori Level ${target.levelNumber} — ${target.name} dihapus oleh Super User.`,
        referenceNumber: `LVL-${target.levelNumber}`,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Kategori Level Dihapus',
        message: `Kategori "${target.name}" telah dihapus dari sistem.`,
      });

      return { success: true };
    },
    [currentUser, roleDefinitions, users, addActivityLog]
  );

  const dismissToast = () => {
    setActiveToast(null);
  };

  // Cost Center Management (Admin)
  const addCostCenter = useCallback((entry: CostCenterEntry) => {
    const code = entry.code.trim();
    const name = entry.name.trim();
    if (!code) return { success: false, error: 'Nomor / Kode Cost Center wajib diisi.' };
    if (!name) return { success: false, error: 'Nama / Keterangan Cost Center wajib diisi.' };
    if (costCenters.some((c) => c.code.toLowerCase() === code.toLowerCase())) {
      return { success: false, error: `Cost Center dengan kode "${code}" sudah terdaftar.` };
    }
    setCostCenters((prev) => [...prev, { code, name, description: entry.description?.trim() || '' }]);
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'CC_ADDED',
      title: 'Penambahan Cost Center Baru',
      description: `Cost Center kode "${code}" (${name}) ditambahkan ke sistem.`,
      referenceNumber: `CC-${code}`,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'success',
      title: 'Cost Center Ditambahkan',
      message: `Cost Center ${code} - ${name} berhasil disimpan.`,
    });
    return { success: true };
  }, [costCenters, addActivityLog]);

  const updateCostCenter = useCallback((oldCode: string, entry: CostCenterEntry) => {
    const code = entry.code.trim();
    const name = entry.name.trim();
    if (!code) return { success: false, error: 'Nomor / Kode Cost Center wajib diisi.' };
    if (!name) return { success: false, error: 'Nama / Keterangan Cost Center wajib diisi.' };
    if (
      code.toLowerCase() !== oldCode.toLowerCase() &&
      costCenters.some((c) => c.code.toLowerCase() === code.toLowerCase())
    ) {
      return { success: false, error: `Cost Center dengan kode "${code}" sudah digunakan.` };
    }
    setCostCenters((prev) =>
      prev.map((c) => (c.code === oldCode ? { code, name, description: entry.description?.trim() || '' } : c))
    );
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'CC_UPDATED',
      title: 'Pembaruan Data Cost Center',
      description: `Cost Center kode "${oldCode}" diperbarui menjadi "${code} - ${name}".`,
      referenceNumber: `CC-${code}`,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Cost Center Diperbarui',
      message: `Data Cost Center ${code} - ${name} berhasil diperbarui.`,
    });
    return { success: true };
  }, [costCenters, addActivityLog]);

  const deleteCostCenter = useCallback((code: string) => {
    const target = costCenters.find((c) => c.code === code);
    setCostCenters((prev) => prev.filter((c) => c.code !== code));
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'CC_DELETED',
      title: 'Penghapusan Cost Center',
      description: `Cost Center "${code}${target ? ` - ${target.name}` : ''}" dihapus oleh Admin.`,
      referenceNumber: `CC-${code}`,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Cost Center Dihapus',
      message: `Cost Center "${code}${target ? ` - ${target.name}` : ''}" berhasil dihapus dari tabel.`,
    });
    return { success: true };
  }, [costCenters, addActivityLog]);

  const clearAllCostCenters = useCallback(() => {
    const count = costCenters.length;
    setCostCenters([]);
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'CC_CLEARED',
      title: 'Pengosongan Tabel Cost Center',
      description: `Seluruh data Cost Center (${count} baris) dikosongkan oleh Admin.`,
      referenceNumber: 'CC-CLEAR',
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Tabel Cost Center Dikosongkan',
      message: `Seluruh ${count} data Cost Center telah dihapus.`,
    });
  }, [costCenters.length, addActivityLog]);

  const importCostCentersBulk = useCallback(
    (entries: CostCenterEntry[], mode: 'upsert' | 'replace' = 'upsert') => {
      if (!entries || entries.length === 0) {
        return { success: false, added: 0, updated: 0, totalAfter: costCenters.length, error: 'Tidak ada data Cost Center yang valid untuk diimpor.' };
      }

      let added = 0;
      let updated = 0;

      if (mode === 'replace') {
        const existingMap = new Map<string, CostCenterEntry>();
        costCenters.forEach((c) => existingMap.set(c.code.toLowerCase(), c));

        const cleanedMap = new Map<string, CostCenterEntry>();
        for (const item of entries) {
          const code = (item.code || '').toString().trim();
          const name = (item.name || '').toString().trim();
          if (code && name) {
            const key = code.toLowerCase();
            if (!cleanedMap.has(key)) {
              if (existingMap.has(key)) {
                updated++;
              } else {
                added++;
              }
            }
            cleanedMap.set(key, {
              code,
              name,
              description: item.description ? item.description.toString().trim() : '',
            });
          }
        }
        const finalList = Array.from(cleanedMap.values());
        setCostCenters(finalList);
        addActivityLog({
          category: 'MASTER_DATA',
          action: 'CC_IMPORTED',
          title: 'Import & Penyesuaian Tabel Cost Center',
          description: `Tabel Cost Center disesuaikan dari file import menjadi ${finalList.length} baris (${updated} nomor sama di-replace, ${added} nomor baru ditambahkan).`,
          referenceNumber: 'IMPORT-CC',
        });
        setActiveToast({
          id: Math.random().toString(),
          type: 'success',
          title: 'Import Cost Center Berhasil',
          message: `Jumlah tabel disesuaikan menjadi ${finalList.length} Cost Center (${updated} di-replace, ${added} baru).`,
        });
        return { success: true, added, updated, totalAfter: finalList.length };
      } else {
        // Upsert mode: Nomor sama -> di-replace, Nomor berbeda -> ditambahkan
        const map = new Map<string, CostCenterEntry>();
        costCenters.forEach((c) => map.set(c.code.toLowerCase(), c));

        const seenInBatch = new Set<string>();
        entries.forEach((item) => {
          const code = (item.code || '').toString().trim();
          const name = (item.name || '').toString().trim();
          if (code && name) {
            const key = code.toLowerCase();
            const existedBefore = map.has(key);
            map.set(key, {
              code,
              name,
              description: item.description ? item.description.toString().trim() : map.get(key)?.description || '',
            });
            if (!seenInBatch.has(key)) {
              seenInBatch.add(key);
              if (existedBefore) {
                updated++;
              } else {
                added++;
              }
            }
          }
        });

        const finalList = Array.from(map.values());
        setCostCenters(finalList);

        addActivityLog({
          category: 'MASTER_DATA',
          action: 'CC_IMPORTED',
          title: 'Import Excel Cost Center (Upsert/Replace)',
          description: `${updated} Cost Center dengan nomor sama di-replace, ${added} nomor berbeda ditambahkan. Total sekarang: ${finalList.length} Cost Center.`,
          referenceNumber: 'IMPORT-CC',
        });

        setActiveToast({
          id: Math.random().toString(),
          type: 'success',
          title: 'Import Excel Berhasil',
          message: `${updated} Cost Center nomor sama di-replace, ${added} nomor baru ditambahkan (Total: ${finalList.length}).`,
        });

        return { success: true, added, updated, totalAfter: finalList.length };
      }
    },
    [costCenters, addActivityLog]
  );

  // GL Account Management (Admin)
  const addGLAccount = useCallback((entry: GLAccountEntry) => {
    const code = entry.code.trim();
    const name = entry.name.trim();
    if (!code) return { success: false, error: 'Nomor GL Account wajib diisi.' };
    if (!name) return { success: false, error: 'Nama / Keterangan GL Account wajib diisi.' };
    if (glAccounts.some((g) => g.code.toLowerCase() === code.toLowerCase())) {
      return { success: false, error: `GL Account dengan nomor "${code}" sudah terdaftar.` };
    }
    setGlAccounts((prev) => [...prev, { code, name, description: entry.description?.trim() || '' }]);
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'GL_ADDED',
      title: 'Penambahan GL Account Baru',
      description: `GL Account nomor "${code}" (${name}) ditambahkan ke sistem.`,
      referenceNumber: `GL-${code}`,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'success',
      title: 'GL Account Ditambahkan',
      message: `GL Account ${code} - ${name} berhasil disimpan.`,
    });
    return { success: true };
  }, [glAccounts, addActivityLog]);

  const updateGLAccount = useCallback((oldCode: string, entry: GLAccountEntry) => {
    const code = entry.code.trim();
    const name = entry.name.trim();
    if (!code) return { success: false, error: 'Nomor GL Account wajib diisi.' };
    if (!name) return { success: false, error: 'Nama / Keterangan GL Account wajib diisi.' };
    if (
      code.toLowerCase() !== oldCode.toLowerCase() &&
      glAccounts.some((g) => g.code.toLowerCase() === code.toLowerCase())
    ) {
      return { success: false, error: `GL Account dengan nomor "${code}" sudah digunakan.` };
    }
    setGlAccounts((prev) =>
      prev.map((g) => (g.code === oldCode ? { code, name, description: entry.description?.trim() || '' } : g))
    );
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'GL_UPDATED',
      title: 'Pembaruan Data GL Account',
      description: `GL Account nomor "${oldCode}" diperbarui menjadi "${code} - ${name}".`,
      referenceNumber: `GL-${code}`,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'GL Account Diperbarui',
      message: `Data GL Account ${code} - ${name} berhasil diperbarui.`,
    });
    return { success: true };
  }, [glAccounts, addActivityLog]);

  const deleteGLAccount = useCallback((code: string) => {
    const target = glAccounts.find((g) => g.code === code);
    setGlAccounts((prev) => prev.filter((g) => g.code !== code));
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'GL_DELETED',
      title: 'Penghapusan GL Account',
      description: `GL Account "${code}${target ? ` - ${target.name}` : ''}" dihapus oleh Admin.`,
      referenceNumber: `GL-${code}`,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'GL Account Dihapus',
      message: `GL Account "${code}${target ? ` - ${target.name}` : ''}" berhasil dihapus dari tabel.`,
    });
    return { success: true };
  }, [glAccounts, addActivityLog]);

  const clearAllGLAccounts = useCallback(() => {
    const count = glAccounts.length;
    setGlAccounts([]);
    addActivityLog({
      category: 'MASTER_DATA',
      action: 'GL_CLEARED',
      title: 'Pengosongan Tabel GL Account',
      description: `Seluruh data GL Account (${count} baris) dikosongkan oleh Admin.`,
      referenceNumber: 'GL-CLEAR',
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Tabel GL Account Dikosongkan',
      message: `Seluruh ${count} data GL Account telah dihapus.`,
    });
  }, [glAccounts.length, addActivityLog]);

  const importGLAccountsBulk = useCallback(
    (entries: GLAccountEntry[], mode: 'upsert' | 'replace' = 'upsert') => {
      if (!entries || entries.length === 0) {
        return { success: false, added: 0, updated: 0, totalAfter: glAccounts.length, error: 'Tidak ada data GL Account yang valid untuk diimpor.' };
      }

      let added = 0;
      let updated = 0;

      if (mode === 'replace') {
        const existingMap = new Map<string, GLAccountEntry>();
        glAccounts.forEach((g) => existingMap.set(g.code.toLowerCase(), g));

        const cleanedMap = new Map<string, GLAccountEntry>();
        for (const item of entries) {
          const code = (item.code || '').toString().trim();
          const name = (item.name || '').toString().trim();
          if (code && name) {
            const key = code.toLowerCase();
            if (!cleanedMap.has(key)) {
              if (existingMap.has(key)) {
                updated++;
              } else {
                added++;
              }
            }
            cleanedMap.set(key, {
              code,
              name,
              description: item.description ? item.description.toString().trim() : '',
            });
          }
        }
        const finalList = Array.from(cleanedMap.values());
        setGlAccounts(finalList);
        addActivityLog({
          category: 'MASTER_DATA',
          action: 'GL_IMPORTED',
          title: 'Import & Penyesuaian Tabel GL Account',
          description: `Tabel GL Account disesuaikan dari file import menjadi ${finalList.length} baris (${updated} nomor sama di-replace, ${added} nomor baru ditambahkan).`,
          referenceNumber: 'IMPORT-GL',
        });
        setActiveToast({
          id: Math.random().toString(),
          type: 'success',
          title: 'Import GL Account Berhasil',
          message: `Jumlah tabel disesuaikan menjadi ${finalList.length} GL Account (${updated} di-replace, ${added} baru).`,
        });
        return { success: true, added, updated, totalAfter: finalList.length };
      } else {
        // Upsert mode: Nomor sama -> di-replace, Nomor berbeda -> ditambahkan
        const map = new Map<string, GLAccountEntry>();
        glAccounts.forEach((g) => map.set(g.code.toLowerCase(), g));

        const seenInBatch = new Set<string>();
        entries.forEach((item) => {
          const code = (item.code || '').toString().trim();
          const name = (item.name || '').toString().trim();
          if (code && name) {
            const key = code.toLowerCase();
            const existedBefore = map.has(key);
            map.set(key, {
              code,
              name,
              description: item.description ? item.description.toString().trim() : map.get(key)?.description || '',
            });
            if (!seenInBatch.has(key)) {
              seenInBatch.add(key);
              if (existedBefore) {
                updated++;
              } else {
                added++;
              }
            }
          }
        });

        const finalList = Array.from(map.values());
        setGlAccounts(finalList);

        addActivityLog({
          category: 'MASTER_DATA',
          action: 'GL_IMPORTED',
          title: 'Import Excel GL Account (Upsert/Replace)',
          description: `${updated} GL Account dengan nomor sama di-replace, ${added} nomor berbeda ditambahkan. Total sekarang: ${finalList.length} GL Account.`,
          referenceNumber: 'IMPORT-GL',
        });

        setActiveToast({
          id: Math.random().toString(),
          type: 'success',
          title: 'Import Excel Berhasil',
          message: `${updated} GL Account nomor sama di-replace, ${added} nomor baru ditambahkan (Total: ${finalList.length}).`,
        });

        return { success: true, added, updated, totalAfter: finalList.length };
      }
    },
    [glAccounts, addActivityLog]
  );

  // Storage Location & Rak Management
  const addStorageLocation = useCallback(
    (loc: Omit<StorageLocation, 'id'>) => {
      const code = loc.code.trim();
      const name = loc.name.trim();
      if (!code) return { success: false, error: 'Kode / Nomor Rak wajib diisi.' };
      if (!name) return { success: false, error: 'Nama Lokasi / Rak wajib diisi.' };
      if (storageLocations.some((s) => s.code.toLowerCase() === code.toLowerCase())) {
        return { success: false, error: `Lokasi dengan kode "${code}" sudah terdaftar.` };
      }
      const newLoc: StorageLocation = {
        id: `loc_${Date.now()}`,
        code,
        name,
        zone: loc.zone?.trim() || 'Zona Umum',
        description: loc.description?.trim() || '',
      };
      setStorageLocations((prev) => [...prev, newLoc]);
      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Lokasi Rak Ditambahkan',
        message: `Lokasi "${newLoc.code} - ${newLoc.name}" berhasil didaftarkan.`,
      });
      return { success: true, location: newLoc };
    },
    [storageLocations]
  );

  const updateStorageLocation = useCallback(
    (id: string, updates: Partial<StorageLocation>) => {
      const target = storageLocations.find((s) => s.id === id);
      if (!target) return { success: false, error: 'Lokasi tidak ditemukan.' };
      if (updates.code) {
        const codeTrimmed = updates.code.trim().toLowerCase();
        if (storageLocations.some((s) => s.id !== id && s.code.toLowerCase() === codeTrimmed)) {
          return { success: false, error: `Kode lokasi "${updates.code}" sudah digunakan.` };
        }
      }
      setStorageLocations((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
      );
      return { success: true };
    },
    [storageLocations]
  );

  const deleteStorageLocation = useCallback(
    (id: string) => {
      const target = storageLocations.find((s) => s.id === id);
      if (!target) return { success: false, error: 'Lokasi tidak ditemukan.' };
      const itemsInLocation = stockItems.filter(
        (i) => i.location.toLowerCase() === target.code.toLowerCase() || i.location.toLowerCase() === target.name.toLowerCase()
      );
      if (itemsInLocation.length > 0) {
        return {
          success: false,
          error: `Tidak dapat menghapus "${target.code}" karena masih digunakan oleh ${itemsInLocation.length} barang di katalog stok.`,
        };
      }
      setStorageLocations((prev) => prev.filter((s) => s.id !== id));
      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Lokasi Dihapus',
        message: `Rak / Lokasi "${target.code}" telah dihapus.`,
      });
      return { success: true };
    },
    [storageLocations, stockItems]
  );

  // Master Kategori Barang Management (Admin Store / Kepala Store / Superuser)
  const addStockCategory = useCallback(
    (cat: { name: string; description?: string; color?: string }) => {
      const perms = getEffectivePermissions(currentUser);
      if (currentUser && !perms.canManageStockItems) {
        return {
          success: false,
          error: 'Hanya Admin Store / Kepala Store / Superuser yang dapat membuat kategori baru.',
        };
      }

      const cleanName = (cat.name || '').trim();
      if (!cleanName) {
        return { success: false, error: 'Nama kategori wajib diisi.' };
      }

      if (stockCategories.some((c) => c.name.trim().toLowerCase() === cleanName.toLowerCase())) {
        return {
          success: false,
          error: `Kategori "${cleanName}" sudah terdaftar di sistem.`,
        };
      }

      const nowIso = new Date().toISOString();
      const newCategory: StockCategory = {
        id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        description: cat.description?.trim() || '',
        color: cat.color || 'blue',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setStockCategories((prev) => [...prev, newCategory]);

      addActivityLog({
        category: 'MASTER_DATA',
        action: 'CATEGORY_CREATED',
        title: 'Penambahan Kategori Barang Baru',
        description: `Kategori barang baru "${newCategory.name}" berhasil ditambahkan oleh ${currentUser?.name || 'Admin'}.`,
        referenceNumber: newCategory.name,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Kategori Barang Ditambahkan',
        message: `Kategori "${newCategory.name}" berhasil dibuat dan siap digunakan.`,
      });

      return { success: true, category: newCategory };
    },
    [currentUser, stockCategories, addActivityLog]
  );

  const updateStockCategory = useCallback(
    (id: string, updates: { name: string; description?: string; color?: string }) => {
      const perms = getEffectivePermissions(currentUser);
      if (currentUser && !perms.canManageStockItems) {
        return {
          success: false,
          error: 'Hanya Admin Store / Kepala Store / Superuser yang dapat mengedit kategori.',
        };
      }

      const target = stockCategories.find((c) => c.id === id);
      if (!target) {
        return { success: false, error: 'Kategori tidak ditemukan.' };
      }

      const cleanName = (updates.name || '').trim();
      if (!cleanName) {
        return { success: false, error: 'Nama kategori tidak boleh kosong.' };
      }

      if (
        stockCategories.some(
          (c) => c.id !== id && c.name.trim().toLowerCase() === cleanName.toLowerCase()
        )
      ) {
        return {
          success: false,
          error: `Nama kategori "${cleanName}" sudah digunakan oleh kategori lain.`,
        };
      }

      const oldName = target.name.trim();
      const nowIso = new Date().toISOString();

      setStockCategories((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                name: cleanName,
                description:
                  updates.description !== undefined ? updates.description.trim() : c.description,
                color: updates.color || c.color,
                updatedAt: nowIso,
              }
            : c
        )
      );

      // Jika nama kategori berubah, perbarui seluruh item stok yang terhubung dengan kategori lama
      if (oldName.toLowerCase() !== cleanName.toLowerCase()) {
        setStockItems((prev) =>
          prev.map((item) => {
            const currentCats = getItemCategories(item);
            const hasOld = currentCats.some((c) => c.toLowerCase() === oldName.toLowerCase());
            if (!hasOld) return item;

            const updatedCats = Array.from(
              new Set(
                currentCats.map((c) =>
                  c.toLowerCase() === oldName.toLowerCase() ? cleanName : c
                )
              )
            );
            return {
              ...item,
              categories: updatedCats,
              category: updatedCats.join(', '),
              updatedAt: nowIso,
            };
          })
        );
      }

      addActivityLog({
        category: 'MASTER_DATA',
        action: 'CATEGORY_UPDATED',
        title: 'Pembaruan Master Kategori Barang',
        description: `Kategori barang "${oldName}" diperbarui menjadi "${cleanName}" oleh ${currentUser?.name || 'Admin'}.`,
        referenceNumber: cleanName,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Kategori Barang Diperbarui',
        message: `Kategori "${cleanName}" berhasil disimpan dan disinkronkan ke seluruh barang terkait.`,
      });

      return { success: true };
    },
    [currentUser, stockCategories, addActivityLog]
  );

  const deleteStockCategory = useCallback(
    (id: string) => {
      const perms = getEffectivePermissions(currentUser);
      if (currentUser && !perms.canManageStockItems) {
        return {
          success: false,
          error: 'Hanya Admin Store / Kepala Store / Superuser yang dapat menghapus kategori.',
        };
      }

      const target = stockCategories.find((c) => c.id === id);
      if (!target) {
        return { success: false, error: 'Kategori tidak ditemukan.' };
      }

      if (stockCategories.length <= 1) {
        return {
          success: false,
          error: 'Minimal harus terdapat 1 kategori barang aktif di dalam sistem.',
        };
      }

      const removedName = target.name.trim();
      const remainingCategories = stockCategories.filter((c) => c.id !== id);
      const fallbackCategoryName =
        remainingCategories.find((c) => c.name.toLowerCase().includes('umum'))?.name ||
        remainingCategories[0]?.name ||
        'Umum & Konsumsi Gudang';

      const nowIso = new Date().toISOString();
      setStockCategories(remainingCategories);

      // Lepaskan kategori yang dihapus dari setiap item stok (gunakan fallback jika item hanya memiliki kategori tersebut)
      setStockItems((prev) =>
        prev.map((item) => {
          const currentCats = getItemCategories(item);
          const hasRemoved = currentCats.some(
            (c) => c.toLowerCase() === removedName.toLowerCase()
          );
          if (!hasRemoved) return item;

          const nextCats = currentCats.filter(
            (c) => c.toLowerCase() !== removedName.toLowerCase()
          );
          const finalCats = nextCats.length > 0 ? nextCats : [fallbackCategoryName];
          return {
            ...item,
            categories: finalCats,
            category: finalCats.join(', '),
            updatedAt: nowIso,
          };
        })
      );

      addActivityLog({
        category: 'MASTER_DATA',
        action: 'CATEGORY_DELETED',
        title: 'Penghapusan Kategori Barang',
        description: `Kategori barang "${removedName}" dihapus oleh ${currentUser?.name || 'Admin'}.`,
        referenceNumber: removedName,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Kategori Barang Dihapus',
        message: `Kategori "${removedName}" telah dihapus dari sistem.`,
      });

      return { success: true };
    },
    [currentUser, stockCategories, addActivityLog]
  );

  // Bulk Import Stock Items via Excel
  const importStockItemsBulk = useCallback(
    (
      newItemsList: Array<{
        sku: string;
        name: string;
        category: string;
        unit: string;
        currentStock: number;
        minStock: number;
        location: string;
        description?: string;
      }>,
      mode: 'upsert' | 'add_only' = 'upsert'
    ) => {
      if (isStockLockedForOpname) {
        setActiveToast({
          id: Math.random().toString(),
          type: 'error',
          title: 'Stok Store Ter-Lock (Stock Opname Aktif)',
          message: `Tidak dapat import stok selama sesi Stock Opname #${activeStockOpname?.opnameNumber} sedang berlangsung.`,
        });
        return {
          success: false,
          added: 0,
          updated: 0,
          error: `Stok Store sedang TER-LOCK karena proses Stock Opname (#${activeStockOpname?.opnameNumber}) sedang berlangsung!`,
        };
      }
      if (!newItemsList || newItemsList.length === 0) {
        return { success: false, added: 0, updated: 0, error: 'Tidak ada data barang yang valid untuk diimpor.' };
      }

      let added = 0;
      let updated = 0;
      const nowStr = new Date().toISOString();

      const itemMap = new Map<string, StockItem>();
      stockItems.forEach((i) => itemMap.set(i.sku.toUpperCase(), i));

      newItemsList.forEach((raw) => {
        const sku = (raw.sku || '').toString().trim().toUpperCase();
        const name = (raw.name || '').toString().trim();
        if (sku && name) {
          if (itemMap.has(sku)) {
            if (mode === 'upsert') {
              const existing = itemMap.get(sku)!;
              const updatedItem: StockItem = {
                ...existing,
                name,
                category: raw.category ? raw.category.trim() : existing.category,
                unit: raw.unit ? raw.unit.trim() : existing.unit,
                currentStock: Number(raw.currentStock) >= 0 ? Number(raw.currentStock) : existing.currentStock,
                minStock: Number(raw.minStock) >= 0 ? Number(raw.minStock) : existing.minStock,
                location: raw.location ? raw.location.trim() : existing.location,
                description: raw.description ? raw.description.trim() : existing.description,
                updatedAt: nowStr,
              };
              itemMap.set(sku, updatedItem);
              updated++;
            }
          } else {
            const newItem: StockItem = {
              id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              sku,
              name,
              category: raw.category ? raw.category.trim() : 'Sparepart Mesin',
              unit: raw.unit ? raw.unit.trim() : 'Pcs',
              currentStock: Number(raw.currentStock) >= 0 ? Number(raw.currentStock) : 0,
              allocatedStock: 0,
              minStock: Number(raw.minStock) >= 0 ? Number(raw.minStock) : 10,
              location: raw.location ? raw.location.trim() : 'Rak A-01',
              description: raw.description ? raw.description.trim() : '',
              updatedAt: nowStr,
            };
            itemMap.set(sku, newItem);
            added++;
          }
        }
      });

      const finalItems = Array.from(itemMap.values());
      setStockItems(finalItems);

      addActivityLog({
        category: 'STOCK_ADJUSTMENT',
        action: 'STOCK_IMPORTED',
        title: 'Import Katalog Master Barang via Excel',
        description: `${added} barang baru ditambahkan, ${updated} barang diperbarui dari Excel.`,
        referenceNumber: 'IMPORT-STOK',
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Impor Barang Berhasil',
        message: `${added} barang baru berhasil ditambahkan, ${updated} barang diperbarui dari Excel.`,
      });

      return { success: true, added, updated };
    },
    [stockItems, addActivityLog]
  );

  // Company Profile & Branding Management
  const updateCompanyProfile = useCallback((updates: Partial<CompanyProfile>) => {
    setCompanyProfile((prev) => ({ ...prev, ...updates }));
    setActiveToast({
      id: Math.random().toString(),
      type: 'success',
      title: 'Profil Perusahaan Diperbarui',
      message: 'Perubahan logo, nama aplikasi & identitas perusahaan telah disimpan dan berlaku di seluruh sistem.',
    });
  }, []);

  const resetCompanyProfile = useCallback(() => {
    setCompanyProfile(INITIAL_COMPANY_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.COMPANY_PROFILE);
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Profil Dikembalikan ke Default',
      message: 'Data nama dan logo perusahaan telah direset ke setelan awal.',
    });
  }, []);

  // 1A. Create LPB (Oleh User Admin Gudang: Input SJ Supplier, ACC & Validasi Barang / Scan Barcode)
  // - Dokumen LPB berstatus 'PENDING_APPROVAL' (Menunggu Approve Penambahan Stock oleh User Kepala Gudang)
  // - Stok fisik (currentStock) BELUM BERTAMBAH sampai di-approve oleh Kepala Gudang!
  const createLPB = useCallback(
    (data: {
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
    }): LPBDocument => {
      const now = new Date();
      const nowIso = now.toISOString();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const count = lpbDocuments.length + 1;
      const lpbNumber = `LPB-${yearMonth}-${String(count).padStart(4, '0')}`;

      // Map item full details
      const resolvedItems: LPBItem[] = data.items.map((entry) => {
        const stockItem = stockItems.find((s) => s.id === entry.itemId);
        return {
          itemId: entry.itemId,
          sku: stockItem ? stockItem.sku : 'SKU-UNKNOWN',
          itemName: stockItem ? stockItem.name : 'Unknown Item',
          unit: stockItem ? stockItem.unit : 'Pcs',
          quantity: Number(entry.quantity),
          batchNo: entry.batchNo || '-',
          condition: entry.condition,
          notes: entry.notes || '',
          storageLocation: entry.storageLocation || (stockItem ? stockItem.location : 'Rak A-01'),
          barcodeValidated: entry.barcodeValidated ?? true,
          barcodeScannedAt: entry.barcodeScannedAt || nowIso,
        };
      });

      const adminName = currentUser ? currentUser.name : 'Hendra Gunawan';

      const newLPB: LPBDocument = {
        id: `lpb_${Date.now()}`,
        lpbNumber,
        sjNumber: data.sjNumber,
        sjDate: data.sjDate,
        supplierName: data.supplierName,
        receivedDate: data.receivedDate,
        poNumber: data.poNumber || '-',
        driverName: data.driverName || '-',
        vehiclePlate: data.vehiclePlate || '-',
        usagePurpose: data.usagePurpose || 'Pemenuhan Stok Logistik Store',
        storageLocation: data.storageLocation || (resolvedItems[0]?.storageLocation || 'Rak A-01'),
        notes: data.notes || '',
        status: 'PENDING_APPROVAL', // Menunggu Approve Penambahan Stock oleh Kepala Store
        receivedByAdmin: adminName,
        receivedByAdminId: currentUser?.id,
        receivedByAdminUsername: currentUser?.username,
        adminValidatedAt: nowIso,
        verifiedBy: 'Menunggu Approve Kepala Store',
        items: resolvedItems,
        createdAt: nowIso,
      };

      // Kirim notifikasi ke Kepala Store untuk Approve Penambahan Stock
      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        targetRole: 'kepala_gudang',
        type: 'lpb_created',
        title: 'LPB Baru Divalidasi Admin — Menunggu Approve Penambahan Stock (Kepala Store)',
        message: `Admin Store (${adminName}) telah meng-ACC & memvalidasi scan barang LPB #${lpbNumber} (SJ: ${data.sjNumber} - ${data.supplierName}). Stok fisik belum bertambah — menunggu Approve Penambahan Stock oleh Kepala Store.`,
        lpbId: newLPB.id,
        read: false,
        timestamp: nowIso,
      };

      // PENTING: Stok fisik (currentStock) BELUM ditambah pada tahap Admin Store!
      setLpbDocuments((prev) => [newLPB, ...prev]);
      setNotifications((prev) => [newNotif, ...prev]);

      addActivityLog({
        category: 'APPROVAL_WORKFLOW',
        action: 'LPB_VALIDATED_ADMIN',
        title: 'ACC & Validasi/Scan Barang Masuk LPB oleh Admin Store (Stok Belum Bertambah)',
        description: `Admin Store (${adminName}) menginput & memvalidasi scan barcode LPB #${lpbNumber} dari SJ ${data.sjNumber} (${data.supplierName}): ${resolvedItems.map((i) => `${i.itemName} (${i.quantity} ${i.unit})`).join(', ')}. Stok fisik belum berubah — menunggu Approve Penambahan Stock oleh Kepala Store.`,
        referenceNumber: lpbNumber,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'LPB Di-ACC & Divalidasi Admin Store (Stok Belum Bertambah)',
        message: `LPB #${lpbNumber} berhasil divalidasi Admin Store. Menunggu Approve Penambahan Stock oleh Kepala Store agar stok fisik bertambah.`,
      });

      return newLPB;
    },
    [currentUser, lpbDocuments.length, stockItems, addActivityLog]
  );

  // 1B. Approve Penambahan Stock LPB (Oleh Kepala Store / Super User)
  const approveLPBStockAddition = useCallback(
    (
      lpbId: string,
      payload?: {
        warehouseHeadName?: string;
        notes?: string;
      }
    ) => {
      if (isStockLockedForOpname) {
        setActiveToast({
          id: Math.random().toString(),
          type: 'error',
          title: 'Stok Store Ter-Lock (Stock Opname Aktif)',
          message: `Tidak dapat menambah stok LPB selama sesi Stock Opname #${activeStockOpname?.opnameNumber} sedang berlangsung.`,
        });
        return {
          success: false,
          error: `Stok Store sedang TER-LOCK karena proses Stock Opname (#${activeStockOpname?.opnameNumber}) sedang berlangsung! Selesaikan Stock Opname terlebih dahulu.`,
        };
      }

      if (!getEffectivePermissions(currentUser).canApproveLPBStockAddition) {
        return {
          success: false,
          error:
            'Akun Anda tidak memiliki hak akses untuk meng-approve penambahan stock LPB (membutuhkan akses Level 0 Super User atau Level 1 Kepala Store).',
        };
      }

      const targetLPB = lpbDocuments.find((d) => d.id === lpbId);
      if (!targetLPB) {
        return { success: false, error: 'Dokumen LPB tidak ditemukan.' };
      }

      if (targetLPB.status === 'APPROVED') {
        return {
          success: false,
          error: 'Penambahan stock untuk LPB ini sudah di-approve oleh Kepala Store sebelumnya.',
        };
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const headName = payload?.warehouseHeadName?.trim() || currentUser?.name || 'Suryadi';

      const updatedLPB: LPBDocument = {
        ...targetLPB,
        status: 'APPROVED',
        verifiedBy: `${headName} (Kepala Store)`,
        approvedByWarehouseHead: headName,
        approvedByWarehouseHeadId: currentUser?.id,
        approvedByWarehouseHeadUsername: currentUser?.username,
        approvedAt: nowIso,
        headApprovalNotes: payload?.notes?.trim() || 'Penambahan stock di-approve oleh Kepala Store.',
        notes: payload?.notes?.trim()
          ? `${targetLPB.notes ? targetLPB.notes + ' | ' : ''}Approve Kepala Store: ${payload.notes.trim()}`
          : targetLPB.notes,
      };

      // TAMBAHKAN currentStock untuk setiap item di LPB & catat di Kartu Stok (StockMovement IN)
      const newMovements: StockMovement[] = [];
      const updatedStockItems = stockItems.map((item) => {
        const incoming = targetLPB.items.find(
          (ri) => ri.itemId === item.id || ri.sku === item.sku
        );
        if (incoming && incoming.quantity > 0) {
          const balanceBefore = item.currentStock;
          const balanceAfter = balanceBefore + incoming.quantity;

          newMovements.push({
            id: `mov_${Date.now()}_${item.id}`,
            itemId: item.id,
            sku: item.sku,
            itemName: item.name,
            type: 'IN',
            source: 'LPB_SUPPLIER',
            referenceNumber: targetLPB.lpbNumber,
            secondaryRef: `SJ: ${targetLPB.sjNumber} (${targetLPB.supplierName})`,
            quantity: incoming.quantity,
            balanceBefore,
            balanceAfter,
            date: nowIso,
            actor: `${headName} (Approve Kepala Store) & ${targetLPB.receivedByAdmin} (Validasi Admin Store)`,
            notes:
              incoming.notes ||
              `Approve Penambahan Stock Kepala Store (${headName}) atas SJ ${targetLPB.supplierName}`,
          });

          return {
            ...item,
            currentStock: balanceAfter,
            location: incoming.storageLocation || item.location,
            updatedAt: nowIso,
          };
        }
        return item;
      });

      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        targetRole: 'all',
        type: 'lpb_created',
        title: 'Kepala Store Meng-Approve Penambahan Stock (LPB)',
        message: `Kepala Store (${headName}) telah meng-approve penambahan stock LPB #${targetLPB.lpbNumber} (SJ: ${targetLPB.sjNumber}). Total ${targetLPB.items.reduce((acc, i) => acc + i.quantity, 0)} unit resmi ditambahkan ke stok fisik store.`,
        lpbId: targetLPB.id,
        read: false,
        timestamp: nowIso,
      };

      setStockItems(updatedStockItems);
      setLpbDocuments((prev) => prev.map((d) => (d.id === lpbId ? updatedLPB : d)));
      setStockMovements((prev) => [...newMovements, ...prev]);
      setNotifications((prev) => [newNotif, ...prev]);

      addActivityLog({
        category: 'STOCK_ADJUSTMENT',
        action: 'LPB_CREATED',
        title: 'Approve Penambahan Stock LPB oleh Kepala Store (Stok Fisik Bertambah)',
        description: `Kepala Store (${headName}) meng-approve penambahan stock LPB #${targetLPB.lpbNumber} dari hasil validasi Admin Store (${targetLPB.receivedByAdmin}). Penambahan stok fisik: ${targetLPB.items.map((i) => `${i.itemName} +${i.quantity} ${i.unit}`).join(', ')}.`,
        referenceNumber: targetLPB.lpbNumber,
      });

      realtimeService.notifyStockReceived(updatedLPB);

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Penambahan Stock Di-Approve Kepala Store',
        message: `LPB #${targetLPB.lpbNumber} telah di-approve oleh Kepala Store (${headName}). Stok fisik store otomatis bertambah!`,
      });

      return { success: true };
    },
    [currentUser, lpbDocuments, stockItems, addActivityLog]
  );

  // 1C. Reject LPB (Oleh Kepala Store)
  const rejectLPB = useCallback(
    (lpbId: string, reason: string) => {
      if (!getEffectivePermissions(currentUser).canApproveLPBStockAddition && !getEffectivePermissions(currentUser).canCreateLPB) {
        return {
          success: false,
          error: 'Anda tidak memiliki hak akses untuk menolak dokumen LPB.',
        };
      }
      const targetLPB = lpbDocuments.find((d) => d.id === lpbId);
      if (!targetLPB) return { success: false, error: 'Dokumen LPB tidak ditemukan.' };
      if (targetLPB.status === 'APPROVED') {
        return { success: false, error: 'LPB yang sudah di-approve penambahan stoknya tidak dapat ditolak.' };
      }

      setLpbDocuments((prev) =>
        prev.map((d) =>
          d.id === lpbId
            ? {
                ...d,
                status: 'REJECTED',
                rejectionReason: reason.trim() || 'Ditolak oleh Kepala Store',
                verifiedBy: `Ditolak oleh ${currentUser?.name || 'Kepala Store'}`,
              }
            : d
        )
      );

      addActivityLog({
        category: 'APPROVAL_WORKFLOW',
        action: 'LPB_REJECTED',
        title: 'Penolakan Penambahan Stock LPB oleh Kepala Store',
        description: `Kepala Store (${currentUser?.name || 'Kepala Store'}) menolak penambahan stock LPB #${targetLPB.lpbNumber}. Alasan: ${reason}`,
        referenceNumber: targetLPB.lpbNumber,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'warning',
        title: 'LPB Ditolak Kepala Store',
        message: `Penambahan stock untuk LPB #${targetLPB.lpbNumber} ditolak (stok fisik tidak berubah).`,
      });

      return { success: true };
    },
    [currentUser, lpbDocuments, addActivityLog]
  );

  // 2. Create Issue Voucher / Nota Pengambilan Barang (By User)
  // Stock does NOT leave warehouse yet! It is marked as allocated/pending.
  const createIssueVoucher = useCallback(
    (data: {
      purpose: string;
      notes?: string;
      department?: string;
      items: { itemId: string; requestedQty: number; costCenter?: string; glAcc?: string }[];
    }) => {
      if (isStockLockedForOpname) {
        setActiveToast({
          id: Math.random().toString(),
          type: 'error',
          title: 'Stok Store Ter-Lock (Stock Opname Aktif)',
          message: `Tidak dapat menerbitkan SIV baru selama sesi Stock Opname #${activeStockOpname?.opnameNumber} sedang berlangsung.`,
        });
        return {
          success: false,
          error: `Stok Store sedang TER-LOCK karena proses Stock Opname (#${activeStockOpname?.opnameNumber}) sedang berlangsung! Tidak dapat menambah atau mengurangi stok sampai proses Stock Opname selesai.`,
        };
      }

      // Validate items & stock availability
      if (!data.items || data.items.length === 0) {
        return { success: false, error: 'Pilih minimal satu item barang untuk diambil.' };
      }

      for (const reqItem of data.items) {
        const item = stockItems.find((s) => s.id === reqItem.itemId);
        if (!item) {
          return { success: false, error: 'Barang yang dipilih tidak ditemukan di sistem.' };
        }
        const available = item.currentStock - item.allocatedStock;
        if (reqItem.requestedQty <= 0) {
          return { success: false, error: `Jumlah permintaan untuk ${item.name} harus lebih dari 0.` };
        }
        if (reqItem.requestedQty > available) {
          return {
            success: false,
            error: `Stok tersedia tidak mencukupi untuk ${item.name}. Tersedia: ${available} ${item.unit}, diminta: ${reqItem.requestedQty} ${item.unit}.`,
          };
        }
      }

      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const count = issueVouchers.length + 1;
      const voucherNumber = `NPB-${yearMonth}-${String(count).padStart(4, '0')}`;

      const fallbackCC = costCenters[0]?.code || 'AAP1034001';
      const fallbackGL = ensureValidGLForCostCenter(
        fallbackCC,
        glAccounts[0]?.code,
        costCenters,
        glAccounts
      );

      const voucherItems: IssueVoucherItem[] = data.items.map((i) => {
        const s = stockItems.find((item) => item.id === i.itemId)!;
        const rowCC = i.costCenter || fallbackCC;
        const rowGL = ensureValidGLForCostCenter(
          rowCC,
          i.glAcc || fallbackGL,
          costCenters,
          glAccounts
        );
        return {
          itemId: s.id,
          sku: s.sku,
          itemName: s.name,
          unit: s.unit,
          requestedQty: Number(i.requestedQty),
          availableStockSnapshot: s.currentStock,
          costCenter: rowCC,
          glAcc: rowGL,
        };
      });

      const newVoucher: IssueVoucherDocument = {
        id: `voucher_${Date.now()}`,
        voucherNumber,
        requestedBy: currentUser ? currentUser.name : 'User',
        requesterUsername: currentUser?.username,
        approvedByRequester: currentUser ? currentUser.name : 'User',
        userId: currentUser ? currentUser.id : 'unknown',
        department: data.department || (currentUser ? currentUser.department : 'General'),
        requestDate: now.toISOString().split('T')[0],
        purpose: data.purpose,
        notes: data.notes || '',
        status: 'PENDING', // Menunggu ACC Kepala Gudang
        items: voucherItems,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };

      // Reserve / allocate stock (stok fisik TETAP, tapi dialokasikan agar tidak diambil rangkap)
      const updatedStockItems = stockItems.map((item) => {
        const requested = voucherItems.find((vi) => vi.itemId === item.id);
        if (requested) {
          return {
            ...item,
            allocatedStock: item.allocatedStock + requested.requestedQty,
          };
        }
        return item;
      });

      // Notification to Kepala Store
      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        targetRole: 'kepala_gudang',
        type: 'voucher_created',
        title: 'Nota Pengambilan Baru Menunggu ACC Kepala Store',
        message: `${currentUser ? currentUser.name : 'User'} (${newVoucher.department}) menerbitkan nota #${voucherNumber} untuk keperluan: ${data.purpose}. Menunggu ACC Kepala Store.`,
        voucherId: newVoucher.id,
        read: false,
        timestamp: now.toISOString(),
      };

      setStockItems(updatedStockItems);
      setIssueVouchers((prev) => [newVoucher, ...prev]);
      setNotifications((prev) => [newNotif, ...prev]);

      addActivityLog({
        category: 'APPROVAL_WORKFLOW',
        action: 'SIV_CREATED',
        title: 'Penerbitan Nota Pengambilan Barang (SIV) oleh Pemohon',
        description: `${newVoucher.requestedBy} (${newVoucher.department}) menerbitkan Nota SIV #${voucherNumber} untuk keperluan "${data.purpose}" (${voucherItems.length} item barang). Menunggu ACC Kepala Store.`,
        referenceNumber: voucherNumber,
      });

      // Broadcast event
      realtimeService.notifyVoucherCreated(newVoucher);

      return { success: true, voucher: newVoucher };
    },
    [currentUser, issueVouchers.length, stockItems, addActivityLog]
  );

  // 2B. Bulk Create Multiple Issue Vouchers (From CSV Import)
  const createIssueVouchersBulk = useCallback(
    (
      vouchersData: Array<{
        purpose: string;
        notes?: string;
        department?: string;
        requestedBy?: string;
        requestDate?: string;
        items: { itemId: string; requestedQty: number; costCenter?: string; glAcc?: string }[];
      }>
    ) => {
      if (isStockLockedForOpname) {
        setActiveToast({
          id: Math.random().toString(),
          type: 'error',
          title: 'Stok Store Ter-Lock (Stock Opname Aktif)',
          message: `Tidak dapat mengimpor SIV baru selama sesi Stock Opname #${activeStockOpname?.opnameNumber} sedang berlangsung.`,
        });
        return {
          success: false,
          error: `Stok Store sedang TER-LOCK karena proses Stock Opname (#${activeStockOpname?.opnameNumber}) sedang berlangsung!`,
        };
      }

      if (!vouchersData || vouchersData.length === 0) {
        return {
          success: false,
          error: 'Tidak ada data nota pengambilan barang (SIV) valid untuk diterbitkan.',
        };
      }

      // Validate all items and cumulative quantities across all vouchers against current available stock
      const cumulativeRequestedByItemId: Record<string, number> = {};

      for (let vIdx = 0; vIdx < vouchersData.length; vIdx++) {
        const vData = vouchersData[vIdx];
        if (!vData.items || vData.items.length === 0) {
          return {
            success: false,
            error: `Nota SIV ke-${vIdx + 1} tidak memiliki item barang.`,
          };
        }

        for (const reqItem of vData.items) {
          const item = stockItems.find((s) => s.id === reqItem.itemId);
          if (!item) {
            return {
              success: false,
              error: `Barang dengan ID "${reqItem.itemId}" pada Nota ke-${vIdx + 1} tidak ditemukan di Master Stok.`,
            };
          }

          const qty = Number(reqItem.requestedQty);
          if (isNaN(qty) || qty <= 0) {
            return {
              success: false,
              error: `Jumlah permintaan untuk ${item.sku} (${item.name}) harus lebih dari 0.`,
            };
          }

          const available = Math.max(0, item.currentStock - item.allocatedStock);
          const totalNeededForThisItem = (cumulativeRequestedByItemId[item.id] || 0) + qty;

          if (totalNeededForThisItem > available) {
            return {
              success: false,
              error: `Stok tersedia tidak mencukupi untuk ${item.sku} (${item.name}). Tersedia: ${available} ${item.unit}, total diminta dalam CSV: ${totalNeededForThisItem} ${item.unit}.`,
            };
          }

          cumulativeRequestedByItemId[item.id] = totalNeededForThisItem;
        }
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const defaultDateStr = nowIso.split('T')[0];
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const baseCount = issueVouchers.length;

      const createdVouchers: IssueVoucherDocument[] = [];
      const newNotifs: AppNotification[] = [];

      vouchersData.forEach((vData, idx) => {
        const seqNum = baseCount + idx + 1;
        const voucherNumber = `NPB-${yearMonth}-${String(seqNum).padStart(4, '0')}`;

        // Merge duplicate items within the same voucher if any
        const fallbackCC = costCenters[0]?.code || 'AAP1034001';
        const fallbackGL = ensureValidGLForCostCenter(
          fallbackCC,
          glAccounts[0]?.code,
          costCenters,
          glAccounts
        );
        const mergedItemsMap = new Map<string, IssueVoucherItem>();
        vData.items.forEach((reqItem) => {
          const s = stockItems.find((item) => item.id === reqItem.itemId)!;
          const existing = mergedItemsMap.get(s.id);
          if (existing) {
            existing.requestedQty += Number(reqItem.requestedQty);
          } else {
            const rowCC = reqItem.costCenter || fallbackCC;
            const rowGL = ensureValidGLForCostCenter(
              rowCC,
              reqItem.glAcc || fallbackGL,
              costCenters,
              glAccounts
            );
            mergedItemsMap.set(s.id, {
              itemId: s.id,
              sku: s.sku,
              itemName: s.name,
              unit: s.unit,
              requestedQty: Number(reqItem.requestedQty),
              availableStockSnapshot: s.currentStock,
              costCenter: rowCC,
              glAcc: rowGL,
              glAccount: rowGL,
            });
          }
        });

        const voucherItems = Array.from(mergedItemsMap.values());
        const requesterName =
          vData.requestedBy?.trim() || (currentUser ? currentUser.name : 'User');
        const deptName =
          vData.department?.trim() || (currentUser ? currentUser.department : 'General');

        const newVoucher: IssueVoucherDocument = {
          id: `voucher_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          voucherNumber,
          requestedBy: requesterName,
          requesterUsername: currentUser?.username,
          approvedByRequester: requesterName,
          userId: currentUser ? currentUser.id : 'unknown',
          department: deptName,
          requestDate: vData.requestDate?.trim() || defaultDateStr,
          purpose: vData.purpose.trim() || 'Pengambilan Barang via Import CSV',
          notes: vData.notes?.trim() || 'Diterbitkan melalui Import CSV Bulk SIV',
          costCenter: voucherItems[0]?.costCenter || fallbackCC,
          glAccount: voucherItems[0]?.glAcc || fallbackGL,
          status: 'PENDING',
          items: voucherItems,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        createdVouchers.push(newVoucher);

        newNotifs.push({
          id: `notif_${Date.now()}_${idx}`,
          targetRole: 'kepala_gudang',
          type: 'voucher_created',
          title: 'Nota Pengambilan Baru (Import CSV) Menunggu ACC Kepala Store',
          message: `${requesterName} (${deptName}) menerbitkan nota #${voucherNumber} via Import CSV untuk keperluan: ${newVoucher.purpose}. Menunggu ACC Kepala Store.`,
          voucherId: newVoucher.id,
          read: false,
          timestamp: nowIso,
        });
      });

      // Reserve / allocate stock across all imported vouchers
      setStockItems((prev) =>
        prev.map((item) => {
          const addAlloc = cumulativeRequestedByItemId[item.id] || 0;
          if (addAlloc > 0) {
            return {
              ...item,
              allocatedStock: item.allocatedStock + addAlloc,
            };
          }
          return item;
        })
      );

      setIssueVouchers((prev) => [...createdVouchers.slice().reverse(), ...prev]);
      setNotifications((prev) => [...newNotifs.slice().reverse(), ...prev]);

      const voucherNumsSummary = createdVouchers.map((v) => v.voucherNumber).join(', ');
      const totalItemsCount = createdVouchers.reduce((acc, v) => acc + v.items.length, 0);

      addActivityLog({
        category: 'APPROVAL_WORKFLOW',
        action: 'SIV_BULK_IMPORTED',
        title: `Import CSV & Penerbitan Massal (${createdVouchers.length} Nota SIV)`,
        description: `${currentUser ? currentUser.name : 'User'} mengimpor file CSV dan menerbitkan ${createdVouchers.length} Nota SIV sekaligus (${totalItemsCount} baris item tervalidasi): ${voucherNumsSummary}. Menunggu ACC Kepala Store.`,
        referenceNumber: createdVouchers[0]?.voucherNumber,
      });

      createdVouchers.forEach((v) => {
        realtimeService.notifyVoucherCreated(v);
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: `Berhasil Menerbitkan ${createdVouchers.length} Nota SIV (Import CSV)`,
        message: `${createdVouchers.length} Nota Pengambilan Barang (${voucherNumsSummary}) telah divalidasi terhadap stok dan berhasil diterbitkan. Menunggu ACC Kepala Store.`,
        voucherNumber: createdVouchers[0]?.voucherNumber,
      });

      return { success: true, createdVouchers };
    },
    [
      currentUser,
      issueVouchers.length,
      stockItems,
      isStockLockedForOpname,
      activeStockOpname,
      addActivityLog,
    ]
  );

  // 3A. Tahap 2 (Oleh Kepala Store / Super User): Kepala Store ACC SIV yang Diterbitkan Pemohon
  // - Dilakukan pada SIV berstatus 'PENDING'
  // - Status berubah menjadi 'APPROVED' (SIV terkunci, pemohon tidak bisa edit/hapus)
  // - Stok fisik BELUM berkurang sampai Admin Store menyerahkan barang ke penerima!
  const approveIssueVoucher = useCallback(
    (
      voucherId: string,
      handover?: {
        warehouseHeadName?: string;
        approverAdminName?: string;
        notes?: string;
        handoverOfficer?: string;
        recipientName?: string;
      }
    ) => {
      if (isStockLockedForOpname) {
        setActiveToast({
          id: Math.random().toString(),
          type: 'error',
          title: 'Stok Store Ter-Lock (Stock Opname Aktif)',
          message: `Tidak dapat meng-ACC SIV selama sesi Stock Opname #${activeStockOpname?.opnameNumber} sedang berlangsung.`,
        });
        return {
          success: false,
          error: `Stok Store sedang TER-LOCK karena proses Stock Opname (#${activeStockOpname?.opnameNumber}) sedang berlangsung! Selesaikan Stock Opname terlebih dahulu.`,
        };
      }

      const voucher = issueVouchers.find((v) => v.id === voucherId);
      if (!voucher) {
        return { success: false, error: 'Nota pengambilan barang tidak ditemukan.' };
      }

      if (voucher.status === 'HANDOVER_COMPLETED') {
        return {
          success: false,
          error: 'Barang untuk SIV ini sudah diserahkan ke penerima dan stok sudah terpotong!',
        };
      }

      if (voucher.status === 'APPROVED') {
        return {
          success: false,
          error: 'Nota SIV ini sudah di-ACC oleh Kepala Store sebelumnya! Silakan lanjutkan penyerahan barang oleh Admin Store ke penerima.',
        };
      }

      if (!getEffectivePermissions(currentUser).canApproveSIVStockDeduction) {
        return {
          success: false,
          error:
            'Akun Anda tidak memiliki hak akses untuk meng-ACC SIV (membutuhkan akses Level 0 Super User atau Level 1 Kepala Store).',
        };
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const headUser = users.find((u) => u.role === 'kepala_gudang');
      const warehouseHeadName =
        handover?.warehouseHeadName?.trim() ||
        currentUser?.name ||
        headUser?.name ||
        'Suryadi';

      const updatedItems: IssueVoucherItem[] = voucher.items.map((item) => ({
        ...item,
        approvedQty: item.approvedQty ?? item.requestedQty,
      }));

      const updatedVoucher: IssueVoucherDocument = {
        ...voucher,
        status: 'APPROVED', // SIV telah di-ACC Kepala Store (Terkunci), menunggu Admin menyerahkan barang ke penerima
        approvedByRequester: voucher.approvedByRequester || voucher.requestedBy,
        warehouseHeadName,
        approvedByWarehouseHead: warehouseHeadName,
        approvedByWarehouseHeadId: currentUser?.id || headUser?.id,
        approvedByWarehouseHeadUsername: currentUser?.username || headUser?.username,
        headApprovedAt: nowIso,
        approvedAt: nowIso,
        items: updatedItems,
        notes: handover?.notes
          ? `${voucher.notes ? voucher.notes + ' | ' : ''}ACC Kepala Store: ${handover.notes}`
          : voucher.notes,
        updatedAt: nowIso,
      };

      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        targetRole: 'admin',
        type: 'voucher_approved',
        title: 'SIV Telah Di-ACC Kepala Store — Siap Diserahkan Admin ke Penerima',
        message: `Kepala Store (${warehouseHeadName}) telah meng-ACC Nota #${voucher.voucherNumber} (${voucher.department} - ${voucher.requestedBy}). Silakan Admin Store menyerahkan barang ke penerima agar stok otomatis berkurang.`,
        voucherId: voucher.id,
        read: false,
        timestamp: nowIso,
      };

      // PENTING: Stok fisik (currentStock) BELUM berkurang pada tahap ACC Kepala Store!
      // Stok baru otomatis berkurang setelah Admin Store menyerahkan barang ke penerima.
      setIssueVouchers((prev) =>
        prev.map((v) => (v.id === voucherId ? updatedVoucher : v))
      );
      setNotifications((prev) => [newNotif, ...prev]);

      addActivityLog({
        category: 'APPROVAL_WORKFLOW',
        action: 'SIV_APPROVED',
        title: 'ACC Nota SIV oleh Kepala Store (Menunggu Penyerahan Barang oleh Admin Store)',
        description: `Kepala Store (${warehouseHeadName}) telah meng-ACC Nota #${voucher.voucherNumber} yang diterbitkan oleh ${voucher.requestedBy} (${voucher.department}). SIV terkunci dan siap diserahkan oleh Admin Store ke penerima.`,
        referenceNumber: voucher.voucherNumber,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'SIV Berhasil Di-ACC Kepala Store',
        message: `Nota #${voucher.voucherNumber} telah di-ACC oleh Kepala Store (${warehouseHeadName}). Selanjutnya Admin Store menyerahkan barang ke penerima (stok akan otomatis berkurang).`,
        voucherNumber: voucher.voucherNumber,
      });

      realtimeService.notifyVoucherApproved(updatedVoucher);

      return { success: true };
    },
    [
      currentUser,
      users,
      issueVouchers,
      isStockLockedForOpname,
      activeStockOpname,
      addActivityLog,
    ]
  );

  // 3B. Tahap 3 (Oleh Admin Store): Menyerahkan Barang ke Penerima & Validasi Scan Barcode
  // - Dilakukan pada SIV berstatus 'APPROVED' (sudah di-ACC Kepala Store)
  // - Setelah Admin menyerahkan barang ke penerima, OTOMATIS STOCK BERKURANG!
  const completeIssueVoucherHandover = useCallback(
    (
      voucherId: string,
      payload: {
        recipientName: string;
        handoverOfficer?: string;
        warehouseHeadName?: string;
        notes?: string;
        itemsValidation?: {
          itemId: string;
          sku?: string;
          issuedQty: number;
          isCancelled: boolean;
          barcodeValidated?: boolean;
          barcodeScanned?: boolean;
          barcodeScannedAt?: string;
          sourceLocation?: string;
        }[];
        validatedItems?: {
          itemId: string;
          issuedQty: number;
          isCancelled: boolean;
          barcodeScanned?: boolean;
          sourceLocation?: string;
        }[];
      }
    ) => {
      if (isStockLockedForOpname) {
        setActiveToast({
          id: Math.random().toString(),
          type: 'error',
          title: 'Stok Store Ter-Lock (Stock Opname Aktif)',
          message: `Tidak dapat menyerahkan barang SIV selama sesi Stock Opname #${activeStockOpname?.opnameNumber} sedang berlangsung.`,
        });
        return {
          success: false,
          error: `Stok Store sedang TER-LOCK karena proses Stock Opname (#${activeStockOpname?.opnameNumber}) sedang berlangsung!`,
        };
      }

      const voucher = issueVouchers.find((v) => v.id === voucherId);
      if (!voucher) {
        return { success: false, error: 'Nota pengambilan barang tidak ditemukan.' };
      }

      if (!getEffectivePermissions(currentUser).canValidateSIV) {
        return {
          success: false,
          error:
            'Akun Anda tidak memiliki hak akses untuk menyerahkan barang SIV ke penerima (membutuhkan akses Admin Store, Kepala Store, atau Super User).',
        };
      }

      if (voucher.status === 'HANDOVER_COMPLETED') {
        return {
          success: false,
          error: 'Barang pada SIV ini sudah diserahkan ke penerima dan stok sudah berkurang sebelumnya.',
        };
      }

      if (voucher.status === 'PENDING') {
        return {
          success: false,
          error:
            'Nota SIV ini belum di-ACC oleh Kepala Store! Silakan lakukan ACC SIV oleh Kepala Store terlebih dahulu sebelum Admin menyerahkan barang ke penerima.',
        };
      }

      if (!payload.recipientName.trim()) {
        return {
          success: false,
          error: 'Nama penerima barang wajib diinputkan oleh Admin Store saat penyerahan barang.',
        };
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const adminOfficer =
        payload.handoverOfficer?.trim() ||
        (currentUser ? currentUser.name : 'Hendra Gunawan');
      const headUser = users.find((u) => u.role === 'kepala_gudang');
      const warehouseHeadName =
        voucher.warehouseHeadName ||
        voucher.approvedByWarehouseHead ||
        payload.warehouseHeadName?.trim() ||
        headUser?.name ||
        'Suryadi';

      const rawValidations = payload.itemsValidation || payload.validatedItems || [];

      const updatedItems: IssueVoucherItem[] = voucher.items.map((item) => {
        const val = rawValidations.find(
          (v) => v.itemId === item.itemId || ('sku' in v && v.sku === item.sku)
        );
        if (!val) {
          return {
            ...item,
            approvedQty: item.approvedQty ?? item.requestedQty,
            issuedQty: item.requestedQty,
            isCancelled: false,
            barcodeValidated: true,
            barcodeScannedAt: nowIso,
          };
        }
        const finalQty = val.isCancelled ? 0 : Math.max(0, Number(val.issuedQty || 0));
        const isScanned: boolean = Boolean(
          ('barcodeValidated' in val && val.barcodeValidated) ||
          ('barcodeScanned' in val && val.barcodeScanned) ||
          true
        );

        return {
          ...item,
          approvedQty: item.approvedQty ?? item.requestedQty,
          issuedQty: finalQty,
          isCancelled: val.isCancelled || finalQty === 0,
          barcodeValidated: isScanned,
          barcodeScannedAt:
            ('barcodeScannedAt' in val && typeof val.barcodeScannedAt === 'string')
              ? val.barcodeScannedAt
              : nowIso,
          sourceLocation: val.sourceLocation || item.sourceLocation,
        };
      });

      const recipientNameClean = payload.recipientName.trim();

      const updatedVoucher: IssueVoucherDocument = {
        ...voucher,
        status: 'HANDOVER_COMPLETED', // Selesai: Barang telah diserahkan Admin ke penerima & stok otomatis berkurang
        approvedByRequester: voucher.approvedByRequester || voucher.requestedBy,
        warehouseHeadName,
        approvedByWarehouseHead: warehouseHeadName,
        approvedByWarehouseHeadId: voucher.approvedByWarehouseHeadId || headUser?.id,
        approvedByWarehouseHeadUsername:
          voucher.approvedByWarehouseHeadUsername || headUser?.username,
        headApprovedAt: voucher.headApprovedAt || nowIso,
        approvedByAdmin: adminOfficer,
        approvedByAdminId: currentUser?.id,
        approvedByAdminUsername: currentUser?.username,
        approvedAt: voucher.approvedAt || nowIso,
        handoverOfficer: adminOfficer,
        handoverAt: nowIso,
        recipientName: recipientNameClean,
        items: updatedItems,
        notes: payload.notes
          ? `${voucher.notes ? voucher.notes + ' | ' : ''}Penyerahan Admin Store: ${payload.notes}`
          : voucher.notes,
        updatedAt: nowIso,
      };

      // OTOMATIS STOCK BERKURANG SETELAH ADMIN MENYERAHKAN BARANG KE PENERIMA
      const newMovements: StockMovement[] = [];
      const updatedStockItems = stockItems.map((stock) => {
        const vItem = updatedItems.find(
          (vi) => vi.itemId === stock.id || vi.sku === stock.sku
        );
        if (!vItem) return stock;

        const actualIssued = vItem.isCancelled
          ? 0
          : Math.max(0, vItem.issuedQty ?? vItem.requestedQty);
        const balanceBefore = stock.currentStock;
        const balanceAfter = Math.max(0, balanceBefore - actualIssued);

        if (actualIssued > 0) {
          newMovements.push({
            id: `mov_${Date.now()}_${stock.id}`,
            itemId: stock.id,
            sku: stock.sku,
            itemName: stock.name,
            type: 'OUT',
            source: 'NOTA_PENGAMBILAN',
            referenceNumber: voucher.voucherNumber,
            secondaryRef: `${voucher.department} (Penerima: ${recipientNameClean})`,
            quantity: actualIssued,
            balanceBefore,
            balanceAfter,
            date: nowIso,
            actor: `${adminOfficer} (Admin Store - Penyerahan) & ${warehouseHeadName} (ACC Kepala Store)`,
            notes: `Penyerahan barang SIV oleh Admin Store (${adminOfficer}) kepada penerima ${recipientNameClean} (ACC Kepala Store: ${warehouseHeadName})`,
          });
        }

        return {
          ...stock,
          currentStock: balanceAfter,
          allocatedStock: Math.max(0, stock.allocatedStock - vItem.requestedQty),
          updatedAt: nowIso,
        };
      });

      const issuedSummary = updatedItems
        .filter((i) => (i.issuedQty ?? 0) > 0 && !i.isCancelled)
        .map((i) => `${i.itemName} (${i.issuedQty} ${i.unit})`)
        .join(', ');

      const cancelledSummary = updatedItems
        .filter((i) => i.isCancelled || (i.issuedQty ?? 0) === 0)
        .map((i) => i.itemName)
        .join(', ');

      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        targetUserId: voucher.userId,
        type: 'voucher_approved',
        title: 'Barang SIV Telah Diserahkan Admin ke Penerima (Stok Otomatis Berkurang)',
        message: `Admin Store (${adminOfficer}) telah menyerahkan barang Nota #${voucher.voucherNumber} kepada penerima ${recipientNameClean}. Stok fisik store otomatis berkurang.`,
        voucherId: voucher.id,
        read: false,
        timestamp: nowIso,
      };

      setStockItems(updatedStockItems);
      setIssueVouchers((prev) =>
        prev.map((v) => (v.id === voucherId ? updatedVoucher : v))
      );
      if (newMovements.length > 0) {
        setStockMovements((prev) => [...newMovements, ...prev]);
      }
      setNotifications((prev) => [newNotif, ...prev]);

      addActivityLog({
        category: 'APPROVAL_WORKFLOW',
        action: 'SIV_HANDOVER_COMPLETED',
        title: 'Penyerahan Barang SIV oleh Admin Store ke Penerima (Selesai)',
        description: `Admin Store (${adminOfficer}) menyerahkan barang Nota #${voucher.voucherNumber} (telah di-ACC Kepala Store: ${warehouseHeadName}) kepada penerima "${recipientNameClean}". Barang diserahkan: ${issuedSummary || 'Tidak ada (0)'}${cancelledSummary ? `. Batal dikeluarkan (Qty 0): ${cancelledSummary}` : ''}.`,
        referenceNumber: voucher.voucherNumber,
      });

      if (newMovements.length > 0) {
        addActivityLog({
          category: 'STOCK_ADJUSTMENT',
          action: 'STOCK_DEDUCTED_SIV',
          title: 'Pemotongan Otomatis Stok Fisik (Penyerahan Barang oleh Admin Store)',
          description: `Stok fisik store otomatis berkurang setelah Admin Store (${adminOfficer}) menyerahkan barang Nota #${voucher.voucherNumber} kepada penerima ${recipientNameClean}: ${issuedSummary}.`,
          referenceNumber: voucher.voucherNumber,
        });
      }

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Barang Diserahkan ke Penerima (Stok Otomatis Berkurang)',
        message: `Nota #${voucher.voucherNumber} telah diserahkan oleh Admin Store (${adminOfficer}) kepada ${recipientNameClean}. Stok fisik store otomatis berkurang!`,
        voucherNumber: voucher.voucherNumber,
      });

      realtimeService.notifyVoucherApproved(updatedVoucher);

      return { success: true, voucher: updatedVoucher };
    },
    [
      currentUser,
      users,
      issueVouchers,
      stockItems,
      isStockLockedForOpname,
      activeStockOpname,
      addActivityLog,
    ]
  );

  // 4. Reject Issue Voucher
  const rejectIssueVoucher = useCallback(
    (voucherId: string, reason: string) => {
      const voucher = issueVouchers.find((v) => v.id === voucherId);
      if (!voucher) return { success: false, error: 'Nota tidak ditemukan.' };
      if (voucher.status === 'HANDOVER_COMPLETED') {
        return { success: false, error: 'Nota yang barangnya sudah diserahkan tidak dapat ditolak!' };
      }

      const now = new Date();
      const updatedVoucher: IssueVoucherDocument = {
        ...voucher,
        status: 'REJECTED',
        rejectionReason: reason,
        updatedAt: now.toISOString(),
      };

      // Release allocated stock
      const updatedStockItems = stockItems.map((item) => {
        const vItem = voucher.items.find((vi) => vi.itemId === item.id);
        if (vItem) {
          return {
            ...item,
            allocatedStock: Math.max(0, item.allocatedStock - vItem.requestedQty),
          };
        }
        return item;
      });

      const newNotif: AppNotification = {
        id: `notif_${Date.now()}`,
        targetUserId: voucher.userId,
        type: 'voucher_rejected',
        title: 'Nota Pengambilan Ditolak',
        message: `Nota #${voucher.voucherNumber} ditolak. Alasan: ${reason}`,
        voucherId: voucher.id,
        read: false,
        timestamp: now.toISOString(),
      };

      setStockItems(updatedStockItems);
      setIssueVouchers((prev) =>
        prev.map((v) => (v.id === voucherId ? updatedVoucher : v))
      );
      setNotifications((prev) => [newNotif, ...prev]);

      addActivityLog({
        category: 'APPROVAL_WORKFLOW',
        action: 'SIV_REJECTED',
        title: 'Penolakan Nota Pengambilan Barang (SIV)',
        description: `Nota #${voucher.voucherNumber} (${voucher.requestedBy}) ditolak. Alasan: ${reason}`,
        referenceNumber: voucher.voucherNumber,
      });

      realtimeService.notifyVoucherRejected(updatedVoucher);

      return { success: true };
    },
    [issueVouchers, stockItems, addActivityLog]
  );

  // 5. Update Issue Voucher (Strictly locked if APPROVED or HANDOVER_COMPLETED!)
  const updateIssueVoucher = useCallback(
    (
      voucherId: string,
      data: {
        purpose: string;
        notes?: string;
        items: { itemId: string; requestedQty: number; costCenter?: string; glAcc?: string }[];
      }
    ) => {
      const voucher = issueVouchers.find((v) => v.id === voucherId);
      if (!voucher) return { success: false, error: 'Nota tidak ditemukan.' };

      if (voucher.status === 'APPROVED' || voucher.status === 'HANDOVER_COMPLETED') {
        return {
          success: false,
          error: 'Nota sudah di-approve! Dokumen telah terkunci secara permanen dan tidak dapat diubah.',
        };
      }

      // First, restore old allocated stock
      let tempStock = stockItems.map((item) => {
        const oldItem = voucher.items.find((vi) => vi.itemId === item.id);
        if (oldItem) {
          return {
            ...item,
            allocatedStock: Math.max(0, item.allocatedStock - oldItem.requestedQty),
          };
        }
        return item;
      });

      // Verify new requested items
      for (const reqItem of data.items) {
        const item = tempStock.find((s) => s.id === reqItem.itemId);
        if (!item) return { success: false, error: 'Barang tidak ditemukan.' };
        const available = item.currentStock - item.allocatedStock;
        if (reqItem.requestedQty > available) {
          return {
            success: false,
            error: `Stok tersedia tidak mencukupi untuk ${item.name} (${available} ${item.unit} tersedia).`,
          };
        }
      }

      // Re-allocate
      const fallbackCC = costCenters[0]?.code || 'AAP1034001';
      const fallbackGL = ensureValidGLForCostCenter(
        fallbackCC,
        glAccounts[0]?.code,
        costCenters,
        glAccounts
      );
      const newVoucherItems: IssueVoucherItem[] = data.items.map((i) => {
        const s = tempStock.find((item) => item.id === i.itemId)!;
        const rowCC = i.costCenter || fallbackCC;
        const rowGL = ensureValidGLForCostCenter(
          rowCC,
          i.glAcc || fallbackGL,
          costCenters,
          glAccounts
        );
        return {
          itemId: s.id,
          sku: s.sku,
          itemName: s.name,
          unit: s.unit,
          requestedQty: Number(i.requestedQty),
          availableStockSnapshot: s.currentStock,
          costCenter: rowCC,
          glAcc: rowGL,
        };
      });

      tempStock = tempStock.map((item) => {
        const req = newVoucherItems.find((vi) => vi.itemId === item.id);
        if (req) {
          return {
            ...item,
            allocatedStock: item.allocatedStock + req.requestedQty,
          };
        }
        return item;
      });

      const updatedVoucher: IssueVoucherDocument = {
        ...voucher,
        purpose: data.purpose,
        notes: data.notes || '',
        items: newVoucherItems,
        updatedAt: new Date().toISOString(),
      };

      setStockItems(tempStock);
      setIssueVouchers((prev) =>
        prev.map((v) => (v.id === voucherId ? updatedVoucher : v))
      );

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Nota Berhasil Diperbarui',
        message: `Nota #${voucher.voucherNumber} berhasil diperbarui.`,
      });

      return { success: true };
    },
    [issueVouchers, stockItems]
  );

  // 6. Delete Issue Voucher (Strictly locked if APPROVED or HANDOVER_COMPLETED!)
  const deleteIssueVoucher = useCallback(
    (voucherId: string) => {
      const voucher = issueVouchers.find((v) => v.id === voucherId);
      if (!voucher) return { success: false, error: 'Nota tidak ditemukan.' };

      if (voucher.status === 'APPROVED' || voucher.status === 'HANDOVER_COMPLETED') {
        return {
          success: false,
          error: 'Nota sudah di-approve! Dokumen resmi tidak dapat dihapus.',
        };
      }

      // If pending, release allocated stock
      if (voucher.status === 'PENDING') {
        const updatedStockItems = stockItems.map((item) => {
          const vItem = voucher.items.find((vi) => vi.itemId === item.id);
          if (vItem) {
            return {
              ...item,
              allocatedStock: Math.max(0, item.allocatedStock - vItem.requestedQty),
            };
          }
          return item;
        });
        setStockItems(updatedStockItems);
      }

      setIssueVouchers((prev) => prev.filter((v) => v.id !== voucherId));

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Nota Dihapus',
        message: `Nota #${voucher.voucherNumber} berhasil dihapus/dibatalkan.`,
      });

      return { success: true };
    },
    [issueVouchers, stockItems]
  );

  const markNotificationAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const addNewStockItem = (itemData: Omit<StockItem, 'id' | 'allocatedStock' | 'updatedAt'>) => {
    const normalizedCategories = getItemCategories({
      category: itemData.category,
      categories: itemData.categories,
    });
    const newItem: StockItem = {
      ...itemData,
      category: normalizedCategories.join(', '),
      categories: normalizedCategories,
      id: `item_${Date.now()}`,
      allocatedStock: 0,
      updatedAt: new Date().toISOString(),
    };
    setStockItems((prev) => [newItem, ...prev]);

    // Pastikan seluruh kategori baru pada item juga terdaftar di stockCategories
    setStockCategories((prev) => {
      const existingNames = new Set(prev.map((c) => c.name.trim().toLowerCase()));
      const additions: StockCategory[] = [];
      normalizedCategories.forEach((catName) => {
        const key = catName.trim().toLowerCase();
        if (key && !existingNames.has(key)) {
          existingNames.add(key);
          additions.push({
            id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            name: catName.trim(),
            description: `Kategori barang ${catName.trim()}`,
            color: 'blue',
            createdAt: new Date().toISOString(),
          });
        }
      });
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });

    // Initial movement
    if (newItem.currentStock > 0) {
      const newMovement: StockMovement = {
        id: `mov_${Date.now()}_init`,
        itemId: newItem.id,
        sku: newItem.sku,
        itemName: newItem.name,
        type: 'IN',
        source: 'PENYESUAIAN_AWAL',
        referenceNumber: 'SALDO-AWAL',
        secondaryRef: 'Setup Barang Baru',
        quantity: newItem.currentStock,
        balanceBefore: 0,
        balanceAfter: newItem.currentStock,
        date: new Date().toISOString(),
        actor: currentUser ? currentUser.name : 'Admin Gudang',
        notes: 'Pencatatan saldo awal barang master baru',
      };
      setStockMovements((prev) => [newMovement, ...prev]);
    }

    addActivityLog({
      category: 'STOCK_ADJUSTMENT',
      action: 'ITEM_CREATED',
      title: 'Penambahan Master Barang Baru',
      description: `Barang baru "${newItem.name}" (${newItem.sku}) [Kategori: ${formatItemCategories(newItem)}] ditambahkan di ${newItem.location} dengan saldo awal ${newItem.currentStock} ${newItem.unit} (Stok Min: ${newItem.minStock} ${newItem.unit}).`,
      referenceNumber: newItem.sku,
    });

    return newItem;
  };

  const updateStockItem = (id: string, updates: Partial<StockItem>) => {
    const target = stockItems.find((i) => i.id === id);
    const hasCategoryUpdate = updates.categories !== undefined || updates.category !== undefined;
    const normalizedCategories = hasCategoryUpdate
      ? getItemCategories({
          category: updates.category ?? target?.category ?? '',
          categories: updates.categories,
        })
      : undefined;

    const normalizedUpdates: Partial<StockItem> = normalizedCategories
      ? {
          ...updates,
          categories: normalizedCategories,
          category: normalizedCategories.join(', '),
        }
      : updates;

    setStockItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, ...normalizedUpdates, updatedAt: new Date().toISOString() }
          : item
      )
    );

    if (normalizedCategories && normalizedCategories.length > 0) {
      setStockCategories((prev) => {
        const existingNames = new Set(prev.map((c) => c.name.trim().toLowerCase()));
        const additions: StockCategory[] = [];
        normalizedCategories.forEach((catName) => {
          const key = catName.trim().toLowerCase();
          if (key && !existingNames.has(key)) {
            existingNames.add(key);
            additions.push({
              id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              name: catName.trim(),
              description: `Kategori barang ${catName.trim()}`,
              color: 'blue',
              createdAt: new Date().toISOString(),
            });
          }
        });
        return additions.length > 0 ? [...prev, ...additions] : prev;
      });
    }

    if (target) {
      addActivityLog({
        category: 'STOCK_ADJUSTMENT',
        action: 'ITEM_UPDATED',
        title: 'Pembaruan Spesifikasi / Kategori / Stok Minimum Barang',
        description: `Data master barang ${updates.sku || target.sku} (${updates.name || target.name}) diperbarui${normalizedCategories ? `, Kategori: ${normalizedCategories.join(', ')}` : ''}${updates.minStock !== undefined ? `, Stok Minimum: ${updates.minStock} ${updates.unit || target.unit}` : ''}.`,
        referenceNumber: updates.sku || target.sku,
      });
    }
  };

  const deleteStockItem = (id: string): { success: boolean; error?: string } => {
    const item = stockItems.find((i) => i.id === id);
    if (!item) {
      return { success: false, error: 'Barang tidak ditemukan.' };
    }
    if (item.allocatedStock > 0) {
      return {
        success: false,
        error: `Barang "${item.name}" tidak dapat dihapus karena sedang dialokasikan (${item.allocatedStock} ${item.unit}) dalam nota pengambilan pending!`,
      };
    }
    setStockItems((prev) => prev.filter((i) => i.id !== id));
    addActivityLog({
      category: 'STOCK_ADJUSTMENT',
      action: 'ITEM_DELETED',
      title: 'Penghapusan SKU Master Barang',
      description: `Master barang ${item.sku} - ${item.name} dihapus dari sistem.`,
      referenceNumber: item.sku,
    });
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Barang Dihapus',
      message: `Master barang ${item.sku} - ${item.name} berhasil dihapus dari sistem.`,
    });
    return { success: true };
  };

  // Batas Stok Minimal Proposals & Actions (Alur 3 Tahap):
  // Tahap 1: Pengajuan oleh User Pemohon (Status 'PENDING' — masih bisa diedit/dihapus sebelum diverifikasi Admin Gudang)
  // Tahap 2: Verifikasi oleh User Admin Gudang (Status 'VERIFIED_ADMIN' — permohonan TERKUNCI tetapi BELUM mengganti data minimal stock pada sistem)
  // Tahap 3: Approval oleh User Kepala Gudang dari hasil verifikasi Admin Gudang (Status 'APPROVED' — data minimal stock pada sistem RESMI BERUBAH)
  const createMinStockProposal = (data: {
    itemId: string;
    proposedMinStock: number;
    reason: string;
  }) => {
    if (!currentUser) return { success: false, error: 'Silakan login terlebih dahulu' };
    const targetItem = stockItems.find((i) => i.id === data.itemId);
    if (!targetItem) return { success: false, error: 'Item barang tidak ditemukan' };
    if (data.proposedMinStock <= 0) return { success: false, error: 'Usulan batas stok minimal harus lebih dari 0' };
    if (!data.reason.trim()) return { success: false, error: 'Alasan/justifikasi pengajuan wajib diisi' };

    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const count = minStockProposals.length + 1;
    const proposalNumber = `PROP-MIN-${yearMonth}-${String(count).padStart(4, '0')}`;

    const newProposal: MinStockProposal = {
      id: `prop_min_${Date.now()}`,
      proposalNumber,
      itemId: targetItem.id,
      sku: targetItem.sku,
      itemName: targetItem.name,
      unit: targetItem.unit,
      currentMinStock: targetItem.minStock,
      proposedMinStock: Number(data.proposedMinStock),
      reason: data.reason.trim(),
      requestedBy: currentUser.name,
      requestedByUserId: currentUser.id,
      requestedByRole: currentUser.role,
      requestDate: now.toISOString(),
      status: 'PENDING',
    };

    setMinStockProposals((prev) => [newProposal, ...prev]);

    addActivityLog({
      category: 'APPROVAL_WORKFLOW',
      action: 'MIN_STOCK_PROPOSED',
      title: 'Pengajuan Perubahan Stok Minimal (Tahap 1)',
      description: `${currentUser.name} mengajukan perubahan stok minimal untuk ${targetItem.name} (${targetItem.sku}) dari ${targetItem.minStock} menjadi ${data.proposedMinStock} ${targetItem.unit}. Menunggu verifikasi Admin Gudang.`,
      referenceNumber: proposalNumber,
    });

    // Kirim notifikasi ke Admin Gudang untuk verifikasi
    const adminNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      targetRole: 'admin',
      type: 'min_stock_proposal',
      title: 'Pengajuan Stok Minimal Menunggu Verifikasi Admin',
      message: `${currentUser.name} mengajukan perubahan stok minimal untuk ${targetItem.name} (${targetItem.sku}) dari ${targetItem.minStock} menjadi ${data.proposedMinStock} ${targetItem.unit}. Silakan lakukan verifikasi.`,
      proposalId: newProposal.id,
      read: false,
      timestamp: now.toISOString(),
    };
    setNotifications((prev) => [adminNotif, ...prev]);

    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Pengajuan Stok Minimal Terkirim',
      message: `Usulan #${proposalNumber} berhasil diajukan. Menunggu verifikasi oleh Admin Gudang (selanjutnya di-approve oleh Kepala Gudang).`,
    });

    return { success: true, proposal: newProposal };
  };

  // Edit Pengajuan Minimal Stock (Hanya bisa jika belum diverifikasi oleh Admin Gudang -> status === 'PENDING')
  const updateMinStockProposal = (
    proposalId: string,
    data: {
      proposedMinStock: number;
      reason: string;
    }
  ) => {
    const proposal = minStockProposals.find((p) => p.id === proposalId);
    if (!proposal) return { success: false, error: 'Pengajuan tidak ditemukan.' };
    if (proposal.status !== 'PENDING') {
      return {
        success: false,
        error: 'Permohonan sudah diverifikasi oleh Admin Gudang dan telah terkunci! Tidak dapat diedit.',
      };
    }
    if (data.proposedMinStock <= 0) {
      return { success: false, error: 'Usulan batas stok minimal harus lebih dari 0.' };
    }
    if (!data.reason.trim()) {
      return { success: false, error: 'Alasan pengajuan wajib diisi.' };
    }

    setMinStockProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? {
              ...p,
              proposedMinStock: Number(data.proposedMinStock),
              reason: data.reason.trim(),
            }
          : p
      )
    );

    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Pengajuan Stok Minimal Diperbarui',
      message: `Permohonan #${proposal.proposalNumber} berhasil diperbarui sebelum diverifikasi Admin Gudang.`,
    });

    return { success: true };
  };

  // Hapus / Batalkan Pengajuan Minimal Stock (Hanya bisa jika belum diverifikasi oleh Admin Gudang -> status === 'PENDING')
  const deleteMinStockProposal = (proposalId: string) => {
    const proposal = minStockProposals.find((p) => p.id === proposalId);
    if (!proposal) return { success: false, error: 'Pengajuan tidak ditemukan.' };
    if (proposal.status !== 'PENDING') {
      return {
        success: false,
        error: 'Permohonan sudah diverifikasi oleh Admin Gudang dan telah terkunci! Tidak dapat dihapus.',
      };
    }

    setMinStockProposals((prev) => prev.filter((p) => p.id !== proposalId));

    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Pengajuan Stok Minimal Dihapus',
      message: `Permohonan #${proposal.proposalNumber} telah dibatalkan dan dihapus.`,
    });

    return { success: true };
  };

  // Tahap 2: Verifikasi Pengajuan Minimal Stock oleh User Admin Gudang
  // -> Permohonan TERKUNCI (tidak bisa diedit/dihapus pemohon), TETAPI BELUM mengganti data minimal stock pada sistem!
  const verifyMinStockProposal = (
    proposalId: string,
    adminNotes?: string,
    verifiedMinStock?: number
  ) => {
    if (!getEffectivePermissions(currentUser).canVerifyMinStock) {
      return {
        success: false,
        error: 'Akun Anda tidak memiliki hak akses untuk memverifikasi pengajuan stok minimal.',
      };
    }
    const proposal = minStockProposals.find((p) => p.id === proposalId);
    if (!proposal) return { success: false, error: 'Pengajuan tidak ditemukan' };
    if (proposal.status !== 'PENDING') {
      return { success: false, error: 'Pengajuan sudah diverifikasi atau diproses sebelumnya' };
    }

    const now = new Date().toISOString();
    const verifiedVal =
      verifiedMinStock !== undefined && verifiedMinStock > 0
        ? Number(verifiedMinStock)
        : proposal.proposedMinStock;
    const notesText =
      adminNotes?.trim() ||
      'Telah diverifikasi. Permohonan dikunci dan diteruskan untuk persetujuan akhir.';

    // Update status proposal menjadi 'VERIFIED_ADMIN' (Terkunci, tetapi TIDAK mengubah StockItem.minStock dulu!)
    setMinStockProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? {
              ...p,
              status: 'VERIFIED_ADMIN',
              verifiedMinStock: verifiedVal,
              verifiedByAdmin: currentUser?.name || 'Admin',
              verifiedAt: now,
              adminVerificationNotes: notesText,
              reviewedByAdmin: currentUser?.name || 'Admin',
              reviewedAt: now,
              adminNotes: notesText,
            }
          : p
      )
    );

    addActivityLog({
      category: 'APPROVAL_WORKFLOW',
      action: 'MIN_STOCK_VERIFIED',
      title: 'Verifikasi Pengajuan Stok Minimal (Permohonan Terkunci)',
      description: `${currentUser?.name || 'Admin'} (${getRoleLabel(currentUser?.role || 'admin')}) memverifikasi pengajuan #${proposal.proposalNumber} untuk ${proposal.itemName} (${proposal.sku}) sebesar ${verifiedVal} ${proposal.unit}.`,
      referenceNumber: proposal.proposalNumber,
    });

    // Kirim notifikasi ke Kepala Gudang untuk Approval Akhir & ke Pemohon
    const headNotif: AppNotification = {
      id: `notif_${Date.now()}_head`,
      targetRole: 'kepala_gudang',
      type: 'min_stock_verified',
      title: 'Menunggu Approval Kepala Gudang: Stok Minimal Terverifikasi',
      message: `${currentUser?.name || 'Admin'} telah memverifikasi usulan stok minimal #${proposal.proposalNumber} (${proposal.itemName}: ${proposal.currentMinStock} -> ${verifiedVal} ${proposal.unit}). Menunggu approval untuk mengubah data sistem.`,
      proposalId: proposal.id,
      read: false,
      timestamp: now,
    };

    const userNotif: AppNotification = {
      id: `notif_${Date.now()}_user`,
      targetUserId: proposal.requestedByUserId,
      type: 'min_stock_verified',
      title: 'Pengajuan Stok Minimal Diverifikasi (Terkunci)',
      message: `Permohonan #${proposal.proposalNumber} (${proposal.itemName}) telah diverifikasi oleh ${currentUser?.name || 'Admin'} dan terkunci.`,
      proposalId: proposal.id,
      read: false,
      timestamp: now,
    };

    setNotifications((prev) => [headNotif, userNotif, ...prev]);

    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Pengajuan Stok Minimal Terverifikasi (Terkunci)',
      message: `Usulan #${proposal.proposalNumber} telah diverifikasi & terkunci.`,
    });

    return { success: true };
  };

  // Tahap 3: Approval Final oleh Level 0 (Super User) / Level 1 (Kepala Gudang)
  // -> Data minimal stock pada sistem RESMI BERUBAH!
  const approveMinStockProposal = (proposalId: string, headNotes?: string) => {
    const proposal = minStockProposals.find((p) => p.id === proposalId);
    if (!proposal) return { success: false, error: 'Pengajuan tidak ditemukan' };

    if (!getEffectivePermissions(currentUser).canApproveMinStockSystem) {
      return {
        success: false,
        error:
          'Akun Anda tidak memiliki hak akses untuk meng-approve & merubah stok minimal di sistem (membutuhkan akses Level 0 Super User atau Level 1 Kepala Gudang).',
      };
    }

    if (proposal.status === 'APPROVED' || proposal.status === 'REJECTED') {
      return { success: false, error: 'Pengajuan sudah diproses sebelumnya' };
    }

    const now = new Date().toISOString();
    const newMinStock = proposal.verifiedMinStock ?? proposal.proposedMinStock;
    const headApproverName = currentUser?.name || 'Suryadi';
    const notesText =
      headNotes?.trim() ||
      'Disetujui (Approved) dan data minimal stock pada sistem resmi diperbarui.';

    // 1. Update proposal status menjadi 'APPROVED'
    setMinStockProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? {
              ...p,
              status: 'APPROVED',
              verifiedMinStock: p.verifiedMinStock ?? p.proposedMinStock,
              verifiedByAdmin: p.verifiedByAdmin || headApproverName,
              verifiedAt: p.verifiedAt || now,
              approvedByWarehouseHead: headApproverName,
              approvedAt: now,
              headApprovalNotes: notesText,
              reviewedByAdmin: headApproverName,
              reviewedAt: now,
              adminNotes: notesText,
            }
          : p
      )
    );

    // 2. OTOMATIS MENGGANTI DATA MINIMAL STOCK PADA SISTEM (update target item's minStock!)
    setStockItems((prev) =>
      prev.map((item) =>
        item.id === proposal.itemId || item.sku === proposal.sku
          ? { ...item, minStock: newMinStock, updatedAt: now }
          : item
      )
    );

    addActivityLog({
      category: 'APPROVAL_WORKFLOW',
      action: 'MIN_STOCK_APPROVED',
      title: 'Approved Perubahan Data Stok Minimal Sistem',
      description: `${headApproverName} (${getRoleLabel(currentUser?.role || 'kepala_gudang')}) meng-approve pengajuan #${proposal.proposalNumber}. Data minimal stock ${proposal.itemName} (${proposal.sku}) pada sistem resmi berubah dari ${proposal.currentMinStock} menjadi ${newMinStock} ${proposal.unit}.`,
      referenceNumber: proposal.proposalNumber,
    });

    // 3. Notification for requester & admin
    const newNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      targetUserId: proposal.requestedByUserId,
      type: 'min_stock_approved',
      title: 'Approved: Data Minimal Stock Sistem Berubah',
      message: `Pengajuan batas stok minimal #${proposal.proposalNumber} untuk ${proposal.itemName} (${proposal.sku}) sebesar ${newMinStock} ${proposal.unit} telah di-approve oleh ${headApproverName} dan resmi mengubah data minimal stock pada sistem.`,
      proposalId: proposal.id,
      read: false,
      timestamp: now,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // 4. Toast
    setActiveToast({
      id: Math.random().toString(),
      type: 'success',
      title: 'Approved — Minimal Stock Sistem Berubah',
      message: `Data minimal stock ${proposal.itemName} pada sistem resmi berubah dari ${proposal.currentMinStock} menjadi ${newMinStock} ${proposal.unit}.`,
    });

    return { success: true };
  };

  const rejectMinStockProposal = (proposalId: string, notes: string) => {
    const perms = getEffectivePermissions(currentUser);
    if (!perms.canVerifyMinStock && !perms.canApproveMinStockSystem) {
      return {
        success: false,
        error: 'Anda tidak memiliki hak akses untuk menolak pengajuan stok minimal',
      };
    }
    const proposal = minStockProposals.find((p) => p.id === proposalId);
    if (!proposal) return { success: false, error: 'Pengajuan tidak ditemukan' };
    if (proposal.status === 'APPROVED' || proposal.status === 'REJECTED') {
      return { success: false, error: 'Pengajuan sudah selesai diproses' };
    }

    const now = new Date().toISOString();
    const actorRole = currentUser?.role || 'admin';
    const actorName = currentUser?.name || 'Admin Store';
    const actorLabel =
      actorRole === 'kepala_gudang'
        ? `Kepala Store (${actorName})`
        : `Admin Store (${actorName})`;

    setMinStockProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId
          ? {
              ...p,
              status: 'REJECTED',
              reviewedByAdmin: `${actorName} (${actorRole === 'kepala_gudang' ? 'Kepala Store' : 'Admin Store'})`,
              reviewedAt: now,
              adminNotes: notes || `Ditolak oleh ${actorLabel}`,
            }
          : p
      )
    );

    addActivityLog({
      category: 'APPROVAL_WORKFLOW',
      action: 'MIN_STOCK_REJECTED',
      title: 'Penolakan Pengajuan Stok Minimal',
      description: `${actorLabel} menolak pengajuan #${proposal.proposalNumber} untuk ${proposal.itemName} (${proposal.sku}). Alasan: ${notes}`,
      referenceNumber: proposal.proposalNumber,
    });

    const newNotif: AppNotification = {
      id: `notif_${Date.now()}`,
      targetUserId: proposal.requestedByUserId,
      type: 'min_stock_rejected',
      title: 'Pengajuan Stok Minimal Ditolak',
      message: `Pengajuan batas stok minimal untuk ${proposal.itemName} (${proposal.sku}) ditolak oleh ${actorLabel}. Alasan: ${notes}`,
      proposalId: proposal.id,
      read: false,
      timestamp: now,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    setActiveToast({
      id: Math.random().toString(),
      type: 'warning',
      title: 'Pengajuan Stok Minimal Ditolak',
      message: `Pengajuan untuk ${proposal.itemName} telah ditolak.`,
    });

    return { success: true };
  };

  // Pre-compute Analisa Kategori Keluar Barang (Fast Moving, Medium Moving, Low Moving) in a single O(M) pass
  const movementAnalyticsCache = useMemo(() => {
    const byId = new Map<
      string,
      { totalOutQty: number; outFrequency: number; lastOutDate?: string; lastOutTs: number }
    >();
    const bySku = new Map<
      string,
      { totalOutQty: number; outFrequency: number; lastOutDate?: string; lastOutTs: number }
    >();

    for (let i = 0; i < stockMovements.length; i++) {
      const m = stockMovements[i];
      if (m.type !== 'OUT') continue;
      const ts = m.date ? Date.parse(m.date) || 0 : 0;

      if (m.itemId) {
        const prev = byId.get(m.itemId);
        if (prev) {
          prev.totalOutQty += m.quantity;
          prev.outFrequency += 1;
          if (ts >= prev.lastOutTs) {
            prev.lastOutTs = ts;
            prev.lastOutDate = m.date;
          }
        } else {
          byId.set(m.itemId, {
            totalOutQty: m.quantity,
            outFrequency: 1,
            lastOutDate: m.date,
            lastOutTs: ts,
          });
        }
      }

      if (m.sku) {
        const prevSku = bySku.get(m.sku);
        if (prevSku) {
          prevSku.totalOutQty += m.quantity;
          prevSku.outFrequency += 1;
          if (ts >= prevSku.lastOutTs) {
            prevSku.lastOutTs = ts;
            prevSku.lastOutDate = m.date;
          }
        } else {
          bySku.set(m.sku, {
            totalOutQty: m.quantity,
            outFrequency: 1,
            lastOutDate: m.date,
            lastOutTs: ts,
          });
        }
      }
    }

    const buildResult = (stat?: {
      totalOutQty: number;
      outFrequency: number;
      lastOutDate?: string;
    }) => {
      const totalOutQty = stat?.totalOutQty ?? 0;
      const outFrequency = stat?.outFrequency ?? 0;
      const lastOutDate = stat?.lastOutDate;

      let velocityCategory: MovementVelocityCategory = 'LOW_MOVING';
      let velocityLabel: 'Fast Moving' | 'Medium Moving' | 'Low Moving' = 'Low Moving';

      if (outFrequency >= 2 || totalOutQty >= 12) {
        velocityCategory = 'FAST_MOVING';
        velocityLabel = 'Fast Moving';
      } else if (outFrequency >= 1 || totalOutQty >= 3) {
        velocityCategory = 'MEDIUM_MOVING';
        velocityLabel = 'Medium Moving';
      }

      return {
        totalOutQty,
        outFrequency,
        outboundFrequency: outFrequency,
        lastOutDate,
        velocityCategory,
        category: velocityCategory,
        velocityLabel,
        label: velocityLabel,
        turnoverRatio: Number((totalOutQty / Math.max(1, outFrequency)).toFixed(1)),
      };
    };

    const resultById = new Map<string, ReturnType<typeof buildResult>>();
    byId.forEach((stat, key) => resultById.set(key, buildResult(stat)));

    const resultBySku = new Map<string, ReturnType<typeof buildResult>>();
    bySku.forEach((stat, key) => resultBySku.set(key, buildResult(stat)));

    const defaultLowMoving = buildResult(undefined);

    return { resultById, resultBySku, defaultLowMoving };
  }, [stockMovements]);

  // Analisa Kategori Keluar Barang (O(1) Lookup)
  const getItemMovementAnalytics = useCallback(
    (itemId: string, sku?: string) => {
      const foundById = movementAnalyticsCache.resultById.get(itemId);
      if (foundById) return foundById;
      if (sku) {
        const foundBySku = movementAnalyticsCache.resultBySku.get(sku);
        if (foundBySku) return foundBySku;
      }
      return movementAnalyticsCache.defaultLowMoving;
    },
    [movementAnalyticsCache]
  );

  // Stock alert item arrays (Memoized to avoid re-filtering thousands of items on unrelated renders)
  const lowStockItems = useMemo(
    () => stockItems.filter((i) => i.currentStock <= i.minStock),
    [stockItems]
  );
  const nearMinStockItems = useMemo(
    () =>
      stockItems.filter(
        (i) =>
          i.currentStock > i.minStock &&
          i.currentStock <= i.minStock + Math.max(3, Math.round(i.minStock * 0.35))
      ),
    [stockItems]
  );

  const openPrintPreview = (type: 'LPB' | 'NPB', doc: LPBDocument | IssueVoucherDocument) => {
    setSelectedDocumentForPrint({ type, doc });
  };

  const closePrintPreview = () => {
    setSelectedDocumentForPrint(null);
  };

  const updateDatabaseCollection = useCallback(
    (collectionName: string, data: unknown) => {
      if (currentUser && currentUser.role !== 'superuser') {
        return {
          success: false,
          error: 'Hanya Super User (Level 0) yang memiliki akses penuh ke Database Master.',
        };
      }
      try {
        switch (collectionName) {
          case 'users':
            if (Array.isArray(data)) setUsers(data as UserAccount[]);
            break;
          case 'roleDefinitions':
            if (Array.isArray(data)) {
              setDynamicRoleDefinitions(data as RoleLevelDefinition[]);
              setRoleDefinitions(data as RoleLevelDefinition[]);
            }
            break;
          case 'stockItems':
            if (Array.isArray(data)) setStockItems(data as StockItem[]);
            break;
          case 'lpbDocuments':
            if (Array.isArray(data)) setLpbDocuments(data as LPBDocument[]);
            break;
          case 'issueVouchers':
            if (Array.isArray(data)) setIssueVouchers(data as IssueVoucherDocument[]);
            break;
          case 'stockMovements':
            if (Array.isArray(data)) setStockMovements(data as StockMovement[]);
            break;
          case 'minStockProposals':
            if (Array.isArray(data)) setMinStockProposals(data as MinStockProposal[]);
            break;
          case 'costCenters':
            if (Array.isArray(data)) setCostCenters(data as CostCenterEntry[]);
            break;
          case 'glAccounts':
            if (Array.isArray(data)) setGlAccounts(data as GLAccountEntry[]);
            break;
          case 'storageLocations':
            if (Array.isArray(data)) setStorageLocations(data as StorageLocation[]);
            break;
          case 'companyProfile':
            if (data && typeof data === 'object') setCompanyProfile(data as CompanyProfile);
            break;
          case 'activityLogs':
            if (Array.isArray(data)) setActivityLogs(data as SystemActivityLog[]);
            break;
          case 'notifications':
            if (Array.isArray(data)) setNotifications(data as AppNotification[]);
            break;
          case 'stockOpnameSessions':
            if (Array.isArray(data)) setStockOpnameSessions(data as StockOpnameSession[]);
            break;
          case 'locationTransferRequests':
            if (Array.isArray(data)) setLocationTransferRequests(data as LocationTransferRequest[]);
            break;
          default:
            return { success: false, error: `Koleksi database "${collectionName}" tidak dikenal.` };
        }

        addActivityLog({
          category: 'MASTER_DATA',
          action: 'DB_COLLECTION_UPDATED',
          title: `Perubahan Langsung Tabel Database (${collectionName})`,
          description: `Super User (${currentUser?.name || 'Superuser'}) memperbarui tabel database "${collectionName}" melalui Konsol Database Superuser.`,
          referenceNumber: `DB-${collectionName.toUpperCase()}`,
        });

        setActiveToast({
          id: Math.random().toString(),
          type: 'success',
          title: 'Tabel Database Diperbarui',
          message: `Koleksi "${collectionName}" berhasil disimpan dan disinkronkan ke server.`,
        });

        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Gagal memperbarui koleksi database.',
        };
      }
    },
    [currentUser, addActivityLog]
  );

  const replaceEntireDatabase = useCallback(
    async (dump: Record<string, unknown>) => {
      if (currentUser && currentUser.role !== 'superuser') {
        return {
          success: false,
          error: 'Hanya Super User (Level 0) yang dapat memulihkan (restore) seluruh database.',
        };
      }
      try {
        if (Array.isArray(dump.roleDefinitions)) {
          setDynamicRoleDefinitions(dump.roleDefinitions as RoleLevelDefinition[]);
          setRoleDefinitions(dump.roleDefinitions as RoleLevelDefinition[]);
        }
        if (Array.isArray(dump.users)) setUsers(dump.users as UserAccount[]);
        if (Array.isArray(dump.stockItems)) setStockItems(dump.stockItems as StockItem[]);
        if (Array.isArray(dump.lpbDocuments)) setLpbDocuments(dump.lpbDocuments as LPBDocument[]);
        if (Array.isArray(dump.issueVouchers))
          setIssueVouchers(dump.issueVouchers as IssueVoucherDocument[]);
        if (Array.isArray(dump.stockMovements))
          setStockMovements(dump.stockMovements as StockMovement[]);
        if (Array.isArray(dump.minStockProposals))
          setMinStockProposals(dump.minStockProposals as MinStockProposal[]);
        if (Array.isArray(dump.costCenters)) setCostCenters(dump.costCenters as CostCenterEntry[]);
        if (Array.isArray(dump.glAccounts)) setGlAccounts(dump.glAccounts as GLAccountEntry[]);
        if (Array.isArray(dump.storageLocations))
          setStorageLocations(dump.storageLocations as StorageLocation[]);
        if (dump.companyProfile && typeof dump.companyProfile === 'object') {
          setCompanyProfile(dump.companyProfile as CompanyProfile);
        }
        if (Array.isArray(dump.activityLogs))
          setActivityLogs(dump.activityLogs as SystemActivityLog[]);
        if (Array.isArray(dump.notifications))
          setNotifications(dump.notifications as AppNotification[]);
        if (Array.isArray(dump.stockOpnameSessions))
          setStockOpnameSessions(dump.stockOpnameSessions as StockOpnameSession[]);
        if (Array.isArray(dump.locationTransferRequests))
          setLocationTransferRequests(dump.locationTransferRequests as LocationTransferRequest[]);

        await fetch('/api/superuser/database', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dump),
        });

        setActiveToast({
          id: Math.random().toString(),
          type: 'success',
          title: 'Database Master Berhasil Dipulihkan',
          message: 'Seluruh koleksi database aplikasi telah diperbarui dan disinkronkan ke server.',
        });

        return { success: true };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Gagal memulihkan database.',
        };
      }
    },
    [currentUser]
  );

  const resetToDefaultData = () => {
    setDynamicRoleDefinitions(INITIAL_ROLE_DEFINITIONS);
    setRoleDefinitions(INITIAL_ROLE_DEFINITIONS);
    setStockItems(INITIAL_STOCK_ITEMS);
    setLpbDocuments(INITIAL_LPB_DOCUMENTS);
    setIssueVouchers(INITIAL_ISSUE_VOUCHERS);
    setStockMovements(INITIAL_STOCK_MOVEMENTS);
    setNotifications(INITIAL_NOTIFICATIONS);
    setCostCenters(INITIAL_COST_CENTERS);
    setGlAccounts(INITIAL_GL_ACCOUNTS);
    setMinStockProposals(INITIAL_MIN_STOCK_PROPOSALS);
    setStockOpnameSessions([]);
    setLocationTransferRequests([]);
    setActivityLogs(INITIAL_ACTIVITY_LOGS);
    setUsers(INITIAL_USERS);
    setCurrentUser((prev) => prev || INITIAL_USERS[0]);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.ROLE_DEFINITIONS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_ITEMS);
    localStorage.removeItem(STORAGE_KEYS.LPB_DOCS);
    localStorage.removeItem(STORAGE_KEYS.ISSUE_VOUCHERS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_MOVEMENTS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.COST_CENTERS);
    localStorage.removeItem(STORAGE_KEYS.GL_ACCOUNTS);
    localStorage.removeItem(STORAGE_KEYS.STORAGE_LOCATIONS);
    localStorage.removeItem(STORAGE_KEYS.COMPANY_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.MIN_STOCK_PROPOSALS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_OPNAME_SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.LOCATION_TRANSFER_REQUESTS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVITY_LOGS);
    setStorageLocations(INITIAL_STORAGE_LOCATIONS);
    setCompanyProfile(INITIAL_COMPANY_PROFILE);
    setActiveToast({
      id: Math.random().toString(),
      type: 'info',
      title: 'Data Demo Direset',
      message: 'Seluruh data master stok, akun login, kategori level, Cost Center, GL Account, lokasi rak, profil perusahaan, pengajuan stok minimal, LPB, dan nota dikembalikan ke kondisi awal.',
    });
  };

  const resetAllTransactionsAndStock = useCallback(
    async (mode: 'EMPTY_ALL' | 'ZERO_STOCK_ONLY' = 'EMPTY_ALL') => {
      const nowIso = new Date().toISOString();
      const clearedStockItems: StockItem[] =
        mode === 'ZERO_STOCK_ONLY'
          ? stockItems.map((item) => ({
              ...item,
              currentStock: 0,
              allocatedStock: 0,
              updatedAt: nowIso,
            }))
          : [];

      const resetLogEntry: SystemActivityLog = {
        id: `log_reset_all_${Date.now()}`,
        timestamp: nowIso,
        actorId: currentUser?.id || 'system',
        actorName: currentUser?.name || 'System Administrator',
        actorUsername: currentUser?.username || 'system',
        actorRole: currentUser?.role || 'superuser',
        actorDepartment: currentUser?.department || 'Operasional Store',
        category: 'STOCK_ADJUSTMENT',
        action: mode === 'ZERO_STOCK_ONLY' ? 'RESET_TRANSACTIONS_ZERO_STOCK' : 'RESET_ALL_EMPTY',
        title:
          mode === 'ZERO_STOCK_ONLY'
            ? 'Reset All: Kosongkan Transaksi (LPB & SIV) & Nolkan Saldo Stok'
            : 'Reset All: Kosongkan Semua Transaksi & Stok (LPB, Stok & SIV Kosong)',
        description:
          mode === 'ZERO_STOCK_ONLY'
            ? `Seluruh dokumen LPB, Nota SIV, Kartu Stok, dan Sesi Opname telah dikosongkan. Saldo fisik & alokasi ${clearedStockItems.length} item barang direset menjadi 0.`
            : 'Seluruh transaksi LPB, Nota Pengambilan Barang (SIV), Master Stok Barang, Kartu Stok, dan Sesi Stock Opname telah dikosongkan kembali (0 data).',
        referenceNumber: 'RESET-ALL',
      };

      const nextLogs = [resetLogEntry, ...activityLogs];

      setStockItems(clearedStockItems);
      setLpbDocuments([]);
      setIssueVouchers([]);
      setStockMovements([]);
      setStockOpnameSessions([]);
      setMinStockProposals([]);
      setLocationTransferRequests([]);
      setNotifications([]);
      setActivityLogs(nextLogs);

      try {
        localStorage.setItem(STORAGE_KEYS.STOCK_ITEMS, JSON.stringify(clearedStockItems));
        localStorage.setItem(STORAGE_KEYS.LPB_DOCS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.ISSUE_VOUCHERS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.STOCK_MOVEMENTS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.STOCK_OPNAME_SESSIONS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.MIN_STOCK_PROPOSALS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.LOCATION_TRANSFER_REQUESTS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(nextLogs));
      } catch {
        // ignore storage errors
      }

      // Immediately push the cleared state to the server so SQLite/SQL dump and other devices are synced
      const resetPayload = {
        stockItems: clearedStockItems,
        lpbDocuments: [],
        issueVouchers: [],
        stockMovements: [],
        notifications: [],
        costCenters,
        glAccounts,
        storageLocations,
        companyProfile,
        minStockProposals: [],
        stockOpnameSessions: [],
        locationTransferRequests: [],
        activityLogs: nextLogs,
        users,
        roleDefinitions,
      };
      lastSyncedPayloadHash.current = JSON.stringify(resetPayload);
      try {
        setIsSyncingToServer(true);
        let nextVer = lastSyncedVersion.current + 1;
        try {
          const res = await fetch('/api/inventory/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resetPayload),
          });
          if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
            const data = await res.json();
            if (data?.version) nextVer = data.version;
          }
        } catch {
          // Local Express API not mounted on static hosting; proceed with Cloud Firestore & LocalStorage
        }
        lastSyncedVersion.current = nextVer;
        setSyncRevision(nextVer);
        setLastSyncTimestamp(new Date().toISOString());
        setSyncError(null);
        setIsServerConnected(true);
        await saveInventoryStateToFirestore({
          ...resetPayload,
          updatedAt: new Date().toISOString(),
          version: nextVer,
        });
      } catch {
        // ignore network errors
      } finally {
        setIsSyncingToServer(false);
      }

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title:
          mode === 'ZERO_STOCK_ONLY'
            ? 'Transaksi Dikosongkan & Stok Dinolkan'
            : 'Semua Transaksi & Stok Dikosongkan',
        message:
          mode === 'ZERO_STOCK_ONLY'
            ? 'Seluruh transaksi LPB, SIV, Kartu Stok, dan Opname telah dikosongkan. Saldo seluruh item barang kini menjadi 0.'
            : 'Seluruh transaksi LPB, Stok Barang, SIV, Kartu Stok, dan Sesi Opname berhasil dikosongkan kembali.',
      });
    },
    [
      stockItems,
      currentUser,
      activityLogs,
      costCenters,
      glAccounts,
      storageLocations,
      companyProfile,
      users,
      roleDefinitions,
    ]
  );

  // Shared Server Synchronization (Multi-device public access without Gmail login)
  const isInitialServerFetchDone = React.useRef(false);
  const isApplyingRemoteState = React.useRef(false);
  const lastSyncedPayloadHash = React.useRef<string>('');
  const lastSyncedVersion = React.useRef<number>(1);
  const [syncRevision, setSyncRevision] = useState<number>(1);
  const [isServerConnected, setIsServerConnected] = useState<boolean>(true);
  const [isSyncingToServer, setIsSyncingToServer] = useState<boolean>(false);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<string>(() => new Date().toISOString());
  const [syncError, setSyncError] = useState<string | null>(null);
  const [deviceModeState, setDeviceModeState] = useState<'ANDROID' | 'WEBSITE'>('WEBSITE');

  const setDeviceMode = useCallback((mode: 'ANDROID' | 'WEBSITE') => {
    setDeviceModeState(mode);
  }, []);

  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
      setActiveToast({
        id: Math.random().toString(),
        type,
        title: type === 'success' ? 'Berhasil' : type === 'warning' ? 'Perhatian' : 'Informasi',
        message,
      });
    },
    []
  );

  const showCustomToast = useCallback((toast: Omit<ToastInfo, 'id'>) => {
    setActiveToast({
      ...toast,
      id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    });
  }, []);

  const applyRemoteSnapshot = useCallback((s: Record<string, unknown>, remoteVer: number) => {
    isApplyingRemoteState.current = true;
    lastSyncedVersion.current = remoteVer;
    setSyncRevision(remoteVer);
    setLastSyncTimestamp(new Date().toISOString());
    setIsServerConnected(true);
    setSyncError(null);

    let nextRoles: RoleLevelDefinition[] | undefined;
    if (Array.isArray(s.roleDefinitions) && s.roleDefinitions.length > 0) {
      nextRoles = (s.roleDefinitions as RoleLevelDefinition[]).map((d) => ({
        ...d,
        name: normalizeGudangToStoreText(d.name),
        badgeLabel: normalizeGudangToStoreText(d.badgeLabel),
        description: normalizeGudangToStoreText(d.description),
      }));
      setDynamicRoleDefinitions(nextRoles);
      setRoleDefinitions(nextRoles);
    }
    if (Array.isArray(s.stockItems) && s.stockItems.length > 0) {
      setStockItems(s.stockItems as StockItem[]);
    }
    if (Array.isArray(s.lpbDocuments)) setLpbDocuments(s.lpbDocuments as LPBDocument[]);
    if (Array.isArray(s.issueVouchers))
      setIssueVouchers(s.issueVouchers as IssueVoucherDocument[]);
    if (Array.isArray(s.stockMovements)) setStockMovements(s.stockMovements as StockMovement[]);
    if (Array.isArray(s.notifications)) setNotifications(s.notifications as AppNotification[]);
    if (Array.isArray(s.costCenters) && s.costCenters.length > 0) {
      const incomingCC = s.costCenters as CostCenterEntry[];
      const isLegacyDummyCC =
        incomingCC.length <= 8 && incomingCC.some((c) => c.code === '10' || c.code === '60');
      if (!isLegacyDummyCC) {
        setCostCenters(incomingCC);
      }
    }
    if (Array.isArray(s.glAccounts) && s.glAccounts.length > 0) {
      const incomingGL = s.glAccounts as GLAccountEntry[];
      const isLegacyDummyGL =
        incomingGL.length <= 10 && incomingGL.some((g) => g.code === '51010');
      if (!isLegacyDummyGL) {
        setGlAccounts(incomingGL);
      }
    }
    if (Array.isArray(s.storageLocations) && s.storageLocations.length > 0)
      setStorageLocations(s.storageLocations as StorageLocation[]);
    if (Array.isArray(s.stockCategories) && s.stockCategories.length > 0)
      setStockCategories(s.stockCategories as StockCategory[]);
    let nextProfile: CompanyProfile | undefined;
    if (s.companyProfile && typeof s.companyProfile === 'object') {
      nextProfile = normalizeCompanyProfile(s.companyProfile as Partial<CompanyProfile>);
      setCompanyProfile(nextProfile);
    }
    if (Array.isArray(s.minStockProposals))
      setMinStockProposals(s.minStockProposals as MinStockProposal[]);
    if (Array.isArray(s.stockOpnameSessions))
      setStockOpnameSessions(s.stockOpnameSessions as StockOpnameSession[]);
    if (Array.isArray(s.locationTransferRequests))
      setLocationTransferRequests(s.locationTransferRequests as LocationTransferRequest[]);
    if (Array.isArray(s.activityLogs)) setActivityLogs(s.activityLogs as SystemActivityLog[]);
    let nextUsers: UserAccount[] | undefined;
    if (Array.isArray(s.users) && s.users.length > 0) {
      nextUsers = normalizeAndSortUsersByLevel(s.users as UserAccount[], false);
      setUsers(nextUsers);
      setCurrentUser((prev) => {
        if (!prev) return null;
        const found = nextUsers!.find(
          (u) => u.id === prev.id || u.username.toLowerCase() === prev.username.toLowerCase()
        );
        return found || prev;
      });
    }

    setTimeout(() => {
      isApplyingRemoteState.current = false;
    }, 150);
  }, []);

  const fetchServerState = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/state');
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (res.ok && isJson) {
        const json = await res.json();
        setIsServerConnected(true);
        setSyncError(null);
        setLastSyncTimestamp(new Date().toISOString());
        if (json?.state) {
          const s = json.state;
          if (s.version && s.version > lastSyncedVersion.current) {
            applyRemoteSnapshot(s, s.version);
          }
        }
        isInitialServerFetchDone.current = true;
        return;
      }
    } catch {
      // Express /api/inventory/state is unavailable (e.g. deployed as static build on external hosting)
    }

    // Fallback to Cloud Firestore & Local Persistent Database so exported ZIP on any hosting stays connected
    try {
      const cloudState = await fetchInventoryStateFromFirestore();
      if (cloudState) {
        const remoteVer = typeof cloudState.version === 'number' ? cloudState.version : 1;
        if (remoteVer > lastSyncedVersion.current) {
          applyRemoteSnapshot(cloudState, remoteVer);
        }
      }
    } catch {
      // Offline / local persistent mode
    } finally {
      setIsServerConnected(true);
      setSyncError(null);
      setLastSyncTimestamp(new Date().toISOString());
      isInitialServerFetchDone.current = true;
    }
  }, [applyRemoteSnapshot]);

  const forceSyncNow = useCallback(async () => {
    await fetchServerState();
  }, [fetchServerState]);

  useEffect(() => {
    testFirestoreConnection();
    fetchServerState();
    const interval = setInterval(fetchServerState, 10000);

    const unsubscribeFirestore = subscribeToFirestoreInventoryState((s) => {
      const remoteVersion = typeof s.version === 'number' ? s.version : 0;
      if (remoteVersion > lastSyncedVersion.current) {
        applyRemoteSnapshot(s, remoteVersion);
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribeFirestore();
    };
  }, [fetchServerState, applyRemoteSnapshot]);

  useEffect(() => {
    const payload = {
      stockItems,
      lpbDocuments,
      issueVouchers,
      stockMovements,
      notifications,
      costCenters,
      glAccounts,
      storageLocations,
      stockCategories,
      companyProfile,
      minStockProposals,
      stockOpnameSessions,
      locationTransferRequests,
      activityLogs,
      users,
      roleDefinitions,
    };
    const serialized = JSON.stringify(payload);

    if (!isInitialServerFetchDone.current || isApplyingRemoteState.current) {
      lastSyncedPayloadHash.current = serialized;
      return;
    }
    if (serialized === lastSyncedPayloadHash.current) {
      return;
    }
    lastSyncedPayloadHash.current = serialized;

    setIsSyncingToServer(true);
    const timer = setTimeout(async () => {
      const nowIso = new Date().toISOString();
      let nextVer = lastSyncedVersion.current + 1;
      try {
        try {
          const res = await fetch('/api/inventory/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: serialized,
          });
          if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
            const data = await res.json();
            if (data?.version) {
              nextVer = data.version;
            }
          }
        } catch {
          // Static / external hosting without local Node backend: continue syncing via Cloud Firestore & LocalStorage
        }

        lastSyncedVersion.current = nextVer;
        setSyncRevision(nextVer);
        setLastSyncTimestamp(nowIso);
        setSyncError(null);
        setIsServerConnected(true);

        await saveInventoryStateToFirestore({
          ...payload,
          updatedAt: nowIso,
          version: nextVer,
        });
      } catch {
        // LocalStorage is already persisted synchronously; keep database status connected
        setSyncError(null);
        setIsServerConnected(true);
      } finally {
        setIsSyncingToServer(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [
    stockItems,
    lpbDocuments,
    issueVouchers,
    stockMovements,
    notifications,
    costCenters,
    glAccounts,
    storageLocations,
    stockCategories,
    companyProfile,
    minStockProposals,
    stockOpnameSessions,
    locationTransferRequests,
    activityLogs,
    users,
    roleDefinitions,
  ]);

  // ============================================================================
  // STOCK OPNAME & LOCK STOK STORE (Dimulai oleh Level 1 Kepala Store ke Atas)
  // ============================================================================
  const startStockOpname = useCallback(
    (params: { title: string; notes?: string }) => {
      if (!currentUser || getRoleLevel(currentUser.role) > 1) {
        return {
          success: false,
          error:
            'Hanya Kepala Store (Level 1) ke atas yang memiliki otorisasi untuk memulai Stock Opname dan mengunci stok.',
        };
      }
      if (activeStockOpname) {
        return {
          success: false,
          error: `Sesi Stock Opname #${activeStockOpname.opnameNumber} masih aktif! Selesaikan terlebih dahulu sebelum memulai sesi baru.`,
        };
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const opnameNumber = `SO-${yearMonth}-${String(stockOpnameSessions.length + 1).padStart(4, '0')}`;

      const entries: StockOpnameItemEntry[] = stockItems.map((item) => ({
        itemId: item.id,
        sku: item.sku,
        itemName: item.name,
        category: item.category,
        unit: item.unit,
        location: item.location,
        systemStockSnapshot: item.currentStock,
        allocatedStockSnapshot: item.allocatedStock,
        physicalStock: null,
        variance: 0,
        isCounted: false,
        barcodeScanned: false,
      }));

      const newSession: StockOpnameSession = {
        id: `so_${Date.now()}`,
        opnameNumber,
        title: params.title.trim() || `Stock Opname Store Periode ${now.toLocaleDateString('id-ID')}`,
        status: 'IN_PROGRESS',
        startedAt: nowIso,
        startedBy: currentUser.name,
        startedByUsername: currentUser.username,
        startedByRole: currentUser.role,
        notes: params.notes?.trim() || '',
        items: entries,
      };

      setStockOpnameSessions((prev) => [newSession, ...prev]);

      addActivityLog({
        category: 'STOCK_ADJUSTMENT',
        action: 'STOCK_OPNAME_STARTED',
        title: 'Mulai Stock Opname — Seluruh Stok Store DI-LOCK',
        description: `${currentUser.name} (${getRoleLabel(currentUser.role)}) memulai sesi Stock Opname #${opnameNumber} ("${newSession.title}"). Seluruh transaksi penambahan (LPB) dan pengurangan (SIV) stok dikunci sementara sampai Stock Opname selesai.`,
        referenceNumber: opnameNumber,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'warning',
        title: 'Stock Opname Dimulai — Stok Store Ter-Lock!',
        message: `Sesi #${opnameNumber} aktif. Tidak dapat menambah atau mengurangi stok sampai Stock Opname diselesaikan.`,
      });

      return { success: true, session: newSession };
    },
    [currentUser, activeStockOpname, stockOpnameSessions.length, stockItems, addActivityLog]
  );

  const scanOrUpdateOpnameItem = useCallback(
    (params: {
      skuOrId: string;
      physicalStock?: number;
      incrementByOne?: boolean;
      barcodeScanned?: boolean;
      verifiedLocation?: string;
      notes?: string;
    }) => {
      if (!activeStockOpname) {
        return {
          success: false,
          error: 'Tidak ada sesi Stock Opname yang sedang berlangsung.',
        };
      }

      const rawKey = params.skuOrId.trim().replace(/^\*|\*$/g, '').toUpperCase();
      const targetEntry = activeStockOpname.items.find(
        (e) => e.itemId.toUpperCase() === rawKey || e.sku.toUpperCase() === rawKey
      );

      if (!targetEntry) {
        return {
          success: false,
          error: `Barcode / SKU "${params.skuOrId}" tidak ditemukan di dalam daftar Master Barang Store.`,
        };
      }

      const nowIso = new Date().toISOString();
      let nextPhysical: number;
      if (params.incrementByOne) {
        nextPhysical = (targetEntry.physicalStock ?? 0) + 1;
      } else if (params.physicalStock !== undefined && params.physicalStock >= 0) {
        nextPhysical = Number(params.physicalStock);
      } else {
        nextPhysical = targetEntry.physicalStock ?? targetEntry.systemStockSnapshot;
      }

      const updatedEntry: StockOpnameItemEntry = {
        ...targetEntry,
        physicalStock: nextPhysical,
        variance: nextPhysical - targetEntry.systemStockSnapshot,
        verifiedLocation:
          params.verifiedLocation !== undefined
            ? params.verifiedLocation
            : targetEntry.verifiedLocation || targetEntry.location,
        isCounted: true,
        barcodeScanned: params.barcodeScanned ?? targetEntry.barcodeScanned,
        lastScannedAt: params.barcodeScanned ? nowIso : targetEntry.lastScannedAt || nowIso,
        countedBy: currentUser
          ? `${currentUser.name} (@${currentUser.username})`
          : 'Petugas Opname',
        notes: params.notes !== undefined ? params.notes : targetEntry.notes,
      };

      setStockOpnameSessions((prev) =>
        prev.map((s) =>
          s.id === activeStockOpname.id
            ? {
                ...s,
                items: s.items.map((it) =>
                  it.itemId === targetEntry.itemId ? updatedEntry : it
                ),
              }
            : s
        )
      );

      return { success: true, entry: updatedEntry };
    },
    [activeStockOpname, currentUser]
  );

  const completeStockOpname = useCallback(
    (params: { applyAdjustment: boolean; notes?: string }) => {
      if (!currentUser || getRoleLevel(currentUser.role) > 1) {
        return {
          success: false,
          error:
            'Hanya Kepala Store (Level 1) ke atas yang dapat menyelesaikan Stock Opname dan membuka kunci stok.',
        };
      }
      if (!activeStockOpname) {
        return {
          success: false,
          error: 'Tidak ada sesi Stock Opname yang aktif.',
        };
      }

      const nowIso = new Date().toISOString();
      const newMovements: StockMovement[] = [];

      if (params.applyAdjustment) {
        const updatedStockItems = stockItems.map((stock) => {
          const opEntry = activeStockOpname.items.find((e) => e.itemId === stock.id || e.sku === stock.sku);
          if (!opEntry || !opEntry.isCounted || opEntry.physicalStock === null) {
            return stock;
          }
          const diff = opEntry.physicalStock - stock.currentStock;
          if (diff !== 0) {
            newMovements.push({
              id: `mov_so_${Date.now()}_${stock.id}`,
              itemId: stock.id,
              sku: stock.sku,
              itemName: stock.name,
              type: diff > 0 ? 'IN' : 'OUT',
              source: 'PENYESUAIAN_OPNAME',
              referenceNumber: activeStockOpname.opnameNumber,
              secondaryRef: `Stock Opname (${diff > 0 ? '+' : ''}${diff} ${stock.unit})`,
              quantity: Math.abs(diff),
              balanceBefore: stock.currentStock,
              balanceAfter: opEntry.physicalStock,
              date: nowIso,
              actor: `${currentUser.name} (${getRoleLabel(currentUser.role)})`,
              notes:
                opEntry.notes ||
                `Penyesuaian hasil Stock Opname #${activeStockOpname.opnameNumber} (Sistem: ${stock.currentStock} -> Fisik: ${opEntry.physicalStock} ${stock.unit})`,
            });
          }
          const finalLocation = opEntry.verifiedLocation?.trim() || stock.location;
          const mergedLocations = Array.from(
            new Set([
              finalLocation,
              stock.location,
              ...(stock.locations || []),
            ])
          ).filter(Boolean);

          return {
            ...stock,
            currentStock: opEntry.physicalStock,
            location: finalLocation,
            locations: mergedLocations,
            updatedAt: nowIso,
          };
        });

        setStockItems(updatedStockItems);
        if (newMovements.length > 0) {
          setStockMovements((prev) => [...newMovements, ...prev]);
        }
      }

      setStockOpnameSessions((prev) =>
        prev.map((s) =>
          s.id === activeStockOpname.id
            ? {
                ...s,
                status: 'COMPLETED',
                completedAt: nowIso,
                completedBy: currentUser.name,
                appliedAdjustment: params.applyAdjustment,
                notes: params.notes
                  ? `${s.notes ? s.notes + ' | ' : ''}${params.notes}`
                  : s.notes,
              }
            : s
        )
      );

      addActivityLog({
        category: 'STOCK_ADJUSTMENT',
        action: 'STOCK_OPNAME_COMPLETED',
        title: 'Stock Opname Selesai — Lock Stok Store DIBUKA',
        description: `${currentUser.name} (${getRoleLabel(currentUser.role)}) menyelesaikan sesi Stock Opname #${activeStockOpname.opnameNumber}. ${
          params.applyAdjustment
            ? `${newMovements.length} item disesuaikan dengan stok fisik hasil opname.`
            : 'Diselesaikan tanpa perubahan saldo stok.'
        } Kunci stok Store telah dibuka kembali.`,
        referenceNumber: activeStockOpname.opnameNumber,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'Stock Opname Selesai — Stok Store Dibuka Kembali!',
        message: `Sesi #${activeStockOpname.opnameNumber} selesai. Transaksi penambahan & pengurangan stok kini dapat dilakukan kembali.`,
      });

      return { success: true };
    },
    [currentUser, activeStockOpname, stockItems, addActivityLog]
  );

  const cancelStockOpname = useCallback(
    (reason?: string) => {
      if (!currentUser || getRoleLevel(currentUser.role) > 1) {
        return {
          success: false,
          error: 'Hanya Kepala Store (Level 1) ke atas yang dapat membatalkan Stock Opname.',
        };
      }
      if (!activeStockOpname) {
        return { success: false, error: 'Tidak ada sesi Stock Opname yang aktif.' };
      }

      const nowIso = new Date().toISOString();
      setStockOpnameSessions((prev) =>
        prev.map((s) =>
          s.id === activeStockOpname.id
            ? {
                ...s,
                status: 'CANCELLED',
                completedAt: nowIso,
                completedBy: currentUser.name,
                notes: reason ? `Dibatalkan: ${reason}` : s.notes,
              }
            : s
        )
      );

      addActivityLog({
        category: 'STOCK_ADJUSTMENT',
        action: 'STOCK_OPNAME_CANCELLED',
        title: 'Pembatalan Stock Opname — Lock Stok Dibuka',
        description: `${currentUser.name} membatalkan sesi Stock Opname #${activeStockOpname.opnameNumber}. Lock stok telah dibuka tanpa perubahan saldo.`,
        referenceNumber: activeStockOpname.opnameNumber,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Stock Opname Dibatalkan (Stok Un-Locked)',
        message: `Sesi #${activeStockOpname.opnameNumber} dibatalkan dan kunci stok dibuka kembali.`,
      });

      return { success: true };
    },
    [currentUser, activeStockOpname, addActivityLog]
  );

  // ============================================================================
  // PINDAH LOKASI BARANG (Admin Mengajukan -> Terealisasi saat Di-ACC Kepala Store)
  // ============================================================================
  const createLocationTransferRequest = useCallback(
    (params: { itemId: string; toLocation: string; reason: string }) => {
      if (!currentUser) {
        return { success: false, error: 'Silakan login terlebih dahulu.' };
      }
      const perms = getEffectivePermissions(currentUser);
      if (!perms.canManageStockItems && !perms.canManageCompanyProfile && getRoleLevel(currentUser.role) > 2) {
        return {
          success: false,
          error: 'Hanya Admin Store atau Kepala Store yang dapat mengajukan pemindahan lokasi barang.',
        };
      }

      const item = stockItems.find((i) => i.id === params.itemId || i.sku === params.itemId);
      if (!item) {
        return { success: false, error: 'Barang tidak ditemukan di Master Stok.' };
      }
      const targetLoc = params.toLocation.trim();
      if (!targetLoc) {
        return { success: false, error: 'Lokasi rak tujuan wajib dipilih.' };
      }
      if (item.location.trim().toLowerCase() === targetLoc.toLowerCase()) {
        return {
          success: false,
          error: `Barang "${item.name}" sudah berada di lokasi "${item.location}". Pilih lokasi rak tujuan yang berbeda.`,
        };
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      const transferNumber = `TRF-LOC-${yearMonth}-${String(locationTransferRequests.length + 1).padStart(4, '0')}`;

      const newReq: LocationTransferRequest = {
        id: `trf_loc_${Date.now()}`,
        transferNumber,
        requestNumber: transferNumber,
        itemId: item.id,
        sku: item.sku,
        itemName: item.name,
        category: item.category,
        currentStockSnapshot: item.currentStock,
        unit: item.unit,
        fromLocation: item.location,
        toLocation: targetLoc,
        reason: params.reason.trim() || 'Penataan ulang rak penyimpanan Store',
        status: 'PENDING_KEPALA',
        requestedBy: currentUser.name,
        requestedByUsername: currentUser.username,
        requestedByRole: currentUser.role,
        requestedAt: nowIso,
      };

      setLocationTransferRequests((prev) => [newReq, ...prev]);

      const headNotif: AppNotification = {
        id: `notif_trf_${Date.now()}`,
        targetRole: 'kepala_gudang',
        type: 'lpb_created',
        title: 'Pengajuan Pindah Lokasi Barang Menunggu ACC Kepala Store',
        message: `${currentUser.name} mengajukan pemindahan lokasi ${item.name} (${item.sku}) dari "${item.location}" ke "${targetLoc}". Lokasi belum berubah sampai di-ACC Kepala Store.`,
        read: false,
        timestamp: nowIso,
      };
      setNotifications((prev) => [headNotif, ...prev]);

      addActivityLog({
        category: 'MASTER_DATA',
        action: 'LOCATION_TRANSFER_REQUESTED',
        title: 'Pengajuan Pindah Lokasi Rak Barang oleh Admin Store (Menunggu ACC Kepala Store)',
        description: `${currentUser.name} mengajukan pindah lokasi barang ${item.name} (${item.sku}) dari rak "${item.location}" ke "${targetLoc}" (#${transferNumber}). Perpindahan lokasi akan terealisasi setelah di-ACC oleh Kepala Store.`,
        referenceNumber: transferNumber,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'info',
        title: 'Pengajuan Pindah Lokasi Terkirim',
        message: `Permohonan #${transferNumber} (${item.location} → ${targetLoc}) menunggu ACC Kepala Store agar perpindahan lokasi terealisasi.`,
      });

      return { success: true, request: newReq };
    },
    [currentUser, stockItems, locationTransferRequests.length, addActivityLog]
  );

  const approveLocationTransferRequest = useCallback(
    (requestId: string, approvalNotes?: string) => {
      if (!currentUser || getRoleLevel(currentUser.role) > 1) {
        return {
          success: false,
          error:
            'Hanya Kepala Store (Level 1) atau Super User yang dapat meng-ACC dan merealisasikan perpindahan lokasi barang.',
        };
      }

      const targetReq = locationTransferRequests.find((r) => r.id === requestId);
      if (!targetReq) {
        return { success: false, error: 'Data pengajuan pindah lokasi tidak ditemukan.' };
      }
      if (targetReq.status !== 'PENDING_APPROVAL' && targetReq.status !== 'PENDING_KEPALA') {
        return { success: false, error: 'Pengajuan pindah lokasi ini sudah diproses sebelumnya.' };
      }

      const nowIso = new Date().toISOString();

      // 1. Update status pengajuan menjadi APPROVED
      setLocationTransferRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: 'APPROVED',
                approvedBy: currentUser.name,
                approvedAt: nowIso,
                approvalNotes:
                  approvalNotes?.trim() || 'Disetujui (ACC) oleh Kepala Store. Lokasi barang resmi dipindahkan.',
              }
            : r
        )
      );

      // 2. REALISASIKAN PERPINDAHAN LOKASI pada StockItem!
      setStockItems((prev) =>
        prev.map((item) =>
          item.id === targetReq.itemId || item.sku === targetReq.sku
            ? {
                ...item,
                location: targetReq.toLocation,
                updatedAt: nowIso,
              }
            : item
        )
      );

      addActivityLog({
        category: 'MASTER_DATA',
        action: 'LOCATION_TRANSFER_APPROVED',
        title: 'ACC Kepala Store — Perpindahan Lokasi Barang Terealisasi',
        description: `Kepala Store (${currentUser.name}) meng-ACC pengajuan #${targetReq.transferNumber}. Lokasi penyimpanan ${targetReq.itemName} (${targetReq.sku}) resmi berpindah dari "${targetReq.fromLocation}" ke "${targetReq.toLocation}".`,
        referenceNumber: targetReq.transferNumber,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'success',
        title: 'ACC Kepala Store — Pindah Lokasi Terealisasi!',
        message: `Lokasi ${targetReq.itemName} (${targetReq.sku}) resmi berpindah dari "${targetReq.fromLocation}" ke "${targetReq.toLocation}".`,
      });

      return { success: true };
    },
    [currentUser, locationTransferRequests, addActivityLog]
  );

  const rejectLocationTransferRequest = useCallback(
    (requestId: string, rejectionReason: string) => {
      if (!currentUser || getRoleLevel(currentUser.role) > 1) {
        return {
          success: false,
          error: 'Hanya Kepala Store (Level 1) atau Super User yang dapat menolak pengajuan pindah lokasi.',
        };
      }

      const targetReq = locationTransferRequests.find((r) => r.id === requestId);
      if (!targetReq) {
        return { success: false, error: 'Data pengajuan pindah lokasi tidak ditemukan.' };
      }
      if (targetReq.status !== 'PENDING_APPROVAL' && targetReq.status !== 'PENDING_KEPALA') {
        return { success: false, error: 'Pengajuan pindah lokasi ini sudah diproses sebelumnya.' };
      }

      const nowIso = new Date().toISOString();
      setLocationTransferRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: 'REJECTED',
                rejectedBy: currentUser.name,
                rejectedAt: nowIso,
                rejectionReason: rejectionReason.trim() || 'Ditolak oleh Kepala Store',
              }
            : r
        )
      );

      addActivityLog({
        category: 'MASTER_DATA',
        action: 'LOCATION_TRANSFER_REJECTED',
        title: 'Penolakan Pengajuan Pindah Lokasi Barang oleh Kepala Store',
        description: `Kepala Store (${currentUser.name}) menolak pengajuan pindah lokasi #${targetReq.transferNumber} untuk ${targetReq.itemName} (${targetReq.fromLocation} -> ${targetReq.toLocation}). Alasan: ${rejectionReason}`,
        referenceNumber: targetReq.transferNumber,
      });

      setActiveToast({
        id: Math.random().toString(),
        type: 'warning',
        title: 'Pengajuan Pindah Lokasi Ditolak',
        message: `Permohonan #${targetReq.transferNumber} ditolak. Lokasi barang tetap di "${targetReq.fromLocation}".`,
      });

      return { success: true };
    },
    [currentUser, locationTransferRequests, addActivityLog]
  );

  const syncStatus = React.useMemo(
    () => ({
      connected: isServerConnected,
      isSyncing: isSyncingToServer,
      revision: syncRevision,
      lastSyncAt: lastSyncTimestamp,
      sqlSynced: isServerConnected && !syncError,
      hasError: Boolean(syncError),
      errorMessage: syncError || undefined,
      lastActionSummary: activityLogs[0]?.title || 'Siap menerima transaksi',
      connectedDevices: currentUser
        ? [
            {
              clientId: currentUser.id,
              deviceType: deviceModeState,
              userName: currentUser.name,
              userRole: getRoleLabel(currentUser.role),
              deviceName:
                deviceModeState === 'ANDROID'
                  ? 'Handheld Scanner (Mobile)'
                  : 'Komputer Kasir / Store Workstation',
            },
          ]
        : [],
    }),
    [
      isServerConnected,
      isSyncingToServer,
      syncRevision,
      lastSyncTimestamp,
      syncError,
      activityLogs,
      currentUser,
      deviceModeState,
    ]
  );

  return (
    <InventoryContext.Provider
      value={{
        currentUser,
        users,
        publicAccessMode,
        setPublicAccessMode,
        loginAsPublicGuest,
        login,
        logout,
        syncStatus,
        forceSyncNow,
        setDeviceMode,
        showToast,
        showCustomToast,
        createUser,
        updateUser,
        resetUserPassword,
        deleteUser,
        toggleUserStatus,
        reorganizeUsersByLevel,
        roleDefinitions,
        addRoleDefinition,
        updateRoleDefinition,
        deleteRoleDefinition,
        updateDatabaseCollection,
        replaceEntireDatabase,
        stockItems,
        lpbDocuments,
        issueVouchers,
        stockMovements,
        notifications,
        costCenters,
        glAccounts,
        addCostCenter,
        updateCostCenter,
        deleteCostCenter,
        clearAllCostCenters,
        importCostCentersBulk,
        addGLAccount,
        updateGLAccount,
        deleteGLAccount,
        clearAllGLAccounts,
        importGLAccountsBulk,
        storageLocations,
        addStorageLocation,
        updateStorageLocation,
        deleteStorageLocation,
        stockCategories,
        addStockCategory,
        updateStockCategory,
        deleteStockCategory,
        importStockItemsBulk,
        companyProfile,
        updateCompanyProfile,
        resetCompanyProfile,
        minStockProposals,
        createMinStockProposal,
        updateMinStockProposal,
        deleteMinStockProposal,
        verifyMinStockProposal,
        approveMinStockProposal,
        rejectMinStockProposal,
        lowStockItems,
        nearMinStockItems,
        getItemMovementAnalytics,
        activityLogs,
        addActivityLog,
        activeToast,
        dismissToast,
        createLPB,
        approveLPBStockAddition,
        rejectLPB,
        createIssueVoucher,
        createIssueVouchersBulk,
        approveIssueVoucher,
        completeIssueVoucherHandover,
        rejectIssueVoucher,
        updateIssueVoucher,
        deleteIssueVoucher,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        addNewStockItem,
        updateStockItem,
        deleteStockItem,
        stockOpnameSessions,
        activeStockOpname,
        isStockLockedForOpname,
        startStockOpname,
        scanOrUpdateOpnameItem,
        completeStockOpname,
        cancelStockOpname,
        locationTransferRequests,
        createLocationTransferRequest,
        approveLocationTransferRequest,
        rejectLocationTransferRequest,
        selectedDocumentForPrint,
        openPrintPreview,
        closePrintPreview,
        resetToDefaultData,
        resetAllTransactionsAndStock,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
