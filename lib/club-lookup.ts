import { CLUBS, type Club } from "./clubs";

// Tokens that carry no identity in club names ("FC", "de", "Calcio", ...). Plain numbers
// ("1.", "04", "1846") are dropped too, except "2", which marks a reserve side like "II".
const NOISE = new Set(
  "fc afc cf sc sv ssc ac as us ss rc rcd cd ud sd ca cs gd fk sk bk vfl vfb tsg bv spvgg tsv ssv fsv bsc ogc sco es aj osc sbv dsc ksv club clube de del della di da do dos das la le les calcio futbol football and e".split(
    " ",
  ),
);
// A provider name with one of these must never resolve to a first team's stadium.
const SQUAD_MARKERS = new Set(
  "ii iii b u19 u21 u23 jong reserves women frauen femenino femminile feminine castilla mestalla atletic sanse primavera next".split(
    " ",
  ),
);

export function normalizeName(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .replace(/ł/g, "l")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((t) => (t === "2" ? "ii" : t))
    .filter((t) => t && !NOISE.has(t) && !/^\d+$/.test(t))
    .join(" ");
}

type Indexed = { club: Club; keys: string[][] };
const indexed: Indexed[] = CLUBS.map((club) => ({
  club,
  keys: [...new Set(club.aliases.map(normalizeName).filter(Boolean))].map((k) =>
    k.split(" "),
  ),
}));
const exact = new Map<string, Club[]>();
for (const { club, keys } of indexed)
  for (const k of keys) {
    const key = k.join(" ");
    const list = exact.get(key) ?? [];
    if (!list.includes(club)) list.push(club);
    exact.set(key, list);
  }

const memo = new Map<string, Club | null>();

/**
 * Resolves a provider team name to a catalogue club. Exact alias matches win. Within the
 * given countries a name may also match when it contains every word of an alias
 * ("Real Betis Balompié SAD" → Real Betis); the longest such alias must be unique.
 * Outside those countries only exact matches count, so "Sporting Gijón" never becomes
 * Sporting CP.
 * With `wholeName` only whole-name matches count. Use that for providers whose leagues
 * include clubs outside the catalogue, so "Juve Stabia" never becomes Juventus.
 */
export function findClub(
  name: string,
  countries?: readonly string[],
  wholeName = false,
) {
  const memoKey = `${wholeName ? "=" : ""}${countries?.join(",") ?? "*"}|${name}`;
  const hit = memo.get(memoKey);
  if (hit !== undefined) return hit ?? undefined;
  const result = resolve(name, countries, wholeName) ?? null;
  memo.set(memoKey, result);
  return result ?? undefined;
}

function resolve(
  name: string,
  countries: readonly string[] | undefined,
  wholeName: boolean,
) {
  const key = normalizeName(name);
  if (!key) return undefined;
  const candidates = exact.get(key) ?? [];
  const scoped = countries
    ? candidates.filter((c) => countries.includes(c.country))
    : candidates;
  if (scoped.length === 1) return scoped[0];
  if (scoped.length > 1) return undefined;
  if (!countries) return candidates.length === 1 ? candidates[0] : undefined;
  if (wholeName) return undefined;
  const tokens = new Set(key.split(" "));
  let best: Club | undefined,
    bestLength = 0,
    tie = false;
  for (const { club, keys } of indexed) {
    if (!countries.includes(club.country)) continue;
    for (const k of keys) {
      if (!k.every((t) => tokens.has(t))) continue;
      if ([...tokens].some((t) => SQUAD_MARKERS.has(t) && !k.includes(t)))
        continue;
      if (k.length > bestLength) {
        best = club;
        bestLength = k.length;
        tie = false;
      } else if (k.length === bestLength && best !== club) tie = true;
    }
  }
  if (best && !tie) return best;
  return candidates.length === 1 ? candidates[0] : undefined;
}
