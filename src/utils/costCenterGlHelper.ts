import { CostCenterEntry, GLAccountEntry } from '../types/inventory';

export type CostCenterGLCategory = 'PRD' | 'FOH' | 'GOH' | 'ALL';

/**
 * Menentukan kategori filter GL Account berdasarkan Cost Center yang dipilih:
 * - Cost Center SDA Production M1 s/d M6 -> hanya GL dengan nama akun PRD
 * - Cost Center SDA FOH -> hanya GL dengan nama akun FOH
 * - Cost Center SDA GOH / GOH -> hanya GL dengan nama akun GOH
 */
export function getCostCenterGLCategory(
  costCenterCode: string | undefined,
  costCenters: CostCenterEntry[]
): CostCenterGLCategory {
  if (!costCenterCode) return 'ALL';
  const codeClean = costCenterCode.trim();
  const cc = costCenters.find(
    (c) => c.code.trim().toLowerCase() === codeClean.toLowerCase()
  );

  const nameUpper = (cc?.name || '').toUpperCase();
  const descUpper = (cc?.description || '').toUpperCase();
  const codeUpper = (cc?.code || codeClean).toUpperCase();

  // 1. Cost Center SDA Production M1 sampai M6 -> GL dengan nama akun PRD
  if (
    /PRODUCTION\s*M[1-6]/i.test(nameUpper) ||
    nameUpper.includes('SDA PRODUCTION') ||
    nameUpper.includes('PRODUCTION') ||
    codeUpper.startsWith('AAP1034')
  ) {
    return 'PRD';
  }

  // 2. Cost Center SDA FOH -> GL dengan nama akun FOH
  if (
    /\bFOH\b/i.test(nameUpper) ||
    nameUpper.includes('SDA FOH') ||
    codeUpper.startsWith('AAP1035')
  ) {
    return 'FOH';
  }

  // 3. Cost Center SDA GOH / GOH -> GL dengan nama akun GOH
  if (
    /\bGOH\b/i.test(nameUpper) ||
    nameUpper.includes('SDA GOH') ||
    /\bGOH\b/i.test(descUpper) ||
    codeUpper.startsWith('AAP1036')
  ) {
    return 'GOH';
  }

  return 'ALL';
}

/**
 * Mengembalikan daftar GL Account yang sesuai dengan Cost Center yang dipilih.
 */
export function getFilteredGLAccountsForCostCenter(
  costCenterCode: string | undefined,
  costCenters: CostCenterEntry[],
  glAccounts: GLAccountEntry[]
): GLAccountEntry[] {
  const category = getCostCenterGLCategory(costCenterCode, costCenters);
  if (category === 'ALL') {
    return glAccounts;
  }

  const filtered = glAccounts.filter((gl) => {
    const glNameUpper = (gl.name || '').toUpperCase();
    if (category === 'PRD') {
      return /\bPRD\b/.test(glNameUpper) || glNameUpper.startsWith('PRD');
    }
    if (category === 'FOH') {
      return /\bFOH\b/.test(glNameUpper) || glNameUpper.startsWith('FOH');
    }
    if (category === 'GOH') {
      return /\bGOH\b/.test(glNameUpper) || glNameUpper.startsWith('GOH');
    }
    return true;
  });

  return filtered.length > 0 ? filtered : glAccounts;
}

/**
 * Memastikan kode GL Account valid untuk Cost Center tertentu.
 * Jika tidak termasuk dalam daftar GL yang difilter, otomatis pilih GL pertama yang sesuai.
 */
export function ensureValidGLForCostCenter(
  costCenterCode: string | undefined,
  currentGlCode: string | undefined,
  costCenters: CostCenterEntry[],
  glAccounts: GLAccountEntry[]
): string {
  const allowed = getFilteredGLAccountsForCostCenter(
    costCenterCode,
    costCenters,
    glAccounts
  );
  if (allowed.length === 0) {
    return currentGlCode || glAccounts[0]?.code || '';
  }
  if (
    currentGlCode &&
    allowed.some((g) => g.code.toLowerCase() === currentGlCode.trim().toLowerCase())
  ) {
    return currentGlCode;
  }
  return allowed[0].code;
}

/**
 * Format teks pilihan dropdown Cost Center beserta keterangannya.
 */
export function formatCostCenterDropdownLabel(cc: {
  code: string;
  name?: string;
  description?: string;
}): string {
  const name = (cc.name || '').trim();
  const desc = (cc.description || '').trim();
  if (name && desc) {
    return `${cc.code} - ${name} — Ket: ${desc}`;
  }
  const label = name || desc;
  return label ? `${cc.code} - ${label}` : cc.code;
}

/**
 * Format teks pilihan dropdown GL Account beserta keterangannya.
 */
export function formatGLAccountDropdownLabel(gl: {
  code: string;
  name?: string;
  description?: string;
}): string {
  const name = (gl.name || '').trim();
  const desc = (gl.description || '').trim();
  if (name && desc) {
    return `${gl.code} - ${name} — Ket: ${desc}`;
  }
  const label = name || desc;
  return label ? `${gl.code} - ${label}` : gl.code;
}
