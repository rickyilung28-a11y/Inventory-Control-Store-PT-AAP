import * as XLSX from 'xlsx';
import {
  StockItem,
  LPBDocument,
  IssueVoucherDocument,
  CostCenterEntry,
  GLAccountEntry,
  getItemCategories,
  formatItemCategories,
} from '../types/inventory';

export type SapExportModule = 'SIV_GI_201' | 'LPB_GR_101' | 'MATERIAL_MASTER' | 'ALL_SAP_SHEETS';
export type SapDateFormat = 'YYYYMMDD' | 'DD.MM.YYYY' | 'YYYY-MM-DD';
export type SapHeaderStyle = 'TECHNICAL_ONLY' | 'DUAL_HEADER' | 'FRIENDLY_ID';
export type SapCsvDelimiter = ';' | ',' | '\t';

export interface SapExportConfig {
  module: SapExportModule;
  plantCode: string; // WERKS, e.g. 'AAP1'
  storageLocation: string; // LGORT, e.g. 'STR1'
  dateFormat: SapDateFormat;
  headerStyle: SapHeaderStyle;
  csvDelimiter: SapCsvDelimiter;
  onlyApprovedTransactions: boolean;
  startDate?: string;
  endDate?: string;
}

export interface SapColumnDef {
  techName: string;
  label: string;
  width: number;
}

export const SAP_SIV_COLUMNS: SapColumnDef[] = [
  { techName: 'BLDAT', label: 'Document Date (Tanggal Nota)', width: 14 },
  { techName: 'BUDAT', label: 'Posting Date (Tanggal Posting)', width: 14 },
  { techName: 'XBLNR', label: 'Reference Doc (No. SIV)', width: 20 },
  { techName: 'BKTXT', label: 'Document Header Text (Keperluan)', width: 32 },
  { techName: 'GM_CODE', label: 'SAP GM_CODE (03=GI)', width: 12 },
  { techName: 'BWART', label: 'Movement Type (201=GI CostCtr)', width: 14 },
  { techName: 'WERKS', label: 'Plant (WERKS)', width: 10 },
  { techName: 'LGORT', label: 'Storage Location (LGORT)', width: 12 },
  { techName: 'ZEILE', label: 'Line Item No (ZEILE)', width: 10 },
  { techName: 'MATNR', label: 'Material Code (MATNR)', width: 18 },
  { techName: 'MAKTX', label: 'Material Description (Nama Barang)', width: 34 },
  { techName: 'MATKL', label: 'Material Group (Kategori Barang)', width: 24 },
  { techName: 'LGPBE', label: 'Storage Bin (Lokasi Rak)', width: 16 },
  { techName: 'ERFMG', label: 'Quantity Issued (Qty Keluar)', width: 15 },
  { techName: 'ERFME', label: 'Unit of Entry (UoM)', width: 10 },
  { techName: 'KOSTL', label: 'Cost Center (KOSTL)', width: 16 },
  { techName: 'KOSTL_TXT', label: 'Cost Center Name & Desc', width: 32 },
  { techName: 'SAKNR', label: 'G/L Account (SAKNR)', width: 16 },
  { techName: 'SAKNR_TXT', label: 'G/L Account Name & Desc', width: 32 },
  { techName: 'WEMPF', label: 'Goods Recipient (Penerima Barang)', width: 22 },
  { techName: 'ABLAD', label: 'Unloading Point (Departemen)', width: 22 },
  { techName: 'SGTXT', label: 'Item Text (Catatan / Pemohon)', width: 32 },
  { techName: 'ZSTATUS', label: 'Status SIV Store', width: 18 },
];

