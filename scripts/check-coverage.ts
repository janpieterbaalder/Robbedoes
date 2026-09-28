// Lists team names from the live feeds that the club catalogue cannot place.
// Run after promotions and relegations: npm run check:coverage
import { findClub } from "../lib/club-lookup";
import { LEAGUES, seasonOf } from "../lib/leagues";
import {
  openfootballUrl,
  openLigaDbUrl,
  parseOpenfootball,
  parseOpenLigaDb,
  type Fixture,
} from "../lib/sources";

const season = seasonOf(new Date().toISOString().slice(0, 10));

async function load(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  let unresolved = 0;
  for (const league of LEAGUES) {
    const feeds: [string, () => Promise<Fixture[]>][] = [];
    if (league.openLigaDb) {
      const url = openLigaDbUrl(league.openLigaDb, season.year);
      feeds.push([url, async () => parseOpenLigaDb(await load(url), league)]);
    }
    if (league.openfootball) {
      const url = openfootballUrl(season.label, league.openfootball);
      feeds.push([
        url,
        async () => parseOpenfootball(await load(url), league, season.label),
      ]);
    }
    for (const [url, read] of feeds) {
      try {
        const fixtures = await read();
        const names = [...new Set(fixtures.flatMap((f) => [f.home, f.away]))];
        const missing = names.filter((n) => !findClub(n, league.countries));
        unresolved += missing.length;
        console.log(
          `${missing.length ? "✗" : "✓"} ${league.name}: ${names.length} teams${missing.length ? `, zonder stadion: ${missing.join(", ")}` : ""}  (${url})`,
        );
      } catch (error) {
        console.log(
          `- ${league.name}: niet beschikbaar (${(error as Error).message})  (${url})`,
        );
      }
    }
  }
  return unresolved;
}

main().then((unresolved) => {
  process.exitCode = unresolved ? 1 : 0;
});
