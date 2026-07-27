import { CAVATALE_URL } from "@/lib/share-wine";

/** Min/max length for public_handle (must match DB check). */
export const PUBLIC_HANDLE_MIN = 3;
export const PUBLIC_HANDLE_MAX = 24;

const HANDLE_BODY =
  /^[a-z0-9][a-z0-9_-]{1,22}[a-z0-9]$/;

/** Strip @, trim, lowercase. */
export function normalizePublicHandle(input: string): string {
  let s = input.trim().toLowerCase();
  while (s.startsWith("@")) s = s.slice(1);
  return s;
}

export function isValidPublicHandle(handle: string): boolean {
  if (
    handle.length < PUBLIC_HANDLE_MIN ||
    handle.length > PUBLIC_HANDLE_MAX
  ) {
    return false;
  }
  return HANDLE_BODY.test(handle);
}

/** Spanish validation message, or null if ok. */
export function publicHandleValidationError(
  raw: string
): string | null {
  const handle = normalizePublicHandle(raw);
  if (!handle) {
    return "Elige un handle (ej. ricardo).";
  }
  if (handle.length < PUBLIC_HANDLE_MIN) {
    return `Mínimo ${PUBLIC_HANDLE_MIN} caracteres.`;
  }
  if (handle.length > PUBLIC_HANDLE_MAX) {
    return `Máximo ${PUBLIC_HANDLE_MAX} caracteres.`;
  }
  if (!HANDLE_BODY.test(handle)) {
    return "Solo letras minúsculas, números, _ o - (sin empezar ni terminar con - o _).";
  }
  return null;
}

export function buildPublicCellarPath(handle: string): string {
  return `/u/${normalizePublicHandle(handle)}`;
}

/** Absolute URL for sharing. Prefer browser origin when available. */
export function buildPublicCellarUrl(
  handle: string,
  origin?: string | null
): string {
  const path = buildPublicCellarPath(handle);
  const base = (origin?.replace(/\/$/, "") || CAVATALE_URL).replace(
    /\/$/,
    ""
  );
  return `${base}${path}`;
}

/** Normalize directory search: optional leading @. */
export function normalizeDirectoryQuery(query: string): string {
  return normalizePublicHandle(query);
}
