import test from "node:test";
import assert from "node:assert/strict";
import { checkSources } from "../lib/status";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

test("reports every source and whether the football-data.org key works", async () => {
  const seen: { url: string; token?: string }[] = [];
  const checks = await checkSources(
    "secret",
    async (url, init) => {
      seen.push({
        url,
        token: (init.headers as Record<string, string>)["X-Auth-Token"],
      });
      if (url.includes("openfootball")) return json({ matches: [{}, {}, {}] });
      if (url.includes("openligadb")) return json([{}, {}]);
      return json(
        { message: "The resource you are looking for is restricted." },
        403,
      );
    },
    "2026-09-28",
  );
  assert.deepEqual(
    checks.map((c) => [c.source, c.state, c.httpStatus, c.detail]),
    [
      ["openfootball", "ok", 200, "Eredivisie 2026-27: 3 wedstrijden."],
      ["OpenLigaDB", "ok", 200, "Bundesliga 2026-27: 2 wedstrijden."],
      [
        "football-data.org",
        "error",
        403,
        "Sleutel ongeldig of zonder toegang tot de Champions League.",
      ],
    ],
  );
  assert.equal(
    seen.find((s) => s.url.includes("football-data"))?.token,
    "secret",
  );
  assert.ok(seen.some((s) => s.url.endsWith("/2026-27/nl.1.json")));
  assert.ok(seen.some((s) => s.url.endsWith("/getmatchdata/bl1/2026")));
});

test("a missing key is reported, not treated as an error", async () => {
  const checks = await checkSources(
    undefined,
    async () => {
      throw new Error("offline");
    },
    "2026-09-28",
  );
  assert.deepEqual(
    checks.map((c) => [c.source, c.state]),
    [
      ["openfootball", "error"],
      ["OpenLigaDB", "error"],
      ["football-data.org", "not_configured"],
    ],
  );
  assert.equal(checks[0].detail, "Bron niet bereikbaar.");
});
