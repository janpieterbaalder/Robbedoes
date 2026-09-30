import test from "node:test";
import assert from "node:assert/strict";
import { HttpError, type FetchJson } from "../lib/cache";
import { distanceKm } from "../lib/football";
import { searchEurope } from "../lib/search";
import type { Venue } from "../lib/venues";

const ROTTERDAM = { lat: 51.92, lon: 4.48 };
const DORTMUND = { lat: 51.51, lon: 7.47 };
const WEEK = { start: "2026-10-09", end: "2026-10-15" };

const eredivisie = {
  matches: [
    {
      date: "2026-10-10",
      time: "18:45",
      team1: "Feyenoord Rotterdam",
      team2: "AZ",
    },
    {
      date: "2026-10-11",
      time: "14:30",
      team1: "SBV Excelsior",
      team2: "FC Groningen",
    },
    { date: "2026-10-11", team1: "AFC Ajax", team2: "PSV" },
    { date: "2026-10-12", time: "20:00", team1: "Unknown Club", team2: "AZ" },
    { date: "2026-11-01", time: "12:15", team1: "Unknown Club", team2: "PSV" },
    {
      date: "2026-10-24",
      time: "16:30",
      team1: "Sparta Rotterdam",
      team2: "NEC",
    },
  ],
};

function fakeFetch(routes: Record<string, unknown>) {
  const requested: { url: string; headers?: Record<string, string> }[] = [];
  const fetchJson: FetchJson = async (url, { headers }) => {
    requested.push({ url, headers });
    for (const [part, body] of Object.entries(routes))
      if (url.includes(part)) {
        if (body instanceof Error) throw body;
        return body;
      }
    throw new HttpError(404);
  };
  return { fetchJson, requested };
}

test("searches only leagues with a club inside the radius", async () => {
  const { fetchJson, requested } = fakeFetch({
    "2026-27/nl.1.json": eredivisie,
  });
  const r = await searchEurope(
    { ...ROTTERDAM, radius: 50, ...WEEK },
    { fetchJson, venues: [] },
  );
  assert.deepEqual(
    requested.map((q) => q.url),
    [
      "https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/nl.1.json",
    ],
  );
  assert.equal(r.source, "openfootball");
  assert.equal(r.coverage, "Eredivisie");
  // Ajax–PSV lies outside 50 km; the unknown home side is skipped and counted.
  assert.deepEqual(
    r.matches.map((m) => [m.home, m.away, m.kickoff]),
    [
      ["Feyenoord", "AZ", "2026-10-10T16:45:00Z"],
      ["Excelsior", "FC Groningen", "2026-10-11T12:30:00Z"],
    ],
  );
  assert.equal(r.matches[0].stadium, "De Kuip");
  assert.equal(r.matches[0].homeId, "feyenoord");
  assert.equal(r.missingVenues, 1);
  assert.equal(r.warning, undefined);
});

test("matches without a kick-off time stay on their local match day", async () => {
  const { fetchJson } = fakeFetch({ "nl.1.json": eredivisie });
  const r = await searchEurope(
    { lat: 52.35, lon: 4.9, radius: 30, ...WEEK },
    { fetchJson, venues: [] },
  );
  const ajax = r.matches.find((m) => m.home === "Ajax")!;
  assert.equal(ajax.timeTbc, true);
  assert.equal(ajax.kickoff, "2026-10-11T10:00:00Z");
});

test("falls back to the next feed and reports leagues without data", async () => {
  const { fetchJson, requested } = fakeFetch({
    "openligadb.de/getmatchdata/bl1": new Error("blocked"),
    "2026-27/de.1.json": {
      matches: [
        {
          date: "2026-10-09",
          time: "20:30",
          team1: "Borussia Dortmund",
          team2: "SV Werder Bremen",
        },
      ],
    },
  });
  const r = await searchEurope(
    { ...DORTMUND, radius: 40, ...WEEK },
    { fetchJson, venues: [] },
  );
  assert.ok(
    requested.some((q) =>
      q.url.includes("openligadb.de/getmatchdata/bl2/2026"),
    ),
  );
  assert.equal(r.source, "openfootball");
  assert.equal(r.coverage, "Bundesliga");
  assert.equal(
    r.warning,
    "Geen gegevens beschikbaar voor 2. Bundesliga, 3. Liga.",
  );
  assert.equal(r.matches[0].kickoff, "2026-10-09T18:30:00Z");
  assert.equal(r.matches[0].home, "Borussia Dortmund");
});

