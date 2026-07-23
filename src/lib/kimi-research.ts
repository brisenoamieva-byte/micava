import type { MatchConfidence, Wine } from "@/lib/types";
import { extractJsonObject } from "@/lib/scan-label";

export type KimiResearch = {
  kimiVivino: number | null;
  kimiPrice: number | null;
  kimiSummary: string | null;
  kimiCuriosity: string | null;
  kimiTalkHook: string | null;
  kimiCheckedAt: string | null;
  kimiConfidence: MatchConfidence | null;
};

export const emptyKimiResearch: KimiResearch = {
  kimiVivino: null,
  kimiPrice: null,
  kimiSummary: null,
  kimiCuriosity: null,
  kimiTalkHook: null,
  kimiCheckedAt: null,
  kimiConfidence: null,
};

export function withKimiDefaults<T extends Partial<Wine>>(
  wine: T
): T & KimiResearch & { labelImageUrl: string | null } {
  return {
    ...wine,
    labelImageUrl: wine.labelImageUrl ?? null,
    kimiVivino: wine.kimiVivino ?? null,
    kimiPrice: wine.kimiPrice ?? null,
    kimiSummary: wine.kimiSummary ?? null,
    kimiCuriosity: wine.kimiCuriosity ?? null,
    kimiTalkHook: wine.kimiTalkHook ?? null,
    kimiCheckedAt: wine.kimiCheckedAt ?? null,
    kimiConfidence: wine.kimiConfidence ?? null,
  };
}

function asOptionalNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n =
    typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function asString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : value == null
      ? ""
      : String(value).trim();
}

export function parseKimiResearchPayload(raw: unknown): Omit<
  KimiResearch,
  "kimiCheckedAt"
> {
  if (!raw || typeof raw !== "object") {
    throw new Error("Respuesta de investigación inválida.");
  }
  const o = raw as Record<string, unknown>;

  let kimiVivino = asOptionalNumber(o.vivino ?? o.kimiVivino);
  if (kimiVivino != null) {
    kimiVivino = Math.round(kimiVivino * 10) / 10;
    if (kimiVivino < 1 || kimiVivino > 5) kimiVivino = null;
  }

  let kimiPrice = asOptionalNumber(o.price ?? o.kimiPrice);
  if (kimiPrice != null) {
    kimiPrice = Math.round(kimiPrice);
    if (kimiPrice <= 0 || kimiPrice > 1_000_000) kimiPrice = null;
  }

  const confRaw = asString(o.confidence ?? o.kimiConfidence).toLowerCase();
  const mapped: MatchConfidence | null =
    confRaw === "high" || confRaw === "confirmed"
      ? "confirmed"
      : confRaw === "medium" || confRaw === "likely"
        ? "likely"
        : confRaw === "low" || confRaw === "uncertain"
          ? "uncertain"
          : null;

  return {
    kimiVivino,
    kimiPrice,
    kimiSummary: asString(o.summary ?? o.notes ?? o.kimiSummary) || null,
    kimiCuriosity:
      asString(o.curiosity ?? o.kimiCuriosity ?? o.dato_curioso) || null,
    kimiTalkHook:
      asString(
        o.talkHook ?? o.talk_hook ?? o.kimiTalkHook ?? o.conversation
      ) || null,
    kimiConfidence: mapped,
  };
}

export function parseKimiResearchFromModelText(text: string): Omit<
  KimiResearch,
  "kimiCheckedAt"
> {
  return parseKimiResearchPayload(extractJsonObject(text));
}

export function wineIdentityForResearch(wine: Pick<
  Wine,
  | "name"
  | "winery"
  | "country"
  | "region"
  | "type"
  | "grape"
  | "aging"
  | "vintage"
  | "vivino"
  | "price"
>): string {
  return [
    `Nombre: ${wine.name}`,
    `Bodega: ${wine.winery || "—"}`,
    `País: ${wine.country || "—"}`,
    `Región: ${wine.region || "—"}`,
    `Tipo: ${wine.type || "—"}`,
    `Uva: ${wine.grape || "—"}`,
    `Añejamiento: ${wine.aging || "—"}`,
    `Año: ${wine.vintage ?? "—"}`,
    `Vivino guardado en Mi Cava: ${wine.vivino ?? "sin dato"}`,
    `Precio guardado en Mi Cava (MXN): ${wine.price ?? "sin dato"}`,
  ].join("\n");
}
