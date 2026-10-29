import React, { useRef, useState, useLayoutEffect } from 'react';
import { ThermalLabelTemplate } from '../utils/thermalTemplates';
import { StockItem, StorageLocation } from '../types/inventory';
import { ThermalBarcodeElement } from './ThermalBarcodeElement';

export interface StickerItemData {
  type: 'item';
  item: StockItem;
}

export interface StickerRackData {
  type: 'rack';
  location: StorageLocation;
}

export type StickerData = StickerItemData | StickerRackData;

interface ThermalStickerRendererProps {
  template: ThermalLabelTemplate;
  data: StickerData;
  companyName: string;
  logoUrl?: string;
  isPrint?: boolean;
  scale?: number; // Visual preview scaling factor (default 1)
}

export const ThermalStickerRenderer: React.FC<ThermalStickerRendererProps> = ({
  template,
  data,
  companyName,
  logoUrl,
  isPrint = false,
  scale = 1,
}) => {
  const { pageSize, design } = template;
  const isLandscape = pageSize.orientation === 'landscape';
  const widthMm = isLandscape ? pageSize.widthMm : pageSize.heightMm;
  const heightMm = isLandscape ? pageSize.heightMm : pageSize.widthMm;

  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [contentFitScale, setContentFitScale] = useState<number>(1);

  const fitToPaper = design.fitToPaper !== false;
  const showPrimaryCode = design.showPrimaryCode !== false;
  const showBarcodeGraphic = design.showBarcodeGraphic !== false;
  const showFooter = design.showFooter !== false;

  // Extract fields
  const isItem = data.type === 'item';
  const item = isItem ? data.item : null;
  const rack = !isItem ? data.location : null;

  const primaryCode = isItem ? item?.sku || '' : rack?.code || '';
  const secondaryName = isItem ? item?.name || '' : rack?.name || '';
  const categoryOrZone = isItem ? item?.category || '' : rack?.zone || '';
  const locationOrDesc = isItem ? item?.location || '' : rack?.description || '';

  // Auto-measure & Fit-to-Paper calculation so content never overflows physical paper dimensions
  useLayoutEffect(() => {
    if (!fitToPaper || !outerRef.current || !innerRef.current) {
      setContentFitScale(1);
      return;
    }

    const computeScale = () => {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;

      const availW = outer.clientWidth;
      const availH = outer.clientHeight;
      const naturalW = inner.scrollWidth;
      const naturalH = inner.scrollHeight;

      if (availW <= 0 || availH <= 0 || naturalW <= 0 || naturalH <= 0) {
        setContentFitScale(1);
        return;
      }

      const ratioW = availW / naturalW;
      const ratioH = availH / naturalH;
      const minRatio = Math.min(ratioW, ratioH, 1);

      setContentFitScale(minRatio < 0.99 ? Math.max(0.52, Number(minRatio.toFixed(3))) : 1);
    };

    computeScale();
    const timer = setTimeout(computeScale, 30);
    return () => clearTimeout(timer);
  }, [
    fitToPaper,
    widthMm,
    heightMm,
    design,
    primaryCode,
    secondaryName,
    categoryOrZone,
    locationOrDesc,
  ]);

  // Border styles
  const borderClass = {
    none: 'border-0',
    thin: 'border border-black',
    bold: 'border-2 border-black',
    double: 'border-4 border-double border-black',
    rounded: 'border-2 border-black rounded-xl',
  }[design.borderStyle || 'thin'];

  // Font size helpers
  const headerFontClass = {
    xs: 'text-[9px] leading-tight',
    sm: 'text-[10.5px] leading-tight',
    base: 'text-xs leading-tight',
  }[design.headerFontSize || 'xs'];

  const titleFontClass = {
    sm: 'text-xs',
    base: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
    '2xl': 'text-xl',
  }[design.titleFontSize || 'lg'];

  const titleWeightClass = {
    normal: 'font-semibold',
    bold: 'font-bold',
    black: 'font-black',
  }[design.titleFontWeight || 'black'];

  const nameFontClass = {
    xs: 'text-[9.5px]',
    sm: 'text-[11px]',
    base: 'text-xs',
  }[design.nameFontSize || 'xs'];

  const textAlignClass = design.contentAlign === 'center' ? 'text-center' : 'text-left';

  const todayStr = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const hasAnyFooterItem =
    showFooter &&
    ((isItem && design.showLocation && Boolean(locationOrDesc)) ||
      (isItem && design.showCategory && Boolean(categoryOrZone)) ||
      (isItem && design.showStock && Boolean(item)) ||
      (isItem && design.showSafetyStock && Boolean(item)) ||
      (isItem && design.showUnit && Boolean(item?.unit)) ||
      (isItem && design.showDescription && Boolean(item?.description)) ||
      (!isItem && design.showZone && Boolean(categoryOrZone)) ||
      (!isItem && design.showDescription && Boolean(locationOrDesc)) ||
      Boolean(design.customFooterText) ||
      design.showDate);

  return (
    <div
      style={{
        width: !isPrint && scale !== 1 ? `${widthMm * scale}mm` : `${widthMm}mm`,
        height: !isPrint && scale !== 1 ? `${heightMm * scale}mm` : `${heightMm}mm`,
        position: 'relative',
      }}
    >
      <div
        ref={outerRef}
        className={`clabel-thermal-sticker bg-white text-black overflow-hidden box-border ${borderClass} select-none`}
        style={{
          width: `${widthMm}mm`,
          height: `${heightMm}mm`,
          padding: `${design.paddingMm ?? 1.5}mm`,
          transform: !isPrint && scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div
          ref={innerRef}
          className="w-full h-full flex flex-col justify-between"
          style={
            fitToPaper && contentFitScale < 1
              ? {
                  transform: `scale(${contentFitScale})`,
                  transformOrigin: 'top center',
                  width: `${100 / contentFitScale}%`,
                  marginLeft: `${(100 - 100 / contentFitScale) / 2}%`,
                }
              : undefined
          }
        >
          {/* 1. HEADER SECTION */}
          {design.showHeader && (
            <div className="shrink-0 mb-0.5">
              {design.headerType === 'inverted_bar' ? (
                <div className="bg-black text-white px-1.5 py-0.5 text-center font-black tracking-wider uppercase flex items-center justify-between text-[8.5px] rounded-xs">
                  <span className="truncate flex-1">
                    {design.customHeaderText || companyName || 'INVENTARIS STORE'}
                  </span>
                  {design.showDate && (
                    <span className="text-[7px] font-mono text-zinc-300 ml-1 shrink-0">
                      {todayStr}
                    </span>
                  )}
                </div>
              ) : (
                <div
                  className={`flex items-center justify-between border-b border-black pb-0.5 ${headerFontClass}`}
                >
                  <div className="flex items-center gap-1 min-w-0">
                    {design.showLogo &&
                      (logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo"
                          className="w-3.5 h-3.5 object-contain filter grayscale contrast-200"
                        />
                      ) : (
                        <span className="w-3.5 h-3.5 bg-black text-white text-[7px] font-black rounded-xs flex items-center justify-center shrink-0">
                          AAP
                        </span>
                      ))}
                    <span className="font-extrabold uppercase tracking-tight truncate">
                      {design.headerType === 'custom_text' && design.customHeaderText
                        ? design.customHeaderText
                        : companyName || 'PT. ABADI AGROSINDO PERSADA'}
                    </span>
                  </div>
                  {design.showDate && (
                    <span className="text-[7px] font-mono text-black font-bold shrink-0 ml-1">
                      {todayStr}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. BODY SECTION (Adaptive Barcode & Identifiers) */}
          <div className="flex-1 flex flex-col justify-center min-h-0 py-0.5">
            {design.barcodeType === 'qrcode' && showBarcodeGraphic ? (
              // QR Code Split Layout: QR on side, Codes & Details on other side
              <div className="flex items-center gap-2">
                <div className="shrink-0">
                  <ThermalBarcodeElement
                    code={primaryCode}
                    type="qrcode"
                    height={design.barcodeHeight || 36}
                    showText={false}
                  />
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  {/* Primary Code */}
                  {showPrimaryCode && (
                    <div
                      className={`${titleFontClass} ${titleWeightClass} font-mono tracking-tight text-black truncate leading-tight`}
                    >
                      {primaryCode}
                    </div>
                  )}

                  {/* Name */}
                  {design.showName && secondaryName && (
                    <div
                      className={`${nameFontClass} font-semibold text-black leading-tight ${
                        design.nameMaxLines === 1 ? 'truncate' : 'line-clamp-2'
                      }`}
                    >
                      {secondaryName}
                    </div>
                  )}

                  {/* Extra badges */}
                  <div className="flex flex-wrap items-center gap-1 mt-0.5 text-[7.5px] font-mono">
                    {isItem && design.showLocation && locationOrDesc && (
                      <span className="border border-black px-1 py-0.2 rounded-xs font-bold whitespace-nowrap">
                        Rak: {locationOrDesc}
                      </span>
                    )}
                    {isItem && design.showCategory && categoryOrZone && (
                      <span className="bg-black text-white px-1 py-0.2 rounded-xs font-semibold whitespace-nowrap">
                        {categoryOrZone}
                      </span>
                    )}
                    {isItem && design.showSafetyStock && item && (
                      <span className="border border-black px-1 py-0.2 rounded-xs font-bold whitespace-nowrap">
                        Min: {item.minStock} {item.unit}
                      </span>
                    )}
                    {!isItem && design.showZone && categoryOrZone && (
                      <span className="bg-black text-white px-1 py-0.2 rounded-xs font-bold whitespace-nowrap">
                        {categoryOrZone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Standard 1D Barcode Layout (or Text-only if barcode graphic hidden): Stacked
              <div className={`flex flex-col items-center justify-center w-full ${textAlignClass}`}>
                {/* Primary SKU / Rack Code */}
                {showPrimaryCode && (
                  <div
                    className={`w-full ${titleFontClass} ${titleWeightClass} font-mono tracking-wider text-black truncate leading-tight`}
                  >
                    {primaryCode}
                  </div>
                )}

                {/* Subtitle Name */}
                {design.showName && secondaryName && (
                  <div
                    className={`w-full ${nameFontClass} font-semibold text-black leading-tight mb-0.5 ${
                      design.nameMaxLines === 1 ? 'truncate' : 'line-clamp-2'
                    }`}
                  >
                    {secondaryName}
                  </div>
                )}

                {/* 1D Barcode Graphic */}
                {showBarcodeGraphic && (
                  <div className="w-full my-0.5">
                    <ThermalBarcodeElement
                      code={primaryCode}
                      type="code128"
                      height={design.barcodeHeight || 28}
                      showText={design.showBarcodeText}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. METADATA & FOOTER SECTION */}
          {hasAnyFooterItem && (
            <div className="shrink-0 mt-0.5 pt-0.5 border-t border-black/40 text-[7.5px] font-mono">
              <div className="flex flex-wrap items-center justify-between gap-1">
                {/* Left badges */}
                <div className="flex flex-wrap items-center gap-1 min-w-0">
                  {isItem &&
                    design.showLocation &&
                    locationOrDesc &&
                    !(design.barcodeType === 'qrcode' && showBarcodeGraphic) && (
                      <span className="font-bold border border-black px-1 rounded-2xs whitespace-nowrap">
                        Rak: {locationOrDesc}
                      </span>
                    )}
                  {isItem &&
                    design.showCategory &&
                    categoryOrZone &&
                    !(design.barcodeType === 'qrcode' && showBarcodeGraphic) && (
                      <span className="font-semibold bg-black text-white px-1 rounded-2xs whitespace-nowrap">
                        {categoryOrZone}
                      </span>
                    )}
                  {isItem && design.showStock && item && (
                    <span className="font-bold border border-black px-1 rounded-2xs whitespace-nowrap">
                      Stok: {item.currentStock} {item.unit}
                    </span>
                  )}
                  {isItem &&
                    design.showSafetyStock &&
                    item &&
                    !(design.barcodeType === 'qrcode' && showBarcodeGraphic) && (
                      <span className="font-bold border border-black px-1 rounded-2xs whitespace-nowrap">
                        Min: {item.minStock} {item.unit}
                      </span>
                    )}
                  {isItem && design.showUnit && item && (
                    <span className="font-semibold whitespace-nowrap">UOM: {item.unit}</span>
                  )}
                  {isItem && design.showDescription && item?.description && (
                    <span className="truncate max-w-[110px]">{item.description}</span>
                  )}
                  {!isItem &&
                    design.showZone &&
                    categoryOrZone &&
                    !(design.barcodeType === 'qrcode' && showBarcodeGraphic) && (
                      <span className="font-bold bg-black text-white px-1 rounded-2xs whitespace-nowrap">
                        {categoryOrZone}
                      </span>
                    )}
                  {!isItem && design.showDescription && locationOrDesc && (
                    <span className="truncate max-w-[120px]">{locationOrDesc}</span>
                  )}
                </div>

                {/* Right text / Custom Footer */}
                {(design.customFooterText || (design.showDate && !design.showHeader)) && (
                  <div className="shrink-0 text-right font-extrabold uppercase text-[7px]">
                    {design.customFooterText ? (
                      <span>{design.customFooterText}</span>
                    ) : (
                      <span>{todayStr}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
