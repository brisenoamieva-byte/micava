import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type NetworkProfile = {
  id: string;
  display_name: string | null;
  country: string | null;
  city: string | null;
  bio: string | null;
  network_visible: boolean;
  cava_public: boolean;
  network_updated_at: string | null;
  /** Present on directory rows when bottle counts were loaded. */
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
  "id, display_name, country, city, bio, network_visible, cava_public, network_updated_at";

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
  }
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: "La red no está disponible (Supabase no configurado)." };
  }
  const supabase = createClient();

  const country = patch.country?.trim() || null;
  const city = patch.city?.trim() || null;
  const bio = patch.bio?.trim() || null;
  if (bio && bio.length > 160) {
    return { error: "La bio admite máximo 160 caracteres." };
  }

  const payload: Record<string, unknown> = {
    ...patch,
    country,
    city,
    bio,
    network_updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", userId);

  if (error) return { error: error.message };
  return { error: null };
}

/** Directory: people who made their cava pública. */
export async function listPublicCavaProfiles(opts: {
  excludeUserId?: string;
  country?: string;
  city?: string;
  query?: string;
}): Promise<NetworkProfile[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();

  let q = supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("cava_public", true)
    .order("network_updated_at", { ascending: false, nullsFirst: false });

  if (opts.excludeUserId) {
    q = q.neq("id", opts.excludeUserId);
  }
  if (opts.country?.trim()) {
    q = q.ilike("country", `%${opts.country.trim()}%`);
  }
  if (opts.city?.trim()) {
    q = q.ilike("city", `%${opts.city.trim()}%`);
  }
  if (opts.query?.trim()) {
    q = q.ilike("display_name", `%${opts.query.trim()}%`);
  }

  const { data, error } = await q.limit(100);
  if (error) throw new Error(error.message);
  const profiles = (data as NetworkProfile[]) ?? [];
  if (profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);
  const counts = await fetchPublicCavaBottleCounts(ids);
  return profiles.map((p) => ({
    ...p,
    bottle_count: counts[p.id] ?? 0,
  }));
}

export async function fetchPublicCavaBottleCounts(
  ownerIds: string[]
): Promise<Record<string, number>> {
  if (!isSupabaseConfigured() || ownerIds.length === 0) return {};
  const supabase = createClient();
  const { data, error } = await supabase.rpc("public_cava_bottle_counts", {
    owner_ids: ownerIds,
  });
  if (error) return {};
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = (row as { user_id: string }).user_id;
    const n = Number((row as { bottle_count: number | string }).bottle_count);
    if (id) map[id] = Number.isFinite(n) ? n : 0;
  }
  return map;
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
