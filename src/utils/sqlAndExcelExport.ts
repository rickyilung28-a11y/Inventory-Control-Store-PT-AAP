import * as XLSX from 'xlsx';
import {
  StockItem,
  StorageLocation,
  CostCenterEntry,
  GLAccountEntry,
  LPBDocument,
  IssueVoucherDocument,
  StockMovement,
  MinStockProposal,
  CompanyProfile,
  SystemActivityLog,
  AppNotification,
  UserAccount,
  RoleLevelDefinition,
  StockOpnameSession,
  LocationTransferRequest,
} from '../types/inventory';

export interface FullDatabaseSnapshot {
  [key: string]: unknown;
  exportedAt?: string;
  exportedBy?: string;
  version?: number;
  roleDefinitions?: RoleLevelDefinition[];
  users?: UserAccount[];
  stockItems?: StockItem[];
  lpbDocuments?: LPBDocument[];
  issueVouchers?: IssueVoucherDocument[];
  stockMovements?: StockMovement[];
  minStockProposals?: MinStockProposal[];
  stockOpnameSessions?: StockOpnameSession[];
  locationTransferRequests?: LocationTransferRequest[];
  costCenters?: CostCenterEntry[];
  glAccounts?: GLAccountEntry[];
  storageLocations?: StorageLocation[];
  companyProfile?: CompanyProfile;
  activityLogs?: SystemActivityLog[];
  notifications?: AppNotification[];
}

