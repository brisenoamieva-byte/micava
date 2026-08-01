import { NextResponse } from "next/server";
import { guardKimiApi } from "@/lib/api-guard";
import {
  addKimiUsage,
  recordKimiUsage,
  type KimiTokenUsage,
} from "@/lib/kimi-usage";
import {
  enrichWithWeb,
  mergeEnrichment,
  needsMarketEnrich,
  type EnrichHint,
} from "@/lib/scan-label-enrich";
import { parseScanLabelResult, type ScanLabelFields } from "@/lib/scan-label";

export const runtime = "nodejs";
export const maxDuration = 45;

const MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";
const USAGE_ROUTE = "enrich-label";

type Body = {
  fields?: unknown;
  matchMethod?: string;
  searchQuery?: string;
  enrichHint?: EnrichHint;
};

export async function POST(request: Request) {
  const guard = await guardKimiApi(request);
  if (!guard.ok) return guard.response;

  const apiKey = process.env.KIMI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta KIMI_API_KEY en el servidor." },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  let fields: ScanLabelFields;
  try {
    fields = parseScanLabelResult(body.fields);
  } catch {
    return NextResponse.json(
      { error: "Faltan fields del escaneo." },
      { status: 400 }
    );
  }

  if (!fields.name.trim()) {
    return NextResponse.json(
      { error: "Se necesita un nombre para enriquecer." },
      { status: 400 }
    );
  }

  if (!needsMarketEnrich(fields)) {
    return NextResponse.json({ fields, enriched: false });
  }

  const hint: EnrichHint = {
    matchMethod:
      body.enrichHint?.matchMethod || body.matchMethod || undefined,
    searchQuery:
      body.enrichHint?.searchQuery || body.searchQuery || undefined,
  };

  let sessionUsage: KimiTokenUsage | null = null;
  try {
    const enriched = await enrichWithWeb(apiKey, fields, hint);
    sessionUsage = addKimiUsage(sessionUsage, enriched.usage);
    await recordKimiUsage({
      userId: guard.userId,
      route: USAGE_ROUTE,
      model: MODEL,
      usage: sessionUsage,
    });

    if (enriched.fields?.name) {
      return NextResponse.json({
        fields: mergeEnrichment(fields, enriched.fields),
        enriched: true,
      });
    }
    return NextResponse.json({ fields, enriched: false });
  } catch (e) {
    await recordKimiUsage({
      userId: guard.userId,
      route: USAGE_ROUTE,
      model: MODEL,
      usage: sessionUsage,
    });
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "No se pudo enriquecer con datos de mercado.",
        fields,
        enriched: false,
      },
      { status: 502 }
    );
  }
}
