import { CLUBS } from "./clubs";
import { findClub } from "./club-lookup";
import type { FetchJson } from "./cache";
import { espnMonths, espnUrl, limit, parseEspn } from "./espn";
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
import { VENUES, venueById, type Venue } from "./venues";

export type SearchInput = {
  lat: number;
  lon: number;
  radius: number;
  start: string;
  end: string;
};
export type SearchDeps = {
  fetchJson: FetchJson;
  footballDataKey?: string;
  /** Stadium table; lib/venues.ts unless a test supplies its own. */
  venues?: readonly Venue[];
};

type Feed = { source: SourceName; load: () => Promise<Fixture[]> };

// ESPN accepts bursts, but a search never needs more than a few requests at once.
const espnSlot = limit(4);

const hasClubWithin = (countries: readonly string[], point: SearchInput) =>
  CLUBS.some(
    (c) =>
      countries.includes(c.country) && distanceKm(point, c) <= point.radius,
  );
const hasVenueWithin = (
  venues: readonly Venue[],
  slug: string,
  point: SearchInput,
) =>
  venues.some(
    (v) =>
      v.competitions.includes(slug) && distanceKm(point, v) <= point.radius,
  );

/** A competition is searched when a catalogue club or an ESPN stadium lies within the radius. */
const isRelevant = (
  league: League,
  point: SearchInput,
  venues: readonly Venue[],
) =>
  (!!(league.openfootball || league.openLigaDb) &&
    hasClubWithin(league.countries, point)) ||
  (!!league.espn && hasVenueWithin(venues, league.espn, point));

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
  if (!league.espn) return feeds;
  const slug = league.espn;
  const espn: Feed = {
    source: "ESPN",
    load: async () => {
      const pages = await Promise.all(
        espnMonths(input.start, input.end).map((month) =>
          espnSlot(() => fetchJson(espnUrl(slug, month), { ttlSeconds: 3600 })),
        ),
      );
      return pages.flatMap((page) => parseEspn(page, league));
    },
  };
  // ESPN goes first: it picks up rescheduled kick-offs (TV picks) weeks before openfootball
  // and marks unconfirmed times, which openfootball and OpenLigaDB list as a default slot.
  return [espn, ...feeds];
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

/** A match at a stadium named by the provider. Catalogue clubs keep their name, colour and website. */
function atVenue(f: Fixture, venue: Venue | undefined): Match | null {
  if (!venue) return null;
  // Whole names only: ESPN leagues include many clubs outside the catalogue.
  const home = findClub(f.home, f.countries, true),
    away = findClub(f.away, f.countries, true);
  const awayColor = away?.color ?? f.awayColor;
  return {
    id: f.id,
    home: home?.name ?? f.home,
    homeId: home?.id ?? `espn-${f.homeRef ?? f.home}`,
    away: away?.name ?? f.away,
    kickoff: f.utc ?? zonedTimeToUtc(f.date, "12:00", venue.timezone),
    ...(f.utc ? {} : { timeTbc: true }),
    league: f.leagueName,
    country: venue.country,
    stadium: venue.name,
    city: venue.city,
    lat: venue.lat,
    lon: venue.lon,
    ...(venue.approx ? { approx: true } : {}),
    timezone: venue.timezone,
    color: home?.color ?? f.homeColor ?? "#d7d7d7",
    ...(awayColor ? { awayColor } : {}),
    ticketUrl: home?.website ?? null,
    demand: "unknown",
    provisional: f.provisional,
    source: f.source,
  };
}

function toMatch(f: Fixture, venues: Map<string, Venue>): Match | null {
  if (f.venue) {
    const match = atVenue(f, venues.get(f.venue.id));
    // A cup match at an unknown stadium may be on neutral ground: never guess its place.
    if (match || !f.countries) return match;
  }
  // No known stadium: the home club's ground from the catalogue. ESPN names must match whole.
  const espn = f.source === "ESPN";
  const home = findClub(f.home, f.countries, espn);
  if (!home) return null;
  const away = findClub(f.away, f.countries, espn);
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
  const venues = deps.venues ?? VENUES;
  const byId =
    venues === VENUES ? venueById : new Map(venues.map((v) => [v.id, v]));
  const leagues = LEAGUES.filter((l) => isRelevant(l, input, venues));
  const cups = CUPS.filter((c) => isRelevant(c, input, venues));
  const updatedAt = new Date().toISOString();

  if (!leagues.length && !cups.length) {
    const places = [...CLUBS, ...venues].map((p) => ({
      name: p.name,
      city: p.city,
      d: distanceKm(input, p),
    }));
    const nearest = places.sort((a, b) => a.d - b.d)[0];
    return {
      matches: [],
      source: "",
      coverage: `Geen competitie uit onze dekking binnen ${input.radius} km.`,
      updatedAt,
      missingVenues: 0,
      nearest: {
        club: nearest.name,
        city: nearest.city,
        distance: Math.round(nearest.d),
      },
    };
  }

  const competitions = [...leagues, ...cups];
  const results = await Promise.all(
    competitions.map((c) => loadLeague(c, input, deps)),
  );
  const failed = competitions.filter((_, i) => !results[i]).map((c) => c.name);
  const loaded = results.flatMap((r, i) =>
    r ? [{ ...r, cup: !competitions[i].countries.length }] : [],
  );
  if (!loaded.length) throw new Error("Geen enkele wedstrijdbron reageerde.");

  const seen = new Set<string>();
  const inRange: Match[] = [],
    later: Match[] = [];
  let missingVenues = 0;
  const fixtures = loaded.flatMap((r) =>
    r.fixtures.map((f) => ({ f, cup: r.cup })),
  );
  for (const { f: fixture, cup } of fixtures) {
    if (seen.has(fixture.id)) continue;
    seen.add(fixture.id);
    const match = toMatch(fixture, byId);
    if (!match) {
      // A cup match at an unknown stadium can be anywhere in Europe: not worth reporting.
      if (!cup && fixture.date >= input.start && fixture.date <= input.end)
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

  const names = competitions
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
