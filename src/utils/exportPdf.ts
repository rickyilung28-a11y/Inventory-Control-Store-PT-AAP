import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface PdfExportOptions {
  filename?: string;
  title?: string;
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'letter';
  marginMm?: number;
  quality?: number;
  fitFullHeight?: boolean;
}

/**
 * Exports an HTML element directly to a downloadable PDF file using html2canvas & jsPDF.
 * Automatically slices long documents into multiple A4 pages with crisp high-DPI rendering.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  options: PdfExportOptions = {}
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      filename = `dokumen_${new Date().toISOString().split('T')[0]}.pdf`,
      title = 'Dokumen Logistik Gudang',
      orientation = 'landscape',
      format = 'a4',
      marginMm = 4,
      fitFullHeight = false,
    } = options;

    // Render element into high-resolution canvas
    const canvas = await html2canvas(element, {
      scale: 2, // 2x retina clarity for crisp barcode, text, lines
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      onclone: (clonedDoc) => {
        // Ensure no-print items are hidden in cloned DOM
        const noPrintItems = clonedDoc.querySelectorAll('.no-print');
        noPrintItems.forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });
      },
    });

    const isLandscape = orientation === 'landscape';
    const pdf = new jsPDF({
      orientation: isLandscape ? 'l' : 'p',
      unit: 'mm',
      format: format,
    });

    // Set PDF document metadata
    pdf.setProperties({
      title: title,
      subject: 'Laporan Inventaris Pergudangan',
      author: 'PT. Abadi Agrosindo Persada',
      creator: 'Sistem Manajemen Gudang Digital AAP',
    });

    const pageWidth = isLandscape ? 297 : 210;
    const pageHeight = isLandscape ? 210 : 297;

    const printableWidth = pageWidth - marginMm * 2;
    const printableHeight = pageHeight - marginMm * 2;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Dimensions of canvas rendered at printable width scale in mm
    const renderedHeightMm = (canvasHeight * printableWidth) / canvasWidth;

    if (fitFullHeight && renderedHeightMm <= printableHeight * 1.18) {
      // Stretch/fit cleanly to fill 100% of the vertical page height (Full Bawah)
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', marginMm, marginMm, printableWidth, printableHeight, undefined, 'FAST');
    } else if (renderedHeightMm <= printableHeight + 8) {
      // Single page document (fit cleanly onto 1 sheet if within tolerance)
      const finalHeightMm = Math.min(renderedHeightMm, printableHeight);
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', marginMm, marginMm, printableWidth, finalHeightMm, undefined, 'FAST');
    } else {
      // Multi-page document: slice canvas page-by-page to avoid cutting lines awkwardly
      const pxPerMm = canvasWidth / printableWidth;
      const pageHeightPx = Math.floor(printableHeight * pxPerMm);
      let renderedPx = 0;
      let pageIndex = 0;

      while (renderedPx < canvasHeight) {
        if (pageIndex > 0) {
          pdf.addPage(format, isLandscape ? 'l' : 'p');
        }

        const sliceHeightPx = Math.min(pageHeightPx, canvasHeight - renderedPx);

        // Create a temporary canvas for this page slice
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvasWidth;
        pageCanvas.height = sliceHeightPx;
        const pageCtx = pageCanvas.getContext('2d');

        if (pageCtx) {
          pageCtx.fillStyle = '#ffffff';
          pageCtx.fillRect(0, 0, canvasWidth, sliceHeightPx);
          pageCtx.drawImage(
            canvas,
            0,
            renderedPx,
            canvasWidth,
            sliceHeightPx,
            0,
            0,
            canvasWidth,
            sliceHeightPx
          );

          const sliceHeightMm = (sliceHeightPx * printableWidth) / canvasWidth;
          const sliceImgData = pageCanvas.toDataURL('image/png');
          pdf.addImage(sliceImgData, 'PNG', marginMm, marginMm, printableWidth, sliceHeightMm, undefined, 'FAST');
        }

        renderedPx += sliceHeightPx;
        pageIndex++;
      }
    }

    // Save and download PDF file
    pdf.save(filename);
    return { success: true };
  } catch (err: unknown) {
    console.error('Failed to export PDF:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Gagal mengekspor dokumen ke format PDF',
    };
  }
}

/**
 * Creates an isolated, clean printable iframe to trigger native browser Print / Save to PDF.
 * Eliminates background UI bleeding, modal backdrops, scrollbars, and iframe sandbox issues.
 */
export function printElementDirectly(
  element: HTMLElement,
  title: string = 'Cetak Dokumen',
  orientation: 'portrait' | 'landscape' = 'landscape'
) {
  try {
    // Clone printable element content
    const content = element.innerHTML;

    // Check if an existing print iframe exists, remove if so
    const existingIframe = document.getElementById('inventory-print-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'inventory-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    // Copy all stylesheets from current document into print iframe for accurate Tailwind layout
    const styleLinks = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((el) => el.outerHTML)
      .join('\n');

    const pageRule =
      orientation === 'landscape'
        ? '@page { size: A4 landscape; margin: 5mm; }'
        : '@page { size: A4 portrait; margin: 5mm; }';

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>${title}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
          ${styleLinks}
          <style>
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              color: #0f172a;
              background-color: #ffffff;
            }
            .font-mono, code {
              font-family: 'JetBrains Mono', monospace;
            }
            .no-print {
              display: none !important;
            }
            ${pageRule}
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => iframe.remove(), 2000);
      }, 300);
    };
  } catch (err) {
    console.warn('Iframe print failed, falling back to window.print():', err);
    window.print();
  }
}
