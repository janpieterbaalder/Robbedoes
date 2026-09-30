import test from "node:test";
import assert from "node:assert/strict";
import { isIsoDate, localDateIn, zonedTimeToUtc } from "../lib/time";

test("local kick-off times convert to UTC across daylight saving", () => {
  assert.equal(
    zonedTimeToUtc("2026-10-10", "18:45", "Europe/Amsterdam"),
    "2026-10-10T16:45:00Z",
  );
  // Clocks go back on 25 October 2026.
  assert.equal(
    zonedTimeToUtc("2026-10-24", "15:00", "Europe/London"),
    "2026-10-24T14:00:00Z",
  );
  assert.equal(
    zonedTimeToUtc("2026-10-25", "15:00", "Europe/London"),
    "2026-10-25T15:00:00Z",
  );
  assert.equal(
    zonedTimeToUtc("2027-01-16", "20:45", "Europe/Rome"),
    "2027-01-16T19:45:00Z",
  );
  assert.equal(
    zonedTimeToUtc("2027-01-16", "18:00", "Atlantic/Azores"),
    "2027-01-16T19:00:00Z",
  );
});

test("local dates follow the stadium time zone", () => {
  assert.equal(
    localDateIn("2026-10-10T22:30:00Z", "Europe/Berlin"),
    "2026-10-11",
  );
  assert.equal(
    localDateIn("2026-10-10T22:30:00Z", "Europe/London"),
    "2026-10-10",
  );
});

test("only real calendar dates are accepted", () => {
  assert.equal(isIsoDate("2026-10-10"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("2026-1-10"), false);
  assert.equal(isIsoDate(20261010), false);
});
