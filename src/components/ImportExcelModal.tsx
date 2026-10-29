import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useInventory } from '../context/InventoryContext';
import { CostCenterEntry, GLAccountEntry } from '../types/inventory';
import {
  FileSpreadsheet,
  Upload,
  Download,
  X,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Layers,
  Info,
} from 'lucide-react';

interface ImportExcelModalProps {
  initialTarget?: 'cost-centers' | 'gl-accounts';
  onClose: () => void;
}

interface ParsedRow {
  rowNum: number;
  code: string;
  name: string;
  description: string;
  status: 'new' | 'update' | 'invalid';
  errorMessage?: string;
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({
  initialTarget = 'cost-centers',
  onClose,
}) => {
  const {
    costCenters,
    glAccounts,
    importCostCentersBulk,
    importGLAccountsBulk,
  } = useInventory();

  const [targetType, setTargetType] = useState<'cost-centers' | 'gl-accounts'>(initialTarget);
  const [importMode, setImportMode] = useState<'upsert' | 'replace'>('upsert');
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawWorkbook, setRawWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download official Excel template (.xlsx)
  const handleDownloadTemplate = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Cost Center
      const costCenterSampleData = [
        ['Kode Cost Center', 'Nama Divisi / Cost Center', 'Keterangan Pemakaian'],
        ['60', 'Bagging Plant 2 & Pemuatan', 'Pemuatan pupuk kantong & pemeliharaan mesin packing'],
        ['50', 'NPK Granulasi Plant', 'Produksi pupuk granulasi NPK & utilitas pabrik'],
        ['70', 'Workshop & Bubut Mekanik', 'Fabrikasi, bubut poros & perbaikan alat berat'],
        ['40', 'Boiler & Pembangkit Listrik', 'Pengoperasian ketel uap, turbin & pendingin'],
        ['80', 'Gudang Bahan Baku & Raw Material', 'Penyimpanan phosphor, urea, sulfur & kalium'],
        ['90', 'Laboratorium & Quality Control', 'Pengujian sampel granulasi & chemical analyzer'],
      ];
      const wsCC = XLSX.utils.aoa_to_sheet(costCenterSampleData);
      wsCC['!cols'] = [{ wch: 20 }, { wch: 35 }, { wch: 55 }];
      XLSX.utils.book_append_sheet(wb, wsCC, 'Cost Center');

      // Sheet 2: GL Account
      const glAccountSampleData = [
        ['Nomor GL Account', 'Nama Akun / Perkiraan', 'Keterangan / Kategori Biaya'],
        ['51010', 'Biaya Sparepart Mesin & Peralatan', 'Suku cadang mesin produksi, bearing, belt, chain'],
        ['51020', 'Biaya Pelumas & Grease Pabrik', 'Oli hidrolik, gear oil & gemuk industri mesin pabrik'],
        ['52010', 'Biaya Pemeliharaan Bangunan & Gudang', 'Perawatan fisik gedung, atap & lantai gudang'],
        ['53010', 'Biaya Alat Pelindung Diri (APD)', 'Sepatu safety, helm proyek, masker & sarung tangan'],
        ['54010', 'Biaya Bahan Kimia Penolong', 'Bahan coating, aditif granulasi & reagen lab'],
        ['55010', 'Biaya Peralatan Kantor Gudang & ATK', 'Kertas form cetak, pita barcode & tinta printer'],
      ];
      const wsGL = XLSX.utils.aoa_to_sheet(glAccountSampleData);
      wsGL['!cols'] = [{ wch: 20 }, { wch: 40 }, { wch: 55 }];
      XLSX.utils.book_append_sheet(wb, wsGL, 'GL Account');

      XLSX.writeFile(wb, 'Template_Import_CostCenter_GL_PT_AAP.xlsx');
    } catch (err) {
      console.error('Failed to download template:', err);
      setErrorMsg('Gagal mengunduh file template Excel.');
    }
  };

  // Helper to normalize and map Excel column headers accurately
  const mapAndParseSheet = (
    wb: XLSX.WorkBook,
    sheetName: string,
    currentTarget: 'cost-centers' | 'gl-accounts'
  ) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return [];

    // Convert sheet to json array of objects
    const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    if (!jsonData || jsonData.length === 0) return [];

    const existingList = currentTarget === 'cost-centers' ? costCenters : glAccounts;
    const existingCodeSet = new Map<string, string>();
    existingList.forEach((item) => existingCodeSet.set(item.code.toLowerCase(), item.name));

    const rows: ParsedRow[] = [];

    jsonData.forEach((rawRow, index) => {
      let rawCode = '';
      let rawName = '';
      let rawDesc = '';

      const entries = Object.entries(rawRow);

      // Pass 1: Look for explicit code/ID headers (excluding plain row number 'no' / 'no urut')
      for (const [key, val] of entries) {
        const k = key.trim().toLowerCase();
        const v = String(val ?? '').trim();
        if (!v) continue;

        const isRowIndexCol = k === 'no' || k === 'no.' || k === 'no urut' || k === 'baris';
        if (isRowIndexCol && entries.length >= 3) {
          continue;
        }

        if (
          k.includes('kode') ||
          k.includes('code') ||
          k.includes('nomor') ||
          k.includes('id') ||
          k.includes('cc') ||
          k.includes('gl') ||
          (isRowIndexCol && entries.length === 2)
        ) {
          if (!rawCode) rawCode = v;
        } else if (
          k.includes('nama') ||
          k.includes('name') ||
          k.includes('divisi') ||
          k.includes('akun') ||
          k.includes('perkiraan') ||
          k.includes('departemen')
        ) {
          if (!rawName) rawName = v;
        } else if (
          k.includes('keterangan') ||
          k.includes('desc') ||
          k.includes('catatan') ||
          k.includes('notes') ||
          k.includes('pemakaian') ||
          k.includes('kategori') ||
          k.includes('alokasi')
        ) {
          if (!rawDesc) rawDesc = v;
        }
      }

      // Fallback positional mapping if headers are custom
      const nonIndexValues = entries
        .filter(([key], idx) => {
          const k = key.trim().toLowerCase();
          if (entries.length >= 3 && idx === 0 && (k === 'no' || k === 'no.' || k === 'no urut')) {
            return false;
          }
          return true;
        })
        .map(([, v]) => String(v ?? '').trim())
        .filter(Boolean);

      if (!rawCode && nonIndexValues.length > 0) rawCode = nonIndexValues[0];
      if (!rawName && nonIndexValues.length > 1) rawName = nonIndexValues[1];
      if (!rawDesc && nonIndexValues.length > 2) rawDesc = nonIndexValues[2];

      const rowNum = index + 2;

      if (!rawCode && !rawName) {
        return;
      }

      let status: 'new' | 'update' | 'invalid' = 'new';
      let errorMessage: string | undefined = undefined;

      if (!rawCode) {
        status = 'invalid';
        errorMessage = 'Nomor / Kode tidak boleh kosong';
      } else if (!rawName) {
        status = 'invalid';
        errorMessage = 'Nama / Keterangan wajib diisi';
      } else if (existingCodeSet.has(rawCode.toLowerCase())) {
        status = 'update';
      } else {
        status = 'new';
      }

      rows.push({
        rowNum,
        code: rawCode,
        name: rawName,
        description: rawDesc,
        status,
        errorMessage,
      });
    });

    return rows;
  };

  // Process uploaded Excel file
  const processFile = async (file: File) => {
    setErrorMsg('');
    setIsProcessing(true);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      setRawWorkbook(wb);
      setAvailableSheets(wb.SheetNames);

      // Auto-select most appropriate sheet or default to first
      let chosenSheet = wb.SheetNames[0];
      let detectedTarget = targetType;

      const lowerNames = wb.SheetNames.map((s) => s.toLowerCase());
      if (targetType === 'cost-centers') {
        const matchIdx = lowerNames.findIndex((s) => s.includes('cost') || s.includes('cc') || s.includes('pusat'));
        if (matchIdx >= 0) {
          chosenSheet = wb.SheetNames[matchIdx];
        }
      } else {
        const matchIdx = lowerNames.findIndex((s) => s.includes('gl') || s.includes('akun') || s.includes('account'));
        if (matchIdx >= 0) {
          chosenSheet = wb.SheetNames[matchIdx];
        }
      }

      if (chosenSheet.toLowerCase().includes('gl') && !chosenSheet.toLowerCase().includes('cost')) {
        detectedTarget = 'gl-accounts';
        setTargetType('gl-accounts');
      } else if (chosenSheet.toLowerCase().includes('cost') || chosenSheet.toLowerCase().includes('cc')) {
        detectedTarget = 'cost-centers';
        setTargetType('cost-centers');
      }

      setSelectedSheet(chosenSheet);
      const parsed = mapAndParseSheet(wb, chosenSheet, detectedTarget);
      setParsedRows(parsed);

      if (parsed.length === 0) {
        setErrorMsg(`Tidak ada baris data yang ditemukan pada sheet "${chosenSheet}".`);
      }
    } catch (err) {
      console.error('Failed to parse Excel file:', err);
      setErrorMsg('Gagal membaca file Excel. Pastikan file berformat .xlsx, .xls, atau .csv yang valid.');
      setParsedRows([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    let nextTarget = targetType;
    if (sheetName.toLowerCase().includes('gl') && !sheetName.toLowerCase().includes('cost')) {
      nextTarget = 'gl-accounts';
      setTargetType('gl-accounts');
    } else if (sheetName.toLowerCase().includes('cost') || sheetName.toLowerCase().includes('cc')) {
      nextTarget = 'cost-centers';
      setTargetType('cost-centers');
    }
    if (rawWorkbook) {
      const parsed = mapAndParseSheet(rawWorkbook, sheetName, nextTarget);
      setParsedRows(parsed);
    }
  };

  const handleTargetTypeChange = (newTarget: 'cost-centers' | 'gl-accounts') => {
    setTargetType(newTarget);
    if (rawWorkbook && selectedSheet) {
      const parsed = mapAndParseSheet(rawWorkbook, selectedSheet, newTarget);
      setParsedRows(parsed);
    }
  };

  // Perform bulk import
  const handleExecuteImport = () => {
    const validRows = parsedRows.filter((r) => r.status !== 'invalid');
    if (validRows.length === 0) {
      setErrorMsg('Tidak ada baris data valid untuk diimpor.');
      return;
    }

    if (targetType === 'cost-centers') {
      const entries: CostCenterEntry[] = validRows.map((r) => ({
        code: r.code,
        name: r.name,
        description: r.description,
      }));
      const res = importCostCentersBulk(entries, importMode);
      if (res.success) {
        onClose();
      } else {
        setErrorMsg(res.error || 'Gagal mengimpor data Cost Center.');
      }
    } else {
      const entries: GLAccountEntry[] = validRows.map((r) => ({
        code: r.code,
        name: r.name,
        description: r.description,
      }));
      const res = importGLAccountsBulk(entries, importMode);
      if (res.success) {
        onClose();
      } else {
        setErrorMsg(res.error || 'Gagal mengimpor data GL Account.');
      }
    }
  };

  const validRows = parsedRows.filter((r) => r.status !== 'invalid');
  const uniqueValidCodes = new Set(validRows.map((r) => r.code.toLowerCase()));
  const totalValid = validRows.length;
  const totalNew = parsedRows.filter((r) => r.status === 'new').length;
  const totalUpdate = parsedRows.filter((r) => r.status === 'update').length;
  const totalInvalid = parsedRows.filter((r) => r.status === 'invalid').length;

  const existingList = targetType === 'cost-centers' ? costCenters : glAccounts;
  const projectedTableCount =
    importMode === 'replace'
      ? uniqueValidCodes.size
      : new Set([...existingList.map((e) => e.code.toLowerCase()), ...Array.from(uniqueValidCodes)]).size;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Impor &amp; Sinkronisasi Data Master via Excel
              </h2>
              <p className="text-xs text-slate-300">
                Nomor yang sama otomatis di-replace, nomor berbeda ditambahkan, dan jumlah tabel disesuaikan
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

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-900 text-xs">
          {/* Target Type Selector & Download Template */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="font-semibold text-slate-700 block mb-1">Target Master Data:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTargetTypeChange('cost-centers')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    targetType === 'cost-centers'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Cost Center ({costCenters.length} Baris)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTargetTypeChange('gl-accounts')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    targetType === 'gl-accounts'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>GL Account ({glAccounts.length} Baris)</span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-100/80 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors self-start sm:self-auto shadow-2xs"
              title="Unduh file format Excel resmi dengan contoh baris yang telah terisi"
            >
              <Download className="w-4 h-4 text-emerald-700" />
              <span>Unduh Template Excel (.xlsx)</span>
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
                <span className="text-emerald-700">{fileName}</span>
              ) : (
                'Klik untuk memilih file Excel atau seret file ke sini'
              )}
            </p>
            <p className="text-slate-500 text-[11px] mt-1">
              Mendukung format <strong>.xlsx, .xls, .csv</strong> (Template resmi PT. AAP)
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Sheet Selector (if multiple sheets exist) */}
          {availableSheets.length > 1 && (
            <div className="flex items-center gap-2 p-2.5 bg-slate-100 rounded-lg text-xs">
              <span className="font-semibold text-slate-700">Pilih Lembar Sheet:</span>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {availableSheets.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSheetChange(s)}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      selectedSheet === s
                        ? 'bg-slate-900 text-white font-bold'
                        : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Parsed Preview Table & Statistics */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              {/* Import Mode Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <label
                  onClick={() => setImportMode('upsert')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                    importMode === 'upsert'
                      ? 'border-emerald-600 bg-emerald-50/70 ring-1 ring-emerald-600'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="upsert"
                    checked={importMode === 'upsert'}
                    onChange={() => setImportMode('upsert')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-bold text-slate-900">
                      Replace Nomor Sama &amp; Tambah Nomor Berbeda
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Nomor/ID yang sama akan di-<strong>replace</strong>, dan nomor yang berbeda akan <strong>ditambahkan</strong> ke tabel.
                    </p>
                  </div>
                </label>

                <label
                  onClick={() => setImportMode('replace')}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                    importMode === 'replace'
                      ? 'border-amber-600 bg-amber-50/70 ring-1 ring-amber-600'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="font-bold text-slate-900">
                      Sesuaikan Jumlah Tabel Penuh dari Data Import
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Menyesuaikan jumlah baris tabel persis mengikuti data yang di-import ({uniqueValidCodes.size} baris).
                    </p>
                  </div>
                </label>
              </div>

              {/* Summary Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900">Hasil Pembacaan:</span>
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono font-semibold">
                    {parsedRows.length} Baris File
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                    +{totalNew} Nomor Baru (Tambah)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">
                    &#8635; {totalUpdate} Nomor Sama (Replace)
                  </span>
                  {totalInvalid > 0 && (
                    <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-medium">
                      {totalInvalid} Error
                    </span>
                  )}
                </div>

                <div className="font-mono text-[11px] font-bold text-slate-800 bg-white px-2.5 py-1 rounded border border-slate-200">
                  Jumlah Tabel Hasil: {existingList.length} &rarr; {projectedTableCount} Baris
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 w-12 text-center">Baris</th>
                      <th className="px-3 py-2 w-28">Nomor / Kode</th>
                      <th className="px-3 py-2">Nama Akun / Divisi</th>
                      <th className="px-3 py-2 hidden sm:table-cell">Keterangan</th>
                      <th className="px-3 py-2 w-28 text-center">Aksi Import</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((r) => (
                      <tr
                        key={r.rowNum}
                        className={
                          r.status === 'invalid'
                            ? 'bg-red-50/60'
                            : r.status === 'update'
                            ? 'bg-amber-50/30'
                            : 'hover:bg-slate-50'
                        }
                      >
                        <td className="px-3 py-2 text-center text-slate-400 font-mono">
                          {r.rowNum}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-slate-900">
                          {r.code || <span className="text-red-500 italic">[Kosong]</span>}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {r.name || <span className="text-red-500 italic">[Kosong]</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-600 hidden sm:table-cell truncate max-w-xs">
                          {r.description || '-'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.status === 'new' && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              + Ditambahkan
                            </span>
                          )}
                          {r.status === 'update' && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              &#8635; Di-Replace
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
            </div>
          )}

          {/* Guide Note */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex items-start gap-2 text-[11px] text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Aturan Sinkronisasi &amp; Format Kolom Excel:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-blue-800">
                <li>
                  Apabila <strong>Nomor / Kode</strong> yang di-import <strong>sama</strong> dengan yang ada di sistem, data lama akan otomatis di-<strong>replace</strong>.
                </li>
                <li>
                  Apabila <strong>Nomor / Kode berbeda</strong>, data akan otomatis <strong>ditambahkan</strong> sebagai baris baru, dan jumlah tabel akan menyesuaikan.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {totalValid > 0 ? (
              <span>
                Siap memproses <strong>{totalValid} baris valid</strong> &rarr; Total tabel menjadi{' '}
                <strong>{projectedTableCount} baris</strong>
              </span>
            ) : (
              <span>Silakan pilih atau seret file Excel terlebih dahulu</span>
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
              <span>Proses Import ({totalValid} Data)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
