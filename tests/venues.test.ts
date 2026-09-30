import test from "node:test";
import assert from "node:assert/strict";
import { CUPS, LEAGUES } from "../lib/leagues";
import { VENUES } from "../lib/venues";

test("the stadium table is complete and plausible", () => {
  const slugs = new Set(
    [...LEAGUES, ...CUPS].flatMap((l) => (l.espn ? [l.espn] : [])),
  );
  const ids = new Set<string>();
  for (const v of VENUES) {
    assert.ok(!ids.has(v.id), `duplicate ${v.id}`);
    ids.add(v.id);
    assert.ok(
      v.lat > 27 && v.lat < 72 && v.lon > -32 && v.lon < 80,
      `${v.name}: ${v.lat},${v.lon}`,
    );
    assert.doesNotThrow(
      () => new Intl.DateTimeFormat("en", { timeZone: v.timezone }),
    );
    for (const c of v.competitions) assert.ok(slugs.has(c), `${v.name}: ${c}`);
  }
  // Every ESPN-only league needs its stadiums, or it is never searched.
  for (const l of LEAGUES.filter(
    (l) => l.espn && !l.openfootball && !l.openLigaDb,
  ))
    assert.ok(
      VENUES.filter((v) => v.competitions.includes(l.espn!)).length >= 10,
      l.name,
    );
});
