import type { League } from "./leagues";
import { isIsoDate, localDateIn, zonedTimeToUtc } from "./time";

export type SourceName =
  "openfootball" | "OpenLigaDB" | "football-data.org" | "ESPN";

/** A scheduled match as a provider reports it, before the home club is resolved. */
export type Fixture = {
  id: string;
  leagueId: string;
  leagueName: string;
  countries?: readonly string[];
  home: string;
  away: string;
  /** Local calendar date of the match. */
  date: string;
  /** Kick-off as ISO UTC timestamp, absent while the time is not fixed. */
  utc?: string;
  provisional: boolean;
  source: SourceName;
  /** Stadium named by the provider (ESPN). Such matches are placed through lib/venues.ts. */
  venue?: { id: string; name: string; city?: string; country?: string };
  homeRef?: string;
  homeColor?: string;
  awayColor?: string;
};

export const record = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : null;
export const text = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;
const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
export const isoInstant = (v: unknown) => {
  const s = text(v);
  if (!s) return undefined;
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : s + "Z";
  const ms = Date.parse(withZone);
  return Number.isFinite(ms)
    ? new Date(ms).toISOString().replace(".000Z", "Z")
    : undefined;
};

// openfootball/football.json: public domain, regenerated daily from Football.TXT sources.
export const openfootballUrl = (season: string, code: string) =>
  `https://raw.githubusercontent.com/openfootball/football.json/master/${season}/${code}.json`;

const UNPLAYABLE = /postpone|cancel|abandon|award|suspend/i;

export function parseOpenfootball(
  data: unknown,
  league: League,
  season: string,
): Fixture[] {
  const matches = record(data)?.matches;
  if (!Array.isArray(matches))
    throw new Error("openfootball: unexpected format");
  const fixtures: Fixture[] = [];
  for (const raw of matches) {
    const m = record(raw);
    const home = text(m?.team1),
      away = text(m?.team2);
    if (!m || !home || !away || !isIsoDate(m.date)) continue;
    if (record(m.score)?.ft) continue;
    if (UNPLAYABLE.test(text(m.status) ?? "")) continue;
    const time = text(m.time)?.match(/^(\d{1,2}):(\d{2})$/);
    fixtures.push({
      // Home and away meet once per double round-robin season: stable across reschedules.
      id: `of-${league.id}-${season}-${slug(home)}-${slug(away)}`.slice(0, 100),
      leagueId: league.id,
      leagueName: league.name,
      countries: league.countries,
      home,
      away,
      date: m.date,
      utc: time
        ? zonedTimeToUtc(
            m.date,
            `${time[1].padStart(2, "0")}:${time[2]}`,
            league.timezone,
          )
        : undefined,
      provisional: true,
      source: "openfootball",
    });
  }
  return fixtures;
}

// OpenLigaDB: community-maintained German leagues with UTC kick-off times.
export const openLigaDbUrl = (shortcut: string, seasonYear: number) =>
  `https://api.openligadb.de/getmatchdata/${shortcut}/${seasonYear}`;

export function parseOpenLigaDb(data: unknown, league: League): Fixture[] {
  if (!Array.isArray(data)) throw new Error("OpenLigaDB: unexpected format");
  const fixtures: Fixture[] = [];
  for (const raw of data) {
    const m = record(raw);
    if (!m || m.matchIsFinished === true) continue;
    const home = text(record(m.team1)?.teamName),
      away = text(record(m.team2)?.teamName),
      utc = isoInstant(m.matchDateTimeUTC);
    if (typeof m.matchID !== "number" || !home || !away || !utc) continue;
    fixtures.push({
      id: `ol-${m.matchID}`,
      leagueId: league.id,
      leagueName: league.name,
      countries: league.countries,
      home,
      away,
      date: localDateIn(utc, league.timezone),
      utc,
      provisional: true,
      source: "OpenLigaDB",
    });
  }
  return fixtures;
}

// football-data.org v4. Date filters are limited to short ranges and dateTo may be
// exclusive, so requests use aligned seven-day windows that users share in the cache.
const DAY = 86400000;
export function footballDataWindows(start: string, end: string) {
  const from = Date.parse(start + "T00:00:00Z") - DAY,
    to = Date.parse(end + "T00:00:00Z") + 2 * DAY;
  const windows: { from: string; to: string }[] = [];
  for (let t = Math.floor(from / (7 * DAY)) * 7 * DAY; t < to; t += 7 * DAY)
    windows.push({
      from: new Date(t).toISOString().slice(0, 10),
      to: new Date(t + 7 * DAY).toISOString().slice(0, 10),
    });
  return windows;
}

export const footballDataUrl = (from: string, to: string, codes: string[]) =>
  `https://api.football-data.org/v4/matches?competitions=${codes.join(",")}&dateFrom=${from}&dateTo=${to}`;

export function parseFootballData(
  data: unknown,
  leagues: readonly League[],
): Fixture[] {
  const matches = record(data)?.matches;
  if (!Array.isArray(matches))
    throw new Error("football-data.org: unexpected format");
  const fixtures: Fixture[] = [];
  for (const raw of matches) {
    const m = record(raw);
    const status = text(m?.status);
    if (!m || (status !== "SCHEDULED" && status !== "TIMED")) continue;
    const competition = record(m.competition);
    const league = leagues.find(
      (l) => l.footballData === text(competition?.code),
    );
    const home = text(record(m.homeTeam)?.name),
      away = text(record(m.awayTeam)?.name),
      utc = isoInstant(m.utcDate);
    if (typeof m.id !== "number" || !league || !home || !away || !utc) continue;
    // SCHEDULED: the date is set but the kick-off time is not yet confirmed.
    const timed = status === "TIMED";
    fixtures.push({
      id: `fd-${m.id}`,
      leagueId: league.id,
      leagueName: league.name,
      countries: league.countries.length ? league.countries : undefined,
      home,
      away,
      date:
        timed && league.countries.length
          ? localDateIn(utc, league.timezone)
          : utc.slice(0, 10),
      utc: timed ? utc : undefined,
      provisional: !timed,
      source: "football-data.org",
    });
  }
  return fixtures;
}
