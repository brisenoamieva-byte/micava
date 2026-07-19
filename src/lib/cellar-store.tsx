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
import { useAuth } from "@/lib/auth-store";
import type { RatingVerification } from "@/lib/rating-verify";
import { emptyVerification, withVerificationDefaults } from "@/lib/rating-verify";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  cellarFromRow,
  cellarToRow,
  DEFAULT_CELLAR_COLS,
  DEFAULT_CELLAR_ROWS,
  historyFromRow,
  historyToRow,
  wineFromRow,
  wineToRow,
  type CellarRow,
  type HistoryRow,
  type WineRow,
} from "@/lib/supabase/map";
import type {
  CellarLogEntry,
  CellarUnit,
  DepartAction,
  DepartExtras,
  Wine,
  WineDraft,
} from "@/lib/types";
import { parseLocation, seedWines } from "@/lib/wines";

const STORAGE_KEY = "micava.wines.v1";
const HISTORY_KEY = "micava.history.v1";
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

type CellarContextValue = {
  wines: Wine[];
  history: CellarLogEntry[];
  cellars: CellarUnit[];
  activeCellarId: string | null;
  setActiveCellarId: (id: string | null) => void;
  activeCellar: CellarUnit | null;
  ready: boolean;
  canImportLocal: boolean;
  addWine: (draft: WineDraft) => Wine;
  updateWine: (id: string, draft: WineDraft) => void;
  verifyWineRating: (
    id: string,
    verification: RatingVerification,
    options?: { syncVivino?: boolean }
  ) => void;
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
  resetCellar: () => void;
  loadDemoSeed: () => Promise<void>;
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
    price: draft.price,
    externalRating: existing?.externalRating ?? null,
    ratingSource: existing?.ratingSource ?? null,
    lastCheckedAt: existing?.lastCheckedAt ?? null,
    matchConfidence: existing?.matchConfidence ?? null,
  };
}

function normalizeWine(raw: Wine): Wine {
  return withVerificationDefaults({ ...raw });
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

function seedWithDefaults(cellarId: string | null): Wine[] {
  return seedWines.map((w) =>
    normalizeWine({
      ...w,
      ...emptyVerification,
      cellarId: w.slot && w.slot !== "abajo" ? cellarId : null,
    })
  );
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
  const [cellars, setCellars] = useState<CellarUnit[]>([]);
  const [activeCellarId, setActiveCellarId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [canImportLocal, setCanImportLocal] = useState(false);
  const userIdRef = useRef<string | null>(null);
  /** False until `cellars` + `wines.cellar_id` exist in Supabase. */
  const multiCellarRef = useRef(false);

  const activeCellar = useMemo(
    () => cellars.find((c) => c.id === activeCellarId) ?? cellars[0] ?? null,
    [cellars, activeCellarId]
  );

  const upsertWineRemote = useCallback(async (wine: Wine, userId: string) => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const row = wineToRow(wine, userId, {
      includeCellarId: multiCellarRef.current,
    });
    await supabase.from("wines").upsert(row, { onConflict: "user_id,id" });
  }, []);

  const deleteWineRemote = useCallback(async (id: string, userId: string) => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    await supabase.from("wines").delete().eq("user_id", userId).eq("id", id);
  }, []);

  const insertHistoryRemote = useCallback(
    async (entry: CellarLogEntry, userId: string) => {
      if (!isSupabaseConfigured()) return;
      const supabase = createClient();
      await supabase.from("cellar_history").upsert(historyToRow(entry, userId), {
        onConflict: "user_id,id",
      });
    },
    []
  );

  const persistWines = useCallback(async (list: Wine[], userId: string) => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const rows = list.map((w) =>
      wineToRow(w, userId, { includeCellarId: multiCellarRef.current })
    );
    const { data: existing } = await supabase
      .from("wines")
      .select("id")
      .eq("user_id", userId);
    const keep = new Set(list.map((w) => w.id));
    const toDelete = (existing ?? [])
      .map((r) => r.id as string)
      .filter((id) => !keep.has(id));
    if (toDelete.length) {
      await supabase
        .from("wines")
        .delete()
        .eq("user_id", userId)
        .in("id", toDelete);
    }
    if (rows.length) {
      await supabase.from("wines").upsert(rows, { onConflict: "user_id,id" });
    }
  }, []);

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
      setCellars([]);
      setActiveCellarId(null);
      setCanImportLocal(false);
      setReady(true);
      userIdRef.current = null;
      multiCellarRef.current = false;
      return;
    }

    let cancelled = false;
    userIdRef.current = user.id;
    setReady(false);

    (async () => {
      const supabase = createClient();
      const [
        { data: cellarRows, error: cellarErr },
        { data: wineRows },
        { data: histRows },
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
      ]);

      if (cancelled) return;

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
            await persistWines(cloudWines, user.id);
          }
        }
      }

      const cloudHistory = ((histRows ?? []) as HistoryRow[]).map(
        historyFromRow
      );

      setCellars(units);
      setActiveCellarId(units[0]?.id ?? null);
      setWines(cloudWines);
      setHistory(cloudHistory);

      const local = loadStored();
      const offered = localStorage.getItem(IMPORT_FLAG) === "1";
      setCanImportLocal(
        cloudWines.length === 0 && Boolean(local?.length) && !offered
      );
      setReady(true);
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

  const resetCellar = useCallback(() => {
    const uid = userIdRef.current;
    setWines([]);
    if (uid && isSupabaseConfigured()) {
      const supabase = createClient();
      void supabase.from("wines").delete().eq("user_id", uid);
    }
  }, []);

  const loadDemoSeed = useCallback(async () => {
    const uid = userIdRef.current;
    let units = cellars;
    if (!units.length && uid) {
      units = await ensureDefaultCellar(uid, [], multiCellarRef.current);
      setCellars(units);
      setActiveCellarId(units[0]?.id ?? null);
    }
    const primary = units[0]?.id ?? null;
    const fresh = seedWithDefaults(primary);
    setWines(fresh);
    setCanImportLocal(false);
    localStorage.setItem(IMPORT_FLAG, "1");
    if (uid) await persistWines(fresh, uid);
  }, [cellars, ensureDefaultCellar, persistWines]);

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
      cellars,
      activeCellarId: activeCellar?.id ?? null,
      setActiveCellarId,
      activeCellar,
      ready: ready && authReady,
      canImportLocal,
      addWine,
      updateWine,
      verifyWineRating,
      moveWine,
      removeWine,
      departWine,
      resetCellar,
      loadDemoSeed,
      importLocalCellar,
      dismissImportOffer,
      addCellarUnit,
      updateCellarUnit,
      deleteCellarUnit,
    }),
    [
      wines,
      history,
      cellars,
      activeCellar,
      ready,
      authReady,
      canImportLocal,
      addWine,
      updateWine,
      verifyWineRating,
      moveWine,
      removeWine,
      departWine,
      resetCellar,
      loadDemoSeed,
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
