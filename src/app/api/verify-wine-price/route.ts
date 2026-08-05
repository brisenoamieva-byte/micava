import { NextResponse } from "next/server";
import { guardKimiApi } from "@/lib/api-guard";
import { resolveMarketGeoFromRequest } from "@/lib/market-geo";
import { recordKimiUsage } from "@/lib/kimi-usage";
import { verifyWineRetailPrice } from "@/lib/wine-price-research";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.KIMI_MODEL?.trim() || "kimi-k2.6";
const USAGE_ROUTE = "verify-wine-price";

type Body = {
  name?: string;
  winery?: string;
  country?: string;
  region?: string;
  type?: string;
  grape?: string;
  vintage?: number | null;
  countryCode?: string | null;
  marketCountry?: string | null;
};

export async function POST(request: Request) {
  const guard = await guardKimiApi(request);
  if (!guard.ok) return guard.response;

  const apiKey = process.env.KIMI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta KIMI_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json(
      { error: "Falta el nombre del vino." },
      { status: 400 }
    );
  }

  const market = resolveMarketGeoFromRequest(
    request,
    body.countryCode ?? body.marketCountry ?? null
  );

  const result = await verifyWineRetailPrice({
    apiKey,
    wine: {
      name,
      winery: typeof body.winery === "string" ? body.winery : "",
      country: typeof body.country === "string" ? body.country : "",
      region: typeof body.region === "string" ? body.region : "",
      type: typeof body.type === "string" ? body.type : "",
      grape: typeof body.grape === "string" ? body.grape : "",
      vintage: body.vintage ?? null,
    },
    market,
  });

  if (result.usage) {
    await recordKimiUsage({
      userId: guard.userId,
      route: USAGE_ROUTE,
      model: MODEL,
      usage: result.usage,
    });
  }

  if (result.amount == null || !result.currency) {
    return NextResponse.json(
      {
        error: result.error || "No se encontró un precio de referencia.",
        amount: null,
        currency: null,
        source: result.source,
        confidence: result.confidence,
        notes: result.notes,
        market: {
          countryCode: market.countryCode,
          marketLabel: market.marketLabel,
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    amount: result.amount,
    currency: result.currency,
    source: result.source,
    confidence: result.confidence,
    notes: result.notes,
    market: {
      countryCode: market.countryCode,
      marketLabel: market.marketLabel,
    },
  });
}
