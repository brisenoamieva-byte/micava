import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export type NetworkProfile = {
  id: string;
  display_name: string | null;
  country: string | null;
  city: string | null;
  bio: string | null;
  network_visible: boolean;
  network_updated_at: string | null;
};

export type OwnNetworkProfile = NetworkProfile & {
  bottle_pledge?: boolean;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type ConversationPreview = {
  id: string;
  last_message_at: string;
  other: NetworkProfile | null;
  lastBody: string | null;
  unreadCount: number;
};

const PROFILE_COLS =
  "id, display_name, country, city, bio, network_visible, network_updated_at";

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

export async function listNetworkProfiles(opts: {
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
    .eq("network_visible", true)
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
  return (data as NetworkProfile[]) ?? [];
}

export async function getOrCreateDm(
  otherUserId: string
): Promise<{ conversationId: string | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return {
      conversationId: null,
      error: "La red no está disponible (Supabase no configurado).",
    };
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_or_create_dm", {
    other_user_id: otherUserId,
  });
  if (error) return { conversationId: null, error: error.message };
  return { conversationId: data as string, error: null };
}

export async function listMyConversations(
  userId: string
): Promise<ConversationPreview[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();

  const { data: memberships, error: memErr } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", userId);
  if (memErr) throw new Error(memErr.message);
  const ids = (memberships ?? []).map((m) => m.conversation_id as string);
  if (ids.length === 0) return [];

  const { data: convos, error: convErr } = await supabase
    .from("conversations")
    .select("id, last_message_at")
    .in("id", ids)
    .order("last_message_at", { ascending: false });
  if (convErr) throw new Error(convErr.message);

  const { data: allMembers, error: allMemErr } = await supabase
    .from("conversation_members")
    .select("conversation_id, user_id")
    .in("conversation_id", ids);
  if (allMemErr) throw new Error(allMemErr.message);

  const otherByConv = new Map<string, string>();
  for (const m of allMembers ?? []) {
    if (m.user_id === userId) continue;
    otherByConv.set(m.conversation_id as string, m.user_id as string);
  }

  const otherIds = [...new Set(otherByConv.values())];
  const profileMap = new Map<string, NetworkProfile>();
  if (otherIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select(PROFILE_COLS)
      .in("id", otherIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id as string, p as NetworkProfile);
    }
  }

  const unreadMap = await fetchMyUnreadCounts();

  const previews: ConversationPreview[] = [];
  for (const c of convos ?? []) {
    const otherId = otherByConv.get(c.id as string);
    let lastBody: string | null = null;
    const { data: lastMsg } = await supabase
      .from("messages")
      .select("body")
      .eq("conversation_id", c.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastBody = (lastMsg?.body as string | undefined) ?? null;

    const id = c.id as string;
    previews.push({
      id,
      last_message_at: c.last_message_at as string,
      other: otherId ? profileMap.get(otherId) ?? null : null,
      lastBody,
      unreadCount: unreadMap[id] ?? 0,
    });
  }
  return previews;
}

/** Per-conversation unread counts. Empty if migration 009 not applied yet. */
export async function fetchMyUnreadCounts(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured()) return {};
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_unread_counts");
  if (error) return {};
  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = (row as { conversation_id: string }).conversation_id;
    const n = Number((row as { unread_count: number | string }).unread_count);
    if (id && n > 0) map[id] = n;
  }
  return map;
}

export async function fetchTotalUnread(): Promise<number> {
  const map = await fetchMyUnreadCounts();
  return Object.values(map).reduce((sum, n) => sum + n, 0);
}

/** Mark conversation as read for the current user. No-op if migration missing. */
export async function markConversationRead(
  conversationId: string
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) return { error: null };
  const supabase = createClient();
  const { error } = await supabase.rpc("mark_conversation_read", {
    conv_id: conversationId,
  });
  // Graceful if 009 not applied yet (function missing)
  if (error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("could not find") ||
      msg.includes("does not exist") ||
      msg.includes("schema cache")
    ) {
      return { error: null };
    }
    return { error: error.message };
  }
  return { error: null };
}

export async function listMessages(
  conversationId: string
): Promise<ChatMessage[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data as ChatMessage[]) ?? [];
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<{ error: string | null; message?: ChatMessage }> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Escribe un mensaje." };
  if (trimmed.length > 2000) return { error: "Máximo 2000 caracteres." };
  if (!isSupabaseConfigured()) {
    return { error: "No se puede enviar: la red no está disponible." };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      body: trimmed,
    })
    .select("id, conversation_id, sender_id, body, created_at")
    .single();

  if (error) return { error: error.message };
  return { error: null, message: data as ChatMessage };
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
