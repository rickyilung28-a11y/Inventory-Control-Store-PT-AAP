import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { useInventory } from '../context/InventoryContext';
import { resolvePermanentLoginUrl, getCachedLockedLoginUrl } from '../utils/loginUrl';
import {
  X,
  QrCode,
  Copy,
  Check,
  ShieldCheck,
  Users,
  ExternalLink,
  Lock,
  RefreshCw,
  Server,
  Download,
  Save,
} from 'lucide-react';

interface PublicAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PublicAccessModal: React.FC<PublicAccessModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, companyProfile, updateCompanyProfile } = useInventory();

  const [activeTab, setActiveTab] = useState<'link' | 'hosting'>('link');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [serverPermanentUrl, setServerPermanentUrl] = useState<string>(() =>
    getCachedLockedLoginUrl()
  );
  const [customDomainInput, setCustomDomainInput] = useState<string>(
    companyProfile?.permanentLoginUrl || ''
  );
  const [savedDomainNotice, setSavedDomainNotice] = useState(false);
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);

  const isSuperuser = currentUser?.role === 'superuser';

  const fetchActivePublicUrl = () => {
    setIsLoadingUrl(true);
    fetch('/api/public-url')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.permanentUrl || data?.publicUrl) {
          setServerPermanentUrl(data.permanentUrl || data.publicUrl);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingUrl(false));
  };

  useEffect(() => {
    if (!isOpen) return;
    if (!isSuperuser && activeTab === 'hosting') {
      setActiveTab('link');
    }
    setCustomDomainInput(companyProfile?.permanentLoginUrl || '');
    fetchActivePublicUrl();
  }, [isOpen, companyProfile?.permanentLoginUrl, isSuperuser, activeTab]);

  const loginUrl = resolvePermanentLoginUrl(
    serverPermanentUrl,
    companyProfile?.permanentLoginUrl
  );

  useEffect(() => {
    if (!isOpen || !loginUrl) return;
    QRCode.toDataURL(loginUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [loginUrl, isOpen]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(loginUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleLockPermanentUrl = async (urlToLock: string) => {
    if (!isSuperuser) return;
    const clean = urlToLock.trim().replace(/\/+$/, '');
    updateCompanyProfile({
      ...companyProfile,
      permanentLoginUrl: clean || undefined,
    });
    try {
      const res = await fetch('/api/public-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permanentUrl: clean }),
      });
      const data = await res.json();
      if (data?.permanentUrl || data?.publicUrl) {
        setServerPermanentUrl(data.permanentUrl || data.publicUrl);
      }
    } catch {
      // ignore
    }
    setSavedDomainNotice(true);
    setTimeout(() => setSavedDomainNotice(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                {isSuperuser
                  ? 'Link Login Tetap & Panduan Pindah Hosting Mandiri'
                  : 'Link Login Publik Tetap & QR Code'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isSuperuser
                  ? 'Tetapkan link login tetap (bebas 403) atau pindahkan ke hosting/domain permanen perusahaan.'
                  : 'Bagikan link login publik tetap atau scan QR Code untuk akses aplikasi di HP maupun PC.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-navigation Tabs (Superuser Only) */}
        {isSuperuser && (
          <div className="bg-slate-100 px-5 pt-3 border-b border-slate-200 flex gap-2 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('link')}
              className={`px-4 py-2 rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'link'
                  ? 'bg-white text-emerald-700 border-slate-200'
                  : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Link Login Tetap &amp; QR Code</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hosting')}
              className={`px-4 py-2 rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'hosting'
                  ? 'bg-white text-indigo-700 border-slate-200'
                  : 'bg-transparent text-slate-600 border-transparent hover:text-slate-900'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Langkah Pindah ke Hosting Lain</span>
            </button>
          </div>
        )}

        {!isSuperuser || activeTab === 'link' ? (
          <div className="p-5 sm:p-6 space-y-4 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-5">
              {qrDataUrl && (
                <div className="keep-light-surface bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs shrink-0">
                  <img
                    src={qrDataUrl}
                    alt="QR Code Login Aplikasi"
                    className="w-36 h-36 object-contain"
                  />
                  <div className="text-[10px] text-center font-mono text-slate-600 mt-1">
                    Scan QR untuk Buka Login
                  </div>
                </div>
              )}

              <div className="flex-1 space-y-3 w-full">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Link Login Publik Tetap (Terkunci)</span>
                  </span>
                  <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                    Bagikan link di bawah ini kepada seluruh staf untuk login di HP maupun PC tanpa blokir 403.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={loginUrl}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-800 select-all focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shrink-0 transition-colors shadow-2xs cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Salin Link</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <a
                    href={loginUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 font-semibold text-xs underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka Link Login di Tab Baru</span>
                  </a>

                  <button
                    type="button"
                    onClick={fetchActivePublicUrl}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUrl ? 'animate-spin' : ''}`} />
                    <span>Sinkronkan Status Link</span>
                  </button>
                </div>
              </div>
            </div>

            {isSuperuser && (
              <>
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Tetapkan / Kunci Link Domain Permanen (Khusus Superuser):</span>
                    </label>
                    {savedDomainNotice && (
                      <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Link Login Berhasil Dikunci!
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={customDomainInput}
                      onChange={(e) => setCustomDomainInput(e.target.value)}
                      placeholder="Contoh: https://store.abadiagrosindo.com atau kosongkan untuk link tunnel aktif"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs text-slate-800 focus:border-indigo-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => handleLockPermanentUrl(customDomainInput || loginUrl)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shrink-0 cursor-pointer"
                    >
                      <Save className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tetapkan Link Ini</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Klik <strong>Tetapkan Link Ini</strong> untuk mengunci URL login agar tersimpan di database utama.
                  </p>
                </div>

                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-[11px] text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Ingin Link Domain Permanen Selamanya (misal: store-aap.up.railway.app)?</strong> Buka tab{' '}
                    <button
                      type="button"
                      onClick={() => setActiveTab('hosting')}
                      className="underline font-bold text-indigo-700 cursor-pointer"
                    >
                      Langkah Pindah ke Hosting Lain
                    </button>{' '}
                    di atas untuk panduan memindahkan aplikasi &amp; database ke server mandiri.
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="p-5 sm:p-6 space-y-4 text-xs max-h-[70vh] overflow-y-auto">
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-indigo-950 text-xs">
                  1. Backup Database SQL (.sql) Saat Ini
                </h3>
                <p className="text-[11px] text-indigo-800 mt-0.5">
                  Seluruh 4.618+ master barang, Cost Center, GL Account, akun user, dan transaksi sudah tersimpan di dalam proyek &amp; file SQL.
                </p>
              </div>
              <a
                href="/api/database/export-sql"
                download
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shrink-0 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Database .SQL</span>
              </a>
            </div>

            <div className="space-y-3 text-slate-700 leading-relaxed">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <h4 className="font-bold text-slate-900 mb-1">
                  Langkah 1 — Download Source Code / Export ke GitHub
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>
                    Klik ikon <strong>Download / Export ZIP</strong> atau <strong>Save to GitHub</strong> di pojok kanan atas layar editor.
                  </li>
                  <li>
                    Folder <code className="px-1 py-0.5 bg-slate-200 rounded font-mono">data/default-inventory-state.json</code> dan <code className="px-1 py-0.5 bg-slate-200 rounded font-mono">data/shared-inventory-state.json</code> sudah berisi seluruh database barang (4.618 item), Cost Center, dan GL Account.
                  </li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                <h4 className="font-bold text-slate-900 mb-1">
                  Langkah 2 — Pilih Hosting Node.js dengan Domain Tetap (Permanen)
                </h4>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li>
                    <strong>Opsi A: Railway.app / Render.com (Paling Mudah &amp; Otomatis)</strong>: Login ke Railway.app atau Render.com &rarr; pilih <em>Deploy from GitHub repo</em> &rarr; otomatis mendapatkan domain tetap permanen (contoh: <code className="font-mono text-emerald-700">https://store-aap.up.railway.app</code>) yang tidak akan pernah berubah walaupun ada update kode.
                  </li>
                  <li>
                    <strong>Opsi B: Google Cloud Run (Satu Klik Deploy)</strong>: Klik tombol <strong>Deploy to Cloud Run</strong> di kanan atas editor untuk mendapatkan URL produksi tetap <code className="font-mono text-emerald-700">*.run.app</code> milik akun Google Cloud Anda sendiri.
                  </li>
                  <li>
                    <strong>Opsi C: VPS / Server Kantor Lokal (Ubuntu / Windows Server / cPanel Node.js)</strong>: Upload source code ke server, lalu jalankan perintah di Langkah 3.
                  </li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-900 text-slate-100">
                <h4 className="font-bold text-emerald-400 mb-1.5">
                  Langkah 3 — Perintah Menjalankan di Hosting / Server Baru
                </h4>
                <pre className="font-mono text-[11px] bg-slate-950 p-3 rounded-lg border border-slate-800 overflow-x-auto text-emerald-300">
{`# 1. Install seluruh paket
npm install

# 2. Build tampilan aplikasi produksi
npm run build

# 3. Jalankan server & database (Port 3000)
NODE_ENV=production npm run start`}
                </pre>
                <p className="text-[10.5px] text-slate-400 mt-2">
                  Tips VPS: Gunakan <code className="text-amber-300 font-mono">pm2 start &quot;NODE_ENV=production npm run start&quot; --name store-aap</code> agar aplikasi otomatis menyala 24 jam nonstop.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>
              Login Saat Ini: <strong>{currentUser?.name}</strong> (@{currentUser?.username})
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