function escapeSqlString(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  if (typeof val === 'boolean') return val ? '1' : '0';
  const str = typeof val === 'string' ? val : JSON.stringify(val);
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Generates a portable SQL Dump (.sql) compatible with SQLite / MySQL / PostgreSQL
 * for self-hosted server deployment and full database backup/restore.
 */
export function generateSqlDump(snapshot: FullDatabaseSnapshot): string {
  const now = snapshot.exportedAt || new Date().toISOString();
  const lines: string[] = [];

  lines.push('-- ============================================================================');
  lines.push('-- STORE INVENTORY ENTERPRISE - SQL DATABASE BACKUP & SYNC DUMP');
  lines.push(`-- Generated At : ${now}`);
  lines.push(`-- Exported By  : ${snapshot.exportedBy || 'system'}`);
  lines.push(`-- Revision     : ${snapshot.version ?? 1}`);
  lines.push('-- Compatible   : SQLite 3 / MySQL 8 / MariaDB / PostgreSQL (Self-Hosted Server)');
  lines.push('-- ============================================================================');
  lines.push('');
  lines.push('BEGIN TRANSACTION;');
  lines.push('');

  // 1. Metadata & Snapshot table for lossless restore
  lines.push('CREATE TABLE IF NOT EXISTS store_database_snapshots (');
  lines.push('  id INTEGER PRIMARY KEY,');
  lines.push('  version INTEGER NOT NULL,');
  lines.push('  exported_at TEXT NOT NULL,');
  lines.push('  exported_by TEXT,');
  lines.push('  payload_json TEXT NOT NULL');
  lines.push(');');
  lines.push('DELETE FROM store_database_snapshots;');
  lines.push(
    `INSERT INTO store_database_snapshots (id, version, exported_at, exported_by, payload_json) VALUES (1, ${
      snapshot.version ?? 1
    }, ${escapeSqlString(now)}, ${escapeSqlString(snapshot.exportedBy || 'system')}, ${escapeSqlString(
      JSON.stringify(snapshot)
    )});`
  );
  lines.push('');

  // 2. Role Definitions table
  lines.push('CREATE TABLE IF NOT EXISTS role_definitions (');
  lines.push('  role_key VARCHAR(64) PRIMARY KEY,');
  lines.push('  level_number INTEGER NOT NULL,');
  lines.push('  name VARCHAR(128) NOT NULL,');
  lines.push('  badge_label VARCHAR(128),');
  lines.push('  description TEXT,');
  lines.push('  color_theme VARCHAR(32),');
  lines.push('  is_system_default INTEGER DEFAULT 0,');
  lines.push('  default_permissions_json TEXT');
  lines.push(');');
  lines.push('DELETE FROM role_definitions;');
  (snapshot.roleDefinitions || []).forEach((r) => {
    lines.push(
      `INSERT INTO role_definitions (role_key, level_number, name, badge_label, description, color_theme, is_system_default, default_permissions_json) VALUES (${escapeSqlString(
        r.roleKey
      )}, ${escapeSqlString(r.levelNumber)}, ${escapeSqlString(r.name)}, ${escapeSqlString(
        r.badgeLabel
      )}, ${escapeSqlString(r.description)}, ${escapeSqlString(r.colorTheme)}, ${escapeSqlString(
        Boolean(r.isSystemDefault)
      )}, ${escapeSqlString(JSON.stringify(r.defaultPermissions || {}))});`
    );
  });
  lines.push('');

  // 3. Users table
  lines.push('CREATE TABLE IF NOT EXISTS users (');
  lines.push('  id VARCHAR(64) PRIMARY KEY,');
  lines.push('  username VARCHAR(64) NOT NULL UNIQUE,');
  lines.push('  password VARCHAR(128) NOT NULL,');
  lines.push('  name VARCHAR(128) NOT NULL,');
  lines.push('  role VARCHAR(64) NOT NULL,');
  lines.push('  department VARCHAR(128),');
  lines.push('  is_active INTEGER DEFAULT 1,');
  lines.push('  permissions_json TEXT');
  lines.push(');');
  lines.push('DELETE FROM users;');
  (snapshot.users || []).forEach((u) => {
    lines.push(
      `INSERT INTO users (id, username, password, name, role, department, is_active, permissions_json) VALUES (${escapeSqlString(
        u.id
      )}, ${escapeSqlString(u.username)}, ${escapeSqlString(u.password || '')}, ${escapeSqlString(
        u.name
      )}, ${escapeSqlString(u.role)}, ${escapeSqlString(u.department)}, ${escapeSqlString(
        u.isActive !== false
      )}, ${escapeSqlString(JSON.stringify(u.permissions || {}))});`
    );
  });
  lines.push('');

  // 4. Master Stock Items table
  lines.push('CREATE TABLE IF NOT EXISTS stock_items (');
  lines.push('  id VARCHAR(64) PRIMARY KEY,');
  lines.push('  sku VARCHAR(64) NOT NULL UNIQUE,');
  lines.push('  name VARCHAR(255) NOT NULL,');
  lines.push('  category VARCHAR(128),');
  lines.push('  unit VARCHAR(32),');
  lines.push('  current_stock NUMERIC DEFAULT 0,');
  lines.push('  allocated_stock NUMERIC DEFAULT 0,');
  lines.push('  min_stock NUMERIC DEFAULT 0,');
  lines.push('  location VARCHAR(128),');
  lines.push('  description TEXT,');
  lines.push('  updated_at VARCHAR(64)');
  lines.push(');');
  lines.push('DELETE FROM stock_items;');
  (snapshot.stockItems || []).forEach((item) => {
    lines.push(
      `INSERT INTO stock_items (id, sku, name, category, unit, current_stock, allocated_stock, min_stock, location, description, updated_at) VALUES (${escapeSqlString(
        item.id
      )}, ${escapeSqlString(item.sku)}, ${escapeSqlString(item.name)}, ${escapeSqlString(
        item.category
      )}, ${escapeSqlString(item.unit)}, ${escapeSqlString(item.currentStock)}, ${escapeSqlString(
        item.allocatedStock
      )}, ${escapeSqlString(item.minStock)}, ${escapeSqlString(item.location)}, ${escapeSqlString(
        item.description || ''
      )}, ${escapeSqlString(item.updatedAt || '')});`
    );
  });
  lines.push('');

  // 5. Storage Locations table
  lines.push('CREATE TABLE IF NOT EXISTS storage_locations (');
  lines.push('  id VARCHAR(64) PRIMARY KEY,');
  lines.push('  code VARCHAR(64) NOT NULL UNIQUE,');
  lines.push('  name VARCHAR(128) NOT NULL,');
  lines.push('  zone VARCHAR(128),');
  lines.push('  description TEXT');
  lines.push(');');
  lines.push('DELETE FROM storage_locations;');
  (snapshot.storageLocations || []).forEach((loc) => {
    lines.push(
      `INSERT INTO storage_locations (id, code, name, zone, description) VALUES (${escapeSqlString(
        loc.id
      )}, ${escapeSqlString(loc.code)}, ${escapeSqlString(loc.name)}, ${escapeSqlString(
        loc.zone || ''
      )}, ${escapeSqlString(loc.description || '')});`
    );
  });
  lines.push('');

  // 6. Cost Centers table
  lines.push('CREATE TABLE IF NOT EXISTS cost_centers (');
  lines.push('  code VARCHAR(64) PRIMARY KEY,');
  lines.push('  name VARCHAR(128) NOT NULL,');
  lines.push('  description TEXT');
  lines.push(');');
  lines.push('DELETE FROM cost_centers;');
  (snapshot.costCenters || []).forEach((cc) => {
    lines.push(
      `INSERT INTO cost_centers (code, name, description) VALUES (${escapeSqlString(
        cc.code
      )}, ${escapeSqlString(cc.name)}, ${escapeSqlString(cc.description || '')});`
    );
  });
  lines.push('');

  // 7. GL Accounts table
  lines.push('CREATE TABLE IF NOT EXISTS gl_accounts (');
  lines.push('  code VARCHAR(64) PRIMARY KEY,');
  lines.push('  name VARCHAR(128) NOT NULL,');
  lines.push('  description TEXT');
  lines.push(');');
  lines.push('DELETE FROM gl_accounts;');
  (snapshot.glAccounts || []).forEach((gl) => {
    lines.push(
      `INSERT INTO gl_accounts (code, name, description) VALUES (${escapeSqlString(
        gl.code
      )}, ${escapeSqlString(gl.name)}, ${escapeSqlString(gl.description || '')});`
    );
  });
  lines.push('');

  // 8. LPB Documents table
  lines.push('CREATE TABLE IF NOT EXISTS lpb_documents (');
  lines.push('  id VARCHAR(64) PRIMARY KEY,');
  lines.push('  lpb_number VARCHAR(64) NOT NULL,');
  lines.push('  po_number VARCHAR(64),');
  lines.push('  delivery_note_number VARCHAR(64),');
  lines.push('  supplier_name VARCHAR(128),');
  lines.push('  received_date VARCHAR(64),');
  lines.push('  status VARCHAR(32),');
  lines.push('  created_by VARCHAR(128),');
  lines.push('  approved_by VARCHAR(128),');
  lines.push('  items_json TEXT,');
  lines.push('  raw_json TEXT');
  lines.push(');');
  lines.push('DELETE FROM lpb_documents;');
  (snapshot.lpbDocuments || []).forEach((lpb) => {
    lines.push(
      `INSERT INTO lpb_documents (id, lpb_number, po_number, delivery_note_number, supplier_name, received_date, status, created_by, approved_by, items_json, raw_json) VALUES (${escapeSqlString(
        lpb.id
      )}, ${escapeSqlString(lpb.lpbNumber)}, ${escapeSqlString(lpb.poNumber || '')}, ${escapeSqlString(
        lpb.sjNumber
      )}, ${escapeSqlString(lpb.supplierName)}, ${escapeSqlString(
        lpb.receivedDate
      )}, ${escapeSqlString(lpb.status || 'APPROVED')}, ${escapeSqlString(lpb.receivedByAdmin)}, ${escapeSqlString(
        lpb.approvedByWarehouseHead || ''
      )}, ${escapeSqlString(JSON.stringify(lpb.items || []))}, ${escapeSqlString(
        JSON.stringify(lpb)
      )});`
    );
  });
  lines.push('');

  // 9. Issue Vouchers (SIV) table
  lines.push('CREATE TABLE IF NOT EXISTS issue_vouchers (');
  lines.push('  id VARCHAR(64) PRIMARY KEY,');
  lines.push('  voucher_number VARCHAR(64) NOT NULL,');
  lines.push('  requester_name VARCHAR(128),');
  lines.push('  department VARCHAR(128),');
  lines.push('  cost_center VARCHAR(64),');
  lines.push('  gl_account VARCHAR(64),');
  lines.push('  status VARCHAR(32),');
  lines.push('  request_date VARCHAR(64),');
  lines.push('  items_json TEXT,');
  lines.push('  raw_json TEXT');
  lines.push(');');
  lines.push('DELETE FROM issue_vouchers;');
  (snapshot.issueVouchers || []).forEach((siv) => {
    lines.push(
      `INSERT INTO issue_vouchers (id, voucher_number, requester_name, department, cost_center, gl_account, status, request_date, items_json, raw_json) VALUES (${escapeSqlString(
        siv.id
      )}, ${escapeSqlString(siv.voucherNumber)}, ${escapeSqlString(
        siv.requestedBy
      )}, ${escapeSqlString(siv.department)}, ${escapeSqlString(
        siv.costCenter || ''
      )}, ${escapeSqlString(siv.glAccount || '')}, ${escapeSqlString(siv.status)}, ${escapeSqlString(
        siv.requestDate
      )}, ${escapeSqlString(JSON.stringify(siv.items || []))}, ${escapeSqlString(
        JSON.stringify(siv)
      )});`
    );
  });
  lines.push('');

  // 10. Stock Movements (Kartu Stok) table
  lines.push('CREATE TABLE IF NOT EXISTS stock_movements (');
  lines.push('  id VARCHAR(64) PRIMARY KEY,');
  lines.push('  date VARCHAR(64),');
  lines.push('  type VARCHAR(16),');
  lines.push('  reference_number VARCHAR(64),');
  lines.push('  item_id VARCHAR(64),');
  lines.push('  item_sku VARCHAR(64),');
  lines.push('  item_name VARCHAR(255),');
  lines.push('  quantity NUMERIC,');
  lines.push('  balance_after NUMERIC,');
  lines.push('  performed_by VARCHAR(128),');
  lines.push('  notes TEXT,');
  lines.push('  raw_json TEXT');
  lines.push(');');
  lines.push('DELETE FROM stock_movements;');
  (snapshot.stockMovements || []).forEach((mv) => {
    lines.push(
      `INSERT INTO stock_movements (id, date, type, reference_number, item_id, item_sku, item_name, quantity, balance_after, performed_by, notes, raw_json) VALUES (${escapeSqlString(
        mv.id
      )}, ${escapeSqlString(mv.date)}, ${escapeSqlString(mv.type)}, ${escapeSqlString(
        mv.referenceNumber
      )}, ${escapeSqlString(mv.itemId)}, ${escapeSqlString(mv.sku)}, ${escapeSqlString(
        mv.itemName
      )}, ${escapeSqlString(mv.quantity)}, ${escapeSqlString(mv.balanceAfter)}, ${escapeSqlString(
        mv.actor
      )}, ${escapeSqlString(mv.notes || '')}, ${escapeSqlString(JSON.stringify(mv))});`
    );
  });
  lines.push('');

  // 11. Stock Opname Sessions table
  lines.push('CREATE TABLE IF NOT EXISTS stock_opname_sessions (');
  lines.push('  id VARCHAR(64) PRIMARY KEY,');
  lines.push('  opname_number VARCHAR(64) NOT NULL,');
  lines.push('  title VARCHAR(255),');
  lines.push('  status VARCHAR(32),');
  lines.push('  started_at VARCHAR(64),');
  lines.push('  started_by VARCHAR(128),');
  lines.push('  completed_at VARCHAR(64),');
  lines.push('  completed_by VARCHAR(128),');
  lines.push('  raw_json TEXT');
  lines.push(');');
  lines.push('DELETE FROM stock_opname_sessions;');
  (snapshot.stockOpnameSessions || []).forEach((so) => {
    lines.push(
      `INSERT INTO stock_opname_sessions (id, opname_number, title, status, started_at, started_by, completed_at, completed_by, raw_json) VALUES (${escapeSqlString(
        so.id
      )}, ${escapeSqlString(so.opnameNumber)}, ${escapeSqlString(so.title)}, ${escapeSqlString(
        so.status
      )}, ${escapeSqlString(so.startedAt)}, ${escapeSqlString(so.startedBy)}, ${escapeSqlString(
        so.completedAt || ''
      )}, ${escapeSqlString(so.completedBy || '')}, ${escapeSqlString(JSON.stringify(so))});`
    );
  });
  lines.push('');

  // 12. Min Stock Proposals table
  lines.push('CREATE TABLE IF NOT EXISTS min_stock_proposals (');
  lines.push('  id VARCHAR(64) PRIMARY KEY,');
  lines.push('  proposal_number VARCHAR(64),');
  lines.push('  item_sku VARCHAR(64),');
  lines.push('  item_name VARCHAR(255),');
  lines.push('  current_min_stock NUMERIC,');
  lines.push('  proposed_min_stock NUMERIC,');
  lines.push('  status VARCHAR(32),');
  lines.push('  raw_json TEXT');
  lines.push(');');
  lines.push('DELETE FROM min_stock_proposals;');
  (snapshot.minStockProposals || []).forEach((mp) => {
    lines.push(
      `INSERT INTO min_stock_proposals (id, proposal_number, item_sku, item_name, current_min_stock, proposed_min_stock, status, raw_json) VALUES (${escapeSqlString(
        mp.id
      )}, ${escapeSqlString(mp.proposalNumber)}, ${escapeSqlString(
        mp.sku
      )}, ${escapeSqlString(mp.itemName)}, ${escapeSqlString(
        mp.currentMinStock
      )}, ${escapeSqlString(mp.proposedMinStock)}, ${escapeSqlString(
        mp.status
      )}, ${escapeSqlString(JSON.stringify(mp))});`
    );
  });
  lines.push('');

  // 13. Activity Logs table
  lines.push('CREATE TABLE IF NOT EXISTS activity_logs (');
  lines.push('  id VARCHAR(64) PRIMARY KEY,');
  lines.push('  timestamp VARCHAR(64),');
  lines.push('  actor_username VARCHAR(64),');
  lines.push('  actor_name VARCHAR(128),');
  lines.push('  actor_role VARCHAR(64),');
  lines.push('  category VARCHAR(64),');
  lines.push('  action_title VARCHAR(255),');
  lines.push('  description TEXT,');
  lines.push('  raw_json TEXT');
  lines.push(');');
  lines.push('DELETE FROM activity_logs;');
  (snapshot.activityLogs || []).forEach((log) => {
    lines.push(
      `INSERT INTO activity_logs (id, timestamp, actor_username, actor_name, actor_role, category, action_title, description, raw_json) VALUES (${escapeSqlString(
        log.id
      )}, ${escapeSqlString(log.timestamp)}, ${escapeSqlString(
        log.actorUsername || ''
      )}, ${escapeSqlString(log.actorName)}, ${escapeSqlString(
        log.actorRole
      )}, ${escapeSqlString(log.category)}, ${escapeSqlString(
        log.title
      )}, ${escapeSqlString(log.description)}, ${escapeSqlString(JSON.stringify(log))});`
    );
  });
  lines.push('');

  lines.push('COMMIT;');
  return lines.join('\n');
}

/**
 * Parses a .sql dump file or JSON string back into a FullDatabaseSnapshot
 */
export function parseSqlDumpToSnapshot(sqlContent: string): FullDatabaseSnapshot | null {
  const trimmed = sqlContent.trim();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as FullDatabaseSnapshot;
    } catch {
      return null;
    }
  }

  // Extract from INSERT INTO store_database_snapshots
  const snapshotRegex =
    /INSERT\s+INTO\s+store_database_snapshots\s*\([^)]+\)\s*VALUES\s*\(\s*1\s*,\s*\d+\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'((?:[^']|'')*)'\s*\)\s*;/i;
  const match = sqlContent.match(snapshotRegex);
  if (match && match[1]) {
    try {
      const unescapedJson = match[1].replace(/''/g, "'");
      return JSON.parse(unescapedJson) as FullDatabaseSnapshot;
    } catch (e) {
      console.warn('Failed to parse snapshot JSON from SQL dump:', e);
    }
  }

  // Fallback: parse individual SQL INSERT statements if generated externally
  const result: FullDatabaseSnapshot = {};
  let foundAny = false;

  const parseSqlValuesTuple = (tupleStr: string): string[] => {
    const values: string[] = [];
    let i = 0;
    const n = tupleStr.length;
    while (i < n) {
      while (i < n && (tupleStr[i] === ' ' || tupleStr[i] === ',' || tupleStr[i] === '\n' || tupleStr[i] === '\r')) {
        i++;
      }
      if (i >= n) break;
      if (tupleStr[i] === "'") {
        i++;
        let acc = '';
        while (i < n) {
          if (tupleStr[i] === "'" && i + 1 < n && tupleStr[i + 1] === "'") {
            acc += "'";
            i += 2;
          } else if (tupleStr[i] === "'") {
            i++;
            break;
          } else {
            acc += tupleStr[i];
            i++;
          }
        }
        values.push(acc);
      } else {
        let acc = '';
        while (i < n && tupleStr[i] !== ',') {
          acc += tupleStr[i];
          i++;
        }
        values.push(acc.trim());
      }
    }
    return values;
  };

  const stockInsertRegex =
    /INSERT\s+INTO\s+stock_items\s*\([^)]+\)\s*VALUES\s*\(([\s\S]*?)\)\s*;/gi;
  let m: RegExpExecArray | null;
  const parsedStock: StockItem[] = [];
  while ((m = stockInsertRegex.exec(sqlContent)) !== null) {
    const vals = parseSqlValuesTuple(m[1]);
    if (vals.length >= 10) {
      foundAny = true;
      parsedStock.push({
        id: vals[0],
        sku: vals[1],
        name: vals[2],
        category: vals[3],
        unit: vals[4],
        currentStock: Number(vals[5]) || 0,
        allocatedStock: Number(vals[6]) || 0,
        minStock: Number(vals[7]) || 0,
        location: vals[8],
        description: vals[9],
        updatedAt: vals[10] || new Date().toISOString(),
      });
    }
  }
  if (parsedStock.length > 0) result.stockItems = parsedStock;

  const locInsertRegex =
    /INSERT\s+INTO\s+storage_locations\s*\([^)]+\)\s*VALUES\s*\(([\s\S]*?)\)\s*;/gi;
  const parsedLocs: StorageLocation[] = [];
  while ((m = locInsertRegex.exec(sqlContent)) !== null) {
    const vals = parseSqlValuesTuple(m[1]);
    if (vals.length >= 4) {
      foundAny = true;
      parsedLocs.push({
        id: vals[0],
        code: vals[1],
        name: vals[2],
        zone: vals[3],
        description: vals[4] || '',
      });
    }
  }
  if (parsedLocs.length > 0) result.storageLocations = parsedLocs;

  const ccInsertRegex =
    /INSERT\s+INTO\s+cost_centers\s*\([^)]+\)\s*VALUES\s*\(([\s\S]*?)\)\s*;/gi;
  const parsedCC: CostCenterEntry[] = [];
  while ((m = ccInsertRegex.exec(sqlContent)) !== null) {
    const vals = parseSqlValuesTuple(m[1]);
    if (vals.length >= 2) {
      foundAny = true;
      parsedCC.push({
        code: vals[0],
        name: vals[1],
        description: vals[2] || '',
      });
    }
  }
  if (parsedCC.length > 0) result.costCenters = parsedCC;

  const glInsertRegex =
    /INSERT\s+INTO\s+gl_accounts\s*\([^)]+\)\s*VALUES\s*\(([\s\S]*?)\)\s*;/gi;
  const parsedGL: GLAccountEntry[] = [];
  while ((m = glInsertRegex.exec(sqlContent)) !== null) {
    const vals = parseSqlValuesTuple(m[1]);
    if (vals.length >= 2) {
      foundAny = true;
      parsedGL.push({
        code: vals[0],
        name: vals[1],
        description: vals[2] || '',
      });
    }
  }
  if (parsedGL.length > 0) result.glAccounts = parsedGL;

  return foundAny ? result : null;
}

