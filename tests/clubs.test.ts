import test from "node:test";
import assert from "node:assert/strict";
import { CLUBS } from "../lib/clubs";
import { findClub, normalizeName } from "../lib/club-lookup";
import { LEAGUES } from "../lib/leagues";
import { OPENFOOTBALL_TEAMS_2026 } from "./fixtures/teams";

test("catalogue entries are complete and plausible", () => {
  const ids = new Set<string>();
  for (const c of CLUBS) {
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
    ids.add(c.id);
    // Covered countries lie between the Azores/Madeira and Lecce in the Italian heel.
    assert.ok(c.lat > 32 && c.lat < 56, `${c.id} latitude`);
    assert.ok(c.lon > -26 && c.lon < 19, `${c.id} longitude`);
    assert.doesNotThrow(
      () => new Intl.DateTimeFormat("en", { timeZone: c.timezone }),
      `${c.id} time zone`,
    );
    if (c.website) assert.match(c.website, /^https:\/\/[a-z0-9.-]+\.[a-z]+$/);
    assert.match(c.color, /^#[0-9a-f]{6}$/);
  }
});

test("normalised aliases never point to two clubs", () => {
  const owner = new Map<string, string>();
  for (const c of CLUBS)
    for (const alias of c.aliases) {
      const key = normalizeName(alias);
      assert.ok(key, `${c.id}: alias "${alias}" normalises to nothing`);
      const other = owner.get(key);
      assert.ok(
        !other || other === c.id,
        `"${key}" is used by ${other} and ${c.id}`,
      );
      owner.set(key, c.id);
    }
});

test("every 2026/27 openfootball team resolves within its league", () => {
  for (const [code, teams] of Object.entries(OPENFOOTBALL_TEAMS_2026)) {
    const league = LEAGUES.find((l) => l.openfootball === code)!;
    for (const team of teams) {
      const club = findClub(team, league.countries);
      assert.ok(club, `${code}: ${team}`);
      assert.ok(league.countries.includes(club.country), `${code}: ${team}`);
    }
  }
});

test("provider spellings resolve to the right club", () => {
  const de = ["DE"],
    es = ["ES"],
    pt = ["PT"];
  assert.equal(findClub("Bor. Mönchengladbach", de)?.id, "gladbach");
  assert.equal(findClub("SC Preußen Münster", de)?.id, "munster");
  assert.equal(findClub("F.C. Hansa Rostock", de)?.id, "rostock");
  assert.equal(findClub("TSG Hoffenheim", de)?.id, "hoffenheim");
  assert.equal(findClub("TSG Hoffenheim II", de)?.id, "hoffenheim-ii");
  assert.equal(findClub("VfB Stuttgart 2", de)?.id, "stuttgart-ii");
  assert.equal(findClub("1. FC Köln", de)?.id, "koln");
  assert.equal(findClub("SC Fortuna Köln", de)?.id, "fortuna-koln");
  assert.equal(findClub("Espanyol de Barcelona", es)?.id, "espanyol");
  assert.equal(findClub("Real Betis Balompié SAD", es)?.id, "betis");
  assert.equal(findClub("Sporting Braga", pt)?.id, "braga");
  assert.equal(findClub("Sporting", pt)?.id, "sporting");
  assert.equal(findClub("Paris SG")?.id, "psg");
  assert.equal(findClub("Paris FC")?.id, "paris-fc");
  assert.equal(findClub("Brighton and Hove Albion")?.id, "brighton");
  // ESPN spellings, which only count as whole names.
  assert.equal(findClub("FC Cologne", de, true)?.id, "koln");
  assert.equal(findClub("C.D. Nacional", pt, true)?.id, "nacional");
  assert.equal(findClub("Estrela", pt, true)?.id, "estrela");
});

test("unknown or reserve sides never borrow a first-team stadium", () => {
  assert.equal(findClub("FC Bayern München II", ["DE"]), undefined);
  assert.equal(findClub("Hannover 96 II", ["DE"]), undefined);
  assert.equal(findClub("Real Madrid Castilla", ["ES"]), undefined);
  assert.equal(findClub("Sporting Gijón", ["ES"]), undefined);
  assert.equal(findClub("Club Brugge KV"), undefined);
  assert.equal(findClub("Celtic FC"), undefined);
});
