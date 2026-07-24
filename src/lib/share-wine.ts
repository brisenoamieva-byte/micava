import type { Wine } from "@/lib/types";
import { formatPrice, formatVivino } from "@/lib/wines";

export const CAVATALE_URL = "https://cavatale.com";
export const CAVATALE_REGISTRO_URL = `${CAVATALE_URL}/registro`;

/** Invite a collector friend to create their own cava. */
export function buildInviteFriendText(): string {
  return [
    "Estoy armando mi cava en Cavatale — historias de las botellas, no solo Vivino.",
    `Crea la tuya: ${CAVATALE_REGISTRO_URL}`,
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
    | "vivino"
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

  const lines = [
    wine.name,
    [wine.winery, wine.vintage, wine.region].filter(Boolean).join(" · "),
    `Vivino ${formatVivino(wine.vivino)} · ${formatPrice(wine.price)}`,
    wine.slot ? `Ubicación: ${wine.slot}` : null,
    story ? `\n${story}` : null,
    curiosity ? `\nDato curioso: ${curiosity}` : null,
    talkHook ? `\nPara la mesa: ${talkHook}` : null,
    `\n${CAVATALE_URL}`,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n");
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
