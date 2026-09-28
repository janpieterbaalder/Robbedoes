import { NextRequest, NextResponse } from "next/server";
import { venues } from "@/lib/venues";
import { addDays, searchMatches } from "@/lib/football";
import type { Match } from "@/lib/types";
export const dynamic = "force-dynamic";
type OLMatch = {
  matchID: number;
  matchDateTimeUTC: string;
  team1: { teamName: string };
  team2: { teamName: string };
  matchIsFinished: boolean;
};
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams,
    start = p.get("start") || "",
    end = p.get("end") || "",
    lat = Number(p.get("lat")),
    lon = Number(p.get("lon")),
    radius = Number(p.get("radius"));
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(start) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
    !Number.isFinite(Date.parse(start)) ||
    !Number.isFinite(Date.parse(end)) ||
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
    let matches: Match[] = [],
      missingVenues = 0;
    let source = "OpenLigaDB",
      coverage =
        "Duitse Bundesliga. Communitygegevens; controleer datum en aanvang bij de club.";
    if (process.env.FOOTBALL_DATA_API_KEY) {
      const res = await fetch(
        `https://api.football-data.org/v4/matches?dateFrom=${start}&dateTo=${end}`,
        {
          headers: { "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY },
          next: { revalidate: 900 },
          signal: AbortSignal.timeout(12000),
        },
      );
      if (!res.ok) throw new Error("provider");
      const data = await res.json();
      if (!Array.isArray(data.matches)) throw new Error("provider");
      source = "football-data.org";
      coverage =
        "Competities binnen het aangesloten abonnement; alleen stadions met bekende coördinaten.";
      const aliases: Record<string, string> = {
        "FC Bayern München": "FC Bayern München",
        "BV Borussia 09 Dortmund": "Borussia Dortmund",
        "Bayer 04 Leverkusen": "Bayer 04 Leverkusen",
        "Feyenoord Rotterdam": "Feyenoord",
        "Sparta Rotterdam": "Sparta Rotterdam",
        "SBV Excelsior": "Excelsior",
        "Eintracht Frankfurt": "Eintracht Frankfurt",
      };
      for (const m of data.matches) {
        if (!["SCHEDULED", "TIMED"].includes(m.status)) continue;
        const home = m.homeTeam.name,
          v = venues[aliases[home] || home] || venues[m.homeTeam.shortName];
        if (!v) {
          missingVenues++;
          continue;
        }
        matches.push({
          ...v,
          id: `fd-${m.id}`,
          home: m.homeTeam.shortName || home,
          away: m.awayTeam.shortName || m.awayTeam.name,
          kickoff: m.utcDate,
          league: m.competition.name,
          provisional: m.status === "SCHEDULED",
        });
      }
    } else {
      const seasons = [
        ...new Set(
          [start, end].map(
            (d) => Number(d.slice(0, 4)) - (Number(d.slice(5, 7)) < 7 ? 1 : 0),
          ),
        ),
      ];
      for (const season of seasons) {
        const res = await fetch(
          `https://api.openligadb.de/getmatchdata/bl1/${season}`,
          { next: { revalidate: 900 }, signal: AbortSignal.timeout(12000) },
        );
        if (!res.ok) throw new Error("provider");
        const data: OLMatch[] = await res.json();
        if (!Array.isArray(data)) throw new Error("provider");
        for (const m of data) {
          if (m.matchIsFinished) continue;
          const v = venues[m.team1.teamName];
          if (!v) {
            missingVenues++;
            continue;
          }
          matches.push({
            ...v,
            id: `ol-${m.matchID}`,
            home: m.team1.teamName,
            away: m.team2.teamName,
            kickoff: m.matchDateTimeUTC,
            league: "Bundesliga",
            provisional: true,
          });
        }
      }
    }
    return NextResponse.json({
      matches: searchMatches(
        matches,
        { name: "", lat, lon },
        radius,
        start,
        end,
      ),
      source,
      coverage,
      missingVenues,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "De wedstrijdbron reageert niet. Probeer het straks opnieuw. Er worden geen voorbeeldwedstrijden als echte resultaten getoond.",
      },
      { status: 502 },
    );
  }
}
