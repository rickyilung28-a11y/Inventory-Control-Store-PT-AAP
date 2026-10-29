/**
 * Safe APK & Universal Mobile App (Android / iOS) Downloader
 * Uses authenticated in-app fetch() + Blob AND Public Cloud Mirror (ntfy.sh)
 * so NO device (Android or iOS) ever hits a Google 403 error page!
 */

export interface ApkBundleResponse {
  fileName: string;
  packageName: string;
  versionName: string;
  versionCode: number;
  sizeBytes: number;
  sha256: string;
  base64: string;
  launcherHtml: string;
  sharedAppUrl: string;
  publicApkUrl?: string;
  publicHtmlUrl?: string;
}

export async function downloadApkSafely(
  onProgress?: (status: string) => void
): Promise<{
  success: boolean;
  fileName?: string;
  publicApkUrl?: string;
  publicHtmlUrl?: string;
  error?: string;
}> {
  try {
    onProgress?.('Menyiapkan paket instalasi Android (.APK v3.0) bebas 403...');
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(`/api/apk/bundle?origin=${encodeURIComponent(origin)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'same-origin',
    });

    if (!res.ok) {
      throw new Error(`Gagal mengambil paket APK (HTTP ${res.status})`);
    }

    const data: ApkBundleResponse = await res.json();
    if (!data.base64) {
      throw new Error('Data biner APK kosong');
    }

    const fileName = data.fileName || 'SISTEM-INVENTORY-PT-AAP-v3.0.apk';

    // Decode Base64 to Uint8Array in memory
    const binaryStr = window.atob(data.base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const blob = new Blob([bytes], {
      type: 'application/vnd.android.package-archive',
    });

    // Trigger in-memory Blob download
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 3000);

    onProgress?.(`Berhasil mengunduh ${fileName} (Buka file untuk Install tanpa login Google)`);
    return {
      success: true,
      fileName,
      publicApkUrl: data.publicApkUrl,
      publicHtmlUrl: data.publicHtmlUrl,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengunduh APK';
    onProgress?.(msg);
    return { success: false, error: msg };
  }
}

export async function shareOrSaveApkFile(): Promise<boolean> {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(`/api/apk/bundle?origin=${encodeURIComponent(origin)}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) return false;
    const data: ApkBundleResponse = await res.json();
    const binaryStr = window.atob(data.base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const fileName = data.fileName || 'SISTEM-INVENTORY-PT-AAP-v3.0.apk';
    const file = new File([bytes], fileName, {
      type: 'application/vnd.android.package-archive',
    });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'SISTEN INVENTORY CONTROL STORE PT ABADI AGROSINDO PERSADA (.APK)',
        text: 'Paket Instalasi Android (.APK) Sistem Inventory Control Store PT Abadi Agrosindo Persada',
        files: [file],
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function downloadStandaloneHtmlAppSafely(): Promise<boolean> {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch(`/api/apk/bundle?origin=${encodeURIComponent(origin)}`, {
      credentials: 'same-origin',
    });
    if (!res.ok) return false;
    const data: ApkBundleResponse = await res.json();
    if (!data.launcherHtml) return false;

    const blob = new Blob([data.launcherHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = blobUrl;
    a.download = 'SISTEM-INVENTORY-PT-AAP-Mobile.html';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 3000);
    return true;
  } catch {
    return false;
  }
}

export function getPublicShareableOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin.replace('//ais-dev-', '//ais-pre-');
}
