/**
 * Resolver untuk Link Login Publik Tetap (Persistent Tunnel / Domain Kustom)
 * Memastikan link login:
 * 1. BISA DIBUKA di semua HP/PC/Browser tanpa error 403 (tanpa harus login Google AI Studio).
 * 2. TETAP SAMA (tidak berubah) meskipun ada perubahan kode atau restart server karena proses tunnel berjalan secara detached/persisten.
 */

const LOCKED_PUBLIC_URL_KEY = 'gudang_locked_public_url_v1';
const DEFAULT_TUNNEL_URL = 'https://requires-female-troops-wheels.trycloudflare.com';

export function isAiStudioInternalUrl(url?: string | null): boolean {
  if (!url) return false;
  return url.includes('ais-pre-') || url.includes('ais-dev-');
}

export function getCachedLockedLoginUrl(): string {
  if (typeof window === 'undefined') return DEFAULT_TUNNEL_URL;
  try {
    const cached = window.localStorage.getItem(LOCKED_PUBLIC_URL_KEY);
    if (cached && cached.startsWith('http') && !isAiStudioInternalUrl(cached)) {
      return cached.replace(/\/+$/, '');
    }
  } catch {}
  return DEFAULT_TUNNEL_URL;
}

export function saveCachedLockedLoginUrl(url: string): void {
  if (typeof window === 'undefined' || !url) return;
  const clean = url.trim().replace(/\/+$/, '');
  if (!clean.startsWith('http') || isAiStudioInternalUrl(clean)) return;
  try {
    window.localStorage.setItem(LOCKED_PUBLIC_URL_KEY, clean);
  } catch {}
}

export function resolvePermanentLoginUrl(
  serverPublicUrl?: string | null,
  customPermanentUrl?: string | null
): string {
  // 1. Jika Admin mengunci domain hosting kustom publik (prioritas tertinggi & tidak pernah berubah)
  if (
    customPermanentUrl &&
    customPermanentUrl.trim().startsWith('http') &&
    !isAiStudioInternalUrl(customPermanentUrl)
  ) {
    const clean = customPermanentUrl.trim().replace(/\/+$/, '');
    saveCachedLockedLoginUrl(clean);
    return clean;
  }

  // 2. Gunakan URL Tunnel Publik Persisten dari server (/api/public-url)
  if (
    serverPublicUrl &&
    serverPublicUrl.trim().startsWith('http') &&
    !isAiStudioInternalUrl(serverPublicUrl)
  ) {
    const clean = serverPublicUrl.trim().replace(/\/+$/, '');
    saveCachedLockedLoginUrl(clean);
    return clean;
  }

  // 3. Jika sedang diakses langsung melalui domain/tunnel publik (bukan ais-dev/ais-pre)
  if (
    typeof window !== 'undefined' &&
    window.location?.origin &&
    !isAiStudioInternalUrl(window.location.origin)
  ) {
    const clean = window.location.origin.replace(/\/+$/, '');
    saveCachedLockedLoginUrl(clean);
    return clean;
  }

  // 4. Gunakan URL yang sudah dikunci di cache agar tidak berubah-ubah saat loading
  return getCachedLockedLoginUrl();
}

