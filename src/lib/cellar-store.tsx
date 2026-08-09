"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { wineIdentityKey } from "@/lib/analytics";
import { useAuth } from "@/lib/auth-store";
import {
  withKimiDefaults,
  type KimiResearch,
} from "@/lib/kimi-research";
import {
  withVerificationDefaults,
  type RatingVerification,
} from "@/lib/rating-verify";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  cellarFromRow,
  cellarToRow,
  DEFAULT_CELLAR_COLS,
  DEFAULT_CELLAR_ROWS,
  encounterFromRow,
  encounterToRow,
  historyFromRow,
  historyToRow,
  wineFromRow,
  wineToRow,
  type CellarRow,
  type EncounterRow,
  type HistoryRow,
  type WineRow,
} from "@/lib/supabase/map";
import type {
  CellarLogEntry,
  CellarUnit,
  DepartAction,
  DepartExtras,
  Encounter,
  Wine,
  WineDraft,
} from "@/lib/types";
import { parseLocation } from "@/lib/wines";

const STORAGE_KEY = "micava.wines.v1";
const HISTORY_KEY = "micava.history.v1";
const ENCOUNTERS_KEY = "micava.encounters.v1";
const IMPORT_FLAG = "micava.import.offered.v1";

function localDefaultCellar(): CellarUnit {
  return {
    id: crypto.randomUUID(),
    name: "Principal",
    cols: DEFAULT_CELLAR_COLS,
    rows: [...DEFAULT_CELLAR_ROWS],
    sortOrder: 0,
  };
}

function isMissingRelationError(err: { code?: string; message?: string } | null) {
  if (!err) return false;
  const msg = (err.message ?? "").toLowerCase();
  return (
    err.code === "PGRST205" ||
    err.code === "42P01" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist")
  );
}

type SyncErr = { code?: string; message?: string } | null;

function syncErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  if (err instanceof Error && err.message) return err.message;
  return String(err ?? "Error desconocido");
}

/** Browser/network blips (mobile radios, aborted parallel fetches). */
function isTransientFetchError(err: unknown): boolean {
  const msg = syncErrorMessage(err).toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("networkerror") ||
    msg.includes("network request failed") ||
    msg.includes("load failed") ||
    msg.includes("fetch failed") ||
    msg.includes("the network connection was lost") ||
    msg.includes("err_network")
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

type CellarContextValue = {
  wines: Wine[];
  history: CellarLogEntry[];
  encounters: Encounter[];
  cellars: CellarUnit[];
  activeCellarId: string | null;
  setActiveCellarId: (id: string | null) => void;
  activeCellar: CellarUnit | null;
  ready: boolean;
  canImportLocal: boolean;
  /** Last cloud save failure (upsert/delete); null when ok or dismissed. */
  syncError: string | null;
  clearSyncError: () => void;
  /** Brief success after a cloud write; auto-clears. */
  syncOk: string | null;
  clearSyncOk: () => void;
  /** Live `navigator.onLine` (true until first client check if SSR). */
  isOnline: boolean;
  addWine: (draft: WineDraft) => Wine;
  updateWine: (id: string, draft: WineDraft) => void;
  verifyWineRating: (
    id: string,
    verification: RatingVerification,
    options?: { syncVivino?: boolean }
  ) => void;
  saveKimiResearch: (id: string, research: KimiResearch) => number;
  /** Persist owner dispute note for story review (not ground truth). */
  saveKimiUserNote: (id: string, note: string | null) => number;
  /** Price-only verify: update kimiPrice + currency without touching story. */
  saveVerifiedPrice: (
    id: string,
    result: { amount: number; currency: string }
  ) => number;
  setLabelImageUrl: (id: string, labelImageUrl: string | null) => void;
  applyKimiResearch: (
    id: string,
    fields: { vivino?: boolean; price?: boolean }
  ) => number;
  moveWine: (
    wineId: string,
    targetLocation: string,
    targetCellarId?: string | null
  ) => void;
  removeWine: (id: string) => void;
  departWine: (
    id: string,
    action: DepartAction,
    extras?: DepartExtras
  ) => void;
  /** Save a table encounter to the bitácora (not cellar inventory). */
  saveEncounter: (entry: Omit<Encounter, "id" | "at"> & {
    id?: string;
    at?: string;
  }) => Encounter;
  removeEncounter: (id: string) => void;
  resetCellar: () => Promise<void>;
  importLocalCellar: () => Promise<void>;
  dismissImportOffer: () => void;
  addCellarUnit: (input: {
    name: string;
    cols: number;
    rows: string[];
  }) => Promise<CellarUnit | null>;
  updateCellarUnit: (
    id: string,
    patch: Partial<Pick<CellarUnit, "name" | "cols" | "rows">>
  ) => Promise<void>;
  deleteCellarUnit: (id: string) => Promise<void>;
};

const CellarContext = createContext<CellarContextValue | null>(null);

function createId(existing: Wine[]): string {
  const max = existing.reduce((acc, w) => {
    const n = Number(String(w.id).replace(/\D/g, ""));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  return `w${String(max + 1).padStart(3, "0")}`;
}

function draftToWine(draft: WineDraft, id: string, existing?: Wine): Wine {
  const loc = parseLocation(draft.location);
  const cellarId =
    loc.slot === "abajo" || !loc.slot
      ? null
      : draft.cellarId ?? existing?.cellarId ?? null;
  return {
    id,
    cellarId,
    slot: loc.slot,
    col: loc.col,
    row: loc.row,
    country: draft.country.trim(),
    region: draft.region.trim(),
    type: draft.type.trim() || "Tinto",
    winery: draft.winery.trim(),
    name: draft.name.trim(),
    aging: draft.aging.trim(),
    grape: draft.grape.trim(),
    vintage: draft.vintage,
    vivino: draft.vivino,
    cavataleRating: existing?.cavataleRating ?? null,
    cavataleParts: existing?.cavataleParts ?? null,
    cavataleEvidence: existing?.cavataleEvidence ?? null,
    price: draft.price,
    priceCurrency: existing?.priceCurrency ?? null,
    externalRating: existing?.externalRating ?? null,
    ratingSource: existing?.ratingSource ?? null,
    lastCheckedAt: existing?.lastCheckedAt ?? null,
    matchConfidence: existing?.matchConfidence ?? null,
    kimiVivino: existing?.kimiVivino ?? null,
    kimiPrice: existing?.kimiPrice ?? null,
    kimiPriceCurrency: existing?.kimiPriceCurrency ?? null,
    kimiSummary: existing?.kimiSummary ?? null,
    kimiCuriosity: existing?.kimiCuriosity ?? null,
    kimiTalkHook: existing?.kimiTalkHook ?? null,
    kimiPairings: existing?.kimiPairings ?? null,
    kimiPairingNote: existing?.kimiPairingNote ?? null,
    kimiCheckedAt: existing?.kimiCheckedAt ?? null,
    kimiConfidence: existing?.kimiConfidence ?? null,
    kimiUserNote: existing?.kimiUserNote ?? null,
    labelImageUrl: existing?.labelImageUrl ?? null,
  };
}

function normalizeWine(raw: Wine): Wine {
  return withKimiDefaults(withVerificationDefaults({ ...raw }));
}

function snapshotWine(w: Wine): CellarLogEntry["wine"] {
  return {
    id: w.id,
    name: w.name,
    winery: w.winery,
    country: w.country,
    region: w.region,
    type: w.type,
    vintage: w.vintage,
    vivino: w.vivino,
    price: w.price,
    slot: w.slot,
    grape: w.grape,
  };
}

function loadStored(): Wine[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Wine[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed.map(normalizeWine);
  } catch {
    return null;
  }
}

function loadHistoryLocal(): CellarLogEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CellarLogEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e) => ({
      ...e,
      myRating: e.myRating ?? null,
      note: e.note ?? null,
    }));
  } catch {
    return [];
  }
}