export const SAP_LPB_COLUMNS: SapColumnDef[] = [
  { techName: 'BLDAT', label: 'Document Date (Tanggal SJ)', width: 14 },
  { techName: 'BUDAT', label: 'Posting Date (Tanggal Posting)', width: 14 },
  { techName: 'XBLNR', label: 'Reference / Delivery Note (No. SJ)', width: 22 },
  { techName: 'BKTXT', label: 'Header Text (No. LPB & Supplier)', width: 32 },
  { techName: 'GM_CODE', label: 'SAP GM_CODE (01=GR)', width: 12 },
  { techName: 'BWART', label: 'Movement Type (101=PO / 501=NonPO)', width: 14 },
  { techName: 'EBELN', label: 'Purchase Order No (EBELN)', width: 18 },
  { techName: 'EBELP', label: 'PO Item No (EBELP)', width: 12 },
  { techName: 'LIFNR_NAME', label: 'Vendor / Supplier Name', width: 28 },
  { techName: 'WERKS', label: 'Plant (WERKS)', width: 10 },
  { techName: 'LGORT', label: 'Storage Location (LGORT)', width: 12 },
  { techName: 'ZEILE', label: 'Line Item No (ZEILE)', width: 10 },
  { techName: 'MATNR', label: 'Material Code (MATNR)', width: 18 },
  { techName: 'MAKTX', label: 'Material Description (Nama Barang)', width: 34 },
  { techName: 'MATKL', label: 'Material Group (Kategori Barang)', width: 24 },
  { techName: 'LGPBE', label: 'Storage Bin (Lokasi Rak)', width: 16 },
  { techName: 'ERFMG', label: 'Quantity Received (Qty Masuk)', width: 15 },
  { techName: 'ERFME', label: 'Unit of Entry (UoM)', width: 10 },
  { techName: 'CHARG', label: 'Batch / Lot Number (CHARG)', width: 16 },
  { techName: 'WEMPF', label: 'Goods Receiver (Admin / Ka. Store)', width: 24 },
  { techName: 'SGTXT', label: 'Item Text (Kondisi & Catatan)', width: 30 },
  { techName: 'ZLPB_NO', label: 'Internal LPB Number', width: 20 },
  { techName: 'ZSTATUS', label: 'Status LPB Store', width: 18 },
];

export const SAP_MATERIAL_COLUMNS: SapColumnDef[] = [
  { techName: 'MATNR', label: 'Material Code (MATNR)', width: 18 },
  { techName: 'MAKTX', label: 'Material Description (MAKTX)', width: 36 },
  { techName: 'MTART', label: 'Material Type (ERSA/HIBE)', width: 14 },
  { techName: 'MBRSH', label: 'Industry Sector (M)', width: 12 },
  { techName: 'MATKL', label: 'Primary Material Group (MATKL)', width: 24 },
  { techName: 'ZSUB_CAT', label: 'Multi-Categories (Semua Kategori)', width: 30 },
  { techName: 'WERKS', label: 'Plant (WERKS)', width: 10 },
  { techName: 'LGORT', label: 'Storage Location (LGORT)', width: 12 },
  { techName: 'LGPBE', label: 'Storage Bin / Rack Code (LGPBE)', width: 16 },
  { techName: 'MEINS', label: 'Base Unit of Measure (MEINS)', width: 12 },
  { techName: 'LABST', label: 'Unrestricted Physical Stock (LABST)', width: 16 },
  { techName: 'UMLME', label: 'Allocated Stock SIV (UMLME)', width: 16 },
  { techName: 'AVAIL_QTY', label: 'Available Net Stock', width: 16 },
  { techName: 'EISBE', label: 'Safety / Min Stock (EISBE)', width: 16 },
  { techName: 'BWART_INIT', label: 'Initial Upload Mvt Type (561)', width: 14 },
  { techName: 'GROES', label: 'Specification / Notes (GROES)', width: 32 },
];

export function formatSapDate(isoOrDateStr: string | undefined, format: SapDateFormat): string {
  if (!isoOrDateStr) {
    const now = new Date();
    return formatDateObj(now, format);
  }
  const parsed = new Date(isoOrDateStr);
  if (isNaN(parsed.getTime())) {
    const clean = isoOrDateStr.slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      if (format === 'YYYYMMDD') return `${y}${m}${d}`;
      if (format === 'DD.MM.YYYY') return `${d}.${m}.${y}`;
      return `${y}-${m}-${d}`;
    }
    return isoOrDateStr;
  }
  return formatDateObj(parsed, format);
}

function formatDateObj(d: Date, format: SapDateFormat): string {
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (format === 'YYYYMMDD') return `${year}${month}${day}`;
  if (format === 'DD.MM.YYYY') return `${day}.${month}.${year}`;
  return `${year}-${month}-${day}`;
}

export function normalizeSapUom(unit: string | undefined): string {
  const u = (unit || 'PCS').trim().toUpperCase();
  const map: Record<string, string> = {
    PCS: 'PC',
    BUAH: 'PC',
    BH: 'PC',
    UNIT: 'UN',
    SET: 'SET',
    LITER: 'L',
    LTR: 'L',
    KG: 'KG',
    GRAM: 'G',
    METER: 'M',
    MTR: 'M',
    ROLL: 'ROL',
    BOX: 'BOX',
    DUS: 'BOX',
    PACK: 'PAC',
    PAIL: 'PAL',
    DRUM: 'DRM',
    BTG: 'EA',
    BATANG: 'EA',
    LEMBAR: 'SHT',
    LBR: 'SHT',
    KALENG: 'CAN',
    BOTOL: 'BTL',
    PASANG: 'PR',
    PSG: 'PR',
  };
  return map[u] || u.slice(0, 3);
}

