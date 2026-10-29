import React, { useState, useEffect } from 'react';
import { useInventory } from '../context/InventoryContext';
import {
  Building2,
  Image,
  Upload,
  RotateCcw,
  Save,
  CheckCircle2,
  MapPin,
  Sparkles,
  Layers,
} from 'lucide-react';

export const CompanySettingsView: React.FC = () => {
  const { companyProfile, updateCompanyProfile, resetCompanyProfile } = useInventory();

  const [appName, setAppName] = useState(companyProfile.appName);
  const [appTagline, setAppTagline] = useState(companyProfile.appTagline);
  const [companyName, setCompanyName] = useState(companyProfile.companyName);
  const [city, setCity] = useState(companyProfile.city);
  const [address, setAddress] = useState(companyProfile.address);
  const [phone, setPhone] = useState(companyProfile.phone || '');
  const [email, setEmail] = useState(companyProfile.email || '');
  const [sivDocCode, setSivDocCode] = useState(companyProfile.sivDocCode);
  const [lpbDocCode, setLpbDocCode] = useState(companyProfile.lpbDocCode);
  const [logoUrl, setLogoUrl] = useState(companyProfile.logoUrl || '');

  const [isSavedNotice, setIsSavedNotice] = useState(false);

  useEffect(() => {
    setAppName(companyProfile.appName);
    setAppTagline(companyProfile.appTagline);
    setCompanyName(companyProfile.companyName);
    setCity(companyProfile.city);
    setAddress(companyProfile.address);
    setPhone(companyProfile.phone || '');
    setEmail(companyProfile.email || '');
    setSivDocCode(companyProfile.sivDocCode);
    setLpbDocCode(companyProfile.lpbDocCode);
    setLogoUrl(companyProfile.logoUrl || '');
  }, [companyProfile]);

  // Handle Logo Image Upload & conversion to Base64
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          setLogoUrl(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetLogoToDefault = () => {
    setLogoUrl('/logo-aap.svg');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompanyProfile({
      appName: appName.trim() || 'SISTEM INVENTORY CONTROL STORE',
      appTagline: appTagline.trim() || 'PT ABADI AGROSINDO PERSADA',
      companyName: companyName.trim() || 'PT ABADI AGROSINDO PERSADA',
      city: city.trim() || 'Sidoarjo',
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      sivDocCode: sivDocCode.trim() || 'FR/AAP/G-STR/23/001',
      lpbDocCode: lpbDocCode.trim() || 'FR/AAP/G-LPB/23/002',
      logoUrl: logoUrl.trim(),
      permanentLoginUrl: companyProfile.permanentLoginUrl,
    });

    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 4000);
  };

  const handleFullReset = () => {
    resetCompanyProfile();
    setAppName('SISTEM INVENTORY CONTROL STORE');
    setAppTagline('PT ABADI AGROSINDO PERSADA');
    setCompanyName('PT ABADI AGROSINDO PERSADA');
    setCity('Sidoarjo');
    setAddress('Bakungtemenggungan Kec. Balongbendo Sidoarjo - Jawa Timur');
    setPhone('');
    setEmail('');
    setSivDocCode('FR/AAP/G-STR/23/001');
    setLpbDocCode('FR/AAP/G-LPB/23/002');
    setLogoUrl('/logo-aap.svg');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              Pengaturan Profil Perusahaan &amp; Branding
            </h1>
            <p className="text-xs text-slate-500">
              Kelola logo, nama aplikasi, dan data resmi perusahaan. Perubahan akan langsung terupdate di seluruh sistem dan dokumen PDF.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFullReset}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors shrink-0 self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset ke Default Pabrik</span>
        </button>
      </div>

      {isSavedNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Data identitas perusahaan berhasil diperbarui! Navbar, dokumen cetak Nota, dan LPB telah tersinkronisasi otomatis.
          </span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: Form Inputs */}
          <div className="lg:col-span-2 space-y-6">
            {/* Card: Logo & Branding Aplikasi */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Image className="w-4 h-4 text-emerald-600" />
                <span>Logo &amp; Nama Aplikasi</span>
              </h3>

              {/* Logo Section */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                {/* Logo Box Preview */}
                <div className="w-20 h-20 rounded-xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center p-2 shrink-0 overflow-hidden shadow-2xs">
                  <img
                    src={logoUrl || '/logo-aap.svg'}
                    alt="Logo Perusahaan"
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* Upload & Reset Buttons */}
                <div className="space-y-2 flex-1 text-xs">
                  <div className="font-semibold text-slate-800">
                    {logoUrl ? 'Logo Kustom Terpasang' : 'Menggunakan Logo Default (Tunas Tanaman PT. AAP)'}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Unggah logo instansi dalam format PNG, JPG, atau SVG (resolusi terbaik rasio 1:1 persegi atau horizontal transparan).
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer transition-colors shadow-2xs">
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Unggah Logo Baru</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/svg+xml, image/webp"
                        onChange={handleLogoFileChange}
                        className="hidden"
                      />
                    </label>

                    {logoUrl && (
                      <button
                        type="button"
                        onClick={handleResetLogoToDefault}
                        className="px-3 py-1.5 text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 font-semibold rounded-lg transition-colors"
                      >
                        Pakai Logo Default
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* App Name & Tagline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Aplikasi / Sistem <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="Contoh: GudangPresisi"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Tampil pada sudut kiri atas bilah navigasi utama
                  </p>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tagline / Sub-Label Aplikasi
                  </label>
                  <input
                    type="text"
                    value={appTagline}
                    onChange={(e) => setAppTagline(e.target.value)}
                    placeholder="Contoh: SISTEM INVENTORY"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden uppercase font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Tampil sebagai lencana hijau di samping nama aplikasi
                  </p>
                </div>
              </div>
            </div>

            {/* Card: Identitas Resmi Perusahaan & Legalitas */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4 text-xs">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Building2 className="w-4 h-4 text-blue-600" />
                <span>Identitas Resmi Perusahaan (Kop Dokumen Nota &amp; LPB)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nama Resmi Perusahaan / PT <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="PT ABADI AGROSINDO PERSADA"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-bold text-slate-900 uppercase"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kota / Wilayah Pabrik <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Sidoarjo"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alamat Lengkap Pabrik / Pergudangan
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Bakungtemenggungan Kec. Balongbendo Sidoarjo - Jawa Timur"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nomor Telepon / Kontak
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(Kosong)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alamat Email Logistik
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="(Kosong)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Form SOP Codes */}
              <div className="pt-3 border-t border-slate-100">
                <h4 className="font-semibold text-slate-800 mb-2">
                  Nomor Kode Form Standar Operasional (SOP ISO):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 mb-1">
                      Kode Form Nota Pengambilan Barang (SIV)
                    </label>
                    <input
                      type="text"
                      value={sivDocCode}
                      onChange={(e) => setSivDocCode(e.target.value)}
                      placeholder="Contoh: FR/AAP/G-STR/23/001"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono uppercase font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">
                      Kode Form Laporan Penerimaan Barang (LPB)
                    </label>
                    <input
                      type="text"
                      value={lpbDocCode}
                      onChange={(e) => setLpbDocCode(e.target.value)}
                      placeholder="Contoh: FR/AAP/G-LPB/23/002"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-slate-900 focus:outline-hidden font-mono uppercase font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Action Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors shadow-sm"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Seluruh Perubahan Identitas</span>
              </button>
            </div>
          </div>

          {/* Column 3: Live Real-time Document Preview */}
          <div className="space-y-4">
            <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Sparkles className="w-4 h-4" />
                <span>Pratinjau Live Header Dokumen</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Header di bawah menggambarkan bagaimana kop surat Nota dan LPB akan dicetak secara fisik maupun saat diekspor ke PDF.
              </p>

              {/* Mini Document Paper Preview */}
              <div className="bg-white text-slate-900 p-3.5 rounded-xl border border-slate-300 shadow-inner text-xs space-y-2">
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={logoUrl || '/logo-aap.svg'}
                      alt="Logo"
                      className="w-9 h-9 object-contain shrink-0"
                    />
                    <div>
                      <div className="font-extrabold text-[11px] leading-tight uppercase">
                        {companyName || 'NAMA PERUSAHAAN'}
                      </div>
                      <div className="text-[9.5px] font-bold text-slate-700">{city || 'Kota'}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="inline-block border border-slate-900 px-1.5 py-0.2 font-bold font-mono text-[8px] bg-slate-50">
                      {sivDocCode}
                    </div>
                    <div className="text-[9px] font-mono mt-0.5 text-slate-600">No. Doc : NPB-XXXX</div>
                  </div>
                </div>

                <div className="text-center py-1">
                  <div className="font-black text-[10px] uppercase tracking-wider">
                    NOTA PENGAMBILAN BARANG
                  </div>
                  <div className="text-[8px] font-bold text-slate-600 uppercase">
                    STORE ISSUE VOUCHER
                  </div>
                </div>
              </div>
            </div>

            {/* Navbar Preview */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2 text-xs">
              <span className="font-bold text-slate-700 block text-[11px]">
                Pratinjau Bilah Navigasi:
              </span>
              <div className="p-3 bg-slate-900 rounded-xl flex items-center gap-2.5 text-white">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center p-1">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Layers className="w-4 h-4 text-emerald-400" />
                  )}
                </div>
                <div>
                  <span className="font-bold text-xs">{appName || 'GudangPresisi'}</span>
                  <span className="text-[9px] font-mono text-emerald-400 ml-2 px-1 py-0.2 rounded bg-emerald-950 border border-emerald-500/30">
                    {appTagline || 'SISTEM INVENTORY'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
