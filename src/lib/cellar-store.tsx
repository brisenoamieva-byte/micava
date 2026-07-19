"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { RatingVerification } from "@/lib/rating-verify";
import { emptyVerification, withVerificationDefaults } from "@/lib/rating-verify";
import type {
  CellarLogEntry,
  DepartAction,
  Wine,
  WineDraft,
} from "@/lib/types";
import { parseLocation, seedWines } from "@/lib/wines";

const STORAGE_KEY = "micava.wines.v1";
const HISTORY_KEY = "micava.history.v1";

type CellarContextValue = {
  wines: Wine[];
  history: CellarLogEntry[];
  ready: boolean;
  addWine: (draft: WineDraft) => Wine;
  updateWine: (id: string, draft: WineDraft) => void;
  verifyWineRating: (
    id: string,
    verification: RatingVerification,
    options?: { syncVivino?: boolean }
  ) => void;
  moveWine: (wineId: string, targetLocation: string) => void;
  removeWine: (id: string) => void;
  /** Remove from cellar and append to history (opened / gifted / removed). */
  departWine: (id: string, action: DepartAction) => void;
  resetCellar: () => void;
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
  return {
    id,
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
    if (!Array.isArray(parsed)) return null;
    return parsed.map(normalizeWine);
  } catch {
    return null;
  }
}

function loadHistory(): CellarLogEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CellarLogEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
    location: wine.slot ?? "",
  };
}

function seedWithDefaults(): Wine[] {
  return seedWines.map((w) => normalizeWine({ ...w, ...emptyVerification }));
}

export function CellarProvider({ children }: { children: ReactNode }) {
  const [wines, setWines] = useState<Wine[]>(() => seedWithDefaults());
  const [history, setHistory] = useState<CellarLogEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadStored();
    if (stored) setWines(stored);
    setHistory(loadHistory());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(wines));
  }, [wines, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history, ready]);

  const addWine = useCallback((draft: WineDraft) => {
    let created!: Wine;
    setWines((prev) => {
      created = draftToWine(draft, createId(prev));
      return [created, ...prev];
    });
    if (!created) {
      created = draftToWine(draft, `w${Date.now()}`);
      setWines((prev) => [created, ...prev.filter((w) => w.id !== created.id)]);
    }
    return created;
  }, []);

  const updateWine = useCallback((id: string, draft: WineDraft) => {
    setWines((prev) =>
      prev.map((w) => (w.id === id ? draftToWine(draft, id, w) : w))
    );
  }, []);

  const verifyWineRating = useCallback(
    (
      id: string,
      verification: RatingVerification,
      options?: { syncVivino?: boolean }
    ) => {
      setWines((prev) =>
        prev.map((w) => {
          if (w.id !== id) return w;
          return {
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
        })
      );
    },
    []
  );

  const moveWine = useCallback((wineId: string, targetLocation: string) => {
    setWines((prev) => {
      const wine = prev.find((w) => w.id === wineId);
      if (!wine) return prev;

      const loc = parseLocation(targetLocation);
      const nextSlot = loc.slot;
      if (wine.slot === nextSlot) return prev;

      const occupant =
        nextSlot && nextSlot !== "abajo"
          ? prev.find((w) => w.slot === nextSlot && w.id !== wineId)
          : null;

      return prev.map((w) => {
        if (w.id === wineId) {
          return { ...w, slot: nextSlot, col: loc.col, row: loc.row };
        }
        if (occupant && w.id === occupant.id) {
          return {
            ...w,
            slot: wine.slot,
            col: wine.col,
            row: wine.row,
          };
        }
        return w;
      });
    });
  }, []);

  const removeWine = useCallback((id: string) => {
    setWines((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const departWine = useCallback((id: string, action: DepartAction) => {
    setWines((prev) => {
      const wine = prev.find((w) => w.id === id);
      if (!wine) return prev;
      const entry: CellarLogEntry = {
        id: `h-${Date.now()}-${id}`,
        at: new Date().toISOString(),
        action,
        wine: snapshotWine(wine),
      };
      setHistory((h) => [entry, ...h].slice(0, 100));
      return prev.filter((w) => w.id !== id);
    });
  }, []);

  const resetCellar = useCallback(() => {
    const fresh = seedWithDefaults();
    setWines(fresh);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
  }, []);

  const value = useMemo(
    () => ({
      wines,
      history,
      ready,
      addWine,
      updateWine,
      verifyWineRating,
      moveWine,
      removeWine,
      departWine,
      resetCellar,
    }),
    [
      wines,
      history,
      ready,
      addWine,
      updateWine,
      verifyWineRating,
      moveWine,
      removeWine,
      departWine,
      resetCellar,
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