/**
 * Generates SAP Goods Issue (MIGO / MB1A / BAPI_GOODSMVT_CREATE GM_CODE 03, Movement Type 201) rows from SIV documents
 */
export function buildSapSivRows(
  vouchers: IssueVoucherDocument[],
  stockItems: StockItem[],
  costCenters: CostCenterEntry[],
  glAccounts: GLAccountEntry[],
  config: SapExportConfig
): (string | number)[][] {
  const stockBySku = new Map<string, StockItem>();
  stockItems.forEach((it) => {
    stockBySku.set(it.sku.toLowerCase(), it);
    stockBySku.set(it.id.toLowerCase(), it);
  });

  const ccMap = new Map<string, CostCenterEntry>();
  costCenters.forEach((c) => ccMap.set(c.code.toUpperCase(), c));

  const glMap = new Map<string, GLAccountEntry>();
  glAccounts.forEach((g) => glMap.set(g.code.toUpperCase(), g));

  const rows: (string | number)[][] = [];

  vouchers.forEach((v) => {
    if (config.onlyApprovedTransactions) {
      if (v.status !== 'HANDOVER_COMPLETED' && v.status !== 'APPROVED') return;
    } else {
      if (v.status === 'REJECTED') return;
    }

    if (config.startDate || config.endDate) {
      const d = new Date(v.requestDate || v.createdAt);
      if (!isNaN(d.getTime())) {
        if (config.startDate && d < new Date(`${config.startDate}T00:00:00`)) return;
        if (config.endDate && d > new Date(`${config.endDate}T23:59:59.999`)) return;
      }
    }

    const docDate = formatSapDate(v.requestDate || v.createdAt, config.dateFormat);
    const postDate = formatSapDate(
      v.headApprovedAt || v.handoverAt || v.approvedAt || v.requestDate || v.createdAt,
      config.dateFormat
    );

    let lineIdx = 1;
    v.items.forEach((item) => {
      if (item.isCancelled) return;
      const qty =
        v.status === 'HANDOVER_COMPLETED' || v.status === 'APPROVED'
          ? item.issuedQty ?? item.requestedQty
          : item.requestedQty;
      if (qty <= 0) return;

      const masterItem =
        (item.itemId ? stockBySku.get(item.itemId.toLowerCase()) : undefined) ||
        stockBySku.get(item.sku.toLowerCase());

      const matGroup = masterItem ? formatItemCategories(masterItem) : 'GENERAL';
      const rackBin = masterItem?.location || '-';
      const ccCode = (item.costCenter || v.costCenter || '').trim();
      const glCode = (item.glAccount || item.glAcc || v.glAccount || '').trim();

      const ccEntry = ccMap.get(ccCode.toUpperCase());
      const glEntry = glMap.get(glCode.toUpperCase());

      const ccDesc = ccEntry
        ? `${ccEntry.name}${ccEntry.description ? ` - ${ccEntry.description}` : ''}`
        : '-';
      const glDesc = glEntry
        ? `${glEntry.name}${glEntry.description ? ` - ${glEntry.description}` : ''}`
        : '-';

      const zeile = String(lineIdx++).padStart(4, '0');
      const headerTxt = `${v.purpose || v.department || 'GI Store'}`.slice(0, 25);
      const itemTxt = `${v.voucherNumber} | Pemohon: ${v.requestedBy} | ${v.purpose || ''}`.slice(
        0,
        50
      );

      rows.push([
        docDate,
        postDate,
        v.voucherNumber,
        headerTxt,
        '03', // GM_CODE 03 = Goods Issue
        '201', // Movement Type 201 = GI for Cost Center
        config.plantCode || 'AAP1',
        config.storageLocation || 'STR1',
        zeile,
        item.sku,
        item.itemName,
        matGroup,
        rackBin,
        qty,
        normalizeSapUom(item.unit),
        ccCode,
        ccDesc,
        glCode,
        glDesc,
        v.recipientName || v.requestedBy || '-',
        v.department || '-',
        itemTxt,
        v.status,
      ]);
    });
  });

  return rows;
}

/**
 * Generates SAP Goods Receipt (MIGO / BAPI_GOODSMVT_CREATE GM_CODE 01, Movement Type 101 / 501) rows from LPB documents
 */
