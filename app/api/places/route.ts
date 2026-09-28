import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2 || q.length > 100)
    return NextResponse.json(
      { error: "Vul minimaal twee tekens in." },
      { status: 400 },
    );
  try {
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=nl&format=json`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) },
    );
    if (!r.ok) throw new Error();
    const data = await r.json();
    return NextResponse.json({
      places: (data.results || []).map(
        (v: {
          name: string;
          country: string;
          admin1: string;
          latitude: number;
          longitude: number;
        }) => ({
          name: `${v.name}, ${v.admin1 || v.country}`,
          lat: v.latitude,
          lon: v.longitude,
        }),
      ),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Plaatsen zoeken lukt even niet. Gebruik je huidige locatie of probeer opnieuw.",
      },
      { status: 502 },
    );
  }
}
