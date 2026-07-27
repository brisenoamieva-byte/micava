import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  isValidPublicHandle,
  normalizePublicHandle,
  publicHandleValidationError,
} from "@/lib/public-handle";

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
};

const PROFILE_COLS =
  "id, display_name, public_handle, country, city, bio, network_visible, cava_public, network_updated_at";

const PUBLIC_WINE_COLS =
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
  const { data, error } = await supabase
    .from("public_wines")
    .select(PUBLIC_WINE_COLS)
    .eq("user_id", ownerId)
    .order("name", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data as PublicWine[]) ?? [];
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
