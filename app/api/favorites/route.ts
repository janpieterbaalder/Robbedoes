import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { authConfigured, getAuth } from "@/lib/auth";
async function context() {
  if (!authConfigured() || !process.env.DATABASE_URL) return null;
  const { data } = await getAuth().getSession();
  if (!data?.user) return null;
  return { userId: data.user.id, sql: neon(process.env.DATABASE_URL) };
}
export async function GET() {
  try {
    const c = await context();
    if (!c)
      return NextResponse.json({ error: "Log eerst in." }, { status: 401 });
    const rows =
      await c.sql`SELECT match FROM saved_matches WHERE user_id=${c.userId} ORDER BY created_at DESC LIMIT 200`;
    return NextResponse.json({ matches: rows.map((r) => r.match) });
  } catch {
    return NextResponse.json(
      { error: "Bewaarde wedstrijden konden niet worden opgehaald." },
      { status: 503 },
    );
  }
}
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin)
    return NextResponse.json({ error: "Ongeldige herkomst." }, { status: 403 });
  try {
    const c = await context();
    if (!c)
      return NextResponse.json({ error: "Log eerst in." }, { status: 401 });
    const body = await req.text();
    if (body.length > 8000)
      return NextResponse.json({ error: "Te groot." }, { status: 413 });
    const { match, remove } = JSON.parse(body);
    if (!match || typeof match.id !== "string" || match.id.length > 100)
      return NextResponse.json(
        { error: "Ongeldige wedstrijd." },
        { status: 400 },
      );
    if (remove) {
      await c.sql`DELETE FROM saved_matches WHERE user_id=${c.userId} AND match_id=${match.id}`;
    } else {
      if (
        typeof match.home !== "string" ||
        typeof match.away !== "string" ||
        !Number.isFinite(Date.parse(match.kickoff)) ||
        !Number.isFinite(match.lat) ||
        !Number.isFinite(match.lon)
      )
        return NextResponse.json(
          { error: "Ongeldige wedstrijd." },
          { status: 400 },
        );
      await c.sql`INSERT INTO saved_matches (user_id,match_id,match) VALUES (${c.userId},${match.id},${JSON.stringify(match)}::jsonb) ON CONFLICT (user_id,match_id) DO UPDATE SET match=EXCLUDED.match`;
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Opslaan is mislukt. Probeer opnieuw." },
      { status: 503 },
    );
  }
}
