import React, { useState, useMemo } from 'react';
import {
  StockItem,
  LPBDocument,
  IssueVoucherDocument,
  CostCenterEntry,
  GLAccountEntry,
} from '../types/inventory';
import {
  SapExportConfig,
  SapExportModule,
  SapDateFormat,
  SapHeaderStyle,
  SapCsvDelimiter,
  SAP_SIV_COLUMNS,
  SAP_LPB_COLUMNS,
  SAP_MATERIAL_COLUMNS,
  buildSapSivRows,
  buildSapLpbRows,
  buildSapMaterialMasterRows,
  downloadSapCsv,
  downloadSapExcel,
} from '../utils/sapExport';
import {
  X,
  FileSpreadsheet,
  FileText,
  Download,
  Building2,
  Calendar,
  CheckCircle2,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  Boxes,
  Settings2,
  Eye,
} from 'lucide-react';

interface SapExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultModule?: SapExportModule;
  vouchers: IssueVoucherDocument[];
  lpbDocs: LPBDocument[];
  stockItems: StockItem[];
  costCenters: CostCenterEntry[];
  glAccounts: GLAccountEntry[];
  initialStartDate?: string;
  initialEndDate?: string;
}

export const SapExportModal: React.FC<SapExportModalProps> = ({
  isOpen,
  onClose,
  defaultModule = 'SIV_GI_201',
  vouchers,
  lpbDocs,
  stockItems,
  costCenters,
  glAccounts,
  initialStartDate = '',
  initialEndDate = '',
}) => {
  const [module, setModule] = useState<SapExportModule>(defaultModule);
  const [plantCode, setPlantCode] = useState<string>('AAP1');
  const [storageLocation, setStorageLocation] = useState<string>('STR1');
  const [dateFormat, setDateFormat] = useState<SapDateFormat>('YYYYMMDD');
  const [headerStyle, setHeaderStyle] = useState<SapHeaderStyle>('DUAL_HEADER');
  const [csvDelimiter, setCsvDelimiter] = useState<SapCsvDelimiter>(';');
  const [onlyApprovedTransactions, setOnlyApprovedTransactions] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string>(initialStartDate);
  const [endDate, setEndDate] = useState<string>(initialEndDate);
  const [lastDownloadMsg, setLastDownloadMsg] = useState<string>('');

  const config: SapExportConfig = useMemo(
    () => ({
      module,
      plantCode: plantCode.trim().toUpperCase() || 'AAP1',
      storageLocation: storageLocation.trim().toUpperCase() || 'STR1',
      dateFormat,
      headerStyle,
      csvDelimiter,
      onlyApprovedTransactions,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [
      module,
      plantCode,
      storageLocation,
      dateFormat,
      headerStyle,
      csvDelimiter,
      onlyApprovedTransactions,
      startDate,
      endDate,
    ]
  );

  const sivRows = useMemo(
    () => buildSapSivRows(vouchers, stockItems, costCenters, glAccounts, config),
    [vouchers, stockItems, costCenters, glAccounts, config]
  );

  const lpbRows = useMemo(
    () => buildSapLpbRows(lpbDocs, stockItems, config),
    [lpbDocs, stockItems, config]
  );

  const materialRows = useMemo(
    () => buildSapMaterialMasterRows(stockItems, config),
    [stockItems, config]
  );

  if (!isOpen) return null;

  const activePreview =
    module === 'LPB_GR_101'
      ? {
          title: 'SAP Goods Receipt (MIGO / BAPI_GOODSMVT_CREATE GM_CODE 01 • Mvt Type 101 / 501)',
          columns: SAP_LPB_COLUMNS,
          rows: lpbRows,
          prefix: 'SAP_GR_101_LPB',
        }
      : module === 'MATERIAL_MASTER'
      ? {
          title: 'SAP Material Master & Stock Balance (MM01 / MB52 / Initial Upload Mvt 561)',
          columns: SAP_MATERIAL_COLUMNS,
          rows: materialRows,
          prefix: 'SAP_MAT_MASTER_MB52',
        }
      : {
          title: 'SAP Goods Issue to Cost Center (MIGO / MB1A / BAPI_GOODSMVT_CREATE GM_CODE 03 • Mvt Type 201)',
          columns: SAP_SIV_COLUMNS,
          rows: sivRows,
          prefix: 'SAP_GI_201_SIV',
        };

  const handleExportCsv = () => {
    if (module === 'ALL_SAP_SHEETS') {
      // Download all 3 CSVs or the SIV + LPB + Material CSV
      downloadSapCsv(SAP_SIV_COLUMNS, sivRows, config, 'SAP_GI_201_SIV');
      setTimeout(() => {
        downloadSapCsv(SAP_LPB_COLUMNS, lpbRows, config, 'SAP_GR_101_LPB');
      }, 250);
      setTimeout(() => {
        downloadSapCsv(SAP_MATERIAL_COLUMNS, materialRows, config, 'SAP_MAT_MASTER_MB52');
      }, 500);
      setLastDownloadMsg(
        'Berhasil mengunduh 3 file CSV SAP (SAP_GI_201_SIV.csv, SAP_GR_101_LPB.csv, SAP_MAT_MASTER_MB52.csv).'
      );
      return;
    }

    downloadSapCsv(activePreview.columns, activePreview.rows, config, activePreview.prefix);
    setLastDownloadMsg(
      `File CSV SAP (${activePreview.prefix}_${config.plantCode}.csv) berhasil diunduh (${activePreview.rows.length} baris item).`
    );
  };

  const handleExportExcel = () => {
    const prefix =
      module === 'ALL_SAP_SHEETS' ? 'SAP_FULL_IMPORT_PACKAGE' : activePreview.prefix;
    downloadSapExcel(
      {
        vouchers,
        lpbDocs,
        stockItems,
        costCenters,
        glAccounts,
      },
      config,
      prefix
    );
    setLastDownloadMsg(
      `File Excel SAP (${prefix}_${config.plantCode}.xlsx) berhasil diunduh dan siap diimpor ke sistem SAP.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-6xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold">
                  Export Excel (.xlsx) &amp; CSV (.csv) untuk Import Sistem SAP
                </h2>
                <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-[10px] font-extrabold uppercase">
                  SAP MM / FI-CO READY
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Format standar SAP BAPI_GOODSMVT_CREATE, MIGO, MB1A (Mvt 201 Cost Center &amp; GL Account), GR 101/501, dan Material Master MB52/MM01
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 bg-slate-50">
          {/* Pilihan Modul Transaksi SAP */}
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              1. Pilih Modul Transaksi / Master SAP yang Akan Di-Export
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setModule('SIV_GI_201')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  module === 'SIV_GI_201'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-400/30">
                    <ArrowUpRight className="w-3 h-3" />
                    MIGO / MB1A • Mvt 201
                  </span>
                  <span className="text-xs font-mono font-bold">{sivRows.length} baris</span>
                </div>
                <div className="text-xs font-bold mt-1">Nota SIV (SAP Goods Issue)</div>
                <p
                  className={`text-[11px] mt-0.5 ${
                    module === 'SIV_GI_201' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  Pengeluaran barang ke Cost Center (KOSTL) &amp; GL Account (SAKNR)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModule('LPB_GR_101')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  module === 'LPB_GR_101'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 border border-emerald-400/30">
                    <ArrowDownLeft className="w-3 h-3" />
                    MIGO • Mvt 101 / 501
                  </span>
                  <span className="text-xs font-mono font-bold">{lpbRows.length} baris</span>
                </div>
                <div className="text-xs font-bold mt-1">Laporan LPB (SAP Goods Receipt)</div>
                <p
                  className={`text-[11px] mt-0.5 ${
                    module === 'LPB_GR_101' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  Penerimaan barang dari SJ Supplier &amp; Nomor PO (EBELN)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModule('MATERIAL_MASTER')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  module === 'MATERIAL_MASTER'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-500 border border-blue-400/30">
                    <Boxes className="w-3 h-3" />
                    MM01 / MB52 / Mvt 561
                  </span>
                  <span className="text-xs font-mono font-bold">{materialRows.length} item</span>
                </div>
                <div className="text-xs font-bold mt-1">Master Material &amp; Saldo Stok</div>
                <p
                  className={`text-[11px] mt-0.5 ${
                    module === 'MATERIAL_MASTER' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  Material Code (MATNR), Kategori (MATKL), Rak (LGPBE), &amp; Saldo Stok
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModule('ALL_SAP_SHEETS')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  module === 'ALL_SAP_SHEETS'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-400/30">
                    <Layers className="w-3 h-3" />
                    ALL-IN-ONE SAP
                  </span>
                  <span className="text-xs font-mono font-bold">4 Sheet</span>
                </div>
                <div className="text-xs font-bold mt-1">Paket Lengkap Semua Modul SAP</div>
                <p
                  className={`text-[11px] mt-0.5 ${
                    module === 'ALL_SAP_SHEETS' ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  Gabungan GI 201 (SIV), GR 101 (LPB), Material MB52, &amp; Cost Center/GL
                </p>
              </button>
            </div>
          </div>

          {/* Parameter Organisasi & Format Teknis SAP */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Settings2 className="w-4 h-4 text-amber-600" />
              <span>2. Parameter Organisasi SAP (Plant / Storage Location) &amp; Format Kolom</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Kode Plant SAP (<code className="font-mono text-slate-900">WERKS</code>)
                </label>
                <div className="relative">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={plantCode}
                    onChange={(e) => setPlantCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: AAP1 / 1000"
                    maxLength={8}
                    className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Storage Location (<code className="font-mono text-slate-900">LGORT</code>)
                </label>
                <input
                  type="text"
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value.toUpperCase())}
                  placeholder="Contoh: STR1 / 0001"
                  maxLength={8}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Format Tanggal SAP (<code className="font-mono text-slate-900">BLDAT/BUDAT</code>)
                </label>
                <select
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value as SapDateFormat)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="YYYYMMDD">YYYYMMDD (20261027 - Standar BAPI/LSMW)</option>
                  <option value="DD.MM.YYYY">DD.MM.YYYY (27.10.2026 - Standar SAP GUI)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2026-10-27 - Format ISO)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Baris Header Kolom SAP
                </label>
                <select
                  value={headerStyle}
                  onChange={(e) => setHeaderStyle(e.target.value as SapHeaderStyle)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="DUAL_HEADER">2 Baris (Kode Teknis SAP + Label Indonesia)</option>
                  <option value="TECHNICAL_ONLY">1 Baris Murni (BLDAT, BUDAT, MATNR, KOSTL)</option>
                  <option value="FRIENDLY_ID">1 Baris Gabungan (MATNR - Material Code)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Pemisah Kolom CSV (Delimiter)
                </label>
                <select
                  value={csvDelimiter}
                  onChange={(e) => setCsvDelimiter(e.target.value as SapCsvDelimiter)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value=";">Titik Koma ( ; ) — Excel Indonesia &amp; SAP</option>
                  <option value=",">Koma ( , ) — Standar CSV Internasional</option>
                  <option value="&#9;">Tab ( \t ) — SAP GUI Text Upload</option>
                </select>
              </div>
            </div>

            {/* Filter Tanggal & Status Approval */}
            <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-semibold text-slate-700">Filter Tanggal Dokumen:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-md text-xs"
                />
                <span className="text-slate-400">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded-md text-xs"
                />
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('');
                      setEndDate('');
                    }}
                    className="px-2 py-1 text-[11px] font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-md"
                  >
                    Reset Tanggal
                  </button>
                )}
              </div>

              <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg text-emerald-950 font-semibold">
                <input
                  type="checkbox"
                  checked={onlyApprovedTransactions}
                  onChange={(e) => setOnlyApprovedTransactions(e.target.checked)}
                  className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  Hanya Export Transaksi yang Sudah Di-ACC / Approved (Siap Posting SAP)
                </span>
              </label>
            </div>
          </div>

          {/* Preview Tabel SAP */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Eye className="w-4 h-4 text-blue-600" />
                <span>Pratinjau Struktur Tabel SAP: {activePreview.title}</span>
              </div>
              <span className="font-mono text-[11px] font-semibold text-slate-600">
                Menampilkan {Math.min(activePreview.rows.length, 15)} dari {activePreview.rows.length} baris siap export
              </span>
            </div>

            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead className="bg-slate-900 text-white sticky top-0 z-10">
                  <tr>
                    {activePreview.columns.map((col) => (
                      <th
                        key={col.techName}
                        className="px-2.5 py-2 border-r border-slate-700 whitespace-nowrap"
                      >
                        <div className="font-mono font-bold text-amber-300">{col.techName}</div>
                        <div className="text-[10px] font-normal text-slate-300">{col.label}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {activePreview.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={activePreview.columns.length}
                        className="px-4 py-8 text-center text-slate-400 font-sans"
                      >
                        Tidak ada baris transaksi pada filter ini. Coba matikan centang &quot;Hanya Export Transaksi yang Sudah Di-ACC&quot; atau ubah rentang tanggal.
                      </td>
                    </tr>
                  ) : (
                    activePreview.rows.slice(0, 15).map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-blue-50/50">
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            className="px-2.5 py-1.5 border-r border-slate-100 whitespace-nowrap text-slate-800"
                          >
                            {cell === '' ? '-' : String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {lastDownloadMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{lastDownloadMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500">
            Kolom otomatis mencakup <strong>Material Code (MATNR)</strong>,{' '}
            <strong>Cost Center (KOSTL + Keterangan)</strong>,{' '}
            <strong>GL Account (SAKNR + Keterangan)</strong>, dan <strong>Movement Type SAP</strong>.
          </div>
          <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Download CSV SAP (.csv)</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Excel SAP (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
