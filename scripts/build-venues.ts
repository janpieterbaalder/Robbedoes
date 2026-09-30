// Builds lib/venues.ts: every stadium where this season's ESPN competitions are played, with
// coordinates and time zone. Run at the start of a season and whenever
// `npm run check:coverage` reports unknown stadiums: npm run build:venues
//
// Coordinates, in order of preference:
// 1. the club catalogue (lib/clubs.ts), when the home club is in it;
// 2. Wikidata: the current home ground (P115) of the home club;
// 3. OpenStreetMap (Nominatim, at most one request per second): the stadium by name;
// 4. OpenStreetMap: the city centre, marked `approx`.
// A stadium that only hosts European cup matches must also carry the name Wikidata gives
// the club's ground, because small clubs often move those matches to a bigger stadium.
// Stadiums already in lib/venues.ts keep their coordinates unless run with --refresh.
// Lookups are cached in .cache/venues.json, so an interrupted run can simply be restarted.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { findClub, normalizeName } from "../lib/club-lookup";
import { espnUrl, limit } from "../lib/espn";
import { CUPS, LEAGUES, seasonOf } from "../lib/leagues";
import { record, text } from "../lib/sources";
import { VENUES, type Venue } from "../lib/venues";

const USER_AGENT =
  "Robbedoes/1.0 (venue table; https://github.com/janpieterbaalder/Robbedoes)";
const CACHE_FILE = ".cache/venues.json";

// ESPN country name → catalogue code, ISO code (OpenStreetMap), Wikidata item, time zone.
// prettier-ignore
const COUNTRIES: Record<string, [string, string, string, string]> = {
  England: ["EN", "gb", "Q145", "Europe/London"], Wales: ["WA", "gb", "Q145", "Europe/London"],
  Scotland: ["SC", "gb", "Q145", "Europe/London"], "Northern Ireland": ["NI", "gb", "Q145", "Europe/London"],
  Netherlands: ["NL", "nl", "Q55", "Europe/Amsterdam"], Germany: ["DE", "de", "Q183", "Europe/Berlin"],
  Spain: ["ES", "es", "Q29", "Europe/Madrid"], Italy: ["IT", "it", "Q38", "Europe/Rome"],
  France: ["FR", "fr", "Q142", "Europe/Paris"], Monaco: ["MC", "mc", "Q235", "Europe/Monaco"],
  Portugal: ["PT", "pt", "Q45", "Europe/Lisbon"], Belgium: ["BE", "be", "Q31", "Europe/Brussels"],
  Austria: ["AT", "at", "Q40", "Europe/Vienna"], Switzerland: ["CH", "ch", "Q39", "Europe/Zurich"],
  Denmark: ["DK", "dk", "Q35", "Europe/Copenhagen"], Sweden: ["SE", "se", "Q34", "Europe/Stockholm"],
  Norway: ["NO", "no", "Q20", "Europe/Oslo"], Finland: ["FI", "fi", "Q33", "Europe/Helsinki"],
  Iceland: ["IS", "is", "Q189", "Atlantic/Reykjavik"], "Faroe Islands": ["FO", "fo", "Q4628", "Atlantic/Faroe"],
  Ireland: ["IE", "ie", "Q27", "Europe/Dublin"], "Republic of Ireland": ["IE", "ie", "Q27", "Europe/Dublin"],
  Greece: ["GR", "gr", "Q41", "Europe/Athens"], Turkey: ["TR", "tr", "Q43", "Europe/Istanbul"],
  "Türkiye": ["TR", "tr", "Q43", "Europe/Istanbul"], Cyprus: ["CY", "cy", "Q229", "Asia/Nicosia"],
  Israel: ["IL", "il", "Q801", "Asia/Jerusalem"], Poland: ["PL", "pl", "Q36", "Europe/Warsaw"],
  "Czech Republic": ["CZ", "cz", "Q213", "Europe/Prague"], Czechia: ["CZ", "cz", "Q213", "Europe/Prague"],
  Slovakia: ["SK", "sk", "Q214", "Europe/Bratislava"], Hungary: ["HU", "hu", "Q28", "Europe/Budapest"],
  Slovenia: ["SI", "si", "Q215", "Europe/Ljubljana"], Croatia: ["HR", "hr", "Q224", "Europe/Zagreb"],
  Serbia: ["RS", "rs", "Q403", "Europe/Belgrade"], "Bosnia and Herzegovina": ["BA", "ba", "Q225", "Europe/Sarajevo"],
  Montenegro: ["ME", "me", "Q236", "Europe/Podgorica"], Albania: ["AL", "al", "Q222", "Europe/Tirane"],
  Kosovo: ["XK", "xk", "Q1246", "Europe/Belgrade"], "North Macedonia": ["MK", "mk", "Q221", "Europe/Skopje"],
  Romania: ["RO", "ro", "Q218", "Europe/Bucharest"], Moldova: ["MD", "md", "Q217", "Europe/Chisinau"],
  Bulgaria: ["BG", "bg", "Q219", "Europe/Sofia"], Ukraine: ["UA", "ua", "Q212", "Europe/Kyiv"],
  Belarus: ["BY", "by", "Q184", "Europe/Minsk"], Lithuania: ["LT", "lt", "Q37", "Europe/Vilnius"],
  Latvia: ["LV", "lv", "Q211", "Europe/Riga"], Estonia: ["EE", "ee", "Q191", "Europe/Tallinn"],
  Georgia: ["GE", "ge", "Q230", "Asia/Tbilisi"], Armenia: ["AM", "am", "Q399", "Asia/Yerevan"],
  Azerbaijan: ["AZ", "az", "Q227", "Asia/Baku"], Kazakhstan: ["KZ", "kz", "Q232", "Asia/Almaty"],
  Luxembourg: ["LU", "lu", "Q32", "Europe/Luxembourg"], Malta: ["MT", "mt", "Q233", "Europe/Malta"],
  Gibraltar: ["GI", "gi", "Q1410", "Europe/Gibraltar"], Andorra: ["AD", "ad", "Q228", "Europe/Andorra"],
  "San Marino": ["SM", "sm", "Q238", "Europe/San_Marino"], Liechtenstein: ["LI", "li", "Q347", "Europe/Vaduz"],
};

