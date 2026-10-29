import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  BellRing,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Boxes,
  ClipboardList,
  CheckCircle2,
  Lock,
  Pause,
  Play,
} from 'lucide-react';

interface AnnouncementSliderProps {
  isAdmin: boolean;
  onOpenCreateLPB: () => void;
  onOpenCreateVoucher: () => void;
  onNavigateTab: (tab: string) => void;
  pendingCount: number;
  lowStockCount: number;
}

interface SlideItem {
  id: string;
  tag: string;
  tagColor: string;
  title: string;
  highlight: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  primaryActionLabel: string;
  primaryAction: () => void;
  secondaryActionLabel?: string;
  secondaryAction?: () => void;
  badgeInfo?: string;
  gradient: string;
}

export const AnnouncementSlider: React.FC<AnnouncementSliderProps> = ({
  isAdmin,
  onOpenCreateLPB,
  onOpenCreateVoucher,
  onNavigateTab,
  pendingCount,
  lowStockCount,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const slides: SlideItem[] = [
    {
      id: 'slide-siv',
      tag: 'SOP PENGELUARAN BARANG',
      tagColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      title: 'Nota SIV Terbit',
      highlight: 'Stok Belum Berkurang Hingga ACC & Serah Fisik Admin',
      description:
        'Saat user menerbitkan nota pengambilan (Store Issue Voucher), stok fisik di rak tetap aman & dicadangkan. Stok resmi dipotong hanya setelah Admin Gudang melakukan ACC dan menyerahkan barang fisik. Dokumen langsung terkunci & notifikasi real-time terkirim ke pemohon.',
      icon: ArrowUpRight,
      primaryActionLabel: 'Buat Nota Pengambilan (SIV)',
      primaryAction: onOpenCreateVoucher,
      secondaryActionLabel: 'Lihat Daftar Nota',
      secondaryAction: () => onNavigateTab('vouchers'),
      badgeInfo: pendingCount > 0 ? `${pendingCount} Menunggu ACC Admin` : 'Antrean Bersih',
      gradient: 'from-slate-900 via-slate-900 to-amber-950/40',
    },
    {
      id: 'slide-lpb',
      tag: 'SOP PENERIMAAN BARANG',
      tagColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      title: 'Penerimaan SJ Supplier',
      highlight: 'Tambah Stok Fisik Otomatis & Terbit Laporan LPB Resmi',
      description:
        'Admin mencatat barang masuk berdasarkan Surat Jalan (SJ) Supplier, nomor PO, batch/lot, dan plat nomor kendaraan. Stok fisik langsung bertambah di master inventaris dan dokumen Laporan Penerimaan Barang (LPB) siap dicetak untuk arsip audit.',
      icon: ArrowDownLeft,
      primaryActionLabel: isAdmin ? 'Input SJ Supplier (LPB)' : 'Lihat Laporan LPB',
      primaryAction: isAdmin ? onOpenCreateLPB : () => onNavigateTab('lpb'),
      secondaryActionLabel: 'Katalog Master Stok',
      secondaryAction: () => onNavigateTab('items'),
      badgeInfo: 'Integrasi SJ Supplier & PO',
      gradient: 'from-slate-900 via-slate-900 to-emerald-950/40',
    },
    {
      id: 'slide-realtime',
      tag: 'SISTEM NOTIFIKASI REAL-TIME',
      tagColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      title: 'Notifikasi Multi-Layar & Chime',
      highlight: 'Peringatan Instan ke Pemohon Saat Nota Disetujui',
      description:
        'Dilengkapi teknologi BroadcastChannel & Web Audio synthesizer. Ketika admin menyetujui nota di komputernya, layar pemohon langsung memunculkan pop-up toast interaktif disertai nada dering, tanpa perlu me-refresh halaman.',
      icon: BellRing,
      primaryActionLabel: 'Lihat Riwayat Nota',
      primaryAction: () => onNavigateTab('vouchers'),
      secondaryActionLabel: 'Buka Kartu Mutasi',
      secondaryAction: () => onNavigateTab('ledger'),
      badgeInfo: 'Web Audio Chime Active',
      gradient: 'from-slate-900 via-slate-900 to-blue-950/40',
    },
    {
      id: 'slide-lock',
      tag: 'KEAMANAN & SAFETY STOCK',
      tagColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      title: 'Proteksi Dokumen Terkunci',
      highlight: 'Anti-Edit & Anti-Hapus Pasca ACC + Kontrol Stok Menipis',
      description:
        'Setelah status nota berubah menjadi APPROVED, hak edit, hapus, dan ubah kuantiti otomatis dinonaktifkan permanen demi transparansi audit. Pantau barang dengan stok di bawah ambang batas aman (safety stock).',
      icon: Lock,
      primaryActionLabel: 'Cek Master Stok & Safety Stock',
      primaryAction: () => onNavigateTab('items'),
      secondaryActionLabel: 'Kartu Stok Mutasi',
      secondaryAction: () => onNavigateTab('ledger'),
      badgeInfo: lowStockCount > 0 ? `${lowStockCount} SKU Perlu Restock` : 'Level Stok Aman',
      gradient: 'from-slate-900 via-slate-900 to-indigo-950/40',
    },
  ];

  // Auto-play timer
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5500);
    return () => clearInterval(interval);
  }, [isPaused, slides.length]);

  const handlePrev = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartX.current = null;
  };

  const slide = slides[currentSlide];
  const SlideIcon = slide.icon;

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-slate-900 text-white select-none transition-all duration-300"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Gradient & Pattern */}
      <div
        className={`absolute inset-0 bg-gradient-to-r ${slide.gradient} transition-all duration-700 opacity-90`}
      />
      <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

      {/* Decorative Glow Icon */}
      <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none transform rotate-12 scale-150 hidden sm:block">
        <SlideIcon className="w-80 h-80 text-white" />
      </div>

      {/* Slide Content */}
      <div className="relative z-10 p-5 sm:p-7 md:p-8 flex flex-col justify-between min-h-[260px] sm:min-h-[240px]">
        {/* Top Tag & Slide Indicators */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider border ${slide.tagColor}`}
            >
              <SlideIcon className="w-3.5 h-3.5" />
              {slide.tag}
            </span>

            {slide.badgeInfo && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/10 text-slate-200 border border-white/10">
                {slide.badgeInfo}
              </span>
            )}
          </div>

          {/* Pause / Play + Slide Counter */}
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title={isPaused ? 'Lanjutkan Auto-Slide' : 'Jeda Auto-Slide'}
              aria-label={isPaused ? 'Play slider' : 'Pause slider'}
            >
              {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3" />}
            </button>
            <span className="text-[11px]">
              <strong className="text-white">{currentSlide + 1}</strong> / {slides.length}
            </span>
          </div>
        </div>

        {/* Center: Title & Description */}
        <div className="my-2 space-y-2">
          <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
            {slide.title} &mdash;{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-emerald-300 to-teal-200">
              {slide.highlight}
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-4xl line-clamp-3 sm:line-clamp-none">
            {slide.description}
          </p>
        </div>

        {/* Bottom Actions & Controls */}
        <div className="pt-4 mt-2 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={slide.primaryAction}
              className="inline-flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white text-slate-900 hover:bg-slate-100 transition-all shadow-md active:scale-95"
            >
              <span>{slide.primaryActionLabel}</span>
              <ArrowRight className="w-4 h-4 text-slate-700" />
            </button>

            {slide.secondaryAction && slide.secondaryActionLabel && (
              <button
                onClick={slide.secondaryAction}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all active:scale-95"
              >
                <span>{slide.secondaryActionLabel}</span>
              </button>
            )}
          </div>

          {/* Arrow Navigation & Dots */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            {/* Dots */}
            <div className="flex items-center gap-1.5">
              {slides.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    currentSlide === idx
                      ? 'w-6 bg-emerald-400'
                      : 'w-2 bg-white/30 hover:bg-white/50'
                  }`}
                  aria-label={`Ke slide ${idx + 1}`}
                />
              ))}
            </div>

            {/* Prev / Next Arrows */}
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition-colors active:scale-90"
                aria-label="Slide sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-white transition-colors active:scale-90"
                aria-label="Slide berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Top running progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
        <div
          key={currentSlide}
          className={`h-full bg-gradient-to-r from-emerald-400 to-amber-400 ${
            !isPaused ? 'transition-all duration-[5500ms] w-full ease-linear' : 'w-0'
          }`}
          style={{ width: isPaused ? '100%' : undefined }}
        />
      </div>
    </div>
  );
};
