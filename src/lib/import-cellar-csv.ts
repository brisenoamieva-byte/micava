/**
 * CSV import for cellar bottles — flexible headers, row-level errors, no silent drops.
 */

import type { WineDraft, WineType } from "@/lib/types";
import { normalizeCountry } from "@/lib/wine-countries";

export type CsvImportRowError = {
  row: number;
  column?: string;
  message: string;
};

export type CsvImportOk = {
  row: number;
  draft: WineDraft;
};

export type CsvImportResult = {
  ok: CsvImportOk[];
  errors: CsvImportRowError[];
  headers: string[];
  totalRows: number;
};

const HEADER_ALIASES: Record<string, keyof WineDraft | "mueble" | "skip"> = {
  name: "name",
  nombre: "name",
  wine: "name",
  vino: "name",
  winery: "winery",
  bodega: "winery",
  producer: "winery",
  productor: "winery",
  country: "country",
  pais: "country",
  país: "country",
  region: "region",
  región: "region",
  type: "type",
  tipo: "type",
  color: "type",
  grape: "grape",
  uva: "grape",
  uvas: "grape",
  varietal: "grape",
  aging: "aging",
  crianza: "aging",
  vintage: "vintage",
  añada: "vintage",
  anada: "vintage",
  year: "vintage",
  año: "vintage",
  ano: "vintage",
  vivino: "vivino",
  price: "price",
  precio: "price",
  slot: "location",
  location: "location",
  ubicacion: "location",
  ubicación: "location",
  hueco: "location",
  cellarid: "cellarId",
  mueble: "mueble",
  id: "skip",
  cavatale_rating: "skip",
  cavataleRating: "skip",
};

function normalizeHeader(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\s_-]+/g, "");
}

/** Minimal RFC4180-ish CSV parse (quotes, commas, newlines). */
export function parseCsvText(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function normalizeType(raw: string): WineType {
  const t = raw.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (/blanc|white|blanco/.test(t)) return "Blanco";
  if (/rosa|rosado|rose/.test(t)) return "Rosado";
  if (/espum|spark|cava|champ|prosecco/.test(t)) return "Espumoso";
  if (/tint|red|rouge|negro/.test(t)) return "Tinto";
  return raw.trim() || "Tinto";
}

function emptyDraft(): WineDraft {
  return {
    name: "",
    winery: "",
    country: "México",
    region: "",
    type: "Tinto",
    grape: "",
    aging: "",
    vintage: null,
    vivino: null,
    price: null,
    cellarId: null,
    location: "",
  };
}

export function csvTemplateContent(): string {
  return (
    "\uFEFF" +
    [
      "name,winery,country,region,type,grape,aging,vintage,price,slot",
      "Viña Alberdi,La Rioja Alta,España,Rioja,Tinto,Tempranillo,Reserva,2019,650,11F",
    ].join("\n") +
    "\n"
  );
}

/**
 * Parse a wines CSV into drafts + row errors.
 * `resolveCellarId` maps mueble name → id (optional).
 */
export function importWinesFromCsv(
  text: string,
  opts?: {
    resolveCellarId?: (muebleName: string) => string | null;
    defaultCellarId?: string | null;
  }
): CsvImportResult {
  const table = parseCsvText(text);
  if (table.length < 2) {
    return {
      ok: [],
      errors: [
        {
          row: 1,
          message: "El archivo está vacío o solo tiene encabezados.",
        },
      ],
      headers: table[0] ?? [],
      totalRows: 0,
    };
  }

  const headerCells = table[0];
  const mapped = headerCells.map((h) => {
    const key = normalizeHeader(h);
    return HEADER_ALIASES[key] ?? HEADER_ALIASES[h.trim()] ?? null;
  });

  if (!mapped.includes("name")) {
    return {
      ok: [],
      errors: [
        {
          row: 1,
          column: "name",
          message:
            "Falta columna de nombre (name / nombre). Descarga la plantilla.",
        },
      ],
      headers: headerCells,
      totalRows: table.length - 1,
    };
  }

  const ok: CsvImportOk[] = [];
  const errors: CsvImportRowError[] = [];

  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const draft = emptyDraft();
    let muebleName = "";
    const rowNum = r + 1;

    for (let c = 0; c < mapped.length; c++) {
      const field = mapped[c];
      const raw = (cells[c] ?? "").trim();
      if (!field || field === "skip") continue;
      if (field === "mueble") {
        muebleName = raw;
        continue;
      }
      if (field === "name") draft.name = raw;
      else if (field === "winery") draft.winery = raw;
      else if (field === "country") {
        draft.country = raw ? normalizeCountry(raw) : draft.country;
      } else if (field === "region") draft.region = raw;
      else if (field === "type") draft.type = normalizeType(raw);
      else if (field === "grape") draft.grape = raw;
      else if (field === "aging") draft.aging = raw;
      else if (field === "vintage") {
        const n = parseOptionalNumber(raw);
        if (raw && n == null) {
          errors.push({
            row: rowNum,
            column: "vintage",
            message: `Añada inválida: “${raw}”`,
          });
        } else draft.vintage = n != null ? Math.round(n) : null;
      } else if (field === "vivino") {
        const n = parseOptionalNumber(raw);
        draft.vivino = n;
      } else if (field === "price") {
        const n = parseOptionalNumber(raw);
        if (raw && n == null) {
          errors.push({
            row: rowNum,
            column: "price",
            message: `Precio inválido: “${raw}”`,
          });
        } else draft.price = n != null ? Math.round(n) : null;
      } else if (field === "location") {
        draft.location = raw.toLowerCase() === "abajo" ? "abajo" : raw;
      } else if (field === "cellarId") {
        draft.cellarId = raw || null;
      }
    }

    if (!draft.name.trim()) {
      errors.push({
        row: rowNum,
        column: "name",
        message: "Falta el nombre del vino.",
      });
      continue;
    }

    if (muebleName && opts?.resolveCellarId) {
      const id = opts.resolveCellarId(muebleName);
      if (!id) {
        errors.push({
          row: rowNum,
          column: "mueble",
          message: `Mueble no encontrado: “${muebleName}” (se importa sin casilla).`,
        });
        draft.location = draft.location === "abajo" ? "abajo" : "";
        draft.cellarId = null;
      } else {
        draft.cellarId = id;
      }
    } else if (!draft.cellarId) {
      draft.cellarId = opts?.defaultCellarId ?? null;
    }

    if (!draft.location || draft.location === "abajo") {
      draft.cellarId = draft.location === "abajo" ? null : draft.cellarId;
    }

    ok.push({ row: rowNum, draft });
  }

  return {
    ok,
    errors,
    headers: headerCells,
    totalRows: table.length - 1,
  };
}