/** Islands with their own time zone. */
function timezoneAt(code: string, zone: string, lon: number) {
  if (code === "ES" && lon < -12) return "Atlantic/Canary";
  if (code === "PT" && lon < -24) return "Atlantic/Azores";
  if (code === "PT" && lon < -15) return "Atlantic/Madeira";
  return zone;
}

/** Manual corrections by ESPN venue id, checked by hand in September 2026. */
// prettier-ignore
const VENUE_OVERRIDES: Record<
  string,
  { lat?: number; lon?: number; name?: string; city?: string; approx?: boolean }
> = {
  // Wrong place: ESPN names the wrong city, or the club plays away from its own ground.
  "339": { lat: 43.7276, lon: 7.4155, city: "Monaco" }, // Stade Louis II
  "7267": { lat: 52.4731, lon: 4.8472, city: "Wijdewormer" }, // AFAS Trainingscomplex, Jong AZ
  "9372": { lat: 50.82, lon: -0.3835, city: "Worthing" }, // Woodside Road, not the Amex
  "10870": { lat: 37.9667, lon: 23.65, city: "Nikaia", approx: true }, // Kalamata's temporary home
  "10850": { lat: 52.3957, lon: 16.8632, city: "Poznań" }, // Stadion Miejski
  "6406": { lat: 50.715, lon: 15.1623, city: "Jablonec nad Nisou" }, // Stadion Střelnice
  "10712": { lat: 43.2695, lon: -2.0231, city: "Zubieta", approx: true }, // Real Sociedad B
  "8700": { lat: 43.2695, lon: -2.0231, city: "Zubieta", approx: true },
  // Right place, wrong city name from ESPN.
  "10552": { city: "Saint-Étienne" }, "10691": { city: "Boulogne-sur-Mer" },
  "10728": { city: "Alanya" }, "10753": { city: "Southend-on-Sea" }, "1963": { city: "Cádiz" },
  "3366": { city: "Clermont-Ferrand" }, "3659": { city: "Sutton" }, "3661": { city: "Hornchurch" },
  "3760": { city: "Kristiansand" },
};

