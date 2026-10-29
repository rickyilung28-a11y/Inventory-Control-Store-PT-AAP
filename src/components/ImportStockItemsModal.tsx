import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useInventory } from '../context/InventoryContext';
import {
  FileSpreadsheet,
  Upload,
  Download,
  X,
  AlertTriangle,
  CheckCircle2,
  Package,
  Boxes,
  Info,
} from 'lucide-react';

interface ImportStockItemsModalProps {
  onClose: () => void;
}

interface ParsedStockRow {
  rowNum: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minStock: number;
  location: string;
  description: string;
  status: 'new' | 'update' | 'invalid';
  errorMessage?: string;
}

export const ImportStockItemsModal: React.FC<ImportStockItemsModalProps> = ({ onClose }) => {
  const { stockItems, importStockItemsBulk } = useInventory();

  const [importMode, setImportMode] = useState<'upsert' | 'add_only'>('upsert');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedStockRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download official Excel template (.xlsx) for Stock Items
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      const sampleData = [
        [
          'Material Code',
          'Nama Barang',
          'Kategori',
          'Satuan',
          'Stok Awal',
          'Minimal Stok',
          'Lokasi / Rak Penyimpanan',
          'Keterangan / Spesifikasi',
        ],
        [
          'BRG-6205-2RS',
          'Bearing Deep Groove 6205-2RS C3',
          'Sparepart Mesin',
          'Pcs',
          25,
          10,
          'Rak A-01',
          'Bearing ball presisi tinggi untuk motor pompa pendingin',
        ],
        [
          'VBL-B-68',
          'V-Belt Classical Section B-68 Industrial',
          'Sparepart Mesin',
          'Pcs',
          40,
          15,
          'Rak A-01',
          'Tali kipas mesin blower dan conveyor bagging',
        ],
        [
          'CHN-RS-60',
          'Roller Chain RS-60 Simplex Tsubaki',
          'Sparepart Mesin',
          'Meter',
          18,
          5,
          'Rak A-02',
          'Rantai penggerak elevator dan transfer klinker',
        ],
        [
          'INV-SCH-7KW',
          'Inverter Altivar 7.5 kW 380V',
          'Elektrikal & PLC',
          'Unit',
          4,
          2,
          'Rak B-02',
          'Speed drive kontrol motor konveyor bagging plant',
        ],
        [
          'SLN-SMC-24V',
          'Solenoid Valve 5/2 Way 24V DC SMC',
          'Instrumentasi',
          'Pcs',
          12,
          4,
          'Rak B-03',
          'Katup pneumatik silinder penimbang kantong pupuk',
        ],
        [
          'OLI-TELLUS-68',
          'Shell Tellus S2 MX 68 Hydraulic Oil',
          'Pelumas & Kimia',
          'Liter',
          200,
          50,
          'Rak C-01',
          'Oli hidrolik mesin packing dan forklift gudang',
        ],
      ];

      const ws = XLSX.utils.aoa_to_sheet(sampleData);
      ws['!cols'] = [
        { wch: 18 },
        { wch: 38 },
        { wch: 20 },
        { wch: 10 },
        { wch: 12 },
        { wch: 14 },
        { wch: 24 },
        { wch: 45 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Master Barang');

      XLSX.writeFile(wb, 'Template_Import_Barang_Gudang_PT_AAP.xlsx');
    } catch (err) {
      console.error('Failed to download template:', err);
      setErrorMsg('Gagal mengunduh template Excel.');
    }
  };

  // Process uploaded Excel file
  const processFile = async (file: File) => {
    setErrorMsg('');
    setIsProcessing(true);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];

      if (!ws) {
        setErrorMsg('Lembar sheet Excel kosong atau tidak ditemukan.');
        setParsedRows([]);
        return;
      }

      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (!jsonData || jsonData.length === 0) {
        setErrorMsg('File Excel tidak memiliki baris data.');
        setParsedRows([]);
        return;
      }

      const existingSkuMap = new Map<string, string>();
      stockItems.forEach((i) => existingSkuMap.set(i.sku.toUpperCase(), i.name));

      const rows: ParsedStockRow[] = [];

      jsonData.forEach((rawRow, idx) => {
        let sku = '';
        let name = '';
        let category = 'Sparepart Mesin';
        let unit = 'Pcs';
        let currentStock = 0;
        let minStock = 10;
        let location = 'Rak A-01';
        let description = '';

        for (const [key, val] of Object.entries(rawRow)) {
          const k = key.trim().toLowerCase();
          const v = String(val ?? '').trim();

          if (k.includes('sku') || k.includes('kode') || k.includes('material') || k === 'id') {
            if (!sku && v) sku = v.toUpperCase();
          } else if (k.includes('nama') || k.includes('name') || k.includes('item') || k.includes('barang')) {
            if (!name && v) name = v;
          } else if (k.includes('kategori') || k.includes('category')) {
            if (v) category = v;
          } else if (k.includes('satuan') || k.includes('unit') || k.includes('uom')) {
            if (v) unit = v;
          } else if (k.includes('awal') || k.includes('current') || k === 'stok' || k.includes('qty')) {
            const parsedNum = Number(v);
            if (!isNaN(parsedNum)) currentStock = parsedNum;
          } else if (k.includes('min') || k.includes('safety') || k.includes('ambang')) {
            const parsedNum = Number(v);
            if (!isNaN(parsedNum)) minStock = parsedNum;
          } else if (k.includes('lokasi') || k.includes('rak') || k.includes('location')) {
            if (v) location = v;
          } else if (k.includes('keterangan') || k.includes('deskripsi') || k.includes('desc') || k.includes('spesifikasi')) {
            if (v) description = v;
          }
        }

        // Fallback positional reading
        const values = Object.values(rawRow).map((v) => String(v ?? '').trim()).filter(Boolean);
        if (!sku && values.length > 0) sku = values[0].toUpperCase();
        if (!name && values.length > 1) name = values[1];

        if (!sku && !name) return; // Skip purely blank rows

        const rowNum = idx + 2;
        let status: 'new' | 'update' | 'invalid' = 'new';
        let errorMessage: string | undefined = undefined;

        if (!sku) {
          status = 'invalid';
          errorMessage = 'Material Code wajib diisi';
        } else if (!name) {
          status = 'invalid';
          errorMessage = 'Nama barang wajib diisi';
        } else if (existingSkuMap.has(sku)) {
          status = 'update';
        } else {
          status = 'new';
        }

        rows.push({
          rowNum,
          sku,
          name,
          category,
          unit,
          currentStock,
          minStock,
          location,
          description,
          status,
          errorMessage,
        });
      });

      setParsedRows(rows);
      if (rows.length === 0) {
        setErrorMsg('Tidak ditemukan baris barang valid pada file Excel ini.');
      }
    } catch (err) {
      console.error('Failed to parse Excel stock items:', err);
      setErrorMsg('Gagal membaca file Excel. Pastikan file berformat .xlsx, .xls, atau .csv yang valid.');
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleExecuteImport = () => {
    const validRows = parsedRows.filter((r) => r.status !== 'invalid');
    if (validRows.length === 0) {
      setErrorMsg('Tidak ada baris barang valid untuk diimpor.');
      return;
    }

    const payload = validRows.map((r) => ({
      sku: r.sku,
      name: r.name,
      category: r.category,
      unit: r.unit,
      currentStock: r.currentStock,
      minStock: r.minStock,
      location: r.location,
      description: r.description,
    }));

    const res = importStockItemsBulk(payload, importMode);
    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.error || 'Gagal mengimpor data barang.');
    }
  };

  const totalValid = parsedRows.filter((r) => r.status !== 'invalid').length;
  const totalNew = parsedRows.filter((r) => r.status === 'new').length;
  const totalUpdate = parsedRows.filter((r) => r.status === 'update').length;
  const totalInvalid = parsedRows.filter((r) => r.status === 'invalid').length;

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Impor Data Barang Master via Excel
              </h2>
              <p className="text-xs text-slate-300">
                Tambah barang baru dan perbarui saldo stok barang secara massal dengan file Excel
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-slate-900 text-xs">
          {/* Download Template Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-emerald-950 block">Template Excel Resmi PT. AAP</span>
                <span className="text-emerald-800 text-[11px]">
                  Gunakan format kolom resmi agar pembacaan Material Code, nama barang, rak, dan stok akurat.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg transition-colors shadow-xs shrink-0 self-start sm:self-auto"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Template Barang (.xlsx)</span>
            </button>
          </div>

          {/* Upload Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
              isDragOver
                ? 'border-emerald-500 bg-emerald-50/60'
                : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <Upload className="w-6 h-6" />
            </div>

            <p className="font-semibold text-sm text-slate-900">
              {fileName ? (
                <span className="text-emerald-700 font-bold">{fileName}</span>
              ) : (
                'Klik untuk memilih file Excel atau seret file ke sini'
              )}
            </p>
            <p className="text-slate-500 text-[11px] mt-1">
              Mendukung format <strong>.xlsx, .xls, .csv</strong>
            </p>
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">Hasil Pembacaan:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono font-semibold">
                    {parsedRows.length} Total
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                    {totalNew} Baru
                  </span>
                  {totalUpdate > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                      {totalUpdate} Update Stok
                    </span>
                  )}
                  {totalInvalid > 0 && (
                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-semibold">
                      {totalInvalid} Error
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 bg-slate-100 px-3 py-1 rounded-lg">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-800">
                    <input
                      type="radio"
                      name="stockImportMode"
                      value="upsert"
                      checked={importMode === 'upsert'}
                      onChange={() => setImportMode('upsert')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Tambah Baru &amp; Update Stok</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-800">
                    <input
                      type="radio"
                      name="stockImportMode"
                      value="add_only"
                      checked={importMode === 'add_only'}
                      onChange={() => setImportMode('add_only')}
                      className="text-slate-600 focus:ring-slate-500"
                    />
                    <span>Hanya Tambah Baru</span>
                  </label>
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 w-10 text-center">No</th>
                      <th className="px-3 py-2 w-28">Material Code</th>
                      <th className="px-3 py-2">Nama Barang</th>
                      <th className="px-3 py-2 w-24">Kategori</th>
                      <th className="px-3 py-2 w-16 text-center">Satuan</th>
                      <th className="px-3 py-2 w-16 text-right">Stok</th>
                      <th className="px-3 py-2 w-20">Rak</th>
                      <th className="px-3 py-2 w-20 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.slice(0, 100).map((r) => (
                      <tr
                        key={r.rowNum}
                        className={
                          r.status === 'invalid'
                            ? 'bg-red-50/50'
                            : r.status === 'update'
                            ? 'bg-amber-50/30'
                            : 'hover:bg-slate-50'
                        }
                      >
                        <td className="px-3 py-2 text-center text-slate-400 font-mono">
                          {r.rowNum}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">
                          {r.sku || <span className="text-red-500 italic">[Kosong]</span>}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-900 truncate max-w-xs">
                          {r.name || <span className="text-red-500 italic">[Kosong]</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{r.category}</td>
                        <td className="px-3 py-2 text-center font-medium uppercase">{r.unit}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-slate-900">
                          {r.currentStock}
                        </td>
                        <td className="px-3 py-2 text-slate-600 font-mono">{r.location}</td>
                        <td className="px-3 py-2 text-center">
                          {r.status === 'new' && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              Baru
                            </span>
                          )}
                          {r.status === 'update' && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              Update
                            </span>
                          )}
                          {r.status === 'invalid' && (
                            <span
                              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800"
                              title={r.errorMessage}
                            >
                              Error
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 100 && (
                <p className="text-[11px] text-slate-500 italic">
                  * Menampilkan pratinjau 100 baris pertama dari total{' '}
                  <strong>{parsedRows.length.toLocaleString('id-ID')}</strong> baris untuk menjaga performa. Seluruh{' '}
                  <strong>{totalValid.toLocaleString('id-ID')}</strong> baris valid tetap akan diimpor sepenuhnya.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {totalValid > 0 ? (
              <span>
                Siap memproses <strong>{totalValid} barang valid</strong> ke katalog stok
              </span>
            ) : (
              <span>Pilih file Excel untuk mulai memproses data</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={totalValid === 0 || isProcessing}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Impor {totalValid} Barang ke Sistem</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
