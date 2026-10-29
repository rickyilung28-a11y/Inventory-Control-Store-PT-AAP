import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useInventory } from '../context/InventoryContext';
import { MovementVelocityCategory } from '../types/inventory';
import { PrintStockLedgerModal } from '../components/PrintStockLedgerModal';
import {
  ClipboardList,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Flame,
  Activity,
  Gauge,
  FileSpreadsheet,
  FileText,
  Printer,
  Calendar,
  RotateCcw,
} from 'lucide-react';

interface StockMovementViewProps {
  preselectedSku?: string;
}

export const StockMovementView: React.FC<StockMovementViewProps> = ({ preselectedSku }) => {
  const { currentUser, stockMovements, stockItems, getItemMovementAnalytics, companyProfile } =
    useInventory();

  const [selectedSku, setSelectedSku] = useState<string>(preselectedSku || 'ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [velocityFilter, setVelocityFilter] = useState<'ALL' | MovementVelocityCategory>('ALL');
  const [activeTab, setActiveTab] = useState<'MUTATION_LOG' | 'VELOCITY_ANALYSIS'>('MUTATION_LOG');
  const [searchQuery, setSearchQuery] = useState('');

  // Rentang Tanggal Filter untuk Kartu Stok & Cetak PDF / Excel
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isPrintLedgerOpen, setIsPrintLedgerOpen] = useState<boolean>(false);

  useEffect(() => {
    if (preselectedSku) {
      setSelectedSku(preselectedSku);
    }
  }, [preselectedSku]);

  // Helper untuk preset rentang tanggal cepat
  const applyDatePreset = (preset: 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'THIS_MONTH') => {
    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const now = new Date();
    const toYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (preset === 'TODAY') {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'LAST_7_DAYS') {
      const past = new Date(now);
      past.setDate(now.getDate() - 7);
      setStartDate(toYMD(past));
      setEndDate(toYMD(now));
    } else if (preset === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toYMD(firstDay));
      setEndDate(toYMD(now));
    }
  };

  // Movements filtered by SKU, Type, Velocity, and Search (passed to PrintStockLedgerModal which also applies date range)
  const baseFilteredMovements = useMemo(() => {
    return stockMovements.filter((mov) => {
      if (selectedSku !== 'ALL' && mov.sku !== selectedSku) return false;
      if (typeFilter !== 'ALL' && mov.type !== typeFilter) return false;
      if (velocityFilter !== 'ALL') {
        const analytics = getItemMovementAnalytics(mov.itemId);
        if (analytics.category !== velocityFilter) return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        mov.sku.toLowerCase().includes(q) ||
        mov.itemName.toLowerCase().includes(q) ||
        mov.referenceNumber.toLowerCase().includes(q) ||
        (mov.secondaryRef && mov.secondaryRef.toLowerCase().includes(q)) ||
        mov.actor.toLowerCase().includes(q)
      );
    });
  }, [stockMovements, selectedSku, typeFilter, velocityFilter, searchQuery, getItemMovementAnalytics]);

  // Movements also filtered by Date Range (Dari Tanggal s/d Sampai Tanggal)
  const filteredMovements = useMemo(() => {
    return baseFilteredMovements.filter((mov) => {
      if (!startDate && !endDate) return true;
      const movDate = new Date(mov.date);
      if (isNaN(movDate.getTime())) return true;

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (movDate < start) return false;
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999`);
        if (movDate > end) return false;
      }
      return true;
    });
  }, [baseFilteredMovements, startDate, endDate]);

  // Summary statistics for currently filtered view
  const stats = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    filteredMovements.forEach((m) => {
      if (m.type === 'IN') totalIn += m.quantity;
      if (m.type === 'OUT') totalOut += m.quantity;
    });
    return { totalIn, totalOut };
  }, [filteredMovements]);

  // Item Outbound Velocity Analysis List
  const itemVelocityList = useMemo(() => {
    return stockItems
      .map((item) => {
        const analytics = getItemMovementAnalytics(item.id);
        return {
          item,
          ...analytics,
        };
      })
      .filter((entry) => {
        if (velocityFilter !== 'ALL' && entry.category !== velocityFilter) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          entry.item.sku.toLowerCase().includes(q) ||
          entry.item.name.toLowerCase().includes(q) ||
          entry.item.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.totalOutQty - a.totalOutQty || b.outboundFrequency - a.outboundFrequency);
  }, [stockItems, getItemMovementAnalytics, velocityFilter, searchQuery]);

  const velocityCounts = useMemo(() => {
    let fast = 0;
    let medium = 0;
    let low = 0;
    stockItems.forEach((item) => {
      const c = getItemMovementAnalytics(item.id).category;
      if (c === 'FAST_MOVING') fast++;
      else if (c === 'MEDIUM_MOVING') medium++;
      else low++;
    });
    return { fast, medium, low };
  }, [stockItems, getItemMovementAnalytics]);

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const formatReadableDate = (yyyyMmDd: string) => {
    if (!yyyyMmDd) return '';
    try {
      const [y, m, d] = yyyyMmDd.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return yyyyMmDd;
    }
  };

  // Export Excel (.xlsx) menggantikan format CSV
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const periodInfo =
      startDate || endDate
        ? `${startDate ? formatReadableDate(startDate) : 'Awal'} s/d ${
            endDate ? formatReadableDate(endDate) : 'Sekarang'
          }`
        : 'Semua Rentang Tanggal';

    // Sheet 1: Kartu Stok & Riwayat Mutasi
    const ledgerHeaders = [
      [companyProfile.companyName || 'PT. ABADI AGROSINDO PERSADA'],
      ['KARTU STOK & LAPORAN MUTASI BARANG'],
      [`Filter Material Code: ${selectedSku === 'ALL' ? 'Semua Barang' : selectedSku} | Periode: ${periodInfo}`],
      [],
      [
        'No',
        'Waktu Transaksi',
        'Material Code',
        'Nama Barang',
        'Tipe Aliran',
        'Kategori Keluar',
        'No. Referensi (SIV / LPB)',
        'Pihak / Keterangan',
        'Stock Awal',
        'Masuk',
        'Keluar',
        'Saldo Akhir',
        'Petugas',
        'Catatan',
      ],
    ];

    const ledgerRows = filteredMovements.map((m, idx) => [
      idx + 1,
      formatDateTime(m.date),
      m.sku,
      m.itemName,
      m.type === 'IN' ? 'MASUK (LPB)' : 'KELUAR (SIV)',
      getItemMovementAnalytics(m.itemId).label,
      m.referenceNumber,
      m.secondaryRef || '-',
      m.balanceBefore,
      m.type === 'IN' ? m.quantity : 0,
      m.type === 'OUT' ? m.quantity : 0,
      m.balanceAfter,
      m.actor,
      m.notes || '-',
    ]);

    const wsLedger = XLSX.utils.aoa_to_sheet([...ledgerHeaders, ...ledgerRows]);
    wsLedger['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 16 },
      { wch: 34 },
      { wch: 15 },
      { wch: 18 },
      { wch: 20 },
      { wch: 28 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, wsLedger, 'Kartu Stok Mutasi');

    // Sheet 2: Analisa Fast / Medium / Low Moving
    const velocityHeaders = [
      [companyProfile.companyName || 'PT. ABADI AGROSINDO PERSADA'],
      ['ANALISA PERGERAKAN KELUAR BARANG (FAST / MEDIUM / LOW MOVING)'],
      [],
      [
        'No',
        'Material Code',
        'Nama Barang',
        'Kategori Sub-Master',
        'Satuan',
        'Stok Saat Ini',
        'Stock Minimum',
        'Total Qty Keluar',
        'Frekuensi Keluar (SIV)',
        'Rasio Perputaran (%)',
        'Kategori Pergerakan',
      ],
    ];

    const velocityRows = itemVelocityList.map(
      ({ item, label, totalOutQty, outboundFrequency, turnoverRatio }, idx) => [
        idx + 1,
        item.sku,
        item.name,
        item.category,
        item.unit,
        item.currentStock,
        item.minStock,
        totalOutQty,
        outboundFrequency,
        Number((turnoverRatio * 100).toFixed(1)),
        label,
      ]
    );

    const wsVelocity = XLSX.utils.aoa_to_sheet([...velocityHeaders, ...velocityRows]);
    wsVelocity['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 34 },
      { wch: 22 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 20 },
      { wch: 20 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(wb, wsVelocity, 'Analisa Pergerakan');

    const dateSuffix =
      startDate || endDate
        ? `${startDate || 'Awal'}_sd_${endDate || 'Akhir'}`
        : new Date().toISOString().slice(0, 10);

    XLSX.writeFile(wb, `Kartu_Stok_${selectedSku}_${dateSuffix}.xlsx`);
  };

  const renderVelocityBadge = (cat: MovementVelocityCategory) => {
    if (cat === 'FAST_MOVING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-orange-100 text-orange-900 border border-orange-300">
          <Flame className="w-3 h-3 text-orange-600" />
          Fast Moving
        </span>
      );
    }
    if (cat === 'MEDIUM_MOVING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
          <Activity className="w-3 h-3 text-blue-600" />
          Medium Moving
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
        <Gauge className="w-3 h-3 text-slate-500" />
        Low Moving
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header & Summary */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-slate-700" />
              <span>Kartu Stok &amp; Analisa Pergerakan Keluar Barang</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Buku besar pergerakan masuk (LPB) &amp; keluar (SIV) beserta cetak Kartu Stok PDF &amp; unduh Excel berdasarkan rentang tanggal.
            </p>
          </div>

          {/* Summary KPI Pills & Export PDF / Excel */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs">
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              <span className="text-emerald-800">Total Masuk:</span>
              <span className="font-mono font-bold text-emerald-950">+{stats.totalIn}</span>
            </div>

            <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs">
              <ArrowUpRight className="w-4 h-4 text-amber-600" />
              <span className="text-amber-800">Total Keluar:</span>
              <span className="font-mono font-bold text-amber-950">-{stats.totalOut}</span>
            </div>

            {/* Cetak / Export PDF Kartu Stok */}
            <button
              type="button"
              onClick={() => setIsPrintLedgerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
              title="Pratinjau Cetak & Export Kartu Stok ke format PDF A4 sesuai rentang tanggal"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cetak / Export PDF Kartu Stok</span>
            </button>

            {/* Unduh Excel (.xlsx) hanya untuk Superuser, Kepala Store, dan Admin */}
            {(currentUser?.role === 'superuser' ||
              currentUser?.role === 'kepala_gudang' ||
              currentUser?.role === 'admin') && (
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
                title="Unduh Kartu Stok & Analisa Pergerakan dalam format Microsoft Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Unduh Excel (.xlsx)</span>
              </button>
            )}
          </div>
        </div>

        {/* Analisa Kategori Keluar Barang Cards */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() =>
              setVelocityFilter(velocityFilter === 'FAST_MOVING' ? 'ALL' : 'FAST_MOVING')
            }
            className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
              velocityFilter === 'FAST_MOVING'
                ? 'bg-orange-600 text-white border-orange-600'
                : 'bg-orange-50/50 text-slate-900 border-orange-200 hover:bg-orange-50'
            }`}
          >
            <div>
              <div className="text-xs font-bold flex items-center gap-1.5">
                <Flame
                  className={`w-4 h-4 ${
                    velocityFilter === 'FAST_MOVING' ? 'text-white' : 'text-orange-600'
                  }`}
                />
                <span>Fast Moving (Keluar Cepat)</span>
              </div>
              <p
                className={`text-[11px] mt-0.5 ${
                  velocityFilter === 'FAST_MOVING' ? 'text-orange-100' : 'text-slate-600'
                }`}
              >
                {velocityCounts.fast} Material Code dengan perputaran keluar tinggi
              </p>
            </div>
            <span className="text-lg font-mono font-black">{velocityCounts.fast}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setVelocityFilter(velocityFilter === 'MEDIUM_MOVING' ? 'ALL' : 'MEDIUM_MOVING')
            }
            className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
              velocityFilter === 'MEDIUM_MOVING'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-blue-50/50 text-slate-900 border-blue-200 hover:bg-blue-50'
            }`}
          >
            <div>
              <div className="text-xs font-bold flex items-center gap-1.5">
                <Activity
                  className={`w-4 h-4 ${
                    velocityFilter === 'MEDIUM_MOVING' ? 'text-white' : 'text-blue-600'
                  }`}
                />
                <span>Medium Moving (Keluar Sedang)</span>
              </div>
              <p
                className={`text-[11px] mt-0.5 ${
                  velocityFilter === 'MEDIUM_MOVING' ? 'text-blue-100' : 'text-slate-600'
                }`}
              >
                {velocityCounts.medium} Material Code dengan perputaran keluar sedang
              </p>
            </div>
            <span className="text-lg font-mono font-black">{velocityCounts.medium}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setVelocityFilter(velocityFilter === 'LOW_MOVING' ? 'ALL' : 'LOW_MOVING')
            }
            className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
              velocityFilter === 'LOW_MOVING'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-slate-50 text-slate-900 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div>
              <div className="text-xs font-bold flex items-center gap-1.5">
                <Gauge
                  className={`w-4 h-4 ${
                    velocityFilter === 'LOW_MOVING' ? 'text-white' : 'text-slate-600'
                  }`}
                />
                <span>Low Moving (Keluar Lambat)</span>
              </div>
              <p
                className={`text-[11px] mt-0.5 ${
                  velocityFilter === 'LOW_MOVING' ? 'text-slate-200' : 'text-slate-600'
                }`}
              >
                {velocityCounts.low} Material Code jarang keluar / slow moving
              </p>
            </div>
            <span className="text-lg font-mono font-black">{velocityCounts.low}</span>
          </button>
        </div>

        {/* Filter Rentang Tanggal Dari - Sampai untuk Kartu Stok */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>Filter Rentang Tanggal Kartu Stok:</span>
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                <span className="text-slate-500 font-medium">Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs font-mono text-slate-900 focus:outline-hidden"
                />
              </div>

              <span className="text-slate-400 font-bold">s/d</span>

              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-slate-300">
                <span className="text-slate-500 font-medium">Sampai:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs font-mono text-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => applyDatePreset('TODAY')}
                className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium transition-colors"
              >
                Hari Ini
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('LAST_7_DAYS')}
                className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium transition-colors"
              >
                7 Hari Terakhir
              </button>
              <button
                type="button"
                onClick={() => applyDatePreset('THIS_MONTH')}
                className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium transition-colors"
              >
                Bulan Ini
              </button>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => applyDatePreset('ALL')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Tanggal</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-600 font-mono">
              Hasil Filter: <strong>{filteredMovements.length}</strong> mutasi
            </span>
            <button
              type="button"
              onClick={() => setIsPrintLedgerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-colors shadow-2xs"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Export PDF Periode Ini</span>
            </button>
          </div>
        </div>

        {/* Mode Switcher & Filter Bar */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* View Tab Switch */}
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('MUTATION_LOG')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'MUTATION_LOG'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Riwayat Transaksi Mutasi
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('VELOCITY_ANALYSIS')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                  activeTab === 'VELOCITY_ANALYSIS'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabel Analisa Fast / Medium / Low Moving
              </button>
            </div>

            {activeTab === 'MUTATION_LOG' && (
              <>
                <select
                  value={selectedSku}
                  onChange={(e) => setSelectedSku(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="ALL">Semua Barang ({stockItems.length} Material Code)</option>
                  {stockItems.map((item) => (
                    <option key={item.id} value={item.sku}>
                      {item.sku} — {item.name} (Min: {item.minStock} {item.unit})
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                  <button
                    onClick={() => setTypeFilter('ALL')}
                    className={`px-2.5 py-1 rounded-md font-medium ${
                      typeFilter === 'ALL' ? 'bg-white shadow-2xs text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    onClick={() => setTypeFilter('IN')}
                    className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 ${
                      typeFilter === 'IN'
                        ? 'bg-white shadow-2xs text-emerald-900'
                        : 'text-slate-600'
                    }`}
                  >
                    <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                    Masuk (SJ/LPB)
                  </button>
                  <button
                    onClick={() => setTypeFilter('OUT')}
                    className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 ${
                      typeFilter === 'OUT'
                        ? 'bg-white shadow-2xs text-amber-900'
                        : 'text-slate-600'
                    }`}
                  >
                    <ArrowUpRight className="w-3 h-3 text-amber-600" />
                    Keluar (Nota SIV)
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Search */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Material Code, barang, no nota..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:bg-white focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* TAB 2: TABEL ANALISA KATEGORI KELUAR BARANG (FAST / MEDIUM / LOW MOVING) */}
      {activeTab === 'VELOCITY_ANALYSIS' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Material Code</th>
                  <th className="px-4 py-3">Nama Barang</th>
                  <th className="px-4 py-3">Kategori Sub-Master</th>
                  <th className="px-4 py-3 text-right">Stok Saat Ini</th>
                  <th className="px-4 py-3 text-center bg-amber-50/70 text-amber-950">
                    Stock Minimum
                  </th>
                  <th className="px-4 py-3 text-right">Total Qty Keluar</th>
                  <th className="px-4 py-3 text-center">Frekuensi Keluar (SIV)</th>
                  <th className="px-4 py-3 text-center">Rasio Perputaran</th>
                  <th className="px-4 py-3 text-center">Kategori Pergerakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemVelocityList.map(
                  ({ item, category, totalOutQty, outboundFrequency, turnoverRatio }) => (
                    <tr key={item.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{item.sku}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{item.name}</td>
                      <td className="px-4 py-3 text-slate-600">{item.category}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                        {item.currentStock} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold bg-amber-50/40 text-amber-950">
                        {item.minStock} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-amber-800">
                        {totalOutQty} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-700">
                        {outboundFrequency}x Transaksi
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-slate-600">
                        {(turnoverRatio * 100).toFixed(0)}% dari Min
                      </td>
                      <td className="px-4 py-3 text-center">{renderVelocityBadge(category)}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 1: Movement Table on Desktop */}
      {activeTab === 'MUTATION_LOG' && (
        <>
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Waktu Transaksi</th>
                    <th className="px-4 py-3">Material Code</th>
                    <th className="px-4 py-3">Nama Barang</th>
                    <th className="px-4 py-3 text-center">Kategori Keluar</th>
                    <th className="px-4 py-3 text-center">Tipe Aliran</th>
                    <th className="px-4 py-3">No. Referensi Dokumen</th>
                    <th className="px-4 py-3">Pihak / Keterangan</th>
                    <th className="px-4 py-3 text-right">Stock Awal</th>
                    <th className="px-4 py-3 text-right">Mutasi Qty</th>
                    <th className="px-4 py-3 text-right">Saldo Akhir</th>
                    <th className="px-4 py-3">Petugas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-12 text-center text-slate-400">
                        Tidak ada riwayat mutasi yang cocok dengan filter rentang tanggal / pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredMovements.map((mov) => {
                      const isIn = mov.type === 'IN';
                      const velocity = getItemMovementAnalytics(mov.itemId);
                      return (
                        <tr key={mov.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-4 py-3 text-slate-500 whitespace-nowrap font-mono text-[11px]">
                            {formatDateTime(mov.date)}
                          </td>
                          <td className="px-4 py-3 font-mono font-medium text-slate-800">
                            {mov.sku}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {mov.itemName}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {renderVelocityBadge(velocity.category)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isIn ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                                MASUK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                KELUAR
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">
                            {mov.referenceNumber}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="font-medium text-slate-800">
                              {mov.secondaryRef || '-'}
                            </div>
                            {mov.notes && (
                              <div className="text-[11px] text-slate-400">{mov.notes}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-slate-600">
                            {mov.balanceBefore}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                            {isIn ? (
                              <span className="text-emerald-700">+{mov.quantity}</span>
                            ) : (
                              <span className="text-amber-700">-{mov.quantity}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-900">
                            {mov.balanceAfter}
                          </td>
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {mov.actor}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Movement Cards on Mobile */}
          <div className="md:hidden space-y-3">
            {filteredMovements.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-xs">
                Tidak ada riwayat mutasi yang cocok dengan filter rentang tanggal / pencarian.
              </div>
            ) : (
              filteredMovements.map((mov) => {
                const isIn = mov.type === 'IN';
                const velocity = getItemMovementAnalytics(mov.itemId);
                return (
                  <div
                    key={mov.id}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-900">
                            {mov.sku}
                          </span>
                          <span className="text-slate-400 text-[11px] font-mono">
                            {formatDateTime(mov.date)}
                          </span>
                        </div>
                        <div className="font-bold text-slate-900 mt-1">{mov.itemName}</div>
                        <div className="mt-1">{renderVelocityBadge(velocity.category)}</div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-[10px] ${
                          isIn
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {isIn ? (
                          <>
                            <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> MASUK
                          </>
                        ) : (
                          <>
                            <ArrowUpRight className="w-3 h-3 text-amber-600" /> KELUAR
                          </>
                        )}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg text-slate-700">
                      <div>
                        <div className="text-[10px] text-slate-500">No. Referensi:</div>
                        <div className="font-mono font-bold text-slate-900">
                          {mov.referenceNumber}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">Keterangan:</div>
                        <div className="truncate font-medium">{mov.secondaryRef || '-'}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-slate-600">
                      <span>
                        Petugas: <strong>{mov.actor}</strong>
                      </span>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm">
                          {isIn ? (
                            <span className="text-emerald-700">+{mov.quantity}</span>
                          ) : (
                            <span className="text-amber-700">-{mov.quantity}</span>
                          )}
                        </span>{' '}
                        <span className="text-slate-400 text-[11px]">
                          (Sisa: {mov.balanceAfter})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Modal Cetak & Export PDF Kartu Stok dengan Rentang Tanggal */}
      <PrintStockLedgerModal
        isOpen={isPrintLedgerOpen}
        onClose={() => setIsPrintLedgerOpen(false)}
        stockMovements={baseFilteredMovements}
        stockItems={stockItems}
        selectedSku={selectedSku === 'ALL' ? '' : selectedSku}
        typeFilter={typeFilter}
        initialStartDate={startDate}
        initialEndDate={endDate}
      />
    </div>
  );
};
