import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  IssueVoucherDocument,
  StockItem,
  UserAccount,
  getEffectivePermissions,
  getItemCategories,
} from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import { SapExportModal } from '../components/SapExportModal';
import {
  Search,
  Printer,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  XCircle,
  Lock,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  Building,
  Info,
  ScanBarcode,
  Calendar,
  RotateCcw,
  FileSpreadsheet,
  ShieldCheck,
  Ban,
  Upload,
  Download,
  AlertTriangle,
  FileText,
  Layers,
  X,
  ArrowUpDown,
  Filter,
  User,
  UserCheck,
  Tags,
} from 'lucide-react';

interface IssueVoucherListViewProps {
  currentUser: UserAccount;
  issueVouchers: IssueVoucherDocument[];
  onOpenCreateVoucher: () => void;
  onOpenEditVoucher: (voucher: IssueVoucherDocument) => void;
  onOpenApproval: (voucher: IssueVoucherDocument) => void;
  onDeleteVoucher: (voucherId: string) => void;
  onPrintVoucher: (doc: IssueVoucherDocument) => void;
}

interface RawCsvSivRow {
  rowId: string;
  rowNum: number;
  voucherGroup: string;
  materialCode: string;
  rawQty: string;
  requestedQty: number;
  purpose: string;
  department: string;
  costCenter: string;
  glAccount: string;
  notes: string;
}

interface ValidatedCsvSivRow extends RawCsvSivRow {
  matchedItem?: StockItem;
  availableStockBefore: number;
  cumulativeAllocatedBefore: number;
  remainingStockAfter: number;
  isValid: boolean;
  errorType?: 'EMPTY_CODE' | 'UNKNOWN_MATERIAL_CODE' | 'INVALID_QTY' | 'INSUFFICIENT_STOCK';
  errorMessage?: string;
}

interface BulkVoucherDraft {
  draftKey: string;
  voucherLabel: string;
  purpose: string;
  department: string;
  notes: string;
  rows: ValidatedCsvSivRow[];
  isValid: boolean;
  invalidReason?: string;
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function detectDelimiter(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;
  if (semiCount > commaCount && semiCount >= tabCount) return ';';
  if (tabCount > commaCount && tabCount > semiCount) return '\t';
  return ',';
}

export const IssueVoucherListView: React.FC<IssueVoucherListViewProps> = ({
  currentUser,
  issueVouchers,
  onOpenCreateVoucher,
  onOpenEditVoucher,
  onOpenApproval,
  onDeleteVoucher,
  onPrintVoucher,
}) => {
  const {
    stockItems,
    stockCategories,
    lpbDocuments,
    costCenters,
    glAccounts,
    isStockLockedForOpname,
    activeStockOpname,
    createIssueVouchersBulk,
  } = useInventory();

  const perms = getEffectivePermissions(currentUser);
  const isAdmin = perms.canValidateSIV;
  const isKepalaGudang = perms.canApproveSIVStockDeduction;
  const isRequesterUser = !perms.canViewAllSIV;
  const canExportSap =
    currentUser.role === 'superuser' ||
    currentUser.role === 'kepala_gudang' ||
    currentUser.role === 'admin';

  const [activeTab, setActiveTab] = useState<
    'ALL' | 'PENDING' | 'APPROVED_ALL' | 'WAITING_HANDOVER' | 'COMPLETED' | 'REJECTED'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [creatorFilter, setCreatorFilter] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('');
  const [sortBy, setSortBy] = useState<
    'PRIORITY_PENDING' | 'NEWEST_FIRST' | 'OLDEST_FIRST' | 'VOUCHER_NUMBER'
  >('PRIORITY_PENDING');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSapExportModalOpen, setIsSapExportModalOpen] = useState(false);

  // Filter Rentang Tanggal untuk melihat SIV apa saja yang diterbitkan
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // CSV Import State for Bulk SIV Creation
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const [isCsvPanelOpen, setIsCsvPanelOpen] = useState(false);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [rawCsvRows, setRawCsvRows] = useState<RawCsvSivRow[]>([]);
  const [csvGroupingMode, setCsvGroupingMode] = useState<'BY_GROUP_OR_PURPOSE' | 'PER_ROW'>(
    'BY_GROUP_OR_PURPOSE'
  );
  const [csvParseError, setCsvParseError] = useState<string>('');
  const [csvImportSuccessMsg, setCsvImportSuccessMsg] = useState<string>('');
  const [isCsvDragOver, setIsCsvDragOver] = useState(false);

  const defaultCC = costCenters[0]?.code || 'AAP1034001';
  const defaultGL = useMemo(
    () =>
      glAccounts.find((g) => g.name.toUpperCase().startsWith('PRD'))?.code ||
      glAccounts[0]?.code ||
      '5107100006',
    [glAccounts]
  );

