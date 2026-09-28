import test from "node:test";
import assert from "node:assert/strict";
import {
  distanceKm,
  inDateRange,
  searchMatches,
  ticketScore,
  addDays,
} from "../lib/football";
import { demoMatches } from "../lib/demo";
test("distance is symmetric and handles dateline", () => {
  const a = { lat: 0, lon: 179.9 },
    b = { lat: 0, lon: -179.9 };
  assert.ok(Math.abs(distanceKm(a, b) - 22.239) < 0.01);
  assert.equal(distanceKm(a, b), distanceKm(b, a));
  assert.equal(distanceKm(a, a), 0);
});
test("stadium local date determines range near midnight and DST", () => {
  const m = demoMatches("2026-09-28")[0];
  m.kickoff = "2026-09-28T22:30:00Z";
  assert.equal(inDateRange(m, "2026-09-29", "2026-09-29"), true);
  assert.equal(inDateRange(m, "2026-09-28", "2026-09-28"), false);
});
test("radius and date exclude distant fixtures", () => {
  const matches = demoMatches("2026-09-28");
  assert.equal(
    searchMatches(
      matches,
      { name: "De Kuip", lat: 51.8939, lon: 4.523 },
      1,
      "2026-09-28",
      "2026-10-04",
    ).length,
    1,
  );
  assert.equal(
    searchMatches(
      matches,
      { name: "London", lat: 51.5, lon: -0.12 },
      50,
      "2026-09-28",
      "2026-10-04",
    ).length,
    0,
  );
});
test("unknown tickets never become a score; derby lowers heuristic", () => {
  const m = demoMatches("2026-09-28")[0];
  assert.equal(ticketScore({ ...m, demand: "unknown" }), null);
  assert.equal(ticketScore({ ...m, demand: "high", derby: true }), 1);
  assert.equal(ticketScore({ ...m, demand: "low" }), 4);
});
test("date arithmetic crosses month and year", () => {
  assert.equal(addDays("2026-12-29", 6), "2027-01-04");
});
