import type { League } from "./leagues";
import { isoInstant, record, text, type Fixture } from "./sources";
import { localDateIn } from "./time";

// ESPN's public site API: undocumented and without a key, so it can change without notice.
// One request returns a league's matches for one calendar month. ESPN refuses requests with
// some custom User-Agents, so none is set.
export const espnUrl = (slug: string, month: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${month}`;

/** Calendar months (YYYYMM) from the start to the end of a period. */
export function espnMonths(start: string, end: string) {
  const months: string[] = [];
  const d = new Date(start.slice(0, 7) + "-01T00:00:00Z");
  while (d.toISOString().slice(0, 7) <= end.slice(0, 7)) {
    months.push(d.toISOString().slice(0, 7).replace("-", ""));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return months;
}

/** Runs at most `max` tasks at the same time. */
export function limit(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>((go) => waiting.push(go));
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

const UNPLAYABLE = /POSTPONED|CANCEL|ABANDON|SUSPEND|FORFEIT/;
const color = (v: unknown) => {
  const s = text(v);
  return s && /^[0-9a-f]{6}$/i.test(s) ? `#${s.toLowerCase()}` : undefined;
};

export function parseEspn(data: unknown, league: League): Fixture[] {
  const events = record(data)?.events;
  if (!Array.isArray(events)) throw new Error("ESPN: unexpected format");
  const fixtures: Fixture[] = [];
  for (const raw of events) {
    const e = record(raw);
    const competition = record(
      Array.isArray(e?.competitions) ? e.competitions[0] : undefined,
    );
    const status = record(record(competition?.status ?? e?.status)?.type);
    if (!e || !competition || status?.state === "post") continue;
    if (UNPLAYABLE.test(text(status?.name) ?? "")) continue;
    const sides = Array.isArray(competition.competitors)
      ? competition.competitors.map(record)
      : [];
    const home = record(sides.find((c) => c?.homeAway === "home")?.team),
      away = record(sides.find((c) => c?.homeAway === "away")?.team);
    const id = text(e.id),
      homeName = text(home?.displayName),
      awayName = text(away?.displayName),
      utc = isoInstant(e.date);
    if (!id || !homeName || !awayName || !utc) continue;
    const venue = record(competition.venue ?? e.venue),
      venueId = text(venue?.id),
      address = record(venue?.address);
    // Without a confirmed kick-off ESPN parks a match at 20:00 UTC on a provisional date.
    const timed = competition.timeValid !== false;
    fixtures.push({
      id: `espn-${id}`,
      leagueId: league.id,
      leagueName: league.name,
      countries: league.countries.length ? league.countries : undefined,
      home: homeName,
      away: awayName,
      date: timed ? localDateIn(utc, league.timezone) : utc.slice(0, 10),
      utc: timed ? utc : undefined,
      provisional: !timed,
      source: "ESPN",
      venue: venueId
        ? {
            id: venueId,
            name: text(venue?.fullName) ?? "",
            city: text(address?.city),
            country: text(address?.country),
          }
        : undefined,
      homeRef: text(home?.id),
      homeColor: color(home?.color),
      awayColor: color(away?.color),
    });
  }
  return fixtures;
}
