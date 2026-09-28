import { seasonOf } from "./leagues";
import { openfootballUrl, openLigaDbUrl } from "./sources";

export type SourceCheck = {
  source: string;
  state: "ok" | "error" | "not_configured";
  httpStatus?: number;
  ms?: number;
  detail: string;
};

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

const FOOTBALL_DATA_ERRORS: Record<number, string> = {
  400: "Verzoek geweigerd; controleer of de sleutel volledig is overgenomen.",
  401: "Sleutel ongeldig.",
  403: "Sleutel ongeldig of zonder toegang tot de Champions League.",
  429: "Limiet bereikt (10 verzoeken per minuut). Probeer het over een minuut opnieuw.",
};

async function probe(
  fetcher: Fetcher,
  source: string,
  url: string,
  headers: Record<string, string>,
  describe: (data: unknown) => string,
  errors: Record<number, string> = {},
): Promise<SourceCheck> {
  const started = Date.now();
  try {
    const res = await fetcher(url, {
      headers: { Accept: "application/json", ...headers },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const ms = Date.now() - started;
    if (!res.ok)
      return {
        source,
        state: "error",
        httpStatus: res.status,
        ms,
        detail: errors[res.status] ?? `Bron antwoordt met HTTP ${res.status}.`,
      };
    return {
      source,
      state: "ok",
      httpStatus: res.status,
      ms,
      detail: describe(await res.json()),
    };
  } catch {
    return {
      source,
      state: "error",
      ms: Date.now() - started,
      detail: "Bron niet bereikbaar.",
    };
  }
}

const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);

/** Checks every fixture source live, including whether the football-data.org key works. */
export async function checkSources(
  footballDataKey: string | undefined,
  fetcher: Fetcher = fetch,
  today = new Date().toISOString().slice(0, 10),
): Promise<SourceCheck[]> {
  const season = seasonOf(today);
  return Promise.all([
    probe(
      fetcher,
      "openfootball",
      openfootballUrl(season.label, "nl.1"),
      {},
      (d) =>
        `Eredivisie ${season.label}: ${count((d as { matches?: unknown })?.matches)} wedstrijden.`,
    ),
    probe(
      fetcher,
      "OpenLigaDB",
      openLigaDbUrl("bl1", season.year),
      {},
      (d) => `Bundesliga ${season.label}: ${count(d)} wedstrijden.`,
    ),
    footballDataKey
      ? probe(
          fetcher,
          "football-data.org",
          "https://api.football-data.org/v4/competitions/CL",
          { "X-Auth-Token": footballDataKey },
          () => "Sleutel werkt; Champions League beschikbaar.",
          FOOTBALL_DATA_ERRORS,
        )
      : Promise.resolve<SourceCheck>({
          source: "football-data.org",
          state: "not_configured",
          detail:
            "Geen FOOTBALL_DATA_API_KEY ingesteld. Alleen nodig voor de Champions League.",
        }),
  ]);
}
