import type { Wine } from "@/lib/types";
import { parseGrapes, type CanonicalGrape } from "@/lib/grapes";

export type WinePairing = {
  dishes: string[];
  note: string;
};

/** Classic pairings by grape (MX / ES friendly wording). */
const BY_GRAPE: Record<CanonicalGrape, string[]> = {
  Tempranillo: [
    "Cordero asado",
    "Chuletón / carne a la parrilla",
    "Jamón ibérico",
    "Quesos curados",
    "Estofados de caza",
  ],
  "Cabernet Sauvignon": [
    "Rib eye / arrachera",
    "Cordero con hierbas",
    "Queso cheddar o gouda añejo",
    "Guisos intensos",
  ],
  Merlot: [
    "Pollo rostizado",
    "Pasta con salsa de tomate",
    "Champiñones salteados",
    "Carne magra a la plancha",
  ],
  Malbec: [
    "Asado argentino / costilla",
    "Empanadas de carne",
    "Queso provolone",
    "Chocolate amargo (postre)",
  ],
  Syrah: [
    "Barbacoa / brisket",
    "Cordero especiado",
    "Embutidos ahumados",
    "Comida mediterránea con hierbas",
  ],
  Garnacha: [
    "Paella de carne",
    "Pizza margarita o pepperoni",
    "Charcutería",
    "Verduras asadas",
  ],
  Nebbiolo: [
    "Risotto de hongos",
    "Ossobuco / brasato",
    "Trufa y pasta",
    "Queso parmesano / pecorino",
  ],
  Zinfandel: [
    "Costillas BBQ",
    "Hamburguesa con cheddar",
    "Pizza con pepperoni",
    "Comida picante suave",
  ],
  Chardonnay: [
    "Pescado a la mantequilla",
    "Pollo en crema",
    "Langosta / camarones",
    "Pasta alfredo",
  ],
  "Chenin Blanc": [
    "Ensaladas con fruta",
    "Queso de cabra",
    "Cerdo agridulce",
    "Mariscos ligeros",
  ],
  Colombard: [
    "Ceviche",
    "Tacos de pescado",
    "Ensalada verde",
    "Aperitivos frescos",
  ],
  Muscat: [
    "Postres de fruta",
    "Quesos azules suaves",
    "Foie o patés",
    "Comida asiática agridulce",
  ],
  Cariñena: [
    "Cocido / estofado",
    "Cordero guisado",
    "Embutidos",
    "Platos de olla",
  ],
  Monastrell: [
    "Cordero al horno",
    "Arroz con carne",
    "Quesos fuertes",
    "Caza menor",
  ],
  "Mourvèdre": [
    "Caza y estofados",
    "Cordero especiado",
    "Embutidos curados",
    "Guisos mediterráneos",
  ],
  "Petite Sirah": [
    "Carnes ahumadas",
    "Chile colorado",
    "Queso azul",
    "Chocolate negro",
  ],
  Graciano: [
    "Cordero",
    "Caza",
    "Quesos curados",
    "Platos especiados de Rioja",
  ],
  Mazuelo: [
    "Estofados",
    "Carnes rojas",
    "Embutidos",
    "Guisos de legumbres",
  ],
  Barbera: [
    "Pasta boloñesa",
    "Pizza",
    "Salami y antipasti",
    "Tomate y hierbas",
  ],
};

const BY_TYPE: Record<string, string[]> = {
  blanco: [
    "Pescados y mariscos",
    "Ensaladas",
    "Quesos frescos",
    "Aperitivos ligeros",
  ],
  rosado: [
    "Tapas variadas",
    "Ensaladas",
    "Pescado a la plancha",
    "Comida mexicana ligera",
  ],
  espumoso: [
    "Aperitivos y canapés",
    "Mariscos",
    "Sushi",
    "Frituras ligeras",
    "Celebraciones",
  ],
  tinto: [
    "Carnes rojas",
    "Quesos curados",
    "Guisos",
  ],
};

