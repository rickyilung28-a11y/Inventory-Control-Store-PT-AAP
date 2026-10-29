import { IssueVoucherDocument, LPBDocument } from '../types/inventory';
import { soundService } from './soundService';

export type RealtimeEventType =
  | 'VOUCHER_APPROVED'
  | 'VOUCHER_REJECTED'
  | 'VOUCHER_CREATED'
  | 'STOCK_RECEIVED'
  | 'STORAGE_SYNC'
  | 'ANDROID_ACTIVITY';

export interface ConnectedDeviceInfo {
  clientId: string;
  deviceType: 'ANDROID' | 'WEBSITE';
  deviceName: string;
  userName: string;
  userRole: string;
  lastSeen: string;
}

export interface RealtimeEventPayload {
  type: RealtimeEventType;
  data: unknown;
  timestamp: string;
  sourceTabId: string;
  deviceType?: 'ANDROID' | 'WEBSITE';
  actorName?: string;
}

export interface ServerStateSyncPayload {
  revision: number;
  updatedAt: string;
  lastClientId: string;
  lastDeviceType: 'ANDROID' | 'WEBSITE';
  lastActionSummary: string;
  connectedDevices: ConnectedDeviceInfo[];
  collections?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

type EventListenerCallback = (payload: RealtimeEventPayload) => void;
type ServerSyncCallback = (payload: ServerStateSyncPayload) => void;
type SyncStatusCallback = (status: {
  connected: boolean;
  revision: number;
  lastSyncAt: string | null;
  lastDeviceType: 'ANDROID' | 'WEBSITE';
  lastActionSummary: string;
  connectedDevices: ConnectedDeviceInfo[];
}) => void;

class RealtimeService {
  private channel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private listeners: Set<EventListenerCallback> = new Set();
  private serverSyncListeners: Set<ServerSyncCallback> = new Set();
  private statusListeners: Set<SyncStatusCallback> = new Set();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  public tabId: string = `dev_${Math.random().toString(36).substring(2, 9)}`;
  public currentDeviceType: 'ANDROID' | 'WEBSITE' = 'WEBSITE';
  public currentUserName: string = 'Pengguna Gudang';
  public currentUserRole: string = 'user';

  public isConnectedToServer = false;
  public currentRevision = 0;
  public lastSyncAt: string | null = null;
  public lastDeviceType: 'ANDROID' | 'WEBSITE' = 'WEBSITE';
  public lastActionSummary = 'Siap Sinkronisasi Real-Time';
  public connectedDevices: ConnectedDeviceInfo[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      const ua = window.navigator.userAgent.toLowerCase();
      const isMobileScreen = window.innerWidth <= 768;
      if (/android|mobile|iphone|ipad/.test(ua) || isMobileScreen) {
        this.currentDeviceType = 'ANDROID';
      }
    }

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('stock_inventory_realtime');
        this.channel.onmessage = (event: MessageEvent<RealtimeEventPayload>) => {
          if (event.data && event.data.sourceTabId !== this.tabId) {
            this.handleIncomingEvent(event.data);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported or restricted', err);
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'inventory_broadcast_sync' && e.newValue) {
          try {
            const payload = JSON.parse(e.newValue) as RealtimeEventPayload;
            if (payload.sourceTabId !== this.tabId) {
              this.handleIncomingEvent(payload);
            }
          } catch {
            // ignore JSON parse error
          }
        }
      });

