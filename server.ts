import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'shared-inventory-state.json');
const DEFAULT_STATE_FILE = path.join(DATA_DIR, 'default-inventory-state.json');
const BUNDLED_SNAPSHOT_FILE = path.join(__dirname, 'src', 'data', 'defaultDatabaseSnapshot.json');
const SQL_DUMP_FILE = path.join(DATA_DIR, 'store-inventory-database.sql');
const SQLITE_DB_FILE = path.join(DATA_DIR, 'store-inventory.sqlite');
const TUNNEL_URL_FILE = path.join(DATA_DIR, 'public-tunnel-url.txt');
const TUNNEL_LOG_FILE = '/tmp/cloudflared_persistent.log';
const PERMANENT_URL_FILE = path.join(DATA_DIR, 'permanent-login-url.txt');

let currentPublicTunnelUrl: string = '';


interface SharedServerState {
  [key: string]: unknown;
  updatedAt: string;
  version: number;
  exportedAt?: string;
  exportedBy?: string;
  stockItems?: Record<string, unknown>[];
  lpbDocuments?: Record<string, unknown>[];
  issueVouchers?: Record<string, unknown>[];
  stockMovements?: Record<string, unknown>[];
  notifications?: Record<string, unknown>[];
  costCenters?: Record<string, unknown>[];
  glAccounts?: Record<string, unknown>[];
  storageLocations?: Record<string, unknown>[];
  companyProfile?: unknown;
  minStockProposals?: Record<string, unknown>[];
  stockOpnameSessions?: Record<string, unknown>[];
  locationTransferRequests?: Record<string, unknown>[];
  activityLogs?: Record<string, unknown>[];
  users?: Record<string, unknown>[];
  roleDefinitions?: Record<string, unknown>[];
}

function escapeSqlString(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  if (typeof val === 'boolean') return val ? '1' : '0';
  const str = typeof val === 'string' ? val : JSON.stringify(val);
  return `'${str.replace(/'/g, "''")}'`;
}

function generateSqlDump(snapshot: Partial<SharedServerState>): string {
  const now = snapshot.exportedAt || snapshot.updatedAt || new Date().toISOString();
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

  lines.push('COMMIT;');
  return lines.join('\n');
}

function parseSqlDumpToSnapshot(sqlContent: string): Partial<SharedServerState> | null {
  const trimmed = sqlContent.trim();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed) as Partial<SharedServerState>;
    } catch {
      return null;
    }
  }

  const snapshotRegex =
    /INSERT\s+INTO\s+store_database_snapshots\s*\([^)]+\)\s*VALUES\s*\(\s*1\s*,\s*\d+\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'((?:[^']|'')*)'\s*\)\s*;/i;
  const match = sqlContent.match(snapshotRegex);
  if (match && match[1]) {
    try {
      const unescapedJson = match[1].replace(/''/g, "'");
      return JSON.parse(unescapedJson) as Partial<SharedServerState>;
    } catch (e) {
      console.warn('Failed to parse snapshot JSON from SQL dump:', e);
    }
  }
  return null;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

async function syncStateToSqlStorage(state: SharedServerState) {
  try {
    ensureDataDir();
    const sqlDump = generateSqlDump({
      ...state,
      exportedAt: state.updatedAt,
      exportedBy: 'sql-sync-engine',
      version: state.version,
    });
    fs.writeFileSync(SQL_DUMP_FILE, sqlDump, 'utf-8');

    try {
      const sqliteMod = await import('node:sqlite');
      if (sqliteMod && sqliteMod.DatabaseSync) {
        const db = new sqliteMod.DatabaseSync(SQLITE_DB_FILE);
        db.exec(sqlDump);
        db.close();
      }
    } catch {
      // Fallback: .sql dump file + state file are already persisted on disk
    }
  } catch (err) {
    console.warn('Warning syncing SQL dump file:', err);
  }
}

function deduplicateUsers(rawUsers?: Record<string, unknown>[]): Record<string, unknown>[] | undefined {
  if (!Array.isArray(rawUsers)) return rawUsers;
  const seenIds = new Set<string>();
  const seenUsernames = new Set<string>();
  const result: Record<string, unknown>[] = [];
  for (const item of rawUsers) {
    if (!item || typeof item !== 'object') continue;
    const u = item as { id?: string; username?: string };
    if (!u.id || !u.username) continue;
    const idKey = String(u.id).trim().replace(/staff/gi, 'PIC');
    const unameKey = String(u.username).trim().toLowerCase();
    if (seenIds.has(idKey) || seenUsernames.has(unameKey)) continue;
    seenIds.add(idKey);
    seenUsernames.add(unameKey);
    result.push({ ...item, id: idKey });
  }
  return result;
}

