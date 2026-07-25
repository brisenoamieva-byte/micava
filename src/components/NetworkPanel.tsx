"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { DisplayNameEditor } from "@/components/DisplayNameEditor";
import { useAuth } from "@/lib/auth-store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  type ChatMessage,
  type ConversationPreview,
  type NetworkProfile,
  type OwnNetworkProfile,
  fetchOwnNetworkProfile,
  fetchTotalUnread,
  getOrCreateDm,
  listMessages,
  listMyConversations,
  listNetworkProfiles,
  markConversationRead,
  placeLabel,
  sendMessage,
  updateOwnNetworkProfile,
} from "@/lib/network";
import { isMexicoCountry, MEXICO_STATES } from "@/lib/mexico-states";

type Tab = "presencia" | "directorio" | "chats";
type RealtimeMode = "connecting" | "live" | "polling" | "off";

const COUNTRY_SUGGESTIONS = [
  "México",
  "España",
  "Argentina",
  "Chile",
  "Colombia",
  "Perú",
  "Estados Unidos",
  "Francia",
  "Italia",
];

const POLL_MS = 8000;
const UNREAD_POLL_MS = 20000;

function UnreadBadge({ count, label }: { count: number; label?: string }) {
  if (count <= 0) return null;
  const text = count > 99 ? "99+" : String(count);
  return (
    <span
      className="inline-flex min-w-[1.25rem] items-center justify-center rounded-[8px] bg-[var(--wine)] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[rgba(255,252,247,0.96)]"
      aria-label={label ?? `${count} no leídos`}
    >
      {text}
    </span>
  );
}

type NetworkPanelProps = {
  onUnreadTotalChange?: (total: number) => void;
};