      this.connectSSE();
    }
  }

  public setDeviceMode(deviceType: 'ANDROID' | 'WEBSITE', userName?: string, userRole?: string) {
    const changed =
      this.currentDeviceType !== deviceType ||
      (userName && this.currentUserName !== userName) ||
      (userRole && this.currentUserRole !== userRole);

    this.currentDeviceType = deviceType;
    if (userName) this.currentUserName = userName;
    if (userRole) this.currentUserRole = userRole;

    if (changed) {
      this.sendHeartbeat();
    }
  }

  public getDeviceName(): string {
    if (this.currentDeviceType === 'ANDROID') {
      return 'Android App / Handheld Gudang';
    }
    return 'Website Desktop Gudang';
  }

  public connectSSE() {
    if (typeof window === 'undefined') return;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    try {
      const params = new URLSearchParams({
        clientId: this.tabId,
        deviceType: this.currentDeviceType,
        deviceName: this.getDeviceName(),
        userName: this.currentUserName,
        userRole: this.currentUserRole,
      });

      const es = new EventSource(`/api/sync/stream?${params.toString()}`);
      this.eventSource = es;

      es.onopen = () => {
        this.isConnectedToServer = true;
        this.emitStatus();
      };

      es.addEventListener('INIT_STATE', (evt: MessageEvent) => {
        try {
          const payload = JSON.parse(evt.data) as ServerStateSyncPayload;
          this.isConnectedToServer = true;
          this.currentRevision = payload.revision;
          this.lastSyncAt = payload.updatedAt;
          this.lastDeviceType = payload.lastDeviceType || 'WEBSITE';
          this.lastActionSummary = payload.lastActionSummary || 'Tersinkronisasi';
          this.connectedDevices = payload.connectedDevices || [];
          this.emitStatus();
          this.serverSyncListeners.forEach((cb) => cb(payload));
        } catch (err) {
          console.warn('Failed to parse INIT_STATE', err);
        }
      });

      es.addEventListener('STATE_UPDATED', (evt: MessageEvent) => {
        try {
          const payload = JSON.parse(evt.data) as ServerStateSyncPayload;
          this.isConnectedToServer = true;
          this.currentRevision = payload.revision;
          this.lastSyncAt = payload.updatedAt;
          this.lastDeviceType = payload.lastDeviceType || 'WEBSITE';
          this.lastActionSummary = payload.lastActionSummary || 'Update Real-time';
          this.connectedDevices = payload.connectedDevices || this.connectedDevices;
          this.emitStatus();

          if (payload.lastClientId !== this.tabId) {
            this.serverSyncListeners.forEach((cb) => cb(payload));
          }
        } catch (err) {
          console.warn('Failed to parse STATE_UPDATED', err);
        }
      });

      es.addEventListener('STATE_RESET', (evt: MessageEvent) => {
        try {
          const payload = JSON.parse(evt.data) as ServerStateSyncPayload;
          this.currentRevision = payload.revision;
          this.lastSyncAt = payload.updatedAt;
          this.lastDeviceType = payload.lastDeviceType || 'WEBSITE';
          this.lastActionSummary = payload.lastActionSummary || 'Reset Data';
          this.connectedDevices = payload.connectedDevices || this.connectedDevices;
          this.emitStatus();

          if (payload.lastClientId !== this.tabId) {
            this.serverSyncListeners.forEach((cb) => cb(payload));
          }
        } catch (err) {
          console.warn('Failed to parse STATE_RESET', err);
        }
      });

      es.addEventListener('DEVICES_UPDATED', (evt: MessageEvent) => {
        try {
          const payload = JSON.parse(evt.data) as { connectedDevices: ConnectedDeviceInfo[] };
          if (payload.connectedDevices) {
            this.connectedDevices = payload.connectedDevices;
            this.emitStatus();
          }
        } catch {}
      });

      es.addEventListener('REALTIME_EVENT', (evt: MessageEvent) => {
        try {
          const payload = JSON.parse(evt.data) as RealtimeEventPayload;
          if (payload.sourceTabId !== this.tabId) {
            this.handleIncomingEvent(payload);
          }
        } catch {}
      });

      es.onerror = () => {
        this.isConnectedToServer = false;
        this.emitStatus();
        es.close();
        this.eventSource = null;
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => this.connectSSE(), 3000);
      };
    } catch (err) {
      console.warn('SSE connection error:', err);
    }
  }

  private emitStatus() {
    const status = {
      connected: this.isConnectedToServer,
      revision: this.currentRevision,
      lastSyncAt: this.lastSyncAt,
      lastDeviceType: this.lastDeviceType,
      lastActionSummary: this.lastActionSummary,
      connectedDevices: this.connectedDevices,
    };
    this.statusListeners.forEach((cb) => cb(status));
  }

  public subscribeSyncStatus(callback: SyncStatusCallback): () => void {
    this.statusListeners.add(callback);
    callback({
      connected: this.isConnectedToServer,
      revision: this.currentRevision,
      lastSyncAt: this.lastSyncAt,
      lastDeviceType: this.lastDeviceType,
      lastActionSummary: this.lastActionSummary,
      connectedDevices: this.connectedDevices,
    });
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public subscribeServerState(callback: ServerSyncCallback): () => void {
    this.serverSyncListeners.add(callback);
    return () => {
      this.serverSyncListeners.delete(callback);
    };
  }

  public async pushToServer(
    collections: Record<string, unknown>,
    actionSummary = 'Sinkronisasi Data Android/Web'
  ) {
    try {
      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: this.tabId,
          deviceType: this.currentDeviceType,
          deviceName: this.getDeviceName(),
          userName: this.currentUserName,
          userRole: this.currentUserRole,
          actionSummary,
          collections,
        }),
      });
      if (response.ok) {
        const resJson = await response.json();
        this.isConnectedToServer = true;
        this.currentRevision = resJson.revision || this.currentRevision;
        this.lastSyncAt = resJson.updatedAt || new Date().toISOString();
        this.lastDeviceType = this.currentDeviceType;
        this.lastActionSummary = actionSummary;
        if (resJson.connectedDevices) {
          this.connectedDevices = resJson.connectedDevices;
        }
        this.emitStatus();
      }
    } catch (err) {
      console.warn('Offline or failed to push to sync server, saved locally:', err);
    }
  }

  public async pullFromServer(): Promise<ServerStateSyncPayload | null> {
    try {
      const res = await fetch('/api/sync/state');
      if (res.ok) {
        const payload = (await res.json()) as ServerStateSyncPayload;
        this.isConnectedToServer = true;
        this.currentRevision = payload.revision;
        this.lastSyncAt = payload.updatedAt;
        this.lastDeviceType = payload.lastDeviceType || 'WEBSITE';
        this.lastActionSummary = payload.lastActionSummary || 'Tersinkronisasi';
        this.connectedDevices = payload.connectedDevices || [];
        this.emitStatus();
        this.serverSyncListeners.forEach((cb) => cb(payload));
        return payload;
      }
    } catch (err) {
      console.warn('Failed to pull state from server:', err);
    }
    return null;
  }

  public async resetServerData() {
    try {
      await fetch('/api/sync/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: this.tabId,
          deviceType: this.currentDeviceType,
        }),
      });
    } catch (err) {
      console.warn('Failed to reset server data:', err);
    }
  }

  public async sendHeartbeat() {
    try {
      await fetch('/api/sync/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: this.tabId,
          deviceType: this.currentDeviceType,
          deviceName: this.getDeviceName(),
          userName: this.currentUserName,
          userRole: this.currentUserRole,
        }),
      });
    } catch {}
  }

  private handleIncomingEvent(payload: RealtimeEventPayload) {
    if (payload.type === 'VOUCHER_APPROVED') {
      soundService.playApprovalChime();
    } else if (payload.type === 'VOUCHER_CREATED' || payload.type === 'ANDROID_ACTIVITY') {
      soundService.playAlertChime();
    }
    this.listeners.forEach((callback) => {
      try {
        callback(payload);
      } catch (err) {
        console.error('Error in realtime event listener:', err);
      }
    });
  }

  public subscribe(callback: EventListenerCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public broadcast(type: RealtimeEventType, data: unknown) {
    const payload: RealtimeEventPayload = {
      type,
      data,
      timestamp: new Date().toISOString(),
      sourceTabId: this.tabId,
      deviceType: this.currentDeviceType,
      actorName: this.currentUserName,
    };

    if (type === 'VOUCHER_APPROVED') {
      soundService.playApprovalChime();
    } else if (type === 'VOUCHER_CREATED') {
      soundService.playAlertChime();
    }

    this.listeners.forEach((cb) => cb(payload));

    if (this.channel) {
      try {
        this.channel.postMessage(payload);
      } catch (e) {
        console.warn('BroadcastChannel postMessage failed', e);
      }
    }

    try {
      localStorage.setItem('inventory_broadcast_sync', JSON.stringify(payload));
    } catch {}

    // Broadcast across devices via Backend SSE Server
    fetch('/api/sync/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  public notifyVoucherApproved(voucher: IssueVoucherDocument) {
    this.broadcast('VOUCHER_APPROVED', voucher);
  }

  public notifyVoucherCreated(voucher: IssueVoucherDocument) {
    this.broadcast('VOUCHER_CREATED', voucher);
  }

  public notifyVoucherRejected(voucher: IssueVoucherDocument) {
    this.broadcast('VOUCHER_REJECTED', voucher);
  }

  public notifyStockReceived(lpb: LPBDocument) {
    this.broadcast('STOCK_RECEIVED', lpb);
  }
}

export const realtimeService = new RealtimeService();
