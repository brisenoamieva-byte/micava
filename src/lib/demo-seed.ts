import { seedWines } from "@/lib/wines";
import type { Wine } from "@/lib/types";
import { withKimiDefaults } from "@/lib/kimi-research";
import { withVerificationDefaults } from "@/lib/rating-verify";

/** Source bottle ids from the founder cellar (unique labels). */
const DEMO_SOURCE_IDS = [
  "w001", // LAN A MANO — España (story)
  "w002", // 1000 Stories — USA (story)
  "w003", // Borgogno — Italia (story)
  "w025", // Monte Xanic — México
  "w043", // Viña Alberdi — España
  "w051", // Catena — Argentina
] as const;

/** Compact slots so the map looks like a small demo cava, not a full wall. */
const DEMO_SLOTS = ["1A", "2A", "3A", "1B", "2B", "3B"] as const;

type StoryOverride = {
  kimiSummary: string;
  kimiCuriosity: string;
  kimiTalkHook: string;
  kimiPairings: string[];
  kimiPairingNote: string;
};

/** Extra stories for demo bottles that don't carry them in wines.json. */
const STORY_OVERRIDES: Record<string, StoryOverride> = {
  w025: {
    kimiSummary:
      "Monte Xanic es una de las bodegas que pusieron a Valle de Guadalupe en el mapa: precisión técnica y orgullo de origen mexicano. Esta botella no es souvenir — es la prueba de que el vino de Ensenada puede competir sin pedir permiso.",
    kimiCuriosity:
      "El nombre Xanic evoca lo 'hermoso' en lengua indígena local; la bodega nació en los 80 cuando pocos apostaban por vinos serios en México. Hoy es referencia para quien quiere entender el valle más allá del turismo.",
    kimiTalkHook:
      "Si tuvieras que convencer a un escéptico de que México hace vino de verdad… ¿abrirías esta botella o otra?",
    kimiPairings: [
      "Arrachera a la parrilla",
      "Queso de cabra de Ensenada",
      "Tacos de camarón",
    ],
    kimiPairingNote:
      "Fruta madura y estructura mediterránea — pide parrilla, sal y brisa salada.",
  },
  w043: {
    kimiSummary:
      "Viña Alberdi es el Rioja accesible de La Rioja Alta: Tempranillo con crianza clásica, sin teatro. Es la botella que enseña por qué Rioja conquistó mesas — equilibrio, madera bien puesta y un trago que invita a repetir.",
    kimiCuriosity:
      "La Rioja Alta es una de las casas históricas de Haro; Alberdi suele ser la puerta de entrada a su estilo antes de subir a reservas más serias. Familiar, sí — pero no genérica.",
    kimiTalkHook:
      "¿Cuántos Riojas has bebido sin saber qué casa hay detrás… y cuántos recordarías por el nombre?",
    kimiPairings: ["Chuletillas al sarmiento", "Jamón ibérico", "Estofado suave"],
    kimiPairingNote:
      "Crianza amable y fruta roja — brilla con cordero, curados y platos de cuchara.",
  },
  w051: {
    kimiSummary:
      "Catena es la familia que profesionalizó Mendoza para el mundo: Malbec argentino con ambición de exportar identidad, no solo volumen. Abrir esta botella es brindar con la idea de que el Nuevo Mundo también escribe clásicos.",
    kimiCuriosity:
      "Nicolás Catena Zapata apostó por altura y rigor cuando el Malbec aún era 'el vino barato de Argentina'. El salto de calidad de las últimas décadas tiene mucho de esa obsesión familiar.",
    kimiTalkHook:
      "Si el Malbec argentino tuviera un apellido… ¿crees que sería Catena, o aún estamos discutiendo?",
    kimiPairings: ["Asado argentino", "Empanadas de carne", "Provoleta"],
    kimiPairingNote:
      "Fruta negra y tanino amable — nace para parrilla y sobremesa larga.",
  },
};

function slotParts(slot: string): { col: number; row: string } {
  const m = slot.match(/^(\d{1,2})([A-Z])$/i);
  if (!m) return { col: 1, row: "A" };
  return { col: Number(m[1]), row: m[2].toUpperCase() };
}

/**
 * ~6 example bottles curated from the founder cellar — not the full inventory.
 * Fresh ids each load so demo rows never collide across users.
 */
export function buildDemoSeedWines(cellarId: string | null): Wine[] {
  const byId = new Map(seedWines.map((w) => [w.id, w]));
  const picked: Wine[] = [];

  DEMO_SOURCE_IDS.forEach((sourceId, index) => {
    const base = byId.get(sourceId);
    if (!base) return;
    const slot = DEMO_SLOTS[index] ?? `1${String.fromCharCode(65 + index)}`;
    const { col, row } = slotParts(slot);
    const story = STORY_OVERRIDES[sourceId];
    const withStory = story
      ? {
          ...base,
          ...story,
          kimiCheckedAt: "2026-07-24T12:00:00.000Z",
          kimiConfidence: "likely" as const,
        }
      : base;

    picked.push(
      withKimiDefaults(
        withVerificationDefaults({
          ...withStory,
          id: crypto.randomUUID(),
          slot,
          col,
          row,
          cellarId: cellarId,
        })
      )
    );
  });

  return picked;
}

export const DEMO_SEED_COUNT = DEMO_SOURCE_IDS.length;
