import { NextRequest, NextResponse } from "next/server";
import { cachedFetchJson } from "@/lib/cache";
import { addDays } from "@/lib/football";
import { searchEurope } from "@/lib/search";
import { isIsoDate } from "@/lib/time";

// No `dynamic = "force-dynamic"`: it would switch off the fetch cache for provider data.
// Reading the query string already renders this handler per request.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams,
    start = p.get("start") || "",
    end = p.get("end") || "",
    lat = Number(p.get("lat")),
    lon = Number(p.get("lon")),
    radius = Number(p.get("radius"));
  if (
    !isIsoDate(start) ||
    !isIsoDate(end) ||
    end < start ||
    end > addDays(start, 30) ||
    !p.has("lat") ||
    !p.has("lon") ||
    !Number.isFinite(lat) ||
    Math.abs(lat) > 90 ||
    !Number.isFinite(lon) ||
    Math.abs(lon) > 180 ||
    !Number.isFinite(radius) ||
    radius < 1 ||
    radius > 500
  )
    return NextResponse.json(
      {
        error: "Kies een geldige locatie en een periode van maximaal 31 dagen.",
      },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      await searchEurope(
        { lat, lon, radius, start, end },
        {
          fetchJson: cachedFetchJson,
          footballDataKey: process.env.FOOTBALL_DATA_API_KEY || undefined,
        },
      ),
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "De wedstrijdbronnen reageren niet. Probeer het straks opnieuw. Er worden geen voorbeeldwedstrijden als echte resultaten getoond.",
      },
      { status: 502 },
    );
  }
}
