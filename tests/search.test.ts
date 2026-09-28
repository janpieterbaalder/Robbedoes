import test from "node:test";
import assert from "node:assert/strict";
import { HttpError, type FetchJson } from "../lib/cache";
import { searchEurope } from "../lib/search";

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
    { fetchJson },
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
    { fetchJson },
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
    { fetchJson },
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
    { fetchJson },
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
    { fetchJson },
  );
  assert.equal(r.matches.length, 0);
  assert.equal(r.nextDate, "2026-10-10");
});

test("outside the covered countries the nearest stadium is named", async () => {
  const { fetchJson, requested } = fakeFetch({});
  const r = await searchEurope(
    { lat: 50.85, lon: 4.35, radius: 50, ...WEEK },
    { fetchJson },
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
    searchEurope({ ...ROTTERDAM, radius: 50, ...WEEK }, { fetchJson }),
  );
});

test("with an API key the Champions League is added through football-data.org", async () => {
  const { fetchJson, requested } = fakeFetch({
    "nl.1.json": eredivisie,
    "competitions=CL": {
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
    },
  });
  const r = await searchEurope(
    { ...ROTTERDAM, radius: 50, ...WEEK },
    { fetchJson, footballDataKey: "secret" },
  );
  const cl = r.matches.find((m) => m.league === "Champions League")!;
  assert.equal(cl.home, "Feyenoord");
  assert.equal(cl.away, "FC Barcelona");
  assert.equal(r.source, "openfootball, football-data.org");
  const call = requested.find((q) => q.url.includes("api.football-data.org"))!;
  assert.equal(call.headers?.["X-Auth-Token"], "secret");
  // Club Brugge is not in the catalogue: skipped and counted, never guessed.
  assert.equal(r.missingVenues, 2);
});