export function buildSapLpbRows(
  lpbDocs: LPBDocument[],
  stockItems: StockItem[],
  config: SapExportConfig
): (string | number)[][] {
  const stockBySku = new Map<string, StockItem>();
  stockItems.forEach((it) => {
    stockBySku.set(it.sku.toLowerCase(), it);
    stockBySku.set(it.id.toLowerCase(), it);
  });

  const rows: (string | number)[][] = [];

  lpbDocs.forEach((doc) => {
    const effectiveStatus = doc.status || 'APPROVED';
    if (config.onlyApprovedTransactions) {
      if (effectiveStatus !== 'APPROVED') return;
    } else {
      if (effectiveStatus === 'REJECTED') return;
    }

    if (config.startDate || config.endDate) {
      const d = new Date(doc.receivedDate || doc.createdAt);
      if (!isNaN(d.getTime())) {
        if (config.startDate && d < new Date(`${config.startDate}T00:00:00`)) return;
        if (config.endDate && d > new Date(`${config.endDate}T23:59:59.999`)) return;
      }
    }

    const docDate = formatSapDate(doc.receivedDate || doc.createdAt, config.dateFormat);
    const postDate = formatSapDate(
      doc.approvedAt || doc.receivedDate || doc.createdAt,
      config.dateFormat
    );
    const hasPo = Boolean(doc.poNumber && doc.poNumber.trim() && doc.poNumber.trim() !== '-');
    const moveType = hasPo ? '101' : '501';

    doc.items.forEach((item, idx) => {
      if (item.quantity <= 0) return;

      const masterItem =
        (item.itemId ? stockBySku.get(item.itemId.toLowerCase()) : undefined) ||
        stockBySku.get(item.sku.toLowerCase());

      const matGroup = masterItem ? formatItemCategories(masterItem) : 'GENERAL';
      const rackBin = masterItem?.location || '-';
      const zeile = String(idx + 1).padStart(4, '0');
      const poItem = hasPo ? String((idx + 1) * 10).padStart(5, '0') : '';
      const headerTxt = `${doc.lpbNumber} ${doc.supplierName}`.slice(0, 25);
      const itemTxt = `${item.condition || 'GOOD'} | ${item.notes || doc.notes || doc.lpbNumber}`.slice(
        0,
        50
      );

      rows.push([
        docDate,
        postDate,
        doc.sjNumber || doc.lpbNumber,
        headerTxt,
        '01', // GM_CODE 01 = Goods Receipt
        moveType,
        hasPo ? doc.poNumber!.trim() : '',
        poItem,
        doc.supplierName || '-',
        config.plantCode || 'AAP1',
        config.storageLocation || 'STR1',
        zeile,
        item.sku,
        item.itemName,
        matGroup,
        rackBin,
        item.quantity,
        normalizeSapUom(item.unit),
        item.batchNo || '',
        doc.approvedByWarehouseHead || doc.receivedByAdmin || '-',
        itemTxt,
        doc.lpbNumber,
        effectiveStatus,
      ]);
    });
  });

  return rows;
}

/**
 * Generates SAP Material Master (MM01 / MM60) & Stock Balance (MB52 / MIGO 561) rows
 */
export function buildSapMaterialMasterRows(
  stockItems: StockItem[],
  config: SapExportConfig
): (string | number)[][] {
  return stockItems.map((item) => {
    const cats = getItemCategories(item);
    const primaryCat = cats[0] || item.category || 'GENERAL';
    const allCats = cats.join('; ');
    const available = Math.max(0, item.currentStock - item.allocatedStock);
    const isConsumable =
      primaryCat.toLowerCase().includes('oli') ||
      primaryCat.toLowerCase().includes('pelumas') ||
      primaryCat.toLowerCase().includes('kimia') ||
      primaryCat.toLowerCase().includes('umum');

    return [
      item.sku,
      item.name.slice(0, 40),
      isConsumable ? 'HIBE' : 'ERSA', // SAP Standard: ERSA = Spare Parts, HIBE = Operating Supplies
      'M', // Mechanical / Plant Engineering
      primaryCat.toUpperCase().slice(0, 18),
      allCats,
      config.plantCode || 'AAP1',
      config.storageLocation || 'STR1',
      item.location || '-',
      normalizeSapUom(item.unit),
      item.currentStock,
      item.allocatedStock,
      available,
      item.minStock,
      '561', // SAP Initial Entry of Stock Balances
      item.description || '-',
    ];
  });
}

