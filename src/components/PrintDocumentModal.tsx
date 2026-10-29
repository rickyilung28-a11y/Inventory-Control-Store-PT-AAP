import React, { useState, useRef, useEffect } from 'react';
import { LPBDocument, IssueVoucherDocument, UserAccount } from '../types/inventory';
import { useInventory } from '../context/InventoryContext';
import {
  Printer,
  X,
  FileText,
  Download,
  Loader2,
  CheckCircle2,
  Scissors,
  Columns2,
  Rows2,
  Maximize2,
  Stamp,
} from 'lucide-react';
import { exportElementToPdf, printElementDirectly } from '../utils/exportPdf';

interface PrintDocumentModalProps {
  documentData: {
    type: 'LPB' | 'NPB';
    doc: LPBDocument | IssueVoucherDocument;
  } | null;
  onClose: () => void;
}

// Logo Tunas Tanaman PT. Abadi Agrosindo Persada
const AapSproutLogo = ({ className = 'w-10 h-10' }: { className?: string }) => (
  <img
    src="/logo-aap.svg"
    alt="Logo PT Abadi Agrosindo Persada"
    className={`${className} shrink-0 object-contain`}
  />
);

const formatAccountIdPic = (rawId?: string): string => {
  if (!rawId) return '-';
  const trimmed = rawId.trim();
  if (!trimmed || trimmed === 'unknown' || trimmed === '-') return '-';
  return trimmed.replace(/staff/gi, 'PIC');
};

