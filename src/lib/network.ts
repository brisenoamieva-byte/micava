import { parseKimiPairingsBlob } from "@/lib/kimi-research";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  isValidPublicHandle,
  normalizePublicHandle,
  publicHandleValidationError,
} from "@/lib/public-handle";
import type { Wine } from "@/lib/types";

export type NetworkProfile = {
  id: string;
  display_name: string | null;
  public_handle: string | null;
  country: string | null;
  city: string | null;
  bio: string | null;
  network_visible: boolean;
  cava_public: boolean;
  network_updated_at: string | null;
  bottle_count?: number;
};

export type OwnNetworkProfile = NetworkProfile & {
  bottle_pledge?: boolean;
};

/** Safe wine fields from public_wines — never price or cellar layout. */
export type PublicWine = {
  id: string;
  user_id: string;
  country: string;
  region: string;
  type: string;
  winery: string;
  name: string;
  aging: string;
  grape: string;
  vintage: number | null;
  vivino: number | null;
  cavatale_rating: number | null;
  /** Optional story fields (migration 020). */
  kimi_summary?: string | null;
  kimi_curiosity?: string | null;
  kimi_talk_hook?: string | null;
  /** Serialized pairings blob or plain text from view. */
  kimi_pairings?: string | null;
};

const PROFILE_COLS =
  "id, display_name, public_handle, country, city, bio, network_visible, cava_public, network_updated_at";

export const PUBLIC_WINE_COLS =
  "id, user_id, country, region, type, winery, name, aging, grape, vintage, vivino, cavatale_rating, kimi_summary, kimi_curiosity, kimi_talk_hook, kimi_pairings";

/** Fallback if story columns are not migrated yet on public_wines. */
export const PUBLIC_WINE_COLS_BASIC =
  "id, user_id, country, region, type, winery, name, aging, grape, vintage, vivino, cavatale_rating";

export async function fetchOwnNetworkProfile(
  userId: string
): Promise<OwnNetworkProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as OwnNetworkProfile | null) ?? null;
}

export async function updateOwnNetworkProfile(
  userId: string,
  patch: {
    network_visible?: boolean;
    cava_public?: boolean;
    country?: string | null;
    city?: string | null;
    bio?: string | null;
    display_name?: string | null;
    public_handle?: string | null;
  }
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return {
      error: "Compartir cava no está disponible (Supabase no configurado).",
    };
  }
  const supabase = createClient();

  const country = patch.country?.trim() || null;
  const city = patch.city?.trim() || null;
  const bio = patch.bio?.trim() || null;
  if (bio && bio.length > 160) {
    return { error: "La bio admite máximo 160 caracteres." };
  }

  let public_handle: string | null | undefined = undefined;
  if ("public_handle" in patch) {
    if (patch.public_handle == null || patch.public_handle.trim() === "") {
      public_handle = null;
    } else {
      const normalized = normalizePublicHandle(patch.public_handle);
      const validation = publicHandleValidationError(normalized);
      if (validation) return { error: validation };
      public_handle = normalized;
    }
  }

  if (patch.cava_public === true) {
    const resolved =
      public_handle !== undefined ? public_handle : undefined;
    if (resolved === null) {
      return {
        error: "Con cava pública necesitas un handle (ej. @ricardo).",
      };
    }
  }

  const payload: Record<string, unknown> = {
    ...patch,
    country,
    city,
    bio,
    network_updated_at: new Date().toISOString(),
  };
  if (public_handle !== undefined) {
    payload.public_handle = public_handle;
  }

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId);

  if (error) {
    if (
      error.code === "23505" ||
      /unique|duplicate/i.test(error.message)
    ) {
      return { error: "Ese handle ya está en uso. Prueba otro." };
    }
    if (
      error.code === "23514" ||
      /public_handle|check/i.test(error.message)
    ) {
      return {
        error:
          "Handle inválido: 3–24 caracteres, solo a-z, 0-9, _ y -.",
      };
    }
    return { error: error.message };
  }
  return { error: null };
}

