// Thermal Label Designer Types and Storage Utilities for Clabel & Direct Thermal Printers

export interface LabelPageSize {
  id: string; // '50x30' | '40x30' | '60x40' | '70x50' | '80x50' | '30x20' | 'custom'
  name: string;
  widthMm: number;
  heightMm: number;
  orientation: 'landscape' | 'portrait';
}

export interface ThermalDesignSettings {
  // Paper & layout
  paddingMm: number; // 0.5 to 4mm
  borderStyle: 'none' | 'thin' | 'bold' | 'double' | 'rounded';
  contentAlign: 'left' | 'center';
  fitToPaper?: boolean; // Automatically scales content to fit inside paper dimensions without clipping
  paperPrintMode?: 'thermal_roll' | 'a4_sheet'; // Print on 1-by-1 thermal roll or fit multiple labels onto A4 paper

  // Header
  showHeader: boolean;
  headerType: 'company_name' | 'custom_text' | 'inverted_bar';
  customHeaderText: string;
  showLogo: boolean;
  headerFontSize: 'xs' | 'sm' | 'base';

  // Primary Code (SKU or Rack Code)
  showPrimaryCode?: boolean; // Toggle primary SKU / Rack code text
  titleFontSize: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  titleFontWeight: 'normal' | 'bold' | 'black';

  // Subtitle / Name (Item Name or Rack Name)
  showName: boolean;
  nameFontSize: 'xs' | 'sm' | 'base';
  nameMaxLines: 1 | 2;

  // Barcode / QR Code
  showBarcodeGraphic?: boolean; // Toggle barcode/QR graphic
  barcodeType: 'code128' | 'qrcode';
  barcodeHeight: number; // in pixels (e.g. 18 to 54)
  showBarcodeText: boolean;

  // Optional Metadata Badges (Pilihan apa saja yang ditampilkan di label)
  showLocation: boolean; // For Items: shows rack location
  showCategory: boolean; // For Items: shows category
  showStock: boolean; // For Items: shows current stock & unit
  showSafetyStock: boolean; // For Items: shows minimum safety stock (Stok Min)
  showUnit?: boolean; // For Items: shows unit badge (Pcs, Liter, Box)
  showZone: boolean; // For Racks: shows zone / area
  showDescription: boolean; // For Items & Racks: shows description / specs

  // Footer
  showFooter?: boolean; // Toggle bottom footer bar
  showDate: boolean;
  customFooterText: string;
}

export interface ThermalLabelTemplate {
  id: string;
  name: string;
  targetType: 'item' | 'rack' | 'both';
  isBuiltIn?: boolean;
  isDefault?: boolean;
  pageSize: LabelPageSize;
  design: ThermalDesignSettings;
  createdAt: string;
  updatedAt: string;
}

// Preset popular Clabel and standard thermal sticker roll sizes
export const PRESET_LABEL_SIZES: LabelPageSize[] = [
  {
    id: '50x30',
    name: '50 x 30 mm (Standar Clabel CT220B/230B)',
    widthMm: 50,
    heightMm: 30,
    orientation: 'landscape',
  },
  {
    id: '40x30',
    name: '40 x 30 mm (Label Mini Rak & Bin)',
    widthMm: 40,
    heightMm: 30,
    orientation: 'landscape',
  },
  {
    id: '60x40',
    name: '60 x 40 mm (Dus Box & Komponen Sedang)',
    widthMm: 60,
    heightMm: 40,
    orientation: 'landscape',
  },
  {
    id: '70x50',
    name: '70 x 50 mm (Label Besar Palet & Store)',
    widthMm: 70,
    heightMm: 50,
    orientation: 'landscape',
  },
  {
    id: '80x50',
    name: '80 x 50 mm (Label Ekspedisi & Logistik)',
    widthMm: 80,
    heightMm: 50,
    orientation: 'landscape',
  },
  {
    id: '30x20',
    name: '30 x 20 mm (Label Micro Elektronik/Kecil)',
    widthMm: 30,
    heightMm: 20,
    orientation: 'landscape',
  },
];