function readDefaultState(): SharedServerState | null {
  try {
    const candidateFiles = [DEFAULT_STATE_FILE, BUNDLED_SNAPSHOT_FILE];
    for (const filePath of candidateFiles) {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as SharedServerState;
        if (parsed && Array.isArray(parsed.users)) {
          parsed.users = deduplicateUsers(parsed.users);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to read default state file:', err);
  }
  return null;
}

function readSharedState(): SharedServerState | null {
  try {
    ensureDataDir();
    const defaultDb = readDefaultState();
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as SharedServerState;
      if (parsed && Array.isArray(parsed.users)) {
        parsed.users = deduplicateUsers(parsed.users);
      }
      // Ensure default Cost Centers, GL Accounts, and Stock Items are preserved if legacy dummy data is found
      if (defaultDb) {
        const ccList = Array.isArray(parsed.costCenters) ? parsed.costCenters : [];
        const isLegacyCC =
          ccList.length === 0 ||
          (ccList.length <= 8 &&
            ccList.some((c) => c && (c.code === '10' || c.code === '60')));
        if (isLegacyCC && Array.isArray(defaultDb.costCenters)) {
          parsed.costCenters = defaultDb.costCenters;
        }
        const glList = Array.isArray(parsed.glAccounts) ? parsed.glAccounts : [];
        const isLegacyGL =
          glList.length === 0 ||
          (glList.length <= 10 && glList.some((g) => g && g.code === '51010'));
        if (isLegacyGL && Array.isArray(defaultDb.glAccounts)) {
          parsed.glAccounts = defaultDb.glAccounts;
        }
      }
      return parsed;
    }
    if (defaultDb) {
      fs.writeFileSync(STATE_FILE, JSON.stringify(defaultDb, null, 2), 'utf-8');
      return defaultDb;
    }
    if (fs.existsSync(SQL_DUMP_FILE)) {
      const sqlRaw = fs.readFileSync(SQL_DUMP_FILE, 'utf-8');
      const parsed = parseSqlDumpToSnapshot(sqlRaw);
      if (parsed) {
        return {
          updatedAt: parsed.exportedAt || new Date().toISOString(),
          version: parsed.version || 1,
          ...parsed,
          users: deduplicateUsers(parsed.users),
        } as SharedServerState;
      }
    }
  } catch (err) {
    console.warn('Failed to read shared state file:', err);
  }
  return null;
}

function writeSharedState(data: Partial<SharedServerState>): SharedServerState {
  ensureDataDir();
  const current = readSharedState() || {
    updatedAt: new Date().toISOString(),
    version: 0,
  };
  const nextState: SharedServerState = {
    ...current,
    ...data,
    users: deduplicateUsers((data.users ?? current.users) as Record<string, unknown>[] | undefined),
    updatedAt: new Date().toISOString(),
    version: (current.version || 0) + 1,
  };
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(nextState, null, 2), 'utf-8');
    void syncStateToSqlStorage(nextState);
  } catch (err) {
    console.warn('Failed to write shared state file:', err);
  }
  return nextState;
}

