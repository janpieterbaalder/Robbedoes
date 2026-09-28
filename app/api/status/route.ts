import { NextResponse } from "next/server";
import { checkSources, type SourceCheck } from "@/lib/status";

// Always run at request time: this route must never be prerendered or cached.
export const dynamic = "force-dynamic";

// Live check of every fixture source. Results are reused for a minute so the page cannot
// be used to flood the providers or exhaust the football-data.org rate limit.
let last: { at: number; sources: SourceCheck[] } | null = null;

export async function GET() {
  if (!last || Date.now() - last.at > 60000)
    last = {
      at: Date.now(),
      sources: await checkSources(
        process.env.FOOTBALL_DATA_API_KEY || undefined,
      ),
    };
  return NextResponse.json(
    {
      checkedAt: new Date(last.at).toISOString(),
      allOk: last.sources.every((s) => s.state !== "error"),
      sources: last.sources,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