export function NetworkPanel({ onUnreadTotalChange }: NetworkPanelProps = {}) {
  const { user, displayName, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>("directorio");
  const [own, setOwn] = useState<OwnNetworkProfile | null>(null);
  const [profiles, setProfiles] = useState<NetworkProfile[]>([]);
  const [conversations, setConversations] = useState<ConversationPreview[]>(
    []
  );
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [peerLabel, setPeerLabel] = useState<string>("Chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [filterCountry, setFilterCountry] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [realtimeMode, setRealtimeMode] = useState<RealtimeMode>("off");
  const [totalUnread, setTotalUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const onUnreadRef = useRef(onUnreadTotalChange);
  onUnreadRef.current = onUnreadTotalChange;

  const [formVisible, setFormVisible] = useState(false);
  const [formCountry, setFormCountry] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formBio, setFormBio] = useState("");

  const refreshUnread = useCallback(async () => {
    try {
      const total = await fetchTotalUnread();
      setTotalUnread(total);
      onUnreadRef.current?.(total);
    } catch {
      // Migration 009 may not be applied yet — keep badge at 0.
    }
  }, []);

  const markActiveRead = useCallback(
    async (conversationId: string) => {
      await markConversationRead(conversationId);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unreadCount: 0 } : c
        )
      );
      await refreshUnread();
    },
    [refreshUnread]
  );

  const loadOwn = useCallback(async () => {
    if (!user) return;
    try {
      const profile = await fetchOwnNetworkProfile(user.id);
      setOwn(profile);
      if (profile) {
        setFormVisible(profile.network_visible);
        setFormCountry(profile.country ?? "");
        setFormCity(profile.city ?? "");
        setFormBio(profile.bio ?? "");
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "No se pudo cargar tu perfil de red. ¿Corriste la migración SQL?"
      );
    }
  }, [user]);

  const loadDirectory = useCallback(async () => {
    if (!user) return;
    setDirectoryLoading(true);
    try {
      const list = await listNetworkProfiles({
        excludeUserId: user.id,
        country: filterCountry || undefined,
        city: filterCity || undefined,
        query: filterQuery || undefined,
      });
      setProfiles(list);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo cargar el directorio."
      );
    } finally {
      setDirectoryLoading(false);
    }
  }, [user, filterCountry, filterCity, filterQuery]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    setChatsLoading(true);
    try {
      const list = await listMyConversations(user.id);
      setConversations(list);
      const total = list.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      setTotalUnread(total);
      onUnreadRef.current?.(total);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar los chats."
      );
    } finally {
      setChatsLoading(false);
    }
  }, [user]);

  const refreshMessages = useCallback(
    async (conversationId: string, opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setMessagesLoading(true);
      try {
        const msgs = await listMessages(conversationId);
        setMessages(msgs);
        await markActiveRead(conversationId);
      } catch (e) {
        if (!opts?.quiet) {
          setError(
            e instanceof Error ? e.message : "No se pudieron cargar mensajes."
          );
        }
      } finally {
        if (!opts?.quiet) setMessagesLoading(false);
      }
    },
    [markActiveRead]
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      await loadOwn();
      if (!cancelled) {
        await refreshUnread();
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loadOwn, refreshUnread]);

  // Poll unread while Red is open (covers Realtime gaps + other conversations).
  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => {
      void refreshUnread();
      if (tab === "chats" && !activeConversationId) {
        void loadConversations();
      }
    }, UNREAD_POLL_MS);
    return () => window.clearInterval(id);
  }, [
    user,
    refreshUnread,
    tab,
    activeConversationId,
    loadConversations,
  ]);

  useEffect(() => {
    if (tab === "directorio") void loadDirectory();
    if (tab === "chats" && !activeConversationId) void loadConversations();
  }, [tab, loadDirectory, loadConversations, activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || !user) {
      setRealtimeMode("off");
      return;
    }
    let cancelled = false;
    let pollId: number | null = null;
    const conversationId = activeConversationId;

    void refreshMessages(conversationId);

    if (!isSupabaseConfigured()) {
      setRealtimeMode("polling");
      pollId = window.setInterval(() => {
        if (!cancelled) void refreshMessages(conversationId, { quiet: true });
      }, POLL_MS);
      return () => {
        cancelled = true;
        if (pollId != null) window.clearInterval(pollId);
      };
    }

    setRealtimeMode("connecting");
    const supabase = createClient();
    const channel = supabase
      .channel(`dm:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
          // Viewing this thread → mark read (including peer messages).
          void markActiveRead(conversationId);
        }
      )
      .subscribe((status) => {
        if (cancelled) return;
        if (status === "SUBSCRIBED") {
          setRealtimeMode("live");
          if (pollId != null) {
            window.clearInterval(pollId);
            pollId = null;
          }
          return;
        }
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setRealtimeMode("polling");
          if (pollId == null) {
            pollId = window.setInterval(() => {
              if (!cancelled) {
                void refreshMessages(conversationId, { quiet: true });
              }
            }, POLL_MS);
          }
        }
      });

    // If Realtime never confirms, fall back to polling after a short wait.
    const fallbackId = window.setTimeout(() => {
      if (cancelled) return;
      setRealtimeMode((mode) => {
        if (mode === "live") return mode;
        if (pollId == null) {
          pollId = window.setInterval(() => {
            if (!cancelled) {
              void refreshMessages(conversationId, { quiet: true });
            }
          }, POLL_MS);
        }
        return "polling";
      });
    }, 6000);

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackId);
      if (pollId != null) window.clearInterval(pollId);
      void supabase.removeChannel(channel);
      setRealtimeMode("off");
    };
  }, [activeConversationId, user, refreshMessages, markActiveRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeConversationId]);

  const countriesInNetwork = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) {
      if (p.country?.trim()) set.add(p.country.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [profiles]);

  async function savePresence() {
    if (!user) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    const { error: err } = await updateOwnNetworkProfile(user.id, {
      network_visible: formVisible,
      country: formCountry,
      city: formCity,
      bio: formBio,
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setInfo(
      formVisible
        ? "Ya apareces en la red."
        : "Dejaste de aparecer en la red."
    );
    await loadOwn();
    await refreshProfile();
  }

  async function openChatWith(profile: NetworkProfile) {
    setError(null);
    const { conversationId, error: err } = await getOrCreateDm(profile.id);
    if (err || !conversationId) {
      setError(err || "No se pudo abrir el chat.");
      return;
    }
    setPeerLabel(profile.display_name?.trim() || "Coleccionista");
    setActiveConversationId(conversationId);
    setTab("chats");
    setMessages([]);
  }

  async function openConversation(preview: ConversationPreview) {
    setPeerLabel(preview.other?.display_name?.trim() || "Coleccionista");
    setActiveConversationId(preview.id);
    setMessages([]);
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!user || !activeConversationId || sending) return;
    setSending(true);
    setError(null);
    const { error: err, message } = await sendMessage(
      activeConversationId,
      user.id,
      draft
    );
    setSending(false);
    if (err) {
      setError(err);
      return;
    }
    setDraft("");
    if (message) {
      setMessages((prev) =>
        prev.some((m) => m.id === message.id) ? prev : [...prev, message]
      );
    }
    void loadConversations();
  }

  if (!user) {
    return (
      <p className="text-sm text-ink-soft">Inicia sesión para ver la red.</p>
    );
  }

  if (loading) {
    return <p className="text-sm text-ink-soft">Cargando red…</p>;
  }

  return (
    <section className="space-y-4">
      <div className="panel p-5">
        <h2 className="display text-3xl text-ink">Red</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Un directorio opt-in entre coleccionistas. Tú eliges si apareces;
          chats 1:1 privados. No compartimos tu cava ni tu email.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["presencia", "Mi presencia"],
              ["directorio", "Directorio"],
              ["chats", "Chats"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={[
                "btn min-h-[40px] px-3 text-sm",
                tab === id ? "btn-primary" : "btn-ghost",
              ].join(" ")}
              onClick={() => {
                setTab(id);
                if (id !== "chats") setActiveConversationId(null);
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                {label}
                {id === "chats" ? (
                  <UnreadBadge
                    count={totalUnread}
                    label={`${totalUnread} mensajes no leídos`}
                  />
                ) : null}
              </span>
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-3 text-sm text-[var(--wine-deep)]" role="alert">
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="mt-3 text-sm text-ink-soft" role="status">
            {info}
          </p>
        ) : null}
      </div>

      {tab === "presencia" ? (
        <div className="panel space-y-4 p-5">
          <div className="rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] px-3 py-3 text-sm text-ink-soft">
            <p className="font-medium text-ink">Qué ven los demás</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed">
              <li>Nombre público, país/ciudad y bio (si los escribes).</li>
              <li>Nunca tu email, cava, botellas ni ubicación exacta.</li>
              <li>
                Si desactivas “Aparecer en la red”, desapareces del directorio;
                los chats ya abiertos siguen.
              </li>
            </ul>
          </div>

          <DisplayNameEditor />
          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={formVisible}
              onChange={(e) => setFormVisible(e.target.checked)}
            />
            <span>
              <span className="font-medium">Aparecer en la red</span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                Opt-in. Solo entonces otros te ven y pueden escribirte.
              </span>
            </span>
          </label>

          <label className="block text-sm text-ink-soft">
            País
            <input
              list="network-countries"
              className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
              value={formCountry}
              onChange={(e) => {
                const next = e.target.value;
                setFormCountry(next);
                if (
                  isMexicoCountry(next) &&
                  formCity &&
                  !MEXICO_STATES.includes(
                    formCity as (typeof MEXICO_STATES)[number]
                  )
                ) {
                  setFormCity("");
                }
              }}
              placeholder="México"
            />
            <datalist id="network-countries">
              {COUNTRY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="block text-sm text-ink-soft">
            {isMexicoCountry(formCountry) ? "Estado" : "Ciudad"}
            {isMexicoCountry(formCountry) ? (
              <select
                className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
                value={
                  MEXICO_STATES.includes(
                    formCity as (typeof MEXICO_STATES)[number]
                  )
                    ? formCity
                    : ""
                }
                onChange={(e) => setFormCity(e.target.value)}
              >
                <option value="">Elige un estado…</option>
                {MEXICO_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="Ciudad"
              />
            )}
          </label>

          <label className="block text-sm text-ink-soft">
            Bio{" "}
            <span className="text-xs">({formBio.length}/160)</span>
            <textarea
              className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
              rows={3}
              maxLength={160}
              value={formBio}
              onChange={(e) => setFormBio(e.target.value)}
              placeholder="Qué te gusta tomar, región favorita…"
            />
          </label>

          <button
            type="button"
            className="btn btn-primary min-h-[44px]"
            disabled={saving}
            onClick={() => void savePresence()}
          >
            {saving ? "Guardando…" : "Guardar presencia"}
          </button>

          {own && !own.network_visible ? (
            <p className="text-xs text-ink-soft">
              Ahora estás oculto: no apareces en el directorio.
            </p>
          ) : own?.network_visible ? (
            <p className="text-xs text-ink-soft">
              Estás visible. Puedes ocultarte cuando quieras.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "directorio" ? (
        <div className="panel space-y-4 p-5">
          {!own?.network_visible ? (
            <p className="rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.5)] px-3 py-2 text-sm text-ink-soft">
              Puedes explorar el directorio sin aparecer. Para que otros te
              encuentren, activa “Aparecer en la red” en Mi presencia.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm text-ink-soft">
              Buscar
              <input
                className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Nombre"
              />
            </label>
            <label className="block text-sm text-ink-soft">
              País
              <input
                list="filter-countries"
                className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                placeholder="Todos"
              />
              <datalist id="filter-countries">
                {[...COUNTRY_SUGGESTIONS, ...countriesInNetwork].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
            <label className="block text-sm text-ink-soft">
              {isMexicoCountry(filterCountry) ? "Estado" : "Ciudad"}
              {isMexicoCountry(filterCountry) ? (
                <select
                  className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
                  value={
                    MEXICO_STATES.includes(
                      filterCity as (typeof MEXICO_STATES)[number]
                    )
                      ? filterCity
                      : ""
                  }
                  onChange={(e) => setFilterCity(e.target.value)}
                >
                  <option value="">Todos</option>
                  {MEXICO_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
                  value={filterCity}
                  onChange={(e) => setFilterCity(e.target.value)}
                  placeholder="Todas"
                />
              )}
            </label>
          </div>

          <ul className="divide-y divide-[var(--line)]">
            {directoryLoading ? (
              <li className="py-6 text-sm text-ink-soft">Cargando directorio…</li>
            ) : profiles.length === 0 ? (
              <li className="py-6 text-sm text-ink-soft">
                Nadie visible con esos filtros. Sé el primero en activar tu
                presencia, o amplía la búsqueda.
              </li>
            ) : (
              profiles.map((p) => (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {p.display_name?.trim() || "Coleccionista"}
                    </p>
                    <p className="text-xs text-ink-soft">{placeLabel(p)}</p>
                    {p.bio ? (
                      <p className="mt-1 text-sm text-ink-soft line-clamp-2">
                        {p.bio}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost min-h-[40px] px-3 text-sm"
                    onClick={() => void openChatWith(p)}
                  >
                    Escribir
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {tab === "chats" ? (
        <div className="panel overflow-hidden p-0 sm:p-0">
          {activeConversationId ? (
            <div className="flex h-[min(70dvh,560px)] flex-col">
              <div className="flex items-center gap-2 border-b border-[var(--line)] px-4 py-3">
                <button
                  type="button"
                  className="text-sm text-[var(--wine)] underline-offset-2 hover:underline"
                  onClick={() => {
                    setActiveConversationId(null);
                    void loadConversations();
                  }}
                >
                  ← Chats
                </button>
                <p className="min-w-0 flex-1 truncate font-medium text-ink">
                  {peerLabel}
                </p>
                <button
                  type="button"
                  className="shrink-0 text-xs text-ink-soft underline-offset-2 hover:text-ink hover:underline"
                  onClick={() => void refreshMessages(activeConversationId)}
                >
                  Actualizar
                </button>
              </div>
              {realtimeMode === "polling" ? (
                <p
                  className="border-b border-[var(--line)] bg-[rgba(255,252,247,0.7)] px-4 py-2 text-xs text-ink-soft"
                  role="status"
                >
                  Mensajes en vivo no disponibles (Realtime off o falló).
                  Actualizamos cada pocos segundos — o toca Actualizar.
                </p>
              ) : realtimeMode === "connecting" ? (
                <p
                  className="border-b border-[var(--line)] px-4 py-2 text-xs text-ink-soft"
                  role="status"
                >
                  Conectando chat en vivo…
                </p>
              ) : null}
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {messagesLoading && messages.length === 0 ? (
                  <p className="text-sm text-ink-soft">Cargando mensajes…</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-ink-soft">
                    Di hola. Los mensajes son privados entre ustedes dos.
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_id === user.id;
                    return (
                      <div
                        key={m.id}
                        className={[
                          "max-w-[85%] rounded-[12px] px-3 py-2 text-sm",
                          mine
                            ? "ml-auto bg-[rgba(122,36,48,0.12)] text-ink"
                            : "mr-auto bg-[rgba(255,252,247,0.9)] text-ink border border-[var(--line)]",
                        ].join(" ")}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {m.body}
                        </p>
                        <p className="mt-1 text-[10px] text-ink-soft">
                          {new Date(m.created_at).toLocaleString("es", {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
              <form
                onSubmit={(e) => void handleSend(e)}
                className="flex gap-2 border-t border-[var(--line)] p-3"
              >
                <input
                  className="min-h-[44px] flex-1 rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 text-ink"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Escribe un mensaje…"
                  maxLength={2000}
                  disabled={sending}
                />
                <button
                  type="submit"
                  className="btn btn-primary min-h-[44px] px-4"
                  disabled={sending || !draft.trim()}
                >
                  {sending ? "…" : "Enviar"}
                </button>
              </form>
            </div>
          ) : (
            <div className="p-5">
              <p className="text-sm text-ink-soft">
                Conversaciones privadas. Abre una desde el directorio con
                “Escribir”.
              </p>
              {chatsLoading ? (
                <p className="mt-4 text-sm text-ink-soft">Cargando chats…</p>
              ) : (
                <ul className="mt-3 divide-y divide-[var(--line)]">
                  {conversations.length === 0 ? (
                    <li className="py-6 text-sm text-ink-soft">
                      Aún no hay chats. Busca a alguien en el directorio.
                    </li>
                  ) : (
                    conversations.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-3 py-3 text-left"
                          onClick={() => void openConversation(c)}
                        >
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span
                                className={[
                                  "block truncate",
                                  c.unreadCount > 0
                                    ? "font-semibold text-ink"
                                    : "font-medium text-ink",
                                ].join(" ")}
                              >
                                {c.other?.display_name?.trim() ||
                                  "Coleccionista"}
                              </span>
                              <UnreadBadge
                                count={c.unreadCount}
                                label={`${c.unreadCount} no leídos`}
                              />
                            </span>
                            <span
                              className={[
                                "mt-0.5 block truncate text-xs",
                                c.unreadCount > 0
                                  ? "font-medium text-ink"
                                  : "text-ink-soft",
                              ].join(" ")}
                            >
                              {c.lastBody || "Sin mensajes aún"}
                            </span>
                          </span>
                          <span className="shrink-0 text-[10px] text-ink-soft">
                            {new Date(c.last_message_at).toLocaleDateString(
                              "es",
                              { day: "numeric", month: "short" }
                            )}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : null}

      <p className="px-1 text-xs text-ink-soft">
        Hola{displayName ? `, ${displayName}` : ""}. La red no comparte tu cava
        ni tu email.
      </p>
    </section>
  );
}
