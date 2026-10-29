import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { INITIAL_STOCK_ITEMS } from '../data/mockData';
import { StockItem } from '../types/inventory';

// Initialize Firebase SDK using provisioned configuration
const app = initializeApp(firebaseConfig);

// Respect firestoreDatabaseId from firebase-applet-config.json
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

// Validate connection to Firestore on startup
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.warn('Please check your Firebase configuration. The client is offline.');
    }
    return false;
  }
}

interface CompactStockDelta {
  c: number; // currentStock
  a: number; // allocatedStock
  m: number; // minStock
  l: string; // location
  u?: string; // updatedAt
}

const baseStockById = new Map<string, StockItem>();
for (const item of INITIAL_STOCK_ITEMS) {
  baseStockById.set(item.id, item);
}

/**
 * Compresses the 4,600+ stockItems array into lightweight deltas + custom items
 * so the Firestore document stays < 250 KB (well under the 1 MB Firestore limit)
 * and works reliably even when exported as a ZIP to external/static hosting.
 */
function compressStateForFirestore(statePayload: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(statePayload)) as Record<string, unknown>;

  if (Array.isArray(clone.activityLogs) && clone.activityLogs.length > 80) {
    clone.activityLogs = clone.activityLogs.slice(0, 80);
  }
  if (Array.isArray(clone.notifications) && clone.notifications.length > 60) {
    clone.notifications = clone.notifications.slice(0, 60);
  }
  if (Array.isArray(clone.stockMovements) && clone.stockMovements.length > 250) {
    clone.stockMovements = clone.stockMovements.slice(0, 250);
  }
  if (Array.isArray(clone.stockOpnameSessions) && clone.stockOpnameSessions.length > 5) {
    clone.stockOpnameSessions = (clone.stockOpnameSessions as Record<string, unknown>[])
      .slice(0, 5)
      .map((s) => ({
        ...s,
        items: Array.isArray(s.items)
          ? (s.items as Record<string, unknown>[]).filter((it) => Boolean(it.isCounted))
          : [],
      }));
  }

  if (Array.isArray(clone.stockItems)) {
    const rawItems = clone.stockItems as StockItem[];
    if (rawItems.length === 0) {
      clone.isStockCleared = true;
      clone.stockDeltas = {};
      clone.customStockItems = [];
      clone.deletedStockIds = [];
      delete clone.stockItems;
    } else if (rawItems.length > 500) {
      const stockDeltas: Record<string, CompactStockDelta> = {};
      const customStockItems: StockItem[] = [];
      const presentBaseIds = new Set<string>();

      for (const item of rawItems) {
        if (!item || !item.id) continue;
        const base = baseStockById.get(item.id);
        if (!base) {
          customStockItems.push(item);
          continue;
        }
        presentBaseIds.add(item.id);
        const isMetaModified =
          item.sku !== base.sku ||
          item.name !== base.name ||
          item.category !== base.category ||
          item.unit !== base.unit ||
          (item.description || '') !== (base.description || '');

        if (isMetaModified) {
          customStockItems.push(item);
        } else if (
          item.currentStock !== base.currentStock ||
          item.allocatedStock !== base.allocatedStock ||
          item.minStock !== base.minStock ||
          item.location !== base.location
        ) {
          stockDeltas[item.id] = {
            c: item.currentStock,
            a: item.allocatedStock,
            m: item.minStock,
            l: item.location,
            u: item.updatedAt,
          };
        }
      }

      const deletedStockIds: string[] = [];
      for (const baseId of baseStockById.keys()) {
        if (!presentBaseIds.has(baseId)) {
          deletedStockIds.push(baseId);
        }
      }

      clone.isStockCleared = false;
      clone.stockDeltas = stockDeltas;
      clone.customStockItems = customStockItems.slice(0, 600);
      clone.deletedStockIds = deletedStockIds.slice(0, 1000);
      delete clone.stockItems;
    }
  }

  return clone;
}

/**
 * Reconstructs full stockItems array from compact Firestore delta document.
 */
function rehydrateStateFromFirestore(rawDoc: Record<string, unknown>): Record<string, unknown> {
  if (!rawDoc || typeof rawDoc !== 'object') return rawDoc;
  const result: Record<string, unknown> = { ...rawDoc };

  if (result.isStockCleared === true) {
    result.stockItems = [];
    return result;
  }

  if (
    !Array.isArray(result.stockItems) &&
    (result.stockDeltas !== undefined || result.customStockItems !== undefined)
  ) {
    const deltas = (result.stockDeltas || {}) as Record<string, CompactStockDelta>;
    const customList = Array.isArray(result.customStockItems)
      ? (result.customStockItems as StockItem[])
      : [];
    const deletedSet = new Set<string>(
      Array.isArray(result.deletedStockIds) ? (result.deletedStockIds as string[]) : []
    );
    const customById = new Map<string, StockItem>();
    for (const c of customList) {
      if (c && c.id) customById.set(c.id, c);
    }

    const reconstructed: StockItem[] = [];
    for (const base of INITIAL_STOCK_ITEMS) {
      if (deletedSet.has(base.id)) continue;
      if (customById.has(base.id)) {
        reconstructed.push(customById.get(base.id)!);
        customById.delete(base.id);
        continue;
      }
      const d = deltas[base.id];
      if (d) {
        reconstructed.push({
          ...base,
          currentStock: typeof d.c === 'number' ? d.c : base.currentStock,
          allocatedStock: typeof d.a === 'number' ? d.a : base.allocatedStock,
          minStock: typeof d.m === 'number' ? d.m : base.minStock,
          location: typeof d.l === 'string' ? d.l : base.location,
          updatedAt: d.u || base.updatedAt,
        });
      } else {
        reconstructed.push(base);
      }
    }

    for (const extra of customById.values()) {
      reconstructed.push(extra);
    }

    result.stockItems = reconstructed;
  }

  return result;
}

export async function saveInventoryStateToFirestore(
  statePayload: Record<string, unknown>
): Promise<boolean> {
  const path = 'inventory_state/shared';
  try {
    const compactPayload = compressStateForFirestore(statePayload);
    await setDoc(doc(db, 'inventory_state', 'shared'), compactPayload);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function fetchInventoryStateFromFirestore(): Promise<Record<string, unknown> | null> {
  const path = 'inventory_state/shared';
  try {
    const snap = await getDoc(doc(db, 'inventory_state', 'shared'));
    if (snap.exists()) {
      return rehydrateStateFromFirestore(snap.data() as Record<string, unknown>);
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}

export function subscribeToFirestoreInventoryState(
  onStateReceived: (data: Record<string, unknown>) => void
): Unsubscribe {
  const path = 'inventory_state/shared';
  return onSnapshot(
    doc(db, 'inventory_state', 'shared'),
    (snapshot) => {
      if (snapshot.exists()) {
        const rehydrated = rehydrateStateFromFirestore(
          snapshot.data() as Record<string, unknown>
        );
        onStateReceived(rehydrated);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}