// Dutch names for cities ESPN names in English or the local language, as in lib/clubs.ts.
// prettier-ignore
const EXONYMS: Record<string, string> = {
  London: "Londen", Paris: "Parijs", Milano: "Milaan", Milan: "Milaan", Roma: "Rome",
  Napoli: "Napels", Naples: "Napels", Torino: "Turijn", Turin: "Turijn", Genova: "Genua",
  Genoa: "Genua", Firenze: "Florence", Venezia: "Venetië", Venice: "Venetië", Lisbon: "Lissabon",
  Lisboa: "Lissabon", Brussels: "Brussel", Bruxelles: "Brussel", Vienna: "Wenen", Wien: "Wenen",
  Athens: "Athene", Copenhagen: "Kopenhagen", "København": "Kopenhagen", Prague: "Praag",
  Praha: "Praag", Warsaw: "Warschau", Cologne: "Keulen", "Köln": "Keulen", Munich: "München",
  Nuremberg: "Neurenberg", "Nürnberg": "Neurenberg", Aachen: "Aken", Magdeburg: "Maagdenburg",
  Strasbourg: "Straatsburg", Seville: "Sevilla", Antwerp: "Antwerpen", Bruges: "Brugge",
  Ghent: "Gent", "Liège": "Luik", Liege: "Luik", Belgrade: "Belgrado", Bucharest: "Boekarest",
  Istanbul: "Istanboel", Gothenburg: "Göteborg", Berlin: "Berlijn", Geneva: "Genève",
};
const cityName = (espn: string) => {
  const city = espn.split(",")[0].trim();
  return EXONYMS[city] ?? city;
};

type Point = { lat: number; lon: number };
type Seen = {
  id: string;
  name: string;
  city: string;
  country: string;
  competitions: Set<string>;
  homeTeams: Set<string>;
};
type Cache = {
  osm: Record<string, Point[]>;
  /** Clubs per country: names, ground name, coordinates of the current ground. */
  wikidata: Record<string, [string[], string, number, number][]>;
  /** Stadiums per country: names and coordinates. */
  stadiums: Record<string, [string[], number, number][]>;
  cities: Record<string, Point | null>;
};