// Default built-in templates
export const BUILTIN_TEMPLATES: ThermalLabelTemplate[] = [
  {
    id: 'builtin-standard-50x30',
    name: 'Clabel Standar 50x30 (Rekomendasi Pabrik)',
    targetType: 'both',
    isBuiltIn: true,
    isDefault: true,
    pageSize: {
      id: '50x30',
      name: '50 x 30 mm (Standar Clabel CT220B/230B)',
      widthMm: 50,
      heightMm: 30,
      orientation: 'landscape',
    },
    design: {
      paddingMm: 1.5,
      borderStyle: 'thin',
      contentAlign: 'center',
      fitToPaper: true,
      paperPrintMode: 'thermal_roll',
      showHeader: true,
      headerType: 'company_name',
      customHeaderText: '',
      showLogo: true,
      headerFontSize: 'xs',
      showPrimaryCode: true,
      titleFontSize: 'lg',
      titleFontWeight: 'black',
      showName: true,
      nameFontSize: 'xs',
      nameMaxLines: 1,
      showBarcodeGraphic: true,
      barcodeType: 'code128',
      barcodeHeight: 28,
      showBarcodeText: true,
      showLocation: true,
      showCategory: true,
      showStock: false,
      showSafetyStock: true,
      showUnit: false,
      showZone: true,
      showDescription: false,
      showFooter: true,
      showDate: false,
      customFooterText: '',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-inverted-banner-50x30',
    name: 'Banner Hitam Inverted 50x30 (Kontras Tinggi)',
    targetType: 'both',
    isBuiltIn: true,
    pageSize: {
      id: '50x30',
      name: '50 x 30 mm (Standar Clabel CT220B/230B)',
      widthMm: 50,
      heightMm: 30,
      orientation: 'landscape',
    },
    design: {
      paddingMm: 1.5,
      borderStyle: 'bold',
      contentAlign: 'center',
      fitToPaper: true,
      paperPrintMode: 'thermal_roll',
      showHeader: true,
      headerType: 'inverted_bar',
      customHeaderText: 'LOGISTIK & INVENTARIS STORE',
      showLogo: false,
      headerFontSize: 'xs',
      showPrimaryCode: true,
      titleFontSize: 'xl',
      titleFontWeight: 'black',
      showName: true,
      nameFontSize: 'xs',
      nameMaxLines: 1,
      showBarcodeGraphic: true,
      barcodeType: 'code128',
      barcodeHeight: 26,
      showBarcodeText: true,
      showLocation: true,
      showCategory: false,
      showStock: false,
      showSafetyStock: false,
      showUnit: false,
      showZone: true,
      showDescription: false,
      showFooter: true,
      showDate: true,
      customFooterText: '',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-qrcode-modern-40x30',
    name: 'QR Code 2D Modern 40x30 (Scan Cepat)',
    targetType: 'both',
    isBuiltIn: true,
    pageSize: {
      id: '40x30',
      name: '40 x 30 mm (Label Mini Rak & Bin)',
      widthMm: 40,
      heightMm: 30,
      orientation: 'landscape',
    },
    design: {
      paddingMm: 1.5,
      borderStyle: 'rounded',
      contentAlign: 'left',
      fitToPaper: true,
      paperPrintMode: 'thermal_roll',
      showHeader: true,
      headerType: 'company_name',
      customHeaderText: '',
      showLogo: false,
      headerFontSize: 'xs',
      showPrimaryCode: true,
      titleFontSize: 'base',
      titleFontWeight: 'black',
      showName: true,
      nameFontSize: 'xs',
      nameMaxLines: 2,
      showBarcodeGraphic: true,
      barcodeType: 'qrcode',
      barcodeHeight: 38,
      showBarcodeText: true,
      showLocation: true,
      showCategory: true,
      showStock: false,
      showSafetyStock: false,
      showUnit: false,
      showZone: true,
      showDescription: false,
      showFooter: true,
      showDate: false,
      customFooterText: '',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-box-comprehensive-60x40',
    name: 'Label Dus Box Lengkap 60x40 (Info Komplit)',
    targetType: 'item',
    isBuiltIn: true,
    pageSize: {
      id: '60x40',
      name: '60 x 40 mm (Dus Box & Komponen Sedang)',
      widthMm: 60,
      heightMm: 40,
      orientation: 'landscape',
    },
    design: {
      paddingMm: 2,
      borderStyle: 'thin',
      contentAlign: 'center',
      fitToPaper: true,
      paperPrintMode: 'thermal_roll',
      showHeader: true,
      headerType: 'company_name',
      customHeaderText: '',
      showLogo: true,
      headerFontSize: 'sm',
      showPrimaryCode: true,
      titleFontSize: 'xl',
      titleFontWeight: 'black',
      showName: true,
      nameFontSize: 'sm',
      nameMaxLines: 2,
      showBarcodeGraphic: true,
      barcodeType: 'code128',
      barcodeHeight: 34,
      showBarcodeText: true,
      showLocation: true,
      showCategory: true,
      showStock: true,
      showSafetyStock: true,
      showUnit: true,
      showZone: true,
      showDescription: true,
      showFooter: true,
      showDate: true,
      customFooterText: 'QC PASSED & STORE RESMI',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-rack-pallet-70x50',
    name: 'Label Rak Palet Besar 70x50 (Jarak Jauh)',
    targetType: 'rack',
    isBuiltIn: true,
    pageSize: {
      id: '70x50',
      name: '70 x 50 mm (Label Besar Palet & Store)',
      widthMm: 70,
      heightMm: 50,
      orientation: 'landscape',
    },
    design: {
      paddingMm: 2.5,
      borderStyle: 'bold',
      contentAlign: 'center',
      fitToPaper: true,
      paperPrintMode: 'thermal_roll',
      showHeader: true,
      headerType: 'inverted_bar',
      customHeaderText: 'POSISI RAK PENYIMPANAN STORE',
      showLogo: true,
      headerFontSize: 'sm',
      showPrimaryCode: true,
      titleFontSize: '2xl',
      titleFontWeight: 'black',
      showName: true,
      nameFontSize: 'base',
      nameMaxLines: 1,
      showBarcodeGraphic: true,
      barcodeType: 'code128',
      barcodeHeight: 42,
      showBarcodeText: true,
      showLocation: true,
      showCategory: true,
      showStock: false,
      showSafetyStock: false,
      showUnit: false,
      showZone: true,
      showDescription: true,
      showFooter: true,
      showDate: true,
      customFooterText: 'JAGA KEBERSIHAN & KETERTIBAN RAK',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'builtin-mini-30x20',
    name: 'Label Mini Ringkas 30x20 (Komponen Kecil)',
    targetType: 'both',
    isBuiltIn: true,
    pageSize: {
      id: '30x20',
      name: '30 x 20 mm (Label Micro Elektronik/Kecil)',
      widthMm: 30,
      heightMm: 20,
      orientation: 'landscape',
    },
    design: {
      paddingMm: 1,
      borderStyle: 'none',
      contentAlign: 'center',
      fitToPaper: true,
      paperPrintMode: 'thermal_roll',
      showHeader: false,
      headerType: 'company_name',
      customHeaderText: '',
      showLogo: false,
      headerFontSize: 'xs',
      showPrimaryCode: true,
      titleFontSize: 'sm',
      titleFontWeight: 'bold',
      showName: false,
      nameFontSize: 'xs',
      nameMaxLines: 1,
      showBarcodeGraphic: true,
      barcodeType: 'code128',
      barcodeHeight: 18,
      showBarcodeText: true,
      showLocation: false,
      showCategory: false,
      showStock: false,
      showSafetyStock: false,
      showUnit: false,
      showZone: false,
      showDescription: false,
      showFooter: false,
      showDate: false,
      customFooterText: '',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const LOCAL_STORAGE_KEY = 'inventaris_thermal_templates_v1';

/**
 * Helper to compute optimal design parameters for a given paper size ("Fit to Paper")
 */
export function computeAutoFitDesignForPaper(
  widthMm: number,
  heightMm: number,
  orientation: 'landscape' | 'portrait',
  currentDesign: ThermalDesignSettings
): ThermalDesignSettings {
  const effectiveW = orientation === 'landscape' ? widthMm : heightMm;
  const effectiveH = orientation === 'landscape' ? heightMm : widthMm;

  // Count how many vertical sections are active
  const activeBadgesCount = [
    currentDesign.showLocation,
    currentDesign.showCategory,
    currentDesign.showStock,
    currentDesign.showSafetyStock,
    currentDesign.showUnit,
    currentDesign.showZone,
    currentDesign.showDescription,
  ].filter(Boolean).length;

  const hasFooter =
    currentDesign.showFooter !== false &&
    (activeBadgesCount > 0 || currentDesign.showDate || Boolean(currentDesign.customFooterText));

  if (effectiveH <= 22 || effectiveW <= 34) {
    // Micro label (e.g., 30x20mm)
    return {
      ...currentDesign,
      fitToPaper: true,
      paddingMm: 0.8,
      headerFontSize: 'xs',
      titleFontSize: 'sm',
      nameFontSize: 'xs',
      nameMaxLines: 1,
      barcodeHeight: currentDesign.showHeader ? 16 : 20,
    };
  }

  if (effectiveH <= 32 || effectiveW <= 45) {
    // Small/Standard label (e.g., 40x30mm, 50x30mm)
    const dense = currentDesign.showHeader && currentDesign.showName && hasFooter;
    return {
      ...currentDesign,
      fitToPaper: true,
      paddingMm: dense ? 1.0 : 1.5,
      headerFontSize: 'xs',
      titleFontSize: effectiveW >= 48 ? 'base' : 'sm',
      nameFontSize: 'xs',
      nameMaxLines: 1,
      barcodeHeight: dense ? 22 : 28,
    };
  }

  if (effectiveH <= 42) {
    // Medium label (e.g., 60x40mm)
    return {
      ...currentDesign,
      fitToPaper: true,
      paddingMm: 1.8,
      headerFontSize: 'xs',
      titleFontSize: 'lg',
      nameFontSize: 'xs',
      nameMaxLines: 2,
      barcodeHeight: 32,
    };
  }

  // Large label (e.g., 70x50mm, 80x50mm+)
  return {
    ...currentDesign,
    fitToPaper: true,
    paddingMm: 2.2,
    headerFontSize: 'sm',
    titleFontSize: 'xl',
    nameFontSize: 'sm',
    nameMaxLines: 2,
    barcodeHeight: 40,
  };
}

/**
 * Load all thermal templates combining built-ins with user-customized saved templates.
 */
export function getSavedThermalTemplates(): ThermalLabelTemplate[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return BUILTIN_TEMPLATES;
    }
    const customList: ThermalLabelTemplate[] = JSON.parse(raw);
    if (!Array.isArray(customList)) {
      return BUILTIN_TEMPLATES;
    }
    return [...BUILTIN_TEMPLATES, ...customList];
  } catch (err) {
    console.error('Failed to load saved thermal templates', err);
    return BUILTIN_TEMPLATES;
  }
}

/**
 * Save or update a custom thermal label template to localStorage.
 */
export function saveThermalTemplate(template: ThermalLabelTemplate): boolean {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    let customList: ThermalLabelTemplate[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(customList)) customList = [];

    const existingIdx = customList.findIndex((t) => t.id === template.id);
    const updatedTemplate = {
      ...template,
      isBuiltIn: false,
      updatedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      customList[existingIdx] = updatedTemplate;
    } else {
      customList.push(updatedTemplate);
    }

    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customList));
    return true;
  } catch (err) {
    console.error('Failed to save thermal template', err);
    return false;
  }
}

/**
 * Delete a custom template from localStorage.
 */
export function deleteThermalTemplate(templateId: string): boolean {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return true;
    let customList: ThermalLabelTemplate[] = JSON.parse(raw);
    if (!Array.isArray(customList)) return true;

    customList = customList.filter((t) => t.id !== templateId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(customList));
    return true;
  } catch (err) {
    console.error('Failed to delete thermal template', err);
    return false;
  }
}