test("uses OpenLigaDB first for German leagues", async () => {
  const { fetchJson } = fakeFetch({
    "getmatchdata/bl2/2026": [
      {
        matchID: 99,
        matchDateTimeUTC: "2026-10-10T11:00:00Z",
        team1: { teamName: "VfL Bochum" },
        team2: { teamName: "Hertha BSC" },
        matchIsFinished: false,
      },
    ],
    "getmatchdata/bl1/2026": [],
    "getmatchdata/bl3/2026": [],
  });
  const r = await searchEurope(
    { ...DORTMUND, radius: 40, ...WEEK },
    { fetchJson, venues: [] },
  );
  assert.equal(r.source, "OpenLigaDB");
  assert.deepEqual(
    r.matches.map((m) => [m.id, m.home, m.league]),
    [["ol-99", "VfL Bochum", "2. Bundesliga"]],
  );
});

test("an empty period points to the next match day", async () => {
  const { fetchJson } = fakeFetch({ "nl.1.json": eredivisie });
  const r = await searchEurope(
    { ...ROTTERDAM, radius: 50, start: "2026-09-28", end: "2026-10-04" },
    { fetchJson, venues: [] },
  );
  assert.equal(r.matches.length, 0);
  assert.equal(r.nextDate, "2026-10-10");
});

test("outside the covered countries the nearest stadium is named", async () => {
  const { fetchJson, requested } = fakeFetch({});
  const r = await searchEurope(
    { lat: 50.85, lon: 4.35, radius: 50, ...WEEK },
    { fetchJson, venues: [] },
  );
  assert.equal(requested.length, 0);
  assert.equal(r.matches.length, 0);
  assert.deepEqual(r.nearest, {
    club: "Lille",
    city: "Villeneuve-d'Ascq",
    distance: 90,
  });
});

test("throws when no source answers at all", async () => {
  const { fetchJson } = fakeFetch({});
  await assert.rejects(
    searchEurope(
      { ...ROTTERDAM, radius: 50, ...WEEK },
      { fetchJson, venues: [] },
    ),
  );
});

const venue = (
  id: string,
  name: string,
  city: string,
  lat: number,
  lon: number,
  competitions: string[],
  approx?: boolean,
): Venue => ({
  id,
  name,
  city,
  country: "NL",
  lat,
  lon,
  timezone: "Europe/Amsterdam",
  competitions,
  ...(approx ? { approx } : {}),
});
const KUIP = venue("1", "De Kuip", "Rotterdam", 51.8939, 4.5231, [
  "uefa.champions",
]);
const BRUGGE = {
  ...venue("2", "Jan Breydelstadion", "Brugge", 51.1932, 3.1806, [
    "uefa.champions",
  ]),
  country: "BE",
  timezone: "Europe/Brussels",
};
const HELMOND = venue(
  "3",
  "GS Staalwerken Stadion",
  "Helmond",
  51.4697,
  5.6523,
  ["ned.2"],
  true,
);

const espnEvent = (
  id: string,
  date: string,
  venueId: string,
  home: string,
  away: string,
  timeValid = true,
) => ({
  id,
  date,
  competitions: [
    {
      timeValid,
      status: { type: { state: "pre", name: "STATUS_SCHEDULED" } },
      venue: { id: venueId, fullName: "ESPN name", address: { city: "X" } },
      competitors: [
        {
          homeAway: "home",
          team: { id: "7" + id, displayName: home, color: "E30613" },
        },
        { homeAway: "away", team: { id: "8" + id, displayName: away } },
      ],
    },
  ],
});
const clMatches = {
  matches: [
    {
      id: 7,
      utcDate: "2026-10-14T19:00:00Z",
      status: "TIMED",
      competition: { code: "CL" },
      homeTeam: { name: "Feyenoord Rotterdam" },
      awayTeam: { name: "FC Barcelona" },
    },
    {
      id: 8,
      utcDate: "2026-10-14T19:00:00Z",
      status: "TIMED",
      competition: { code: "CL" },
      homeTeam: { name: "Club Brugge KV" },
      awayTeam: { name: "AFC Ajax" },
    },
  ],
};