/**
 * Triggers a browser download of a .sql backup file
 */
export function downloadSqlBackupFile(snapshot: FullDatabaseSnapshot, filenamePrefix = 'backup-database-store') {
  const sqlText = generateSqlDump(snapshot);
  const blob = new Blob([sqlText], { type: 'application/sql;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.sql`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports Master Stock Items, Sub-Master Categories, and Storage Locations to an Excel (.xlsx) workbook
 */
export function exportStockMasterToExcel(
  stockItems: StockItem[],
  storageLocationsOrVelocity?:
    | StorageLocation[]
    | ((itemId: string, sku?: string) => unknown),
  getVelocityArg?: (itemId: string, sku?: string) => unknown
) {
  let storageLocations: StorageLocation[] = [];
  let getVelocity: ((itemId: string, sku?: string) => any) | undefined = getVelocityArg as any;

  if (typeof storageLocationsOrVelocity === 'function') {
    getVelocity = storageLocationsOrVelocity as any;
  } else if (Array.isArray(storageLocationsOrVelocity)) {
    storageLocations = storageLocationsOrVelocity;
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Master Stok Barang
  const masterRows = stockItems.map((item, idx) => {
    const available = Math.max(0, item.currentStock - item.allocatedStock);
    const buffer = Math.max(3, Math.round(item.minStock * 0.35));
    const stockStatus =
      item.currentStock <= item.minStock
        ? 'KRITIS (Melampaui Min)'
        : item.currentStock <= item.minStock + buffer
        ? 'MENIPIS (Mendekati Min)'
        : 'AMAN';
    const vel = getVelocity ? getVelocity(item.id) : null;
    const catKey = vel?.velocityCategory || vel?.category || 'LOW_MOVING';
    const velocityLabel =
      catKey === 'FAST_MOVING'
        ? 'Fast Moving'
        : catKey === 'MEDIUM_MOVING'
        ? 'Medium Moving'
        : 'Low Moving';

    return {
      No: idx + 1,
      'Material Code': item.sku,
      'Nama Barang': item.name,
      Kategori: item.category,
      'Lokasi Rak': item.location,
      'Stok Fisik': item.currentStock,
      'Alokasi SIV': item.allocatedStock,
      'Stok Tersedia': available,
      'Stok Minimal (Safety Stock)': item.minStock,
      Satuan: item.unit,
      'Status Saldo Stok': stockStatus,
      'Kategori Pergerakan': velocityLabel,
      'Total Qty Keluar': vel?.totalOutQty ?? 0,
      'Frekuensi Keluar (x)': vel?.outFrequency ?? vel?.outboundFrequency ?? 0,
      Keterangan: item.description || '-',
      'Update Terakhir': item.updatedAt
        ? new Date(item.updatedAt).toLocaleString('id-ID')
        : '-',
    };
  });

  const wsMaster = XLSX.utils.json_to_sheet(masterRows);
  wsMaster['!cols'] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 34 },
    { wch: 22 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 22 },
    { wch: 10 },
    { wch: 24 },
    { wch: 18 },
    { wch: 15 },
    { wch: 18 },
    { wch: 30 },
    { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMaster, 'Master Stok Barang');

  // Sheet 2: Rekap Sub-Master Kategori
  const categoryMap = new Map<string, StockItem[]>();
  stockItems.forEach((item) => {
    const list = categoryMap.get(item.category) || [];
    list.push(item);
    categoryMap.set(item.category, list);
  });

  const subMasterRows: Record<string, unknown>[] = [];
  Array.from(categoryMap.entries()).forEach(([category, items]) => {
    items.forEach((it, idx) => {
      subMasterRows.push({
        'Sub-Master Kategori': category,
        'No Urut Kategori': idx + 1,
        'Material Code': it.sku,
        'Nama Barang': it.name,
        'Lokasi Rak': it.location,
        'Stok Fisik': it.currentStock,
        'Stok Minimal': it.minStock,
        Satuan: it.unit,
      });
    });
  });

  const wsSubMaster = XLSX.utils.json_to_sheet(subMasterRows);
  wsSubMaster['!cols'] = [
    { wch: 24 },
    { wch: 16 },
    { wch: 18 },
    { wch: 34 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSubMaster, 'Sub-Master Kategori');

  // Sheet 3: Master Lokasi Rak Store
  if (storageLocations.length > 0) {
    const locRows = storageLocations.map((loc, idx) => {
      const countInRack = stockItems.filter(
        (i) =>
          i.location.trim().toLowerCase() === loc.code.trim().toLowerCase() ||
          i.location.trim().toLowerCase() === loc.name.trim().toLowerCase()
      ).length;
      return {
        No: idx + 1,
        'Kode Rak': loc.code,
        'Nama Lokasi / Rak': loc.name,
        'Zona Store': loc.zone || '-',
        'Jumlah Material Barang': countInRack,
        Deskripsi: loc.description || '-',
      };
    });
    const wsLoc = XLSX.utils.json_to_sheet(locRows);
    wsLoc['!cols'] = [
      { wch: 5 },
      { wch: 16 },
      { wch: 28 },
      { wch: 24 },
      { wch: 18 },
      { wch: 32 },
    ];
    XLSX.utils.book_append_sheet(wb, wsLoc, 'Master Lokasi Rak');
  }

  XLSX.writeFile(wb, `Master_Stok_Store_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports Storage Locations & Rack Sub-Master to Excel (.xlsx)
 */
export function exportStorageLocationsToExcel(
  storageLocations: StorageLocation[],
  stockItems: StockItem[]
) {
  const wb = XLSX.utils.book_new();

  const rows = storageLocations.map((loc, idx) => {
    const rackItems = stockItems.filter(
      (i) =>
        i.location.trim().toLowerCase() === loc.code.trim().toLowerCase() ||
        i.location.trim().toLowerCase() === loc.name.trim().toLowerCase()
    );
    return {
      No: idx + 1,
      'Kode Rak': loc.code,
      'Nama Lokasi / Rak': loc.name,
      'Zona Store': loc.zone || '-',
      'Jumlah Item Material': rackItems.length,
      'Daftar Barang (Material Code & Stok Min)':
        rackItems
          .map(
            (r) =>
              `${r.sku} (${r.name} - Stok: ${r.currentStock}, Min: ${r.minStock} ${r.unit})`
          )
          .join('; ') || 'Kosong',
      Keterangan: loc.description || '-',
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 5 },
    { wch: 16 },
    { wch: 28 },
    { wch: 24 },
    { wch: 16 },
    { wch: 60 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Master Lokasi Rak Store');

  XLSX.writeFile(wb, `Master_Lokasi_Rak_Store_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports Master Cost Centers & GL Accounts to Excel (.xlsx)
 */
export function exportCostCenterGLToExcel(
  costCenters: CostCenterEntry[],
  glAccounts: GLAccountEntry[]
) {
  const wb = XLSX.utils.book_new();

  const ccRows = costCenters.map((c, idx) => ({
    No: idx + 1,
    'Kode Cost Center': c.code,
    'Nama Cost Center': c.name,
    Deskripsi: c.description || '-',
  }));
  const wsCC = XLSX.utils.json_to_sheet(ccRows);
  wsCC['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 32 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsCC, 'Cost Center');

  const glRows = glAccounts.map((g, idx) => ({
    No: idx + 1,
    'Nomor GL Account': g.code,
    'Nama Perkiraan GL Account': g.name,
    Deskripsi: g.description || '-',
  }));
  const wsGL = XLSX.utils.json_to_sheet(glRows);
  wsGL['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 32 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsGL, 'GL Account');

  XLSX.writeFile(wb, `Master_CostCenter_GL_Store_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports a Stock Opname Session to Excel (.xlsx)
 */
export function exportStockOpnameToExcel(session: StockOpnameSession) {
  const wb = XLSX.utils.book_new();

  const rows = session.items.map((item, idx) => ({
    No: idx + 1,
    'Nomor Opname': session.opnameNumber,
    'Material Code': item.sku,
    'Nama Barang': item.itemName,
    Kategori: item.category,
    'Lokasi Rak': item.location,
    Satuan: item.unit,
    'Stok Sistem (Saat Lock)': item.systemStockSnapshot,
    'Stok Fisik Aktual': item.physicalStock !== null ? item.physicalStock : 'Belum Dihitung',
    'Selisih (Variance)': item.isCounted ? item.variance : 0,
    'Status Hitung': item.isCounted ? 'Sudah Dihitung' : 'Belum Dihitung',
    'Validasi Scan Barcode': item.barcodeScanned ? 'Ya (Scanned)' : 'Manual',
    'Petugas Hitung': item.countedBy || '-',
    'Waktu Scan Terakhir': item.lastScannedAt
      ? new Date(item.lastScannedAt).toLocaleString('id-ID')
      : '-',
    Catatan: item.notes || '-',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 18 },
    { wch: 32 },
    { wch: 20 },
    { wch: 15 },
    { wch: 10 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Hasil Stock Opname');

  XLSX.writeFile(wb, `Stock_Opname_${session.opnameNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Exports the entire Master & Transaction Database into a single Multi-Sheet Excel (.xlsx)
 */
export function exportAllMasterDatabaseToExcel(snapshot: FullDatabaseSnapshot) {
  const wb = XLSX.utils.book_new();

  const appendSafeSheet = (sheetName: string, data: unknown[]) => {
    const cleanRows = (data || []).map((row, idx) => {
      if (!row || typeof row !== 'object') return { No: idx + 1, Value: String(row) };
      const flat: Record<string, unknown> = { No: idx + 1 };
      Object.entries(row as Record<string, unknown>).forEach(([k, v]) => {
        if (v !== null && typeof v === 'object') {
          flat[k] = JSON.stringify(v);
        } else {
          flat[k] = v ?? '';
        }
      });
      return flat;
    });
    const ws = XLSX.utils.json_to_sheet(
      cleanRows.length > 0 ? cleanRows : [{ Info: 'Tidak ada data' }]
    );
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  };

  appendSafeSheet('1_Master_Stok_Barang', snapshot.stockItems || []);
  appendSafeSheet('2_Lokasi_Rak_Store', snapshot.storageLocations || []);
  appendSafeSheet('3_Cost_Center', snapshot.costCenters || []);
  appendSafeSheet('4_GL_Account', snapshot.glAccounts || []);
  appendSafeSheet('5_Kategori_Level', snapshot.roleDefinitions || []);
  appendSafeSheet(
    '6_Database_User',
    (snapshot.users || []).map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      role: u.role,
      department: u.department,
      isActive: u.isActive,
      permissions: JSON.stringify(u.permissions || {}),
    }))
  );
  appendSafeSheet('7_Dokumen_LPB', snapshot.lpbDocuments || []);
  appendSafeSheet('8_Dokumen_SIV', snapshot.issueVouchers || []);
  appendSafeSheet('9_Kartu_Stok_Mutasi', snapshot.stockMovements || []);
  appendSafeSheet('10_Stock_Opname', snapshot.stockOpnameSessions || []);
  appendSafeSheet('11_Pengajuan_Stok_Min', snapshot.minStockProposals || []);
  appendSafeSheet(
    '12_Profil_Perusahaan',
    snapshot.companyProfile ? [snapshot.companyProfile] : []
  );
  appendSafeSheet('13_Audit_Log', snapshot.activityLogs || []);

  XLSX.writeFile(wb, `Full_Master_Database_Store_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
