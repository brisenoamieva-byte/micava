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
  getOrCreateDm,
  listMessages,
  listMyConversations,
  listNetworkProfiles,
  placeLabel,
  sendMessage,
  updateOwnNetworkProfile,
} from "@/lib/network";

type Tab = "presencia" | "directorio" | "chats";

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

export function NetworkPanel() {
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
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [formCountry, setFormCountry] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formBio, setFormBio] = useState("");

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
    }
  }, [user, filterCountry, filterCity, filterQuery]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const list = await listMyConversations(user.id);
      setConversations(list);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar los chats."
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      await loadOwn();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loadOwn]);

  useEffect(() => {
    if (tab === "directorio") void loadDirectory();
    if (tab === "chats" && !activeConversationId) void loadConversations();
  }, [tab, loadDirectory, loadConversations, activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || !user) return;
    let cancelled = false;

    (async () => {
      try {
        const msgs = await listMessages(activeConversationId);
        if (!cancelled) setMessages(msgs);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "No se pudieron cargar mensajes."
          );
        }
      }
    })();

    if (!isSupabaseConfigured()) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`dm:${activeConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [activeConversationId, user]);

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
          Encuentra a otros coleccionistas y escribe en privado. Solo quien
          activa “aparecer en la red” es visible.
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
              {label}
            </button>
          ))}
        </div>

        {error ? (
          <p className="mt-3 text-sm text-[var(--wine-deep)]">{error}</p>
        ) : null}
        {info ? <p className="mt-3 text-sm text-ink-soft">{info}</p> : null}
      </div>

      {tab === "presencia" ? (
        <div className="panel space-y-4 p-5">
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
                Otros podrán verte y escribirte. Tu email no se muestra.
              </span>
            </span>
          </label>

          <label className="block text-sm text-ink-soft">
            País
            <input
              list="network-countries"
              className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
              value={formCountry}
              onChange={(e) => setFormCountry(e.target.value)}
              placeholder="México"
            />
            <datalist id="network-countries">
              {COUNTRY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="block text-sm text-ink-soft">
            Ciudad
            <input
              className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
              value={formCity}
              onChange={(e) => setFormCity(e.target.value)}
              placeholder="Ciudad de México"
            />
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
              placeholder="Qué te gusta beber, región favorita…"
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
              Ahora mismo estás oculto en el directorio.
            </p>
          ) : null}
        </div>
      ) : null}

      {tab === "directorio" ? (
        <div className="panel space-y-4 p-5">
          {!own?.network_visible ? (
            <p className="rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.5)] px-3 py-2 text-sm text-ink-soft">
              Tip: activa “Aparecer en la red” en Mi presencia para que otros
              también puedan encontrarte.
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
              Ciudad
              <input
                className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                placeholder="Todas"
              />
            </label>
          </div>

          <ul className="divide-y divide-[var(--line)]">
            {profiles.length === 0 ? (
              <li className="py-6 text-sm text-ink-soft">
                Nadie visible todavía con esos filtros. Sé el primero en
                activar tu presencia.
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
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-ink-soft">
                    Di hola. Los mensajes llegan en vivo.
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
                />
                <button
                  type="submit"
                  className="btn btn-primary min-h-[44px] px-4"
                  disabled={sending || !draft.trim()}
                >
                  Enviar
                </button>
              </form>
            </div>
          ) : (
            <div className="p-5">
              <p className="text-sm text-ink-soft">
                Tus conversaciones. Abre una desde el directorio con
                “Escribir”.
              </p>
              <ul className="mt-3 divide-y divide-[var(--line)]">
                {conversations.length === 0 ? (
                  <li className="py-6 text-sm text-ink-soft">
                    Aún no hay chats.
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
                          <span className="block font-medium text-ink">
                            {c.other?.display_name?.trim() || "Coleccionista"}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-soft">
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