function typeKey(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("blanc")) return "blanco";
  if (t.includes("ros")) return "rosado";
  if (t.includes("espum") || t.includes("cava") || t.includes("champ")) {
    return "espumoso";
  }
  return "tinto";
}

function agingBoost(aging: string): string[] {
  const a = aging.toLowerCase();
  if (!a) return [];
  if (a.includes("gran reserva") || a.includes("reserva")) {
    return ["Carnes de caza", "Asados largos", "Quesos muy curados"];
  }
  if (a.includes("crianza") || a.includes("barrica") || a.includes("roble")) {
    return ["Carnes asadas", "Guisos con salsa"];
  }
  if (a.includes("joven")) {
    return ["Tapas", "Embutidos", "Comida cotidiana"];
  }
  return [];
}

function regionHint(region: string, country: string): string[] {
  const blob = `${region} ${country}`.toLowerCase();
  if (blob.includes("rioja") || blob.includes("ribera")) {
    return ["Cordero asado", "Chuletillas al sarmiento"];
  }
  if (blob.includes("mendoza") || blob.includes("argentina")) {
    return ["Asado", "Provoleta"];
  }
  if (blob.includes("bordeaux") || blob.includes("burdeos")) {
    return ["Cordero", "Entrecot"];
  }
  if (blob.includes("champagne") || blob.includes("cava") || blob.includes("prosecco")) {
    return ["Ostras", "Aperitivos"];
  }
  if (blob.includes("guadalupe") || blob.includes("méxico") || blob.includes("mexico")) {
    return ["Carnes a la parrilla", "Mole suave", "Quesos mexicanos"];
  }
  if (blob.includes("napa") || blob.includes("california")) {
    return ["Steak", "BBQ"];
  }
  if (blob.includes("piemonte") || blob.includes("barolo") || blob.includes("barbaresco")) {
    return ["Risotto", "Trufa", "Brasato"];
  }
  return [];
}

function uniq(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

/** Suggest food pairings from grapes, type, aging, and region. */
export function pairingsForWine(
  wine: Pick<Wine, "grape" | "type" | "aging" | "region" | "country">
): WinePairing {
  const grapes = parseGrapes(wine.grape);
  const tk = typeKey(wine.type);

  const fromGrapes = grapes.flatMap((g) => BY_GRAPE[g] ?? []);
  const fromType = BY_TYPE[tk] ?? BY_TYPE.tinto;
  const fromAging = agingBoost(wine.aging);
  const fromRegion = regionHint(wine.region, wine.country);

  // Prefer grape-specific dishes; fill with type/region/aging
  const dishes = uniq(
    [...fromGrapes, ...fromRegion, ...fromAging, ...fromType],
    6
  );

  const grapeLabel =
    grapes.length > 0
      ? grapes.join(", ")
      : wine.grape.trim() || "perfil del vino";

  const noteParts = [
    `Según ${grapeLabel}`,
    wine.type ? `y estilo ${wine.type}` : null,
    wine.aging?.trim() ? `· ${wine.aging.trim()}` : null,
    wine.region?.trim() ? `· ${wine.region.trim()}` : null,
  ].filter(Boolean);

  return {
    dishes:
      dishes.length > 0
        ? dishes
        : ["Prueba con lo que más te apetezca — faltan datos de uva/tipo."],
    note: noteParts.join(" "),
  };
}

/** Prefer IA pairings when research has produced them; else classic rules. */
export function resolvePairingsForWine(
  wine: Pick<
    Wine,
    | "grape"
    | "type"
    | "aging"
    | "region"
    | "country"
    | "kimiPairings"
    | "kimiPairingNote"
  >
): WinePairing & { source: "ia" | "reglas" } {
  if (wine.kimiPairings && wine.kimiPairings.length > 0) {
    return {
      dishes: wine.kimiPairings.slice(0, 8),
      note:
        wine.kimiPairingNote?.trim() ||
        "Afinado por IA para esta botella",
      source: "ia",
    };
  }
  return { ...pairingsForWine(wine), source: "reglas" };
}
