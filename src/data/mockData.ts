import {
  UserAccount,
  StockItem,
  LPBDocument,
  IssueVoucherDocument,
  StockMovement,
  AppNotification,
  CostCenterEntry,
  GLAccountEntry,
  StorageLocation,
  CompanyProfile,
  MinStockProposal,
  SystemActivityLog,
} from '../types/inventory';
import defaultSnapshotRaw from './defaultDatabaseSnapshot.json';

const defaultSnapshot = defaultSnapshotRaw as {
  companyProfile?: CompanyProfile;
  storageLocations?: StorageLocation[];
  costCenters?: CostCenterEntry[];
  glAccounts?: GLAccountEntry[];
  users?: UserAccount[];
  stockItems?: StockItem[];
  lpbDocuments?: LPBDocument[];
  issueVouchers?: IssueVoucherDocument[];
  stockMovements?: StockMovement[];
  notifications?: AppNotification[];
  minStockProposals?: MinStockProposal[];
  activityLogs?: SystemActivityLog[];
};

export const INITIAL_COMPANY_PROFILE: CompanyProfile = defaultSnapshot.companyProfile || {
  appName: 'SISTEM INVENTORY CONTROL STORE',
  appTagline: 'PT ABADI AGROSINDO PERSADA',
  companyName: 'PT ABADI AGROSINDO PERSADA',
  city: 'Sidoarjo',
  address: 'Bakungtemenggungan Kec. Balongbendo Sidoarjo - Jawa Timur',
  phone: '',
  email: '',
  logoUrl: '/logo-aap.svg',
  sivDocCode: 'FR/AAP/G-STR/23/001',
  lpbDocCode: 'FR/AAP/G-LPB/23/002',
};

export const INITIAL_STORAGE_LOCATIONS: StorageLocation[] =
  defaultSnapshot.storageLocations || [];

export const INITIAL_COST_CENTERS: CostCenterEntry[] = defaultSnapshot.costCenters || [
  { code: 'AAP1034001', name: 'SDA Production M1', description: 'Biaya Plant 1' },
  { code: 'AAP1034002', name: 'SDA Production M2', description: 'Biaya Plant 2' },
  { code: 'AAP1034003', name: 'SDA Production M3', description: 'Biaya Plant 3' },
  { code: 'AAP1034004', name: 'SDA Production M4', description: 'Biaya Plant 4' },
  { code: 'AAP1034005', name: 'SDA Production M5', description: 'Biaya Plant 5' },
  { code: 'AAP1034006', name: 'SDA Production M6', description: 'Biaya Plant 6' },
  {
    code: 'AAP1035000',
    name: 'SDA FOH',
    description: 'Biaya selain Plant, Workshop, Engineering, Lab, Store, GOH',
  },
  { code: 'AAP1035001', name: 'SDA FOH Workshop', description: 'Biaya Workshop' },
  {
    code: 'AAP1035002',
    name: 'SDA FOH Engine / Elec',
    description: 'Biaya Engineering (Electric / Mechanic)',
  },
  { code: 'AAP1035003', name: 'SDA FOH Spart Store', description: 'Biaya Store' },
  { code: 'AAP1035004', name: 'SDA FOH Laboratory', description: 'Biaya Lab' },
  { code: 'AAP1036000', name: 'GOH', description: 'Biaya Umum khusus GOH' },
];

export const INITIAL_GL_ACCOUNTS: GLAccountEntry[] = defaultSnapshot.glAccounts || [];

export const INITIAL_USERS: UserAccount[] = (defaultSnapshot.users || []).map((u) => ({
  ...u,
  id: u.id ? u.id.replace(/staff/gi, 'PIC') : u.id,
}));

export const INITIAL_STOCK_ITEMS: StockItem[] = defaultSnapshot.stockItems || [];

export const INITIAL_LPB_DOCUMENTS: LPBDocument[] = defaultSnapshot.lpbDocuments || [];

export const INITIAL_ISSUE_VOUCHERS: IssueVoucherDocument[] = (
  defaultSnapshot.issueVouchers || []
).map((v) => ({
  ...v,
  userId: v.userId ? v.userId.replace(/staff/gi, 'PIC') : v.userId,
}));

export const INITIAL_STOCK_MOVEMENTS: StockMovement[] =
  defaultSnapshot.stockMovements || [];

export const INITIAL_NOTIFICATIONS: AppNotification[] =
  defaultSnapshot.notifications || [];

export const INITIAL_MIN_STOCK_PROPOSALS: MinStockProposal[] =
  defaultSnapshot.minStockProposals || [];

export const INITIAL_ACTIVITY_LOGS: SystemActivityLog[] = (
  defaultSnapshot.activityLogs || []
).map((log) => ({
  ...log,
  actorId: log.actorId ? log.actorId.replace(/staff/gi, 'PIC') : log.actorId,
}));
