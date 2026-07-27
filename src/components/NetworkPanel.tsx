"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DisplayNameEditor } from "@/components/DisplayNameEditor";
import { PublicCellarView } from "@/components/PublicCellarView";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { useAuth } from "@/lib/auth-store";
import {
  type NetworkProfile,
  type OwnNetworkProfile,
  type PublicWine,
  checkPublicHandleAvailable,
  fetchOwnNetworkProfile,
  listPublicCavaProfiles,
  listPublicCellarWines,
  placeLabel,
  updateOwnNetworkProfile,
} from "@/lib/network";
import { isMexicoCountry, MEXICO_STATES } from "@/lib/mexico-states";
import {
  buildPublicCellarUrl,
  normalizePublicHandle,
  publicHandleValidationError,
} from "@/lib/public-handle";

type Tab = "presencia" | "directorio";

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
  const { user, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>("directorio");
  const [own, setOwn] = useState<OwnNetworkProfile | null>(null);
  const [profiles, setProfiles] = useState<NetworkProfile[]>([]);
  const [filterCountry, setFilterCountry] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const [viewing, setViewing] = useState<NetworkProfile | null>(null);
  const [cellarWines, setCellarWines] = useState<PublicWine[]>([]);
  const [cellarLoading, setCellarLoading] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [formCavaPublic, setFormCavaPublic] = useState(false);
  const [formHandle, setFormHandle] = useState("");
  const [handleHint, setHandleHint] = useState<string | null>(null);
  const [handleOk, setHandleOk] = useState(false);
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
        setFormCavaPublic(profile.cava_public);
        setFormHandle(profile.public_handle ?? "");
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
      const list = await listPublicCavaProfiles({
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
    if (tab === "directorio" && !viewing) void loadDirectory();
  }, [tab, loadDirectory, viewing]);

  // Live handle validation + uniqueness
  useEffect(() => {
    if (!formCavaPublic) {
      setHandleHint(null);
      setHandleOk(false);
      return;
    }
    const normalized = normalizePublicHandle(formHandle);
    if (!normalized) {
      setHandleHint("Elige un handle para que te encuentren (ej. ricardo).");
      setHandleOk(false);
      return;
    }
    const formatErr = publicHandleValidationError(normalized);
    if (formatErr) {
      setHandleHint(formatErr);
      setHandleOk(false);
      return;
    }
    if (own?.public_handle === normalized) {
      setHandleHint(`Tu link será /u/${normalized}`);
      setHandleOk(true);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        const { available, error: err } =
          await checkPublicHandleAvailable(normalized);
        if (cancelled) return;
        if (err && !available) {
          setHandleHint(err);
          setHandleOk(false);
          return;
        }
        if (!available) {
          setHandleHint("Ese handle ya está en uso.");
          setHandleOk(false);
          return;
        }
        setHandleHint(`Disponible — tu link será /u/${normalized}`);
        setHandleOk(true);
      })();
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [formHandle, formCavaPublic, own?.public_handle]);

  const countriesInNetwork = useMemo(() => {
    const set = new Set<string>();
    for (const p of profiles) {
      if (p.country?.trim()) set.add(p.country.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "es"));
  }, [profiles]);

  const shareableHandle =
    own?.cava_public && own.public_handle
      ? own.public_handle
      : null;

  async function savePresence() {
    if (!user) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    setCopyStatus(null);

    const networkVisible = formCavaPublic ? true : formVisible;
    const handleNormalized = formCavaPublic
      ? normalizePublicHandle(formHandle)
      : formHandle.trim()
        ? normalizePublicHandle(formHandle)
        : null;

    if (formCavaPublic) {
      const formatErr = publicHandleValidationError(handleNormalized ?? "");
      if (formatErr) {
        setSaving(false);
        setError(formatErr);
        return;
      }
      if (!handleOk && handleNormalized !== own?.public_handle) {
        setSaving(false);
        setError(handleHint || "Revisa el handle antes de guardar.");
        return;
      }
    }

    const { error: err } = await updateOwnNetworkProfile(user.id, {
      network_visible: networkVisible,
      cava_public: formCavaPublic,
      country: formCountry,
      city: formCity,
      bio: formBio,
      public_handle: handleNormalized,
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    if (formCavaPublic) setFormVisible(true);
    setInfo(
      formCavaPublic
        ? `Tu cava es pública como @${handleNormalized}. Comparte el link o busca tu handle en el directorio.`
        : formVisible
          ? "Apareces en la red, con cava privada."
          : "Dejaste de aparecer en la red."
    );
    await loadOwn();
    await refreshProfile();
  }

  async function copyMyCellarLink() {
    if (!shareableHandle) return;
    const origin =
      typeof window !== "undefined" ? window.location.origin : null;
    const url = buildPublicCellarUrl(shareableHandle, origin);
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("Link copiado. Ya puedes pegarlo en un mensaje.");
      setInfo(null);
    } catch {
      setCopyStatus(`Copia este link: ${url}`);
    }
  }

  async function openPublicCellar(profile: NetworkProfile) {
    setError(null);
    setViewing(profile);
    setCellarWines([]);
    setCellarLoading(true);
    try {
      const wines = await listPublicCellarWines(profile.id);
      setCellarWines(wines);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo cargar la cava pública."
      );
      setViewing(null);
    } finally {
      setCellarLoading(false);
    }
  }

  if (!user) {
    return (
      <p className="text-sm text-ink-soft">Inicia sesión para ver la red.</p>
    );
  }

  if (loading) {
    return (
      <div className="mt-2 space-y-4" aria-busy="true" aria-live="polite">
        <ThinkingIndicator label="Cargando red…" size="sm" />
        <div className="h-24 animate-pulse rounded-[14px] bg-[rgba(110,31,44,0.05)]" />
        <div className="h-40 animate-pulse rounded-[14px] bg-[rgba(110,31,44,0.05)]" />
      </div>
    );
  }

  if (viewing) {
    return (
      <section className="space-y-4">
        {error ? (
          <p className="panel p-4 text-sm text-[var(--wine-deep)]" role="alert">
            {error}
          </p>
        ) : null}
        <PublicCellarView
          profile={viewing}
          wines={cellarWines}
          loading={cellarLoading}
          onBack={() => {
            setViewing(null);
            setCellarWines([]);
            setError(null);
            void loadDirectory();
          }}
        />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="panel-quiet p-5">
        <h2 className="display text-3xl text-ink">Red</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Descubre coleccionistas y explora sus cavas públicas. Tú eliges si
          compartes la tuya.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["presencia", "Mi presencia"],
              ["directorio", "Directorio"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={[
                "btn min-h-[40px] px-3 text-sm",
                tab === id ? "btn-primary" : "btn-ghost",
              ].join(" ")}
              onClick={() => setTab(id)}
            >
              {label}
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
        {copyStatus ? (
          <p className="mt-3 text-sm text-ink-soft" role="status">
            {copyStatus}
          </p>
        ) : null}
      </div>

      {tab === "presencia" ? (
        <div className="panel-quiet space-y-4 p-5">
          <div className="rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] px-3 py-3 text-sm text-ink-soft">
            <p className="font-medium text-ink">Qué ven los demás</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed">
              <li>
                Nombre público, handle (@…), país/ciudad y bio (si los
                escribes).
              </li>
              <li>
                Con “Cava pública”: vinos y calificaciones (no precios). Tu
                correo nunca se muestra ni se busca.
              </li>
            </ul>
          </div>

          <DisplayNameEditor />

          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={formCavaPublic}
              onChange={(e) => {
                const on = e.target.checked;
                setFormCavaPublic(on);
                if (on) setFormVisible(true);
              }}
            />
            <span>
              <span className="font-medium">Cava pública</span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                Otros ven tus vinos en el directorio (no precios). Necesitas un
                handle para que te encuentren.
              </span>
            </span>
          </label>

          {formCavaPublic ? (
            <div className="space-y-2">
              <label className="block text-sm text-ink-soft">
                Handle público
                <div className="mt-1 flex items-center gap-1">
                  <span className="text-ink" aria-hidden>
                    @
                  </span>
                  <input
                    className="w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
                    value={formHandle}
                    onChange={(e) => {
                      setFormHandle(
                        e.target.value.replace(/@/g, "").toLowerCase()
                      );
                      setCopyStatus(null);
                    }}
                    placeholder="ricardo"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={24}
                    aria-describedby="handle-hint"
                  />
                </div>
              </label>
              <p
                id="handle-hint"
                className={[
                  "text-xs",
                  handleOk ? "text-ink-soft" : "text-[var(--wine-deep)]",
                ].join(" ")}
                role="status"
              >
                {handleHint}
              </p>
              <p className="text-xs text-ink-soft">
                Letras minúsculas, números, _ o -. Así te buscan en el
                directorio o con tu link.
              </p>
            </div>
          ) : null}

          <label className="flex items-start gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="mt-1"
              checked={formCavaPublic ? true : formVisible}
              disabled={formCavaPublic}
              onChange={(e) => setFormVisible(e.target.checked)}
            />
            <span>
              <span className="font-medium">Aparecer en la red</span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                {formCavaPublic
                  ? "Activo automáticamente con cava pública."
                  : "Perfil visible sin compartir botellas (solo nombre/lugar/bio)."}
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
            Bio <span className="text-xs">({formBio.length}/160)</span>
            <textarea
              className="mt-1 w-full rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
              rows={3}
              maxLength={160}
              value={formBio}
              onChange={(e) => setFormBio(e.target.value)}
              placeholder="Qué te gusta tomar, región favorita…"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-[44px]"
              disabled={saving}
              onClick={() => void savePresence()}
            >
              {saving ? "Guardando…" : "Guardar presencia"}
            </button>
            {shareableHandle ? (
              <button
                type="button"
                className="btn btn-ghost min-h-[44px]"
                onClick={() => void copyMyCellarLink()}
              >
                Copiar link de mi cava
              </button>
            ) : null}
          </div>

          {own?.cava_public && own.public_handle ? (
            <p className="text-xs text-ink-soft">
              Tu cava es pública como @{own.public_handle}. Puedes volver a
              privada cuando quieras.
            </p>
          ) : own?.cava_public ? (
            <p className="text-xs text-ink-soft">
              Tu cava es pública. Elige y guarda un handle para compartir el
              link.
            </p>
          ) : own?.network_visible ? (
            <p className="text-xs text-ink-soft">
              Estás visible en la red, con cava privada.
            </p>
          ) : (
            <p className="text-xs text-ink-soft">
              Ahora estás oculto: no apareces en el directorio.
            </p>
          )}
        </div>
      ) : null}

      {tab === "directorio" ? (
        <div className="panel-quiet space-y-4 p-5">
          {!own?.cava_public ? (
            <p className="rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.5)] px-3 py-2 text-sm text-ink-soft">
              Puedes explorar cavas públicas sin compartir la tuya. Para
              aparecer aquí, activa “Cava pública” y elige un handle en Mi
              presencia.
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm text-ink-soft">
              Buscar
              <input
                className="mt-1 w-full min-h-[44px] rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-3 py-2 text-ink"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Nombre o @handle"
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
              <li className="py-6">
                <ThinkingIndicator label="Cargando directorio…" size="sm" />
              </li>
            ) : profiles.length === 0 ? (
              <li className="py-6 text-sm text-ink-soft">
                Nadie con cava pública aún. Sé el primero en Mi presencia, o
                amplía la búsqueda.
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
                      {p.public_handle ? (
                        <span className="ml-1.5 font-normal text-[var(--wine)]">
                          @{p.public_handle}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-ink-soft">{placeLabel(p)}</p>
                    {p.bio ? (
                      <p className="mt-1 text-sm text-ink-soft line-clamp-2">
                        {p.bio}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-ink-soft">
                      {p.bottle_count ?? 0}{" "}
                      {(p.bottle_count ?? 0) === 1 ? "botella" : "botellas"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost min-h-[40px] px-3 text-sm"
                    onClick={() => void openPublicCellar(p)}
                  >
                    Ver cava
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