const cache: Cache = {
  osm: {},
  wikidata: {},
  stadiums: {},
  cities: {},
  ...(existsSync(CACHE_FILE)
    ? JSON.parse(readFileSync(CACHE_FILE, "utf8"))
    : {}),
};
const saveCache = () => {
  mkdirSync(".cache", { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache));
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const km = (a: Point, b: Point) => {
  const rad = (v: number) => (v * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

// Words that say nothing about which stadium is meant.
const GENERIC = new Set(
  "stadium stadion stadio estadio estadi stade stadionul stadiumi arena park ground field sportpark sports sport complex community centre center municipal municipale comunale national nacional olympic olimpico city the of de del di du la le los das der".split(
    " ",
  ),
);
const distinct = (name: string) =>
  new Set(
    normalizeName(name)
      .split(" ")
      .filter((t) => t.length > 2 && !GENERIC.has(t)),
  );
const sameGround = (a: string, b: string) => {
  const x = distinct(a);
  return [...distinct(b)].some((t) => x.has(t));
};

const espnSlot = limit(4);
async function espnMonth(slug: string, month: string) {
  return espnSlot(async () => {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(espnUrl(slug, month), {
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) return res.json();
      if (attempt === 3 || res.status === 400) return null;
      await wait(5000 * attempt);
    }
  });
}

// Language of local place and club names per ISO code, next to English.
// prettier-ignore
const LANGUAGES: Record<string, string> = {
  gb: "en", nl: "nl", de: "de", es: "es", it: "it", fr: "fr", mc: "fr", pt: "pt", be: "nl",
  at: "de", ch: "de", dk: "da", se: "sv", no: "nb", fi: "fi", is: "is", fo: "fo", ie: "ga",
  gr: "el", tr: "tr", cy: "el", il: "he", pl: "pl", cz: "cs", sk: "sk", hu: "hu", si: "sl",
  hr: "hr", rs: "sr", ba: "bs", me: "sr", al: "sq", xk: "sq", mk: "mk", ro: "ro", md: "ro",
  bg: "bg", ua: "uk", by: "be", lt: "lt", lv: "lv", ee: "et", ge: "ka", am: "hy", az: "az",
  kz: "kk", lu: "lb", mt: "mt", gi: "en", ad: "ca", sm: "it", li: "de",
};

const wikidataSlot = limit(3);
type Row = Record<string, { value: string }>;
async function sparql(query: string): Promise<Row[]> {
  return wikidataSlot(async () => {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(
        `https://query.wikidata.org/sparql?${new URLSearchParams({ query })}`,
        {
          headers: {
            Accept: "application/sparql-results+json",
            "User-Agent": USER_AGENT,
          },
          signal: AbortSignal.timeout(90000),
        },
      );
      if (res.ok) return (await res.json()).results.bindings;
      if (attempt === 3) throw new Error(`Wikidata HTTP ${res.status}`);
      await wait(10000 * attempt);
    }
  });
}
const pointOf = (wkt: string) => {
  const [, lon, lat] = wkt.match(/Point\(([-\d.]+) ([-\d.]+)\)/) ?? [];
  return lat ? { lat: +lat, lon: +lon } : undefined;
};

/** Shares one lookup between concurrent callers. */
const running = new Map<string, Promise<unknown>>();
function once<T>(key: string, load: () => Promise<T>): Promise<T> {
  if (!running.has(key)) running.set(key, load());
  return running.get(key) as Promise<T>;
}

/** Football clubs of a country with the coordinates of their current home ground. */
function wikidataClubs(qid: string) {
  return once(`clubs|${qid}`, () => loadClubs(qid));
}
async function loadClubs(qid: string) {
  if (cache.wikidata[qid]) return cache.wikidata[qid];
  const rows = await sparql(`SELECT ?club ?name ?ground ?coord WHERE {
    ?club wdt:P31 wd:Q476028 ; wdt:P17 wd:${qid} ; p:P115 ?st .
    ?st ps:P115 ?venue . FILTER NOT EXISTS { ?st pq:P582 ?end }
    ?venue wdt:P625 ?coord ; rdfs:label ?ground . FILTER(LANG(?ground) = "en")
    { ?club rdfs:label ?name } UNION { ?club skos:altLabel ?name }
  }`);
  const clubs = new Map<string, [Set<string>, string, number, number]>();
  for (const r of rows) {
    const point = pointOf(r.coord.value);
    if (!point) continue;
    const key = `${r.club.value}|${r.ground.value}`;
    const entry = clubs.get(key) ?? [
      new Set<string>(),
      r.ground.value,
      point.lat,
      point.lon,
    ];
    entry[0].add(r.name.value);
    clubs.set(key, entry);
  }
  cache.wikidata[qid] = [...clubs.values()].map(
    ([names, ground, lat, lon]): [string[], string, number, number] => [
      [...names],
      ground,
      lat,
      lon,
    ],
  );
  saveCache();
  return cache.wikidata[qid];
}

/** Stadiums of a country with their English and local names. */
function wikidataStadiums(qid: string, iso: string) {
  return once(`stadiums|${qid}`, () => loadStadiums(qid, iso));
}
async function loadStadiums(qid: string, iso: string) {
  if (cache.stadiums[qid]) return cache.stadiums[qid];
  const rows = await sparql(`SELECT ?s ?name ?coord WHERE {
    ?s wdt:P31/wdt:P279* wd:Q483110 ; wdt:P17 wd:${qid} ; wdt:P625 ?coord .
    { ?s rdfs:label ?name } UNION { ?s skos:altLabel ?name }
    FILTER(LANG(?name) IN ("en", "mul", "${LANGUAGES[iso] ?? "en"}"))
  }`);
  const stadiums = new Map<string, [Set<string>, number, number]>();
  for (const r of rows) {
    const point = pointOf(r.coord.value);
    if (!point) continue;
    const entry = stadiums.get(r.s.value) ?? [
      new Set<string>(),
      point.lat,
      point.lon,
    ];
    entry[0].add(r.name.value);
    stadiums.set(r.s.value, entry);
  }
  cache.stadiums[qid] = [...stadiums.values()].map(
    ([names, lat, lon]): [string[], number, number] => [[...names], lat, lon],
  );
  saveCache();
  return cache.stadiums[qid];
}

/** City centre: the most populous place with that name in Wikidata, else OpenStreetMap. */
async function cityPoint(city: string, qid: string, iso: string) {
  const name = city.split(",")[0].trim();
  const key = `${qid}|${name}`;
  if (!(key in cache.cities)) {
    const labels = [...new Set(["en", "mul", LANGUAGES[iso] ?? "en"])]
      .map((l) => `${JSON.stringify(name)}@${l}`)
      .join(" ");
    const rows = await sparql(`SELECT ?coord ?pop WHERE {
      VALUES ?name { ${labels} }
      ?place rdfs:label ?name ; wdt:P17 wd:${qid} ; wdt:P625 ?coord ; wdt:P1082 ?pop .
    } ORDER BY DESC(?pop) LIMIT 1`);
    cache.cities[key] =
      (rows[0] && pointOf(rows[0].coord.value)) ??
      (await osm(city, iso))[0] ??
      null;
    saveCache();
  }
  return cache.cities[key] ?? undefined;
}

const osmSlot = limit(1);
let lastOsm = 0;
async function osm(q: string, iso: string): Promise<Point[]> {
  const key = `${iso}|${q}`;
  if (cache.osm[key]) return cache.osm[key];
  return osmSlot(async () => {
    for (let attempt = 1; ; attempt++) {
      await wait(Math.max(0, lastOsm + 1500 - Date.now()));
      lastOsm = Date.now();
      const params = new URLSearchParams({
        q,
        countrycodes: iso,
        format: "jsonv2",
        limit: "5",
      });
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        {
          headers: { "User-Agent": USER_AGENT, "Accept-Language": "en" },
          signal: AbortSignal.timeout(20000),
        },
      );
      if (res.ok) {
        const hits = (await res.json()) as {
          lat: string;
          lon: string;
          category?: string;
        }[];
        // Sports grounds first.
        cache.osm[key] = hits
          .sort(
            (a, b) =>
              Number(b.category === "leisure") -
              Number(a.category === "leisure"),
          )
          .map((h) => ({ lat: +h.lat, lon: +h.lon }));
        saveCache();
        return cache.osm[key];
      }
      if (attempt === 5) throw new Error(`OpenStreetMap HTTP ${res.status}`);
      console.warn(`OpenStreetMap HTTP ${res.status}, waiting ${attempt} min`);
      await wait(60000 * attempt);
    }
  });
}

async function main() {
  const refresh = process.argv.includes("--refresh");
  const season = seasonOf(new Date().toISOString().slice(0, 10));
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(season.year, 6 + i, 1))
      .toISOString()
      .slice(0, 7)
      .replace("-", ""),
  );
  const competitions = [...LEAGUES, ...CUPS].filter((l) => l.espn);

  const seen = new Map<string, Seen>();
  await Promise.all(
    competitions.flatMap((league) =>
      months.map(async (month) => {
        const events = record(await espnMonth(league.espn!, month))?.events;
        for (const raw of Array.isArray(events) ? events : []) {
          const e = record(raw);
          const c = record(
            Array.isArray(e?.competitions) ? e.competitions[0] : undefined,
          );
          const venue = record(c?.venue ?? e?.venue);
          const id = text(venue?.id);
          if (!c || !id) continue;
          const address = record(venue?.address);
          const entry = seen.get(id) ?? {
            id,
            name: text(venue?.fullName) ?? "",
            city: text(address?.city) ?? "",
            country: text(address?.country) ?? "",
            competitions: new Set<string>(),
            homeTeams: new Set<string>(),
          };
          entry.competitions.add(league.espn!);
          if (c.neutralSite !== true && Array.isArray(c.competitors)) {
            const home = c.competitors
              .map(record)
              .find((x) => x?.homeAway === "home");
            const name = text(record(home?.team)?.displayName);
            if (name) entry.homeTeams.add(name);
          }
          seen.set(id, entry);
        }
      }),
    ),
  );
  console.log(`${seen.size} stadiums in ${competitions.length} competitions`);

  const previous = new Map(VENUES.map((v) => [v.id, v]));
  const venues: Venue[] = [];
  const report: string[] = [];
  const tally: Record<string, number> = {};
  const venueSlot = limit(4);
  const resolve = async (v: Seen) => {
    const country = COUNTRIES[v.country];
    if (!country || !v.name) {
      console.warn(
        `Skipped ${v.id} ${v.name} (${v.city}, ${v.country}): unknown country`,
      );
      return;
    }
    const [code, iso, qid, zone] = country;
    const cupOnly = [...v.competitions].every((c) => c.startsWith("uefa."));
    const fix = VENUE_OVERRIDES[v.id];
    const review = (why: string) =>
      fix || report.push(`CHECK\t${v.id}\t${v.name} (${v.city})\t${why}`);
    let point: Point | undefined;
    let method = "";
    let name = v.name.replace(/['"]+$/, "").trim(),
      city = cityName(v.city);
    const known = previous.get(v.id);
    if (known && !refresh) {
      [point, method] = [known, known.approx ? "approx" : "kept"];
      [name, city] = [known.name, known.city];
    } else {
      // A catalogue club counts when its stadium carries the ESPN name, or when it is the
      // only home club here: a ground-share or temporary move must not get its coordinates.
      const club = cupOnly
        ? undefined
        : [...v.homeTeams]
            .map((t) => findClub(t, [code], true))
            .find(
              (c) =>
                c && (v.homeTeams.size === 1 || sameGround(c.stadium, v.name)),
            );
      if (club) {
        [point, method] = [club, `catalogue:${club.id}`];
        [name, city] = [club.stadium, club.city];
      } else {
        const espnCity = v.city ? await cityPoint(v.city, qid, iso) : undefined;
        const near = (p: Point) => !espnCity || km(espnCity, p) <= 25;
        // Wikidata: the current ground of the home club. ESPN's city is sometimes wrong, so a
        // league stadium counts even far from it (listed for review); a stadium with only
        // cup matches must carry the ground's name and lie near that city.
        const teams = new Set([...v.homeTeams].map(normalizeName));
        const grounds = (await wikidataClubs(qid)).filter(
          ([names, ground, lat, lon]) =>
            names.some((n) => teams.has(normalizeName(n))) &&
            (!cupOnly || (sameGround(ground, v.name) && near({ lat, lon }))),
        );
        if (
          new Set(grounds.map(([, , lat, lon]) => `${lat},${lon}`)).size === 1
        ) {
          const [, ground, lat, lon] = grounds[0];
          [point, method] = [{ lat, lon }, `wikidata-club:${ground}`];
          if (!near(point))
            review(
              `${method} lies ${Math.round(km(espnCity!, point))} km from ESPN's city`,
            );
        }
        // Wikidata: a stadium with the same name, or sharing a distinctive word near the city.
        if (!point) {
          const target = normalizeName(v.name);
          const stadiums = (await wikidataStadiums(qid, iso)).filter(
            ([, lat, lon]) => near({ lat, lon }),
          );
          const exact = stadiums.filter(([names]) =>
            names.some((n) => normalizeName(n) === target),
          );
          const pick = exact.length
            ? exact
            : espnCity
              ? stadiums.filter(([names]) =>
                  names.some((n) => sameGround(n, v.name)),
                )
              : [];
          if (new Set(pick.map(([, lat, lon]) => `${lat},${lon}`)).size === 1) {
            const [names, lat, lon] = pick[0];
            [point, method] = [{ lat, lon }, `wikidata-stadium:${names[0]}`];
          }
        }
        // OpenStreetMap: the stadium by name, else the city centre.
        if (!point) {
          const hits = [
            ...(v.city ? await osm(`${v.name}, ${v.city}`, iso) : []),
            ...(await osm(v.name, iso)),
          ].filter(near);
          if (hits.length) [point, method] = [hits[0], "osm"];
          else if (espnCity) {
            [point, method] = [espnCity, "approx"];
            review("city centre only");
          }
        }
      }
    }
    if (fix) {
      if (fix.lat !== undefined && fix.lon !== undefined)
        [point, method] = [{ lat: fix.lat, lon: fix.lon }, "override"];
      name = fix.name ?? name;
      city = fix.city ?? city;
    }
    if (!point) {
      console.warn(`No location for ${v.id} ${v.name} (${v.city})`);
      return;
    }
    const kind = method.split(":")[0];
    tally[kind] = (tally[kind] ?? 0) + 1;
    report.push(
      `${v.id}\t${code}\t${v.name}\t${v.city}\t${method}\t${name}\t${city}`,
    );
    const lat = +point.lat.toFixed(4),
      lon = +point.lon.toFixed(4);
    venues.push({
      id: v.id,
      name,
      city,
      country: code,
      lat,
      lon,
      timezone: timezoneAt(code, zone, lon),
      ...((fix?.approx ?? method === "approx") ? { approx: true } : {}),
      competitions: [...v.competitions].sort(),
    });
  };
  await Promise.all([...seen.values()].map((v) => venueSlot(() => resolve(v))));
  report.sort();

  venues.sort(
    (a, b) =>
      a.country.localeCompare(b.country) ||
      a.city.localeCompare(b.city) ||
      a.name.localeCompare(b.name),
  );
  const row = (v: Venue) =>
    `  { ${Object.entries(v)
      .map(([k, value]) => `${k}: ${JSON.stringify(value)}`)
      .join(", ")} },`;
  const header = `// Stadiums of the ESPN competitions, keyed by ESPN venue id. Generated by
// scripts/build-venues.ts; do not edit by hand. Put corrections in VENUE_OVERRIDES in that
// script and run \`npm run build:venues\`. Coordinates partly © OpenStreetMap contributors
// (ODbL) and from Wikidata (CC0).
export type Venue = {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  timezone: string;
  /** Only the city centre is known; the stadium can be a few kilometres away. */
  approx?: boolean;
  /** ESPN slugs of the competitions played here. */
  competitions: string[];
};

// prettier-ignore
export const VENUES: Venue[] = [
`;
  const footer = `];

export const venueById = new Map(VENUES.map((v) => [v.id, v]));
`;
  // npm runs scripts from the repository root.
  writeFileSync(
    "lib/venues.ts",
    header + venues.map(row).join("\n") + "\n" + footer,
  );
  writeFileSync(".cache/venues-report.tsv", report.join("\n") + "\n");
  console.log(tally, "details in .cache/venues-report.tsv");
}

main().catch((error) => {
  saveCache();
  console.error(error);
  process.exit(1);
});
