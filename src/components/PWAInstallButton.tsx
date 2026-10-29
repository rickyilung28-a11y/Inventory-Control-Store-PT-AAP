import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useInventory } from '../context/InventoryContext';
import {
  downloadApkSafely,
  downloadStandaloneHtmlAppSafely,
  shareOrSaveApkFile,
  getPublicShareableOrigin,
} from '../utils/apkDownloadHelper';
import {
  Smartphone,
  Download,
  QrCode,
  CheckCircle2,
  RefreshCw,
  Share,
  Monitor,
  Wifi,
  X,
  Copy,
  Check,
  ShieldCheck,
  FileDown,
  Package,
  Users,
} from 'lucide-react';

interface ApkMetadata {
  fileName: string;
  packageName: string;
  versionName: string;
  versionCode: number;
  sizeBytes: number;
  sha256: string;
  targetUrl: string;
  serverOrigin: string;
  sharedOrigin: string;
  downloadUrl: string;
  publicApkUrl?: string;
  publicHtmlUrl?: string;
  directApiDownloadUrl: string;
  launcherDownloadUrl: string;
  androidWebAppUrl: string;
}

interface PWAInstallButtonProps {
  onSwitchToAndroidView?: () => void;
  isAndroidView?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  onSwitchToAndroidView,
  isAndroidView = false,
}) => {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const { syncStatus, forceSyncNow, currentUser, showToast } = useInventory();
  const [showModal, setShowModal] = useState(false);
  const [qrOpenAppDataUrl, setQrOpenAppDataUrl] = useState<string>('');
  const [qrApkDownloadDataUrl, setQrApkDownloadDataUrl] = useState<string>('');
  const [copiedApkLink, setCopiedApkLink] = useState(false);
  const [copiedAppLink, setCopiedAppLink] = useState(false);
  const [isSyncingManual, setIsSyncingManual] = useState(false);
  const [apkInfo, setApkInfo] = useState<ApkMetadata | null>(null);
  const [isDownloadingApk, setIsDownloadingApk] = useState(false);
  const [downloadStatusMsg, setDownloadStatusMsg] = useState<string>('');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const sharedOrigin = getPublicShareableOrigin() || origin;

  // Prefer Public Cloud Direct URLs (https://ntfy.sh/file/...) so external phones NEVER hit Google 403!
  const apkDownloadUrl =
    apkInfo?.publicApkUrl ||
    apkInfo?.downloadUrl ||
    `${sharedOrigin}/download/SISTEM-INVENTORY-PT-AAP-v3.0.apk`;
  const mobileUniversalAppUrl =
    apkInfo?.publicHtmlUrl || apkInfo?.androidWebAppUrl || `${sharedOrigin}/?mode=android`;

  useEffect(() => {
    if (showModal && origin) {
      fetch(`/api/apk/info?origin=${encodeURIComponent(origin)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.fileName) {
            setApkInfo(data);
          }
        })
        .catch(() => {});
    }
  }, [showModal, origin]);

  useEffect(() => {
    if (showModal && apkDownloadUrl) {
      QRCode.toDataURL(apkDownloadUrl, {
        width: 220,
        margin: 2,
        color: {
          dark: '#064e3b',
          light: '#ffffff',
        },
      })
        .then(setQrApkDownloadDataUrl)
        .catch(() => {});
    }
    if (showModal && mobileUniversalAppUrl) {
      QRCode.toDataURL(mobileUniversalAppUrl, {
        width: 220,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then(setQrOpenAppDataUrl)
        .catch(() => {});
    }
  }, [showModal, apkDownloadUrl, mobileUniversalAppUrl]);

  const handleCopyApkLink = () => {
    navigator.clipboard.writeText(apkDownloadUrl);
    setCopiedApkLink(true);
    showToast?.('Link Cloud Publik .APK (Bebas 403 di semua HP) berhasil disalin!', 'success');
    setTimeout(() => setCopiedApkLink(false), 2500);
  };

  const handleCopyAppLink = () => {
    navigator.clipboard.writeText(mobileUniversalAppUrl);
    setCopiedAppLink(true);
    showToast?.('Link Aplikasi Mobile (Android & iOS) berhasil disalin!', 'success');
    setTimeout(() => setCopiedAppLink(false), 2500);
  };

  const handleManualSync = async () => {
    setIsSyncingManual(true);
    await forceSyncNow();
    showToast?.('Data Website & HP (Android / iOS) berhasil disinkronkan!', 'success');
    setTimeout(() => setIsSyncingManual(false), 600);
  };

  const handleSafeDownloadApk = async () => {
    setIsDownloadingApk(true);
    setDownloadStatusMsg('Mengambil paket .APK v3.0 dari server (Tanpa Login Google / Bebas 403)...');
    const result = await downloadApkSafely((msg) => setDownloadStatusMsg(msg));
    setIsDownloadingApk(false);
    if (result.success) {
      showToast?.(
        `Berhasil mengunduh ${result.fileName || 'SISTEM-INVENTORY-PT-AAP-v3.0.apk'}!`,
        'success'
      );
    } else {
      showToast?.(result.error || 'Gagal mengunduh APK', 'warning');
    }
  };

  const handleShareApkToPhone = async () => {
    const shared = await shareOrSaveApkFile();
    if (!shared) {
      await handleSafeDownloadApk();
    }
  };

  const handleDownloadStandaloneHtml = async () => {
    const ok = await downloadStandaloneHtmlAppSafely();
    if (ok) {
      showToast?.(
        'Aplikasi Mobile Universal (Android & iOS) berhasil diunduh! Bebas 403 & langsung login username/password.',
        'success'
      );
    }
  };

  const connectedDevices = syncStatus?.connectedDevices || [];
  const isConnected = syncStatus?.connected ?? true;
  const revision = syncStatus?.revision ?? 1;

  const androidCount = connectedDevices.filter((d) => d.deviceType === 'ANDROID').length;
  const webCount = connectedDevices.filter((d) => d.deviceType === 'WEBSITE').length;

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* Live Sync Indicator Badge */}
        <button
          onClick={() => setShowModal(true)}
          title="Status Sinkronisasi Real-Time Website & HP (Android / iOS)"
          className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span>Sync v{revision}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300">
            {androidCount} HP • {webCount} Web
          </span>
        </button>

        {/* Direct Download .APK Button */}
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 hover:from-emerald-400 hover:to-teal-500 transition-all shadow-sm cursor-pointer"
          title="Download File .APK Android & App iOS (Bebas 403)"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download .APK</span>
        </button>

        {/* Switch to Android Handheld Mode */}
        {onSwitchToAndroidView && (
          <button
            onClick={onSwitchToAndroidView}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
            title={
              isAndroidView
                ? 'Kembali ke Tampilan Website Desktop'
                : 'Buka Versi Android (Mobile Handheld UI)'
            }
          >
            {isAndroidView ? (
              <>
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Mode Website</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Versi Android</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Modal: Download .APK & Sinkronisasi Real-Time Android/iOS <-> Website */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl text-slate-100 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-800/90 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      SISTEN INVENTORY CONTROL STORE PT ABADI AGROSINDO PERSADA
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ANDROID .APK &amp; iOS v3.0
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Bisa Digunakan di HP Manapun (Android / iOS) Tanpa Login Google — Hanya Login Username &amp; Password!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
              {/* Instant 1-Tap Switch to Android Mode Banner */}
              {onSwitchToAndroidView && (
                <div className="p-4 rounded-2xl bg-indigo-950/80 border-2 border-indigo-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="inline-block px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase mb-1">
                      MODE HP LANGSUNG DI LAYAR INI
                    </span>
                    <h4 className="text-sm font-extrabold text-white">
                      Ingin Langsung Menggunakan Tampilan HP Android Sekarang?
                    </h4>
                    <p className="text-xs text-slate-300">
                      Langsung beralih ke antarmuka HP Android dengan sinkronisasi otomatis ke Website.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowModal(false);
                      onSwitchToAndroidView();
                    }}
                    className="shrink-0 py-2.5 px-4 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Buka Mode Android Sekarang</span>
                  </button>
                </div>
              )}

              {/* Primary .APK & iOS Download Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-950/90 via-slate-900 to-teal-950/80 border-2 border-emerald-500/40 shadow-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      TANPA PERMINTAAN ACCESS GOOGLE (ZERO-403) • LOGIN USERNAME &amp; PASSWORD
                    </div>
                    <h4 className="text-base sm:text-lg font-extrabold text-white">
                      {apkInfo?.fileName || 'SISTEM-INVENTORY-PT-AAP-v3.0.apk'}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Paket <code className="text-emerald-300">.APK</code> (untuk Android) dan <code className="text-sky-300">.HTML</code> (untuk iPhone/iOS &amp; Android) berjalan mandiri di HP manapun tanpa meminta akses Google AI Studio. Saat dibuka, pengguna cukup login dengan <strong>Username &amp; Password</strong> (<code className="text-amber-300">budi</code>, <code className="text-emerald-300">admin</code>, atau <code className="text-blue-300">kepala</code>) dan semua transaksi langsung terintegrasi dengan Website via Cloud Relay!
                    </p>
                    {downloadStatusMsg && (
                      <p className="text-xs font-bold text-emerald-400 pt-1">
                        {downloadStatusMsg}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={handleSafeDownloadApk}
                      disabled={isDownloadingApk}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-60"
                    >
                      <FileDown className="w-4 h-4" />
                      <span>
                        {isDownloadingApk ? 'Menyiapkan .APK...' : 'Download .APK Android (v3.0)'}
                      </span>
                    </button>

                    <button
                      onClick={handleDownloadStandaloneHtml}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/40 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download App iOS / Android (.HTML)</span>
                    </button>

                    <button
                      onClick={handleShareApkToPhone}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer"
                    >
                      <Share className="w-3.5 h-3.5" />
                      <span>Kirim / Share File .APK ke HP</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Dual QR Codes (Hosted on Public Cloud CDN -> 0% chance of Google 403!) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm mb-1">
                      <QrCode className="w-4 h-4" />
                      <span>QR Code Cloud Publik (Bebas 403 di Semua HP)</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Scan dari kamera HP Android atau iPhone manapun. Link ini di-hosting di <strong>Public Cloud Mirror</strong> sehingga tidak pernah meminta login Google:
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex flex-col items-center p-2.5 bg-white rounded-xl shadow-inner">
                      {qrApkDownloadDataUrl ? (
                        <img
                          src={qrApkDownloadDataUrl}
                          alt="QR Download APK"
                          className="w-28 h-28 object-contain"
                        />
                      ) : (
                        <div className="w-28 h-28 flex items-center justify-center text-slate-400 text-xs">
                          Memuat QR...
                        </div>
                      )}
                      <span className="mt-1.5 text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider text-center">
                        QR Download .APK (Android)
                      </span>
                    </div>

                    <div className="flex flex-col items-center p-2.5 bg-white rounded-xl shadow-inner">
                      {qrOpenAppDataUrl ? (
                        <img
                          src={qrOpenAppDataUrl}
                          alt="QR App iOS & Android"
                          className="w-28 h-28 object-contain"
                        />
                      ) : (
                        <div className="w-28 h-28 flex items-center justify-center text-slate-400 text-xs">
                          Memuat QR...
                        </div>
                      )}
                      <span className="mt-1.5 text-[10px] font-extrabold text-slate-900 uppercase tracking-wider text-center">
                        QR App iOS / Android
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={apkDownloadUrl}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-[11px] text-emerald-300 font-mono"
                    />
                    <button
                      onClick={handleCopyApkLink}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedApkLink ? (
                        <Check className="w-3.5 h-3.5 text-white" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedApkLink ? 'Tersalin' : 'Salin .APK'}</span>
                    </button>
                  </div>
                </div>

                {/* Right Card: Credentials & Role Workflow */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 flex flex-col justify-between space-y-3">
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-sky-400 font-bold text-sm">
                      <Smartphone className="w-4 h-4" />
                      <span>Login Username &amp; Password di APK / iOS</span>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-700 space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="text-amber-300 font-bold">1. Pemohon SIV</span>
                        <code className="text-slate-200 font-mono">budi / user123</code>
                      </div>
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <span className="text-emerald-400 font-bold">2. Admin Gudang (Scan/ACC)</span>
                        <code className="text-slate-200 font-mono">admin / admin123</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-blue-400 font-bold">3. Kepala Gudang (Approve Stok)</span>
                        <code className="text-slate-200 font-mono">kepala / kepala123</code>
                      </div>
                    </div>

                    {isInstalled ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold pt-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>WebAPK Sudah Terinstal di Perangkat Ini</span>
                      </div>
                    ) : isInstallable ? (
                      <button
                        onClick={install}
                        className="w-full py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Install WebAPK Langsung ke HP</span>
                      </button>
                    ) : null}
                  </div>

                  <button
                    onClick={handleCopyAppLink}
                    className="w-full py-2 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {copiedAppLink ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span>
                      {copiedAppLink
                        ? 'Link App iOS/Android Tersalin!'
                        : 'Salin Link App iOS / Android'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Real-Time Multi-User & Multi-Device Sync Status */}
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Wifi
                      className={`w-5 h-5 ${
                        isConnected ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Integrasi Database Real-Time (Website ↔ Android .APK ↔ iOS)</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                          Revisi #{revision}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Aktivitas Terakhir:{' '}
                        <strong className="text-slate-200">
                          {syncStatus?.lastActionSummary || 'Siap menerima transaksi'}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleManualSync}
                    disabled={isSyncingManual}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingManual ? 'animate-spin' : ''}`} />
                    <span>Sinkronkan Sekarang</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-700/70">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      Perangkat &amp; Pengguna yang Sedang Terhubung ({connectedDevices.length}{' '}
                      Aktif):
                    </span>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {connectedDevices.map((dev) => (
                      <div
                        key={dev.clientId}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-700/80 text-xs"
                      >
                        {dev.deviceType === 'ANDROID' ? (
                          <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Monitor className="w-4 h-4 text-sky-400 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-200 truncate">{dev.userName}</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {dev.deviceType} • {dev.userRole}
                          </p>
                        </div>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                      </div>
                    ))}
                    {connectedDevices.length === 0 && (
                      <div className="text-xs text-slate-400 col-span-full">
                        Menghubungkan perangkat ({currentUser?.name || 'Pengguna'})...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