function loadEncountersLocal(): Encounter[] {
  try {
    const raw = localStorage.getItem(ENCOUNTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Encounter[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e) => ({
      ...e,
      wineId: e.wineId ?? null,
      place: e.place ?? null,
      note: e.note ?? null,
      kimiPairings: e.kimiPairings ?? null,
      kimiPairingNote: e.kimiPairingNote ?? null,
    }));
  } catch {
    return [];
  }
}

function persistEncountersLocal(list: Encounter[]) {
  try {
    localStorage.setItem(ENCOUNTERS_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    /* ignore */
  }
}

export function wineToDraft(wine: Wine): WineDraft {
  return {
    name: wine.name,
    winery: wine.winery,
    country: wine.country,
    region: wine.region,
    type: wine.type,
    grape: wine.grape,
    aging: wine.aging,
    vintage: wine.vintage,
    vivino: wine.vivino,
    price: wine.price,
    cellarId: wine.cellarId,
    location: wine.slot ?? "",
  };
}

export function CellarProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady, configured } = useAuth();
  const [wines, setWines] = useState<Wine[]>([]);
  const [history, setHistory] = useState<CellarLogEntry[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [cellars, setCellars] = useState<CellarUnit[]>([]);
  const [activeCellarId, setActiveCellarId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [canImportLocal, setCanImportLocal] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncOk, setSyncOk] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const userIdRef = useRef<string | null>(null);
  /** Bumps on vaciar / user switch so in-flight cloud loads can't restore deleted bottles. */
  const loadGenRef = useRef(0);
  /** False until `cellars` + `wines.cellar_id` exist in Supabase. */
  const multiCellarRef = useRef(false);
  /** False if kimi_* columns are missing in Supabase. */
  const kimiColumnsRef = useRef(true);
  /** False if cavatale_parts / cavatale_evidence columns are missing. */
  const cavataleBreakdownColumnsRef = useRef(true);
  /** False if encounters table is missing in Supabase. */
  const encountersTableRef = useRef(true);
  /** Serialize wine upserts so mobile doesn't drop parallel fetches. */
  const wineUpsertChainRef = useRef(Promise.resolve());
  const syncOkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Skip success toasts until the initial cloud load finishes. */
  const allowSyncOkRef = useRef(false);

  const activeCellar = useMemo(
    () => cellars.find((c) => c.id === activeCellarId) ?? cellars[0] ?? null,
    [cellars, activeCellarId]
  );

  const clearSyncError = useCallback(() => setSyncError(null), []);
  const clearSyncOk = useCallback(() => {
    if (syncOkTimerRef.current) {
      clearTimeout(syncOkTimerRef.current);
      syncOkTimerRef.current = null;
    }
    setSyncOk(null);
  }, []);

  const reportSyncError = useCallback((message: string) => {
    console.warn(message);
    if (syncOkTimerRef.current) {
      clearTimeout(syncOkTimerRef.current);
      syncOkTimerRef.current = null;
    }
    setSyncOk(null);
    setSyncError(message);
  }, []);

  const reportSyncOk = useCallback(
    (message = "Guardado en la nube") => {
      setSyncError(null);
      if (!allowSyncOkRef.current) return;
      setSyncOk(message);
      if (syncOkTimerRef.current) clearTimeout(syncOkTimerRef.current);
      syncOkTimerRef.current = setTimeout(() => {
        setSyncOk(null);
        syncOkTimerRef.current = null;
      }, 2200);
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncOnline = () => setIsOnline(navigator.onLine);
    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      if (syncOkTimerRef.current) clearTimeout(syncOkTimerRef.current);
    };
  }, []);

  const priceCurrencyColumnsRef = useRef(true);

  const upsertWineRemote = useCallback(async (wine: Wine, userId: string) => {
    if (!isSupabaseConfigured()) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    const run = async () => {
      const supabase = createClient();
      const tryUpsert = async (
        includeKimi: boolean,
        includePairings: boolean,
        includeUserNote: boolean,
        includePriceCurrency: boolean,
        includeCavataleBreakdown: boolean
      ): Promise<{ error: SyncErr }> => {
        try {
          const row = wineToRow(wine, userId, {
            includeCellarId: multiCellarRef.current,
            includeKimi,
            includeCavataleBreakdown,
          });
          if (includeKimi && !includePairings) {
            delete row.kimi_pairings;
          }
          if (includeKimi && !includeUserNote) {
            delete row.kimi_user_note;
          }
          if (!includePriceCurrency) {
            delete row.price_currency;
            delete row.kimi_price_currency;
          }
          const result = await supabase
            .from("wines")
            .upsert(row, { onConflict: "user_id,id" });
          return { error: result.error };
        } catch (e) {
          return { error: { message: syncErrorMessage(e) } };
        }
      };

      let includePairings = true;
      let includeUserNote = true;
      let includePriceCurrency = priceCurrencyColumnsRef.current;
      let includeCavataleBreakdown = cavataleBreakdownColumnsRef.current;
      let { error } = await tryUpsert(
        kimiColumnsRef.current,
        includePairings,
        includeUserNote,
        includePriceCurrency,
        includeCavataleBreakdown
      );

      for (let attempt = 1; error && isTransientFetchError(error) && attempt <= 2; attempt++) {
        await sleep(350 * attempt);
        ({ error } = await tryUpsert(
          kimiColumnsRef.current,
          includePairings,
          includeUserNote,
          includePriceCurrency,
          includeCavataleBreakdown
        ));
      }

      if (
        error &&
        includeCavataleBreakdown &&
        /cavatale_parts|cavatale_evidence/i.test(error.message ?? "")
      ) {
        includeCavataleBreakdown = false;
        cavataleBreakdownColumnsRef.current = false;
        ({ error } = await tryUpsert(
          kimiColumnsRef.current,
          includePairings,
          includeUserNote,
          includePriceCurrency,
          false
        ));
      }
      if (
        error &&
        includePriceCurrency &&
        /price_currency|kimi_price_currency/i.test(error.message ?? "")
      ) {
        includePriceCurrency = false;
        priceCurrencyColumnsRef.current = false;
        ({ error } = await tryUpsert(
          kimiColumnsRef.current,
          includePairings,
          includeUserNote,
          false,
          includeCavataleBreakdown
        ));
      }
      if (
        error &&
        kimiColumnsRef.current &&
        /kimi_user_note/i.test(error.message ?? "")
      ) {
        includeUserNote = false;
        ({ error } = await tryUpsert(
          true,
          includePairings,
          false,
          includePriceCurrency,
          includeCavataleBreakdown
        ));
      }
      if (
        error &&
        kimiColumnsRef.current &&
        /kimi_pairings/i.test(error.message ?? "")
      ) {
        includePairings = false;
        ({ error } = await tryUpsert(
          true,
          false,
          includeUserNote,
          includePriceCurrency,
          includeCavataleBreakdown
        ));
      }
      if (
        error &&
        kimiColumnsRef.current &&
        /kimi_|column|schema|could not find/i.test(error.message ?? "")
      ) {
        kimiColumnsRef.current = false;
        ({ error } = await tryUpsert(
          false,
          false,
          false,
          includePriceCurrency,
          includeCavataleBreakdown
        ));
      }
      if (error) {
        reportSyncError(
          `No se pudo guardar en la nube: ${syncErrorMessage(error)}. Los cambios pueden perderse al recargar.`
        );
      } else {
        reportSyncOk();
      }
    };

    const queued = wineUpsertChainRef.current.then(run, run);
    wineUpsertChainRef.current = queued.then(
      () => undefined,
      () => undefined
    );
    await queued;
  }, [reportSyncError, reportSyncOk]);

  const deleteWineRemote = useCallback(async (id: string, userId: string) => {
    if (!isSupabaseConfigured()) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("wines")
      .delete()
      .eq("user_id", userId)
      .eq("id", id);
    if (error) {
      reportSyncError(
        `No se pudo borrar en la nube: ${error.message}. Revisa al recargar.`
      );
    } else {
      reportSyncOk("Cambio guardado en la nube");
    }
  }, [reportSyncError, reportSyncOk]);

  const insertHistoryRemote = useCallback(
    async (entry: CellarLogEntry, userId: string) => {
      if (!isSupabaseConfigured()) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("cellar_history")
        .upsert(historyToRow(entry, userId), {
          onConflict: "user_id,id",
        });
      if (error) {
        reportSyncError(
          `No se pudo guardar el historial: ${error.message}.`
        );
      }
    },
    [reportSyncError]
  );

  const upsertEncounterRemote = useCallback(
    async (entry: Encounter, userId: string, all: Encounter[]) => {
      persistEncountersLocal(all);
      if (!isSupabaseConfigured()) return;
      if (!encountersTableRef.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("encounters")
        .upsert(encounterToRow(entry, userId), {
          onConflict: "user_id,id",
        });
      if (error && isMissingRelationError(error)) {
        encountersTableRef.current = false;
        return;
      }
      if (error) {
        reportSyncError(
          `No se pudo guardar el encuentro: ${error.message}.`
        );
      } else {
        reportSyncOk("Guardado en tu bitácora");
      }
    },
    [reportSyncError, reportSyncOk]
  );

  const deleteEncounterRemote = useCallback(
    async (id: string, userId: string, all: Encounter[]) => {
      persistEncountersLocal(all);
      if (!isSupabaseConfigured() || !encountersTableRef.current) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("encounters")
        .delete()
        .eq("user_id", userId)
        .eq("id", id);
      if (error && isMissingRelationError(error)) {
        encountersTableRef.current = false;
        return;
      }
      if (error) {
        reportSyncError(
          `No se pudo borrar el encuentro: ${error.message}.`
        );
      }
    },
    [reportSyncError]
  );

  const persistWines = useCallback(async (list: Wine[], userId: string) => {
    if (!isSupabaseConfigured()) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const supabase = createClient();
    const buildRows = (includeCavataleBreakdown: boolean) =>
      list.map((w) =>
        wineToRow(w, userId, {
          includeCellarId: multiCellarRef.current,
          includeKimi: kimiColumnsRef.current,
          includeCavataleBreakdown,
        })
      );

    try {
      let existing: { id: string }[] | null = null;
      {
        let { data, error: selectErr } = await supabase
          .from("wines")
          .select("id")
          .eq("user_id", userId);
        if (selectErr && isTransientFetchError(selectErr)) {
          await sleep(400);
          ({ data, error: selectErr } = await supabase
            .from("wines")
            .select("id")
            .eq("user_id", userId));
        }
        if (selectErr) {
          reportSyncError(
            `No se pudo sincronizar: ${syncErrorMessage(selectErr)}.`
          );
          return;
        }
        existing = data;
      }

      const keep = new Set(list.map((w) => w.id));
      const toDelete = (existing ?? [])
        .map((r) => r.id as string)
        .filter((id) => !keep.has(id));
      if (toDelete.length) {
        const { error: delErr } = await supabase
          .from("wines")
          .delete()
          .eq("user_id", userId)
          .in("id", toDelete);
        if (delErr) {
          reportSyncError(
            `No se pudo sincronizar borrados: ${syncErrorMessage(delErr)}.`
          );
          return;
        }
      }

      if (!list.length) {
        setSyncError(null);
        return;
      }

      let includeCavataleBreakdown = cavataleBreakdownColumnsRef.current;
      let rows = buildRows(includeCavataleBreakdown);
      let { error } = await supabase
        .from("wines")
        .upsert(rows, { onConflict: "user_id,id" });

      for (
        let attempt = 1;
        error && isTransientFetchError(error) && attempt <= 2;
        attempt++
      ) {
        await sleep(350 * attempt);
        ({ error } = await supabase
          .from("wines")
          .upsert(rows, { onConflict: "user_id,id" }));
      }

      if (
        error &&
        includeCavataleBreakdown &&
        /cavatale_parts|cavatale_evidence/i.test(error.message ?? "")
      ) {
        cavataleBreakdownColumnsRef.current = false;
        rows = buildRows(false);
        ({ error } = await supabase
          .from("wines")
          .upsert(rows, { onConflict: "user_id,id" }));
      }

      if (error) {
        reportSyncError(
          `No se pudo guardar en la nube: ${syncErrorMessage(error)}. Los cambios pueden perderse al recargar.`
        );
        return;
      }
      setSyncError(null);
    } catch (e) {
      reportSyncError(
        `No se pudo guardar en la nube: ${syncErrorMessage(e)}. Los cambios pueden perderse al recargar.`
      );
    }
  }, [reportSyncError]);

  const ensureDefaultCellar = useCallback(
    async (
      userId: string,
      existing: CellarUnit[],
      canPersist: boolean
    ): Promise<CellarUnit[]> => {
      if (existing.length > 0) return existing;
      const unit = localDefaultCellar();
      if (!isSupabaseConfigured() || !canPersist) return [unit];
      const supabase = createClient();
      const { error } = await supabase
        .from("cellars")
        .upsert(cellarToRow(unit, userId));
      if (error) {
        multiCellarRef.current = false;
        return [unit];
      }
      return [unit];
    },
    []
  );

  useEffect(() => {
    if (!authReady) return;

    if (!configured || !user) {
      setWines([]);
      setHistory([]);
      setEncounters([]);
      setCellars([]);
      setActiveCellarId(null);
      setCanImportLocal(false);
      setSyncError(null);
      setSyncOk(null);
      allowSyncOkRef.current = false;
      setReady(true);
      userIdRef.current = null;
      multiCellarRef.current = false;
      return;
    }

    let cancelled = false;
    const gen = ++loadGenRef.current;
    userIdRef.current = user.id;
    allowSyncOkRef.current = false;
    setReady(false);

    (async () => {
      const supabase = createClient();
      const [
        { data: cellarRows, error: cellarErr },
        { data: wineRows },
        { data: histRows },
        encResult,
      ] = await Promise.all([
        supabase
          .from("cellars")
          .select("*")
          .eq("user_id", user.id)
          .order("sort_order"),
        supabase.from("wines").select("*").eq("user_id", user.id).order("name"),
        supabase
          .from("cellar_history")
          .select("*")
          .eq("user_id", user.id)
          .order("at", { ascending: false })
          .limit(100),
        supabase
          .from("encounters")
          .select("*")
          .eq("user_id", user.id)
          .order("at", { ascending: false })
          .limit(100),
      ]);

      if (cancelled || gen !== loadGenRef.current) return;

      const multiOk = !cellarErr;
      multiCellarRef.current = multiOk;

      let units = ((cellarRows ?? []) as CellarRow[]).map(cellarFromRow);
      units = await ensureDefaultCellar(user.id, units, multiOk);

      let cloudWines = ((wineRows ?? []) as WineRow[]).map(wineFromRow);
      const primaryId = units[0]?.id ?? null;

      // Assign orphan grid bottles to principal (memory always; persist only if schema ready)
      if (primaryId) {
        const orphans = cloudWines.filter(
          (w) => !w.cellarId && w.slot && w.slot !== "abajo"
        );
        if (orphans.length) {
          cloudWines = cloudWines.map((w) =>
            !w.cellarId && w.slot && w.slot !== "abajo"
              ? { ...w, cellarId: primaryId }
              : w
          );
          if (multiOk) {
            if (gen !== loadGenRef.current) return;
            await persistWines(cloudWines, user.id);
          }
        }
      }

      if (cancelled || gen !== loadGenRef.current) return;

      const cloudHistory = ((histRows ?? []) as HistoryRow[]).map(
        historyFromRow
      );

      let cloudEncounters: Encounter[] = [];
      if (encResult.error && isMissingRelationError(encResult.error)) {
        encountersTableRef.current = false;
        cloudEncounters = loadEncountersLocal();
      } else if (encResult.error) {
        encountersTableRef.current = true;
        cloudEncounters = loadEncountersLocal();
      } else {
        encountersTableRef.current = true;
        cloudEncounters = ((encResult.data ?? []) as EncounterRow[]).map(
          encounterFromRow
        );
        persistEncountersLocal(cloudEncounters);
      }

      setCellars(units);
      setActiveCellarId(units[0]?.id ?? null);
      setWines(cloudWines);
      setHistory(cloudHistory);
      setEncounters(cloudEncounters);

      const local = loadStored();
      const offered = localStorage.getItem(IMPORT_FLAG) === "1";
      setCanImportLocal(
        cloudWines.length === 0 && Boolean(local?.length) && !offered
      );
      setReady(true);
      allowSyncOkRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, configured, user, ensureDefaultCellar, persistWines]);

  const addWine = useCallback(
    (draft: WineDraft) => {
      let created!: Wine;
      setWines((prev) => {
        const withCellar = {
          ...draft,
          cellarId:
            draft.location === "abajo" || !draft.location
              ? null
              : draft.cellarId ?? activeCellarId,
        };
        created = draftToWine(withCellar, createId(prev));
        return [created, ...prev];
      });
      const uid = userIdRef.current;
      if (uid && created) void upsertWineRemote(created, uid);
      return created;
    },
    [activeCellarId, upsertWineRemote]
  );

  const updateWine = useCallback(
    (id: string, draft: WineDraft) => {
      let nextWine: Wine | null = null;
      setWines((prev) =>
        prev.map((w) => {
          if (w.id !== id) return w;
          nextWine = draftToWine(draft, id, w);
          return nextWine;
        })
      );
      const uid = userIdRef.current;
      if (uid && nextWine) void upsertWineRemote(nextWine, uid);
    },
    [upsertWineRemote]
  );

  const verifyWineRating = useCallback(
    (
      id: string,
      verification: RatingVerification,
      options?: { syncVivino?: boolean }
    ) => {
      let nextWine: Wine | null = null;
      setWines((prev) =>
        prev.map((w) => {
          if (w.id !== id) return w;
          nextWine = {
            ...w,
            externalRating: verification.externalRating,
            ratingSource: verification.ratingSource,
            lastCheckedAt: verification.lastCheckedAt,
            matchConfidence: verification.matchConfidence,
            vivino:
              options?.syncVivino && verification.externalRating != null
                ? verification.externalRating
                : w.vivino,
          };
          return nextWine;
        })
      );
      const uid = userIdRef.current;
      if (uid && nextWine) void upsertWineRemote(nextWine, uid);
    },
    [upsertWineRemote]
  );

  const saveKimiResearch = useCallback(
    (id: string, research: KimiResearch) => {
      let touched: Wine[] = [];
      setWines((prev) => {
        const source = prev.find((w) => w.id === id);
        if (!source) return prev;
        const key = wineIdentityKey(source);
        const nextList = prev.map((w) => {
          if (wineIdentityKey(w) !== key) return w;
          return {
            ...w,
            // Prefer research score; keep existing if research returned null.
            cavataleRating:
              research.cavataleRating != null
                ? research.cavataleRating
                : w.cavataleRating,
            cavataleParts:
              research.cavataleParts != null
                ? research.cavataleParts
                : research.cavataleRating != null
                  ? null
                  : w.cavataleParts,
            cavataleEvidence:
              research.cavataleEvidence != null
                ? research.cavataleEvidence
                : research.cavataleRating != null
                  ? null
                  : w.cavataleEvidence,
            kimiVivino: research.kimiVivino,
            kimiPrice: research.kimiPrice,
            kimiPriceCurrency:
              research.kimiPrice != null
                ? research.kimiPriceCurrency ?? "MXN"
                : w.kimiPriceCurrency,
            kimiSummary: research.kimiSummary,
            kimiCuriosity: research.kimiCuriosity,
            kimiTalkHook: research.kimiTalkHook,
            kimiPairings: research.kimiPairings,
            kimiPairingNote: research.kimiPairingNote,
            kimiCheckedAt: research.kimiCheckedAt,
            kimiConfidence: research.kimiConfidence,
            // Prefill empty ficha price from Kimi; never overwrite a user value.
            price:
              w.price == null && research.kimiPrice != null
                ? research.kimiPrice
                : w.price,
            priceCurrency:
              w.price == null && research.kimiPrice != null
                ? research.kimiPriceCurrency ?? "MXN"
                : w.priceCurrency,
          };
        });
        touched = nextList.filter((w) => wineIdentityKey(w) === key);
        return nextList;
      });
      const uid = userIdRef.current;
      if (uid) {
        for (const w of touched) void upsertWineRemote(w, uid);
      }
      return touched.length;
    },
    [upsertWineRemote]
  );

  const saveKimiUserNote = useCallback(
    (id: string, note: string | null) => {
      let touched: Wine[] = [];
      setWines((prev) => {
        const source = prev.find((w) => w.id === id);
        if (!source) return prev;
        const key = wineIdentityKey(source);
        const nextList = prev.map((w) => {
          if (wineIdentityKey(w) !== key) return w;
          return { ...w, kimiUserNote: note };
        });
        touched = nextList.filter((w) => wineIdentityKey(w) === key);
        return nextList;
      });
      const uid = userIdRef.current;
      if (uid) {
        for (const w of touched) void upsertWineRemote(w, uid);
      }
      return touched.length;
    },
    [upsertWineRemote]
  );

  const setLabelImageUrl = useCallback(
    (id: string, labelImageUrl: string | null) => {
      let nextWine: Wine | null = null;
      setWines((prev) =>
        prev.map((w) => {
          if (w.id !== id) return w;
          nextWine = { ...w, labelImageUrl };
          return nextWine;
        })
      );
      const uid = userIdRef.current;
      if (uid && nextWine) void upsertWineRemote(nextWine, uid);
    },
    [upsertWineRemote]
  );

  const saveVerifiedPrice = useCallback(
    (id: string, result: { amount: number; currency: string }) => {
      let touched: Wine[] = [];
      const currency = result.currency.trim().toUpperCase() || "MXN";
      setWines((prev) => {
        const source = prev.find((w) => w.id === id);
        if (!source) return prev;
        const key = wineIdentityKey(source);
        const nextList = prev.map((w) => {
          if (wineIdentityKey(w) !== key) return w;
          return {
            ...w,
            kimiPrice: result.amount,
            kimiPriceCurrency: currency,
          };
        });
        touched = nextList.filter((w) => wineIdentityKey(w) === key);
        return nextList;
      });
      const uid = userIdRef.current;
      if (uid) {
        for (const w of touched) void upsertWineRemote(w, uid);
      }
      return touched.length;
    },
    [upsertWineRemote]
  );

  const applyKimiResearch = useCallback(
    (id: string, fields: { vivino?: boolean; price?: boolean }) => {
      let touched: Wine[] = [];
      setWines((prev) => {
        const source = prev.find((w) => w.id === id);
        if (!source) return prev;
        const key = wineIdentityKey(source);
        const nextList = prev.map((w) => {
          if (wineIdentityKey(w) !== key) return w;
          return {
            ...w,
            vivino:
              fields.vivino && w.kimiVivino != null ? w.kimiVivino : w.vivino,
            price: fields.price && w.kimiPrice != null ? w.kimiPrice : w.price,
            priceCurrency:
              fields.price && w.kimiPrice != null
                ? w.kimiPriceCurrency ?? "MXN"
                : w.priceCurrency,
          };
        });
        touched = nextList.filter((w) => wineIdentityKey(w) === key);
        return nextList;
      });
      const uid = userIdRef.current;
      if (uid) {
        for (const w of touched) void upsertWineRemote(w, uid);
      }
      return touched.length;
    },
    [upsertWineRemote]
  );

  const moveWine = useCallback(
    (
      wineId: string,
      targetLocation: string,
      targetCellarId?: string | null
    ) => {
      const uid = userIdRef.current;
      const loc = parseLocation(targetLocation);
      const destCellar =
        loc.slot === "abajo" || !loc.slot
          ? null
          : targetCellarId !== undefined
            ? targetCellarId
            : activeCellarId;

      setWines((prev) => {
        const wine = prev.find((w) => w.id === wineId);
        if (!wine) return prev;

        const occupant =
          loc.slot && loc.slot !== "abajo"
            ? prev.find(
                (w) =>
                  w.id !== wineId &&
                  w.slot === loc.slot &&
                  (w.cellarId ?? null) === (destCellar ?? null)
              )
            : null;

        const next = prev.map((w) => {
          if (w.id === wineId) {
            return {
              ...w,
              cellarId: destCellar,
              slot: loc.slot,
              col: loc.col,
              row: loc.row,
            };
          }
          if (occupant && w.id === occupant.id) {
            return {
              ...w,
              cellarId: wine.cellarId,
              slot: wine.slot,
              col: wine.col,
              row: wine.row,
            };
          }
          return w;
        });

        if (uid) {
          const a = next.find((w) => w.id === wineId);
          const b = occupant
            ? next.find((w) => w.id === occupant.id)
            : null;
          if (a) void upsertWineRemote(a, uid);
          if (b) void upsertWineRemote(b, uid);
        }

        return next;
      });
    },
    [activeCellarId, upsertWineRemote]
  );

  const removeWine = useCallback(
    (id: string) => {
      setWines((prev) => prev.filter((w) => w.id !== id));
      const uid = userIdRef.current;
      if (uid) void deleteWineRemote(id, uid);
    },
    [deleteWineRemote]
  );

  const departWine = useCallback(
    (id: string, action: DepartAction, extras?: DepartExtras) => {
      const uid = userIdRef.current;
      setWines((prev) => {
        const wine = prev.find((w) => w.id === id);
        if (!wine) return prev;
        const entry: CellarLogEntry = {
          id: `h-${Date.now()}-${id}`,
          at: new Date().toISOString(),
          action,
          wine: snapshotWine(wine),
          myRating: extras?.myRating ?? null,
          note: extras?.note?.trim() ? extras.note.trim() : null,
        };
        setHistory((h) => [entry, ...h].slice(0, 100));
        if (uid) {
          void insertHistoryRemote(entry, uid);
          void deleteWineRemote(id, uid);
        }
        return prev.filter((w) => w.id !== id);
      });
    },
    [deleteWineRemote, insertHistoryRemote]
  );

  const saveEncounter = useCallback(
    (input: Omit<Encounter, "id" | "at"> & { id?: string; at?: string }) => {
      const entry: Encounter = {
        id: input.id ?? `e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: input.at ?? new Date().toISOString(),
        wineId: input.wineId ?? null,
        name: input.name.trim(),
        winery: (input.winery ?? "").trim(),
        country: (input.country ?? "").trim(),
        region: (input.region ?? "").trim(),
        type: (input.type ?? "").trim() || "Tinto",
        grape: (input.grape ?? "").trim(),
        aging: (input.aging ?? "").trim(),
        vintage: input.vintage ?? null,
        cavataleRating: input.cavataleRating ?? null,
        cavataleParts: input.cavataleParts ?? null,
        cavataleEvidence: input.cavataleEvidence ?? null,
        kimiSummary: input.kimiSummary ?? null,
        kimiCuriosity: input.kimiCuriosity ?? null,
        kimiTalkHook: input.kimiTalkHook ?? null,
        kimiPairings: input.kimiPairings ?? null,
        kimiPairingNote: input.kimiPairingNote ?? null,
        kimiCheckedAt: input.kimiCheckedAt ?? null,
        kimiConfidence: input.kimiConfidence ?? null,
        place: input.place?.trim() ? input.place.trim() : null,
        note: input.note?.trim() ? input.note.trim() : null,
      };
      let nextList: Encounter[] = [];
      setEncounters((prev) => {
        nextList = [entry, ...prev.filter((e) => e.id !== entry.id)].slice(
          0,
          100
        );
        return nextList;
      });
      const uid = userIdRef.current;
      if (uid) void upsertEncounterRemote(entry, uid, nextList);
      else persistEncountersLocal(nextList);
      return entry;
    },
    [upsertEncounterRemote]
  );

  const removeEncounter = useCallback(
    (id: string) => {
      let nextList: Encounter[] = [];
      setEncounters((prev) => {
        nextList = prev.filter((e) => e.id !== id);
        return nextList;
      });
      const uid = userIdRef.current;
      if (uid) void deleteEncounterRemote(id, uid, nextList);
      else persistEncountersLocal(nextList);
    },
    [deleteEncounterRemote]
  );

  const resetCellar = useCallback(async () => {
    const uid = userIdRef.current;
    // Invalidate any in-flight cloud fetch so it can't resurrect bottles.
    loadGenRef.current += 1;
    setWines([]);
    setHistory([]);
    setCanImportLocal(false);
    try {
      localStorage.setItem(IMPORT_FLAG, "1");
      // Shared device: don't keep a browser copy that can be re-imported by mistake.
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      /* ignore */
    }

    if (!uid || !isSupabaseConfigured()) return;

    try {
      const res = await fetch("/api/clear-cellar", { method: "POST" });
      const raw = await res.text();
      let payload: { error?: string; remaining?: number; deleted?: number } =
        {};
      try {
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        /* ignore */
      }

      if (!res.ok) {
        console.warn("vaciar cava failed", payload.error || res.status);
        alert(
          payload.error ||
            "No se pudo vaciar la cava en la nube. Cierra sesión, vuelve a entrar e inténtalo."
        );
        // Reload from cloud so UI matches reality
        loadGenRef.current += 1;
        window.location.reload();
        return;
      }

      if ((payload.remaining ?? 0) > 0) {
        alert(
          `Aún quedan ${payload.remaining} botellas en la nube. Prueba otra vez o cierra sesión y vuelve a entrar.`
        );
        window.location.reload();
        return;
      }
    } catch (e) {
      console.warn("vaciar cava network error", e);
      alert("No hubo conexión al vaciar. Inténtalo de nuevo.");
      window.location.reload();
    }
  }, []);

  const importLocalCellar = useCallback(async () => {
    const uid = userIdRef.current;
    const local = loadStored();
    const localHist = loadHistoryLocal();
    if (!local?.length) {
      setCanImportLocal(false);
      return;
    }
    let units = cellars;
    if (!units.length && uid) {
      units = await ensureDefaultCellar(uid, [], multiCellarRef.current);
      setCellars(units);
      setActiveCellarId(units[0]?.id ?? null);
    }
    const primary = units[0]?.id ?? null;
    const mapped = local.map((w) =>
      normalizeWine({
        ...w,
        cellarId:
          w.slot && w.slot !== "abajo" ? w.cellarId ?? primary : null,
      })
    );
    setWines(mapped);
    if (localHist.length) setHistory(localHist);
    setCanImportLocal(false);
    localStorage.setItem(IMPORT_FLAG, "1");
    if (uid) {
      await persistWines(mapped, uid);
      if (localHist.length && isSupabaseConfigured()) {
        const supabase = createClient();
        await supabase
          .from("cellar_history")
          .upsert(
            localHist.map((e) => historyToRow(e, uid)),
            { onConflict: "user_id,id" }
          );
      }
    }
  }, [cellars, ensureDefaultCellar, persistWines]);

  const dismissImportOffer = useCallback(() => {
    localStorage.setItem(IMPORT_FLAG, "1");
    setCanImportLocal(false);
  }, []);

  const addCellarUnit = useCallback(
    async (input: { name: string; cols: number; rows: string[] }) => {
      const uid = userIdRef.current;
      if (!uid || !isSupabaseConfigured()) return null;
      if (!multiCellarRef.current) {
        // Schema not migrated yet — keep UI usable with a local-only unit
        const unit: CellarUnit = {
          id: crypto.randomUUID(),
          name: input.name.trim() || "Mueble",
          cols: Math.min(24, Math.max(1, input.cols)),
          rows: input.rows.length ? input.rows : [...DEFAULT_CELLAR_ROWS],
          sortOrder: cellars.length,
        };
        setCellars((prev) => [...prev, unit]);
        setActiveCellarId(unit.id);
        return unit;
      }
      const unit: CellarUnit = {
        id: crypto.randomUUID(),
        name: input.name.trim() || "Mueble",
        cols: Math.min(24, Math.max(1, input.cols)),
        rows: input.rows.length ? input.rows : [...DEFAULT_CELLAR_ROWS],
        sortOrder: cellars.length,
      };
      const supabase = createClient();
      const { error } = await supabase
        .from("cellars")
        .insert(cellarToRow(unit, uid));
      if (error) {
        if (isMissingRelationError(error)) {
          multiCellarRef.current = false;
          setCellars((prev) => [...prev, unit]);
          setActiveCellarId(unit.id);
          return unit;
        }
        return null;
      }
      setCellars((prev) => [...prev, unit]);
      setActiveCellarId(unit.id);
      return unit;
    },
    [cellars.length]
  );

  const updateCellarUnit = useCallback(
    async (
      id: string,
      patch: Partial<Pick<CellarUnit, "name" | "cols" | "rows">>
    ) => {
      const uid = userIdRef.current;
      const current = cellars.find((c) => c.id === id);
      if (!uid || !current || !isSupabaseConfigured()) return;
      const next: CellarUnit = {
        ...current,
        ...patch,
        cols: patch.cols
          ? Math.min(24, Math.max(1, patch.cols))
          : current.cols,
      };
      const supabase = createClient();
      await supabase
        .from("cellars")
        .update(cellarToRow(next, uid))
        .eq("id", id)
        .eq("user_id", uid);
      setCellars((prev) => prev.map((c) => (c.id === id ? next : c)));
    },
    [cellars]
  );

  const deleteCellarUnit = useCallback(
    async (id: string) => {
      const uid = userIdRef.current;
      if (!uid || !isSupabaseConfigured()) return;
      if (cellars.length <= 1) return;
      const supabase = createClient();
      // Detach wines first
      setWines((prev) =>
        prev.map((w) =>
          w.cellarId === id
            ? { ...w, cellarId: null, slot: null, col: null, row: null }
            : w
        )
      );
      await supabase
        .from("wines")
        .update({ cellar_id: null, slot: null, col: null, row: null })
        .eq("user_id", uid)
        .eq("cellar_id", id);
      await supabase.from("cellars").delete().eq("id", id).eq("user_id", uid);
      setCellars((prev) => {
        const next = prev.filter((c) => c.id !== id);
        setActiveCellarId((cur) =>
          cur === id ? next[0]?.id ?? null : cur
        );
        return next;
      });
    },
    [cellars.length]
  );

  const value = useMemo(
    () => ({
      wines,
      history,
      encounters,
      cellars,
      activeCellarId: activeCellar?.id ?? null,
      setActiveCellarId,
      activeCellar,
      ready: ready && authReady,
      canImportLocal,
      syncError,
      clearSyncError,
      syncOk,
      clearSyncOk,
      isOnline,
      addWine,
      updateWine,
      verifyWineRating,
      saveKimiResearch,
      saveKimiUserNote,
      saveVerifiedPrice,
      setLabelImageUrl,
      applyKimiResearch,
      moveWine,
      removeWine,
      departWine,
      saveEncounter,
      removeEncounter,
      resetCellar,
      importLocalCellar,
      dismissImportOffer,
      addCellarUnit,
      updateCellarUnit,
      deleteCellarUnit,
    }),
    [
      wines,
      history,
      encounters,
      cellars,
      activeCellar,
      ready,
      authReady,
      canImportLocal,
      syncError,
      clearSyncError,
      syncOk,
      clearSyncOk,
      isOnline,
      addWine,
      updateWine,
      verifyWineRating,
      saveKimiResearch,
      saveKimiUserNote,
      saveVerifiedPrice,
      setLabelImageUrl,
      applyKimiResearch,
      moveWine,
      removeWine,
      departWine,
      saveEncounter,
      removeEncounter,
      resetCellar,
      importLocalCellar,
      dismissImportOffer,
      addCellarUnit,
      updateCellarUnit,
      deleteCellarUnit,
    ]
  );

  return (
    <CellarContext.Provider value={value}>{children}</CellarContext.Provider>
  );
}

export function useCellar() {
  const ctx = useContext(CellarContext);
  if (!ctx) throw new Error("useCellar must be used within CellarProvider");
  return ctx;
}
