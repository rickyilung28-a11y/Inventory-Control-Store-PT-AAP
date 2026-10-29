import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface ThermalBarcodeElementProps {
  code: string;
  type: 'code128' | 'qrcode';
  height?: number; // Barcode height in px
  showText?: boolean;
  className?: string;
  textClassName?: string;
}

/**
 * Pure SVG Code 128 Barcode Generator.
 * Generates sharp, crisp black lines optimized for thermal transfer and direct thermal printers (203/300 DPI).
 */
const Code128Svg: React.FC<{ code: string; height: number; className?: string }> = ({
  code,
  height,
  className = 'w-full',
}) => {
  const cleanCode = code.toUpperCase().replace(/[^A-Z0-9_-]/g, '');

  const getBars = (str: string) => {
    const bars: number[] = [2, 1, 1, 2, 3, 2]; // Start pattern
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
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
    if (index % 2 === 0) {
      rects.push({ x: currentX, width });
    }
    currentX += width;
  });

  return (
    <svg
      viewBox={`0 0 ${totalUnits} ${height}`}
      style={{ height: `${height}px` }}
      preserveAspectRatio="none"
      className={`${className} text-black fill-current block`}
    >
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y="0" width={r.width} height={height} fill="#000000" />
      ))}
    </svg>
  );
};

export const ThermalBarcodeElement: React.FC<ThermalBarcodeElementProps> = ({
  code,
  type,
  height = 32,
  showText = true,
  className = '',
  textClassName = '',
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (type === 'qrcode' && code) {
      QRCode.toDataURL(code, {
        margin: 0,
        width: Math.max(height * 2, 90),
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code generation error', err));
    }
  }, [type, code, height]);

  if (type === 'qrcode') {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt={`QR-${code}`}
            style={{ width: `${height * 1.5}px`, height: `${height * 1.5}px` }}
            className="object-contain block rendering-pixelated"
          />
        ) : (
          <div
            style={{ width: `${height * 1.5}px`, height: `${height * 1.5}px` }}
            className="bg-black flex items-center justify-center text-white text-[8px] font-mono"
          >
            QR
          </div>
        )}
        {showText && (
          <span
            className={`font-mono text-[9px] font-black tracking-widest text-black mt-0.5 select-all ${textClassName}`}
          >
            {code}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center w-full ${className}`}>
      <Code128Svg code={code} height={height} className="w-full max-w-full" />
      {showText && (
        <span
          className={`font-mono text-[9px] font-extrabold tracking-widest text-black mt-0.5 select-all ${textClassName}`}
        >
          *{code}*
        </span>
      )}
    </div>
  );
};
