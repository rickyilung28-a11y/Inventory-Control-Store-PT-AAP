import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

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

export async function saveInventoryStateToFirestore(
  statePayload: Record<string, unknown>
): Promise<boolean> {
  const path = 'inventory_state/shared';
  try {
    const cleanPayload = JSON.parse(JSON.stringify(statePayload));
    if (Array.isArray(cleanPayload.activityLogs) && cleanPayload.activityLogs.length > 150) {
      cleanPayload.activityLogs = cleanPayload.activityLogs.slice(0, 150);
    }
    if (Array.isArray(cleanPayload.notifications) && cleanPayload.notifications.length > 150) {
      cleanPayload.notifications = cleanPayload.notifications.slice(0, 150);
    }
    await setDoc(doc(db, 'inventory_state', 'shared'), cleanPayload, { merge: true });
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
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
        onStateReceived(snapshot.data() as Record<string, unknown>);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}
