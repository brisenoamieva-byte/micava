/**
 * One-shot: sign in + upsert seed wines for the owner account.
 * Usage: node scripts/seed-owner-cellar.mjs
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_* and email confirmed (or confirm disabled).
 * Also requires multi-cellar migration (cellars + wines.cellar_id).
 */
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.OWNER_EMAIL || "brisenoamieva@gmail.com";
const password = process.env.OWNER_PASSWORD || "MiCava2026!";

if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
  process.exit(1);
}

const winesJson = JSON.parse(
  readFileSync(join(root, "src/data/wines.json"), "utf8")
);

function wineToRow(w, userId, cellarId) {
  const slotted = w.slot && w.slot !== "abajo";
  return {
    id: w.id,
    user_id: userId,
    cellar_id: slotted ? cellarId : null,
    slot: w.slot,
    col: w.col,
    row: w.row,
    country: w.country ?? "",
    region: w.region ?? "",
    type: w.type ?? "Tinto",
    winery: w.winery ?? "",
    name: w.name ?? "",
    aging: w.aging ?? "",
    grape: w.grape ?? "",
    vintage: w.vintage,
    vivino: w.vivino,
    price: w.price,
    external_rating: w.externalRating ?? null,
    rating_source: w.ratingSource ?? null,
    last_checked_at: w.lastCheckedAt ?? null,
    match_confidence: w.matchConfidence ?? null,
  };
}

const login = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password }),
});
const session = await login.json();
if (!session.access_token) {
  console.error(
    "Login falló:",
    session.error_description || session.msg || session.error || session
  );
  console.error(
    "Si dice Email not confirmed: Auth → Providers → Email → desactiva Confirm email, o confirma el correo."
  );
  process.exit(1);
}

const userId = session.user.id;
const token = session.access_token;
const headers = {
  apikey: key,
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};

let cellarRes = await fetch(
  `${url}/rest/v1/cellars?user_id=eq.${userId}&order=sort_order.asc&limit=1`,
  { headers: { ...headers, Accept: "application/json" } }
);
let cellars = await cellarRes.json();
if (!Array.isArray(cellars)) {
  console.error("No se pudo leer cellars:", cellars);
  console.error("¿Corriste supabase/migrations/002_multi_cellar.sql?");
  process.exit(1);
}

if (cellars.length === 0) {
  const create = await fetch(`${url}/rest/v1/cellars`, {
    method: "POST",
    headers: {
      ...headers,
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: userId,
      name: "Principal",
      cols: 12,
      rows: ["A", "B", "C", "D", "E", "F"],
      sort_order: 0,
    }),
  });
  cellars = await create.json();
  if (!Array.isArray(cellars) || !cellars[0]?.id) {
    console.error("No se pudo crear Principal:", cellars);
    process.exit(1);
  }
}

const cellarId = cellars[0].id;
const rows = winesJson.wines.map((w) => wineToRow(w, userId, cellarId));

const upsert = await fetch(`${url}/rest/v1/wines?on_conflict=user_id,id`, {
  method: "POST",
  headers: {
    ...headers,
    Prefer: "resolution=merge-duplicates,return=minimal",
  },
  body: JSON.stringify(rows),
});

if (!upsert.ok) {
  const err = await upsert.text();
  console.error("Upsert falló:", upsert.status, err);
  console.error("¿Corriste supabase/schema.sql y 002_multi_cellar.sql?");
  process.exit(1);
}

console.log(
  `OK: ${rows.length} vinos en mueble ${cellars[0].name} (${cellarId}) para ${email}`
);
console.log(`Entra en https://micava-sigma.vercel.app/login`);
