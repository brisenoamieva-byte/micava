import type { Wine } from "@/lib/types";
import { formatPrice, formatCavataleRating } from "@/lib/wines";

export const CAVATALE_URL = "https://cavatale.com";
export const CAVATALE_REGISTRO_URL = `${CAVATALE_URL}/registro`;

/** Invite a relative/friend with a plain explanation of what Cavatale does. */
export function buildInviteFriendText(): string {
  return [
    "Te invito a Cavatale — es gratis.",
    "",
    "Sirve para tres cosas:",
    "1) Tomar foto de la etiqueta y guardar la botella (rating y precio).",
    "2) Ver tu cava en un mapa (dónde está cada una).",
    "3) Pedir la historia del vino para contar en la mesa.",
    "",
    "También puedes compartir el link de tu cava con alguien.",
    "",
    `Crea tu cava aquí (1 minuto): ${CAVATALE_REGISTRO_URL}`,
  ].join("\n");
}

export type ShareDiscovery = {
  story?: string | null;
  curiosity?: string | null;
  talkHook?: string | null;
};

/** WhatsApp-friendly plain text: bottle + story hooks + brand link. */
export function buildWineShareText(
  wine: Pick<
    Wine,
    | "name"
    | "winery"
    | "vintage"
    | "region"
    | "cavataleRating"
    | "price"
    | "slot"
    | "kimiSummary"
    | "kimiCuriosity"
    | "kimiTalkHook"
  >,
  discovery?: ShareDiscovery
): string {
  const story = discovery?.story ?? wine.kimiSummary;
  const curiosity = discovery?.curiosity ?? wine.kimiCuriosity;
  const talkHook = discovery?.talkHook ?? wine.kimiTalkHook;

  const ratingLine =
    wine.cavataleRating != null
      ? `Cavatale ${formatCavataleRating(wine.cavataleRating)} · ${formatPrice(wine.price)}`
      : formatPrice(wine.price);

  const lines = [
    wine.name,
    [wine.winery, wine.vintage, wine.region].filter(Boolean).join(" · "),
    ratingLine,
    wine.slot ? `Ubicación: ${wine.slot}` : null,
    story ? `\n${story}` : null,
    curiosity ? `\nDato curioso: ${curiosity}` : null,
    talkHook ? `\nPara la mesa: ${talkHook}` : null,
    `\n${CAVATALE_URL}`,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
}

/** Short WhatsApp-friendly invite to a public cellar link. */
export function buildPublicCellarShareText(url: string): string {
  return [`Te comparto mi cava en Cavatale.`, "", url].join("\n");
}

export async function shareOrCopyText(
  text: string,
  title?: string
): Promise<"shared" | "copied" | "cancelled"> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share({ title: title ?? "Cavatale", text });
      return "shared";
    }
  } catch (e) {
    // User dismissed the sheet — not an error.
    if (e instanceof DOMException && e.name === "AbortError") {
      return "cancelled";
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "cancelled";
  }
}