function isCloudflaredRunning(): boolean {
  try {
    const out = execSync('pgrep -x cloudflared', { encoding: 'utf-8' }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

function readTunnelUrlFromDisk(): string {
  try {
    if (!isCloudflaredRunning()) {
      return '';
    }
    if (fs.existsSync(TUNNEL_LOG_FILE)) {
      const logText = fs.readFileSync(TUNNEL_LOG_FILE, 'utf-8');
      const matches = logText.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi);
      if (matches && matches.length > 0) {
        const latest = matches[matches.length - 1];
        currentPublicTunnelUrl = latest;
        try {
          ensureDataDir();
          fs.writeFileSync(TUNNEL_URL_FILE, latest, 'utf-8');
        } catch {}
        return latest;
      }
    }
  } catch {}
  return '';
}

function ensurePersistentCloudflareTunnel(port: number) {
  try {
    ensureDataDir();
    // 1. Jika cloudflared sudah berjalan di container, JANGAN restart agar URL tetap sama!
    if (isCloudflaredRunning()) {
      const existingUrl = readTunnelUrlFromDisk();
      if (existingUrl) {
        currentPublicTunnelUrl = existingUrl;
        console.log(`Reusing persistent Public Login URL (unchanged): ${currentPublicTunnelUrl}`);
        return;
      }
    }

    const binPath = '/tmp/cloudflared';
    if (!fs.existsSync(binPath)) {
      try {
        execSync(
          `curl -sL --max-time 10 https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ${binPath} && chmod +x ${binPath}`,
          { timeout: 12000 }
        );
      } catch {
        return;
      }
    }

    if (fs.existsSync(binPath)) {
      const outFd = fs.openSync(TUNNEL_LOG_FILE, 'w');
      const child = spawn(
        binPath,
        ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://localhost:${port}`],
        {
          detached: true,
          stdio: ['ignore', outFd, outFd],
        }
      );
      child.unref();

      // Poll log file for the generated URL
      let attempts = 0;
      const pollTimer = setInterval(() => {
        attempts++;
        const found = readTunnelUrlFromDisk();
        if (found || attempts > 30) {
          clearInterval(pollTimer);
          if (found) {
            console.log(`Persistent Public Login URL active: ${found}`);
          }
        }
      }, 500);
    }
  } catch (err) {
    console.warn('Could not ensure persistent tunnel:', err);
  }
}

function resolveActivePublicUrl(): string {
  // Cek custom domain non-AI-Studio jika pernah diatur admin
  try {
    if (fs.existsSync(PERMANENT_URL_FILE)) {
      const saved = fs.readFileSync(PERMANENT_URL_FILE, 'utf-8').trim();
      if (
        saved.startsWith('http') &&
        !saved.includes('ais-pre-') &&
        !saved.includes('ais-dev-')
      ) {
        return saved.replace(/\/+$/, '');
      }
    }
  } catch {}

  if (currentPublicTunnelUrl && isCloudflaredRunning()) {
    return currentPublicTunnelUrl;
  }

  const fromDisk = readTunnelUrlFromDisk();
  if (fromDisk) {
    return fromDisk;
  }

  return '';
}

async function startServer() {
  const app = express();
  const portArgIndex = process.argv.indexOf('--port');
  const cliPort =
    portArgIndex !== -1 && process.argv[portArgIndex + 1]
      ? Number(process.argv[portArgIndex + 1])
      : null;
  // Dev server must listen on port 3000 (nginx listens on 8080)
  const PORT =
    cliPort || (process.env.PORT && process.env.PORT !== '8080' ? Number(process.env.PORT) : 3000);

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    const publicUrl = resolveActivePublicUrl();
    res.json({
      status: 'ok',
      publicAccess: true,
      requiresGmailLogin: false,
      sqlSyncActive: true,
      publicDeployUrl: publicUrl || null,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/public-url', async (_req, res) => {
    let publicUrl = resolveActivePublicUrl();
    if (!publicUrl || !isCloudflaredRunning()) {
      ensurePersistentCloudflareTunnel(PORT);
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 400));
        publicUrl = resolveActivePublicUrl();
        if (publicUrl) break;
      }
    }
    res.json({
      success: true,
      publicUrl: publicUrl || null,
      permanentUrl: publicUrl || null,
      isPermanent: true,
    });
  });

  app.post('/api/public-url', (req, res) => {
    const rawUrl = typeof req.body?.permanentUrl === 'string' ? req.body.permanentUrl.trim() : '';
    const cleanUrl = rawUrl.startsWith('http') ? rawUrl.replace(/\/+$/, '') : '';
    try {
      ensureDataDir();
      if (cleanUrl && !cleanUrl.includes('ais-pre-') && !cleanUrl.includes('ais-dev-')) {
        fs.writeFileSync(PERMANENT_URL_FILE, cleanUrl, 'utf-8');
      } else if (fs.existsSync(PERMANENT_URL_FILE)) {
        fs.unlinkSync(PERMANENT_URL_FILE);
      }
    } catch (err) {
      console.warn('Failed to update permanent login URL:', err);
    }
    const activeUrl = resolveActivePublicUrl();
    res.json({
      success: true,
      publicUrl: activeUrl,
      permanentUrl: activeUrl,
      isPermanent: true,
    });
  });

  app.get('/api/inventory/state', (_req, res) => {
    const state = readSharedState();
    res.json({
      success: true,
      publicAccess: true,
      sqlEngine: 'SQLite3 + SQL Dump Sync',
      state: state || null,
    });
  });

  app.get('/api/sync/state', (_req, res) => {
    const state = readSharedState();
    res.json({
      revision: state?.version || 1,
      updatedAt: state?.updatedAt || new Date().toISOString(),
      lastClientId: 'server',
      lastDeviceType: 'WEBSITE',
      lastActionSummary: 'Tersinkronisasi',
      connectedDevices: [],
      collections: state || {},
      data: state || {},
    });
  });

  app.get('/api/sync/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const state = readSharedState();
    const initPayload = {
      revision: state?.version || 1,
      updatedAt: state?.updatedAt || new Date().toISOString(),
      lastClientId: String(req.query.clientId || 'server'),
      lastDeviceType: 'WEBSITE',
      lastActionSummary: 'Tersinkronisasi',
      connectedDevices: [],
    };
    res.write(`event: INIT_STATE\ndata: ${JSON.stringify(initPayload)}\n\n`);

    const keepAlive = setInterval(() => {
      res.write(': keep-alive\n\n');
    }, 20000);

    req.on('close', () => {
      clearInterval(keepAlive);
    });
  });

  app.post('/api/sync/push', (req, res) => {
    const collections = req.body?.collections || req.body || {};
    const updated = writeSharedState(collections);
    res.json({
      success: true,
      revision: updated.version,
      updatedAt: updated.updatedAt,
      connectedDevices: [],
    });
  });

  app.post('/api/sync/heartbeat', (_req, res) => {
    res.json({ success: true });
  });

  app.post('/api/sync/event', (_req, res) => {
    res.json({ success: true });
  });

  app.post('/api/sync/reset', (_req, res) => {
    const defaultDb = readDefaultState();
    if (defaultDb) {
      const restored = writeSharedState({
        ...defaultDb,
        updatedAt: new Date().toISOString(),
      });
      res.json({
        success: true,
        revision: restored.version,
        updatedAt: restored.updatedAt,
      });
      return;
    }
    res.json({ success: true });
  });

  app.post('/api/inventory/sync', (req, res) => {
    const payload = req.body || {};
    const updated = writeSharedState({
      stockItems: payload.stockItems,
      lpbDocuments: payload.lpbDocuments,
      issueVouchers: payload.issueVouchers,
      stockMovements: payload.stockMovements,
      notifications: payload.notifications,
      costCenters: payload.costCenters,
      glAccounts: payload.glAccounts,
      storageLocations: payload.storageLocations,
      stockCategories: payload.stockCategories,
      companyProfile: payload.companyProfile,
      minStockProposals: payload.minStockProposals,
      stockOpnameSessions: payload.stockOpnameSessions,
      locationTransferRequests: payload.locationTransferRequests,
      activityLogs: payload.activityLogs,
      users: payload.users,
      roleDefinitions: payload.roleDefinitions,
    });
    res.json({
      success: true,
      sqlSynced: true,
      version: updated.version,
      updatedAt: updated.updatedAt,
    });
  });

  app.get('/api/database/export-sql', (_req, res) => {
    const state = readSharedState();
    const sqlText = generateSqlDump({
      ...(state || {}),
      exportedAt: new Date().toISOString(),
      exportedBy: 'server-sql-backup',
      version: state?.version || 1,
    });
    res.setHeader('Content-Type', 'application/sql; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="store-database-backup-${new Date().toISOString().slice(0, 10)}.sql"`
    );
    res.send(sqlText);
  });

  app.post('/api/database/import-sql', (req, res) => {
    const sqlContent = typeof req.body?.sql === 'string' ? req.body.sql : '';
    if (!sqlContent.trim()) {
      res.status(400).json({
        success: false,
        error: 'Konten file SQL kosong atau tidak ditemukan.',
      });
      return;
    }

    const parsed = parseSqlDumpToSnapshot(sqlContent);
    if (!parsed) {
      res.status(400).json({
        success: false,
        error: 'Format file SQL tidak dapat dikenali. Pastikan file merupakan hasil Backup SQL Store.',
      });
      return;
    }

    const updated = writeSharedState(parsed);
    res.json({
      success: true,
      version: updated.version,
      updatedAt: updated.updatedAt,
      state: updated,
    });
  });

  app.get('/api/superuser/database', (_req, res) => {
    const state = readSharedState();
    let fileSizeBytes = 0;
    let sqlFileSizeBytes = 0;
    try {
      if (fs.existsSync(STATE_FILE)) {
        fileSizeBytes = fs.statSync(STATE_FILE).size;
      }
      if (fs.existsSync(SQL_DUMP_FILE)) {
        sqlFileSizeBytes = fs.statSync(SQL_DUMP_FILE).size;
      }
    } catch {}
    res.json({
      success: true,
      databaseEngine: 'SQL Relational Sync (/data/store-inventory.sqlite & .sql)',
      fileSizeBytes,
      sqlFileSizeBytes,
      state: state || null,
    });
  });

  app.post('/api/superuser/database', (req, res) => {
    const payload = req.body || {};
    const updated = writeSharedState(payload);
    res.json({
      success: true,
      version: updated.version,
      updatedAt: updated.updatedAt,
      state: updated,
    });
  });

  app.post('/api/inventory/reset', (_req, res) => {
    try {
      const defaultDb = readDefaultState();
      if (defaultDb) {
        const restored = writeSharedState({
          ...defaultDb,
          updatedAt: new Date().toISOString(),
        });
        res.json({
          success: true,
          message: 'Shared SQL & server state restored to default database.',
          state: restored,
        });
        return;
      }
      if (fs.existsSync(STATE_FILE)) {
        fs.unlinkSync(STATE_FILE);
      }
    } catch (err) {
      console.warn('Failed to reset shared state file:', err);
    }
    res.json({
      success: true,
      message: 'Shared SQL & server state reset to default.',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT} (SQL Sync Enabled)`);
    ensurePersistentCloudflareTunnel(PORT);
  });
}

startServer();
