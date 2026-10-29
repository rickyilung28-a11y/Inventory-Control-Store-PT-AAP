import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StockItem, StorageLocation } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import {
  ThermalLabelTemplate,
  LabelPageSize,
  PRESET_LABEL_SIZES,
  BUILTIN_TEMPLATES,
  getSavedThermalTemplates,
  saveThermalTemplate,
  deleteThermalTemplate,
  computeAutoFitDesignForPaper,
} from '../utils/thermalTemplates';
import { ThermalStickerRenderer, StickerData } from './ThermalStickerRenderer';
import {
  Printer,
  X,
  Barcode,
  QrCode,
  Copy,
  Settings2,
  Bookmark,
  Plus,
  Trash2,
  RotateCcw,
  Sliders,
  Eye,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  MapPin,
  Building2,
  Tag,
  Maximize2,
  FileCheck,
  AlertCircle,
  HelpCircle,
  Save,
} from 'lucide-react';

interface ThermalLabelDesignerModalProps {
  onClose: () => void;
  items?: StockItem[];
  locations?: StorageLocation[];
  initialMode?: 'items' | 'locations';
}

export const ThermalLabelDesignerModal: React.FC<ThermalLabelDesignerModalProps> = ({
  onClose,
  items = [],
  locations = [],
  initialMode = items.length > 0 ? 'items' : 'locations',
}) => {
  const { companyProfile } = useInventory();

  // Mode: items or storage locations
  const [activeMode, setActiveMode] = useState<'items' | 'locations'>(initialMode);

  // Template registry state
  const [templates, setTemplates] = useState<ThermalLabelTemplate[]>(() => getSavedThermalTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
    const all = getSavedThermalTemplates();
    return all[0]?.id || BUILTIN_TEMPLATES[0].id;
  });

  // Current active working template state (deep copy so editing doesn't immediately mutate stored template until saved)
  const [currentTemplate, setCurrentTemplate] = useState<ThermalLabelTemplate>(() => {
    const all = getSavedThermalTemplates();
    const found = all.find((t) => t.id === selectedTemplateId) || BUILTIN_TEMPLATES[0];
    return JSON.parse(JSON.stringify(found));
  });

  // Designer panel active tab
  const [designerTab, setDesignerTab] = useState<
    'elements' | 'paper' | 'header' | 'barcode' | 'text' | 'meta'
  >('elements');

  // Preview zoom scale & navigation
  const [previewScale, setPreviewScale] = useState<number>(1.75); // 1.75x for clear preview on screen
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [copiesPerSticker, setCopiesPerSticker] = useState<number>(1);

  // Save template dialog modal
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  // Full Sheet Print Preview Before Printing state
  const [isPrintSheetPreviewOpen, setIsPrintSheetPreviewOpen] = useState(false);
  const [sheetPreviewLayout, setSheetPreviewLayout] = useState<'roll' | 'grid'>('grid');
  const [sheetPreviewZoom, setSheetPreviewZoom] = useState<number>(1.15);

  // Sync current template when user picks a different template from the dropdown
  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const found = templates.find((t) => t.id === id);
    if (found) {
      setCurrentTemplate(JSON.parse(JSON.stringify(found)));
    }
  };

  // Convert available data to StickerData array
  const stickerDataList: StickerData[] = useMemo(() => {
    if (activeMode === 'items' && items.length > 0) {
      return items.map((item) => ({ type: 'item' as const, item }));
    }
    if (activeMode === 'locations' && locations.length > 0) {
      return locations.map((location) => ({ type: 'rack' as const, location }));
    }
    // Fallback dummy item for preview if empty
    return [
      {
        type: 'item' as const,
        item: {
          id: 'preview-1',
          sku: 'BRG-BEARING-6204',
          name: 'Bearing Ball 6204-2RS Deep Groove',
          category: 'SPAREPART',
          unit: 'PCS',
          currentStock: 45,
          allocatedStock: 0,
          minStock: 10,
          location: 'Rak A-02 (Baris 3)',
          updatedAt: new Date().toISOString(),
        },
      },
    ];
  }, [activeMode, items, locations]);

  const currentPreviewData = stickerDataList[previewIndex] || stickerDataList[0];

  // Quick Paper Size Change Handler
  const handlePageSizeChange = (presetId: string) => {
    if (presetId === 'custom') {
      setCurrentTemplate((prev) => ({
        ...prev,
        pageSize: {
          ...prev.pageSize,
          id: 'custom',
          name: 'Ukuran Kustom (Manual mm)',
        },
      }));
      return;
    }

    const preset = PRESET_LABEL_SIZES.find((s) => s.id === presetId);
    if (preset) {
      setCurrentTemplate((prev) => {
        const nextOrientation = prev.pageSize.orientation || 'landscape';
        const nextDesign =
          prev.design.fitToPaper !== false
            ? computeAutoFitDesignForPaper(
                preset.widthMm,
                preset.heightMm,
                nextOrientation,
                prev.design
              )
            : prev.design;
        return {
          ...prev,
          pageSize: {
            ...preset,
            orientation: nextOrientation,
          },
          design: nextDesign,
        };
      });
    }
  };

  // Trigger manual Fit to Paper optimization
  const handleApplyFitToPaperNow = () => {
    setCurrentTemplate((prev) => ({
      ...prev,
      design: computeAutoFitDesignForPaper(
        prev.pageSize.widthMm,
        prev.pageSize.heightMm,
        prev.pageSize.orientation,
        prev.design
      ),
    }));
    showNotice(
      `Fit to Paper aktif: Ukuran barcode, font & margin disesuaikan otomatis ke kertas ${currentTemplate.pageSize.widthMm}×${currentTemplate.pageSize.heightMm}mm.`
    );
  };

  // Save current design as new custom template
  const handleSaveAsNewTemplate = () => {
    if (!newTemplateName.trim()) return;

    const newTpl: ThermalLabelTemplate = {
      ...currentTemplate,
      id: `custom-${Date.now()}`,
      name: newTemplateName.trim(),
      isBuiltIn: false,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    saveThermalTemplate(newTpl);
    const updated = getSavedThermalTemplates();
    setTemplates(updated);
    setSelectedTemplateId(newTpl.id);
    setCurrentTemplate(newTpl);
    setIsSaveModalOpen(false);
    setNewTemplateName('');
    showNotice(`Template "${newTpl.name}" berhasil disimpan!`);
  };

  // Overwrite existing custom template
  const handleUpdateCurrentTemplate = () => {
    if (currentTemplate.isBuiltIn) {
      // If built in, prompt user to save as a new custom template instead
      setNewTemplateName(`${currentTemplate.name} (Kustom Saya)`);
      setIsSaveModalOpen(true);
      return;
    }

    saveThermalTemplate(currentTemplate);
    const updated = getSavedThermalTemplates();
    setTemplates(updated);
    showNotice(`Perubahan template "${currentTemplate.name}" berhasil disimpan!`);
  };

  // Delete custom template
  const handleDeleteTemplate = () => {
    if (currentTemplate.isBuiltIn) return;
    if (window.confirm(`Hapus template kustom "${currentTemplate.name}"?`)) {
      deleteThermalTemplate(currentTemplate.id);
      const updated = getSavedThermalTemplates();
      setTemplates(updated);
      const fallback = updated[0];
      setSelectedTemplateId(fallback.id);
      setCurrentTemplate(JSON.parse(JSON.stringify(fallback)));
      showNotice(`Template berhasil dihapus.`);
    }
  };

  // Reset to default
  const handleResetToDefault = () => {
    const builtin = BUILTIN_TEMPLATES.find((b) => b.id === selectedTemplateId) || BUILTIN_TEMPLATES[0];
    setCurrentTemplate(JSON.parse(JSON.stringify(builtin)));
    showNotice(`Desain dikembalikan ke setelan standar.`);
  };

  const showNotice = (msg: string) => {
    setSaveSuccessNotice(msg);
    setTimeout(() => setSaveSuccessNotice(null), 3500);
  };

  // Handle thermal or A4 sheet printing with Fit to Paper
  const handlePrint = () => {
    const isLandscape = currentTemplate.pageSize.orientation === 'landscape';
    const widthMm = isLandscape ? currentTemplate.pageSize.widthMm : currentTemplate.pageSize.heightMm;
    const heightMm = isLandscape ? currentTemplate.pageSize.heightMm : currentTemplate.pageSize.widthMm;
    const isA4Sheet = currentTemplate.design.paperPrintMode === 'a4_sheet';

    // Inject dynamic CSS page-size rule
    const styleId = 'clabel-dynamic-print-style';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    if (isA4Sheet) {
      styleEl.innerHTML = `
        @media print {
          @page {
            size: A4 portrait !important;
            margin: 6mm !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .clabel-print-container {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 2.5mm !important;
            align-content: flex-start !important;
            justify-content: flex-start !important;
          }
          .clabel-thermal-print-page {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: ${widthMm}mm !important;
            height: ${heightMm}mm !important;
            max-height: ${heightMm}mm !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }
        }
      `;
    } else {
      styleEl.innerHTML = `
        @media print {
          @page {
            size: ${widthMm}mm ${heightMm}mm !important;
            margin: 0 !important;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .clabel-print-container {
            display: block !important;
          }
          .clabel-thermal-print-page {
            page-break-after: always !important;
            break-after: page !important;
            width: ${widthMm}mm !important;
            height: ${heightMm}mm !important;
            max-height: ${heightMm}mm !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }
        }
      `;
    }

    window.print();
  };

  const totalStickerCount = stickerDataList.length * copiesPerSticker;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* HEADER BAR */}
        <div className="no-print px-5 py-3.5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow-xs">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  Desainer Label Stiker Termal (Clabel)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
                  WYSIWYG Live Preview
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Atur ukuran kertas mm, jenis barcode/QR, format teks, kop perusahaan, dan simpan sebagai template permanen.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Quick Mode Switcher */}
            {items.length > 0 && locations.length > 0 && (
              <div className="flex items-center p-0.5 bg-slate-800 rounded-lg text-xs mr-2">
                <button
                  onClick={() => {
                    setActiveMode('items');
                    setPreviewIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    activeMode === 'items'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Barang ({items.length})
                </button>
                <button
                  onClick={() => {
                    setActiveMode('locations');
                    setPreviewIndex(0);
                  }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    activeMode === 'locations'
                      ? 'bg-amber-400 text-slate-950 shadow-xs'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Rak Lokasi ({locations.length})
                </button>
              </div>
            )}

            <button
              onClick={() => setIsPrintSheetPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-lg transition-colors shadow-xs"
              title="Lihat preview seluruh lembar stiker sebelum dicetak ke printer"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Sebelum Cetak ({totalStickerCount})</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-xs"
              title="Cetak langsung ke printer thermal Clabel"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Langsung</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Tutup Desainer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TEMPLATE MANAGEMENT TOOLBAR */}
        <div className="no-print px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-amber-600" />
              <span>Template Desain:</span>
            </span>

            {/* Template Selector Dropdown */}
            <select
              value={selectedTemplateId}
              onChange={(e) => handleSelectTemplate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-hidden focus:ring-1 focus:ring-amber-500 shadow-2xs min-w-[240px]"
            >
              <optgroup label="Template Standar Clabel">
                {templates
                  .filter((t) => t.isBuiltIn)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </optgroup>
              {templates.some((t) => !t.isBuiltIn) && (
                <optgroup label="Template Kustom Saya (Tersimpan)">
                  {templates
                    .filter((t) => !t.isBuiltIn)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        ★ {t.name}
                      </option>
                    ))}
                </optgroup>
              )}
            </select>

            {/* Action buttons */}
            <button
              onClick={() => {
                setNewTemplateName('');
                setIsSaveModalOpen(true);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-semibold rounded-lg transition-colors shadow-2xs"
              title="Simpan pengaturan desain ini sebagai template baru"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              <span>Simpan Template Baru</span>
            </button>

            {!currentTemplate.isBuiltIn && (
              <>
                <button
                  onClick={handleUpdateCurrentTemplate}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors shadow-2xs"
                  title="Perbarui template kustom ini dengan perubahan saat ini"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan</span>
                </button>

                <button
                  onClick={handleDeleteTemplate}
                  className="inline-flex items-center gap-1 px-2 py-1.5 bg-white hover:bg-red-50 border border-red-200 text-red-600 font-semibold rounded-lg transition-colors shadow-2xs"
                  title="Hapus template kustom ini"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus</span>
                </button>
              </>
            )}

            <button
              onClick={handleResetToDefault}
              className="inline-flex items-center gap-1 px-2 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 rounded-lg transition-colors shadow-2xs"
              title="Reset ke pengaturan awal template ini"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>

          {/* Copies, Fit to Paper & Quick Size indicator */}
          <div className="flex flex-wrap items-center gap-2.5">
            <label
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer transition-colors ${
                currentTemplate.design.fitToPaper !== false
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              title="Otomatis sesuaikan skala isi label agar pas 100% dengan ukuran kertas tanpa terpotong"
            >
              <input
                type="checkbox"
                checked={currentTemplate.design.fitToPaper !== false}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setCurrentTemplate((prev) => ({
                    ...prev,
                    design: checked
                      ? computeAutoFitDesignForPaper(
                          prev.pageSize.widthMm,
                          prev.pageSize.heightMm,
                          prev.pageSize.orientation,
                          { ...prev.design, fitToPaper: true }
                        )
                      : { ...prev.design, fitToPaper: false },
                  }));
                }}
                className="w-3.5 h-3.5 accent-amber-400 rounded"
              />
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Fit to Paper</span>
            </label>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Salinan:</span>
              <input
                type="number"
                min={1}
                max={50}
                value={copiesPerSticker}
                onChange={(e) => setCopiesPerSticker(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 px-2 py-1 bg-white border border-slate-300 rounded text-center text-xs font-bold text-slate-900"
              />
              <span className="text-slate-500">per label</span>
            </div>

            <div className="hidden sm:inline-block px-2 py-0.5 bg-amber-100 text-amber-900 font-mono font-bold rounded text-[11px]">
              {currentTemplate.pageSize.widthMm} × {currentTemplate.pageSize.heightMm} mm
            </div>
          </div>
        </div>

        {/* NOTIFICATION BANNER */}
        {saveSuccessNotice && (
          <div className="no-print px-5 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{saveSuccessNotice}</span>
            </div>
            <button
              onClick={() => setSaveSuccessNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* MAIN BODY: 2-COLUMN LAYOUT (Designer Controls Left, Live WYSIWYG Preview Right) */}
        <div className="no-print flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-[460px]">
          
          {/* LEFT COLUMN: DESIGNER CONTROLS & SETTINGS (5 cols) */}
          <div className="lg:col-span-5 border-r border-slate-200 flex flex-col bg-slate-50 overflow-y-auto">
            
            {/* Tabs for Designer Categories */}
            <div className="flex border-b border-slate-200 bg-white sticky top-0 z-10 text-xs font-semibold overflow-x-auto">
              <button
                onClick={() => setDesignerTab('elements')}
                className={`px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
                  designerTab === 'elements'
                    ? 'border-amber-500 text-amber-900 bg-amber-50/50 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Desain &amp; Isi Label
              </button>
              <button
                onClick={() => setDesignerTab('paper')}
                className={`px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
                  designerTab === 'paper'
                    ? 'border-amber-500 text-amber-900 bg-amber-50/50 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Kertas &amp; Fit Paper
              </button>
              <button
                onClick={() => setDesignerTab('header')}
                className={`px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
                  designerTab === 'header'
                    ? 'border-amber-500 text-amber-900 bg-amber-50/50 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                3. Kop
              </button>
              <button
                onClick={() => setDesignerTab('barcode')}
                className={`px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
                  designerTab === 'barcode'
                    ? 'border-amber-500 text-amber-900 bg-amber-50/50 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                4. Barcode/QR
              </button>
              <button
                onClick={() => setDesignerTab('text')}
                className={`px-3 py-2.5 border-b-2 whitespace-nowrap transition-colors ${
                  designerTab === 'text'
                    ? 'border-amber-500 text-amber-900 bg-amber-50/50 font-bold'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                5. Font Teks
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="p-4 sm:p-5 space-y-5 text-xs text-slate-700 flex-1">
              
              {/* TAB 1: DESAIN LABEL (PILIHAN APA SAJA YANG DITAMPILKAN DI LABEL) */}
              {designerTab === 'elements' && (
                <div className="space-y-4">
                  {/* Preset Cepat Isi Label */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="font-bold text-slate-900 flex items-center justify-between">
                      <span>Preset Cepat Tampilan Isi Label:</span>
                      <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        1-Klik Pilih Elemen
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentTemplate((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              showHeader: true,
                              showLogo: true,
                              showPrimaryCode: true,
                              showName: true,
                              showBarcodeGraphic: true,
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
                            },
                          }))
                        }
                        className="p-2 rounded-lg border border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 text-left transition-all"
                      >
                        <div className="font-bold text-slate-900">Semua Informasi Lengkap</div>
                        <div className="text-[10px] text-slate-500">
                          Kop + Material Code + Nama + Barcode + Rak + Stok + Min + Tanggal
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setCurrentTemplate((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              showHeader: true,
                              showLogo: true,
                              showPrimaryCode: true,
                              showName: true,
                              showBarcodeGraphic: true,
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
                            },
                          }))
                        }
                        className="p-2 rounded-lg border border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 text-left transition-all"
                      >
                        <div className="font-bold text-slate-900">Standar Store &amp; Rak</div>
                        <div className="text-[10px] text-slate-500">
                          Kop + Material Code + Nama + Barcode + Lokasi Rak + Stok Min
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setCurrentTemplate((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              showHeader: false,
                              showLogo: false,
                              showPrimaryCode: true,
                              showName: true,
                              showBarcodeGraphic: true,
                              showBarcodeText: true,
                              showLocation: true,
                              showCategory: false,
                              showStock: false,
                              showSafetyStock: false,
                              showUnit: false,
                              showZone: false,
                              showDescription: false,
                              showFooter: true,
                              showDate: false,
                            },
                          }))
                        }
                        className="p-2 rounded-lg border border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 text-left transition-all"
                      >
                        <div className="font-bold text-slate-900">Ringkas (Barcode + Nama + Rak)</div>
                        <div className="text-[10px] text-slate-500">
                          Tanpa Kop, fokus ke Barcode, Material Code, Nama &amp; Rak
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setCurrentTemplate((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              showHeader: false,
                              showLogo: false,
                              showPrimaryCode: true,
                              showName: false,
                              showBarcodeGraphic: true,
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
                            },
                          }))
                        }
                        className="p-2 rounded-lg border border-slate-200 hover:border-amber-500 hover:bg-amber-50/40 text-left transition-all"
                      >
                        <div className="font-bold text-slate-900">Minimalis (Hanya Barcode &amp; Material Code)</div>
                        <div className="text-[10px] text-slate-500">
                          Khusus komponen kecil / scan cepat
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Checklist Lengkap Pilihan Apa Saja yang Ditampilkan di Label */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="font-bold text-slate-900">
                      Centang Elemen yang Ingin Ditampilkan di Label:
                    </div>

                    <div className="space-y-1.5">
                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            1. Kop / Header Nama Perusahaan
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Menampilkan nama perusahaan atau judul banner di bagian atas label
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showHeader}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showHeader: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            2. Logo / Inisial Perusahaan di Kop
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Menampilkan logo hitam-putih di sebelah kiri kop label
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showLogo}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showLogo: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            3. Kode Utama (Material Code Barang / Kode Rak)
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Judul kode utama dengan huruf tebal di atas barcode
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showPrimaryCode !== false}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showPrimaryCode: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            4. Nama Barang / Nama Lokasi Rak
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Deskripsi nama lengkap barang atau nama rak penyimpanan
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showName}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showName: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            5. Grafik Garis Barcode 1D / Matriks QR Code
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Simbol garis Code-128 atau QR Code untuk dipindai scanner
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showBarcodeGraphic !== false}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showBarcodeGraphic: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            6. Teks Kode di Bawah Garis Barcode
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Teks kode human-readable tepat di bawah grafik garis barcode
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showBarcodeText}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showBarcodeText: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            7. Lokasi Rak Penyimpanan (Contoh: Rak: A-01)
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Badge kode rak tempat barang disimpan di Store
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showLocation}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showLocation: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            8. Kategori / Sub-Master Barang
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Badge kategori barang (Sparepart Mesin, Elektrikal, dsb)
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showCategory}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showCategory: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            9. Batas Stok Minimum / Safety Stock (Min: X Unit)
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Menampilkan informasi batas stok minimum barang pada stiker
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showSafetyStock}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showSafetyStock: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            10. Jumlah Saldo Stok Fisik Saat Ini
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Menampilkan angka saldo stok aktual saat label dicetak
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showStock}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showStock: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            11. Satuan Barang (UOM: Pcs / Box / Liter)
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Menampilkan badge satuan hitung barang
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(currentTemplate.design.showUnit)}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showUnit: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            12. Zona / Area Wilayah Store (Untuk Label Rak)
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Menampilkan nama zona penyimpanan pada stiker rak
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showZone}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showZone: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            13. Keterangan / Spesifikasi Tambahan
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Menampilkan catatan spesifikasi barang atau posisi rak
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showDescription}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showDescription: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            14. Tanggal Cetak Label
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Menampilkan tanggal cetak stiker (DD/MM/YYYY)
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showDate}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showDate: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-200/70">
                        <div>
                          <div className="font-semibold text-slate-900">
                            15. Baris Footer Bawah &amp; Teks Kustom
                          </div>
                          <div className="text-[10.5px] text-slate-500">
                            Menampilkan baris informasi tambahan &amp; catatan kaki di bagian bawah
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showFooter !== false}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showFooter: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded shrink-0"
                        />
                      </label>
                    </div>

                    {currentTemplate.design.showFooter !== false && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[11px] text-slate-500 block mb-1">
                          Teks Catatan Kaki Kustom (Pojok Kanan Bawah):
                        </span>
                        <input
                          type="text"
                          value={currentTemplate.design.customFooterText}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: {
                                ...prev.design,
                                customFooterText: e.target.value,
                              },
                            }))
                          }
                          placeholder="Contoh: STORE RESMI / QC PASSED"
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: UKURAN KERTAS & FIT TO PAPER */}
              {designerTab === 'paper' && (
                <div className="space-y-4">
                  {/* FIT TO PAPER PANEL */}
                  <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-300 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                          <Maximize2 className="w-4 h-4 text-emerald-600" />
                          <span>Fitur Fit to Paper (Otomatis Sesuaikan Kertas)</span>
                        </div>
                        <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                          Menyesuaikan ukuran barcode, tinggi huruf, dan tata letak secara otomatis agar pas 100% di dalam batas kertas stiker tanpa terpotong.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={currentTemplate.design.fitToPaper !== false}
                        onChange={(e) =>
                          setCurrentTemplate((prev) => ({
                            ...prev,
                            design: { ...prev.design, fitToPaper: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 accent-emerald-600 rounded mt-0.5 shrink-0"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleApplyFitToPaperNow}
                        className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Optimalkan Semua Elemen agar Fit to Paper ({currentTemplate.pageSize.widthMm}×{currentTemplate.pageSize.heightMm}mm)</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-emerald-200/80">
                      <span className="text-[11px] font-bold text-emerald-950 block mb-1.5">
                        Mode Kertas Printer Saat Cetak:
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, paperPrintMode: 'thermal_roll' },
                            }))
                          }
                          className={`p-2 rounded-lg border text-left transition-all ${
                            (currentTemplate.design.paperPrintMode || 'thermal_roll') ===
                            'thermal_roll'
                              ? 'bg-slate-900 text-white border-slate-900 font-bold'
                              : 'bg-white text-slate-700 border-emerald-200 hover:bg-emerald-100/50'
                          }`}
                        >
                          <div className="text-xs font-bold">Roll Stiker Thermal (1:1)</div>
                          <div className="text-[10px] opacity-80">
                            Fit 1 label per halaman roll ({currentTemplate.pageSize.widthMm}×{currentTemplate.pageSize.heightMm}mm)
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, paperPrintMode: 'a4_sheet' },
                            }))
                          }
                          className={`p-2 rounded-lg border text-left transition-all ${
                            currentTemplate.design.paperPrintMode === 'a4_sheet'
                              ? 'bg-slate-900 text-white border-slate-900 font-bold'
                              : 'bg-white text-slate-700 border-emerald-200 hover:bg-emerald-100/50'
                          }`}
                        >
                          <div className="text-xs font-bold">Lembar Kertas A4 (Multi-Grid)</div>
                          <div className="text-[10px] opacity-80">
                            Susun otomatis banyak label pas di kertas A4
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-900 mb-1.5">
                      Pilihan Ukuran Stiker Roll (Preset Clabel & Thermal)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PRESET_LABEL_SIZES.map((size) => (
                        <button
                          key={size.id}
                          onClick={() => handlePageSizeChange(size.id)}
                          className={`p-2.5 text-left rounded-xl border transition-all ${
                            currentTemplate.pageSize.id === size.id
                              ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-400/30'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="font-bold text-slate-900 text-xs">
                            {size.widthMm} × {size.heightMm} mm
                          </div>
                          <div className="text-[10.5px] text-slate-500 truncate mt-0.5">
                            {size.name.split('(')[1]?.replace(')', '') || size.name}
                          </div>
                        </button>
                      ))}

                      {/* Custom Size button */}
                      <button
                        onClick={() => handlePageSizeChange('custom')}
                        className={`p-2.5 text-left rounded-xl border transition-all ${
                          currentTemplate.pageSize.id === 'custom'
                            ? 'border-amber-500 bg-amber-50/60 ring-2 ring-amber-400/30'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="font-bold text-slate-900 text-xs">
                          Ukuran Kustom (Manual)
                        </div>
                        <div className="text-[10.5px] text-slate-500 truncate mt-0.5">
                          Tentukan mm bebas
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Manual Width & Height Inputs if custom or want slight adjust */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="font-bold text-slate-900">Dimensi Kertas (Milimeter):</div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">Lebar (Width mm):</span>
                        <input
                          type="number"
                          min={20}
                          max={150}
                          value={currentTemplate.pageSize.widthMm}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              pageSize: {
                                ...prev.pageSize,
                                id: 'custom',
                                widthMm: Math.max(15, parseInt(e.target.value) || 20),
                              },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                        />
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block mb-1">Tinggi (Height mm):</span>
                        <input
                          type="number"
                          min={15}
                          max={200}
                          value={currentTemplate.pageSize.heightMm}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              pageSize: {
                                ...prev.pageSize,
                                id: 'custom',
                                heightMm: Math.max(15, parseInt(e.target.value) || 20),
                              },
                            }))
                          }
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                        />
                      </div>
                    </div>

                    {/* Orientation */}
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">Orientasi Stiker:</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              pageSize: { ...prev.pageSize, orientation: 'landscape' },
                            }))
                          }
                          className={`py-1.5 px-3 rounded-lg border font-semibold text-center transition-colors ${
                            currentTemplate.pageSize.orientation === 'landscape'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-700 border-slate-300'
                          }`}
                        >
                          Landscape (Melebar)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              pageSize: { ...prev.pageSize, orientation: 'portrait' },
                            }))
                          }
                          className={`py-1.5 px-3 rounded-lg border font-semibold text-center transition-colors ${
                            currentTemplate.pageSize.orientation === 'portrait'
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50 text-slate-700 border-slate-300'
                          }`}
                        >
                          Portrait (Meninggi)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Border Style & Margin */}
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="font-bold text-slate-900">Garis Bingkai Stiker:</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          { id: 'none', label: 'Polos (Tanpa Garis)' },
                          { id: 'thin', label: 'Garis Tipis (1px)' },
                          { id: 'bold', label: 'Garis Tebal (2px)' },
                          { id: 'double', label: 'Garis Ganda (Double)' },
                          { id: 'rounded', label: 'Sudut Membulat' },
                        ] as const
                      ).map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, borderStyle: b.id },
                            }))
                          }
                          className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-colors ${
                            currentTemplate.design.borderStyle === b.id
                              ? 'bg-amber-50 border-amber-500 text-amber-900 font-bold'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>

                    {/* Padding Margin slider */}
                    <div className="pt-2">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Batas Tepi Dalam (Padding):</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {currentTemplate.design.paddingMm} mm
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={4}
                        step={0.5}
                        value={currentTemplate.design.paddingMm}
                        onChange={(e) =>
                          setCurrentTemplate((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              paddingMm: parseFloat(e.target.value) || 1.5,
                            },
                          }))
                        }
                        className="w-full accent-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: KOP & HEADER */}
              {designerTab === 'header' && (
                <div className="space-y-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Tampilkan Kop / Header Stiker</span>
                      <input
                        type="checkbox"
                        checked={currentTemplate.design.showHeader}
                        onChange={(e) =>
                          setCurrentTemplate((prev) => ({
                            ...prev,
                            design: { ...prev.design, showHeader: e.target.checked },
                          }))
                        }
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                    </div>

                    {currentTemplate.design.showHeader && (
                      <div className="space-y-3 pt-2 border-t border-slate-100">
                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">Model Header:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentTemplate((prev) => ({
                                  ...prev,
                                  design: { ...prev.design, headerType: 'company_name' },
                                }))
                              }
                              className={`p-2 rounded-lg border text-center font-semibold transition-colors ${
                                currentTemplate.design.headerType === 'company_name'
                                  ? 'bg-amber-50 border-amber-500 text-amber-900'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              Nama Perusahaan
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentTemplate((prev) => ({
                                  ...prev,
                                  design: { ...prev.design, headerType: 'inverted_bar' },
                                }))
                              }
                              className={`p-2 rounded-lg border text-center font-semibold transition-colors ${
                                currentTemplate.design.headerType === 'inverted_bar'
                                  ? 'bg-slate-900 border-slate-900 text-white'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              Banner Hitam Inverted
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setCurrentTemplate((prev) => ({
                                  ...prev,
                                  design: { ...prev.design, headerType: 'custom_text' },
                                }))
                              }
                              className={`p-2 rounded-lg border text-center font-semibold transition-colors ${
                                currentTemplate.design.headerType === 'custom_text'
                                  ? 'bg-amber-50 border-amber-500 text-amber-900'
                                  : 'bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              Teks Khusus / Bebas
                            </button>
                          </div>
                        </div>

                        {/* Custom Header Text input */}
                        {(currentTemplate.design.headerType === 'custom_text' ||
                          currentTemplate.design.headerType === 'inverted_bar') && (
                          <div>
                            <span className="text-[11px] text-slate-500 block mb-1">
                              Teks Judul Kop / Banner:
                            </span>
                            <input
                              type="text"
                              value={currentTemplate.design.customHeaderText}
                              onChange={(e) =>
                                setCurrentTemplate((prev) => ({
                                  ...prev,
                                  design: {
                                    ...prev.design,
                                    customHeaderText: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Misal: LOGISTIK & SPAREPART GUDANG"
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
                            />
                          </div>
                        )}

                        {/* Logo toggle */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-slate-700 font-medium">Tampilkan Mini Logo / Inisial Perusahaan</span>
                          <input
                            type="checkbox"
                            checked={currentTemplate.design.showLogo}
                            onChange={(e) =>
                              setCurrentTemplate((prev) => ({
                                ...prev,
                                design: { ...prev.design, showLogo: e.target.checked },
                              }))
                            }
                            className="w-4 h-4 accent-amber-500 rounded"
                          />
                        </div>

                        {/* Header Font Size */}
                        <div>
                          <span className="text-[11px] text-slate-500 block mb-1">Ukuran Font Header:</span>
                          <div className="grid grid-cols-3 gap-2">
                            {(['xs', 'sm', 'base'] as const).map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() =>
                                  setCurrentTemplate((prev) => ({
                                    ...prev,
                                    design: { ...prev.design, headerFontSize: s },
                                  }))
                                }
                                className={`py-1 px-2 rounded-md border text-center font-bold uppercase transition-colors ${
                                  currentTemplate.design.headerFontSize === s
                                    ? 'bg-amber-100 border-amber-500 text-amber-900'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: BARCODE & QR */}
              {designerTab === 'barcode' && (
                <div className="space-y-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="font-bold text-slate-900">Tipe Simbologi Barcode:</div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentTemplate((prev) => ({
                            ...prev,
                            design: { ...prev.design, barcodeType: 'code128' },
                          }))
                        }
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                          currentTemplate.design.barcodeType === 'code128'
                            ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-400/30'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <Barcode className="w-6 h-6 text-slate-900" />
                        <div className="font-bold text-slate-900 text-xs">1D Code 128 (Garis)</div>
                        <div className="text-[10px] text-slate-500 text-center">
                          Kompatibel scanner laser & CCD standar
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setCurrentTemplate((prev) => ({
                            ...prev,
                            design: { ...prev.design, barcodeType: 'qrcode' },
                          }))
                        }
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                          currentTemplate.design.barcodeType === 'qrcode'
                            ? 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-400/30'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <QrCode className="w-6 h-6 text-slate-900" />
                        <div className="font-bold text-slate-900 text-xs">2D QR Code (Matriks)</div>
                        <div className="text-[10px] text-slate-500 text-center">
                          Scan instan kamera HP & scanner 2D
                        </div>
                      </button>
                    </div>

                    {/* Barcode Height */}
                    <div className="pt-2">
                      <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                        <span>Tinggi / Ukuran Barcode:</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {currentTemplate.design.barcodeHeight} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={18}
                        max={54}
                        step={2}
                        value={currentTemplate.design.barcodeHeight}
                        onChange={(e) =>
                          setCurrentTemplate((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              barcodeHeight: parseInt(e.target.value) || 30,
                            },
                          }))
                        }
                        className="w-full accent-amber-500"
                      />
                    </div>

                    {/* Show Barcode text under */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-slate-700 font-medium">
                        Tampilkan Teks Kode Human-Readable di Bawah Barcode
                      </span>
                      <input
                        type="checkbox"
                        checked={currentTemplate.design.showBarcodeText}
                        onChange={(e) =>
                          setCurrentTemplate((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              showBarcodeText: e.target.checked,
                            },
                          }))
                        }
                        className="w-4 h-4 accent-amber-500 rounded"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: TEKS & JUDUL */}
              {designerTab === 'text' && (
                <div className="space-y-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="font-bold text-slate-900">Kode Utama (Material Code Barang / Kode Rak):</div>
                    
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">Ukuran Font Kode:</span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {(['sm', 'base', 'lg', 'xl', '2xl'] as const).map((sz) => (
                          <button
                            key={sz}
                            type="button"
                            onClick={() =>
                              setCurrentTemplate((prev) => ({
                                ...prev,
                                design: { ...prev.design, titleFontSize: sz },
                              }))
                            }
                            className={`py-1 text-center rounded border font-bold text-xs uppercase ${
                              currentTemplate.design.titleFontSize === sz
                                ? 'bg-amber-100 border-amber-500 text-amber-900'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            {sz}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Perataan Konten */}
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">Perataan Teks:</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, contentAlign: 'center' },
                            }))
                          }
                          className={`py-1.5 px-3 rounded-lg border font-semibold text-center transition-colors ${
                            currentTemplate.design.contentAlign === 'center'
                              ? 'bg-amber-50 border-amber-500 text-amber-900'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          Rata Tengah (Center)
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, contentAlign: 'left' },
                            }))
                          }
                          className={`py-1.5 px-3 rounded-lg border font-semibold text-center transition-colors ${
                            currentTemplate.design.contentAlign === 'left'
                              ? 'bg-amber-50 border-amber-500 text-amber-900'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          Rata Kiri (Left)
                        </button>
                      </div>
                    </div>

                    {/* Subtitle Name */}
                    <div className="pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-bold text-slate-900">
                          Tampilkan Nama Barang / Nama Rak
                        </span>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showName}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showName: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded"
                        />
                      </div>

                      {currentTemplate.design.showName && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-[10px] text-slate-500 block">Ukuran Font:</span>
                              <div className="flex gap-1 mt-0.5">
                                {(['xs', 'sm', 'base'] as const).map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() =>
                                      setCurrentTemplate((prev) => ({
                                        ...prev,
                                        design: { ...prev.design, nameFontSize: s },
                                      }))
                                    }
                                    className={`flex-1 py-1 text-center rounded border font-semibold text-xs ${
                                      currentTemplate.design.nameFontSize === s
                                        ? 'bg-amber-100 border-amber-500 text-amber-900'
                                        : 'bg-slate-50 border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] text-slate-500 block">Batas Baris:</span>
                              <div className="flex gap-1 mt-0.5">
                                {([1, 2] as const).map((l) => (
                                  <button
                                    key={l}
                                    type="button"
                                    onClick={() =>
                                      setCurrentTemplate((prev) => ({
                                        ...prev,
                                        design: { ...prev.design, nameMaxLines: l },
                                      }))
                                    }
                                    className={`flex-1 py-1 text-center rounded border font-semibold text-xs ${
                                      currentTemplate.design.nameMaxLines === l
                                        ? 'bg-amber-100 border-amber-500 text-amber-900'
                                        : 'bg-slate-50 border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {l} Baris
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: INFORMASI TAMBAHAN / BADGE */}
              {designerTab === 'meta' && (
                <div className="space-y-4">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="font-bold text-slate-900">Elemen Info Tambahan:</div>
                    
                    <div className="space-y-2.5">
                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer">
                        <span className="font-medium text-slate-800">
                          Posisi Rak Penyimpanan (Item)
                        </span>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showLocation}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showLocation: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer">
                        <span className="font-medium text-slate-800">
                          Kategori Barang (Sparepart, Oli, dsb)
                        </span>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showCategory}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showCategory: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer">
                        <span className="font-medium text-slate-800">
                          Zona / Area Gudang (Untuk Label Rak)
                        </span>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showZone}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showZone: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer">
                        <span className="font-medium text-slate-800">
                          Jumlah Stok Fisik &amp; Satuan
                        </span>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showStock}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showStock: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded"
                        />
                      </label>

                      <label className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer">
                        <span className="font-medium text-slate-800">
                          Tanggal Cetak Label
                        </span>
                        <input
                          type="checkbox"
                          checked={currentTemplate.design.showDate}
                          onChange={(e) =>
                            setCurrentTemplate((prev) => ({
                              ...prev,
                              design: { ...prev.design, showDate: e.target.checked },
                            }))
                          }
                          className="w-4 h-4 accent-amber-500 rounded"
                        />
                      </label>
                    </div>

                    {/* Custom Footer text */}
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500 block mb-1">
                        Catatan Kaki Kustom (Pojok Kanan Bawah):
                      </span>
                      <input
                        type="text"
                        value={currentTemplate.design.customFooterText}
                        onChange={(e) =>
                          setCurrentTemplate((prev) => ({
                            ...prev,
                            design: {
                              ...prev.design,
                              customFooterText: e.target.value,
                            },
                          }))
                        }
                        placeholder="Misal: QC PASSED / ORIGINAL"
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: INTERACTIVE LIVE WYSIWYG PREVIEW (7 cols) */}
          <div className="lg:col-span-7 bg-slate-200/80 p-4 sm:p-6 flex flex-col justify-between overflow-y-auto">
            
            {/* Top Toolbar over Canvas */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 bg-white/90 backdrop-blur-xs p-2.5 rounded-xl border border-slate-300 shadow-2xs text-xs">
              {/* Pagination if multiple items */}
              <div className="flex items-center gap-2">
                <button
                  disabled={previewIndex <= 0}
                  onClick={() => setPreviewIndex((p) => Math.max(0, p - 1))}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                  title="Item Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-slate-800">
                  Label {previewIndex + 1} dari {stickerDataList.length}
                </span>
                <button
                  disabled={previewIndex >= stickerDataList.length - 1}
                  onClick={() =>
                    setPreviewIndex((p) => Math.min(stickerDataList.length - 1, p + 1))
                  }
                  className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
                  title="Item Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Zoom control */}
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Zoom Layar:</span>
                <div className="flex items-center gap-1">
                  {[1, 1.5, 2].map((sc) => (
                    <button
                      key={sc}
                      onClick={() => setPreviewScale(sc)}
                      className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                        previewScale === sc
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {sc * 100}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* STICKER CANVAS VIEWPORT WITH PHYSICAL MM RULER FRAME */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-[300px]">
              
              {/* Millimeter Dimensions Badge */}
              <div className="mb-2 text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-white font-mono text-xs font-bold shadow-xs">
                  <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Ukuran Fisik: {currentTemplate.pageSize.widthMm} mm ×{' '}
                    {currentTemplate.pageSize.heightMm} mm (
                    {currentTemplate.pageSize.orientation === 'landscape'
                      ? 'Landscape'
                      : 'Portrait'}
                    )
                  </span>
                </span>
              </div>

              {/* Physical sticker wrapper with drop shadow and high contrast thermal white backdrop */}
              <div
                className="bg-white p-2 rounded-xl shadow-2xl border-4 border-slate-400 relative transition-all duration-150 inline-block"
                style={{
                  boxShadow: '0 20px 40px -15px rgba(0,0,0,0.3)',
                }}
              >
                {/* Sticker rendering */}
                <ThermalStickerRenderer
                  template={currentTemplate}
                  data={currentPreviewData}
                  companyName={companyProfile.companyName || 'PT. ABADI AGROSINDO PERSADA'}
                  logoUrl={companyProfile.logoUrl}
                  isPrint={false}
                  scale={previewScale}
                />
              </div>

              {/* Subtitle helper */}
              <p className="text-[11px] text-slate-500 mt-3 text-center max-w-md">
                Tampilan di atas adalah simulasi hasil cetak fisik thermal stiker 203/300 DPI dengan kontras hitam-putih tajam pada printer Clabel.
              </p>
            </div>

            {/* Bottom Quick Info & Print Action */}
            <div className="bg-white p-3 rounded-xl border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mt-3">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-700">
                  Total Cetak: <strong>{stickerDataList.length}</strong> target ×{' '}
                  <strong>{copiesPerSticker}</strong> salinan ={' '}
                  <strong className="text-amber-600 font-mono text-sm">
                    {totalStickerCount} stiker
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintSheetPreviewOpen(true)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 font-bold rounded-xl shadow-xs transition-colors shrink-0"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview Sebelum Cetak ({totalStickerCount} Label)</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl shadow-xs transition-colors shrink-0"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Thermal Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PRINT OUTPUT SECTION (ONLY VISIBLE DURING window.print()) */}
        <div className="hidden print:block bg-white text-black clabel-print-container">
          {stickerDataList.map((stkData, sIdx) =>
            Array.from({ length: copiesPerSticker }).map((_, cIdx) => (
              <div
                key={`print-stk-${sIdx}-${cIdx}`}
                className="clabel-thermal-print-page"
              >
                <ThermalStickerRenderer
                  template={currentTemplate}
                  data={stkData}
                  companyName={companyProfile.companyName || 'PT. ABADI AGROSINDO PERSADA'}
                  logoUrl={companyProfile.logoUrl}
                  isPrint={true}
                  scale={1}
                />
              </div>
            ))
          )}
        </div>

      </div>

      {/* MODAL SAVE TEMPLATE DIALOG */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-2xs p-4">
          <div className="bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 w-full max-w-md animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Simpan Template Desain Thermal
                </h3>
              </div>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Beri nama template ini agar dapat Anda gunakan kembali kapan saja saat mencetak stiker barang maupun rak penyimpanan.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Template:
                </label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Misal: Stiker Dus Box Sparepart 60x40"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  autoFocus
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                <div>
                  <strong>Ukuran:</strong> {currentTemplate.pageSize.widthMm} ×{' '}
                  {currentTemplate.pageSize.heightMm} mm (
                  {currentTemplate.pageSize.orientation})
                </div>
                <div>
                  <strong>Format:</strong> Barcode{' '}
                  {currentTemplate.design.barcodeType === 'qrcode'
                    ? '2D QR Code'
                    : '1D Code 128'}{' '}
                  | Bingkai: {currentTemplate.design.borderStyle}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveAsNewTemplate}
                disabled={!newTemplateName.trim()}
                className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs"
              >
                Simpan Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW SEBELUM CETAK BARCODE (FULL ROLL / SHEET PREVIEW) */}
      {isPrintSheetPreviewOpen && (
        <div className="no-print fixed inset-0 z-70 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden">
            {/* Header Preview Sebelum Cetak */}
            <div className="px-5 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold">
                      Preview Sebelum Cetak Barcode ({totalStickerCount} Stiker)
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-mono text-[10px] font-extrabold">
                      {currentTemplate.pageSize.widthMm} × {currentTemplate.pageSize.heightMm} mm
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Periksa seluruh tampilan stiker barcode ({stickerDataList.length} item ×{' '}
                    {copiesPerSticker} salinan) sebelum dikirim ke printer thermal
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex p-0.5 bg-slate-800 rounded-lg border border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setSheetPreviewLayout('roll')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                      sheetPreviewLayout === 'roll'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Simulasi Roll Termal (1 Kolom)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSheetPreviewLayout('grid')}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                      sheetPreviewLayout === 'grid'
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Tampilan Grid Lembar
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 text-xs">
                  {[0.9, 1.15, 1.4].map((zm) => (
                    <button
                      key={zm}
                      type="button"
                      onClick={() => setSheetPreviewZoom(zm)}
                      className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
                        sheetPreviewZoom === zm
                          ? 'bg-emerald-400 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {Math.round(zm * 100)}%
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setIsPrintSheetPreviewOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Summary Strip */}
            <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-3 text-slate-700">
                <span>
                  Template: <strong>{currentTemplate.name}</strong>
                </span>
                <span>•</span>
                <span>
                  Tipe Kode:{' '}
                  <strong>
                    {currentTemplate.design.barcodeType === 'qrcode'
                      ? '2D QR Code'
                      : '1D Code 128 Barcode'}
                  </strong>
                </span>
                <span>•</span>
                <span>
                  Total Cetak: <strong>{totalStickerCount} Stiker</strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">Ubah Jumlah Salinan:</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={copiesPerSticker}
                  onChange={(e) =>
                    setCopiesPerSticker(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-center font-mono font-bold text-slate-900"
                />
              </div>
            </div>

            {/* Scrollable All-Stickers Preview Canvas */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-200/90">
              <div
                className={
                  sheetPreviewLayout === 'roll'
                    ? 'flex flex-col items-center gap-5 max-w-md mx-auto py-2 px-6 bg-slate-300/70 rounded-2xl border-x-8 border-dashed border-slate-400'
                    : 'flex flex-wrap items-start justify-center gap-5'
                }
              >
                {stickerDataList.flatMap((stkData, sIdx) =>
                  Array.from({ length: copiesPerSticker }).map((_, cIdx) => {
                    const stickerNumber = sIdx * copiesPerSticker + cIdx + 1;
                    const codeLabel =
                      stkData.type === 'item' ? stkData.item.sku : stkData.location.code;
                    return (
                      <div
                        key={`sheet-prev-${sIdx}-${cIdx}`}
                        className="flex flex-col items-center"
                      >
                        <div className="mb-1.5 flex items-center gap-2 text-[10.5px] font-mono font-bold text-slate-700 bg-white/90 px-2.5 py-0.5 rounded-full border border-slate-300 shadow-2xs">
                          <span>Stiker #{stickerNumber}</span>
                          <span>•</span>
                          <span className="text-slate-900">{codeLabel}</span>
                          {copiesPerSticker > 1 && (
                            <span className="text-amber-700">
                              (Copy {cIdx + 1}/{copiesPerSticker})
                            </span>
                          )}
                        </div>
                        <div className="bg-white p-1.5 rounded-xl shadow-lg border-2 border-slate-400">
                          <ThermalStickerRenderer
                            template={currentTemplate}
                            data={stkData}
                            companyName={
                              companyProfile.companyName || 'PT. ABADI AGROSINDO PERSADA'
                            }
                            logoUrl={companyProfile.logoUrl}
                            isPrint={false}
                            scale={sheetPreviewZoom}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-300">
                Pastikan ukuran kertas printer diset ke{' '}
                <strong className="text-amber-300">
                  {currentTemplate.pageSize.widthMm} × {currentTemplate.pageSize.heightMm} mm
                </strong>{' '}
                dengan Margin <strong>None / 0</strong>.
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPrintSheetPreviewOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                >
                  Kembali ke Pengaturan Desain
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center gap-2 shadow-md transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  <span>Lanjutkan Cetak {totalStickerCount} Stiker Sekarang</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
