import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { StockMovement, StockItem } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import {
  Printer,
  X,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Calendar,
  FileSpreadsheet,
  RotateCcw,
} from 'lucide-react';
import { exportElementToPdf, printElementDirectly } from '../utils/exportPdf';

interface PrintStockLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockMovements: StockMovement[];
  stockItems: StockItem[];
  selectedSku?: string;
  typeFilter: 'ALL' | 'IN' | 'OUT';
  initialStartDate?: string;
  initialEndDate?: string;
}

export const PrintStockLedgerModal: React.FC<PrintStockLedgerModalProps> = ({
  isOpen,
  onClose,
  stockMovements,
  stockItems,
  selectedSku = '',
  typeFilter,
  initialStartDate = '',
  initialEndDate = '',
}) => {
  const { companyProfile } = useInventory();
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [startDate, setStartDate] = useState<string>(initialStartDate);
  const [endDate, setEndDate] = useState<string>(initialEndDate);

  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStartDate(initialStartDate);
      setEndDate(initialEndDate);
    }
  }, [isOpen, initialStartDate, initialEndDate]);

  // Filter movements by date range (Dari Tanggal s/d Sampai Tanggal)
  const dateFilteredMovements = useMemo(() => {
    return stockMovements.filter((mov) => {
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
  }, [stockMovements, startDate, endDate]);

  if (!isOpen) return null;

  const selectedItemObj = stockItems.find((s) => s.sku === selectedSku);

  const periodSuffix =
    startDate || endDate
      ? `_${startDate || 'Awal'}_sd_${endDate || 'Akhir'}`
      : `_${new Date().toISOString().split('T')[0]}`;

  const docTitle = `Kartu_Stok_Mutasi_${selectedSku || 'Semua_Barang'}${periodSuffix}`;

  const formatReadableDate = (yyyyMmDd: string) => {
    if (!yyyyMmDd) return '';
    try {
      const [y, m, d] = yyyyMmDd.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return yyyyMmDd;
    }
  };

  const handlePrint = () => {
    if (printAreaRef.current) {
      printElementDirectly(
        printAreaRef.current,
        'Laporan Mutasi / Kartu Stock Barang',
        orientation
      );
    } else {
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current || isExporting) return;
    setIsExporting(true);
    setExportNotice(null);

    const filename = `${docTitle}.pdf`;

    const result = await exportElementToPdf(printAreaRef.current, {
      filename,
      title: 'Laporan Mutasi & Kartu Stock Barang A4',
      orientation: orientation,
      format: 'a4',
      marginMm: 8,
    });

    setIsExporting(false);

    if (result.success) {
      setExportNotice('Laporan Kartu Stock (Format PDF A4) berhasil diekspor dan diunduh!');
      setTimeout(() => setExportNotice(null), 4000);
    } else {
      setExportNotice(result.error || 'Gagal membuat file PDF. Silakan coba kembali.');
      setTimeout(() => setExportNotice(null), 5000);
    }
  };

  const handleDownloadExcel = () => {
    const wb = XLSX.utils.book_new();
    const headerRows = [
      [companyProfile.companyName || 'PT. ABADI AGROSINDO PERSADA'],
      ['KARTU STOK & LAPORAN MUTASI BARANG'],
      [
        `Barang: ${
          selectedItemObj
            ? `${selectedItemObj.sku} - ${selectedItemObj.name} (${selectedItemObj.unit})`
            : 'Semua Item Barang Master'
        }`,
      ],
      [
        `Periode Tanggal: ${
          startDate || endDate
            ? `${startDate ? formatReadableDate(startDate) : 'Awal'} s/d ${
                endDate ? formatReadableDate(endDate) : 'Sekarang'
              }`
            : 'Semua Rentang Tanggal'
        }`,
      ],
      [],
      [
        'No',
        'Tanggal & Waktu',
        'Material Code',
        'Nama Barang',
        'Tipe Aliran',
        'Stock Awal',
        'Masuk',
        'Keluar',
        'Stock Akhir',
        'No. Dokumen (SIV / LPB)',
        'Pihak / Keterangan',
        'Petugas',
        'Catatan',
      ],
    ];

    const dataRows = dateFilteredMovements.map((mov, idx) => {
      const isIn = mov.type === 'IN';
      return [
        idx + 1,
        formatDateTime(mov.date),
        mov.sku,
        mov.itemName,
        isIn ? 'MASUK (LPB)' : 'KELUAR (SIV)',
        mov.balanceBefore,
        isIn ? mov.quantity : 0,
        !isIn ? mov.quantity : 0,
        mov.balanceAfter,
        mov.referenceNumber,
        mov.secondaryRef || '-',
        mov.actor,
        mov.notes || '-',
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 16 },
      { wch: 34 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 26 },
      { wch: 18 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Kartu Stok');
    XLSX.writeFile(wb, `${docTitle}.xlsx`);
    setExportNotice('File Kartu Stock format Excel (.xlsx) berhasil diunduh!');
    setTimeout(() => setExportNotice(null), 4000);
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hour = String(d.getHours()).padStart(2, '0');
      const minute = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hour}:${minute}`;
    } catch {
      return iso;
    }
  };

  // Calculate totals
  const totalIn = dateFilteredMovements
    .filter((m) => m.type === 'IN')
    .reduce((sum, m) => sum + m.quantity, 0);

  const totalOut = dateFilteredMovements
    .filter((m) => m.type === 'OUT')
    .reduce((sum, m) => sum + m.quantity, 0);

  const latestBalance =
    dateFilteredMovements.length > 0
      ? dateFilteredMovements[0].balanceAfter
      : selectedItemObj?.currentStock ?? 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      {/* Modal Box */}
      <div className="print-modal-container relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-3 sm:my-6 max-h-[94vh] flex flex-col">
        {/* Top Control Bar */}
        <div className="no-print flex flex-col gap-2.5 px-4 sm:px-6 py-3 bg-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 truncate mr-2">
              <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="truncate">
                <span className="font-semibold text-xs sm:text-sm block truncate">
                  Pratinjau &amp; Ekspor PDF / Excel: Kartu Stock Barang A4
                </span>
                <span className="text-[10px] text-slate-300 hidden sm:block">
                  Format Kertas A4 Standar · Filter Rentang Tanggal Cetak Kartu Stock
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Orientation Toggle */}
              <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
                <button
                  type="button"
                  onClick={() => setOrientation('portrait')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    orientation === 'portrait'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Format A4 Tegak (Portrait)"
                >
                  A4 Portrait
                </button>
                <button
                  type="button"
                  onClick={() => setOrientation('landscape')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    orientation === 'landscape'
                      ? 'bg-emerald-600 text-white font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Format A4 Mendatar (Landscape)"
                >
                  A4 Landscape
                </button>
              </div>

              {/* Download Excel button */}
              <button
                type="button"
                onClick={handleDownloadExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-slate-800 hover:bg-slate-700 border border-emerald-500/40 rounded-lg transition-colors"
                title="Unduh Kartu Stock ini dalam format Microsoft Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Unduh Excel</span>
              </button>

              {/* Download PDF button */}
              <button
                onClick={handleDownloadPdf}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700/60 rounded-lg transition-colors shadow-xs"
                title="Unduh laporan Kartu Stock ini sebagai file PDF A4"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Membuat PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Export PDF A4</span>
                  </>
                )}
              </button>

              {/* Native print */}
              <button
                onClick={handlePrint}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-colors shadow-2xs"
              >
                <Printer className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Cetak</span>
              </button>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Interactive Date Range Filter Bar inside Print Modal */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <Calendar className="w-3.5 h-3.5" />
                <span>Filter Rentang Tanggal Cetak:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-300">Dari:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs text-white focus:outline-hidden focus:border-emerald-400"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] text-slate-300">Sampai:</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-md text-xs text-white focus:outline-hidden focus:border-emerald-400"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px]"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Tanggal</span>
                </button>
              )}
            </div>

            <div className="text-[11px] text-slate-300 font-mono">
              Menampilkan <strong className="text-emerald-400">{dateFilteredMovements.length}</strong> transaksi mutasi
            </div>
          </div>
        </div>

        {/* Feedback notice banner */}
        {exportNotice && (
          <div className="no-print px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{exportNotice}</span>
            </div>
            <button
              onClick={() => setExportNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Printable Document Sheet (Exact A4 size representation) */}
        <div
          ref={printAreaRef}
          className="p-5 sm:p-8 print-container text-slate-900 bg-white min-h-[500px] text-xs overflow-y-auto overflow-x-auto flex-1 select-text"
        >
          {/* Header Kop Surat Perusahaan */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {companyProfile.logoUrl ? (
                  <img
                    src={companyProfile.logoUrl}
                    alt="Logo"
                    className="w-12 h-12 object-contain"
                  />
                ) : (
                  <div className="w-11 h-11 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-sm tracking-wider font-mono">
                    AAP
                  </div>
                )}
                <div>
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 uppercase">
                    {companyProfile.companyName || 'PT. ABADI AGROSINDO PERSADA'}
                  </h1>
                  <p className="text-[11px] text-slate-700 font-semibold">
                    {companyProfile.city || 'Sidoarjo'} &middot;{' '}
                    {companyProfile.address || 'Kawasan Industri Pergudangan'}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Divisi Manajemen Pergudangan &amp; Logistik Stock Control
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="inline-block border border-slate-900 px-2 py-0.5 font-bold text-[9px] font-mono text-slate-900 uppercase tracking-wider bg-slate-50 mb-1">
                  BLANGKO RESMI A4 / KARTU STOK
                </div>
                <h2 className="text-sm sm:text-base font-black uppercase tracking-wider text-slate-900">
                  KARTU STOK &amp; LAPORAN MUTASI BARANG
                </h2>
                <div className="text-[10px] font-mono text-slate-600 font-semibold mt-0.5">
                  Periode:{' '}
                  {startDate || endDate
                    ? `${startDate ? formatReadableDate(startDate) : 'Awal'} s/d ${
                        endDate ? formatReadableDate(endDate) : 'Sekarang'
                      }`
                    : 'Semua Periode Transaksi'}
                </div>
                <div className="text-[9.5px] font-mono text-slate-500">
                  Tgl Cetak: {new Date().toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          </div>

          {/* Item Meta Information Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-300">
            <div>
              <span className="text-slate-500 block text-[11px]">Barang / Master Item:</span>
              <strong className="text-slate-900 text-xs font-mono">
                {selectedItemObj
                  ? `${selectedItemObj.sku} - ${selectedItemObj.name}`
                  : 'Semua Item Barang Master'}
              </strong>
              {selectedItemObj && (
                <div className="text-[11px] text-slate-600 mt-0.5">
                  Satuan: <strong>{selectedItemObj.unit}</strong> | Rak:{' '}
                  <strong>{selectedItemObj.location}</strong>
                </div>
              )}
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">
                Filter Aliran &amp; Rentang Tanggal:
              </span>
              <strong className="text-slate-900 text-xs block">
                {typeFilter === 'ALL'
                  ? 'Semua Mutasi (Masuk LPB & Keluar SIV)'
                  : typeFilter === 'IN'
                  ? 'Barang Masuk Saja (LPB Supplier)'
                  : 'Barang Keluar Saja (Nota Pengambilan SIV)'}
              </strong>
              <div className="text-[11px] text-slate-700 mt-0.5 font-mono">
                Rentang:{' '}
                <strong>
                  {startDate || endDate
                    ? `${startDate ? formatReadableDate(startDate) : 'Awal'} - ${
                        endDate ? formatReadableDate(endDate) : 'Akhir'
                      }`
                    : 'Semua Tanggal'}
                </strong>{' '}
                ({dateFilteredMovements.length} catatan)
              </div>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px]">Ringkasan Total Unit:</span>
              <div className="flex items-center gap-3 mt-0.5 font-mono text-xs font-bold">
                <span className="text-emerald-700">Masuk: +{totalIn}</span>
                <span className="text-amber-700">Keluar: -{totalOut}</span>
                {selectedItemObj && (
                  <span className="text-slate-900 border-l border-slate-300 pl-2">
                    Sisa: {selectedItemObj.currentStock} {selectedItemObj.unit}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* EXACT REQUESTED TABLE COLUMNS:
              Tanggal, Stock Awal, Masuk, Keluar, Stock Akhir, Keterangan (nomor SIV / LPB) */}
          <div className="border border-slate-900 rounded-xs overflow-hidden mb-5">
            <table className="w-full border-collapse text-xs text-left">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-900 text-[11px] uppercase tracking-wider">
                  <th className="border-r border-slate-900 px-2.5 py-2 text-center w-10">No</th>
                  <th className="border-r border-slate-900 px-3 py-2 text-center w-32">Tanggal</th>
                  {!selectedSku && (
                    <th className="border-r border-slate-900 px-3 py-2">Nama Barang &amp; Material Code</th>
                  )}
                  <th className="border-r border-slate-900 px-3 py-2 text-right w-24">
                    Stock Awal
                  </th>
                  <th className="border-r border-slate-900 px-3 py-2 text-right w-20 text-emerald-800">
                    Masuk
                  </th>
                  <th className="border-r border-slate-900 px-3 py-2 text-right w-20 text-amber-800">
                    Keluar
                  </th>
                  <th className="border-r border-slate-900 px-3 py-2 text-right w-24 text-slate-950 font-black">
                    Stock Akhir
                  </th>
                  <th className="px-3 py-2 text-left">Keterangan (Nomor SIV / LPB)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 text-[11.5px]">
                {dateFilteredMovements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={selectedSku ? 7 : 8}
                      className="py-10 text-center text-slate-500 font-medium"
                    >
                      Tidak ada data mutasi yang cocok dengan kriteria rentang tanggal &amp; filter saat ini.
                    </td>
                  </tr>
                ) : (
                  dateFilteredMovements.map((mov, idx) => {
                    const isIn = mov.type === 'IN';
                    const isLPB =
                      mov.source === 'LPB_SUPPLIER' || mov.referenceNumber.startsWith('LPB');
                    const docTag = isLPB ? '[LPB]' : '[SIV]';

                    return (
                      <tr key={mov.id} className="hover:bg-slate-50/60">
                        {/* 1. No */}
                        <td className="border-r border-slate-900 px-2.5 py-2 text-center font-mono text-slate-600 font-semibold tabular-nums">
                          {idx + 1}
                        </td>

                        {/* 2. Tanggal */}
                        <td className="border-r border-slate-900 px-3 py-2 text-center font-mono text-slate-800 whitespace-nowrap">
                          {formatDateTime(mov.date)}
                        </td>

                        {/* Optional item column when multi-item */}
                        {!selectedSku && (
                          <td className="border-r border-slate-900 px-3 py-2 font-medium text-slate-900">
                            <div>{mov.itemName}</div>
                            <div className="font-mono text-[10px] text-slate-500">{mov.sku}</div>
                          </td>
                        )}

                        {/* 3. Stock Awal */}
                        <td className="border-r border-slate-900 px-3 py-2 text-right font-mono font-bold text-slate-700 tabular-nums">
                          {mov.balanceBefore.toLocaleString('id-ID')}
                        </td>

                        {/* 4. Masuk */}
                        <td className="border-r border-slate-900 px-3 py-2 text-right font-mono font-bold text-emerald-700 tabular-nums">
                          {isIn ? `+${mov.quantity.toLocaleString('id-ID')}` : '-'}
                        </td>

                        {/* 5. Keluar */}
                        <td className="border-r border-slate-900 px-3 py-2 text-right font-mono font-bold text-amber-700 tabular-nums">
                          {!isIn ? `-${mov.quantity.toLocaleString('id-ID')}` : '-'}
                        </td>

                        {/* 6. Stock Akhir */}
                        <td className="border-r border-slate-900 px-3 py-2 text-right font-mono font-black text-slate-950 tabular-nums bg-slate-50/50">
                          {mov.balanceAfter.toLocaleString('id-ID')}
                        </td>

                        {/* 7. Keterangan (Nomor SIV / LPB) */}
                        <td className="px-3 py-2 text-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold ${
                                isLPB
                                  ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                            >
                              {docTag}
                            </span>
                            <span className="font-mono font-bold text-slate-950">
                              {mov.referenceNumber}
                            </span>
                            {mov.secondaryRef && (
                              <span className="text-slate-600 font-sans text-[11px]">
                                &middot; {mov.secondaryRef}
                              </span>
                            )}
                          </div>
                          {mov.notes && (
                            <div className="text-[10.5px] text-slate-500 mt-0.5 italic">
                              {mov.notes} (Petugas: {mov.actor})
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {/* Table Footer with Summary */}
              {dateFilteredMovements.length > 0 && (
                <tfoot>
                  <tr className="bg-slate-100 font-bold border-t-2 border-slate-900 text-slate-900 text-xs">
                    <td
                      colSpan={selectedSku ? 2 : 3}
                      className="border-r border-slate-900 px-3 py-2 text-right uppercase tracking-wider font-extrabold"
                    >
                      Total Pergerakan:
                    </td>
                    <td className="border-r border-slate-900 px-3 py-2 text-right font-mono text-slate-500">
                      -
                    </td>
                    <td className="border-r border-slate-900 px-3 py-2 text-right font-mono text-emerald-800">
                      +{totalIn.toLocaleString('id-ID')}
                    </td>
                    <td className="border-r border-slate-900 px-3 py-2 text-right font-mono text-amber-800">
                      -{totalOut.toLocaleString('id-ID')}
                    </td>
                    <td className="border-r border-slate-900 px-3 py-2 text-right font-mono text-slate-950 font-black">
                      {latestBalance.toLocaleString('id-ID')}
                    </td>
                    <td className="px-3 py-2 text-slate-600 font-normal text-[11px]">
                      Rekapitulasi resmi kartu stok barang
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Official Signatures Verification Footer */}
          <div className="grid grid-cols-2 gap-10 pt-4 text-center text-xs">
            <div>
              <p className="text-slate-600 mb-14 font-medium">Dibuat &amp; Dicatat Oleh:</p>
              <p className="font-bold text-slate-900 border-b border-slate-400 pb-1 mx-auto max-w-[200px]">
                ( Admin Logistik / Gudang )
              </p>
              <p className="text-slate-500 text-[10px] mt-0.5">Petugas Administrasi Pembukuan</p>
            </div>

            <div>
              <p className="text-slate-600 mb-14 font-medium">Diperiksa &amp; Diverifikasi Oleh:</p>
              <p className="font-bold text-slate-900 border-b border-slate-400 pb-1 mx-auto max-w-[200px]">
                ( Kepala Gudang &amp; Logistik )
              </p>
              <p className="text-slate-500 text-[10px] mt-0.5">
                {companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
              </p>
            </div>
          </div>

          {/* Security & Audit Tag */}
          <div className="mt-6 pt-2 border-t border-slate-200 flex justify-between items-center text-[9.5px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Sistem Otentikasi &amp; Jejak Audit Gudang - ISO 9001:2015
            </span>
            <span>KARTU STOK RESMI &middot; PT. ABADI AGROSINDO PERSADA</span>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="no-print px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Tutup Pratinjau
          </button>
        </div>
      </div>
    </div>
  );
};
