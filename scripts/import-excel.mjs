import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const xlsxPath = path.join(root, "MiCava.xlsx");

const wb = XLSX.readFile(xlsxPath, { cellDates: true, raw: false });
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Cava"], { defval: "", raw: false });
const ubic = XLSX.utils.sheet_to_json(wb.Sheets["Ubicación"], { header: 1, defval: "", raw: false });

function parsePrice(p) {
  if (!p) return null;
  const cleaned = String(p).replace(/[\$\s]/g, "").replace(/,/g, "");
  const v = Number(cleaned);
  return Number.isFinite(v) ? v : null;
}

function normalizeAnejamiento(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  if (s.toLowerCase() === "reseva") return "Reserva";
  if (s === "12 MESES") return "12 meses";
  return s;
}

function normalizeRegion(v) {
  const s = String(v || "").trim();
  if (s === "Ribera d Alba") return "Langhe / Barolo (Alba)";
  if (s === "Ensenada BC") return "Ensenada, B.C.";
  return s;
}

const wines = [];
let id = 1;

for (const r of rows) {
  const nombre = String(r.Nombre || "").trim();
  const pais = String(r.País || "").trim();
  const precio = parsePrice(r["Precio Vivino"]);
  if (!nombre && !pais) {
    // skip garbage price-only row
    continue;
  }

  const xRaw = String(r.X || "").trim();
  const yRaw = String(r.Y || "").trim();
  const isAbajo = xRaw.toLowerCase() === "abajo";
  const col = isAbajo || !xRaw ? null : Number(xRaw);
  const row = isAbajo || !yRaw ? null : yRaw.toUpperCase();
  const slot =
    isAbajo ? "abajo" : col && row ? `${col}${row}` : null;

  wines.push({
    id: `w${String(id++).padStart(3, "0")}`,
    slot,
    col,
    row,
    country: pais,
    region: normalizeRegion(r["Región/Denom."]),
    type: String(r.Tipo || "").trim() || "Tinto",
    winery: String(r.Bodega || "").trim(),
    name: nombre,
    aging: normalizeAnejamiento(r.Añejamiento),
    grape: String(r.Uva || "").trim(),
    vintage: r.Año ? Number(String(r.Año).trim()) : null,
    vivino: r["Calificación Vivino"]
      ? Number(String(r["Calificación Vivino"]).trim())
      : null,
    price: precio,
  });
}

const letters = { 3: "A", 5: "B", 7: "C", 9: "D", 11: "E", 13: "F" };
const grid = {};
for (const [ri, letter] of Object.entries(letters)) {
  const row = ubic[Number(ri) - 1] || [];
  for (let col = 1; col <= 12; col++) {
    const val = String(row[col] ?? "").trim();
    const pos = `${col}${letter}`;
    grid[pos] = !val || val === "0" ? null : val;
  }
}

const out = {
  meta: {
    brand: "Mi Cava",
    importedAt: new Date().toISOString(),
    bottleCount: wines.length,
    gridCols: 12,
    gridRows: ["A", "B", "C", "D", "E", "F"],
  },
  grid,
  wines,
};

const outPath = path.join(root, "src", "data", "wines.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log(`Wrote ${wines.length} wines → ${outPath}`);
