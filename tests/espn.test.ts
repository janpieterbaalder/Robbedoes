import test from "node:test";
import assert from "node:assert/strict";
import { espnMonths, limit, parseEspn } from "../lib/espn";
import { LEAGUES } from "../lib/leagues";

const kkd = LEAGUES.find((l) => l.id === "nl.2")!;
const venue = {
  id: "10267",
  fullName: "GS Staalwerken Stadion",
  address: { city: "Helmond", country: "Netherlands" },
};
const event = (
  id: string,
  date: string,
  extra: { timeValid?: boolean; state?: string; name?: string } = {},
) => ({
  id,
  date,
  competitions: [
    {
      timeValid: extra.timeValid ?? true,
      status: {
        type: {
          state: extra.state ?? "pre",
          name: extra.name ?? "STATUS_SCHEDULED",
        },
      },
      venue,
      competitors: [
        {
          homeAway: "home",
          team: { id: "3775", displayName: "Helmond Sport", color: "E30613" },
        },
        {
          homeAway: "away",
          team: { id: "131", displayName: "Heracles Almelo", color: "nope" },
        },
      ],
    },
  ],
});

test("reads ESPN matches with their stadium", () => {
  const [timed, untimed, ...rest] = parseEspn(
    {
      events: [
        event("1", "2026-10-02T19:00Z"),
        event("2", "2026-11-01T20:00Z", { timeValid: false }),
        event("3", "2026-09-26T18:00Z", { state: "post" }),
        event("4", "2026-10-09T18:00Z", { name: "STATUS_POSTPONED" }),
      ],
    },
    kkd,
  );
  assert.equal(rest.length, 0);
  assert.deepEqual(timed, {
    id: "espn-1",
    leagueId: "nl.2",
    leagueName: "Keuken Kampioen Divisie",
    countries: ["NL"],
    home: "Helmond Sport",
    away: "Heracles Almelo",
    date: "2026-10-02",
    utc: "2026-10-02T19:00:00Z",
    provisional: false,
    source: "ESPN",
    venue: {
      id: "10267",
      name: "GS Staalwerken Stadion",
      city: "Helmond",
      country: "Netherlands",
    },
    homeRef: "3775",
    homeColor: "#e30613",
    awayColor: undefined,
  });
  // ESPN parks unconfirmed matches at 20:00 UTC: no kick-off, provisional date.
  assert.equal(untimed.utc, undefined);
  assert.equal(untimed.date, "2026-11-01");
  assert.equal(untimed.provisional, true);
});

test("rejects an unexpected ESPN format", () => {
  assert.throws(() => parseEspn({ leagues: [] }, kkd));
});

test("lists the calendar months of a period", () => {
  assert.deepEqual(espnMonths("2026-09-28", "2026-10-27"), [
    "202609",
    "202610",
  ]);
  assert.deepEqual(espnMonths("2026-12-20", "2027-01-05"), [
    "202612",
    "202701",
  ]);
  assert.deepEqual(espnMonths("2026-10-01", "2026-10-31"), ["202610"]);
});

test("limit runs no more tasks at once than allowed", async () => {
  const slot = limit(2);
  let active = 0,
    peak = 0;
  await Promise.all(
    Array.from({ length: 6 }, () =>
      slot(async () => {
        peak = Math.max(peak, ++active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
      }),
    ),
  );
  assert.equal(peak, 2);
});