/** True if handle is free for the current user (RPC). */
export async function checkPublicHandleAvailable(
  desired: string
): Promise<{ available: boolean; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { available: false, error: "Supabase no configurado." };
  }
  const normalized = normalizePublicHandle(desired);
  if (!isValidPublicHandle(normalized)) {
    return { available: false, error: publicHandleValidationError(normalized) };
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc("is_public_handle_available", {
    desired: normalized,
  });
  if (error) return { available: false, error: error.message };
  return { available: Boolean(data), error: null };
}

export async function fetchPublicProfile(
  userId: string
): Promise<NetworkProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("id", userId)
    .eq("cava_public", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as NetworkProfile | null) ?? null;
}

/** Resolve /u/[handle] — only cava_public profiles. */
export async function fetchPublicProfileByHandle(
  handle: string
): Promise<NetworkProfile | null> {
  if (!isSupabaseConfigured()) return null;
  const normalized = normalizePublicHandle(handle);
  if (!isValidPublicHandle(normalized)) return null;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("public_handle", normalized)
    .eq("cava_public", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as NetworkProfile | null) ?? null;
}

export async function listPublicCellarWines(
  ownerId: string
): Promise<PublicWine[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const withStories = await supabase
    .from("public_wines")
    .select(PUBLIC_WINE_COLS)
    .eq("user_id", ownerId)
    .order("name", { ascending: true })
    .limit(500);
  if (!withStories.error) {
    return (withStories.data as PublicWine[]) ?? [];
  }
  // Pre-migration 020: view without story columns.
  if (/kimi_summary|kimi_curiosity|kimi_talk_hook|kimi_pairings|column/i.test(
    withStories.error.message
  )) {
    const basic = await supabase
      .from("public_wines")
      .select(PUBLIC_WINE_COLS_BASIC)
      .eq("user_id", ownerId)
      .order("name", { ascending: true })
      .limit(500);
    if (basic.error) throw new Error(basic.error.message);
    return (basic.data as PublicWine[]) ?? [];
  }
  throw new Error(withStories.error.message);
}

export function placeLabel(p: {
  country?: string | null;
  city?: string | null;
}): string {
  const city = p.city?.trim();
  const country = p.country?.trim();
  if (city && country) return `${city}, ${country}`;
  return city || country || "Sin ubicación";
}

/** Map a public wine into a Wine-shaped object for Abrir hoy / drink-window. */
export function publicWineToRankable(w: PublicWine): Wine {
  const pairings = parseKimiPairingsBlob(w.kimi_pairings);
  return {
    id: w.id,
    cellarId: null,
    slot: null,
    col: null,
    row: null,
    country: w.country ?? "",
    region: w.region ?? "",
    type: w.type ?? "Tinto",
    winery: w.winery ?? "",
    name: w.name ?? "",
    aging: w.aging ?? "",
    grape: w.grape ?? "",
    vintage: w.vintage,
    vivino: w.vivino,
    cavataleRating: w.cavatale_rating,
    cavataleParts: null,
    cavataleEvidence: null,
    price: null,
    priceCurrency: null,
    purchasePrice: null,
    externalRating: null,
    ratingSource: null,
    lastCheckedAt: null,
    matchConfidence: null,
    labelImageUrl: null,
    kimiVivino: null,
    kimiPrice: null,
    kimiPriceCurrency: null,
    kimiPriceSource: null,
    kimiPriceConfidence: null,
    kimiPriceNotes: null,
    kimiPriceCheckedAt: null,
    kimiSummary: w.kimi_summary ?? null,
    kimiCuriosity: w.kimi_curiosity ?? null,
    kimiTalkHook: w.kimi_talk_hook ?? null,
    kimiPairings: pairings.dishes,
    kimiPairingNote: pairings.note,
    kimiCheckedAt: null,
    kimiConfidence: null,
    kimiUserNote: null,
  };
}
