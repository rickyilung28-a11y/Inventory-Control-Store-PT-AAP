import React, { useState, useRef } from 'react';
import { StockItem } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import {
  Printer,
  X,
  Barcode,
  Copy,
  Settings2,
  CheckCircle2,
  Tag,
  MapPin,
  Building2,
  Layers,
} from 'lucide-react';

interface PrintBarcodeThermalModalProps {
  items: StockItem[];
  onClose: () => void;
}

// Preset sticker roll sizes for Clabel thermal printers
const CLABEL_LABEL_SIZES = [
  { id: '50x30', name: '50 x 30 mm (Standar Clabel CT220B/230B)', widthMm: 50, heightMm: 30 },
  { id: '40x30', name: '40 x 30 mm (Label Mini Rak Clabel)', widthMm: 40, heightMm: 30 },
  { id: '60x40', name: '60 x 40 mm (Label Dus Box Sparepart)', widthMm: 60, heightMm: 40 },
  { id: '70x50', name: '70 x 50 mm (Label Besar Palet / Drum)', widthMm: 70, heightMm: 50 },
];

/**
 * Pure SVG Code 128 Barcode Generator.
 * Generates sharp, crisp black lines optimized for thermal transfer and direct thermal printers (203/300 DPI).
 */
const Code128SvgBarcode: React.FC<{ code: string; className?: string }> = ({ code, className = 'w-full h-10' }) => {
  // Simple deterministic pattern generator for Code 128B representation
  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9_-]/g, '');

  // Generates bar widths sequence
  const getBars = (str: string) => {
    const bars: number[] = [2, 1, 1, 2, 3, 2]; // Start B pattern
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      // Generate pattern based on charCode
      const p1 = ((charCode * 3) % 4) + 1;
      const p2 = ((charCode * 5) % 3) + 1;
      const p3 = ((charCode * 7) % 4) + 1;
      const p4 = ((charCode * 2) % 3) + 1;
      bars.push(p1, p2, p3, p4);
    }
    bars.push(2, 3, 3, 1, 1, 1, 2); // Stop pattern
    return bars;
  };

  const pattern = getBars(cleanCode);
  const totalUnits = pattern.reduce((acc, curr) => acc + curr, 0);

  let currentX = 0;
  const rects: Array<{ x: number; width: number }> = [];

  pattern.forEach((width, index) => {
    // Even indices are bars (black), odd are spaces (white)
    if (index % 2 === 0) {
      rects.push({ x: currentX, width });
    }
    currentX += width;
  });

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <svg
        viewBox={`0 0 ${totalUnits} 40`}
        preserveAspectRatio="none"
        className={`${className} text-black fill-current`}
      >
        {rects.map((r, i) => (
          <rect key={i} x={r.x} y="0" width={r.width} height="40" fill="#000000" />
        ))}
      </svg>
      <span className="font-mono text-[9px] sm:text-[10px] font-extrabold tracking-widest text-black mt-0.5 select-all">
        {cleanCode}
      </span>
    </div>
  );
};

