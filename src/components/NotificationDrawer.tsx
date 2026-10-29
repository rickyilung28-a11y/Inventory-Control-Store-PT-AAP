import React from 'react';
import { AppNotification } from '../types/inventory';
import { Bell, CheckCheck, X, Clock, CheckCircle, PackageCheck, AlertCircle } from 'lucide-react';
import { soundService } from '../services/soundService';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  currentUserId: string;
  currentUserRole: string;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onSelectVoucher: (voucherId: string) => void;
  onSelectLPB: (lpbId: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  currentUserId,
  currentUserRole,
  onMarkAsRead,
  onMarkAllAsRead,
  onSelectVoucher,
  onSelectLPB,
}) => {
  if (!isOpen) return null;

  // Filter relevant notifications for current user/role
  const userNotifications = notifications.filter((n) => {
    if (n.targetUserId && n.targetUserId === currentUserId) return true;
    if (n.targetRole === 'all') return true;
    if (n.targetRole === currentUserRole) return true;
    return false;
  });

  const unreadCount = userNotifications.filter((n) => !n.read).length;

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short',
      }).format(d);
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-2xs flex justify-end">
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-slate-800" />
            <h3 className="font-semibold text-slate-900 text-sm">Pusat Notifikasi Real-Time</h3>
            {unreadCount > 0 && (
              <span className="text-[11px] font-bold text-white bg-red-600 px-2 py-0.5 rounded-full tabular-nums">
                {unreadCount} baru
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => soundService.playApprovalChime()}
              className="text-[11px] text-slate-600 hover:text-slate-900 px-2 py-1 rounded bg-white border border-slate-200"
              title="Tes Bunyi Notifikasi"
            >
              Tes Suara
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action subheader */}
        <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {userNotifications.length} aktivitas terekam
          </span>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Tandai Semua Sudah Dibaca
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
          {userNotifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Belum ada notifikasi untuk akun ini.
            </div>
          ) : (
            userNotifications.map((notif) => {
              const isApproved = notif.type === 'voucher_approved';
              const isRejected = notif.type === 'voucher_rejected';
              const isCreated = notif.type === 'voucher_created';

              return (
                <div
                  key={notif.id}
                  onClick={() => onMarkAsRead(notif.id)}
                  className={`p-3.5 rounded-lg transition-colors cursor-pointer ${
                    !notif.read ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {isApproved || notif.type === 'min_stock_approved' ? (
                        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                      ) : isRejected || notif.type === 'min_stock_rejected' ? (
                        <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      ) : isCreated || notif.type === 'min_stock_proposal' ? (
                        <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                          <Clock className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
                          <PackageCheck className="w-4 h-4" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {notif.title}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                          {formatTime(notif.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>

                      <div className="mt-2 flex items-center gap-2">
                        {notif.voucherId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectVoucher(notif.voucherId!);
                              onClose();
                            }}
                            className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 underline"
                          >
                            Buka Nota Pengambilan &rarr;
                          </button>
                        )}
                        {notif.lpbId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectLPB(notif.lpbId!);
                              onClose();
                            }}
                            className="text-[11px] font-medium text-sky-700 hover:text-sky-800 underline"
                          >
                            Buka Dokumen LPB &rarr;
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