test("European cups come from ESPN and are placed by stadium", async () => {
  const { fetchJson, requested } = fakeFetch({
    "nl.1.json": eredivisie,
    "uefa.champions/scoreboard?dates=202610": {
      events: [
        espnEvent(
          "11",
          "2026-10-14T19:00Z",
          "1",
          "Feyenoord Rotterdam",
          "FC Barcelona",
        ),
        espnEvent("12", "2026-10-14T19:00Z", "2", "Club Brugge", "Ajax"),
      ],
    },
  });
  const r = await searchEurope(
    { ...ROTTERDAM, radius: 50, ...WEEK },
    { fetchJson, venues: [KUIP, BRUGGE] },
  );
  const cl = r.matches.find((m) => m.league === "Champions League")!;
  // Catalogue clubs keep their own name, colour and website; the stadium comes from the table.
  assert.equal(cl.home, "Feyenoord");
  assert.equal(cl.homeId, "feyenoord");
  assert.equal(cl.stadium, "De Kuip");
  assert.equal(cl.ticketUrl, "https://feyenoord.com");
  assert.equal(cl.kickoff, "2026-10-14T19:00:00Z");
  assert.equal(r.source, "openfootball, ESPN");
  assert.equal(r.coverage, "Eredivisie, Champions League");
  // Brugge lies outside the radius; the Europa and Conference League have no stadium nearby.
  assert.equal(
    r.matches.filter((m) => m.league === "Champions League").length,
    1,
  );
  assert.ok(!requested.some((q) => q.url.includes("uefa.europa")));
  assert.equal(r.missingVenues, 1);
});

test("without ESPN the Champions League falls back to football-data.org", async () => {
  const { fetchJson, requested } = fakeFetch({
    "nl.1.json": eredivisie,
    "uefa.champions/scoreboard": new Error("blocked"),
    "competitions=CL": clMatches,
  });
  const r = await searchEurope(
    { ...ROTTERDAM, radius: 50, ...WEEK },
    { fetchJson, footballDataKey: "secret", venues: [KUIP] },
  );
  const cl = r.matches.find((m) => m.league === "Champions League")!;
  assert.equal(cl.home, "Feyenoord");
  assert.equal(cl.away, "FC Barcelona");
  assert.equal(r.source, "openfootball, football-data.org");
  const call = requested.find((q) => q.url.includes("api.football-data.org"))!;
  assert.equal(call.headers?.["X-Auth-Token"], "secret");
  // Club Brugge is not in the catalogue: skipped, and not counted because a cup match at
  // an unknown stadium can be anywhere in Europe.
  assert.equal(r.missingVenues, 1);
});

test("an ESPN-only league is searched when one of its stadiums is in range", async () => {
  const { fetchJson } = fakeFetch({
    "nl.1.json": eredivisie,
    "ned.2/scoreboard?dates=202610": {
      events: [
        espnEvent(
          "21",
          "2026-10-10T18:00Z",
          "3",
          "Helmond Sport",
          "Heracles Almelo",
        ),
        espnEvent(
          "22",
          "2026-10-12T20:00Z",
          "3",
          "Helmond Sport",
          "FC Emmen",
          false,
        ),
        espnEvent("23", "2026-10-11T12:00Z", "999", "Jong PSV", "Vitesse"),
      ],
    },
  });
  const r = await searchEurope(
    { lat: 51.44, lon: 5.48, radius: 25, ...WEEK },
    { fetchJson, venues: [HELMOND] },
  );
  const helmond = r.matches.filter(
    (m) => m.league === "Keuken Kampioen Divisie",
  );
  assert.deepEqual(
    helmond.map((m) => [m.home, m.away, m.kickoff, m.timeTbc ?? false]),
    [
      ["Helmond Sport", "Heracles Almelo", "2026-10-10T18:00:00Z", false],
      // No confirmed kick-off: noon local time on ESPN's provisional date.
      ["Helmond Sport", "FC Emmen", "2026-10-12T10:00:00Z", true],
    ],
  );
  assert.equal(helmond[0].homeId, "espn-721");
  assert.equal(helmond[0].stadium, "GS Staalwerken Stadion");
  assert.equal(helmond[0].color, "#e30613");
  assert.equal(helmond[0].approx, true);
  assert.equal(helmond[0].source, "ESPN");
  assert.equal(helmond[1].provisional, true);
  // Jong PSV plays at a stadium missing from the table: skipped and counted, like the
  // unknown Eredivisie club in the test data.
  assert.equal(r.missingVenues, 2);
});

test("the nearest stadium can come from the stadium table", async () => {
  const { fetchJson } = fakeFetch({});
  const here = { lat: 51.6, lon: 5.9 };
  const r = await searchEurope(
    { ...here, radius: 5, ...WEEK },
    { fetchJson, venues: [HELMOND] },
  );
  assert.equal(r.nearest?.club, "GS Staalwerken Stadion");
  assert.equal(r.nearest?.distance, Math.round(distanceKm(here, HELMOND)));
});