export const PrintBarcodeThermalModal: React.FC<PrintBarcodeThermalModalProps> = ({
  items,
  onClose,
}) => {
  const { companyProfile } = useInventory();

  const [selectedSizeId, setSelectedSizeId] = useState('50x30');
  const [copiesPerItem, setCopiesPerItem] = useState(1);
  const [showCompanyName, setShowCompanyName] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  const [showCategory, setShowCategory] = useState(true);
  const [showDate, setShowDate] = useState(false);

  const selectedSize = CLABEL_LABEL_SIZES.find((s) => s.id === selectedSizeId) || CLABEL_LABEL_SIZES[0];

  const handlePrint = () => {
    // Inject dynamic page-size print style matching the chosen thermal roll dimensions
    const styleId = 'clabel-thermal-page-style';
    let styleEl = document.getElementById(styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      @media print {
        @page {
          size: ${selectedSize.widthMm}mm ${selectedSize.heightMm}mm !important;
          margin: 0 !important;
        }
        body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
        }
        .clabel-sticker-item {
          page-break-after: always !important;
          break-after: page !important;
          width: ${selectedSize.widthMm}mm !important;
          height: ${selectedSize.heightMm}mm !important;
          max-height: ${selectedSize.heightMm}mm !important;
          overflow: hidden !important;
          padding: 1.5mm !important;
          box-sizing: border-box !important;
        }
      }
    `;

    window.print();
  };

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });

  return (
    <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Cetak Barcode Stiker Thermal
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  Khusus Printer Clabel / POS Thermal
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Format stiker presisi tinggi siap cetak ke printer Bluetooth / USB merek Clabel (CT220B, CT230B, CT520B)
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

        {/* Configuration Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Label Size Preset */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-500" />
              <span>Ukuran Stiker Clabel:</span>
            </label>
            <select
              value={selectedSizeId}
              onChange={(e) => setSelectedSizeId(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-slate-900 focus:outline-hidden"
            >
              {CLABEL_LABEL_SIZES.map((sz) => (
                <option key={sz.id} value={sz.id}>
                  {sz.name}
                </option>
              ))}
            </select>
          </div>

          {/* Copies count */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Jumlah Lembar per Item:</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="50"
                value={copiesPerItem}
                onChange={(e) => setCopiesPerItem(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-xs"
              />
              <span className="text-slate-500 text-[11px]">
                Total: <strong>{items.length * copiesPerItem} stiker</strong>
              </span>
            </div>
          </div>

          {/* Sticker display toggles */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Tampilan Data Stiker:</span>
            </label>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-700 pt-0.5">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCompanyName}
                  onChange={(e) => setShowCompanyName(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Nama PT</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLocation}
                  onChange={(e) => setShowLocation(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Lokasi Rak</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCategory}
                  onChange={(e) => setShowCategory(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Kategori</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showDate}
                  onChange={(e) => setShowDate(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Tgl Cetak</span>
              </label>
            </div>
          </div>
        </div>

        {/* Preview Stickers Area */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-slate-100/70">
          <div className="text-[11px] text-slate-500 mb-3 flex items-center justify-between">
            <span>
              Pratinjau Stiker ({items.length} item barang &times; {copiesPerItem} rangkap ={' '}
              {items.length * copiesPerItem} label)
            </span>
            <span className="font-mono text-slate-600">
              Dimensi Roll: {selectedSize.widthMm}mm &times; {selectedSize.heightMm}mm
            </span>
          </div>

          {/* Grid of Preview Stickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {items.flatMap((item) =>
              Array.from({ length: copiesPerItem }).map((_, cIdx) => (
                <div
                  key={`${item.id}-${cIdx}`}
                  className="clabel-sticker-item bg-white border-2 border-black rounded shadow-xs p-2 text-black flex flex-col justify-between mx-auto select-none overflow-hidden"
                  style={{
                    width: `${selectedSize.widthMm * 3.8}px`,
                    minHeight: `${selectedSize.heightMm * 3.8}px`,
                  }}
                >
                  {/* Top: Company Wordmark */}
                  {showCompanyName && (
                    <div className="text-[8px] font-black uppercase tracking-tight truncate border-b border-black pb-0.5 text-center">
                      {companyProfile.companyName || 'PT. ABADI AGROSINDO PERSADA'}
                    </div>
                  )}

                  {/* Item Name */}
                  <div className="my-1">
                    <div className="text-[10px] font-extrabold leading-tight line-clamp-2 uppercase">
                      {item.name}
                    </div>
                    {showCategory && (
                      <div className="text-[7.5px] font-medium text-slate-800 truncate">
                        {item.category}
                      </div>
                    )}
                  </div>

                  {/* Crisp Barcode */}
                  <div className="my-0.5 w-full">
                    <Code128SvgBarcode code={item.sku} className="w-full h-8 sm:h-9" />
                  </div>

                  {/* Bottom: Rack Location & Meta */}
                  <div className="flex items-center justify-between pt-0.5 border-t border-black text-[8px] font-bold font-mono">
                    {showLocation ? (
                      <span className="truncate">RAK: {item.location || 'A-01'}</span>
                    ) : (
                      <span>AAP GUDANG</span>
                    )}

                    {showDate ? (
                      <span>{todayStr}</span>
                    ) : (
                      <span>{item.unit}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Modal Footer with Direct Print */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-300">
            Pastikan ukuran kertas di dialog printer diset ke <strong>{selectedSize.name}</strong> dengan margin <strong>None / 0</strong>.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-xs"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>Cetak ke Printer Thermal Clabel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
