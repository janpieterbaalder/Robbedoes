import { CLUBS } from "./clubs";
import { findClub } from "./club-lookup";
import type { FetchJson } from "./cache";
import { distanceKm, inDateRange } from "./football";
import { CUPS, LEAGUES, seasonOf, type League } from "./leagues";
import {
  footballDataUrl,
  footballDataWindows,
  openfootballUrl,
  openLigaDbUrl,
  parseFootballData,
  parseOpenfootball,
  parseOpenLigaDb,
  type Fixture,
  type SourceName,
} from "./sources";
import { localDateIn, zonedTimeToUtc } from "./time";
import type { Match, MatchResponse } from "./types";

export type SearchInput = {
  lat: number;
  lon: number;
  radius: number;
  start: string;
  end: string;
};
export type SearchDeps = { fetchJson: FetchJson; footballDataKey?: string };

type Feed = { source: SourceName; load: () => Promise<Fixture[]> };

const hasClubWithin = (countries: readonly string[], point: SearchInput) =>
  CLUBS.some(
    (c) =>
      countries.includes(c.country) && distanceKm(point, c) <= point.radius,
  );

function seasons(input: SearchInput) {
  const list = [seasonOf(input.start), seasonOf(input.end)];
  return list.filter(
    (s, i) => list.findIndex((o) => o.label === s.label) === i,
  );
}

/** Loads every season; succeeds when at least one season is available. */
async function allSeasons(loaders: (() => Promise<Fixture[]>)[]) {
  const results = await Promise.allSettled(loaders.map((load) => load()));
  const ok = results.filter((r) => r.status === "fulfilled");
  if (!ok.length) throw (results[0] as PromiseRejectedResult).reason;
  return ok.flatMap((r) => r.value);
}

function feedsFor(
  league: League,
  input: SearchInput,
  deps: SearchDeps,
): Feed[] {
  const feeds: Feed[] = [];
  const { fetchJson, footballDataKey } = deps;
  if (league.openLigaDb) {
    const shortcut = league.openLigaDb;
    feeds.push({
      source: "OpenLigaDB",
      load: () =>
        allSeasons(
          seasons(input).map(
            (s) => async () =>
              parseOpenLigaDb(
                await fetchJson(openLigaDbUrl(shortcut, s.year), {
                  ttlSeconds: 900,
                }),
                league,
              ),
          ),
        ),
    });
  }
  if (league.openfootball) {
    const code = league.openfootball;
    feeds.push({
      source: "openfootball",
      load: () =>
        allSeasons(
          seasons(input).map(
            (s) => async () =>
              parseOpenfootball(
                await fetchJson(openfootballUrl(s.label, code), {
                  ttlSeconds: 3600,
                }),
                league,
                s.label,
              ),
          ),
        ),
    });
  }
  if (league.footballData && footballDataKey)
    feeds.push({
      source: "football-data.org",
      load: () => loadFootballData([league], input, deps),
    });
  return feeds;
}

async function loadFootballData(
  leagues: League[],
  input: SearchInput,
  { fetchJson, footballDataKey }: SearchDeps,
) {
  const codes = leagues.map((l) => l.footballData!);
  const pages = await Promise.all(
    footballDataWindows(input.start, input.end).map(({ from, to }) =>
      fetchJson(footballDataUrl(from, to, codes), {
        ttlSeconds: 900,
        headers: { "X-Auth-Token": footballDataKey! },
      }),
    ),
  );
  return pages.flatMap((page) => parseFootballData(page, leagues));
}

/** First feed that answers wins, so one broken provider does not hide a league. */
async function loadLeague(
  league: League,
  input: SearchInput,
  deps: SearchDeps,
) {
  for (const feed of feedsFor(league, input, deps)) {
    try {
      return { fixtures: await feed.load(), source: feed.source };
    } catch {
      // try the next feed
    }
  }
  return null;
}

function toMatch(f: Fixture): Match | null {
  const home = findClub(f.home, f.countries);
  if (!home) return null;
  const away = findClub(f.away, f.countries);
  return {
    id: f.id,
    home: home.name,
    homeId: home.id,
    away: away?.name ?? f.away,
    kickoff: f.utc ?? zonedTimeToUtc(f.date, "12:00", home.timezone),
    ...(f.utc ? {} : { timeTbc: true }),
    league: f.leagueName,
    country: home.country,
    stadium: home.stadium,
    city: home.city,
    lat: home.lat,
    lon: home.lon,
    timezone: home.timezone,
    color: home.color,
    ...(away ? { awayColor: away.color } : {}),
    ticketUrl: home.website,
    demand: "unknown",
    provisional: f.provisional,
    source: f.source,
  };
}

export async function searchEurope(
  input: SearchInput,
  deps: SearchDeps,
): Promise<MatchResponse> {
  const leagues = LEAGUES.filter((l) => hasClubWithin(l.countries, input));
  const cups = deps.footballDataKey && leagues.length ? CUPS : [];
  const updatedAt = new Date().toISOString();

  if (!leagues.length) {
    const nearest = CLUBS.map((c) => ({ c, d: distanceKm(input, c) })).sort(
      (a, b) => a.d - b.d,
    )[0];
    return {
      matches: [],
      source: "",
      coverage: `Geen competitie uit onze dekking binnen ${input.radius} km.`,
      updatedAt,
      missingVenues: 0,
      nearest: {
        club: nearest.c.name,
        city: nearest.c.city,
        distance: Math.round(nearest.d),
      },
    };
  }

  const [leagueResults, cupResult] = await Promise.all([
    Promise.all(leagues.map((l) => loadLeague(l, input, deps))),
    cups.length
      ? loadFootballData(cups, input, deps).then(
          (fixtures) => ({ fixtures, source: "football-data.org" as const }),
          () => null,
        )
      : Promise.resolve(undefined),
  ]);

  const failed = leagues.filter((_, i) => !leagueResults[i]).map((l) => l.name);
  if (cupResult === null) failed.push(...cups.map((c) => c.name));
  const loaded = [...leagueResults, cupResult].filter((r) => !!r);
  if (!loaded.length) throw new Error("Geen enkele wedstrijdbron reageerde.");

  const seen = new Set<string>();
  const inRange: Match[] = [],
    later: Match[] = [];
  let missingVenues = 0;
  for (const fixture of loaded.flatMap((r) => r.fixtures)) {
    if (seen.has(fixture.id)) continue;
    seen.add(fixture.id);
    const match = toMatch(fixture);
    if (!match) {
      if (fixture.date >= input.start && fixture.date <= input.end)
        missingVenues++;
      continue;
    }
    const distance = distanceKm(input, match);
    if (distance > input.radius) continue;
    if (inDateRange(match, input.start, input.end))
      inRange.push({ ...match, distance });
    else if (fixture.date > input.end) later.push(match);
  }
  inRange.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  const names = [...leagues, ...cups]
    .map((l) => l.name)
    .filter((n) => !failed.includes(n));
  const sources = [...new Set(loaded.map((r) => r.source))];
  return {
    matches: inRange,
    source: sources.join(", "),
    coverage: names.join(", "),
    updatedAt,
    missingVenues,
    ...(failed.length
      ? { warning: `Geen gegevens beschikbaar voor ${failed.join(", ")}.` }
      : {}),
    ...(!inRange.length && later.length
      ? {
          nextDate: later
            .map((m) => localDateIn(m.kickoff, m.timezone))
            .sort()[0],
        }
      : {}),
  };
}
