import test from "node:test";
import assert from "node:assert/strict";
import { distanceKm, inDateRange, ticketScore, addDays } from "../lib/football";
import type { Match } from "../lib/types";

const match: Match = {
  id: "of-nl.1-2026-27-feyenoord-ajax",
  home: "Feyenoord",
  away: "Ajax",
  kickoff: "2026-09-28T22:30:00Z",
  league: "Eredivisie",
  stadium: "De Kuip",
  city: "Rotterdam",
  lat: 51.8939,
  lon: 4.5231,
  timezone: "Europe/Amsterdam",
  color: "#e8323b",
  ticketUrl: "https://feyenoord.com",
  demand: "unknown",
};

test("distance is symmetric and handles dateline", () => {
  const a = { lat: 0, lon: 179.9 },
    b = { lat: 0, lon: -179.9 };
  assert.ok(Math.abs(distanceKm(a, b) - 22.239) < 0.01);
  assert.equal(distanceKm(a, b), distanceKm(b, a));
  assert.equal(distanceKm(a, a), 0);
});
test("stadium local date determines range near midnight and DST", () => {
  assert.equal(inDateRange(match, "2026-09-29", "2026-09-29"), true);
  assert.equal(inDateRange(match, "2026-09-28", "2026-09-28"), false);
});
test("unknown tickets never become a score; derby lowers heuristic", () => {
  assert.equal(ticketScore(match), null);
  assert.equal(ticketScore({ ...match, demand: "high", derby: true }), 1);
  assert.equal(ticketScore({ ...match, demand: "low" }), 4);
});
test("date arithmetic crosses month and year", () => {
  assert.equal(addDays("2026-12-29", 6), "2027-01-04");
});