function buildSheetHeaderRows(
  columns: SapColumnDef[],
  headerStyle: SapHeaderStyle
): string[][] {
  if (headerStyle === 'TECHNICAL_ONLY') {
    return [columns.map((c) => c.techName)];
  }
  if (headerStyle === 'FRIENDLY_ID') {
    return [columns.map((c) => `${c.techName} - ${c.label}`)];
  }
  // DUAL_HEADER: Row 1 = SAP Technical Field Name, Row 2 = Indonesian / SAP Description
  return [columns.map((c) => c.techName), columns.map((c) => c.label)];
}

function escapeCsvCell(val: string | number, delimiter: SapCsvDelimiter): string {
  const str = val === null || val === undefined ? '' : String(val);
  if (
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Triggers a browser download of a UTF-8 BOM CSV file formatted for SAP LSMW / LTMC / BAPI Import
 */
export function downloadSapCsv(
  columns: SapColumnDef[],
  dataRows: (string | number)[][],
  config: SapExportConfig,
  filenamePrefix: string
) {
  const headerRows = buildSheetHeaderRows(columns, config.headerStyle);
  const allRows = [...headerRows, ...dataRows];
  const csvLines = allRows.map((row) =>
    row.map((cell) => escapeCsvCell(cell, config.csvDelimiter)).join(config.csvDelimiter)
  );
  // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel & SAP GUI recognize encoding automatically
  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  a.download = `${filenamePrefix}_${config.plantCode || 'AAP1'}_${dateStamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Triggers a browser download of an Excel (.xlsx) file formatted for SAP Import
 */
export function downloadSapExcel(
  params: {
    vouchers: IssueVoucherDocument[];
    lpbDocs: LPBDocument[];
    stockItems: StockItem[];
    costCenters: CostCenterEntry[];
    glAccounts: GLAccountEntry[];
  },
  config: SapExportConfig,
  filenamePrefix = 'SAP_IMPORT'
) {
  const wb = XLSX.utils.book_new();

  const appendSapSheet = (
    sheetName: string,
    columns: SapColumnDef[],
    rows: (string | number)[][]
  ) => {
    const headers = buildSheetHeaderRows(columns, config.headerStyle);
    const ws = XLSX.utils.aoa_to_sheet([...headers, ...rows]);
    ws['!cols'] = columns.map((c) => ({ wch: c.width }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  };

  if (config.module === 'SIV_GI_201' || config.module === 'ALL_SAP_SHEETS') {
    const sivRows = buildSapSivRows(
      params.vouchers,
      params.stockItems,
      params.costCenters,
      params.glAccounts,
      config
    );
    appendSapSheet('SAP_GI_201_SIV', SAP_SIV_COLUMNS, sivRows);
  }

  if (config.module === 'LPB_GR_101' || config.module === 'ALL_SAP_SHEETS') {
    const lpbRows = buildSapLpbRows(params.lpbDocs, params.stockItems, config);
    appendSapSheet('SAP_GR_101_LPB', SAP_LPB_COLUMNS, lpbRows);
  }

  if (config.module === 'MATERIAL_MASTER' || config.module === 'ALL_SAP_SHEETS') {
    const matRows = buildSapMaterialMasterRows(params.stockItems, config);
    appendSapSheet('SAP_MAT_MASTER_MB52', SAP_MATERIAL_COLUMNS, matRows);
  }

  if (config.module === 'ALL_SAP_SHEETS') {
    // Also add Cost Center (KOSTL) & GL Account (SAKNR) Master Mapping Sheet
    const ccGlColumns: SapColumnDef[] = [
      { techName: 'RECORD_TYPE', label: 'Tipe Master (KOSTL / SAKNR)', width: 16 },
      { techName: 'SAP_CODE', label: 'Kode Cost Center / GL Account', width: 20 },
      { techName: 'SAP_NAME', label: 'Nama Akun / Cost Center', width: 32 },
      { techName: 'SAP_DESC', label: 'Keterangan Lengkap', width: 42 },
    ];
    const ccGlRows: (string | number)[][] = [
      ...params.costCenters.map((c) => [
        'KOSTL (Cost Center)',
        c.code,
        c.name,
        c.description || '-',
      ]),
      ...params.glAccounts.map((g) => [
        'SAKNR (G/L Account)',
        g.code,
        g.name,
        g.description || '-',
      ]),
    ];
    appendSapSheet('SAP_KOSTL_SAKNR', ccGlColumns, ccGlRows);
  }

  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  XLSX.writeFile(wb, `${filenamePrefix}_${config.plantCode || 'AAP1'}_${dateStamp}.xlsx`);
}