  // Parse CSV text into RawCsvSivRow[]
  const parseCsvContent = (text: string) => {
    setCsvParseError('');
    setCsvImportSuccessMsg('');

    const cleanedText = text.replace(/^\uFEFF/, '').trim();
    if (!cleanedText) {
      setCsvParseError('File CSV kosong atau tidak memiliki isi data.');
      setRawCsvRows([]);
      return;
    }

    const rawLines = cleanedText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'));

    if (rawLines.length === 0) {
      setCsvParseError('Tidak ditemukan baris data pada file CSV.');
      setRawCsvRows([]);
      return;
    }

    const delimiter = detectDelimiter(rawLines[0]);
    const firstRowCells = parseCsvLine(rawLines[0], delimiter);

    // Detect if first row is header
    const lowerFirst = firstRowCells.map((c) => c.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const headerKeywords = [
      'material',
      'sku',
      'kode',
      'code',
      'qty',
      'jumlah',
      'quantity',
      'purpose',
      'keperluan',
      'tujuan',
      'department',
      'departemen',
      'divisi',
      'voucher',
      'nota',
      'siv',
      'group',
      'grup',
    ];
    const hasHeader = lowerFirst.some((cell) =>
      headerKeywords.some((kw) => cell.includes(kw))
    );

    let colIdxGroup = -1;
    let colIdxSku = -1;
    let colIdxQty = -1;
    let colIdxPurpose = -1;
    let colIdxDept = -1;
    let colIdxCC = -1;
    let colIdxGL = -1;
    let colIdxNotes = -1;

    if (hasHeader) {
      firstRowCells.forEach((rawHeader, idx) => {
        const h = rawHeader.trim().toLowerCase();
        if (
          colIdxGroup === -1 &&
          (h.includes('group') ||
            h.includes('grup') ||
            h.includes('no_siv') ||
            h.includes('no siv') ||
            h.includes('no_nota') ||
            h.includes('no nota') ||
            h.includes('voucher'))
        ) {
          colIdxGroup = idx;
        } else if (
          colIdxSku === -1 &&
          (h.includes('material') ||
            h.includes('sku') ||
            h.includes('kode barang') ||
            h.includes('kode_barang') ||
            h.includes('item_code') ||
            h.includes('item code') ||
            h === 'kode' ||
            h === 'code')
        ) {
          colIdxSku = idx;
        } else if (
          colIdxQty === -1 &&
          (h.includes('qty') || h.includes('jumlah') || h.includes('quantity') || h.includes('kuantitas'))
        ) {
          colIdxQty = idx;
        } else if (
          colIdxPurpose === -1 &&
          (h.includes('purpose') ||
            h.includes('keperluan') ||
            h.includes('tujuan') ||
            h.includes('uraian') ||
            h.includes('pemakaian'))
        ) {
          colIdxPurpose = idx;
        } else if (
          colIdxDept === -1 &&
          (h.includes('dept') ||
            h.includes('departemen') ||
            h.includes('department') ||
            h.includes('divisi') ||
            h.includes('unit'))
        ) {
          colIdxDept = idx;
        } else if (
          colIdxCC === -1 &&
          (h.includes('cost') || h === 'cc' || h.includes('kode_cc') || h.includes('pusat biaya'))
        ) {
          colIdxCC = idx;
        } else if (
          colIdxGL === -1 &&
          (h.includes('gl') || h.includes('account') || h.includes('perkiraan'))
        ) {
          colIdxGL = idx;
        } else if (
          colIdxNotes === -1 &&
          (h.includes('note') || h.includes('catatan') || h.includes('keterangan'))
        ) {
          colIdxNotes = idx;
        }
      });
    }

    const dataStartIdx = hasHeader ? 1 : 0;
    const parsed: RawCsvSivRow[] = [];

    for (let i = dataStartIdx; i < rawLines.length; i++) {
      const cells = parseCsvLine(rawLines[i], delimiter);
      if (cells.every((c) => !c.trim())) continue;

      let voucherGroup = '';
      let materialCode = '';
      let rawQty = '';
      let purpose = '';
      let department = '';
      let costCenter = defaultCC;
      let glAccount = defaultGL;
      let notes = '';

      if (hasHeader && colIdxSku !== -1) {
        voucherGroup = colIdxGroup >= 0 ? cells[colIdxGroup] || '' : '';
        materialCode = (cells[colIdxSku] || '').trim().toUpperCase();
        rawQty = colIdxQty >= 0 ? (cells[colIdxQty] || '').trim() : '1';
        purpose = colIdxPurpose >= 0 ? (cells[colIdxPurpose] || '').trim() : '';
        department = colIdxDept >= 0 ? (cells[colIdxDept] || '').trim() : '';
        costCenter = colIdxCC >= 0 && cells[colIdxCC]?.trim() ? cells[colIdxCC].trim() : defaultCC;
        glAccount = colIdxGL >= 0 && cells[colIdxGL]?.trim() ? cells[colIdxGL].trim() : defaultGL;
        notes = colIdxNotes >= 0 ? (cells[colIdxNotes] || '').trim() : '';
      } else {
        // Positional fallback: detect if cell[1] is numeric qty or cell[2] is numeric qty
        const isSecondNumeric = cells.length >= 2 && !isNaN(Number(cells[1])) && cells[1].trim() !== '';
        if (isSecondNumeric) {
          materialCode = (cells[0] || '').trim().toUpperCase();
          rawQty = (cells[1] || '1').trim();
          purpose = (cells[2] || '').trim();
          department = (cells[3] || '').trim();
          voucherGroup = (cells[4] || '').trim();
          costCenter = (cells[5] || '').trim() || defaultCC;
          glAccount = (cells[6] || '').trim() || defaultGL;
          notes = (cells[7] || '').trim();
        } else {
          voucherGroup = (cells[0] || '').trim();
          materialCode = (cells[1] || '').trim().toUpperCase();
          rawQty = (cells[2] || '1').trim();
          purpose = (cells[3] || '').trim();
          department = (cells[4] || '').trim();
          costCenter = (cells[5] || '').trim() || defaultCC;
          glAccount = (cells[6] || '').trim() || defaultGL;
          notes = (cells[7] || '').trim();
        }
      }

      const numQty = Number(rawQty);
      parsed.push({
        rowId: `csv_row_${i}_${Math.random().toString(36).slice(2, 7)}`,
        rowNum: i + 1,
        voucherGroup: voucherGroup || `SIV-${parsed.length + 1}`,
        materialCode,
        rawQty,
        requestedQty: isNaN(numQty) ? 0 : numQty,
        purpose: purpose || `Pengambilan Barang Store (${voucherGroup || `Batch #${parsed.length + 1}`})`,
        department: department || currentUser.department || 'Maintenance',
        costCenter,
        glAccount,
        notes,
      });
    }

    if (parsed.length === 0) {
      setCsvParseError('Tidak ditemukan baris data valid di dalam file CSV.');
    }
    setRawCsvRows(parsed);
  };

  const handleCsvFileProcess = async (file: File) => {
    setIsCsvPanelOpen(true);
    setCsvFileName(file.name);
    try {
      const text = await file.text();
      parseCsvContent(text);
    } catch (err) {
      console.error('Failed to read CSV file:', err);
      setCsvParseError('Gagal membaca file CSV. Pastikan file berformat .csv yang valid.');
      setRawCsvRows([]);
    }
  };

  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleCsvFileProcess(file);
    }
    // Reset input value so re-uploading the same file triggers onChange
    e.target.value = '';
  };

  const handleCsvDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsCsvDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleCsvFileProcess(file);
    }
  };

  // Download sample CSV template populated with real Material Codes from current stockItems
  const handleDownloadCsvTemplate = () => {
    const availItems = stockItems.filter((s) => s.currentStock - s.allocatedStock > 0);
    const sample1 = availItems[0] || stockItems[0];
    const sample2 = availItems[1] || stockItems[1] || sample1;
    const sample3 = availItems[2] || stockItems[2] || sample1;

    const csvHeader =
      'No_Grup_SIV,Material_Code,Qty_Diminta,Keperluan_Pemakaian,Departemen,Cost_Center,GL_Account,Catatan';
    const csvRows = [
      `SIV-01,${sample1?.sku || 'BRG-6205-2RS'},1,"Pemeliharaan Pompa Sirkulasi Line 1","${currentUser.department || 'Maintenance'}",${defaultCC},${defaultGL},"Shift Pagi"`,
      `SIV-01,${sample2?.sku || 'VBL-B-68'},1,"Pemeliharaan Pompa Sirkulasi Line 1","${currentUser.department || 'Maintenance'}",${defaultCC},${defaultGL},"Shift Pagi"`,
      `SIV-02,${sample2?.sku || 'VBL-B-68'},1,"Penggantian V-Belt Mesin Bagging Plant","Produksi & Bagging",${defaultCC},${defaultGL},"Prioritas Normal"`,
      `SIV-03,${sample3?.sku || 'CHN-RS-60'},1,"Perbaikan Rantai Conveyor Transfer","Workshop Mekanik",${defaultCC},${defaultGL},"Sesuai Jadwal Preventive"`,
    ];

    const csvContent = '\uFEFF' + [csvHeader, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Template_Import_Bulk_SIV_PT_AAP.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Validate parsed CSV rows against current stockItems (including cumulative stock check)
  const validatedCsvRows: ValidatedCsvSivRow[] = useMemo(() => {
    const stockBySku = new Map<string, StockItem>();
    stockItems.forEach((item) => {
      stockBySku.set(item.sku.trim().toUpperCase(), item);
    });

    const runningAllocatedByItemId = new Map<string, number>();

    return rawCsvRows.map((row) => {
      const cleanSku = row.materialCode.trim().toUpperCase();
      if (!cleanSku) {
        return {
          ...row,
          availableStockBefore: 0,
          cumulativeAllocatedBefore: 0,
          remainingStockAfter: 0,
          isValid: false,
          errorType: 'EMPTY_CODE',
          errorMessage: 'Material Code kosong / wajib diisi.',
        };
      }

      const matched = stockBySku.get(cleanSku);
      if (!matched) {
        return {
          ...row,
          availableStockBefore: 0,
          cumulativeAllocatedBefore: 0,
          remainingStockAfter: 0,
          isValid: false,
          errorType: 'UNKNOWN_MATERIAL_CODE',
          errorMessage: `Material Code "${cleanSku}" tidak ditemukan di Master Stok saat ini.`,
        };
      }

      const totalAvailable = Math.max(0, matched.currentStock - matched.allocatedStock);
      const alreadyUsedInCsv = runningAllocatedByItemId.get(matched.id) || 0;
      const effectiveAvailableForRow = Math.max(0, totalAvailable - alreadyUsedInCsv);

      if (isNaN(row.requestedQty) || row.requestedQty <= 0) {
        return {
          ...row,
          matchedItem: matched,
          availableStockBefore: totalAvailable,
          cumulativeAllocatedBefore: alreadyUsedInCsv,
          remainingStockAfter: effectiveAvailableForRow,
          isValid: false,
          errorType: 'INVALID_QTY',
          errorMessage: `Qty diminta (${row.rawQty || 0}) harus berupa angka lebih dari 0.`,
        };
      }

      if (row.requestedQty > effectiveAvailableForRow) {
        return {
          ...row,
          matchedItem: matched,
          availableStockBefore: totalAvailable,
          cumulativeAllocatedBefore: alreadyUsedInCsv,
          remainingStockAfter: effectiveAvailableForRow - row.requestedQty,
          isValid: false,
          errorType: 'INSUFFICIENT_STOCK',
          errorMessage:
            alreadyUsedInCsv > 0
              ? `Stok tidak mencukupi! Tersedia: ${totalAvailable} ${matched.unit} (sudah dipakai baris CSV di atas: ${alreadyUsedInCsv} ${matched.unit}, sisa: ${effectiveAvailableForRow} ${matched.unit}), diminta: ${row.requestedQty} ${matched.unit}.`
              : `Stok tidak mencukupi! Tersedia saat ini: ${totalAvailable} ${matched.unit}, diminta: ${row.requestedQty} ${matched.unit}.`,
        };
      }

      runningAllocatedByItemId.set(matched.id, alreadyUsedInCsv + row.requestedQty);

      return {
        ...row,
        matchedItem: matched,
        availableStockBefore: totalAvailable,
        cumulativeAllocatedBefore: alreadyUsedInCsv,
        remainingStockAfter: effectiveAvailableForRow - row.requestedQty,
        isValid: true,
      };
    });
  }, [rawCsvRows, stockItems]);

  // Group validated rows into multiple BulkVoucherDrafts
  const bulkVoucherDrafts: BulkVoucherDraft[] = useMemo(() => {
    if (validatedCsvRows.length === 0) return [];

    if (csvGroupingMode === 'PER_ROW') {
      return validatedCsvRows.map((r, idx) => ({
        draftKey: `draft_row_${r.rowId}`,
        voucherLabel: `Nota SIV Baru #${idx + 1}`,
        purpose: r.purpose,
        department: r.department,
        notes: r.notes,
        rows: [r],
        isValid: r.isValid,
        invalidReason: r.errorMessage,
      }));
    }

    const groupsMap = new Map<string, ValidatedCsvSivRow[]>();
    validatedCsvRows.forEach((r) => {
      const key = `${r.voucherGroup.trim().toUpperCase()}__${r.purpose.trim().toLowerCase()}__${r.department.trim().toLowerCase()}`;
      const existing = groupsMap.get(key) || [];
      existing.push(r);
      groupsMap.set(key, existing);
    });

    const drafts: BulkVoucherDraft[] = [];
    let idx = 1;
    groupsMap.forEach((rows, key) => {
      const first = rows[0];
      const invalidRow = rows.find((r) => !r.isValid);
      drafts.push({
        draftKey: key,
        voucherLabel: first.voucherGroup || `Nota SIV Baru #${idx}`,
        purpose: first.purpose,
        department: first.department,
        notes: rows
          .map((r) => r.notes)
          .filter(Boolean)
          .join('; '),
        rows,
        isValid: !invalidRow,
        invalidReason: invalidRow?.errorMessage,
      });
      idx++;
    });

    return drafts;
  }, [validatedCsvRows, csvGroupingMode]);

  const validCsvRowsCount = validatedCsvRows.filter((r) => r.isValid).length;
  const invalidCsvRowsCount = validatedCsvRows.filter((r) => !r.isValid).length;
  const validVoucherDrafts = bulkVoucherDrafts.filter((d) => d.isValid);

  const handleRemoveCsvRow = (rowId: string) => {
    setRawCsvRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  const handleRemoveAllInvalidCsvRows = () => {
    const validIds = new Set(validatedCsvRows.filter((r) => r.isValid).map((r) => r.rowId));
    setRawCsvRows((prev) => prev.filter((r) => validIds.has(r.rowId)));
  };

  const handleExecuteBulkCreateVouchers = () => {
    setCsvParseError('');
    setCsvImportSuccessMsg('');

    if (invalidCsvRowsCount > 0) {
      setCsvParseError(
        `Terdapat ${invalidCsvRowsCount} baris CSV yang tidak valid (Material Code tidak ditemukan atau stok tidak mencukupi). Hapus baris error atau perbaiki file CSV sebelum menerbitkan SIV.`
      );
      return;
    }

    if (validVoucherDrafts.length === 0) {
      setCsvParseError('Tidak ada Nota SIV valid untuk diterbitkan.');
      return;
    }

    const payload = validVoucherDrafts.map((draft) => ({
      purpose: draft.purpose,
      department: draft.department,
      notes: draft.notes || `Import CSV (${csvFileName || 'Bulk SIV'})`,
      items: draft.rows.map((r) => ({
        itemId: r.matchedItem!.id,
        requestedQty: r.requestedQty,
        costCenter: r.costCenter || defaultCC,
        glAcc: r.glAccount || defaultGL,
      })),
    }));

    const res = createIssueVouchersBulk(payload);
    if (res.success && res.createdVouchers) {
      const createdNums = res.createdVouchers.map((v) => v.voucherNumber).join(', ');
      setCsvImportSuccessMsg(
        `Berhasil menerbitkan ${res.createdVouchers.length} Nota Pengambilan Barang (SIV): ${createdNums}`
      );
      setRawCsvRows([]);
      setCsvFileName(null);
    } else if (res.error) {
      setCsvParseError(res.error);
    }
  };

  // ATURAN AKSES: User tanpa hak canViewAllSIV hanya dapat melihat SIV yang diterbitkan oleh dirinya sendiri
  const roleVisibleVouchers = useMemo(() => {
    if (isRequesterUser) {
      return issueVouchers.filter(
        (v) =>
          v.userId === currentUser.id ||
          v.requestedBy.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      );
    }
    return issueVouchers;
  }, [issueVouchers, isRequesterUser, currentUser.id, currentUser.name]);

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

  // Filter berdasarkan rentang tanggal penerbitan SIV
  const dateFilteredVouchers = useMemo(() => {
    return roleVisibleVouchers.filter((v) => {
      if (!startDate && !endDate) return true;
      const docDateStr = v.requestDate || v.createdAt;
      const docDate = new Date(docDateStr);
      if (isNaN(docDate.getTime())) return true;

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`);
        if (docDate < start) return false;
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999`);
        if (docDate > end) return false;
      }
      return true;
    });
  }, [roleVisibleVouchers, startDate, endDate]);

  const pendingCount = dateFilteredVouchers.filter((v) => v.status === 'PENDING').length;
  const approvedAllCount = dateFilteredVouchers.filter(
    (v) => v.status === 'APPROVED' || v.status === 'HANDOVER_COMPLETED'
  ).length;
  const waitingHandoverCount = dateFilteredVouchers.filter((v) => v.status === 'APPROVED').length;
  const completedCount = dateFilteredVouchers.filter(
    (v) => v.status === 'HANDOVER_COMPLETED'
  ).length;
  const rejectedCount = dateFilteredVouchers.filter((v) => v.status === 'REJECTED').length;

  // Daftar opsi unik Pembuat Nota & Penerima Barang untuk saran cepat (datalist / dropdown)
  const uniqueCreators = useMemo(() => {
    const set = new Set<string>();
    roleVisibleVouchers.forEach((v) => {
      if (v.requestedBy && v.requestedBy.trim()) set.add(v.requestedBy.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [roleVisibleVouchers]);

  const uniqueRecipients = useMemo(() => {
    const set = new Set<string>();
    roleVisibleVouchers.forEach((v) => {
      if (v.recipientName && v.recipientName.trim()) set.add(v.recipientName.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [roleVisibleVouchers]);

  const stockCategoriesByKey = useMemo(() => {
    const map = new Map<string, string[]>();
    stockItems.forEach((item) => {
      const cats = getItemCategories(item);
      map.set(item.id, cats);
      map.set(item.sku.toLowerCase(), cats);
    });
    return map;
  }, [stockItems]);

  const getCategoriesForSivItem = (it: { itemId?: string; sku?: string }): string[] => {
    if (it.itemId && stockCategoriesByKey.has(it.itemId)) {
      return stockCategoriesByKey.get(it.itemId)!;
    }
    if (it.sku && stockCategoriesByKey.has(it.sku.toLowerCase())) {
      return stockCategoriesByKey.get(it.sku.toLowerCase())!;
    }
    return ['Uncategorized'];
  };

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    (stockCategories || []).forEach((c) => {
      if (c.name && c.name.trim()) set.add(c.name.trim());
    });
    stockItems.forEach((item) => {
      getItemCategories(item).forEach((cat) => set.add(cat));
    });
    return ['ALL', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [stockCategories, stockItems]);

  const hasActiveSivFilters = Boolean(
    searchQuery.trim() ||
      categoryFilter !== 'ALL' ||
      creatorFilter.trim() ||
      recipientFilter.trim() ||
      startDate ||
      endDate ||
      activeTab !== 'ALL'
  );

  const resetAllSivFilters = () => {
    setSearchQuery('');
    setCategoryFilter('ALL');
    setCreatorFilter('');
    setRecipientFilter('');
    setStartDate('');
    setEndDate('');
    setActiveTab('ALL');
  };

  const filteredVouchers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const creatorQ = creatorFilter.trim().toLowerCase();
    const recipientQ = recipientFilter.trim().toLowerCase();

    const matched = dateFilteredVouchers.filter((v) => {
      // Status filter
      if (activeTab === 'PENDING' && v.status !== 'PENDING') return false;
      if (
        activeTab === 'APPROVED_ALL' &&
        v.status !== 'APPROVED' &&
        v.status !== 'HANDOVER_COMPLETED'
      ) {
        return false;
      }
      if (activeTab === 'WAITING_HANDOVER' && v.status !== 'APPROVED') return false;
      if (activeTab === 'COMPLETED' && v.status !== 'HANDOVER_COMPLETED') return false;
      if (activeTab === 'REJECTED' && v.status !== 'REJECTED') return false;

      // Filter Kategori Barang
      if (categoryFilter !== 'ALL') {
        const hasCat = v.items.some((it) =>
          getCategoriesForSivItem(it).some(
            (c) => c.toLowerCase() === categoryFilter.toLowerCase()
          )
        );
        if (!hasCat) return false;
      }

      // Filter Pembuat Nota (requestedBy)
      if (creatorQ && !(v.requestedBy || '').toLowerCase().includes(creatorQ)) {
        return false;
      }

      // Filter Penerima Barang (recipientName)
      if (recipientQ && !(v.recipientName || '').toLowerCase().includes(recipientQ)) {
        return false;
      }

      // Search query (No. SIV, nama barang, SKU, kategori barang, departemen, tujuan, pembuat, penerima)
      if (!q) return true;
      return (
        v.voucherNumber.toLowerCase().includes(q) ||
        v.requestedBy.toLowerCase().includes(q) ||
        v.department.toLowerCase().includes(q) ||
        v.purpose.toLowerCase().includes(q) ||
        (v.recipientName && v.recipientName.toLowerCase().includes(q)) ||
        v.items.some(
          (i) =>
            i.sku.toLowerCase().includes(q) ||
            i.itemName.toLowerCase().includes(q) ||
            getCategoriesForSivItem(i).some((c) => c.toLowerCase().includes(q))
        )
      );
    });

    const getStatusPriorityRank = (status: IssueVoucherDocument['status']): number => {
      switch (status) {
        case 'PENDING':
          return 0; // Automatically prioritized at the very top for administrative approval
        case 'APPROVED':
          return 1; // Waiting Warehouse Head verification
        case 'HANDOVER_COMPLETED':
        case 'COMPLETED':
          return 2;
        case 'REJECTED':
          return 3;
        default:
          return 4;
      }
    };

    const getVoucherTimestamp = (v: IssueVoucherDocument): number => {
      const ts = new Date(v.createdAt || v.requestDate).getTime();
      return isNaN(ts) ? 0 : ts;
    };

    return [...matched].sort((a, b) => {
      if (sortBy === 'PRIORITY_PENDING') {
        const rankDiff = getStatusPriorityRank(a.status) - getStatusPriorityRank(b.status);
        if (rankDiff !== 0) return rankDiff;
        return getVoucherTimestamp(b) - getVoucherTimestamp(a);
      }

      if (sortBy === 'NEWEST_FIRST') {
        return getVoucherTimestamp(b) - getVoucherTimestamp(a);
      }

      if (sortBy === 'OLDEST_FIRST') {
        return getVoucherTimestamp(a) - getVoucherTimestamp(b);
      }

      if (sortBy === 'VOUCHER_NUMBER') {
        return a.voucherNumber.localeCompare(b.voucherNumber);
      }

      return 0;
    });
  }, [
    dateFilteredVouchers,
    activeTab,
    searchQuery,
    categoryFilter,
    creatorFilter,
    recipientFilter,
    sortBy,
    stockCategoriesByKey,
  ]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return iso;
    }
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return iso;
    }
  };

  // Unduh Rekap SIV dalam format Excel (.xlsx)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headerRows = [
      ['REKAPITULASI NOTA PENGAMBILAN BARANG (STORE ISSUE VOUCHER / SIV)'],
      [
        `Periode Terbit: ${
          startDate || endDate
            ? `${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`
            : 'Semua Tanggal'
        } | Pemohon: ${isRequesterUser ? currentUser.name : 'Semua Pemohon'}`,
      ],
      [],
      [
        'No',
        'No. Nota SIV',
        'Tanggal Terbit',
        'Pemohon (Disetujui Permintaan)',
        'Departemen / Divisi',
        'Keperluan',
        'Status SIV',
        'Disetujui Kepala Gudang',
        'Waktu ACC SIV',
        'Diserahkan Admin Gudang',
        'Diterima Oleh (Penerima)',
        'Waktu Penyerahan',
        'Material Code',
        'Nama Barang',
        'Qty Diminta',
        'Qty Dikeluarkan',
        'Satuan',
        'Cost Center',
        'GL Account',
      ],
    ];

    const dataRows: (string | number)[][] = [];
    let rowIdx = 1;

    filteredVouchers.forEach((v) => {
      const statusLabel =
        v.status === 'PENDING'
          ? 'Menunggu ACC Kepala Store'
          : v.status === 'APPROVED'
          ? 'Di-ACC Kepala Store (Terkunci · Menunggu Penyerahan Admin Store)'
          : v.status === 'HANDOVER_COMPLETED'
          ? 'Diserahkan Admin Store ke Penerima (Stok Otomatis Berkurang)'
          : 'Ditolak';

      v.items.forEach((item) => {
        const issuedVal =
          v.status === 'HANDOVER_COMPLETED'
            ? item.isCancelled
              ? 0
              : item.issuedQty ?? item.requestedQty
            : 0;

        dataRows.push([
          rowIdx++,
          v.voucherNumber,
          formatDate(v.requestDate),
          v.approvedByRequester || v.requestedBy,
          v.department,
          v.purpose,
          statusLabel,
          v.warehouseHeadName || v.approvedByWarehouseHead || '-',
          v.headApprovedAt ? formatDateTime(v.headApprovedAt) : '-',
          v.handoverOfficer || v.approvedByAdmin || '-',
          v.recipientName || '-',
          v.handoverAt ? formatDateTime(v.handoverAt) : '-',
          item.sku,
          item.itemName,
          item.requestedQty,
          issuedVal,
          item.unit,
          item.costCenter || v.costCenter || '-',
          item.glAccount || item.glAcc || v.glAccount || '-',
        ]);
      });
    });

    const ws = XLSX.utils.aoa_to_sheet([...headerRows, ...dataRows]);
    ws['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 15 },
      { wch: 22 },
      { wch: 22 },
      { wch: 30 },
      { wch: 28 },
      { wch: 22 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 32 },
      { wch: 12 },
      { wch: 15 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Daftar SIV');
    const suffix =
      startDate || endDate
        ? `${startDate || 'Awal'}_sd_${endDate || 'Akhir'}`
        : new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Rekap_SIV_${suffix}.xlsx`);
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700 mb-1">
              <ArrowUpRight className="w-4 h-4" />
              <span>Outbound / Nota Pengeluaran Stok</span>
              {isRequesterUser && (
                <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 normal-case font-semibold">
                  Akses Pemohon: Hanya SIV Milik {currentUser.name}
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Nota Pengambilan Barang (Store Issue Voucher / SIV)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl">
              {isRequesterUser
                ? `Menampilkan daftar Nota Pengambilan Barang (SIV) yang diterbitkan oleh Anda (${currentUser.name}). SIV dapat diedit atau dihapus selama belum diverifikasi/di-ACC oleh Admin Gudang.`
                : 'Pemisahan Wewenang SIV: (1) Pemohon menerbitkan SIV (bisa diedit/dihapus sebelum di-ACC Admin), (2) User Admin Gudang hanya meng-ACC SIV & validasi/scan barcode barang + qty diserahkan (SIV terkunci, stok belum berubah), (3) User Kepala Gudang meng-approve pengurangan stock (otomatis memotong stock sistem).'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Hidden File Input for CSV Import of Issue Vouchers */}
            <input
              ref={csvFileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFileChange}
              className="hidden"
              aria-label="Import CSV Issue Vouchers (SIV)"
              data-testid="siv-csv-file-input"
            />

            {perms.canCreateSIV && (
              <>
                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors"
                  title="Unduh file template CSV resmi untuk membuat beberapa Nota SIV sekaligus"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" />
                  <span>Template CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsCsvPanelOpen(true);
                    csvFileInputRef.current?.click();
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors shadow-2xs ${
                    isCsvPanelOpen
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-500'
                      : 'text-blue-900 bg-blue-50 hover:bg-blue-100 border-blue-300'
                  }`}
                  title="Impor file CSV untuk validasi Material Code terhadap stok & menerbitkan banyak Nota SIV sekaligus"
                >
                  <Upload className="w-4 h-4" />
                  <span>Impor CSV SIV (Bulk)</span>
                </button>
              </>
            )}

            {canExportSap && (
              <>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs"
                  title="Unduh daftar SIV sesuai filter rentang tanggal ke file Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>Unduh Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSapExportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 border border-amber-500 rounded-lg transition-colors shadow-2xs cursor-pointer"
                  title="Export data SIV ke format Excel (.xlsx) atau CSV (.csv) standar untuk Import Sistem SAP (MIGO / MB1A Mvt 201 Cost Center & GL Account)"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-950" />
                  <span>Export SAP (.xlsx / .csv)</span>
                </button>
              </>
            )}

            {perms.canCreateSIV && (
              <button
                onClick={onOpenCreateVoucher}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                Buat Nota Pengambilan Baru
              </button>
            )}
          </div>
        </div>

        {/* CSV Bulk Import & Material Code Stock Validation Panel */}
        {perms.canCreateSIV && (isCsvPanelOpen || rawCsvRows.length > 0 || csvImportSuccessMsg) && (
          <div className="mt-5 p-4 sm:p-5 bg-slate-50 border border-blue-200 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Impor CSV &amp; Validasi Stok Massal Nota Pengambilan Barang (Bulk SIV)
                  </h2>
                  <p className="text-xs text-slate-600">
                    Unggah file <strong>.csv</strong> untuk memvalidasi setiap{' '}
                    <span className="font-mono font-semibold">Material Code</span> terhadap saldo
                    stok tersedia sebelum menerbitkan beberapa Nota SIV sekaligus.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-100 hover:bg-blue-200 border border-blue-300 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Contoh CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCsvPanelOpen(false);
                    setRawCsvRows([]);
                    setCsvFileName(null);
                    setCsvParseError('');
                    setCsvImportSuccessMsg('');
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Tutup panel Import CSV"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* File Dropzone & Direct CSV File Input */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsCsvDragOver(true);
              }}
              onDragLeave={() => setIsCsvDragOver(false)}
              onDrop={handleCsvDrop}
              className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                isCsvDragOver
                  ? 'border-blue-500 bg-blue-50/70'
                  : 'border-slate-300 bg-white hover:border-blue-400'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {csvFileName ? (
                        <span>
                          File Terpilih:{' '}
                          <span className="text-blue-700 font-mono">{csvFileName}</span>
                        </span>
                      ) : (
                        'Pilih atau seret file CSV (.csv) daftar Nota Pengambilan Barang (SIV)'
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Format kolom CSV:{' '}
                      <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">
                        No_Grup_SIV, Material_Code, Qty_Diminta, Keperluan_Pemakaian, Departemen,
                        Cost_Center, GL_Account, Catatan
                      </code>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg cursor-pointer transition-colors shadow-2xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Pilih File CSV</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {isStockLockedForOpname && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Stok Store Sedang Ter-Lock:</strong> Sesi Stock Opname #
                  {activeStockOpname?.opnameNumber} sedang berlangsung. Penerbitan SIV massal
                  dikunci sementara.
                </span>
              </div>
            )}

            {csvParseError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">{csvParseError}</div>
              </div>
            )}

            {csvImportSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">{csvImportSuccessMsg}</span>
                </div>
              </div>
            )}

            {/* Validation Results & Voucher Preview */}
            {validatedCsvRows.length > 0 && (
              <div className="space-y-3">
                {/* Summary Bar & Grouping Mode */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">Hasil Validasi Stok CSV:</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-semibold">
                      {validatedCsvRows.length} Baris Item
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                      {validCsvRowsCount} Material Valid &amp; Stok Cukup
                    </span>
                    {invalidCsvRowsCount > 0 && (
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">
                        {invalidCsvRowsCount} Baris Tidak Valid
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 font-semibold flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      <span>
                        {validVoucherDrafts.length} dari {bulkVoucherDrafts.length} Nota SIV Siap
                        Terbit
                      </span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-slate-600">
                      Mode Pengelompokan SIV:
                    </span>
                    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setCsvGroupingMode('BY_GROUP_OR_PURPOSE')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          csvGroupingMode === 'BY_GROUP_OR_PURPOSE'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Per No. Grup / Keperluan ({bulkVoucherDrafts.length} Nota)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCsvGroupingMode('PER_ROW')}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                          csvGroupingMode === 'PER_ROW'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        1 Baris = 1 Nota SIV ({validatedCsvRows.length} Nota)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Invalid Rows Warning Banner with Quick Clean Button */}
                {invalidCsvRowsCount > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-red-900">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">
                           Ditemukan {invalidCsvRowsCount} baris dengan Material Code tidak terdaftar
                          atau melebihi stok tersedia!
                        </strong>
                        <p className="text-[11px] text-red-800 mt-0.5">
                          Perbaiki file CSV Anda atau hapus baris yang tidak valid agar pembuatan
                          SIV massal dapat diproses.
                        </p>
                      </div>
                    </div>
                    {validCsvRowsCount > 0 && (
                      <button
                        type="button"
                        onClick={handleRemoveAllInvalidCsvRows}
                        className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white font-semibold text-[11px] shrink-0 self-start sm:self-auto"
                      >
                        Hapus {invalidCsvRowsCount} Baris Error &amp; Sisakan yang Valid
                      </button>
                    )}
                  </div>
                )}

                {/* Row-by-Row Material Code & Stock Validation Table */}
                <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white max-h-72 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 w-12 text-center">Baris</th>
                        <th className="px-3 py-2">Grup SIV</th>
                        <th className="px-3 py-2">Material Code</th>
                        <th className="px-3 py-2">Nama Barang (Master Stok)</th>
                        <th className="px-3 py-2 text-right">Stok Tersedia</th>
                        <th className="px-3 py-2 text-right">Qty Diminta</th>
                        <th className="px-3 py-2 text-right">Sisa Stok</th>
                        <th className="px-3 py-2">Keperluan &amp; Dept</th>
                        <th className="px-3 py-2">Status Validasi</th>
                        <th className="px-3 py-2 w-10 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validatedCsvRows.map((row) => (
                        <tr
                          key={row.rowId}
                          className={
                            row.isValid ? 'hover:bg-slate-50' : 'bg-red-50/60 hover:bg-red-50'
                          }
                        >
                          <td className="px-3 py-2 text-center font-mono text-slate-500">
                            #{row.rowNum}
                          </td>
                          <td className="px-3 py-2 font-mono font-semibold text-slate-800">
                            {row.voucherGroup}
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-900">
                            {row.materialCode || (
                              <span className="text-red-600 italic">[Kosong]</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {row.matchedItem ? (
                              <div>
                                <span className="font-medium text-slate-900">
                                  {row.matchedItem.name}
                                </span>
                                <span className="block text-[10px] text-slate-500 font-mono">
                                  Rak: {row.matchedItem.location} &middot; CC: {row.costCenter}{' '}
                                  &middot; GL: {row.glAccount}
                                </span>
                              </div>
                            ) : (
                              <span className="text-red-600 font-semibold">
                                Tidak Ditemukan di Master Stok
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {row.matchedItem ? (
                              <span className="text-slate-700">
                                {row.availableStockBefore - row.cumulativeAllocatedBefore}{' '}
                                {row.matchedItem.unit}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                            <span className={row.isValid ? 'text-slate-900' : 'text-red-600'}>
                              {row.requestedQty} {row.matchedItem?.unit || ''}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {row.matchedItem ? (
                              <span
                                className={
                                  row.remainingStockAfter >= 0
                                    ? 'text-emerald-700 font-semibold'
                                    : 'text-red-600 font-bold'
                                }
                              >
                                {row.remainingStockAfter} {row.matchedItem.unit}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-3 py-2 max-w-[200px]">
                            <div className="truncate font-medium text-slate-800" title={row.purpose}>
                              {row.purpose}
                            </div>
                            <div className="text-[10px] text-slate-500 truncate">
                              Dept: {row.department}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[11px] font-semibold">
                                <CheckCircle2 className="w-3 h-3" />
                                Valid (Stok Siap)
                              </span>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-800 text-[11px] font-bold">
                                  <XCircle className="w-3 h-3" />
                                  {row.errorType === 'UNKNOWN_MATERIAL_CODE'
                                    ? 'Kode Tidak Terdaftar'
                                    : row.errorType === 'INSUFFICIENT_STOCK'
                                    ? 'Stok Tidak Cukup'
                                    : 'Data Invalid'}
                                </span>
                                <p className="text-[10.5px] text-red-700 leading-tight">
                                  {row.errorMessage}
                                </p>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveCsvRow(row.rowId)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                              title="Hapus baris CSV ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Action Footer for Bulk Voucher Creation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="text-xs text-slate-600">
                    Ringkasan Nota SIV yang akan diterbitkan:{' '}
                    <strong className="text-slate-900">
                      {validVoucherDrafts.length} Nota Pengambilan Barang
                    </strong>{' '}
                    ({validCsvRowsCount} baris barang tervalidasi)
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRawCsvRows([]);
                        setCsvFileName(null);
                        setCsvParseError('');
                      }}
                      className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Reset CSV
                    </button>

                    <button
                      type="button"
                      disabled={
                        invalidCsvRowsCount > 0 ||
                        validVoucherDrafts.length === 0 ||
                        isStockLockedForOpname
                      }
                      onClick={handleExecuteBulkCreateVouchers}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Terbitkan {validVoucherDrafts.length} Nota SIV Sekaligus (Bulk Create)
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Panel Pencarian & Filter Lanjutan Nota SIV (Real-Time) */}
        <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
                <Filter className="w-4 h-4 text-amber-600" />
                <span>Pencarian & Filter Lanjutan Nota SIV (Real-Time)</span>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-mono text-slate-700">
                Menampilkan <strong>{filteredVouchers.length}</strong> dari{' '}
                <strong>{roleVisibleVouchers.length}</strong> Nota SIV
              </span>
            </div>

            {hasActiveSivFilters && (
              <button
                type="button"
                onClick={resetAllSivFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Semua Filter</span>
              </button>
            )}
          </div>

          {/* Grid Filter Utama: Cari Barang/Nota, Filter Kategori Barang, Status Nota, Pembuat Nota, Penerima Barang */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* 1. Pencarian Cepat No. SIV / Nama Barang / SKU / Kategori */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Cari No. Nota / Nama Barang / SKU / Kategori
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik No. SIV, nama barang, SKU..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Filter Kategori Barang */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Filter Kategori Barang
              </label>
              <div className="relative">
                <Tags className="w-3.5 h-3.5 text-amber-600 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                >
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'ALL' ? 'Semua Kategori Barang' : cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Filter Status Nota (Pending / Approved / Detail) */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Status Nota (Pending / Approved)
              </label>
              <select
                value={activeTab}
                onChange={(e) =>
                  setActiveTab(
                    e.target.value as
                      | 'ALL'
                      | 'PENDING'
                      | 'APPROVED_ALL'
                      | 'WAITING_HANDOVER'
                      | 'COMPLETED'
                      | 'REJECTED'
                  )
                }
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
              >
                <option value="ALL">Semua Status ({dateFilteredVouchers.length})</option>
                <option value="PENDING">Pending — Menunggu ACC Kepala Store ({pendingCount})</option>
                <option value="APPROVED_ALL">
                  Approved — Sudah Di-ACC / Selesai ({approvedAllCount})
                </option>
                <option value="WAITING_HANDOVER">
                  Di-ACC Kepala Store — Menunggu Penyerahan Admin ({waitingHandoverCount})
                </option>
                <option value="COMPLETED">
                  Selesai — Diserahkan Admin ke Penerima &amp; Stok Berkurang ({completedCount})
                </option>
                <option value="REJECTED">Ditolak / Rejected ({rejectedCount})</option>
              </select>
            </div>

            {/* 3. Filter Pembuat Nota (Requested By) */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Pembuat Nota (Pemohon SIV)
              </label>
              <div className="relative">
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  list="siv-creator-options"
                  value={creatorFilter}
                  onChange={(e) => setCreatorFilter(e.target.value)}
                  placeholder="Pilih / ketik nama pembuat nota..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
                <datalist id="siv-creator-options">
                  {uniqueCreators.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                {creatorFilter && (
                  <button
                    type="button"
                    onClick={() => setCreatorFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 4. Filter Penerima Barang (Recipient Name) */}
            <div>
              <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                Penerima Barang
              </label>
              <div className="relative">
                <UserCheck className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  list="siv-recipient-options"
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                  placeholder="Pilih / ketik nama penerima barang..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
                />
                <datalist id="siv-recipient-options">
                  {uniqueRecipients.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
                {recipientFilter && (
                  <button
                    type="button"
                    onClick={() => setRecipientFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Baris Filter Tanggal & Pengurutan */}
          <div className="pt-2 border-t border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Filter Tanggal Nota:</span>
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
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
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-[11px] font-semibold transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Tanggal</span>
                  </button>
                )}
              </div>
            </div>

            {/* Client-Side Sort */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs self-start lg:self-auto">
              <ArrowUpDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-slate-600 font-medium whitespace-nowrap">Urutkan:</span>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(
                    e.target.value as
                      | 'PRIORITY_PENDING'
                      | 'NEWEST_FIRST'
                      | 'OLDEST_FIRST'
                      | 'VOUCHER_NUMBER'
                  )
                }
                aria-label="Urutkan Daftar SIV"
                className="bg-transparent font-semibold text-slate-900 focus:outline-hidden cursor-pointer text-xs"
              >
                <option value="PRIORITY_PENDING">Prioritas PENDING di Atas (Cepat ACC)</option>
                <option value="NEWEST_FIRST">Terbaru Diterbitkan</option>
                <option value="OLDEST_FIRST">Terlama Diterbitkan</option>
                <option value="VOUCHER_NUMBER">Nomor Nota SIV (A-Z)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Status Filter Tabs Cepat */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua SIV ({dateFilteredVouchers.length})
            </button>

            <button
              onClick={() => setActiveTab('PENDING')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'PENDING'
                  ? 'bg-white text-amber-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Pending ({pendingCount})
            </button>

            <button
              onClick={() => setActiveTab('APPROVED_ALL')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'APPROVED_ALL'
                  ? 'bg-white text-emerald-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Semua Approved ({approvedAllCount})
            </button>

            <button
              onClick={() => setActiveTab('WAITING_HANDOVER')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'WAITING_HANDOVER'
                  ? 'bg-white text-blue-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Di-ACC Kepala Store · Siap Diserahkan ({waitingHandoverCount})
            </button>

            <button
              onClick={() => setActiveTab('COMPLETED')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'COMPLETED'
                  ? 'bg-white text-emerald-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Selesai Diserahkan ({completedCount})
            </button>

            <button
              onClick={() => setActiveTab('REJECTED')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'REJECTED'
                  ? 'bg-white text-red-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <XCircle className="w-3.5 h-3.5 text-red-500" />
              Ditolak ({rejectedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Rules Notice Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-start gap-2">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Alur Resmi Proses SIV:</strong> (1) <strong>Pemohon menerbitkan SIV</strong> (dapat diedit atau dihapus selama Kepala Store belum meng-ACC SIV; pemohon hanya dapat melihat SIV miliknya sendiri). (2){' '}
          <strong>Kepala Store ACC SIV</strong> &mdash; SIV terkunci dan siap diproses penyerahan fisiknya (stock fisik belum berkurang). (3){' '}
          <strong>Admin Store menyerahkan barang ke penerima</strong> (disertai validasi scan barcode barang &amp; input nama penerima) &mdash; <strong>setelah Admin menyerahkan barang, otomatis stock berkurang!</strong>
        </p>
      </div>

      {/* Voucher List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        {filteredVouchers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            Tidak ada nota pengambilan barang (SIV) yang sesuai dengan filter atau rentang tanggal.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredVouchers.map((voucher) => {
              const isExpanded = expandedId === voucher.id;
              const isPending = voucher.status === 'PENDING';
              const isWaitingHandover = voucher.status === 'APPROVED';
              const isCompleted = voucher.status === 'HANDOVER_COMPLETED';
              const isRejected = voucher.status === 'REJECTED';
              const isLocked = isWaitingHandover || isCompleted;

              const totalRequested = voucher.items.reduce((a, b) => a + b.requestedQty, 0);
              const totalIssued = voucher.items.reduce(
                (a, b) =>
                  a +
                  (isCompleted
                    ? b.isCancelled
                      ? 0
                      : b.issuedQty ?? b.requestedQty
                    : 0),
                0
              );

              return (
                <div key={voucher.id} className="transition-colors hover:bg-slate-50/50">
                  <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Voucher Details */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          {voucher.voucherNumber}
                        </span>
                        <span className="text-slate-300">·</span>

                        {isPending && (
                          <span className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            Tahap 1: Diterbitkan Pemohon &mdash; Menunggu ACC Kepala Store (Bisa Edit/Hapus)
                          </span>
                        )}
                        {isWaitingHandover && (
                          <span className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Tahap 2: Di-ACC Kepala Store (SIV Terkunci) &mdash; Menunggu Admin Store Menyerahkan Barang ke Penerima
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Tahap 3 Selesai: Barang Diserahkan Admin ke Penerima (Stok Otomatis Berkurang)
                          </span>
                        )}
                        {isRejected && (
                          <span className="text-xs font-semibold text-red-700 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" />
                            Ditolak
                          </span>
                        )}
                      </div>

                      {/* Purpose */}
                      <p className="text-xs font-semibold text-slate-900">{voucher.purpose}</p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1 text-slate-700">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {voucher.department} (Pemohon: {voucher.requestedBy})
                        </span>
                        <span>·</span>
                        <span>Tgl Terbit: {formatDate(voucher.requestDate)}</span>
                        <span>·</span>
                        <span className="font-mono tabular-nums">
                          Diminta: {totalRequested} unit ({voucher.items.length} item)
                          {isCompleted && ` | Diserahkan: ${totalIssued} unit`}
                        </span>

                        {(voucher.warehouseHeadName || voucher.approvedByWarehouseHead) && (
                          <>
                            <span>·</span>
                            <span className="text-blue-700 font-medium">
                              Di-ACC Kepala Store: {voucher.warehouseHeadName || voucher.approvedByWarehouseHead} (
                              {voucher.headApprovedAt ? formatDateTime(voucher.headApprovedAt) : 'Disetujui'})
                            </span>
                          </>
                        )}

                        {isCompleted && voucher.handoverAt && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-700 font-medium">
                              Diserahkan Admin: {voucher.handoverOfficer || voucher.approvedByAdmin} &rarr; Penerima:{' '}
                              {voucher.recipientName} ({formatDateTime(voucher.handoverAt)})
                            </span>
                          </>
                        )}
                      </div>

                      {isRejected && voucher.rejectionReason && (
                        <div className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
                          <strong>Alasan Ditolak:</strong> {voucher.rejectionReason}
                        </div>
                      )}
                    </div>

                    {/* Actions Group */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Print & PDF Button */}
                      <button
                        onClick={() => onPrintVoucher(voucher)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-2xs"
                        title="Cetak atau Unduh Dokumen Nota Pengambilan Barang (PDF)"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Cetak / Unduh PDF</span>
                      </button>

                      {/* Tahap 2: User Kepala Store ACC SIV */}
                      {isKepalaGudang && isPending && (
                        <button
                          onClick={() => onOpenApproval(voucher)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-2xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>ACC SIV (Kepala Store)</span>
                        </button>
                      )}

                      {isAdmin && !isKepalaGudang && isPending && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                          <Clock className="w-3.5 h-3.5 text-amber-600" />
                          <span>Menunggu ACC Kepala Store</span>
                        </span>
                      )}

                      {/* Tahap 3: User Admin Store Menyerahkan Barang ke Penerima & Scan Barcode (Otomatis Potong Stock) */}
                      {isAdmin && isWaitingHandover && (
                        <button
                          onClick={() => onOpenApproval(voucher)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors shadow-2xs"
                        >
                          <ScanBarcode className="w-3.5 h-3.5" />
                          <span>Serahkan Barang ke Penerima (Admin Store)</span>
                        </button>
                      )}

                      {isKepalaGudang && !isAdmin && isWaitingHandover && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 border border-blue-200 rounded-lg">
                          <Lock className="w-3.5 h-3.5 text-blue-600" />
                          <span>Di-ACC Kepala Store · Menunggu Penyerahan Admin</span>
                        </span>
                      )}

                      {/* Edit Button */}
                      {isLocked ? (
                        <button
                          onClick={() => onOpenEditVoucher(voucher)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors"
                          title="SIV telah di-ACC Kepala Store dan terkunci (hanya baca)"
                        >
                          <Lock className="w-3.5 h-3.5 text-slate-500" />
                          <span>Terkunci</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onOpenEditVoucher(voucher)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                          title="Edit item, tambah barang, atau hapus barang pada nota (sebelum di-ACC Kepala Store)"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Edit Item</span>
                        </button>
                      )}

                      {/* Delete Button */}
                      {isLocked ? (
                        <button
                          disabled
                          className="p-1.5 text-slate-300 bg-slate-100 rounded-lg cursor-not-allowed border border-slate-200"
                          title="SIV sudah di-ACC Kepala Store & terkunci. User pemohon tidak dapat menghapus!"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `Batalkan dan hapus nota #${voucher.voucherNumber}?`
                              )
                            ) {
                              onDeleteVoucher(voucher.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors border border-transparent hover:border-red-200"
                          title="Hapus / Batalkan Nota (sebelum di-ACC Kepala Store)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {/* Expand / Details */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : voucher.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                        title={isExpanded ? 'Tutup rincian' : 'Lihat rincian item'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Item Details */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-1 bg-slate-50/70 border-t border-slate-100">
                      <div className="border border-slate-200 rounded-lg overflow-x-auto bg-white">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                            <tr>
                              <th className="px-3 py-2 text-center w-10">No</th>
                              <th className="px-3 py-2">Material Code</th>
                              <th className="px-3 py-2">Nama Barang</th>
                              <th className="px-3 py-2">Kategori Barang</th>
                              <th className="px-3 py-2 text-right">Qty Diminta</th>
                              <th className="px-3 py-2 text-right">Qty Diserahkan (Admin Store)</th>
                              <th className="px-3 py-2 text-center">Status Penyerahan &amp; Stok</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {voucher.items.map((item, idx) => {
                              const actualQty = isCompleted
                                ? item.isCancelled
                                  ? 0
                                  : item.issuedQty ?? item.requestedQty
                                : 0;
                              const isCancelledItem =
                                isCompleted && (item.isCancelled || actualQty === 0);
                              const itemCats = getCategoriesForSivItem(item);

                              return (
                                <tr
                                  key={idx}
                                  className={isCancelledItem ? 'bg-red-50/40 text-slate-400' : ''}
                                >
                                  <td className="px-3 py-2 text-center tabular-nums text-slate-500">
                                    {idx + 1}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-slate-700">{item.sku}</td>
                                  <td className="px-3 py-2 font-medium text-slate-900">
                                    <span className={isCancelledItem ? 'line-through text-slate-400' : ''}>
                                      {item.itemName}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-wrap gap-1">
                                      {itemCats.map((cat) => (
                                        <button
                                          key={cat}
                                          type="button"
                                          onClick={() => setCategoryFilter(cat)}
                                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                                            categoryFilter.toLowerCase() === cat.toLowerCase()
                                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                          }`}
                                          title={`Filter berdasarkan kategori: ${cat}`}
                                        >
                                          {cat}
                                        </button>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-medium text-slate-900 tabular-nums">
                                    {item.requestedQty} {item.unit}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">
                                    {isCompleted ? (
                                      isCancelledItem ? (
                                        <span className="text-red-600">0 {item.unit} (Batal Keluar)</span>
                                      ) : (
                                        <span className="text-emerald-700">
                                          -{actualQty} {item.unit} (Stok Otomatis Berkurang)
                                        </span>
                                      )
                                    ) : isWaitingHandover ? (
                                      <span className="text-blue-700">
                                        Siap Diserahkan ({item.requestedQty} {item.unit})
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">0 (Menunggu ACC Kepala Store)</span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-center">
                                    {isCompleted ? (
                                      isCancelledItem ? (
                                        <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                          <Ban className="w-3 h-3" />
                                          Tidak Jadi Dikeluarkan (Stok Tidak Dipotong)
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                          <CheckCircle2 className="w-3 h-3" />
                                          Diserahkan Admin ke Penerima &amp; Stok Otomatis Berkurang
                                        </span>
                                      )
                                    ) : isWaitingHandover ? (
                                      <span className="text-blue-700 font-semibold">
                                        Di-ACC Kepala Store &middot; Menunggu Penyerahan Admin Store
                                      </span>
                                    ) : (
                                      <span className="text-amber-700 font-medium">
                                        Menunggu ACC Kepala Store
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Signature & Audit Summary Box */}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs bg-white p-3 rounded-lg border border-slate-200">
                        <div>
                          <span className="text-slate-500 block text-[10.5px]">
                            Tahap 1 - Diterbitkan Oleh (Pemohon):
                          </span>
                          <span className="font-semibold text-slate-900">
                            {voucher.approvedByRequester || voucher.requestedBy}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10.5px]">
                            Tahap 2 - Di-ACC Oleh (Kepala Store):
                          </span>
                          <span className="font-semibold text-slate-900">
                            {voucher.warehouseHeadName || voucher.approvedByWarehouseHead || '-'}
                          </span>
                          {voucher.headApprovedAt && (
                            <span className="block text-[10px] font-mono text-blue-700">
                              TTD Digital: {formatDateTime(voucher.headApprovedAt)}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10.5px]">
                            Tahap 3 - Diserahkan Oleh (Admin Store):
                          </span>
                          <span className="font-semibold text-slate-900">
                            {voucher.handoverOfficer || voucher.approvedByAdmin || '-'}
                          </span>
                          {voucher.handoverAt && (
                            <span className="block text-[10px] font-mono text-emerald-700">
                              TTD Digital: {formatDateTime(voucher.handoverAt)}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[10.5px]">
                            Diterima Oleh (Penerima Barang):
                          </span>
                          <span className="font-semibold text-slate-900">
                            {voucher.recipientName || '(Diinput Admin saat penyerahan)'}
                          </span>
                        </div>
                      </div>

                      {voucher.notes && (
                        <p className="mt-2 text-xs text-slate-600">
                          <strong>Catatan Tambahan:</strong> {voucher.notes}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canExportSap && isSapExportModalOpen && (
        <SapExportModal
          isOpen={isSapExportModalOpen}
          onClose={() => setIsSapExportModalOpen(false)}
          defaultModule="SIV_GI_201"
          vouchers={filteredVouchers}
          lpbDocs={lpbDocuments}
          stockItems={stockItems}
          costCenters={costCenters}
          glAccounts={glAccounts}
          initialStartDate={startDate}
          initialEndDate={endDate}
        />
      )}
    </div>
  );
};
