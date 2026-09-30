import test from "node:test";
import assert from "node:assert/strict";
import { CUPS, LEAGUES, seasonOf } from "../lib/leagues";
import {
  footballDataWindows,
  parseFootballData,
  parseOpenfootball,
  parseOpenLigaDb,
} from "../lib/sources";

const league = (id: string) => LEAGUES.find((l) => l.id === id)!;

test("openfootball: local times in the league zone, played and postponed matches skipped", () => {
  const fixtures = parseOpenfootball(
    {
      name: "Portuguese Primeira Liga 2026/27",
      matches: [
        {
          round: "Matchday 1",
          date: "2026-08-07",
          time: "20:15",
          team1: "FC Porto",
          team2: "Casa Pia AC",
          score: { ft: [2, 0] },
        },
        {
          round: "Matchday 8",
          date: "2026-10-09",
          time: "20:15",
          team1: "Sporting Clube de Braga",
          team2: "Sporting Clube de Portugal",
        },
        {
          round: "Matchday 8",
          date: "2026-10-10",
          time: " ",
          team1: "Casa Pia AC",
          team2: "CD Santa Clara",
        },
        {
          round: "Matchday 3",
          date: "2026-08-23",
          team1: "Rio Ave FC",
          team2: "FC Porto",
          status: "postponed",
        },
        { round: "Matchday 9", date: "not a date", team1: "A", team2: "B" },
      ],
    },
    league("pt.1"),
    "2026-27",
  );
  assert.equal(fixtures.length, 2);
  assert.equal(fixtures[0].utc, "2026-10-09T19:15:00Z");
  assert.equal(
    fixtures[0].id,
    "of-pt.1-2026-27-sporting-clube-de-braga-sporting-clube-de-portugal",
  );
  assert.equal(fixtures[1].utc, undefined);
  assert.equal(fixtures[1].date, "2026-10-10");
  assert.throws(() =>
    parseOpenfootball({ nope: [] }, league("pt.1"), "2026-27"),
  );
});

test("OpenLigaDB: UTC times, finished matches skipped", () => {
  const fixtures = parseOpenLigaDb(
    [
      {
        matchID: 1,
        matchDateTimeUTC: "2026-10-09T18:30:00Z",
        team1: { teamName: "Borussia Dortmund" },
        team2: { teamName: "SV Werder Bremen" },
        matchIsFinished: false,
      },
      {
        matchID: 2,
        matchDateTimeUTC: "2026-08-28T18:30:00Z",
        team1: { teamName: "FC Bayern München" },
        team2: { teamName: "RB Leipzig" },
        matchIsFinished: true,
      },
      {
        matchID: 3,
        matchDateTimeUTC: "2026-10-10T22:30:00",
        team1: { teamName: "Hertha BSC" },
        team2: { teamName: "VfL Bochum" },
        matchIsFinished: false,
      },
      { matchID: 4, team1: { teamName: "X" }, team2: { teamName: "Y" } },
    ],
    league("de.2"),
  );
  assert.deepEqual(
    fixtures.map((f) => [f.id, f.utc, f.date]),
    [
      ["ol-1", "2026-10-09T18:30:00Z", "2026-10-09"],
      ["ol-3", "2026-10-10T22:30:00Z", "2026-10-11"],
    ],
  );
  assert.throws(() => parseOpenLigaDb({}, league("de.1")));
});

test("football-data.org: TIMED has a kick-off, SCHEDULED only a date, open ties skipped", () => {
  const fixtures = parseFootballData(
    {
      matches: [
        {
          id: 10,
          utcDate: "2026-10-10T16:45:00Z",
          status: "TIMED",
          competition: { code: "DED" },
          homeTeam: { name: "Feyenoord Rotterdam" },
          awayTeam: { name: "AZ" },
        },
        {
          id: 11,
          utcDate: "2026-11-07T00:00:00Z",
          status: "SCHEDULED",
          competition: { code: "CL" },
          homeTeam: { name: "PSV" },
          awayTeam: { name: "FC Barcelona" },
        },
        {
          id: 12,
          utcDate: "2026-11-08T20:00:00Z",
          status: "TIMED",
          competition: { code: "CL" },
          homeTeam: { name: null },
          awayTeam: { name: "AFC Ajax" },
        },
        {
          id: 13,
          utcDate: "2026-09-20T12:00:00Z",
          status: "FINISHED",
          competition: { code: "DED" },
          homeTeam: { name: "PSV" },
          awayTeam: { name: "AZ" },
        },
        {
          id: 14,
          utcDate: "2026-10-10T12:00:00Z",
          status: "TIMED",
          competition: { code: "XYZ" },
          homeTeam: { name: "PSV" },
          awayTeam: { name: "AZ" },
        },
      ],
    },
    [...LEAGUES, ...CUPS],
  );
  assert.deepEqual(
    fixtures.map((f) => [f.id, f.leagueName, f.utc, f.date, f.provisional]),
    [
      ["fd-10", "Eredivisie", "2026-10-10T16:45:00Z", "2026-10-10", false],
      ["fd-11", "Champions League", undefined, "2026-11-07", true],
    ],
  );
});

test("football-data.org windows are aligned, short and cover the period", () => {
  const windows = footballDataWindows("2026-10-01", "2026-10-31");
  const day = 86400000;
  for (const w of windows)
    assert.equal(Date.parse(w.to) - Date.parse(w.from), 7 * day);
  assert.ok(windows[0].from <= "2026-09-30");
  assert.ok(windows.at(-1)!.to >= "2026-11-02");
  // A shorter search inside one of those weeks asks for the same, cacheable window.
  assert.deepEqual(footballDataWindows("2026-10-03", "2026-10-03"), [
    windows[1],
  ]);
});

test("seasons run from July to June", () => {
  assert.deepEqual(seasonOf("2026-09-28"), { label: "2026-27", year: 2026 });
  assert.deepEqual(seasonOf("2027-05-30"), { label: "2026-27", year: 2026 });
  assert.deepEqual(seasonOf("2027-07-01"), { label: "2027-28", year: 2027 });
});
