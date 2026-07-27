"use client";

import { useCallback, useEffect, useState } from "react";
import { DisplayNameEditor } from "@/components/DisplayNameEditor";
import { ThinkingIndicator } from "@/components/ThinkingIndicator";
import { useAuth } from "@/lib/auth-store";
import {
  type OwnNetworkProfile,
  checkPublicHandleAvailable,
  fetchOwnNetworkProfile,
  updateOwnNetworkProfile,
} from "@/lib/network";
import { isMexicoCountry, MEXICO_STATES } from "@/lib/mexico-states";
import {
  buildPublicCellarUrl,
  normalizePublicHandle,
  publicHandleValidationError,
} from "@/lib/public-handle";

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

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ShareCavaModal({ open, onClose }: Props) {
  const { user, refreshProfile } = useAuth();
  const [own, setOwn] = useState<OwnNetworkProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

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
          : "No se pudo cargar tu perfil. ¿Corriste la migración SQL?"
      );
    }
  }, [user]);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setInfo(null);
      setCopyStatus(null);
      await loadOwn();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, loadOwn]);

  useEffect(() => {
    if (!open) return;
    if (!formCavaPublic) {
      setHandleHint(null);
      setHandleOk(false);
      return;
    }
    const normalized = normalizePublicHandle(formHandle);
    if (!normalized) {
      setHandleHint("Elige un handle para compartir (ej. ricardo).");
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
  }, [open, formHandle, formCavaPublic, own?.public_handle]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const shareableHandle =
    own?.cava_public && own.public_handle ? own.public_handle : null;

  async function saveShareSettings() {
    if (!user) return;
    setSaving(true);
    setError(null);
    setInfo(null);
    setCopyStatus(null);

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
      network_visible: formCavaPublic,
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
    setInfo(
      formCavaPublic
        ? `Tu cava es pública como @${handleNormalized}. Copia el link y compártelo.`
        : "Tu cava volvió a ser privada."
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-3 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-cava-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[14px] border border-[var(--line)] bg-[rgba(255,252,247,0.98)] p-5 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="share-cava-title" className="display text-2xl text-ink">
              Compartir cava
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Activa un link público para que alguien vea tus vinos (sin
              precios ni mapa).
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost min-h-[40px] px-3 text-sm"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>

        {!user ? (
          <p className="mt-4 text-sm text-ink-soft">
            Inicia sesión para compartir tu cava.
          </p>
        ) : loading ? (
          <div className="mt-4" aria-busy="true">
            <ThinkingIndicator label="Cargando…" size="sm" />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {error ? (
              <p className="text-sm text-[var(--wine-deep)]" role="alert">
                {error}
              </p>
            ) : null}
            {info ? (
              <p className="text-sm text-ink-soft" role="status">
                {info}
              </p>
            ) : null}
            {copyStatus ? (
              <p className="text-sm text-ink-soft" role="status">
                {copyStatus}
              </p>
            ) : null}

            <div className="rounded-[10px] border border-[var(--line)] bg-[rgba(255,252,247,0.55)] px-3 py-3 text-sm text-ink-soft">
              <p className="font-medium text-ink">Qué ven con el link</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-relaxed">
                <li>
                  Nombre público, handle (@…), país/ciudad y bio (si los
                  escribes).
                </li>
                <li>
                  Vinos y calificaciones. Nunca precios ni el mapa. Tu correo
                  no se muestra.
                </li>
              </ul>
            </div>

            <DisplayNameEditor />

            <label className="flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-1"
                checked={formCavaPublic}
                onChange={(e) => setFormCavaPublic(e.target.checked)}
              />
              <span>
                <span className="font-medium">Cava pública</span>
                <span className="mt-0.5 block text-xs text-ink-soft">
                  Quien tenga el link puede ver tus vinos. Necesitas un handle.
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
                      aria-describedby="share-handle-hint"
                    />
                  </div>
                </label>
                <p
                  id="share-handle-hint"
                  className={[
                    "text-xs",
                    handleOk ? "text-ink-soft" : "text-[var(--wine-deep)]",
                  ].join(" ")}
                  role="status"
                >
                  {handleHint}
                </p>
              </div>
            ) : null}

            <label className="block text-sm text-ink-soft">
              País
              <input
                list="share-cava-countries"
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
              <datalist id="share-cava-countries">
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
                onClick={() => void saveShareSettings()}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
              {shareableHandle ? (
                <button
                  type="button"
                  className="btn btn-ghost min-h-[44px]"
                  onClick={() => void copyMyCellarLink()}
                >
                  Copiar link
                </button>
              ) : null}
            </div>

            {own?.cava_public && own.public_handle ? (
              <p className="text-xs text-ink-soft">
                Pública como @{own.public_handle}. Puedes volver a privada
                cuando quieras.
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
