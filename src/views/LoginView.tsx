import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useTheme } from '../context/ThemeContext';
import {
  Boxes,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, companyProfile } = useInventory();
  const { theme, toggleTheme } = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim() || !password) {
      setErrorMsg('Mohon masukkan username dan password akun Anda.');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      const result = login(username, password);
      setIsLoading(false);
      if (!result.success && result.error) {
        setErrorMsg(result.error);
      }
    }, 200);
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden transition-colors ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Top-Right Theme Switcher Button */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold shadow-sm transition-colors cursor-pointer ${
            isDark
              ? 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
              : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
          }`}
          title="Ubah Tema Tampilan (Terang / Gelap)"
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Mode Terang</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-sky-600" />
              <span>Mode Gelap</span>
            </>
          )}
        </button>
      </div>

      {/* Background Subtle Gradient & Grid Pattern */}
      {isDark && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 -z-10" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0a_1px,transparent_1px)] bg-[size:32px_32px] -z-10" />
        </>
      )}

      {/* Main Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Brand Header */}
        <div className="text-center">
          {companyProfile?.logoUrl ? (
            <img
              src={companyProfile.logoUrl}
              alt="Logo Perusahaan"
              className={`w-14 h-14 object-contain rounded-2xl p-1.5 mx-auto mb-4 border ${
                isDark ? 'bg-white/10 border-slate-700' : 'bg-white border-slate-200 shadow-xs'
              }`}
            />
          ) : (
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 mb-4 shadow-lg shadow-emerald-950/20">
              <Boxes className="w-8 h-8" />
            </div>
          )}
          <h1
            className={`text-2xl font-bold tracking-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            {companyProfile?.appName || 'GudangPresisi'}
          </h1>
          <p
            className={`text-xs uppercase tracking-widest font-mono mt-1 font-bold ${
              isDark ? 'text-emerald-400' : 'text-emerald-700'
            }`}
          >
            {companyProfile?.companyName || 'PT. Abadi Agrosindo Persada'}
          </p>
          <p
            className={`text-xs mt-2 max-w-sm mx-auto ${
              isDark ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            Silakan login menggunakan Username dan Password akun masing-masing.
          </p>
        </div>

        {/* Login Card Box (Clean - No Quick Login) */}
        <div
          className={`mt-8 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-sm border ${
            isDark
              ? 'bg-slate-900/90 border-slate-800'
              : 'bg-white border-slate-200'
          }`}
        >
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 bg-red-950/70 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {/* Username Input */}
            <div>
              <label
                className={`block font-medium mb-1.5 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Username Pengguna
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Masukkan username akun Anda"
                  className={`w-full pl-9 pr-3 py-2.5 border rounded-xl placeholder-slate-500 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-hidden transition-colors ${
                    isDark
                      ? 'bg-slate-950/80 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                className={`block font-medium mb-1.5 ${
                  isDark ? 'text-slate-300' : 'text-slate-700'
                }`}
              >
                Kata Sandi (Password)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Masukkan password Anda"
                  className={`w-full pl-9 pr-10 py-2.5 border rounded-xl placeholder-slate-500 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-hidden transition-colors font-mono ${
                    isDark
                      ? 'bg-slate-950/80 border-slate-700 text-white'
                      : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-lg shadow-emerald-900/20 disabled:opacity-50 cursor-pointer"
              >
                <span>{isLoading ? 'Memverifikasi Akun...' : 'Masuk ke Sistem'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Alur SIV: Pemohon Terbitkan SIV &rarr; Kepala Store ACC &rarr; Admin Serahkan Barang (Otomatis Potong Stock)</span>
        </div>
      </div>
    </div>
  );
};
