"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-store";
import { useT } from "@/lib/i18n";

export function DisplayNameEditor() {
  const t = useT();
  const { displayName, updateDisplayName, user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) setValue(displayName ?? "");
  }, [displayName, editing]);

  if (!user) {
    return (
      <p className="mt-1 text-sm text-ink-soft md:text-base">
        {t("auth.loginSubtitle")}
      </p>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await updateDisplayName(value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={onSubmit} className="mt-1 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="display-name">
          {t("auth.displayName")}
        </label>
        <input
          id="display-name"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          maxLength={60}
          placeholder={t("auth.displayNamePlaceholder")}
          className="min-h-[36px] min-w-[10rem] flex-1 rounded-[8px] border border-[var(--line)] bg-[rgba(255,252,247,0.9)] px-2.5 py-1.5 text-sm outline-none focus:border-[rgba(122,36,48,0.45)] sm:max-w-[14rem]"
        />
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary min-h-[36px] px-3 text-sm"
        >
          {busy ? "…" : t("common.save")}
        </button>
        <button
          type="button"
          className="min-h-[36px] px-2 text-sm text-ink-soft hover:text-ink"
          onClick={() => {
            setEditing(false);
            setError(null);
            setValue(displayName ?? "");
          }}
        >
          {t("common.cancel")}
        </button>
        {error ? (
          <p className="w-full text-xs text-[var(--wine-deep)]">{error}</p>
        ) : null}
      </form>
    );
  }

  return (
    <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-ink-soft md:text-base">
      <span>
        {displayName
          ? t("auth.helloName", { name: displayName })
          : t("auth.hello")}
      </span>
      <button
        type="button"
        className="text-xs underline-offset-2 hover:text-ink hover:underline"
        onClick={() => setEditing(true)}
      >
        {t("auth.editName")}
      </button>
    </p>
  );
}