// Helper mencari akun user berdasarkan ID, username, atau nama lengkap
const resolveSignerAccount = (
  users: UserAccount[],
  opts: {
    id?: string;
    username?: string;
    name?: string;
    fallbackRole?: UserAccount['role'];
  }
): { id: string; username: string; name: string } => {
  const cleanId = (opts.id || '').trim();
  const normalizedTargetId = cleanId.toLowerCase().replace(/staff/g, 'pic');
  const cleanUname = (opts.username || '').trim().replace(/^@/, '');
  const cleanName = (opts.name || '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .trim();

  let matched: UserAccount | undefined;
  if (cleanId && cleanId !== 'unknown') {
    matched = users.find(
      (u) =>
        u.id === cleanId ||
        u.id.toLowerCase().replace(/staff/g, 'pic') === normalizedTargetId
    );
  }
  if (!matched && cleanUname) {
    matched = users.find((u) => u.username.toLowerCase() === cleanUname.toLowerCase());
  }
  if (!matched && cleanName) {
    matched = users.find((u) => u.name.trim().toLowerCase() === cleanName.toLowerCase());
  }
  if (!matched && opts.fallbackRole) {
    matched = users.find((u) => u.role === opts.fallbackRole);
  }

  return {
    id: formatAccountIdPic(matched?.id || cleanId),
    username: matched?.username || cleanUname || '-',
    name: matched?.name || cleanName || '-',
  };
};

// Stempel / Badge ACC Digital Resmi dengan Nama Akun, ID Akun, Tanggal & Jam
const DigitalAccStamp: React.FC<{
  badge?: string;
  title: string;
  signerName?: string;
  accountId?: string;
  accountUsername?: string;
  date: string;
  time: string;
  officerRole?: string;
  authCode?: string;
  colorScheme?: 'blue' | 'emerald' | 'amber';
  compact?: boolean;
}> = ({
  badge = 'TTD DIGITAL',
  title,
  signerName,
  accountId,
  accountUsername,
  date,
  time,
  officerRole,
  authCode,
  colorScheme = 'blue',
  compact = true,
}) => {
  const formattedAccountId = formatAccountIdPic(accountId);
  const styles = {
    blue: {
      border: 'border-blue-900',
      bg: 'bg-blue-50/70',
      badgeBg: 'bg-blue-900 text-white',
      titleColor: 'text-blue-950',
      textColor: 'text-blue-900',
      subColor: 'text-blue-800',
    },
    emerald: {
      border: 'border-emerald-900',
      bg: 'bg-emerald-50/70',
      badgeBg: 'bg-emerald-900 text-white',
      titleColor: 'text-emerald-950',
      textColor: 'text-emerald-900',
      subColor: 'text-emerald-800',
    },
    amber: {
      border: 'border-amber-900',
      bg: 'bg-amber-50/70',
      badgeBg: 'bg-amber-900 text-white',
      titleColor: 'text-amber-950',
      textColor: 'text-amber-900',
      subColor: 'text-amber-800',
    },
  }[colorScheme];

  return (
    <div
      className={`border ${styles.border} ${styles.bg} rounded p-1 text-center w-full select-none shadow-2xs`}
    >
      <div
        className={`inline-block ${styles.badgeBg} font-mono ${
          compact ? 'text-[6px]' : 'text-[7px]'
        } font-extrabold px-1.5 py-0.2 rounded-xs uppercase tracking-wider`}
      >
        {badge}
      </div>
      <div
        className={`${
          compact ? 'text-[7px]' : 'text-[8px]'
        } font-bold uppercase tracking-tight mt-0.5 leading-tight ${styles.titleColor} truncate`}
      >
        {title}
      </div>
      {signerName && signerName !== '-' && (
        <div
          className={`${
            compact ? 'text-[7px]' : 'text-[8px]'
          } font-extrabold leading-tight truncate ${styles.titleColor}`}
        >
          {signerName}
        </div>
      )}
      {((accountUsername && accountUsername !== '-') || formattedAccountId !== '-') && (
        <div className="font-mono text-[6px] font-semibold text-slate-700 leading-tight truncate">
          {accountUsername && accountUsername !== '-' ? `@${accountUsername}` : ''}
          {accountUsername && accountUsername !== '-' && formattedAccountId !== '-'
            ? ' • '
            : ''}
          {formattedAccountId !== '-' ? `ID:${formattedAccountId}` : ''}
        </div>
      )}
      <div
        className={`mt-0.5 font-mono ${
          compact ? 'text-[6.5px]' : 'text-[7.5px]'
        } font-semibold leading-tight border-t border-b border-dashed border-slate-300 py-0.5 ${
          styles.textColor
        }`}
      >
        <div>Tgl : {date}</div>
        <div>Jam : {time}</div>
      </div>
      {officerRole && (
        <div
          className={`text-[6px] font-medium uppercase tracking-tight mt-0.5 ${styles.subColor}`}
        >
          {officerRole}
        </div>
      )}
      {authCode && (
        <div className="text-[6px] font-mono text-slate-500 tracking-tighter mt-0.5">
          {authCode}
        </div>
      )}
    </div>
  );
};

// Helper ekstraksi kode dari Cost Center dan GL Acc
const cleanCodeOnly = (val?: string) => {
  if (!val) return '';
  const trimmed = val.trim();
  const match = trimmed.match(/^([A-Za-z0-9_.-]+)/);
  return match ? match[1] : trimmed;
};

/**
 * Memecah nama barang yang panjang menjadi beberapa baris sesuai kapasitas lebar kolom.
 * Baris ke-2 dst. akan ditempatkan pada baris tabel di bawahnya ("teruskan kolom bawahnya")
 * sehingga nomor urut barang berikutnya ("nomor 2", dst.) otomatis turun ke baris berikutnya.
 */
const wrapTextToLines = (text: string, maxCharsPerLine: number): string[] => {
  const cleaned = (text || '').trim();
  if (!cleaned) return ['-'];

  const paragraphs = cleaned.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.trim().split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      if (!currentLine) {
        if (word.length <= maxCharsPerLine) {
          currentLine = word;
        } else {
          let remaining = word;
          while (remaining.length > maxCharsPerLine) {
            lines.push(remaining.slice(0, maxCharsPerLine));
            remaining = remaining.slice(maxCharsPerLine);
          }
          currentLine = remaining;
        }
      } else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
        currentLine += ` ${word}`;
      } else {
        lines.push(currentLine);
        if (word.length <= maxCharsPerLine) {
          currentLine = word;
        } else {
          let remaining = word;
          while (remaining.length > maxCharsPerLine) {
            lines.push(remaining.slice(0, maxCharsPerLine));
            remaining = remaining.slice(maxCharsPerLine);
          }
          currentLine = remaining;
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : ['-'];
};

// =========================================================================
// 1. KOMPONEN BLOK TUNGGAL NOTA PENGAMBILAN BARANG (SIV)
//    - Ukuran A5 (Kertas A4 Portrait dibagi 2 Atas & Bawah: Arsip Store & Purchasing)
// =========================================================================
interface SingleNotaBlockProps {
  npb: IssueVoucherDocument;
  users: UserAccount[];
  copyLabel?: string;
  copyBadgeColor?: 'blue' | 'emerald';
  paperCopyColorNote?: string;
  formatFullDate: (dateStr: string) => string;
  reqApprovalStamp: { date: string; time: string };
  handoverStamp: { date: string; time: string };
  whLeaderStamp: { date: string; time: string };
  isSideBySide?: boolean;
  showDigitalStamp?: boolean;
  companyName: string;
  companyCity: string;
  logoUrl?: string;
  docCode: string;
}

interface SivDisplayRow {
  rowKey: string;
  itemNumber: number | null;
  materialCode: string;
  nameLine: string;
  isContinuation: boolean;
  qty: number | string;
  unit: string;
  costCenter: string;
  glAcc: string;
  isEmptyRow: boolean;
}

const SingleNotaBlock: React.FC<SingleNotaBlockProps> = ({
  npb,
  users,
  copyLabel,
  copyBadgeColor = 'blue',
  paperCopyColorNote,
  formatFullDate,
  reqApprovalStamp,
  handoverStamp,
  whLeaderStamp,
  isSideBySide = false,
  showDigitalStamp = true,
  companyName,
  companyCity,
  logoUrl,
  docCode,
}) => {
  const badgeClasses = {
    blue: 'border-blue-900 bg-blue-50 text-blue-900',
    emerald: 'border-emerald-900 bg-emerald-50 text-emerald-900',
  }[copyBadgeColor];

  // Kapasitas karakter per baris untuk kolom NAMA BARANG pada SIV
  const maxNameChars = isSideBySide ? 26 : 44;
  // Jumlah minimal baris mengikuti form fisik (6 baris pada A5 Atas-Bawah)
  const targetMinRows = isSideBySide ? 8 : 6;

  // KETENTUAN BARU:
  // "dari hasil validasi pengeluaran barang, hanya barang dituliskan jumlah qty pengeluaran lebih dari 0 yang masuk ke bukti pdf SIV"
  const printableItems = npb.items.filter((item) => {
    if (item.isCancelled) return false;
    const effectiveQty = item.issuedQty ?? item.approvedQty ?? item.requestedQty;
    return effectiveQty > 0;
  });

  // Bangun baris tabel: jika nama barang panjang, teruskan ke baris bawahnya dan otomatis nomor 2 turun
  const itemRows: SivDisplayRow[] = [];
  printableItems.forEach((item, idx) => {
    const effectiveQty = item.issuedQty ?? item.approvedQty ?? item.requestedQty;
    const wrappedLines = wrapTextToLines(item.itemName, maxNameChars);
    wrappedLines.forEach((lineText, lineIdx) => {
      if (lineIdx === 0) {
        itemRows.push({
          rowKey: `siv-item-${idx}-line-0`,
          itemNumber: idx + 1,
          materialCode: item.sku || '',
          nameLine: lineText,
          isContinuation: false,
          qty: effectiveQty,
          unit: item.unit || 'pcs',
          costCenter: cleanCodeOnly(item.costCenter),
          glAcc: cleanCodeOnly(item.glAcc),
          isEmptyRow: false,
        });
      } else {
        itemRows.push({
          rowKey: `siv-item-${idx}-line-${lineIdx}`,
          itemNumber: null, // Kosong karena lanjutan nama barang di atasnya
          materialCode: '',
          nameLine: lineText,
          isContinuation: true,
          qty: '',
          unit: '',
          costCenter: '',
          glAcc: '',
          isEmptyRow: false,
        });
      }
    });
  });

  // Baris kosong di bawah item: nomor urut melanjutkan dari jumlah item terakhir (otomatis turun jika ada nama panjang)
  const emptyRowCount = Math.max(0, targetMinRows - itemRows.length);
  const allRows: SivDisplayRow[] = [...itemRows];
  for (let i = 0; i < emptyRowCount; i++) {
    allRows.push({
      rowKey: `siv-empty-${i}`,
      itemNumber: printableItems.length + i + 1,
      materialCode: '',
      nameLine: '',
      isContinuation: false,
      qty: '',
      unit: '',
      costCenter: '',
      glAcc: '',
      isEmptyRow: true,
    });
  }

  // Penentuan nama & akun (ID akun + username + nama akun) untuk 4 kolom tanda tangan SIV:
  // 1. Permintaan - Diterima  : nama penerima (yang diinputkan admin)
  // 2. Permintaan - Disetujui : Akun User yang Menerbitkan Nota Pengambilan Barang
  // 3. Penyerahan - Diserahkan: Akun User Admin Store yang ACC SIV + TTD Digital
  // 4. Penyerahan - Disetujui : Akun Kepala Store yang Verifikasi Pengeluaran Stok + TTD Digital
  const recipientDisplayName = npb.recipientName || '';

  const issuerAccount = resolveSignerAccount(users, {
    id: npb.userId,
    username: npb.requesterUsername,
    name: npb.requestedBy || npb.approvedByRequester,
  });
  const issuerDisplayName = issuerAccount.name !== '-' ? issuerAccount.name : npb.requestedBy || '';

  const adminAccount = resolveSignerAccount(users, {
    id: npb.approvedByAdminId,
    username: npb.approvedByAdminUsername,
    name: npb.approvedByAdmin || npb.handoverOfficer,
    fallbackRole: npb.approvedByAdmin || npb.handoverOfficer ? 'admin' : undefined,
  });
  const accSivUserDisplayName =
    npb.approvedByAdmin || npb.handoverOfficer
      ? adminAccount.name !== '-'
        ? adminAccount.name
        : npb.approvedByAdmin || npb.handoverOfficer || ''
      : '';

  const whHeadAccount = resolveSignerAccount(users, {
    id: npb.approvedByWarehouseHeadId,
    username: npb.approvedByWarehouseHeadUsername,
    name: npb.approvedByWarehouseHead || npb.warehouseHeadName,
    fallbackRole: 'kepala_gudang',
  });
  const warehouseHeadDisplayName =
    npb.status === 'HANDOVER_COMPLETED' || npb.approvedByWarehouseHead || npb.warehouseHeadName
      ? whHeadAccount.name !== '-'
        ? whHeadAccount.name
        : npb.approvedByWarehouseHead || npb.warehouseHeadName || ''
      : '';

  const isHeadVerified =
    npb.status === 'HANDOVER_COMPLETED' || Boolean(npb.headApprovedAt || npb.approvedByWarehouseHead);
  const isHandoverDone =
    npb.status === 'APPROVED' ||
    npb.status === 'HANDOVER_COMPLETED' ||
    Boolean(npb.handoverAt || npb.approvedByAdmin);

  return (
    <div className="bg-white text-slate-900 select-text flex flex-col h-full justify-between">
      {/* BAGIAN ATAS: HEADER + JUDUL */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          {/* Kiri: Logo Tunas + Nama Perusahaan + Kota */}
          <div className="flex items-start gap-2.5 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className={
                  isSideBySide
                    ? 'w-9 h-9 object-contain shrink-0'
                    : 'w-12 h-12 object-contain shrink-0'
                }
              />
            ) : (
              <AapSproutLogo className={isSideBySide ? 'w-9 h-9' : 'w-12 h-12'} />
            )}
            <div className="min-w-0 pt-0.5">
              <h1
                className={`${
                  isSideBySide ? 'text-[13px]' : 'text-base sm:text-lg'
                } font-bold text-slate-900 leading-tight tracking-tight truncate`}
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {companyName}
              </h1>
              <p
                className={`${
                  isSideBySide ? 'text-[10px]' : 'text-xs'
                } font-normal text-slate-800 leading-tight mt-0.5`}
              >
                {companyCity}
              </p>
            </div>
          </div>

          {/* Kanan: Badge Lembar + Kotak Kode Dokumen + Tanggal & No. Doc */}
          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-1 mb-1 flex-wrap">
              {copyLabel && (
                <span
                  className={`inline-block border px-1.5 py-0.5 font-bold text-[8px] uppercase tracking-wider rounded-xs ${badgeClasses}`}
                >
                  {copyLabel}
                </span>
              )}
              <div
                className={`border border-slate-900 ${
                  isSideBySide ? 'px-2 py-0.5 text-[8.5px]' : 'px-3 py-0.5 text-[9.5px]'
                } font-bold text-slate-900 text-center tracking-wide bg-slate-50`}
              >
                {docCode || 'FR/AAP/G-STR/23/001'}
              </div>
            </div>
            <div
              className={`${
                isSideBySide ? 'text-[9px]' : 'text-[10px]'
              } text-slate-900 space-y-0.5 text-left inline-block`}
            >
              <div className="grid grid-cols-[46px_8px_1fr] items-baseline">
                <span className="font-medium">Tanggal</span>
                <span>:</span>
                <span className="font-semibold">{formatFullDate(npb.requestDate)}</span>
              </div>
              <div className="grid grid-cols-[46px_8px_1fr] items-baseline">
                <span className="font-medium">No. Doc</span>
                <span>:</span>
                <span className="font-semibold font-mono">{npb.voucherNumber}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Judul Tengah: NOTA PENGAMBILAN BARANG / STORE ISSUE VOUCHER */}
        <div className="text-center -mt-1.5 mb-1.5">
          <h2
            className={`${
              isSideBySide ? 'text-[12px]' : 'text-sm'
            } font-extrabold uppercase tracking-wide text-slate-900 leading-tight`}
          >
            NOTA PENGAMBILAN BARANG (SIV)
          </h2>
          <p
            className={`${
              isSideBySide ? 'text-[8px]' : 'text-[9px]'
            } font-bold uppercase tracking-wider text-slate-700 leading-tight`}
          >
            STORE ISSUE VOUCHER &mdash; UKURAN A5
          </p>
        </div>
      </div>

      {/* BAGIAN TENGAH: TABEL ITEM SIV (Persis Gambar: No | MATERIAL CODE | NAMA BARANG | JUMLAH | SAT | COST CENTER | GL ACC) */}
      <div className="flex-1 flex flex-col">
        <div className="border border-slate-900 flex-1 flex flex-col">
          <table className="w-full h-full border-collapse text-slate-900">
            <thead>
              <tr
                className={`border-b border-slate-900 font-bold text-slate-900 text-center uppercase bg-slate-100 ${
                  isSideBySide ? 'text-[8px] h-5.5' : 'text-[9px] h-6'
                }`}
              >
                <th className="border-r border-slate-900 px-1 w-7 text-center">No</th>
                <th
                  className={`border-r border-slate-900 px-1 text-center ${
                    isSideBySide ? 'w-18' : 'w-26'
                  }`}
                >
                  MATERIAL CODE
                </th>
                <th className="border-r border-slate-900 px-2 text-center">NAMA BARANG</th>
                <th
                  className={`border-r border-slate-900 px-1 text-center ${
                    isSideBySide ? 'w-11' : 'w-15'
                  }`}
                >
                  JUMLAH
                </th>
                <th
                  className={`border-r border-slate-900 px-1 text-center ${
                    isSideBySide ? 'w-10' : 'w-13'
                  }`}
                >
                  SAT
                </th>
                <th
                  className={`border-r border-slate-900 px-1 text-center ${
                    isSideBySide ? 'w-18' : 'w-25'
                  }`}
                >
                  COST CENTER
                </th>
                <th className={`px-1 text-center ${isSideBySide ? 'w-18' : 'w-25'}`}>
                  GL ACC
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {allRows.map((row) => (
                <tr
                  key={row.rowKey}
                  className={`${
                    isSideBySide ? 'text-[9px] h-5.5' : 'text-[10px] h-6'
                  } text-slate-900`}
                >
                  {/* No (dengan titik seperti "1.", "2.", kosong jika baris lanjutan nama panjang) */}
                  <td className="border-r border-slate-900 px-1 text-center font-semibold tabular-nums">
                    {row.itemNumber !== null ? `${row.itemNumber}.` : ''}
                  </td>

                  {/* MATERIAL CODE */}
                  <td className="border-r border-slate-900 px-1.5 text-center font-mono text-[8.5px] sm:text-[9.5px] font-medium whitespace-nowrap">
                    {row.materialCode || '\u00A0'}
                  </td>

                  {/* NAMA BARANG */}
                  <td className="border-r border-slate-900 px-2 font-semibold text-left whitespace-nowrap">
                    {row.nameLine || '\u00A0'}
                  </td>

                  {/* JUMLAH */}
                  <td className="border-r border-slate-900 px-1 text-center font-bold tabular-nums">
                    {row.qty !== '' ? row.qty : '\u00A0'}
                  </td>

                  {/* SAT */}
                  <td className="border-r border-slate-900 px-1 text-center font-medium">
                    {row.unit || '\u00A0'}
                  </td>

                  {/* COST CENTER */}
                  <td className="border-r border-slate-900 px-1 text-center font-mono font-semibold text-[8.5px] sm:text-[9.5px]">
                    {row.costCenter || '\u00A0'}
                  </td>

                  {/* GL ACC */}
                  <td className="px-1 text-center font-mono font-semibold text-[8.5px] sm:text-[9.5px]">
                    {row.glAcc || '\u00A0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BAGIAN BAWAH: KOTAK KEPERLUAN + TABEL 4 KOLOM TANDA TANGAN + FOOTNOTE */}
      <div className="mt-1.5">
        {/* Kotak: "Spare part tersebut di atas akan kami gunakan untuk" */}
        <div
          className={`border border-slate-900 px-2.5 py-1 ${
            isSideBySide ? 'min-h-[34px]' : 'min-h-[38px]'
          } flex flex-col justify-between bg-white`}
        >
          <div className={`${isSideBySide ? 'text-[8px]' : 'text-[9px]'} text-slate-800`}>
            Spare part tersebut di atas akan kami gunakan untuk
          </div>
          <div
            className={`${
              isSideBySide ? 'text-[9.5px]' : 'text-[11px]'
            } font-semibold text-slate-900 pl-2 pt-0.5`}
          >
            {npb.purpose
              ? `${npb.purpose}${npb.department ? ` — ${npb.department}` : ''}`
              : npb.department || '-'}
          </div>
        </div>

        {/* Tabel Tanda Tangan 2 Grup (4 Kolom): PERMINTAAN/PENGAMBILAN BARANG & PENYERAHAN/PENGELUARAN BARANG */}
        <div className="border border-slate-900 mt-1.5 text-slate-900 bg-white">
          <table className="w-full border-collapse">
            <thead>
              <tr
                className={`border-b border-slate-900 font-semibold text-center uppercase bg-slate-100 ${
                  isSideBySide ? 'text-[8px]' : 'text-[9px]'
                }`}
              >
                <th colSpan={2} className="border-r border-slate-900 py-0.5 px-1 w-1/2">
                  PERMINTAAN/PENGAMBILAN BARANG
                </th>
                <th colSpan={2} className="py-0.5 px-1 w-1/2">
                  PENYERAHAN/PENGELUARAN BARANG
                </th>
              </tr>
              <tr
                className={`border-b border-slate-900 font-semibold text-center uppercase ${
                  isSideBySide ? 'text-[8px]' : 'text-[9px]'
                }`}
              >
                <th className="border-r border-slate-900 py-0.5 px-1 w-1/4">DITERIMA</th>
                <th className="border-r border-slate-900 py-0.5 px-1 w-1/4">DISETUJUI</th>
                <th className="border-r border-slate-900 py-0.5 px-1 w-1/4">DISERAHKAN</th>
                <th className="py-0.5 px-1 w-1/4">DISETUJUI</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {/* Kolom 1: PERMINTAAN/PENGAMBILAN BARANG -> DITERIMA : Nama Penerima (yang diinputkan admin) */}
                <td
                  className={`border-r border-slate-900 p-1 align-bottom ${
                    isSideBySide ? 'h-18' : 'h-20'
                  }`}
                >
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center">
                      {/* Ruang tanda tangan penerima */}
                    </div>
                    <div
                      className={`flex items-center justify-between w-full px-1 ${
                        isSideBySide ? 'text-[8.5px]' : 'text-[9.5px]'
                      } font-semibold text-slate-900`}
                    >
                      <span>(</span>
                      <span className="truncate px-1 text-center">{recipientDisplayName}</span>
                      <span>)</span>
                    </div>
                  </div>
                </td>

                {/* Kolom 2: PERMINTAAN/PENGAMBILAN BARANG -> DISETUJUI : Akun yang Menerbitkan Nota Pengambilan Barang */}
                <td
                  className={`border-r border-slate-900 p-1 align-bottom ${
                    isSideBySide ? 'h-20' : 'h-22'
                  }`}
                >
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center p-0.5">
                      {showDigitalStamp && (
                        <DigitalAccStamp
                          badge="TTD DIGITAL"
                          title="PENERBIT NOTA SIV"
                          signerName={issuerDisplayName}
                          accountId={issuerAccount.id}
                          accountUsername={issuerAccount.username}
                          date={reqApprovalStamp.date}
                          time={reqApprovalStamp.time}
                          colorScheme="amber"
                          compact={true}
                        />
                      )}
                    </div>
                    <div className="w-full text-center">
                      <div
                        className={`flex items-center justify-between w-full px-1 ${
                          isSideBySide ? 'text-[8.5px]' : 'text-[9.5px]'
                        } font-semibold text-slate-900`}
                      >
                        <span>(</span>
                        <span className="truncate px-1 text-center">{issuerDisplayName}</span>
                        <span>)</span>
                      </div>
                      {(issuerAccount.username !== '-' || issuerAccount.id !== '-') && (
                        <div className="text-[6.5px] font-mono text-slate-600 leading-tight truncate">
                          {issuerAccount.username !== '-' ? `@${issuerAccount.username}` : ''}
                          {issuerAccount.username !== '-' && issuerAccount.id !== '-' ? ' • ' : ''}
                          {issuerAccount.id !== '-' ? `ID: ${issuerAccount.id}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Kolom 3: PENYERAHAN/PENGELUARAN BARANG -> DISERAHKAN : Akun Admin Store yang ACC SIV */}
                <td
                  className={`border-r border-slate-900 p-1 align-bottom ${
                    isSideBySide ? 'h-20' : 'h-22'
                  }`}
                >
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center p-0.5">
                      {showDigitalStamp && isHandoverDone && (
                        <DigitalAccStamp
                          badge="TTD DIGITAL"
                          title="DISERAHKAN (ADMIN STORE)"
                          signerName={accSivUserDisplayName}
                          accountId={adminAccount.id}
                          accountUsername={adminAccount.username}
                          date={handoverStamp.date}
                          time={handoverStamp.time}
                          colorScheme="blue"
                          compact={true}
                        />
                      )}
                    </div>
                    <div className="w-full text-center">
                      <div
                        className={`flex items-center justify-between w-full px-1 ${
                          isSideBySide ? 'text-[8.5px]' : 'text-[9.5px]'
                        } font-semibold text-slate-900`}
                      >
                        <span>(</span>
                        <span className="truncate px-1 text-center">{accSivUserDisplayName}</span>
                        <span>)</span>
                      </div>
                      {isHandoverDone &&
                        (adminAccount.username !== '-' || adminAccount.id !== '-') && (
                          <div className="text-[6.5px] font-mono text-slate-600 leading-tight truncate">
                            {adminAccount.username !== '-' ? `@${adminAccount.username}` : ''}
                            {adminAccount.username !== '-' && adminAccount.id !== '-' ? ' • ' : ''}
                            {adminAccount.id !== '-' ? `ID: ${adminAccount.id}` : ''}
                          </div>
                        )}
                    </div>
                  </div>
                </td>

                {/* Kolom 4: PENYERAHAN/PENGELUARAN BARANG -> DISETUJUI : Akun Kepala Store yang Verifikasi SIV */}
                <td className={`p-1 align-bottom ${isSideBySide ? 'h-20' : 'h-22'}`}>
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center p-0.5">
                      {showDigitalStamp && isHeadVerified && (
                        <DigitalAccStamp
                          badge="TTD DIGITAL"
                          title="ACC SIV - KA. STORE"
                          signerName={warehouseHeadDisplayName}
                          accountId={whHeadAccount.id}
                          accountUsername={whHeadAccount.username}
                          date={whLeaderStamp.date}
                          time={whLeaderStamp.time}
                          colorScheme="emerald"
                          compact={true}
                        />
                      )}
                    </div>
                    <div className="w-full text-center">
                      <div
                        className={`flex items-center justify-between w-full px-1 ${
                          isSideBySide ? 'text-[8.5px]' : 'text-[9.5px]'
                        } font-semibold text-slate-900`}
                      >
                        <span>(</span>
                        <span className="truncate px-1 text-center">
                          {warehouseHeadDisplayName}
                        </span>
                        <span>)</span>
                      </div>
                      {isHeadVerified &&
                        (whHeadAccount.username !== '-' || whHeadAccount.id !== '-') && (
                          <div className="text-[6.5px] font-mono text-slate-600 leading-tight truncate">
                            {whHeadAccount.username !== '-' ? `@${whHeadAccount.username}` : ''}
                            {whHeadAccount.username !== '-' && whHeadAccount.id !== '-'
                              ? ' • '
                              : ''}
                            {whHeadAccount.id !== '-' ? `ID: ${whHeadAccount.id}` : ''}
                          </div>
                        )}
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footnote SIV: Putih : Arsip Store   Kuning : Penerima Barang */}
        <div
          className={`flex items-center justify-between ${
            isSideBySide ? 'text-[8px]' : 'text-[9px]'
          } font-semibold text-slate-900 mt-1 px-1`}
        >
          <div className="flex items-center gap-6">
            <span>Putih : Arsip Store</span>
            <span>Kuning : Penerima Barang</span>
          </div>
          {paperCopyColorNote && (
            <span className="text-[8px] font-mono italic text-slate-600 truncate">
              {paperCopyColorNote}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// 2. KOMPONEN BLOK TUNGGAL LAPORAN PENERIMAAN BARANG (LPB)
//    - Ukuran A5 (Kertas A4 dibagi 2 Kanan dan Kiri)
//    - Full ke bawah (mengisi penuh tinggi kertas A5 sampai bawah)
//    - Jumlah baris ke bawah mengikuti tinggi kertas (16 baris pada A5)
//    - Apabila nama barang panjang, diteruskan ke baris/kolom bawahnya
//      dan otomatis nomor 2 (serta nomor berikutnya) turun ke baris bawahnya.
// =========================================================================
interface SingleLpbBlockProps {
  lpb: LPBDocument;
  users: UserAccount[];
  copyLabel: string;
  copyBadgeColor: 'blue' | 'emerald';
  paperCopyColorNote: string;
  formatShortDate: (dateStr: string) => string;
  lpbAdminStamp: { date: string; time: string };
  lpbHeadStamp: { date: string; time: string };
  showDigitalStamp?: boolean;
  isCompact?: boolean;
  isSideBySide?: boolean;
  companyName: string;
  companyCity: string;
  companyAddress: string;
  logoUrl?: string;
  docCode: string;
}

interface LpbDisplayRow {
  rowKey: string;
  itemNumber: number | null; // Nomor urut (1, 2, dst.), null apabila baris lanjutan nama barang panjang
  nameLine: string;          // Teks pada kolom Nama Barang
  isContinuation: boolean;   // true apabila baris ini adalah terusan nama barang panjang dari baris di atasnya
  condition: string;
  unit: string;
  quantity: number | string;
  batchNo: string;
  isEmptyRow: boolean;
}

const SingleLpbBlock: React.FC<SingleLpbBlockProps> = ({
  lpb,
  users,
  copyLabel,
  copyBadgeColor,
  paperCopyColorNote,
  formatShortDate,
  lpbAdminStamp,
  lpbHeadStamp,
  showDigitalStamp = true,
  isCompact = true,
  isSideBySide = false,
  companyName,
  companyCity,
  companyAddress,
  logoUrl,
  docCode,
}) => {
  const badgeClasses = {
    blue: 'border-blue-900 bg-blue-50 text-blue-900',
    emerald: 'border-emerald-900 bg-emerald-50 text-emerald-900',
  }[copyBadgeColor];

  const lpbAdminAccount = resolveSignerAccount(users, {
    id: lpb.receivedByAdminId,
    username: lpb.receivedByAdminUsername,
    name: lpb.receivedByAdmin,
    fallbackRole: 'admin',
  });
  const lpbHeadAccount = resolveSignerAccount(users, {
    id: lpb.approvedByWarehouseHeadId,
    username: lpb.approvedByWarehouseHeadUsername,
    name: lpb.approvedByWarehouseHead || lpb.verifiedBy,
    fallbackRole: 'kepala_gudang',
  });
  const isLpbApproved = lpb.status === 'APPROVED';

  // Batas karakter per baris pada kolom Nama Barang:
  // Pada mode A5 (A4 dibagi 2 Kanan & Kiri), setiap > 27 karakter otomatis diteruskan ke baris bawahnya
  const maxCharsPerNameLine = isSideBySide ? 27 : isCompact ? 42 : 56;

  // Jumlah baris ke bawah mengikuti tinggi kertas A5 (16 baris penuh ke bawah)
  const targetPaperRows = isSideBySide ? 16 : isCompact ? 10 : 14;

  // Susun baris item: apabila nama barang panjang, teruskan ke kolom bawahnya dan otomatis nomor 2 turun
  const itemDisplayRows: LpbDisplayRow[] = [];
  lpb.items.forEach((item, idx) => {
    const wrappedNameLines = wrapTextToLines(item.itemName, maxCharsPerNameLine);
    wrappedNameLines.forEach((lineText, lineIdx) => {
      if (lineIdx === 0) {
        itemDisplayRows.push({
          rowKey: `lpb-item-${idx}-line-0`,
          itemNumber: idx + 1,
          nameLine: lineText,
          isContinuation: false,
          condition: item.condition || 'Baik',
          unit: item.unit || 'Pcs',
          quantity: item.quantity,
          batchNo: item.batchNo || '-',
          isEmptyRow: false,
        });
      } else {
        // Baris lanjutan untuk nama barang panjang ("teruskan kolom bawahnya")
        itemDisplayRows.push({
          rowKey: `lpb-item-${idx}-line-${lineIdx}`,
          itemNumber: null, // Kosong agar nomor berikutnya otomatis turun ke baris di bawahnya
          nameLine: lineText,
          isContinuation: true,
          condition: '',
          unit: '',
          quantity: '',
          batchNo: '',
          isEmptyRow: false,
        });
      }
    });
  });

  // Sisa baris kosong untuk memenuhi kertas sampai ke bawah ("Full kan bawah, jumlah kolom ke bawah mengikuti kertas")
  // Nomor pada baris kosong melanjutkan nomor item terakhir sehingga otomatis turun mengikuti jumlah baris lanjutan
  const emptyRowCount = Math.max(0, targetPaperRows - itemDisplayRows.length);
  const allLpbRows: LpbDisplayRow[] = [...itemDisplayRows];
  for (let emptyIdx = 0; emptyIdx < emptyRowCount; emptyIdx++) {
    allLpbRows.push({
      rowKey: `lpb-empty-${emptyIdx}`,
      itemNumber: lpb.items.length + emptyIdx + 1,
      nameLine: '',
      isContinuation: false,
      condition: '',
      unit: '',
      quantity: '',
      batchNo: '',
      isEmptyRow: true,
    });
  }

  return (
    <div className="bg-white text-slate-900 select-text flex flex-col h-full justify-between">
      {/* BAGIAN ATAS: HEADER + JUDUL + META GRID */}
      <div>
        {/* Header LPB: Logo, Nama Perusahaan, Form Code, Tanggal, No. LPB */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-1.5 mb-1 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo"
                className={
                  isSideBySide
                    ? 'w-8 h-8 object-contain shrink-0'
                    : 'w-9 h-9 object-contain shrink-0'
                }
              />
            ) : (
              <AapSproutLogo className={isSideBySide ? 'w-8 h-8' : 'w-9 h-9'} />
            )}
            <div className="min-w-0">
              <h1
                className={`${
                  isSideBySide
                    ? 'text-[11px]'
                    : isCompact
                    ? 'text-xs sm:text-sm'
                    : 'text-sm sm:text-base'
                } font-extrabold text-slate-900 tracking-tight leading-tight uppercase truncate`}
              >
                {companyName}
              </h1>
              <p className="text-[9px] font-bold text-slate-700 truncate">
                {companyCity} &middot;{' '}
                {companyAddress ? companyAddress.split(',')[0] : 'Jawa Timur'}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="flex items-center justify-end gap-1 mb-0.5 flex-wrap">
              <span
                className={`inline-block border px-1.5 py-0.2 font-bold text-[7.5px] uppercase tracking-wider rounded-xs ${badgeClasses}`}
              >
                {copyLabel}
              </span>
              <div className="inline-block border border-slate-900 px-1 py-0.2 font-bold text-[8px] font-mono text-slate-900 tracking-wider bg-slate-50">
                {docCode || 'FR/AAP/G-LPB/23/002'}
              </div>
            </div>
            <div className="text-[9px] space-y-0.2 font-mono">
              <div className="flex justify-end gap-1">
                <span className="text-slate-600 font-sans font-medium">Tanggal :</span>
                <span className="font-bold text-slate-900">
                  {formatShortDate(lpb.receivedDate)}
                </span>
              </div>
              <div className="flex justify-end gap-1">
                <span className="text-slate-600 font-sans font-medium">No. LPB :</span>
                <span className="font-bold text-slate-900 underline underline-offset-2">
                  {lpb.lpbNumber}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Document Title Center */}
        <div className="text-center my-0.5">
          <h2
            className={`${
              isSideBySide ? 'text-xs' : isCompact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'
            } font-black uppercase tracking-wider text-slate-900`}
          >
            LAPORAN PENERIMAAN BARANG (LPB)
          </h2>
          <p className="text-[7.5px] font-bold uppercase tracking-widest text-slate-700 -mt-0.5">
            GOODS RECEIPT REPORT &mdash; UKURAN A5
          </p>
        </div>

        <p className="text-[8.5px] text-slate-800 mb-1 font-medium">
          Barang - barang yang tertera di bawah ini kami terima dengan baik, sbb :
        </p>

        {/* Meta Grid LPB */}
        <div className="text-[8.5px] text-slate-900 border border-slate-900 p-1.5 mb-1.5 bg-slate-50/60">
          <div className="grid grid-cols-2 gap-x-2.5 gap-y-0.5">
            <div className="flex items-baseline min-w-0">
              <span className="w-16 text-slate-700 shrink-0 font-medium">No. PO</span>
              <span className="mr-1 font-bold">:</span>
              <span className="font-mono font-semibold text-slate-900 border-b border-dotted border-slate-600 flex-1 truncate">
                {lpb.poNumber || '-'}
              </span>
            </div>

            <div className="flex items-baseline min-w-0">
              <span className="w-18 text-slate-700 shrink-0 font-medium">No. SJ</span>
              <span className="mr-1 font-bold">:</span>
              <span className="font-mono font-bold text-slate-900 border-b border-dotted border-slate-600 flex-1 truncate">
                {lpb.sjNumber}
              </span>
            </div>

            <div className="flex items-baseline min-w-0">
              <span className="w-16 text-slate-700 shrink-0 font-medium">Supplier</span>
              <span className="mr-1 font-bold">:</span>
              <span className="font-semibold text-slate-900 border-b border-dotted border-slate-600 flex-1 truncate">
                {lpb.supplierName}
              </span>
            </div>

            <div className="flex items-baseline min-w-0">
              <span className="w-18 text-slate-700 shrink-0 font-medium">Sopir / Plat</span>
              <span className="mr-1 font-bold">:</span>
              <span className="text-slate-800 border-b border-dotted border-slate-600 flex-1 truncate">
                {lpb.driverName || 'Ekspedisi'} {lpb.vehiclePlate ? `(${lpb.vehiclePlate})` : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* BAGIAN TENGAH (FLEX-1 FULL KE BAWAH): TABEL BARANG LPB */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="border border-slate-900 flex-1 flex flex-col overflow-hidden">
          <table className="w-full h-full border-collapse text-[9px]">
            <thead>
              <tr className="border-b border-slate-900 bg-slate-100 font-bold text-slate-900 text-center uppercase text-[8px] h-5.5">
                <th className="border-r border-slate-900 py-0.5 px-1 w-6 text-center">No</th>
                <th className="border-r border-slate-900 py-0.5 px-1.5 text-left">
                  Nama Barang
                </th>
                <th className="border-r border-slate-900 py-0.5 px-1 w-12 text-center">
                  Kualitas
                </th>
                <th className="border-r border-slate-900 py-0.5 px-1 w-11 text-center">
                  Satuan
                </th>
                <th className="border-r border-slate-900 py-0.5 px-1 w-11 text-center">
                  Jumlah
                </th>
                <th className="py-0.5 px-1 w-18 text-center">No. Lot/Batch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {allLpbRows.map((row) => (
                <tr
                  key={row.rowKey}
                  className={`h-5.5 ${
                    row.isEmptyRow ? 'text-slate-400' : 'text-slate-900'
                  }`}
                >
                  {/* Kolom No: Kosong jika baris lanjutan nama barang panjang, sehingga nomor 2 otomatis turun */}
                  <td
                    className={`border-r border-slate-900 px-1 text-center tabular-nums ${
                      row.isEmptyRow ? 'font-mono text-slate-400' : 'font-bold text-slate-900'
                    }`}
                  >
                    {row.itemNumber !== null ? row.itemNumber : '\u00A0'}
                  </td>

                  {/* Kolom Nama Barang: Jika panjang diteruskan ke baris bawahnya */}
                  <td className="border-r border-slate-900 px-1.5 font-semibold whitespace-nowrap">
                    {row.nameLine || '\u00A0'}
                  </td>

                  {/* Kolom Kualitas */}
                  <td className="border-r border-slate-900 px-1 text-center font-medium whitespace-nowrap">
                    {row.condition || '\u00A0'}
                  </td>

                  {/* Kolom Satuan */}
                  <td className="border-r border-slate-900 px-1 text-center font-medium whitespace-nowrap">
                    {row.unit || '\u00A0'}
                  </td>

                  {/* Kolom Jumlah */}
                  <td className="border-r border-slate-900 px-1 text-center font-bold font-mono tabular-nums whitespace-nowrap">
                    {row.quantity !== '' ? row.quantity : '\u00A0'}
                  </td>

                  {/* Kolom No. Lot/Batch */}
                  <td className="px-1 text-center font-mono text-[8px] text-slate-700 truncate">
                    {row.batchNo || '\u00A0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BAGIAN BAWAH (MENEMPEL PENUH DI BAWAH TABEL SAMPAI UJUNG BAWAH KERTAS A5) */}
      <div>
        {/* Usage Purpose & Storage Location Box */}
        <div className="border border-slate-900 border-t-0 p-1.5 text-[8.5px] bg-white text-slate-900">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-baseline min-w-0">
              <span className="shrink-0 text-slate-700 font-medium">Untuk :</span>
              <span className="ml-1 font-semibold border-b border-dotted border-slate-600 flex-1 truncate">
                {lpb.usagePurpose || lpb.notes || 'Persediaan Gudang & Produksi'}
              </span>
            </div>
            <div className="flex items-baseline min-w-0">
              <span className="shrink-0 text-slate-700 font-medium">Rak Simpan :</span>
              <span className="ml-1 font-mono font-bold text-slate-950 border-b border-dotted border-slate-600 flex-1 truncate">
                {lpb.storageLocation || 'Rak A-01 (Gudang Utama)'}
              </span>
            </div>
          </div>
        </div>

        {/* 3 KOLOM TANDA TANGAN LPB (Dengan Nama Akun & ID Akun Dinamis) */}
        <div className="border border-slate-900 border-t-0 text-slate-900 bg-white">
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr className="border-b border-slate-900 font-bold text-center bg-slate-100 uppercase text-[8px]">
                <th className="border-r border-slate-900 py-0.5 px-1.5 w-1/3">
                  Pengirim / Sopir,
                </th>
                <th className="border-r border-slate-900 py-0.5 px-1.5 w-1/3">
                  Diperiksa Oleh (Admin Store),
                </th>
                <th className="py-0.5 px-1.5 w-1/3">Disetujui Oleh (Kepala Store),</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {/* 1. Pengirim / Sopir (Manual) */}
                <td className="border-r border-slate-900 p-1 text-center align-bottom h-20">
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center">
                      <span className="text-[7px] text-slate-400 italic select-none">
                        ( Tanda Tangan Basah )
                      </span>
                    </div>
                    <div className="w-full pt-0.5 border-t border-dotted border-slate-400">
                      <div className="font-bold text-[8px] text-slate-900 truncate">
                        ( {lpb.driverName || '............................'} )
                      </div>
                      <div className="text-[7px] text-slate-500 font-medium">
                        Pengirim / Ekspedisi
                      </div>
                    </div>
                  </div>
                </td>

                {/* 2. Diperiksa Oleh (Admin Store — TTD Digital berdasarkan ID Akun & Nama Akun) */}
                <td className="border-r border-slate-900 p-1 text-center align-bottom h-20">
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center p-0.5">
                      {showDigitalStamp ? (
                        <DigitalAccStamp
                          badge="TTD DIGITAL"
                          title="ADMIN STORE"
                          signerName={lpbAdminAccount.name}
                          accountId={lpbAdminAccount.id}
                          accountUsername={lpbAdminAccount.username}
                          date={lpbAdminStamp.date}
                          time={lpbAdminStamp.time}
                          colorScheme="blue"
                          compact={true}
                        />
                      ) : (
                        <span className="text-[7px] text-slate-400 italic select-none">
                          ( Tanda Tangan )
                        </span>
                      )}
                    </div>
                    <div className="w-full pt-0.5 border-t border-dotted border-slate-400">
                      <div className="font-bold text-[8px] text-slate-900 truncate">
                        ( {lpbAdminAccount.name} )
                      </div>
                      {(lpbAdminAccount.username !== '-' || lpbAdminAccount.id !== '-') && (
                        <div className="text-[6.5px] font-mono text-slate-600 truncate">
                          {lpbAdminAccount.username !== '-' ? `@${lpbAdminAccount.username}` : ''}
                          {lpbAdminAccount.username !== '-' && lpbAdminAccount.id !== '-'
                            ? ' • '
                            : ''}
                          {lpbAdminAccount.id !== '-' ? `ID: ${lpbAdminAccount.id}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* 3. Disetujui Oleh (Kepala Store — TTD Digital berdasarkan ID Akun & Nama Akun) */}
                <td className="p-1 text-center align-bottom h-20">
                  <div className="flex flex-col justify-between items-center h-full">
                    <div className="flex-1 w-full flex items-center justify-center p-0.5">
                      {showDigitalStamp && isLpbApproved ? (
                        <DigitalAccStamp
                          badge="TTD DIGITAL"
                          title="ACC LPB - KA. STORE"
                          signerName={lpbHeadAccount.name}
                          accountId={lpbHeadAccount.id}
                          accountUsername={lpbHeadAccount.username}
                          date={lpbHeadStamp.date}
                          time={lpbHeadStamp.time}
                          colorScheme="emerald"
                          compact={true}
                        />
                      ) : (
                        <span className="text-[7px] text-slate-400 italic select-none">
                          {isLpbApproved ? '( Tanda Tangan )' : '( Menunggu ACC Ka. Store )'}
                        </span>
                      )}
                    </div>
                    <div className="w-full pt-0.5 border-t border-dotted border-slate-400">
                      <div className="font-bold text-[8px] text-slate-900 truncate">
                        ( {isLpbApproved ? lpbHeadAccount.name : '............................'} )
                      </div>
                      {isLpbApproved &&
                        (lpbHeadAccount.username !== '-' || lpbHeadAccount.id !== '-') && (
                          <div className="text-[6.5px] font-mono text-slate-600 truncate">
                            {lpbHeadAccount.username !== '-' ? `@${lpbHeadAccount.username}` : ''}
                            {lpbHeadAccount.username !== '-' && lpbHeadAccount.id !== '-'
                              ? ' • '
                              : ''}
                            {lpbHeadAccount.id !== '-' ? `ID: ${lpbHeadAccount.id}` : ''}
                          </div>
                        )}
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Paper Copies Footnote */}
        <div className="flex items-center justify-between text-[7.5px] font-semibold text-slate-800 mt-1 px-0.5">
          <div className="flex items-center gap-3">
            <span>Putih : Arsip Store</span>
            <span>Kuning : Purchasing</span>
          </div>
          <div className="text-[7px] text-slate-500 font-mono italic truncate">
            {paperCopyColorNote}
          </div>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// MAIN EXPORT MODAL COMPONENT
// =========================================================================
export const PrintDocumentModal: React.FC<PrintDocumentModalProps> = ({
  documentData,
  onClose,
}) => {
  const { companyProfile, users } = useInventory();
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Default layout sesuai ketentuan:
  // - LPB: 'landscape-side' (Ukuran A5, Kertas A4 mode Landscape jadi 2 Kiri-Kanan: Arsip Store & Purchasing)
  // - SIV: 'portrait-stack' (Ukuran A5, Kertas A4 mode Portrait jadi 2 Atas-Bawah: Arsip Store & Penerima Barang)
  const [layoutMode, setLayoutMode] = useState<
    'landscape-side' | 'landscape-single' | 'portrait-stack'
  >(documentData?.type === 'LPB' ? 'landscape-side' : 'portrait-stack');

  useEffect(() => {
    if (documentData?.type === 'LPB') {
      setLayoutMode('landscape-side');
    } else if (documentData?.type === 'NPB') {
      setLayoutMode('portrait-stack');
    }
  }, [documentData?.type, documentData?.doc]);

  // Default: Tampilkan TTD Digital dengan Nama Akun, ID Akun, Tanggal & Waktu
  const [showDigitalStamp, setShowDigitalStamp] = useState(true);

  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!documentData) return null;

  const { type, doc } = documentData;
  const isLPB = type === 'LPB';
  const lpb = isLPB ? (doc as LPBDocument) : null;
  const npb = !isLPB ? (doc as IssueVoucherDocument) : null;

  const isLandscape = layoutMode === 'landscape-side' || layoutMode === 'landscape-single';

  const docTitle = isLPB
    ? `LPB_A5_KiriKanan_${lpb?.lpbNumber}`
    : `SIV_A5_AtasBawah_${npb?.voucherNumber}`;

  const handlePrint = () => {
    if (printAreaRef.current) {
      printElementDirectly(
        printAreaRef.current,
        docTitle,
        isLandscape ? 'landscape' : 'portrait'
      );
    } else {
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (!printAreaRef.current || isExporting) return;
    setIsExporting(true);
    setExportNotice(null);

    const suffix =
      layoutMode === 'landscape-side'
        ? 'A5_A4_LANDSCAPE_KIRI_KANAN'
        : layoutMode === 'landscape-single'
        ? 'A4_LANDSCAPE'
        : 'A5_A4_PORTRAIT_ATAS_BAWAH';

    const safeFilename = isLPB
      ? `LPB_${lpb?.lpbNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${suffix}.pdf`
      : `NOTA_SIV_${npb?.voucherNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${suffix}.pdf`;

    const result = await exportElementToPdf(printAreaRef.current, {
      filename: safeFilename,
      title: docTitle,
      orientation: isLandscape ? 'landscape' : 'portrait',
      format: 'a4',
      marginMm: 4,
      fitFullHeight: layoutMode === 'landscape-side' || layoutMode === 'portrait-stack',
    });

    setIsExporting(false);

    if (result.success) {
      setExportNotice(
        isLPB
          ? 'File PDF LPB Ukuran A5 (Kertas A4 Landscape 2 Kiri-Kanan: Arsip Store & Purchasing) berhasil diunduh!'
          : 'File PDF SIV Ukuran A5 (Kertas A4 Portrait 2 Atas-Bawah: Arsip Store & Penerima Barang) berhasil diunduh!'
      );
      setTimeout(() => setExportNotice(null), 4000);
    } else {
      setExportNotice(result.error || 'Gagal membuat file PDF. Silakan coba kembali.');
      setTimeout(() => setExportNotice(null), 5000);
    }
  };

  const formatShortDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = String(d.getFullYear()).slice(-2);
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  // Format DD/MM/YYYY sesuai foto fisik SIV ("17/10/2026")
  const formatFullDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const formatDigitalAccTimestamp = (
    timestamp?: string,
    fallbackDate?: string,
    defaultHour = 9,
    defaultMinute = 15
  ) => {
    let dateObj: Date | null = null;
    if (timestamp) {
      const parsed = new Date(timestamp);
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
      }
    }
    if (!dateObj && fallbackDate) {
      const parsed = new Date(fallbackDate);
      if (!isNaN(parsed.getTime())) {
        dateObj = parsed;
        if (!fallbackDate.includes('T') && !fallbackDate.includes(':')) {
          dateObj.setHours(defaultHour, defaultMinute, 0, 0);
        }
      }
    }
    if (!dateObj) {
      dateObj = new Date();
    }

    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = dateObj.getFullYear();
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const seconds = String(dateObj.getSeconds()).padStart(2, '0');

    return {
      date: `${day}/${month}/${year}`,
      time: `${hours}:${minutes}:${seconds} WIB`,
      shortTime: `${hours}:${minutes} WIB`,
    };
  };

  const reqApprovalStamp = formatDigitalAccTimestamp(
    npb?.createdAt || npb?.requestDate,
    npb?.requestDate,
    9,
    30
  );

  const handoverStamp = formatDigitalAccTimestamp(
    npb?.handoverAt || npb?.approvedAt || npb?.updatedAt || npb?.createdAt,
    npb?.requestDate,
    14,
    25
  );

  const whLeaderStamp = formatDigitalAccTimestamp(
    npb?.headApprovedAt || npb?.approvedAt || npb?.updatedAt || npb?.createdAt,
    npb?.requestDate,
    11,
    15
  );

  const lpbAdminStamp = formatDigitalAccTimestamp(
    lpb?.adminValidatedAt || lpb?.createdAt || lpb?.receivedDate,
    lpb?.receivedDate,
    10,
    15
  );

  const lpbHeadStamp = formatDigitalAccTimestamp(
    lpb?.approvedAt || lpb?.createdAt || lpb?.receivedDate,
    lpb?.receivedDate,
    13,
    45
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="print-modal-container relative w-full max-w-6xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-3 sm:my-6 max-h-[94vh] flex flex-col">
        {/* Top Control Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-slate-900 text-white shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2 truncate mr-2">
            <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="truncate">
              <span className="font-semibold text-xs sm:text-sm block truncate">
                Pratinjau Cetak &amp; Ekspor PDF:{' '}
                {isLPB ? `LPB (${lpb?.lpbNumber})` : `Nota SIV (${npb?.voucherNumber})`}
              </span>
              <span className="text-[10px] text-slate-300 hidden sm:block">
                {companyProfile.companyName || 'PT. Abadi Agrosindo Persada'} &middot;{' '}
                {isLPB
                  ? 'Ukuran A5, Kertas A4 Landscape jadi 2 Kiri-Kanan (Arsip Store & Purchasing)'
                  : 'Ukuran A5, Kertas A4 Portrait jadi 2 Atas-Bawah (Arsip Store & Penerima Barang)'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Toggle Stempel ACC Digital */}
            <button
              type="button"
              onClick={() => setShowDigitalStamp((prev) => !prev)}
              className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                showDigitalStamp
                  ? 'bg-blue-600/20 border-blue-400 text-blue-200'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Tampilkan atau sembunyikan TTD Digital (Nama Akun, ID Akun, Tanggal & Jam)"
            >
              <Stamp className="w-3.5 h-3.5" />
              <span>{showDigitalStamp ? 'TTD Digital: Aktif' : 'TTD Polos (Tanpa Stempel)'}</span>
            </button>

            {/* Layout Mode Switcher */}
            <div className="flex items-center bg-slate-800 p-0.5 rounded-lg border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setLayoutMode('landscape-side')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
                  layoutMode === 'landscape-side'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Ukuran A5 (Kertas A4 Landscape jadi 2 Kiri-Kanan)"
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>A5 Kiri-Kanan (A4 Landscape)</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('portrait-stack')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1.5 ${
                  layoutMode === 'portrait-stack'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Ukuran A5 (Kertas A4 Portrait jadi 2 Atas-Bawah)"
              >
                <Rows2 className="w-3.5 h-3.5" />
                <span>A5 Atas-Bawah (A4 Portrait)</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('landscape-single')}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
                  layoutMode === 'landscape-single'
                    ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="1 Tabel Lebar Penuh dalam 1 Lembar Landscape"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>1 Lembar Penuh</span>
              </button>
            </div>

            {/* Download PDF button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-700/60 rounded-lg transition-colors shadow-xs"
              title="Unduh langsung sebagai file dokumen PDF"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Membuat PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Unduh PDF</span>
                </>
              )}
            </button>

            {/* Print button */}
            <button
              onClick={handlePrint}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700 transition-colors shadow-2xs"
              title="Buka dialog cetak browser"
            >
              <Printer className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Cetak</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
              title="Tutup Pratinjau"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Download notification banner */}
        {exportNotice && (
          <div className="no-print px-4 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{exportNotice}</span>
            </div>
            <button
              onClick={() => setExportNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Informative Guidance Banner */}
        <div className="no-print px-4 sm:px-6 py-2 bg-slate-100 border-b border-slate-200 text-xs text-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span>
              {isLPB ? (
                <>
                  Format Cetak PDF <strong>LPB</strong>: Ukuran <strong>A5</strong> pada Kertas{' '}
                  <strong>A4 Mode Landscape jadi 2 Kiri-Kanan</strong> (Kiri:{' '}
                  <strong>Arsip Store</strong> &amp; Kanan: <strong>Purchasing</strong>).
                </>
              ) : (
                <>
                  Format Cetak PDF <strong>SIV</strong>: Ukuran <strong>A5</strong> pada Kertas{' '}
                  <strong>A4 Mode Portrait jadi 2 Atas-Bawah</strong> (Atas:{' '}
                  <strong>Arsip Store</strong> &amp; Bawah: <strong>Penerima Barang</strong>).
                </>
              )}
            </span>
          </div>

          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline shrink-0">
            {layoutMode === 'landscape-side'
              ? '2 × A5 Kiri-Kanan pada 1 A4 Landscape (297 × 210 mm)'
              : layoutMode === 'portrait-stack'
              ? '2 × A5 Atas-Bawah pada 1 A4 Portrait (210 × 297 mm)'
              : 'A4 Landscape (297 × 210 mm)'}
          </span>
        </div>

        {/* Printable Sheet Viewport */}
        <div className="p-3 sm:p-5 overflow-auto flex-1 bg-slate-200/80">
          <div
            ref={printAreaRef}
            className="print-container bg-white text-slate-900 shadow-md mx-auto p-2.5 sm:p-3 flex flex-col"
            style={{
              width: isLandscape ? '1080px' : '794px',
              minHeight:
                layoutMode === 'landscape-side'
                  ? '756px' // Rasio presisi A4 Landscape (2 × A5 Kiri-Kanan)
                  : layoutMode === 'portrait-stack'
                  ? '1115px' // Rasio presisi A4 Portrait (2 × A5 Atas-Bawah)
                  : '680px',
            }}
          >
            {/* =================================================================== */}
            {/* 1. NOTA PENGAMBILAN BARANG (SIV)                                    */}
            {/*    Default: Ukuran A5, Kertas A4 Mode Portrait jadi 2 Atas-Bawah    */}
            {/*    (Atas: Arsip Store & Bawah: Penerima Barang)                     */}
            {/* =================================================================== */}
            {!isLPB && npb && (
              <div className="flex-1 flex flex-col h-full">
                {layoutMode === 'landscape-side' ? (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2.5 flex-1 h-full">
                    {/* KIRI: LEMBAR 1 (ARSIP STORE) */}
                    <div className="border border-slate-900 p-2 bg-white min-w-0 flex flex-col h-full">
                      <SingleNotaBlock
                        npb={npb}
                        users={users}
                        copyLabel="LEMBAR 1 (A5) : ARSIP STORE"
                        copyBadgeColor="blue"
                        paperCopyColorNote="Lembar 1 (A5): Arsip Store"
                        formatFullDate={formatFullDate}
                        reqApprovalStamp={reqApprovalStamp}
                        handoverStamp={handoverStamp}
                        whLeaderStamp={whLeaderStamp}
                        isSideBySide={true}
                        showDigitalStamp={showDigitalStamp}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.sivDocCode || 'FR/AAP/G-STR/23/001'}
                      />
                    </div>

                    {/* GARIS POTONG VERTIKAL TENGAH */}
                    <div className="flex flex-col items-center justify-between py-2 px-0.5 border-l border-r border-dashed border-slate-400 bg-slate-50/70 select-none text-slate-500">
                      <Scissors className="w-3.5 h-3.5 text-slate-600 rotate-90" />
                      <span
                        className="text-[7.5px] font-mono font-bold uppercase tracking-widest text-slate-500"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                      >
                        GARIS POTONG A5 &mdash; KIRI : ARSIP STORE &amp; KANAN : PENERIMA BARANG
                      </span>
                      <Scissors className="w-3.5 h-3.5 text-slate-600 -rotate-90" />
                    </div>

                    {/* KANAN: LEMBAR 2 (PENERIMA BARANG) */}
                    <div className="border border-slate-900 p-2 bg-white min-w-0 flex flex-col h-full">
                      <SingleNotaBlock
                        npb={npb}
                        users={users}
                        copyLabel="LEMBAR 2 (A5) : PENERIMA BARANG"
                        copyBadgeColor="emerald"
                        paperCopyColorNote="Lembar 2 (A5): Penerima Barang"
                        formatFullDate={formatFullDate}
                        reqApprovalStamp={reqApprovalStamp}
                        handoverStamp={handoverStamp}
                        whLeaderStamp={whLeaderStamp}
                        isSideBySide={true}
                        showDigitalStamp={showDigitalStamp}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.sivDocCode || 'FR/AAP/G-STR/23/001'}
                      />
                    </div>
                  </div>
                ) : layoutMode === 'landscape-single' ? (
                  <div className="border border-slate-900 p-4 bg-white flex-1 flex flex-col h-full">
                    <SingleNotaBlock
                      npb={npb}
                      users={users}
                      copyLabel="ARSIP STORE & PENERIMA BARANG"
                      copyBadgeColor="blue"
                      paperCopyColorNote="Lembar Resmi Store & Penerima Barang"
                      formatFullDate={formatFullDate}
                      reqApprovalStamp={reqApprovalStamp}
                      handoverStamp={handoverStamp}
                      whLeaderStamp={whLeaderStamp}
                      isSideBySide={false}
                      showDigitalStamp={showDigitalStamp}
                      companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                      companyCity={companyProfile.city || 'Sidoarjo'}
                      logoUrl={companyProfile.logoUrl}
                      docCode={companyProfile.sivDocCode || 'FR/AAP/G-STR/23/001'}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col justify-between flex-1 h-full gap-2">
                    {/* ATAS (UKURAN A5): LEMBAR 1 — ARSIP STORE */}
                    <div className="border border-slate-900 p-2.5 bg-white flex-1 flex flex-col">
                      <SingleNotaBlock
                        npb={npb}
                        users={users}
                        copyLabel="LEMBAR 1 (A5) : ARSIP STORE"
                        copyBadgeColor="blue"
                        paperCopyColorNote="Lembar 1 (Atas - A5): Arsip Store"
                        formatFullDate={formatFullDate}
                        reqApprovalStamp={reqApprovalStamp}
                        handoverStamp={handoverStamp}
                        whLeaderStamp={whLeaderStamp}
                        isSideBySide={false}
                        showDigitalStamp={showDigitalStamp}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.sivDocCode || 'FR/AAP/G-STR/23/001'}
                      />
                    </div>

                    {/* Garis Potong Tengah (Pembagi A4 Portrait menjadi 2 Lembar A5 Atas-Bawah) */}
                    <div className="py-0.5 flex items-center justify-center text-slate-500 text-[8.5px] font-mono border-t border-b border-dashed border-slate-400 bg-slate-50 select-none">
                      <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-slate-600">
                        <Scissors className="w-3 h-3 text-slate-600" />
                        <span>
                          GARIS POTONG A5 &mdash; ATAS : ARSIP STORE &amp; BAWAH : PENERIMA BARANG
                        </span>
                        <Scissors className="w-3 h-3 text-slate-600" />
                      </div>
                    </div>

                    {/* BAWAH (UKURAN A5): LEMBAR 2 — PENERIMA BARANG */}
                    <div className="border border-slate-900 p-2.5 bg-white flex-1 flex flex-col">
                      <SingleNotaBlock
                        npb={npb}
                        users={users}
                        copyLabel="LEMBAR 2 (A5) : PENERIMA BARANG"
                        copyBadgeColor="emerald"
                        paperCopyColorNote="Lembar 2 (Bawah - A5): Penerima Barang"
                        formatFullDate={formatFullDate}
                        reqApprovalStamp={reqApprovalStamp}
                        handoverStamp={handoverStamp}
                        whLeaderStamp={whLeaderStamp}
                        isSideBySide={false}
                        showDigitalStamp={showDigitalStamp}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.sivDocCode || 'FR/AAP/G-STR/23/001'}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* =================================================================== */}
            {/* 2. LAPORAN PENERIMAAN BARANG (LPB)                                  */}
            {/*    Default: Ukuran A5, Kertas A4 Mode Landscape jadi 2 Kiri-Kanan   */}
            {/*    (Kiri: Arsip Store & Kanan: Purchasing)                          */}
            {/* =================================================================== */}
            {isLPB && lpb && (
              <div className="flex-1 flex flex-col h-full">
                {layoutMode === 'landscape-side' ? (
                  <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 flex-1 h-full">
                    {/* KIRI (UKURAN A5 FULL BAWAH): LEMBAR 1 — ARSIP STORE */}
                    <div className="border border-slate-900 p-2.5 bg-white min-w-0 flex flex-col h-full">
                      <SingleLpbBlock
                        lpb={lpb}
                        users={users}
                        copyLabel="LEMBAR 1 (A5) : ARSIP STORE"
                        copyBadgeColor="blue"
                        paperCopyColorNote="Lembar 1 (Kiri - A5): Arsip Store"
                        formatShortDate={formatShortDate}
                        lpbAdminStamp={lpbAdminStamp}
                        lpbHeadStamp={lpbHeadStamp}
                        showDigitalStamp={showDigitalStamp}
                        isCompact={true}
                        isSideBySide={true}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        companyAddress={
                          companyProfile.address || 'Kawasan Industri Pergudangan'
                        }
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.lpbDocCode || 'FR/AAP/G-LPB/23/002'}
                      />
                    </div>

                    {/* GARIS POTONG VERTIKAL TENGAH (PEMBAGI A4 LANDSCAPE MENJADI 2 LEMBAR A5 KIRI-KANAN) */}
                    <div className="flex flex-col items-center justify-between py-2 px-0.5 border-l border-r border-dashed border-slate-400 bg-slate-50/70 select-none text-slate-500">
                      <Scissors className="w-3.5 h-3.5 text-slate-600 rotate-90" />
                      <span
                        className="text-[7.5px] font-mono font-bold uppercase tracking-widest text-slate-600"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                      >
                        GARIS POTONG A5 &mdash; KIRI : ARSIP STORE &amp; KANAN : PURCHASING
                      </span>
                      <Scissors className="w-3.5 h-3.5 text-slate-600 -rotate-90" />
                    </div>

                    {/* KANAN (UKURAN A5 FULL BAWAH): LEMBAR 2 — PURCHASING */}
                    <div className="border border-slate-900 p-2.5 bg-white min-w-0 flex flex-col h-full">
                      <SingleLpbBlock
                        lpb={lpb}
                        users={users}
                        copyLabel="LEMBAR 2 (A5) : PURCHASING"
                        copyBadgeColor="emerald"
                        paperCopyColorNote="Lembar 2 (Kanan - A5): Purchasing"
                        formatShortDate={formatShortDate}
                        lpbAdminStamp={lpbAdminStamp}
                        lpbHeadStamp={lpbHeadStamp}
                        showDigitalStamp={showDigitalStamp}
                        isCompact={true}
                        isSideBySide={true}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        companyAddress={
                          companyProfile.address || 'Kawasan Industri Pergudangan'
                        }
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.lpbDocCode || 'FR/AAP/G-LPB/23/002'}
                      />
                    </div>
                  </div>
                ) : layoutMode === 'landscape-single' ? (
                  <div className="border border-slate-900 p-4 bg-white flex-1 flex flex-col h-full">
                    <SingleLpbBlock
                      lpb={lpb}
                      users={users}
                      copyLabel="ARSIP STORE & PURCHASING (A4 LANDSCAPE)"
                      copyBadgeColor="blue"
                      paperCopyColorNote="1 Lembar A4 Landscape Resmi Store PT. Abadi Agrosindo Persada"
                      formatShortDate={formatShortDate}
                      lpbAdminStamp={lpbAdminStamp}
                      lpbHeadStamp={lpbHeadStamp}
                      showDigitalStamp={showDigitalStamp}
                      isCompact={false}
                      isSideBySide={false}
                      companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                      companyCity={companyProfile.city || 'Sidoarjo'}
                      companyAddress={
                        companyProfile.address || 'Kawasan Industri Pergudangan'
                      }
                      logoUrl={companyProfile.logoUrl}
                      docCode={companyProfile.lpbDocCode || 'FR/AAP/G-LPB/23/002'}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col justify-between flex-1 h-full gap-2">
                    {/* LEMBAR 1: ARSIP STORE */}
                    <div className="border border-slate-900 p-2.5 sm:p-3 bg-white flex-1 flex flex-col">
                      <SingleLpbBlock
                        lpb={lpb}
                        users={users}
                        copyLabel="LEMBAR 1 (A5) : ARSIP STORE"
                        copyBadgeColor="blue"
                        paperCopyColorNote="Lembar 1 (Atas - A5): Arsip Store"
                        formatShortDate={formatShortDate}
                        lpbAdminStamp={lpbAdminStamp}
                        lpbHeadStamp={lpbHeadStamp}
                        showDigitalStamp={showDigitalStamp}
                        isCompact={true}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        companyAddress={
                          companyProfile.address || 'Kawasan Industri Pergudangan'
                        }
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.lpbDocCode || 'FR/AAP/G-LPB/23/002'}
                      />
                    </div>

                    {/* Perforated Cutting Line */}
                    <div className="py-0.5 flex items-center justify-center text-slate-500 text-[9px] font-mono border-t border-b border-dashed border-slate-400 bg-slate-50 select-none">
                      <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-slate-600">
                        <Scissors className="w-3 h-3 text-slate-600" />
                        <span>
                          GARIS POTONG A5 &mdash; ATAS : ARSIP STORE &amp; BAWAH : PURCHASING
                        </span>
                        <Scissors className="w-3 h-3 text-slate-600" />
                      </div>
                    </div>

                    {/* LEMBAR 2: PURCHASING */}
                    <div className="border border-slate-900 p-2.5 sm:p-3 bg-white flex-1 flex flex-col">
                      <SingleLpbBlock
                        lpb={lpb}
                        users={users}
                        copyLabel="LEMBAR 2 (A5) : PURCHASING"
                        copyBadgeColor="emerald"
                        paperCopyColorNote="Lembar 2 (Bawah - A5): Purchasing"
                        formatShortDate={formatShortDate}
                        lpbAdminStamp={lpbAdminStamp}
                        lpbHeadStamp={lpbHeadStamp}
                        showDigitalStamp={showDigitalStamp}
                        isCompact={true}
                        companyName={companyProfile.companyName || 'PT. Abadi Agrosindo Persada'}
                        companyCity={companyProfile.city || 'Sidoarjo'}
                        companyAddress={
                          companyProfile.address || 'Kawasan Industri Pergudangan'
                        }
                        logoUrl={companyProfile.logoUrl}
                        docCode={companyProfile.lpbDocCode || 'FR/AAP/G-LPB/23/002'}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="no-print px-6 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Tutup Pratinjau
          </button>
        </div>
      </div>
    </div>
  );
};
